import { hash2 } from '../rng';
import type { Purity, ResourceId } from '../content/resources';
import { MapBuilder } from './builder';
import { Tile, type MapData } from './types';

// The fixed maps (SPEC "Map and fog of war": 3 maps, StarCraft-sized, any 2-4 players,
// about 6 start locations evenly spaced from the center, nodes in the same place every time).
// Stage 1 builds the first one; the other two come in Stage 5. Layouts and names are the
// builder's (docs/decisions.md).

export interface MapInfo {
  id: string;
  name: string;
  blurb: string;
  build: () => MapData;
}

/**
 * Basin: an island with a lake in the middle. Six start locations sit on a ring around it.
 * Cliff ridges run out from the lake between neighbors, so ground routes go around the
 * inner ring or the outer ring. The richest (Pure) nodes are on the lake shore.
 */
function buildBasin(): MapData {
  const seed = 0x5ca1;
  const b = new MapBuilder(192, seed);
  const C = b.center;
  /** Small, fixed per-node offsets (-1, 0 or 1 tile): starts are balanced, with a little variance. */
  const jitter = (i: number, n: number, axis: number) => (hash2(i * 16 + n, axis, seed) % 3) - 1;

  // Water beyond the island's shore, and the lake in the middle.
  b.outside(92, Tile.Water, 3);
  b.disc(C, C, 11, Tile.Water, 2.5, 4);

  // Start directions: 45, 105, 165, 225, 285 and 315 + 30 degrees (k is in 15 degree steps).
  const dirs = [0, 1, 2, 3, 4, 5].map((i) => 4 * i + 3);

  dirs.forEach((k, i) => {
    const between = k + 2;
    // A cliff ridge between this start and the next, from the inner ring to the outer ring.
    const mid = b.local(b.polar(between, 42), between, 0, i % 2 ? 2.5 : -2.5);
    b.ridge([b.polar(between, 30), mid, b.polar(between, 55)], 3.2, Tile.Cliff, 1, 10 + i);
    // A rock outcrop and a pond in each sector.
    const [ox, oy] = b.polar(k - 1, 52);
    b.disc(ox, oy, 2.4, Tile.Cliff, 0.8, 20 + i);
    const [px, py] = b.polar(k + 1, 57);
    b.disc(px, py, 4, Tile.Water, 1.2, 30 + i);
  });

  dirs.forEach((k, i) => {
    const s = b.polar(k, 70);
    b.disc(s[0], s[1], 13, Tile.Ground);
    b.start(s[0], s[1]);

    // Nodes near the start, in the start's own frame: a is outward from the center, b across.
    const near = (n: number, a: number, across: number) => b.local(s, k, a + jitter(i, n, 0), across + jitter(i, n, 1));
    const put = (p: [number, number], r: ResourceId, purity: Purity) => b.node(p[0], p[1], r, purity);
    put(near(0, -7, -6), 'iron', 1);
    put(near(1, -7, 6), 'copper', 1);
    put(near(2, 3, -10), 'iron', 0);
    put(near(3, 3, 10), 'copper', 0);
    put(near(4, -14, 0), 'coal', 0);

    // The sector's middle, toward the lake.
    put(b.polar(k - 1, 46), 'coal', 1);
    put(b.polar(k + 1, 44), 'quartz', 1);
    put(b.polar(k, 38), 'sulfur', 1);

    // Shared between neighbors: Pure iron or copper on the lake shore, oil or gold on the outer ring.
    put(b.polar(k + 2, 19), i % 2 ? 'copper' : 'iron', 2);
    put(b.polar(k + 2, 78), i % 2 ? 'gold' : 'oil', 1);
  });

  return b.build('basin', 'Basin');
}

export const MAPS: MapInfo[] = [
  {
    id: 'basin',
    name: 'Basin',
    blurb: 'An island around a lake. Cliff ridges split the land between start locations; the richest nodes are on the lake shore.',
    build: buildBasin,
  },
];

const cache = new Map<string, MapData>();

/** The built map. Built once per id; a map is never changed after it is built. */
export function getMap(id: string): MapData {
  let m = cache.get(id);
  if (!m) {
    const info = MAPS.find((x) => x.id === id);
    if (!info) throw new Error(`Unknown map: ${id}`);
    m = info.build();
    cache.set(id, m);
  }
  return m;
}
