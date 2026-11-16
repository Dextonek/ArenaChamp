import * as THREE from 'three';
import { smoothstep } from '../../../effects/common';
import { ShockRefraction, StarBurst } from '../../../effects/parts';
import type { Look } from '../../framework/blocks';
import { spell, type Cast } from '../../framework/spell';
import anka from '../hero';
import { QUILL_DAMAGE, QUILL_RADIUS, QUILL_RANGE, QUILL_SPEED, QUILL_WIND, STAMP_R } from '../numbers';
import { FeatherFlock, PHOENIX, PHOENIX_CSS, disc, nestLook } from '../parts';
import { castNo, emberLive, layEmber } from '../trait';

/**
 * Ember Quill (Anka's Q: a 10 m line skillshot). She flicks her fan (0.3 s wind-up) and a feather flies down the aim at 22 m/s
 * (radius 0.3): it reaches 6 m at 0.57 s, so a sidestep after the flick is enough. The first enemy it touches takes 54. Where
 * the quill stops (in the enemy it hit, at the end of its flight, or at a wall) it stays in the floor as an EMBER and becomes
 * her nest: the passive's (`layEmber` in ../trait.ts, drawn there on both screens). Online a bolt flies on both screens; the
 * screen that decides the hit tells her client where the quill really ended (the passive's `lay` note).
 *
 * The look. The flick: a fan of seven feathers opens at her left hand, cocked back, and snaps forward at the release with a
 * small gold glint. The quill: one long feather with its eye, flying point first, four feathers of flame and a short
 * streak of flame behind it, shedding sparks of flame feathers. The landing: it swings upright and plants in the floor in a
 * small burst of feather sparks, a gold flash on the floor and a ring of force. The ember it leaves is the passive's.
 * Timeline: wind-up 0-0.3, flight to 0.75, the landing burst gone 0.5 s after it lands, clean by 1.3 s.
 * Without a passive (the VFX tool) the effect shows its own feather in the floor for 2 s (and lasts that much longer).
 */
interface Quill {
  /** This cast's number among hers (`castNo`): the ember it lays carries it, so both screens keep the embers in one order. */
  seq: number;
}

const LOCAL_EMBER_S = 2; // how long the effect's own feather stands, where no passive draws the ember
const QUILL_LEN = 1.5;
const FLY_Y = 1.0;
const FAN = 7;
const UP = new THREE.Vector3(0, 1, 0);
const PLANTED = new THREE.Vector3(0.9, 1, 0.12); // how the ember's feather leans (the parts file's LEAN)

class QuillLook implements Look<Quill> {
  private landAt = -1;
  private left = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3(0, 1.4, 14);
  private landPos = new THREE.Vector3();
  private quillBase = new THREE.Vector3();
  private shed = 0;
  private localAt = -1;
  private plumes = new FeatherFlock('eye', 40);
  private flames = new FeatherFlock('flame', 90);
  private streak = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, 0, -1], 3)),
    new THREE.MeshBasicMaterial({ color: PHOENIX.body, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  );
  private flash = disc(1, PHOENIX.hot, 0, 0.04);
  private glint = new StarBurst({ points: 6, inner: 0.3, color: PHOENIX.hot, core: PHOENIX.core, additive: false });
  private pop = new StarBurst({ points: 9, inner: 0.3, color: PHOENIX.body, core: PHOENIX.hot, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  /** The effect's own feather in the floor, where no passive draws the ember (the VFX tool). */
  private local = nestLook(STAMP_R);
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(group: THREE.Group) {
    this.streak.frustumCulled = false;
    this.streak.renderOrder = 3;
    group.add(this.flash, this.streak, this.plumes.mesh, this.flames.mesh, this.glint.mesh, this.pop.mesh, this.shock.mesh, this.local);
  }

  reset() {
    this.landAt = -1;
    this.shed = 0;
    this.localAt = -1;
    this.plumes.reset();
    this.flames.reset();
    this.flash.visible = this.streak.visible = this.local.visible = false;
    this.glint.set(this.hand, 0, 0);
    this.pop.set(this.landPos, 0, 0);
    this.shock.set(this.landPos, 0, 0);
  }

  /** Her left hand, where the fan is. */
  cast(c: Cast<Quill>) {
    this.left.set(c.dir.z, 0, -c.dir.x);
    this.hand.copy(c.from).addScaledVector(c.dir, 0.45).addScaledVector(this.left, 0.3).setY(1.4);
    this.quillBase.copy(this.hand);
  }

  tick(dt: number) {
    this.plumes.update(dt);
    this.flames.update(dt);
  }

  released(c: Cast<Quill>) {
    c.shake = 0.06;
  }

  /** A small burst of feather sparks where it plants. */
  stopped(c: Cast<Quill>, x: number, z: number) {
    this.landAt = c.time;
    this.landPos.set(x, 0, z);
    this.flash.position.set(x, 0.04, z);
    this.flash.visible = true;
    this.flames.burst(this.v1.set(x, 0.35, z), 10, 3.4, 0.42, 0.45);
    this.plumes.burst(this.v1, 3, 2.6, 0.45, 0.5);
    if (!c.ctx || !emberLive(c.ctx.caster)) {
      // No passive draws the ember here (the VFX tool): the effect shows a feather of its own, and lasts that much longer.
      this.localAt = c.time;
      c.extend(c.time + LOCAL_EMBER_S + 0.05);
      this.local.position.set(x, 0, z);
    }
  }

  /**
   * The flick of the fan: seven feathers open at her hand like a hand of cards held toward the aim (its face up, so it reads
   * from the camera wherever she aims), drawn back and raised as they open, then snapped forward and down at the release.
   */
  private drawFan(c: Cast<Quill>, t: number) {
    if (t >= QUILL_WIND + 0.14) return;
    const open = t < QUILL_WIND ? 1 - (1 - t / QUILL_WIND) ** 3 : 1;
    const snap = t < QUILL_WIND ? 0 : smoothstep((t - QUILL_WIND) / 0.07);
    const gone = t < QUILL_WIND ? 1 : 1 - smoothstep((t - QUILL_WIND - 0.04) / 0.1);
    // how far the fan is raised above level, and where its pivot is: drawn back, then thrust forward
    const lift = 0.12 + 0.5 * open * (1 - snap);
    const pivot = this.quillBase.copy(this.hand).addScaledVector(c.dir, 0.45 * snap - 0.25 * open * (1 - snap));
    const axis = this.v1.copy(c.dir).multiplyScalar(Math.cos(lift)).addScaledVector(UP, Math.sin(lift));
    const face = this.v2.copy(UP).multiplyScalar(Math.cos(lift)).addScaledVector(c.dir, -Math.sin(lift));
    const half = 0.95 * (0.15 + 0.85 * open);
    for (let i = 0; i < FAN; i++) {
      const th = (i / (FAN - 1) - 0.5) * 2 * half;
      const dir = this.v3.copy(axis).multiplyScalar(Math.cos(th)).addScaledVector(this.left, Math.sin(th));
      const mid = 1 - Math.abs(i - (FAN - 1) / 2) / ((FAN - 1) / 2);
      this.plumes.put(pivot, dir, (0.72 + 0.16 * mid) * (0.45 + 0.55 * open) * gone, 0, 1.2, face);
    }
  }

  /** The quill in flight with its tip near (x, z), flying along `dir`: one long feather, flames and a streak behind it, sparks shed. */
  private drawQuill(c: Cast<Quill>, x: number, z: number, dir: THREE.Vector3, dt: number, t: number) {
    const d = this.v1.set(dir.x, 0, dir.z);
    if (d.lengthSq() < 1e-8) d.copy(c.dir);
    d.normalize();
    const flown = Math.hypot(x - c.from.x, z - c.from.z);
    const len = Math.min(QUILL_LEN, 0.5 + flown);
    const base = this.quillBase.set(x, FLY_Y, z).addScaledVector(d, 0.25 - len);
    this.plumes.put(base, d, len, Math.sin(t * 38) * 0.14, 1.25);
    // feathers of flame behind it, smaller and smaller, weaving a little
    for (let i = 0; i < 4; i++) {
      const back = 0.3 + i * 0.5, size = 0.95 - i * 0.17;
      if (back + size > flown + 0.6) break;
      const sway = Math.sin(t * 30 + i * 1.9) * 0.07 * (i + 1);
      this.v2.copy(base).addScaledVector(d, -back).setY(FLY_Y - 0.04 * i);
      this.v2.x += d.z * sway;
      this.v2.z -= d.x * sway;
      this.flames.put(this.v2, d, size, i % 2 ? 0.5 : -0.5, 1.2);
    }
    // a short streak of flame under them
    this.streak.visible = true;
    this.streak.position.copy(base).setY(FLY_Y - 0.08);
    this.streak.rotation.y = Math.atan2(d.x, d.z);
    this.streak.scale.set(0.24, 1, Math.max(0.01, Math.min(2.4, flown)));
    this.shed += dt;
    while (this.shed > 0.04) {
      this.shed -= 0.04;
      this.flames.fall(this.v2.copy(base).addScaledVector(d, -0.4), 1, 0.12, 0.3, 0.3);
    }
  }

  frame(c: Cast<Quill>, t: number, dt: number) {
    // The flick of the fan, and a small gold glint as the quill leaves it.
    this.drawFan(c, t);
    const g = StarBurst.pop(t - QUILL_WIND, 0, 0.05);
    this.glint.set(this.v1.copy(this.hand).addScaledVector(c.dir, 0.5), 0.55 * g.scale + 1e-3, g.opacity, t * 5);

    // The quill in flight, on the bolt.
    this.streak.visible = false;
    if (c.bolt && c.bolt.alive) this.drawQuill(c, c.bolt.pos.x, c.bolt.pos.z, c.bolt.dir, dt, t);

    if (this.landAt >= 0) {
      const a = t - this.landAt;
      // it swings upright and plants (the ember that stays is the passive's)
      if (a < 0.1) {
        const k = smoothstep(a / 0.1);
        this.v1.copy(this.quillBase).lerp(this.landPos, k);
        this.v2.copy(c.dir).lerp(PLANTED, k);
        this.plumes.put(this.v1, this.v2, QUILL_LEN + 0.3 * k, 0, 1.2);
      }
      (this.flash.material as THREE.MeshBasicMaterial).opacity = 0.6 * Math.exp(-a * 9);
      this.flash.scale.setScalar(0.45 + a * 2.2);
      this.flash.visible = a < 0.6;
      const hp = StarBurst.pop(a, 0.03, 0.08);
      this.pop.set(this.v1.set(this.landPos.x, 0.5, this.landPos.z), 0.9 * hp.scale + 1e-3, hp.opacity, 0.4);
      const sg = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      this.shock.set(this.landPos, 0.3 + 1.3 * sg, 0.03 * (1 - sg) * (1 - sg));
      c.shake = Math.max(c.shake * 0.9, 0.1 * Math.exp(-a * 14));
    } else c.shake *= 0.9;

    if (this.localAt >= 0) {
      const a = t - this.localAt, left = LOCAL_EMBER_S - a;
      this.local.visible = left > 0;
      this.local.scale.setScalar(Math.max(left < 0.3 ? left / 0.3 : Math.min(1, 0.4 + a * 3), 1e-4));
    }
  }
}

export const emberQuillModule = spell<Quill>({
  label: anka.kit.spells[0].label,
  category: 'hero: phoenix',
  // A skillshot: the aim point only gives the direction (the quill flies its 10 m wherever the cursor is).
  targeting: { mode: 'ground', radius: QUILL_RADIUS },
  seconds: 1.3,
  state: () => ({ seq: 0 }),
  rules: {
    windup: QUILL_WIND,
    shape: { kind: 'bolt', speed: QUILL_SPEED, range: QUILL_RANGE, radius: QUILL_RADIUS },
    hit: { damage: QUILL_DAMAGE, knock: 1, color: PHOENIX_CSS.body },
    warn: 0.02,
    on: {
      cast: (c) => { c.state.seq = castNo(c.ctx!.caster); },
      // Where it stops it stays as an ember, her nest; with its flight, so her own screen learns its true end from the screen
      // that decides its hit.
      stop: (c, x, z) => {
        if (c.ctx) layEmber(c.ctx.caster, x, z, c.state.seq, { fx: c.from.x, fz: c.from.z, dx: c.dir.x, dz: c.dir.z });
      },
    },
  },
  look: QuillLook,
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frame: 2,
  maxDamage: 150,
});
