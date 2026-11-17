// Every structure in SPEC "Structures", with its footprint on the grid. Footprints and
// health are the builder's numbers (docs/decisions.md) and are tuned in playtesting.
// What each structure does is built in the stage that builds it; Stage 1 only places them.

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
  | 'depot'
  | 'laboratory'
  | 'gunTurret'
  | 'arcPile'
  | 'mortar';

export type StructureCategory = 'hub' | 'gatherer' | 'processor' | 'production' | 'organization' | 'power' | 'storage' | 'research' | 'defense';

export interface StructureDef {
  kind: StructureKind;
  name: string;
  category: StructureCategory;
  /** Footprint in tiles before rotating. */
  w: number;
  h: number;
  hp: number;
  /** Available at the start of a match (SPEC "Research", "Available at the start"). */
  atStart: boolean;
  /** Must sit exactly on a node of this kind. */
  onNode?: 'solid' | 'fluid';
  blurb: string;
}

const defs: StructureDef[] = [
  { kind: 'hub', name: 'Hub', category: 'hub', w: 5, h: 5, hp: 5000, atStart: false, blurb: 'Your inventory and where directives are sent from. If it is destroyed, you are out.' },
  { kind: 'drill', name: 'Drill', category: 'gatherer', w: 2, h: 2, hp: 400, atStart: true, onNode: 'solid', blurb: 'Gathers a solid resource. Placed on a node.' },
  { kind: 'pump', name: 'Pump', category: 'gatherer', w: 2, h: 2, hp: 400, atStart: false, onNode: 'fluid', blurb: 'Gathers oil. Placed on an oil node.' },
  { kind: 'smelter', name: 'Smelter', category: 'processor', w: 2, h: 2, hp: 400, atStart: true, blurb: 'Turns ore into ingots.' },
  { kind: 'foundry', name: 'Foundry', category: 'processor', w: 3, h: 3, hp: 600, atStart: false, blurb: 'Combines two materials into alloys such as steel.' },
  { kind: 'constructor', name: 'Constructor', category: 'processor', w: 2, h: 3, hp: 400, atStart: true, blurb: 'Turns one material into a part.' },
  { kind: 'assembler', name: 'Assembler', category: 'processor', w: 3, h: 3, hp: 600, atStart: false, blurb: 'Turns two materials into a part.' },
  { kind: 'refinery', name: 'Refinery', category: 'processor', w: 3, h: 4, hp: 600, atStart: false, blurb: 'Processes oil and other fluids.' },
  { kind: 'manufacturer', name: 'Manufacturer', category: 'processor', w: 4, h: 4, hp: 800, atStart: false, blurb: 'Turns three or four materials into an advanced part.' },
  { kind: 'deployer', name: 'Deployer', category: 'production', w: 3, h: 3, hp: 800, atStart: true, blurb: 'Produces infantry and the Mechanic.' },
  { kind: 'garage', name: 'Garage', category: 'production', w: 4, h: 4, hp: 1000, atStart: false, blurb: 'Produces vehicles and the Hauler.' },
  { kind: 'landingPad', name: 'Landing Pad', category: 'production', w: 4, h: 4, hp: 1000, atStart: false, blurb: 'Produces aircraft.' },
  { kind: 'commandPost', name: 'Command Post', category: 'organization', w: 2, h: 2, hp: 600, atStart: false, blurb: 'Gives extra directives to units within its radius.' },
  { kind: 'solar', name: 'Solar Generator', category: 'power', w: 2, h: 2, hp: 250, atStart: true, blurb: 'Power without fuel. Weak for the space it takes.' },
  { kind: 'coalGenerator', name: 'Coal Generator', category: 'power', w: 3, h: 3, hp: 600, atStart: false, blurb: 'Burns coal for power.' },
  { kind: 'fuelGenerator', name: 'Fuel Generator', category: 'power', w: 3, h: 3, hp: 600, atStart: false, blurb: 'Burns fuel for power.' },
  { kind: 'depot', name: 'Depot', category: 'storage', w: 2, h: 2, hp: 500, atStart: true, blurb: 'Holds anything. Not connected to the Hub.' },
  { kind: 'laboratory', name: 'Laboratory', category: 'research', w: 3, h: 3, hp: 600, atStart: true, blurb: 'Research new materials and units.' },
  { kind: 'gunTurret', name: 'Gun Turret', category: 'defense', w: 2, h: 2, hp: 600, atStart: false, blurb: 'Fires Screws at ground targets.' },
  { kind: 'arcPile', name: 'Arc Pile', category: 'defense', w: 2, h: 2, hp: 600, atStart: false, blurb: 'Fires electricity. Hits ground and air.' },
  { kind: 'mortar', name: 'Mortar', category: 'defense', w: 2, h: 2, hp: 600, atStart: false, blurb: 'Long range area damage. Fires any material.' },
];

export const STRUCTURES = Object.fromEntries(defs.map((d) => [d.kind, d])) as Record<StructureKind, StructureDef>;
export const STRUCTURE_LIST = defs;

/** Footprint after rotation: rot 1 swaps width and height. */
export function footprint(kind: StructureKind, rot: number): { w: number; h: number } {
  const d = STRUCTURES[kind];
  return rot & 1 ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}
