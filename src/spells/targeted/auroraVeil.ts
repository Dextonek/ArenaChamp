import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  CrescentArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Aurora Veil (targeted, ground AoE, radius 5.5): under a polar-night sky of stars, a faint aurora band waves high
 * up and seven tall rippling aurora curtains (green body, teal edge, magenta lower fringe, vertical streaks) descend
 * in a ring around the area like drapes. The two curtains between the caster and the area hang lower and fainter
 * so the scene stays readable. Snow falls inside, one tick hits. The curtains stop rippling and freeze into
 * pale-cyan ice from the bottom up (dead beat), then shatter inward into a rain of cyan shards with short teal impact
 * frames, a frost nova of two toon crescents and rings, and a small dark smoke ball. Shards land, twinkle and melt
 * away; the sky band fades back. Recipes: e-onlyxyz-sunset-cloud-aura (layered sky colour bands),
 * i-ice-spiral-comma-sweep (the ice sweep on the nova), i-frost-pillar-snow-dome-rubble (ice structure, snow, rubble).
 */
export interface AuroraVeilSettings {
  impactTime: number;
  damage: number;
  loop: boolean;
}

export const defaultAuroraVeil = (): AuroraVeilSettings => ({ impactTime: 2.15, damage: 50, loop: false });

const AFTERMATH = 2.65;
const RADIUS = 5.5;
const RING_R = 5.6;
const CURTAINS = 7;
const CURT_W = 5.3;
const TOP_BACK = 6.4;
const TOP_FRONT = 3.2;
const SEG_X = 18;
const SEG_Y = 8;
const PER_CURTAIN = 22;
const SHARDS = CURTAINS * PER_CURTAIN;
const STARS = 150;
const STAGGER = 0.07;
const DESCEND = 0.7;
const FREEZE_AT = 1.9;
const GRAVITY = 19;
const MIN_SCALE = 1e-4;

// Value ladder: polar night, teal body, green hot (#6aff9a, in the textures), magenta fringe, tiny pale core. All mid-tone.
const TEAL = 0x3ad0c8;
const MAGENTA = 0xd050c8;
const NIGHT = 0x04081a;
const ICE = 0x7fcfe6;
const ICE_PALE = 0xa8e4f0;
const ICE_DEEP = 0x5ab0d0;
const ICE_VIOLET = 0x9a7ad8;

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/** Aurora strip: dark-teal top, green body, teal, magenta fringe at the bottom edge; many thin vertical streaks. */
function auroraTexture(): THREE.CanvasTexture {
  const W = 256, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const rnd = seeded(41);
  for (let x = 0; x < W;) {
    const w = 1 + Math.floor(rnd() * 3);
    // Brightness envelope with a few strong rays and quiet gaps between them.
    const env = 0.3 + 0.7 * Math.abs(Math.sin(x * 0.045) * Math.sin(x * 0.017 + 1.3));
    const b = Math.min(1, env * (0.35 + 0.65 * rnd()) + (rnd() < 0.08 ? 0.35 : 0));
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(58,208,200,0)');
    gr.addColorStop(0.16, `rgba(58,208,200,${0.45 * b})`);
    gr.addColorStop(0.44, `rgba(106,255,154,${0.95 * b})`);
    gr.addColorStop(0.74, `rgba(70,220,176,${0.75 * b})`);
    gr.addColorStop(0.92, `rgba(208,80,200,${0.85 * b})`);
    gr.addColorStop(1, 'rgba(208,80,200,0)');
    g.fillStyle = gr;
    g.fillRect(x, 0, w, H);
    x += w;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Ice sheet: pale-cyan gradient, tall crystal facets with darker edges, a few thin pale highlights. */
function iceTexture(): THREE.CanvasTexture {
  const W = 256, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  const rnd = seeded(97);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(110,190,220,0.8)');
  gr.addColorStop(1, 'rgba(90,176,208,0.92)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  const shades = ['#7fcfe6', '#8fd4e8', '#5ab0d0', '#6fc4de', '#a8e4f0'];
  for (let k = 0; k < 34; k++) {
    const x = rnd() * W, y0 = rnd() * H * 0.8, w = 10 + rnd() * 26, h = 60 + rnd() * 120;
    g.beginPath();
    g.moveTo(x, y0);
    g.lineTo(x + w * 0.5, y0 - h * 0.18);
    g.lineTo(x + w, y0);
    g.lineTo(x + w * (0.8 + rnd() * 0.4), y0 + h);
    g.lineTo(x - w * 0.1, y0 + h * (0.85 + rnd() * 0.3));
    g.closePath();
    g.fillStyle = shades[Math.floor(rnd() * shades.length)];
    g.globalAlpha = 0.65;
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = '#2f7a9a';
    g.lineWidth = 2.5;
    g.stroke();
    g.strokeStyle = 'rgba(190,236,246,0.7)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x + w * 0.3, y0 + 4);
    g.lineTo(x + w * 0.35, y0 + h * 0.6);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Flat triangle shard (thin, double-sided via the material). */
function shardGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.55);
  s.lineTo(-0.3, -0.32);
  s.lineTo(0.34, -0.2);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

/** A subdivided sheet whose vertices are re-evaluated every frame from a surface function. */
class CurtainMesh {
  readonly mesh: THREE.Mesh;
  private pos = new Float32Array((SEG_X + 1) * (SEG_Y + 1) * 3);
  private uv = new Float32Array((SEG_X + 1) * (SEG_Y + 1) * 2);
  private geo = new THREE.BufferGeometry();
  private tmp = new THREE.Vector3();

  constructor(readonly mat: THREE.MeshBasicMaterial) {
    const idx: number[] = [];
    for (let j = 0; j < SEG_Y; j++) {
      for (let i = 0; i < SEG_X; i++) {
        const a = j * (SEG_X + 1) + i, b = a + 1, c = a + SEG_X + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Surface fn(u 0..1 across, v 0..1 bottom to top); only v in [vLo, vHi] is built. Texture u scrolls by `scroll`. */
  fill(fn: (u: number, v: number, out: THREE.Vector3) => void, vLo: number, vHi: number, scroll: number, uSpan: number) {
    let k = 0, q = 0;
    for (let j = 0; j <= SEG_Y; j++) {
      const v = vLo + ((vHi - vLo) * j) / SEG_Y;
      for (let i = 0; i <= SEG_X; i++) {
        const u = i / SEG_X;
        fn(u, v, this.tmp);
        this.pos[k++] = this.tmp.x;
        this.pos[k++] = this.tmp.y;
        this.pos[k++] = this.tmp.z;
        this.uv[q++] = u * uSpan + scroll;
        this.uv[q++] = v;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
  }
}

interface Curtain {
  aur: CurtainMesh;
  ice: CurtainMesh;
  theta: number;
  front: boolean;
  seed: number;
  start: number;
  top: number;
}

interface Piece { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; size: number; life: number; landed: boolean; live: boolean; yaw: number }

const newPiece = (): Piece => ({
  p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), size: 0.5, life: 1, landed: false, live: false, yaw: 0,
});

export class AuroraVeil implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AuroraVeilSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private ticked = false;
  private shattered = false;
  private smokeDone = false;
  private snowTimer = 0;
  private center = new THREE.Vector3();
  private skyDir = new THREE.Vector3(0, 0, -1);

  private auroraTex = auroraTexture();
  private iceTex = iceTexture();
  private curtains: Curtain[] = [];
  private sky: CurtainMesh;
  private starGeo = new THREE.BufferGeometry();
  private starPos = new Float32Array(STARS * 3);
  private starMat = new THREE.PointsMaterial({
    size: 0.32, map: softDotTexture(), color: 0xcfeefc, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private stars = new THREE.Points(this.starGeo, this.starMat);

  private darkMat = new THREE.MeshBasicMaterial({ color: NIGHT, transparent: true, opacity: 0, depthWrite: false });
  private dark = new THREE.Mesh(new THREE.CircleGeometry(RADIUS + 0.4, 64), this.darkMat);
  private frostMat = new THREE.MeshBasicMaterial({ color: ICE, transparent: true, opacity: 0, depthWrite: false });
  private frost = new THREE.Mesh(new THREE.CircleGeometry(RADIUS, 64), this.frostMat);
  private rim = createRing(TEAL, 0.97, 1, 128);
  private shock = createRing(ICE_PALE, 0.9, 1, 96);
  private shock2 = createRing(MAGENTA, 0.94, 1, 96);

  private hubGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: TEAL, core: 0xdffff4 });
  private star = new StarBurst({ points: 10, color: TEAL, core: 0xbff4e8, additive: false });
  private accentStar = new StarBurst({ points: 10, color: MAGENTA, core: MAGENTA, additive: false });
  private twinkles: StarBurst[] = [];
  private smoke = new SmokeBall({ color: NIGHT, rim: 0x16284a, flake: 0x0a1630, maxBalls: 3 });

  private novaPlane = new THREE.Group();
  private novaArcs: CrescentArc[] = [];

  private shardMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  private shards = new THREE.InstancedMesh(shardGeometry(), this.shardMat, SHARDS);
  private shardState: Piece[] = Array.from({ length: SHARDS }, newPiece);

  private snow: Emitter;
  private chips: Emitter;

  constructor(settings: AuroraVeilSettings = defaultAuroraVeil()) {
    this.settings = settings;
    this.screen.tint.set(0x0c1a3a);
    this.screen.impactColor.set(TEAL);
    this.screen.speedLineColor.set(ICE_PALE);
    this.screen.edgeTint.set(MAGENTA);
    this.shards.frustumCulled = false;
    this.stars.frustumCulled = false;
    this.starGeo.setAttribute('position', new THREE.BufferAttribute(this.starPos, 3));

    for (let i = 0; i < CURTAINS; i++) {
      const aur = new CurtainMesh(new THREE.MeshBasicMaterial({
        map: this.auroraTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      const ice = new CurtainMesh(new THREE.MeshBasicMaterial({
        map: this.iceTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      }));
      this.group.add(aur.mesh, ice.mesh);
      this.curtains.push({ aur, ice, theta: 0, front: false, seed: i * 1.93 + 0.4, start: 0.8 + i * STAGGER, top: TOP_BACK });
    }
    this.sky = new CurtainMesh(new THREE.MeshBasicMaterial({
      map: this.auroraTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.group.add(this.sky.mesh, this.stars);

    this.dark.rotation.x = -Math.PI / 2;
    this.dark.position.y = 0.02;
    this.frost.rotation.x = -Math.PI / 2;
    this.frost.position.y = 0.04;
    this.rim.mesh.position.y = 0.06;
    this.shock.mesh.position.y = 0.07;
    this.shock2.mesh.position.y = 0.08;
    this.group.add(this.dark, this.frost, this.rim.mesh, this.shock.mesh, this.shock2.mesh, this.shards);
    this.group.add(this.hubGlint.mesh, this.star.mesh, this.accentStar.mesh, this.smoke.mesh);

    // Two big toon ground crescents sweeping around the middle in one direction (ice-sweep recipe).
    for (let i = 0; i < 2; i++) {
      const arc = new CrescentArc({
        radius: 3.6 - i * 1.0, width: 1.2, style: 'toon', edge: 0xd8f6ff, mid: ICE, outer: 0x1a4a6a, sweep: Math.PI * 1.2,
      });
      arc.mesh.rotation.z = i * Math.PI;
      this.novaPlane.add(arc.mesh);
      this.novaArcs.push(arc);
    }
    this.novaPlane.rotation.x = -Math.PI / 2;
    this.group.add(this.novaPlane);

    for (let k = 0; k < 6; k++) {
      const s = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0x9fe8f4, core: 0xdffff4, additive: false });
      this.twinkles.push(s);
      this.group.add(s.mesh);
    }

    // Falling snow (pale cyan, normal-blended) and cyan chips thrown by the shatter.
    this.snow = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.1, speed: 0.3, speedJitter: 0.6, spread: 180, gravity: 2.5, drag: 0.3,
      sizeStart: 0.12, sizeEnd: 0.07, colorStart: '#cfeeff', colorEnd: '#7fcfe6',
      opacityStart: 0.75, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0, groundFade: 0.3,
    });
    this.chips = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 8, speedJitter: 0.6, spread: 110, gravity: 12, drag: 1.4,
      sizeStart: 0.15, sizeEnd: 0.04, colorStart: '#a8e4f0', colorEnd: '#3a8aa8',
      opacityStart: 0.95, opacityEnd: 0, additive: false, colorMid: '#7fcfe6', sizeJitter: 0.4, erosion: 0, spin: 0.6,
    });
    this.emitters.push(this.snow, this.chips, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return this.settings.impactTime + AFTERMATH;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.point).setY(0);
    const c = this.center;
    const toCaster = Math.atan2(ctx.from.x - c.x, ctx.from.z - c.z);
    const tc = Number.isFinite(toCaster) ? toCaster : 0;
    // Away from the caster: where the sky band hangs.
    this.skyDir.set(-Math.sin(tc), 0, -Math.cos(tc));
    const base = tc + Math.PI / CURTAINS;
    const order = this.curtains.map((cu, i) => ({ i, cos: 0, cu }));
    this.curtains.forEach((cu, i) => {
      cu.theta = base + (i * Math.PI * 2) / CURTAINS;
      cu.front = Math.cos(cu.theta - tc) > 0.55;
      cu.top = cu.front ? TOP_FRONT : TOP_BACK;
      order[i].cos = Math.cos(cu.theta - tc);
    });
    // Far curtains descend first.
    order.sort((a, b) => a.cos - b.cos).forEach((o, rank) => { o.cu.start = 0.8 + rank * STAGGER; });

    // Stars on a dome around the area, high enough to clear the curtains.
    for (let i = 0; i < STARS; i++) {
      const a = Math.random() * Math.PI * 2;
      const el = (14 + Math.random() * 58) * (Math.PI / 180);
      const r = 24 + Math.random() * 8;
      this.starPos[i * 3] = c.x + Math.cos(el) * Math.sin(a) * r;
      this.starPos[i * 3 + 1] = 6 + Math.sin(el) * r * 0.8;
      this.starPos[i * 3 + 2] = c.z + Math.cos(el) * Math.cos(a) * r;
    }
    this.starGeo.attributes.position.needsUpdate = true;

    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(c).setY(1.3);
    this.novaPlane.position.set(c.x, 0.09, c.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.ticked = false;
    this.shattered = false;
    this.smokeDone = false;
    this.snowTimer = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const s of this.shardState) { s.p.set(0, -50, 0); s.live = false; s.landed = false; }
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    const D = this.settings.impactTime;
    if (!this.ticked && this.time >= 1.3) this.onTick();
    if (!this.shattered && this.time >= D) this.onShatter();
    if (!this.smokeDone && this.shattered && this.time >= D + 0.12) {
      this.smokeDone = true;
      this.smoke.hold = 0.2;
      this.smoke.trigger(this.center.clone().setY(0.9), 0.9, 0.6);
    }
    if (!this.shattered && this.time > 0.8) {
      this.snowTimer -= dt;
      if (this.snowTimer <= 0) {
        this.snowTimer = 0.05;
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (RADIUS - 0.3);
          this.snow.burst(1, new THREE.Vector3(this.center.x + Math.cos(a) * r, 7 + Math.random() * 1.5, this.center.z + Math.sin(a) * r));
        }
      }
    }
    this.layout(dt);
  }

  /** Point on a ring curtain: u across, v 0 (bottom edge) to 1 (top). `amp` scales the ripple. */
  private ringPoint(cu: Curtain, u: number, v: number, wt: number, amp: number, desc: number, out: THREE.Vector3) {
    const s = (u - 0.5) * CURT_W;
    const a = cu.theta + s / RING_R;
    const bottom = cu.top * (1 - desc);
    const y0 = bottom + v * (cu.top - bottom);
    const k = 0.35 + 0.65 * (1 - v);
    const wob = amp * k * (Math.sin(s * 1.1 + wt * 1.7 + v * 2.2 + cu.seed) + 0.6 * Math.sin(s * 2.6 - wt * 2.4 + cu.seed * 1.7 + v));
    const r = RING_R + wob * 0.5;
    const y = y0 + 0.15 * amp * Math.sin(s * 2 + wt * 2 + cu.seed);
    out.set(this.center.x + Math.sin(a) * r, y, this.center.z + Math.cos(a) * r);
  }

  private layout(dt: number) {
    const D = this.settings.impactTime;
    const t = this.time;
    const after = t - D;
    const c = this.center;
    const focus = c.clone().setY(1.3);
    const hide = new THREE.Vector3(0, -50, 0);
    const fade = 1 - smoothstep((t - (this.duration - 0.8)) / 0.8);

    // 1. Polar night: the world darkens fast, holds, lets go after the shatter.
    this.screen.darken = after < 0 ? 0.8 * smoothstep(t / 0.7) : 0.8 * Math.exp(-Math.max(0, after - 0.15) * 3);

    // 2. Stars twinkle in with the dark; a faint sky band waves high up behind the area.
    const skyIn = smoothstep((t - 0.1) / 0.7);
    this.starMat.opacity = 0.65 * skyIn * (after < 0 ? 1 : 1 - smoothstep(after / 1.2)) * fade;
    this.stars.visible = this.starMat.opacity > 0.01;
    const sky = this.sky;
    const skyDir = this.skyDir;
    const skyTail = after < 0 ? 1 : 0.5 + 0.5 * Math.exp(-after * 1.5);
    sky.mat.opacity = 0.14 * skyIn * skyTail * fade;
    sky.mesh.visible = sky.mat.opacity > 0.004;
    if (sky.mesh.visible) {
      const sx = skyDir.x, sz = skyDir.z, tx = -sz, tz = sx;
      sky.fill((u, v, out) => {
        const s = (u - 0.5) * 30;
        const wave = 1.6 * Math.sin(s * 0.28 + t * 0.6) + 0.7 * Math.sin(s * 0.7 - t * 0.9);
        out.set(c.x + sx * (15 + wave * 0.6) + tx * s, 9.5 + v * 6 + 0.6 * Math.sin(s * 0.5 + t * 0.7 + v * 2), c.z + sz * (15 + wave * 0.6) + tz * s);
      }, 0, 1, t * 0.03, 3);
    }

    // 3. Ground: a dark disc for the polar night, a thin teal rim where the curtains touch, frost after the freeze.
    const touch = smoothstep((t - 1.5) / 0.5);
    this.darkMat.opacity = (after < 0 ? 0.4 * smoothstep((t - 0.6) / 0.6) : 0.4 * (1 - smoothstep(after / (AFTERMATH - 0.3)))) * fade;
    this.dark.position.set(c.x, 0.02, c.z);
    this.dark.visible = this.darkMat.opacity > 0.01;
    this.rim.mesh.position.set(c.x, 0.06, c.z);
    this.rim.mesh.scale.setScalar(RADIUS);
    this.rim.material.opacity = after < 0 ? 0.4 * touch * (1 - smoothstep((t - FREEZE_AT) / 0.2)) : 0;
    this.rim.mesh.visible = this.rim.material.opacity > 0.01;
    this.frost.position.set(c.x, 0.04, c.z);
    const frostIn = smoothstep((t - FREEZE_AT) / 0.25);
    this.frost.scale.setScalar(after < 0 ? 0.35 + 0.65 * frostIn : 1);
    this.frostMat.opacity = (after < 0 ? 0.28 * frostIn : 0.28 * (1 - smoothstep((after - 0.4) / (AFTERMATH - 0.7)))) * fade;
    this.frost.visible = this.frostMat.opacity > 0.01;

    // 4. Curtains: descend with an ease-out, ripple, then freeze into ice from the bottom up and stop moving.
    const fz = smoothstep((t - FREEZE_AT) / 0.2);
    const wt = Math.min(t, FREEZE_AT);
    const amp = 0.9 * (1 - 0.5 * fz);
    let landShake = 0;
    this.curtains.forEach((cu, i) => {
      const dRaw = THREE.MathUtils.clamp((t - cu.start) / DESCEND, 0, 1);
      const desc = 1 - Math.pow(1 - dRaw, 3);
      const gone = this.shattered;
      const alive = desc > 0.02 && !gone;
      const baseOp = cu.front ? 0.11 : 0.27;
      const flick = 0.9 + 0.1 * Math.sin(wt * 3.1 + i * 2.1);
      cu.aur.mat.opacity = baseOp * flick * smoothstep(dRaw / 0.3) * (1 - fz) * fade;
      cu.aur.mesh.visible = alive && cu.aur.mat.opacity > 0.004;
      if (cu.aur.mesh.visible) {
        cu.aur.fill((u, v, out) => this.ringPoint(cu, u, v, wt, amp, desc, out), 0, 1, wt * 0.05 + cu.seed, 1.2);
      }
      cu.ice.mat.opacity = (cu.front ? 0.4 : 0.78) * fz * fade;
      cu.ice.mesh.visible = alive && fz > 0.02 && cu.ice.mat.opacity > 0.01;
      if (cu.ice.mesh.visible) {
        cu.ice.fill((u, v, out) => this.ringPoint(cu, u, v, wt, amp, desc, out), 0, Math.max(0.05, fz), cu.seed * 0.1, 1.2);
      }
      const landed = t - (cu.start + DESCEND);
      if (landed > 0 && after < 0) landShake = Math.max(landShake, 0.08 * Math.exp(-landed * 12));
    });

    // 5. The hold: a small teal glint at the middle grows through the dead beat and dies on the shatter.
    const hub = t > 1.0 && after < 0 ? smoothstep((t - 1.0) / 1.1) : 0;
    this.hubGlint.set(new THREE.Vector3(c.x, 0.7, c.z), 0.9 * hub, hub > 0 ? 0.8 : 0, t * 0.8);

    // 6. Focus lines on the implode, short teal impact frames and a chroma pulse on the shatter.
    const imp = smoothstep((t - (D - 0.25)) / 0.25);
    this.screen.speedLines = after < 0 ? 0.6 * imp : Math.max(0, 0.6 - after * 6);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D, 0.8, 10);

    // 7. Shards: fly to the middle, burst, fall, land flat, melt (shrink).
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const damp = dt > 0 && after > 0.35 ? Math.max(0, 1 - 3 * dt) : 1;
    for (let i = 0; i < SHARDS; i++) {
      const sh = this.shardState[i];
      if (dt > 0 && sh.live && !sh.landed) {
        sh.v.y -= GRAVITY * dt;
        sh.v.x *= damp;
        sh.v.z *= damp;
        sh.p.addScaledVector(sh.v, dt);
        sh.r.set(sh.r.x + sh.w.x * dt, sh.r.y + sh.w.y * dt, sh.r.z + sh.w.z * dt);
        if (sh.p.y < 0.07 && sh.v.y < 0) {
          sh.p.y = 0.05 + Math.random() * 0.02;
          sh.landed = true;
          sh.v.set(0, 0, 0);
          sh.r.set(-Math.PI / 2, 0, sh.yaw);
        }
      }
      const kf = sh.live ? 1 - smoothstep((after - sh.life) / 0.5) : 0;
      if (kf < 0.02) m.compose(hide, q.identity(), sc.setScalar(MIN_SCALE));
      else m.compose(sh.p, q.setFromEuler(sh.r), sc.setScalar(Math.max(MIN_SCALE, sh.size * kf)));
      this.shards.setMatrixAt(i, m);
    }
    this.shards.instanceMatrix.needsUpdate = true;
    this.shards.visible = this.shattered;

    // 8. Burst: hard teal star with a magenta accent star behind it (2-3 frames), two rings, two toon crescents.
    const pop = StarBurst.pop(after - 0.06, 0.1, 0.16);
    this.star.set(focus, 4.4 * pop.scale, pop.opacity, 0.2);
    const apop = StarBurst.pop(after - 0.06, 0.02, 0.05);
    this.accentStar.set(focus, 5.6 * apop.scale, apop.opacity, 0.45);
    this.shock.mesh.position.set(c.x, 0.07, c.z);
    this.shock.mesh.scale.setScalar(1 + Math.max(0, after) * 17);
    this.shock.material.opacity = after > 0 ? Math.max(0, 0.6 * (1 - after / 0.5)) : 0;
    const a2 = after - 0.1;
    this.shock2.mesh.position.set(c.x, 0.08, c.z);
    this.shock2.mesh.scale.setScalar(1 + Math.max(0, a2) * 12);
    this.shock2.material.opacity = a2 > 0 ? Math.max(0, 0.45 * (1 - a2 / 0.5)) : 0;
    this.novaArcs.forEach((arc, i) => {
      const k = after - i * 0.06;
      arc.head = k > 0 ? Math.min(1.4, k * 4.5) : 0;
      arc.length = 0.55;
      arc.time = t;
      arc.erosion = smoothstep((k - 0.2) / 0.3);
      arc.opacity = k > 0 && k < 0.5 ? 1 : 0;
    });

    // 9. Twinkles on landed shards (pale cyan, small).
    this.twinkles.forEach((gl, k) => {
      const sh = this.shardState[(k * 23 + 7) % SHARDS];
      const cyc = (t * 1.3 + k * 0.37) % 1;
      const gp = StarBurst.pop(cyc * 0.5, 0.05, 0.14);
      if (!sh.landed || after < 0.8 || after > 2.0) { gl.set(hide, 0, 0); return; }
      gl.set(new THREE.Vector3(sh.p.x, sh.p.y + 0.2, sh.p.z), 0.5 * gp.scale, gp.opacity, k);
    });

    this.shake = after >= 0 ? 0.7 * Math.exp(-after * 6) : landShake;
  }

  private onTick() {
    this.ticked = true;
    const ctx = this.ctx;
    if (ctx) ctx.targets.forEach((en) => ctx.hit(en, { damage: 6, knock: 0, from: this.center, color: '#6aff9a' }));
  }

  private onShatter() {
    this.shattered = true;
    const c = this.center;
    const colorTmp = new THREE.Color();
    const wt = FREEZE_AT;
    const amp = 0.45;
    const pt = new THREE.Vector3();
    let si = 0;
    for (const cu of this.curtains) {
      for (let k = 0; k < PER_CURTAIN; k++, si++) {
        const sh = this.shardState[si];
        this.ringPoint(cu, Math.random(), Math.random(), wt, amp, 1, pt);
        sh.p.copy(pt);
        // Fly to a spot near the middle, reaching it after T seconds, then fall.
        const T = 0.35 + Math.random() * 0.15;
        const ta = Math.random() * Math.PI * 2, tr = Math.random() * 1.4;
        const tx = c.x + Math.cos(ta) * tr, tz = c.z + Math.sin(ta) * tr, ty = 0.8 + Math.random() * 1.4;
        sh.v.set((tx - sh.p.x) / T, (ty - sh.p.y) / T + 0.5 * GRAVITY * T, (tz - sh.p.z) / T);
        sh.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
        sh.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        sh.size = (cu.front ? 0.3 : 0.4) + Math.random() * 0.55 + (k % 6 === 0 ? 0.25 : 0);
        sh.life = 1.5 + Math.random() * 0.6;
        sh.yaw = Math.random() * Math.PI * 2;
        sh.landed = false;
        sh.live = true;
        const r = Math.random();
        colorTmp.set(r < 0.3 ? ICE : r < 0.55 ? ICE_PALE : r < 0.88 ? ICE_DEEP : ICE_VIOLET);
        this.shards.setColorAt(si, colorTmp);
      }
    }
    if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate = true;
    this.chips.burst(240, c.clone().setY(1.1));
    const ctx = this.ctx;
    if (ctx) ctx.targets.forEach((en) => ctx.hit(en, { damage: this.settings.damage, knock: 4, from: c, color: '#a8e4f0' }));
  }
}

export const auroraVeilModule: EffectModule = {
  label: 'aurora veil',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new AuroraVeil(),
  telegraphs(effect) {
    const e = effect as AuroraVeil;
    const c = e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: RADIUS }, start: 0.5, impact: e.settings.impactTime }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as AuroraVeil;
    if (e.ctx) frameCast(camera, controls, e.ctx, 8);
  },
  buildGui(f, effect) {
    const s = (effect as AuroraVeil).settings;
    f.add(s, 'loop');
    f.add(s, 'impactTime', 1.6, 4, 0.05).name('impact time');
    f.add(s, 'damage', 1, 150, 1);
  },
};
