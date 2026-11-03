import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { LightningTree, Sparks, STORM, STORM_CSS } from '../../effects/parts/storm';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { stormOrbs, type StormOrb } from '../../traits/storm';

/**
 * Ball Lightning (storm kit, W: slow orb, recast to blink). She flicks the staff and a crackling blue-white orb leaves
 * it at 8 m/s (`ctx.projectile`, radius 0.7, range 10): thin arcs jump around it and sparks trail behind. On an enemy
 * it pops (damage and a 2 s slow, yellow star, a fork to the ground). Missing, it stops at max range and hovers until
 * 3 s after the cast, then fades. The trait's recast (`replay: false`, 3 s window, `src/traits/storm.ts`) blinks her to the
 * orb; this effect publishes the orb's position every frame in `stormOrbs` (keyed by her figure; `hit` tells the
 * trait the orb ended on an enemy, so she lands 1.2 m short) and, when the recast marks it `taken`, draws a bolt from
 * where she left to the orb and removes the orb. With no projectile (a network duel) the orb is a deterministic
 * visual at 8 m/s from the cast point, which is also what the trait blinks to. Clean by 3.3 s.
 */
export interface BallLightningSettings {
  damage: number;
  slowSeconds: number;
  loop: boolean;
}

export const defaultBallLightning = (): BallLightningSettings => ({ damage: 45, slowSeconds: 2, loop: false });

// Timeline (seconds).
const FIRE_T = 0.2;
const HOVER_END = 3.0; // the recast window closes
const DURATION = 3.3;

export const ORB_RANGE = 10;
const SPEED = 8;
const RADIUS = 0.7;
const MUZZLE = 0.8;
const FLIGHT_END = FIRE_T + ORB_RANGE / SPEED;

export class BallLightning implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BallLightningSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The orb's path, muzzle to max range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;
  private flags = { fired: false, ended: false, popped: false, blinked: false, gone: false };
  private bolt: Projectile | null = null;
  private owner: object | null = null;
  private orb: StormOrb = { x: 0, z: 0, hit: false, taken: false, fromX: 0, fromZ: 0 };
  private dir = new THREE.Vector3(0, 0, -1);
  private muzzle = new THREE.Vector3();
  private arcTimer = 0;
  private starAge = -1;
  private starPos = new THREE.Vector3();

  private core = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 12),
    new THREE.MeshBasicMaterial({ color: STORM.core, transparent: true, depthWrite: false, toneMapped: false }),
  );
  private shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 16, 12),
    new THREE.MeshBasicMaterial({ color: STORM.body, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  private tree = new LightningTree(8);
  private sparks = new Sparks(100);
  private star = new StarBurst({ points: 10, inner: 0.3, color: STORM.accent, core: 0xfffbe0, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: BallLightningSettings = defaultBallLightning()) {
    this.settings = settings;
    this.core.visible = this.shell.visible = false;
    this.group.add(this.core, this.shell, this.tree.mesh, this.sparks.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FIRE_T;
  }

  /** Seconds until the orb has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return FLIGHT_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.muzzle.copy(ctx.from).addScaledVector(this.dir, MUZZLE).setY(0);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.dir.x * (MUZZLE + ORB_RANGE), z2: ctx.from.z + this.dir.z * (MUZZLE + ORB_RANGE),
      width: RADIUS * 2,
    };
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // Publish the orb at once: it is at the muzzle until it flies (a recast before that blinks a metre).
    this.owner = ctx.caster;
    this.orb = { x: this.muzzle.x, z: this.muzzle.z, hit: false, taken: false, fromX: 0, fromZ: 0 };
    stormOrbs.set(this.owner, this.orb);
  }

  private reset() {
    if (this.owner && stormOrbs.get(this.owner) === this.orb) stormOrbs.delete(this.owner);
    this.owner = null;
    this.time = 0;
    this.shake = 0;
    this.arcTimer = 0;
    this.bolt = null;
    this.starAge = -1;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.core.visible = this.shell.visible = false;
    this.tree.reset();
    this.sparks.reset();
    this.star.set(this.muzzle, 0, 0);
  }

  private pop(at: THREE.Vector3) {
    this.starPos.set(at.x, BOLT_HEIGHT, at.z);
    this.starAge = 0;
    this.sparks.burst(this.starPos, 14, 6);
    this.v1.set(at.x, 0.6, at.z);
    this.v2.set(at.x + (Math.random() - 0.5) * 3, 0.05, at.z + (Math.random() - 0.5) * 3);
    this.tree.strike(this.v1, this.v2, 1, 0.12, 0.4, { hold: 0.4, levels: 2 });
    this.shake = Math.max(this.shake, 0.18);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.tree.update(dt);
    this.sparks.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    if (!f.fired && t >= FIRE_T) {
      f.fired = true;
      this.core.visible = this.shell.visible = true;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.muzzle.clone(), dir: this.dir.clone(), speed: SPEED, range: ORB_RANGE, radius: RADIUS,
          hit: {
            damage: this.settings.damage, knock: 0, color: STORM_CSS.body,
            status: { kind: 'slow', seconds: this.settings.slowSeconds },
          },
        });
        this.bolt.onHit((_target, at) => {
          this.orb.hit = true;
          this.orb.x = at.x;
          this.orb.z = at.z;
          f.popped = true;
          this.pop(at);
        });
      }
    }

    // --- Where the orb is now: the bolt's position, else the deterministic path from the cast. ---
    if (f.fired && !f.ended && !f.gone) {
      const b = this.bolt;
      if (b) {
        if (b.alive) {
          this.orb.x = b.pos.x;
          this.orb.z = b.pos.z;
        } else {
          f.ended = true;
        }
      } else {
        const d = Math.min(ORB_RANGE, (t - FIRE_T) * SPEED);
        this.orb.x = this.muzzle.x + this.dir.x * d;
        this.orb.z = this.muzzle.z + this.dir.z * d;
        if (d >= ORB_RANGE) f.ended = true;
      }
    }

    // --- The recast blinked her to the orb: a bolt from where she left, a pop, the orb is spent. ---
    if (this.orb.taken && !f.blinked) {
      f.blinked = true;
      this.v1.set(this.orb.fromX, 1.2, this.orb.fromZ);
      this.v2.set(this.orb.x, 1.2, this.orb.z);
      this.tree.strike(this.v1, this.v2, 4, 0.22, 0.4, { hold: 0.4, levels: 3 });
      this.pop(this.v2);
      f.gone = true;
      this.core.visible = this.shell.visible = false;
    }

    // --- The orb itself: pulsing core and shell, arcs jumping off it, sparks behind. ---
    const live = f.fired && !f.gone && !(f.popped && this.orb.hit);
    this.core.visible = this.shell.visible = live;
    if (live) {
      const fade = t > HOVER_END - 0.3 ? Math.max(0, (HOVER_END - t) / 0.3) : 1;
      const pulse = 1 + 0.12 * Math.sin(t * 22);
      this.core.position.set(this.orb.x, BOLT_HEIGHT, this.orb.z);
      this.shell.position.copy(this.core.position);
      this.core.scale.setScalar(pulse * fade);
      this.shell.scale.setScalar((1.1 + 0.2 * Math.sin(t * 17 + 1)) * fade);
      this.arcTimer += dt;
      while (this.arcTimer >= 0.11 && fade > 0.2) {
        this.arcTimer -= 0.11;
        const a = Math.random() * Math.PI * 2, r = 0.9 + Math.random() * 0.5;
        this.v2.set(this.orb.x + Math.cos(a) * r, BOLT_HEIGHT + (Math.random() - 0.4) * 0.8, this.orb.z + Math.sin(a) * r);
        this.tree.strike(this.core.position, this.v2, 1, 0.07, 0.14, { hold: 0.5, levels: 1 });
        this.sparks.burst(this.core.position, 2, 2.5);
      }
      if (t < FLIGHT_END && !f.ended) this.sparks.burst(this.core.position, 1, 1.5);
    } else {
      this.arcTimer = 0;
    }

    if (this.starAge >= 0) {
      const sp = StarBurst.pop(this.starAge, 0.02, 0.04);
      this.star.set(this.starPos, 1.0 * sp.scale, sp.opacity, 0.2);
      this.starAge += dt;
      if (this.starAge > 0.2) { this.starAge = -1; this.star.set(this.starPos, 0, 0); }
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

export const ballLightningModule: EffectModule = {
  label: 'ball lightning',
  category: 'hero: storm',
  // Aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new BallLightning(),
  telegraphs(effect) {
    const e = effect as BallLightning;
    if (!e.ctx) return [];
    // A slow bolt: dodged by stepping off the line while it travels.
    return [{ shape: e.line, start: 0, impact: FIRE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BallLightning;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as BallLightning).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'slowSeconds', 0, 4, 0.1);
  },
};
