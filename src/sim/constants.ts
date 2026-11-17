/** Simulation steps per second. Every computer in a match steps at this rate. */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/** Unit limit per player (SPEC "about 200"). Production pauses at it. */
export const UNIT_LIMIT = 200;

/** The Hub's pulse (SPEC: a low-damage area-of-effect pulse): damage, every so many ticks, reach in tiles beyond its edge. */
export const PULSE_DAMAGE = 5;
export const PULSE_TICKS = 60;
export const PULSE_REACH = 4;

/** A belt tile's health: belts block units, so they can be destroyed. */
export const BELT_HP = 100;

/** How many units can wait to be placed by hand at once. */
export const HUB_QUEUE = 20;

/** How far the Hub sees at the start of a match, in tiles. */
export const HUB_SIGHT = 13;

/** Tiles per side of a fog chunk. The renderer redraws a chunk when its fog changes. */
export const FOG_CHUNK = 16;
