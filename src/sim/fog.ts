import { FOG_CHUNK } from './constants';
import { isqrt } from './fmath';
import type { MatchState, Player } from './state';

/** Marks every tile within r tiles of (cx, cy) as explored for the player. */
export function reveal(s: MatchState, p: Player, cx: number, cy: number, r: number) {
  const size = s.size;
  const chunksPerRow = Math.ceil(size / FOG_CHUNK);
  const rr = r * r + r; // a slightly rounder circle than r * r
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= size) continue;
    const span = isqrt(rr - dy * dy);
    const x0 = Math.max(0, cx - span);
    const x1 = Math.min(size - 1, cx + span);
    for (let x = x0; x <= x1; x++) {
      const i = y * size + x;
      if (p.explored[i]) continue;
      p.explored[i] = 1;
      p.fogVersion[Math.floor(y / FOG_CHUNK) * chunksPerRow + Math.floor(x / FOG_CHUNK)]++;
    }
  }
}
