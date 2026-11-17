import type { MatchState } from './state';

/**
 * A short fingerprint of the match state. Two computers running the same match must get the
 * same fingerprint every tick; multiplayer (Stage 6) compares them to catch a desync early.
 */
export function stateHash(s: MatchState): number {
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    h = Math.imul(h ^ (v | 0), 16777619);
  };
  mix(s.tick);
  mix(s.nextId);
  mix(s.rng);
  mix(s.blockVersion);
  for (const u of s.units) {
    mix(u.id);
    mix(u.owner);
    mix(u.x);
    mix(u.y);
    mix(u.hp);
    mix(u.pathStep);
    mix(u.goal);
    for (const t of u.path) mix(t);
  }
  for (const t of s.structures) {
    mix(t.id);
    mix(t.owner);
    mix(t.x);
    mix(t.y);
    mix(t.w);
    mix(t.h);
    mix(t.hp);
    mix(t.buildLeft);
  }
  for (const p of s.players) {
    mix(p.id);
    let explored = 0;
    for (let i = 0; i < p.explored.length; i++) explored += p.explored[i];
    mix(explored);
  }
  return h >>> 0;
}
