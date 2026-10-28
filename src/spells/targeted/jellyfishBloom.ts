import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  LightningArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Jellyfish Bloom (targeted, `enemies`, up to six targets; deep-sea theme): twelve bioluminescent jellyfish
 * (translucent dark-violet bells with a thin fresnel rim, a soft rib-and-lobe pattern inside, long thin ribbon
 * tentacles that sway and trail) rise in a fan in front of the caster while the world sinks to deep-sea blue and
 * plankton motes drift. They glide to the enemies in pulse-and-glide strokes (they only advance on the bell's
 * contraction), two per target, and hang over them with the tentacles dangling. A dead beat (the bells inhale),
 * then at D every bell contracts at once: a thin soft cyan-violet chain of lightning links the jellyfish, short
 * violet impact frames, pink sting stars and a small ink puff on each enemy, one hit per enemy. The jellyfish then
 * drift upward and dim out one by one, plankton lingers.
 *
 * Palette (value ladder): core #f4ffff, hot #7ff8ff, body #a07aff, accent #ff7ad8, dark #04081a.
 * Recipes: e-yougelly-starfall-comets (slow drifting projectiles with trails), j-abitofgamedev-refraction-bubble
 * (translucent fresnel shell), a-smite-zeus-chain-lightning (chain between targets).
 */
export interface JellyfishBloomSettings {
  damage: number;
  loop: boolean;
}

export const defaultJellyfishBloom = (): JellyfishBloomSettings => ({ damage: 35, loop: false });

const JELLY = 12;
const RIBBONS = 7; // per jellyfish: 2 short thick oral arms + 5 long thin tentacles
const NODES = 10; // points per ribbon
const MAXT = 6;
const D = 2.75; // synchronised sting
const DURATION = 5.1;
const WHITE = 0xf4ffff;
const CYAN = 0x7ff8ff;
const VIOLET = 0xa07aff;
const PINK = 0xff7ad8;
const DEEP = 0x04081a;
const BELL_R = 0.62;
const HOVER_Y = 3.0;
const PERIOD = 0.55; // seconds per bell stroke

const rise = (i: number) => 0.05 + 0.05 * i;
const depart = (i: number) => 0.85 + 0.03 * i;
const arrive = (i: number) => 2.2 + 0.02 * i;
const fadeStart = (i: number) => D + 0.25 + 0.12 * i;
const tau = (i: number, t: number) => (t - 0.05 * i) / PERIOD;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3);
const easeOutBack = (x: number) => {
  const k = THREE.MathUtils.clamp(x, 0, 1) - 1;
  return 1 + 2.2 * k * k * k + 1.2 * k * k;
};
/** Stroke progress: jumps forward during the first 45 % of every cycle (the contraction), rests the rest. */
const stroke = (x: number) => {
  const f = Math.floor(x);
  return f + easeOutCubic((x - f) / 0.45);
};
/** Bell contraction -0.25..1 for a cycle position. */
const contraction = (x: number) => {
  const fr = x - Math.floor(x);
  return fr < 0.45 ? Math.sin((Math.PI * fr) / 0.45) : -0.25 * Math.sin((Math.PI * (fr - 0.45)) / 0.55);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const BELL_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

/** Dark deep-sea violet, mostly see-through: a little denser toward the silhouette so the bell holds. Normal blend. */
function fillMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(0x120c3c) }, uAlpha: { value: 0 } },
    vertexShader: BELL_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha;
      varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
      void main() {
        float facing = abs(dot(vN, vView));
        gl_FragColor = vec4(uColor, uAlpha * (0.14 + 0.16 * pow(1.0 - facing, 1.5)));
      }`,
  });
}

/** Additive thin rim + mouth edge + soft inner ribs and four pink gonad lobes. uOpacity stays <= 0.3 per bell. */
function rimMaterial(seed: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0 }, uGlow: { value: 0 }, uSeed: { value: seed },
      uCyan: { value: new THREE.Color(CYAN) }, uViolet: { value: new THREE.Color(VIOLET) },
      uPink: { value: new THREE.Color(PINK) }, uWhite: { value: new THREE.Color(WHITE) },
    },
    vertexShader: BELL_VERT,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; uniform float uGlow; uniform float uSeed;
      uniform vec3 uCyan; uniform vec3 uViolet; uniform vec3 uPink; uniform vec3 uWhite;
      varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
      void main() {
        float facing = abs(dot(vN, vView));
        float rim = pow(1.0 - facing, 3.6);
        float mouth = 1.0 - smoothstep(0.0, 0.06, vLocal.y);
        float ang = atan(vLocal.z, vLocal.x);
        float r = length(vLocal.xz);
        float ribs = pow(abs(sin(ang * 4.0 + uSeed)), 10.0)
          * smoothstep(0.03, 0.18, vLocal.y) * (1.0 - smoothstep(0.7, 0.98, vLocal.y));
        float lobes = smoothstep(0.55, 0.95, cos(ang * 4.0 + uSeed + 0.785))
          * (1.0 - smoothstep(0.0, 0.12, abs(r - 0.46))) * (1.0 - smoothstep(0.55, 0.8, vLocal.y));
        float apex = smoothstep(0.93, 1.0, vLocal.y);
        float a = clamp(rim * 0.9 + mouth * 0.55 + ribs * 0.3 + lobes * (0.35 + 0.4 * uGlow) + apex * 0.4, 0.0, 1.0);
        vec3 col = mix(uViolet, uCyan, smoothstep(0.1, 0.9, rim + ribs + mouth * 0.5));
        col = mix(col, uPink, clamp(lobes, 0.0, 1.0));
        col = mix(col, uWhite, apex * 0.6);
        gl_FragColor = vec4(col * 1.5, a * uOpacity);
      }`,
  });
}

/** One draw call for every tentacle ribbon: camera-facing strips built in the vertex shader from the centre line. */
function tentacleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uBase: { value: 0.32 } },
    vertexShader: /* glsl */ `
      attribute vec3 aDir; attribute float aSide; attribute float aS; attribute float aAlpha;
      attribute vec3 aColor; attribute float aW;
      varying float vSide; varying float vS; varying float vAlpha; varying vec3 vColor;
      void main() {
        vSide = aSide; vS = aS; vAlpha = aAlpha; vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 t = normalize(mat3(modelViewMatrix) * aDir + vec3(1e-5));
        vec2 sd = normalize(vec2(-t.y, t.x) + vec2(1e-4, 0.0));
        float pinch = smoothstep(0.0, 0.08, aS);
        mv.xy += sd * aSide * aW * (1.0 - 0.75 * aS) * pinch;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uBase;
      varying float vSide; varying float vS; varying float vAlpha; varying vec3 vColor;
      void main() {
        float edge = 1.0 - smoothstep(0.3, 1.0, abs(vSide));
        float along = pow(max(0.0, 1.0 - vS), 0.7);
        float blob = 0.65 + 0.35 * sin(vS * 14.0 - uTime * 3.0);
        gl_FragColor = vec4(vColor * 1.4, vAlpha * uBase * edge * along * blob);
      }`,
  });
}

export class JellyfishBloom implements Effect {
  readonly group = new THREE.Group();
  readonly settings: JellyfishBloomSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private stung = false;
  private inked = false;

  // Cast geometry.
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private centroid = new THREE.Vector3();
  private targetPts: THREE.Vector3[] = [new THREE.Vector3()];
  private hoverPos: THREE.Vector3[] = Array.from({ length: JELLY }, () => new THREE.Vector3());
  private targetIdx: number[] = Array(JELLY).fill(0);
  private chain: number[] = Array.from({ length: JELLY }, (_, i) => i);
  private moteBoxMin = new THREE.Vector3();
  private moteBoxSize = new THREE.Vector3(10, 6, 10);

  // Jellyfish state.
  private pos: THREE.Vector3[] = Array.from({ length: JELLY }, () => new THREE.Vector3());
  private prev: THREE.Vector3[] = Array.from({ length: JELLY }, () => new THREE.Vector3());
  private vel: THREE.Vector3[] = Array.from({ length: JELLY }, () => new THREE.Vector3());
  private tilt: THREE.Quaternion[] = Array.from({ length: JELLY }, () => new THREE.Quaternion());
  private live: boolean[] = Array(JELLY).fill(false);
  private size: number[] = Array(JELLY).fill(1);
  private bellScaleX: number[] = Array(JELLY).fill(1);
  private alpha: number[] = Array(JELLY).fill(0);
  private bells: THREE.Group[] = [];
  private fills: THREE.ShaderMaterial[] = [];
  private rims: THREE.ShaderMaterial[] = [];

  // Tentacles: one dynamic geometry for all of them.
  private tentMat = tentacleMaterial();
  private tentGeo = new THREE.BufferGeometry();
  private tPos = new Float32Array(JELLY * RIBBONS * NODES * 2 * 3);
  private tDir = new Float32Array(JELLY * RIBBONS * NODES * 2 * 3);
  private tAlpha = new Float32Array(JELLY * RIBBONS * NODES * 2);
  private ribbonPhase: number[] = [];
  private ribbonAngle: number[] = [];
  private ribbonLen: number[] = [];
  private nodeBuf: THREE.Vector3[] = Array.from({ length: NODES }, () => new THREE.Vector3());

  // Motes, rings, links, stings.
  private moteGeo = new THREE.BufferGeometry();
  private motePos = new Float32Array(100 * 3);
  private moteSeed = Array.from({ length: 100 }, () => ({
    u: Math.random(), v: Math.random(), w: Math.random(), a: Math.random() * 6.28, s: 0.2 + Math.random() * 0.4,
  }));
  private moteMat = new THREE.PointsMaterial({
    size: 0.13, map: softDotTexture(), color: CYAN, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private motes = new THREE.Points(this.moteGeo, this.moteMat);
  private rings = Array.from({ length: MAXT }, () => createRing(CYAN, 0.9, 1, 64));
  private links: LightningArc[] = [];
  private stings: LightningArc[] = [];
  private arcClock = 0;
  private stars: StarBurst[] = [];
  private smoke = new SmokeBall({ color: DEEP, rim: 0x1a2a6a, flake: DEEP, maxBalls: MAXT });
  private glints: Emitter;

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private tmpD = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();

  constructor(settings: JellyfishBloomSettings = defaultJellyfishBloom()) {
    this.settings = settings;
    this.screen.tint.set(0x12306a);
    this.screen.impactColor.set(VIOLET);
    this.screen.edgeTint.set(PINK);
    this.screen.speedLineColor.set(CYAN);

    const bellGeo = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    for (let i = 0; i < JELLY; i++) {
      const fill = fillMaterial();
      const rim = rimMaterial(i * 1.7);
      const fillMesh = new THREE.Mesh(bellGeo, fill);
      const rimMesh = new THREE.Mesh(bellGeo, rim);
      fillMesh.renderOrder = 20 + i * 2;
      rimMesh.renderOrder = 21 + i * 2;
      fillMesh.frustumCulled = false;
      rimMesh.frustumCulled = false;
      const bell = new THREE.Group();
      bell.add(fillMesh, rimMesh);
      bell.visible = false;
      this.bells.push(bell);
      this.fills.push(fill);
      this.rims.push(rim);
      this.size[i] = 0.9 + 0.25 * hash(i + 3);
      this.group.add(bell);
      for (let r = 0; r < RIBBONS; r++) {
        this.ribbonPhase.push(hash(i * 13 + r) * 6.28);
        this.ribbonAngle.push((r / RIBBONS) * Math.PI * 2 + hash(i + 40) * 6.28);
        this.ribbonLen.push(r < 2 ? 1.1 + 0.3 * hash(i * 7 + r) : 2.0 + 0.7 * hash(i * 7 + r));
      }
    }

    // Ribbon strip topology: NODES x 2 vertices per ribbon.
    const verts = JELLY * RIBBONS * NODES * 2;
    const side = new Float32Array(verts);
    const sAlong = new Float32Array(verts);
    const width = new Float32Array(verts);
    const color = new Float32Array(verts * 3);
    const index: number[] = [];
    const tone = [new THREE.Color(PINK), new THREE.Color(CYAN), new THREE.Color(VIOLET), new THREE.Color(CYAN), new THREE.Color(VIOLET)];
    for (let j = 0; j < JELLY * RIBBONS; j++) {
      const r = j % RIBBONS;
      const c = r < 2 ? tone[0].clone().lerp(new THREE.Color(VIOLET), 0.4) : tone[r - 2];
      for (let k = 0; k < NODES; k++) {
        for (let s = 0; s < 2; s++) {
          const v = (j * NODES + k) * 2 + s;
          side[v] = s === 0 ? -1 : 1;
          sAlong[v] = k / (NODES - 1);
          width[v] = r < 2 ? 0.05 : 0.026;
          color[v * 3] = c.r; color[v * 3 + 1] = c.g; color[v * 3 + 2] = c.b;
        }
        if (k < NODES - 1) {
          const v = (j * NODES + k) * 2;
          index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
        }
      }
    }
    this.tentGeo.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.tentGeo.setAttribute('aDir', new THREE.BufferAttribute(this.tDir, 3).setUsage(THREE.DynamicDrawUsage));
    this.tentGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this.tAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.tentGeo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    this.tentGeo.setAttribute('aS', new THREE.BufferAttribute(sAlong, 1));
    this.tentGeo.setAttribute('aW', new THREE.BufferAttribute(width, 1));
    this.tentGeo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    this.tentGeo.setIndex(index);
    const tents = new THREE.Mesh(this.tentGeo, this.tentMat);
    tents.frustumCulled = false;
    tents.renderOrder = 15;
    this.group.add(tents);

    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motes.frustumCulled = false;
    this.group.add(this.motes);

    for (const r of this.rings) this.group.add(r.mesh);

    // Thin, soft chain: low width, few forks, re-rolled every 3 frames.
    for (let i = 0; i < JELLY - 1; i++) {
      const arc = new LightningArc({ width: 0.07, segments: 10, jitter: 0.08, branches: 1, rerollEvery: 0.05, dropChance: 0.18, core: 0xbff8ff, glow: VIOLET });
      arc.mesh.renderOrder = 50;
      this.links.push(arc);
      this.group.add(arc.mesh);
    }
    for (let i = 0; i < MAXT; i++) {
      const arc = new LightningArc({ width: 0.09, segments: 8, jitter: 0.07, branches: 1, rerollEvery: 0.05, dropChance: 0.18, core: 0xbff8ff, glow: PINK });
      arc.mesh.renderOrder = 51;
      this.stings.push(arc);
      this.group.add(arc.mesh);
      const star = new StarBurst({ points: 6, inner: 0.26, color: PINK, core: WHITE, additive: false });
      star.mesh.renderOrder = 60;
      this.stars.push(star);
      this.group.add(star.mesh);
    }

    this.smoke.hold = 0.15;
    this.glints = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.2, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.15, speed: 0.5, speedJitter: 0.8, spread: 180, gravity: -0.5, drag: 1.4,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#f4ffff', colorEnd: '#a07aff',
      opacityStart: 0.4, opacityEnd: 0, additive: true, colorMid: '#7ff8ff', sizeJitter: 0.5, erosion: 0.3, spin: 0.4,
    });
    this.emitters.push(this.glints, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.group.add(this.smoke.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    this.targetPts = pts.map((p) => p.clone());
    this.centroid.set(0, 0, 0);
    for (const p of pts) this.centroid.add(p);
    this.centroid.divideScalar(pts.length).setY(0);

    // Two per target (cycled); extra visits to one enemy ring it at different angles and heights.
    const n = pts.length;
    const counts = Array(n).fill(0);
    for (let i = 0; i < JELLY; i++) counts[i % n]++;
    const seen = Array(n).fill(0);
    for (let i = 0; i < JELLY; i++) {
      const j = i % n;
      const k = seen[j]++;
      this.targetIdx[i] = j;
      const ang = (k / counts[j]) * Math.PI * 2 + j * 1.3 + 0.6;
      const rad = counts[j] <= 2 ? 0.85 : 1.0 + 0.45 * (k % 2);
      this.hoverPos[i].copy(pts[j]).setY(HOVER_Y + 0.35 * (k % 2));
      this.hoverPos[i].addScaledVector(this.right, Math.cos(ang) * rad).addScaledVector(this.fwd, Math.sin(ang) * rad);
    }
    this.chain = Array.from({ length: JELLY }, (_, i) => i).sort((a, b) => this.targetIdx[a] - this.targetIdx[b] || a - b);

    // Plankton fills the volume from the caster to the targets.
    const box = new THREE.Box3().setFromPoints([this.from, ...pts]).expandByScalar(3);
    this.moteBoxMin.copy(box.min).setY(0.3);
    box.getSize(this.moteBoxSize);
    this.moteBoxSize.y = 6;

    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(2.2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.stung = false;
    this.inked = false;
    this.shake = 0;
    this.arcClock = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (let i = 0; i < JELLY; i++) {
      this.live[i] = false;
      this.vel[i].set(0, 0, 0);
      this.tilt[i].identity();
    }
    this.layout(0);
  }

  update(dt: number) {
    this.glints.update(dt);
    this.smoke.update(dt);
    for (const a of this.links) a.update(dt);
    for (const a of this.stings) a.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    if (!this.stung && this.time >= D) this.onSting();
    if (!this.inked && this.time >= D + 0.06) this.onInk();
    this.layout(dt);
  }

  /** Where jellyfish i floats in the fan in front of the caster. */
  private fanPos(i: number, t: number, out: THREE.Vector3) {
    const th = (i / (JELLY - 1) - 0.5) * Math.PI * 1.1 + 0.12 * Math.sin(t * 0.7 + i);
    const r = 2.4 + 0.5 * (i % 3) + 0.15 * Math.sin(t * 1.1 + i * 2);
    const h = 0.7 + (1.3 + 0.55 * (i % 3)) * easeOutCubic((t - rise(i)) / 0.8) + 0.1 * Math.sin(t * 1.9 + i * 1.3);
    return out.copy(this.from)
      .addScaledVector(this.fwd, Math.cos(th) * r)
      .addScaledVector(this.right, Math.sin(th) * r)
      .setY(h + 0.9);
  }

  /** Position of jellyfish i at time t (no side effects). */
  private place(i: number, t: number, out: THREE.Vector3) {
    const td = depart(i), ta = arrive(i);
    if (t < td) return this.fanPos(i, t, out);
    const hover = this.hoverPos[i];
    if (t < ta) {
      const a = this.fanPos(i, td, this.tmpB);
      const ga = Math.max(stroke(tau(i, ta)) - stroke(tau(i, td)), 0.5);
      const u = THREE.MathUtils.clamp((stroke(tau(i, t)) - stroke(tau(i, td))) / ga, 0, 1);
      const d = this.tmpC.copy(hover).sub(a);
      const dist = Math.max(d.length(), 1e-3);
      const side = this.tmpD.set(-d.z, 0, d.x);
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
      side.normalize();
      out.copy(a).lerp(hover, u).addScaledVector(side, Math.sin(u * Math.PI) * dist * 0.1 * (i % 2 ? 1 : -1));
      out.y += Math.sin(u * Math.PI) * 0.7;
      return out;
    }
    out.copy(hover);
    out.x += 0.1 * Math.sin(t * 0.9 + i * 1.7);
    out.z += 0.1 * Math.cos(t * 0.8 + i * 2.3);
    out.y += 0.07 * Math.sin(t * 1.6 + i);
    const f0 = fadeStart(i) - 0.15;
    if (t > f0) {
      const a = t - f0;
      out.y += 0.8 * a + 0.25 * Math.sin(a * 5);
    }
    return out;
  }

  private layout(dt: number) {
    const t = this.time;
    const afterD = t - D;
    const running = t < DURATION;

    // --- World: sinks to deep-sea blue, holds until the sting, clears over the aftermath. ---
    this.screen.darken = t < D
      ? 0.8 * smoothstep(t / 0.8)
      : 0.8 * (1 - smoothstep((t - (D + 0.5)) / 1.6));
    this.screen.speedLines = t < D ? 0.3 * smoothstep((t - (D - 0.3)) / 0.3) : Math.max(0, 0.3 - afterD * 4);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D + 0.04, 0.5);
    this.tentMat.uniforms.uTime.value = t;

    // --- Plankton motes: tiny and sparse, drifting, lingering to the end. ---
    const moteOp = 0.4 * smoothstep(t / 0.8) * (1 - smoothstep((t - (DURATION - 0.7)) / 0.7));
    this.moteMat.opacity = running ? moteOp : 0;
    for (let m = 0; m < this.moteSeed.length; m++) {
      const s = this.moteSeed[m];
      this.motePos[m * 3] = this.moteBoxMin.x + s.u * this.moteBoxSize.x + Math.sin(t * s.s + s.a) * 0.4;
      this.motePos[m * 3 + 1] = this.moteBoxMin.y + ((s.v * this.moteBoxSize.y + t * s.s * 0.35) % this.moteBoxSize.y);
      this.motePos[m * 3 + 2] = this.moteBoxMin.z + s.w * this.moteBoxSize.z + Math.cos(t * s.s * 0.8 + s.a) * 0.4;
    }
    this.moteGeo.attributes.position.needsUpdate = true;

    // --- Jellyfish bells. ---
    for (let i = 0; i < JELLY; i++) {
      const bell = this.bells[i];
      const t0 = rise(i);
      const fo = 1 - smoothstep((t - fadeStart(i)) / 0.7);
      const appear = smoothstep((t - t0) / 0.35);
      const al = appear * fo;
      this.alpha[i] = al;
      this.live[i] = running && al > 0.01;
      if (!this.live[i]) { bell.visible = false; continue; }
      bell.visible = true;

      const p = this.place(i, t, this.tmpA);
      if (dt > 0) {
        this.tmpB.copy(p).sub(this.prev[i]).divideScalar(dt);
        if (this.tmpB.lengthSq() > 36) this.tmpB.setLength(6);
        this.vel[i].lerp(this.tmpB, 1 - Math.exp(-dt * 6));
      }
      this.prev[i].copy(p);
      this.pos[i].copy(p);

      // Bell stroke: sharp contraction, slow recovery; the dead beat inhales, the sting snaps.
      const settled = t >= arrive(i);
      let c = contraction(tau(i, t)) * (settled ? 0.45 : 1);
      if (t > D - 0.25 && t < D) c = THREE.MathUtils.lerp(c, -0.45, smoothstep((t - (D - 0.25)) / 0.15));
      if (t >= D) c = THREE.MathUtils.lerp(c, 1, Math.exp(-afterD * 5));
      const grow = easeOutBack((t - t0) / 0.45);
      const sz = Math.max(1e-3, BELL_R * this.size[i] * grow);
      const sx = sz * (1 - 0.2 * c);
      this.bellScaleX[i] = sx / BELL_R;
      bell.scale.set(sx, Math.max(1e-3, sz * 0.85 * (1 + 0.28 * c)), sx);
      bell.position.copy(p);

      // Lean into the direction of travel, smoothed.
      const v = this.vel[i];
      this.tmpC.set(v.z, 0, -v.x);
      const sp = Math.hypot(v.x, v.z);
      if (sp > 1e-3) this.tmpQ.setFromAxisAngle(this.tmpC.normalize(), Math.min(0.35, sp * 0.07));
      else this.tmpQ.identity();
      this.tilt[i].slerp(this.tmpQ, dt > 0 ? 1 - Math.exp(-dt * 5) : 1);
      bell.quaternion.copy(this.tilt[i]);

      // Glow builds toward the sting, flashes at it, then settles; rim opacity capped at 0.3.
      const glow = THREE.MathUtils.clamp(
        0.15 + 0.55 * smoothstep((t - 2.1) / 0.6) + (t >= D ? 0.7 * Math.exp(-afterD * 4) : 0), 0, 1);
      this.rims[i].uniforms.uGlow.value = glow;
      this.rims[i].uniforms.uOpacity.value = al * (0.18 + 0.12 * glow);
      this.fills[i].uniforms.uAlpha.value = al;

      // A faint glint on every stroke while gliding.
      if (dt > 0 && t >= depart(i) && t < arrive(i)) {
        const fr = tau(i, t) - Math.floor(tau(i, t));
        const frPrev = tau(i, t - dt) - Math.floor(tau(i, t - dt));
        if (fr < frPrev) this.glints.burst(2, this.tmpB.copy(p).setY(p.y - 0.3));
      }
    }

    this.updateTentacles(t);

    // --- Target rings: close in while the jellyfish arrive, pulse at the sting. ---
    const tn = this.targetPts.length;
    for (let j = 0; j < MAXT; j++) {
      const ring = this.rings[j];
      if (j >= tn || !running) { ring.material.opacity = 0; ring.mesh.visible = false; continue; }
      const tp = this.targetPts[j];
      const lock = smoothstep((t - 1.4) / 1.0);
      ring.mesh.visible = true;
      ring.mesh.position.set(tp.x, 0.05, tp.z);
      ring.mesh.scale.setScalar(t < D ? 2.2 - 0.9 * lock : 1.3 + afterD * 3);
      ring.mesh.rotation.z = t * 0.6;
      ring.material.opacity = t < D ? 0.2 * lock : 0.35 * Math.exp(-afterD * 3);
    }

    // --- Chain + stings + stars after D. ---
    this.arcClock += dt;
    const refresh = this.arcClock >= 0.05;
    if (refresh) this.arcClock = 0;
    for (let li = 0; li < this.links.length; li++) {
      const arc = this.links[li];
      const start = D + 0.03 * li;
      const a = t - start;
      const a0 = this.pos[this.chain[li]], b0 = this.pos[this.chain[li + 1]];
      arc.opacity = running && a >= 0 && this.live[this.chain[li]] && this.live[this.chain[li + 1]]
        ? 0.4 * Math.exp(-a * 2.6) : 0;
      if (arc.opacity > 0.002 && (refresh || a < 0.06)) {
        arc.setEnds(this.tmpA.copy(a0).setY(a0.y + 0.1), this.tmpB.copy(b0).setY(b0.y + 0.1));
      }
    }
    for (let j = 0; j < MAXT; j++) {
      const arc = this.stings[j];
      const star = this.stars[j];
      if (j >= tn || !running || t < D) {
        arc.opacity = 0;
        star.set(this.tmpA.set(0, 0, 0), 0, 0);
        continue;
      }
      const first = this.firstJelly(j);
      arc.opacity = first >= 0 && this.live[first] ? 0.42 * Math.exp(-afterD * 3.2) : 0;
      if (arc.opacity > 0.002 && (refresh || afterD < 0.06) && first >= 0) {
        const tp = this.targetPts[j];
        arc.setEnds(this.tmpA.copy(this.pos[first]), this.tmpB.set(tp.x, 1.3, tp.z));
      }
      const pop = StarBurst.pop(afterD - j * 0.015);
      if (pop.opacity === 0) star.set(this.tmpA.set(0, 0, 0), 0, 0);
      else star.set(this.tmpA.set(this.targetPts[j].x, 1.4, this.targetPts[j].z), 1.7 * pop.scale, 0.9 * pop.opacity, j * 0.7);
    }

    this.shake = t >= D ? 0.3 * Math.exp(-afterD * 8) : 0;
  }

  private firstJelly(j: number) {
    for (let i = 0; i < JELLY; i++) if (this.targetIdx[i] === j) return i;
    return -1;
  }

  /** Rewrites every ribbon: hangs from the bell mouth, sways, trails behind the motion, lags the stroke. */
  private updateTentacles(t: number) {
    const nb = this.nodeBuf;
    for (let i = 0; i < JELLY; i++) {
      const base = i * RIBBONS;
      const live = this.live[i];
      const p = this.pos[i];
      const v = this.vel[i];
      const c = live ? contraction(tau(i, t)) : 0;
      const rad = BELL_R * this.size[i] * this.bellScaleX[i] * 0.78;
      for (let r = 0; r < RIBBONS; r++) {
        const j = base + r;
        const a = this.ribbonAngle[j];
        const oral = r < 2;
        const len = this.ribbonLen[j];
        const rr = rad * (oral ? 0.35 : 1);
        const ox = Math.cos(a) * rr, oz = Math.sin(a) * rr;
        for (let k = 0; k < NODES; k++) {
          const s = k / (NODES - 1);
          const ph = this.ribbonPhase[j] + t * 1.6 - s * 3.5;
          const amp = (oral ? 0.1 : 0.16) * Math.pow(s, 1.2);
          const lag = 0.11 * Math.pow(s, 1.5);
          const pull = 1 - 0.35 * Math.max(0, c) * s;
          const n = nb[k];
          n.set(
            p.x + ox * pull - v.x * lag + Math.sin(ph) * amp,
            p.y - 0.02 - len * s * (1 - 0.05 * Math.max(0, c)) - v.y * lag * 0.5,
            p.z + oz * pull - v.z * lag + Math.cos(ph * 0.8 + 1.3) * amp * 0.8,
          );
        }
        for (let k = 0; k < NODES; k++) {
          const n = nb[k];
          const a0 = nb[Math.max(0, k - 1)], b0 = nb[Math.min(NODES - 1, k + 1)];
          this.tmpD.copy(b0).sub(a0);
          if (this.tmpD.lengthSq() < 1e-10) this.tmpD.set(0, -1, 0);
          for (let sd = 0; sd < 2; sd++) {
            const vi = (j * NODES + k) * 2 + sd;
            this.tPos[vi * 3] = n.x; this.tPos[vi * 3 + 1] = n.y; this.tPos[vi * 3 + 2] = n.z;
            this.tDir[vi * 3] = this.tmpD.x; this.tDir[vi * 3 + 1] = this.tmpD.y; this.tDir[vi * 3 + 2] = this.tmpD.z;
            this.tAlpha[vi] = live ? this.alpha[i] * (oral ? 0.8 : 1) : 0;
          }
        }
      }
    }
    this.tentGeo.attributes.position.needsUpdate = true;
    this.tentGeo.attributes.aDir.needsUpdate = true;
    this.tentGeo.attributes.aAlpha.needsUpdate = true;
  }

  private onSting() {
    this.stung = true;
    const ctx = this.ctx;
    for (let i = 0; i < JELLY; i++) {
      if (this.live[i]) this.glints.burst(10, this.tmpA.copy(this.pos[i]).setY(this.pos[i].y - 0.2));
    }
    this.tmpB.copy(this.centroid).setY(HOVER_Y);
    if (!ctx) return;
    ctx.targets.forEach((e) => {
      ctx.hit(e, { damage: this.settings.damage, knock: 1, from: this.tmpB, color: '#ff7ad8' });
    });
  }

  /** Small deep-sea ink puffs behind the sting stars (black is a colour). */
  private onInk() {
    this.inked = true;
    for (let j = 0; j < this.targetPts.length && j < MAXT; j++) {
      const tp = this.targetPts[j];
      this.smoke.trigger(this.tmpA.set(tp.x, 1.0, tp.z), 0.8, 0.35);
      this.glints.burst(14, this.tmpA.set(tp.x, 1.3, tp.z));
    }
  }
}

export const jellyfishBloomModule: EffectModule = {
  label: 'jellyfish bloom',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAXT },
  create: () => new JellyfishBloom(),
  telegraphs(effect) {
    const e = effect as JellyfishBloom;
    const pts = e.ctx?.targetPos ?? [];
    return pts.map((p, j) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.6 }, start: depart(j) + 0.2, impact: D,
    }));
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as JellyfishBloom;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as JellyfishBloom).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
