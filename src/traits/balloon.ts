import type { Trait, TraitView } from './types';

/** Inflate: Air on the enemy (stacks `air`), its cap and its seconds; the swelling and the extra push per Air; letting it out. */
export const AIR_MAX = 10;
export const AIR_SECONDS = 6;
export const AIR_SWELL = 0.06;
export const AIR_PUSH = 0.08;
export const STILL_AFTER = 1;
export const VENT_EVERY = 0.3;
/** Air a basic attack adds (the design leaves it open; 1 keeps the passive alive between spells), Q and W add 3 each. */
export const AIR_ATTACK = 1;
export const AIR_Q = 3;
export const AIR_W = 3;
/** Knockback is a speed that decays as exp(-7t), so a push of `m` metres is a speed of `m * KNOCK_PER_M`. */
export const KNOCK_PER_M = 7;

/** Air Hose (Q): damage, range, speed, wind-up, bolt radius, push (m). */
export const HOSE_DAMAGE = 50;
export const HOSE_RANGE = 8;
export const HOSE_SPEED = 22;
export const HOSE_WIND = 0.3;
export const HOSE_RADIUS = 0.35;
export const HOSE_PUSH = 1;

/** Helium Bomb (W): reach, seconds to the pop, radius, damage. */
export const BOMB_RANGE = 9;
export const BOMB_DELAY = 1.0;
export const BOMB_RADIUS = 2.5;
export const BOMB_DAMAGE = 40;

/** Hot Air (E): the float (m), the wind-up and the glide (s), the radius and the push (m) where he left. */
export const HOT_FLOAT = 6;
export const HOT_WIND = 0.4;
export const HOT_GLIDE = 0.7;
export const HOT_RADIUS = 2.5;
export const HOT_PUSH = 3;

/** Pop! (R): reach, the pin's time to land, base damage, damage per Air, and the shove (m) the Air goes out in. */
export const POP_RANGE = 9;
export const POP_WIND = 0.6;
export const POP_BASE = 50;
export const POP_PER_AIR = 20;
export const POP_SHOVE = 3;
/** The CPU holds Pop! until the enemy has this much Air. */
export const POP_AI_AIR = 4;

/** The Air on the enemy when a cast began (written every frame by `enemyScale`, on both screens): the pop's size reads it. */
export const airSeen = new WeakMap<object, number>();

/** Air on the enemy hero as this trait's view sees it now. */
export const airOf = (t: TraitView) => t.stacks('air');

/** Lets `k` Air out of the enemy without lengthening the 6 s it has left (`mem.airEnd` is when the count lapses). */
function vent(t: TraitView, k: number) {
  const left = Math.max(0.25, (t.mem.airEnd ?? t.time + AIR_SECONDS) - t.time);
  t.addStacks('air', -k, left, AIR_MAX);
}

/**
 * Professor Puff (mage, ranged). Passive Inflate: his hits put Air on the enemy hero (Air Hose and Helium Bomb 3, a basic attack 1; 10 at most,
 * 6 s from the last add). The enemy REALLY swells: `enemyScale` is 1 + 6% per Air, both screens, and the hit size follows, so the enemy's own
 * size is the warning. Each Air also pushes his hits 8% farther (`dealt` scales the knock of a hit he lands, by the Air it had before that hit).
 *
 * Where each rule runs. `dealt` runs where the hit is decided (online the victim's screen): it adds the Air with `addStacks` (which tells the
 * enemy's own client) and scales the knock. Pop! also reads the Air there: +20 damage per Air, a fixed 3 m shove, and all the Air goes. Letting Air out
 * is the victim's screen's business, in `victimTick`: standing still for 1 s lets out 1 Air per 0.3 s (the enemy's position is tracked in `mem`;
 * `t.still` is Puff's own), and each hit the enemy lands on him lets out 1. His own client is the one that sees those hits (`taken`), and it
 * cannot reach the enemy's stacks, so it counts them in `show('vent', n)` (no look, so no pips); that value reaches the deciding screen (online
 * through `setOwn`, offline on the same runtime) and `victimTick` lets out as many Air as the count grew. A vent keeps the old lapse time, so
 * the Air does not last longer for being let out.
 */
export const balloonTrait: Trait = {
  passive: {
    name: 'Inflate',
    blurb: 'His hits put Air on you (10 at most, 6 s): Air Hose and Helium Bomb 3, a basic attack 1. You really swell by 6% per Air, which makes you easier to hit, and his hits push you 8% farther per Air. Standing still for 1 s lets out 1 Air per 0.3 s, and so does each hit you land on him.',
  },
  twist: {
    name: 'Pop Now or Inflate More',
    blurb: 'Pop! hits for 50 plus 20 per Air, so waiting pays, and waiting is when you deflate. He is fragile: stand still or hit him.',
  },
  speed: 3.9,
  attack: { kind: 'ranged', range: 6, damage: 10, interval: 1.0, windup: 0.25, speed: 18, look: 'orb' },
  // The CPU keeps Pop! until the enemy has 4 Air (the enemy's HP is not readable from a trait), and Hot Air until the enemy is close.
  aiHold(t, slot, dist) {
    if (slot === 3) return airOf(t) < POP_AI_AIR;
    if (slot === 2) return dist > 3.5;
    return false;
  },
  /** The swelling: both screens, every frame. Also keeps `airSeen` for the pop's size. */
  enemyScale(t) {
    const n = t.stacks('air');
    airSeen.set(t.self(), n);
    return 1 + AIR_SWELL * n;
  },
  enemyLabel(t) {
    return t.stacks('air') >= 7 ? { text: 'BLOAT', color: '#ff8fb8' } : null;
  },
  dealt(t, hit) {
    if (hit.kind === 'trait' || !hit.victimIsHero) return;
    const air = t.stacks('air');
    if (hit.kind === 'spell' && hit.slot === 3) {
      // Pop!: the damage grows with the Air, all of it goes out in a fixed shove.
      hit.damage += POP_PER_AIR * air;
      hit.opts = { ...hit.opts, knock: POP_SHOVE * KNOCK_PER_M };
      if (air > 0) t.clearStacks('air');
      return;
    }
    // Pushed 8% farther per Air (the Air it had before this hit), then this hit's own Air.
    if (air > 0) hit.opts = { ...hit.opts, knock: (hit.opts.knock ?? 4) * (1 + AIR_PUSH * air) };
    const add = hit.kind === 'attack' ? AIR_ATTACK : hit.kind === 'spell' && hit.slot === 0 ? AIR_Q : hit.kind === 'spell' && hit.slot === 1 ? AIR_W : 0;
    if (add > 0) {
      t.mem.airEnd = t.time + AIR_SECONDS;
      t.addStacks('air', add, AIR_SECONDS, AIR_MAX);
    }
  },
  /** His own client: a hit on him is counted for the screen that decides the Air. */
  taken(t, hit) {
    if (!hit.victimIsHero || hit.blocked || hit.damage <= 0) return;
    if (hit.kind !== 'spell' && hit.kind !== 'attack') return;
    t.mem.vent = (t.mem.vent ?? 0) % 900 + 1;
    t.show('vent', t.mem.vent);
  },
  /** The deciding screen: Air let out by standing still and by the enemy's hits on him. */
  victimTick(t, dt) {
    const e = t.enemy();
    if (!e) return;
    const p = e.group.position;
    if (t.mem.lx === undefined || Math.hypot(p.x - t.mem.lx, p.z - t.mem.lz) > dt * 0.5) t.mem.still = 0;
    else t.mem.still = (t.mem.still ?? 0) + dt;
    t.mem.lx = p.x;
    t.mem.lz = p.z;
    // Hits on Puff: the count grew by this many since last seen (it wraps at 900).
    const n = t.own('vent'), grew = (((n - (t.mem.ventSeen ?? 0)) % 900) + 900) % 900;
    t.mem.ventSeen = n;
    if (grew > 0 && grew < 20 && t.stacks('air') > 0) vent(t, grew);
    // Standing still: the first Air goes out at 1 s, then one per 0.3 s.
    if (t.mem.still >= STILL_AFTER && t.stacks('air') > 0) {
      t.mem.ventT = (t.mem.ventT ?? VENT_EVERY) + dt;
      if (t.mem.ventT >= VENT_EVERY) {
        t.mem.ventT = 0;
        vent(t, 1);
      }
    } else t.mem.ventT = VENT_EVERY;
  },
  badge(t) {
    const n = t.stacks('air');
    return n > 0 ? String(n) : '';
  },
};
