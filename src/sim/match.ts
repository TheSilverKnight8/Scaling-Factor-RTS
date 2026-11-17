import { STRUCTURES } from './content/structures';
import { UNITS, type UnitKind } from './content/units';
import { HUB_SIGHT } from './constants';
import { reveal } from './fog';
import { getMap } from './map/maps';
import { NODE_SIZE } from './map/types';
import { spreadTiles } from './path';
import { nextInt } from './rng';
import { type MatchState, type Player, fogChunks, tileCenter } from './state';

export interface MatchSetup {
  mapId: string;
  /** Picks the start locations. In multiplayer every computer gets the same seed. */
  seed: number;
  players: { name: string; color: number }[];
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
    nodeAt,
    blockVersion: 0,
    players: [],
    units: [],
    structures: [],
    nextId: 1,
    rng: setup.seed | 0,
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
      explored: new Uint8Array(size * size),
      fogVersion: new Uint32Array(fogChunks(size)),
    };
    s.players.push(p);

    const hub = STRUCTURES.hub;
    const hx = start.x - Math.floor(hub.w / 2);
    const hy = start.y - Math.floor(hub.h / 2);
    const id = s.nextId++;
    s.structures.push({ id, owner: p.id, kind: 'hub', x: hx, y: hy, w: hub.w, h: hub.h, rot: 0, hp: hub.hp, buildLeft: 0, buildTotal: 0 });
    for (let y = hy; y < hy + hub.h; y++) for (let x = hx; x < hx + hub.w; x++) s.occupied[y * size + x] = id;
    p.hubId = id;
    reveal(s, p, start.x, start.y, HUB_SIGHT);

    // The Minutemen stand on the open tiles just in front of the Hub.
    const front = (hy + hub.h + 1) * size + start.x;
    for (const t of spreadTiles(s, front, START_MINUTEMEN)) spawnUnit(s, p.id, 'minuteman', t);
  });
  return s;
}

export function spawnUnit(s: MatchState, owner: number, kind: UnitKind, tile: number) {
  const x = tileCenter(tile % s.size);
  const y = tileCenter(Math.floor(tile / s.size));
  s.units.push({
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
  });
}
