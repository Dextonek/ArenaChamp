import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, HaloRing, LightPanels, Sigil, SunEmblems, SunRays, dawnEaseOutBack, dawnOrient, dawnShieldRing, dawnView,
} from '../../effects/parts/dawn';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { W_BURST, W_BURST_RADIUS, W_SHIELD_SECONDS, aurielShields, burstHit, type AurielShield } from '../../traits/dawn';

/**
 * Dawnward (dawn kit v5, W: a self shield that bursts). Six kite shields of hard light fly in and click into a ring round
 * Auriel (0.35 s) and turn slowly round her, a gold sun-wheel sigil under her feet and a sun disc behind her; the whole thing
 * follows her. The shield itself (70 for 3 s, her basic attacks reaching 3 m farther meanwhile, recast Pop) is the trait's
 * (`src/traits/dawn.ts`): this effect draws it and watches the trait's `aurielShields` record. The moment the record says the
 * shield is gone (broken, run out at 3 s, or popped) the ring shatters and a 3 m burst goes off at her LIVE position:
 * 42 damage to every enemy inside it on its live position (`projectile: true`; no telegraph can show it, so the ring flash is
 * the warning and the enemy has the 3 s the shield lasted to see it coming). A branded enemy caught in it is stunned 0.8 s
 * by the trait. If a Sunrise replaces the record the ring just crumbles, no burst. The effect lives 3.2 s at least and up to
 * about 4.4 s, inside the server's window for hits after a cast. Where the trait gives no record (the VFX tool) the shield
 * ends after 3 s on its own. See pipeline/designs/kit-dawn.md.
 */
export interface DawnwardSettings {
  /** Damage of the burst. */
  damage: number;
  loop: boolean;
}

export const defaultDawnward = (): DawnwardSettings => ({ damage: W_BURST, loop: false });

// Timeline (seconds).
const ASSEMBLE = 0.35; // the ring is whole
const STANDALONE = W_SHIELD_SECONDS + 0.05; // no trait record: the shield ends here
const BURST_LIFE = 0.9; // the burst is clean this long after it goes off
const CAP = 5.2; // hard end, whatever the record says

const RING_R = 1.15;
const RING_Y = 1.05;
const SHIELDS = 6;
const SPARKS = 8;
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

export class Dawnward implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DawnwardSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private rec: AurielShield | null = null;
  private burstT = -1;
  private crumbleT = -1;
  private struck = false;
  private center = new THREE.Vector3();
  private view = new THREE.Vector3(0, 0.45, 0.9);
  private burstAt = new THREE.Vector3();

  // Parts.
  private panels = new LightPanels(SHIELDS + SPARKS, 6);
  private sigil = new Sigil();
  private halo = new HaloRing();
  private burstHalo = new HaloRing();
  private emblem = new SunEmblems(1);
  private rays = new SunRays(14, 0.5);
  private star = new StarBurst({ points: 10, inner: 0.3, color: DAWN.hot, core: DAWN.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();

  constructor(settings: DawnwardSettings = defaultDawnward()) {
    this.settings = settings;
    this.rays.normal.set(0, 1, 0);
    this.group.add(this.sigil.mesh, this.panels.mesh, this.halo.mesh, this.burstHalo.mesh, this.emblem.mesh, this.rays.mesh, this.star.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return STANDALONE + BURST_LIFE;
  }

  get impactTime() {
    return STANDALONE;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.from).setY(0);
    dawnView(ctx.aim, this.view);
  }

  play() {
    this.reset();
    this.playing = true;
    this.rec = this.current(2);
    this.layout(0);
    this.panels.assemble(ASSEMBLE, 0.2, 5);
  }

  /** The trait's record when it is a live shield of `kind`. */
  private current(kind: number): AurielShield | null {
    const r = this.ctx ? aurielShields.get(this.ctx.caster) : undefined;
    return r && r.kind === kind && !r.broke ? r : null;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.burstT = this.crumbleT = -1;
    this.struck = false;
    this.rec = null;
    this.panels.reset();
    this.sigil.reset();
    this.halo.reset();
    this.burstHalo.reset();
    this.emblem.reset();
    this.rays.reset();
    this.star.set(this.center, 1e-3, 0);
    this.shock.set(this.center, 0, 0);
  }

  private get endAt() {
    if (this.burstT >= 0) return Math.min(CAP, this.burstT + BURST_LIFE);
    if (this.crumbleT >= 0) return Math.min(CAP, this.crumbleT + 0.7);
    return CAP;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.endAt) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const c = this.ctx?.caster.group.position;
    if (c && this.burstT < 0) this.center.set(c.x, 0, c.z);
    if (this.burstT < 0 && this.crumbleT < 0) this.watch();
    this.layout(dt);
    this.panels.update(dt);
    this.shake *= Math.exp(-dt * 12);
  }

  /** The shield's end: the trait's record says broke (a later Sunrise replaces it: no burst), or the standalone timer. */
  private watch() {
    const ctx = this.ctx;
    if (!ctx) return;
    // The other screen may hear of the record a moment after the cast.
    if (!this.rec && this.time < 0.8) this.rec = this.current(2);
    if (this.rec) {
      const cur = aurielShields.get(ctx.caster);
      if (cur !== this.rec) this.crumble();
      else if (cur.broke) this.burst();
    } else if (this.time >= STANDALONE) this.burst();
  }

  /** A newer shield replaced this one: the ring falls apart without a burst. */
  private crumble() {
    this.crumbleT = this.time;
    this.panels.shatter(3, 0.6, this.center);
  }

  /** The shield is gone: the ring shatters, a ring of light runs out to 3 m and everything inside takes the hit. */
  private burst() {
    const ctx = this.ctx;
    this.burstT = this.time;
    this.burstAt.copy(this.center);
    this.shake = 0.3;
    // Throw the ring out and add a few loose shards.
    this.panels.shatter(7, 0.9, this.burstAt);
    for (let k = 0; k < SPARKS; k++) {
      const a = (k / SPARKS) * Math.PI * 2 + 0.3;
      this.v1.set(this.burstAt.x + Math.sin(a) * 0.9, 1.0, this.burstAt.z + Math.cos(a) * 0.9);
      dawnOrient(this.v2.set(Math.sin(a), 0, Math.cos(a)), UP, this.q1);
      this.panels.place(SHIELDS + k, this.v1, this.q1, 0.9, 'shard', 1.1, k % 2 ? DAWN.hot : DAWN.body);
      this.panels.fling(SHIELDS + k, this.v2.multiplyScalar(6 + (k % 3)).setY(2.5), 0.7, 8);
    }
    if (!ctx) return;
    // Everyone inside, on their live positions right now.
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.burstAt.x, p.z - this.burstAt.z) > W_BURST_RADIUS) continue;
      burstHit(ctx, e, { damage: this.settings.damage, knock: 3, from: this.burstAt.clone(), color: DAWN_CSS.body });
      this.struck = true;
    }
  }

  private layout(dt: number) {
    const t = this.time;
    const c = this.center;
    const up = this.burstT < 0 && this.crumbleT < 0;
    if (up) {
      const grow = smoothstep(t / ASSEMBLE);
      // Anticipation: in the last half second the shield shivers.
      const shiver = t > STANDALONE - 0.55 ? 0.05 * Math.sin(t * 46) : 0;
      dawnShieldRing(this.panels, 0, SHIELDS, c, RING_R + shiver, RING_Y, 1.6 * (0.4 + 0.6 * grow), t * 1.3);
      // The sun-wheel under her feet, and a plain gold ring on top of it so the shield reads from far off.
      this.sigil.set(c, 1.8);
      this.sigil.hide = 0.4;
      this.sigil.reveal = grow;
      this.sigil.opacity = 0.6;
      this.halo.set(this.v1.set(c.x, 0.07, c.z), UP, 1.45);
      this.halo.opacity = 0.75 * grow;
      this.halo.spin(dt);
      // The sun disc behind her, facing the camera.
      this.v1.set(c.x, 1.35, c.z).addScaledVector(this.view, -0.8);
      dawnOrient(this.view, UP, this.q1);
      this.q1.multiply(this.q2.setFromAxisAngle(Z, t * 0.5));
      this.emblem.opacity = 0.9;
      this.emblem.set(0, this.v1, this.q1, 1.9 * dawnEaseOutBack(t / 0.45));
      return;
    }
    // After the end: the emblem and the sigil go out, the burst ring runs.
    this.emblem.hide(0);
    this.halo.opacity = 0;
    const a = t - (this.burstT >= 0 ? this.burstT : this.crumbleT);
    this.sigil.opacity = 0.6 * (1 - smoothstep(a / 0.3));
    if (this.burstT < 0) return;
    const k = THREE.MathUtils.clamp(a / 0.3, 0, 1);
    const grow = 1 - Math.pow(1 - k, 3);
    this.sigil.set(this.burstAt, W_BURST_RADIUS);
    this.sigil.hide = 0;
    this.sigil.reveal = 1;
    this.sigil.opacity = 0.85 * (1 - smoothstep(a / 0.55));
    this.burstHalo.set(this.v1.set(this.burstAt.x, 0.09, this.burstAt.z), UP, 0.5 + (W_BURST_RADIUS - 0.5) * grow);
    this.burstHalo.opacity = 0.95 * (1 - smoothstep((a - 0.2) / 0.4));
    this.burstHalo.spin(dt);
    this.shock.set(this.v1.set(this.burstAt.x, 0, this.burstAt.z), 0.5 + 3 * grow, 0.04 * (1 - k) * (1 - k));
    const sp = StarBurst.pop(a, 0, 0.05);
    this.star.set(this.v1.set(this.burstAt.x, 1.2, this.burstAt.z), 1.4 * sp.scale + 1e-3, sp.opacity, 0.2);
    // Rays run out along the floor.
    this.rays.normal.set(0, 1, 0);
    this.rays.fan(this.v1.set(this.burstAt.x, 0.12, this.burstAt.z), this.v2.set(0, 0, 1), 14, W_BURST_RADIUS * 1.05, Math.PI, smoothstep(a / 0.18), 0.4);
    this.rays.fade(1 - smoothstep((a - 0.1) / 0.35));
    this.shake = Math.max(this.shake, this.struck ? 0.2 * Math.exp(-a * 10) : 0);
  }
}

export const dawnwardModule: EffectModule = {
  label: 'dawnward',
  category: 'hero: dawn',
  // Centred on Auriel. The radius is large on purpose: `targets` is frozen at the cast, and the burst comes seconds later,
  // so every enemy that might stand near her then must be in it. The duel AI is held back by the trait's `aiHold` (6.5 m).
  targeting: { mode: 'self', radius: 30 },
  create: () => new Dawnward(),
  // No zone: the burst is made where she stands when the shield ends (`projectile: true`); the ring flash is the warning.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as Dawnward;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Dawnward).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 120, 1);
  },
};
