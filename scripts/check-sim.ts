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
import { DX, DY, STRUCTURES, portsOf, type StructureKind } from '../src/sim/content/structures.ts';
import { canPlace } from '../src/sim/placement.ts';
import { canPlaceBelt } from '../src/sim/belts.ts';
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

// Economy: the bootstrap path from the starting inventory to Iron Plates, with ports joined directly.
function economyRun() {
  const s = createMatch({ mapId: 'basin', seed: 3, players: [{ name: 'A', color: 0 }] });
  const me = s.players[0];
  const hub = s.structures[0];
  const run = (ticks: number, cmds: Command[] = []) => {
    step(s, cmds);
    for (let i = 1; i < ticks; i++) step(s, []);
  };
  const near = s.map.nodes
    .filter((n) => n.resource === 'iron' && me.explored[n.y * s.size + n.x])
    .sort((a, b) => Math.abs(a.x - hub.x) + Math.abs(a.y - hub.y) - (Math.abs(b.x - hub.x) + Math.abs(b.y - hub.y)));
  // Find a Drill rotation and a Smelter and Constructor placement that chain port to port.
  const chainAfter = (kind: StructureKind, from: { kind: StructureKind; x: number; y: number; rot: number }) => {
    const out = portsOf(from.kind, from.x, from.y, from.rot).find((p) => p.io === 'out')!;
    for (let rot = 0; rot < 4; rot++) {
      for (const p of portsOf(kind, 0, 0, rot)) {
        if (p.io !== 'in' || p.dir !== (out.dir + 2) % 4) continue;
        const x = out.ox - p.x;
        const y = out.oy - p.y;
        if (canPlace(s, 1, kind, x, y, rot).ok) return { kind, x, y, rot };
      }
    }
    return null;
  };
  let plan: { drill: any; smelter: any; constructor: any } | null = null;
  for (const n of near) {
    for (let rot = 0; rot < 4 && !plan; rot++) {
      const drill = { kind: 'drill' as StructureKind, x: n.x, y: n.y, rot };
      if (!canPlace(s, 1, 'drill', n.x, n.y, rot).ok) continue;
      const smelter = chainAfter('smelter', drill);
      if (!smelter) continue;
      // Pretend the smelter is there to find the constructor spot.
      const constructor = chainAfter('constructor', smelter);
      if (constructor) plan = { drill, smelter, constructor };
    }
    if (plan) break;
  }
  if (!plan) {
    fail('economy: found no spot for a Drill, Smelter and Constructor chain');
    return null;
  }
  // Solar Generators in open explored spots near the Hub.
  const solars: { x: number; y: number }[] = [];
  for (let r = 6; r < 14 && solars.length < 4; r++)
    for (let dy = -r; dy <= r && solars.length < 4; dy += 2)
      for (let dx = -r; dx <= r && solars.length < 4; dx += 2) {
        const x = hub.x + dx;
        const y = hub.y + dy;
        if (!canPlace(s, 1, 'solar', x, y, 0).ok) continue;
        if (solars.some((o) => Math.abs(o.x - x) < 3 && Math.abs(o.y - y) < 3)) continue;
        const busy = [plan.drill, plan.smelter, plan.constructor].some((t) => Math.abs(t.x - x) < 5 && Math.abs(t.y - y) < 5);
        if (!busy) solars.push({ x, y });
      }
  run(1, [{ type: 'build', player: 1, ...plan.drill }, ...solars.map((o) => ({ type: 'build' as const, player: 1, kind: 'solar' as StructureKind, x: o.x, y: o.y, rot: 0 }))]);
  const drill = s.structures[1];
  // Drill to the nearest Solar, then each Solar to the next nearest.
  const chain = [drill];
  const left = s.structures.slice(2);
  while (left.length) {
    const last = chain[chain.length - 1];
    left.sort((a, b) => (a.x - last.x) ** 2 + (a.y - last.y) ** 2 - ((b.x - last.x) ** 2 + (b.y - last.y) ** 2));
    chain.push(left.shift()!);
  }
  run(1, chain.slice(1).map((t, i) => ({ type: 'line' as const, player: 1, a: chain[i].id, b: t.id })));
  if (s.lines.length !== solars.length) fail(`economy: ${s.lines.length} power lines placed, expected ${solars.length}`);
  run(20 * 50);
  if ((drill.out.ironOre ?? 0) < 40) fail(`economy: the Drill gathered ${drill.out.ironOre ?? 0} ore in 50 s`);
  run(1, [{ type: 'take', player: 1, id: drill.id, item: 'ironOre' }]);
  run(1, [{ type: 'build', player: 1, ...plan.smelter }]);
  const smelter = s.structures[s.structures.length - 1];
  if (smelter.kind !== 'smelter') {
    fail('economy: the Smelter was not built from ore');
    return null;
  }
  run(1, [{ type: 'line', player: 1, a: drill.id, b: smelter.id }, { type: 'recipe', player: 1, id: smelter.id, recipe: 'ironIngot' }]);
  // 5 s to build, then 30 ingots a minute (Satisfactory's Smelter).
  run(20 * 70);
  if ((smelter.out.ironIngot ?? 0) < 30) fail(`economy: the Smelter made ${smelter.out.ironIngot ?? 0} ingots`);
  run(1, [{ type: 'take', player: 1, id: smelter.id, item: 'ironIngot' }]);
  run(1, [{ type: 'build', player: 1, ...plan.constructor }]);
  const constructor = s.structures[s.structures.length - 1];
  if (constructor.kind !== 'constructor') {
    fail('economy: the Constructor was not built from ingots');
    return null;
  }
  run(1, [{ type: 'line', player: 1, a: smelter.id, b: constructor.id }, { type: 'recipe', player: 1, id: constructor.id, recipe: 'ironPlate' }]);
  run(20 * 60);
  // 5 s to build, then up to 20 plates a minute (Satisfactory's Constructor), fed by one Smelter.
  const plates = constructor.out.ironPlate ?? 0;
  if (plates < 10) fail(`economy: the Constructor made ${plates} Iron Plates in a minute`);
  return { s, plates, hash: stateHash(s) };
}
const e1 = economyRun();
const e2 = economyRun();
if (e1 && e2) {
  if (e1.hash !== e2.hash) fail('economy: two runs differ');
  else console.log(`Economy: from the starting inventory, Drill -> Smelter -> Constructor joined port to port made ${e1.plates} Iron Plates in the first minute; two runs identical.`);
}

// Belts: a Drill feeding a Depot down a belt line with a splitter; and a grid that blows.
{
  const s = createMatch({ mapId: 'basin', seed: 3, players: [{ name: 'A', color: 0 }] });
  const me = s.players[0];
  me.explored.fill(1);
  me.hub = { ironPlate: 500, ironRod: 500, wire: 500, cable: 500, ironOre: 500 };
  const hub = s.structures[0];
  const n = s.map.nodes.find((n) => n.resource === 'copper' && Math.abs(n.x - hub.x) + Math.abs(n.y - hub.y) < 30)!;
  // Drill with its output facing +y, a belt line 6 tiles straight down, a splitter, then a Depot.
  let ok = false;
  for (let rot = 0; rot < 4 && !ok; rot++) {
    const out = portsOf('drill', n.x, n.y, rot).find((p) => p.io === 'out')!;
    const dir = out.dir;
    const tiles = Array.from({ length: 6 }, (_, k) => ({ x: out.ox + DX[dir] * k, y: out.oy + DY[dir] * k, dir }));
    if (!tiles.every((t) => canPlaceBelt(s, 1, 'belt', t.x, t.y).ok)) continue;
    const sx = out.ox + DX[dir] * 6;
    const sy = out.oy + DY[dir] * 6;
    if (!canPlaceBelt(s, 1, 'splitter', sx, sy).ok) continue;
    // A Depot whose input faces the splitter's front.
    const dx = sx + DX[dir];
    const dy = sy + DY[dir];
    let depot: { x: number; y: number; rot: number } | null = null;
    for (let r = 0; r < 4 && !depot; r++)
      for (const p of portsOf('depot', 0, 0, r))
        if (p.io === 'in' && p.dir === (dir + 2) % 4 && canPlace(s, 1, 'depot', dx - p.x, dy - p.y, r).ok) depot = { x: dx - p.x, y: dy - p.y, rot: r };
    if (!depot) continue;
    step(s, [
      { type: 'build', player: 1, kind: 'drill', x: n.x, y: n.y, rot },
      { type: 'belts', player: 1, kind: 'belt', tiles },
      { type: 'belts', player: 1, kind: 'splitter', tiles: [{ x: sx, y: sy, dir }] },
      { type: 'build', player: 1, kind: 'depot', ...depot },
    ]);
    ok = true;
  }
  if (!ok) fail('belts: found no straight line for the belt test');
  else {
    const [drill, depot] = [s.structures[1], s.structures[2]];
    if (s.belts.length !== 7) fail(`belts: ${s.belts.length} belt tiles placed, expected 7`);
    // One Solar (4 MW) cannot run a Drill (5 MW): the grid blows. Solars go in open spots near the Drill.
    const spots: { x: number; y: number }[] = [];
    for (let r = 3; r < 12 && spots.length < 2; r++)
      for (let dy = -r; dy <= r && spots.length < 2; dy++)
        for (let dx = -r; dx <= r && spots.length < 2; dx++) {
          const x = n.x + dx;
          const y = n.y + dy;
          if (canPlace(s, 1, 'solar', x, y, 0).ok && !spots.some((o) => Math.abs(o.x - x) < 2 && Math.abs(o.y - y) < 2)) spots.push({ x, y });
        }
    step(s, [{ type: 'build', player: 1, kind: 'solar', x: spots[0].x, y: spots[0].y, rot: 0 }]);
    const solar = s.structures[3];
    for (let i = 0; i < 20 * 5; i++) step(s, []);
    step(s, [{ type: 'line', player: 1, a: solar.id, b: drill.id }]);
    for (let i = 0; i < 5; i++) step(s, []);
    if (drill.status !== 'blown') fail(`power: a 5 MW Drill on 4 MW should blow the grid, status ${drill.status}`);
    // Add a second Solar and the Depot, then restart.
    step(s, [{ type: 'build', player: 1, kind: 'solar', x: spots[1].x, y: spots[1].y, rot: 0 }]);
    const solar2 = s.structures[4];
    for (let i = 0; i < 20 * 4; i++) step(s, []);
    step(s, [{ type: 'line', player: 1, a: solar2.id, b: solar.id }, { type: 'line', player: 1, a: solar2.id, b: depot.id }]);
    step(s, [{ type: 'restart', player: 1, id: drill.id }]);
    for (let i = 0; i < 20 * 30; i++) step(s, []);
    if (drill.status === 'blown') fail('power: still blown after a restart with enough supply');
    const stored = depot.inv.copperOre ?? 0;
    if (stored < 15) fail(`belts: the Depot received ${stored} Copper Ore in 30 s`);
    else console.log(`Belts and power: one Solar on a Drill blew the grid; with two and a restart, ${stored} Copper Ore reached the Depot down 6 belt tiles and a splitter in 30 s.`);
  }
}

// Depot output, merger turn-taking, refunds and recipe changes, on open ground with everything explored.
{
  const s = createMatch({ mapId: 'basin', seed: 5, players: [{ name: 'A', color: 0 }] });
  const me = s.players[0];
  me.explored.fill(1);
  me.hub = { ironPlate: 500, ironRod: 500, wire: 500, cable: 500, ironOre: 500, ironIngot: 100 };
  // Find a 14 x 10 patch of open ground.
  let ox = -1;
  let oy = -1;
  for (let y = 4; y < s.size - 14 && ox < 0; y++)
    for (let x = 4; x < s.size - 16 && ox < 0; x++) {
      let clear = true;
      for (let yy = y; yy < y + 10 && clear; yy++) for (let xx = x; xx < x + 14 && clear; xx++) if (!canPlaceBelt(s, 1, 'belt', xx, yy).ok || s.map.terrain[yy * s.size + xx] !== 0) clear = false;
      if (clear) [ox, oy] = [x, y];
    }
  // Two Depots (rot 0: input on -y, output on +y) feed belts down into a merger, which feeds a third Depot.
  const run = (n: number, cmds: Command[] = []) => {
    step(s, cmds);
    for (let i = 1; i < n; i++) step(s, []);
  };
  run(1, [
    { type: 'build', player: 1, kind: 'depot', x: ox, y: oy, rot: 0 },
    { type: 'build', player: 1, kind: 'depot', x: ox + 4, y: oy, rot: 0 },
    { type: 'build', player: 1, kind: 'solar', x: ox + 9, y: oy, rot: 0 },
    { type: 'build', player: 1, kind: 'solar', x: ox + 11, y: oy, rot: 0 },
  ]);
  const [dA, dB, s1, s2] = s.structures.slice(1);
  // Depot A's output is at (ox, oy+2); belt down to y+4, then right to the merger at (ox+2, oy+4).
  // Depot B's output is at (ox+4, oy+2); belt down to y+4, then left into the merger.
  run(1, [
    { type: 'belts', player: 1, kind: 'belt', tiles: [{ x: ox, y: oy + 2, dir: 1 }, { x: ox, y: oy + 3, dir: 1 }, { x: ox, y: oy + 4, dir: 0 }, { x: ox + 1, y: oy + 4, dir: 0 }] },
    { type: 'belts', player: 1, kind: 'belt', tiles: [{ x: ox + 4, y: oy + 2, dir: 1 }, { x: ox + 4, y: oy + 3, dir: 1 }, { x: ox + 4, y: oy + 4, dir: 2 }, { x: ox + 3, y: oy + 4, dir: 2 }] },
    { type: 'belts', player: 1, kind: 'merger', tiles: [{ x: ox + 2, y: oy + 4, dir: 1 }] },
    { type: 'build', player: 1, kind: 'depot', x: ox + 2, y: oy + 5, rot: 0 },
  ]);
  const dC = s.structures[s.structures.length - 1];
  run(20 * 4);
  dA.inv = { ironOre: 50 };
  dB.inv = { ironIngot: 50 };
  run(1, [
    { type: 'line', player: 1, a: s1.id, b: s2.id },
    { type: 'line', player: 1, a: s1.id, b: dA.id },
    { type: 'line', player: 1, a: dA.id, b: dC.id },
    { type: 'line', player: 1, a: s2.id, b: dB.id },
  ]);
  // Items take about 5 s to arrive (4 belt tiles and the merger), then 2 a second, alternating.
  run(20 * 20);
  const ore = dC.inv.ironOre ?? 0;
  const ingots = dC.inv.ironIngot ?? 0;
  if (ore < 10 || ingots < 10 || Math.abs(ore - ingots) > 2) fail(`merger: the end Depot got ${ore} ore and ${ingots} ingots (both sides should take turns)`);
  else console.log(`Depots and merger: two Depots fed one merger in turn; the end Depot got ${ore} Iron Ore and ${ingots} Iron Ingots in 20 s.`);

  // Demolishing refunds the full cost and what the structure holds; a recipe change returns what it held.
  const before = { ...me.hub };
  run(1, [{ type: 'demolish', player: 1, id: dC.id }]);
  const back = (me.hub.ironPlate ?? 0) - (before.ironPlate ?? 0);
  if (back !== 10 || (me.hub.ironOre ?? 0) < (before.ironOre ?? 0) + ore) fail(`refund: demolishing a Depot returned ${back} Iron Plate (expected 10) and its contents`);
  run(1, [{ type: 'build', player: 1, kind: 'smelter', x: ox + 7, y: oy + 6, rot: 0 }]);
  const sm = s.structures[s.structures.length - 1];
  run(20 * 6, [{ type: 'line', player: 1, a: s2.id, b: sm.id }]);
  run(1, [{ type: 'recipe', player: 1, id: sm.id, recipe: 'ironIngot' }]);
  const oreBefore = me.hub.ironOre ?? 0;
  run(1, [{ type: 'give', player: 1, id: sm.id, item: 'ironOre' }]);
  const given = oreBefore - (me.hub.ironOre ?? 0);
  run(1, [{ type: 'recipe', player: 1, id: sm.id, recipe: 'copperIngot' }]);
  if (given !== 10 || (me.hub.ironOre ?? 0) !== oreBefore) fail(`by hand: gave ${given} ore (expected 10); after a recipe change the Hub has ${me.hub.ironOre} ore, expected ${oreBefore}`);
  else console.log('Refunds: a demolished Depot returned its cost and contents; a Smelter took 10 ore by hand and gave it back on a recipe change.');
}

// Belt load: 120 lines of 20 tiles, all full, moving.
{
  const s = createMatch({ mapId: 'basin', seed: 6, players: [{ name: 'A', color: 0 }] });
  const me = s.players[0];
  me.explored.fill(1);
  me.hub = { ironPlate: 100000 };
  let lines = 0;
  for (let y = 0; y < s.size && lines < 120; y += 1) {
    for (let x = 0; x + 20 < s.size && lines < 120; x += 22) {
      const tiles = Array.from({ length: 20 }, (_, k) => ({ x: x + k, y, dir: 0 }));
      if (!tiles.every((t) => canPlaceBelt(s, 1, 'belt', t.x, t.y).ok)) continue;
      step(s, [{ type: 'belts', player: 1, kind: 'belt', tiles }]);
      lines++;
    }
  }
  for (const b of s.belts) b.items = [{ item: 'ironOre', pos: 600 }, { item: 'ironOre', pos: 0 }];
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) step(s, []);
  const ms = (performance.now() - t0) / 200;
  console.log(`Belt load: ${s.belts.length} belt tiles, full, ${ms.toFixed(2)} ms a tick.`);
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
