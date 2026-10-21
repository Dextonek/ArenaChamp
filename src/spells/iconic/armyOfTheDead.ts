import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';
import type { TelegraphSpec } from '../../effects/telegraph';

/**
 * Army of the Dead (reworked): the death knight channels, frost runes spin under him and the ground cracks with
 * sickly green-blue light. Undead minions claw up out of the earth in an arc in front of him, one after another,
 * in bursts of dirt and green glow while a cold mist rolls over the ground. Once free they shamble toward the enemy.
 */
export interface ArmyOfTheDeadSettings {
  minions: number; // 8..12
  castTime: number; // seconds of channelling before the first minion rises
  shambleDistance: number; // how far the minions walk toward the enemy
  color: string; // necrotic glow colour
  loop: boolean;
}

export const defaultArmyOfTheDead = (): ArmyOfTheDeadSettings => ({
  minions: 10,
  castTime: 0.9,
  shambleDistance: 3.5,
  color: '#3affb4',
  loop: false,
});

const DURATION = 5;
const MAX_MINIONS = 12;
const RISE = 0.75; // seconds a minion takes to climb out
const CRACKS = 18;
const FADE = 0.9;
const SCALE = 0.7;
const ARC_CENTER = new THREE.Vector3(0, 0, 8.5);

/** Time minion i breaks the surface. */
function riseTime(castTime: number, i: number, count: number) {
  return castTime + 0.1 + (i / count) * 1.9 + Math.sin(i * 5.1) * 0.12;
}

interface Minion {
  enemy: Enemy;
  glow: GlowSphere;
  ring: ReturnType<typeof createRing>;
  base: THREE.Vector3;
  riseT: number;
  lean: number;
  phase: number;
  burst: boolean;
}

export class ArmyOfTheDead implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ArmyOfTheDeadSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private mistAcc = 0;
  private caster = createCaster(0x2a3340);
  private chestGlow = new GlowSphere(0x4affc0, { rim: false });
  private runeA = createRing(0x7ec8ff, 0.8, 1, 6);
  private runeB = createRing(0x7ec8ff, 0.5, 0.56, 4);
  private runeC = createRing(0x7ec8ff, 0.93, 1, 96);
  private cracks: THREE.Mesh[] = [];
  private crackMat = new THREE.MeshBasicMaterial({
    color: 0x3affb4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide,
  });
  private minions: Minion[] = [];
  private dirt: Emitter;
  private mist: Emitter;

  constructor(settings: ArmyOfTheDeadSettings = defaultArmyOfTheDead()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.chestGlow.mesh);
    this.group.add(this.runeA.mesh, this.runeB.mesh, this.runeC.mesh);

    // Cracks: thin quads radiating from the caster across the ground toward the arc.
    const crackGeo = new THREE.PlaneGeometry(0.16, 1);
    crackGeo.translate(0, 0.5, 0);
    for (let i = 0; i < CRACKS; i++) {
      const m = new THREE.Mesh(crackGeo, this.crackMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0.05, 14);
      m.rotation.order = 'YXZ'; // X lays the quad flat (+Y -> -Z), then Y yaws it around the caster
      m.userData.angle = ((i + 0.5) / CRACKS - 0.5) * 2.4 + Math.sin(i * 3.3) * 0.05; // fan toward the enemy
      m.userData.len = 4.5 + (i % 5) * 1.2;
      m.userData.wid = 0.6 + (i % 3) * 0.5;
      this.cracks.push(m);
      this.group.add(m);
    }

    // Minions in an arc in front of the caster, staggered rise times.
    const n = MAX_MINIONS;
    for (let i = 0; i < n; i++) {
      const enemy = new Enemy({ color: 0x5b6b5a, horns: false, eyeColor: new THREE.Color(0.3, 2, 1.2), facing: Math.PI });
      const a = ((i + 0.5) / n - 0.5) * 2.4 + Math.sin(i * 2.7) * 0.08; // radians across the arc
      const r = 5 + (i % 3) * 0.9;
      const base = new THREE.Vector3(Math.sin(a) * r, 0, ARC_CENTER.z - Math.cos(a) * 2.6 + (i % 2) * 0.6);
      const glow = new GlowSphere(0x3affb4, { rim: false });
      const ring = createRing(0x3affb4, 0.35, 1, 32);
      this.group.add(enemy.group, glow.mesh, ring.mesh);
      this.minions.push({
        enemy, glow, ring, base,
        riseT: 0, lean: 0.25 + (i % 3) * 0.08, phase: i * 1.3, burst: false,
      });
    }

    this.dirt = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 4.5, speedJitter: 0.6, spread: 65, gravity: 11, drag: 0.5,
      sizeStart: 0.28, sizeEnd: 0.1, colorStart: '#3a2c22', colorEnd: '#1c1612',
      opacityStart: 0.9, opacityEnd: 0, additive: false,
      colorMid: '#2a2018', sizeJitter: 0.4, erosion: 0.4, spin: 0.4,
    });
    this.mist = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, speed: 0.7, speedJitter: 0.6, spread: 100, gravity: -0.05, drag: 0.8,
      // Dark, eroded mist: a pale non-additive mist piled up into a white wall that hid the minions.
      sizeStart: 1.2, sizeEnd: 2.6, colorStart: '#5a6c70', colorEnd: '#2c383c',
      opacityStart: 0.2, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.6, spin: 0.3, colorMid: '#43545a', groundFade: 0.3,
    });
    this.emitters.push(this.dirt, this.mist);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.crackMat.color.set(c);
    this.chestGlow.color.set(c);
    for (const m of this.minions) { m.glow.color.set(c); m.ring.material.color.set(c); }
  }

  /** Ground position where minion i rises. */
  minionBase(i: number) {
    return this.minions[i].base;
  }

  get duration() {
    return DURATION;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.mistAcc = 0;
    this.shake = 0;
    this.caster.reset();
    for (const m of this.minions) m.burst = false;
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  private get count() {
    return THREE.MathUtils.clamp(Math.round(this.settings.minions), 1, MAX_MINIONS);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    const t = this.time;
    const s = this.settings;
    // Dirt bursts as each minion breaks the surface.
    for (let i = 0; i < this.count; i++) {
      const m = this.minions[i];
      const riseT = riseTime(s.castTime, i, this.count);
      m.riseT = riseT;
      if (!m.burst && t >= riseT + 0.05) {
        m.burst = true;
        this.dirt.burst(55, new THREE.Vector3(m.base.x, 0.1, m.base.z));
      }
    }
    // Cold mist rolling across the ground over the arc.
    const mistOn = smoothstep((t - s.castTime * 0.5) / 0.8) * (1 - smoothstep((t - (DURATION - 1.2)) / 1));
    this.mistAcc += 110 * mistOn * dt;
    while (this.mistAcc >= 1) {
      this.mistAcc -= 1;
      this.mist.burst(1, new THREE.Vector3((Math.random() - 0.5) * 14, 0.25 + Math.random() * 0.3, 3 + Math.random() * 9));
    }
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const fadeOut = smoothstep((t - (DURATION - FADE)) / FADE);
    const castP = smoothstep(t / s.castTime);

    // Caster: channels with a gathering green-blue glow at the chest and a cold pulse on the armour.
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    this.caster.material.emissive.setRGB(0.02, 0.18 * castP * (0.6 + 0.4 * pulse) * (1 - fadeOut), 0.14 * castP * (1 - fadeOut));
    this.chestGlow.mesh.position.set(0, 1.5, 13.5);
    this.chestGlow.mesh.scale.setScalar(0.5 + 0.35 * pulse);
    this.chestGlow.opacity = 0.45 * castP * (1 - fadeOut);

    // Frost runes spinning under the caster.
    const runeOp = 0.55 * castP * (1 - fadeOut);
    this.runeA.mesh.position.set(0, 0.05, 14); this.runeA.mesh.scale.setScalar(2.8 + 0.2 * Math.sin(t * 3));
    this.runeA.mesh.rotation.z = t * 1.4;
    this.runeB.mesh.position.set(0, 0.06, 14); this.runeB.mesh.scale.setScalar(2.2);
    this.runeB.mesh.rotation.z = -t * 2.2;
    this.runeC.mesh.position.set(0, 0.07, 14); this.runeC.mesh.scale.setScalar(3.2 * (0.8 + 0.2 * castP));
    this.runeA.material.opacity = runeOp;
    this.runeB.material.opacity = runeOp * 0.9;
    this.runeC.material.opacity = runeOp * 0.7;

    // Cracks creep outward from the caster.
    const crackP = smoothstep((t - 0.15) / (s.castTime + 0.9));
    this.crackMat.opacity = 0.5 * crackP * (1 - fadeOut);
    for (const c of this.cracks) {
      const a = c.userData.angle as number;
      c.rotation.set(-Math.PI / 2, a, 0);
      c.scale.set(c.userData.wid as number, (c.userData.len as number) * crackP, 1);
    }

    // Minions.
    const walk = s.shambleDistance;
    for (let i = 0; i < MAX_MINIONS; i++) {
      const m = this.minions[i];
      const active = i < this.count;
      const riseT = riseTime(s.castTime, i, this.count);
      const u = active ? (t - riseT) / RISE : -1;
      const g = m.enemy.group;
      if (u < 0) {
        g.visible = false;
        m.glow.opacity = 0;
        m.ring.material.opacity = 0;
        // Warning glow under the spot a moment before the minion breaks through.
        if (active && u > -0.8) {
          const w = smoothstep((u + 0.8) / 0.8);
          m.ring.mesh.position.set(m.base.x, 0.06, m.base.z);
          m.ring.mesh.scale.setScalar(0.9);
          m.ring.material.opacity = 0.4 * w * (1 - fadeOut);
        }
        continue;
      }
      const e = smoothstep(Math.min(u, 1));
      const walked = Math.max(0, t - riseT - RISE);
      const dist = Math.min(walked * 1.0, walk);
      const toEnemy = new THREE.Vector3().subVectors(ENEMY_POS, m.base).setY(0).normalize();
      const bob = u > 1 ? Math.sin(walked * 5 + m.phase) : 0;
      const sink = fadeOut * 2.2;
      g.visible = true;
      g.scale.setScalar(SCALE);
      g.position.set(
        m.base.x + toEnemy.x * dist + Math.sin(m.phase + t * 2) * 0.03,
        -2 + 2 * e - sink + 0.05 * Math.abs(bob),
        m.base.z + toEnemy.z * dist,
      );
      // Hunched, facing the enemy; lurches while walking, claws upright-ish while rising.
      g.rotation.set(m.lean + 0.12 * (1 - e) + 0.05 * bob, Math.PI - toEnemy.x * 0.3, 0.1 * bob + 0.15 * Math.sin(u * 14) * (1 - e));
      const lit = Math.exp(-Math.max(0, u - 0.2) * 2.5);
      // Keeps a faint floor of glow so the minions read against the dark mist.
      m.enemy.material.emissive.setRGB(0.02, 0.14 + 0.4 * lit, 0.1 + 0.3 * lit);
      // Green glow at the spot.
      m.glow.mesh.position.set(m.base.x, 0.4, m.base.z);
      m.glow.mesh.scale.setScalar(1.3 + 0.6 * e);
      m.glow.opacity = 0.4 * Math.exp(-Math.max(0, u) * 1.1) * (1 - fadeOut);
      m.ring.mesh.position.set(m.base.x, 0.06, m.base.z);
      m.ring.mesh.scale.setScalar(0.9 + 1.2 * e);
      m.ring.material.opacity = 0.4 * Math.exp(-Math.max(0, u) * 1.3) * (1 - fadeOut);
    }
    this.shake = 0;
  }
}

export const armyOfTheDeadModule: EffectModule = {
  label: 'army of the dead',
  category: 'iconic',
  create: () => new ArmyOfTheDead(),
  telegraphs(effect) {
    const a = effect as ArmyOfTheDead;
    const s = a.settings;
    const n = THREE.MathUtils.clamp(Math.round(s.minions), 1, MAX_MINIONS);
    const zones: TelegraphSpec[] = [];
    // One small circle per grave, from the warning glow until the dirt burst has settled.
    for (let i = 0; i < n; i++) {
      const base = a.minionBase(i);
      const rise = riseTime(s.castTime, i, n);
      zones.push({
        shape: { kind: 'circle', x: base.x, z: base.z, radius: 1.3 },
        start: Math.max(0, rise - 0.8), impact: rise + 0.05, until: rise + 0.5,
      });
    }
    return zones;
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls) {
    frameArena(camera, controls, new THREE.Vector3(0, 1.5, 7), 11);
  },
  buildGui(f, effect) {
    const a = effect as ArmyOfTheDead;
    const s = a.settings;
    f.add(s, 'loop');
    f.add(s, 'minions', 8, 12, 1).name('minions');
    f.add(s, 'castTime', 0.3, 2.5, 0.05).name('cast time');
    f.add(s, 'shambleDistance', 0, 8, 0.1).name('shamble distance');
    f.addColor(s, 'color').onChange(() => a.applyStyle());
  },
};
