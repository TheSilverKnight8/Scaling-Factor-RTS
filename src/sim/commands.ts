import { STRUCTURES, footprint, type StructureKind } from './content/structures';
import { FP } from './fmath';
import { findPath, nearestOpen, spreadTiles } from './path';
import { canPlace } from './placement';
import { type MatchState, type Unit, unitTile } from './state';

// Everything a player does reaches the match as a command, applied at the start of a tick.
// In multiplayer (Stage 6) only commands travel between computers, so every action must be
// one of these and must be checked here, not only in the interface.

export type Command =
  | { type: 'move'; player: number; units: number[]; tx: number; ty: number }
  | { type: 'build'; player: number; kind: StructureKind; x: number; y: number; rot: number }
  | { type: 'demolish'; player: number; id: number };

export function applyCommand(s: MatchState, c: Command) {
  switch (c.type) {
    case 'move':
      return moveUnits(s, c.player, c.units, c.tx, c.ty);
    case 'build':
      return build(s, c.player, c.kind, c.x, c.y, c.rot);
    case 'demolish':
      return demolish(s, c.player, c.id);
  }
}

function sendTo(s: MatchState, u: Unit, goal: number) {
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
    sendTo(s, u, slots[best]);
  }
}

function build(s: MatchState, player: number, kind: StructureKind, x: number, y: number, rot: number) {
  if (kind === 'hub') return;
  if (!STRUCTURES[kind].atStart) return; // Research (Stage 4) unlocks the rest.
  const r = rot & 1;
  const check = canPlace(s, player, kind, x, y, r);
  if (!check.ok) return;
  const { w, h } = footprint(kind, r);
  const id = s.nextId++;
  s.structures.push({ id, owner: player, kind, x, y, w, h, rot: r, hp: STRUCTURES[kind].hp });
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) s.occupied[yy * s.size + xx] = id;
  s.blockVersion++;
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

function demolish(s: MatchState, player: number, id: number) {
  const i = s.structures.findIndex((t) => t.id === id);
  if (i < 0) return;
  const t = s.structures[i];
  if (t.owner !== player || t.kind === 'hub') return;
  s.structures.splice(i, 1);
  for (let yy = t.y; yy < t.y + t.h; yy++) for (let xx = t.x; xx < t.x + t.w; xx++) s.occupied[yy * s.size + xx] = 0;
  s.blockVersion++;
}

export { sendTo };
