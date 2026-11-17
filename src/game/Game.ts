import { STRUCTURES, STRUCTURE_LIST, footprint, type StructureKind } from '../sim/content/structures';
import { UNITS } from '../sim/content/units';
import { PURITY_NAMES, RESOURCES } from '../sim/content/resources';
import type { Command } from '../sim/commands';
import { TICK_MS } from '../sim/constants';
import { FP } from '../sim/fmath';
import { createMatch, type MatchSetup } from '../sim/match';
import { canPlace, snapToNode } from '../sim/placement';
import type { MatchState } from '../sim/state';
import { step } from '../sim/step';
import { isoX, isoY, toTile } from '../render/iso';
import { STRUCTURE_HEIGHT, structureHull } from '../render/objects';
import { Renderer, type Ghost, type Marker } from '../render/renderer';
import { Camera } from './camera';

// Runs a match on this computer: steps the simulation at a fixed rate, draws it, and turns
// mouse and keyboard input into commands. Commands are applied at the start of the next tick.

/** Structures in the build menu, in order. Number keys 1-9 pick them. */
export const BUILD_MENU: StructureKind[] = STRUCTURE_LIST.filter((d) => d.atStart).map((d) => d.kind);

export type Selection = { kind: 'units'; ids: number[] } | { kind: 'structure'; id: number } | { kind: 'node'; id: number } | null;

export type SelectionInfo =
  | { kind: 'units'; count: number; groups: { name: string; count: number }[]; hp: number; maxHp: number }
  | { kind: 'structure'; id: number; name: string; blurb: string; hp: number; maxHp: number; mine: boolean; canDemolish: boolean }
  | { kind: 'node'; resource: string; purity: string; fluid: boolean };

export interface HudState {
  seconds: number;
  paused: boolean;
  menuOpen: boolean;
  zoomIndex: number;
  selection: SelectionInfo | null;
  build: { kind: StructureKind; rot: number } | null;
  /** Why the structure under the cursor cannot be placed. */
  placeError: string | null;
}

const PAN_SPEED = 950; // screen pixels per second
const DRAG_START = 5; // pixels before a press becomes a box selection

export class Game {
  readonly state: MatchState;
  readonly me = 1;
  readonly cam = new Camera();
  private renderer = new Renderer();
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private queue: Command[] = [];
  private raf = 0;
  private last = 0;
  private acc = 0;
  private dpr = 1;
  private keys = new Set<string>();
  private pointer = { x: 0, y: 0, inside: false };
  private press: { x: number; y: number; dragging: boolean; shift: boolean } | null = null;
  private markers: Marker[] = [];
  private cleanup: (() => void)[] = [];

  selection: Selection = null;
  build: { kind: StructureKind; rot: number } | null = null;
  paused = false;
  menuOpen = false;

  private hud: HudState;
  private hudKey = '';
  private listeners = new Set<() => void>();

  constructor(setup: MatchSetup) {
    this.state = createMatch(setup);
    this.hud = this.makeHud();
    this.centerOnHub();
  }

  // ------------------------------------------------------------- HUD store (React)

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getHud = () => this.hud;

  private refreshHud() {
    const next = this.makeHud();
    const key = JSON.stringify(next);
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.hud = next;
    this.listeners.forEach((fn) => fn());
  }

  private makeHud(): HudState {
    return {
      seconds: Math.floor((this.state.tick * TICK_MS) / 1000),
      paused: this.paused,
      menuOpen: this.menuOpen,
      zoomIndex: this.cam.zoomIndex,
      selection: this.selectionInfo(),
      build: this.build,
      placeError: this.ghost()?.error ?? null,
    };
  }

  private selectionInfo(): SelectionInfo | null {
    const s = this.state;
    const sel = this.selection;
    if (!sel) return null;
    if (sel.kind === 'units') {
      const units = s.units.filter((u) => sel.ids.includes(u.id));
      if (units.length === 0) return null;
      const counts = new Map<string, number>();
      for (const u of units) counts.set(UNITS[u.kind].name, (counts.get(UNITS[u.kind].name) ?? 0) + 1);
      return {
        kind: 'units',
        count: units.length,
        groups: [...counts].map(([name, count]) => ({ name, count })),
        hp: units.reduce((a, u) => a + u.hp, 0),
        maxHp: units.reduce((a, u) => a + UNITS[u.kind].hp, 0),
      };
    }
    if (sel.kind === 'structure') {
      const t = s.structures.find((x) => x.id === sel.id);
      if (!t) return null;
      const def = STRUCTURES[t.kind];
      return { kind: 'structure', id: t.id, name: def.name, blurb: def.blurb, hp: t.hp, maxHp: def.hp, mine: t.owner === this.me, canDemolish: t.owner === this.me && t.kind !== 'hub' };
    }
    const n = s.map.nodes[sel.id - 1];
    if (!n) return null;
    return { kind: 'node', resource: RESOURCES[n.resource].name, purity: PURITY_NAMES[n.purity], fluid: RESOURCES[n.resource].fluid };
  }

  // ------------------------------------------------------------- running

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cam.width = Math.max(1, r.width);
      this.cam.height = Math.max(1, r.height);
      canvas.width = Math.round(r.width * this.dpr);
      canvas.height = Math.round(r.height * this.dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    this.cleanup.push(() => ro.disconnect());

    const on = <K extends keyof WindowEventMap>(target: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void) => {
      target.addEventListener(type, fn as EventListener);
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener));
    };
    on(window, 'keydown', (e) => this.onKeyDown(e));
    on(window, 'keyup', (e) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());
    on(canvas, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    on(canvas, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    on(canvas, 'pointerup', (e) => this.onPointerUp(e as PointerEvent));
    on(canvas, 'pointerleave', () => {
      this.pointer.inside = false;
    });
    on(canvas, 'contextmenu', (e) => e.preventDefault());

    this.last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(frame);
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.canvas = null;
    this.ctx = null;
  }

  private frame(now: number) {
    const dt = Math.min(250, now - this.last);
    this.last = now;
    this.panFromKeys(dt);
    if (!this.paused) {
      this.acc += dt;
      while (this.acc >= TICK_MS) {
        const cmds = this.queue;
        this.queue = [];
        step(this.state, cmds);
        this.acc -= TICK_MS;
      }
    }
    this.cleanSelection();
    this.draw(now);
    this.refreshHud();
  }

  private draw(now: number) {
    if (!this.ctx) return;
    const g = this.ghost();
    const sel = this.selection;
    const hover = this.hoverTarget();
    this.markers = this.markers.filter((m) => now - m.at < 600);
    this.renderer.render(this.ctx, {
      state: this.state,
      me: this.me,
      cam: this.cam,
      dpr: this.dpr,
      alpha: this.paused ? 1 : Math.min(1, this.acc / TICK_MS),
      time: now,
      selectedUnits: new Set(sel?.kind === 'units' ? sel.ids : []),
      selectedStructure: sel?.kind === 'structure' ? sel.id : 0,
      selectedNode: sel?.kind === 'node' ? sel.id : 0,
      hoverStructure: !this.build && hover?.kind === 'structure' ? hover.id : 0,
      hoverNode: !this.build && hover?.kind === 'node' ? hover.id : 0,
      ghost: g?.ghost ?? null,
      drag: this.press?.dragging ? { x0: this.press.x, y0: this.press.y, x1: this.pointer.x, y1: this.pointer.y } : null,
      markers: this.markers,
    });
  }

  /** Units and structures that are gone drop out of the selection. */
  private cleanSelection() {
    const sel = this.selection;
    if (sel?.kind === 'units') {
      const ids = sel.ids.filter((id) => this.state.units.some((u) => u.id === id));
      if (ids.length !== sel.ids.length) this.selection = ids.length ? { kind: 'units', ids } : null;
    } else if (sel?.kind === 'structure' && !this.state.structures.some((t) => t.id === sel.id)) {
      this.selection = null;
    }
  }

  issue(cmd: Command) {
    this.queue.push(cmd);
  }

  // ------------------------------------------------------------- camera

  centerOnHub() {
    const me = this.state.players.find((p) => p.id === this.me);
    const hub = this.state.structures.find((t) => t.id === me?.hubId);
    if (!hub) return;
    this.cam.x = isoX(hub.x + hub.w / 2, hub.y + hub.h / 2);
    this.cam.y = isoY(hub.x + hub.w / 2, hub.y + hub.h / 2);
    this.cam.clamp(this.state.size);
  }

  zoomBy(step: number) {
    this.cam.setZoom(this.cam.zoomIndex + step);
    this.refreshHud();
  }

  private panFromKeys(dt: number) {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
    if (!dx && !dy) return;
    const d = (PAN_SPEED * dt) / 1000 / this.cam.zoom;
    const len = Math.hypot(dx, dy);
    this.cam.x += (dx / len) * d;
    this.cam.y += (dy / len) * d;
    this.cam.clamp(this.state.size);
  }

  // ------------------------------------------------------------- menu and pause

  setMenu(open: boolean) {
    this.menuOpen = open;
    // Single-player pauses while the menu is open (SPEC: pausing is allowed in single-player).
    this.paused = open;
    if (open) this.keys.clear();
    this.refreshHud();
  }

  // ------------------------------------------------------------- building

  startBuild(kind: StructureKind) {
    this.build = { kind, rot: this.build?.kind === kind ? this.build.rot : 0 };
    this.refreshHud();
  }

  cancelBuild() {
    this.build = null;
    this.refreshHud();
  }

  rotateBuild() {
    if (this.build) this.build = { ...this.build, rot: this.build.rot ^ 1 };
    this.refreshHud();
  }

  demolishSelected() {
    const sel = this.selection;
    if (sel?.kind !== 'structure') return;
    const t = this.state.structures.find((x) => x.id === sel.id);
    if (!t || t.owner !== this.me || t.kind === 'hub') return;
    this.issue({ type: 'demolish', player: this.me, id: t.id });
    this.selection = null;
  }

  /** The build preview under the cursor, and whether it can be placed there. */
  private ghost(): { ghost: Ghost; error: string | null } | null {
    if (!this.build || !this.pointer.inside) return null;
    const [tx, ty] = this.tileAt(this.pointer.x, this.pointer.y);
    const { kind, rot } = this.build;
    const { w, h } = footprint(kind, rot);
    let x = Math.floor(tx) - Math.floor((w - 1) / 2);
    let y = Math.floor(ty) - Math.floor((h - 1) / 2);
    const snap = snapToNode(this.state, kind, Math.floor(tx), Math.floor(ty));
    if (snap) {
      x = snap.x;
      y = snap.y;
    }
    const r = canPlace(this.state, this.me, kind, x, y, rot);
    return { ghost: { kind, x, y, w, h, rot, ok: r.ok }, error: r.ok ? null : r.reason };
  }

  // ------------------------------------------------------------- picking

  private tileAt(sx: number, sy: number): [number, number] {
    const [X, Y] = this.cam.toWorld(sx, sy);
    return toTile(X, Y);
  }

  /** What is under the cursor: a unit first, then a structure, then a node. */
  private pick(sx: number, sy: number): Selection {
    const s = this.state;
    const me = s.players.find((p) => p.id === this.me)!;
    const [X, Y] = this.cam.toWorld(sx, sy);
    const z = this.cam.zoom;
    let best = -1;
    let bestD = (16 / z) ** 2;
    for (const u of s.units) {
      if (!me.explored[Math.floor(u.y / FP) * s.size + Math.floor(u.x / FP)]) continue;
      const ux = isoX(u.x / FP, u.y / FP);
      const uy = isoY(u.x / FP, u.y / FP) - 13; // the figure's middle
      const d = (ux - X) ** 2 + ((uy - Y) * 0.8) ** 2;
      if (d < bestD) {
        bestD = d;
        best = u.id;
      }
    }
    if (best >= 0) return { kind: 'units', ids: [best] };

    // Front-most structure whose raised outline contains the point.
    const sorted = [...s.structures].sort((a, b) => b.x + b.y + (b.w + b.h) / 2 - (a.x + a.y + (a.w + a.h) / 2));
    for (const t of sorted) {
      if (!me.explored[t.y * s.size + t.x]) continue;
      if (pointInPolygon(X, Y, structureHull(t.x, t.y, t.w, t.h, STRUCTURE_HEIGHT[t.kind] ?? 24))) return { kind: 'structure', id: t.id };
    }
    const [tx, ty] = toTile(X, Y);
    const ix = Math.floor(tx);
    const iy = Math.floor(ty);
    if (ix >= 0 && iy >= 0 && ix < s.size && iy < s.size && me.explored[iy * s.size + ix]) {
      const n = s.nodeAt[iy * s.size + ix];
      if (n) return { kind: 'node', id: n };
    }
    return null;
  }

  private hoverTarget(): Selection {
    if (!this.pointer.inside || this.press?.dragging) return null;
    const p = this.pick(this.pointer.x, this.pointer.y);
    return p?.kind === 'units' ? null : p;
  }

  // ------------------------------------------------------------- input

  private onPointerDown(e: PointerEvent) {
    if (this.menuOpen) return;
    const r = this.canvas!.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    this.pointer = { x, y, inside: true };
    if (e.button === 2) {
      // Right button: cancel building, or order the selected units to the spot.
      if (this.build) {
        this.cancelBuild();
        return;
      }
      this.orderMove(x, y);
      return;
    }
    if (e.button !== 0) return;
    if (this.build) {
      const g = this.ghost();
      if (g?.ghost.ok) {
        this.issue({ type: 'build', player: this.me, kind: g.ghost.kind, x: g.ghost.x, y: g.ghost.y, rot: g.ghost.rot });
      }
      return;
    }
    this.canvas!.setPointerCapture(e.pointerId);
    this.press = { x, y, dragging: false, shift: e.shiftKey };
  }

  private onPointerMove(e: PointerEvent) {
    const r = this.canvas!.getBoundingClientRect();
    this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
    if (this.press && !this.press.dragging && Math.hypot(this.pointer.x - this.press.x, this.pointer.y - this.press.y) > DRAG_START) this.press.dragging = true;
  }

  private onPointerUp(e: PointerEvent) {
    if (e.button !== 0 || !this.press) return;
    const p = this.press;
    this.press = null;
    if (this.canvas?.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (p.dragging) this.boxSelect(p.x, p.y, this.pointer.x, this.pointer.y, p.shift);
    else this.clickSelect(p.x, p.y, p.shift);
    this.refreshHud();
  }

  private clickSelect(x: number, y: number, add: boolean) {
    const hit = this.pick(x, y);
    if (add && hit?.kind === 'units' && this.selection?.kind === 'units') {
      const id = hit.ids[0];
      const ids = this.selection.ids.includes(id) ? this.selection.ids.filter((i) => i !== id) : [...this.selection.ids, id];
      this.selection = ids.length ? { kind: 'units', ids } : null;
      return;
    }
    this.selection = hit;
  }

  /** Box selection picks the player's own units inside the box. */
  private boxSelect(x0: number, y0: number, x1: number, y1: number, add: boolean) {
    const lx = Math.min(x0, x1);
    const hx = Math.max(x0, x1);
    const ly = Math.min(y0, y1);
    const hy = Math.max(y0, y1);
    const ids: number[] = [];
    for (const u of this.state.units) {
      if (u.owner !== this.me) continue;
      const [sx, sy] = this.cam.toScreen(isoX(u.x / FP, u.y / FP), isoY(u.x / FP, u.y / FP) - 12 * 1);
      if (sx >= lx && sx <= hx && sy >= ly - 10 && sy <= hy + 10) ids.push(u.id);
    }
    if (add && this.selection?.kind === 'units') {
      const merged = [...new Set([...this.selection.ids, ...ids])];
      this.selection = merged.length ? { kind: 'units', ids: merged } : null;
    } else {
      this.selection = ids.length ? { kind: 'units', ids } : null;
    }
  }

  private orderMove(x: number, y: number) {
    const sel = this.selection;
    if (sel?.kind !== 'units') return;
    const ids = sel.ids.filter((id) => this.state.units.some((u) => u.id === id && u.owner === this.me));
    if (!ids.length) return;
    const [tx, ty] = this.tileAt(x, y);
    const ix = Math.floor(tx);
    const iy = Math.floor(ty);
    if (ix < 0 || iy < 0 || ix >= this.state.size || iy >= this.state.size) return;
    this.issue({ type: 'move', player: this.me, units: ids, tx: ix, ty: iy });
    this.markers.push({ x: ix, y: iy, at: performance.now() });
  }

  private onKeyDown(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (this.menuOpen) this.setMenu(false);
      else if (this.build) this.cancelBuild();
      else if (this.selection) {
        this.selection = null;
        this.refreshHud();
      } else this.setMenu(true);
      return;
    }
    if (this.menuOpen) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
      this.keys.add(e.code);
      return;
    }
    if (e.code === 'Equal' || e.code === 'NumpadAdd') return this.zoomBy(1);
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') return this.zoomBy(-1);
    if (e.code === 'KeyH') return this.centerOnHub();
    if (e.code === 'KeyR') return this.rotateBuild();
    if (e.code === 'Delete' || e.code === 'Backspace') {
      e.preventDefault();
      return this.demolishSelected();
    }
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit) {
      const kind = BUILD_MENU[Number(digit[1]) - 1];
      if (kind) this.startBuild(kind);
    }
  }
}

function pointInPolygon(x: number, y: number, pts: [number, number][]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
