import * as THREE from 'three';

/**
 * The Climb's props in detail, for every chapter (2026-11-19, the user: "make it more details", the floors' props, then "Yes, all
 * chapters"; the Sea's were first, in zone.ts). Each builder makes one prop round (0, 0), its front towards +z, through `P(role, geo)`:
 * the chapter maps each role to a material of its own (no new material: a chapter's props are merged per material, or by vertex
 * colour, per square of ground). Variety comes from `v`, a number from the prop's place (`hv`), never from the zone's random stream, so
 * nothing else on a floor moves.
 */
export type Role =
  | 'wood' | 'dark' | 'plank' | 'stone' | 'rock' | 'metal' | 'gold' | 'cloth' | 'accent' | 'accent2' | 'catch' | 'clay' | 'rope' | 'flame' | 'ash';
export type Put = (role: Role, geo: THREE.BufferGeometry) => void;

/** A number in [0, 1) from a place (and a salt `k`). */
export const hv = (x: number, z: number, k = 0) => { const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const cyl = (r0: number, r1: number, h: number, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n).translate(0, h / 2, 0);
const ico = (sx: number, sy: number, sz: number) => new THREE.IcosahedronGeometry(1, 0).scale(sx, sy, sz);
const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => { const g = new THREE.BufferGeometry().setFromPoints([a, b, c]); g.computeVertexNormals(); return g; };
/** A thin rod from a to b (local). */
const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
  const d = new THREE.Vector3().subVectors(b, a), l = d.length();
  const g = new THREE.CylinderGeometry(r, r, l, 4).translate(0, l / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  return g.translate(a.x, a.y, a.z);
};

/** A camp fire: a ring of stones round the ash, a tepee of logs, the flame, a tripod with its kettle on a chain. */
export function campFire(P: Put, r: number, v: number) {
  P('ash', cyl(r * 0.78, r * 0.82, 0.06, 12));
  for (let k = 0; k < 11; k++) { const a = (k / 11) * Math.PI * 2, rr = r * 0.88; P('rock', ico(0.2 + ((v * 7 + k * 0.37) % 1) * 0.08, 0.15, 0.18).rotateY(a).translate(Math.sin(a) * rr, 0.1, Math.cos(a) * rr)); }
  for (const a of [0.3, 2.4, 4.5]) P('dark', new THREE.CylinderGeometry(0.07, 0.09, 1.0, 5).translate(0, 0.5, 0).rotateX(0.62).rotateY(a).translate(Math.sin(a) * 0.32, 0.02, Math.cos(a) * 0.32));
  P('flame', new THREE.ConeGeometry(0.3, 0.8, 6).translate(0, 0.5, 0));
  P('flame', new THREE.ConeGeometry(0.16, 0.5, 5).translate(0.14, 0.36, -0.08));
  for (const a of [0, 2.1, 4.2]) P('metal', new THREE.CylinderGeometry(0.025, 0.025, 1.75, 4).translate(0, 0.87, 0).rotateX(-0.36).rotateY(a).translate(Math.sin(a) * 0.62, 0, Math.cos(a) * 0.62));
  P('metal', cyl(0.012, 0.012, 0.42, 3).translate(0, 1.22, 0));
  P('metal', new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65).translate(0, 1.05, 0));
}

/**
 * A tent round its pole, its door towards +z: the cone, a skirt (`accent`), the doorway dark with its flap tied back, guy ropes to pegs,
 * the pole through its top with a gilt finial. `R` its radius on the ground, `Hc` its height, `sides` the cone's.
 */
export function tent(P: Put, R: number, Hc: number, sides = 10) {
  P('cloth', new THREE.ConeGeometry(R, Hc, sides).translate(0, Hc / 2, 0));
  P('accent', new THREE.CylinderGeometry(R * 0.93, R * 1.005, 0.3, sides, 1, true).translate(0, 0.15, 0));
  const dh = Math.min(1.5, Hc * 0.45), rb = R + 0.02, rt = R * (1 - dh / Hc) + 0.02, dw = Math.min(0.55, R * 0.45);
  P('dark', tri(new THREE.Vector3(-dw, 0, rb), new THREE.Vector3(dw, 0, rb), new THREE.Vector3(0, dh, rt)));
  P('cloth', tri(new THREE.Vector3(dw, 0, rb), new THREE.Vector3(dw + 0.5, 0.05, rb - 0.25), new THREE.Vector3(0, dh, rt)));
  P('dark', cyl(0.05, 0.05, Hc + 0.5, 5));
  P('gold', new THREE.ConeGeometry(0.09, 0.22, 6).translate(0, Hc + 0.6, 0));
  for (const a of [Math.PI * 0.33, Math.PI, -Math.PI * 0.33]) {
    const ux = Math.sin(a), uz = Math.cos(a);
    P('rope', rod(new THREE.Vector3(ux * R * 0.4, Hc * 0.6, uz * R * 0.4), new THREE.Vector3(ux * (R + 1.0), 0, uz * (R + 1.0)), 0.015));
    P('dark', box(0.06, 0.2, 0.06).translate(ux * (R + 1.0), 0, uz * (R + 1.0)));
  }
}

/** A crate `w` across and `hh` high (from `y0`): planks, dark battens on its corners and rims, braces across its sides, a gilt band. */
export function crate(P: Put, w: number, hh: number, y0 = 0) {
  const e = w / 2 - 0.05;
  P('wood', box(w - 0.06, hh - 0.06, w - 0.06).translate(0, y0 + 0.03, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P('dark', box(0.1, hh, 0.1).translate(sx * e, y0, sz * e));
  for (const y of [y0, y0 + hh - 0.08]) {
    for (const sz of [-1, 1]) P('dark', box(w, 0.08, 0.1).translate(0, y, sz * e));
    for (const sx of [-1, 1]) P('dark', box(0.1, 0.08, w).translate(sx * e, y, 0));
  }
  const diag = Math.atan2(w - 0.2, hh - 0.2), dl = Math.hypot(w - 0.2, hh - 0.2);
  for (const sz of [-1, 1]) P('plank', new THREE.BoxGeometry(0.08, dl, 0.04).rotateZ(diag * sz).translate(0, y0 + hh / 2, sz * (w / 2 + 0.01)));
  for (const sx of [-1, 1]) P('plank', new THREE.BoxGeometry(0.04, dl, 0.08).rotateX(diag * sx).translate(sx * (w / 2 + 0.01), y0 + hh / 2, 0));
  P('gold', box(w + 0.03, 0.05, w + 0.03).translate(0, y0 + hh * 0.5, 0));
}
/** A crate and, by `v`, a smaller crate or a tied sack on it. */
export function crateLoaded(P: Put, w: number, hh: number, v: number) {
  crate(P, w, hh);
  if (v < 0.35) {
    const s = w * 0.62, Q: Put = (role, g) => P(role, g.rotateY(0.5).translate(0.1, 0, -0.05));
    crate(Q, s, hh * 0.55, hh);
  } else if (v < 0.6) {
    P('cloth', ico(0.42, 0.26, 0.34).translate(0.05, hh + 0.2, 0));
    P('rope', new THREE.TorusGeometry(0.1, 0.03, 4, 8).rotateX(Math.PI / 2).translate(0.05, hh + 0.42, 0));
  }
}

/** A barrel: staves that bulge, three hoops, a lid; by `v` open, the catch in it. */
export function barrel(P: Put, r: number, h: number, v: number) {
  const prof = [[0.01, 0], [r * 0.84, 0], [r * 0.95, h * 0.22], [r, h * 0.5], [r * 0.95, h * 0.78], [r * 0.84, h], [0.01, h]].map(([a, b]) => new THREE.Vector2(a, b));
  P('wood', new THREE.LatheGeometry(prof, 12));
  for (const [y, rr] of [[0.1, 0.87], [0.5, 1.0], [0.9, 0.87]]) P('metal', cyl(r * rr + 0.025, r * rr + 0.025, 0.06, 12).translate(0, h * y - 0.03, 0));
  if (v < 0.34) { P('catch', cyl(r * 0.8, r * 0.8, 0.02, 12).translate(0, h - 0.06, 0)); P('catch', ico(0.22, 0.06, 0.07).translate(0.05, h - 0.02, 0.03)); }
  else P('dark', cyl(r * 0.82, r * 0.82, 0.03, 12).translate(0, h - 0.01, 0));
}

/**
 * A stall along +z (`len` long, `r` half its depth, its top at `top`): trestles, a planked top with a gilt edge, a cloth on its +x front,
 * goods along it (baskets of `catch`, crates of it, jars of `clay`); `awning` > 0: poles and a striped awning that high.
 */
export function stall(P: Put, r: number, len: number, top: number, v: number, awning = 0) {
  const L2 = len + r * 2;
  for (const s of [-1, 1]) for (const t of [-0.42, 0.42]) P('dark', box(0.09, top - 0.06, 0.09).translate(t * r * 2, 0, s * (L2 / 2 - 0.15)));
  P('wood', box(r * 2 - 0.1, 0.07, L2 - 0.2).translate(0, top * 0.35, 0));
  P('plank', box(r * 2.3, 0.08, L2).translate(0, top - 0.08, 0));
  P('gold', box(r * 2.34, 0.03, L2 + 0.04).translate(0, top - 0.03, 0));
  P(v < 0.5 ? 'accent' : 'accent2', box(0.03, top * 0.55, L2 - 0.3).translate(r * 1.15 + 0.02, top * 0.4, 0));
  for (let k = 0, n = Math.max(1, Math.floor(L2 / 0.75)); k < n; k++) {
    const z = -L2 / 2 + (k + 0.5) * (L2 / n), w = (v * 13.7 + k * 0.618) % 1;
    if (w < 0.4) { P('wood', cyl(0.22, 0.17, 0.2, 9).translate(0, top, z)); P('catch', cyl(0.19, 0.19, 0.03, 9).translate(0, top + 0.18, z)); }
    else if (w < 0.7) { P('plank', box(0.42, 0.12, 0.34).translate(0, top, z)); for (const f of [-0.1, 0, 0.1]) P('catch', ico(0.16, 0.04, 0.05).rotateY(0.3).translate(0, top + 0.13, z + f)); }
    else { P('clay', new THREE.SphereGeometry(0.13, 8, 6).scale(1, 1.25, 1).translate(0, top + 0.16, z)); P('clay', cyl(0.05, 0.06, 0.08, 8).translate(0, top + 0.3, z)); }
  }
  if (awning > 0) {
    for (const s of [-1, 1]) P('dark', cyl(0.07, 0.07, awning, 5).translate(0, 0, s * len / 2));
    for (let k = 0; k < 4; k++) P(k % 2 ? 'cloth' : 'accent', new THREE.BoxGeometry(0.4, 0.06, len + 0.6).translate(-0.6 + k * 0.4, awning, 0));
    for (const s of [-1, 1]) P('accent', new THREE.BoxGeometry(1.62, 0.22, 0.03).translate(0, awning - 0.12, s * (len + 0.6) / 2));
  }
}

/**
 * A hut along +z (`len` long, `r` half its width, walls `wh` high, its roof's ridge `rh` above them): plank walls on a stone footing,
 * dark corner posts and a sill, a door with its frame on the +x side and a shuttered window, a pitched roof of `cloth` (thatch, felt)
 * with eaves, its ridge capped in gold.
 */
export function hut(P: Put, r: number, len: number, wh: number, rh: number) {
  const w = r * 2, d = len + r * 2;
  P('stone', box(w + 0.16, 0.3, d + 0.16));
  P('wood', box(w, wh, d).translate(0, 0.25, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P('dark', box(0.16, wh, 0.16).translate(sx * (w / 2), 0.25, sz * (d / 2)));
  for (const sx of [-1, 1]) P('dark', box(0.12, 0.12, d + 0.1).translate(sx * (w / 2 + 0.02), wh + 0.18, 0));
  // the door and its frame on +x, a window with its shutters on -x
  P('dark', box(0.06, Math.min(1.8, wh * 0.85), 0.85).translate(w / 2 + 0.03, 0.28, 0));
  P('plank', box(0.08, 0.1, 1.05).translate(w / 2 + 0.05, 0.28 + Math.min(1.8, wh * 0.85), 0));
  P('dark', box(0.06, 0.45, 0.55).translate(-w / 2 - 0.03, wh * 0.55, d * 0.2));
  for (const s of [-1, 1]) P('plank', box(0.05, 0.47, 0.26).translate(-w / 2 - 0.05, wh * 0.55, d * 0.2 + s * 0.42));
  // the roof: two slopes with eaves past the walls, the gables closed
  const slope = Math.hypot(w / 2 + 0.4, rh), ang = Math.atan2(rh, w / 2 + 0.4), y0 = wh + 0.25;
  for (const s of [-1, 1]) P('cloth', new THREE.BoxGeometry(slope, 0.16, d + 0.7).translate(0, 0.08, 0).rotateZ(-s * ang).translate(s * (w / 4 + 0.2), y0 + rh / 2, 0));
  const gable = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rh)]);
  P('wood', new THREE.ExtrudeGeometry(gable, { depth: d, bevelEnabled: false }).translate(0, y0, -d / 2));
  P('gold', box(0.12, 0.1, d + 0.75).translate(0, y0 + rh + 0.02, 0));
}

/** A stone column `r` round and `h` high: a square base, a shaft with flutes, a capital; by `v` broken off with a fallen drum. */
export function column(P: Put, r: number, h: number, v: number) {
  const broken = v < 0.3, hh = broken ? h * (0.55 + v) : h;
  P('stone', box(r * 2.6, 0.3, r * 2.6));
  P('stone', cyl(r * 1.15, r * 1.25, 0.2, 12).translate(0, 0.3, 0));
  P('rock', cyl(r * 0.86, r, hh - 0.75, 12).translate(0, 0.5, 0));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; P('stone', box(0.06, hh - 0.95, 0.06).translate(Math.sin(a) * r * 0.93, 0.6, Math.cos(a) * r * 0.93)); }
  if (broken) {
    P('rock', cyl(r * 0.86, r * 0.86, 0.6, 12).rotateZ(Math.PI / 2).translate(r * 1.9, r * 0.86, 0.4));
  } else {
    P('stone', cyl(r * 1.25, r * 0.9, 0.3, 12).translate(0, h - 0.25, 0));
    P('stone', box(r * 2.7, 0.22, r * 2.7).translate(0, h + 0.05, 0));
    P('gold', box(r * 2.74, 0.04, r * 2.74).translate(0, h + 0.05, 0));
  }
}

/** A standing stone `w` x `d`, `h` high (leaning `lean`): carved bands of runes, moss on its top, a gilt band, stones at its foot. */
export function menhir(P: Put, w: number, d: number, h: number, lean: number) {
  const g = (geo: THREE.BufferGeometry) => geo.rotateX(lean);
  P('stone', g(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0)));
  P('stone', g(new THREE.ConeGeometry(Math.max(w, d) * 0.62, h * 0.18, 4).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d)).translate(0, h + h * 0.09, 0)));
  for (let k = 0; k < 5; k++) P('dark', g(box(w * (0.2 + (k % 3) * 0.12), 0.06, 0.02).translate((k % 2 ? -0.1 : 0.12) * w, h * (0.25 + k * 0.1), d / 2 + 0.005)));
  P('accent', g(new THREE.SphereGeometry(Math.max(w, d) * 0.45, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1).translate(0.05, h + h * 0.04, 0)));
  P('gold', g(box(w + 0.08, 0.08, d + 0.08).translate(0, h * 0.62, 0)));
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; P('rock', ico(0.25, 0.16, 0.22).translate(Math.sin(a) * (w * 0.7 + 0.2), 0.08, Math.cos(a) * (d * 0.7 + 0.2))); }
}

/** A stump `r` round and `h` high: its bark, the cut with its rings, roots splaying, moss on one side. */
export function stump(P: Put, r: number, h: number) {
  P('wood', cyl(r * 0.85, r, h, 9));
  P('plank', cyl(r * 0.8, r * 0.8, 0.04, 9).translate(0, h, 0));
  for (const rr of [0.55, 0.3]) P('dark', new THREE.TorusGeometry(r * rr, 0.02, 3, 12).rotateX(Math.PI / 2).translate(0, h + 0.04, 0));
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.3; P('wood', new THREE.CylinderGeometry(0.06, 0.16, r * 1.1, 5).translate(0, r * 0.55, 0).rotateX(1.15).rotateY(a).translate(Math.sin(a) * r * 0.6, 0.06, Math.cos(a) * r * 0.6)); }
  P('accent', new THREE.SphereGeometry(r * 0.5, 6, 4, 0, Math.PI, 0, Math.PI / 2).scale(1, 0.5, 0.6).rotateY(-Math.PI / 2).translate(-r * 0.6, h * 0.35, 0));
}

/** A cot `r` long-half: four legs, a frame, a blanket (`accent`) folded down over a pallet, a pillow. */
export function cot(P: Put, r: number) {
  const L = r * 2.6, W = r * 1.2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P('dark', box(0.08, 0.38, 0.08).translate(sx * (L / 2 - 0.08), 0, sz * (W / 2 - 0.08)));
  for (const sz of [-1, 1]) P('wood', box(L, 0.08, 0.08).translate(0, 0.3, sz * (W / 2 - 0.04)));
  P('cloth', box(L - 0.1, 0.1, W - 0.12).translate(0, 0.36, 0));
  P('accent', box(L * 0.55, 0.06, W - 0.06).translate(-L * 0.18, 0.44, 0));
  P('cloth', ico(0.3, 0.1, 0.22).translate(L / 2 - 0.35, 0.5, 0));
}
