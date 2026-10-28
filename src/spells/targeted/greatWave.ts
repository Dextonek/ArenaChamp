import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Great Wave (targeted, `ground`, radius 6): a woodblock-print wave. Flat dark-blue water seeps up over the chosen
 * area, then a huge curling wall rises on the FAR side of it (facing the caster, so the barrel and the lip read
 * from the gameplay camera). It is one swept sheet drawn with hard toon bands (indigo, deep blue, mid blue, cyan),
 * dark stripe lines and ink band edges, topped by a pale foam crest whose lower edge and tip are cut into claws,
 * with a black outline all round (a dilated copy of the same sheet drawn behind it). The lip hangs over the area,
 * leans back for a dead beat, then the whole curl collapses forward onto the area: short cyan impact frames, a
 * foam star, two flat foam rings, small spray and a small ink-blue smoke ball. The flat sheet then sinks away.
 * Everything is normal-blended and below the bloom threshold (foam is #e8f4ff, never a glow).
 *
 * Palette row: custom woodblock sea (foam #e8f4ff, cyan #7fd0e8, deep #1a4a8a, indigo #0e1e4a, ink #040814).
 * Recipes: a-ow-hanzo-dragonstrike (a water body that sweeps over the target), b-zzz-ellen-joe-ultimate (cartoon
 * water shapes), e-yordin-toon-color-cyclone (toon bands, light edge, dark outer edge).
 */
export interface GreatWaveSettings {
  damage: number;
  loop: boolean;
}

export const defaultGreatWave = (): GreatWaveSettings => ({ damage: 55, loop: false });

const D = 2.15; // the crash lands
const HIT = D + 0.08; // after the 2 short impact frames
const DURATION = 4.6;
const RADIUS = 6;

const WC = 5.2; // wave root distance behind the area centre
const HALF = 9; // half width of the wave
const R0 = 4; // barrel radius
const CY = R0 + 0.06; // barrel centre height
const TOE = 3.2; // flat toe in front of the barrel
const BOW = 1.6; // the ends wrap toward the caster
const COLS = 64;
const ROWS = 80;
const S0 = -0.008, S1 = 1.008;
const U0 = -0.012, U1 = 1.012;

const FOAM = 0xe8f4ff;
const CYAN = 0x7fd0e8;
const MID = 0x2a64a8;
const DEEP = 0x1a4a8a;
const INDIGO = 0x0e1e4a;
const INK = 0x040814;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

const COMMON_GLSL = /* glsl */ `
  float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float tri(float x) { return abs(fract(x) * 2.0 - 1.0); }
`;

/** The wave sheet: toon bands by distance along the profile, stripes, ink edges, foam crest cut into claws. */
function waveMaterial(outline: boolean): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    polygonOffset: outline,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
    uniforms: {
      uOutline: { value: outline ? 1 : 0 }, uTime: { value: 0 },
      uInk: { value: new THREE.Color(INK) }, uIndigo: { value: new THREE.Color(INDIGO) },
      uDeep: { value: new THREE.Color(DEEP) }, uMid: { value: new THREE.Color(MID) },
      uCyan: { value: new THREE.Color(CYAN) }, uFoam: { value: new THREE.Color(FOAM) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uOutline, uTime;
      uniform vec3 uInk, uIndigo, uDeep, uMid, uCyan, uFoam;
      varying vec2 vUv;
      ${COMMON_GLSL}
      void main() {
        float u = vUv.x, s = vUv.y;
        float ol = uOutline;
        if (ol < 0.5 && (u < 0.0 || u > 1.0 || s < 0.0 || s > 1.0)) discard;
        // Foam claws: a few big hooked fingers plus a row of small ones, cut out of the lip end of the sheet.
        float tz = (s - 0.84) / 0.16;
        if (tz > 0.0) {
          float c1 = u * 13.0, c2 = u * 38.0 + 0.37;
          float l1 = 0.45 + 0.55 * h1(floor(c1) + 3.0);
          float l2 = 0.3 + 0.7 * h1(floor(c2) + 11.0);
          float p1 = max(1.0 - tri(c1) + ol * 0.08, 0.0), p2 = max(1.0 - tri(c2) + ol * 0.1, 0.0);
          float ext = max(l1 * pow(p1, 0.8), 0.6 * l2 * pow(p2, 0.8)) + ol * 0.05;
          if (tz > ext) discard;
        }
        if (ol > 0.5) { gl_FragColor = vec4(uInk, 1.0); return; }
        float sw = s + 0.018 * sin(u * 34.0 + s * 9.0) + 0.012 * sin(u * 71.0 + 2.0);
        vec3 col;
        float fe = 0.80 + 0.03 * tri(u * 20.0 + 0.5);
        if (sw < 0.10) {
          // Toe: dark water with foam blotches.
          float n = vn(vec2(u * 48.0, sw * 70.0 - uTime * 0.4));
          col = n > 0.78 ? uFoam : (n > 0.5 ? uDeep : uIndigo);
        } else if (sw > fe) {
          col = uFoam;
          if (abs(sw - fe - 0.012) < 0.004) col = uCyan;
        } else {
          if (sw < 0.30) col = uIndigo;
          else if (sw < 0.50) col = uDeep;
          else if (sw < 0.66) col = uMid;
          else col = uCyan;
          // Woodblock grain: dark stripe lines that follow the swell.
          float ln = abs(fract(sw * 22.0 + 0.4 * sin(u * 6.0) - uTime * 0.1) - 0.5);
          if (ln < 0.05 && sw < 0.66) col *= 0.7;
          if (ln < 0.035 && sw >= 0.66) col = uMid;
          // Ink edges between the bands.
          if (abs(sw - 0.10) < 0.006 || abs(sw - 0.30) < 0.006 || abs(sw - 0.50) < 0.006 || abs(sw - 0.66) < 0.006) col = uInk;
        }
        if (!gl_FrontFacing) col *= 0.8;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return m;
}

/** Flat water on the ground: seeping bands, a foam rim, an ink outline and two expanding foam rings. */
function waterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uOpen: { value: 0 }, uFade: { value: 1 },
      uRing1: { value: -1 }, uRing2: { value: -1 }, uRingFade: { value: 1 },
      uInk: { value: new THREE.Color(INK) }, uIndigo: { value: new THREE.Color(INDIGO) },
      uDeep: { value: new THREE.Color(DEEP) }, uMid: { value: new THREE.Color(MID) },
      uFoam: { value: new THREE.Color(FOAM) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpen, uFade, uRing1, uRing2, uRingFade;
      uniform vec3 uInk, uIndigo, uDeep, uMid, uFoam;
      varying vec2 vUv;
      ${COMMON_GLSL}
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p) * 13.0;
        float a = atan(p.y, p.x);
        float body = 6.3 * uOpen * (1.0 + 0.04 * sin(a * 7.0 + uTime * 1.3) + 0.03 * sin(a * 13.0 - uTime));
        vec3 col = uIndigo;
        float alpha = 0.0;
        if (r < body) {
          float k = r / max(body, 1e-3);
          vec2 q = vec2(cos(a + k * 2.0 - uTime * 0.4), sin(a + k * 2.0 - uTime * 0.4)) * (k * 3.5 + 0.5);
          float n = vn(q * 1.4 + uTime * 0.15);
          col = n > 0.62 ? uMid : (n > 0.38 ? uDeep : uIndigo);
          if (abs(fract(k * 5.0 + 0.3 * n) - 0.5) < 0.035) col = uIndigo;
          if (k > 0.86 && k < 0.975) col = vn(vec2(a * 6.0, k * 4.0)) > 0.3 ? uFoam : col;
          if (k >= 0.975) col = uInk;
          alpha = uFade;
        }
        float d1 = abs(r - uRing1), d2 = abs(r - uRing2);
        if (uRing1 > 0.0 && d1 < 0.4) { col = d1 < 0.27 ? uFoam : uInk; alpha = uRingFade; }
        if (uRing2 > 0.0 && d2 < 0.34) { col = d2 < 0.22 ? uFoam : uInk; alpha = uRingFade; }
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }`,
  });
}

export class GreatWave implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GreatWaveSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private crashed = false;
  private hitDone = false;
  private smokeDone = false;

  private area = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);

  private root = new THREE.Group();
  private waveMat = waveMaterial(false);
  private outlineMat = waveMaterial(true);
  private waterMat = waterMaterial();
  private water = new THREE.Mesh(new THREE.CircleGeometry(13, 72), this.waterMat);
  private wave: THREE.Mesh;
  private outline: THREE.Mesh;
  private posAttr: THREE.BufferAttribute;
  private smoke = new SmokeBall({ color: 0x0a1430, rim: 0x1a4a8a, flake: 0x0e1e4a, maxBalls: 2 });
  private star = new StarBurst({ points: 9, inner: 0.3, color: CYAN, core: FOAM, additive: false });
  private spray: Emitter;
  private drops: Emitter;

  /** Animated wave shape parameters (set in layout, read by point()). */
  private shape = { rise: 0, theta: 0.8 * Math.PI, lean: 0, crash: 0, sink: 0 };
  private tmp = new THREE.Vector3();

  constructor(settings: GreatWaveSettings = defaultGreatWave()) {
    this.settings = settings;
    this.screen.tint.set(0x2a4a8a);
    this.screen.impactColor.set(CYAN);
    this.screen.edgeTint.set(CYAN);
    this.screen.speedLineColor.set(FOAM);

    // Wave sheet: one grid, positions rewritten every frame; (u along the crest, s along the profile) as uv.
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((ROWS + 1) * (COLS + 1) * 3);
    const uv = new Float32Array((ROWS + 1) * (COLS + 1) * 2);
    const index: number[] = [];
    for (let i = 0; i <= ROWS; i++) {
      for (let j = 0; j <= COLS; j++) {
        const k = i * (COLS + 1) + j;
        uv[k * 2] = U0 + ((U1 - U0) * j) / COLS;
        uv[k * 2 + 1] = S0 + ((S1 - S0) * i) / ROWS;
        if (i < ROWS && j < COLS) {
          const a = k, b = k + COLS + 1;
          index.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    this.posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    this.wave = new THREE.Mesh(geo, this.waveMat);
    this.outline = new THREE.Mesh(geo, this.outlineMat);
    this.wave.frustumCulled = false;
    this.outline.frustumCulled = false;
    this.root.add(this.outline, this.wave);

    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.045;
    this.water.frustumCulled = false;
    this.water.visible = false;
    this.root.visible = false;

    // Small, hard, normal-blended spray and droplets (pale blue-white, no additive).
    this.spray = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 8, speedJitter: 0.6, spread: 60, gravity: 17, drag: 0.6,
      sizeStart: 0.17, sizeEnd: 0.05, colorStart: '#e8f4ff', colorEnd: '#7fd0e8',
      opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0, groundFade: 0.15,
    });
    this.drops = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.2, speed: 2.6, speedJitter: 0.6, spread: 45, gravity: 9, drag: 0.5,
      sizeStart: 0.11, sizeEnd: 0.04, colorStart: '#e8f4ff', colorEnd: '#7fd0e8',
      opacityStart: 0.9, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0, groundFade: 0.1,
    });
    this.emitters.push(this.spray, this.drops, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.group.add(this.root, this.water, this.smoke.mesh, this.star.mesh);
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
    this.area.copy(ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    // The wave stands on the far side of the area; local +Z points away from the caster, local -Z toward it.
    this.root.position.copy(this.area).addScaledVector(this.fwd, WC);
    this.root.rotation.set(0, ctx.aim, 0);
    this.water.position.set(this.area.x, 0.045, this.area.z);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.area).setY(1.4);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.crashed = false;
    this.hitDone = false;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.spray.update(dt);
    this.drops.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    if (!this.crashed && this.time >= D) this.onCrash();
    if (!this.hitDone && this.time >= HIT) this.onHit();
    if (!this.smokeDone && this.time >= D + 0.25) this.onSmoke();
    this.layout(dt);
  }

  /** Local-space point of the wave sheet at (u along the crest 0..1, s along the profile 0..1). */
  private point(u: number, s: number, out: THREE.Vector3) {
    const sh = this.shape;
    const k = 2 * clamp01(u) - 1;
    const env = Math.sqrt(Math.max(0, 1 - k * k));
    const e = 0.62 + 0.38 * env; // taller in the middle
    const sp = clamp01(s);
    let h: number, y: number;
    if (s < 0.1) {
      h = TOE * (1 - s / 0.1);
      y = 0.06;
    } else {
      // Spiral hook: circle centred over the foot, radius shrinking toward the lip.
      const th = ((s - 0.1) / 0.9) * sh.theta * (0.6 + 0.4 * env);
      const a = -Math.PI / 2 - th;
      const r = R0 * (1 - (0.38 * th) / (1.75 * Math.PI));
      h = r * Math.cos(a);
      y = CY + r * Math.sin(a);
    }
    h *= 0.5 + 0.5 * sh.rise;
    y = 0.06 + (y - 0.06) * e * sh.rise;
    const w = sp * sp;
    h += 0.3 * Math.sin(u * 11 + 1) * sp + BOW * k * k - sh.lean * (0.3 + 0.7 * w);
    // Crash: the lip falls forward first, the foot follows; the sheet flattens over the area.
    const c = sh.crash;
    h += c * (WC - 0.5 + 3.5 * w);
    y = 0.06 + (y - 0.06) * (1 - c * (0.6 + 0.38 * w));
    y -= sh.sink;
    return out.set(k * HALF * (1 + 0.2 * c), y, -h);
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const sh = this.shape;

    // --- Shape timeline: rise 0.8-1.5, curl 0.85-1.6, lean back 1.7-1.85, crash 1.85-2.23, sink 2.65+. ---
    sh.rise = easeOut((t - 0.8) / 0.7);
    sh.theta = (0.8 + 0.95 * smoothstep((t - 0.85) / 0.75)) * Math.PI;
    sh.lean = 0.5 * smoothstep((t - 1.7) / 0.15);
    sh.crash = Math.pow(clamp01((t - 1.85) / 0.38), 1.6);
    sh.sink = 1.6 * smoothstep((after - 0.5) / 1.3);
    this.root.visible = t >= 0.78 && after < 2.0;
    const pos = this.posAttr.array as Float32Array;
    for (let i = 0; i <= ROWS; i++) {
      const s = S0 + ((S1 - S0) * i) / ROWS;
      for (let j = 0; j <= COLS; j++) {
        const u = U0 + ((U1 - U0) * j) / COLS;
        this.point(u, s, this.tmp);
        const o = (i * (COLS + 1) + j) * 3;
        pos[o] = this.tmp.x; pos[o + 1] = this.tmp.y; pos[o + 2] = this.tmp.z;
      }
    }
    this.posAttr.needsUpdate = true;
    this.waveMat.uniforms.uTime.value = t;
    this.waterMat.uniforms.uTime.value = t;

    // --- Ground water: seeps up 0-0.8, stays, then drains away after the crash. ---
    const open = easeOut((t - 0.05) / 0.75);
    this.water.visible = t > 0.05 && after < 2.3;
    this.waterMat.uniforms.uOpen.value = open;
    this.waterMat.uniforms.uFade.value = 1 - smoothstep((after - 0.9) / 1.3);
    const r1 = after * 22, r2 = (after - 0.12) * 16;
    this.waterMat.uniforms.uRing1.value = after > 0 && r1 < 12 ? r1 : -1;
    this.waterMat.uniforms.uRing2.value = after > 0.12 && r2 < 12 ? r2 : -1;
    this.waterMat.uniforms.uRingFade.value = 1 - smoothstep((Math.max(r1, 0) - 8) / 4);

    // --- Spray: droplets hop on the seeping water, mist hangs off the lip. ---
    if (dt > 0 && t > 0.25 && t < 0.85) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 5.5 * open;
      this.drops.burst(2, this.tmp.set(this.area.x + Math.cos(a) * rr, 0.1, this.area.z + Math.sin(a) * rr));
    }
    if (dt > 0 && t > 1.3 && t < D - 0.03) {
      this.root.updateWorldMatrix(true, false);
      const u = 0.12 + Math.random() * 0.76;
      this.point(u, 0.95, this.tmp).applyMatrix4(this.root.matrixWorld);
      this.drops.burst(2, this.tmp);
    }

    // --- Screen: blue dusk during the build, focus lines on the fall, short cyan impact frames, chroma kick. ---
    const rel = smoothstep((after - 0.1) / 0.9);
    this.screen.darken = t < D ? 0.5 * smoothstep(t / 0.8) + 0.1 * smoothstep((t - 1.5) / 0.35) : 0.6 * (1 - rel);
    this.screen.speedLines = t < D ? 0.55 * smoothstep((t - 1.8) / 0.3) : Math.max(0, 0.55 - after * 5);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, HIT, 0.6, 8);

    // --- Foam star at the landing. ---
    const pop = StarBurst.pop(t - HIT, 0.08, 0.16);
    this.star.set(this.tmp.set(this.area.x, 1.4, this.area.z), 5 * pop.scale, pop.opacity, t * 0.5);

    this.shake = after > 0 ? 0.75 * Math.exp(-after * 6) : t > 0.85 && t < 1.7 ? 0.05 : 0;
    if (t >= DURATION - 0.01) clearScreenFx(this.screen);
  }

  private onCrash() {
    this.crashed = true;
    // Spray bursts out over the area.
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
      const r = 0.8 + Math.random() * 4.6;
      this.spray.burst(16, this.tmp.set(this.area.x + Math.cos(a) * r, 0.2, this.area.z + Math.sin(a) * r));
    }
    // Crown along the front where the lip lands.
    for (let i = 0; i < 8; i++) {
      const k = (i / 7 - 0.5) * 2;
      this.tmp.copy(this.area).addScaledVector(this.fwd, 1.8).add(
        new THREE.Vector3(-this.fwd.z, 0, this.fwd.x).multiplyScalar(k * 5.5),
      ).setY(0.3);
      this.spray.burst(14, this.tmp);
    }
  }

  private onHit() {
    this.hitDone = true;
    const ctx = this.ctx;
    if (!ctx) return;
    const from = this.area.clone().addScaledVector(this.fwd, RADIUS);
    ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.damage, knock: 7, from, color: '#bfe8ff' }));
  }

  private onSmoke() {
    this.smokeDone = true;
    this.smoke.trigger(this.area.clone().setY(0.8), 1.6, 1.2);
  }
}

export const greatWaveModule: EffectModule = {
  label: 'great wave',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new GreatWave(),
  telegraphs(effect) {
    const e = effect as GreatWave;
    const c = e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: RADIUS }, start: 0.1, impact: D }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.5, threshold: 0.93 },
  frameCamera(camera, controls, effect) {
    const e = effect as GreatWave;
    if (e.ctx) frameCast(camera, controls, e.ctx, 8);
  },
  buildGui(f, effect) {
    const s = (effect as GreatWave).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
