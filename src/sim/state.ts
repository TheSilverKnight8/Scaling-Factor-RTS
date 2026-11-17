import type { Bag, ItemId } from './content/items';
import { portsOf, type Port, type StructureKind } from './content/structures';
import type { TransportKind } from './content/transport';
import type { UnitKind } from './content/units';
import { FOG_CHUNK } from './constants';
import { FP } from './fmath';
import { Tile, type MapData } from './map/types';

// The match state. It holds whole numbers and plain arrays and objects only, and changes only
// in step() (src/sim/step.ts), so every computer that applies the same commands gets the same
// match. `cache` is derived from the rest and rebuilt whenever it is out of date.

export interface Player {
  /** 1 to 4. */
  id: number;
  name: string;
  /** Index into the player colors (src/render/style.ts). */
  color: number;
  hubId: number;
  /** The Hub's inventory (SPEC: the Hub acts as the player's inventory). */
  hub: Bag;
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
  /** blockVersion when the path was found; a newer version means the ground changed. */
  pathVersion: number;
  /** Last direction moved (sub-units), for drawing which way the unit faces. */
  dirX: number;
  dirY: number;
  /** Tile the unit last revealed fog from. */
  seenFrom: number;
}

/** Why a structure is or is not working, for its panel and the icons over it. */
export type StructureStatus = 'building' | 'working' | 'idle' | 'noRecipe' | 'noInput' | 'outputFull' | 'noPower' | 'blown';

export interface Structure {
  id: number;
  owner: number;
  kind: StructureKind;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Quarter turns, 0 to 3. Footprint w and h already include it. */
  rot: number;
  hp: number;
  /** Ticks until finished; 0 once built. A structure does nothing until it is finished. */
  buildLeft: number;
  /** Ticks its building takes in all. */
  buildTotal: number;
  /** A Smelter's or Constructor's chosen recipe. */
  recipe: string | null;
  /** Ingredients waiting (machines) or everything stored (Depot). */
  inv: Bag;
  /** Products waiting to go out. */
  out: Bag;
  /** Ticks left in the current cycle (0: not in a cycle). For a Drill, ticks toward the next item. */
  progress: number;
  status: StructureStatus;
  /** On a grid whose power went out from overload, until the player restarts it (SPEC). */
  blown: boolean;
  /** Which power grid it is on (the lowest structure id in the grid). */
  grid: number;
  /** Turn-taking among output ports and items. */
  rr: number;
}

export interface BeltItem {
  item: ItemId;
  /** How far along this tile, 0 (entry) to FP (exit). */
  pos: number;
}

/** One tile of transport: a belt, splitter or merger. */
export interface Belt {
  id: number;
  owner: number;
  kind: TransportKind;
  x: number;
  y: number;
  /** The way items move: 0 +x, 1 +y, 2 -x, 3 -y. */
  dir: number;
  /** Items on this tile, front (nearest the exit) first. */
  items: BeltItem[];
  /** Splitter: which output is next. Merger: the side the last item came from. */
  rr: number;
}

/** A power line between two structures (poles count as structures). */
export interface PowerLine {
  id: number;
  owner: number;
  a: number;
  b: number;
}

/** Lookups derived from the state, rebuilt when it changes. Not part of the fingerprint. */
export interface Cache {
  blockVersion: number;
  transportVersion: number;
  structById: Map<number, Structure>;
  ports: Map<number, Port[]>;
  beltById: Map<number, Belt>;
  /** Belts in the order they move: those nearest the end of a line first. */
  beltOrder: Belt[];
}

export interface MatchState {
  tick: number;
  map: MapData;
  size: number;
  /** Structure id on each tile, 0 if none. */
  occupied: Int32Array;
  /** Belt (or splitter or merger) id on each tile, 0 if none. */
  beltAt: Int32Array;
  /** Node id on each tile, 0 if none. Fixed for the match. */
  nodeAt: Int32Array;
  /** Bumped when a structure or belt is built or removed; units check their paths against it. */
  blockVersion: number;
  /** Bumped when belts change. */
  transportVersion: number;
  /** Bumped when power lines or structures change, so grids are worked out again. */
  powerVersion: number;
  gridVersion: number;
  players: Player[];
  units: Unit[];
  structures: Structure[];
  belts: Belt[];
  lines: PowerLine[];
  nextId: number;
  rng: number;
  cache: Cache;
}

export const tileIndex = (s: MatchState, x: number, y: number) => y * s.size + x;
export const inBounds = (s: MatchState, x: number, y: number) => x >= 0 && y >= 0 && x < s.size && y < s.size;

/**
 * Ground units can stand on this tile: ground terrain, no structure and no belt (belts block
 * units, Caleb after Stage 1). Nodes can be walked over.
 */
export function walkable(s: MatchState, i: number) {
  return s.map.terrain[i] === Tile.Ground && s.occupied[i] === 0 && s.beltAt[i] === 0;
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

export function emptyCache(): Cache {
  return { blockVersion: -1, transportVersion: -1, structById: new Map(), ports: new Map(), beltById: new Map(), beltOrder: [] };
}

/** The derived lookups, rebuilt first if the structures or belts changed. */
export function cache(s: MatchState): Cache {
  const c = s.cache;
  if (c.blockVersion !== s.blockVersion) {
    c.blockVersion = s.blockVersion;
    c.structById = new Map(s.structures.map((t) => [t.id, t]));
    c.ports = new Map(s.structures.map((t) => [t.id, portsOf(t.kind, t.x, t.y, t.rot)]));
  }
  if (c.transportVersion !== s.transportVersion) {
    c.transportVersion = s.transportVersion;
    c.beltById = new Map(s.belts.map((b) => [b.id, b]));
    c.beltOrder = beltOrder(s, c.beltById);
  }
  return c;
}

export function getStructure(s: MatchState, id: number) {
  return cache(s).structById.get(id);
}

/**
 * Belts ordered so the ones nearest the end of each line move first, which lets a full line
 * move together in one tick. Ties go by id, so the order is the same everywhere.
 */
function beltOrder(s: MatchState, byId: Map<number, Belt>): Belt[] {
  const DXs = [1, 0, -1, 0];
  const DYs = [0, 1, 0, -1];
  const depth = new Map<number, number>();
  const next = (b: Belt) => {
    const x = b.x + DXs[b.dir];
    const y = b.y + DYs[b.dir];
    if (x < 0 || y < 0 || x >= s.size || y >= s.size) return undefined;
    const id = s.beltAt[y * s.size + x];
    return id ? byId.get(id) : undefined;
  };
  for (const b of s.belts) {
    if (depth.has(b.id)) continue;
    // Walk downstream until a known depth, the end, or a loop.
    const chain: Belt[] = [];
    const onChain = new Set<number>();
    let cur: Belt | undefined = b;
    let base = 0;
    while (cur && !onChain.has(cur.id)) {
      const known = depth.get(cur.id);
      if (known !== undefined) {
        base = known + 1;
        break;
      }
      chain.push(cur);
      onChain.add(cur.id);
      cur = next(cur);
    }
    for (let i = chain.length - 1; i >= 0; i--) depth.set(chain[i].id, base + (chain.length - 1 - i));
  }
  return [...s.belts].sort((a, b) => depth.get(a.id)! - depth.get(b.id)! || a.id - b.id);
}
