import type { Trait, TraitHit, TraitView } from '../../traits/types';
import { C, E, P, Q, R, W } from './numbers';

/**
 * Kagen's passive, Scarlet Sheath: cut marks (pipeline/designs/kit-sheath.md, gate 3).
 *
 * Each of his hits that lands (a blow of the sword, Issen, each wave of Senbon) leaves a cut mark on the enemy: 4 at most, shown
 * on the enemy for both players. They never open by themselves: they fade 5 s after his latest cut (the engine's stacks have one
 * timer, which every new mark refreshes). They open with Noto (W: an enemy inside the ring at the click) or with Sekai-giri (R:
 * wherever the enemy stands when the line tears), 24 each, 36 with Sekai-giri; all four at once also slow for 1 s. For 0.4 s
 * after Noto's click, the next attack or spell that hits him is parried and gives the attacker a mark.
 *
 * Where each rule runs (a network duel has two screens; pipeline/designs/kit-build-brief.md, "The trait API"):
 * - the marks are stacks (`cut`) on the screen that decides the enemy's hits: offline the one screen, online the enemy's. There
 *   `dealt` adds them (attacks, Q, E) and opens them (Noto's zero-damage hit, slot 1); the count reaches his screen through
 *   `stacksChanged`, where it only draws the pips, the badge and the CPU's choices.
 * - the parry is decided on his own client, where the hits on him are decided (`taken`); it is told to the other screen as a
 *   counter (`show('parry', n)`), which `victimTick` there turns into a mark: the path Mr. Ledger's `paid` uses.
 * - Sekai-giri's opening: `afterCast` counts the cast (`show('sever', n)`); `victimTick` on the enemy's screen opens the marks
 *   `R.windup` seconds after it heard, with `hitEnemy` (a `'trait'` hit, which `dealt` ignores), wherever the enemy stands.
 */

/** The next value of a counter shown to the other screen (1..900: 0 would hide it). */
const bump = (n: number | undefined) => ((n ?? 0) % 900) + 1;

const CUT = 'cut';

function addCut(t: TraitView) {
  t.addStacks(CUT, 1, P.markLife, P.maxMarks);
}

/** The marks open: their damage, and the slow when all of them open at once. */
function opening(n: number, each: number) {
  return { damage: n * each, slow: n >= P.maxMarks };
}

const trait: Trait = {
  passive: {
    name: 'Scarlet Sheath',
    blurb: `Each of his hits that lands leaves a cut mark on you (${P.maxMarks} at most). They never open by themselves and fade ${P.markLife} s after his latest cut. Noto (W) opens the marks of an enemy in its ring, ${P.markDamage} each; Sekai-giri (R) opens them wherever you stand, ${R.markDamage} each. All ${P.maxMarks} at once also slow for ${P.slowSeconds} s.`,
  },
  twist: {
    name: 'Click now, or one more cut?',
    blurb: 'Count the cuts on you. Step out of his ring when it shows, or stay out of his reach for 5 s, and they fade unspent.',
  },
  speed: P.speed,
  attack: { kind: 'melee', range: P.reach, damage: P.attack, interval: P.interval, windup: P.attackWind, speed: 0, look: 'sweep' },
  badge(t) {
    const n = t.stacks(CUT);
    return n > 0 ? String(n) : '';
  },

  afterCast(t, slot) {
    if (slot === 1) {
      // The click lands W.windup after the cast; the parry opens then, on his own client.
      t.mem.clickAt = t.time + W.windup;
      t.mem.parried = 0;
    } else if (slot === 3) {
      t.mem.severN = bump(t.mem.severN);
      t.show('sever', t.mem.severN);
    }
  },

  /** Where the hit is decided: his hits leave marks, Noto's click opens them. */
  dealt(t, hit: TraitHit) {
    if (!hit.victimIsHero || hit.blocked) return;
    if (hit.kind === 'attack' || (hit.kind === 'spell' && (hit.slot === 0 || hit.slot === 2))) {
      if (hit.damage > 0) addCut(t);
      return;
    }
    if (hit.kind === 'spell' && hit.slot === 1) {
      const n = t.stacks(CUT);
      if (n <= 0) return;
      const o = opening(n, P.markDamage);
      hit.damage = o.damage;
      if (o.slow) hit.opts.status = { kind: 'slow', seconds: P.slowSeconds };
      t.clearStacks(CUT);
    }
  },

  /** His own client: the parry, the next attack or spell in the 0.4 s after the click. */
  taken(t, hit: TraitHit) {
    if (hit.blocked || hit.damage <= 0 || (hit.kind !== 'attack' && hit.kind !== 'spell')) return;
    const at = t.mem.clickAt;
    if (!at || t.mem.parried || t.time < at || t.time > at + W.parry) return;
    hit.blocked = true;
    t.mem.parried = 1;
    t.mem.parryN = bump(t.mem.parryN);
    t.show('parry', t.mem.parryN);
    t.say('PARRY', C.foil);
  },

  /** Where the enemy's hits are decided: a parry's mark, and Sekai-giri opening the marks. */
  victimTick(t) {
    const parry = t.own('parry');
    if (parry !== (t.mem.parrySeen ?? 0)) {
      t.mem.parrySeen = parry;
      if (parry) addCut(t);
    }
    const sever = t.own('sever');
    if (sever !== (t.mem.severSeen ?? 0)) {
      t.mem.severSeen = sever;
      if (sever) t.mem.severAt = t.time + R.windup;
    }
    if (t.mem.severAt && t.time >= t.mem.severAt) {
      t.mem.severAt = 0;
      const n = t.stacks(CUT);
      if (n > 0) {
        const o = opening(n, R.markDamage);
        t.clearStacks(CUT);
        t.hitEnemy(o.slow
          ? { damage: o.damage, knock: 0, color: C.accent, status: { kind: 'slow', seconds: P.slowSeconds } }
          : { damage: o.damage, knock: 0, color: C.accent });
      }
    }
  },

  /** His own screen: when the latest mark came (the CPU clicks before they fade). */
  tick(t) {
    const n = t.stacks(CUT);
    if (n > (t.mem.cutsSeen ?? 0)) t.mem.cutAt = t.time;
    t.mem.cutsSeen = n;
  },

  // The CPU fights close: Issen to come in from afar, Noto for three or four marks (or before they fade), Senbon in reach,
  // Sekai-giri for two marks or a kill.
  aiHold(t, slot, dist) {
    const marks = t.stacks(CUT);
    if (slot === 0) return dist < 2 || dist > Q.range + 0.5;
    if (slot === 1) {
      if (dist > W.radius - 0.4 || marks <= 0) return true;
      const fading = t.time - (t.mem.cutAt ?? 0) > P.markLife - 1.2;
      return !(marks >= 3 || fading);
    }
    if (slot === 2) return dist > E.range;
    if (slot === 3) return dist > R.range - 1 || !(marks >= 2 || t.enemyHp() < R.damage + marks * R.markDamage);
    return false;
  },

  /** The CPU against him: with two marks or more, keep 4 m from him until they fade. */
  enemyGoal(t) {
    const foe = t.enemy();
    if (!foe || t.stacks(CUT) < 2) return null;
    const me = t.self().group.position, p = foe.group.position;
    const dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz);
    if (d >= W.radius + 0.6) return null;
    const k = (W.radius + 1) / Math.max(0.01, d);
    return { x: me.x + dx * k, z: me.z + dz * k };
  },
};

export default trait;
