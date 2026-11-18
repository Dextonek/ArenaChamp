import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, mergeParts, smoothstep } from '../../effects/common';
import {
  CrescentArc, LightningArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, flashBeat, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Thousand Swords (targeted, ground): a red sun is painted in the sky over the spot by one brush stroke, katanas
 * (black lacquer, gold guard, wrapped hilt, red cord) appear point-down inside it and then rain in waves, each leaving
 * a red-white streak and sticking into the ground in a field of blades. A frozen beat, then every blade flashes white
 * and bursts into red ink at once (impact frames, whiteout), and a red 斷 seal stamps itself on the ground.
 * Look: the Blood row of docs/ART_BIBLE.md with the showpiece's ink, paper and gold (src/showpiece/pieces/scarlet.ts).
 * Recipes: g-castorice-sky-rift-blade-rain, b-elden-ring-founding-rain-of-stars, f-swipe-smoke-crescent-slash.
 */
export interface ThousandSwordsSettings {
  /** Katanas in the rain (the field of blades). */
  count: number;
  /** Damage of each small hit during the rain (every 0.25 s). */
  tickDamage: number;
  /** Damage of the final burst. */
  burstDamage: number;
  loop: boolean;
}

export const defaultThousandSwords = (): ThousandSwordsSettings => ({ count: 120, tickDamage: 4, burstDamage: 42, loop: false });

const RADIUS = 5.5;
const MAX_SWORDS = 120;
const RINGED = 54;
const SUN_R = 4.8;
const SUN_H = 9;
const SUN_TILT = (50 * Math.PI) / 180;
const PAINT_END = 0.6;
const APPEAR_START = 0.8;
const RAIN_START = 1.4;
const RAIN_SPAN = 1.65;
const HIT_START = 1.6;
const HIT_STEP = 0.25;
const HITS = 9;
const BURST = 4.0;
const SEAL_AT = 4.4;
const DURATION = 5.2;
const ARCS = 5;
const SPLAT_MAX = 260;
const SERIF = '"Noto Serif JP","Yu Mincho","Hiragino Mincho ProN","MS PMincho",serif';

const DOWN = new THREE.Vector3(0, -1, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);

/** One katana, tip at the origin and the body running up +Y (about 2.3 long): curved steel blade with a white edge, gold collar and guard, black wrapped hilt, gold pommel, a short red cord. */
function katanaGeometry(): THREE.BufferGeometry {
  const L = 1.6;
  const parts: THREE.BufferGeometry[] = [];

  const pos: number[] = [], col: number[] = [];
  const edge = new THREE.Color('#eef3f7'), face = new THREE.Color('#8e9ba7'), back = new THREE.Color('#6f7b86');
  const ring = (y: number) => {
    const k = y / L;
    const s = Math.min(1, Math.pow(y / 0.2, 0.7));
    const hw = (0.06 - 0.012 * k) * s, th = 0.018 * s;
    const cx = 0.14 * k * k; // the blade bows a little, as a katana does
    return {
      p: [[cx - hw, y, 0], [cx - hw * 0.2, y, th], [cx + hw, y, th * 0.6], [cx + hw, y, -th * 0.6], [cx - hw * 0.2, y, -th]],
      c: [edge, face, back, back, face],
    };
  };
  const put = (p: number[], c: THREE.Color) => { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); };
  const rings = [0.07, 0.2, 0.55, 0.9, 1.25, L].map(ring);
  for (let i = 0; i < 5; i++) {
    const i2 = (i + 1) % 5, r0 = rings[0];
    put([0, 0, 0], edge); put(r0.p[i], r0.c[i]); put(r0.p[i2], r0.c[i2]);
  }
  for (let j = 0; j < rings.length - 1; j++) {
    const a = rings[j], b = rings[j + 1];
    for (let i = 0; i < 5; i++) {
      const i2 = (i + 1) % 5;
      put(a.p[i], a.c[i]); put(a.p[i2], a.c[i2]); put(b.p[i2], b.c[i2]);
      put(a.p[i], a.c[i]); put(b.p[i2], b.c[i2]); put(b.p[i], b.c[i]);
    }
  }
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  blade.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  parts.push(blade);

  const part = (g: THREE.BufferGeometry, hex: string, flatZ = 1, x = 0, y = 0, z = 0) => {
    g.scale(1, 1, flatZ);
    g.translate(x, y, z);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    parts.push(g);
  };
  const GOLD = '#b88a2e', LACQUER = '#16090c';
  part(new THREE.CylinderGeometry(0.055, 0.062, 0.1, 10), GOLD, 0.55, 0, L - 0.03);
  part(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 16), GOLD, 0.82, 0, L + 0.045);
  const h0 = L + 0.065, hl = 0.62;
  part(new THREE.CylinderGeometry(0.058, 0.05, hl, 8), LACQUER, 0.8, 0, h0 + hl / 2);
  for (let i = 0; i < 5; i++) part(new THREE.CylinderGeometry(0.064, 0.064, 0.03, 8), '#b3a47c', 0.8, 0, h0 + 0.08 + i * 0.115);
  part(new THREE.CylinderGeometry(0.066, 0.06, 0.05, 10), GOLD, 0.85, 0, h0 + hl + 0.025);
  part(new THREE.BoxGeometry(0.016, 0.26, 0.016), '#c42229', 1, 0.078, h0 + hl - 0.14, 0.02);
  part(new THREE.BoxGeometry(0.034, 0.07, 0.034), '#d9a43c', 1, 0.08, h0 + hl - 0.3, 0.02);
  return mergeParts(parts);
}

/** A thin tapered streak (two crossed quads), head at y = 0 and tail at y = 1; the sword's frame, so it trails behind a falling blade. */
function streakMesh(count: number) {
  const a = new THREE.PlaneGeometry(1, 1);
  a.translate(0, 0.5, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const geo = mergeParts([a, b]);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        float across = abs(vUv.x * 2.0 - 1.0);
        float v = vUv.y;
        float a = pow(1.0 - v, 1.5) * pow(1.0 - across, 1.3) * 0.5;
        vec3 col = mix(vec3(1.0, 0.93, 0.88), vec3(1.0, 0.23, 0.31), smoothstep(0.0, 0.7, v));
        gl_FragColor = vec4(col, a);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  return mesh;
}

/** The sun's painted disc: deep red with a lighter middle and a fine screen of dots (the showpiece's sunFlat). */
function sunTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(100, 100, 12, 128, 128, 128);
  gr.addColorStop(0, '#d8402f');
  gr.addColorStop(0.62, '#a3161c');
  gr.addColorStop(1, '#4a0a0c');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(128, 128, 128, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,150,120,0.2)';
  for (let y = 6; y < 256; y += 10) {
    for (let x = ((y / 10) % 2 ? 6 : 11); x < 256; x += 10) {
      if (Math.hypot(x - 128, y - 128) < 124) { g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A red dashed circle (the telegraph, drawn in ink red) lying flat on the ground. */
function dashedTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#ff3b4e';
  g.lineWidth = 8;
  g.lineCap = 'round';
  g.setLineDash([26, 18]);
  g.beginPath();
  g.arc(256, 256, 244, 0, Math.PI * 2);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The red seal with 斷 carved out in cream, drawn like the showpiece's seal (rough square, worn spots, ink splashes round it). */
function sealTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  let seed = 91;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const size = 168, h = size / 2, cx = 128, cy = 128;
  g.translate(cx, cy);
  g.rotate(-0.04);
  g.beginPath();
  const edge = (ax: number, ay: number, bx: number, by: number) => {
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, j = (r() - 0.5) * 7;
      g.lineTo(ax + (bx - ax) * u + (ay === by ? 0 : j), ay + (by - ay) * u + (ay === by ? j : 0));
    }
  };
  g.moveTo(-h, -h);
  edge(-h, -h, h, -h); edge(h, -h, h, h); edge(h, h, -h, h); edge(-h, h, -h, -h);
  g.closePath();
  g.fillStyle = '#c51f26';
  g.fill();
  g.fillStyle = '#f6efe6';
  g.font = `900 ${Math.round(size * 0.86)}px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('斷', 0, size * 0.04);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = r() < 0.6 ? 'rgba(197,31,38,0.9)' : 'rgba(246,239,230,0.75)';
    g.beginPath();
    g.arc((r() - 0.5) * size, (r() - 0.5) * size, 1 + r() * 2.4, 0, Math.PI * 2);
    g.fill();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = size * (0.62 + r() * 0.1) + 8;
    g.fillStyle = `rgba(197,31,38,${0.6 + r() * 0.4})`;
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2 + r() * (i < 3 ? 5 : 3), 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A spiky ink splat: dark rim, hot red middle, droplets. Raw sRGB values (no colour conversion in its shader). */
function splatTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  let seed = 7;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const blob = (rad: number, spikes: number, fill: string) => {
    g.beginPath();
    const n = spikes * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, k = i % 2 ? 0.55 + r() * 0.2 : 0.8 + r() * 0.4;
      const x = 64 + Math.cos(a) * rad * k, y = 64 + Math.sin(a) * rad * k;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  blob(46, 11, '#7a0e1c');
  blob(35, 9, '#c8202e');
  blob(20, 7, '#ff3b4e');
  g.fillStyle = '#c8202e';
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = 48 + r() * 12;
    g.beginPath();
    g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1.5 + r() * 2.6, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

/** Flat ink splats on the ground (instanced, one alpha and one brightness per instance). */
class Splats {
  readonly mesh: THREE.InstancedMesh;
  private tintAttr: THREE.InstancedBufferAttribute;
  private alphaAttr: THREE.InstancedBufferAttribute;
  private items: { x: number; z: number; size: number; rot: number; born: number; tint: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(private max: number) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.tintAttr = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    geo.setAttribute('aTint', this.tintAttr);
    geo.setAttribute('aAlpha', this.alphaAttr);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uMap: { value: splatTexture() } },
      vertexShader: /* glsl */ `
        attribute vec3 aTint; attribute float aAlpha; varying vec2 vUv; varying vec3 vTint; varying float vA;
        void main() { vUv = uv; vTint = aTint; vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec2 vUv; varying vec3 vTint; varying float vA;
        void main() { vec4 s = texture2D(uMap, vUv); gl_FragColor = vec4(s.rgb * vTint, s.a * vA); }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  clear() {
    this.items = [];
    this.mesh.count = 0;
  }

  /** `tint` 1 = the splat's own red, about 0.2 = near-black ink. */
  add(x: number, z: number, size: number, born: number, tint = 1) {
    if (this.items.length >= this.max) return;
    this.items.push({ x, z, size, rot: Math.random() * Math.PI * 2, born, tint });
  }

  update(t: number, fadeStart: number, fadeLen: number) {
    const k = this.items.length;
    this.mesh.count = k;
    const fade = 1 - smoothstep((t - fadeStart) / fadeLen);
    for (let i = 0; i < k; i++) {
      const it = this.items[i];
      const pop = smoothstep((t - it.born) / 0.1);
      const a = pop * fade * 0.92;
      this.e.set(-Math.PI / 2, 0, it.rot);
      this.q.setFromEuler(this.e);
      this.p.set(it.x, 0.035, it.z);
      this.s.setScalar(Math.max(1e-4, it.size * (0.6 + 0.4 * pop)));
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      const tn = it.tint * (0.85 + 0.3 * ((i * 7919) % 13) / 13);
      this.tintAttr.setXYZ(i, tn, tn, tn);
      this.alphaAttr.setX(i, a);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.tintAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }
}

interface Sword {
  hang: THREE.Vector3;
  land: THREE.Vector3;
  landDir: THREE.Vector3;
  wobble: THREE.Vector3;
  roll: number;
  scale: number;
  phase: number;
  ts: number;
  tf: number;
  tl: number;
  landed: boolean;
}

export class ThousandSwords implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ThousandSwordsSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private burstDone = false;
  private sealDone = false;
  private nextHit = 0;
  private sw: Sword[] = [];

  // Cast geometry.
  private pt = new THREE.Vector3();
  private sunC = new THREE.Vector3();
  private sunQ = new THREE.Quaternion();
  private hitFrom = new THREE.Vector3();
  private aim = Math.PI;

  private telegraph: THREE.Mesh;
  private sunGroup = new THREE.Group();
  private sunRing: CrescentArc;
  private sunDisc: THREE.Mesh;
  private sunLine = createRing(0xd9a43c, 0.975, 1, 96);
  private inkGroup = new THREE.Group();
  private inkArcs: CrescentArc[] = [];
  private swordMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.42, metalness: 0.4, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0,
  });
  private blades = new THREE.InstancedMesh(katanaGeometry(), this.swordMat, MAX_SWORDS);
  private streaks = streakMesh(MAX_SWORDS);
  private arcs: LightningArc[] = [];
  private arcPick: { a: number; b: number; until: number }[] = [];
  private splats = new Splats(SPLAT_MAX);
  private splash = new SmokeBall({ color: 0x120508, rim: 0x8c0f22, flake: '#2a0610', maxBalls: 18 });
  private inkBurst = new SmokeBall({ color: 0x0e0407, rim: 0x8c0f22, flake: '#2a0610', maxBalls: 10 });
  private shock = createRing(0xff3b4e, 0.9, 1, 96);
  private shock2 = createRing(0xd9a43c, 0.94, 1, 96);
  private star = new StarBurst({ points: 12, color: 0xff3b4e, core: 0xfff1e6, additive: false });
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffe7a0, core: 0xffffff });
  private sealGroup = new THREE.Group();
  private sealMat: THREE.MeshBasicMaterial;
  private seal: THREE.Mesh;

  private sparks: Emitter;
  private petals: Emitter;
  private flakes: Emitter;

  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private qRoll = new THREE.Quaternion();
  private qWob = new THREE.Quaternion();
  private eul = new THREE.Euler();
  private pos = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private path = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private a3 = new THREE.Vector3();
  private b3 = new THREE.Vector3();

  constructor(settings: ThousandSwordsSettings = defaultThousandSwords()) {
    this.settings = settings;
    this.screen.tint.set(0x8a3a38);
    this.screen.impactColor.set(0xff3b4e);
    this.screen.speedLineColor.set(0xffe0d4);
    this.screen.whiteColor.set(0xffe8e0);
    this.screen.edgeTint.set(0xff3b4e);
    this.screen.keepHue.set(0xff2a3a);

    // The ground telegraph in ink red.
    this.telegraph = new THREE.Mesh(
      new THREE.PlaneGeometry((RADIUS + 0.1) * 2, (RADIUS + 0.1) * 2),
      new THREE.MeshBasicMaterial({ map: dashedTexture(), transparent: true, opacity: 0, depthWrite: false }),
    );
    this.telegraph.rotation.x = -Math.PI / 2;
    this.telegraph.position.y = 0.05;

    // The sun: a thick toon ring painted by one stroke (tail thin, head fat), a deep red disc and a thin gold line.
    this.sunRing = new CrescentArc({ radius: SUN_R, width: 1.0, style: 'toon', sweep: Math.PI * 2, edge: 0xff3b4e, mid: 0xc8202e, outer: 0x3a0d0a });
    this.sunRing.mesh.rotation.z = Math.PI / 2;
    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(SUN_R - 0.35, 64),
      new THREE.MeshBasicMaterial({ map: sunTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.sunDisc.position.z = -0.02;
    this.sunLine.mesh.rotation.set(0, 0, 0);
    this.sunLine.mesh.scale.setScalar(SUN_R + 0.45);
    this.sunLine.mesh.position.z = 0.02;
    this.sunGroup.add(this.sunDisc, this.sunRing.mesh, this.sunLine.mesh);

    // Black ink arcs wheeling round the spot on the ground.
    this.inkGroup.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const arc = new CrescentArc({
        radius: 3.0 + 1.15 * i, width: 0.5, style: 'toon', sweep: Math.PI * 1.5, edge: 0xb3182b, mid: 0x151012, outer: 0x070304,
      });
      arc.mesh.rotation.z = (i * Math.PI * 2) / 3;
      this.inkGroup.add(arc.mesh);
      this.inkArcs.push(arc);
    }

    this.blades.frustumCulled = false;
    for (let i = 0; i < ARCS; i++) {
      const arc = new LightningArc({ width: 0.13, segments: 9, jitter: 0.09, branches: 1, core: 0xfff1d0, glow: 0xd9a43c });
      this.arcs.push(arc);
      this.arcPick.push({ a: -1, b: -1, until: 0 });
      this.group.add(arc.mesh);
    }

    // The seal on the ground; the group turns it to read from the caster's side.
    this.sealMat = new THREE.MeshBasicMaterial({ map: sealTexture(), transparent: true, opacity: 0, depthWrite: false });
    this.seal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.sealMat);
    this.seal.rotation.x = -Math.PI / 2;
    this.seal.position.y = 0.05;
    this.sealGroup.add(this.seal);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.5, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.1, speed: 5, speedJitter: 0.6, spread: 80, gravity: 12, drag: 1.2,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#fff1d0', colorEnd: '#d9a43c', colorMid: '#ffd27a',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    // Red ink petals and flakes: normal-blended so they read red, not pink-white.
    this.petals = new Emitter({
      ...defaultSettings(), maxParticles: 3200, rate: 0, lifetime: 2.0, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 6, speedJitter: 0.7, spread: 180, gravity: 1.4, drag: 1.8,
      sizeStart: 0.34, sizeEnd: 0.12, colorStart: '#ff3b4e', colorMid: '#c8202e', colorEnd: '#5a0a14',
      opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.35, spin: 0.8,
    });
    this.flakes = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 2.4, speedJitter: 0.6, spread: 160, gravity: 0.7, drag: 0.9,
      sizeStart: 0.24, sizeEnd: 0.1, colorStart: '#2a0a10', colorMid: '#14050a', colorEnd: '#0a0305',
      opacityStart: 0.85, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.4, spin: 0.6, groundFade: 0.2,
    });
    this.splash.hold = 0.12;
    this.inkBurst.hold = 0.45;
    this.emitters.push(this.sparks, this.petals, this.flakes, this.splash.emitter, this.inkBurst.emitter);

    this.group.add(this.telegraph, this.inkGroup, this.splats.mesh, this.sealGroup, this.sunGroup, this.blades, this.streaks);
    this.group.add(this.splash.mesh, this.inkBurst.mesh, this.shock.mesh, this.shock2.mesh, this.star.mesh, this.glint.mesh);
    for (const e of this.emitters) this.group.add(e.points);
    this.setup(new THREE.Vector3(), Math.PI);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get burstTime() {
    return BURST;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.setup(ctx.point, ctx.aim);
  }

  /** New field of blades (also called when the count changes). */
  reroll() {
    this.setup(this.pt, this.aim);
  }

  /** Sun frame, then every sword's place in the sun, its landing spot, tilt and times. */
  private setup(point: THREE.Vector3, aim: number) {
    this.aim = aim;
    this.pt.copy(point).setY(0);
    this.screen.focus.copy(this.pt).setY(1);
    const fwd = new THREE.Vector3(Math.sin(aim), 0, Math.cos(aim));
    this.hitFrom.copy(this.pt).addScaledVector(fwd, -1);
    // The sun's face turns toward the caster (and a little toward the tool camera at +X), tilted 50 degrees from flat.
    const hn = fwd.clone().negate().add(new THREE.Vector3(0.6, 0, 0)).normalize();
    const n = hn.clone().multiplyScalar(Math.sin(SUN_TILT)).setY(Math.cos(SUN_TILT));
    const u = hn.clone().multiplyScalar(-Math.cos(SUN_TILT)).setY(Math.sin(SUN_TILT));
    const right = new THREE.Vector3().crossVectors(u, n).normalize();
    this.sunQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, u, n));
    // The sun sits off to the side so the blades rake down diagonally.
    this.sunC.copy(this.pt).addScaledVector(hn, 2.4).addScaledVector(right, 2.0).setY(SUN_H);
    this.sunGroup.position.copy(this.sunC);
    this.sunGroup.quaternion.copy(this.sunQ);
    this.inkGroup.position.set(this.pt.x, 0.07, this.pt.z);
    this.telegraph.position.set(this.pt.x, 0.05, this.pt.z);
    this.sealGroup.position.set(this.pt.x, 0, this.pt.z);
    this.sealGroup.rotation.y = aim - Math.PI;

    // Places in the sun's plane: 12 + 18 + 24 in three rings, then random ones with room between them.
    const n3 = Math.min(MAX_SWORDS, Math.max(10, Math.round(this.settings.count)));
    const plane: { x: number; y: number }[] = [];
    for (const [cnt, rad] of [[12, 1.4], [18, 2.8], [24, 4.2]] as const) {
      const off = Math.random() * Math.PI * 2;
      for (let i = 0; i < cnt && plane.length < n3; i++) {
        const a = off + (i / cnt) * Math.PI * 2;
        plane.push({ x: Math.cos(a) * rad + rnd(-0.12, 0.12), y: Math.sin(a) * rad + rnd(-0.12, 0.12) });
      }
    }
    while (plane.length < n3) {
      let best = { x: 0, y: 0 };
      for (let tries = 0; tries < 40; tries++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 4.6;
        best = { x: Math.cos(a) * r, y: Math.sin(a) * r };
        if (plane.every((p) => Math.hypot(p.x - best.x, p.y - best.y) > 0.5)) break;
      }
      plane.push(best);
    }
    // Fall order: the ringed ones first (shuffled), then the rest.
    const order = plane.map((_, i) => i);
    const shuffle = (a: number[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } };
    const head = order.slice(0, Math.min(RINGED, n3)), tail = order.slice(Math.min(RINGED, n3));
    shuffle(head); shuffle(tail);
    const rank: number[] = [];
    [...head, ...tail].forEach((idx, r) => { rank[idx] = r; });

    this.sw = plane.map((p, i) => {
      const hang = this.sunC.clone().addScaledVector(right, p.x).addScaledVector(u, p.y);
      const land = this.pt.clone().addScaledVector(right, p.x * 1.12).addScaledVector(hn, -p.y * 1.12);
      land.x += rnd(-0.25, 0.25);
      land.z += rnd(-0.25, 0.25);
      const off = new THREE.Vector2(land.x - this.pt.x, land.z - this.pt.z);
      if (off.length() > RADIUS - 0.3) off.setLength(RADIUS - 0.3);
      land.set(this.pt.x + off.x, -0.28, this.pt.z + off.y);
      const th = THREE.MathUtils.degToRad(rnd(8, 25)), ph = Math.random() * Math.PI * 2;
      const uu = rank[i] / Math.max(1, n3 - 1);
      const s = 0.5 * uu + 0.5 * smoothstep(uu);
      const tf = Math.max(RAIN_START, RAIN_START + RAIN_SPAN * s + rnd(-0.03, 0.03));
      const tl = tf + rnd(0.4, 0.52);
      const ringed = i < RINGED;
      const ts = ringed ? Math.min(tf - 0.1, APPEAR_START + 0.6 * (i / RINGED) + rnd(0, 0.04)) : tf - 0.28;
      return {
        hang, land,
        landDir: new THREE.Vector3(Math.sin(th) * Math.cos(ph), -Math.cos(th), Math.sin(th) * Math.sin(ph)),
        wobble: new THREE.Vector3(Math.cos(ph + 1.6), 0, Math.sin(ph + 1.6)),
        roll: Math.random() * Math.PI * 2, scale: rnd(0.9, 1.15), phase: Math.random() * 100, ts, tf, tl, landed: false,
      };
    });
    this.blades.count = this.sw.length;
    this.streaks.count = this.sw.length;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.burstDone = false;
    this.sealDone = false;
    this.nextHit = 0;
    this.shake = 0;
    for (const s of this.sw) s.landed = false;
    for (const p of this.arcPick) { p.a = -1; p.b = -1; p.until = 0; }
    clearScreenFx(this.screen);
    this.splats.clear();
    this.splash.clear();
    this.inkBurst.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.sparks.update(dt);
    this.petals.update(dt);
    this.flakes.update(dt);
    this.splash.update(dt);
    this.inkBurst.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    const t = this.time;
    this.landings(t);
    while (this.nextHit < HITS && t >= HIT_START + HIT_STEP * this.nextHit) {
      this.nextHit++;
      this.hitAll(this.settings.tickDamage, 1.4);
    }
    if (!this.burstDone && t >= BURST) this.onBurst();
    if (!this.sealDone && t >= SEAL_AT) this.onSeal();
    if (t > BURST + 0.1 && t < BURST + 0.9) {
      // Ink flakes drift down over the field.
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * RADIUS;
        this.flakes.burst(1, this.a3.set(this.pt.x + Math.cos(a) * r, rnd(3, 5), this.pt.z + Math.sin(a) * r));
      }
    }
    for (const a of this.arcs) a.update(dt);
    this.layout(dt);
  }

  /** Each blade that reaches the ground splashes ink (a red splat, a black puff) and strikes a gold spark. */
  private landings(t: number) {
    this.sw.forEach((s, i) => {
      if (s.landed || t < s.tl) return;
      s.landed = true;
      this.splats.add(s.land.x, s.land.z, rnd(0.8, 1.3), s.tl, 1);
      this.sparks.burst(5, this.a3.copy(s.land).setY(0.2));
      if (i % 2 === 0) this.splash.trigger(this.a3.copy(s.land).setY(0.1), rnd(0.36, 0.5), 0.5);
    });
  }

  private hitAll(damage: number, knock: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i] ?? e.group.position;
      // A target standing on the centre is pushed forward instead of nowhere.
      const from = Math.hypot(p.x - this.pt.x, p.z - this.pt.z) < 0.4 ? this.hitFrom : this.pt;
      ctx.hit(e, { damage, knock, from });
    });
  }

  /** All the stuck blades flash and burst into red ink at once. */
  private onBurst() {
    this.burstDone = true;
    for (const s of this.sw) {
      this.dir.copy(s.landDir).negate();
      for (const k of [0.35, 1.0, 1.7]) {
        this.a3.copy(s.land).addScaledVector(this.dir, k * s.scale);
        this.petals.burst(4, this.a3);
      }
      this.sparks.burst(3, this.a3.copy(s.land).addScaledVector(this.dir, 1.0 * s.scale));
    }
    this.petals.burst(160, this.a3.copy(this.pt).setY(0.6));
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * RADIUS * 0.8;
      this.inkBurst.trigger(this.a3.set(this.pt.x + Math.cos(a) * r, 0.3, this.pt.z + Math.sin(a) * r), rnd(1.0, 1.6), 1.4);
    }
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * RADIUS;
      this.flakes.burst(10, this.a3.set(this.pt.x + Math.cos(a) * r, rnd(0.5, 2.5), this.pt.z + Math.sin(a) * r));
    }
    // Big splats where the blades stood: red, and a few of near-black ink.
    this.sw.forEach((s, i) => {
      if (i % 3 === 0) this.splats.add(s.land.x, s.land.z, rnd(1.4, 2.4), BURST + 0.05, i % 6 === 0 ? 0.22 : 1);
    });
    this.hitAll(this.settings.burstDamage, 9);
  }

  /** The seal lands: a thud and a ring of splashes. */
  private onSeal() {
    this.sealDone = true;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rnd(-0.2, 0.2), d = rnd(1.9, 2.8);
      this.splats.add(this.pt.x + Math.cos(a) * d, this.pt.z + Math.sin(a) * d, rnd(0.5, 1.0), SEAL_AT, i % 4 === 0 ? 0.22 : 1);
    }
  }

  private hide(i: number) {
    this.pos.set(0, -60, 0);
    this.sc.setScalar(1e-4);
    this.q.identity();
    this.m.compose(this.pos, this.q, this.sc);
    this.blades.setMatrixAt(i, this.m);
    this.streaks.setMatrixAt(i, this.m);
  }

  private layout(_dt: number) {
    const t = this.time;
    const after = t - BURST;
    const live = this.playing;
    const fadeOut = 1 - smoothstep((t - (DURATION - 0.5)) / 0.5);

    // --- Screen: dark red world with only the reds left, focus lines in the heavy wave, impact frames at the burst. ---
    if (live) {
      const grade = smoothstep(t / 0.5) * (1 - smoothstep((t - BURST - 0.15) / 0.8));
      this.screen.darken = 0.45 * grade;
      this.screen.desaturate = 0.7 * grade;
      this.screen.speedLines = 0.55 * smoothstep((t - 2.2) / 0.3) * (1 - smoothstep((t - 3.0) / 0.3));
      this.screen.impact = impactFrameAt(t, BURST, [1, 3, 2]);
      Object.assign(this.screen, flashBeat(t, BURST + 0.15, 0.05, 0.28));
      this.screen.chroma = chromaPulse(t, BURST);
    }

    // --- The telegraph and the ink arcs wheeling on the ground. ---
    const ground = smoothstep(t / 0.4) * (1 - smoothstep((t - 3.7) / 0.35));
    (this.telegraph.material as THREE.MeshBasicMaterial).opacity = 0.75 * ground;
    this.telegraph.rotation.z = t * 0.25;
    this.inkArcs.forEach((arc, i) => {
      arc.head = (((t * (0.5 + 0.08 * i) + i * 0.37) % 1) * 1.5);
      arc.length = 0.5;
      arc.time = t;
      arc.opacity = 0.9 * ground;
    });

    // --- The sun: ring painted by one stroke, then the disc fills; in the hold it dims to a thin line; gone at the burst. ---
    const paint = THREE.MathUtils.clamp(t / PAINT_END, 0, 1);
    const eased = paint * paint * (3 - 2 * paint);
    const hold = smoothstep((t - 3.3) / 0.4);
    const gone = 1 - smoothstep((t - BURST) / 0.25);
    this.sunRing.head = eased;
    this.sunRing.length = 1;
    this.sunRing.opacity = (0.95 - 0.55 * hold) * gone * (t > 0 ? 1 : 0);
    const disc = this.sunDisc.material as THREE.MeshBasicMaterial;
    disc.opacity = 0.85 * smoothstep((t - 0.55) / 0.35) * (1 - smoothstep((t - 3.2) / 0.5)) * gone;
    this.sunDisc.visible = disc.opacity > 0.01;
    this.sunLine.material.opacity = (0.5 * smoothstep((t - 0.8) / 0.4) + 0.3 * hold) * gone;
    this.sunGroup.scale.setScalar(1 + 0.012 * Math.sin(t * 6));

    // --- The blades: hang point-down in the sun, fall with a streak, stick into the ground, hold, flash, burst. ---
    const flash = after < 0 ? smoothstep((t - 3.75) / 0.25) * 0.9 : after < 0.07 ? 3 : 0;
    this.swordMat.emissiveIntensity = flash;
    this.blades.visible = true;
    this.streaks.visible = true;
    const n = this.sw.length;
    for (let i = 0; i < n; i++) {
      const s = this.sw[i];
      if (t < s.ts || after > 0.07) { this.hide(i); continue; }
      const sc = s.scale * (0.2 + 0.8 * smoothstep((t - s.ts) / 0.25));
      let streak = 0;
      let amp = 0.04;
      if (t < s.tf) {
        this.pos.copy(s.hang);
        this.dir.set(0, -1, 0);
      } else if (t < s.tl) {
        const u = (t - s.tf) / (s.tl - s.tf);
        this.pos.lerpVectors(s.hang, s.land, u * u);
        this.path.subVectors(s.land, s.hang).normalize();
        this.dir.copy(DOWN).lerp(this.path, smoothstep(u / 0.2)).lerp(s.landDir, smoothstep((u - 0.7) / 0.3)).normalize();
        streak = (0.5 + 3.2 * smoothstep(u / 0.5)) * (1 - smoothstep((u - 0.85) / 0.15));
        amp = 0;
      } else {
        this.pos.copy(s.land);
        this.dir.copy(s.landDir);
        amp = t > 3.8 ? 0.012 * smoothstep((t - 3.8) / 0.2) : 0;
      }
      this.q.setFromUnitVectors(DOWN, this.dir);
      this.qRoll.setFromAxisAngle(AXIS_Y, s.roll);
      this.q.multiply(this.qRoll);
      if (t >= s.tl) {
        // A short damped wobble as the blade bites.
        const a = t - s.tl;
        this.qWob.setFromAxisAngle(s.wobble, 0.18 * Math.exp(-6 * a) * Math.sin(38 * a));
        this.q.premultiply(this.qWob);
      }
      if (amp > 0) {
        this.eul.set(Math.sin(t * 52 + s.phase) * amp, 0, Math.cos(t * 47 + s.phase) * amp);
        this.qWob.setFromEuler(this.eul);
        this.q.premultiply(this.qWob);
      }
      this.sc.setScalar(Math.max(1e-4, sc));
      this.m.compose(this.pos, this.q, this.sc);
      this.blades.setMatrixAt(i, this.m);
      // The streak trails from the hilt end, up the line the blade came down.
      this.q.setFromUnitVectors(DOWN, this.dir);
      this.a3.copy(this.dir).multiplyScalar(-1.2 * sc).add(this.pos);
      this.b3.set(0.3, Math.max(1e-4, streak), 0.3);
      this.m.compose(this.a3, this.q, this.b3);
      this.streaks.setMatrixAt(i, this.m);
    }
    this.blades.instanceMatrix.needsUpdate = true;
    this.streaks.instanceMatrix.needsUpdate = true;

    // --- Gold arcs jump between hanging blades while they wait in the sun. ---
    this.arcs.forEach((arc, i) => {
      const pick = this.arcPick[i];
      const active = t > 0.95 && t < 3.3;
      if (active && t >= pick.until) {
        const hanging: number[] = [];
        for (let k = 0; k < n; k++) if (t > this.sw[k].ts + 0.2 && t < this.sw[k].tf - 0.05) hanging.push(k);
        if (hanging.length > 1) {
          pick.a = hanging[Math.floor(Math.random() * hanging.length)];
          pick.b = hanging[Math.floor(Math.random() * hanging.length)];
          pick.until = t + rnd(0.18, 0.35);
        } else {
          pick.a = -1;
        }
      }
      const a = this.sw[pick.a], b = this.sw[pick.b];
      const ok = active && a && b && pick.a !== pick.b && t < a.tf && t < b.tf && t > a.ts && t > b.ts;
      if (ok) {
        arc.setEnds(this.a3.copy(a.hang).setY(a.hang.y + 1.1), this.b3.copy(b.hang).setY(b.hang.y + 1.1));
        arc.opacity = 0.55 * smoothstep((t - 0.95) / 0.3);
      } else {
        arc.opacity = 0;
      }
    });

    // --- Ink on the ground fades through the aftermath. ---
    this.splats.update(t, BURST + 0.15, 1.0);

    // --- The burst: a toon star, two staggered shockwaves, and the seal. ---
    const sp = StarBurst.pop(t - (BURST + 0.15), 0.1, 0.22);
    this.star.set(this.a3.set(this.pt.x, 1.6, this.pt.z), 7 * sp.scale, sp.opacity * 0.95, 0.2);
    const gp = StarBurst.pop(t - (BURST + 0.2), 0.05, 0.25);
    this.glint.set(this.b3.set(this.pt.x, 3.4, this.pt.z), 1.4 * gp.scale, gp.opacity, t * 2);
    const a1 = after - 0.12;
    this.shock.mesh.position.set(this.pt.x, 0.06, this.pt.z);
    this.shock.mesh.scale.setScalar(0.5 + Math.max(0, a1) * 18);
    this.shock.material.opacity = a1 > 0 ? Math.max(0, 0.8 * (1 - a1 / 0.65)) : 0;
    const a2 = after - 0.22;
    this.shock2.mesh.position.set(this.pt.x, 0.07, this.pt.z);
    this.shock2.mesh.scale.setScalar(0.5 + Math.max(0, a2) * 14);
    this.shock2.material.opacity = a2 > 0 ? Math.max(0, 0.6 * (1 - a2 / 0.8)) : 0;

    const st = t - SEAL_AT;
    const stamp = 1.6 - 0.6 * smoothstep(st / 0.12);
    this.seal.scale.setScalar(3.4 * stamp);
    this.sealMat.opacity = st < 0 ? 0 : clamp01(st / 0.08) * (1 - smoothstep((t - 4.85) / 0.35));
    this.seal.visible = this.sealMat.opacity > 0.01;

    // --- Shake: a low rumble in the rain, a heavy hit at the burst, a thud at the stamp. ---
    let shake = t > 1.6 && t < 3.6 ? 0.05 : 0;
    if (after > 0.12) shake = Math.max(shake, 0.7 * Math.exp(-(after - 0.12) * 6));
    if (st > 0) shake = Math.max(shake, 0.25 * Math.exp(-st * 10));
    this.shake = live ? shake * fadeOut : 0;
  }
}

export const thousandSwordsModule: EffectModule = {
  label: 'thousand swords',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new ThousandSwords(),
  telegraphs(effect) {
    const e = effect as ThousandSwords;
    const c = e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: RADIUS }, start: 0.05, impact: e.burstTime }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as ThousandSwords;
    if (e.ctx) frameCast(camera, controls, e.ctx, 11);
  },
  buildGui(f, effect) {
    const t = effect as ThousandSwords;
    const s = t.settings;
    f.add(s, 'loop');
    f.add(s, 'count', 30, MAX_SWORDS, 1).name('swords').onChange(() => t.reroll());
    f.add(s, 'tickDamage', 1, 30, 1).name('rain damage');
    f.add(s, 'burstDamage', 1, 150, 1).name('burst damage');
  },
};
