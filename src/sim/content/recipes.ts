import type { ItemId } from './items';

// Recipes. Ingredients, products and times are Satisfactory's standard recipes, checked against
// the game's data (the SatisfactoryTools data file, November 2026). Research (Stage 4) unlocks
// the rest; Stage 2 has the basic iron and copper research the spec starts every player with.

export type Machine = 'smelter' | 'constructor';

export interface Recipe {
  id: string;
  name: string;
  machine: Machine;
  inputs: readonly (readonly [ItemId, number])[];
  outputs: readonly (readonly [ItemId, number])[];
  seconds: number;
  /** Known at the start of a match. */
  atStart: boolean;
}

export const RECIPE_LIST: Recipe[] = [
  { id: 'ironIngot', name: 'Iron Ingot', machine: 'smelter', inputs: [['ironOre', 1]], outputs: [['ironIngot', 1]], seconds: 2, atStart: true },
  { id: 'copperIngot', name: 'Copper Ingot', machine: 'smelter', inputs: [['copperOre', 1]], outputs: [['copperIngot', 1]], seconds: 2, atStart: true },
  { id: 'ironPlate', name: 'Iron Plate', machine: 'constructor', inputs: [['ironIngot', 3]], outputs: [['ironPlate', 2]], seconds: 6, atStart: true },
  { id: 'ironRod', name: 'Iron Rod', machine: 'constructor', inputs: [['ironIngot', 1]], outputs: [['ironRod', 1]], seconds: 4, atStart: true },
  { id: 'screws', name: 'Screws', machine: 'constructor', inputs: [['ironRod', 1]], outputs: [['screws', 4]], seconds: 6, atStart: true },
  { id: 'wire', name: 'Wire', machine: 'constructor', inputs: [['copperIngot', 1]], outputs: [['wire', 2]], seconds: 4, atStart: true },
  { id: 'cable', name: 'Cable', machine: 'constructor', inputs: [['wire', 2]], outputs: [['cable', 1]], seconds: 2, atStart: true },
];

export const RECIPES = Object.fromEntries(RECIPE_LIST.map((r) => [r.id, r])) as Record<string, Recipe>;
