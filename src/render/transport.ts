import type { ItemId } from '../sim/content/items';
import { DX, DY, type Port } from '../sim/content/structures';
import type { TransportKind } from '../sim/content/transport';
import { FP } from '../sim/fmath';
import { HH, HW } from './iso';
import { P, band, box, line, poly, type Pt } from './objects';
import * as C from './style';

// Drawing transport and power: belts with their items, splitters and mergers, power lines,
// item ports, and the badges that show a structure's power trouble.

type Ctx = CanvasRenderingContext2D;

const BELT = '#3a3732';
const BELT_LINE = '#57524a';
const RAIL = '#8a847a';
const HALF = 0.36; // half a belt's width, in tiles

/** A rectangle on the ground from point a to point b (tiles), `half` wide each side, raised z. */
function strip(ctx: Ctx, ax: number, ay: number, bx: number, by: number, half: number, z: number, fill: string, stroke: boolean) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * half;
  const ny = (dx / len) * half;
  poly(ctx, [P(ax + nx, ay + ny, z), P(bx + nx, by + ny, z), P(bx - nx, by - ny, z), P(ax - nx, ay - ny, z)], fill, stroke);
}

/**
 * One belt tile. `from` is the direction items enter moving in when a belt feeds this one from
 * the side (an elbow), otherwise null. Chevrons crawl along while items move.
 */
export function drawBelt(ctx: Ctx, x: number, y: number, dir: number, from: number | null, time: number, ghost = false) {
  const cx = x + 0.5;
  const cy = y + 0.5;
  const ax = DX[dir];
  const ay = DY[dir];
  ctx.lineJoin = 'round';
  if (from === null) {
    strip(ctx, cx - ax * 0.5, cy - ay * 0.5, cx + ax * 0.5, cy + ay * 0.5, HALF + 0.06, 0, RAIL, true);
    strip(ctx, cx - ax * 0.5, cy - ay * 0.5, cx + ax * 0.5, cy + ay * 0.5, HALF - 0.04, 1, BELT, false);
  } else {
    const mx = DX[from];
    const my = DY[from];
    strip(ctx, cx - mx * 0.5, cy - my * 0.5, cx + mx * (HALF + 0.06), cy + my * (HALF + 0.06), HALF + 0.06, 0, RAIL, true);
    strip(ctx, cx - ax * (HALF + 0.06), cy - ay * (HALF + 0.06), cx + ax * 0.5, cy + ay * 0.5, HALF + 0.06, 0, RAIL, true);
    strip(ctx, cx - mx * 0.5, cy - my * 0.5, cx + mx * (HALF - 0.04), cy + my * (HALF - 0.04), HALF - 0.04, 1, BELT, false);
    strip(ctx, cx - ax * (HALF - 0.04), cy - ay * (HALF - 0.04), cx + ax * 0.5, cy + ay * 0.5, HALF - 0.04, 1, BELT, false);
  }
  // Chevrons pointing the way items go (on the exit half for an elbow).
  const t = ghost ? 0.3 : ((time / 1000) % 1) * 1;
  const nx = -ay;
  const ny = ax;
  for (const k of from === null ? [0, 0.5] : [0.5]) {
    const f = from === null ? (k + t * 0.5) % 1 : 0.55 + ((t * 0.5) % 0.45);
    const px = cx - ax * 0.5 + ax * f;
    const py = cy - ay * 0.5 + ay * f;
    const a = P(px - ax * 0.12 + nx * 0.2, py - ay * 0.12 + ny * 0.2, 1);
    const b = P(px + ax * 0.08, py + ay * 0.08, 1);
    const c = P(px - ax * 0.12 - nx * 0.2, py - ay * 0.12 - ny * 0.2, 1);
    ctx.strokeStyle = BELT_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.stroke();
  }
}

const PIPE = '#6f7780';
const PIPE_LIGHT = '#98a0a8';
const PIPE_HALF = 0.2;
const PIPE_Z = 5;

/**
 * One pipe tile (Caleb: pipes work like belts, one way): a raised tube with a flange at the
 * end it flows out of. `from` as for belts. A stripe along the top shows the fluid inside, in
 * its color, as long as the pipe is full (`fill` from 0 to 1).
 */
export function drawPipe(ctx: Ctx, x: number, y: number, dir: number, from: number | null, fluid: ItemId | null = null, fill = 0) {
  const cx = x + 0.5;
  const cy = y + 0.5;
  const ax = DX[dir];
  const ay = DY[dir];
  ctx.lineJoin = 'round';
  // A short stand under the middle.
  poly(ctx, [P(cx - 0.08, cy - 0.08, 0), P(cx + 0.08, cy - 0.08, 0), P(cx + 0.08, cy - 0.08, PIPE_Z), P(cx - 0.08, cy - 0.08, PIPE_Z)], '#3a3732', true);
  if (from === null) {
    strip(ctx, cx - ax * 0.5, cy - ay * 0.5, cx + ax * 0.5, cy + ay * 0.5, PIPE_HALF, PIPE_Z, PIPE, true);
  } else {
    const mx = DX[from];
    const my = DY[from];
    strip(ctx, cx - mx * 0.5, cy - my * 0.5, cx + mx * PIPE_HALF, cy + my * PIPE_HALF, PIPE_HALF, PIPE_Z, PIPE, true);
    strip(ctx, cx - ax * PIPE_HALF, cy - ay * PIPE_HALF, cx + ax * 0.5, cy + ay * 0.5, PIPE_HALF, PIPE_Z, PIPE, true);
  }
  if (fluid && fill > 0) {
    // The fluid stripe, filling from the outflow end back.
    const len = 0.86 * Math.min(1, fill);
    strip(ctx, cx + ax * (0.43 - len), cy + ay * (0.43 - len), cx + ax * 0.43, cy + ay * 0.43, 0.1, PIPE_Z + 1, ITEM_LOOK[fluid].color, false);
  } else strip(ctx, cx - ax * 0.1, cy - ay * 0.1, cx + ax * 0.38, cy + ay * 0.38, 0.05, PIPE_Z + 1, PIPE_LIGHT, false);
  // A flange where it flows out.
  strip(ctx, cx + ax * 0.38, cy + ay * 0.38, cx + ax * 0.48, cy + ay * 0.48, PIPE_HALF + 0.06, PIPE_Z, '#4d545c', true);
}

/** Where an item `pos` along a tile sits (tile coordinates), for straight belts and elbows. */
export function beltItemSpot(x: number, y: number, dir: number, from: number | null, pos: number): [number, number] {
  const f = pos / FP;
  const cx = x + 0.5;
  const cy = y + 0.5;
  if (from === null || f >= 0.5) {
    return [cx + DX[dir] * (f - 0.5), cy + DY[dir] * (f - 0.5)];
  }
  return [cx - DX[from] * (0.5 - f), cy - DY[from] * (0.5 - f)];
}

type ItemShape = 'ore' | 'crystal' | 'ingot' | 'plate' | 'rod' | 'screws' | 'coil' | 'drop' | 'powder' | 'box' | 'cylinder' | 'board' | 'frame';

const ITEM_LOOK: Record<ItemId, { shape: ItemShape; color: string; light: string }> = {
  ironOre: { shape: 'ore', color: C.RESOURCE_COLORS.iron[0], light: C.RESOURCE_COLORS.iron[1] },
  copperOre: { shape: 'ore', color: C.RESOURCE_COLORS.copper[0], light: C.RESOURCE_COLORS.copper[1] },
  goldOre: { shape: 'ore', color: C.RESOURCE_COLORS.gold[0], light: C.RESOURCE_COLORS.gold[1] },
  rawQuartz: { shape: 'crystal', color: C.RESOURCE_COLORS.quartz[0], light: C.RESOURCE_COLORS.quartz[1] },
  coal: { shape: 'ore', color: C.RESOURCE_COLORS.coal[0], light: C.RESOURCE_COLORS.coal[1] },
  crudeOil: { shape: 'drop', color: C.RESOURCE_COLORS.oil[0], light: C.RESOURCE_COLORS.oil[1] },
  sulfur: { shape: 'ore', color: C.RESOURCE_COLORS.sulfur[0], light: C.RESOURCE_COLORS.sulfur[1] },
  ironIngot: { shape: 'ingot', color: '#9da1a8', light: '#c9ccd1' },
  copperIngot: { shape: 'ingot', color: '#c97a3e', light: '#e9a473' },
  ironPlate: { shape: 'plate', color: '#8f949b', light: '#b9bdc2' },
  ironRod: { shape: 'rod', color: '#7f848b', light: '#aeb2b8' },
  screws: { shape: 'screws', color: '#9a9ea4', light: '#d0d3d7' },
  wire: { shape: 'coil', color: '#c4743a', light: '#e59d63' },
  cable: { shape: 'coil', color: '#2d2c30', light: '#c4743a' },
  goldIngot: { shape: 'ingot', color: '#c9992c', light: '#ecc865' },
  steelIngot: { shape: 'ingot', color: '#5d636b', light: '#8d939b' },
  copperSheet: { shape: 'plate', color: '#b8682f', light: '#dd955c' },
  quickwire: { shape: 'coil', color: '#c9992c', light: '#ecc865' },
  reinforcedIronPlate: { shape: 'plate', color: '#6d737b', light: '#a3a8ae' },
  rotor: { shape: 'cylinder', color: '#7f848b', light: '#c4743a' },
  modularFrame: { shape: 'frame', color: '#7f848b', light: '#b9bdc2' },
  smartPlating: { shape: 'plate', color: '#4f6a86', light: '#d0d3d7' },
  steelBeam: { shape: 'rod', color: '#4f555c', light: '#7d838a' },
  steelPipe: { shape: 'rod', color: '#6a7078', light: '#9ba0a6' },
  versatileFramework: { shape: 'frame', color: '#4f555c', light: '#d2a42c' },
  stator: { shape: 'cylinder', color: '#5d636b', light: '#c4743a' },
  motor: { shape: 'cylinder', color: '#4f555c', light: '#a2252a' },
  automatedWiring: { shape: 'board', color: '#3f5a3a', light: '#c4743a' },
  quartzCrystal: { shape: 'crystal', color: '#d9b4ce', light: '#f8ecf3' },
  silica: { shape: 'powder', color: '#ece6dc', light: '#ffffff' },
  crystalOscillator: { shape: 'box', color: '#4f555c', light: '#e1c5d8' },
  plastic: { shape: 'box', color: '#3c74a8', light: '#7ea9d0' },
  rubber: { shape: 'box', color: '#26252a', light: '#4f4e55' },
  polymerResin: { shape: 'powder', color: '#7a6f9e', light: '#a99fcb' },
  petroleumCoke: { shape: 'powder', color: '#3a3836', light: '#5f5c58' },
  heavyOilResidue: { shape: 'drop', color: '#5b2f6e', light: '#8d5aa3' },
  fuel: { shape: 'drop', color: '#d98a1c', light: '#f2b85a' },
  circuitBoard: { shape: 'board', color: '#2f6b3a', light: '#d2a42c' },
  computer: { shape: 'box', color: '#3a4250', light: '#7fb3d6' },
  aiLimiter: { shape: 'board', color: '#3a4250', light: '#ecc865' },
  highSpeedConnector: { shape: 'board', color: '#5d636b', light: '#ecc865' },
  supercomputer: { shape: 'box', color: '#262c36', light: '#d2a42c' },
  modularEngine: { shape: 'cylinder', color: '#3a4250', light: '#d2a42c' },
  blackPowder: { shape: 'powder', color: '#2a2a2d', light: '#55555a' },
  smokelessPowder: { shape: 'powder', color: '#b0322f', light: '#d9625d' },
  compactedCoal: { shape: 'box', color: '#26262a', light: '#4f4f56' },
  turbofuel: { shape: 'drop', color: '#b5262b', light: '#e0585c' },
};

export function itemColor(item: ItemId) {
  return ITEM_LOOK[item].color;
}

/** A small picture of an item, centered on (0, 0), about 10 world pixels across. */
export function drawItemIcon(ctx: Ctx, item: ItemId) {
  const { shape, color, light } = ITEM_LOOK[item];
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.NAVY;
  ctx.lineWidth = 1.1;
  const path = (pts: Pt[], fill: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  };
  switch (shape) {
    case 'ore':
      path([[-5, 1], [-3.5, -3], [0, -4.5], [4, -2.5], [5, 1], [2, 3], [-3, 3]], color);
      ctx.fillStyle = light;
      ctx.fillRect(-3, -2.5, 2.5, 1.6);
      return;
    case 'crystal':
      path([[-3, 3], [-3.5, -2], [0, -6], [3.5, -2], [3, 3]], color);
      return;
    case 'ingot':
      path([[-5.5, 2.5], [-3.5, -2.5], [3.5, -2.5], [5.5, 2.5]], color);
      ctx.fillStyle = light;
      ctx.fillRect(-2.5, -1.8, 5, 1.3);
      return;
    case 'plate':
      path([[0, -3.5], [6, 0], [0, 3.5], [-6, 0]], color);
      path([[0, -2], [3.4, 0], [0, 2], [-3.4, 0]], light);
      return;
    case 'rod':
      path([[-6, 2], [5, -3.2], [6, -2], [-5, 3.2]], color);
      return;
    case 'screws':
      for (const [x, y] of [
        [-3, 1],
        [2.5, 1.5],
        [0, -2.5],
      ]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      return;
    case 'coil':
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.5, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = light;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 3, 1.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case 'drop':
      path([[0, -5], [3.5, 1], [0, 4], [-3.5, 1]], color);
      ctx.fillStyle = light;
      ctx.fillRect(-1.2, -1, 1.4, 2);
      return;
    case 'powder':
      path([[-5.5, 3], [-3, -1.5], [0, -3.5], [3, -1.5], [5.5, 3]], color);
      ctx.fillStyle = light;
      ctx.fillRect(-1.5, -2, 2, 1.4);
      return;
    case 'box':
      path([[0, -5], [5, -2.5], [0, 0], [-5, -2.5]], light);
      path([[-5, -2.5], [0, 0], [0, 4.5], [-5, 2]], color);
      path([[5, -2.5], [0, 0], [0, 4.5], [5, 2]], color);
      return;
    case 'cylinder':
      path([[-4.5, -2.5], [4.5, -2.5], [4.5, 3], [-4.5, 3]], color);
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.ellipse(0, -2.5, 4.5, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    case 'board':
      path([[0, -3.5], [6, 0], [0, 3.5], [-6, 0]], color);
      ctx.fillStyle = light;
      ctx.fillRect(-2.5, -1, 1.5, 1.5);
      ctx.fillRect(1, -1, 1.5, 1.5);
      return;
    case 'frame':
      path([[0, -4], [6, -1], [0, 2], [-6, -1]], color);
      path([[0, -2.2], [2.6, -1], [0, 0.2], [-2.6, -1]], light);
      path([[-6, -1], [0, 2], [0, 4], [-6, 1]], color);
      path([[6, -1], [0, 2], [0, 4], [6, 1]], color);
      return;
  }
}

export const ITEM_BOUNDS = { left: -8, top: -8, right: 8, bottom: 6 };

/** A splitter or merger: a low box on its tile with arrows for the ways items go. */
export function drawSplitterMerger(ctx: Ctx, kind: TransportKind, x: number, y: number, dir: number, color: string, dark: string) {
  box(ctx, x + 0.06, y + 0.06, x + 0.94, y + 0.94, 0, 9, C.METAL_TOP, C.METAL_LEFT, C.METAL_RIGHT);
  band(ctx, x + 0.06, y + 0.06, x + 0.94, y + 0.94, 6, 9, color, dark);
  const cx = x + 0.5;
  const cy = y + 0.5;
  // An arrow on the lid pointing out of side d.
  const arrow = (d: number) => {
    const ax = DX[d];
    const ay = DY[d];
    const nx = -ay;
    const ny = ax;
    poly(ctx, [P(cx + ax * 0.4, cy + ay * 0.4, 9), P(cx + ax * 0.16 + nx * 0.13, cy + ay * 0.16 + ny * 0.13, 9), P(cx + ax * 0.16 - nx * 0.13, cy + ay * 0.16 - ny * 0.13, 9)], C.RED);
  };
  if (kind === 'splitter') {
    arrow(dir);
    arrow((dir + 1) % 4);
    arrow((dir + 3) % 4);
  } else arrow(dir);
}

/** A power line between two attachment points (world pixels), sagging a little. */
export function drawPowerLine(ctx: Ctx, a: Pt, b: Pt, ghost = false, ok = true) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2 + Math.min(18, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.08);
  ctx.lineCap = 'round';
  ctx.strokeStyle = ghost ? (ok ? 'rgba(250,238,218,0.9)' : 'rgba(252,63,63,0.95)') : '#16181c';
  ctx.lineWidth = ghost ? 2 : 1.6;
  if (ghost) ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.quadraticCurveTo(mx, my, b[0], b[1]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** An arrow at a structure's port, pointing the way items go: cream into it, red out of it. */
export function drawPortArrow(ctx: Ctx, p: Port) {
  const d = p.io === 'in' ? (p.dir + 2) % 4 : p.dir;
  const ax = DX[d];
  const ay = DY[d];
  const nx = -ay;
  const ny = ax;
  // Centered on the edge between the port tile and the tile outside it.
  const ex = p.x + 0.5 + DX[p.dir] * 0.5;
  const ey = p.y + 0.5 + DY[p.dir] * 0.5;
  const tip: Pt = P(ex + ax * 0.28, ey + ay * 0.28, 2);
  const l: Pt = P(ex - ax * 0.2 + nx * 0.26, ey - ay * 0.2 + ny * 0.26, 2);
  const r: Pt = P(ex - ax * 0.2 - nx * 0.26, ey - ay * 0.2 - ny * 0.26, 2);
  poly(ctx, [tip, l, r], p.io === 'in' ? C.CREAM : C.RED);
}

/** A round badge above a structure for power trouble or a missing recipe. */
export function drawStatusBadge(ctx: Ctx, X: number, Y: number, kind: 'noPower' | 'blown' | 'noRecipe', time: number) {
  const pulse = kind === 'blown' ? 0.6 + 0.4 * Math.abs(Math.sin(time / 300)) : 1;
  ctx.globalAlpha *= pulse;
  ctx.fillStyle = kind === 'blown' ? C.RED : C.NAVY;
  ctx.strokeStyle = C.CREAM;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(X, Y, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (kind === 'noRecipe') {
    ctx.fillStyle = C.CREAM;
    ctx.font = 'bold 11px Archivo Variable, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', X, Y + 0.5);
  } else {
    ctx.fillStyle = kind === 'blown' ? C.CREAM : '#f2c94c';
    ctx.beginPath();
    ctx.moveTo(X + 1.5, Y - 6);
    ctx.lineTo(X - 3.5, Y + 1);
    ctx.lineTo(X - 0.3, Y + 1);
    ctx.lineTo(X - 1.5, Y + 6);
    ctx.lineTo(X + 3.5, Y - 1);
    ctx.lineTo(X + 0.3, Y - 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha /= pulse;
}

/** Ground point and height where a power line attaches to a structure (world pixels). */
export function lineAnchor(x: number, y: number, w: number, h: number, height: number): Pt {
  return [(x + w / 2 - (y + h / 2)) * HW, (x + w / 2 + y + h / 2) * HH - height];
}

export { line };
