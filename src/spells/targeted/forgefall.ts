import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { HeatHaze, ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  FORGE, FORGE_CSS, AshFlakes, ForgeIron, ForgeSigil, IronChunks, QuenchSteam, SlagBlobs, SlagPool, SlagStreams, Sparks,
} from '../../effects/parts/forge';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Forgefall (forge kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world darkens, an
 * anvil sigil draws on around the zone, slag streams pour up from the ground into the sky and pool into a colossal
 * hammer that cools black from its edges while it rises overhead. A dead beat, then it swings down: impact frame, a
 * fountain of sparks, a web of molten cracks across the zone, slag splashes, a shock ring. The hammer shatters into
 * cooling iron chunks, the cracks go black, ash falls and steam rises at the edges. Clean by 4.5 s. See
 * pipeline/designs/kit-forge.md.
 */
export interface ForgefallSettings {
  damage: number;
  loop: boolean;
}

export const defaultForgefall = (): ForgefallSettings => ({ damage: 115, loop: false });

// Timeline (seconds).
const STREAM_T = 0.3;
const RISE_T = 1.4; // cooling and rising overhead
const DEAD_A = 1.8; // dead beat: everything stops
const DEAD_B = 1.95;
const HIT_T = 2.3;
const SHATTER_T = 2.38;
const DURATION = 4.5;

const RADIUS = 7;
const STREAMS = 6;
const HAMMER_SCALE = 5; // head 1.3 * 5 = 6.5 long
const TOP_Y = 4.5;
const POOL_Y = 3.5;
const BLOBS = 10;

export class Forgefall implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ForgefallSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -8);
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private fist = new THREE.Vector3(0, 2.5, 14);
  private aim = 0;
  private anchors: THREE.Vector3[] = [];

  // Event flags.
  private flags = { impacted: false, shattered: false, ash: [false, false, false, false], steam: [false, false, false, false, false, false] };

  // Parts.
  private sigil = new ForgeSigil({ inner: true });
  private streams = new SlagStreams(STREAMS);
  private hammer = ForgeIron.hammer(HAMMER_SCALE);
  private web = new SlagPool({ web: true });
  private blobs = new SlagBlobs(16, 10);
  private sparks = new Sparks(220);
  private chunks = new IronChunks(48);
  private ash = new AshFlakes(70);
  private steam = new QuenchSteam(12);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: FORGE.accent, core: 0xe8fbff, additive: false });
  private armFlare = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: FORGE.hot, core: FORGE.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private haze = new HeatHaze({ width: 15, height: 4, scale: 5 });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();

  constructor(settings: ForgefallSettings = defaultForgefall()) {
    this.settings = settings;
    this.screen.impactColor.set(FORGE.ash);
    this.screen.tint.set(0x5a3524);
    this.blobs.splatCool = 0.8;
    this.blobs.splatFade = 0.5;
    this.steam.life = 0.7;
    for (let i = 0; i < STREAMS; i++) this.anchors.push(new THREE.Vector3());
    this.hammer.visible = false;
    this.group.add(
      this.sigil.mesh, this.web.mesh, this.streams.mesh, this.hammer, this.blobs.mesh, this.chunks.mesh, this.sparks.mesh,
      this.ash.mesh, this.steam.mesh, this.pop.mesh, this.armFlare.mesh, this.groundShock.mesh, this.haze.mesh,
    );
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
    this.from.copy(ctx.from);
    this.point.copy(ctx.point).setY(0);
    this.aim = ctx.aim;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.fist.copy(ctx.from).addScaledVector(this.fwd, 0.3).setY(2.5);
    for (let i = 0; i < STREAMS; i++) {
      const a = (i / STREAMS) * Math.PI * 2 + 0.4;
      this.anchors[i].set(this.point.x + Math.cos(a) * (RADIUS - 1), 0.2, this.point.z + Math.sin(a) * (RADIUS - 1));
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.hammer];
    this.screen.focus.copy(this.v1.copy(this.point).setY(2));
    this.web.place(this.point);
    this.sigil.set(this.point, RADIUS, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.impacted = false;
    this.flags.shattered = false;
    this.flags.ash.fill(false);
    this.flags.steam.fill(false);
    clearScreenFx(this.screen);
    this.sigil.reset();
    this.streams.reset();
    this.web.reset();
    this.blobs.reset();
    this.sparks.reset();
    this.chunks.reset();
    this.ash.reset();
    this.steam.reset();
    this.hammer.visible = false;
    this.pop.set(this.point, 0, 0);
    this.armFlare.set(this.fist, 0, 0);
    this.groundShock.set(this.point, 0, 0);
    this.haze.set(this.point, 0, 0);
  }

  /** Stream i, u in 0..1: from its ground anchor, up and in to the pooling hammer. */
  private streamPath(i: number, u: number, out: THREE.Vector3) {
    const p0 = this.anchors[i];
    const dx = p0.x - this.point.x, dz = p0.z - this.point.z;
    const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
    return out.set(
      a * p0.x + b * (p0.x + dx * 0.15) + c * (this.point.x + dx * 0.25) + d * this.point.x,
      a * p0.y + b * 4.5 + c * (POOL_Y + 2.5) + d * (POOL_Y + 1),
      a * p0.z + b * (p0.z + dz * 0.15) + c * (this.point.z + dz * 0.25) + d * this.point.z,
    );
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const frozen = this.time >= DEAD_A && this.time < DEAD_B;
    if (!frozen) {
      this.sparks.update(dt);
      this.blobs.update(dt);
      this.chunks.update(dt);
      this.ash.update(dt);
      this.steam.update(dt);
      this.web.update(dt);
    }
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.impacted && t >= HIT_T) {
      f.impacted = true;
      this.land();
      if (ctx) {
        ctx.targets.forEach((e, i) => {
          const p = ctx.targetPos[i];
          if (p && Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) {
            ctx.hit(e, { damage: this.settings.damage, knock: 8, from: this.point, color: FORGE_CSS.body });
          }
        });
      }
    }
    if (!f.shattered && t >= SHATTER_T) {
      f.shattered = true;
      this.chunks.burst(this.v1.copy(this.point).setY(1.8), 36, 7, 0.6, 0.55, 1.7, 2.5);
      this.sparks.burst(this.v1.copy(this.point).setY(2.5), this.v2.set(0, 1, 0), 24, 9, 1.4);
      this.shake = Math.max(this.shake, 0.35);
    }
    [2.5, 2.7, 2.9, 3.0].forEach((ta, i) => {
      if (!f.ash[i] && t >= ta) { f.ash[i] = true; this.ash.fall(this.point, 6.2, 16, 6, 1.5); }
    });
    [2.7, 2.9, 3.0, 3.15, 3.3, 3.4].forEach((ta, i) => {
      if (!f.steam[i] && t >= ta) {
        f.steam[i] = true;
        const a = i * 2.4 + 0.7;
        this.steam.puff(this.v1.set(this.point.x + Math.cos(a) * 6, 0.3, this.point.z + Math.sin(a) * 6), 0.9, i === 1);
      }
    });

    this.layout();
  }

  /** The hit: sparks, crack web, slag splashes. */
  private land() {
    this.sparks.burst(this.v1.copy(this.point).setY(0.5), this.v2.set(0, 1, 0), 70, 14, 0.9);
    this.sparks.burst(this.v1.copy(this.point).setY(0.5), this.v2.set(0, 1, 0), 50, 10, 1.5);
    this.web.spread(RADIUS, 0.35);
    this.web.cool(1.5, 0.1);
    this.web.fade(0.5, 1.6);
    for (let i = 0; i < BLOBS; i++) {
      const a = (i / BLOBS) * Math.PI * 2 + Math.random() * 0.5;
      const r = 2 + Math.random() * 3.2;
      const sp = 5 + Math.random() * 3;
      this.v1.set(this.point.x + Math.cos(a) * r, 0.4, this.point.z + Math.sin(a) * r);
      this.v2.set(Math.cos(a) * sp, 4 + Math.random() * 0.8, Math.sin(a) * sp);
      this.blobs.throw(this.v1, this.v2, 0.28 + Math.random() * 0.1);
    }
    this.shake = 0.8;
  }

  private layout() {
    const t = this.time;
    const after = t - HIT_T;
    const f = this.flags;

    // --- Screen: warm darken, a lift at the hit and toward the end; the impact frame. ---
    let dk = 0.6 * smoothstep(t / 0.4) * (1 - smoothstep((t - 3.4) / 0.9));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- Anvil sigil on the ground draws on around the zone, glows, fades at the end. ---
    this.sigil.reveal = smoothstep(t / 0.6);
    this.sigil.opacity = 1 - smoothstep((t - 3.3) / 0.9);
    this.sigil.glow = f.impacted ? 0.5 + 0.5 * Math.exp(-after * 4) : 0.5 + 0.4 * smoothstep(t / 1.4);

    // --- The raised arm: a hot flare at the fist in the first 0.4 s. ---
    const af = t < 0.4 ? Math.sin(Math.PI * (t / 0.4)) : 0;
    this.armFlare.set(this.fist, 0.8 * af, af > 0.05 ? 1 : 0, t * 2);

    // --- 0.3..1.4 Slag streams pour from the ground ring into the sky and are absorbed into the hammer. ---
    for (let i = 0; i < STREAMS; i++) {
      const d = i * 0.04;
      const head = 1 - (1 - THREE.MathUtils.clamp((t - STREAM_T - d) / 0.55, 0, 1)) ** 3;
      const tail = smoothstep((t - 0.95 - d) / 0.5);
      if (t >= RISE_T || head <= 0.001) { this.streams.hide(i); continue; }
      this.streams.set(i, (u, out) => this.streamPath(i, u, out), head, Math.min(tail, head - 0.01), 0.24, 0, t);
    }

    // --- The hammer: pools up (0.5..1.4), cools black from the edges and rises, dead beat, swings down, shatters. ---
    let tilt: number, y: number;
    if (t < RISE_T) {
      tilt = 0.45; y = POOL_Y;
    } else if (t < DEAD_A) {
      const u = smoothstep((t - RISE_T) / (DEAD_A - RISE_T));
      tilt = 0.45 - 0.25 * u; y = POOL_Y + (TOP_Y - POOL_Y) * u;
    } else if (t < 1.95) {
      tilt = 0.2; y = TOP_Y;
    } else {
      const u = THREE.MathUtils.clamp((t - 1.95) / (HIT_T - 1.95), 0, 1);
      tilt = 0.2 * (1 - u * u); y = TOP_Y * (1 - Math.pow(u, 2.2)) - (f.impacted ? 0.1 : 0);
    }
    const g = smoothstep((t - 0.5) / 0.9);
    this.hammer.visible = t >= 0.5 && t < SHATTER_T;
    this.hammer.scale.set(HAMMER_SCALE * (0.25 + 0.75 * g), HAMMER_SCALE * (0.15 + 0.85 * g), HAMMER_SCALE * (0.25 + 0.75 * g));
    this.hammer.position.set(this.point.x, y, this.point.z);
    this.qa.setFromAxisAngle(this.side, -tilt);
    this.qb.setFromAxisAngle(this.v1.set(0, 1, 0), this.aim - Math.PI / 2); // head's long axis along the view direction
    this.hammer.quaternion.copy(this.qa).multiply(this.qb);
    let heat = 1 - 0.88 * smoothstep((t - RISE_T) / 0.5);
    if (f.impacted) heat = Math.max(heat, 0.6 * Math.exp(-after * 12));
    ForgeIron.heat(this.hammer, heat);

    // --- Hit: spark-centre star (3 frames), ground refraction, haze over the zone for 1 s, shake. ---
    if (f.impacted) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.4), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      const hz = after / 1.0;
      this.haze.set(this.point, hz < 1 ? 0.012 * (1 - hz * hz) : 0, t);
      this.shake = 0.8 * Math.exp(-after * 9) + (f.shattered ? 0.35 * Math.exp(-(t - SHATTER_T) * 10) : 0);
    }
  }
}

export const forgefallModule: EffectModule = {
  label: 'forgefall',
  category: 'hero: forge',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new Forgefall(),
  telegraphs(effect) {
    const e = effect as Forgefall;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Forgefall;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as Forgefall).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
