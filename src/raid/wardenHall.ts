import * as THREE from 'three';
import { RAID_PARTY_MAX } from '../../server/protocol.mjs';
import { RING, canvasTexture, seeded } from '../arenas/common';
import { HALL_ARMS, HALL_COURT, HALL_FALLS, HALL_HALF, HALL_OBSTACLES, HALL_OPENS, HALL_R, hallBreak, inHall, quarterOf } from '../arenas/sunhall';
import { hourStoneLook } from './bodies/adds';
import { FollowMark, LightPillar, SunOrb } from './fx';
import { LEAVE_COLOR, STAND_COLOR } from './script';
import type { BossCast, BossMove, Objective, PlayContext, PlayedMove, RaidAdd, RaidSide, Threat } from './types';

/**
 * The Sun Warden's fight for a party, beyond his own moves (user, 2026-11-12; pipeline/designs/raid-party.md): the Hall of Noon
 * transforms twice, and three mechanics come only for big parties.
 *
 * - **The hall breaks open** (`breach`, as The Long Hour begins): the four corner blocks crack and fall, and the cross is one round
 *   court. The walls between the arms leave the game.
 * - **The sun comes down** (`sunfall`, as Last Light begins): sunfire wells up from the Sun Well and spreads for the rest of the fight.
 * - **Branded** (`brand`, a fight tuned for 10 or more): one standing hero in eight gets a sun over its head that bursts round it.
 * - **Carry the Sun** (`carry`, 20 or more): a shard per five heroes at the hall's far ends, to be walked home before Noon lands.
 * - **The Four Hours** (`four`, 40): each arm gets a task at the same time.
 *
 * The raid's rules hold (./types.ts). What a move needs to know of the heroes (who is branded, how many stand) the brain works out
 * in `aim` and puts in the cast: a hero in `target`, a count in `x`. The hub passes a cast on field by field, so nothing else would
 * arrive. What the whole party must agree on comes back from the hub: who took a shard (`done`), how many stood in a zone (`stood`,
 * `Threat.tally`). The room's state on this screen (`hallFight`, `hallBreak`) is changed only by a cast, at a time counted from it.
 */
const C = { x: RING.x, z: RING.z };
const SUNFIRE_COLOR = 0xff9a3a;
const DUST = 0xb8a080;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** The party's fight as this screen has it. */
export const hallFight = {
  /** How far the sunfire of his last phase has come from the Sun Well (m); 0 while there is none. */
  fire: 0,
  /** Who carries a sun shard now: his ray aims at them. */
  carriers: new Set<RaidSide>(),
  /** A carry is in the air: his ray throws back whoever it hits, and a hero's body stops it. */
  carrying: 0,
};
/** Who each Branded cast marked, by its seed: step k marked this side. Every screen hears the marks, so a brain that takes over has them. */
const branded = new Map<number, RaidSide[]>();

/** Which quarter of the party he hunts, on the brain's screen: an arm, and until when (the brain's clock). */
const hunt = { arm: -1, until: -Infinity };

/**
 * His great mechanics take turns, with a breath between. The Hour Strikes, Carry the Sun and The Four Hours each hold the floor
 * for half a minute and come as soon as they are ready: left alone they would follow one another without a gap, and the first in
 * his list would crowd the others out. So on the brain's screen each says when it began (`holdFor`, from its `aim`); for `REST`
 * seconds after it ends none of them is in his lists, and then only the one whose turn it is (`nextGreat`).
 */
export const REST = 16;
const pace = { free: -Infinity, turn: 0 };
let order = ['strikes'];
const now = () => performance.now() / 1000;
/** Great mechanic `id` begins now, and holds the floor for `seconds`: the turn passes to the one after it. Only the brain's screen calls it. */
export function holdFor(id: string, seconds: number) {
  pace.free = now() + seconds;
  for (let k = 0; k < order.length; k++) {
    const i = (pace.turn + k) % order.length;
    if (order[i] !== id) continue;
    pace.turn = (i + 1) % order.length;
    break;
  }
}
/** The one of his great mechanics that may come next, or none: one is in the air, or ended less than `REST` seconds ago. */
export const nextGreat = () => (now() < pace.free + REST ? null : order[pace.turn]);

/** A new fight, tuned for `band`: the hall is whole, nothing burns, nobody carries, and his great mechanics start their turns over. */
export function resetHallFight(band: number) {
  // The hour for any party; Carry the Sun between two hours for 20 or more; for 40, The Four Hours every other time in its place.
  order = band >= 40 ? ['strikes', 'carry', 'strikes', 'four'] : band >= 20 ? ['strikes', 'carry'] : ['strikes'];
  pace.turn = 0;
  pace.free = -Infinity;
  hunt.arm = -1;
  hunt.until = -Infinity;
  hallFight.fire = 0;
  hallFight.carriers.clear();
  hallFight.carrying = 0;
  branded.clear();
  hallBreak.reset();
}

/** How far (x, z) is from the nearest of the hall's cover, as it was built (m). */
function clearance(x: number, z: number) {
  let best = Infinity;
  for (const o of HALL_OBSTACLES) {
    const dx = o.bx - o.ax, dz = o.bz - o.az, len = dx * dx + dz * dz;
    const t = len > 0 ? clamp(((x - o.ax) * dx + (z - o.az) * dz) / len, 0, 1) : 0;
    best = Math.min(best, Math.hypot(x - o.ax - dx * t, z - o.az - dz * t) - o.r);
  }
  return best;
}

/**
 * (x, z), or the nearest spot to it that is on the hall's floor and `room` m clear of all its cover. From the hall as it was built,
 * not from what stands now, so every screen finds the same spot whatever has broken on it.
 */
export function freeSpot(x: number, z: number, room = 1.7) {
  const ok = (px: number, pz: number) => inHall(px, pz, 2) && clearance(px, pz) >= room;
  if (ok(x, z)) return { x, z };
  for (let r = 0.8; r <= 8; r += 0.8) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      if (ok(px, pz)) return { x: px, z: pz };
    }
  }
  return { x, z };
}

/** A spot in arm `arm`: `along` m from the Sun Well down its middle, `across` m to the side. */
function armAt(arm: number, along: number, across = 0) {
  const d = HALL_ARMS[arm].dir;
  return { x: C.x + Math.sin(d) * along + Math.cos(d) * across, z: C.z + Math.cos(d) * along - Math.sin(d) * across };
}

// --- the hall breaks open --------------------------------------------------------------------------------------------------

/**
 * The hall breaks open.
 * - `warn`: how long the blocks crack before they fall (s, tier 1). `quick`: when it has to happen with the sunfire (a hit took him
 *   past his second phase at once).
 * - `reach`: who stands this near a wall that goes is struck by it (m), for `share` of max HP. Nobody is pushed: the rubble lies
 *   where the blocks stood, and nobody stood there.
 */
export const BREACH = { warn: 6, quick: 3, reach: 4, share: 0.3 };

/** A part of a played move: its zones, and what it does each frame. */
interface Part {
  threats: Threat[];
  update(t: number, dt: number): void;
}

/** The corner blocks crack for `at` seconds and fall. Nothing, if the hall is open already. */
function breakHall(p: PlayContext, at: number): Part {
  if (hallBreak.open) return { threats: [], update() {} };
  const W = HALL_HALF, far = Math.sqrt(HALL_COURT * HALL_COURT - W * W);
  // The walls that go: two from each of the hall's four inner corners.
  const edges: [number, number, number, number][] = [];
  const corners: { x: number; z: number }[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      corners.push({ x: C.x + sx * W, z: C.z + sz * W });
      edges.push([C.x + sx * W, C.z + sz * W, C.x + sx * W, C.z + sz * far], [C.x + sx * W, C.z + sz * W, C.x + sx * far, C.z + sz * W]);
    }
  }
  const threats = edges.map(([x1, z1, x2, z2]): Threat => ({ shape: { kind: 'line', x1, z1, x2, z2, width: BREACH.reach * 2 }, at, share: BREACH.share, look: 3 }));
  p.hint('The hall is breaking: get away from its walls');
  const dust: { at: number; x: number; z: number; tall: boolean }[] = [];
  let fell = false, cracks = 0;
  const fall = (t: number) => {
    fell = true;
    hallBreak.fall();
    for (const i of HALL_OPENS) p.breakCover(i, 0);
    p.shake(0.24);
    p.flash('rgba(255,232,200,0.75)', 0.4);
    p.say('THE HALL BREAKS OPEN', '#ffe27a', C.x, C.z);
    for (const f of HALL_FALLS) {
      // Each piece throws its dust up as it goes down, and again as it is gone: the tall north ones a wall of it.
      const tall = f.h > 2, drop = Math.sqrt((2 * f.h) / (tall ? 15 : 9));
      dust.push({ at: t + f.delay + drop * 0.25, x: f.x, z: f.z, tall }, { at: t + f.delay + drop * 0.8, x: f.x, z: f.z, tall });
    }
  };
  return {
    threats,
    update(t, dt) {
      if (!fell) {
        const k = Math.min(1, t / at);
        hallBreak.crack(k);
        // Dust and chips off the walls that are going, more as it nears.
        if (Math.random() < dt * (8 + 50 * k * k)) {
          const e = edges[Math.floor(Math.random() * edges.length)], f = Math.random();
          const x = e[0] + (e[2] - e[0]) * f, z = e[1] + (e[3] - e[1]) * f;
          p.sparks.emit(x, z < C.z ? 0.6 + Math.random() * 8 : 0.4 + Math.random() * 0.9, z, 6, 2.2, 0.4, 1, DUST, 6);
        }
        // Three cracks on the way: each a jolt, and stone thrown off the hall's corners.
        if (cracks < 3 && t >= ((cracks + 1) / 4) * at) {
          cracks++;
          p.shake(0.04 + 0.025 * cracks);
          for (const c of corners) {
            p.show.shards(c.x, c.z < C.z ? 4 : 1, c.z, { count: 6 + 4 * cracks, color: '#6a6e80', speed: 4 + cracks, life: 1.1, size: 0.22 });
            p.sparks.emit(c.x, c.z < C.z ? 5 : 1, c.z, 18, 4, 1, 1.1, DUST, 6);
          }
        }
        // Another cast may have brought it down already (the sunfire's, when one hit passed two phases).
        if (hallBreak.open) fell = true;
        else if (t >= at) fall(t);
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        if (t < d.at) continue;
        dust.splice(i, 1);
        // Clouds of it, not columns: thrown up and out, slow to settle.
        for (let k = 0; k < (d.tall ? 4 : 2); k++) {
          const x = d.x + (Math.random() - 0.5) * 6, z = d.z + (Math.random() - 0.5) * 6;
          p.show.burst(x, 0.4, z, d.tall ? 14 : 7, d.tall ? 4.5 : 2.6, d.tall ? 6 : 2.4, 1.6 + Math.random() * 0.8, 0xa89c84, 1.6);
          p.sparks.emit(x, 0.4, z, d.tall ? 12 : 6, d.tall ? 6 : 3.5, d.tall ? 4 : 2, 1.2, DUST, 5);
        }
        p.show.shards(d.x, 0.6, d.z, { count: d.tall ? 7 : 3, color: '#6a6e80', speed: d.tall ? 7 : 4, life: 1.2, size: 0.26, up: 0.8 });
        if (d.tall) p.shake(0.06);
      }
    },
  };
}

/**
 * The hall breaks open (user, 2026-11-12): as his second phase begins the four corner blocks of the stone crack, a warning runs
 * along their walls, and they fall. The cross becomes one round court, their rubble lies in it as cover, and the walls between the
 * arms no longer stop a walk, a look or a ray. It comes by the phase's clock (`BossPhase.timed`), beside the stage that opens the
 * phase: the stage's own cast can be cut short (its stones broken early), and this must not be.
 */
export const breach: BossMove = {
  id: 'breach', name: 'The Hall Breaks Open', charge: BREACH.warn, lock: 0, cooldown: 99999, alongside: true, big: true, pose: 'raise',
  aim: () => ({ x: C.x, z: C.z, dir: 0 }),
  play(_c, p) {
    const at = p.shown(BREACH.warn), part = breakHall(p, at);
    return { threats: part.threats, duration: at + 6, look: { update: part.update } };
  },
};

// --- the sun comes down ------------------------------------------------------------------------------------------------------

/**
 * The sunfire of his last phase.
 * - `warn`: it wells up at the Sun Well for this long before it burns (s). `from`, `to`: how far from the well it burns at first
 *   and at last (m). `rate`: how fast it spreads (m/s): from 6 m to 24 m takes two and a half minutes.
 * - `to` leaves a ring 12 m wide inside the round court's wall (36.4 m), and the ends of the nave and the choir.
 * - `share`: what a second in it costs, of max HP.
 */
export const SUNFIRE = { warn: 5, from: 6, to: 24, rate: 0.12, share: 0.06, lasts: 1800 };

/** How far the sunfire has come, `t` seconds after its cast. */
export const fireRadius = (t: number) => Math.min(SUNFIRE.to, SUNFIRE.from + SUNFIRE.rate * Math.max(0, t - SUNFIRE.warn));

const discGeo = new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2);
const rimGeo = new THREE.RingGeometry(0.97, 1, 120).rotateX(-Math.PI / 2);
const hotGeo = new THREE.RingGeometry(0.8, 0.97, 120).rotateX(-Math.PI / 2);

/** The sunfire on the floor: a disc of light, hotter toward its edge, and the edge itself drawn in the zones' "leave" colour. */
class SunfireFloor {
  readonly group = new THREE.Group();
  private mats: THREE.MeshBasicMaterial[];
  constructor() {
    const mat = (color: number, blend: THREE.Blending) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: blend });
    this.mats = [mat(SUNFIRE_COLOR, THREE.AdditiveBlending), mat(0xffb050, THREE.AdditiveBlending), mat(LEAVE_COLOR, THREE.NormalBlending)];
    [discGeo, hotGeo, rimGeo].forEach((geo, i) => {
      const m = new THREE.Mesh(geo, this.mats[i]);
      m.position.y = 0.05 + i * 0.012;
      m.renderOrder = 2 + i;
      this.group.add(m);
    });
    this.group.position.set(C.x, 0, C.z);
  }

  set(radius: number, on: number, time: number) {
    this.group.scale.set(radius, 1, radius);
    this.mats[0].opacity = 0.2 * on;
    this.mats[1].opacity = (0.3 + 0.1 * Math.sin(time * 3)) * on;
    this.mats[2].opacity = 0.95 * on;
  }

  dispose() {
    this.group.removeFromParent();
    for (const m of this.mats) m.dispose();
  }
}

/**
 * The sun comes down (user, 2026-11-12): as his last phase begins sunfire wells up from the Sun Well and spreads outward, a ring
 * that grows for the rest of the fight and burns each second. The party is pushed out toward the far ends of the court and split
 * up; he leaves the middle and hunts group by group (`SUN_WARDEN.choose`). If the hall still stands (one hit took him through his
 * second phase), it breaks open now.
 */
export const sunfall: BossMove = {
  id: 'sunfall', name: 'The Sun Comes Down', charge: SUNFIRE.warn, lock: 0, cooldown: 99999, alongside: true, big: true, pose: 'raise',
  aim: () => ({ x: C.x, z: C.z, dir: 0 }),
  play(_c, p) {
    const hall = breakHall(p, p.shown(BREACH.quick));
    const warn = SUNFIRE.warn;
    // It wells up where it will first burn, as any zone shows; from then on it is a zone that stays and grows.
    const first: Threat = { shape: { kind: 'circle', x: C.x, z: C.z, radius: SUNFIRE.from }, at: warn, share: SUNFIRE.share };
    const stays: Threat = {
      shape: { kind: 'circle', x: C.x, z: C.z, radius: SUNFIRE.from }, hits: (x, z, t) => Math.hypot(x - C.x, z - C.z) <= fireRadius(t),
      at: warn + 1, to: SUNFIRE.lasts, every: 1, share: SUNFIRE.share, look: 1.5,
    };
    const floor = new SunfireFloor();
    p.group.add(floor.group);
    p.hint('Sunfire spreads from the Sun Well: keep out of it, it grows');
    p.say('THE SUN COMES DOWN', '#ffb050', C.x, C.z);
    p.show.column(C.x, C.z, { radius: 3, height: 40, life: 2.4, color: 0xfff0d0, peak: 0.8 });
    p.show.ring(C.x, C.z, { radius: 30, life: 1.6, color: 0xffb060, width: 1.2, peak: 0.6 });
    let time = 0;
    return {
      threats: [first, stays, ...hall.threats], duration: SUNFIRE.lasts,
      look: {
        update(t, dt) {
          time += dt;
          hall.update(t, dt);
          const r = fireRadius(t);
          hallFight.fire = r;
          floor.set(r, Math.min(1, t / warn), time);
          if (t < warn) return;
          // Embers all over it, and tongues of flame: most along its edge, where it is walked into.
          if (Math.random() < dt * 60) {
            const a = Math.random() * Math.PI * 2, d = r * Math.sqrt(Math.random());
            p.show.burst(C.x + Math.sin(a) * d, 0.1, C.z + Math.cos(a) * d, 2, 0.8, 3.5, 1.1, SUNFIRE_COLOR, 0.5);
          }
          if (Math.random() < dt * 40) {
            const a = Math.random() * Math.PI * 2, d = Math.random() < 0.6 ? r - 0.4 - Math.random() * 1.6 : r * Math.sqrt(Math.random());
            p.show.column(C.x + Math.sin(a) * d, C.z + Math.cos(a) * d, { radius: 0.18 + Math.random() * 0.3, height: 2 + Math.random() * 4.5, life: 0.9, color: SUNFIRE_COLOR, peak: 0.6 });
          }
        },
        dispose() {
          hallFight.fire = 0;
          floor.dispose();
        },
      },
    };
  },
};

// --- Branded (a party of 10 or more) -------------------------------------------------------------------------------------------

/**
 * Branded.
 * - `per`: one standing hero in this many is branded, at most `most` (a party of 40: five).
 * - `seconds`: from the brand to its burst. `radius`: how far the burst reaches round the branded hero (m).
 * - `heavy`: what it costs whoever else stands in it; `light`: the branded hero itself.
 * - A burst that catches two or more others costs the whole party `crowd` for each of them, at most `crowdMost`.
 */
export const BRAND = { per: 8, most: 5, every: 28, seconds: 5, radius: 5, burst: 0.4, heavy: 0.3, light: 0.08, crowd: 0.06, crowdMost: 0.24 };

/** The brand: a sun over the hero's head and a ring round it that follow it. Only a look: what counts comes with the burst's cast. */
function brandMark(c: BossCast, p: PlayContext): PlayedMove {
  const T = p.shown(BRAND.seconds), side = c.target, mine = side === p.side;
  const orb = new SunOrb(c.x, 3.6, c.z), ring = new FollowMark(BRAND.radius, LEAVE_COLOR);
  p.group.add(orb.sprite, ring.mesh);
  let at = { x: c.x, z: c.z };
  const where = () => (at = p.heroAt(side) ?? at);
  p.hint(mine ? 'You are branded: run out of the crowd before it bursts' : 'Branded: keep away from the suns over their heads');
  p.say('BRANDED', '#ffb050', c.x, c.z);
  if (mine) p.flash('rgba(255,170,70,0.75)', 0.3);
  // To an AI the ring is a zone to walk out of. It never lands here: the burst is a cast of its own.
  const threats: Threat[] = mine ? [] : [{
    shape: { kind: 'circle', x: c.x, z: c.z, radius: BRAND.radius }, shapeAt: () => ({ kind: 'circle', ...where(), radius: BRAND.radius }),
    at: T + 2, share: 0, look: T + 2,
  }];
  return {
    threats, duration: T + 0.7,
    look: {
      update(t) {
        const h = where(), k = Math.min(1, t / T), on = t < T ? 1 : Math.max(0, 1 - (t - T) * 3);
        orb.sprite.position.set(h.x, 3.6, h.z);
        orb.set(2.4 + 3.4 * k, (0.7 + 0.3 * k) * on);
        ring.place(h.x, h.z, (0.5 + 0.35 * k + 0.12 * Math.sin(t * (5 + 12 * k))) * on);
      },
      dispose() {
        orb.dispose();
        ring.dispose();
      },
    },
  };
}

/** The burst, where the brain saw the branded hero stand: a hit for whoever is in it, and a count of them from the hub. */
function brandBurst(c: BossCast, p: PlayContext): PlayedMove {
  const at = BRAND.burst, mine = c.target === p.side;
  const shape = { kind: 'circle' as const, x: c.x, z: c.z, radius: BRAND.radius };
  const hit: Threat = { shape, at, share: mine ? BRAND.light : BRAND.heavy };
  const count: Threat = {
    shape, kind: 'stand', hidden: true, show: at, at, share: 0, part: 0,
    tally(n) {
      // The branded hero is one of them. Two or more others: it burst in the crowd, and everyone pays.
      const others = n - 1;
      if (others < 2) return;
      p.say('THE BRAND BURNS THE CROWD', '#ff9a6a', c.x, c.z);
      p.flash('rgba(255,150,70,0.8)', 0.35);
      return Math.min(BRAND.crowdMost, BRAND.crowd * others);
    },
  };
  return {
    threats: [hit, count], duration: at + 0.8,
    look: {
      land(th) {
        if (th !== hit) return;
        p.show.column(c.x, c.z, { radius: 2, height: 13, life: 0.9, color: 0xffe0a0, peak: 0.85 });
        p.show.ring(c.x, c.z, { radius: BRAND.radius + 1.5, life: 0.7, color: 0xffb060, width: 0.9 });
        p.show.burst(c.x, 1.2, c.z, 46, 8, 4, 0.9, SUNFIRE_COLOR, 6);
        p.glows.flash(c.x, c.z, BRAND.radius, 0xd86a18, 0.6, 0.5);
        if (mine) p.shake(0.08);
      },
    },
  };
}

/**
 * Branded (user, 2026-11-12, for a party of 10 or more): about one standing hero in eight gets a sun over its head. After 5 s it
 * bursts in a circle round each of them: whoever else stands in it takes a heavy hit, the branded hero a light one, and a burst in
 * the crowd costs everyone. The branded run out of the crowd.
 *
 * Its first five steps mark a hero each, its last five burst them: the brain names the hero in each cast's `target` (drawn by the
 * cast's seed from those standing) and puts where it stands in the cast. A step with nobody to mark is flagged, and plays nothing.
 */
export const brand: BossMove = {
  // By its own clock: about every half minute from High Noon on, whatever else he does.
  id: 'brand', name: 'Branded', minBand: 10, charge: BRAND.seconds, lock: 0, cooldown: BRAND.every, due: BRAND.every, alongside: true, pose: 'raise',
  steps: [...Array<number>(BRAND.most).fill(0), ...Array<number>(BRAND.most).fill(BRAND.seconds)],
  aim(c) {
    const k = c.step % BRAND.most, up = c.heroes ?? [];
    if (c.step === 0) {
      const rng = seeded(c.seed), pool = up.map((h) => h.side).sort((a, b) => a - b), picks: RaidSide[] = [];
      const n = clamp(Math.round(pool.length / BRAND.per), 1, BRAND.most);
      while (picks.length < n && pool.length) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
      branded.set(c.seed, picks);
    }
    const side = branded.get(c.seed)?.[k], h = up.find((x) => x.side === side);
    return h ? { x: h.x, z: h.z, dir: 0, target: h.side } : { x: c.boss.x, z: c.boss.z, dir: 0, flag: true };
  },
  play(c, p) {
    if (c.flag) return { threats: [], duration: 0.05 };
    if (c.step >= BRAND.most) return brandBurst(c, p);
    const list = branded.get(c.seed) ?? [];
    list[c.step] = c.target;
    branded.set(c.seed, list);
    return brandMark(c, p);
  },
};

// --- Carry the Sun (a party of 20 or more) -------------------------------------------------------------------------------------

/**
 * Carry the Sun.
 * - `per`: a shard for every this many heroes standing, at most `most`.
 * - `seconds`: from his call until Noon lands (tier 1); `least`: never sooner, whatever the tier. The farthest shard lies 33 m
 *   from the Sun Well: 10 s out at 3.5 m/s and 12 s back under a shard.
 * - `out`: how far along an arm the shards fall, as a share of its length; in the round court `ring` m from the well.
 * - What Noon costs everyone: `base`, and `miss` shared out over the shards not home (all of them missing: `base + miss`).
 * - `knock`: while shards are carried his ray throws whoever it hits this far back (m).
 */
export const CARRY = { per: 5, most: 8, seconds: 36, least: 32, out: 0.75, ring: 30, base: 0.12, miss: 0.56, knock: 5 };
/** While the sun is carried he does only these: his ray at the carriers, and stones that fall where they walk and break it. */
const CARRY_ONLY = ['ray', 'pillars'];
/** A shard's way in, one for each seat. */
const HOME = 100;

/** How far from the Sun Well a shard is brought: the well itself, or the sunfire's edge once it burns. */
const homeRadius = () => (hallFight.fire ? hallFight.fire + 1.6 : 2.4);

/** Where `n` shards fall: in turn at the far ends of the arms, or round the far side of the court once the hall is open. */
function shardSpots(n: number, seed: number) {
  const rng = seeded(seed), turn = Math.floor(rng() * 4), base = rng() * Math.PI * 2;
  return Array.from({ length: n }, (_, i) => {
    if (hallBreak.open) {
      const a = base + (i / n) * Math.PI * 2;
      return freeSpot(C.x + Math.sin(a) * CARRY.ring, C.z + Math.cos(a) * CARRY.ring);
    }
    // One an arm; from the fifth on a second in each, the two of an arm 9 m apart.
    const arm = ((i % 4) + turn) % 4, inArm = Math.floor((n - 1 - (i % 4)) / 4) + 1;
    const s = armAt(arm, HALL_ARMS[arm].reach * CARRY.out, inArm > 1 ? (i < 4 ? -4.5 : 4.5) : 0);
    return freeSpot(s.x, s.z);
  });
}

/** Sun shards to bring home, as Gathering Noon has them, for any number: what a cast shows of them and who carries which. */
function shardRun(c: BossCast, p: PlayContext, spots: { x: number; z: number }[], first: number, until: number, home: (count: number) => void) {
  const me = p.side, carrying = new Set<RaidSide>(), delivered = new Set<RaidSide>();
  const shards = spots.map((s, i) => {
    const light = new LightPillar(s.x, s.z, 1.4, 9, STAND_COLOR), orb = new SunOrb(s.x, 1.2, s.z);
    p.group.add(light.mesh, orb.sprite);
    return { ...s, part: first + i, light, orb };
  });
  const altar = new LightPillar(C.x, C.z, homeRadius(), 8, STAND_COLOR);
  p.group.add(altar.mesh);
  const way: Objective[] = Array.from({ length: RAID_PARTY_MAX }, (_, side): Objective => ({
    part: HOME + side, x: C.x, z: C.z, radius: homeRadius(), until, beats: true, can: () => side === me && carrying.has(side),
  }));
  const objectives: Objective[] = [
    ...shards.map((s): Objective => ({ part: s.part, x: s.x, z: s.z, radius: 1.4, until, can: () => !carrying.has(me) && !delivered.has(me) })),
    ...way,
  ];
  const held = new Map<RaidSide, SunOrb>();
  const drop = (side: RaidSide) => {
    carrying.delete(side);
    hallFight.carriers.delete(side);
    held.get(side)?.dispose();
    held.delete(side);
    if (side === me) p.heavy(false);
  };
  let over = false;
  return {
    objectives,
    get home() { return delivered.size; },
    /** Whether `o` is one of this run's, and what happened. */
    done(o: Objective, side: RaidSide) {
      if (o.part >= first && o.part < first + shards.length) {
        carrying.add(side);
        hallFight.carriers.add(side);
        const orb = new SunOrb(C.x, 3.1, C.z);
        p.group.add(orb.sprite);
        held.set(side, orb);
        if (side === me) {
          p.heavy(true);
          p.hint('Bring the shard to the Sun Well');
        }
        return true;
      }
      if (o.part < HOME || o.part >= HOME + RAID_PARTY_MAX) return false;
      drop(side);
      delivered.add(side);
      p.sparks.emit(C.x, 1, C.z, 24, 4, 4, 0.7, STAND_COLOR);
      p.show.ring(C.x, C.z, { radius: homeRadius() + 3, life: 0.7, color: STAND_COLOR, width: 0.5, peak: 0.6 });
      home(delivered.size);
      return true;
    },
    update(t: number) {
      const pulse = 0.55 + 0.2 * Math.sin(t * 5), on = !over && t < until;
      for (const s of shards) {
        const gone = !on || !!objectives[s.part - first].done;
        s.light.opacity = gone ? 0 : pulse;
        s.orb.set(1.7, gone ? 0 : 0.95);
      }
      // The way home moves out with the sunfire.
      const r = homeRadius();
      for (const o of way) o.radius = r;
      altar.mesh.scale.set(r, 8, r);
      altar.opacity = on && carrying.size ? pulse : 0;
      for (const [side, orb] of held) {
        const h = p.heroAt(side);
        if (h) orb.sprite.position.set(h.x, 3.1, h.z);
        orb.set(1.5, 0.95);
      }
    },
    /** It is over: nobody carries any more. */
    end() {
      over = true;
      for (const side of [...carrying]) drop(side);
    },
    dispose() {
      this.end();
      altar.dispose();
      for (const s of shards) {
        s.light.dispose();
        s.orb.dispose();
      }
    },
  };
}

/**
 * Carry the Sun (user, 2026-11-12, for a party of 20 or more): the party's Gathering Noon. A shard for every five heroes standing
 * falls at the far ends of the hall; whoever walks over one carries it, slower, to the Sun Well (to the sunfire's edge once it
 * burns). Meanwhile his ray aims at the carriers and throws back whoever it hits: it breaks on cover, on a fallen stone, or on a
 * hero who stands in its way (`sunRay`). Every shard not home when Noon lands adds to what everyone takes; all home, and he kneels.
 * He stands still only for the call. The count of shards is the brain's, in the cast's `x`.
 */
export const carry: BossMove = {
  id: 'carry', name: 'Carry the Sun', minBand: 20, charge: CARRY.seconds, least: CARRY.least, lock: 3, cooldown: 50, due: 0, big: true, pose: 'raise',
  holds: { get only() { return hallFight.fire ? [...CARRY_ONLY, 'brand'] : CARRY_ONLY; } },
  aim(c) {
    holdFor('carry', CARRY.seconds);
    return { x: clamp(Math.round((c.heroes?.length ?? 1) / CARRY.per), 1, CARRY.most), z: 0, dir: Math.atan2(C.x - c.boss.x, C.z - c.boss.z) };
  },
  play(c, p) {
    const need = clamp(Math.round(c.x), 1, CARRY.most), at = Math.max(CARRY.least, p.shown(CARRY.seconds));
    const noon: Threat = { shape: { kind: 'circle', x: C.x, z: C.z, radius: HALL_R + 2 }, at, show: Math.max(0, at - 4), share: CARRY.base + CARRY.miss, look: 2.6 };
    const sun = new SunOrb(c.fx, 7, c.fz);
    p.group.add(sun.sprite);
    p.hint('Carry the sun shards home before Noon: stand in his ray for the carriers');
    p.say('CARRY THE SUN', '#ffe27a', C.x, C.z);
    hallFight.carrying++;
    let turned = -1, time = 0, counted = true;
    const uncount = () => {
      if (counted) hallFight.carrying--;
      counted = false;
    };
    const run = shardRun(c, p, shardSpots(need, c.seed), 0, at, (count) => {
      noon.share = count >= need ? 0 : CARRY.base + CARRY.miss * ((need - count) / need);
      p.label(`Carry the Sun · ${count} of ${need} home`);
      if (count < need) return;
      // All home: there is no noon, and he kneels.
      turned = time;
      run.end();
      uncount();
      p.cancel(c.id);
      p.reward('carry', c.id);
      p.show.triumph(C.x, C.z, 0xffe0a0, 1.5);
      p.shake(0.08);
      p.flash('rgba(255,226,140,0.7)', 0.5);
      p.say('THE SUN IS HOME', '#ffe27a', C.x, C.z);
    });
    return {
      threats: [noon], objectives: run.objectives, duration: at + 1,
      look: {
        update(t) {
          time = t;
          run.update(t);
          if (turned >= 0) return sun.set(13 * Math.max(0, 1 - (t - turned) * 2), 0.9 * Math.max(0, 1 - (t - turned) * 2));
          const k = Math.min(1, t / at);
          sun.set(2 + 11 * k, t < at ? 0.25 + 0.65 * k * k : Math.max(0, 0.9 * (1 - (t - at) * 1.5)));
        },
        done(o, side) { run.done(o, side); },
        land() {
          run.end();
          uncount();
          p.flash('rgba(255,206,130,0.85)', 0.8);
          p.shake(0.14);
          p.say(run.home ? 'NOON' : 'NOON: NO SHARD CAME HOME', '#ffb050', C.x, C.z);
          p.show.ring(C.x, C.z, { radius: 50, life: 1.5, color: 0xffd890, width: 2 });
          p.show.column(C.x, C.z, { radius: 4, height: 40, life: 1.4, color: 0xfff0d0, peak: 0.85 });
        },
        off() {
          run.end();
          uncount();
        },
        dispose() {
          run.dispose();
          uncount();
          sun.dispose();
        },
      },
    };
  },
};

// --- The Four Hours (a party of 40) ------------------------------------------------------------------------------------------------

/**
 * The Four Hours.
 * - `seconds`: from his call to the end (tier 1); `least`: never sooner. `settle`: the arms' tasks end this long before that, so
 *   the hub's counts are back when the hall burns.
 * - `fail`: what each arm not done costs everyone, of max HP (all four: 72 %).
 * - `stone`: an hour stone's HP, as a share of the boss's max, for a full party; fewer heroes standing, less (never under a quarter).
 * - `lane`: what the two burning lanes of the fourth arm cost whoever stands in them.
 * Each arm done pays a quarter of his stagger gauge (`RAID_REWARDS.sun.foura` to `fourd`): all four, and he kneels.
 */
export const FOUR = { seconds: 38, least: 34, settle: 4, fail: 0.18, stone: 0.008, lane: 0.25 };
/** The tasks, in the order the seed turns them round the arms; what each arm is called on the cast bar. */
const TASKS = ['CARRY', 'HOLD', 'BREAK', 'STAND'] as const;
const TASK_HINT = ['bring its shards home', 'stand in its gold circles', 'break its hour stones', 'stand in its gold lane'];
const REWARDS = ['foura', 'fourb', 'fourc', 'fourd'];
const ARM_WORD = ['NAVE', 'EAST', 'CHOIR', 'WEST'];
const HOLD = 10, BREAK = 20, STAND = 30;

/** A word standing over an arm: what to do there. */
class WordMark {
  readonly sprite: THREE.Sprite;
  constructor(text: string, x: number, z: number) {
    const map = canvasTexture(512, (g) => {
      g.clearRect(0, 0, 512, 512);
      g.font = '800 120px ui-serif, Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 18;
      g.strokeStyle = '#1a0f06';
      g.strokeText(text, 256, 256);
      g.fillStyle = '#ffe0a0';
      g.fillText(text, 256, 256);
    });
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false }));
    this.sprite.position.set(x, 6.5, z);
    this.sprite.scale.setScalar(9);
    this.sprite.renderOrder = 5;
  }

  dispose() {
    this.sprite.removeFromParent();
    this.sprite.material.map?.dispose();
    this.sprite.material.dispose();
  }
}

/**
 * The Four Hours (user, 2026-11-12, for a party of 40): all four arms get a task at the same time, and the raid splits into four.
 * One arm carries its shards home, one holds its gold circles, one breaks his hour stones, one stands in the gold lane of three
 * while the other two burn. Each arm done in time pays a quarter of a kneel; each arm not done burns the whole hall for a share.
 * The seed turns the tasks round the arms. How much each task asks comes from the heroes standing, counted by the brain (the
 * cast's `x`). Which arms are done every screen hears from the hub: who took a shard, who broke a stone, how many stood.
 */
export const four: BossMove = {
  id: 'four', name: 'The Four Hours', minBand: 40, charge: FOUR.seconds, least: FOUR.least, lock: 3, cooldown: 50, due: 0, big: true, pose: 'raise',
  holds: { get only() { return hallFight.fire ? ['sweep', 'pillars', 'ray', 'fists', 'brand'] : ['sweep', 'pillars', 'ray', 'fists']; } },
  aim(c) {
    holdFor('four', FOUR.seconds);
    return { x: Math.max(1, c.heroes?.length ?? 1), z: 0, dir: Math.atan2(C.x - c.boss.x, C.z - c.boss.z) };
  },
  play(c, p) {
    const n = clamp(Math.round(c.x), 1, RAID_PARTY_MAX), each = Math.max(1, Math.round(n / 4));
    const at = Math.max(FOUR.least, p.shown(FOUR.seconds)), settle = at - FOUR.settle;
    const turn = seeded(c.seed)() * 4 | 0;
    /** Which arm has task `k`, and how far down it the task lies: past the sunfire, short of the arm's end. */
    const armOf = (k: number) => (k + turn) % 4;
    const depth = (arm: number) => clamp(Math.max(22, hallFight.fire + 7), 22, HALL_ARMS[arm].reach - 6);
    const done = [false, false, false, false], failed = [false, false, false, false];
    const marks = TASKS.map((word, k) => {
      const s = armAt(armOf(k), depth(armOf(k)));
      const m = new WordMark(word, s.x, s.z);
      p.group.add(m.sprite);
      return m;
    });
    const label = () => p.label(`The Four Hours · ${[0, 1, 2, 3].filter((arm) => !done[(arm - turn + 4) % 4]).map((arm) => ARM_WORD[arm]).join(' ') || 'all done'}`);
    const fail: Threat = { shape: { kind: 'circle', x: C.x, z: C.z, radius: HALL_R + 2 }, at, show: Math.max(0, at - 3), share: FOUR.fail * 4, look: 2.6 };
    const finish = (k: number, ok: boolean) => {
      if (done[k] || failed[k]) return;
      const arm = armOf(k), s = armAt(arm, depth(arm));
      marks[k].sprite.visible = false;
      if (!ok) {
        failed[k] = true;
        return;
      }
      done[k] = true;
      fail.share = FOUR.fail * done.filter((d) => !d).length;
      p.reward(REWARDS[k], c.id);
      p.say(`${ARM_WORD[arm]} DONE`, '#ffe27a', s.x, s.z);
      p.show.triumph(s.x, s.z, 0xffe0a0, 1.1);
      label();
      if (done.every(Boolean)) {
        p.cancel(c.id);
        p.flash('rgba(255,226,140,0.7)', 0.5);
        p.say('THE FOUR HOURS HOLD', '#ffe27a', C.x, C.z);
      }
    };

    // Carry: one shard, or two for an arm of eight or more.
    const carryArm = armOf(0), shards = each >= 8 ? 2 : 1;
    hallFight.carrying++;
    let counted = true;
    const uncount = () => {
      if (counted) hallFight.carrying--;
      counted = false;
    };
    const spots = Array.from({ length: shards }, (_, i) => {
      const s = armAt(carryArm, HALL_ARMS[carryArm].reach - 6, shards > 1 ? (i ? 4.5 : -4.5) : 0);
      return freeSpot(s.x, s.z);
    });
    const run = shardRun(c, p, spots, 0, settle, (count) => { if (count >= shards) finish(0, true); });

    // Hold: gold circles, each with a hero in it when the count is taken.
    const holdArm = armOf(1), circles = clamp(Math.round(each / 3), 1, 3), held: (boolean | null)[] = Array(circles).fill(null);
    const lights: LightPillar[] = [];
    const holds: Threat[] = Array.from({ length: circles }, (_, i): Threat => {
      const s = armAt(holdArm, depth(holdArm), (i - (circles - 1) / 2) * 7), f = freeSpot(s.x, s.z, 2.6);
      const light = new LightPillar(f.x, f.z, 2.4, 7, STAND_COLOR);
      p.group.add(light.mesh);
      lights.push(light);
      return {
        shape: { kind: 'circle', x: f.x, z: f.z, radius: 2.4 }, kind: 'stand', at: settle, share: 0, part: HOLD + i,
        tally(count) {
          held[i] = count > 0;
          if (held.every((h) => h !== null)) finish(1, held.every(Boolean));
        },
      };
    });

    // Break: three of his hour stones. They stand and do nothing, but they are stone.
    const breakArm = armOf(2), hp = Math.max(40, Math.round(p.bossMax * FOUR.stone * clamp(n / RAID_PARTY_MAX, 0.25, 1)));
    const adds: RaidAdd[] = [], kills: Objective[] = [];
    for (let i = 0; i < 3; i++) {
      const s = armAt(breakArm, depth(breakArm) + (i === 1 ? 2.5 : 0), (i - 1) * 6.5), f = freeSpot(s.x, s.z, 2.2), part = BREAK + i;
      const o: Objective = { part, x: f.x, z: f.z, radius: 0, kill: true, until: settle };
      kills.push(o);
      adds.push(p.spawnAdd({
        x: f.x, z: f.z, hp, look: hourStoneLook, color: '#c8b088',
        hurt: (amount) => p.addHit(c.id, part, amount),
        died: () => {
          if (o.done || o.reported) return;
          o.reported = true;
          p.report(c.id, part);
        },
      }));
      p.show.column(f.x, f.z, { radius: 0.9, height: 9, life: 1.3, color: 0xf09030, delay: 0.15 });
    }

    // Stand: three lanes down the arm. Two burn; enough heroes must stand in the gold one.
    const standArm = armOf(3), lanes = (HALL_HALF * 2) / 3, safe = (seeded(c.seed + 7)() * 3) | 0, want = Math.max(1, Math.round(each / 2));
    const lane = (i: number) => {
      const a = armAt(standArm, HALL_HALF + 1, (i - 1) * lanes), b = armAt(standArm, HALL_ARMS[standArm].reach - 1, (i - 1) * lanes);
      return { kind: 'line' as const, x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: lanes - 0.3 };
    };
    const burns: Threat[] = [0, 1, 2].filter((i) => i !== safe).map((i) => ({ shape: lane(i), at: settle, share: FOUR.lane }));
    const stand: Threat = { shape: lane(safe), kind: 'stand', at: settle, share: 0, part: STAND, tally: (count) => finish(3, count >= want) };

    p.hint('The Four Hours: split up, one task in each arm');
    p.say('THE FOUR HOURS', '#ffe27a', C.x, C.z);
    p.show.ring(C.x, C.z, { radius: 34, life: 1.5, color: 0xffe0b0, width: 1, peak: 0.6 });
    for (const [k, text] of TASK_HINT.entries()) {
      const arm = armOf(k), s = armAt(arm, HALL_HALF + 3);
      p.say(`${ARM_WORD[arm]}: ${text}`, '#ffe27a', s.x, s.z);
    }
    const stop = () => {
      run.end();
      uncount();
      for (const a of adds) a.remove();
    };
    let closed = false, named = false;
    return {
      threats: [...holds, ...burns, stand, fail], objectives: [...run.objectives, ...kills], duration: at + 1.2,
      look: {
        update(t) {
          // The cast bar gets the move's name as the cast comes in: the arms go on it after that.
          if (!named) {
            named = true;
            label();
          }
          run.update(t);
          const pulse = t < settle ? 0.3 + 0.3 * (t / settle) + 0.08 * Math.sin(t * 5) : Math.max(0, 0.6 * (1 - (t - settle) * 2));
          for (const l of lights) l.opacity = done[1] || failed[1] ? 0 : pulse;
          // The tasks end: what is not done by now is not done.
          if (!closed && t >= settle) {
            closed = true;
            if (!done[0]) finish(0, false);
            if (!done[2]) finish(2, false);
            run.end();
            for (const a of adds) if (a.alive) a.remove();
          }
        },
        hurt(part, amount) { adds[part - BREAK]?.hurt(amount); },
        done(o, side) {
          if (run.done(o, side)) return;
          const a = adds[o.part - BREAK];
          if (!a) return;
          a.slay();
          p.show.shards(a.x, 1.2, a.z, { count: 16, color: '#c8b088', speed: 5, life: 1, size: 0.2 });
          p.show.ring(a.x, a.z, { radius: 4, life: 0.7, color: 0xf09030, width: 0.45 });
          if (kills.every((x) => x.done)) finish(2, true);
        },
        land(th) {
          if (th !== fail) return;
          const lost = done.filter((d) => !d).length;
          if (!lost) return;
          p.flash('rgba(255,206,130,0.85)', 0.3 + 0.15 * lost);
          p.shake(0.08 + 0.03 * lost);
          p.say(lost === 4 ? 'THE FOUR HOURS STRIKE' : `${lost} HOUR${lost > 1 ? 'S' : ''} STRIKE${lost > 1 ? '' : 'S'}`, '#ffb050', C.x, C.z);
          p.show.ring(C.x, C.z, { radius: 50, life: 1.5, color: 0xffd890, width: 2 });
          for (let arm = 0; arm < 4; arm++) {
            if (done[(arm - turn + 4) % 4]) continue;
            for (let along = HALL_HALF + 3; along < HALL_ARMS[arm].reach - 1; along += 7) {
              const s = armAt(arm, along, (Math.random() - 0.5) * 14);
              p.show.column(s.x, s.z, { radius: 1.2 + Math.random(), height: 9 + Math.random() * 10, life: 1.2, color: SUNFIRE_COLOR, peak: 0.8, delay: (along - HALL_HALF) * 0.014 });
            }
          }
        },
        off: stop,
        dispose() {
          stop();
          run.dispose();
          for (const m of marks) m.dispose();
          for (const l of lights) l.dispose();
        },
      },
    };
  },
};

/** How long he stays with one quarter of a party in his last phase (s). */
export const HUNT_S = 14;

/**
 * Whom he goes for next (`BossDef.choose`): a carrier of a sun shard first; in his last phase, with the sunfire between the groups,
 * one quarter of the court at a time. Otherwise the brain's own rule.
 */
export function wardenChoice(c: { heroes: { side: RaidSide; x: number; z: number }[]; time: number; when(side: RaidSide): number }): RaidSide | undefined {
  const least = (list: { side: RaidSide }[]) => list.reduce((a, b) => (c.when(b.side) < c.when(a.side) ? b : a)).side;
  const carriers = c.heroes.filter((h) => hallFight.carriers.has(h.side));
  if (carriers.length) return least(carriers);
  if (!hallFight.fire) return undefined;
  const here = (arm: number) => c.heroes.filter((h) => quarterOf(h.x, h.z) === arm);
  if (hunt.arm < 0 || c.time >= hunt.until || !here(hunt.arm).length) {
    // On to the next quarter with someone in it.
    for (let k = 1; k <= 4; k++) {
      const arm = (Math.max(0, hunt.arm) + k) % 4;
      if (!here(arm).length) continue;
      hunt.arm = arm;
      hunt.until = c.time + HUNT_S;
      break;
    }
  }
  const group = here(hunt.arm);
  return group.length ? least(group) : undefined;
}
