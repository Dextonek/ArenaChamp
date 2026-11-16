import * as THREE from 'three';

/**
 * The courier kit (pipeline/designs/kit-courier.md): Pip, the last courier. Brown paper and string, cream envelopes, a postman's
 * blue and a bright yellow. `buildParcel` = a brown-paper parcel (string, a bow, a FRAGILE sticker, a label on top);
 * `buildLetter` = an airmail envelope with a red seal; `Flecks` = pooled flat scraps that tumble (paper bits, or FRAGILE stickers);
 * `wordSprite` = a big hurried word (SIGN HERE, DELIVERED); `parcelLook`, `dropLook`, `carriedLook`, `dashLook` = what
 * `Trait.markLook` draws on the floor (big and plain, each with a beam of light where it matters). Everything is pooled or
 * built once, takes world-space positions, has `reset()` where it holds state, and keeps every colour under the bloom threshold.
 */

/** Palette. Numbers for `THREE.Color`, `COURIER_CSS` for APIs that want a string. `accent` is the yellow, `foil` the blue. */
export const COURIER = {
  paper: 0xe6d6ac,
  cream: 0xeee3c4,
  brown: 0xb98a52,
  brownDark: 0x7a5230,
  string: 0xe4d49c,
  dark: 0x2a1c12,
  accent: 0xffd24a,
  hot: 0xffe88a,
  foil: 0x3a6ac8,
  blueDark: 0x24427e,
  blueLight: 0x8fb0ee,
  red: 0xd9463a,
} as const;

export const COURIER_CSS = {
  paper: '#e6d6ac',
  cream: '#eee3c4',
  brown: '#b98a52',
  brownDark: '#7a5230',
  string: '#e4d49c',
  dark: '#2a1c12',
  accent: '#ffd24a',
  hot: '#ffe88a',
  foil: '#3a6ac8',
  blueDark: '#24427e',
  blueLight: '#8fb0ee',
  red: '#e0503f',
} as const;

const MIN = 1e-4;

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const basic = (color: number, opts: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, ...opts });
const solid = (geo: THREE.BufferGeometry, color: number, at: [number, number, number] = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, basic(color, { side: THREE.DoubleSide }));
  m.position.set(...at);
  return m;
};

// ---------------------------------------------------------------------------------------------------------------
// Textures: a FRAGILE sticker, a shipping label, and the big words.
// ---------------------------------------------------------------------------------------------------------------

let stickerTex: THREE.CanvasTexture | undefined;
/** A red rectangular FRAGILE sticker with a broken-glass picture (2:1). */
export function stickerTexture() {
  return (stickerTex ??= canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = COURIER_CSS.dark;
    g.fillRect(0, 0, w, h);
    g.fillStyle = COURIER_CSS.red;
    g.fillRect(6, 6, w - 12, h - 12);
    g.fillStyle = COURIER_CSS.cream;
    g.font = '900 40px Impact, Arial Black, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('FRAGILE', w * 0.58, h * 0.52, w * 0.62);
    // A little wine glass, cracked.
    g.strokeStyle = COURIER_CSS.cream;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(34, 30);
    g.lineTo(68, 30);
    g.lineTo(54, 64);
    g.lineTo(54, 94);
    g.moveTo(40, 96);
    g.lineTo(68, 96);
    g.stroke();
    g.strokeStyle = COURIER_CSS.dark;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(46, 30);
    g.lineTo(54, 48);
    g.lineTo(48, 58);
    g.stroke();
  }));
}

const labelTextures = new Map<string, THREE.CanvasTexture>();
/** A white address label with scribbled lines and `text` on its first line (the enemy's name on a Final Delivery). */
function labelTexture(text: string) {
  let t = labelTextures.get(text);
  if (!t) {
    t = canvasTex(256, 192, (g, w, h) => {
      g.fillStyle = COURIER_CSS.cream;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = COURIER_CSS.dark;
      g.lineWidth = 6;
      g.strokeRect(5, 5, w - 10, h - 10);
      g.fillStyle = COURIER_CSS.dark;
      g.font = '900 54px Impact, Arial Black, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, w / 2, h * 0.3, w - 40);
      g.fillStyle = COURIER_CSS.brownDark;
      for (let i = 0; i < 3; i++) g.fillRect(28, h * (0.54 + i * 0.14), w - 56 - i * 34, 8);
      g.fillStyle = COURIER_CSS.red;
      g.fillRect(w - 76, h - 56, 50, 30);
    });
    labelTextures.set(text, t);
  }
  return t;
}

const wordTextures = new Map<string, THREE.CanvasTexture>();
/**
 * A big hurried word on a cream plate with a dark edge, slightly crooked: SIGN HERE, DELIVERED, URGENT. A sprite (faces the camera),
 * drawn over everything, `width` m wide; set its position and scale yourself.
 */
export function wordSprite(text: string, ink: string = COURIER_CSS.dark, plate: string = COURIER_CSS.accent, width = 2.4): THREE.Sprite {
  const key = text + ink + plate;
  let tex = wordTextures.get(key);
  if (!tex) {
    tex = canvasTex(512, 170, (g, w, h) => {
      g.translate(w / 2, h / 2);
      g.rotate(-0.05);
      g.lineJoin = 'round';
      g.fillStyle = COURIER_CSS.dark;
      g.fillRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24);
      g.fillStyle = plate;
      g.fillRect(-w / 2 + 26, -h / 2 + 26, w - 52, h - 52);
      g.font = '900 84px Impact, Arial Black, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = ink;
      g.fillText(text, 0, 6, w - 92);
    });
    wordTextures.set(key, tex);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set(width, width / 3, 1);
  s.renderOrder = 8;
  s.visible = false;
  return s;
}

// ---------------------------------------------------------------------------------------------------------------
// The parcel and the letter.
// ---------------------------------------------------------------------------------------------------------------

/**
 * A brown-paper parcel with its feet at y 0 (0.9 x 0.6 x 0.7 at scale 1): a dark outline shell, paper, string round both ways with
 * a bow on top, a FRAGILE sticker on the front (+Z) and a label on top carrying `label`. The enemy's name on a Final Delivery.
 */
export function buildParcel(label = 'URGENT'): THREE.Group {
  const g = new THREE.Group();
  const W = 0.9, H = 0.6, D = 0.7;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(W * 1.08, H * 1.1, D * 1.08), basic(COURIER.dark, { side: THREE.BackSide }));
  shell.position.y = H / 2;
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), basic(COURIER.brown));
  box.position.y = H / 2;
  // A darker band along the lower edge, as if the paper had been folded.
  const fold = solid(new THREE.BoxGeometry(W * 1.002, 0.1, D * 1.002), COURIER.brownDark, [0, 0.05, 0]);
  const s = COURIER.string;
  const string = [
    solid(new THREE.BoxGeometry(0.07, H * 1.02, D * 1.03), s, [0, H / 2, 0]),
    solid(new THREE.BoxGeometry(W * 1.03, H * 1.02, 0.07), s, [0, H / 2, 0]),
  ];
  const bow = [
    solid(new THREE.OctahedronGeometry(0.1), s, [-0.1, H + 0.05, 0]),
    solid(new THREE.OctahedronGeometry(0.1), s, [0.1, H + 0.05, 0]),
    solid(new THREE.SphereGeometry(0.055, 8, 6), COURIER.brownDark, [0, H + 0.04, 0]),
  ];
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.23), new THREE.MeshBasicMaterial({ map: stickerTexture(), side: THREE.DoubleSide }));
  sticker.position.set(-0.17, H * 0.5, D / 2 + 0.006);
  sticker.rotation.z = 0.08;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: labelTexture(label), side: THREE.DoubleSide }));
  top.rotation.x = -Math.PI / 2;
  top.rotation.z = 0.1;
  top.position.set(0.2, H + 0.006, 0.12);
  g.add(shell, box, fold, ...string, ...bow, sticker, top);
  for (const m of g.children) m.frustumCulled = false;
  return g;
}

/** An airmail envelope facing +Z, centred on its origin (0.56 x 0.38): cream, a blue and red border, a red seal, a stamp. */
export function buildLetter(): THREE.Group {
  const g = new THREE.Group();
  const W = 0.56, H = 0.38;
  g.add(solid(new THREE.PlaneGeometry(W * 1.14, H * 1.2), COURIER.dark, [0, 0, -0.006]));
  g.add(solid(new THREE.PlaneGeometry(W, H), COURIER.cream));
  // Airmail stripes along the top and bottom edges: blue and red, alternating.
  for (let i = 0; i < 7; i++) {
    const c = i % 2 ? COURIER.red : COURIER.foil;
    g.add(solid(new THREE.PlaneGeometry(W / 7, 0.045), c, [-W / 2 + (i + 0.5) * (W / 7), H / 2 - 0.0225, 0.004]));
    g.add(solid(new THREE.PlaneGeometry(W / 7, 0.045), c, [-W / 2 + (i + 0.5) * (W / 7), -H / 2 + 0.0225, 0.004]));
  }
  // The flap, a V down from the top.
  const flap = new THREE.Shape();
  flap.moveTo(-W / 2, H / 2 - 0.045);
  flap.lineTo(W / 2, H / 2 - 0.045);
  flap.lineTo(0, -H * 0.08);
  flap.closePath();
  g.add(solid(new THREE.ShapeGeometry(flap), COURIER.paper, [0, 0, 0.008]));
  g.add(solid(new THREE.CircleGeometry(0.055, 12), COURIER.red, [0, -H * 0.06, 0.012]));
  g.add(solid(new THREE.PlaneGeometry(0.09, 0.11), COURIER.accent, [W * 0.32, -H * 0.18, 0.012]));
  for (const m of g.children) m.frustumCulled = false;
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Flecks: scraps of paper and stickers that tumble and settle.
// ---------------------------------------------------------------------------------------------------------------

interface Fleck {
  live: boolean;
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  life: number;
  size: number;
}

/**
 * Pooled flat scraps. `burst(pos, n, colors, speed, up, size)` throws `n` flecks (colours from the list) that flutter down, spin
 * and shrink away; with `textured` (stickers) they are FRAGILE labels instead. `update(dt)` each frame; `reset()`; `busy`.
 */
export class Flecks {
  readonly mesh = new THREE.Group();
  private items: Fleck[] = [];
  private cursor = 0;
  private mats = new Map<number, THREE.MeshBasicMaterial>();
  private stickerMat: THREE.MeshBasicMaterial | null = null;

  constructor(max = 60, private textured = false) {
    const geo = new THREE.PlaneGeometry(1, textured ? 0.5 : 0.7);
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(geo, this.mat(COURIER.paper));
      m.visible = false;
      m.frustumCulled = false;
      this.mesh.add(m);
      this.items.push({ live: false, mesh: m, vel: new THREE.Vector3(), spin: new THREE.Vector3(), age: 0, life: 1, size: 1 });
    }
  }

  private mat(color: number) {
    if (this.textured) return (this.stickerMat ??= new THREE.MeshBasicMaterial({ map: stickerTexture(), side: THREE.DoubleSide }));
    let m = this.mats.get(color);
    if (!m) { m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }); this.mats.set(color, m); }
    return m;
  }

  get busy() {
    return this.items.some((c) => c.live);
  }

  burst(pos: THREE.Vector3, n: number, colors: number[], speed: number, up: number, size = 0.2, life = 1.4) {
    for (let k = 0; k < n; k++) {
      let idx = this.items.findIndex((c) => !c.live);
      if (idx < 0) { idx = this.cursor; this.cursor = (this.cursor + 1) % this.items.length; }
      const c = this.items[idx];
      const a = Math.random() * Math.PI * 2, sp = speed * (0.35 + Math.random() * 0.65);
      c.live = true;
      c.age = 0;
      c.life = life * (0.7 + Math.random() * 0.5);
      c.size = size * (0.7 + Math.random() * 0.6);
      c.vel.set(Math.cos(a) * sp, up * (0.5 + Math.random() * 0.7), Math.sin(a) * sp);
      c.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      c.mesh.material = this.mat(colors[k % colors.length]);
      c.mesh.position.copy(pos);
      c.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      c.mesh.scale.setScalar(c.size);
      c.mesh.visible = true;
    }
  }

  reset() {
    for (const c of this.items) { c.live = false; c.mesh.visible = false; }
    this.cursor = 0;
  }

  update(dt: number) {
    for (const c of this.items) {
      if (!c.live) continue;
      c.age += dt;
      if (c.age >= c.life) { c.live = false; c.mesh.visible = false; continue; }
      // Paper flutters: gravity is light, drag is heavy, and it sways as it falls.
      c.vel.y -= 5.5 * dt;
      c.vel.multiplyScalar(Math.exp(-dt * 1.6));
      c.mesh.position.addScaledVector(c.vel, dt);
      if (c.mesh.position.y < 0.04) { c.mesh.position.y = 0.04; c.vel.set(c.vel.x * 0.4, 0, c.vel.z * 0.4); c.spin.multiplyScalar(0.4); }
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.rotation.z += c.spin.z * dt;
      const left = c.life - c.age;
      c.mesh.scale.setScalar(Math.max(MIN, c.size * Math.min(1, left / 0.35)));
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Beams and floor marks (`Trait.markLook`).
// ---------------------------------------------------------------------------------------------------------------

const BEAM_H = 18;

/** A tall beam of light that fades toward the sky: additive, open-ended, `r` m wide. */
function beam(color: number, r: number, strength: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r * 1.35, BEAM_H, 14, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
      vertexShader: /* glsl */ `varying float vH; void main() { vH = position.y / ${BEAM_H.toFixed(1)} + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uStrength; varying float vH; void main() { gl_FragColor = vec4(uColor, uStrength * (1.0 - vH) * (1.0 - vH) * 0.9 + 0.02); }`,
    }),
  );
  m.position.y = BEAM_H / 2;
  m.frustumCulled = false;
  return m;
}

const flatRing = (inner: number, outer: number, color: number, opacity: number, y = 0.03) => {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 48).rotateX(-Math.PI / 2),
    basic(color, { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }),
  );
  m.position.y = y;
  m.renderOrder = 2;
  return m;
};

const flatDisc = (r: number, color: number, opacity: number, y = 0.02) => {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2),
    basic(color, { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }),
  );
  m.position.y = y;
  m.renderOrder = 1;
  return m;
};

/** Bobs and turns `holder` while `trigger` (any mesh inside it) is drawn: a mark has no update of its own. */
function bob(holder: THREE.Object3D, trigger: THREE.Object3D, base: number, amp: number, turn: number) {
  trigger.onBeforeRender = () => {
    const t = performance.now() / 1000;
    holder.position.y = base + amp * Math.sin(t * 3.2);
    holder.rotation.y = t * turn;
  };
}

/** The parcel on the ground: a big brown parcel bobbing on a yellow ring (the 1.3 m pick-up reach), under a tall yellow beam. */
export function parcelLook(): THREE.Object3D {
  const g = new THREE.Group();
  const holder = new THREE.Group();
  const p = buildParcel('URGENT');
  p.scale.setScalar(1.25);
  holder.add(p);
  holder.position.y = 0.2;
  g.add(flatDisc(1.3, COURIER.accent, 0.18), flatRing(1.14, 1.3, COURIER.accent, 0.9), flatRing(0.9, 0.98, COURIER.dark, 0.5), holder, beam(COURIER.accent, 0.3, 0.55), beam(COURIER.hot, 0.1, 0.8));
  bob(holder, p.children[1], 0.2, 0.08, 0.7);
  return g;
}

/** The drop point: a blue disc with a yellow rim and a yellow X, a little blue post box in the middle, a tall blue beam. */
export function dropLook(): THREE.Object3D {
  const g = new THREE.Group();
  const holder = new THREE.Group();
  const bodyShell = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.56), basic(COURIER.dark, { side: THREE.BackSide }));
  bodyShell.position.y = 0.45;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.84, 0.5), basic(COURIER.foil));
  body.position.y = 0.45;
  const lid = solid(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), COURIER.blueDark, [0, 0.9, 0]);
  const slot = solid(new THREE.PlaneGeometry(0.4, 0.07), COURIER.dark, [0, 0.62, 0.256]);
  const stripe = solid(new THREE.PlaneGeometry(0.66, 0.1), COURIER.accent, [0, 0.34, 0.256]);
  holder.add(bodyShell, body, lid, slot, stripe);
  holder.position.y = 0.06;
  const x1 = solid(new THREE.PlaneGeometry(2.1, 0.16).rotateX(-Math.PI / 2), COURIER.accent, [0, 0.04, 0]);
  const x2 = x1.clone();
  x1.rotation.y = Math.PI / 4;
  x2.rotation.y = -Math.PI / 4;
  g.add(flatDisc(1.5, COURIER.foil, 0.3), flatRing(1.34, 1.5, COURIER.accent, 0.95), flatRing(1.08, 1.14, COURIER.blueLight, 0.7), x1, x2, holder, beam(COURIER.foil, 0.34, 0.7), beam(COURIER.blueLight, 0.1, 0.8));
  bob(holder, body, 0.06, 0.05, 0.5);
  return g;
}

/** A parcel being carried: a blue and yellow ring round his feet (the enemy sees who is carrying). */
export function carriedLook(): THREE.Object3D {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  spin.add(flatRing(0.8, 0.92, COURIER.accent, 0.9), flatRing(0.62, 0.68, COURIER.foil, 0.85));
  for (let i = 0; i < 4; i++) {
    const t = solid(new THREE.PlaneGeometry(0.18, 0.18).rotateX(-Math.PI / 2), COURIER.accent, [Math.cos(i * 1.571) * 0.98, 0.04, Math.sin(i * 1.571) * 0.98]);
    t.rotation.y = -i * 1.571 + 0.785;
    spin.add(t);
  }
  g.add(spin, flatDisc(0.8, COURIER.accent, 0.12));
  spin.children[0].onBeforeRender = () => { spin.rotation.y = performance.now() / 600; };
  return g;
}

/** One yellow dash of the route on the floor, 0.55 m long along z. */
export function dashLook(): THREE.Object3D {
  const g = new THREE.Group();
  const under = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.64).rotateX(-Math.PI / 2), basic(COURIER.dark, { transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  under.position.y = 0.025;
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.55).rotateX(-Math.PI / 2), basic(COURIER.accent, { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  bar.position.y = 0.035;
  under.renderOrder = 1;
  bar.renderOrder = 2;
  g.add(under, bar);
  return g;
}
