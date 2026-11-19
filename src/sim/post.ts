import { POST_RADIUS } from './constants';
import { FP, isqrt } from './fmath';
import { spreadTiles } from './path';
import { cache, type MatchState } from './state';

// Command Posts (SPEC: extra directives to units within a fixed radius around the post). Caleb:
// a standing waypoint. The player sets a point for the post; the player's units acting on their
// own that come into its radius are sent on to that point, which becomes the spot they gather
// at (their home). Posts can be chained: a waypoint inside another post's radius sends units on
// again. A post needs power, like every structure.

/** Sets (or, with -1, clears) a Command Post's waypoint. */
export function setWaypoint(s: MatchState, player: number, id: number, x: number, y: number) {
  const t = cache(s).structById.get(id);
  if (!t || t.owner !== player || t.kind !== 'commandPost') return;
  if (x < 0 || y < 0) {
    t.waypoint = -1;
    return;
  }
  if (x >= s.size || y >= s.size) return;
  t.waypoint = y * s.size + x;
  t.made = 0;
}

/**
 * Units acting on their own on Aggressive or Hold Point that are within a working post's
 * radius are sent on to its waypoint, once per post (Patrol and Explore keep their own routes;
 * units waiting for orders wait). Posts go in id order, so the result is the same everywhere.
 */
export function tickPosts(s: MatchState) {
  const r = POST_RADIUS * FP;
  for (const t of s.structures) {
    if (t.kind !== 'commandPost' || t.waypoint < 0 || t.buildLeft > 0 || t.status !== 'working') continue;
    const cx = (t.x * 2 + t.w) * (FP / 2);
    const cy = (t.y * 2 + t.h) * (FP / 2);
    let slots: number[] | null = null;
    for (const u of s.units) {
      if (u.owner !== t.owner || u.mode !== 'auto' || u.order || u.lastPost === t.id || u.kind === 'hauler') continue;
      if (u.imperative !== 'aggressive' && u.imperative !== 'hold') continue;
      const dx = u.x - cx;
      const dy = u.y - cy;
      if (Math.abs(dx) > r || Math.abs(dy) > r || isqrt(dx * dx + dy * dy) > r) continue;
      slots ??= spreadTiles(s, t.waypoint, 40);
      if (!slots.length) return;
      u.lastPost = t.id;
      u.home = slots[t.made % slots.length];
      t.made++;
    }
  }
}
