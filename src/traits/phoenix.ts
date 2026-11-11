import * as THREE from 'three';
import { PHOENIX_CSS, ashesLook, eggLook, emberLook, emberPuffLook, nestLook } from '../effects/parts/phoenix';
import { addGroundWiper } from './ground';
import type { GroundMark, Trait, TraitView } from './types';

/**
 * Anka, the Firebird (mage, ranged; pipeline/designs/kit-phoenix.md). Everything she does lays embers on the floor or
 * spends them. An ember is a blast (Fan the Flames), a place to fly to (Ember Flight) and her second life (Ashborn).
 *
 * Embers: 3 at most, 12 s each, a fourth puts out the oldest. The NEWEST is her nest (drawn with a crown of flame for both
 * players). An enemy who stands within 1 m of an ember for 1 s in all stamps it out; an ember is too hot to stamp in its
 * first second (gate 5: at 0.6 s and no grace the CPU stamped every ember a quill left under it before she could use it).
 *
 * Ashborn, once a round: a hero's hit that would fell her while a nest burns is swallowed. She turns to ash: for 1.2 s she is
 * not drawn, cannot act and nothing reaches her, an egg glows at the nest and she slides there unseen; her HP climbs to 25%.
 * Then she rises in a flare (2.2 m: 40 and a push) and every ember goes out. The arena's own damage (its event, the closing
 * floor, Last stand) is not a hero's hit: it never passes through a trait, so it kills her for good, in the egg too.
 * In the Raid a boss's ordinary hit is a hit like a hero's (she rises), and a blow that nothing holds (`lethal`: Ash's Charge)
 * passes no trait either: it kills her for good, nest or no nest, and in the egg (measured at gate 5, docs/catalog/heroes/phoenix.md).
 *
 * Where each rule runs. The embers are state that outlives every spell, so they live here in a WeakMap keyed by her figure,
 * and the spell effects add and spend them at the moment they land, on both screens (`layEmber`, `spendEmber`, `burnOut`).
 * `marks` draws them (both screens). Stamping is the enemy's move, so it is decided where the enemy's position is decided:
 * `victimTick` removes the ember and tells her client with `noteOwner('stamp', id)`. The second life is decided in `taken`,
 * on her own client, which knows her real HP: the hit is marked `blocked` (so its status, push and pull go too) and she pays
 * down to 1 HP herself. She is kept safe by `taken` swallowing every later hit, NOT by the `sealed` status, which the engine
 * refuses inside the 0.5 s after a stun (most kills follow one). The other screen learns it by `show('ash', nest id + 1)` and
 * mirrors the egg in `ownChanged`. The flare is a passive's hit (`hitEnemy`) from `victimTick`. Ids are 0..19 (a note's
 * number is clamped to 0-20).
 *
 * Which ember is which, on both screens (gate 5, found with two screens online). A quill lands at a different moment on the
 * two screens (on hers it flies along the aim, on the enemy's it is a real bolt), so "the newest" and an ember's id must not
 * depend on which LANDED first: a quill thrown during Firebird's wind-up, or just after Fan the Flames, landed before the other
 * spell's moment on one screen and after it on the other, and the two screens then disagreed on the nest for 12 s. So every
 * cast of hers takes a number (`castNo`: an effect's `cast` runs once a cast on each screen, in the same order), an ember
 * carries the number of the cast that laid it, the embers are kept in that order (the nest is the one of the LATEST CAST), its
 * id is that number, and Fan the Flames burns the embers of earlier casts only: ALL of them, also one that lands after the
 * flare (`Book.burnt`). The last matters: Firebird's take-off and a fan's flare are two timers 0.1 s apart when the fan is cast
 * 0.3 s into the wind-up, and one slow frame on one screen (the first cast of a match builds its effect) swapped them there,
 * so the take-off ember burned on one screen and stayed on the other. Her rising takes the embers of every cast before it
 * in the same way.
 *
 * Where a quill's ember lies, on both screens (gate 5, found with an enemy who sidesteps). In a network duel a bolt flies on
 * both screens, each against the enemy where that screen draws it, and only the enemy's own screen decides the hit: a quill
 * that hits on one screen flies on to its full reach on the other. So the screen that decides (the one `victimTick` runs on)
 * tells her client how far along its aim the quill really got (`noteOwner('lay', id * 50 + quarter metres)`), and her client
 * moves that ember there when it lies more than half a metre off (`peerNote`). Without it a dodged quill left her nest 2 to 7 m
 * apart on the two screens, and the egg of her rising was shown where she did not rise.
 */

export const EMBER_LIFE = 12;
export const MAX_EMBERS = 3;
export const STAMP_R = 1;
/** Seconds an enemy must stand on an ember to stamp it out, and the seconds a new ember is too hot to stamp at all. */
export const STAMP_S = 1.0;
export const EMBER_FRESH = 1.0;

/** Ember Quill (Q): damage, reach (m), speed (m/s), wind-up (s), the bolt's radius (m). */
export const QUILL_DAMAGE = 54;
export const QUILL_RANGE = 10;
export const QUILL_SPEED = 22;
export const QUILL_WIND = 0.3;
export const QUILL_RADIUS = 0.3;

/** Fan the Flames (W): the wait (s), each ring's radius (m), damage (once per cast, however many rings). */
export const FLARE_WIND = 0.8;
export const FLARE_RADIUS = 2.2;
export const FLARE_DAMAGE = 54;

/** Ember Flight (E): reach to the ember (m), seconds before she leaves, seconds in the air, the landing's radius and damage. */
export const FLIGHT_RANGE = 12;
export const FLIGHT_GO = 0.25;
export const FLIGHT_AIR = 0.45;
export const FLIGHT_RADIUS = 1.8;
export const FLIGHT_DAMAGE = 40;

/** Firebird (R): the wind-up (s), the lane's length and width (m), seconds in the air, damage. */
export const BIRD_WIND = 1.0;
export const BIRD_LENGTH = 12;
export const BIRD_WIDTH = 3;
export const BIRD_AIR = 0.5;
export const BIRD_DAMAGE = 120;

/** Ashborn: seconds as ash, the share of her HP she rises with, the flare's radius, damage and push. */
export const ASH_SECONDS = 1.2;
export const RISE_SHARE = 0.25;
export const RISE_RADIUS = 2.2;
export const RISE_DAMAGE = 40;
export const RISE_KNOCK = 8;

const PUFF_LIFE = 0.6;
const NEAR_EMBER_R = 3;

export interface Ember {
  id: number; x: number; z: number; born: number;
  /** The number of the cast that laid it (`castNo`). */
  seq: number;
  /** A quill's ember: where the quill left her hand and its heading, so its end can be told as a distance along it. */
  aim?: QuillAim;
  /** Its place has been told to her client (the screen that decides the hit). */
  sent?: boolean;
}

/** A quill's flight, alike on both screens: from where (the caster's own position at the cast) and its heading. */
export interface QuillAim { fx: number; fz: number; dx: number; dz: number }

/** A quill's true end travels as a count of these metres along its aim (a note's number is small). */
const LAY_STEP = 0.25;

/** Moves a quill's ember to `k` steps along its aim, if it lies more than half a metre from there (on one screen it never does). */
function placeAlong(e: Ember, k: number) {
  if (!e.aim) return;
  const x = e.aim.fx + e.aim.dx * k * LAY_STEP, z = e.aim.fz + e.aim.dz * k * LAY_STEP;
  if (Math.hypot(x - e.x, z - e.z) <= 0.5) return;
  e.x = x;
  e.z = z;
}

interface Book {
  embers: Ember[];
  puffs: { x: number; z: number; born: number; burnt: boolean }[];
  /** Her casts this round, counted alike on both screens. */
  casts: number;
  /** The embers of casts numbered below this are burnt (a fan that flared, her rising): one that lands late is out at once. */
  burnt: number;
  /** A quill's true end that reached her client before her own screen had laid its ember: by ember id, with the clock. */
  told: Map<number, { k: number; at: number }>;
  /** While she is ash: the egg at the nest, where she fell, and when (ember clock). */
  ash: { x: number; z: number; fromX: number; fromZ: number; at: number } | null;
  /** The ember the CPU wants Ember Flight to take, and when it said so (`performance.now()`). */
  cpuPick: { id: number; at: number } | null;
}

const books = new WeakMap<object, Book>();
const clocks = new WeakMap<object, number>();
/** Seconds each ember has been stood on (the victim's screen). */
const stomps = new WeakMap<Ember, number>();

/** The seconds a figure's trait last wrote (its round clock); in the VFX tool, where no trait runs, real time. */
export function emberNow(fig: object): number {
  return clocks.get(fig) ?? performance.now() / 1000;
}

/** True when a trait is writing this figure's clock (a duel): the effects then leave the embers to `marks`. */
export function emberLive(fig: object): boolean {
  return clocks.has(fig);
}

/** Writes the clock. A clock that went back (a new round) or embers from the future (the tool's real time) empty the book. */
function syncClock(fig: object, time: number) {
  const prev = clocks.get(fig);
  const b = books.get(fig);
  if (prev !== undefined && time < prev - 0.5) books.delete(fig);
  else if (b && b.embers.some((e) => e.born > time + 0.5)) books.delete(fig);
  clocks.set(fig, time);
}

function book(fig: object): Book {
  let b = books.get(fig);
  if (!b) { b = { embers: [], puffs: [], casts: 0, burnt: 0, told: new Map(), ash: null, cpuPick: null }; books.set(fig, b); }
  return b;
}

/** Her embers, oldest first. */
export function embersOf(fig: object): readonly Ember[] {
  return books.get(fig)?.embers ?? [];
}

/** The nest: the newest ember, or null. */
export function nestOf(fig: object): Ember | null {
  const e = books.get(fig)?.embers;
  return e && e.length ? e[e.length - 1] : null;
}

/** The number of this cast of hers: call it once in the effect's `cast`, and give it to `layEmber` or `burnOut` when the spell lands. */
export function castNo(fig: object): number {
  return ++book(fig).casts;
}

/**
 * Lays an ember for `fig` now. Call it at the moment a spell lands, on both screens, with the number its cast took (`castNo`):
 * the embers stay in the order of their casts, so the nest is the ember of her latest cast on both screens whichever landed
 * first, and past 3 the ember of the oldest cast goes. Without a number (the tool, a test) it counts as a cast of its own.
 * A quill gives its flight, so that its true end can be told from the screen that decides its hit (`'lay'`).
 */
export function layEmber(fig: object, x: number, z: number, seq = castNo(fig), quill?: QuillAim): Ember {
  const b = book(fig);
  const e: Ember = { id: seq % 20, x, z, born: emberNow(fig), seq };
  if (quill) {
    e.aim = { fx: quill.fx, fz: quill.fz, dx: quill.dx, dz: quill.dz };
    // The true end came first (the quill flew on here, and hit early on the screen that decides).
    const told = b.told.get(e.id);
    if (told && e.born - told.at < 2) placeAlong(e, told.k);
    b.told.delete(e.id);
  }
  // A fan cast after this ember's cast has already flared (or she has risen since): it burns as it lands, on both screens.
  if (seq < b.burnt) {
    b.puffs.push({ x, z, born: e.born, burnt: true });
    return e;
  }
  let i = b.embers.length;
  while (i > 0 && b.embers[i - 1].seq > seq) i--;
  b.embers.splice(i, 0, e);
  while (b.embers.length > MAX_EMBERS) b.embers.shift();
  return e;
}

function remove(fig: object, id: number, puff: 'stamp' | 'burn' | null): boolean {
  const b = books.get(fig);
  const i = b ? b.embers.findIndex((e) => e.id === id) : -1;
  if (!b || i < 0) return false;
  const [e] = b.embers.splice(i, 1);
  if (puff) b.puffs.push({ x: e.x, z: e.z, born: emberNow(fig), burnt: puff === 'burn' });
  return true;
}

/** An ember used up by a spell (Ember Flight lands on it): it burns out. Both screens. */
export function spendEmber(fig: object, id: number): boolean {
  return remove(fig, id, 'burn');
}

/**
 * Every ember burns out, or, with the number of a cast (Fan the Flames; her rising gives the next number), every ember of an
 * EARLIER cast, whenever it lands: a quill thrown after the fan may land before the flare on one screen and after it on the
 * other and is left on both; an ember of an earlier cast that lands after the flare burns on both. Both screens.
 */
export function burnOut(fig: object, before = Infinity) {
  if (before !== Infinity) {
    const b = book(fig);
    b.burnt = Math.max(b.burnt, before);
  }
  for (const e of embersOf(fig).slice()) if (e.seq < before) remove(fig, e.id, 'burn');
}

/** An ember stamped out by the enemy. */
export function stampEmber(fig: object, id: number): boolean {
  return remove(fig, id, 'stamp');
}

/** The ember Ember Flight takes for an aim at (x, z): the CPU's own pick if it just made one, else the nearest to the aim. */
export function flightEmber(fig: object, x: number, z: number): Ember | null {
  const b = books.get(fig);
  if (!b || !b.embers.length) return null;
  if (b.cpuPick && performance.now() - b.cpuPick.at < 400) {
    const e = b.embers.find((k) => k.id === b.cpuPick!.id);
    b.cpuPick = null;
    if (e) return e;
  }
  let best: Ember | null = null, bd = Infinity;
  for (const e of b.embers) {
    const d = Math.hypot(e.x - x, e.z - z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/** She turns to ash: the egg appears at the nest. Both screens. */
function startAsh(fig: object, nest: { x: number; z: number }, fromX: number, fromZ: number) {
  book(fig).ash = { x: nest.x, z: nest.z, fromX, fromZ, at: emberNow(fig) };
}

/** She rises: the egg is gone and every ember with it. Both screens. */
function endAsh(fig: object) {
  const b = books.get(fig);
  if (!b) return;
  b.ash = null;
  // Every ember of every cast so far (she cannot cast as ash, so both screens have counted the same).
  burnOut(fig, b.casts + 1);
}

function prune(fig: object, now: number) {
  const b = books.get(fig);
  if (!b) return;
  for (const e of b.embers.filter((x) => now - x.born >= EMBER_LIFE)) remove(fig, e.id, null);
  b.puffs = b.puffs.filter((p) => now - p.born < PUFF_LIFE);
}

const inAsh = (t: TraitView) => t.time < (t.mem.ashUntil ?? 0);
const spot = new THREE.Vector3();

export const phoenixTrait: Trait = {
  meter: { name: 'EMBERS', max: MAX_EMBERS, color: PHOENIX_CSS.body, value: (t) => embersOf(t.self()).length },
  passive: {
    name: 'Ashborn',
    // "A hit", not "a hero's hit": a boss's ordinary hit starts it too (gate 5).
    blurb: 'Her feathers stay on the floor as embers: 3 at most, 12 s each. The newest is her nest and wears a crown of flame. Once a round, a hit that would fell her while a nest burns turns her to ash instead: 1.2 s later she rises at the nest with 25% HP in a flare (2.2 m: 40 and a push), and every ember goes out. Stand within 1 m of an ember for 1 s to stamp it out; a new one is too hot for its first second. The arena\'s own fire kills her for good.',
  },
  twist: {
    name: 'Three things at once',
    blurb: 'An ember is a blast (Fan the Flames), a place to fly to (Ember Flight) and her life. Spend it on one and the other two are gone. A quill that hits you leaves her nest at your feet.',
  },
  speed: 4.2,
  attack: { kind: 'ranged', range: 6.5, damage: 12, interval: 1.0, windup: 0.25, speed: 20, look: 'dart' },
  ownLook: { life: { color: PHOENIX_CSS.hot, shape: 'gem' } },
  canCast(t, slot) {
    if (inAsh(t)) return 'In ashes';
    if (slot === 2 && embersOf(t.self()).length === 0) return 'No ember burns';
    return null;
  },
  /**
   * The CPU as Anka. Fan the Flames only with the enemy inside a ring, and not with her last ember when she is low and still has
   * her second life. Ember Flight to get away (the enemy within 3.5 m, an ember more than 6 m from it) or to strike (an ember
   * within the landing's reach of the enemy, and she above half HP): it tells the spell which ember (`cpuPick`). Firebird within
   * 10 m.
   */
  aiHold(t, slot, dist) {
    const fig = t.self(), en = t.enemy(), embers = embersOf(fig);
    if (inAsh(t)) return true;
    if (slot === 1) {
      if (!en || !embers.length) return true;
      const p = en.group.position;
      if (!embers.some((e) => Math.hypot(e.x - p.x, e.z - p.z) <= FLARE_RADIUS - 0.4)) return true;
      return embers.length === 1 && !t.mem.reborn && t.hp() < t.maxHp() * 0.4;
    }
    if (slot === 2) {
      if (!en || !embers.length) return true;
      const p = en.group.position, me = fig.group.position, low = t.hp() < t.maxHp() * 0.5;
      let pick: Ember | null = null;
      if (dist < 3.5) {
        let far = 6;
        for (const e of embers) {
          const d = Math.hypot(e.x - p.x, e.z - p.z);
          if (d > far && Math.hypot(e.x - me.x, e.z - me.z) <= FLIGHT_RANGE) { far = d; pick = e; }
        }
      }
      if (!pick && !low) pick = embers.find((e) => Math.hypot(e.x - p.x, e.z - p.z) <= FLIGHT_RADIUS - 0.3 && Math.hypot(e.x - me.x, e.z - me.z) <= FLIGHT_RANGE && Math.hypot(e.x - me.x, e.z - me.z) > 2.5) ?? null;
      if (!pick) return true;
      book(fig).cpuPick = { id: pick.id, at: performance.now() };
      return false;
    }
    if (slot === 3) return dist > BIRD_LENGTH - 2;
    return false;
  },
  /** The CPU against Anka stamps: the nest when she is low and it lies within 6 m, else the nearest ember within 3 m. */
  enemyGoal(t) {
    const foe = t.enemy(), fig = t.self();
    if (!foe || inAsh(t)) return null;
    const p = foe.group.position, nest = nestOf(fig);
    if (nest && !t.mem.reborn && t.hp() < t.maxHp() * 0.35 && Math.hypot(nest.x - p.x, nest.z - p.z) <= 6) return { x: nest.x, z: nest.z };
    let best: Ember | null = null, bd = NEAR_EMBER_R;
    for (const e of embersOf(fig)) {
      const d = Math.hypot(p.x - e.x, p.z - e.z);
      if (d <= bd) { bd = d; best = e; }
    }
    return best ? { x: best.x, z: best.z } : null;
  },
  /** Her own client. In ashes nothing reaches her. A hit that would fell her while a nest burns starts the second life. */
  taken(t, hit) {
    if (hit.blocked) return;
    if (inAsh(t)) { hit.blocked = true; return; }
    if (hit.damage <= 0 || t.mem.reborn) return;
    const fig = t.self(), nest = nestOf(fig), hp = t.hp();
    // hp <= 0: the arena already felled her this frame (its damage passes no trait); a hero's hit after it starts nothing.
    // The duel takes a hit's damage rounded (55.6 costs 56): judged on the unrounded number alone, a hit of 55.6 on 56 HP started
    // nothing and then felled her, a nest burning (gate 5). Whichever of the two would fell her counts.
    if (!nest || hp <= 0 || Math.max(hit.damage, Math.round(hit.damage)) < hp + t.shieldAmount() - 1e-6) return;
    // Swallowed whole (its status, push and pull with it); she pays down to 1 HP herself and climbs from there.
    hit.blocked = true;
    t.payHp(hp - 1);
    t.mem.reborn = 1;
    t.mem.ashUntil = t.time + ASH_SECONDS;
    t.mem.ash = 1;
    t.mem.healed = 0;
    const p = fig.group.position;
    startAsh(fig, nest, p.x, p.z);
    t.show('ash', nest.id + 1);
    t.show('life', 0);
    t.hold(ASH_SECONDS);
    t.moveTo(spot.set(nest.x, 0, nest.z), ASH_SECONDS * 0.75);
    t.say('TO ASH', PHOENIX_CSS.ash);
  },
  /** The other screen of a network duel: the egg appears, and goes. */
  ownChanged(t, name, n) {
    if (name !== 'ash') return;
    const fig = t.self();
    if (n > 0) {
      const e = embersOf(fig).find((k) => k.id === n - 1) ?? nestOf(fig);
      const p = fig.group.position;
      t.mem.ashUntil = t.time + ASH_SECONDS;
      t.mem.flared = 0;
      startAsh(fig, e ?? { x: p.x, z: p.z }, p.x, p.z);
    } else endAsh(fig);
  },
  /** Her own client: her HP climbs while she is ash, and she rises. */
  tick(t, dt) {
    const fig = t.self();
    syncClock(fig, t.time);
    prune(fig, t.time);
    if (!t.mem.ash) {
      t.show('life', t.mem.reborn ? 0 : 1);
      return;
    }
    const total = Math.max(0, t.maxHp() * RISE_SHARE - 1);
    const want = total * Math.min(1, 1 - ((t.mem.ashUntil ?? 0) - t.time) / ASH_SECONDS);
    const step = want - (t.mem.healed ?? 0);
    if (step >= 1 || (step > 0 && !inAsh(t))) {
      t.heal(step);
      t.mem.healed = (t.mem.healed ?? 0) + step;
    }
    if (inAsh(t)) return;
    t.mem.ash = 0;
    t.show('ash', 0);
    endAsh(fig);
    t.say('ASHBORN', PHOENIX_CSS.hot);
  },
  /** The screen that decides the enemy's hits: stamping, and the flare of her rising. */
  victimTick(t, dt) {
    const foe = t.enemy(), fig = t.self(), b = books.get(fig);
    if (!foe || !b) return;
    const p = foe.group.position;
    const until = t.mem.ashUntil ?? 0;
    if (until > 0 && !t.mem.flared && t.time >= until) {
      t.mem.flared = 1;
      const egg = b.ash ?? nestOf(fig) ?? fig.group.position;
      const ex = egg.x, ez = egg.z;
      if (Math.hypot(p.x - ex, p.z - ez) <= RISE_RADIUS) t.hitEnemy({ damage: RISE_DAMAGE, knock: RISE_KNOCK, from: new THREE.Vector3(ex, 0, ez), color: PHOENIX_CSS.body });
    }
    // This screen decides the quill's hit: her client is told how far along its aim it really got.
    for (const e of b.embers) {
      if (e.sent || !e.aim) continue;
      e.sent = true;
      const along = (e.x - e.aim.fx) * e.aim.dx + (e.z - e.aim.fz) * e.aim.dz;
      t.noteOwner('lay', e.id * 50 + Math.max(0, Math.min(40, Math.round(along / LAY_STEP))));
    }
    // The egg cannot be stamped: her embers are the egg's while she is ash.
    if (t.time < until) return;
    for (const e of b.embers.slice()) {
      // A new ember is too hot: a quill that hit leaves one under the enemy, and Fan the Flames (0.8 s) must have its chance.
      if (t.time - e.born < EMBER_FRESH || Math.hypot(p.x - e.x, p.z - e.z) > STAMP_R) continue;
      const s = (stomps.get(e) ?? 0) + dt;
      if (s >= STAMP_S) {
        stampEmber(fig, e.id);
        t.noteOwner('stamp', e.id);
      } else stomps.set(e, s);
    }
  },
  peerNote(t, name, n) {
    if (name === 'stamp') stampEmber(t.self(), n);
    if (name === 'lay') {
      // Where a quill really ended, from the screen that decides its hit.
      const fig = t.self(), b = book(fig), id = Math.floor(n / 50), k = n % 50;
      const e = b.embers.find((x) => x.id === id && x.aim);
      if (e) placeAlong(e, k);
      else if (!b.embers.some((x) => x.id === id)) b.told.set(id, { k, at: emberNow(fig) });
    }
  },
  figureHidden: (t) => t.own('ash') > 0,
  markLook: {
    ember: () => emberLook(STAMP_R),
    nest: () => nestLook(STAMP_R),
    egg: () => eggLook(RISE_RADIUS),
    ashes: ashesLook,
    stamp: () => emberPuffLook(false),
    burn: () => emberPuffLook(true),
  },
  marks(t) {
    const fig = t.self();
    syncClock(fig, t.time);
    prune(fig, t.time);
    const b = books.get(fig);
    if (!b) return [];
    const out: GroundMark[] = [];
    const last = b.embers.length - 1;
    // While she is ash the nest is the egg.
    b.embers.forEach((e, i) => {
      if (b.ash && i === last) return;
      out.push({ x: e.x, z: e.z, kind: i === last ? 'nest' : 'ember', age: t.time - e.born, life: EMBER_LIFE });
    });
    for (const p of b.puffs) out.push({ x: p.x, z: p.z, kind: p.burnt ? 'burn' : 'stamp', age: t.time - p.born, life: PUFF_LIFE });
    if (b.ash) {
      const age = t.time - b.ash.at;
      // a life longer than the egg's, so it does not shrink before she rises
      out.push({ x: b.ash.x, z: b.ash.z, kind: 'egg', age, life: ASH_SECONDS + 1.2 });
      out.push({ x: b.ash.fromX, z: b.ash.fromZ, kind: 'ashes', age, life: ASH_SECONDS + 0.4 });
    }
    return out;
  },
  badge(t) {
    const n = embersOf(t.self()).length;
    return n > 0 ? String(n) : '';
  },
};

addGroundWiper((owner, x, z, r) => {
  const b = books.get(owner);
  if (b) b.embers = b.embers.filter((e) => Math.hypot(e.x - x, e.z - z) > r);
});
