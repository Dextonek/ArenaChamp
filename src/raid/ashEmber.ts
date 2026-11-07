import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import { RING, seeded } from '../arenas/common';
import { ArenaShift } from '../arenas/shifts/base';
import { ZoneFloor } from '../arenas/shifts/floor';
import { PIT_R, RIM_SPOTS, cinderPitArena } from '../arenas/cinderpit';
import type { TelegraphShape } from '../effects/telegraph';
import type { HeroKit, HeroKey, HeroSpell } from '../heroes';
import { ashLook } from './bodies/ash';
import { emberLook } from './bodies/ember';
import type { BodyLook } from './bodies/look';
import { FallingStone, FollowMark, HoldRing, LavaPool, LightPillar, WaveRing } from './fx';
import { STAND_COLOR } from './script';
import type { AimContext, BossDef, BossMove, Objective, PlayContext, Threat } from './types';

const LAVA = 0xe0601a;
const EMBER_COLOR = 0xff7a2a;
const ROCK = 0x8a6a50;
const C = { x: RING.x, z: RING.z };
/** The two of them, by their place in `forms`. */
const ASH = 0, EMBER = 1;
const NUMBERS = RAID_BOSSES.ash;

const atTarget = (c: AimContext) => ({ x: c.target.x, z: c.target.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) });

/** How far from (x, z) along yaw `dir` the rim is. */
function toRim(x: number, z: number, dir: number) {
  const dx = Math.sin(dir), dz = Math.cos(dir), px = x - C.x, pz = z - C.z;
  const b = px * dx + pz * dz, k = px * px + pz * pz - PIT_R * PIT_R;
  return -b + Math.sqrt(Math.max(0, b * b - k));
}

/** A puddle where something burned: it hurts while it lasts, and nothing warns of it but its look. */
function puddle(p: PlayContext, x: number, z: number, radius: number, from: number, to: number, share: number) {
  const pool = new LavaPool(x, z, radius);
  p.group.add(pool.mesh);
  const th: Threat = { shape: { kind: 'circle', x, z, radius }, at: from, to, every: 1, share, hidden: true, look: 0.4 };
  return { th, pool };
}

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
 * A line to the rim, stopped by cover, and he goes down it. Cover stops him dead: he stands dazed and open. So put cover behind
 * you. Only the brain's screen moves him, and it says in the second step whether he hit something, so both screens agree.
 */
const charge: BossMove = {
  id: 'charge', name: 'Charge', charge: 1.5, lock: 2.2, cooldown: 10, steps: [0, 1.5], form: ASH, pose: 'lunge',
  aim(c) {
    if (c.prev) return c.prev;
    const dir = Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z), full = toRim(c.boss.x, c.boss.z, dir);
    const ex = c.boss.x + Math.sin(dir) * full, ez = c.boss.z + Math.cos(dir) * full;
    const k = c.rayStop(c.boss.x, c.boss.z, ex, ez);
    // He stops a body's width short of what stopped him.
    const len = Math.max(0, full * k - 1.4);
    return { x: c.boss.x + Math.sin(dir) * len, z: c.boss.z + Math.cos(dir) * len, dir, flag: k < 1 };
  },
  act(world, c) {
    if (c.step !== 1) return 0;
    world.dash(c.x, c.z, 0.45);
    return c.flag ? 2 : 0;
  },
  play(c, p) {
    if (c.step === 1) {
      let dazed = false;
      return {
        threats: [], duration: 0.6,
        look: {
          update(t) {
            if (t < 0.45 || !c.flag || dazed) return;
            dazed = true;
            p.exposed(2);
            p.say('DAZED', '#ffb050', c.x, c.z);
            p.sparks.emit(c.x, 1.2, c.z, 30, 5, 4, 0.7, 0xb8a080);
          },
        },
      };
    }
    const at = p.shown(1.5), width = 2.8;
    const th: Threat = { shape: { kind: 'line', x1: c.fx, z1: c.fz, x2: c.x, z2: c.z, width }, at, share: 0.2, knock: 4 };
    return { threats: [th], duration: at + 0.4 };
  },
};

/** The floor drags you in, then a ring burns far from him. Stay close, then walk out before the next thing. */
const drag: BossMove = {
  id: 'drag', name: 'Drag Under', charge: 2, lock: 2.4, cooldown: 13, form: ASH, pose: 'channel',
  aim: atTarget,
  play(c, p) {
    const at = p.shown(2), inner = 4.5, reach = Math.hypot(c.fx - C.x, c.fz - C.z) + PIT_R;
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
      const dir = c.dir + k * THREE.MathUtils.degToRad(20), full = toRim(c.fx, c.fz, dir);
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

/** How wide Marked is (m), and how much of a boss's body counts as under it. */
const MARK_R = 2.3;
const MARK_BODY = 1.2;

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
      p.hint('Carry the mark onto the one in the ring');
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
            p.say('BURNED', '#ffb050', c.x, c.z);
          }
        },
        dispose: () => pool.dispose(),
      },
    };
  },
};

/** Bombs in pairs, either side of the target. Walk between them. */
const bombs: BossMove = {
  id: 'bombs', name: 'Vent Bombs', charge: 2.9, lock: 2.4, cooldown: 9, steps: [0, 0.7, 1.4], chases: true, form: EMBER, pose: 'raise',
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

/** A ring grows from the vent with one gap, which turns. Walk through the gap. */
const wave: BossMove = {
  id: 'wave', name: 'Lava Wave', charge: 2.5, lock: 3, cooldown: 15, form: EMBER, pose: 'burst',
  aim: (c) => ({ x: C.x, z: C.z, dir: 0 }),
  play(c, p) {
    const rng = seeded(c.seed);
    const start = rng() * Math.PI * 2, spin = rng() < 0.5 ? -1 : 1;
    const at = p.shown(2.5), speed = 5, half = 0.6, turn = THREE.MathUtils.degToRad(25), gapHalf = THREE.MathUtils.degToRad(32);
    const end = at + PIT_R / speed;
    const radiusAt = (t: number) => (t - at) * speed;
    const gapAt = (t: number) => start + spin * turn * Math.max(0, t - at);
    const hits = (x: number, z: number, t: number) => {
      if (t < at) return false;
      const dx = x - C.x, dz = z - C.z, d = Math.hypot(dx, dz);
      if (Math.abs(d - radiusAt(t)) > half) return false;
      const off = Math.atan2(dx, dz) - gapAt(t);
      return Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > gapHalf;
    };
    const shape: TelegraphShape = { kind: 'circle', x: C.x, z: C.z, radius: PIT_R };
    const th: Threat = { shape, at, to: end, every: 10, share: 0.16, hits, look: 1.2 };
    const ring = new WaveRing(C.x, C.z, PIT_R + 1, gapHalf);
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

/** How long a hero must hold the vent (s), how long it stays open (s), and how much longer the lava then waits (s). */
const SEAL_HOLD = 4;
const SEAL_OPEN = 15;
const SEAL_DELAY = 20;

/** Seal the vent: stand on it, hits or not, and casting stops it. The lava stops rising a while, and the one in the ring staggers. */
const seal: BossMove = {
  id: 'seal', name: 'The Vent Opens', charge: 0, lock: 0, cooldown: 0, alongside: true, quiet: true, pose: 'channel',
  aim: () => ({ x: C.x, z: C.z, dir: 0 }),
  play(c, p) {
    const radius = 1.8;
    const light = new LightPillar(C.x, C.z, radius, 7, STAND_COLOR), ring = new HoldRing(C.x, C.z, radius, STAND_COLOR);
    p.group.add(light.mesh, ring.mesh);
    p.hint('Hold the vent to stop the lava');
    const o: Objective = { part: 0, x: C.x, z: C.z, radius, hold: SEAL_HOLD, until: SEAL_OPEN };
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
          p.say('SEALED', '#ffe27a', C.x, C.z);
          p.sparks.emit(C.x, 0.4, C.z, 50, 5, 5, 0.9, STAND_COLOR);
          p.cancel(c.id);
        },
        dispose() {
          light.dispose();
          ring.dispose();
        },
      },
    };
  },
};

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
  body: { radius: 1.3, height: 5.8 },
  speed: 2.3,
  keepAt: 3.5,
  staggerMax: NUMBERS.staggerMax,
  kneel: NUMBERS.kneel,
  phasePause: 2.5,
  forms: [
    {
      name: 'Ash', kit: kitOf('Ash', 'models/bosses/ash.glb', ashLook, '#e8703a'), scale: 1, body: { radius: 1.3, height: 5.8 }, speed: 2.3, keepAt: 3.5,
      moves: ['slam', 'charge', 'drag'], rimMoves: ['rock'], trail: 'trail',
    },
    {
      name: 'Ember', kit: kitOf('Ember', 'models/bosses/ember.glb', emberLook, '#ff8a40'), scale: 1, body: { radius: 0.9, height: 4 }, speed: 3, keepAt: 9, backAt: 6,
      moves: ['fan', 'marked', 'bombs', 'wave'], rimMoves: ['fan', 'bombs'],
    },
  ],
  rimSpots: RIM_SPOTS,
  lateAt: 2,
  phases: [
    { name: 'Ash and Ember', at: 1, moves: [], ring: ASH, gap: [2.4, 3.4], rimEvery: [10, 14] },
    { name: 'Ember steps in', at: NUMBERS.phases[0], moves: [], ring: EMBER, gap: [2.2, 3.2], rimEvery: [9, 13] },
    { name: 'Together', at: NUMBERS.phases[1], moves: [], gap: [2, 3], rimEvery: [9, 9], swapEvery: 12, timed: { move: 'seal', first: 6, every: 25, most: 2 } },
  ],
  /** A higher tier adds these: Ash throws rocks in the ring too, Ember marks from the rim as well, then her wave. */
  extra: ['rock', 'marked', 'wave'],
  moves: { slam, charge, drag, trail, rock, fan, marked, bombs, wave, tag, seal },
  /** Past 5 minutes, or as soon as Together begins, the lava rises. Last stand on the shift's own clock at 105 s. */
  late: () => {
    const ring = (inner: number) => ({ shape: { kind: 'ring' as const, x: C.x, z: C.z, inner, outer: PIT_R }, share: 0.03 });
    return {
      offset: -255,
      startsAt: 45,
      shift: new ArenaShift('The lava rises', LAVA, '#ff8a40', [
        { at: 45, zones: [ring(12)] }, { at: 65, zones: [ring(10)] }, { at: 85, zones: [ring(8)] },
      ], new ZoneFloor('lava', [{ edge: 12 }, { edge: 10 }, { edge: 8 }], undefined, undefined, PIT_R), PIT_R),
    };
  },
};
