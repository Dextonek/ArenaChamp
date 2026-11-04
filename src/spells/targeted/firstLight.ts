import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, HaloRing, LightPanels, Sigil, SunEmblems, SunRays, dawnEaseOutBack, dawnOrient, dawnPanelNormal, dawnView,
} from '../../effects/parts/dawn';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { Q_BURST, Q_BURST_RADIUS, Q_SHIELD_SECONDS, aurielShields, burstHit, type AurielShield } from '../../traits/dawn';

/**
 * First Light (dawn kit v5, Q: a quick cone). No aim: she turns to the nearest enemy and a sun disc swells in front of her chest
 * while five blade shards gather; at 0.45 s the shards fly out and a fan of hard light fills a 6 m cone in front of her. Every
 * enemy inside the cone at that moment (live positions) takes 50 and a small shove, with a sun-wheel flash under it. That hit
 * gives her a 30 shield for 3 s, unless Dawnward or Sunrise holds (the trait's `landed`, `src/traits/dawn.ts`). Three small plates
 * orbit her while it holds. When the shield ends (broken, or run out at 3 s) it bursts for 18 in 3 m at her LIVE position
 * (`projectile: true`): the plates shatter, a ring of light runs out. A branded enemy caught in it is stunned 0.8 s by the
 * trait. The effect watches the trait's `aurielShields` record (a NEW kind 1 record after the cast), so it stays alive up to
 * about 5 s after a hit; a miss ends it at 2.3 s. A Dawnward or Sunrise cast replaces the record and the plates crumble without
 * a burst. The cone's telegraph is the real hit shape; the burst has none (`projectile: true`). See pipeline/designs/kit-dawn.md.
 */
export interface FirstLightSettings {
  damage: number;
  /** Damage of the burst when its small shield ends. */
  burst: number;
  /** Shove speed of the cone's hit. */
  knock: number;
  loop: boolean;
  /** Tool preview only: with a hit and no trait record, plays the burst 3 s after the hit. */
  previewBurst: boolean;
}

export const defaultFirstLight = (): FirstLightSettings => ({ damage: 44, burst: Q_BURST, knock: 3, loop: false, previewBurst: false });

// Timeline (seconds).
const HIT_T = 0.45; // the cone's hit
const MISS_END = HIT_T + 1.85; // no shield record by now: it missed, the effect ends
const BURST_LIFE = 0.9;
const CAP = 6.4;
const RANGE = 6; // the cone's length
const ANGLE = 70; // degrees, the cone's full width
const SELF_RADIUS = 6.6; // the duel AI casts it when the enemy is within this minus 0.6 (6 m)
const SHARDS = 5;
const ORBIT = 3;
const SPARKS = 6;
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

export class FirstLight implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FirstLightSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 13);
  private fwd = new THREE.Vector3(0, 0, -1);
  private view = new THREE.Vector3(0, 0.45, 0.9);
  private hold = new THREE.Vector3(0, 1.4, 12);
  private yaw = 0;

  private flags = { struck: false, fired: false };
  private hitAt = new THREE.Vector3();
  private hitAge = -1;
  /** The trait's record before this cast (a record that is not this one is the new shield), and the one this cast got. */
  private rec0: AurielShield | null = null;
  private rec: AurielShield | null = null;
  private recAt = -1;
  private recFresh = false;
  private previewing = false;
  private burstT = -1;
  private crumbleT = -1;
  private center = new THREE.Vector3();
  private burstAt = new THREE.Vector3();

  // Parts.
  private panels = new LightPanels(SHARDS + ORBIT + SPARKS, 6);
  private emblem = new SunEmblems(1);
  private rays = new SunRays(10, 0.5);
  private sigil = new Sigil();
  private burstHalo = new HaloRing();
  private fanDark: THREE.Mesh;
  private fan: THREE.Mesh;
  private fanEdge: THREE.Mesh;
  private star = new StarBurst({ points: 10, inner: 0.3, color: DAWN.accent, core: DAWN.accent, additive: false });
  private flare = new StarBurst({ points: 12, inner: 0.25, color: DAWN.hot, core: DAWN.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();

  constructor(settings: FirstLightSettings = defaultFirstLight()) {
    this.settings = settings;
    this.screen.tint.set(DAWN.dark);
    this.screen.impactColor.set(DAWN.foil);
    this.rays.normal.set(0, 1, 0);
    // The fan on the floor: a dark amber sector under a gold one, with a bright edge.
    const half = THREE.MathUtils.degToRad(ANGLE) / 2;
    const sector = () => new THREE.CircleGeometry(1, 28, Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2);
    const mat = (c: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.fanDark = new THREE.Mesh(sector(), mat(DAWN.dark));
    this.fan = new THREE.Mesh(sector(), mat(DAWN.body));
    this.fanEdge = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 28, 1, Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2), mat(DAWN.core));
    this.fanDark.position.y = 0.04;
    this.fan.position.y = 0.05;
    this.fanEdge.position.y = 0.06;
    this.group.add(
      this.fanDark, this.fan, this.fanEdge, this.sigil.mesh, this.panels.mesh, this.emblem.mesh, this.rays.mesh, this.burstHalo.mesh,
      this.star.mesh, this.flare.mesh, this.shock.mesh,
    );
    this.reset();
  }

  get duration() {
    return HIT_T + 3 + BURST_LIFE;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.yaw = ctx.aim;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    dawnView(ctx.aim, this.view);
    this.hold.copy(this.from).addScaledVector(this.fwd, 0.8).setY(1.4);
    this.fan.position.set(this.from.x, 0.05, this.from.z);
    this.fanDark.position.set(this.from.x, 0.04, this.from.z);
    this.fanEdge.position.set(this.from.x, 0.06, this.from.z);
    this.fan.rotation.y = this.fanDark.rotation.y = this.fanEdge.rotation.y = ctx.aim + Math.PI;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.hold);
  }

  play() {
    this.reset();
    this.playing = true;
    this.rec0 = this.ctx ? aurielShields.get(this.ctx.caster) ?? null : null;
    this.center.copy(this.from);
    this.layout(0);
    this.panels.assemble(0.3, 0.12, 4);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.struck = this.flags.fired = false;
    this.hitAge = -1;
    this.rec0 = this.rec = null;
    this.recAt = -1;
    this.recFresh = false;
    this.previewing = false;
    this.burstT = this.crumbleT = -1;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(DAWN.foil);
    this.panels.reset();
    this.emblem.reset();
    this.rays.reset();
    this.sigil.reset();
    this.burstHalo.reset();
    this.fan.visible = this.fanDark.visible = this.fanEdge.visible = false;
    this.star.set(this.from, 1e-3, 0);
    this.flare.set(this.from, 1e-3, 0);
    this.shock.set(this.from, 0, 0);
  }

  private get endAt() {
    if (this.burstT >= 0) return Math.min(CAP, this.burstT + BURST_LIFE);
    if (this.crumbleT >= 0) return Math.min(CAP, this.crumbleT + 0.7);
    return this.rec || this.previewing ? CAP : MISS_END;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.endAt) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;
    const c = this.ctx?.caster.group.position;
    if (c && this.burstT < 0) this.center.set(c.x, 0, c.z);

    if (!f.fired && t >= HIT_T) {
      f.fired = true;
      this.strike();
    }
    if (f.fired && this.burstT < 0 && this.crumbleT < 0) this.watch();

    this.layout(dt);
    this.panels.update(dt);
    this.shake *= Math.exp(-dt * 12);
  }

  /** The cone: the shards fly, the fan fills, and everyone inside it right now (live positions) takes the hit. */
  private strike() {
    const ctx = this.ctx;
    this.shake = 0.3;
    // Throw the five shards forward across the cone.
    const half = THREE.MathUtils.degToRad(ANGLE) / 2;
    for (let i = 0; i < SHARDS; i++) {
      const a = this.yaw + ((i / (SHARDS - 1)) * 2 - 1) * half * 0.8;
      this.v1.set(Math.sin(a), 0, Math.cos(a));
      this.panels.fling(i, this.v2.copy(this.v1).multiplyScalar(11 + (i % 2) * 2).setY(0.6), 0.55, 4);
    }
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      const dx = p.x - this.from.x, dz = p.z - this.from.z;
      if (Math.hypot(dx, dz) > RANGE) continue;
      let diff = Math.atan2(dx, dz) - this.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) > half) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: ctx.from, color: DAWN_CSS.body });
      if (!this.flags.struck) {
        this.flags.struck = true;
        this.hitAge = 0;
        this.hitAt.set(p.x, 1.2, p.z);
        this.screen.focus.copy(this.hitAt);
      }
    }
  }

  /** After the cone: the trait's NEW kind 1 record is the shield; when it says broke (or a bigger shield replaced it) the end comes. */
  private watch() {
    const ctx = this.ctx;
    if (!ctx) return;
    const cur = aurielShields.get(ctx.caster);
    if (!this.rec) {
      if (cur && cur !== this.rec0 && cur.kind === 1) {
        this.rec = cur;
        this.recAt = this.time;
        this.recFresh = true;
      } else if (this.settings.previewBurst && this.flags.struck) this.previewing = true;
    }
    if (this.rec) {
      if (cur !== this.rec) this.crumble();
      else if (cur.broke) this.burst();
    } else if (this.previewing && this.time >= HIT_T + Q_SHIELD_SECONDS) this.burst();
  }

  private crumble() {
    this.crumbleT = this.time;
    this.panels.shatter(3, 0.6, this.center);
  }

  /** The small shield is gone: the plates shatter, a ring runs out to 3 m, and everyone inside takes the hit. */
  private burst() {
    const ctx = this.ctx;
    this.burstT = this.time;
    this.burstAt.copy(this.center);
    this.shake = 0.22;
    this.panels.shatter(6, 0.8, this.burstAt);
    for (let k = 0; k < SPARKS; k++) {
      const a = (k / SPARKS) * Math.PI * 2 + 0.5;
      this.v1.set(this.burstAt.x + Math.sin(a) * 0.8, 1.0, this.burstAt.z + Math.cos(a) * 0.8);
      dawnOrient(this.v2.set(Math.sin(a), 0, Math.cos(a)), UP, this.q1);
      this.panels.place(SHARDS + ORBIT + k, this.v1, this.q1, 0.7, 'shard', 1.1, k % 2 ? DAWN.hot : DAWN.body);
      this.panels.fling(SHARDS + ORBIT + k, this.v2.multiplyScalar(5 + (k % 3)).setY(2.2), 0.6, 8);
    }
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.burstAt.x, p.z - this.burstAt.z) > Q_BURST_RADIUS) continue;
      burstHit(ctx, e, { damage: this.settings.burst, knock: 2, from: this.burstAt.clone(), color: DAWN_CSS.body });
    }
  }

  private layout(dt: number) {
    const t = this.time;
    const f = this.flags;
    const c = this.center;

    // --- 0..0.45 Gather: a sun disc swells in front of her chest, the five shards close in on it. ---
    if (!f.fired) {
      const k = smoothstep(t / HIT_T);
      this.v1.copy(this.hold).addScaledVector(this.view, -0.1);
      dawnOrient(this.view, UP, this.q1);
      this.q1.multiply(this.q2.setFromAxisAngle(Z, t * 5));
      this.emblem.opacity = 1;
      this.emblem.set(0, this.v1, this.q1, 0.4 + 1.2 * dawnEaseOutBack(t / HIT_T));
      const half = THREE.MathUtils.degToRad(ANGLE) / 2;
      for (let i = 0; i < SHARDS; i++) {
        const a = this.yaw + ((i / (SHARDS - 1)) * 2 - 1) * half * 0.8;
        // Each shard hangs on its own bearing, in close to the disc as the wind-up runs out.
        this.v2.set(Math.sin(a), 0, Math.cos(a));
        this.v3.copy(this.hold).addScaledVector(this.v2, 1.5 * (1 - k) + 0.5).setY(1.2 + 0.15 * Math.sin(t * 20 + i));
        dawnPanelNormal(this.v2.setY(0.3).normalize(), this.view, this.v1);
        dawnOrient(this.v1, this.v2, this.q1);
        this.panels.place(i, this.v3, this.q1, 1.1, 'shard', 1.4, i % 2 ? DAWN.hot : DAWN.foil);
      }
    } else {
      // --- The cone: the fan shoots out across the floor, the disc flares, rays run along the fan. ---
      const a = t - HIT_T;
      const grow = 1 - Math.pow(1 - THREE.MathUtils.clamp(a / 0.16, 0, 1), 3);
      const fade = 1 - THREE.MathUtils.clamp((a - 0.12) / 0.5, 0, 1);
      this.fan.visible = this.fanDark.visible = this.fanEdge.visible = fade > 0.01;
      for (const m of [this.fan, this.fanDark, this.fanEdge]) m.scale.setScalar(Math.max(1e-3, RANGE * grow));
      (this.fanDark.material as THREE.MeshBasicMaterial).opacity = 0.5 * fade;
      (this.fan.material as THREE.MeshBasicMaterial).opacity = 0.55 * fade;
      (this.fanEdge.material as THREE.MeshBasicMaterial).opacity = fade;
      const u = smoothstep(a / 0.3);
      this.emblem.opacity = 1 - u;
      if (a < 0.3) {
        this.v1.copy(this.hold).addScaledVector(this.view, -0.1);
        dawnOrient(this.view, UP, this.q1);
        this.q1.multiply(this.q2.setFromAxisAngle(Z, t * 5));
        this.emblem.set(0, this.v1, this.q1, 1.6 + 1.6 * u);
      } else this.emblem.hide(0);
      const sp = StarBurst.pop(a, 0.01, 0.1);
      this.flare.set(this.hold, 1.5 * sp.scale + 1e-3, sp.opacity, 0.2);
      // Rays along the floor, fanned across the cone.
      this.rays.normal.set(0, 1, 0);
      this.rays.fan(this.v1.set(this.from.x, 0.1, this.from.z), this.v2.copy(this.fwd), 9, RANGE * 0.95, THREE.MathUtils.degToRad(ANGLE) / 2, smoothstep(a / 0.16), 0.32);
      this.rays.fade(1 - smoothstep((a - 0.1) / 0.4));
      // The hit: sun-wheel flash under the enemy, a sky-blue star, one impact frame.
      if (this.hitAge >= 0) {
        const h = this.hitAge;
        this.hitAge += dt;
        this.screen.impact = impactFrameAt(h, 0, [1], 0.03);
        this.sigil.set(this.v1.set(this.hitAt.x, 0, this.hitAt.z), 1.5);
        this.sigil.hide = 0;
        this.sigil.reveal = 1;
        this.sigil.opacity = 1 - smoothstep(h / 0.5);
        const hp = StarBurst.pop(h, 0, 0.04);
        this.star.set(this.hitAt, 0.9 * hp.scale + 1e-3, hp.opacity, 0.2);
      }
    }

    // --- The shield's small plates orbit her while it holds. ---
    if (this.rec && this.burstT < 0 && this.crumbleT < 0) {
      const base = SHARDS;
      const since = t - this.recAt;
      const grow = smoothstep(since / 0.25);
      const shiver = since > Q_SHIELD_SECONDS - 0.5 ? 0.04 * Math.sin(t * 46) : 0;
      for (let i = 0; i < ORBIT; i++) {
        const a = t * 2.4 + (i / ORBIT) * Math.PI * 2;
        this.v2.set(Math.sin(a), 0, Math.cos(a));
        this.v3.set(c.x + this.v2.x * (0.95 + shiver), 1.15, c.z + this.v2.z * (0.95 + shiver));
        dawnOrient(this.v2, UP, this.q1);
        this.panels.place(base + i, this.v3, this.q1, 1.0 * (0.4 + 0.6 * grow), 'shield', 1.2, i % 2 ? DAWN.hot : DAWN.foil);
      }
      // The plates fly in and click into their orbit the moment the shield opens.
      if (this.recFresh) {
        this.recFresh = false;
        this.panels.assemble(0.25, 0.1, 3);
      }
    }

    // --- After the end: the burst ring. ---
    if (this.burstT >= 0) {
      const a = t - this.burstT;
      const k = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      const grow = 1 - Math.pow(1 - k, 3);
      this.burstHalo.set(this.v1.set(this.burstAt.x, 0.09, this.burstAt.z), UP, 0.5 + (Q_BURST_RADIUS - 0.5) * grow);
      this.burstHalo.opacity = 0.95 * (1 - smoothstep((a - 0.2) / 0.4));
      this.burstHalo.spin(dt);
      this.shock.set(this.v1.set(this.burstAt.x, 0, this.burstAt.z), 0.5 + 2.6 * grow, 0.035 * (1 - k) * (1 - k));
      const bp = StarBurst.pop(a, 0, 0.05);
      this.flare.set(this.v1.set(this.burstAt.x, 1.2, this.burstAt.z), 1.2 * bp.scale + 1e-3, bp.opacity, 0.3);
    }
  }
}

export const firstLightModule: EffectModule = {
  label: 'first light',
  category: 'hero: dawn',
  // Around her: the duel AI casts it when the enemy is within radius - 0.6 (6 m), the cone's reach. The direction is the
  // caster's yaw, which the arena has just turned toward the nearest enemy (QUICK: no aim).
  targeting: { mode: 'self', radius: SELF_RADIUS },
  create: () => new FirstLight(),
  telegraphs(effect) {
    const e = effect as FirstLight;
    const ctx = e.ctx;
    if (!ctx) return [];
    // Live from the first frame, so a target that leaves before the hit is not hit. The burst has no telegraph (`projectile`).
    return [{ shape: { kind: 'cone', x: ctx.from.x, z: ctx.from.z, radius: RANGE, angle: ANGLE, dir: ctx.aim }, start: 0, impact: HIT_T, until: HIT_T + 0.15 }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as FirstLight;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as FirstLight).settings;
    f.add(s, 'loop');
    f.add(s, 'previewBurst');
    f.add(s, 'damage', 1, 120, 1);
    f.add(s, 'burst', 1, 80, 1);
    f.add(s, 'knock', 0, 20, 1);
  },
};
