import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ALCHEMY_CSS, Flask, Fumes, GlassShards, TransmuteCircle } from '../../effects/parts/alchemy';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Volatile Leap (alchemy kit, E: a blast-dash). She drops a flask at her own feet and it bursts: a small glass-ink circle
 * flashes on the ground, shards and fumes fly, and every enemy within 3 m takes a small hit and is knocked away. The
 * blast throws her 5 m straight back (away from the aim, `ctx.moveCaster`, 0.25 s), so it is an escape. The circle is
 * telegraphed on the spot she left. Built from `sentFrom` so both screens of a network duel agree on the blast centre.
 * Clean by 1.3 s.
 */
export interface VolatileLeapSettings {
  damage: number;
  knock: number;
  /** Metres she is thrown back. */
  distance: number;
  loop: boolean;
}

export const defaultVolatileLeap = (): VolatileLeapSettings => ({ damage: 40, knock: 9, distance: 5, loop: false });

// Timeline (seconds).
const BURST_T = 0.14;
const THROW_LEN = 0.25;
const FADE_T = 0.7;
const DURATION = 1.3;
const RADIUS = 3;

export class VolatileLeap implements Effect {
  readonly group = new THREE.Group();
  readonly settings: VolatileLeapSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The blast centre: where she stood when she cast. */
  readonly centre = new THREE.Vector3();
  private time = 0;
  private flags = { burst: false };

  private flask = new Flask();
  private circle = new TransmuteCircle();
  private shards = new GlassShards({ max: 28 });
  private fumes = new Fumes(10);

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: VolatileLeapSettings = defaultVolatileLeap()) {
    this.settings = settings;
    this.circle.hole = 0.3;
    this.group.add(this.circle.mesh, this.shards.mesh, this.fumes.mesh, this.flask.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return BURST_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.centre.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.circle.set(this.centre, RADIUS * 1.15);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // Thrown straight back, away from the aim (the enemy).
    const back = this.v1.set(-Math.sin(ctx.aim), 0, -Math.cos(ctx.aim)).multiplyScalar(this.settings.distance);
    ctx.moveCaster?.(this.v2.copy(ctx.from).setY(0).add(back), THROW_LEN);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.burst = false;
    this.flask.reset();
    this.circle.reset();
    this.circle.hole = 0.3;
    this.shards.reset();
    this.fumes.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.shards.update(dt);
    this.fumes.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.reset();
      this.playing = false;
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, c = this.centre;

    // The flask drops from her hand to her feet, then bursts.
    if (t < BURST_T) {
      this.flask.mesh.visible = true;
      this.flask.scale = 0.5;
      this.flask.lob(this.v1.copy(c).setY(1.1), this.v2.copy(c).setY(0.1), 0.1, t / BURST_T);
    }
    if (!f.burst && t >= BURST_T) {
      f.burst = true;
      this.flask.mesh.visible = false;
      this.shards.burst(this.v1.copy(c).setY(0.5), 22, 5.5, { size: 0.18, life: 0.6, up: 2 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.random();
        this.fumes.puff(this.v1.set(c.x + Math.cos(a) * 1.2, 0.2, c.z + Math.sin(a) * 1.2), 0.45, undefined, 1.4);
      }
      this.shake = 0.2;
      const ctx = this.ctx;
      if (ctx) {
        // Re-check at the burst: whoever stands in the blast now.
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - c.x, p.z - c.z) <= RADIUS) {
            ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: c, color: ALCHEMY_CSS.hot });
          }
        }
      }
    }

    // The circle flashes on at the burst and fades.
    this.circle.reveal = smoothstep((t - BURST_T) / 0.1);
    this.circle.opacity = 1 - smoothstep((t - FADE_T) / 0.45);
    this.circle.lit = t >= BURST_T ? 6 : 0;
    this.shake *= Math.exp(-dt * 10);
  }
}

export const volatileLeapModule: EffectModule = {
  label: 'volatile leap',
  category: 'hero: alchemy',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new VolatileLeap(),
  telegraphs(effect) {
    const e = effect as VolatileLeap;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: RADIUS }, start: 0, impact: BURST_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as VolatileLeap;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as VolatileLeap).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 80, 1);
    f.add(s, 'knock', 0, 14, 0.5);
    f.add(s, 'distance', 1, 8, 0.5);
  },
};
