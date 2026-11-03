import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { Afterimage, Dial, FrozenMotes } from '../../effects/parts/chrono';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Quickstep (chrono kit, E: a dash). A small dial snaps open at Tempo's feet and a pale afterimage stays standing on it;
 * he slides 5 m toward the aim in 0.2 s (`ctx.moveCaster`) while two or three afterimages follow the path he took.
 * A second small dial flashes where he lands and chartreuse motes drift off both spots. No damage: the gain is the
 * trait's (his cooldowns tick twice as fast for 2 s, two charges: `src/traits/chrono.ts`). Clean by 0.9 s.
 */
export interface QuickstepSettings {
  distance: number;
  loop: boolean;
}

export const defaultQuickstep = (): QuickstepSettings => ({ distance: 5, loop: false });

const DASH_LEN = 0.2;
const DURATION = 0.9;
const DIAL_R = 0.9;

export class Quickstep implements Effect {
  readonly group = new THREE.Group();
  readonly settings: QuickstepSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly start = new THREE.Vector3();
  readonly land = new THREE.Vector3();
  private time = 0;
  private flags = { arrive: false, fade: false };

  private startDial = new Dial({ face: 'ring', marks: 'ticks', hands: false, order: 8 });
  private landDial = new Dial({ face: 'ring', marks: 'ticks', order: 9 });
  private mark = new Afterimage(1);
  private echoes = new Afterimage(3);
  private motes = new FrozenMotes();

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: QuickstepSettings = defaultQuickstep()) {
    this.settings = settings;
    this.group.add(this.startDial.group, this.landDial.group, this.mark.group, this.echoes.group, this.motes.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return DASH_LEN;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    this.start.copy(ctx.from).setY(0);
    const d = this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim)).multiplyScalar(this.settings.distance);
    const want = this.v2.copy(this.start).add(d);
    this.land.copy(ctx.moveCaster ? ctx.moveCaster(want, DASH_LEN) : want).setY(0);
    this.startDial.show(this.v1.copy(this.start).setY(0.06), DIAL_R, this.up, 0.08);
    this.startDial.tick(-10);
    this.mark.stand(0, this.start, ctx.aim, 0.34);
    this.v1.copy(this.start);
    this.echoes.replay([this.land.clone(), this.v1.clone()], DASH_LEN + 0.1, 0.06);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.motes.drift(this.v1.set(this.start.x + Math.cos(a) * 0.6, 0, this.start.z + Math.sin(a) * 0.6), 0.3, 1);
    }
    this.motes.release(0.6);
    this.shake = 0.08;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.arrive = this.flags.fade = false;
    this.startDial.reset();
    this.landDial.reset();
    this.mark.reset();
    this.echoes.reset();
    this.motes.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.startDial.update(dt);
    this.landDial.update(dt);
    this.mark.update(dt);
    this.echoes.update(dt);
    this.motes.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags;
    if (!f.arrive && t >= DASH_LEN) {
      f.arrive = true;
      this.landDial.show(this.v1.copy(this.land).setY(0.06), DIAL_R, this.up, 0.05);
      this.landDial.flash(1);
      this.mark.fade(0.25);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.motes.drift(this.v1.set(this.land.x + Math.cos(a) * 0.6, 0, this.land.z + Math.sin(a) * 0.6), 0.3, 1);
      }
      this.motes.release(0.5);
    }
    if (!f.fade && t >= 0.5) {
      f.fade = true;
      this.startDial.hide(0.25);
      this.landDial.hide(0.25);
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

export const quickstepModule: EffectModule = {
  label: 'quickstep',
  category: 'hero: chrono',
  targeting: { mode: 'ground', radius: 1 },
  create: () => new Quickstep(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Quickstep;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as Quickstep).settings;
    f.add(s, 'loop');
    f.add(s, 'distance', 1, 8, 0.5);
  },
};
