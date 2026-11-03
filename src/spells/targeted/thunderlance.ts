import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { LightningTree, Puddles, Sparks, STORM, STORM_CSS } from '../../effects/parts/storm';
import { BOLT_HEIGHT, type Projectile } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Thunderlance (storm kit, R: charged skillshot). Held to charge (the trait's hold on slot 3 sets the damage scale,
 * x0.6 to x1.5, through the cast's power). She raises the staff and sparks crackle along it for 0.35 s while a
 * 20 m line is telegraphed; then one thick lightning bolt runs the whole length at once and a piercing bolt
 * (`ctx.projectile`, 60 m/s, radius 0.6) hits every enemy on the line once, each with a yellow star, a ground fork and
 * ripples. The bolt flickers out by 0.9 s; clean by 1.2 s. See pipeline/designs/kit-shapes-v3.md.
 */
export interface ThunderlanceSettings {
  /** Damage at power 1 (the trait scales it x0.6..x1.5 by the charge). */
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultThunderlance = (): ThunderlanceSettings => ({ damage: 90, knock: 2, loop: false });

// Timeline (seconds).
const FIRE_T = 0.35;
const OUT_T = 0.95;
const DURATION = 1.2;

export const LANCE_RANGE = 20;
const SPEED = 60;
const RADIUS = 0.6;
const MUZZLE = 0.8;

export class Thunderlance implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ThunderlanceSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The bolt's line, caster to max range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;
  private flags = { fired: false, dried: false };
  private bolt: Projectile | null = null;
  private sparkTimer = 0;

  private dir = new THREE.Vector3(0, 0, -1);
  private tip = new THREE.Vector3(0, 1.95, 13);
  private base = new THREE.Vector3(0, 0.95, 14);

  // A 20 m bolt with forks needs more quads than the default; when full, only the dark outline layer would draw.
  private tree = new LightningTree(8, 9000);
  private sparks = new Sparks(120);
  private puddles = new Puddles();
  private stars = [0, 1, 2].map(() => new StarBurst({ points: 10, inner: 0.3, color: STORM.accent, core: 0xfffbe0, additive: false }));
  private starAge = [-1, -1, -1];
  private starPos = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private starCursor = 0;

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ThunderlanceSettings = defaultThunderlance()) {
    this.settings = settings;
    this.screen.impactColor.set(STORM.hot);
    this.screen.tint.set(STORM.dark);
    this.group.add(this.puddles.mesh, this.tree.mesh, this.sparks.mesh, ...this.stars.map((s) => s.mesh));
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return FIRE_T;
  }

  /** Seconds until the bolt has crossed its whole range (the telegraph's last moment). */
  get flightEnd() {
    return FIRE_T + LANCE_RANGE / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.tip.copy(ctx.from).addScaledVector(this.dir, 0.75).setY(1.95);
    this.base.copy(ctx.from).addScaledVector(this.dir, 0.45).setY(0.95);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.dir.x * LANCE_RANGE, z2: ctx.from.z + this.dir.z * LANCE_RANGE,
      width: RADIUS * 2,
    };
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.tip);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.sparkTimer = 0;
    this.bolt = null;
    this.flags.fired = this.flags.dried = false;
    this.starAge.fill(-1);
    clearScreenFx(this.screen);
    this.tree.reset();
    this.sparks.reset();
    this.puddles.reset();
    for (const s of this.stars) s.set(this.base, 0, 0);
  }

  /** A hit: a yellow star, three ground forks and ripples under the target. */
  private hitFx(at: THREE.Vector3) {
    const i = this.starCursor;
    this.starCursor = (this.starCursor + 1) % this.stars.length;
    this.starPos[i].set(at.x, BOLT_HEIGHT, at.z);
    this.starAge[i] = 0;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.random();
      const r = 1.0 + Math.random() * 0.9;
      this.v1.set(at.x, 0.6, at.z);
      this.v2.set(at.x + Math.cos(a) * r, 0.05, at.z + Math.sin(a) * r);
      this.tree.strike(this.v1, this.v2, 1, 0.1, 0.4 + 0.08 * k, { hold: 0.4, levels: 2 });
    }
    this.v1.set(at.x, 0, at.z);
    this.puddles.wet(this.v1, 1.5);
    this.puddles.ripple(this.v1, 1.8);
    this.sparks.burst(this.starPos[i], 12, 6);
    this.shake = Math.max(this.shake, 0.25);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.tree.update(dt);
    this.sparks.update(dt);
    this.puddles.update(dt);
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

    // Sparks crackle along the staff while it charges, thicker as the shot nears.
    if (t < FIRE_T + 0.1) {
      this.sparkTimer += dt;
      const rate = 0.06 - 0.035 * (t / FIRE_T);
      while (this.sparkTimer >= rate) {
        this.sparkTimer -= rate;
        this.sparks.along(this.base, this.tip, 3, 2.4);
      }
    }

    if (!f.fired && t >= FIRE_T) {
      f.fired = true;
      // One bolt along the whole line at once (or to the first pillar, via the projectile's own end), and the piercing hit bolt.
      this.v1.copy(ctx?.from ?? this.base).addScaledVector(this.dir, MUZZLE);
      this.v1.y = this.tip.y - 0.3;
      this.v2.copy(this.v1).addScaledVector(this.dir, LANCE_RANGE - MUZZLE);
      this.v2.y = BOLT_HEIGHT;
      this.tree.strike(this.tip, this.v2, 5, 0.3, OUT_T - FIRE_T, { hold: 0.4, levels: 3, maxSegments: 220, jag: 0.6 });
      this.sparks.burst(this.tip, 14, 7);
      this.shake = 0.3;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.v1.clone().setY(0), dir: this.dir.clone(), speed: SPEED, range: LANCE_RANGE - MUZZLE, radius: RADIUS, pierce: true,
          hit: { damage: this.settings.damage, knock: this.settings.knock, color: STORM_CSS.body },
        });
        this.bolt.onHit((_target, at) => this.hitFx(at));
      }
    }
    if (f.fired && !f.dried && t >= OUT_T - 0.4) {
      f.dried = true;
      this.puddles.dry(0.4);
    }

    // Stars pop and fade.
    for (let i = 0; i < this.stars.length; i++) {
      if (this.starAge[i] < 0) continue;
      const sp = StarBurst.pop(this.starAge[i], 0.02, 0.04);
      this.stars[i].set(this.starPos[i], 1.1 * sp.scale, sp.opacity, 0.2);
      this.starAge[i] += dt;
      if (this.starAge[i] > 0.2) { this.starAge[i] = -1; this.stars[i].set(this.starPos[i], 0, 0); }
    }

    this.screen.darken = 0.22 * smoothstep((t - 0.1) / 0.25) * (1 - smoothstep((t - 0.7) / 0.4));
    this.shake *= Math.exp(-dt * 12);
  }
}

export const thunderlanceModule: EffectModule = {
  label: 'thunderlance',
  category: 'hero: storm',
  // Aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new Thunderlance(),
  telegraphs(effect) {
    const e = effect as Thunderlance;
    if (!e.ctx) return [];
    // Armed at the cast, shown until the bolt has crossed; a bolt's hit is the dodge check, not the zone.
    return [{ shape: e.line, start: 0, impact: FIRE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Thunderlance;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as Thunderlance).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 250, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
