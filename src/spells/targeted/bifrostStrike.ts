import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  SmokeBall, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Bifrost Strike (targeted, ground AoE): a Norse rune circle with a knotwork band is drawn on the ground under a
 * stormy, darkened world. High in the sky a prism glint opens and a rainbow bridge (7 separate hard colour bands,
 * each with a dark outline, one thin white core line) grows toward the circle, red first. It hangs just short of
 * the ground while the runes light one by one, a dead beat, then it slams down like a hammer: short impact
 * frames, seven colour rings splash out in order, dark storm debris, and the bridge dissolves from the sky end
 * into falling prism shards while the rune ring fades last.
 * Recipes: e-yougelly-twin-sky-beams (from the sky), f-beyondfx-sunrise-pillar-strike (hang, then slam),
 * a-lol-lux-final-spark (long build, short release).
 */
export interface BifrostStrikeSettings {
  hitTime: number;
  bridgeWidth: number;
  damage: number;
  loop: boolean;
}

export const defaultBifrostStrike = (): BifrostStrikeSettings => ({
  hitTime: 1.85,
  bridgeWidth: 3.1,
  damage: 55,
  loop: false,
});

const AFTERMATH = 2.55;
const RADIUS = 4.5;
const GROUND_R = 4.8;
const SEG = 72;
const BANDS = 7;
const RUNES = 24;
const HANG = 1.4;
const SHARDS = 84;
const TILT = Math.PI / 4;

/** Rainbow bands, red first. Scaled down at use so they stay under the bloom threshold. */
const BAND_HEX = [0xff5a5a, 0xffa04a, 0xffe45a, 0x5aff8a, 0x4ac8ff, 0x6a6aff, 0xc45aff];
const BAND_DIM = 0.8;

/** Elder Futhark, 24 runes, as polylines in a 0..1 box (y = 0 at the top). */
const FUTHARK: number[][][] = [
  [[.3, 0, .3, 1], [.3, .35, .75, .05], [.3, .65, .75, .35]],
  [[.2, 1, .2, 0, .75, .3, .75, 1]],
  [[.3, 0, .3, 1], [.3, .25, .75, .5, .3, .75]],
  [[.3, 0, .3, 1], [.3, .1, .75, .35], [.3, .4, .75, .65]],
  [[.25, 0, .25, 1], [.25, 0, .7, .25, .25, .5, .75, 1]],
  [[.7, .1, .3, .5, .7, .9]],
  [[.2, .1, .8, .9], [.8, .1, .2, .9]],
  [[.3, 0, .3, 1], [.3, .05, .75, .3, .3, .55]],
  [[.25, 0, .25, 1], [.75, 0, .75, 1], [.25, .35, .75, .65]],
  [[.5, 0, .5, 1], [.25, .7, .75, .3]],
  [[.5, 0, .5, 1]],
  [[.45, .1, .2, .3, .45, .5], [.55, .5, .8, .7, .55, .9]],
  [[.5, 0, .5, 1], [.5, 0, .75, .2], [.5, 1, .25, .8]],
  [[.35, 0, .7, .3, .35, .5, .7, .7, .35, 1]],
  [[.5, 0, .5, 1], [.2, .15, .5, .5, .8, .15]],
  [[.65, 0, .3, .35, .7, .65, .35, 1]],
  [[.5, 0, .5, 1], [.2, .35, .5, 0, .8, .35]],
  [[.3, 0, .3, 1], [.3, 0, .75, .25, .3, .5, .75, .75, .3, 1]],
  [[.25, 0, .25, 1], [.75, 0, .75, 1], [.25, 0, .5, .3, .75, 0]],
  [[.25, 0, .25, 1], [.75, 0, .75, 1], [.25, 0, .75, .5], [.75, 0, .25, .5]],
  [[.35, 0, .35, 1], [.35, .1, .75, .4]],
  [[.5, .1, .8, .5, .5, .9, .2, .5, .5, .1]],
  [[.2, .1, .2, .9, .8, .1, .8, .9, .2, .1]],
  [[.5, .05, .2, .35, .5, .65, .8, .35, .5, .05], [.2, .95, .5, .65, .8, .95]],
];

const CV = 1024;
const MID = CV / 2;
const RUNE_R = 445;
const KNOT_R = 335;
const GOLD = '#d9c78e';
const CORE = '#fff4d0';

function ringStroke(g: CanvasRenderingContext2D, r: number, w: number) {
  const pass = (lw: number, style: string) => {
    g.strokeStyle = style; g.lineWidth = lw;
    g.beginPath(); g.arc(MID, MID, r, 0, Math.PI * 2); g.stroke();
  };
  pass(w + 8, '#000000');
  pass(w, GOLD);
  pass(Math.max(1.5, w * 0.25), CORE);
}

/** One rune at canvas angle `th`, upright with its top pointing outward. */
function drawRune(g: CanvasRenderingContext2D, idx: number, th: number, fill: string, outline: boolean) {
  g.save();
  g.translate(MID + Math.cos(th) * RUNE_R, MID + Math.sin(th) * RUNE_R);
  g.rotate(th + Math.PI / 2);
  const w = 46, h = 66;
  const pass = (lw: number, style: string) => {
    g.strokeStyle = style; g.lineWidth = lw;
    for (const pl of FUTHARK[idx]) {
      g.beginPath();
      for (let i = 0; i < pl.length; i += 2) {
        const x = (pl[i] - 0.5) * w, y = (pl[i + 1] - 0.5) * h;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  };
  g.lineCap = 'square';
  g.lineJoin = 'miter';
  if (outline) pass(17, '#000000');
  pass(9, fill);
  pass(2.5, CORE);
  g.restore();
}

/** Ground circle, base layer: rings, interlaced knotwork band, valknut triangles and dim runes. */
function runeCircleTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = CV;
  const g = cv.getContext('2d');
  if (g) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    ringStroke(g, 500, 9);
    ringStroke(g, 392, 6);
    ringStroke(g, 288, 6);
    ringStroke(g, 218, 5);
    // Knotwork: two strands weaving around the band, A redrawn over B at every other crossing.
    const K = 12;
    const amp = 34;
    const strand = (sign: number, from: number, to: number) => {
      const steps = Math.max(2, Math.round((to - from) * 90));
      const path = () => {
        g.beginPath();
        for (let i = 0; i <= steps; i++) {
          const th = from + ((to - from) * i) / steps;
          const r = KNOT_R + sign * amp * Math.sin(K * th);
          const x = MID + Math.cos(th) * r, y = MID + Math.sin(th) * r;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      };
      g.strokeStyle = '#000000'; g.lineWidth = 24; path();
      g.strokeStyle = GOLD; g.lineWidth = 15; path();
      g.strokeStyle = CORE; g.lineWidth = 3; path();
    };
    strand(1, 0, Math.PI * 2);
    strand(-1, 0, Math.PI * 2);
    for (let j = 0; j < K * 2; j += 2) {
      const c = (j * Math.PI) / K;
      strand(1, c - 0.11, c + 0.11);
    }
    // Valknut: three interlocked triangles.
    for (let k = 0; k < 3; k++) {
      const a0 = -Math.PI / 2 + (k * Math.PI * 2) / 3;
      const pts = [0, 1, 2].map((i) => [
        MID + Math.cos(a0 + (i * Math.PI * 2) / 3) * 165,
        MID + Math.sin(a0 + (i * Math.PI * 2) / 3) * 165,
      ]);
      const tri = (lw: number, style: string) => {
        g.strokeStyle = style; g.lineWidth = lw;
        g.beginPath();
        pts.forEach((p, i) => (i === 0 ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1])));
        g.closePath(); g.stroke();
      };
      g.lineJoin = 'miter';
      tri(17, '#000000'); tri(9, GOLD); tri(2.5, CORE);
    }
    for (let i = 0; i < RUNES; i++) drawRune(g, i, -Math.PI / 2 + (i / RUNES) * Math.PI * 2, '#9c8e66', true);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Same runes, bright fill only, on a transparent layer: lit one by one over the dim ones. */
function runeLitTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = CV;
  const g = cv.getContext('2d');
  if (g) for (let i = 0; i < RUNES; i++) drawRune(g, i, -Math.PI / 2 + (i / RUNES) * Math.PI * 2, '#e6cf88', false);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Canvas layer with an angular reveal: mode 0 sweeps by angle, mode 1 shows the first `uProg` runes. */
function runeMaterial(map: THREE.Texture, mode: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uMode: { value: mode }, uProg: { value: 0 }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uMode, uProg, uOpacity; varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float f = fract((-atan(p.y, p.x) + 1.5707963) / 6.2831853);
        float show = uMode < 0.5 ? step(f, uProg) : step(floor(f * ${RUNES}.0), uProg - 1.0);
        vec4 t = texture2D(uMap, vUv);
        gl_FragColor = vec4(t.rgb, t.a * show * uOpacity);
        #include <colorspace_fragment>
      }`,
  });
}

function bandColor(i: number): THREE.Color {
  return new THREE.Color(BAND_HEX[i]).multiplyScalar(BAND_DIM);
}

export class BifrostStrike implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BifrostStrikeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private hitDone = false;
  private center = new THREE.Vector3(0, 0, -2);
  private sky = new THREE.Vector3();

  // Bridge path samples (world space, before the hang offset) and ribbon axes.
  private pathP: THREE.Vector3[] = [];
  private pathW: THREE.Vector3[] = [];

  private bridge = new THREE.Group();
  private outlines: THREE.Mesh[] = [];
  private bands: THREE.Mesh[] = [];
  private core: THREE.Mesh;
  private coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  private outlineMat = new THREE.MeshBasicMaterial({ color: 0x0c0e18, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  private bandMats: THREE.MeshBasicMaterial[] = [];

  private baseMat = runeMaterial(runeCircleTexture(), 0);
  private litMat = runeMaterial(runeLitTexture(), 1);
  private circle: THREE.Mesh;
  private lit: THREE.Mesh;
  private drawStar = new StarBurst({ points: 4, inner: 0.14, jitter: 0, color: 0xf0e6c0, core: 0xffffff, additive: false });
  private skyStar = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xd9d2ff, core: 0xffffff, additive: false });
  private hitStar = new StarBurst({ points: 9, inner: 0.24, color: 0xf0cf7a, core: 0xfff0c8, additive: false });
  private hitGlint = new StarBurst({ points: 4, inner: 0.1, jitter: 0, color: 0xffffff, core: 0xffffff, additive: false });

  private rings: THREE.Mesh[] = [];
  private ringMats: THREE.MeshBasicMaterial[] = [];
  private shockDark: THREE.Mesh;
  private shockDarkMat = new THREE.MeshBasicMaterial({ color: 0x0c0e18, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });

  private shardMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.95 });
  private shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.2), this.shardMat, SHARDS);
  private shardSeed = Array.from({ length: SHARDS }, (_, i) => ({
    u: 0.08 + 0.9 * ((i * 0.6180339) % 1),
    band: i % BANDS,
    off: Math.random() - 0.5,
    v: new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.2, (Math.random() - 0.5) * 1.6),
    spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
    delay: Math.random() * 0.25,
  }));

  private smoke = new SmokeBall({ color: 0x1c2030, rim: 0x30364c, flake: 0x1c2030, maxBalls: 3 });
  private smokeDone = false;
  private sparks: Emitter;
  private dust: Emitter;

  constructor(settings: BifrostStrikeSettings = defaultBifrostStrike()) {
    this.settings = settings;
    this.screen.tint.set(0x24305a);
    this.screen.impactColor.set(0xeee8ff);
    this.screen.speedLineColor.set(0xd9d2ff);

    const plane = new THREE.PlaneGeometry(GROUND_R * 2, GROUND_R * 2);
    this.circle = new THREE.Mesh(plane, this.baseMat);
    this.lit = new THREE.Mesh(plane, this.litMat);
    for (const m of [this.circle, this.lit]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 4; }
    this.circle.position.y = 0.04;
    this.lit.position.y = 0.05;

    this.core = new THREE.Mesh(new THREE.BufferGeometry(), this.coreMat);
    this.core.renderOrder = 12;
    this.core.frustumCulled = false;
    for (let i = 0; i < BANDS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: bandColor(i), transparent: true, depthWrite: false, side: THREE.DoubleSide });
      this.bandMats.push(mat);
      const b = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      const o = new THREE.Mesh(new THREE.BufferGeometry(), this.outlineMat);
      b.renderOrder = 11; o.renderOrder = 10;
      b.frustumCulled = false; o.frustumCulled = false;
      this.bands.push(b); this.outlines.push(o);
      this.bridge.add(o);
    }
    for (const b of this.bands) this.bridge.add(b);
    this.bridge.add(this.core);

    const ringGeo = new THREE.RingGeometry(0.9, 1, 72);
    for (let i = 0; i < BANDS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: bandColor(i), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(ringGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 6 + i;
      this.ringMats.push(mat); this.rings.push(m);
      this.group.add(m);
    }
    this.shockDark = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 72), this.shockDarkMat);
    this.shockDark.rotation.x = -Math.PI / 2;
    this.shockDark.renderOrder = 5;

    this.shards.frustumCulled = false;
    this.shards.renderOrder = 13;
    for (let i = 0; i < SHARDS; i++) this.shards.setColorAt(i, bandColor(this.shardSeed[i].band));

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 10, speedJitter: 0.6, spread: 80, gravity: 10, drag: 1.6,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#8f8cff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    // Dark storm debris: normal-blended so the pale rings and stars read against it.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.6, speed: 5, speedJitter: 0.6, spread: 80, gravity: -0.1, drag: 1.5,
      sizeStart: 0.9, sizeEnd: 2, colorStart: '#2c3046', colorEnd: '#0c0e18',
      opacityStart: 0.5, opacityEnd: 0, additive: false, colorMid: '#1a1c2c', sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
      groundFade: 0.3,
    });
    this.emitters.push(this.sparks, this.dust, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.group.add(
      this.circle, this.lit, this.shockDark, this.bridge, this.shards, this.smoke.mesh,
      this.drawStar.mesh, this.skyStar.mesh, this.hitStar.mesh, this.hitGlint.mesh,
    );
    this.build(new THREE.Vector3(0, 0, -2), Math.PI);
    this.reset();
  }

  get duration() {
    return this.settings.hitTime + AFTERMATH;
  }

  /** Lays out the bridge path and rebuilds the ribbon geometry for a landing point and cast direction. */
  private build(center: THREE.Vector3, aim: number) {
    this.center.copy(center).setY(0);
    const fwd = new THREE.Vector3(Math.sin(aim), 0, Math.cos(aim));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    // The bridge comes from beyond the circle (away from the caster), a little to the side so it reads as a
    // diagonal arc from behind the caster as well as from the editor's side view.
    const d = fwd.clone().multiplyScalar(0.8).addScaledVector(right, 0.6).normalize();
    const c = this.center;
    const p0 = c.clone().addScaledVector(d, 11).setY(12.5);
    const p1 = c.clone().addScaledVector(d, 9).setY(18);
    const p2 = c.clone().addScaledVector(d, 1.8).setY(9);
    const p3 = c.clone().setY(0);
    this.sky.copy(p0);
    const n = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
    this.pathP = [];
    this.pathW = [];
    const tan = new THREE.Vector3();
    for (let k = 0; k <= SEG; k++) {
      const u = k / SEG, q = 1 - u;
      const p = new THREE.Vector3()
        .addScaledVector(p0, q * q * q).addScaledVector(p1, 3 * q * q * u)
        .addScaledVector(p2, 3 * q * u * u).addScaledVector(p3, u * u * u);
      tan.set(0, 0, 0)
        .addScaledVector(p1.clone().sub(p0), 3 * q * q)
        .addScaledVector(p2.clone().sub(p1), 6 * q * u)
        .addScaledVector(p3.clone().sub(p2), 3 * u * u);
      if (tan.lengthSq() < 1e-8) tan.set(0, -1, 0);
      tan.normalize();
      // The ribbon is rolled 45 degrees around its tangent: readable from behind the caster and from the side.
      const inPlane = new THREE.Vector3().crossVectors(tan, n).normalize();
      const w = n.clone().multiplyScalar(Math.cos(TILT)).addScaledVector(inPlane, Math.sin(TILT)).normalize();
      this.pathP.push(p);
      this.pathW.push(w);
    }
    const W = this.settings.bridgeWidth;
    const bw = W / BANDS;
    const inset = bw * 0.08;
    for (let i = 0; i < BANDS; i++) {
      this.swap(this.outlines[i], this.strip(-W / 2 + i * bw, -W / 2 + (i + 1) * bw));
      this.swap(this.bands[i], this.strip(-W / 2 + i * bw + inset, -W / 2 + (i + 1) * bw - inset));
    }
    this.swap(this.core, this.strip(-0.045, 0.045));
    this.circle.position.set(c.x, 0.04, c.z);
    this.lit.position.set(c.x, 0.05, c.z);
    this.shockDark.position.set(c.x, 0.045, c.z);
    this.rings.forEach((r, i) => r.position.set(c.x, 0.06 + i * 0.004, c.z));
  }

  private swap(mesh: THREE.Mesh, geo: THREE.BufferGeometry) {
    mesh.geometry.dispose();
    mesh.geometry = geo;
  }

  /** A ribbon strip along the path between two offsets across the width. */
  private strip(lo: number, hi: number): THREE.BufferGeometry {
    const pos = new Float32Array((SEG + 1) * 2 * 3);
    const idx: number[] = [];
    for (let k = 0; k <= SEG; k++) {
      const p = this.pathP[k], w = this.pathW[k];
      pos.set([p.x + w.x * lo, p.y + w.y * lo, p.z + w.z * lo, p.x + w.x * hi, p.y + w.y * hi, p.z + w.z * hi], k * 6);
      if (k < SEG) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    return geo;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.build(ctx.point, ctx.aim);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.set(this.center.x, 1.2, this.center.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hitDone = false;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.sparks.update(dt);
    this.dust.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    if (!this.hitDone && this.time >= this.settings.hitTime) this.onHit();
    if (!this.smokeDone && this.time >= this.settings.hitTime + 0.15) this.onSmoke();
    this.layout(dt);
  }

  private setRange(mesh: THREE.Mesh, start: number, head: number) {
    const a = Math.max(0, Math.min(SEG, Math.floor(start * SEG)));
    const b = Math.max(a, Math.min(SEG, Math.floor(head * SEG)));
    mesh.visible = b > a;
    mesh.geometry.setDrawRange(a * 6, (b - a) * 6);
  }

  private layout(dt: number) {
    const D = this.settings.hitTime;
    const t = this.time;
    const after = t - D;
    const c = this.center;
    const sc = this.screen;

    // 1. World: darkens into a storm, stays dark through the build, releases slowly after the hit.
    const dark = t < D ? 0.7 + 0.12 * smoothstep((t - 1.4) / 0.4) : 0.82 * Math.exp(-Math.max(0, after - 0.2) * 1.6);
    sc.darken = dark * smoothstep(t / 0.5);
    sc.speedLines = t > D - 0.3 && t < D + 0.05 ? 0.6 * smoothstep((t - (D - 0.3)) / 0.3) : 0;
    sc.impact = impactFrameAt(t, D, [1, 2], 0.04);
    sc.chroma = after > 0.1 && after < 0.5 ? 0.5 * Math.exp(-(after - 0.1) * 9) : 0;
    sc.edgeTint.set(0x8f6aff);

    // 2. Rune circle draws on (a pale star runs along the sweep), then the runes light one by one.
    const draw = smoothstep(t / 0.65);
    const ringFade = 1 - smoothstep((t - (D + 1.35)) / (this.duration - D - 1.55));
    this.baseMat.uniforms.uProg.value = t >= 0.65 ? 1.01 : draw;
    this.baseMat.uniforms.uOpacity.value = 0.95 * smoothstep(t / 0.15) * ringFade;
    const litN = Math.ceil(RUNES * THREE.MathUtils.clamp((t - 1.5) / 0.26, 0, 1));
    this.litMat.uniforms.uProg.value = t >= D ? RUNES + 1 : litN + 1;
    const flash = after >= 0 ? 0.55 + 0.45 * Math.exp(-after * 3) : 0.95;
    this.litMat.uniforms.uOpacity.value = (t >= 1.5 ? flash : 0) * ringFade;
    const th = -Math.PI / 2 + draw * Math.PI * 2;
    const dp = t < 0.7 ? 1 : 0;
    this.drawStar.set(
      new THREE.Vector3(c.x + Math.cos(th) * 488 * (GROUND_R / MID), 0.3, c.z + Math.sin(th) * 488 * (GROUND_R / MID)),
      0.55 * dp * (t > 0.02 ? 1 : 0), dp * 0.95, t * 3,
    );

    // 3. Prism glint in the sky, then the bridge grows band by band (red first), slowly.
    const skyPop = StarBurst.pop(t - 0.72, 0.9, 0.25);
    this.skyStar.set(this.sky, 2.1 * Math.max(skyPop.scale, t >= 0.72 && t < D ? 0.55 : 0), t >= 0.72 && t < D + 0.1 ? 0.95 : 0, t * 0.8);

    const wBand: number[] = [];
    for (let i = 0; i < BANDS; i++) {
      const g = smoothstep((t - (0.74 + i * 0.04)) / 0.66);
      const front = smoothstep((t - (D + 0.32 + i * 0.035)) / 1.0);
      wBand.push(g);
      this.setRange(this.bands[i], front, g);
      this.setRange(this.outlines[i], front, g);
    }
    this.setRange(this.core, smoothstep((t - (D + 0.45)) / 1.0), wBand[3]);
    // Hangs short of the ground, trembling a touch, then slams down.
    const slam = smoothstep(after / 0.05);
    const tremble = t > 1.45 && t < D ? Math.sin(t * 90) * 0.012 : 0;
    this.bridge.position.y = HANG * (1 - (t >= D ? slam : 0)) + tremble;
    const dissolved = after > 1.5;
    this.bridge.visible = !dissolved;
    const fadeRun = after > 1.0 ? 1 - smoothstep((after - 1.0) / 0.5) : 1;
    this.outlineMat.opacity = fadeRun;
    this.coreMat.opacity = 0.9 * fadeRun;
    for (const m of this.bandMats) m.opacity = fadeRun;

    // 4. Impact: seven colour rings in order, a dark shock ring, star pop, shake.
    for (let i = 0; i < BANDS; i++) {
      const age = after - i * 0.03;
      const m = this.rings[i];
      if (age < 0) { m.visible = false; continue; }
      const s = 0.8 + 6.2 * (1 - Math.exp(-age * 5.5));
      m.visible = true;
      m.scale.setScalar(s);
      this.ringMats[i].opacity = 0.9 * (1 - smoothstep(age / 0.6));
    }
    const dAge = after - 0.02;
    this.shockDark.visible = dAge >= 0;
    this.shockDark.scale.setScalar(Math.max(1e-3, 0.9 + 6.4 * (1 - Math.exp(-Math.max(0, dAge) * 5.2))));
    this.shockDarkMat.opacity = dAge >= 0 ? 0.7 * (1 - smoothstep(dAge / 0.7)) : 0;

    const pop = StarBurst.pop(after - 0.04, 0.1, 0.2);
    this.hitStar.set(new THREE.Vector3(c.x, 1.3, c.z), 3.4 * pop.scale, pop.opacity, 0.3);
    const gp = StarBurst.pop(after - 0.1, 0.06, 0.22);
    this.hitGlint.set(new THREE.Vector3(c.x, 3.4, c.z), 2.6 * gp.scale, gp.opacity, t * 1.5);
    this.shake = after >= 0 ? 0.85 * Math.exp(-after * 6.5) : t > 1.0 ? 0.03 : 0;

    // 5. Aftermath: the bridge breaks into falling prism shards, starting at the sky end.
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pv = new THREE.Vector3();
    const sv = new THREE.Vector3();
    for (let i = 0; i < SHARDS; i++) {
      const s = this.shardSeed[i];
      const born = D + 0.32 + s.u * 1.0 + s.delay;
      const age = t - born;
      if (age < 0 || age > 1.9) {
        this.shards.setMatrixAt(i, m.compose(pv.set(0, -50, 0), q.identity(), sv.setScalar(1e-4)));
        continue;
      }
      const k = Math.min(SEG, Math.round(s.u * SEG));
      const bw = this.settings.bridgeWidth / BANDS;
      const base = this.pathP[k], w = this.pathW[k];
      const offs = -this.settings.bridgeWidth / 2 + (s.band + 0.5) * bw + s.off * bw * 0.6;
      pv.set(
        base.x + w.x * offs + s.v.x * age,
        base.y + w.y * offs + s.v.y * age - 0.5 * 13 * age * age,
        base.z + w.z * offs + s.v.z * age,
      );
      if (pv.y < 0.08) pv.y = 0.08;
      e.set(s.spin.x * age, s.spin.y * age, s.spin.z * age);
      const size = (0.55 + 0.9 * ((i * 7) % 5) / 5) * (1 - smoothstep((age - 1.0) / 0.9));
      m.compose(pv, q.setFromEuler(e), sv.setScalar(Math.max(1e-4, size)));
      this.shards.setMatrixAt(i, m);
    }
    this.shards.instanceMatrix.needsUpdate = true;
    if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate = true;
    void dt;
  }

  /** One small storm-grey smoke ball at the circle's far edge, so the colour rings carry the impact. */
  private onSmoke() {
    this.smokeDone = true;
    const a = this.ctx?.aim ?? Math.PI;
    const c = this.center;
    this.smoke.trigger(new THREE.Vector3(c.x + Math.sin(a) * 3.6, 0.6, c.z + Math.cos(a) * 3.6), 1.0, 1.1);
  }

  private onHit() {
    this.hitDone = true;
    const c = this.center;
    this.sparks.burst(260, new THREE.Vector3(c.x, 0.3, c.z));
    this.dust.burst(200, new THREE.Vector3(c.x, 0.3, c.z));
    const ctx = this.ctx;
    if (ctx) ctx.targets.forEach((en) => ctx.hit(en, { damage: this.settings.damage, knock: 5, from: c.clone() }));
  }
}

export const bifrostStrikeModule: EffectModule = {
  label: 'bifrost strike',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new BifrostStrike(),
  telegraphs(effect) {
    const e = effect as BifrostStrike;
    const c = e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: RADIUS }, start: 0.1, impact: e.settings.hitTime }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.45, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BifrostStrike;
    if (e.ctx) frameCast(camera, controls, e.ctx, 13);
  },
  buildGui(f, effect) {
    const s = (effect as BifrostStrike).settings;
    f.add(s, 'loop');
    f.add(s, 'hitTime', 1.2, 3, 0.05).name('hit time');
    f.add(s, 'bridgeWidth', 1.5, 5, 0.1).name('bridge width');
    f.add(s, 'damage', 1, 150, 1);
  },
};
