import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, HaloRing, LightBeams, LightPanels, Sigil, SunEmblems, SunRays, dawnEaseOutBack, dawnFacing, dawnForward, dawnOrient,
} from '../../effects/parts/dawn';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Aegis Wall (dawn kit, W: trap). A sun-wheel sigil draws on at the point, ten ivory and gold kite shields, each with a
 * sun emblem and flanked by feather plates, fly in and click into a ring standing upright around its edge and stand
 * open for a moment (walk out), then tilt inward over the enemies like a closing dome. At 1.2 s the dome slams shut (a
 * capstone clicks in at the top, the seams flash as hard-light needles, gold shards and sun rays burst, a ring of light
 * sweeps the floor): whoever is still inside is hit and stunned; a second pulse ticks at 1.7 s, then the dome shatters
 * outward into panels that shrink away and the sigil fades. See pipeline/designs/kit-dawn.md.
 */
export interface AegisWallSettings {
  damage: number;
  tick: number;
  /** Stun seconds on the slam (engine cap 1.2). */
  stun: number;
  loop: boolean;
}

export const defaultAegisWall = (): AegisWallSettings => ({ damage: 45, tick: 10, stun: 0.8, loop: false });

// Timeline (seconds).
const SIGIL_END = 0.3;
const ASSEMBLE_T = 0.3;
const TILT_A = 1.0;
const HIT_T = 1.2;
const TICK_T = 1.7;
const SHATTER_T = 1.8;
const DURATION = 2.75;
const RADIUS = 4;
const SHIELDS = 10;
const RING_R = 3.7;
const LENGTH = 4.6; // shield length, base to apex
const WIDE = 0.7;
const SHARDS = 14; // gold shards thrown at the slam
const UP = new THREE.Vector3(0, 1, 0);
const THETA_0 = 0.08;
const THETA_1 = Math.asin((RING_R - 0.15) / LENGTH);

export class AegisWall implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AegisWallSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -6);
  private nrm = new THREE.Vector3(0, 0, 1);
  private fwd = new THREE.Vector3(0, 0, -1);
  private radial: THREE.Vector3[] = [];

  private flags = { asm: false, hit: false, tick: false, shatter: false };

  // Parts.
  private sigil = new Sigil();
  // Shields 0..SHIELDS-1, then one feather plate between each pair of shields.
  private panels = new LightPanels(SHIELDS * 2, 6);
  private shards = new LightPanels(SHARDS, 8);
  private emblems = new SunEmblems(SHIELDS * 2);
  private beams = new LightBeams(SHIELDS);
  private halo = new HaloRing();
  private rays = new SunRays(12, 0.5);
  private cap = new LightPanels(1, 8);
  private star = new StarBurst({ points: 10, inner: 0.3, color: DAWN.accent, core: DAWN.accent, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();
  private v5 = new THREE.Vector3();
  private v6 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();

  constructor(settings: AegisWallSettings = defaultAegisWall()) {
    this.settings = settings;
    for (let i = 0; i < SHIELDS; i++) this.radial.push(new THREE.Vector3());
    this.screen.tint.set(DAWN.dark);
    this.screen.impactColor.set(DAWN.foil);
    this.group.add(
      this.sigil.mesh, this.panels.mesh, this.shards.mesh, this.cap.mesh, this.emblems.mesh, this.beams.mesh, this.halo.mesh, this.rays.mesh,
      this.star.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the impact are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    dawnFacing(ctx.aim, this.nrm);
    dawnForward(ctx.aim, this.fwd);
    for (let i = 0; i < SHIELDS; i++) {
      const a = (i / SHIELDS) * Math.PI * 2 + 0.31;
      this.radial[i].set(Math.cos(a), 0, Math.sin(a));
    }
    this.screen.focus.copy(this.point).setY(1.5);
    this.rays.face(ctx.aim);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.panels.mesh];
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.asm = f.hit = f.tick = f.shatter = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(DAWN.foil);
    this.sigil.reset();
    this.panels.reset();
    this.shards.reset();
    this.cap.reset();
    this.emblems.reset();
    this.beams.reset();
    this.halo.reset();
    this.rays.reset();
    this.star.set(this.point, 1e-3, 0);
    this.groundShock.set(this.point, 0, 0);
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

    if (!f.asm && t >= ASSEMBLE_T) {
      f.asm = true;
      this.layout();
      this.panels.assemble(0.22, 0.1, 5);
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.shake = 0.35;
      this.throwShards();
      this.cap.place(0, this.v1.copy(this.point).setY(LENGTH * Math.cos(THETA_1) + 0.1), dawnOrient(UP, this.nrm, this.q1), 1.5, 'hex', 1, DAWN.hot);
      this.cap.assemble(0.1, 0, 2.5);
      if (ctx) {
        for (const e of ctx.targets) {
          if (this.inside(e)) {
            ctx.hit(e, { damage: this.settings.damage, knock: 0, color: DAWN_CSS.body, status: { kind: 'stun', seconds: this.settings.stun } });
          }
        }
      }
    }
    if (!f.tick && t >= TICK_T) {
      f.tick = true;
      if (ctx) for (const e of ctx.targets) if (this.inside(e)) ctx.hit(e, { damage: this.settings.tick, knock: 0, color: DAWN_CSS.body });
    }
    if (!f.shatter && t >= SHATTER_T) {
      f.shatter = true;
      this.v1.copy(this.point).setY(1.2);
      this.panels.shatter(7, 0.78, this.v1);
      this.cap.shatter(5, 0.7, this.v1);
      this.emblems.reset();
      this.beams.reset();
    }

    this.layout();
    this.panels.update(dt);
    this.shards.update(dt);
    this.cap.update(dt);
  }

  /** The slam throws gold shards up and out of the apex. */
  private throwShards() {
    const apex = this.v1.copy(this.point).setY(LENGTH * Math.cos(THETA_1) * 0.8);
    for (let k = 0; k < SHARDS; k++) {
      const a = (k / SHARDS) * Math.PI * 2 + Math.random() * 0.4;
      const vel = new THREE.Vector3(Math.cos(a) * (3 + Math.random() * 3), 2 + Math.random() * 4, Math.sin(a) * (3 + Math.random() * 3));
      this.v2.copy(this.nrm);
      dawnOrient(this.v2, vel, this.q1);
      this.shards.place(k, apex, this.q1, 0.8 + Math.random() * 0.7, k % 3 === 0 ? 'hex' : k % 2 ? 'feather' : 'shard', 1, k % 2 ? DAWN.hot : DAWN.body);
      this.shards.fling(k, vel, 0.7 + Math.random() * 0.25, 10);
    }
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const after = t - HIT_T;

    // --- 0..0.3 the sigil draws on; it fades from 1.7 to 2.2. ---
    this.sigil.set(this.point, RADIUS);
    this.sigil.reveal = smoothstep(t / SIGIL_END);
    this.sigil.opacity = 1 - smoothstep((t - 2.2) / 0.5);

    // --- 0.3..0.7 ten kite shields click into a ring, upright, each with a sun emblem; 1.0..1.2 they tilt in and slam shut. ---
    if (t >= ASSEMBLE_T && !f.shatter) {
      const u = THREE.MathUtils.clamp((t - TILT_A) / (HIT_T - TILT_A), 0, 1);
      const theta = THETA_0 + (THETA_1 - THETA_0) * u * u;
      const pulse = f.tick ? Math.exp(-(t - TICK_T) * 9) : 0;
      const slam = f.hit ? Math.exp(-after * 8) : 0;
      const emblemK = dawnEaseOutBack((t - 0.62) / 0.22);
      for (let i = 0; i < SHIELDS; i++) {
        const r = this.radial[i];
        const th = theta * (1 - (i % 2) * 0.02);
        // Axis from the base toward the apex, outward normal of the shield plane.
        this.v1.copy(r).multiplyScalar(-Math.sin(th)).addScaledVector(UP, Math.cos(th));
        this.v2.copy(r).multiplyScalar(Math.cos(th)).addScaledVector(UP, Math.sin(th));
        this.v3.copy(this.point).addScaledVector(r, RING_R).addScaledVector(this.v1, LENGTH * 0.5);
        const len = LENGTH * (1 + 0.05 * (pulse + slam * 0.5));
        // The shield's own +Y runs toward the base, so its wide flat top sits at the base and the point at the apex.
        this.v4.copy(this.v1).negate();
        dawnOrient(this.v2, this.v4, this.q1);
        this.panels.place(i, this.v3, this.q1, len, 'shield', WIDE, i % 3 === 1 ? 0xd9a02e : DAWN.body);
        // The sun emblem on both faces, on the wide part of the kite.
        if (emblemK > 0) {
          const es = 1.45 * emblemK * (1 + 0.15 * slam + 0.1 * pulse);
          this.v5.copy(this.v3).addScaledVector(this.v4, len * 0.2);
          this.v6.copy(this.v5).addScaledVector(this.v2, 0.05);
          this.emblems.set(i, this.v6, this.q1, es);
          this.v6.copy(this.v5).addScaledVector(this.v2, -0.05);
          this.emblems.set(SHIELDS + i, this.v6, this.q1, es);
        }
        // A feather plate stands in the gap between this shield and the next, just outside the ring, its tip toward the dome.
        const j = ((i + 0.5) / SHIELDS) * Math.PI * 2 + 0.31;
        this.v5.set(Math.cos(j), 0, Math.sin(j));
        this.v4.copy(this.v5).multiplyScalar(-Math.sin(th)).addScaledVector(UP, Math.cos(th));
        this.v2.copy(this.v5).multiplyScalar(Math.cos(th)).addScaledVector(UP, Math.sin(th));
        this.v3.copy(this.point).addScaledVector(this.v5, RING_R + 0.55).addScaledVector(this.v4, 1.45);
        dawnOrient(this.v2, this.v4, this.q1);
        this.panels.place(SHIELDS + i, this.v3, this.q1, 2.9 * (1 + 0.04 * slam), 'feather', 1.15, i % 2 ? DAWN.hot : DAWN.foil);
      }
      this.panels.glow = 0.5 * Math.max(after >= 0 && after < 0.1 ? 1 - after / 0.1 : 0, f.tick && t - TICK_T < 0.1 ? 1 - (t - TICK_T) / 0.1 : 0);
      this.emblems.brightness = 1 + 0.5 * Math.max(slam, pulse);
    }

    // --- The hit: seam needles, ring of light, sun rays, sky-blue star at the apex, ground refraction 1 -> 5, impact frame, shake. ---
    if (f.hit) {
      this.screen.impact = impactFrameAt(after, 0, [1], 0.03);
      this.v1.copy(this.point).setY(LENGTH * Math.cos(THETA_1) + 0.2);
      const sp = StarBurst.pop(after, 0.02, 0.04);
      this.star.set(this.v1, 1.1 * sp.scale + 1e-3, sp.opacity, 0.1);
      const gp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.groundShock.set(this.point, 1 + 4 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = 0.35 * Math.exp(-after * 9);
      // The ten seams light up as needles from the floor to the apex.
      const bk = THREE.MathUtils.clamp(after / 0.25, 0, 1);
      this.beams.opacity = 1 - bk * bk;
      this.beams.bright = 2.2;
      if (!f.shatter) {
        for (let i = 0; i < SHIELDS; i++) {
          const r = this.radial[i];
          const th = THETA_1;
          this.v2.copy(r).multiplyScalar(-Math.sin(th)).addScaledVector(UP, Math.cos(th));
          this.v3.copy(this.point).addScaledVector(r, RING_R).addScaledVector(this.v2, LENGTH * 0.5);
          this.v4.copy(r).multiplyScalar(Math.cos(th)).addScaledVector(UP, Math.sin(th));
          this.beams.set(i, this.v3, this.v2, this.v4, LENGTH * 1.02, 0.2 * (1 - bk));
        }
      }
      // A flat ring of light sweeps out across the floor.
      this.v2.set(0, 1, 0);
      this.halo.set(this.point, this.v2, RING_R * (0.4 + 0.75 * smoothstep(after / 0.35)));
      this.halo.opacity = 0.9 * (1 - smoothstep(after / 0.4));
      this.halo.spin(0.016);
      // Sun rays from the apex.
      this.v3.copy(UP).addScaledVector(this.rays.normal, -UP.dot(this.rays.normal)).normalize();
      this.rays.fan(this.v1, this.v3, 12, 3.8, Math.PI, smoothstep(after / 0.12), 0.34);
      this.rays.fade(1 - smoothstep((after - 0.04) / 0.3));
    }
  }
}

export const aegisWallModule: EffectModule = {
  label: 'aegis wall',
  category: 'hero: dawn',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new AegisWall(),
  telegraphs(effect) {
    const e = effect as AegisWall;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as AegisWall;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as AegisWall).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'tick', 0, 60, 1);
    f.add(s, 'stun', 0, 1.2, 0.1);
  },
};
