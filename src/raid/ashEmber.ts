import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import { RING, seeded } from '../arenas/common';
import { ArenaShift } from '../arenas/shifts/base';
import { ZoneFloor } from '../arenas/shifts/floor';
import { PILLARS, PIT_R, RIM_SPOTS, cinderPitArena } from '../arenas/cinderpit';
import { PILLAR_GLASS } from '../arenas/cinderPillars';
import { TWIN_LAYOUT, TWIN_PILLARS, TWIN_R, TWIN_WALL, twinHeroStart, twinPitArena } from '../arenas/twinpit';
import type { ArenaDef } from '../arenas/types';
import type { TelegraphClip, TelegraphShape } from '../effects/telegraph';
import type { HeroKit, HeroKey, HeroSpell } from '../heroes';
import type { Obstacle } from '../obstacles';
import { coalHeartLook } from './bodies/adds';
import { ashLook } from './bodies/ash';
import { TOSS, emberLook } from './bodies/ember';
import type { BodyLook } from './bodies/look';
import { AimLane, FallingStone, FollowMark, HoldRing, LavaPool, LightPillar, ShadowFloor, SunOrb, WaveRing } from './fx';
import { STAND_COLOR } from './script';
import { stageMove } from './stage';
import type { AimContext, BossCast, BossDef, BossMove, BossPhase, Objective, PlayContext, PlayedMove, Threat } from './types';

const LAVA = 0xe0601a;
const EMBER_COLOR = 0xff7a2a;
const ROCK = 0x8a6a50;
const C = { x: RING.x, z: RING.z };
/** The two of them, by their place in `forms`. */
const ASH = 0, EMBER = 1;
const NUMBERS = RAID_BOSSES.ash;

/**
 * The room the two fight in, as their moves need it: the Cinder Pit for two, or a party's pit split by a wall of fire (Twin
 * Flames, src/arenas/twinpit.ts). One set of moves, made for each (`movesFor`), so the pit for two plays as it always did.
 */
interface Room {
  /** The middle of the floor, and how far it reaches (m). */
  c: { x: number; z: number };
  r: number;
  /** The pillars Ash's Charge breaks, and the room's cover list they are in. */
  pillars: readonly Obstacle[];
  obstacles: readonly Obstacle[];
  /** Where each of the two is at home: its stage, its vent. For two, both the middle. */
  home: [{ x: number; z: number }, { x: number; z: number }];
  /** How far a home is from the furthest floor of its own part of the room (m): what a wave from it has to cover. */
  reach: number;
  /** Twin Flames: the wall of fire. While it stands, each one's moves stop at it. */
  wall?: Obstacle;
  /** How many heroes one of them faces: 2, or half a party's band. */
  heads: number;
  /** Drag Under's ring burns from 4.5 m to this far from him (m), or to the room's far edge. */
  dragOuter?: number;
  /** How fast Ember's wave grows (m/s). */
  waveSpeed: number;
  /** How far from its home a stage's adds stand, and where the lava rises to, step by step (m from the middle). */
  addRing: number;
  lava: number[];
}

const atTarget = (c: AimContext) => ({ x: c.target.x, z: c.target.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) });

/** The wall of fire stands (it is in the cover now). */
const wallUp = (room: Room, cover: readonly Obstacle[]) => !!room.wall && cover.includes(room.wall);

/** The cut a look of boss `which` stops at while the wall stands: its own side of it. */
function clipOf(room: Room, cover: readonly Obstacle[], which: number): TelegraphClip | null {
  if (!room.wall || !wallUp(room, cover)) return null;
  const n = which === ASH ? -1 : 1;
  return { nx: n, nz: 0, d: -n * room.wall.ax };
}

/** How far from (x, z) along yaw `dir` the floor goes: to the rim, or to the wall of fire while it stands. */
function toRim(room: Room, cover: readonly Obstacle[], x: number, z: number, dir: number) {
  const dx = Math.sin(dir), dz = Math.cos(dir), px = x - room.c.x, pz = z - room.c.z;
  const b = px * dx + pz * dz, k = px * px + pz * pz - room.r * room.r;
  let far = -b + Math.sqrt(Math.max(0, b * b - k));
  const w = room.wall;
  if (w && wallUp(room, cover) && Math.abs(dx) > 1e-6) {
    // Its near face, from whichever side this starts on.
    const face = w.ax + (x < w.ax ? -w.r : w.r), t = (face - x) / dx;
    if (t >= 0) far = Math.min(far, t);
  }
  return far;
}

/** A puddle where something burned: it hurts while it lasts, and nothing warns of it but its look. */
function puddle(p: PlayContext, x: number, z: number, radius: number, from: number, to: number, share: number) {
  const pool = new LavaPool(x, z, radius);
  p.group.add(pool.mesh);
  const th: Threat = { shape: { kind: 'circle', x, z, radius }, at: from, to, every: 1, share, hidden: true, look: 0.4 };
  return { th, pool };
}

/**
 * The Charge: how long he winds up (s, at tier 1), how long his run takes (s), how wide it is (m). The wind-up is a hero's time to reach the far
 * side of a pillar from anywhere: with four of them 90 degrees apart, up to 15 m from the rim at 4 m/s, after a moment to see it.
 */
const CHARGE_WIND = 4.5;
const CHARGE_RUN = 0.45;
const CHARGE_W = 2.8;
/**
 * When the first Charge comes (s into the fight, at tier 1), and how often after, while he is in the ring: he is there about half
 * of a fight, so a slow fight runs out of pillars (pipeline/designs/raid-noonfall.md).
 */
const CHARGE_FIRST = 6;
const CHARGE_EVERY = 14;
/** He crashes into a pillar whose middle his run passes within its radius and this much more (m): part of his body's width. */
const CRASH_PAD = 0.5;
/** He stops this far short of where his run meets a pillar (m), so his body is up against it. */
const CRASH_SHORT = 1;
/** The Charge's colour: hotter than a zone's pale orange, for what kills. */
const CHARGE_COLOR = 0xff5a26;

/** The first of the pillars still standing on the way from a to b, `pad` thicker each (m): how far along (0..1), and which. */
function firstPillar(room: Room, cover: readonly Obstacle[], ax: number, az: number, bx: number, bz: number, pad: number) {
  const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
  let best: { t: number; i: number } | null = null;
  room.pillars.forEach((o, i) => {
    if (!cover.includes(o)) return;
    const R = o.r + pad, fx = ax - o.ax, fz = az - o.az, b = fx * dx + fz * dz, c = fx * fx + fz * fz - R * R;
    let t = 0;
    if (c > 0) {
      const disc = b * b - len2 * c;
      if (disc < 0 || len2 === 0) return;
      t = (-b - Math.sqrt(disc)) / len2;
      if (t < 0 || t > 1) return;
    }
    if (!best || t < best.t) best = { t, i };
  });
  return best as { t: number; i: number } | null;
}

/** Whether a pillar still standing hides (x, z) from (fx, fz): a Charge from there at you would crash into it. */
const behindPillar = (room: Room, cover: readonly Obstacle[], fx: number, fz: number, x: number, z: number) => !!firstPillar(room, cover, fx, fz, x, z, 0);

/** Where a Charge from (x, z) along `dir` ends: up against the first pillar in its way, or at the rim (or the wall of fire). */
function chargeEnd(room: Room, cover: readonly Obstacle[], x: number, z: number, dir: number) {
  const full = toRim(room, cover, x, z, dir), ex = x + Math.sin(dir) * full, ez = z + Math.cos(dir) * full;
  const hit = firstPillar(room, cover, x, z, ex, ez, CRASH_PAD);
  const len = hit ? Math.max(0, full * hit.t - CRASH_SHORT) : Math.max(0, full - 1.4);
  return { x: x + Math.sin(dir) * len, z: z + Math.cos(dir) * len, len, pillar: hit ? hit.i : -1 };
}

/** The wind-up: where he will run, following the one he fixed on, and the floor the pillars hide, in gold. */
function chargeWind(room: Room, c: BossCast, p: PlayContext, standing: () => readonly Obstacle[]): PlayedMove {
  const at = p.shown(CHARGE_WIND);
  p.hint(room.pillars.some((o) => standing().includes(o)) ? 'Charge: get a pillar between you and Ash' : 'No pillar left to stop his Charge');
  // For an AI only: everywhere his run could reach, which is everywhere a pillar doesn't hide from him.
  const warn: Threat = {
    shape: { kind: 'circle', x: room.c.x, z: room.c.z, radius: room.r }, at, share: 0, warn: true, hidden: true, look: at + 1,
    hits: (x, z) => !behindPillar(room, standing(), c.fx, c.fz, x, z),
  };
  const lane = new AimLane(CHARGE_COLOR), mark = new FollowMark(1.1, CHARGE_COLOR);
  const shade = new ShadowFloor({ x: c.fx, z: c.fz }, () => room.pillars.filter((o) => standing().includes(o)), STAND_COLOR, room.r, clipOf(room, standing(), ASH));
  const glows = room.pillars.map((o) => new LightPillar(o.ax, o.az, o.r + 0.35, 5, PILLAR_GLASS));
  p.group.add(lane.mesh, mark.mesh, shade.mesh, ...glows.map((g) => g.mesh));
  p.show.charge(c.fx, 3.2, c.fz, at, CHARGE_COLOR, 2.4);
  let raked = 0;
  return {
    threats: [warn], duration: at + 0.1,
    look: {
      update(t, dt) {
        const k = Math.min(1, t / at), hero = p.heroAt(c.target) ?? { x: c.x, z: c.z };
        const dir = Math.atan2(hero.x - c.fx, hero.z - c.fz), end = chargeEnd(room, standing(), c.fx, c.fz, dir);
        // Quicker as he is about to go.
        const pulse = 0.75 + 0.25 * Math.sin(t * (6 + 14 * k));
        lane.set(c.fx, c.fz, dir, end.len, CHARGE_W, (0.35 + 0.55 * k) * pulse, t);
        mark.place(hero.x, hero.z, (0.45 + 0.5 * k) * pulse);
        shade.update(t, 0.22 + 0.2 * k);
        glows.forEach((g, i) => { g.opacity = i === end.pillar ? 0.55 * pulse : 0; });
        // He rakes the floor: dust and embers kicked back off his fists.
        raked += dt;
        if (raked > 0.28) {
          raked = 0;
          p.sparks.emit(c.fx - Math.sin(dir) * 1.6, 0.2, c.fz - Math.cos(dir) * 1.6, 7, 3, 2, 0.5, ROCK);
        }
      },
      dispose() {
        lane.dispose();
        mark.dispose();
        shade.dispose();
        for (const g of glows) g.dispose();
      },
    },
  };
}

/** The run: it kills whoever it reaches on the way, and ends at the rim, or crashes into a pillar and breaks it. */
function chargeRun(room: Room, c: BossCast, p: PlayContext, standing: () => readonly Obstacle[]): PlayedMove {
  // Only what he has run through so far: it reaches you when he does.
  const shapeAt = (t: number): TelegraphShape => {
    const k = Math.min(1, Math.max(0, t / CHARGE_RUN));
    return { kind: 'line', x1: c.fx, z1: c.fz, x2: c.fx + (c.x - c.fx) * k, z2: c.fz + (c.z - c.fz) * k, width: CHARGE_W };
  };
  const th: Threat = { shape: shapeAt(CHARGE_RUN), shapeAt, at: 0, to: CHARGE_RUN + 0.05, every: 10, share: 1, lethal: true, knock: 3 };
  const len = Math.hypot(c.x - c.fx, c.z - c.fz), lane = new AimLane(CHARGE_COLOR);
  p.group.add(lane.mesh);
  let ended = false, trail = 0;
  // Which pillar he hit: the one he stopped against.
  const pillar = c.flag ? room.pillars.findIndex((o) => standing().includes(o) && Math.hypot(o.ax - c.x, o.az - c.z) <= o.r + CRASH_PAD + CRASH_SHORT + 0.6) : -1;
  return {
    threats: [th], duration: CHARGE_RUN + 1.2,
    look: {
      update(t, dt) {
        const k = Math.min(1, t / CHARGE_RUN);
        lane.set(c.fx, c.fz, c.dir, len * k, CHARGE_W * 1.1, Math.max(0, 1 - Math.max(0, t - CHARGE_RUN) * 1.6), t);
        // A trail of fire and grit behind him.
        trail += dt;
        if (k < 1 && trail > 0.04) {
          trail = 0;
          const x = c.fx + (c.x - c.fx) * k, z = c.fz + (c.z - c.fz) * k;
          p.sparks.emit(x, 0.3, z, 6, 3.5, 2.5, 0.6, LAVA);
          p.glows.flash(x, z, 1.6, LAVA, 0.5, 0.3);
        }
        if (ended || t < CHARGE_RUN) return;
        ended = true;
        if (pillar >= 0) crash(room, c, p, room.pillars[pillar], standing);
        else {
          // The rim: he skids up against the lip.
          p.sparks.emit(c.x, 0.4, c.z, 30, 5, 3, 0.7, LAVA);
          p.show.ring(c.x, c.z, { radius: 4, life: 0.5, color: 0xff8a40, width: 0.5 });
          p.shake(0.06);
        }
      },
      dispose: () => lane.dispose(),
    },
  };
}

/** He crashes into a pillar: it breaks and falls away from him, and he goes down on his knees. */
function crash(room: Room, c: BossCast, p: PlayContext, o: Obstacle, standing: () => readonly Obstacle[]) {
  p.breakCover(room.obstacles.indexOf(o), c.dir);
  p.reward('charge', c.id);
  p.show.shards(o.ax, 1.6, o.az, { count: 22, color: PILLAR_GLASS, speed: 7, life: 1.2, size: 0.24, up: 1.2 });
  p.show.burst(o.ax, 1.2, o.az, 60, 7, 4, 0.9, 0xb8a080);
  p.show.ring(o.ax, o.az, { radius: 7, life: 0.7, color: 0xc8f2ff, width: 0.6 });
  p.show.column(o.ax, o.az, { radius: 1.4, height: 7, life: 0.5, color: PILLAR_GLASS, peak: 0.6 });
  p.glows.flash(o.ax, o.az, 3, PILLAR_GLASS, 0.6, 0.45);
  p.flash('rgba(200,240,255,0.7)', 0.2);
  p.shake(0.14);
  p.say('STUNNED', '#8fe4ff', c.x, c.z);
  if (!room.pillars.some((x) => standing().includes(x))) p.hint('The last pillar is down: nothing stops his Charge now');
}

/** How wide Marked is (m), and how much of a boss's body counts as under it. */
const MARK_R = 2.3;
const MARK_BODY = 1.2;

/** How long a hero must hold the vent (s), how long it stays open (s), and how much longer the lava then waits (s). */
const SEAL_HOLD = 4;
const SEAL_OPEN = 15;
const SEAL_DELAY = 20;

/**
 * Where Falling Star's star glints, from its circle (m), and how long it takes to fall (s): just over the top of the screen, which the
 * camera's steep look down keeps low, so most of its fall shows.
 */
const STAR_FROM = { x: 4, y: 11, z: -5 };
const STAR_FALL = 1.1;

/** Their moves, in `room`. */
function movesFor(room: Room): Record<string, BossMove> {
  const twin = !!room.wall;

  // --- Ash: huge, close, breaks up the floor -----------------------------------------------------------------------

  /** A circle round him. Back away. */
  const slam: BossMove = {
    id: 'slam', name: 'Ground Slam', charge: 1.5, lock: 2, cooldown: 6, range: 7.5, form: ASH, pose: 'slam',
    aim: atTarget,
    play(c, p) {
      const radius = 5, at = p.shown(1.5);
      return {
        threats: [{ shape: { kind: 'circle', x: c.fx, z: c.fz, radius }, at, share: 0.18, knock: 3 }], duration: at + 0.5,
        look: {
          land() {
            for (let k = 0; k < 10; k++) {
              const a = (k / 10) * Math.PI * 2, x = c.fx + Math.sin(a) * radius * 0.7, z = c.fz + Math.cos(a) * radius * 0.7;
              p.sparks.emit(x, 0.3, z, 6, 3.5, 3, 0.6, 0xb8a080);
              p.glows.flash(x, z, 1.6, LAVA, 0.5, 0.35);
            }
          },
        },
      };
    },
  };

  /**
   * Charge (user, 2026-11-08: "charge attack that will target player and player should go behind the pillar, the boss will get
   * stunned and there will be window to dmg him, and if boss hit player it will be one shot, so players must kill him before all
   * pillars are down"). Ash fixes on one hero and rakes the floor; then he runs, through where that hero is then, out to the rim,
   * and kills whatever he runs into. Only one of the pillars stops him: get one between you and him. He crashes into it, it
   * breaks, and he falls to his knees, open (the reward's kneel). It comes on a clock while he is in the ring, so the pillars run
   * out: kill him before they do. The first step only warns (an AI hides from it); the second, when he goes, is aimed by the brain
   * at where the hero is then, and says whether he hit a pillar, so both screens break the same one.
   */
  const charge: BossMove = {
    id: 'charge', name: 'Charge', charge: CHARGE_WIND, lock: CHARGE_WIND + 1, cooldown: CHARGE_EVERY, due: CHARGE_FIRST,
    steps: [0, CHARGE_WIND], chases: true, tracks: true, form: ASH, pose: 'lunge',
    aim(c) {
      const dir = Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z);
      if (c.step === 0) return { x: c.target.x, z: c.target.z, dir };
      const end = chargeEnd(room, c.cover(), c.boss.x, c.boss.z, dir);
      return { x: end.x, z: end.z, dir, flag: end.pillar >= 0 };
    },
    act(world, c) {
      if (c.step !== 1) return 0;
      world.dash(c.x, c.z, CHARGE_RUN);
      // He stands where he stopped until the kneel comes (a pillar), or a moment at the rim.
      return CHARGE_RUN + (c.flag ? 1.2 : 0.8);
    },
    play(c, p) {
      const standing = () => p.cover();
      if (c.step === 0) return chargeWind(room, c, p, standing);
      return chargeRun(room, c, p, standing);
    },
  };

  /** The floor drags you in, then a ring burns far from him. Stay close, then walk out before the next thing. */
  const drag: BossMove = {
    id: 'drag', name: 'Drag Under', charge: 2, lock: 2.4, cooldown: 13, form: ASH, pose: 'channel',
    aim: atTarget,
    play(c, p) {
      const at = p.shown(2), inner = 4.5, reach = room.dragOuter ?? Math.hypot(c.fx - room.c.x, c.fz - room.c.z) + room.r;
      const th: Threat = { shape: { kind: 'ring', x: c.fx, z: c.fz, inner, outer: reach }, at, share: 0.16 };
      return {
        threats: [th], duration: at + 0.4,
        look: {
          update(t, dt) {
            if (t > 0.3 && t < at - 0.4) p.dragMe(c.fx, c.fz, 2.6 * dt);
          },
          land() {
            for (let k = 0; k < 12; k++) {
              const a = (k / 12) * Math.PI * 2, x = c.fx + Math.sin(a) * (inner + 2.5), z = c.fz + Math.cos(a) * (inner + 2.5);
              p.sparks.emit(x, 0.3, z, 5, 3, 3, 0.55, EMBER_COLOR);
            }
          },
        },
      };
    },
  };

  /**
   * Knuckle Quake: both fists hit the floor, and a crack runs from each, crossing where the target stands. Step aside, or in close
   * between them: near him the two cracks are apart.
   */
  const quake: BossMove = {
    id: 'quake', name: 'Knuckle Quake', charge: 1.8, lock: 2.4, cooldown: 9, range: 12, form: ASH, pose: 'slam',
    body: { name: 'quake', seconds: 1.8 },
    aim: atTarget,
    play(c, p) {
      const at = p.shown(1.8), width = 1.8, side = 2.3;
      const px = Math.cos(c.dir), pz = -Math.sin(c.dir);
      const threats: Threat[] = [1, -1].map((sg) => {
        const x1 = c.fx + px * side * sg, z1 = c.fz + pz * side * sg;
        const dir = Math.atan2(c.x - x1, c.z - z1), full = toRim(room, p.cover(), x1, z1, dir);
        const ex = x1 + Math.sin(dir) * full, ez = z1 + Math.cos(dir) * full, k = p.rayStop(x1, z1, ex, ez);
        return { shape: { kind: 'line', x1, z1, x2: x1 + (ex - x1) * k, z2: z1 + (ez - z1) * k, width }, at, share: 0.15 };
      });
      return {
        threats, duration: at + 0.5,
        look: {
          land(th) {
            const s = th.shape;
            if (s.kind !== 'line') return;
            for (let k = 1; k <= 5; k++) {
              const x = s.x1 + (s.x2 - s.x1) * (k / 5), z = s.z1 + (s.z2 - s.z1) * (k / 5);
              p.sparks.emit(x, 0.2, z, 6, 3.5, 3, 0.6, ROCK);
              p.glows.flash(x, z, 1.4, LAVA, 0.45, 0.3);
            }
          },
        },
      };
    },
  };

  /** Lava where he walked. No warning: plan your route. */
  const trail: BossMove = {
    id: 'trail', name: 'Burning Trail', charge: 0, lock: 0, cooldown: 0, alongside: true, quiet: true, form: ASH, pose: 'channel',
    aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: 0 }),
    play(c, p) {
      const { th, pool } = puddle(p, c.x, c.z, 1.2, 0.6, 15, 0.04);
      return { threats: [th], duration: 15.6, look: { update: (t) => pool.update(t, 15), dispose: () => pool.dispose() } };
    },
  };

  /** From the rim: rocks, each where the target stood. */
  const rock: BossMove = {
    id: 'rock', name: 'Cinder Rock', charge: 2.6, lock: 0, cooldown: 7, steps: [0, 0.9], chases: true, form: ASH, pose: 'raise',
    body: { name: 'rock', seconds: 1.7 },
    aim: atTarget,
    play(c, p) {
      const radius = 2.4, at = p.shown(1.7);
      const stone = new FallingStone(c.x, c.z, radius, at);
      p.group.add(stone.mesh);
      return {
        threats: [{ shape: { kind: 'circle', x: c.x, z: c.z, radius }, at, share: 0.12 }], duration: at + 0.9,
        look: {
          update: (t) => stone.update(t),
          land() {
            p.sparks.emit(c.x, 0.2, c.z, 22, 4, 3, 0.7, ROCK);
            p.glows.flash(c.x, c.z, radius, LAVA, 0.6, 0.35);
          },
          dispose: () => stone.mesh.removeFromParent(),
        },
      };
    },
  };

  // --- Ember: quick, from range, makes you the problem ----------------------------------------------------------------

  /** Five lines from her. Stand in a gap. */
  const fan: BossMove = {
    id: 'fan', name: 'Fan', charge: 1.5, lock: 1.9, cooldown: 6, form: EMBER, pose: 'thrust',
    aim: atTarget,
    play(c, p) {
      const at = p.shown(1.5), width = 1.3;
      const threats: Threat[] = [-2, -1, 0, 1, 2].map((k) => {
        const dir = c.dir + k * THREE.MathUtils.degToRad(20), full = toRim(room, p.cover(), c.fx, c.fz, dir);
        const ex = c.fx + Math.sin(dir) * full, ez = c.fz + Math.cos(dir) * full, s = p.rayStop(c.fx, c.fz, ex, ez);
        return { shape: { kind: 'line', x1: c.fx, z1: c.fz, x2: c.fx + (ex - c.fx) * s, z2: c.fz + (ez - c.fz) * s, width }, at, share: 0.14 };
      });
      return {
        threats, duration: at + 0.4,
        look: {
          land(th) {
            const s = th.shape;
            if (s.kind === 'line') {
              p.sparks.emit(s.x2, 0.6, s.z2, 8, 3, 3, 0.5, EMBER_COLOR);
              p.glows.flash((s.x1 + s.x2) / 2, (s.z1 + s.z2) / 2, 2, LAVA, 0.4, 0.25);
            }
          },
        },
      };
    },
  };

  /**
   * A bomb follows one hero, then stops, then lands where it stopped and leaves a puddle. Burn your own: carry it onto whichever of them
   * is in the ring, and it hits them too. The circle that follows is only a look: what counts is the second step, at the spot the
   * brain read, and the brain says in that cast whether the boss stood under it.
   */
  const marked: BossMove = {
    id: 'marked', name: 'Marked', charge: 3.5, lock: 2.6, cooldown: 14, steps: [0, 2.5], form: EMBER, pose: 'point',
    aim(c) {
      const a = atTarget(c);
      return c.step === 1 ? { ...a, flag: Math.hypot(c.ring.x - c.target.x, c.ring.z - c.target.z) <= MARK_R + MARK_BODY } : a;
    },
    play(c, p) {
      const radius = MARK_R;
      if (c.step === 0) {
        p.hint(twin ? 'Carry the mark onto Ember' : 'Carry the mark onto the one in the ring');
        const mark = new FollowMark(radius, EMBER_COLOR);
        p.group.add(mark.mesh);
        const end = p.shown(2.5);
        return {
          threats: [], duration: end,
          look: {
            update(t) {
              const at = p.heroAt(c.target);
              if (at) mark.place(at.x, at.z, 0.4 + 0.5 * (t / end));
            },
            dispose: () => mark.dispose(),
          },
        };
      }
      const at = 1;
      const { th, pool } = puddle(p, c.x, c.z, radius, at + 0.2, at + 9, 0.04);
      return {
        threats: [{ shape: { kind: 'circle', x: c.x, z: c.z, radius }, at, share: 0.18 }, th], duration: at + 9.4,
        look: {
          update: (t) => pool.update(t - at, 9),
          land(hit) {
            if (hit === th) return;
            p.sparks.emit(c.x, 0.3, c.z, 34, 5, 4, 0.8, EMBER_COLOR);
            p.glows.flash(c.x, c.z, radius + 0.5, LAVA, 0.7, 0.5);
            if (c.flag) {
              p.reward('marked', c.id);
              p.show.triumph(c.x, c.z, 0xff9a40);
              p.say('BURNED', '#ffb050', c.x, c.z);
            }
          },
          dispose: () => pool.dispose(),
        },
      };
    },
  };

  /** Lantern Toss: her two lanterns fly out and hang either side of the target, then burst. Stand still between them. */
  const lanterns: BossMove = {
    id: 'lanterns', name: 'Lantern Toss', charge: 1.8, lock: 2.2, cooldown: 10, form: EMBER, pose: 'thrust',
    body: { name: 'lanterns', seconds: 1.8 },
    aim: atTarget,
    play(c, p) {
      const radius = 2.2, at = p.shown(1.8);
      const d = Math.hypot(c.x - c.fx, c.z - c.fz) || 1, px = (c.z - c.fz) / d, pz = -(c.x - c.fx) / d;
      const spots = [1, -1].map((sg) => ({ x: c.x + px * TOSS * sg, z: c.z + pz * TOSS * sg }));
      return {
        threats: spots.map((s) => ({ shape: { kind: 'circle', x: s.x, z: s.z, radius }, at, share: 0.14 })), duration: at + 0.5,
        look: {
          land(th) {
            const s = th.shape;
            if (s.kind !== 'circle') return;
            p.sparks.emit(s.x, 1.2, s.z, 30, 5, 3, 0.8, EMBER_COLOR);
            p.glows.flash(s.x, s.z, radius + 0.4, LAVA, 0.6, 0.45);
          },
        },
      };
    },
  };

  /** Bombs in pairs, either side of the target. Walk between them. */
  const bombs: BossMove = {
    id: 'bombs', name: 'Vent Bombs', charge: 2.9, lock: 2.4, cooldown: 9, steps: [0, 0.7, 1.4], chases: true, form: EMBER, pose: 'raise',
    body: { name: 'bombs', seconds: 1.5 },
    aim: atTarget,
    play(c, p) {
      const radius = 1.9, at = p.shown(1.5), off = 2.7;
      const sx = Math.cos(c.dir) * off, sz = -Math.sin(c.dir) * off;
      const spots = [{ x: c.x + sx, z: c.z + sz }, { x: c.x - sx, z: c.z - sz }];
      return {
        threats: spots.map((s) => ({ shape: { kind: 'circle', x: s.x, z: s.z, radius }, at, share: 0.12 })), duration: at + 0.5,
        look: {
          land(th) {
            const s = th.shape;
            if (s.kind !== 'circle') return;
            p.sparks.emit(s.x, 0.3, s.z, 18, 4, 4, 0.7, EMBER_COLOR);
            p.glows.flash(s.x, s.z, radius, LAVA, 0.5, 0.4);
          },
        },
      };
    },
  };

  /** A ring grows from the vent with one gap, which turns. Walk through the gap. In a party's pit: from Ember's great vent, over her half. */
  const wave: BossMove = {
    id: 'wave', name: 'Lava Wave', charge: 2.5, lock: 3, cooldown: 15, form: EMBER, pose: 'burst',
    aim: () => ({ x: room.home[EMBER].x, z: room.home[EMBER].z, dir: 0 }),
    play(c, p) {
      const V = room.home[EMBER];
      const rng = seeded(c.seed);
      const start = rng() * Math.PI * 2, spin = rng() < 0.5 ? -1 : 1;
      const at = p.shown(2.5), speed = room.waveSpeed, half = 0.6, turn = THREE.MathUtils.degToRad(25), gapHalf = THREE.MathUtils.degToRad(32);
      const end = at + room.reach / speed;
      const radiusAt = (t: number) => (t - at) * speed;
      const gapAt = (t: number) => start + spin * turn * Math.max(0, t - at);
      const hits = (x: number, z: number, t: number) => {
        if (t < at) return false;
        const dx = x - V.x, dz = z - V.z, d = Math.hypot(dx, dz);
        if (Math.abs(d - radiusAt(t)) > half) return false;
        const off = Math.atan2(dx, dz) - gapAt(t);
        return Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > gapHalf;
      };
      const shape: TelegraphShape = { kind: 'circle', x: V.x, z: V.z, radius: room.reach };
      const th: Threat = { shape, at, to: end, every: 10, share: 0.16, hits, look: 1.2 };
      const ring = new WaveRing(V.x, V.z, room.reach + 1, gapHalf, clipOf(room, p.cover(), EMBER));
      p.group.add(ring.mesh);
      return {
        threats: [th], duration: end + 0.4,
        look: {
          update(t) {
            ring.set(t < at ? 1 + (t / at) * 0.8 : radiusAt(t), gapAt(t), half, t < at ? 0.5 + 0.4 * (t / at) : t < end ? 1 : Math.max(0, 1 - (t - end) * 2.5));
          },
          dispose: () => ring.dispose(),
        },
      };
    },
  };

  /**
   * Seal the vent: stand on it, hits or not, and casting stops it. The lava stops rising a while, and the one in the ring staggers.
   * In a party's pit each of the two has one at its home, and sealing either holds the lava back for the whole room.
   */
  const seal = (id: string, who: number): BossMove => ({
    id, name: 'The Vent Opens', charge: 0, lock: 0, cooldown: 0, alongside: true, quiet: true, pose: 'channel',
    aim: () => ({ x: room.home[who].x, z: room.home[who].z, dir: 0 }),
    play(c, p) {
      const radius = 1.8, V = room.home[who];
      const light = new LightPillar(V.x, V.z, radius, 7, STAND_COLOR), ring = new HoldRing(V.x, V.z, radius, STAND_COLOR);
      p.group.add(light.mesh, ring.mesh);
      p.hint('Hold the vent to stop the lava');
      const o: Objective = { part: 0, x: V.x, z: V.z, radius, hold: SEAL_HOLD, until: SEAL_OPEN };
      let sealed = false;
      return {
        threats: [], objectives: [o], duration: SEAL_OPEN + 0.5,
        look: {
          update(t) {
            light.opacity = sealed || t > SEAL_OPEN ? 0 : 0.45 + 0.15 * Math.sin(t * 4);
            ring.set(sealed ? 0 : o.held ?? 0);
          },
          done() {
            sealed = true;
            p.delayLate(SEAL_DELAY);
            p.reward('seal', c.id);
            p.show.triumph(V.x, V.z, 0xffd890, 1.2);
            p.say('SEALED', '#ffe27a', V.x, V.z);
            p.sparks.emit(V.x, 0.4, V.z, 50, 5, 5, 0.9, STAND_COLOR);
            p.cancel(c.id);
          },
          dispose() {
            light.dispose();
            ring.dispose();
          },
        },
      };
    },
  });

  /** One goes up to the rim and the other comes down: a zone where it lands, then the swap, at one moment on both screens. */
  const tag: BossMove = {
    id: 'tag', name: 'Tag', charge: 1.5, lock: 2.1, cooldown: 0, pose: 'slam',
    aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: 0 }),
    play(c, p) {
      const radius = 3.2, at = p.shown(1.5);
      return {
        threats: [{ shape: { kind: 'circle', x: c.x, z: c.z, radius }, at, share: 0.12, knock: 3 }], duration: at + 0.6,
        look: {
          land() {
            p.tag(c.form ?? 0, c.x, c.z, c.fx, c.fz);
            p.sparks.emit(c.x, 0.3, c.z, 40, 6, 5, 0.9, EMBER_COLOR);
            p.glows.flash(c.x, c.z, radius + 1, LAVA, 0.8, 0.55);
          },
        },
      };
    },
  };

  /**
   * Falling Star: Ember calls a star down on you, in a gold circle. Stand in it: alone it costs a tenth, for two 15 % each. Nobody in it, and
   * it costs everyone three times that. A soak: the one move that wants you under it. Hers in the ring only, so it comes from the second phase.
   * For a party: 45 % shared by whoever of her half stands under it (three: 15 % each), or 45 % to each of them if nobody does.
   */
  const fallingStar: BossMove = {
    id: 'star', name: 'Falling Star', charge: 3.2, lock: 3.4, cooldown: 22, form: EMBER, pose: 'raise',
    aim: atTarget,
    play(c, p) {
      const radius = 2.3, at = p.shown(3.2), alone = c.alone ?? p.solo;
      const light = new LightPillar(c.x, c.z, radius, 9, STAND_COLOR);
      // A star glints high in the sky, off to one side, then streaks down and lands in the circle.
      const sky = new THREE.Vector3(c.x + STAR_FROM.x, STAR_FROM.y, c.z + STAR_FROM.z), ground = new THREE.Vector3(c.x, 0.4, c.z);
      const star = new SunOrb(sky.x, sky.y, sky.z);
      p.group.add(light.mesh, star.sprite);
      p.hint('Falling Star: stand under it, together if you can');
      let falling = false;
      return {
        threats: [{ shape: { kind: 'circle', x: c.x, z: c.z, radius }, kind: 'stand', split: true, at, soak: alone ? 0.1 : twin ? 0.45 : 0.3, share: alone ? 0.3 : 0.45, part: 0 }],
        duration: at + 0.6,
        look: {
          update(t) {
            const k = Math.min(1, t / at);
            light.opacity = t < at ? 0.3 + 0.4 * k : Math.max(0, 0.7 * (1 - (t - at) * 2.5));
            star.set(1.6 + 2.4 * k + 0.4 * Math.sin(t * 18), falling ? 0 : 0.35 + 0.6 * k);
            if (!falling && t >= at - STAR_FALL) {
              falling = true;
              p.show.meteor(sky, ground, Math.max(0.2, at - t), { core: 0xfff2d6, glow: 0xff9a3a, size: 2.2, trail: 6 });
            }
          },
          land() {
            // It lands: a column of light, a shockwave, the star's pieces.
            p.show.column(c.x, c.z, { radius: 1.3, height: 12, life: 0.8, color: 0xffe8c8, peak: 0.7 });
            p.show.ring(c.x, c.z, { radius: 7.5, life: 0.8, color: 0xffd8a8, width: 0.7 });
            p.show.shards(c.x, 0.6, c.z, { count: 18, color: 0xff8a40, speed: 6, life: 1.1, size: 0.22, up: 1 });
            p.show.burst(c.x, 0.5, c.z, 50, 6, 5, 0.9, 0xffc070);
            p.glows.flash(c.x, c.z, radius + 0.5, EMBER_COLOR, 0.7, 0.5);
            p.flash('rgba(255,224,180,0.75)', 0.22);
            p.shake(0.08);
          },
          dispose() {
            light.dispose();
            star.dispose();
          },
        },
      };
    },
  };

  /**
   * The stage, Eruption: whoever is in the ring sinks into the vent, in a shell of fire, and can't be hurt; the one on the rim keeps
   * throwing. Three Coal Hearts rise round the vent and lob lava at one hero and then the other. Put them out before the bar fills and the
   * two fall to their knees; if not, the vent erupts over the whole pit, and nothing covers you from it. In a party's pit each of the two
   * has its own, at its home, over its own half: each half puts out its own three.
   */
  const eruption = (id: string, who: number) => stageMove({
    id, name: 'Eruption', pose: 'channel',
    hold: room.home[who], shell: { radius: 2.9, y: 2.4, color: 0xff7030 },
    center: room.home[who], ring: room.addRing, turns: [[0, 120, 240], [60, 180, 300]],
    look: coalHeartLook, color: '#5a3424', shot: 'lob', shotColor: LAVA,
    fail: { share: 0.45, cover: false, radius: room.reach + 1, text: 'THE VENT ERUPTS', blast: 'geyser' },
    // The lava it throws lands on its own side of the wall of fire.
    inside: room.wall ? (x) => (x < room.wall!.ax) === (who === ASH) : undefined,
    win: 'THE FIRE GOES OUT', hint: 'Put out the three Coal Hearts before the bar fills',
  });

  const shared = { slam, charge, drag, quake, trail, rock, fan, marked, bombs, wave, lanterns, star: fallingStar };
  // Ids in letters only: the hub takes no others.
  if (twin) return { ...shared, sealw: seal('sealw', ASH), seale: seal('seale', EMBER), eruptw: eruption('eruptw', ASH), erupte: eruption('erupte', EMBER) };
  return { ...shared, tag, seal: seal('seal', ASH), eruption: eruption('eruption', ASH) };
}

/** Past 5 minutes, or as soon as Together begins, the lava rises from the rim, three steps. Last stand on the shift's own clock at 105 s. */
const lavaRises = (room: Room) => () => {
  const ring = (inner: number) => ({ shape: { kind: 'ring' as const, x: room.c.x, z: room.c.z, inner, outer: room.r }, share: 0.03 });
  const [a, b, c] = room.lava;
  return {
    offset: -255,
    startsAt: 45,
    shift: new ArenaShift('The lava rises', LAVA, '#ff8a40', [
      { at: 45, zones: [ring(a)] }, { at: 65, zones: [ring(b)] }, { at: 85, zones: [ring(c)] },
    ], new ZoneFloor('lava', [{ edge: a }, { edge: b }, { edge: c }], undefined, undefined, room.r), room.r),
  };
};

// --- the two of them --------------------------------------------------------------------------------------------------

function ashPortrait(g: CanvasRenderingContext2D, s: number) {
  const m = s / 2;
  const bg = g.createRadialGradient(m, m, s * 0.05, m, m, m);
  bg.addColorStop(0, '#6a2a10');
  bg.addColorStop(1, '#100806');
  g.fillStyle = bg;
  g.fillRect(0, 0, s, s);
  g.fillStyle = '#ff8a40';
  g.beginPath();
  g.moveTo(m, s * 0.2);
  g.quadraticCurveTo(s * 0.72, s * 0.5, m, s * 0.82);
  g.quadraticCurveTo(s * 0.28, s * 0.5, m, s * 0.2);
  g.fill();
  g.fillStyle = '#2a0e06';
  g.beginPath();
  g.arc(m, s * 0.58, s * 0.13, 0, Math.PI * 2);
  g.fill();
}

const noIcon = () => {};
const noSpell = (key: HeroKey): HeroSpell => ({ key, label: '', name: '', range: 0, cooldown: 0, blurb: '', icon: noIcon });
const kitOf = (name: string, model: string, look: BodyLook, accent: string) => (hp: number) => ({
  name, title: 'Keepers of the Cinder Pit', accent, foil: '#ffc080', portrait: ashPortrait, model, look, maxHp: hp,
  spells: [noSpell('Q'), noSpell('W'), noSpell('E'), noSpell('R')],
} as HeroKit);

/** The Cinder Pit for two. */
const PIT: Room = {
  c: C, r: PIT_R, pillars: PILLARS, obstacles: cinderPitArena.obstacles, home: [C, C], reach: PIT_R, heads: 2, waveSpeed: 5, addRing: 8.5, lava: [12, 10, 8],
};

const FORMS = [
  {
    name: 'Ash', kit: kitOf('Ash', 'models/bosses/ash.glb', ashLook, '#e8703a'), scale: 1, body: { radius: 1.8, height: 5.8 }, speed: 2.3, keepAt: 3.5,
    moves: ['slam', 'charge', 'drag', 'quake'], rimMoves: ['rock'], trail: 'trail',
  },
  {
    name: 'Ember', kit: kitOf('Ember', 'models/bosses/ember.glb', emberLook, '#ff8a40'), scale: 1, body: { radius: 0.9, height: 4 }, speed: 3, keepAt: 9, backAt: 6,
    moves: ['fan', 'marked', 'bombs', 'wave', 'lanterns', 'star'], rimMoves: ['fan', 'bombs'],
  },
];

/** Bodies of their own, posed by `ashLook` and `emberLook`. Built by blender/bosses/boss_bodies.py. */
export const ASH_AND_EMBER: BossDef = {
  id: 'ash',
  name: 'Ash and Ember',
  title: 'Keepers of the Cinder Pit',
  place: cinderPitArena,
  /** The way out stands between two of the rim's perches. */
  gates: { enter: 0, exit: 157.5 },
  starts: { boss: { x: 0, z: -1.5 }, heroes: [{ x: 0, z: 16.5 }, { x: -1.6, z: 16.5 }, { x: 1.6, z: 16.5 }] },
  kit: (hp) => kitOf('Ash and Ember', 'models/bosses/ash.glb', ashLook, '#e8703a')(hp),
  hp: NUMBERS.hp,
  scale: 1,
  body: { radius: 1.8, height: 5.8 },
  speed: 2.3,
  keepAt: 3.5,
  staggerMax: NUMBERS.staggerMax,
  kneel: NUMBERS.kneel,
  phasePause: 2.5,
  forms: FORMS,
  rimSpots: RIM_SPOTS,
  pillars: PILLARS,
  lateAt: 3,
  phases: [
    { name: 'Ash and Ember', at: 1, moves: [], ring: ASH, gap: [2.4, 3.4], rimEvery: [10, 14] },
    { name: 'Ember steps in', at: NUMBERS.phases[0], moves: [], ring: EMBER, gap: [2.2, 3.2], rimEvery: [9, 13] },
    { name: 'Eruption', at: NUMBERS.phases[1], moves: [], ring: EMBER, opener: 'eruption', gap: [2.2, 3.2], rimEvery: [8, 11] },
    { name: 'Together', at: NUMBERS.phases[2], moves: [], gap: [2, 3], rimEvery: [9, 9], swapEvery: 12, timed: { move: 'seal', first: 6, every: 25, most: 2 } },
  ],
  /** A higher tier adds these: Ash throws rocks in the ring too, Ember marks from the rim as well, then her wave. */
  extra: ['rock', 'marked', 'wave'],
  moves: movesFor(PIT),
  /** 2:50 in they enrage: about where the slowest third of the autopilot's wins at a person's pace end (pipeline/designs/raid-noonfall.md). */
  enrage: 170,
  /** Past 5 minutes, or as soon as Together begins, the lava rises. Last stand on the shift's own clock at 105 s. */
  late: lavaRises(PIT),
};

// --- Twin Flames: a party fights both at once -------------------------------------------------------------------------------

/**
 * Twin Flames (user, 2026-11-11, pipeline/designs/raid-party.md): "For a party they both fight at once, one on each side of a wall
 * of fire that splits the room and the party. Their health must fall together: if one is far ahead, the other grows furious."
 *
 * Each of the two is a boss of its own here: its own def, HP, phases, gauge and brain, in its own half of a party's pit
 * (src/arenas/twinpit.ts). No tag and no rim: Ash has his moves among his pillars, Ember hers over her vents, all the time. Each
 * has its own Eruption at half of its own HP and its own vent to seal in Together; the lava rises for the whole room once either
 * is in Together, and sealing either vent holds it back for all. The hub keeps the two HP pools and says who is furious
 * (server/hub.mjs); src/raid/twin.ts makes one screen play both.
 */
const HOME = TWIN_LAYOUT.hold as [{ x: number; z: number }, { x: number; z: number }];
/** From a home to the far corner of its own half, where the wall meets the rim (m). */
const HALF_REACH = Math.hypot(HOME[0].x - C.x, TWIN_R) + 0.5;
const PARTY: Room = {
  c: C, r: TWIN_R, pillars: TWIN_PILLARS, obstacles: twinPitArena(10).obstacles, home: HOME, reach: HALF_REACH, wall: TWIN_WALL, heads: 5,
  dragOuter: 14, waveSpeed: 6.5, addRing: 6.5, lava: [TWIN_R - 6, TWIN_R - 10, TWIN_R - 14],
};
const TWIN_MOVES = movesFor(PARTY);
let twinPlace: ArenaDef = twinPitArena(10);

/** What each of them does from the start, and what the second phase adds. A higher tier's extras go to whose they are. */
const TWIN_KIT = [
  { first: ['slam', 'charge', 'quake'], then: ['drag'], stage: 'eruptw', seal: 'sealw' },
  { first: ['fan', 'bombs', 'lanterns', 'marked'], then: ['wave', 'star'], stage: 'erupte', seal: 'seale' },
];

function twinPhases(which: number): BossPhase[] {
  const k = TWIN_KIT[which], all = [...k.first, ...k.then];
  return [
    { name: 'Twin Flames', at: 1, moves: k.first, gap: [2.4, 3.4] },
    { name: 'The fire rises', at: NUMBERS.phases[0], moves: all, gap: [2.2, 3.2] },
    { name: 'Eruption', at: NUMBERS.phases[1], moves: all, opener: k.stage, gap: [2.2, 3.2] },
    { name: 'Together', at: NUMBERS.phases[2], moves: all, gap: [2, 3], timed: { move: k.seal, first: 6, every: 25, most: 2 } },
  ];
}

function twinDef(which: 0 | 1): BossDef {
  const form = FORMS[which];
  return {
    id: 'ash',
    name: form.name,
    title: 'Keepers of the Cinder Pit',
    get place() { return twinPlace; },
    /** The room for this party: more pillars for more heroes. Set before the fight is built. */
    resize: (band) => {
      twinPlace = twinPitArena(band);
      PARTY.heads = Math.max(2, band / 2);
    },
    gates: { enter: 0, exit: 180 },
    starts: { boss: HOME[which], heroes: [twinHeroStart(which, 0), twinHeroStart(which, 0), twinHeroStart(which, 1)] },
    kit: form.kit,
    hp: NUMBERS.hp,
    scale: form.scale,
    body: form.body,
    speed: form.speed,
    keepAt: form.keepAt,
    backAt: form.backAt,
    trail: form.trail,
    staggerMax: NUMBERS.staggerMax,
    kneel: NUMBERS.kneel,
    phasePause: 2.5,
    pillars: which === ASH ? TWIN_PILLARS : undefined,
    lateAt: 3,
    phases: twinPhases(which),
    extra: ASH_AND_EMBER.extra!.filter((id) => TWIN_MOVES[id]?.form === which && !TWIN_KIT[which].first.includes(id)),
    moves: TWIN_MOVES,
    enrage: ASH_AND_EMBER.enrage,
    late: lavaRises(PARTY),
    twin: { which, pair: () => TWINS, wall: TWIN_WALL, heroStart: twinHeroStart },
  };
}
const TWINS: [BossDef, BossDef] = [twinDef(0), twinDef(1)];

/** Twin Flames' two bosses: Ash (0, the west half) and Ember (1, the east). A party of more than two fights these, both at once. */
export const twinFlames = (which: number): BossDef => TWINS[which === 1 ? 1 : 0];
