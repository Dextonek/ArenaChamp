import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { LightPillar, createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Cloud Step Cyclone (targeted, `self` mode): pale jade-white xiangyun cloud curls (drawn on canvas, outlined,
 * three-step value ramp) spiral out of the ground round the caster and climb the wall of a twisted toon-wind funnel.
 * Enemies in range are dragged in and lifted into it, ticked every 0.4 s. The funnel pinches tight, a dead beat,
 * then blows outward: impact frames, a flat nova of crescents, the curls flung out as a ring, enemies hurled away.
 * The curls thin out to bare outlines and vanish while a grey dust vortex keeps turning on the ground.
 *
 * Palette row: Wind (docs/ART_BIBLE.md). Recipes: j-lelu-twisted-wind-tornado (twisted funnel, texture scrolled
 * against the spin, alpha-clipped), i-guide-swirl-slice-tornado (horizontal swirl slices stacked by height),
 * e-seo-wind-bullet (crescents on tilted planes, the nova pushed out from the caster).
 */
export interface CloudStepCycloneSettings {
  damage: number;
  tickDamage: number;
  knock: number;
  loop: boolean;
}

export const defaultCloudStepCyclone = (): CloudStepCycloneSettings => ({ damage: 35, tickDamage: 6, knock: 9, loop: false });

const D = 2.4; // burst
const DURATION = 4.4;
const GATHER = 0.6;
const FUNNEL_END = 2.2;
const PINCH_END = 2.35;
const TICKS = [0.8, 1.2, 1.6, 2.0];
const RADIUS = 6;
const H = 6; // funnel height, metres
const TWIST = 1.3; // radians of twist from foot to top
const SPIN = 6; // funnel spin, rad/s
const N_GROUND = 14;
const N_WALL = 30;
const N_CURL = N_GROUND + N_WALL;
const N_DEBRIS = 24;
const N_SLICE = 7;
const MAX_STARS = 6;

// Pale jade-white: every fill stays under the bloom threshold, white only in thin edges.
const DARK = 0x1d3a34;
const EDGE = 0xeefff6;
const MID = 0x8fdcc4;
const SHADE = 0x4fb89c;
const BODY = 0x7fd8c0;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const fract = (x: number) => x - Math.floor(x);

/** Funnel wall radius at normalised height 0..1 (the same formula runs in the funnel vertex shader). */
const radiusAt = (hn: number) => 1.6 + 2.0 * Math.pow(hn, 1.5) + 0.5 * smoothstep((hn - 0.85) / 0.15);

/**
 * One xiangyun cloud curl as a hard-edged drawing (canvas 512 x 256): a big spiral head on the left, two smaller
 * lobes, a tapering tail that hooks into a small curl on the right. Dark outline (union of all lobes), a dark
 * line wherever lobes overlap, a value ramp light -> mid -> shade on each lobe, and a thin white edge on the
 * upper-left of each lobe. The head faces -X: it leads, the tail trails to +X.
 */
function cloudCurlTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const out = '#0f2a22';

  const lobes: number[][] = [[285, 175, 40], [222, 160, 52], [78, 150, 46], [150, 115, 78], [472, 140, 22]];
  const tail = new Path2D();
  tail.moveTo(250, 140);
  tail.bezierCurveTo(330, 152, 400, 150, 458, 126);
  tail.lineTo(470, 146);
  tail.bezierCurveTo(420, 196, 330, 215, 250, 210);
  tail.closePath();

  // 1. Thick outline of the whole union.
  g.strokeStyle = out;
  g.lineWidth = 16;
  g.stroke(tail);
  for (const [x, y, r] of lobes) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }

  // 2. Fills back to front, each with its own thinner line so overlaps read as separate puffs.
  const tg = g.createLinearGradient(250, 150, 470, 150);
  tg.addColorStop(0, '#a8dcc4');
  tg.addColorStop(1, '#6fbfa6');
  g.fillStyle = tg;
  g.lineWidth = 6;
  g.fill(tail);
  g.stroke(tail);
  for (const [x, y, r] of lobes) {
    const rg = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
    rg.addColorStop(0, '#c4e6d2');
    rg.addColorStop(0.5, '#8fcfb4');
    rg.addColorStop(1, '#4f9c86');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // 3. Thin white edge on the upper-left of each lobe.
  g.strokeStyle = '#f2fff6';
  g.lineWidth = 3;
  for (const [x, y, r] of lobes) {
    if (r < 30) continue;
    g.beginPath();
    g.arc(x, y, r - 10, Math.PI * 1.08, Math.PI * 1.45);
    g.stroke();
  }

  // 4. Spiral in the head (dark line + a thin light line beside it) and a tiny one in the tail curl.
  const spiral = (cx: number, cy: number, r0: number, k: number, turns: number, dx: number) => {
    g.beginPath();
    for (let a = 0; a <= turns * Math.PI * 2; a += 0.1) {
      const r = r0 + a * k;
      const x = cx + Math.cos(a + 0.6) * r + dx;
      const y = cy + Math.sin(a + 0.6) * r + dx;
      if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  };
  g.strokeStyle = out;
  g.lineWidth = 6;
  spiral(150, 118, 8, 7.5, 1.1, 0);
  g.lineWidth = 4;
  spiral(472, 140, 4, 3.4, 1.0, 0);
  g.strokeStyle = '#f2fff6';
  g.lineWidth = 2.2;
  spiral(150, 118, 8, 7.5, 1.1, -3.5);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Instanced cloud curls: opaque alpha-tested sprites. Per-instance `aFade` thins the fills first, then the lines. */
function curlMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uMap: { value: map } },
    vertexShader: /* glsl */ `
      attribute float aFade; attribute float aSeed;
      varying vec2 vUv; varying float vFade; varying float vSeed;
      void main() {
        vUv = uv; vFade = aFade; vSeed = aSeed;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec2 vUv; varying float vFade; varying float vSeed;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + vSeed * 37.0) * 43758.5453); }
      void main() {
        vec4 tx = texture2D(uMap, vUv);
        if (tx.a < 0.5) discard;
        float lum = dot(tx.rgb, vec3(0.299, 0.587, 0.114));
        float n = hash(floor(vUv * vec2(44.0, 22.0)));
        // Fills eat away first; the dark outline (and the spiral) hangs on longer, thinning out.
        float thr = lum < 0.1 ? (vFade - 0.45) * 1.9 : vFade * 1.7;
        if (n < thr) discard;
        gl_FragColor = vec4(tx.rgb, 1.0);
      }`,
  });
}

/**
 * The funnel: hollow cylinder, radius profile flared at the top, vertices twisted and the base pushed off centre,
 * toon bands (dark line, thin white edge, mid, shade, dark line) with gaps cut by alpha clip. Opaque, no glow.
 */
function funnelMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uScroll: { value: 0 }, uDissolve: { value: 1 },
      uDark: { value: new THREE.Color(DARK) }, uEdge: { value: new THREE.Color(EDGE) },
      uMid: { value: new THREE.Color(MID) }, uShade: { value: new THREE.Color(SHADE) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv; varying float vH;
      float R(float h) { return 1.6 + 2.0 * pow(h, 1.5) + 0.5 * smoothstep(0.85, 1.0, h); }
      void main() {
        float h = position.y;
        float a = uv.x * 6.2831853 + ${TWIST.toFixed(2)} * h;
        float r = R(h);
        vec2 off = (1.0 - h) * (1.0 - h) * 0.5 * vec2(cos(uTime * 3.0), sin(uTime * 3.0));
        vec3 p = vec3(cos(a) * r + off.x, h * ${H.toFixed(1)}, sin(a) * r + off.y);
        vUv = vec2(uv.x, h); vH = h;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uScroll, uDissolve; uniform vec3 uDark, uEdge, uMid, uShade;
      varying vec2 vUv; varying float vH;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        float n = hash(floor(vec2(vUv.x * 96.0, vH * 40.0)));
        if (n < uDissolve) discard;
        if (vH < 0.03) discard;
        if (vH > 0.9 && n < (vH - 0.9) * 8.0) discard;
        float wob = 0.06 * sin(vUv.x * 18.8495 + vH * 9.0);
        float s = fract(vUv.x * 6.0 + vH * 1.4 + uScroll + wob);
        if (s > 0.76) discard;
        vec3 col = s < 0.07 ? uDark : (s < 0.13 ? uEdge : (s < 0.46 ? uMid : (s < 0.70 ? uShade : uDark)));
        col = mix(uDark, col, smoothstep(0.0, 0.18, vH));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

interface Curl {
  wall: boolean;
  a0: number; r: number; h0: number; climb: number; w: number; size: number;
  delay: number; v: number; hEnd: number; fd: number;
}

interface CurlPose { x: number; y: number; z: number; a: number; size: number; flat: number }

export class CloudStepCyclone implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CloudStepCycloneSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private burst = false;
  private tick = 0;
  private from = new THREE.Vector3();
  private lastOff: THREE.Vector3[] = [];
  private tgtDone = false;

  private funnelMat = funnelMaterial();
  private funnel: THREE.Mesh;
  private slices: CrescentArc[] = [];
  private slicePlanes: THREE.Group[] = [];
  private swirls: CrescentArc[] = [];
  private swirlPlane = new THREE.Group();
  private nova: CrescentArc[] = [];
  private novaPlanes: THREE.Group[] = [];

  private curlGeo = new THREE.PlaneGeometry(2, 1);
  private curlFade = new THREE.InstancedBufferAttribute(new Float32Array(N_CURL), 1);
  private curls: THREE.InstancedMesh;
  private curlData: Curl[] = [];
  private curlD: CurlPose[] = Array.from({ length: N_CURL }, () => ({ x: 0, y: 0, z: 0, a: 0, size: 1, flat: 0 }));

  private debris: THREE.InstancedMesh;
  private debData = Array.from({ length: N_DEBRIS }, () => ({
    a0: Math.random() * Math.PI * 2, h0: Math.random(), w: SPIN * (0.8 + Math.random() * 0.4), rr: 0.5 + Math.random() * 0.4,
    size: 0.5 + Math.random() * 0.7, p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), live: false,
    spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
  }));

  private groundRing = createRing(0x9ff2c8, 0.97, 1, 96);
  private groundRune = createRing(0x7fd8c0, 0.93, 1, 6);
  private novaDark = createRing(DARK, 0.7, 1, 96);
  private novaRing = createRing(0x9ff2c8, 0.9, 1, 96);
  private needle = new LightPillar(0xbff0dc, 0.12);
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xbff0dc, core: 0xf2fff6, additive: false });
  private strike = new StarBurst({ points: 9, color: 0xbfeedd, core: 0xf2fff6, additive: false });
  private stars: StarBurst[] = [];

  private dust: Emitter;
  private motes: Emitter;

  constructor(settings: CloudStepCycloneSettings = defaultCloudStepCyclone()) {
    this.settings = settings;
    this.screen.tint.set(0x2c5a50);
    this.screen.impactColor.set(0xbfeedd);
    this.screen.speedLineColor.set(0xe6fff6);
    this.screen.edgeTint.set(0x7fd8c0);

    // --- Funnel mesh: y runs 0..1 in the geometry, the vertex shader lifts it to H metres. ---
    const fg = new THREE.CylinderGeometry(1, 1, 1, 48, 28, true).translate(0, 0.5, 0);
    this.funnel = new THREE.Mesh(fg, this.funnelMat);
    this.funnel.frustumCulled = false;
    this.funnel.visible = false;
    this.group.add(this.funnel);

    // --- Swirl slices riding the funnel wall (radius 1 arcs, scaled to the wall radius each frame). ---
    for (let i = 0; i < N_SLICE; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({ radius: 1, width: 0.3, style: 'toon', sweep: Math.PI * 1.3, edge: 0xcfeedd, mid: MID, outer: DARK });
      arc.mesh.rotation.x = -Math.PI / 2 + (i % 2 ? 0.2 : -0.2);
      plane.add(arc.mesh);
      this.slices.push(arc);
      this.slicePlanes.push(plane);
      this.group.add(plane);
    }

    // --- Ground dust vortex: flat toon crescents in grey-green. ---
    for (let i = 0; i < 4; i++) {
      const arc = new CrescentArc({ radius: 2.2 + 0.9 * i, width: 1.0, style: 'toon', sweep: Math.PI * 1.5, edge: 0xa9bbb4, mid: 0x6a827a, outer: DARK });
      arc.mesh.rotation.z = (i * Math.PI) / 2;
      this.swirlPlane.add(arc.mesh);
      this.swirls.push(arc);
    }
    this.swirlPlane.rotation.x = -Math.PI / 2;
    this.group.add(this.swirlPlane);

    // --- Burst nova: three crescents on tilted planes pushed outward. ---
    for (let i = 0; i < 3; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({ radius: 1, width: 0.28, style: 'toon', sweep: Math.PI * 1.4, edge: 0xdff7ec, mid: BODY, outer: DARK });
      arc.mesh.rotation.x = -Math.PI / 2 + 0.18;
      plane.add(arc.mesh);
      plane.rotation.y = i * 2.1;
      this.nova.push(arc);
      this.novaPlanes.push(plane);
      this.group.add(plane);
    }

    // --- Cloud curls ---
    const tex = cloudCurlTexture();
    const seeds = new Float32Array(N_CURL);
    for (let i = 0; i < N_CURL; i++) {
      seeds[i] = Math.random() * 20;
      const wall = i >= N_GROUND;
      this.curlData.push(wall
        ? {
          wall, a0: Math.random() * Math.PI * 2, r: 0, h0: Math.random(), climb: 0.13 + Math.random() * 0.08,
          w: SPIN * (0.82 + Math.random() * 0.3), size: 0.75 + Math.random() * 0.35, delay: Math.random() * 0.4,
          v: 7 + Math.random() * 4, hEnd: 0.5 + Math.random() * 2, fd: Math.random() * 0.3,
        }
        : {
          wall, a0: (i / N_GROUND) * Math.PI * 2 + Math.random() * 0.3, r: 2.4 + (i % 3) * 1.3 + Math.random() * 0.5, h0: 0, climb: 0,
          w: 2.4 + Math.random() * 0.8, size: 1.1 + Math.random() * 0.4, delay: Math.random() * 0.4,
          v: 4 + Math.random() * 4, hEnd: 0, fd: Math.random() * 0.3,
        });
    }
    this.curlGeo.setAttribute('aFade', this.curlFade);
    this.curlGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.curls = new THREE.InstancedMesh(this.curlGeo, curlMaterial(tex), N_CURL);
    this.curls.frustumCulled = false;
    this.group.add(this.curls);

    // --- Debris: small dark chunks in the funnel (unlit, so no NaN risk). ---
    this.debris = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(0.11), new THREE.MeshBasicMaterial({ color: 0x1d2a26 }), N_DEBRIS,
    );
    this.debris.frustumCulled = false;
    this.group.add(this.debris);

    for (let i = 0; i < MAX_STARS; i++) {
      const s = new StarBurst({ points: 9, color: 0xbfeedd, core: 0xf2fff6, additive: false });
      this.stars.push(s);
      this.group.add(s.mesh);
    }
    this.novaDark.material.blending = THREE.NormalBlending;
    this.group.add(this.groundRing.mesh, this.groundRune.mesh, this.novaDark.mesh, this.novaRing.mesh);
    this.group.add(this.needle.mesh, this.glint.mesh, this.strike.mesh);

    // Dark-grey dust, normal-blended and small; gold leaf motes as the small accent.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 1.6, speedJitter: 0.6, spread: 80, gravity: -0.1, drag: 1.2,
      sizeStart: 0.3, sizeEnd: 0.8, colorStart: '#8fa39c', colorEnd: '#1d3a34', colorMid: '#4a625b',
      opacityStart: 0.32, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.4, groundFade: 0.25,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 1.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 4, speedJitter: 0.6, spread: 180, gravity: 0.6, drag: 1.1,
      sizeStart: 0.1, sizeEnd: 0.03, colorStart: '#fff4c8', colorEnd: '#e8c86a',
      opacityStart: 0.7, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.emitters.push(this.dust, this.motes);
    for (const e of this.emitters) this.group.add(e.points);
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
    this.from.copy(ctx.from).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).setY(1.5);
    this.lastOff = ctx.targets.map(() => new THREE.Vector3());
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.burst = false;
    this.tick = 0;
    this.tgtDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
    for (const d of this.debData) { d.live = false; d.p.set(0, -50, 0); }
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    while (this.tick < TICKS.length && this.time >= TICKS[this.tick]) this.onTick(this.tick++);
    if (!this.burst && this.time >= D) this.onBurst();
    this.layout(dt);
  }

  /** Funnel state at time t before the burst: radial scale, height scale, dissolve threshold. */
  private funnelAt(t: number) {
    const grow = smoothstep((t - 0.55) / 0.5);
    const pinch = smoothstep((t - FUNNEL_END) / (PINCH_END - FUNNEL_END));
    return { rad: (0.6 + 0.4 * grow) * (1 - 0.65 * pinch), hs: Math.max(1e-4, grow), dissolve: 1 - smoothstep((t - 0.55) / 0.4) };
  }

  /** Pose of a wall curl on the funnel at t <= D (positions relative to the caster's feet). */
  private wallPose(c: Curl, t: number, out: CurlPose) {
    const f = this.funnelAt(t);
    const hn = fract(c.h0 + Math.max(0, t - GATHER) * c.climb);
    const a = c.a0 + c.w * t + TWIST * hn;
    const r = radiusAt(hn) * f.rad * 1.03;
    const env = smoothstep(hn / 0.12) * (1 - smoothstep((hn - 0.82) / 0.18)) * smoothstep((t - GATHER - c.delay * 0.5) / 0.3);
    out.x = Math.cos(a) * r;
    out.z = Math.sin(a) * r;
    out.y = hn * H * f.hs;
    out.a = a;
    out.size = c.size * env;
    out.flat = 0;
  }

  /** Pose of a ground curl at t <= D. */
  private groundPose(c: Curl, t: number, i: number, out: CurlPose) {
    const pull = smoothstep((t - GATHER) / 0.6) * 0.2 + smoothstep((t - FUNNEL_END) / (PINCH_END - FUNNEL_END)) * 0.35;
    const r = c.r * (1 - pull);
    const a = c.a0 + c.w * t;
    out.x = Math.cos(a) * r;
    out.z = Math.sin(a) * r;
    out.y = 0.07 + i * 0.006;
    out.a = a;
    out.size = c.size * smoothstep((t - c.delay) / 0.3);
    out.flat = 1;
  }

  private layout(dt: number) {
    const t = this.time;
    const aw = t - D;
    const f = this.from;
    const ctx = this.ctx;
    const live = dt > 0 && this.playing;
    const fade = 1 - smoothstep((t - (DURATION - 0.5)) / 0.5);

    // 1. World grade: 0.5 from the gather, deeper at the pinch, released after the burst.
    const grade = 0.5 * smoothstep(t / 0.4) + 0.15 * smoothstep((t - FUNNEL_END) / 0.15);
    this.screen.darken = t < D ? grade : grade * Math.exp(-aw * 2.6);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.speedLines = t < D ? 0.9 * smoothstep((t - FUNNEL_END) / 0.2) : Math.max(0, 0.9 - aw * 5);
    this.screen.chroma = chromaPulse(t, D, 0.6, 10);

    // 2. Funnel (alpha-clipped toon bands), spun one way with the texture scrolling the other.
    const fs = this.funnelAt(t);
    let rad = fs.rad, hs = fs.hs, dis = fs.dissolve;
    if (t >= D) {
      rad = 0.35 + 2.4 * easeOut(aw / 0.35);
      hs = Math.max(1e-4, 1 - 0.65 * smoothstep(aw / 0.3));
      dis = smoothstep((aw - 0.05) / 0.45);
    }
    this.funnel.visible = t > 0.55 && aw < 0.55;
    this.funnel.scale.set(rad, hs, rad);
    this.funnel.position.set(f.x, 0, f.z);
    this.funnel.rotation.y = -SPIN * t;
    this.funnelMat.uniforms.uTime.value = t;
    this.funnelMat.uniforms.uScroll.value = 1.6 * t;
    this.funnelMat.uniforms.uDissolve.value = dis;

    // 3. Swirl slices stacked by height inside the funnel's lifetime.
    const sliceOn = t > 0.7 && t < D;
    this.slices.forEach((arc, i) => {
      const hn = (i + 0.5) / N_SLICE;
      const plane = this.slicePlanes[i];
      const r = radiusAt(hn) * fs.rad * 1.05;
      plane.position.set(f.x, hn * H * fs.hs, f.z);
      plane.scale.setScalar(Math.max(1e-3, r));
      plane.rotation.y = t * (3.5 + i * 0.6);
      arc.head = fract(t * 0.8 + i * 0.37) * 1.4;
      arc.length = 0.55;
      arc.time = t;
      arc.opacity = sliceOn ? 1 : 0;
    });

    // 4. Ground: gold-free jade rings gather and contract; dust vortex keeps turning through the aftermath.
    const gr = t < D ? smoothstep(t / 0.5) * (1 - 0.5 * smoothstep((t - FUNNEL_END) / 0.15)) : 0;
    this.groundRing.mesh.position.set(f.x, 0.05, f.z);
    this.groundRing.mesh.scale.setScalar(RADIUS * (0.35 + 0.65 * smoothstep(t / 0.6)) * (1 - 0.55 * smoothstep((t - FUNNEL_END) / 0.15)));
    this.groundRing.material.opacity = 0.2 * gr;
    this.groundRune.mesh.position.set(f.x, 0.055, f.z);
    this.groundRune.mesh.scale.setScalar(2.6 * (1 - 0.5 * smoothstep((t - FUNNEL_END) / 0.15)));
    this.groundRune.mesh.rotation.z = t * 0.9;
    this.groundRune.material.opacity = 0.3 * gr;
    this.swirlPlane.position.set(f.x, 0.08, f.z);
    this.swirls.forEach((arc, i) => {
      arc.head = fract(t * 0.7 + i * 0.25) * 1.4;
      arc.length = 0.5;
      arc.time = t;
      arc.erosion = smoothstep((t - 3.3) / 1.0);
      arc.opacity = 0.75 * smoothstep(t / 0.6) * (1 - smoothstep((t - 3.5) / 0.85));
    });

    // 5. Cloud curls: ground ones orbit, wall ones climb the funnel; after D both are flung out as a ring.
    this.updateCurls(t, aw);

    // 6. Debris dragged round inside the funnel, thrown out with the burst.
    this.updateDebris(t, aw, live ? dt : 0, fade);

    // 7. Enemies in range are pulled in, lifted and spun round inside the funnel.
    if (ctx && live) this.moveTargets(ctx, t);

    // 8. Pinch tell (glint + thin needle), then the burst stars and nova.
    const pin = smoothstep((t - FUNNEL_END) / 0.2);
    const glintOn = t < D + 0.06 ? 1 : 0;
    this.glint.set(new THREE.Vector3(f.x, 1.6, f.z), 1.5 * pin, glintOn * pin * 0.95, t * 3);
    this.needle.set(f.x, f.z, 0, 8, t > FUNNEL_END && aw < 0.12 ? 0.28 * pin : 0);
    const sp = StarBurst.pop(aw - 0.03, 0.05, 0.14);
    this.strike.set(new THREE.Vector3(f.x, 1.5, f.z), 3.2 * sp.scale, sp.opacity, 0.3);
    this.stars.forEach((s, i) => {
      const tp = ctx?.targetPos[i];
      const pop = StarBurst.pop(aw - 0.05 - i * 0.015, 0.05, 0.14);
      if (!tp || pop.opacity === 0) { s.set(new THREE.Vector3(), 0, 0); return; }
      const off = this.lastOff[i];
      s.set(new THREE.Vector3(tp.x + (off?.x ?? 0), 1.2 + (off?.y ?? 0), tp.z + (off?.z ?? 0)), 2.2 * pop.scale, pop.opacity, i * 0.7);
    });

    const nOn = aw > 0 && aw < 0.55;
    const nk = easeOut(aw / 0.55);
    this.nova.forEach((arc, i) => {
      const plane = this.novaPlanes[i];
      plane.position.set(f.x, 0.5 + 0.45 * i, f.z);
      plane.scale.setScalar(Math.max(1e-3, 1.4 + 6 * nk));
      arc.mesh.rotation.z = aw * 4 + i;
      arc.head = Math.max(0, aw) * 3;
      arc.length = 0.6;
      arc.time = t;
      arc.erosion = smoothstep((aw - 0.2) / 0.4);
      arc.opacity = nOn ? 1 : 0;
    });
    this.novaDark.mesh.position.set(f.x, 0.03, f.z);
    this.novaDark.mesh.scale.setScalar(1 + (aw > 0 ? 6.5 * nk : 0));
    this.novaDark.material.opacity = aw > 0 ? 0.55 * (1 - smoothstep((aw - 0.15) / 0.5)) : 0;
    this.novaRing.mesh.position.set(f.x, 0.06, f.z);
    this.novaRing.mesh.scale.setScalar(1 + (aw > 0 ? 7 * nk : 0));
    this.novaRing.material.opacity = aw > 0 ? 0.5 * (1 - smoothstep(aw / 0.55)) : 0;

    // 9. Camera shake.
    const base = t > GATHER && t < D ? (t > FUNNEL_END ? 0.1 : 0.04) : 0;
    this.shake = aw > 0 ? Math.max(0.7 * Math.exp(-aw * 6), 0) : base;
  }

  private updateCurls(t: number, aw: number) {
    const f = this.from;
    const m = new THREE.Matrix4();
    const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), I = new THREE.Vector3();
    const X2 = new THREE.Vector3(), Y2 = new THREE.Vector3();
    for (let i = 0; i < N_CURL; i++) {
      const c = this.curlData[i];
      const p = this.curlD[i];
      let tilt = c.wall ? -0.3 : 0;
      if (aw <= 0) {
        if (c.wall) this.wallPose(c, t, p); else this.groundPose(c, t, i, p);
      } else {
        // Start from the pose at D, then fly out and flatten into a tilted cup.
        if (c.wall) this.wallPose(c, D, p); else this.groundPose(c, D, i, p);
        const e = (1 - Math.exp(-aw * 2.5)) / 2.5;
        const rD = Math.hypot(p.x, p.z);
        const r = rD + c.v * e;
        const a = p.a + c.w * 0.8 * (1 - Math.exp(-aw * 1.5)) / 1.5;
        if (c.wall) {
          p.y += (c.hEnd - p.y) * (1 - Math.exp(-aw * 3));
          p.size = c.size * (p.size / c.size + (1 - p.size / c.size) * smoothstep(aw / 0.2)) * (1 + 0.25 * easeOut(aw * 2));
          p.flat = 0.55 * smoothstep(aw / 0.35);
        } else {
          p.size = c.size * (1 + 0.2 * easeOut(aw * 2));
          p.flat = 1;
        }
        p.x = Math.cos(a) * r;
        p.z = Math.sin(a) * r;
        p.a = a;
        tilt = c.wall ? -0.3 * (1 - p.flat) : 0;
      }
      const sa = Math.sin(p.a), ca = Math.cos(p.a);
      X.set(sa, 0, -ca);
      I.set(-ca, 0, -sa);
      Y.set(0, 1 - p.flat, 0).addScaledVector(I, p.flat).normalize();
      Z.crossVectors(X, Y);
      if (tilt !== 0) {
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        X2.copy(X).multiplyScalar(ct).addScaledVector(Y, st);
        Y2.copy(Y).multiplyScalar(ct).addScaledVector(X, -st);
        X.copy(X2);
        Y.copy(Y2);
        Z.crossVectors(X, Y);
      }
      const s = Math.max(1e-4, p.size);
      m.makeBasis(X.multiplyScalar(s), Y.multiplyScalar(s), Z.multiplyScalar(s));
      m.setPosition(f.x + p.x, p.y, f.z + p.z);
      this.curls.setMatrixAt(i, m);
      this.curlFade.setX(i, aw > 0 ? smoothstep((aw - 0.45 - c.fd) / 1.1) : 0);
    }
    this.curls.instanceMatrix.needsUpdate = true;
    this.curlFade.needsUpdate = true;
  }

  private updateDebris(t: number, aw: number, dt: number, fade: number) {
    const f = this.from;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    for (let i = 0; i < N_DEBRIS; i++) {
      const d = this.debData[i];
      let s = 1e-4;
      if (aw <= 0) {
        if (t > 0.75) {
          const fs = this.funnelAt(t);
          const hn = fract(d.h0 + (t - GATHER) * 0.18);
          const a = d.a0 + d.w * t + TWIST * hn;
          const r = radiusAt(hn) * d.rr * fs.rad;
          d.p.set(f.x + Math.cos(a) * r, hn * H * fs.hs, f.z + Math.sin(a) * r);
          s = d.size * smoothstep((t - 0.75) / 0.2) * smoothstep(hn / 0.1) * (1 - smoothstep((hn - 0.85) / 0.15));
        }
      } else if (d.live) {
        if (dt > 0 && d.p.y > -10) {
          d.v.y -= 18 * dt;
          d.p.addScaledVector(d.v, dt);
          if (d.p.y < 0.08) { d.p.y = 0.08; d.v.multiplyScalar(0); }
        }
        s = d.size * (1 - smoothstep((aw - 1.2) / 0.5)) * fade;
      }
      e.set(d.spin.x * t, d.spin.y * t, d.spin.z * t);
      m.compose(d.p, q.setFromEuler(e), sc.setScalar(Math.max(1e-4, s)));
      this.debris.setMatrixAt(i, m);
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }

  private moveTargets(ctx: CastContext, t: number) {
    const f = this.from;
    const aw = t - D;
    if (aw > 0.8) {
      if (!this.tgtDone) {
        this.tgtDone = true;
        const zero = new THREE.Vector3();
        for (const e of ctx.targets) ctx.displace(e, zero);
      }
      return;
    }
    const pull = smoothstep((t - 0.65) / 0.5);
    const lift = 1.5 * smoothstep((t - 0.8) / 0.5);
    const k = aw > 0 ? Math.exp(-aw * 9) : 1;
    const tT = Math.min(t, D);
    ctx.targets.forEach((e, i) => {
      const tp = ctx.targetPos[i];
      const rx = tp.x - f.x, rz = tp.z - f.z;
      const r0 = Math.hypot(rx, rz);
      const ang0 = r0 > 0.05 ? Math.atan2(rz, rx) : i * 2.4;
      const rT = 1.6 + 0.35 * (i % 3);
      const rr = r0 + (Math.min(r0, rT) - r0) * pull;
      const ang = ang0 + 2.6 * pull * Math.max(0, tT - 0.65);
      const off = this.lastOff[i] ?? (this.lastOff[i] = new THREE.Vector3());
      off.set(
        (f.x + Math.cos(ang) * rr - tp.x) * k,
        (lift + 0.2 * pull * Math.sin(tT * 4 + i)) * k,
        (f.z + Math.sin(ang) * rr - tp.z) * k,
      );
      ctx.displace(e, off);
    });
  }

  private onTick(_i: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const from = ctx.from.clone().setY(0);
    ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.tickDamage, knock: 0, from, color: '#bfeedd' }));
  }

  private onBurst() {
    this.burst = true;
    const f = this.from;
    this.motes.burst(70, new THREE.Vector3(f.x, 1.3, f.z));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.dust.burst(14, new THREE.Vector3(f.x + Math.cos(a) * 2.2, 0.1, f.z + Math.sin(a) * 2.2));
    }
    for (const d of this.debData) {
      const dx = d.p.x - f.x, dz = d.p.z - f.z;
      const len = Math.hypot(dx, dz) || 1;
      const sp = 6 + Math.random() * 6;
      d.v.set((dx / len) * sp, 2 + Math.random() * 5, (dz / len) * sp);
      d.live = d.p.y > -10;
    }
    const ctx = this.ctx;
    if (ctx) {
      const from = ctx.from.clone().setY(0);
      ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from }));
    }
  }
}

export const cloudStepCycloneModule: EffectModule = {
  label: 'cloud step cyclone',
  category: 'targeted',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new CloudStepCyclone(),
  telegraphs(effect) {
    const e = effect as CloudStepCyclone;
    const c = e.ctx?.from;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: GATHER, impact: D }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CloudStepCyclone;
    if (e.ctx) frameCast(camera, controls, e.ctx, 8);
  },
  buildGui(f, effect) {
    const s = (effect as CloudStepCyclone).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tickDamage', 0, 40, 1).name('tick damage');
    f.add(s, 'knock', 0, 20, 0.5);
  },
};
