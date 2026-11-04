import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Droplets, SplashCrown, TIDE, TIDE_CSS, TideCurrent, TideRing, WaterPool, WaterRibbon } from '../../effects/parts/tide';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { MIST_SECONDS, tideNow } from '../../traits/tide';

/**
 * Mist Form (tide kit, E: a water dash, `dash` and `parry` flags). Marin turns to water and flows up to 6 m toward the
 * aimed spot (`ctx.moveCaster`, 0.25 s), through the enemy if it is in the way (heroes do not collide). She is untouchable
 * for the whole run (`MIST_SECONDS`, 0.25 s: the trait's `taken` swallows every hit until the deadline `afterCast` set; the
 * trait also flips the tide when she reforms). A translucent shell and three ribbons follow her; at 0.25 s she reforms at the end
 * spot in a foam crown that splashes 40 damage within 3 m. The splash is gated by a live telegraph circle at the end spot
 * and by `projectile` with a live distance check against that spot, so it lands on whoever stays inside. The tide shows in
 * the look: High is pale with outward foam streaks, Low is deep blue with inward streaks. In a network duel the replay has
 * no `moveCaster`, so the end spot comes from `sentFrom` and `point` only. See pipeline/designs/kit-tide.md.
 */
export interface MistFormSettings {
  loop: boolean;
}

export const defaultMistForm = (): MistFormSettings => ({ loop: false });

// Timeline (seconds).
const MIST_IN = 0.12; // the shell forms
const REFORM_T = MIST_SECONDS; // she reforms: the end of the run and of the untouchable window
const DURATION = REFORM_T + 0.9;

const DASH_RANGE = 6;
const DASH_S = MIST_SECONDS; // the run lasts exactly the untouchable window
const RIBBONS = 3;
const SPLASH_R = 3; // the reform splash, at the end spot
const SPLASH_DAMAGE = 40;

export class MistForm implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MistFormSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private high = true;
  private flags = { start: false, reform: false };
  /** Where she reforms: from sentFrom and point only, or the spot `moveCaster` really reached. */
  readonly end = new THREE.Vector3();
  private wakeAcc = 0;
  private centre = new THREE.Vector3();

  // Parts.
  private ring = new TideRing();
  private current = new TideCurrent(18);
  private shell: THREE.Mesh;
  private shellMat = new THREE.MeshBasicMaterial({
    color: TIDE.body, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  private ribbons = Array.from({ length: RIBBONS }, () => new WaterRibbon(26, 8, 8));
  private drops = new Droplets(40);
  private crown = new SplashCrown();
  private pool = new WaterPool();
  private pop = new StarBurst({ points: 10, inner: 0.3, color: TIDE.accent, core: 0xfff2e8, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: MistFormSettings = defaultMistForm()) {
    this.settings = settings;
    this.screen.impactColor.set(TIDE.hot);
    this.screen.tint.set(TIDE.dark);
    const sg = new THREE.CylinderGeometry(0.64, 0.5, 1.9, 22, 1, true);
    this.shell = new THREE.Mesh(sg, this.shellMat);
    this.shell.visible = false;
    this.ribbons.forEach((r) => { r.shed = 8; r.drops.splash = false; });
    this.group.add(
      this.pool.mesh, this.ring.mesh, this.current.mesh, this.shell, ...this.ribbons.map((r) => r.mesh), this.crown.mesh,
      this.drops.mesh, this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return REFORM_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.centre.copy(ctx.from).setY(0);
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.3) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = 0.3; } else { dx /= len; dz /= len; }
    len = Math.min(len, DASH_RANGE);
    this.end.set(s.x + dx * len, 0, s.z + dz * len);
    this.high = tideNow(ctx.caster).high;
    this.screen.silhouettes = [ctx.caster.group];
    this.screen.focus.copy(this.centre).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.wakeAcc = 0;
    this.flags.start = this.flags.reform = false;
    clearScreenFx(this.screen);
    this.ring.hide();
    this.current.hide();
    this.shell.visible = false;
    this.shellMat.opacity = 0;
    for (const r of this.ribbons) { r.reset(); r.hide(); }
    this.drops.reset();
    this.crown.reset();
    this.pool.reset();
    this.pop.set(this.centre, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    for (const r of this.ribbons) r.update(dt);
    this.drops.update(dt);
    this.crown.update(dt);
    this.pool.update(dt);
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
    if (ctx) {
      this.centre.copy(ctx.caster.group.position).setY(0);
      this.high = tideNow(ctx.caster).high;
    }

    if (!f.start) {
      f.start = true;
      // She flows to the end spot (nothing on the other screen: the hero streams in as moves).
      const reached = ctx?.moveCaster?.(this.v1.copy(this.end), DASH_S);
      if (reached) this.end.set(reached.x, 0, reached.z);
      // She dissolves: a small crown at her feet and a spray up.
      this.crown.burst(this.centre, 0.9);
      this.drops.spray(this.v1.copy(this.centre).setY(0.6), this.v2.set(0, 1, 0), 10, 4.5);
      this.pool.spread(this.centre, 1.4, 0.2);
      this.shake = 0.08;
    }
    if (!f.reform && t >= REFORM_T) {
      f.reform = true;
      this.crown.burst(this.end, this.high ? 1.5 : 1.15);
      this.drops.spray(this.v1.copy(this.centre).setY(0.9), this.v2.set(0, 1, 0), 18, this.high ? 7 : 5);
      this.pool.ripple(this.centre);
      this.shake = 0.22;
      // The splash: whoever stands within reach of where she reforms is hit (live distance; `projectile` skips the
      // duel's zone filter, so this check is the dodge).
      if (ctx) {
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.end.x, p.z - this.end.z) > SPLASH_R) continue;
          ctx.hit(e, { damage: SPLASH_DAMAGE, knock: 0, from: this.end.clone(), color: TIDE_CSS.body, projectile: true });
        }
      }
    }
    // A wake of ripples behind her while she runs as water.
    if (!f.reform) {
      this.wakeAcc += dt;
      if (this.wakeAcc >= 0.11) {
        this.wakeAcc = 0;
        this.pool.ripple(this.centre);
        this.drops.drop(this.v1.copy(this.centre).setY(0.3), this.v2.set((Math.random() - 0.5) * 1.5, 1.6, (Math.random() - 0.5) * 1.5), 0.45, 0.1);
      }
    }
    this.layout();
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const c = this.centre;
    const after = f.reform ? t - REFORM_T : -1;
    const mist = smoothstep(t / MIST_IN) * (f.reform ? 1 - smoothstep(after / 0.18) : 1);

    this.screen.darken = 0.1 * smoothstep(t / 0.2) * (1 - smoothstep((t - 1.1) / 0.5));
    this.screen.impact = f.reform ? impactFrameAt(t, REFORM_T, [1], 0.03) : 0;

    // --- The tide ring and the current: foam streaks out at High tide, blue streaks drawing in at Low tide. ---
    const ro = smoothstep(t / 0.15) * (1 - smoothstep((t - REFORM_T - 0.2) / 0.5));
    this.ring.set(c, this.high, ro, t, 1.3);
    const cs = f.reform ? 1 - smoothstep(after / 0.5) : smoothstep(t / 0.25);
    this.current.set(c, 0.5, 2.4, !this.high, 0.75 * cs, t, 1.2, 0.8);

    // --- The water shell and the ribbons spiralling round her (they follow her: she is running). ---
    this.shell.visible = mist > 0.02;
    if (this.shell.visible) {
      this.shell.position.set(c.x, 0.95, c.z);
      this.shell.scale.set(1 + 0.05 * Math.sin(t * 20), 1, 1 + 0.05 * Math.sin(t * 20 + 1));
      this.shellMat.color.setHex(this.high ? TIDE.hot : TIDE.body);
      this.shellMat.opacity = (0.3 + 0.08 * Math.sin(t * 16)) * mist;
    }
    this.ribbons.forEach((r, i) => {
      if (mist < 0.02) { r.hide(); return; }
      const ph = (i / RIBBONS) * Math.PI * 2;
      const rise = f.reform ? 1 - smoothstep(after / 0.2) : 1;
      r.setFunction((u, out) => {
        const a = ph + t * 7 + u * Math.PI * 2.2;
        const rad = 0.62 + 0.1 * Math.sin(u * 6 + t * 5) + (f.reform ? after * 1.5 : 0);
        return out.set(c.x + Math.cos(a) * rad, 0.1 + u * 1.75 * rise, c.z + Math.sin(a) * rad);
      }, 0.2 * mist, mist, 0, t);
    });

    // --- The reform: a burst at her feet. ---
    if (f.reform) {
      const sp = StarBurst.pop(after, 0, 0.03);
      this.pop.set(this.v1.copy(c).setY(1.1), 1.2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.groundShock.set(c, 0.4 + 2.4 * gp, 0.03 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.22 * Math.exp(-after * 10));
    }
  }
}

export const mistFormModule: EffectModule = {
  label: 'mist form',
  category: 'hero: tide',
  // A ground dash: `radius` brings the enemies round the end spot into `ctx.targets` (the splash is 3 m).
  targeting: { mode: 'ground', radius: SPLASH_R },
  create: () => new MistForm(),
  telegraphs(effect) {
    const e = effect as MistForm;
    if (!e.ctx) return [];
    // The splash circle at the end spot, counting down to the reform.
    return [{ shape: { kind: 'circle', x: e.end.x, z: e.end.z, radius: SPLASH_R }, start: 0.1, impact: REFORM_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as MistForm;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    f.add((effect as MistForm).settings, 'loop');
  },
};
