import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Stained Glass Sanctum (targeted, ground AoE, radius 5): a floor rose fades in under the area and eight tall gothic
 * windows (pointed arch, black lead lines, a rose and a diamond lattice of coloured panes, drawn on canvas) rise in a
 * ring, facing inward. The two windows nearest the caster stand low and see-through so the scene stays readable.
 * Thin coloured light shafts pour through every window onto the middle, coloured patches of the glass dance on the
 * ground, two small ticks hit. Cracks spread over the panes, a dead beat, then every window shatters inward into a
 * rain of coloured flat shards (and falling lead frames) with short amber impact frames; the shards land, twinkle and
 * fade. Abstract patterns only. Recipes: f-beyondfx-sunrise-pillar-strike (light from above, held hang),
 * i-acheron-crack-web-shatter-finisher (cracks, dead beat, shatter), c-ue4-energy-shield-dome (a ring of panes).
 */
export interface StainedGlassSanctumSettings {
  impactTime: number;
  damage: number;
  loop: boolean;
}

export const defaultStainedGlassSanctum = (): StainedGlassSanctumSettings => ({ impactTime: 2.1, damage: 55, loop: false });

const AFTERMATH = 2.5;
const WINDOWS = 8;
const PER_WINDOW = 30;
const SHARDS = WINDOWS * PER_WINDOW;
const BARS_PER = 3;
const BARS = WINDOWS * BARS_PER;
const RING_R = 5.2;
const WIN_W = 2.0;
const WIN_H = 3.5;
const FRONT_SCALE = 0.55;
const RISE = 0.3;
const STAGGER = 0.06;
const GRAVITY = 20;
const MIN_SCALE = 1e-4;

// Glass colours: normal-blended mid tones, kept below the bloom threshold.
const RUBY = 0xc02844;
const SAPPHIRE = 0x2a5ac8;
const EMERALD = 0x2a9c5c;
const AMBER = 0xd89a30;
const AMBER_HOT = 0xffc85a;
const LEAD = 0x0c0a0c;
const VARIANTS = [
  { main: RUBY, accents: [AMBER, SAPPHIRE], shaft: 0xd02a4a },
  { main: SAPPHIRE, accents: [AMBER, RUBY], shaft: 0x2a5ad0 },
  { main: EMERALD, accents: [AMBER, RUBY], shaft: 0x2aa060 },
];

const TEX_W = 288;
const TEX_H = 512;

const css = (hex: number, mixWhite = 0) => new THREE.Color(hex).lerp(new THREE.Color(1, 1, 1), mixWhite).getStyle();

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function archPath(g: CanvasRenderingContext2D) {
  const cx = TEX_W / 2;
  g.beginPath();
  g.moveTo(12, TEX_H - 6);
  g.lineTo(12, 300);
  g.quadraticCurveTo(12, 110, cx, 8);
  g.quadraticCurveTo(TEX_W - 12, 110, TEX_W - 12, 300);
  g.lineTo(TEX_W - 12, TEX_H - 6);
  g.closePath();
}

/** One lancet window: lead tracery, a rose at the top, a diamond lattice below, no figures. */
function windowTexture(variant: number): THREE.CanvasTexture {
  const v = VARIANTS[variant];
  const rnd = seeded(11 + variant * 977);
  const pick = () => {
    const r = rnd();
    return r < 0.5 ? v.main : r < 0.75 ? v.accents[0] : v.accents[1];
  };
  const cv = document.createElement('canvas');
  cv.width = TEX_W;
  cv.height = TEX_H;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const cx = TEX_W / 2;
  const lead = css(LEAD);

  g.save();
  archPath(g);
  g.clip();
  g.fillStyle = css(new THREE.Color(v.main).multiplyScalar(0.45).getHex());
  g.fillRect(0, 0, TEX_W, TEX_H);

  // Panes: a gradient fill (lighter at the top) with a black lead line around each.
  const pane = (path: () => void, hex: number) => {
    path();
    const gr = g.createLinearGradient(0, 0, 0, TEX_H);
    gr.addColorStop(0, css(hex, 0.16));
    gr.addColorStop(1, css(hex, 0));
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = lead;
    g.lineWidth = 7;
    g.stroke();
  };

  // Diamond lattice below the rose.
  for (let j = 0; j < 8; j++) {
    for (let i = -1; i < 6; i++) {
      const x = i * 64 + (j % 2) * 32 + 16;
      const y = 262 + j * 40;
      pane(() => {
        g.beginPath();
        g.moveTo(x, y - 40);
        g.lineTo(x + 32, y);
        g.lineTo(x, y + 40);
        g.lineTo(x - 32, y);
        g.closePath();
      }, pick());
    }
  }

  // Rose: eight wedges, a ring and a hub.
  const roseY = 150;
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
    pane(() => {
      g.beginPath();
      g.moveTo(cx, roseY);
      g.arc(cx, roseY, 72, a0, a1);
      g.closePath();
    }, k % 2 === 0 ? v.main : v.accents[0]);
  }
  pane(() => { g.beginPath(); g.arc(cx, roseY, 44, 0, Math.PI * 2); }, v.accents[1]);
  pane(() => { g.beginPath(); g.arc(cx, roseY, 22, 0, Math.PI * 2); }, AMBER);
  g.strokeStyle = lead;
  g.lineWidth = 10;
  g.beginPath();
  g.arc(cx, roseY, 72, 0, Math.PI * 2);
  g.stroke();

  // Small round panes in the corners beside the rose, then a centre mullion.
  for (const [x, y, r] of [[58, 110, 16], [TEX_W - 58, 110, 16], [52, 220, 14], [TEX_W - 52, 220, 14], [cx, 52, 13]]) {
    pane(() => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); }, rnd() < 0.5 ? AMBER : v.accents[1]);
  }
  g.strokeStyle = lead;
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(cx, roseY + 72);
  g.lineTo(cx, TEX_H);
  g.stroke();
  g.restore();

  // Black arch outline with a thin dark-gold line just inside it.
  g.strokeStyle = lead;
  g.lineWidth = 18;
  archPath(g);
  g.stroke();
  g.save();
  g.translate(cx, TEX_H / 2);
  g.scale(0.955, 0.965);
  g.translate(-cx, -TEX_H / 2);
  g.strokeStyle = '#8a6a22';
  g.lineWidth = 3;
  archPath(g);
  g.stroke();
  g.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Cracks over a window: black jagged lines with a hair of amber, clipped to the arch. */
function crackTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = TEX_W;
  cv.height = TEX_H;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const rnd = seeded(5);
  const lines: number[][][] = [];
  for (const [ox, oy] of [[TEX_W / 2, 170], [90, 380], [200, 330]]) {
    for (let k = 0; k < 6; k++) {
      let a = (k / 6) * Math.PI * 2 + rnd() * 0.8;
      let x = ox, y = oy;
      const pts: number[][] = [[x, y]];
      const n = 4 + Math.floor(rnd() * 4);
      for (let s = 0; s < n; s++) {
        a += (rnd() - 0.5) * 0.9;
        const len = 22 + rnd() * 30;
        x += Math.cos(a) * len;
        y += Math.sin(a) * len;
        pts.push([x, y]);
      }
      lines.push(pts);
    }
  }
  g.save();
  archPath(g);
  g.clip();
  const draw = (w: number, col: string) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    for (const pts of lines) {
      g.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.stroke();
    }
  };
  draw(8, css(LEAD));
  draw(2.5, css(AMBER_HOT));
  g.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Floor rose: a dim disc with gold rings, an eight-point star and spokes, black-edged. */
function floorTexture(): THREE.CanvasTexture {
  const S = 512, c = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.fillStyle = 'rgba(12,10,12,0.5)';
  g.beginPath();
  g.arc(c, c, 248, 0, Math.PI * 2);
  g.fill();
  const stroke = (w: number, col: string, path: () => void) => {
    path();
    g.strokeStyle = col;
    g.lineWidth = w;
    g.stroke();
  };
  const rings = () => { for (const r of [244, 196, 120]) { g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); } };
  const star = () => {
    g.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, r = k % 2 === 0 ? 196 : 92;
      const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
      if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  };
  const spokes = () => { for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * 120, c + Math.sin(a) * 120); g.lineTo(c + Math.cos(a) * 244, c + Math.sin(a) * 244); g.stroke(); } };
  stroke(12, css(LEAD), rings); stroke(12, css(LEAD), star); stroke(10, css(LEAD), spokes);
  stroke(4, '#a8842e', rings); stroke(4, '#a8842e', star); stroke(3, '#a8842e', spokes);
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    g.fillStyle = css(k % 2 ? RUBY : SAPPHIRE);
    g.strokeStyle = css(LEAD);
    g.lineWidth = 5;
    g.beginPath();
    g.arc(c + Math.cos(a) * 158, c + Math.sin(a) * 158, 13, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Flat triangle shard (thin, double-sided via the material). */
function shardGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.5);
  s.lineTo(-0.34, -0.34);
  s.lineTo(0.4, -0.22);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

interface Win {
  group: THREE.Group;
  glass: THREE.Mesh;
  glassMat: THREE.MeshBasicMaterial;
  crackMat: THREE.MeshBasicMaterial;
  patch: THREE.Mesh;
  patchMat: THREE.MeshBasicMaterial;
  shaft: THREE.Mesh;
  shaftMat: THREE.MeshBasicMaterial;
  shaftGeo: THREE.BufferGeometry;
  variant: number;
  theta: number;
  front: boolean;
  start: number;
  landed: boolean;
}

interface Piece { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; size: number; life: number; landed: boolean; live: boolean; yaw: number }

const newPiece = (): Piece => ({
  p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), size: 0.5, life: 1, landed: false, live: false, yaw: 0,
});

export class StainedGlassSanctum implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StainedGlassSanctumSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private ticks = 0;
  private shattered = false;
  private smokeDone = false;
  private moteTimer = 0;
  private center = new THREE.Vector3();

  private wins: Win[] = [];
  private floorMat = new THREE.MeshBasicMaterial({ map: floorTexture(), transparent: true, depthWrite: false, opacity: 0 });
  private floor = new THREE.Mesh(new THREE.PlaneGeometry((RING_R + 0.7) * 2, (RING_R + 0.7) * 2), this.floorMat);
  private shock = createRing(AMBER_HOT, 0.92, 1, 96);
  private hubGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: AMBER_HOT, core: 0xfff8e8, additive: false });
  private star = new StarBurst({ points: 10, color: AMBER, core: AMBER_HOT, additive: false });
  private accentStar = new StarBurst({ points: 10, color: RUBY, core: RUBY, additive: false });
  private twinkles: StarBurst[] = [];
  private smoke = new SmokeBall({ color: LEAD, rim: 0x2a1a2e, flake: 0x2a1a2e, maxBalls: 3 });

  private shardMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  private shards = new THREE.InstancedMesh(shardGeometry(), this.shardMat, SHARDS);
  private shardState: Piece[] = Array.from({ length: SHARDS }, newPiece);
  private barMat = new THREE.MeshStandardMaterial({ color: 0x1a1620, roughness: 0.8, metalness: 0.3 });
  private bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 1, 0.12), this.barMat, BARS);
  private barState: Piece[] = Array.from({ length: BARS }, newPiece);
  private barLen: number[] = Array.from({ length: BARS }, () => 1.5);

  private motes: Emitter;
  private chips: Emitter;

  constructor(settings: StainedGlassSanctumSettings = defaultStainedGlassSanctum()) {
    this.settings = settings;
    this.screen.tint.set(0x1c1230);
    this.screen.impactColor.set(AMBER_HOT);
    this.screen.speedLineColor.set(AMBER_HOT);
    this.screen.edgeTint.set(0xd02a4a);
    this.shards.frustumCulled = false;
    this.bars.frustumCulled = false;

    const glassGeo = new THREE.PlaneGeometry(WIN_W, WIN_H).translate(0, WIN_H / 2, 0);
    const patchGeo = new THREE.PlaneGeometry(WIN_W * 0.62, WIN_H * 0.62);
    const textures = [0, 1, 2].map(windowTexture);
    const crackTex = crackTexture();
    for (let i = 0; i < WINDOWS; i++) {
      const variant = i % 3;
      const group = new THREE.Group();
      group.rotation.order = 'YXZ';
      const glassMat = new THREE.MeshBasicMaterial({ map: textures[variant], transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const crackMat = new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      const crack = new THREE.Mesh(glassGeo, crackMat);
      crack.position.z = 0.02;
      group.add(glass, crack);
      group.visible = false;

      const patchMat = new THREE.MeshBasicMaterial({ map: textures[variant], transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 });
      const patch = new THREE.Mesh(patchGeo, patchMat);
      patch.visible = false;

      // A thin light shaft: a quad from the window to the middle, bright at the top, additive.
      const shaftGeo = new THREE.BufferGeometry();
      shaftGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
      shaftGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 1, 1, 1, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12]), 3));
      shaftGeo.setIndex([0, 1, 2, 0, 2, 3]);
      const shaftMat = new THREE.MeshBasicMaterial({
        color: VARIANTS[variant].shaft, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);
      shaft.frustumCulled = false;
      shaft.visible = false;

      this.group.add(group, patch, shaft);
      this.wins.push({
        group, glass, glassMat, crackMat, patch, patchMat, shaft, shaftMat, shaftGeo, variant,
        theta: 0, front: false, start: 0.05 + i * STAGGER, landed: false,
      });
    }

    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0.03;
    this.shock.mesh.position.y = 0.07;
    this.group.add(this.floor, this.shock.mesh, this.shards, this.bars);
    this.group.add(this.hubGlint.mesh, this.star.mesh, this.accentStar.mesh, this.smoke.mesh);
    const twinkleColors = [AMBER_HOT, RUBY, SAPPHIRE, EMERALD, AMBER_HOT, RUBY, SAPPHIRE, EMERALD];
    for (const col of twinkleColors) {
      const s = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: col, core: col, additive: false });
      this.twinkles.push(s);
      this.group.add(s.mesh);
    }

    // Sparse amber motes drifting up through the light, and coloured chips thrown by the shatter.
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 120, rate: 0, lifetime: 1.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.2, speed: 0.6, speedJitter: 0.6, spread: 40, gravity: -0.5, drag: 1,
      sizeStart: 0.12, sizeEnd: 0.03, colorStart: '#ffc85a', colorEnd: '#d02a4a',
      opacityStart: 0.7, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.chips = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 8, speedJitter: 0.6, spread: 110, gravity: 12, drag: 1.4,
      sizeStart: 0.16, sizeEnd: 0.05, colorStart: '#d89a30', colorEnd: '#2a5ac8',
      opacityStart: 0.95, opacityEnd: 0, additive: false, colorMid: '#c02844', sizeJitter: 0.4, erosion: 0, spin: 0.6,
    });
    this.emitters.push(this.motes, this.chips, this.smoke.emitter);
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
    // Direction from the middle toward the caster: the windows near it stay low and see-through.
    const toCaster = Math.atan2(ctx.from.x - c.x, ctx.from.z - c.z);
    const base = Number.isFinite(toCaster) ? toCaster + Math.PI / WINDOWS : 0;
    const order = this.wins.map((w, i) => ({ i, cos: 0, w }));
    this.wins.forEach((w, i) => {
      w.theta = base + (i * Math.PI * 2) / WINDOWS;
      w.front = Math.cos(w.theta - toCaster) > 0.7;
      w.glassMat.opacity = w.front ? 0.3 : 1;
      w.group.scale.y = w.front ? FRONT_SCALE : 1;
      order[i].cos = Math.cos(w.theta - toCaster);
    });
    // Far windows rise first.
    order.sort((a, b) => a.cos - b.cos).forEach((o, rank) => { o.w.start = 0.05 + rank * STAGGER; });

    // Shaft quads are static for the cast: window top to the middle of the floor.
    for (const w of this.wins) {
      const dx = Math.sin(w.theta), dz = Math.cos(w.theta);
      const tx = Math.cos(w.theta), tz = -Math.sin(w.theta);
      const srcY = WIN_H * (w.front ? FRONT_SCALE : 1) * 0.78;
      const top = new THREE.Vector3(c.x + dx * (RING_R - 0.15), srcY, c.z + dz * (RING_R - 0.15));
      const bot = new THREE.Vector3(c.x + dx * 0.4, 0.12, c.z + dz * 0.4);
      const pos = w.shaftGeo.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, top.x - tx * 0.45, top.y, top.z - tz * 0.45);
      pos.setXYZ(1, top.x + tx * 0.45, top.y, top.z + tz * 0.45);
      pos.setXYZ(2, bot.x + tx * 0.18, bot.y, bot.z + tz * 0.18);
      pos.setXYZ(3, bot.x - tx * 0.18, bot.y, bot.z - tz * 0.18);
      pos.needsUpdate = true;
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(c).setY(1.3);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.ticks = 0;
    this.shattered = false;
    this.smokeDone = false;
    this.moteTimer = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const s of this.shardState) { s.p.set(0, -50, 0); s.live = false; s.landed = false; }
    for (const s of this.barState) { s.p.set(0, -50, 0); s.live = false; s.landed = false; }
    for (const w of this.wins) w.landed = false;
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
    if (this.ticks < 1 && this.time >= 1.1) this.onTick(1);
    if (this.ticks < 2 && this.time >= 1.6) this.onTick(2);
    if (!this.shattered && this.time >= D) this.onShatter();
    if (!this.smokeDone && this.shattered && this.time >= D + 0.12) {
      this.smokeDone = true;
      this.smoke.hold = 0.2;
      this.smoke.trigger(this.center.clone().setY(0.9), 0.9, 0.6);
    }
    if (!this.shattered && this.time > 0.9 && this.time < D - 0.2) {
      this.moteTimer -= dt;
      if (this.moteTimer <= 0) {
        this.moteTimer = 0.14;
        const a = Math.random() * Math.PI * 2, r = Math.random() * 3.5;
        this.motes.burst(1, new THREE.Vector3(this.center.x + Math.cos(a) * r, 0.2, this.center.z + Math.sin(a) * r));
      }
    }
    this.layout(dt);
  }

  private layout(dt: number) {
    const D = this.settings.impactTime;
    const t = this.time;
    const after = t - D;
    const c = this.center;
    const focus = c.clone().setY(1.3);
    const hide = new THREE.Vector3(0, -50, 0);

    // 1. World darkens during the build and the hold, lets go after the shatter.
    this.screen.darken = after < 0 ? 0.75 * smoothstep(t / 0.6) : 0.75 * Math.exp(-Math.max(0, after - 0.15) * 3);

    // 2. Floor rose.
    const floorIn = smoothstep((t - 0.05) / 0.5);
    this.floor.position.set(c.x, 0.03, c.z);
    this.floor.rotation.z = t * 0.12;
    this.floorMat.opacity = after < 0 ? 0.85 * floorIn : 0.85 * (1 - smoothstep(after / (AFTERMATH - 0.3)));
    this.floor.visible = this.floorMat.opacity > 0.01;

    // 3. Windows rise (easeOutBack), flicker a little in the hold, lean in on the implode; cracks 1.8 -> D.
    const imp = smoothstep((t - (D - 0.3)) / 0.25);
    const crackIn = smoothstep((t - 1.8) / 0.25);
    let shake = 0;
    this.wins.forEach((w, i) => {
      const s = THREE.MathUtils.clamp((t - w.start) / RISE, 0, 1);
      const k = s - 1;
      const f = 1 + 2.9 * k * k * k + 1.9 * k * k;
      w.group.visible = t >= w.start && !this.shattered;
      const dx = Math.sin(w.theta), dz = Math.cos(w.theta);
      w.group.position.set(c.x + dx * RING_R, -(WIN_H + 0.2) * (1 - f), c.z + dz * RING_R);
      w.group.rotation.set(imp * 0.18, w.theta + Math.PI, 0);
      const flick = t > 0.9 && after < 0 ? 0.08 * Math.sin(t * 17 + i * 2.3) : 0;
      const lum = 1 + flick + 0.1 * imp;
      w.glassMat.color.setRGB(lum, lum, lum);
      w.crackMat.opacity = after < 0 ? (w.front ? 0.6 : 1) * crackIn : 0;
      const landed = t - (w.start + RISE);
      if (landed > 0 && after < 0) shake = Math.max(shake, 0.12 * Math.exp(-landed * 12));

      // Light shaft: thin, additive, flickers out in the dead beat (1.8 -> D).
      const shaftOn = smoothstep((t - 0.8) / 0.3) * (1 - smoothstep((t - 1.8) / 0.12));
      w.shaftMat.opacity = after < 0 ? 0.22 * shaftOn * (0.88 + 0.12 * Math.sin(t * 23 + i * 1.7)) : 0;
      w.shaft.visible = w.shaftMat.opacity > 0.004;

      // Coloured patch of the glass lying on the floor, drifting.
      const pr = 1.7 + 0.5 * Math.sin(t * 1.7 + i * 1.3);
      const pOn = smoothstep((t - 0.8) / 0.3) * (1 - smoothstep((t - 1.8) / 0.12));
      w.patch.rotation.set(-Math.PI / 2, 0, w.theta + 0.3 * Math.sin(t * 1.3 + i));
      w.patch.position.set(c.x + dx * pr, 0.05 + i * 0.002, c.z + dz * pr);
      w.patchMat.opacity = after < 0 ? 0.3 * pOn : 0;
      w.patch.visible = w.patchMat.opacity > 0.01;
    });

    // 4. Hub glint at the middle: a small coloured-amber core that grows during the hold.
    const hub = t > 0.9 && after < 0 ? smoothstep((t - 0.9) / 0.9) * (1 - 0.8 * smoothstep((t - 1.8) / 0.1)) : 0;
    this.hubGlint.set(new THREE.Vector3(c.x, 0.5, c.z), 0.9 * hub, hub > 0 ? 0.85 : 0, t * 0.8);

    // 5. Focus lines on the implode, short amber impact frames and chroma on the shatter.
    this.screen.speedLines = after < 0 ? 0.7 * imp : Math.max(0, 0.7 - after * 6);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D, 0.9, 10);

    // 6. Shards: fly to the middle, burst, fall, land flat, shrink away.
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const e = new THREE.Euler();
    const damp = dt > 0 && after > 0.35 ? Math.max(0, 1 - 3 * dt) : 1;
    const step = (sh: Piece) => {
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
    };
    for (let i = 0; i < SHARDS; i++) {
      const sh = this.shardState[i];
      step(sh);
      const kf = sh.live ? 1 - smoothstep((after - sh.life) / 0.4) : 0;
      if (kf < 0.02) m.compose(hide, q.identity(), sc.setScalar(MIN_SCALE));
      else m.compose(sh.p, q.setFromEuler(sh.r), sc.setScalar(Math.max(MIN_SCALE, sh.size * kf)));
      this.shards.setMatrixAt(i, m);
    }
    this.shards.instanceMatrix.needsUpdate = true;
    this.shards.visible = this.shattered;
    for (let i = 0; i < BARS; i++) {
      const sh = this.barState[i];
      step(sh);
      const kf = sh.live ? 1 - smoothstep((after - sh.life) / 0.4) : 0;
      if (kf < 0.02) m.compose(hide, q.identity(), sc.setScalar(MIN_SCALE));
      else {
        const len = this.barLen[i];
        // Lit instance: never a zero scale on any axis.
        m.compose(sh.p, q.setFromEuler(e.copy(sh.r)), sc.set(Math.max(MIN_SCALE, kf), Math.max(MIN_SCALE, len * kf), Math.max(MIN_SCALE, kf)));
      }
      this.bars.setMatrixAt(i, m);
    }
    this.bars.instanceMatrix.needsUpdate = true;
    this.bars.visible = this.shattered;

    // 7. Burst: hard amber star with a ruby accent behind it, a thin shock ring.
    const pop = StarBurst.pop(after - 0.08, 0.1, 0.16);
    this.star.set(focus, 4.2 * pop.scale, pop.opacity, 0.2);
    const apop = StarBurst.pop(after - 0.08, 0.02, 0.04);
    this.accentStar.set(focus, 5.2 * apop.scale, apop.opacity, 0.45);
    this.shock.mesh.position.set(c.x, 0.08, c.z);
    this.shock.mesh.scale.setScalar(1 + Math.max(0, after) * 18);
    this.shock.material.opacity = after > 0 ? Math.max(0, 0.6 * (1 - after / 0.45)) : 0;

    // 8. Twinkles on landed shards while they lie there (coloured, not white).
    this.twinkles.forEach((gl, k) => {
      const sh = this.shardState[(k * 29 + 5) % SHARDS];
      const cyc = (t * 1.3 + k * 0.37) % 1;
      const gp = StarBurst.pop(cyc * 0.5, 0.05, 0.14);
      if (!sh.landed || after < 0.8 || after > 2.1) { gl.set(hide, 0, 0); return; }
      gl.set(new THREE.Vector3(sh.p.x, sh.p.y + 0.2, sh.p.z), 0.6 * gp.scale, gp.opacity, k);
    });

    this.shake = after >= 0 ? 0.8 * Math.exp(-after * 6) : shake;
  }

  private onTick(n: number) {
    this.ticks = n;
    const ctx = this.ctx;
    if (ctx) ctx.targets.forEach((en) => ctx.hit(en, { damage: 5, knock: 0, from: this.center, color: '#ffc85a' }));
  }

  private onShatter() {
    this.shattered = true;
    const c = this.center;
    const colorTmp = new THREE.Color();
    let si = 0, bi = 0;
    for (const w of this.wins) {
      const v = VARIANTS[w.variant];
      const dx = Math.sin(w.theta), dz = Math.cos(w.theta);
      const tx = Math.cos(w.theta), tz = -Math.sin(w.theta);
      const h = WIN_H * (w.front ? FRONT_SCALE : 1);
      for (let k = 0; k < PER_WINDOW; k++, si++) {
        const sh = this.shardState[si];
        const u = (Math.random() - 0.5) * WIN_W * 0.8;
        sh.p.set(c.x + dx * RING_R + tx * u, 0.3 + Math.random() * h * 0.9, c.z + dz * RING_R + tz * u);
        // Fly to a spot near the middle, reaching it after T seconds, then fall.
        const T = 0.35 + Math.random() * 0.15;
        const ta = Math.random() * Math.PI * 2, tr = Math.random() * 1.4;
        const tx2 = c.x + Math.cos(ta) * tr, tz2 = c.z + Math.sin(ta) * tr, ty = 0.8 + Math.random() * 1.4;
        sh.v.set((tx2 - sh.p.x) / T, (ty - sh.p.y) / T + 0.5 * GRAVITY * T, (tz2 - sh.p.z) / T);
        sh.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
        sh.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        sh.size = 0.35 + Math.random() * 0.5 + (k % 6 === 0 ? 0.25 : 0);
        sh.life = 1.4 + Math.random() * 0.5;
        sh.yaw = Math.random() * Math.PI * 2;
        sh.landed = false;
        sh.live = true;
        const r = Math.random();
        colorTmp.set(r < 0.55 ? v.main : r < 0.8 ? v.accents[0] : v.accents[1]);
        this.shards.setColorAt(si, colorTmp);
      }
      // Lead frame: two side bars and a cross bar drop straight down, tipping inward.
      for (let k = 0; k < BARS_PER; k++, bi++) {
        const b = this.barState[bi];
        const side = k === 0 ? -1 : k === 1 ? 1 : 0;
        b.p.set(c.x + dx * RING_R + tx * side * (WIN_W / 2 - 0.1), h * (k === 2 ? 0.55 : 0.45), c.z + dz * RING_R + tz * side * (WIN_W / 2 - 0.1));
        this.barLen[bi] = k === 2 ? WIN_W * 0.9 : h * 0.8;
        b.v.set(-dx * 1.2, 1 + Math.random() * 2, -dz * 1.2);
        b.w.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4);
        b.r.set(0, w.theta, k === 2 ? Math.PI / 2 : 0);
        b.size = 1;
        b.life = 1.5 + Math.random() * 0.4;
        b.yaw = w.theta;
        b.landed = false;
        b.live = true;
      }
    }
    if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate = true;
    this.chips.burst(260, c.clone().setY(1.1));
    const ctx = this.ctx;
    if (ctx) ctx.targets.forEach((en) => ctx.hit(en, { damage: this.settings.damage, knock: 4, from: c, color: '#ffc85a' }));
  }
}

export const stainedGlassSanctumModule: EffectModule = {
  label: 'stained glass sanctum',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 5 },
  create: () => new StainedGlassSanctum(),
  telegraphs(effect) {
    const e = effect as StainedGlassSanctum;
    const c = e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 5 }, start: 0.4, impact: e.settings.impactTime }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as StainedGlassSanctum;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as StainedGlassSanctum).settings;
    f.add(s, 'loop');
    f.add(s, 'impactTime', 1.6, 4, 0.05).name('impact time');
    f.add(s, 'damage', 1, 150, 1);
  },
};
