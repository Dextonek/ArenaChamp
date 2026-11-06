import * as THREE from 'three';
import { RING, seeded } from '../arenas/common';
import { GlowBeam } from '../arenas/hazards/fx';
import { ArenaShift } from '../arenas/shifts/base';
import { ZoneFloor } from '../arenas/shifts/floor';
import type { TelegraphShape } from '../effects/telegraph';
import type { HeroKit, HeroKey, HeroSpell } from '../heroes';
import { FallingStone, LightPillar, NumberMark, ShadowFloor, SunOrb } from './fx';
import { STAND_COLOR } from './script';
import type { AimContext, BossDef, BossMove, PlayContext, Threat } from './types';

const CORE = 0xffc060;
const GLOW = 0xd86a18;
const SPARK = 0xf09030;
/** The ring's middle: the altar, round which his biggest moves turn. */
const C = { x: RING.x, z: RING.z };

/** Aims at the target from where the boss stands. */
const atTarget = (c: AimContext) => ({ x: c.target.x, z: c.target.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) });

/** How far from (x, z) along yaw `dir` the rim is. */
function toRim(x: number, z: number, dir: number) {
  const dx = Math.sin(dir), dz = Math.cos(dir), px = x - C.x, pz = z - C.z;
  const b = px * dx + pz * dz, k = px * px + pz * pz - RING.r * RING.r;
  return -b + Math.sqrt(Math.max(0, b * b - k));
}

const beam = (p: PlayContext, core: THREE.ColorRepresentation, glow: THREE.ColorRepresentation, width: number) => {
  const b = new GlowBeam(core, glow, width);
  p.group.add(b.mesh);
  return b;
};
const dropBeam = (b: GlowBeam) => {
  b.mesh.removeFromParent();
  b.mesh.geometry.dispose();
  (b.mesh.material as THREE.Material).dispose();
};

// --- phase 1, Awake: teaches the language --------------------------------------------------------------------------

/** A cone in front of him. Walk out, or get behind him. */
const stoneSweep: BossMove = {
  id: 'sweep', name: 'Stone Sweep', charge: 1.6, lock: 2.1, cooldown: 6, range: 8.5, pose: 'swing',
  aim: atTarget,
  play(c, p) {
    const radius = 6.5, angle = 120, at = 1.6;
    const th: Threat = { shape: { kind: 'cone', x: c.fx, z: c.fz, radius, angle, dir: c.dir }, at, share: 0.22, knock: 3 };
    return {
      threats: [th], duration: at + 0.5,
      look: {
        land() {
          for (let k = -3; k <= 3; k++) {
            const a = c.dir + (k / 3) * THREE.MathUtils.degToRad(angle / 2), r = radius * 0.8;
            const x = c.fx + Math.sin(a) * r, z = c.fz + Math.cos(a) * r;
            p.sparks.emit(x, 0.3, z, 6, 3, 2.5, 0.6, 0xb8a080);
            p.glows.flash(x, z, 1.4, GLOW, 0.5, 0.3);
          }
        },
      },
    };
  },
};

/** Three stones, each where the target stood at that moment. Keep walking. */
const pillarFall: BossMove = {
  id: 'pillars', name: 'Pillar Fall', charge: 2.9, lock: 2.9, cooldown: 9, steps: [0, 0.7, 1.4], pose: 'raise',
  aim: atTarget,
  play(c, p) {
    const radius = 2.2, at = 1.5;
    const th: Threat = { shape: { kind: 'circle', x: c.x, z: c.z, radius }, at, share: 0.18 };
    const stone = new FallingStone(c.x, c.z, radius, at);
    p.group.add(stone.mesh);
    return {
      threats: [th], duration: at + 0.9,
      look: {
        update: (t) => stone.update(t),
        land() {
          p.sparks.emit(c.x, 0.2, c.z, 26, 4.5, 3, 0.7, 0xb8a080);
          p.glows.flash(c.x, c.z, radius, GLOW, 0.6, 0.35);
        },
        dispose: () => stone.mesh.removeFromParent(),
      },
    };
  },
};

/** A line across the ring through the target's spot, stopped by cover. It cracks the wall it hits. */
const sunRay: BossMove = {
  id: 'ray', name: 'Sun Ray', charge: 2.5, lock: 3, cooldown: 8, pose: 'thrust',
  aim: atTarget,
  play(c, p) {
    const at = 2.5, width = 2, y = 2.6;
    const full = toRim(c.fx, c.fz, c.dir);
    const ex = c.fx + Math.sin(c.dir) * full, ez = c.fz + Math.cos(c.dir) * full;
    const k = p.rayStop(c.fx, c.fz, ex, ez);
    const x2 = c.fx + (ex - c.fx) * k, z2 = c.fz + (ez - c.fz) * k;
    const th: Threat = { shape: { kind: 'line', x1: c.fx, z1: c.fz, x2, z2, width }, at, share: 0.25 };
    const ray = beam(p, CORE, GLOW, 1.6);
    const a = new THREE.Vector3(c.fx, y, c.fz), b = new THREE.Vector3(x2, 0.9, z2);
    let time = 0;
    return {
      threats: [th], duration: at + 0.45,
      look: {
        update(t, dt) {
          time += dt;
          // A thin line while it charges, then the ray itself.
          if (t < at) ray.set(a, b, p.camera, time, 0.15 + 0.5 * (t / at), 0.2);
          else ray.set(a, b, p.camera, time, Math.max(0, 1 - (t - at) / 0.45), 1.6);
        },
        land() {
          p.sparks.emit(x2, 0.9, z2, 22, 4, 3.2, 0.6, SPARK);
          p.glows.flash(x2, z2, 1.8, GLOW, 0.6, 0.4);
          p.crackFirst(c.fx, c.fz, ex, ez);
        },
        dispose: () => dropBeam(ray),
      },
    };
  },
};

// --- phase 2, High Noon: cover becomes the puzzle -------------------------------------------------------------------

/** The whole ring burns. Only cover between you and him is safe, and a screen wall that saved someone falls. He stands open after. */
const noon: BossMove = {
  id: 'noon', name: 'Noon', charge: 4, lock: 9, cooldown: 26, big: true, pose: 'raise',
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: Math.atan2(C.x - c.boss.x, C.z - c.boss.z) }),
  play(c, p) {
    const at = 4, exposed = 5;
    const source = { x: c.fx, z: c.fz };
    const th: Threat = { shape: { kind: 'circle', x: C.x, z: C.z, radius: RING.r + 1 }, at, share: 0.7, source, breaks: true, look: at };
    const shadows = new ShadowFloor(source, () => p.cover(), STAND_COLOR);
    const sun = new SunOrb(c.fx, 7, c.fz);
    p.group.add(shadows.mesh, sun.sprite);
    return {
      threats: [th], duration: at + 1,
      look: {
        update(t) {
          const k = Math.min(1, t / at);
          shadows.update(t, t < at ? 0.2 + 0.35 * k : Math.max(0, 0.55 * (1 - (t - at) * 2)));
          sun.set(2 + 9 * k, t < at ? 0.25 + 0.65 * k * k : Math.max(0, 0.9 * (1 - (t - at) * 1.5)));
        },
        land() {
          p.flash('rgba(255,206,130,0.85)', 0.8);
          p.exposed(exposed);
          p.say('EXPOSED', '#ffb050', c.fx, c.fz);
          p.sparks.emit(c.fx, 6, c.fz, 60, 7, 2, 1, SPARK, 5);
        },
        dispose() {
          shadows.dispose();
          sun.dispose();
        },
      },
    };
  },
};

/** Four wedges round the altar show 1-2-3-4, then fire in that order. Stand next to 1, then step into it once it has fired. */
const sunOrder: BossMove = {
  id: 'order', name: 'Sun Order', charge: 4.9, lock: 4.9, cooldown: 16, pose: 'raise',
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: Math.atan2(C.x - c.boss.x, C.z - c.boss.z) }),
  play(c, p) {
    const rng = seeded(c.seed);
    const start = rng() * Math.PI * 2, spin = rng() < 0.5 ? -1 : 1;
    const first = 2.5, apart = 0.8, radius = RING.r + 1;
    const marks: NumberMark[] = [];
    const threats: Threat[] = [0, 1, 2, 3].map((i) => {
      const dir = start + spin * i * (Math.PI / 2);
      const mark = new NumberMark(String(i + 1), C.x + Math.sin(dir) * 5.6, C.z + Math.cos(dir) * 5.6);
      p.group.add(mark.sprite);
      marks.push(mark);
      return { shape: { kind: 'cone', x: C.x, z: C.z, radius, angle: 90, dir }, at: first + i * apart, share: 0.25 };
    });
    return {
      threats, duration: first + 3 * apart + 0.5,
      look: {
        land(th) {
          const i = threats.indexOf(th);
          marks[i].sprite.visible = false;
          const dir = start + spin * i * (Math.PI / 2);
          for (const r of [3.5, 6.5, 9.5]) {
            const x = C.x + Math.sin(dir) * r, z = C.z + Math.cos(dir) * r;
            p.sparks.emit(x, 0.3, z, 10, 3.5, 3, 0.6, SPARK);
            p.glows.flash(x, z, 2.6, GLOW, 0.55, 0.4);
          }
        },
        dispose: () => marks.forEach((m) => m.dispose()),
      },
    };
  },
};

// --- phase 3, Last Light: everything at once ----------------------------------------------------------------------

/** Near him, far from him, near again. Read and swap. */
const eclipse: BossMove = {
  id: 'eclipse', name: 'Eclipse', charge: 4.8, lock: 4.8, cooldown: 14, steps: [0, 1.6, 3.2], pose: 'burst',
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) }),
  play(c, p) {
    const at = 1.6, near = 5.5;
    const far = c.step === 1;
    const reach = Math.hypot(c.fx - C.x, c.fz - C.z) + RING.r;
    const shape: TelegraphShape = far ? { kind: 'ring', x: c.fx, z: c.fz, inner: near, outer: reach } : { kind: 'circle', x: c.fx, z: c.fz, radius: near };
    return {
      threats: [{ shape, at, share: 0.2 }], duration: at + 0.4,
      look: {
        land() {
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2, r = far ? near + 2.5 : near * 0.7;
            const x = c.fx + Math.sin(a) * r, z = c.fz + Math.cos(a) * r;
            p.sparks.emit(x, 0.3, z, 5, 3, 2.6, 0.55, SPARK);
            p.glows.flash(x, z, 1.8, GLOW, 0.45, 0.28);
          }
        },
      },
    };
  },
};

/** Gold circles on opposite sides: each needs a hero in it when it lands, or the whole ring pays. Alone, one and then the other. */
const anchors: BossMove = {
  id: 'anchors', name: 'Anchors', charge: 3, lock: 6.6, cooldown: 24, steps: [0, 3.5], pose: 'channel',
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: Math.atan2(C.x - c.boss.x, C.z - c.boss.z) }),
  play(c, p) {
    const rng = seeded(c.seed);
    const base = rng() * Math.PI * 2, radius = 2.3, out = 6.2, at = 3;
    const spot = (i: number) => ({ x: C.x + Math.sin(base + i * Math.PI) * out, z: C.z + Math.cos(base + i * Math.PI) * out });
    // Alone each step is one circle. Together the first step is both, and the second does nothing.
    const parts = p.solo ? [c.step] : c.step === 0 ? [0, 1] : [];
    const lights: LightPillar[] = [];
    const threats: Threat[] = parts.map((i) => {
      const s = spot(i);
      const light = new LightPillar(s.x, s.z, radius, 7, STAND_COLOR);
      p.group.add(light.mesh);
      lights.push(light);
      return { shape: { kind: 'circle', x: s.x, z: s.z, radius }, kind: 'stand', at, share: 0.3, part: i };
    });
    return {
      threats, duration: at + 0.5,
      look: {
        update(t) {
          for (const l of lights) l.opacity = t < at ? 0.25 + 0.35 * (t / at) : Math.max(0, 0.6 * (1 - (t - at) * 2));
        },
        land(th) {
          const s = spot(th.part ?? 0);
          p.sparks.emit(s.x, 0.4, s.z, 24, 3, 4, 0.8, STAND_COLOR);
        },
        dispose: () => lights.forEach((l) => l.dispose()),
      },
    };
  },
};

/** A slow ray turns round the altar while other moves go on. Keep ahead of it, or behind cover. */
const walkingSun: BossMove = {
  id: 'walking', name: 'Walking Sun', charge: 2, lock: 0, cooldown: 24, alongside: true, pose: 'channel',
  aim: (c) => ({ x: c.boss.x, z: c.boss.z, dir: 0 }),
  play(c, p) {
    const rng = seeded(c.seed);
    const start = rng() * Math.PI * 2, spin = rng() < 0.5 ? -1 : 1;
    const warm = 2, end = 12, speed = THREE.MathUtils.degToRad(30), width = 1.4, inner = 1.25;
    const angleAt = (t: number) => start + spin * speed * Math.max(0, t - warm);
    // Cover stops the ray: remembered per small turn, because an AI's look ahead asks many times a frame.
    const reach = new Map<number, number>();
    let coverCount = -1;
    const lengthAt = (a: number) => {
      const n = p.cover().length;
      if (n !== coverCount) { reach.clear(); coverCount = n; }
      const key = Math.round(a * 20);
      let k = reach.get(key);
      if (k === undefined) {
        const x1 = C.x + Math.sin(a) * inner, z1 = C.z + Math.cos(a) * inner;
        k = p.rayStop(x1, z1, C.x + Math.sin(a) * RING.r, C.z + Math.cos(a) * RING.r);
        reach.set(key, k);
      }
      return inner + (RING.r - inner) * k;
    };
    const shapeAt = (t: number): TelegraphShape => {
      const a = angleAt(t), len = lengthAt(a);
      return { kind: 'line', x1: C.x + Math.sin(a) * inner, z1: C.z + Math.cos(a) * inner, x2: C.x + Math.sin(a) * len, z2: C.z + Math.cos(a) * len, width };
    };
    const th: Threat = { shape: shapeAt(warm), at: warm, to: end, every: 1, share: 0.15, look: 1.2, shapeAt };
    const ray = beam(p, CORE, GLOW, 1.5), floor = beam(p, 0xc06a20, 0x7a3208, 2.2);
    const a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
    let time = 0;
    return {
      threats: [th], duration: end + 0.4,
      look: {
        update(t, dt) {
          time += dt;
          const a = angleAt(t), len = lengthAt(a), dx = Math.sin(a), dz = Math.cos(a);
          const on = t < warm ? 0.2 + 0.35 * (t / warm) : t < end ? 1 : Math.max(0, 1 - (t - end) / 0.4);
          a3.set(C.x + dx * 0.6, 1.75, C.z + dz * 0.6);
          b3.set(C.x + dx * len, 0.95, C.z + dz * len);
          ray.set(a3, b3, p.camera, time, on, t < warm ? 0.25 : 1.5);
          if (t >= warm && t < end && Math.random() < dt * 30) p.sparks.emit(b3.x, b3.y, b3.z, 3, 3, 3, 0.5, SPARK);
          a3.y = b3.y = 0.05;
          floor.set(a3, b3, p.camera, time, on * 0.55, 2.2, true);
        },
        dispose() {
          dropBeam(ray);
          dropBeam(floor);
        },
      },
    };
  },
};

// --- the boss -------------------------------------------------------------------------------------------------------

/** Draws his portrait: a stone sun. */
function portrait(g: CanvasRenderingContext2D, s: number) {
  const m = s / 2;
  const bg = g.createRadialGradient(m, m, s * 0.05, m, m, m);
  bg.addColorStop(0, '#5a3c1c');
  bg.addColorStop(1, '#120c08');
  g.fillStyle = bg;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = '#ffc060';
  g.lineWidth = s * 0.05;
  g.beginPath();
  g.arc(m, m, s * 0.2, 0, Math.PI * 2);
  g.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(m + Math.cos(a) * s * 0.28, m + Math.sin(a) * s * 0.28);
    g.lineTo(m + Math.cos(a) * s * 0.42, m + Math.sin(a) * s * 0.42);
    g.stroke();
  }
}

const noIcon = () => {};
const noSpell = (key: HeroKey): HeroSpell => ({ key, label: '', name: '', range: 0, cooldown: 0, blurb: '', icon: noIcon });

/** A placeholder until the fight is proven: a hero's model, drawn big. The art comes after a person has played it. */
const MODEL = 'models/heroes/mason_v2.glb';

export const SUN_WARDEN: BossDef = {
  id: 'sun',
  name: 'The Sun Warden',
  title: 'Keeper of the Night Temple',
  arena: 'temple',
  kit: (hp) => ({
    name: 'The Sun Warden', title: 'Keeper of the Night Temple', accent: '#e8a040', foil: '#ffd27a', portrait, model: MODEL, maxHp: hp,
    spells: [noSpell('Q'), noSpell('W'), noSpell('E'), noSpell('R')],
  } as HeroKit),
  hp: { solo: 4000, duo: 6500 },
  scale: 2,
  body: { radius: 1.2, height: 5.4 },
  speed: 2,
  keepAt: 4.5,
  staggerMax: 100,
  kneel: 6,
  phasePause: 2.5,
  phases: [
    { name: 'Awake', at: 1, moves: ['sweep', 'pillars', 'ray'], gap: [1.8, 2.8] },
    { name: 'High Noon', at: 0.7, moves: ['sweep', 'pillars', 'ray', 'noon', 'order'], opener: 'noon', gap: [1.5, 2.4] },
    { name: 'Last Light', at: 0.35, moves: ['sweep', 'pillars', 'ray', 'noon', 'order', 'eclipse', 'anchors', 'walking'], opener: 'walking', gap: [1.2, 2] },
  ],
  moves: { sweep: stoneSweep, pillars: pillarFall, ray: sunRay, noon, order: sunOrder, eclipse, anchors, walking: walkingSun },
  /** Past 5 minutes the temple's sunfire closes in, and at 6 Last stand ends it. The shift's own clock has Last stand at 105 s. */
  late: () => ({
    offset: -255,
    shift: new ArenaShift('The sun comes down', 0xd08a20, '#ffb050', [
      { at: 45, zones: [{ shape: { kind: 'ring', x: C.x, z: C.z, inner: 6, outer: RING.r }, share: 0.03 }] },
    ], new ZoneFloor('sun', [{ edge: 6 }])),
  }),
};

export const BOSSES: Record<string, BossDef> = { sun: SUN_WARDEN };
