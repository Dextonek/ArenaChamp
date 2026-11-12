import * as THREE from 'three';
import { RAID_BOSSES, RAID_PARTY_MAX, raidRing } from '../../server/protocol.mjs';
import { RING, seeded } from '../arenas/common';
import { GlowBeam } from '../arenas/hazards/fx';
import { ArenaShift } from '../arenas/shifts/base';
import { ZoneFloor } from '../arenas/shifts/floor';
import { BURST, BURST_JOINTS, BURST_R, BURST_RINGS, burstAt, burstFloor, inSector, rayAngle, ringOf, spurAngle, sunburstArena, turned } from '../arenas/sunburst';
import { HEART_JOINTS, HEART_R, sunkenHeartArena } from '../arenas/sunkenHeart';
import { TelegraphLayer } from '../effects/telegraph';
import type { HeroKit, HeroKey, HeroSpell } from '../heroes';
import type { Obstacle } from '../obstacles';
import { HEART_LIVE, heartLook, resetHeartLive } from './bodies/heart';
import { HoldRing, LightPillar, ShadowFloor, SunOrb } from './fx';
import { LEAVE_ALPHA, LEAVE_COLOR, STAND_COLOR, STILL_COLOR, STILL_WINDOW } from './script';
import type { AimContext, BossCast, BossDef, BossMove, BossPhase, Objective, PlayContext, PlayedMove, RaidSide, Threat } from './types';

/**
 * The Heart of Noon, the Raid's third boss (pipeline/designs/raid-heart.md): the fallen sun itself, under the hall. It never walks: it
 * floats over the middle of the Sunken Heart and turns to whom it looks at. Its blades are its hands; its three rings come down as beams
 * that turn over the floor; in the last phase its crust falls away as plates, and its Heartbeat burns everything it can see.
 *
 * Its own mechanic, in every phase, for any number of heroes (user, 2026-11-11):
 * - Hold Still: its heart beats in a rhythm the floor shows, white light running in along the floor's rings. On each beat whoever is
 *   walking is burnt; whoever stands still takes nothing. Between beats, run. The rhythm quickens with each phase.
 *
 * For a party, in its own room (the Sunburst), the room changes with its phases and three mechanics come only for a big party
 * (user, 2026-11-12; pipeline/designs/raid-party.md):
 * - The floor turns (`turn`, as The Rings Turn begins): the well is three rings, the inner one stands, the two outer ones turn
 *   against each other and carry whoever stands on them.
 * - The crust falls (`crust`, as Noon Falls begins): after each Heartbeat one ray with its slice of the well glows and drops into
 *   the sun for good.
 * - Shade the Heart together (a fight tuned for 10 or more): a plate for every five heroes standing, each sheltering five; a plate
 *   left lying burns everyone.
 * - Take the Blade (`blade`, 20 or more): it throws its two blades down; who takes one hits twice as hard and is hunted.
 * - The Ring of Hands (`hands`, 40): the whole raid stands in a ring of gold spots round it.
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
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * The party's fight as this screen has it. Only a cast changes it, at a time counted from that cast, so every screen has the same
 * room at the same moment; `resize` clears it before each fight.
 */
export const heartFight = {
  /** The floor turns: the cast's own clock on this screen (s), which way the middle ring goes, and when the rings begin to spin. */
  turning: false,
  clock: 0,
  sense: 1,
  warm: 0,
  /** When the rings begin to stop, on that clock, and when the last of them rests (Infinity: they turn on). */
  stopAt: Infinity,
  restAt: Infinity,
  /** The crust falls: a Heartbeat takes a sector with it. `falling`: the sectors that glow now and are about to go. */
  crust: false,
  falling: new Set<number>(),
  /** Who carries one of its blades: its aim goes to them. */
  carriers: new Set<RaidSide>(),
};

/**
 * Its great mechanics for a big party take turns, with a breath between (the Sun Warden's way, src/raid/wardenHall.ts): Take the
 * Blade (20 or more) and, for 40, The Ring of Hands. On the brain's screen each says when it began (`holdFor`, from its `aim`); for
 * `REST` seconds after it ends neither is in its lists, and then only the one whose turn it is (`nextGreat`). The first waits
 * `GREAT_FIRST` seconds after the floor begins to turn.
 */
export const REST = 14;
const GREAT_FIRST = 9;
const pace = { free: -Infinity, turn: 0 };
let order: string[] = [];
const now = () => performance.now() / 1000;
function holdFor(id: string, seconds: number) {
  pace.free = now() + seconds;
  const i = order.indexOf(id, pace.turn) >= 0 ? order.indexOf(id, pace.turn) : order.indexOf(id);
  if (i >= 0) pace.turn = (i + 1) % order.length;
}
const nextGreat = () => (!order.length || now() < pace.free + REST ? null : order[pace.turn]);

/** The floor turns still: it has begun to, and its rings have not come to rest. */
const floorMoves = () => heartFight.turning && heartFight.clock < heartFight.restAt;

/** A new fight, tuned for `b`: the floor whole and still, nobody carries, the great mechanics start their turns over. */
function resetHeartFight(b: number) {
  order = b >= 40 ? ['blade', 'hands'] : b >= 20 ? ['blade'] : [];
  pace.turn = 0;
  pace.free = -Infinity;
  Object.assign(heartFight, { turning: false, clock: 0, sense: 1, warm: 0, stopAt: Infinity, restAt: Infinity, crust: false });
  heartFight.falling.clear();
  heartFight.carriers.clear();
  bladeRuns.clear();
  burstFloor.reset();
}
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
 * The ray ring `i`'s row of spots stands in, counted on from ray `first`, and how far across it (m). With the floor whole, the
 * three rows' rays as they always were. Once sectors have fallen (or glow, about to), the rows go to rays that still stand, spread
 * over them; with only two rays left the third row stands beside the first.
 */
function lockRow(first: number, i: number) {
  const up = Array.from({ length: BURST.rays }, (_, k) => (first + k) % BURST.rays).filter((k) => !burstFloor.gone(k) && !heartFight.falling.has(k));
  if (up.length === BURST.rays || !up.length) return { ray: (first + LOCK_RAYS[i]) % BURST.rays, lat: 0 };
  const at = Math.round((i * up.length) / 3);
  return { ray: up[at % up.length], lat: at >= up.length ? 3 : up.length < 3 && i === 0 ? -3 : 0 };
}

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
    const base = rng() * Math.PI * 2, roll = rng() < 0.5 ? -1 : 1, R = roomR();
    // On a floor that turns the beams turn against it: the first and the third against the middle ring, the second against the outer.
    const sense = party && heartFight.turning ? -heartFight.sense : roll;
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
    const sa = start + Math.PI / 3, row = party ? lockRow(Math.floor((base / TAU) * BURST.rays), i) : { ray: 0, lat: 0 }, lockRay = row.ray;
    /** Its row is lost with its ray, when that falls into the sun. */
    const lost = () => party && burstFloor.gone(lockRay);
    const spots = Array.from({ length: lockSpots() }, (_, j) => {
      const at = party ? burstAt(lockRay, LOCK_ALONG + j * LOCK_APART, row.lat) : { x: C.x + Math.sin(sa) * LOCK_OUT, z: C.z + Math.cos(sa) * LOCK_OUT };
      const light = new LightPillar(at.x, at.z, LOCK_R, 6, STAND_COLOR), held = new HoldRing(at.x, at.z, LOCK_R, STAND_COLOR);
      p.group.add(light.mesh, held.mesh);
      return { ...at, light, held, taken: false };
    });
    const objectives: Objective[] = spots.map((s, j) => ({ part: j, x: s.x, z: s.z, radius: LOCK_R, hold: LOCK_HOLD, until: end - 1, can: () => lockedAt < 0 && time >= warm && !lost() }));
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
          const open = lockedAt < 0 && t >= warm && t < end - 1 && !lost();
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
/**
 * Shade the Heart together (user, 2026-11-12: for a fight tuned for 10 or more).
 * - `per`: a plate for every this many heroes standing (the brain's count, in the cast's `x`), `least` at least, one a spur at most.
 * - `leak`: every plate left lying when the beat lands lets it through, and everyone pays this for each, sheltered or not, `most` at most.
 * - `innerOut`: while the floor still turns the plates fall this far out, on the inner ring, which stands (the cast's `flag`).
 */
export const SHADE = { band: 10, per: 5, least: 1, leak: 0.08, most: 0.32, part: 90, innerOut: 4.9 };
/**
 * The crust falls.
 * - `warn`: how long a sector glows after the beat before it goes (s, tier 1), never under `least`: from the far end of a ray it
 *   is 21 m to floor that stays, 6 s at a walk and more through Hold Still's beats.
 * - `share`: what it costs to stand on it as it goes, on top of the first burn; `burn`: each second over the sun, from then on.
 * - `most`: how many of the eight fall at most; `keep`: the ray that never does (the north one, with the way out).
 */
export const SECTORS = { warn: 9, least: 8, share: 0.15, burn: 0.25, most: 6, keep: 4, lasts: 1800 };

/** The sector the next Heartbeat takes, or -1: the brain's pick from the cast's seed, of those that still stand. */
function nextSector(seed: number) {
  if (!heartFight.crust) return -1;
  const up = Array.from({ length: BURST.rays }, (_, k) => k).filter((k) => k !== SECTORS.keep && !burstFloor.gone(k) && !heartFight.falling.has(k));
  if (BURST.rays - 1 - up.length >= SECTORS.most) return -1;
  return up[Math.floor(seeded(seed + 77)() * up.length)] ?? -1;
}

/** Sector `k` goes: the room loses it, the piece of cover in its ray with it, and the whole room feels it. */
function dropSector(p: PlayContext, k: number) {
  heartFight.falling.delete(k);
  burstFloor.fall(k);
  // The fallen armillary's piece in that ray: out of the game with its floor.
  p.breakCover(k, rayAngle(k));
  const mid = burstAt(k, 20);
  p.shake(0.2);
  p.flash('rgba(255,170,80,0.8)', 0.4);
  p.say('THE CRUST FALLS', '#ffb050', mid.x, mid.z);
  for (let along = 8; along <= BURST.len - 1; along += 3.2) {
    const s = burstAt(k, along, (Math.random() - 0.5) * Math.min(9, along * 0.5)), delay = (along - 8) * 0.035;
    if (Math.random() < 0.5) p.show.column(s.x, s.z, { radius: 0.2 + Math.random() * 0.3, height: 3 + Math.random() * 4, life: 0.9, color: 0xe8662a, peak: 0.5, delay: delay + 0.3 });
    p.show.burst(s.x, 0.3, s.z, 12, 4.5, 5, 1.3, SPARK, 2);
    p.sparks.emit(s.x, 0.4, s.z, 10, 5, 4, 1, CRUST, 6);
  }
  p.show.ring(C.x, C.z, { radius: BURST.len, life: 1.2, color: 0xffb060, width: 0.9, peak: 0.5 });
}

const plateGeo = new THREE.BoxGeometry(2.3, 0.32, 2.6);
const plateTrimGeo = new THREE.BoxGeometry(2.36, 0.1, 0.14);

/**
 * Heartbeat: every 20 s in the last phase it gathers, and its crust throws plates out over the floor as gold spots. Hold one 3 s and it
 * stands up on the heart's side of its spot. When it beats, the whole floor burns, except behind a raised plate. Each screen raises the
 * plates the hub says were taken, and lays them down at the same time after the cast, so both see the same cover.
 */
const heartbeat: BossMove = {
  id: 'heartbeat', name: 'Heartbeat', charge: BEAT_GATHER, lock: 2.5, cooldown: 20, due: 20, big: true, pose: 'channel',
  // For a party the brain says what the room can't: how many heroes stand (`x`), which sector goes with this beat (`z`: minus
  // its number, one more), and whether the floor still turns (`flag`).
  aim(c) {
    const a = atHeart(c);
    if (!party) return a;
    return { x: c.heroes?.length ?? 0, z: -(nextSector(c.seed) + 1), dir: a.dir, flag: floorMoves() || undefined };
  },
  play(c, p) {
    const at = p.shown(BEAT_GATHER), rng = seeded(c.seed), base = rng() * Math.PI * 2, source = { x: c.fx, z: c.fz };
    // Ten or more shade the Heart together: a plate for every five heroes standing. A smaller party's plates are simply cover.
    const together = party && band >= SHADE.band, standing = party && c.x >= 1 ? Math.round(c.x) : band;
    // On a floor that still turns the plates fall on the inner ring, and a pocket ends at its seam.
    const inner = party && !!c.flag;
    const R = roomR(), count = !party ? PLATES : together ? clamp(Math.ceil(standing / SHADE.per), SHADE.least, BURST.rays) : partyPlates();
    const out = !party ? PLATE_OUT : inner ? SHADE.innerOut : PARTY_PLATE_OUT, pocketEnd = inner ? BURST_RINGS.inner - 0.1 : POCKET_END;
    // The sector that goes after this beat, once the crust falls (-1: none).
    const sector = party && c.z < 0 ? Math.round(-c.z) - 1 : -1;
    const fallAt = sector >= 0 ? at + Math.max(SECTORS.least, p.shown(SECTORS.warn)) : Infinity;
    let fell = false, named = false;
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
    const shade = new ShadowFloor(source, () => raised.filter((o): o is Obstacle => !!o), STAND_COLOR, party ? pocketEnd : HEART_R);
    p.group.add(shade.mesh);
    p.hint(together ? `Shade the Heart together: raise every plate, ${POCKET_HOLDS} to a pocket. A plate left lying burns everyone`
      : party ? `Heartbeat: raise the fallen plates. Each shelters ${POCKET_HOLDS}, in the pocket behind it` : 'Heartbeat: hold a fallen plate to raise it, then stand behind it');
    const burnt = { kind: 'ring', x: c.fx, z: c.fz, inner: BODY_R + 0.2, outer: R + 1 } as const;
    // In the Sunburst only a raised plate shelters, and only in its pocket: from the plate out to the stone, as wide as its shade.
    const half = Math.atan(PLATE_R / (out - PLATE_IN));
    const inPocket = (k: number, x: number, z: number) => {
      if (!raised[k]) return false;
      const dx = x - C.x, dz = z - C.z, r = Math.hypot(dx, dz);
      return r >= out - PLATE_IN - 0.3 && r <= pocketEnd && Math.abs(wrap(Math.atan2(dx, dz) - plates[k].a)) <= half;
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
    // Shade the Heart together: every plate left lying lets the beat through, and everyone pays for it, sheltered or not. A zone
    // that is only counted: the hub's answer comes to every screen alike, and by then the same plates stand on all of them.
    if (together) {
      threats.push({
        shape: burnt, kind: 'stand', hidden: true, show: at, at, share: 0, part: SHADE.part,
        tally() {
          const lying = raised.filter((o) => !o).length;
          if (!lying) return;
          p.say(`${lying} PLATE${lying > 1 ? 'S' : ''} LEFT LYING`, '#ffb050', c.fx, c.fz + BODY_R + 2.5);
          return Math.min(SHADE.most, SHADE.leak * lying);
        },
      });
    }
    // The crust falls: the sector glows from the beat on and then goes. Whoever still stands on it is burnt.
    if (sector >= 0) {
      heartFight.falling.add(sector);
      threats.push({ shape: burnt, hits: (x, z) => inSector(sector, x, z), at: fallAt, share: SECTORS.share, look: fallAt - at });
      p.hint('The crust falls: after each Heartbeat a ray glows along its cracks and drops into the sun. Get off it');
    }
    let said = 0;
    // A zone with its own rule is not drawn for it: the beat's orange floor, as the room for two shows it.
    const zone = party ? new TelegraphLayer() : null;
    if (zone) {
      zone.set([{ shape: burnt, start: at - BEAT_LOOK, impact: at }], LEAVE_COLOR, LEAVE_ALPHA);
      p.group.add(zone.group);
    }
    return {
      // A pocket's count comes back from the hub after the beat: the cast stays to hear it.
      threats, objectives, duration: sector >= 0 ? fallAt + 1.5 : at + (party ? 3 : PLATE_AFTER + 0.8),
      look: {
        update(t) {
          time = t;
          zone?.update(t);
          // The cast bar gets the move's name as the cast comes in: what a big party is to do goes on it after that.
          if (together && !named) {
            named = true;
            p.label('Heartbeat · Shade the Heart together');
          }
          if (sector >= 0 && t >= at && !fell) {
            if (t < fallAt) burstFloor.crack(sector, (t - at) / (fallAt - at));
            else {
              fell = true;
              dropSector(p, sector);
            }
          }
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
            const mid = (out - PLATE_IN + pocketEnd) / 2, k = o.part;
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
          // A fight that ends while a sector glows: it stays.
          if (sector >= 0 && !fell) {
            heartFight.falling.delete(sector);
            burstFloor.crack(sector, 0);
          }
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
/**
 * Each phase's move. Letters only: the hub passes on a cast only if its move's name is (`MOVE_RE` in server/hub.mjs). They were
 * `still2` and `still3` until 2026-11-12, and online the second screen never heard a beat of the second and the last phase.
 */
const STILL_IDS = ['still', 'stillb', 'stillc'];

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
  id: STILL_IDS[phase], name: 'Hold Still', charge: 0, lock: 0, cooldown: 0, alongside: true, quiet: true, pose: 'channel',
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

// --- a party's room: the floor turns (the second phase) --------------------------------------------------------------------------

/**
 * The floor turns.
 * - `warn`: the seams light and the arrowheads show for this long before anything moves (s, tier 1). `spin`: how long the rings
 *   take to come up to speed (s).
 * - `mid`, `out`: how fast the middle and the outer ring turn (degrees a second): 1.5 m/s at the middle of each, under half a
 *   hero's walk, so a hero can always walk against its ring.
 * - `lead`: the rings begin to stop this long after the brain says so (s), so every screen hears it first. `brake`, `rest`: a ring
 *   takes at least and at most this long to stop (s); it rests on the next eighth of a turn, so its drawing lines up with the rays
 *   again. With far to go in `rest` seconds it lurches on a little faster first, and locks.
 * - `hitch`: a screen that drew nothing for longer than this (s) does not carry its hero over the gap.
 */
export const TURN = { warn: 5, spin: 3, mid: 9, out: 6, lead: 1.5, brake: 3, rest: 8, hitch: 0.5, lasts: 1800 };
const EIGHTH = Math.PI / 4;

/** A ring that turns `speed` rad/s once it runs: where and how fast it is as it begins to stop, how far it still goes and for how long. */
function ringStop(speed: number, warm: number, stopAt: number) {
  const s = Math.max(0, stopAt - warm), ran = s < TURN.spin ? (s * s) / (2 * TURN.spin) : s - TURN.spin / 2;
  const a0 = speed * ran, v0 = speed * Math.min(1, s / TURN.spin);
  if (!v0) return { a0, v0, more: 0, time: 0 };
  // On to the next eighth of a turn that leaves it time to brake.
  const dir = Math.sign(v0), least = (Math.abs(v0) * TURN.brake) / 2;
  const rest = dir * Math.ceil((Math.abs(a0) + least) / EIGHTH - 1e-9) * EIGHTH;
  return { a0, v0, more: rest - a0, time: Math.min(TURN.rest, (2 * (rest - a0)) / v0) };
}

/**
 * How far a ring has turned `t` seconds after the floor's cast (radians): still until `warm`, up to `speed` over `TURN.spin`, and
 * from `stopAt` braking to rest on an eighth of a turn (evenly, when that takes no longer than `TURN.rest`). A pure rule of the
 * time since the cast (by the computer's clock, not the game's), so two screens agree on every angle at every moment, as nearly
 * as the cast reached them together, whatever each hears after and however slowly one of them draws.
 */
export function ringAngle(speed: number, t: number, warm: number, stopAt = Infinity) {
  if (t <= stopAt) {
    const s = Math.max(0, t - warm);
    return speed * (s < TURN.spin ? (s * s) / (2 * TURN.spin) : s - TURN.spin / 2);
  }
  const { a0, v0, more, time } = ringStop(speed, warm, stopAt);
  if (!time) return a0;
  // From its speed now to rest, `more` further on, in `time` seconds: the one cubic that does it (a plain even brake when time allows).
  const u = Math.min(1, (t - stopAt) / time), w = v0 * time;
  return a0 + w * u + (3 * more - 2 * w) * u * u + (w - 2 * more) * u * u * u;
}
const rad = THREE.MathUtils.degToRad;

/**
 * The floor turns (user, 2026-11-12): as its second phase begins the well becomes three rings round the Heart. The inner one
 * stands; the middle one turns one way and the outer one the other (the seed says which), each carrying whoever stands on it. To
 * be carried is no walk, so Hold Still stays fair: stand still on a ring and the beat finds you standing. The beams of The Rings
 * Turn turn against the floor. What stands on a ring rides with it; the lock spots and the fallen armillary's pieces are out in
 * the rays, which stand. It comes once, as soon as the phase lets it (`due`), and goes on until the crust falls. A brain that
 * takes the fight over casts it again: it does nothing then.
 */
const floorTurns: BossMove = {
  id: 'turn', name: 'The Floor Turns', charge: TURN.warn, lock: 0, cooldown: 99999, due: 0, alongside: true, big: true, pose: 'channel',
  aim(c) {
    // Its great mechanics wait a breath after the floor begins to move.
    pace.free = Math.max(pace.free, now() - REST + GREAT_FIRST);
    return atHeart(c);
  },
  play(c, p) {
    if (!party || heartFight.turning || heartFight.crust) return { threats: [], duration: 0.05 };
    const warm = p.shown(TURN.warn), sense = seeded(c.seed)() < 0.5 ? -1 : 1;
    Object.assign(heartFight, { turning: true, clock: 0, sense, warm, stopAt: Infinity, restAt: Infinity });
    const mid = sense * rad(TURN.mid), out = -sense * rad(TURN.out);
    p.hint('The floor turns: the two outer rings carry you, each its own way. To be carried is no walk');
    p.banner('The floor turns', 2.4);
    p.show.ring(C.x, C.z, { radius: BURST.well, life: 1.4, color: 0xffd890, width: 0.7, peak: 0.5 });
    // The floor's clock is this computer's, from the moment the cast came: the game's own time falls behind on a screen that
    // draws slowly (a frame counts for a tenth of a second at most), and over minutes two floors would drift apart.
    const cast = now();
    let was = { mid: 0, out: 0 }, lit = 0, jolted = false, last = 0;
    return {
      threats: [], duration: TURN.lasts,
      look: {
        update(_t, dt) {
          const t = now() - cast, gap = t - last;
          last = t;
          heartFight.clock = t;
          const at = { mid: ringAngle(mid, t, warm, heartFight.stopAt), out: ringAngle(out, t, warm, heartFight.stopAt) };
          const dm = at.mid - was.mid, dout = at.out - was.out;
          was = at;
          // The seams and the arrowheads: they pulse while the floor is about to move, burn while it turns, and go out once it rests.
          const want = t < warm ? 0.55 + 0.45 * Math.sin(t * 7) : dm || dout ? 1 : 0;
          lit += (want - lit) * Math.min(1, dt * (t < warm ? 12 : 1.6));
          burstFloor.turn(at.mid, at.out, Math.max(0, lit), sense);
          // Each screen carries its own hero: by what its ring turned this frame, round the Heart.
          // Not over a gap in the drawing (a tab that was hidden): a hero is not thrown round the room when it comes back.
          if ((dm || dout) && gap <= TURN.hitch) p.carry((x, z) => { const ring = ringOf(x, z); return ring ? turned(x, z, ring === 1 ? dm : dout) : null; });
          if (!jolted && t >= warm) {
            jolted = true;
            p.shake(0.07);
            for (const r of [BURST_RINGS.inner, BURST_RINGS.mid, BURST_RINGS.outer]) p.show.ring(C.x, C.z, { radius: r, life: 0.7, color: 0xffd890, width: 0.3, peak: 0.6 });
          }
          // Gold dust off the seams as the rings grind past each other.
          if ((dm || dout) && Math.random() < dt * 22) {
            const a = Math.random() * TAU, r = Math.random() < 0.5 ? BURST_RINGS.inner : BURST_RINGS.mid;
            p.sparks.emit(C.x + Math.sin(a) * r, 0.15, C.z + Math.cos(a) * r, 3, 1.6, 1.2, 0.6, STAND_COLOR);
          }
        },
        dispose() {
          burstFloor.turn(burstFloor.mid, burstFloor.out, 0, sense);
        },
      },
    };
  },
};

// --- a party's room: the crust falls (the last phase) --------------------------------------------------------------------------------

/**
 * The crust falls (user, 2026-11-12): as its last phase begins the rings grind to a stop, and from then on each Heartbeat takes one
 * sector of the floor with it: a ray with its slice of the well glows along its cracks from the beat on and drops into the sun for
 * good (`heartbeat`, which carries the brain's pick). Its lock spots and its piece of cover go with it. What is gone burns whoever
 * steps on it, each second. The inner ring, a spoke of crust to each spur's nose (where the plates fall) and the north ray with the
 * way out never fall, and six sectors at most: a long fight ends on a floor too small. This cast only says that it has begun, stops
 * the rings (when, on the floor's own clock, is in its `x`) and keeps the fire over what has fallen. It comes once, as soon as the
 * phase lets it (`due`), as the floor's turning does: not as the phase's opener, which waits for a move that holds the floor
 * (Take the Blade) and which a brain that takes the fight over never casts.
 */
const crustFalls: BossMove = {
  id: 'crust', name: 'The Crust Falls', charge: 4, lock: 0, cooldown: 99999, due: 0, alongside: true, big: true, pose: 'raise',
  aim(c) {
    const a = atHeart(c);
    return { x: heartFight.turning && heartFight.stopAt === Infinity ? heartFight.clock + TURN.lead : 0, z: 0, dir: a.dir };
  },
  play(c, p) {
    if (!party || heartFight.crust) return { threats: [], duration: 0.05 };
    heartFight.crust = true;
    if (heartFight.turning && c.x > 0 && heartFight.stopAt === Infinity) {
      heartFight.stopAt = c.x;
      const w = heartFight.warm, s = heartFight.sense;
      heartFight.restAt = c.x + Math.max(ringStop(s * rad(TURN.mid), w, c.x).time, ringStop(-s * rad(TURN.out), w, c.x).time);
    }
    p.hint('The crust falls: after each Heartbeat a ray glows along its cracks and drops into the sun. Get off it');
    p.banner('The crust falls', 2.4);
    // What has fallen burns whoever is over it. One zone for the whole fight: the sectors come into it as they go.
    const burn: Threat = { shape: { kind: 'circle', x: C.x, z: C.z, radius: BURST_R }, hits: (x, z) => burstFloor.lost(x, z), at: 0.1, to: SECTORS.lasts, every: 1, share: SECTORS.burn, look: 0.6 };
    return {
      threats: [burn], duration: SECTORS.lasts,
      look: {
        update(_t, dt) {
          // Embers and tongues of flame out of the sun, over what has fallen.
          if (!burstFloor.fallen || Math.random() > dt * 30) return;
          const a = Math.random() * TAU, r = BURST_RINGS.inner + Math.random() * (BURST.len - BURST_RINGS.inner), x = C.x + Math.sin(a) * r, z = C.z + Math.cos(a) * r;
          if (!burstFloor.lost(x, z)) return;
          p.show.burst(x, -1, z, 3, 0.8, 5, 1.3, SPARK, 0.4);
          if (Math.random() < 0.3) p.show.column(x, z, { radius: 0.2 + Math.random() * 0.4, height: 2 + Math.random() * 4, life: 0.9, color: 0xff9a3a, peak: 0.5 });
        },
        // The fight is over: what fell crusts over, so the way out can be walked.
        dispose: () => burstFloor.cool(),
      },
    };
  },
};

// --- Take the Blade (a party of 20 or more) --------------------------------------------------------------------------------------

/**
 * Take the Blade.
 * - `land`: its two blades stand in the floor this long after the cast (s), `out` m from it, on the inner ring, across from each
 *   other. `lies`: a blade nobody took goes back after this long. `lasts`: the whole of it (s): the cast bar is its clock.
 * - `stands`, `over`: how big a blade is drawn standing in the floor and held aloft by its carrier, point up (times its size in
 *   the Heart's hand, 2.75 m): it must be read from across the room.
 * - `burn`: how long a blade can be carried in all (s), by one hero or by several one after another. `might`: a carrier's hits on
 *   the Heart count this many times. `gens`: how many times a blade can change hands; who dropped one
 *   can't take it again for `again` s.
 * - `lances`: when it throws a lance of light at a carrier, after the cast (s). A lance: `warn` s from its line to its hit, `width`
 *   m wide. It costs a carrier `hit` and knocks the blade out of its hands; it ends on the first hero in its line, who pays `block`,
 *   or on cover. `body`: how near its line a hero must stand to be in its way (m). `past`: how far it goes on behind whom it ends on.
 */
export const BLADE = {
  land: 1.6, out: 5.2, radius: 1.3, lies: 20, lasts: 30, burn: 12, might: 2, gens: 4, again: 3, stands: 1.5, over: 1.6,
  lances: [5, 8.5, 12, 15.5, 19, 22.5, 26], warn: 1.3, width: 2.4, hit: 0.35, block: 0.15, knock: 3, body: 1, past: 1.2,
};
/**
 * While its blades are out of its hands it does what needs none: the flare, the crown, the rings, and in the last phase the
 * Heartbeat, whose raised plates stop a lance. The room's own changes come through it too.
 */
const BLADE_ONLY = ['flare', 'corona', 'rings', 'heartbeat', 'turn', 'crust'];
const TAKE = 0, DROP = 100, SPENT = 200;

/** One of its blades, away from its hand. */
interface FallenBlade {
  x: number;
  z: number;
  /** Flying out, standing in the floor, over a hero, or on its way back. */
  state: 'air' | 'lies' | 'held' | 'back';
  by: RaidSide;
  /** How many times it has changed hands, and how much longer it can be carried (s). */
  gen: number;
  left: number;
  /** When it last changed state, on the cast's clock. */
  since: number;
  /** It lies where its carrier fell (not where a lance knocked it loose). */
  fell?: boolean;
}
/** A run of Take the Blade, by its seed: its later steps (the lances) find it, and say when one of them hit this screen's hero. */
interface BladeRun {
  id: number;
  blades: FallenBlade[];
  struck: boolean;
  /** Where its last lance was aimed and at whom, and when it landed on this screen (s): a blade it knocks loose lies there, the same spot on every screen. */
  lance: { x: number; z: number; at: number; side: RaidSide } | null;
}
/** How long after a lance lands a blade that is dropped counts as knocked loose by it (s): longer than its report takes through the hub. */
const LANCE_DROP = 1.2;
const bladeRuns = new Map<number, BladeRun>();

/** Its two blades fall, to be taken. Everything they do afterwards hangs on who the hub says took, dropped or spent each. */
function bladeThrow(c: BossCast, p: PlayContext): PlayedMove {
  const rng = seeded(c.seed), base = rng() * TAU, land = BLADE.land, me = p.side;
  const blades: FallenBlade[] = [0, 1].map((b) => {
    const a = base + b * Math.PI;
    return { x: C.x + Math.sin(a) * BLADE.out, z: C.z + Math.cos(a) * BLADE.out, state: 'air', by: -1, gen: 0, left: BLADE.burn, since: 0 };
  });
  const run: BladeRun = { id: c.id, blades, struck: false, lance: null };
  bladeRuns.set(c.seed, run);
  const lights = blades.map((s) => {
    const light = new LightPillar(s.x, s.z, BLADE.radius, 2.6, STAND_COLOR);
    p.group.add(light.mesh);
    return light;
  });
  // A sun over each blade a hero carries: who it is reads from across the room.
  const suns = blades.map(() => {
    const orb = new SunOrb(C.x, 5, C.z);
    p.group.add(orb.sprite);
    return orb;
  });
  /** How high a blade's middle is when its point is `tip` m over the floor, drawn `size` times its own. */
  const mid = (size: number, tip: number) => 2.2 * size + tip;
  let time = 0, named = false;
  const told = new Set<number>();
  const report = (part: number) => {
    if (told.has(part)) return;
    told.add(part);
    p.report(c.id, part);
  };
  // A blade is taken by walking onto it, once for each time it lies there; who drops it or spends it says so itself.
  const takes: Objective[] = [], says: Objective[] = [];
  blades.forEach((s, b) => {
    for (let g = 0; g < BLADE.gens; g++) {
      takes.push({ part: TAKE + b * 10 + g, x: s.x, z: s.z, radius: BLADE.radius, until: BLADE.lasts - 1, can: () => s.state === 'lies' && s.gen === g && !heartFight.carriers.has(me) && !(g > 0 && s.by === me && time - s.since < BLADE.again) });
      says.push({ part: DROP + b * 10 + g, x: s.x, z: s.z, radius: 0, kill: true });
    }
    says.push({ part: SPENT + b, x: s.x, z: s.z, radius: 0, kill: true });
  });
  const free = (s: FallenBlade, state: FallenBlade['state']) => {
    if (s.state === 'held') {
      heartFight.carriers.delete(s.by);
      if (s.by === me) {
        p.might(1);
        p.heavy(false);
      }
    }
    s.state = state;
    s.since = time;
  };
  const carried = () => blades.filter((s) => s.state === 'held').length;
  const label = () => p.label(carried() ? `Take the Blade · ${carried()} carried` : blades.some((s) => s.state === 'lies' || s.state === 'air') ? 'Take the Blade' : 'Take the Blade · spent');
  p.hint('Take the Blade: who takes one hits twice as hard, and it hunts them. Stand in its lance for the carrier');
  p.banner('Take the Blade', 2.4);
  return {
    threats: [], objectives: [...takes, ...says], duration: BLADE.lasts + 1.2,
    look: {
      update(t, dt) {
        time = t;
        if (!named) {
          named = true;
          label();
        }
        blades.forEach((s, b) => {
          const live = HEART_LIVE.blades[b], light = lights[b];
          if (s.state === 'air') {
            // Thrown: up out of its hand and down point-first into the floor.
            const u = Math.min(1, t / land);
            Object.assign(live, { out: u, x: s.x, y: mid(BLADE.stands, -0.5) + Math.sin(u * Math.PI) * 4, z: s.z, size: BLADE.stands, up: 0 });
            if (u >= 1) {
              s.state = 'lies';
              s.since = t;
              p.shake(0.05);
              p.show.ring(s.x, s.z, { radius: 3, life: 0.5, color: 0xffd8a0, width: 0.4 });
              p.sparks.emit(s.x, 0.3, s.z, 24, 4, 4, 0.7, SPARK);
            }
          } else if (s.state === 'lies') {
            Object.assign(live, { out: 1, x: s.x, y: mid(BLADE.stands, -0.5), z: s.z, size: BLADE.stands, up: Math.max(0, live.up - dt * 4) });
            // Where its carrier fell: that hero's place on this screen settles a moment after the hub says so.
            const fallen = s.gen > 0 && s.fell && t - s.since < 0.8 ? p.heroAt(s.by) : null;
            if (fallen) {
              s.x = fallen.x;
              s.z = fallen.z;
              for (const o of takes) if (Math.floor((o.part - TAKE) / 10) === b) Object.assign(o, { x: s.x, z: s.z });
              light.mesh.position.set(s.x, light.mesh.position.y, s.z);
            }
            // Nobody took it, or the whole of it is nearly over: it goes back.
            if ((s.gen === 0 && t >= BLADE.lies) || t >= BLADE.lasts - 1) free(s, 'back');
          } else if (s.state === 'held') {
            const h = p.heroAt(s.by);
            // Held aloft, point up, its hilt at the hero's hand: the sun at its point.
            const y = 1.5 + 1.6 * BLADE.over + 0.12 * Math.sin(t * 3);
            if (h) Object.assign(live, { out: 1, x: h.x, y, z: h.z, size: BLADE.over, up: Math.min(1, live.up + dt * 4) });
            if (h) suns[b].sprite.position.set(h.x, y + 2.2 * BLADE.over, h.z);
            s.left -= dt;
            // Its carrier's own screen says when it is dropped (the hero fell, or a lance hit it) and when it is spent.
            if (s.by === me) {
              if (p.down() || run.struck) report(DROP + b * 10 + s.gen);
              else if (s.left <= 0 || t >= BLADE.lasts - 1) report(SPENT + b);
            } else if (t >= BLADE.lasts) free(s, 'back');
          } else {
            // Back to its hand.
            live.out = Math.max(0, 1 - (t - s.since) / 0.8);
            live.size = 1;
            live.up = 0;
          }
          light.opacity = s.state === 'lies' ? 0.28 + 0.1 * Math.sin(t * 5 + b) : 0;
          suns[b].set(2.6 + 0.3 * Math.sin(t * 4 + b), s.state === 'held' ? 0.6 : 0);
        });
        run.struck = false;
      },
      done(o, side) {
        const b = o.part >= SPENT ? o.part - SPENT : Math.floor((o.part % 100) / 10), s = blades[b];
        if (!s) return;
        if (o.part >= SPENT) {
          if (s.state !== 'held') return;
          free(s, 'back');
          p.say('THE BLADE IS SPENT', '#ffe27a', s.x, s.z);
        } else if (o.part >= DROP) {
          if (s.state !== 'held') return;
          // Knocked loose by a lance, it lies where the lance was aimed; else where its carrier fell.
          const lance = run.lance && run.lance.side === side && now() - run.lance.at < LANCE_DROP ? run.lance : null, at = lance ?? p.heroAt(side);
          free(s, 'lies');
          s.fell = !lance;
          if (at) Object.assign(s, { x: at.x, z: at.z });
          s.gen++;
          for (const t of takes) if (Math.floor((t.part - TAKE) / 10) === b) Object.assign(t, { x: s.x, z: s.z });
          lights[b].mesh.position.set(s.x, lights[b].mesh.position.y, s.z);
          // It has changed hands too often: it goes back.
          if (s.gen >= BLADE.gens) free(s, 'back');
          else p.say('THE BLADE FALLS', '#ffb050', s.x, s.z);
        } else {
          if (s.state !== 'lies') return;
          s.state = 'held';
          s.by = side;
          s.since = time;
          heartFight.carriers.add(side);
          if (side === me) {
            p.might(BLADE.might);
            p.heavy(true);
            p.flash('rgba(255,226,140,0.7)', 0.3);
            p.hint('You carry a sun blade: you hit twice as hard, and it hunts you. Stay behind your friends');
          }
          p.say('THE BLADE IS TAKEN', '#ffe27a', s.x, s.z);
          p.show.triumph(s.x, s.z, 0xffe0a0, 0.8);
        }
        label();
      },
      dispose() {
        for (const s of blades) free(s, 'back');
        for (const live of HEART_LIVE.blades) live.out = 0;
        for (const l of lights) l.dispose();
        for (const o of suns) o.dispose();
        if (bladeRuns.get(c.seed) === run) bladeRuns.delete(c.seed);
      },
    },
  };
}

/** A lance of light at a carrier: it ends on the first hero in its line or on cover, and knocks the blade from a carrier it hits. */
function sunLance(c: BossCast, p: PlayContext): PlayedMove {
  if (c.flag) return { threats: [], duration: 0.05 };
  const at = BLADE.warn, run = bladeRuns.get(c.seed), dx = Math.sin(c.dir), dz = Math.cos(c.dir);
  const reach = Math.max(BODY_R + 1.5, (c.x - c.fx) * dx + (c.z - c.fz) * dz + BLADE.past), len = beamStop(p.cover(), c.fx, c.fz, c.dir, reach);
  const from = { x: c.fx + dx * BODY_R * 0.8, z: c.fz + dz * BODY_R * 0.8 }, to = { x: c.fx + dx * len, z: c.fz + dz * len };
  // Each screen for its own hero: a carrier pays for the blade it holds, anyone else for standing in the way.
  const mine = heartFight.carriers.has(p.side);
  const th: Threat = { shape: { kind: 'line', x1: from.x, z1: from.z, x2: to.x, z2: to.z, width: BLADE.width }, at, share: mine ? BLADE.hit : BLADE.block, knock: mine ? BLADE.knock : 0 };
  let told = false;
  return {
    threats: [th], duration: at + 0.6,
    look: {
      update() {
        // It hit this screen's hero: if that hero carries a blade, its run hears of it.
        if (told || th.lastHit === undefined) return;
        told = true;
        if (run) run.struck = true;
      },
      land() {
        if (run) run.lance = { x: c.x, z: c.z, at: now(), side: c.target };
        p.show.beam(new THREE.Vector3(c.fx, 3.6, c.fz), new THREE.Vector3(to.x, 0.9, to.z), { life: 0.5, core: 0xfff4d8, glow: 0xe08a30, width: 1.9 });
        p.glows.flash(to.x, to.z, 2.4, GLOW, 0.5, 0.4);
        p.sparks.emit(to.x, 0.8, to.z, 16, 5, 3, 0.6, SPARK);
        p.shake(0.04);
      },
    },
  };
}

/**
 * Take the Blade (user, 2026-11-12, for a party of 20 or more): the Heart throws its two sun blades down into the floor beside it.
 * A hero who walks onto one carries it over its head: its hits on the Heart count twice, it walks slower, and the Heart's aim goes
 * to the carriers (`heartChoice`). While the blades are out of its hands it does only what needs none (`BLADE_ONLY`), and it throws a lance of
 * light at a carrier every few seconds: the lance ends on the first hero standing in its line (who pays little) or on cover, a
 * raised plate too; a carrier it reaches pays much and the blade is knocked from its hands. A blade whose carrier is hit or falls
 * lies where that hero stood, for another. Hold Still goes on through all of it: on a beat a carrier can't step aside.
 *
 * Its first step throws the blades; each later step is a lance, its own cast, aimed by the brain at a carrier that stands (none:
 * a flagged step that plays nothing). Who took, dropped or spent a blade every screen hears from the hub, as objectives.
 */
const takeBlade: BossMove = {
  id: 'blade', name: 'Take the Blade', minBand: 20, charge: BLADE.lasts, least: BLADE.lasts, lock: 2.5, cooldown: 44, due: 0, big: true, pose: 'raise',
  steps: [0, ...BLADE.lances], holds: { only: BLADE_ONLY },
  aim(c) {
    const a = atHeart(c);
    if (c.step === 0) {
      holdFor('blade', BLADE.lasts);
      return a;
    }
    const up = c.heroes ?? [], held = up.filter((h) => heartFight.carriers.has(h.side)).sort((x, y) => x.side - y.side);
    if (!held.length) return { x: c.boss.x, z: c.boss.z, dir: 0, flag: true };
    const h = held[c.step % held.length], dx = h.x - c.boss.x, dz = h.z - c.boss.z, far = Math.hypot(dx, dz) || 1, ux = dx / far, uz = dz / far;
    // The first hero in its line, short of the carrier: the lance ends there.
    let end = h, near = far;
    for (const o of up) {
      if (heartFight.carriers.has(o.side)) continue;
      const ox = o.x - c.boss.x, oz = o.z - c.boss.z, along = ox * ux + oz * uz;
      if (along < BODY_R || along >= near - 0.3 || Math.abs(ox * uz - oz * ux) > BLADE.body) continue;
      end = o;
      near = along;
    }
    return { x: end.x, z: end.z, dir: Math.atan2(dx, dz), target: end.side };
  },
  play: (c, p) => (c.step === 0 ? bladeThrow(c, p) : sunLance(c, p)),
};

/** Whom it goes for next (`BossDef.choose`): whoever carries one of its blades, the one it aimed at least recently. Otherwise the brain's own rule. */
function heartChoice(c: { heroes: { side: RaidSide }[]; when(side: RaidSide): number }): RaidSide | undefined {
  const held = c.heroes.filter((h) => heartFight.carriers.has(h.side));
  return held.length ? held.reduce((a, b) => (c.when(b.side) < c.when(a.side) ? b : a)).side : undefined;
}

// --- The Ring of Hands (a party of 40) ---------------------------------------------------------------------------------------------

/**
 * The Ring of Hands.
 * - `seconds`: from its call to the end (tier 1), never under `least`. `close`: the spots close this long before the end, so
 *   every screen has the same count when it is judged.
 * - A gold spot for every hero standing (the brain's count), drawn `radius` wide, held `hold` s, one to a hero. A hero within
 *   `reach` of its middle holds it: a little past its edge, where a tap or an AI's walk ends. `share`: this much of them must be
 *   held. `fail`: what a broken ring costs everyone.
 * - `rings`: how far from the Heart the spots stand (m), on the inner ring of the floor, which stands and never falls: one ring
 *   of up to `outer` spots, and a second inside it for a bigger raid.
 */
export const HANDS = { seconds: 16, least: 14, close: 1.2, share: 0.8, fail: 0.45, hold: 1, radius: 0.7, reach: 0.95, rings: [6, 4.2], outer: 22 };

/** Where `n` spots stand: round the Heart, two rings deep for more than `HANDS.outer`. */
function handSpots(n: number, seed: number) {
  const base = seeded(seed)() * TAU, outer = n <= HANDS.outer ? n : Math.ceil(n * 0.58), out: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const ring = i < outer ? 0 : 1, of = ring ? n - outer : outer, a = base + ((ring ? i - outer + 0.5 : i) / of) * TAU;
    out.push({ x: C.x + Math.sin(a) * HANDS.rings[ring], z: C.z + Math.cos(a) * HANDS.rings[ring] });
  }
  return out;
}

/**
 * The Ring of Hands (user, 2026-11-12, for a party of 40): the whole raid forms a ring round the Heart. A gold spot for every hero
 * standing appears round it on the inner ring of the floor; a hero holds one for a second and it is that hero's (one each: the hub
 * says who). The Heart does nothing else meanwhile, but Hold Still's beats go on, so the raid walks in between beats. Four spots in
 * five held before the ring closes, and the Heart is stunned: it kneels. A broken ring burns everyone. The count is on the cast bar.
 */
const ringOfHands: BossMove = {
  id: 'hands', name: 'The Ring of Hands', minBand: 40, charge: HANDS.seconds, least: HANDS.least, lock: 3, cooldown: 60, due: 0, big: true, pose: 'channel',
  holds: { only: [] },
  aim(c) {
    holdFor('hands', HANDS.seconds);
    return { x: Math.max(1, c.heroes?.length ?? 1), z: 0, dir: atHeart(c).dir };
  },
  play(c, p) {
    const n = clamp(Math.round(c.x), 1, RAID_PARTY_MAX), need = Math.max(1, Math.ceil(n * HANDS.share));
    const at = Math.max(HANDS.least, p.shown(HANDS.seconds)), close = at - HANDS.close, me = p.side;
    const spots = handSpots(n, c.seed).map((s) => {
      const light = new LightPillar(s.x, s.z, HANDS.radius, 1.1, STAND_COLOR), held = new HoldRing(s.x, s.z, HANDS.radius, STAND_COLOR);
      p.group.add(light.mesh, held.mesh);
      return { ...s, light, held, by: -1 as RaidSide };
    });
    let mine = -1, got = 0, won = -1, named = false, time = 0;
    const fail: Threat = { shape: { kind: 'circle', x: C.x, z: C.z, radius: roomR() + 1 }, at, show: Math.max(0, at - 3), share: HANDS.fail, look: 2 };
    // One spot to a hero. Two neighbours' reach overlaps, and the hub's answer takes a moment: while this screen has asked for a spot
    // and not heard, it asks for no other.
    const asked = () => objectives.some((o) => o.reported && !o.done);
    const objectives: Objective[] = spots.map((s, i) => ({ part: i, x: s.x, z: s.z, radius: HANDS.reach, hold: HANDS.hold, until: close, can: () => mine < 0 && s.by < 0 && won < 0 && !asked() }));
    const label = () => p.label(`The Ring of Hands · ${got} of ${need}`);
    p.hint('The Ring of Hands: everyone to a gold spot round the Heart, one each. Hold it a moment');
    p.banner('The Ring of Hands', 2.6);
    p.show.ring(C.x, C.z, { radius: HANDS.rings[0] + 1.5, life: 1.2, color: 0xffe0b0, width: 0.6, peak: 0.6 });
    return {
      threats: [fail], objectives, duration: at + 1.2,
      look: {
        update(t) {
          time = t;
          if (!named) {
            named = true;
            label();
          }
          const open = won < 0 && t < close;
          spots.forEach((s, i) => {
            const taken = s.by >= 0;
            s.light.opacity = won >= 0 ? Math.max(0, 0.6 - (t - won)) * (taken ? 1 : 0) : !open ? 0 : taken ? 0.16 : 0.34 + 0.12 * Math.sin(t * 4 + i);
            s.held.set(taken ? (won >= 0 || open ? 1 : 0) : open ? objectives[i].held ?? 0 : 0);
          });
        },
        done(o, side) {
          const s = spots[o.part];
          if (!s || s.by >= 0 || won >= 0) return;
          s.by = side;
          got++;
          if (side === me) mine = o.part;
          p.sparks.emit(s.x, 0.4, s.z, 12, 3, 3, 0.6, STAND_COLOR);
          label();
          if (got < need) return;
          // The ring is full enough: it holds, and the Heart is stunned.
          won = time;
          p.cancel(c.id);
          p.reward('hands', c.id);
          p.flash('rgba(255,226,140,0.75)', 0.5);
          p.shake(0.1);
          p.banner('The ring holds', 2);
          p.say('THE RING HOLDS', '#ffe27a', C.x, C.z + BODY_R + 1.5);
          p.show.triumph(C.x, C.z, 0xffe0a0, 1.6);
          for (const x of spots) if (x.by >= 0) p.show.beam(new THREE.Vector3(x.x, 0.9, x.z), new THREE.Vector3(C.x, 3.4, C.z), { life: 0.7, core: 0xfff0c8, glow: 0xffb050, width: 0.35 });
        },
        land() {
          p.flash('rgba(255,206,130,0.85)', 0.6);
          p.shake(0.14);
          p.banner('The ring breaks', 2);
          p.say(`THE RING BREAKS: ${got} OF ${need}`, '#ffb050', C.x, C.z + BODY_R + 1.5);
          p.show.ring(C.x, C.z, { radius: roomR() + 2, life: 1.3, color: 0xffd090, width: 1.6 });
          p.show.column(C.x, C.z, { radius: BODY_R * 1.4, height: 16, life: 1, color: 0xffe0b0, peak: 0.7 });
        },
        dispose() {
          for (const s of spots) {
            s.light.dispose();
            s.held.dispose();
          }
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

/**
 * Its phases. Hold Still comes by the clock in each, quicker each time. A new phase's first run waits until the last phase's has
 * ended; in Noon Falls a run falls between two Heartbeats (the first gathers from 2.5 s to 12.5 s into the phase, then every 20 s).
 */
const PHASES: BossPhase[] = [
  { name: 'Embers Wake', at: 1, moves: ['sweep', 'fall', 'flare'], gap: [2, 3], timed: { move: STILL_IDS[0], first: 9, every: 21, most: 99 } },
  { name: 'The Rings Turn', at: NUMBERS.phases[0], moves: ['sweep', 'fall', 'flare', 'rings'], opener: 'rings', gap: [2, 3], timed: { move: STILL_IDS[1], first: 11, every: 20, most: 99 } },
  {
    name: 'Noon Falls', at: NUMBERS.phases[1], moves: ['sweep', 'fall', 'flare', 'rings', 'corona', 'heartbeat'], opener: 'heartbeat', gap: [1.8, 2.8],
    timed: { move: STILL_IDS[2], first: 13, every: 20, most: 99 },
  },
];
/**
 * A party's, in the Sunburst. The Rings Turn still opens with the rings, and the floor begins to turn right after (`turn` comes as
 * soon as it may). Noon Falls begins with the crust falling (`crust`, the same way: first in its list, by its clock), which
 * stops the rings; the Heartbeat waits until they rest (so its plates fall before the spurs, on a floor that stands) and then comes
 * by its own clock: its first beat already takes a sector. Its great mechanics (Take the Blade, The Ring of Hands) are in its lists only when their turn has come
 * (`nextGreat`); the brain leaves out what the band is too small for (`BossMove.minBand`).
 */
const great = (list: string[]) => {
  const g = nextGreat();
  return g ? [...list, g] : list;
};
const PARTY_PHASES: BossPhase[] = [
  PHASES[0],
  { ...PHASES[1], get moves() { return great(['sweep', 'fall', 'flare', 'rings', 'turn']); } },
  { ...PHASES[2], opener: undefined, get moves() { return great(floorMoves() ? ['crust', 'sweep', 'fall', 'flare', 'rings', 'corona'] : ['crust', 'sweep', 'fall', 'flare', 'rings', 'corona', 'heartbeat']); } },
];

export const HEART_OF_NOON: BossDef = {
  id: 'heart',
  name: 'The Heart of Noon',
  title: 'The Fallen Sun',
  /** For two, the Sunken Heart. A party fights in the Sunburst (`raidRing`): set before the fight is built. */
  resize: (b) => {
    band = b;
    party = raidRing('heart', b) > HEART_R;
    resetHeartFight(b);
  },
  /** How many the fight is tuned for now: what its mechanics for 10, 20 and 40 ask (`BossMove.minBand`). */
  get band() { return band; },
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
  get phases() { return party ? PARTY_PHASES : PHASES; },
  choose: (c) => (party ? heartChoice(c) : undefined),
  /** A higher tier brings these in from the first phase on, one a tier: the Crown of Rays, then the rings, then the Heartbeat. */
  extra: ['corona', 'rings', 'heartbeat'],
  moves: {
    sweep: bladeSweep, fall: bladeFall, flare: solarFlare, rings: ringsTurn, heartbeat, corona: crownOfRays,
    [STILL_IDS[0]]: holdStill(0), [STILL_IDS[1]]: holdStill(1), [STILL_IDS[2]]: holdStill(2),
    turn: floorTurns, crust: crustFalls, blade: takeBlade, hands: ringOfHands,
  },
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
