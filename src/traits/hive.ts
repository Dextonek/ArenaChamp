import { HIVE_CSS, waspMark } from '../effects/parts/hive';
import type { GroundMark, Trait, TraitView } from './types';

/** The swarm: most wasps he holds, one more every `WASP_EVERY` seconds, and one per basic attack that lands. */
export const MAX_WASPS = 6;
export const WASP_EVERY = 2;
/** Barbed Stinger: seconds the barb stays, the recast window (the leap), and the leap's reach (m). */
export const BARB_SECONDS = 3;
export const LEAP_WINDOW = 3;
export const LEAP_RANGE = 8;
/** The hit options' `knock` that marks the stinger itself (a leap and a poison tick carry another), so `dealt` barbs only on it. */
export const STINGER_KNOCK = 1.25;
/** Hive Shell: seconds it runs and what each wasp it spends deals to the attacker. */
export const SHELL_SECONDS = 3;
export const SHELL_STING = 15;
/** Swarm Cloud: seconds it stays. */
export const CLOUD_SECONDS = 3;

/**
 * What the spell effects read, keyed by the caster's figure and written on both screens (`afterCast` / `recastAct` /
 * `peerNote` on his own client, `ownChanged` on the other one, from a `show` made just before the cast).
 */
/** When (performance.now ms) the last stinger barbed the enemy. */
export const barbedAt = new WeakMap<object, number>();
/** The leap he just cast also poisons (he spent 2 wasps). */
export const leapPoison = new WeakMap<object, boolean>();
/** The wasps the Swarm Cloud took, and the wasps the Swarm Surge was loosed with. */
export const cloudWasps = new WeakMap<object, number>();
export const surgeWasps = new WeakMap<object, number>();
/** Hive Shell stings sent so far this round (rises with each one). */
export const shellStings = new WeakMap<object, number>();

const wasps = (t: TraitView) => t.mem.wasps ?? 0;

/** The one place the count changes: keeps `mem.wasps` and the shown count (both screens' wasps) the same. */
function setWasps(t: TraitView, n: number) {
  t.mem.wasps = Math.max(0, Math.min(MAX_WASPS, Math.round(n)));
  t.show('wasps', t.mem.wasps);
}

function gain(t: TraitView, n = 1) {
  setWasps(t, wasps(t) + n);
}

/** Spends up to `n` wasps; returns how many went. */
function spend(t: TraitView, n: number) {
  const k = Math.min(n, wasps(t));
  setWasps(t, wasps(t) - k);
  return k;
}

/**
 * Shows a value the other screen's effect needs: `rising * 10 + n` (n 0..9), so each cast is a change that is always sent
 * and the other side reads n back as `v % 10`.
 */
function announce(t: TraitView, name: string, n: number) {
  const key = `seq_${name}`;
  t.mem[key] = (t.mem[key] ?? 0) + 1;
  t.show(name, t.mem[key] * 10 + n);
}

/**
 * Sirix (bruiser, melee). Passive The Swarm: up to 6 wasps circle him, one per pip, drawn as a real swarm on both screens
 * (`marks`: one wasp mark per count, placed from his position and the round clock, so they need nothing but the shown
 * count). He starts a round with none, gains one every 2 s (`tick`, his own client) and one per basic attack that lands
 * (`landed`). Every change goes through `setWasps`, which also `show`s it, so the other screen's swarm follows.
 * Barbed Stinger (Q, 42) barbs the enemy for 3 s (`dealt`, on the screen that decides the hit; `noteOwner` / `peerNote`
 * bring it home, and `show('barbed')` carries it to the other screen's effect). Recast within 3 s (`recastAct`, free): the
 * effect leaps him onto the barbed enemy within 8 m for 25; if he has 2 wasps they are spent here and the leap also
 * poisons (30 over 3 s, the effect deals the ticks): `leapPoison`, mirrored as 'leap'.
 * Hive Shell (W): the kit's armor +40% for 3 s. While it runs each hit he takes (not a passive's) spends a wasp, if he has
 * one, and stings the attacker for 15: `taken` counts it (`shellStings`, `show('sting')`) and calls `hitEnemy` (offline it
 * hits the attacker; online on his own client it does nothing), and on the attacker's screen `ownChanged('sting')` calls
 * `hitEnemy`, where that hero's hit is decided.
 * Swarm Cloud (E): every wasp goes to the cloud at the cast (`cloudWasps`, 'cloud'), and while it stands the 2 s clock is
 * stopped. When it ends (3 s) they come back, up to 6 (`tick`). Swarm Surge (R) spends every wasp at the cast
 * (`surgeWasps`, 'surge') and nothing refills them: his opening.
 * The CPU holds R under 4 wasps, E under 3, and the recast until the enemy is barbed and within 8 m.
 */
export const hiveTrait: Trait = {
  meter: { name: 'WASPS', max: MAX_WASPS, value: (t) => wasps(t) },
  passive: { name: 'The Swarm', blurb: 'Up to 6 wasps circle him (one more every 2 s and one per basic attack that lands). His spells spend them.' },
  twist: { name: 'Spend or hold', blurb: 'Spend 2 wasps on the leap\'s poison, burn them in the cloud, or hold six for the surge. After the surge he is a plain fighter.' },
  speed: 4,
  attack: { kind: 'melee', range: 2.4, damage: 13, interval: 1.2, windup: 0.3, speed: 0, look: 'claw' },
  recast: { slot: 0, window: LEAP_WINDOW, arm: 0.2, name: 'Leap', power: 1, replay: true },
  ownLook: {
    wasps: { color: HIVE_CSS.body, shape: 'drop' },
    shell: { color: HIVE_CSS.wax, shape: 'gem' },
  },
  markLook: { wasp: waspMark },
  // Both screens, every frame: one wasp per shown count, circling him at chest height (the builder lifts them).
  marks(t) {
    const n = t.own('wasps');
    if (n <= 0) return [];
    const p = t.self().group.position;
    const out: GroundMark[] = [];
    for (let i = 0; i < n; i++) {
      const a = t.time * 2.6 + (i * Math.PI * 2) / MAX_WASPS;
      const r = 1.15 + 0.12 * Math.sin(t.time * 3 + i * 1.7);
      out.push({ x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r, kind: 'wasp', age: 1, life: 1000, yaw: Math.atan2(-Math.sin(a), Math.cos(a)) });
    }
    return out;
  },
  aiHold(t, slot, dist) {
    if (slot === 3) return wasps(t) < 4;
    if (slot === 2) return wasps(t) < 3;
    // While the leap is open the CPU takes it only on a barbed enemy it can reach.
    if (slot === 0 && t.mem.qAt !== undefined && t.time - t.mem.qAt < LEAP_WINDOW) return !(t.time < (t.mem.barbUntil ?? 0) && dist <= LEAP_RANGE - 0.5);
    return false;
  },
  afterCast(t, slot) {
    const fig = t.self();
    if (slot === 0) t.mem.qAt = t.time;
    if (slot === 1) {
      t.mem.shellUntil = t.time + SHELL_SECONDS;
      t.show('shell', 1);
    }
    if (slot === 2) {
      // Every wasp goes to the cloud; they come back when it ends.
      const n = spend(t, MAX_WASPS);
      t.mem.cloudTook = n;
      t.mem.cloudUntil = t.time + CLOUD_SECONDS;
      cloudWasps.set(fig, n);
      announce(t, 'cloud', n);
    }
    if (slot === 3) {
      // Every wasp is loosed down the column and none comes back.
      const n = spend(t, MAX_WASPS);
      surgeWasps.set(fig, n);
      announce(t, 'surge', n);
    }
  },
  recastAct(t, slot) {
    if (slot !== 0) return;
    // The leap needs a barbed enemy in reach: otherwise the effect does nothing and no wasp is spent.
    const ok = t.time < (t.mem.barbUntil ?? 0) && t.enemyDistance() <= LEAP_RANGE + 0.3;
    const poison = ok && wasps(t) >= 2;
    if (poison) spend(t, 2);
    leapPoison.set(t.self(), poison);
    announce(t, 'leap', poison ? 1 : 0);
  },
  landed(t, hit) {
    if (hit.kind === 'attack') gain(t);
  },
  // Where the hit is decided: the barb goes on the enemy, and his own client is told (the leap reads it).
  dealt(t, hit) {
    if (hit.kind !== 'spell' || hit.slot !== 0 || !hit.victimIsHero || !hit.opts.projectile || hit.opts.knock !== STINGER_KNOCK) return;
    t.addStacks('barb', 1, BARB_SECONDS, 1);
    t.noteOwner('barbed', 1);
  },
  // His own client: the shell trades a wasp for a sting at the attacker.
  taken(t, hit) {
    if (hit.blocked || hit.kind === 'trait') return;
    if (t.time >= (t.mem.shellUntil ?? 0) || wasps(t) < 1) return;
    spend(t, 1);
    const n = (t.mem.sting = (t.mem.sting ?? 0) + 1);
    shellStings.set(t.self(), n);
    t.show('sting', n);
    t.hitEnemy({ damage: SHELL_STING, knock: 0, color: HIVE_CSS.body });
  },
  peerNote(t, name) {
    if (name !== 'barbed') return;
    t.mem.barbUntil = t.time + BARB_SECONDS;
    barbedAt.set(t.self(), performance.now());
    announce(t, 'barbed', 0);
  },
  ownChanged(t, name, n) {
    // The other screen: the effects there read these, and the hero decided here takes the shell's stings.
    const fig = t.self();
    if (name === 'barbed' && n > 0) barbedAt.set(fig, performance.now());
    else if (name === 'leap' && n > 0) leapPoison.set(fig, n % 10 === 1);
    else if (name === 'cloud' && n > 0) cloudWasps.set(fig, n % 10);
    else if (name === 'surge' && n > 0) surgeWasps.set(fig, n % 10);
    else if (name === 'sting') {
      let seen = t.mem.stingSeen ?? 0;
      if (n < seen) seen = 0;
      shellStings.set(fig, n);
      for (let k = seen; k < n; k++) t.hitEnemy({ damage: SHELL_STING, knock: 0, color: HIVE_CSS.body });
      t.mem.stingSeen = n;
    }
  },
  tick(t) {
    if (t.mem.shellUntil && t.time >= t.mem.shellUntil) {
      t.mem.shellUntil = 0;
      t.show('shell', 0);
    }
    if (t.time < (t.mem.cloudUntil ?? 0)) {
      // His wasps are in the cloud: no gain from the clock.
      t.mem.nextWasp = t.mem.cloudUntil + WASP_EVERY;
    } else if (t.mem.cloudUntil) {
      t.mem.cloudUntil = 0;
      setWasps(t, wasps(t) + (t.mem.cloudTook ?? 0));
      t.mem.cloudTook = 0;
    } else if (wasps(t) >= MAX_WASPS) {
      t.mem.nextWasp = t.time + WASP_EVERY;
    } else if (t.time >= (t.mem.nextWasp ?? WASP_EVERY)) {
      gain(t);
      t.mem.nextWasp = t.time + WASP_EVERY;
    }
    t.show('wasps', wasps(t));
  },
  badge(t) {
    const n = wasps(t);
    return n ? `${n}` : '';
  },
};
