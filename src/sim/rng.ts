// Seeded random numbers for the simulation (mulberry32). The state is a single number kept
// in the match state, so the same seed and the same commands always give the same match.

export interface RngState {
  rng: number;
}

/** A whole number from 0 to 2^32 - 1. Advances the state. */
export function nextU32(s: RngState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** A whole number from 0 to n - 1. */
export function nextInt(s: RngState, n: number): number {
  return nextU32(s) % n;
}

/** A whole number from lo to hi, both included. */
export function nextRange(s: RngState, lo: number, hi: number): number {
  return lo + nextInt(s, hi - lo + 1);
}

/** A fixed hash of whole numbers, for things that must not depend on order (map decoration). */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
