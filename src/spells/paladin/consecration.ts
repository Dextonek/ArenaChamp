import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Consecration (reworked): the caster drives a glowing palm into the ground at the enemy's feet and holy ground
 * ignites in a wide rune circle: nested rings turning at different speeds, a belt of glyphs, golden flames
 * licking up over the whole area, rising motes, and holy pulses rolling outward that make the enemy flash.
 */
export interface ConsecrationSettings {
  radius: number;
  burnTime: number; // seconds the ground burns after being planted
  color: string;
  loop: boolean;
}

export const defaultConsecration = (): ConsecrationSettings => ({
  radius: 7,
  burnTime: 3.2,
  color: '#ffc94a',
  loop: false,
});

const PLANT = 0.7; // hand reaches the ground
const FADE = 0.9;
const TICKS = 4;

/** A small rune-like glyph drawn to a canvas, used for the belt of floating glyph quads. */
function makeGlyphTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(32, 6); g.lineTo(32, 58);
  g.moveTo(14, 20); g.lineTo(32, 36); g.lineTo(50, 20);
  g.moveTo(18, 50); g.lineTo(46, 50);
  g.stroke();
  return new THREE.CanvasTexture(c);
}

/** Soft radial gradient for the ground glow disc. */
function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

interface RuneRing {
  ring: ReturnType<typeof createRing>;
  frac: number; // radius as a fraction of the circle radius
  speed: number; // rad/s
  strength: number;
}

const GLYPHS_OUTER = 24;
const GLYPHS_INNER = 12;

export class Consecration implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ConsecrationSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private pulseIdx = 0;
  private ignite = 0;
  private edgeAcc = 0;

  private caster = createCaster();
  private enemy = new Enemy();
  private handGlow = new GlowSphere(0xffe2a0, { rim: false });
  private runes: RuneRing[] = [
    { ring: createRing(0xffc94a, 0.965, 1, 96), frac: 1, speed: 0.15, strength: 0.7 },
    { ring: createRing(0xffc94a, 0.9, 0.925, 6), frac: 0.96, speed: -0.3, strength: 0.6 },
    { ring: createRing(0xffc94a, 0.78, 0.8, 96), frac: 0.9, speed: 0.2, strength: 0.5 },
    { ring: createRing(0xffc94a, 0.9, 0.93, 4), frac: 0.72, speed: 0.55, strength: 0.6 },
    { ring: createRing(0xffc94a, 0.9, 0.93, 6), frac: 0.52, speed: -0.8, strength: 0.6 },
    { ring: createRing(0xffc94a, 0.94, 1, 64), frac: 0.34, speed: 1.1, strength: 0.5 },
    { ring: createRing(0xffc94a, 0.85, 0.9, 4), frac: 0.24, speed: -1.5, strength: 0.6 },
  ];
  private pulses = [createRing(0xffe2a0, 0.9, 1, 96), createRing(0xffe2a0, 0.9, 1, 96)];
  private glyphMat = new THREE.MeshBasicMaterial({
    map: makeGlyphTexture(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });
  private glyphs: THREE.InstancedMesh;
  private glowTex = makeGlowTexture();
  private glowMat = new THREE.MeshBasicMaterial({
    map: this.glowTex, color: 0xffb030, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private glow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.glowMat);
  private flames: Emitter;
  private edgeFlames: Emitter;
  private motes: Emitter;
  private smoke: Emitter;
  private sparks: Emitter;

  private dummy = new THREE.Object3D();
  private tmpColor = new THREE.Color();

  constructor(settings: ConsecrationSettings = defaultConsecration()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group, this.handGlow.mesh);

    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI / 2);
    this.glyphs = new THREE.InstancedMesh(plane, this.glyphMat, GLYPHS_OUTER + GLYPHS_INNER);
    this.glyphs.frustumCulled = false;
    for (let i = 0; i < this.glyphs.count; i++) this.glyphs.setColorAt(i, this.tmpColor.setRGB(0, 0, 0));
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.03;
    this.group.add(this.glow);
    for (const r of this.runes) this.group.add(r.ring.mesh);
    for (const p of this.pulses) this.group.add(p.mesh);
    this.group.add(this.glyphs);

    this.flames = new Emitter({
      ...defaultSettings(), maxParticles: 2600, rate: 0, lifetime: 0.75, lifetimeJitter: 0.45,
      shape: 'cone', shapeSize: 6, originY: 0.05, speed: 2.2, speedJitter: 0.6, spread: 12, gravity: -1.2, drag: 0.5,
      sizeStart: 0.45, sizeEnd: 0.05, colorStart: '#ffe08a', colorEnd: '#ff8a1a',
      opacityStart: 0.45, opacityEnd: 0, additive: true,
      colorMid: '#ffb83a', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.edgeFlames = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4,
      shape: 'point', speed: 3.2, speedJitter: 0.5, spread: 14, gravity: -1.5, drag: 0.6,
      sizeStart: 0.6, sizeEnd: 0.05, colorStart: '#fff0b0', colorEnd: '#ff9a20',
      opacityStart: 0.5, opacityEnd: 0, additive: true,
      colorMid: '#ffc040', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 6, originY: 0.2, speed: 1.2, speedJitter: 0.5, spread: 14, gravity: -0.35, drag: 0.4,
      sizeStart: 0.17, sizeEnd: 0, colorStart: '#fff4cc', colorEnd: settings.color,
      opacityStart: 0.5, opacityEnd: 0, additive: true,
      colorMid: '#ffd36b', sizeJitter: 0.4, erosion: 0.45, spin: 0.4,
    });
    // Dark tertiary layer: smoke drifting up from the scorched ground behind the flames.
    this.smoke = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 2.5, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 6, originY: 0.1, speed: 0.9, speedJitter: 0.5, spread: 14, gravity: -0.3, drag: 0.6,
      sizeStart: 0.8, sizeEnd: 1.8, colorStart: '#6a5a46', colorEnd: '#2a241e',
      opacityStart: 0.22, opacityEnd: 0, additive: false,
      colorMid: '#4a3e32', sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 8, speedJitter: 0.6, spread: 90, gravity: 8, drag: 0.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ffb02a',
      opacityStart: 0.85, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.flames, this.edgeFlames, this.motes, this.smoke, this.sparks);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    for (const r of this.runes) r.ring.material.color.set(c);
    this.motes.settings.colorEnd = c;
    this.motes.applyStyle();
  }

  get duration() {
    return PLANT + this.settings.burnTime + FADE;
  }

  private pulseTime(k: number) {
    if (k === 0) return PLANT;
    return PLANT + 0.45 + (k - 1) * (this.settings.burnTime - 0.9) / (TICKS - 1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.pulseIdx = 0;
    this.ignite = 0;
    this.edgeAcc = 0;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    while (this.pulseIdx <= TICKS && this.time >= this.pulseTime(this.pulseIdx)) {
      this.sparks.burst(this.pulseIdx === 0 ? 500 : 140, ENEMY_POS);
      if (this.pulseIdx === 0) this.shake = 0.35;
      this.pulseIdx++;
    }
    // Tongues of flame along the rim of the circle.
    this.edgeAcc += 160 * this.ignite * dt;
    const R = this.settings.radius;
    while (this.edgeAcc >= 1) {
      this.edgeAcc -= 1;
      const a = Math.random() * Math.PI * 2;
      this.edgeFlames.burst(1, new THREE.Vector3(Math.cos(a) * R * 0.97, 0.05, Math.sin(a) * R * 0.97));
    }
    this.shake *= Math.exp(-dt * 8);
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const R = s.radius;
    const t = this.time;
    const dur = this.duration;
    const fade = 1 - smoothstep((t - (dur - FADE)) / FADE);
    const grow = smoothstep((t - PLANT) / 0.8);
    const vis = grow * fade;
    this.ignite = smoothstep((t - PLANT - 0.1) / 0.6) * (1 - smoothstep((t - PLANT - s.burnTime) / 0.5));

    // Caster leans in and pushes a glowing palm down into the ground at the enemy's feet.
    const reach = smoothstep((t - 0.15) / (PLANT - 0.15));
    this.caster.group.rotation.x = -0.15 * Math.sin(Math.PI * Math.min(1, t / (PLANT + 0.3)));
    const hand = new THREE.Vector3(CASTER_POS.x + 0.45, 2.4, CASTER_POS.z - 0.3);
    const feet = new THREE.Vector3(0.3, 0.25, 0.8);
    const hp = hand.clone().lerp(feet, reach);
    hp.y += 3 * Math.sin(Math.PI * reach);
    this.handGlow.mesh.position.copy(hp);
    const after = t - PLANT;
    if (t < PLANT) {
      this.handGlow.mesh.scale.setScalar(0.3 + 0.2 * reach);
      this.handGlow.opacity = 0.55 * smoothstep(t / 0.2);
    } else {
      this.handGlow.mesh.scale.setScalar(0.5 + after * 5);
      this.handGlow.opacity = 0.55 * Math.exp(-after * 5);
    }

    // Rune circle: every ring turns at its own speed.
    for (const r of this.runes) {
      r.ring.mesh.scale.setScalar(Math.max(0.001, R * r.frac * (0.55 + 0.45 * grow)));
      r.ring.mesh.rotation.z = t * r.speed;
      r.ring.material.opacity = r.strength * 0.8 * vis;
    }

    // Glow disc on the ground.
    this.glow.scale.setScalar(Math.max(0.001, R * 1.05 * (0.6 + 0.4 * grow)));
    this.glowMat.opacity = 0.32 * vis * (0.85 + 0.15 * Math.sin(t * 5));

    // Holy pulses rolling out from the centre; each one makes the enemy flash.
    for (const p of this.pulses) p.material.opacity = 0;
    let flash = 0;
    const pulseR: number[] = [];
    for (let k = 0; k <= TICKS; k++) {
      const dtk = t - this.pulseTime(k);
      if (dtk < 0) continue;
      flash += (k === 0 ? 0.9 : 0.6) * Math.exp(-dtk * 7);
      const p = dtk / 0.9;
      if (p < 1) {
        const ring = this.pulses[k % 2];
        ring.mesh.scale.setScalar(Math.max(0.001, R * (0.1 + 0.95 * p)));
        ring.material.opacity = (k === 0 ? 0.7 : 0.5) * (1 - p) * fade;
        pulseR.push(0.1 + 0.95 * p);
      }
    }
    this.enemy.setFlash(flash);

    // Belt of glyph quads: floating just above the ground, flaring as a pulse passes.
    const d = this.dummy;
    let gi = 0;
    for (let belt = 0; belt < 2; belt++) {
      const n = belt === 0 ? GLYPHS_OUTER : GLYPHS_INNER;
      const frac = belt === 0 ? 0.84 : 0.43;
      const spin = belt === 0 ? t * 0.25 : -t * 0.5;
      const size = R * (belt === 0 ? 0.075 : 0.07);
      for (let i = 0; i < n; i++, gi++) {
        const th = (i / n) * Math.PI * 2 + spin;
        const rr = R * frac * (0.55 + 0.45 * grow);
        d.position.set(Math.cos(th) * rr, 0.1 + 0.04 * Math.sin(t * 3 + i), Math.sin(th) * rr);
        d.rotation.set(0, Math.atan2(-Math.cos(th), -Math.sin(th)), 0);
        d.scale.setScalar(size * (0.8 + 0.3 * Math.sin(t * 2 + i * 1.7)));
        d.updateMatrix();
        this.glyphs.setMatrixAt(gi, d.matrix);
        let b = 0.45 + 0.15 * Math.sin(t * 4 + i * 2.1);
        for (const pr of pulseR) b += 0.9 * Math.exp(-Math.pow((pr - frac) / 0.06, 2));
        b *= vis;
        this.glyphs.setColorAt(gi, this.tmpColor.setRGB(1.3 * b, 0.9 * b, 0.3 * b));
      }
    }
    this.glyphs.instanceMatrix.needsUpdate = true;
    if (this.glyphs.instanceColor) this.glyphs.instanceColor.needsUpdate = true;

    // Flames, motes follow the circle size.
    const area = Math.max(0.01, R * 0.95 * grow);
    this.flames.settings.shapeSize = area;
    this.flames.settings.rate = 80 * R * this.ignite;
    this.motes.settings.shapeSize = area;
    this.smoke.settings.shapeSize = area;
    this.smoke.settings.rate = 6 * R * this.ignite;
    this.motes.settings.rate = 14 * R * this.ignite;
  }
}

export const consecrationModule: EffectModule = {
  label: 'consecration',
  category: 'paladin',
  create: () => new Consecration(),
  telegraphs(effect) {
    const s = (effect as Consecration).settings;
    // The consecrated circle burns from the plant until the flames die down.
    return [{
      shape: { kind: 'circle', x: 0, z: 0, radius: s.radius },
      start: 0.1, impact: PLANT, until: PLANT + s.burnTime,
    }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const s = (effect as Consecration).settings;
    frameArena(camera, controls, new THREE.Vector3(0, 2, 8), Math.max(11, s.radius * 1.5));
  },
  buildGui(f, effect) {
    const c = effect as Consecration;
    const s = c.settings;
    f.add(s, 'loop');
    f.add(s, 'radius', 3, 14, 0.1);
    f.add(s, 'burnTime', 1.5, 6, 0.1).name('burn time');
    f.addColor(s, 'color').onChange(() => c.applyStyle());
  },
};
