import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { LightPillar, createRing, smoothstep, softDotTexture } from '../../effects/common';
import { StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Heavenly Buddha Palm (targeted, `ground` mode): clouds part above the chosen spot and a gold shaft of light comes
 * down. A colossal translucent palm (dark gold body, thin bright rim, palm-crease line art, a sutra glyph band round
 * the wrist) descends slowly, tilted toward the caster so it reads as a hand, and its shadow grows on the ground.
 * It stops just above the ground for a dead beat, then presses: gold impact frames, a palm-print crater with dark
 * plates, a gold shock ring and a two-frame cyan star. The palm lifts away and dissolves into gold leaf; the
 * print is the last thing to fade.
 *
 * Palette row: Solar / holy (docs/ART_BIBLE.md). Recipes: a-val-brimstone-orbital-strike (strike from above, clear
 * ground marker), f-beyondfx-sunrise-pillar-strike (gold light from above, held hang), b-elden-ring-radahn-meteor-impact
 * (crater and debris).
 */
export interface HeavenlyBuddhaPalmSettings {
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultHeavenlyBuddhaPalm = (): HeavenlyBuddhaPalmSettings => ({ damage: 60, knock: 4, loop: false });

const DURATION = 4.6;
const DESCEND = 0.7;
const HOVER = 1.8; // palm stops above the ground
const PRESS = 2.0; // D
const LIFT = 2.45;
const RADIUS = 5;
const M = 0.028; // metres per canvas pixel
const CANVAS_W = 500;
const CANVAS_H = 600;
const PALM_CY = 410; // canvas y of the palm centre (rig origin)
const WRIST_DROP = 4.2; // metres from palm centre to the wrist end
const FLAKES = 64;
const PLATES = 8;
const CLOUDS = 22;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Hand shape in canvas px (500 x 600, fingers up): [base x, base y, control x, control y, tip x, tip y, width].
const FINGERS = [
  [175, 312, 168, 212, 158, 125, 40],
  [226, 302, 226, 192, 224, 80, 44],
  [278, 310, 282, 202, 288, 112, 40],
  [330, 332, 346, 262, 352, 202, 34],
  [150, 424, 82, 402, 62, 300, 46], // thumb
];

function palmPath(): Path2D {
  const p = new Path2D();
  p.moveTo(142, 305);
  p.quadraticCurveTo(250, 285, 358, 305);
  p.quadraticCurveTo(378, 370, 352, 450);
  p.quadraticCurveTo(330, 505, 312, 560);
  p.lineTo(188, 560);
  p.quadraticCurveTo(170, 505, 148, 450);
  p.quadraticCurveTo(122, 380, 142, 305);
  p.closePath();
  return p;
}

/** Fills the whole hand silhouette (palm + fingers) grown by `pad` px with the current fill/stroke style. */
function paintHand(g: CanvasRenderingContext2D, pad: number) {
  const palm = palmPath();
  if (pad > 0) { g.lineWidth = pad * 2; g.stroke(palm); }
  g.fill(palm);
  g.lineCap = 'round';
  for (const [bx, by, cx, cy, tx, ty, w] of FINGERS) {
    g.beginPath();
    g.moveTo(bx, by);
    g.quadraticCurveTo(cx, cy, tx, ty);
    g.lineWidth = w + pad * 2;
    g.stroke();
  }
}

/** Palm-crease line art: three main creases, finger joints, a small mandala at the centre, the wrist cuff. */
function paintCreases(g: CanvasRenderingContext2D, color: string, width: number) {
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  const curve = (a: number[], b: number[], c: number[]) => {
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.quadraticCurveTo(b[0], b[1], c[0], c[1]);
    g.stroke();
  };
  curve([176, 348], [186, 450], [238, 505]); // life line
  curve([150, 380], [250, 358], [348, 392]); // head line
  curve([352, 338], [268, 322], [190, 346]); // heart line
  for (const [bx, by, , , tx, ty, w] of FINGERS) {
    const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (const f of [0.36, 0.66]) {
      const x = bx + dx * f, y = by + dy * f;
      g.beginPath();
      g.moveTo(x - nx * w * 0.28, y - ny * w * 0.28);
      g.lineTo(x + nx * w * 0.28, y + ny * w * 0.28);
      g.stroke();
    }
  }
  g.beginPath();
  g.arc(250, PALM_CY, 30, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(250, PALM_CY, 6, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(250 + Math.cos(a) * 38, PALM_CY + Math.sin(a) * 38);
    g.lineTo(250 + Math.cos(a) * 50, PALM_CY + Math.sin(a) * 50);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(192, 528);
  g.lineTo(308, 528);
  g.stroke();
}

type PalmMode = 'body' | 'rim' | 'print' | 'shadow';

/**
 * The palm, drawn flat: hard edges, a dark gold outline, a value ramp from bright fingertips to a dark wrist,
 * crease line art. 'rim' is only a thin outline + creases (drawn additive), 'print' is the dark crater decal with
 * gold cracks, 'shadow' a plain black silhouette.
 */
function palmTexture(mode: PalmMode): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = CANVAS_W * 2;
  cv.height = CANVAS_H * 2;
  const g = cv.getContext('2d')!;
  g.scale(2, 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const set = (c: string | CanvasGradient) => { g.fillStyle = c; g.strokeStyle = c; };

  if (mode === 'body') {
    set('#2a1a06');
    paintHand(g, 6); // dark gold outline
    const ramp = g.createLinearGradient(0, 70, 0, 560);
    ramp.addColorStop(0, '#d9a030');
    ramp.addColorStop(0.35, '#b98022');
    ramp.addColorStop(0.7, '#8a5e18');
    ramp.addColorStop(1, '#4a3010');
    set(ramp);
    paintHand(g, 0);
    // Flat highlight band down each finger (hard-edged second value).
    g.lineCap = 'round';
    g.strokeStyle = '#f2c765';
    for (const [bx, by, , , tx, ty, w] of FINGERS) {
      g.lineWidth = w * 0.2;
      g.beginPath();
      g.moveTo(bx - w * 0.2, by - 18);
      g.lineTo(tx - w * 0.2, ty + 14);
      g.stroke();
    }
    paintCreases(g, '#3a2208', 4);
  } else if (mode === 'rim') {
    set('#ffe39a');
    paintHand(g, 6);
    g.globalCompositeOperation = 'destination-out';
    set('#000');
    paintHand(g, 2.5);
    g.globalCompositeOperation = 'source-over';
    paintCreases(g, '#ffe39a', 2.5);
  } else if (mode === 'print') {
    set('#2a1a06');
    paintHand(g, 7);
    set('#120a04');
    paintHand(g, 0);
    paintCreases(g, '#c9a24a', 3.5);
  } else {
    set('#000');
    paintHand(g, 10);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Short bars and dots in rows: sutra-looking script that is not real text. White on transparent. */
function glyphTexture(): THREE.CanvasTexture {
  const w = 512, h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.fillStyle = '#fff';
  for (let row = 0; row < 3; row++) {
    const y = 14 + row * 26;
    let x = 4;
    while (x < w - 10) {
      const kind = rnd();
      if (kind < 0.55) { const bw = 5 + rnd() * 16; g.fillRect(x, y, bw, 7); x += bw + 5; }
      else if (kind < 0.8) { g.fillRect(x, y - 3, 4, 13); g.fillRect(x + 7, y, 10, 4); x += 22; }
      else { g.beginPath(); g.arc(x + 4, y + 4, 3.5, 0, Math.PI * 2); g.fill(); x += 14; }
      if (rnd() < 0.12) x += 14;
    }
  }
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createLinearGradient(0, 0, 0, h);
  mask.addColorStop(0, 'rgba(0,0,0,0)');
  mask.addColorStop(0.3, 'rgba(0,0,0,1)');
  mask.addColorStop(0.7, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class HeavenlyBuddhaPalm implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HeavenlyBuddhaPalmSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private pressed = false;
  private center = new THREE.Vector3();
  private aim = 0;

  // The hand in the air: a rig (position, tilt, yaw) holding the body, the bright rim and the wrist glyph band.
  private palmRig = new THREE.Group();
  private bodyMat = new THREE.MeshBasicMaterial({
    map: palmTexture('body'), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  private rimMat = new THREE.MeshBasicMaterial({
    map: palmTexture('rim'), color: 0xffe39a, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  private glyphTex = glyphTexture();
  private glyphMat = new THREE.MeshBasicMaterial({
    map: this.glyphTex, color: 0xffe39a, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });

  // On the ground, in a yaw rig: shadow, crater print, cooling crack glow.
  private groundRig = new THREE.Group();
  private shadowMat = new THREE.MeshBasicMaterial({ map: palmTexture('shadow'), transparent: true, opacity: 0, depthWrite: false });
  private printMat = new THREE.MeshBasicMaterial({ map: palmTexture('print'), transparent: true, opacity: 0, depthWrite: false });
  private printGlowMat = new THREE.MeshBasicMaterial({
    map: palmTexture('rim'), color: 0xf2b53c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  private printMesh: THREE.Mesh;

  private pillar = new LightPillar(0xffe39a, 2.4);
  private groundRing = createRing(0xf2b53c, 0.94, 1, 96);
  private groundRune = createRing(0xffe39a, 0.97, 1, 6);
  private shock = createRing(0xffe39a, 0.9, 1, 96);
  private shock2 = createRing(0xf2b53c, 0.94, 1, 96);
  private shockDark = createRing(0x2a1a06, 0.7, 1, 96);
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffe39a, core: 0xfffbe8, additive: false });
  private pressStar = new StarBurst({ points: 9, color: 0x6fe0ff, core: 0xfffbe8, additive: false });

  private plates: THREE.InstancedMesh;
  private plateSeed = Array.from({ length: PLATES }, (_, i) => ({
    a: (i / PLATES) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
    r: 3.5 + Math.random() * 0.9, size: 0.9 + Math.random() * 0.5, tilt: 0.55 + Math.random() * 0.3,
  }));

  private cloudPos = new Float32Array(CLOUDS * 3);
  private cloudSeed = Array.from({ length: CLOUDS }, (_, i) => ({
    a: (i / CLOUDS) * Math.PI * 2 + Math.random() * 0.3, r0: 0.5 + Math.random() * 1.5, r1: 5 + Math.random() * 5, y: 12.5 + Math.random() * 3,
  }));
  private cloudGeo = new THREE.BufferGeometry();
  private cloudMat = new THREE.PointsMaterial({
    size: 7, map: softDotTexture(), color: 0x6b5330, transparent: true, opacity: 0, depthWrite: false,
  });
  private clouds = new THREE.Points(this.cloudGeo, this.cloudMat);

  private leafGold = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.24, 0.32),
    new THREE.MeshBasicMaterial({ color: 0xe0b455, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    FLAKES,
  );
  private leafDark = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.32, 0.42).translate(0, 0, -0.01),
    new THREE.MeshBasicMaterial({ color: 0x2a1a06, side: THREE.DoubleSide }),
    FLAKES,
  );
  private flake = Array.from({ length: FLAKES }, () => ({
    birth: LIFT + Math.random() * 0.9,
    lx: (Math.random() - 0.5) * 5.2, ly: -3.2 + Math.pow(Math.random(), 1.3) * 10.5,
    out: new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 1.5, (Math.random() - 0.5) * 2.4),
    w: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
    drift: Math.random() * Math.PI * 2, size: 0.7 + Math.random() * 0.7,
  }));

  private motes: Emitter;
  private sparks: Emitter;
  private dust: Emitter;

  private tmpPos = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();
  private tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  constructor(settings: HeavenlyBuddhaPalmSettings = defaultHeavenlyBuddhaPalm()) {
    this.settings = settings;
    this.screen.tint.set(0x2a1a06);
    this.screen.impactColor.set(0xf2b53c);
    this.screen.speedLineColor.set(0xffe39a);
    this.screen.edgeTint.set(0xf2b53c);

    // --- Palm in the air. ---
    const planeGeo = new THREE.PlaneGeometry(CANVAS_W * M, CANVAS_H * M);
    const lift = (PALM_CY - CANVAS_H / 2) * M; // puts the palm centre at the rig origin
    const body = new THREE.Mesh(planeGeo, this.bodyMat);
    const rim = new THREE.Mesh(planeGeo, this.rimMat);
    body.position.y = lift;
    rim.position.set(0, lift, 0.02);
    body.renderOrder = 2;
    rim.renderOrder = 4;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 1.0, 48, 1, true), this.glyphMat);
    band.position.y = -WRIST_DROP * 0.82;
    band.renderOrder = 5;
    this.glyphTex.repeat.set(3, 1);
    this.palmRig.rotation.order = 'YXZ';
    this.palmRig.add(body, rim, band);
    this.palmRig.visible = false;

    // --- Ground: fingers point -Z in the rig, so it is yawed by aim + PI. ---
    const flat = (mat: THREE.Material, y: number, order: number) => {
      const m = new THREE.Mesh(planeGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, y, -lift); // palm centre on the rig origin (plane +Y is -Z once laid flat)
      m.renderOrder = order;
      this.groundRig.add(m);
      return m;
    };
    flat(this.shadowMat, 0.012, 1);
    this.printMesh = flat(this.printMat, 0.03, 2);
    flat(this.printGlowMat, 0.04, 3);
    this.shockDark.material.blending = THREE.NormalBlending;
    this.shockDark.mesh.position.y = 0.025;

    // --- Crater plates: big dark triangles that tip up and sink. ---
    this.plates = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 3),
      new THREE.MeshBasicMaterial({ color: 0x1c1106, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      PLATES,
    );
    this.plates.frustumCulled = false;

    this.cloudGeo.setAttribute('position', new THREE.BufferAttribute(this.cloudPos, 3));
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 0;

    this.leafDark.frustumCulled = false;
    this.leafGold.frustumCulled = false;
    this.leafDark.renderOrder = 6;
    this.leafGold.renderOrder = 7;

    this.group.add(this.clouds, this.pillar.mesh, this.groundRig, this.palmRig, this.plates);
    this.group.add(this.groundRing.mesh, this.groundRune.mesh, this.shockDark.mesh, this.shock.mesh, this.shock2.mesh);
    this.group.add(this.glint.mesh, this.pressStar.mesh, this.leafDark, this.leafGold);

    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.3, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.12, speed: 0.4, speedJitter: 0.6, spread: 180, gravity: 0.3, drag: 0.8,
      sizeStart: 0.1, sizeEnd: 0.03, colorStart: '#fffbe8', colorEnd: '#f2b53c', colorMid: '#ffe39a',
      opacityStart: 0.55, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 8, speedJitter: 0.6, spread: 100, gravity: 9, drag: 1.2,
      sizeStart: 0.11, sizeEnd: 0.02, colorStart: '#fffbe8', colorEnd: '#f2b53c',
      opacityStart: 0.85, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    // Small, short, normal-blended dark dust so the gold has something to read against but the print stays clear.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 1.1, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 2.4, speedJitter: 0.6, spread: 75, gravity: -0.1, drag: 1.6,
      sizeStart: 0.5, sizeEnd: 1.1, colorStart: '#8a6a30', colorEnd: '#2a1a06', colorMid: '#4a3414',
      opacityStart: 0.3, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.4, groundFade: 0.3,
    });
    this.emitters.push(this.motes, this.sparks, this.dust);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return PRESS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.point).setY(0);
    this.aim = ctx.aim;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.center).setY(1.2);
    this.groundRig.position.copy(this.center);
    this.groundRig.rotation.y = this.aim + Math.PI;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.pressed = false;
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
    if (!this.pressed && this.time >= PRESS) this.onPress();
    this.layout(dt);
  }

  /** Palm centre position and orientation at time t (analytic, so flakes can start where the palm was). */
  private palmFrame(t: number, pos: THREE.Vector3, quat: THREE.Quaternion) {
    let base: number, tilt: number;
    if (t < DESCEND) { base = 11; tilt = 0.62; }
    else if (t < HOVER) { const e = smoothstep((t - DESCEND) / (HOVER - DESCEND)); base = 11 - 10 * e; tilt = 0.62 - 0.17 * e; }
    else if (t < 1.95) { base = 1; tilt = 0.45; }
    else if (t < PRESS) { const v = (t - 1.95) / (PRESS - 1.95); base = 1 - 0.9 * v * v; tilt = 0.45 - 0.1 * v; }
    else if (t < LIFT) { base = 0.1; tilt = 0.35; }
    else { const w = clamp01((t - LIFT) / 1.1); base = 0.1 + 8 * w * w; tilt = 0.35 + 0.2 * w; }
    // `base` is the height of the wrist end, the lowest point of the tilted hand.
    pos.set(this.center.x, base + Math.sin(tilt) * WRIST_DROP + 0.05, this.center.z);
    quat.setFromEuler(this.tmpEuler.set(Math.PI / 2 - tilt, this.aim, 0, 'YXZ'));
    return base;
  }

  private layout(dt: number) {
    const t = this.time;
    const aw = t - PRESS;
    const live = dt > 0 && this.playing;
    const c = this.center;
    const fadeOut = 1 - smoothstep((t - 3.9) / 0.7);

    // 1. World darkens for the call, holds through the press, eases off over the lift.
    const dark = 0.6 * smoothstep(t / DESCEND);
    this.screen.darken = t < LIFT ? dark : dark * (1 - smoothstep((t - LIFT) / 1.2));
    this.screen.impact = impactFrameAt(t, PRESS, [1, 2], 0.04);
    this.screen.speedLines = 0.5 * smoothstep((t - 1.5) / 0.4) * (t < PRESS ? 1 : 0);
    this.screen.chroma = chromaPulse(t, PRESS, 0.6);

    // 2. Parting clouds high above the spot, sliding outward; a gold light shaft comes down through them.
    const open = smoothstep((t - 0.05) / 1.3);
    for (let i = 0; i < CLOUDS; i++) {
      const s = this.cloudSeed[i];
      const r = s.r0 + (s.r1 - s.r0) * open;
      this.cloudPos[i * 3] = c.x + Math.cos(s.a) * r;
      this.cloudPos[i * 3 + 1] = s.y;
      this.cloudPos[i * 3 + 2] = c.z + Math.sin(s.a) * r;
    }
    this.cloudGeo.attributes.position.needsUpdate = true;
    this.cloudMat.opacity = 0.34 * smoothstep(t / 0.3) * (1 - smoothstep((t - LIFT) / 0.9));
    const shaft = 0.14 * smoothstep((t - 0.1) / 0.6) * (1 - 0.55 * smoothstep((t - 1.2) / 0.5));
    const flash = aw > 0 ? 0.3 * Math.exp(-aw * 7) : 0;
    this.pillar.set(c.x, c.z, 0, 30, (shaft + flash) * (1 - smoothstep((t - 2.6) / 0.4)));
    if (live && t < 1.8 && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 2;
      this.motes.burst(1, new THREE.Vector3(c.x + Math.cos(a) * r, 8 + Math.random() * 5, c.z + Math.sin(a) * r));
    }

    // 3. The palm: pose, translucent dark body, thin bright rim, wrist glyph band.
    const base = this.palmFrame(t, this.tmpPos, this.tmpQuat);
    this.palmRig.position.copy(this.tmpPos);
    this.palmRig.quaternion.copy(this.tmpQuat);
    const settle = aw > 0 ? 1 + 0.05 * Math.exp(-aw * 10) : 1;
    this.palmRig.scale.setScalar(settle);
    const appear = smoothstep((t - 0.6) / 0.4);
    const bodyOn = appear * (1 - smoothstep((t - 2.6) / 0.8)); // body goes first, the outline lingers
    const dim = t > HOVER && t < PRESS ? 0.7 : 1; // dead beat
    this.palmRig.visible = appear > 0.002 && t < 3.7;
    this.bodyMat.opacity = 0.78 * bodyOn;
    this.rimMat.opacity = (0.34 * dim + (aw > 0 ? 0.14 * Math.exp(-aw * 8) : 0)) * appear * (1 - smoothstep((t - 3.0) / 0.6));
    this.glyphTex.offset.x = -Math.min(t, 2.4) * 0.12;
    this.glyphMat.opacity = 0.8 * smoothstep((t - 0.9) / 0.5) * (1 - smoothstep((t - LIFT) / 0.5)) * (aw > 0 ? 1 + 0.4 * Math.exp(-aw * 6) : 1) * dim;

    // Glint on the middle fingertip in the dead beat: a cold-warm cue before the press.
    const tip = new THREE.Vector3(0, (PALM_CY - 80) * M, 0).applyQuaternion(this.tmpQuat).add(this.tmpPos);
    const gl = StarBurst.pop(t - HOVER, 0.1, 0.12);
    this.glint.set(tip, 1.4 * gl.scale, gl.opacity, t * 2);

    // 4. Ground: telegraph rings (they close in a little before the press), palm shadow, crater print.
    const ringOn = smoothstep((t - DESCEND) / 0.3) * (1 - smoothstep((t - 3.2) / 0.5));
    const contract = 1 - 0.12 * smoothstep((t - 1.0) / 1.0);
    this.groundRing.mesh.position.set(c.x, 0.05, c.z);
    this.groundRing.mesh.scale.setScalar(RADIUS * contract);
    this.groundRing.material.opacity = 0.3 * ringOn;
    this.groundRune.mesh.position.set(c.x, 0.055, c.z);
    this.groundRune.mesh.scale.setScalar(RADIUS * contract);
    this.groundRune.mesh.rotation.z = t * 0.3;
    this.groundRune.material.opacity = 0.3 * ringOn;

    const near = 1 - clamp01(base / 11);
    this.shadowMat.opacity = t < PRESS ? (0.12 + 0.4 * near * near) * appear : 0.5 * Math.exp(-aw * 3);
    this.printMat.opacity = aw > 0 ? 0.92 * fadeOut : 0;
    this.printMesh.scale.setScalar(aw > 0 ? 1 + 0.04 * Math.exp(-aw * 14) : 1);
    this.printGlowMat.opacity = aw > 0 ? 0.42 * Math.exp(-aw * 1.3) * fadeOut : 0;

    // 5. Impact: cyan star, shock rings, camera shake.
    const pop = StarBurst.pop(aw, 0.04, 0.12);
    this.pressStar.set(new THREE.Vector3(c.x, 0.7, c.z), 3.4 * pop.scale, pop.opacity, 0.2);
    const sp = clamp01(aw / 0.55);
    this.shock.mesh.position.set(c.x, 0.06, c.z);
    this.shock.mesh.scale.setScalar(1.5 + 8 * (1 - Math.pow(1 - sp, 2)));
    this.shock.material.opacity = aw > 0 ? 0.6 * (1 - sp) : 0;
    this.shockDark.mesh.position.set(c.x, 0.025, c.z);
    this.shockDark.mesh.scale.setScalar(1.4 + 7.4 * (1 - Math.pow(1 - sp, 2)));
    this.shockDark.material.opacity = aw > 0 ? 0.45 * (1 - sp) : 0;
    const a2 = aw - 0.12;
    const sp2 = clamp01(a2 / 0.7);
    this.shock2.mesh.position.set(c.x, 0.065, c.z);
    this.shock2.mesh.scale.setScalar(1.5 + 7 * (1 - Math.pow(1 - sp2, 2)));
    this.shock2.material.opacity = a2 > 0 ? 0.45 * (1 - sp2) : 0;
    const rumble = t < PRESS ? 0.05 * smoothstep((t - DESCEND) / 1.1) * (t > HOVER ? 0.2 : 1) : 0;
    this.shake = Math.max(rumble, aw > 0 ? Math.exp(-aw * 6) : 0);

    // 6. Crater plates: tip up at the press, hang, sink. Never a zero scale.
    const m = new THREE.Matrix4();
    const qf = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const qt = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    for (let i = 0; i < PLATES; i++) {
      const pl = this.plateSeed[i];
      let size = 1e-4;
      let phi = 0;
      let y = 0.1;
      if (aw > 0) {
        const rise = clamp01(aw / 0.12);
        const sink = smoothstep((t - 2.3) / 0.9);
        phi = pl.tilt * rise * (1 - 0.7 * sink);
        y = 0.1 + 0.5 * rise * (1 - sink);
        size = Math.max(1e-4, pl.size * (1 - smoothstep((t - 3.0) / 0.6)));
      }
      axis.set(-Math.sin(pl.a), 0, Math.cos(pl.a));
      qt.setFromAxisAngle(axis, phi).multiply(qf);
      p.set(c.x + Math.cos(pl.a) * pl.r, y, c.z + Math.sin(pl.a) * pl.r);
      sc.setScalar(size);
      m.compose(p, qt, sc);
      this.plates.setMatrixAt(i, m);
    }
    this.plates.instanceMatrix.needsUpdate = true;

    // 7. Gold leaf: flakes peel off the palm where it was when they were born, flutter and settle. Deterministic in t.
    const fp = new THREE.Vector3();
    const fq = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < FLAKES; i++) {
      const fl = this.flake[i];
      const tau = t - fl.birth;
      const life = 1.7;
      let s = 1e-4;
      if (tau > 0 && tau < life) {
        this.palmFrame(fl.birth, this.tmpPos, this.tmpQuat);
        fp.set(fl.lx, fl.ly, 0).applyQuaternion(this.tmpQuat).add(this.tmpPos);
        const out = tau / (1 + tau);
        fp.x += fl.out.x * out + Math.sin(tau * 3 + fl.drift) * 0.15;
        fp.z += fl.out.z * out + Math.cos(tau * 3 + fl.drift) * 0.15;
        fp.y = Math.max(0.06, fp.y + fl.out.y * out - 0.5 * 2.2 * tau * tau);
        const resting = fp.y <= 0.06;
        const spin = resting ? 0 : tau;
        e.set(fl.w.x * spin * 0.5 + (resting ? 1.4 : 0), fl.w.y * spin * 0.5, fl.w.z * spin * 0.5);
        fq.setFromEuler(e);
        s = Math.max(1e-4, fl.size * (1 - smoothstep((tau - (life - 0.4)) / 0.4)));
      } else {
        fp.set(0, -50, 0);
        fq.identity();
      }
      sc.setScalar(s);
      m.compose(fp, fq, sc);
      this.leafGold.setMatrixAt(i, m);
      this.leafDark.setMatrixAt(i, m);
    }
    this.leafGold.instanceMatrix.needsUpdate = true;
    this.leafDark.instanceMatrix.needsUpdate = true;

    // 8. While the palm dissolves, a few gold motes shed from it.
    if (live && t > LIFT && t < 3.4) {
      for (let i = 0; i < 2; i++) {
        this.palmFrame(t, this.tmpPos, this.tmpQuat);
        const pt = new THREE.Vector3((Math.random() - 0.5) * 5, -3 + Math.random() * 11, 0).applyQuaternion(this.tmpQuat).add(this.tmpPos);
        this.motes.burst(2, pt);
      }
    }
  }

  private onPress() {
    this.pressed = true;
    const c = this.center;
    this.sparks.burst(140, new THREE.Vector3(c.x, 0.3, c.z));
    this.motes.burst(60, new THREE.Vector3(c.x, 0.8, c.z));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.dust.burst(7, new THREE.Vector3(c.x + Math.cos(a) * 3.4, 0.1, c.z + Math.sin(a) * 3.4));
    }
    const ctx = this.ctx;
    if (ctx) {
      ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: c.clone() }));
    }
  }
}

export const heavenlyBuddhaPalmModule: EffectModule = {
  label: 'heavenly buddha palm',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new HeavenlyBuddhaPalm(),
  telegraphs(effect) {
    const e = effect as HeavenlyBuddhaPalm;
    const c = e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: DESCEND, impact: PRESS }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as HeavenlyBuddhaPalm;
    if (e.ctx) frameCast(camera, controls, e.ctx, 8);
  },
  buildGui(f, effect) {
    const s = (effect as HeavenlyBuddhaPalm).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'knock', 0, 20, 0.5);
  },
};
