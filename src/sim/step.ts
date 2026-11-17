import { UNITS } from './content/units';
import { applyCommand, sendTo, type Command } from './commands';
import { reveal } from './fog';
import { isqrt } from './fmath';
import { lineClear } from './path';
import { type MatchState, type Unit, getPlayer, tileCenter, unitTile, walkable } from './state';

/**
 * Advances the match by one tick: applies this tick's commands in order, moves units and
 * reveals fog. Nothing else changes the match state.
 */
export function step(s: MatchState, commands: readonly Command[]) {
  for (const c of commands) applyCommand(s, c);
  for (const u of s.units) moveUnit(s, u);
  for (const u of s.units) {
    const t = unitTile(s, u);
    if (t === u.seenFrom) continue;
    u.seenFrom = t;
    const p = getPlayer(s, u.owner);
    if (p) reveal(s, p, t % s.size, Math.floor(t / s.size), UNITS[u.kind].sight);
  }
  s.tick++;
}

function moveUnit(s: MatchState, u: Unit) {
  u.px = u.x;
  u.py = u.y;
  if (u.pathStep >= u.path.length) return;

  // A structure built or removed since the path was found: if the way ahead is now blocked,
  // find a new path to the same goal.
  if (u.pathVersion !== s.blockVersion) {
    u.pathVersion = s.blockVersion;
    const here = unitTile(s, u);
    let prev = here;
    let broken = false;
    for (let i = u.pathStep; i < u.path.length; i++) {
      if (!walkable(s, u.path[i]) || (i > u.pathStep && !lineClear(s, prev, u.path[i]))) {
        broken = true;
        break;
      }
      prev = u.path[i];
    }
    if (broken && u.goal >= 0) sendTo(s, u, u.goal);
    if (u.pathStep >= u.path.length) return;
  }

  let budget = UNITS[u.kind].speed;
  while (budget > 0 && u.pathStep < u.path.length) {
    const t = u.path[u.pathStep];
    const tx = tileCenter(t % s.size);
    const ty = tileCenter(Math.floor(t / s.size));
    const dx = tx - u.x;
    const dy = ty - u.y;
    const d = isqrt(dx * dx + dy * dy);
    if (d <= budget) {
      u.x = tx;
      u.y = ty;
      budget -= d;
      u.pathStep++;
      if (d > 0) {
        u.dirX = dx;
        u.dirY = dy;
      }
    } else {
      u.x += Math.trunc((dx * budget) / d);
      u.y += Math.trunc((dy * budget) / d);
      u.dirX = dx;
      u.dirY = dy;
      budget = 0;
    }
  }
  if (u.pathStep >= u.path.length) {
    u.path = [];
    u.pathStep = 0;
    u.goal = -1;
  }
}
