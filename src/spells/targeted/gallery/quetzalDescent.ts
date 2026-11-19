import * as THREE from 'three';
import { ShockRefraction, StarBurst } from '../../../effects/parts';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { lens } from '../../../heroes/sheath/parts';
import { Chips, clamp01, easeOut, glowTexture, hash, placeOn, smooth } from './g2Parts';

/**
 * Quetzal descent (gallery #2, Aztec). He leaps up to 9 m to a spot and slams down there: a circle of 2.4 m at the spot, hit at
 * the landing, 0.85 s after the cast (0.25 + 2.4 / 4 = 0.85 s of warning, shown all of it); his move is 0.85 s long
 * (`ctx.moveCaster`, at play). Everyone inside the circle (live position) takes 70 once, at the landing. A tool spell: the numbers
 * are plausible, not balanced. No full-screen effect: a small shake only.
 *
 * The look. Dark jade-black, one accent (jade to turquoise), cream feathers as the foil, gold only in small things (eyes, fret
 * edges, the star's core). 0-0.7: a feathered serpent rises out of the floor where he stood and arcs over to the spot above him,
 * body in undulating scales with two rows of feathers streaming off it, a crest of plumes and open jaws; the landing ring is
 * drawn on the floor (a dark band with two fine lines closing in). The last 0.15 s is the dead beat: the serpent hangs nearly
 * still, head down just above the spot, the feather flow stops. At 0.85 the head slams the floor: a gold star, a flash of jade
 * light, a ring of force, a shake. The serpent's body coils out onto the rim while its feathers are flung out along the floor
 * and settle, and a ring of stepped-fret tiles (jade and turquoise, alternating, with fine gold lines) pops into place round the
 * rim, tile after tile. The head dissolves into feathers; the ring glows, holds and fades by 3.0 s.
 */

const RANGE = 9;
const R = 2.4;
const T = 0.85; // the landing, and his move's length
const DURATION = 3.0;
const SEGS = 30;
const GAP = 0.026; // path length one segment trails the one before it
const PEAK = 3.6;
const FRET = 18; // stepped-fret tiles in the ring
const RING = R - 0.38;

const COL = {
  dark: '#0b2624',
  jade: '#14806e',
  turq: '#2cd3c0',
  cream: '#d9cfae',
  gold: '#e6b23e',
};
export const QUETZAL_CSS = COL.turq;

/** Where he lands: the aim, but no farther than the range from where he stood. */
function landing(c: Cast<null>) {
  const p = c.ctx!.point, f = c.from;
  let dx = p.x - f.x, dz = p.z - f.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-3) { dx = c.dir.x; dz = c.dir.z; } else { dx /= d; dz /= d; }
  const len = Math.min(RANGE, Math.max(3, d));
  return { x: f.x + dx * len, z: f.z + dz * len };
}

/** A pointed feather lying along +z (0 to 1 long, 1 wide in x), in the xz plane. */
function featherGeometry() {
  return lens().rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0, 0.5);
}

/** The stepped-fret tile: a four-step stair, unit square in xz (the next tile is this turned half way round). */
function fretGeometry() {
  const s = new THREE.Shape();
  const pts: [number, number][] = [[-0.5, -0.5], [0.5, -0.5], [0.5, -0.25], [0.25, -0.25], [0.25, 0], [0, 0], [0, 0.25], [-0.25, 0.25], [-0.25, 0.5], [-0.5, 0.5]];
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

class DescentLook implements Look<null> {
  private glow = glowTexture();
  private body: THREE.InstancedMesh;
  private wingA: THREE.InstancedMesh;
  private wingB: THREE.InstancedMesh;
  private tiles: THREE.InstancedMesh;
  private head = new THREE.Group();
  private band: THREE.Mesh;
  private lineA: THREE.Mesh;
  private lineB: THREE.Mesh;
  private flash: THREE.Mesh;
  private scorch: THREE.Mesh;
  private wave: THREE.Mesh;
  private shock = new ShockRefraction({ facing: 'ground' });
  private star = new StarBurst({ points: 8, inner: 0.25, color: COL.turq, core: '#fff1c0' });
  private feathers: Chips;
  private dust: Chips;
  private tileMat: THREE.MeshBasicMaterial;
  private spot = new THREE.Vector3();
  private start = new THREE.Vector3();
  private dx = 0;
  private dz = 0;
  private landed = false;
  private scattered = false;
  private shed = 0;
  private p = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private side = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private obj = new THREE.Object3D();
  private rot = new THREE.Matrix4();
  private tmpRight = new THREE.Vector3();
  private tmpUp = new THREE.Vector3();
  private col = [new THREE.Color(COL.jade), new THREE.Color(COL.turq), new THREE.Color(COL.cream), new THREE.Color(COL.dark)];

  constructor(group: THREE.Group) {
    const basic = (color: string, add = false, opacity = 1) => new THREE.MeshBasicMaterial({
      color, transparent: opacity < 1 || add, opacity, depthWrite: false, side: THREE.DoubleSide,
      blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const flatMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, order: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = order;
      m.frustumCulled = false;
      m.visible = false;
      return m;
    };
    // the serpent's scales, and two rows of feathers
    this.body = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), SEGS);
    this.body.frustumCulled = false;
    const tint = new THREE.Color();
    for (let j = 0; j < SEGS; j++) {
      this.body.setColorAt(j, tint.copy(j % 5 === 2 ? this.col[1] : j % 2 ? this.col[0] : this.col[3]));
    }
    const fg = featherGeometry();
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.wingA = new THREE.InstancedMesh(fg, wingMat, SEGS * 2);
    this.wingB = new THREE.InstancedMesh(fg, new THREE.MeshBasicMaterial({ color: COL.cream, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), SEGS * 2);
    this.wingA.frustumCulled = this.wingB.frustumCulled = false;
    for (let i = 0; i < SEGS * 2; i++) this.wingA.setColorAt(i, tint.copy(i % 4 < 2 ? this.col[1] : this.col[0]));
    // the head: skull, snout, jaw, fangs, eyes, a crest of plumes
    const jade = new THREE.MeshLambertMaterial({ color: COL.jade, flatShading: true });
    const dark = new THREE.MeshLambertMaterial({ color: COL.dark, flatShading: true });
    const skull = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), jade);
    skull.scale.set(1, 0.8, 1.3);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.85, 4).rotateX(Math.PI / 2), jade);
    snout.position.set(0, 0.0, 0.62);
    snout.rotation.z = Math.PI / 4;
    const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 4).rotateX(Math.PI / 2), dark);
    jaw.position.set(0, -0.2, 0.5);
    jaw.rotation.set(0.42, 0, Math.PI / 4);
    const cream = basic(COL.cream);
    const gold = basic(COL.gold);
    const fangGeo = new THREE.ConeGeometry(0.055, 0.32, 5);
    for (const sx of [-1, 1]) {
      const fang = new THREE.Mesh(fangGeo, cream);
      fang.position.set(sx * 0.13, -0.17, 0.85);
      fang.rotation.x = Math.PI;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), gold);
      eye.position.set(sx * 0.21, 0.15, 0.22);
      this.head.add(fang, eye);
    }
    for (let i = 0; i < 5; i++) {
      const plume = new THREE.Mesh(fg, i === 2 ? gold : basic(i % 2 ? COL.turq : COL.jade));
      plume.scale.set(0.3, 1, 1.05 + 0.25 * (i === 2 ? 1 : 0));
      plume.rotation.order = 'YXZ';
      plume.rotation.set(-0.12 - 0.1 * (i === 2 ? 1 : 0), Math.PI + (i - 2) * 0.4, 0);
      plume.position.set(0, 0.22, -0.15);
      this.head.add(plume);
    }
    this.head.add(skull, snout, jaw);
    this.head.visible = false;
    // the landing ring
    this.band = flatMesh(new THREE.RingGeometry(RING - 0.34, RING + 0.34, 72).rotateX(-Math.PI / 2), basic(COL.dark, false, 0.0), 2);
    this.lineA = flatMesh(new THREE.RingGeometry(RING - 0.37, RING - 0.33, 72).rotateX(-Math.PI / 2), basic(COL.turq, true, 0), 3);
    this.lineB = flatMesh(new THREE.RingGeometry(RING + 0.33, RING + 0.37, 72).rotateX(-Math.PI / 2), basic(COL.gold, true, 0), 3);
    // the fret tiles
    this.tileMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    this.tiles = new THREE.InstancedMesh(fretGeometry(), this.tileMat, FRET);
    this.tiles.frustumCulled = false;
    this.tiles.renderOrder = 4;
    for (let i = 0; i < FRET; i++) this.tiles.setColorAt(i, tint.copy(i % 2 ? this.col[1] : this.col[0]));
    this.flash = flatMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.glow, color: COL.turq, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 4);
    this.scorch = flatMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.glow, color: COL.dark, transparent: true, opacity: 0, depthWrite: false }), 1);
    this.wave = flatMesh(new THREE.RingGeometry(0.86, 1, 80).rotateX(-Math.PI / 2), basic(COL.turq, true, 0), 4);
    this.feathers = new Chips(160, fg.clone().translate(0, 0, -0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 0.04);
    this.dust = new Chips(90, new THREE.TetrahedronGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), 0.04);
    group.add(
      this.scorch, this.band, this.lineA, this.lineB, this.tiles, this.flash, this.wave, this.body, this.wingA, this.wingB, this.head,
      this.feathers.mesh, this.dust.mesh, this.star.mesh, this.shock.mesh,
    );
    this.wingA.renderOrder = 5;
    this.wingB.renderOrder = 6;
  }

  reset() {
    this.landed = this.scattered = false;
    this.shed = 0;
    this.feathers.clear();
    this.dust.clear();
    this.head.visible = false;
    for (const m of [this.band, this.lineA, this.lineB, this.flash, this.scorch, this.wave]) m.visible = false;
    this.hideBody();
    this.hideTiles();
    this.star.set(this.p.set(0, 0, 0), 1e-3, 0);
    this.shock.set(this.p.set(0, 0, 0), 1e-3, 0);
  }

  private hideBody() {
    this.body.visible = this.wingA.visible = this.wingB.visible = false;
  }

  private hideTiles() {
    this.tiles.visible = false;
  }

  cast(c: Cast<null>) {
    const l = landing(c);
    this.spot.set(l.x, 0, l.z);
    this.start.copy(c.from);
    this.dx = this.spot.x - this.start.x;
    this.dz = this.spot.z - this.start.z;
    for (const m of [this.band, this.lineA, this.lineB, this.flash, this.scorch, this.wave]) m.position.set(l.x, 0.04, l.z);
    this.band.position.y = 0.035;
    this.tiles.position.set(l.x, 0.05, l.z);
    this.tiles.visible = false;
  }

  /** The take-off: feathers thrown up round where he stood. */
  played() {
    const s = this.start;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + hash(i) * 0.4, v = 1.5 + 2.2 * hash(i + 20);
      this.feathers.put(s.x, 0.2, s.z, Math.sin(a) * v, 2.2 + 2.4 * hash(i + 40), Math.cos(a) * v, this.col[i % 3], 0.8, 1.1, i + 3, 6);
    }
    for (let i = 0; i < 12; i++) {
      const a = hash(i + 60) * 6.283, v = 1 + 2 * hash(i + 61);
      this.dust.put(s.x, 0.1, s.z, Math.sin(a) * v, 1 + 1.5 * hash(i + 62), Math.cos(a) * v, this.col[3], 1, 0.8, i + 70, 5);
    }
  }

  tick(dt: number) {
    this.feathers.update(dt);
    this.dust.update(dt);
  }

  idle(dt: number) {
    this.feathers.update(dt);
    this.dust.update(dt);
  }

  private mat(m: THREE.Mesh) {
    return m.material as THREE.MeshBasicMaterial;
  }

  /** The serpent's arc: from where he stood to the spot, `u` 0..1 along it, bulging up by PEAK. */
  private arc(out: THREE.Vector3, u: number) {
    return out.set(this.start.x + this.dx * u, 4 * PEAK * u * (1 - u) + 0.05, this.start.z + this.dz * u);
  }

  private aim(out: THREE.Vector3, u: number) {
    return out.set(this.dx, 4 * PEAK * (1 - 2 * u), this.dz).normalize();
  }

  frame(c: Cast<null>, t: number) {
    const a = t - T;
    const hush = smooth((t - (T - 0.15)) / 0.05);
    // ---- the ring on the floor: a dark band and two fine lines, closing in ----
    const draw = smooth(t / 0.55);
    this.band.visible = this.lineA.visible = this.lineB.visible = a < 1.9;
    const close = 1.25 - 0.25 * easeOut(t / 0.7);
    const fadeAll = 1 - smooth((a - 2.0) / 0.9);
    const ringScale = a < 0 ? close : 1;
    for (const m of [this.band, this.lineA, this.lineB]) m.scale.set(ringScale, 1, ringScale);
    this.mat(this.band).opacity = (a < 0 ? 0.6 * draw : 0.75) * fadeAll;
    this.mat(this.lineA).opacity = (a < 0 ? 0.8 * draw : 0.9) * (1 - 0.5 * smooth(a / 0.6)) * fadeAll;
    this.mat(this.lineB).opacity = (a < 0 ? 0.55 * draw : 1) * fadeAll;
    this.scorch.visible = a >= 0;
    this.scorch.scale.setScalar(R * 1.25);
    this.mat(this.scorch).opacity = a >= 0 ? 0.55 * (1 - smooth((a - 1.2) / 1.5)) : 0;

    // ---- the serpent ----
    const uHead = a < 0 ? 0.93 * easeOut(t / (T - 0.15)) ** 0.9 * (1 - 0.02 * hush) : 1 + a * 3;
    const flight = a < 0 || a < 1.3;
    this.body.visible = this.wingA.visible = this.wingB.visible = flight && a < 1.0;
    this.head.visible = a < 0.55;
    if (this.body.visible || this.head.visible) {
      const settle = a < 0 ? 0 : Math.min(1, a * 3);
      for (let j = -1; j < SEGS; j++) {
        const uj = uHead - (j + 1) * GAP;
        const uc = clamp01(uj);
        const vis = smooth((uj + 0.04) / 0.04);
        this.arc(this.p, uc);
        this.aim(this.fwd, uc);
        this.side.set(this.fwd.z, 0, -this.fwd.x).normalize();
        const amp = 0.3 * (0.25 + 0.75 * Math.min(1, uc * 5)) * (1 - 0.7 * hush) * (1 - settle);
        this.p.addScaledVector(this.side, amp * Math.sin(j * 0.75 - t * 9));
        this.p.y += amp * 0.8 * Math.sin(j * 0.6 - t * 7 + 1);
        // after the landing each segment, when its turn comes, runs out to the rim and coils there
        let sc = vis;
        if (a >= 0) {
          const w = easeOut((a - Math.max(0, (j + 1) * GAP) / 3) / 0.4);
          const th = ((j + 1) / (SEGS + 1)) * Math.PI * 2 * 1.0;
          this.p.x += (this.spot.x + Math.sin(th) * RING - this.p.x) * w;
          this.p.z += (this.spot.z + Math.cos(th) * RING - this.p.z) * w;
          this.p.y += (0.3 - this.p.y) * w;
          this.fwd.lerp(this.dir.set(Math.cos(th), 0, -Math.sin(th)), w).normalize();
          sc *= 1 - smooth((a - 0.45 - (j + 1) * 0.004) / 0.3);
        }
        if (j < 0) {
          // the head: nose down, jaws open
          this.head.position.copy(this.p);
          this.tmpRight.crossVectors(this.fwd.y > 0.98 || this.fwd.y < -0.98 ? this.dir.set(1, 0, 0) : this.tmpUp.set(0, 1, 0), this.fwd).normalize();
          this.tmpUp.crossVectors(this.fwd, this.tmpRight);
          this.rot.makeBasis(this.tmpRight, this.tmpUp, this.fwd);
          this.head.quaternion.setFromRotationMatrix(this.rot);
          this.head.scale.setScalar(Math.max(1e-3, 1.55 * (1 + 0.1 * hush) * (a < 0.25 ? 1 : 1 - smooth((a - 0.25) / 0.3)) * vis));
          continue;
        }
        const r = (0.48 * (1 - 0.66 * (j / SEGS)) + 0.1) * (1 + 0.3 * Math.sin(j * 1.3));
        placeOn(this.body, j, this.p, this.fwd, 0, r * 2 * sc, r * 2 * sc, r * 3.0 * sc);
        // feathers stream back and out from each scale, rising and falling with the body's wave
        for (let s = 0; s < 2; s++) {
          const sg = s ? 1 : -1;
          this.dir.set(-this.fwd.x * 1.25 + this.side.x * sg * 0.5, -this.fwd.y * 1.25 + 0.2 + 0.16 * Math.sin(t * 8 + j * 0.9 + s * 2), -this.fwd.z * 1.25 + this.side.z * sg * 0.5).normalize();
          const len = (j % 2 ? 0.55 : 1) * (0.8 + 0.5 * (1 - j / SEGS)) * sc * (1 - 0.35 * hush);
          const wide = (0.2 + 0.1 * (1 - j / SEGS)) * sc;
          placeOn(this.wingA, j * 2 + s, this.p, this.dir, 0, wide, wide, len);
          this.tmpUp.copy(this.p).addScaledVector(this.dir, len * 0.62);
          placeOn(this.wingB, j * 2 + s, this.tmpUp, this.dir, 0, wide * 0.55, wide, len * 0.4);
        }
      }
      this.body.instanceMatrix.needsUpdate = true;
      this.wingA.instanceMatrix.needsUpdate = this.wingB.instanceMatrix.needsUpdate = true;
      if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
      if (this.wingA.instanceColor) this.wingA.instanceColor.needsUpdate = true;
      // feathers shake off the serpent as it flies; none at the dead beat
      this.shed++;
      if (a < 0 && hush < 0.5 && t > 0.1 && this.shed % 3 !== 1) {
        const s = this.shed * 1.61;
        this.arc(this.p, clamp01(uHead - GAP * (3 + 25 * hash(s))));
        this.feathers.put(this.p.x, this.p.y, this.p.z, (hash(s + 1) - 0.5) * 1.2, -0.3 + hash(s + 2), (hash(s + 3) - 0.5) * 1.2, this.col[(this.shed % 3)], 0.55, 1.0, s, 2.5);
      }
    }

    // ---- the landing ----
    if (a >= 0 && !this.landed) {
      this.landed = true;
      c.shake = 0.5;
      const sp = this.spot;
      // the serpent's feathers are flung out along the floor and settle
      for (let i = 0; i < 34; i++) {
        const an = (i / 34) * Math.PI * 2 + hash(i) * 0.3, v = 2.4 + 1.4 * hash(i + 9);
        this.feathers.put(sp.x, 0.15, sp.z, Math.sin(an) * v, 0.8 + 1.4 * hash(i + 3), Math.cos(an) * v, this.col[i % 3], 0.7, 2.1, i + 90, 8, true);
      }
      for (let i = 0; i < 30; i++) {
        const an = hash(i + 120) * 6.283, v = 1 + 4 * hash(i + 121);
        this.dust.put(sp.x, 0.2, sp.z, Math.sin(an) * v, 2 + 4 * hash(i + 122), Math.cos(an) * v, i % 3 === 0 ? this.col[2] : this.col[3], 1, 1.1, i + 130, 9);
      }
    }
    if (a >= 0 && !this.scattered && a > 0.5) {
      this.scattered = true;
      for (let i = 0; i < 26; i++) {
        const th = (i / 26) * Math.PI * 2, rr = RING * (0.9 + 0.2 * hash(i));
        this.feathers.put(this.spot.x + Math.sin(th) * rr, 0.5, this.spot.z + Math.cos(th) * rr, (hash(i + 5) - 0.5) * 1.4, 1.6 + 1.5 * hash(i + 6), (hash(i + 7) - 0.5) * 1.4, this.col[i % 3], 0.8, 1.8, i + 170, 2.2);
      }
    }
    if (a >= 0) {
      // the flash of jade light, the force ring, the star
      const q = clamp01(a / 0.4), e = easeOut(q);
      this.flash.visible = a < 0.45;
      this.flash.scale.setScalar(R * (0.7 + 0.7 * e));
      this.mat(this.flash).opacity = 0.85 * (1 - q) * (1 - q);
      this.wave.visible = a < 0.5;
      this.wave.scale.setScalar(0.4 + (R - 0.4) * e);
      this.mat(this.wave).opacity = 0.85 * (1 - q);
      this.shock.set(this.p.set(this.spot.x, 0, this.spot.z), 0.4 + R * 1.05 * e, 0.045 * (1 - q) * (1 - q));
      const st = StarBurst.pop(a, 0.04, 0.12);
      this.star.set(this.p.set(this.spot.x, 0.9, this.spot.z), 2 * st.scale + 1e-3, st.opacity, 0.2);
      // the ring of stepped-fret tiles, tile after tile
      this.tiles.visible = true;
      const glowK = 1 + 0.5 * Math.exp(-((a - 1.0) * (a - 1.0)) / 0.04);
      for (let i = 0; i < FRET; i++) {
        const th = (i / FRET) * Math.PI * 2;
        const at = 0.04 + i * 0.016;
        const k = clamp01((a - at) / 0.1);
        const pop = k === 0 ? 1e-3 : 1 + 0.45 * (1 - k) * (1 - k);
        this.obj.position.set(Math.sin(th) * RING, 0, Math.cos(th) * RING);
        this.obj.rotation.set(0, th + (i % 2) * Math.PI, 0);
        const wide = ((Math.PI * 2 * RING) / FRET) * 0.94, deep = 0.62;
        const hold = 1 - smooth((a - 2.1) / 0.8);
        this.obj.scale.set(Math.max(1e-3, wide * pop * (0.2 + 0.8 * hold)), 1, Math.max(1e-3, deep * pop * (0.2 + 0.8 * hold)));
        this.obj.updateMatrix();
        this.tiles.setMatrixAt(i, this.obj.matrix);
      }
      this.tiles.instanceMatrix.needsUpdate = true;
      this.tileMat.opacity = 1;
      this.tileMat.color.setScalar(glowK);
    }
  }

  after(c: Cast<null>) {
    c.shake *= 0.86;
  }
}

export const quetzalDescentModule = spell<null>({
  label: 'quetzal descent',
  category: 'targeted',
  targeting: { mode: 'ground', radius: R },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: 0,
    delay: T,
    shape: { kind: 'circle', radius: R, at: (c) => [landing(c)] },
    hit: { damage: 70, knock: 6, color: COL.turq },
    move: { at: 'play', to: (c) => landing(c), seconds: T },
  },
  noScreen: true,
  look: DescentLook,
  bloom: { enabled: true, strength: 0.4, radius: 0.45, threshold: 0.86 },
  frame: 7,
  maxDamage: 160,
});
