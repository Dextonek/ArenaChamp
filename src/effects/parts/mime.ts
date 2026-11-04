import * as THREE from 'three';

/**
 * The mime kit (pipeline/designs/kit-mime.md): Mum. Black and white, chalk on stone, with one red accent from her scarf.
 * `ChalkDashes` = a dashed chalk line on the floor over a dark layer (grows along its length); `Flecks` = chalk chips and
 * flakes that fly and fall; `Gloves` = pooled white gloves with a dark cuff (the hands she mimes with: open palm to a fist);
 * `ScarfTail` = a short red ribbon that flutters; `wallLook` / `crumbLook` = what a wall and a broken wall leave on the floor
 * (`Trait.markLook`): faint chalk and a faint shimmer in the air. Everything takes world-space positions, has `reset()` where
 * it holds state, and stays plain (no additive glow: this kit is not bright).
 */

export const MIME = {
  chalk: 0xf7f7f2,
  dim: 0xcfcfc8,
  smudge: 0x8d8d96,
  dark: 0x20202a,
  ink: 0x0c0c12,
  red: 0xd23a3a,
  foil: 0x20202a,
} as const;

export const MIME_CSS = {
  chalk: '#f7f7f2',
  dim: '#cfcfc8',
  smudge: '#8d8d96',
  dark: '#20202a',
  ink: '#0c0c12',
  red: '#d23a3a',
  foil: '#20202a',
} as const;

const MIN_SCALE = 1e-4;
const UP = new THREE.Vector3(0, 1, 0);
/** A tiny deterministic wobble, so chalk does not look ruled. */
const wobble = (i: number) => Math.sin(i * 12.9898) * 0.5 + Math.sin(i * 4.1414) * 0.5;

// ---------------------------------------------------------------------------------------------------------------
// ChalkDashes: a dashed chalk line on the floor, over a wider dark layer.
// ---------------------------------------------------------------------------------------------------------------

/**
 * Dashes on the floor along segments added with `add`. `show(k)` draws the first share `k` (0..1) of them, so a line can be
 * drawn along its length; `opacity` fades all of it. `clear()` empties it. Add `mesh`.
 */
export class ChalkDashes {
  readonly mesh = new THREE.Group();
  opacity = 1;
  private dashes: THREE.InstancedMesh;
  private shades: THREE.InstancedMesh;
  private n = 0;
  private shown = 1;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private dashMat = new THREE.MeshBasicMaterial({ color: MIME.chalk, transparent: true, depthWrite: false });
  private shadeMat = new THREE.MeshBasicMaterial({ color: MIME.ink, transparent: true, depthWrite: false });

  constructor(private max = 60, private shadeOpacity = 0.4) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.shades = new THREE.InstancedMesh(geo, this.shadeMat, max);
    this.dashes = new THREE.InstancedMesh(geo, this.dashMat, max);
    this.shades.renderOrder = 2;
    this.dashes.renderOrder = 3;
    for (const m of [this.shades, this.dashes]) { m.frustumCulled = false; m.count = 0; }
    this.mesh.add(this.shades, this.dashes);
  }

  clear() {
    this.n = 0;
    this.shown = 1;
    this.apply();
  }

  /** Adds dashes of `len` with `gap` between, from (x1,z1) to (x2,z2), `width` wide. Returns how many were added. */
  add(x1: number, z1: number, x2: number, z2: number, len = 0.32, gap = 0.2, width = 0.1) {
    const dx = x2 - x1, dz = z2 - z1, total = Math.hypot(dx, dz);
    if (total < 1e-3) return 0;
    const ux = dx / total, uz = dz / total, yaw = Math.atan2(ux, uz);
    let d = 0, added = 0;
    while (d < total && this.n < this.max) {
      const l = Math.min(len * (0.85 + 0.15 * (wobble(this.n + 1) + 1)), total - d);
      const c = d + l / 2, i = this.n++;
      const side = wobble(i) * 0.015;
      this.p.set(x1 + ux * c - uz * side, 0.04, z1 + uz * c + ux * side);
      this.q.setFromAxisAngle(UP, yaw + wobble(i + 7) * 0.05);
      this.m.compose(this.p, this.q, this.s.set(width * (0.8 + 0.2 * (wobble(i + 3) + 1)), 1, l));
      this.dashes.setMatrixAt(i, this.m);
      this.m.compose(this.p.setY(0.03), this.q, this.s.set(width * 2.2, 1, l + 0.06));
      this.shades.setMatrixAt(i, this.m);
      d += l + gap;
      added++;
    }
    this.dashes.instanceMatrix.needsUpdate = true;
    this.shades.instanceMatrix.needsUpdate = true;
    this.apply();
    return added;
  }

  show(k: number) {
    this.shown = THREE.MathUtils.clamp(k, 0, 1);
    this.apply();
  }

  private apply() {
    const c = Math.round(this.n * this.shown);
    this.dashes.count = this.shades.count = c;
    this.mesh.visible = c > 0 && this.opacity > 0.01;
    this.dashMat.opacity = this.opacity;
    this.shadeMat.opacity = this.opacity * this.shadeOpacity;
  }

  setOpacity(o: number) {
    this.opacity = o;
    this.apply();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Flecks: chalk chips and flakes.
// ---------------------------------------------------------------------------------------------------------------

interface Fleck { live: boolean; pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; spin: number; angle: number; color: THREE.Color }

/** Small flat chips of chalk (and a few dark ones) that fly, tumble and fall. `burst`, `line` (drift along a line), `update`. Add `mesh`. */
export class Flecks {
  readonly mesh: THREE.InstancedMesh;
  private flecks: Fleck[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(private max = 80) {
    const geo = new THREE.PlaneGeometry(1, 0.7);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.flecks.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 0.6, size: 0.1, spin: 0, angle: 0, color: new THREE.Color() });
  }

  get busy() {
    return this.flecks.some((f) => f.live);
  }

  reset() {
    for (const f of this.flecks) f.live = false;
    this.mesh.count = 0;
  }

  private spawn(pos: THREE.Vector3, vel: THREE.Vector3, size: number, life: number, dark: boolean, color?: number) {
    const f = this.flecks[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    f.live = true;
    f.pos.copy(pos);
    f.vel.copy(vel);
    f.age = 0;
    f.life = life;
    f.size = size;
    f.spin = (Math.random() - 0.5) * 14;
    f.angle = Math.random() * 6.28;
    f.color.set(color ?? (dark ? MIME.dark : Math.random() < 0.3 ? MIME.dim : MIME.chalk));
  }

  /** A burst of chips from `pos`, `speed` m/s, `size` x the usual 0.1 m; `up` favours a fountain over a ring. */
  burst(pos: THREE.Vector3, count = 8, speed = 3, size = 1, up = 0.6, color?: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
      this.spawn(pos, this.s.set(Math.cos(a), up * (0.4 + Math.random()), Math.sin(a)).normalize().multiplyScalar(sp), (0.07 + Math.random() * 0.08) * size, 0.45 + Math.random() * 0.45, Math.random() < 0.18, color);
    }
  }

  /** `count` chips set along the segment a to b, drifting off sideways: a chalk stroke through the air. */
  line(a: THREE.Vector3, b: THREE.Vector3, count = 6, size = 1) {
    for (let i = 0; i < count; i++) {
      const k = Math.random();
      const p = new THREE.Vector3().lerpVectors(a, b, k);
      this.spawn(p, this.s.set((Math.random() - 0.5) * 0.8, 0.2 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8), (0.05 + Math.random() * 0.05) * size, 0.35 + Math.random() * 0.3, false);
    }
  }

  update(dt: number) {
    let n = 0;
    for (const f of this.flecks) {
      if (!f.live) continue;
      f.age += dt;
      if (f.age >= f.life) { f.live = false; continue; }
      f.vel.multiplyScalar(Math.max(0, 1 - 2.2 * dt));
      f.vel.y -= 6 * dt;
      f.pos.addScaledVector(f.vel, dt);
      if (f.pos.y < 0.05) { f.pos.y = 0.05; f.vel.y = 0; f.vel.multiplyScalar(0.7); }
      const u = f.age / f.life, k = u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88;
      this.e.set(f.angle + f.age * f.spin, f.angle * 0.7 + f.age * f.spin * 0.6, 0);
      this.q.setFromEuler(this.e);
      this.m.compose(f.pos, this.q, this.s.setScalar(Math.max(f.size * k, MIN_SCALE)));
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, this.c.copy(f.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Gloves: the hands she mimes with.
// ---------------------------------------------------------------------------------------------------------------

const GLOVE_R = 0.1;

/** One white glove: a palm, four fingers and a thumb that curl into a fist, a dark cuff, a dark outline. Faces +Z, fingers up. */
function buildGlove() {
  const g = new THREE.Group();
  const white = new THREE.MeshBasicMaterial({ color: MIME.chalk });
  const ink = new THREE.MeshBasicMaterial({ color: MIME.ink, side: THREE.BackSide });
  const dark = new THREE.MeshBasicMaterial({ color: MIME.dark });
  const palm = new THREE.Mesh(new THREE.SphereGeometry(GLOVE_R, 12, 8), white);
  palm.scale.set(1, 1.05, 0.55);
  const palmLine = new THREE.Mesh(palm.geometry, ink);
  palmLine.scale.set(1.2, 1.25, 0.75);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(GLOVE_R * 0.72, GLOVE_R * 0.82, 0.07, 10), dark);
  cuff.position.y = -GLOVE_R * 1.05;
  const fingers = new THREE.Group();
  fingers.position.y = GLOVE_R * 0.7;
  const fingerGeo = new THREE.CapsuleGeometry(GLOVE_R * 0.2, GLOVE_R * 0.7, 3, 6);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(fingerGeo, white);
    f.position.x = (i - 1.5) * GLOVE_R * 0.5;
    f.position.y = GLOVE_R * 0.55 - Math.abs(i - 1.5) * 0.012;
    const o = new THREE.Mesh(fingerGeo, ink);
    o.scale.setScalar(1.35);
    o.position.copy(f.position);
    fingers.add(o, f);
  }
  const thumb = new THREE.Mesh(fingerGeo, white);
  thumb.position.set(GLOVE_R * 0.95, GLOVE_R * 0.1, 0);
  thumb.rotation.z = -0.9;
  g.add(palmLine, palm, cuff, fingers, thumb);
  g.userData = { fingers, thumb };
  g.visible = false;
  return g;
}

/**
 * A pool of white gloves. `place(i, pos, yaw, scale, curl, roll)`: `curl` 0 is an open palm, 1 a fist (the fingers fold over
 * the palm); `roll` tips the hand over its forearm axis. `hide(i)` / `reset()`. Add `mesh`.
 */
export class Gloves {
  readonly mesh = new THREE.Group();
  private gloves: THREE.Group[] = [];

  constructor(count = 2) {
    for (let i = 0; i < count; i++) {
      const g = buildGlove();
      this.gloves.push(g);
      this.mesh.add(g);
    }
  }

  place(i: number, pos: THREE.Vector3, yaw: number, scale = 1, curl = 0, roll = 0) {
    const g = this.gloves[i];
    if (!g) return;
    g.visible = scale > MIN_SCALE;
    g.position.copy(pos);
    g.rotation.set(0, yaw, roll);
    g.scale.setScalar(Math.max(scale, MIN_SCALE) * 1.6);
    const { fingers, thumb } = g.userData as { fingers: THREE.Group; thumb: THREE.Mesh };
    fingers.rotation.x = curl * 1.9;
    fingers.position.set(0, GLOVE_R * (0.7 - curl * 0.25), curl * GLOVE_R * 0.4);
    thumb.rotation.z = -0.9 + curl * 0.9;
  }

  hide(i: number) {
    if (this.gloves[i]) this.gloves[i].visible = false;
  }

  reset() {
    for (const g of this.gloves) g.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// ScarfTail: the one red thing.
// ---------------------------------------------------------------------------------------------------------------

const SCARF_SEGS = 8;

/** A short red ribbon that streams behind a point and flutters. `set(neck, backX, backZ, phase, flutter)`; `hide()`. Add `mesh`. */
export class ScarfTail {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.PlaneGeometry(1, 1, 1, SCARF_SEGS);
  private cache = new THREE.Vector3();

  constructor(private length = 0.8, private width = 0.16) {
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: MIME.red, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Streams from `neck` along (backX, backZ) (the way she is not facing), `flutter` 0..1 how wild it is. */
  set(neck: THREE.Vector3, backX: number, backZ: number, phase: number, flutter = 0.5, scale = 1) {
    const l = Math.hypot(backX, backZ) || 1, bx = backX / l, bz = backZ / l, px = -bz, pz = bx;
    const a = this.geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= SCARF_SEGS; i++) {
      const k = i / SCARF_SEGS, d = k * this.length * scale;
      const side = Math.sin(phase * 7 - k * 6) * 0.12 * flutter * k * scale;
      const lift = (Math.sin(phase * 5 - k * 4 + 1) * 0.1 * flutter - 0.06 * k) * k * scale;
      const w = this.width * scale * (1 - 0.35 * k);
      this.cache.set(neck.x + bx * d + px * side, neck.y + lift, neck.z + bz * d + pz * side);
      // The plane's two columns: x = -0.5 and 0.5 across the ribbon (its width stands up and down).
      a.setXYZ(i * 2, this.cache.x, this.cache.y + w * 0.5, this.cache.z);
      a.setXYZ(i * 2 + 1, this.cache.x, this.cache.y - w * 0.5, this.cache.z);
    }
    a.needsUpdate = true;
    this.mesh.visible = true;
  }

  hide() {
    this.mesh.visible = false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// What the walls leave on the floor (Trait.markLook).
// ---------------------------------------------------------------------------------------------------------------

/** The wall's drawn look: a dashed chalk line on a dark layer, a thin solid line and ticks at the ends, and a faint shimmer in the air. */
export function wallLook(height = 2.3): THREE.Object3D {
  const root = new THREE.Group();
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const strip = (w: number, len: number, z: number, color: number, opacity: number, y: number, order: number) => {
    const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.scale.set(w, 1, len);
    m.position.set(0, y, z);
    m.renderOrder = order;
    m.frustumCulled = false;
    return m;
  };
  root.add(strip(0.36, 1, 0, MIME.ink, 0.22, 0.03, 2));
  root.add(strip(0.03, 1, 0, MIME.chalk, 0.22, 0.04, 3));
  // Six dashes per metre of the unit length (the wall's length stretches them along z).
  for (let i = 0; i < 6; i++) root.add(strip(0.1, 0.09, -0.5 + (i + 0.5) / 6, MIME.chalk, 0.6, 0.045, 4));
  // Ticks across the line at both ends (they are stretched with the length too, which is fine: they stay short).
  for (const z of [-0.5, 0.5]) root.add(strip(0.44, 0.012, z, MIME.chalk, 0.5, 0.045, 4));
  // The shimmer: a tall faint pane that ripples.
  const pane = new THREE.PlaneGeometry(1, height).rotateY(Math.PI / 2).translate(0, height / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main() {
        float streak = 0.5 + 0.5 * sin(vUv.x * 40.0 + vUv.y * 7.0 - uTime * 1.7);
        float wave = smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y));
        float sweep = smoothstep(0.9, 1.0, 0.5 + 0.5 * sin(vUv.x * 3.0 - uTime * 0.9 + vUv.y * 2.0));
        float a = (0.025 + 0.04 * streak + 0.11 * sweep) * wave;
        gl_FragColor = vec4(vec3(0.95), a);
      }`,
  });
  const shimmer = new THREE.Mesh(pane, mat);
  shimmer.renderOrder = 5;
  shimmer.frustumCulled = false;
  shimmer.onBeforeRender = () => { mat.uniforms.uTime.value = performance.now() / 1000; };
  root.add(shimmer);
  return root;
}

/** A broken wall: chips of chalk along the line (the mark system shrinks it away). */
export function crumbLook(): THREE.Object3D {
  const root = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(0.06);
  const white = new THREE.MeshBasicMaterial({ color: MIME.chalk }), dark = new THREE.MeshBasicMaterial({ color: MIME.dark });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(geo, i % 4 === 3 ? dark : white);
    m.position.set(wobble(i + 2) * 0.12, 0.04 + 0.05 * Math.abs(wobble(i + 5)), -0.5 + (i + 0.5) / 14);
    m.scale.set(1 + Math.abs(wobble(i)), 0.5, 1 + Math.abs(wobble(i + 9)) * 2);
    m.rotation.y = i;
    m.frustumCulled = false;
    root.add(m);
  }
  return root;
}
