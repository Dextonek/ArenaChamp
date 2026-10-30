import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { Afterimage, CHRONO_CSS, Dial, FrozenMotes } from '../../effects/parts/chrono';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Rewind (chrono kit, E: a self spell with a dash back). Tempo marks the moment: a dial (radius 1.2) opens at his feet and
 * a pale afterimage of him stays standing on it, and he is shielded at once. He may walk freely for 1.5 s; the dial's hands
 * run backward. At 1.8 he rewinds: `ctx.moveCaster` takes him back to the mark in 0.25 s while two or three afterimages
 * replay his path backward. On arrival (2.05) he heals, the dial flashes outward to radius 3 and every enemy inside
 * (positions re-checked now) is hit and shoved. The dial fades (2.2..2.6); clean by 2.8 s. See pipeline/designs/kit-chrono.md.
 */
export interface RewindSettings {
  shield: number;
  shieldSeconds: number;
  heal: number;
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultRewind = (): RewindSettings => ({ shield: 25, shieldSeconds: 2, heal: 45, damage: 15, knock: 2, loop: false });

// Timeline (seconds).
const MARK_END = 0.3; // the dial is open
const REWIND_T = 1.8; // back to the mark
const DASH_LEN = 0.25;
const ARRIVE_T = 2.05;
const FLASH_LEN = 0.15;
const FADE_T = 2.2;
const FADE_LEN = 0.4;
const DURATION = 2.8;
const TELEGRAPH_T = 1.4;

const RADIUS = 3;
const MARK_R = 1.2;

export class Rewind implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RewindSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { mark: false, back: false, arrive: false, fade: false };

  /** The marked spot (his feet at t = 0) and where the rewind really lands him. */
  readonly anchor = new THREE.Vector3();
  private land = new THREE.Vector3();
  private yaw = 0;
  private path: THREE.Vector3[] = [];

  // Parts.
  private dial = new Dial({ face: 'ring', marks: 'quarter' });
  private mark = new Afterimage(1);
  private echoes = new Afterimage(3);
  private motes = new FrozenMotes();

  // Scratch.
  private v1 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: RewindSettings = defaultRewind()) {
    this.settings = settings;
    this.group.add(this.dial.group, this.mark.group, this.echoes.group, this.motes.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return ARRIVE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.anchor.copy(ctx.from).setY(0);
    this.yaw = ctx.aim;
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    // The moment is marked where he stands now; the shield goes up at the cast.
    if (ctx) this.anchor.copy(ctx.caster.group.position).setY(0);
    this.land.copy(this.anchor);
    this.path.length = 0;
    this.path.push(this.anchor.clone());
    ctx?.shieldSelf?.(this.settings.shield, this.settings.shieldSeconds, CHRONO_CSS.body);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.dial.reset();
    this.mark.reset();
    this.echoes.reset();
    this.motes.reset();
  }

  /** Calls `fn` for each enemy standing within the dial's flash right now. */
  private eachInside(fn: (e: CastContext['targets'][number]) => void) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.land.x, p.z - this.land.z) <= RADIUS) fn(e);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.dial.update(dt);
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
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // --- 0..0.3: a dial opens at his feet and an afterimage of him stays standing on it. ---
    if (!f.mark) {
      f.mark = true;
      this.dial.show(this.v1.copy(this.anchor).setY(0.06), MARK_R, this.up, MARK_END);
      this.dial.tick(-8);
      this.mark.stand(0, this.anchor, this.yaw, 0.38);
    }

    // --- 0.3..1.8: he walks freely; his path is recorded for the replay. The anchored dial's hands run backward. ---
    if (ctx && t >= MARK_END && !f.back) {
      const p = ctx.caster.group.position, last = this.path[this.path.length - 1];
      if (Math.hypot(p.x - last.x, p.z - last.z) > 0.3 && this.path.length < 60) this.path.push(new THREE.Vector3(p.x, 0, p.z));
    }

    // --- 1.8: the rewind. He slides back to the mark while afterimages replay his path backward. ---
    if (!f.back && t >= REWIND_T) {
      f.back = true;
      if (ctx) {
        const p = ctx.caster.group.position;
        this.path.push(new THREE.Vector3(p.x, 0, p.z));
        this.land.copy(ctx.moveCaster ? ctx.moveCaster(this.anchor, DASH_LEN) : this.anchor).setY(0);
      }
      this.echoes.replay(this.path, DASH_LEN + 0.1, 0.07);
      this.shake = Math.max(this.shake, 0.1);
    }

    // --- 2.05: he arrives, heals, and the dial flashes outward to radius 3, hitting everyone inside. ---
    if (!f.arrive && t >= ARRIVE_T) {
      f.arrive = true;
      ctx?.healSelf?.(this.settings.heal);
      this.dial.flash(1);
      this.mark.fade(0.2);
      this.shake = Math.max(this.shake, 0.2);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        this.motes.drift(this.v1.set(this.land.x + Math.cos(a) * 0.9, 0, this.land.z + Math.sin(a) * 0.9), 0.4, 1);
      }
      this.motes.release(0.9);
      this.eachInside((e) => ctx?.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: this.anchor, color: CHRONO_CSS.body }));
    }
    if (f.arrive) {
      const r = MARK_R + (RADIUS - MARK_R) * easeOut((t - ARRIVE_T) / FLASH_LEN);
      this.dial.place(this.v1.copy(this.anchor).setY(0.06), r);
    }

    // --- 2.2..2.6: the dial fades. ---
    if (!f.fade && t >= FADE_T) {
      f.fade = true;
      this.dial.hide(FADE_LEN);
    }

    this.shake *= Math.exp(-dt * 12);
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const rewindModule: EffectModule = {
  label: 'rewind',
  category: 'hero: chrono',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new Rewind(),
  telegraphs(effect) {
    const e = effect as Rewind;
    const ctx = e.ctx;
    if (!ctx) return [];
    // Where the flash will land: a circle of 3 round the mark, from 1.4 to the arrival.
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: TELEGRAPH_T, impact: ARRIVE_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Rewind;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Rewind).settings;
    f.add(s, 'loop');
    f.add(s, 'shield', 0, 100, 1);
    f.add(s, 'heal', 0, 100, 1);
    f.add(s, 'damage', 0, 60, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
