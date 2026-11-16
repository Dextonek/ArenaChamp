import * as THREE from 'three';

/**
 * The janitor kit (pipeline/designs/kit-janitor.md): Gus, a tired caretaker with a squeaky mop. Soapy blue water, white foam,
 * safety yellow, rubber black, grey overalls. Kept under about 0.92 per channel, because the bloom turns brighter areas into a halo.
 * `wetLook` = a patch of wet floor (`Trait.markLook`): shining, reflective, pale blue, a layer of dark blue under it and a pale rim, so
 * it reads as water on the floor and never as a red telegraph. `buildMop` / `buildSign` / `buildBucket` = the three props.
 * `Ripples`, `Drops`, `Bubbles`, `Words`, `SwipeFan` = pooled pieces: all built once, take world-space positions, have `reset()`.
 */
export const JANITOR = {
  core: 0xf2f6f8,
  foam: 0xe4f1f6,
  pale: 0xc4e4f2,
  water: 0x74c0ea,
  waterDeep: 0x3a6a8a,
  deep: 0x2a4a62,
  yellow: 0xffd23a,
  yellowDeep: 0xd9a514,
  grey: 0x8a929a,
  greyDark: 0x4a5058,
  steel: 0xb4bcc4,
  rubber: 0x23282e,
  bucket: 0x4f86a8,
  wood: 0xa4906a,
  string: 0xd8d6c8,
  dark: 0x15202a,
  foil: 0x3a6a8a,
  accent: 0xffd23a,
} as const;

export const JANITOR_CSS = {
  core: '#f2f6f8',
  foam: '#e4f1f6',
  pale: '#c4e4f2',
  water: '#74c0ea',
  waterDeep: '#3a6a8a',
  yellow: '#ffd23a',
  yellowDeep: '#d9a514',
  grey: '#8a929a',
  dark: '#15202a',
  foil: '#3a6a8a',
  accent: '#ffd23a',
} as const;

const MIN = 1e-4;

function mat(color: number, opacity = 1, additive = false) {
  return new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1 || additive, opacity, depthWrite: opacity >= 1 && !additive, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** A flat plane on the floor, `w` wide (x) and `l` long (z), centred at (cx, cz). */
function plane(cx: number, cz: number, w: number, l: number, color: number, opacity: number, y: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), mat(color, opacity));
  m.position.set(cx, y, cz);
  m.renderOrder = 1;
  m.frustumCulled = false;
  return m;
}

function disc(inner: number, outer: number, color: number, opacity: number, y: number): THREE.Mesh {
  const g = inner > 0 ? new THREE.RingGeometry(inner, outer, 56) : new THREE.CircleGeometry(outer, 56);
  const m = new THREE.Mesh(g.rotateX(-Math.PI / 2), mat(color, opacity));
  m.position.y = y;
  m.renderOrder = 1;
  m.frustumCulled = false;
  return m;
}

/** A shine that breathes: the mesh's opacity swings around `base` with the clock, so wet floor glints without an update call. */
function sheen(m: THREE.Mesh, base: number, amp: number, speed: number, phase: number) {
  const mt = m.material as THREE.MeshBasicMaterial;
  m.onBeforeRender = () => { mt.opacity = base + amp * Math.sin(performance.now() * speed + phase); };
}

/**
 * Wet floor. `'strip'`: a strip 2 m wide, 1 m long along z from its feet (the mark's `length` stretches it: Big Mop's 6 m). `'splash'`:
 * a disc of radius `r` (the bucket's 2.5 m). `'flood'`: the big disc (Flood's 7 m). Layers, bottom to top: a dark blue underlay, the
 * pale blue water, long white streaks and glints that breathe, and a bright rim.
 */
export function wetLook(kind: 'strip' | 'splash' | 'flood', r = 2.5): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'strip') {
    g.add(plane(0, 0.5, 2.12, 1.04, JANITOR.waterDeep, 0.42, 0));
    g.add(plane(0, 0.5, 2, 1, JANITOR.water, 0.5, 0.004));
    [[-0.55, 0.0], [0.05, 2.1], [0.6, 4.2]].forEach(([x, ph], i) => {
      const s = plane(x, 0.5, 0.14, 0.9, JANITOR.core, 0.5, 0.008);
      sheen(s, 0.42, 0.22, 0.004 + i * 0.0007, ph);
      g.add(s);
    });
    for (const sx of [-1, 1]) g.add(plane(sx * 0.98, 0.5, 0.07, 1, JANITOR.foam, 0.8, 0.012));
    const glint = plane(-0.2, 0.3, 0.5, 0.012, JANITOR.core, 0.6, 0.01);
    sheen(glint, 0.5, 0.3, 0.006, 1);
    g.add(glint);
    return g;
  }
  g.add(disc(0, r * 1.04, JANITOR.waterDeep, 0.42, 0));
  g.add(disc(0, r, JANITOR.water, 0.5, 0.004));
  const rings = kind === 'flood' ? 4 : 2;
  for (let i = 1; i <= rings; i++) {
    const rr = (r * i) / (rings + 0.6);
    const m = disc(rr - r * 0.012, rr + r * 0.012, JANITOR.core, 0.4, 0.008);
    sheen(m, 0.3, 0.2, 0.003 + i * 0.0009, i * 1.7);
    g.add(m);
  }
  g.add(disc(r * 0.955, r, JANITOR.foam, 0.8, 0.012));
  // Glints: little pale ovals scattered over the water, a fixed pattern, each one breathing on its own.
  const n = kind === 'flood' ? 18 : 7;
  for (let i = 0; i < n; i++) {
    const a = i * 2.399963 + 0.4, d = Math.sqrt((i + 0.5) / n) * r * 0.86;
    const gl = new THREE.Mesh(new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), mat(JANITOR.core, 0.5));
    gl.scale.set(r * (0.05 + 0.03 * (i % 3)), 1, r * 0.014);
    gl.rotation.y = a * 1.3;
    gl.position.set(Math.cos(a) * d, 0.01, Math.sin(a) * d);
    gl.renderOrder = 1;
    gl.frustumCulled = false;
    sheen(gl, 0.4, 0.3, 0.005 + (i % 4) * 0.001, i);
    g.add(gl);
  }
  return g;
}

/** A canvas texture for a sign face: yellow, a black border, a figure slipping backward, and the words. */
function signFace(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffd23a';
  g.fillRect(0, 0, 256, 384);
  g.strokeStyle = '#15202a';
  g.lineWidth = 12;
  g.strokeRect(10, 10, 236, 364);
  g.fillStyle = '#15202a';
  g.font = '900 46px Impact, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.fillText('CAUTION', 128, 62);
  // The slipping figure: head, a leaning body, an arm thrown up, a leg out, on a slanted floor with a splash.
  g.lineCap = 'round';
  g.lineWidth = 15;
  g.strokeStyle = '#15202a';
  g.beginPath();
  g.arc(116, 118, 15, 0, Math.PI * 2);
  g.fill();
  g.beginPath(); g.moveTo(118, 140); g.lineTo(136, 208); g.stroke();
  g.beginPath(); g.moveTo(122, 156); g.lineTo(80, 134); g.stroke();
  g.beginPath(); g.moveTo(126, 160); g.lineTo(172, 178); g.stroke();
  g.beginPath(); g.moveTo(136, 208); g.lineTo(98, 252); g.stroke();
  g.beginPath(); g.moveTo(136, 208); g.lineTo(190, 238); g.stroke();
  g.beginPath(); g.ellipse(120, 268, 78, 12, -0.08, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3a6a8a';
  g.beginPath(); g.ellipse(120, 268, 70, 7, -0.08, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#15202a';
  g.font = '900 52px Impact, "Arial Black", sans-serif';
  g.fillText('WET', 128, 322);
  g.font = '900 40px Impact, "Arial Black", sans-serif';
  g.fillText('FLOOR', 128, 362);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const SIGN_WIDTH = 0.9;
export const SIGN_HEIGHT = 1.3;

/** The folding A-frame sign, feet at y 0, its two faces along the z axis (the hinge runs along x). It leans to be a real A. */
export function buildSign(): THREE.Group {
  const root = new THREE.Group();
  const face = new THREE.MeshBasicMaterial({ map: signFace(), side: THREE.DoubleSide });
  const side = new THREE.MeshBasicMaterial({ color: JANITOR.yellowDeep });
  const lean = 0.2;
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.y = SIGN_HEIGHT * Math.cos(lean);
    pivot.rotation.x = s * -lean;
    const geo = new THREE.BoxGeometry(SIGN_WIDTH, SIGN_HEIGHT, 0.05).translate(0, -SIGN_HEIGHT / 2, 0);
    const mats = [side, side, side, side, face, face];
    pivot.add(new THREE.Mesh(geo, mats));
    // Rubber feet.
    for (const fx of [-0.36, 0.36]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.09).translate(fx, -SIGN_HEIGHT - 0.01, 0), mat(JANITOR.rubber));
      pivot.add(foot);
    }
    root.add(pivot);
  }
  const hinge = new THREE.Mesh(new THREE.BoxGeometry(SIGN_WIDTH + 0.06, 0.07, 0.1), mat(JANITOR.greyDark));
  hinge.position.y = SIGN_HEIGHT * Math.cos(lean) + 0.01;
  root.add(hinge);
  return root;
}

/** The mop, its head at the origin, the handle running up the +y axis (1.7 m). Strings splay from a metal collar. */
export function buildMop(): THREE.Group {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.7, 8).translate(0, 0.85, 0), mat(JANITOR.wood));
  g.add(handle);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 10).translate(0, 0.05, 0), mat(JANITOR.steel));
  g.add(collar);
  const strand = new THREE.CylinderGeometry(0.012, 0.03, 0.5, 5).translate(0, -0.25, 0);
  const wet = new THREE.MeshBasicMaterial({ color: JANITOR.pale });
  const dry = new THREE.MeshBasicMaterial({ color: JANITOR.string });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, s = new THREE.Mesh(strand, i % 3 ? dry : wet);
    s.position.set(Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07);
    s.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(s);
  }
  return g;
}

/** The wheeled bucket, feet at y 0, about 0.9 m across with its wringer. Water slops over the top. */
export function buildBucket(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.55, 20, 1, true).translate(0, 0.46, 0), new THREE.MeshBasicMaterial({ color: JANITOR.bucket, side: THREE.DoubleSide }));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20).rotateX(-Math.PI / 2).translate(0, 0.2, 0), mat(JANITOR.greyDark));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.35, 0.1, 20, 1, true).translate(0, 0.52, 0), new THREE.MeshBasicMaterial({ color: JANITOR.yellow, side: THREE.DoubleSide }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 6, 24).rotateX(Math.PI / 2).translate(0, 0.735, 0), mat(JANITOR.steel));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.385, 20).rotateX(-Math.PI / 2).translate(0, 0.66, 0), mat(JANITOR.water, 0.92));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.018, 5, 16, Math.PI).translate(0, 0.73, 0), mat(JANITOR.steel));
  g.add(body, floor, band, rim, water, handle);
  // The wringer: a yellow press hanging on one side, and a grey lever.
  const press = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.14).translate(0, 0.7, -0.45), mat(JANITOR.yellowDeep));
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04).translate(0.1, 0.95, -0.45), mat(JANITOR.greyDark));
  g.add(press, lever);
  // Four wheels under it.
  const wheel = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10).rotateZ(Math.PI / 2);
  for (const [x, z] of [[0.24, 0.24], [-0.24, 0.24], [0.24, -0.24], [-0.24, -0.24]]) {
    const w = new THREE.Mesh(wheel, mat(JANITOR.rubber));
    w.position.set(x, 0.1, z);
    g.add(w);
    const peg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), mat(JANITOR.greyDark));
    peg.position.set(x, 0.17, z);
    g.add(peg);
  }
  return g;
}

// --- Pooled pieces ---

interface Pooled { m: THREE.Mesh; age: number; life: number }

/** Flat rings on the floor that swell and fade: splashes, the wave's edge. */
export class Ripples {
  readonly mesh = new THREE.Group();
  private items: (Pooled & { r0: number; r1: number; op: number })[] = [];
  private next = 0;
  private fat = new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2);
  private thin = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2);

  constructor(count: number) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.thin, mat(JANITOR.foam, 0, false));
      m.visible = false;
      m.renderOrder = 3;
      m.frustumCulled = false;
      this.mesh.add(m);
      this.items.push({ m, age: 9, life: 1, r0: 0, r1: 1, op: 1 });
    }
  }

  get busy() {
    return this.items.some((c) => c.age < c.life);
  }

  fire(x: number, z: number, r0: number, r1: number, life: number, opacity = 0.8, color: number = JANITOR.foam, fat = false) {
    const c = this.items[this.next++ % this.items.length];
    c.m.geometry = fat ? this.fat : this.thin;
    c.m.position.set(x, 0.05, z);
    (c.m.material as THREE.MeshBasicMaterial).color.setHex(color);
    c.age = 0;
    c.life = life;
    c.r0 = r0;
    c.r1 = r1;
    c.op = opacity;
    c.m.visible = true;
  }

  update(dt: number) {
    for (const c of this.items) {
      if (c.age >= c.life) continue;
      c.age += dt;
      if (c.age >= c.life) { c.m.visible = false; continue; }
      const k = c.age / c.life;
      c.m.scale.setScalar(Math.max(MIN, c.r0 + (c.r1 - c.r0) * (1 - (1 - k) * (1 - k))));
      (c.m.material as THREE.MeshBasicMaterial).opacity = c.op * (1 - k) * Math.min(1, k * 12);
    }
  }

  reset() {
    for (const c of this.items) { c.age = 9; c.m.visible = false; }
    this.next = 0;
  }
}

/** Water drops thrown in arcs; they vanish on the floor (a drop that lands may leave a small ripple through `onLand`). */
export class Drops {
  readonly mesh = new THREE.Group();
  private items: (Pooled & { v: THREE.Vector3; size: number; fresh: boolean })[] = [];
  private next = 0;
  onLand: ((x: number, z: number) => void) | null = null;

  constructor(count: number) {
    const geo = new THREE.SphereGeometry(1, 6, 5);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat(JANITOR.pale, 0.9));
      m.visible = false;
      m.frustumCulled = false;
      this.mesh.add(m);
      this.items.push({ m, age: 9, life: 1, v: new THREE.Vector3(), size: 0.08, fresh: false });
    }
  }

  get busy() {
    return this.items.some((c) => c.age < c.life);
  }

  /** `n` drops from `at`, thrown outward at about `speed` and up at about `up` m/s. `dir` (optional) biases the throw along it. */
  burst(at: THREE.Vector3, n: number, speed = 4, up = 4, size = 0.08, dir?: THREE.Vector3, color: number = JANITOR.pale) {
    for (let i = 0; i < n; i++) {
      const c = this.items[this.next++ % this.items.length];
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      c.v.set(Math.cos(a) * s, up * (0.5 + Math.random() * 0.9), Math.sin(a) * s);
      if (dir) c.v.addScaledVector(dir, speed * (0.6 + Math.random() * 0.8));
      c.m.position.copy(at);
      c.age = 0;
      c.life = 1.4;
      c.size = size * (0.6 + Math.random() * 0.8);
      (c.m.material as THREE.MeshBasicMaterial).color.setHex(i % 4 === 0 ? JANITOR.core : color);
      c.m.visible = true;
      c.fresh = true;
    }
  }

  update(dt: number) {
    for (const c of this.items) {
      if (c.age >= c.life) continue;
      c.age += dt;
      if (c.age >= c.life) { c.m.visible = false; continue; }
      c.v.y -= 13 * dt;
      c.m.position.addScaledVector(c.v, dt);
      c.m.scale.set(Math.max(MIN, c.size), Math.max(MIN, c.size * 1.3), Math.max(MIN, c.size));
      if (c.m.position.y < 0.04) {
        c.age = c.life;
        c.m.visible = false;
        this.onLand?.(c.m.position.x, c.m.position.z);
      }
    }
  }

  reset() {
    for (const c of this.items) { c.age = 9; c.m.visible = false; }
    this.next = 0;
  }
}

/** Soap bubbles: pale translucent balls with a bright speck, rising and wobbling, then popping. */
export class Bubbles {
  readonly mesh = new THREE.Group();
  private items: (Pooled & { sp: THREE.Mesh; v: THREE.Vector3; size: number; ph: number; hi: THREE.Mesh })[] = [];
  private next = 0;

  constructor(count: number) {
    const geo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < count; i++) {
      const sp = new THREE.Mesh(geo, mat(JANITOR.pale, 0.34));
      const hi = new THREE.Mesh(geo, mat(JANITOR.core, 0.9));
      hi.scale.setScalar(0.2);
      hi.position.set(-0.4, 0.45, 0.5);
      sp.add(hi);
      sp.visible = false;
      sp.frustumCulled = false;
      sp.renderOrder = 4;
      this.mesh.add(sp);
      this.items.push({ m: sp, sp, hi, age: 9, life: 1, v: new THREE.Vector3(), size: 0.1, ph: 0 });
    }
  }

  get busy() {
    return this.items.some((c) => c.age < c.life);
  }

  /** `n` bubbles from `at`, spread `spread` m round it, rising at about `rise` m/s, `size` m across. */
  emit(at: THREE.Vector3, n: number, spread = 0.5, size = 0.14, rise = 1.2) {
    for (let i = 0; i < n; i++) {
      const c = this.items[this.next++ % this.items.length];
      const a = Math.random() * Math.PI * 2, d = Math.random() * spread;
      c.m.position.set(at.x + Math.cos(a) * d, at.y + Math.random() * 0.3, at.z + Math.sin(a) * d);
      c.v.set((Math.random() - 0.5) * 0.5, rise * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 0.5);
      c.age = 0;
      c.life = 0.9 + Math.random() * 0.9;
      c.size = size * (0.5 + Math.random() * 1.0);
      c.ph = Math.random() * 6.28;
      c.m.visible = true;
    }
  }

  update(dt: number) {
    for (const c of this.items) {
      if (c.age >= c.life) continue;
      c.age += dt;
      if (c.age >= c.life) { c.m.visible = false; continue; }
      c.m.position.addScaledVector(c.v, dt);
      c.m.position.x += Math.sin(c.age * 6 + c.ph) * 0.4 * dt;
      const k = c.age / c.life, pop = k > 0.88 ? (k - 0.88) / 0.12 : 0;
      c.m.scale.setScalar(Math.max(MIN, c.size * (1 + 0.3 * pop) * Math.min(1, k * 8)));
      (c.m.material as THREE.MeshBasicMaterial).opacity = 0.34 * (1 - pop);
      (c.hi.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - pop);
    }
  }

  reset() {
    for (const c of this.items) { c.age = 9; c.m.visible = false; }
    this.next = 0;
  }
}

/** Words that pop up over a spot, drift and fade: WET FLOOR, SQUEAK, CLANG. Yellow letters, a dark outline, a blue shadow. */
export class Words {
  readonly mesh = new THREE.Group();
  private pool: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; t: number; life: number; size: number; base: THREE.Vector3; aspect: number; active: boolean }[] = [];

  constructor(count = 3) {
    for (let i = 0; i < count; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(m);
      sprite.renderOrder = 20;
      sprite.visible = false;
      this.mesh.add(sprite);
      this.pool.push({ sprite, mat: m, canvas, tex, t: 0, life: 1, size: 1, base: new THREE.Vector3(), aspect: 4, active: false });
    }
  }

  get busy() {
    return this.pool.some((w) => w.active);
  }

  /** `size`: the letters' height in metres; `fill`: the letter colour (css). */
  show(text: string, at: THREE.Vector3, size: number, life: number, fill: string = JANITOR_CSS.yellow) {
    const w = this.pool.find((p) => !p.active) ?? this.pool[0];
    const g = w.canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w.canvas.width, w.canvas.height);
    g.font = '900 170px Impact, "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const cx = w.canvas.width / 2, cy = w.canvas.height / 2 + 6;
    g.strokeStyle = JANITOR_CSS.foil;
    g.lineWidth = 34;
    g.strokeText(text, cx + 7, cy + 9);
    g.strokeStyle = JANITOR_CSS.dark;
    g.lineWidth = 30;
    g.strokeText(text, cx, cy);
    g.fillStyle = fill;
    g.fillText(text, cx, cy);
    w.tex.needsUpdate = true;
    w.active = true;
    w.t = 0;
    w.life = life;
    w.size = size;
    w.aspect = w.canvas.width / w.canvas.height;
    w.base.copy(at);
    w.sprite.visible = true;
  }

  update(dt: number) {
    for (const w of this.pool) {
      if (!w.active) continue;
      w.t += dt;
      if (w.t >= w.life) { w.active = false; w.sprite.visible = false; continue; }
      const k = w.t / w.life, pop = Math.min(1, w.t / 0.14);
      const s = w.size * (1 + 0.25 * Math.sin(pop * Math.PI)) * Math.min(1, pop * 1.4 + 0.05);
      w.sprite.scale.set(s * w.aspect, s, 1);
      w.sprite.position.set(w.base.x + Math.sin(w.t * 5) * 0.06, w.base.y + k * 0.9, w.base.z);
      w.mat.opacity = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    }
  }

  reset() {
    for (const w of this.pool) { w.active = false; w.sprite.visible = false; }
  }
}

/**
 * A fan of foamy water swept by the mop: a sector of radius `r` and full angle `angle` (degrees), apex at the caster, pointing along
 * `yaw`. `fire` starts the sweep: a bright leading edge runs across the fan in `life` s, the fan behind it fades out.
 */
export class SwipeFan {
  readonly mesh = new THREE.Group();
  private fan: THREE.Mesh;
  private edge: THREE.Mesh;
  private fanMat = mat(JANITOR.foam, 0);
  private edgeMat = mat(JANITOR.core, 0);
  private half: number;
  private age = 9;
  private life = 0.3;

  constructor(radius: number, angleDeg: number) {
    this.half = THREE.MathUtils.degToRad(angleDeg) / 2;
    const sector = (a0: number, a1: number, r0: number, r1: number) => {
      const pos: number[] = [], idx: number[] = [], n = 24;
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        pos.push(Math.sin(a) * r0, 0, Math.cos(a) * r0, Math.sin(a) * r1, 0, Math.cos(a) * r1);
        if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      return g;
    };
    this.fan = new THREE.Mesh(sector(-this.half, this.half, 0.2, radius), this.fanMat);
    this.edge = new THREE.Mesh(sector(-0.07, 0.07, 0.2, radius), this.edgeMat);
    this.fan.position.y = 0.06;
    this.edge.position.y = 0.07;
    this.fan.renderOrder = this.edge.renderOrder = 3;
    this.fan.frustumCulled = this.edge.frustumCulled = false;
    this.fan.visible = this.edge.visible = false;
    this.mesh.add(this.fan, this.edge);
  }

  get busy() {
    return this.age < this.life + 0.4;
  }

  fire(x: number, z: number, yaw: number, life = 0.18) {
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = yaw;
    this.age = 0;
    this.life = life;
    this.fan.visible = this.edge.visible = true;
  }

  update(dt: number) {
    if (this.age >= this.life + 0.4) { this.fan.visible = this.edge.visible = false; return; }
    this.age += dt;
    const k = Math.min(1, this.age / this.life);
    // The mop sweeps from the right of the fan to the left.
    this.edge.rotation.y = this.half * (1 - 2 * k);
    this.edgeMat.opacity = this.age < this.life ? 0.85 : Math.max(0, 0.85 * (1 - (this.age - this.life) / 0.15));
    this.fanMat.opacity = 0.5 * Math.max(0, 1 - Math.max(0, this.age - this.life * 0.4) / 0.5);
  }

  reset() {
    this.age = 9;
    this.fan.visible = this.edge.visible = false;
  }
}
