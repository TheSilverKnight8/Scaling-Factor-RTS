import { STRUCTURES } from './content/structures';
import { POWER_LINE } from './content/transport';
import { Tile } from './map/types';
import type { MatchState, Structure } from './state';

// Power (SPEC "Power"): generators supply structures through power lines. Power poles and
// structures joined by lines form a grid. A grid blows when its current demand (what its
// working structures draw this tick) exceeds its supply, and stays down until the player
// restarts it. A grid with no supply at all simply has no power; it does not blow.

/** Works out which grid every structure is on, if lines or structures changed. */
export function updateGrids(s: MatchState) {
  if (s.gridVersion === s.powerVersion) return;
  s.gridVersion = s.powerVersion;
  const parent = new Map<number, number>();
  const find = (a: number): number => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = a;
    while (parent.get(c) !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  for (const t of s.structures) parent.set(t.id, t.id);
  for (const l of s.lines) {
    if (!parent.has(l.a) || !parent.has(l.b)) continue;
    const ra = find(l.a);
    const rb = find(l.b);
    // The lower id becomes the root, so a grid's id is its lowest structure id.
    if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
  }
  const blown = new Set<number>();
  for (const t of s.structures) {
    t.grid = find(t.id);
    if (t.blown) blown.add(t.grid);
  }
  // Joining a blown grid to a working one gives one blown grid: it waits for a restart.
  for (const t of s.structures) t.blown = blown.has(t.grid);
}

export interface GridInfo {
  supply: number;
  demand: number;
  blown: boolean;
}

/** Supply (MW) of each grid: finished generators on it. */
export function gridSupply(s: MatchState): Map<number, number> {
  const supply = new Map<number, number>();
  for (const t of s.structures) {
    const out = STRUCTURES[t.kind].powerOut;
    if (out > 0 && t.buildLeft === 0) supply.set(t.grid, (supply.get(t.grid) ?? 0) + out);
  }
  return supply;
}

/** Whether a line may join two structures (checked again when the command arrives). */
export function canConnect(s: MatchState, player: number, a: Structure | undefined, b: Structure | undefined): { ok: true } | { ok: false; reason: string } {
  if (!a || !b) return { ok: false, reason: 'Pick two structures or poles.' };
  if (a.id === b.id) return { ok: false, reason: 'Pick a different structure.' };
  if (a.owner !== player || b.owner !== player) return { ok: false, reason: 'Only your own structures.' };
  const da = STRUCTURES[a.kind];
  const db = STRUCTURES[b.kind];
  if (da.maxLines === 0 || db.maxLines === 0) return { ok: false, reason: `The ${da.maxLines === 0 ? da.name : db.name} takes no power lines.` };
  if (s.lines.some((l) => (l.a === a.id && l.b === b.id) || (l.a === b.id && l.b === a.id))) return { ok: false, reason: 'Already connected.' };
  const count = (id: number) => s.lines.filter((l) => l.a === id || l.b === id).length;
  if (count(a.id) >= da.maxLines) return { ok: false, reason: `The ${da.name} has no free connections (${da.maxLines}).` };
  if (count(b.id) >= db.maxLines) return { ok: false, reason: `The ${db.name} has no free connections (${db.maxLines}).` };
  // Length, center to center, in half tiles to stay in whole numbers.
  const ax = 2 * a.x + a.w;
  const ay = 2 * a.y + a.h;
  const bx = 2 * b.x + b.w;
  const by = 2 * b.y + b.h;
  const max = 2 * POWER_LINE.maxLength;
  if ((ax - bx) ** 2 + (ay - by) ** 2 > max * max) return { ok: false, reason: `Too long: power lines reach ${POWER_LINE.maxLength} tiles.` };
  if (crossesCliff(s, ax, ay, bx, by)) return { ok: false, reason: 'Power lines cannot cross cliffs.' };
  return { ok: true };
}

/** Whether the straight line between two points (in half tiles) passes over a cliff tile. */
function crossesCliff(s: MatchState, ax: number, ay: number, bx: number, by: number): boolean {
  // Step along the line in quarter-tile steps (whole numbers in half tiles, scaled by 2).
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2;
  if (steps === 0) return false;
  for (let i = 0; i <= steps; i++) {
    // The point i/steps of the way along, in tiles: (a + (b - a) * i / steps) / 2.
    const x = Math.floor((ax * steps + (bx - ax) * i) / (2 * steps));
    const y = Math.floor((ay * steps + (by - ay) * i) / (2 * steps));
    if (x < 0 || y < 0 || x >= s.size || y >= s.size) continue;
    if (s.map.terrain[y * s.size + x] === Tile.Cliff) return true;
  }
  return false;
}

export function linesOf(s: MatchState, id: number) {
  return s.lines.filter((l) => l.a === id || l.b === id);
}
