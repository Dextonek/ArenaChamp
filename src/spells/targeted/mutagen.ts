import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  ALCHEMY, ALCHEMY_CSS, Bubbles, Droplets, FigureShell, Flask, Fumes, GlassShards,
} from '../../effects/parts/alchemy';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Mutagen (alchemy kit, E: self buff). She drinks a flask (it tilts up at her head and shatters in her hand), her body
 * takes a pulsing green rim, and four flasks orbit her while fumes curl up around her. Twice the flasks flare and spit
 * three acid droplets each at every enemy in range; the droplets land in tiny splashes and burn. Then the flasks shatter
 * outward and the fumes fade. The loopable section is 0.4..2.6. See pipeline/designs/kit-alchemy.md.
 */
export interface MutagenSettings {
  damage: number;
  loop: boolean;
}

export const defaultMutagen = (): MutagenSettings => ({ damage: 12, loop: false });

// Timeline (seconds).
const DRINK_T = 0.4;
const FLARES = [1.1, 2.1];
const SPIT_FLIGHT = 0.35;
const END_T = 2.6;
const FADE_T = 3.0;
const DURATION = 3.2;
const RADIUS = 4;
const ORBITS = 4;
const ORBIT_R = 1.8;

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
  private inside: { enemy: CastContext['targets'][number]; pos: THREE.Vector3 }[] = [];

  private flags = { drink: false, flare: [false, false], hit: [false, false], end: false };
  private fumeTimer = 0;
  private flareAt = [-1, -1];

  // Parts.
  private drinkFlask = new Flask();
  private orbit: Flask[] = [];
  private shards = new GlassShards({ max: 80 });
  private fumes = new Fumes(10);
  private droplets = new Droplets(24);
  private splashes = new Bubbles(16);
  private shell = new FigureShell('rim');
  private flare = new StarBurst({ points: 6, inner: 0.3, color: ALCHEMY.accent, core: ALCHEMY.core, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: MutagenSettings = defaultMutagen()) {
    this.settings = settings;
    this.screen.tint.set(ALCHEMY.dark);
    for (let i = 0; i < ORBITS; i++) this.orbit.push(new Flask());
    this.droplets.onLand = (pos) => this.splashes.splash(pos, 0.14);
    this.group.add(
      this.shell.mesh, this.fumes.mesh, this.shards.mesh, this.droplets.mesh, this.splashes.mesh, this.drinkFlask.mesh,
      ...this.orbit.map((o) => o.mesh), this.flare.mesh,
    );
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
    this.inside.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (p && Math.hypot(p.x - ctx.from.x, p.z - ctx.from.z) <= RADIUS) this.inside.push({ enemy: e, pos: p.clone() });
    });
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
    this.flareAt = [-1, -1];
    this.flags.drink = false;
    this.flags.end = false;
    this.flags.flare = [false, false];
    this.flags.hit = [false, false];
    clearScreenFx(this.screen);
    this.drinkFlask.reset();
    for (const o of this.orbit) o.reset();
    this.shards.reset();
    this.fumes.reset();
    this.droplets.reset();
    this.splashes.reset();
    this.shell.reset();
    this.flare.set(this.from, 0, 0);
  }

  /** Orbiting flask i at time t. */
  private orbitPos(i: number, t: number, out: THREE.Vector3) {
    const a = (t - 0.3) * 1.5 + (i / ORBITS) * Math.PI * 2;
    return out.set(this.from.x + Math.cos(a) * ORBIT_R, 1.35 + Math.sin(a * 2 + i) * 0.12, this.from.z + Math.sin(a) * ORBIT_R);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.shards.update(dt);
    this.fumes.update(dt);
    this.droplets.update(dt);
    this.splashes.update(dt);
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

    // Events.
    if (!f.drink && t >= DRINK_T) {
      f.drink = true;
      this.drinkFlask.mesh.visible = false;
      this.shards.burst(this.head, 12, 3.4, { size: 0.16, life: 0.5 });
    }
    for (let k = 0; k < FLARES.length; k++) {
      if (!f.flare[k] && t >= FLARES[k]) {
        f.flare[k] = true;
        this.flareAt[k] = FLARES[k];
        this.inside.forEach((v, idx) => {
          const src = this.orbitPos(idx % ORBITS, t, this.v1);
          for (let d = 0; d < 3; d++) {
            this.v2.set(v.pos.x + (Math.random() - 0.5) * 0.7, 0.9 + Math.random() * 0.5, v.pos.z + (Math.random() - 0.5) * 0.7);
            this.droplets.fire(src, this.v2, SPIT_FLIGHT + d * 0.03, 0.1, d * 0.05);
          }
        });
      }
      if (!f.hit[k] && t >= FLARES[k] + 0.45) {
        f.hit[k] = true;
        if (ctx) for (const v of this.inside) ctx.hit(v.enemy, { damage: this.settings.damage, knock: 0, from: this.from, color: ALCHEMY_CSS.body });
      }
    }
    if (!f.end && t >= END_T) {
      f.end = true;
      for (let i = 0; i < ORBITS; i++) {
        this.orbitPos(i, END_T, this.v1);
        this.shards.burst(this.v1, 9, 5, { size: 0.2, life: 0.55 });
        this.orbit[i].mesh.visible = false;
      }
    }
    // Fumes curl up around her while the buff runs.
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

    // --- 0.3..2.6 Four orbiting flasks; they flare on each spit. ---
    for (let i = 0; i < ORBITS; i++) {
      const o = this.orbit[i];
      if (t >= END_T) continue;
      o.mesh.visible = t >= 0.3;
      let pulse = 0;
      for (const fa of this.flareAt) if (fa >= 0) pulse = Math.max(pulse, Math.exp(-(t - fa) * 12));
      o.scale = 0.63 * smoothstep((t - 0.3) / 0.2) * (1 + 0.45 * pulse);
      this.orbitPos(i, t, o.mesh.position);
      o.mesh.rotation.set(0, t * 3 + i, Math.sin(t * 2 + i) * 0.2);
      o.slosh(t + i, 1 + pulse * 2);
    }

    // --- A small magenta spark on the spitting flask for two frames. ---
    let sp = 0;
    for (const fa of this.flareAt) if (fa >= 0) sp = Math.max(sp, StarBurst.pop(t - fa, 0, 0.02).scale);
    this.flare.set(this.orbitPos(0, t, this.v1), 0.7 * sp, sp > 0 ? 1 : 0, 0.3);
  }
}

export const mutagenModule: EffectModule = {
  label: 'mutagen',
  category: 'hero: alchemy',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new Mutagen(),
  telegraphs(effect) {
    const e = effect as Mutagen;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: 0, impact: FLARES[0] }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Mutagen;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Mutagen).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
  },
};
