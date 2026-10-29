import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { BARD_CSS, Lyre, Notes, SoundRings, Stave } from '../../effects/parts/bard';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Ballad of Valor (bard kit, E: a self aura). Two stave ribbons circle him (radius 1.3) with notes riding them, and he
 * is shielded at once. At 1.0 and 2.0 he strums and a sound ring races out to radius 4: every enemy inside takes a small
 * hit and is knocked back. At 2.0 golden notes rise around him and he heals. At 2.6 the staves unwind into falling
 * notes. Clean by 3.2 s. The telegraph ends at the first pulse. See pipeline/designs/kit-bard.md.
 */
export interface BalladOfValorSettings {
  shield: number;
  shieldSeconds: number;
  heal: number;
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultBalladOfValor = (): BalladOfValorSettings => ({ shield: 30, shieldSeconds: 3, heal: 40, damage: 10, knock: 2, loop: false });

// Timeline (seconds).
const DRAW_END = 0.3; // the staves have circled in
const PULSE_1 = 1.0;
const PULSE_2 = 2.0;
const UNWIND_T = 2.6;
const UNWIND_END = 3.0;
const DURATION = 3.2;

const RADIUS = 4;
const RING_R = 1.3;
const PTS = 40;
/** The two staves: height, rotation speed (rad/s), note speed (fraction/s). */
const BANDS = [
  { y: 0.55, rate: 1.5, du: 0.2 },
  { y: 1.3, rate: -1.2, du: -0.17 },
];

export class BalladOfValor implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BalladOfValorSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private from = new THREE.Vector3(0, 0, 14);
  private lyrePos = new THREE.Vector3();
  private flags = { lyre: false, notes: false, pulse1: false, pulse2: false, unwound: false };

  private lyre = new Lyre();
  private staves = [new Stave(PTS), new Stave(PTS)];
  private notes = new Notes(80);
  private rings = new SoundRings(5);
  private path: THREE.Vector3[] = [];

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: BalladOfValorSettings = defaultBalladOfValor()) {
    this.settings = settings;
    for (let i = 0; i <= PTS; i++) this.path.push(new THREE.Vector3());
    this.group.add(...this.staves.map((s) => s.mesh), this.lyre.mesh, this.notes.mesh, this.rings.mesh);
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
    const d = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.lyrePos.set(ctx.from.x + d.x * 0.35 - d.z * 0.45, 0.55, ctx.from.z + d.z * 0.35 + d.x * 0.45);
  }

  play() {
    this.reset();
    this.playing = true;
    // The shield goes up at the cast.
    this.ctx?.shieldSelf?.(this.settings.shield, this.settings.shieldSeconds, BARD_CSS.body);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.lyre.reset();
    for (const s of this.staves) s.reset();
    this.notes.reset();
    this.rings.reset();
  }

  /** Strums, sends a ring racing out to the radius and hits everyone inside (positions re-checked now). */
  private pulse() {
    const ctx = this.ctx;
    this.lyre.strum(1.2);
    this.shake = 0.15;
    this.rings.pulse(this.v1.set(this.from.x, 0.12, this.from.z), RADIUS, 0.4, this.up, { r0: 0.8, width: 0.2 });
    this.rings.pulse(this.v1.set(this.from.x, 0.12, this.from.z), RADIUS - 0.4, 0.4, this.up, { r0: 0.5, width: 0.1 });
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.from.x, p.z - this.from.z) > RADIUS) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: this.from, color: BARD_CSS.body });
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.lyre.update(dt);
    for (const s of this.staves) s.update(dt);
    this.notes.update(dt);
    this.rings.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.playing = false;
      this.reset();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time, f = this.flags;

    if (!f.lyre) {
      f.lyre = true;
      this.lyre.show(this.lyrePos, 0.95);
      this.lyre.strum(1);
    }

    // --- Two stave ribbons circle him; they draw in over the first 0.3 s and unwind at the end. ---
    const head = easeOut(t / DRAW_END);
    const tail = smoothstep((t - UNWIND_T) / (UNWIND_END - UNWIND_T));
    BANDS.forEach((b, k) => {
      const phase = t * b.rate + k * 2;
      for (let i = 0; i <= PTS; i++) {
        const a = phase + (i / PTS) * Math.PI * 2;
        this.path[i].set(this.from.x + Math.cos(a) * RING_R, b.y + 0.05 * Math.sin(a * 2 + t * 2), this.from.z + Math.sin(a) * RING_R);
      }
      this.staves[k].setPath(this.path, 0.07, head, tail);
      this.staves[k].wave(0.05);
    });

    // --- Notes ride the staves. ---
    if (!f.notes && t >= 0.2) {
      f.notes = true;
      BANDS.forEach((b, k) => {
        for (let i = 0; i < 5; i++) {
          this.notes.ride(this.staves[k], (i + 0.3 * k) / 5, i === 0 ? 3 : -1, { size: 0.6, du: b.du, lift: 0.2, wrap: true });
        }
      });
    }

    if (!f.pulse1 && t >= PULSE_1) { f.pulse1 = true; this.pulse(); }
    if (!f.pulse2 && t >= PULSE_2) {
      f.pulse2 = true;
      this.pulse();
      // Golden notes rise around him and he heals.
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4, r = 0.7 + Math.random() * 1.0;
        this.v1.set(this.from.x + Math.cos(a) * r, 0.4 + Math.random() * 0.8, this.from.z + Math.sin(a) * r);
        this.notes.emit(this.v1, this.v2.set(0, 2.4, 0), 1, 1.0, { size: 0.65, spread: 0.5, gravity: -0.6, gold: true });
      }
      this.ctx?.healSelf?.(this.settings.heal);
    }
    // --- 2.6: the staves unwind into falling notes. ---
    if (!f.unwound && t >= UNWIND_T) {
      f.unwound = true;
      this.notes.fall(5, 0.8);
      this.lyre.hide();
    }

    this.shake *= Math.exp(-dt * 12);
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const balladOfValorModule: EffectModule = {
  label: 'ballad of valor',
  category: 'hero: bard',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new BalladOfValor(),
  telegraphs(effect) {
    const e = effect as BalladOfValor;
    const ctx = e.ctx;
    if (!ctx) return [];
    // The telegraph ends at the first pulse (no `until`).
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: 0, impact: PULSE_1 }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BalladOfValor;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as BalladOfValor).settings;
    f.add(s, 'loop');
    f.add(s, 'shield', 0, 100, 1);
    f.add(s, 'heal', 0, 100, 1);
    f.add(s, 'damage', 0, 60, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
