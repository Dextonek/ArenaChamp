import * as THREE from 'three';
import { isBehind, type Trait } from './types';

/**
 * Shadow Swap's dagger, published by the effect every frame (keyed by Nyx's figure) so the recast can swap her there:
 * `x, z` where it is now (or where it stopped / hit), `hit` it ended on an enemy, `taken` set by the recast so the effect
 * draws the swap and removes the dagger. Same pattern as Kaia's `stormOrbs`.
 */
export interface ShadowDagger { x: number; z: number; hit: boolean; taken: boolean; fromX: number; fromZ: number }
export const shadowDaggers = new WeakMap<object, ShadowDagger>();

/**
 * Shadow Mark's tally (keyed by Nyx's figure): the effect opens it (`active`) when the mark lands, `dealt` adds the
 * damage her hits do to the enemy hero while it is open, and the strike reads `taken` for its 30%. Kept in `dealt` (not
 * in the effect) because that hook runs on whichever screen resolves her hits, offline or online.
 */
export interface ShadowMarkTally { active: boolean; taken: number }
export const shadowMarks = new WeakMap<object, ShadowMarkTally>();

/** Share of the damage taken under the mark that the strike adds. */
export const MARK_SHARE = 0.3;

/**
 * Nyx (assassin). Passive Backstab: hits from behind the enemy deal +20%. Twist Combo points: each of her spells that
 * lands on the enemy hero adds one (max 5); her ultimate spends them all for +15% damage each. Umbral Blink is a heavy
 * dive: x1.35 damage on a 5 s cooldown. Shadow Swap can be cast again within 3 s to swap her to the dagger (no effect,
 * only the move; the enemy never moves). Shadow Mark's strike adds 30% of the damage her hits did under the mark.
 */
export const shadowTrait: Trait = {
  passive: { name: 'Backstab', blurb: 'Hits from behind the enemy (outside its front 120°) deal 20% more damage.' },
  twist: { name: 'Combo points', blurb: 'Each of her spells that hits the enemy hero adds a point (max 5). Shadow Mark spends them all: +15% damage per point. Recast Shadow Swap within 3 s to swap to the dagger.' },
  resource: { name: 'Combo', max: 5, color: '#b58cff' },
  recast: { slot: 1, window: 3, name: 'Swap to dagger', replay: false },
  speed: 4.6,
  attack: { kind: 'melee', range: 1.9, damage: 8, interval: 0.7, windup: 0.18, speed: 0, look: 'twin' },
  dealt(t, hit) {
    const v = hit.victim.group.position, me = t.self().group.position;
    if (hit.victimIsHero && isBehind(me, v, hit.victim.group.rotation.y)) {
      hit.damage *= 1.2;
      t.say('BACKSTAB', '#d9b8ff');
    }
    // Shadow Mark: what her hits do to the enemy hero while the mark stands feeds the strike (the strike itself does not).
    const mark = shadowMarks.get(t.self());
    if (mark?.active && hit.victimIsHero && hit.slot !== 3) mark.taken += hit.damage;
  },
  landed(t, hit) {
    if (hit.kind === 'spell' && hit.victimIsHero && hit.slot !== undefined && hit.slot < 3 && !t.mem[`pt${hit.slot}`]) {
      // One point per cast, however many times the spell hits.
      t.mem[`pt${hit.slot}`] = 1;
      t.addRes(1);
    }
  },
  afterCast(t, slot) {
    if (slot < 3) t.mem[`pt${slot}`] = 0;
  },
  castMods(t, slot) {
    // Umbral Blink is her heavy dive: 35% more damage on a 5 s cooldown (kit).
    if (slot === 0) return { power: 1.35 };
    if (slot !== 3 || t.res <= 0) return {};
    const points = t.res;
    t.res = 0;
    t.say(`${points} COMBO`, '#d9b8ff');
    return { power: 1 + 0.15 * points };
  },
  recastAct(t, slot) {
    if (slot !== 1) return;
    const me = t.self();
    const dagger = shadowDaggers.get(me);
    if (!dagger || dagger.taken) return;
    const p = me.group.position;
    let x = dagger.x, z = dagger.z;
    if (dagger.hit) {
      // The dagger ended on the enemy: she lands 1.2 m short of it, on her side. The enemy stays where it is.
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz) || 1;
      x += (dx / d) * Math.min(1.2, d);
      z += (dz / d) * Math.min(1.2, d);
    }
    dagger.taken = true;
    dagger.fromX = p.x;
    dagger.fromZ = p.z;
    t.say('SWAP', '#d9b8ff');
    t.moveTo(new THREE.Vector3(x, 0, z), 0.06);
  },
  badge: (t) => (t.res > 0 ? String(t.res) : ''),
};
