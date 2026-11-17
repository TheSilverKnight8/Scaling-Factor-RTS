import type { ItemId } from './content/items';
import { STRUCTURES, type StructureKind } from './content/structures';
import { POWER_LINE, type TransportKind } from './content/transport';
import { placeBelts, removeBelts, type BeltTile } from './belts';
import { addStructure } from './factory';
import { canAfford, contents, giveFromHub, pay, refund, restartGrid, returnBag, setRecipe, takeToHub } from './economy';
import { FP } from './fmath';
import { findPath, nearestOpen, spreadTiles } from './path';
import { canPlace } from './placement';
import { canConnect, linesOf } from './power';
import { cache, getPlayer, type MatchState, type Unit, unitTile } from './state';
import type { Imperative, UnitKind } from './content/units';
import { placeUnit, setMode, setPatrol, setProduce, setRally } from './production';

// Everything a player does reaches the match as a command, applied at the start of a tick.
// In multiplayer (Stage 6) only commands travel between computers, so every action must be
// one of these and must be checked here, not only in the interface.

export type Command =
  | { type: 'move'; player: number; units: number[]; tx: number; ty: number }
  | { type: 'build'; player: number; kind: StructureKind; x: number; y: number; rot: number }
  | { type: 'demolish'; player: number; id: number }
  | { type: 'belts'; player: number; kind: TransportKind; tiles: BeltTile[] }
  | { type: 'removeBelts'; player: number; ids: number[] }
  | { type: 'line'; player: number; a: number; b: number }
  | { type: 'removeLines'; player: number; id: number }
  | { type: 'take'; player: number; id: number; item: ItemId }
  | { type: 'give'; player: number; id: number; item: ItemId }
  | { type: 'recipe'; player: number; id: number; recipe: string | null }
  | { type: 'restart'; player: number; id: number }
  | { type: 'attack'; player: number; units: number[]; target: number }
  | { type: 'produce'; player: number; id: number; unit: UnitKind | null }
  | { type: 'mode'; player: number; id: number; mode: 'auto' | 'directed'; imperative: Imperative }
  | { type: 'rally'; player: number; id: number; x: number; y: number }
  | { type: 'patrol'; player: number; id: number; points: number[] }
  | { type: 'placeUnit'; player: number; kind: UnitKind; x: number; y: number };

export function applyCommand(s: MatchState, c: Command) {
  switch (c.type) {
    case 'move':
      return moveUnits(s, c.player, c.units, c.tx, c.ty);
    case 'build':
      return build(s, c.player, c.kind, c.x, c.y, c.rot);
    case 'demolish':
      return demolish(s, c.player, c.id);
    case 'belts':
      return placeBelts(s, c.player, c.kind, c.tiles);
    case 'removeBelts':
      return removeBelts(s, c.player, c.ids);
    case 'line':
      return addLine(s, c.player, c.a, c.b);
    case 'removeLines':
      return removeLinesOf(s, c.player, c.id);
    case 'take':
      return takeToHub(s, c.player, c.id, c.item);
    case 'give':
      return giveFromHub(s, c.player, c.id, c.item);
    case 'recipe':
      return setRecipe(s, c.player, c.id, c.recipe);
    case 'restart':
      return restartGrid(s, c.player, c.id);
    case 'attack':
      return attack(s, c.player, c.units, c.target);
    case 'produce':
      return setProduce(s, c.player, c.id, c.unit);
    case 'mode':
      return setMode(s, c.player, c.id, c.mode, c.imperative);
    case 'rally':
      return setRally(s, c.player, c.id, c.x, c.y);
    case 'patrol':
      return setPatrol(s, c.player, c.id, c.points);
    case 'placeUnit':
      return placeUnit(s, c.player, c.kind, c.x, c.y);
  }
}

export function sendTo(s: MatchState, u: Unit, goal: number) {
  u.goal = goal;
  u.path = findPath(s, unitTile(s, u), goal);
  u.pathStep = 0;
  u.pathVersion = s.blockVersion;
}

/** Ordered units spread out over the open tiles nearest the target, one unit per tile. */
function moveUnits(s: MatchState, player: number, ids: number[], tx: number, ty: number) {
  if (tx < 0 || ty < 0 || tx >= s.size || ty >= s.size) return;
  const wanted = new Set(ids);
  const units = s.units.filter((u) => u.owner === player && wanted.has(u.id));
  if (units.length === 0) return;
  const slots = spreadTiles(s, ty * s.size + tx, units.length);
  if (slots.length === 0) return;
  const taken = new Uint8Array(slots.length);
  const size = s.size;
  for (const u of units) {
    // Each unit takes the nearest slot still free (units in id order, so the result is fixed).
    const ux = Math.floor(u.x / FP);
    const uy = Math.floor(u.y / FP);
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < slots.length; i++) {
      if (taken[i]) continue;
      const dx = (slots[i] % size) - ux;
      const dy = Math.floor(slots[i] / size) - uy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) best = 0;
    taken[best] = 1;
    takeCharge(u);
    u.order = { kind: 'move', tile: slots[best] };
    sendTo(s, u, slots[best]);
  }
}

/** A unit the player gives an order to waits for the player's orders from then on. */
function takeCharge(u: Unit) {
  u.mode = 'directed';
  u.source = 0;
  u.target = 0;
  u.chaseTile = -1;
}

/** Ordered units attack a target: an enemy unit, structure or belt (SPEC: units attack structures directly). */
function attack(s: MatchState, player: number, ids: number[], target: number) {
  const c = cache(s);
  const owner = s.units.find((u) => u.id === target)?.owner ?? c.structById.get(target)?.owner ?? c.beltById.get(target)?.owner;
  if (owner === undefined || owner === player) return;
  const wanted = new Set(ids);
  for (const u of s.units) {
    if (u.owner !== player || !wanted.has(u.id)) continue;
    takeCharge(u);
    u.order = { kind: 'attack', target };
    u.target = target;
    u.path = [];
    u.pathStep = 0;
  }
}

function build(s: MatchState, player: number, kind: StructureKind, x: number, y: number, rot: number) {
  const p = getPlayer(s, player);
  if (!p || kind === 'hub') return;
  const def = STRUCTURES[kind];
  if (!def.atStart) return; // Research (Stage 4) unlocks the rest.
  const r = ((rot % 4) + 4) % 4;
  if (!canPlace(s, player, kind, x, y, r).ok) return;
  if (!canAfford(p, def.cost)) return;
  pay(p, def.cost);
  const id = addStructure(s, player, kind, x, y, r, false).id;
  // The player's own units standing there step out to the nearest open tile.
  for (const u of s.units) {
    if (u.owner !== player) continue;
    const t = unitTile(s, u);
    if (s.occupied[t] !== id) continue;
    const out = nearestOpen(s, t);
    if (out >= 0) {
      u.goal = out;
      u.path = [out];
      u.pathStep = 0;
      u.pathVersion = s.blockVersion;
    }
  }
}

/** Demolishing refunds the full cost (SPEC) and returns what the structure held, to the Hub. */
function demolish(s: MatchState, player: number, id: number) {
  const p = getPlayer(s, player);
  const i = s.structures.findIndex((t) => t.id === id);
  if (!p || i < 0) return;
  const t = s.structures[i];
  if (t.owner !== player || t.kind === 'hub') return;
  refund(p, STRUCTURES[t.kind].cost);
  returnBag(p, contents(t));
  removeLinesOf(s, player, id);
  s.structures.splice(i, 1);
  for (let yy = t.y; yy < t.y + t.h; yy++) for (let xx = t.x; xx < t.x + t.w; xx++) s.occupied[yy * s.size + xx] = 0;
  s.blockVersion++;
  s.powerVersion++;
}

function addLine(s: MatchState, player: number, a: number, b: number) {
  const p = getPlayer(s, player);
  if (!p) return;
  const c = cache(s);
  if (!canConnect(s, player, c.structById.get(a), c.structById.get(b)).ok) return;
  if (!canAfford(p, POWER_LINE.cost)) return;
  pay(p, POWER_LINE.cost);
  s.lines.push({ id: s.nextId++, owner: player, a, b });
  s.powerVersion++;
}

/** Removes every power line attached to a structure, refunding each. */
function removeLinesOf(s: MatchState, player: number, id: number) {
  const p = getPlayer(s, player);
  if (!p) return;
  const mine = linesOf(s, id).filter((l) => l.owner === player);
  if (!mine.length) return;
  refund(p, POWER_LINE.cost, mine.length);
  const gone = new Set(mine.map((l) => l.id));
  s.lines = s.lines.filter((l) => !gone.has(l.id));
  s.powerVersion++;
}
