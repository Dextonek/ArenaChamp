import * as THREE from 'three';
import type { Enemy } from '../../../effects/common';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { flatRing } from '../../../heroes/sheath/parts';
import { Chips, Flecks, LaneFloor, clamp01, dotTexture, easeOut, joinParts, paint, smooth } from './g8Parts';

/**
 * Gargoyle swoop (gallery 8, pipeline/designs/gallery-20.md). A stone gargoyle tears free of a little corbel at the caster's
 * side and swoops low down a lane, 11 m long and 2 m wide, in 0.7 s; the creature IS the front: whoever it passes inside the
 * lane is hit once (46, a knock). At the end it crumbles into stones. Answer: leave the lane before it reaches you, 1 m to its
 * edge: 0.25 + 1 / 4 = 0.5 s; the zone shows 0.6 s.
 * On the blocks: a lane with no move whose `front` is the creature's flight (`late` = its flight time).
 */
const WIND = 0.6; // the corbel rises, the eyes kindle; the last 0.18 s is the dead beat
const BEAT = WIND - 0.18;
const FLIGHT = 0.7;
const LEN = 11;
const WID = 2;
const DURATION = 3.2;
const CORBEL_H = 0.74;

const COLORS = {
  lead: '#242730', // the dark layer: lead and slate
  stone: '#74777f',
  gold: '#f2ae47', // the accent: candle gold
  bone: '#bdb59f', // the pale foil: limestone
  lichen: '#6d8b3a',
  hot: '#fff1c4', // the hot core: eyes and a spark
};

type V3 = [number, number, number];

/** A primitive placed and painted: scale, then turn, then move. */
function piece(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, p: V3, r: V3, s: V3, seed: number, lichen?: THREE.Color) {
  geo.scale(s[0], s[1], s[2]);
  geo.rotateX(r[0]); geo.rotateY(r[1]); geo.rotateZ(r[2]);
  geo.translate(p[0], p[1], p[2]);
  return paint(geo, color, { seed, vary: 0.16, lichen: lichen ?? null, both: true });
}

/** A tapered rod from a to b. */
function limb(a: V3, b: V3, r0: number, r1: number, color: THREE.ColorRepresentation, seed: number, lichen?: THREE.Color) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, 6, 1, false);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate(a[0], a[1], a[2]);
  return paint(g, color, { seed, vary: 0.14, lichen: lichen ?? null, both: true });
}

/** A triangle (a membrane panel). */
function tri(a: V3, b: V3, c: V3, color: THREE.ColorRepresentation, seed: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  return paint(g, color, { seed, vary: 0.34, both: true });
}

/** The gargoyle's three parts (all facing +z, up +y): body with head and legs, one wing (sign +1 right, -1 left) and the tail. */
function buildGargoyle() {
  const lichen = new THREE.Color(COLORS.lichen);
  const S = COLORS.stone, B = COLORS.bone, G = COLORS.gold, H = COLORS.hot;
  const body: THREE.BufferGeometry[] = [
    piece(new THREE.SphereGeometry(0.46, 9, 7), S, [0, 0, 0.05], [0, 0, 0], [0.8, 0.72, 1.25], 1, lichen),
    piece(new THREE.SphereGeometry(0.34, 8, 6), S, [0, 0.03, 0.5], [0, 0, 0], [1.05, 0.92, 0.9], 2, lichen),
    piece(new THREE.SphereGeometry(0.3, 8, 6), S, [0, -0.02, -0.4], [0, 0, 0], [0.95, 0.85, 1], 3, lichen),
    limb([0, 0.1, 0.62], [0, 0.22, 0.88], 0.19, 0.15, S, 4, lichen),
    piece(new THREE.BoxGeometry(0.46, 0.36, 0.5), S, [0, 0.24, 0.98], [0.1, 0, 0], [1, 1, 1], 5, lichen),
    piece(new THREE.BoxGeometry(0.3, 0.2, 0.34), S, [0, 0.14, 1.3], [0.08, 0, 0], [1, 1, 1], 6),
    piece(new THREE.BoxGeometry(0.28, 0.06, 0.34), COLORS.lead, [0, -0.02, 1.25], [0.3, 0, 0], [1, 1, 1], 7),
    piece(new THREE.BoxGeometry(0.2, 0.035, 0.24), G, [0, 0.03, 1.25], [0.12, 0, 0], [1, 1, 1], 8),
    piece(new THREE.BoxGeometry(0.54, 0.08, 0.17), COLORS.lead, [0, 0.43, 1.1], [0.25, 0, 0], [1, 1, 1], 9),
    piece(new THREE.BoxGeometry(0.085, 0.05, 0.06), H, [0.14, 0.36, 1.2], [0, 0, 0], [1, 1, 1], 10),
    piece(new THREE.BoxGeometry(0.085, 0.05, 0.06), H, [-0.14, 0.36, 1.2], [0, 0, 0], [1, 1, 1], 11),
  ];
  for (const sg of [1, -1]) {
    body.push(
      piece(new THREE.ConeGeometry(0.075, 0.5, 6), B, [sg * 0.18, 0.5, 0.82], [-1.05, 0, sg * 0.3], [1, 1, 1], 12 + sg),
      limb([sg * 0.28, -0.04, 0.46], [sg * 0.34, -0.3, 0.86], 0.1, 0.06, S, 14 + sg, lichen),
      piece(new THREE.ConeGeometry(0.06, 0.24, 5), B, [sg * 0.36, -0.36, 0.98], [1.9, 0, 0], [1, 1, 1], 16 + sg),
      limb([sg * 0.26, -0.1, -0.35], [sg * 0.32, -0.4, -0.12], 0.12, 0.07, S, 18 + sg, lichen),
      piece(new THREE.ConeGeometry(0.06, 0.22, 5), B, [sg * 0.34, -0.46, 0.0], [1.9, 0, 0], [1, 1, 1], 20 + sg),
    );
  }

  const wing = (sg: number) => {
    const W = (x: number, y: number, z: number): V3 => [sg * x, y, z];
    const sh = W(0, 0, 0), el = W(0.55, 0.3, 0.02), wr = W(1.0, 0.45, 0.12);
    const f1 = W(1.75, 0.28, -0.4), f2 = W(1.5, 0.02, -1.05), f3 = W(0.95, -0.14, -1.4), bk = W(0.12, -0.1, -0.8);
    const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2 * 0.86 + sg * 0.08, (a[1] + b[1]) / 2 - 0.04, (a[2] + b[2]) / 2 * 0.92 + 0.1];
    const ring = [sh, el, wr, f1, mid(f1, f2), f2, mid(f2, f3), f3, mid(f3, bk), bk];
    const c: V3 = W(0.7, 0.08, -0.5);
    const parts: THREE.BufferGeometry[] = [];
    const lead = ['#2a2d36', '#343842', '#23262e'];
    for (let i = 0; i < ring.length; i++) parts.push(tri(c, ring[i], ring[(i + 1) % ring.length], lead[i % 3], 30 + i));
    parts.push(
      limb(sh, el, 0.075, 0.06, S, 50, lichen), limb(el, wr, 0.06, 0.05, B, 51),
      limb(wr, f1, 0.045, 0.025, B, 52), limb(wr, f2, 0.045, 0.025, B, 53), limb(wr, f3, 0.04, 0.025, B, 54),
      piece(new THREE.ConeGeometry(0.05, 0.3, 5), B, [wr[0], wr[1] + 0.12, wr[2] + 0.1], [-0.5, 0, sg * -0.3], [1, 1, 1], 55),
      piece(new THREE.IcosahedronGeometry(0.06, 0), G, [wr[0], wr[1], wr[2]], [0, 0, 0], [1, 1, 1], 56),
    );
    return joinParts(parts);
  };

  const tail = joinParts([
    limb([0, 0, 0], [0, -0.04, -0.4], 0.17, 0.12, S, 60, lichen),
    limb([0, -0.04, -0.4], [0, -0.12, -0.8], 0.12, 0.08, S, 61),
    limb([0, -0.12, -0.8], [0, -0.1, -1.15], 0.08, 0.05, S, 62),
    piece(new THREE.OctahedronGeometry(0.15, 0), B, [0, -0.1, -1.3], [0, 0, 0], [0.5, 1, 1.5], 63),
  ]);
  return { body: joinParts(body), right: wing(1), left: wing(-1), tail };
}

/** The corbel: three courses of stone stepping outward, a thin gold band under the top slab. Its base is at y = 0. */
function buildCorbel(): THREE.BufferGeometry {
  const lichen = new THREE.Color(COLORS.lichen);
  return joinParts([
    piece(new THREE.BoxGeometry(0.34, 0.3, 0.34), COLORS.stone, [0, 0.15, 0], [0, 0.2, 0], [1, 1, 1], 70, lichen),
    piece(new THREE.BoxGeometry(0.46, 0.26, 0.46), COLORS.stone, [0, 0.43, 0], [0, 0.2, 0], [1, 1, 1], 71, lichen),
    piece(new THREE.BoxGeometry(0.49, 0.03, 0.49), COLORS.gold, [0, 0.575, 0], [0, 0.2, 0], [1, 1, 1], 72),
    piece(new THREE.BoxGeometry(0.64, 0.17, 0.64), COLORS.bone, [0, 0.655, 0], [0, 0.2, 0], [1, 1, 1], 73, lichen),
  ]);
}

class SwoopLook implements Look<null> {
  private floor = new LaneFloor(LEN, WID + 0.2, 1, { dark: COLORS.lead, acc: COLORS.gold, pale: COLORS.bone, hot: COLORS.hot });
  private corbel: THREE.Mesh;
  private garg = new THREE.Group();
  private bodyMesh: THREE.Mesh;
  private wingR: THREE.Mesh;
  private wingL: THREE.Mesh;
  private tailMesh: THREE.Mesh;
  private eyes: THREE.Sprite[] = [];
  private glowMat = new THREE.SpriteMaterial({ map: dotTexture(false), color: COLORS.gold, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  private chips = new Chips(110, [COLORS.stone, COLORS.bone, '#8d9098', '#5f626b', '#7c8a52']);
  private dust = new Flecks(240, 0.2);
  private sparks = new Flecks(120, 0.15);
  private ring = flatRing(new THREE.Color(COLORS.gold), 0.06, true, 5);
  private ring2 = flatRing(new THREE.Color(COLORS.bone), 0.05, true, 5);
  private gold = new THREE.Color(COLORS.gold);
  private hotC = new THREE.Color(COLORS.hot);
  private dustC = new THREE.Color('#a9a79d');
  private v = new THREE.Vector3();
  private risen = false;
  private torn = false;
  private broke = false;
  private rattle = 0;
  private n = 0;
  private endX = 0;
  private endZ = 0;

  constructor(group: THREE.Group) {
    const parts = buildGargoyle();
    const mat = () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.bodyMesh = new THREE.Mesh(parts.body, mat());
    this.wingR = new THREE.Mesh(parts.right, mat());
    this.wingL = new THREE.Mesh(parts.left, mat());
    this.tailMesh = new THREE.Mesh(parts.tail, mat());
    this.wingR.position.set(0.28, 0.14, 0.3);
    this.wingL.position.set(-0.28, 0.14, 0.3);
    this.wingR.rotation.order = this.wingL.rotation.order = 'YZX';
    this.tailMesh.position.set(0, 0, -0.6);
    for (const sx of [0.14, -0.14]) {
      const s = new THREE.Sprite(this.glowMat);
      s.position.set(sx, 0.36, 1.22);
      this.eyes.push(s);
    }
    const mouth = new THREE.Sprite(this.glowMat);
    mouth.position.set(0, 0.03, 1.3);
    this.eyes.push(mouth);
    this.garg.add(this.bodyMesh, this.wingR, this.wingL, this.tailMesh, ...this.eyes);
    this.garg.scale.setScalar(1.1);
    this.corbel = new THREE.Mesh(buildCorbel(), mat());
    for (const o of [this.bodyMesh, this.wingR, this.wingL, this.tailMesh, this.corbel]) o.frustumCulled = false;
    this.garg.visible = this.corbel.visible = false;
    group.add(this.floor.group, this.corbel, this.garg, this.chips.mesh, this.dust.mesh, this.sparks.mesh, this.ring.mesh, this.ring2.mesh);
  }

  reset() {
    this.risen = this.torn = this.broke = false;
    this.rattle = 0;
    this.n = 0;
    this.garg.visible = this.corbel.visible = false;
    this.ring.mesh.visible = this.ring2.mesh.visible = false;
    this.glowMat.opacity = 0;
    this.floor.set(0, 0, 0, 0, 0, 0);
    this.chips.clear();
    this.dust.clear();
    this.sparks.clear();
  }

  tick(dt: number) {
    this.chips.update(dt);
    this.dust.update(dt);
    this.sparks.update(dt);
  }

  idle(dt: number) {
    this.tick(dt);
  }

  struck(c: Cast<null>, who: Enemy) {
    const p = who.group.position;
    this.chips.burst(p.x, 0.6, p.z, 8, c.dir.x * 2, 1.6, c.dir.z * 2, 2.2, 0.12, 1.3);
    this.dust.burst(p.x, 0.3, p.z, 12, 2.0, 1.8, this.dustC, 0.8, 5);
    this.sparks.burst(p.x, 0.8, p.z, 8, 2.4, 2.6, this.gold, 0.6, 5);
    c.shake = Math.max(c.shake, 0.22);
  }

  private shock(r: ReturnType<typeof flatRing>, x: number, z: number, rad: number, a: number) {
    r.mesh.visible = a > 0.004;
    r.mesh.position.set(x, 0.06, z);
    r.mesh.scale.set(rad, 1, rad);
    r.material.opacity = a;
  }

  frame(c: Cast<null>, t: number, dt: number) {
    const dx = c.dir.x, dz = c.dir.z, px = dz, pz = -dx;
    const cx = c.from.x + dx * 0.5 + px * 1.45, cz = c.from.z + dz * 0.5 + pz * 1.45;
    const yaw = Math.atan2(dx, dz);

    // the floor: tracery drawn from his feet, still at the beat, then lit behind the creature
    const hush = smooth((t - BEAT) / 0.08) * (1 - smooth((t - WIND) / 0.04));
    const dist = t >= WIND ? c.front(t) : 0;
    const out = 1 - smooth((t - 1.7) / 0.8);
    this.floor.place(c.from.x, c.from.z, dx, dz);
    this.floor.set(t, easeOut(t / 0.5) * 1.04, smooth(t / 0.2) * out, hush, dist / LEN, 0);

    // the corbel rises with a puff of dust, cracks when the creature tears free, sinks away late
    if (!this.risen) {
      this.risen = true;
      this.dust.burst(cx, 0.1, cz, 24, 2.2, 1.2, this.dustC, 0.9, 5);
    }
    const rise = easeOut(t / 0.3);
    const crack = 1 - 0.5 * smooth((t - WIND) / 0.08);
    const sink = 1 - smooth((t - 2.0) / 0.55);
    const cs = Math.max(rise * crack * sink, 1e-3);
    this.corbel.visible = cs > 0.01;
    this.corbel.position.set(cx, 0, cz);
    this.corbel.rotation.y = yaw;
    this.corbel.scale.set(1, cs, 1);

    // the creature: crouched on the corbel, then tearing down the lane
    const g = this.garg;
    const flying = t >= WIND && t < WIND + FLIGHT;
    const q = clamp01((t - WIND) / FLIGHT);
    if (!this.broke) {
      g.visible = true;
      if (t < WIND) {
        const shiver = (t > 0.3 && t < BEAT ? 0.016 * Math.sin(t * 70) * smooth((t - 0.3) / 0.15) : 0);
        g.position.set(cx + shiver, CORBEL_H * rise + 0.36, cz);
        g.rotation.set(-0.05, yaw, 0, 'YXZ');
        g.rotation.y = yaw;
      } else {
        const along = 0.5 + dist * (LEN - 0.5) / LEN;
        const lat = 1.45 * (1 - smooth(q * 4));
        const y0 = CORBEL_H + 0.36;
        const y = 0.62 + (y0 - 0.62) * (1 - smooth(q / 0.3)) + 0.12 * Math.sin(q * Math.PI * 2.2) + 0.28 * smooth((q - 0.82) / 0.18);
        g.position.set(c.from.x + dx * along + px * lat, y, c.from.z + dz * along + pz * lat);
        g.rotation.set(0.32 * (1 - smooth(q / 0.3)) - 0.3 * smooth((q - 0.8) / 0.2), yaw, 0.25 * Math.sin(q * Math.PI * 1.4) * (1 - q), 'YXZ');
      }
      const fold = t < WIND ? 1 : 1 - smooth((t - WIND) / 0.1);
      const flap = flying ? Math.sin((t - WIND) * Math.PI * 2 * 4.4) * 0.7 + 0.15 : 0;
      this.wingR.rotation.set(0, 1.25 * fold, flap + fold * 0.5);
      this.wingL.rotation.set(0, -1.25 * fold, -(flap + fold * 0.5));
      this.tailMesh.rotation.y = Math.sin(t * 9) * (flying ? 0.28 : 0.04);
      // the eyes kindle, flare at the beat, burn on in flight
      const kin = smooth((t - 0.12) / 0.3) * (0.85 + 0.15 * Math.sin(t * 31));
      const e = t < BEAT ? kin : t < WIND ? 1.25 : 1;
      this.glowMat.opacity = Math.min(1, e) * 0.95;
      this.eyes[0].scale.setScalar(0.2 + 0.34 * e);
      this.eyes[1].scale.setScalar(0.2 + 0.34 * e);
      this.eyes[2].scale.setScalar(0.16 + 0.26 * e);
    }

    // before the tear: pebbles rattle off the creature, then everything hangs
    if (t > 0.25 && t < BEAT) {
      this.rattle += dt;
      if (this.rattle > 0.07) {
        this.rattle = 0;
        this.chips.burst(cx, CORBEL_H + 0.5, cz, 1, 0, 0.8, 0, 0.7, 0.06, 0.9);
        this.dust.burst(cx, CORBEL_H + 0.2, cz, 2, 0.5, 0.2, this.dustC, 0.8, 1);
      }
    }

    // the tear
    if (t >= WIND && !this.torn) {
      this.torn = true;
      c.shake = 0.4;
      this.chips.burst(cx, CORBEL_H, cz, 20, 0, 3, 0, 3.2, 0.15, 1.8);
      this.dust.burst(cx, 0.2, cz, 40, 3.0, 2.4, this.dustC, 1.0, 5);
      this.sparks.burst(cx, CORBEL_H + 0.3, cz, 18, 3.2, 3.0, this.gold, 0.8, 4);
    }
    if (t >= WIND) {
      const a = t - WIND, s = clamp01(a / 0.45);
      this.shock(this.ring, cx, cz, 0.4 + 2.0 * easeOut(s), 0.8 * (1 - s) * (1 - s));
    }
    // in flight: gold motes and dust in its wake, a pebble now and then
    if (flying) {
      const p = g.position;
      this.n++;
      this.sparks.burst(p.x - dx * 0.6, p.y, p.z - dz * 0.6, 2, 0.5, 0.3, this.n % 3 ? this.gold : this.hotC, 0.55, 2);
      this.dust.burst(p.x - dx * 0.4, 0.1, p.z - dz * 0.4, 2, 1.4, 0.7, this.dustC, 0.7, 3);
      if (this.n % 2 === 0) this.chips.burst(p.x - dx * 0.8, p.y - 0.2, p.z - dz * 0.8, 1, -dx * 0.5, 0.2, -dz * 0.5, 0.7, 0.07, 0.9);
      c.shake = Math.max(c.shake, 0.07);
      this.endX = p.x; this.endZ = p.z;
    }

    // the end: it breaks into stones that tumble on down the lane and lie still
    if (t >= WIND + FLIGHT && !this.broke) {
      this.broke = true;
      g.visible = false;
      this.glowMat.opacity = 0;
      const x = this.endX, z = this.endZ;
      c.shake = 0.35;
      this.chips.burst(x, 0.7, z, 40, dx * 2.6, 2.4, dz * 2.6, 2.6, 0.34, 2.0);
      this.chips.burst(x, 0.8, z, 26, dx * 1.8, 3, dz * 1.8, 3.2, 0.2, 1.8);
      this.dust.burst(x, 0.3, z, 50, 3.6, 2.2, this.dustC, 1.0, 4);
      this.sparks.burst(x, 0.7, z, 22, 3.4, 3.2, this.gold, 0.7, 5);
      this.sparks.burst(x, 0.7, z, 6, 1.5, 2.2, this.hotC, 0.5, 5);
      this.v.set(x, 0, z);
    }
    if (this.broke) {
      const a = t - WIND - FLIGHT, s = clamp01(a / 0.5);
      this.shock(this.ring2, this.v.x, this.v.z, 0.3 + 1.8 * easeOut(s), 0.7 * (1 - s) * (1 - s));
    }
  }

  after(c: Cast<null>) {
    c.shake *= 0.86;
  }
}

export const gargoyleSwoopModule = spell<null>({
  label: 'gargoyle swoop',
  category: 'targeted',
  targeting: { mode: 'ground', radius: WID / 2 },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: WIND,
    // no move: the lane's clock runs over one second; the creature's flight (a hard start, then a glide) is mapped onto it
    shape: {
      kind: 'lane', length: LEN, width: WID, late: FLIGHT,
      front: (c, even) => {
        const k = Math.min(1, even / c.reach / FLIGHT);
        return c.reach * (0.6 * k + 0.4 * k * (2 - k));
      },
    },
    hit: { damage: 46, knock: 1.6, color: '#f2ae47' },
  },
  look: SwoopLook,
  noScreen: true,
  bloom: { enabled: true, strength: 0.4, radius: 0.45, threshold: 0.85 },
  frame: 9,
  maxDamage: 130,
});
