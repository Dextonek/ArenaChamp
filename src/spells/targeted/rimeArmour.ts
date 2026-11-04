import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction } from '../../effects/parts';
import { FrostFerns, IceCrystals, RimeSleeves, Snow } from '../../effects/parts/frost';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { RIME_SECONDS } from '../../traits/frost';

/**
 * Rime Armour (frost kit v5, E: a self buff with a look; `src/traits/frost.ts` is the rules). The +40% armour is the kit's `buff`
 * (3 s), the rest is the trait's (`afterCast` shows a 'rime' pip over her; `taken` gives the attacker 2 Chill for every
 * basic attack that hits her while it runs). This effect only draws the shell and has no hits: rime climbs her robe from the feet
 * over 0.4 s (`RimeSleeves`, following her live position, so the shell walks with her), a ring of fern cracks opens on the
 * floor under her, and six small crystals stand round her shoulders, turning slowly. At 3 s (`RIME_SECONDS`) the shell
 * fades and the crystals shatter outward. Flakes drift off it now and then. Clean by 3.7 s.
 */
export interface RimeArmourSettings {
  loop: boolean;
}

export const defaultRimeArmour = (): RimeArmourSettings => ({ loop: false });

// Timeline (seconds).
const GROW_END = 0.4;
const END = RIME_SECONDS; // the shell ends with the buff
const DURATION = RIME_SECONDS + 0.7;
const RADIUS = 8; // the AI casts it when the enemy is inside this minus 0.6
const CRYSTALS = 6;
const ORBIT_R = 0.75;
const ORBIT_Y = 1.15;

export class RimeArmour implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RimeArmourSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private ended = false;
  private shedT = 0;
  private handles: number[] = [];
  private center = new THREE.Vector3();

  // Parts.
  private sleeves = new RimeSleeves(1);
  private crystals = new IceCrystals({ maxSpikes: CRYSTALS + 2, maxShards: 50 });
  private ferns = new FrostFerns({ variant: 0, maxShards: 0 });
  private snow = new Snow({ max: 40 });
  private shock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private d = new THREE.Vector3();

  constructor(settings: RimeArmourSettings = defaultRimeArmour()) {
    this.settings = settings;
    this.ferns.renderOrder = 2;
    this.group.add(this.ferns.mesh, this.sleeves.mesh, this.crystals.mesh, this.snow.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return GROW_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.from).setY(0);
  }

  play() {
    this.reset();
    this.playing = true;
    this.follow();
    this.ferns.grow(this.center, 1.5, GROW_END, 0);
    this.shock.set(this.center, 0.3, 0.03);
    // The six crystals stand up round her shoulders.
    for (let i = 0; i < CRYSTALS; i++) {
      this.orbit(i, 0, this.v1, this.d);
      this.handles.push(this.crystals.spike(this.v1, this.d, 0.55, 0.15, 0.25, 0.04 * i));
    }
    this.v2.copy(this.center).setY(1.1);
    this.snow.scatter(this.v2, 10, 2.2, 0.7);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.ended = false;
    this.shedT = 0;
    this.handles.length = 0;
    this.sleeves.clear();
    this.crystals.reset();
    this.ferns.reset();
    this.snow.reset();
    this.shock.set(this.center, 0, 0);
  }

  /** She walks; the shell walks with her. */
  private follow() {
    const c = this.ctx?.caster.group.position;
    if (c) this.center.set(c.x, 0, c.z);
  }

  /** Crystal `i` of the shoulder ring at time `t`: its base (`out`) and the way it points (`dir`, outward and up). */
  private orbit(i: number, t: number, out: THREE.Vector3, dir: THREE.Vector3) {
    const a = (i / CRYSTALS) * Math.PI * 2 + t * 0.6;
    out.set(this.center.x + Math.cos(a) * ORBIT_R, ORBIT_Y + 0.08 * Math.sin(t * 2 + i), this.center.z + Math.sin(a) * ORBIT_R);
    dir.set(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55).normalize();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crystals.update(dt);
    this.ferns.update(dt);
    this.snow.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    this.follow();

    // --- The shell: climbs from the feet, holds, fades with the buff. ---
    const grow = smoothstep(t / GROW_END);
    const fade = 1 - smoothstep((t - (END - 0.35)) / 0.45);
    this.sleeves.set(0, this.center, 2.2, 0.95, grow, 0.85 * fade);
    if (t > END + 0.1) this.sleeves.clear();

    // --- The crystals keep to her shoulders. ---
    if (!this.ended) {
      for (let i = 0; i < this.handles.length; i++) {
        this.orbit(i, t, this.v1, this.d);
        this.crystals.place(this.handles[i], this.v1, this.d);
      }
      // A flake drifts off the shell now and then.
      this.shedT -= dt;
      if (this.shedT <= 0 && t > GROW_END) {
        this.shedT = 0.25;
        this.v2.copy(this.center).setY(0.8 + Math.random() * 0.8);
        this.snow.scatter(this.v2, 1, 0.7, 0.6);
      }
    }

    // --- The ring that opened with it, then the end: the crystals burst outward. ---
    if (t < 0.5) {
      const k = THREE.MathUtils.clamp(t / 0.4, 0, 1);
      this.shock.set(this.center, 0.3 + 1.6 * k, 0.03 * (1 - k) * (1 - k));
    }
    if (t > 0.7 && this.ferns.active && !this.ended && t > END - 0.5) this.ferns.fade(0.4);
    if (!this.ended && t >= END) {
      this.ended = true;
      this.crystals.shatter(4, 4, 0.4);
      this.v2.copy(this.center).setY(1.2);
      this.snow.scatter(this.v2, 12, 3, 0.7);
      this.shake = 0.05;
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

export const rimeArmourModule: EffectModule = {
  label: 'rime armour',
  category: 'hero: frost',
  // Centred on the caster; `radius` is how close the enemy must be for the duel AI to cast it (this minus 0.6).
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new RimeArmour(),
  // No hit and no zone.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.3, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as RimeArmour;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    f.add((effect as RimeArmour).settings, 'loop');
  },
};
