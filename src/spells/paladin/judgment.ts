import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  ENEMY_POS, Enemy, GlowSphere, LightPillar, createCaster, createGround, createHammerGeometry, createRing,
  frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Judgment (reworked): the caster raises a hand, a rune circle locks onto the enemy, and a giant hammer of
 * light drops out of the sky onto it. Holy burst, shockwave, rising motes, and a judgement sigil that lingers
 * over the enemy's head.
 */
export interface JudgmentSettings {
  hammerSize: number;
  dropHeight: number;
  castTime: number; // seconds from cast to the hammer starting to fall
  fallTime: number;
  color: string;
  loop: boolean;
}

export const defaultJudgment = (): JudgmentSettings => ({
  hammerSize: 6,
  dropHeight: 22,
  castTime: 0.9,
  fallTime: 0.35,
  color: '#ffcf6a',
  loop: false,
});

const AFTERMATH = 2.6;

export class Judgment implements Effect {
  readonly group = new THREE.Group();
  readonly settings: JudgmentSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;

  private caster = createCaster();
  private enemy = new Enemy();
  private handGlow = new GlowSphere(0xffe2a0, { rim: false });
  private hammerMat = new THREE.MeshStandardMaterial({
    color: 0xc9a24e, metalness: 0.7, roughness: 0.35, emissive: 0xffc24a, emissiveIntensity: 0.6,
    transparent: true,
  });
  private hammer = new THREE.Mesh(createHammerGeometry(), this.hammerMat);
  private pillar = new LightPillar(0xffd36b, 0.8);
  private rune = createRing(0xffc94a, 0.82, 1, 6); // hexagonal lock-on rune
  private runeInner = createRing(0xffc94a, 0.45, 0.5, 64);
  private shock = createRing(0xffd27a, 0.9, 1, 96);
  private burst = new GlowSphere(0xffd27a);
  private sigil = createRing(0xffe2a0, 0.7, 0.8, 4); // diamond sigil above the head
  private sparks: Emitter;
  private motes: Emitter;
  private dust: Emitter;

  constructor(settings: JudgmentSettings = defaultJudgment()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.handGlow.mesh, this.hammer, this.pillar.mesh, this.burst.mesh);
    this.group.add(this.rune.mesh, this.runeInner.mesh, this.shock.mesh, this.sigil.mesh);
    this.sigil.mesh.rotation.set(0, 0, 0); // stands upright, facing the camera side

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, speed: 9, speedJitter: 0.6, spread: 80, gravity: 9, drag: 0.8,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ffb02a',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 2.2, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 2.5, speed: 1.6, speedJitter: 0.5, spread: 20, gravity: -0.6, drag: 0.6,
      sizeStart: 0.2, sizeEnd: 0, colorStart: '#fff2c4', colorEnd: settings.color,
      opacityStart: 0.4, opacityEnd: 0, additive: true,
      colorMid: '#ffd36b', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    // Dark tertiary layer: dust kicked up behind the bright burst.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.6, speed: 3.5, speedJitter: 0.6, spread: 80, gravity: -0.2, drag: 1.2,
      sizeStart: 0.9, sizeEnd: 1.8, colorStart: '#8a7556', colorEnd: '#2a241e',
      opacityStart: 0.4, opacityEnd: 0, additive: false,
      colorMid: '#5a4a38', sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
    });
    this.emitters.push(this.sparks, this.motes, this.dust);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.hammerMat.emissive.set(c);
    this.pillar.color.set(c);
    this.rune.material.color.set(c);
    this.runeInner.material.color.set(c);
    this.burst.color.set(c);
    this.motes.settings.colorEnd = c;
    this.motes.applyStyle();
  }

  get duration() {
    return this.settings.castTime + this.settings.fallTime + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
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
    const impactTime = this.settings.castTime + this.settings.fallTime;
    if (!this.impacted && this.time >= impactTime) this.onImpact();
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const impactTime = s.castTime + s.fallTime;
    const after = t - impactTime;
    const fade = 1 - smoothstep((t - (this.duration - 0.8)) / 0.8);

    // Caster: a glow gathers in the raised hand, released when the hammer drops.
    const cast = smoothstep(t / s.castTime);
    const handPos = this.caster.group.position.clone().add(new THREE.Vector3(0.45, 2.4, -0.3));
    this.handGlow.mesh.position.copy(handPos);
    this.handGlow.mesh.scale.setScalar(0.15 + 0.35 * cast);
    this.handGlow.opacity = t < impactTime ? 0.5 * cast : 0.5 * Math.exp(-after * 6);

    // Lock-on rune under the enemy: spins in, tightens, flashes on impact.
    const lock = smoothstep(t / (s.castTime * 0.7));
    const runeR = 4.5 - 1.5 * lock;
    this.rune.mesh.scale.setScalar(runeR);
    this.rune.mesh.rotation.z = t * 1.5;
    this.runeInner.mesh.scale.setScalar(runeR);
    this.runeInner.mesh.rotation.z = -t * 2;
    const runeOp = this.impacted ? 0.8 * Math.exp(-after * 1.5) : 0.6 * lock;
    this.rune.material.opacity = runeOp * fade;
    this.runeInner.material.opacity = runeOp * 0.8 * fade;

    // Hammer of light: appears high above, turns head-down, then slams.
    const appear = smoothstep((t - s.castTime * 0.4) / (s.castTime * 0.5));
    let hy: number;
    if (t < s.castTime) hy = s.dropHeight;
    else if (t < impactTime) hy = s.dropHeight * (1 - Math.pow((t - s.castTime) / s.fallTime, 2));
    else hy = 0;
    // Head down: geometry has the head at +1, so flip it and put the head's striking face at hy.
    this.hammer.rotation.set(Math.PI, 0, 0);
    this.hammer.scale.setScalar(s.hammerSize);
    this.hammer.position.set(ENEMY_POS.x, hy + s.hammerSize * 1.1, ENEMY_POS.z);
    this.hammerMat.opacity = appear * (this.impacted ? Math.exp(-after * 2.5) : 1);
    this.hammer.visible = this.hammerMat.opacity > 0.01;
    this.hammerMat.emissiveIntensity = this.impacted ? 0.6 + 1.6 * Math.exp(-after * 4) : 0.5;

    // Pillar of light along the drop line.
    const pillarOp = this.impacted ? 0.5 * Math.exp(-after * 2) : 0.25 * appear;
    this.pillar.set(ENEMY_POS.x, ENEMY_POS.z, 0, s.dropHeight + s.hammerSize * 2, pillarOp * fade);

    // Impact: holy burst shell + ground shockwave.
    if (this.impacted) {
      this.burst.mesh.position.set(ENEMY_POS.x, 1.2, ENEMY_POS.z);
      this.burst.mesh.scale.setScalar(1 + after * 9);
      this.burst.opacity = 0.6 * Math.exp(-after * 4);
      this.shock.mesh.scale.setScalar(1 + after * 22);
      this.shock.material.opacity = Math.max(0, 0.8 * (1 - after / 0.7));
      this.shake = 0.5 * Math.exp(-after * 7);
      this.enemy.setFlash(1.2 * Math.exp(-after * 4));
      // The enemy is staggered (knocked down to one knee), not destroyed.
      this.enemy.group.scale.set(1, 1 - 0.25 * smoothstep(after / 0.1) * Math.exp(-after * 1.5), 1);
    } else {
      this.burst.opacity = 0;
      this.shock.material.opacity = 0;
    }

    // Judgement sigil hovering over the enemy's head after the hit.
    const sig = this.impacted ? smoothstep((after - 0.15) / 0.3) * fade : 0;
    this.sigil.mesh.position.set(ENEMY_POS.x, 3.4 + 0.15 * Math.sin(t * 3), ENEMY_POS.z);
    this.sigil.mesh.rotation.set(0, Math.PI / 2, t * 0.8); // faces +X, the camera side
    this.sigil.mesh.scale.setScalar(0.6);
    this.sigil.material.opacity = 0.7 * sig;
  }

  private onImpact() {
    this.impacted = true;
    this.sparks.burst(700, ENEMY_POS);
    this.motes.burst(400, ENEMY_POS);
    this.dust.burst(260, ENEMY_POS);
  }
}

export const judgmentModule: EffectModule = {
  label: 'judgment',
  category: 'paladin',
  create: () => new Judgment(),
  telegraphs(effect) {
    const s = (effect as Judgment).settings;
    return [{ shape: { kind: 'circle', x: ENEMY_POS.x, z: ENEMY_POS.z, radius: 3 }, start: 0.1, impact: s.castTime + s.fallTime }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const s = (effect as Judgment).settings;
    // Caster at z = 14, enemy at 0, hammer drops from dropHeight.
    frameArena(camera, controls, new THREE.Vector3(0, s.dropHeight * 0.35, 7), Math.max(11, s.dropHeight * 0.55));
  },
  buildGui(f, effect) {
    const j = effect as Judgment;
    const s = j.settings;
    f.add(s, 'loop');
    f.add(s, 'hammerSize', 1, 15, 0.1).name('hammer size');
    f.add(s, 'dropHeight', 5, 60, 0.5).name('drop height');
    f.add(s, 'castTime', 0.2, 3, 0.05).name('cast time');
    f.add(s, 'fallTime', 0.1, 2, 0.05).name('fall time');
    f.addColor(s, 'color').onChange(() => j.applyStyle());
  },
};
