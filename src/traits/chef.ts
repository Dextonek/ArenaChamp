import type { GroundMark, Trait, TraitView } from './types';
import { burntDishLook, freshDishLook, goodDishLook } from '../effects/parts/chef';

/** Today's Special: the floor holds at most this many dishes, each lasts this long (s) and is "good" from GOOD_AT (s) on. */
export const DISH_MAX = 3;
export const DISH_LIFE = 8;
export const GOOD_AT = 3;
/** Whoever stands this close (m) to a dish eats it. A dish does not feed whoever stood on it when it landed until they step off. */
export const EAT_RADIUS = 0.9;
/** Eating: fresh gives this much speed (a fraction) for FRESH_SECONDS; good heals GOOD_HEAL as well (only her own screen can heal). */
export const FRESH_HASTE = 0.15;
export const FRESH_SECONDS = 3;
export const GOOD_HEAL = 30;

/** Thrown Cleaver (Q): reach, speed, wind-up, damage, bolt radius. */
export const CLEAVER_RANGE = 9;
export const CLEAVER_SPEED = 20;
export const CLEAVER_WIND = 0.25;
export const CLEAVER_DAMAGE = 66;
export const CLEAVER_RADIUS = 0.3;

/** Hot Soup (W): reach, delay before the pot tips, radius, damage, slow seconds. */
export const SOUP_RANGE = 8;
export const SOUP_DELAY = 1.0;
export const SOUP_RADIUS = 2.5;
export const SOUP_DAMAGE = 56;
export const SOUP_SLOW = 1.5;

/** Burnt Offering (E): reach, the plate's flight time, what eating it does (damage, stun seconds). */
export const BURNT_RANGE = 8;
export const BURNT_FLIGHT = 0.55;
export const BURNT_DAMAGE = 60;
export const BURNT_STUN = 0.8;

/** Dinner Is Served (R): table length, rise time, seconds it stands (from the rise), HP, how far ahead of her its middle is, reach and time to eat, the rewards. */
export const TABLE_LEN = 8;
export const TABLE_RISE = 0.6;
export const TABLE_LIFE = 5;
export const TABLE_HP = 150;
export const TABLE_AHEAD = 3.5;
export const TABLE_THICK = 0.6;
export const TABLE_REACH = 1.8;
export const TABLE_STAND = 1;
export const TABLE_HEAL = 50;
export const TABLE_MIGHT = 0.25;
export const TABLE_MIGHT_SECONDS = 5;

/** `performance.now()` milliseconds throughout the book. `selfOK` / `foeOK`: that eater has stepped off this dish since it landed. */
export interface Dish {
  /** Small integer (0-15), the same on both screens: the eat messages name it. */
  id: number;
  x: number;
  z: number;
  bornAt: number;
  burnt: boolean;
  gone: boolean;
  selfOK: boolean;
  foeOK: boolean;
}

export interface TableRec {
  x: number;
  z: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** Radians: the table's long axis as `rotation.y` of an object that runs along local x. */
  yaw: number;
  bornAt: number;
  until: number;
  /** Someone ate its dishes. */
  eaten: boolean;
  /** Broken, or about to be: no cover, no food. */
  gone: boolean;
  /** The victim's screen saw it break (`victimTick` tells her own client once). */
  broke: boolean;
  told: boolean;
}

/**
 * What Madame Cleaver leaves behind, per figure (the effects play on both screens, so they and the trait share it here).
 * `next`: dish ids so far (both screens count every landed dish in the same order). `eats`, `feasts`: how many times she ate a
 * dish / the table (the `show` values only travel when they change). `standSelf`, `standFoe`: seconds spent at the table.
 * `clock`: the trait's round clock, to notice a new round.
 */
export interface ChefBook {
  next: number;
  dishes: Dish[];
  table: TableRec | null;
  eats: number;
  feasts: number;
  standSelf: number;
  standFoe: number;
  clock: number;
}
export const chefBooks = new WeakMap<object, ChefBook>();

export function bookOf(who: object): ChefBook {
  let b = chefBooks.get(who);
  if (!b) { b = { next: 0, dishes: [], table: null, eats: 0, feasts: 0, standSelf: 0, standFoe: 0, clock: 0 }; chefBooks.set(who, b); }
  return b;
}

/** A round restarted (the trait's clock went back): the old dishes and table are gone. */
function sync(b: ChefBook, clock: number) {
  if (clock < b.clock - 0.5) {
    b.next = 0; b.dishes = []; b.table = null; b.eats = 0; b.feasts = 0; b.standSelf = 0; b.standFoe = 0;
  }
  b.clock = clock;
}

const alive = (d: Dish, now: number) => !d.gone && now >= d.bornAt && now < d.bornAt + DISH_LIFE * 1000;

/** The dishes on the floor now. */
export function liveDishes(b: ChefBook | undefined, now = performance.now()): Dish[] {
  return b ? b.dishes.filter((d) => alive(d, now)) : [];
}

export type DishState = 'fresh' | 'good' | 'burnt';
export function stateOf(d: Dish, now = performance.now()): DishState {
  return d.burnt ? 'burnt' : (now - d.bornAt) / 1000 >= GOOD_AT ? 'good' : 'fresh';
}

/** A dish lands (call it from the spell effect at the moment it lands, on both screens). The oldest goes when there are more than DISH_MAX. */
export function addDish(who: object, x: number, z: number, burnt: boolean): Dish {
  const b = bookOf(who), now = performance.now();
  b.dishes = b.dishes.filter((d) => alive(d, now));
  const id = b.next;
  b.next = (b.next + 1) % 16;
  for (const d of b.dishes) if (d.id === id) d.gone = true;
  const dish: Dish = { id, x, z, bornAt: now, burnt, gone: false, selfOK: false, foeOK: false };
  b.dishes.push(dish);
  b.dishes = b.dishes.filter((d) => !d.gone);
  while (b.dishes.length > DISH_MAX) b.dishes.shift();
  return dish;
}

/** The table as a rule while it stands, else null. */
export function liveTable(b: ChefBook | undefined, now = performance.now()): TableRec | null {
  const r = b?.table;
  return r && !r.gone && now >= r.bornAt && now < r.until ? r : null;
}

/** Distance from (px, pz) to the table's middle line, and the nearest point on it. */
export function tableDist(r: TableRec, px: number, pz: number) {
  const dx = r.bx - r.ax, dz = r.bz - r.az, l2 = dx * dx + dz * dz || 1;
  const k = Math.max(0, Math.min(1, ((px - r.ax) * dx + (pz - r.az) * dz) / l2));
  const cx = r.ax + dx * k, cz = r.az + dz * k;
  return { d: Math.hypot(px - cx, pz - cz), cx, cz };
}

const EAT_WORDS = ['YUM', 'DELICIOUS', 'MM!'];

/** What her own client does when she eats a dish. */
function chefEats(t: TraitView, d: Dish, now: number) {
  t.buff('haste', FRESH_HASTE, FRESH_SECONDS);
  if (stateOf(d, now) === 'good') {
    t.heal(GOOD_HEAL);
    t.say('MAGNIFIQUE', '#f2d27a');
  } else {
    t.say(EAT_WORDS[d.id % EAT_WORDS.length], '#f2efe6');
  }
}

/**
 * Madame Cleaver (support, ranged). Passive Today's Special: her spells leave dishes on the floor (3 at most, 8 s each). WHOEVER
 * walks over one eats it: a fresh dish gives 15% speed for 3 s; from 3 s on it is good (bigger, golden) and heals 30 as well.
 * Burnt dishes (Burnt Offering) are black and smoking: on her they do nothing; on the enemy they are 60 damage and a 0.8 s stun.
 *
 * Where each rule runs. The dishes are `chefBooks` records the spell effects write on BOTH screens when they land (so both draw
 * them, `marks`, and the CPU reads them). Her eating is decided in `tick` on her own client (speed and heal are her own client's)
 * and told with `show('ate', n)`, where `ownChanged` removes the same dish. The enemy's eating is decided in `victimTick`, on the
 * screen that decides the enemy hero (the victim's, online): a `hitEnemy` hit (haste goes through its `debuff`, a stun and damage
 * for a burnt one) and `noteOwner('ate', id)`, where `peerNote` removes it on her screen. If both step on one dish in the same
 * instant either may win; the dish is gone on both screens. A dish does not feed whoever was standing on it as it landed: they
 * must step off and back on (`selfOK` / `foeOK`). Dinner Is Served's table is `TableRec`: whoever stands at it for 1 s eats it.
 * Missing in the shared code: healing the ENEMY (a negative hit is not capped online), so the enemy's good dish is only the speed.
 */
export const chefTrait: Trait = {
  meter: { name: 'DISHES', max: DISH_MAX, value: (t) => liveDishes(chefBooks.get(t.self())).length },
  passive: {
    name: "Today's Special",
    blurb: 'Her spells leave dishes on the floor (3 at most, 8 s). Whoever walks over one eats it: fresh gives 15% speed for 3 s; from 3 s it is good and also heals 30. Burnt ones are 60 damage and a 0.8 s stun to whoever eats them.',
  },
  twist: {
    name: 'Left Longer',
    blurb: 'A dish gets better with time, and is worth more to whoever takes it. Eat her food before she does, and walk round the black and smoking ones.',
  },
  speed: 3.9,
  attack: { kind: 'ranged', range: 5.5, damage: 12, interval: 0.8, windup: 0.2, speed: 20, look: 'orb' },

  // The CPU playing her: the table when it stands, else a good dish within 5 m when she is hurt.
  aiGoal(t) {
    const b = chefBooks.get(t.self());
    if (!b) return null;
    const now = performance.now(), p = t.self().group.position;
    const tb = liveTable(b, now);
    if (tb && !tb.eaten) {
      const { cx, cz } = tableDist(tb, p.x, p.z);
      // The spot a metre and a quarter off the table's middle line, on her own side.
      let ux = p.x - cx, uz = p.z - cz;
      const l = Math.hypot(ux, uz);
      if (l < 1e-3) { ux = -(tb.bz - tb.az); uz = tb.bx - tb.ax; }
      const k = Math.hypot(ux, uz) || 1;
      return { x: cx + (ux / k) * 1.25, z: cz + (uz / k) * 1.25 };
    }
    if (t.hp() < t.maxHp() * 0.75) {
      let best: Dish | null = null, bd = 5;
      for (const d of liveDishes(b, now)) {
        if (d.burnt || stateOf(d, now) !== 'good') continue;
        const k = Math.hypot(d.x - p.x, d.z - p.z);
        if (k < bd) { bd = k; best = d; }
      }
      if (best) return { x: best.x, z: best.z };
    }
    return null;
  },

  // The CPU fighting her: steal a good dish within 4 m; step away from a burnt one that is close.
  enemyGoal(t) {
    const b = chefBooks.get(t.self()), e = t.enemy();
    if (!b || !e) return null;
    const now = performance.now(), p = e.group.position;
    const live = liveDishes(b, now);
    for (const d of live) {
      if (!d.burnt) continue;
      const k = Math.hypot(p.x - d.x, p.z - d.z);
      if (k < 1.5) {
        const ux = k < 1e-3 ? 1 : (p.x - d.x) / k, uz = k < 1e-3 ? 0 : (p.z - d.z) / k;
        return { x: d.x + ux * 2.6, z: d.z + uz * 2.6 };
      }
    }
    let best: Dish | null = null, bd = 4;
    for (const d of live) {
      if (d.burnt || stateOf(d, now) !== 'good') continue;
      const k = Math.hypot(d.x - p.x, d.z - p.z);
      if (k < bd) { bd = k; best = d; }
    }
    return best && { x: best.x, z: best.z };
  },

  // The CPU's kit: Q and W as usual (W only at range), E only while the floor has room and the enemy is not on top of her, R once, when the enemy is near.
  aiHold(t, slot, dist) {
    const b = chefBooks.get(t.self());
    if (slot === 1) return dist < 2.5;
    if (slot === 2) return liveDishes(b).length >= 2 || dist < 3;
    if (slot === 3) return !!liveTable(b) || dist > 7.5;
    return false;
  },

  marks(t) {
    const b = chefBooks.get(t.self());
    if (!b || b.dishes.length === 0) return [];
    sync(b, t.time);
    const now = performance.now(), out: GroundMark[] = [];
    for (const d of b.dishes) {
      if (!alive(d, now)) continue;
      out.push({ x: d.x, z: d.z, kind: stateOf(d, now), age: (now - d.bornAt) / 1000, life: DISH_LIFE });
    }
    return out;
  },
  markLook: {
    fresh: () => freshDishLook(),
    good: () => goodDishLook(),
    burnt: () => burntDishLook(),
  },

  // Her own client: she eats what she walks over, and the table she stands at.
  tick(t, dt) {
    const b = chefBooks.get(t.self());
    if (!b) return;
    sync(b, t.time);
    const now = performance.now(), p = t.self().group.position;
    for (const d of b.dishes) {
      if (!alive(d, now)) continue;
      if (Math.hypot(p.x - d.x, p.z - d.z) > EAT_RADIUS) { d.selfOK = true; continue; }
      // Her own burnt dish does nothing to her, and stays where it is.
      if (!d.selfOK || d.burnt) continue;
      d.gone = true;
      chefEats(t, d, now);
      b.eats++;
      t.show('ate', ((b.eats - 1) % 60) * 16 + d.id + 1);
    }
    const tb = liveTable(b, now);
    if (tb && !tb.eaten && tableDist(tb, p.x, p.z).d <= TABLE_REACH) {
      b.standSelf += dt;
      if (b.standSelf >= TABLE_STAND) {
        tb.eaten = true;
        b.standSelf = 0;
        t.heal(TABLE_HEAL);
        t.buff('might', TABLE_MIGHT, TABLE_MIGHT_SECONDS);
        t.say('BON APPETIT', '#f2efe6');
        b.feasts++;
        t.show('feast', ((b.feasts - 1) % 900) + 1);
      }
    } else b.standSelf = 0;
    b.dishes = b.dishes.filter((d) => !d.gone && now < d.bornAt + DISH_LIFE * 1000);
  },

  // The screen that decides the enemy hero: it eats what it walks over, and the table it stands at.
  victimTick(t, dt) {
    const b = chefBooks.get(t.self()), e = t.enemy();
    if (!b || !e) return;
    sync(b, t.time);
    const now = performance.now(), p = e.group.position;
    for (const d of b.dishes) {
      if (!alive(d, now)) continue;
      if (Math.hypot(p.x - d.x, p.z - d.z) > EAT_RADIUS) { d.foeOK = true; continue; }
      if (!d.foeOK) continue;
      d.gone = true;
      if (d.burnt) {
        t.hitEnemy({ damage: BURNT_DAMAGE, knock: 0, color: '#d84a3a', status: { kind: 'stun', seconds: BURNT_STUN } });
        t.say('BURNT!', '#d84a3a');
      } else {
        t.hitEnemy({ damage: 0, knock: 0, color: '#f2efe6', debuff: { kind: 'haste', amount: FRESH_HASTE, seconds: FRESH_SECONDS } });
        if ((now - d.bornAt) / 1000 >= GOOD_AT) t.healEnemy(GOOD_HEAL);
      }
      t.noteOwner('ate', d.id);
    }
    const tb = liveTable(b, now);
    if (tb && !tb.told && tb.broke) { tb.told = true; tb.gone = true; t.noteOwner('table', 1); }
    if (tb && !tb.eaten && !tb.gone && tableDist(tb, p.x, p.z).d <= TABLE_REACH) {
      b.standFoe += dt;
      if (b.standFoe >= TABLE_STAND) {
        tb.eaten = true;
        b.standFoe = 0;
        t.hitEnemy({ damage: 0, knock: 0, color: '#f2efe6', debuff: { kind: 'might', amount: TABLE_MIGHT, seconds: TABLE_MIGHT_SECONDS } });
        t.healEnemy(TABLE_HEAL);
        t.noteOwner('feast', 1);
      }
    } else b.standFoe = 0;
    b.dishes = b.dishes.filter((d) => !d.gone && now < d.bornAt + DISH_LIFE * 1000);
  },

  // The other screen learns what her own client ate.
  ownChanged(t, name, n) {
    const b = chefBooks.get(t.self());
    if (!b) return;
    if (name === 'ate') {
      const id = (n - 1) % 16;
      for (const d of b.dishes) if (d.id === id && !d.gone) d.gone = true;
    } else if (name === 'feast' && b.table) b.table.eaten = true;
  },

  // Her own client learns what the enemy ate or broke.
  peerNote(t, name, n) {
    const b = chefBooks.get(t.self());
    if (!b) return;
    if (name === 'ate') {
      for (const d of b.dishes) if (d.id === n && !d.gone) d.gone = true;
    } else if (name === 'feast') {
      if (b.table) b.table.eaten = true;
    } else if (name === 'table') {
      if (b.table) b.table.gone = true;
    }
  },

  badge(t) {
    const n = liveDishes(chefBooks.get(t.self())).length;
    return n > 0 ? String(n) : '';
  },
};
