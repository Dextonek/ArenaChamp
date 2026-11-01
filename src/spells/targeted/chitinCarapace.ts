import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import { HIVE, Honeycomb, HoneySplash, Swarm } from '../../effects/parts/hive';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Chitin Carapace (hive kit, E: shell visuals only, no shield and no damage; the kit gives the armor buff). Black chitin plates with an amber rim snap together round Sirix in
 * a shell (radius 1.2) while the swarm circles it. At 1.0 s and 2.0 s the swarm
 * flares outward to radius 4 (a show only: it hits nothing); from 2.6 s the plates fall and the swarm settles.
 * Clean by 3.2 s. See pipeline/designs/kit-hive.md.
 */
export interface ChitinCarapaceSettings {
  loop: boolean;
}

export const defaultChitinCarapace = (): ChitinCarapaceSettings => ({ loop: false });

// Timeline (seconds).
const SNAP_END = 0.3; // the plates are on
const PULSE_1 = 1.0;
const PULSE_2 = 2.0;
const FALL_T = 2.6;
const DURATION = 3.2;
const RADIUS = 4;
const SHELL_R = 1.2;

export class ChitinCarapace implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ChitinCarapaceSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private from = new THREE.Vector3(0, 0, 14);
  private center = new THREE.Vector3(0, 0, 14);
  private pulseAt = [-9, -9];
  private flags = { shell: false, pulse1: false, pulse2: false, fall: false };

  // Parts.
  private shell = new Honeycomb(30, 'chitin');
  private swarm = new Swarm(40, 0.5);
  private honey = new HoneySplash(14);
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();

  constructor(settings: ChitinCarapaceSettings = defaultChitinCarapace()) {
    this.settings = settings;
    this.screen.impactColor.set(HIVE.hot);
    this.screen.tint.set(HIVE.dark);
    this.group.add(this.shell.mesh, this.swarm.mesh, this.honey.mesh, this.groundShock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return PULSE_1;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.center.copy(this.from);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).setY(1.3);
    this.groundShock.set(this.from, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.pulseAt[0] = this.pulseAt[1] = -9;
    const f = this.flags;
    f.shell = f.pulse1 = f.pulse2 = f.fall = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(HIVE.dark);
    this.shell.reset();
    this.swarm.reset();
    this.honey.reset();
    this.groundShock.set(this.from, 0, 0);
  }

  private pulse(index: number) {
    this.pulseAt[index] = index === 0 ? PULSE_1 : PULSE_2;
    this.shake = 0.15;
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      this.honey.burst(this.v1.set(this.center.x + Math.cos(a) * 2.2, 0.4, this.center.z + Math.sin(a) * 2.2), 3, 2.4, 0.14, 2.4);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.shell.update(dt);
    this.swarm.update(dt);
    this.honey.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;
    // The shell and the swarm follow him.
    const c = this.ctx?.caster.group.position;
    if (c) this.center.set(c.x, 0, c.z);

    if (!f.shell) {
      f.shell = true;
      this.shell.dome(this.center, SHELL_R, 2.0, SNAP_END, 26, 0.4);
      this.swarm.set(this.v1.copy(this.center).setY(1.1), 1.8, 40, (_i, out) => out.set(this.center.x + (Math.random() - 0.5) * 3, 0.4 + Math.random() * 1.6, this.center.z + (Math.random() - 0.5) * 3));
    }
    if (!f.pulse1 && t >= PULSE_1) { f.pulse1 = true; this.pulse(0); }
    if (!f.pulse2 && t >= PULSE_2) { f.pulse2 = true; this.pulse(1); }
    if (!f.fall && t >= FALL_T) {
      f.fall = true;
      // The plates fall and the swarm settles.
      this.shell.crumble(0.4);
      this.swarm.scatter(0.55, false, 1.6);
    }

    // The flare: out in ~0.2 s, held a breath, back in over ~0.3 s.
    let flare = 0, gr = 0, gs = 0, sh = 0;
    for (const at of this.pulseAt) {
      const s = t - at;
      if (s < 0 || s > 0.75) continue;
      const out = 1 - Math.pow(1 - Math.min(s / 0.22, 1), 3);
      const back = s < 0.3 ? 0 : smoothstep((s - 0.3) / 0.4);
      flare = Math.max(flare, out * (1 - back));
      if (s < 0.4) {
        const k = s / 0.4;
        gr = RADIUS * (1 - Math.pow(1 - k, 3));
        gs = 0.016 * (1 - k) * (1 - k);
      }
      sh = Math.max(sh, 0.15 * Math.exp(-s * 10));
    }
    this.groundShock.set(this.center, Math.max(gr, 0.1), gs);
    this.shake = sh;
    this.shell.setCenter(this.center);
    this.swarm.center.set(this.center.x, 1.1, this.center.z);
    if (!f.fall) this.swarm.radius = 1.8 + (RADIUS - 0.6 - 1.8) * flare;
    this.screen.darken = 0.12 * smoothstep(t / 0.35) * (1 - smoothstep((t - FALL_T) / 0.5));
  }
}

export const chitinCarapaceModule: EffectModule = {
  label: 'chitin carapace',
  category: 'hero: hive',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new ChitinCarapace(),
  // No damage, so no telegraph; the radius only tells the duel AI to cast it when an enemy is within 3.4 m.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ChitinCarapace;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ChitinCarapace).settings;
    f.add(s, 'loop');
  },
};
