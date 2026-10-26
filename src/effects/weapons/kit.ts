import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Emitter } from '../../emitter';
import type { WeaponId } from './sockets';

/**
 * Weapon aura kit (technique from the user's Spiderlily reference, see docs/WEAPON_VFX_GUIDE.md):
 * a darkened weapon model with a fresnel rim, flowing flame ribbons (scrolling, eroding, looping), star flares
 * with an anamorphic streak, spider-lily filament bursts, falling petals and spawners along polylines.
 * Everything loops on a period P: drive it with the loop time and keep scroll/sway in whole cycles per P.
 */

export const TAU = Math.PI * 2;
/** 0..1 wave with period P (seconds) and phase (0..1). */
export const wave = (t: number, period: number, phase = 0) => 0.5 + 0.5 * Math.sin(TAU * (t / period + phase));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ------------------------------------------------------------------------------------------- shared GLSL
/** Value noise that tiles every PX cells along x (so scrolling by PX is seamless), plus a 2-octave fbm. */
const TILE_NOISE = /* glsl */ `
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float tnoise(vec2 p, float px) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, px), x1 = mod(i.x + 1.0, px);
    return mix(mix(hash2(vec2(x0, i.y)), hash2(vec2(x1, i.y)), u.x),
               mix(hash2(vec2(x0, i.y + 1.0)), hash2(vec2(x1, i.y + 1.0)), u.x), u.y);
  }
  float tfbm(vec2 p, float px) { return 0.65 * tnoise(p, px) + 0.35 * tnoise(p * 2.0 + 7.3, px * 2.0); }
`;

// --------------------------------------------------------------------------------------- weapon model
const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Group>>();
function loadWeapon(id: WeaponId): Promise<THREE.Group> {
  let p = cache.get(id);
  if (!p) {
    p = loader.loadAsync(`${import.meta.env.BASE_URL}models/weapons/${id}.glb`).then((g) => g.scene);
    cache.set(id, p);
  }
  return p;
}

export interface WeaponModelOptions {
  /** Base colour multiplier, in linear space (0.1 already reads dark: the reference darkens its weapons so the glow pops). Default 0.45. */
  darken?: number;
  /** Colour the darkened base is pulled toward (e.g. a dark plum). Default #2a1030. */
  tint?: THREE.ColorRepresentation;
  /** How far toward `tint` (0..1). Default 0.3. */
  tintAmount?: number;
  /** Clamp for the model's own emission strength (Blender exports up to 6; bloom wants ≤ 1). Default 1. */
  emissiveMax?: number;
  /** Lowest roughness (smooth flats mirror the room environment as a pale sheet). Default 0.75. */
  roughnessMin?: number;
  /** Fresnel rim colour. */
  rim?: THREE.ColorRepresentation;
  /** Rim falloff exponent (higher = thinner edge). Default 2.5. */
  rimPower?: number;
}

/**
 * The weapon's GLB, loaded once and cloned per effect, darkened, with an additive fresnel rim on every mesh.
 * The effect works before it has loaded (it appears a moment later); `rim` sets the rim opacity.
 */
export class WeaponModel {
  readonly group = new THREE.Group();
  loaded = false;
  private rimMat: THREE.ShaderMaterial;

  constructor(id: WeaponId, opts: WeaponModelOptions = {}) {
    this.rimMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(opts.rim ?? 0xff6ab4) },
        uOpacity: { value: 0 },
        uPower: { value: opts.rimPower ?? 2.5 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position + normal * 0.0012, 1.0);
          vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity, uPower;
        varying vec3 vN; varying vec3 vView;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), uPower);
          gl_FragColor = vec4(uColor, rim * uOpacity);
        }`,
    });
    const darken = opts.darken ?? 0.45;
    const tint = new THREE.Color(opts.tint ?? 0x2a1030);
    const tintAmount = opts.tintAmount ?? 0.3;
    const emissiveMax = opts.emissiveMax ?? 1;
    const roughnessMin = opts.roughnessMin ?? 0.75;
    loadWeapon(id).then((src) => {
      const scene = src.clone(true);
      const meshes: THREE.Mesh[] = [];
      scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
      for (const mesh of meshes) {
        const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
          const c = m.clone() as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
          if ('color' in c) c.color.multiplyScalar(darken).lerp(tint, tintAmount);
          if ('emissiveIntensity' in c) {
            c.emissiveIntensity = Math.min(c.emissiveIntensity, emissiveMax);
            // only the real light sources (gems, glow lines, cracks, eyes) keep their emission
            if (!/gem|glow|crack|bolt|eye|rune/i.test(c.name)) c.emissive.multiplyScalar(darken);
          }
          // clear coat and sheen reflect the bright environment and would keep a darkened part pale
          if ('clearcoat' in c) { c.clearcoat = 0; c.sheen = 0; }
          // the scene's room environment (scene.environmentIntensity, not envMapIntensity) reflects as a pale sheet
          // on smooth flat faces (a blade, a fan leaf): rough it up
          c.roughness = Math.max(c.roughness, roughnessMin);
          // Transmission renders as a black hole against an empty background: fall back to plain translucency.
          if ('transmission' in c && c.transmission > 0) {
            c.transmission = 0;
            c.transparent = true;
            c.opacity = 0.72;
            c.depthWrite = false;
          }
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? mats : mats[0];
        const rim = new THREE.Mesh(mesh.geometry, this.rimMat);
        rim.renderOrder = 2;
        mesh.add(rim);
      }
      this.group.add(scene);
      this.loaded = true;
    }).catch((e) => console.error(`weapon ${id} failed to load`, e));
  }

  set rim(opacity: number) {
    this.rimMat.uniforms.uOpacity.value = opacity;
  }

  get rimColor(): THREE.Color {
    return this.rimMat.uniforms.uColor.value as THREE.Color;
  }
}

// ---------------------------------------------------------------------------------------- flow ribbon
export interface FlowRibbonOptions {
  /** Control points from root to tip (smoothed with Catmull-Rom). */
  points: THREE.Vector3[];
  /** Width (or width along the ribbon, u = 0 root .. 1 tip). */
  width: number | ((u: number) => number);
  /** Hot (root) → mid → cool (tip) colours. */
  colors: [THREE.ColorRepresentation, THREE.ColorRepresentation, THREE.ColorRepresentation];
  /** Ribbon plane normal; default +Z (faces the camera in the weapon views). */
  normal?: THREE.Vector3;
  /** Second strip at 90° around the tangent, so it reads from the side too. Default false. */
  cross?: boolean;
  /** Noise cells along the length (texture repeats). Default 3. */
  tiling?: number;
  /** Noise cells across the width. Default 1.5. */
  across?: number;
  /** 0..1: how much the tip breaks up into wisps. Default 0.55. */
  erosion?: number;
  /** Sideways sway amplitude at the tip (world units), along `swayAxis` (default: across the ribbon). */
  sway?: number;
  swayAxis?: THREE.Vector3;
  /** Sway waves along the length. Default 1. */
  swayWaves?: number;
  /** Brightness multiplier. Default 1. */
  intensity?: number;
  /** Additive (glow) or normal-blended (dark ribbon). Default additive. */
  additive?: boolean;
  segments?: number;
}

/**
 * A flame / silk / qi ribbon: a fixed strip whose noise texture scrolls from root to tip, coloured hot → cool,
 * eroding into wisps toward the tip and swaying. `update(loopT, period, cycles)` keeps it seamless: the
 * texture moves a whole number of tiles per loop. Fade it with `opacity`.
 */
export class FlowRibbon {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(opts: FlowRibbonOptions) {
    const segs = opts.segments ?? 48;
    const curve = new THREE.CatmullRomCurve3(opts.points);
    const normal = (opts.normal ?? new THREE.Vector3(0, 0, 1)).clone().normalize();
    const pos: number[] = [], uv: number[] = [], sideA: number[] = [], index: number[] = [];
    const strips = opts.cross ? 2 : 1;
    const t = new THREE.Vector3(), side = new THREE.Vector3(), n = new THREE.Vector3(), p = new THREE.Vector3();
    const swayAxis = opts.swayAxis?.clone().normalize();
    for (let s = 0; s < strips; s++) {
      const base = pos.length / 3;
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        curve.getPointAt(u, p);
        curve.getTangentAt(u, t);
        n.copy(normal);
        if (Math.abs(n.dot(t)) > 0.98) n.set(1, 0, 0);
        side.crossVectors(t, n).normalize();
        if (s === 1) side.cross(t).normalize();
        const w = (typeof opts.width === 'function' ? opts.width(u) : opts.width) / 2;
        const sw = swayAxis ?? side;
        for (const k of [-1, 1]) {
          pos.push(p.x + side.x * w * k, p.y + side.y * w * k, p.z + side.z * w * k);
          uv.push(u, k < 0 ? 0 : 1);
          sideA.push(sw.x, sw.y, sw.z);
        }
        if (i < segs) {
          const a = base + i * 2;
          index.push(a, a + 1, a + 3, a, a + 3, a + 2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aSway', new THREE.Float32BufferAttribute(sideA, 3));
    geo.setIndex(index);
    const [c0, c1, c2] = opts.colors.map((c) => new THREE.Color(c));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uC0: { value: c0 }, uC1: { value: c1 }, uC2: { value: c2 },
        uOpacity: { value: 0 }, uScroll: { value: 0 }, uSwayPhase: { value: 0 },
        uTiling: { value: opts.tiling ?? 3 }, uAcross: { value: opts.across ?? 1.5 },
        uErosion: { value: opts.erosion ?? 0.55 }, uSway: { value: opts.sway ?? 0 },
        uWaves: { value: opts.swayWaves ?? 1 }, uIntensity: { value: opts.intensity ?? 1 },
        uAdditive: { value: opts.additive === false ? 0 : 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aSway;
        uniform float uSway, uSwayPhase, uWaves;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          float u = uv.x;
          vec3 p = position + aSway * uSway * u * u * sin(6.2831853 * (uSwayPhase - u * uWaves * 0.5));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uC0, uC1, uC2;
        uniform float uOpacity, uScroll, uTiling, uAcross, uErosion, uIntensity, uAdditive;
        varying vec2 vUv;
        ${TILE_NOISE}
        void main() {
          float u = vUv.x, v = vUv.y;
          float edge = 1.0 - abs(v * 2.0 - 1.0);
          float px = max(1.0, floor(uTiling + 0.5));
          float n = tfbm(vec2(u * px - uScroll, v * uAcross), px);
          // soft sides, eaten away more toward the tip
          float body = smoothstep(0.0, 0.55, edge);
          float thr = uErosion * (0.1 + 0.9 * u);
          float a = smoothstep(thr, thr + 0.3, n * (0.55 + 0.45 * body)) * body;
          a *= smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.7, u);
          float g = clamp(u + (1.0 - edge) * 0.25 - n * 0.15, 0.0, 1.0);
          vec3 col = g < 0.5 ? mix(uC0, uC1, g * 2.0) : mix(uC1, uC2, g * 2.0 - 1.0);
          // a thin hot core line along the middle
          col += uC0 * smoothstep(0.75, 1.0, edge) * (1.0 - u) * 0.35 * uAdditive;
          float alpha = a * uOpacity;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(col * uIntensity, alpha);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
  }

  /** loopT in [0, period); `cycles` = whole texture passes per loop (speed), `swayCycles` sway periods per loop. */
  update(loopT: number, period: number, cycles = 2, swayCycles = 1) {
    const f = loopT / period;
    const px = Math.max(1, Math.round(this.material.uniforms.uTiling.value as number));
    this.material.uniforms.uScroll.value = ((f * cycles) % 1) * px;
    this.material.uniforms.uSwayPhase.value = (f * swayCycles) % 1;
  }

  set opacity(v: number) {
    this.material.uniforms.uOpacity.value = v;
    this.mesh.visible = v > 0.002;
  }
}

// ------------------------------------------------------------------------------------- canvas textures
function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let starTex: THREE.Texture | undefined, streakTex: THREE.Texture | undefined, petalTex: THREE.Texture | undefined;
/** A soft halo with a four-point cross glint. */
function starTexture() {
  return (starTex ??= canvasTexture(256, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.08, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, h, a] of [[c * 0.05, c, 0.9], [c * 0.035, c * 0.6, 0.5]] as const) {
      for (const rot of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
        if (rot !== 0 && rot !== Math.PI / 2 && h === c) continue;
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(rot);
        const lg = ctx.createLinearGradient(0, -h, 0, h);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(0.5, `rgba(255,255,255,${a})`);
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(0, -h); ctx.lineTo(w, 0); ctx.lineTo(0, h); ctx.lineTo(-w, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }));
}

/** A thin horizontal anamorphic lens streak. */
function streakTexture() {
  return (streakTex ??= canvasTexture(256, (ctx, s) => {
    const c = s / 2;
    const lg = ctx.createLinearGradient(0, 0, s, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,1)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    for (const [h, a] of [[s * 0.012, 1], [s * 0.05, 0.25]] as const) {
      ctx.globalAlpha = a;
      ctx.fillRect(0, c - h, s, h * 2);
    }
  }));
}

/** A pointed petal / flake. */
export function petalTexture() {
  return (petalTex ??= canvasTexture(64, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0.55)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(s / 2, 2);
    ctx.quadraticCurveTo(s * 0.95, s * 0.45, s / 2, s - 2);
    ctx.quadraticCurveTo(s * 0.05, s * 0.45, s / 2, 2);
    ctx.fill();
  }));
}

export interface LilyOptions {
  /** Filament count. Default 26. */
  filaments?: number;
  /** How far the filament tips curl back (0 = straight spikes, as for ice). Default 1. */
  curl?: number;
  /** Seed for the uneven lengths. */
  seed?: number;
}

const lilyCache = new Map<string, THREE.Texture>();
/** The spider-lily stamen burst: thin curved filaments from the centre, each with a dot at its tip. */
function lilyTexture(o: LilyOptions) {
  const key = `${o.filaments ?? 26}:${o.curl ?? 1}:${o.seed ?? 1}`;
  let tex = lilyCache.get(key);
  if (tex) return tex;
  tex = canvasTexture(512, (ctx, s) => {
    const c = s / 2, n = o.filaments ?? 26, curl = o.curl ?? 1;
    let seed = (o.seed ?? 1) * 9301;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.fillStyle = 'rgba(255,255,255,1)';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.15;
      const len = c * (0.55 + 0.4 * rnd());
      const bend = (rnd() < 0.5 ? -1 : 1) * curl * (0.35 + 0.4 * rnd());
      const ex = c + Math.cos(a) * len, ey = c + Math.sin(a) * len;
      // control point off to the side, so the filament sweeps and its tip hooks back
      const mx = c + Math.cos(a + bend * 0.5) * len * 0.6, my = c + Math.sin(a + bend * 0.5) * len * 0.6;
      const hx = ex + Math.cos(a + Math.PI / 2 * Math.sign(bend)) * len * 0.12 * curl;
      const hy = ey + Math.sin(a + Math.PI / 2 * Math.sign(bend)) * len * 0.12 * curl;
      ctx.lineWidth = s * 0.006;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      if (curl > 0) ctx.quadraticCurveTo(ex + (ex - mx) * 0.15, ey + (ey - my) * 0.15, hx, hy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(curl > 0 ? hx : ex, curl > 0 ? hy : ey, s * 0.008, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.25);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  lilyCache.set(key, tex);
  return tex;
}

function sprite(map: THREE.Texture, color: THREE.ColorRepresentation) {
  const m = new THREE.SpriteMaterial({
    map, color, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0,
  });
  const s = new THREE.Sprite(m);
  s.renderOrder = 5;
  s.visible = false;
  return s;
}

// ------------------------------------------------------------------------------------------ star flare
/**
 * The focal point: a soft halo with a four-point glint and a long horizontal lens streak (always horizontal on
 * screen). `set(pos, size, opacity)` per frame; the streak is `streak` times as wide as the star.
 */
export class StarFlare {
  readonly group = new THREE.Group();
  private star: THREE.Sprite;
  private streakS: THREE.Sprite;
  streak = 4;

  constructor(color: THREE.ColorRepresentation = 0xffd890, streakColor: THREE.ColorRepresentation = 0xffb0d8) {
    this.star = sprite(starTexture(), color);
    this.streakS = sprite(streakTexture(), streakColor);
    this.group.add(this.star, this.streakS);
  }

  set(pos: THREE.Vector3, size: number, opacity: number, spin = 0) {
    const show = opacity > 0.002 && size > 1e-4;
    this.star.visible = this.streakS.visible = show;
    this.group.position.copy(pos);
    this.star.scale.setScalar(Math.max(size, 1e-4));
    this.streakS.scale.set(Math.max(size * this.streak, 1e-4), Math.max(size * this.streak, 1e-4), 1);
    this.star.material.opacity = clamp01(opacity);
    this.star.material.rotation = spin;
    this.streakS.material.opacity = clamp01(opacity * 0.6);
  }
}

// -------------------------------------------------------------------------------------------- lily burst
/**
 * Spider-lily filament burst (camera-facing): `set(pos, size, opacity, spin)`. Two layers at different spins
 * and sizes give it depth; `curl: 0` makes straight crystal spikes.
 */
export class LilyBurst {
  readonly group = new THREE.Group();
  private a: THREE.Sprite;
  private b: THREE.Sprite;

  constructor(color: THREE.ColorRepresentation = 0xffc060, inner: THREE.ColorRepresentation = 0xfff0c0, opts: LilyOptions = {}) {
    this.a = sprite(lilyTexture({ ...opts, seed: opts.seed ?? 1 }), color);
    this.b = sprite(lilyTexture({ ...opts, seed: (opts.seed ?? 1) + 1, filaments: Math.round((opts.filaments ?? 26) * 0.7) }), inner);
    this.group.add(this.a, this.b);
  }

  set(pos: THREE.Vector3, size: number, opacity: number, spin = 0) {
    const show = opacity > 0.002 && size > 1e-4;
    this.a.visible = this.b.visible = show;
    this.group.position.copy(pos);
    this.a.scale.setScalar(Math.max(size, 1e-4));
    this.b.scale.setScalar(Math.max(size * 0.62, 1e-4));
    this.a.material.opacity = clamp01(opacity);
    this.b.material.opacity = clamp01(opacity * 0.9);
    this.a.material.rotation = spin;
    this.b.material.rotation = -spin * 1.6 + 0.4;
  }
}

// ---------------------------------------------------------------------------------------------- petals
export interface PetalOptions {
  count?: number;
  color?: THREE.ColorRepresentation;
  size?: number;
  gravity?: number;
  drag?: number;
  life?: number;
  additive?: boolean;
}

/**
 * Falling petal / flake flecks (instanced quads that flutter). `emit(at, n, speed, up)` sprays n petals;
 * call `update(dt)` every frame.
 */
export class PetalSwarm {
  readonly mesh: THREE.InstancedMesh;
  private pos: THREE.Vector3[] = [];
  private vel: THREE.Vector3[] = [];
  private age: number[] = [];
  private spin: number[] = [];
  private cursor = 0;
  private opts: Required<PetalOptions>;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();

  constructor(opts: PetalOptions = {}) {
    this.opts = { count: 60, color: 0xffb070, size: 0.02, gravity: 0.35, drag: 1.2, life: 2.2, additive: true, ...opts };
    const mat = new THREE.MeshBasicMaterial({
      map: petalTexture(), color: this.opts.color, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: this.opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0.9,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 1), mat, this.opts.count);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < this.opts.count; i++) {
      this.pos.push(new THREE.Vector3());
      this.vel.push(new THREE.Vector3());
      this.age.push(1e9);
      this.spin.push(Math.random() * TAU);
      this.mesh.setMatrixAt(i, this.m.makeScale(1e-4, 1e-4, 1e-4));
    }
  }

  emit(at: THREE.Vector3, n: number, speed = 0.4, up = 0.2) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.opts.count;
      this.pos[i].copy(at);
      const a = Math.random() * TAU, el = (Math.random() - 0.3) * 1.2;
      this.vel[i].set(Math.cos(a) * Math.cos(el), Math.sin(el) + up, Math.sin(a) * Math.cos(el)).multiplyScalar(speed * (0.5 + Math.random()));
      this.age[i] = 0;
      this.spin[i] = Math.random() * TAU;
    }
  }

  clear() {
    this.age.fill(1e9);
  }

  update(dt: number) {
    const o = this.opts, damp = Math.exp(-o.drag * dt);
    for (let i = 0; i < o.count; i++) {
      this.age[i] += dt;
      const life = this.age[i] / o.life;
      if (life >= 1) {
        this.mesh.setMatrixAt(i, this.m.makeScale(1e-4, 1e-4, 1e-4));
        continue;
      }
      const v = this.vel[i];
      v.y -= o.gravity * dt;
      v.multiplyScalar(damp);
      // flutter: a sideways sway as they fall
      v.x += Math.sin(this.age[i] * 5 + this.spin[i]) * 0.15 * dt;
      this.pos[i].addScaledVector(v, dt);
      const sz = o.size * Math.sin(Math.PI * Math.min(1, life * 6)) * (1 - life * life);
      this.e.set(this.spin[i] + this.age[i] * 3, this.spin[i] * 2 + this.age[i] * 2, this.age[i] * 4);
      this.q.setFromEuler(this.e);
      this.s.setScalar(Math.max(sz, 1e-4));
      this.mesh.setMatrixAt(i, this.m.compose(this.pos[i], this.q, this.s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// -------------------------------------------------------------------------------------------- spawners
/** Point at fraction f (0..1) along a polyline. */
export function alongPolyline(points: readonly THREE.Vector3[], f: number, out = new THREE.Vector3()) {
  const segs = points.length - 1;
  const x = clamp01(f) * segs;
  const i = Math.min(Math.floor(x), segs - 1);
  return out.copy(points[i]).lerp(points[i + 1], x - i);
}

/**
 * Feeds an emitter (rate 0) with particles spawned at random points along a polyline (a blade edge, a haft, a
 * leaf rim), `rate` per second, with `jitter` scatter. Call `update(dt)` before the emitter's update.
 */
export class PolylineSpawner {
  private acc = 0;
  private p = new THREE.Vector3();
  rate: number;

  constructor(readonly emitter: Emitter, readonly points: readonly THREE.Vector3[], rate: number, readonly jitter = 0.01) {
    this.rate = rate;
  }

  update(dt: number) {
    this.acc += this.rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      alongPolyline(this.points, Math.random(), this.p);
      this.p.x += (Math.random() - 0.5) * 2 * this.jitter;
      this.p.y += (Math.random() - 0.5) * 2 * this.jitter;
      this.p.z += (Math.random() - 0.5) * 2 * this.jitter;
      this.emitter.burst(1, this.p);
    }
  }
}

// ------------------------------------------------------------------------------------------- blade trail
/**
 * The swept ribbon a swinging weapon leaves: each frame `push(base, tip)` (world points along the blade) while
 * `active`, older samples fade over `life` seconds. Colours run hot at the tip → cool at the base; additive.
 */
export class BladeTrail {
  readonly mesh: THREE.Mesh;
  private base: THREE.Vector3[] = [];
  private tip: THREE.Vector3[] = [];
  private age: number[] = [];
  private geo: THREE.BufferGeometry;
  private pos: Float32Array;
  private alpha: Float32Array;
  private material: THREE.ShaderMaterial;

  constructor(readonly samples = 28, readonly life = 0.22, colors: [THREE.ColorRepresentation, THREE.ColorRepresentation, THREE.ColorRepresentation] = ['#ffffff', '#8ff5ff', '#1a6a8a']) {
    this.pos = new Float32Array(samples * 2 * 3);
    this.alpha = new Float32Array(samples * 2);
    const uv = new Float32Array(samples * 2 * 2);
    const index: number[] = [];
    for (let i = 0; i < samples; i++) {
      uv.set([i / (samples - 1), 0, i / (samples - 1), 1], i * 4);
      if (i < samples - 1) {
        const a = i * 2;
        index.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(index);
    const [c0, c1, c2] = colors.map((c) => new THREE.Color(c));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uC0: { value: c0 }, uC1: { value: c1 }, uC2: { value: c2 }, uOpacity: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aAlpha; varying float vA; varying vec2 vUv;
        void main() { vA = aAlpha; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uC0, uC1, uC2; uniform float uOpacity; varying float vA; varying vec2 vUv;
        void main() {
          float v = vUv.y; // 0 base .. 1 tip
          vec3 col = v > 0.5 ? mix(uC1, uC0, (v - 0.5) * 2.0) : mix(uC2, uC1, v * 2.0);
          float a = vA * smoothstep(0.0, 0.35, v) * uOpacity;
          if (a < 0.003) discard;
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  push(base: THREE.Vector3, tip: THREE.Vector3) {
    this.base.unshift(base.clone());
    this.tip.unshift(tip.clone());
    this.age.unshift(0);
    if (this.base.length > this.samples) { this.base.pop(); this.tip.pop(); this.age.pop(); }
  }

  clear() {
    this.base = []; this.tip = []; this.age = [];
    this.mesh.visible = false;
  }

  /** Ages the samples and rebuilds the strip (positions are in the mesh's parent space). */
  update(dt: number) {
    for (let i = 0; i < this.age.length; i++) this.age[i] += dt;
    while (this.age.length && this.age[this.age.length - 1] > this.life) { this.base.pop(); this.tip.pop(); this.age.pop(); }
    const n = this.base.length;
    this.mesh.visible = n >= 2;
    for (let i = 0; i < this.samples; i++) {
      const k = Math.min(i, n - 1);
      if (k < 0) break;
      const a = i < n ? Math.max(0, 1 - this.age[k] / this.life) ** 1.5 : 0;
      this.pos.set([this.base[k].x, this.base[k].y, this.base[k].z, this.tip[k].x, this.tip[k].y, this.tip[k].z], i * 6);
      this.alpha[i * 2] = this.alpha[i * 2 + 1] = a;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  set opacity(v: number) {
    this.material.uniforms.uOpacity.value = v;
  }
}
