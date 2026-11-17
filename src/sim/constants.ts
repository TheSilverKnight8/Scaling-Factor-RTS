/** Simulation steps per second. Every computer in a match steps at this rate. */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/** Unit limit per player (SPEC "about 200"; used from Stage 3). */
export const UNIT_LIMIT = 200;

/** How far the Hub sees at the start of a match, in tiles. */
export const HUB_SIGHT = 13;

/** Tiles per side of a fog chunk. The renderer redraws a chunk when its fog changes. */
export const FOG_CHUNK = 16;
