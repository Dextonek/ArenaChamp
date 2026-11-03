import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, HaloRing, LightPanels, Sigil, SunRays, dawnEaseOut, dawnFacing, dawnOrient,
} from '../../effects/parts/dawn';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { DESCENT_AIR } from '../../traits/dawn';

/**
 * Dawn Descent (dawn kit, R: a leap with a landing zone). Auriel crouches on a sun sigil, the standing blades round her
 * feet burst up and outward as she leaps (a refraction ring on the ground) and flies the aimed distance (12 m at most)
 * in a high arc: a sun disc turns behind her, gold shards fall from her trail and a shadow sigil slides over the ground
 * under her, shrinking as she climbs. While she flies the landing zone is drawn on the ground at the aimed spot (a 2.5 m
 * sun-wheel sigil with a gold ring closing in on its edge): that is the telegraph, and whoever stands in it when she
 * lands is hit. She is untouchable from the cast until touchdown (`DESCENT_AIR`, shared with her trait). At touchdown
 * (1.0 s): impact frames, a sky-blue star, sun rays and a ring of panel shards across the zone, ground refraction, a
 * shake; whoever is inside takes `damage` and a stun, and a shield wraps her (`shield` for `SHIELD_SECONDS`, 30% more
 * through her passive). The zone sigil lingers a moment and fades. Clean by 2.6 s.
 *
 * Her horizontal path is `ctx.moveCaster` re-aimed every frame so she covers the distance at an even pace (a single
 * slide would be an ease-out lunge). The height is written straight onto the caster's figure for the player's hero,
 * and goes through `ctx.displace` for a duel opponent (an arena figure the arena re-places every frame). Online, the other
 * screen has no `moveCaster` (her own client streams her position), so it draws the zone, the effects and the stun
 * hit but not the leap itself. See pipeline/designs/kit-shapes-v3.md.
 */
export interface DawnDescentSettings {
  damage: number;
  /** Stun seconds on the landing (engine cap 1.2). */
  stun: number;
  /** Shield Auriel gains at touchdown (held SHIELD_SECONDS). */
  shield: number;
  loop: boolean;
}

export const defaultDawnDescent = (): DawnDescentSettings => ({ damage: 40, stun: 1, shield: 40, loop: false });

// Timeline (seconds). The air time is DESCENT_AIR (the trait's untouchable window): take-off to touchdown.
const TAKEOFF = 0.12;
const LAND_T = DESCENT_AIR;
const FLIGHT = LAND_T - TAKEOFF;
const DURATION = 2.6;
const RADIUS = 2.5;
const MAX_RANGE = 12;
const SHIELD_SECONDS = 3;
const BLADES = 8;
const TRAIL = 14;
const DEBRIS = 16;
const UP = new THREE.Vector3(0, 1, 0);

export class DawnDescent implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DawnDescentSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  /** Where she leaps from, and the landing spot (also the telegraph's centre). */
  readonly start = new THREE.Vector3();
  readonly want = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, -1);
  private nrm = new THREE.Vector3(0, 0, 1);
  private len = 0;
  private arcH = 3;
  private land = new THREE.Vector3();

  private flags = { blades: false, leap: false, landed: false, snapped: false };
  private lifted = false;
  private trailN = 0;
  private trailAt = 0;

  // Parts.
  private zone = new Sigil();
  private shadow = new Sigil();
  private closing = new HaloRing();
  private disc = new HaloRing();
  private blades = new LightPanels(BLADES, 6);
  private trail = new LightPanels(TRAIL, 6);
  private debris = new LightPanels(DEBRIS, 8);
  private rays = new SunRays(8, 0.3);
  private impactRays = new SunRays(10, 0.34, DAWN.core);
  private star = new StarBurst({ points: 10, inner: 0.3, color: DAWN.accent, core: DAWN.accent, additive: false });
  private flare = new StarBurst({ points: 4, inner: 0.18, jitter: 0, color: DAWN.hot, core: DAWN.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private leapShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();
  private body = new THREE.Vector3();

  constructor(settings: DawnDescentSettings = defaultDawnDescent()) {
    this.settings = settings;
    this.screen.impactColor.set(DAWN.foil);
    this.impactRays.mesh.renderOrder = 4;
    this.rays.mesh.renderOrder = 4;
    this.group.add(
      this.zone.mesh, this.shadow.mesh, this.closing.mesh, this.disc.mesh, this.rays.mesh, this.impactRays.mesh,
      this.blades.mesh, this.trail.mesh, this.debris.mesh, this.star.mesh, this.flare.mesh, this.groundShock.mesh, this.leapShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return LAND_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens work from where she really stood and the aimed spot.
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    this.len = Math.min(MAX_RANGE, this.v1.length());
    if (this.v1.lengthSq() < 1e-4) this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.dir.copy(this.v1).normalize();
    this.want.copy(this.start).addScaledVector(this.dir, this.len);
    this.land.copy(this.want);
    this.arcH = THREE.MathUtils.clamp(2.6 + 0.22 * this.len, 2.6, 5.2);
    dawnFacing(Math.atan2(this.dir.x, this.dir.z), this.nrm);
    this.rays.face(Math.atan2(this.dir.x, this.dir.z));
    this.impactRays.face(Math.atan2(this.dir.x, this.dir.z));
    this.screen.focus.copy(this.want).setY(1.2);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.groundShock.set(this.want, 0, 0);
    this.leapShock.set(this.start, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.lower();
    this.time = 0;
    this.shake = 0;
    this.trailN = 0;
    this.trailAt = 0;
    this.land.copy(this.want);
    const f = this.flags;
    f.blades = f.leap = f.landed = f.snapped = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(DAWN.foil);
    this.zone.reset();
    this.shadow.reset();
    this.closing.reset();
    this.disc.reset();
    this.blades.reset();
    this.trail.reset();
    this.debris.reset();
    this.rays.reset();
    this.impactRays.reset();
    this.star.set(this.want, 1e-3, 0);
    this.flare.set(this.want, 1e-3, 0);
    this.groundShock.set(this.want, 0, 0);
    this.leapShock.set(this.start, 0, 0);
  }

  /** Puts her figure back on the ground (the height written during the flight). */
  private lower() {
    const ctx = this.ctx;
    if (!this.lifted || !ctx) return;
    this.lifted = false;
    ctx.caster.group.position.y = 0;
    ctx.displace(ctx.caster, this.v3.set(0, 0, 0));
  }

  /** Height of her feet at flight progress `u` (0..1): a parabola. */
  private heightAt(u: number) {
    return this.arcH * (1 - (2 * u - 1) * (2 * u - 1));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;

    if (!f.blades) {
      f.blades = true;
      this.placeBlades();
      this.blades.assemble(TAKEOFF * 0.8, 0.05, 2.5);
    }
    if (!f.leap && t >= TAKEOFF) {
      f.leap = true;
      this.leap();
    }
    if (t >= TAKEOFF && t < LAND_T) {
      this.fly(dt);
    } else if (f.leap && !f.snapped) {
      // Touchdown: make sure she ends exactly on the spot and on the ground.
      f.snapped = true;
      if (ctx?.moveCaster) this.land.copy(ctx.moveCaster(this.want, 0.06)).setY(0);
      this.lower();
    }
    if (!f.landed && t >= LAND_T) {
      f.landed = true;
      this.touchdown();
    }

    this.layout(dt);
    this.blades.update(dt);
    this.trail.update(dt);
    this.debris.update(dt);
    this.disc.spin(dt);
    this.closing.spin(dt);
    this.shake *= Math.exp(-dt * 8);
  }

  /** Standing blades round her feet on the sigil, before the leap. */
  private placeBlades() {
    for (let i = 0; i < BLADES; i++) {
      const a = (i / BLADES) * Math.PI * 2;
      this.v2.set(Math.cos(a), 0, Math.sin(a));
      this.v1.copy(this.start).addScaledVector(this.v2, 0.85).setY(0.55);
      dawnOrient(this.v2, UP, this.q1);
      this.blades.place(i, this.v1, this.q1, 1.1, 'shard', 1, i % 2 ? DAWN.hot : DAWN.foil);
    }
  }

  /** The leap: the blades burst up and out, a ground ring runs from her feet. */
  private leap() {
    for (let i = 0; i < BLADES; i++) {
      const a = (i / BLADES) * Math.PI * 2;
      this.v3.set(Math.cos(a) * 2.6, 4.2 + (i % 3) * 0.6, Math.sin(a) * 2.6);
      this.blades.fling(i, this.v3, 0.6 + (i % 3) * 0.1, 7);
    }
    this.shake = 0.18;
  }

  /** One frame of flight: re-aims the slide so she covers the distance evenly, and lifts her along the arc. */
  private fly(dt: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const u = THREE.MathUtils.clamp((this.time - TAKEOFF) / FLIGHT, 0, 1);
    if (ctx.moveCaster && this.len > 0.05) {
      const cur = ctx.caster.group.position;
      const sCur = THREE.MathUtils.clamp((cur.x - this.start.x) * this.dir.x + (cur.z - this.start.z) * this.dir.z, 0, this.len);
      const sWant = this.len * Math.min(1, u + dt / FLIGHT);
      const need = Math.max(0, sWant - sCur);
      // moveCaster eases out over D seconds; this frame's step covers f1 of the segment, so ask for need / f1.
      const D = 0.2;
      const f1 = 1 - Math.pow(1 - Math.min(dt, D * 0.9) / D, 3);
      const seg = Math.min(this.len - sCur, need / Math.max(f1, 0.05));
      this.v1.set(cur.x, 0, cur.z).addScaledVector(this.dir, seg);
      ctx.moveCaster(this.v1, D);
    }
    const y = this.heightAt(u);
    ctx.caster.group.position.y = y;
    ctx.displace(ctx.caster, this.v3.set(0, y, 0));
    this.lifted = true;
  }

  /** Touchdown: the shield, the hits, and the burst of panels across the zone. */
  private touchdown() {
    const ctx = this.ctx;
    const s = this.settings;
    this.shake = 0.7;
    this.burstDebris();
    ctx?.shieldSelf?.(s.shield, SHIELD_SECONDS, DAWN_CSS.body);
    if (!ctx) return;
    const c = this.land;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - c.x, p.z - c.z) > RADIUS + 0.25) continue; // walked out of the zone before the touchdown
      ctx.hit(e, { damage: s.damage, knock: 2, from: c, color: DAWN_CSS.body, status: { kind: 'stun', seconds: s.stun } });
    }
  }

  /** A ring of panel shards bursts out over the zone. */
  private burstDebris() {
    for (let i = 0; i < DEBRIS; i++) {
      const a = (i / DEBRIS) * Math.PI * 2 + (i % 3) * 0.1;
      this.v2.set(Math.cos(a), 0, Math.sin(a));
      this.v1.copy(this.land).addScaledVector(this.v2, 0.5 + (i % 3) * 0.25).setY(0.3);
      const shard = i % 2 === 0;
      this.v3.copy(this.v2).multiplyScalar(4 + (i % 4) * 0.9 + Math.random());
      this.v3.y = 2.2 + Math.random() * 2.2;
      dawnOrient(UP, this.v2, this.q1);
      this.debris.place(i, this.v1, this.q1, shard ? 0.9 + (i % 3) * 0.2 : 0.45 + (i % 3) * 0.1, shard ? 'shard' : 'hex', shard ? 1.2 : 1,
        i % 4 === 0 ? DAWN.foil : i % 4 === 1 ? DAWN.hot : DAWN.body);
      this.debris.fling(i, this.v3, 0.9 + Math.random() * 0.2, 6);
    }
  }

  private layout(dt: number) {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const after = t - LAND_T;
    const flying = t >= TAKEOFF && t < LAND_T;
    const u = THREE.MathUtils.clamp((t - TAKEOFF) / FLIGHT, 0, 1);

    // --- The sigil under her feet draws on in the crouch; the landing zone draws on while she flies. ---
    this.shadow.set(this.v1.set(this.start.x, 0, this.start.z), 1.3);
    this.shadow.reveal = smoothstep(t / 0.12);
    this.shadow.opacity = f.leap ? 0 : 1;

    this.zone.set(this.want, RADIUS);
    this.zone.reveal = smoothstep((t - 0.05) / (LAND_T - 0.15));
    this.zone.opacity = f.landed ? 1 - smoothstep((after - 0.7) / 0.8) : 0.9;
    // A gold ring closes in on the zone's edge and meets it at touchdown.
    const close = RADIUS * (1 + 0.9 * (1 - dawnEaseOut(t / LAND_T)));
    this.closing.set(this.v1.copy(this.want).setY(0.07), UP, close);
    this.closing.opacity = f.landed ? 0 : smoothstep((t - 0.03) / 0.15) * 0.85;

    // --- Her body in the air: read from the live figure, lifted by the arc (the opponent's figure is not lifted by the arena). ---
    if (ctx && f.leap) {
      const p = ctx.caster.group.position;
      this.body.set(p.x, f.landed ? 0 : this.heightAt(u), p.z);
    } else this.body.copy(this.start);

    // --- Flight: a sun disc behind her, a falling trail of shards, a ray fan; the ground shadow slides under her. ---
    if (flying) {
      this.v1.copy(this.body).setY(this.body.y + 1.25);
      this.disc.set(this.v2.copy(this.v1).addScaledVector(this.dir, -0.15), this.nrm, 1.05);
      this.disc.opacity = smoothstep((t - TAKEOFF) / 0.08);
      this.rays.fan(this.v1, UP, 8, 3.2, Math.PI, dawnEaseOut((t - TAKEOFF) / 0.2), 0.3);
      this.rays.fade(0.5);
      this.dropTrail(t);
      this.shadow.set(this.v2.set(this.body.x, 0, this.body.z), 1.1 * (1 - 0.45 * (this.body.y / this.arcH)));
      this.shadow.reveal = 1;
      this.shadow.opacity = 0.75;
    } else {
      this.disc.opacity = f.landed ? 0 : this.disc.opacity;
      this.rays.fade(0);
    }

    // --- The leap: a refraction ring from her feet. ---
    if (f.leap && t < TAKEOFF + 0.5) {
      const lp = THREE.MathUtils.clamp((t - TAKEOFF) / 0.4, 0, 1);
      this.leapShock.set(this.start, 0.4 + 2.2 * lp, 0.05 * (1 - lp) * (1 - lp));
    } else this.leapShock.set(this.start, 0, 0);

    // --- Touchdown: impact frames, star, flare, rays, ground refraction, shake. ---
    this.screen.impact = f.landed ? impactFrameAt(t, LAND_T, [1, 2], 0.04) : 0;
    if (f.landed) {
      this.v1.copy(this.land).setY(0.5);
      this.impactRays.fan(this.v1, UP, 9, 5, 1.3, dawnEaseOut(after / 0.22));
      this.impactRays.fade(1 - smoothstep(after / 0.8));
      const sp = StarBurst.pop(after, 0.03, 0.08);
      this.star.set(this.v2.copy(this.land).setY(1.4), 2.6 * sp.scale + 1e-3, sp.opacity, 0.15);
      const fp = StarBurst.pop(after - 0.02, 0.06, 0.14);
      this.flare.set(this.v2.copy(this.land).setY(0.9), 3.4 * fp.scale + 1e-3, fp.opacity, 0.5);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.land, 0.8 + 3.6 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake, 0.7 * Math.exp(-after * 8));
    }
    void dt;
  }

  /** Drops a shard behind her every 0.06 s; each tumbles down and shrinks away. */
  private dropTrail(t: number) {
    if (t < this.trailAt) return;
    this.trailAt = t + 0.06;
    const i = this.trailN++ % TRAIL;
    this.v1.copy(this.body).setY(this.body.y + 0.9 + ((i * 5) % 7) * 0.08);
    this.v1.x += (((i * 3) % 5) - 2) * 0.12;
    dawnOrient(this.nrm, this.dir, this.q1);
    this.trail.place(i, this.v1, this.q1, 0.5 + ((i * 3) % 4) * 0.1, i % 3 === 0 ? 'hex' : 'shard', 0.9, i % 2 ? DAWN.hot : DAWN.body);
    this.v3.copy(this.dir).multiplyScalar(-0.6).setY(-0.8);
    this.trail.fling(i, this.v3, 0.45, 4);
  }
}

export const dawnDescentModule: EffectModule = {
  label: 'dawn descent',
  category: 'hero: dawn',
  // A leap to a spot (12 m at most); the 2.5 m landing zone is the only area it ever hits.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new DawnDescent(),
  telegraphs(effect) {
    const e = effect as DawnDescent;
    if (!e.ctx) return [];
    // The zone stands from the cast; the hit is judged on the live positions at touchdown.
    return [{ shape: { kind: 'circle', x: e.want.x, z: e.want.z, radius: RADIUS }, start: 0, impact: LAND_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as DawnDescent;
    if (e.ctx) frameCast(camera, controls, e.ctx, 7);
  },
  buildGui(f, effect) {
    const s = (effect as DawnDescent).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
    f.add(s, 'stun', 0, 1.2, 0.1);
    f.add(s, 'shield', 0, 200, 1);
  },
};
