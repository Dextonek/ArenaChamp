import type { Trait } from './types';

/** Blood Price (v5): every spell costs this much HP (R costs `PRICE_R`); a recast costs nothing. */
export const PRICE = 20;
export const PRICE_R = 40;
/** She is Hungry below this share of her max HP. */
export const HUNGRY_BELOW = 0.45;
/** While Hungry, a spell hit of slots 0-2 heals her this share of its damage. */
export const HUNGRY_HEAL = 0.15;
/** Lancet: the rip gives back the price of the cast. */
export const RIP_REFUND = 20;
/** Mist Waltz: attacks it arms, seconds they stay armed, extra damage and reach (m) of each. */
export const MIST_ATTACKS = 2;
export const MIST_SECONDS = 3;
export const MIST_DAMAGE = 18;
export const MIST_REACH = 1.5;
/** Hemocurse: the damage and the Hungry heal of each spell the cursed enemy casts. */
export const CURSE_COST = 30;
export const CURSE_HEAL = 15;
/** Sanguine Feast: the channel, which sets how long she is held. */
export const FEAST_SECONDS = 1.6;

const BASE_ATTACK = 8;
const BLOOD = '#ff3b4e';

/** Is she Hungry? On her own client (`hp` is hers there); the other screen reads `own('hungry')`. */
const hungry = (t: { hp(): number; maxHp(): number }) => t.hp() < t.maxHp() * HUNGRY_BELOW;

/**
 * Whether Vesper is Hungry, for her effects (Sanguine Feast heals only while Hungry). Keyed by her figure: `tick` writes it
 * on her own screen, `ownChanged` on the other one.
 */
export const bloodHungry = new WeakMap<object, boolean>();

/**
 * Hemocurse's record, keyed by her figure. The effect (`src/spells/targeted/hemocurse.ts`) sets `live` when the curse lands
 * and clears it when it ends (3 s, the enemy past 8 m, or no sight), on both screens; `until` is the effect's own clock.
 * `enemyCast` reads `live`.
 */
export interface Hemocurse { live: boolean; until: number }
export const hemocurses = new WeakMap<object, Hemocurse>();

/**
 * What she has dealt to the enemy hero this round (every hit `dealt` sees), keyed by her figure. The engine does not give a
 * spell the target's HP, so Sanguine Feast's "20% of their missing HP" reads this as the missing HP.
 */
export const bloodDrawn = new WeakMap<object, { total: number }>();

/**
 * Vesper's Blood Bond mark, keyed by her figure. The effect (`src/spells/targeted/bloodBond.ts`) opens it on the cast and
 * pops it; the trait feeds it: `landed` adds the damage she deals to the enemy hero while it is `live` (`tally`), and
 * the recast (`recastAct`, `replay: false`) sets `pop`. `tracked` is set by `tick`, which only runs on the screen that
 * owns her trait: where it stays false (the other player's screen of a network duel, which gets no hit reports) the
 * effect pops for a flat damage instead of a tally. Kept for the old spell file (the VFX tool); the v5 kit does not use it.
 */
export interface BloodBond { live: boolean; tally: number; pop: boolean; tracked: boolean }
export const bloodBonds = new WeakMap<object, BloodBond>();

/** Blood Bond: the recast window, and how long the mark ripens before a recast may pop it. Kept for the old spell file. */
export const BOND_WINDOW = 3.8;
export const BOND_RIPEN = 1.5;

/** The mist attacks she has left now (0 after the deadline). */
function mist(t: { time: number; mem: Record<string, number> }) {
  return t.time < (t.mem.mistUntil ?? 0) ? t.mem.mistLeft ?? 0 : 0;
}

/**
 * Vesper (drain juggernaut, ranged attack), kits v5. Passive Blood Price: every spell costs 20 HP (R 40, a recast nothing,
 * `castMods` pays it). Below 45% HP she is Hungry: `tick` shows it (`show('hungry')`, a crimson ring at her feet) and her
 * spell hits of slots 0-2 heal her 15% of their damage (`landed`). Basic attacks and R do not heal that way.
 * Lancet (Q) can be cast again from 1 s to 3 s as the Rip (`recast.arm`); the needle is a pip on the enemy (`dealt`, the
 * first cast adds it, the rip clears it) and the rip's refund of 20 HP comes in `landed`, when the rip really lands.
 * Mist Waltz (W) arms two attacks for 3 s: +18 damage and 1.5 m more reach each (`attackMods`, `attackReach`).
 * Hemocurse (E): the effect owns `hemocurses`; while it is live each spell the enemy casts costs them 30 HP (`enemyCast`
 * calls `hitEnemy`, decided where the hit is real) and heals her 15 if she is Hungry. Sanguine Feast (R) holds her 1.6 s.
 */
export const bloodTrait: Trait = {
  // The CPU only starts the Feast close enough to finish it.
  aiHold: (_t, slot, dist) => slot === 3 && dist > 4,
  passive: { name: 'Blood Price', blurb: 'Each spell costs her 20 HP (R 40). Below 45% HP she is Hungry: her body burns crimson and her spells heal her for 15% of their damage. Above 45% she drinks nothing.' },
  ownLook: {
    mist: { color: '#e9dcc6', shape: 'drop' },
  },
  ownChanged(t, name, n) {
    if (name === 'hungry') bloodHungry.set(t.self(), n > 0);
  },
  speed: 4,
  attack: { kind: 'ranged', range: 5.5, damage: BASE_ATTACK, interval: 0.7, windup: 0.18, speed: 20, look: 'drop' },
  recast: { slot: 0, window: 3, arm: 1, name: 'Rip', power: 1 },
  castMods(t, slot) {
    t.payHp(slot === 3 ? PRICE_R : PRICE);
    return {};
  },
  afterCast(t, slot) {
    if (slot === 0) t.mem.ripUntil = 0;
    if (slot === 1) {
      t.mem.mistUntil = t.time + MIST_SECONDS;
      t.mem.mistLeft = MIST_ATTACKS;
      t.show('mist', MIST_ATTACKS);
    }
    if (slot === 3) t.hold(FEAST_SECONDS);
  },
  recastAct(t, slot) {
    if (slot !== 0) return;
    // The rip lands about 0.3 s after this; `landed` gives the refund only if it does.
    t.mem.ripUntil = t.time + 1.5;
  },
  attackMods(t) {
    const n = mist(t);
    if (n <= 0) return {};
    t.mem.mistLeft = n - 1;
    t.show('mist', n - 1);
    return { power: 1 + MIST_DAMAGE / BASE_ATTACK };
  },
  attackReach: (t) => (mist(t) > 0 ? MIST_REACH : 0),
  dealt(t, hit) {
    if (!hit.victimIsHero) return;
    // What she has dealt this round: Sanguine Feast reads it as the missing HP (`mem` is cleared every round).
    if (!t.mem.drawnInit) { t.mem.drawnInit = 1; bloodDrawn.set(t.self(), { total: 0 }); }
    const d = bloodDrawn.get(t.self());
    if (d) d.total += hit.damage;
    if (hit.kind !== 'spell') return;
    if (hit.slot === 0) {
      // The first cast leaves the needle in (a pip for 3 s); the rip, which finds it there, takes it out.
      if (t.stacks('needle') > 0) t.clearStacks('needle');
      else t.addStacks('needle', 1, 3, 1);
    }
    if (hit.slot === 2) t.addStacks('curse', 1, 3, 1);
  },
  landed(t, hit) {
    if (hit.kind !== 'spell' || hit.slot === undefined || hit.slot > 2) return;
    if (hungry(t)) t.heal(hit.damage * HUNGRY_HEAL);
    if (hit.slot === 0 && t.time < (t.mem.ripUntil ?? 0)) {
      t.mem.ripUntil = 0;
      t.heal(RIP_REFUND);
      t.say(`+${RIP_REFUND}`, BLOOD);
    }
  },
  victimTick(t) {
    // The curse pip goes when the effect says the curse is over (broken early by distance or cover).
    if (t.stacks('curse') > 0 && !hemocurses.get(t.self())?.live) t.clearStacks('curse');
  },
  enemyCast(t) {
    const c = hemocurses.get(t.self());
    if (!c || !c.live) return;
    // Both screens run this; `hitEnemy` and `heal` act only where each is real.
    t.hitEnemy({ damage: CURSE_COST, knock: 0, color: '#8c0f22' });
    if (hungry(t)) t.heal(CURSE_HEAL);
  },
  tick(t) {
    const on = hungry(t);
    bloodHungry.set(t.self(), on);
    t.show('hungry', on ? 1 : 0);
    if (t.mem.mistLeft > 0 && t.time >= (t.mem.mistUntil ?? 0)) t.mem.mistLeft = 0;
    t.show('mist', mist(t));
  },
  ring(t) {
    return t.own('hungry') > 0 ? { radius: 1.1, color: BLOOD, opacity: 0.55 } : null;
  },
};
