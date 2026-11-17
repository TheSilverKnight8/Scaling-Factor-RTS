// Integer math for the simulation.
//
// The simulation must give identical results on every computer in a match (multiplayer
// keeps players in step by sending only commands, so any difference grows into a desync).
// So it uses whole numbers only: positions are in 1/FP of a tile, and nothing here uses
// Math.random, Math.sin/cos/atan2/pow or other functions whose last digits can differ
// between browsers. Plain + - * on whole numbers below 2^53 is exact everywhere.

/** Sub-units per tile. A unit at tile (3, 4)'s center is at (3.5 * FP, 4.5 * FP). */
export const FP = 1024;

/** Whole-number square root, rounded down. Exact for any whole number below 2^52. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  // Math.sqrt is only a first guess; the two loops correct it, so the answer is exact
  // even if a browser's square root were off in the last digit.
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

/** Division rounded toward zero, as integers. */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Sine and cosine of multiples of 15 degrees, written out as numbers rather than computed,
 * so map building gives the same tiles in every browser.
 */
const SIN15 = [0, 0.25881904510252074, 0.5, 0.7071067811865476, 0.8660254037844386, 0.9659258262890683, 1];
export function sin15(k: number): number {
  const m = ((k % 24) + 24) % 24;
  if (m <= 6) return SIN15[m];
  if (m <= 12) return SIN15[12 - m];
  if (m <= 18) return -SIN15[m - 12];
  return -SIN15[24 - m];
}
export function cos15(k: number): number {
  return sin15(k + 6);
}
