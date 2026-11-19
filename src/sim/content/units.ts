// Every unit in SPEC "Units". Attack types follow SPEC "Combat"; key parts follow SPEC "Tiers
// and key parts". Speeds, sight, health, damage, ranges, part amounts and times are the
// builder's numbers (docs/decisions.md), tuned in playtesting. The Minuteman is the only unit
// available at the start (SPEC); the rest come with research (Stage 4), and their numbers and
// parts are filled in then.

import { FP } from '../fmath';
import { TICK_RATE } from '../constants';
import type { Cost, StructureKind } from './structures';

export type UnitKind = 'hauler' | 'mechanic' | 'minuteman' | 'burner' | 'vanguard' | 'rifleman' | 'tank' | 'rocketTank' | 'cyclops' | 'gunship' | 'fighter';

/** SPEC "Combat": melee cannot hit air; ranged and both can; air units hit anything. */
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
  /** Damage per hit (SPEC: damage is just damage). */
  damage: number;
  /** Reach, in sub-units, from the unit's center to the edge of what it hits. */
  range: number;
  /** Ticks between hits. */
  cooldown: number;
  /** The key parts it is made from (SPEC), paid at a production structure or the Hub. */
  parts: Cost;
  /** Where it is produced automatically. */
  producedAt: StructureKind;
  /** Seconds to make at its production structure. */
  seconds: number;
  /** Seconds to make at the Hub when placed by hand (SPEC: usually short). */
  hubSeconds: number;
}

/** Tiles per second to sub-units per tick. */
const tps = (tilesPerSecond: number) => Math.round((tilesPerSecond * FP) / TICK_RATE);
/** Tiles to sub-units. */
const tiles = (n: number) => Math.round(n * FP);

const later = { parts: [] as Cost, seconds: 10, hubSeconds: 4 };

const defs: UnitDef[] = [
  { kind: 'hauler', name: 'Hauler', attack: 'none', air: false, speed: tps(3), sight: 6, hp: 120, damage: 0, range: 0, cooldown: 20, producedAt: 'garage', ...later },
  { kind: 'mechanic', name: 'Mechanic', attack: 'none', air: false, speed: tps(2.8), sight: 7, hp: 90, damage: 0, range: 0, cooldown: 20, producedAt: 'deployer', ...later },
  {
    kind: 'minuteman',
    name: 'Minuteman',
    attack: 'melee',
    air: false,
    speed: tps(3),
    sight: 8,
    hp: 60,
    damage: 6,
    range: tiles(0.85),
    cooldown: 20,
    parts: [
      ['ironPlate', 3],
      ['screws', 6],
    ],
    producedAt: 'deployer',
    seconds: 6,
    hubSeconds: 3,
  },
  { kind: 'burner', name: 'Burner', attack: 'melee', air: false, speed: tps(2.6), sight: 7, hp: 110, damage: 4, range: tiles(1.4), cooldown: 8, producedAt: 'deployer', ...later },
  { kind: 'vanguard', name: 'Vanguard', attack: 'melee', air: false, speed: tps(2.4), sight: 7, hp: 260, damage: 10, range: tiles(0.85), cooldown: 24, producedAt: 'deployer', ...later },
  { kind: 'rifleman', name: 'Rifleman', attack: 'ranged', air: false, speed: tps(2.8), sight: 9, hp: 70, damage: 7, range: tiles(5), cooldown: 22, producedAt: 'deployer', ...later },
  { kind: 'tank', name: 'Tank', attack: 'ranged', air: false, speed: tps(2.6), sight: 9, hp: 500, damage: 30, range: tiles(6), cooldown: 40, producedAt: 'garage', ...later },
  { kind: 'rocketTank', name: 'Rocket Tank', attack: 'ranged', air: false, speed: tps(2.4), sight: 10, hp: 420, damage: 45, range: tiles(8), cooldown: 60, producedAt: 'garage', ...later },
  { kind: 'cyclops', name: 'Cyclops', attack: 'both', air: false, speed: tps(2), sight: 10, hp: 1400, damage: 40, range: tiles(6), cooldown: 30, producedAt: 'garage', ...later },
  { kind: 'gunship', name: 'Gunship', attack: 'air', air: true, speed: tps(2.4), sight: 11, hp: 900, damage: 35, range: tiles(6), cooldown: 30, producedAt: 'landingPad', ...later },
  { kind: 'fighter', name: 'Fighter', attack: 'air', air: true, speed: tps(4.5), sight: 9, hp: 140, damage: 8, range: tiles(4), cooldown: 12, producedAt: 'landingPad', ...later },
];

export const UNITS = Object.fromEntries(defs.map((d) => [d.kind, d])) as Record<UnitKind, UnitDef>;
export const UNIT_LIST = defs;

/** Whether an attacker of this kind can hit an air (or ground) target (SPEC "Combat"). */
export function canHit(attacker: UnitDef, targetIsAir: boolean): boolean {
  if (attacker.attack === 'none') return false;
  if (attacker.attack === 'melee') return !targetIsAir;
  return true;
}

/** The four imperatives (SPEC "Unit behavior"). */
export type Imperative = 'aggressive' | 'hold' | 'patrol' | 'explore';
export const IMPERATIVES: { id: Imperative; name: string; text: string }[] = [
  { id: 'aggressive', name: 'Aggressive', text: 'Chase and attack anything seen; wait at the rally point otherwise.' },
  { id: 'hold', name: 'Hold Point', text: 'Stay at the rally point and attack what comes in range.' },
  { id: 'patrol', name: 'Patrol', text: 'Loop between the patrol points, attacking what comes in range.' },
  { id: 'explore', name: 'Explore', text: 'Reveal fog and avoid fights.' },
];

/** "1 Minuteman", "3 Minutemen", "2 Tanks". */
export function unitCount(name: string, n: number) {
  if (n === 1) return name;
  return `${n} ${name.endsWith('man') ? name.slice(0, -3) + 'men' : name + 's'}`;
}
