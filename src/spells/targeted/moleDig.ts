import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { Clods, Cracks, GroundRing, LampGlow, MOLE, Pickaxe, Puffs } from '../../effects/parts/mole';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { DIG_DELAY, DIG_RADIUS, openHole } from '../../traits/mole';

/**
 * Dig (mole kit, W: a hole at a spot). Mabel aims at a spot (6 m). A tiny pickaxe pops up there and taps the ground three times
 * (0.15, 0.35, 0.55 s), each tap flinging a few clods and running a crack further out, while her helmet lamp glows. At 0.7 s the
 * ground gives way: a burst of clods, a ring of dust, and a hole of radius 1.5 m opens and stays 8 s (a dark pit with a raised rim of
 * dirt, drawn by her trait's `marks`). The effect only opens it: `openHole` writes the record on both screens at that moment, and
 * falling in is the trait's `victimTick` (src/traits/mole.ts), so it is judged on the victim's screen on live positions. Three holes at
 * most: a fourth closes the oldest. Telegraph: the circle, impact at the opening (she is rooted 0.7 s). The spot is built from the
 * aim point, so both screens agree. Clean by about 1.6 s. See pipeline/designs/kit-mole.md.
 */
export interface MoleDigSettings {
  loop: boolean;
}

export const defaultMoleDig = (): MoleDigSettings => ({ loop: false });

const DURATION = 1.6;
const TAPS = [0.15, 0.35, 0.55];

export class MoleDig implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MoleDigSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly spot = new THREE.Vector3();
  private time = 0;
  private tapped = 0;
  private opened = false;
  private head = new THREE.Vector3();

  private clods = new Clods(48);
  private puffs = new Puffs(16);
  private cracks = new Cracks(9);
  private ring = new GroundRing(MOLE.light);
  private pick = new Pickaxe();
  private lamp = new LampGlow();

  private v1 = new THREE.Vector3();

  constructor(settings: MoleDigSettings = defaultMoleDig()) {
    this.settings = settings;
    this.group.add(this.clods.mesh, this.puffs.mesh, this.cracks.mesh, this.ring.mesh, this.pick.mesh, this.lamp.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return DIG_DELAY;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.spot.copy(ctx.point).setY(0);
    const s = ctx.sentFrom ?? ctx.from;
    this.head.set(s.x, 1.65, s.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.tapped = 0;
    this.opened = false;
    this.clods.reset();
    this.puffs.reset();
    this.cracks.set(this.spot, DIG_RADIUS, 0, 0);
    this.ring.set(this.spot, 0, 0);
    this.pick.hide();
    this.lamp.set(this.head, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.clods.update(dt);
    this.puffs.update(dt);
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

    // --- 0..0.7: the pickaxe taps three times; each tap throws clods and runs the cracks further. ---
    if (t < DIG_DELAY) {
      const yaw = ctx ? Math.atan2((ctx.sentFrom ?? ctx.from).x - this.spot.x, (ctx.sentFrom ?? ctx.from).z - this.spot.z) : 0;
      let swing = -0.5;
      for (const tt of TAPS) {
        const a = t - (tt - 0.1);
        if (a >= 0 && a < 0.14) swing = -0.5 + 1.2 * Math.sin((Math.PI * a) / 0.14);
      }
      this.pick.place(this.v1.set(this.spot.x, 0.05, this.spot.z), yaw, swing, THREE.MathUtils.clamp(t / 0.06, 0, 1) * 1.8);
      while (this.tapped < TAPS.length && t >= TAPS[this.tapped]) {
        this.tapped++;
        this.shake = Math.max(this.shake, 0.05);
        this.v1.set(this.spot.x, 0.15, this.spot.z);
        this.clods.burst(this.v1, 4, 2.6, 0.7, 0.8);
        this.puffs.puff(this.v1, 0.45);
      }
      this.cracks.set(this.spot, DIG_RADIUS, THREE.MathUtils.smoothstep(t, 0.1, 0.68), 0.9);
      this.lamp.set(this.head, 0.9, 0.5 + 0.4 * (t / DIG_DELAY) + 0.1 * Math.sin(t * 35));
    }

    // --- 0.7 s: the ground gives way and the hole is open. ---
    if (!this.opened && t >= DIG_DELAY) {
      this.opened = true;
      this.shake = 0.18;
      if (ctx) openHole(ctx.caster, this.spot.x, this.spot.z);
      this.v1.set(this.spot.x, 0.2, this.spot.z);
      this.clods.burst(this.v1, 14, 5, 1.1, 1.2);
      this.puffs.ring(this.spot, 0.9, 7, 0.8);
      this.puffs.puff(this.v1.set(this.spot.x, 0.4, this.spot.z), 1.1, MOLE.soil);
      this.pick.hide();
    }
    if (this.opened) {
      const a = t - DIG_DELAY;
      this.ring.set(this.spot, DIG_RADIUS * (0.8 + 0.9 * THREE.MathUtils.clamp(a / 0.4, 0, 1)), 0.7 * (1 - THREE.MathUtils.clamp(a / 0.4, 0, 1)));
      this.cracks.set(this.spot, DIG_RADIUS, 1, Math.max(0, 0.9 - a * 3));
      this.lamp.set(this.head, 1.1, Math.max(0, 0.8 - a * 3));
    }
    this.shake *= Math.exp(-dt * 11);
  }
}

export const moleDigModule: EffectModule = {
  label: 'mole dig',
  category: 'hero: mole',
  // A spot (the ground point or the target's feet), 6 m at most; `radius` is the hole.
  targeting: { mode: 'ground', radius: DIG_RADIUS },
  create: () => new MoleDig(),
  telegraphs(effect) {
    const e = effect as MoleDig;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.spot.x, z: e.spot.z, radius: DIG_RADIUS }, start: 0, impact: DIG_DELAY }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as MoleDig;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as MoleDig).settings;
    f.add(s, 'loop');
  },
};
