import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { CLOCKWORK, CLOCKWORK_CSS, Gear, MagCoil, Rivet, SiegePlates, Sparks, SteamPuffs } from '../../effects/parts/clockwork';
import { ChannelBar, channelBroken, stillSees } from '../../effects/channel';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SIEGE_SECONDS, siegeOf } from '../../traits/clockwork';

/**
 * Siege Mode (clockwork kit, R: a 6 s channel, recast "Pack up"). She braces: four steel plates slam onto the ground round
 * her one after another (the impact frame is the last slam, 0.4 s) and are pinned to a brass collar at her waist by copper
 * braces, steel stakes sink in beside them, a big ring gear unfolds flat under her and a ring on the ground empties as the
 * channel runs (`ChannelBar`). Nothing moves once it is down, so the other player reads at once that she cannot walk.
 * The trait does the rules (`afterCast`: `t.hold(6)`, +20% armour, the record `siegeOf(caster)` goes live; and `unitRate`
 * makes her turrets within 8 m fire twice as fast, with the 8 m ring on her feet). This effect owns the heavy rounds:
 * every 0.8 s (`EVERY`, the first at 0.8 s) it picks the nearest of the cast's targets within 9 m (`REACH`) that she
 * still sees (`stillSees`) and a heavy shell (the big rivet) flies from the cannon on her shoulder (the magnetic coil)
 * to it, 0.25 s, homing on the live position. It lands for 30, `projectile: true` (the hit passes the duel's zone filter,
 * which is why it works for 6 s after the cast: the server allows a projectile hit up to 12 s after a cast), and only if she
 * still sees the target at the landing: stepping behind cover or a pillar catches a shell in the air. Past 9 m nothing fires.
 * It ends in three ways, all through the one record: the clock (6 s); Pack up, which clears `siegeOf(caster).live` on her
 * client (`recastAct`) and on the other screen (the `siege` show, `ownChanged`); and a stun or silence
 * (`channelBroken`, the status the effect reads on both screens, then `ctx.releaseCaster`). Whichever comes first, the
 * plates fold away in 0.5 s and the shells stop. The 4.2 s limit some older comments mention does not apply here.
 * `targeting.radius` is 25 (wider than the duel ring) so that every enemy is in `ctx.targets`; the 9 m is judged here.
 * Network duels: `moveCaster` and the root are her client's; the shells fly and hit on both screens' effects, where
 * `ctx.hit` decides only where the target is (the victim's screen). See pipeline/designs/kit-clockwork.md.
 */
export interface SiegeModeSettings {
  damage: number;
  loop: boolean;
}

export const defaultSiegeMode = (): SiegeModeSettings => ({ damage: 26, loop: false });

// Timeline (seconds).
const DEPLOY_T = 0.5; // the plates are down
const EVERY = 0.8;
const REACH = 9;
const FLIGHT = 0.25;
const FOLD_T = 0.5;
const RADIUS = 25;
const MAX_SHELLS = 2;

interface Shell { live: boolean; age: number; from: THREE.Vector3; target: Enemy | null }

export class SiegeMode implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SiegeModeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private endT = -1; // when it ended (the plates fold from here)
  private slammed = false;
  private nextShot = EVERY;
  private popAt = -1;
  private popPos = new THREE.Vector3();
  private shells: Shell[] = Array.from({ length: MAX_SHELLS }, () => ({ live: false, age: 0, from: new THREE.Vector3(), target: null }));
  private aim = new THREE.Vector3(0, 0, 1);
  private flash = 0;
  private steamT = 0;
  private centre = new THREE.Vector3();

  private plates = new SiegePlates();
  private ringGear = new Gear(2);
  private bar = new ChannelBar(CLOCKWORK.accent, 1.55);
  private coil = new MagCoil();
  private rivets = Array.from({ length: MAX_SHELLS }, () => new Rivet());
  private sparks = new Sparks(48);
  private steam = new SteamPuffs(36);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: CLOCKWORK.hot, core: CLOCKWORK.core, additive: false });
  private muzzle = new StarBurst({ points: 6, inner: 0.25, jitter: 0, color: CLOCKWORK.accent, core: CLOCKWORK.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: SiegeModeSettings = defaultSiegeMode()) {
    this.settings = settings;
    this.screen.impactColor.set(CLOCKWORK.hot);
    this.screen.tint.set(CLOCKWORK.dark);
    for (const r of this.rivets) r.mesh.scale.setScalar(3.2);
    this.group.add(
      this.plates.mesh, this.ringGear.mesh, this.bar.mesh, this.coil.mesh, ...this.rivets.map((r) => r.mesh), this.sparks.mesh, this.steam.mesh,
      this.pop.mesh, this.muzzle.mesh, this.shock.mesh,
    );
    this.reset();
  }

  get duration() {
    return SIEGE_SECONDS + FOLD_T + 0.2;
  }

  get impactTime() {
    return DEPLOY_T - 0.1;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.centre.copy(ctx.from).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centre).setY(1.2);
    this.aim.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
  }

  play() {
    this.reset();
    this.playing = true;
    // The trait has opened the record already (both screens); a bare effect (the VFX tool) opens it itself.
    if (this.ctx) siegeOf(this.ctx.caster).live = true;
  }

  private reset() {
    this.time = 0;
    this.endT = -1;
    this.slammed = false;
    this.nextShot = EVERY;
    this.popAt = -1;
    this.flash = 0;
    this.steamT = 0;
    this.shake = 0;
    for (const s of this.shells) { s.live = false; s.target = null; }
    for (const r of this.rivets) r.reset();
    clearScreenFx(this.screen);
    this.plates.reset();
    this.ringGear.reset();
    this.bar.set(this.centre, 0);
    this.coil.reset();
    this.sparks.reset();
    this.steam.reset();
    this.pop.set(this.centre, 0, 0);
    this.muzzle.set(this.centre, 0, 0);
    this.shock.set(this.centre, 0, 0);
  }

  /** The nearest of the cast's targets within REACH that she still sees, or null. */
  private pick(ctx: CastContext, from: THREE.Vector3): Enemy | null {
    let best: Enemy | null = null, bd = REACH;
    for (const e of ctx.targets) {
      const p = e.group.position;
      const d = Math.hypot(p.x - from.x, p.z - from.z);
      if (d > bd || !stillSees(ctx, this.v3.set(p.x, 0, p.z))) continue;
      bd = d;
      best = e;
    }
    return best;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.sparks.update(dt);
    this.steam.update(dt);
    this.ringGear.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx;
    if (t >= this.duration || (this.endT >= 0 && t >= this.endT + FOLD_T)) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    if (ctx) this.centre.copy(ctx.caster.group.position).setY(0);
    const c = this.centre;

    // --- It ends: the clock, Pack up (the record), or a stun / silence (the status). ---
    if (this.endT < 0 && ctx) {
      const rec = siegeOf(ctx.caster);
      const broken = channelBroken(ctx);
      if (broken || !rec.live || t >= SIEGE_SECONDS) {
        this.endT = t;
        rec.live = false;
        if (broken) {
          ctx.releaseCaster?.();
          this.shake = 0.15;
          this.sparks.burst(this.v1.set(c.x, 1.3, c.z), 8);
        }
        this.ringGear.fold(FOLD_T);
        this.steam.puff(this.v1.set(c.x, 0.4, c.z), this.up, 6);
      }
    }
    const held = this.endT < 0;
    const after = held ? -1 : t - this.endT;

    // --- The slam: plates drop one after another, the last one is the impact frame. ---
    if (!this.slammed && t >= DEPLOY_T - 0.1) {
      this.slammed = true;
      this.shake = 0.3;
      this.shock.set(c, 0.5, 0.03);
      this.sparks.ring(c, 1.9, 12, 0.15);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        this.steam.puff(this.v1.set(c.x + Math.cos(a) * 1.9, 0.2, c.z + Math.sin(a) * 1.9), this.up, 3);
      }
      this.ringGear.place(this.v1.set(c.x, 0.05, c.z), this.up, 2.5, 0, { hole: 0.72, thick: 0.1 });
      this.ringGear.assemble(0.35);
    }
    this.screen.impact = impactFrameAt(t, DEPLOY_T - 0.1, [1], 0.04);
    this.screen.darken = 0.12 * smoothstep(t / 0.3) * (held ? 1 : 1 - smoothstep(after / FOLD_T));

    // The footing: down by DEPLOY_T, folding away at the end.
    const k = held ? smoothstep(t / DEPLOY_T) : 1 - smoothstep(after / FOLD_T);
    this.plates.set(c, k, t);
    this.shock.set(c, this.slammed ? 0.5 + 3.5 * Math.min(1, (t - (DEPLOY_T - 0.1)) / 0.5) : 0, this.slammed ? 0.03 * Math.pow(Math.max(0, 1 - (t - (DEPLOY_T - 0.1)) / 0.5), 2) : 0);
    // The ring on the ground empties as the channel runs, and goes at once when it ends.
    this.bar.set(c, held && t >= DEPLOY_T - 0.2 ? Math.max(0, 1 - t / SIEGE_SECONDS) : 0);
    // Steam vents from the braces now and then.
    this.steamT += dt;
    if (held && this.slammed && this.steamT >= 0.35) {
      this.steamT = 0;
      const a = Math.random() * Math.PI * 2;
      this.steam.puff(this.v1.set(c.x + Math.cos(a) * 1.2, 0.9, c.z + Math.sin(a) * 1.2), this.up, 1);
    }

    // --- The heavy rounds. ---
    if (held && ctx) this.fire(ctx, c);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.shells.forEach((s, i) => this.fly(s, this.rivets[i], ctx, dt));
    this.shake *= Math.exp(-dt * 10);
    this.layoutCannon(dt, held, c);
  }

  /** Every EVERY seconds from EVERY on: a shell at the nearest enemy she sees within REACH (none in reach or sight: that round is lost). */
  private fire(ctx: CastContext, c: THREE.Vector3) {
    if (this.time < this.nextShot) return;
    this.nextShot += EVERY;
    const target = this.pick(ctx, ctx.caster.group.position);
    const s = this.shells.find((x) => !x.live);
    if (!target || !s) return;
    s.live = true;
    s.age = 0;
    s.target = target;
    this.cannonPos(c, target.group.position, s.from);
    this.flash = 1;
    this.shake = Math.max(this.shake, 0.12);
    this.muzzle.set(s.from, 0.9, 1, 0.2);
    this.sparks.burst(s.from, 5);
    this.steam.puff(s.from, this.up, 2);
  }

  /** The cannon on her shoulder, pointing at `at` (or forward). */
  private cannonPos(c: THREE.Vector3, at: THREE.Vector3 | null, out: THREE.Vector3) {
    if (at) this.aim.set(at.x - c.x, 0, at.z - c.z);
    if (this.aim.lengthSq() < 1e-4) this.aim.set(0, 0, 1);
    this.aim.normalize();
    return out.set(c.x + this.aim.x * 0.9, 1.7, c.z + this.aim.z * 0.9);
  }

  private fly(s: Shell, rivet: Rivet, ctx: CastContext | null, dt: number) {
    if (!s.live) { rivet.hide(); return; }
    s.age += dt;
    const target = s.target;
    const p = Math.min(1, s.age / FLIGHT);
    if (target) {
      // Homing on the live position.
      this.v1.set(target.group.position.x, 1.2, target.group.position.z);
      this.v2.lerpVectors(s.from, this.v1, p);
      this.v2.y += Math.sin(Math.PI * p) * 0.6;
      this.v3.subVectors(this.v1, s.from);
      rivet.place(this.v2, this.v3, s.age * 25);
      if (Math.random() < 0.5) this.sparks.burst(this.v2, 1);
    }
    if (p < 1) return;
    s.live = false;
    rivet.hide();
    if (!ctx || !target) return;
    const at = target.group.position;
    // A shell that left the cannon is caught by cover that now stands between: no hit.
    if (!stillSees(ctx, this.v3.set(at.x, 0, at.z))) {
      this.sparks.burst(this.v1.set(at.x, 1, at.z), 4);
      return;
    }
    ctx.hit(target, { damage: this.settings.damage, knock: 0, from: s.from.clone(), color: CLOCKWORK_CSS.body, projectile: true });
    this.v1.set(at.x, 1.2, at.z);
    this.sparks.burst(this.v1, 8);
    this.steam.puff(this.v1, this.up, 3);
    this.shake = Math.max(this.shake, 0.2);
    this.popAt = this.time;
    this.popPos.copy(this.v1);
  }

  private layoutCannon(dt: number, held: boolean, c: THREE.Vector3) {
    const ctx = this.ctx;
    // The star where a shell landed shrinks away.
    const sp = StarBurst.pop(this.popAt < 0 ? -1 : this.time - this.popAt, 0.02, 0.06);
    this.pop.set(this.popPos, 1.2 * sp.scale, sp.opacity, 0.3);
    const aimAt = ctx && held ? this.pick(ctx, ctx.caster.group.position)?.group.position ?? null : null;
    const pos = this.cannonPos(c, aimAt, this.v1);
    const ready = Math.min(1, Math.max(0, 1 - (this.nextShot - this.time) / EVERY));
    this.coil.set(pos, this.aim, held ? ready : 0, this.flash, dt, held && this.slammed ? 1 : 0);
  }
}

export const siegeModeModule: EffectModule = {
  label: 'siege mode',
  category: 'hero: clockwork',
  // Global like Moon's Pull: every enemy in the arena is in `ctx.targets`, the 9 m is judged live by the effect.
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new SiegeMode(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SiegeMode;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SiegeMode).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 100, 1);
  },
};
