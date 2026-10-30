import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { INK_CSS, PaperFold, Seal, Splatter, Stroke, inkCraneLook } from '../../effects/parts/ink';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Paper Familiars (ink kit, E: a summon). 0-0.4: two sheets of rice paper unfold beside Shiori and fold themselves into
 * cranes, a vermilion seal stamping under each. At 0.5 the sheets give way to two real ink cranes (`ctx.summon`, ranged
 * units that shoot ink darts) and a ring of ink splashes out to radius 3, hitting everyone inside. Clean by 1.4 s (the
 * cranes live on as units). See pipeline/designs/kit-ink.md.
 */
export interface PaperFamiliarsSettings {
  damage: number;
  loop: boolean;
}

export const defaultPaperFamiliars = (): PaperFamiliarsSettings => ({ damage: 10, loop: false });

// Timeline (seconds).
const FOLD_END = 0.4;
const SEAL_T = 0.25;
const SUMMON_T = 0.5;
const DURATION = 1.4;

const RADIUS = 3;
const RING_R = 2.7;
const RING_PTS = 14;

export class PaperFamiliars implements Effect {
  readonly group = new THREE.Group();
  readonly settings: PaperFamiliarsSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { sheets: false, seal: false, summon: false, fade: false };
  private spots = [new THREE.Vector3(), new THREE.Vector3()];
  private yaw = 0;

  private sheets = new PaperFold(2);
  private seals = new Seal(2);
  private ring = new Stroke({ flat: true, order: 4, samples: 40 });
  private splat = new Splatter(16);

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private path: THREE.Vector3[] = Array.from({ length: RING_PTS }, () => new THREE.Vector3());

  constructor(settings: PaperFamiliarsSettings = defaultPaperFamiliars()) {
    this.settings = settings;
    this.group.add(this.seals.mesh, this.ring.mesh, this.sheets.mesh, this.splat.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SUMMON_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.yaw = ctx.aim;
    // The sheets float beside her: one to each side and a little ahead.
    const fx = Math.sin(ctx.aim), fz = Math.cos(ctx.aim);
    [-1, 1].forEach((s, i) => this.spots[i].set(ctx.from.x + fz * 1.2 * s + fx * 0.4, 0, ctx.from.z - fx * 1.2 * s + fz * 0.4));
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.sheets = this.flags.seal = this.flags.summon = this.flags.fade = false;
    this.sheets.reset();
    this.seals.reset();
    this.ring.reset();
    this.splat.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.ring.update(dt);
    this.seals.update(dt);
    this.splat.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.playing = false;
      this.reset();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, ctx = this.ctx;

    // --- 0..0.4: two sheets unfold and fold themselves into cranes. ---
    if (!f.sheets) {
      f.sheets = true;
      this.spots.forEach((p, i) => this.sheets.show(i, p, 1.0, this.yaw + (i ? -0.5 : 0.5)));
    }
    if (t < SUMMON_T) {
      const k = Math.min(1, t / FOLD_END);
      this.spots.forEach((_p, i) => this.sheets.set(i, k));
    }
    if (!f.seal && t >= SEAL_T) {
      f.seal = true;
      this.spots.forEach((p) => this.seals.stamp(p, 0.8));
    }

    // --- 0.5: the cranes take over, a ring of ink splashes out to radius 3. ---
    if (!f.summon && t >= SUMMON_T) {
      f.summon = true;
      this.sheets.reset();
      if (ctx) {
        const c = ctx.from;
        ctx.summon?.({
          kind: 'ranged', at: c.clone(), count: 2, hp: 35, seconds: 6, damage: 8, attackEvery: 1.5, color: INK_CSS.body, look: inkCraneLook,
        });
        // Re-check where everyone stands: enemies who walked out before the splash are spared.
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - c.x, p.z - c.z) > RADIUS) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: 1, from: c, color: INK_CSS.hot });
        }
        for (let i = 0; i < RING_PTS; i++) {
          const a = (i / (RING_PTS - 1)) * Math.PI * 2 + 0.4;
          this.path[i].set(c.x + Math.cos(a) * RING_R, 0.1, c.z + Math.sin(a) * RING_R);
        }
        this.ring.paint(this.path, 0.5, 0.18);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + 0.3;
          this.v2.set(Math.cos(a), 0.15, Math.sin(a));
          this.splat.fling(this.v1.set(c.x, 0.3, c.z), this.v2, 1, 5.5, { size: 0.1, spread: 0.15, up: 0.5, life: 0.6 });
        }
      }
      this.shake = 0.1;
    }
    if (!f.fade && t >= 0.75) {
      f.fade = true;
      this.ring.dissolve(0.5);
      this.seals.fade(0.5);
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

export const paperFamiliarsModule: EffectModule = {
  label: 'paper familiars',
  category: 'hero: ink',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new PaperFamiliars(),
  telegraphs(effect) {
    const e = effect as PaperFamiliars;
    const ctx = e.ctx;
    if (!ctx) return [];
    // The splash circle ends the moment the cranes land.
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: 0, impact: SUMMON_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as PaperFamiliars;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as PaperFamiliars).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 60, 1);
  },
};

