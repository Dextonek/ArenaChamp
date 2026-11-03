import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { Flask, FigureShell, Fumes, GlassShards, TransmuteCircle } from '../../effects/parts/alchemy';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Elixir of Unmaking (alchemy kit, R: a state ultimate, no damage). She drinks a dark flask; it shatters at her mouth,
 * then for 5 s a pulsing acid-green rim hugs her body, a small glass-ink circle turns under her feet and fumes curl up.
 * The rule itself (her Q has almost no cooldown and doubles its toxin) lives in the trait (`src/traits/alchemy.ts`, in
 * round time); this only draws it, so the glow lasts as long as the state. Fades out over the last 0.6 s.
 */
export interface ElixirSettings {
  /** Seconds the glow lasts (the trait's state is 5 s). */
  seconds: number;
  loop: boolean;
}

export const defaultElixir = (): ElixirSettings => ({ seconds: 5, loop: false });

const DRINK_T = 0.4;
// Only tells the duel AI to drink when the enemy is within Q's range (it reaches radius - 0.6).
const RADIUS = 10.6;

export class ElixirOfUnmaking implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ElixirSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { drink: false };
  private fumeTimer = 0;

  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3(0, 1.3, 0);
  private head = new THREE.Vector3(0, 2.3, 0);

  private drinkFlask = new Flask();
  private shards = new GlassShards({ max: 24 });
  private fumes = new Fumes(12);
  private shell = new FigureShell('rim');
  private circle = new TransmuteCircle();

  private v1 = new THREE.Vector3();

  constructor(settings: ElixirSettings = defaultElixir()) {
    this.settings = settings;
    this.circle.hole = 0.3;
    this.group.add(this.circle.mesh, this.shell.mesh, this.fumes.mesh, this.shards.mesh, this.drinkFlask.mesh);
    this.reset();
  }

  get duration() {
    return DRINK_T + this.settings.seconds + 0.2;
  }

  get impactTime() {
    return DRINK_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.5).addScaledVector(this.side, 0.35).setY(1.3);
    this.head.copy(ctx.from).addScaledVector(this.fwd, 0.3).addScaledVector(this.side, 0.2).setY(2.3);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fumeTimer = 0;
    this.flags.drink = false;
    this.drinkFlask.reset();
    this.shards.reset();
    this.fumes.reset();
    this.shell.reset();
    this.circle.reset();
    this.circle.hole = 0.3;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.shards.update(dt);
    this.fumes.update(dt);
    this.time += dt;
    const end = DRINK_T + this.settings.seconds;
    if (this.time >= end + 0.2) {
      this.reset();
      this.playing = false;
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, ctx = this.ctx;
    const fade = 1 - smoothstep((t - (end - 0.6)) / 0.8);

    // The flask is plucked, tilted up to her head and shatters in her hand.
    if (t < DRINK_T) {
      const df = this.drinkFlask;
      df.mesh.visible = true;
      df.scale = 0.55 * smoothstep(t / 0.12);
      df.slosh(t, 1.4);
      df.mesh.position.lerpVectors(this.hand, this.head, smoothstep((t - 0.12) / 0.16));
      df.mesh.rotation.set(0, 0, -2.3 * smoothstep((t - 0.2) / 0.16));
    }
    if (!f.drink && t >= DRINK_T) {
      f.drink = true;
      this.drinkFlask.mesh.visible = false;
      this.shards.burst(this.head, 14, 3.6, { size: 0.16, life: 0.5 });
      this.shake = 0.1;
    }

    // The state: a pulsing rim, a turning circle under her feet and fumes, for as long as it lasts.
    if (ctx && t >= 0.2) {
      const on = smoothstep((t - 0.2) / 0.3) * fade;
      this.shell.mesh.visible = on > 0.01;
      this.shell.follow(ctx.caster.group, 1.06);
      this.shell.opacity = on * (0.55 + 0.35 * Math.sin(t * 9));
      const p = ctx.caster.group.position;
      this.circle.set(this.v1.set(p.x, 0, p.z), 1.7);
      this.circle.mesh.rotation.y = t * 0.8;
      this.circle.reveal = smoothstep((t - DRINK_T) / 0.3);
      this.circle.opacity = fade;
      this.circle.lit = 6;
    }
    if (t >= DRINK_T && t < end) {
      this.fumeTimer += dt;
      while (this.fumeTimer >= 0.25) {
        this.fumeTimer -= 0.25;
        const a = Math.random() * Math.PI * 2, p = ctx?.caster.group.position ?? this.from;
        this.fumes.puff(this.v1.set(p.x + Math.cos(a) * 0.8, 0.2, p.z + Math.sin(a) * 0.8), 0.36, undefined, 1.3);
      }
    }
    this.shake *= Math.exp(-dt * 10);
  }
}

export const elixirOfUnmakingModule: EffectModule = {
  label: 'elixir of unmaking',
  category: 'hero: alchemy',
  // No damage, so no telegraph; the radius only makes the duel AI drink when the enemy is within Q's range.
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new ElixirOfUnmaking(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ElixirOfUnmaking;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ElixirOfUnmaking).settings;
    f.add(s, 'loop');
    f.add(s, 'seconds', 1, 8, 0.5);
  },
};
