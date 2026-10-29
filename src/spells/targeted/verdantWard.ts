import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import { GROVE_CSS, Bloom, Petals, Pollen, RootRing, SpiralVine } from '../../effects/parts/grove';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Verdant Ward (grove kit, E: self aura): three spiral vines rise around Fenna and a flower opens on each. The flowers
 * slowly turn outward; at 1.0 s and 2.0 s each one fires a short jet of petals and pollen at every enemy within 5 (the
 * jet leaves 0.22 s early and lands on the beat). Then the flowers shed and the vines wither. See
 * pipeline/designs/kit-grove.md.
 */
export interface VerdantWardSettings {
  damage: number;
  loop: boolean;
}

export const defaultVerdantWard = (): VerdantWardSettings => ({ damage: 15, loop: false });

// Timeline (seconds).
const RISE_T = 0.3;
const PULSES = [1.0, 2.0];
const JET_LEAD = 0.22; // the jet leaves this long before the hit
const WITHER_T = 2.6;
const DURATION = 3.2;

const RADIUS = 5;
const FLOWERS = 3;
const RING_R = 1.2;
const LEAN = 0.85; // how far the flowers tip toward outward

export class VerdantWard implements Effect {
  readonly group = new THREE.Group();
  readonly settings: VerdantWardSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private angles = [0, 0, 0];

  // Event flags.
  private flags = { open: false, jet: [false, false], hit: [false, false], wither: false };
  private kickAt = [-9, -9, -9];

  // Parts.
  private roots = new RootRing();
  private vines: SpiralVine[] = [];
  private blooms: Bloom[] = [];
  private tips: THREE.Vector3[] = [];
  private petals = new Petals(48);
  private pollen = new Pollen(40);

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: VerdantWardSettings = defaultVerdantWard()) {
    this.settings = settings;
    this.petals.life = 0.9;
    for (let i = 0; i < FLOWERS; i++) {
      this.vines.push(new SpiralVine(30, 6, 5));
      this.blooms.push(new Bloom());
      this.tips.push(new THREE.Vector3());
    }
    this.group.add(
      this.roots.mesh, ...this.vines.map((v) => v.mesh), ...this.blooms.map((b) => b.mesh), this.petals.mesh, this.pollen.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return PULSES[0];
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    for (let i = 0; i < FLOWERS; i++) this.angles[i] = (i / FLOWERS) * Math.PI * 2 + 0.5;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.v1.copy(this.from).setY(1.2));
  }

  play() {
    this.reset();
    this.playing = true;
    this.roots.spread(this.from, 1.9, 0.3);
    for (let i = 0; i < FLOWERS; i++) {
      const a = this.angles[i];
      this.v1.set(this.from.x + Math.cos(a) * RING_R, 0.05, this.from.z + Math.sin(a) * RING_R);
      this.vines[i].grow(this.v1, this.v2.set(0, 1, 0), 2.6, 2.2, 0.24, RISE_T, { coilRadius: 0.28, phase: a, delay: i * 0.03 });
      this.vines[i].pointAt(1, this.tips[i]);
      this.tips[i].y += 0.08;
    }
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.open = this.flags.wither = false;
    this.flags.jet.fill(false);
    this.flags.hit.fill(false);
    this.kickAt.fill(-9);
    clearScreenFx(this.screen);
    this.roots.reset();
    for (const v of this.vines) v.reset();
    for (const b of this.blooms) b.reset();
    this.petals.reset();
    this.pollen.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.roots.update(dt);
    for (const v of this.vines) v.update(dt);
    for (const b of this.blooms) b.update(dt);
    this.petals.update(dt);
    this.pollen.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.open && t >= RISE_T + 0.02) {
      f.open = true;
      this.blooms.forEach((b, i) => b.open(this.tips[i], 0.8, 0.3));
    }
    for (let i = 0; i < PULSES.length; i++) {
      if (!f.jet[i] && t >= PULSES[i] - JET_LEAD) {
        f.jet[i] = true;
        this.fireJets();
      }
      if (!f.hit[i] && t >= PULSES[i]) {
        f.hit[i] = true;
        this.eachInside((e, p) => {
          this.pollen.puff(this.v1.copy(p).setY(1.0), 4);
          ctx?.hit(e, { damage: this.settings.damage, knock: 1, from: ctx.from, color: GROVE_CSS.body });
        });
      }
    }
    if (!f.wither && t >= WITHER_T) {
      f.wither = true;
      this.blooms.forEach((b, i) => b.shed(0.4 + i * 0.03));
      this.vines.forEach((v, i) => v.wither(0.4, i * 0.03));
      this.roots.fade(0.3, 0);
    }

    this.layout();
  }

  private eachInside(fn: (e: CastContext['targets'][number], p: THREE.Vector3) => void) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (p && Math.hypot(p.x - this.from.x, p.z - this.from.z) <= RADIUS) fn(e, p);
    });
  }

  /** Every flower sends a short petal stream to every enemy inside (or outward when nobody is in range). */
  private fireJets() {
    let any = false;
    this.eachInside((_e, p) => {
      any = true;
      for (let i = 0; i < FLOWERS; i++) {
        this.v2.copy(this.tips[i]);
        this.v3.copy(p).setY(1.0);
        this.petals.stream(this.v2, this.v3, 4, JET_LEAD);
      }
    });
    for (let i = 0; i < FLOWERS; i++) {
      if (!any) {
        const a = this.angles[i];
        this.v3.set(this.from.x + Math.cos(a) * 4, 0.3, this.from.z + Math.sin(a) * 4);
        this.petals.stream(this.tips[i], this.v3, 4, JET_LEAD);
      }
      this.pollen.puff(this.tips[i], 3);
      this.kickAt[i] = this.time;
    }
  }

  private layout() {
    const t = this.time;

    // --- 0.3..2.6 the flowers turn outward; each pulse makes them swell for a beat. ---
    const turn = smoothstep((t - RISE_T) / (WITHER_T - RISE_T));
    for (let i = 0; i < FLOWERS; i++) {
      const a = this.angles[i];
      this.blooms[i].aim(Math.PI / 2 - a, LEAN * turn);
      const k = t - this.kickAt[i];
      this.blooms[i].kick = k >= 0 && k < 0.4 ? Math.exp(-k * 9) : 0;
    }
    this.shake = Math.max(0.15 * Math.exp(-(t - PULSES[0]) * 10) * (t >= PULSES[0] ? 1 : 0), 0.15 * Math.exp(-(t - PULSES[1]) * 10) * (t >= PULSES[1] ? 1 : 0));
  }
}

export const verdantWardModule: EffectModule = {
  label: 'verdant ward',
  category: 'hero: grove',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new VerdantWard(),
  telegraphs(effect) {
    const e = effect as VerdantWard;
    const c = e.ctx?.from;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: 0, impact: PULSES[0] }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as VerdantWard;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as VerdantWard).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
  },
};
