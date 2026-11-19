import { START_INVENTORY } from './content/economy';
import type { UnitKind } from './content/units';
import { HUB_SIGHT } from './constants';
import { addStructure, addUnit, type UnitSetup } from './factory';
import { reveal } from './fog';
import { makeTree } from './research';
import { getMap } from './map/maps';
import { NODE_SIZE } from './map/types';
import { spreadTiles } from './path';
import { nextInt } from './rng';
import { emptyCache, type MatchState, type Player, fogChunks } from './state';

export interface MatchSetup {
  mapId: string;
  /** Picks the start locations. In multiplayer every computer gets the same seed. */
  seed: number;
  players: { name: string; color: number; cpu?: 'idle' }[];
}

/** How many Minutemen each player starts with (SPEC "Hub"). */
const START_MINUTEMEN = 3;

/**
 * A new match: each player gets a Hub at a random start location (SPEC "Multiplayer
 * details": start locations are random) and three Minutemen beside it.
 */
export function createMatch(setup: MatchSetup): MatchState {
  const map = getMap(setup.mapId);
  const size = map.size;
  const nodeAt = new Int32Array(size * size);
  for (const n of map.nodes) for (let y = n.y; y < n.y + NODE_SIZE; y++) for (let x = n.x; x < n.x + NODE_SIZE; x++) nodeAt[y * size + x] = n.id;

  const s: MatchState = {
    tick: 0,
    map,
    size,
    occupied: new Int32Array(size * size),
    beltAt: new Int32Array(size * size),
    nodeAt,
    blockVersion: 0,
    transportVersion: 0,
    powerVersion: 0,
    gridVersion: -1,
    players: [],
    units: [],
    structures: [],
    belts: [],
    lines: [],
    nextId: 1,
    rng: setup.seed | 0,
    cache: emptyCache(),
    events: [],
  };

  // Shuffle the start locations and hand them out in player order.
  const order = map.starts.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = nextInt(s, i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }

  setup.players.forEach((info, i) => {
    const start = map.starts[order[i]];
    const p: Player = {
      id: i + 1,
      name: info.name,
      color: info.color,
      hubId: 0,
      hub: { ...START_INVENTORY },
      explored: new Uint8Array(size * size),
      fogVersion: new Uint32Array(fogChunks(size)),
      queue: [],
      eliminated: false,
      cpu: info.cpu ?? null,
      researched: ['basics'],
      tree: makeTree(s),
    };
    s.players.push(p);

    const hub = addStructure(s, p.id, 'hub', start.x - 2, start.y - 2, 0, true);
    p.hubId = hub.id;
    reveal(s, p, start.x, start.y, HUB_SIGHT);

    // The Minutemen stand on the open tiles just in front of the Hub. A player's start with
    // the player's own orders; an idle CPU's hold their ground.
    const front = (hub.y + hub.h + 1) * size + start.x;
    for (const t of spreadTiles(s, front, START_MINUTEMEN)) addUnit(s, p.id, 'minuteman', t, p.cpu ? { mode: 'auto', imperative: 'hold', home: t } : { mode: 'directed', home: t });
  });
  return s;
}

/** A unit standing on a tile (tests and tools). */
export function spawnUnit(s: MatchState, owner: number, kind: UnitKind, tile: number, setup: UnitSetup = {}) {
  return addUnit(s, owner, kind, tile, setup);
}
