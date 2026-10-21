import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Chain Lightning (reworked): five enemies stand staggered in front of the caster. A bolt leaps from the caster's
 * hand to the first, then hops from target to target. Bolts are jagged midpoint-displaced ribbons that re-roll
 * every 50 ms; each target flashes, is wrapped in crackling arcs and spits sparks, with a point-light flash per hop.
 */
export interface ChainLightningSettings {
  hopGap: number; // seconds between hops
  windup: number; // charge before the first bolt
  jaggedness: number; // 0..1
  boltThickness: number;
  boltColor: string;
  glowColor: string;
  loop: boolean;
}

export const defaultChainLightning = (): ChainLightningSettings => ({
  hopGap: 0.12,
  windup: 0.9,
  jaggedness: 0.3,
  boltThickness: 0.12,
  boltColor: '#eef4ff',
  glowColor: '#6a9bff',
  loop: false,
});

const TARGETS = 5;
const BOLT_LIFE = 0.5;
const REGEN = 0.05;
const AFTERMATH = 1.6;
const BODY_LIFE = 1.0; // how long a target keeps crackling
const BOLT_SEGMENTS = 300;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const HAND = new THREE.Vector3(0.45, 2.3, CASTER_POS.z - 0.6);

// Staggered enemy positions; the first one is closest to the caster.
const HOMES = [
  new THREE.Vector3(-1.5, 0, 8),
  new THREE.Vector3(2.2, 0, 4),
  new THREE.Vector3(-2, 0, ENEMY_POS.z + 0.4),
  new THREE.Vector3(1.6, 0, -3.4),
  new THREE.Vector3(-1, 0, -7),
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Path {
  pts: THREE.Vector3[];
  w: number;
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
  from: THREE.Vector3, to: THREE.Vector3, jag: number, branchiness: number, depth: number, branchLen: number,
): Path[] {
  const main = jaggedPath(from, to, jag, depth);
  const paths: Path[] = [{ pts: main, w: 1 }];
  const branch = (src: THREE.Vector3, dirHint: THREE.Vector3, len: number, w: number, d: number) => {
    const dir = dirHint.clone().addScaledVector(randomUnit(), 0.9).normalize();
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

interface Hop {
  core: ArcMesh;
  glow: ArcMesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  start: number;
  fired: boolean;
  lastGen: number;
}

export class ChainLightning implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ChainLightningSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private flash = 0;
  private handT = 0;
  private bodyT = 0;
  private hitAt = new Float32Array(TARGETS).fill(-99);
  private enemyFlash = new Float32Array(TARGETS);

  private caster = createCaster();
  private enemies: Enemy[] = [];
  private handGlow = new GlowSphere(0xaac8ff, { rim: false });
  private hopGlow = new GlowSphere(0xaac8ff);
  private hops: Hop[] = [];
  private handArcs = new ArcMesh(120);
  private bodyArcs: ArcMesh[] = [];
  private flashLight = new THREE.PointLight(0xaac8ff, 0, 60, 1.2);
  private sparks: Emitter;
  private motes: Emitter;
  private smoke: Emitter;
  private scorch = Array.from({ length: TARGETS }, () => createRing(0x6a9bff, 0.2, 1, 48)); // ground marks under each target

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ChainLightningSettings = defaultChainLightning()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group);
    for (let i = 0; i < TARGETS; i++) {
      const e = new Enemy().setHome(HOMES[i]);
      this.enemies.push(e);
      this.group.add(e.group);
      const body = new ArcMesh(120);
      this.bodyArcs.push(body);
      this.group.add(body.mesh);
      const hop: Hop = {
        core: new ArcMesh(BOLT_SEGMENTS), glow: new ArcMesh(BOLT_SEGMENTS),
        from: new THREE.Vector3(), to: new THREE.Vector3(), start: 0, fired: false, lastGen: -1,
      };
      this.group.add(hop.glow.mesh, hop.core.mesh);
      this.hops.push(hop);
    }
    this.group.add(this.handArcs.mesh, this.handGlow.mesh, this.hopGlow.mesh, this.flashLight);
    this.scorch.forEach((r, i) => {
      r.mesh.position.set(HOMES[i].x, 0.04, HOMES[i].z);
      r.mesh.scale.setScalar(1.6);
      this.group.add(r.mesh);
    });

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 2500, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 7, speedJitter: 0.6, spread: 180, gravity: 12, drag: 0.8,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#f2f7ff', colorEnd: '#6a9bff',
      opacityStart: 0.9, opacityEnd: 0, additive: true,
      sizeJitter: 0.3, erosion: 0,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 1.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.7, speed: 1.2, speedJitter: 0.5, spread: 180, gravity: -0.3, drag: 0.6,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#cfe0ff', colorEnd: '#6a9bff',
      opacityStart: 0.5, opacityEnd: 0, additive: true,
      sizeJitter: 0.3, erosion: 0,
    });
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 1.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 1.2, speedJitter: 0.5, spread: 180, gravity: -0.4, drag: 1.3,
      sizeStart: 0.5, sizeEnd: 1.5, colorStart: '#5a6a8a', colorMid: '#2c3650', colorEnd: '#10141e',
      opacityStart: 0.28, opacityEnd: 0, additive: false,
      sizeJitter: 0.4, erosion: 0.55, spin: 0.4, groundFade: 0.3,
    });
    // Dark scorch smoke (normal blending) first so the additive sparks draw over it.
    this.emitters.push(this.smoke, this.sparks, this.motes);
    for (const e of this.emitters) this.group.add(e.points);

    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const s = this.settings;
    for (const h of this.hops) {
      h.core.setColor(s.boltColor, 1.5);
      h.glow.setColor(s.glowColor, 1.2);
    }
    this.handArcs.setColor(s.boltColor, 1.2);
    for (const b of this.bodyArcs) b.setColor(s.glowColor, 1.4);
    this.flashLight.color.set(s.glowColor).lerp(new THREE.Color(1, 1, 1), 0.4);
    this.handGlow.color.set(s.glowColor).lerp(new THREE.Color(1, 1, 1), 0.3);
    this.hopGlow.color.set(s.glowColor);
    for (const r of this.scorch) r.material.color.set(s.glowColor);
    this.sparks.settings.colorStart = s.boltColor;
    this.sparks.settings.colorEnd = s.glowColor;
    this.motes.settings.colorEnd = s.glowColor;
    this.sparks.applyStyle();
    this.motes.applyStyle();
  }

  get duration() {
    const s = this.settings;
    return s.windup + (TARGETS - 1) * s.hopGap + BOLT_LIFE + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    const s = this.settings;
    this.time = 0;
    this.flash = 0;
    this.handT = this.bodyT = 0;
    this.shake = 0;
    this.hitAt.fill(-99);
    this.enemyFlash.fill(0);
    this.caster.reset();
    for (const e of this.emitters) e.clear();
    for (let i = 0; i < TARGETS; i++) {
      this.enemies[i].reset();
      const h = this.hops[i];
      h.fired = false;
      h.lastGen = -1;
      h.start = s.windup + i * s.hopGap;
      if (i === 0) h.from.copy(HAND);
      else h.from.copy(HOMES[i - 1]).y = 1.2;
      h.to.copy(HOMES[i]).y = 1.2;
      h.core.hide();
      h.glow.hide();
      this.bodyArcs[i].hide();
    }
    this.handArcs.hide();
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
    this.flash *= Math.exp(-dt * 14);
    this.shake *= Math.exp(-dt * 8);
    for (let i = 0; i < TARGETS; i++) this.enemyFlash[i] *= Math.exp(-dt * 7);
    for (let i = 0; i < TARGETS; i++) {
      if (!this.hops[i].fired && this.time >= this.hops[i].start) this.onHop(i);
    }
    this.layout(dt);
  }

  private onHop(i: number) {
    const h = this.hops[i];
    h.fired = true;
    this.flash = 1;
    this.enemyFlash[i] = 1;
    this.hitAt[i] = this.time;
    this.bodyT = 0;
    this.shake = Math.min(this.shake + 0.12, 0.4);
    this.sparks.burst(150, h.to);
    this.smoke.burst(30, h.to);
    this.flashLight.position.copy(h.to);
    this.hopGlow.mesh.position.copy(h.to);
  }

  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const active = this.playing ? 1 : 0;
    const closing = 1 - smoothstep((t - (this.duration - 0.7)) / 0.7);

    // Wind-up: hand glow swells and small arcs crackle around the hand.
    const charge = smoothstep(t / s.windup) * active;
    const handLive = t < s.windup + (TARGETS - 1) * s.hopGap + 0.2 ? 1 : closing * 0.5;
    this.handGlow.mesh.position.copy(HAND);
    this.handGlow.mesh.scale.setScalar(0.18 + 0.3 * charge + 0.05 * Math.sin(t * 30));
    this.handGlow.opacity = 0.5 * charge * handLive * (t < s.windup ? 1 : Math.max(0.4, 1 - (t - s.windup) * 2));
    this.motes.settings.rate = this.playing && t < s.windup ? 80 * charge : 0;
    this.handT -= dt;
    if (this.playing && charge > 0.05 && t < s.windup + 0.5) {
      if (this.handT <= 0) {
        this.handT = REGEN;
        this.handArcs.begin();
        const n = 2 + Math.floor(charge * 4);
        for (let i = 0; i < n; i++) {
          const a = this.v1.copy(HAND).addScaledVector(randomUnit(), rand(0.08, 0.2));
          const b = this.v2.copy(HAND).addScaledVector(randomUnit(), rand(0.4, 0.9) * (0.5 + charge));
          this.handArcs.addPath(jaggedPath(a, b, 0.5, 3), s.boltThickness * 0.5);
        }
        this.handArcs.end();
      }
      this.handArcs.material.opacity = charge * rand(0.5, 1) * 0.8;
    } else {
      this.handArcs.hide();
    }

    // Bolts: re-roll the shape every REGEN seconds while alive, fading quickly.
    for (let i = 0; i < TARGETS; i++) {
      const h = this.hops[i];
      const age = t - h.start;
      if (!this.playing || age < 0 || age >= BOLT_LIFE) {
        h.core.hide();
        h.glow.hide();
        continue;
      }
      if (t - h.lastGen >= REGEN || h.lastGen < 0) {
        h.lastGen = t;
        const len = h.from.distanceTo(h.to);
        const paths = genBolt(h.from, h.to, s.jaggedness, 0.6, 5, len * 0.25);
        const width = s.boltThickness * rand(0.85, 1.15);
        h.core.begin();
        h.glow.begin();
        for (const p of paths) {
          h.core.addPath(p.pts, width * p.w);
          h.glow.addPath(p.pts, width * p.w * 4);
        }
        h.core.end();
        h.glow.end();
      }
      const fade = Math.pow(1 - age / BOLT_LIFE, 1.4) * rand(0.7, 1);
      h.core.material.opacity = fade;
      h.glow.material.opacity = fade * 0.35;
    }

    // Point-light flash and glow at the most recent hit target.
    this.flashLight.intensity = this.flash * 500;
    this.hopGlow.mesh.scale.setScalar(1.2 + 1.6 * (1 - this.flash));
    this.hopGlow.opacity = this.flash * 0.5;

    // Targets: flash, jitter, and crackling arcs hugging the body for a while after being hit.
    this.bodyT -= dt;
    const regen = this.bodyT <= 0;
    if (regen) this.bodyT = REGEN * 1.4;
    for (let i = 0; i < TARGETS; i++) {
      const e = this.enemies[i];
      const since = t - this.hitAt[i];
      const amt = this.playing && since >= 0 && since < BODY_LIFE ? (1 - since / BODY_LIFE) * closing : 0;
      this.scorch[i].material.opacity = this.playing && since >= 0 ? 0.3 * Math.exp(-since * 1.2) * closing : 0;
      e.setFlash(Math.min(this.enemyFlash[i], 0.9));
      e.group.position.copy(HOMES[i]);
      if (amt > 0.02) {
        e.group.position.x += rand(-1, 1) * 0.08 * amt;
        e.group.position.z += rand(-1, 1) * 0.08 * amt;
      }
      const arcs = this.bodyArcs[i];
      if (amt > 0.04) {
        if (regen) {
          arcs.begin();
          const n = 3 + Math.floor(amt * 3);
          for (let k = 0; k < n; k++) {
            const a1 = rand(0, Math.PI * 2), a2 = a1 + rand(0.5, 1.6) * (Math.random() < 0.5 ? 1 : -1);
            const y1 = rand(0.2, 2.1), y2 = THREE.MathUtils.clamp(y1 + rand(-0.9, 0.9), 0.1, 2.2);
            const a = new THREE.Vector3(Math.cos(a1) * 0.65, y1, Math.sin(a1) * 0.65);
            const b = new THREE.Vector3(Math.cos(a2) * 0.65, y2, Math.sin(a2) * 0.65);
            arcs.addPath(jaggedPath(a, b, 0.3, 3), s.boltThickness * 0.45);
          }
          arcs.end();
        }
        arcs.mesh.position.copy(HOMES[i]);
        arcs.material.opacity = amt * rand(0.6, 1) * 0.9;
      } else {
        arcs.hide();
      }
    }
  }
}

export const chainLightningModule: EffectModule = {
  label: 'chain lightning',
  category: 'iconic',
  create: () => new ChainLightning(),
  telegraphs(effect) {
    const s = (effect as ChainLightning).settings;
    // One small zone per target, landing at its own hop time.
    return HOMES.map((h, i) => ({
      shape: { kind: 'circle' as const, x: h.x, z: h.z, radius: 1.6 },
      start: s.windup * 0.3,
      impact: s.windup + i * s.hopGap,
    }));
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.8 },
  frameCamera(camera, controls) {
    // Caster at z = 14; the five targets run from z = 8 down to -7.
    frameArena(camera, controls, new THREE.Vector3(0, 2, 3.5), 13);
  },
  buildGui(f, effect) {
    const c = effect as ChainLightning;
    const s = c.settings;
    f.add(s, 'loop');
    f.add(s, 'hopGap', 0.05, 0.4, 0.01).name('hop gap');
    f.add(s, 'windup', 0.2, 2, 0.05);
    f.add(s, 'jaggedness', 0.05, 0.8, 0.01);
    f.add(s, 'boltThickness', 0.03, 0.4, 0.01).name('bolt thickness');
    f.addColor(s, 'boltColor').name('bolt color').onChange(() => c.applyStyle());
    f.addColor(s, 'glowColor').name('glow color').onChange(() => c.applyStyle());
  },
};
