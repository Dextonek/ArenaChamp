import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  GlowSphere, LightPillar, createRing, createSpearGeometry, smoothstep, softDotTexture,
} from '../../effects/common';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Starbreaker Lance (targeted reference spell, single target): star-motes spiral into the caster's raised hand
 * and forge a lance of light while a lock-on rune closes around the chosen enemy. The lance is hurled along an
 * arc, leaving a comet trail, and detonates on the target: flash, double shockwave, light pillar, sparks,
 * embers, rock shards and dark dust, with the lance left standing in the crater.
 *
 * Copy this file's structure for new targeted spells (see docs/TARGETED_SPELL_BRIEF.md).
 */
export interface StarbreakerLanceSettings {
  chargeTime: number;
  flightTime: number;
  arcHeight: number;
  lanceSize: number;
  damage: number;
  color: string;
  loop: boolean;
}

export const defaultStarbreakerLance = (): StarbreakerLanceSettings => ({
  chargeTime: 1.0,
  flightTime: 0.38,
  arcHeight: 3.5,
  lanceSize: 2.6,
  damage: 48,
  color: '#6ab8ff',
  loop: false,
});

const AFTERMATH = 2.4;
const MOTES = 180;
const SHARDS = 36;

export class StarbreakerLance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StarbreakerLanceSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;

  // Cast geometry, computed in cast() from the context.
  private hand = new THREE.Vector3();
  private impactAt = new THREE.Vector3();
  private control = new THREE.Vector3();

  private handGlow = new GlowSphere(0xcfe6ff, { rim: false });
  private casterRune = createRing(0x6ab8ff, 0.86, 1, 6);
  private lockRune = createRing(0x6ab8ff, 0.82, 1, 4);
  private lockInner = createRing(0x9fd0ff, 0.45, 0.5, 64);
  private lanceMat = new THREE.MeshStandardMaterial({
    color: 0x8fb6e0, metalness: 0.6, roughness: 0.3, emissive: 0x6ab8ff, emissiveIntensity: 0.8, transparent: true,
  });
  private lance = new THREE.Mesh(createSpearGeometry(), this.lanceMat);
  private lanceGlow = new GlowSphere(0x9fd0ff, { rim: false });
  private flash = new GlowSphere(0xe8f4ff, { rim: false });
  private burst = new GlowSphere(0x6ab8ff);
  private shock = createRing(0xbfe0ff, 0.9, 1, 96);
  private shock2 = createRing(0x6ab8ff, 0.94, 1, 96);
  private pillar = new LightPillar(0x8cc8ff, 1.1);

  private motePos = new Float32Array(MOTES * 3);
  private moteSeed = Array.from({ length: MOTES }, () => ({ a: Math.random() * Math.PI * 2, r: 2 + Math.random() * 3, y: Math.random() * 3, d: Math.random() * 0.4 }));
  private moteGeo = new THREE.BufferGeometry();
  private moteMat = new THREE.PointsMaterial({
    size: 0.16, map: softDotTexture(), color: 0xcfe6ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private motes = new THREE.Points(this.moteGeo, this.moteMat);

  private shardMat = new THREE.MeshStandardMaterial({ color: 0x4a4650, roughness: 0.9, emissive: 0x6ab8ff, emissiveIntensity: 0 });
  private shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.22), this.shardMat, SHARDS);
  private shardState = Array.from({ length: SHARDS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() }));

  private trail: Emitter;
  private sparks: Emitter;
  private embers: Emitter;
  private dust: Emitter;

  constructor(settings: StarbreakerLanceSettings = defaultStarbreakerLance()) {
    this.settings = settings;
    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motes.frustumCulled = false;
    this.shards.frustumCulled = false;
    this.group.add(this.handGlow.mesh, this.casterRune.mesh, this.lockRune.mesh, this.lockInner.mesh);
    this.group.add(this.lance, this.lanceGlow.mesh, this.flash.mesh, this.burst.mesh);
    this.group.add(this.shock.mesh, this.shock2.mesh, this.pillar.mesh, this.motes, this.shards);

    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 1400, rate: 0, lifetime: 0.55, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.18, speed: 0.6, speedJitter: 0.8, spread: 180, gravity: -0.4, drag: 2,
      sizeStart: 0.5, sizeEnd: 0.05, colorStart: '#f2f8ff', colorEnd: '#2a3cff',
      opacityStart: 0.45, opacityEnd: 0, additive: true, colorMid: settings.color, sizeJitter: 0.4, erosion: 0.5, spin: 0.6,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 12, speedJitter: 0.6, spread: 85, gravity: 11, drag: 0.9,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#4a8cff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 2.2, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 1.4, speed: 2.2, speedJitter: 0.6, spread: 60, gravity: -0.8, drag: 0.8,
      sizeStart: 0.22, sizeEnd: 0, colorStart: '#e8f4ff', colorEnd: '#3a4cff',
      opacityStart: 0.4, opacityEnd: 0, additive: true, colorMid: settings.color, sizeJitter: 0.5, erosion: 0.55, spin: 0.5,
    });
    // Dark normal-blended layer so the bright burst has something to read against.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.6, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.5, speed: 4, speedJitter: 0.6, spread: 75, gravity: -0.15, drag: 1.3,
      sizeStart: 1, sizeEnd: 2.2, colorStart: '#6c6a78', colorEnd: '#1e1d24',
      opacityStart: 0.42, opacityEnd: 0, additive: false, colorMid: '#45434f', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.emitters.push(this.trail, this.sparks, this.embers, this.dust);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    for (const r of [this.casterRune, this.lockRune, this.shock2]) r.material.color.set(c);
    this.lanceMat.emissive.set(c);
    this.burst.color.set(c);
    this.trail.settings.colorMid = c;
    this.embers.settings.colorMid = c;
    this.trail.applyStyle();
    this.embers.applyStyle();
  }

  get duration() {
    return this.settings.chargeTime + this.settings.flightTime + AFTERMATH;
  }

  get impactTime() {
    return this.settings.chargeTime + this.settings.flightTime;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Right hand, raised and slightly forward of the caster.
    const fwd = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    this.hand.copy(ctx.from).addScaledVector(right, 0.5).addScaledVector(fwd, 0.3).setY(2.9);
    const target = ctx.targetPos[0] ?? ctx.point;
    this.impactAt.copy(target).setY(0);
    this.control.copy(this.hand).lerp(this.impactAt, 0.5).setY(Math.max(this.hand.y, 1) + this.settings.arcHeight);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.shake = 0;
    for (const e of this.emitters) e.clear();
    for (const s of this.shardState) s.p.set(0, -50, 0);
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
    if (!this.impacted && this.time >= this.impactTime) this.onImpact();
    this.layout(dt);
  }

  /** Point on the flight arc, u in 0..1. */
  private arc(u: number, out: THREE.Vector3) {
    const a = this.hand, b = this.control, c = this.impactAt.clone().setY(1.1);
    const k = 1 - u;
    return out.set(
      k * k * a.x + 2 * k * u * b.x + u * u * c.x,
      k * k * a.y + 2 * k * u * b.y + u * u * c.y,
      k * k * a.z + 2 * k * u * b.z + u * u * c.z,
    );
  }

  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const after = t - this.impactTime;
    const fade = 1 - smoothstep((t - (this.duration - 0.8)) / 0.8);
    const ctx = this.ctx;
    const from = ctx?.from ?? new THREE.Vector3();

    // --- Anticipation: rune under the caster, motes spiral into the hand, lance forms. ---
    const charge = smoothstep(t / s.chargeTime);
    const released = t >= s.chargeTime;
    this.casterRune.mesh.position.set(from.x, 0.05, from.z);
    this.casterRune.mesh.scale.setScalar(1.2 + 1.6 * charge);
    this.casterRune.mesh.rotation.z = t * 2;
    this.casterRune.material.opacity = (released ? 0.6 * Math.exp(-(t - s.chargeTime) * 4) : 0.55 * charge) * fade;

    for (let i = 0; i < MOTES; i++) {
      const m = this.moteSeed[i];
      const k = THREE.MathUtils.clamp((t / s.chargeTime - m.d) / (1 - m.d), 0, 1);
      const r = m.r * (1 - k * k);
      const a = m.a + k * 5;
      this.motePos[i * 3] = this.hand.x + Math.cos(a) * r;
      this.motePos[i * 3 + 1] = this.hand.y + (m.y - 1.5) * (1 - k);
      this.motePos[i * 3 + 2] = this.hand.z + Math.sin(a) * r;
    }
    this.moteGeo.attributes.position.needsUpdate = true;
    this.moteMat.opacity = released ? 0 : 0.7 * smoothstep(t / 0.25);

    this.handGlow.mesh.position.copy(this.hand);
    this.handGlow.mesh.scale.setScalar(0.2 + 0.5 * charge);
    this.handGlow.opacity = released ? 0.6 * Math.exp(-(t - s.chargeTime) * 7) : 0.45 * charge;

    // --- Lock-on rune around the target: closes in during the charge, flashes on impact. ---
    const lock = smoothstep(t / (s.chargeTime * 0.8));
    const runeR = 4 - 2 * lock;
    for (const r of [this.lockRune, this.lockInner]) {
      r.mesh.position.set(this.impactAt.x, 0.05, this.impactAt.z);
      r.mesh.scale.setScalar(runeR);
    }
    this.lockRune.mesh.rotation.z = t * 1.2;
    this.lockInner.mesh.rotation.z = -t * 2.2;
    const lockOp = this.impacted ? 0.8 * Math.exp(-after * 2) : 0.55 * lock;
    this.lockRune.material.opacity = lockOp * fade;
    this.lockInner.material.opacity = lockOp * 0.7 * fade;

    // --- Release: the lance flies the arc, oriented along its path, shedding a comet trail. ---
    const p = new THREE.Vector3();
    const ahead = new THREE.Vector3();
    if (!released) {
      // Held above the hand, tip toward the target, growing in.
      p.copy(this.hand).add(new THREE.Vector3(0, 0.6, 0));
      this.arc(0.06, ahead);
      this.lance.scale.setScalar(s.lanceSize * (0.3 + 0.7 * charge));
      this.lanceMat.opacity = smoothstep(t / (s.chargeTime * 0.5));
    } else if (!this.impacted) {
      const u = Math.min(1, (t - s.chargeTime) / s.flightTime);
      this.arc(u, p);
      this.arc(Math.min(1, u + 0.05), ahead);
      this.lance.scale.setScalar(s.lanceSize);
      this.lanceMat.opacity = 1;
      if (dt > 0) this.trail.burst(14, p);
      this.shake = 0.05;
    } else {
      // Embedded in the crater, slightly tilted, fading out.
      p.copy(this.impactAt).add(new THREE.Vector3(0, 0.1, 0));
      ahead.copy(p).add(new THREE.Vector3(0.15, -1, 0.1));
      this.lanceMat.opacity = Math.exp(-Math.max(0, after - 0.8) * 2) * fade;
    }
    this.lance.position.copy(p);
    // Spear geometry points down -Y with the tip at its origin: aim -Y along the travel direction.
    const dir = ahead.sub(p);
    if (dir.lengthSq() > 1e-6) this.lance.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
    this.lance.visible = this.lanceMat.opacity > 0.01;
    this.lanceMat.emissiveIntensity = this.impacted ? 0.4 + 2 * Math.exp(-after * 5) : 0.6 + 0.6 * charge;
    this.lanceGlow.mesh.position.copy(p);
    this.lanceGlow.mesh.scale.setScalar(released && !this.impacted ? 1.1 : 0.5 + 0.5 * charge);
    this.lanceGlow.opacity = (this.impacted ? 0.35 * Math.exp(-after * 3) : 0.35 * charge) * fade;

    // --- Impact: flash, burst shell, two staggered shockwaves, pillar, shards. ---
    const c = this.impactAt;
    if (this.impacted) {
      this.flash.mesh.position.set(c.x, 1.2, c.z);
      this.flash.mesh.scale.setScalar(1.5 + after * 4);
      this.flash.opacity = 0.9 * Math.exp(-after * 12);
      this.burst.mesh.position.set(c.x, 1, c.z);
      this.burst.mesh.scale.setScalar(1 + after * 10);
      this.burst.opacity = 0.55 * Math.exp(-after * 4);
      this.shock.mesh.position.set(c.x, 0.05, c.z);
      this.shock.mesh.scale.setScalar(1 + after * 20);
      this.shock.material.opacity = Math.max(0, 0.8 * (1 - after / 0.6));
      const a2 = after - 0.12;
      this.shock2.mesh.position.set(c.x, 0.06, c.z);
      this.shock2.mesh.scale.setScalar(1 + Math.max(0, a2) * 12);
      this.shock2.material.opacity = a2 > 0 ? Math.max(0, 0.6 * (1 - a2 / 0.9)) : 0;
      this.pillar.set(c.x, c.z, 0, 26, 0.55 * Math.exp(-after * 2.5) * fade);
      this.shake = 0.65 * Math.exp(-after * 6);
      this.shardMat.emissiveIntensity = 0.9 * Math.exp(-after * 2);
    } else {
      this.flash.opacity = 0;
      this.burst.opacity = 0;
      this.shock.material.opacity = 0;
      this.shock2.material.opacity = 0;
      this.pillar.set(c.x, c.z, 0, 26, released ? 0.12 : 0);
    }

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < SHARDS; i++) {
      const sh = this.shardState[i];
      if (dt > 0 && sh.p.y > -10) {
        sh.v.y -= 22 * dt;
        sh.p.addScaledVector(sh.v, dt);
        if (sh.p.y < 0.1) { sh.p.y = 0.1; sh.v.set(0, 0, 0); sh.w.multiplyScalar(0); }
        sh.r.set(sh.r.x + sh.w.x * dt, sh.r.y + sh.w.y * dt, sh.r.z + sh.w.z * dt);
      }
      // Never a zero scale on a lit instance: NaN normals turn the whole bloomed frame black.
      m.compose(sh.p, q.setFromEuler(sh.r), new THREE.Vector3().setScalar(Math.max(1e-4, (0.6 + (i % 5) * 0.25) * fade)));
      this.shards.setMatrixAt(i, m);
    }
    this.shards.instanceMatrix.needsUpdate = true;
  }

  private onImpact() {
    this.impacted = true;
    const c = this.impactAt;
    this.sparks.burst(650, c);
    this.embers.burst(300, c);
    this.dust.burst(220, c);
    for (const sh of this.shardState) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 7;
      sh.p.set(c.x, 0.3, c.z);
      sh.v.set(Math.cos(a) * sp, 6 + Math.random() * 8, Math.sin(a) * sp);
      sh.w.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
    }
    const ctx = this.ctx;
    if (ctx) {
      ctx.targets.forEach((e, i) => ctx.hit(e, { damage: i === 0 ? this.settings.damage : 15, knock: 7, from: c }));
    }
  }
}

export const starbreakerLanceModule: EffectModule = {
  label: 'starbreaker lance',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new StarbreakerLance(),
  telegraphs(effect) {
    const e = effect as StarbreakerLance;
    const c = e.ctx?.targetPos[0] ?? e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 2.6 }, start: 0.1, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as StarbreakerLance;
    if (e.ctx) frameCast(camera, controls, e.ctx, e.settings.arcHeight + 4);
  },
  buildGui(f, effect) {
    const l = effect as StarbreakerLance;
    const s = l.settings;
    f.add(s, 'loop');
    f.add(s, 'chargeTime', 0.3, 3, 0.05).name('charge time');
    f.add(s, 'flightTime', 0.15, 1.5, 0.01).name('flight time');
    f.add(s, 'arcHeight', 0, 12, 0.1).name('arc height');
    f.add(s, 'lanceSize', 0.5, 6, 0.1).name('lance size');
    f.add(s, 'damage', 1, 150, 1);
    f.addColor(s, 'color').onChange(() => l.applyStyle());
  },
};
