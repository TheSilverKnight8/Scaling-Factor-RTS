import type { ItemId } from './items';

// Recipes. Ingredients, products and times are Satisfactory's standard recipes, checked against
// the game's data (the SatisfactoryTools data file, November 2026). Compacted Coal and Turbofuel
// exist only as alternate recipes in Satisfactory (the spec lists them as materials), so those
// two alternates are used. Each recipe is unlocked by a research bundle (src/sim/content/research.ts).

export type Machine = 'smelter' | 'constructor' | 'assembler' | 'foundry' | 'refinery' | 'manufacturer';

export interface Recipe {
  id: string;
  name: string;
  machine: Machine;
  inputs: readonly (readonly [ItemId, number])[];
  outputs: readonly (readonly [ItemId, number])[];
  seconds: number;
  /** The research bundle that unlocks it ('basics' is known from the start). */
  unlock: string;
}

const r = (id: string, name: string, machine: Machine, inputs: [ItemId, number][], outputs: [ItemId, number][], seconds: number, unlock: string): Recipe => ({ id, name, machine, inputs, outputs, seconds, unlock });

export const RECIPE_LIST: Recipe[] = [
  // Smelter
  r('ironIngot', 'Iron Ingot', 'smelter', [['ironOre', 1]], [['ironIngot', 1]], 2, 'basics'),
  r('copperIngot', 'Copper Ingot', 'smelter', [['copperOre', 1]], [['copperIngot', 1]], 2, 'basics'),
  r('goldIngot', 'Gold Ingot', 'smelter', [['goldOre', 3]], [['goldIngot', 1]], 4, 'gold'),
  // Constructor
  r('ironPlate', 'Iron Plate', 'constructor', [['ironIngot', 3]], [['ironPlate', 2]], 6, 'basics'),
  r('ironRod', 'Iron Rod', 'constructor', [['ironIngot', 1]], [['ironRod', 1]], 4, 'basics'),
  r('screws', 'Screws', 'constructor', [['ironRod', 1]], [['screws', 4]], 6, 'basics'),
  r('wire', 'Wire', 'constructor', [['copperIngot', 1]], [['wire', 2]], 4, 'basics'),
  r('cable', 'Cable', 'constructor', [['wire', 2]], [['cable', 1]], 2, 'basics'),
  r('copperSheet', 'Copper Sheet', 'constructor', [['copperIngot', 2]], [['copperSheet', 1]], 6, 'copperSheet'),
  r('quickwire', 'Quickwire', 'constructor', [['goldIngot', 1]], [['quickwire', 5]], 5, 'gold'),
  r('steelBeam', 'Steel Beam', 'constructor', [['steelIngot', 4]], [['steelBeam', 1]], 4, 'steel'),
  r('steelPipe', 'Steel Pipe', 'constructor', [['steelIngot', 3]], [['steelPipe', 2]], 6, 'steel'),
  r('quartzCrystal', 'Quartz Crystal', 'constructor', [['rawQuartz', 5]], [['quartzCrystal', 3]], 8, 'quartz'),
  r('silica', 'Silica', 'constructor', [['rawQuartz', 3]], [['silica', 5]], 8, 'quartz'),
  // Foundry
  r('steelIngot', 'Steel Ingot', 'foundry', [['ironOre', 3], ['coal', 3]], [['steelIngot', 3]], 4, 'steel'),
  // Assembler
  r('reinforcedIronPlate', 'Reinforced Iron Plate', 'assembler', [['ironPlate', 6], ['screws', 12]], [['reinforcedIronPlate', 1]], 12, 'assembly'),
  r('rotor', 'Rotor', 'assembler', [['ironRod', 5], ['screws', 25]], [['rotor', 1]], 15, 'assembly'),
  r('modularFrame', 'Modular Frame', 'assembler', [['reinforcedIronPlate', 3], ['ironRod', 12]], [['modularFrame', 2]], 60, 'frames'),
  r('smartPlating', 'Smart Plating', 'assembler', [['reinforcedIronPlate', 1], ['rotor', 1]], [['smartPlating', 1]], 30, 'frames'),
  r('versatileFramework', 'Versatile Framework', 'assembler', [['modularFrame', 1], ['steelBeam', 12]], [['versatileFramework', 2]], 24, 'framework'),
  r('stator', 'Stator', 'assembler', [['steelPipe', 3], ['wire', 8]], [['stator', 1]], 12, 'motors'),
  r('motor', 'Motor', 'assembler', [['rotor', 2], ['stator', 2]], [['motor', 1]], 12, 'motors'),
  r('automatedWiring', 'Automated Wiring', 'assembler', [['stator', 1], ['cable', 20]], [['automatedWiring', 1]], 24, 'framework'),
  r('circuitBoard', 'Circuit Board', 'assembler', [['copperSheet', 2], ['plastic', 4]], [['circuitBoard', 1]], 8, 'electronics'),
  r('aiLimiter', 'AI Limiter', 'assembler', [['copperSheet', 5], ['quickwire', 20]], [['aiLimiter', 1]], 12, 'electronics'),
  r('blackPowder', 'Black Powder', 'assembler', [['coal', 1], ['sulfur', 1]], [['blackPowder', 2]], 4, 'gunpowder'),
  r('compactedCoal', 'Compacted Coal', 'assembler', [['coal', 5], ['sulfur', 5]], [['compactedCoal', 5]], 12, 'compactedCoal'),
  // Refinery
  r('plastic', 'Plastic', 'refinery', [['crudeOil', 3]], [['plastic', 2], ['heavyOilResidue', 1]], 6, 'oil'),
  r('rubber', 'Rubber', 'refinery', [['crudeOil', 3]], [['rubber', 2], ['heavyOilResidue', 2]], 6, 'oil'),
  r('fuel', 'Fuel', 'refinery', [['crudeOil', 6]], [['fuel', 4], ['polymerResin', 3]], 6, 'oil'),
  r('residualFuel', 'Residual Fuel', 'refinery', [['heavyOilResidue', 6]], [['fuel', 4]], 6, 'oil'),
  r('petroleumCoke', 'Petroleum Coke', 'refinery', [['heavyOilResidue', 4]], [['petroleumCoke', 12]], 6, 'oil'),
  r('smokelessPowder', 'Smokeless Powder', 'refinery', [['blackPowder', 2], ['heavyOilResidue', 1]], [['smokelessPowder', 2]], 6, 'smokeless'),
  r('turbofuel', 'Turbofuel', 'refinery', [['fuel', 6], ['compactedCoal', 4]], [['turbofuel', 5]], 16, 'turbofuel'),
  // Manufacturer
  r('computer', 'Computer', 'manufacturer', [['circuitBoard', 4], ['cable', 8], ['plastic', 16]], [['computer', 1]], 24, 'manufacturing'),
  r('crystalOscillator', 'Crystal Oscillator', 'manufacturer', [['quartzCrystal', 36], ['cable', 28], ['reinforcedIronPlate', 5]], [['crystalOscillator', 2]], 120, 'manufacturing'),
  r('highSpeedConnector', 'High-Speed Connector', 'manufacturer', [['quickwire', 56], ['cable', 10], ['circuitBoard', 1]], [['highSpeedConnector', 1]], 16, 'manufacturing'),
  r('modularEngine', 'Modular Engine', 'manufacturer', [['motor', 2], ['rubber', 15], ['smartPlating', 2]], [['modularEngine', 1]], 60, 'manufacturing'),
  r('supercomputer', 'Supercomputer', 'manufacturer', [['computer', 4], ['aiLimiter', 2], ['highSpeedConnector', 3], ['plastic', 28]], [['supercomputer', 1]], 32, 'supercomputer'),
];

export const RECIPES = Object.fromEntries(RECIPE_LIST.map((x) => [x.id, x])) as Record<string, Recipe>;

export const MACHINES: Machine[] = ['smelter', 'constructor', 'assembler', 'foundry', 'refinery', 'manufacturer'];
export const isMachineKind = (kind: string): kind is Machine => (MACHINES as string[]).includes(kind);
