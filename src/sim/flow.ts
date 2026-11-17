import { bagTotal, type ItemId } from './content/items';
import { DEPOT_CAPACITY, INPUT_CYCLES } from './content/economy';
import { RECIPES } from './content/recipes';
import { DX, DY } from './content/structures';
import { BELT_SPACING, BELT_SPEED } from './content/transport';
import { FP } from './fmath';
import { cache, type Belt, type MatchState, type Structure } from './state';
import { isProducer, producerRoom } from './production';

// How items pass from one thing to the next: off the end of a belt, out of a structure's
// output port, into a belt, splitter or merger, or into a structure's input port. Ports that
// touch and face each other connect with no belt between them (Caleb after Stage 1, as in
// Satisfactory). Items only pass between things of the same owner.

/** Whether a finished structure has power this tick (worked out in the power step). */
export function powered(t: Structure) {
  return t.buildLeft === 0 && t.status !== 'noPower' && t.status !== 'blown';
}

/** Whether a structure takes this item into an input port now. */
export function structureAccepts(t: Structure, item: ItemId): boolean {
  if (!powered(t)) return false;
  if (t.kind === 'smelter' || t.kind === 'constructor') {
    const r = t.recipe ? RECIPES[t.recipe] : undefined;
    const need = r?.inputs.find(([id]) => id === item);
    return !!need && (t.inv[item] ?? 0) < need[1] * INPUT_CYCLES;
  }
  if (t.kind === 'depot') return bagTotal(t.inv) < DEPOT_CAPACITY;
  if (isProducer(t)) return producerRoom(t, item) > 0;
  return false;
}

export function beltEntryFree(b: Belt) {
  return b.items.length === 0 || b.items[b.items.length - 1].pos >= BELT_SPACING;
}

/** Whether an item moving in direction `moveDir` may enter this belt tile now. */
function beltAccepts(s: MatchState, b: Belt, moveDir: number): boolean {
  if (!beltEntryFree(b)) return false;
  const back = (b.dir + 2) % 4;
  if (b.kind === 'belt') return moveDir !== back; // not head-on
  if (b.kind === 'splitter') return moveDir === b.dir; // from behind only
  // Merger: from behind, left or right, taking turns when more than one side is waiting.
  if (moveDir === back) return false;
  if (moveDir !== b.rr) return true;
  return !otherSideWaiting(s, b, moveDir);
}

/** For a merger: is an item waiting to come in from a side other than `side`? */
function otherSideWaiting(s: MatchState, m: Belt, side: number): boolean {
  const c = cache(s);
  for (const moveDir of [m.dir, (m.dir + 1) % 4, (m.dir + 3) % 4]) {
    if (moveDir === side) continue;
    // The feeding tile sits behind the merger as seen moving in moveDir.
    const x = m.x - DX[moveDir];
    const y = m.y - DY[moveDir];
    if (x < 0 || y < 0 || x >= s.size || y >= s.size) continue;
    const id = s.beltAt[y * s.size + x];
    const b = id ? c.beltById.get(id) : undefined;
    if (b && b.dir === moveDir && b.items.length && b.items[0].pos >= FP - BELT_SPEED) return true;
  }
  return false;
}

/**
 * Delivers an item leaving tile (fx, fy) in direction `dir` to whatever is next: a belt
 * tile's entry or a structure's input port facing back at (fx, fy). Structures only receive
 * when `toStructures` is set (direct port-to-port links are limited to a belt's rate by the
 * caller). Returns whether it went.
 */
export function deliver(s: MatchState, owner: number, fx: number, fy: number, dir: number, item: ItemId, toStructures = true): boolean {
  const x = fx + DX[dir];
  const y = fy + DY[dir];
  if (x < 0 || y < 0 || x >= s.size || y >= s.size) return false;
  const i = y * s.size + x;
  const c = cache(s);
  const bid = s.beltAt[i];
  if (bid) {
    const b = c.beltById.get(bid)!;
    if (b.owner !== owner || !beltAccepts(s, b, dir)) return false;
    b.items.push({ item, pos: 0 });
    if (b.kind === 'merger') b.rr = dir;
    return true;
  }
  const sid = s.occupied[i];
  if (!sid || !toStructures) return false;
  const t = c.structById.get(sid)!;
  if (t.owner !== owner) return false;
  const back = (dir + 2) % 4;
  const port = c.ports.get(t.id)!.find((p) => p.io === 'in' && p.x === x && p.y === y && p.dir === back);
  if (!port || !structureAccepts(t, item)) return false;
  t.inv[item] = (t.inv[item] ?? 0) + 1;
  return true;
}
