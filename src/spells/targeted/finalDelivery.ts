import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { COURIER, COURIER_CSS, Flecks, buildParcel, wordSprite } from '../../effects/parts/courier';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { FINAL_DAMAGE, FINAL_PER_CHARGE, FINAL_RADIUS, FINAL_SPEED, FINAL_TIME, PARCEL_NAME, bookOf, type FinalRec } from '../../traits/courier';

/**
 * Final Delivery (courier kit v5, R: a parcel that hunts). Pip spends ALL his Charges and a big brown parcel with the enemy's name
 * on its label (URGENT: nothing in a trait or the cast context reads a hero's name) pops up at his side and goes after the enemy
 * for 1.5 s at 5 m/s: a mark that follows, on both screens (the enemy's position is known on both). SIGN HERE hangs over it, a red
 * ring 2 m wide round it on the floor (the burst's real size) fills as the seconds pass, and it trails paper. A walker (4 m/s) loses
 * only 1 m/s to it, so the cure is to walk, or to touch cover first.
 *
 * The burst: at 1.5 s, 80 + 40 per Charge spent to every hero within 2 m of the parcel (decided on the victim's screen, in
 * `victimTick` of his trait, with `t.hitEnemy`: this effect only draws it). It is one short impact frame, a flash, the paper flying,
 * FRAGILE stickers scattered and DELIVERED over the spot. The signature: if the hunted hero touches cover (within 0.7 m of its
 * surface) before then, the parcel stops, a blue SIGNED stamp lands on it, and it flies back to Pip and is gone: the trait sets
 * `FinalRec.state = 'signed'` on the victim's screen and tells his client. The Charges spent are not returned: the parcel is, as a
 * look. `paid` (read from the book at the cast) makes it bigger. Clean by 3 s. See pipeline/designs/kit-courier.md.
 */
export interface FinalDeliverySettings {
  /** Damage with no Charge spent, and what each Charge adds (the trait reads the constants; the GUI shows them). */
  damage: number;
  perCharge: number;
  loop: boolean;
}

export const defaultFinalDelivery = (): FinalDeliverySettings => ({ damage: FINAL_DAMAGE, perCharge: FINAL_PER_CHARGE, loop: false });

// Timeline (seconds).
const BURST_T = FINAL_TIME;
const END_T = 3.0;
const FLY_Y = 1.25;
const RETURN_T = 0.7;
const MIN = 1e-3;

export class FinalDelivery implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FinalDeliverySettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private rec: FinalRec | null = null;
  private signedAt = -1;
  private burstAt = -1;
  private paid = 0;
  private trailT = 0;
  private spawn = new THREE.Vector3();

  private holder = new THREE.Group();
  private parcel = buildParcel(PARCEL_NAME);
  private bits = new Flecks(90);
  private stickers = new Flecks(16, true);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: COURIER.paper, core: 0xffffff, additive: false });
  private flash = new StarBurst({ points: 12, inner: 0.28, color: COURIER.accent, core: COURIER.cream, additive: false });
  private stamp = new StarBurst({ points: 8, inner: 0.3, color: COURIER.foil, core: COURIER.blueLight, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private sign = wordSprite('SIGN HERE', COURIER_CSS.dark, COURIER_CSS.accent, 2.4);
  private signed = wordSprite('SIGNED', COURIER_CSS.cream, COURIER_CSS.foil, 2.0);
  private delivered = wordSprite('DELIVERED', COURIER_CSS.dark, COURIER_CSS.accent, 3.0);
  private zone = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COURIER.red, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private fill = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COURIER.red, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private v1 = new THREE.Vector3();

  constructor(settings: FinalDeliverySettings = defaultFinalDelivery()) {
    this.settings = settings;
    this.screen.impactColor.set(COURIER.cream);
    this.zone.renderOrder = 3;
    this.fill.renderOrder = 2;
    this.holder.add(this.parcel);
    this.parcel.position.y = -0.3;
    this.group.add(
      this.fill, this.zone, this.holder, this.bits.mesh, this.stickers.mesh, this.pop.mesh, this.flash.mesh, this.stamp.mesh, this.shock.mesh,
      this.sign, this.signed, this.delivered,
    );
    this.reset();
  }

  get duration() {
    return END_T;
  }

  get impactTime() {
    return BURST_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // The parcel is born at his side and starts hunting at once; both screens keep its place in the book.
    const b = bookOf(ctx.caster);
    this.paid = Math.min(3, b.paid);
    const p = ctx.caster.group.position;
    this.spawn.set(p.x, 0, p.z);
    this.rec = b.fin = { t0: performance.now(), x: p.x, z: p.z, state: 'fly', paid: b.paid, hitDone: false };
    this.v1.set(p.x, 1.2, p.z);
    this.bits.burst(this.v1, 10, [COURIER.paper, COURIER.cream, COURIER.brown], 2.6, 2.2, 0.15);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.signedAt = -1;
    this.burstAt = -1;
    this.trailT = 0;
    this.rec = null;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(COURIER.cream);
    this.holder.visible = false;
    this.bits.reset();
    this.stickers.reset();
    this.pop.set(this.spawn, 0, 0);
    this.flash.set(this.spawn, 0, 0);
    this.stamp.set(this.spawn, 0, 0);
    this.shock.set(this.spawn, 0, 0);
    for (const w of [this.sign, this.signed, this.delivered]) w.visible = false;
    for (const m of [this.zone, this.fill]) { m.visible = false; (m.material as THREE.MeshBasicMaterial).opacity = 0; }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bits.update(dt);
    this.stickers.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, r = this.rec;
    const grow = 1.15 + 0.12 * this.paid;
    const hunted = ctx?.targets[0];

    if (r && r.state === 'fly') {
      // --- Hunting: toward the enemy's live position at 5 m/s, bobbing, trailing paper. ---
      if (hunted) {
        const e = hunted.group.position, dx = e.x - r.x, dz = e.z - r.z, d = Math.hypot(dx, dz);
        const step = Math.min(FINAL_SPEED * dt, Math.max(0, d - 0.3));
        if (d > 1e-3) { r.x += (dx / d) * step; r.z += (dz / d) * step; }
      }
      this.holder.visible = true;
      this.holder.position.set(r.x, FLY_Y + 0.12 * Math.sin(t * 9), r.z);
      this.holder.rotation.set(0.1 * Math.sin(t * 7), t * 2.2, 0.12 * Math.sin(t * 6 + 1));
      this.holder.scale.setScalar(Math.max(MIN, smoothstep(t / 0.25) * grow));
      this.trailT += dt;
      if (this.trailT >= 0.05) {
        this.trailT = 0;
        this.bits.burst(this.v1.set(r.x, FLY_Y - 0.1, r.z), 1, [COURIER.paper, COURIER.cream, COURIER.string], 0.9, 0.5, 0.12, 0.9);
      }
      // SIGN HERE hangs over it; the zone it will burst in closes in on it.
      this.sign.visible = true;
      this.sign.position.set(r.x, FLY_Y + 1.35 + 0.08 * Math.sin(t * 5), r.z);
      const w = smoothstep(t / 0.2);
      this.sign.scale.set(2.4 * Math.max(MIN, w), 0.8 * Math.max(MIN, w), 1);
      this.zoneAt(r.x, r.z, t / BURST_T);
      if (t >= BURST_T) { r.state = 'burst'; this.burstAt = t; this.burst(r); }
    } else if (r && r.state === 'signed') {
      // --- Signed for: it stops, a blue stamp lands on it, and it flies home to him. ---
      if (this.signedAt < 0) {
        this.signedAt = t;
        this.stamp.set(this.v1.set(r.x, FLY_Y + 0.2, r.z), 1.6, 1, 0);
        this.shake = 0.1;
        this.bits.burst(this.v1, 8, [COURIER.foil, COURIER.blueLight, COURIER.cream], 3, 2.4, 0.14);
      }
      const a = t - this.signedAt, home = ctx?.caster.group.position ?? this.spawn;
      const k = smoothstep((a - 0.35) / RETURN_T);
      this.holder.visible = a < 0.35 + RETURN_T;
      this.holder.position.set(r.x + (home.x - r.x) * k, FLY_Y + 0.2 * (1 - k) + 0.6 * k + 0.4 * Math.sin(Math.PI * k), r.z + (home.z - r.z) * k);
      this.holder.rotation.y += 9 * dt * k;
      this.holder.scale.setScalar(Math.max(MIN, grow * (1 - 0.8 * k)));
      const sp = StarBurst.pop(a, 0.1, 0.2);
      this.stamp.set(this.v1.set(r.x, FLY_Y + 0.2, r.z), 1.6 * sp.scale, sp.opacity, a * 2);
      this.sign.visible = false;
      const out = 1 - smoothstep((a - 0.9) / 0.4), w = Math.min(1, a / 0.1);
      this.signed.visible = out > 0.02;
      this.signed.position.set(r.x, FLY_Y + 1.4 + 0.3 * smoothstep(a / 0.9), r.z);
      this.signed.scale.set(2.0 * Math.max(MIN, w * out), 0.67 * Math.max(MIN, w * out), 1);
      this.zoneAt(r.x, r.z, 0, 1 - smoothstep(a / 0.25));
    } else if (r && r.state === 'burst') {
      this.holder.visible = false;
      this.sign.visible = false;
      this.afterBurst(r, t - this.burstAt);
    }
    this.shake *= Math.exp(-dt * 9);

    if (t >= END_T && !this.bits.busy && !this.stickers.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  /** The red ring on the floor round the parcel: its real size (2 m), a fill that rises with `k` (0..1), `fade` to hide it. */
  private zoneAt(x: number, z: number, k: number, fade = 1) {
    const kk = Math.min(1, Math.max(0, k));
    for (const m of [this.zone, this.fill]) { m.visible = true; m.position.set(x, m === this.zone ? 0.07 : 0.05, z); m.scale.setScalar(FINAL_RADIUS); }
    (this.zone.material as THREE.MeshBasicMaterial).opacity = (0.5 + 0.45 * kk) * fade;
    (this.fill.material as THREE.MeshBasicMaterial).opacity = (0.1 + 0.3 * kk * kk) * fade;
  }

  /** The burst itself: paper, stickers, a flash and an impact frame. The hit is the trait's (`victimTick`). */
  private burst(r: FinalRec) {
    this.shake = 0.95;
    const big = 1 + 0.15 * this.paid;
    this.v1.set(r.x, 1.0, r.z);
    this.bits.burst(this.v1, 60, [COURIER.paper, COURIER.cream, COURIER.brown, COURIER.string, COURIER.brownDark], 9 * big, 7, 0.22, 1.7);
    this.stickers.burst(this.v1, 14, [COURIER.red], 7 * big, 6, 0.55, 2.0);
    this.zone.visible = this.fill.visible = true;
  }

  private afterBurst(r: FinalRec, a: number) {
    const t = this.time;
    this.screen.impact = impactFrameAt(t, this.burstAt, [2, 1], 0.04);
    const p = StarBurst.pop(a, 0.03, 0.22), g = Math.min(1, a / 0.3);
    this.flash.set(this.v1.set(r.x, 1.3, r.z), 5.2 * p.scale, p.opacity, a * 2);
    this.pop.set(this.v1.set(r.x, 0.7, r.z), 3 * p.scale, p.opacity, -a * 3);
    this.shock.set(this.v1.set(r.x, 0, r.z), 0.5 + FINAL_RADIUS * 2 * g, 0.06 * (1 - g) * (1 - g));
    this.zoneAt(r.x, r.z, 1, 1 - smoothstep(a / 0.4));
    (this.fill.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - smoothstep(a / 0.3));
    const w = Math.min(1, a / 0.12), out = 1 - smoothstep((a - 0.9) / 0.4);
    this.delivered.visible = out > 0.02;
    this.delivered.position.set(r.x, 2.4 + 0.5 * smoothstep(a / 1.0), r.z);
    this.delivered.scale.set(3.0 * Math.max(MIN, w * out), 1.0 * Math.max(MIN, w * out), 1);
  }
}

export const finalDeliveryModule: EffectModule = {
  label: 'final delivery',
  category: 'hero: courier',
  // The parcel hunts the clicked or nearest enemy; the reach is the trait's, the real shape is drawn by the effect.
  targeting: { mode: 'enemy' },
  create: () => new FinalDelivery(),
  // The burst's place is not known until it is time (the parcel moves), so no zone exists before; the hit is a trait hit.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as FinalDelivery;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as FinalDelivery).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 200, 1);
    f.add(s, 'perCharge', 0, 100, 1);
  },
};
