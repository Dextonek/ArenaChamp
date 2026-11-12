import * as THREE from 'three';
import type { MinionLook, MinionPalette } from '../effects/parts/minion';

/**
 * The Tower's own small enemies, as looks of the summon system's units (as the bosses' adds are, src/raid/bodies/adds.ts): each
 * rig faces +Z with its feet at y = 0, and `palette.body` takes the hit flash. Dark stone, gold on the edges, a lantern's flame
 * as the only light: the room's own style, drawn in code, first pass for the artist to direct.
 */

const STONE = 0x2b2a33, GOLD = 0xc9a24a;

/** A dark copy a little bigger than `src`, drawn from behind: the outline the other units have. */
function hull(src: THREE.Mesh, p: MinionPalette, k = 1.12) {
  const h = new THREE.Mesh(src.geometry, p.outline);
  h.position.copy(src.position);
  h.rotation.copy(src.rotation);
  h.scale.copy(src.scale).multiplyScalar(k);
  return h;
}

function tones(p: MinionPalette) {
  // The palette is this unit's own, set again for the next one.
  p.body.color.set(STONE);
  p.trim.color.set(GOLD);
  p.trim.metalness = 0.7;
  p.trim.roughness = 0.45;
}

/**
 * A stair keeper: a hooded figure of stone that glides, a gold collar, a gold mask with no face. One that fights up close carries
 * a long blade and swings it; one that shoots carries a lantern on a staff, and the lantern flares as its bolt leaves.
 */
export const keeperLook: MinionLook = (kind, p) => {
  tones(p);
  const root = new THREE.Group();
  const geos = [
    new THREE.CylinderGeometry(0.14, 0.4, 1.0, 7),
    new THREE.ConeGeometry(0.34, 0.42, 7),
    new THREE.IcosahedronGeometry(0.17, 0),
    new THREE.TorusGeometry(0.2, 0.035, 6, 18),
    new THREE.BoxGeometry(0.16, 0.2, 0.03),
    new THREE.BoxGeometry(0.05, 0.05, 0.95),
    new THREE.CylinderGeometry(0.02, 0.02, 1.25, 5),
    new THREE.OctahedronGeometry(0.11),
  ];
  const robe = new THREE.Mesh(geos[0], p.body);
  robe.position.y = 0.55;
  const mantle = new THREE.Mesh(geos[1], p.body);
  mantle.position.y = 1.08;
  const head = new THREE.Mesh(geos[2], p.body);
  head.position.y = 1.3;
  const collar = new THREE.Mesh(geos[3], p.trim);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.05;
  const mask = new THREE.Mesh(geos[4], p.trim);
  mask.position.set(0, 1.3, 0.15);
  for (const m of [robe, mantle, head]) m.castShadow = true;
  const arm = new THREE.Group();
  arm.position.set(0.3, 0.95, 0.05);
  let flame: THREE.Mesh | null = null;
  if (kind === 'melee') {
    const blade = new THREE.Mesh(geos[5], p.trim);
    blade.position.set(0, 0, 0.45);
    arm.add(blade);
  } else {
    const staff = new THREE.Mesh(geos[6], p.trim);
    staff.position.y = 0.1;
    flame = new THREE.Mesh(geos[7], p.eye);
    flame.position.y = 0.82;
    arm.add(staff, flame);
  }
  root.add(hull(robe, p), hull(mantle, p), hull(head, p, 1.2), robe, mantle, head, collar, mask, arm);
  let phase = Math.random() * 6;
  return {
    root,
    barY: 1.75,
    animate(dt, pose) {
      phase += dt * (2.4 + 3 * pose.walk);
      // It glides: a slow rise and fall, and a lean into its walk.
      root.position.y = 0.06 + Math.sin(phase) * 0.04;
      let lean = 0.1 * pose.walk, swing = 0;
      if (pose.swing >= 0) {
        const s = pose.swing;
        swing = s < 0.6 ? -1.5 * (s / 0.6) : -1.5 + ((s - 0.6) / 0.4) * 2.5;
        lean = s < 0.6 ? -0.12 * (s / 0.6) : -0.12 + ((s - 0.6) / 0.4) * 0.5;
      }
      arm.rotation.x = swing;
      root.rotation.x = lean;
      if (flame) flame.scale.setScalar(1 + pose.shot * 0.9 + Math.sin(pose.time * 5) * 0.1);
    },
    dispose() {
      for (const g of geos) g.dispose();
    },
  };
};

/**
 * A sentry: a brazier on a slim stone post, its flame held in a gold cage that turns. The turrets round a crystal and the wards
 * of a warded echo are these. It never moves; the floor's own moves do its shooting.
 */
export const sentryLook: MinionLook = (_kind, p) => {
  tones(p);
  const root = new THREE.Group();
  const geos = [
    new THREE.CylinderGeometry(0.5, 0.62, 0.22, 8),
    new THREE.CylinderGeometry(0.16, 0.26, 1.5, 6),
    new THREE.CylinderGeometry(0.42, 0.2, 0.3, 8),
    new THREE.TorusGeometry(0.4, 0.035, 6, 22),
    new THREE.OctahedronGeometry(0.24),
  ];
  const base = new THREE.Mesh(geos[0], p.trim);
  base.position.y = 0.11;
  const post = new THREE.Mesh(geos[1], p.body);
  post.position.y = 0.95;
  const bowl = new THREE.Mesh(geos[2], p.body);
  bowl.position.y = 1.82;
  const rings = [0, 1].map((k) => {
    const r = new THREE.Mesh(geos[3], p.trim);
    r.position.y = 2.2;
    r.rotation.x = k ? 0.5 : Math.PI / 2;
    return r;
  });
  const flame = new THREE.Mesh(geos[4], p.eye);
  flame.position.y = 2.2;
  for (const m of [post, bowl, base]) m.castShadow = true;
  root.add(hull(post, p), hull(bowl, p), post, bowl, base, ...rings, flame);
  let time = 0;
  return {
    root,
    barY: 2.95,
    animate(dt) {
      time += dt;
      rings[0].rotation.z += dt * 1.2;
      rings[1].rotation.y += dt * 1.7;
      flame.scale.setScalar(1 + Math.sin(time * 4.2) * 0.12);
      flame.rotation.y += dt * 2;
    },
    dispose() {
      for (const g of geos) g.dispose();
    },
  };
};
