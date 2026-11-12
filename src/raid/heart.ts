import * as THREE from 'three';
import { RAID_BOSSES, RAID_PARTY_MAX, raidRing } from '../../server/protocol.mjs';
import { RING, seeded } from '../arenas/common';
import { GlowBeam } from '../arenas/hazards/fx';
import { ArenaShift } from '../arenas/shifts/base';
import { ZoneFloor } from '../arenas/shifts/floor';
import { BURST, BURST_JOINTS, BURST_R, burstAt, rayAngle, spurAngle, sunburstArena } from '../arenas/sunburst';
import { HEART_JOINTS, HEART_R, sunkenHeartArena } from '../arenas/sunkenHeart';
import { TelegraphLayer } from '../effects/telegraph';
import type { HeroKit, HeroKey, HeroSpell } from '../heroes';
import type { Obstacle } from '../obstacles';
import { HEART_LIVE, heartLook, resetHeartLive } from './bodies/heart';
import { HoldRing, LightPillar, ShadowFloor } from './fx';
import { LEAVE_ALPHA, LEAVE_COLOR, STAND_COLOR, STILL_COLOR, STILL_WINDOW } from './script';
import type { AimContext, BossDef, BossMove, Objective, PlayContext, Threat } from './types';

/**
 * The Heart of Noon, the Raid's third boss (pipeline/designs/raid-heart.md): the fallen sun itself, under the hall. It never walks: it
 * floats over the middle of the Sunken Heart and turns to whom it looks at. Its blades are its hands; its three rings come down as beams
 * that turn over the floor; in the last phase its crust falls away as plates, and its Heartbeat burns everything it can see.
 *
 * Its own mechanic, in every phase, for any number of heroes (user, 2026-11-11):
 * - Hold Still: its heart beats in a rhythm the floor shows, white light running in along the floor's rings. On each beat whoever is
 *   walking is burnt; whoever stands still takes nothing. Between beats, run. The rhythm quickens with each phase.
 *
 * Two more, each for one hero or two:
 * - Lock a ring: while the rings turn, three gold spots stand on the rim, one for each. Hold one 2 s and its ring stops for 8 s (its
 *   beam goes out), +40 on the gauge. Each ring is its own cast, so each lock is paid once.
 * - Shade the heart: each Heartbeat throws crust plates out over the floor as gold spots. Hold one 3 s and it stands up as cover, on the
 *   heart's side of the spot. Only cover between you and the heart saves you from the beat.
 */

const C = { x: RING.x, z: RING.z };
const NUMBERS = RAID_BOSSES.heart;

/**
 * A party is in (a band over 2): it fights in the Sunburst (src/arenas/sunburst.ts: a well and eight rays, 35 m to the far corners),
 * and what its mechanics ask grows with the band. Set by `resize` before the fight is built, from the band the hub sends, so it is the
 * same on every screen; a move may read it as it reads the cover. One or two heroes keep the Sunken Heart, and nothing below changes
 * for them. In the Sunburst:
 * - every move reaches the walls: the flare's rings, the beams, the rays, the Heartbeat and the beat of Hold Still;
 * - Solar Flare has four gaps, each over a spur, so one half of every ray stays open;
 * - a ring has more gold spots, in a row down one ray, and locks when all of them are held;
 * - one plate falls for every five heroes, each in front of a spur's nose, and its shade (the pocket from it to the stone) shelters five;
 * - the Crown of Rays fires down four rays and then the four between;
 * - what runs along the floor stops at cover, the fallen armillary's pieces and a raised plate: a ring's beam and the flare's rings.
 *   The Heartbeat doesn't stop at the armillary's pieces: it comes from above, and only a plate stood on edge shades it.
 */
let party = false;
let band = 2;
/** How far its room reaches from it (m). */
const roomR = () => (party ? BURST_R : HEART_R);
const TAU = Math.PI * 2;
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

/** The floor behind a piece of cover, as the Heart sees it: the angle of its middle and how far it reaches to each side (radians), from how far out (m). */
interface Shade { a: number; half: number; d: number }

/** The shade of each piece of cover that is not the room's own wall, from (x, z). For what spreads over the floor from the Heart (the flare's rings). */
function shadesOf(cover: readonly Obstacle[], x: number, z: number): Shade[] {
  const out: Shade[] = [];
  for (const o of cover) {
    if (o.fixed) continue;
    const mid = Math.atan2((o.ax + o.bx) / 2 - x, (o.az + o.bz) / 2 - z);
    let lo = Infinity, hi = -Infinity;
    for (const [px, pz] of [[o.ax, o.az], [o.bx, o.bz]]) {
      const dist = Math.hypot(px - x, pz - z), rel = wrap(Math.atan2(px - x, pz - z) - mid), side = Math.asin(Math.min(1, o.r / Math.max(dist, 0.01)));
      lo = Math.min(lo, rel - side);
      hi = Math.max(hi, rel + side);
    }
    // How near the piece comes: the nearest point of its middle line.
    const sx = o.bx - o.ax, sz = o.bz - o.az, len2 = sx * sx + sz * sz;
    const t = len2 > 0 ? THREE.MathUtils.clamp(((x - o.ax) * sx + (z - o.az) * sz) / len2, 0, 1) : 0;
    out.push({ a: mid + (lo + hi) / 2, half: (hi - lo) / 2, d: Math.hypot(o.ax + sx * t - x, o.az + sz * t - z) });
  }
  return out;
}

/** The most pieces of cover a flare's ring is cut by: the room's eight and a plate in front of each spur. */
const SHADES = 16;

/**
 * How far a beam from (x, z) along yaw `a` gets before cover stops it, at most `max` (m). The room's own walls don't count: the beam
 * ends in the stone anyway. Each piece of cover is a capsule: two round ends and two straight sides.
 */
function beamStop(cover: readonly Obstacle[], x: number, z: number, a: number, max: number) {
  const dx = Math.sin(a), dz = Math.cos(a);
  let best = max;
  for (const o of cover) {
    if (o.fixed) continue;
    for (const [px, pz] of [[o.ax, o.az], [o.bx, o.bz]]) {
      const ex = px - x, ez = pz - z, b = ex * dx + ez * dz, q = b * b - (ex * ex + ez * ez - o.r * o.r);
      if (q < 0) continue;
      const t = b - Math.sqrt(q);
      if (t >= 0 && t < best) best = t;
    }
    const sx = o.bx - o.ax, sz = o.bz - o.az, len = Math.hypot(sx, sz);
    if (len < 1e-6) continue;
    const ux = sx / len, uz = sz / len, nx = -uz, nz = ux, den = dx * nx + dz * nz;
    if (Math.abs(den) < 1e-6) continue;
    const off = (o.ax - x) * nx + (o.az - z) * nz;
    for (const side of [-1, 1]) {
      const t = (off + side * o.r) / den;
      if (t < 0 || t >= best) continue;
      const s = (x + dx * t - o.ax) * ux + (z + dz * t - o.az) * uz;
      if (s >= 0 && s <= len) best = t;
    }
  }
  return best;
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
/**
 * In the Sunburst a ring has four gaps, each lying over a spur (every other spur: the seed says which four), the same for all three
 * rings: four lanes, wide where the party stands to hit the Heart (over 4 m at 6 m from it). A gap is this wide to each side of its
 * spur (degrees), so it reaches over the near half of the ray on either side: in every ray one half stays open and the other burns,
 * and a hero far out in a bay, who could never run to a lane across the room, steps to the right wall. Two gaps there would leave six
 * rays with no way out, and a gap in every ray makes lanes 1 m wide at the Heart.
 */
const FLARE_PARTY_LANES = 4;
const FLARE_PARTY_GAP = 21;
/**
 * How far inside a lane an AI stands there (m). All three rings have the same lanes, so one standing on a lane's very edge, where an
 * AI stops, and stepping over it and back as it fights, took every ring that came while it was over (measured: 1.4 hits a flare
 * against 0.9 in the room for two, whose lanes move on).
 */
const FLARE_PARTY_MARGIN = 0.7;

/** Of an angle, how far it is from the nearest of `lanes` gaps spread evenly round (radians): two opposite each other in the room for two. */
const offLanes = (a: number, lanes: number) => Math.abs(Math.atan2(Math.sin(lanes * a), Math.cos(lanes * a)) / lanes);

const flareVertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const flareFragment = /* glsl */ `
  uniform float uRadius, uHalf, uGap, uGapHalf, uOpacity, uLanes;
  uniform vec3 uShade[16];
  uniform int uShades;
  varying vec2 vP;
  void main() {
    float d = length(vP);
    float band = 1.0 - smoothstep(uHalf * 0.6, uHalf, abs(d - uRadius));
    if (band <= 0.0) discard;
    float at = atan(vP.x, vP.y);
    // Behind a piece of cover the ring is cut: (angle, half its width, how far out it stands).
    for (int i = 0; i < 16; i++) {
      if (i >= uShades) break;
      float off = at - uShade[i].x;
      if (d > uShade[i].z && abs(atan(sin(off), cos(off))) < uShade[i].y) discard;
    }
    // The gaps, spread evenly round (two opposite each other in the room for two): how far this point is from the nearest one.
    float a = at - uGap;
    a = abs(atan(sin(uLanes * a), cos(uLanes * a)) / uLanes);
    float open = 1.0 - smoothstep(uGapHalf - 0.03, uGapHalf + 0.03, a);
    vec3 fire = mix(vec3(0.66, 0.2, 0.03), vec3(0.9, 0.42, 0.08), band);
    vec3 col = mix(fire, vec3(1.0, 0.86, 0.45), open);
    gl_FragColor = vec4(col, band * uOpacity * mix(1.0, 0.45, open));
  }
`;

/** A ring of Solar Flare: fire with gold gaps spread evenly round (two opposite each other, or the Sunburst's four), growing from the heart. */
class FlareRing {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  constructor(x: number, z: number, reach: number, gapHalf: number, lanes: number) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: flareVertex, fragmentShader: flareFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uRadius: { value: 0 }, uHalf: { value: FLARE_HALF }, uGap: { value: 0 }, uGapHalf: { value: gapHalf }, uOpacity: { value: 0 }, uLanes: { value: lanes },
        uShade: { value: Array.from({ length: SHADES }, () => new THREE.Vector3()) }, uShades: { value: 0 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(reach, 96).rotateX(-Math.PI / 2), this.mat);
    this.mesh.position.set(x, 0.07, z);
    this.mesh.renderOrder = 2;
  }

  /** The cover that cuts it (the Sunburst): nothing of it is drawn behind a piece. */
  cut(shades: Shade[]) {
    const u = this.mat.uniforms, n = Math.min(SHADES, shades.length);
    for (let i = 0; i < n; i++) (u.uShade.value as THREE.Vector3[])[i].set(shades[i].a, shades[i].half, shades[i].d);
    u.uShades.value = n;
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
    // The same four rolls in both rooms: a side, how far aside, which way the gaps go round, and how far each time.
    const side = rng() < 0.5 ? -1 : 1, far = rng(), sense = rng() < 0.5 ? -1 : 1, on = rng();
    const pick = (range: number[], u: number) => deg(range[0] + u * (range[1] - range[0]));
    const R = roomR(), lanes = party ? FLARE_PARTY_LANES : 2, gapHalf = deg(party ? FLARE_PARTY_GAP : FLARE_GAP), reach = R + 0.6;
    // The first gap: to one side of the hero it aims at, and each pair a little on from the last. In the Sunburst the gaps lie over
    // four spurs, the same for all three rings, and the seed says which four: lanes that wide are near everyone, so it aims at nobody.
    const first = party ? spurAngle(side > 0 ? 0 : 1) : c.dir + side * pick(FLARE_ASIDE, far);
    const turn = party ? 0 : sense * pick(FLARE_TURN, on);
    const at = p.shown(2.4);
    // In the Sunburst a ring stops at cover: the floor behind a piece, as it stands this frame.
    let shades: Shade[] = party ? shadesOf(p.cover(), c.fx, c.fz) : [];
    const shaded = (d: number, a: number) => shades.some((s) => d > s.d && Math.abs(wrap(a - s.a)) < s.half);
    const flares = Array.from({ length: FLARE_RINGS }, (_, i) => {
      const go = at + i * FLARE_APART, end = go + (reach - BODY_R) / FLARE_SPEED, gap = first + i * turn;
      const radiusAt = (t: number) => BODY_R + (t - go) * FLARE_SPEED;
      const hits = (x: number, z: number, t: number) => {
        if (t < go || t > end) return false;
        const dx = x - c.fx, dz = z - c.fz, d = Math.hypot(dx, dz), a = Math.atan2(dx, dz);
        if (Math.abs(d - radiusAt(t)) > FLARE_HALF) return false;
        return offLanes(a - gap, lanes) > gapHalf && !shaded(d, a);
      };
      // An AI sees the whole of its run at once: a ring grows, and a spot only clear for the next moment is not clear.
      const th: Threat = { shape: { kind: 'circle', x: c.fx, z: c.fz, radius: R }, at: go, to: end, every: 10, share: 0.12, hits, look: end - go + 0.6, margin: party ? FLARE_PARTY_MARGIN : 0 };
      const ring = new FlareRing(c.fx, c.fz, reach + 0.5, gapHalf, lanes);
      p.group.add(ring.mesh);
      return { go, end, gap, radiusAt, th, ring };
    });
    p.hint(party ? 'Solar Flare: four lanes, each over a spur and half of the ray on either side. Get into one, or behind cover' : 'Solar Flare: walk through the gaps');
    return {
      threats: flares.map((f) => f.th), duration: flares[FLARE_RINGS - 1].end + 0.4,
      look: {
        update(t) {
          if (party) shades = shadesOf(p.cover(), c.fx, c.fz);
          flares.forEach((f, i) => {
            if (party) f.ring.cut(shades);
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
 * In the Sunburst a ring has a gold spot for every ten heroes the fight is tuned for, in a row down one ray, and locks when all of
 * them are held (one hero may hold them one after another). The three rings' rays, counted on from the first (which the seed picks);
 * where a row's first spot stands along its ray (m, just past the fallen armillary's piece), and how far apart the spots are.
 */
const lockSpots = () => (party ? Math.max(1, Math.round(band / 10)) : 1);
const LOCK_RAYS = [0, 3, 5];
const LOCK_ALONG = 23.5;
const LOCK_APART = 3;

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
    const base = rng() * Math.PI * 2, sense = rng() < 0.5 ? -1 : 1, R = roomR();
    const warm = p.shown(2.5), end = warm + RINGS_RUN;
    /** How far the beam gets at yaw `a`: to the wall, or in the Sunburst to the cover in its way. */
    const reach = (a: number) => (party ? beamStop(p.cover(), c.fx, c.fz, a, R + 0.5) : R + 0.5);
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
      if (along < BODY_R * 0.8 || along > reach(a)) return false;
      return Math.abs(px * Math.cos(a) - pz * Math.sin(a)) <= RING_W / 2;
    };
    const th: Threat = { shape: { kind: 'circle', x: c.fx, z: c.fz, radius: R }, at: warm, to: end, every: 1, share: 0.1, hits, look: 1.2 };
    // Its spot on the rim, between where its beam and the next one start. In the Sunburst: its row of spots down its ray.
    const sa = start + Math.PI / 3, lockRay = (Math.floor((base / TAU) * BURST.rays) + LOCK_RAYS[i]) % BURST.rays;
    const spots = Array.from({ length: lockSpots() }, (_, j) => {
      const at = party ? burstAt(lockRay, LOCK_ALONG + j * LOCK_APART) : { x: C.x + Math.sin(sa) * LOCK_OUT, z: C.z + Math.cos(sa) * LOCK_OUT };
      const light = new LightPillar(at.x, at.z, LOCK_R, 6, STAND_COLOR), held = new HoldRing(at.x, at.z, LOCK_R, STAND_COLOR);
      p.group.add(light.mesh, held.mesh);
      return { ...at, light, held, taken: false };
    });
    const objectives: Objective[] = spots.map((s, j) => ({ part: j, x: s.x, z: s.z, radius: LOCK_R, hold: LOCK_HOLD, until: end - 1, can: () => lockedAt < 0 && time >= warm }));
    const ray = beam(p, CORE, GLOW, 1.4), floor = beam(p, 0xc06a20, 0x7a3208, RING_W * 1.4);
    if (i === 0) p.hint(party && spots.length > 1 ? 'Hold every gold spot of a row to lock its ring' : party ? 'Hold a gold spot out in a ray to lock its ring' : 'Hold a gold spot on the rim to lock its ring');
    const a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
    let shown = start, frozen = start, beamTime = 0;
    const live = HEART_LIVE.rings[i];
    return {
      threats: [th], objectives, duration: end + 1.2,
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
          const far = reach(shown) - 0.2;
          a3.set(c.fx + dx * BODY_R * 0.8, 0.8, c.fz + dz * BODY_R * 0.8);
          b3.set(c.fx + dx * far, 0.6, c.fz + dz * far);
          ray.set(a3, b3, p.camera, beamTime, on, width);
          if (st === 'on' && t >= warm && t < end && Math.random() < dt * 25) p.sparks.emit(b3.x, 0.6, b3.z, 3, 3, 3, 0.5, SPARK);
          a3.y = b3.y = 0.05;
          floor.set(a3, b3, p.camera, beamTime, on * 0.5, RING_W * 1.4, true);
          // A spot: lit while it can be taken, and it stays lit, held, until the last of its row is.
          const open = lockedAt < 0 && t >= warm && t < end - 1;
          spots.forEach((s, j) => {
            s.light.opacity = !open ? 0 : s.taken ? 0.25 : 0.45 + 0.15 * Math.sin(t * 4 + i + j);
            s.held.set(!open ? 0 : s.taken ? 1 : objectives[j].held ?? 0);
          });
        },
        done(o) {
          const s = spots[o.part];
          if (!s || s.taken) return;
          s.taken = true;
          p.sparks.emit(s.x, 0.5, s.z, 36, 4.5, 4, 0.8, STAND_COLOR);
          p.show.beam(new THREE.Vector3(s.x, 0.8, s.z), new THREE.Vector3(c.fx, 2.5, c.fz), { life: 0.6, core: 0xfff0c8, glow: 0xffb050, width: 0.6 });
          const got = spots.filter((x) => x.taken).length;
          if (got < spots.length) {
            p.say(`HELD ${got}/${spots.length}`, '#ffe27a', s.x, s.z);
            return;
          }
          // The last of its row: the ring locks.
          lockedAt = time;
          frozen = shown;
          p.reward('lock', c.id);
          p.show.triumph(s.x, s.z, 0xffd890);
          p.say('RING LOCKED', '#ffe27a', s.x, s.z);
        },
        dispose() {
          live.down = 0;
          live.lit = 1;
          for (const s of spots) {
            s.light.dispose();
            s.held.dispose();
          }
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
/**
 * In the Sunburst: one plate for every five heroes the fight is tuned for, eight at most (one for each spur); how far out a plate's
 * spot is (m): in front of a spur's nose. Its shade is the pocket from the raised plate out to the stone, and it shelters this many:
 * with more in it, what the rest would have taken is shared by all in it (`Threat.most`, counted by the hub as a gold zone is).
 */
const partyPlates = () => Math.min(BURST.rays, Math.max(1, Math.ceil(band / 5)));
const PARTY_PLATE_OUT = 13.5;
const POCKET_END = BURST.well - 0.1;
const POCKET_HOLDS = 5;
/** A pocket with more in it than it shelters says how many, this often (s), while the beat's floor shows: a look, from where the heroes are drawn. */
const POCKET_SAYS = 0.9;

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
    const R = roomR(), count = party ? partyPlates() : PLATES, out = party ? PARTY_PLATE_OUT : PLATE_OUT;
    // In the Sunburst the first plate falls at the spur nearest the hero it looks at (the brain's aim), the rest spread round from it.
    const spur = Math.floor(((((c.dir % TAU) + TAU) % TAU) / TAU) * BURST.rays);
    const raised: (Obstacle | null)[] = Array.from({ length: count }, () => null);
    let time = 0, struck = false;
    // Dark crust with a gold edge: never orange, which on this floor means leave.
    const crust = new THREE.MeshStandardMaterial({ color: 0x2a211c, roughness: 0.72, metalness: 0.3, flatShading: true, emissive: 0xff8a3a, emissiveIntensity: 0 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.36, metalness: 0.85, emissive: 0xffa040, emissiveIntensity: 0.15 });
    const plates = Array.from({ length: count }, (_, k) => {
      const a = party ? spurAngle((spur + Math.round((k * BURST.rays) / count)) % BURST.rays) : base + (k * Math.PI * 2) / PLATES + (rng() - 0.5) * 0.5;
      const x = C.x + Math.sin(a) * out, z = C.z + Math.cos(a) * out;
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
    const shade = new ShadowFloor(source, () => raised.filter((o): o is Obstacle => !!o), STAND_COLOR, party ? POCKET_END : HEART_R);
    p.group.add(shade.mesh);
    p.hint(party ? `Heartbeat: raise the fallen plates. Each shelters ${POCKET_HOLDS}, in the pocket behind it` : 'Heartbeat: hold a fallen plate to raise it, then stand behind it');
    const burnt = { kind: 'ring', x: c.fx, z: c.fz, inner: BODY_R + 0.2, outer: R + 1 } as const;
    // In the Sunburst only a raised plate shelters, and only in its pocket: from the plate out to the stone, as wide as its shade.
    const half = Math.atan(PLATE_R / (out - PLATE_IN));
    const inPocket = (k: number, x: number, z: number) => {
      if (!raised[k]) return false;
      const dx = x - C.x, dz = z - C.z, r = Math.hypot(dx, dz);
      return r >= out - PLATE_IN - 0.3 && r <= POCKET_END && Math.abs(wrap(Math.atan2(dx, dz) - plates[k].a)) <= half;
    };
    const th: Threat = party
      ? {
        shape: burnt, at, share: BEAT_SHARE, look: BEAT_LOOK,
        hits: (x, z) => {
          const r = Math.hypot(x - c.fx, z - c.fz);
          return r >= burnt.inner && r <= burnt.outer && !plates.some((_, k) => inPocket(k, x, z));
        },
      }
      : { shape: burnt, at, show: at - BEAT_LOOK, share: BEAT_SHARE, source, look: BEAT_LOOK };
    const threats = [th];
    let said = 0;
    // A zone with its own rule is not drawn for it: the beat's orange floor, as the room for two shows it.
    const zone = party ? new TelegraphLayer() : null;
    if (zone) {
      zone.set([{ shape: burnt, start: at - BEAT_LOOK, impact: at }], LEAVE_COLOR, LEAVE_ALPHA);
      p.group.add(zone.group);
    }
    return {
      // A pocket's count comes back from the hub after the beat: the cast stays to hear it.
      threats, objectives, duration: at + (party ? 3 : PLATE_AFTER + 0.8),
      look: {
        update(t) {
          time = t;
          zone?.update(t);
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
          // A crowded pocket, in the Sunburst: how many stand in it, over the plate, while there is still time to leave it.
          if (party && t >= at - BEAT_LOOK && t < at && t - said >= POCKET_SAYS) {
            said = t;
            const inside = plates.map(() => 0);
            for (let side = 0; side < RAID_PARTY_MAX; side++) {
              const h = p.heroAt(side);
              if (!h) continue;
              const k = plates.findIndex((_, i) => inPocket(i, h.x, h.z));
              if (k >= 0) inside[k]++;
            }
            plates.forEach((s2, k) => { if (inside[k] > POCKET_HOLDS) p.say(`${inside[k]}/${POCKET_HOLDS}`, '#ffb050', s2.cx, s2.cz); });
          }
        },
        done(o) {
          const s = plates[o.part];
          if (!s || raised[o.part]) return;
          s.up = time;
          // It stands until the same moment after the cast on every screen, whenever this screen heard of it.
          raised[o.part] = p.addStone(s.cx, s.cz, PLATE_R, Math.max(0.3, at + PLATE_AFTER - time));
          // Its pocket, in the Sunburst: a gold zone that counts who stands in it as the beat lands.
          if (party && time < at) {
            const mid = (out - PLATE_IN + POCKET_END) / 2, k = o.part;
            threats.push({
              kind: 'stand', shape: { kind: 'circle', x: C.x + Math.sin(s.a) * mid, z: C.z + Math.cos(s.a) * mid, radius: 1.4 }, at, show: time, share: BEAT_SHARE,
              part: k, most: POCKET_HOLDS, hits: (x, z) => inPocket(k, x, z),
            });
          }
          p.say('RAISED', '#ffe27a', s.x, s.z);
          p.sparks.emit(s.cx, 0.6, s.cz, 30, 4, 4, 0.8, STAND_COLOR);
          p.show.ring(s.cx, s.cz, { radius: 2.4, life: 0.5, color: 0xffd890, width: 0.4 });
        },
        land(landed) {
          // The beat itself, once: a raised plate's pocket lands with it, and is no second beat.
          if (landed !== th) return;
          struck = true;
          p.flash('rgba(255,214,140,0.85)', 0.6);
          p.show.ring(c.fx, c.fz, { radius: R + 2, life: 1.1, color: 0xffd090, width: 1.2 });
          p.show.column(c.fx, c.fz, { radius: BODY_R * 1.2, height: 14, life: 0.8, color: 0xffe0b0, peak: 0.6 });
          p.show.burst(c.fx, 3.5, c.fz, 60, 7, 3, 1, SPARK);
          p.shake(0.12);
        },
        dispose() {
          void struck;
          HEART_LIVE.beat = 0;
          HEART_LIVE.struck = 99;
          shade.dispose();
          if (zone) {
            zone.set([]);
            zone.group.removeFromParent();
          }
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
    const at = p.shown(2.2), apart = 1, width = party ? 4 : 2.4, length = roomR() + 1;
    // In the Sunburst the rays run down the bays: the four of every other ray, the one nearest its aim among them, then the four between.
    const first = party ? rayAngle(Math.round(c.dir / (TAU / BURST.rays))) : c.dir;
    const threats: Threat[] = [];
    for (let wave = 0; wave < 2; wave++) {
      for (let k = 0; k < 4; k++) {
        const a = first + wave * (Math.PI / 4) + (k * Math.PI) / 2, dx = Math.sin(a), dz = Math.cos(a);
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

// --- every phase: Hold Still ----------------------------------------------------------------------------------------------

/**
 * Hold Still's rhythm in each phase: how many beats a run has and how far apart they are (s, at tier 1). It quickens as the heart dies.
 * A move can't see the phase (two screens hear of a phase a moment apart), so each phase has its own move, made from one recipe.
 */
const STILL_RHYTHM = [{ beats: 3, apart: 2.6 }, { beats: 4, apart: 2.1 }, { beats: 5, apart: 1.6 }];
/** How long before a run's first beat the floor says so (s), and what a beat costs a hero who is walking. */
const STILL_FIRST = 3;
const STILL_SHARE = 0.12;
/**
 * The floor turns white this long before a beat (s): a little before the moment that counts (`STILL_WINDOW`), so a hero that stops
 * when it sees the white has stopped in time.
 */
const STILL_CUE = STILL_WINDOW + 0.2;
/** The ring round this screen's hero: where it closes to on the beat, and where it starts from (m). */
const STILL_FEET = [0.95, 2.6];

const stillVertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const stillFragment = /* glsl */ `
  uniform float uJoints[7];
  uniform float uBeat, uNow, uFlash, uOpacity;
  uniform vec3 uColor;
  varying vec2 vP;
  void main() {
    float d = length(vP), a = 0.0;
    for (int k = 0; k < 6; k++) {
      // Each joint between the floor's rings of plates (its own cracks): dark until the moment to stand still, white as the beat strikes.
      float joint = 1.0 - smoothstep(0.03, 0.09, abs(d - uJoints[k]));
      a = max(a, joint * (0.45 * uNow + 0.8 * uFlash));
      // The light running in to it from the next joint out, a fine line: it lands on the joint on the beat.
      float run = 1.0 - smoothstep(0.02, 0.09, abs(d - mix(uJoints[k + 1], uJoints[k], uBeat)));
      a = max(a, run * (0.12 + 0.3 * uBeat * uBeat));
    }
    // The whole floor pales a little as the beat strikes.
    a = max(a, 0.05 * uFlash * step(uJoints[0], d));
    a *= uOpacity;
    if (a <= 0.004) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;
const feetGeo = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2);

/**
 * Hold Still's look, in white (stand still: neither the orange of leave nor the gold of stand here): light runs in along the floor's
 * joints to the heart and lands on them on the beat, wherever on the floor a hero looks; and a ring closes round this screen's own hero,
 * so the beat reads at its feet on a phone that can't see the heart.
 */
class BeatFloor {
  readonly group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private feet: THREE.MeshBasicMaterial[] = [];
  private rings: THREE.Mesh[] = [];
  /** `radius`: how far the room's floor reaches; `joints`: the seven joints of its floor the light lands on and runs between. */
  constructor(x: number, z: number, radius: number, joints: number[]) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: stillVertex, fragmentShader: stillFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uJoints: { value: joints.slice(0, 7) }, uBeat: { value: 0 }, uNow: { value: 0 }, uFlash: { value: 0 }, uOpacity: { value: 0 },
        uColor: { value: new THREE.Color(STILL_COLOR) },
      },
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 96).rotateX(-Math.PI / 2), this.mat);
    floor.position.set(x, 0.06, z);
    floor.renderOrder = 2;
    this.group.add(floor);
    for (let i = 0; i < 2; i++) {
      const m = new THREE.MeshBasicMaterial({ color: STILL_COLOR, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(feetGeo, m);
      ring.renderOrder = 3;
      ring.visible = false;
      this.feet.push(m);
      this.rings.push(ring);
      this.group.add(ring);
    }
  }

  /**
   * `beat`: how far the light has run to the next beat, 0..1. `now`: 1 when it is time to stand still. `flash`: 1 as a beat
   * strikes, falling off. `hero`: where this screen's hero stands, for the ring at its feet.
   */
  set(beat: number, now: number, flash: number, opacity: number, hero: { x: number; z: number } | null) {
    const u = this.mat.uniforms;
    u.uBeat.value = beat;
    u.uNow.value = now;
    u.uFlash.value = flash;
    u.uOpacity.value = opacity;
    this.group.visible = opacity > 0.004;
    // At its feet: a ring that stays, and one that closes onto it on the beat.
    const [inner, outer] = STILL_FEET;
    this.rings.forEach((ring, i) => {
      ring.visible = !!hero;
      if (!hero) return;
      ring.position.set(hero.x, 0.08, hero.z);
      ring.scale.setScalar(i ? outer + (inner - outer) * beat : inner);
      this.feet[i].opacity = opacity * (i ? 0.2 + 0.5 * beat : 0.22 + 0.4 * now + 0.4 * flash);
    });
  }

  dispose() {
    this.group.removeFromParent();
    (this.group.children[0] as THREE.Mesh).geometry.dispose();
    this.mat.dispose();
    for (const m of this.feet) m.dispose();
  }
}

/**
 * Hold Still (user, 2026-11-11: "The heart beats in a slow rhythm you can see on the floor. On the beat, stand still: anyone moving is
 * burnt. Between beats, run. The rhythm speeds up as it dies."). A run of beats, by the clock in every phase (`BossPhase.timed`), on
 * top of whatever else it is doing: it takes no cast bar and doesn't stop it. Each beat burns only a hero that is walking as it
 * lands (`Threat.moving`): each screen judges its own hero, so it is the same for one hero or forty. The whole run is one cast, so
 * its beats can't drift between screens, and it aims at nobody.
 */
const holdStill = (phase: number): BossMove => ({
  id: phase ? `still${phase + 1}` : 'still', name: 'Hold Still', charge: 0, lock: 0, cooldown: 0, alongside: true, quiet: true, pose: 'channel',
  aim: atHeart,
  play(c, p) {
    const { beats, apart } = STILL_RHYTHM[phase];
    const first = p.shown(STILL_FIRST), gap = p.shown(apart);
    const at = Array.from({ length: beats }, (_, i) => first + i * gap), last = at[beats - 1];
    // The whole floor, and drawn by its look: a telegraph's orange would say leave.
    const R = roomR();
    const threats: Threat[] = at.map((t) => ({ shape: { kind: 'circle', x: c.fx, z: c.fz, radius: R + 1 }, at: t, share: STILL_SHARE, moving: true, hidden: true }));
    const floor = new BeatFloor(c.fx, c.fz, R, party ? BURST_JOINTS : HEART_JOINTS);
    p.group.add(floor.group);
    p.hint('Hold Still: stop walking on each white beat');
    p.say('HOLD STILL', '#f2f6ff', c.fx, c.fz + BODY_R + 1.5);
    return {
      threats, duration: last + 0.9,
      look: {
        update(t) {
          const k = at.findIndex((x) => x > t), next = k < 0 ? last : at[k], prev = k < 0 ? last : k > 0 ? at[k - 1] : -99;
          // The light runs in over the last `gap` before each beat, the first one too.
          const beat = k < 0 ? 0 : Math.min(1, Math.max(0, 1 - (next - t) / gap));
          const now = k >= 0 && next - t <= STILL_CUE ? 1 : 0;
          const flash = Math.max(0, 1 - (t - prev) / 0.4);
          const opacity = Math.min(1, t / 0.5) * (t < last ? 1 : Math.max(0, 1 - (t - last) / 0.7));
          floor.set(beat, now, flash, opacity, p.heroAt(p.side));
          HEART_LIVE.fill = k < 0 ? 0 : beat;
          HEART_LIVE.clench = t - prev;
        },
        land() {
          // The beat: it clenches, and its light goes out over the floor.
          p.show.ring(c.fx, c.fz, { radius: R, life: 0.5, color: STILL_COLOR, width: 0.25, peak: 0.4 });
          p.sparks.emit(c.fx, 3.4, c.fz, 12, 3.5, 1.5, 0.5, 0xfff4e0);
          p.shake(0.03);
        },
        dispose() {
          HEART_LIVE.fill = 0;
          HEART_LIVE.clench = 99;
          floor.dispose();
        },
      },
    };
  },
});

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
  /** For two, the Sunken Heart. A party fights in the Sunburst (`raidRing`): set before the fight is built. */
  resize: (b) => {
    band = b;
    party = raidRing('heart', b) > HEART_R;
  },
  get place() { return party ? sunburstArena : sunkenHeartArena; },
  /**
   * For two, out in the lake past the lip: at the floor's edge the way in would stand over the bottom of the screen in so small a
   * room. In the Sunburst, in the passage at the end of the south ray and in the alcove at the end of the north one.
   */
  get gates() { return party ? { enter: 0, exit: 180 } : { enter: 0, exit: 180, r: 16.2 }; },
  /** A party comes in at the far end of the south ray, in rows toward the Heart (`partyStart` in src/duel.ts). */
  get starts() {
    const z = C.z + (party ? BURST.len - 4 : 9.5);
    return { boss: { x: C.x, z: C.z }, heroes: [{ x: C.x, z }, { x: C.x - 1.6, z }, { x: C.x + 1.6, z }] as [{ x: number; z: number }, { x: number; z: number }, { x: number; z: number }] };
  },
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
    // Hold Still comes by the clock in each phase, quicker each time. A new phase's first run waits until the last phase's has ended;
    // in Noon Falls a run falls between two Heartbeats (the first gathers from 2.5 s to 12.5 s into the phase, then every 20 s).
    { name: 'Embers Wake', at: 1, moves: ['sweep', 'fall', 'flare'], gap: [2, 3], timed: { move: 'still', first: 9, every: 21, most: 99 } },
    { name: 'The Rings Turn', at: NUMBERS.phases[0], moves: ['sweep', 'fall', 'flare', 'rings'], opener: 'rings', gap: [2, 3], timed: { move: 'still2', first: 11, every: 20, most: 99 } },
    {
      name: 'Noon Falls', at: NUMBERS.phases[1], moves: ['sweep', 'fall', 'flare', 'rings', 'corona', 'heartbeat'], opener: 'heartbeat', gap: [1.8, 2.8],
      timed: { move: 'still3', first: 13, every: 20, most: 99 },
    },
  ],
  /** A higher tier brings these in from the first phase on, one a tier: the Crown of Rays, then the rings, then the Heartbeat. */
  extra: ['corona', 'rings', 'heartbeat'],
  moves: { sweep: bladeSweep, fall: bladeFall, flare: solarFlare, rings: ringsTurn, heartbeat, corona: crownOfRays, still: holdStill(0), still2: holdStill(1), still3: holdStill(2) },
  /** It enrages 2:45 in: between the Warden's 2:30 and Ash and Ember's 2:50. */
  enrage: 165,
  /** Past 5 minutes the molten floor rises from the rim, and at 6 Last stand ends it. The shift's own clock has Last stand at 105 s. */
  late: () => ({
    offset: -255,
    shift: new ArenaShift('The heart overflows', 0xd08a20, '#ffb050', [
      { at: 45, zones: [{ shape: { kind: 'ring', x: C.x, z: C.z, inner: 6, outer: roomR() }, share: 0.03 }] },
    ], new ZoneFloor('sun', [{ edge: 6 }], undefined, undefined, roomR()), roomR()),
  }),
};
