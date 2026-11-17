import type { Bag } from './items';

// The economy's numbers (builder's, tuned in playtesting).

/** Items the Hub holds in all (SPEC: the Hub inventory has a capacity). */
export const HUB_CAPACITY = 2000;
/** Items a Depot holds in all. */
export const DEPOT_CAPACITY = 1000;
/** Items a Drill holds before it stops. */
export const DRILL_BUFFER = 100;
/** Items a machine's output holds before it stops. */
export const OUTPUT_BUFFER = 100;
/** A machine takes up to this many cycles' worth of each ingredient. */
export const INPUT_CYCLES = 10;

/**
 * Ticks per item a Drill gathers, by purity (Impure, Normal, Pure): Satisfactory's Miner
 * Mk.1 rates of 30, 60 and 120 a minute.
 */
export const DRILL_TICKS = [40, 20, 10] as const;

/**
 * What every player starts with in the Hub (SPEC: enough for a Drill and some Solar
 * Generators): a Drill, 4 Solar Generators, 2 Power Poles and 6 Power Lines to wire them.
 */
export const START_INVENTORY: Bag = { ironPlate: 30, ironRod: 12, wire: 38, cable: 6 };
