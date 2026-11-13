import * as THREE from 'three';
import type { MinionLook, MinionPalette } from '../../effects/parts/minion';
import type { EnemySpec } from './def';
import { EXTRA_LOOKS } from './f45/looks';

/**
 * The harbour's drowned, as looks of the summon system's units (as the keepers' are, src/tower/looks.ts): each rig faces +Z with its
 * feet at y = 0 and `palette.body` takes the hit flash. Green-black cloth and weed, brass for what they carried, a cold pale light
 * for the eyes: against the quay's grey they are told apart at a glance from the game camera (the keepers are black and gold).
 * Drawn in code, first pass for the artist to direct.
 */

function hull(src: THREE.Mesh, p: MinionPalette, k = 1.12) {
  const h = new THREE.Mesh(src.geometry, p.outline);
  h.position.copy(src.position);
  h.rotation.copy(src.rotation);
  h.scale.copy(src.scale).multiplyScalar(k);
  return h;
}

function tint(p: MinionPalette, body: number, trim: number) {
  p.body.color.set(body);
  p.trim.color.set(trim);
  p.trim.metalness = 0.5;
  p.trim.roughness = 0.5;
}

/** A hunched drowned man: the docker, its caster (a net on a pole) and its bigger kin, the mate and Old Barnacle. */
function drowned(kind: string, p: MinionPalette, o: { body: number; trim: number; big?: boolean; weed?: boolean; coat?: boolean; barnacles?: boolean; net?: boolean }) {
  tint(p, o.body, o.trim);
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(geo: T) => { geos.push(geo); return geo; };
  const lower = new THREE.Mesh(g(new THREE.CylinderGeometry(0.2, 0.34, 0.8, 7)), p.body);
  lower.position.y = 0.4;
  const torso = new THREE.Mesh(g(new THREE.CylinderGeometry(0.34, 0.24, 0.62, 7)), p.body);
  torso.position.set(0, 1.05, 0.06);
  torso.rotation.x = 0.28;
  const head = new THREE.Mesh(g(new THREE.IcosahedronGeometry(0.2, 0)), p.body);
  head.position.set(0, 1.5, 0.2);
  const eyes = new THREE.Mesh(g(new THREE.BoxGeometry(0.2, 0.05, 0.03)), p.eye);
  eyes.position.set(0, 1.52, 0.38);
  const band = new THREE.Mesh(g(new THREE.TorusGeometry(0.3, 0.035, 5, 14)), p.trim);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.82;
  const parts: THREE.Object3D[] = [hull(lower, p), hull(torso, p), hull(head, p, 1.2), lower, torso, head, eyes, band];
  for (const m of [lower, torso, head]) m.castShadow = true;
  if (o.weed) {
    // Weed hangs from the shoulders and the head.
    for (const [x, y, rz] of [[-0.3, 1.2, 0.3], [0.3, 1.25, -0.3], [-0.12, 1.62, 0.2], [0.14, 1.6, -0.25]] as const) {
      const w = new THREE.Mesh(g(new THREE.ConeGeometry(0.05, 0.5, 4)), p.trim);
      w.position.set(x, y - 0.2, 0.1);
      w.rotation.z = rz;
      w.scale.y = -1;
      w.material = p.trim;
      parts.push(w);
    }
  }
  if (o.coat) {
    // A captain's coat: a broad collar and brass epaulettes.
    for (const s of [-1, 1]) {
      const ep = new THREE.Mesh(g(new THREE.BoxGeometry(0.28, 0.08, 0.2)), p.trim);
      ep.position.set(0.34 * s, 1.33, 0.05);
      parts.push(ep);
    }
    const coat = new THREE.Mesh(g(new THREE.ConeGeometry(0.46, 0.8, 7)), p.body);
    coat.position.set(0, 0.55, 0);
    coat.castShadow = true;
    parts.push(hull(coat, p), coat);
  }
  if (o.barnacles) {
    const rnd = (i: number) => Math.sin(i * 12.9898) * 43758.5453 % 1;
    for (let i = 0; i < 16; i++) {
      const b = new THREE.Mesh(g(new THREE.ConeGeometry(0.07 + Math.abs(rnd(i)) * 0.05, 0.2, 5)), p.trim);
      const a = i * 2.4, y = 0.7 + (i % 5) * 0.18;
      b.position.set(Math.cos(a) * 0.3, y, Math.sin(a) * 0.3 + 0.05);
      b.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      parts.push(b);
    }
  }
  const melee = kind !== 'ranged';
  const arm = new THREE.Group();
  arm.position.set(0.34, 1.05, 0.1);
  let ring: THREE.Mesh | null = null;
  if (melee) {
    const shaft = new THREE.Mesh(g(new THREE.CylinderGeometry(0.03, 0.03, o.big ? 1.5 : 1.15, 5)), p.trim);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.4;
    const hook = new THREE.Mesh(g(new THREE.TorusGeometry(0.17, 0.035, 5, 10, Math.PI * 1.3)), p.trim);
    hook.position.set(0, 0.0, o.big ? 1.18 : 0.95);
    arm.add(shaft, hook);
  } else {
    const pole = new THREE.Mesh(g(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 5)), p.trim);
    pole.position.y = 0.25;
    ring = new THREE.Mesh(g(new THREE.TorusGeometry(0.3, 0.025, 5, 16)), p.eye);
    ring.position.y = 1.0;
    const mesh = new THREE.Mesh(g(new THREE.CircleGeometry(0.28, 10)), new THREE.MeshBasicMaterial({ color: 0xbfe8d0, transparent: true, opacity: 0.25, side: THREE.DoubleSide, wireframe: true }));
    mesh.position.y = 1.0;
    arm.add(pole, ring, mesh);
    const extra = mesh.material as THREE.Material;
    root.userData.extra = extra;
  }
  root.add(...parts, arm);
  const scale = o.big ? 1 : 0.92;
  root.scale.setScalar(scale);
  let phase = Math.random() * 6;
  return {
    root,
    barY: (o.big ? 1.95 : 1.75) * scale,
    animate(dt: number, pose: { walk: number; swing: number; shot: number; time: number }) {
      phase += dt * (2 + 4 * pose.walk);
      // A shambling roll: the whole body sways side to side as it walks.
      root.position.y = 0.04 + Math.abs(Math.sin(phase)) * 0.05 * (0.4 + pose.walk);
      root.rotation.z = Math.sin(phase) * 0.06 * pose.walk;
      let lean = 0.14 + 0.06 * pose.walk, swing = 0;
      if (pose.swing >= 0) {
        const s = pose.swing;
        swing = s < 0.6 ? -1.6 * (s / 0.6) : -1.6 + ((s - 0.6) / 0.4) * 2.6;
        lean = s < 0.6 ? -0.1 * (s / 0.6) : -0.1 + ((s - 0.6) / 0.4) * 0.6;
      }
      arm.rotation.x = swing;
      root.rotation.x = lean;
      if (ring) {
        ring.rotation.z += dt * 2;
        ring.scale.setScalar(1 + pose.shot * 0.7);
      }
    },
    dispose() {
      for (const x of geos) x.dispose();
      (root.userData.extra as THREE.Material | undefined)?.dispose();
    },
  };
}

/** A brine crab: a wide armoured shell low to the ground, two big claws, eight legs. Slow, and it reads as a crab from above. */
const crabLook: MinionLook = (_kind, p) => {
  tint(p, 0xb4472f, 0xf0c890);
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(geo: T) => { geos.push(geo); return geo; };
  const shell = new THREE.Mesh(g(new THREE.SphereGeometry(0.62, 10, 6)), p.body);
  shell.scale.set(1.25, 0.55, 1);
  shell.position.y = 0.5;
  shell.castShadow = true;
  const ridge = new THREE.Mesh(g(new THREE.TorusGeometry(0.62, 0.05, 5, 16)), p.trim);
  ridge.rotation.x = Math.PI / 2;
  ridge.scale.set(1.25, 1, 1);
  ridge.position.y = 0.5;
  const eyeL = new THREE.Mesh(g(new THREE.SphereGeometry(0.07, 6, 5)), p.eye);
  eyeL.position.set(-0.22, 0.85, 0.5);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.22;
  root.add(hull(shell, p, 1.1), shell, ridge, eyeL, eyeR);
  const claws: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const c = new THREE.Group();
    c.position.set(0.85 * s, 0.5, 0.45);
    const arm = new THREE.Mesh(g(new THREE.BoxGeometry(0.14, 0.14, 0.5)), p.body);
    arm.position.z = 0.2;
    const pinchA = new THREE.Mesh(g(new THREE.ConeGeometry(0.17, 0.5, 5)), p.trim);
    pinchA.rotation.x = Math.PI / 2;
    pinchA.position.set(-0.07 * s, 0, 0.62);
    const pinchB = pinchA.clone();
    pinchB.position.x = 0.09 * s;
    c.add(arm, pinchA, pinchB);
    root.add(c);
    claws.push(c);
  }
  const legs: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const s = i < 4 ? -1 : 1, k = i % 4;
    const leg = new THREE.Mesh(g(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 4)), p.body);
    leg.position.set(0.6 * s, 0.25, -0.35 + k * 0.28);
    leg.rotation.z = 0.9 * s;
    root.add(leg);
    legs.push(leg);
  }
  let phase = Math.random() * 6;
  return {
    root,
    barY: 1.25,
    animate(dt, pose) {
      phase += dt * (3 + 8 * pose.walk);
      legs.forEach((l, i) => { l.rotation.x = Math.sin(phase + i * 1.3) * 0.35 * (0.3 + pose.walk); });
      root.position.y = 0.02;
      let snap = 0;
      if (pose.swing >= 0) snap = pose.swing < 0.6 ? pose.swing / 0.6 : 1 - (pose.swing - 0.6) / 0.4;
      claws.forEach((c, i) => { c.rotation.y = (i ? -1 : 1) * (0.25 - snap * 0.7); c.rotation.x = -snap * 0.5; });
    },
    dispose() { for (const x of geos) x.dispose(); },
  };
};

const LOOKS: Record<EnemySpec['look'], MinionLook> = {
  docker: (k, p) => drowned(k, p, { body: 0x3d7a68, trim: 0xe0cf8a, weed: true }),
  netter: (k, p) => drowned(k, p, { body: 0x5a8a4e, trim: 0xc8f0d0, weed: true, net: true }),
  crab: crabLook,
  mate: (k, p) => drowned(k, p, { body: 0x2c3f7a, trim: 0xffd060, big: true, coat: true }),
  barnacle: (k, p) => drowned(k, p, { body: 0x5a6a3a, trim: 0xf0ead0, big: true, weed: true, barnacles: true }),
};
export const lookOf = (spec: EnemySpec): MinionLook => EXTRA_LOOKS[spec.look as string] ?? LOOKS[spec.look];

/** A small plain figure for someone who is led (Tam the net-mender): a coat, a cap, a net over the shoulder. */
export const personLook = (colour = 0x9a7a4a): MinionLook => (_kind, p) => {
  tint(p, colour, 0xe8d8a8);
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(geo: T) => { geos.push(geo); return geo; };
  const body = new THREE.Mesh(g(new THREE.CylinderGeometry(0.2, 0.32, 1.0, 8)), p.body);
  body.position.y = 0.55;
  const head = new THREE.Mesh(g(new THREE.SphereGeometry(0.19, 8, 6)), p.trim);
  head.position.y = 1.28;
  const cap = new THREE.Mesh(g(new THREE.ConeGeometry(0.21, 0.22, 8)), p.body);
  cap.position.y = 1.48;
  const net = new THREE.Mesh(g(new THREE.TorusGeometry(0.28, 0.025, 4, 12)), p.trim);
  net.position.set(0.22, 1.0, 0);
  net.rotation.y = Math.PI / 2;
  for (const m of [body, head, cap]) m.castShadow = true;
  root.add(body, head, cap, net);
  let phase = 0;
  return {
    root,
    barY: 1.8,
    animate(dt, pose) {
      phase += dt * (3 + 5 * pose.walk);
      root.position.y = Math.abs(Math.sin(phase)) * 0.05 * pose.walk;
      root.rotation.z = Math.sin(phase) * 0.05 * pose.walk;
    },
    dispose() { for (const x of geos) x.dispose(); },
  };
};
