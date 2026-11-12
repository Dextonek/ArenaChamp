import type { Trait, TraitView } from './types';

/**
 * Blood Price (the rework of 2026-11-12, pipeline/designs/heroes-rework.md): her spells have no cooldown, each costs her
 * the Price in HP. The Price is her bar: `PRICE_BASE` at rest, `PRICE_STEP` more after every spell she pays for, `PRICE_MAX`
 * at most; it falls `PRICE_COOL` a second once she has paid for nothing for `PRICE_REST` s. R costs `PRICE_R` times the Price.
 */
export const PRICE_BASE = 10;
export const PRICE_STEP = 10;
export const PRICE_MAX = 60;
export const PRICE_REST = 1.5;
export const PRICE_COOL = 10;
export const PRICE_R = 2;
/** Her spell hits (Q, W, E) drink back this share of their damage; this share while she is Hungry. */
export const DRINK = 0.25;
export const DRINK_HUNGRY = 0.5;
/** She is Hungry below this share of her max HP. */
export const HUNGRY_BELOW = 0.45;
/**
 * Lancet: the Rip opens `RIP_ARM` s after the needle and stays open to `RIP_WINDOW` (the effect's own clock for "a second
 * Lancet is the Rip", so the two agree whatever shortens the lock); it gives back this share of what the
 * needle cost and makes Lancet ready again. A needle left in locks Lancet for `NEEDLE_LOCK` s (longer than the effect's own
 * 3.3 s clock, so the two always agree on which cast is the Rip).
 */
export const RIP_ARM = 0.6;
export const RIP_WINDOW = 3.3;
export const RIP_REFUND = 0.5;
export const NEEDLE_LOCK = 3.4;
/** The gap the game server asks between two casts of a slot (the kit's cooldown of Q, W, E). */
export const SLOT_GAP = 0.5;
/** Mist Waltz: attacks it arms, seconds they stay armed, extra damage and reach (m) of each. */
export const MIST_ATTACKS = 2;
export const MIST_SECONDS = 3;
export const MIST_DAMAGE = 18;
export const MIST_REACH = 1.5;
/** Hemocurse: the damage and the Hungry heal of each spell the cursed enemy casts. */
export const CURSE_COST = 20;
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

/** What the next spell in `slot` costs her now. */
export const priceOf = (t: { res: number }, slot: number) => Math.round(t.res) * (slot === 3 ? PRICE_R : 1);

/**
 * How the CPU plays her: the most it will pay for a spell at this HP (a person may pay anything). At full HP 45, at half
 * 28, at a quarter 19; and it keeps `AI_KEEP` HP back.
 */
const aiBudget = (t: TraitView) => 10 + 35 * (t.hp() / Math.max(1, t.maxHp()));
const AI_KEEP = 50;
const AI_RESUME = 5;

/**
 * Vesper (drain juggernaut, ranged attack), reworked round one rule: no cooldowns, she pays in blood. Q, W and E can be
 * cast again at once (the kit's 0.5 s is the gap the game server asks between two casts of a slot; the Feast's 11 s is its
 * one ultimate in 10 s). Each spell costs her the Price in HP (`castMods` pays it; R twice the Price): 10 at rest, 10 more
 * after every spell she pays for, 60 at most, falling 8 a second once she has paid for nothing for 1.5 s (`tick`). The Price
 * is her bar (`resource`) and the badge shows the next cost. `payHp` never takes her last HP: at 1 HP she casts for
 * nothing, and anything kills her.
 * The drain gives it back: every spell hit of Q, W, E heals her a quarter of its damage, half while she is Hungry (below
 * 45% HP: `tick` shows it, a crimson ring at her feet); `landed`. Lancet (Q) can be cast again from 0.6 s to 3 s as the Rip
 * (`recast`): free, it gives back half of what the needle cost when it lands (`landed`) and makes Lancet ready again at
 * once (`recastAct` sets the cooldown); a needle she leaves in locks Lancet 3.4 s (`cooldown`). The needle is a pip on the
 * enemy (`dealt`). The Feast (R) gives back 60 on its third pulse (the effect).
 * Mist Waltz (W) arms two attacks for 3 s: +18 damage and 1.5 m more reach each (`attackMods`, `attackReach`).
 * Hemocurse (E): the effect owns `hemocurses`; while it is live each spell the enemy casts costs them 30 HP (`enemyCast`
 * calls `hitEnemy`, decided where the hit is real) and heals her 15 if she is Hungry. Sanguine Feast (R) holds her 1.6 s.
 * The CPU (`aiHold`) casts in bursts: it pays up to what its HP can bear (45 at full HP, 28 at half), then holds off until
 * the Price is nearly back at rest; it keeps 50 HP back, does not curse a cursed enemy and starts the Feast only within 4 m.
 */
export const bloodTrait: Trait = {
  aiHold(t, slot, dist) {
    // The CPU only starts the Feast close enough to finish it.
    if (slot === 3 && dist > 4) return true;
    if (slot === 2 && t.stacks('curse') > 0) return true;
    // A needle that is in is ripped out, whatever the Price: the Rip is free and gives blood back.
    if (slot === 0 && t.stacks('needle') > 0) return false;
    const price = priceOf(t, slot);
    // A burst, then a rest: once the Price has passed what it will pay, it waits until the Price is nearly back down.
    if (t.res > aiBudget(t)) t.mem.aiRest = 1;
    else if (t.res <= PRICE_BASE + AI_RESUME) t.mem.aiRest = 0;
    return !!t.mem.aiRest || t.hp() - price < AI_KEEP;
  },
  passive: {
    name: 'Blood Price',
    blurb: 'No cooldowns: she pays in blood. Each spell costs her the Price in HP: 10 at rest, 10 more after every spell, falling again when she holds back 1.5 s. Her spell hits drink back a quarter of their damage, half below 45% HP (Hungry). The Price never takes her last HP, but anything else will.',
  },
  resource: { name: 'Price', max: PRICE_MAX, color: BLOOD, start: PRICE_BASE },
  ownLook: {
    mist: { color: '#e9dcc6', shape: 'drop' },
  },
  ownChanged(t, name, n) {
    if (name === 'hungry') bloodHungry.set(t.self(), n > 0);
  },
  speed: 4,
  attack: { kind: 'ranged', range: 5.5, damage: BASE_ATTACK, interval: 0.7, windup: 0.18, speed: 20, look: 'drop' },
  recast: { slot: 0, window: RIP_WINDOW, arm: RIP_ARM, name: 'Rip', power: 1 },
  castMods(t, slot) {
    const price = priceOf(t, slot);
    t.payHp(price);
    if (slot === 0) t.mem.needlePaid = price;
    t.mem.paidAt = t.time;
    t.addRes(PRICE_STEP);
    return {};
  },
  // A needle left in keeps Lancet until it is ripped out or crumbles.
  cooldown: (_t, slot, base) => (slot === 0 ? NEEDLE_LOCK : base),
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
    // The rip lands about 0.3 s after this; `landed` gives the refund only if it does. The needle is out: Lancet is ready.
    t.mem.ripUntil = t.time + 1.5;
    t.setCooldown(0, SLOT_GAP);
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
    t.heal(hit.damage * (hungry(t) ? DRINK_HUNGRY : DRINK));
    if (hit.slot === 0 && t.time < (t.mem.ripUntil ?? 0)) {
      t.mem.ripUntil = 0;
      const back = Math.round((t.mem.needlePaid ?? 0) * RIP_REFUND);
      t.mem.needlePaid = 0;
      if (back > 0) {
        t.heal(back);
        t.say(`+${back}`, BLOOD);
      }
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
  tick(t, dt) {
    const on = hungry(t);
    bloodHungry.set(t.self(), on);
    t.show('hungry', on ? 1 : 0);
    if (t.mem.mistLeft > 0 && t.time >= (t.mem.mistUntil ?? 0)) t.mem.mistLeft = 0;
    t.show('mist', mist(t));
    // The Price falls back once she has held off.
    if (t.res > PRICE_BASE && t.time - (t.mem.paidAt ?? 0) >= PRICE_REST) t.addRes(Math.max(PRICE_BASE - t.res, -PRICE_COOL * dt));
  },
  ring(t) {
    return t.own('hungry') > 0 ? { radius: 1.1, color: BLOOD, opacity: 0.55 } : null;
  },
  badge: (t) => `-${priceOf(t, 0)}`,
};
