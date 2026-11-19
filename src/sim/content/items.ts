import type { ResourceId } from './resources';

// Items: the basic resources as gathered, and the materials made from them. Names follow
// Satisfactory (SPEC "Resources and materials"), with Gold in Caterium's place. Fluids and fuel
// energy follow Satisfactory's game data. Research unlocks the recipes that make them.

export type ItemId =
  | 'ironOre'
  | 'copperOre'
  | 'goldOre'
  | 'rawQuartz'
  | 'coal'
  | 'crudeOil'
  | 'sulfur'
  | 'ironIngot'
  | 'copperIngot'
  | 'goldIngot'
  | 'steelIngot'
  | 'ironPlate'
  | 'ironRod'
  | 'screws'
  | 'wire'
  | 'cable'
  | 'copperSheet'
  | 'quickwire'
  | 'reinforcedIronPlate'
  | 'rotor'
  | 'modularFrame'
  | 'smartPlating'
  | 'steelBeam'
  | 'steelPipe'
  | 'versatileFramework'
  | 'stator'
  | 'motor'
  | 'automatedWiring'
  | 'quartzCrystal'
  | 'silica'
  | 'crystalOscillator'
  | 'plastic'
  | 'rubber'
  | 'polymerResin'
  | 'petroleumCoke'
  | 'heavyOilResidue'
  | 'fuel'
  | 'circuitBoard'
  | 'computer'
  | 'aiLimiter'
  | 'highSpeedConnector'
  | 'supercomputer'
  | 'modularEngine'
  | 'blackPowder'
  | 'smokelessPowder'
  | 'compactedCoal'
  | 'turbofuel';

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Carried in pipes, not on belts (Satisfactory's fluids). */
  fluid?: boolean;
  /** Energy when burned in a generator, in MJ (Satisfactory's values; SPEC: fuel is Coal, Compacted Coal, Fuel, Turbofuel). */
  energy?: number;
}

/** Every item, in a fixed order (SPEC "Materials list"). Anything that walks over items does it in this order. */
export const ITEM_LIST: ItemDef[] = [
  { id: 'ironOre', name: 'Iron Ore' },
  { id: 'copperOre', name: 'Copper Ore' },
  { id: 'goldOre', name: 'Gold Ore' },
  { id: 'rawQuartz', name: 'Raw Quartz' },
  { id: 'coal', name: 'Coal', energy: 300 },
  { id: 'crudeOil', name: 'Crude Oil', fluid: true },
  { id: 'sulfur', name: 'Sulfur' },
  { id: 'ironIngot', name: 'Iron Ingot' },
  { id: 'copperIngot', name: 'Copper Ingot' },
  { id: 'goldIngot', name: 'Gold Ingot' },
  { id: 'steelIngot', name: 'Steel Ingot' },
  { id: 'ironPlate', name: 'Iron Plate' },
  { id: 'ironRod', name: 'Iron Rod' },
  { id: 'screws', name: 'Screws' },
  { id: 'wire', name: 'Wire' },
  { id: 'cable', name: 'Cable' },
  { id: 'copperSheet', name: 'Copper Sheet' },
  { id: 'quickwire', name: 'Quickwire' },
  { id: 'reinforcedIronPlate', name: 'Reinforced Iron Plate' },
  { id: 'rotor', name: 'Rotor' },
  { id: 'modularFrame', name: 'Modular Frame' },
  { id: 'smartPlating', name: 'Smart Plating' },
  { id: 'steelBeam', name: 'Steel Beam' },
  { id: 'steelPipe', name: 'Steel Pipe' },
  { id: 'versatileFramework', name: 'Versatile Framework' },
  { id: 'stator', name: 'Stator' },
  { id: 'motor', name: 'Motor' },
  { id: 'automatedWiring', name: 'Automated Wiring' },
  { id: 'quartzCrystal', name: 'Quartz Crystal' },
  { id: 'silica', name: 'Silica' },
  { id: 'crystalOscillator', name: 'Crystal Oscillator' },
  { id: 'plastic', name: 'Plastic' },
  { id: 'rubber', name: 'Rubber' },
  { id: 'polymerResin', name: 'Polymer Resin' },
  { id: 'petroleumCoke', name: 'Petroleum Coke' },
  { id: 'heavyOilResidue', name: 'Heavy Oil Residue', fluid: true },
  { id: 'fuel', name: 'Fuel', fluid: true, energy: 750 },
  { id: 'circuitBoard', name: 'Circuit Board' },
  { id: 'computer', name: 'Computer' },
  { id: 'aiLimiter', name: 'AI Limiter' },
  { id: 'highSpeedConnector', name: 'High-Speed Connector' },
  { id: 'supercomputer', name: 'Supercomputer' },
  { id: 'modularEngine', name: 'Modular Engine' },
  { id: 'blackPowder', name: 'Black Powder' },
  { id: 'smokelessPowder', name: 'Smokeless Powder' },
  { id: 'compactedCoal', name: 'Compacted Coal', energy: 630 },
  { id: 'turbofuel', name: 'Turbofuel', fluid: true, energy: 2000 },
];

export const ITEMS = Object.fromEntries(ITEM_LIST.map((d) => [d.id, d])) as Record<ItemId, ItemDef>;
export const ITEM_IDS: ItemId[] = ITEM_LIST.map((d) => d.id);

/** What a Drill (or Pump) on a node of each resource gathers. */
export const RESOURCE_ITEM: Record<ResourceId, ItemId> = {
  iron: 'ironOre',
  copper: 'copperOre',
  gold: 'goldOre',
  quartz: 'rawQuartz',
  coal: 'coal',
  oil: 'crudeOil',
  sulfur: 'sulfur',
};

/** A bag of items: item id to count. Missing means none. */
export type Bag = Partial<Record<ItemId, number>>;

export function bagTotal(b: Bag): number {
  let n = 0;
  for (const id of ITEM_IDS) n += b[id] ?? 0;
  return n;
}

export function bagAdd(b: Bag, id: ItemId, n: number) {
  const v = (b[id] ?? 0) + n;
  if (v > 0) b[id] = v;
  else delete b[id];
}

export function bagHas(b: Bag, cost: readonly (readonly [ItemId, number])[]): boolean {
  return cost.every(([id, n]) => (b[id] ?? 0) >= n);
}

export const isFluid = (id: ItemId) => ITEMS[id].fluid === true;
