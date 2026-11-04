import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { CLOCKWORK, CLOCKWORK_CSS, HomingDrone as DroneMesh, Sparks, SteamPuffs } from '../../effects/parts/clockwork';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { TAG_SECONDS } from '../../traits/clockwork';

/**
 * Homing Drone (clockwork kit, Q: a targeted hit). A click on an enemy within 8 m (the engine checks sight at the cast). A
 * brass drone with two spinning rotor gears pops out of her backpack and flies at the enemy in a shallow arc, homing on
 * their LIVE position every frame, so there is nothing to dodge once it is away; the way to answer it is to stay past 8 m
 * or to break sight before the cast. It lands 0.45 s after the cast (`LAND_T`) for 45 damage, `projectile: true`: the
 * hit always passes the duel's zone filter and is judged on the live position. No telegraph: the flying drone is the
 * warning, and a telegraph's impact would root her for 0.45 s on her rhythm tool (the same choice as Moon's Pull).
 * The tag is the trait's: `dealt` on a slot 0 hit tags the enemy for 3 s (a pip over them), and her turrets then deal 30%
 * more to them. At the landing the drone bursts into cyan sparks and a ring of steam, and a cogged ring spins on the
 * enemy's feet for the 3 s the tag lasts (the tag, drawn on the ground as well as on the pip). Clean about 0.9 s after the
 * landing, then only the small ring remains until the tag ends (about 3.5 s in all).
 * Network duels: the effect plays on both screens; the hit is decided where the enemy is (the victim's screen) by `ctx.hit`.
 */
export interface HomingDroneSettings {
  damage: number;
  loop: boolean;
}

export const defaultHomingDrone = (): HomingDroneSettings => ({ damage: 45, loop: false });

// Timeline (seconds).
const LAUNCH_T = 0.08; // the drone leaves her backpack
const LAND_T = 0.45; // and lands, 0.45 s after the cast
const RING_END = LAND_T + TAG_SECONDS; // the tag ring on the ground lasts as long as the tag
const DURATION = RING_END + 0.3;
const ARC = 0.9; // how high the flight bulges (m)

export class HomingDroneSpell implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HomingDroneSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private landed = false;
  private trailT = 0;
  private target: THREE.Object3D | null = null;
  private foe = new THREE.Vector3();
  private pack = new THREE.Vector3(0, 1.4, 0);
  private packOff = new THREE.Vector3();
  private last = new THREE.Vector3();

  private drone = new DroneMesh();
  private sparks = new Sparks(40);
  private steam = new SteamPuffs(24);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: CLOCKWORK.accent, core: CLOCKWORK.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private tagRing = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CLOCKWORK.hot, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private tagCogs = new THREE.Group();

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: HomingDroneSettings = defaultHomingDrone()) {
    this.settings = settings;
    this.tagRing.renderOrder = 3;
    this.tagRing.visible = false;
    // Six copper teeth on the tag ring so it reads as a gear, not a plain circle.
    const tooth = new THREE.BoxGeometry(0.2, 0.06, 0.3);
    const mat = new THREE.MeshBasicMaterial({ color: CLOCKWORK.body });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(tooth, mat);
      const a = (i / 6) * Math.PI * 2;
      m.position.set(Math.cos(a), 0.04, Math.sin(a));
      m.rotation.y = -a;
      this.tagCogs.add(m);
    }
    this.tagCogs.visible = false;
    this.group.add(this.drone.mesh, this.sparks.mesh, this.steam.mesh, this.pop.mesh, this.shock.mesh, this.tagRing, this.tagCogs);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return LAND_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0]?.group ?? null;
    this.foe.copy(ctx.targets[0] ? ctx.targetPos[0] : ctx.point).setY(0);
    // Her backpack: behind her shoulders.
    this.v1.set(this.foe.x - ctx.from.x, 0, this.foe.z - ctx.from.z);
    if (this.v1.lengthSq() < 1e-4) this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.v1.normalize();
    this.packOff.set(-this.v1.x * 0.3, 0, -this.v1.z * 0.3);
    this.pack.set(ctx.from.x + this.packOff.x, 1.4, ctx.from.z + this.packOff.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landed = false;
    this.trailT = 0;
    this.drone.reset();
    this.sparks.reset();
    this.steam.reset();
    this.pop.set(this.pack, 0, 0);
    this.shock.set(this.pack, 0, 0);
    this.tagRing.visible = false;
    this.tagCogs.visible = false;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.sparks.update(dt);
    this.steam.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    // The enemy's live position (the drone homes on it every frame).
    if (this.target) this.foe.set(this.target.position.x, 0, this.target.position.z);
    // Her backpack goes with her while the drone is still on it.
    if (ctx && t < LAUNCH_T) this.pack.set(ctx.caster.group.position.x + this.packOff.x, 1.4, ctx.caster.group.position.z + this.packOff.z);

    // --- Flight: out of the backpack, a shallow arc, homing. ---
    if (t < LAND_T) {
      const p = smoothstep((t - LAUNCH_T) / (LAND_T - LAUNCH_T));
      if (t < LAUNCH_T) {
        // A short hop up out of the pack, the rotors spinning up.
        this.v1.copy(this.pack).y += 0.4 * (t / LAUNCH_T);
        this.drone.place(this.v1, this.up, t);
      } else {
        const x = this.pack.x + (this.foe.x - this.pack.x) * p;
        const z = this.pack.z + (this.foe.z - this.pack.z) * p;
        const y = this.pack.y + (1.2 - this.pack.y) * p + Math.sin(Math.PI * p) * ARC;
        this.v1.set(x, y, z);
        this.v2.subVectors(this.v1, this.last);
        if (this.v2.lengthSq() < 1e-8) this.v2.set(this.foe.x - this.pack.x, 0, this.foe.z - this.pack.z);
        this.drone.place(this.v1, this.v2, t);
        // A thread of cyan sparks and a puff of steam behind it.
        this.trailT += dt;
        if (this.trailT >= 0.05) {
          this.trailT = 0;
          this.sparks.burst(this.v1, 2);
          this.steam.puff(this.v1, this.up, 1);
        }
      }
      this.last.copy(this.v1);
    }

    // --- The landing: the hit, a burst, the drone folds into sparks. ---
    if (!this.landed && t >= LAND_T) {
      this.landed = true;
      this.drone.hide();
      this.shake = 0.2;
      this.v1.set(this.foe.x, 1.2, this.foe.z);
      this.sparks.burst(this.v1, 8);
      this.steam.puff(this.v1, this.up, 4);
      if (ctx && ctx.targets[0]) {
        // `projectile: true`: judged on the live position, so it cannot be dodged once the drone is away.
        ctx.hit(ctx.targets[0], { damage: this.settings.damage, knock: 0, from: this.pack.clone(), color: CLOCKWORK_CSS.body, projectile: true });
      }
    }
    this.shake *= Math.exp(-dt * 12);

    // --- After the landing: the star, the ring on the ground, the tag ring that follows the enemy for the tag's 3 s. ---
    if (this.landed) {
      const a = t - LAND_T;
      const sp = StarBurst.pop(a, 0.02, 0.05);
      this.pop.set(this.v1.set(this.foe.x, 1.2, this.foe.z), 1.1 * sp.scale, sp.opacity, 0.3);
      const g = smoothstep(a / 0.35);
      this.shock.set(this.v2.set(this.foe.x, 0, this.foe.z), 0.4 + 1.8 * g, 0.025 * (1 - g) * (1 - g));
      const life = 1 - smoothstep((t - (RING_END - 0.4)) / 0.4);
      const grow = smoothstep(a / 0.2);
      this.tagRing.visible = this.tagCogs.visible = life > 0.01;
      this.tagRing.position.set(this.foe.x, 0.06, this.foe.z);
      this.tagRing.scale.setScalar(1.15 * grow);
      (this.tagRing.material as THREE.MeshBasicMaterial).opacity = 0.7 * life;
      this.tagCogs.position.set(this.foe.x, 0.06, this.foe.z);
      this.tagCogs.scale.setScalar(Math.max(1e-3, 1.15 * grow));
      this.tagCogs.rotation.y = a * 1.6;
    }
  }
}

export const homingDroneModule: EffectModule = {
  label: 'homing drone',
  category: 'hero: clockwork',
  // Click an enemy: the drone always hits (`projectile`), so there is no zone to telegraph.
  targeting: { mode: 'enemy' },
  create: () => new HomingDroneSpell(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as HomingDroneSpell;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as HomingDroneSpell).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 120, 1);
  },
};
