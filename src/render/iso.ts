// Isometric projection (SPEC "Platform and look": isometric, like StarCraft).
//
// "World pixels" are the drawing's own coordinates at zoom 1: a tile is a diamond 64 wide
// and 32 tall. The point (x, y) in tiles (fractions allowed) is at
//   X = (x - y) * 32,   Y = (x + y) * 16
// so tile (x, y)'s top corner is at (x, y) and its center at (x + 0.5, y + 0.5).
// Things standing up are lifted by z world pixels: Y - z.

export const TW = 64;
export const TH = 32;
export const HW = TW / 2;
export const HH = TH / 2;

/** How high cliffs stand, in world pixels. */
export const CLIFF_H = 12;

/** Tiles per side of a terrain chunk (one cached picture). Same as the fog chunk. */
export const CHUNK = 16;

export const isoX = (x: number, y: number) => (x - y) * HW;
export const isoY = (x: number, y: number) => (x + y) * HH;

/** World pixels back to tile coordinates (on the ground). */
export function toTile(X: number, Y: number): [number, number] {
  const a = X / HW;
  const b = Y / HH;
  return [(a + b) / 2, (b - a) / 2];
}

/**
 * Zoom levels, in screen pixels per world pixel. The on-screen buttons step through them. The
 * farthest shows the whole map on a computer screen (there is no minimap in the spec).
 */
export const ZOOMS = [0.12, 0.17, 0.25, 0.35, 0.5, 0.7, 1, 1.4, 2];
export const DEFAULT_ZOOM = 6;
