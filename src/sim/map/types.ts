import type { Purity, ResourceId } from '../content/resources';

/** What a tile is. Water and cliffs block placement and every ground unit (SPEC "Map"). */
export const Tile = { Ground: 0, Water: 1, Cliff: 2 } as const;
export type TileKind = (typeof Tile)[keyof typeof Tile];

/** A resource node. It takes 2 x 2 tiles, with (x, y) its top-left tile. Nodes never run out. */
export interface ResourceNode {
  id: number;
  x: number;
  y: number;
  resource: ResourceId;
  purity: Purity;
}

export const NODE_SIZE = 2;

/** A built map. The same map id always builds the same map, on every computer. */
export interface MapData {
  id: string;
  name: string;
  size: number;
  /** One Tile value per tile, row by row (index = y * size + x). */
  terrain: Uint8Array;
  /** A small number per tile that only picks how the tile is drawn (grass shade, pebbles). */
  variant: Uint8Array;
  nodes: ResourceNode[];
  /** Hub start locations: the center tile of each Hub. */
  starts: { x: number; y: number }[];
}
