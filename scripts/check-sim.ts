// Checks the simulation outside the browser: npm run check:sim
//  1. Every map: all start locations reach each other on foot, and every node is reachable.
//  2. Determinism: the same setup and commands give the same state fingerprint, twice over.
//  3. Speed of a tick and of building the map.

import { MAPS, getMap } from '../src/sim/map/maps.ts';
import { Tile } from '../src/sim/map/types.ts';
import { createMatch, spawnUnit } from '../src/sim/match.ts';
import { spreadTiles } from '../src/sim/path.ts';
import { step } from '../src/sim/step.ts';
import { stateHash } from '../src/sim/hash.ts';
import type { Command } from '../src/sim/commands.ts';
import { STRUCTURES } from '../src/sim/content/structures.ts';
import { TICK_RATE } from '../src/sim/constants.ts';

let failed = false;
const fail = (msg: string) => {
  failed = true;
  console.log('FAIL ' + msg);
};

for (const info of MAPS) {
  const t0 = performance.now();
  const map = getMap(info.id);
  const buildMs = performance.now() - t0;
  const { size, terrain } = map;
  // Flood fill from the first start over ground tiles.
  const seen = new Uint8Array(size * size);
  const s0 = map.starts[0];
  const queue = [s0.y * size + s0.x];
  seen[queue[0]] = 1;
  for (let qi = 0; qi < queue.length; qi++) {
    const t = queue[qi];
    const x = t % size;
    const y = Math.floor(t / size);
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = ny * size + nx;
      if (seen[ni] || terrain[ni] !== Tile.Ground) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  map.starts.forEach((s, i) => {
    if (!seen[s.y * size + s.x]) fail(`${info.name}: start ${i} is cut off from start 0`);
  });
  for (const n of map.nodes) {
    let ok = false;
    for (let y = n.y; y < n.y + 2; y++) for (let x = n.x; x < n.x + 2; x++) if (seen[y * size + x]) ok = true;
    if (!ok) fail(`${info.name}: node ${n.id} (${n.resource}) cannot be reached`);
  }
  // Nodes must not overlap each other or a Hub's footprint.
  const used = new Map<number, number>();
  for (const n of map.nodes)
    for (let y = n.y; y < n.y + 2; y++)
      for (let x = n.x; x < n.x + 2; x++) {
        const k = y * size + x;
        if (used.has(k)) fail(`${info.name}: nodes ${used.get(k)} and ${n.id} overlap`);
        used.set(k, n.id);
      }
  for (const s of map.starts)
    for (let y = s.y - 2; y <= s.y + 2; y++)
      for (let x = s.x - 2; x <= s.x + 2; x++) {
        if (used.has(y * size + x)) fail(`${info.name}: a node is under the Hub at start (${s.x}, ${s.y})`);
        if (terrain[y * size + x] !== Tile.Ground) fail(`${info.name}: the Hub at start (${s.x}, ${s.y}) is not on ground`);
      }
  const counts: Record<string, number> = {};
  for (const n of map.nodes) counts[n.resource] = (counts[n.resource] ?? 0) + 1;
  let water = 0;
  let cliff = 0;
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === Tile.Water) water++;
    else if (terrain[i] === Tile.Cliff) cliff++;
  }
  console.log(
    `${info.name}: ${size}x${size}, ${map.starts.length} starts, ${map.nodes.length} nodes ${JSON.stringify(counts)}, water ${((100 * water) / terrain.length).toFixed(1)}%, cliffs ${((100 * cliff) / terrain.length).toFixed(1)}%, reachable ground ${queue.length} tiles, built in ${buildMs.toFixed(1)} ms`,
  );
}

// Determinism: two runs of the same match with the same commands.
function run(): number[] {
  const s = createMatch({ mapId: 'basin', seed: 12345, players: [{ name: 'A', color: 0 }, { name: 'B', color: 1 }, { name: 'C', color: 2 }, { name: 'D', color: 3 }] });
  const hashes: number[] = [];
  for (let tick = 0; tick < 1200; tick++) {
    const cmds: Command[] = [];
    if (tick % 100 === 1) {
      for (const p of s.players) {
        const ids = s.units.filter((u) => u.owner === p.id).map((u) => u.id);
        const tx = (tick * 7 + p.id * 41) % s.size;
        const ty = (tick * 13 + p.id * 29) % s.size;
        cmds.push({ type: 'move', player: p.id, units: ids, tx, ty });
      }
    }
    if (tick === 50) {
      for (const p of s.players) {
        const hub = s.structures.find((t) => t.id === p.hubId)!;
        cmds.push({ type: 'build', player: p.id, kind: 'depot', x: hub.x + 6, y: hub.y, rot: 0 });
      }
    }
    step(s, cmds);
    hashes.push(stateHash(s));
  }
  return hashes;
}
const t1 = performance.now();
const a = run();
const runMs = performance.now() - t1;
const b = run();
const firstDiff = a.findIndex((h, i) => h !== b[i]);
if (firstDiff >= 0) fail(`determinism: runs differ from tick ${firstDiff}`);
else console.log(`Determinism: 1200 ticks, 4 players, identical fingerprints in both runs (last ${a[a.length - 1].toString(16)}). One run took ${runMs.toFixed(0)} ms.`);

// The same setup must also build a structure where asked and refuse one in fog.
{
  const s = createMatch({ mapId: 'basin', seed: 7, players: [{ name: 'A', color: 0 }] });
  const hub = s.structures[0];
  step(s, [{ type: 'build', player: 1, kind: 'depot', x: hub.x + 6, y: hub.y, rot: 0 }]);
  if (s.structures.length !== 2) fail('a Depot beside the Hub was not built');
  step(s, [{ type: 'build', player: 1, kind: 'depot', x: (hub.x + 96) % s.size, y: (hub.y + 96) % s.size, rot: 0 }]);
  if (s.structures.length !== 2) fail('a Depot in fog was built');
  // Build time: the Depot takes STRUCTURES.depot.buildSeconds to finish.
  const depot = s.structures[1];
  const ticks = STRUCTURES.depot.buildSeconds * TICK_RATE;
  if (depot.buildTotal !== ticks) fail(`a Depot's build time is ${depot.buildTotal} ticks, expected ${ticks}`);
  while (depot.buildLeft > 0 && s.tick < 10000) step(s, []);
  console.log(`Build time: a Depot finished ${depot.buildTotal} ticks (${STRUCTURES.depot.buildSeconds} s) after it was placed.`);
}

// Load: 4 players with 200 units each (the unit limit), all ordered across the map at once.
{
  const s = createMatch({ mapId: 'basin', seed: 99, players: [0, 1, 2, 3].map((c) => ({ name: 'P' + c, color: c })) });
  for (const p of s.players) {
    const hub = s.structures.find((t) => t.id === p.hubId)!;
    const tiles = spreadTiles(s, (hub.y + hub.h + 2) * s.size + hub.x + 2, 200);
    for (const t of tiles.slice(3)) spawnUnit(s, p.id, 'minuteman', t);
  }
  const total = s.units.length;
  const c = s.size / 2;
  const t0 = performance.now();
  step(
    s,
    s.players.map((p) => ({ type: 'move' as const, player: p.id, units: s.units.filter((u) => u.owner === p.id).map((u) => u.id), tx: c + 12, ty: c - 14 })),
  );
  const orderMs = performance.now() - t0;
  let worst = 0;
  const t1 = performance.now();
  for (let i = 0; i < 600; i++) {
    const a = performance.now();
    step(s, []);
    worst = Math.max(worst, performance.now() - a);
  }
  const avg = (performance.now() - t1) / 600;
  console.log(`Load: ${total} units. The tick with 4 move orders for all of them took ${orderMs.toFixed(0)} ms; then ${avg.toFixed(2)} ms a tick on average (worst ${worst.toFixed(1)} ms) while they walk. A tick has ${(1000 / 20).toFixed(0)} ms.`);
}

if (failed) process.exit(1);
console.log('All checks passed.');
