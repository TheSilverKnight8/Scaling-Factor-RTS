import { INPUT_CYCLES } from './content/economy';
import { UNITS, type Imperative, type UnitKind } from './content/units';
import { HUB_QUEUE, TICK_RATE, UNIT_LIMIT } from './constants';
import { addUnit } from './factory';
import { bagAdd } from './content/items';
import { nearestOpen, spreadTiles } from './path';
import { cache, getPlayer, unitCountOf, walkable, type MatchState, type Structure } from './state';
import { canAfford, pay, returnBag } from './economy';
import { unitUnlocked } from './research';

// Making units (SPEC "Unit production and automation", "Hand-placed units"). A Deployer makes
// one unit type at a time from its key parts, delivered by belt or by hand, for as long as it
// has parts and power. The Hub makes units placed by hand, paid from its inventory. Both pause
// at the unit limit.

export const PRODUCERS = new Set(['deployer', 'garage', 'landingPad']);
export const isProducer = (t: Structure) => PRODUCERS.has(t.kind);

/** The tile just outside the middle of a structure's front (the side opposite its inputs). */
export function frontTile(s: MatchState, t: Structure): number {
  const dir = (1 + t.rot) % 4;
  let x: number;
  let y: number;
  if (dir === 0) [x, y] = [t.x + t.w, t.y + Math.floor(t.h / 2)];
  else if (dir === 1) [x, y] = [t.x + Math.floor(t.w / 2), t.y + t.h];
  else if (dir === 2) [x, y] = [t.x - 1, t.y + Math.floor(t.h / 2)];
  else [x, y] = [t.x + Math.floor(t.w / 2), t.y - 1];
  x = Math.max(0, Math.min(s.size - 1, x));
  y = Math.max(0, Math.min(s.size - 1, y));
  const i = y * s.size + x;
  if (walkable(s, i)) return i;
  const o = nearestOpen(s, i);
  return o >= 0 ? o : i;
}

/** Where a structure's units gather: its rally point, or just outside its front. */
export function rallyOf(s: MatchState, t: Structure): number {
  return t.rally >= 0 ? t.rally : frontTile(s, t);
}

/** The next free spot around a rally point, so units spread out instead of piling up. */
function homeSlot(s: MatchState, t: Structure): number {
  const slots = spreadTiles(s, rallyOf(s, t), 40);
  if (!slots.length) return rallyOf(s, t);
  return slots[t.made % slots.length];
}

const parts = (t: Structure) => (t.produce ? UNITS[t.produce].parts : []);

/** Whether a production structure would work (and draw power) this tick. */
export function producerWants(s: MatchState, t: Structure): boolean {
  if (!t.produce) return false;
  // At the unit limit, production pauses, even part way through a unit (SPEC).
  if (unitCountOf(s, t.owner) >= UNIT_LIMIT) return false;
  if (t.progress > 0) return true;
  return parts(t).every(([id, n]) => (t.inv[id] ?? 0) >= n);
}

/** One tick of production: start a unit from parts, count down, and send it out when done. */
export function producerWork(s: MatchState, t: Structure) {
  const kind = t.produce!;
  if (t.progress === 0) {
    for (const [id, n] of parts(t)) bagAdd(t.inv, id, -n);
    t.progress = UNITS[kind].seconds * TICK_RATE;
  }
  t.progress--;
  if (t.progress === 0) {
    const home = homeSlot(s, t);
    t.made++;
    addUnit(s, t.owner, kind, frontTile(s, t), { mode: t.mode, imperative: t.imperative, home, source: t.id, patrol: [...t.patrol] });
  }
}

/** How many of an item a production structure takes now (by belt or by hand). */
export function producerRoom(t: Structure, item: string): number {
  const need = parts(t).find(([id]) => id === item);
  return need ? Math.max(0, need[1] * INPUT_CYCLES - (t.inv[need[0]] ?? 0)) : 0;
}

/** Parts in a unit being made, returned if its production is changed or it is demolished. */
export function partsInProgress(t: Structure) {
  return t.progress > 0 && t.produce ? UNITS[t.produce].parts : [];
}

// ------------------------------------------------------------------ the player's settings

/** Chooses what a production structure makes (SPEC: one type at a time, switchable). Its parts go back to the Hub. */
export function setProduce(s: MatchState, player: number, id: number, kind: UnitKind | null) {
  const p = getPlayer(s, player);
  const t = cache(s).structById.get(id);
  if (!p || !t || t.owner !== player || !isProducer(t)) return;
  if (kind !== null && (!unitUnlocked(p, kind) || UNITS[kind].producedAt !== t.kind)) return;
  if (kind === t.produce) return;
  for (const [item, n] of partsInProgress(t)) bagAdd(p.hub, item, n);
  returnBag(p, t.inv);
  t.inv = {};
  t.progress = 0;
  t.produce = kind;
}

/** Sets how a structure's units act (SPEC: per structure), for its units to come and those it already made. */
export function setMode(s: MatchState, player: number, id: number, mode: 'auto' | 'directed', imperative: Imperative) {
  const t = cache(s).structById.get(id);
  if (!t || t.owner !== player || !isProducer(t)) return;
  if (!['aggressive', 'hold', 'patrol', 'explore'].includes(imperative)) return;
  t.mode = mode;
  t.imperative = imperative;
  for (const u of s.units) {
    if (u.source !== t.id) continue;
    u.mode = mode;
    u.imperative = imperative;
    u.target = 0;
  }
}

/** Moves a structure's rally point; its units waiting there move with it. */
export function setRally(s: MatchState, player: number, id: number, x: number, y: number) {
  const t = cache(s).structById.get(id);
  if (!t || t.owner !== player || !isProducer(t)) return;
  if (x < 0 || y < 0 || x >= s.size || y >= s.size) return;
  t.rally = y * s.size + x;
  const slots = spreadTiles(s, t.rally, 40);
  let k = 0;
  for (const u of s.units) {
    if (u.source !== t.id || !slots.length) continue;
    u.home = slots[k++ % slots.length];
  }
}

/** Sets a structure's patrol points (SPEC: Patrol loops between points). */
export function setPatrol(s: MatchState, player: number, id: number, points: number[]) {
  const t = cache(s).structById.get(id);
  if (!t || t.owner !== player || !isProducer(t)) return;
  const ok = points.filter((i) => Number.isInteger(i) && i >= 0 && i < s.size * s.size).slice(0, 8);
  t.patrol = ok;
  for (const u of s.units) {
    if (u.source !== t.id) continue;
    u.patrol = [...ok];
    u.patrolStep = 0;
  }
}

// ------------------------------------------------------------------ the Hub

/**
 * Places a unit by hand (SPEC "Hand-placed units"): paid now from the Hub, made at the Hub,
 * then it walks to the spot and holds it (Caleb).
 */
export function placeUnit(s: MatchState, player: number, kind: UnitKind, x: number, y: number) {
  const p = getPlayer(s, player);
  if (!p || p.eliminated || !UNITS[kind] || !unitUnlocked(p, kind)) return;
  if (x < 0 || y < 0 || x >= s.size || y >= s.size) return;
  if (p.queue.length >= HUB_QUEUE) return;
  if (!canAfford(p, UNITS[kind].parts)) return;
  pay(p, UNITS[kind].parts);
  p.queue.push({ kind, tile: y * s.size + x });
}

/** The Hub makes the units placed by hand, one at a time, while under the unit limit. */
export function tickHubs(s: MatchState) {
  for (const p of s.players) {
    if (p.eliminated) continue;
    const hub = cache(s).structById.get(p.hubId);
    if (!hub) continue;
    if (hub.progress > 0) {
      hub.progress--;
      if (hub.progress > 0) continue;
      const q = p.queue.shift();
      if (!q) continue;
      // Hold the spot, or the nearest free one if another unit already holds it.
      const taken = new Set(s.units.filter((u) => u.owner === p.id).map((u) => u.home));
      const slots = spreadTiles(s, q.tile, 30);
      const home = slots.find((t) => !taken.has(t)) ?? slots[0] ?? q.tile;
      addUnit(s, p.id, q.kind, frontTile(s, hub), { mode: 'auto', imperative: 'hold', home });
      continue;
    }
    if (p.queue.length && unitCountOf(s, p.id) < UNIT_LIMIT) hub.progress = UNITS[p.queue[0].kind].hubSeconds * TICK_RATE;
  }
}

