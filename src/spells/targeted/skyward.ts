import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { GustRibbon, Leaves, SKY, SKY_CSS, SpeedLines, WindCrescent, WindWraith } from '../../effects/parts/sky';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SKYWARD_AIR } from '../../traits/sky';

/**
 * Skyward (sky kit, W: a leap with a landing zone). Zephyr crouches (0.14 s: a flat whirl of crescents and a gust
 * spiral at his feet), then leaps: a burst of speed lines and leaves, a refraction ring from his feet, and he flies the
 * aimed distance (5 m at most) in a high arc, leaving jade afterimages. At the landing spot a ring of wind and two
 * spiralling funnels draw on from take-off: that, with the red zone (`telegraphs`, a 1.4 m circle read live, shown from
 * take-off), is the warning. He is untouchable from the cast to touchdown (`SKYWARD_AIR`, 0.6 s, shared with his trait). At touchdown (0.6 s):
 * impact frames, a pink star, two rings of crescents across the zone, a ground refraction ring, leaves and a shake;
 * whoever is inside the zone takes `damage` and a 0.5 s knock-up. Clean by 2.0 s.
 *
 * His horizontal path is `ctx.moveCaster` re-aimed every frame so he covers the distance at an even pace (a single slide
 * would be an ease-out lunge); the height is written onto the caster's figure for the player's hero and goes through
 * `ctx.displace` for a duel opponent (see `src/spells/targeted/dawnDescent.ts`). Network duels: the other screen has no
 * `moveCaster` (his client streams the real path), so it draws the zone, the effects and the landing hit, and lifts the
 * figure where it stands.
 */
export interface SkywardSettings {
  damage: number;
  /** Knock-up seconds on the landing (engine cap 0.8). */
  knockUp: number;
  loop: boolean;
}

export const defaultSkyward = (): SkywardSettings => ({ damage: 34, knockUp: 0.5, loop: false });

// Timeline (seconds). The air time is SKYWARD_AIR (the trait's untouchable window): cast to touchdown.
const TAKEOFF = 0.14;
const LAND_T = SKYWARD_AIR;
const FLIGHT = LAND_T - TAKEOFF;
const DURATION = 2.0;
const RADIUS = 1.4;
const MAX_RANGE = 5;
const UP = new THREE.Vector3(0, 1, 0);

export class Skyward implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SkywardSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  /** Where he leaps from, and the landing spot (also the telegraph's centre). */
  readonly start = new THREE.Vector3();
  readonly want = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, -1);
  private len = 0;
  private arcH = 2.6;
  private land = new THREE.Vector3();
  private body = new THREE.Vector3();

  private flags = { crouch: false, leap: false, landed: false, snapped: false, zone: false };
  private lifted = false;
  private trailAt = 0;

  // Parts.
  private crescents = new WindCrescent(16);
  private ringA = new GustRibbon(40);
  private ringB = new GustRibbon(40);
  private funnelA = new GustRibbon(32);
  private funnelB = new GustRibbon(32);
  private gather = new GustRibbon(28);
  private lines = new SpeedLines(48);
  private leaves = new Leaves(40);
  private wraith = new WindWraith(8);
  private star = new StarBurst({ points: 10, inner: 0.3, color: SKY.accent, core: 0xfff0f5, additive: false });
  private flare = new StarBurst({ points: 4, inner: 0.18, jitter: 0, color: SKY.hot, core: SKY.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private leapShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: SkywardSettings = defaultSkyward()) {
    this.settings = settings;
    this.screen.impactColor.set(SKY.hot);
    this.screen.tint.set(SKY.dark);
    this.group.add(
      this.crescents.mesh, this.ringA.mesh, this.ringB.mesh, this.funnelA.mesh, this.funnelB.mesh, this.gather.mesh, this.lines.mesh,
      this.leaves.mesh, this.wraith.mesh, this.star.mesh, this.flare.mesh, this.groundShock.mesh, this.leapShock.mesh,
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
    // Both screens work from where he really stood and the aimed spot.
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    if (this.v1.lengthSq() < 1e-4) this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.len = THREE.MathUtils.clamp(Math.hypot(ctx.point.x - this.start.x, ctx.point.z - this.start.z), 0.5, MAX_RANGE);
    this.dir.copy(this.v1).normalize();
    this.want.copy(this.start).addScaledVector(this.dir, this.len);
    this.land.copy(this.want);
    this.arcH = THREE.MathUtils.clamp(2.4 + 0.25 * this.len, 2.4, 3.8);
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
    this.trailAt = 0;
    this.land.copy(this.want);
    const f = this.flags;
    f.crouch = f.leap = f.landed = f.snapped = f.zone = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(SKY.hot);
    this.screen.tint.set(SKY.dark);
    this.crescents.reset();
    this.ringA.reset();
    this.ringB.reset();
    this.funnelA.reset();
    this.funnelB.reset();
    this.gather.reset();
    this.lines.reset();
    this.leaves.reset();
    this.wraith.reset();
    this.star.set(this.want, 1e-3, 0);
    this.flare.set(this.want, 1e-3, 0);
    this.groundShock.set(this.want, 0, 0);
    this.leapShock.set(this.start, 0, 0);
  }

  /** Puts his figure back on the ground (the height written during the flight). */
  private lower() {
    const ctx = this.ctx;
    if (!this.lifted || !ctx) return;
    this.lifted = false;
    ctx.caster.group.position.y = 0;
    ctx.displace(ctx.caster, this.v3.set(0, 0, 0));
  }

  /** Height of his feet at flight progress `u` (0..1): a parabola. */
  private heightAt(u: number) {
    return this.arcH * (1 - (2 * u - 1) * (2 * u - 1));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crescents.update(dt);
    this.ringA.update(dt);
    this.ringB.update(dt);
    this.funnelA.update(dt);
    this.funnelB.update(dt);
    this.gather.update(dt);
    this.lines.update(dt);
    this.leaves.update(dt);
    this.wraith.update(dt);
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

    if (!f.crouch) {
      f.crouch = true;
      this.crouch();
    }
    if (!f.zone && t >= TAKEOFF) {
      f.zone = true;
      this.drawZone();
    }
    if (!f.leap && t >= TAKEOFF) {
      f.leap = true;
      this.leap();
    }
    if (t >= TAKEOFF && t < LAND_T) {
      this.fly(dt);
    } else if (f.leap && !f.snapped) {
      // Touchdown: make sure he ends exactly on the spot and on the ground.
      f.snapped = true;
      if (ctx?.moveCaster) this.land.copy(ctx.moveCaster(this.want, 0.06)).setY(0);
      this.lower();
    }
    if (!f.landed && t >= LAND_T) {
      f.landed = true;
      this.touchdown();
    }
    this.layout();
    this.shake *= Math.exp(-dt * 8);
  }

  /** The crouch: a flat whirl of crescents under his feet and a gust spiral coiling up his legs. */
  private crouch() {
    this.v1.copy(this.start).setY(0.12);
    this.crescents.slash(this.v1, this.dir, 1.1, 300, 0, 0.4, { width: 0.28, spin: 11, sweep: 0.12 });
    this.v2.copy(this.start).setY(0);
    this.gather.spiral(this.v2, 0.5, 1.5, 2, 0.35, 0.16);
  }

  /** The landing ring of wind and two funnels on the zone, drawn on while he flies. */
  private drawZone() {
    const n = 8;
    const ring = (from: number, to: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) {
        const a = from + (to - from) * (i / n);
        pts.push(new THREE.Vector3(this.want.x + Math.cos(a) * RADIUS, 0.1, this.want.z + Math.sin(a) * RADIUS));
      }
      return pts;
    };
    this.ringA.along(ring(0, Math.PI), 0.16, FLIGHT);
    this.ringB.along(ring(Math.PI, Math.PI * 2), 0.16, FLIGHT);
    this.v1.copy(this.want).setY(0);
    this.funnelA.spiral(this.v1, 1.1, 2.6, 1.6, FLIGHT - 0.04, 0.2);
    this.funnelB.spiral(this.v1, 0.7, 2.2, 2.2, FLIGHT - 0.04, 0.14);
  }

  /** The leap: speed lines and leaves burst up, a refraction ring runs from his feet. */
  private leap() {
    this.v1.copy(this.start).setY(0.9);
    this.lines.burst(this.v1, UP, 14, 2.4);
    this.v2.copy(this.start).setY(0.3);
    this.leaves.blow(this.v2, UP, 10, 6);
    this.shake = 0.15;
  }

  /** One frame of flight: re-aims the slide so he covers the distance evenly, and lifts him along the arc. */
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

  /** Touchdown: the burst of crescents across the zone, and the hits. */
  private touchdown() {
    const ctx = this.ctx;
    const s = this.settings;
    this.shake = 0.6;
    const c = this.land;
    // Two rings of ground crescents, offset by half a step.
    for (let ring = 0; ring < 2; ring++) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + ring * (Math.PI / 6);
        this.v2.set(Math.sin(a), 0, Math.cos(a));
        this.v1.copy(c).setY(0.3 + ring * 0.15);
        this.crescents.slash(this.v1, this.v2, 1.1 + ring * 0.5, 60, 0.12, 0.55, { width: 0.5, sweep: 0.1, tone: ring ? 0.6 : 0 });
        this.v3.copy(c).addScaledVector(this.v2, 1.0).setY(0.5);
        this.lines.burst(this.v3, this.v2, 2, 1.6);
      }
    }
    this.v1.copy(c).setY(0.3);
    this.leaves.blow(this.v1, UP, 16, 7);
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.want.x, p.z - this.want.z) > RADIUS) continue; // walked out of the zone before the touchdown
      ctx.hit(e, { damage: s.damage, knock: 3, from: c, color: SKY_CSS.body, status: { kind: 'knockup', seconds: s.knockUp } });
    }
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const after = t - LAND_T;
    const flying = t >= TAKEOFF && t < LAND_T;
    const u = THREE.MathUtils.clamp((t - TAKEOFF) / FLIGHT, 0, 1);

    // --- His body in the air, read from the live figure (the opponent's is lifted through `displace`). ---
    if (ctx && f.leap) {
      const p = ctx.caster.group.position;
      this.body.set(p.x, f.landed ? 0 : this.heightAt(u), p.z);
    } else this.body.copy(this.start);

    // --- Flight: a jade afterimage every 0.07 s and falling streaks behind him. ---
    if (flying && t >= this.trailAt) {
      this.trailAt = t + 0.07;
      this.v1.copy(this.body);
      this.wraith.show(this.v1, this.dir, 0.3, 1.8, 0.4, 0.55);
      if (u > 0.55) {
        this.v2.copy(this.body).setY(this.body.y + 1.1);
        this.lines.burst(this.v2, this.v3.set(0, -1, 0), 2, 1.4);
      }
    }

    // --- The leap's refraction ring. ---
    if (f.leap && t < TAKEOFF + 0.5) {
      const lp = THREE.MathUtils.clamp((t - TAKEOFF) / 0.4, 0, 1);
      this.leapShock.set(this.start, 0.4 + 2.0 * lp, 0.05 * (1 - lp) * (1 - lp));
    } else this.leapShock.set(this.start, 0, 0);

    // --- Touchdown: impact frames, star, flare, ground refraction, shake. ---
    this.screen.impact = f.landed ? impactFrameAt(t, LAND_T, [1, 2], 0.04) : 0;
    if (f.landed) {
      const sp = StarBurst.pop(after, 0.03, 0.08);
      this.star.set(this.v2.copy(this.land).setY(1.3), 2.2 * sp.scale + 1e-3, sp.opacity, 0.15);
      const fp = StarBurst.pop(after - 0.02, 0.06, 0.14);
      this.flare.set(this.v2.copy(this.land).setY(0.8), 3.0 * fp.scale + 1e-3, fp.opacity, 0.5);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.land, 0.8 + 3.0 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake, 0.6 * Math.exp(-after * 8));
    }
  }
}

export const skywardModule: EffectModule = {
  label: 'skyward',
  category: 'hero: sky',
  // A leap to a spot (5 m at most); the 1.4 m landing zone is the only area it ever hits.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new Skyward(),
  telegraphs(effect) {
    const e = effect as Skyward;
    if (!e.ctx) return [];
    // The zone shows from take-off; the hit is judged on the live positions at touchdown.
    return [{ shape: { kind: 'circle', x: e.want.x, z: e.want.z, radius: RADIUS }, start: TAKEOFF, impact: LAND_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Skyward;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as Skyward).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'knockUp', 0, 0.8, 0.1);
  },
};
