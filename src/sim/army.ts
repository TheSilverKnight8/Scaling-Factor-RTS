import { UNITS, canHit } from './content/units';
import { PULSE_DAMAGE, PULSE_REACH, PULSE_TICKS } from './constants';
import { FP, isqrt } from './fmath';
import { findPath, lineClear } from './path';
import { cache, getPlayer, tileCenter, unitTile, walkable, type Belt, type MatchState, type Structure, type Unit } from './state';
import { linesOf } from './power';

// Units at work (SPEC "Unit behavior", "Combat"): following orders and imperatives, finding
// and hitting targets, structures and belts taking damage, the Hub's pulse, deaths and
// elimination. Everything is in whole numbers and goes in id order, so it is the same on
// every computer.

/** How far a unit's body reaches out from its center, for ranges against other units. */
const UNIT_RADIUS = Math.round(FP * 0.3);
/** Units look for new targets this often (ticks), staggered by id. */
const SCAN_TICKS = 5;
/** A chasing unit finds a new path this often at most (ticks). */
const REPATH_TICKS = 10;
/** Aggressive and patrolling units give up a chase this far beyond their sight (tiles). */
const LEASH = 4;
const GRID = 8; // tiles per cell of the lookup grid

type Target = { kind: 'unit'; u: Unit } | { kind: 'structure'; t: Structure } | { kind: 'belt'; b: Belt };

interface Lookup {
  cols: number;
  units: Unit[][];
  structures: Structure[][];
  unitById: Map<number, Unit>;
}

function buildLookup(s: MatchState): Lookup {
  const cols = Math.ceil(s.size / GRID);
  const units: Unit[][] = Array.from({ length: cols * cols }, () => []);
  const structures: Structure[][] = Array.from({ length: cols * cols }, () => []);
  const unitById = new Map<number, Unit>();
  for (const u of s.units) {
    if (u.hp <= 0) continue;
    unitById.set(u.id, u);
    const cx = Math.floor(u.x / FP / GRID);
    const cy = Math.floor(u.y / FP / GRID);
    units[cy * cols + cx].push(u);
  }
  for (const t of s.structures) {
    for (let cy = Math.floor(t.y / GRID); cy <= Math.floor((t.y + t.h - 1) / GRID); cy++)
      for (let cx = Math.floor(t.x / GRID); cx <= Math.floor((t.x + t.w - 1) / GRID); cx++) structures[cy * cols + cx].push(t);
  }
  return { cols, units, structures, unitById };
}

/** Distance from a point to a footprint rectangle (sub-units). */
function distToRect(x: number, y: number, rx: number, ry: number, rw: number, rh: number) {
  const x0 = rx * FP;
  const y0 = ry * FP;
  const x1 = (rx + rw) * FP;
  const y1 = (ry + rh) * FP;
  const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
  const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
  return isqrt(dx * dx + dy * dy);
}

function resolve(s: MatchState, look: Lookup, id: number): Target | null {
  if (!id) return null;
  const u = look.unitById.get(id);
  if (u) return { kind: 'unit', u };
  const c = cache(s);
  const t = c.structById.get(id);
  if (t && t.hp > 0) return { kind: 'structure', t };
  const b = c.beltById.get(id);
  if (b && b.hp > 0) return { kind: 'belt', b };
  return null;
}

const ownerOf = (t: Target) => (t.kind === 'unit' ? t.u.owner : t.kind === 'structure' ? t.t.owner : t.b.owner);

/** How far a unit is from a target's edge (sub-units). */
function reach(u: Unit, t: Target) {
  if (t.kind === 'unit') return Math.max(0, isqrt((t.u.x - u.x) ** 2 + (t.u.y - u.y) ** 2) - UNIT_RADIUS);
  if (t.kind === 'structure') return distToRect(u.x, u.y, t.t.x, t.t.y, t.t.w, t.t.h);
  return distToRect(u.x, u.y, t.b.x, t.b.y, 1, 1);
}

function canAttack(u: Unit, t: Target) {
  if (ownerOf(t) === u.owner) return false;
  return canHit(UNITS[u.kind], t.kind === 'unit' ? UNITS[t.u.kind].air : false);
}

/** The nearest enemy this unit can hit within `radius`: units first, then structures. Ties go to the lower id. */
function acquire(look: Lookup, u: Unit, radius: number): number {
  const r = radius + UNIT_RADIUS;
  const cx0 = Math.max(0, Math.floor((u.x - r) / FP / GRID));
  const cy0 = Math.max(0, Math.floor((u.y - r) / FP / GRID));
  const cx1 = Math.min(look.cols - 1, Math.floor((u.x + r) / FP / GRID));
  const cy1 = Math.min(look.cols - 1, Math.floor((u.y + r) / FP / GRID));
  const def = UNITS[u.kind];
  let best = 0;
  let bestD = Infinity;
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++)
      for (const o of look.units[cy * look.cols + cx]) {
        if (o.owner === u.owner || !canHit(def, UNITS[o.kind].air)) continue;
        const d = isqrt((o.x - u.x) ** 2 + (o.y - u.y) ** 2) - UNIT_RADIUS;
        if (d <= radius && (d < bestD || (d === bestD && o.id < best))) {
          bestD = d;
          best = o.id;
        }
      }
  if (best || !canHit(def, false)) return best;
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++)
      for (const t of look.structures[cy * look.cols + cx]) {
        if (t.owner === u.owner) continue;
        const d = distToRect(u.x, u.y, t.x, t.y, t.w, t.h);
        if (d <= radius && (d < bestD || (d === bestD && t.id < best))) {
          bestD = d;
          best = t.id;
        }
      }
  return best;
}

/** The tile a unit should walk to in order to hit the target. */
function approachTile(s: MatchState, u: Unit, t: Target): number {
  if (t.kind === 'unit') return unitTile(s, t.u);
  const [x0, y0, w, h] = t.kind === 'structure' ? [t.t.x, t.t.y, t.t.w, t.t.h] : [t.b.x, t.b.y, 1, 1];
  // The open tile next to the footprint nearest the unit.
  const ux = Math.floor(u.x / FP);
  const uy = Math.floor(u.y / FP);
  let best = -1;
  let bestD = Infinity;
  for (let y = y0 - 1; y <= y0 + h; y++)
    for (let x = x0 - 1; x <= x0 + w; x++) {
      if (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h) continue;
      if (x < 0 || y < 0 || x >= s.size || y >= s.size) continue;
      const i = y * s.size + x;
      if (!walkable(s, i)) continue;
      const d = (x - ux) ** 2 + (y - uy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  return best >= 0 ? best : y0 * s.size + x0;
}

function walkTo(s: MatchState, u: Unit, goal: number) {
  const here = unitTile(s, u);
  u.goal = goal;
  u.path = goal === here ? [] : lineClear(s, here, goal) && walkable(s, goal) ? [goal] : findPath(s, here, goal);
  u.pathStep = 0;
  u.pathVersion = s.blockVersion;
}

const idle = (u: Unit) => u.pathStep >= u.path.length;

/** One tick of thinking for a unit: what to fight, where to go, and hitting if it can. */
function think(s: MatchState, look: Lookup, u: Unit) {
  const def = UNITS[u.kind];
  if (u.cooldown > 0) u.cooldown--;
  const here = unitTile(s, u);

  // The player's orders come first.
  if (u.order?.kind === 'move') {
    if (!idle(u)) return; // a move order walks past enemies
    u.order = null;
  }
  let chase = false;
  let radius = def.range;
  if (u.order?.kind === 'attack') {
    const t = resolve(s, look, u.order.target);
    if (!t || !canAttack(u, t)) {
      u.order = null;
      u.target = 0;
    } else {
      u.target = u.order.target;
      chase = true;
    }
  }
  if (!u.order) {
    const imp = u.mode === 'auto' ? u.imperative : 'directed';
    if (imp === 'explore') {
      u.target = 0;
      explore(s, look, u);
      return;
    }
    chase = imp === 'aggressive' || imp === 'patrol';
    radius = chase ? def.sight * FP : def.range + FP / 2;
    // Drop a target that is gone or out of reach; look for a new one now and then.
    const cur = resolve(s, look, u.target);
    const leash = chase ? (def.sight + LEASH) * FP : def.range + FP / 2;
    if (!cur || !canAttack(u, cur) || reach(u, cur) > leash) u.target = 0;
    if (!u.target && def.attack !== 'none' && ((s.tick + u.id) % SCAN_TICKS === 0 || idle(u))) u.target = acquire(look, u, radius);
    if (!u.target) {
      // Nothing to fight: wait at home (Aggressive waits at the rally point, Caleb), walk the patrol, or stay put.
      if (imp === 'patrol' && u.patrol.length) {
        if (idle(u)) {
          const points = [u.home, ...u.patrol];
          u.patrolStep = (u.patrolStep + 1) % points.length;
          walkTo(s, u, points[u.patrolStep]);
        }
      } else if (imp !== 'directed' && here !== u.home && (idle(u) || u.goal !== u.home)) {
        walkTo(s, u, u.home);
      } else if (imp === 'directed' && u.chaseTile >= 0 && idle(u)) {
        u.chaseTile = -1;
      }
      return;
    }
  }

  const t = resolve(s, look, u.target);
  if (!t) return;
  if (reach(u, t) <= def.range) {
    // In reach: stop and hit.
    u.path = [];
    u.pathStep = 0;
    u.chaseTile = -1;
    const tx = t.kind === 'unit' ? t.u.x : t.kind === 'structure' ? (t.t.x + t.t.w / 2) * FP : tileCenter(t.b.x);
    const ty = t.kind === 'unit' ? t.u.y : t.kind === 'structure' ? (t.t.y + t.t.h / 2) * FP : tileCenter(t.b.y);
    if (tx !== u.x || ty !== u.y) {
      u.dirX = tx - u.x;
      u.dirY = ty - u.y;
    }
    if (u.cooldown === 0) {
      u.cooldown = def.cooldown;
      u.lastAttack = s.tick;
      if (t.kind === 'unit') {
        t.u.hp -= def.damage;
        t.u.lastHurt = s.tick;
      } else if (t.kind === 'structure') {
        t.t.hp -= def.damage;
        t.t.lastHurt = s.tick;
      } else t.b.hp -= def.damage;
    }
    return;
  }
  if (!chase) {
    u.target = 0;
    return;
  }
  // Out of reach: walk toward it, finding a new path only now and then.
  const goal = approachTile(s, u, t);
  if (goal !== u.chaseTile && ((s.tick + u.id) % REPATH_TICKS === 0 || idle(u))) {
    u.chaseTile = goal;
    walkTo(s, u, goal);
  }
}

/** Explore (SPEC): head for the nearest unexplored ground and avoid fights by heading home when enemies are near. */
function explore(s: MatchState, look: Lookup, u: Unit) {
  const def = UNITS[u.kind];
  const danger = acquireAny(look, u, def.sight * FP);
  if (danger) {
    if (u.goal !== u.home) walkTo(s, u, u.home);
    return;
  }
  if (!idle(u)) return;
  const p = getPlayer(s, u.owner);
  if (!p) return;
  const size = s.size;
  const start = unitTile(s, u);
  const seen = new Uint8Array(size * size);
  const queue = [start];
  seen[start] = 1;
  for (let qi = 0; qi < queue.length && qi < 20000; qi++) {
    const c = queue[qi];
    const x = c % size;
    const y = Math.floor(c / size);
    // A tile at the edge of the explored area.
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        if (!p.explored[ny * size + nx]) {
          walkTo(s, u, c);
          return;
        }
      }
    for (const [nx, ny] of [
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = ny * size + nx;
      if (seen[ni] || !walkable(s, ni)) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
}

/** Whether any enemy unit that can fight is within `radius`. */
function acquireAny(look: Lookup, u: Unit, radius: number): boolean {
  const cx0 = Math.max(0, Math.floor((u.x - radius) / FP / GRID));
  const cy0 = Math.max(0, Math.floor((u.y - radius) / FP / GRID));
  const cx1 = Math.min(look.cols - 1, Math.floor((u.x + radius) / FP / GRID));
  const cy1 = Math.min(look.cols - 1, Math.floor((u.y + radius) / FP / GRID));
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++)
      for (const o of look.units[cy * look.cols + cx]) {
        if (o.owner === u.owner || UNITS[o.kind].attack === 'none') continue;
        if (isqrt((o.x - u.x) ** 2 + (o.y - u.y) ** 2) <= radius) return true;
      }
  return false;
}

/** Every unit thinks (and hits) in id order; then the Hubs pulse. */
export function tickArmies(s: MatchState) {
  const look = buildLookup(s);
  for (const u of s.units) if (u.hp > 0) think(s, look, u);
  pulse(s, look);
}

/** The Hub's pulse (SPEC): low damage to every enemy unit near it, when there is one. */
function pulse(s: MatchState, look: Lookup) {
  for (const t of s.structures) {
    if (t.kind !== 'hub' || s.tick - t.lastPulse < PULSE_TICKS) continue;
    const r = PULSE_REACH * FP;
    const hit: Unit[] = [];
    const cx0 = Math.max(0, Math.floor((t.x * FP - r) / FP / GRID));
    const cy0 = Math.max(0, Math.floor((t.y * FP - r) / FP / GRID));
    const cx1 = Math.min(look.cols - 1, Math.floor(((t.x + t.w) * FP + r) / FP / GRID));
    const cy1 = Math.min(look.cols - 1, Math.floor(((t.y + t.h) * FP + r) / FP / GRID));
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++)
        for (const u of look.units[cy * look.cols + cx]) if (u.owner !== t.owner && u.hp > 0 && distToRect(u.x, u.y, t.x, t.y, t.w, t.h) <= r) hit.push(u);
    if (!hit.length) continue;
    t.lastPulse = s.tick;
    for (const u of hit) {
      u.hp -= PULSE_DAMAGE;
      u.lastHurt = s.tick;
    }
    s.events.push({ kind: 'pulse', hub: t.id });
  }
}

/** Removes what was destroyed this tick. A destroyed Hub puts its player out of the match (SPEC). */
export function removeDead(s: MatchState) {
  if (s.units.some((u) => u.hp <= 0)) {
    for (const u of s.units) if (u.hp <= 0) s.events.push({ kind: 'death', x: u.x, y: u.y, owner: u.owner });
    s.units = s.units.filter((u) => u.hp > 0);
  }
  const deadBelts = s.belts.filter((b) => b.hp <= 0);
  if (deadBelts.length) {
    for (const b of deadBelts) s.beltAt[b.y * s.size + b.x] = 0;
    s.belts = s.belts.filter((b) => b.hp > 0);
    s.transportVersion++;
    s.blockVersion++;
  }
  const dead = s.structures.filter((t) => t.hp <= 0);
  for (const t of dead) {
    destroyStructure(s, t);
    if (t.kind === 'hub') eliminate(s, t.owner);
  }
}

function destroyStructure(s: MatchState, t: Structure) {
  s.events.push({ kind: 'destroyed', x: t.x, y: t.y, w: t.w, h: t.h });
  const gone = new Set(linesOf(s, t.id).map((l) => l.id));
  if (gone.size) s.lines = s.lines.filter((l) => !gone.has(l.id));
  s.structures = s.structures.filter((o) => o.id !== t.id);
  for (let yy = t.y; yy < t.y + t.h; yy++) for (let xx = t.x; xx < t.x + t.w; xx++) if (s.occupied[yy * s.size + xx] === t.id) s.occupied[yy * s.size + xx] = 0;
  s.blockVersion++;
  s.powerVersion++;
}

/** A player whose Hub is destroyed is out, and everything they had is destroyed (SPEC). */
export function eliminate(s: MatchState, player: number) {
  const p = getPlayer(s, player);
  if (!p || p.eliminated) return;
  p.eliminated = true;
  p.queue = [];
  for (const u of s.units) if (u.owner === player) s.events.push({ kind: 'death', x: u.x, y: u.y, owner: u.owner });
  s.units = s.units.filter((u) => u.owner !== player);
  for (const t of s.structures.filter((o) => o.owner === player)) destroyStructure(s, t);
  for (const b of s.belts) if (b.owner === player) s.beltAt[b.y * s.size + b.x] = 0;
  s.belts = s.belts.filter((b) => b.owner !== player);
  s.lines = s.lines.filter((l) => l.owner !== player);
  s.transportVersion++;
  s.blockVersion++;
  s.powerVersion++;
  s.events.push({ kind: 'eliminated', player });
}

/** Closest two ground units stand, center to center (sub-units). */
const SPACING = Math.round(FP * 0.55);

/**
 * Units that stand too close push each other apart a little each tick, so crowds spread out
 * instead of piling onto one point. Pushes are worked out for every pair first, then applied,
 * so the order does not matter; a push never moves a unit onto blocked ground.
 */
export function separate(s: MatchState) {
  const cols = Math.ceil(s.size / GRID);
  const cells: Unit[][] = Array.from({ length: cols * cols }, () => []);
  for (const u of s.units) {
    if (UNITS[u.kind].air) continue;
    cells[Math.floor(u.y / FP / GRID) * cols + Math.floor(u.x / FP / GRID)].push(u);
  }
  const push = new Map<number, [number, number]>();
  const add = (u: Unit, dx: number, dy: number) => {
    const p = push.get(u.id);
    if (p) {
      p[0] += dx;
      p[1] += dy;
    } else push.set(u.id, [dx, dy]);
  };
  for (const u of s.units) {
    if (UNITS[u.kind].air) continue;
    const cx = Math.floor(u.x / FP / GRID);
    const cy = Math.floor(u.y / FP / GRID);
    for (let yy = Math.max(0, cy - 1); yy <= Math.min(cols - 1, cy + 1); yy++)
      for (let xx = Math.max(0, cx - 1); xx <= Math.min(cols - 1, cx + 1); xx++)
        for (const o of cells[yy * cols + xx]) {
          if (o.id <= u.id) continue; // each pair once
          const dx = o.x - u.x;
          const dy = o.y - u.y;
          if (Math.abs(dx) >= SPACING || Math.abs(dy) >= SPACING) continue;
          const d = isqrt(dx * dx + dy * dy);
          if (d >= SPACING) continue;
          const amount = Math.trunc((SPACING - d) / 4);
          // Two units on the very same spot split along a fixed direction.
          const [nx, ny] = d > 0 ? [Math.trunc((dx * amount) / d), Math.trunc((dy * amount) / d)] : [(u.id + o.id) % 2 ? amount : 0, (u.id + o.id) % 2 ? 0 : amount];
          add(u, -nx, -ny);
          add(o, nx, ny);
        }
  }
  for (const u of s.units) {
    const p = push.get(u.id);
    if (!p) continue;
    const nx = u.x + p[0];
    const ny = u.y + p[1];
    const tx = Math.floor(nx / FP);
    const ty = Math.floor(ny / FP);
    if (tx < 0 || ty < 0 || tx >= s.size || ty >= s.size) continue;
    if (!walkable(s, ty * s.size + tx) && ty * s.size + tx !== unitTile(s, u)) continue;
    u.x = nx;
    u.y = ny;
  }
}
