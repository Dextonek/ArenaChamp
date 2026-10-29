import * as THREE from 'three';
import { Enemy } from '../common';
import type { SummonKind } from '../summon';

/**
 * Summoned units (`effects/summon.ts`) as small low-poly figures, about 0.9 m tall: toon flat-shaded bodies in the
 * summoner's colour with a dark back-face outline, a simple walk bob, a melee lunge and a ranged recoil. A turret is
 * a short post with a glowing eye. A small HP bar floats over each unit. Flat unlit colour for the eyes (kept under
 * the bloom threshold), no additive blending, so nothing turns into a glowing blob (docs/ART_BIBLE.md).
 *
 * - `MinionFx`   one unit's figure. It is an `Enemy` (the arena's hit flash and `ctx.hit` target type), without the robe:
 *                `material` is the body and `trim` the second colour, so the hit flash tints both.
 * - `MinionPool` hands figures out and takes them back, so a summon does not build meshes.
 *
 * Pluggable look: `kind` only decides how a unit behaves; how it looks comes from a `MinionLook` function
 * (`SummonOptions.look`), which builds a `MinionRig` from the figure's `MinionPalette`. Wave 3-5 heroes pass their own
 * (bone skeletons, hive insects, a clockwork turret); `defaultLook` is the generic one. The rig's `animate` is called
 * every frame with a `MinionPose`.
 */
export interface MinionPalette {
  /** The body material (the arena's hit flash drives it). */
  body: THREE.MeshStandardMaterial;
  /** The second colour: weapon, feet, base. */
  trim: THREE.MeshStandardMaterial;
  /** Unlit eye / gem colour, a pale tint of the summoner's colour. */
  eye: THREE.MeshBasicMaterial;
  /** Dark outline colour for back-face hulls. */
  outline: THREE.MeshBasicMaterial;
}

export interface MinionPose {
  /** Seconds since the unit appeared. */
  time: number;
  /** 0 standing, 1 walking at full speed. */
  walk: number;
  /** A melee swing, 0 (wind-up starts) to 1 (landed), or -1 when not swinging. */
  swing: number;
  /** A shot just left: 1, falling to 0 over about a quarter second. */
  shot: number;
}

export interface MinionRig {
  /** The meshes; about 0.9 m tall, facing +Z, feet at y = 0. The figure scales it for the pop-in. */
  root: THREE.Object3D;
  animate(dt: number, pose: MinionPose): void;
  /** Frees geometry the look made for itself (not needed for shared geometry). */
  dispose?(): void;
}

export type MinionLook = (kind: SummonKind, palette: MinionPalette) => MinionRig;

const POP_TIME = 0.28;
const PUFF_TIME = 0.5;
const PUFF_PIECES = 8;

const shared: Record<string, THREE.BufferGeometry> = {};
const geo = (key: string, make: () => THREE.BufferGeometry) => (shared[key] ??= make());

/** The generic look: a little hooded body with a head, feet, arms and a weapon; a turret is a post with an eye. */
export const defaultLook: MinionLook = (kind, p) => (kind === 'turret' ? turretRig(p) : walkerRig(kind, p));

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

/** A back-face copy a little bigger than `src`: the dark toon outline. */
function hull(src: THREE.Mesh, p: MinionPalette, k = 1.16) {
  const o = new THREE.Mesh(src.geometry, p.outline);
  o.position.copy(src.position);
  o.scale.setScalar(k);
  return o;
}

function walkerRig(kind: SummonKind, p: MinionPalette): MinionRig {
  const root = new THREE.Group();
  const body = mesh(geo('mBody', () => new THREE.CylinderGeometry(0.19, 0.29, 0.42, 6)), p.body, 0, 0.43, 0);
  const head = mesh(geo('mHead', () => new THREE.IcosahedronGeometry(0.16, 0)), p.body, 0, 0.8, 0);
  root.add(hull(body, p), hull(head, p, 1.22), body, head);
  for (const s of [-1, 1]) {
    const eye = mesh(geo('mEye', () => new THREE.BoxGeometry(0.05, 0.03, 0.03)), p.eye, s * 0.065, 0.82, 0.14);
    eye.castShadow = false;
    root.add(eye);
  }
  const legGeo = geo('mLeg', () => new THREE.BoxGeometry(0.11, 0.22, 0.13).translate(0, -0.11, 0));
  const armGeo = geo('mArm', () => new THREE.BoxGeometry(0.08, 0.27, 0.08).translate(0, -0.135, 0));
  const legs = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * 0.1, 0.22, 0);
    g.add(mesh(legGeo, p.trim));
    root.add(g);
    return g;
  });
  const arms = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * 0.27, 0.6, 0);
    g.add(mesh(armGeo, p.body));
    root.add(g);
    return g;
  });
  // Weapon in the right hand: a short blade (melee) or a staff with a gem (ranged).
  let gem: THREE.Mesh | null = null;
  if (kind === 'melee') {
    const blade = mesh(geo('mBlade', () => new THREE.BoxGeometry(0.045, 0.05, 0.42)), p.trim, 0, -0.27, 0.22);
    arms[1].add(blade, mesh(geo('mGuard', () => new THREE.BoxGeometry(0.16, 0.04, 0.04)), p.trim, 0, -0.27, 0.03));
  } else {
    arms[1].add(mesh(geo('mStaff', () => new THREE.CylinderGeometry(0.014, 0.018, 0.78, 5)), p.trim, 0, -0.13, 0.08));
    gem = mesh(geo('mGem', () => new THREE.OctahedronGeometry(0.07, 0)), p.eye, 0, 0.27, 0.08);
    gem.castShadow = false;
    arms[1].add(gem);
  }
  let phase = Math.random() * 6;
  return {
    root,
    animate(dt, pose) {
      const w = pose.walk;
      phase += dt * (5 + 9 * w);
      const step = Math.sin(phase);
      root.position.y = Math.abs(step) * 0.05 * w + Math.sin(pose.time * 3 + phase * 0.1) * 0.012;
      legs[0].rotation.x = step * 0.8 * w;
      legs[1].rotation.x = -step * 0.8 * w;
      arms[0].rotation.x = -step * 0.7 * w;
      let r = step * 0.7 * w;
      let lean = 0.06 * w, push = 0;
      if (pose.swing >= 0) {
        // Wind up (arm up and back), then strike forward and lean into it.
        const s = pose.swing;
        r = s < 0.6 ? 2.0 * (s / 0.6) : 2.0 - ((s - 0.6) / 0.4) * 3.4;
        lean = s < 0.6 ? -0.18 * (s / 0.6) : -0.18 + ((s - 0.6) / 0.4) * 0.6;
        push = s < 0.6 ? 0 : ((s - 0.6) / 0.4) * 0.3;
      } else if (pose.shot > 0) {
        r = -1.35 * pose.shot;
        lean = -0.08 * pose.shot;
      }
      arms[1].rotation.x = r;
      root.rotation.x = lean;
      root.position.z = push;
      if (gem) gem.scale.setScalar(1 + pose.shot * 0.6 + Math.sin(pose.time * 5) * 0.08);
    },
  };
}

function turretRig(p: MinionPalette): MinionRig {
  const root = new THREE.Group();
  const base = mesh(geo('tBase', () => new THREE.CylinderGeometry(0.3, 0.37, 0.14, 6)), p.trim, 0, 0.07, 0);
  const post = mesh(geo('tPost', () => new THREE.CylinderGeometry(0.08, 0.13, 0.42, 6)), p.body, 0, 0.35, 0);
  const head = new THREE.Group();
  head.position.y = 0.67;
  const box = mesh(geo('tHead', () => new THREE.BoxGeometry(0.32, 0.24, 0.32)), p.body);
  const eye = mesh(geo('tEye', () => new THREE.SphereGeometry(0.085, 10, 8)), p.eye, 0, 0.01, 0.17);
  eye.castShadow = false;
  const barrel = mesh(geo('tBarrel', () => new THREE.BoxGeometry(0.07, 0.07, 0.3)), p.trim, 0, -0.07, 0.24);
  head.add(hull(box, p, 1.14), box, eye, barrel);
  root.add(hull(post, p, 1.2), hull(base, p, 1.12), base, post, head);
  return {
    root,
    animate(_dt, pose) {
      eye.scale.setScalar(1 + Math.sin(pose.time * 4) * 0.1 + pose.shot * 0.5);
      barrel.position.z = 0.24 - pose.shot * 0.09;
      head.rotation.z = Math.sin(pose.time * 1.3) * 0.04;
    },
  };
}

let ringGeo: THREE.RingGeometry | undefined;
let chunkGeo: THREE.BufferGeometry | undefined;
let barGeo: THREE.PlaneGeometry | undefined;

export class MinionFx extends Enemy {
  /** The HP bar. It lives in the arena's group, not the figure's (it faces the camera, not the figure). */
  readonly bar = new THREE.Group();
  readonly palette: MinionPalette;
  private holder = new THREE.Group();
  private rig: MinionRig | null = null;
  private barFill: THREE.Mesh;
  private barBack: THREE.Mesh;
  private ring: THREE.Mesh;
  private ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, side: THREE.DoubleSide });
  private chunks: { mesh: THREE.Mesh; vel: THREE.Vector3 }[] = [];
  private chunkMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false });
  private age = 0;
  private dying = -1;
  private barY = 1.25;

  constructor() {
    super({ bare: true });
    this.material.flatShading = true;
    this.material.roughness = 0.8;
    this.trim.roughness = 0.7;
    this.trim.metalness = 0;
    this.palette = {
      body: this.material,
      trim: this.trim,
      eye: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      outline: new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide }),
    };
    ringGeo ??= new THREE.RingGeometry(0.7, 1, 28).rotateX(-Math.PI / 2);
    chunkGeo ??= new THREE.OctahedronGeometry(0.1, 0);
    barGeo ??= new THREE.PlaneGeometry(1, 1);
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.position.y = 0.05;
    this.ring.visible = false;
    for (let i = 0; i < PUFF_PIECES; i++) {
      const m = new THREE.Mesh(chunkGeo, this.chunkMat);
      m.visible = false;
      this.chunks.push({ mesh: m, vel: new THREE.Vector3() });
      this.group.add(m);
    }
    this.group.add(this.holder, this.ring);
    this.barBack = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x120a0c, depthTest: false }));
    this.barBack.scale.set(0.82, 0.1, 1);
    this.barFill = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0xd83a2a, depthTest: false }));
    this.barFill.position.z = 0.001;
    this.barBack.renderOrder = 10;
    this.barFill.renderOrder = 11;
    this.bar.add(this.barBack, this.barFill);
  }

  /** Dresses the figure for a new unit: colours from `color`, the rig from `look`, the bar colour from the side. */
  setup(kind: SummonKind, color: string, ownSide: boolean, look: MinionLook = defaultLook) {
    this.retireRig();
    const c = new THREE.Color(color);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    this.material.color.setHSL(hsl.h, Math.min(0.75, hsl.s * 0.85), THREE.MathUtils.clamp(hsl.l * 0.6, 0.24, 0.38));
    this.trim.color.setHSL(hsl.h, hsl.s * 0.45, THREE.MathUtils.clamp(hsl.l * 0.8, 0.36, 0.5));
    this.palette.eye.color.setHSL(hsl.h, Math.min(0.9, hsl.s + 0.1), 0.66);
    this.palette.outline.color.setHSL(hsl.h, hsl.s * 0.5, 0.06);
    this.chunkMat.color.copy(this.material.color);
    this.ringMat.color.setHSL(hsl.h, Math.min(0.8, hsl.s), 0.6);
    (this.barFill.material as THREE.MeshBasicMaterial).color.set(ownSide ? '#5fd46f' : '#e0503a');
    this.rig = look(kind, this.palette);
    this.holder.add(this.rig.root);
    this.barY = kind === 'turret' ? 1.1 : 1.28;
    this.age = 0;
    this.dying = -1;
    this.holder.visible = true;
    this.holder.scale.setScalar(0.01);
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.group.rotation.set(0, 0, 0);
    this.setFlash(0);
    for (const ch of this.chunks) ch.mesh.visible = false;
    this.ring.visible = true;
    this.bar.visible = true;
  }

  /** Per frame while the unit lives (and while its death puff plays). `hp` is the fraction left. */
  update(dt: number, pose: MinionPose, hp: number, camera: THREE.Camera) {
    this.age += dt;
    if (this.dying >= 0) {
      this.tickPuff(dt);
      return;
    }
    const pop = Math.min(1, this.age / POP_TIME);
    // Ease out with a little overshoot.
    const s = pop >= 1 ? 1 : 1 + 2.2 * (pop - 1) ** 3 + 1.2 * (pop - 1) ** 2;
    this.holder.scale.setScalar(Math.max(0.01, s));
    this.rig?.animate(dt, pose);
    if (this.age < 0.4) {
      const k = this.age / 0.4;
      this.ring.scale.setScalar(0.35 + 0.65 * k);
      this.ringMat.opacity = 0.55 * (1 - k);
    } else this.ring.visible = false;
    this.updateBar(hp, camera);
  }

  /** The unit died: the figure vanishes in a small puff of chunks and a ring. */
  die() {
    this.dying = 0;
    this.holder.visible = false;
    this.bar.visible = false;
    for (const ch of this.chunks) {
      const a = Math.random() * Math.PI * 2, sp = 1.4 + Math.random() * 1.8;
      ch.vel.set(Math.cos(a) * sp, 1.2 + Math.random() * 1.6, Math.sin(a) * sp);
      ch.mesh.position.set(0, 0.35 + Math.random() * 0.3, 0);
      ch.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      ch.mesh.scale.setScalar(1);
      ch.mesh.visible = true;
    }
    this.ring.visible = true;
    this.ring.scale.setScalar(0.4);
    this.ringMat.opacity = 0.8;
  }

  /** The puff has played out. */
  get settled() {
    return this.dying >= PUFF_TIME;
  }

  /** Back to nothing shown (the pool takes it). */
  retire() {
    this.retireRig();
    this.group.visible = false;
    this.bar.visible = false;
    this.dying = -1;
  }

  private retireRig() {
    if (!this.rig) return;
    this.holder.remove(this.rig.root);
    this.rig.dispose?.();
    this.rig = null;
  }

  private tickPuff(dt: number) {
    this.dying += dt;
    const k = Math.min(1, this.dying / PUFF_TIME);
    for (const ch of this.chunks) {
      ch.mesh.position.addScaledVector(ch.vel, dt);
      ch.vel.y -= 9 * dt;
      ch.mesh.position.y = Math.max(0.03, ch.mesh.position.y);
      ch.mesh.rotation.x += dt * 5;
      ch.mesh.scale.setScalar(Math.max(0.01, 1 - k * k));
    }
    this.ring.scale.setScalar(0.4 + 1.3 * (1 - (1 - k) ** 2));
    this.ringMat.opacity = 0.8 * (1 - k);
    if (this.dying >= PUFF_TIME) {
      for (const ch of this.chunks) ch.mesh.visible = false;
      this.ring.visible = false;
    }
  }

  private updateBar(hp: number, camera: THREE.Camera) {
    const f = THREE.MathUtils.clamp(hp, 0, 1);
    this.bar.position.copy(this.group.position).y += this.barY;
    this.bar.quaternion.copy(camera.quaternion);
    this.barFill.scale.set(Math.max(0.001, 0.76 * f), 0.065, 1);
    this.barFill.position.x = -0.38 * (1 - f);
  }
}

export class MinionPool {
  private free: MinionFx[] = [];

  constructor(private parent: THREE.Group) {}

  acquire(): MinionFx {
    const fx = this.free.pop() ?? this.make();
    fx.group.visible = true;
    return fx;
  }

  release(fx: MinionFx) {
    fx.retire();
    if (!this.free.includes(fx)) this.free.push(fx);
  }

  private make() {
    const fx = new MinionFx();
    fx.group.visible = false;
    this.parent.add(fx.group, fx.bar);
    return fx;
  }
}
