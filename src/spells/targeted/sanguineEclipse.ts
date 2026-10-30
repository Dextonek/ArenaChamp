import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import {
  BLOOD, BLOOD_CSS, BloodDrops, BloodPool, BloodSigil, BloodTendril, BloodThorns, HeatHaze, ShockRefraction,
  StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Sanguine Eclipse (blood kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world
 * darkens, three blood beads are thrown into the sky and a pale bone moon appears above the zone and BLEEDS (red runs
 * down it). Blood is torn out of every enemy into one suspended sphere. The caster clenches her fist, everything
 * stops for a dead beat, then in two frames the sphere freezes into a crystal thorn-star that slams down and impales
 * the zone (60-80 thorns in a fast outward ring). The drained blood flies home, then everything shatters from the
 * centre outward into dark flakes. Clean by 4.5 s. See pipeline/designs/sanguine-eclipse.md.
 */
export interface SanguineEclipseSettings {
  harvestDamage: number;
  slamDamage: number;
  /** HP she heals for every enemy the harvest hits. */
  heal: number;
  loop: boolean;
}

export const defaultSanguineEclipse = (): SanguineEclipseSettings => ({ harvestDamage: 15, slamDamage: 100, heal: 10, loop: false });

// Timeline (seconds).
const HARVEST_HIT_T = 1.0;
const HARVEST_END_T = 1.8; // streams snap off: the dead beat starts
const FREEZE_T = 2.0; // sphere -> thorn-star
const LAND_T = 2.4;
const DRAIN_T = 2.55;
const RELEASE_T = 3.4;
const DURATION = 4.5;

const RADIUS = 6;
const MOON_R = 2.8;
const MOON_H = 7;
const SPHERE_H = 4.5;
const SPHERE_R = 1.6;
const STAR_END_Y = 1.7;
const STAR_SPIKES = 16;
const MAX_VICTIMS = 10;
const ERUPT_COUNT = 64;
const BEADS = 3;
const DRIPS = 4;
const MOON_FILL = 0.55;

const c01 = (x: number) => Math.min(1, Math.max(0, x));

// ---------------------------------------------------------------------------------------------------------------
// Local shaders and textures (blood.ts is shared and must not change)
// ---------------------------------------------------------------------------------------------------------------

/** The kit's liquid look on a sphere with a slow vertex wobble (surface tension). Same shading as blood.ts. */
function liquidBallMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBody: { value: new THREE.Color(BLOOD.body) }, uDark: { value: new THREE.Color(BLOOD.dark) },
      uHot: { value: new THREE.Color(BLOOD.hot) }, uCore: { value: new THREE.Color(BLOOD.core) },
      uTime: { value: 0 }, uWob: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uWob;
      varying vec3 vN; varying vec3 vView;
      // Lumpy surface-tension displacement along the radial direction (unit sphere).
      float lump(vec3 p) {
        return sin(p.x * 2.3 + uTime * 2.1) + sin(p.y * 2.9 - uTime * 1.7 + 1.0) + sin(p.z * 2.6 + uTime * 2.4 + 2.0)
             + 0.6 * sin(p.x * 5.1 - p.z * 4.3 + uTime * 3.6) + 0.5 * sin(p.y * 6.2 + p.x * 3.7 - uTime * 4.1);
      }
      void main() {
        vec3 n0 = normalize(position);
        float h = lump(n0);
        vec3 p = n0 * (1.0 + h * uWob * 0.16);
        // Tilt the normal by the tangential gradient of the displacement (finite differences).
        vec3 t1 = normalize(cross(n0, abs(n0.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 t2 = cross(n0, t1);
        float e = 0.03;
        float g1 = (lump(normalize(n0 + t1 * e)) - h) / e, g2 = (lump(normalize(n0 + t2 * e)) - h) / e;
        vec3 n = normalize(n0 - (t1 * g1 + t2 * g2) * uWob * 0.16);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * n);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uCore;
      varying vec3 vN; varying vec3 vView;
      void main() {
        vec3 n = normalize(vN), v = normalize(vView);
        vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
        float ndl = dot(n, L);
        float f = 1.0 - abs(dot(n, v));
        vec3 col = uBody * 0.78;
        col = mix(col, uDark, step(ndl, 0.0) * 0.55);
        col = mix(col, uHot, step(0.6, ndl) * 0.12);
        if (f > 0.5 && ndl > -0.1) col = uHot * 0.9;                 // one thin hot rim band
        if (f > 0.76) col = uDark;
        float spec = dot(n, normalize(L + v));
        if (spec > 0.9988 && f < 0.5) col = uCore * 0.9;             // one tiny specular dot
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Moon texture: R = shade (1 bone, darker maria / rim), A = disc. */
function drawMoon(): THREE.CanvasTexture {
  const S = 512, C = S / 2, R = 230;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, S, S);
  g.save();
  g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#fff';
  g.fillRect(0, 0, S, S);
  // Soft grey maria.
  const maria: [number, number, number][] = [
    [185, 195, 85], [320, 165, 62], [275, 310, 95], [150, 335, 55], [360, 285, 45],
  ];
  for (const [x, y, r] of maria) {
    const gr = g.createRadialGradient(x, y, r * 0.25, x, y, r);
    gr.addColorStop(0, 'rgba(95,95,95,0.85)');
    gr.addColorStop(0.7, 'rgba(95,95,95,0.5)');
    gr.addColorStop(1, 'rgba(95,95,95,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
  // A slightly darker limb at the edge.
  const limb = g.createRadialGradient(C, C, R * 0.72, C, C, R);
  limb.addColorStop(0, 'rgba(110,110,110,0)');
  limb.addColorStop(1, 'rgba(110,110,110,0.6)');
  g.fillStyle = limb;
  g.fillRect(0, 0, S, S);
  // A few small craters.
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(170,170,170,0.7)';
  for (const [x, y, r] of [[120, 220, 16], [370, 220, 20], [300, 410, 14], [210, 400, 11], [400, 330, 10]]) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
  // Sharp outer line.
  g.strokeStyle = '#8a8a8a';
  g.lineWidth = 5;
  g.beginPath(); g.arc(C, C, R - 2, 0, Math.PI * 2); g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8;
  return tex;
}

/** Drip map: the value at which each texel turns red. Low at the top and along a few long fingers. */
function drawDrip(): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(S, S);
  // Fingers: centre x, half-width, length 0..1.
  // Irregular runs: a few long ones, many short ones, uneven widths. d = y / reach(x): at fill F the red covers
  // y < F * reach(x), so each run is a rounded finger that ends in a small bead.
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const fingers: { cx: number; w: number; len: number }[] = [];
  let fx = 0.03;
  while (fx < 0.97) {
    const long = rnd() < 0.22;
    fingers.push({ cx: fx, w: 0.012 + rnd() * 0.03, len: long ? 0.55 + rnd() * 0.3 : 0.04 + rnd() * 0.22 });
    fx += 0.04 + rnd() * 0.09;
  }
  const FMAX = 0.55;
  for (let j = 0; j < S; j++) {
    const y = j / (S - 1);
    for (let i = 0; i < S; i++) {
      const x = i / (S - 1);
      const base = 0.85 + 0.1 * Math.sin(x * 7 + 1) + 0.07 * Math.sin(x * 17) + 0.04 * Math.sin(x * 41 + 2);
      let reach = base;
      let bead = false;
      for (const f of fingers) {
        const dx = (x - f.cx) / f.w;
        if (Math.abs(dx) < 1) reach = Math.max(reach, base + f.len * Math.sqrt(1 - dx * dx));
        const tipY = FMAX * (base + f.len) + f.w * 0.9;
        if (f.len > 0.1 && Math.hypot(x - f.cx, y - tipY) < f.w * 1.5) bead = true;
      }
      let d = y / Math.max(reach, 0.05);
      if (bead) d = Math.min(d, FMAX * 0.92);
      const v = Math.round(c01(d) * 255);
      const o = (j * S + i) * 4;
      img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cv);
}

/** The bleeding moon: bone disc, red revealed by a threshold over the drip map, one thin hot front line. */
function moonMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: drawMoon() }, uDrip: { value: drawDrip() },
      uBone: { value: new THREE.Color(BLOOD.bone) }, uBody: { value: new THREE.Color(BLOOD.body) },
      uHot: { value: new THREE.Color(BLOOD.hot) }, uDark: { value: new THREE.Color(BLOOD.dark) },
      uFill: { value: 0 }, uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap, uDrip; uniform vec3 uBone, uBody, uHot, uDark; uniform float uFill, uOpacity;
      varying vec2 vUv;
      void main() {
        vec4 m = texture2D(uMap, vUv);
        float d = texture2D(uDrip, vUv).r;
        float a = m.a * uOpacity;
        if (a < 0.004) discard;
        vec3 col = uBone * (0.4 + 0.6 * m.r);
        float on = step(0.001, uFill);
        float red = (1.0 - smoothstep(uFill - 0.01, uFill, d)) * on;
        vec3 blood = mix(uBody, uDark, 0.35 * (1.0 - m.r));
        col = mix(col, blood, red);
        float front = (1.0 - smoothstep(0.0, 0.016, abs(d - (uFill - 0.01)))) * on * red;
        col = mix(col, uHot, front * 0.85);
        gl_FragColor = vec4(col, a);
      }`,
  });
}

// ---------------------------------------------------------------------------------------------------------------

interface Victim {
  enemy: Enemy;
  pos: THREE.Vector3; // feet at cast time
  p0: THREE.Vector3; // chest
  dirH: THREE.Vector3; // horizontal unit from the sphere toward the enemy
  side: THREE.Vector3;
  phase: number;
  delay: number;
}

export class SanguineEclipse implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SanguineEclipseSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private matTime = 0; // wobble clock; frozen in the dead beat

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -8);
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private chest = new THREE.Vector3(0, 1.25, 14);
  private fist = new THREE.Vector3(0, 2.4, 14);
  private sphereC = new THREE.Vector3(0, SPHERE_H, -8);
  private moonC = new THREE.Vector3(0, MOON_H, -8);
  private moonTop = new THREE.Vector3(0, MOON_H + 3, -8);
  private victims: Victim[] = [];
  private sphereR = 0.3;

  // Event flags.
  private flags = { harvestHit: false, frozen: false, landed: false, drain: false, shatter1: false, shatter2: false, shatter3: false, dried: false, splatFade: false };
  private shedTimer = 0;
  private arrivals: number[] = [];
  private starIds: number[] = [];

  // Parts.
  private sigil = new BloodSigil({ color: BLOOD.bone, inner: false });
  private fistSigil = new BloodSigil({ color: BLOOD.bone });
  private moon: THREE.Mesh;
  private sphere: THREE.Mesh;
  private beads: THREE.Mesh[] = [];
  private beadTrails: BloodTendril[] = [];
  private beadPts: THREE.Vector3[][] = [];
  private streams: BloodTendril[] = [];
  private drips: BloodTendril[] = [];
  private dripPts: THREE.Vector3[][] = [];
  private dripCycle = [0, 0, 0, 0];
  private star = new BloodThorns({ maxSpikes: 24, maxFlakes: 120 });
  // The eruption is split in three radial bands so the release can shatter from the centre outward.
  private fields = [0, 1, 2].map(() => new BloodThorns({ maxSpikes: 48, maxFlakes: 150 }));
  private drops = new BloodDrops({ maxDrops: 140, maxSplats: 12 });
  private pool = new BloodPool();
  private pop = new StarBurst({ points: 12, inner: 0.3, color: BLOOD.accent, core: BLOOD.accent, additive: false });
  private chestPulse = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: BLOOD.hot, core: BLOOD.bone, additive: false });
  private lens = new ShockRefraction({ facing: 'camera' });
  private freezeRing = new ShockRefraction({ facing: 'camera' });
  private groundRing = new ShockRefraction({ facing: 'ground' });
  private haze = new HeatHaze({ width: 15, height: 4, scale: 5 });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();
  private mat4 = new THREE.Matrix4();

  constructor(settings: SanguineEclipseSettings = defaultSanguineEclipse()) {
    this.settings = settings;
    this.screen.impactColor.set(BLOOD.bone);
    this.screen.tint.set(BLOOD.dark);

    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), moonMaterial());
    this.moon.frustumCulled = false;
    this.moon.visible = false;

    const ballGeo = new THREE.IcosahedronGeometry(1, 4);
    this.sphere = new THREE.Mesh(ballGeo, liquidBallMaterial());
    this.sphere.frustumCulled = false;
    this.sphere.visible = false;

    for (let i = 0; i < BEADS; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), liquidBallMaterial());
      b.frustumCulled = false;
      b.visible = false;
      this.beads.push(b);
      const tr = new BloodTendril({ segments: 10, sides: 6 });
      tr.width = 0.1;
      tr.bead = 0;
      tr.wobble = 0;
      const pts = [0, 1, 2, 3, 4].map(() => new THREE.Vector3());
      tr.setPoints(pts);
      this.beadTrails.push(tr);
      this.beadPts.push(pts);
    }
    for (let i = 0; i < MAX_VICTIMS; i++) {
      const s = new BloodTendril({ segments: 36 });
      s.width = 0.22;
      s.bead = 1.3;
      s.wobble = 0.03;
      s.setFunction((u, out) => this.streamPath(i, u, out));
      this.streams.push(s);
    }

    for (let i = 0; i < DRIPS; i++) {
      const d = new BloodTendril({ segments: 8, sides: 6 });
      d.width = 0.14;
      d.bead = 1.7;
      d.wobble = 0;
      const pts = [new THREE.Vector3(), new THREE.Vector3()];
      d.setPoints(pts);
      this.drips.push(d);
      this.dripPts.push(pts);
    }

    this.drops.splatScale = 0.55;
    this.drops.splats.life = 2.2;
    this.drops.onArrive = () => this.arrivals.push(this.time);

    this.group.add(
      this.sigil.mesh, this.fistSigil.mesh, this.moon, this.sphere, ...this.beads, ...this.beadTrails.map((b) => b.mesh),
      ...this.streams.map((s) => s.mesh), ...this.drips.map((d) => d.mesh), this.star.mesh, ...this.fields.map((f) => f.mesh), this.pool.mesh,
      this.drops.mesh, this.pop.mesh, this.chestPulse.mesh, this.lens.mesh, this.freezeRing.mesh, this.groundRing.mesh,
      this.haze.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return LAND_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.point.copy(ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.chest.copy(ctx.from).addScaledVector(this.fwd, 0.15).setY(1.25);
    this.fist.copy(ctx.from).addScaledVector(this.fwd, 0.3).setY(2.5);
    this.sphereC.copy(this.point).setY(SPHERE_H);
    // The moon floats above the zone and a little beyond it, tilted ~55 deg toward the caster so the gameplay camera
    // sees a full disc: its normal points back at the caster and up.
    this.moonC.copy(this.point).addScaledVector(this.fwd, 2).setY(MOON_H);
    const n = this.v1.copy(this.fwd).multiplyScalar(-Math.cos(0.61)).setY(Math.sin(0.61)).normalize();
    const xAxis = this.v2.set(0, 1, 0).cross(n).normalize();
    const yAxis = this.v3.crossVectors(n, xAxis).normalize();
    this.mat4.makeBasis(xAxis, yAxis, n);
    this.moon.quaternion.setFromRotationMatrix(this.mat4);
    this.moon.position.copy(this.moonC);
    this.moon.scale.setScalar(MOON_R / 0.9);
    this.moonTop.copy(this.moonC).addScaledVector(yAxis, MOON_R * 0.8);

    // Victims: every enemy inside the radius.
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) return;
      const v: Victim = {
        enemy: e, pos: p.clone(), p0: p.clone().setY(1.1), dirH: new THREE.Vector3(), side: new THREE.Vector3(),
        phase: i * 1.7, delay: 0,
      };
      v.dirH.set(p.x - this.point.x, 0, p.z - this.point.z);
      if (v.dirH.lengthSq() < 1e-4) v.dirH.set(Math.cos(i * 2.1), 0, Math.sin(i * 2.1));
      v.dirH.normalize();
      v.side.set(-v.dirH.z, 0, v.dirH.x);
      this.victims.push(v);
    });
    this.victims.forEach((v, i) => { v.delay = (i / Math.max(1, this.victims.length)) * 0.12; });

    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.sphere, this.star.mesh];
    this.screen.focus.copy(this.sphereC);
    this.pool.place(this.point);
    this.sigil.set(this.v1.copy(this.point).setY(0.04), this.v2.set(0, 1, 0), RADIUS, 0);
    this.fistSigil.set(this.fist, this.v1.copy(this.fwd).multiplyScalar(-0.8).setY(0.6), 0.75, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.matTime = 0;
    this.shake = 0;
    this.shedTimer = 0;
    this.sphereR = 0.3;
    this.arrivals.length = 0;
    this.starIds.length = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.drops.reset();
    this.star.reset();
    for (const f of this.fields) f.reset();
    this.pool.reset();
    this.sigil.reset();
    this.fistSigil.reset();
    for (const s of this.streams) s.reset();
    for (const d of this.drips) d.reset();
    this.dripCycle.fill(0);
    for (const t of this.beadTrails) t.reset();
    for (const b of this.beads) b.visible = false;
    this.sphere.visible = false;
    this.moon.visible = false;
    this.pop.set(this.point, 0, 0);
    this.chestPulse.set(this.chest, 0, 0);
    this.lens.set(this.sphereC, 0, 0);
    this.freezeRing.set(this.sphereC, 0, 0);
    this.groundRing.set(this.point, 0, 0);
    this.haze.set(this.point, 0, 0);
  }

  /** Stream i, u in 0..1: from the enemy's chest, up and curving in to the sphere surface. */
  private streamPath(i: number, u: number, out: THREE.Vector3) {
    const v = this.victims[i];
    if (!v) return out.copy(this.sphereC);
    const p0 = v.p0;
    const p1 = this.v4.copy(p0).addScaledVector(v.dirH, -0.4).setY(p0.y + 2.6);
    const p2x = this.sphereC.x + v.dirH.x * 2.2, p2y = this.sphereC.y + 0.6, p2z = this.sphereC.z + v.dirH.z * 2.2;
    const p3x = this.sphereC.x + v.dirH.x * this.sphereR * 0.7, p3y = this.sphereC.y - 0.2, p3z = this.sphereC.z + v.dirH.z * this.sphereR * 0.7;
    const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
    const tw = Math.sin(u * Math.PI) * 0.5 * Math.cos(v.phase + u * 4.5);
    return out.set(
      a * p0.x + b * p1.x + c * p2x + d * p3x + v.side.x * tw,
      a * p0.y + b * p1.y + c * p2y + d * p3y,
      a * p0.z + b * p1.z + c * p2z + d * p3z + v.side.z * tw,
    );
  }

  /** Bead i position on its orbit around the caster's shoulders (before the throw). */
  private beadOrbit(i: number, t: number, out: THREE.Vector3) {
    const a = t * 11 + (i / BEADS) * Math.PI * 2;
    return out.set(
      this.from.x + Math.cos(a) * 0.6 * -this.fwd.z + Math.sin(a) * 0.25 * this.fwd.x,
      1.7 + Math.sin(a) * 0.22,
      this.from.z + Math.cos(a) * 0.6 * this.fwd.x + Math.sin(a) * 0.25 * this.fwd.z,
    );
  }

  /** Bead i flight, u in 0..1: from its orbit position at the throw up to the top of the moon. */
  private beadPath(i: number, u: number, out: THREE.Vector3) {
    const t0 = BEAD_THROW[i];
    const p0 = this.beadOrbit(i, t0, this.v3);
    const a = (1 - u) ** 2, b = 2 * (1 - u) * u, c = u * u;
    return out.set(
      a * p0.x + b * p0.x + c * this.moonTop.x,
      a * p0.y + b * (p0.y + 5) + c * this.moonTop.y,
      a * p0.z + b * p0.z + c * this.moonTop.z,
    );
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const frozen = this.time >= HARVEST_END_T && this.time < FREEZE_T;
    if (!frozen) {
      this.drops.update(dt);
      this.matTime += dt;
    }
    this.star.update(dt);
    for (const f of this.fields) f.update(dt);
    this.pool.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.harvestHit && t >= HARVEST_HIT_T) {
      f.harvestHit = true;
      if (ctx) {
        for (const v of this.victims) {
          if (!this.inside(v.enemy)) continue;
          ctx.hit(v.enemy, { damage: this.settings.harvestDamage, knock: 0, color: BLOOD_CSS.body });
          ctx.healSelf?.(this.settings.heal); // the harvest heals her once per enemy hit
        }
      }
    }
    // Blood sheds off the streams while they tear up.
    if (t >= 1.05 && t < HARVEST_END_T && this.victims.length) {
      this.shedTimer += dt;
      while (this.shedTimer >= 0.035) {
        this.shedTimer -= 0.035;
        const v = this.victims[Math.floor(Math.random() * this.victims.length)];
        const i = this.victims.indexOf(v);
        this.streamPath(i, 0.25 + Math.random() * 0.55, this.v1);
        this.v2.set((Math.random() - 0.5) * 2.4, 0.5 + Math.random() * 2, (Math.random() - 0.5) * 2.4);
        this.drops.emit(this.v1, this.v2, 0.04 + Math.random() * 0.04, 1.2);
      }
    }
    if (!f.frozen && t >= FREEZE_T) {
      f.frozen = true;
      this.buildStar();
    }
    if (!f.landed && t >= LAND_T) {
      f.landed = true;
      this.land();
    }
    if (!f.drain && t >= DRAIN_T) {
      f.drain = true;
      this.victims.forEach((v, i) => {
        this.drops.drain(v.p0, (out) => out.copy(this.chest), 3, { delay: i * 0.03, stagger: 0.07, duration: 0.8, radius: 0.1, spread: 0.4 });
      });
    }
    if (!f.splatFade && t >= RELEASE_T - 0.1) {
      f.splatFade = true;
      this.drops.splats.fadeOutAll(0.6);
    }
    if (!f.shatter1 && t >= RELEASE_T) { f.shatter1 = true; this.star.shatter(5, 5, 0.5); this.fields[0].shatter(3, 5, 0.5); }
    if (!f.shatter2 && t >= RELEASE_T + 0.07) { f.shatter2 = true; this.fields[1].shatter(3, 5, 0.5); }
    if (!f.shatter3 && t >= RELEASE_T + 0.14) { f.shatter3 = true; this.fields[2].shatter(3, 5, 0.5); }
    if (!f.dried && t >= RELEASE_T - 0.1) { f.dried = true; this.pool.dry(0.4, 0.5); }

    this.layout();
  }

  /** The sphere becomes the thorn-star: 16 faceted spikes from one centre. */
  private buildStar() {
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < STAR_SPIKES; i++) {
      const y = 1 - (i + 0.5) / STAR_SPIKES * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * golden;
      const dir = this.v1.set(Math.cos(a) * r, y, Math.sin(a) * r);
      const len = [3.4, 2.3, 2.9][i % 3];
      this.starIds.push(this.star.spike(this.sphereC, dir, len, len * 0.2, 0, 0));
      this.starDirs[i].copy(dir);
    }
  }

  private starDirs = Array.from({ length: STAR_SPIKES }, () => new THREE.Vector3());

  /** The landing: ground ring, 60-80 thorns in a fast outward ring (the tallest under the enemies), accent star, pool. */
  private land() {
    const base = this.v1, dir = this.v2;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < ERUPT_COUNT; i++) {
      const rr = RADIUS * 0.97 * Math.sqrt((i + 0.5) / ERUPT_COUNT);
      const a = i * golden;
      const band = rr < RADIUS * 0.34 ? 0 : rr < RADIUS * 0.67 ? 1 : 2;
      base.set(this.point.x + Math.cos(a) * rr, 0, this.point.z + Math.sin(a) * rr);
      const lean = 0.12 + 0.25 * (rr / RADIUS);
      dir.set(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
      const h = (i % 2 === 0 ? 2.6 : 1.8) * (0.85 + Math.random() * 0.3);
      this.fields[band].spike(base, dir, h, h * 0.2, 0.16, (rr / RADIUS) * 0.22);
    }
    // Tall thorns directly under each enemy.
    for (const v of this.victims) {
      for (let k = 0; k < 2; k++) {
        const a = v.phase + k * Math.PI;
        base.set(v.pos.x + Math.cos(a) * 0.45, 0, v.pos.z + Math.sin(a) * 0.45);
        const r = Math.hypot(v.pos.x - this.point.x, v.pos.z - this.point.z);
        const band = r < RADIUS * 0.34 ? 0 : r < RADIUS * 0.67 ? 1 : 2;
        dir.set(Math.cos(a) * 0.12, 1, Math.sin(a) * 0.12);
        const h = 3.8 + Math.random() * 0.6;
        this.fields[band].spike(base, dir, h, h * 0.17, 0.14, (r / RADIUS) * 0.22);
      }
    }
    this.pool.spread(3, 0.5);
    this.drops.spray(this.v1.copy(this.point).setY(0.8), this.v2.set(0, 1, 0), 16, 7, 0.9);
    for (const v of this.victims) this.drops.spray(v.p0, this.v2.set(0, 1, 0), 3, 5, 0.8);
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) if (this.inside(v.enemy)) ctx.hit(v.enemy, { damage: this.settings.slamDamage, knock: 6, from: this.point, color: BLOOD_CSS.body });
  }

  /** Still inside the zone right now (live position, re-checked at every hit). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v1.set(0, 0, 0));
    this.reset();
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const after = t - LAND_T;

    // --- Screen: hard darken, a flash of light at the landing, the lift in the release. ---
    let dk = 0.7 * smoothstep(t / 0.4) * (1 - smoothstep((t - 3.45) / 0.95));
    if (after >= 0) dk *= 1 - 0.35 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, FREEZE_T, [1, 2], 0.04);

    // --- Bone sigil on the ground draws on around the zone, fades with the moon. ---
    this.sigil.reveal = smoothstep(t / 0.8);
    this.sigil.opacity = 1 - smoothstep((t - RELEASE_T) / 0.9);

    // --- Beads: orbit the shoulders, then thrown up one after another to the top of the moon. ---
    for (let i = 0; i < BEADS; i++) {
      const bead = this.beads[i], trail = this.beadTrails[i], pts = this.beadPts[i];
      const u = (t - BEAD_THROW[i]) / BEAD_FLIGHT;
      if (u >= 1) { bead.visible = false; trail.mesh.visible = false; continue; }
      bead.visible = true;
      bead.scale.setScalar(0.15);
      if (u < 0) {
        this.beadOrbit(i, t, bead.position);
        trail.mesh.visible = false;
      } else {
        const e = u * u * (3 - 2 * u) * 0.6 + u * 0.4;
        this.beadPath(i, e, bead.position);
        for (let k = 0; k < pts.length; k++) this.beadPath(i, Math.max(0, e - k * 0.045), pts[k]);
        trail.head = 1;
        trail.tail = 0;
        trail.update(t);
      }
    }

    // --- Moon: fades in over the zone and bleeds from the top; later pales and fades out. ---
    const mm = (this.moon.material as THREE.ShaderMaterial).uniforms;
    mm.uOpacity.value = smoothstep((t - 0.3) / 0.9) * (1 - smoothstep((t - 3.5) / 0.8));
    mm.uFill.value = MOON_FILL * smoothstep((t - 0.55) / 1.3) * (1 - 0.65 * smoothstep((t - 2.6) / 0.8));
    this.moon.visible = mm.uOpacity.value > 0.004;

    // --- Harvest: streams tear up out of every enemy into the forming sphere. ---
    const grow = smoothstep((t - 0.6) / 1.2);
    this.sphereR = 0.3 + (SPHERE_R - 0.3) * grow;
    const harvesting = t >= 0.6 && t < HARVEST_END_T;
    for (let i = 0; i < MAX_VICTIMS; i++) {
      const s = this.streams[i], v = this.victims[i];
      if (!harvesting || !v) { s.mesh.visible = false; continue; }
      const head = 1 - (1 - c01((t - 0.6 - v.delay) / 0.5)) ** 3;
      const tail = (1 - (1 - c01((t - 1.0 - v.delay * 0.5) / 0.7)) ** 2);
      s.head = head;
      s.tail = Math.min(tail, head - 0.001);
      s.update(this.matTime);
    }
    const su = (this.sphere.material as THREE.ShaderMaterial).uniforms;
    su.uTime.value = this.matTime;
    su.uWob.value = t < HARVEST_END_T ? 0.4 + 0.3 * grow : 0;
    // Short drips hang from the underside, stretch, pinch off and fall as drops (frozen in the dead beat).
    for (let k = 0; k < DRIPS; k++) {
      const dr = this.drips[k], pts = this.dripPts[k];
      const cyc = (this.matTime - 0.9 + k * 0.14) / 0.55;
      if (t >= FREEZE_T || !this.sphere.visible || cyc < 0) { dr.mesh.visible = false; continue; }
      const idx = Math.floor(cyc), u = cyc - idx;
      const a = k * 1.9 + idx * 0.7, off = this.sphereR * (0.3 + 0.25 * ((k * 5 + idx * 3) % 4) / 3);
      const rx = Math.cos(a) * off, rz = Math.sin(a) * off;
      const ry = this.sphereC.y - Math.sqrt(Math.max(0, this.sphereR * this.sphereR - off * off)) + 0.06;
      if (idx > this.dripCycle[k] && t < HARVEST_END_T) {
        // The previous drip pinched off: a drop leaves the tip.
        this.dripCycle[k] = idx;
        this.v1.set(this.sphereC.x + rx, ry - 0.8, this.sphereC.z + rz);
        this.v2.set(0, -1.2, 0);
        this.drops.emit(this.v1, this.v2, 0.07, 1.4);
      }
      const L = 0.12 + 0.75 * u * u;
      pts[0].set(this.sphereC.x + rx, ry, this.sphereC.z + rz);
      pts[1].set(this.sphereC.x + rx, ry - L, this.sphereC.z + rz);
      dr.head = 1; dr.tail = 0;
      dr.update(this.matTime);
    }
    this.sphere.visible = t >= 0.6 && t < FREEZE_T;
    this.sphere.position.copy(this.sphereC);
    this.sphere.scale.setScalar(Math.max(this.sphereR, 1e-3));

    // Enemies are lifted while they are drained, and drop back onto the thorns.
    if (ctx) {
      const lift = t < LAND_T ? 0.4 * smoothstep((t - 0.6) / 0.3) : 0.4 * (1 - smoothstep(after / 0.12));
      for (const v of this.victims) ctx.displace(v.enemy, this.v1.set(0, lift, 0));
    }

    // --- Distortion: a slow pulsing lens around the growing sphere; the freeze ring; the ground ring; haze. ---
    const lensOn = harvesting ? 0.03 * (0.7 + 0.3 * Math.sin(t * 7)) * smoothstep((t - 0.6) / 0.2) : 0;
    this.lens.set(this.sphereC, this.sphereR * 2 + 0.3, lensOn);
    const fz = (t - FREEZE_T) / 0.4;
    this.freezeRing.set(this.sphereC, 1 + 5 * c01(fz), fz >= 0 && fz < 1 ? 0.06 * (1 - fz) * (1 - fz) : 0);
    const gp = c01(after / 0.5);
    this.groundRing.set(this.point, 1 + 5 * gp, f.landed && gp < 1 ? 0.07 * (1 - gp) * (1 - gp) : 0);
    const hz = after / 1.0;
    this.haze.set(this.point, hz >= 0 && hz < 1 ? 0.012 * (1 - hz * hz) : 0, t);

    // --- Dead beat: a small bone sigil flares at the raised fist. ---
    const fk = t - HARVEST_END_T;
    this.fistSigil.reveal = fk >= 0 ? 1 : 0;
    this.fistSigil.opacity = fk < 0 ? 0 : c01(fk / 0.06) * (1 - smoothstep((t - FREEZE_T) / 0.35));

    // --- The star: falls (accelerating) onto the point, bottom spikes first. ---
    if (f.frozen) {
      const u = c01((t - FREEZE_T) / (LAND_T - FREEZE_T));
      this.v1.copy(this.sphereC);
      this.v1.y = SPHERE_H + (STAR_END_Y - SPHERE_H) * u * u;
      for (let i = 0; i < this.starIds.length; i++) this.star.place(this.starIds[i], this.v1, this.starDirs[i]);
    }

    // --- Landing: accent star for 3 frames, shake. ---
    if (f.landed) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.2), 2 * sp.scale, sp.opacity, 0.2);
      this.shake = 0.7 * Math.exp(-after * 9);
    }

    // --- Drain: a tiny crimson pulse at the chest for every drop that arrives. ---
    let ps = 0;
    for (const ta of this.arrivals) ps = Math.max(ps, StarBurst.pop(t - ta, 0, 0.07).scale);
    this.chestPulse.set(this.chest, 0.55 * ps, ps > 0 ? 1 : 0, 0);
  }
}

// Bead throw times and flight time (seconds).
const BEAD_THROW = [0.1, 0.2, 0.3];
const BEAD_FLIGHT = 0.45;

export const sanguineEclipseModule: EffectModule = {
  label: 'sanguine eclipse',
  category: 'hero: blood',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new SanguineEclipse(),
  telegraphs(effect) {
    const e = effect as SanguineEclipse;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: LAND_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SanguineEclipse;
    if (e.ctx) frameCast(camera, controls, e.ctx, 8);
  },
  buildGui(f, effect) {
    const s = (effect as SanguineEclipse).settings;
    f.add(s, 'loop');
    f.add(s, 'harvestDamage', 1, 100, 1);
    f.add(s, 'slamDamage', 1, 300, 1);
    f.add(s, 'heal', 0, 60, 1);
  },
};
