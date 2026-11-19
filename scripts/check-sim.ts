// Checks the simulation outside the browser: npm run check:sim
//  1. Every map: all start locations reach each other on foot, and every node is reachable.
//  2. Determinism: the same setup and commands give the same state fingerprint, twice over.
//  3. Speed of a tick and of building the map.

import { MAPS, getMap } from '../src/sim/map/maps.ts';
import { Tile } from '../src/sim/map/types.ts';
import { FP } from '../src/sim/fmath.ts';
import { createMatch, spawnUnit } from '../src/sim/match.ts';
import { UNITS } from '../src/sim/content/units.ts';
import { PULSE_DAMAGE, UNIT_LIMIT } from '../src/sim/constants.ts';
import { unitTile as unitTileOf } from '../src/sim/state.ts';
import { spreadTiles } from '../src/sim/path.ts';
import { step } from '../src/sim/step.ts';
import { stateHash } from '../src/sim/hash.ts';
import type { Command } from '../src/sim/commands.ts';
import { DX, DY, STRUCTURES, portsOf, type StructureKind } from '../src/sim/content/structures.ts';
import { canPlace } from '../src/sim/placement.ts';
import { canPlaceBelt } from '../src/sim/belts.ts';
import { BUNDLES, BUNDLE_LIST } from '../src/sim/content/research.ts';
import { RECIPE_LIST } from '../src/sim/content/recipes.ts';
import { ITEM_LIST } from '../src/sim/content/items.ts';
import { isReady, makeTree, researchable } from '../src/sim/research.ts';
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

// Combat (Stage 3), on a match with an idle CPU.
function combatMatch() {
  const s = createMatch({ mapId: 'basin', seed: 21, players: [{ name: 'A', color: 0 }, { name: 'CPU', color: 1, cpu: 'idle' }] });
  for (const p of s.players) p.explored.fill(1);
  return s;
}
const near = (s: ReturnType<typeof createMatch>, tile: number, n: number) => spreadTiles(s, tile, n);
{
  // 10 Minutemen ordered to attack the CPU's 3, which hold their ground. Twice, for determinism.
  const fight = () => {
    const s = combatMatch();
    const cpuUnits = s.units.filter((u) => u.owner === 2);
    const spot = unitTileOf(s, cpuUnits[0]);
    const mine = near(s, spot + 6 * s.size, 13).slice(3).map((t) => spawnUnit(s, 1, 'minuteman', t));
    step(s, [{ type: 'attack', player: 1, units: mine.map((u) => u.id), target: cpuUnits[0].id }]);
    for (let i = 0; i < 20 * 40; i++) {
      // Once the first falls, attack the next.
      const left = s.units.filter((u) => u.owner === 2);
      if (!left.length) break;
      const busy = s.units.some((u) => u.owner === 1 && u.order?.kind === 'attack');
      step(s, busy ? [] : [{ type: 'attack', player: 1, units: s.units.filter((u) => u.owner === 1).map((u) => u.id), target: left[0].id }]);
    }
    return { s, mineLeft: s.units.filter((u) => u.owner === 1).length - 3, cpuLeft: s.units.filter((u) => u.owner === 2).length, hash: stateHash(s), tick: s.tick };
  };
  const a = fight();
  const b = fight();
  if (a.cpuLeft !== 0) fail(`combat: 10 Minutemen left ${a.cpuLeft} of the CPU's 3 standing`);
  else if (a.hash !== b.hash) fail('combat: two runs of the same fight differ');
  else console.log(`Combat: 10 Minutemen beat the CPU's 3 in ${(a.tick / 20).toFixed(1)} s, losing ${10 - a.mineLeft}; two runs identical.`);
}
{
  // The Hub's pulse hurts enemy units near it.
  const s = combatMatch();
  const cpuHub = s.structures.find((t) => t.owner === 2 && t.kind === 'hub')!;
  const t = near(s, (cpuHub.y + cpuHub.h + 2) * s.size + cpuHub.x - 3, 1)[0];
  const u = spawnUnit(s, 1, 'minuteman', t);
  u.mode = 'directed';
  for (const o of s.units) if (o.owner === 2) o.hp = 0; // keep the CPU's Minutemen out of it
  step(s, []);
  for (let i = 0; i < 20 * 6; i++) step(s, []);
  const lost = UNITS.minuteman.hp - (s.units.find((o) => o.id === u.id)?.hp ?? 0);
  if (lost < PULSE_DAMAGE) fail(`pulse: a Minuteman next to the enemy Hub lost ${lost} health in 6 s`);
  else console.log(`Pulse: a Minuteman next to the CPU's Hub lost ${lost} health to its pulse in 6 s.`);
}
{
  // A Deployer makes Minutemen from parts given by hand; they gather at its rally point. Aggressive ones chase an enemy and come back.
  const s = combatMatch();
  const me = s.players[0];
  me.hub = { ironPlate: 500, ironRod: 500, wire: 500, cable: 500, screws: 500 };
  const hub = s.structures.find((t) => t.id === me.hubId)!;
  let spot: { x: number; y: number } | null = null;
  for (let r = 7; r < 16 && !spot; r++)
    for (let dy = -r; dy <= r && !spot; dy++)
      for (let dx = -r; dx <= r && !spot; dx++) if (canPlace(s, 1, 'deployer', hub.x + dx, hub.y + dy, 0).ok && canPlace(s, 1, 'solar', hub.x + dx + 4, hub.y + dy, 0).ok && canPlace(s, 1, 'solar', hub.x + dx + 4, hub.y + dy + 2, 0).ok && canPlace(s, 1, 'solar', hub.x + dx + 4, hub.y + dy - 2, 0).ok) spot = { x: hub.x + dx, y: hub.y + dy };
  if (!spot) fail('production: no room for a Deployer');
  else {
    step(s, [
      { type: 'build', player: 1, kind: 'deployer', x: spot.x, y: spot.y, rot: 0 },
      { type: 'build', player: 1, kind: 'solar', x: spot.x + 4, y: spot.y, rot: 0 },
      { type: 'build', player: 1, kind: 'solar', x: spot.x + 4, y: spot.y + 2, rot: 0 },
      { type: 'build', player: 1, kind: 'solar', x: spot.x + 4, y: spot.y - 2, rot: 0 },
    ]);
    const [dep, s1, s2, s3] = s.structures.slice(-4);
    const startHp = dep.hp;
    for (let i = 0; i < 20 * 8; i++) step(s, []);
    // Placed at a tenth of its health, then one tick of building already happened.
    if (startHp > Math.ceil(STRUCTURES.deployer.hp / 10) + 10 || dep.hp !== STRUCTURES.deployer.hp) fail(`build health: a Deployer went from ${startHp} to ${dep.hp} health (expected about ${Math.ceil(STRUCTURES.deployer.hp / 10)} to ${STRUCTURES.deployer.hp})`);
    step(s, [
      { type: 'line', player: 1, a: s2.id, b: s1.id },
      { type: 'line', player: 1, a: s1.id, b: s3.id },
      { type: 'line', player: 1, a: s3.id, b: dep.id },
      { type: 'produce', player: 1, id: dep.id, unit: 'minuteman' },
      { type: 'mode', player: 1, id: dep.id, mode: 'auto', imperative: 'aggressive' },
    ]);
    step(s, [{ type: 'give', player: 1, id: dep.id, item: 'ironPlate' }, { type: 'give', player: 1, id: dep.id, item: 'screws' }]);
    const before = s.units.filter((u) => u.owner === 1).length;
    for (let i = 0; i < 20 * 13; i++) step(s, []);
    const made = s.units.filter((u) => u.owner === 1 && u.source === dep.id);
    if (made.length !== 2) fail(`production: a Deployer made ${made.length} Minutemen in 13 s (expected 2 at 6 s each); units ${before} -> ${s.units.filter((u) => u.owner === 1).length}`);
    else console.log(`Production: a Deployer built in 8 s (health ${startHp} -> ${dep.hp}), then made 2 Minutemen in 13 s from parts given by hand.`);
    // An enemy walks into sight of the Aggressive Minutemen: they chase it, kill it and go back.
    for (let i = 0; i < 20 * 5; i++) step(s, []);
    const home = made[0].home;
    const t = near(s, made[0].home + 6, 1)[0];
    const enemy = spawnUnit(s, 2, 'minuteman', t, { mode: 'directed' });
    for (let i = 0; i < 20 * 20 && s.units.some((u) => u.id === enemy.id); i++) step(s, []);
    for (let i = 0; i < 20 * 6; i++) step(s, []);
    const back = s.units.find((u) => u.id === made[0].id);
    if (s.units.some((u) => u.id === enemy.id)) fail('aggressive: the Minutemen did not kill an enemy that walked into sight');
    else if (back && unitTileOf(s, back) !== home) fail('aggressive: a Minuteman did not go back to its rally point after the fight');
    else console.log('Aggressive: Deployer Minutemen chased and killed an enemy that came into sight, then went back to the rally point.');
    // The unit limit pauses production.
    for (let k = 0; k < UNIT_LIMIT; k++) spawnUnit(s, 1, 'minuteman', made[0].home);
    step(s, [{ type: 'give', player: 1, id: dep.id, item: 'ironPlate' }, { type: 'give', player: 1, id: dep.id, item: 'screws' }]);
    const count = s.units.filter((u) => u.owner === 1).length;
    for (let i = 0; i < 20 * 8; i++) step(s, []);
    if (s.units.filter((u) => u.owner === 1).length > count || dep.status !== 'atLimit') fail(`unit limit: production went on past the limit (status ${dep.status})`);
    else console.log(`Unit limit: at ${count} units the Deployer paused (status ${dep.status}).`);
  }
}
{
  // A unit placed by hand is made at the Hub, walks to the spot and holds it.
  const s = combatMatch();
  const me = s.players[0];
  me.hub = { ironPlate: 50, screws: 50 };
  const hub = s.structures.find((t) => t.id === me.hubId)!;
  const target = near(s, (hub.y - 6) * s.size + hub.x + 10, 1)[0];
  step(s, [{ type: 'placeUnit', player: 1, kind: 'minuteman', x: target % s.size, y: Math.floor(target / s.size) }]);
  const paid = 50 - (me.hub.ironPlate ?? 0);
  for (let i = 0; i < 20 * 15; i++) step(s, []);
  const placed = s.units.find((u) => u.owner === 1 && u.imperative === 'hold' && u.mode === 'auto');
  if (!placed || unitTileOf(s, placed) !== placed.home || placed.home !== target) fail(`hand-placed: no Minuteman holding the spot (paid ${paid} plates)`);
  else console.log(`Hand-placed: a Minuteman paid from the Hub (${paid} Iron Plate) was made there and holds the spot it was placed on.`);
}
{
  // Explore reveals fog on its own; Patrol walks its points in turn.
  const s = createMatch({ mapId: 'basin', seed: 33, players: [{ name: 'A', color: 0 }] });
  const me = s.players[0];
  const hub = s.structures[0];
  const t0 = spreadTiles(s, (hub.y + hub.h + 2) * s.size + hub.x + 2, 1)[0];
  const scout = spawnUnit(s, 1, 'minuteman', t0, { mode: 'auto', imperative: 'explore', home: t0 });
  const before = me.explored.reduce((a, v) => a + v, 0);
  for (let i = 0; i < 20 * 40; i++) step(s, []);
  const after = me.explored.reduce((a, v) => a + v, 0);
  if (after < before * 1.5) fail(`explore: explored tiles went from ${before} to ${after} in 40 s`);
  else console.log(`Explore: a Minuteman on Explore uncovered ${after - before} more tiles in 40 s on its own.`);
  const ring = spreadTiles(s, t0, 200);
  const pts = [ring[60], ring[120], ring[199]];
  const pat = spawnUnit(s, 1, 'minuteman', t0, { mode: 'auto', imperative: 'patrol', home: t0, patrol: pts });
  const visited = new Set<number>();
  for (let i = 0; i < 20 * 40; i++) {
    step(s, []);
    visited.add(unitTileOf(s, pat));
  }
  if (![t0, ...pts].every((t) => visited.has(t))) fail('patrol: a patrolling Minuteman did not visit all its points');
  else console.log('Patrol: a Minuteman on Patrol walked its home and all three patrol points in turn.');
}
{
  // Destroying a Hub puts its player out; everything they had goes (SPEC).
  const s = combatMatch();
  const cpu = s.players[1];
  const cpuHub = s.structures.find((t) => t.id === cpu.hubId)!;
  cpuHub.hp = 10;
  for (const o of s.units) if (o.owner === 2) o.hp = 0;
  const slots = near(s, (cpuHub.y + cpuHub.h) * s.size + cpuHub.x + 2, 4);
  const mine = slots.map((t) => spawnUnit(s, 1, 'minuteman', t));
  step(s, [{ type: 'attack', player: 1, units: mine.map((u) => u.id), target: cpuHub.id }]);
  for (let i = 0; i < 20 * 10 && !cpu.eliminated; i++) step(s, []);
  if (!cpu.eliminated || s.structures.some((t) => t.owner === 2) || s.units.some((u) => u.owner === 2)) fail('elimination: destroying the CPU Hub did not remove the CPU');
  else console.log('Elimination: destroying the CPU Hub put it out of the match and removed everything it had.');
}
{
  // Load: 4 players, 200 Aggressive Minutemen each, all meeting in the middle.
  const s = createMatch({ mapId: 'basin', seed: 99, players: [0, 1, 2, 3].map((c) => ({ name: 'P' + c, color: c })) });
  const c = s.size / 2;
  for (const p of s.players) {
    const hub = s.structures.find((t) => t.id === p.hubId)!;
    for (const t of spreadTiles(s, (hub.y + hub.h + 2) * s.size + hub.x + 2, 200).slice(3)) spawnUnit(s, p.id, 'minuteman', t, { mode: 'auto', imperative: 'aggressive', home: (c - 14) * s.size + c + 14 });
  }
  let worst = 0;
  const t0 = performance.now();
  for (let i = 0; i < 20 * 60; i++) {
    const a = performance.now();
    step(s, []);
    worst = Math.max(worst, performance.now() - a);
  }
  const avg = (performance.now() - t0) / (20 * 60);
  console.log(`Battle load: ${s.players.length} x 200 Aggressive Minutemen marching to one spot and fighting for 60 s: ${avg.toFixed(2)} ms a tick on average, worst ${worst.toFixed(1)} ms; ${s.units.length} left.`);
}

// Research (Stage 4a): the tree can always be finished.
{
  // Which items can be made with the bundles of tiers below t: raw resources (Drills from the
  // start; Crude Oil once Pumps are unlocked) and the products of unlocked recipes whose machine
  // is unlocked and whose inputs can be made.
  const machineBundle: Record<string, string> = { smelter: 'basics', constructor: 'basics', assembler: 'assembly', foundry: 'steel', refinery: 'oil', manufacturer: 'manufacturing' };
  const makeable = (tier: number) => {
    const ok = new Set<string>(['basics']);
    for (const bd of BUNDLE_LIST) if (bd.tier < tier) ok.add(bd.id);
    const items = new Set<string>(['ironOre', 'copperOre', 'goldOre', 'rawQuartz', 'coal', 'sulfur']);
    if (ok.has('oil')) items.add('crudeOil');
    for (let changed = true; changed; ) {
      changed = false;
      for (const rc of RECIPE_LIST) {
        if (!ok.has(rc.unlock) || !ok.has(machineBundle[rc.machine])) continue;
        if (!rc.inputs.every(([id]) => items.has(id))) continue;
        for (const [id] of rc.outputs)
          if (!items.has(id)) {
            items.add(id);
            changed = true;
          }
      }
    }
    return items;
  };
  for (const bd of BUNDLE_LIST) {
    const can = makeable(bd.tier);
    for (const [id] of bd.cost) if (!can.has(id)) fail(`research: ${bd.name} (tier ${bd.tier}) costs ${id}, which lower tiers cannot make`);
  }
  // Every spec material can be made once everything is researched.
  const all = makeable(99);
  for (const it of ITEM_LIST) if (!all.has(it.id)) fail(`research: nothing makes ${it.name}`);
  // Every structure's cost can be paid once its bundle is researched.
  for (const bd of BUNDLE_LIST) {
    const can = makeable(bd.tier + 1);
    for (const k of bd.structures) for (const [id] of STRUCTURES[k].cost) if (!can.has(id)) fail(`research: ${STRUCTURES[k].name} costs ${id}, not makeable by its tier`);
  }
  // Grids: for many seeds, every bundle is reachable by stepping to neighbors, tier by tier.
  let worst = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const tree = makeTree({ rng: seed * 7919 });
    const at = new Map(tree.map((c) => [`${c.col}:${c.row}`, c]));
    if (at.size !== tree.length) fail(`research: seed ${seed} put two bundles on one cell`);
    const seen = new Set([tree[0].id]);
    const queue = [tree[0]];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      for (const k of [`${c.col + 1}:${c.row}`, `${c.col - 1}:${c.row}`, `${c.col}:${c.row + 1}`, `${c.col}:${c.row - 1}`]) {
        const n = at.get(k);
        // Only step to the same tier or the next one up: no bundle needs a higher tier first.
        if (!n || seen.has(n.id) || n.col > c.col + 1 || (n.col > c.col && BUNDLES[n.id].tier > BUNDLES[c.id].tier + 1)) continue;
        seen.add(n.id);
        queue.push(n);
      }
    }
    if (seen.size !== tree.length) fail(`research: seed ${seed} leaves ${tree.length - seen.size} bundles out of reach`);
    worst = Math.max(worst, Math.max(...tree.map((c) => c.row)) + 1);
  }
  console.log(`Research: ${BUNDLE_LIST.length} bundles in ${Math.max(...BUNDLE_LIST.map((x) => x.tier))} tiers; every cost is made from lower tiers; 300 random grids all reachable (up to ${worst} rows).`);
}
{
  // Researching with a powered Laboratory; then an Assembler makes Reinforced Iron Plates; Coal
  // Generators burn coal fed by belt and by hand; a Pump, pipes and a Refinery make Plastic.
  const s = createMatch({ mapId: 'basin', seed: 41, players: [{ name: 'A', color: 0 }] });
  const me = s.players[0];
  me.explored.fill(1);
  me.hub = { ironPlate: 3000, ironRod: 2000, screws: 3000, wire: 2000, cable: 2000, reinforcedIronPlate: 500, rotor: 500, copperSheet: 2000, modularFrame: 300, steelPipe: 500, steelBeam: 500, motor: 300, smartPlating: 100, quickwire: 500, stator: 200, blackPowder: 300, quartzCrystal: 100, coal: 400 };
  const run = (n: number, cmds: Command[] = []) => {
    step(s, cmds);
    for (let i = 1; i < n; i++) step(s, []);
  };
  const hub = s.structures[0];
  const spot = (kind: StructureKind, rot = 0, avoid: { x: number; y: number; w: number; h: number }[] = [], near: { x: number; y: number } = hub, from = 6) => {
    for (let r = from; r < 40; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const x = near.x + dx;
          const y = near.y + dy;
          const { w, h } = { w: STRUCTURES[kind].w + 2, h: STRUCTURES[kind].h + 2 };
          if (avoid.some((a) => x < a.x + a.w + 1 && x + w > a.x - 1 && y < a.y + a.h + 1 && y + h > a.y - 1)) continue;
          if (canPlace(s, 1, kind, x, y, rot).ok && canPlace(s, 1, kind, x - 1, y - 1, rot).ok && canPlace(s, 1, kind, x + 1, y + 1, rot).ok) return { x, y };
        }
    throw new Error('no spot for ' + kind);
  };
  const used: { x: number; y: number; w: number; h: number }[] = [];
  const place = (kind: StructureKind, rot = 0) => {
    const p = spot(kind, rot, used);
    used.push({ x: p.x, y: p.y, w: STRUCTURES[kind].w, h: STRUCTURES[kind].h });
    run(1, [{ type: 'build', player: 1, kind, x: p.x, y: p.y, rot }]);
    return s.structures[s.structures.length - 1];
  };
  // Research needs a Laboratory with power.
  const first = [...researchable(me)][0];
  run(1, [{ type: 'research', player: 1, id: first }]);
  const refusedWithoutLab = !me.researched.includes(first);
  const lab = place('laboratory');
  const sol = [place('solar'), place('solar')];
  run(20 * 9, [{ type: 'line', player: 1, a: sol[0].id, b: sol[1].id }]);
  run(1, [{ type: 'line', player: 1, a: sol[1].id, b: lab.id }]);
  run(1, [{ type: 'research', player: 1, id: first }]);
  if (!refusedWithoutLab || !me.researched.includes(first)) fail(`research: refused without a Laboratory ${refusedWithoutLab}; researched ${me.researched.join(', ')}`);
  // Research everything that can be researched (ready bundles), as they open up.
  for (let pass = 0; pass < 12; pass++) for (const id of researchable(me)) run(1, [{ type: 'research', player: 1, id }]);
  // Hand the Hub what later tiers cost, then finish.
  me.hub = { ...me.hub, plastic: 500, rubber: 500, circuitBoard: 300, aiLimiter: 100, versatileFramework: 100, automatedWiring: 100 };
  for (let pass = 0; pass < 12; pass++) for (const id of researchable(me)) run(1, [{ type: 'research', player: 1, id }]);
  const ready = BUNDLE_LIST.filter((x) => isReady(x)).length;
  if (me.researched.length !== ready) fail(`research: ${me.researched.length} of ${ready} ready bundles researched`);
  else console.log(`Research: needed a powered Laboratory; then all ${ready} bundles built so far were researched, paid from the Hub.`);

  // Coal Generators: one fed by hand, powering an Assembler making Reinforced Iron Plates.
  const coalGen = place('coalGenerator');
  const asm = place('assembler');
  run(20 * 8, []);
  run(1, [{ type: 'line', player: 1, a: coalGen.id, b: asm.id }, { type: 'give', player: 1, id: coalGen.id, item: 'coal' }, { type: 'recipe', player: 1, id: asm.id, recipe: 'reinforcedIronPlate' }]);
  run(1, [{ type: 'give', player: 1, id: asm.id, item: 'ironPlate' }, { type: 'give', player: 1, id: asm.id, item: 'screws' }]);
  const coalBefore = coalGen.inv.coal ?? 0;
  run(20 * 40);
  const rip = asm.out.reinforcedIronPlate ?? 0;
  const burned = coalBefore - (coalGen.inv.coal ?? 0);
  // 15 MW of 75 MW is a fifth of full load: a coal lasts 4 s at full load, about 20 s here.
  if (rip < 3) fail(`coal power: an Assembler on a Coal Generator made ${rip} Reinforced Iron Plates in 40 s`);
  else if (burned > 4) fail(`coal power: ${burned} Coal burned in 40 s at a fifth of full load (expected about 2)`);
  else console.log(`Coal power: a Coal Generator fed by hand ran an Assembler (${rip} Reinforced Iron Plates in 40 s), burning ${burned} Coal at a fifth of full load.`);

  // Oil: a Pump on an oil node, a pipe to a Refinery making Plastic; Fuel by hand runs a Fuel Generator.
  const oilNode = s.map.nodes.find((n) => n.resource === 'oil' && canPlace(s, 1, 'pump', n.x, n.y, 0).ok)!;
  let pumped = false;
  for (let rot = 0; rot < 4 && !pumped; rot++) {
    const out = portsOf('pump', oilNode.x, oilNode.y, rot).find((p) => p.io === 'out')!;
    const d = out.dir;
    const tiles = Array.from({ length: 4 }, (_, k) => ({ x: out.ox + DX[d] * k, y: out.oy + DY[d] * k, dir: d }));
    if (!tiles.every((t) => canPlaceBelt(s, 1, 'pipe', t.x, t.y).ok)) continue;
    const ex = out.ox + DX[d] * 4;
    const ey = out.oy + DY[d] * 4;
    let ref: { x: number; y: number; rot: number } | null = null;
    for (let r = 0; r < 4 && !ref; r++)
      for (const p of portsOf('refinery', 0, 0, r)) if (p.io === 'in' && p.fluid && p.dir === (d + 2) % 4 && canPlace(s, 1, 'refinery', ex - p.x, ey - p.y, r).ok) ref = { x: ex - p.x, y: ey - p.y, rot: r };
    if (!ref) continue;
    run(1, [{ type: 'build', player: 1, kind: 'pump', x: oilNode.x, y: oilNode.y, rot }, { type: 'belts', player: 1, kind: 'pipe', tiles }, { type: 'build', player: 1, kind: 'refinery', ...ref }]);
    pumped = true;
  }
  if (!pumped) fail('oil: no room for a Pump, pipe and Refinery');
  else {
    const pump = s.structures.find((t) => t.kind === 'pump')!;
    const refinery = s.structures.find((t) => t.kind === 'refinery')!;
    const at = spot('fuelGenerator', 0, [pump, refinery], refinery, 2);
    run(1, [{ type: 'build', player: 1, kind: 'fuelGenerator', x: at.x, y: at.y, rot: 0 }]);
    const fg = s.structures[s.structures.length - 1];
    run(20 * 10);
    me.hub.fuel = 100;
    run(1, [{ type: 'line', player: 1, a: fg.id, b: pump.id }, { type: 'line', player: 1, a: fg.id, b: refinery.id }, { type: 'give', player: 1, id: fg.id, item: 'fuel' }, { type: 'recipe', player: 1, id: refinery.id, recipe: 'plastic' }]);
    run(20 * 30);
    const plastic = refinery.out.plastic ?? 0;
    const hor = refinery.out.heavyOilResidue ?? 0;
    if (plastic < 6 || hor < 3) fail(`oil: the Refinery made ${plastic} Plastic and ${hor} Heavy Oil Residue in 30 s (pump ${pump.status}, refinery ${refinery.status}, fuel gen ${fg.status})`);
    else console.log(`Oil: Pump -> 4 pipe tiles -> Refinery, run by a Fuel Generator on Fuel added by hand: ${plastic} Plastic and ${hor} Heavy Oil Residue in 30 s.`);
  }
}

// Walled off: units sent inside a ring of belts (which block units) stop at the nearest tile
// outside it, and finding that is quick (no search of the whole map).
{
  const s = createMatch({ mapId: 'basin', seed: 43, players: [{ name: 'A', color: 0 }] });
  const me = s.players[0];
  me.explored.fill(1);
  me.hub = { ironPlate: 500, ironRod: 500 };
  const hub = s.structures[0];
  // A ring of belt 7 tiles across, east of the Hub, on open ground.
  let ring: { x: number; y: number; dir: number }[] = [];
  let cx = 0;
  let cy = 0;
  search: for (let r = 10; r < 40; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        cx = hub.x + dx;
        cy = hub.y + dy;
        ring = [];
        for (let k = -3; k <= 3; k++) ring.push({ x: cx + k, y: cy - 3, dir: 0 }, { x: cx + k, y: cy + 3, dir: 0 }, ...(k > -3 && k < 3 ? [{ x: cx - 3, y: cy + k, dir: 1 }, { x: cx + 3, y: cy + k, dir: 1 }] : []));
        let open = true;
        for (let y = cy - 4; y <= cy + 4 && open; y++) for (let x = cx - 4; x <= cx + 4 && open; x++) if (!canPlaceBelt(s, 1, 'belt', x, y).ok || s.map.terrain[y * s.size + x] !== Tile.Ground) open = false;
        if (open) break search;
      }
  const units: number[] = [];
  for (const t of spreadTiles(s, (hub.y + 8) * s.size + hub.x - 8, 120)) units.push(spawnUnit(s, 1, 'minuteman', t, { mode: 'directed' }).id);
  step(s, [{ type: 'belts', player: 1, kind: 'belt', tiles: ring }]);
  const t0 = performance.now();
  step(s, [{ type: 'move', player: 1, units, tx: cx, ty: cy }]);
  const ms = performance.now() - t0;
  for (let i = 0; i < 20 * 40; i++) step(s, []);
  const inside = s.units.filter((u) => Math.abs(Math.floor(u.x / FP) - cx) < 3 && Math.abs(Math.floor(u.y / FP) - cy) < 3).length;
  const near = s.units.filter((u) => Math.max(Math.abs(Math.floor(u.x / FP) - cx), Math.abs(Math.floor(u.y / FP) - cy)) <= 6).length;
  if (inside > 0 || near < 10 || ms > 40) fail(`walled off: ${inside} units got inside the ring, ${near} stopped next to it, the order took ${ms.toFixed(1)} ms`);
  else console.log(`Walled off: 120 units ordered inside a ring of belts; the order took ${ms.toFixed(1)} ms, none got in, ${near} stopped right outside.`);
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
