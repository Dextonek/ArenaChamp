import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Droplets, SerpentHead, SplashCrown, TIDE, TIDE_CSS, WaterPool, WaterRibbon } from '../../effects/parts/tide';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Leviathan's Waltz (tide kit, R: the MOBA ultimate, a line). Under the normal gameplay camera, no letterbox: the world
 * darkens to deep sea blue and pools spread along a 12 m strip that runs from her feet down the aim. A huge water ribbon
 * rises out of it and coils into a serpent (a head with a foam mane and two pale eyes, a long coiling body) that
 * circles the strip 3 to 6 high while droplets stream off it. It rears up over the middle of the strip, mouth open,
 * everything hangs for a dead beat, then it dives straight down: a huge foam crown, a tidal wave racing both ways
 * along the strip, the hit, which knocks everyone on the strip up. The water falls as rain, the pools drain and the
 * light lifts. Clean by 4.5 s. See pipeline/designs/kit-tide.md.
 */
export interface LeviathansWaltzSettings {
  damage: number;
  /** Knock-up seconds on the hit (engine cap 0.8). */
  knockup: number;
  loop: boolean;
}

export const defaultLeviathansWaltz = (): LeviathansWaltzSettings => ({ damage: 100, knockup: 0.5, loop: false });

// Timeline (seconds).
const LIFT_T = 0.0; // she lifts both arms, the world darkens, the pool spreads
const RISE_T = 0.3; // the ribbon rises out of the pool
const REAR_T = 1.6; // the serpent rears up over the point
const BEAT_T = 1.85; // dead beat 1.85..2.0
const DIVE_T = 2.0;
const HIT_T = 2.2;
const RAIN_END_T = 3.9;
const DRAIN_T = 3.2;
const DURATION = 4.5;

const LENGTH = 12; // the strip runs this far from her feet along the aim
const HALF_W = 1.8; // half the strip width (the hit and the telegraph)
const RADIUS = LENGTH / 2; // reach of the strip from its middle, for the visuals
const POOLS = 3;
const BEAT_LEN = DIVE_T - BEAT_T;
const LAG = 1.25; // seconds of the head's track the body spans
const TOP_Y = 5.5; // where the head rears
const MAX_VIS = 2; // enemies that get their own crown

/** The serpent's clock: runs with the timeline but stands still during the dead beat. */
const gClock = (t: number) => (t < BEAT_T ? t : t < DIVE_T ? BEAT_T : t - BEAT_LEN);

export class LeviathansWaltz implements Effect {
  readonly group = new THREE.Group();
  readonly settings: LeviathansWaltzSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  private from = new THREE.Vector3(0, 0, 14);
  private dir = new THREE.Vector3(0, 0, -1);
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];
  private theta0 = 0;
  /** The cobra strike: unit direction of the rear and the dive (about 60 degrees below horizontal), and the rear spot. */
  private strike = new THREE.Vector3(0, -0.87, 0.5);
  private rearP = new THREE.Vector3(0, 5.5, 0);

  private flags = { pool: false, hit: false, drained: false, ring: false };
  private rainTimer = 0;

  // Parts.
  private pools = Array.from({ length: POOLS }, () => new WaterPool());
  private body = new WaterRibbon(60, 10, 30);
  private head = new SerpentHead();
  private rings = [new WaterRibbon(30, 8, 8), new WaterRibbon(30, 8, 8)];
  private rain = new Droplets(44);
  private crown = new SplashCrown();
  private pop = new StarBurst({ points: 12, inner: 0.3, color: TIDE.accent, core: 0xfff2e8, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();
  private cur = { g: 0, s: 0, phase: 0 };

  constructor(settings: LeviathansWaltzSettings = defaultLeviathansWaltz()) {
    this.settings = settings;
    this.screen.impactColor.set(TIDE.hot);
    this.screen.tint.set(TIDE.dark);
    this.body.shed = 24;
    this.body.profile = (u) => 0.4 + 0.6 * Math.pow(u, 0.7);
    this.body.drops.splash = false;
    for (const r of this.rings) { r.shed = 6; r.drops.splash = false; }
    this.group.add(
      ...this.pools.map((p) => p.mesh), this.body.mesh, ...this.rings.map((r) => r.mesh), this.head.mesh, this.crown.mesh, this.rain.mesh,
      this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True when ground point p lies inside the strip. */
  private inStrip(p: THREE.Vector3) {
    const dx = p.x - this.from.x, dz = p.z - this.from.z;
    const along = dx * this.dir.x + dz * this.dir.z;
    const side = dx * this.dir.z - dz * this.dir.x;
    return along >= -0.5 && along <= LENGTH && Math.abs(side) <= HALF_W + 0.2;
  }

  /** True while `e` stands on the strip right now (enemies who walked off before the impact are spared). */
  private inside(e: CastContext['targets'][number]) {
    return this.inStrip(e.group.position);
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.point.copy(this.from).addScaledVector(this.dir, LENGTH / 2);
    this.theta0 = Math.atan2(ctx.from.z - this.point.z, ctx.from.x - this.point.x) + 2.4;
    const hx = this.point.x - ctx.from.x, hz = this.point.z - ctx.from.z, hl = Math.max(Math.hypot(hx, hz), 1e-3);
    this.strike.set((hx / hl) * 0.5, -0.87, (hz / hl) * 0.5).normalize();
    const L = (TOP_Y - 0.4) / -this.strike.y;
    this.rearP.set(this.point.x - this.strike.x * L, TOP_Y, this.point.z - this.strike.z * L);
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      if (!this.inStrip(p)) return;
      this.victims.push({ enemy: e, feet: p.clone().setY(0) });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(2);
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.rainTimer = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(TIDE.dark);
    for (const p of this.pools) p.reset();
    this.body.reset();
    this.head.reset();
    for (const r of this.rings) r.reset();
    this.rain.reset();
    this.crown.reset();
    this.pop.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  /** Where the serpent's head is at serpent-clock `g`: out of the pool, round the zone, up, down into the point. */
  private headAt(g: number, out: THREE.Vector3): THREE.Vector3 {
    const g0 = RISE_T;
    const orbit = (gg: number, o: THREE.Vector3) => {
      const s = Math.max(gg - g0, 0);
      const theta = this.theta0 + 3.8 * (s - 0.25 * (1 - Math.exp(-s / 0.25)));
      const rad = 3.4 - 0.6 * smoothstep(s / 1.3);
      const y = 0.2 + 4.6 * (1 - Math.exp(-s / 0.45)) + 0.6 * Math.sin(s * 2.6);
      return o.set(this.point.x + Math.cos(theta) * rad, y, this.point.z + Math.sin(theta) * rad);
    };
    if (g < g0) {
      // Still under the floor: straight down below the rim point.
      orbit(g0, out);
      out.y -= (g0 - g) * 14;
      return out;
    }
    const dive0 = BEAT_T, dive1 = BEAT_T + 0.2;
    if (g < dive0) {
      orbit(g, out);
      const b = smoothstep((g - (REAR_T - 0.05)) / 0.3);
      if (b > 0) {
        out.lerp(this.rearP, b);
      }
      return out;
    }
    if (g < dive1) {
      const c = (g - dive0) / (dive1 - dive0);
      this.v4.set(this.point.x, 0.4, this.point.z);
      return out.lerpVectors(this.rearP, this.v4, Math.pow(c, 1.6));
    }
    return out.set(this.point.x, 0.4, this.point.z).addScaledVector(this.strike, (g - dive1) * 30);
  }

  private bodyPath = (u: number, out: THREE.Vector3): THREE.Vector3 => {
    const g = this.cur.g - (1 - u) * LAG;
    this.headAt(g, out);
    // A slow lateral swell along the body so it reads as coils, not a rope.
    const w = Math.sin(u * 9 + this.cur.s * 2) * 0.35 * (1 - u) * smoothstep(this.cur.g - RISE_T);
    out.y += w * 0.6;
    return out;
  };

  /** The expanding ring wave: half a ring each, racing out from the point. */
  private ringPath = (u: number, out: THREE.Vector3): THREE.Vector3 => {
    const k = this.cur.s;
    // A tidal wave racing both ways along the strip: a curved crest across its width (phase 0 ahead, PI behind).
    const r = 0.8 + (RADIUS - 0.8) * (1 - Math.pow(1 - k, 3));
    const sgn = Math.cos(this.cur.phase - this.theta0) >= 0 ? 1 : -1;
    const lat = (u - 0.5) * 2 * HALF_W * 1.15;
    const bow = 0.5 * (1 - 4 * (u - 0.5) * (u - 0.5));
    return out.set(
      this.point.x + this.dir.x * (sgn * (r + bow)) + this.dir.z * lat,
      0.4 * (1 - k * 0.5),
      this.point.z + this.dir.z * (sgn * (r + bow)) - this.dir.x * lat,
    );
  };

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const held = this.time >= BEAT_T && this.time < DIVE_T;
    this.body.frozen = held;
    this.rain.frozen = held;
    for (const p of this.pools) p.frozen = held;
    this.crown.frozen = held;
    this.body.update(dt);
    for (const r of this.rings) r.update(dt);
    this.rain.update(dt);
    this.crown.update(dt);
    for (const p of this.pools) p.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    if (!f.pool && t >= LIFT_T + 0.02) {
      f.pool = true;
      this.pools.forEach((p, i) => {
        this.v1.copy(this.from).addScaledVector(this.dir, LENGTH * ((i + 0.5) / POOLS)).setY(0);
        p.spread(this.v1, LENGTH / POOLS / 2 + 0.4, 0.4);
      });
    }
    // Rain: the zone fills with falling water after the dive, and a little mist-drop all through the build.
    if (t >= 0.6 && t < BEAT_T && !held) {
      this.rainTimer += dt;
      while (this.rainTimer >= 0.16) {
        this.rainTimer -= 0.16;
        this.dropAt(0.6 + Math.random() * 0.8, 1.0);
      }
    }
    if (t >= HIT_T + 0.15 && t < RAIN_END_T) {
      this.rainTimer += dt;
      while (this.rainTimer >= 0.05) {
        this.rainTimer -= 0.05;
        this.dropAt(1.2, 1.0);
      }
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.rainTimer = 0;
      this.head.hide();
      this.crown.burst(this.point, 3.4, 1.8);
      for (const sgn of [-1, 1]) this.crown.burst(this.v1.copy(this.point).addScaledVector(this.dir, sgn * 4), 1.8, 1.2);
      let shown = 0;
      for (const v of this.victims) {
        if (shown >= MAX_VIS) break;
        shown++;
        this.crown.burst(v.feet, 1.1, 1.0);
      }
      this.pools[1].ripple(this.point);
      this.rain.spray(this.v1.set(this.point.x, 1.2, this.point.z), this.v2.set(0, 1, 0), 24, 9);
      // Live positions: whoever stepped off the strip before the dive is spared.
      if (ctx) {
        for (const e of ctx.targets) {
          if (!this.inside(e)) continue;
          ctx.hit(e, {
            damage: this.settings.damage, knock: 2, from: this.point, color: TIDE_CSS.body, status: { kind: 'knockup', seconds: this.settings.knockup },
          });
        }
      }
    }
    if (f.hit && !f.drained && t >= DRAIN_T) {
      f.drained = true;
      for (const p of this.pools) p.drain(1.0);
    }

    this.layout();
  }

  /** A falling drop at a random spot of the zone (mist in the build, rain after the dive). */
  private dropAt(life: number, speedK: number) {
    const along = (Math.random() - 0.5) * LENGTH * 0.95, lat = (Math.random() - 0.5) * 2 * HALF_W * 1.2;
    this.v1.set(this.point.x + this.dir.x * along + this.dir.z * lat, 5.5 + Math.random() * 2.5, this.point.z + this.dir.z * along - this.dir.x * lat);
    this.v2.set(0, -(5 + Math.random() * 4) * speedK, 0);
    this.rain.drop(this.v1, this.v2, life, 0.09 + Math.random() * 0.06);
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v3.set(0, 0, 0));
    this.reset();
  }

  private layout() {
    const t = this.time;
    const ctx = this.ctx;
    const after = t - HIT_T;
    const g = gClock(t);

    // --- Screen: deep sea blue, a lift at the landing, lifting away as the rain falls. Impact frames at the hit. ---
    let dk = 0.55 * smoothstep(t / 0.4) * (1 - smoothstep((t - 3.4) / 1.0));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The serpent. ---
    this.cur.g = g;
    this.cur.s = t;
    const bodyOn = t >= RISE_T && g < BEAT_T + 0.2 + 1.2;
    // After the hit the body is swallowed by the splash: it thins out and is gone by 2.5.
    const bodyW = 1.9 * (1 - smoothstep((t - HIT_T) / 0.3));
    if (bodyOn && t < 2.5 && bodyW > 0.05) this.body.setFunction(this.bodyPath, bodyW, 1, 0, g);
    else this.body.hide();
    // Head: on the end of the body, looking along its track, then down at the point as it rears.
    if (t >= RISE_T && t < HIT_T) {
      this.headAt(g, this.v1);
      this.headAt(g + 0.03, this.v2);
      this.headAt(g - 0.03, this.v4);
      this.v2.sub(this.v4);
      if (this.v2.lengthSq() < 1e-8) this.v2.set(0, 1, 0);
      this.v2.normalize();
      const look = smoothstep((g - (REAR_T - 0.05)) / 0.3);
      if (look > 0) this.v2.lerp(this.strike, look).normalize();
      this.v1.addScaledVector(this.v2, 0.8);
      const open = 0.9 * smoothstep((g - (REAR_T - 0.1)) / 0.35);
      this.head.place(this.v1, this.v2, 1.6 * smoothstep((t - RISE_T) / 0.15), open);
    }

    // --- The ring wave racing out from the point. ---
    if (after >= 0 && after < 1.5) {
      this.cur.s = THREE.MathUtils.clamp(after / 1.0, 0, 1);
      for (let i = 0; i < 2; i++) {
        this.cur.phase = i * Math.PI + this.theta0;
        this.rings[i].shed = 10;
        this.rings[i].setFunction(this.ringPath, 1.4 * (1 - smoothstep((after - 0.9) / 0.6)), 1, 0, t);
      }
    } else {
      for (const r of this.rings) r.hide();
    }

    // --- The pull on the enemies: in while the serpent circles, released at the landing. ---
    if (ctx) {
      const pull = 0.4 * smoothstep((t - RISE_T) / 1.3) * (1 - smoothstep(after / 0.3));
      for (const v of this.victims) {
        this.v3.set(this.point.x - v.feet.x, 0, this.point.z - v.feet.z).multiplyScalar(pull);
        ctx.displace(v.enemy, this.v3);
      }
    }

    // --- The landing: coral star at the centre, ground refraction, shake. ---
    if (this.flags.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.2), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = 0.75 * Math.exp(-after * 9);
    }
  }
}

export const leviathansWaltzModule: EffectModule = {
  label: "leviathan's waltz",
  category: 'hero: tide',
  // A line from her along the aim: radius is the strip half width for the aim marker.
  targeting: { mode: 'ground', radius: HALF_W },
  create: () => new LeviathansWaltz(),
  telegraphs(effect) {
    const e = effect as LeviathansWaltz;
    const ctx = e.ctx;
    if (!ctx) return [];
    const d = { x: Math.sin(ctx.aim), z: Math.cos(ctx.aim) };
    return [{
      shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + d.x * LENGTH, z2: ctx.from.z + d.z * LENGTH, width: HALF_W * 2 },
      start: 0, impact: HIT_T,
    }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as LeviathansWaltz;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as LeviathansWaltz).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
    f.add(s, 'knockup', 0, 0.8, 0.1);
  },
};
