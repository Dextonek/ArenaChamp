import type { Trait, TraitView } from './types';

/** Card Spray (Q): damage per card, reach (m), speed (m/s), wind-up (s), the fan's full width (degrees), a card's bolt radius. */
export const CARD_DAMAGE = 26;
export const CARD_RANGE = 8;
export const CARD_SPEED = 22;
export const CARD_WIND = 0.3;
export const CARD_FAN = 24;
export const CARD_RADIUS = 0.3;

/** Sawn in Half (W): damage, reach, speed, wind-up, the bolt's radius, and the slow it leaves (s). */
export const SAW_DAMAGE = 60;
export const SAW_RANGE = 8;
export const SAW_SPEED = 18;
export const SAW_WIND = 0.3;
export const SAW_RADIUS = 0.35;
export const SAW_SLOW = 1.5;

/** The Hat Trick (E): the shuffle (s), the stun he gets when his hat is hit (s), a hat's HP, and the ring the hats start on (m). */
export const HAT_TIME = 1.5;
export const HAT_STUN = 1;
export const HAT_HP = 1;
export const HAT_RING = 1.1;

/** The Grand Finale (R): reach, the ring's radius round the enemy (m), the wait before the swords fly (s), damage per sword, speed, reach and radius. */
export const FINALE_RANGE = 9;
export const FINALE_RING = 3;
export const FINALE_WAIT = 1.2;
export const FINALE_DAMAGE = 30;
export const FINALE_SPEED = 16;
export const FINALE_REACH = 3.6;
export const FINALE_RADIUS = 0.3;

/** Ta-da! (passive): the bonus on the first spell after he comes out of a hat, how long it waits (s), and the rabbit. */
export const TADA_POWER = 1.4;
export const TADA_WINDOW = 8;
export const RABBIT_HP = 20;
export const RABBIT_DAMAGE = 8;
export const RABBIT_LIFE = 8;
export const RABBIT_SPEED = 4.5;

/** One hat act (The Hat Trick or The Grand Finale), written by the effect on BOTH screens at the moment it plays. */
export interface HatAct {
  kind: 'trick' | 'finale';
  /** The hat he comes out of (0-2), the same on both screens. */
  right: number;
  /** `performance.now()` ms when it started and when he is back. */
  bornAt: number;
  until: number;
  /** The right hat was hit (or the screen that decides hits says so): he pops out stunned. */
  popped: boolean;
  /** The victim's screen has told his own client (`noteOwner`). */
  told: boolean;
}

/**
 * What Zambini leaves behind, per figure (the effects play on both screens and the CPU's next cast reuses one effect, so the state
 * lives here and not in an effect). `key`: the value both screens shuffle by. His own client makes it in `afterCast` from the round
 * time and a counter (never `Math.random`) and sends it with `show('hatKey')`; the other screen reads it in `ownChanged`.
 */
export interface MagicBook { key: number; act: HatAct | null }
export const magicBooks = new WeakMap<object, MagicBook>();

export function bookOf(who: object): MagicBook {
  let b = magicBooks.get(who);
  if (!b) { b = { key: 1, act: null }; magicBooks.set(who, b); }
  return b;
}

/** The hat he comes out of and the three swaps of the shuffle, from the shared key. Pure: both screens get the same answer. */
export function shuffleOf(key: number): { right: number; swaps: [number, number][] } {
  const pairs: [number, number][] = [[0, 1], [1, 2], [0, 2]];
  const s0 = key % 3;
  const s1 = (s0 + 1 + (Math.floor(key / 3) % 2)) % 3;
  const s2 = (s1 + 1 + (Math.floor(key / 7) % 2)) % 3;
  return { right: (key + Math.floor(key / 5) + Math.floor(key / 11)) % 3, swaps: [pairs[s0], pairs[s1], pairs[s2]] };
}

const WORDS = ['TA-DA!', 'BEHOLD!'];

/** His own client: his hat was hit while he is under it. He is out now: his statuses are cleared (the seal spent the lock budget) and he is stunned. */
function popOut(t: TraitView) {
  const e = t.time - (t.mem.hideAt ?? -99);
  if (!(e >= 0 && e < (t.mem.hideLen ?? 0))) return;
  t.mem.hideLen = 0;
  const st = t.status(t.self());
  st?.clear();
  st?.apply('stun', HAT_STUN);
}

/**
 * The Great Zambini (trickster). Passive Ta-da!: the first spell after he comes out of a hat deals +40% (`castMods`) and a white rabbit
 * runs at the enemy (20 HP, 8 damage; the effects make it with `ctx.summon` where the hit is decided).
 *
 * Where each rule runs. Hiding is `own('down')`, which `figureHidden` reads on both screens (his figure is not drawn): his own client
 * sets it in `afterCast` / `tick` for the length of the act and keeps him `sealed` for that long (nothing can hit him, he cannot act).
 * The hats are real units made by the effect on both screens (`ctx.summon` exists in the hero's own context and in the replayed one), so a
 * spell or bolt that reaches one pops it. The right hat popped: the effect writes `act.popped` on that screen. On his own screen `tick` sees it;
 * on the enemy's screen `victimTick` tells his own client with `noteOwner('popped')` and `peerNote` there ends the act: his statuses are cleared (the lock budget of the seal would
 * leave no stun) and he is stunned for 1 s, and the effect moves him to the hat. The end of an act moves him to his hat with
 * `ctx.moveCaster` (his own client), and `tick` there arms Ta-da!. The CPU (`aiHold`): E when his HP is under 60% or the enemy is within
 * 4 m; R when the enemy is within 9 m. Q and W whenever the duel AI finds them in reach.
 */
export const magicTrait: Trait = {
  passive: {
    name: 'Ta-da!',
    blurb: 'His first spell within 8 s of coming out of a hat (not another hat) deals 40% more, and a white rabbit runs at you (20 HP, 8 damage).',
  },
  twist: {
    name: 'Which Hat?',
    blurb: 'Hide for safety, or stay out for damage. Hit the right hat and he pops out stunned; an area spell hits all three.',
  },
  speed: 4.1,
  attack: { kind: 'ranged', range: 6, damage: 12, interval: 1.0, windup: 0.25, speed: 20, look: 'spark', color: '#ffe08a' },

  aiHold(t, slot, dist) {
    if (slot === 2) return !(t.hp() < 0.6 * t.maxHp() || dist <= 4);
    if (slot === 3) return dist > FINALE_RANGE;
    return false;
  },

  canCast(t) {
    return t.own('down') > 0 ? 'Under the hat' : null;
  },

  castMods(t, slot) {
    // The hat tricks do no damage, so they keep the bonus for the spell that does.
    const mods: { power?: number; status?: { kind: 'slow'; seconds: number } } = {};
    if (slot === 1) mods.status = { kind: 'slow', seconds: SAW_SLOW };
    if (slot !== 2 && t.mem.tada === 1) {
      t.mem.tada = 0;
      if (t.time - t.mem.tadaAt <= TADA_WINDOW) {
        mods.power = TADA_POWER;
        t.say('TA-DA!', '#ffe08a');
      }
    }
    return mods;
  },

  afterCast(t, slot) {
    if (slot !== 2 && slot !== 3) return;
    t.mem.casts = (t.mem.casts ?? 0) + 1;
    const key = 1 + ((Math.floor(t.time * 10) * 37 + t.mem.casts * 101) % 997);
    bookOf(t.self()).key = key;
    t.show('hatKey', key);
    t.mem.hideAt = t.time;
    t.mem.hideLen = slot === 2 ? HAT_TIME : FINALE_WAIT;
    t.mem.sealed = 0;
    t.say('BEHOLD!', '#b05aff');
  },

  /** His own client: `down` is shown for the length of the act and he is sealed for it. */
  tick(t) {
    if (!('hideAt' in t.mem)) return;
    const e = t.time - t.mem.hideAt;
    // His hat was hit on this very screen (his own hero-side hat units, hit by the enemy's replayed casts): out and stunned.
    const act = bookOf(t.self()).act;
    if (act && act.kind === 'trick' && act.popped) popOut(t);
    if (e >= 0 && e < t.mem.hideLen) {
      if (t.own('down') === 0) t.show('down', 1);
      const st = t.status(t.self());
      // A seal lasts 1.2 s at most: renew it until the act is over (the lock cap, 1.5 s, covers the Hat Trick).
      if (st && st.remaining('sealed') < 0.12) st.apply('sealed', Math.min(1.2, t.mem.hideLen - e + 0.03));
    } else if (t.own('down') !== 0) {
      t.show('down', 0);
      t.mem.tada = 1;
      t.mem.tadaAt = t.time;
      t.say(WORDS[0], '#ffe08a');
    }
  },

  figureHidden(t) {
    return t.own('down') > 0;
  },

  ownChanged(t, name, n) {
    if (name === 'hatKey') bookOf(t.self()).key = n;
  },

  /** Where the hats' hits are decided: tell his own client his hat was hit. */
  victimTick(t) {
    const act = bookOf(t.self()).act;
    if (!act || act.kind !== 'trick' || !act.popped || act.told) return;
    act.told = true;
    t.noteOwner('popped', 1);
  },

  /** His own client: the right hat was hit. He is out, and stunned. */
  peerNote(t, name) {
    if (name !== 'popped') return;
    const act = bookOf(t.self()).act;
    if (act) { act.popped = true; act.told = true; }
    popOut(t);
  },

  badge(t) {
    return t.own('down') > 0 ? 'HAT' : '';
  },
};
