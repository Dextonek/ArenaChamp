import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { Coins, GroundWord, InkSplats, Invoice, LEDGER, LEDGER_CSS, PaperBits } from '../../effects/parts/ledger';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { FEE_DAMAGE, FEE_DELAY, FEE_RADIUS, FEE_SLOW } from '../../traits/ledger';

/**
 * Late Fee (ledger kit, W: a notice that lands). A gold ring of ruled lines draws itself on the ground at the aimed spot (9 m,
 * radius 2.5) and an enormous LATE FEE notice drops out of the sky onto it, rolling and flapping as it comes, a loose coin or two
 * falling with it. At 1.0 s it lands flat with a slap: the ring floods red, a stamp-print of LATE FEE is left on the floor, a ground
 * ripple, a burst of paper and gold coins that bounce. Whoever stands in the ring at that moment (the live position, judged then)
 * is slowed for 1.5 s and takes 40, which goes on the tab (`src/traits/ledger.ts`) rather than hurting now. The notice lies a
 * moment, then shrinks into the floor; clean by about 2.3 s. See pipeline/designs/kit-ledger.md.
 */
export interface LateFeeSettings {
  damage: number;
  /** Seconds of slow on the hit. */
  slow: number;
  loop: boolean;
}

export const defaultLateFee = (): LateFeeSettings => ({ damage: FEE_DAMAGE, slow: FEE_SLOW, loop: false });

// Timeline (seconds).
const FALL_T = 0.05;
const LAND_T = FEE_DELAY;
const GONE_T = 1.9;
const DURATION = 2.4;
const START_Y = 8;

export class LateFee implements Effect {
  readonly group = new THREE.Group();
  readonly settings: LateFeeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private point = new THREE.Vector3(0, 0, -8);
  private landed = false;
  private yaw = 0;

  private paper = new Invoice(3.6, 4.6, 'LATE FEE', 'LATE');
  private bank = new THREE.Group();
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(FEE_RADIUS - 0.12, FEE_RADIUS, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: LEDGER.gold, transparent: true, depthWrite: false, opacity: 0 }),
  );
  private flood = new THREE.Mesh(
    new THREE.CircleGeometry(FEE_RADIUS, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: LEDGER.red, transparent: true, depthWrite: false, opacity: 0 }),
  );
  private word = new GroundWord('LATE FEE', 3.6, 1.3);
  private bits = new PaperBits(80);
  private coins = new Coins(26);
  private ink = new InkSplats(4);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: LEDGER.gold, core: LEDGER.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();

  constructor(settings: LateFeeSettings = defaultLateFee()) {
    this.settings = settings;
    this.ring.renderOrder = 1;
    this.flood.renderOrder = 1;
    this.paper.mesh.rotation.x = -Math.PI / 2;
    this.bank.add(this.paper.mesh);
    this.group.add(this.flood, this.ring, this.ink.group, this.word.mesh, this.bank, this.bits.mesh, this.coins.mesh, this.pop.mesh, this.shock.mesh);
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
    clearScreenFx(this.screen);
    this.paper.mesh.visible = false;
    this.bits.reset();
    this.coins.reset();
    this.ink.reset();
    this.word.set(0, 0, 0, 0);
    this.pop.set(this.point, 0, 0);
    this.shock.set(this.point, 0, 0);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.flood.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.bits.update(dt);
    this.coins.update(dt);
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

    // --- The ring of ruled lines draws on. ---
    this.ring.position.set(p.x, 0.05, p.z);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = (t < LAND_T ? 0.35 + 0.5 * smoothstep(t / 0.4) : 0.9 * (1 - smoothstep((t - LAND_T - 0.5) / 0.9)));

    // --- The notice falls (ease-in), tipping and flapping, and settles flat. ---
    if (t < GONE_T) {
      const u = THREE.MathUtils.clamp((t - FALL_T) / (LAND_T - FALL_T), 0, 1), fall = u * u;
      const sway = (1 - u) * (1 - u);
      this.paper.mesh.visible = true;
      this.bank.position.set(p.x + Math.sin(t * 5) * 1.6 * sway, START_Y * (1 - fall) + 0.07, p.z + Math.cos(t * 4.3) * 1.2 * sway);
      this.bank.rotation.set(Math.sin(t * 7) * 0.7 * sway, this.yaw + Math.sin(t * 3) * 0.5 * sway, Math.sin(t * 6.3) * 0.7 * sway);
      this.paper.flutter(t, t < LAND_T ? 2.4 * sway + 0.3 : Math.max(0, 1 - (t - LAND_T) * 2), 14);
      const shrink = t > GONE_T - 0.4 ? Math.max(0.001, (GONE_T - t) / 0.4) : 1;
      this.bank.scale.set(shrink, shrink, shrink);
      // A coin or two shaken loose on the way down.
      if (t < LAND_T - 0.1 && Math.random() < dt * 9) this.coins.burst(this.v1.copy(this.bank.position), 1, 1.5);
    } else this.paper.mesh.visible = false;

    // --- 1.0 The slap: the hit is decided by the live position against the fixed spot. ---
    if (!this.landed && t >= LAND_T) {
      this.landed = true;
      this.slap(ctx);
    }
    if (this.landed) {
      const a = t - LAND_T;
      this.word.set(p.x, p.z, this.yaw, 0.9 * Math.min(1, a / 0.08) * (1 - smoothstep((a - 0.9) / 0.5)), 0.8 + 0.2 * Math.min(1, a / 0.2));
      const g = smoothstep(a / 0.4);
      this.shock.set(this.v1.set(p.x, 0, p.z), 0.5 + 4.2 * g, 0.045 * (1 - g) * (1 - g));
      const fm = this.flood.material as THREE.MeshBasicMaterial;
      this.flood.position.set(p.x, 0.045, p.z);
      fm.opacity = 0.5 * Math.exp(-a * 2.2);
      const sp = StarBurst.pop(a, 0.05, 0.2);
      this.pop.set(this.v1.set(p.x, 1.0, p.z), 3.4 * sp.scale, sp.opacity, a * 3);
      this.shake = 0.45 * Math.exp(-a * 9);
    }
  }

  private slap(ctx: CastContext | null) {
    const p = this.point;
    if (ctx) {
      // Re-check at impact: whoever stands in the ring now.
      for (const e of ctx.targets) {
        const q = e.group.position;
        if (Math.hypot(q.x - p.x, q.z - p.z) <= FEE_RADIUS) {
          ctx.hit(e, { damage: this.settings.damage, knock: 2, from: p, color: LEDGER_CSS.gold, status: { kind: 'slow', seconds: this.settings.slow } });
        }
      }
    }
    this.ink.splat(p.x, p.z, FEE_RADIUS * 0.8, LEDGER.red, 2.0);
    this.bits.burst(this.v1.set(p.x, 0.5, p.z), 36, 7, 1.3, 0.35);
    this.coins.burst(this.v1.set(p.x, 0.6, p.z), 14, 4.5);
    this.shake = 0.45;
  }
}

export const lateFeeModule: EffectModule = {
  label: 'late fee',
  category: 'hero: ledger',
  targeting: { mode: 'ground', radius: FEE_RADIUS },
  create: () => new LateFee(),
  telegraphs(effect) {
    const e = effect as LateFee;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: FEE_RADIUS }, start: 0, impact: LAND_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as LateFee;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as LateFee).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 200, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
