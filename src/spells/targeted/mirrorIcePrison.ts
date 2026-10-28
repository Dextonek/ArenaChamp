import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  LightningArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Mirror Ice Prison (targeted, single enemy, frost row of the art bible): frost cracks spread under the chosen
 * enemy, then six tall faceted panels of mirror ice punch up around it one after another (a hexagonal cell with a
 * vertex toward the camera). Thin light beams bounce from panel to panel inside, the panels tilt in and close, a
 * dead beat, then the whole prison shatters into big flat ice shards that land, twinkle out and leave a frost
 * ring. Recipes: i-frost-pillar-snow-dome-rubble (ice structure rising with snow), g-hiyuki-frozen-orb-shatter-
 * finisher (hold, impact frames, shatter), j-abitofgamedev-refraction-bubble (bright line where it meets the floor).
 */
export interface MirrorIcePrisonSettings {
  impactTime: number;
  damage: number;
  loop: boolean;
}

export const defaultMirrorIcePrison = (): MirrorIcePrisonSettings => ({ impactTime: 2.2, damage: 55, loop: false });

const AFTERMATH = 2.0;
const PANELS = 6;
const PER_PANEL = 12;
const SHARDS = PANELS * PER_PANEL;
const BEAMS = 9;
const GLINTS = 8;
const PANEL_W = 2.0;
const PANEL_H = 2.8;
const APOTHEM = (PANEL_W / 2) * Math.sqrt(3);
const RISE = 0.25;
const BUILD = 0.5;
const STAGGER = 0.06;
const MIN_SCALE = 1e-4;

const ICE_CORE = 0xf4fbff;
const ICE_HOT = 0xbfe8ff;
const ICE_BODY = 0x5ab8f0;
const ICE_ACCENT = 0x8a7cff;
const ICE_DARK = 0x0e1f3a;

/** Crystal slab outline in 0..1 (u across, v up): a pointed, slightly lopsided top. */
const OUTLINE: [number, number][] = [[0, 0], [1, 0], [1, 0.78], [0.56, 1], [0, 0.84]];
const TEX_W = 256;
const TEX_H = 352;
const MARGIN = 10;

function outlinePx(u: number, v: number): [number, number] {
  return [MARGIN + u * (TEX_W - 2 * MARGIN), TEX_H - (MARGIN + v * (TEX_H - 2 * MARGIN))];
}

/** Hard-edged mirror-ice face: banded blue body, diagonal mirror glints, fracture lines, black outline, white bevel. */
function mirrorTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = TEX_W;
  cv.height = TEX_H;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const path = (scale = 1) => {
    const cx = TEX_W / 2, cy = TEX_H / 2;
    g.beginPath();
    OUTLINE.forEach(([u, v], i) => {
      const [x, y] = outlinePx(u, v);
      const px = cx + (x - cx) * scale, py = cy + (y - cy) * scale;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.closePath();
  };

  g.save();
  path();
  g.clip();
  // Value ramp in three flat bands (dark at the foot, brighter toward the tip), semi-see-through so the enemy shows.
  const bands: [number, string][] = [[0, '#0e1f3a'], [0.34, '#1b3d7a'], [0.62, '#2d62b0'], [0.86, '#4f93d8']];
  g.globalAlpha = 0.62;
  for (const [v, col] of bands) {
    g.fillStyle = col;
    g.fillRect(0, 0, TEX_W, TEX_H - (MARGIN + v * (TEX_H - 2 * MARGIN)));
  }
  g.globalAlpha = 1;
  // Mirror glints: hard diagonal parallelograms, one thick, one medium, one hairline.
  const glint = (x: number, w: number, col: string, a: number) => {
    g.globalAlpha = a;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x, TEX_H);
    g.lineTo(x + w, TEX_H);
    g.lineTo(x + w + 150, 0);
    g.lineTo(x + 150, 0);
    g.closePath();
    g.fill();
  };
  glint(30, 46, '#bfe8ff', 0.85);
  glint(112, 18, '#bfe8ff', 0.9);
  glint(150, 5, '#f4fbff', 1);
  glint(-40, 20, '#5ab8f0', 0.8);
  g.globalAlpha = 1;
  // Fracture lines from the corners.
  g.strokeStyle = '#0e1f3a';
  g.lineWidth = 4;
  for (const seg of [[[0, 0.84], [0.45, 0.5], [0.3, 0.2]], [[1, 0.78], [0.62, 0.45], [0.8, 0.1]], [[0.56, 1], [0.5, 0.7]]]) {
    g.beginPath();
    seg.forEach(([u, v], i) => {
      const [x, y] = outlinePx(u, v);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
  }
  g.restore();
  // Black outline, then a thin white bevel just inside it.
  g.strokeStyle = '#05080f';
  g.lineWidth = 11;
  path();
  g.stroke();
  g.strokeStyle = '#f4fbff';
  g.lineWidth = 3;
  path(0.955);
  g.stroke();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Ground frost patch: a navy disc with hard white cracks (black-edged) radiating from the centre. */
function crackTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 512;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const c = 256;
  g.fillStyle = 'rgba(14,31,58,0.5)';
  g.beginPath();
  g.arc(c, c, 236, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#bfe8ff';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(c, c, 232, 0, Math.PI * 2);
  g.stroke();
  // Deterministic jagged cracks.
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const cracks: number[][][] = [];
  for (let k = 0; k < 11; k++) {
    let a = (k / 11) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
    let r = 20;
    const pts: number[][] = [[c + Math.cos(a) * r, c + Math.sin(a) * r]];
    const len = 130 + rnd() * 90;
    while (r < len) {
      r += 22 + rnd() * 26;
      a += (rnd() - 0.5) * 0.5;
      pts.push([c + Math.cos(a) * r, c + Math.sin(a) * r]);
    }
    cracks.push(pts);
  }
  const draw = (w: number, col: string) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    for (const pts of cracks) {
      g.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.stroke();
    }
  };
  draw(11, '#05080f');
  draw(5, '#e8f6ff');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Flat dagger shard with a value ramp (bright tips, dark blue body), flat shaded. Origin at the centre. */
function shardGeometry(): THREE.BufferGeometry {
  const geo = new THREE.OctahedronGeometry(1, 0).toNonIndexed();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const tip = new THREE.Color(0xdff4ff), light = new THREE.Color(0x2d62b0), dark = new THREE.Color(0x14305f);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * 0.45;
    let y = pos.getY(i);
    const z = pos.getZ(i) * 0.16;
    if (y < 0) y *= 0.55; // a dagger, not a diamond
    pos.setXYZ(i, x, y, z);
    const col = Math.abs(y) > 0.5 ? tip : x > 0 ? light : dark;
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function slabGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  OUTLINE.forEach(([u, v], i) => {
    const x = (u - 0.5) * PANEL_W, y = v * PANEL_H;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 });
  geo.translate(0, 0, -0.11);
  return geo;
}

interface Panel {
  group: THREE.Group;
  slabMat: THREE.MeshStandardMaterial;
  mirrorMat: THREE.MeshBasicMaterial;
  edgeMat: THREE.LineBasicMaterial;
  theta: number;
  start: number;
  front: boolean;
  puffed: boolean;
}

interface Shard { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; size: number; life: number; landed: boolean; live: boolean }

export class MirrorIcePrison implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MirrorIcePrisonSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private hit1 = false;
  private shattered = false;
  private smokeDone = false;
  private center = new THREE.Vector3();
  private beamTimer = 0;
  private beamEnds: { a: number; b: number; ya: number; yb: number; ta: number; tb: number; on: boolean }[] =
    Array.from({ length: BEAMS }, () => ({ a: 0, b: 0, ya: 1, yb: 1, ta: 0, tb: 0, on: false }));

  private panels: Panel[] = [];
  private beams: LightningArc[] = [];
  private glints: StarBurst[] = [];
  private footGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: ICE_HOT, core: 0xffffff, additive: false });
  private star = new StarBurst({ points: 10, color: ICE_BODY, core: 0xe8f8ff, additive: false });
  private accentStar = new StarBurst({ points: 10, color: ICE_ACCENT, core: ICE_ACCENT, additive: false });
  private smoke = new SmokeBall({ color: ICE_DARK, rim: 0x1a3358, flake: 0x1a3358, maxBalls: 4 });
  private cracks: THREE.Mesh;
  private crackMat: THREE.MeshBasicMaterial;
  private floorRing = createRing(ICE_HOT, 0.93, 1, 6);
  private shock = createRing(ICE_HOT, 0.92, 1, 96);
  private frostRing = createRing(ICE_BODY, 0.9, 1, 96);

  private shardMat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.4, metalness: 0.1, emissive: 0x1a4a9a, emissiveIntensity: 0.3,
  });
  private shards = new THREE.InstancedMesh(shardGeometry(), this.shardMat, SHARDS);
  private shardState: Shard[] = Array.from({ length: SHARDS }, () => ({
    p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), size: 0.6, life: 1, landed: false, live: false,
  }));

  private puffs: Emitter;
  private snow: Emitter;
  private sparks: Emitter;

  constructor(settings: MirrorIcePrisonSettings = defaultMirrorIcePrison()) {
    this.settings = settings;
    this.screen.tint.set(ICE_DARK);
    this.screen.impactColor.set(ICE_BODY);
    this.screen.speedLineColor.set(ICE_HOT);
    this.screen.edgeTint.set(ICE_ACCENT);
    this.shards.frustumCulled = false;

    const slab = slabGeometry();
    const edges = new THREE.EdgesGeometry(slab, 25);
    const faceW = PANEL_W * TEX_W / (TEX_W - 2 * MARGIN), faceH = PANEL_H * TEX_H / (TEX_H - 2 * MARGIN);
    const face = new THREE.PlaneGeometry(faceW, faceH);
    face.translate(0, PANEL_H / 2, 0);
    const tex = mirrorTexture();
    for (let i = 0; i < PANELS; i++) {
      const group = new THREE.Group();
      group.rotation.order = 'YXZ';
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0x1b3f7a, roughness: 0.35, metalness: 0.2, flatShading: true, emissive: 0x1a4a9a, emissiveIntensity: 0.35,
        transparent: true, opacity: 0.85,
      });
      const mirrorMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 1 });
      const edgeMat = new THREE.LineBasicMaterial({ color: ICE_CORE, transparent: true, opacity: 0.7 });
      const inner = new THREE.Mesh(face, mirrorMat);
      inner.position.z = -0.175;
      const outer = new THREE.Mesh(face, mirrorMat);
      outer.position.z = 0.175;
      group.add(new THREE.Mesh(slab, slabMat), inner, outer, new THREE.LineSegments(edges, edgeMat));
      group.visible = false;
      this.group.add(group);
      this.panels.push({ group, slabMat, mirrorMat, edgeMat, theta: 0, start: BUILD + i * STAGGER, front: false, puffed: false });
    }

    for (let i = 0; i < BEAMS; i++) {
      const arc = new LightningArc({ width: 0.09, segments: 6, jitter: 0.025, branches: 0, core: 0xffffff, glow: ICE_BODY });
      this.beams.push(arc);
      this.group.add(arc.mesh);
    }
    for (let i = 0; i < GLINTS; i++) {
      const gl = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: ICE_HOT, core: 0xffffff, additive: false });
      this.glints.push(gl);
      this.group.add(gl.mesh);
    }

    this.crackMat = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false, opacity: 0 });
    this.cracks = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), this.crackMat);
    this.cracks.rotation.x = -Math.PI / 2;
    this.cracks.position.y = 0.03;
    this.floorRing.mesh.position.y = 0.06;
    this.group.add(this.cracks, this.floorRing.mesh, this.shock.mesh, this.frostRing.mesh, this.shards);
    this.group.add(this.footGlint.mesh, this.star.mesh, this.accentStar.mesh, this.smoke.mesh);

    // Toon snow puffs at each panel base: opaque-ish, normal blended.
    this.puffs = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 0.7, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 2.6, speedJitter: 0.6, spread: 75, gravity: -0.2, drag: 2,
      sizeStart: 0.45, sizeEnd: 1.0, colorStart: '#f4fbff', colorEnd: '#9fc8ea',
      opacityStart: 0.85, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.45, spin: 0.4,
    });
    this.snow = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 2.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 3, speed: 0.6, speedJitter: 0.6, spread: 180, gravity: 1.3, drag: 1.2,
      sizeStart: 0.14, sizeEnd: 0.06, colorStart: '#f4fbff', colorEnd: '#bfe8ff',
      opacityStart: 0.9, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0, spin: 0.5, groundFade: 0.3,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 9, speedJitter: 0.6, spread: 110, gravity: 9, drag: 1.6,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#5ab8f0',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.puffs, this.snow, this.sparks, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return this.settings.impactTime + AFTERMATH;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    // Hexagon with a vertex toward the caster's camera; panels rise starting on the caster's side, going round.
    const base = ctx.aim + Math.PI + Math.PI / 6;
    this.panels.forEach((p, i) => {
      p.theta = base + (i * Math.PI) / 3;
      p.front = Math.cos(p.theta - (ctx.aim + Math.PI)) > 0.5;
      p.slabMat.opacity = p.front ? 0.45 : 0.85;
      p.mirrorMat.opacity = p.front ? 0.6 : 1;
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.center).setY(1.3);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hit1 = false;
    this.shattered = false;
    this.smokeDone = false;
    this.beamTimer = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const p of this.panels) p.puffed = false;
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
    if (!this.hit1 && this.time >= BUILD + (PANELS - 1) * STAGGER + RISE) this.onPrison();
    if (!this.shattered && this.time >= D) this.onShatter();
    if (!this.smokeDone && this.shattered && this.time >= D + 0.12) {
      this.smokeDone = true;
      this.smoke.hold = 0.2;
      this.smoke.trigger(this.center.clone().setY(0.9), 0.9, 0.6);
    }
    for (const b of this.beams) b.update(dt);
    this.layout(dt);
  }

  private panelDir(theta: number, out: THREE.Vector3) {
    return out.set(Math.sin(theta), 0, Math.cos(theta));
  }

  private rerollBeams() {
    for (const b of this.beamEnds) {
      b.a = Math.floor(Math.random() * PANELS);
      b.b = (b.a + 2 + Math.floor(Math.random() * 3)) % PANELS; // never the same or the adjacent panel
      b.ya = 0.5 + Math.random() * 1.9;
      b.yb = 0.5 + Math.random() * 1.9;
      b.ta = (Math.random() - 0.5) * 0.6 * PANEL_W;
      b.tb = (Math.random() - 0.5) * 0.6 * PANEL_W;
      b.on = Math.random() < 0.7;
    }
  }

  private layout(dt: number) {
    const D = this.settings.impactTime;
    const t = this.time;
    const after = t - D;
    const c = this.center;
    const focus = c.clone().setY(1.3);
    const dir = new THREE.Vector3();
    const tan = new THREE.Vector3();

    // 1. World darkens during the build and the hold, lets go after the shatter.
    this.screen.darken = after < 0 ? 0.65 * smoothstep(t / 0.5) : 0.65 * Math.exp(-Math.max(0, after - 0.15) * 3.5);

    // 2. Frost cracks spread under the enemy (0-0.5), a cold glint at its feet.
    const spread = smoothstep(t / 0.5);
    this.cracks.position.set(c.x, 0.03, c.z);
    this.cracks.scale.setScalar(0.3 + 0.7 * spread);
    this.crackMat.opacity = after < 0 ? 0.95 * smoothstep(t / 0.15) : 0.95 * (1 - smoothstep(after / 1.8));
    const fg = t > 0.05 && t < BUILD ? smoothstep((t - 0.05) / 0.3) : 0;
    this.footGlint.set(new THREE.Vector3(c.x, 0.2, c.z), 1.3 * fg, fg > 0 ? 0.95 : 0, t * 1.5);
    this.floorRing.mesh.position.x = c.x;
    this.floorRing.mesh.position.z = c.z;
    this.floorRing.mesh.scale.setScalar(APOTHEM * 1.12);
    this.floorRing.mesh.rotation.z = this.panels[0].theta;
    this.floorRing.material.opacity = t > BUILD && after < 0 ? 0.55 * smoothstep((t - BUILD) / 0.3) * (1 - 0.4 * smoothstep((t - (D - 0.3)) / 0.3)) : 0;

    // 3. Panels punch up one by one with overshoot; flicker in the hold; tilt in and close on the implode.
    const imp = smoothstep((t - (D - 0.3)) / 0.25);
    let shake = 0;
    this.panels.forEach((p, i) => {
      const s = THREE.MathUtils.clamp((t - p.start) / RISE, 0, 1);
      const k = s - 1;
      const f = 1 + 2.9 * k * k * k + 1.9 * k * k; // easeOutBack
      const live = t >= p.start && !this.shattered;
      p.group.visible = live;
      this.panelDir(p.theta, dir);
      const r = APOTHEM * (1 - 0.35 * imp);
      p.group.position.set(c.x + dir.x * r, -(PANEL_H + 0.3) * (1 - f), c.z + dir.z * r);
      p.group.rotation.set(-imp * 0.5, p.theta, 0);
      const flick = t > 1.0 && after < 0 && Math.sin(t * 38 + i * 2.1) > 0.55 ? 1 : 0;
      p.slabMat.emissiveIntensity = 0.35 + 0.3 * flick + 0.5 * imp;
      p.edgeMat.opacity = Math.min(1, 0.6 + 0.4 * flick + 0.4 * imp);
      const landed = t - (p.start + RISE);
      if (landed > 0 && !this.shattered) shake = Math.max(shake, 0.16 * Math.exp(-landed * 12));
      if (!p.puffed && t >= p.start + 0.1 && this.playing) {
        p.puffed = true;
        this.puffs.burst(22, new THREE.Vector3(c.x + dir.x * (APOTHEM + 0.2), 0.3, c.z + dir.z * (APOTHEM + 0.2)));
      }
    });

    // 4. Bounce beams between panels in the hold: re-rolled every few frames, off during the dead beat.
    if (dt > 0) {
      this.beamTimer -= dt;
      if (this.beamTimer <= 0) { this.beamTimer = 0.12 + Math.random() * 0.05; this.rerollBeams(); }
    }
    const holdOn = t > BUILD + (PANELS - 1) * STAGGER + RISE && t < D - 0.3;
    const fadeIn = smoothstep((t - 1.0) / 0.2);
    this.beams.forEach((arc, i) => {
      const e = this.beamEnds[i];
      if (!holdOn || !e.on) { arc.opacity = 0; return; }
      const pa = this.panels[e.a], pb = this.panels[e.b];
      this.panelDir(pa.theta, dir);
      tan.set(Math.cos(pa.theta), 0, -Math.sin(pa.theta));
      const A = new THREE.Vector3(c.x + dir.x * (APOTHEM - 0.15) + tan.x * e.ta, e.ya, c.z + dir.z * (APOTHEM - 0.15) + tan.z * e.ta);
      this.panelDir(pb.theta, dir);
      tan.set(Math.cos(pb.theta), 0, -Math.sin(pb.theta));
      const B = new THREE.Vector3(c.x + dir.x * (APOTHEM - 0.15) + tan.x * e.tb, e.yb, c.z + dir.z * (APOTHEM - 0.15) + tan.z * e.tb);
      arc.setEnds(A, B);
      arc.opacity = 0.75 * fadeIn;
    });

    // 5. Focus lines on the implode, impact frames (short) + chroma on the shatter.
    this.screen.speedLines = after < 0 ? 0.8 * imp : Math.max(0, 0.8 - after * 6);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D, 0.9, 10);

    // 6. Shatter: shards (instanced), shockwave ring, blue-white hard star with a violet accent, glints.
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const hide = new THREE.Vector3(0, -50, 0);
    for (let i = 0; i < SHARDS; i++) {
      const sh = this.shardState[i];
      if (dt > 0 && sh.live && !sh.landed) {
        sh.v.y -= 26 * dt;
        sh.p.addScaledVector(sh.v, dt);
        sh.r.set(sh.r.x + sh.w.x * dt, sh.r.y + sh.w.y * dt, sh.r.z + sh.w.z * dt);
        if (sh.p.y < 0.12 && sh.v.y < 0) {
          sh.p.y = 0.1 + 0.05 * sh.size;
          sh.landed = true;
          sh.v.set(0, 0, 0);
          sh.r.set(0, sh.r.y, Math.PI / 2); // lies flat, long axis horizontal
        }
      }
      const kf = sh.live ? 1 - smoothstep((after - sh.life) / 0.4) : 0;
      if (kf < 0.02) {
        m.compose(hide, q.identity(), sc.setScalar(MIN_SCALE));
      } else {
        m.compose(sh.p, q.setFromEuler(sh.r), sc.setScalar(Math.max(MIN_SCALE, sh.size * kf)));
      }
      this.shards.setMatrixAt(i, m);
    }
    this.shards.instanceMatrix.needsUpdate = true;
    this.shards.visible = this.shattered;
    this.shardMat.emissiveIntensity = 0.3 + (after > 0 ? 0.6 * Math.exp(-after * 3) : 0);

    const pop = StarBurst.pop(after - 0.08, 0.1, 0.16);
    this.star.set(focus, 4.4 * pop.scale, pop.opacity, 0.2);
    const apop = StarBurst.pop(after - 0.08, 0.02, 0.04);
    this.accentStar.set(focus, 5.4 * apop.scale, apop.opacity, 0.45);

    this.shock.mesh.position.set(c.x, 0.07, c.z);
    this.shock.mesh.scale.setScalar(1 + Math.max(0, after) * 18);
    this.shock.material.opacity = after > 0 ? Math.max(0, 0.7 * (1 - after / 0.45)) : 0;
    this.frostRing.mesh.position.set(c.x, 0.05, c.z);
    this.frostRing.mesh.scale.setScalar(APOTHEM * 1.5);
    this.frostRing.material.opacity = after > 0.2 ? 0.45 * (1 - smoothstep((after - 0.2) / (AFTERMATH - 0.2))) : 0;

    // Glints: on the panel tips during the hold, on landed shards while they twinkle out.
    this.glints.forEach((gl, k) => {
      const cyc = (t * 1.7 + k * 0.31) % 1;
      const gp = StarBurst.pop(cyc * 0.5, 0.05, 0.14);
      if (after < 0) {
        const p = this.panels[k % PANELS];
        if (k >= PANELS || !holdOn || !p.group.visible) { gl.set(hide, 0, 0); return; }
        this.panelDir(p.theta, dir);
        gl.set(new THREE.Vector3(c.x + dir.x * APOTHEM, PANEL_H * 0.92, c.z + dir.z * APOTHEM), 0.6 * gp.scale, gp.opacity, k);
      } else {
        const sh = this.shardState[(k * 9 + 2) % SHARDS];
        if (!sh.landed || after < 0.7 || after > 1.7) { gl.set(hide, 0, 0); return; }
        gl.set(new THREE.Vector3(sh.p.x, sh.p.y + 0.25, sh.p.z), 0.7 * gp.scale, gp.opacity, k);
      }
    });

    this.shake = after >= 0 ? 0.8 * Math.exp(-after * 6) : shake;
  }

  /** The last panel has landed: first hit, the prison is closed. */
  private onPrison() {
    this.hit1 = true;
    const ctx = this.ctx;
    if (ctx) ctx.targets.forEach((e) => ctx.hit(e, { damage: 10, knock: 0, from: ctx.from, color: '#bfe8ff' }));
  }

  private onShatter() {
    this.shattered = true;
    const c = this.center;
    this.rerollBeams();
    const dir = new THREE.Vector3();
    let si = 0;
    const r = APOTHEM * 0.65;
    for (const p of this.panels) {
      this.panelDir(p.theta, dir);
      const tx = Math.cos(p.theta), tz = -Math.sin(p.theta);
      for (let k = 0; k < PER_PANEL; k++, si++) {
        const sh = this.shardState[si];
        const u = (Math.random() - 0.5) * PANEL_W * 0.85;
        sh.p.set(c.x + dir.x * r + tx * u, 0.3 + Math.random() * PANEL_H * 0.85, c.z + dir.z * r + tz * u);
        const sp = 3.5 + Math.random() * 6;
        sh.v.set(dir.x * sp + tx * (Math.random() - 0.5) * 3, 3 + Math.random() * 7, dir.z * sp + tz * (Math.random() - 0.5) * 3);
        sh.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
        sh.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        sh.size = 0.5 + Math.random() * 0.55 + (k % 4 === 0 ? 0.4 : 0);
        sh.life = 1.2 + Math.random() * 0.4;
        sh.landed = false;
        sh.live = true;
      }
    }
    this.sparks.burst(220, c.clone().setY(1.2));
    this.snow.burst(90, c.clone().setY(3.6));
    this.puffs.burst(30, c.clone().setY(0.4));
    const ctx = this.ctx;
    if (ctx) ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.damage, knock: 5, from: ctx.from, color: '#bfe8ff' }));
  }
}

export const mirrorIcePrisonModule: EffectModule = {
  label: 'mirror ice prison',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new MirrorIcePrison(),
  telegraphs(effect) {
    const e = effect as MirrorIcePrison;
    const c = e.ctx?.targetPos[0] ?? e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 2 }, start: 0.5, impact: e.settings.impactTime }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.84 },
  frameCamera(camera, controls, effect) {
    const e = effect as MirrorIcePrison;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as MirrorIcePrison).settings;
    f.add(s, 'loop');
    f.add(s, 'impactTime', 1.6, 4, 0.05).name('impact time');
    f.add(s, 'damage', 1, 150, 1);
  },
};
