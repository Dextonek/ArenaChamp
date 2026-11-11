import * as THREE from 'three';
import { RAID_BOSSES } from '../../server/protocol.mjs';
import { RING, seeded } from '../arenas/common';
import { GlowBeam } from '../arenas/hazards/fx';
import { ArenaShift } from '../arenas/shifts/base';
import { ZoneFloor } from '../arenas/shifts/floor';
import { HEART_R, sunkenHeartArena } from '../arenas/sunkenHeart';
import type { HeroKit, HeroKey, HeroSpell } from '../heroes';
import type { Obstacle } from '../obstacles';
import { HEART_LIVE, heartLook, resetHeartLive } from './bodies/heart';
import { HoldRing, LightPillar, ShadowFloor } from './fx';
import { STAND_COLOR } from './script';
import type { AimContext, BossDef, BossMove, Objective, PlayContext, Threat } from './types';

/**
 * The Heart of Noon, the Raid's third boss (pipeline/designs/raid-heart.md): the fallen sun itself, under the hall. It never walks: it
 * floats over the middle of the Sunken Heart and turns to whom it looks at. Its blades are its hands; its three rings come down as beams
 * that turn over the floor; in the last phase its crust falls away as plates, and its Heartbeat burns everything it can see.
 *
 * Two mechanics, each for one hero or two:
 * - Lock a ring: while the rings turn, three gold spots stand on the rim, one for each. Hold one 2 s and its ring stops for 8 s (its
 *   beam goes out), +40 on the gauge. Each ring is its own cast, so each lock is paid once.
 * - Shade the heart: each Heartbeat throws crust plates out over the floor as gold spots. Hold one 3 s and it stands up as cover, on the
 *   heart's side of the spot. Only cover between you and the heart saves you from the beat.
 */

const C = { x: RING.x, z: RING.z };
const NUMBERS = RAID_BOSSES.heart;
/** How far its body reaches from its middle (m): what its beams and rings start from. */
const BODY_R = 2;
/** The molten gold of its light, and the deeper glow round it. */
const CORE = 0xffd27a;
const GLOW = 0xd8701a;
const SPARK = 0xffb050;
const CRUST = 0x8a6a48;

const atTarget = (c: AimContext) => ({ x: c.target.x, z: c.target.z, dir: Math.atan2(c.target.x - c.boss.x, c.target.z - c.boss.z) });
const atHeart = (c: AimContext) => ({ x: C.x, z: C.z, dir: Math.atan2(c.target.x - C.x, c.target.z - C.z) });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

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

// --- phase 1, Embers Wake ----------------------------------------------------------------------------------------------

/** An arc in front of it: both blades swing across. Walk out, or round behind it. */
const bladeSweep: BossMove = {
  id: 'sweep', name: 'Blade Sweep', charge: 1.7, lock: 2.2, cooldown: 7, range: 8.5, pose: 'swing',
  body: { name: 'sweep', seconds: 1.7 },
  aim: atTarget,
  play(c, p) {
    const radius = 6.8, angle = 130, at = p.shown(1.7);
    return {
      threats: [{ shape: { kind: 'cone', x: c.fx, z: c.fz, radius, angle, dir: c.dir }, at, share: 0.18, knock: 3 }], duration: at + 0.5,
      look: {
        land() {
          for (let k = -3; k <= 3; k++) {
            const a = c.dir + (k / 3) * THREE.MathUtils.degToRad(angle / 2), r = radius * 0.75;
            const x = c.fx + Math.sin(a) * r, z = c.fz + Math.cos(a) * r;
            p.sparks.emit(x, 0.4, z, 6, 3.5, 2.5, 0.6, SPARK);
            p.glows.flash(x, z, 1.4, GLOW, 0.45, 0.3);
          }
        },
      },
    };
  },
};

/** How long Blade Fall's line is, and how wide (m). */
const FALL_LEN = 11;
const FALL_W = 1.9;

/**
 * Blade Fall: one blade and then the other comes down point-first where the hero stands, each a line through that spot, the second
 * across the first. Each step is its own cast, aimed where the hero is then. Keep walking.
 */
const bladeFall: BossMove = {
  id: 'fall', name: 'Blade Fall', charge: 2.6, lock: 2.8, cooldown: 9, steps: [0, 1], chases: true, pose: 'raise',
  body: { name: 'fall', seconds: 1.4 },
  aim: atTarget,
  play(c, p) {
    const at = p.shown(1.4), dir = c.dir + (c.step % 2 ? Math.PI / 2 : 0), h = FALL_LEN / 2;
    const dx = Math.sin(dir) * h, dz = Math.cos(dir) * h;
    return {
      threats: [{ shape: { kind: 'line', x1: c.x - dx, z1: c.z - dz, x2: c.x + dx, z2: c.z + dz, width: FALL_W }, at, share: 0.15, knock: 2 }],
      duration: at + 0.6,
      look: {
        land() {
          p.show.ring(c.x, c.z, { radius: 3.2, life: 0.45, color: 0xffd8a0, width: 0.4 });
          for (let k = -2; k <= 2; k++) {
            const x = c.x + (dx * k) / 2, z = c.z + (dz * k) / 2;
            p.sparks.emit(x, 0.3, z, 7, 3.5, 3, 0.6, SPARK);
            p.glows.flash(x, z, 1.3, GLOW, 0.45, 0.3);
          }
          p.shake(0.04);
        },
      },
    };
  },
};

/**
 * Solar Flare: how many rings, how far apart they leave (s), how fast they run (m/s), how thick (m), how wide each gap is (degrees), and
 * how far round each pair of gaps is from the last (degrees): well under a gap's width, so the gaps make two lanes that drift to one side.
 * The first gap opens this far to one side of the hero it aims at (degrees), so it is a short walk, never one across the room.
 */
const FLARE_RINGS = 3;
const FLARE_APART = 1.6;
const FLARE_SPEED = 5.5;
const FLARE_HALF = 0.6;
const FLARE_GAP = 30;
const FLARE_TURN = [12, 20];
const FLARE_ASIDE = [20, 45];

/** Of an angle, how far it is from the nearer of two gaps opposite each other (radians, 0..π/2). */
const offPair = (a: number) => Math.abs(Math.atan2(Math.sin(2 * a), Math.cos(2 * a)) / 2);

const flareVertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const flareFragment = /* glsl */ `
  uniform float uRadius, uHalf, uGap, uGapHalf, uOpacity;
  varying vec2 vP;
  void main() {
    float d = length(vP);
    float band = 1.0 - smoothstep(uHalf * 0.6, uHalf, abs(d - uRadius));
    if (band <= 0.0) discard;
    // Two gaps, opposite each other: how far this point is from the nearer one.
    float a = atan(vP.x, vP.y) - uGap;
    a = abs(atan(sin(2.0 * a), cos(2.0 * a)) * 0.5);
    float open = 1.0 - smoothstep(uGapHalf - 0.03, uGapHalf + 0.03, a);
    vec3 fire = mix(vec3(0.66, 0.2, 0.03), vec3(0.9, 0.42, 0.08), band);
    vec3 col = mix(fire, vec3(1.0, 0.86, 0.45), open);
    gl_FragColor = vec4(col, band * uOpacity * mix(1.0, 0.45, open));
  }
`;

/** A ring of Solar Flare: fire with two gold gaps opposite each other, growing from the heart. */
class FlareRing {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  constructor(x: number, z: number, reach: number, gapHalf: number) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: flareVertex, fragmentShader: flareFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uRadius: { value: 0 }, uHalf: { value: FLARE_HALF }, uGap: { value: 0 }, uGapHalf: { value: gapHalf }, uOpacity: { value: 0 } },
    });
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(reach, 96).rotateX(-Math.PI / 2), this.mat);
    this.mesh.position.set(x, 0.07, z);
    this.mesh.renderOrder = 2;
  }

  set(radius: number, gap: number, half: number, opacity: number) {
    const u = this.mat.uniforms;
    u.uRadius.value = radius;
    u.uGap.value = gap;
    u.uHalf.value = half;
    u.uOpacity.value = opacity;
    this.mesh.visible = opacity > 0.001;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

/**
 * Solar Flare: rings of fire run out from it, one after another, each with two gold gaps opposite each other, each pair a little further
 * round than the last. Get into a lane the gaps make, and drift along it. The first gap opens to one side of the hero it aims at (the
 * brain's aim), the rest comes from the cast's seed, so both screens draw the same ones.
 */
const solarFlare: BossMove = {
  id: 'flare', name: 'Solar Flare', charge: 2.4, lock: 3.2, cooldown: 13, pose: 'burst',
  aim: atHeart,
  play(c, p) {
    const rng = seeded(c.seed), deg = THREE.MathUtils.degToRad;
    const side = rng() < 0.5 ? -1 : 1, aside = deg(FLARE_ASIDE[0] + rng() * (FLARE_ASIDE[1] - FLARE_ASIDE[0]));
    const turn = (rng() < 0.5 ? -1 : 1) * deg(FLARE_TURN[0] + rng() * (FLARE_TURN[1] - FLARE_TURN[0]));
    const at = p.shown(2.4), first = c.dir + side * aside, gapHalf = deg(FLARE_GAP), reach = HEART_R + 0.6;
    const flares = Array.from({ length: FLARE_RINGS }, (_, i) => {
      const go = at + i * FLARE_APART, end = go + (reach - BODY_R) / FLARE_SPEED, gap = first + i * turn;
      const radiusAt = (t: number) => BODY_R + (t - go) * FLARE_SPEED;
      const hits = (x: number, z: number, t: number) => {
        if (t < go || t > end) return false;
        const dx = x - c.fx, dz = z - c.fz;
        if (Math.abs(Math.hypot(dx, dz) - radiusAt(t)) > FLARE_HALF) return false;
        return offPair(Math.atan2(dx, dz) - gap) > gapHalf;
      };
      // An AI sees the whole of its run at once: a ring grows, and a spot only clear for the next moment is not clear.
      const th: Threat = { shape: { kind: 'circle', x: c.fx, z: c.fz, radius: HEART_R }, at: go, to: end, every: 10, share: 0.12, hits, look: end - go + 0.6 };
      const ring = new FlareRing(c.fx, c.fz, reach + 0.5, gapHalf);
      p.group.add(ring.mesh);
      return { go, end, gap, radiusAt, th, ring };
    });
    p.hint('Solar Flare: walk through the gaps');
    return {
      threats: flares.map((f) => f.th), duration: flares[FLARE_RINGS - 1].end + 0.4,
      look: {
        update(t) {
          flares.forEach((f, i) => {
            // Before it leaves, each ring waits round the heart, nested, showing where its gaps will be.
            if (t < f.go) f.ring.set(BODY_R + 0.35 + i * 0.55, f.gap, 0.22, 0.35 + 0.5 * Math.min(1, t / at));
            else f.ring.set(f.radiusAt(t), f.gap, FLARE_HALF, t < f.end ? 1 : Math.max(0, 1 - (t - f.end) * 2.5));
          });
        },
        land(th) {
          const f = flares.find((x) => x.th === th);
          if (!f) return;
          p.show.ring(c.fx, c.fz, { radius: 4, life: 0.5, color: 0xffc070, width: 0.6 });
          p.sparks.emit(c.fx, 3, c.fz, 24, 5, 2, 0.7, SPARK);
        },
        dispose: () => flares.forEach((f) => f.ring.dispose()),
      },
    };
  },
};

// --- phase 2, The Rings Turn -------------------------------------------------------------------------------------------

/** How long the rings turn as beams (s, after they come down), how wide a beam is (m), and each ring's speed (degrees a second). */
const RINGS_RUN = 15;
const RING_W = 1.3;
const RING_SPEED = [18, 13, 23];
/** Lock a ring: how long a hero holds its spot (s), how long it stays stopped (s), and how long it warns before it burns again (s). */
const LOCK_HOLD = 2;
const LOCK_FOR = 8;
const LOCK_WARN = 0.8;
/** Where a ring's spot stands, from the heart (m), and how wide it is. */
const LOCK_OUT = HEART_R - 1.7;
const LOCK_R = 1.3;

/**
 * The Rings Turn: the three rings come down round its foot and each throws a beam over the floor that turns, each at its own speed.
 * Each ring is its own step and cast, so each has its own gold spot on the rim, and each lock is paid once. A beam's angle depends only
 * on the time since its cast; locking puts it out for 8 s, and it warns before it burns again, so two screens hearing the lock a moment
 * apart still agree on where it is.
 */
const ringsTurn: BossMove = {
  id: 'rings', name: 'The Rings Turn', charge: 2.5, lock: 0, cooldown: 28, steps: [0, 0, 0], alongside: true, pose: 'channel',
  aim: atHeart,
  play(c, p) {
    const i = c.step % 3, rng = seeded(c.seed);
    const base = rng() * Math.PI * 2, sense = rng() < 0.5 ? -1 : 1;
    const warm = p.shown(2.5), end = warm + RINGS_RUN;
    const speed = THREE.MathUtils.degToRad(RING_SPEED[i]) * (i % 2 ? -sense : sense);
    const start = base + (i * Math.PI * 2) / 3;
    const angleAt = (t: number) => start + speed * Math.max(0, t - warm);
    let lockedAt = -1, time = 0;
    /** Out (locked), warning before it burns again, or burning. */
    const state = (t: number) => (lockedAt < 0 || t < lockedAt ? 'on' : t < lockedAt + LOCK_FOR ? 'out' : t < lockedAt + LOCK_FOR + LOCK_WARN ? 'warn' : 'on');
    const hits = (x: number, z: number, t: number) => {
      if (t < warm || t > end || state(t) !== 'on') return false;
      const a = angleAt(t), px = x - c.fx, pz = z - c.fz;
      const along = px * Math.sin(a) + pz * Math.cos(a);
      if (along < BODY_R * 0.8 || along > HEART_R + 0.5) return false;
      return Math.abs(px * Math.cos(a) - pz * Math.sin(a)) <= RING_W / 2;
    };
    const th: Threat = { shape: { kind: 'circle', x: c.fx, z: c.fz, radius: HEART_R }, at: warm, to: end, every: 1, share: 0.1, hits, look: 1.2 };
    // Its spot on the rim, between where its beam and the next one start.
    const sa = start + Math.PI / 3, sx = C.x + Math.sin(sa) * LOCK_OUT, sz = C.z + Math.cos(sa) * LOCK_OUT;
    const o: Objective = { part: 0, x: sx, z: sz, radius: LOCK_R, hold: LOCK_HOLD, until: end - 1, can: () => lockedAt < 0 && time >= warm };
    const light = new LightPillar(sx, sz, LOCK_R, 6, STAND_COLOR), held = new HoldRing(sx, sz, LOCK_R, STAND_COLOR);
    const ray = beam(p, CORE, GLOW, 1.4), floor = beam(p, 0xc06a20, 0x7a3208, RING_W * 1.4);
    p.group.add(light.mesh, held.mesh);
    if (i === 0) p.hint('Hold a gold spot on the rim to lock its ring');
    const a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
    let shown = start, frozen = start, beamTime = 0;
    const live = HEART_LIVE.rings[i];
    return {
      threats: [th], objectives: [o], duration: end + 1.2,
      look: {
        update(t, dt) {
          time = t;
          beamTime += dt;
          const st = state(t), a = angleAt(t);
          // A locked ring stops where it was, then turns back to its beam while it warns.
          if (st === 'out') shown = frozen;
          else if (st === 'warn') shown = frozen + wrap(a - frozen) * Math.min(1, (t - lockedAt - LOCK_FOR) / LOCK_WARN);
          else shown = a;
          live.down = t < warm ? t / warm : t < end ? 1 : Math.max(0, 1 - (t - end));
          live.yaw = shown;
          live.lit = st === 'out' ? 0 : 1;
          const dx = Math.sin(shown), dz = Math.cos(shown);
          const on = t < warm ? 0.15 + 0.4 * (t / warm) : t < end ? (st === 'on' ? 1 : st === 'warn' ? 0.35 : 0) : Math.max(0, 1 - (t - end) / 0.4);
          const width = t < warm || st === 'warn' ? 0.3 : 1.4;
          a3.set(c.fx + dx * BODY_R * 0.8, 0.8, c.fz + dz * BODY_R * 0.8);
          b3.set(c.fx + dx * (HEART_R + 0.3), 0.6, c.fz + dz * (HEART_R + 0.3));
          ray.set(a3, b3, p.camera, beamTime, on, width);
          if (st === 'on' && t >= warm && t < end && Math.random() < dt * 25) p.sparks.emit(b3.x, 0.6, b3.z, 3, 3, 3, 0.5, SPARK);
          a3.y = b3.y = 0.05;
          floor.set(a3, b3, p.camera, beamTime, on * 0.5, RING_W * 1.4, true);
          // The spot: lit while it can be taken.
          const open = lockedAt < 0 && t >= warm && t < end - 1;
          light.opacity = open ? 0.45 + 0.15 * Math.sin(t * 4 + i) : 0;
          held.set(open ? o.held ?? 0 : 0);
        },
        done() {
          lockedAt = time;
          frozen = shown;
          p.reward('lock', c.id);
          p.show.triumph(sx, sz, 0xffd890);
          p.say('RING LOCKED', '#ffe27a', sx, sz);
          p.sparks.emit(sx, 0.5, sz, 36, 4.5, 4, 0.8, STAND_COLOR);
          p.show.beam(new THREE.Vector3(sx, 0.8, sz), new THREE.Vector3(c.fx, 2.5, c.fz), { life: 0.6, core: 0xfff0c8, glow: 0xffb050, width: 0.6 });
        },
        dispose() {
          live.down = 0;
          live.lit = 1;
          light.dispose();
          held.dispose();
          dropBeam(ray);
          dropBeam(floor);
        },
      },
    };
  },
};

// --- phase 3, Noon Falls -----------------------------------------------------------------------------------------------

/** How long the Heartbeat gathers (s, at tier 1), what it costs, and how early an AI sees it (s). */
const BEAT_GATHER = 10;
const BEAT_SHARE = 0.4;
const BEAT_LOOK = 3.5;
/** Shade the heart: how many plates fall, how far out (m), how long their fall takes (s), how long a hero holds one (s). */
const PLATES = 3;
const PLATE_OUT = 6.8;
const PLATE_FALL = 0.9;
const PLATE_HOLD = 3;
/** A raised plate: how wide it is as cover (m), how far toward the heart from its spot it stands (m), and how long after the beat it stays (s). */
const PLATE_R = 1.05;
const PLATE_IN = 1.35;
const PLATE_AFTER = 1;

const plateGeo = new THREE.BoxGeometry(2.3, 0.32, 2.6);
const plateTrimGeo = new THREE.BoxGeometry(2.36, 0.1, 0.14);

/**
 * Heartbeat: every 20 s in the last phase it gathers, and its crust throws plates out over the floor as gold spots. Hold one 3 s and it
 * stands up on the heart's side of its spot. When it beats, the whole floor burns, except behind a raised plate. Each screen raises the
 * plates the hub says were taken, and lays them down at the same time after the cast, so both see the same cover.
 */
const heartbeat: BossMove = {
  id: 'heartbeat', name: 'Heartbeat', charge: BEAT_GATHER, lock: 2.5, cooldown: 20, due: 20, big: true, pose: 'channel',
  aim: atHeart,
  play(c, p) {
    const at = p.shown(BEAT_GATHER), rng = seeded(c.seed), base = rng() * Math.PI * 2, source = { x: c.fx, z: c.fz };
    const raised: (Obstacle | null)[] = Array.from({ length: PLATES }, () => null);
    let time = 0, struck = false;
    // Dark crust with a gold edge: never orange, which on this floor means leave.
    const crust = new THREE.MeshStandardMaterial({ color: 0x2a211c, roughness: 0.72, metalness: 0.3, flatShading: true, emissive: 0xff8a3a, emissiveIntensity: 0 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.36, metalness: 0.85, emissive: 0xffa040, emissiveIntensity: 0.15 });
    const plates = Array.from({ length: PLATES }, (_, k) => {
      const a = base + (k * Math.PI * 2) / PLATES + (rng() - 0.5) * 0.5;
      const x = C.x + Math.sin(a) * PLATE_OUT, z = C.z + Math.cos(a) * PLATE_OUT;
      // Where it stands once raised: between the spot and the heart, facing the heart.
      const cx = x - Math.sin(a) * PLATE_IN, cz = z - Math.cos(a) * PLATE_IN;
      const mesh = new THREE.Mesh(plateGeo, crust), edge = new THREE.Mesh(plateTrimGeo, trim);
      edge.position.set(0, 0.16, 1.3);
      mesh.add(edge);
      mesh.castShadow = true;
      mesh.visible = false;
      const light = new LightPillar(x, z, 1.3, 5, STAND_COLOR), held = new HoldRing(x, z, 1.3, STAND_COLOR);
      p.group.add(mesh, light.mesh, held.mesh);
      return { a, x, z, cx, cz, mesh, light, held, up: -1 };
    });
    const objectives: Objective[] = plates.map((s, k) => ({
      part: k, x: s.x, z: s.z, radius: 1.3, hold: PLATE_HOLD, until: at - 0.3, can: () => !raised[k] && time >= PLATE_FALL,
    }));
    const shade = new ShadowFloor(source, () => raised.filter((o): o is Obstacle => !!o), STAND_COLOR, HEART_R);
    p.group.add(shade.mesh);
    p.hint('Heartbeat: hold a fallen plate to raise it, then stand behind it');
    const th: Threat = { shape: { kind: 'ring', x: c.fx, z: c.fz, inner: BODY_R + 0.2, outer: HEART_R + 1 }, at, show: at - BEAT_LOOK, share: BEAT_SHARE, source, look: BEAT_LOOK };
    return {
      threats: [th], objectives, duration: at + PLATE_AFTER + 0.8,
      look: {
        update(t) {
          time = t;
          HEART_LIVE.beat = t < at ? Math.min(1, t / at) : 0;
          HEART_LIVE.struck = t < at ? 99 : t - at;
          crust.emissiveIntensity = t < at ? 0.04 + 0.06 * (t / at) ** 2 : Math.max(0, 0.1 - (t - at) * 0.2);
          plates.forEach((s, k) => {
            const m = s.mesh;
            if (t < PLATE_FALL) {
              // Thrown off the heart, tumbling, onto its spot.
              const u = t / PLATE_FALL;
              m.visible = true;
              m.position.set(c.fx + (s.x - c.fx) * u, 3.7 * (1 - u) + Math.sin(u * Math.PI) * 3 + 0.16, c.fz + (s.z - c.fz) * u);
              m.rotation.set(u * 5, s.a, u * 3);
            } else if (s.up < 0) {
              m.position.set(s.x, 0.16, s.z);
              m.rotation.set(0, s.a, 0);
            } else {
              // Raised: it stands up on its edge, between the spot and the heart, its face to the heart; it sinks after the beat.
              const u = Math.min(1, (t - s.up) / 0.4), sink = Math.max(0, t - (at + PLATE_AFTER));
              m.position.set(s.x + (s.cx - s.x) * u, 0.16 + u * 1.15 - sink * 2.4, s.z + (s.cz - s.z) * u);
              m.rotation.set(-u * Math.PI / 2, s.a, 0);
            }
            if (t > at + PLATE_AFTER + 0.5) m.visible = false;
            const open = !raised[k] && t >= PLATE_FALL && t < at - 0.3;
            s.light.opacity = open ? 0.45 + 0.15 * Math.sin(t * 4 + k) : 0;
            s.held.set(open ? objectives[k].held ?? 0 : 0);
          });
          // The floor the raised plates shade, in gold, as the beat comes.
          const s = Math.min(1, Math.max(0, (t - (at - BEAT_LOOK)) / BEAT_LOOK));
          shade.update(t, t < at ? 0.15 + 0.4 * s : Math.max(0, 0.55 * (1 - (t - at) * 2)));
          if (t >= PLATE_FALL - 0.05 && t < PLATE_FALL + 0.05) for (const s2 of plates) p.sparks.emit(s2.x, 0.3, s2.z, 4, 3, 2, 0.5, CRUST);
        },
        done(o) {
          const s = plates[o.part];
          if (!s || raised[o.part]) return;
          s.up = time;
          // It stands until the same moment after the cast on every screen, whenever this screen heard of it.
          raised[o.part] = p.addStone(s.cx, s.cz, PLATE_R, Math.max(0.3, at + PLATE_AFTER - time));
          p.say('RAISED', '#ffe27a', s.x, s.z);
          p.sparks.emit(s.cx, 0.6, s.cz, 30, 4, 4, 0.8, STAND_COLOR);
          p.show.ring(s.cx, s.cz, { radius: 2.4, life: 0.5, color: 0xffd890, width: 0.4 });
        },
        land() {
          struck = true;
          p.flash('rgba(255,214,140,0.85)', 0.6);
          p.show.ring(c.fx, c.fz, { radius: HEART_R + 2, life: 1.1, color: 0xffd090, width: 1.2 });
          p.show.column(c.fx, c.fz, { radius: BODY_R * 1.2, height: 14, life: 0.8, color: 0xffe0b0, peak: 0.6 });
          p.show.burst(c.fx, 3.5, c.fz, 60, 7, 3, 1, SPARK);
          p.shake(0.12);
        },
        dispose() {
          void struck;
          HEART_LIVE.beat = 0;
          HEART_LIVE.struck = 99;
          shade.dispose();
          for (const s of plates) {
            s.mesh.removeFromParent();
            s.light.dispose();
            s.held.dispose();
          }
          for (const o of raised) if (o) p.dropStone(o);
          crust.dispose();
          trim.dispose();
        },
      },
    };
  },
};

/** The Crown of Rays: rays out along the floor from it, four and then the four between them. Stand between, then step into where the first fired. */
const crownOfRays: BossMove = {
  id: 'corona', name: 'Crown of Rays', charge: 2.2, lock: 3.6, cooldown: 12, pose: 'burst',
  aim: atHeart,
  play(c, p) {
    const at = p.shown(2.2), apart = 1, width = 2.4, length = HEART_R + 1;
    const threats: Threat[] = [];
    for (let wave = 0; wave < 2; wave++) {
      for (let k = 0; k < 4; k++) {
        const a = c.dir + wave * (Math.PI / 4) + (k * Math.PI) / 2, dx = Math.sin(a), dz = Math.cos(a);
        threats.push({ shape: { kind: 'line', x1: c.fx + dx * BODY_R * 0.8, z1: c.fz + dz * BODY_R * 0.8, x2: c.fx + dx * length, z2: c.fz + dz * length, width }, at: at + wave * apart, share: 0.15, part: wave });
      }
    }
    return {
      threats, duration: at + apart + 0.6,
      look: {
        land(th) {
          const s = th.shape;
          if (s.kind !== 'line') return;
          p.show.beam(new THREE.Vector3(s.x1, 1.2, s.z1), new THREE.Vector3(s.x2, 0.5, s.z2), { life: 0.45, core: 0xfff0c8, glow: 0xe08a30, width: 1.6 });
          p.glows.flash((s.x1 + s.x2) / 2, (s.z1 + s.z2) / 2, 2.2, GLOW, 0.45, 0.3);
          p.sparks.emit(s.x2, 0.5, s.z2, 6, 3, 3, 0.5, SPARK);
        },
      },
    };
  },
};

// --- the boss -------------------------------------------------------------------------------------------------------------

/** Its portrait: a gold face in a molten sun, a ring across it. */
function portrait(g: CanvasRenderingContext2D, s: number) {
  const m = s / 2;
  const bg = g.createRadialGradient(m, m, s * 0.05, m, m, m);
  bg.addColorStop(0, '#ff9a3a');
  bg.addColorStop(0.45, '#6a2a0e');
  bg.addColorStop(1, '#100806');
  g.fillStyle = bg;
  g.fillRect(0, 0, s, s);
  g.fillStyle = '#d8b25a';
  g.beginPath();
  g.ellipse(m, m * 1.02, s * 0.17, s * 0.21, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff0c0';
  g.fillRect(m - s * 0.11, m - s * 0.03, s * 0.08, s * 0.025);
  g.fillRect(m + s * 0.03, m - s * 0.03, s * 0.08, s * 0.025);
  g.strokeStyle = '#ffd27a';
  g.lineWidth = s * 0.035;
  g.beginPath();
  g.ellipse(m, m, s * 0.38, s * 0.14, -0.4, 0, Math.PI * 2);
  g.stroke();
}

const noIcon = () => {};
const noSpell = (key: HeroKey): HeroSpell => ({ key, label: '', name: '', range: 0, cooldown: 0, blurb: '', icon: noIcon });
const MODEL = 'models/bosses/heart.glb';

export const HEART_OF_NOON: BossDef = {
  id: 'heart',
  name: 'The Heart of Noon',
  title: 'The Fallen Sun',
  place: sunkenHeartArena,
  /** Out in the lake past the lip: at the floor's edge the way in would stand over the bottom of the screen in so small a room. */
  gates: { enter: 0, exit: 180, r: 16.2 },
  starts: { boss: { x: C.x, z: C.z }, heroes: [{ x: C.x, z: C.z + 9.5 }, { x: C.x - 1.6, z: C.z + 9.5 }, { x: C.x + 1.6, z: C.z + 9.5 }] },
  kit: (hp) => {
    // A new fight: the rings start up, whatever the last one left.
    resetHeartLive();
    return {
      name: 'The Heart of Noon', title: 'The Fallen Sun', accent: '#ffb84a', foil: '#ffe2a0', portrait, model: MODEL, look: heartLook, maxHp: hp,
      spells: [noSpell('Q'), noSpell('W'), noSpell('E'), noSpell('R')],
    } as HeroKit;
  },
  hp: NUMBERS.hp,
  scale: 1,
  body: { radius: BODY_R, height: 6.4 },
  /** It never walks: it floats over the middle and turns to whom it looks at. */
  speed: 0,
  keepAt: 999,
  staggerMax: NUMBERS.staggerMax,
  kneel: NUMBERS.kneel,
  phasePause: 2.5,
  phases: [
    { name: 'Embers Wake', at: 1, moves: ['sweep', 'fall', 'flare'], gap: [2, 3] },
    { name: 'The Rings Turn', at: NUMBERS.phases[0], moves: ['sweep', 'fall', 'flare', 'rings'], opener: 'rings', gap: [2, 3] },
    { name: 'Noon Falls', at: NUMBERS.phases[1], moves: ['sweep', 'fall', 'flare', 'rings', 'corona', 'heartbeat'], opener: 'heartbeat', gap: [1.8, 2.8] },
  ],
  /** A higher tier brings these in from the first phase on, one a tier: the Crown of Rays, then the rings, then the Heartbeat. */
  extra: ['corona', 'rings', 'heartbeat'],
  moves: { sweep: bladeSweep, fall: bladeFall, flare: solarFlare, rings: ringsTurn, heartbeat, corona: crownOfRays },
  /** It enrages 2:45 in: between the Warden's 2:30 and Ash and Ember's 2:50. */
  enrage: 165,
  /** Past 5 minutes the molten floor rises from the rim, and at 6 Last stand ends it. The shift's own clock has Last stand at 105 s. */
  late: () => ({
    offset: -255,
    shift: new ArenaShift('The heart overflows', 0xd08a20, '#ffb050', [
      { at: 45, zones: [{ shape: { kind: 'ring', x: C.x, z: C.z, inner: 6, outer: HEART_R }, share: 0.03 }] },
    ], new ZoneFloor('sun', [{ edge: 6 }], undefined, undefined, HEART_R), HEART_R),
  }),
};
