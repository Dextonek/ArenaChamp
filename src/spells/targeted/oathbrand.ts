import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, HaloRing, LightBeams, LightPanels, Sigil, SunEmblems, dawnOrient, dawnPanelNormal, dawnView,
} from '../../effects/parts/dawn';
import { stillSees } from '../../effects/channel';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { BRAND_SECONDS } from '../../traits/dawn';

/**
 * Oathbrand (dawn kit v5, E: a targeted beam with a wind-up). A click on the enemy (7 m, sight checked by the engine at the
 * cast). For 0.5 s (`FALL`) a pale thread of light hangs over the enemy and a gold ring closes on its feet, both following it
 * live, while a sun disc swells over Auriel's head; the red circle from `telegraphs` shows on the enemy. At 0.5 s the spell checks
 * `stillSees` (cover cancels it: a fizzle, a puff of shards, no hit). Otherwise a beam of hard light falls on the enemy's
 * live position: 50 (`projectile: true`, judged live, so walking does not dodge it; cover does), a sun-wheel flash, a ring, a
 * star, shards thrown up. The hit brands the enemy for 2.5 s: the trait (`src/traits/dawn.ts`, `dealt` slot 2) puts the stack on
 * it, and a shield burst that catches a branded enemy stuns it 0.8 s. The effect also keeps a gold sun disc turning over the
 * enemy's head for the brand's life. Clean 3.0 s after the cast. See pipeline/designs/kit-dawn.md.
 */
export interface OathbrandSettings {
  damage: number;
  loop: boolean;
}

export const defaultOathbrand = (): OathbrandSettings => ({ damage: 44, loop: false });

// Timeline (seconds).
const FALL = 0.5; // the beam lands, and the sight check
const MARK_R = 1.2; // the red circle on the enemy
const FIZZLE_END = FALL + 0.5;
const DURATION = FALL + BRAND_SECONDS + 0.1;
const SPARKS = 8;
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

export class Oathbrand implements Effect {
  readonly group = new THREE.Group();
  readonly settings: OathbrandSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private target: Enemy | null = null;
  private time = 0;
  private checked = false;
  private fizzled = false;
  private landed = false;
  private foe = new THREE.Vector3();
  private head = new THREE.Vector3();
  private view = new THREE.Vector3(0, 0.45, 0.9);
  private flat = new THREE.Vector3(0, 0, 1);
  private side = new THREE.Vector3(1, 0, 0);

  // Parts.
  private beams = new LightBeams(2);
  private thread = new LightBeams(1);
  private emblems = new SunEmblems(2);
  private halo = new HaloRing();
  private sigil = new Sigil();
  private panels = new LightPanels(SPARKS, 6);
  private star = new StarBurst({ points: 10, inner: 0.3, color: DAWN.accent, core: DAWN.accent, additive: false });
  private flare = new StarBurst({ points: 12, inner: 0.25, color: DAWN.hot, core: DAWN.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();

  constructor(settings: OathbrandSettings = defaultOathbrand()) {
    this.settings = settings;
    this.screen.tint.set(DAWN.dark);
    this.screen.impactColor.set(DAWN.foil);
    this.group.add(
      this.sigil.mesh, this.panels.mesh, this.beams.mesh, this.thread.mesh, this.emblems.mesh, this.halo.mesh, this.star.mesh, this.flare.mesh,
      this.shock.mesh,
    );
    this.reset();
  }

  get duration() {
    return this.fizzled ? FIZZLE_END : DURATION;
  }

  get impactTime() {
    return FALL;
  }

  /** The enemy's live feet, for the red circle. */
  get markAt() {
    return this.foe;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    this.foe.copy(this.target ? this.target.group.position : ctx.point).setY(0);
    dawnView(ctx.aim, this.view);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.foe).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
    this.layout(0);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.checked = this.fizzled = this.landed = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(DAWN.foil);
    this.panels.reset();
    this.beams.reset();
    this.thread.reset();
    this.emblems.reset();
    this.halo.reset();
    this.sigil.reset();
    this.star.set(this.foe, 1e-3, 0);
    this.flare.set(this.foe, 1e-3, 0);
    this.shock.set(this.foe, 0, 0);
  }

  /** The enemy's live feet (it walks while the beam gathers). */
  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
    this.head.set(this.foe.x, 2.9, this.foe.z);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= (this.fizzled ? FIZZLE_END : DURATION)) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    this.liveFoe();
    if (!this.checked && this.time >= FALL) {
      this.checked = true;
      if (this.check()) this.fizzle();
      else this.land();
    }
    this.layout(dt);
    this.panels.update(dt);
    this.shake *= Math.exp(-dt * 11);
  }

  /** True when the wind-up ends without sight of the enemy: the spell fizzles. */
  private check() {
    const ctx = this.ctx;
    if (!ctx || !this.target) return false;
    return !stillSees(ctx, this.target.group.position);
  }

  /** Cover broke the oath: a puff of shards on the enemy, no hit. */
  private fizzle() {
    this.fizzled = true;
    for (let k = 0; k < SPARKS; k++) {
      const a = (k / SPARKS) * Math.PI * 2;
      this.v1.set(this.foe.x, 1.3, this.foe.z);
      this.v2.set(Math.sin(a), 0, Math.cos(a));
      dawnOrient(this.v2, UP, this.q1);
      this.panels.place(k, this.v1, this.q1, 0.6, 'shard', 1, k % 2 ? DAWN.hot : DAWN.foil);
      this.panels.fling(k, this.v2.multiplyScalar(2.5).setY(2), 0.5, 6);
    }
    this.shake = 0.05;
  }

  /** The beam falls on the enemy's live position: the hit, and the shards thrown up. */
  private land() {
    const ctx = this.ctx;
    this.landed = true;
    this.shake = 0.3;
    this.screen.focus.copy(this.foe).setY(1.2);
    for (let k = 0; k < SPARKS; k++) {
      const a = (k / SPARKS) * Math.PI * 2 + 0.4;
      this.v1.set(this.foe.x, 0.6, this.foe.z);
      this.v2.set(Math.sin(a), 0, Math.cos(a));
      dawnOrient(this.v2, UP, this.q1);
      this.panels.place(k, this.v1, this.q1, 0.8, 'shard', 1.1, k % 2 ? DAWN.hot : DAWN.body);
      this.panels.fling(k, this.v2.multiplyScalar(3 + (k % 3)).setY(5 + (k % 2) * 2), 0.8, 8);
    }
    if (!ctx || !this.target) return;
    // `projectile: true`: judged on the live position, so walking away does not dodge it (cover did, at the check above).
    ctx.hit(this.target, { damage: this.settings.damage, knock: 1.5, from: ctx.from, color: DAWN_CSS.body, projectile: true });
  }

  private layout(dt: number) {
    const t = this.time;
    const ctx = this.ctx;
    this.flat.set(this.view.x, 0, this.view.z).normalize();

    // --- 0..0.5 The oath: a pale thread over the enemy, a gold ring closing on its feet, a sun disc swelling over her head. ---
    if (t < FALL) {
      const k = smoothstep(t / FALL);
      this.thread.opacity = 0.35 + 0.65 * k;
      this.thread.bright = 1.2 + 1.3 * k;
      this.thread.set(0, this.v1.set(this.foe.x, 5.5, this.foe.z), UP, this.flat, 11, 0.07 + 0.1 * k);
      this.halo.set(this.v1.set(this.foe.x, 0.08, this.foe.z), UP, 2.1 - 1.0 * k);
      this.halo.opacity = 0.55 + 0.4 * k;
      this.halo.spin(dt);
      if (ctx) {
        const c = ctx.caster.group.position;
        this.v1.set(c.x, 2.95, c.z);
        dawnOrient(this.view, UP, this.q1);
        this.q1.multiply(this.q2.setFromAxisAngle(Z, t * 6));
        this.emblems.set(0, this.v1, this.q1, 0.4 + 0.9 * k);
      }
    } else {
      this.thread.hide(0);
      this.emblems.hide(0);
    }
    if (this.fizzled) {
      const a = t - FALL;
      this.halo.opacity = 0.7 * (1 - smoothstep(a / 0.3));
      this.halo.spin(dt);
      return;
    }
    if (!this.landed) return;

    // --- The beam falls: a hard-light column from above, a sun-wheel flash, a ring, a star. ---
    const a = t - FALL;
    const fall = 1 - Math.pow(1 - THREE.MathUtils.clamp(a / 0.1, 0, 1), 3);
    const fade = 1 - smoothstep((a - 0.1) / 0.4);
    this.beams.opacity = fade;
    this.beams.bright = 2.4;
    this.v1.set(this.foe.x, 4.6 + 8 * (1 - fall), this.foe.z);
    this.beams.set(0, this.v1, UP, this.flat, 9.4, 0.55 * fade + 0.05);
    this.v2.set(this.foe.x, 1.0, this.foe.z);
    dawnPanelNormal(UP, this.view, this.v3);
    this.beams.set(1, this.v2, this.side.copy(this.flat).cross(UP).normalize(), this.v3, 2.4 + 1.6 * smoothstep(a / 0.15), 0.18 * fade + 0.01);
    this.sigil.set(this.foe, 2.0);
    this.sigil.hide = 0.15;
    this.sigil.reveal = 1;
    this.sigil.opacity = 1 - smoothstep(a / 0.6);
    this.halo.set(this.v1.set(this.foe.x, 0.09, this.foe.z), UP, 1.0 + 1.6 * smoothstep(a / 0.3));
    this.halo.opacity = 0.9 * (1 - smoothstep((a - 0.2) / 0.4));
    this.halo.spin(dt);
    const gp = THREE.MathUtils.clamp(a / 0.3, 0, 1);
    this.shock.set(this.v1.set(this.foe.x, 0, this.foe.z), 0.5 + 2.6 * gp, 0.04 * (1 - gp) * (1 - gp));
    const sp = StarBurst.pop(a, 0, 0.05);
    this.star.set(this.v1.set(this.foe.x, 1.2, this.foe.z), 1.0 * sp.scale + 1e-3, sp.opacity, 0.2);
    this.flare.set(this.v1.set(this.foe.x, 2.2, this.foe.z), 1.4 * sp.scale + 1e-3, sp.opacity, 0.5);

    // --- The brand: a gold sun disc turns over the enemy's head and shrinks away with the brand's last half second. ---
    const brandLeft = BRAND_SECONDS - a;
    const bk = smoothstep(a / 0.2) * (brandLeft < 0.5 ? Math.max(0, brandLeft / 0.5) : 1);
    this.v1.copy(this.head);
    this.v1.y += 0.1 * Math.sin(t * 4);
    dawnOrient(this.view, UP, this.q1);
    this.q1.multiply(this.q2.setFromAxisAngle(Z, -t * 1.6));
    this.emblems.set(1, this.v1, this.q1, 0.8 * bk + 1e-3);
  }
}

export const oathbrandModule: EffectModule = {
  label: 'oathbrand',
  category: 'hero: dawn',
  // Click an enemy: after the 0.5 s fall the spell checks sight, then the hit always lands (`projectile`).
  targeting: { mode: 'enemy' },
  create: () => new Oathbrand(),
  telegraphs(effect) {
    const e = effect as Oathbrand;
    if (!e.ctx) return [];
    // The mark on the enemy for the fall, read live.
    return [{ shape: { kind: 'circle', x: e.markAt.x, z: e.markAt.z, radius: MARK_R }, start: 0, impact: FALL }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as Oathbrand;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Oathbrand).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 120, 1);
  },
};
