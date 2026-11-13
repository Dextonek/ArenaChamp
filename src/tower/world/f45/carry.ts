import * as THREE from 'three';

/**
 * What a carried thing looks like, by its item's name (`quests.ts` asks here before it draws the key): floor 4's great shard and floor 5's
 * white cloth. Null for any other item. The mesh is floating above the hero and lying where a thing waits, so it is lit (basic material).
 */
export function carryMesh(item: string): THREE.Group | null {
  const group = new THREE.Group();
  if (item === 'shard') {
    const core = new THREE.MeshBasicMaterial({ color: 0x9af0ff });
    const body = new THREE.MeshStandardMaterial({ color: 0x6a48b8, emissive: 0x6a50e0, emissiveIntensity: 1.0, roughness: 0.3, flatShading: true });
    const big = new THREE.Mesh(new THREE.OctahedronGeometry(0.34).scale(0.7, 1.7, 0.7), body);
    const a = new THREE.Mesh(new THREE.OctahedronGeometry(0.17).scale(0.7, 1.6, 0.7), core), b = a.clone();
    a.position.set(0.26, -0.18, 0.05);
    a.rotation.z = -0.5;
    b.position.set(-0.24, -0.22, 0);
    b.rotation.z = 0.5;
    group.add(big, a, b);
    group.scale.setScalar(1.3);
    group.userData.own = [big.geometry, a.geometry, body, core];
    return group;
  }
  if (item === 'cloth') {
    const pole = new THREE.MeshStandardMaterial({ color: 0x8a6a40 });
    const cloth = new THREE.MeshBasicMaterial({ color: 0xf4f0e4, side: THREE.DoubleSide });
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5), pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), cloth);
    flag.position.set(0.36, 0.38, 0);
    group.add(staff, flag);
    group.scale.setScalar(1.3);
    return group;
  }
  return null;
}
