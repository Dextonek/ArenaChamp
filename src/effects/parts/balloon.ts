import * as THREE from 'three';

/**
 * The balloon kit (pipeline/designs/kit-balloon.md): Professor Puff, balloon scientist. Shiny pink rubber, pale foil, a dark
 * outline layer and a brass pump.
 * `Balloons` = pooled real balloons (a pear-shaped glossy body with a pale window highlight, a dark outline, a knot and a string)
 * that bob, lean away from their motion and wobble when poked; `Bubbles` = pooled camera-facing soap-bubble rings and soft puffs of
 * air (jets, gathering air, the shock of a pop); `Scraps` = flat torn rubber scraps that flutter down after a pop; `PopWords` = the
 * floating word (POP, BLOAT, PFFT); `buildPin` = the brass pin of Pop!. Everything is pooled, takes world-space positions, has
 * `reset()` where it holds state, and stays under the bloom threshold (no colour above 0.92).
 */

/** Palette. Numbers for `THREE.Color`, `BALLOON_CSS` for APIs that want a string. `foil` is the pale foil. */
export const BALLOON = {
  core: 0xffffff,
  hot: 0xffd2e3,
  body: 0xff8fb8,
  shade: 0xc9507f,
  deep: 0x8a2f5a,
  foil: 0xfff1a8,
  sky: 0x8fd8ff,
  mint: 0xa8efc8,
  brass: 0xd9a441,
  dark: 0x2a1424,
} as const;

export const BALLOON_CSS = {
  core: '#ffffff',
  hot: '#ffd2e3',
  body: '#ff8fb8',
  shade: '#c9507f',
  deep: '#8a2f5a',
  foil: '#fff1a8',
  sky: '#8fd8ff',
  mint: '#a8efc8',
  brass: '#d9a441',
  dark: '#2a1424',
} as const;

const MIN = 1e-4;
const clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------------------------------------------------------
// Balloons
// ---------------------------------------------------------------------------------------------------------------

export type BalloonTint = 'pink' | 'foil' | 'sky' | 'mint';

const TINTS: Record<BalloonTint, { body: number; shade: number; hot: number }> = {
  pink: { body: BALLOON.body, shade: BALLOON.shade, hot: BALLOON.hot },
  foil: { body: BALLOON.foil, shade: 0xd9b84a, hot: 0xfffbe0 },
  sky: { body: BALLOON.sky, shade: 0x4f9fd0, hot: 0xdaf3ff },
  mint: { body: BALLOON.mint, shade: 0x55b383, hot: 0xe0fbee },
};

/** Rubber: dark rim, a body colour, a soft pale window highlight at the upper left and a pinpoint glint. `uFlash` goes white. */
function rubberMaterial(tint: BalloonTint) {
  const c = TINTS[tint];
  return new THREE.ShaderMaterial({
    uniforms: {
      uBody: { value: new THREE.Color(c.body) }, uShade: { value: new THREE.Color(c.shade) }, uHot: { value: new THREE.Color(c.hot) },
      uFlash: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uShade, uHot; uniform float uFlash; varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 n = normalize(vN), v = normalize(vV);
        float f = clamp(dot(n, v), 0.0, 1.0);
        vec3 c = mix(uShade, uBody, smoothstep(0.05, 0.7, f));
        c = mix(c, uHot, smoothstep(0.6, 1.0, f) * 0.3);
        float rim = smoothstep(0.78, 1.0, dot(n, normalize(vec3(0.62, -0.5, 0.45))));
        c = mix(c, uHot, rim * 0.3);
        float win = smoothstep(0.9, 0.95, dot(n, normalize(vec3(-0.5, 0.55, 0.67))));
        c = mix(c, vec3(1.0), win * 0.7);
        float pin = smoothstep(0.985, 0.995, dot(n, normalize(vec3(-0.4, 0.5, 0.77))));
        c = mix(c, vec3(1.0), pin);
        c = mix(c, vec3(1.0), uFlash);
        gl_FragColor = vec4(min(c * 0.92, vec3(0.92)), 1.0);
      }`,
  });
}

let bodyGeo: THREE.BufferGeometry | undefined;
let knotGeo: THREE.BufferGeometry | undefined;
let stringGeo: THREE.BufferGeometry | undefined;
let darkMat: THREE.MeshBasicMaterial | undefined;
let stringMat: THREE.MeshBasicMaterial | undefined;

/** A pear-shaped balloon body: a sphere with the lower half drawn in towards the knot. 1.12 m tall, centred on 0. */
function balloonBody() {
  if (bodyGeo) return bodyGeo;
  const g = new THREE.SphereGeometry(0.5, 24, 18);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) {
      const k = 1 - 0.3 * Math.pow(-y / 0.5, 2);
      x *= k;
      z *= k;
    }
    p.setXYZ(i, x, y * 1.12, z);
  }
  g.computeVertexNormals();
  bodyGeo = g;
  return g;
}

interface BalloonItem {
  live: boolean;
  holder: THREE.Group;
  body: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  rigg: THREE.Group;
  string: THREE.Group;
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  vel: THREE.Vector3;
  scale: number;
  age: number;
  phase: number;
  jig: number;
  bob: number;
  tint: BalloonTint;
}

/**
 * Pooled balloons. `place(pos, tint, scale)` puts one (`pos` is the middle of the body; the knot hangs 0.6 m x scale below it) and
 * returns its index; `move`, `setScale`, `jiggle` (a wobble that dies away), `setFlash` (0..1, to white), `setBob` (metres of bob,
 * default 0.06), `hide`. The string leans away from the way the balloon moves. `update(dt)` each frame. Add `mesh`.
 */
export class Balloons {
  readonly mesh = new THREE.Group();
  frozen = false;
  private items: BalloonItem[] = [];
  private cursor = 0;
  private tmp = new THREE.Vector3();

  constructor(max = 8) {
    knotGeo ??= new THREE.ConeGeometry(0.075, 0.15, 10).rotateX(Math.PI);
    stringGeo ??= new THREE.CylinderGeometry(0.018, 0.018, 1, 5).translate(0, -0.5, 0);
    darkMat ??= new THREE.MeshBasicMaterial({ color: BALLOON.dark, side: THREE.BackSide });
    stringMat ??= new THREE.MeshBasicMaterial({ color: 0xf2e8d2 });
    for (let i = 0; i < max; i++) {
      const holder = new THREE.Group();
      const rigg = new THREE.Group();
      const mat = rubberMaterial('pink');
      const outline = new THREE.Mesh(balloonBody(), darkMat);
      outline.scale.setScalar(1.08);
      const body = new THREE.Mesh(balloonBody(), mat);
      const knot = new THREE.Mesh(knotGeo, new THREE.MeshBasicMaterial({ color: BALLOON.shade }));
      knot.position.y = -0.61;
      const string = new THREE.Group();
      string.position.y = -0.68;
      const line = new THREE.Mesh(stringGeo, stringMat);
      line.scale.y = 0.95;
      string.add(line);
      rigg.add(outline, body, knot, string);
      holder.add(rigg);
      holder.visible = false;
      for (const m of [outline, body, knot, line]) m.frustumCulled = false;
      this.mesh.add(holder);
      this.items.push({
        live: false, holder, body, mat, rigg, string, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(),
        scale: 1, age: 0, phase: Math.random() * 6.28, jig: 0, bob: 0.06, tint: 'pink',
      });
    }
  }

  get busy() {
    return this.items.some((c) => c.live);
  }

  place(pos: THREE.Vector3, tint: BalloonTint = 'pink', scale = 1) {
    let idx = this.items.findIndex((c) => !c.live);
    if (idx < 0) { idx = this.cursor; this.cursor = (this.cursor + 1) % this.items.length; }
    const c = this.items[idx];
    c.live = true;
    c.pos.copy(pos);
    c.prev.copy(pos);
    c.vel.set(0, 0, 0);
    c.scale = scale;
    c.age = 0;
    c.phase = Math.random() * 6.28;
    c.jig = 0;
    c.bob = 0.06;
    this.setTint(idx, tint);
    c.mat.uniforms.uFlash.value = 0;
    this.apply(c, 0);
    return idx;
  }

  setTint(i: number, tint: BalloonTint) {
    const c = this.items[i], t = TINTS[tint];
    c.tint = tint;
    c.mat.uniforms.uBody.value.set(t.body);
    c.mat.uniforms.uShade.value.set(t.shade);
    c.mat.uniforms.uHot.value.set(t.hot);
    ((c.rigg.children[2] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(t.shade);
  }

  move(i: number, pos: THREE.Vector3) {
    this.items[i].pos.copy(pos);
  }

  setScale(i: number, s: number) {
    this.items[i].scale = s;
  }

  setBob(i: number, metres: number) {
    this.items[i].bob = metres;
  }

  setFlash(i: number, v: number) {
    this.items[i].mat.uniforms.uFlash.value = v;
  }

  jiggle(i: number, amount = 0.3) {
    this.items[i].jig = amount;
  }

  hide(i: number) {
    const c = this.items[i];
    c.live = false;
    c.holder.visible = false;
  }

  reset() {
    for (const c of this.items) { c.live = false; c.holder.visible = false; c.mat.uniforms.uFlash.value = 0; }
    this.frozen = false;
  }

  update(dt: number) {
    const d = this.frozen ? 0 : dt;
    for (const c of this.items) {
      if (!c.live) continue;
      c.age += d;
      c.jig *= Math.exp(-d * 5);
      this.apply(c, d);
    }
  }

  private apply(c: BalloonItem, dt: number) {
    const h = c.holder;
    h.visible = true;
    if (dt > 0) {
      this.tmp.set((c.pos.x - c.prev.x) / dt, 0, (c.pos.z - c.prev.z) / dt);
      c.vel.lerp(this.tmp, 1 - Math.exp(-dt * 10));
      c.prev.copy(c.pos);
    }
    const s = Math.max(c.scale, MIN);
    const w = c.jig * Math.cos(c.age * 34);
    h.position.set(c.pos.x, c.pos.y + c.bob * Math.sin(c.age * 2.6 + c.phase), c.pos.z);
    h.scale.set(s * (1 - 0.5 * w), s * (1 + w), s * (1 - 0.5 * w));
    c.rigg.rotation.z = 0.08 * Math.sin(c.age * 1.7 + c.phase);
    c.rigg.rotation.x = 0.06 * Math.cos(c.age * 1.3 + c.phase);
    c.string.rotation.z = clamp(-c.vel.x * 0.05, -0.9, 0.9) + 0.12 * Math.sin(c.age * 3.1 + c.phase);
    c.string.rotation.x = clamp(c.vel.z * 0.05, -0.9, 0.9) + 0.1 * Math.cos(c.age * 2.7 + c.phase);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Bubbles: soap-bubble rings and soft puffs of air, camera-facing
// ---------------------------------------------------------------------------------------------------------------

interface BubbleP {
  live: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  s0: number;
  s1: number;
  drag: number;
  rise: number;
  kind: number;
  color: THREE.Color;
}

/**
 * Pooled billboards: kind 0 a soap bubble (a thin ring, a faint fill and a glint), kind 1 a soft puff of air. `emit(pos, vel, s0, s1,
 * life, color, kind, drag, rise)` grows from `s0` to `s1` metres over `life` seconds, fading in at once and out over the last 45%.
 */
export class Bubbles {
  readonly mesh: THREE.InstancedMesh;
  private ps: BubbleP[] = [];
  private cursor = 0;
  private tint: THREE.InstancedBufferAttribute;
  private alpha: THREE.InstancedBufferAttribute;
  private kindA: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private sc = new THREE.Vector3();
  private pt = new THREE.Vector3();

  constructor(readonly max = 64) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.kindA = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    geo.setAttribute('aTint', this.tint);
    geo.setAttribute('aAlpha', this.alpha);
    geo.setAttribute('aKind', this.kindA);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec3 aTint; attribute float aAlpha; attribute float aKind;
        varying vec2 vUv; varying vec3 vT; varying float vA; varying float vK;
        void main() {
          vUv = uv; vT = aTint; vA = aAlpha; vK = aKind;
          vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float s = length(instanceMatrix[0].xyz);
          c.xy += position.xy * s;
          gl_Position = projectionMatrix * c;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vT; varying float vA; varying float vK;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float d = length(p);
          if (d > 1.0) discard;
          float a; vec3 c = vT;
          if (vK < 0.5) {
            float ring = smoothstep(0.74, 0.9, d) * (1.0 - smoothstep(0.92, 1.0, d));
            float fill = (1.0 - smoothstep(0.0, 0.9, d)) * 0.16;
            float hl = 1.0 - smoothstep(0.0, 0.22, length(p - vec2(-0.38, 0.38)));
            a = ring * 0.95 + fill + hl * 0.8;
            c = mix(c, vec3(1.0), clamp(hl + ring * 0.35, 0.0, 1.0));
          } else {
            a = (1.0 - smoothstep(0.35, 1.0, d)) * 0.7;
            c = mix(c, vec3(1.0), 0.45);
          }
          gl_FragColor = vec4(min(c * 0.92, vec3(0.92)), clamp(a, 0.0, 1.0) * vA);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    for (let i = 0; i < max; i++) {
      this.ps.push({
        live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, s0: 0.2, s1: 0.2, drag: 1, rise: 0, kind: 0, color: new THREE.Color(),
      });
    }
    this.reset();
  }

  get busy() {
    return this.ps.some((p) => p.live);
  }

  emit(pos: THREE.Vector3, vel: THREE.Vector3, s0: number, s1: number, life: number, color: number = BALLOON.hot, kind = 0, drag = 1.5, rise = 0.6) {
    let i = this.ps.findIndex((p) => !p.live);
    if (i < 0) { i = this.cursor; this.cursor = (this.cursor + 1) % this.max; }
    const p = this.ps[i];
    p.live = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.age = 0;
    p.life = Math.max(0.05, life);
    p.s0 = s0;
    p.s1 = s1;
    p.drag = drag;
    p.rise = rise;
    p.kind = kind;
    p.color.set(color);
  }

  /** `n` bubbles thrown outward (flat, a little up) from `at`: speeds up to `speed`, sizes `size` (+- 40%). */
  ring(at: THREE.Vector3, n: number, speed: number, size: number, life = 0.8, color: number = BALLOON.hot, kind = 0) {
    const v = new THREE.Vector3(), a0 = Math.random() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4, sp = speed * (0.6 + Math.random() * 0.4);
      v.set(Math.cos(a) * sp, 0.5 + Math.random() * 1.2, Math.sin(a) * sp);
      const s = size * (0.6 + Math.random() * 0.8);
      this.emit(at, v, s * 0.5, s, life * (0.7 + Math.random() * 0.5), color, kind, 2.2, 0.5);
    }
  }

  reset() {
    for (const p of this.ps) p.live = false;
    for (let i = 0; i < this.max; i++) this.write(i, null);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      const p = this.ps[i];
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.life) { p.live = false; this.write(i, null); continue; }
      p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.vel.y += p.rise * dt;
      p.pos.addScaledVector(p.vel, dt);
      this.write(i, p);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alpha.needsUpdate = true;
    this.tint.needsUpdate = true;
    this.kindA.needsUpdate = true;
  }

  private write(i: number, p: BubbleP | null) {
    if (!p) {
      this.m.compose(this.pt.set(0, -9, 0), this.q.identity(), this.sc.set(MIN, MIN, MIN));
      this.mesh.setMatrixAt(i, this.m);
      this.alpha.setX(i, 0);
      return;
    }
    const k = p.age / p.life;
    const s = p.s0 + (p.s1 - p.s0) * (1 - Math.pow(1 - k, 2));
    this.m.compose(p.pos, this.q.identity(), this.sc.set(Math.max(s, MIN), Math.max(s, MIN), 1));
    this.mesh.setMatrixAt(i, this.m);
    this.tint.setXYZ(i, p.color.r, p.color.g, p.color.b);
    this.kindA.setX(i, p.kind);
    this.alpha.setX(i, k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Scraps: torn rubber
// ---------------------------------------------------------------------------------------------------------------

interface ScrapP {
  live: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  axis: THREE.Vector3;
  angle: number;
  spin: number;
  age: number;
  life: number;
  size: number;
}

/**
 * Pooled flat scraps of torn rubber: ragged triangles that tumble, flutter down (a strong air drag) and lie on the floor a moment.
 * `burst(at, n, speed, size, colors)` throws `n` of them from `at` (colours picked at random from `colors`). Never fewer than 1e-4 scale.
 */
export class Scraps {
  readonly mesh: THREE.InstancedMesh;
  private ps: ScrapP[] = [];
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private sc = new THREE.Vector3();
  private pt = new THREE.Vector3();
  private col = new THREE.Color();

  constructor(readonly max = 40) {
    const s = new THREE.Shape();
    s.moveTo(0, 0.5);
    s.lineTo(0.3, 0.18);
    s.lineTo(0.42, -0.34);
    s.lineTo(0.06, -0.14);
    s.lineTo(-0.36, -0.42);
    s.lineTo(-0.2, 0.1);
    s.closePath();
    const geo = new THREE.ShapeGeometry(s);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, this.col.set(BALLOON.body));
    for (let i = 0; i < max; i++) {
      this.ps.push({ live: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), axis: new THREE.Vector3(0, 1, 0), angle: 0, spin: 0, age: 0, life: 1, size: 0.2 });
    }
    this.reset();
  }

  get busy() {
    return this.ps.some((p) => p.live);
  }

  burst(at: THREE.Vector3, n: number, speed: number, size = 0.22, colors: number[] = [BALLOON.body, BALLOON.shade, BALLOON.hot]) {
    for (let k = 0; k < n; k++) {
      let i = this.ps.findIndex((p) => !p.live);
      if (i < 0) { i = this.cursor; this.cursor = (this.cursor + 1) % this.max; }
      const p = this.ps[i];
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.2) * 1.2, sp = speed * (0.5 + Math.random() * 0.6);
      p.live = true;
      p.pos.copy(at);
      p.vel.set(Math.cos(a) * sp, Math.sin(e) * sp * 0.8 + 1.5, Math.sin(a) * sp);
      p.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      p.angle = Math.random() * 6.28;
      p.spin = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 9);
      p.age = 0;
      p.life = 1.1 + Math.random() * 0.7;
      p.size = size * (0.6 + Math.random() * 0.9);
      this.col.set(colors[Math.floor(Math.random() * colors.length)]);
      this.mesh.setColorAt(i, this.col);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  reset() {
    for (let i = 0; i < this.max; i++) { this.ps[i].live = false; this.write(i, null); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      const p = this.ps[i];
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.life) { p.live = false; this.write(i, null); continue; }
      p.vel.multiplyScalar(Math.exp(-1.8 * dt));
      p.vel.y -= 5 * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.04) { p.pos.y = 0.04; p.vel.set(p.vel.x * 0.3, 0, p.vel.z * 0.3); p.spin *= 0.9; }
      p.angle += p.spin * dt;
      this.write(i, p);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private write(i: number, p: ScrapP | null) {
    if (!p) {
      this.m.compose(this.pt.set(0, -9, 0), this.q.identity(), this.sc.set(MIN, MIN, MIN));
      this.mesh.setMatrixAt(i, this.m);
      return;
    }
    const k = p.age / p.life;
    const s = p.size * (k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1);
    this.q.setFromAxisAngle(p.axis, p.angle);
    this.m.compose(p.pos, this.q, this.sc.set(Math.max(s, MIN), Math.max(s, MIN), Math.max(s, MIN)));
    this.mesh.setMatrixAt(i, this.m);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The floating word
// ---------------------------------------------------------------------------------------------------------------

interface Word {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  t: number;
  life: number;
  size: number;
  base: THREE.Vector3;
  aspect: number;
  active: boolean;
}

/**
 * A word floating up from a spot (POP, BLOAT, PFFT): fat outlined letters, pink with a pale foil shine on the top half over a dark
 * outline and a foil shadow, popping in with an overshoot, wobbling and fading in the last quarter. `size` is the letters' height (m).
 */
export class PopWords {
  readonly mesh = new THREE.Group();
  private pool: Word[] = [];

  constructor(count = 3) {
    for (let i = 0; i < count; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 20;
      sprite.visible = false;
      this.mesh.add(sprite);
      this.pool.push({ sprite, mat, canvas, tex, t: 0, life: 1, size: 1, base: new THREE.Vector3(), aspect: 4, active: false });
    }
  }

  get busy() {
    return this.pool.some((w) => w.active);
  }

  show(text: string, at: THREE.Vector3, size: number, life: number) {
    const w = this.pool.find((p) => !p.active) ?? this.pool[0];
    const g = w.canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w.canvas.width, w.canvas.height);
    g.font = '900 170px Impact, "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const cx = w.canvas.width / 2, cy = w.canvas.height / 2 + 6;
    g.strokeStyle = BALLOON_CSS.foil;
    g.lineWidth = 36;
    g.strokeText(text, cx + 7, cy + 9);
    g.strokeStyle = BALLOON_CSS.dark;
    g.lineWidth = 31;
    g.strokeText(text, cx, cy);
    g.fillStyle = BALLOON_CSS.body;
    g.fillText(text, cx, cy);
    // The upper half is a paler, glossy pink, so the word reads as shiny rubber.
    g.save();
    g.beginPath();
    g.rect(0, 0, w.canvas.width, cy - 6);
    g.clip();
    g.fillStyle = BALLOON_CSS.hot;
    g.fillText(text, cx, cy);
    g.restore();
    w.tex.needsUpdate = true;
    w.active = true;
    w.t = 0;
    w.life = life;
    w.size = size;
    w.aspect = w.canvas.width / w.canvas.height;
    w.base.copy(at);
    w.sprite.visible = true;
  }

  reset() {
    for (const w of this.pool) { w.active = false; w.sprite.visible = false; }
  }

  update(dt: number) {
    for (const w of this.pool) {
      if (!w.active) continue;
      w.t += dt;
      if (w.t >= w.life) { w.active = false; w.sprite.visible = false; continue; }
      const k = w.t / w.life;
      const pop = w.t < 0.2 ? 1 + 2.4 * (w.t / 0.2 - 1) ** 3 + 1.4 * (w.t / 0.2 - 1) ** 2 : 1;
      const s = w.size * Math.max(MIN, pop);
      w.sprite.scale.set(s * w.aspect, s, 1);
      w.sprite.position.set(w.base.x, w.base.y + k * 1.2 * w.size * 0.5, w.base.z);
      w.mat.rotation = Math.sin(w.t * 6) * 0.05;
      w.mat.opacity = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The pin
// ---------------------------------------------------------------------------------------------------------------

/** The brass pin of Pop!: a thick needle with a round pink-glass head and a short dark collar. Points along +z, tip at z = 0.55, 1.1 m long. */
export function buildPin(): THREE.Group {
  const g = new THREE.Group();
  const brass = new THREE.MeshBasicMaterial({ color: BALLOON.brass });
  const dark = new THREE.MeshBasicMaterial({ color: BALLOON.dark });
  const outline = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8).rotateX(Math.PI / 2), dark);
  outline.position.z = 0.05;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.98, 8).rotateX(Math.PI / 2), brass);
  shaft.position.z = 0.05;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2e8d2 }));
  tip.position.z = 0.6;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10).rotateX(Math.PI / 2), dark);
  collar.position.z = -0.38;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), rubberMaterial('pink'));
  head.position.z = -0.5;
  g.add(outline, shaft, tip, collar, head);
  for (const m of g.children) m.frustumCulled = false;
  return g;
}
