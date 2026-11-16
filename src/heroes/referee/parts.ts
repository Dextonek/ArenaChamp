import * as THREE from 'three';

/**
 * The referee kit (pipeline/designs/kit-referee.md): Referee Whistler, stern and by the book. Black and white stripes, a chrome
 * whistle, a yellow card and a red card. `SoundRings` = pooled rings of sound (a train behind a bolt, a ground ring that rushes
 * out); `CardFlight` = pooled cards that flip end over end through the air; `GroundSign` = a prohibition sign lying under a
 * victim; `buildWhistle` = the whistle on its cord; `PointingArm` = a big sleeved arm with one finger out; `cardLook`, `wordLook`
 * and `ringLook` = what `Trait.markLook` draws over the enemy; `paint*` = the canvas pictograms (the kit's icons use them too).
 * Everything is pooled or built once, takes world-space positions, has `reset()` where it holds state, and keeps every colour under
 * a base of about 0.72 (no pure white: the bloom turns it into a halo).
 */

/** Palette. Numbers for `THREE.Color`, `REFEREE_CSS` for APIs that want a string. `accent` is the white, `foil` the black. */
export const REFEREE = {
  white: 0xb4b4b4,
  pale: 0xa2a2a2,
  grey: 0x7c7c7c,
  foil: 0x1a1a1a,
  dark: 0x0e0e0e,
  yellow: 0xd9ac14,
  hotYellow: 0xe6c23a,
  red: 0xc4281c,
  hotRed: 0xdc3a2a,
  skin: 0xcfa583,
  accent: 0xb4b4b4,
} as const;

export const REFEREE_CSS = {
  /** The kit's accent, for the UI. */
  accent: '#f2f2f2',
  /** The white of a 3D surface (kept under the bloom). */
  white: '#b4b4b4',
  pale: '#a2a2a2',
  grey: '#7c7c7c',
  foil: '#1a1a1a',
  dark: '#0e0e0e',
  yellow: '#e6b800',
  hotYellow: '#f0cc48',
  red: '#e0382a',
  hotRed: '#ff5a48',
  skin: '#e2b998',
} as const;

const MIN = 1e-4;
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

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

const solid = (geo: THREE.BufferGeometry, color: number, at: [number, number, number] = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
  m.position.set(...at);
  return m;
};

/** A dark shell behind a mesh: the toon outline the project's figures use. */
function outlined(mesh: THREE.Mesh, grow = 1.08): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: REFEREE.dark, side: THREE.BackSide }));
  shell.position.copy(mesh.position);
  shell.rotation.copy(mesh.rotation);
  shell.scale.copy(mesh.scale).multiplyScalar(grow);
  g.add(shell, mesh);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Canvas pictograms (signs, icons)
// ---------------------------------------------------------------------------------------------------------------

/** A running figure, in the foil black, centred at (cx, cy) in a circle of radius r. */
export function paintRunner(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.strokeStyle = REFEREE_CSS.foil;
  g.fillStyle = REFEREE_CSS.foil;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = r * 0.15;
  g.beginPath();
  g.arc(cx + 0.14 * r, cy - 0.52 * r, 0.13 * r, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(cx + 0.06 * r, cy - 0.34 * r);
  g.lineTo(cx - 0.12 * r, cy + 0.1 * r);
  g.moveTo(cx + 0.02 * r, cy - 0.24 * r);
  g.lineTo(cx + 0.42 * r, cy - 0.04 * r);
  g.moveTo(cx + 0.02 * r, cy - 0.24 * r);
  g.lineTo(cx - 0.36 * r, cy - 0.16 * r);
  g.moveTo(cx - 0.12 * r, cy + 0.1 * r);
  g.lineTo(cx + 0.3 * r, cy + 0.32 * r);
  g.lineTo(cx + 0.24 * r, cy + 0.62 * r);
  g.moveTo(cx - 0.12 * r, cy + 0.1 * r);
  g.lineTo(cx - 0.38 * r, cy + 0.34 * r);
  g.lineTo(cx - 0.52 * r, cy + 0.56 * r);
  g.stroke();
}

/** A magic wand with a four-point star on its tip (a spell), in the foil black. */
export function paintWand(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.strokeStyle = REFEREE_CSS.foil;
  g.fillStyle = REFEREE_CSS.foil;
  g.lineCap = 'round';
  g.lineWidth = r * 0.16;
  g.beginPath();
  g.moveTo(cx - 0.5 * r, cy + 0.5 * r);
  g.lineTo(cx + 0.14 * r, cy - 0.14 * r);
  g.stroke();
  const star = (x: number, y: number, s: number) => {
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + s * 0.24, y - s * 0.24);
    g.lineTo(x + s, y);
    g.lineTo(x + s * 0.24, y + s * 0.24);
    g.lineTo(x, y + s);
    g.lineTo(x - s * 0.24, y + s * 0.24);
    g.lineTo(x - s, y);
    g.lineTo(x - s * 0.24, y - s * 0.24);
    g.closePath();
    g.fill();
  };
  star(cx + 0.36 * r, cy - 0.36 * r, 0.34 * r);
  star(cx + 0.5 * r, cy + 0.1 * r, 0.14 * r);
  star(cx - 0.02 * r, cy - 0.58 * r, 0.12 * r);
}

/** An open hand, palm toward the viewer (hands off), in the foil black. */
export function paintHand(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.fillStyle = REFEREE_CSS.foil;
  g.strokeStyle = REFEREE_CSS.foil;
  g.lineCap = 'round';
  g.beginPath();
  g.ellipse(cx, cy + 0.16 * r, 0.3 * r, 0.3 * r, 0, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = r * 0.14;
  const fingers: [number, number, number][] = [[-0.22, -0.1, -0.5], [-0.07, -0.18, -0.62], [0.08, -0.16, -0.6], [0.22, -0.06, -0.48]];
  for (const [dx, y0, y1] of fingers) {
    g.beginPath();
    g.moveTo(cx + dx * r, cy + y0 * r + 0.1 * r);
    g.lineTo(cx + dx * r * 1.1, cy + y1 * r);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(cx - 0.26 * r, cy + 0.2 * r);
  g.lineTo(cx - 0.52 * r, cy - 0.02 * r);
  g.stroke();
}

/** A round "no" sign: a pale plate, a pictogram, a red ring and a red bar from top left to bottom right. */
export function paintProhibit(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, picto: (g: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void) {
  g.fillStyle = REFEREE_CSS.dark;
  g.beginPath();
  g.arc(cx, cy, r * 1.02, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = REFEREE_CSS.white;
  g.beginPath();
  g.arc(cx, cy, r * 0.94, 0, Math.PI * 2);
  g.fill();
  picto(g, cx, cy, r * 0.8);
  g.strokeStyle = REFEREE_CSS.red;
  g.lineCap = 'butt';
  g.lineWidth = r * 0.17;
  g.beginPath();
  g.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = r * 0.15;
  g.beginPath();
  g.moveTo(cx - r * 0.57, cy - r * 0.57);
  g.lineTo(cx + r * 0.57, cy + r * 0.57);
  g.stroke();
}

/** A card standing up, `w` wide, centred at (cx, cy), tilted by `rot`: a dark edge, the colour, a pale shine. */
export function paintCard(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, color: string, rot = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const h = w * 1.4;
  const rr = (x: number, y: number, ww: number, hh: number, rad: number) => {
    g.beginPath();
    g.moveTo(x + rad, y);
    g.arcTo(x + ww, y, x + ww, y + hh, rad);
    g.arcTo(x + ww, y + hh, x, y + hh, rad);
    g.arcTo(x, y + hh, x, y, rad);
    g.arcTo(x, y, x + ww, y, rad);
    g.closePath();
  };
  g.fillStyle = REFEREE_CSS.dark;
  rr(-w / 2 - w * 0.06, -h / 2 - w * 0.06, w * 1.12, h + w * 0.12, w * 0.1);
  g.fill();
  g.fillStyle = color;
  rr(-w / 2, -h / 2, w, h, w * 0.07);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath();
  g.moveTo(-w / 2 + w * 0.08, -h / 2 + h * 0.08);
  g.lineTo(-w / 2 + w * 0.36, -h / 2 + h * 0.08);
  g.lineTo(-w / 2 + w * 0.08, -h / 2 + h * 0.4);
  g.closePath();
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------------------------------------------

interface Ring { mesh: THREE.Mesh; live: boolean; age: number; life: number; r0: number; r1: number; opacity: number }

/**
 * Pooled rings of sound. `fire` sends one out: `yaw` null lies it flat on the floor, a number stands it up facing that way (the way
 * a bolt flies). It grows from `r0` to `r1` with an ease-out and fades; `thick` picks a thin, middling or fat band.
 */
export class SoundRings {
  readonly group = new THREE.Group();
  private items: Ring[] = [];
  private cursor = 0;
  private geos = [0.05, 0.1, 0.2].map((th) => new THREE.RingGeometry(1 - th, 1, 56));

  constructor(n = 12, color: number = REFEREE.white) {
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(this.geos[1], new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }));
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.group.add(mesh);
      this.items.push({ mesh, live: false, age: 0, life: 1, r0: 1, r1: 1, opacity: 1 });
    }
  }

  get busy() {
    return this.items.some((i) => i.live);
  }

  fire(o: { x: number; y: number; z: number; r0: number; r1: number; life: number; yaw?: number | null; color?: number; opacity?: number; thick?: 0 | 1 | 2 }) {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    it.live = true;
    it.age = 0;
    it.life = o.life;
    it.r0 = o.r0;
    it.r1 = o.r1;
    it.opacity = o.opacity ?? 0.8;
    it.mesh.geometry = this.geos[o.thick ?? 1];
    it.mesh.position.set(o.x, o.y, o.z);
    if (o.yaw == null) it.mesh.rotation.set(-Math.PI / 2, 0, 0);
    else it.mesh.rotation.set(0, o.yaw, 0);
    (it.mesh.material as THREE.MeshBasicMaterial).color.set(o.color ?? REFEREE.white);
    it.mesh.visible = true;
    it.mesh.scale.setScalar(Math.max(MIN, o.r0));
  }

  reset() {
    for (const it of this.items) { it.live = false; it.mesh.visible = false; }
  }

  update(dt: number) {
    for (const it of this.items) {
      if (!it.live) continue;
      it.age += dt;
      if (it.age >= it.life) { it.live = false; it.mesh.visible = false; continue; }
      const p = it.age / it.life;
      it.mesh.scale.setScalar(Math.max(MIN, it.r0 + (it.r1 - it.r0) * easeOut(p)));
      (it.mesh.material as THREE.MeshBasicMaterial).opacity = it.opacity * Math.pow(1 - p, 0.8);
    }
  }
}

/** The whistle on its cord: a chrome barrel with a mouthpiece and a cork pea, along +x (the mouthpiece at -x). About 0.3 m long. */
export function buildWhistle(): THREE.Group {
  const g = new THREE.Group();
  const barrel = outlined(solid(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 14).rotateZ(Math.PI / 2), REFEREE.white, [0.04, 0, 0]));
  const mouth = outlined(solid(new THREE.BoxGeometry(0.16, 0.05, 0.1), REFEREE.pale, [-0.12, -0.02, 0]));
  const chamber = outlined(solid(new THREE.SphereGeometry(0.095, 14, 10), REFEREE.white, [0.1, 0, 0]));
  const hole = solid(new THREE.BoxGeometry(0.08, 0.012, 0.09), REFEREE.dark, [0.0, 0.074, 0]);
  const ring = solid(new THREE.TorusGeometry(0.035, 0.012, 6, 12), REFEREE.grey, [0.2, 0, 0]);
  g.add(barrel, mouth, chamber, hole, ring);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Cards in the air
// ---------------------------------------------------------------------------------------------------------------

interface Flight {
  live: boolean; age: number; delay: number; flight: number; hold: number;
  from: THREE.Vector3; to: THREE.Vector3; lift: number; spin: number; size: number; yaw: number; landed: boolean; color: THREE.Color;
  onLand?: (at: THREE.Vector3) => void;
}

/**
 * Pooled cards that fly from `from` to `to` in an arc, turning end over end (`spin` rad/s), then hang where they landed for `hold`
 * seconds and shrink away. A dark edge shows round the colour. `throw` is the one call; `onLand` fires when a card arrives.
 */
export class CardFlight {
  readonly group = new THREE.Group();
  private face: THREE.InstancedMesh;
  private edge: THREE.InstancedMesh;
  private items: Flight[] = [];
  private cursor = 0;
  private o = new THREE.Object3D();
  private c = new THREE.Color();

  constructor(private max = 8) {
    this.face = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.5, 0.03), new THREE.MeshBasicMaterial(), max);
    this.edge = new THREE.InstancedMesh(new THREE.BoxGeometry(0.43, 0.58, 0.02), new THREE.MeshBasicMaterial({ color: REFEREE.dark }), max);
    this.face.setColorAt(0, this.c.set(REFEREE.yellow));
    this.face.frustumCulled = false;
    this.edge.frustumCulled = false;
    this.face.count = 0;
    this.edge.count = 0;
    this.group.add(this.edge, this.face);
    for (let i = 0; i < max; i++) {
      this.items.push({
        live: false, age: 0, delay: 0, flight: 1, hold: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), lift: 1, spin: 10, size: 1, yaw: 0, landed: false, color: new THREE.Color(REFEREE.yellow),
      });
    }
  }

  get busy() {
    return this.items.some((i) => i.live);
  }

  throw(from: THREE.Vector3, to: THREE.Vector3, o: { delay?: number; flight?: number; color?: number; lift?: number; spin?: number; size?: number; hold?: number; onLand?: (at: THREE.Vector3) => void } = {}) {
    const f = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    f.live = true;
    f.age = 0;
    f.delay = o.delay ?? 0;
    f.flight = Math.max(0.05, o.flight ?? 0.4);
    f.hold = o.hold ?? 0.4;
    f.from.copy(from);
    f.to.copy(to);
    f.lift = o.lift ?? 1.4;
    f.spin = o.spin ?? 16;
    f.size = o.size ?? 1;
    f.yaw = Math.atan2(to.x - from.x, to.z - from.z);
    f.landed = false;
    f.onLand = o.onLand;
    f.color.set(o.color ?? REFEREE.yellow);
  }

  reset() {
    for (const f of this.items) f.live = false;
    this.face.count = 0;
    this.edge.count = 0;
  }

  update(dt: number) {
    let n = 0;
    for (let i = 0; i < this.items.length; i++) {
      const f = this.items[i];
      if (!f.live) continue;
      f.age += dt;
      const a = f.age - f.delay;
      if (a >= f.flight + f.hold) { f.live = false; continue; }
      if (a < 0) continue;
      const u = Math.min(1, a / f.flight);
      this.o.position.lerpVectors(f.from, f.to, u);
      this.o.position.y += f.lift * 4 * u * (1 - u);
      if (u < 1) this.o.rotation.set(f.spin * a, f.yaw, 0, 'YXZ');
      else {
        if (!f.landed) { f.landed = true; f.onLand?.(f.to); }
        // It hangs and turns slowly, face toward the camera's side.
        this.o.rotation.set(f.spin * f.flight + (a - f.flight) * 1.5, f.yaw, 0, 'YXZ');
        this.o.position.y += Math.sin((a - f.flight) * 4) * 0.05;
      }
      const grow = Math.min(1, a / 0.08), left = f.flight + f.hold - a;
      this.o.scale.setScalar(Math.max(MIN, f.size * grow * Math.min(1, left / 0.25)));
      this.o.updateMatrix();
      this.face.setMatrixAt(n, this.o.matrix);
      this.edge.setMatrixAt(n, this.o.matrix);
      this.face.setColorAt(n, f.color);
      n++;
    }
    this.face.count = n;
    this.edge.count = n;
    this.face.instanceMatrix.needsUpdate = true;
    this.edge.instanceMatrix.needsUpdate = true;
    if (this.face.instanceColor) this.face.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Signs on the floor
// ---------------------------------------------------------------------------------------------------------------

export type SignKind = 'run' | 'cast' | 'hands';
const signTextures = new Map<SignKind, THREE.CanvasTexture>();

function signTexture(kind: SignKind) {
  let tex = signTextures.get(kind);
  if (!tex) {
    tex = canvasTex(256, 256, (g, w, h) => paintProhibit(g, w / 2, h / 2, w * 0.48, kind === 'run' ? paintRunner : kind === 'cast' ? paintWand : paintHand));
    signTextures.set(kind, tex);
  }
  return tex;
}

/** A prohibition sign lying on the floor (normal up), `size` m across. It stamps down with a bounce and fades. */
export class GroundSign {
  readonly mesh: THREE.Mesh;

  constructor(kind: SignKind, readonly size = 2.4) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: signTexture(kind), transparent: true, depthWrite: false, opacity: 0 }));
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  set(x: number, z: number, opacity: number, scale = 1, y = 0.06) {
    this.mesh.visible = opacity > 0.01;
    this.mesh.position.set(x, y, z);
    this.mesh.scale.setScalar(Math.max(MIN, scale));
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The pointing arm
// ---------------------------------------------------------------------------------------------------------------

/**
 * A sleeved arm with one finger out, along +z from the shoulder at the origin (about 1.9 m long with the finger): a black sleeve with
 * a pale stripe, a white cuff, a fist with the index finger straight. The effect poses `group` (position, yaw, pitch, scale) and
 * `jab` slides the finger and fist forward.
 */
export class PointingArm {
  readonly group = new THREE.Group();
  private fist = new THREE.Group();

  constructor() {
    const sleeve = outlined(solid(new THREE.CylinderGeometry(0.17, 0.21, 1.2, 12).rotateX(Math.PI / 2), REFEREE.foil, [0, 0, 0.6]), 1.09);
    const stripe = solid(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12).rotateX(Math.PI / 2), REFEREE.white, [0, 0, 0.62]);
    const cuff = outlined(solid(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12).rotateX(Math.PI / 2), REFEREE.white, [0, 0, 1.24]), 1.1);
    const palm = outlined(solid(new THREE.SphereGeometry(0.19, 14, 10), REFEREE.skin, [0, 0, 1.42]), 1.09);
    palm.children[1].scale.set(1, 0.85, 1.15);
    const finger = outlined(solid(new THREE.CylinderGeometry(0.055, 0.065, 0.62, 8).rotateX(Math.PI / 2), REFEREE.skin, [0, 0.03, 1.8]), 1.12);
    const thumb = outlined(solid(new THREE.SphereGeometry(0.07, 8, 6), REFEREE.skin, [0.13, 0.0, 1.5]), 1.1);
    const curl: THREE.Object3D[] = [];
    for (let i = 0; i < 3; i++) curl.push(outlined(solid(new THREE.SphereGeometry(0.065, 8, 6), REFEREE.skin, [-0.06 + i * 0.06, -0.12, 1.5 + i * 0.01]), 1.1));
    this.fist.add(palm, finger, thumb, ...curl);
    this.group.add(sleeve, stripe, cuff, this.fist);
    this.group.visible = false;
  }

  /** Slides the fist and finger forward by `d` m (a jab). */
  jab(d: number) {
    this.fist.position.z = d;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Marks over the enemy (`Trait.markLook`)
// ---------------------------------------------------------------------------------------------------------------

/**
 * The cards a victim carries, hovering at the left of their head where the gameplay camera sees them: `yellow` 0 or 1 yellow card
 * in front, then `red` red cards (shown up to 3) fanned behind. Each pooled copy bobs and sways by itself (a card shows over the
 * head for the whole round, so it has to read as alive).
 */
export function cardLook(yellow: number, red: number): THREE.Object3D {
  const root = new THREE.Group();
  const hover = new THREE.Group();
  const total = yellow + red;
  const make = (color: number) => {
    const c = new THREE.Group();
    c.add(solid(new THREE.BoxGeometry(0.62, 0.86, 0.04), REFEREE.dark), solid(new THREE.BoxGeometry(0.52, 0.76, 0.06), color));
    const shine = solid(new THREE.BoxGeometry(0.1, 0.5, 0.07), 0xc8b878, [-0.15, 0.04, 0]);
    shine.visible = color === REFEREE.yellow;
    c.add(shine);
    return c;
  };
  for (let i = 0; i < total; i++) {
    const isRed = i < red;
    const card = make(isRed ? REFEREE.red : REFEREE.yellow);
    const k = total === 1 ? 0 : i / (total - 1) - 0.5;
    card.position.set(k * 0.9, Math.abs(k) * -0.12, -i * 0.05);
    card.rotation.z = -k * 0.55;
    hover.add(card);
  }
  hover.position.set(-1.05, 2.55, 0);
  hover.scale.setScalar(1.1);
  root.add(hover);
  // Bob and sway, a frame behind: the pool draws the same object for as long as the mark lives.
  const first = hover.children[0] as THREE.Object3D | undefined;
  const target = first?.children[0] as THREE.Mesh | undefined;
  if (target) {
    target.onBeforeRender = () => {
      const t = performance.now() / 1000;
      hover.position.y = 2.55 + Math.sin(t * 3.1) * 0.07;
      hover.rotation.y = Math.sin(t * 1.7) * 0.4;
    };
  }
  return root;
}

const wordTextures = new Map<string, THREE.CanvasTexture>();

/**
 * A big word on a card-coloured plate over the victim (`Trait.markLook`), slightly crooked: RED CARD on red, YELLOW CARD on yellow.
 * Over everything (no depth test), 3.2 m wide, 4.2 m up (above the rule's label).
 */
export function wordLook(text: string, plate: string, ink: string = REFEREE_CSS.white): THREE.Object3D {
  const key = text + plate;
  let tex = wordTextures.get(key);
  if (!tex) {
    tex = canvasTex(512, 170, (g, w, h) => {
      g.translate(w / 2, h / 2);
      g.rotate(-0.06);
      g.lineJoin = 'round';
      g.fillStyle = REFEREE_CSS.dark;
      g.fillRect(-w / 2 + 14, -h / 2 + 12, w - 28, h - 24);
      g.fillStyle = plate;
      g.fillRect(-w / 2 + 28, -h / 2 + 26, w - 56, h - 52);
      g.font = '900 88px Impact, Arial Black, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 14;
      g.strokeStyle = REFEREE_CSS.dark;
      g.strokeText(text, 0, 6, w - 90);
      g.fillStyle = ink;
      g.fillText(text, 0, 6, w - 90);
    });
    wordTextures.set(key, tex);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set(3.2, 1.06, 1);
  s.position.y = 4.2;
  s.renderOrder = 7;
  const g = new THREE.Group();
  g.add(s);
  return g;
}

/** A short whistle ring on the floor under the victim (the red card): a pale band with a dark edge, 1.9 m across. */
export function ringLook(): THREE.Object3D {
  const g = new THREE.Group();
  const dark = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.0, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: REFEREE.dark, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  const band = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.9, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: REFEREE.white, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  const red = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.64, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: REFEREE.hotRed, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  for (const m of [dark, band, red]) { m.position.y = 0.08; m.renderOrder = 2; }
  g.add(dark, band, red);
  g.scale.setScalar(1.9);
  return g;
}
