import * as THREE from 'three';
import { Emitter, defaultSettings } from '../emitter';
import { Enemy, createGround, smoothstep } from './common';
import type { Effect, EffectModule } from './types';

/**
 * "Lightning strike": a storm cloud gathers above the enemy with arcs crackling inside it and around
 * its feet, then a rapid series of jagged bolts hits it, scorching the ground and crushing it on the
 * last one. Smoke and residual ground arcs linger in the aftermath.
 */
export interface LightningSettings {
  boltCount: number;
  cloudHeight: number;
  chargeTime: number; // seconds of build-up before the first bolt
  branchiness: number; // 0..1, how many side branches each bolt grows
  jaggedness: number; // 0..1, sideways wobble of the bolt path
  boltThickness: number; // core width in world units
  boltColor: string;
  glowColor: string;
  loop: boolean;
}

export const defaultLightning = (): LightningSettings => ({
  boltCount: 5,
  cloudHeight: 18,
  chargeTime: 1.5,
  branchiness: 0.6,
  jaggedness: 0.35,
  boltThickness: 0.12,
  boltColor: '#eef4ff',
  glowColor: '#6a9bff',
  loop: false,
});

const BOLT_GAP = 0.14; // seconds between bolt starts
const BOLT_LIFE = 0.3;
const LAST_BOLT_LIFE = 0.5;
const REGEN = 0.05; // bolts rebuild their shape this often while alive
const AFTERMATH = 3;
const FADE = 1.2;
const MAX_BOLTS = 8;
const BOLT_SEGMENTS = 500;
const ENEMY_BASE = 0x5a1820;
const ENEMY_CHAR = 0x0b0908;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Path {
  pts: THREE.Vector3[];
  w: number; // width factor relative to the base width
}

/** Midpoint displacement: pushes `b` (and recursively the midpoints) onto `out`, `a` is already there. */
function subdivide(a: THREE.Vector3, b: THREE.Vector3, jag: number, depth: number, out: THREE.Vector3[]) {
  if (depth <= 0) { out.push(b.clone()); return; }
  const d = b.clone().sub(a);
  const len = d.length();
  d.divideScalar(len || 1);
  const p1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? X_AXIS : Y_AXIS).normalize();
  const p2 = new THREE.Vector3().crossVectors(d, p1);
  const amp = len * jag * 0.5;
  const mid = a.clone().add(b).multiplyScalar(0.5)
    .addScaledVector(p1, rand(-1, 1) * amp)
    .addScaledVector(p2, rand(-1, 1) * amp);
  subdivide(a, mid, jag, depth - 1, out);
  subdivide(mid, b, jag, depth - 1, out);
}

function jaggedPath(a: THREE.Vector3, b: THREE.Vector3, jag: number, depth: number): THREE.Vector3[] {
  const out = [a.clone()];
  subdivide(a, b, jag, depth, out);
  return out;
}

function randomUnit(): THREE.Vector3 {
  return new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
}

/** A jagged main path from `from` to `to` with random side branches (and the odd twig on a branch). */
function genBolt(
  from: THREE.Vector3, to: THREE.Vector3, jag: number, branchiness: number,
  depth: number, branchLen: number, downward: boolean,
): Path[] {
  const main = jaggedPath(from, to, jag, depth);
  const paths: Path[] = [{ pts: main, w: 1 }];
  const branch = (src: THREE.Vector3, dirHint: THREE.Vector3, len: number, w: number, d: number) => {
    const dir = dirHint.clone().addScaledVector(randomUnit(), 0.9);
    if (downward) dir.y = -Math.abs(dir.y);
    dir.normalize();
    const end = src.clone().addScaledVector(dir, len);
    const pts = jaggedPath(src, end, jag, d);
    paths.push({ pts, w });
    return pts;
  };
  for (let k = 1; k < main.length - 1; k++) {
    if (Math.random() >= branchiness * 0.4) continue;
    const hint = main[k + 1].clone().sub(main[k - 1]).normalize();
    const pts = branch(main[k], hint, branchLen * rand(0.4, 1.2), 0.5, 3);
    if (Math.random() < 0.3 * branchiness) {
      const m = pts.length >> 1;
      branch(pts[m], pts[m + 1].clone().sub(pts[m - 1]).normalize(), branchLen * rand(0.2, 0.5), 0.3, 2);
    }
  }
  return paths;
}

/** Flattens paths onto the ground plane (small upward wobble only). */
function flatten(paths: Path[], y: number) {
  for (const p of paths) for (const v of p.pts) v.y = y + Math.min(Math.abs(v.y - y), 0.15);
}

/**
 * Many thin line segments in one dynamic mesh. Each segment is two crossed flat quads so it reads
 * from any direction without needing the camera. The buffer is reused, never reallocated.
 */
class ArcMesh {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  private geometry = new THREE.BufferGeometry();
  private positions: Float32Array;
  private attr: THREE.BufferAttribute;
  private count = 0; // floats written
  private readonly capacity: number;
  private d = new THREE.Vector3();
  private p1 = new THREE.Vector3();
  private p2 = new THREE.Vector3();

  constructor(segmentCapacity: number, opacity = 1) {
    this.capacity = segmentCapacity;
    this.positions = new Float32Array(segmentCapacity * 12 * 3);
    this.attr = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.attr);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Sets the colour; `gain` brightens it (keep the result's components <= 2). */
  setColor(hex: string, gain: number) {
    this.material.color.set(hex).multiplyScalar(gain);
  }

  begin() { this.count = 0; }

  addPath(pts: THREE.Vector3[], width: number) {
    const h = width * 0.5;
    for (let i = 0; i < pts.length - 1; i++) {
      if (this.count + 36 > this.capacity * 36) return;
      const a = pts[i], b = pts[i + 1];
      this.d.subVectors(b, a);
      if (this.d.lengthSq() < 1e-8) continue;
      this.d.normalize();
      this.p1.crossVectors(this.d, Math.abs(this.d.y) > 0.9 ? X_AXIS : Y_AXIS).normalize().multiplyScalar(h);
      this.p2.crossVectors(this.d, this.p1).normalize().multiplyScalar(h);
      this.quad(a, b, this.p1);
      this.quad(a, b, this.p2);
    }
  }

  end() {
    this.attr.needsUpdate = true;
    this.geometry.setDrawRange(0, this.count / 3);
    this.mesh.visible = this.count > 0;
  }

  hide() { this.mesh.visible = false; }

  private quad(a: THREE.Vector3, b: THREE.Vector3, o: THREE.Vector3) {
    const p = this.positions;
    let n = this.count;
    const put = (v: THREE.Vector3, s: number) => {
      p[n++] = v.x + o.x * s; p[n++] = v.y + o.y * s; p[n++] = v.z + o.z * s;
    };
    put(a, -1); put(a, 1); put(b, 1);
    put(a, -1); put(b, 1); put(b, -1);
    this.count = n;
  }
}

interface Bolt {
  core: ArcMesh;
  glow: ArcMesh;
  start: number;
  life: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  fired: boolean;
  lastGen: number;
}

export class LightningStrike implements Effect {
  readonly group = new THREE.Group();
  readonly settings: LightningSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private bolts: Bolt[] = [];
  private boltCount = 0;
  private hits = 0;
  private strikeEnd = 0;
  private flash = 0;
  private glowAmt = 0;
  private groundAmt = 0;
  private enemyFlash = 0;
  private cloudT = 0;
  private ringT = 0;
  private groundT = 0;

  private enemy = new Enemy();
  private enemyColor = new THREE.Color(ENEMY_BASE);
  private charColor = new THREE.Color(ENEMY_CHAR);

  private cloud = new THREE.Group();
  private puffMat = new THREE.MeshBasicMaterial({ color: 0x20232e, transparent: true, opacity: 0.85, depthWrite: false });
  private underGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.35, 0.5, 1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private sphereGeo = new THREE.SphereGeometry(1, 20, 12);
  private cloudArcs = new ArcMesh(300);
  private ringArcs = new ArcMesh(120);
  private groundArcs = new ArcMesh(400);

  private flashLight = new THREE.PointLight(0xaac8ff, 0, 120, 1.2);
  private flashDome = new THREE.Mesh(
    new THREE.SphereGeometry(50, 16, 10),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.5, 0.7, 1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.BackSide,
    }),
  );
  private glowSphere = new THREE.Mesh(
    this.sphereGeo,
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, 1.3, 2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  private scorchDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 40),
    new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0, depthWrite: false }),
  );
  private scorchRing = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 2.8, 40),
    new THREE.MeshBasicMaterial({ color: 0x15100d, transparent: true, opacity: 0, depthWrite: false }),
  );

  private staticFx: Emitter;
  private sparks: Emitter;
  private smoke: Emitter;

  private v1 = new THREE.Vector3();

  constructor(settings: LightningSettings = defaultLightning()) {
    this.settings = settings;
    this.group.add(createGround());
    this.group.add(this.enemy.group);

    for (const m of [this.scorchDisc, this.scorchRing]) {
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.012;
      m.renderOrder = 1;
      this.group.add(m);
    }
    this.scorchRing.position.y = 0.014;

    // Cloud: a few big flattened puffs plus a bluish underglow that lights up with every flash.
    const puffs = 9;
    for (let i = 0; i < puffs; i++) {
      const a = (i / puffs) * Math.PI * 2 + rand(-0.3, 0.3);
      const d = i === 0 ? 0 : rand(2.5, 5);
      const r = rand(2.6, 4.2);
      const puff = new THREE.Mesh(this.sphereGeo, this.puffMat);
      puff.position.set(Math.cos(a) * d, rand(-0.4, 0.6), Math.sin(a) * d);
      puff.scale.set(r, r * 0.3, r);
      this.cloud.add(puff);
    }
    const under = new THREE.Mesh(this.sphereGeo, this.underGlowMat);
    under.position.y = -0.7;
    under.scale.set(5.5, 0.8, 5.5);
    this.cloud.add(under);
    this.group.add(this.cloud);

    this.group.add(this.cloudArcs.mesh, this.ringArcs.mesh, this.groundArcs.mesh);
    for (let i = 0; i < MAX_BOLTS; i++) {
      const bolt: Bolt = {
        core: new ArcMesh(BOLT_SEGMENTS), glow: new ArcMesh(BOLT_SEGMENTS),
        start: 0, life: BOLT_LIFE, from: new THREE.Vector3(), to: new THREE.Vector3(), fired: false, lastGen: 0,
      };
      this.group.add(bolt.glow.mesh, bolt.core.mesh);
      this.bolts.push(bolt);
    }

    this.flashLight.position.set(0, 4, 0);
    this.flashDome.visible = false;
    this.glowSphere.visible = false;
    this.group.add(this.flashLight, this.flashDome, this.glowSphere);

    this.staticFx = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.4, originY: 0.2, speed: 1.6, speedJitter: 0.5, spread: 35, gravity: -0.4, drag: 0.5,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#cfe0ff', colorEnd: '#6a9bff', opacityStart: 0.5, opacityEnd: 0, additive: true,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 2500, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'point', shapeSize: 0, speed: 8, speedJitter: 0.6, spread: 80, gravity: 14, drag: 0.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#f2f7ff', colorEnd: '#6a9bff', opacityStart: 0.9, opacityEnd: 0, additive: true,
    });
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.6, originY: 0.3, speed: 1.4, speedJitter: 0.5, spread: 25, gravity: -0.5, drag: 1.2,
      sizeStart: 0.8, sizeEnd: 3, colorStart: '#55565c', colorEnd: '#1c1c20', opacityStart: 0.3, opacityEnd: 0, additive: false,
    });
    this.emitters.push(this.staticFx, this.sparks, this.smoke);
    for (const e of this.emitters) this.group.add(e.points);

    this.applyStyle();
    this.layout(0);
  }

  /** Pushes the colour settings to materials, light and emitters. */
  applyStyle() {
    const s = this.settings;
    for (const b of this.bolts) {
      b.core.setColor(s.boltColor, 1.5);
      b.glow.setColor(s.glowColor, 1.2);
    }
    this.cloudArcs.setColor(s.glowColor, 1.3);
    this.ringArcs.setColor(s.boltColor, 1.2);
    this.groundArcs.setColor(s.glowColor, 1.4);
    this.flashLight.color.set(s.glowColor).lerp(new THREE.Color(1, 1, 1), 0.4);
    this.sparks.settings.colorStart = s.boltColor;
    this.sparks.settings.colorEnd = s.glowColor;
    this.staticFx.settings.colorEnd = s.glowColor;
    this.sparks.applyStyle();
    this.staticFx.applyStyle();
  }

  get duration() {
    return this.strikeEnd + AFTERMATH;
  }

  play() {
    const s = this.settings;
    this.boltCount = THREE.MathUtils.clamp(Math.round(s.boltCount), 1, MAX_BOLTS);
    this.time = 0;
    this.hits = 0;
    this.flash = 0;
    this.glowAmt = 0;
    this.groundAmt = 0;
    this.enemyFlash = 0;
    this.cloudT = this.ringT = this.groundT = 0;
    this.shake = 0;
    this.enemy.reset();
    this.enemy.material.color.copy(this.enemyColor.set(ENEMY_BASE));
    for (const e of this.emitters) e.clear();

    for (let i = 0; i < MAX_BOLTS; i++) {
      const b = this.bolts[i];
      b.fired = false;
      b.lastGen = -1;
      b.core.hide();
      b.glow.hide();
      if (i >= this.boltCount) continue;
      const last = i === this.boltCount - 1;
      b.start = s.chargeTime + i * BOLT_GAP + (last ? 0.05 : rand(0, 0.04));
      b.life = last ? LAST_BOLT_LIFE : BOLT_LIFE;
      b.from.set(rand(-2.5, 2.5), s.cloudHeight - 0.8, rand(-2.5, 2.5));
      // The last bolt hits the enemy dead on; earlier ones strike around it.
      const r = last ? 0 : rand(0.3, 1.4), a = rand(0, Math.PI * 2);
      b.to.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    const lastBolt = this.bolts[this.boltCount - 1];
    this.strikeEnd = lastBolt.start + lastBolt.life;
    this.playing = true;
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }

    this.shake *= Math.exp(-dt * 7);
    this.flash *= Math.exp(-dt * 9);
    this.glowAmt *= Math.exp(-dt * 6);
    this.groundAmt *= Math.exp(-dt * 2.5);
    this.enemyFlash *= Math.exp(-dt * 8);

    for (let i = 0; i < this.boltCount; i++) {
      const b = this.bolts[i];
      if (!b.fired && this.time >= b.start) this.onStrike(i);
    }
    this.layout(dt);
  }

  private onStrike(i: number) {
    const b = this.bolts[i];
    const last = i === this.boltCount - 1;
    b.fired = true;
    this.hits++;
    this.flash = 1;
    this.glowAmt = 1;
    this.groundAmt = 1;
    this.groundT = 1; // regenerate the ground arcs right away
    this.enemyFlash = 0.5;
    this.shake = Math.min(this.shake + (last ? 0.6 : 0.3), 0.7);
    this.v1.set(b.to.x, 0.1, b.to.z);
    this.sparks.burst(last ? 500 : 220, this.v1);
  }

  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const n = Math.max(1, this.boltCount);
    const charge = THREE.MathUtils.clamp(t / s.chargeTime, 0, 1);
    const striking = t >= s.chargeTime;
    const closing = 1 - smoothstep((t - (this.duration - FADE)) / FADE);
    const active = this.playing ? 1 : 0;

    // Cloud: grows during the charge, brightens with every flash, fades out at the end.
    const grow = smoothstep(charge / 0.6) * closing * active;
    this.cloud.visible = grow > 0.001;
    this.cloud.position.y = s.cloudHeight;
    this.cloud.scale.set(grow, grow, grow);
    this.cloud.rotation.y = t * 0.08;
    this.puffMat.opacity = 0.85 * closing;
    const lit = Math.min(1, this.flash * 0.9 + (striking ? 0.25 : 0.1 * charge));
    // setRGB is linear: 0.125 already reads as a pale grey on screen, so keep the base storm-dark.
    this.puffMat.color.setRGB(0.025 + 0.35 * lit, 0.03 + 0.45 * lit, 0.045 + 0.7 * lit);
    this.underGlowMat.opacity = (0.08 * charge + 0.5 * this.flash) * closing * active;

    // Arc intensity: ramps up while charging, full during the strike, dies shortly after.
    const arcAmt = !this.playing ? 0
      : striking ? 1 - smoothstep((t - this.strikeEnd) / 0.6)
        : 0.15 + 0.85 * charge * charge;

    // Small branching arcs flickering inside the cloud.
    this.cloudT -= dt;
    if (arcAmt > 0.01 && grow > 0.2) {
      if (this.cloudT <= 0) {
        this.cloudT = 0.07;
        this.cloudArcs.begin();
        const count = 2 + Math.floor(arcAmt * 4);
        for (let i = 0; i < count; i++) {
          const a = rand(0, Math.PI * 2), d = rand(0, 4.5);
          this.v1.set(Math.cos(a) * d, rand(-0.5, 0.4), Math.sin(a) * d);
          const b = this.v1.clone().add(randomUnit().multiplyScalar(rand(2.5, 5)));
          b.y = THREE.MathUtils.clamp(b.y, -0.8, 0.6);
          for (const p of genBolt(this.v1, b, 0.45, s.branchiness, 4, 1.8, false)) {
            this.cloudArcs.addPath(p.pts, 0.08 * p.w);
          }
        }
        this.cloudArcs.end();
      }
      // Arcs live in cloud space, so follow the cloud's size and spin.
      this.cloudArcs.mesh.position.set(0, s.cloudHeight, 0);
      this.cloudArcs.mesh.scale.setScalar(Math.max(grow, 0.001));
      this.cloudArcs.mesh.rotation.y = this.cloud.rotation.y;
      this.cloudArcs.material.opacity = arcAmt * rand(0.6, 1) * 0.8 * closing;
    } else {
      this.cloudArcs.hide();
    }

    // Crackling ring of small arcs around the enemy's feet during the charge.
    this.ringT -= dt;
    const ringAmt = this.playing && !striking ? charge : 0;
    if (ringAmt > 0.02) {
      if (this.ringT <= 0) {
        this.ringT = 0.06;
        this.ringArcs.begin();
        const count = 4 + Math.floor(ringAmt * 6);
        for (let i = 0; i < count; i++) {
          const a = rand(0, Math.PI * 2), r = rand(1.1, 1.7);
          const from = new THREE.Vector3(Math.cos(a) * r, 0.05, Math.sin(a) * r);
          const a2 = a + rand(0.25, 0.6) * (Math.random() < 0.5 ? 1 : -1), r2 = rand(1.1, 1.8);
          const to = new THREE.Vector3(Math.cos(a2) * r2, rand(0.05, 0.5), Math.sin(a2) * r2);
          this.ringArcs.addPath(jaggedPath(from, to, 0.6, 3), s.boltThickness * 0.45);
        }
        this.ringArcs.end();
      }
      this.ringArcs.material.opacity = ringAmt * rand(0.5, 1) * 0.8;
    } else {
      this.ringArcs.hide();
    }
    this.staticFx.settings.rate = this.playing && !striking ? 30 + 170 * charge : 0;

    // Bolts: regenerate the shape every REGEN seconds while alive, fading quickly.
    for (let i = 0; i < MAX_BOLTS; i++) {
      const b = this.bolts[i];
      const age = t - b.start;
      if (i >= this.boltCount || !this.playing || age < 0 || age >= b.life) {
        b.core.hide();
        b.glow.hide();
        continue;
      }
      if (t - b.lastGen >= REGEN || b.lastGen < 0) {
        b.lastGen = t;
        const paths = genBolt(b.from, b.to, s.jaggedness, s.branchiness, 5, 4.5, true);
        const width = s.boltThickness * (i === n - 1 ? 1.5 : 1) * rand(0.85, 1.15);
        b.core.begin();
        b.glow.begin();
        for (const p of paths) {
          b.core.addPath(p.pts, width * p.w);
          b.glow.addPath(p.pts, width * p.w * 4);
        }
        b.core.end();
        b.glow.end();
      }
      const fade = Math.pow(1 - age / b.life, 1.4) * rand(0.7, 1);
      b.core.material.opacity = fade;
      b.glow.material.opacity = fade * 0.35;
    }

    // Radial arcs crawling over the ground: bright after each hit, a dim residue in the aftermath.
    const residual = this.hits > 0 && this.playing ? 0.3 * closing : 0;
    const groundAmt = Math.max(this.groundAmt, residual);
    this.groundT -= dt;
    if (groundAmt > 0.05) {
      if (this.groundT <= 0) {
        this.groundT = this.groundAmt > residual ? 0.07 : 0.2;
        this.groundArcs.begin();
        const count = this.groundAmt > residual ? 4 + Math.round(s.branchiness * 4) : 3;
        for (let i = 0; i < count; i++) {
          const a = rand(0, Math.PI * 2), r0 = rand(0.5, 1.3), r1 = r0 + rand(2.5, 6.5), a2 = a + rand(-0.4, 0.4);
          const from = new THREE.Vector3(Math.cos(a) * r0, 0.05, Math.sin(a) * r0);
          const to = new THREE.Vector3(Math.cos(a2) * r1, 0.05, Math.sin(a2) * r1);
          const paths = genBolt(from, to, 0.45, s.branchiness * 0.8, 4, 1.8, false);
          flatten(paths, 0.05);
          for (const p of paths) this.groundArcs.addPath(p.pts, s.boltThickness * 0.5 * p.w);
        }
        this.groundArcs.end();
      }
      this.groundArcs.material.opacity = groundAmt * rand(0.6, 1) * 0.9;
    } else {
      this.groundArcs.hide();
    }

    // Flash: light spike, screen-filling dome and a glow sphere at the impact point.
    this.flashLight.intensity = this.flash * 1200;
    this.flashDome.visible = this.flash > 0.01;
    (this.flashDome.material as THREE.MeshBasicMaterial).opacity = this.flash * 0.16;
    this.glowSphere.visible = this.glowAmt > 0.01;
    this.glowSphere.position.set(0, 1.1, 0);
    this.glowSphere.scale.setScalar(1.4 + 2.2 * (1 - this.glowAmt));
    (this.glowSphere.material as THREE.MeshBasicMaterial).opacity = this.glowAmt * 0.6;

    // Scorch decal grows and darkens with each hit and fades with the effect.
    const scorch = this.playing ? this.hits / n : 0;
    const scorchScale = 0.6 + 0.4 * scorch;
    this.scorchDisc.visible = this.scorchRing.visible = scorch > 0;
    this.scorchDisc.scale.setScalar(scorchScale);
    this.scorchRing.scale.setScalar(scorchScale);
    (this.scorchDisc.material as THREE.MeshBasicMaterial).opacity = 0.65 * scorch * closing;
    (this.scorchRing.material as THREE.MeshBasicMaterial).opacity = 0.5 * scorch * closing;

    // Smoke rises from the first hit on, thicker in the aftermath, and stops before the final fade.
    const smoking = this.playing && this.hits > 0 && t < this.duration - FADE;
    this.smoke.settings.rate = smoking ? (t > this.strikeEnd ? 60 : 25) : 0;

    // Enemy: white-hot flash per hit, progressively charred, crushed by the last bolt.
    this.enemy.setFlash(Math.min(this.enemyFlash, 0.5));
    this.enemy.material.color.copy(this.enemyColor.set(ENEMY_BASE)).lerp(this.charColor, scorch);
    const lastStart = this.bolts[n - 1].start;
    this.enemy.setCrush(this.hits >= n ? smoothstep((t - lastStart - 0.1) / 0.25) : 0);
    if (this.shake < 0.02 && this.playing && !striking) this.shake = 0.03 * charge * charge;
  }
}

export const lightningStrikeModule: EffectModule = {
  label: 'lightning strike',
  create: () => new LightningStrike(),
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.8 },
  frameCamera(camera, controls, effect) {
    const h = (effect as LightningStrike).settings.cloudHeight;
    camera.position.set(h * 0.9, h * 0.55, h * 1.25);
    controls.target.set(0, h * 0.45, 0);
  },
  buildGui(f, effect) {
    const fx = effect as LightningStrike;
    const s = fx.settings;
    // Bolt and cloud layout is picked up on the next play; colours apply immediately.
    f.add(s, 'loop');
    f.add(s, 'boltCount', 3, 6, 1).name('bolts');
    f.add(s, 'cloudHeight', 8, 30, 0.5).name('cloud height');
    f.add(s, 'chargeTime', 0.5, 4, 0.1).name('charge time');
    f.add(s, 'branchiness', 0, 1, 0.01);
    f.add(s, 'jaggedness', 0.05, 0.8, 0.01);
    f.add(s, 'boltThickness', 0.03, 0.4, 0.01).name('bolt thickness');
    f.addColor(s, 'boltColor').name('bolt color').onChange(() => fx.applyStyle());
    f.addColor(s, 'glowColor').name('glow color').onChange(() => fx.applyStyle());
  },
};
