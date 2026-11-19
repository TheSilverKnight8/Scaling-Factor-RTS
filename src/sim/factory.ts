import { STRUCTURES, footprint, type StructureKind } from './content/structures';
import { UNITS, type Imperative, type UnitKind } from './content/units';
import { TICK_RATE } from './constants';
import { tileCenter, type HaulRoute, type MatchState, type Structure, type Unit } from './state';

// Making new structures and units, with every field set, in one place.

/** A new structure on its footprint. A structure being built starts at a tenth of its health (Caleb). */
export function addStructure(s: MatchState, owner: number, kind: StructureKind, x: number, y: number, rot: number, built: boolean): Structure {
  const def = STRUCTURES[kind];
  const { w, h } = footprint(kind, rot);
  const id = s.nextId++;
  const buildTotal = built ? 0 : def.buildSeconds * TICK_RATE;
  const t: Structure = {
    id,
    owner,
    kind,
    x,
    y,
    w,
    h,
    rot,
    hp: buildTotal > 0 ? Math.ceil(def.hp / 10) : def.hp,
    buildLeft: buildTotal,
    buildTotal,
    recipe: null,
    inv: {},
    out: {},
    progress: 0,
    status: buildTotal > 0 ? 'building' : 'working',
    blown: false,
    grid: id,
    rr: 0,
    produce: null,
    mode: 'auto',
    imperative: 'aggressive',
    rally: -1,
    patrol: [],
    made: 0,
    lastPulse: -1000,
    lastHurt: -1000,
    energy: 0,
    haul: null,
    waypoint: -1,
  };
  s.structures.push(t);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) s.occupied[yy * s.size + xx] = id;
  s.blockVersion++;
  s.powerVersion++;
  if (kind === 'railStation') s.railVersion++;
  return t;
}

/** Health a structure being built should have gained by now: from a tenth to all of it, evenly. */
export function buildHealth(maxHp: number, done: number, total: number) {
  return Math.floor((maxHp * (total + 9 * done)) / (10 * total));
}

export interface UnitSetup {
  mode?: 'auto' | 'directed';
  imperative?: Imperative;
  home?: number;
  source?: number;
  patrol?: number[];
  haul?: HaulRoute | null;
}

/** A new unit standing on the center of a tile. */
export function addUnit(s: MatchState, owner: number, kind: UnitKind, tile: number, setup: UnitSetup = {}): Unit {
  const x = tileCenter(tile % s.size);
  const y = tileCenter(Math.floor(tile / s.size));
  const u: Unit = {
    id: s.nextId++,
    owner,
    kind,
    x,
    y,
    px: x,
    py: y,
    hp: UNITS[kind].hp,
    path: [],
    pathStep: 0,
    goal: -1,
    pathVersion: 0,
    dirX: 1,
    dirY: 1,
    seenFrom: -1,
    mode: setup.mode ?? 'directed',
    imperative: setup.imperative ?? 'hold',
    home: setup.home ?? tile,
    patrol: setup.patrol ?? [],
    patrolStep: 0,
    source: setup.source ?? 0,
    order: null,
    target: 0,
    cooldown: 0,
    lastAttack: -1000,
    lastHurt: -1000,
    chaseTile: -1,
    haul: setup.haul ? { ...setup.haul } : null,
    haulState: 0,
    carryItem: null,
    carry: 0,
    haulTicks: 0,
    lastPost: 0,
  };
  s.units.push(u);
  return u;
}
