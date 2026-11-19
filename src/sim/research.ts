import { BUNDLES, BUNDLE_LIST, TIERS, type Bundle } from './content/research';
import { RECIPES, type Recipe } from './content/recipes';
import type { StructureKind } from './content/structures';
import type { UnitKind } from './content/units';
import { canAfford, pay } from './economy';
import { nextInt, type RngState } from './rng';
import { getPlayer, type MatchState, type Player, type TreeCell } from './state';

// Research at work: what a player has unlocked, their grid, what they can research next, and
// researching (SPEC "Research"; Caleb: a random grid, small bundles).


const has = (p: Player, id: string) => p.researched.includes(id);
const bundles = (p: Player) => p.researched.map((id) => BUNDLES[id]).filter(Boolean);

/** Whether a bundle's content is built yet (the rest wait for a later stage). */
export const isReady = (bd: Bundle) => !bd.stage;

export function recipeUnlocked(p: Player, r: Recipe) {
  return has(p, r.unlock);
}
export function structureUnlocked(p: Player, kind: StructureKind) {
  return bundles(p).some((bd) => isReady(bd) && bd.structures.includes(kind));
}
export function unitUnlocked(p: Player, kind: UnitKind) {
  return bundles(p).some((bd) => isReady(bd) && bd.units.includes(kind));
}
export function transportUnlocked(p: Player, kind: string) {
  return bundles(p).some((bd) => isReady(bd) && bd.transport.includes(kind));
}
export function recipeById(id: string) {
  return RECIPES[id];
}

/**
 * A player's grid: tier 0 (the basics) is one cell in column 0; each tier's bundles fill a run
 * of rows in the next column, in a random order, at a random height that overlaps the run of
 * the column before, so every bundle can be reached without passing through a higher tier.
 */
export function makeTree(rng: RngState): TreeCell[] {
  const byTier: string[][] = [];
  for (let t = 0; t <= TIERS; t++) byTier.push(BUNDLE_LIST.filter((x) => x.tier === t).map((x) => x.id));
  const height = Math.max(...byTier.map((c) => c.length));
  const cells: TreeCell[] = [];
  let prevTop = nextInt(rng, height);
  let prevLen = 1;
  cells.push({ id: byTier[0][0], col: 0, row: prevTop });
  for (let t = 1; t <= TIERS; t++) {
    const ids = [...byTier[t]];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = nextInt(rng, i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const n = ids.length;
    // The run [top, top + n) must share at least one row with [prevTop, prevTop + prevLen).
    const lo = Math.max(0, prevTop - n + 1);
    const hi = Math.min(height - n, prevTop + prevLen - 1);
    const top = lo + nextInt(rng, Math.max(1, hi - lo + 1));
    ids.forEach((id, i) => cells.push({ id, col: t, row: top + i }));
    prevTop = top;
    prevLen = n;
  }
  return cells;
}

/**
 * The bundles a player can research now: not yet researched, ready, and next to (left, right,
 * up or down) a researched bundle. Bundles not ready yet pass the way on to their neighbors.
 */
export function researchable(p: Player): Set<string> {
  const at = new Map(p.tree.map((c) => [`${c.col}:${c.row}`, c]));
  const near = (c: TreeCell) => [`${c.col + 1}:${c.row}`, `${c.col - 1}:${c.row}`, `${c.col}:${c.row + 1}`, `${c.col}:${c.row - 1}`].map((k) => at.get(k)).filter((x): x is TreeCell => !!x);
  const open = new Set<string>();
  const seen = new Set<string>();
  const queue = p.tree.filter((c) => has(p, c.id));
  queue.forEach((c) => seen.add(c.id));
  for (let i = 0; i < queue.length; i++) {
    for (const n of near(queue[i])) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      if (isReady(BUNDLES[n.id])) open.add(n.id);
      else queue.push(n); // not built yet: passes the way on
    }
  }
  return open;
}

/** Whether a player has a finished Laboratory with power (SPEC: research is done at the Laboratory). */
export function hasWorkingLab(s: MatchState, player: number) {
  return s.structures.some((t) => t.owner === player && t.kind === 'laboratory' && t.buildLeft === 0 && t.status !== 'noPower' && t.status !== 'blown');
}

/** Researches a bundle: instantly, paid from the Hub (SPEC). */
export function research(s: MatchState, player: number, id: string) {
  const p = getPlayer(s, player);
  const bd = BUNDLES[id];
  if (!p || !bd || has(p, id) || !isReady(bd)) return;
  if (!researchable(p).has(id)) return;
  if (!hasWorkingLab(s, player)) return;
  if (!canAfford(p, bd.cost)) return;
  pay(p, bd.cost);
  p.researched.push(id);
}
