import * as THREE from 'three';

/**
 * The ledger kit (pipeline/designs/kit-ledger.md): Mr. Ledger, the debt collector. Cream paper, black ink, red rubber-stamp ink,
 * gold leaf and a dark green cloth cover. `Invoice` = a sheet of paper whose corners flutter (a bent plane, animated by
 * `flutter`); `PaperBits` = pooled loose scraps that tumble; `Coins` = pooled gold coins that bounce; `InkSplats` = red ink
 * stains on the floor; `buildStamp` = a huge rubber stamp (wood block, brass band, knob) with its face at y 0; `GroundWord` =
 * the print a stamp leaves; `Tome` = the ledger itself, which opens, is written in by a pencil, and shuts; `wordLook` = the
 * big red word over a victim (`Trait.markLook`). Everything is pooled or built once, takes world-space positions, has `reset()`
 * where it holds state, and stays under the bloom threshold (no colour above 0.92).
 */

/** Palette. Numbers for `THREE.Color`, `LEDGER_CSS` for APIs that want a string. `accent` is the gold, `foil` the green cloth. */
export const LEDGER = {
  core: 0xf5edd0,
  hot: 0xefe4c0,
  paper: 0xe6d9ae,
  shade: 0xb9aa7c,
  gold: 0xd9c27a,
  brass: 0xb08a3a,
  foil: 0x3f4a3a,
  cloth: 0x2d3a2c,
  wood: 0x6d4a2a,
  ink: 0x1c211c,
  red: 0xb3261e,
  hotRed: 0xd9453a,
  dark: 0x161a14,
  accent: 0xd9c27a,
} as const;

export const LEDGER_CSS = {
  core: '#f5edd0',
  hot: '#efe4c0',
  paper: '#e6d9ae',
  shade: '#b9aa7c',
  gold: '#d9c27a',
  brass: '#b08a3a',
  foil: '#3f4a3a',
  cloth: '#2d3a2c',
  wood: '#6d4a2a',
  ink: '#1c211c',
  red: '#b3261e',
  hotRed: '#d9453a',
  dark: '#161a14',
  accent: '#d9c27a',
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

/** A dark shell behind a mesh: the toon outline the project's figures use. */
function outlined(mesh: THREE.Mesh, grow = 1.07): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: LEDGER.dark, side: THREE.BackSide }));
  shell.position.copy(mesh.position);
  shell.rotation.copy(mesh.rotation);
  shell.scale.copy(mesh.scale).multiplyScalar(grow);
  g.add(shell, mesh);
  return g;
}

const solid = (geo: THREE.BufferGeometry, color: number, at: [number, number, number] = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
  m.position.set(...at);
  return m;
};

// ---------------------------------------------------------------------------------------------------------------
// Paper
// ---------------------------------------------------------------------------------------------------------------

/** The face of an invoice: a header, ruled rows with small writing, a total with a dollar sign and a red rubber stamp. */
function paperTexture(title: string, stamp: string) {
  return canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = LEDGER_CSS.paper;
    g.fillRect(0, 0, w, h);
    g.fillStyle = LEDGER_CSS.shade;
    g.fillRect(0, 0, w, 6);
    g.fillRect(0, h - 6, w, 6);
    g.fillStyle = LEDGER_CSS.ink;
    g.font = '900 34px Georgia, serif';
    g.textAlign = 'center';
    g.fillText(title, w / 2, 52, w - 30);
    g.fillRect(24, 66, w - 48, 4);
    g.strokeStyle = LEDGER_CSS.shade;
    g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = 100 + i * 28;
      g.beginPath();
      g.moveTo(24, y);
      g.lineTo(w - 24, y);
      g.stroke();
      g.fillStyle = LEDGER_CSS.ink;
      g.fillRect(30, y - 12, 40 + ((i * 37) % 70), 6);
      g.fillRect(w - 78, y - 12, 44, 6);
    }
    g.fillStyle = LEDGER_CSS.ink;
    g.font = '900 54px Georgia, serif';
    g.textAlign = 'left';
    g.fillText('$', 28, 280);
    g.fillRect(70, 284, w - 98, 5);
    g.save();
    g.translate(w * 0.62, h * 0.55);
    g.rotate(-0.38);
    g.strokeStyle = LEDGER_CSS.red;
    g.fillStyle = LEDGER_CSS.red;
    g.globalAlpha = 0.9;
    g.lineWidth = 6;
    g.strokeRect(-70, -26, 140, 52);
    g.font = '900 38px Impact, Arial Black, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(stamp, 0, 2, 124);
    g.restore();
  });
}

/**
 * One sheet of paper: a plane in XY (normal +z) cut into a grid, so `flutter` can ripple it. The effect poses `mesh` (a flight
 * lays it flat and wobbles it; a falling notice lets it sink and settle).
 */
export class Invoice {
  readonly mesh: THREE.Mesh;
  private base: Float32Array;
  private pos: THREE.BufferAttribute;

  constructor(readonly w = 0.7, readonly h = 0.9, title = 'INVOICE', stamp = 'DUE') {
    const geo = new THREE.PlaneGeometry(w, h, 6, 8);
    this.pos = geo.attributes.position as THREE.BufferAttribute;
    this.base = (this.pos.array as Float32Array).slice();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: paperTexture(title, stamp), side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Ripples the sheet: `amp` 0 is flat, 1 a sheet in a stiff breeze. */
  flutter(time: number, amp = 1, speed = 14) {
    const a = this.pos.array as Float32Array;
    for (let i = 0; i < a.length; i += 3) {
      const x = this.base[i], y = this.base[i + 1];
      const edge = 0.45 + Math.abs(y) / this.h * 1.1;
      a[i + 2] = (Math.sin(x * 9 / this.w + time * speed) * 0.55 + Math.sin(y * 6 / this.h - time * speed * 0.75) * 0.45) * 0.075 * amp * edge * this.w;
    }
    this.pos.needsUpdate = true;
  }
}

interface Bit { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; phase: number; spin: THREE.Vector3; flat: boolean }

/** Loose scraps of paper (and torn red notices) that spin and drift down, shrinking at the end. */
export class PaperBits {
  readonly mesh: THREE.InstancedMesh;
  private bits: Bit[] = [];
  private cursor = 0;
  private o = new THREE.Object3D();
  private c = new THREE.Color();

  constructor(private max = 60) {
    const geo = new THREE.PlaneGeometry(0.2, 0.26);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), max);
    this.mesh.setColorAt(0, this.c.set(LEDGER.paper));
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.bits.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size: 1, phase: 0, spin: new THREE.Vector3(), flat: false });
  }

  get busy() {
    return this.bits.some((b) => b.live);
  }

  /** A burst from `pos`: `speed` m/s outward with a lift. `red`: the share of scraps that are red notices. */
  burst(pos: THREE.Vector3, count: number, speed = 4, size = 1, red = 0.2) {
    for (let i = 0; i < count; i++) {
      const b = this.bits[this.cursor];
      const slot = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      b.live = true;
      b.pos.copy(pos);
      const a = Math.random() * Math.PI * 2, up = 0.3 + Math.random() * 1.0, sp = speed * (0.4 + Math.random() * 0.8);
      b.vel.set(Math.cos(a), up, Math.sin(a)).normalize().multiplyScalar(sp);
      b.age = 0;
      b.life = 1.1 + Math.random() * 0.8;
      b.size = size * (0.8 + Math.random() * 0.5);
      b.phase = Math.random() * 6.28;
      b.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      this.mesh.setColorAt(slot, this.c.set(Math.random() < red ? LEDGER.hotRed : Math.random() < 0.25 ? LEDGER.gold : LEDGER.paper));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** A stream thrown at `to` from `from`: scraps sent in a loose cone toward it. */
  throwAt(from: THREE.Vector3, to: THREE.Vector3, count: number, speed = 9, size = 1) {
    this.burst(from, count, 2, size, 0.3);
    const dx = to.x - from.x, dz = to.z - from.z, l = Math.hypot(dx, dz) || 1;
    let n = 0;
    for (let k = this.cursor - 1; n < count; k--, n++) {
      const b = this.bits[(k + this.max) % this.max];
      b.vel.set((dx / l) * speed * (0.7 + Math.random() * 0.5) + (Math.random() - 0.5) * 2.2, 1.2 + Math.random() * 1.4, (dz / l) * speed * (0.7 + Math.random() * 0.5) + (Math.random() - 0.5) * 2.2);
    }
  }

  reset() {
    for (const b of this.bits) b.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let n = 0;
    for (const b of this.bits) {
      if (!b.live) continue;
      b.age += dt;
      if (b.age >= b.life) { b.live = false; continue; }
      b.vel.y -= 3.4 * dt;
      const drag = Math.exp(-1.7 * dt);
      b.vel.x *= drag;
      b.vel.z *= drag;
      b.vel.y *= Math.exp(-0.9 * dt);
      b.pos.addScaledVector(b.vel, dt);
      b.pos.x += Math.sin(b.age * 8 + b.phase) * 0.5 * dt;
      if (b.pos.y < 0.03) { b.pos.y = 0.03; b.vel.set(0, 0, 0); b.flat = true; }
      const left = b.life - b.age, k = Math.min(1, left / 0.35) * b.size;
      this.o.position.copy(b.pos);
      if (b.flat) this.o.rotation.set(-Math.PI / 2, 0, b.phase);
      else this.o.rotation.set(b.age * b.spin.x + b.phase, b.age * b.spin.y, b.age * b.spin.z);
      this.o.scale.setScalar(Math.max(MIN, k));
      this.o.updateMatrix();
      this.mesh.setMatrixAt(n++, this.o.matrix);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Coins
// ---------------------------------------------------------------------------------------------------------------

interface Coin { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; spin: number; ang: number }

/** Gold coins thrown up and bounced on the floor. */
export class Coins {
  readonly mesh: THREE.InstancedMesh;
  private coins: Coin[] = [];
  private cursor = 0;
  private o = new THREE.Object3D();

  constructor(private max = 30) {
    const geo = new THREE.CylinderGeometry(0.17, 0.17, 0.045, 14);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: LEDGER.gold }), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.coins.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, spin: 0, ang: 0 });
  }

  get busy() {
    return this.coins.some((c) => c.live);
  }

  burst(pos: THREE.Vector3, count: number, speed = 5) {
    for (let i = 0; i < count; i++) {
      const c = this.coins[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
      c.live = true;
      c.pos.copy(pos);
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.7);
      c.vel.set(Math.cos(a) * sp, 5 + Math.random() * 4, Math.sin(a) * sp);
      c.age = 0;
      c.life = 1.5 + Math.random() * 0.5;
      c.spin = 8 + Math.random() * 10;
      c.ang = Math.random() * 6;
    }
  }

  reset() {
    for (const c of this.coins) c.live = false;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let n = 0;
    for (const c of this.coins) {
      if (!c.live) continue;
      c.age += dt;
      if (c.age >= c.life) { c.live = false; continue; }
      c.vel.y -= 16 * dt;
      c.pos.addScaledVector(c.vel, dt);
      if (c.pos.y < 0.05) {
        c.pos.y = 0.05;
        c.vel.y = Math.abs(c.vel.y) * 0.45;
        c.vel.x *= 0.7;
        c.vel.z *= 0.7;
        c.spin *= 0.6;
      }
      c.ang += c.spin * dt;
      const left = c.life - c.age;
      this.o.position.copy(c.pos);
      this.o.rotation.set(c.ang, 0, c.ang * 0.5);
      this.o.scale.setScalar(Math.max(MIN, Math.min(1, left / 0.3)));
      this.o.updateMatrix();
      this.mesh.setMatrixAt(n++, this.o.matrix);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Ink on the floor
// ---------------------------------------------------------------------------------------------------------------

function blobTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2, r = w * (0.28 + 0.12 * Math.sin(i * 2.3) + 0.06 * Math.sin(i * 5.1 + 1));
      const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.fill();
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + 0.3, d = w * (0.34 + (i % 3) * 0.05);
      g.beginPath();
      g.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, w * (0.025 + (i % 4) * 0.012), 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** Red (or black) ink stains on the floor: they spread out fast, hold, and dry away. */
export class InkSplats {
  readonly group = new THREE.Group();
  private items: { mesh: THREE.Mesh; age: number; life: number; r: number; live: boolean }[] = [];
  private cursor = 0;

  constructor(n = 8) {
    const tex = blobTexture();
    const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: LEDGER.red, transparent: true, depthWrite: false, opacity: 0 }));
      mesh.renderOrder = 1;
      mesh.visible = false;
      this.group.add(mesh);
      this.items.push({ mesh, age: 0, life: 1, r: 1, live: false });
    }
  }

  splat(x: number, z: number, r: number, color: number = LEDGER.red, life = 2.6) {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    it.live = true;
    it.age = 0;
    it.life = life;
    it.r = r;
    it.mesh.position.set(x, 0.04 + this.cursor * 0.002, z);
    it.mesh.rotation.y = Math.random() * 6.28;
    (it.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    it.mesh.visible = true;
  }

  reset() {
    for (const it of this.items) { it.live = false; it.mesh.visible = false; }
  }

  update(dt: number) {
    for (const it of this.items) {
      if (!it.live) continue;
      it.age += dt;
      if (it.age >= it.life) { it.live = false; it.mesh.visible = false; continue; }
      const grow = 1 - Math.pow(1 - Math.min(1, it.age / 0.18), 3);
      it.mesh.scale.setScalar(Math.max(MIN, it.r * (0.3 + 0.7 * grow)));
      (it.mesh.material as THREE.MeshBasicMaterial).opacity = 0.88 * Math.min(1, (it.life - it.age) / 0.8);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The rubber stamp and its print
// ---------------------------------------------------------------------------------------------------------------

/**
 * A huge rubber stamp, its rubber face at y 0 (facing down) and its handle up: a brass band round a wooden block, a turned neck
 * and a round knob. `w` x `d` is the face; the whole is about 1.6 w tall. Lift it with `position.y`.
 */
export function buildStamp(w = 3.2, d = 1.4): THREE.Group {
  const g = new THREE.Group();
  const rubber = solid(new THREE.BoxGeometry(w, 0.1, d), LEDGER.hotRed, [0, 0.05, 0]);
  const plate = solid(new THREE.BoxGeometry(w * 1.02, 0.16, d * 1.02), LEDGER.dark, [0, 0.18, 0]);
  const block = outlined(solid(new THREE.BoxGeometry(w * 0.9, 0.55, d * 0.86), LEDGER.wood, [0, 0.54, 0]));
  const band = solid(new THREE.BoxGeometry(w * 0.93, 0.12, d * 0.9), LEDGER.brass, [0, 0.62, 0]);
  const neck = outlined(solid(new THREE.CylinderGeometry(w * 0.075, w * 0.12, w * 0.3, 14), LEDGER.wood, [0, 0.8 + w * 0.15, 0]));
  const ring = solid(new THREE.CylinderGeometry(w * 0.13, w * 0.13, 0.08, 18), LEDGER.brass, [0, 0.82 + w * 0.3, 0]);
  const knob = outlined(solid(new THREE.SphereGeometry(w * 0.19, 18, 12), LEDGER.wood, [0, 0.9 + w * 0.46, 0]));
  knob.children[1].scale.y = 0.85;
  const shine = solid(new THREE.SphereGeometry(w * 0.05, 8, 6), LEDGER.hot, [w * 0.07, 1.0 + w * 0.5, w * 0.08]);
  g.add(rubber, plate, block, band, neck, ring, knob, shine);
  g.visible = false;
  return g;
}

/** A word printed on the floor in rubber-stamp ink: a double border and rough, uneven ink. Flat (normal up). */
export class GroundWord {
  readonly mesh: THREE.Mesh;

  constructor(text: string, readonly w = 3.8, readonly d = 1.5, color: string = LEDGER_CSS.red) {
    const tex = canvasTex(512, Math.round(512 * d / w), (g, cw, ch) => {
      g.strokeStyle = color;
      g.fillStyle = color;
      g.lineWidth = 12;
      g.strokeRect(10, 10, cw - 20, ch - 20);
      g.lineWidth = 4;
      g.strokeRect(28, 28, cw - 56, ch - 56);
      g.font = '900 116px Impact, Arial Black, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, cw / 2, ch / 2 + 6, cw - 90);
      // Rough ink: scrape little gaps out of the print.
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 260; i++) {
        g.globalAlpha = 0.2 + Math.random() * 0.5;
        g.fillRect(Math.random() * cw, Math.random() * ch, 2 + Math.random() * 7, 1 + Math.random() * 3);
      }
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  set(x: number, z: number, yaw: number, opacity: number, scale = 1) {
    this.mesh.visible = opacity > 0.01;
    this.mesh.position.set(x, 0.07, z);
    this.mesh.rotation.y = yaw;
    this.mesh.scale.setScalar(scale);
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The tome
// ---------------------------------------------------------------------------------------------------------------

/**
 * The ledger itself: dark green cloth covers with gold corners, ruled pages, a pencil. Standing upright with its spine at x 0, y 0
 * (about 1.5 m tall, 2.2 m wide open). `open` 0 is shut (both covers together), 1 is open flat-ish. `scratch(p)` writes numbers on the
 * right page up to `p` (0..1) and moves the pencil along; `reset()` clears the page.
 */
export class Tome {
  readonly group = new THREE.Group();
  private left = new THREE.Group();
  private right = new THREE.Group();
  private pencil = new THREE.Group();
  private page: HTMLCanvasElement;
  private tex: THREE.CanvasTexture;
  private path: [number, number][] = [];
  private drawn = 0;

  constructor() {
    this.page = document.createElement('canvas');
    this.page.width = 256;
    this.page.height = 320;
    this.tex = new THREE.CanvasTexture(this.page);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.ruled();
    // The pencil's route: six rows of little loops that look like writing.
    for (let r = 0; r < 6; r++) {
      const y = 64 + r * 38;
      for (let i = 0; i <= 16; i++) this.path.push([30 + i * 12 + (i % 2) * 3, y + (i % 2 ? -9 : 8) + ((i * 7 + r * 3) % 5)]);
    }
    const cover = (sx: number) => {
      const holder = sx < 0 ? this.left : this.right;
      holder.add(outlined(solid(new THREE.BoxGeometry(1.12, 1.48, 0.08), LEDGER.cloth, [sx * 0.56, 0.75, -0.06])));
      for (const cx of [-1, 1]) for (const cy of [0, 1]) holder.add(solid(new THREE.BoxGeometry(0.18, 0.18, 0.1), LEDGER.gold, [sx * (0.56 + cx * 0.47), 0.04 + cy * 1.42, -0.06]));
      holder.add(solid(new THREE.BoxGeometry(0.5, 0.2, 0.09), LEDGER.gold, [sx * 0.56, 1.1, -0.06]));
      const pageMat = new THREE.MeshBasicMaterial({ color: LEDGER.paper });
      if (sx > 0) { pageMat.map = this.tex; pageMat.color.set(0xffffff); }
      const pg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.36), pageMat);
      pg.position.set(sx * 0.56, 0.75, 0.0);
      holder.add(pg);
    };
    cover(-1);
    cover(1);
    this.pencil.add(
      solid(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6).rotateZ(Math.PI / 2), 0xd9a63a, [0.3, 0, 0]),
      solid(new THREE.ConeGeometry(0.035, 0.1, 6).rotateZ(Math.PI / 2), LEDGER.shade, [-0.05, 0, 0]),
      solid(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 6).rotateZ(Math.PI / 2), 0xd96a6a, [0.63, 0, 0]),
    );
    this.group.add(this.left, this.right, this.pencil);
    this.group.visible = false;
    this.set(0, 0);
  }

  private ruled() {
    const g = this.page.getContext('2d')!;
    g.fillStyle = LEDGER_CSS.paper;
    g.fillRect(0, 0, 256, 320);
    g.strokeStyle = LEDGER_CSS.shade;
    g.lineWidth = 2;
    for (let y = 64; y < 300; y += 38) { g.beginPath(); g.moveTo(14, y + 12); g.lineTo(242, y + 12); g.stroke(); }
    g.strokeStyle = '#b05a5a';
    g.beginPath();
    g.moveTo(24, 20);
    g.lineTo(24, 310);
    g.stroke();
    g.fillStyle = LEDGER_CSS.ink;
    g.font = '900 24px Georgia, serif';
    g.fillText('ACCOUNTS DUE', 34, 36);
    this.tex.needsUpdate = true;
    this.drawn = 0;
  }

  /** Writes up to `p` of the route (only forward: calling it with a smaller `p` does nothing). */
  scratch(p: number, time = 0) {
    const upto = Math.floor(Math.min(1, Math.max(0, p)) * (this.path.length - 1));
    if (upto > this.drawn) {
      const g = this.page.getContext('2d')!;
      g.strokeStyle = '#2b2b2b';
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(this.path[this.drawn][0], this.path[this.drawn][1]);
      for (let i = this.drawn + 1; i <= upto; i++) g.lineTo(this.path[i][0], this.path[i][1]);
      g.stroke();
      this.drawn = upto;
      this.tex.needsUpdate = true;
    }
    // The pencil follows the end of the line (page px -> metres on the right page), and jitters like a hand.
    const [px, py] = this.path[this.drawn];
    this.pencil.position.set(0.06 + (px / 256) * 1.0, 0.75 + (0.5 - py / 320) * 1.36 + Math.sin(time * 70) * 0.012, 0.1);
    this.pencil.rotation.z = 0.5 + Math.sin(time * 40) * 0.05;
    this.pencil.visible = p > 0 && p < 1.001;
  }

  /** Both covers' angle: 0 shut (face to face), 1 open. Also hides the pencil while shut. */
  set(open: number, time = 0) {
    const a = Math.min(1, Math.max(0, open));
    const ang = (1 - a) * (Math.PI / 2) + 0.1;
    // Hinged at the spine; folding forward (+z) brings the two pages face to face.
    this.left.rotation.y = ang;
    this.right.rotation.y = -ang;
    if (a <= 0.01) this.pencil.visible = false;
    void time;
  }

  reset() {
    this.ruled();
    this.pencil.visible = false;
    this.set(0, 0);
    this.group.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Words over a victim
// ---------------------------------------------------------------------------------------------------------------

const wordTextures = new Map<string, THREE.CanvasTexture>();

/**
 * A big word in red rubber-stamp lettering, slightly crooked, floating over the victim (`Trait.markLook`: a pooled object with its
 * feet at y 0, so the sprite sits 2.9 m up). It reads from the gameplay camera: 3.4 m wide, over everything (no depth test).
 */
export function wordLook(text: string, color: string = LEDGER_CSS.red): THREE.Object3D {
  let tex = wordTextures.get(text + color);
  if (!tex) {
    tex = canvasTex(512, 160, (g, w, h) => {
      g.translate(w / 2, h / 2);
      g.rotate(-0.09);
      g.lineJoin = 'round';
      g.font = '900 96px Impact, Arial Black, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 16;
      g.strokeStyle = 'rgba(245,237,208,0.95)';
      g.strokeRect(-w / 2 + 26, -h / 2 + 18, w - 52, h - 36);
      g.strokeText(text, 0, 6, w - 90);
      g.strokeStyle = color;
      g.lineWidth = 8;
      g.strokeRect(-w / 2 + 26, -h / 2 + 18, w - 52, h - 36);
      g.fillStyle = color;
      g.fillText(text, 0, 6, w - 90);
    });
    wordTextures.set(text + color, tex);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set(3.4, 1.06, 1);
  s.position.y = 2.9;
  s.renderOrder = 7;
  const g = new THREE.Group();
  g.add(s);
  return g;
}
