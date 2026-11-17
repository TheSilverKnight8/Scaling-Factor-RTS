import type { StructureKind } from './content/structures';
import type { UnitKind } from './content/units';
import { FOG_CHUNK } from './constants';
import { FP } from './fmath';
import { Tile, type MapData } from './map/types';

// The match state. It holds whole numbers and plain arrays only, and changes only in step()
// (src/sim/step.ts), so every computer that applies the same commands gets the same match.

export interface Player {
  /** 1 to 4. */
  id: number;
  name: string;
  /** Index into the player colors (src/render/style.ts). */
  color: number;
  hubId: number;
  /** 1 where this player has explored. Fog is lifted for good once explored (SPEC). */
  explored: Uint8Array;
  /** Bumped whenever a fog chunk's explored tiles change, so the renderer redraws only that chunk. */
  fogVersion: Uint32Array;
}

export interface Unit {
  id: number;
  owner: number;
  kind: UnitKind;
  /** Position in sub-units (FP per tile). */
  x: number;
  y: number;
  /** Position at the end of the previous tick, so drawing can move smoothly between ticks. */
  px: number;
  py: number;
  hp: number;
  /** Waypoints (tile indices) still ahead, from pathStep on. */
  path: number[];
  pathStep: number;
  /** The tile the unit was ordered to, or -1. */
  goal: number;
  /** blockVersion when the path was found; a newer version means structures changed. */
  pathVersion: number;
  /** Last direction moved (sub-units), for drawing which way the unit faces. */
  dirX: number;
  dirY: number;
  /** Tile the unit last revealed fog from. */
  seenFrom: number;
}

export interface Structure {
  id: number;
  owner: number;
  kind: StructureKind;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0 or 1 (a quarter turn). Footprint w and h already include it. */
  rot: number;
  hp: number;
  /** Ticks until finished; 0 once built. A structure does nothing until it is finished. */
  buildLeft: number;
  /** Ticks its building takes in all. */
  buildTotal: number;
}

export interface MatchState {
  tick: number;
  map: MapData;
  size: number;
  /** Structure id on each tile, 0 if none. */
  occupied: Int32Array;
  /** Node id on each tile, 0 if none. Fixed for the match. */
  nodeAt: Int32Array;
  /** Bumped when a structure is built or removed; units check their paths against it. */
  blockVersion: number;
  players: Player[];
  units: Unit[];
  structures: Structure[];
  nextId: number;
  rng: number;
}

export const tileIndex = (s: MatchState, x: number, y: number) => y * s.size + x;
export const inBounds = (s: MatchState, x: number, y: number) => x >= 0 && y >= 0 && x < s.size && y < s.size;

/** Ground units can stand on this tile: ground terrain and no structure. Nodes can be walked over. */
export function walkable(s: MatchState, i: number) {
  return s.map.terrain[i] === Tile.Ground && s.occupied[i] === 0;
}

/** Sub-unit position of a tile's center. */
export const tileCenter = (t: number) => t * FP + FP / 2;

export function unitTile(s: MatchState, u: Unit) {
  return Math.floor(u.y / FP) * s.size + Math.floor(u.x / FP);
}

export function fogChunks(size: number) {
  const n = Math.ceil(size / FOG_CHUNK);
  return n * n;
}

export function getPlayer(s: MatchState, id: number) {
  return s.players.find((p) => p.id === id);
}

export function getStructure(s: MatchState, id: number) {
  return s.structures.find((t) => t.id === id);
}
