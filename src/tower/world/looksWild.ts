import * as THREE from 'three';
import type { MinionLook, MinionPalette, MinionPose, MinionRig } from '../../effects/parts/minion';

/**
 * The enemies and helpers of floors 2 and 3, as looks of the summon system's units (as floor 1's `looks.ts`): each rig faces +Z with its
 * feet at y = 0, `palette.body` takes the hit flash. The wood's are bark brown, moss green, thorn pink and a gold glow (hounds, sprites,
 * giants, the stag, the oak, the feeding roots; floor 1's are sea-green and navy). The canyon's are rust, sand and turquoise (raiders,
 * slingers, dust wraiths, the chief, the Dune Mother). Drawn in code, first pass for the artist to direct.
 */

function tint(p: MinionPalette, body: number, trim: number) {
  p.body.color.set(body);
  p.trim.color.set(trim);
  p.trim.metalness = 0.4;
  p.trim.roughness = 0.6;
}

/** A small builder: geometries are collected to be freed, and a part is placed with its material in one call. */
function builder(p: MinionPalette) {
  const root = new THREE.Group(), geos: THREE.BufferGeometry[] = [], extra: { dispose(): void }[] = [];
  const g = <T extends THREE.BufferGeometry>(geo: T) => { geos.push(geo); return geo; };
  const add = (to: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, o: { rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number; shadow?: boolean; outline?: boolean } = {}) => {
    const m = new THREE.Mesh(g(geo), mat);
    m.position.set(x, y, z);
    m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    m.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    if (o.shadow) m.castShadow = true;
    if (o.outline) {
      const h = new THREE.Mesh(m.geometry, p.outline);
      h.position.copy(m.position); h.rotation.copy(m.rotation); h.scale.copy(m.scale).multiplyScalar(1.12);
      to.add(h);
    }
    to.add(m);
    return m;
  };
  const own = <T extends { dispose(): void }>(x: T) => { extra.push(x); return x; };
  return { root, g, add, own, dispose() { for (const x of geos) x.dispose(); for (const x of extra) x.dispose(); } };
}

const cone = (r: number, h: number, n = 5) => new THREE.ConeGeometry(r, h, n);
const cyl = (r0: number, r1: number, h: number, n = 7) => new THREE.CylinderGeometry(r0, r1, h, n);
const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const sphere = (r: number, a = 8, b = 6) => new THREE.SphereGeometry(r, a, b);
const pi = Math.PI;

// --- the wood -----------------------------------------------------------------------------------------------------------

/** A bark hound: low, long and quick; a ruff of leaves on the back, amber eyes. Reads as a dog from above. */
const hound: MinionLook = (_k, p) => {
  tint(p, 0x7a5430, 0xa8d060);
  const b = builder(p);
  const body = b.add(b.root, cyl(0.2, 0.24, 0.9, 7), p.body, 0, 0.5, 0, { rx: pi / 2, shadow: true, outline: true });
  b.add(b.root, sphere(0.27), p.body, 0, 0.55, 0.42, { sy: 1.05 });
  const head = new THREE.Group();
  head.position.set(0, 0.62, 0.62);
  b.add(head, sphere(0.19), p.body, 0, 0, 0, { shadow: true, outline: true });
  b.add(head, cone(0.12, 0.34, 5), p.body, 0, -0.04, 0.26, { rx: pi / 2 });
  b.add(head, cone(0.07, 0.24, 4), p.body, -0.11, 0.2, -0.02, { rz: 0.3 });
  b.add(head, cone(0.07, 0.24, 4), p.body, 0.11, 0.2, -0.02, { rz: -0.3 });
  b.add(head, box(0.2, 0.05, 0.03), p.eye, 0, 0.05, 0.17);
  b.root.add(head);
  for (let i = 0; i < 4; i++) b.add(b.root, cone(0.07, 0.34, 4), p.trim, ((i % 2) - 0.5) * 0.16, 0.86, -0.25 + i * 0.2, { rz: ((i % 2) - 0.5) * 0.6 });
  const tail = b.add(b.root, cone(0.07, 0.5, 4), p.body, 0, 0.66, -0.55, { rx: -1.1 });
  const legs = [[-0.14, 0.4], [0.14, 0.4], [-0.14, -0.3], [0.14, -0.3]].map(([x, z]) => {
    const l = new THREE.Group();
    l.position.set(x, 0.38, z);
    b.add(l, cyl(0.05, 0.07, 0.4, 5), p.body, 0, -0.19, 0);
    b.root.add(l);
    return l;
  });
  let ph = Math.random() * 6;
  return {
    root: b.root, barY: 1.2,
    animate(dt, pose) {
      ph += dt * (4 + 14 * pose.walk);
      legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i % 2 ? pi : 0) + (i > 1 ? pi / 2 : 0)) * 0.7 * (0.2 + pose.walk); });
      b.root.position.y = Math.abs(Math.sin(ph)) * 0.07 * pose.walk;
      tail.rotation.z = Math.sin(ph * 0.6) * 0.4;
      let bite = 0;
      if (pose.swing >= 0) bite = pose.swing < 0.6 ? -(pose.swing / 0.6) * 0.3 : -0.3 + ((pose.swing - 0.6) / 0.4) * 0.9;
      head.position.z = 0.62 + Math.max(bite, -0.1);
      head.rotation.x = bite * 0.8;
      body.rotation.x = pi / 2 + (pose.swing >= 0 ? -0.15 : 0);
    },
    dispose: () => b.dispose(),
  };
};

/** A thorn sprite: a glowing pink core in a ball of thorns, two leaf wings, hovering. */
const sprite: MinionLook = (_k, p) => {
  tint(p, 0x5a2a6a, 0xff7aa8);
  const b = builder(p);
  const body = new THREE.Group();
  body.position.y = 0.95;
  b.root.add(body);
  b.add(body, ico(0.26, 1), p.body, 0, 0, 0, { shadow: true, outline: true });
  b.add(body, sphere(0.16), p.eye, 0, 0, 0.12);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4, y = Math.cos(i * 1.7) * 0.8, r = Math.sqrt(1 - y * y);
    const t = b.add(body, cone(0.06, 0.34, 4), p.trim, Math.cos(a) * r * 0.3, y * 0.3, Math.sin(a) * r * 0.3);
    t.lookAt(Math.cos(a) * r, y, Math.sin(a) * r);
    t.rotateX(pi / 2);
  }
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    w.position.set(0.2 * s, 0.05, -0.1);
    b.add(w, new THREE.CircleGeometry(0.3, 6), p.trim, 0.25 * s, 0, 0, { sy: 0.55, ry: 0.5 * s });
    body.add(w);
    return w;
  });
  let ph = Math.random() * 6;
  return {
    root: b.root, barY: 1.7,
    animate(dt, pose) {
      ph += dt * 6;
      body.position.y = 0.95 + Math.sin(ph * 0.5) * 0.12;
      body.rotation.y += dt * 1.2;
      wings.forEach((w, i) => { w.rotation.z = Math.sin(ph * 2.2) * 0.6 * (i ? -1 : 1); });
      body.scale.setScalar(1 + pose.shot * 0.45);
    },
    dispose: () => b.dispose(),
  };
};

/** A moss giant: a hunched mass of stone and moss on two thick legs, boulder fists, mushrooms on its back. Slow and heavy. */
const giant: MinionLook = (_k, p) => {
  tint(p, 0x4f7040, 0x8a8a78);
  const b = builder(p);
  const rock = b.own(new THREE.MeshStandardMaterial({ color: 0x8a8a78, roughness: 0.95, flatShading: true }));
  const cap = b.own(new THREE.MeshStandardMaterial({ color: 0xc04a3a, roughness: 0.7, flatShading: true }));
  for (const s of [-1, 1]) b.add(b.root, cyl(0.2, 0.28, 0.7, 6), p.body, 0.24 * s, 0.35, 0, { shadow: true });
  const torso = new THREE.Group();
  torso.position.y = 0.95;
  b.root.add(torso);
  b.add(torso, ico(0.55, 0), p.body, 0, 0.1, -0.05, { sx: 1.15, sy: 1, sz: 0.9, shadow: true, outline: true });
  b.add(torso, ico(0.5, 0), rock, 0, 0.4, 0.05, { sx: 0.8, sy: 0.55, sz: 0.7 });
  b.add(torso, ico(0.24, 0), rock, 0, 0.75, 0.22, { shadow: true });
  b.add(torso, box(0.24, 0.05, 0.03), p.eye, 0, 0.78, 0.44);
  for (const [x, y, z] of [[-0.35, 0.55, -0.35], [0.3, 0.62, -0.4], [0, 0.7, -0.45]] as const) {
    b.add(torso, cone(0.04, 0.3, 4), p.trim, x, y, z);
    b.add(torso, ico(0.13), cap, x, y + 0.18, z, { sy: 0.7 });
  }
  const arms = [-1, 1].map((s) => {
    const a = new THREE.Group();
    a.position.set(0.62 * s, 0.35, 0);
    b.add(a, cyl(0.14, 0.18, 0.8, 6), p.body, 0, -0.35, 0.1, { rx: 0.2 });
    b.add(a, ico(0.27), rock, 0, -0.78, 0.2, { shadow: true });
    torso.add(a);
    return a;
  });
  let ph = Math.random() * 6;
  return {
    root: b.root, barY: 2.15,
    animate(dt, pose) {
      ph += dt * (2 + 3 * pose.walk);
      b.root.position.y = Math.abs(Math.sin(ph)) * 0.08 * pose.walk;
      torso.rotation.z = Math.sin(ph) * 0.08 * pose.walk;
      let lift = 0;
      if (pose.swing >= 0) lift = pose.swing < 0.6 ? -2.4 * (pose.swing / 0.6) : -2.4 + ((pose.swing - 0.6) / 0.4) * 3.2;
      arms.forEach((a, i) => { a.rotation.x = pose.swing >= 0 ? lift : Math.sin(ph + i * pi) * 0.3 * pose.walk; });
      torso.rotation.x = pose.swing >= 0 ? Math.max(-0.3, lift * 0.12) : 0.12;
    },
    dispose: () => b.dispose(),
  };
};

/** The Stag-Crowned: a tall gold-and-bark figure with a great crown of antlers that glows. */
const stag: MinionLook = (_k, p) => {
  tint(p, 0x8a5a2a, 0xffd870);
  const b = builder(p);
  for (const s of [-1, 1]) b.add(b.root, cyl(0.09, 0.14, 0.9, 6), p.body, 0.16 * s, 0.45, 0);
  const torso = new THREE.Group();
  torso.position.y = 0.95;
  b.root.add(torso);
  b.add(torso, cyl(0.34, 0.24, 0.8, 7), p.body, 0, 0.2, 0, { shadow: true, outline: true });
  b.add(torso, cone(0.5, 0.9, 7), p.trim, 0, -0.1, -0.05, { sx: 1, sy: 0.9 });
  const head = new THREE.Group();
  head.position.set(0, 0.85, 0.08);
  torso.add(head);
  b.add(head, ico(0.22), p.body, 0, 0, 0, { sy: 1.15, shadow: true, outline: true });
  b.add(head, cone(0.1, 0.3, 5), p.body, 0, -0.1, 0.22, { rx: pi / 2 });
  b.add(head, box(0.22, 0.05, 0.03), p.eye, 0, 0.04, 0.17);
  for (const s of [-1, 1]) {
    b.add(head, cyl(0.03, 0.05, 0.7, 5), p.trim, 0.2 * s, 0.4, -0.05, { rz: -0.5 * s });
    for (const [y, l] of [[0.25, 0.4], [0.45, 0.35], [0.62, 0.28]] as const) b.add(head, cyl(0.02, 0.035, l, 4), p.trim, 0.3 * s + 0.1 * s * (y / 0.6), y + 0.12, -0.05, { rz: -0.15 * s - 0.5 * s * 0.4 });
  }
  const spear = new THREE.Group();
  spear.position.set(0.5, 0.35, 0.1);
  b.add(spear, cyl(0.03, 0.03, 1.8, 5), p.trim, 0, 0, 0.5, { rx: pi / 2 });
  b.add(spear, cone(0.09, 0.4, 5), p.trim, 0, 0, 1.5, { rx: pi / 2 });
  torso.add(spear);
  let ph = Math.random() * 6;
  return {
    root: b.root, barY: 2.15,
    animate(dt, pose) {
      ph += dt * (3 + 8 * pose.walk);
      b.root.position.y = Math.abs(Math.sin(ph)) * 0.06 * pose.walk;
      torso.rotation.z = Math.sin(ph) * 0.06 * pose.walk;
      let stab = 0;
      if (pose.swing >= 0) stab = pose.swing < 0.6 ? -(pose.swing / 0.6) * 0.5 : -0.5 + ((pose.swing - 0.6) / 0.4) * 1.1;
      spear.position.z = 0.1 + stab;
      spear.rotation.x = stab * 0.4;
      head.rotation.y = Math.sin(ph * 0.3) * 0.2 * (1 - pose.walk);
    },
    dispose: () => b.dispose(),
  };
};

/** The Hollow Oak: a walking tree with a dark hollow for a face and amber eyes in it, two branch arms, a crown. */
const oak: MinionLook = (_k, p) => {
  tint(p, 0x5a4026, 0x4f8a3a);
  const b = builder(p);
  const dark = b.own(new THREE.MeshBasicMaterial({ color: 0x050403 }));
  const bark2 = b.own(new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9, flatShading: true }));
  for (const [x, z, r] of [[-0.3, 0.1, 0.4], [0.28, 0.12, -0.4], [0, -0.3, 0]] as const) b.add(b.root, cone(0.2, 0.7, 5), bark2, x, 0.25, z, { rz: r, rx: z < 0 ? -0.5 : 0.3 });
  const trunk = new THREE.Group();
  b.root.add(trunk);
  b.add(trunk, cyl(0.36, 0.5, 1.5, 8), p.body, 0, 1.0, 0, { shadow: true, outline: true });
  b.add(trunk, ico(0.32, 0), dark, 0, 1.2, 0.34, { sx: 0.9, sy: 1.25, sz: 0.5 });
  b.add(trunk, box(0.1, 0.08, 0.03), p.eye, -0.1, 1.3, 0.45);
  b.add(trunk, box(0.1, 0.08, 0.03), p.eye, 0.1, 1.3, 0.45);
  b.add(trunk, ico(0.9, 0), p.trim, 0, 2.3, 0, { sy: 0.8, shadow: true });
  b.add(trunk, ico(0.6, 0), p.trim, 0.5, 2.7, 0.1, { sy: 0.8 });
  b.add(trunk, ico(0.55, 0), p.trim, -0.5, 2.6, -0.1, { sy: 0.8 });
  const arms = [-1, 1].map((s) => {
    const a = new THREE.Group();
    a.position.set(0.45 * s, 1.7, 0);
    b.add(a, cyl(0.08, 0.16, 1.2, 5), p.body, 0.4 * s, 0, 0.1, { rz: -1.0 * s });
    b.add(a, ico(0.28), p.trim, 0.9 * s, -0.4, 0.15, { sy: 0.8 });
    trunk.add(a);
    return a;
  });
  let ph = Math.random() * 6;
  return {
    root: b.root, barY: 3.2,
    animate(dt, pose) {
      ph += dt * (1.6 + 2 * pose.walk);
      trunk.rotation.z = Math.sin(ph) * 0.05 * (0.5 + pose.walk);
      trunk.position.y = Math.abs(Math.sin(ph)) * 0.05 * pose.walk;
      let slam = 0;
      if (pose.swing >= 0) slam = pose.swing < 0.6 ? -1.8 * (pose.swing / 0.6) : -1.8 + ((pose.swing - 0.6) / 0.4) * 2.6;
      arms.forEach((a, i) => { a.rotation.x = pose.swing >= 0 ? slam : Math.sin(ph * 1.3 + i * pi) * 0.15; });
    },
    dispose: () => b.dispose(),
  };
};

/** A feeding root: a mound with thorny roots rising round a bulb that pulses when it throws. It cannot move. */
const root: MinionLook = (_k, p) => {
  tint(p, 0x3a2a1c, 0xc8f080);
  const b = builder(p);
  b.add(b.root, cone(0.8, 0.5, 8), p.body, 0, 0.2, 0, { sy: 0.8, shadow: true, outline: true });
  const thorns: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = 0.25 + (i % 3) * 0.15;
    const t = b.add(b.root, cone(0.1 + (i % 2) * 0.04, 1.2 + (i % 4) * 0.35, 5), p.body, Math.cos(a) * r, 0.7, Math.sin(a) * r, { rz: Math.cos(a) * 0.45, rx: -Math.sin(a) * 0.45, shadow: true });
    thorns.push(t);
  }
  b.add(b.root, cone(0.06, 0.8, 4), p.trim, 0.55, 0.5, 0.2, { rz: -0.9 });
  b.add(b.root, cone(0.06, 0.8, 4), p.trim, -0.55, 0.5, -0.2, { rz: 0.9 });
  const bulb = b.add(b.root, sphere(0.3), p.trim, 0, 1.35, 0.05);
  b.add(b.root, sphere(0.12), p.eye, 0, 1.38, 0.28);
  return {
    root: b.root, barY: 2.2,
    animate(_dt, pose) {
      bulb.scale.setScalar(1 + pose.shot * 0.5 + Math.sin(pose.time * 2.4) * 0.06);
      thorns.forEach((t, i) => { t.rotation.z += Math.sin(pose.time * 1.5 + i) * 0.0008; });
    },
    dispose: () => b.dispose(),
  };
};

// --- the canyon ---------------------------------------------------------------------------------------------------------

interface Wrap { body: number; trim: number; big?: boolean; hood?: boolean; horns?: boolean; shield?: boolean; sling?: boolean; banner?: boolean; blade?: boolean }

/** A caravan raider: a wrapped figure in rust with a turquoise sash, a round shield and a curved blade; slingers swap them for a sling. */
function wrapped(p: MinionPalette, o: Wrap): MinionRig {
  tint(p, o.body, o.trim);
  const b = builder(p);
  const cloth = b.own(new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.8, flatShading: true }));
  for (const s of [-1, 1]) b.add(b.root, cyl(0.1, 0.13, 0.7, 6), cloth, 0.14 * s, 0.35, 0);
  const torso = new THREE.Group();
  torso.position.y = 0.7;
  b.root.add(torso);
  b.add(torso, cyl(0.3, 0.22, 0.7, 7), p.body, 0, 0.3, 0, { shadow: true, outline: true });
  b.add(torso, new THREE.TorusGeometry(0.27, 0.05, 5, 12), p.trim, 0, 0.08, 0, { rx: pi / 2 + 0.3 });
  b.add(torso, cone(0.44, 0.7, 7), p.body, 0, -0.1, 0, { sy: 0.8 });
  const head = new THREE.Group();
  head.position.y = 0.88;
  torso.add(head);
  b.add(head, sphere(0.18), cloth, 0, 0, 0.02, { shadow: true, outline: true });
  b.add(head, o.hood ? cone(0.24, 0.4, 7) : sphere(0.23), p.trim, 0, o.hood ? 0.12 : 0.08, -0.02, { sy: o.hood ? 1 : 0.65 });
  b.add(head, box(0.22, 0.05, 0.03), p.eye, 0, 0, 0.17);
  if (o.horns) for (const s of [-1, 1]) b.add(head, cone(0.06, 0.4, 5), p.trim, 0.2 * s, 0.2, 0, { rz: -0.8 * s });
  const arm = new THREE.Group();
  arm.position.set(0.32, 0.5, 0.05);
  torso.add(arm);
  let loop: THREE.Mesh | null = null;
  if (o.sling) {
    b.add(arm, cyl(0.025, 0.025, 0.5, 4), cloth, 0, -0.2, 0.2, { rx: 0.4 });
    loop = b.add(arm, new THREE.TorusGeometry(0.2, 0.02, 4, 12), p.trim, 0, 0.1, 0.4, { rx: pi / 2 });
  } else {
    b.add(arm, cyl(0.03, 0.03, o.big ? 1.2 : 0.8, 5), p.trim, 0, 0, 0.5, { rx: pi / 2 });
    b.add(arm, new THREE.TorusGeometry(o.big ? 0.5 : 0.34, 0.045, 4, 10, pi * 0.8), p.trim, 0, 0.12, o.big ? 1.0 : 0.72, { rx: 0, rz: -0.2, ry: pi / 2 });
  }
  if (o.shield) b.add(torso, cyl(0.28, 0.28, 0.06, 12), p.trim, -0.36, 0.35, 0.12, { rz: pi / 2 });
  if (o.banner) {
    b.add(torso, cyl(0.03, 0.03, 2.2, 5), cloth, -0.2, 0.9, -0.3);
    b.add(torso, box(0.04, 0.5, 0.7), p.trim, -0.2, 1.7, -0.62);
  }
  const sc = o.big ? 1.1 : 0.95;
  b.root.scale.setScalar(sc);
  let ph = Math.random() * 6;
  return {
    root: b.root, barY: (o.big ? 2.0 : 1.75) * sc,
    animate(dt, pose: MinionPose) {
      ph += dt * (3 + 9 * pose.walk);
      b.root.position.y = Math.abs(Math.sin(ph)) * 0.06 * pose.walk;
      torso.rotation.z = Math.sin(ph) * 0.07 * pose.walk;
      torso.rotation.x = 0.1 * pose.walk;
      let sw = 0;
      if (pose.swing >= 0) sw = pose.swing < 0.6 ? -1.8 * (pose.swing / 0.6) : -1.8 + ((pose.swing - 0.6) / 0.4) * 2.8;
      arm.rotation.x = o.sling ? 0 : sw;
      if (o.sling && loop) { loop.rotation.z += dt * (6 + 10 * pose.shot); loop.position.y = 0.1 + pose.shot * 0.2; }
      if (o.sling) arm.rotation.x = -0.4 * pose.shot;
    },
    dispose: () => b.dispose(),
  };
}

/** A dust wraith: a tall swirl of dark sand with pale rings, no legs, two pale slits for eyes. It has to read inside the storm's sand-coloured haze, so it is darker than the haze. */
const wraith: MinionLook = (_k, p) => {
  tint(p, 0x6e4e36, 0xf2dcb0);
  p.body.transparent = true;
  p.body.opacity = 0.85;
  const b = builder(p);
  const dark = b.own(new THREE.MeshBasicMaterial({ color: 0xfff2c8 }));
  const swirl = new THREE.Group();
  b.root.add(swirl);
  b.add(swirl, cone(0.5, 1.7, 8), p.body, 0, 0.9, 0, { rx: pi, outline: false });
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) rings.push(b.add(swirl, new THREE.TorusGeometry(0.12 + i * 0.12, 0.035, 4, 12), p.trim, 0, 0.25 + i * 0.4, 0, { rx: pi / 2 }));
  b.add(swirl, sphere(0.3, 8, 6), p.body, 0, 1.95, 0);
  b.add(swirl, box(0.1, 0.18, 0.03), dark, -0.1, 1.98, 0.27, { rz: 0.25 });
  b.add(swirl, box(0.1, 0.18, 0.03), dark, 0.1, 1.98, 0.27, { rz: -0.25 });
  const claws = [-1, 1].map((s) => b.add(swirl, cone(0.05, 0.6, 4), p.trim, 0.45 * s, 1.2, 0.1, { rz: 1.2 * s }));
  return {
    root: b.root, barY: 2.5,
    animate(dt, pose) {
      swirl.position.y = 0.15 + Math.sin(pose.time * 2) * 0.1;
      rings.forEach((r, i) => { r.rotation.z += dt * (2 + i); r.position.x = Math.sin(pose.time * 2 + i) * 0.1; });
      swirl.rotation.y += dt * 0.8;
      claws.forEach((c, i) => { c.rotation.x = pose.swing >= 0 ? -1.0 * Math.sin(pose.swing * pi) : Math.sin(pose.time * 3 + i) * 0.1; });
    },
    dispose: () => b.dispose(),
  };
};

/** The Dune Mother: a hooded matriarch of sand, a robe in bands of rust and turquoise, gold eyes under the hood, a ring of stones that turns. */
const mother: MinionLook = (_k, p) => {
  tint(p, 0xb88a52, 0x30b0b0);
  const b = builder(p);
  const gold = b.own(new THREE.MeshBasicMaterial({ color: 0xffd060 }));
  const rock = b.own(new THREE.MeshStandardMaterial({ color: 0x8a5a44, roughness: 0.9, flatShading: true }));
  b.add(b.root, cone(0.75, 1.9, 9), p.body, 0, 0.95, 0, { shadow: true, outline: true });
  b.add(b.root, new THREE.TorusGeometry(0.66, 0.06, 5, 16), p.trim, 0, 0.35, 0, { rx: pi / 2 });
  b.add(b.root, new THREE.TorusGeometry(0.5, 0.06, 5, 16), p.trim, 0, 0.9, 0, { rx: pi / 2 });
  b.add(b.root, cone(0.33, 0.8, 8), p.body, 0, 2.15, -0.04, { shadow: true });
  b.add(b.root, sphere(0.2), rock, 0, 1.95, 0.08);
  b.add(b.root, box(0.12, 0.06, 0.03), gold, -0.09, 1.97, 0.26);
  b.add(b.root, box(0.12, 0.06, 0.03), gold, 0.09, 1.97, 0.26);
  const staff = new THREE.Group();
  staff.position.set(0.7, 0, 0.3);
  b.add(staff, cyl(0.04, 0.05, 2.4, 5), rock, 0, 1.2, 0);
  b.add(staff, new THREE.TorusGeometry(0.2, 0.04, 5, 12, pi * 1.5), p.trim, 0, 2.45, 0);
  b.root.add(staff);
  const orbit = new THREE.Group();
  orbit.position.y = 1.4;
  b.root.add(orbit);
  for (let i = 0; i < 5; i++) b.add(orbit, ico(0.16), rock, Math.cos(i * 1.256) * 1.15, Math.sin(i * 2.1) * 0.3, Math.sin(i * 1.256) * 1.15);
  return {
    root: b.root, barY: 3.4,
    animate(dt, pose) {
      orbit.rotation.y += dt * (0.8 + pose.shot * 4 + (pose.swing >= 0 ? 3 : 0));
      b.root.position.y = Math.abs(Math.sin(pose.time * 2.4)) * 0.05 * pose.walk;
      staff.rotation.x = pose.swing >= 0 ? -1.2 * Math.sin(pose.swing * pi) : 0;
    },
    dispose: () => b.dispose(),
  };
};

// --- helpers that are led ---------------------------------------------------------------------------------------------

/** A wisp: a pale blue light that bobs, with two smaller lights trailing it. */
const wisp: MinionLook = (_k, p) => {
  tint(p, 0xbfeaff, 0x7ac8ff);
  p.body.emissive.set(0x5ab8ff);
  p.body.emissiveIntensity = 0.9;
  const b = builder(p);
  const orb = b.add(b.root, sphere(0.3, 10, 8), p.body, 0, 1.2, 0);
  b.add(b.root, new THREE.TorusGeometry(0.42, 0.025, 4, 18), p.trim, 0, 1.2, 0, { rx: pi / 2 });
  const trail = [0, 1].map((i) => b.add(b.root, sphere(0.14 - i * 0.04), p.trim, 0, 1.0, -0.4 - i * 0.3));
  return {
    root: b.root, barY: 2.0,
    animate(dt, pose) {
      orb.position.y = 1.2 + Math.sin(pose.time * 2.6) * 0.14;
      orb.scale.setScalar(1 + Math.sin(pose.time * 5) * 0.06);
      trail.forEach((t, i) => { t.position.y = 1.0 + Math.sin(pose.time * 2.6 - 0.8 * (i + 1)) * 0.12; t.position.x = Math.sin(pose.time * 3 + i) * 0.12; });
    },
    dispose: () => b.dispose(),
  };
};

/** The caravan: a covered cart on two wheels, a lantern on the pole. It rolls when it walks. */
const cart: MinionLook = (_k, p) => {
  tint(p, 0xa8946a, 0x30b0b0);
  const b = builder(p);
  const wood = b.own(new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.9, flatShading: true }));
  b.add(b.root, box(1.0, 0.3, 1.5), wood, 0, 0.62, 0, { shadow: true });
  const cover = b.add(b.root, new THREE.CylinderGeometry(0.55, 0.55, 1.4, 10, 1, false, 0, pi).rotateZ(pi / 2).rotateY(pi / 2), p.body, 0, 0.78, 0, { shadow: true, outline: true });
  cover.rotation.set(0, 0, 0);
  b.add(b.root, box(1.06, 0.06, 0.08), p.trim, 0, 0.78, 0.7);
  b.add(b.root, box(1.06, 0.06, 0.08), p.trim, 0, 0.78, -0.7);
  b.add(b.root, cyl(0.03, 0.03, 1.2, 4), wood, 0, 0.6, 1.15, { rx: pi / 2 });
  b.add(b.root, sphere(0.09), p.eye, 0, 0.85, 1.7);
  const wheels = [-1, 1].map((s) => {
    const w = new THREE.Group();
    w.position.set(0.56 * s, 0.38, -0.1);
    b.add(w, new THREE.TorusGeometry(0.34, 0.05, 5, 12), p.trim, 0, 0, 0, { ry: pi / 2 });
    for (let i = 0; i < 3; i++) b.add(w, box(0.04, 0.66, 0.04), wood, 0, 0, 0, { rx: i * 1.05 });
    b.root.add(w);
    return w;
  });
  return {
    root: b.root, barY: 2.1,
    animate(dt, pose) {
      wheels.forEach((w) => { w.rotation.x += dt * 6 * pose.walk; });
      b.root.rotation.z = Math.sin(pose.time * 9) * 0.015 * pose.walk;
    },
    dispose: () => b.dispose(),
  };
};

const WILD: Record<string, MinionLook> = {
  hound, sprite, giant, stag, oak, root,
  raider: (_k, p) => wrapped(p, { body: 0xb0552e, trim: 0x30b0b0, shield: true }),
  slinger: (_k, p) => wrapped(p, { body: 0xc8a060, trim: 0x30b0b0, hood: true, sling: true }),
  wraith,
  chief: (_k, p) => wrapped(p, { body: 0x8a2e22, trim: 0xffd060, big: true, horns: true, shield: true, banner: true }),
  mother,
};
/** The look of a floor 2 or 3 enemy kind, or undefined for one of floor 1's. */
export const wildLook = (id: string): MinionLook | undefined => WILD[id];

const ESCORT: Record<string, MinionLook> = { wisp, cart };
/** The look of a led one other than the plain person. */
export const escortLook = (id: string): MinionLook => ESCORT[id] ?? wisp;
