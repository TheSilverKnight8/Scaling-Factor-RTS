import { hash2 } from '../sim/rng';
import { Tile, type MapData } from '../sim/map/types';
import { CHUNK, CLIFF_H, HH, HW, isoX, isoY } from './iso';
import * as C from './style';

// Drawing the ground: grass, water, cliffs, fog and the map's edge. Far out, the map is
// drawn in 16 x 16 tile chunks that are kept as pictures and redrawn only when their fog
// changes; close in, the few tiles on screen are drawn directly each frame.

type Ctx = CanvasRenderingContext2D;

function diamond(ctx: Ctx, x: number, y: number) {
  const X = isoX(x, y);
  const Y = isoY(x, y);
  ctx.beginPath();
  ctx.moveTo(X, Y);
  ctx.lineTo(X + HW, Y + HH);
  ctx.lineTo(X, Y + 2 * HH);
  ctx.lineTo(X - HW, Y + HH);
  ctx.closePath();
}

/** Smooth patches (drawing only, so ordinary floating point is fine). 0 to 1. */
function patch(x: number, y: number, scale = 7, seed = 991) {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const v = (a: number, b: number) => (hash2(a, b, seed) & 0xffff) / 65535;
  const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * tx;
  const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * tx;
  return a + (b - a) * ty;
}

/** Tiny specks scattered over a tile, the same every time for a given tile: the grit. */
function grit(ctx: Ctx, x: number, y: number, count: number, salt: number) {
  let h = hash2(x, y, salt);
  for (let i = 0; i < count; i++) {
    const u = 0.12 + ((h & 0xff) / 255) * 0.76;
    const v = 0.12 + (((h >>> 8) & 0xff) / 255) * 0.76;
    const size = 1.2 + ((h >>> 16) & 3) * 0.45;
    ctx.fillStyle = (h >>> 18) & 1 ? C.GRIT_DARK : C.GRIT_LIGHT;
    ctx.fillRect(isoX(x + u, y + v) - size / 2, isoY(x + u, y + v) - size / 2, size, size * 0.7);
    h = hash2(h, i, salt + 1);
  }
}

export interface FogView {
  explored: Uint8Array;
}

const isSolid = (m: MapData, x: number, y: number) => x < 0 || y < 0 || x >= m.size || y >= m.size || m.terrain[y * m.size + x] !== Tile.Water;
const isCliff = (m: MapData, x: number, y: number) => x >= 0 && y >= 0 && x < m.size && y < m.size && m.terrain[y * m.size + x] === Tile.Cliff;

/**
 * Draws tiles x0..x1, y0..y1 (inclusive) in back-to-front order, so raised cliffs overlap the
 * tiles behind them. `px` is one device pixel in world pixels (for seam-free fog).
 */
export function drawTiles(ctx: Ctx, m: MapData, fog: FogView, x0: number, y0: number, x1: number, y1: number, px: number) {
  const size = m.size;
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(size - 1, x1);
  y1 = Math.min(size - 1, y1);
  if (x1 < x0 || y1 < y0) return;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // The ground color under the whole area first, so tiles of the same color meet without seams.
  ctx.fillStyle = C.GROUND;
  ctx.beginPath();
  ctx.moveTo(isoX(x0, y0), isoY(x0, y0));
  ctx.lineTo(isoX(x1 + 1, y0), isoY(x1 + 1, y0));
  ctx.lineTo(isoX(x1 + 1, y1 + 1), isoY(x1 + 1, y1 + 1));
  ctx.lineTo(isoX(x0, y1 + 1), isoY(x0, y1 + 1));
  ctx.closePath();
  ctx.fill();

  const explored = fog.explored;
  for (let d = x0 + y0; d <= x1 + y1; d++) {
    const xs = Math.max(x0, d - y1);
    const xe = Math.min(x1, d - y0);
    for (let x = xs; x <= xe; x++) {
      const y = d - x;
      const i = y * size + x;
      if (!explored[i]) {
        drawFog(ctx, x, y, m.variant[i], px);
        continue;
      }
      const t = m.terrain[i];
      if (t === Tile.Water) drawWater(ctx, m, x, y);
      else if (t === Tile.Cliff) drawCliff(ctx, m, x, y);
      else drawGround(ctx, m, x, y);
      // A light navy wash where explored land meets the fog.
      if (nextToFog(explored, size, x, y)) {
        diamond(ctx, x, y);
        ctx.fillStyle = C.FOG_EDGE;
        ctx.fill();
      }
    }
  }

  // The map's outer edge: a navy slab under the two front sides.
  if (x1 === size - 1 || y1 === size - 1) {
    ctx.fillStyle = C.EDGE;
    if (x1 === size - 1) {
      const X0 = isoX(size, y0);
      const Y0 = isoY(size, y0);
      const X1 = isoX(size, y1 + 1);
      const Y1 = isoY(size, y1 + 1);
      ctx.beginPath();
      ctx.moveTo(X0, Y0 - px);
      ctx.lineTo(X1, Y1 - px);
      ctx.lineTo(X1, Y1 + C.EDGE_DEPTH);
      ctx.lineTo(X0, Y0 + C.EDGE_DEPTH);
      ctx.closePath();
      ctx.fill();
    }
    if (y1 === size - 1) {
      const X0 = isoX(x0, size);
      const Y0 = isoY(x0, size);
      const X1 = isoX(x1 + 1, size);
      const Y1 = isoY(x1 + 1, size);
      ctx.beginPath();
      ctx.moveTo(X0, Y0 - px);
      ctx.lineTo(X1, Y1 - px);
      ctx.lineTo(X1, Y1 + C.EDGE_DEPTH);
      ctx.lineTo(X0, Y0 + C.EDGE_DEPTH);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function nextToFog(explored: Uint8Array, size: number, x: number, y: number) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (!explored[ny * size + nx]) return true;
    }
  return false;
}

function drawFog(ctx: Ctx, x: number, y: number, v: number, px: number) {
  diamond(ctx, x, y);
  const c = v & 1 ? C.FOG : C.FOG_ALT;
  ctx.fillStyle = c;
  ctx.fill();
  // A stroke in the same color covers the hairline gaps between neighboring diamonds.
  ctx.strokeStyle = c;
  ctx.lineWidth = px * 1.5;
  ctx.stroke();
}

function drawGround(ctx: Ctx, m: MapData, x: number, y: number) {
  // Bare dirt in some places, darker and lighter grass in others.
  const dirt = patch(x, y, 9, 5113);
  const p = patch(x, y);
  let fill: string | null = null;
  if (dirt > 0.8) fill = dirt > 0.88 ? C.DIRT_DARK : C.DIRT;
  else if (p < 0.3) fill = C.GROUND_DARK;
  else if (p > 0.72) fill = C.GROUND_LIGHT;
  if (fill) {
    diamond(ctx, x, y);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  grit(ctx, x, y, 5, 77);
  const v = m.variant[y * m.size + x];
  const X = isoX(x + 0.5, y + 0.5);
  const Y = isoY(x + 0.5, y + 0.5);
  if (v < 22 && dirt <= 0.8) {
    // A grass tuft.
    const ox = ((v * 7) % 17) - 8;
    const oy = ((v * 5) % 9) - 4;
    ctx.strokeStyle = C.GRASS_MARK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(X + ox - 4, Y + oy - 3);
    ctx.lineTo(X + ox - 2, Y + oy + 1);
    ctx.lineTo(X + ox, Y + oy - 4);
    ctx.lineTo(X + ox + 2, Y + oy + 1);
    ctx.lineTo(X + ox + 4, Y + oy - 3);
    ctx.stroke();
  } else if (v < 32) {
    // A pebble.
    const ox = ((v * 11) % 21) - 10;
    const oy = ((v * 3) % 9) - 4;
    ctx.fillStyle = C.PEBBLE;
    ctx.strokeStyle = C.NAVY;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(X + ox, Y + oy, 3.2, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (v < 44) {
    // A small crack in the ground.
    const o = (v % 7) - 3;
    ctx.strokeStyle = C.CRACK;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(X - 9 + o, Y + 2);
    ctx.lineTo(X - 3 + o, Y - 1);
    ctx.lineTo(X + 1 + o, Y + 3);
    ctx.lineTo(X + 8 + o, Y);
    ctx.stroke();
  }
}

function drawWater(ctx: Ctx, m: MapData, x: number, y: number) {
  const deep = !isSolid(m, x + 1, y) && !isSolid(m, x - 1, y) && !isSolid(m, x, y + 1) && !isSolid(m, x, y - 1) && !isSolid(m, x + 2, y) && !isSolid(m, x, y + 2) && !isSolid(m, x - 2, y) && !isSolid(m, x, y - 2);
  diamond(ctx, x, y);
  ctx.fillStyle = deep ? C.WATER_DEEP : C.WATER;
  ctx.fill();
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Light shallows along each side that meets land.
  const sides: [number, number, [number, number], [number, number]][] = [
    [0, -1, [x, y], [x + 1, y]], // back right
    [-1, 0, [x, y + 1], [x, y]], // back left
    [1, 0, [x + 1, y], [x + 1, y + 1]], // front right
    [0, 1, [x + 1, y + 1], [x, y + 1]], // front left
  ];
  const k = 0.22;
  for (const [dx, dy, a, b] of sides) {
    if (!isSolid(m, x + dx, y + dy)) continue;
    // A strip inside the tile along edge a-b.
    const ix = -dx * k;
    const iy = -dy * k;
    ctx.beginPath();
    ctx.moveTo(isoX(a[0], a[1]), isoY(a[0], a[1]));
    ctx.lineTo(isoX(b[0], b[1]), isoY(b[0], b[1]));
    ctx.lineTo(isoX(b[0] + ix, b[1] + iy), isoY(b[0] + ix, b[1] + iy));
    ctx.lineTo(isoX(a[0] + ix, a[1] + iy), isoY(a[0] + ix, a[1] + iy));
    ctx.closePath();
    ctx.fillStyle = C.WATER_SHORE;
    ctx.fill();
    // The shoreline itself.
    ctx.strokeStyle = C.NAVY;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(isoX(a[0], a[1]), isoY(a[0], a[1]));
    ctx.lineTo(isoX(b[0], b[1]), isoY(b[0], b[1]));
    ctx.stroke();
  }

  const v = m.variant[y * m.size + x];
  if (v < 18) {
    const X = isoX(x + 0.5, y + 0.5) + ((v * 7) % 13) - 6;
    const Y = isoY(x + 0.5, y + 0.5) + ((v * 3) % 7) - 3;
    ctx.strokeStyle = C.WAVE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X - 6, Y);
    ctx.quadraticCurveTo(X - 3, Y - 3, X, Y);
    ctx.quadraticCurveTo(X + 3, Y + 3, X + 6, Y);
    ctx.stroke();
  }
}

function drawCliff(ctx: Ctx, m: MapData, x: number, y: number) {
  const H = CLIFF_H;
  const P = (tx: number, ty: number, z: number): [number, number] => [isoX(tx, ty), isoY(tx, ty) - z];
  const poly = (pts: [number, number][], fill: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  ctx.strokeStyle = C.NAVY;
  ctx.lineWidth = 1.4;
  // Front-left face (toward +y) and front-right face (toward +x), where no cliff stands in front.
  const frontLeft = !isCliff(m, x, y + 1);
  const frontRight = !isCliff(m, x + 1, y);
  if (frontLeft) {
    poly([P(x, y + 1, H), P(x + 1, y + 1, H), P(x + 1, y + 1, 0), P(x, y + 1, 0)], C.CLIFF_LEFT);
    ctx.stroke();
  }
  if (frontRight) {
    poly([P(x + 1, y, H), P(x + 1, y + 1, H), P(x + 1, y + 1, 0), P(x + 1, y, 0)], C.CLIFF_RIGHT);
    ctx.stroke();
  }
  poly([P(x, y, H), P(x + 1, y, H), P(x + 1, y + 1, H), P(x, y + 1, H)], C.CLIFF_TOP);
  ctx.strokeStyle = C.CLIFF_TOP;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Outline the top only where it meets something that is not cliff.
  ctx.strokeStyle = C.NAVY;
  ctx.lineWidth = 1.4;
  const edge = (a: [number, number], b: [number, number]) => {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  if (!isCliff(m, x, y - 1)) edge(P(x, y, H), P(x + 1, y, H));
  if (!isCliff(m, x - 1, y)) edge(P(x, y, H), P(x, y + 1, H));
  if (frontRight) edge(P(x + 1, y, H), P(x + 1, y + 1, H));
  if (frontLeft) edge(P(x, y + 1, H), P(x + 1, y + 1, H));
  // Grit and a few cracks so rock reads as rock.
  ctx.save();
  ctx.translate(0, -H);
  grit(ctx, x, y, 6, 313);
  ctx.restore();
  const v = m.variant[y * m.size + x];
  if (v < 90) {
    const [cx, cy] = P(x + 0.5, y + 0.5, H);
    ctx.strokeStyle = C.CLIFF_RIGHT;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const o = (v % 9) - 4;
    ctx.moveTo(cx - 8 + o, cy - 1);
    ctx.lineTo(cx - 2 + o, cy + 2);
    ctx.lineTo(cx + 5 + o, cy - 2);
    ctx.stroke();
  }
}

/** One cached chunk picture. */
interface ChunkPic {
  canvas: HTMLCanvasElement;
  /** Device pixel of the picture's left/top edge, relative to world (0, 0), at the picture's scale. */
  ox: number;
  oy: number;
  scale: number;
  version: number;
  bytes: number;
}

const PAD = 4;
const EXTRA_BOTTOM = 26;

/**
 * The scales chunk pictures are made at while the zoom is changing (device pixels per world
 * pixel): the nearest one at or above the current scale, shrunk to fit, so smooth zooming reuses
 * pictures instead of making new ones every frame. Once the zoom has settled, pictures are remade
 * at the exact scale, because drawing a picture shrunk is slow where the browser draws without a
 * graphics card. Above the largest scale, tiles are drawn directly.
 */
export const CACHE_SCALES = [0.25, 0.3536, 0.5, 0.7071, 1, 1.4142];
export const MAX_CACHE_SCALE = CACHE_SCALES[CACHE_SCALES.length - 1];

function cacheScale(k: number) {
  for (const s of CACHE_SCALES) if (s >= k - 1e-6) return s;
  return MAX_CACHE_SCALE;
}

/**
 * Far-out terrain drawing: one picture per 16 x 16 tile chunk. Each picture also draws the ring
 * of tiles around its chunk, under its neighbors' pictures, so chunks meet without seams at any
 * zoom. Pictures are kept least recently used first, up to about 200 MB.
 */
export class TerrainCache {
  private pics = new Map<string, ChunkPic>();
  /** The newest picture of each chunk at any scale, shown while the right one is being made. */
  private latest = new Map<number, ChunkPic>();
  private bytes = 0;
  private readonly budget = 200 * 1024 * 1024;

  clear() {
    this.pics.clear();
    this.latest.clear();
    this.bytes = 0;
  }

  /**
   * Draws the chunks in view at scale `k` (device pixels per world pixel); `offX/offY` place
   * world (0, 0) on the canvas. `settled` is false while the zoom is changing. Pictures are made
   * for up to `budgetMs` per frame; until a chunk's picture is ready, its newest picture at
   * another scale stands in.
   */
  draw(ctx: Ctx, m: MapData, fog: FogView, fogVersion: Uint32Array, k: number, settled: boolean, offX: number, offY: number, view: { x0: number; y0: number; x1: number; y1: number }, budgetMs = 6) {
    const start = performance.now();
    const busy = () => performance.now() - start > budgetMs;
    const L = settled ? Math.round(k * 1000) / 1000 : cacheScale(k);
    const per = Math.ceil(m.size / CHUNK);
    const cx0 = Math.max(0, Math.floor(view.x0 / CHUNK));
    const cy0 = Math.max(0, Math.floor(view.y0 / CHUNK));
    const cx1 = Math.min(per - 1, Math.floor(view.x1 / CHUNK));
    const cy1 = Math.min(per - 1, Math.floor(view.y1 / CHUNK));
    for (let d = cx0 + cy0; d <= cx1 + cy1; d++) {
      for (let cx = Math.max(cx0, d - cy1); cx <= Math.min(cx1, d - cy0); cx++) {
        const cy = d - cx;
        // The chunk's own fog and its neighbors' (its ring of tiles and the fog-edge wash look across).
        let version = 0;
        for (let ny = Math.max(0, cy - 1); ny <= Math.min(per - 1, cy + 1); ny++)
          for (let nx = Math.max(0, cx - 1); nx <= Math.min(per - 1, cx + 1); nx++) version += fogVersion[ny * per + nx];
        const key = `${L}:${cx}:${cy}`;
        let pic = this.pics.get(key);
        if (!pic || pic.version !== version) {
          if (!busy()) {
            if (pic) this.bytes -= pic.bytes;
            pic = this.make(m, fog, cx, cy, L, version);
            this.bytes += pic.bytes;
            this.latest.set(cy * per + cx, pic);
          } else if (!pic) {
            pic = this.latest.get(cy * per + cx);
          }
        }
        if (!pic) continue;
        // Mark as recently used.
        this.pics.delete(`${pic.scale}:${cx}:${cy}`);
        this.pics.set(`${pic.scale}:${cx}:${cy}`, pic);
        const r = k / pic.scale;
        ctx.drawImage(pic.canvas, pic.ox * r + offX, pic.oy * r + offY, pic.canvas.width * r, pic.canvas.height * r);
      }
    }
    // Drop the least recently used pictures past the budget.
    for (const [key, pic] of this.pics) {
      if (this.bytes <= this.budget) break;
      this.pics.delete(key);
      this.bytes -= pic.bytes;
    }
  }

  private make(m: MapData, fog: FogView, cx: number, cy: number, scale: number, version: number): ChunkPic {
    const x0 = cx * CHUNK - 1;
    const y0 = cy * CHUNK - 1;
    const n = CHUNK + 2;
    const left = isoX(x0, y0 + n) - PAD;
    const top = isoY(x0, y0) - CLIFF_H - PAD;
    const width = n * 2 * HW + 2 * PAD;
    const height = n * 2 * HH + CLIFF_H + EXTRA_BOTTOM + 2 * PAD;
    const ox = Math.floor(left * scale);
    const oy = Math.floor(top * scale);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale) + 2;
    canvas.height = Math.ceil(height * scale) + 2;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(scale, 0, 0, scale, -ox, -oy);
    drawTiles(ctx, m, fog, x0, y0, x0 + n - 1, y0 + n - 1, 1 / scale);
    return { canvas, ox, oy, scale, version, bytes: canvas.width * canvas.height * 4 };
  }
}
