import * as THREE from 'three';
import type { MinionLook } from '../../effects/parts/minion';

/**
 * The Eclipse Wyrm's stage add (Shadows Stand): a Cast shade, a piece of the wyrm's shadow risen. A hunched, faceless figure about 2 m
 * tall of matte near-black angular pieces, violet membranes on its shoulders and one pale gold eye. Faces +Z, feet at y = 0.
 * `palette.body` takes the hit flash, so the main body is made of it; the eye is `palette.eye`.
 */
export const castShadeLook: MinionLook = (_kind, p) => {
  const root = new THREE.Group();
  const geos = [
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.OctahedronGeometry(0.3, 0),
    new THREE.TetrahedronGeometry(0.42, 0),
    new THREE.CylinderGeometry(0.1, 0.16, 0.9, 5),
    new THREE.BoxGeometry(0.62, 0.05, 0.5),
    new THREE.OctahedronGeometry(0.12, 0),
    new THREE.ConeGeometry(0.2, 0.55, 5),
  ];
  // Matte near-black, set again for each unit (the palette is this unit's own), and the eye a pale gold.
  p.body.color.set(0x0c0a14);
  p.eye.color.set(0xf2dc9a);
  const membrane = new THREE.MeshStandardMaterial({ color: 0x6a49c8, roughness: 0.8, metalness: 0, side: THREE.DoubleSide, emissive: 0x6a49c8, emissiveIntensity: 0.12 });
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    return o;
  };
  // Hunched: a chest tipped forward over narrow hips, the head a bare wedge with no face but the eye.
  const hips = mesh(geos[1], p.body, 0, 0.85, -0.05, 1.1, 1.3, 0.9);
  const chest = mesh(geos[0], p.body, 0, 1.3, 0.08, 1.0, 0.95, 0.85);
  chest.rotation.x = 0.3;
  const head = mesh(geos[2], p.body, 0, 1.78, 0.34, 0.8, 0.9, 1.0);
  head.rotation.x = 0.6;
  const eye = mesh(geos[5], p.eye, 0, 1.76, 0.6);
  const spine = mesh(geos[6], p.body, 0, 1.55, -0.38, 1, 1, 1);
  spine.rotation.x = -1.1;
  const legL = mesh(geos[3], p.body, 0.22, 0.45, 0, 1, 1, 1);
  const legR = mesh(geos[3], p.body, -0.22, 0.45, 0, 1, 1, 1);
  const footL = mesh(geos[2], p.body, 0.22, 0.1, 0.12, 0.6, 0.35, 0.9);
  const footR = mesh(geos[2], p.body, -0.22, 0.1, 0.12, 0.6, 0.35, 0.9);
  const armL = mesh(geos[3], p.body, 0.62, 1.0, 0.25, 0.9, 1.35, 0.9);
  const armR = mesh(geos[3], p.body, -0.62, 1.0, 0.25, 0.9, 1.35, 0.9);
  armL.rotation.set(-0.3, 0, -0.2);
  armR.rotation.set(-0.3, 0, 0.2);
  // The membrane shoulders: thin violet sheets spread over the shoulder like a torn cloak.
  const shL = mesh(geos[4], membrane, 0.62, 1.6, -0.02, 1.1, 1, 1.2);
  const shR = mesh(geos[4], membrane, -0.62, 1.6, -0.02, 1.1, 1, 1.2);
  shL.rotation.z = -0.5;
  shR.rotation.z = 0.5;
  for (const m of [shL, shR]) m.castShadow = false;
  root.add(hips, chest, head, eye, spine, legL, legR, footL, footR, armL, armR, shL, shR);
  let time = 0;
  return {
    root,
    barY: 2.55,
    animate(dt) {
      time += dt;
      const sway = Math.sin(time * 1.6);
      chest.position.y = 1.3 + sway * 0.03;
      head.position.y = 1.78 + sway * 0.04;
      eye.position.y = 1.76 + sway * 0.04;
      shL.rotation.z = -0.5 - Math.sin(time * 2.2) * 0.12;
      shR.rotation.z = 0.5 + Math.sin(time * 2.2 + 1) * 0.12;
      armL.rotation.x = -0.3 + Math.sin(time * 1.3) * 0.08;
      armR.rotation.x = -0.3 - Math.sin(time * 1.3) * 0.08;
      eye.scale.setScalar(1 + Math.sin(time * 3.4) * 0.15);
    },
    dispose() {
      for (const g of geos) g.dispose();
      membrane.dispose();
    },
  };
};
