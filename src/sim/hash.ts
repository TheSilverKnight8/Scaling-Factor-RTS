import { ITEM_IDS, type Bag } from './content/items';
import type { MatchState } from './state';

/**
 * A short fingerprint of the match state. Two computers running the same match must get the
 * same fingerprint every tick; multiplayer (Stage 6) compares them to catch a desync early.
 */
export function stateHash(s: MatchState): number {
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    h = Math.imul(h ^ (v | 0), 16777619);
  };
  mix(s.tick);
  mix(s.nextId);
  mix(s.rng);
  mix(s.blockVersion);
  for (const u of s.units) {
    mix(u.id);
    mix(u.owner);
    mix(u.x);
    mix(u.y);
    mix(u.hp);
    mix(u.pathStep);
    mix(u.goal);
    for (const t of u.path) mix(t);
    mix(u.mode === 'auto' ? 1 : 0);
    mix(u.home);
    mix(u.target);
    mix(u.cooldown);
    mix(u.order ? (u.order.kind === 'move' ? u.order.tile : -u.order.target) : 0);
    mix(u.patrolStep);
    mix(u.haul ? u.haul.node * 65536 + u.haul.target : -1);
    mix(u.haulState);
    mix(u.carry);
    mix(u.haulTicks);
    mix(u.lastPost);
  }
  const bag = (b: Bag) => {
    for (const id of ITEM_IDS) mix(b[id] ?? 0);
  };
  for (const t of s.structures) {
    mix(t.id);
    mix(t.owner);
    mix(t.x);
    mix(t.y);
    mix(t.w);
    mix(t.h);
    mix(t.rot);
    mix(t.hp);
    mix(t.buildLeft);
    mix(t.progress);
    mix(t.blown ? 1 : 0);
    mix(t.grid);
    mix(t.rr);
    bag(t.inv);
    bag(t.out);
    mix(t.rally);
    mix(t.made);
    mix(t.lastPulse);
    mix(t.energy);
    mix(t.haul ? t.haul.node * 65536 + t.haul.target : -1);
    mix(t.waypoint);
  }
  for (const r of s.rails) {
    mix(r.id);
    mix(r.x);
    mix(r.y);
    mix(r.hp);
  }
  for (const tr of s.trains) {
    mix(tr.id);
    mix(tr.x);
    mix(tr.y);
    mix(tr.next);
    mix(tr.pathStep);
    mix(tr.dwell);
    for (const st of tr.stops) mix(st.station * 4 + (st.load ? 1 : 0) + (st.unload ? 2 : 0));
    bag(tr.cargo);
  }
  for (const b of s.belts) {
    mix(b.id);
    mix(b.dir);
    mix(b.rr);
    mix(b.hp);
    for (const it of b.items) {
      mix(ITEM_IDS.indexOf(it.item));
      mix(it.pos);
    }
  }
  for (const l of s.lines) {
    mix(l.a);
    mix(l.b);
  }
  for (const p of s.players) {
    mix(p.id);
    bag(p.hub);
    mix(p.queue.length);
    mix(p.eliminated ? 1 : 0);
    mix(p.researched.length);
    for (const c of p.tree) {
      mix(c.col);
      mix(c.row);
    }
    let explored = 0;
    for (let i = 0; i < p.explored.length; i++) explored += p.explored[i];
    mix(explored);
  }
  return h >>> 0;
}
