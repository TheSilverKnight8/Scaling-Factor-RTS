import { FP } from '../fmath';
import { TICK_RATE } from '../constants';
import type { Cost } from './structures';

// Transport (SPEC: separate from structures): belts, splitters and mergers, and power lines.
// Costs follow Satisfactory's (Conveyor Belt Mk.1, Splitter, Merger, Pipeline Mk.1, Power Line); the
// numbers are the builder's and are tuned in playtesting.

export type TransportKind = 'belt' | 'splitter' | 'merger' | 'pipe';

export interface TransportDef {
  kind: TransportKind;
  name: string;
  cost: Cost;
  blurb: string;
}

export const TRANSPORT: Record<TransportKind, TransportDef> = {
  belt: { kind: 'belt', name: 'Belt', cost: [['ironPlate', 1]], blurb: 'Carries items one way. Drag to lay a line. Blocks ground units. Can cross water.' },
  splitter: { kind: 'splitter', name: 'Splitter', cost: [['ironPlate', 2], ['cable', 2]], blurb: 'Takes items from behind and sends them out of the front, left and right in turn.' },
  merger: { kind: 'merger', name: 'Merger', cost: [['ironPlate', 2], ['ironRod', 2]], blurb: 'Takes items from behind, left and right in turn and sends them out of the front.' },
  pipe: { kind: 'pipe', name: 'Pipe', cost: [['copperSheet', 1]], blurb: 'Carries oil and other fluids one way, like a belt (Caleb). Drag to lay a line. Blocks ground units. Can cross water.' },
};

/** How far items move along a belt each tick: 1 tile a second. */
export const BELT_SPEED = Math.floor(FP / TICK_RATE);
/** The closest two items sit on a belt: half a tile, so a belt carries 2 items a second (120 a minute). */
export const BELT_SPACING = FP / 2;
/** The closest two units of fluid sit in a pipe: a fifth of a tile, so a pipe carries 5 a second (300 a minute, Satisfactory's Mk.1 pipeline). */
export const PIPE_SPACING = FP / 5;
export const spacingOf = (kind: TransportKind) => (kind === 'pipe' ? PIPE_SPACING : BELT_SPACING);

/** Two structures whose ports touch pass an item this often (ticks), the same rate as a belt. */
export const DIRECT_PERIOD = Math.round(BELT_SPACING / BELT_SPEED);
/** The same for fluid ports: a pipe's rate. */
export const DIRECT_FLUID_PERIOD = Math.round(PIPE_SPACING / BELT_SPEED);

export const POWER_LINE = {
  name: 'Power Line',
  cost: [['cable', 1]] as Cost,
  /** Longest line, center to center, in tiles. */
  maxLength: 14,
  blurb: 'Connects two power poles or structures. Click one, then the other. Cannot cross cliffs.',
};
