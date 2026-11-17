// Every structure in SPEC "Structures", plus the Power Pole (Caleb after Stage 1: power poles
// with cables that connect to poles and structures), with its footprint, health, build time,
// cost, power and ports. These numbers are the builder's (docs/decisions.md) and are tuned in
// playtesting; where Satisfactory has the same building, its cost and power are followed.
// What each structure does is built in the stage that builds it.

import type { ItemId } from './items';

export type StructureKind =
  | 'hub'
  | 'drill'
  | 'pump'
  | 'smelter'
  | 'foundry'
  | 'constructor'
  | 'assembler'
  | 'refinery'
  | 'manufacturer'
  | 'deployer'
  | 'garage'
  | 'landingPad'
  | 'commandPost'
  | 'solar'
  | 'coalGenerator'
  | 'fuelGenerator'
  | 'powerPole'
  | 'depot'
  | 'laboratory'
  | 'gunTurret'
  | 'arcPile'
  | 'mortar';

export type StructureCategory = 'hub' | 'gatherer' | 'processor' | 'production' | 'organization' | 'power' | 'storage' | 'research' | 'defense';

/** A side of a footprint: 0 +x, 1 +y, 2 -x, 3 -y (before rotating). */
export type Side = 0 | 1 | 2 | 3;

/** An item port on the edge of a footprint, before rotating: on `side`, `offset` tiles along it. */
export interface PortDef {
  side: Side;
  offset: number;
  io: 'in' | 'out';
}

export type Cost = readonly (readonly [ItemId, number])[];

export interface StructureDef {
  kind: StructureKind;
  name: string;
  category: StructureCategory;
  /** Footprint in tiles before rotating. */
  w: number;
  h: number;
  hp: number;
  /** Seconds from placing to finished (Caleb: a bit of build time, scaling with the structure). */
  buildSeconds: number;
  /** Paid from the Hub when placed; refunded in full when demolished (SPEC). */
  cost: Cost;
  /** MW drawn while working. */
  power: number;
  /** MW produced (generators). */
  powerOut: number;
  /** How many power lines can attach. */
  maxLines: number;
  ports: PortDef[];
  /** Available at the start of a match (SPEC "Research", "Available at the start"). */
  atStart: boolean;
  /** Must sit exactly on a node of this kind. */
  onNode?: 'solid' | 'fluid';
  blurb: string;
}

const IN_BACK: PortDef = { side: 3, offset: 0, io: 'in' };
const OUT_FRONT: PortDef = { side: 1, offset: 0, io: 'out' };
const inRow = (n: number): PortDef[] => Array.from({ length: n }, (_, i) => ({ side: 3, offset: i, io: 'in' }) as PortDef);

const defs: StructureDef[] = [
  { kind: 'hub', name: 'Hub', category: 'hub', w: 5, h: 5, hp: 5000, buildSeconds: 0, cost: [], power: 0, powerOut: 0, maxLines: 0, ports: [], atStart: false, blurb: 'Your inventory and where directives are sent from. If it is destroyed, you are out.' },
  { kind: 'drill', name: 'Drill', category: 'gatherer', w: 2, h: 2, hp: 400, buildSeconds: 4, cost: [['ironPlate', 10], ['ironRod', 10]], power: 5, powerOut: 0, maxLines: 2, ports: [OUT_FRONT], atStart: true, onNode: 'solid', blurb: 'Gathers a solid resource. Placed on a node.' },
  { kind: 'pump', name: 'Pump', category: 'gatherer', w: 2, h: 2, hp: 400, buildSeconds: 4, cost: [['ironPlate', 15], ['ironRod', 15]], power: 20, powerOut: 0, maxLines: 2, ports: [OUT_FRONT], atStart: false, onNode: 'fluid', blurb: 'Gathers oil. Placed on an oil node.' },
  { kind: 'smelter', name: 'Smelter', category: 'processor', w: 2, h: 2, hp: 400, buildSeconds: 5, cost: [['ironOre', 40]], power: 4, powerOut: 0, maxLines: 2, ports: [IN_BACK, OUT_FRONT], atStart: true, blurb: 'Turns ore into ingots.' },
  { kind: 'foundry', name: 'Foundry', category: 'processor', w: 3, h: 3, hp: 600, buildSeconds: 7, cost: [['ironPlate', 30], ['ironRod', 30]], power: 16, powerOut: 0, maxLines: 2, ports: [{ side: 3, offset: 0, io: 'in' }, { side: 3, offset: 2, io: 'in' }, { side: 1, offset: 1, io: 'out' }], atStart: false, blurb: 'Combines two materials into alloys such as steel.' },
  { kind: 'constructor', name: 'Constructor', category: 'processor', w: 2, h: 3, hp: 400, buildSeconds: 5, cost: [['ironIngot', 30]], power: 4, powerOut: 0, maxLines: 2, ports: [IN_BACK, OUT_FRONT], atStart: true, blurb: 'Turns one material into a part.' },
  { kind: 'assembler', name: 'Assembler', category: 'processor', w: 3, h: 3, hp: 600, buildSeconds: 7, cost: [['ironPlate', 30], ['cable', 20]], power: 15, powerOut: 0, maxLines: 2, ports: [{ side: 3, offset: 0, io: 'in' }, { side: 3, offset: 2, io: 'in' }, { side: 1, offset: 1, io: 'out' }], atStart: false, blurb: 'Turns two materials into a part.' },
  { kind: 'refinery', name: 'Refinery', category: 'processor', w: 3, h: 4, hp: 600, buildSeconds: 9, cost: [['ironPlate', 40], ['cable', 30]], power: 30, powerOut: 0, maxLines: 2, ports: [{ side: 3, offset: 1, io: 'in' }, { side: 1, offset: 1, io: 'out' }], atStart: false, blurb: 'Processes oil and other fluids.' },
  { kind: 'manufacturer', name: 'Manufacturer', category: 'processor', w: 4, h: 4, hp: 800, buildSeconds: 12, cost: [['ironPlate', 60], ['cable', 50]], power: 55, powerOut: 0, maxLines: 2, ports: [...inRow(4), { side: 1, offset: 1, io: 'out' }], atStart: false, blurb: 'Turns three or four materials into an advanced part.' },
  { kind: 'deployer', name: 'Deployer', category: 'production', w: 3, h: 3, hp: 800, buildSeconds: 8, cost: [['ironPlate', 20], ['ironRod', 20], ['screws', 40]], power: 10, powerOut: 0, maxLines: 2, ports: inRow(3), atStart: true, blurb: 'Produces infantry and the Mechanic.' },
  { kind: 'garage', name: 'Garage', category: 'production', w: 4, h: 4, hp: 1000, buildSeconds: 10, cost: [['ironPlate', 50], ['ironRod', 30]], power: 20, powerOut: 0, maxLines: 2, ports: inRow(4), atStart: false, blurb: 'Produces vehicles and the Hauler.' },
  { kind: 'landingPad', name: 'Landing Pad', category: 'production', w: 4, h: 4, hp: 1000, buildSeconds: 10, cost: [['ironPlate', 50], ['cable', 30]], power: 30, powerOut: 0, maxLines: 2, ports: inRow(4), atStart: false, blurb: 'Produces aircraft.' },
  { kind: 'commandPost', name: 'Command Post', category: 'organization', w: 2, h: 2, hp: 600, buildSeconds: 6, cost: [['ironPlate', 20], ['cable', 10]], power: 2, powerOut: 0, maxLines: 2, ports: [], atStart: false, blurb: 'Gives extra directives to units within its radius.' },
  { kind: 'solar', name: 'Solar Generator', category: 'power', w: 2, h: 2, hp: 250, buildSeconds: 3, cost: [['ironPlate', 5], ['wire', 8]], power: 0, powerOut: 4, maxLines: 2, ports: [], atStart: true, blurb: 'Power without fuel. Weak for the space it takes.' },
  { kind: 'coalGenerator', name: 'Coal Generator', category: 'power', w: 3, h: 3, hp: 600, buildSeconds: 6, cost: [['ironPlate', 30], ['cable', 20]], power: 0, powerOut: 75, maxLines: 4, ports: [{ side: 3, offset: 1, io: 'in' }], atStart: false, blurb: 'Burns coal for power.' },
  { kind: 'fuelGenerator', name: 'Fuel Generator', category: 'power', w: 3, h: 3, hp: 600, buildSeconds: 7, cost: [['ironPlate', 40], ['cable', 30]], power: 0, powerOut: 250, maxLines: 4, ports: [{ side: 3, offset: 1, io: 'in' }], atStart: false, blurb: 'Burns fuel for power.' },
  { kind: 'powerPole', name: 'Power Pole', category: 'power', w: 1, h: 1, hp: 150, buildSeconds: 1, cost: [['ironRod', 1], ['wire', 3]], power: 0, powerOut: 0, maxLines: 4, ports: [], atStart: true, blurb: 'Carries power. Connect power lines between poles and structures.' },
  { kind: 'depot', name: 'Depot', category: 'storage', w: 2, h: 2, hp: 500, buildSeconds: 3, cost: [['ironPlate', 10], ['ironRod', 10]], power: 1, powerOut: 0, maxLines: 2, ports: [IN_BACK, OUT_FRONT], atStart: true, blurb: 'Holds anything. Not connected to the Hub: move items to the Hub by hand.' },
  { kind: 'laboratory', name: 'Laboratory', category: 'research', w: 3, h: 3, hp: 600, buildSeconds: 8, cost: [['ironPlate', 40], ['cable', 20], ['screws', 100]], power: 5, powerOut: 0, maxLines: 2, ports: [], atStart: true, blurb: 'Research new materials and units.' },
  { kind: 'gunTurret', name: 'Gun Turret', category: 'defense', w: 2, h: 2, hp: 600, buildSeconds: 5, cost: [['ironPlate', 20], ['ironRod', 10]], power: 2, powerOut: 0, maxLines: 2, ports: [IN_BACK], atStart: false, blurb: 'Fires Screws at ground targets.' },
  { kind: 'arcPile', name: 'Arc Pile', category: 'defense', w: 2, h: 2, hp: 600, buildSeconds: 6, cost: [['ironPlate', 20], ['cable', 20]], power: 10, powerOut: 0, maxLines: 2, ports: [], atStart: false, blurb: 'Fires electricity. Hits ground and air.' },
  { kind: 'mortar', name: 'Mortar', category: 'defense', w: 2, h: 2, hp: 600, buildSeconds: 6, cost: [['ironPlate', 25], ['ironRod', 15]], power: 3, powerOut: 0, maxLines: 2, ports: [IN_BACK], atStart: false, blurb: 'Long range area damage. Fires any material.' },
];

export const STRUCTURES = Object.fromEntries(defs.map((d) => [d.kind, d])) as Record<StructureKind, StructureDef>;
export const STRUCTURE_LIST = defs;

/** Footprint after rotation: an odd number of quarter turns swaps width and height. */
export function footprint(kind: StructureKind, rot: number): { w: number; h: number } {
  const d = STRUCTURES[kind];
  return rot & 1 ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}

/** Steps for directions 0 +x, 1 +y, 2 -x, 3 -y. */
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;

export interface Port {
  io: 'in' | 'out';
  /** The footprint tile the port is on. */
  x: number;
  y: number;
  /** The direction the port faces (outward). */
  dir: number;
  /** The tile just outside the port, where a belt or another structure's port must be. */
  ox: number;
  oy: number;
}

/**
 * A structure's ports on the map. Rotation turns the footprint a quarter turn at a time:
 * local tile (lx, ly) of a W x H footprint goes to (H - 1 - ly, lx), and every side's
 * direction moves on by one.
 */
export function portsOf(kind: StructureKind, x: number, y: number, rot: number): Port[] {
  const d = STRUCTURES[kind];
  const r = ((rot % 4) + 4) % 4;
  return d.ports.map((p) => {
    let lx: number;
    let ly: number;
    if (p.side === 0) [lx, ly] = [d.w - 1, p.offset];
    else if (p.side === 1) [lx, ly] = [p.offset, d.h - 1];
    else if (p.side === 2) [lx, ly] = [0, p.offset];
    else [lx, ly] = [p.offset, 0];
    let w = d.w;
    let h = d.h;
    for (let i = 0; i < r; i++) {
      [lx, ly] = [h - 1 - ly, lx];
      [w, h] = [h, w];
    }
    const dir = (p.side + r) % 4;
    const tx = x + lx;
    const ty = y + ly;
    return { io: p.io, x: tx, y: ty, dir, ox: tx + DX[dir], oy: ty + DY[dir] };
  });
}
