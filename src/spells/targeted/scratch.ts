import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { CAT, CAT_CSS, CatWord, Claws, Specks } from '../../effects/parts/cat';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SCRATCH_ANGLE, SCRATCH_DAMAGE, SCRATCH_RANGE } from '../../traits/cat';

/**
 * Scratch (cat kit v5, Q: a QUICK claw, `self` mode; label 'scratch'). Sir Whiskers rakes the air in front of him: a 2.5 m cone, 90
 * degrees wide, drawn as the telegraph (impact 0.15 s). At 0.15 s every enemy inside it, on live positions, takes 40 and a small
 * push; three crossed claw strokes are drawn in the air there (a dark band, an amber band, a white core), a pale star pops, fur and
 * sparks fly, and sometimes MROW. The trait makes his next basic attack within 2 s ready at once (`attackMods` and `resetAttack` in
 * src/traits/cat.ts) and shows a pip over him until it goes. Rhythm tool, 3 s. Clean by about 1.3 s. See pipeline/designs/kit-cat.md.
 */
export interface ScratchSettings {
  damage: number;
  loop: boolean;
}

export const defaultScratch = (): ScratchSettings => ({ damage: SCRATCH_DAMAGE, loop: false });

const HIT_T = 0.15;
const DURATION = 1.3;
const WORDS = ['MROW', 'HISS', 'NYA'];

export class Scratch implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ScratchSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  cone: TelegraphShape = { kind: 'cone', x: 0, z: 0, radius: SCRATCH_RANGE, angle: SCRATCH_ANGLE, dir: 0 };
  private from = new THREE.Vector3();
  private fwd = new THREE.Vector3(0, 0, 1);
  private time = 0;
  private swung = false;
  private count = 0;

  private claws = new Claws();
  private specks = new Specks(40);
  private word = new CatWord(2);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: CAT.body, core: CAT.core, additive: false });
  private v1 = new THREE.Vector3();

  constructor(settings: ScratchSettings = defaultScratch()) {
    this.settings = settings;
    this.group.add(this.claws.mesh, this.specks.mesh, this.word.mesh, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens agree on the cone: `sentFrom` and the caster's facing (a QUICK spell's direction; `ctx.aim` is 0 for the CPU).
    const s = ctx.sentFrom ?? ctx.from;
    const yaw = ctx.caster.group.rotation.y;
    this.from.set(s.x, 0, s.z);
    this.fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.cone = { kind: 'cone', x: s.x, z: s.z, radius: SCRATCH_RANGE, angle: SCRATCH_ANGLE, dir: yaw };
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.swung = false;
    this.claws.reset();
    this.specks.reset();
    this.word.reset();
    this.pop.set(this.from, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.claws.update(dt);
    this.specks.update(dt);
    this.word.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    if (t >= DURATION && !this.specks.busy && !this.word.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    if (!this.swung && t >= HIT_T) {
      this.swung = true;
      this.swing();
    }
    if (this.swung) {
      const a = t - HIT_T;
      const sp = StarBurst.pop(a, 0, 0.02);
      this.v1.copy(this.from).addScaledVector(this.fwd, 1.9).setY(1.1);
      this.pop.set(this.v1, 0.9 * sp.scale, sp.opacity, 0.3);
      this.shake = Math.max(this.shake * Math.exp(-dt * 10), 0.1 * Math.exp(-a * 14));
    }
  }

  /** The rake: the strokes in the air, the enemies inside the cone on their live positions, fur and sparks. */
  private swing() {
    const ctx = this.ctx;
    // The strokes sit in the middle of the cone, at chest height, a touch bigger than the reach so they read.
    this.v1.copy(this.from).addScaledVector(this.fwd, SCRATCH_RANGE * 0.55).setY(1.15);
    this.claws.fire(this.v1, Math.atan2(this.fwd.x, this.fwd.z), 0.95);
    this.specks.burst(this.v1, 9, 3.6, 0.55, [CAT.foil, CAT.body, CAT.core], 0.09, 0.8, 7);
    if (this.count++ % 3 === 0) this.word.show(WORDS[Math.floor(this.count / 3) % WORDS.length], this.v1.clone().setY(2.3), 1.0, 0.9);
    if (!ctx) return;
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.cone, p.x, p.z)) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 2, from: ctx.from, color: CAT_CSS.body });
      this.specks.burst(this.v1.set(p.x, 1.1, p.z), 6, 3, 0.45, [CAT.body, CAT.core], 0.08, 1, 8);
    }
  }
}

export const scratchModule: EffectModule = {
  label: 'scratch',
  category: 'hero: cat',
  // Quick, no aim: the cone is centred on him and the radius is the reach the CPU uses it at.
  targeting: { mode: 'self', radius: SCRATCH_RANGE },
  create: () => new Scratch(),
  telegraphs(effect) {
    const e = effect as Scratch;
    return e.ctx ? [{ shape: e.cone, start: 0, impact: HIT_T }] : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Scratch;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as Scratch).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
