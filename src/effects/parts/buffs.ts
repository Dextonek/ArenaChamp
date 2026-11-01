import * as THREE from 'three';
import { BUFF_COLOR, BUFF_KINDS, type BuffKind, type StatusSet } from '../status';

/**
 * Buff and debuff visuals that follow a figure (src/effects/status.ts `BuffKind`), built for the hero identity layer:
 *
 * - haste      three wind ribbons circling the feet, fast
 * - might      embers rising round the body and a hot band at the waist
 * - armor      six pale hexagon plates orbiting the chest, facing out
 * - vulnerable a cracked red sigil pulsing over the head
 * - weaken     dark violet drops falling from the shoulders and a down chevron over the head
 *
 * Flat colours kept under the bloom threshold (no white-hot balls), faded in and out per kind. `BuffFxPool` hands them
 * out like the status visuals. Figures are about 2.3 m tall.
 */

const glow = (color: THREE.ColorRepresentation, opacity: number, side: THREE.Side = THREE.DoubleSide) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side, depthWrite: false, blending: THREE.AdditiveBlending });
const flat = (color: THREE.ColorRepresentation, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });

function hexagon(r: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(s);
}

/** A jagged crack line from (0,0) outward along `a`, as a thin ribbon. */
function crack(a: number, len: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 4; i++) {
    const r = (i / 4) * len, j = i % 2 ? 0.05 : -0.05;
    pts.push(new THREE.Vector2(Math.cos(a) * r - Math.sin(a) * j, Math.sin(a) * r + Math.cos(a) * j));
  }
  const pos: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], w = 0.025 * (1 - i / pts.length);
    const nx = -(q.y - p.y), ny = q.x - p.x, l = Math.hypot(nx, ny) || 1;
    const ox = (nx / l) * w, oy = (ny / l) * w;
    pos.push(p.x - ox, p.y - oy, 0, p.x + ox, p.y + oy, 0, q.x + ox, q.y + oy, 0, p.x - ox, p.y - oy, 0, q.x + ox, q.y + oy, 0, q.x - ox, q.y - oy, 0);
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
}

export class BuffFx {
  readonly group = new THREE.Group();
  private amt: Record<BuffKind, number> = { haste: 0, might: 0, armor: 0, vulnerable: 0, weaken: 0 };
  private parts: Record<BuffKind, THREE.Group>;
  private mats: Record<BuffKind, THREE.MeshBasicMaterial[]> = { haste: [], might: [], armor: [], vulnerable: [], weaken: [] };
  private clock = Math.random() * 10;
  private embers: THREE.Mesh[] = [];
  private drops: THREE.Mesh[] = [];
  private plates: THREE.Group;
  private ribbons: THREE.Group;
  private sigil: THREE.Group;
  private chevron: THREE.Group;

  constructor() {
    const reg = (k: BuffKind, m: THREE.MeshBasicMaterial) => { m.userData.o = m.opacity; this.mats[k].push(m); return m; };

    // Haste: three wind ribbons (thin open arcs) at the feet.
    const haste = new THREE.Group();
    this.ribbons = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const arc = new THREE.Mesh(new THREE.RingGeometry(0.62 + i * 0.1, 0.68 + i * 0.1, 28, 1, 0, Math.PI * 0.7), reg('haste', glow(BUFF_COLOR.haste, 0.75)));
      arc.rotation.set(-Math.PI / 2, 0, (i * Math.PI * 2) / 3);
      arc.position.y = 0.12 + i * 0.16;
      this.ribbons.add(arc);
    }
    haste.add(this.ribbons);

    // Might: embers rising and a hot band at the waist.
    const might = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 32), reg('might', glow('#ff7a2a', 0.65)));
    band.rotation.x = Math.PI / 2;
    band.position.y = 1.05;
    might.add(band);
    const emberGeo = new THREE.TetrahedronGeometry(0.06, 0);
    for (let i = 0; i < 8; i++) {
      const e = new THREE.Mesh(emberGeo, reg('might', glow(i % 2 ? '#ffb347' : '#ff5a1f', 0.85)));
      e.userData.phase = i / 8;
      e.userData.ang = (i * 2.4) % (Math.PI * 2);
      this.embers.push(e);
      might.add(e);
    }

    // Armor: six hexagon plates orbiting the chest.
    const armor = new THREE.Group();
    this.plates = new THREE.Group();
    const hex = hexagon(0.2), rim = hexagon(0.24);
    for (let i = 0; i < 6; i++) {
      const plate = new THREE.Group();
      plate.add(new THREE.Mesh(rim, reg('armor', flat('#5a7aa8', 0.55))));
      const face = new THREE.Mesh(hex, reg('armor', glow(BUFF_COLOR.armor, 0.32)));
      face.position.z = 0.005;
      plate.add(face);
      const a = (i / 6) * Math.PI * 2;
      plate.position.set(Math.sin(a) * 0.72, (i % 2) * 0.3, Math.cos(a) * 0.72);
      plate.rotation.y = a;
      this.plates.add(plate);
    }
    this.plates.position.y = 1.0;
    armor.add(this.plates);

    // Vulnerable: a cracked sigil over the head.
    const vulnerable = new THREE.Group();
    this.sigil = new THREE.Group();
    this.sigil.add(new THREE.Mesh(new THREE.RingGeometry(0.26, 0.31, 32), reg('vulnerable', glow(BUFF_COLOR.vulnerable, 0.85))));
    for (let i = 0; i < 5; i++) this.sigil.add(new THREE.Mesh(crack((i / 5) * Math.PI * 2 + 0.3, 0.27), reg('vulnerable', glow('#ff3050', 0.9))));
    this.sigil.position.y = 2.95;
    vulnerable.add(this.sigil);

    // Weaken: falling drops and a down chevron.
    const weaken = new THREE.Group();
    const dropGeo = new THREE.SphereGeometry(0.05, 8, 6).scale(1, 1.8, 1);
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(dropGeo, reg('weaken', flat('#4a2a6a', 0.85)));
      d.userData.phase = i / 6;
      d.userData.x = (i % 2 ? 1 : -1) * (0.32 + (i % 3) * 0.05);
      this.drops.push(d);
      weaken.add(d);
    }
    this.chevron = new THREE.Group();
    for (const side of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.06), reg('weaken', glow(BUFF_COLOR.weaken, 0.85)));
      bar.position.x = side * 0.09;
      bar.rotation.z = side * -0.6;
      this.chevron.add(bar);
    }
    this.chevron.position.y = 3.4;
    weaken.add(this.chevron);

    this.parts = { haste, might, armor, vulnerable, weaken };
    for (const k of BUFF_KINDS) this.group.add(this.parts[k]);
  }

  /** Every running buff has faded out (the pool can take it back). */
  get settled() {
    return BUFF_KINDS.every((k) => this.amt[k] < 0.01);
  }

  update(dt: number, set: StatusSet, pos: THREE.Vector3, camera: THREE.Camera) {
    this.clock += dt;
    const t = this.clock;
    this.group.position.set(pos.x, Math.max(0, pos.y), pos.z);
    for (const k of BUFF_KINDS) {
      const on = set.buff(k) > 0 ? 1 : 0;
      this.amt[k] += (on - this.amt[k]) * (1 - Math.exp(-dt * 10));
      const a = this.amt[k];
      this.parts[k].visible = a > 0.01;
      // A soft pulse in the last second of a buff tells it is running out.
      const ending = set.buffLeft(k) < 1 && on ? 0.55 + 0.45 * Math.abs(Math.sin(t * 9)) : 1;
      for (const m of this.mats[k]) m.opacity = m.userData.o * a * ending;
    }
    if (this.parts.haste.visible) this.ribbons.rotation.y = -t * 7;
    if (this.parts.might.visible) {
      for (const e of this.embers) {
        const p = (e.userData.phase + t * 0.7) % 1;
        const ang = e.userData.ang + t * 1.5;
        e.position.set(Math.cos(ang) * 0.45, 0.3 + p * 2.0, Math.sin(ang) * 0.45);
        e.rotation.set(t * 4, t * 3, 0);
        e.scale.setScalar(1 - p * 0.7);
      }
    }
    if (this.parts.armor.visible) this.plates.rotation.y = t * 0.8;
    const face = (g: THREE.Object3D) => g.quaternion.copy(camera.quaternion);
    if (this.parts.vulnerable.visible) {
      face(this.sigil);
      this.sigil.scale.setScalar(1 + 0.12 * Math.sin(t * 7));
      this.sigil.rotation.z = t * 0.6;
    }
    if (this.parts.weaken.visible) {
      face(this.chevron);
      this.chevron.position.y = 3.4 - 0.08 * ((t * 1.6) % 1);
      for (const d of this.drops) {
        const p = (d.userData.phase + t * 0.9) % 1;
        d.position.set(d.userData.x, 1.7 - p * 1.6, 0.05);
        d.scale.setScalar(1 - p * 0.5);
      }
    }
  }
}

/** Hands out `BuffFx` and takes them back (hidden, kept for reuse). */
export class BuffFxPool {
  private free: BuffFx[] = [];

  constructor(private parent: THREE.Object3D) {}

  acquire(): BuffFx {
    const fx = this.free.pop() ?? new BuffFx();
    fx.group.visible = true;
    this.parent.add(fx.group);
    return fx;
  }

  release(fx: BuffFx) {
    this.parent.remove(fx.group);
    this.free.push(fx);
  }
}
