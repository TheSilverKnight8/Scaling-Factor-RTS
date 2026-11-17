import type { MatchState } from './state';
import { walkable } from './state';

// Path finding for ground units: A* over the tile grid, 8 directions, never cutting a
// blocked corner. Ties are broken the same way every time, so every computer finds the same
// path. The path is then shortened to the few tiles where it turns (string pulling).

const STRAIGHT = 10;
const DIAGONAL = 14;

let cap = 0;
let g = new Int32Array(0);
let parent = new Int32Array(0);
let seen = new Uint32Array(0);
let closed = new Uint32Array(0);
let stamp = 0;

function ensure(n: number) {
  if (n <= cap) return;
  cap = n;
  g = new Int32Array(n);
  parent = new Int32Array(n);
  seen = new Uint32Array(n);
  closed = new Uint32Array(n);
  stamp = 0;
}

/** A binary heap of tile indices ordered by key, then by insertion order. */
class Heap {
  private items: number[] = [];
  private keys: number[] = [];
  private order: number[] = [];
  private counter = 0;
  get size() {
    return this.items.length;
  }
  private less(a: number, b: number) {
    return this.keys[a] < this.keys[b] || (this.keys[a] === this.keys[b] && this.order[a] < this.order[b]);
  }
  private swap(a: number, b: number) {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.order[a], this.order[b]] = [this.order[b], this.order[a]];
  }
  push(item: number, key: number) {
    this.items.push(item);
    this.keys.push(key);
    this.order.push(this.counter++);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.items[0];
    const last = this.items.length - 1;
    this.swap(0, last);
    this.items.pop();
    this.keys.pop();
    this.order.pop();
    let i = 0;
    const n = this.items.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < n && this.less(l, m)) m = l;
      if (r < n && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}

function heuristic(size: number, a: number, b: number) {
  const dx = Math.abs((a % size) - (b % size));
  const dy = Math.abs(Math.floor(a / size) - Math.floor(b / size));
  return dx < dy ? DIAGONAL * dx + STRAIGHT * (dy - dx) : DIAGONAL * dy + STRAIGHT * (dx - dy);
}

/**
 * Tiles to walk through from `from` to `to` (not including `from`), already shortened.
 * If `to` cannot be reached, the path leads to the reachable tile closest to it.
 * The start tile may be blocked (a unit a structure was just placed on can still walk off).
 */
export function findPath(s: MatchState, from: number, to: number, maxExpand = 30000): number[] {
  if (from === to) return [];
  const size = s.size;
  ensure(size * size);
  stamp++;
  if (stamp === 0xffffffff) {
    seen.fill(0);
    closed.fill(0);
    stamp = 1;
  }
  const heap = new Heap();
  g[from] = 0;
  parent[from] = -1;
  seen[from] = stamp;
  heap.push(from, heuristic(size, from, to));
  let best = from;
  let bestH = heuristic(size, from, to);
  let expanded = 0;

  while (heap.size > 0) {
    const cur = heap.pop();
    if (closed[cur] === stamp) continue;
    closed[cur] = stamp;
    if (cur === to) {
      best = cur;
      break;
    }
    const h = heuristic(size, cur, to);
    if (h < bestH) {
      bestH = h;
      best = cur;
    }
    if (++expanded > maxExpand) break;
    const cx = cur % size;
    const cy = Math.floor(cur / size);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (!walkable(s, ni) || closed[ni] === stamp) continue;
        // No cutting corners: both side tiles of a diagonal step must be open.
        if (dx !== 0 && dy !== 0 && (!walkable(s, cy * size + nx) || !walkable(s, ny * size + cx))) continue;
        const ng = g[cur] + (dx !== 0 && dy !== 0 ? DIAGONAL : STRAIGHT);
        if (seen[ni] === stamp && ng >= g[ni]) continue;
        seen[ni] = stamp;
        g[ni] = ng;
        parent[ni] = cur;
        heap.push(ni, (ng + heuristic(size, ni, to)) * 4096 + heuristic(size, ni, to));
      }
    }
  }

  const raw: number[] = [];
  for (let t = best; t !== -1 && t !== from; t = parent[t]) raw.push(t);
  raw.reverse();
  return smooth(s, from, raw);
}

/** Keeps only the tiles where the path has to turn: skips ahead while the straight line is clear. */
function smooth(s: MatchState, from: number, raw: number[]): number[] {
  if (raw.length <= 1) return raw;
  const out: number[] = [];
  let cur = from;
  let i = 0;
  while (i < raw.length) {
    let j = Math.min(raw.length - 1, i + 48);
    while (j > i && !lineClear(s, cur, raw[j])) j--;
    out.push(raw[j]);
    cur = raw[j];
    i = j + 1;
  }
  return out;
}

/**
 * True if a ground unit can walk straight from tile a's center to tile b's center: every tile
 * the line passes through is open, and where it passes exactly through a corner, both tiles
 * beside the corner are open. The start tile itself is not checked.
 */
export function lineClear(s: MatchState, a: number, b: number): boolean {
  const size = s.size;
  let x = a % size;
  let y = Math.floor(a / size);
  const x1 = b % size;
  const y1 = Math.floor(b / size);
  let dx = Math.abs(x1 - x);
  let dy = Math.abs(y1 - y);
  const sx = x1 > x ? 1 : -1;
  const sy = y1 > y ? 1 : -1;
  let n = dx + dy;
  let err = dx - dy;
  dx *= 2;
  dy *= 2;
  while (n > 0) {
    if (err > 0) {
      x += sx;
      err -= dy;
      n--;
    } else if (err < 0) {
      y += sy;
      err += dx;
      n--;
    } else {
      // Exactly through a corner.
      if (!walkable(s, y * size + x + sx) || !walkable(s, (y + sy) * size + x)) return false;
      x += sx;
      y += sy;
      err += dx - dy;
      n -= 2;
    }
    if (!walkable(s, y * size + x)) return false;
  }
  return true;
}

/**
 * The first `count` open tiles around `center`, nearest first (breadth-first over open tiles),
 * for spreading a group of units out around an ordered point. If the center is blocked, the
 * search starts from the nearest open tile.
 */
export function spreadTiles(s: MatchState, center: number, count: number): number[] {
  const size = s.size;
  const n = size * size;
  const visited = new Uint8Array(n);
  let start = center;
  if (!walkable(s, center)) {
    const found = nearestOpen(s, center, visited);
    if (found < 0) return [];
    start = found;
    visited.fill(0);
  }
  const out: number[] = [];
  const queue = [start];
  visited[start] = 1;
  for (let qi = 0; qi < queue.length && out.length < count; qi++) {
    const t = queue[qi];
    out.push(t);
    const x = t % size;
    const y = Math.floor(t / size);
    const nb = [
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
      [x, y - 1],
    ];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = ny * size + nx;
      if (visited[ni] || !walkable(s, ni)) continue;
      visited[ni] = 1;
      queue.push(ni);
    }
  }
  return out;
}

/** The nearest open tile to `t` (breadth-first through any tiles), or -1. */
export function nearestOpen(s: MatchState, t: number, visited = new Uint8Array(s.size * s.size), limit = 4000): number {
  const size = s.size;
  const queue = [t];
  visited[t] = 1;
  for (let qi = 0; qi < queue.length && qi < limit; qi++) {
    const c = queue[qi];
    if (walkable(s, c)) return c;
    const x = c % size;
    const y = Math.floor(c / size);
    const nb = [
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
      [x, y - 1],
    ];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = ny * size + nx;
      if (visited[ni]) continue;
      visited[ni] = 1;
      queue.push(ni);
    }
  }
  return -1;
}
