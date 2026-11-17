import { STRUCTURES, footprint, type Cost, type StructureKind } from '../sim/content/structures';
import { IMPERATIVES, UNITS, UNIT_LIST, type Imperative, type UnitKind } from '../sim/content/units';
import { PURITY_NAMES, RESOURCES } from '../sim/content/resources';
import { ITEMS, ITEM_IDS, bagTotal, type ItemId } from '../sim/content/items';
import { RECIPES, RECIPE_LIST } from '../sim/content/recipes';
import { HUB_CAPACITY } from '../sim/content/economy';
import { POWER_LINE, TRANSPORT, type TransportKind } from '../sim/content/transport';
import { canPlaceBelt, newBeltCount, type BeltTile } from '../sim/belts';
import type { Command } from '../sim/commands';
import { TICK_MS, UNIT_LIMIT } from '../sim/constants';
import { giveRoom } from '../sim/economy';
import { FP } from '../sim/fmath';
import { createMatch, type MatchSetup } from '../sim/match';
import { canPlace, snapToNode } from '../sim/placement';
import { canConnect, linesOf } from '../sim/power';
import { cache, unitCountOf, type MatchState, type Player, type StructureStatus } from '../sim/state';
import { isProducer, rallyOf } from '../sim/production';
import { step } from '../sim/step';
import { BUTTON_ZOOM, MAX_ZOOM, MIN_ZOOM, isoX, isoY, toTile } from '../render/iso';
import { POLE_TOP, STRUCTURE_HEIGHT, structureHull, type Pt } from '../render/objects';
import { MinimapRenderer } from '../render/minimap';
import { Renderer, type BeltGhost, type Effect, type Ghost, type Marker } from '../render/renderer';
import { lineAnchor } from '../render/transport';
import { Camera } from './camera';

// Runs a match on this computer: steps the simulation at a fixed rate, draws it, and turns
// mouse and keyboard input into commands. Commands are applied at the start of the next tick.

export type ToolId = StructureKind | TransportKind | 'line' | 'placeUnit' | 'patrol';

export interface BuildEntry {
  id: ToolId;
  name: string;
  key: string;
  /** The key's code (KeyboardEvent.code). */
  code: string;
  group: 'Production' | 'Power' | 'Transport';
  cost: Cost;
  /** Shown after the cost, for things paid per tile. */
  costNote?: string;
  blurb: string;
}

const structureEntry = (kind: StructureKind, key: string, group: BuildEntry['group']): BuildEntry => ({
  id: kind,
  name: STRUCTURES[kind].name,
  key,
  code: /^\d$/.test(key) ? `Digit${key}` : `Key${key}`,
  group,
  cost: STRUCTURES[kind].cost,
  blurb: STRUCTURES[kind].blurb,
});

/** The build menu, in groups. Each has a key. */
export const BUILD_MENU: BuildEntry[] = [
  structureEntry('drill', '1', 'Production'),
  structureEntry('smelter', '2', 'Production'),
  structureEntry('constructor', '3', 'Production'),
  structureEntry('deployer', '4', 'Production'),
  structureEntry('depot', '5', 'Production'),
  structureEntry('laboratory', '6', 'Production'),
  structureEntry('solar', '7', 'Power'),
  structureEntry('powerPole', 'P', 'Power'),
  { id: 'line', name: POWER_LINE.name, key: 'L', code: 'KeyL', group: 'Power', cost: POWER_LINE.cost, costNote: 'each', blurb: POWER_LINE.blurb },
  { id: 'belt', name: TRANSPORT.belt.name, key: 'B', code: 'KeyB', group: 'Transport', cost: TRANSPORT.belt.cost, costNote: 'per tile', blurb: TRANSPORT.belt.blurb },
  { id: 'splitter', name: TRANSPORT.splitter.name, key: 'T', code: 'KeyT', group: 'Transport', cost: TRANSPORT.splitter.cost, blurb: TRANSPORT.splitter.blurb },
  { id: 'merger', name: TRANSPORT.merger.name, key: 'M', code: 'KeyM', group: 'Transport', cost: TRANSPORT.merger.cost, blurb: TRANSPORT.merger.blurb },
];

const isTransport = (id: ToolId): id is TransportKind => id === 'belt' || id === 'splitter' || id === 'merger';
const isStructureTool = (id: ToolId): id is StructureKind => !isTransport(id) && id !== 'line' && id !== 'placeUnit' && id !== 'patrol';

export interface Tool {
  id: ToolId;
  /** Quarter turns (structures), or the direction (splitters, mergers, a single belt tile). */
  rot: number;
  /** Belt: where the drag started. */
  dragFrom: { x: number; y: number } | null;
  /** Belt: go along y first instead of x first. */
  flip: boolean;
  /** Power line: the structure the line starts from. */
  lineFrom: number | null;
  /** Placing units by hand: which unit. */
  unit?: UnitKind;
  /** Setting patrol points: the structure, and the points so far (tile indices). */
  structure?: number;
  points?: number[];
}

export type Selection = { kind: 'units'; ids: number[] } | { kind: 'structure'; id: number } | { kind: 'node'; id: number } | { kind: 'belt'; id: number } | null;

export interface ItemCount {
  item: ItemId;
  name: string;
  count: number;
}

export type SelectionInfo =
  | { kind: 'units'; count: number; groups: { name: string; count: number }[]; hp: number; maxHp: number; mine: boolean; owner: string; behavior: string }
  | {
      kind: 'structure';
      id: number;
      structure: StructureKind;
      name: string;
      blurb: string;
      hp: number;
      maxHp: number;
      mine: boolean;
      isHub: boolean;
      canDemolish: boolean;
      building: { percent: number; secondsLeft: number } | null;
      status: StructureStatus;
      statusText: string;
      /** Smelter and Constructor: the recipes to choose from. */
      recipes: { id: string; name: string; text: string; selected: boolean }[] | null;
      /** What it holds, to move to the Hub by hand. */
      contents: ItemCount[];
      /** Ingredients it takes by hand from the Hub. */
      needs: { item: ItemId; name: string; have: number; inHub: number; room: number }[];
      power: { uses: number; makes: number; supply: number; demand: number; blown: boolean; lines: number; maxLines: number } | null;
      /** Deployer: what it makes and how its units act. */
      production: {
        produce: UnitKind | null;
        options: { kind: UnitKind; name: string; parts: string; seconds: number }[];
        percent: number;
        mode: 'auto' | 'directed';
        imperative: Imperative;
        patrolPoints: number;
      } | null;
      /** Hub: units that can be placed by hand, and how many are waiting. */
      place: { options: { kind: UnitKind; name: string; parts: string; seconds: number; affordable: boolean }[]; waiting: number; percent: number } | null;
      owner: string;
    }
  | { kind: 'node'; resource: string; purity: string; fluid: boolean; rate: string }
  | { kind: 'belt'; id: number; name: string; carrying: ItemCount[] };

export interface HudState {
  seconds: number;
  paused: boolean;
  menuOpen: boolean;
  /** Zoom in percent, and whether the buttons can zoom further. */
  zoomPercent: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  hub: { items: ItemCount[]; total: number; capacity: number };
  selection: SelectionInfo | null;
  tool: { id: ToolId; rot: number; lineFrom: boolean } | null;
  /** Why the thing under the cursor cannot be placed. */
  placeError: string | null;
  /** Which build menu entries the Hub can pay for now. */
  affordable: Partial<Record<ToolId, boolean>>;
  units: number;
  unitLimit: number;
  /** Short messages: a player out of the match. */
  notices: string[];
}

const STATUS_TEXT: Record<StructureStatus, string> = {
  building: 'Being built.',
  working: 'Working.',
  idle: 'Idle.',
  noRecipe: 'Choose a recipe.',
  noInput: 'Waiting for ingredients.',
  outputFull: 'Output full: take items out or connect a belt.',
  atLimit: 'Paused: you are at the unit limit.',
  noPower: 'No power: connect it to a generator with power lines.',
  blown: 'Grid blown: demand went over supply. Add power, then restart it.',
};

const PAN_SPEED = 950; // screen pixels per second
const DRAG_START = 5; // pixels before a press becomes a box selection
const DIR_X = [1, 0, -1, 0];
const DIR_Y = [0, 1, 0, -1];

/** Belt tiles from a to b: along x then y (or y then x), each tile facing the way items go. */
export function beltPath(ax: number, ay: number, bx: number, by: number, flip: boolean, single: number): BeltTile[] {
  if (ax === bx && ay === by) return [{ x: ax, y: ay, dir: single }];
  const tiles: BeltTile[] = [];
  const legs: [number, number][] = flip
    ? [
        [0, by - ay],
        [bx - ax, 0],
      ]
    : [
        [bx - ax, 0],
        [0, by - ay],
      ];
  let x = ax;
  let y = ay;
  for (const [dx, dy] of legs) {
    const n = Math.abs(dx) + Math.abs(dy);
    if (!n) continue;
    const dir = dx > 0 ? 0 : dx < 0 ? 2 : dy > 0 ? 1 : 3;
    for (let i = 0; i < n; i++) {
      tiles.push({ x, y, dir });
      x += DIR_X[dir];
      y += DIR_Y[dir];
    }
  }
  tiles.push({ x: bx, y: by, dir: tiles[tiles.length - 1].dir });
  return tiles;
}

function missing(p: Player, cost: Cost, times = 1): string | null {
  const short = cost.filter(([id, n]) => (p.hub[id] ?? 0) < n * times).map(([id, n]) => `${n * times - (p.hub[id] ?? 0)} ${ITEMS[id].name}`);
  return short.length ? `Need ${short.join(', ')} more in the Hub.` : null;
}

export class Game {
  readonly state: MatchState;
  readonly me = 1;
  readonly cam = new Camera();
  private renderer = new Renderer();
  private minimap = new MinimapRenderer();
  private minimapCanvas: HTMLCanvasElement | null = null;
  private minimapCtx: CanvasRenderingContext2D | null = null;
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
  private effects: Effect[] = [];
  private notices: { text: string; at: number }[] = [];
  /** When the zoom last changed (ms); pictures are remade at the exact zoom once it settles. */
  private zoomChangedAt = 0;
  private lastZoom = 0;
  private cleanup: (() => void)[] = [];

  selection: Selection = null;
  tool: Tool | null = null;
  paused = false;
  menuOpen = false;
  /** The build menu tab shown. */
  group: BuildEntry['group'] = 'Production';

  private hud: HudState;
  private hudKey = '';
  private hudAt = 0;
  private listeners = new Set<() => void>();

  constructor(setup: MatchSetup) {
    this.state = createMatch(setup);
    this.hud = this.makeHud();
    this.centerOnHub();
  }

  get player(): Player {
    return this.state.players.find((p) => p.id === this.me)!;
  }

  // ------------------------------------------------------------- HUD store (React)

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getHud = () => this.hud;

  /** Recomputes what the panels show: at once after an input, otherwise about 10 times a second. */
  private refreshHud(force = true) {
    const now = performance.now();
    if (!force && now - this.hudAt < 100) return;
    this.hudAt = now;
    const next = this.makeHud();
    const key = JSON.stringify(next);
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.hud = next;
    this.listeners.forEach((fn) => fn());
  }

  private makeHud(): HudState {
    const p = this.player;
    const affordable: Partial<Record<ToolId, boolean>> = {};
    for (const e of BUILD_MENU) affordable[e.id] = e.cost.every(([id, n]) => (p.hub[id] ?? 0) >= n);
    return {
      seconds: Math.floor((this.state.tick * TICK_MS) / 1000),
      paused: this.paused,
      menuOpen: this.menuOpen,
      zoomPercent: Math.round(this.cam.zoom * 100),
      canZoomIn: this.cam.zoom < MAX_ZOOM - 1e-6,
      canZoomOut: this.cam.zoom > MIN_ZOOM + 1e-6,
      hub: {
        items: ITEM_IDS.filter((id) => (p.hub[id] ?? 0) > 0).map((id) => ({ item: id, name: ITEMS[id].name, count: p.hub[id]! })),
        total: bagTotal(p.hub),
        capacity: HUB_CAPACITY,
      },
      selection: this.selectionInfo(),
      tool: this.tool ? { id: this.tool.id, rot: this.tool.rot, lineFrom: this.tool.lineFrom !== null } : null,
      placeError: this.preview()?.error ?? null,
      affordable,
      units: unitCountOf(this.state, this.me),
      unitLimit: UNIT_LIMIT,
      notices: this.notices.filter((n) => performance.now() - n.at < 6000).map((n) => n.text),
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
      const first = units[0];
      const imp = IMPERATIVES.find((i) => i.id === first.imperative)!;
      const same = units.every((u) => u.mode === first.mode && u.imperative === first.imperative);
      const behavior = !same ? 'Mixed orders.' : first.mode === 'directed' ? 'Directed: waits for your orders and fights back in reach.' : `On its own: ${imp.name}. ${imp.text}`;
      return {
        kind: 'units',
        count: units.length,
        groups: [...counts].map(([name, count]) => ({ name, count })),
        hp: units.reduce((a, u) => a + u.hp, 0),
        maxHp: units.reduce((a, u) => a + UNITS[u.kind].hp, 0),
        mine: first.owner === this.me,
        owner: s.players.find((p) => p.id === first.owner)?.name ?? '',
        behavior,
      };
    }
    if (sel.kind === 'belt') {
      const b = cache(s).beltById.get(sel.id);
      if (!b) return null;
      const counts = new Map<ItemId, number>();
      for (const it of b.items) counts.set(it.item, (counts.get(it.item) ?? 0) + 1);
      return { kind: 'belt', id: b.id, name: TRANSPORT[b.kind].name, carrying: [...counts].map(([item, count]) => ({ item, name: ITEMS[item].name, count })) };
    }
    if (sel.kind === 'structure') {
      const t = cache(s).structById.get(sel.id);
      if (!t) return null;
      const def = STRUCTURES[t.kind];
      const mine = t.owner === this.me;
      const building = t.buildLeft > 0 ? { percent: Math.floor((100 * (t.buildTotal - t.buildLeft)) / t.buildTotal), secondsLeft: Math.ceil((t.buildLeft * TICK_MS) / 1000) } : null;
      const isMachine = t.kind === 'smelter' || t.kind === 'constructor';
      const recipes = isMachine
        ? RECIPE_LIST.filter((r) => r.machine === t.kind && r.atStart).map((r) => ({
            id: r.id,
            name: r.name,
            text: `${r.inputs.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(' + ')} → ${r.outputs.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(' + ')} in ${r.seconds} s`,
            selected: t.recipe === r.id,
          }))
        : null;
      const contents: ItemCount[] = [];
      for (const id of ITEM_IDS) {
        const n = (t.inv[id] ?? 0) + (t.out[id] ?? 0);
        if (n > 0) contents.push({ item: id, name: ITEMS[id].name, count: n });
      }
      const p = this.player;
      const needs = isMachine && t.recipe ? RECIPES[t.recipe].inputs.map(([id]) => ({ item: id, name: ITEMS[id].name, have: t.inv[id] ?? 0, inHub: p.hub[id] ?? 0, room: giveRoom(t, id) })) : [];
      let power: Extract<SelectionInfo, { kind: 'structure' }>['power'] = null;
      if (def.maxLines > 0) {
        let supply = 0;
        let demand = 0;
        for (const o of s.structures) {
          if (o.grid !== t.grid) continue;
          const od = STRUCTURES[o.kind];
          if (od.powerOut > 0 && o.buildLeft === 0) supply += od.powerOut;
          if (o.status === 'working') demand += od.power;
        }
        power = { uses: def.power, makes: def.powerOut, supply, demand, blown: t.blown, lines: linesOf(s, t.id).length, maxLines: def.maxLines };
      }
      const production = isProducer(t)
        ? {
            produce: t.produce,
            options: UNIT_LIST.filter((d) => d.atStart && d.producedAt === t.kind).map((d) => ({ kind: d.kind, name: d.name, parts: d.parts.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(' + '), seconds: d.seconds })),
            percent: t.produce && t.progress > 0 ? Math.floor((100 * (UNITS[t.produce].seconds * 20 - t.progress)) / (UNITS[t.produce].seconds * 20)) : 0,
            mode: t.mode,
            imperative: t.imperative,
            patrolPoints: t.patrol.length,
          }
        : null;
      const queue = s.players.find((pl) => pl.id === t.owner)?.queue ?? [];
      const place =
        t.kind === 'hub' && mine
          ? {
              options: UNIT_LIST.filter((d) => d.atStart).map((d) => ({ kind: d.kind, name: d.name, parts: d.parts.map(([id, n]) => `${n} ${ITEMS[id].name}`).join(' + '), seconds: d.hubSeconds, affordable: d.parts.every(([id, n]) => (p.hub[id] ?? 0) >= n) })),
              waiting: queue.length,
              percent: queue.length && t.progress > 0 ? Math.floor((100 * (UNITS[queue[0].kind].hubSeconds * 20 - t.progress)) / (UNITS[queue[0].kind].hubSeconds * 20)) : 0,
            }
          : null;
      const producerNeeds = isProducer(t) && t.produce ? UNITS[t.produce].parts.map(([id]) => ({ item: id, name: ITEMS[id].name, have: t.inv[id] ?? 0, inHub: p.hub[id] ?? 0, room: giveRoom(t, id) })) : [];
      let statusText = STATUS_TEXT[t.status];
      if (isProducer(t) && t.status === 'noRecipe') statusText = 'Choose a unit to produce.';
      if (isProducer(t) && t.status === 'noInput') statusText = 'Waiting for parts (by belt, or Add from the Hub).';
      if (isProducer(t) && t.status === 'working') statusText = `Making a ${UNITS[t.produce!].name}.`;
      return {
        production,
        place,
        owner: s.players.find((pl) => pl.id === t.owner)?.name ?? '',
        kind: 'structure',
        id: t.id,
        structure: t.kind,
        name: def.name,
        blurb: def.blurb,
        hp: t.hp,
        maxHp: def.hp,
        mine,
        isHub: t.kind === 'hub',
        canDemolish: mine && t.kind !== 'hub',
        building,
        status: t.status,
        statusText,
        recipes,
        contents: t.kind === 'hub' ? [] : contents,
        needs: [...needs, ...producerNeeds],
        power,
      };
    }
    const n = s.map.nodes[sel.id - 1];
    if (!n) return null;
    const perMin = [30, 60, 120][n.purity];
    return { kind: 'node', resource: RESOURCES[n.resource].name, purity: PURITY_NAMES[n.purity], fluid: RESOURCES[n.resource].fluid, rate: `${perMin} a minute with a ${RESOURCES[n.resource].fluid ? 'Pump' : 'Drill'}` };
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

    const on = <K extends keyof WindowEventMap>(target: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, opts));
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
    // Wheel and pinch over the whole match screen (the map and the panels on it).
    on(canvas.parentElement ?? canvas, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });

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
        this.collectEvents(now);
        this.acc -= TICK_MS;
      }
    }
    this.cleanSelection();
    this.draw(now);
    this.drawMinimap();
    this.refreshHud(false);
  }

  /** Turns what happened in the last tick into effects to draw and notices to show. */
  private collectEvents(now: number) {
    const s = this.state;
    for (const e of s.events) {
      if (e.kind === 'death') this.effects.push({ kind: 'death', x: e.x / FP, y: e.y / FP, w: 0, h: 0, at: now });
      else if (e.kind === 'destroyed') this.effects.push({ kind: 'destroyed', x: e.x, y: e.y, w: e.w, h: e.h, at: now });
      else if (e.kind === 'pulse') this.effects.push({ kind: 'pulse', x: 0, y: 0, w: 0, h: 0, hub: e.hub, at: now });
      else if (e.kind === 'eliminated') {
        const p = s.players.find((pl) => pl.id === e.player);
        this.notices.push({ text: e.player === this.me ? 'Your Hub was destroyed: you are out of the match.' : `${p?.name ?? 'A player'} is out of the match.`, at: now });
        this.refreshHud();
      }
    }
  }

  private draw(now: number) {
    if (!this.ctx) return;
    const pv = this.preview();
    const sel = this.selection;
    const hover = this.hoverTarget();
    this.markers = this.markers.filter((m) => now - m.at < 600);
    this.effects = this.effects.filter((e) => now - e.at < 1000);
    // The selected structure's rally point (and patrol points), and where hand-placed units are headed.
    let rally: { from: number; tile: number; patrol: number[] } | null = null;
    const picked = sel?.kind === 'structure' ? cache(this.state).structById.get(sel.id) : this.tool?.structure ? cache(this.state).structById.get(this.tool.structure) : undefined;
    if (picked && picked.owner === this.me && isProducer(picked)) rally = { from: picked.id, tile: rallyOf(this.state, picked), patrol: picked.patrol };
    const placed = [...this.player.queue.map((q) => q.tile), ...this.state.units.filter((u) => u.owner === this.me && u.mode === 'auto' && u.imperative === 'hold' && !u.source && u.pathStep < u.path.length).map((u) => u.home)];
    if (this.cam.zoom !== this.lastZoom) {
      this.lastZoom = this.cam.zoom;
      this.zoomChangedAt = now;
    }
    const picking = !this.tool || this.tool.id === 'line';
    this.renderer.render(this.ctx, {
      state: this.state,
      me: this.me,
      cam: this.cam,
      dpr: this.dpr,
      alpha: this.paused ? 1 : Math.min(1, this.acc / TICK_MS),
      zoomSettled: now - this.zoomChangedAt > 200,
      time: now,
      selectedUnits: new Set(sel?.kind === 'units' ? sel.ids : []),
      selectedStructure: sel?.kind === 'structure' ? sel.id : this.tool?.lineFrom ?? 0,
      selectedNode: sel?.kind === 'node' ? sel.id : 0,
      selectedBelt: sel?.kind === 'belt' ? sel.id : 0,
      hoverStructure: picking && hover?.kind === 'structure' ? hover.id : 0,
      hoverNode: !this.tool && hover?.kind === 'node' ? hover.id : 0,
      ghost: pv?.ghost ?? null,
      beltGhost: pv?.belts ?? null,
      lineGhost: pv?.line ?? null,
      showPorts: !!this.tool && isStructureTool(this.tool.id),
      effects: this.effects,
      rally,
      placed,
      patrolDraft: this.tool?.id === 'patrol' ? (this.tool.points ?? []) : null,
      drag: this.press?.dragging ? { x0: this.press.x, y0: this.press.y, x1: this.pointer.x, y1: this.pointer.y } : null,
      markers: this.markers,
    });
  }

  // ------------------------------------------------------------- minimap

  attachMinimap(canvas: HTMLCanvasElement | null) {
    this.minimapCanvas = canvas;
    this.minimapCtx = canvas?.getContext('2d') ?? null;
  }

  private drawMinimap() {
    const c = this.minimapCanvas;
    if (!c || !this.minimapCtx) return;
    const r = c.getBoundingClientRect();
    const W = Math.round(r.width * this.dpr);
    const H = Math.round(r.height * this.dpr);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    this.minimap.draw(this.minimapCtx, this.state, this.me, this.cam, W, H);
  }

  /** Centers the main view on the point under (px, py) of the minimap (CSS pixels, minimap w x h). */
  lookAtMinimap(px: number, py: number, w: number, h: number) {
    const [X, Y] = MinimapRenderer.toWorld(px, py, w, h, this.state.size);
    this.cam.x = X;
    this.cam.y = Y;
    this.cam.clamp(this.state.size);
  }

  /** Units, structures and belts that are gone drop out of the selection. */
  private cleanSelection() {
    const sel = this.selection;
    const c = cache(this.state);
    if (sel?.kind === 'units') {
      const ids = sel.ids.filter((id) => this.state.units.some((u) => u.id === id));
      if (ids.length !== sel.ids.length) this.selection = ids.length ? { kind: 'units', ids } : null;
    } else if (sel?.kind === 'structure' && !c.structById.has(sel.id)) {
      this.selection = null;
    } else if (sel?.kind === 'belt' && !c.beltById.has(sel.id)) {
      this.selection = null;
    }
    if (this.tool?.lineFrom && !c.structById.has(this.tool.lineFrom)) this.tool.lineFrom = null;
  }

  issue(cmd: Command) {
    this.queue.push(cmd);
  }

  // ------------------------------------------------------------- camera

  centerOnHub() {
    const hub = this.state.structures.find((t) => t.id === this.player.hubId);
    if (!hub) return;
    this.cam.x = isoX(hub.x + hub.w / 2, hub.y + hub.h / 2);
    this.cam.y = isoY(hub.x + hub.w / 2, hub.y + hub.h / 2);
    this.cam.clamp(this.state.size);
  }

  /** The zoom buttons and the + and - keys: one step, about the screen's center. */
  zoomStep(dir: 1 | -1) {
    this.cam.zoomAt(dir > 0 ? BUTTON_ZOOM : 1 / BUTTON_ZOOM, this.cam.width / 2, this.cam.height / 2);
    this.cam.clamp(this.state.size);
    this.refreshHud();
  }

  /**
   * Mouse wheel and trackpad pinch: smooth zoom toward the pointer. Chrome reports a trackpad
   * pinch as a wheel event with ctrlKey set and small steps; a mouse wheel notch is about 100.
   */
  private onWheel(e: WheelEvent) {
    e.preventDefault(); // also stops the browser zooming the whole page on a pinch
    if (this.menuOpen || !this.canvas) return;
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= this.cam.height;
    const factor = Math.max(0.5, Math.min(2, Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0015))));
    const r = this.canvas.getBoundingClientRect();
    this.cam.zoomAt(factor, e.clientX - r.left, e.clientY - r.top);
    this.cam.clamp(this.state.size);
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

  setGroup(group: BuildEntry['group']) {
    this.group = group;
    this.refreshHud();
  }

  // ------------------------------------------------------------- tools

  startTool(id: ToolId) {
    const keep = this.tool?.id === id ? this.tool.rot : 0;
    this.tool = { id, rot: keep, dragFrom: null, flip: false, lineFrom: null };
    const entry = BUILD_MENU.find((e) => e.id === id);
    if (entry) this.group = entry.group;
    // Starting a power line from the selected structure.
    if (id === 'line' && this.selection?.kind === 'structure') {
      const t = cache(this.state).structById.get(this.selection.id);
      if (t && t.owner === this.me && STRUCTURES[t.kind].maxLines > 0) this.tool.lineFrom = t.id;
    }
    this.refreshHud();
  }

  cancelTool() {
    this.tool = null;
    this.refreshHud();
  }

  /** R: turns a structure, splitter, merger or single belt tile; while dragging a belt, changes which way it bends. */
  rotateTool() {
    const t = this.tool;
    if (!t) return;
    if (t.id === 'belt' && t.dragFrom) t.flip = !t.flip;
    else t.rot = (t.rot + 1) % 4;
    this.refreshHud();
  }

  /** The preview of what the current tool would place under the pointer. */
  private preview(): { ghost?: Ghost; belts?: BeltGhost; line?: { a: Pt; b: Pt; ok: boolean }; error: string | null } | null {
    const t = this.tool;
    if (!t || !this.pointer.inside) return null;
    const s = this.state;
    const p = this.player;
    const [fx, fy] = this.tileAt(this.pointer.x, this.pointer.y);
    const tx = Math.floor(fx);
    const ty = Math.floor(fy);
    if (isStructureTool(t.id)) {
      const kind = t.id;
      const { w, h } = footprint(kind, t.rot);
      let x = tx - Math.floor((w - 1) / 2);
      let y = ty - Math.floor((h - 1) / 2);
      const snap = snapToNode(s, kind, tx, ty);
      if (snap) {
        x = snap.x;
        y = snap.y;
      }
      const r = canPlace(s, this.me, kind, x, y, t.rot);
      const lack = r.ok ? missing(p, STRUCTURES[kind].cost) : null;
      return { ghost: { kind, x, y, w, h, rot: t.rot, ok: r.ok && !lack }, error: r.ok ? lack : r.reason };
    }
    if (isTransport(t.id)) {
      const tiles = t.id === 'belt' && t.dragFrom ? beltPath(t.dragFrom.x, t.dragFrom.y, tx, ty, t.flip, t.rot) : [{ x: tx, y: ty, dir: t.rot }];
      let error: string | null = null;
      const ghost = tiles.map((b) => {
        const r = canPlaceBelt(s, this.me, t.id as TransportKind, b.x, b.y);
        if (!r.ok && !error) error = r.reason;
        return { ...b, ok: r.ok };
      });
      if (!error) error = missing(p, TRANSPORT[t.id].cost, newBeltCount(s, tiles));
      return { belts: { kind: t.id, tiles: ghost }, error };
    }
    if (t.id === 'placeUnit') return { error: t.unit ? missing(p, UNITS[t.unit].parts) : null };
    if (t.id === 'patrol') return { error: null };
    // Power line.
    const hit = this.pick(this.pointer.x, this.pointer.y);
    const target = hit?.kind === 'structure' ? cache(s).structById.get(hit.id) : undefined;
    if (t.lineFrom === null) return { error: target && STRUCTURES[target.kind].maxLines === 0 ? `The ${STRUCTURES[target.kind].name} takes no power lines.` : null };
    const from = cache(s).structById.get(t.lineFrom);
    if (!from) return null;
    const a = this.anchor(from.id)!;
    if (!target || target.id === from.id) {
      const [X, Y] = this.cam.toWorld(this.pointer.x, this.pointer.y);
      return { line: { a, b: [X, Y], ok: true }, error: null };
    }
    const r = canConnect(s, this.me, from, target);
    const lack = r.ok ? missing(p, POWER_LINE.cost) : null;
    return { line: { a, b: this.anchor(target.id)!, ok: r.ok && !lack }, error: r.ok ? lack : r.reason };
  }

  private anchor(id: number): Pt | null {
    const t = cache(this.state).structById.get(id);
    if (!t) return null;
    const height = t.kind === 'powerPole' ? POLE_TOP : Math.round((STRUCTURE_HEIGHT[t.kind] ?? 24) * 0.75);
    return lineAnchor(t.x, t.y, t.w, t.h, height);
  }

  // ------------------------------------------------------------- actions from the panels

  demolishSelected() {
    const sel = this.selection;
    if (sel?.kind === 'belt') {
      this.issue({ type: 'removeBelts', player: this.me, ids: [sel.id] });
      this.selection = null;
      return;
    }
    if (sel?.kind !== 'structure') return;
    const t = cache(this.state).structById.get(sel.id);
    if (!t || t.owner !== this.me || t.kind === 'hub') return;
    this.issue({ type: 'demolish', player: this.me, id: t.id });
    this.selection = null;
  }

  takeItem(item: ItemId) {
    if (this.selection?.kind === 'structure') this.issue({ type: 'take', player: this.me, id: this.selection.id, item });
  }

  giveItem(item: ItemId) {
    if (this.selection?.kind === 'structure') this.issue({ type: 'give', player: this.me, id: this.selection.id, item });
  }

  chooseRecipe(recipe: string | null) {
    if (this.selection?.kind === 'structure') this.issue({ type: 'recipe', player: this.me, id: this.selection.id, recipe });
  }

  restartGrid() {
    if (this.selection?.kind === 'structure') this.issue({ type: 'restart', player: this.me, id: this.selection.id });
  }

  removeLines() {
    if (this.selection?.kind === 'structure') this.issue({ type: 'removeLines', player: this.me, id: this.selection.id });
  }

  setProduce(unit: UnitKind | null) {
    if (this.selection?.kind === 'structure') this.issue({ type: 'produce', player: this.me, id: this.selection.id, unit });
  }

  setUnitMode(mode: 'auto' | 'directed', imperative: Imperative) {
    if (this.selection?.kind === 'structure') this.issue({ type: 'mode', player: this.me, id: this.selection.id, mode, imperative });
  }

  /** Placing units by hand (SPEC): pick a unit, then click the map where it should go. */
  startPlaceUnit(unit: UnitKind) {
    this.tool = { id: 'placeUnit', rot: 0, dragFrom: null, flip: false, lineFrom: null, unit };
    this.refreshHud();
  }

  /** Setting patrol points for the selected production structure: click points, right click or Enter to finish. */
  startPatrol() {
    if (this.selection?.kind !== 'structure') return;
    this.tool = { id: 'patrol', rot: 0, dragFrom: null, flip: false, lineFrom: null, structure: this.selection.id, points: [] };
    this.refreshHud();
  }

  private finishPatrol() {
    const t = this.tool;
    if (t?.id === 'patrol' && t.structure) this.issue({ type: 'patrol', player: this.me, id: t.structure, points: t.points ?? [] });
    this.tool = null;
    this.refreshHud();
  }

  // ------------------------------------------------------------- picking

  private tileAt(sx: number, sy: number): [number, number] {
    const [X, Y] = this.cam.toWorld(sx, sy);
    return toTile(X, Y);
  }

  /** What is under the cursor: a unit first, then a structure, then a belt, then a node. */
  private pick(sx: number, sy: number): Selection {
    const s = this.state;
    const me = this.player;
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
      const b = s.beltAt[iy * s.size + ix];
      if (b) return { kind: 'belt', id: b };
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
      // Right button: finish patrol points, stop building, or give an order.
      if (this.tool?.id === 'patrol') return this.finishPatrol();
      if (this.tool) {
        this.cancelTool();
        return;
      }
      this.orderRight(x, y);
      return;
    }
    if (e.button !== 0) return;
    const t = this.tool;
    if (t) {
      if (t.id === 'belt') {
        const [fx, fy] = this.tileAt(x, y);
        t.dragFrom = { x: Math.floor(fx), y: Math.floor(fy) };
        t.flip = false;
        this.canvas!.setPointerCapture(e.pointerId);
      } else if (t.id === 'line') {
        this.clickLine(x, y);
      } else if (t.id === 'placeUnit' || t.id === 'patrol') {
        const [fx, fy] = this.tileAt(x, y);
        const tx = Math.floor(fx);
        const ty = Math.floor(fy);
        if (tx >= 0 && ty >= 0 && tx < this.state.size && ty < this.state.size) {
          if (t.id === 'placeUnit' && t.unit) {
            this.issue({ type: 'placeUnit', player: this.me, kind: t.unit, x: tx, y: ty });
            this.markers.push({ x: tx, y: ty, at: performance.now() });
          } else if (t.points && t.points.length < 8) t.points.push(ty * this.state.size + tx);
        }
      } else {
        const pv = this.preview();
        if (pv?.ghost?.ok) this.issue({ type: 'build', player: this.me, kind: pv.ghost.kind, x: pv.ghost.x, y: pv.ghost.y, rot: pv.ghost.rot });
        else if (pv?.belts && pv.error === null) this.issue({ type: 'belts', player: this.me, kind: pv.belts.kind, tiles: pv.belts.tiles.map(({ x: bx, y: by, dir }) => ({ x: bx, y: by, dir })) });
      }
      this.refreshHud();
      return;
    }
    this.canvas!.setPointerCapture(e.pointerId);
    this.press = { x, y, dragging: false, shift: e.shiftKey };
  }

  private clickLine(x: number, y: number) {
    const t = this.tool!;
    const hit = this.pick(x, y);
    const target = hit?.kind === 'structure' ? cache(this.state).structById.get(hit.id) : undefined;
    if (!target || target.owner !== this.me || STRUCTURES[target.kind].maxLines === 0) return;
    if (t.lineFrom === null || t.lineFrom === target.id) {
      t.lineFrom = target.id;
      return;
    }
    const pv = this.preview();
    if (pv?.line?.ok) {
      this.issue({ type: 'line', player: this.me, a: t.lineFrom, b: target.id });
      // Carry on from the structure just connected, as when stringing poles.
      t.lineFrom = target.id;
    }
  }

  private onPointerMove(e: PointerEvent) {
    const r = this.canvas!.getBoundingClientRect();
    this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
    if (this.press && !this.press.dragging && Math.hypot(this.pointer.x - this.press.x, this.pointer.y - this.press.y) > DRAG_START) this.press.dragging = true;
  }

  private onPointerUp(e: PointerEvent) {
    if (e.button !== 0) return;
    if (this.canvas?.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    const t = this.tool;
    if (t?.id === 'belt' && t.dragFrom) {
      const pv = this.preview();
      if (pv?.belts && pv.error === null) this.issue({ type: 'belts', player: this.me, kind: 'belt', tiles: pv.belts.tiles.map(({ x, y, dir }) => ({ x, y, dir })) });
      // A single tile keeps facing the way of the last line, so the next one continues it.
      if (pv?.belts?.tiles.length) t.rot = pv.belts.tiles[pv.belts.tiles.length - 1].dir;
      t.dragFrom = null;
      this.refreshHud();
      return;
    }
    if (!this.press) return;
    const p = this.press;
    this.press = null;
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
      const [sx, sy] = this.cam.toScreen(isoX(u.x / FP, u.y / FP), isoY(u.x / FP, u.y / FP) - 12);
      if (sx >= lx && sx <= hx && sy >= ly - 10 && sy <= hy + 10) ids.push(u.id);
    }
    if (add && this.selection?.kind === 'units') {
      const merged = [...new Set([...this.selection.ids, ...ids])];
      this.selection = merged.length ? { kind: 'units', ids: merged } : null;
    } else {
      this.selection = ids.length ? { kind: 'units', ids } : null;
    }
  }

  /**
   * Right click: with units selected, attack the enemy under the pointer or move there; with a
   * production structure selected, set its rally point.
   */
  private orderRight(x: number, y: number) {
    const sel = this.selection;
    if (sel?.kind === 'structure') {
      const t = cache(this.state).structById.get(sel.id);
      if (!t || t.owner !== this.me || !isProducer(t)) return;
      const [fx, fy] = this.tileAt(x, y);
      const tx = Math.floor(fx);
      const ty = Math.floor(fy);
      if (tx < 0 || ty < 0 || tx >= this.state.size || ty >= this.state.size) return;
      this.issue({ type: 'rally', player: this.me, id: t.id, x: tx, y: ty });
      this.markers.push({ x: tx, y: ty, at: performance.now() });
      return;
    }
    if (sel?.kind !== 'units') return;
    const ids = sel.ids.filter((id) => this.state.units.some((u) => u.id === id && u.owner === this.me));
    if (!ids.length) return;
    // An enemy under the pointer: attack it.
    const hit = this.pick(x, y);
    const c = cache(this.state);
    let target = 0;
    let owner = this.me;
    if (hit?.kind === 'units') {
      const u = this.state.units.find((o) => o.id === hit.ids[0]);
      if (u) [target, owner] = [u.id, u.owner];
    } else if (hit?.kind === 'structure') {
      const t = c.structById.get(hit.id);
      if (t) [target, owner] = [t.id, t.owner];
    } else if (hit?.kind === 'belt') {
      const b = c.beltById.get(hit.id);
      if (b) [target, owner] = [b.id, b.owner];
    }
    if (target && owner !== this.me) {
      this.issue({ type: 'attack', player: this.me, units: ids, target });
      const [fx, fy] = this.tileAt(x, y);
      this.markers.push({ x: Math.floor(fx), y: Math.floor(fy), at: performance.now(), kind: 'attack' });
      return;
    }
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
      else if (this.tool) this.cancelTool();
      else if (this.selection) {
        this.selection = null;
        this.refreshHud();
      } else this.setMenu(true);
      return;
    }
    if (this.menuOpen) return;
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && this.tool?.id === 'patrol') return this.finishPatrol();
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
      this.keys.add(e.code);
      return;
    }
    if (e.code === 'Equal' || e.code === 'NumpadAdd') return this.zoomStep(1);
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') return this.zoomStep(-1);
    if (e.code === 'KeyH') return this.centerOnHub();
    if (e.code === 'KeyR') return this.rotateTool();
    if (e.code === 'Delete' || e.code === 'Backspace') {
      e.preventDefault();
      return this.demolishSelected();
    }
    const entry = BUILD_MENU.find((b) => b.code === e.code);
    if (entry) {
      if (this.tool?.id === entry.id) this.cancelTool();
      else this.startTool(entry.id);
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
