import type { ResourceNode } from '../sim/map/types';
import type { StructureKind } from '../sim/content/structures';
import { HH, HW, isoX, isoY } from './iso';
import * as C from './style';

// Drawings of nodes, structures and units, in world pixels (the caller sets the camera
// transform). Flat colors with navy outlines: structures are cartoony sci-fi machines in
// light metal with a band of the owner's color; infantry are stick figures like Stickman
// Arena's, in the owner's color.

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

const OUTLINE = 1.5;

const P = (x: number, y: number, z = 0): Pt => [isoX(x, y), isoY(x, y) - z];

function poly(ctx: Ctx, pts: Pt[], fill: string | null, stroke = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = C.NAVY;
    ctx.lineWidth = OUTLINE;
    ctx.stroke();
  }
}

function line(ctx: Ctx, a: Pt, b: Pt, color = C.NAVY, width = OUTLINE) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

/** An upright box from (x0, y0) to (x1, y1) in tiles, from height z0 to z1. Light falls from the left. */
function box(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, top = C.METAL_TOP, left = C.METAL_LEFT, right = C.METAL_RIGHT) {
  poly(ctx, [P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], left);
  poly(ctx, [P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)], right);
  poly(ctx, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top);
}

/** A band of the owner's color around a box's two front sides (the top stays as it is). */
function band(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: string, dark: string) {
  poly(ctx, [P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], color);
  poly(ctx, [P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)], dark);
}

/** A rectangle on a box's front-left face (the side at y = y1), from x a to b and height za to zb. */
function onLeft(ctx: Ctx, y1: number, a: number, b: number, za: number, zb: number, fill: string) {
  poly(ctx, [P(a, y1, zb), P(b, y1, zb), P(b, y1, za), P(a, y1, za)], fill);
}

/** A rectangle on a box's front-right face (the side at x = x1), from y a to b and height za to zb. */
function onRight(ctx: Ctx, x1: number, a: number, b: number, za: number, zb: number, fill: string) {
  poly(ctx, [P(x1, a, zb), P(x1, b, zb), P(x1, b, za), P(x1, a, za)], fill);
}

function groundEllipse(ctx: Ctx, cx: number, cy: number, r: number, fill: string, stroke = false) {
  const [X, Y] = P(cx, cy);
  ctx.beginPath();
  ctx.ellipse(X, Y, r * HW * Math.SQRT2, r * HH * Math.SQRT2, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = C.NAVY;
    ctx.lineWidth = OUTLINE;
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- nodes

function rock(ctx: Ctx, X: number, Y: number, r: number, [main, light, dark]: [string, string, string], fleck?: string) {
  const pts: Pt[] = [
    [X - r, Y],
    [X - r * 0.75, Y - r * 0.85],
    [X - r * 0.05, Y - r * 1.3],
    [X + r * 0.8, Y - r * 0.8],
    [X + r, Y - r * 0.05],
    [X + r * 0.45, Y + r * 0.35],
    [X - r * 0.5, Y + r * 0.3],
  ];
  poly(ctx, pts, main, false);
  // A lit facet on the upper left and a shaded one on the right.
  poly(ctx, [pts[0], pts[1], pts[2], [X - r * 0.1, Y - r * 0.35]], light, false);
  poly(ctx, [pts[3], pts[4], pts[5], [X + r * 0.15, Y - r * 0.3]], dark, false);
  if (fleck) {
    // Copper ore's green patina, so it never reads as iron.
    ctx.fillStyle = fleck;
    for (const [fx, fy] of [
      [-0.35, -0.55],
      [0.3, -0.2],
      [-0.05, 0.05],
    ])
      ctx.fillRect(X + fx * r - 1.3, Y + fy * r - 1.3, 2.6, 2.6);
  }
  poly(ctx, pts, null);
}

function crystal(ctx: Ctx, X: number, Y: number, r: number, [main, light, dark]: [string, string, string]) {
  const pts: Pt[] = [
    [X - r * 0.45, Y],
    [X - r * 0.5, Y - r * 1.4],
    [X, Y - r * 2.1],
    [X + r * 0.5, Y - r * 1.4],
    [X + r * 0.45, Y],
  ];
  poly(ctx, pts, main, false);
  poly(ctx, [pts[1], pts[2], [X, Y - r * 0.2], pts[0]], light, false);
  poly(ctx, [pts[2], pts[3], pts[4], [X, Y - r * 0.2]], dark, false);
  poly(ctx, pts, null);
}

const ROCK_SPOTS: [number, number, number][] = [
  [-13, -1, 8.5],
  [11, -4, 8],
  [-1, 7, 9],
  [3, -11, 7],
];

/** A resource node: bare soil with ore rocks in the resource's color. More rocks means a purer node. */
export function drawNode(ctx: Ctx, n: ResourceNode, time: number) {
  const cx = n.x + 1;
  const cy = n.y + 1;
  const [X, Y] = P(cx, cy);
  const colors = C.RESOURCE_COLORS[n.resource];
  if (n.resource === 'oil') {
    const r = 0.55 + n.purity * 0.14;
    groundEllipse(ctx, cx, cy, r + 0.18, C.SOIL_DARK);
    groundEllipse(ctx, cx, cy, r, colors[0], true);
    // A shine and a few bubbles.
    ctx.fillStyle = colors[1];
    ctx.beginPath();
    ctx.ellipse(X - 8, Y - 4, 9, 3, -0.2, 0, Math.PI * 2);
    ctx.fill();
    const t = time / 900;
    for (let i = 0; i < 2 + n.purity; i++) {
      const ph = (t + i * 0.37) % 1;
      ctx.strokeStyle = colors[1];
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(X + (i * 13) % 20 - 8, Y + ((i * 7) % 9) - 2, 1.5 + ph * 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  groundEllipse(ctx, cx, cy, 0.95, C.SOIL);
  groundEllipse(ctx, cx, cy, 0.62, C.SOIL_DARK);
  const count = 2 + n.purity;
  // Back rocks first.
  const spots = ROCK_SPOTS.slice(0, count).sort((a, b) => a[1] - b[1]);
  for (const [dx, dy, r] of spots) {
    if (n.resource === 'quartz') crystal(ctx, X + dx, Y + dy + 2, r * 0.75, colors);
    else rock(ctx, X + dx, Y + dy, r, colors, n.resource === 'copper' ? C.COPPER_PATINA : undefined);
  }
  if (n.resource === 'gold') {
    // A glint.
    const g = (Math.sin(time / 500 + n.id) + 1) / 2;
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.6 * g})`;
    ctx.lineWidth = 1.5;
    const gx = X - 4;
    const gy = Y - 14;
    line(ctx, [gx - 4, gy], [gx + 4, gy], ctx.strokeStyle as string, 1.5);
    line(ctx, [gx, gy - 4], [gx, gy + 4], ctx.strokeStyle as string, 1.5);
  }
}

// ---------------------------------------------------------------- structures

export interface StructureLook {
  kind: StructureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  color: string;
  dark: string;
}

/** Draws a structure standing on its footprint. */
export function drawStructure(ctx: Ctx, s: StructureLook, time: number) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const { x, y, w, h } = s;
  const x1 = x + w;
  const y1 = y + h;
  const i = 0.12; // inset from the footprint's edge
  switch (s.kind) {
    case 'hub':
      return drawHub(ctx, s, time);
    case 'drill': {
      box(ctx, x + i, y + i, x1 - i, y1 - i, 0, 10, C.METAL_DARK, C.METAL_DARK, C.shade(C.METAL_DARK, 0.8));
      band(ctx, x + i, y + i, x1 - i, y1 - i, 10, 14, s.color, s.dark);
      // A lattice tower with the motor on top.
      const a = x + 0.62;
      const b = y + 0.62;
      const c = x1 - 0.62;
      const d = y1 - 0.62;
      box(ctx, a, b, c, d, 14, 46);
      for (let z = 14; z < 46; z += 8) {
        line(ctx, P(a, d, z), P(c, d, z + 8), C.NAVY, 1.1);
        line(ctx, P(c, b, z + 8), P(c, d, z), C.NAVY, 1.1);
      }
      box(ctx, a - 0.12, b - 0.12, c + 0.12, d + 0.12, 46, 56, s.color, s.color, s.dark);
      // The bit turns.
      const spin = (time / 120) % 4;
      const [bx, by] = P(x + w / 2, y + h / 2, 10);
      ctx.fillStyle = C.METAL_DARK;
      ctx.beginPath();
      ctx.ellipse(bx, by + 2, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      line(ctx, [bx - 6 + spin * 3, by + 2], [bx + 6 - spin * 3, by + 2], C.CREAM, 1.4);
      return;
    }
    case 'pump': {
      box(ctx, x + i, y + i, x1 - i, y1 - i, 0, 8, C.METAL_DARK, C.METAL_DARK, C.shade(C.METAL_DARK, 0.8));
      band(ctx, x + i, y + i, x1 - i, y1 - i, 8, 12, s.color, s.dark);
      box(ctx, x + 0.8, y + 0.8, x1 - 0.8, y1 - 0.8, 12, 36);
      const nod = Math.sin(time / 400) * 5;
      line(ctx, P(x + 0.3, y + 1, 40 + nod), P(x1 - 0.3, y + 1, 40 - nod), C.NAVY, 4);
      line(ctx, P(x + 0.3, y + 1, 40 + nod), P(x1 - 0.3, y + 1, 40 - nod), s.color, 2);
      return;
    }
    case 'smelter': {
      box(ctx, x + i, y + i, x1 - i, y1 - i, 0, 24);
      band(ctx, x + i, y + i, x1 - i, y1 - i, 20, 24, s.color, s.dark);
      // The furnace mouth glows.
      const glow = 0.75 + 0.25 * Math.sin(time / 300);
      onLeft(ctx, y1 - i, x + 0.45, x1 - 0.45, 4, 13, C.METAL_DARK);
      ctx.globalAlpha *= glow;
      onLeft(ctx, y1 - i, x + 0.55, x1 - 0.55, 5, 11, C.GLOW);
      ctx.globalAlpha /= glow;
      box(ctx, x1 - 0.75, y + 0.3, x1 - 0.35, y + 0.7, 24, 50, C.METAL_DARK, C.METAL_DARK, C.shade(C.METAL_DARK, 0.75));
      band(ctx, x1 - 0.75, y + 0.3, x1 - 0.35, y + 0.7, 44, 48, s.color, s.dark);
      return;
    }
    case 'constructor': {
      box(ctx, x + i, y + i, x1 - i, y1 - i, 0, 20);
      band(ctx, x + i, y + i, x1 - i, y1 - i, 16, 20, s.color, s.dark);
      // A work slot along the long side and an arm over it.
      const long = h >= w;
      if (long) poly(ctx, [P(x + 0.7, y + 0.35, 20), P(x1 - 0.7, y + 0.35, 20), P(x1 - 0.7, y1 - 0.35, 20), P(x + 0.7, y1 - 0.35, 20)], C.METAL_DARK);
      else poly(ctx, [P(x + 0.35, y + 0.7, 20), P(x1 - 0.35, y + 0.7, 20), P(x1 - 0.35, y1 - 0.7, 20), P(x + 0.35, y1 - 0.7, 20)], C.METAL_DARK);
      const sw = Math.sin(time / 500) * 0.35;
      const base = long ? P(x + 0.35, y + h / 2 + sw, 20) : P(x + w / 2 + sw, y + 0.35, 20);
      const elbow: Pt = [base[0], base[1] - 16];
      const hand = long ? P(x + w / 2, y + h / 2 + sw, 26) : P(x + w / 2 + sw, y + h / 2, 26);
      line(ctx, base, elbow, C.NAVY, 5);
      line(ctx, elbow, hand, C.NAVY, 5);
      line(ctx, base, elbow, s.color, 2.6);
      line(ctx, elbow, hand, s.color, 2.6);
      return;
    }
    case 'deployer': {
      box(ctx, x + i, y + i, x1 - i, y1 - i, 0, 30);
      band(ctx, x + i, y + i, x1 - i, y1 - i, 26, 30, s.color, s.dark);
      // A hangar door with chevrons in the owner's color.
      onLeft(ctx, y1 - i, x + 0.6, x1 - 0.6, 0, 20, C.METAL_DARK);
      for (let k = 0; k < 3; k++) {
        const z = 5 + k * 5;
        const m = x + w / 2;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const [ax, ay] = P(m - 0.5, y1 - i, z);
        const [bx, by] = P(m, y1 - i, z + 4);
        const [cx2, cy2] = P(m + 0.5, y1 - i, z);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(cx2, cy2);
        ctx.stroke();
      }
      box(ctx, x + 0.5, y + 0.5, x + 1.3, y + 1.3, 30, 36);
      box(ctx, x1 - 1.3, y + 0.5, x1 - 0.5, y + 1.3, 30, 36);
      return;
    }
    case 'garage':
    case 'landingPad': {
      box(ctx, x + i, y + i, x1 - i, y1 - i, 0, s.kind === 'garage' ? 26 : 8);
      band(ctx, x + i, y + i, x1 - i, y1 - i, s.kind === 'garage' ? 22 : 8, s.kind === 'garage' ? 26 : 11, s.color, s.dark);
      if (s.kind === 'garage') onLeft(ctx, y1 - i, x + 0.6, x1 - 0.6, 0, 18, C.METAL_DARK);
      else groundEllipse(ctx, x + w / 2, y + h / 2, 1.2, C.METAL_DARK, true);
      return;
    }
    case 'depot': {
      box(ctx, x + 0.2, y + 0.2, x1 - 0.2, y1 - 0.2, 0, 22, '#c9a46a', '#b08a52', '#93723f');
      band(ctx, x + 0.2, y + 0.2, x1 - 0.2, y1 - 0.2, 22, 25, s.color, s.dark);
      // Cross bracing on the two front faces.
      line(ctx, P(x + 0.2, y1 - 0.2, 2), P(x1 - 0.2, y1 - 0.2, 20), C.NAVY, 1.2);
      line(ctx, P(x + 0.2, y1 - 0.2, 20), P(x1 - 0.2, y1 - 0.2, 2), C.NAVY, 1.2);
      line(ctx, P(x1 - 0.2, y + 0.2, 2), P(x1 - 0.2, y1 - 0.2, 20), C.NAVY, 1.2);
      line(ctx, P(x1 - 0.2, y + 0.2, 20), P(x1 - 0.2, y1 - 0.2, 2), C.NAVY, 1.2);
      return;
    }
    case 'solar': {
      box(ctx, x + 0.7, y + 0.7, x1 - 0.7, y1 - 0.7, 0, 9, C.METAL_DARK, C.METAL_DARK, C.shade(C.METAL_DARK, 0.8));
      band(ctx, x + 0.7, y + 0.7, x1 - 0.7, y1 - 0.7, 9, 12, s.color, s.dark);
      // A tilted panel on legs, with its cell lines.
      const a = P(x + 0.1, y + 0.1, 26);
      const b = P(x1 - 0.1, y + 0.1, 26);
      const c = P(x1 - 0.1, y1 - 0.1, 15);
      const d = P(x + 0.1, y1 - 0.1, 15);
      for (const [lx, ly] of [
        [x + 0.25, y1 - 0.25],
        [x1 - 0.25, y1 - 0.25],
        [x1 - 0.25, y + 0.25],
      ]) {
        line(ctx, P(lx, ly, 0), P(lx, ly, 16), C.NAVY, 3.6);
        line(ctx, P(lx, ly, 0), P(lx, ly, 16), C.METAL_LEFT, 1.6);
      }
      poly(ctx, [a, b, c, d], C.SOLAR);
      ctx.strokeStyle = '#6f9fe0';
      ctx.lineWidth = 1;
      for (let k = 1; k < 3; k++) {
        const t = k / 3;
        ctx.beginPath();
        ctx.moveTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
        ctx.lineTo(d[0] + (c[0] - d[0]) * t, d[1] + (c[1] - d[1]) * t);
        ctx.moveTo(a[0] + (d[0] - a[0]) * t, a[1] + (d[1] - a[1]) * t);
        ctx.lineTo(b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t);
        ctx.stroke();
      }
      poly(ctx, [a, b, c, d], null);
      return;
    }
    case 'laboratory': {
      box(ctx, x + i, y + i, x1 - i, y1 - i, 0, 22);
      band(ctx, x + i, y + i, x1 - i, y1 - i, 18, 22, s.color, s.dark);
      onRight(ctx, x1 - i, y + 0.5, y + 1.2, 8, 15, C.GLASS);
      onRight(ctx, x1 - i, y + 1.8, y + 2.5, 8, 15, C.GLASS);
      // A glass dome.
      const [X, Y] = P(x + w / 2, y + h / 2, 22);
      const rx = 0.95 * HW * Math.SQRT2;
      const ry = 0.95 * HH * Math.SQRT2;
      ctx.beginPath();
      ctx.ellipse(X, Y, rx, ry, 0, 0, Math.PI);
      ctx.ellipse(X, Y, rx, rx * 0.8, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = C.GLASS;
      ctx.fill();
      ctx.strokeStyle = C.NAVY;
      ctx.lineWidth = OUTLINE;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X - rx * 0.25, Y - rx * 0.35, rx * 0.4, Math.PI * 1.1, Math.PI * 1.45);
      ctx.stroke();
      return;
    }
    default: {
      // Structures from later stages, drawn plainly until they get their own look.
      box(ctx, x + i, y + i, x1 - i, y1 - i, 0, 20);
      band(ctx, x + i, y + i, x1 - i, y1 - i, 16, 20, s.color, s.dark);
      return;
    }
  }
}

function drawHub(ctx: Ctx, s: StructureLook, time: number) {
  const { x, y, w, h } = s;
  const x1 = x + w;
  const y1 = y + h;
  box(ctx, x + 0.1, y + 0.1, x1 - 0.1, y1 - 0.1, 0, 8, C.METAL_DARK, C.METAL_DARK, C.shade(C.METAL_DARK, 0.8));
  box(ctx, x + 0.6, y + 0.6, x1 - 0.6, y1 - 0.6, 8, 36);
  band(ctx, x + 0.6, y + 0.6, x1 - 0.6, y1 - 0.6, 30, 35, s.color, s.dark);
  // Door and windows.
  onLeft(ctx, y1 - 0.6, x + 1.9, x1 - 1.9, 8, 24, C.METAL_DARK);
  onRight(ctx, x1 - 0.6, y + 1.1, y + 1.8, 15, 23, C.GLASS);
  onRight(ctx, x1 - 0.6, y + 2.15, y + 2.85, 15, 23, C.GLASS);
  onRight(ctx, x1 - 0.6, y + 3.2, y + 3.9, 15, 23, C.GLASS);
  // The tower that sends the player's directives out.
  const a = x + w / 2 - 0.65;
  const b = y + h / 2 - 0.65;
  box(ctx, a, b, a + 1.3, b + 1.3, 35, 66);
  band(ctx, a, b, a + 1.3, b + 1.3, 60, 66, s.color, s.dark);
  const top = P(x + w / 2, y + h / 2, 66);
  const tip: Pt = [top[0], top[1] - 36];
  line(ctx, top, tip, C.NAVY, 4);
  line(ctx, top, tip, C.METAL_TOP, 2);
  for (const k of [0.35, 0.65]) {
    const yy = top[1] - 36 * k;
    const half = 9 * (1 - k * 0.6);
    line(ctx, [top[0] - half, yy + half * 0.5], [top[0] + half, yy - half * 0.5], C.NAVY, 2);
  }
  // A blinking light and rings going out.
  const blink = Math.floor(time / 600) % 2 === 0;
  ctx.fillStyle = blink ? C.RED : C.shade(C.RED, 0.6);
  ctx.strokeStyle = C.NAVY;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(tip[0], tip[1], 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const ring = (time / 1800) % 1;
  ctx.strokeStyle = `rgba(252, 63, 63, ${0.55 * (1 - ring)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(tip[0], tip[1], 6 + ring * 26, (6 + ring * 26) * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** The outline a structure covers on screen, for picking it with the mouse: its footprint raised to its height. */
export function structureHull(x: number, y: number, w: number, h: number, height: number): Pt[] {
  return [P(x, y, height), P(x + w, y, height), P(x + w, y, 0), P(x + w, y + h, 0), P(x, y + h, 0), P(x, y + h, height)];
}

export const STRUCTURE_HEIGHT: Partial<Record<StructureKind, number>> = { hub: 100, drill: 56, smelter: 50, deployer: 36, laboratory: 50, constructor: 30, depot: 25, solar: 22 };

// ---------------------------------------------------------------- units

/** A Minuteman: a stick figure in the owner's color with a helmet. `walk` advances the stride. */
export function drawMinuteman(ctx: Ctx, X: number, Y: number, color: string, dark: string, facing: number, walk: number, moving: boolean) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Shadow.
  ctx.fillStyle = 'rgba(0, 38, 87, 0.22)';
  ctx.beginPath();
  ctx.ellipse(X, Y, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const sw = moving ? Math.sin(walk) * 4.5 : 0;
  const bob = moving ? Math.abs(Math.cos(walk)) * 1.2 : 0;
  const hip: Pt = [X, Y - 11 - bob];
  const neck: Pt = [X + facing * 0.8, Y - 20 - bob];
  const limbs: [Pt[], string][] = [
    [[neck, [X - facing * 1 - sw * 0.6, Y - 15 - bob], [X - sw * 0.9, Y - 11 - bob]], dark], // back arm
    [[hip, [X - sw * 0.5, Y - 5.5], [X - sw, Y - 0.5]], dark], // back leg
    [[hip, neck], color],
    [[hip, [X + sw * 0.5, Y - 5.5], [X + sw, Y - 0.5]], color], // front leg
    [[neck, [X + facing * 2 + sw * 0.6, Y - 15 - bob], [X + facing * 4 + sw * 0.9, Y - 12 - bob]], color], // front arm
  ];
  for (const [pts, col] of limbs) {
    for (const [stroke, width] of [
      [C.NAVY, 5.2],
      [col, 2.6],
    ] as const) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  }
  // Head and helmet.
  const hx = X + facing * 1.2;
  const hy = Y - 25 - bob;
  ctx.fillStyle = color;
  ctx.strokeStyle = C.NAVY;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hx, hy, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.METAL_TOP;
  ctx.beginPath();
  ctx.arc(hx, hy - 0.6, 4.9, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Visor on the side the figure faces.
  ctx.strokeStyle = C.NAVY;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(hx + facing * 1, hy + 0.8);
  ctx.lineTo(hx + facing * 4.4, hy + 0.8);
  ctx.stroke();
}

/** The selection mark under a unit. */
export function drawUnitRing(ctx: Ctx, X: number, Y: number) {
  ctx.strokeStyle = C.RED;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(X, Y, 11, 5.5, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** A footprint outline on the ground (selection, hover, build preview). */
export function footprintPath(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const pts = [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)];
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
