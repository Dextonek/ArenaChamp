import type { Trait, TraitView } from './types';

/**
 * Blood Price (the rework of 2026-11-12, pipeline/designs/heroes-rework.md): her spells have no cooldown, each costs her
 * the Price in HP. The Price is her bar: `PRICE_BASE` at rest, `PRICE_STEP` more after every spell (the free Rip too),
 * `PRICE_MAX` at most; it falls `PRICE_COOL` a second once she has cast nothing for `PRICE_REST` s. R costs `PRICE_R` times
 * the Price. She cannot cast what she cannot pay.
 */
export const PRICE_BASE = 10;
export const PRICE_STEP = 10;
export const PRICE_MAX = 100;
export const PRICE_REST = 1;
export const PRICE_COOL = 11;
export const PRICE_R = 2;
/** Her spell hits (Q, W, E; not the Rip, which has its refund) drink back this share of their damage; this share while Hungry. */
export const DRINK = 0.15;
export const DRINK_HUNGRY = 0.65;
/** She is Hungry below this share of her max HP. */
export const HUNGRY_BELOW = 0.45;
/**
 * Lancet: the Rip opens `RIP_ARM` s after the needle and stays open to `RIP_WINDOW` (the effect's own clock for "a second
 * Lancet is the Rip", so the two agree whatever shortens the lock); it gives back this share of what the
 * needle really cost her and makes Lancet ready again. A needle left in locks Lancet for `NEEDLE_LOCK` s (longer than the effect's own
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
export const CURSE_COST = 15;
export const CURSE_HEAL = 20;
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

/** Is she silenced now (a stun is not a silence)? */
const silenced = (t: TraitView) => !!t.status(t.self())?.has('silence');

/** The mist attacks she has left now (0 after the deadline). */
function mist(t: { time: number; mem: Record<string, number> }) {
  return t.time < (t.mem.mistUntil ?? 0) ? t.mem.mistLeft ?? 0 : 0;
}

/** What the next spell in `slot` costs her now. */
export const priceOf = (t: { res: number }, slot: number) => Math.round(t.res) * (slot === 3 ? PRICE_R : 1);

/**
 * How the CPU plays her: the most it will pay for a spell at this HP (a person may pay anything they have). At full HP 45,
 * at half 28, at a quarter 19; it keeps `AI_KEEP` HP back, and after a burst it waits until the Price is within
 * `AI_RESUME` of rest.
 */
const aiBudget = (t: TraitView, slot: number) => (hungry(t) ? (slot === 0 ? AI_HUNGRY_NEEDLE : AI_HUNGRY_BUDGET) : 10 + 35 * (t.hp() / Math.max(1, t.maxHp())));
/** Hungry, her spells drink back most of their damage: the CPU pays up to this, whatever its HP. */
const AI_HUNGRY_BUDGET = 40;
/**
 * Hungry, a needle all but pays for itself (65% of its 30 drunk back, half its price back with the Rip): the CPU throws it
 * up to this Price and does not wait for the Price to come all the way down first.
 */
const AI_HUNGRY_NEEDLE = 60;
/** The HP the CPU keeps back after paying: for the waltz and the curse; for the needle (it drinks at once); for the Feast. */
const AI_KEEP = 50;
const AI_KEEP_NEEDLE = 12;
const AI_KEEP_FEAST = 25;
const AI_RESUME = 5;
/**
 * Someone who has silenced her this round can end the Feast: the CPU then starts it only within this many seconds after a
 * silence began (Oblivion's Null Zone: 3 s of it, the next one 12 s after the last).
 */
const AI_FEAST_AFTER_HUSH = 9.5;
/** Lancet's range (the kit's): inside it the CPU throws the needle before anything else. */
const AI_LANCET_REACH = 7;
/** The CPU starts the Feast (8 m; 9 m of distance ends it) only this close, so that it can finish it. */
const AI_FEAST_REACH = 5.5;
/**
 * Against a brawler (an enemy whose swing has hit her: `taken`) the CPU steps back when they come within `AI_KITE_NEAR` m,
 * to `AI_KITE_STAND` m: out of a swing's reach, inside her own (5.5 m). It only walks while it has nothing to cast or shoot.
 */
const AI_KITE_NEAR = 3.8;
const AI_KITE_STAND = 4.8;

/**
 * Vesper (drain juggernaut, ranged attack), reworked round one rule: no cooldowns, she pays in blood. Q, W and E can be
 * cast again at once (the kit's 0.5 s is the gap the game server asks between two casts of a slot; the Feast's 11 s is its
 * one ultimate in 10 s). Each spell costs her the Price in HP (`castMods` pays it; R twice the Price, in two payments, as
 * the server takes at most 100 at once): 10 at rest, 10 more after every spell, the free Rip too, 100 at most,
 * falling 11 a second once she has cast nothing for 1 s (`tick`). The Price is her bar (`resource`) and the badge shows
 * the next cost. She cannot cast what she cannot pay (`canCast`): a Vesper who has spent herself low stands there with
 * nothing to cast, and `payHp` could not take her last HP anyway.
 * The drain gives it back: every spell hit of Q, W, E heals her 15% of its damage, 65% while she is Hungry (below
 * 45% HP: `tick` shows it, a crimson ring at her feet); `landed`. Lancet (Q) can be cast again from 0.6 s to 3.3 s as the
 * Rip (`recast`): free, it gives back half of what the needle really cost her when it lands (`landed`; the Rip does not
 * drink as well) and makes Lancet ready again at once (`recastAct` sets the cooldown); a needle she leaves in locks Lancet
 * 3.4 s (`cooldown`). The needle is a pip on the enemy (`dealt`). The Feast (R) gives back 45 on its third pulse (the effect).
 * Why the Rip raises the Price and does not drink: measured 2026-11-12, a Vesper who cast nothing but needle and Rip, as
 * fast as they came, won 90% while the Rip stood outside the climb. Greed has to lose (pipeline/designs/heroes-rework.md).
 * Mist Waltz (W) arms two attacks for 3 s: +18 damage and 1.5 m more reach each (`attackMods`, `attackReach`). For the CPU
 * it is a getaway (`escape` in the kit): it flows away from an enemy within 3.5 m and shoots.
 * Hemocurse (E): the effect owns `hemocurses`; while it is live each spell the enemy casts costs them 15 HP (`enemyCast`
 * calls `hitEnemy`, decided where the hit is real) and heals her 20 if she is Hungry. It was 30 before the rework and 20 after it: more
 * and more heroes cast without cooldowns (against Cantor, a spell every beat, 20 was a fifth of her damage). Sanguine Feast (R) holds her 1.6 s.
 * The CPU (`aiHold`) casts in bursts: it pays up to what its HP can bear (45 at full HP, 28 at half; 40 while Hungry, when
 * her spells drink most of it back), then holds off until the Price is nearly back at rest; it keeps 50 HP back, always
 * takes the Rip, does not curse a cursed enemy, throws the needle before it waltzes away, and starts the Feast within
 * 5.5 m (within 4 m it never used it on an archer). Once a brawler's swing has hit her (`taken`) it steps back from them
 * between shots (`aiGoal`).
 * Tuned 2026-11-12 (docs/balance/rework-1a-tuning.html; the needle 33 -> 30, the Rip 24 -> 22, the Feast 35/35/40 -> 18/18/24
 * and 60 -> 45 back, the drink 25% -> 15% and 50% -> 65% Hungry, the curse 20 -> 15 a spell, 660 -> 640 HP): 47 to 50% against the
 * benchmark heroes, on both sides and as the player's hero alone; with nothing but needle and Rip (the greedy line) 0%.
 */
export const bloodTrait: Trait = {
  aiHold(t, slot, dist) {
    // The CPU only starts the Feast close enough to finish it.
    if (slot === 3 && dist > AI_FEAST_REACH) return true;
    // Not into a silence that is due: once silenced, the Feast waits for the moment after the next one.
    if (slot === 3 && t.mem.hushed && (silenced(t) || t.time - (t.mem.hushAt ?? 0) > AI_FEAST_AFTER_HUSH)) return true;
    if (slot === 2 && t.stacks('curse') > 0) return true;
    // A needle that is in is ripped out, whatever the Price: the Rip is free and gives blood back.
    if (slot === 0 && t.stacks('needle') > 0) return false;
    const price = priceOf(t, slot);
    // A burst, then a rest: once the Price has passed what it will pay, it waits until the Price is nearly back down.
    if (t.res > aiBudget(t, 2)) t.mem.aiRest = 1;
    else if (t.res <= PRICE_BASE + AI_RESUME) t.mem.aiRest = 0;
    // Hungry, the needle does not rest: it goes whenever the Price is under what a Hungry needle is worth.
    const resting = !!t.mem.aiRest;
    const rests = resting || t.hp() - price < (slot === 0 ? AI_KEEP_NEEDLE : slot === 3 ? AI_KEEP_FEAST : AI_KEEP);
    // The needle before the waltz: the CPU tries R, E, W before Q, and a brawler in her face had it waltz away again and
    // again (out of Lancet's reach each time) and never throw a needle. The waltz waits while a needle is in (the Rip comes
    // next, and needs them within 8 m) and while it would throw one now.
    if (slot === 1 && (t.stacks('needle') > 0 || (!rests && t.cooldownLeft(0) <= 0 && dist <= AI_LANCET_REACH))) return true;
    return rests;
  },
  aiGoal(t) {
    const e = t.enemy();
    if (!e || !t.mem.brawler) return null;
    const d = t.enemyDistance();
    if (d >= AI_KITE_NEAR) return null;
    // Straight away from them, and along the ring's edge where the floor ends.
    const me = t.self().group.position, p = e.group.position;
    const k = (d - AI_KITE_STAND) / Math.max(d, 0.1);
    let x = me.x + (p.x - me.x) * k, z = me.z + (p.z - me.z) * k;
    const edge = t.arenaRing() - 1, r = Math.hypot(x, z);
    if (r > edge) { x *= edge / r; z *= edge / r; }
    return { x, z };
  },
  taken(t, hit) {
    // A swing, not a bolt (a melee attack shoves harder): the CPU playing her keeps its distance from now on (`aiGoal`).
    if (hit.kind === 'attack' && (hit.opts.knock ?? 0) > 0.5) t.mem.brawler = 1;
  },
  passive: {
    name: 'Blood Price',
    blurb: 'No cooldowns: she pays in blood. Each spell costs her the Price in HP: 10 at rest, 10 more after every spell (the free Rip too), up to 100, falling again when she holds back for a second. Her spell hits drink back 15% of their damage, 65% below 45% HP (Hungry). She cannot cast what she cannot pay.',
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
  canCast: (t, slot) => (t.hp() <= priceOf(t, slot) ? 'Not enough blood' : null),
  castMods(t, slot) {
    const before = t.hp();
    // The server takes at most 100 HP in one payment: the Feast pays the Price twice.
    for (let k = slot === 3 ? PRICE_R : 1; k > 0; k--) t.payHp(Math.round(t.res));
    if (slot === 0) t.mem.needlePaid = Math.max(0, before - t.hp());
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
    // Free, but it is a spell: the Price climbs and its rest starts again.
    t.mem.paidAt = t.time;
    t.addRes(PRICE_STEP);
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
    if (hit.slot === 0 && t.time < (t.mem.ripUntil ?? 0)) {
      // The Rip: its refund is its drink.
      t.mem.ripUntil = 0;
      const back = Math.round((t.mem.needlePaid ?? 0) * RIP_REFUND);
      t.mem.needlePaid = 0;
      if (back > 0) {
        t.heal(back);
        t.say(`+${back}`, BLOOD);
      }
      return;
    }
    t.heal(hit.damage * (hungry(t) ? DRINK_HUNGRY : DRINK));
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
    // For the CPU: when she was last silenced (`aiHold` times the Feast by it).
    if (silenced(t)) { t.mem.hushed = 1; if (!t.mem.hushOn) t.mem.hushAt = t.time; t.mem.hushOn = 1; } else t.mem.hushOn = 0;
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
