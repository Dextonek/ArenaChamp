import * as THREE from 'three';
import { RAID_PARTY_MAX, RAID_TWIN } from '../../server/protocol.mjs';
import { RING, seeded } from '../arenas/common';
import {
  FORGE, TWIN_BRIDGES, TWIN_CHANNELS, TWIN_LAYOUT, bridgesCrossed, floodInset, forge, forgeBounds, forgeCover, forgeGates, forgeSafe, inForge, lavaAt,
} from '../arenas/twinpit';
import { FallingStone, FollowMark, HoldRing, LightPillar, SunOrb } from './fx';
import { STAND_COLOR } from './script';
import type { BossCast, BossMove, Objective, PlayContext, PlayedMove, RaidSide, RoomFloor, Threat } from './types';

/**
 * Twin Flames' fight for a party, beyond the two's own moves (user, 2026-11-12; pipeline/designs/raid-party.md): the Twin Forge
 * transforms twice, and three mechanics come only for big parties.
 *
 * - **The floor cracks into islands** (`crack`, as each twin's second phase begins, in its own half): lava channels open, and bridges
 *   of cooled crust stand over them in turn.
 * - **The pit floods** (`flood`, when the first of the two reaches its last phase): the wall of fire goes out for good, and lava rises
 *   from the walls inward to one last island.
 * - **Lantern Chain** (`chain`, a fight tuned for 10 or more): pairs of heroes are chained; over 8 m apart it snaps and burns both.
 * - **Seal the Vents** (`vents`, 20 or more): a vent for every five heroes, each to be held by one; what is left open speeds the flood.
 * - **The Changing of the Flames** (`change`, 40): gates open in the wall of fire, and the marked half of each team crosses to the
 *   other boss.
 *
 * The raid's rules hold (./types.ts), and the Warden's hall's lessons (./wardenHall.ts). What a move needs to know of the heroes the
 * brain works out in `aim` and puts in the cast: a hero in `target`, a second in `mate`, a count in `x`. What the whole party must
 * agree on comes back from the hub as an objective taken (`done`): a chain that snapped, a vent sealed, who is marked, who crossed.
 * The room's own state (`forge`, src/arenas/twinpit.ts) is changed only by a cast, at a time counted from it, and a second cast of
 * the same thing (the other twin's, a brain that took over) does nothing. The lava itself is the room's, not a script's
 * (`forgeFloor`, `BossDef.floor`): it goes on burning when the twin that cracked the floor has fallen.
 */
const C = { x: RING.x, z: RING.z };
const LAVA = 0xe0601a;
const ROCK = 0x8a6a50;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Where a hero stands and whether it is down, as a look may read it (`PlayContext.heroAt`). */
const heroOf = (p: PlayContext, side: RaidSide) => p.heroAt(side) as { x: number; z: number; down?: boolean } | null;

/** The forge's floor that hurts, for the duel (`BossDef.floor`): nothing while it is whole and dry. */
const FLOOR: RoomFloor = {
  get cover() { return forgeCover(); },
  get bounds() { return forgeBounds() || undefined; },
  safe: (x, z) => forgeSafe(x, z),
  burn: (x, z) => lavaAt(x, z),
};
export const forgeFloor = (): RoomFloor | null => (forge.cracked[0] >= 0 || forge.cracked[1] >= 0 || forge.floodAt >= 0 ? FLOOR : null);

/** What the brains keep between a move's steps, by the cast's seed: the pairs a Lantern Chain made. */
const pairs = new Map<number, [RaidSide, RaidSide][]>();

/** A new fight: the forge is whole and dry, and nobody is chained. */
export function resetForge() {
  forge.reset();
  forgeGates(false);
  pairs.clear();
  changing = -Infinity;
}

// --- the floor cracks into islands ------------------------------------------------------------------------------------------

/** What the lava costs whoever stands on a channel as it opens, of max HP. After that the room burns by the second (`FORGE.burn`). */
export const CRACK = { share: 0.14 };

/**
 * The floor cracks into islands (user, 2026-11-12): as a twin's second phase begins, lava channels crack open across its half. A
 * line glows along each for `FORGE.warn` seconds, then the crust gives. From then on the half is five islands; bridges of cooled
 * crust join them and stand in turn, by this cast's seed, each glowing before it sinks. Ash's Charge shatters a bridge it crosses.
 * It comes as soon as the phase lets him act (`due`), beside his other moves.
 */
export const crack: BossMove = {
  id: 'crack', name: 'The Floor Cracks', charge: FORGE.warn, lock: 0, cooldown: 99999, due: 0, alongside: true, big: true, pose: 'slam',
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: 0 }),
  play(c, p) {
    const half = c.which === 1 ? 1 : 0, at = p.shown(FORGE.warn);
    if (!forge.crack(half, c.seed, at)) return { threats: [], duration: 0.05 };
    const mine = TWIN_CHANNELS.filter((ch) => ch.half === half);
    const threats = mine.map((ch): Threat => ({
      shape: { kind: 'line', x1: ch.ax, z1: ch.az, x2: ch.ax + ch.ux * ch.length, z2: ch.az + ch.uz * ch.length, width: ch.r * 2 }, at, share: CRACK.share, look: 3,
    }));
    p.hint('The floor cracks into islands: cross by the bridges, and mind the ones that glow');
    p.say('THE FLOOR CRACKS', '#ff9a6a', TWIN_LAYOUT.hold[half].x, TWIN_LAYOUT.hold[half].z);
    p.shake(0.1);
    let opened = false;
    return {
      threats, duration: at + 1.5,
      look: {
        update(t, dt) {
          // Grit and embers thrown up along the cracks, more as they are about to give.
          const k = Math.min(1, t / at);
          if (t < at && Math.random() < dt * (10 + 50 * k * k)) {
            const ch = mine[Math.floor(Math.random() * mine.length)], along = Math.random() * ch.length;
            p.sparks.emit(ch.ax + ch.ux * along, 0.2, ch.az + ch.uz * along, 5, 2.5, 2.5, 0.7, Math.random() < 0.5 ? ROCK : LAVA, 6);
          }
          if (opened || t < at) return;
          opened = true;
          p.shake(0.16);
          p.flash('rgba(255,120,50,0.6)', 0.25);
          for (const ch of mine) {
            for (let along = 1; along < ch.length; along += 3.2) {
              const x = ch.ax + ch.ux * along, z = ch.az + ch.uz * along;
              p.show.column(x, z, { radius: 0.7, height: 4 + Math.random() * 3, life: 0.8, color: 0xff6a20, peak: 0.6, delay: along * 0.012 });
              p.sparks.emit(x, 0.3, z, 8, 4, 4, 0.8, LAVA);
            }
          }
        },
      },
    };
  },
};

/** Ash's Charge ran from a to b: every bridge it crossed is shattered, on every screen from the same cast. */
export function shatterBridges(p: PlayContext, ax: number, az: number, bx: number, bz: number, width: number) {
  for (const i of bridgesCrossed(ax, az, bx, bz, width)) {
    const b = TWIN_BRIDGES[i];
    forge.shatter(i);
    p.show.shards(b.x, 0.5, b.z, { count: 18, color: '#3a3c48', speed: 7, life: 1.1, size: 0.26, up: 1 });
    p.show.burst(b.x, 0.4, b.z, 30, 6, 4, 0.8, LAVA);
    p.say('SHATTERED', '#ff9a6a', b.x, b.z);
  }
}

// --- the pit floods ----------------------------------------------------------------------------------------------------------

/**
 * The pit floods (user, 2026-11-12): when the first of the two reaches its last phase the wall of fire goes out for good and lava
 * rises from the walls inward, to one last island in the middle where both of them and both teams end up. Each screen's enemy stays
 * its own half's twin until that one falls; from now on the other's moves hurt it too (`TwinDef.open`). The second twin's own cast
 * of this, when it gets there, does nothing. Sealing a vent draws the lava back (`forge.hold`).
 */
export const flood: BossMove = {
  id: RAID_TWIN.flood, name: 'The Pit Floods', charge: FORGE.floodWarn, lock: 0, cooldown: 99999, due: 0, alongside: true, big: true, pose: 'raise',
  aim: () => ({ x: C.x, z: C.z, dir: 0 }),
  play(_c, p) {
    const warn = p.shown(FORGE.floodWarn);
    if (!forge.flood(warn)) return { threats: [], duration: 0.05 };
    // The wall of fire is the room's first piece of cover.
    p.breakCover(0, 0);
    p.hint('The pit floods: get to the island in the middle, and seal the vents to hold the lava back');
    p.say('THE PIT FLOODS', '#ff9a6a', C.x, C.z);
    p.shake(0.14);
    p.show.ring(C.x, C.z, { radius: 30, life: 1.6, color: 0xff7a30, width: 1.2, peak: 0.6 });
    const L = TWIN_LAYOUT;
    return {
      threats: [], duration: 1e6,
      look: {
        update(_t, dt) {
          // Tongues of flame along the lava's edge as it comes in.
          if (Math.random() > dt * 26) return;
          const inset = floodInset(), hx = L.hx - inset, hz = L.hn - inset, side = Math.floor(Math.random() * 4), k = Math.random() * 2 - 1;
          const x = C.x + (side < 2 ? k * hx : (side === 2 ? -1 : 1) * hx), z = C.z + (side < 2 ? (side === 0 ? -1 : 1) * hz : k * hz);
          if (inForge(x, z)) p.show.column(x, z, { radius: 0.2 + Math.random() * 0.3, height: 1.5 + Math.random() * 3, life: 0.9, color: 0xff7a30, peak: 0.55 });
        },
      },
    };
  },
};

// --- Lantern Chain (a party of 10 or more) ------------------------------------------------------------------------------------

/**
 * Lantern Chain.
 * - `per`: a pair for every this many heroes the twin sees standing, at most `most`.
 * - `first`, `every`: when it first comes and how often (s). `seconds`: how long a chain lasts.
 * - `grace`: the two have this long to come together before it can snap (s). `reach`: over this far apart it snaps (m), and burns
 *   both for `burn` of max HP.
 * - `rocks`: when Ash's rocks fall on a pair (s after the chain): one between the two and one past each of them, `rockR` wide,
 *   `rock` of max HP each. They cover the line through the pair: both must step off it to the same side.
 */
export const CHAIN = { per: 5, most: 4, first: 24, every: 36, seconds: 12, grace: 3, reach: 8, burn: 0.3, rocks: [3.5, 7, 10.5], rockR: 2.2, rock: 0.14, rockOut: 4.6 };
/** Its objectives: the chain snapped; and, on the two screens it holds, a way back to the other hero for an AI. */
const SNAP = 0, LEASH = 1;

/** A chain between two heroes: a strip of light from one to the other, hotter as it is pulled tight, a lantern over each. */
class ChainLine {
  readonly group = new THREE.Group();
  private mat = new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  private strip = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.26).rotateX(-Math.PI / 2), this.mat);
  private ends = [new SunOrb(0, 2.9, 0), new SunOrb(0, 2.9, 0)];

  constructor() {
    this.strip.renderOrder = 4;
    this.group.add(this.strip, this.ends[0].sprite, this.ends[1].sprite);
  }

  /** From a to b; `pull` 0 (slack) to 1 (about to snap); `on` its opacity. */
  set(a: { x: number; z: number }, b: { x: number; z: number }, pull: number, on: number, time: number) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 0.01;
    this.strip.position.set((a.x + b.x) / 2, 1.25, (a.z + b.z) / 2);
    this.strip.rotation.y = Math.atan2(-dz, dx);
    this.strip.scale.set(d, 1, 1 + pull);
    this.mat.color.setHex(pull > 0.75 ? 0xff5a26 : 0xffb050);
    this.mat.opacity = on * (0.55 + 0.3 * pull + (pull > 0.75 ? 0.15 * Math.sin(time * 22) : 0));
    [a, b].forEach((h, i) => {
      this.ends[i].sprite.position.set(h.x, 2.9, h.z);
      this.ends[i].set(1.1 + 0.5 * pull, 0.9 * on);
    });
  }

  dispose() {
    this.group.removeFromParent();
    this.strip.geometry.dispose();
    this.mat.dispose();
    for (const e of this.ends) e.dispose();
  }
}

/** The chain on a pair: it follows the two, snaps when one of their screens says they are too far apart, and burns both. */
function chainMark(c: BossCast, p: PlayContext): PlayedMove {
  const a = c.target, b = c.mate ?? c.target, T = p.shown(CHAIN.seconds), mine = p.side === a || p.side === b;
  const line = new ChainLine();
  p.group.add(line.group);
  const at = [{ x: c.x, z: c.z }, { x: c.x, z: c.z }];
  if (mine) {
    p.hint('You are chained: stay within 8 m of each other, and step off the rocks to the same side');
    p.flash('rgba(255,170,70,0.7)', 0.25);
  }
  p.say('CHAINED', '#ffb050', c.x, c.z);
  // The snap is an objective nobody takes by standing: the first of the two screens to see the chain too long reports it.
  const snap: Objective = { part: SNAP, x: c.x, z: c.z, radius: 0, kill: true, until: T };
  let far = false;
  // For an AI on one of the two screens: the other hero is a spot to walk toward while the chain is pulled long.
  const leash: Objective = { part: LEASH, x: c.x, z: c.z, radius: 0.01, hold: 1e9, until: T, can: () => far };
  const threats: Threat[] = [];
  let ended = false, time = 0;
  return {
    threats, objectives: mine ? [snap, leash] : [snap], duration: T + 1,
    look: {
      update(t) {
        time = t;
        const ha = heroOf(p, a), hb = heroOf(p, b);
        if (ha) at[0] = ha;
        if (hb) at[1] = hb;
        const d = Math.hypot(at[0].x - at[1].x, at[0].z - at[1].z), on = ended ? 0 : t < T ? 1 : Math.max(0, 1 - (t - T) * 3);
        line.set(at[0], at[1], clamp((d - 4) / (CHAIN.reach - 4), 0, 1), on, t);
        // One of the two is down or gone: the chain falls off.
        if (!ended && (!ha || !hb || ha.down || hb.down)) ended = true;
        if (ended || !mine) return;
        const other = p.side === a ? at[1] : at[0];
        leash.x = other.x;
        leash.z = other.z;
        far = t < T && d > CHAIN.reach - 2.6;
        if (t >= CHAIN.grace && t < T && d > CHAIN.reach && !snap.reported) {
          snap.reported = true;
          p.report(c.id, SNAP);
        }
      },
      done(o) {
        if (o.part !== SNAP || ended) return;
        ended = true;
        const mid = { x: (at[0].x + at[1].x) / 2, z: (at[0].z + at[1].z) / 2 };
        p.say('THE CHAIN SNAPS', '#ff7a4a', mid.x, mid.z);
        for (const h of at) {
          p.show.burst(h.x, 1.2, h.z, 30, 6, 3, 0.8, 0xff7a30, 5);
          p.show.ring(h.x, h.z, { radius: 3, life: 0.5, color: 0xff8a40, width: 0.5 });
        }
        // It burns the two it held, wherever they stand: each on its own screen.
        if (mine) {
          threats.push({ shape: { kind: 'circle', x: mid.x, z: mid.z, radius: 0.1 }, hits: () => true, at: time, share: CHAIN.burn, hidden: true });
          p.shake(0.1);
        }
      },
      dispose: () => line.dispose(),
    },
  };
}

/** Ash's rocks on a chained pair: one between the two and one past each, along the line through them. */
function chainRocks(c: BossCast, p: PlayContext): PlayedMove {
  const at = p.shown(1.7), dx = Math.sin(c.dir), dz = Math.cos(c.dir);
  const spots = [-1, 0, 1].map((k) => ({ x: c.x + dx * k * CHAIN.rockOut, z: c.z + dz * k * CHAIN.rockOut }));
  const stones = spots.map((s) => new FallingStone(s.x, s.z, CHAIN.rockR, at));
  p.group.add(...stones.map((s) => s.mesh));
  return {
    threats: spots.map((s) => ({ shape: { kind: 'circle', x: s.x, z: s.z, radius: CHAIN.rockR }, at, share: CHAIN.rock })), duration: at + 0.9,
    look: {
      update: (t) => { for (const s of stones) s.update(t); },
      land(th) {
        const s = th.shape;
        if (s.kind !== 'circle') return;
        p.sparks.emit(s.x, 0.2, s.z, 18, 4, 3, 0.7, ROCK);
        p.glows.flash(s.x, s.z, CHAIN.rockR, LAVA, 0.6, 0.35);
      },
      dispose: () => { for (const s of stones) s.mesh.removeFromParent(); },
    },
  };
}

/**
 * Lantern Chain (user, 2026-11-12, for a party of 10 or more): Ember's lanterns chain heroes in pairs, a pair for every five
 * standing. Over 8 m apart a chain snaps and burns both; Ash's rocks then fall between and past the two, so they must move as one.
 *
 * Each twin casts it on its own half (a brain sees only its own side of the wall of fire, so no pair is ever across it), and on
 * whoever stands once the wall is out. Its first steps chain a pair each: the brain draws a hero by the cast's seed and takes the
 * nearest other, and names the two in the cast's `target` and `mate`. Its later steps drop the rocks where the pair stands then. A
 * step with no pair is flagged, and plays nothing.
 */
export const chain: BossMove = {
  id: 'chain', name: 'Lantern Chain', minBand: 10, charge: CHAIN.grace, lock: 0, cooldown: CHAIN.every, due: CHAIN.first, alongside: true, pose: 'raise',
  steps: [...Array<number>(CHAIN.most).fill(0), ...CHAIN.rocks.flatMap((at) => Array<number>(CHAIN.most).fill(at))],
  aim(c) {
    const up = c.heroes ?? [], k = c.step % CHAIN.most, none = { x: c.boss.x, z: c.boss.z, dir: 0, flag: true };
    if (c.step === 0) {
      const rng = seeded(c.seed), pool = [...up].sort((x, y) => x.side - y.side), made: [RaidSide, RaidSide][] = [];
      const n = clamp(Math.floor(pool.length / CHAIN.per), 1, CHAIN.most);
      while (made.length < n && pool.length >= 2) {
        const first = pool.splice(Math.floor(rng() * pool.length), 1)[0];
        let near = 0;
        for (let i = 1; i < pool.length; i++) if (Math.hypot(pool[i].x - first.x, pool[i].z - first.z) < Math.hypot(pool[near].x - first.x, pool[near].z - first.z)) near = i;
        made.push([first.side, pool.splice(near, 1)[0].side]);
      }
      pairs.set(c.seed, made);
    }
    const pair = pairs.get(c.seed)?.[k], a = up.find((h) => h.side === pair?.[0]), b = up.find((h) => h.side === pair?.[1]);
    if (!pair || !a || !b) return none;
    return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, dir: Math.atan2(b.x - a.x, b.z - a.z), target: a.side, mate: b.side };
  },
  play(c, p) {
    if (c.flag || c.mate === undefined) return { threats: [], duration: 0.05 };
    return c.step < CHAIN.most ? chainMark(c, p) : chainRocks(c, p);
  },
};

// --- Seal the Vents (a party of 20 or more) -------------------------------------------------------------------------------------

/**
 * Seal the Vents.
 * - `per`: a vent for every this many heroes of a half, at most `most` a half.
 * - `hold`: how long a hero must stand on one (s). `open`: how long they stay open.
 * - `sealed`: each one sealed holds the flood back this long (s: the lava draws back). `left`: each one left open speeds it by
 *   this much (s: the lava comes on).
 */
export const VENTS = { per: 5, most: 4, hold: 4, open: 16, sealed: 12, left: 10, radius: 1.8 };

/** The vents of half `who` that will still be dry when the window ends, in the order the seed turns them. */
function ventSpots(who: number, n: number, seed: number) {
  const L = TWIN_LAYOUT, s = who ? 1 : -1, list = [...(who ? L.vents : L.slag).map(([x, z]) => ({ x, z })), { x: L.hold[who].x, z: L.hold[who].z }, { x: s * 5, z: C.z }];
  const turn = Math.floor(seeded(seed)() * 4);
  const dry = (v: { x: number; z: number }) => {
    // Clear of every channel, and of where the flood will be when the window ends.
    const inset = floodInset(forge.clock + VENTS.open) + 2.2;
    return Math.abs(v.x - C.x) < L.hx - inset && Math.abs(v.z - C.z) < L.hn - inset && forgeSafe(v.x, v.z, VENTS.radius);
  };
  const order = [...list.slice(0, 4).map((_, i) => list[(i + turn) % 4]), ...list.slice(4)].filter(dry);
  return order.slice(0, Math.max(1, n));
}

/**
 * Seal the Vents (user, 2026-11-12, for a party of 20 or more): in their last phase each twin opens a vent for every five heroes of
 * its half, at the same time, and each is sealed by a hero standing on it. Every one sealed draws the lava back; every one still
 * open when they close brings it on, for both halves. All of a cast's sealed, and that twin staggers. The count is the brain's, in
 * the cast's `x`. It takes the place of the one vent a smaller party seals (`sealw`, `seale`).
 */
export const vents = (id: string, who: number): BossMove => ({
  id, name: 'Seal the Vents', minBand: 20, charge: VENTS.open, lock: 0, cooldown: 0, alongside: true, pose: 'channel',
  // Once the wall is out a twin sees the whole party: half of it is its own to ask.
  aim: (c) => ({ x: clamp(Math.round((c.heroes?.length ?? 1) / (forge.open ? 2 : 1) / VENTS.per), 1, VENTS.most), z: 0, dir: 0 }),
  play(c, p) {
    const until = VENTS.open, spots = ventSpots(who, clamp(Math.round(c.x), 1, VENTS.most), c.seed);
    const marks = spots.map((s) => {
      const light = new LightPillar(s.x, s.z, VENTS.radius, 7, STAND_COLOR), ring = new HoldRing(s.x, s.z, VENTS.radius, STAND_COLOR);
      p.group.add(light.mesh, ring.mesh);
      return { light, ring };
    });
    const objectives = spots.map((s, part): Objective => ({ part, x: s.x, z: s.z, radius: VENTS.radius, hold: VENTS.hold, until }));
    p.hint('Seal the vents: one hero on each, or the lava comes faster');
    p.say('THE VENTS OPEN', '#ffe27a', TWIN_LAYOUT.hold[who].x, TWIN_LAYOUT.hold[who].z);
    let closed = false, sealed = 0;
    return {
      threats: [], objectives, duration: until + 1,
      look: {
        update(t) {
          marks.forEach((m, i) => {
            const o = objectives[i];
            m.light.opacity = o.done || t > until ? 0 : 0.45 + 0.15 * Math.sin(t * 4 + i);
            m.ring.set(o.done ? 0 : o.held ?? 0);
          });
          if (closed || t < until) return;
          // They close: every one still open brings the lava on.
          closed = true;
          const open = objectives.filter((o) => !o.done);
          if (!open.length) return;
          forge.hold(-VENTS.left * open.length);
          p.say(open.length > 1 ? `${open.length} VENTS LEFT OPEN: THE LAVA RISES` : 'A VENT LEFT OPEN: THE LAVA RISES', '#ff9a6a', C.x, C.z);
          for (const o of open) p.show.column(o.x, o.z, { radius: 1.2, height: 12, life: 1.2, color: 0xff6a20, peak: 0.7 });
          p.shake(0.08);
        },
        done(o) {
          sealed++;
          forge.hold(VENTS.sealed);
          p.show.triumph(o.x, o.z, 0xffd890, 1.1);
          p.say(`SEALED · ${sealed} OF ${spots.length}`, '#ffe27a', o.x, o.z);
          p.sparks.emit(o.x, 0.4, o.z, 40, 5, 5, 0.9, STAND_COLOR);
          if (sealed < spots.length) return;
          p.reward('vents', c.id);
          p.cancel(c.id);
        },
        dispose() {
          for (const m of marks) {
            m.light.dispose();
            m.ring.dispose();
          }
        },
      },
    };
  },
});

// --- The Changing of the Flames (a party of 40) ----------------------------------------------------------------------------------

/**
 * The Changing of the Flames.
 * - `first`, `every`: when it first comes and how often (s). `warn`: from his call until the gates open; `open`: how long they
 *   stand open. The hub marks who must cross as it hears the call, and deals the halves again when the gates shut
 *   (`RAID_TWIN.change`: the same two numbers, and the parts below).
 * - What it costs a marked hero the gates shut on is the fight's to take (`RAID_TWIN.change.late`): it is dragged through the fire
 *   to its new half.
 * - `wrong`: what a second in a gate costs a hero that is not marked.
 */
export const CHANGE = { first: 40, every: 60, warn: RAID_TWIN.change.warn, open: RAID_TWIN.change.open, wrong: 0.15, mouth: 1.7 };
const MARK = RAID_TWIN.change.mark, CROSS = RAID_TWIN.change.cross;
/** While the gates stand open he does only these: no Charge through a crowd at a gate. */
const CHANGE_ONLY = ['slam', 'quake', 'drag', 'rock'];

/** Until when a call is in the air (the room's clock): a second one meanwhile does nothing. */
let changing = -Infinity;

/**
 * The Changing of the Flames (user, 2026-11-12, for a party of 40): gates open in the wall of fire, and the marked half of each
 * team must cross to the other boss. The hub marks them (every second standing hero of each half, turning from call to call) and
 * every screen hears who (`done`, part `MARK + side`). A marked hero that steps into a gate is carried through: its screen says so
 * (part `CROSS + side`), the hub deals it into the other half, and its enemy changes. When the gates shut the hub deals the rest
 * of the marked across too: those are dragged through the fire, and burn. A hero that is not marked burns in a gate. Ash calls it,
 * for both halves; it never comes once the wall of fire is out.
 */
export const change: BossMove = {
  id: 'change', name: 'The Changing of the Flames', minBand: 40, charge: CHANGE.warn + CHANGE.open, lock: 2, cooldown: CHANGE.every, due: CHANGE.first, big: true, room: true, pose: 'raise',
  holds: { only: CHANGE_ONLY },
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: 0 }),
  play(c, p) {
    const L = TWIN_LAYOUT, warn = CHANGE.warn, end = warn + CHANGE.open, me = p.side;
    // The wall is out, or one is in the air already (a brain that took over calls it again): nothing.
    if (forge.open || forge.clock < changing) return { threats: [], duration: 0.05 };
    changing = forge.clock + end;
    const state = { marked: new Set<RaidSide>(), crossed: new Set<RaidSide>() };
    const lights = L.gates.map((z) => {
      const light = new LightPillar(C.x, z, L.gateHalf, 6, STAND_COLOR);
      p.group.add(light.mesh);
      return light;
    });
    const rings = new Map<RaidSide, FollowMark>();
    /** The mouth of the gate nearest this hero, on the side it stands on. */
    const mouth = () => {
      const h = heroOf(p, me) ?? { x: C.x, z: C.z }, s = h.x < C.x ? -1 : 1;
      const z = L.gates.reduce((a, b) => (Math.abs(b - h.z) < Math.abs(a - h.z) ? b : a));
      return { x: C.x + s * (L.wallHalf + 1.1), z };
    };
    const inGate = (x: number, z: number) => Math.abs(x - C.x) <= L.wallHalf + 2.4 && L.gates.some((gz) => Math.abs(z - gz) <= L.gateHalf);
    let time = 0;
    // A gate's own fire: it burns whoever stands in one unmarked. It counts from the start, so a stage can't call this move off.
    const wrong: Threat = { shape: { kind: 'circle', x: C.x, z: C.z, radius: 1 }, hits: (x, z, t) => t >= warn && t < end && !state.marked.has(me) && inGate(x, z), at: 0, to: end, every: 1, share: CHANGE.wrong, hidden: true, look: 1 };
    // A seat's own way through, and what the hub says of each seat: marked, crossed.
    const way: Objective[] = Array.from({ length: RAID_PARTY_MAX }, (_, side): Objective => ({
      part: CROSS + side, x: C.x, z: C.z, radius: CHANGE.mouth, until: end, beats: true, can: () => side === me && time >= warn && state.marked.has(me) && !state.crossed.has(me),
    }));
    const told: Objective[] = Array.from({ length: RAID_PARTY_MAX }, (_, side): Objective => ({ part: MARK + side, x: C.x, z: C.z, radius: 0, kill: true, until: end }));
    p.say('THE CHANGING OF THE FLAMES', '#ffe27a', C.x, C.z);
    let opened = false, shut = false, asked = false;
    const label = () => p.label(`The Changing of the Flames · ${state.crossed.size} of ${state.marked.size} across`);
    return {
      threats: [wrong], objectives: [...way, ...told], duration: end + 1.5,
      look: {
        update(t) {
          time = t;
          // The hub marks who must cross, once, for the cast a brain's screen asks for (asked once the cast is in the air here: its answer names it).
          if (!asked) {
            asked = true;
            p.reward('change', c.id);
          }
          const m = mouth();
          way[me].x = m.x;
          way[me].z = m.z;
          const pulse = 0.4 + 0.2 * Math.sin(t * 6);
          for (const l of lights) l.opacity = t < warn ? 0.25 * (t / warn) : t < end ? pulse : 0;
          for (const [side, ring] of rings) {
            const h = heroOf(p, side), on = t < end && !state.crossed.has(side);
            if (h) ring.place(h.x, h.z, on ? 0.55 + 0.3 * Math.sin(t * 5) : 0);
          }
          if (!opened && t >= warn) {
            opened = true;
            forgeGates(true);
            p.say('THE GATES OPEN', '#ffe27a', C.x, C.z);
            if (state.marked.has(me)) p.flash('rgba(255,226,140,0.7)', 0.3);
          }
          if (!shut && t >= end) {
            shut = true;
            forgeGates(false);
            p.say('THE GATES SHUT', '#ff9a6a', C.x, C.z);
          }
        },
        done(o, side) {
          if (o.part >= CROSS) {
            state.crossed.add(side);
            const h = heroOf(p, side);
            if (h) {
              p.show.column(h.x, h.z, { radius: 1, height: 7, life: 0.6, color: 0xffd890, peak: 0.6 });
              p.sparks.emit(h.x, 0.6, h.z, 24, 4, 4, 0.7, STAND_COLOR);
            }
          } else {
            state.marked.add(side);
            const ring = new FollowMark(1.5, STAND_COLOR);
            p.group.add(ring.mesh);
            rings.set(side, ring);
            if (side === me) {
              p.hint('You are marked: cross through a gate to the other boss before they shut');
              p.flash('rgba(255,226,140,0.7)', 0.3);
            }
          }
          label();
        },
        dispose() {
          forgeGates(false);
          for (const l of lights) l.dispose();
          for (const r of rings.values()) r.dispose();
        },
      },
    };
  },
};

