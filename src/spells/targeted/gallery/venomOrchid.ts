import * as THREE from 'three';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { flatRing } from '../../../heroes/sheath/parts';
import { Flecks } from '../../../heroes/sheath/partsBig';
import { Puffs, clamp01, easeBack, easeOut, hash, leafGeometry, petalGeometry, smooth } from './g10Parts';

/**
 * Venom orchid (gallery 10, pipeline/designs/gallery-20.md). Mark and detonate on the chosen enemy: at 0.2 s five dark-veined
 * leaves lunge out at their feet and an orchid unfurls petal by petal round them (three sepals, two wings, a frilled lip that
 * faces the caster); it pulses (1.2 s), draws a long breath in (1.45 s, the dead beat, still from 1.68 s) and at 1.8 s bursts
 * into a pollen cloud that lingers and fades by 3.3 s. The hit (70, a shove) lands on the enemy if they still stand within
 * 1.6 m of where they stood at the cast. Answer: walk 1.6 m out: 0.25 + 1.6 / 4 = 0.65 s; the zone shows 1.76 s.
 * On the blocks: a sure hit (`target`) with a delay of 1.6 s, mark 1.6 m, `inside` 1.6 m.
 * Botanical: dark aubergine and leaf-green under magenta petals with pale tips, chartreuse pollen as the hot core.
 */
const WIND = 0.2;
const FUSE = 1.6;
const HIT = WIND + FUSE;
const MARK = 1.6;
const DURATION = 3.4;
const PULSE1 = 1.15; // the first, short pulse
const BREATH = 1.45; // the second: the long breath in, the dead beat
const STILL = 1.68; // everything holds

const COLORS = {
  dark: '#12061a', // the dark layer: aubergine soil
  leaf: '#4f7d3a',
  vein: '#071509', // the dark leaf veins
  magenta: '#d1239a', // the accent
  deep: '#6d0f56',
  foil: '#f7dcee', // the pale foil on every petal
  chartreuse: '#c6f01f', // the pollen
  hot: '#f6ffb4', // the hot core: the throat and the pulses
};

interface PetalSpec {
  az: number; // from the lip's direction, radians
  len: number;
  wid: number;
  open: number; // pitch from the floor when open
  start: number;
  geo: number;
  pivot: number; // how far from the middle it is rooted
}

const PETALS: PetalSpec[] = [
  { az: Math.PI, len: 2.0, wid: 0.2, open: 1.1, start: 0.55, geo: 0, pivot: 0.4 }, // the dorsal sepal, behind
  { az: 2.45, len: 1.9, wid: 0.19, open: 0.8, start: 0.67, geo: 0, pivot: 0.42 },
  { az: -2.45, len: 1.9, wid: 0.19, open: 0.8, start: 0.79, geo: 0, pivot: 0.42 },
  { az: 1.4, len: 1.7, wid: 0.42, open: 0.62, start: 0.9, geo: 1, pivot: 0.4 }, // the wings, to each side
  { az: -1.4, len: 1.7, wid: 0.42, open: 0.62, start: 0.98, geo: 1, pivot: 0.4 },
  { az: 0, len: 1.55, wid: 0.4, open: 0.36, start: 1.1, geo: 2, pivot: 0.38 }, // the lip, toward the caster
];
const LEAVES = 5;

class OrchidLook implements Look<null> {
  private soil: THREE.Mesh;
  private soilMat = new THREE.MeshBasicMaterial({ color: COLORS.dark, transparent: true, opacity: 0, depthWrite: false });
  private dust: THREE.Mesh;
  private dustMat = new THREE.MeshBasicMaterial({ color: COLORS.chartreuse, transparent: true, opacity: 0, depthWrite: false });
  private glow: THREE.Mesh;
  private glowMat = new THREE.MeshBasicMaterial({ color: COLORS.hot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private leafMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
  private petalMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
  private leaves: THREE.Mesh[] = [];
  private pivots: THREE.Group[] = [];
  private ring1 = flatRing(new THREE.Color(COLORS.chartreuse), 0.06, true, 7);
  private ring2 = flatRing(new THREE.Color(COLORS.hot), 0.07, true, 7);
  private shock = flatRing(new THREE.Color(COLORS.magenta), 0.1, true, 7);
  private cloud = new Puffs(46, 1.0, '#c6f01f', '#efff7a');
  private haze = new Puffs(20, 0.8, '#d1239a', '#f7dcee', 5);
  private flecks = new Flecks(200, 0.17);
  private chart = new THREE.Color(COLORS.chartreuse);
  private mag = new THREE.Color(COLORS.magenta);
  private hotC = new THREE.Color(COLORS.hot);
  private foil = new THREE.Color(COLORS.foil);
  private cx = 0;
  private cz = 0;
  private lipAz = 0;
  private leafAz: number[] = [];
  private burstAt = -1;
  private pulsed1 = false;
  private pulsed2 = false;

  constructor(group: THREE.Group) {
    this.soil = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48).rotateX(-Math.PI / 2), this.soilMat);
    this.soil.renderOrder = 1;
    this.dust = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48).rotateX(-Math.PI / 2), this.dustMat);
    this.dust.renderOrder = 2;
    this.glow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24).rotateX(-Math.PI / 2), this.glowMat);
    this.glow.renderOrder = 8;
    for (const m of [this.soil, this.dust, this.glow]) { m.frustumCulled = false; m.visible = false; }
    group.add(this.soil, this.dust);
    const leafGeo = leafGeometry(0.27, COLORS.leaf, COLORS.vein);
    for (let i = 0; i < LEAVES; i++) {
      const m = new THREE.Mesh(leafGeo, this.leafMat);
      m.renderOrder = 3;
      m.frustumCulled = false;
      m.visible = false;
      this.leaves.push(m);
      group.add(m);
    }
    const geos = [
      petalGeometry(1, 0.2, 0.2, 0.1, 0.7, COLORS.deep, COLORS.magenta, COLORS.foil), // sepal: long, pointed
      petalGeometry(1, 0.4, 0.14, 0.18, 0.55, COLORS.deep, '#e02aa6', COLORS.foil), // wing: broad, rounded
      petalGeometry(1, 0.4, -0.2, 0.3, 0.5, COLORS.chartreuse, '#f19bd0', COLORS.magenta), // lip: a chartreuse throat, a frilled edge
    ];
    for (const p of PETALS) {
      const pivot = new THREE.Group();
      const m = new THREE.Mesh(geos[p.geo], this.petalMat);
      m.scale.set(p.len, 1, p.len);
      m.renderOrder = 6 + (p.geo === 2 ? 1 : 0);
      m.frustumCulled = false;
      pivot.add(m);
      pivot.visible = false;
      this.pivots.push(pivot);
      group.add(pivot);
    }
    group.add(this.glow, this.ring1.mesh, this.ring2.mesh, this.shock.mesh, this.cloud.mesh, this.haze.mesh, this.flecks.mesh);
  }

  reset() {
    this.burstAt = -1;
    this.pulsed1 = this.pulsed2 = false;
    this.soil.visible = this.dust.visible = this.glow.visible = false;
    for (const m of this.leaves) m.visible = false;
    for (const p of this.pivots) p.visible = false;
    this.ring1.mesh.visible = this.ring2.mesh.visible = this.shock.mesh.visible = false;
    this.cloud.mesh.visible = this.haze.mesh.visible = false;
    this.petalMat.opacity = this.leafMat.opacity = 1;
    this.flecks.clear();
  }

  cast(c: Cast<null>) {
    this.cx = c.spot.x; this.cz = c.spot.z;
    // the lip turns to the caster; the leaves lie between the petals
    this.lipAz = Math.atan2(c.from.z - this.cz, c.from.x - this.cx);
    this.leafAz.length = 0;
    for (let i = 0; i < LEAVES; i++) this.leafAz.push(this.lipAz + 0.6 + (i / LEAVES) * Math.PI * 2 + (hash(i * 4 + 1) - 0.5) * 0.35);
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  impact(c: Cast<null>) {
    const a = this.hit(c);
    void a;
  }

  private hit(c: Cast<null>) {
    this.burstAt = HIT;
    const x = this.cx, z = this.cz;
    this.flecks.burst(x, 0.5, z, 70, 3.4, 2.2, this.chart, 2.2, 0.6);
    this.flecks.burst(x, 0.5, z, 34, 2.8, 2.6, this.mag, 1.8, 0.8);
    this.flecks.burst(x, 0.6, z, 14, 2.0, 2.4, this.hotC, 1.4, 0.4);
    this.flecks.burst(x, 0.4, z, 14, 2.6, 2.0, this.foil, 1.6, 0.9);
    c.shake = 0.16;
  }

  /** A round of petals for time t: unfurled, swollen at the first pulse, drawn in at the breath, then flung and falling. */
  private petals(t: number) {
    const swell = 0.1 * Math.sin(Math.PI * clamp01((t - PULSE1) / 0.28));
    const inhale = smooth((t - BREATH) / 0.22);
    const burst = this.burstAt >= 0 ? t - this.burstAt : -1;
    for (let i = 0; i < PETALS.length; i++) {
      const p = PETALS[i], piv = this.pivots[i];
      const u = clamp01((t - p.start) / 0.5);
      if (u <= 0) { piv.visible = false; continue; }
      piv.visible = true;
      const e = easeBack(u), ge = easeOut(u);
      const az = this.lipAz + p.az;
      let pitch = 1.5 + (p.open - 1.5) * e + 0.28 * inhale * (1 - 0.4 * (burst >= 0 ? 1 : 0)) - 0.06 * Math.sin(Math.PI * clamp01((t - PULSE1) / 0.28));
      let sc = (0.28 + 0.72 * ge) * (1 + swell) * (1 - 0.06 * inhale);
      let r = p.pivot, y = 0.05;
      let spin = 0;
      if (burst >= 0) {
        const k = burst;
        r += 1.7 * easeOut(k / 0.6) * (0.7 + 0.5 * hash(i * 3 + 7));
        y = Math.max(0.05, 0.5 + 1.6 * k - 4.2 * k * k);
        pitch = pitch - (pitch - 0.12) * easeOut(k / 0.5);
        spin = (hash(i * 5 + 1) - 0.5) * 8 * k;
        sc *= 1 - 0.5 * smooth((k - 0.3) / 0.7);
      }
      piv.position.set(this.cx + Math.cos(az) * r, y, this.cz + Math.sin(az) * r);
      piv.rotation.set(spin * 0.4, -az, pitch);
      piv.scale.setScalar(Math.max(1e-3, sc));
    }
  }

  frame(c: Cast<null>, t: number) {
    const cx = this.cx, cz = this.cz;
    // the soil darkens under the mark
    const soil = smooth(t / 0.45) * (1 - smooth((t - 2.5) / 0.8));
    this.soil.visible = soil > 0.01;
    this.soil.position.set(cx, 0.03, cz);
    this.soilMat.opacity = 0.62 * soil;
    this.soil.scale.setScalar(0.3 + 0.7 * easeOut(t / 0.5));

    // the leaves lunge out one by one
    const wilt = 1 - smooth((t - 2.3) / 0.8);
    this.leafMat.opacity = wilt;
    for (let i = 0; i < LEAVES; i++) {
      const m = this.leaves[i], az = this.leafAz[i];
      const u = easeBack(clamp01((t - (WIND + 0.05 + 0.09 * i)) / 0.45));
      m.visible = u > 0.01 && wilt > 0.01;
      if (!m.visible) continue;
      const len = (1.8 + 0.35 * hash(i * 11 + 2)) * u * (1 - 0.25 * smooth((t - 2.3) / 0.8)) * (1 + 0.04 * Math.sin(t * 3 + i));
      m.position.set(cx + Math.cos(az) * 0.3, 0.035 + 0.002 * i, cz + Math.sin(az) * 0.3);
      m.rotation.y = -az;
      m.scale.set(Math.max(1e-3, len), 1, Math.max(1e-3, len));
    }

    this.petals(t);
    this.petalMat.opacity = this.burstAt >= 0 ? 1 - smooth((t - this.burstAt - 0.15) / 0.55) : 1;

    // the glow in the throat: one small hot disc that warms with each pulse and the breath
    const g1 = Math.sin(Math.PI * clamp01((t - PULSE1) / 0.28));
    const inhale = smooth((t - BREATH) / 0.22);
    const open = smooth((t - 1.0) / 0.4);
    const glow = this.burstAt >= 0 ? 0 : (0.18 * open + 0.4 * g1 + 0.5 * inhale) * (t > STILL ? 1 : 1);
    this.glow.visible = glow > 0.01;
    this.glow.position.set(cx, 0.12, cz);
    this.glow.scale.setScalar(0.7 + 0.5 * inhale + 0.4 * g1);
    this.glowMat.opacity = glow;

    // pulse 1: a ring of chartreuse; the breath: a ring that is drawn in, not thrown out
    if (t >= PULSE1 && !this.pulsed1) {
      this.pulsed1 = true;
      this.flecks.burst(cx, 0.55, cz, 16, 1.2, 1.8, this.chart, 1.2, -0.4);
    }
    const p1 = clamp01((t - PULSE1) / 0.4);
    this.ring1.mesh.visible = p1 > 0 && p1 < 1;
    this.ring1.mesh.position.set(cx, 0.07, cz);
    this.ring1.mesh.scale.setScalar(0.5 + 1.0 * easeOut(p1));
    this.ring1.material.opacity = 0.75 * (1 - p1) * (1 - p1);
    if (t >= BREATH && !this.pulsed2) {
      this.pulsed2 = true;
      this.flecks.burst(cx, 0.6, cz, 10, 0.8, 1.0, this.hotC, 1.0, -0.3);
    }
    const p2 = clamp01((t - BREATH) / (STILL - BREATH));
    this.ring2.mesh.visible = p2 > 0 && t < HIT;
    this.ring2.mesh.position.set(cx, 0.075, cz);
    this.ring2.mesh.scale.setScalar(1.7 - 1.0 * easeOut(p2)); // drawn inward
    this.ring2.material.opacity = 0.7 * Math.sin(Math.PI * Math.min(1, p2 * 1.1)) * (t < STILL ? 1 : 0.45);

    // the burst and what follows
    if (this.burstAt >= 0) {
      const a = t - this.burstAt, s = clamp01(a / 0.5);
      this.shock.mesh.visible = s < 1;
      this.shock.mesh.position.set(cx, 0.08, cz);
      this.shock.mesh.scale.setScalar(0.5 + 2.1 * easeOut(s));
      this.shock.material.opacity = 0.75 * (1 - s) * (1 - s);
      this.cloud.set(cx, cz, a, 1.6, 0.5 * smooth(a / 0.15) * (1 - smooth((a - 1.0) / 0.5)));
      this.haze.set(cx, cz, a + 0.1, 1.2, 0.35 * smooth(a / 0.15) * (1 - smooth((a - 0.5) / 0.6)));
      this.dust.visible = true;
      this.dust.position.set(cx, 0.04, cz);
      this.dustMat.opacity = 0.2 * smooth(a / 0.1) * (1 - smooth((a - 0.9) / 0.6));
      this.dust.visible = this.dustMat.opacity > 0.004;
      // a few late motes keep rising from the stain
      if (a > 0.2 && a < 1.2 && (Math.floor(t * 60) % 4) === 0) {
        const n = Math.floor(t * 60) * 0.37;
        const ang = hash(n) * Math.PI * 2, rr = 1.3 * Math.sqrt(hash(n + 5));
        this.flecks.burst(cx + Math.cos(ang) * rr, 0.2, cz + Math.sin(ang) * rr, 1, 0.2, 0.6, this.chart, 1.4, -0.5);
      }
    }
  }

  after(c: Cast<null>) {
    c.shake *= 0.86;
  }
}

export const venomOrchidModule = spell<null>({
  label: 'venom orchid',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: WIND,
    delay: FUSE,
    shape: { kind: 'target', mark: MARK, inside: MARK },
    hit: { damage: 70, knock: 2.5, color: '#d1239a', projectile: true },
  },
  look: OrchidLook,
  noScreen: true,
  bloom: { enabled: true, strength: 0.38, radius: 0.45, threshold: 0.85 },
  frame: 8,
  maxDamage: 150,
});
