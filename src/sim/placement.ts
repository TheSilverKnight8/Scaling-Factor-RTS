import { RESOURCES } from './content/resources';
import { STRUCTURES, footprint, type StructureKind } from './content/structures';
import { FP } from './fmath';
import { Tile } from './map/types';
import type { MatchState } from './state';

export type PlaceResult = { ok: true; nodeId: number } | { ok: false; reason: string };

/**
 * Whether a player can place a structure with its top-left tile at (x, y). Structures go on
 * the grid, never in fog, on water or on cliffs (SPEC "Map and fog of war"). A Drill or Pump
 * must sit exactly on a node of its kind; other structures cannot cover a node.
 */
export function canPlace(s: MatchState, player: number, kind: StructureKind, x: number, y: number, rot: number): PlaceResult {
  const def = STRUCTURES[kind];
  const p = s.players.find((pl) => pl.id === player);
  if (!p) return { ok: false, reason: 'No such player.' };
  const { w, h } = footprint(kind, rot);
  if (x < 0 || y < 0 || x + w > s.size || y + h > s.size) return { ok: false, reason: 'Off the map.' };

  let nodeId = 0;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = yy * s.size + xx;
      if (!p.explored[i]) return { ok: false, reason: 'Cannot build in fog.' };
      const t = s.map.terrain[i];
      if (t === Tile.Water) return { ok: false, reason: 'Cannot build on water.' };
      if (t === Tile.Cliff) return { ok: false, reason: 'Cannot build on cliffs.' };
      if (s.occupied[i]) return { ok: false, reason: 'Something is already built here.' };
      if (s.beltAt[i]) return { ok: false, reason: 'A belt is in the way.' };
      const n = s.nodeAt[i];
      if (n) {
        if (!def.onNode) return { ok: false, reason: 'Nodes are kept for Drills and Pumps.' };
        if (nodeId && nodeId !== n) return { ok: false, reason: 'Covers two nodes.' };
        nodeId = n;
      }
    }
  }

  if (def.onNode) {
    const node = nodeId ? s.map.nodes[nodeId - 1] : undefined;
    if (!node) return { ok: false, reason: `A ${def.name} goes on a node.` };
    if (node.x !== x || node.y !== y) return { ok: false, reason: `Line the ${def.name} up with the node.` };
    const fluid = RESOURCES[node.resource].fluid;
    if (def.onNode === 'solid' && fluid) return { ok: false, reason: 'Oil needs a Pump.' };
    if (def.onNode === 'fluid' && !fluid) return { ok: false, reason: 'A Pump only goes on oil.' };
  }

  // Another player's units in the way block placement; your own step aside.
  for (const u of s.units) {
    if (u.owner === player) continue;
    const ux = Math.floor(u.x / FP);
    const uy = Math.floor(u.y / FP);
    if (ux >= x && ux < x + w && uy >= y && uy < y + h) return { ok: false, reason: 'Units are in the way.' };
  }
  return { ok: true, nodeId };
}

/** For a Drill or Pump: the top-left tile that lines it up with the node under (tx, ty), if any. */
export function snapToNode(s: MatchState, kind: StructureKind, tx: number, ty: number): { x: number; y: number } | null {
  if (!STRUCTURES[kind].onNode) return null;
  if (tx < 0 || ty < 0 || tx >= s.size || ty >= s.size) return null;
  const n = s.nodeAt[ty * s.size + tx];
  if (!n) return null;
  const node = s.map.nodes[n - 1];
  return { x: node.x, y: node.y };
}
