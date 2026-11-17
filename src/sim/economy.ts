import { DRILL_BUFFER, DRILL_TICKS, HUB_CAPACITY, INPUT_CYCLES, OUTPUT_BUFFER } from './content/economy';
import { ITEM_IDS, RESOURCE_ITEM, bagAdd, bagTotal, type Bag, type ItemId } from './content/items';
import { RECIPES } from './content/recipes';
import { STRUCTURES, type Cost } from './content/structures';
import { TICK_RATE } from './constants';
import { DIRECT_PERIOD } from './content/transport';
import { deliver, powered } from './flow';
import { gridSupply, updateGrids } from './power';
import { cache, getPlayer, unitCountOf, type MatchState, type Player, type Structure } from './state';
import { isProducer, partsInProgress, producerRoom, producerWants, producerWork } from './production';
import { UNIT_LIMIT } from './constants';

// Structures at work: power for each grid, Drills gathering, Smelters and Constructors running
// their recipes, and products going out through output ports. Also what the player does by
// hand: moving items between the Hub and a structure, and choosing a recipe.

const isMachine = (t: Structure) => t.kind === 'smelter' || t.kind === 'constructor';

/** Whether a structure would draw power this tick (SPEC: a grid blows on current demand). */
function wantsToWork(s: MatchState, t: Structure): boolean {
  if (isProducer(t)) return producerWants(s, t);
  if (t.kind === 'drill') return bagTotal(t.out) < DRILL_BUFFER;
  if (t.kind === 'depot') return true;
  if (isMachine(t)) {
    if (!t.recipe) return false;
    if (t.progress > 0) return true;
    return canStart(t);
  }
  void s;
  return false;
}

function canStart(t: Structure): boolean {
  const r = t.recipe ? RECIPES[t.recipe] : undefined;
  if (!r) return false;
  if (!r.inputs.every(([id, n]) => (t.inv[id] ?? 0) >= n)) return false;
  return r.outputs.every(([id, n]) => (t.out[id] ?? 0) + n <= OUTPUT_BUFFER);
}

/** One tick of every structure: power, work, then products out. */
export function tickStructures(s: MatchState) {
  updateGrids(s);
  const supply = gridSupply(s);

  // Demand per grid from the structures that would work this tick.
  const wants = new Map<number, boolean>();
  const demand = new Map<number, number>();
  for (const t of s.structures) {
    if (t.buildLeft > 0) continue;
    const w = wantsToWork(s, t);
    wants.set(t.id, w);
    const p = STRUCTURES[t.kind].power;
    if (w && p > 0) demand.set(t.grid, (demand.get(t.grid) ?? 0) + p);
  }
  // Overload blows the grid until it is restarted.
  const blowNow = new Set<number>();
  for (const [grid, d] of demand) {
    const sup = supply.get(grid) ?? 0;
    if (sup > 0 && d > sup) blowNow.add(grid);
  }
  for (const t of s.structures) if (blowNow.has(t.grid)) t.blown = true;

  for (const t of s.structures) {
    if (t.buildLeft > 0) {
      t.status = 'building';
      continue;
    }
    const def = STRUCTURES[t.kind];
    if (t.kind === 'hub') {
      t.status = 'working';
      continue;
    }
    if (t.blown) {
      t.status = 'blown';
      continue;
    }
    if (def.powerOut > 0) {
      t.status = 'working';
      continue;
    }
    if ((supply.get(t.grid) ?? 0) <= 0) {
      t.status = def.power > 0 ? 'noPower' : 'idle';
      continue;
    }
    if (!wants.get(t.id)) {
      if (isProducer(t)) t.status = !t.produce ? 'noRecipe' : unitCountOf(s, t.owner) >= UNIT_LIMIT ? 'atLimit' : 'noInput';
      else t.status = isMachine(t) ? (!t.recipe ? 'noRecipe' : t.progress === 0 && !inputsReady(t) ? 'noInput' : 'outputFull') : t.kind === 'drill' ? 'outputFull' : 'idle';
      continue;
    }
    t.status = 'working';
    work(s, t);
  }

  // Products out through output ports (one item per port per tick).
  for (const t of s.structures) {
    if (!powered(t)) continue;
    const ports = cache(s).ports.get(t.id)!;
    const outPorts = ports.filter((p) => p.io === 'out');
    if (!outPorts.length) continue;
    const source = t.kind === 'depot' ? t.inv : t.out;
    if (bagTotal(source) === 0) continue;
    const direct = (s.tick + t.id) % DIRECT_PERIOD === 0;
    for (let k = 0; k < outPorts.length; k++) {
      const port = outPorts[(t.rr + k) % outPorts.length];
      const item = firstItem(source);
      if (!item) break;
      if (deliver(s, t.owner, port.x, port.y, port.dir, item, direct)) {
        bagAdd(source, item, -1);
        t.rr = (t.rr + 1) % outPorts.length;
      }
    }
  }
}

function inputsReady(t: Structure) {
  const r = t.recipe ? RECIPES[t.recipe] : undefined;
  return !!r && r.inputs.every(([id, n]) => (t.inv[id] ?? 0) >= n);
}

function firstItem(b: Bag): ItemId | undefined {
  for (const id of ITEM_IDS) if ((b[id] ?? 0) > 0) return id;
  return undefined;
}

function work(s: MatchState, t: Structure) {
  if (isProducer(t)) return producerWork(s, t);
  if (t.kind === 'drill') {
    const node = s.map.nodes[s.nodeAt[t.y * s.size + t.x] - 1];
    if (!node) return;
    t.progress++;
    if (t.progress >= DRILL_TICKS[node.purity]) {
      t.progress = 0;
      bagAdd(t.out, RESOURCE_ITEM[node.resource], 1);
    }
    return;
  }
  if (isMachine(t)) {
    const r = RECIPES[t.recipe!];
    if (t.progress === 0) {
      for (const [id, n] of r.inputs) bagAdd(t.inv, id, -n);
      t.progress = r.seconds * TICK_RATE;
    }
    t.progress--;
    if (t.progress === 0) for (const [id, n] of r.outputs) bagAdd(t.out, id, n);
  }
}

// ------------------------------------------------------------------ costs and the Hub

export function hubFree(p: Player) {
  return Math.max(0, HUB_CAPACITY - bagTotal(p.hub));
}

export function canAfford(p: Player, cost: Cost, times = 1) {
  return cost.every(([id, n]) => (p.hub[id] ?? 0) >= n * times);
}

export function pay(p: Player, cost: Cost, times = 1) {
  for (const [id, n] of cost) bagAdd(p.hub, id, -n * times);
}

/** Refunds and returned items always go into the Hub, even past its capacity: nothing is lost. */
export function refund(p: Player, cost: Cost, times = 1) {
  for (const [id, n] of cost) bagAdd(p.hub, id, n * times);
}

export function returnBag(p: Player, b: Bag) {
  for (const id of ITEM_IDS) if (b[id]) bagAdd(p.hub, id, b[id]!);
}

/** Everything a structure holds, plus the ingredients of a cycle in progress. */
export function contents(t: Structure): Bag {
  const all: Bag = {};
  for (const id of ITEM_IDS) {
    const n = (t.inv[id] ?? 0) + (t.out[id] ?? 0);
    if (n) all[id] = n;
  }
  if (isMachine(t) && t.progress > 0 && t.recipe) for (const [id, n] of RECIPES[t.recipe].inputs) bagAdd(all, id, n);
  for (const [id, n] of partsInProgress(t)) bagAdd(all, id, n);
  return all;
}

// ------------------------------------------------------------------ by hand

/** Moves as much of an item as fits from a structure into the Hub (SPEC: by hand, instantly). */
export function takeToHub(s: MatchState, player: number, id: number, item: ItemId) {
  const p = getPlayer(s, player);
  const t = cache(s).structById.get(id);
  if (!p || !t || t.owner !== player || t.kind === 'hub') return;
  let room = hubFree(p);
  for (const bag of [t.out, t.inv]) {
    const n = Math.min(bag[item] ?? 0, room);
    if (n <= 0) continue;
    bagAdd(bag, item, -n);
    bagAdd(p.hub, item, n);
    room -= n;
  }
}

/** How many of an item a structure would take by hand from the Hub now. */
export function giveRoom(t: Structure, item: ItemId): number {
  if (t.buildLeft > 0) return 0;
  if (isProducer(t)) return producerRoom(t, item);
  if (isMachine(t)) {
    const r = t.recipe ? RECIPES[t.recipe] : undefined;
    const need = r?.inputs.find(([i]) => i === item);
    return need ? Math.max(0, need[1] * INPUT_CYCLES - (t.inv[item] ?? 0)) : 0;
  }
  return 0;
}

/** Moves as much of an item as the structure takes from the Hub into it. */
export function giveFromHub(s: MatchState, player: number, id: number, item: ItemId) {
  const p = getPlayer(s, player);
  const t = cache(s).structById.get(id);
  if (!p || !t || t.owner !== player) return;
  const n = Math.min(p.hub[item] ?? 0, giveRoom(t, item));
  if (n <= 0) return;
  bagAdd(p.hub, item, -n);
  bagAdd(t.inv, item, n);
}

/** Chooses a Smelter's or Constructor's recipe. What it held goes back to the Hub. */
export function setRecipe(s: MatchState, player: number, id: number, recipe: string | null) {
  const p = getPlayer(s, player);
  const t = cache(s).structById.get(id);
  if (!p || !t || t.owner !== player || !isMachine(t)) return;
  if (recipe !== null) {
    const r = RECIPES[recipe];
    if (!r || r.machine !== t.kind || !r.atStart) return;
  }
  if (recipe === t.recipe) return;
  returnBag(p, contents(t));
  t.inv = {};
  t.out = {};
  t.progress = 0;
  t.recipe = recipe;
}

/** Restarts a blown grid: every structure on it (SPEC: restarted manually by the player). */
export function restartGrid(s: MatchState, player: number, id: number) {
  const t = cache(s).structById.get(id);
  if (!t || t.owner !== player) return;
  updateGrids(s);
  for (const o of s.structures) if (o.grid === t.grid && o.owner === player) o.blown = false;
}
