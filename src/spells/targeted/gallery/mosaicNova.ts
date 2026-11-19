import * as THREE from 'three';
import { ShockRefraction, StarBurst } from '../../../effects/parts';
import type { Enemy } from '../../../effects/common';
import { insideTelegraph } from '../../../effects/telegraph';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Flecks, clamp01, easeOut, hash, smooth } from '../../../heroes/sheath/partsBig';
import { MOSAIC, MosaicFloor, TileSwarm } from './g3Parts';

/**
 * Mosaic Nova (gallery 3, Byzantine mosaic). No aim: a nova round the caster, 6 m, in the order the ring passes. Everyone inside
 * the 6 m circle is hit once (65, a short knock outward) at the moment the widening ring of tiles passes them: the ring's front
 * runs from his feet to 6 m in 0.8 s, and the hit and the drawn ring use the same `ringR`. The zone itself (the danger circle,
 * shown from the cast) is judged once at the end of the ring for 0 (as Noto's click), so it only keeps the telegraph's timing.
 * Answer: leave the 6 m circle: the zone shows 2.3 s, the rule 0.25 + 6 / 4 = 1.75 s.
 * On the blocks: a zone round him; `on.frame` hits each enemy once as the ring passes, only inside the cast's own zone.
 *
 * The look. 0-1.5: a medallion of tesserae (gold and lapis rings, porphyry and marble among them) is laid on the floor round him; the
 * tiles peel off it from the middle out and float up, circling him faster, then slower and slower: at 1.2 they hang still, a held
 * breath (the last 0.3 s: nothing moves but a gold glint). 1.5: they all race out as a band of tiles, the front a pale, hot rim,
 * a mosaic floor left under it, a refraction ring; 2.3 the band reaches 6 m and its edge stands up into a crown of tiles
 * (peaks, leaning outward); 2.5 the crown crashes down with a shake, gold flecks and a second ring; the tiles lie, then shrink away
 * into the floor by 3.3.
 */

const R = 6;
const GO = 1.5;
const RING_T = 0.8;
const CRASH = RING_T + 0.42;
const FADE0 = 1.65;
const DURATION = 3.5;
const TILES = 480;
const BAND = 1.4;
const DAMAGE = 65;

/** The front of the ring, `a` seconds after the release: fast out of his feet, slowing at its end. Look and hits both read it. */
export const ringR = (a: number) => R * (1 - Math.pow(1 - clamp01(a / RING_T), 2.2));

interface Nova { done: Set<Enemy> }

class NovaLook implements Look<Nova> {
  private floor = new MosaicFloor(R + 0.6);
  private ring = new MosaicFloor(R + 0.6);
  private tiles = new TileSwarm(TILES);
  private shock = new ShockRefraction({ facing: 'ground' });
  private shock2 = new ShockRefraction({ facing: 'ground' });
  private glint = new StarBurst({ points: 4, inner: 0.16, color: MOSAIC.gold, core: MOSAIC.hot, additive: false });
  private pop = new StarBurst({ points: 8, inner: 0.3, color: MOSAIC.gold, core: MOSAIC.hot, additive: false });
  private flecks = new Flecks(200, 0.2);
  private gold = new THREE.Color(MOSAIC.gold);
  private marble = new THREE.Color(MOSAIC.marble);
  private lapis = new THREE.Color('#2a52c8');
  private v = new THREE.Vector3();
  private c = new THREE.Vector3();
  private crashed = false;
  private shown = 0;
  // per-tile data (made once)
  private rho = new Float32Array(TILES);
  private phi = new Float32Array(TILES);
  private lift = new Float32Array(TILES);
  private high = new Float32Array(TILES);
  private th = new Float32Array(TILES);
  private bd = new Float32Array(TILES);
  private size = new Float32Array(TILES);
  private fall = new Float32Array(TILES);

  constructor(group: THREE.Group) {
    for (let i = 0; i < TILES; i++) {
      this.rho[i] = 1.25 + 1.1 * Math.sqrt(hash(i * 2.1 + 3));
      this.phi[i] = hash(i * 3.3 + 5) * Math.PI * 2;
      this.lift[i] = 0.25 + 0.38 * (this.rho[i] - 1.25) + 0.25 * hash(i * 4.1 + 7);
      this.high[i] = 0.5 + 1.5 * hash(i * 5.9 + 2);
      this.th[i] = ((i * 0.61803398875) % 1) * Math.PI * 2;
      this.bd[i] = hash(i * 6.7 + 4);
      this.size[i] = 0.24 + 0.14 * hash(i * 7.3 + 1);
      this.fall[i] = 0.0 + 0.16 * hash(i * 8.9 + 6);
    }
    this.ring.mesh.renderOrder = 3;
    group.add(this.floor.mesh, this.ring.mesh, this.tiles.mesh, this.shock.mesh, this.shock2.mesh, this.glint.mesh, this.pop.mesh, this.flecks.mesh);
  }

  reset() {
    this.crashed = false;
    this.shown = 0;
    this.floor.set(0, 0, 0, 0, 0, 0, 0);
    this.ring.set(0, 0, 0, 0, 0, 0, 0);
    this.tiles.hide();
    this.flecks.clear();
    this.shock.set(this.c, 0, 0);
    this.shock2.set(this.c, 0, 0);
    this.glint.set(this.v.set(0, 0, 0), 1e-3, 0);
    this.pop.set(this.v.set(0, 0, 0), 1e-3, 0);
  }

  cast(c: Cast<Nova>) {
    this.c.copy(c.from);
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  /** The hover of tile i at time t (before the release): where it floats, and how far it has lifted (0 on the floor, 1 hanging). */
  private hover(i: number, t: number, out: THREE.Vector3): number {
    const k = smooth((t - this.lift[i]) / 0.5);
    const spin = this.phi[i] + 4.2 * smooth(t / GO);
    const pull = 1 - 0.2 * smooth((t - 0.9) / 0.5);
    const rr = this.rho[i] * pull;
    const calm = 1 - smooth((t - 1.1) / 0.3);
    out.set(rr * Math.cos(spin), 0.05 + this.high[i] * k + 0.12 * Math.sin(t * 3 + i) * calm * k, rr * Math.sin(spin));
    return k;
  }

  private hv = new THREE.Vector3();
  private hv2 = new THREE.Vector3();

  frame(c: Cast<Nova>, t: number) {
    const x = c.from.x, z = c.from.z;
    const a = t - GO;
    const tl = this.tiles;
    const calm = 1 - smooth((t - 1.1) / 0.3);

    if (a < 0) {
      // the medallion lies on the floor and its tiles peel off it from the middle out
      const grow = smooth(t / 0.45);
      this.floor.set(x, z, 0, 2.55 * grow, 0.96 - 0.3 * smooth((t - 1.0) / 0.5), 0, smooth((t - 0.2) / 1.0));
      for (let i = 0; i < TILES; i++) {
        const k = this.hover(i, t, this.hv);
        if (t < this.lift[i] - 0.1) { tl.place(i, x, -5, z, 0, 0, 0, 0.01); continue; }
        const peel = smooth((t - (this.lift[i] - 0.1)) / 0.2);
        const wob = (0.45 * Math.sin(t * 2.3 + i * 1.3)) * calm * k;
        tl.place(i, x + this.hv.x, this.hv.y, z + this.hv.z, wob, this.phi[i] + 4.2 * smooth(t / GO), 0.35 * Math.sin(t * 1.9 + i) * calm * k, this.size[i] * (0.4 + 0.6 * peel));
      }
      tl.commit();
      // the dead beat: a gold glint hangs over him, nothing else moves
      const gl = smooth((t - 1.05) / 0.35);
      this.glint.set(this.v.set(x, 1.55, z), (0.5 + 0.55 * gl) * smooth((t - 0.9) / 0.3) + 1e-3, 0.9 * smooth((t - 0.9) / 0.3), 0.4);
      return;
    }

    // the release
    const F = ringR(a);
    if (a < 0.5) {
      const p = StarBurst.pop(a, 0.04, 0.2);
      this.pop.set(this.v.set(x, 1.1, z), 2.4 * p.scale + 1e-3, p.opacity, a * 4);
    } else this.pop.set(this.v.set(x, 1, z), 1e-3, 0);
    this.glint.set(this.v.set(x, 1.55, z), 1e-3, 0);

    if (a >= CRASH && !this.crashed) {
      this.crashed = true;
      c.shake = 0.55;
      for (let k = 0; k < 20; k++) {
        const th = (k + hash(k * 3.1)) / 20 * Math.PI * 2, rr = R - 0.5 - 0.6 * hash(k * 5.7);
        this.flecks.burst(x + Math.cos(th) * rr, 0.3, z + Math.sin(th) * rr, 9, 2.4, 4.2, k % 3 === 0 ? this.marble : k % 3 === 1 ? this.gold : this.lapis, 1.2, 8);
      }
    }
    const g = a - RING_T;
    // the floor under the band: the mosaic stays where the tiles passed, then goes
    const bandFade = 1 - smooth((a - 1.55) / 0.5);
    const rimK = a < RING_T ? 1 : Math.max(0, 1 - (a - RING_T) / 0.3);
    this.floor.set(x, z, 0, 0, 0, 0, 0);
    this.ring.set(x, z, Math.max(0, F - 1.25), F + 0.04, 0.85 * bandFade * smooth(a / 0.1), rimK, 0);
    // refraction: the front, then the crash's second ring
    this.shock.set(this.c.set(x, 0, z), F + 0.2, a < RING_T + 0.15 ? 0.05 : 0);
    const q = clamp01((a - CRASH) / 0.45);
    this.shock2.set(this.c.set(x, 0, z), R - 0.6 + 0.9 * easeOut(q), a >= CRASH ? 0.05 * (1 - q) * (1 - q) : 0);

    const fade = smooth((a - FADE0) / 0.35);
    // hits' sparks: every enemy the ring has just hit
    const caught = c.caught;
    for (; this.shown < caught.length; this.shown++) {
      const p = caught[this.shown].group.position;
      this.flecks.burst(p.x, 0.9, p.z, 7, 2.2, 3.4, this.shown % 2 ? this.gold : this.marble, 0.9, 8);
    }

    for (let i = 0; i < TILES; i++) {
      const b = this.bd[i], th = this.th[i];
      const rim = b < 0.38;
      const rk = b / 0.38;
      // the band: the tile sits behind the front by its depth in the band
      const front = Math.max(0.45, F - BAND * b * Math.min(1, F / BAND));
      const bx = Math.cos(th) * front, bz = Math.sin(th) * front;
      let y = 0.15 + 0.85 * Math.sin(Math.PI * b) + 0.14 * Math.sin(a * 14 + i * 1.7);
      let lean = 0.5 * Math.sin(a * 11 + i * 1.7) * (1 - 0.5 * b);
      let yaw = Math.PI / 2 - th + 0.6 * Math.sin(a * 6 + i);
      let roll = 0.4 * Math.sin(a * 9 + i * 0.7);
      let px = bx, pz = bz, size = this.size[i] * (rim ? 1.3 : 1);
      if (g > 0) {
        if (rim) {
          // the edge of the band stands up into a crown of peaks, leaning outward
          const peak = Math.pow(Math.abs(Math.sin(th * 5 + 0.4)), 2.2);
          const hC = (0.9 + 2.2 * peak) * (1 - 0.35 * rk);
          const rise = smooth(g / 0.4);
          const tc = CRASH - RING_T + this.fall[i];
          const tau = g - tc;
          y = y + (hC - y) * rise;
          lean = lean + (1.25 - lean) * rise;
          roll *= 1 - rise;
          yaw = Math.PI / 2 - th;
          if (tau > 0) {
            const land = Math.sqrt(Math.max(1e-3, hC) / 7);
            y = Math.max(0.05, hC - 7 * tau * tau);
            const out = 1.3 * (1 - Math.exp(-tau * 2));
            px = Math.cos(th) * (front + out);
            pz = Math.sin(th) * (front + out);
            lean = 1.25 * (1 - smooth(tau / land));
            const lt = tau - land;
            if (lt > 0) y += 0.18 * Math.max(0, Math.sin(lt * 9)) * Math.exp(-lt * 7);
          }
        } else {
          const s = smooth(g / 0.3);
          y = y + (0.05 - y) * s;
          lean *= 1 - s;
          roll *= 1 - s;
        }
      }
      if (fade > 0) {
        size *= Math.max(0.03, 1 - fade);
        y -= 0.1 * fade;
      }
      // the launch: from where it hung, out to the band
      let ex = lean, ey = yaw, ez = roll;
      const k = smooth(a / 0.25);
      if (k < 1) {
        this.hover(i, GO, this.hv2);
        const sp = this.phi[i] + 4.2;
        px = this.hv2.x + (px - this.hv2.x) * k;
        pz = this.hv2.z + (pz - this.hv2.z) * k;
        y = this.hv2.y + (y - this.hv2.y) * k;
        ex *= k;
        ez *= k;
        ey = sp + (yaw - sp) * k;
      }
      tl.place(i, x + px, y, z + pz, ex, ey, ez, size);
    }
    tl.commit();
  }

  after(c: Cast<Nova>) {
    c.shake *= 0.88;
  }
}

export const mosaicNovaModule = spell<Nova>({
  label: 'mosaic nova',
  category: 'targeted',
  targeting: { mode: 'self', radius: R },
  seconds: DURATION,
  state: () => ({ done: new Set<Enemy>() }),
  rules: {
    windup: GO,
    delay: RING_T,
    shape: { kind: 'zone', area: (c) => ({ kind: 'circle', x: c.from.x, z: c.from.z, radius: R }) },
    // the zone's own judging, at the end of the ring, deals nothing: the ring's hits are `on.frame`'s
    hit: { damage: DAMAGE, none: true, knock: 0, color: MOSAIC.gold },
    warn: 0.04,
    on: {
      frame(c, t) {
        const ctx = c.ctx, area = c.area;
        const a = t - GO;
        if (!ctx || !area || a < 0 || a > RING_T + 0.1) return;
        const front = ringR(a);
        for (const en of ctx.enemies?.() ?? ctx.targets) {
          if (c.state.done.has(en)) continue;
          const p = en.group.position;
          if (Math.hypot(p.x - c.from.x, p.z - c.from.z) > front || !insideTelegraph(area, p.x, p.z)) continue;
          c.state.done.add(en);
          ctx.hit(en, c.hitOptions({ damage: DAMAGE, knock: 4, color: MOSAIC.gold }, c.from.clone()));
          c.caught.push(en);
        }
      },
    },
  },
  look: NovaLook,
  bloom: { enabled: true, strength: 0.45, radius: 0.45, threshold: 0.86 },
  frame: 11,
  maxDamage: 160,
});
