import * as THREE from 'three';
import { StarBurst } from '../../../effects/parts';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { flatRing } from '../../../heroes/sheath/parts';
import { Flecks } from '../../../heroes/sheath/partsBig';
import { Pieces, SilkRibbon, easeOut, hash, maskGeometry, smooth } from './g1Parts';

/**
 * Carnival Masquerade (gallery group 1, a blink behind the chosen enemy and a strike, Venetian carnival: lacquered masks, gold
 * leaf, teal silk). A click on an enemy. 0-1.0 s: nine porcelain half masks open into a carousel round the caster (gold rim, a
 * teal diamond on each brow), bobbing as they turn, faster and faster, while three teal silk ribbons wind up his body; a tenth
 * mask hangs over the enemy's head and watches him, a lacquer ring closing on their feet. At 1.0 s he dissolves: the masks
 * collapse into him and fly in arcs to the spot behind the enemy (`move` at the release, 0.2 s, 3.1 m past them) with the ribbons
 * streaking after, and he steps out of them at 1.24 s. The dead beat is 1.24-1.6 s: the carousel opens round him there and
 * slows to a stop, the watching mask tips down, nothing moves. At 1.6 s a teal silk slash cuts across the enemy (a sure hit: 46
 * damage on their live position), the masks and the watcher fall and clatter on the floor and lie there, the ribbon settles
 * and fades; clean by 3.1 s.
 * On the blocks: `target` (mark 1.5 m, the warning is the 1.6 s build) with a `move` at the release to behind the target.
 */

const W = 1.0; // the release: he dissolves
const D = 0.6;
const HIT = W + D;
const BLINK = 0.2; // seconds of the move
const ARRIVE = W + BLINK + 0.04; // he steps out
const DURATION = 3.1;
const MARKR = 1.5;
const MASKS = 9;
const WATCHER = MASKS; // the tenth mask
const BEHIND = 1.7; // metres behind the enemy
const MASK_S = 0.95;
const CY = 1.5; // the carousel's height
const CR = 1.25; // its radius

const TEAL = new THREE.Color('#17a99b');
const GOLD = new THREE.Color('#e3b14d');
const FOIL = new THREE.Color('#f1ebdf');
const LACQ = new THREE.Color('#0b1516');
const TAU = Math.PI * 2;

class CarnivalLook implements Look<null> {
  private masks = new Pieces(maskGeometry(), MASKS + 1);
  private rib = [new SilkRibbon(36), new SilkRibbon(36), new SilkRibbon(36)];
  private slash = new SilkRibbon(44);
  private flecks = new Flecks(220, 0.2);
  private dark = flatRing(LACQ, 0.16, false, 3);
  private teal = flatRing(TEAL, 0.04, true, 4);
  private shockA = flatRing(TEAL, 0.05, true, 4);
  private shockB = flatRing(GOLD, 0.05, true, 4);
  private star = new StarBurst({ points: 8, inner: 0.2, color: TEAL, core: FOIL });
  private glint = new StarBurst({ points: 4, inner: 0.16, color: GOLD, core: FOIL });
  private O = new THREE.Vector3(); // where he stood
  private D = new THREE.Vector3(); // where he lands
  private foe = new THREE.Vector3();
  private hitFoe = new THREE.Vector3();
  private side = new THREE.Vector3(1, 0, 0);
  private fwd = new THREE.Vector3(0, 0, -1);
  private v = new THREE.Vector3();
  private moved = false;
  private hidden = false;
  private arrived = false;
  private hitDone = false;
  private time = 0;
  // the last pose of each mask before the fall
  private px = new Float32Array(MASKS + 1);
  private py = new Float32Array(MASKS + 1);
  private pz = new Float32Array(MASKS + 1);
  private pr = new Float32Array(MASKS + 1);
  private paths: ((u: number, out: THREE.Vector3) => void)[];

  constructor(group: THREE.Group) {
    this.paths = [0, 1, 2].map((r) => (u: number, out: THREE.Vector3) => this.ribbonPath(r, u, out));
    group.add(this.dark.mesh, this.teal.mesh, this.shockA.mesh, this.shockB.mesh, this.masks.mesh, this.slash.mesh, this.flecks.mesh, this.star.mesh, this.glint.mesh);
    for (const r of this.rib) group.add(r.mesh);
  }

  reset() {
    this.show();
    this.moved = this.arrived = this.hitDone = false;
    this.time = 0;
    this.masks.reset();
    for (const r of this.rib) r.hide();
    this.slash.hide();
    this.flecks.clear();
    for (const r of [this.dark, this.teal, this.shockA, this.shockB]) r.mesh.visible = false;
    this.star.set(this.v.set(0, 0, 0), 1e-3, 0);
    this.glint.set(this.v.set(0, 0, 0), 1e-3, 0);
    this.px.fill(0); this.py.fill(-50); this.pz.fill(0); this.pr.fill(0);
  }

  cast(c: Cast<null>) {
    this.O.copy(c.from);
    this.foe.copy(c.spot);
    this.v.copy(this.foe).sub(this.O).setY(0).normalize();
    this.fwd.copy(this.v);
    this.D.copy(this.foe).addScaledVector(this.fwd, BEHIND);
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  /** After the move: where he really landed (the engine clamps it into the ring), or the spot asked for. */
  released(c: Cast<null>) {
    this.moved = true;
    if (c.moved) this.D.copy(c.landing).setY(0);
    else {
      const tg = c.target;
      if (tg) this.foe.set(tg.group.position.x, 0, tg.group.position.z);
      this.D.copy(this.foe).addScaledVector(this.fwd, BEHIND);
    }
  }

  /** His figure is hidden while he is masks (the duel's sinks a body under the floor, as Sky Rend and Time Skip do). */
  private show() {
    const ctx = this.ctxLast;
    if (!ctx || !this.hidden) return;
    this.hidden = false;
    ctx.caster.group.visible = true;
    ctx.displace(ctx.caster, this.v.set(0, 0, 0));
  }

  private ctxLast: Cast<null>['ctx'] = null;

  private hide(c: Cast<null>) {
    const ctx = c.ctx;
    if (!ctx || this.hidden) return;
    this.hidden = true;
    this.ctxLast = ctx;
    ctx.caster.group.visible = false;
    ctx.displace(ctx.caster, this.v.set(0, -8, 0));
  }

  /** A ribbon's path: a helix round him before the release, an arc from where he stood to where he lands after it. */
  private ribbonPath(r: number, u: number, out: THREE.Vector3) {
    if (this.time < W) {
      const ang = r * 2.094 + u * TAU * 1.7 + this.time * 3.2 * (1 + this.time);
      const rad = 0.55 + 0.15 * u;
      return out.set(this.O.x + Math.sin(ang) * rad, 0.15 + u * 1.9, this.O.z + Math.cos(ang) * rad);
    }
    const bow = Math.sin(Math.PI * u), k = (r - 1) * 0.9;
    return out.set(
      this.O.x + (this.D.x - this.O.x) * u + this.side.x * bow * k,
      1.2 + bow * (0.7 + 0.4 * r),
      this.O.z + (this.D.z - this.O.z) * u + this.side.z * bow * k,
    );
  }

  /** The carousel's turning angle at `t`: faster and faster to the release, then slowing to a stop where he lands. */
  private spin(t: number) {
    return t < ARRIVE ? 5 * Math.min(t, W) * Math.min(t, W) : 5 + 1.2 * (1 - Math.exp(-6 * (t - ARRIVE)));
  }

  /** Mask i before the fall at `t`: into `px/py/pz/pr` and onto the instance. */
  private pose(i: number, t: number) {
    const gl = 0.15 * Math.sin(t * 6 + i);
    if (i === WATCHER) {
      const w = this.O; // it watches where he stood, and keeps its face to the camera's side
      const yaw = Math.atan2(w.x - this.foe.x, w.z - this.foe.z);
      const beat = smooth((t - (ARRIVE + 0.1)) / 0.25);
      const s = MASK_S * 1.15 * easeOut((t - 0.25) / 0.3) * (1 + 0.1 * beat);
      this.store(i, this.foe.x, 2.5 + 0.09 * Math.sin(t * 3) - 0.1 * beat, this.foe.z, yaw);
      this.masks.set(i, this.foe.x, this.py[i], this.foe.z, -0.45 * beat, yaw, 0, s, s, s, 0.05 + 0.2 * beat + gl);
      return;
    }
    const ang = this.spin(t) + (i / MASKS) * TAU;
    const bob = 0.15 * Math.sin(i * 1.9 + t * 4.5);
    const open = easeOut((t - 0.05 - 0.035 * i) / 0.35);
    if (t < W) {
      // the carousel opens round him and collapses into him at the release
      const col = 1 - smooth((t - (W - 0.12)) / 0.12);
      const R = CR * open * col, s = MASK_S * open * (0.3 + 0.7 * col);
      const x = this.O.x + Math.sin(ang) * R, y = CY + bob * col, z = this.O.z + Math.cos(ang) * R;
      this.store(i, x, y, z, ang);
      this.masks.set(i, x, y, z, 0, ang, 0, s, s, s, 0.05 + 0.1 * (1 - col));
      return;
    }
    if (t < ARRIVE) {
      // dissolved into masks: they fly in arcs to where he lands
      const f = easeOut((t - W) / (ARRIVE - W));
      const arc = Math.sin(Math.PI * f), h1 = hash(i * 3.1), h2 = hash(i * 5.9);
      const x = this.O.x + (this.D.x - this.O.x) * f + this.side.x * arc * (h2 - 0.5) * 1.8;
      const z = this.O.z + (this.D.z - this.O.z) * f + this.side.z * arc * (h2 - 0.5) * 1.8;
      const y = CY + arc * (0.5 + 0.9 * h1);
      const yaw = Math.atan2(this.D.x - this.O.x, this.D.z - this.O.z);
      const s = MASK_S * 0.8;
      this.store(i, x, y, z, yaw);
      this.masks.set(i, x, y, z, f * 3 * (h1 - 0.5), yaw, f * TAU * (i % 2 ? 1 : -1), s, s, s, 0.5);
      return;
    }
    // stepped out: the carousel opens round him where he landed and slows to a stop
    const R = CR * easeOut((t - ARRIVE + 0.02) / 0.28);
    const x = this.D.x + Math.sin(ang) * R, y = CY + bob, z = this.D.z + Math.cos(ang) * R;
    const settle = 1 - smooth((t - ARRIVE) / 0.4);
    this.store(i, x, y, z, ang);
    this.masks.set(i, x, y, z, 0, ang, 0, MASK_S, MASK_S, MASK_S, 0.05 + 0.5 * settle);
  }

  private store(i: number, x: number, y: number, z: number, yaw: number) {
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.pr[i] = yaw;
  }

  /** Mask i falls from where it hung, bounces once, tumbles and lies flat. */
  private drop(i: number, a: number, t: number) {
    const g = 15, yr = 0.07;
    const h = hash(i * 4.7 + 1), h2 = hash(i * 8.3 + 2), h3 = hash(i * 2.1 + 5);
    const y0 = Math.max(yr, this.py[i]), vy0 = 0.8 + 1.8 * h;
    const a1 = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * (y0 - yr))) / g;
    const vb = 0.3 * (g * a1 - vy0), b = a - a1;
    const y = a < a1 ? y0 + vy0 * a - 0.5 * g * a * a : yr + Math.max(0, vb * b - 0.5 * g * b * b);
    const slide = (1 - Math.exp(-1.8 * a)) / 1.8;
    const x = this.px[i] + (h2 - 0.5) * 3.0 * slide, z = this.pz[i] + (h3 - 0.5) * 3.0 * slide;
    const bl = smooth((a - a1) / 0.3);
    const up = h > 0.5 ? -Math.PI / 2 : Math.PI / 2;
    const rx = (this.pr[i] * 0 + (h2 - 0.5) * 14 * a) * (1 - bl) + up * bl;
    const rz = ((h - 0.5) * 12 * a) * (1 - bl);
    const ry = this.pr[i] + (h3 - 0.5) * 6 * bl;
    const gl = a > a1 ? Math.max(0, 1 - (a - a1) / 0.3) * 0.9 : 0;
    const s = MASK_S * (1 - smooth((t - 2.65) / 0.4));
    this.masks.set(i, x, y, z, rx, ry, rz, s, s, s, gl + 0.1 * (1 - bl));
  }

  /** The slash's path across the enemy: from high on one side, down through the chest, bowed. */
  private slashPath = (u: number, out: THREE.Vector3) => {
    const s = u * 2 - 1, f = this.time - HIT;
    const wave = 0.16 * Math.sin(u * 9 - f * 14) * Math.exp(-f * 3.2) * (1 - Math.abs(s));
    return out.set(
      this.hitFoe.x + this.side.x * 2.0 * s + this.fwd.x * (-0.35 * (1 - s * s) + wave),
      1.25 - 1.15 * s + 0.6 * (1 - s * s),
      this.hitFoe.z + this.side.z * 2.0 * s + this.fwd.z * (-0.35 * (1 - s * s) + wave),
    );
  };

  frame(c: Cast<null>, t: number) {
    this.time = t;
    const tg = c.target;
    if (tg && !this.hitDone) this.foe.set(tg.group.position.x, 0, tg.group.position.z);
    // the side axis of the blink (perpendicular to O -> foe)
    this.v.set(this.foe.x - this.O.x, 0, this.foe.z - this.O.z);
    if (this.v.lengthSq() > 0.01) this.fwd.copy(this.v.normalize());
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    if (!this.moved) this.D.copy(this.foe).addScaledVector(this.fwd, BEHIND);

    // he is masks from the collapse to the step out
    if (t >= W && t < ARRIVE) this.hide(c);
    else this.show();

    // the mark: a lacquer ring and a teal line close on the enemy's feet
    const closing = 1.75 - 0.65 * smooth(t / HIT);
    const mk = smooth(t / 0.3) * (this.hitDone ? 0 : 1);
    this.dark.mesh.visible = this.teal.mesh.visible = mk > 0.01;
    for (const r of [this.dark, this.teal]) r.mesh.position.set(this.foe.x, 0.04, this.foe.z);
    this.dark.mesh.scale.set(closing, 1, closing);
    this.teal.mesh.scale.set(closing * 0.9, 1, closing * 0.9);
    this.dark.material.opacity = 0.75 * mk;
    this.teal.material.opacity = 0.9 * mk * (0.6 + 0.4 * Math.sin(t * 9));

    // the ribbons: winding up him, then streaking after the masks
    if (t < ARRIVE + 0.45) {
      for (let r = 0; r < 3; r++) {
        if (t < W) {
          const head = easeOut((t - 0.05 - 0.06 * r) / 0.6);
          this.rib[r].set(this.paths[r], Math.max(0, head - 0.6), head, 0.24, 0.7, t, 1);
        } else {
          const head = easeOut((t - W) / 0.28), tail = smooth((t - W - 0.1) / 0.4);
          this.rib[r].set(this.paths[r], Math.min(tail, head - 0.02), head, 0.26, 0.5, t, 1 - smooth((t - ARRIVE) / 0.45));
        }
      }
    } else for (const r of this.rib) r.hide();

    // the arrival: a flash of teal and gold where he steps out
    if (t >= ARRIVE && !this.arrived) {
      this.arrived = true;
      for (let k = 0; k < 2; k++) this.flecks.burst(this.D.x, 0.9, this.D.z, 16, 2.4, 2.2, k ? GOLD : TEAL, 1.0, 5);
    }
    if (this.arrived) {
      const a = t - ARRIVE, rg = easeOut(a / 0.35);
      this.shockB.mesh.visible = a < 0.4;
      this.shockB.mesh.position.set(this.D.x, 0.05, this.D.z);
      this.shockB.mesh.scale.set(0.5 + 1.8 * rg, 1, 0.5 + 1.8 * rg);
      this.shockB.material.opacity = 0.8 * (1 - rg) * (1 - rg);
      const sp = StarBurst.pop(a, 0.04, 0.1);
      this.glint.set(this.v.set(this.D.x - this.fwd.x * 0.1, 1.2, this.D.z - this.fwd.z * 0.1), 0.9 * sp.scale + 1e-3, sp.opacity, 0.5);
    }

    // the strike
    const a = t - HIT;
    if (a >= 0 && !this.hitDone) {
      this.hitDone = true;
      this.hitFoe.copy(this.foe);
      c.shake = 0.34;
      this.flecks.burst(this.foe.x, 1.2, this.foe.z, 14, 4.2, 2.2, TEAL, 1.2, 7);
      this.flecks.burst(this.foe.x, 1.4, this.foe.z, 12, 3.4, 2.8, GOLD, 1.2, 7);
      this.flecks.burst(this.foe.x, 1.0, this.foe.z, 8, 2.6, 2.4, FOIL, 1.0, 7);
    }

    // the masks: hanging and turning, or fallen
    for (let i = 0; i <= MASKS; i++) {
      if (!this.hitDone) this.pose(i, t);
      else this.drop(i, a, t);
    }
    this.masks.commit();

    if (this.hitDone) {
      const head = easeOut(a / 0.16), tail = smooth((a - 0.1) / 0.55) * 0.98;
      this.slash.set(this.slashPath, Math.min(tail, head - 0.02), head, 0.9, 0.35, t, 1 - smooth((a - 0.7) / 0.55));
      const rg = easeOut(a / 0.4);
      this.shockA.mesh.visible = a < 0.45;
      this.shockA.mesh.position.set(this.hitFoe.x, 0.06, this.hitFoe.z);
      this.shockA.mesh.scale.set(0.6 + 2.2 * rg, 1, 0.6 + 2.2 * rg);
      this.shockA.material.opacity = 0.9 * (1 - rg) * (1 - rg);
      const sp = StarBurst.pop(a - 0.03, 0.03, 0.1);
      this.star.set(this.v.set(this.hitFoe.x, 1.5, this.hitFoe.z), 1.05 * sp.scale + 1e-3, sp.opacity, 0.2);
    }
  }

  after(c: Cast<null>) {
    c.shake *= 0.9;
  }
}

export const carnivalMasqueradeModule = spell<null>({
  label: 'carnival masquerade',
  category: 'targeted',
  // Click an enemy: a sure hit (the engine checks the range and the sight at the cast); the carousel and the ring are the warning.
  targeting: { mode: 'enemy' },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: W,
    delay: D,
    shape: { kind: 'target', mark: MARKR },
    hit: { damage: 46, knock: 2.0, color: '#17a99b', projectile: true },
    // He steps out behind the enemy 0.2 s after the release, on the far side of the line from where he stood.
    move: {
      at: 'release',
      seconds: BLINK,
      to: (c) => {
        const tg = c.target;
        const fx = tg ? tg.group.position.x : c.spot.x, fz = tg ? tg.group.position.z : c.spot.z;
        const dx = fx - c.from.x, dz = fz - c.from.z, l = Math.hypot(dx, dz) || 1;
        return { x: fx + (dx / l) * BEHIND, z: fz + (dz / l) * BEHIND };
      },
    },
    warn: 0.04,
  },
  look: CarnivalLook,
  bloom: { enabled: true, strength: 0.45, radius: 0.5, threshold: 0.85 },
  frame: 4,
  maxDamage: 160,
});
