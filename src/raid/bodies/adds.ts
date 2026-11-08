import * as THREE from 'three';
import type { MinionLook, MinionPalette } from '../../effects/parts/minion';

/**
 * The bosses' adds (src/raid/stage.ts): units of the summon system with looks of their own. Each rig faces +Z, feet at y = 0;
 * `palette.body` takes the hit flash, so the part that gets hit is made of it.
 */

/** A dark copy a little bigger than `src`, drawn from behind: the toon outline the other units have. */
function hull(src: THREE.Mesh, p: MinionPalette, k = 1.12) {
  const h = new THREE.Mesh(src.geometry, p.outline);
  h.position.copy(src.position);
  h.rotation.copy(src.rotation);
  h.scale.copy(src.scale).multiplyScalar(k);
  return h;
}

/**
 * The Sun Court's Hour Stones: one of the sundial's stones risen, a six-sided pillar with a gold band turning round it and an eye
 * that looks at you.
 */
export const hourStoneLook: MinionLook = (_kind, p) => {
  const root = new THREE.Group();
  const geos = [
    new THREE.CylinderGeometry(0.4, 0.55, 2, 6),
    new THREE.ConeGeometry(0.44, 0.55, 6),
    new THREE.TorusGeometry(0.56, 0.06, 6, 28),
    new THREE.OctahedronGeometry(0.18),
    new THREE.CylinderGeometry(0.72, 0.82, 0.2, 6),
  ];
  const glow = new THREE.MeshBasicMaterial({ color: 0xe0a24a });
  const body = new THREE.Mesh(geos[0], p.body);
  body.position.y = 1.2;
  const cap = new THREE.Mesh(geos[1], p.body);
  cap.position.y = 2.47;
  const band = new THREE.Mesh(geos[2], glow);
  band.rotation.x = Math.PI / 2;
  band.position.y = 1.6;
  const eye = new THREE.Mesh(geos[3], p.eye);
  eye.position.set(0, 1.9, 0.4);
  const base = new THREE.Mesh(geos[4], p.trim);
  base.position.y = 0.1;
  for (const m of [body, cap, base]) m.castShadow = true;
  root.add(hull(body, p), hull(cap, p), body, cap, band, eye, base);
  let time = 0;
  return {
    root,
    barY: 3.05,
    animate(dt) {
      time += dt;
      band.rotation.z += dt * 1.4;
      band.position.y = 1.6 + Math.sin(time * 2) * 0.08;
      eye.position.y = 1.9 + Math.sin(time * 2.6) * 0.04;
    },
    dispose() {
      for (const g of geos) g.dispose();
      glow.dispose();
    },
  };
};

/** The Cinder Pit's Coal Hearts: a burning heart held in shards of slag that turn round it, over a little cone of cooled lava. */
export const coalHeartLook: MinionLook = (_kind, p) => {
  const root = new THREE.Group();
  const geos = [new THREE.IcosahedronGeometry(0.52, 1), new THREE.DodecahedronGeometry(0.32), new THREE.ConeGeometry(0.85, 0.65, 7)];
  const fire = new THREE.MeshBasicMaterial({ color: 0xff6a20 });
  // Slag, darker than the summon palette goes: the heart is what shows. (The palette is this unit's own, set again for the next.)
  p.body.color.set(0x24140f);
  const heart = new THREE.Mesh(geos[0], fire);
  heart.position.y = 1.35;
  const base = new THREE.Mesh(geos[2], p.body);
  base.position.y = 0.32;
  base.castShadow = true;
  const shards = Array.from({ length: 4 }, (_, k) => {
    const s = new THREE.Mesh(geos[1], p.body);
    s.castShadow = true;
    s.rotation.set(k * 1.3, k * 0.7, 0);
    return s;
  });
  root.add(base, heart, ...shards);
  let time = 0;
  const place = () => {
    shards.forEach((s, k) => {
      const a = time * 1.1 + (k / shards.length) * Math.PI * 2;
      s.position.set(Math.sin(a) * 0.6, 1.35 + Math.sin(time * 1.7 + k) * 0.22, Math.cos(a) * 0.6);
      s.rotation.y = a;
    });
  };
  place();
  return {
    root,
    barY: 2.6,
    animate(dt) {
      time += dt;
      place();
      heart.scale.setScalar(1 + Math.sin(time * 5) * 0.07);
    },
    dispose() {
      for (const g of geos) g.dispose();
      fire.dispose();
    },
  };
};
