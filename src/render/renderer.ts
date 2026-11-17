import { FP } from '../sim/fmath';
import { NODE_SIZE } from '../sim/map/types';
import type { MatchState } from '../sim/state';
import type { Camera } from '../game/camera';
import { HH, HW, isoX, isoY, toTile } from './iso';
import { drawMinuteman, drawNode, drawStructure, drawUnitRing, footprintPath } from './objects';
import * as C from './style';
import { SpriteCache } from './sprites';
import { TerrainCache, drawTiles } from './terrain';
import type { StructureKind } from '../sim/content/structures';

export interface Ghost {
  kind: StructureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  ok: boolean;
}

export interface Marker {
  x: number;
  y: number;
  /** When it was placed, in ms. */
  at: number;
}

export interface RenderView {
  state: MatchState;
  me: number;
  cam: Camera;
  dpr: number;
  /** How far between the last tick and the next one (0 to 1), for smooth movement. */
  alpha: number;
  time: number;
  selectedUnits: Set<number>;
  selectedStructure: number;
  selectedNode: number;
  hoverStructure: number;
  hoverNode: number;
  ghost: Ghost | null;
  /** Box selection in CSS pixels. */
  drag: { x0: number; y0: number; x1: number; y1: number } | null;
  markers: Marker[];
}

type Drawable = { depth: number; draw: (ctx: CanvasRenderingContext2D) => void };

const WALK_FRAMES = 8;
const FIGURE_BOUNDS = { left: -13, top: -34, right: 13, bottom: 6 };
const RING_BOUNDS = { left: -13, top: -7, right: 13, bottom: 7 };

export class Renderer {
  private terrain = new TerrainCache();
  private sprites = new SpriteCache();

  render(ctx: CanvasRenderingContext2D, v: RenderView) {
    const { cam, dpr, state: s } = v;
    const me = s.players.find((p) => p.id === v.me)!;
    const z = cam.zoom;
    const k = z * dpr;
    const W = cam.width * dpr;
    const H = cam.height * dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.BACKDROP;
    ctx.fillRect(0, 0, W, H);

    // Where world (0, 0) lands on the canvas, rounded so cached chunks meet exactly.
    const offX = Math.round(-cam.x * k + W / 2);
    const offY = Math.round(-cam.y * k + H / 2);

    // Tiles in view (the bounding box of the screen in tile coordinates, with a margin).
    const corners = [
      cam.toWorld(0, 0),
      cam.toWorld(cam.width, 0),
      cam.toWorld(0, cam.height + 140),
      cam.toWorld(cam.width, cam.height + 140),
    ].map(([X, Y]) => toTile(X, Y));
    const view = {
      x0: Math.floor(Math.min(...corners.map((c) => c[0]))) - 2,
      y0: Math.floor(Math.min(...corners.map((c) => c[1]))) - 2,
      x1: Math.ceil(Math.max(...corners.map((c) => c[0]))) + 2,
      y1: Math.ceil(Math.max(...corners.map((c) => c[1]))) + 2,
    };

    if (k <= 1) {
      this.terrain.draw(ctx, s.map, me, me.fogVersion, k, cam.zoomIndex * 10 + Math.round(dpr * 4), offX, offY, view);
    } else {
      ctx.setTransform(k, 0, 0, k, offX, offY);
      drawTiles(ctx, s.map, me, view.x0, view.y0, view.x1, view.y1, 1 / k);
    }
    ctx.setTransform(k, 0, 0, k, offX, offY);

    // Build grid and preview.
    if (v.ghost) this.drawGhostGround(ctx, v.ghost, s.size);

    // Selection and hover outlines on the ground.
    const outline = (x: number, y: number, w: number, h: number, color: string, width: number) => {
      footprintPath(ctx, x, y, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    for (const t of s.structures) {
      if (t.id === v.selectedStructure) outline(t.x, t.y, t.w, t.h, C.RED, 2.5);
      else if (t.id === v.hoverStructure) outline(t.x, t.y, t.w, t.h, 'rgba(0,38,87,0.6)', 2);
    }
    for (const n of s.map.nodes) {
      if (n.id === v.selectedNode) outline(n.x, n.y, NODE_SIZE, NODE_SIZE, C.RED, 2.5);
      else if (n.id === v.hoverNode) outline(n.x, n.y, NODE_SIZE, NODE_SIZE, 'rgba(0,38,87,0.6)', 2);
    }

    // Everything standing up, back to front.
    const items: Drawable[] = [];
    const explored = me.explored;
    const size = s.size;
    const inView = (x: number, y: number, pad: number) => x >= view.x0 - pad && x <= view.x1 + pad && y >= view.y0 - pad && y <= view.y1 + pad;
    for (const n of s.map.nodes) {
      if (!inView(n.x, n.y, 2)) continue;
      if (!explored[n.y * size + n.x] && !explored[(n.y + 1) * size + n.x + 1]) continue;
      if (s.occupied[n.y * size + n.x]) continue; // a Drill or Pump covers it
      items.push({ depth: n.x + n.y + 2, draw: (c) => drawNode(c, n, v.time) });
    }
    for (const t of s.structures) {
      if (!inView(t.x, t.y, 6)) continue;
      const owner = s.players.find((p) => p.id === t.owner);
      const col = C.PLAYER_COLORS[owner?.color ?? 0];
      items.push({
        depth: t.x + t.y + (t.w + t.h) / 2,
        draw: (c) => drawStructure(c, { kind: t.kind, x: t.x, y: t.y, w: t.w, h: t.h, rot: t.rot, color: col.main, dark: col.dark }, v.time),
      });
    }
    const colorOf = new Map(s.players.map((p) => [p.id, p.color]));
    for (const u of s.units) {
      const ux = (u.px + (u.x - u.px) * v.alpha) / FP;
      const uy = (u.py + (u.y - u.py) * v.alpha) / FP;
      if (!inView(ux, uy, 2)) continue;
      const colorIndex = colorOf.get(u.owner) ?? 0;
      const col = C.PLAYER_COLORS[colorIndex];
      // Device pixel of the unit's feet.
      const dx = Math.round(isoX(ux, uy) * k + offX);
      const dy = Math.round(isoY(ux, uy) * k + offY);
      const facing = u.dirX - u.dirY < 0 ? -1 : 1;
      const moving = u.pathStep < u.path.length;
      // One of 8 stride pictures while walking, or standing still.
      const frame = moving ? Math.floor((((ux + uy) * 3.4) / (Math.PI * 2)) * WALK_FRAMES) % WALK_FRAMES : -1;
      const selected = v.selectedUnits.has(u.id);
      items.push({
        depth: ux + uy,
        draw: (c) => {
          c.setTransform(1, 0, 0, 1, 0, 0);
          if (selected) {
            const ring = this.sprites.get('ring', k, RING_BOUNDS, (r) => drawUnitRing(r, 0, 0));
            c.drawImage(ring.canvas, dx - ring.ax, dy - ring.ay);
          }
          const key = `${u.kind}:${colorIndex}:${facing}:${frame}`;
          const sp = this.sprites.get(key, k, FIGURE_BOUNDS, (f) =>
            drawMinuteman(f, 0, 0, col.main, col.dark, facing, ((frame + 0.5) / WALK_FRAMES) * Math.PI * 2, frame >= 0),
          );
          c.drawImage(sp.canvas, dx - sp.ax, dy - sp.ay);
          c.setTransform(k, 0, 0, k, offX, offY);
        },
      });
    }
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw(ctx);

    if (v.ghost) {
      const col = C.PLAYER_COLORS[me.color];
      ctx.globalAlpha = v.ghost.ok ? 0.7 : 0.45;
      drawStructure(ctx, { ...v.ghost, color: col.main, dark: col.dark }, v.time);
      ctx.globalAlpha = 1;
    }

    // Move markers: a red diamond that shrinks away.
    for (const m of v.markers) {
      const age = (v.time - m.at) / 600;
      if (age >= 1) continue;
      const X = isoX(m.x + 0.5, m.y + 0.5);
      const Y = isoY(m.x + 0.5, m.y + 0.5);
      const r = 1 - age * 0.6;
      ctx.strokeStyle = C.RED;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 1 - age;
      ctx.beginPath();
      ctx.moveTo(X, Y - HH * r);
      ctx.lineTo(X + HW * r, Y);
      ctx.lineTo(X, Y + HH * r);
      ctx.lineTo(X - HW * r, Y);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Box selection, in screen space.
    if (v.drag) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const x = Math.min(v.drag.x0, v.drag.x1);
      const y = Math.min(v.drag.y0, v.drag.y1);
      const w = Math.abs(v.drag.x1 - v.drag.x0);
      const h = Math.abs(v.drag.y1 - v.drag.y0);
      ctx.fillStyle = 'rgba(252, 63, 63, 0.1)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = C.RED;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    }
  }

  private drawGhostGround(ctx: CanvasRenderingContext2D, g: Ghost, size: number) {
    // The grid around the cursor (SPEC: structures are placed on a grid).
    const R = 9;
    const cx = g.x + Math.floor(g.w / 2);
    const cy = g.y + Math.floor(g.h / 2);
    ctx.strokeStyle = 'rgba(0, 38, 87, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -R; i <= R + 1; i++) {
      const gx = cx + i;
      const gy = cy + i;
      if (gx >= 0 && gx <= size) {
        ctx.moveTo(isoX(gx, Math.max(0, cy - R)), isoY(gx, Math.max(0, cy - R)));
        ctx.lineTo(isoX(gx, Math.min(size, cy + R + 1)), isoY(gx, Math.min(size, cy + R + 1)));
      }
      if (gy >= 0 && gy <= size) {
        ctx.moveTo(isoX(Math.max(0, cx - R), gy), isoY(Math.max(0, cx - R), gy));
        ctx.lineTo(isoX(Math.min(size, cx + R + 1), gy), isoY(Math.min(size, cx + R + 1), gy));
      }
    }
    ctx.stroke();
    footprintPath(ctx, g.x, g.y, g.w, g.h);
    ctx.fillStyle = g.ok ? 'rgba(0, 38, 87, 0.22)' : 'rgba(252, 63, 63, 0.4)';
    ctx.fill();
    ctx.strokeStyle = g.ok ? C.NAVY : C.RED;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
