import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { CAT, CAT_CSS, CatWord, Claws, LandingMark, Pot, Specks } from '../../effects/parts/cat';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { POT_DAMAGE, POT_DELAY, POT_RADIUS, POT_RANGE, POT_STUN, nearestCover } from '../../traits/cat';

/**
 * Knock It Over (cat kit v5, W: a pot from a ledge; label 'knock it over'). Sir Whiskers looks for cover within 4 m of him
 * (`ctx.obstacles()`, the surface of a pillar or a wall) and bats a clay pot off its top. The pot rocks on the ledge for 0.2 s, a
 * small claw swipe goes at it, then it tips off and falls along an arc, tumbling and wobbling, onto the spot where the enemy was aimed
 * (9 m at most, the aim clamped), shown from the cast as a dark disc with a cream rim and an amber ring closing on it. At 0.7 s it
 * lands: whoever stands inside the 1.5 m circle, on their live position, takes 50 and is stunned 0.5 s; the pot shatters into
 * shards, dust runs out along the floor and a CRASH word flies. With no cover in reach it does nothing: he bats at the air, MEH, no zone
 * and no hit (the CPU holds it then: `aiHold`). Both screens find the same cover and the same spot (`sentFrom`, the aim and the obstacle
 * list). Telegraph: the circle, impact 0.7 s. Clean by about 2.2 s. See pipeline/designs/kit-cat.md.
 */
export interface KnockItOverSettings {
  damage: number;
  stun: number;
  loop: boolean;
}

export const defaultKnockItOver = (): KnockItOverSettings => ({ damage: POT_DAMAGE, stun: POT_STUN, loop: false });

const TIP_T = 0.2;
const DURATION = 2.2;
const BAT_Y = 0.9;

export class KnockItOver implements Effect {
  readonly group = new THREE.Group();
  readonly settings: KnockItOverSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The pot's circle, or null with no cover in reach. */
  zone: TelegraphShape | null = null;
  private spot = new THREE.Vector3();
  private perch = new THREE.Vector3();
  private from = new THREE.Vector3();
  private covered = false;
  private time = 0;
  private tipped = false;
  private landed = false;

  private pot = new Pot(16);
  private mark = new LandingMark();
  private claws = new Claws();
  private specks = new Specks(50);
  private word = new CatWord(2);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: CAT.clay, core: CAT.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();

  constructor(settings: KnockItOverSettings = defaultKnockItOver()) {
    this.settings = settings;
    this.group.add(this.mark.mesh, this.pot.mesh, this.claws.mesh, this.specks.mesh, this.word.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return POT_DELAY;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const s = ctx.sentFrom ?? ctx.from;
    this.from.set(s.x, 0, s.z);
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= l; dz /= l; }
    const reach = Math.min(Math.max(l, 0), POT_RANGE);
    this.spot.set(s.x + dx * reach, 0, s.z + dz * reach);
    const cover = nearestCover(s.x, s.z, ctx.obstacles?.() ?? []);
    this.covered = !!cover;
    if (cover) {
      this.perch.set(cover.x, cover.height, cover.z);
      this.zone = { kind: 'circle', x: this.spot.x, z: this.spot.z, radius: POT_RADIUS };
    } else {
      this.zone = null;
      this.perch.set(s.x + dx * 1.2, BAT_Y, s.z + dz * 1.2);
    }
  }

  play() {
    this.reset();
    this.playing = true;
    if (this.covered) this.pot.perch(this.perch);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.tipped = this.landed = false;
    this.pot.reset();
    this.mark.hide();
    this.claws.reset();
    this.specks.reset();
    this.word.reset();
    this.pop.set(this.spot, 0, 0);
    this.shock.set(this.spot, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.pot.update(dt);
    this.claws.update(dt);
    this.specks.update(dt);
    this.word.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    if (t >= DURATION && !this.pot.busy && !this.specks.busy && !this.word.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- No cover: he bats at the air and nothing falls. ---
    if (!this.covered) {
      if (!this.tipped && t >= TIP_T) {
        this.tipped = true;
        this.claws.fire(this.perch, Math.atan2(this.spot.x - this.from.x, this.spot.z - this.from.z), 0.6);
        this.word.show('MEH.', this.v1.copy(this.perch).setY(2.2), 0.9, 1.0);
      }
      return;
    }

    // --- The shadow draws on from the cast and closes on the landing. ---
    if (!this.landed) this.mark.set(this.spot, POT_RADIUS, t / POT_DELAY);

    // --- 0.2 He bats it: a swipe at the pot, and it tips off. ---
    if (!this.tipped && t >= TIP_T) {
      this.tipped = true;
      this.claws.fire(this.perch, Math.atan2(this.spot.x - this.perch.x, this.spot.z - this.perch.z), 0.55);
      this.pot.launch(this.v1.set(this.spot.x, 0.35, this.spot.z), POT_DELAY - TIP_T, 2.2);
      this.specks.burst(this.perch, 5, 2.2, 0.4, [CAT.clay, CAT.foil], 0.07, 1, 7);
    }

    // --- 0.7 It lands: the live positions decide the hit. ---
    if (!this.landed && t >= POT_DELAY) {
      this.landed = true;
      this.land();
    }
    if (this.landed) {
      const a = t - POT_DELAY;
      const sp = StarBurst.pop(a, 0, 0.03);
      this.v1.set(this.spot.x, 0.9, this.spot.z);
      this.pop.set(this.v1, 1.1 * sp.scale, sp.opacity, 0.2);
      const g = Math.min(1, a / 0.4);
      this.shock.set(this.v1.set(this.spot.x, 0, this.spot.z), 0.4 + 2.4 * g, 0.04 * (1 - g) * (1 - g));
      this.shake = Math.max(this.shake * Math.exp(-dt * 10), 0.28 * Math.exp(-a * 9));
    }
  }

  private land() {
    const ctx = this.ctx, s = this.settings;
    this.mark.hide();
    this.pot.smash(this.v1.set(this.spot.x, 0.1, this.spot.z));
    this.specks.ring(this.v1.set(this.spot.x, 0.15, this.spot.z), 14, 4.5, 0.7, [CAT.foil, CAT.clay, CAT.body], 0.14);
    this.word.show('CRASH', this.v1.set(this.spot.x, 2.2, this.spot.z), 1.3, 1.1);
    if (!ctx) return;
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      if (!insideTelegraph(this.zone as TelegraphShape, p.x, p.z)) continue;
      ctx.hit(e, { damage: s.damage, knock: 2, from: this.v1.set(this.spot.x, 0, this.spot.z), color: CAT_CSS.clay, status: { kind: 'stun', seconds: s.stun } });
    }
  }
}

export const knockItOverModule: EffectModule = {
  label: 'knock it over',
  category: 'hero: cat',
  targeting: { mode: 'ground', radius: POT_RADIUS },
  create: () => new KnockItOver(),
  telegraphs(effect) {
    const e = effect as KnockItOver;
    return e.ctx && e.zone ? [{ shape: e.zone, start: 0, impact: POT_DELAY }] : [];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as KnockItOver;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as KnockItOver).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'stun', 0, 1.5, 0.1);
  },
};
