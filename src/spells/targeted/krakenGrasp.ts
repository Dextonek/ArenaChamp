import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Kraken's Grasp (targeted, `enemies`, up to five targets): dark water portals (two-noise swirl, black centre,
 * teal foam rim) open under each enemy in turn. A huge black tentacle (thick tapered tube, teal underside, coral
 * suckers, hard silhouette, all below the bloom threshold) bursts out of each one, towers over the target, then
 * swoops down and coils round it 1.5 turns while a thinner companion winds the same way. Each wrap ticks a small
 * hit and lifts the enemy; the coils squeeze, a dead beat, then at D every tentacle is yanked down into its
 * portal at once: impact frames, foam crowns, a small black ink cloud, the big hit. Portals close with a ripple.
 *
 * Palette row: custom abyssal (foam #e8fff8, teal #5fffe0, sea #1a7a80, coral #ff7a6a, abyss #03080c).
 * Recipes: d-maxmdp-2-grave-hands-portal-aura (limbs from a portal), d-kler-1-singularity-accretion-pull (pull to
 * a centre), j-flexunit-swirl-portal (two-noise swirl portal).
 */
export interface KrakenGraspSettings {
  wrapDamage: number;
  damage: number;
  loop: boolean;
}

export const defaultKrakenGrasp = (): KrakenGraspSettings => ({ wrapDamage: 10, damage: 40, loop: false });

const MAXT = 5;
const D = 2.25; // synchronised yank
const HIT = D + 0.08; // after the impact frames
const DURATION = 4.6;
const SEG = 36;
const RAD = 10;
const CONES = 14;
const LIFT = 0.8;
const PORTAL_R = 2.3;

const TEAL = 0x5fffe0;
const SEA = 0x1a7a80;
const CORAL = 0xe8705f;
const ABYSS = 0x03080c;
const FOAM = 0xe8fff8;

const portalAt = (i: number) => 0.12 * i;
const emergeAt = (i: number) => 0.6 + 0.1 * i;
const wrapStartAt = (i: number) => 1.05 + 0.1 * i;
const wrapHitAt = (i: number) => 1.45 + 0.1 * i;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
/** Deterministic 0..1 hash so the splashes look the same on every cast. */
const rnd = (a: number, b: number, c: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Dark water portal: swirl twisted toward the centre, black heart, banded sea tones, broken foam rim. */
function portalMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uOpen: { value: 1 }, uFade: { value: 1 }, uSeed: { value: 0 },
      uAbyss: { value: new THREE.Color(ABYSS) }, uSea: { value: new THREE.Color(SEA) },
      uSeaDark: { value: new THREE.Color(0x0f4a52) }, uSeaDeep: { value: new THREE.Color(0x072028) },
      uFoam: { value: new THREE.Color(TEAL) }, uAccent: { value: new THREE.Color(0x3fcfc0) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpen, uFade, uSeed;
      uniform vec3 uAbyss, uSea, uSeaDark, uSeaDeep, uFoam, uAccent;
      varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p) / max(uOpen, 1e-3);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        // Two noises, swirled harder toward the centre and scrolled against each other.
        float tw = a + 4.0 * (1.0 - r) - uTime * 1.6;
        vec2 q = vec2(cos(tw), sin(tw)) * r * 2.6 + uSeed;
        float n1 = vn(q * 1.5 + uTime * 0.3);
        float n2 = vn(q * 3.1 - uTime * 0.5 + 7.0);
        float n = 0.6 * n1 + 0.4 * n2;
        float edge = 0.9 + 0.04 * (vn(vec2(a * 3.0 + uSeed, uTime * 1.5)) - 0.5);
        vec3 col;
        if (r > 0.985) col = uAbyss;
        else if (r > edge) col = n > 0.5 ? uFoam : uSeaDark;
        else if (r < 0.34 + 0.1 * n) col = uAbyss;
        else if (n2 > 0.8) col = uAccent;
        else if (n > 0.62) col = uSea;
        else if (n > 0.45) col = uSeaDark;
        else col = uSeaDeep;
        gl_FragColor = vec4(col, uFade);
      }`,
  });
}

/** Tentacle skin: dark body with a hard toon band, teal underside, coral suckers in two staggered rows, thin sea rim. */
function tentacleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uBody: { value: new THREE.Color(0x06141a) }, uBodyLit: { value: new THREE.Color(0x0d2a32) },
      uUnder: { value: new THREE.Color(SEA) }, uUnderDark: { value: new THREE.Color(0x11555c) },
      uRim: { value: new THREE.Color(0x2a8f94) }, uCoral: { value: new THREE.Color(CORAL) },
      uCoralDark: { value: new THREE.Color(0x3a1612) }, uOutline: { value: new THREE.Color(0x04090c) },
    },
    vertexShader: /* glsl */ `
      attribute float aU; attribute float aS; attribute float aL; attribute float aW;
      varying vec3 vN; varying vec3 vView; varying float vU; varying float vS; varying float vL; varying float vW;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalMatrix * normal;
        vN = n / max(length(n), 1e-6);
        vView = normalize(-mv.xyz);
        vU = aU; vS = aS; vL = aL; vW = aW;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uBodyLit, uUnder, uUnderDark, uRim, uCoral, uCoralDark, uOutline;
      varying vec3 vN; varying vec3 vView; varying float vU; varying float vS; varying float vL; varying float vW;
      const float PI = 3.14159265;
      const float SP = 0.46;
      float suckerDist(float cellOff, float rowAng, float ang) {
        float c = fract(vL / SP + cellOff) - 0.5;
        return length(vec2(c * SP, (ang - rowAng) * vW));
      }
      void main() {
        float ang = vU > PI ? vU - 2.0 * PI : vU;
        float lit = dot(vN, normalize(vec3(0.35, 0.85, 0.4)));
        float rim = 1.0 - abs(dot(vN, vView));
        bool under = cos(vU) > 0.35;
        vec3 col = lit > 0.35 ? uBodyLit : uBody;
        if (under) col = lit > 0.1 ? uUnder : uUnderDark;
        if (rim > 0.82) col = uRim;
        // Suckers: two staggered rows along the inner side, only on the thinner part.
        if (abs(ang) < 1.3 && vS > 0.15 && vW > 0.05) {
          float rs = min(0.4 * vW, 0.17);
          float d = min(suckerDist(0.0, 0.5, ang), suckerDist(0.5, -0.5, ang));
          if (d < rs * 0.45) col = uCoralDark;
          else if (d < rs) col = uCoral;
          else if (d < rs + 0.025) col = uOutline;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** A tapered tube whose rings are rewritten every frame from a polyline (parallel-transport frames). */
class Tentacle {
  readonly mesh: THREE.Mesh;
  private pos = new Float32Array((SEG + 1) * (RAD + 1) * 3);
  private nor = new Float32Array((SEG + 1) * (RAD + 1) * 3);
  private aU = new Float32Array((SEG + 1) * (RAD + 1));
  private aS = new Float32Array((SEG + 1) * (RAD + 1));
  private aL = new Float32Array((SEG + 1) * (RAD + 1));
  private aW = new Float32Array((SEG + 1) * (RAD + 1));
  private geo = new THREE.BufferGeometry();
  private T = new THREE.Vector3();
  private N = new THREE.Vector3(1, 0, 0);
  private B = new THREE.Vector3();
  private W = new THREE.Vector3();

  constructor(material: THREE.Material) {
    const index: number[] = [];
    for (let i = 0; i < SEG; i++) {
      for (let j = 0; j < RAD; j++) {
        const a = i * (RAD + 1) + j, b = a + RAD + 1;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    for (let i = 0; i <= SEG; i++) {
      for (let j = 0; j <= RAD; j++) {
        const k = i * (RAD + 1) + j;
        this.aU[k] = (j / RAD) * Math.PI * 2;
        this.aS[k] = i / SEG;
      }
    }
    const dyn = (arr: Float32Array, size: number) => new THREE.BufferAttribute(arr, size).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', dyn(this.pos, 3));
    this.geo.setAttribute('normal', dyn(this.nor, 3));
    this.geo.setAttribute('aU', new THREE.BufferAttribute(this.aU, 1));
    this.geo.setAttribute('aS', new THREE.BufferAttribute(this.aS, 1));
    this.geo.setAttribute('aL', dyn(this.aL, 1));
    this.geo.setAttribute('aW', dyn(this.aW, 1));
    this.geo.setIndex(index);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** `pts` / `radii` have SEG + 1 entries; `axis` is the line the suckers face (the enemy); `len` is the body length in metres. */
  write(pts: THREE.Vector3[], radii: number[], axis: THREE.Vector3, len: number) {
    const { T, N, B, W } = this;
    for (let i = 0; i <= SEG; i++) {
      const p = pts[i];
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(SEG, i + 1)];
      T.subVectors(p1, p0);
      if (T.lengthSq() < 1e-10) T.set(0, 1, 0); else T.normalize();
      // Suckers face the axis: take the horizontal direction to it, else keep the transported frame.
      W.set(axis.x - p.x, 0, axis.z - p.z);
      W.addScaledVector(T, -W.dot(T));
      if (W.lengthSq() > 0.04) {
        N.copy(W).normalize();
      } else {
        N.addScaledVector(T, -N.dot(T));
        if (N.lengthSq() < 1e-8) N.set(Math.abs(T.x) > 0.9 ? 0 : 1, 0, Math.abs(T.x) > 0.9 ? 1 : 0).addScaledVector(T, 0);
        N.addScaledVector(T, -N.dot(T)).normalize();
      }
      B.crossVectors(T, N);
      const r = Math.max(1e-3, radii[i]);
      for (let j = 0; j <= RAD; j++) {
        const phi = (j / RAD) * Math.PI * 2;
        const c = Math.cos(phi), s = Math.sin(phi);
        const dx = N.x * c + B.x * s, dy = N.y * c + B.y * s, dz = N.z * c + B.z * s;
        const k = i * (RAD + 1) + j;
        this.pos[k * 3] = p.x + dx * r;
        this.pos[k * 3 + 1] = p.y + dy * r;
        this.pos[k * 3 + 2] = p.z + dz * r;
        this.nor[k * 3] = dx;
        this.nor[k * 3 + 1] = dy;
        this.nor[k * 3 + 2] = dz;
        this.aL[k] = (i / SEG) * len;
        this.aW[k] = r;
      }
    }
    for (const n of ['position', 'normal', 'aL', 'aW']) (this.geo.attributes[n] as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** Per-tentacle path parameters. */
interface Spec {
  th: number; // angle (x, z plane) of the portal base around the enemy
  dir: number; // wrap handedness
  kr: number; // thickness scale
  r0: number; // base distance from the enemy axis
  hf: number; // tower height
  y0: number; // wrap start height
  rw: number; // wrap radius
  turns: number;
  len: number; // body length in metres (sucker spacing)
  delay: number;
}

export class KrakenGrasp implements Effect {
  readonly group = new THREE.Group();
  readonly settings: KrakenGraspSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private count = 0;
  private wrapDone: boolean[] = Array(MAXT).fill(false);
  private emergeDone: boolean[] = Array(MAXT).fill(false);
  private hitDone = false;
  private smokeDone = false;
  private tgtDone = false;
  private centroid = new THREE.Vector3();
  private axes: THREE.Vector3[] = Array.from({ length: MAXT }, () => new THREE.Vector3());
  private specs: Spec[] = [];

  private portalMats: THREE.ShaderMaterial[] = [];
  private portals: THREE.Mesh[] = [];
  private tentacles: Tentacle[] = [];
  private shocks: ReturnType<typeof createRing>[] = [];
  private ripples: ReturnType<typeof createRing>[] = [];
  private stars: StarBurst[] = [];
  private smoke = new SmokeBall({ color: ABYSS, rim: SEA, flake: ABYSS, maxBalls: MAXT + 1 });
  private cones: THREE.InstancedMesh;

  private foam: Emitter;
  private glow: Emitter;

  private pts: THREE.Vector3[] = Array.from({ length: SEG + 1 }, () => new THREE.Vector3());
  private radii: number[] = Array(SEG + 1).fill(0.1);
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpM = new THREE.Matrix4();
  private tmpS = new THREE.Vector3();

  constructor(settings: KrakenGraspSettings = defaultKrakenGrasp()) {
    this.settings = settings;
    this.screen.tint.set(0x0b3a40);
    this.screen.impactColor.set(TEAL);
    this.screen.edgeTint.set(SEA);
    this.screen.speedLineColor.set(0xbff5ea);

    const skin = tentacleMaterial();
    for (let i = 0; i < MAXT; i++) {
      const mat = portalMaterial();
      mat.uniforms.uSeed.value = i * 5.3;
      this.portalMats.push(mat);
      const portal = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat);
      portal.rotation.x = -Math.PI / 2;
      portal.position.y = 0.035;
      portal.scale.setScalar(PORTAL_R);
      portal.visible = false;
      portal.frustumCulled = false;
      this.portals.push(portal);
      this.group.add(portal);

      for (let c = 0; c < 2; c++) {
        const t = new Tentacle(skin);
        this.tentacles.push(t);
        this.group.add(t.mesh);
      }
      const shock = createRing(TEAL, 0.9, 1, 64);
      const ripple = createRing(0xbff5ea, 0.94, 1, 64);
      this.shocks.push(shock);
      this.ripples.push(ripple);
      this.group.add(shock.mesh, ripple.mesh);

      const star = new StarBurst({ points: 9, color: TEAL, core: FOAM, additive: false });
      this.stars.push(star);
      this.group.add(star.mesh);
    }

    // Splash crowns: long toon spikes of foam thrown up and out, ballistic, drawn unlit below the bloom threshold.
    const coneGeo = new THREE.ConeGeometry(0.08, 0.7, 6);
    this.cones = new THREE.InstancedMesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x8fe8d4 }), MAXT * 2 * CONES);
    this.cones.frustumCulled = false;
    this.group.add(this.cones);

    this.smoke.hold = 0.15;
    // Foam droplets: small, normal-blended so they stay crisp; white only in the lightest tone.
    this.foam = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, speed: 6.5, speedJitter: 0.6, spread: 75, gravity: 14, drag: 0.5,
      sizeStart: 0.13, sizeEnd: 0.04, colorStart: '#e8fff8', colorEnd: '#5fffe0', colorMid: '#bff5ea',
      opacityStart: 0.9, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0,
    });
    // Sparse bioluminescent motes drifting off the portal rims.
    this.glow = new Emitter({
      ...defaultSettings(), maxParticles: 200, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.1, speed: 0.4, speedJitter: 0.6, spread: 60, gravity: -0.5, drag: 0.8,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#5fffe0', colorEnd: '#1a7a80',
      opacityStart: 0.5, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.emitters.push(this.foam, this.glow, this.smoke.emitter);
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
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    this.count = Math.min(MAXT, pts.length);
    this.centroid.set(0, 0, 0);
    for (let i = 0; i < this.count; i++) {
      this.axes[i].copy(pts[i]).setY(0);
      this.centroid.add(pts[i]);
    }
    this.centroid.divideScalar(Math.max(1, this.count)).setY(0);
    // Angle (x, z plane) of the caster -> target direction; the portal bases sit to the sides of it so both coils show.
    const angF = Math.atan2(Math.cos(ctx.aim), Math.sin(ctx.aim));
    this.specs = [];
    for (let i = 0; i < MAXT; i++) {
      const th = angF + (i % 2 ? 1 : -1) * (0.9 + 0.25 * rnd(i, 1, 2));
      this.specs.push(
        { th, dir: 1, kr: 1, r0: 1.5, hf: 6.0, y0: 0.25, rw: 1.1, turns: 1.5, len: 9, delay: 0 },
        { th: th + Math.PI * 0.8, dir: 1, kr: 0.6, r0: 1.35, hf: 4.4, y0: 0.35, rw: 1.22, turns: 1.25, len: 7, delay: 0.12 },
      );
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hitDone = false;
    this.smokeDone = false;
    this.tgtDone = false;
    this.wrapDone.fill(false);
    this.emergeDone.fill(false);
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.foam.update(dt);
    this.glow.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.releaseTargets();
    }
    for (let i = 0; i < this.count; i++) {
      if (!this.emergeDone[i] && this.time >= emergeAt(i)) this.onEmerge(i);
      if (!this.wrapDone[i] && this.time >= wrapHitAt(i)) this.onWrap(i);
    }
    if (!this.hitDone && this.time >= HIT) this.onHit();
    if (!this.smokeDone && this.time >= D + 0.15) this.onSmoke();
    this.layout(dt);
  }

  /** Point on tentacle `s` at body parameter `u` (0 base .. 1 tip): tower shape blended into the coil. */
  private pointAt(s: Spec, ax: THREE.Vector3, u: number, t: number, wrapK: number, lift: number, sq: number, out: THREE.Vector3) {
    const cth = Math.cos(s.th), sth = Math.sin(s.th);
    const px = -sth, pz = cth; // horizontal perpendicular to the base direction
    // Free tower: leans in over the enemy, writhes, curls at the tip.
    const bx = ax.x + cth * s.r0, bz = ax.z + sth * s.r0;
    const lean = 0.5 * Math.pow(u, 1.4);
    const wave = 0.55 * u * Math.sin(u * 4.2 - t * 2.6 + s.th);
    const wave2 = 0.25 * u * Math.sin(u * 3.0 - t * 2.0 + 1.3);
    const cK = smoothstep((u - 0.78) / 0.22);
    const fx = bx + (ax.x - bx) * lean + px * (wave + 0.8 * Math.sin(cK * 2.6)) + cth * wave2;
    const fz = bz + (ax.z - bz) * lean + pz * (wave + 0.8 * Math.sin(cK * 2.6)) + sth * wave2;
    const fy = s.hf * (1 - Math.pow(1 - u, 1.7)) - 0.9 * cK * cK;
    // Coil: helix round the enemy, tightening on the squeeze, tip flicking off the top.
    const w = clamp01((u - 0.1) / 0.9);
    const ang = s.th + s.dir * Math.PI * 2 * s.turns * Math.pow(w, 0.9);
    const rW = s.rw * (1 - 0.1 * w) * (1 - 0.22 * sq) + 0.5 * smoothstep((u - 0.92) / 0.08);
    const rr = s.r0 + (rW - s.r0) * smoothstep(u / 0.3);
    const sway = 0.05 * Math.sin(t * 5 + u * 6 + s.th) * (1 - sq * 0.5);
    const wx = ax.x + Math.cos(ang) * (rr + sway);
    const wz = ax.z + Math.sin(ang) * (rr + sway);
    const wy = s.y0 * smoothstep(u / 0.2) + 2.3 * Math.pow(w, 0.9) + lift + 0.25 * smoothstep((u - 0.92) / 0.08);
    return out.set(fx + (wx - fx) * wrapK, fy + (wy - fy) * wrapK, fz + (wz - fz) * wrapK);
  }

  private layout(dt: number) {
    const t = this.time;
    const aw = t - D;
    const ctx = this.ctx;
    const live = dt > 0 && this.playing;
    const fade = 1 - smoothstep((t - (DURATION - 0.5)) / 0.5);
    const n = this.count;

    // --- World grade, speed lines into the yank, short impact frames, chroma. ---
    this.screen.darken = t < D ? 0.62 * smoothstep(t / 0.6) : 0.62 * Math.exp(-Math.max(0, aw - 0.1) * 2.6);
    this.screen.speedLines = t < D ? 0.5 * smoothstep((t - (D - 0.3)) / 0.3) : Math.max(0, 0.5 - aw * 5);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D, 0.6);

    // --- Portals: open in turn, swirl, close with the yank. ---
    for (let i = 0; i < MAXT; i++) {
      const portal = this.portals[i];
      const open = smoothstep((t - portalAt(i)) / 0.5);
      const close = aw > 0.35 ? 1 - smoothstep((aw - 0.35) / 0.8) : 1;
      const on = i < n && open > 0 && close > 0 && t < DURATION;
      portal.visible = on;
      if (!on) continue;
      const mat = this.portalMats[i];
      portal.position.set(this.axes[i].x, 0.035, this.axes[i].z);
      mat.uniforms.uTime.value = t;
      mat.uniforms.uOpen.value = Math.max(1e-3, open * close);
      mat.uniforms.uFade.value = fade;
      if (live && t < D && Math.random() < 0.35) {
        const a = Math.random() * Math.PI * 2;
        const r = (1.4 + 0.8 * Math.random()) * open;
        this.glow.burst(1, this.tmp.set(this.axes[i].x + Math.cos(a) * r, 0.1, this.axes[i].z + Math.sin(a) * r));
      }
    }

    // --- Tentacles: grow out of the portals, tower, swoop into the coil, squeeze, yank down. ---
    const e = aw > 0 ? clamp01(aw / 0.22) ** 2 : 0;
    for (let i = 0; i < MAXT; i++) {
      for (let c = 0; c < 2; c++) {
        const tent = this.tentacles[i * 2 + c];
        const spec = this.specs[i * 2 + c];
        const t0 = emergeAt(i) + (spec ? spec.delay : 0);
        if (i >= n || !spec || t < t0 || e >= 1 || t >= DURATION) { tent.mesh.visible = false; continue; }
        tent.mesh.visible = true;
        const ax = this.axes[i];
        const g = easeOut((t - t0) / 0.55);
        const wrapK = smoothstep((t - wrapStartAt(i) - spec.delay) / 0.5);
        const lift = LIFT * smoothstep((t - wrapStartAt(i) - 0.25) / 0.45) * (1 - e);
        const sq = smoothstep((t - 1.7) / 0.45);
        const thick = smoothstep((t - t0) / 0.15);
        for (let k = 0; k <= SEG; k++) {
          const s = k / SEG;
          this.pointAt(spec, ax, s * g, t, wrapK, lift, sq, this.pts[k]);
          if (e > 0) {
            this.pts[k].x += (ax.x - this.pts[k].x) * e;
            this.pts[k].z += (ax.z - this.pts[k].z) * e;
            this.pts[k].y += (-1.8 - this.pts[k].y) * e;
          }
          this.radii[k] = 0.55 * spec.kr * thick * (0.12 + 0.88 * Math.pow(1 - s, 0.85)) * (1 + 0.04 * sq * Math.sin(t * 20 + k));
        }
        tent.write(this.pts, this.radii, ax, spec.len);
      }
    }

    // --- Enemies: lifted as the coils tighten, dropped with the yank. ---
    if (ctx && live) {
      if (aw > 0.3) {
        if (!this.tgtDone) {
          this.tgtDone = true;
          this.releaseTargets();
        }
      } else {
        ctx.targets.forEach((en, i) => {
          if (i >= MAXT) return;
          const lift = LIFT * smoothstep((t - wrapStartAt(i) - 0.25) / 0.45) * (1 - e);
          const tremble = t > 1.7 && t < D ? 0.03 * Math.sin(t * 38 + i) : 0;
          ctx.displace(en, this.tmp.set(0, lift + tremble, 0));
        });
      }
    }

    // --- Ground foam rings and the closing ripple. ---
    for (let i = 0; i < MAXT; i++) {
      const sh = this.shocks[i], rp = this.ripples[i];
      const ax = this.axes[i];
      const a1 = aw - 0.1;
      sh.mesh.position.set(ax.x, 0.05, ax.z);
      sh.mesh.scale.setScalar(1.6 + (i < n && a1 > 0 ? 4.2 * easeOut(a1 / 0.7) : 0));
      sh.material.opacity = i < n && a1 > 0 ? 0.6 * (1 - smoothstep(a1 / 0.8)) : 0;
      const a2 = aw - 0.4;
      rp.mesh.position.set(ax.x, 0.045, ax.z);
      rp.mesh.scale.setScalar(2.0 + (a2 > 0 ? 1.8 * easeOut(a2 / 1.0) : 0));
      rp.material.opacity = i < n && a2 > 0 ? 0.35 * (1 - smoothstep(a2 / 1.2)) * fade : 0;
    }

    // --- Impact pops on each target, then foam crowns. ---
    for (let i = 0; i < MAXT; i++) {
      const pop = StarBurst.pop(aw - 0.1 - i * 0.015, 0.08, 0.16);
      if (i >= n || pop.opacity === 0) this.stars[i].set(this.tmp.set(0, 0, 0), 0, 0);
      else this.stars[i].set(this.tmp.set(this.axes[i].x, 1.2, this.axes[i].z), 2.4 * pop.scale, pop.opacity, i * 0.7);
    }
    this.updateCones(t);

    // --- Shake: a tick per emerge, a rumble in the squeeze, one heavy hit at D. ---
    let sh = t > 1.7 && t < D ? 0.06 : 0;
    for (let i = 0; i < n; i++) { const a = t - emergeAt(i); if (a >= 0) sh = Math.max(sh, 0.12 * Math.exp(-a * 12)); }
    if (aw > 0) sh = Math.max(sh, 0.7 * Math.exp(-aw * 6));
    this.shake = sh;
  }

  /** Splash crowns of spikes: k = 0 where each tentacle breaks the surface, k = 1 round the enemy at the yank. */
  private updateCones(t: number) {
    const G = 18;
    const q = this.tmpQ, m = this.tmpM, sc = this.tmpS, v = this.tmp, pos = this.tmp2;
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < MAXT; i++) {
      for (let k = 0; k < 2; k++) {
        const ts = k === 0 ? emergeAt(i) + 0.05 : D + 0.1;
        const age = t - ts;
        const size = k === 0 ? 0.7 : 1.6;
        const sp = this.specs[i * 2];
        const ax = this.axes[i];
        const bx = k === 0 && sp ? ax.x + Math.cos(sp.th) * sp.r0 : ax.x;
        const bz = k === 0 && sp ? ax.z + Math.sin(sp.th) * sp.r0 : ax.z;
        const rho = k === 0 ? 0.45 : 1.0;
        for (let c = 0; c < CONES; c++) {
          const idx = (i * 2 + k) * CONES + c;
          const r1 = rnd(i, k, c), r2 = rnd(i, k + 3, c), r3 = rnd(i, k + 6, c);
          const phi = (c / CONES) * Math.PI * 2 + r1 * 0.3;
          const vo = size * (1.6 + 1.4 * r1), vu = size * (3.6 + 1.8 * r2);
          const life = (2 * vu) / G;
          const dx = Math.cos(phi), dz = Math.sin(phi);
          const y = vu * age - 0.5 * G * age * age;
          let s = 1e-4;
          if (i < this.count && age > 0 && y >= 0) {
            s = Math.max(1e-4, size * (0.6 + 0.5 * r3) * (1 - smoothstep((age - 0.45 * life) / (0.55 * life))));
          }
          pos.set(bx + dx * (rho + vo * Math.max(0, age)), 0.05 + Math.max(0, y), bz + dz * (rho + vo * Math.max(0, age)));
          v.set(dx * vo, vu - G * Math.max(0, age), dz * vo);
          if (v.lengthSq() > 1e-6) q.setFromUnitVectors(up, v.normalize()); else q.identity();
          m.compose(pos, q, sc.setScalar(s));
          this.cones.setMatrixAt(idx, m);
        }
      }
    }
    this.cones.instanceMatrix.needsUpdate = true;
  }

  private releaseTargets() {
    const ctx = this.ctx;
    if (!ctx) return;
    const zero = new THREE.Vector3();
    for (const en of ctx.targets) ctx.displace(en, zero);
  }

  /** The tentacle breaks the surface: a small splash of droplets at its base. */
  private onEmerge(i: number) {
    this.emergeDone[i] = true;
    const sp = this.specs[i * 2];
    const ax = this.axes[i];
    if (!sp) return;
    this.foam.burst(26, this.tmp.set(ax.x + Math.cos(sp.th) * sp.r0, 0.15, ax.z + Math.sin(sp.th) * sp.r0));
  }

  /** The coil closes round the enemy: a small tinted hit. */
  private onWrap(i: number) {
    this.wrapDone[i] = true;
    const ctx = this.ctx;
    const en = ctx?.targets[i];
    if (!ctx || !en) return;
    ctx.hit(en, { damage: this.settings.wrapDamage, knock: 0, from: ctx.from, color: '#5fffe0' });
  }

  /** The synchronised yank: the big hit on every target plus the foam splash. */
  private onHit() {
    this.hitDone = true;
    const ctx = this.ctx;
    for (let i = 0; i < this.count; i++) {
      this.foam.burst(70, this.tmp.set(this.axes[i].x, 0.3, this.axes[i].z));
    }
    if (!ctx) return;
    ctx.targets.forEach((en, i) => {
      if (i >= MAXT) return;
      ctx.hit(en, { damage: this.settings.damage, knock: 2, from: ctx.from, color: '#ff7a6a' });
    });
  }

  /** A small black ink cloud over each closing portal. */
  private onSmoke() {
    this.smokeDone = true;
    for (let i = 0; i < this.count; i++) {
      this.smoke.trigger(this.tmp.set(this.axes[i].x, 0.7, this.axes[i].z), 0.8, 0.55);
    }
  }
}

export const krakenGraspModule: EffectModule = {
  label: 'kraken grasp',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAXT },
  create: () => new KrakenGrasp(),
  telegraphs(effect) {
    const e = effect as KrakenGrasp;
    const pts = e.ctx?.targetPos ?? [];
    return pts.slice(0, MAXT).map((p, j) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 2.0 }, start: portalAt(j) + 0.1, impact: D,
    }));
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as KrakenGrasp;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as KrakenGrasp).settings;
    f.add(s, 'loop');
    f.add(s, 'wrapDamage', 0, 40, 1).name('wrap damage');
    f.add(s, 'damage', 1, 150, 1);
  },
};
