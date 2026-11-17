import { FP } from '../sim/fmath';
import { NODE_SIZE, Tile } from '../sim/map/types';
import type { MatchState, Player } from '../sim/state';
import type { Camera } from '../game/camera';
import { HH, HW } from './iso';
import * as C from './style';

// The minimap (Caleb after Stage 1): the whole map in the same isometric orientation as the
// main view, so up on the minimap is up on the screen. Explored ground, water and cliffs; nodes,
// structures and units in their colors; a box for what the main view shows. Explored areas show
// everything (Caleb).

const rgb = (h: string) => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const;
};
const TERRAIN_RGB = {
  [Tile.Ground]: rgb(C.GROUND),
  [Tile.Water]: rgb(C.WATER),
  [Tile.Cliff]: rgb(C.CLIFF_TOP),
} as Record<number, readonly [number, number, number]>;
const FOG_RGB = rgb(C.FOG);

export class MinimapRenderer {
  private base: HTMLCanvasElement | null = null;
  private baseVersion = -1;

  /** The tile-by-tile picture of explored terrain and nodes, remade when the fog changes. */
  private baseFor(s: MatchState, me: Player) {
    let version = 0;
    for (let i = 0; i < me.fogVersion.length; i++) version += me.fogVersion[i];
    if (this.base && version === this.baseVersion) return this.base;
    const size = s.size;
    const canvas = this.base ?? document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < size * size; i++) {
      const c = me.explored[i] ? TERRAIN_RGB[s.map.terrain[i]] : FOG_RGB;
      d[i * 4] = c[0];
      d[i * 4 + 1] = c[1];
      d[i * 4 + 2] = c[2];
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (const n of s.map.nodes) {
      if (!me.explored[n.y * size + n.x]) continue;
      ctx.fillStyle = C.RESOURCE_COLORS[n.resource][1];
      ctx.fillRect(n.x, n.y, NODE_SIZE, NODE_SIZE);
    }
    this.base = canvas;
    this.baseVersion = version;
    return canvas;
  }

  /** Draws the minimap filling a canvas W x H device pixels (a 2:1 diamond fits exactly). */
  draw(ctx: CanvasRenderingContext2D, s: MatchState, meId: number, cam: Camera, W: number, H: number) {
    const me = s.players.find((p) => p.id === meId)!;
    const size = s.size;
    const sx = W / (2 * size);
    const sy = H / (2 * size);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Tile (x, y) lands at ((x - y) * sx + W / 2, (x + y) * sy): the main view's projection, scaled.
    ctx.setTransform(sx, sy, -sx, sy, W / 2, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.baseFor(s, me), 0, 0);
    // The map's edge.
    ctx.strokeStyle = C.NAVY;
    ctx.lineWidth = 1.5 / sx;
    ctx.strokeRect(0, 0, size, size);

    const colorOf = new Map(s.players.map((p) => [p.id, C.PLAYER_COLORS[p.color]]));
    for (const t of s.structures) {
      if (!me.explored[t.y * size + t.x]) continue;
      ctx.fillStyle = colorOf.get(t.owner)?.main ?? C.CREAM;
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.strokeStyle = C.CREAM;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(t.x, t.y, t.w, t.h);
    }
    // A unit is a small diamond about 3 device pixels across, whatever the minimap's size.
    const dot = Math.max(1, 2.4 / (sx + sy));
    for (const u of s.units) {
      const x = u.x / FP;
      const y = u.y / FP;
      if (!me.explored[Math.floor(y) * size + Math.floor(x)]) continue;
      ctx.fillStyle = colorOf.get(u.owner)?.main ?? C.CREAM;
      ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
    }

    // What the main view shows: a rectangle, since both use the same projection.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const [ax, ay] = cam.toWorld(0, 0);
    const [bx, by] = cam.toWorld(cam.width, cam.height);
    const mx = (X: number) => (X / HW) * sx + W / 2;
    const my = (Y: number) => (Y / HH) * sy;
    const lw = Math.max(1.5, W / 200);
    for (const [color, width] of [
      [C.NAVY, lw * 2.6],
      ['#ffffff', lw],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.strokeRect(mx(ax), my(ay), mx(bx) - mx(ax), my(by) - my(ay));
    }
  }

  /** The world point (main view coordinates) under minimap pixel (px, py) of a W x H minimap. */
  static toWorld(px: number, py: number, W: number, H: number, size: number): [number, number] {
    const sx = W / (2 * size);
    const sy = H / (2 * size);
    return [((px - W / 2) / sx) * HW, (py / sy) * HH];
  }
}
