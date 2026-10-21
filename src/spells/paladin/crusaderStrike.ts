import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Crusader Strike (reworked): the caster crouches, dashes in leaving a golden afterimage trail, and a giant
 * crescent of light cuts through the enemy. A crusader cross imprints at the hit point, sparks fly, the enemy
 * flashes and staggers, then the caster leaps back to its start.
 */
export interface CrusaderStrikeSettings {
  dashTime: number; // seconds of the dash
  crossSize: number;
  color: string;
  loop: boolean;
}

export const defaultCrusaderStrike = (): CrusaderStrikeSettings => ({
  dashTime: 0.3,
  crossSize: 1,
  color: '#ffc94a',
  loop: false,
});

const WIND = 0.55;
const STRIKE_Z = 2.4; // where the caster stops, just in front of the enemy
const HOLD = 0.45; // time spent at the enemy after the dash lands
const LEAP = 0.5;
const AFTERMATH = 1.1;
const GHOSTS = 4;
const GHOST_LAG = 0.045;
const SLASH_TIME = 0.26;
const PIVOT = new THREE.Vector3(0.4, 3.6, 2.2); // centre of the crescent's circle
const CHEST = new THREE.Vector3(0.5, 1.5, 0);

export class CrusaderStrike implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CrusaderStrikeSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private hit = false;

  private caster = createCaster();
  private enemy = new Enemy();
  private ghostMats: THREE.MeshBasicMaterial[] = [];
  private ghosts: THREE.Mesh[] = [];
  private arcPivot = new THREE.Group();
  private arcMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private arcCoreMat = new THREE.MeshBasicMaterial({
    color: 0xfff0c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private arc = new THREE.Mesh(new THREE.RingGeometry(2.75, 3.35, 48, 1, 0, 1.3), this.arcMat);
  private arcTrailMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private arcTrail = new THREE.Mesh(new THREE.RingGeometry(2.75, 3.35, 48, 1, 0, 1.3), this.arcTrailMat);
  private arcCore = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.2, 48, 1, 0.05, 1.2), this.arcCoreMat);
  private crossMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.5, 1.1, 0.45), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private cross = new THREE.Group();
  private flare = new GlowSphere(0xffd27a);
  private shock = createRing(0xffd27a, 0.85, 1, 64);
  private sparks: Emitter;
  private trail: Emitter;
  private dust: Emitter;

  constructor(settings: CrusaderStrikeSettings = defaultCrusaderStrike()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);

    const ghostGeo = new THREE.CapsuleGeometry(0.55, 1.1, 4, 12).translate(0, 1.1, 0);
    for (let i = 0; i < GHOSTS; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: 0xffc84a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const g = new THREE.Mesh(ghostGeo, m);
      g.visible = false;
      this.ghostMats.push(m);
      this.ghosts.push(g);
      this.group.add(g);
    }

    this.arcPivot.position.copy(PIVOT);
    this.arcPivot.rotation.y = Math.PI / 2; // ring plane faces the +X camera
    this.arcPivot.add(this.arcTrail, this.arc, this.arcCore);
    this.group.add(this.arcPivot);

    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.6, 0.32), this.crossMat);
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 2.3), this.crossMat);
    hBar.position.y = 0.6;
    this.cross.add(vBar, hBar);
    this.group.add(this.cross, this.flare.mesh, this.shock.mesh);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 10, speedJitter: 0.6, spread: 180, gravity: 9, drag: 0.8,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ffb02a',
      opacityStart: 0.85, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 0.6, lifetimeJitter: 0.4,
      shape: 'box', shapeSize: 0.6, speed: 0.8, speedJitter: 0.5, spread: 180, gravity: -0.5, drag: 0.5,
      sizeStart: 0.16, sizeEnd: 0, colorStart: '#fff2c4', colorEnd: settings.color,
      opacityStart: 0.5, opacityEnd: 0, additive: true,
      colorMid: '#ffd36b', sizeJitter: 0.4, erosion: 0.45, spin: 0.4,
    });
    // Dark tertiary layer: dust puff at the enemy's feet behind the bright hit.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 1.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.8, speed: 3, speedJitter: 0.6, spread: 80, gravity: -0.2, drag: 1.2,
      sizeStart: 0.6, sizeEnd: 1.3, colorStart: '#8a7556', colorEnd: '#2a241e',
      opacityStart: 0.35, opacityEnd: 0, additive: false,
      colorMid: '#5a4a38', sizeJitter: 0.4, erosion: 0.55, spin: 0.4,
    });
    this.emitters.push(this.sparks, this.trail, this.dust);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.arcMat.color.set(c);
    this.flare.color.set(c);
    this.trail.settings.colorEnd = c;
    this.trail.applyStyle();
  }

  private get dashStart() { return WIND; }
  private get dashEnd() { return WIND + this.settings.dashTime; }
  private get slashStart() { return this.dashEnd - 0.1; }
  private get hitTime() { return this.slashStart + 0.14; }
  private get leapStart() { return this.dashEnd + HOLD; }

  get duration() {
    return this.leapStart + LEAP + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hit = false;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  /** Caster ground position (z) and hop height at time t. */
  private casterAt(t: number) {
    const s = this.settings;
    const home = CASTER_POS.z;
    let z = home;
    let y = 0;
    if (t < this.dashStart) {
      z = home + 0.5 * smoothstep(t / this.dashStart); // coils back
    } else if (t < this.dashEnd) {
      const p = (t - this.dashStart) / s.dashTime;
      z = THREE.MathUtils.lerp(home + 0.5, STRIKE_Z, 1 - Math.pow(1 - p, 3));
      y = 0.3 * Math.sin(p * Math.PI);
    } else if (t < this.leapStart) {
      z = STRIKE_Z;
    } else if (t < this.leapStart + LEAP) {
      const p = (t - this.leapStart) / LEAP;
      z = THREE.MathUtils.lerp(STRIKE_Z, home, smoothstep(p));
      y = 2.2 * Math.sin(p * Math.PI);
    } else {
      z = home;
    }
    return { z, y };
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    if (!this.hit && this.time >= this.hitTime) this.onHit();
    // Gold motes shed along the dash and the leap back.
    const now = this.casterAt(this.time);
    const prev = this.casterAt(Math.max(0, this.time - dt));
    const moved = Math.abs(now.z - prev.z);
    if (moved > 0.05 && this.time > this.dashStart) {
      this.trail.burst(Math.min(30, Math.ceil(moved * 6)), new THREE.Vector3(0, 1 + now.y, now.z));
    }
    this.layout();
  }

  private layout() {
    const t = this.time;
    const s = this.settings;
    const after = t - this.hitTime;
    const fade = 1 - smoothstep((t - (this.duration - 0.5)) / 0.5);

    // Caster: crouch while coiling, lean into the dash.
    const c = this.casterAt(t);
    this.caster.group.position.set(CASTER_POS.x, c.y, c.z);
    const coil = t < this.dashStart ? smoothstep(t / this.dashStart) : 0;
    this.caster.group.scale.set(1 + 0.08 * coil, 1 - 0.12 * coil, 1 + 0.08 * coil);
    const dashing = t >= this.dashStart && t < this.dashEnd;
    this.caster.group.rotation.x = dashing ? -0.35 : t >= this.leapStart && t < this.leapStart + LEAP ? 0.25 : 0;
    this.caster.setFlash(0.5 * coil);

    // Afterimages: lagged copies of the caster, visible only while it is moving fast.
    for (let i = 0; i < GHOSTS; i++) {
      const lt = Math.max(0, t - (i + 1) * GHOST_LAG);
      const p = this.casterAt(lt);
      const speed = Math.min(1, Math.abs(c.z - p.z) / 3);
      this.ghosts[i].position.set(CASTER_POS.x, p.y, p.z);
      this.ghosts[i].rotation.x = this.caster.group.rotation.x;
      this.ghostMats[i].opacity = 0.32 * (1 - i / (GHOSTS + 0.5)) * speed;
      this.ghosts[i].visible = this.ghostMats[i].opacity > 0.01;
    }

    // Crescent: sweeps through the enemy's chest, then fades.
    const p = THREE.MathUtils.clamp((t - this.slashStart) / SLASH_TIME, 0, 1);
    const arcAt = (tt: number) => tt < this.slashStart ? 0
      : 0.7 * smoothstep(THREE.MathUtils.clamp((tt - this.slashStart) / SLASH_TIME, 0, 1) * 4) * (1 - smoothstep((tt - this.slashStart - 0.16) / 0.4));
    const arcOp = arcAt(t);
    this.arc.rotation.z = 0.4 - 2.2 * p;
    this.arcCore.rotation.z = this.arc.rotation.z;
    // Faint afterimage: a dimmer copy lagging behind the sweep.
    const pLag = THREE.MathUtils.clamp((t - 0.05 - this.slashStart) / SLASH_TIME, 0, 1);
    this.arcTrail.rotation.z = 0.4 - 2.2 * pLag + 0.12;
    this.arcTrailMat.opacity = 0.4 * arcAt(t - 0.05);
    this.arcMat.opacity = arcOp;
    this.arcCoreMat.opacity = arcOp * 0.8;
    this.arcPivot.visible = arcOp > 0.01 || this.arcTrailMat.opacity > 0.01;

    // Cross + impact flare at the hit point.
    if (this.hit) {
      const pop = 0.4 + 0.6 * Math.sqrt(Math.min(1, after / 0.12));
      this.cross.position.copy(CHEST);
      this.cross.scale.setScalar(s.crossSize * pop);
      this.crossMat.opacity = 0.75 * Math.exp(-Math.max(0, after - 0.1) * 3.5) * fade;
      this.cross.visible = this.crossMat.opacity > 0.01;
      this.flare.mesh.position.copy(CHEST);
      this.flare.mesh.scale.setScalar(1.2 + after * 5);
      this.flare.opacity = 0.38 * Math.exp(-after * 8);
      this.shock.mesh.position.set(0, 0.04, 0);
      this.shock.mesh.scale.setScalar(1 + after * 16);
      this.shock.material.opacity = Math.max(0, 0.6 * (1 - after / 0.6));
      this.shake = 0.35 * Math.exp(-after * 8);
      // Enemy flash and stagger: knocked back, leaning away, then recovers.
      this.enemy.setFlash(0.9 * Math.exp(-after * 5));
      const stag = smoothstep(after / 0.12) * Math.exp(-Math.max(0, after - 0.12) * 2.2);
      this.enemy.group.position.set(ENEMY_POS.x, 0, ENEMY_POS.z - 0.9 * stag);
      this.enemy.group.rotation.x = -0.3 * stag;
    } else {
      this.cross.visible = false;
      this.flare.opacity = 0;
      this.shock.material.opacity = 0;
    }
  }

  private onHit() {
    this.hit = true;
    this.sparks.burst(600, CHEST);
    this.dust.burst(180, new THREE.Vector3(0, 0.1, 0));
  }
}

export const crusaderStrikeModule: EffectModule = {
  label: 'crusader strike',
  category: 'paladin',
  create: () => new CrusaderStrike(),
  telegraphs(effect) {
    const s = (effect as CrusaderStrike).settings;
    // The hit lands at slashStart + 0.14 = WIND + dashTime - 0.1 + 0.14.
    const impact = WIND + s.dashTime + 0.04;
    return [
      { shape: { kind: 'line', x1: 0, z1: STRIKE_Z + 4, x2: 0, z2: 0, width: 2.4 }, start: 0.15, impact },
      { shape: { kind: 'circle', x: 0, z: 0, radius: 2.2 }, start: 0.15, impact },
    ];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    // Caster at z = 14 dashes to z = 2.4, enemy at 0.
    frameArena(camera, controls, new THREE.Vector3(0, 1.5, 7), 11);
  },
  buildGui(f, effect) {
    const e = effect as CrusaderStrike;
    const s = e.settings;
    f.add(s, 'loop');
    f.add(s, 'dashTime', 0.15, 0.8, 0.01).name('dash time');
    f.add(s, 'crossSize', 0.4, 2.5, 0.05).name('cross size');
    f.addColor(s, 'color').onChange(() => e.applyStyle());
  },
};
