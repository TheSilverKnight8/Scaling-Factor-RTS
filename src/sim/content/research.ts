import type { ItemId } from './items';
import type { Cost, StructureKind } from './structures';
import type { UnitKind } from './units';

// Research (SPEC "Research"): done at the Laboratory, one bundle at a time, instantly, paid from
// the Hub. Each bundle unlocks a small set, like Satisfactory's milestones (Caleb). Bundles sit in
// tiers; every player gets the tiers laid out at random on a grid (Caleb) and researches any
// bundle next to one already researched.
//
// No bundle can be locked out: a bundle's cost uses only items whose recipe, machine and inputs
// come from bundles of a lower tier, and each tier's column on the grid touches the one before
// (checked by npm run check:sim). Bundles whose content is built in a later stage are shown but
// cannot be researched yet; they do not block the way to the bundles around them.

export interface Bundle {
  id: string;
  name: string;
  tier: number;
  cost: Cost;
  structures: StructureKind[];
  units: UnitKind[];
  /** Transport it unlocks: 'pipe', 'rail'. */
  transport: string[];
  /** The stage that builds its content, while that stage is still to come. */
  stage?: '4c';
}

const b = (id: string, name: string, tier: number, cost: [ItemId, number][], unlocks: { structures?: StructureKind[]; units?: UnitKind[]; transport?: string[] } = {}, stage?: '4c'): Bundle => ({
  id,
  name,
  tier,
  cost,
  structures: unlocks.structures ?? [],
  units: unlocks.units ?? [],
  transport: unlocks.transport ?? [],
  stage,
});

export const BUNDLE_LIST: Bundle[] = [
  // Known from the start (SPEC: the most basic iron and copper research).
  b('basics', 'Basics', 0, [], { structures: ['drill', 'smelter', 'constructor', 'deployer', 'depot', 'solar', 'laboratory', 'powerPole'], units: ['minuteman'], transport: ['belt', 'splitter', 'merger'] }),
  // Tier 1: paid with the starting materials.
  b('assembly', 'Part Assembly', 1, [['ironPlate', 60], ['ironRod', 40], ['screws', 150], ['cable', 20]], { structures: ['assembler'] }),
  b('coalPower', 'Coal Power', 1, [['ironPlate', 50], ['ironRod', 50], ['cable', 40]], { structures: ['coalGenerator'] }),
  b('copperSheet', 'Copper Sheets', 1, [['ironPlate', 40], ['wire', 80]]),
  b('gunpowder', 'Black Powder', 1, [['ironPlate', 40], ['screws', 100], ['cable', 20]]),
  b('haulers', 'Haulers', 1, [['ironPlate', 80], ['ironRod', 60], ['screws', 100]], { structures: ['garage'], units: ['hauler'] }),
  b('riflemen', 'Riflemen', 1, [['ironPlate', 60], ['ironRod', 60], ['wire', 60]], { units: ['rifleman'] }, '4c'),
  b('turrets', 'Gun Turrets', 1, [['ironPlate', 80], ['screws', 150], ['cable', 30]], { structures: ['gunTurret'] }, '4c'),
  // Tier 2: paid with tier 1 parts.
  b('steel', 'Steel', 2, [['reinforcedIronPlate', 20], ['rotor', 10], ['ironPlate', 100]], { structures: ['foundry'] }),
  b('gold', 'Gold', 2, [['reinforcedIronPlate', 10], ['copperSheet', 50], ['cable', 50]]),
  b('quartz', 'Quartz', 2, [['reinforcedIronPlate', 10], ['copperSheet', 30], ['cable', 80]]),
  b('frames', 'Modular Frames', 2, [['reinforcedIronPlate', 20], ['rotor', 20]]),
  b('motors', 'Motors', 2, [['reinforcedIronPlate', 15], ['rotor', 15], ['copperSheet', 50]]),
  b('compactedCoal', 'Compacted Coal', 2, [['reinforcedIronPlate', 10], ['screws', 200], ['copperSheet', 40]]),
  b('commandPost', 'Command Post', 2, [['reinforcedIronPlate', 20], ['rotor', 10], ['cable', 80]], { structures: ['commandPost'] }),
  b('assault', 'Assault Infantry', 2, [['reinforcedIronPlate', 30], ['rotor', 10], ['blackPowder', 40]], { units: ['burner', 'vanguard'] }, '4c'),
  b('mechanics', 'Mechanics', 2, [['reinforcedIronPlate', 20], ['rotor', 20], ['cable', 60]], { units: ['mechanic'] }, '4c'),
  b('mortars', 'Mortars', 2, [['reinforcedIronPlate', 25], ['rotor', 10], ['blackPowder', 50]], { structures: ['mortar'] }, '4c'),
  // Tier 3: paid with tier 2 parts.
  b('oil', 'Oil Processing', 3, [['modularFrame', 20], ['steelPipe', 60], ['motor', 10]], { structures: ['pump', 'refinery'], transport: ['pipe'] }),
  b('fuelPower', 'Fuel Power', 3, [['motor', 20], ['steelBeam', 50], ['smartPlating', 20]], { structures: ['fuelGenerator'] }),
  b('electronics', 'Electronics', 3, [['quickwire', 100], ['stator', 20], ['copperSheet', 50]]),
  b('smokeless', 'Smokeless Powder', 3, [['steelPipe', 30], ['blackPowder', 80], ['quartzCrystal', 20]]),
  b('framework', 'Industrial Parts', 3, [['modularFrame', 15], ['stator', 20], ['steelBeam', 30]]),
  b('rails', 'Rails', 3, [['steelBeam', 60], ['steelPipe', 60], ['motor', 10]], { structures: ['railStation'], transport: ['rail'] }),
  b('armor', 'Armor', 3, [['motor', 20], ['steelPipe', 50], ['modularFrame', 10]], { units: ['tank', 'rocketTank'] }, '4c'),
  b('aviation', 'Aviation', 3, [['motor', 20], ['smartPlating', 20], ['quickwire', 100]], { structures: ['landingPad'], units: ['fighter'] }, '4c'),
  b('arcPile', 'Arc Piles', 3, [['stator', 20], ['quickwire', 80], ['steelBeam', 20]], { structures: ['arcPile'] }, '4c'),
  // Tier 4: paid with tier 3 parts.
  b('manufacturing', 'Manufacturing', 4, [['circuitBoard', 30], ['plastic', 60], ['versatileFramework', 20]], { structures: ['manufacturer'] }),
  b('supercomputer', 'Supercomputers', 4, [['aiLimiter', 20], ['circuitBoard', 50], ['rubber', 100]]),
  b('turbofuel', 'Turbofuel', 4, [['circuitBoard', 30], ['rubber', 60], ['automatedWiring', 10]]),
  b('heavy', 'Heavy Units', 4, [['automatedWiring', 20], ['versatileFramework', 20], ['smokelessPowder', 60]], { units: ['cyclops', 'gunship'] }, '4c'),
];

export const BUNDLES = Object.fromEntries(BUNDLE_LIST.map((x) => [x.id, x])) as Record<string, Bundle>;
export const TIERS = Math.max(...BUNDLE_LIST.map((x) => x.tier));
