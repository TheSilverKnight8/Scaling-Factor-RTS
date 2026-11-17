import { cos15, sin15 } from '../fmath';
import { hash2 } from '../rng';
import type { Purity, ResourceId } from '../content/resources';
import { NODE_SIZE, Tile, type MapData, type ResourceNode, type TileKind } from './types';

// Tools the map files use to lay out a fixed map. Everything here uses plain arithmetic
// (no Math.sin and the like), so a map comes out tile-for-tile the same in every browser.

export class MapBuilder {
  readonly size: number;
  readonly terrain: Uint8Array;
  readonly nodes: ResourceNode[] = [];
  readonly starts: { x: number; y: number }[] = [];
  private readonly seed: number;

  constructor(size: number, seed: number) {
    this.size = size;
    this.seed = seed;
    this.terrain = new Uint8Array(size * size);
  }

  get center() {
    return this.size / 2;
  }

  /** The point at angle k * 15 degrees and distance r from the map's center. */
  polar(k: number, r: number): [number, number] {
    return [this.center + r * cos15(k), this.center + r * sin15(k)];
  }

  /** The point (a, b) in a frame turned by k * 15 degrees: a along the angle, b across it. */
  local(origin: [number, number], k: number, a: number, b: number): [number, number] {
    const c = cos15(k);
    const s = sin15(k);
    return [origin[0] + a * c - b * s, origin[1] + a * s + b * c];
  }

  /** Smooth noise from about -1 to 1 that changes over `scale` tiles. */
  noise(x: number, y: number, scale: number, salt = 0): number {
    const gx = x / scale;
    const gy = y / scale;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const v = (ix: number, iy: number) => (hash2(ix, iy, this.seed + salt * 7919) & 0xffff) / 32767.5 - 1;
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx;
    const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  }

  set(x: number, y: number, t: TileKind) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.terrain[y * this.size + x] = t;
  }

  /** Paints a rough disc of tiles. The edge wobbles by up to `wobble` tiles. */
  disc(cx: number, cy: number, r: number, t: TileKind, wobble = 0, salt = 1) {
    const R = Math.ceil(r + wobble) + 1;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const edge = r + (wobble ? wobble * this.noise(x, y, 5, salt) : 0);
        if (edge > 0 && dx * dx + dy * dy <= edge * edge) this.set(x, y, t);
      }
    }
  }

  /** Paints tiles within width/2 of a line through the points, with a wobbling edge. */
  ridge(points: [number, number][], width: number, t: TileKind, wobble = 0, salt = 2) {
    for (let i = 0; i + 1 < points.length; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      const pad = Math.ceil(width / 2 + wobble) + 1;
      const minX = Math.floor(Math.min(ax, bx) - pad);
      const maxX = Math.ceil(Math.max(ax, bx) + pad);
      const minY = Math.floor(Math.min(ay, by) - pad);
      const maxY = Math.ceil(Math.max(ay, by) + pad);
      const vx = bx - ax;
      const vy = by - ay;
      const len2 = vx * vx + vy * vy;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5 - ax;
          const py = y + 0.5 - ay;
          let k = len2 > 0 ? (px * vx + py * vy) / len2 : 0;
          if (k < 0) k = 0;
          else if (k > 1) k = 1;
          const dx = px - vx * k;
          const dy = py - vy * k;
          const half = width / 2 + (wobble ? wobble * this.noise(x, y, 4, salt) : 0);
          if (half > 0 && dx * dx + dy * dy <= half * half) this.set(x, y, t);
        }
      }
    }
  }

  /** Everything farther than r (with a wobble) from the center becomes this tile. */
  outside(r: number, t: TileKind, wobble = 0, salt = 3) {
    const c = this.center;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const dx = x + 0.5 - c;
        const dy = y + 0.5 - c;
        const edge = r + (wobble ? wobble * this.noise(x, y, 9, salt) : 0);
        if (dx * dx + dy * dy > edge * edge) this.terrain[y * this.size + x] = t;
      }
    }
  }

  /** A node whose 2 x 2 tiles are centered near (cx, cy). The ground around it is cleared. */
  node(cx: number, cy: number, resource: ResourceId, purity: Purity) {
    const x = Math.round(cx - NODE_SIZE / 2);
    const y = Math.round(cy - NODE_SIZE / 2);
    for (let yy = y - 1; yy <= y + NODE_SIZE; yy++) for (let xx = x - 1; xx <= x + NODE_SIZE; xx++) this.set(xx, yy, Tile.Ground);
    this.nodes.push({ id: this.nodes.length + 1, x, y, resource, purity });
  }

  start(cx: number, cy: number) {
    this.starts.push({ x: Math.round(cx), y: Math.round(cy) });
  }

  build(id: string, name: string): MapData {
    const variant = new Uint8Array(this.size * this.size);
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) variant[y * this.size + x] = hash2(x, y, this.seed ^ 0x5bd1) & 0xff;
    return { id, name, size: this.size, terrain: this.terrain, variant, nodes: this.nodes, starts: this.starts };
  }
}
