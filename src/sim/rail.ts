import { bagAdd, bagTotal, ITEM_IDS } from './content/items';
import { DX, DY } from './content/structures';
import { RAIL_HP } from './constants';
import { STATION_CAPACITY, TRAIN, TRANSPORT } from './content/transport';
import { canAfford, pay, refund, returnBag } from './economy';
import { FP, isqrt } from './fmath';
import { Tile } from './map/types';
import { powered } from './flow';
import { transportUnlocked } from './research';
import { cache, getPlayer, tileCenter, type MatchState, type Structure, type Train, type TrainStop } from './state';

// Rails, Rail Stations and trains (SPEC "Transport": rails run shipments of cargo between
// points, for large multi-item or long-range transport). Rails are tiles of track; units can
// cross them (Caleb). A Rail Station's track runs through its middle. A train runs on its
// owner's track from stop to stop of its list (Caleb), standing a moment at each: it unloads
// into the station, then loads what the station holds. It carries solids and fluids (Caleb).

/** Whether a player may lay rail on this tile. */
export function canPlaceRail(s: MatchState, player: number, x: number, y: number): { ok: true } | { ok: false; reason: string } {
  const p = getPlayer(s, player);
  if (!p) return { ok: false, reason: 'No such player.' };
  if (x < 0 || y < 0 || x >= s.size || y >= s.size) return { ok: false, reason: 'Off the map.' };
  const i = y * s.size + x;
  if (!p.explored[i]) return { ok: false, reason: 'Cannot build in fog.' };
  if (s.map.terrain[i] === Tile.Cliff) return { ok: false, reason: 'Rails cannot cross cliffs.' };
  if (s.occupied[i]) return { ok: false, reason: 'A structure is in the way.' };
  if (s.beltAt[i]) return { ok: false, reason: 'A belt or pipe is in the way.' };
  if (s.nodeAt[i]) return { ok: false, reason: 'Nodes are kept for Drills, Pumps and Haulers.' };
  return { ok: true };
}

/** Lays rail on all the tiles (tiles already railed by the player are skipped and free), or none if any cannot be placed or paid for. */
export function placeRails(s: MatchState, player: number, tiles: readonly { x: number; y: number }[]) {
  const p = getPlayer(s, player);
  if (!p || tiles.length === 0 || tiles.length > 400 || !transportUnlocked(p, 'rail')) return;
  const seen = new Set<number>();
  const fresh: { x: number; y: number }[] = [];
  for (const t of tiles) {
    if (!Number.isInteger(t.x) || !Number.isInteger(t.y)) return;
    const i = t.y * s.size + t.x;
    if (t.x < 0 || t.y < 0 || t.x >= s.size || t.y >= s.size || seen.has(i)) return;
    seen.add(i);
    const r = s.railAt[i] ? cache(s).railById.get(s.railAt[i]) : undefined;
    if (r) {
      if (r.owner !== player) return;
      continue;
    }
    if (!canPlaceRail(s, player, t.x, t.y).ok) return;
    fresh.push(t);
  }
  if (!fresh.length || !canAfford(p, TRANSPORT.rail.cost, fresh.length)) return;
  pay(p, TRANSPORT.rail.cost, fresh.length);
  for (const t of fresh) {
    const id = s.nextId++;
    s.rails.push({ id, owner: player, x: t.x, y: t.y, hp: RAIL_HP });
    s.railAt[t.y * s.size + t.x] = id;
  }
  s.railVersion++;
}

/** Removes rail tiles; their cost goes back to the Hub. */
export function removeRails(s: MatchState, player: number, ids: readonly number[]) {
  const p = getPlayer(s, player);
  if (!p) return;
  const gone = new Set<number>();
  for (const id of ids) {
    const r = cache(s).railById.get(id);
    if (!r || r.owner !== player || gone.has(id)) continue;
    gone.add(id);
    refund(p, TRANSPORT.rail.cost);
    s.railAt[r.y * s.size + r.x] = 0;
  }
  if (!gone.size) return;
  s.rails = s.rails.filter((r) => !gone.has(r.id));
  s.railVersion++;
}

/** The tiles (indices) of a Rail Station's track: the middle line along its long side. */
export function trackTiles(s: MatchState, t: Structure): number[] {
  const out: number[] = [];
  if (t.w >= t.h) {
    const y = t.y + Math.floor(t.h / 2);
    for (let x = t.x; x < t.x + t.w; x++) out.push(y * s.size + x);
  } else {
    const x = t.x + Math.floor(t.w / 2);
    for (let y = t.y; y < t.y + t.h; y++) out.push(y * s.size + x);
  }
  return out;
}

/** The tile in the middle of a station's track, where trains stop. */
export function stationStop(s: MatchState, t: Structure): number {
  const tr = trackTiles(s, t);
  return tr[Math.floor((tr.length - 1) / 2)];
}

/**
 * Track a player's trains can use: their rail tiles and their finished Rail Stations' track.
 * Inside a station, trains run only along its track.
 */
function trackOf(s: MatchState, player: number): { on: Uint8Array; station: Int32Array } {
  const n = s.size * s.size;
  const on = new Uint8Array(n);
  const station = new Int32Array(n);
  for (const r of s.rails) if (r.owner === player) on[r.y * s.size + r.x] = 1;
  for (const t of s.structures) {
    if (t.owner !== player || t.kind !== 'railStation' || t.buildLeft > 0) continue;
    for (const i of trackTiles(s, t)) {
      on[i] = 1;
      station[i] = t.id;
    }
  }
  return { on, station };
}

/** The way along the track from one tile to another (not including the start), or null. Breadth first, fixed order. */
function railPath(s: MatchState, track: { on: Uint8Array; station: Int32Array }, from: number, to: number): number[] | null {
  if (from === to) return [];
  if (!track.on[from] || !track.on[to]) return null;
  const size = s.size;
  const prev = new Int32Array(size * size).fill(-1);
  prev[from] = from;
  const queue = [from];
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    if (c === to) break;
    const cx = c % size;
    const cy = Math.floor(c / size);
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = ny * size + nx;
      if (!track.on[ni] || prev[ni] >= 0) continue;
      // Into or out of a station only along its track (its track tiles are the only ones marked).
      if (track.station[c] && track.station[ni] && track.station[c] !== track.station[ni]) continue;
      prev[ni] = c;
      queue.push(ni);
    }
  }
  if (prev[to] < 0) return null;
  const path: number[] = [];
  for (let t = to; t !== from; t = prev[t]) path.push(t);
  return path.reverse();
}

// ------------------------------------------------------------------ the player's settings

/** Buys a train at a Rail Station (paid from the Hub); it starts there with no stops. */
export function addTrain(s: MatchState, player: number, stationId: number) {
  const p = getPlayer(s, player);
  const t = cache(s).structById.get(stationId);
  if (!p || !t || t.owner !== player || t.kind !== 'railStation' || t.buildLeft > 0) return;
  if (!transportUnlocked(p, 'rail') || !canAfford(p, TRAIN.cost)) return;
  pay(p, TRAIN.cost);
  const stop = stationStop(s, t);
  const x = tileCenter(stop % s.size);
  const y = tileCenter(Math.floor(stop / s.size));
  s.trains.push({ id: s.nextId++, owner: player, x, y, px: x, py: y, dirX: t.w >= t.h ? 1 : 0, dirY: t.w >= t.h ? 0 : 1, stops: [], next: 0, path: [], pathStep: 0, pathVersion: -1, noWay: false, dwell: 0, cargo: {} });
}

/** Sets a train's stop list (Caleb: a train with a stop list). Up to TRAIN.maxStops of the player's Rail Stations. */
export function setStops(s: MatchState, player: number, id: number, stops: TrainStop[]) {
  const tr = s.trains.find((x) => x.id === id);
  if (!tr || tr.owner !== player || !Array.isArray(stops) || stops.length > TRAIN.maxStops) return;
  const c = cache(s);
  for (const st of stops) {
    const t = c.structById.get(st.station);
    if (!t || t.owner !== player || t.kind !== 'railStation') return;
  }
  tr.stops = stops.map((st) => ({ station: st.station, load: !!st.load, unload: !!st.unload }));
  tr.next = 0;
  tr.path = [];
  tr.pathStep = 0;
  tr.pathVersion = -1;
  tr.dwell = 0;
}

/** Takes a train off the rails: its cost and its cargo go back to the Hub. */
export function removeTrain(s: MatchState, player: number, id: number) {
  const p = getPlayer(s, player);
  const tr = s.trains.find((x) => x.id === id);
  if (!p || !tr || tr.owner !== player) return;
  refund(p, TRAIN.cost);
  returnBag(p, tr.cargo);
  s.trains = s.trains.filter((x) => x !== tr);
}

// ------------------------------------------------------------------ running

/** Moves cargo from one bag to another, up to `room` items, in item order. Returns how many moved. */
function transfer(from: Record<string, number | undefined>, to: Record<string, number | undefined>, room: number): number {
  let moved = 0;
  for (const id of ITEM_IDS) {
    if (room <= 0) break;
    const n = Math.min(from[id] ?? 0, room);
    if (n <= 0) continue;
    bagAdd(from as never, id, -n);
    bagAdd(to as never, id, n);
    room -= n;
    moved += n;
  }
  return moved;
}

/** One tick of every train: heading for its next stop, standing at a stop, loading and unloading. */
export function tickTrains(s: MatchState) {
  if (!s.trains.length) return;
  const c = cache(s);
  const tracks = new Map<number, ReturnType<typeof trackOf>>();
  const trackFor = (player: number) => {
    let t = tracks.get(player);
    if (!t) {
      t = trackOf(s, player);
      tracks.set(player, t);
    }
    return t;
  };
  for (const tr of s.trains) {
    tr.px = tr.x;
    tr.py = tr.y;
    if (tr.dwell > 0) {
      tr.dwell--;
      if (tr.dwell === 0) {
        tr.next = (tr.next + 1) % Math.max(1, tr.stops.length);
        tr.pathVersion = -1;
      }
      continue;
    }
    if (!tr.stops.length) continue;
    // Skip stops whose station is gone.
    let stop = tr.stops[tr.next % tr.stops.length];
    let station = c.structById.get(stop.station);
    for (let k = 0; k < tr.stops.length && (!station || station.kind !== 'railStation'); k++) {
      tr.next = (tr.next + 1) % tr.stops.length;
      stop = tr.stops[tr.next];
      station = c.structById.get(stop.station);
    }
    if (!station || station.kind !== 'railStation') continue;
    const here = Math.floor(tr.y / FP) * s.size + Math.floor(tr.x / FP);
    const goal = stationStop(s, station);
    // Find the way for a new stop or after the track changed; with no way, look again now and then.
    if (tr.pathVersion !== s.railVersion || (tr.noWay && (s.tick + tr.id) % 20 === 0)) {
      const p = railPath(s, trackFor(tr.owner), here, goal);
      tr.path = p ?? [];
      tr.pathStep = 0;
      tr.pathVersion = s.railVersion;
      tr.noWay = !p;
    }
    if (tr.pathStep >= tr.path.length) {
      if (here === goal && tr.x === tileCenter(goal % s.size) && tr.y === tileCenter(Math.floor(goal / s.size))) arrive(s, tr, stop, station);
      continue;
    }
    // Move along the path, up to its speed this tick.
    let budget = TRAIN.speed;
    while (budget > 0 && tr.pathStep < tr.path.length) {
      const t = tr.path[tr.pathStep];
      // The track ahead was removed: stop and find the way again.
      if (!trackFor(tr.owner).on[t]) {
        tr.pathVersion = -1;
        break;
      }
      const tx = tileCenter(t % s.size);
      const ty = tileCenter(Math.floor(t / s.size));
      const dx = tx - tr.x;
      const dy = ty - tr.y;
      const d = isqrt(dx * dx + dy * dy);
      if (d !== 0) {
        tr.dirX = dx;
        tr.dirY = dy;
      }
      if (d <= budget) {
        tr.x = tx;
        tr.y = ty;
        budget -= d;
        tr.pathStep++;
      } else {
        tr.x += Math.trunc((dx * budget) / d);
        tr.y += Math.trunc((dy * budget) / d);
        budget = 0;
      }
    }
  }
}

/** At a stop: unload into the station, then load what it holds; stand a moment; then on to the next stop. */
function arrive(s: MatchState, tr: Train, stop: TrainStop, station: Structure) {
  // A station without power does nothing (SPEC: all structures need power to run).
  if (powered(station)) {
    if (stop.unload) transfer(tr.cargo, station.out, STATION_CAPACITY - bagTotal(station.out));
    if (stop.load) transfer(station.inv, tr.cargo, TRAIN.capacity - bagTotal(tr.cargo));
  }
  tr.dwell = TRAIN.dwell;
  void s;
}

/** For panels: what a train is doing. */
export function trainStatus(s: MatchState, tr: Train): string {
  if (!tr.stops.length) return 'No stops: add Rail Stations to its list.';
  const st = cache(s).structById.get(tr.stops[tr.next % tr.stops.length].station);
  if (tr.dwell > 0) return `Stopped at stop ${tr.next + 1}.`;
  if (tr.noWay) return `No track to stop ${tr.next + 1}${st ? '' : ' (its station is gone)'}.`;
  return `On its way to stop ${tr.next + 1}.`;
}
