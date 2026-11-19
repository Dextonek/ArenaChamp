import * as THREE from 'three';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { flatRing } from '../../../heroes/sheath/parts';
import { Flecks } from '../../../heroes/sheath/partsBig';
import { Ribbon, clamp01, easeOut, hash, smooth } from './g10Parts';

/**
 * Whiplash fissure (gallery 10, pipeline/designs/gallery-20.md). A crack that runs along the ground: a lane of 11 m by 1.6 m
 * from the caster toward the aim. At 0.5 s a whiplash vine races down it in 0.7 s; whoever its head passes is hit once
 * (55, a short knock-up) and the ground opens behind it in gilded, scalloped lips with curling tendrils. It seals from 1.9 s
 * (the near end first) and is gone by 3.1 s. Answer: leave the lane, 0.8 m: 0.25 + 0.8 / 4 = 0.45 s; the zone shows 0.46 s.
 * On the blocks: a lane with no move, `late` = its travel time, `front` = the head's even run (there is no caster move).
 * Art Nouveau: sage green, gold, cream, a dark layer under all; the signature is the S-curve with the curling tendrils.
 */
const WIND = 0.5;
const TRAVEL = 0.7;
const LENGTH = 11;
const WIDTH = 1.6;
const DURATION = 3.2;
const BEAT = 0.3; // the hush before the whip: the seam thins to a hair
const SEAL = 1.9;

const COLORS = {
  dark: '#06130c', // the dark layer: the opened ground
  earth: '#14281a',
  sage: '#86ad6e', // the accent
  gold: '#dba93a',
  cream: '#f3ebcb', // the foil
  hot: '#fff1b8', // the hot core: the head and the glow in the crack
  soil: '#3a2d1f',
};

const N = 56; // points of a long ribbon
const NT = 26; // points of a tendril
const TENDRILS = 10;
const TH = Math.PI * 3.2;

/** The centre line: a whiplash, a swing that grows then narrows, with an S in it (lateral metres at s metres along). */
const lat = (s: number) => 0.2 * Math.sin(s * 0.85 - 0.4) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, s / LENGTH) * 0.9 + 0.5));

class FissureLook implements Look<null> {
  private seam = new Ribbon(N, COLORS.gold, false, 4, 0.9);
  private bed = new Ribbon(N, COLORS.earth, false, 1, 0.55);
  private crack = new Ribbon(N, COLORS.dark, false, 2, 0.96);
  private inner = new Ribbon(N, '#9a6f1e', false, 3, 0.85);
  private glow = new Ribbon(N, COLORS.hot, true, 6, 0.55);
  private sageL = new Ribbon(N, COLORS.sage, false, 3, 0.95);
  private sageR = new Ribbon(N, COLORS.sage, false, 3, 0.95);
  private goldL = new Ribbon(N, COLORS.gold, false, 5, 1);
  private goldR = new Ribbon(N, COLORS.gold, false, 5, 1);
  private creamL = new Ribbon(N, COLORS.cream, false, 5, 0.85);
  private creamR = new Ribbon(N, COLORS.cream, false, 5, 0.85);
  private head = new Ribbon(N, COLORS.gold, true, 7, 0.95);
  private headCore = new Ribbon(N, COLORS.hot, true, 8, 0.9);
  private tendrils: Ribbon[] = [];
  private tendrilS = new Float32Array(TENDRILS + 1);
  private tendrilSide = new Float32Array(TENDRILS + 1);
  private tendrilR = new Float32Array(TENDRILS + 1);
  private bud: THREE.Mesh;
  private budMat = new THREE.MeshBasicMaterial({ color: COLORS.hot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private shock = flatRing(new THREE.Color(COLORS.gold), 0.08, true, 6);
  private flecks = new Flecks(220, 0.2);
  private gold = new THREE.Color(COLORS.gold);
  private soil = new THREE.Color(COLORS.soil);
  private sage = new THREE.Color(COLORS.sage);
  private cream = new THREE.Color(COLORS.cream);
  private xs = new Float32Array(N);
  private zs = new Float32Array(N);
  private hs = new Float32Array(N);
  private fx = 0;
  private fz = 0;
  private dx = 0;
  private dz = 1;
  private lastFront = 0;
  private hitBeat = 0;

  constructor(group: THREE.Group) {
    const all = [this.bed, this.crack, this.inner, this.seam, this.sageL, this.sageR, this.goldL, this.goldR, this.creamL, this.creamR, this.glow, this.head, this.headCore];
    for (const r of all) group.add(r.mesh);
    for (let i = 0; i <= TENDRILS; i++) {
      const r = new Ribbon(NT, i % 3 === 0 ? COLORS.gold : COLORS.sage, false, 4, 0.95);
      this.tendrils.push(r);
      group.add(r.mesh);
      // along the crack, on alternate sides; the last one is the end curl, on the line itself
      const k = i < TENDRILS ? i : TENDRILS;
      this.tendrilS[i] = i < TENDRILS ? 1.2 + (i + 0.35 * hash(i * 3 + 1)) * ((LENGTH - 2.6) / TENDRILS) : LENGTH - 0.15;
      this.tendrilSide[i] = i < TENDRILS ? (k % 2 === 0 ? 1 : -1) : 1;
      this.tendrilR[i] = i < TENDRILS ? 0.2 + 0.1 * hash(i * 5 + 2) : 0.42;
    }
    this.bud = new THREE.Mesh(new THREE.CircleGeometry(0.26, 20).rotateX(-Math.PI / 2), this.budMat);
    this.bud.renderOrder = 9;
    this.bud.frustumCulled = false;
    this.bud.visible = false;
    group.add(this.bud, this.shock.mesh, this.flecks.mesh);
  }

  reset() {
    for (const r of this.tendrils) r.mesh.visible = false;
    for (const r of [this.bed, this.crack, this.inner, this.seam, this.sageL, this.sageR, this.goldL, this.goldR, this.creamL, this.creamR, this.glow, this.head, this.headCore]) r.mesh.visible = false;
    this.bud.visible = this.shock.mesh.visible = false;
    this.flecks.clear();
    this.lastFront = 0;
    this.hitBeat = 0;
  }

  cast(c: Cast<null>) {
    this.fx = c.from.x; this.fz = c.from.z;
    this.dx = c.dir.x; this.dz = c.dir.z;
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  private wx(s: number, l: number) {
    return this.fx + this.dx * s + this.dz * l;
  }

  private wz(s: number, l: number) {
    return this.fz + this.dz * s - this.dx * l;
  }

  /** The crack's half-width at s (before it opens): taller in the middle, thin at both ends, a little uneven. */
  private baseW(s: number) {
    const tp = smooth((s - 0.4) / 1.3) * (1 - 0.8 * smooth((s - (LENGTH - 2.2)) / 2.2));
    return 0.36 * tp * (0.8 + 0.2 * Math.sin(s * 3.1 + 1) * Math.sin(s * 1.7));
  }

  /** How open it is at s at time t: it opens behind the head over 0.9 m and seals from the near end. */
  private open(s: number, f: number, t: number) {
    return smooth((f - s) / 0.9) * (1 - smooth((t - (SEAL + 0.5 * (s / LENGTH))) / 0.7));
  }

  /** The whole centre line from sa to sb into the scratch arrays, offset `off` to the side. */
  private line(sa: number, sb: number, off: number) {
    for (let i = 0; i < N; i++) {
      const s = sa + (sb - sa) * (i / (N - 1));
      const l = lat(s) + off;
      this.xs[i] = this.wx(s, l);
      this.zs[i] = this.wz(s, l);
    }
  }

  private strip(r: Ribbon, sa: number, sb: number, off: number, y: number, kind: number, f: number, t: number) {
    for (let i = 0; i < N; i++) {
      const s = sa + (sb - sa) * (i / (N - 1));
      const e = this.open(s, f, t), w = this.baseW(s) * e;
      // the edges ride the crack's own edge (`off` is the extra beyond it), so the lips follow it as it opens and closes
      const l = lat(s) + (off === 0 ? 0 : Math.sign(off) * (w + Math.abs(off)));
      this.xs[i] = this.wx(s, l);
      this.zs[i] = this.wz(s, l);
      let h = 0;
      switch (kind) {
        case 0: h = w * 1.9 + 0.3 * e; break; // the bed: the ground heaved round the crack
        case 1: h = w; break; // the opened ground
        case 6: h = w * 0.5 * (0.55 + 0.45 * Math.sin(s * 4.1 - t * 3)); break; // gilt deep in the crack
        case 2: { // the glow in the crack: strongest just behind the head, gone in a moment
          const age = (f - s) / 15;
          h = w * 0.3 * Math.max(0, 1 - age * 1.6) * clamp01(age * 8 + 0.2);
          break;
        }
        case 3: h = e * (0.1 + 0.1 * Math.abs(Math.sin(s * 5.3 + (off > 0 ? 0 : 2)))) * (0.4 + 0.6 * smooth(s - 0.3)); break; // scalloped sage lips
        case 4: h = e * 0.06 * (0.5 + 0.5 * smooth(s - 0.3)); break; // gold edge, a hair
        case 5: h = e * 0.035; break; // cream foil line
      }
      this.hs[i] = h;
    }
    r.path(this.xs, this.zs, this.hs, N, y);
  }

  /** A tendril: a spiral that curls forward from the lip, grown to `prog` of its turns. */
  private tendril(i: number, t: number, f: number) {
    const r = this.tendrils[i], s0 = this.tendrilS[i], side = this.tendrilSide[i], R = this.tendrilR[i];
    const born = (s0 / LENGTH) * TRAVEL + WIND + 0.12 + 0.2 * hash(i * 7 + 3);
    const seal = 1 - smooth((t - (SEAL + 0.5 * (s0 / LENGTH))) / 0.6);
    const prog = easeOut((t - born) / 0.7) * seal;
    if (prog < 0.02 || f < s0) { r.mesh.visible = false; return; }
    const lw = i < TENDRILS ? this.baseW(s0) + 0.2 : 0.04;
    const la = lat(s0) + side * lw; // the anchor
    const sc = s0, lc = la + side * R; // the spiral's centre
    const th = TH * prog;
    for (let k = 0; k < NT; k++) {
      const u = k / (NT - 1), a = th * u;
      const rad = R * Math.exp(-0.3 * a);
      const phi = -side * Math.PI / 2 + side * a;
      const s = sc + rad * Math.cos(phi), l = lc + rad * Math.sin(phi);
      this.xs[k] = this.wx(s, l);
      this.zs[k] = this.wz(s, l);
      this.hs[k] = (0.08 + 0.04 * (1 - u)) * (1 - 0.5 * u) * (i === TENDRILS ? 1.15 : 1);
    }
    r.path(this.xs, this.zs, this.hs, NT, 0.045);
  }

  struck(c: Cast<null>, who: { group: THREE.Object3D }) {
    const p = who.group.position;
    this.flecks.burst(p.x, 0.3, p.z, 22, 3.0, 5.0, this.gold, 1.0, 9);
    this.flecks.burst(p.x, 0.3, p.z, 12, 2.4, 4.4, this.sage, 0.9, 9);
    this.flecks.burst(p.x, 0.2, p.z, 10, 2.0, 4.0, this.cream, 0.8, 9);
    c.shake = Math.max(c.shake, 0.18);
  }

  frame(c: Cast<null>, t: number) {
    const f = c.front(t);
    const released = t >= WIND;
    // the blueprint: a fine gold seam draws the whole curve, thins at the hush, and gives way to the crack
    const draw = easeOut(t / 0.32) * LENGTH;
    const thin = 1 - 0.8 * smooth((t - BEAT) / 0.12);
    const seamA = 1 - smooth((t - WIND) / 0.25);
    this.seam.material.opacity = 0.9 * seamA;
    if (seamA > 0.01) {
      this.line(0.5, Math.max(0.6, draw), 0);
      for (let i = 0; i < N; i++) this.hs[i] = 0.06 * thin * (0.8 + 0.2 * Math.sin(i * 1.3 + t * 18)) * (i < N - 2 ? 1 : 0.5);
      this.seam.path(this.xs, this.zs, this.hs, N, 0.04);
    } else this.seam.mesh.visible = false;

    if (released) {
      this.strip(this.bed, 0.5, LENGTH, 0, 0.03, 0, f, t);
      this.strip(this.crack, 0.5, LENGTH, 0, 0.05, 1, f, t);
      this.strip(this.inner, 0.5, LENGTH, 0, 0.055, 6, f, t);
      this.strip(this.glow, 0.5, LENGTH, 0, 0.06, 2, f, t);
      this.strip(this.sageL, 0.5, LENGTH, 0.17, 0.052, 3, f, t); // scalloped lips follow the crack's edge
      this.strip(this.sageR, 0.5, LENGTH, -0.17, 0.052, 3, f, t);
      this.strip(this.goldL, 0.5, LENGTH, 0.05, 0.058, 4, f, t);
      this.strip(this.goldR, 0.5, LENGTH, -0.05, 0.058, 4, f, t);
      this.strip(this.creamL, 0.5, LENGTH, 0.2, 0.06, 5, f, t);
      this.strip(this.creamR, 0.5, LENGTH, -0.2, 0.06, 5, f, t);
    }
    this.fixLips(f, t);

    // the whip: the last 1.6 m before the head, a lively tail that thins to a point behind it
    const live = released && f < LENGTH + 0.2 && t < WIND + TRAVEL + 0.3;
    if (live) {
      const sb = Math.min(f, LENGTH), sa = Math.max(0.4, sb - 1.8);
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1), s = sa + (sb - sa) * u;
        const l = lat(s) + 0.2 * Math.sin(s * 9 - t * 46) * (1 - u) * (u < 0.98 ? 1 : 0);
        this.xs[i] = this.wx(s, l); this.zs[i] = this.wz(s, l);
        this.hs[i] = 0.13 * Math.pow(u, 1.4) + 0.03;
      }
      this.head.path(this.xs, this.zs, this.hs, N, 0.07);
      for (let i = 0; i < N; i++) this.hs[i] *= 0.4;
      this.headCore.path(this.xs, this.zs, this.hs, N, 0.075);
      this.bud.visible = true;
      this.bud.position.set(this.wx(sb, lat(sb)), 0.1, this.wz(sb, lat(sb)));
      this.bud.scale.setScalar(0.8 + 0.3 * Math.sin(t * 50));
      this.budMat.opacity = 0.7;
      // soil and gold thrown up where the head is, and a small ring on the floor when it ends
      const moved = f - this.lastFront;
      if (moved > 0) {
        const bx = this.wx(sb, lat(sb)), bz = this.wz(sb, lat(sb));
        this.flecks.burst(bx, 0.15, bz, 3, 1.8, 3.8, this.soil, 0.9, 9);
        this.flecks.burst(bx, 0.2, bz, 2, 1.6, 3.2, this.gold, 1.0, 5);
        if ((Math.floor(t * 60) & 3) === 0) this.flecks.burst(bx, 0.2, bz, 1, 1.0, 2.2, this.sage, 1.1, 4);
      }
    } else {
      this.head.mesh.visible = this.headCore.mesh.visible = this.bud.visible = false;
    }
    this.lastFront = f;
    if (released && !this.hitBeat && f >= LENGTH) {
      this.hitBeat = 1;
      const bx = this.wx(LENGTH, lat(LENGTH)), bz = this.wz(LENGTH, lat(LENGTH));
      this.flecks.burst(bx, 0.2, bz, 26, 3.4, 4.4, this.gold, 1.1, 8);
      this.flecks.burst(bx, 0.2, bz, 14, 2.6, 3.6, this.cream, 0.9, 8);
      c.shake = Math.max(c.shake, 0.2);
    }
    if (this.hitBeat) {
      const a = (t - (WIND + TRAVEL)) / 0.5;
      this.shock.mesh.visible = a > 0 && a < 1;
      const bx = this.wx(LENGTH, lat(LENGTH)), bz = this.wz(LENGTH, lat(LENGTH));
      this.shock.mesh.position.set(bx, 0.07, bz);
      this.shock.mesh.scale.setScalar(0.3 + 1.2 * easeOut(a));
      this.shock.material.opacity = 0.8 * (1 - a) * (1 - a);
    }
    for (let i = 0; i <= TENDRILS; i++) if (released) this.tendril(i, t, f);
    // sealing: a trickle of gold dust from the lips that close
    if (t > SEAL && t < SEAL + 1.2 && (Math.floor(t * 60) % 3) === 0) {
      const s = 1.5 + 8.5 * hash(Math.floor(t * 60) * 0.7);
      this.flecks.burst(this.wx(s, lat(s)), 0.1, this.wz(s, lat(s)), 1, 0.6, 1.6, this.gold, 1.0, -1);
    }
  }

  /** The sage lips are drawn over a dark cut and under gold: keep their opacity with the seal so the last of them fades whole. */
  private fixLips(f: number, t: number) {
    const k = 1 - smooth((t - (SEAL + 0.9)) / 0.8);
    this.sageL.material.opacity = this.sageR.material.opacity = 0.95 * k;
    this.crack.material.opacity = 0.96 * k;
    this.inner.material.opacity = 0.85 * k;
    this.bed.material.opacity = 0.55 * k;
    this.glow.material.opacity = 0.55 * k;
    this.goldL.material.opacity = this.goldR.material.opacity = k;
    this.creamL.material.opacity = this.creamR.material.opacity = 0.85 * k;
    this.head.material.opacity = 0.95 * (1 - smooth((t - WIND - TRAVEL) / 0.3));
    this.headCore.material.opacity = 0.9 * (1 - smooth((t - WIND - TRAVEL) / 0.3));
    for (const r of this.tendrils) r.material.opacity = 0.95 * k;
    void f;
  }

  after(c: Cast<null>) {
    c.shake *= 0.86;
  }
}

export const whiplashFissureModule = spell<null>({
  label: 'whiplash fissure',
  category: 'targeted',
  targeting: { mode: 'ground', radius: WIDTH / 2 },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: WIND,
    shape: {
      kind: 'lane', length: LENGTH, width: WIDTH, late: TRAVEL + 0.04,
      // the head runs evenly over its travel time (the runner's front is read over a second with no caster move)
      front: (_c, even) => Math.min(LENGTH, (even / LENGTH) * (LENGTH / TRAVEL)),
    },
    hit: { damage: 55, knock: 2.2, color: '#dba93a', status: { kind: 'knockup', seconds: 0.5 } },
  },
  look: FissureLook,
  noScreen: true,
  bloom: { enabled: true, strength: 0.4, radius: 0.45, threshold: 0.85 },
  frame: 12,
  maxDamage: 120,
});
