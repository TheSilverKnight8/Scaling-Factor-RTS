import { TRANSPORT, BELT_SPACING, BELT_SPEED, type TransportKind } from './content/transport';
import { bagAdd } from './content/items';
import { canAfford, pay, refund } from './economy';
import { deliver } from './flow';
import { FP } from './fmath';
import { Tile } from './map/types';
import { nearestOpen } from './path';
import { cache, getPlayer, unitTile, type MatchState } from './state';

// Belts, splitters and mergers (SPEC "Transport"). Each is one tile with a direction. Items
// move along at BELT_SPEED, at least BELT_SPACING apart, and pass to whatever the tile points
// at. Belts can cross water but not cliffs, and they block ground units (Caleb).

export interface BeltTile {
  x: number;
  y: number;
  dir: number;
}

export type BeltCheck = { ok: true } | { ok: false; reason: string };

/** Whether a player may lay this kind of transport on this tile. */
export function canPlaceBelt(s: MatchState, player: number, kind: TransportKind, x: number, y: number): BeltCheck {
  const p = getPlayer(s, player);
  if (!p) return { ok: false, reason: 'No such player.' };
  if (x < 0 || y < 0 || x >= s.size || y >= s.size) return { ok: false, reason: 'Off the map.' };
  const i = y * s.size + x;
  if (!p.explored[i]) return { ok: false, reason: 'Cannot build in fog.' };
  if (s.map.terrain[i] === Tile.Cliff) return { ok: false, reason: 'Belts cannot cross cliffs.' };
  if (s.occupied[i]) return { ok: false, reason: 'A structure is in the way.' };
  if (s.nodeAt[i]) return { ok: false, reason: 'Nodes are kept for Drills and Pumps.' };
  const existing = s.beltAt[i];
  if (existing) {
    const b = cache(s).beltById.get(existing)!;
    // Laying a belt over your own belt only turns it.
    if (b.owner !== player || kind !== 'belt' || b.kind !== 'belt') return { ok: false, reason: 'Something is already built here.' };
  }
  for (const u of s.units) {
    if (u.owner !== player && unitTile(s, u) === i) return { ok: false, reason: 'Units are in the way.' };
  }
  return { ok: true };
}

/** How many new tiles a placement would add (turning an existing belt is free). */
export function newBeltCount(s: MatchState, tiles: readonly BeltTile[]) {
  return tiles.filter((t) => t.x >= 0 && t.y >= 0 && t.x < s.size && t.y < s.size && !s.beltAt[t.y * s.size + t.x]).length;
}

/** Lays transport on all the tiles, or none of them if any cannot be placed or paid for. */
export function placeBelts(s: MatchState, player: number, kind: TransportKind, tiles: readonly BeltTile[]) {
  const p = getPlayer(s, player);
  if (!p || tiles.length === 0 || tiles.length > 400) return;
  const seen = new Set<number>();
  for (const t of tiles) {
    if (!canPlaceBelt(s, player, kind, t.x, t.y).ok) return;
    if (t.dir < 0 || t.dir > 3 || !Number.isInteger(t.dir)) return;
    const i = t.y * s.size + t.x;
    if (seen.has(i)) return;
    seen.add(i);
  }
  const added = newBeltCount(s, tiles);
  const cost = TRANSPORT[kind].cost;
  if (!canAfford(p, cost, added)) return;
  pay(p, cost, added);
  const c = cache(s);
  for (const t of tiles) {
    const i = t.y * s.size + t.x;
    const existing = s.beltAt[i];
    if (existing) {
      c.beltById.get(existing)!.dir = t.dir;
      continue;
    }
    const id = s.nextId++;
    s.belts.push({ id, owner: player, kind, x: t.x, y: t.y, dir: t.dir, items: [], rr: kind === 'merger' ? -1 : 0 });
    s.beltAt[i] = id;
  }
  s.transportVersion++;
  s.blockVersion++;
  // The player's own units standing there step aside.
  for (const u of s.units) {
    if (u.owner !== player) continue;
    const t = unitTile(s, u);
    if (!seen.has(t)) continue;
    const out = nearestOpen(s, t);
    if (out >= 0) {
      u.goal = out;
      u.path = [out];
      u.pathStep = 0;
      u.pathVersion = s.blockVersion;
    }
  }
}

/** Removes transport tiles. Their cost and the items on them go back to the Hub. */
export function removeBelts(s: MatchState, player: number, ids: readonly number[]) {
  const p = getPlayer(s, player);
  if (!p) return;
  const gone = new Set<number>();
  for (const id of ids) {
    const b = cache(s).beltById.get(id);
    if (!b || b.owner !== player || gone.has(id)) continue;
    gone.add(id);
    refund(p, TRANSPORT[b.kind].cost);
    for (const it of b.items) bagAdd(p.hub, it.item, 1);
    s.beltAt[b.y * s.size + b.x] = 0;
  }
  if (!gone.size) return;
  s.belts = s.belts.filter((b) => !gone.has(b.id));
  s.transportVersion++;
  s.blockVersion++;
}

/** Moves every item on every belt one tick, front items first, passing them on at the end. */
export function tickBelts(s: MatchState) {
  const c = cache(s);
  for (const b of c.beltOrder) {
    const items = b.items;
    if (!items.length) continue;
    // The front item: on to the next thing when it reaches the end of the tile.
    const front = items[0];
    const p = front.pos + BELT_SPEED;
    if (p >= FP) {
      front.pos = FP;
      if (passOn(s, b.owner, b, front.item)) items.shift();
    } else front.pos = p;
    // The rest follow, keeping their distance.
    for (let k = items.length > 0 && items[0] === front ? 1 : 0; k < items.length; k++) {
      const limit = k === 0 ? FP : items[k - 1].pos - BELT_SPACING;
      items[k].pos = Math.min(items[k].pos + BELT_SPEED, limit);
    }
  }
}

/** A splitter sends items out of its front, right and left in turn; others straight on. */
function passOn(s: MatchState, owner: number, b: { kind: TransportKind; x: number; y: number; dir: number; rr: number }, item: Parameters<typeof deliver>[5]) {
  if (b.kind !== 'splitter') return deliver(s, owner, b.x, b.y, b.dir, item);
  const outs = [b.dir, (b.dir + 1) % 4, (b.dir + 3) % 4];
  for (let k = 0; k < 3; k++) {
    const i = (b.rr + k) % 3;
    if (deliver(s, owner, b.x, b.y, outs[i], item)) {
      b.rr = (i + 1) % 3;
      return true;
    }
  }
  return false;
}
