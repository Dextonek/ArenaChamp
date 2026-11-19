import * as THREE from 'three';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { flatRing } from '../../../heroes/sheath/parts';
import { Flecks, clamp01, easeOut, smooth } from '../../../heroes/sheath/partsBig';
import { KnotBand } from './g4Parts';

/**
 * Celtic knot snare (gallery 4, pipeline/designs/gallery-20.md). A trap: a circle of 2 m at the aim. A pentafoil knot is drawn
 * on the floor in one stroke, arms, and at 1.5 s binds whoever stands inside it (live position): 45 and a root of 1.4 s.
 * Answer: step out of the circle, 2 m from the middle: 0.25 + 2 / 4 = 0.75 s; the zone shows 1.46 s.
 * On the blocks: a circle that lands at 0.3 + 1.2 s, a hit with `status: root`, no move.
 */
const WIND = 0.3;
const FUSE = 1.2;
const HIT = WIND + FUSE;
const RADIUS = 2;
const DURATION = 3.0;
const DRAW = 0.9; // the pen reaches the end of the stroke
const BEAT = HIT - 0.15; // the hush
const UNWIND = 2.5; // the bands let go

const COLORS = {
  bronzeD: '#33200d', // the dark layer: deep bronze
  bronze: '#a8692a', // the accent: bronze
  silver: '#e4eaee', // the foil: silver inlay
  moss: '#58a55c', // the energy
  dark: '#0a140c',
  hot: '#e9ffe0', // the hot core: pulses only
};

class KnotLook implements Look<null> {
  private band = new KnotBand(1.3, COLORS);
  private disc: THREE.Mesh;
  private discMat = new THREE.MeshBasicMaterial({ color: COLORS.dark, transparent: true, opacity: 0, depthWrite: false });
  private rim = flatRing(new THREE.Color(COLORS.bronze), 0.04, false, 3);
  private inlay = flatRing(new THREE.Color(COLORS.silver), 0.012, false, 3);
  private shock = flatRing(new THREE.Color(COLORS.silver), 0.07, true, 5);
  private pen: THREE.Mesh;
  private penMat = new THREE.MeshBasicMaterial({ color: COLORS.hot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private flecks = new Flecks(160, 0.2);
  private bronze = new THREE.Color(COLORS.bronze);
  private silver = new THREE.Color(COLORS.silver);
  private moss = new THREE.Color(COLORS.moss);
  private v = new THREE.Vector3();
  private cx = 0;
  private cz = 0;
  private vx = 0;
  private vz = 0;
  private caught = false;
  private hit = false;
  private sparkT = 0;

  constructor(group: THREE.Group) {
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(RADIUS, 48).rotateX(-Math.PI / 2), this.discMat);
    this.disc.renderOrder = 1;
    this.disc.frustumCulled = false;
    this.pen = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16).rotateX(-Math.PI / 2), this.penMat);
    this.pen.renderOrder = 6;
    this.pen.frustumCulled = false;
    this.disc.visible = this.pen.visible = false;
    group.add(this.disc, this.rim.mesh, this.inlay.mesh, this.band.mesh, this.pen, this.shock.mesh, this.flecks.mesh);
  }

  reset() {
    this.hit = false;
    this.caught = false;
    this.sparkT = 0;
    this.band.mesh.visible = false;
    this.disc.visible = this.pen.visible = false;
    this.rim.mesh.visible = this.inlay.mesh.visible = this.shock.mesh.visible = false;
    this.flecks.clear();
  }

  cast(c: Cast<null>) {
    const p = c.centres[0];
    this.cx = p.x; this.cz = p.z;
    this.band.cx = this.cx; this.band.cz = this.cz;
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  /** Who was bound: the knot coils round them where they stood at the hit (a root holds them there). */
  impact(c: Cast<null>) {
    const who = c.caught[0];
    this.hit = true;
    this.caught = !!who;
    this.vx = who ? who.group.position.x : this.cx;
    this.vz = who ? who.group.position.z : this.cz;
    this.band.vx = this.vx; this.band.vz = this.vz;
    this.band.coilR = this.caught ? 0.78 : 0.3;
    this.band.coilH = this.caught ? 1.55 : 0.55;
    c.shake = 0.22;
    this.flecks.burst(this.cx, 0.2, this.cz, 28, 4.2, 3.2, this.bronze, 1.1, 7);
    this.flecks.burst(this.cx, 0.2, this.cz, 14, 3.4, 4.2, this.silver, 0.9, 7);
    this.flecks.burst(this.vx, 0.3, this.vz, 18, 1.6, 3.0, this.moss, 1.2, 4);
  }

  frame(c: Cast<null>, t: number) {
    const b = this.band;
    const place = (r: ReturnType<typeof flatRing>, rad: number, a: number) => {
      r.mesh.visible = a > 0.004;
      r.mesh.scale.set(rad, 1, rad);
      r.mesh.position.set(this.cx, 0.05, this.cz);
      r.material.opacity = a;
    };
    const fadeOut = 1 - smooth((t - 2.6) / 0.4);
    // the ward: dark floor, a bronze rim with a thin silver line inside it
    const ward = smooth(t / 0.4) * fadeOut;
    this.disc.visible = ward > 0.004;
    this.disc.position.set(this.cx, 0.03, this.cz);
    this.discMat.opacity = 0.5 * ward * (t > BEAT && t < HIT ? 0.7 : 1);
    place(this.rim, RADIUS, 0.9 * ward);
    place(this.inlay, RADIUS - 0.14, 0.7 * ward);

    // the pen draws the knot in one stroke
    const draw = clamp01(t / DRAW);
    b.reveal = easeOut(draw * 0.9 + 0.1 * draw * draw) * 1.0;
    if (draw < 1) b.reveal = 1 - Math.pow(1 - draw, 1.6);
    const hush = smooth((t - BEAT) / 0.1);
    const armed = smooth((t - DRAW) / 0.25);
    b.arm = armed * (1 - 0.6 * hush) * (this.hit ? 0 : 1);
    b.pulse = t > DRAW - 0.1 && t < BEAT ? ((t - DRAW + 0.1) * 1.7) % 1 : -1;
    b.flare = 0;
    b.e = 0;
    b.start = 0;
    b.opacity = 1;

    if (draw < 1) {
      // a light at the pen's tip and a trail of silver
      b.tip(this.v);
      this.pen.visible = true;
      this.pen.position.copy(this.v);
      this.pen.scale.setScalar(0.8 + 0.3 * Math.sin(t * 40));
      this.penMat.opacity = 0.9 * smooth(t / 0.1);
      this.sparkT += 1;
      if (this.sparkT % 2 === 0) this.flecks.burst(this.v.x, this.v.y, this.v.z, 1, 0.5, 1.1, this.silver, 0.7, 2.5);
    } else {
      this.penMat.opacity = Math.max(0, this.penMat.opacity - 0.2);
      this.pen.visible = this.penMat.opacity > 0.01;
    }

    if (this.hit) {
      const a = t - HIT;
      const q = clamp01(a / 0.45);
      // the bands lift and tighten: an overshoot, then a slow squeeze
      const back = 2.3 * (q - 1) ** 3 + 1.3 * (q - 1) ** 2 + 1;
      b.e = back - 0.03 * Math.sin(Math.max(0, a - 0.45) * 7) * (a > 0.45 ? 1 : 0);
      b.flare = (this.caught ? 0.8 : 0.4) * (1 - smooth(a / 0.8));
      b.arm = 0;
      b.pulse = -1;
      // an empty snare closes and lets go sooner
      const end = this.caught ? UNWIND : 2.0;
      b.start = smooth((t - end) / 0.5) * 0.97;
      b.opacity = 1 - smooth((t - end - 0.3) / 0.25);
      const s = clamp01(a / 0.5);
      place(this.shock, 0.6 + 2.2 * easeOut(s), 0.8 * (1 - s) * (1 - s));
    } else {
      this.shock.mesh.visible = false;
    }
    b.build();
  }

  after(c: Cast<null>) {
    c.shake *= 0.86;
  }
}

export const celticKnotSnareModule = spell<null>({
  label: 'celtic knot snare',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: WIND,
    delay: FUSE,
    shape: { kind: 'circle', radius: RADIUS, at: (c) => [{ x: c.ctx!.point.x, z: c.ctx!.point.z }] },
    hit: { damage: 45, knock: 0, color: '#58a55c', status: { kind: 'root', seconds: 1.4 }, from: 'centre' },
  },
  look: KnotLook,
  noScreen: true,
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.85 },
  frame: 7,
  maxDamage: 120,
});
