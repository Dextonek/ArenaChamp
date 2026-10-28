import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Spider Lily Soul Field (targeted ground AoE): a wave of red spider lilies (hard-edged canvas billboards with thin
 * curling petals and long gold-tipped stamens) blooms outward from the aim point across the whole circle. Pale gold
 * soul wisps rise while the field ticks small damage, then every lily snaps shut (dead beat) and springs open at
 * once, releasing a spiral storm of crimson petal blades across the circle: impact frames, gold stars, 40 damage.
 * The petals settle into embers and the lilies wither. Palette: ART_BIBLE.md §2 Spiderlily row.
 */
export interface SpiderLilySoulFieldSettings {
  damage: number;
  tickDamage: number;
  loop: boolean;
}

export const defaultSpiderLilySoulField = (): SpiderLilySoulFieldSettings => ({
  damage: 40,
  tickDamage: 5,
  loop: false,
});

const RADIUS = 5.5;
const FIELD = RADIUS * 0.96;
const D = 2.45; // burst / impact time
const DURATION = 4.8;
const LILIES = 68;
const PETALS = 150;
const BLADES = 10;
const SLASHES = 4;
const TICKS = [1.0, 1.5, 2.0];

// Crimson stays well under the bloom threshold; accents are the pink and gold of the Spiderlily row.
const OUTLINE = '#2a0a1e';
const CRIMSON_BASE = '#7a1030';
const CRIMSON_MID = '#d4183c';
const CRIMSON_LIGHT = '#ff5a74';
const GOLD = '#ffb547';

const easeOutBack = (x: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  const k = Math.min(1, Math.max(0, x)) - 1;
  return 1 + c3 * k * k * k + c1 * k * k;
};
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** Deterministic pseudo-random in 0..1, so the field looks the same on every cast. */
const rnd = (i: number, salt: number) => {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** One thin curling petal: tapered, outlined, value ramp base (dark) → body → light tip. */
function drawPetal(g: CanvasRenderingContext2D, cx: number, cy: number, ang: number, len: number, wid: number, curl: number) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const px = -dy, py = dx;
  const N = 20;
  const left: number[][] = [], right: number[][] = [], mid: number[][] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const along = len * u;
    const lateral = curl * len * u * u;
    const w = wid * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.9);
    const x = cx + dx * along + px * lateral, y = cy + dy * along + py * lateral;
    left.push([x + px * w, y + py * w]);
    right.push([x - px * w, y - py * w]);
    mid.push([x, y]);
  }
  const tipX = mid[N][0], tipY = mid[N][1];
  const grad = g.createLinearGradient(cx, cy, tipX, tipY);
  grad.addColorStop(0, CRIMSON_BASE);
  grad.addColorStop(0.45, CRIMSON_MID);
  grad.addColorStop(1, CRIMSON_LIGHT);
  g.beginPath();
  g.moveTo(left[0][0], left[0][1]);
  for (const p of left) g.lineTo(p[0], p[1]);
  for (let i = N; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
  g.closePath();
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = OUTLINE;
  g.stroke();
  // Mid rib (shadow) and a light edge on one side: reads as a curled, folded petal.
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(90,10,36,0.8)';
  g.beginPath();
  g.moveTo(mid[2][0], mid[2][1]);
  for (let i = 3; i <= N - 4; i++) g.lineTo(mid[i][0], mid[i][1]);
  g.stroke();
  g.strokeStyle = 'rgba(255,150,165,0.85)';
  g.beginPath();
  g.moveTo(left[5][0], left[5][1]);
  for (let i = 6; i <= N - 5; i++) g.lineTo(left[i][0], left[i][1]);
  g.stroke();
}

/** One long curling stamen with a gold tip. */
function drawStamen(g: CanvasRenderingContext2D, cx: number, cy: number, ang: number, len: number, curl: number) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const px = -dy, py = dx;
  const ex = cx + dx * len + px * curl * len, ey = cy + dy * len + py * curl * len;
  const c1x = cx + dx * len * 0.45 + px * curl * len * 0.1, c1y = cy + dy * len * 0.45 + py * curl * len * 0.1;
  const path = () => {
    g.beginPath();
    g.moveTo(cx, cy);
    g.quadraticCurveTo(c1x, c1y, ex, ey);
  };
  path();
  g.lineWidth = 10;
  g.strokeStyle = OUTLINE;
  g.stroke();
  path();
  g.lineWidth = 4;
  g.strokeStyle = '#f0405c';
  g.stroke();
  g.beginPath();
  g.arc(ex, ey, 13, 0, Math.PI * 2);
  g.fillStyle = GOLD;
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = OUTLINE;
  g.stroke();
  g.beginPath();
  g.arc(ex - 3, ey - 3, 4.5, 0, Math.PI * 2);
  g.fillStyle = '#fff4d6';
  g.fill();
}

function drawStem(g: CanvasRenderingContext2D, fromY: number) {
  const path = () => {
    g.beginPath();
    g.moveTo(256, fromY);
    g.quadraticCurveTo(306, 600, 256, 768);
  };
  path();
  g.lineWidth = 26;
  g.strokeStyle = OUTLINE;
  g.stroke();
  path();
  g.lineWidth = 13;
  g.strokeStyle = '#1f3a2a';
  g.stroke();
}

/** Spider lily canvas sprite 512x768: stem at the bottom (anchor), bloom on top. open=false draws the closed bud. */
function lilyTexture(open: boolean): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 768;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (open) {
    drawStem(g, 420);
    const cx = 256, cy = 330;
    const deg = Math.PI / 180;
    // Petals first (thin, curling both ways), then the long stamens over them.
    for (let i = 0; i < 6; i++) {
      const ang = (-90 + (i - 2.5) * 50) * deg;
      drawPetal(g, cx, cy, ang, 175 + (i % 3) * 14, 22 + (i % 2) * 3, (i % 2 ? 1 : -1) * 0.42);
    }
    for (let i = 0; i < 7; i++) {
      const ang = (-90 + (i - 3) * 17) * deg;
      drawStamen(g, cx, cy, ang, 235 + (i % 3) * 20, (i - 3) * 0.09 + 0.08);
    }
    g.beginPath();
    g.arc(cx, cy, 15, 0, Math.PI * 2);
    g.fillStyle = '#5a0a1e';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = OUTLINE;
    g.stroke();
  } else {
    drawStem(g, 440);
    const cx = 256, cy = 445;
    const deg = Math.PI / 180;
    for (let i = 0; i < 4; i++) drawStamen(g, cx, cy, (-90 + (i - 1.5) * 8) * deg, 330 + (i % 2) * 22, (i - 1.5) * 0.04);
    for (let i = 0; i < 5; i++) {
      drawPetal(g, cx, cy, (-90 + (i - 2) * 7) * deg, 270 + (i % 2) * 12, 30, (i - 2) * 0.1);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A thin curved petal blade for the drifting / flying petals (length 1 along +X). */
function petalGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.45, 0.32, 1, 0.12);
  s.quadraticCurveTo(0.5, 0.1, 0, 0);
  const geo = new THREE.ShapeGeometry(s);
  geo.translate(-0.5, -0.1, 0);
  return geo;
}

export class SpiderLilySoulField implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SpiderLilySoulFieldSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private hitDone = false;
  private embersDone = false;
  private ticksDone = 0;
  private wispAcc = 0;
  private center = new THREE.Vector3();

  // Lily field (two instanced billboard layers: closed bud / open bloom share the same slots).
  private lilyRel = Array.from({ length: LILIES }, (_, i) => {
    const r = FIELD * Math.sqrt((i + 0.5) / LILIES);
    const a = i * 2.39996 + (rnd(i, 1) - 0.5) * 0.5;
    return {
      x: Math.cos(a) * r, z: Math.sin(a) * r, r: r / FIELD,
      size: 0.95 + rnd(i, 2) * 0.45, delay: 0.75 * (r / FIELD) + rnd(i, 3) * 0.07,
      roll: (rnd(i, 4) - 0.5) * 0.25, shade: 0.88 + rnd(i, 5) * 0.12,
    };
  });
  private lilyMode = new Uint8Array(LILIES); // 0 hidden, 1 bud, 2 open
  private lilyScale = new Float32Array(LILIES);
  private lilySquash = 1;
  private lilyOpen: THREE.InstancedMesh;
  private lilyBud: THREE.InstancedMesh;

  // Petals.
  private petalMesh: THREE.InstancedMesh;
  private petalSeed = Array.from({ length: PETALS }, (_, i) => ({
    r0: FIELD * Math.sqrt(rnd(i, 11)), a0: rnd(i, 12) * Math.PI * 2, y0: 0.5 + rnd(i, 13) * 1.5,
    ph: rnd(i, 14) * 6.28, spin: 1.5 + rnd(i, 15) * 3, size: 0.4 + rnd(i, 16) * 0.35, born: 0.85 + rnd(i, 17) * 0.9,
    tw: (rnd(i, 18) - 0.5) * 2,
  }));

  // Burst layers.
  private blades: CrescentArc[] = [];
  private bladeHolders: THREE.Group[] = [];
  private slashes: CrescentArc[] = [];
  private slashHolders: THREE.Group[] = [];
  private starMain = new StarBurst({ points: 12, color: 0xffb547, core: 0xfff4d6, additive: false });
  private glints: StarBurst[] = [];
  private floorDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshBasicMaterial({ color: 0x2a0f2e, transparent: true, opacity: 0, depthWrite: false }),
  );
  private waveRing = createRing(0xff3a5a, 0.93, 1, 96);
  private shockRing = createRing(0xff4f8b, 0.9, 1, 96);

  private wisps: Emitter;
  private embers: Emitter;

  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpP = new THREE.Vector3();
  private tmpS = new THREE.Vector3();
  private tmpC = new THREE.Color();
  private static readonly Z = new THREE.Vector3(0, 0, 1);

  constructor(settings: SpiderLilySoulFieldSettings = defaultSpiderLilySoulField()) {
    this.settings = settings;
    this.screen.tint.set(0x2a0f2e);
    this.screen.impactColor.set(0xff5fa8);
    this.screen.speedLineColor.set(0xffb0c8);
    this.screen.edgeTint.set(0xff4f8b);

    this.floorDisc.rotation.x = -Math.PI / 2;
    this.floorDisc.position.y = 0.03;
    this.group.add(this.floorDisc, this.waveRing.mesh, this.shockRing.mesh);

    const geo = new THREE.PlaneGeometry(1, 1.5);
    geo.translate(0, 0.75, 0);
    const make = (open: boolean) => {
      const m = new THREE.InstancedMesh(
        geo, new THREE.MeshBasicMaterial({ map: lilyTexture(open), alphaTest: 0.5, side: THREE.DoubleSide }), LILIES,
      );
      m.frustumCulled = false;
      for (let i = 0; i < LILIES; i++) m.setColorAt(i, this.tmpC.setRGB(1, 1, 1));
      return m;
    };
    this.lilyOpen = make(true);
    this.lilyBud = make(false);
    this.lilyOpen.onBeforeRender = (_r, _s, camera) => this.faceCamera(this.lilyOpen, 2, camera);
    this.lilyBud.onBeforeRender = (_r, _s, camera) => this.faceCamera(this.lilyBud, 1, camera);
    this.group.add(this.lilyOpen, this.lilyBud);

    this.petalMesh = new THREE.InstancedMesh(
      petalGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), PETALS,
    );
    this.petalMesh.frustumCulled = false;
    for (let i = 0; i < PETALS; i++) {
      const c = new THREE.Color(rnd(i, 21) < 0.65 ? CRIMSON_MID : rnd(i, 22) < 0.5 ? '#ff5a74' : '#a01230');
      this.petalMesh.setColorAt(i, c);
    }
    this.group.add(this.petalMesh);

    // Flat spiral blades: toon crescents, light inner edge, crimson body, dark outer band.
    for (let i = 0; i < BLADES; i++) {
      const arc = new CrescentArc({
        radius: 1.0 + i * 0.46, width: 0.55 + i * 0.07, style: 'toon', sweep: Math.PI * 1.5,
        edge: 0xff9ab0, mid: 0xd4183c, outer: 0x2a0f2e,
      });
      arc.mesh.rotation.x = -Math.PI / 2 + (i % 2 ? 0.22 : -0.18);
      const holder = new THREE.Group();
      holder.add(arc.mesh);
      this.blades.push(arc);
      this.bladeHolders.push(holder);
      this.group.add(holder);
    }
    // Big camera-facing slashes across the field.
    for (let j = 0; j < SLASHES; j++) {
      const arc = new CrescentArc({
        radius: 2.4 + (j % 2) * 0.7, width: 1.1, style: 'toon', sweep: Math.PI * 0.95,
        edge: 0xffc4d2, mid: 0xe8284a, outer: 0x2a0f2e,
      });
      arc.mesh.rotation.z = (rnd(j, 31) - 0.5) * 2.2;
      const holder = new THREE.Group();
      holder.add(arc.mesh);
      const camQ = new THREE.Quaternion(), parentQ = new THREE.Quaternion();
      arc.mesh.onBeforeRender = (_r, _s, camera) => {
        holder.parent?.getWorldQuaternion(parentQ);
        camera.getWorldQuaternion(camQ);
        holder.quaternion.copy(parentQ.invert().multiply(camQ));
        holder.updateMatrixWorld(true);
      };
      this.slashes.push(arc);
      this.slashHolders.push(holder);
      this.group.add(holder);
    }
    this.group.add(this.starMain.mesh);
    for (let i = 0; i < 4; i++) {
      const gl = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffb547, core: 0xfff4d6, additive: false });
      this.glints.push(gl);
      this.group.add(gl.mesh);
    }

    // Small pale gold soul wisps.
    this.wisps = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.12, speed: 0.7, speedJitter: 0.5, spread: 35, gravity: -0.28, drag: 0.5,
      sizeStart: 0.17, sizeEnd: 0.03, colorStart: '#fff4d6', colorEnd: '#ffb547',
      opacityStart: 0.45, opacityEnd: 0, additive: true, colorMid: '#ffe08a', sizeJitter: 0.4, erosion: 0.35, spin: 0.4,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 2.0, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 1.6, speedJitter: 0.7, spread: 70, gravity: -0.35, drag: 0.8,
      sizeStart: 0.15, sizeEnd: 0.02, colorStart: '#ffb547', colorEnd: '#7a2a8c',
      opacityStart: 0.5, opacityEnd: 0, additive: true, colorMid: '#ff5fa8', sizeJitter: 0.4, erosion: 0.3, spin: 0.3,
    });
    this.emitters.push(this.wisps, this.embers);
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
    this.center.copy(ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.center).setY(1.0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hitDone = false;
    this.embersDone = false;
    this.ticksDone = 0;
    this.wispAcc = 0;
    this.shake = 0;
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
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
    const t = this.time;
    // Soul wisps rise from the open flowers (sparse, small).
    if (t > 0.8 && t < 3.3 && t < 2.2 + (t > D ? 1.1 : 0)) {
      this.wispAcc += dt * (t < D ? 42 : 18);
      while (this.wispAcc >= 1) {
        this.wispAcc -= 1;
        const l = this.lilyRel[Math.floor(Math.random() * LILIES)];
        if (t > l.delay + 0.3) this.wisps.burst(1, new THREE.Vector3(this.center.x + l.x, 0.9 * l.size, this.center.z + l.z));
      }
    }
    while (this.ticksDone < TICKS.length && t >= TICKS[this.ticksDone]) {
      this.ticksDone++;
      const ctx = this.ctx;
      if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.tickDamage, knock: 0, color: '#ffb0c8' });
    }
    if (!this.hitDone && t >= D) this.onHit();
    if (!this.embersDone && t >= D + 0.9) this.onEmbers();
    this.layout(dt);
  }

  /** Writes the billboard matrices for one lily layer; runs just before each draw so it knows the camera. */
  private faceCamera(mesh: THREE.InstancedMesh, mode: number, camera: THREE.Camera) {
    const parentQ = new THREE.Quaternion(), camQ = new THREE.Quaternion();
    mesh.parent?.getWorldQuaternion(parentQ);
    camera.getWorldQuaternion(camQ);
    const base = parentQ.invert().multiply(camQ);
    for (let i = 0; i < LILIES; i++) {
      const l = this.lilyRel[i];
      const on = this.lilyMode[i] === mode;
      const s = on ? Math.max(1e-4, l.size * this.lilyScale[i]) : 1e-4;
      this.tmpQ.copy(base).multiply(new THREE.Quaternion().setFromAxisAngle(SpiderLilySoulField.Z, l.roll));
      this.tmpP.set(this.center.x + l.x, 0.02, this.center.z + l.z);
      this.tmpS.set(s, s * (on ? this.lilySquash : 1), 1);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      mesh.setMatrixAt(i, this.tmpM);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  private layout(_dt: number) {
    const t = this.time;
    const after = t - D;
    const fade = 1 - smoothstep((t - (DURATION - 0.7)) / 0.5);
    const wither = smoothstep((t - 3.0) / 1.4);
    const c = this.center;

    // --- World grade: dark and plum until the burst, released after it. ---
    this.screen.darken = t < D ? 0.6 * smoothstep(t / 0.5) : 0.6 * Math.exp(-Math.max(0, after - 0.05) * 3.2);
    this.screen.speedLines = t < D ? 0.8 * smoothstep((t - 2.2) / 0.25) : Math.max(0, 0.8 - after * 5);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D, 0.55, 8);

    // --- Lilies: bloom wave from the centre, snap shut, spring open, wither. ---
    this.lilySquash = 1 - 0.45 * wither;
    for (let i = 0; i < LILIES; i++) {
      const l = this.lilyRel[i];
      let mode = 0, s = 0;
      if (t >= l.delay) {
        if (t < 2.2) {
          const g = (t - l.delay) / 0.45;
          if (g < 0.3) { mode = 1; s = 0.2 + 0.55 * (g / 0.3); }
          else { mode = 2; s = 0.55 + 0.45 * easeOutBack((g - 0.3) / 0.7); }
        } else if (t < D) {
          mode = 1;
          s = 0.8 - 0.1 * smoothstep((t - 2.2) / 0.25) + 0.012 * Math.sin(t * 90 + i);
        } else {
          const g2 = after / 0.3;
          if (g2 < 0.05) { mode = 1; s = 0.7; }
          else { mode = 2; s = 0.7 + 0.4 * easeOutBack(g2); }
        }
      }
      s *= (1 - 0.8 * wither) * fade;
      this.lilyMode[i] = mode;
      this.lilyScale[i] = s;
      const dim = l.shade * (1 - 0.6 * wither);
      this.lilyOpen.setColorAt(i, this.tmpC.setRGB(dim, dim, dim));
      this.lilyBud.setColorAt(i, this.tmpC);
    }
    if (this.lilyOpen.instanceColor) this.lilyOpen.instanceColor.needsUpdate = true;
    if (this.lilyBud.instanceColor) this.lilyBud.instanceColor.needsUpdate = true;

    // --- Ground: dark plum disc under the field, a crimson wave ring riding the bloom front. ---
    const reach = smoothstep(t / 0.85);
    this.floorDisc.position.set(c.x, 0.03, c.z);
    this.floorDisc.scale.setScalar(Math.max(1e-3, RADIUS * (0.15 + 0.9 * reach)));
    (this.floorDisc.material as THREE.MeshBasicMaterial).opacity = 0.55 * smoothstep(t / 0.6) * (1 - 0.7 * wither) * fade;
    this.waveRing.mesh.position.set(c.x, 0.05, c.z);
    this.waveRing.mesh.scale.setScalar(Math.max(1e-3, FIELD * reach));
    this.waveRing.material.opacity = t < 1.0 ? 0.45 * (1 - smoothstep(t / 1.0)) : 0;
    const sk = after / 0.55;
    this.shockRing.mesh.position.set(c.x, 0.06, c.z);
    this.shockRing.mesh.scale.setScalar(Math.max(1e-3, 0.5 + RADIUS * 1.1 * smoothstep(after / 0.45)));
    this.shockRing.material.opacity = after >= 0 && sk < 1 ? 0.6 * (1 - sk) : 0;

    // --- Drifting petals, then the spiral storm. ---
    for (let i = 0; i < PETALS; i++) {
      const p = this.petalSeed[i];
      const e = (t - p.born) / 0.4;
      if (e <= 0) {
        this.tmpM.compose(this.tmpP.set(0, -50, 0), this.tmpQ.identity(), this.tmpS.setScalar(1e-4));
        this.petalMesh.setMatrixAt(i, this.tmpM);
        continue;
      }
      const td = Math.min(t, D);
      let x = Math.cos(p.a0) * p.r0 + 0.35 * Math.sin(td * 0.9 + p.ph);
      let z = Math.sin(p.a0) * p.r0 + 0.35 * Math.cos(td * 0.8 + p.ph);
      let y = p.y0 + 0.12 * Math.sin(td * 1.3 + p.ph) + 0.12 * Math.min(td, 2.2);
      if (after > 0) {
        const k = easeOut(after / 0.85);
        const r = Math.hypot(x, z), a = Math.atan2(z, x) + 4.2 * k * (p.tw > 0 ? 1 : 0.85);
        const rr = r + (FIELD * 1.08 - r) * k;
        x = Math.cos(a) * rr;
        z = Math.sin(a) * rr;
        y = THREE.MathUtils.lerp(y + 1.1 * Math.sin(Math.PI * k), 0.06, smoothstep((after - 0.7) / 0.9));
      }
      const sc = Math.max(1e-4, p.size * Math.min(1, e) * (1 - smoothstep((after - 1.85) / 0.4)) * fade);
      this.tmpQ.setFromEuler(new THREE.Euler(p.ph + t * p.spin * 0.6, p.ph * 1.7 + t * p.spin, p.tw * t * 1.2));
      this.tmpM.compose(this.tmpP.set(c.x + x, y, c.z + z), this.tmpQ, this.tmpS.set(sc, sc, sc));
      this.petalMesh.setMatrixAt(i, this.tmpM);
    }
    this.petalMesh.instanceMatrix.needsUpdate = true;

    // --- Petal blades: flat spiral rings sweep out across the circle. ---
    for (let i = 0; i < BLADES; i++) {
      const tau = after - 0.025 * i;
      const arc = this.blades[i], holder = this.bladeHolders[i];
      holder.position.set(c.x, 0.35 + (i % 5) * 0.32, c.z);
      holder.rotation.y = i * 0.9 + (tau > 0 ? tau * (i % 2 ? 3.2 : -2.6) : 0);
      holder.scale.setScalar(Math.max(1e-3, 0.55 + 0.5 * smoothstep(tau / 0.5)));
      arc.head = Math.max(0, tau) / 0.5 * 1.5;
      arc.length = 0.42;
      arc.time = t;
      arc.erosion = smoothstep((tau - 0.45) / 0.55);
      arc.opacity = tau > 0 ? 0.95 * (1 - smoothstep((tau - 0.7) / 0.5)) * fade : 0;
    }
    for (let j = 0; j < SLASHES; j++) {
      const tau = after - 0.03 - 0.07 * j;
      const arc = this.slashes[j], holder = this.slashHolders[j];
      const a = rnd(j, 41) * Math.PI * 2;
      holder.position.set(c.x + Math.cos(a) * 2.6, 1.3 + (j % 2) * 0.6, c.z + Math.sin(a) * 2.6);
      arc.head = Math.max(0, tau) / 0.26 * 1.4;
      arc.length = 0.5;
      arc.time = t;
      arc.erosion = smoothstep((tau - 0.2) / 0.35);
      arc.opacity = tau > 0 ? 1 - smoothstep((tau - 0.25) / 0.2) : 0;
    }

    // --- Impact stars (short, crisp, gold on crimson) ---
    const pop = StarBurst.pop(after - 0.01);
    this.starMain.set(this.tmpP.set(c.x, 1.5, c.z), 3.2 * pop.scale, pop.opacity, 0.3);
    this.glints.forEach((gl, i) => {
      const gp = StarBurst.pop(after - 0.05 - 0.04 * i, 0.08, 0.2);
      const a = i * 1.7 + 0.6, r = 1.2 + i * 0.9;
      gl.set(this.tmpP.set(c.x + Math.cos(a) * r, 1.0 + 0.4 * i, c.z + Math.sin(a) * r), 1.0 * gp.scale, gp.opacity, t * 2);
    });

    this.shake = after >= 0 ? 0.7 * Math.exp(-after * 6) : t > 2.2 ? 0.03 : 0;
  }

  private onHit() {
    this.hitDone = true;
    const ctx = this.ctx;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, r = FIELD * Math.sqrt(Math.random());
      this.embers.burst(14, new THREE.Vector3(this.center.x + Math.cos(a) * r, 0.4 + Math.random(), this.center.z + Math.sin(a) * r));
    }
    if (ctx) ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.damage, knock: 4, from: this.center }));
  }

  /** Settling petals turn to a few embers. */
  private onEmbers() {
    this.embersDone = true;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, r = FIELD * Math.sqrt(Math.random());
      this.embers.burst(8, new THREE.Vector3(this.center.x + Math.cos(a) * r, 0.1, this.center.z + Math.sin(a) * r));
    }
  }
}

export const spiderLilySoulFieldModule: EffectModule = {
  label: 'spider lily soul field',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new SpiderLilySoulField(),
  telegraphs(effect) {
    const e = effect as SpiderLilySoulField;
    const c = e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: 0.8, impact: D }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as SpiderLilySoulField;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SpiderLilySoulField).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tickDamage', 0, 30, 1).name('tick damage');
  },
};
