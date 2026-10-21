import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createHammerGeometry, createRing,
  frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Hammer of Justice (reworked): a giant spectral hammer materialises above the enemy and swings down like a
 * gavel onto its head. The enemy is crushed a little, then frozen: golden hammers circle its head, a chain of
 * golden links binds its waist, and everything fades.
 */
export interface HammerOfJusticeSettings {
  hammerSize: number;
  castTime: number; // materialise time before the swing
  swingTime: number;
  stunTime: number;
  color: string;
  loop: boolean;
}

export const defaultHammerOfJustice = (): HammerOfJusticeSettings => ({
  hammerSize: 5,
  castTime: 0.9,
  swingTime: 0.3,
  stunTime: 2,
  color: '#ffcf6a',
  loop: false,
});

const FADE = 0.7;
const HAMMER_COUNT = 5;
const LINK_COUNT = 12;
// Gavel pivot (the grip end of the handle) above and behind the enemy; the head ends on the enemy's head.
const PIVOT = new THREE.Vector3(ENEMY_POS.x, 6.2, ENEMY_POS.z + 3.6);
const A_RAISED = 1.9; // handle elevation angle when raised (up and slightly back)
const A_STRUCK = -0.83; // handle elevation angle at impact (pointing down toward the enemy)

export class HammerOfJustice implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HammerOfJusticeSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;
  private tmp = new THREE.Object3D();

  private caster = createCaster();
  private enemy = new Enemy();
  private handGlow = new GlowSphere(0xffe2a0, { rim: false });
  private hammerMat = new THREE.MeshStandardMaterial({
    color: 0xc9a24e, metalness: 0.4, roughness: 0.4, emissive: 0xffc24a, emissiveIntensity: 0.8,
    transparent: true, opacity: 0, depthWrite: false,
  });
  private hammer = new THREE.Mesh(createHammerGeometry(), this.hammerMat);
  private hammerAura = new GlowSphere(0xffd27a);
  private flash = new GlowSphere(0xffd27a);
  private shock = createRing(0xffd27a, 0.9, 1, 96);
  private rune = createRing(0xffc94a, 0.85, 1, 6);

  private goldMat = new THREE.MeshStandardMaterial({
    color: 0xc9a24e, metalness: 0.6, roughness: 0.35, emissive: 0xffc24a, emissiveIntensity: 0.7,
    transparent: true,
  });
  private orbitHammers = new THREE.InstancedMesh(
    createHammerGeometry().translate(0, -0.5, 0), this.goldMat, HAMMER_COUNT,
  );
  private links = new THREE.InstancedMesh(new THREE.TorusGeometry(0.17, 0.05, 8, 16), this.goldMat, LINK_COUNT);
  private stunRing = createRing(0xffe2a0, 0.9, 1, 64);
  private sparks: Emitter;
  private motes: Emitter;
  private dust: Emitter;

  constructor(settings: HammerOfJusticeSettings = defaultHammerOfJustice()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group, this.handGlow.mesh);
    this.group.add(this.hammer, this.hammerAura.mesh, this.flash.mesh, this.shock.mesh, this.rune.mesh);
    this.group.add(this.orbitHammers, this.links, this.stunRing.mesh);
    this.links.frustumCulled = false;
    this.orbitHammers.frustumCulled = false;

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 8, speedJitter: 0.6, spread: 180, gravity: 9, drag: 0.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ffb02a',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.4, speed: 0.8, speedJitter: 0.5, spread: 180, gravity: -0.4, drag: 0.8,
      sizeStart: 0.16, sizeEnd: 0, colorStart: '#fff2c4', colorEnd: settings.color,
      colorMid: '#ffd77a', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
      opacityStart: 0.4, opacityEnd: 0, additive: true,
    });
    // Dark dust thrown up by the gavel strike, behind the bright layers.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.0, speed: 4, speedJitter: 0.5, spread: 80, gravity: -0.3, drag: 1.2,
      sizeStart: 0.7, sizeEnd: 1.6, colorStart: '#8a7656', colorMid: '#5a4a34', colorEnd: '#2a2218',
      sizeJitter: 0.4, erosion: 0.55, spin: 0.4, groundFade: 0.3,
      opacityStart: 0.3, opacityEnd: 0, additive: false,
    });
    this.emitters.push(this.dust, this.sparks, this.motes);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.hammerMat.emissive.set(c);
    this.goldMat.emissive.set(c);
    this.hammerAura.color.set(c);
    this.flash.color.set(c);
    this.shock.material.color.set(c);
    this.rune.material.color.set(c);
    this.motes.settings.colorEnd = c;
    this.motes.applyStyle();
  }

  get duration() {
    const s = this.settings;
    return s.castTime + s.swingTime + s.stunTime + FADE;
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
    const s = this.settings;
    // Motes gather while the hammer materialises.
    if (this.time < s.castTime) this.motes.burst(Math.ceil(dt * 200), new THREE.Vector3(PIVOT.x, 7, PIVOT.z - 2));
    if (!this.impacted && this.time >= s.castTime + s.swingTime) this.onImpact();
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const impactTime = s.castTime + s.swingTime;
    const after = t - impactTime;
    const fade = 1 - smoothstep((t - (this.duration - FADE)) / FADE);
    const size = s.hammerSize;

    // Caster: raised hand with a glow while the spell gathers.
    const cast = smoothstep(t / s.castTime);
    const handPos = this.caster.group.position.clone().add(new THREE.Vector3(0.45, 2.4, -0.3));
    this.handGlow.mesh.position.copy(handPos);
    this.handGlow.mesh.scale.setScalar(0.15 + 0.35 * cast);
    this.handGlow.opacity = t < impactTime ? 0.5 * cast : 0.5 * Math.exp(-after * 5);

    // Judgement rune on the ground under the enemy.
    const runeOp = (this.impacted ? 0.6 : 0.5 * cast) * fade;
    this.rune.mesh.scale.setScalar(3.5 - 0.8 * cast);
    this.rune.mesh.rotation.z = t * 1.4;
    this.rune.material.opacity = runeOp;

    // Gavel: materialises raised, pulls back slightly, then swings down fast (ease-in).
    const appear = smoothstep(t / (s.castTime * 0.7));
    let a: number;
    if (t < s.castTime) a = A_RAISED + 0.25 * smoothstep((t - (s.castTime - 0.35)) / 0.35);
    else if (t < impactTime) {
      const f = (t - s.castTime) / s.swingTime;
      a = THREE.MathUtils.lerp(A_RAISED + 0.25, A_STRUCK, Math.pow(f, 2.2));
    } else a = A_STRUCK;
    this.hammer.scale.setScalar(size);
    this.hammer.position.copy(PIVOT);
    this.hammer.rotation.set(a - Math.PI / 2, 0, 0); // handle direction (0, sin a, -cos a)
    const hOp = this.impacted ? Math.exp(-after * 3) : 1;
    this.hammerMat.opacity = 0.55 * appear * hOp;
    this.hammerMat.emissiveIntensity = 0.8 + (this.impacted ? 1.4 * Math.exp(-after * 6) : 0);
    this.hammer.visible = this.hammerMat.opacity > 0.01;
    const headDir = new THREE.Vector3(0, Math.sin(a), -Math.cos(a));
    this.hammerAura.mesh.position.copy(PIVOT).addScaledVector(headDir, size * 0.85);
    this.hammerAura.mesh.scale.setScalar(size * 0.4);
    this.hammerAura.opacity = 0.18 * appear * hOp;

    // Impact: flash, small shockwave, camera kick, enemy crushed slightly then frozen.
    if (this.impacted) {
      this.flash.mesh.position.set(ENEMY_POS.x, 2.4, ENEMY_POS.z);
      this.flash.mesh.scale.setScalar(0.8 + after * 6);
      this.flash.opacity = 0.55 * Math.exp(-after * 7);
      this.shock.mesh.scale.setScalar(1 + after * 16);
      this.shock.material.opacity = Math.max(0, 0.7 * (1 - after / 0.55));
      this.shake = 0.4 * Math.exp(-after * 8);
      this.enemy.setFlash(1.2 * Math.exp(-after * 5));
      this.enemy.setCrush(0.28 * smoothstep(after / 0.08) * fade);
    } else {
      this.flash.opacity = 0;
      this.shock.material.opacity = 0;
    }

    // Stun: golden hammers circling the head, a chain of links binding the waist.
    const stun = this.impacted ? smoothstep((after - 0.1) / 0.3) * fade : 0;
    const stunOn = stun > 0.001;
    this.orbitHammers.visible = stunOn;
    this.links.visible = stunOn;
    this.goldMat.opacity = stun;
    this.stunRing.mesh.position.set(ENEMY_POS.x, 3.1 + 0.1 * Math.sin(t * 3), ENEMY_POS.z);
    this.stunRing.mesh.scale.setScalar(1.15);
    this.stunRing.mesh.rotation.z = -t * 1.5;
    this.stunRing.material.opacity = 0.35 * stun;
    if (stunOn) {
      const o = this.tmp;
      const headY = 3.1 + 0.1 * Math.sin(t * 3);
      for (let i = 0; i < HAMMER_COUNT; i++) {
        const th = t * 3.2 + (i / HAMMER_COUNT) * Math.PI * 2;
        o.position.set(ENEMY_POS.x + Math.cos(th) * 1.15, headY, ENEMY_POS.z + Math.sin(th) * 1.15);
        o.rotation.set(0, 0, 0);
        o.rotateY(-th); // head points outward, handle tangential-ish
        o.rotateZ(t * 9 + i); // tumbles about its own axis
        o.scale.setScalar(0.55 * stun);
        o.updateMatrix();
        this.orbitHammers.setMatrixAt(i, o.matrix);
      }
      this.orbitHammers.instanceMatrix.needsUpdate = true;

      const snap = 0.7 + 0.3 * smoothstep((after - 0.1) / 0.25); // links tighten onto the waist
      for (let i = 0; i < LINK_COUNT; i++) {
        const th = (i / LINK_COUNT) * Math.PI * 2 + t * 0.4;
        const r = 0.82 * (2 - snap);
        o.position.set(ENEMY_POS.x + Math.cos(th) * r, 1.0, ENEMY_POS.z + Math.sin(th) * r);
        o.rotation.order = 'YXZ';
        o.rotation.set(i % 2 === 0 ? 0 : Math.PI / 2, -th - Math.PI / 2, 0);
        o.scale.setScalar(stun);
        o.updateMatrix();
        this.links.setMatrixAt(i, o.matrix);
      }
      this.links.instanceMatrix.needsUpdate = true;
      o.rotation.order = 'XYZ';
    }
  }

  private onImpact() {
    this.impacted = true;
    this.sparks.burst(450, new THREE.Vector3(ENEMY_POS.x, 2.3, ENEMY_POS.z));
    this.motes.burst(200, new THREE.Vector3(ENEMY_POS.x, 2.6, ENEMY_POS.z));
    this.dust.burst(240, new THREE.Vector3(ENEMY_POS.x, 0.2, ENEMY_POS.z));
  }
}

export const hammerOfJusticeModule: EffectModule = {
  label: 'hammer of justice',
  category: 'paladin',
  create: () => new HammerOfJustice(),
  telegraphs(effect) {
    const s = (effect as HammerOfJustice).settings;
    // The gavel strikes the ground under the enemy's head.
    return [{
      shape: { kind: 'circle', x: ENEMY_POS.x, z: ENEMY_POS.z, radius: 2.6 },
      start: Math.min(0.3, s.castTime * 0.4), impact: s.castTime + s.swingTime,
    }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const s = (effect as HammerOfJustice).settings;
    frameArena(camera, controls, new THREE.Vector3(0, 4, 3), Math.max(8, s.hammerSize * 1.6));
  },
  buildGui(f, effect) {
    const h = effect as HammerOfJustice;
    const s = h.settings;
    f.add(s, 'loop');
    f.add(s, 'hammerSize', 2, 10, 0.1).name('hammer size');
    f.add(s, 'castTime', 0.3, 3, 0.05).name('cast time');
    f.add(s, 'swingTime', 0.1, 1, 0.05).name('swing time');
    f.add(s, 'stunTime', 0.5, 5, 0.1).name('stun time');
    f.addColor(s, 'color').onChange(() => h.applyStyle());
  },
};
