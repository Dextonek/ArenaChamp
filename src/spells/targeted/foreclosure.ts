import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, flashBeat, impactFrameAt } from '../../effects/parts';
import { stillSees } from '../../effects/channel';
import { GroundWord, InkSplats, LEDGER, LEDGER_CSS, PaperBits, buildStamp } from '../../effects/parts/ledger';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { STAMP_DELAY, STAMP_EXPOSE, STAMP_EXPOSE_SECONDS, STAMP_RADIUS } from '../../traits/ledger';

/**
 * Foreclosure (ledger kit, R: the stamp). A red ring of ink draws on the ground at the aimed spot (9 m, radius 2.2) and a huge
 * rubber stamp, a brass-banded wooden block with a round knob, drops out of the sky onto it, fast and heavy, tilted a little. It
 * lands at 0.8 s (the ring's countdown): one impact frame (a short anime cut in the cast's own colours), a whiteout blink, a ground
 * ripple, ink flung out in a ring in splats on the floor, red notices thrown up, and FINAL NOTICE printed on the floor in stamp ink.
 * The stamp stays pressed a moment, then lifts away and the print dries.
 *
 * The hit: whoever's live position is in the ring at that moment AND is still seen by Ledger (`stillSees`: cover between them
 * saves them, like the other sight spells) takes a hit of damage 1 that the trait (`dealt`, slot 3) replaces by their whole tab x 1.6
 * and empties it, with the debuff `vulnerable` (20%: they take +20% from him) for 3 s. No sight: the stamp slams a bare floor, a
 * puff of scraps and no print. Clean by about 2.6 s, under the gameplay camera. See pipeline/designs/kit-ledger.md.
 */
export interface ForeclosureSettings {
  /** The hit the trait replaces: it only has to exist (the damage is the tab x 1.6). */
  damage: number;
  /** Seconds of +20% damage taken from him. */
  expose: number;
  loop: boolean;
}

export const defaultForeclosure = (): ForeclosureSettings => ({ damage: 1, expose: STAMP_EXPOSE_SECONDS, loop: false });

// Timeline (seconds).
const FALL_T = 0.1;
const LAND_T = STAMP_DELAY;
const LIFT_T = LAND_T + 0.55;
const GONE_T = LAND_T + 1.1;
const DURATION = 2.7;
const START_Y = 11;
const FACE_W = 3.6;
const FACE_D = 1.7;

export class Foreclosure implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ForeclosureSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private point = new THREE.Vector3(0, 0, -8);
  private yaw = 0;
  private landed = false;
  private seen = true;

  private stamp = buildStamp(FACE_W, FACE_D);
  private word = new GroundWord('FINAL NOTICE', FACE_W, FACE_D);
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(STAMP_RADIUS - 0.14, STAMP_RADIUS, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: LEDGER.hotRed, transparent: true, depthWrite: false, opacity: 0 }),
  );
  private flood = new THREE.Mesh(
    new THREE.CircleGeometry(STAMP_RADIUS, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: LEDGER.red, transparent: true, depthWrite: false, opacity: 0 }),
  );
  private ink = new InkSplats(8);
  private bits = new PaperBits(90);
  private blast = new StarBurst({ points: 12, inner: 0.28, color: LEDGER.hotRed, core: LEDGER.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();

  constructor(settings: ForeclosureSettings = defaultForeclosure()) {
    this.settings = settings;
    this.ring.renderOrder = 1;
    this.flood.renderOrder = 1;
    this.screen.impactColor.set(LEDGER.core);
    this.screen.tint.set(LEDGER.dark);
    this.group.add(this.flood, this.ring, this.ink.group, this.word.mesh, this.stamp, this.bits.mesh, this.blast.mesh, this.shock.mesh);
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
    this.point.copy(ctx.point).setY(0);
    this.yaw = ctx.aim;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landed = false;
    this.seen = true;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(LEDGER.core);
    this.screen.tint.set(LEDGER.dark);
    this.stamp.visible = false;
    this.bits.reset();
    this.ink.reset();
    this.word.set(0, 0, 0, 0);
    this.blast.set(this.point, 0, 0);
    this.shock.set(this.point, 0, 0);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.flood.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.bits.update(dt);
    this.ink.update(dt);
    this.time += dt;
    const t = this.time, ctx = this.ctx, p = this.point;
    if (t >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      return;
    }

    // --- The red ring draws on and closes in on the countdown. ---
    this.ring.position.set(p.x, 0.05, p.z);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = t < LAND_T ? 0.4 + 0.5 * smoothstep(t / 0.35) : 0.9 * (1 - smoothstep((t - LAND_T) / 0.4));

    // --- The stamp: falls with a hard ease-in, presses, lifts away. ---
    if (t < GONE_T) {
      const u = THREE.MathUtils.clamp((t - FALL_T) / (LAND_T - FALL_T), 0, 1);
      let y = START_Y * (1 - u * u * u);
      if (t >= LIFT_T) y = 9 * Math.pow((t - LIFT_T) / (GONE_T - LIFT_T), 2);
      const tilt = (1 - u) * 0.25;
      this.stamp.visible = t >= FALL_T;
      this.stamp.position.set(p.x, y + 0.02, p.z);
      this.stamp.rotation.set(tilt, this.yaw, -tilt * 0.6, 'YXZ');
    } else this.stamp.visible = false;

    // --- 0.8 The slam: the hit is decided by the live position against the fixed spot, and by sight. ---
    if (!this.landed && t >= LAND_T) {
      this.landed = true;
      this.slam(ctx);
    }
    if (this.landed) {
      const a = t - LAND_T;
      this.screen.impact = impactFrameAt(t, LAND_T, [2, 1], 0.04);
      const fb = flashBeat(t, LAND_T + 0.08, 0.04, 0.3, 0);
      this.screen.exposure = fb.exposure;
      this.screen.whiteout = 0.6 * fb.whiteout;
      this.screen.darken = 0.3 * (1 - smoothstep((a - 0.15) / 0.8));
      if (this.seen) this.word.set(p.x, p.z, this.yaw, 0.92 * Math.min(1, a / 0.06) * (1 - smoothstep((a - 1.1) / 0.5)), 1);
      const fm = this.flood.material as THREE.MeshBasicMaterial;
      this.flood.position.set(p.x, 0.045, p.z);
      fm.opacity = (this.seen ? 0.55 : 0.2) * Math.exp(-a * 1.6);
      const g = smoothstep(a / 0.45);
      this.shock.set(this.v1.set(p.x, 0, p.z), 0.5 + 5.4 * g, 0.055 * (1 - g) * (1 - g));
      const bp = StarBurst.pop(a - 0.04, 0.03, 0.22);
      this.blast.set(this.v1.set(p.x, 1.2, p.z), 4.6 * bp.scale, bp.opacity, a * 2);
      this.shake = 0.9 * Math.exp(-a * 8);
    }
  }

  private slam(ctx: CastContext | null) {
    const p = this.point;
    if (ctx) {
      for (const e of ctx.targets) {
        const q = e.group.position;
        if (Math.hypot(q.x - p.x, q.z - p.z) > STAMP_RADIUS) continue;
        // Cover saves them: the stamp needs Ledger to see them when it lands.
        if (!stillSees(ctx, q)) { this.seen = false; continue; }
        ctx.hit(e, {
          damage: this.settings.damage, knock: 5, from: p, color: LEDGER_CSS.gold,
          debuff: { kind: 'vulnerable', amount: STAMP_EXPOSE, seconds: this.settings.expose },
        });
      }
    }
    // Ink flung out in a ring of splats; scraps and red notices thrown up.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3, r = STAMP_RADIUS * (0.55 + 0.35 * ((i * 5) % 3) / 2);
      this.ink.splat(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 0.5 + 0.25 * (i % 3), i % 2 ? LEDGER.red : LEDGER.dark, 1.9);
    }
    this.ink.splat(p.x, p.z, STAMP_RADIUS * 0.7, LEDGER.red, 1.9);
    this.bits.burst(this.v1.set(p.x, 0.6, p.z), 48, 8, 1.4, 0.55);
    this.shake = 0.9;
  }
}

export const foreclosureModule: EffectModule = {
  label: 'foreclosure',
  category: 'hero: ledger',
  targeting: { mode: 'ground', radius: STAMP_RADIUS },
  create: () => new Foreclosure(),
  telegraphs(effect) {
    const e = effect as Foreclosure;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: STAMP_RADIUS }, start: 0, impact: LAND_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Foreclosure;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as Foreclosure).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 50, 1);
    f.add(s, 'expose', 0, 6, 0.5);
  },
};
