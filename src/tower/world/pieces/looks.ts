import * as THREE from 'three';
import type { MinionLook, MinionPalette, MinionRig } from '../../../effects/parts/minion';

/**
 * The set pieces' small things that stand in a ruler's room (a boss's adds, as `src/tower/looks.ts`' sentry is): a cannon, a root,
 * a crystal, a standard. Each rig faces +Z with its feet at y = 0 and `palette.body` takes the hit flash. Drawn in code, first
 * pass, for the artist to direct.
 */

const IRON = 0x2e2c34, WOOD = 0x6a4a2c, BRASS = 0xc9a24a;

function hull(src: THREE.Mesh, p: MinionPalette, k = 1.12) {
  const h = new THREE.Mesh(src.geometry, p.outline);
  h.position.copy(src.position);
  h.rotation.copy(src.rotation);
  h.scale.copy(src.scale).multiplyScalar(k);
  return h;
}

const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
};

/** A harbour cannon on a wooden carriage, its mouth toward +Z; it rocks back as it fires. */
export const cannonLook: MinionLook = (_kind, p) => {
  p.body.color.set(IRON);
  p.trim.color.set(WOOD);
  const root = new THREE.Group();
  const geos = [
    new THREE.CylinderGeometry(0.2, 0.3, 1.25, 10).rotateX(Math.PI / 2),
    new THREE.BoxGeometry(0.7, 0.28, 1.2),
    new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12).rotateZ(Math.PI / 2),
    new THREE.TorusGeometry(0.24, 0.035, 6, 14),
    new THREE.SphereGeometry(0.06, 6, 5),
  ];
  const barrel = mesh(geos[0], p.body, 0, 0.62, 0.1);
  barrel.rotation.x = -0.12;
  const carriage = mesh(geos[1], p.trim, 0, 0.32, 0);
  const wheels = [-0.36, 0.36].map((x) => mesh(geos[2], p.trim, x, 0.34, -0.15));
  const band = mesh(geos[3], p.trim, 0, 0.66, 0.55);
  band.rotation.x = Math.PI / 2 - 0.12;
  const eye = mesh(geos[4], p.eye, 0, 0.62, 0.74);
  root.add(barrel, hull(barrel, p), carriage, ...wheels, band, eye);
  return {
    root, barY: 1.5,
    animate(_dt, pose) {
      barrel.position.z = 0.1 - 0.25 * pose.shot;
      eye.scale.setScalar(1 + pose.shot * 1.4);
    },
    dispose() { for (const g of geos) g.dispose(); },
  } satisfies MinionRig;
};

/** A root of the Elder Tree: a knot of twisted wood rising out of the ground, a green-gold bud on it. */
export const rootLook: MinionLook = (_kind, p) => {
  p.body.color.set(0x4a3524);
  p.trim.color.set(0x7ac05a);
  const root = new THREE.Group();
  const geos = [new THREE.ConeGeometry(0.34, 1.5, 6), new THREE.ConeGeometry(0.2, 1.1, 5), new THREE.IcosahedronGeometry(0.2, 0)];
  const main = mesh(geos[0], p.body, 0, 0.75, 0);
  const side = [[-0.3, 0.45, 0.1, 0.5], [0.28, 0.4, -0.12, -0.55]].map(([x, y, z, tilt]) => {
    const m = mesh(geos[1], p.body, x, y, z);
    m.rotation.z = tilt;
    return m;
  });
  const bud = mesh(geos[2], p.trim, 0, 1.55, 0);
  root.add(main, hull(main, p), ...side, bud);
  return {
    root, barY: 2.1,
    animate(_dt, pose) {
      bud.scale.setScalar(1 + 0.15 * Math.sin(pose.time * 4) + pose.shot * 0.8);
      root.rotation.y = 0.2 * Math.sin(pose.time * 0.7);
    },
    dispose() { for (const g of geos) g.dispose(); },
  } satisfies MinionRig;
};

/** A crystal of the Prism Mother's: dark glass on a stone foot, a light inside that turns. */
export const crystalLook: MinionLook = (_kind, p) => {
  p.body.color.set(0x3a3a68);
  p.trim.color.set(0x8ad0ff);
  const root = new THREE.Group();
  const geos = [new THREE.OctahedronGeometry(0.55, 0).scale(1, 1.9, 1), new THREE.CylinderGeometry(0.5, 0.62, 0.3, 7), new THREE.OctahedronGeometry(0.2, 0)];
  const foot = mesh(geos[1], p.trim, 0, 0.15, 0);
  const shard = mesh(geos[0], p.body, 0, 1.3, 0);
  const core = mesh(geos[2], p.eye, 0, 1.3, 0);
  root.add(foot, shard, hull(shard, p, 1.1), core);
  return {
    root, barY: 2.6,
    animate(_dt, pose) {
      shard.rotation.y = pose.time * 0.8;
      core.scale.setScalar(1 + 0.25 * Math.sin(pose.time * 5) + pose.shot);
    },
    dispose() { for (const g of geos) g.dispose(); },
  } satisfies MinionRig;
};

/** A war standard: a pole and a banner in the palette's colour, a gold spearhead. */
export const standardLook: MinionLook = (_kind, p) => {
  p.body.color.set(0x8a2a2a);
  p.trim.color.set(BRASS);
  const root = new THREE.Group();
  const geos = [new THREE.CylinderGeometry(0.05, 0.06, 2.3, 6), new THREE.BoxGeometry(0.8, 0.9, 0.04), new THREE.ConeGeometry(0.09, 0.3, 5), new THREE.CylinderGeometry(0.3, 0.4, 0.2, 7)];
  const pole = mesh(geos[0], p.trim, 0, 1.15, 0);
  const cloth = mesh(geos[1], p.body, 0.42, 1.75, 0);
  const tip = mesh(geos[2], p.trim, 0, 2.45, 0);
  const foot = mesh(geos[3], p.trim, 0, 0.1, 0);
  root.add(pole, cloth, hull(cloth, p, 1.08), tip, foot);
  return {
    root, barY: 2.9,
    animate(_dt, pose) {
      cloth.rotation.y = 0.25 * Math.sin(pose.time * 2.6);
      cloth.scale.x = 1 + 0.06 * Math.sin(pose.time * 5);
    },
    dispose() { for (const g of geos) g.dispose(); },
  } satisfies MinionRig;
};

export const SENTRY_LOOKS = { cannon: cannonLook, root: rootLook, crystal: crystalLook, standard: standardLook } as const;
