import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import { ALCHEMY, FigureShell, Flask, Fumes, GlassShards } from '../../effects/parts/alchemy';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Mutagen (alchemy kit, E: BUFF, no damage). She drinks a flask (it tilts up at her head and shatters in her hand),
 * heals, and her body takes a pulsing green rim while fumes curl up around her. The rim and fumes fade out. No flasks
 * orbit her any more and nothing hits an enemy. See pipeline/designs/kit-alchemy.md.
 */
export interface MutagenSettings {
  /** HP healed at the drink. */
  heal: number;
  loop: boolean;
}

export const defaultMutagen = (): MutagenSettings => ({ heal: 45, loop: false });

// Timeline (seconds).
const DRINK_T = 0.4;
const END_T = 1.7;
const FADE_T = 2.1;
const DURATION = 2.3;
const RADIUS = 4;

export class Mutagen implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MutagenSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3(0, 1.3, 13.5);
  private head = new THREE.Vector3(0, 2.3, 13.8);

  private flags = { drink: false };
  private fumeTimer = 0;

  // Parts.
  private drinkFlask = new Flask();
  private shards = new GlassShards({ max: 24 });
  private fumes = new Fumes(10);
  private shell = new FigureShell('rim');

  // Scratch.
  private v1 = new THREE.Vector3();

  constructor(settings: MutagenSettings = defaultMutagen()) {
    this.settings = settings;
    this.screen.tint.set(ALCHEMY.dark);
    this.group.add(this.shell.mesh, this.fumes.mesh, this.shards.mesh, this.drinkFlask.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return DRINK_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.5).addScaledVector(this.side, 0.35).setY(1.3);
    this.head.copy(ctx.from).addScaledVector(this.fwd, 0.3).addScaledVector(this.side, 0.2).setY(2.3);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from);
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
    clearScreenFx(this.screen);
    this.drinkFlask.reset();
    this.shards.reset();
    this.fumes.reset();
    this.shell.reset();
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
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // The flask shatters in her hand as she drinks: she heals.
    if (!f.drink && t >= DRINK_T) {
      f.drink = true;
      this.drinkFlask.mesh.visible = false;
      this.shards.burst(this.head, 12, 3.4, { size: 0.16, life: 0.5 });
      ctx?.healSelf?.(this.settings.heal);
    }
    // Fumes curl up around her while the buff shows.
    if (t >= DRINK_T && t < END_T) {
      this.fumeTimer += dt;
      while (this.fumeTimer >= 0.2) {
        this.fumeTimer -= 0.2;
        const a = Math.random() * Math.PI * 2;
        this.fumes.puff(this.v1.set(this.from.x + Math.cos(a) * 0.85, 0.2, this.from.z + Math.sin(a) * 0.85), 0.38, undefined, 1.3);
      }
    }

    this.layout();
  }

  private layout() {
    const t = this.time;
    const ctx = this.ctx;

    // --- 0..0.4 Drink: the flask is plucked, lifted to her head, tilted up, and shatters in her hand at 0.4. ---
    const df = this.drinkFlask;
    if (t < DRINK_T) {
      df.mesh.visible = true;
      df.scale = 0.55 * smoothstep(t / 0.12);
      df.slosh(t, 1.4);
      const lift = smoothstep((t - 0.12) / 0.16);
      df.mesh.position.lerpVectors(this.hand, this.head, lift);
      df.mesh.rotation.set(0, 0, -2.3 * smoothstep((t - 0.2) / 0.16));
    }

    // --- Rim: a pulsing green tint around her body. ---
    const sh = this.shell;
    if (ctx) {
      sh.mesh.visible = t >= 0.2 && t < FADE_T;
      sh.follow(ctx.caster.group, 1.06);
      const on = smoothstep((t - 0.2) / 0.25) * (1 - smoothstep((t - END_T) / (FADE_T - END_T)));
      sh.opacity = on * (0.6 + 0.4 * Math.sin(t * 8));
    }
  }
}

export const mutagenModule: EffectModule = {
  label: 'mutagen',
  category: 'hero: alchemy',
  // No damage, so no telegraph; the radius only tells the duel AI to drink when an enemy is within 3.4 m.
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new Mutagen(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Mutagen;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Mutagen).settings;
    f.add(s, 'loop');
    f.add(s, 'heal', 0, 120, 1);
  },
};
