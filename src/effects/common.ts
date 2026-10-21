import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared building blocks for set-piece effects: weapon meshes, the enemy dummy and the ground. */

export const smoothstep = (x: number) => {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Merges parts into one geometry (mergeGeometries needs matching attributes and indexing). */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = parts.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.clearGroups();
    return ng;
  });
  const merged = mergeGeometries(prepared, false)!;
  merged.computeVertexNormals();
  return merged;
}

/** A unit sword (about 1 long) with its tip at the origin, pointing down -Y. */
export function createSwordGeometry(): THREE.BufferGeometry {
  const bladeLen = 0.72, tipLen = 0.14, w = 0.09;
  const profile = new THREE.Shape();
  profile.moveTo(0, 0);
  profile.lineTo(w / 2, tipLen);
  profile.lineTo(w / 2, bladeLen);
  profile.lineTo(-w / 2, bladeLen);
  profile.lineTo(-w / 2, tipLen);
  profile.closePath();
  const blade = new THREE.ExtrudeGeometry(profile, {
    depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 1,
  });
  blade.translate(0, 0, -0.006);

  const guard = new THREE.BoxGeometry(0.3, 0.035, 0.05).translate(0, bladeLen + 0.02, 0);
  const grip = new THREE.CylinderGeometry(0.018, 0.022, 0.2, 8).translate(0, bladeLen + 0.14, 0);
  const pommel = new THREE.SphereGeometry(0.035, 10, 8).translate(0, bladeLen + 0.26, 0);
  return mergeParts([blade, guard, grip, pommel]);
}

/** A unit spear (about 1.3 long) with its tip at the origin, pointing down -Y. */
export function createSpearGeometry(): THREE.BufferGeometry {
  const head = new THREE.ConeGeometry(0.05, 0.2, 4).rotateX(Math.PI).translate(0, 0.1, 0);
  const collar = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8).translate(0, 0.22, 0);
  const shaft = new THREE.CylinderGeometry(0.015, 0.015, 1.05, 6).translate(0, 0.765, 0);
  const butt = new THREE.SphereGeometry(0.025, 8, 6).translate(0, 1.3, 0);
  return mergeParts([head, collar, shaft, butt]);
}

/** A large dark ground disc. */
export function createGround(radius = 60): THREE.Mesh {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  return ground;
}

/** A simple horned target dummy standing at its group's origin (about 2.3 tall). */
export class Enemy {
  readonly group = new THREE.Group();
  readonly material = new THREE.MeshStandardMaterial({ color: 0x5a1820, roughness: 0.6, emissive: 0x000000 });

  constructor() {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.1, 6, 16), this.material);
    body.position.y = 1.1;
    const hornGeo = new THREE.ConeGeometry(0.12, 0.5, 8);
    const hornL = new THREE.Mesh(hornGeo, this.material);
    hornL.position.set(-0.3, 2.05, 0); hornL.rotation.z = 0.4;
    const hornR = new THREE.Mesh(hornGeo, this.material);
    hornR.position.set(0.3, 2.05, 0); hornR.rotation.z = -0.4;
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 0.2, 0.15) });
    const eyeGeo = new THREE.SphereGeometry(0.07, 8, 6);
    for (const x of [-0.18, 0.18]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, 1.55, 0.5);
      this.group.add(eye);
    }
    this.group.add(body, hornL, hornR);
  }

  /** Back to a whole, unlit enemy. */
  reset() {
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.group.rotation.set(0, 0, 0);
    this.material.emissive.setRGB(0, 0, 0);
  }

  /** White-hot hit flash, 0 = none, 1 = full. */
  setFlash(v: number) {
    const f = Math.max(0, v);
    this.material.emissive.setRGB(6 * f, 5 * f, 4 * f);
  }

  /** 0 = standing, 1 = flattened and hidden. */
  setCrush(v: number) {
    const squash = 1 - THREE.MathUtils.clamp(v, 0, 1);
    this.group.scale.set(1 + (1 - squash) * 0.6, Math.max(squash, 0.001), 1 + (1 - squash) * 0.6);
    this.group.visible = squash > 0.01;
  }
}
