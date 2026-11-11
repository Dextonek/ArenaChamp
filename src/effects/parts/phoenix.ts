import * as THREE from 'three';

/**
 * Phoenix kit parts (Anka, the Firebird; pipeline/designs/kit-phoenix.md). Her signature shape is the long feather with an
 * eye near its tip: a gold shaft, an ember-red vane, a small teal eye. Fire here is feathers and gold, never slag or smoke
 * (that is Brannoc's): no black, no iron, a pale ash foil under every flame.
 *
 * PLACEHOLDERS (gate 4, first step): the looks below are plain discs, rings and cones, enough to prove the rules in a fight.
 * They keep their names and their sizes when they are drawn properly.
 */
export const PHOENIX = {
  core: 0xfff6d8, hot: 0xffc24a, body: 0xff7b3a, red: 0xc23a22, deep: 0x4c1410, gold: 0xe0a935, teal: 0x2fb8a8, ash: 0xeadcc4, dark: 0x1a0806,
};
export const PHOENIX_CSS = {
  core: '#fff6d8', hot: '#ffc24a', body: '#ff7b3a', red: '#c23a22', deep: '#4c1410', gold: '#e0a935', teal: '#2fb8a8', ash: '#eadcc4', dark: '#1a0806',
};

const flat = (m: THREE.Material) => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };

export function disc(r: number, color: number, opacity: number, y = 0.02, order = 2): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), flat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
  o.position.y = y;
  o.renderOrder = order;
  return o;
}

export function ring(r: number, color: number, opacity: number, y = 0.03, width = 0.05, order = 3): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.RingGeometry(r - width, r, 56).rotateX(-Math.PI / 2), flat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
  o.position.y = y;
  o.renderOrder = order;
  return o;
}

/** A feather standing in the floor, `h` tall: a vane, a gold shaft, a teal eye. */
export function quill(h = 1, color = PHOENIX.red): THREE.Group {
  const g = new THREE.Group();
  const vane = new THREE.Mesh(new THREE.ConeGeometry(0.16 * h, h, 6), new THREE.MeshBasicMaterial({ color }));
  vane.scale.z = 0.3;
  vane.position.y = h / 2;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * h, 0.018 * h, h * 1.05, 5), new THREE.MeshBasicMaterial({ color: PHOENIX.gold }));
  shaft.position.y = h * 0.52;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06 * h, 8, 6), new THREE.MeshBasicMaterial({ color: PHOENIX.teal }));
  eye.position.set(0, h * 0.32, 0.03 * h);
  g.add(vane, shaft, eye);
  g.rotation.z = 0.25;
  return g;
}

/** An ember on the floor: a feather in a small glow, the ring an enemy must stand in to stamp it out (`stampR`). */
export function emberLook(stampR: number): THREE.Object3D {
  const g = new THREE.Group();
  g.add(disc(0.55, PHOENIX.body, 0.35), ring(stampR, PHOENIX.ash, 0.5), quill(0.9));
  return g;
}

/** The nest: the newest ember, with a crown of flame so both players know which one her life hangs on. */
export function nestLook(stampR: number): THREE.Object3D {
  const g = new THREE.Group();
  g.add(disc(0.7, PHOENIX.hot, 0.45), ring(stampR, PHOENIX.gold, 0.85, 0.03, 0.07), quill(1.1));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 5), new THREE.MeshBasicMaterial({ color: i % 2 ? PHOENIX.hot : PHOENIX.body }));
    f.position.set(Math.sin(a) * 0.42, 0.21, Math.cos(a) * 0.42);
    g.add(f);
  }
  return g;
}

/** The egg she rises from: it glows at the nest while she is ash, inside the ring her rising flare will fill (`flareR`). */
export function eggLook(flareR: number): THREE.Object3D {
  const g = new THREE.Group();
  g.add(disc(flareR, PHOENIX.body, 0.22), ring(flareR, PHOENIX.hot, 0.9, 0.04, 0.08));
  const egg = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: PHOENIX.hot }));
  egg.scale.set(0.8, 1.15, 0.8);
  egg.position.y = 0.6;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 12), new THREE.MeshBasicMaterial({ color: PHOENIX.ash, transparent: true, opacity: 0.45 }));
  shell.scale.copy(egg.scale);
  shell.position.y = 0.6;
  g.add(egg, shell);
  return g;
}

/** The pile of ash where she fell. */
export function ashesLook(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(disc(0.7, PHOENIX.ash, 0.55));
  const pile = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 10), new THREE.MeshBasicMaterial({ color: PHOENIX.ash }));
  pile.position.y = 0.15;
  g.add(pile);
  return g;
}

/** An ember that went out: stamped (a pale puff) or burnt (a ring of small flames). */
export function emberPuffLook(burnt: boolean): THREE.Object3D {
  const g = new THREE.Group();
  g.add(disc(0.8, burnt ? PHOENIX.hot : PHOENIX.ash, 0.5));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.4), new THREE.MeshBasicMaterial({ color: burnt ? PHOENIX.body : PHOENIX.ash }));
    f.position.set(Math.sin(a) * 0.6, 0.1, Math.cos(a) * 0.6);
    f.rotation.y = a;
    g.add(f);
  }
  return g;
}
