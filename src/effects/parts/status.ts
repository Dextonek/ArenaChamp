import * as THREE from 'three';
import type { StatusSet } from '../status';

/**
 * Status visuals (stun, root, slow, silence, blind) that follow a figure, for the arena foes, the duel opponent and
 * the player hero alike. Flat unlit colours with a dark outline hull (the toon look of the rest of the project),
 * kept below the bloom threshold so nothing turns into a glowing white ball. A knock-up has no extra visual: the
 * arena lifts the figure. See pipeline/designs/mechanics.md.
 *
 * - stun    three small stars circling above the head
 * - root    a dark ring at the feet with four clamps closing in
 * - slow    pale streaks dragging behind the feet
 * - silence a crossed rune floating over the head, facing the camera
 * - blind   a dark band over the eyes
 *
 * `StatusFx` is one figure's set of visuals; `StatusFxPool` hands them out and takes them back so a pack of
 * enemies reuses a few. Figures are about 2.3 m tall (the capsule caster and the hero models).
 */

const HEAD_STARS = 2.75;
const HEAD_RUNE = 3.1;
const HEAD_EYES = 1.99;
const ROOT_RIM = new THREE.Color(0x8a78a8);

type Kind = 'stun' | 'root' | 'slow' | 'silence' | 'blind';
const KINDS: Kind[] = ['stun', 'root', 'slow', 'silence', 'blind'];

let starGeo: THREE.BufferGeometry | undefined;
/** A five-point star, 0.24 across, lying in the XY plane. */
function star() {
  if (!starGeo) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.05 : 0.12, a = (i * Math.PI) / 5 + Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    starGeo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }).translate(0, 0, -0.025);
  }
  return starGeo;
}

const basic = (color: THREE.ColorRepresentation, opacity = 1, side: THREE.Side = THREE.FrontSide) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side, depthWrite: opacity >= 1 });

/** A mesh plus a slightly larger back-face copy in `outline`: the dark (or light) toon edge round it. */
function outlined(geo: THREE.BufferGeometry, fill: THREE.Material, outline: THREE.Material, grow = 1.3) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(geo, outline);
  hull.scale.setScalar(grow);
  g.add(new THREE.Mesh(geo, fill), hull);
  return g;
}

export class StatusFx {
  readonly group = new THREE.Group();
  private amt: Record<Kind, number> = { stun: 0, root: 0, slow: 0, silence: 0, blind: 0 };
  private clock = Math.random() * 10;
  private tint = '';

  private stars = new THREE.Group();
  private starHolders: THREE.Group[] = [];

  private root = new THREE.Group();
  private rootRing: THREE.Mesh;
  private clamps: THREE.Group[] = [];
  private rimMats: THREE.MeshBasicMaterial[] = [];

  private slow = new THREE.Group();
  private streaks: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private smear: THREE.Mesh;

  private rune = new THREE.Group();
  private runeMats: THREE.MeshBasicMaterial[] = [];

  private band = new THREE.Group();
  private bandMat = basic(0x0b0810, 1, THREE.DoubleSide);
  private wisps = new THREE.Group();
  private wispMeshes: THREE.Mesh[] = [];

  constructor() {
    // Stun: three big stars on a turning circle, each turned to the camera so the five points always show.
    for (let i = 0; i < 3; i++) {
      const holder = new THREE.Group();
      const s = outlined(star(), basic(0xd9a32e), basic(0x24150a, 1, THREE.BackSide), 1.4);
      s.scale.setScalar(2);
      holder.add(s);
      this.stars.add(holder);
      this.starHolders.push(holder);
    }
    const path = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.83, 40).rotateX(-Math.PI / 2), basic(0xd9a32e, 0.25));
    this.stars.add(path);

    // Root: a dark ring with a pale inner line, and four pyramid clamps leaning in.
    this.rootRing = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.07, 6, 40).rotateX(Math.PI / 2), basic(0x1a1222));
    const rimLine = basic(ROOT_RIM, 0.85);
    this.rimMats.push(rimLine);
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.72, 40).rotateX(-Math.PI / 2), rimLine);
    inner.position.y = 0.01;
    this.root.add(this.rootRing, inner);
    const clampGeo = new THREE.ConeGeometry(0.12, 0.75, 4).translate(0, 0.375, 0);
    for (let i = 0; i < 4; i++) {
      const rim = basic(ROOT_RIM, 1, THREE.BackSide);
      this.rimMats.push(rim);
      const pivot = new THREE.Group();
      pivot.rotation.y = -(i * Math.PI) / 2 - Math.PI / 4;
      const c = outlined(clampGeo, basic(0x20162c), rim, 1.28);
      c.position.x = 0.72;
      pivot.add(c);
      this.root.add(pivot);
      this.clamps.push(c);
    }

    // Slow: a soft smear and six long pale strips lying on the ground behind the feet (local -Z; the group turns with the figure).
    this.smear = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5).rotateX(-Math.PI / 2).translate(0, 0, -0.75), basic(0x9cc4ec, 0.22));
    this.slow.add(this.smear);
    const streakGeo = new THREE.PlaneGeometry(0.12, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
    for (let i = 0; i < 6; i++) {
      const mat = basic(0x9cc4ec, 0.6);
      const mesh = new THREE.Mesh(streakGeo, mat);
      mesh.position.x = (i - 2.5) * 0.19;
      this.slow.add(mesh);
      this.streaks.push({ mesh, mat });
    }

    // Silence: a dark disc with a violet ring and a cross, always facing the camera.
    const back = basic(0x120a1a, 0.88);
    const violet = basic(0xb48cf0);
    this.runeMats.push(back, violet);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), back);
    disc.position.z = -0.004;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 28), violet);
    this.rune.add(disc, ring);
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.4), violet);
      bar.rotation.z = (s * Math.PI) / 4;
      bar.position.z = 0.004;
      this.rune.add(bar);
    }

    // Blind: a dark band round the head at eye height, with a thin pale edge top and bottom.
    this.band.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.26, 24, 1, true), this.bandMat));
    const edge = basic(0x5a4870);
    for (const y of [-0.13, 0.13]) {
      const e = new THREE.Mesh(new THREE.TorusGeometry(0.502, 0.016, 4, 28).rotateX(Math.PI / 2), edge);
      e.position.y = y;
      this.band.add(e);
    }
    // Three small dark wisps trailing back from the band (local -Z; turned with the figure).
    const wispGeo = new THREE.ConeGeometry(0.06, 0.5, 5).translate(0, 0.25, 0).rotateX(-Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(wispGeo, basic(0x0b0810, 0.85));
      this.wisps.add(w);
      this.wispMeshes.push(w);
    }
    this.band.add(this.wisps);

    this.group.add(this.stars, this.root, this.slow, this.rune, this.band);
    this.reset();
  }

  /** Back to nothing shown (the pool hands it to the next figure). */
  reset() {
    for (const k of KINDS) this.amt[k] = 0;
    this.stars.visible = this.root.visible = this.slow.visible = this.rune.visible = this.band.visible = false;
  }

  /** True once every visual has faded out. */
  get settled() {
    return KINDS.every((k) => this.amt[k] < 0.02);
  }

  /**
   * Follows a figure standing at `pos`, facing `yaw`. `tint` (a css colour, optional) colours the root clamps' edge:
   * the caster kit's colour, usually the hit's.
   */
  update(dt: number, set: StatusSet, pos: THREE.Vector3, yaw: number, camera: THREE.Camera, tint = '') {
    this.clock += dt;
    const k = 1 - Math.exp(-dt * 14);
    for (const kind of KINDS) this.amt[kind] += ((set.has(kind) ? 1 : 0) - this.amt[kind]) * k;
    this.group.position.set(pos.x, 0, pos.z);
    const lift = set.lift, t = this.clock;
    const a = this.amt;

    if (tint !== this.tint) {
      this.tint = tint;
      const c = tint ? new THREE.Color(tint).multiplyScalar(0.7) : ROOT_RIM;
      for (const m of this.rimMats) m.color.copy(c);
    }

    // Stun.
    this.stars.visible = a.stun > 0.02;
    if (this.stars.visible) {
      this.stars.position.y = HEAD_STARS + lift;
      this.stars.scale.setScalar(0.4 + 0.6 * a.stun);
      this.starHolders.forEach((h, i) => {
        const ang = t * 3.4 + (i / 3) * Math.PI * 2;
        h.position.set(Math.cos(ang) * 0.8, Math.sin(t * 4 + i * 2.1) * 0.06, Math.sin(ang) * 0.8);
        h.quaternion.copy(camera.quaternion);
        h.rotateZ(Math.sin(t * 3 + i) * 0.35);
      });
    }

    // Root: the clamps close in and stand up.
    this.root.visible = a.root > 0.02;
    if (this.root.visible) {
      this.root.position.y = 0.05;
      const rs = 1.2 * (1 + (1 - a.root) * 0.5);
      this.root.scale.set(rs, 1.2, rs);
      this.clamps.forEach((c) => {
        c.rotation.z = THREE.MathUtils.lerp(-0.2, 0.42, a.root);
        c.scale.y = 0.2 + 0.8 * a.root;
      });
    }

    // Slow: streaks slide back from the feet and fade.
    this.slow.visible = a.slow > 0.02;
    if (this.slow.visible) {
      this.slow.position.y = 0.05;
      this.slow.rotation.y = yaw;
      (this.smear.material as THREE.MeshBasicMaterial).opacity = 0.22 * a.slow;
      this.streaks.forEach((s, i) => {
        const p = (t * 0.9 + i * 0.17) % 1;
        s.mesh.position.z = -(0.3 + p * 1.2);
        s.mesh.scale.z = 0.9 + 0.7 * (1 - p);
        s.mat.opacity = 0.65 * a.slow * (1 - p * 0.8);
      });
    }

    // Silence.
    this.rune.visible = a.silence > 0.02;
    if (this.rune.visible) {
      this.rune.position.y = HEAD_RUNE + lift + Math.sin(t * 3) * 0.05;
      this.rune.quaternion.copy(camera.quaternion);
      this.rune.rotateZ(Math.sin(t * 2.2) * 0.12);
      this.rune.scale.setScalar(a.silence * 1.6);
    }

    // Blind.
    this.band.visible = a.blind > 0.02;
    if (this.band.visible) {
      this.band.position.y = HEAD_EYES + lift;
      this.band.scale.set(1 + Math.sin(t * 5) * 0.03, a.blind, 1 + Math.sin(t * 5) * 0.03);
      this.wisps.rotation.y = yaw;
      this.wispMeshes.forEach((w, i) => {
        w.position.set((i - 1) * 0.2, Math.sin(t * 4 + i * 2) * 0.08, -0.45 - ((t * 0.7 + i * 0.33) % 1) * 0.3);
        w.scale.z = 0.7 + 0.5 * Math.sin(t * 3 + i);
      });
    }
  }
}

/** Hands out `StatusFx` and takes them back; new ones are added to `parent` (the arena group) on first use. */
export class StatusFxPool {
  private free: StatusFx[] = [];

  constructor(private parent: THREE.Object3D) {}

  acquire(): StatusFx {
    let fx = this.free.pop();
    if (!fx) {
      fx = new StatusFx();
      this.parent.add(fx.group);
    }
    fx.reset();
    fx.group.visible = true;
    return fx;
  }

  release(fx: StatusFx) {
    fx.group.visible = false;
    this.free.push(fx);
  }
}
