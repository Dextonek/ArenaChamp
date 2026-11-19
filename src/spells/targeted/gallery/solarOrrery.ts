import * as THREE from 'three';
import type { Enemy } from '../../../effects/common';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { flatRing } from '../../../heroes/sheath/parts';
import { Flecks, easeOut, hash, smooth, clamp01 } from '../../../heroes/sheath/partsBig';
import { insideTelegraph } from '../../../effects/telegraph';
import { planetGeometry, ringGeometry, starChartGeometry, vertexMaterial } from './g7Parts';

/**
 * Solar orrery (gallery 7, pipeline/designs/gallery-20.md). A self cast: a brass orrery opens round the caster, its five rings
 * spin up and stop dead; then its planets leave their orbits one by one (0.14 s apart) and fly each to an enemy inside the zone
 * (7 m round him, nearest first, one planet an enemy, up to five), and each lands as a hit.
 * The danger zone is the 7 m circle, shown from the cast to the end (the planets seek their enemy, there is no step aside that
 * is a dodge but out of the zone before they leave: it is shown 1.4 s ahead). The hits are in `on.frame` (`projectile`).
 * On the blocks: a `zone` round the caster whose own judging is set past the end (the planets are the hits), `on.frame`.
 */
const RADIUS = 7;
const DURATION = 3.3;
const COUNT = 5;
const LAUNCH = 1.45; // the first planet leaves
const STEP = 0.14;
const FLY = 0.42;
const BEAT = 1.1; // the rings stop
const CLOSE = 2.65; // the orrery folds

const COLORS = {
  night: '#0a1030', // the dark layer: night blue
  brass: '#c28a32', // the accent: brass
  brassD: '#6e4a16',
  ivory: '#f0e8d2', // the foil: ivory
  hot: '#fff0c0', // the hot core: the sun and the strikes
};
const ENAMEL: [string, string][] = [
  ['#1c3d9a', '#efe6cf'], // lapis, ivory bands
  ['#efe6cf', '#c28a32'], // ivory, brass
  ['#8a2a1c', '#efe6cf'], // oxblood
  ['#2c7566', '#efe6cf'], // verdigris
  ['#c28a32', '#1c2a60'], // brass, ringed
];
const RADII = [1.5, 2.3, 3.1, 3.9, 4.7];
const H = 1.3; // the orrery's centre above the floor

interface Sky {
  /** Which enemy each planet seeks (null: it stays in its orbit), when it left, and whether it has landed and where. */
  who: (Enemy | null)[];
  assigned: boolean;
  landed: boolean[];
  lx: number[];
  lz: number[];
}

class OrreryLook implements Look<Sky> {
  private floorDisc: THREE.Mesh;
  private discMat = new THREE.MeshBasicMaterial({ color: COLORS.night, transparent: true, opacity: 0, depthWrite: false });
  private chart: THREE.Mesh;
  private chartMat = vertexMaterial();
  private rim = flatRing(new THREE.Color(COLORS.brass), 0.025, false, 3);
  private rim2 = flatRing(new THREE.Color(COLORS.ivory), 0.012, false, 3);
  private rings: THREE.Mesh[] = [];
  private ringMat: THREE.MeshBasicMaterial[] = [];
  private tilt: THREE.Quaternion[] = [];
  private spin = [0, 0, 0, 0, 0];
  private planets: THREE.Mesh[] = [];
  private planetMat: THREE.MeshBasicMaterial[] = [];
  private sun: THREE.Mesh;
  private sunMat = new THREE.MeshBasicMaterial({ color: COLORS.brass });
  private core: THREE.Mesh;
  private coreMat = new THREE.MeshBasicMaterial({ color: COLORS.hot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private corona = flatRing(new THREE.Color(COLORS.hot), 0.1, true, 5);
  private shock = flatRing(new THREE.Color(COLORS.ivory), 0.06, true, 5);
  private flecks = new Flecks(260, 0.2);
  private brass = new THREE.Color(COLORS.brass);
  private ivory = new THREE.Color(COLORS.ivory);
  private hot = new THREE.Color(COLORS.hot);
  private tmp = new THREE.Color();
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private sx = [0, 0, 0, 0, 0];
  private sy = [0, 0, 0, 0, 0];
  private sz = [0, 0, 0, 0, 0];
  private latched = [false, false, false, false, false];
  private burst = [false, false, false, false, false];
  private shockT = -1;
  private shockX = 0;
  private shockZ = 0;
  private cx = 0;
  private cz = 0;
  private openFlash = false;

  constructor(group: THREE.Group) {
    this.floorDisc = new THREE.Mesh(new THREE.CircleGeometry(RADIUS, 64).rotateX(-Math.PI / 2), this.discMat);
    this.floorDisc.renderOrder = 1;
    this.floorDisc.frustumCulled = false;
    this.chart = new THREE.Mesh(starChartGeometry(RADIUS, 3.9, COLORS.ivory, COLORS.brass), this.chartMat);
    this.chart.renderOrder = 2;
    this.chart.frustumCulled = false;
    for (let i = 0; i < COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
      const ring = new THREE.Mesh(ringGeometry(RADII[i], 0.09, 24 + i * 6, COLORS.brass, '#d9ccaa', '#f0c060'), mat);
      ring.renderOrder = 4;
      ring.frustumCulled = false;
      this.rings.push(ring);
      this.ringMat.push(mat);
      this.tilt.push(new THREE.Quaternion().setFromEuler(new THREE.Euler((hash(i * 2.3 + 1) - 0.5) * 1.0, 0, (hash(i * 4.1 + 2) - 0.5) * 1.1)));
      const pm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
      const p = new THREE.Mesh(planetGeometry(0.42 + 0.04 * (i % 3), ENAMEL[i][0], ENAMEL[i][1], i === 4), pm);
      p.renderOrder = 6;
      p.frustumCulled = false;
      this.planets.push(p);
      this.planetMat.push(pm);
    }
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), this.sunMat);
    this.sun.frustumCulled = false;
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), this.coreMat);
    this.core.frustumCulled = false;
    this.core.renderOrder = 7;
    this.sun.visible = this.core.visible = this.floorDisc.visible = this.chart.visible = false;
    group.add(this.floorDisc, this.chart, this.rim.mesh, this.rim2.mesh, this.sun, this.core, this.corona.mesh, this.shock.mesh, this.flecks.mesh);
    for (const r of this.rings) { r.visible = false; group.add(r); }
    for (const p of this.planets) { p.visible = false; group.add(p); }
  }

  reset() {
    this.spin.fill(0);
    this.latched.fill(false);
    this.burst.fill(false);
    this.shockT = -1;
    this.openFlash = false;
    this.floorDisc.visible = this.chart.visible = this.sun.visible = this.core.visible = false;
    this.rim.mesh.visible = this.rim2.mesh.visible = this.corona.mesh.visible = this.shock.mesh.visible = false;
    for (const r of this.rings) r.visible = false;
    for (const p of this.planets) p.visible = false;
    this.flecks.clear();
  }

  cast(c: Cast<Sky>) {
    this.cx = c.from.x; this.cz = c.from.z;
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  /** The planet `i` riding its ring now: where it is in the world (into `out`). */
  private orbit(i: number, out: THREE.Vector3) {
    const a = this.spin[i] + i * 1.26;
    out.set(Math.cos(a) * RADII[i], 0, Math.sin(a) * RADII[i]).applyQuaternion(this.tilt[i]);
    out.x += this.cx; out.y += H; out.z += this.cz;
  }

  frame(c: Cast<Sky>, t: number, dt: number) {
    const s = c.state;
    const open = easeOut(t / 0.9);
    const fold = smooth((t - CLOSE) / 0.55);
    const alpha = smooth(t / 0.25) * (1 - fold);
    const beat = smooth((t - (BEAT - 0.12)) / 0.12) * (1 - smooth((t - LAUNCH) / 0.1));

    // the floor: a night-blue disc with the star chart, a brass rim, drawn out from the middle
    const floorOn = smooth(t / 0.5) * (1 - smooth((t - 2.75) / 0.5));
    this.floorDisc.visible = this.chart.visible = floorOn > 0.004;
    this.floorDisc.position.set(this.cx, 0.03, this.cz);
    this.chart.position.set(this.cx, 0.045, this.cz);
    const fs = 0.3 + 0.7 * easeOut(t / 0.8);
    this.floorDisc.scale.set(fs, 1, fs);
    this.chart.scale.set(fs, 1, fs);
    this.discMat.opacity = 0.75 * floorOn;
    this.chartMat.opacity = 0.9 * floorOn * (0.7 + 0.3 * Math.sin(t * 5)) * (1 - 0.5 * beat);
    for (const [r, rad, a] of [[this.rim, RADIUS * fs, 0.9], [this.rim2, RADIUS * fs - 0.22, 0.6]] as const) {
      r.mesh.visible = floorOn > 0.004;
      r.mesh.position.set(this.cx, 0.05, this.cz);
      r.mesh.scale.set(rad, 1, rad);
      r.material.opacity = a * floorOn;
    }

    // the spin: it builds up fast, stops dead in the hush, then turns slowly again
    const rate = t < BEAT ? 0.9 + 7.5 * smooth((t - 0.15) / 0.8) : t < LAUNCH ? 0 : 0.5;
    const stop = t >= BEAT - 0.25 && t < BEAT ? 1 - smooth((t - (BEAT - 0.25)) / 0.25) : 1;
    for (let i = 0; i < COUNT; i++) this.spin[i] += dt * rate * stop * (i % 2 ? -1 : 1) * (0.8 + 0.3 * i);

    // the rings open one after another from the middle out, then fold in again at the end
    for (let i = 0; i < COUNT; i++) {
      const k = clamp01(open * 1.6 - i * 0.17) * (1 - clamp01(fold * 1.4 - (COUNT - 1 - i) * 0.1));
      const ring = this.rings[i];
      ring.visible = k > 0.01;
      ring.position.set(this.cx, H, this.cz);
      ring.scale.setScalar(Math.max(0.001, easeOut(k)));
      this.q.setFromAxisAngle(this.up, this.spin[i]);
      ring.quaternion.copy(this.tilt[i]).multiply(this.q);
      this.ringMat[i].opacity = alpha * clamp01(k * 3);
    }

    // the sun: a brass bead with a hot core that gathers in the hush and flares at each launch
    this.sun.visible = alpha > 0.01;
    this.sun.position.set(this.cx, H, this.cz);
    this.sun.scale.setScalar(Math.max(0.01, easeOut(t / 0.5)) * (1 - 0.15 * beat) * (1 - fold));
    const launchFlare = this.flare(t);
    this.core.visible = alpha > 0.01;
    this.core.position.set(this.cx, H, this.cz);
    this.core.scale.setScalar(0.4 + 0.4 * beat + 0.4 * launchFlare);
    this.coreMat.opacity = (0.15 + 0.3 * beat + 0.3 * launchFlare) * alpha;
    this.corona.mesh.visible = alpha > 0.01 && (beat > 0.01 || launchFlare > 0.01);
    this.corona.mesh.position.set(this.cx, 0.06, this.cz);
    const cr = 0.8 + 1.4 * beat + 0.8 * launchFlare;
    this.corona.mesh.scale.set(cr, 1, cr);
    this.corona.material.opacity = 0.3 * (beat * 0.6 + launchFlare) * alpha;

    // the planets
    for (let i = 0; i < COUNT; i++) {
      const p = this.planets[i], m = this.planetMat[i];
      const en = s.who[i];
      const t0 = LAUNCH + i * STEP;
      if (s.landed[i]) {
        p.visible = false;
        if (!this.burst[i]) {
          this.burst[i] = true;
          this.land(c, i, t);
        }
        continue;
      }
      const flying = !!en && t >= t0 && this.latched[i];
      if (en && t >= t0 && !this.latched[i]) {
        // it leaves its orbit here
        this.orbit(i, this.v);
        this.sx[i] = this.v.x; this.sy[i] = this.v.y; this.sz[i] = this.v.z;
        this.latched[i] = true;
      }
      const grow = easeOut((t - 0.25 - i * 0.07) / 0.5) * (1 - fold);
      p.visible = grow > 0.01;
      m.opacity = Math.min(1, alpha * 3);
      if (flying) {
        const u = clamp01((t - t0) / FLY), e = u * u * (1.5 - 0.5 * u);
        const tx = en!.group.position.x, tz = en!.group.position.z;
        const mx = (this.sx[i] + tx) / 2, mz = (this.sz[i] + tz) / 2;
        const my = Math.max(this.sy[i], 1.2) + 1.6 + 0.12 * Math.hypot(tx - this.sx[i], tz - this.sz[i]);
        // a quadratic curve: leaves up and over, drops on the enemy's chest
        const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, d = e * e;
        this.v.set(a * this.sx[i] + b * mx + d * tx, a * this.sy[i] + b * my + d * 1.1, a * this.sz[i] + b * mz + d * tz);
        p.position.copy(this.v);
        p.scale.setScalar(1 + 0.25 * Math.sin(u * Math.PI));
        // its trail: flecks of its own enamel and brass
        this.tmp.set(ENAMEL[i][0]);
        this.flecks.burst(this.v.x, this.v.y, this.v.z, 1, 0.4, 0.2, this.tmp, 0.55, 1.5);
        this.flecks.burst(this.v.x, this.v.y, this.v.z, 1, 0.3, 0.2, this.brass, 0.5, 1.5);
      } else {
        this.orbit(i, this.v2);
        p.position.copy(this.v2);
        p.scale.setScalar(Math.max(0.01, grow));
      }
    }

    // a ring where a planet lands, thin ivory
    if (this.shockT >= 0) {
      const a = (t - this.shockT) / 0.5;
      this.shock.mesh.visible = a < 1;
      if (a < 1) {
        const r = 0.4 + 1.9 * easeOut(a);
        this.shock.mesh.position.set(this.shockX, 0.06, this.shockZ);
        this.shock.mesh.scale.set(r, 1, r);
        this.shock.material.opacity = 0.8 * (1 - a) * (1 - a);
      }
    }
    if (!this.openFlash && t > 0.05) {
      this.openFlash = true;
      this.flecks.burst(this.cx, H, this.cz, 26, 2.6, 1.2, this.brass, 1.0, 3);
    }
  }

  /** 1 at each planet's leaving, fading over 0.2 s. */
  private flare(t: number) {
    let f = 0;
    for (let i = 0; i < COUNT; i++) {
      const a = t - (LAUNCH + i * STEP);
      if (a >= 0 && a < 0.22) f = Math.max(f, 1 - a / 0.22);
    }
    return f;
  }

  /** The planet `i` lands on its enemy: enamel and brass flecks, a ring, a small shake. */
  private land(c: Cast<Sky>, i: number, t: number) {
    const s = c.state;
    const x = s.lx[i], z = s.lz[i];
    c.shake = Math.max(c.shake, 0.14);
    this.tmp.set(ENAMEL[i][0]);
    this.flecks.burst(x, 1.1, z, 22, 3.8, 3.2, this.tmp, 1.0, 7);
    this.flecks.burst(x, 1.1, z, 14, 3.2, 3.6, this.brass, 1.0, 7);
    this.flecks.burst(x, 1.1, z, 8, 3.8, 2.6, this.ivory, 0.9, 7);
    this.flecks.burst(x, 1.1, z, 3, 0.8, 1.2, this.hot, 0.4, 3);
    this.shockT = t; this.shockX = x; this.shockZ = z;
  }

  after(c: Cast<Sky>) {
    c.shake *= 0.84;
  }
}

export const solarOrreryModule = spell<Sky>({
  label: 'solar orrery',
  category: 'targeted',
  targeting: { mode: 'self' },
  seconds: DURATION,
  state: () => ({ who: [null, null, null, null, null], assigned: false, landed: [false, false, false, false, false], lx: [0, 0, 0, 0, 0], lz: [0, 0, 0, 0, 0] }),
  rules: {
    windup: 0.2,
    // the zone is the danger shown to the end: the planets are the hits, so its own judging is set past the last frame
    delay: DURATION + 0.4,
    shape: { kind: 'zone', area: (c) => ({ kind: 'circle', x: c.from.x, z: c.from.z, radius: RADIUS }) },
    hit: { damage: 45, knock: 0.6, color: '#c28a32', projectile: true, from: 'caster' },
    on: {
      frame(c, t) {
        const s = c.state, ctx = c.ctx, area = c.area;
        if (!ctx || !area) return;
        // the planets pick the nearest enemies inside the zone as they leave their orbits
        if (!s.assigned && t >= LAUNCH) {
          s.assigned = true;
          const list: { en: Enemy; d: number }[] = [];
          for (const en of ctx.enemies?.() ?? ctx.targets) {
            const p = en.group.position;
            if (insideTelegraph(area, p.x, p.z)) list.push({ en, d: Math.hypot(p.x - c.from.x, p.z - c.from.z) });
          }
          list.sort((a, b) => a.d - b.d);
          for (let i = 0; i < COUNT; i++) s.who[i] = list[i]?.en ?? null;
        }
        if (!s.assigned) return;
        for (let i = 0; i < COUNT; i++) {
          const en = s.who[i];
          if (!en || s.landed[i] || t < LAUNCH + i * STEP + FLY) continue;
          s.landed[i] = true;
          s.lx[i] = en.group.position.x; s.lz[i] = en.group.position.z;
          ctx.hit(en, { ...c.hitOptions(), projectile: true });
        }
      },
    },
  },
  look: OrreryLook,
  noScreen: true,
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.85 },
  frame: 14,
  maxDamage: 120,
});
