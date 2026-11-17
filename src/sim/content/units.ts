// Every unit in SPEC "Units". Attack types follow SPEC "Combat". Speeds, sight and health
// are the builder's numbers (docs/decisions.md), tuned in playtesting. Stage 1 uses the
// Minuteman only; the others are produced from Stage 3 on.

import { FP } from '../fmath';
import { TICK_RATE } from '../constants';

export type UnitKind = 'hauler' | 'mechanic' | 'minuteman' | 'burner' | 'vanguard' | 'rifleman' | 'tank' | 'rocketTank' | 'cyclops' | 'gunship' | 'fighter';

export type AttackType = 'melee' | 'ranged' | 'both' | 'air' | 'none';

export interface UnitDef {
  kind: UnitKind;
  name: string;
  attack: AttackType;
  air: boolean;
  /** Sub-units (1/FP tile) per tick. */
  speed: number;
  /** Tiles. */
  sight: number;
  hp: number;
}

/** Tiles per second to sub-units per tick. */
const tps = (tilesPerSecond: number) => Math.round((tilesPerSecond * FP) / TICK_RATE);

const defs: UnitDef[] = [
  { kind: 'hauler', name: 'Hauler', attack: 'none', air: false, speed: tps(3), sight: 6, hp: 120 },
  { kind: 'mechanic', name: 'Mechanic', attack: 'none', air: false, speed: tps(2.8), sight: 7, hp: 90 },
  { kind: 'minuteman', name: 'Minuteman', attack: 'melee', air: false, speed: tps(3), sight: 8, hp: 60 },
  { kind: 'burner', name: 'Burner', attack: 'melee', air: false, speed: tps(2.6), sight: 7, hp: 110 },
  { kind: 'vanguard', name: 'Vanguard', attack: 'melee', air: false, speed: tps(2.4), sight: 7, hp: 260 },
  { kind: 'rifleman', name: 'Rifleman', attack: 'ranged', air: false, speed: tps(2.8), sight: 9, hp: 70 },
  { kind: 'tank', name: 'Tank', attack: 'ranged', air: false, speed: tps(2.6), sight: 9, hp: 500 },
  { kind: 'rocketTank', name: 'Rocket Tank', attack: 'ranged', air: false, speed: tps(2.4), sight: 10, hp: 420 },
  { kind: 'cyclops', name: 'Cyclops', attack: 'both', air: false, speed: tps(2), sight: 10, hp: 1400 },
  { kind: 'gunship', name: 'Gunship', attack: 'air', air: true, speed: tps(2.4), sight: 11, hp: 900 },
  { kind: 'fighter', name: 'Fighter', attack: 'air', air: true, speed: tps(4.5), sight: 9, hp: 140 },
];

export const UNITS = Object.fromEntries(defs.map((d) => [d.kind, d])) as Record<UnitKind, UnitDef>;

/** "1 Minuteman", "3 Minutemen", "2 Tanks". */
export function unitCount(name: string, n: number) {
  if (n === 1) return name;
  return `${n} ${name.endsWith('man') ? name.slice(0, -3) + 'men' : name + 's'}`;
}
