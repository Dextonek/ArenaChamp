import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { smoothstep, softDotTexture } from '../../effects/common';
import {
  SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Ghost Lantern Procession (targeted, `enemies`, up to six targets): six paper lanterns (dark red-black shells,
 * dark ribs, black lacquer caps, gold tassels, a violet ghost flame glowing through the paper) rise one by one
 * round the caster, then drift off in a winding single file. Each peels off to its own target (targets are
 * cycled when there are fewer than six), hangs over it for 0.3 s with the flame flaring, drops and bursts into
 * violet toon ghost fire with a small hit. At D every ghost fire flares together (impact frame, magenta accent,
 * small black blobs, big hit); burnt paper scraps flutter down, wisps rise and the fires shrink to embers.
 */
export interface GhostLanternProcessionSettings {
  lanternDamage: number;
  finalDamage: number;
  loop: boolean;
}

export const defaultGhostLanternProcession = (): GhostLanternProcessionSettings => ({
  lanternDamage: 12, finalDamage: 30, loop: false,
});

const LANTERNS = 6;
const D = 2.8; // synchronised flare
const HIT2 = D + 0.05;
const DURATION = 4.6;
const VIOLET = 0x8a2ee0;
const HOT = 0xd68cff;
const MAGENTA = 0xff3fa0;
const LANT_W = 1.2;
const LANT_H = 2.0;
const FLAME_W = 1.5;
const FLAME_H = 3.0;
const HOVER_Y = 3.6; // height of the lantern hook over a target's feet

const rise = (i: number) => 0.1 + 0.08 * i;
const depart = (i: number) => 0.8 + 0.12 * i;
const arrive = (i: number) => 1.6 + 0.12 * i;
const dropAt = (i: number) => arrive(i) + 0.3;
const burstAt = (i: number) => arrive(i) + 0.5;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3);
const easeOutBack = (x: number) => {
  const k = THREE.MathUtils.clamp(x, 0, 1) - 1;
  return 1 + 2.2 * k * k * k + 1.2 * k * k;
};

/** A paper lantern drawn on a canvas (192 x 320): hook at the top centre, tassel at the bottom. Hard edges, black outline. */
function lanternTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 192;
  cv.height = 320;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const cx = 96;
  // Hook ring.
  g.lineWidth = 12;
  g.strokeStyle = '#000000';
  g.beginPath(); g.arc(cx, 20, 11, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 5;
  g.strokeStyle = '#c9a24a';
  g.beginPath(); g.arc(cx, 20, 11, 0, Math.PI * 2); g.stroke();
  // Paper body: a plump barrel, wider in the middle.
  const body = new Path2D();
  body.moveTo(cx - 52, 64);
  body.bezierCurveTo(cx - 98, 100, cx - 98, 200, cx - 52, 238);
  body.lineTo(cx + 52, 238);
  body.bezierCurveTo(cx + 98, 200, cx + 98, 100, cx + 52, 64);
  body.closePath();
  g.save();
  g.clip(body);
  g.fillStyle = '#2a0710'; // darkest paper at the rim
  g.fillRect(0, 0, 192, 320);
  const layer = (sx: number, sy: number, color: string) => {
    g.save();
    g.translate(cx, 151);
    g.scale(sx, sy);
    g.fillStyle = color;
    g.beginPath(); g.arc(0, 0, 100, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  layer(0.92, 0.9, '#4a0d18');
  layer(0.74, 0.76, '#661522');
  // The ghost flame behind the paper: a violet window with a darker ring, then a paler heart.
  layer(0.52, 0.5, '#4a1a78');
  layer(0.38, 0.4, '#8a2ee0');
  layer(0.2, 0.24, '#d68cff');
  // Dark ribs bow outward and meet at the caps.
  g.lineWidth = 4;
  g.strokeStyle = '#14040a';
  for (const k of [-0.9, -0.55, -0.18, 0.18, 0.55, 0.9]) {
    g.beginPath();
    g.moveTo(cx + k * 52, 62);
    g.quadraticCurveTo(cx + k * 128, 151, cx + k * 52, 240);
    g.stroke();
  }
  // A horizontal paper band.
  g.lineWidth = 3;
  g.strokeStyle = '#14040a';
  g.beginPath(); g.moveTo(0, 104); g.quadraticCurveTo(cx, 116, 192, 104); g.stroke();
  g.beginPath(); g.moveTo(0, 198); g.quadraticCurveTo(cx, 210, 192, 198); g.stroke();
  g.restore();
  g.lineWidth = 8;
  g.strokeStyle = '#000000';
  g.stroke(body);
  // Black lacquer caps with a gold line.
  const cap = (y: number, h: number) => {
    g.fillStyle = '#0c0508';
    g.fillRect(cx - 54, y, 108, h);
    g.lineWidth = 6;
    g.strokeStyle = '#000000';
    g.strokeRect(cx - 54, y, 108, h);
    g.fillStyle = '#c9a24a';
    g.fillRect(cx - 50, y + h / 2 - 2, 100, 4);
  };
  cap(44, 22);
  cap(236, 22);
  // Tassel: cord, gold knot, hanging strands.
  g.lineWidth = 9;
  g.strokeStyle = '#000000';
  g.beginPath(); g.moveTo(cx, 258); g.lineTo(cx, 280); g.stroke();
  g.lineWidth = 4;
  g.strokeStyle = '#c9a24a';
  g.beginPath(); g.moveTo(cx, 258); g.lineTo(cx, 280); g.stroke();
  g.fillStyle = '#000000';
  g.beginPath(); g.arc(cx, 282, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9a24a';
  g.beginPath(); g.arc(cx, 282, 7, 0, Math.PI * 2); g.fill();
  const tassel = new Path2D();
  tassel.moveTo(cx - 12, 290);
  tassel.lineTo(cx + 12, 290);
  tassel.lineTo(cx + 20, 316);
  tassel.lineTo(cx - 20, 316);
  tassel.closePath();
  g.fillStyle = '#d2ae55';
  g.fill(tassel);
  g.lineWidth = 3;
  g.strokeStyle = '#000000';
  g.stroke(tassel);
  g.lineWidth = 2;
  g.strokeStyle = '#7a5a1c';
  for (const k of [-8, 0, 8]) { g.beginPath(); g.moveTo(cx + k * 0.6, 292); g.lineTo(cx + k * 1.8, 314); g.stroke(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Violet ghost fire (128 x 256): three tongues, base at the bottom centre, a nested value ramp with a dark heart. */
function flameTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 256;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  const shape = new Path2D();
  shape.moveTo(14, 250);
  shape.bezierCurveTo(-4, 190, 22, 150, 26, 104); // left outer edge
  shape.bezierCurveTo(34, 124, 42, 128, 46, 120); // left tongue tip notch
  shape.bezierCurveTo(44, 80, 56, 40, 64, 6); // up the central tongue
  shape.bezierCurveTo(78, 44, 86, 84, 84, 118);
  shape.bezierCurveTo(90, 126, 98, 120, 104, 98); // right tongue
  shape.bezierCurveTo(112, 150, 134, 190, 114, 250);
  shape.closePath();
  const layer = (scale: number, color: string, stroke?: string, w = 0) => {
    g.save();
    g.translate(64, 246);
    g.scale(scale, scale);
    g.translate(-64, -246);
    g.fillStyle = color;
    g.fill(shape);
    if (stroke) { g.lineWidth = w / scale; g.strokeStyle = stroke; g.stroke(shape); }
    g.restore();
  };
  layer(1, '#8a2ee0', '#000000', 8);
  layer(0.8, '#b45cf0', '#2a0f4a', 3);
  layer(0.58, '#d68cff');
  layer(0.34, '#f0d8ff');
  // Dark heart at the base so the fire has a black core under the brightest layer.
  g.fillStyle = '#07030c';
  g.beginPath(); g.ellipse(64, 226, 24, 26, 0, 0, Math.PI * 2); g.fill();
  // Magenta accent at the very tip.
  g.fillStyle = '#ff3fa0';
  g.beginPath(); g.moveTo(64, 6); g.lineTo(58, 36); g.lineTo(70, 36); g.closePath(); g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class GhostLanternProcession implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GhostLanternProcessionSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private burst: boolean[] = Array(LANTERNS).fill(false);
  private finalDone = false;
  private smokeDone = false;

  // Cast geometry.
  private from = new THREE.Vector3();
  private centroid = new THREE.Vector3();
  private firePos: THREE.Vector3[] = Array.from({ length: LANTERNS }, () => new THREE.Vector3());
  private hoverPos: THREE.Vector3[] = Array.from({ length: LANTERNS }, () => new THREE.Vector3());
  private targetIdx: number[] = Array(LANTERNS).fill(0);
  private orbitBase = 0;

  // Lanterns, glows, flames.
  private lanterns: THREE.Mesh[] = [];
  private glows: THREE.Mesh[] = [];
  private flames: THREE.Mesh[] = [];
  private flames2: THREE.Mesh[] = [];
  private stars: StarBurst[] = [];
  private smoke = new SmokeBall({ maxBalls: LANTERNS * 2, color: 0x07030c, rim: 0x3a1a5a, flake: 0x07030c });

  private wisps: Emitter;
  private embers: Emitter;
  private scraps: Emitter;

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private tmpD = new THREE.Vector3();
  private lastP: THREE.Vector3[] = Array.from({ length: LANTERNS }, () => new THREE.Vector3());

  constructor(settings: GhostLanternProcessionSettings = defaultGhostLanternProcession()) {
    this.settings = settings;
    this.screen.tint.set(0x14061e);
    this.screen.impactColor.set(MAGENTA);
    this.screen.edgeTint.set(VIOLET);
    this.screen.speedLineColor.set(HOT);

    const camQ = new THREE.Quaternion();
    const parentQ = new THREE.Quaternion();
    const billboard = (mesh: THREE.Mesh, roll: () => number) => {
      mesh.frustumCulled = false;
      mesh.onBeforeRender = (_r, _s, camera) => {
        this.group.getWorldQuaternion(parentQ);
        camera.getWorldQuaternion(camQ);
        mesh.quaternion.copy(parentQ.invert().multiply(camQ));
        mesh.rotateZ(roll());
        mesh.updateMatrixWorld(true);
      };
    };

    // Lanterns pivot at the hook (the geometry hangs below its origin); the inner glow is a child over the paper.
    const lanternTex = lanternTexture();
    const lanternGeo = new THREE.PlaneGeometry(LANT_W, LANT_H);
    lanternGeo.translate(0, -LANT_H / 2, 0);
    const glowGeo = new THREE.PlaneGeometry(1, 1);
    const glowTex = softDotTexture();
    const flameTex = flameTexture();
    const flameGeo = new THREE.PlaneGeometry(FLAME_W, FLAME_H);
    flameGeo.translate(0, FLAME_H / 2, 0);
    for (let i = 0; i < LANTERNS; i++) {
      const lantern = new THREE.Mesh(lanternGeo, new THREE.MeshBasicMaterial({
        map: lanternTex, transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide,
      }));
      lantern.renderOrder = 10 + i;
      lantern.visible = false;
      billboard(lantern, () => 0.14 * Math.sin(this.time * 2.3 + i * 1.7) * (this.time < burstAt(i) ? 1 : 0));
      const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
        map: glowTex, color: VIOLET, transparent: true, opacity: 0.3, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      glow.position.set(0, -0.92, 0.01);
      glow.scale.setScalar(0.85);
      glow.renderOrder = 40 + i;
      glow.frustumCulled = false;
      lantern.add(glow);
      this.lanterns.push(lantern);
      this.glows.push(glow);
      this.group.add(lantern);

      for (const list of [this.flames, this.flames2]) {
        const flame = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({
          map: flameTex, transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide,
        }));
        flame.renderOrder = 60 + i * 2 + (list === this.flames2 ? 1 : 0);
        flame.visible = false;
        billboard(flame, () => 0);
        list.push(flame);
        this.group.add(flame);
      }

      const star = new StarBurst({ points: 6, inner: 0.3, color: MAGENTA, core: HOT, additive: false });
      star.mesh.renderOrder = 80;
      this.stars.push(star);
      this.group.add(star.mesh);
    }

    this.smoke.hold = 0.15;
    this.wisps = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.12, speed: 0.4, speedJitter: 0.8, spread: 180, gravity: -0.8, drag: 1.6,
      sizeStart: 0.28, sizeEnd: 0.02, colorStart: '#d68cff', colorEnd: '#8a2ee0',
      opacityStart: 0.28, opacityEnd: 0, additive: true, colorMid: '#b45cf0', sizeJitter: 0.4, erosion: 0.5, spin: 0.5,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 1.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 1.0, speedJitter: 0.7, spread: 40, gravity: -1.4, drag: 0.8,
      sizeStart: 0.14, sizeEnd: 0, colorStart: '#f0d8ff', colorEnd: '#ff3fa0',
      opacityStart: 0.5, opacityEnd: 0, additive: true, colorMid: '#d68cff', sizeJitter: 0.5, erosion: 0.5, spin: 0.4,
    });
    // Burnt paper: dark red-black, normal-blended, tumbling down.
    this.scraps = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 1.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 2.0, speedJitter: 0.7, spread: 120, gravity: 1.6, drag: 1.4,
      sizeStart: 0.2, sizeEnd: 0.12, colorStart: '#6a1522', colorEnd: '#14040a',
      opacityStart: 1, opacityEnd: 0, additive: false, colorMid: '#2a0710', sizeJitter: 0.5, erosion: 0, spin: 3,
    });
    this.emitters.push(this.wisps, this.embers, this.scraps, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.group.add(this.smoke.mesh);
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
    this.from.copy(ctx.from);
    this.orbitBase = ctx.aim + Math.PI;
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    this.centroid.set(0, 0, 0);
    for (const p of pts) this.centroid.add(p);
    this.centroid.divideScalar(pts.length).setY(0);
    const fwd = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    for (let i = 0; i < LANTERNS; i++) {
      const j = i % pts.length;
      const lap = Math.floor(i / pts.length);
      this.targetIdx[i] = j;
      // Repeat visits to the same enemy hang to the side so the fires do not stack.
      const side = lap === 0 ? 0 : (lap % 2 ? 0.7 : -0.7);
      this.firePos[i].copy(pts[j]).setY(0.15).addScaledVector(right, side);
      this.hoverPos[i].copy(this.firePos[i]).setY(HOVER_Y);
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.finalDone = false;
    this.smokeDone = false;
    this.burst.fill(false);
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.wisps.update(dt);
    this.embers.update(dt);
    this.scraps.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    for (let i = 0; i < LANTERNS; i++) if (!this.burst[i] && this.time >= burstAt(i)) this.onBurst(i);
    if (!this.finalDone && this.time >= HIT2) this.onFinal();
    if (!this.smokeDone && this.time >= D + 0.1) this.onSmoke();
    this.layout(dt);
  }

  /** Where lantern i floats while it circles the caster (hook position). */
  private orbitPos(i: number, t: number, out: THREE.Vector3) {
    const ang = this.orbitBase + (i / LANTERNS) * Math.PI * 2 + t * 0.5;
    const r = 2.0 + 0.2 * Math.sin(t * 1.3 + i);
    const h = 0.8 + 2.2 * easeOutCubic((t - rise(i)) / 0.7) + 0.12 * Math.sin(t * 2 + i * 1.3);
    return out.set(this.from.x + Math.sin(ang) * r, h + 0.9, this.from.z + Math.cos(ang) * r);
  }

  private layout(dt: number) {
    const t = this.time;
    const afterD = t - D;
    const live = t < DURATION;

    // --- World grade, speed lines into the flare, impact frame, chroma. ---
    this.screen.darken = t < D ? 0.75 * smoothstep(t / 0.8) : 0.75 * Math.exp(-Math.max(0, afterD - 0.1) * 2.0);
    this.screen.speedLines = t < D ? 0.4 * smoothstep((t - (D - 0.3)) / 0.3) : Math.max(0, 0.4 - afterD * 4);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, HIT2, 0.6);

    // --- Lanterns: rise round the caster, wind to their target, hang, drop. ---
    for (let i = 0; i < LANTERNS; i++) {
      const lantern = this.lanterns[i];
      const glow = this.glows[i];
      const p = this.tmpA;
      const t0 = rise(i), td = depart(i), ta = arrive(i), tdrop = dropAt(i), tb = burstAt(i);
      if (!live || t < t0 || t >= tb) { lantern.visible = false; continue; }
      lantern.visible = true;
      let size = easeOutBack((t - t0) / 0.4);
      let flare = 0;
      if (t < td) {
        this.orbitPos(i, t, p);
      } else if (t < ta) {
        const u = (t - td) / (ta - td);
        const ue = u * u * (3 - 2 * u);
        const a = this.orbitPos(i, td, this.tmpB);
        const b = this.hoverPos[i];
        const d = this.tmpC.copy(b).sub(a);
        const dist = Math.max(d.length(), 1e-3);
        // A winding path: an S-curve sideways (phase set by the lantern) and a lazy rise-and-settle in height.
        const side = this.tmpD.set(-d.z, 0, d.x);
        if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
        side.normalize();
        const sway = Math.sin(ue * Math.PI * 2) * dist * 0.14 * (i % 2 ? 1 : -1) * (1 - ue * 0.3);
        p.copy(a).lerp(b, ue).addScaledVector(side, sway);
        p.y += Math.sin(ue * Math.PI) * 0.9;
        if (dt > 0) this.wisps.burst(1, this.tmpB.copy(p).setY(p.y - 1.0));
      } else if (t < tdrop) {
        p.copy(this.hoverPos[i]);
        p.y += 0.08 * Math.sin((t - ta) * 14);
        flare = smoothstep((t - ta) / 0.25);
        if (dt > 0 && Math.random() < 0.5) this.wisps.burst(1, this.tmpB.copy(p).setY(p.y - 0.9));
      } else {
        // Drop: accelerate down onto the target.
        const u = (t - tdrop) / (tb - tdrop);
        p.copy(this.hoverPos[i]);
        p.y = THREE.MathUtils.lerp(HOVER_Y, this.firePos[i].y + 1.6, u * u);
        flare = 1;
      }
      this.lastP[i].copy(p);
      lantern.position.copy(p);
      size *= 1 + 0.14 * flare;
      lantern.scale.setScalar(Math.max(1e-3, 1.25 * size));
      // Inner light: gentle flicker, brighter on the flare (additive, kept small and <= 0.5).
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.26 + 0.2 * flare + 0.04 * Math.sin(t * 31 + i * 2);
      glow.scale.setScalar(0.85 + 0.25 * flare);
    }

    // --- Ghost fire on each target: pop in at the burst, flare together at D, shrink to embers. ---
    const big = t >= HIT2;
    for (let i = 0; i < LANTERNS; i++) {
      const f1 = this.flames[i], f2 = this.flames2[i];
      const tb = burstAt(i);
      if (!live || t < tb) {
        f1.visible = false; f2.visible = false;
        this.stars[i].set(this.tmpA.set(0, 0, 0), 0, 0);
        continue;
      }
      const flick = 1 + 0.07 * Math.sin(t * 33 + i * 2.1);
      const grow = easeOutBack((t - tb) / 0.2);
      const flare = t >= D ? 1 + 0.6 * Math.exp(-(t - D) * 3.2) : 1;
      const shrink = 1 - 0.82 * smoothstep((t - (D + 0.7)) / 1.1);
      const s = Math.max(1e-3, 0.75 * grow * flare * shrink * flick);
      f1.visible = true;
      f1.position.copy(this.firePos[i]);
      f1.scale.set(s, s * (1 + 0.06 * Math.sin(t * 21 + i)), s);
      f2.visible = true;
      f2.position.copy(this.firePos[i]).add(this.tmpB.set(0.38 * (i % 2 ? 1 : -1), 0, 0.1));
      const s2 = s * 0.6;
      f2.scale.set(-s2, s2 * (1 + 0.1 * Math.sin(t * 27 + i * 3)), s2);

      // Small violet/magenta hit pop on the burst, a bigger one at D (never white).
      const age = big ? t - HIT2 - i * 0.015 : t - tb;
      const pop = StarBurst.pop(age);
      if (pop.opacity === 0) this.stars[i].set(this.tmpA.set(0, 0, 0), 0, 0);
      else this.stars[i].set(this.tmpA.copy(this.firePos[i]).setY(1.1), (big ? 2.6 : 1.3) * pop.scale, pop.opacity, i * 0.7);
      if (dt > 0 && t < DURATION - 0.3 && Math.random() < 0.35 * shrink) {
        this.wisps.burst(1, this.tmpA.copy(this.firePos[i]).setY(0.4 + 1.4 * Math.random()));
      }
      if (dt > 0 && t > D + 0.7 && Math.random() < 0.25) this.embers.burst(1, this.tmpA.copy(this.firePos[i]).setY(0.6));
    }

    // --- Shake: a tick per burst, one heavy hit at the flare. ---
    let sh = 0;
    for (let i = 0; i < LANTERNS; i++) { const a = t - burstAt(i); if (a >= 0) sh = Math.max(sh, 0.12 * Math.exp(-a * 14)); }
    if (t >= HIT2) sh = Math.max(sh, 0.7 * Math.exp(-(t - HIT2) * 7));
    this.shake = sh;
  }

  private onBurst(i: number) {
    this.burst[i] = true;
    const ctx = this.ctx;
    this.wisps.burst(10, this.tmpA.copy(this.firePos[i]).setY(0.8));
    this.scraps.burst(8, this.tmpA.copy(this.lastP[i]).setY(Math.max(1.2, this.lastP[i].y - 0.8)));
    this.smoke.trigger(this.tmpA.copy(this.firePos[i]).setY(0.6), 0.7, 0.35);
    const e = ctx?.targets[this.targetIdx[i]];
    if (!ctx || !e) return;
    ctx.hit(e, { damage: this.settings.lanternDamage, knock: 1, from: this.lastP[i], color: '#d68cff' });
  }

  private onFinal() {
    this.finalDone = true;
    const ctx = this.ctx;
    for (let i = 0; i < LANTERNS; i++) {
      this.embers.burst(14, this.tmpA.copy(this.firePos[i]).setY(1.0));
      this.wisps.burst(10, this.tmpA.copy(this.firePos[i]).setY(1.0));
    }
    if (!ctx) return;
    ctx.targets.forEach((e) => {
      ctx.hit(e, { damage: this.settings.finalDamage, knock: 4, from: this.centroid, color: '#ff3fa0' });
    });
  }

  /** Small black blobs on each fire at the flare, plus a late shower of burnt paper. */
  private onSmoke() {
    this.smokeDone = true;
    for (let i = 0; i < LANTERNS; i++) {
      this.smoke.trigger(this.tmpA.copy(this.firePos[i]).setY(1.0), 0.9, 0.4);
      this.scraps.burst(10, this.tmpA.copy(this.firePos[i]).setY(2.2));
    }
  }
}

export const ghostLanternProcessionModule: EffectModule = {
  label: 'ghost lantern procession',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: LANTERNS },
  create: () => new GhostLanternProcession(),
  telegraphs(effect) {
    const e = effect as GhostLanternProcession;
    const pts = e.ctx?.targetPos ?? [];
    return pts.map((p, j) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.4 }, start: depart(j) + 0.2, impact: D,
    }));
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as GhostLanternProcession;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as GhostLanternProcession).settings;
    f.add(s, 'loop');
    f.add(s, 'lanternDamage', 1, 60, 1).name('lantern damage');
    f.add(s, 'finalDamage', 1, 150, 1).name('final damage');
  },
};
