import { DX, DY, portsOf, type Port, type StructureKind } from '../sim/content/structures';
import type { TransportKind } from '../sim/content/transport';
import { FP } from '../sim/fmath';
import { NODE_SIZE } from '../sim/map/types';
import { cache, type Belt, type MatchState } from '../sim/state';
import type { Camera } from '../game/camera';
import { HH, HW, isoX, isoY, toTile } from './iso';
import { POLE_TOP, STRUCTURE_HEIGHT, drawHealthBar, drawMinuteman, drawNode, drawStructure, drawUnitRing, footprintPath, type Pt } from './objects';
import { STRUCTURES } from '../sim/content/structures';
import { UNITS } from '../sim/content/units';
import { PULSE_REACH } from '../sim/constants';
import { SpriteCache } from './sprites';
import * as C from './style';
import { MAX_CACHE_SCALE, TerrainCache, drawTiles } from './terrain';
import { ITEM_BOUNDS, beltItemSpot, drawBelt, drawItemIcon, drawPortArrow, drawPowerLine, drawSplitterMerger, drawStatusBadge, lineAnchor } from './transport';

export interface Ghost {
  kind: StructureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  ok: boolean;
}

export interface BeltGhost {
  kind: TransportKind;
  tiles: { x: number; y: number; dir: number; ok: boolean }[];
}

export interface Marker {
  x: number;
  y: number;
  /** When it was placed, in ms. */
  at: number;
  /** A move order (diamond) or an attack order (red ring around the target). */
  kind?: 'move' | 'attack';
}

/** Short-lived drawings for things that happened: a unit dying, a structure destroyed, a Hub's pulse. */
export interface Effect {
  kind: 'death' | 'destroyed' | 'pulse';
  /** Tiles (fractions allowed): the spot, or a footprint's corner and size. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** For a pulse: the Hub. */
  hub?: number;
  /** When it happened, in ms. */
  at: number;
}

export interface RenderView {
  state: MatchState;
  me: number;
  cam: Camera;
  dpr: number;
  /** How far between the last tick and the next one (0 to 1), for smooth movement. */
  alpha: number;
  /** False while the zoom is changing (pictures are stretched instead of remade). */
  zoomSettled: boolean;
  time: number;
  selectedUnits: Set<number>;
  selectedStructure: number;
  selectedNode: number;
  selectedBelt: number;
  hoverStructure: number;
  hoverNode: number;
  ghost: Ghost | null;
  beltGhost: BeltGhost | null;
  /** A power line being drawn: from a structure to the pointer or to another structure. */
  lineGhost: { a: Pt; b: Pt; ok: boolean } | null;
  /** Show item ports (while building). */
  showPorts: boolean;
  effects: Effect[];
  /** The selected structure's rally point and patrol points (tile indices), drawn as flags. */
  rally: { from: number; tile: number; patrol: number[] } | null;
  /** Where units placed by hand are going (tile indices). */
  placed: number[];
  /** A patrol route being set (tile indices). */
  patrolDraft: number[] | null;
  /** Box selection in CSS pixels. */
  drag: { x0: number; y0: number; x1: number; y1: number } | null;
  markers: Marker[];
}

type Drawable = { depth: number; draw: (ctx: CanvasRenderingContext2D) => void };

const WALK_FRAMES = 8;
const BELT_FRAMES = 8;
const BELT_BOUNDS = { left: -36, top: -20, right: 36, bottom: 20 };
const FIGURE_BOUNDS = { left: -13, top: -34, right: 13, bottom: 6 };
const RING_BOUNDS = { left: -13, top: -7, right: 13, bottom: 7 };

/** The side a belt is fed from when another belt points into it from the side (an elbow), or null. */
export function beltFeed(s: MatchState, b: { x: number; y: number; dir: number }): number | null {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= s.size || y >= s.size ? 0 : s.beltAt[y * s.size + x]);
  const c = cache(s);
  const behind = at(b.x - DX[b.dir], b.y - DY[b.dir]);
  if (behind && c.beltById.get(behind)?.dir === b.dir) return null;
  const sid = (() => {
    const x = b.x - DX[b.dir];
    const y = b.y - DY[b.dir];
    return x < 0 || y < 0 || x >= s.size || y >= s.size ? 0 : s.occupied[y * s.size + x];
  })();
  if (sid) return null;
  for (const m of [(b.dir + 1) % 4, (b.dir + 3) % 4]) {
    const id = at(b.x - DX[m], b.y - DY[m]);
    if (id && c.beltById.get(id)?.dir === m) return m;
  }
  return null;
}

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
    const c = cache(s);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.BACKDROP;
    ctx.fillRect(0, 0, W, H);

    // Where world (0, 0) lands on the canvas, rounded so cached chunks meet exactly.
    const offX = Math.round(-cam.x * k + W / 2);
    const offY = Math.round(-cam.y * k + H / 2);

    // Tiles in view (the bounding box of the screen in tile coordinates, with a margin).
    const corners = [cam.toWorld(0, 0), cam.toWorld(cam.width, 0), cam.toWorld(0, cam.height + 140), cam.toWorld(cam.width, cam.height + 140)].map(([X, Y]) => toTile(X, Y));
    const view = {
      x0: Math.floor(Math.min(...corners.map((q) => q[0]))) - 2,
      y0: Math.floor(Math.min(...corners.map((q) => q[1]))) - 2,
      x1: Math.ceil(Math.max(...corners.map((q) => q[0]))) + 2,
      y1: Math.ceil(Math.max(...corners.map((q) => q[1]))) + 2,
    };
    const inView = (x: number, y: number, pad: number) => x >= view.x0 - pad && x <= view.x1 + pad && y >= view.y0 - pad && y <= view.y1 + pad;
    const explored = me.explored;
    const size = s.size;
    const seen = (x: number, y: number) => explored[y * size + x] === 1;

    if (k <= MAX_CACHE_SCALE) {
      this.terrain.draw(ctx, s.map, me, me.fogVersion, k, v.zoomSettled, offX, offY, view);
    } else {
      ctx.setTransform(k, 0, 0, k, offX, offY);
      drawTiles(ctx, s.map, me, view.x0, view.y0, view.x1, view.y1, 1 / k);
    }
    const world = () => ctx.setTransform(k, 0, 0, k, offX, offY);
    world();

    // Build grid and preview footprint.
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
      else if (t.id === v.hoverStructure) outline(t.x, t.y, t.w, t.h, 'rgba(250,238,218,0.7)', 2);
    }
    for (const n of s.map.nodes) {
      if (n.id === v.selectedNode) outline(n.x, n.y, NODE_SIZE, NODE_SIZE, C.RED, 2.5);
      else if (n.id === v.hoverNode) outline(n.x, n.y, NODE_SIZE, NODE_SIZE, 'rgba(250,238,218,0.7)', 2);
    }

    // Belts lie flat on the ground, with their items on top.
    const colorOf = new Map(s.players.map((p) => [p.id, p.color]));
    const flatBelts: { b: Belt; from: number | null }[] = [];
    for (const b of s.belts) {
      if (b.kind !== 'belt' || !inView(b.x, b.y, 1) || !seen(b.x, b.y)) continue;
      flatBelts.push({ b, from: beltFeed(s, b) });
    }
    // Units walking to spots placed by hand.
    for (const t of v.placed) {
      const X = isoX((t % size) + 0.5, Math.floor(t / size) + 0.5);
      const Y = isoY((t % size) + 0.5, Math.floor(t / size) + 0.5);
      ctx.strokeStyle = 'rgba(250, 238, 218, 0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(X, Y, 14, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Belt tiles are stamped from cached pictures: one per direction, bend and chevron frame.
    const beltFrame = Math.floor(((v.time / 1000) % 1) * BELT_FRAMES);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const { b, from } of flatBelts) {
      const dx = isoX(b.x + 0.5, b.y + 0.5) * k + offX;
      const dy = isoY(b.x + 0.5, b.y + 0.5) * k + offY;
      this.sprites.stamp(ctx, `belt:${b.dir}:${from}:${beltFrame}`, k, v.zoomSettled, dx, dy, BELT_BOUNDS, (g) => drawBelt(g, -0.5, -0.5, b.dir, from, (beltFrame / BELT_FRAMES) * 1000));
    }
    world();
    for (const { b } of flatBelts) if (b.id === v.selectedBelt) outline(b.x, b.y, 1, 1, C.RED, 2.5);
    if (v.beltGhost) {
      ctx.globalAlpha = 0.75;
      for (const t of v.beltGhost.tiles) {
        if (v.beltGhost.kind === 'belt') drawBelt(ctx, t.x, t.y, t.dir, null, v.time, true);
        else drawSplitterMerger(ctx, v.beltGhost.kind, t.x, t.y, t.dir, C.PLAYER_COLORS[me.color].main, C.PLAYER_COLORS[me.color].dark);
        if (!t.ok) {
          footprintPath(ctx, t.x, t.y, 1, 1);
          ctx.fillStyle = 'rgba(252, 63, 63, 0.45)';
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    const stampItem = (item: Belt['items'][number]['item'], tx: number, ty: number, zLift: number) => {
      const dx = isoX(tx, ty) * k + offX;
      const dy = (isoY(tx, ty) - zLift) * k + offY;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.sprites.stamp(ctx, `item:${item}`, k, v.zoomSettled, dx, dy, ITEM_BOUNDS, (g) => drawItemIcon(g, item));
      world();
    };
    for (const { b, from } of flatBelts) {
      for (let i = b.items.length - 1; i >= 0; i--) {
        const it = b.items[i];
        const [tx, ty] = beltItemSpot(b.x, b.y, b.dir, from, it.pos);
        stampItem(it.item, tx, ty, 4);
      }
    }

    // Everything standing up, back to front.
    const items: Drawable[] = [];
    for (const n of s.map.nodes) {
      if (!inView(n.x, n.y, 2)) continue;
      if (!seen(n.x, n.y) && !seen(n.x + 1, n.y + 1)) continue;
      if (s.occupied[n.y * size + n.x]) continue; // a Drill or Pump covers it
      items.push({ depth: n.x + n.y + 2, draw: (g) => drawNode(g, n, v.time) });
    }
    for (const b of s.belts) {
      if (b.kind === 'belt' || !inView(b.x, b.y, 1) || !seen(b.x, b.y)) continue;
      const col = C.PLAYER_COLORS[colorOf.get(b.owner) ?? 0];
      items.push({
        depth: b.x + b.y + 1,
        draw: (g) => {
          drawSplitterMerger(g, b.kind, b.x, b.y, b.dir, col.main, col.dark);
          if (b.id === v.selectedBelt) outline(b.x, b.y, 1, 1, C.RED, 2.5);
          for (const it of b.items) {
            const [tx, ty] = beltItemSpot(b.x, b.y, b.dir, null, it.pos);
            stampItem(it.item, tx, ty, 11);
          }
        },
      });
    }
    const bars: (() => void)[] = [];
    for (const t of s.structures) {
      if (!inView(t.x, t.y, 6)) continue;
      // Explored ground shows everything (Caleb); other players' things stay hidden in fog.
      if (t.owner !== v.me && !seen(t.x, t.y) && !seen(t.x + t.w - 1, t.y + t.h - 1)) continue;
      const col = C.PLAYER_COLORS[colorOf.get(t.owner) ?? 0];
      const hurt = s.tick - t.lastHurt < 3;
      items.push({
        depth: t.x + t.y + (t.w + t.h) / 2,
        draw: (g) =>
          drawStructure(
            g,
            { kind: t.kind, x: t.x, y: t.y, w: t.w, h: t.h, rot: t.rot, color: hurt ? '#ffd9d0' : col.main, dark: hurt ? '#f2b3a6' : col.dark, progress: t.buildLeft > 0 ? 1 - t.buildLeft / t.buildTotal : undefined, active: t.status === 'working' },
            v.time,
          ),
      });
      const max = STRUCTURES[t.kind].hp;
      if (t.buildLeft === 0 && (t.hp < max || t.id === v.selectedStructure)) {
        const X = isoX(t.x + t.w / 2, t.y + t.h / 2);
        const Y = isoY(t.x + t.w / 2, t.y + t.h / 2) - (STRUCTURE_HEIGHT[t.kind] ?? 24) - 8;
        bars.push(() => drawHealthBar(ctx, X, Y, Math.min(60, 14 + (t.w + t.h) * 6), t.hp / max));
      }
    }
    for (const u of s.units) {
      const ux = (u.px + (u.x - u.px) * v.alpha) / FP;
      const uy = (u.py + (u.y - u.py) * v.alpha) / FP;
      if (!inView(ux, uy, 2)) continue;
      if (u.owner !== v.me && !seen(Math.floor(ux), Math.floor(uy))) continue;
      const colorIndex = colorOf.get(u.owner) ?? 0;
      const col = C.PLAYER_COLORS[colorIndex];
      // Device pixel of the unit's feet.
      const dx = isoX(ux, uy) * k + offX;
      const dy = isoY(ux, uy) * k + offY;
      const facing = u.dirX - u.dirY < 0 ? -1 : 1;
      const moving = u.pathStep < u.path.length;
      // One of 8 stride pictures while walking, or standing still.
      const frame = moving ? Math.floor((((ux + uy) * 3.4) / (Math.PI * 2)) * WALK_FRAMES) % WALK_FRAMES : -1;
      const selected = v.selectedUnits.has(u.id);
      const attack = s.tick - u.lastAttack < 5;
      const hurt = s.tick - u.lastHurt < 3;
      const maxHp = UNITS[u.kind].hp;
      if (u.hp < maxHp || selected) {
        const X = isoX(ux, uy);
        const Y = isoY(ux, uy) - 36;
        bars.push(() => drawHealthBar(ctx, X, Y, 18, u.hp / maxHp));
      }
      items.push({
        depth: ux + uy,
        draw: (g) => {
          g.setTransform(1, 0, 0, 1, 0, 0);
          if (selected) this.sprites.stamp(g, 'ring', k, v.zoomSettled, dx, dy, RING_BOUNDS, (r) => drawUnitRing(r, 0, 0));
          this.sprites.stamp(g, `${u.kind}:${colorIndex}:${facing}:${frame}:${attack ? 'a' : ''}${hurt ? 'h' : ''}`, k, v.zoomSettled, dx, dy, FIGURE_BOUNDS, (f) =>
            drawMinuteman(f, 0, 0, col.main, col.dark, facing, ((frame + 0.5) / WALK_FRAMES) * Math.PI * 2, frame >= 0, attack, hurt),
          );
          world();
        },
      });
    }
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw(ctx);
    for (const b of bars) b();
    this.drawEffects(ctx, v);
    if (v.rally) this.drawRally(ctx, v, v.rally.from, v.rally.tile, v.rally.patrol, false);
    if (v.patrolDraft && v.rally) this.drawRally(ctx, v, v.rally.from, v.rally.tile, v.patrolDraft, true);

    // Power lines, above everything on the ground.
    const anchor = (id: number): Pt | null => {
      const t = c.structById.get(id);
      if (!t) return null;
      const height = t.kind === 'powerPole' ? POLE_TOP : Math.round((STRUCTURE_HEIGHT[t.kind] ?? 24) * 0.75);
      return lineAnchor(t.x, t.y, t.w, t.h, height);
    };
    for (const l of s.lines) {
      const a = c.structById.get(l.a);
      const b = c.structById.get(l.b);
      if (!a || !b || (!inView(a.x, a.y, 16) && !inView(b.x, b.y, 16))) continue;
      if (!seen(a.x, a.y) || !seen(b.x, b.y)) continue;
      const pa = anchor(l.a);
      const pb = anchor(l.b);
      if (pa && pb) drawPowerLine(ctx, pa, pb);
    }
    if (v.lineGhost) drawPowerLine(ctx, v.lineGhost.a, v.lineGhost.b, true, v.lineGhost.ok);

    // Item ports while building, and on the selected structure.
    const ports: Port[] = [];
    for (const t of s.structures) {
      if (t.owner !== v.me || !inView(t.x, t.y, 4)) continue;
      if (v.showPorts || t.id === v.selectedStructure) ports.push(...(c.ports.get(t.id) ?? []));
    }
    if (v.ghost) ports.push(...portsOf(v.ghost.kind, v.ghost.x, v.ghost.y, v.ghost.rot));
    for (const p of ports) drawPortArrow(ctx, p);

    // Badges for power trouble and missing recipes on the player's own structures.
    for (const t of s.structures) {
      if (t.owner !== v.me || !inView(t.x, t.y, 4)) continue;
      if (t.status !== 'noPower' && t.status !== 'blown' && t.status !== 'noRecipe') continue;
      const height = STRUCTURE_HEIGHT[t.kind] ?? 24;
      const X = isoX(t.x + t.w / 2, t.y + t.h / 2);
      const Y = isoY(t.x + t.w / 2, t.y + t.h / 2) - height - 14;
      drawStatusBadge(ctx, X, Y, t.status, v.time);
    }

    if (v.ghost) {
      const col = C.PLAYER_COLORS[me.color];
      ctx.globalAlpha = v.ghost.ok ? 0.7 : 0.45;
      drawStructure(ctx, { ...v.ghost, color: col.main, dark: col.dark }, v.time);
      ctx.globalAlpha = 1;
    }

    // Order markers: a diamond that shrinks away for a move, a red ring for an attack.
    for (const m of v.markers) {
      const age = (v.time - m.at) / 600;
      if (age >= 1) continue;
      const X = isoX(m.x + 0.5, m.y + 0.5);
      const Y = isoY(m.x + 0.5, m.y + 0.5);
      if (m.kind === 'attack') {
        ctx.strokeStyle = C.RED;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1 - age;
        ctx.beginPath();
        ctx.ellipse(X, Y, 20 * (1.2 - age * 0.4), 10 * (1.2 - age * 0.4), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
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

  /** Dust for a fallen unit, debris for a destroyed structure, a ring for a Hub's pulse. */
  private drawEffects(ctx: CanvasRenderingContext2D, v: RenderView) {
    const c = cache(v.state);
    for (const e of v.effects) {
      const age = (v.time - e.at) / (e.kind === 'destroyed' ? 900 : 600);
      if (age < 0 || age >= 1) continue;
      ctx.globalAlpha = 1 - age;
      if (e.kind === 'pulse') {
        const hub = c.structById.get(e.hub ?? 0);
        if (!hub) continue;
        const X = isoX(hub.x + hub.w / 2, hub.y + hub.h / 2);
        const Y = isoY(hub.x + hub.w / 2, hub.y + hub.h / 2);
        const r = ((hub.w / 2 + PULSE_REACH) * age + 1) * HW * Math.SQRT2;
        ctx.strokeStyle = C.RED;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(X, Y, r, r / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'death') {
        const X = isoX(e.x, e.y);
        const Y = isoY(e.x, e.y);
        ctx.fillStyle = '#b9ae9a';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(X + Math.cos(a) * 10 * age, Y - 6 + Math.sin(a) * 5 * age - age * 6, 4 * (1 - age) + 1, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const X = isoX(e.x + e.w / 2, e.y + e.h / 2);
        const Y = isoY(e.x + e.w / 2, e.y + e.h / 2);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          ctx.fillStyle = i % 2 ? C.METAL_DARK : '#c46a35';
          ctx.fillRect(X + Math.cos(a) * 30 * age - 3, Y - 20 * age + Math.sin(a) * 15 * age - 3, 6, 6);
        }
        ctx.fillStyle = 'rgba(60, 55, 50, 0.6)';
        ctx.beginPath();
        ctx.ellipse(X, Y - 10 - 20 * age, 18 + 20 * age, 10 + 10 * age, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /** A flag on a rally point with a dashed line to it, and numbered patrol points. */
  private drawRally(ctx: CanvasRenderingContext2D, v: RenderView, from: number, tile: number, patrol: number[], draft: boolean) {
    const size = v.state.size;
    const t = cache(v.state).structById.get(from);
    if (!t) return;
    const pt = (i: number): [number, number] => [isoX((i % size) + 0.5, Math.floor(i / size) + 0.5), isoY((i % size) + 0.5, Math.floor(i / size) + 0.5)];
    const [sx, sy] = [isoX(t.x + t.w / 2, t.y + t.h / 2), isoY(t.x + t.w / 2, t.y + t.h / 2)];
    const [rx, ry] = pt(tile);
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(250, 238, 218, 0.8)';
    ctx.lineWidth = 2;
    if (!draft) {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(rx, ry);
      ctx.stroke();
    }
    if (patrol.length) {
      ctx.strokeStyle = draft ? C.CREAM : 'rgba(252, 63, 63, 0.85)';
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      for (const p of patrol) ctx.lineTo(...pt(p));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // The flag.
    ctx.strokeStyle = C.NAVY;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx, ry - 26);
    ctx.stroke();
    ctx.fillStyle = C.RED;
    ctx.beginPath();
    ctx.moveTo(rx, ry - 26);
    ctx.lineTo(rx + 14, ry - 21);
    ctx.lineTo(rx, ry - 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    patrol.forEach((p, i) => {
      const [px, py] = pt(p);
      ctx.fillStyle = C.NAVY;
      ctx.strokeStyle = C.CREAM;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py - 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.CREAM;
      ctx.font = 'bold 10px Archivo Variable, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), px, py - 3.5);
    });
  }

  private drawGhostGround(ctx: CanvasRenderingContext2D, g: Ghost, size: number) {
    // The grid around the cursor (SPEC: structures are placed on a grid).
    const R = 9;
    const cx = g.x + Math.floor(g.w / 2);
    const cy = g.y + Math.floor(g.h / 2);
    ctx.strokeStyle = 'rgba(250, 238, 218, 0.16)';
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
    ctx.fillStyle = g.ok ? 'rgba(250, 238, 218, 0.18)' : 'rgba(252, 63, 63, 0.4)';
    ctx.fill();
    ctx.strokeStyle = g.ok ? C.CREAM : C.RED;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
