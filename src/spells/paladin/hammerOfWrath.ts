import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createHammerGeometry, createRing,
  frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Hammer of Wrath (reworked): a hammer condenses out of golden motes above the raised arm, is hurled end over
 * end along an arc with a comet trail, and detonates in a holy explosion. A spectral giant hammer echo slams
 * down a split second later and finishes the enemy.
 */
export interface HammerOfWrathSettings {
  hammerSize: number;
  castTime: number; // seconds of summoning before the throw
  flightTime: number;
  arcHeight: number;
  color: string;
  loop: boolean;
}

export const defaultHammerOfWrath = (): HammerOfWrathSettings => ({
  hammerSize: 2.2,
  castTime: 1.0,
  flightTime: 0.7,
  arcHeight: 4,
  color: '#ffcf6a',
  loop: false,
});

const AFTERMATH = 2.3;
const ECHO_DELAY = 0.12; // after impact
const ECHO_FALL = 0.18;
const ECHO_SIZE = 9;
const ECHO_HEIGHT = 18;

export class HammerOfWrath implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HammerOfWrathSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;
  private pos = new THREE.Vector3();
  private flying = false;

  private caster = createCaster();
  private enemy = new Enemy();
  private handGlow = new GlowSphere(0xffe2a0, { rim: false });
  private hammerMat = new THREE.MeshStandardMaterial({
    color: 0xc9a24e, metalness: 0.7, roughness: 0.35, emissive: 0xffc24a, emissiveIntensity: 0.7,
    transparent: true,
  });
  private pivot = new THREE.Group();
  private hammer = new THREE.Mesh(createHammerGeometry(), this.hammerMat);
  private cometHead = new GlowSphere(0xffd27a);
  private echoMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.0, 0.72, 0.28), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private echo = new THREE.Mesh(createHammerGeometry(), this.echoMat);
  private burst = new GlowSphere(0xffd27a);
  private shock = createRing(0xffd27a, 0.9, 1, 96);
  private shock2 = createRing(0xffe2a0, 0.9, 1, 96);
  private sparks: Emitter;
  private fire: Emitter;
  private trail: Emitter;
  private motes: Emitter;
  private dust: Emitter;
  private scorch = createRing(0xff9a30, 0.55, 1, 48);

  constructor(settings: HammerOfWrathSettings = defaultHammerOfWrath()) {
    this.settings = settings;
    this.hammer.position.y = -0.55; // pivot sits at the hammer's centre of mass so it tumbles about it
    this.pivot.add(this.hammer);
    this.echo.rotation.x = Math.PI;
    this.echo.scale.setScalar(ECHO_SIZE);
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.handGlow.mesh, this.pivot, this.cometHead.mesh, this.echo, this.burst.mesh);
    this.group.add(this.shock.mesh, this.shock2.mesh, this.scorch.mesh);
    this.scorch.mesh.position.set(ENEMY_POS.x, 0.04, ENEMY_POS.z);
    this.scorch.mesh.scale.setScalar(3);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, speed: 10, speedJitter: 0.6, spread: 180, gravity: 9, drag: 0.8,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ffb02a',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.fire = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.1, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.9, speed: 7, speedJitter: 0.5, spread: 24, gravity: -2, drag: 0.7,
      sizeStart: 0.5, sizeEnd: 0.1, colorStart: '#ffd070', colorEnd: '#ff7a10',
      colorMid: '#ffa23a', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
      opacityStart: 0.35, opacityEnd: 0, additive: true,
    });
    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 1800, rate: 0, lifetime: 0.55, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.25, speed: 1.2, speedJitter: 0.6, spread: 180, gravity: 0, drag: 1.2,
      sizeStart: 0.28, sizeEnd: 0.02, colorStart: '#fff2c4', colorEnd: settings.color,
      colorMid: '#ffd77a', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
      opacityStart: 0.5, opacityEnd: 0, additive: true,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.9, speed: 0.6, speedJitter: 0.5, spread: 180, gravity: -0.4, drag: 0.8,
      sizeStart: 0.16, sizeEnd: 0, colorStart: '#fff2c4', colorEnd: settings.color,
      colorMid: '#ffd77a', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
      opacityStart: 0.5, opacityEnd: 0, additive: true,
    });
    // Dark dust and smoke behind the bright burst; outlives every other layer.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.2, speed: 4.5, speedJitter: 0.5, spread: 80, gravity: -0.3, drag: 1.2,
      sizeStart: 0.8, sizeEnd: 1.8, colorStart: '#8a7656', colorMid: '#5a4a34', colorEnd: '#2a2218',
      sizeJitter: 0.4, erosion: 0.55, spin: 0.4, groundFade: 0.3,
      opacityStart: 0.3, opacityEnd: 0, additive: false,
    });
    this.emitters.push(this.dust, this.sparks, this.fire, this.trail, this.motes);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.hammerMat.emissive.set(c);
    this.burst.color.set(c);
    this.cometHead.color.set(c);
    this.shock.material.color.set(c);
    for (const e of [this.trail, this.motes]) {
      e.settings.colorEnd = c;
      e.applyStyle();
    }
  }

  get duration() {
    return this.settings.castTime + this.settings.flightTime + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.flying = false;
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
    const s = this.settings;
    const impactTime = s.castTime + s.flightTime;
    this.layout();
    // Summoning motes gather around the hammer; a comet trail streams behind it in flight.
    if (this.time < s.castTime) this.motes.burst(Math.ceil(dt * 260), this.pos);
    else if (this.flying) this.trail.burst(Math.ceil(dt * 900), this.pos);
    if (!this.impacted && this.time >= impactTime) {
      this.onImpact();
      this.layout();
    }
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const throwT = s.castTime;
    const impactTime = s.castTime + s.flightTime;
    const after = t - impactTime;

    // Caster: a glow gathers at the raised hand, released with the throw.
    const cast = smoothstep(t / s.castTime);
    const handPos = this.caster.group.position.clone().add(new THREE.Vector3(0.45, 2.4, -0.3));
    this.handGlow.mesh.position.copy(handPos);
    this.handGlow.mesh.scale.setScalar(0.15 + 0.35 * cast);
    this.handGlow.opacity = t < impactTime ? 0.5 * cast * (t < throwT ? 1 : 0.4) : 0;

    // Hammer: materialises above the hand, winds back, then tumbles along an arc to the enemy's chest.
    const appear = smoothstep(t / (s.castTime * 0.8));
    const hover = handPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    const target = new THREE.Vector3(ENEMY_POS.x, 1.3, ENEMY_POS.z);
    this.flying = t >= throwT && !this.impacted;
    if (t < throwT) {
      hover.y += 0.12 * Math.sin(t * 5);
      this.pos.copy(hover);
      this.pivot.rotation.set(0.5 * smoothstep((t - (throwT - 0.3)) / 0.3), 0, 0);
    } else {
      const f = Math.min(1, (t - throwT) / s.flightTime);
      const fe = Math.pow(f, 1.25);
      this.pos.lerpVectors(hover, target, fe);
      this.pos.y += s.arcHeight * Math.sin(Math.PI * fe);
      this.pivot.rotation.set(0.5 - fe * Math.PI * 2 * 2.5, 0, 0);
    }
    const alive = !this.impacted;
    this.pivot.visible = alive && appear > 0.01;
    this.pivot.position.copy(this.pos);
    this.pivot.scale.setScalar(s.hammerSize * (0.6 + 0.4 * appear));
    this.hammerMat.opacity = appear;
    this.hammerMat.emissiveIntensity = 0.5 + 0.4 * appear + (this.flying ? 0.3 : 0);
    this.cometHead.mesh.position.copy(this.pos);
    this.cometHead.mesh.scale.setScalar(this.flying ? 0.9 : 0.5 * appear);
    this.cometHead.opacity = alive ? (this.flying ? 0.35 : 0.2 * appear) : 0;

    // Impact: holy burst shell, double shockwave, spectral echo hammer.
    if (this.impacted) {
      this.burst.mesh.position.set(ENEMY_POS.x, 1.2, ENEMY_POS.z);
      this.burst.mesh.scale.setScalar(1 + after * 10);
      this.burst.opacity = 0.6 * Math.exp(-after * 4);
      this.shock.mesh.scale.setScalar(1 + after * 22);
      this.shock.material.opacity = Math.max(0, 0.8 * (1 - after / 0.7));
      this.scorch.material.opacity = 0.28 * smoothstep(after / 0.15) * Math.exp(-after * 0.7); // longest-lived layer
      const a2 = after - 0.3;
      this.shock2.mesh.scale.setScalar(1 + Math.max(0, a2) * 26);
      this.shock2.material.opacity = a2 > 0 ? Math.max(0, 0.7 * (1 - a2 / 0.6)) : 0;

      const e = after - ECHO_DELAY;
      const ef = THREE.MathUtils.clamp(e / ECHO_FALL, 0, 1);
      const ey = ECHO_HEIGHT * (1 - ef * ef);
      this.echo.position.set(ENEMY_POS.x, ey + ECHO_SIZE * 1.1, ENEMY_POS.z);
      this.echoMat.opacity = e < 0 ? 0 : 0.3 * smoothstep(e / 0.05) * (ef < 1 ? 1 : Math.exp(-(e - ECHO_FALL) * 3.5));
      this.echo.visible = this.echoMat.opacity > 0.005;

      const landed = ECHO_DELAY + ECHO_FALL;
      this.shake = after < landed ? 0.5 * Math.exp(-after * 7) : 0.9 * Math.exp(-(after - landed) * 6);
      this.enemy.setFlash(1.3 * Math.exp(-after * 4));
      this.enemy.setCrush(smoothstep((after - landed) / 0.12));
    } else {
      this.burst.opacity = 0;
      this.shock.material.opacity = 0;
      this.shock2.material.opacity = 0;
      this.scorch.material.opacity = 0;
      this.echoMat.opacity = 0;
      this.echo.visible = false;
    }
  }

  private onImpact() {
    this.impacted = true;
    this.sparks.burst(800, new THREE.Vector3(ENEMY_POS.x, 1.2, ENEMY_POS.z));
    this.fire.burst(500, new THREE.Vector3(ENEMY_POS.x, 0.3, ENEMY_POS.z));
    this.motes.burst(300, new THREE.Vector3(ENEMY_POS.x, 1.2, ENEMY_POS.z));
    this.dust.burst(260, new THREE.Vector3(ENEMY_POS.x, 0.2, ENEMY_POS.z));
  }
}

export const hammerOfWrathModule: EffectModule = {
  label: 'hammer of wrath',
  category: 'paladin',
  create: () => new HammerOfWrath(),
  telegraphs(effect) {
    const s = (effect as HammerOfWrath).settings;
    const impact = s.castTime + s.flightTime;
    return [
      // The thrown hammer detonates on the enemy.
      { shape: { kind: 'circle', x: ENEMY_POS.x, z: ENEMY_POS.z, radius: 3.2 }, start: Math.min(0.3, s.castTime * 0.5), impact },
      // The spectral echo hammer slams down on the same spot a split second later.
      {
        shape: { kind: 'circle', x: ENEMY_POS.x, z: ENEMY_POS.z, radius: ECHO_SIZE * 0.5 },
        start: impact, impact: impact + ECHO_DELAY + ECHO_FALL,
      },
    ];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    // Caster at z = 14, enemy at 0, arc and echo hammer reach up to ~20.
    frameArena(camera, controls, new THREE.Vector3(0, 5, 7), 13);
  },
  buildGui(f, effect) {
    const h = effect as HammerOfWrath;
    const s = h.settings;
    f.add(s, 'loop');
    f.add(s, 'hammerSize', 0.5, 6, 0.1).name('hammer size');
    f.add(s, 'castTime', 0.3, 3, 0.05).name('cast time');
    f.add(s, 'flightTime', 0.2, 2, 0.05).name('flight time');
    f.add(s, 'arcHeight', 0, 10, 0.1).name('arc height');
    f.addColor(s, 'color').onChange(() => h.applyStyle());
  },
};
