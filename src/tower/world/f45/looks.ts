import * as THREE from 'three';
import type { MinionLook, MinionPalette } from '../../../effects/parts/minion';

/**
 * The enemy looks of floors 4 and 5 (The Lightless Deep, The Field of Banners), drawn in code as floor 1's are (`../looks.ts`): each rig
 * faces +Z with its feet at y = 0, `palette.body` takes the hit flash. Floor 4's are amethyst, bone and a cyan or amber glow (so they
 * read out of the dark); floor 5's are three families told apart by colour from the camera: crimson, azure and ash. First pass, for the
 * artist to direct. They are found by `lookOf` (`../looks.ts`) through `EXTRA_LOOKS`, keyed by the spec's `look` string.
 */

function hull(src: THREE.Mesh, p: MinionPalette, k = 1.12) {
  const h = new THREE.Mesh(src.geometry, p.outline);
  h.position.copy(src.position);
  h.rotation.copy(src.rotation);
  h.scale.copy(src.scale).multiplyScalar(k);
  return h;
}

/** A small kit for building a rig: geometry and materials it made are freed with it. */
class Build {
  root = new THREE.Group();
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  constructor(readonly p: MinionPalette) {}
  g<T extends THREE.BufferGeometry>(geo: T) { this.geos.push(geo); return geo; }
  std(color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true, ...o });
    this.mats.push(m);
    return m;
  }
  basic(color: number, o: Partial<THREE.MeshBasicMaterialParameters> = {}) {
    const m = new THREE.MeshBasicMaterial({ color, ...o });
    this.mats.push(m);
    return m;
  }
  /** A mesh in `parent` (the root by default); `outline` adds the dark back-face hull. */
  add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, o: { parent?: THREE.Object3D; outline?: number; shadow?: boolean } = {}) {
    const m = new THREE.Mesh(this.g(geo), mat);
    m.position.set(x, y, z);
    if (o.shadow !== false) m.castShadow = true;
    const parent = o.parent ?? this.root;
    if (o.outline) parent.add(hull(m, this.p, o.outline));
    parent.add(m);
    return m;
  }
  dispose() {
    for (const x of this.geos) x.dispose();
    for (const x of this.mats) x.dispose();
  }
}

function tint(p: MinionPalette, body: number, trim: number) {
  p.body.color.set(body);
  p.trim.color.set(trim);
  p.trim.metalness = 0.4;
  p.trim.roughness = 0.5;
}

type Pose = { walk: number; swing: number; shot: number; time: number };
const swingOf = (s: number) => (s < 0.6 ? -1.5 * (s / 0.6) : -1.5 + ((s - 0.6) / 0.4) * 2.5);

// --- floor 4 ----------------------------------------------------------------------------------------------------------

/** A shard mite: a low violet beetle with three cyan crystals on its back, six legs, two hot pink eyes. */
const miteLook: MinionLook = (_kind, p) => {
  tint(p, 0x5a3a96, 0x9af0ff);
  const b = new Build(p);
  const body = b.add(new THREE.IcosahedronGeometry(0.42, 0), p.body, 0, 0.36, 0, { outline: 1.14 });
  body.scale.set(1, 0.62, 1.35);
  const crystal = b.basic(0x7ae8ff);
  for (const [x, z, s] of [[0, -0.15, 1], [-0.2, 0.2, 0.7], [0.2, 0.25, 0.75]] as const) {
    const c = b.add(new THREE.OctahedronGeometry(0.17 * s).scale(0.7, 1.9, 0.7), crystal, x, 0.62 + 0.06 * s, z);
    c.rotation.z = x * 1.5;
  }
  const eye = b.basic(0xff5ac8);
  for (const x of [-0.1, 0.1]) b.add(new THREE.SphereGeometry(0.055, 5, 4), eye, x, 0.38, 0.5, { shadow: false });
  const legs: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1, k = i % 3;
    const leg = b.add(new THREE.CylinderGeometry(0.025, 0.035, 0.4, 4), p.trim, 0.3 * s, 0.17, -0.25 + k * 0.25, { shadow: false });
    leg.rotation.z = 1.0 * s;
    legs.push(leg);
  }
  let ph = Math.random() * 6;
  return {
    root: b.root, barY: 1.05,
    animate(dt, pose: Pose) {
      ph += dt * (6 + 14 * pose.walk);
      legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + i * 1.7) * 0.5 * (0.2 + pose.walk); });
      b.root.position.y = 0.02 + Math.abs(Math.sin(ph)) * 0.04 * pose.walk;
      b.root.rotation.x = pose.swing >= 0 ? -0.5 * Math.sin(pose.swing * Math.PI) : 0;
    },
    dispose: () => b.dispose(),
  };
};

/** A lurker: a long low beast, near black with bone claws, a pale smooth head and two pale slit eyes. It crouches, then leaps. */
const lurkerLook: MinionLook = (_kind, p) => {
  tint(p, 0x1d1b2c, 0xe8e2cc);
  const b = new Build(p);
  const body = b.add(new THREE.CapsuleGeometry(0.28, 0.9, 4, 8), p.body, 0, 0.55, -0.05, { outline: 1.13 });
  body.rotation.x = Math.PI / 2;
  const head = b.add(new THREE.SphereGeometry(0.24, 8, 6), p.trim, 0, 0.62, 0.72, { outline: 1.1 });
  head.scale.set(0.9, 0.8, 1.25);
  const eyeMat = b.basic(0xe8fbff);
  for (const x of [-0.11, 0.11]) {
    const e = b.add(new THREE.BoxGeometry(0.11, 0.028, 0.03), eyeMat, x, 0.68, 0.93, { shadow: false });
    e.rotation.z = x > 0 ? -0.35 : 0.35;
  }
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.3, 0.4], [0.3, 0.4], [-0.3, -0.5], [0.3, -0.5]] as const) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.5, z);
    b.add(new THREE.CylinderGeometry(0.05, 0.07, 0.55, 5), p.body, 0, -0.25, 0, { parent: leg });
    b.add(new THREE.ConeGeometry(0.08, 0.2, 4), p.trim, 0, -0.55, 0.1, { parent: leg });
    b.root.add(leg);
    legs.push(leg);
  }
  const spines = b.std(0x3a3560);
  for (let i = 0; i < 5; i++) b.add(new THREE.ConeGeometry(0.06, 0.28, 4), spines, 0, 0.88, -0.5 + i * 0.28);
  let ph = Math.random() * 6;
  return {
    root: b.root, barY: 1.3,
    animate(dt, pose: Pose) {
      ph += dt * (4 + 10 * pose.walk);
      legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i % 2) * Math.PI + (i > 1 ? 0.8 : 0)) * 0.7 * (0.15 + pose.walk); });
      // A leap: the body folds low, then springs forward and up as the swing lands.
      const s = pose.swing;
      b.root.position.y = 0.02 + (s >= 0 ? Math.sin(Math.min(1, s) * Math.PI) * 0.7 : Math.abs(Math.sin(ph)) * 0.06 * pose.walk);
      b.root.rotation.x = s >= 0 ? (s < 0.5 ? 0.25 : -0.35) : 0.08 * pose.walk;
    },
    dispose: () => b.dispose(),
  };
};

/** A crystal golem: three chunks of grey rock stacked into a man, a cyan core in the chest, great fists. */
const golemLook: MinionLook = (_kind, p) => {
  tint(p, 0x5a5e72, 0x6ad8ff);
  const b = new Build(p);
  const legs = [-1, 1].map((s) => b.add(new THREE.DodecahedronGeometry(0.28, 0), p.body, 0.24 * s, 0.35, 0, { outline: 1.1 }));
  const torso = b.add(new THREE.DodecahedronGeometry(0.5, 0), p.body, 0, 1.0, 0, { outline: 1.1 });
  torso.scale.set(1.1, 0.95, 0.85);
  const head = b.add(new THREE.DodecahedronGeometry(0.22, 0), p.body, 0, 1.6, 0.05, { outline: 1.14 });
  const core = b.add(new THREE.OctahedronGeometry(0.2), b.basic(0x7ae8ff), 0, 1.05, 0.38, { shadow: false });
  core.scale.set(0.8, 1.3, 0.6);
  const eye = b.basic(0xaaf4ff);
  b.add(new THREE.BoxGeometry(0.22, 0.05, 0.04), eye, 0, 1.63, 0.26, { shadow: false });
  const crystal = b.basic(0x7ae8ff);
  for (const [x, y, r] of [[-0.35, 1.45, 0.4], [0.38, 1.5, -0.35], [0, 1.9, 0]] as const) {
    const c = b.add(new THREE.OctahedronGeometry(0.15).scale(0.6, 1.8, 0.6), crystal, x, y, -0.15);
    c.rotation.z = r;
  }
  const arms = [-1, 1].map((s) => {
    const a = new THREE.Group();
    a.position.set(0.62 * s, 1.35, 0);
    b.add(new THREE.CylinderGeometry(0.11, 0.14, 0.7, 5), p.body, 0, -0.3, 0, { parent: a });
    b.add(new THREE.DodecahedronGeometry(0.24, 0), p.trim, 0, -0.75, 0.05, { parent: a, outline: 1.1 });
    b.root.add(a);
    return a;
  });
  b.root.scale.setScalar(0.95);
  let ph = Math.random() * 6;
  return {
    root: b.root, barY: 2.25,
    animate(dt, pose: Pose) {
      ph += dt * (2 + 3 * pose.walk);
      legs.forEach((l, i) => { l.position.y = 0.35 + Math.max(0, Math.sin(ph + i * Math.PI)) * 0.1 * pose.walk; });
      torso.position.y = 1.0 + Math.sin(ph * 2) * 0.02 * pose.walk;
      core.scale.setScalar(0.9 + 0.2 * Math.sin(pose.time * 3) + pose.shot * 0.7);
      const raise = pose.swing >= 0 ? swingOf(pose.swing) : 0;
      arms.forEach((a, i) => { a.rotation.x = pose.shot > 0 ? -1.6 * pose.shot : raise * (i ? 1 : 0.6) + Math.sin(ph + i * Math.PI) * 0.2 * pose.walk; });
      head.rotation.y = Math.sin(pose.time * 0.6) * 0.3;
    },
    dispose: () => b.dispose(),
  };
};

/** A hooded thief with a great amber lantern on a pole: the one lamp in the Deep that is not a crystal. */
function thiefLook(o: { pale?: boolean; lantern?: boolean; crown?: boolean }): MinionLook {
  return (_kind, p) => {
    if (o.pale) tint(p, 0xd8d4cc, 0x40384e);
    else tint(p, 0x3a3a50, 0xd8a84a);
    const b = new Build(p);
    const h = o.pale ? 1.35 : 1;
    const robe = b.add(new THREE.ConeGeometry(0.42, 1.25 * h, 7), p.body, 0, 0.62 * h, 0, { outline: 1.1 });
    const torso = b.add(new THREE.CylinderGeometry(0.2, 0.34, 0.5 * h, 7), p.body, 0, 1.3 * h, 0.04, { outline: 1.1 });
    const hood = b.add(new THREE.ConeGeometry(0.24, 0.5, 7), p.body, 0, 1.78 * h, 0.05, { outline: 1.12 });
    const face = b.basic(o.pale ? 0x0c0a14 : 0x15121c);
    b.add(new THREE.SphereGeometry(0.15, 6, 5), face, 0, 1.66 * h, 0.16, { shadow: false });
    const eyes = b.basic(o.pale ? 0xffffff : 0xffc860);
    for (const x of [-0.06, 0.06]) b.add(new THREE.SphereGeometry(0.03, 4, 4), eyes, x, 1.68 * h, 0.28, { shadow: false });
    const arms = [-1, 1].map((s) => {
      const a = new THREE.Group();
      a.position.set(0.3 * s, 1.5 * h, 0.05);
      b.add(new THREE.CylinderGeometry(0.06, 0.07, o.pale ? 1.1 : 0.7, 5), p.body, 0, o.pale ? -0.5 : -0.3, 0.1, { parent: a });
      b.root.add(a);
      return a;
    });
    let lamp: THREE.Mesh | null = null;
    if (o.lantern) {
      const pole = b.add(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 5), p.trim, 0.5, 1.05, 0.3);
      pole.rotation.z = -0.08;
      lamp = b.add(new THREE.OctahedronGeometry(0.26), b.basic(0xffa83a), 0.6, 2.2, 0.3, { shadow: false });
      lamp.scale.set(0.9, 1.25, 0.9);
      b.add(new THREE.TorusGeometry(0.28, 0.025, 4, 12), p.trim, 0.6, 2.2, 0.3, { shadow: false }).rotation.x = Math.PI / 2;
    }
    if (o.crown) {
      // A rack of long pale crystals like antlers.
      const crystal = b.basic(0xe6f4ff);
      for (const [x, y, rz] of [[-0.18, 2.35, 0.5], [0.18, 2.35, -0.5], [-0.08, 2.5, 0.15], [0.1, 2.52, -0.2]] as const) {
        const c = b.add(new THREE.OctahedronGeometry(0.14).scale(0.5, 2.6, 0.5), crystal, x, y, 0.05, { shadow: false });
        c.rotation.z = rz;
      }
    }
    b.root.scale.setScalar(o.pale ? 1 : 0.95);
    let ph = Math.random() * 6;
    void torso; void hood; void robe;
    return {
      root: b.root, barY: (o.pale ? 3.0 : 2.0) * (o.pale ? 1 : 0.95),
      animate(dt, pose: Pose) {
        ph += dt * (2 + 4 * pose.walk);
        b.root.position.y = Math.abs(Math.sin(ph)) * 0.05 * pose.walk;
        b.root.rotation.z = Math.sin(ph) * 0.05 * pose.walk;
        b.root.rotation.x = pose.swing >= 0 ? 0.3 * Math.sin(pose.swing * Math.PI) : 0.1;
        arms.forEach((a, i) => { a.rotation.x = pose.swing >= 0 ? swingOf(pose.swing) : (o.pale ? -0.3 : 0) + Math.sin(ph + i * Math.PI) * 0.25 * pose.walk; });
        if (lamp) lamp.scale.set(0.9, 1.25, 0.9).multiplyScalar(1 + 0.08 * Math.sin(pose.time * 8));
      },
      dispose: () => b.dispose(),
    };
  };
}

// --- floor 5 ----------------------------------------------------------------------------------------------------------

type Soldier = {
  body: number; trim: number;
  /** What it carries: a spear and kite shield, a bow, a great sword, a lance, a broken sword. */
  arm: 'spear' | 'bow' | 'sword' | 'lance' | 'broken';
  shield?: boolean; helm?: 'pot' | 'great' | 'none'; plume?: number; banner?: number; cape?: number; ash?: boolean; scale?: number;
};

/** A ghost soldier of the field: an armoured body in its army's cloth, a helm, what it carries; the ash ones are bone grey with dark sockets. */
function soldierLook(o: Soldier): MinionLook {
  return (kind, p) => {
    tint(p, o.body, o.trim);
    const b = new Build(p);
    const steel = b.std(o.ash ? 0x8a8a92 : 0x7a7e8c, { metalness: 0.5, roughness: 0.45 });
    const legs = [-1, 1].map((s) => b.add(new THREE.CylinderGeometry(0.1, 0.13, 0.78, 6), steel, 0.14 * s, 0.39, 0, { outline: 1.12 }));
    const torso = b.add(new THREE.CylinderGeometry(0.27, 0.3, 0.62, 8), p.body, 0, 1.08, 0, { outline: 1.1 });
    b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8), p.trim, 0, 0.78, 0, { shadow: false });
    for (const s of [-1, 1]) b.add(new THREE.SphereGeometry(0.15, 6, 5), steel, 0.34 * s, 1.34, 0, { outline: 1.1 });
    const head = b.add(new THREE.SphereGeometry(0.17, 7, 6), o.ash ? steel : b.std(0xd6c4a8), 0, 1.58, 0.02, { outline: 1.12 });
    if (o.helm !== 'none') {
      const helm = b.add(o.helm === 'great' ? new THREE.CylinderGeometry(0.19, 0.2, 0.34, 8) : new THREE.SphereGeometry(0.2, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.62), steel, 0, o.helm === 'great' ? 1.62 : 1.6, 0.02, { outline: 1.12 });
      helm.scale.set(1, 1, 1);
      b.add(new THREE.BoxGeometry(0.2, 0.04, 0.03), b.basic(0x0c0b10), 0, 1.6, 0.19, { shadow: false });
    }
    if (o.plume) {
      const plume = b.add(new THREE.ConeGeometry(0.07, 0.42, 5), b.std(o.plume), 0, 1.98, -0.04, { shadow: false });
      plume.rotation.x = -0.4;
    }
    if (o.cape) {
      const cape = b.add(new THREE.BoxGeometry(0.5, 0.95, 0.04), b.std(o.cape, { side: THREE.DoubleSide }), 0, 1.0, -0.3);
      cape.rotation.x = 0.12;
    }
    if (o.ash) b.add(new THREE.SphereGeometry(0.035, 4, 4), b.basic(0xcfe8ff), 0, 1.6, 0.18, { shadow: false });
    const arm = new THREE.Group();
    arm.position.set(0.36, 1.2, 0.05);
    b.root.add(arm);
    let drawn: THREE.Object3D | null = null;
    if (o.arm === 'bow') {
      const bow = b.add(new THREE.TorusGeometry(0.5, 0.03, 4, 14, Math.PI), b.std(0x6a4a2c), 0, -0.1, 0.3, { parent: arm });
      bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
      drawn = bow;
    } else if (o.arm === 'spear' || o.arm === 'lance') {
      const len = o.arm === 'lance' ? 2.4 : 1.8;
      const shaft = b.add(new THREE.CylinderGeometry(0.03, 0.03, len, 5), b.std(0x6a4a2c), 0, -0.1, len / 2 - 0.2, { parent: arm });
      shaft.rotation.x = Math.PI / 2;
      b.add(new THREE.ConeGeometry(0.07, 0.3, 5), steel, 0, -0.1, len - 0.1, { parent: arm }).rotation.x = Math.PI / 2;
      if (o.arm === 'lance') {
        const pen = b.add(new THREE.PlaneGeometry(0.4, 0.22), b.std(o.trim, { side: THREE.DoubleSide }), 0, 0.02, len - 0.55, { parent: arm, shadow: false });
        pen.rotation.y = Math.PI / 2;
      }
    } else {
      const bl = o.arm === 'broken' ? 0.55 : 1.15;
      b.add(new THREE.BoxGeometry(0.07, 0.04, bl), steel, 0, -0.1, bl / 2 + 0.1, { parent: arm });
      b.add(new THREE.BoxGeometry(0.3, 0.05, 0.06), p.trim, 0, -0.1, 0.1, { parent: arm });
    }
    let shield: THREE.Mesh | null = null;
    if (o.shield) {
      shield = b.add(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 3).scale(1, 1, 1.6), p.trim, -0.4, 1.12, 0.12, { outline: 1.1 });
      shield.rotation.set(Math.PI / 2, 0, 0.3);
      shield.rotation.order = 'YXZ';
      shield.rotation.set(0, 0.4, Math.PI / 2);
      b.add(new THREE.CircleGeometry(0.09, 6), b.std(0xe8d8a8), -0.44, 1.12, 0.12, { shadow: false }).rotation.y = Math.PI / 2 + 0.4;
    }
    let flag: THREE.Mesh | null = null;
    if (o.banner) {
      b.add(new THREE.CylinderGeometry(0.035, 0.04, 3.1, 5), b.std(0x4a3626), 0.3, 1.55, -0.28);
      flag = b.add(new THREE.PlaneGeometry(0.8, 1.2), b.std(o.banner, { side: THREE.DoubleSide, emissive: o.banner, emissiveIntensity: 0.25 }), 0.72, 2.45, -0.28, { shadow: false });
      b.add(new THREE.ConeGeometry(0.07, 0.2, 5), b.std(0xe8c860, { metalness: 0.6 }), 0.3, 3.2, -0.28, { shadow: false });
    }
    const sc = o.scale ?? 1;
    b.root.scale.setScalar(sc);
    let ph = Math.random() * 6;
    const ranged = kind === 'ranged';
    return {
      root: b.root, barY: (o.banner ? 2.2 : 2.0) * sc,
      animate(dt, pose: Pose) {
        ph += dt * (3 + 6 * pose.walk);
        b.root.position.y = Math.abs(Math.sin(ph)) * 0.05 * pose.walk;
        legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + i * Math.PI) * 0.55 * pose.walk; });
        torso.rotation.z = Math.sin(ph) * 0.04 * pose.walk;
        let lean = 0.04 + (o.arm === 'lance' ? 0.16 * pose.walk : 0);
        if (pose.swing >= 0) {
          arm.rotation.x = swingOf(pose.swing) * (o.arm === 'spear' || o.arm === 'lance' ? 0.5 : 1);
          lean = pose.swing < 0.6 ? 0 : 0.35;
        } else arm.rotation.x = ranged ? -0.4 : 0.1 * Math.sin(ph) * pose.walk;
        if (drawn) drawn.rotation.x = pose.shot * 0.4;
        b.root.rotation.x = lean;
        head.rotation.y = Math.sin(pose.time * 0.7) * 0.15;
        if (flag) flag.rotation.y = Math.sin(pose.time * 3 + ph) * 0.25;
        if (shield) shield.position.z = 0.12 + (pose.swing >= 0 ? 0.08 : 0);
      },
      dispose: () => b.dispose(),
    };
  };
}

const CRIMSON = { body: 0xa83434, trim: 0xe8c07a }, AZURE = { body: 0x3558b0, trim: 0xd8e4f8 }, ASH = { body: 0x62626e, trim: 0xb0b0b8 };

/** Looks by the spec's `look` string. Floor 4's and floor 5's; `lookOf` in `../looks.ts` asks here first. */
export const EXTRA_LOOKS: Record<string, MinionLook> = {
  mite: miteLook,
  lurker: lurkerLook,
  golem: golemLook,
  thief: thiefLook({ lantern: true }),
  pale: thiefLook({ pale: true, crown: true }),
  'footman-r': soldierLook({ ...CRIMSON, arm: 'spear', shield: true, helm: 'pot' }),
  'footman-b': soldierLook({ ...AZURE, arm: 'spear', shield: true, helm: 'pot' }),
  'bowman-r': soldierLook({ ...CRIMSON, arm: 'bow', helm: 'none', cape: 0x6a2020 }),
  'bowman-b': soldierLook({ ...AZURE, arm: 'bow', helm: 'none', cape: 0x1e3470 }),
  'knight-r': soldierLook({ ...CRIMSON, arm: 'lance', shield: true, helm: 'great', plume: 0xd84040, scale: 1.25 }),
  'knight-b': soldierLook({ ...AZURE, arm: 'lance', shield: true, helm: 'great', plume: 0x5a8aff, scale: 1.25 }),
  ashen: soldierLook({ ...ASH, arm: 'sword', shield: true, helm: 'pot', ash: true }),
  bearer: soldierLook({ body: 0x2a2630, trim: 0xe8c060, arm: 'sword', helm: 'great', plume: 0xe8c060, banner: 0x1c1822, cape: 0x14111a, scale: 1.1 }),
  deserter: soldierLook({ body: 0x5a6a58, trim: 0xb8b090, arm: 'broken', helm: 'great', cape: 0x3a4a3a, scale: 1.15 }),
};
