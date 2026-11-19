import { DRILL_TICKS } from './content/economy';
import { RESOURCE_ITEM } from './content/items';
import { RESOURCES } from './content/resources';
import { FP, isqrt } from './fmath';
import { structureAccepts } from './flow';
import { findPath, lineClear } from './path';
import { cache, getPlayer, unitTile, walkable, type HaulRoute, type MatchState, type Structure, type Unit } from './state';

// Haulers (SPEC "Units": a gatherer unit that carries resources from a node to the target
// building, no belts needed). A Hauler drives to its node, loads there at the node's rate, drives
// to its building and unloads into it, and goes round again. Its route is set at the Garage that
// made it, or given to the Hauler itself (Caleb: both). Haulers gather only at solid nodes with
// no Drill on them (Caleb), one at a time per node, and never deliver to the Hub (SPEC).

/** Items a Hauler carries at a time. */
export const HAUL_CAPACITY = 30;

const isHauler = (u: Unit) => u.kind === 'hauler';

/** Whether a node can be worked by Haulers: a solid node with nothing built on it. */
export function haulNodeOk(s: MatchState, nodeId: number): boolean {
  const n = s.map.nodes[nodeId - 1];
  if (!n || RESOURCES[n.resource].fluid) return false;
  return s.occupied[n.y * s.size + n.x] === 0;
}

/** Whether a structure can be a Hauler's target: the player's own, and not the Hub (SPEC). */
export function haulTargetOk(s: MatchState, player: number, id: number): boolean {
  const t = cache(s).structById.get(id);
  return !!t && t.owner === player && t.kind !== 'hub' && t.kind !== 'powerPole';
}

/** Sets the route of the player's selected Haulers (Caleb: Haulers can be given their own). Either part may be left as it was. */
export function setHaulRoute(s: MatchState, player: number, ids: number[], node: number | undefined, target: number | undefined) {
  if (node !== undefined && !haulNodeOk(s, node)) return;
  if (target !== undefined && !haulTargetOk(s, player, target)) return;
  const wanted = new Set(ids);
  for (const u of s.units) {
    if (u.owner !== player || !wanted.has(u.id) || !isHauler(u)) continue;
    u.haul = { node: node ?? u.haul?.node ?? 0, target: target ?? u.haul?.target ?? 0 };
    // Its own route from now on: changes at the Garage no longer apply to it.
    u.source = 0;
    u.order = null;
    u.mode = 'auto';
    if (node !== undefined) u.haulState = u.carry > 0 && u.carry >= HAUL_CAPACITY ? 1 : 0;
  }
}

/** Sets a Garage's route, for the Haulers it makes and those it made that still follow it (Caleb). */
export function setGarageRoute(s: MatchState, player: number, id: number, node: number | undefined, target: number | undefined) {
  const t = cache(s).structById.get(id);
  if (!t || t.owner !== player || t.kind !== 'garage') return;
  if (node !== undefined && !haulNodeOk(s, node)) return;
  if (target !== undefined && !haulTargetOk(s, player, target)) return;
  t.haul = { node: node ?? t.haul?.node ?? 0, target: target ?? t.haul?.target ?? 0 };
  for (const u of s.units) if (u.source === t.id && isHauler(u)) u.haul = { ...t.haul };
}

/** The tile a Hauler drives to at its node: the node's corner tile, or the nearest open one. */
function nodeTile(s: MatchState, nodeId: number) {
  const n = s.map.nodes[nodeId - 1];
  return n.y * s.size + n.x;
}

/** Whether a Hauler is at its node (on it or next to it). */
function atNode(s: MatchState, u: Unit, nodeId: number) {
  const n = s.map.nodes[nodeId - 1];
  const tx = Math.floor(u.x / FP);
  const ty = Math.floor(u.y / FP);
  return tx >= n.x - 1 && tx <= n.x + 2 && ty >= n.y - 1 && ty <= n.y + 2;
}

/** Distance from a unit to a structure's edge (sub-units). */
function distTo(u: Unit, t: Structure) {
  const x0 = t.x * FP;
  const y0 = t.y * FP;
  const x1 = (t.x + t.w) * FP;
  const y1 = (t.y + t.h) * FP;
  const dx = u.x < x0 ? x0 - u.x : u.x > x1 ? u.x - x1 : 0;
  const dy = u.y < y0 ? y0 - u.y : u.y > y1 ? u.y - y1 : 0;
  return isqrt(dx * dx + dy * dy);
}

/** The open tile next to a structure nearest the unit. */
function besideTile(s: MatchState, u: Unit, t: Structure): number {
  const ux = Math.floor(u.x / FP);
  const uy = Math.floor(u.y / FP);
  let best = -1;
  let bestD = Infinity;
  for (let y = t.y - 1; y <= t.y + t.h; y++)
    for (let x = t.x - 1; x <= t.x + t.w; x++) {
      if (x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) continue;
      if (x < 0 || y < 0 || x >= s.size || y >= s.size) continue;
      const i = y * s.size + x;
      if (!walkable(s, i)) continue;
      const d = (x - ux) ** 2 + (y - uy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  return best;
}

function driveTo(s: MatchState, u: Unit, goal: number) {
  if (goal < 0 || u.goal === goal) return;
  const here = unitTile(s, u);
  u.goal = goal;
  u.path = goal === here ? [] : lineClear(s, here, goal) && walkable(s, goal) ? [goal] : findPath(s, here, goal);
  u.pathStep = 0;
  u.pathVersion = s.blockVersion;
}

/**
 * Which Hauler loads at each node this tick: the lowest-id Hauler waiting there to load. The
 * others wait their turn (one at a time per node, at the node's rate).
 */
export function nodeLoaders(s: MatchState): Map<number, number> {
  const loaders = new Map<number, number>();
  for (const u of s.units) {
    if (!isHauler(u) || u.hp <= 0 || u.order || !u.haul?.node || u.haulState !== 0 || u.carry >= HAUL_CAPACITY) continue;
    if (!haulNodeOk(s, u.haul.node) || !atNode(s, u, u.haul.node) || loaders.has(u.haul.node)) continue;
    loaders.set(u.haul.node, u.id);
  }
  return loaders;
}

/** One tick of a Hauler following its route. */
export function haulThink(s: MatchState, u: Unit, loaders: Map<number, number>) {
  const r: HaulRoute | null = u.haul;
  if (!r || !r.node || !haulNodeOk(s, r.node)) {
    // No route (or its node was built over): wait at home, with whatever it carries.
    if (unitTile(s, u) !== u.home && u.pathStep >= u.path.length) driveTo(s, u, u.home);
    return;
  }
  const node = s.map.nodes[r.node - 1];
  const item = RESOURCE_ITEM[node.resource];
  // Carrying something else (its node changed): deliver that first.
  if (u.carry > 0 && u.carryItem !== item) u.haulState = 1;
  if (u.haulState === 0) {
    if (!atNode(s, u, r.node)) {
      driveTo(s, u, nodeTile(s, r.node));
      return;
    }
    u.path = [];
    u.pathStep = 0;
    u.goal = -1;
    if (loaders.get(r.node) !== u.id) return; // another Hauler is loading: wait
    u.haulTicks++;
    if (u.haulTicks >= DRILL_TICKS[node.purity]) {
      u.haulTicks = 0;
      u.carryItem = item;
      u.carry++;
    }
    if (u.carry >= HAUL_CAPACITY) u.haulState = 1;
    return;
  }
  // Heading for the building, or unloading there.
  const t = r.target ? cache(s).structById.get(r.target) : undefined;
  if (!t || t.owner !== u.owner || t.kind === 'hub') return; // no building: wait, loaded
  if (distTo(u, t) > FP) {
    driveTo(s, u, besideTile(s, u, t));
    return;
  }
  u.path = [];
  u.pathStep = 0;
  u.goal = -1;
  // One item a tick, while the building takes it (as by belt, it must want the item and have power).
  if (u.carry > 0 && u.carryItem && structureAccepts(t, u.carryItem)) {
    t.inv[u.carryItem] = (t.inv[u.carryItem] ?? 0) + 1;
    u.carry--;
  }
  if (u.carry === 0) {
    u.carryItem = null;
    u.haulState = 0;
  }
}

/** For panels: what a Hauler is doing. */
export function haulStatus(s: MatchState, u: Unit): string {
  const r = u.haul;
  const p = getPlayer(s, u.owner);
  void p;
  if (!r || !r.node) return 'No route: right-click a node, then a building.';
  if (!haulNodeOk(s, r.node)) return 'Its node has something built on it.';
  if (!r.target || !cache(s).structById.get(r.target)) return u.haulState === 1 ? 'Loaded, with no building to deliver to.' : 'Loading; no building set yet.';
  if (u.haulState === 0) return atNode(s, u, r.node) ? 'Loading at the node.' : 'Driving to the node.';
  const t = cache(s).structById.get(r.target)!;
  return distTo(u, t) > FP ? 'Driving to the building.' : 'Unloading (waits while the building cannot take more).';
}
