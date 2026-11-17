import type { ResourceId } from './resources';

// Items: the basic resources as gathered, and the materials made from them. Names follow the
// Satisfactory wiki (SPEC "Resources and materials"), with Gold in Caterium's place. Stage 2
// has the raw resources and the starting iron and copper materials; research (Stage 4) adds
// the rest of the spec's materials list.

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
  | 'ironPlate'
  | 'ironRod'
  | 'screws'
  | 'wire'
  | 'cable';

export interface ItemDef {
  id: ItemId;
  name: string;
  fluid?: boolean;
}

/** Every item, in a fixed order. Anything that walks over items does it in this order. */
export const ITEM_LIST: ItemDef[] = [
  { id: 'ironOre', name: 'Iron Ore' },
  { id: 'copperOre', name: 'Copper Ore' },
  { id: 'goldOre', name: 'Gold Ore' },
  { id: 'rawQuartz', name: 'Raw Quartz' },
  { id: 'coal', name: 'Coal' },
  { id: 'crudeOil', name: 'Crude Oil', fluid: true },
  { id: 'sulfur', name: 'Sulfur' },
  { id: 'ironIngot', name: 'Iron Ingot' },
  { id: 'copperIngot', name: 'Copper Ingot' },
  { id: 'ironPlate', name: 'Iron Plate' },
  { id: 'ironRod', name: 'Iron Rod' },
  { id: 'screws', name: 'Screws' },
  { id: 'wire', name: 'Wire' },
  { id: 'cable', name: 'Cable' },
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
