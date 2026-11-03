import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { GROVE, Bloom, Petals, Pollen } from '../../effects/parts/grove';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Seed of Rebirth (grove kit, R: self-cast guard). A glowing seed drops into Fenna's palm and swells into a closed bud
 * that hangs over her shoulder for 5 s, pulsing slowly, pollen drifting off it. The rule itself (a hit that would drop
 * her under 15% HP blooms her back up by 35%) lives in the trait (`traits/grove.ts`), which also shows REBIRTH and the
 * heal number when it triggers. At the end of the 5 s the bud opens in a small burst of petals and pollen whether or
 * not it was used. See pipeline/designs/kit-grove.md, kit-shapes-v3.md.
 */
export interface SeedOfRebirthSettings {
  loop: boolean;
}

export const defaultSeedOfRebirth = (): SeedOfRebirthSettings => ({ loop: false });

// Timeline (seconds).
const BUD_T = 0.45; // the bud has grown and folds shut
const GUARD_S = 5; // matches the trait's guard window
const OPEN_T = GUARD_S;
const DURATION = GUARD_S + 1.3;

const BUD_SIZE = 0.5;
const BUD_HEIGHT = 2.15;

export class SeedOfRebirth implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SeedOfRebirthSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { planted: false, shut: false, opened: false };
  private nextMote = 0;

  // Parts.
  private bud = new Bloom();
  private petals = new Petals(40);
  private pollen = new Pollen(48);
  private plant = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: GROVE.hot, core: GROVE.core, additive: false });
  private pop = new StarBurst({ points: 12, inner: 0.3, color: GROVE.accent, core: 0xfff0f6, additive: false });

  // Scratch.
  private at = new THREE.Vector3();
  private v1 = new THREE.Vector3();

  constructor(settings: SeedOfRebirthSettings = defaultSeedOfRebirth()) {
    this.settings = settings;
    this.petals.life = 1.1;
    this.group.add(this.bud.mesh, this.petals.mesh, this.pollen.mesh, this.plant.mesh, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return OPEN_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.follow();
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.nextMote = 0;
    const f = this.flags;
    f.planted = f.shut = f.opened = false;
    this.bud.reset();
    this.petals.reset();
    this.pollen.reset();
    this.plant.set(this.at, 0, 0);
    this.pop.set(this.at, 0, 0);
  }

  /** The bud hangs on her: it follows her live position, a little to the right of her head. */
  private follow() {
    const p = this.ctx?.caster.group.position ?? this.ctx?.from;
    if (p) this.at.set(p.x + 0.45, BUD_HEIGHT, p.z);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.bud.update(dt);
    this.petals.update(dt);
    this.pollen.update(dt);
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
    this.follow();

    if (!f.planted) {
      f.planted = true;
      this.bud.open(this.at, BUD_SIZE, BUD_T);
      this.pollen.puff(this.at, 8);
    }
    if (!f.shut && t >= BUD_T) {
      f.shut = true;
      this.bud.close(0.25);
    }
    if (f.shut && !f.opened) {
      // The held bud: it breathes (a slow scale pulse) and sheds a mote of pollen now and then.
      this.bud.pos.copy(this.at).y += Math.sin(t * 3) * 0.04;
      this.bud.kick = 0.12 * (0.5 + 0.5 * Math.sin(t * 4.2));
      if (t >= this.nextMote) {
        this.nextMote = t + 0.45;
        this.pollen.puff(this.v1.copy(this.at).setY(this.at.y - 0.2), 1);
      }
    }
    if (!f.opened && t >= OPEN_T) {
      f.opened = true;
      this.bud.open(this.at, 1.3, 0.35);
      this.bud.kick = 0.4;
      this.petals.burst(this.at, 18, 5);
      this.pollen.puff(this.at, 12);
      this.shake = 0.06;
    }
    if (f.opened && t >= OPEN_T + 0.7) this.bud.shed(0.5);

    const plantSp = StarBurst.pop(t, 0, 0.12);
    this.plant.set(this.v1.copy(this.at).setY(this.at.y - 0.2), 0.5 * plantSp.scale, plantSp.opacity, t * 3);
    const popSp = StarBurst.pop(t - OPEN_T, 0, 0.05);
    this.pop.set(this.at, 1.1 * popSp.scale, popSp.opacity, 0.2);
    this.shake *= Math.exp(-dt * 14);
  }
}

export const seedOfRebirthModule: EffectModule = {
  label: 'seed of rebirth',
  category: 'hero: grove',
  targeting: { mode: 'self', radius: 1 },
  create: () => new SeedOfRebirth(),
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SeedOfRebirth;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    f.add((effect as SeedOfRebirth).settings, 'loop');
  },
};
