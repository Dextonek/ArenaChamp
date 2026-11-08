import * as THREE from 'three';
import { GlowBeam, Sparks } from '../arenas/hazards/fx';
import { softDotTexture } from '../effects/common';

/**
 * The raid's big moments (user, 2026-11-08: "make some VFX super effect for the mechanics"). One `ShowFx` per fight plays one-shot
 * pieces on its own clock and takes them back when they end: a shockwave over the floor, a rising column, flying shards, a meteor, a
 * lava arc, rays along the floor, a charge-up, a beam's flash. Moves start them from their casts, lands and objectives, never from a hero,
 * so both screens draw the same thing. The game's bloom eats additive light: short bright peaks, dim sustained states, and nothing gold
 * on the floor (gold there means a zone to stand in).
 */

type Color = THREE.ColorRepresentation;

const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
const easeOut = (k: number) => 1 - (1 - clamp01(k)) ** 3;
/** Up fast, then down: 0 at 0, 1 at `peak`, 0 at 1. */
const swell = (k: number, peak = 0.15) => (k < peak ? k / peak : Math.max(0, 1 - (k - peak) / (1 - peak)));

const flatVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// --- a shockwave over the floor: a bright front with a soft wake behind it ---------------------------------------------------------

const ringFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uRadius, uWidth, uOpacity, uScale;
  varying vec2 vUv;
  void main() {
    float r = length(vUv * 2.0 - 1.0) * uScale;
    float d = uRadius - r;
    if (d < -uWidth || d > uWidth * 5.0) discard;
    float front = exp(-abs(d) / (uWidth * 0.3));
    float wake = d > 0.0 ? exp(-d / uWidth) * 0.4 : 0.0;
    gl_FragColor = vec4(uColor, (front + wake) * uOpacity);
  }
`;

class Ring {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: flatVertex, fragmentShader: ringFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color() }, uRadius: { value: 1 }, uWidth: { value: 0.5 }, uOpacity: { value: 0 }, uScale: { value: 1 } },
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
  }
  set(x: number, z: number, radius: number, width: number, opacity: number) {
    const outer = radius + width * 1.5;
    this.mesh.visible = opacity > 0.003;
    this.mesh.position.set(x, 0.07, z);
    this.mesh.scale.setScalar(outer);
    const u = this.mat.uniforms;
    u.uScale.value = outer;
    u.uRadius.value = radius;
    u.uWidth.value = width;
    u.uOpacity.value = opacity;
  }
}

// --- a column rising from the floor: light, fire, a geyser --------------------------------------------------------------------------

const columnFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity, uTime;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    float n = noise(vec2(vUv.x * 14.0, vUv.y * 5.0 - uTime * 4.0));
    float a = pow(1.0 - vUv.y, 1.3) * (0.45 + 0.55 * n) * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

class Column {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  constructor() {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: flatVertex, fragmentShader: columnFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
  }
}

// --- a glowing point: a charge-up, a meteor's head ----------------------------------------------------------------------------------

class Glow {
  readonly sprite: THREE.Sprite;
  constructor() {
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.sprite.renderOrder = 4;
    this.sprite.visible = false;
  }
  set(x: number, y: number, z: number, size: number, opacity: number, color?: Color) {
    this.sprite.visible = opacity > 0.003;
    this.sprite.position.set(x, y, z);
    this.sprite.scale.setScalar(size);
    this.sprite.material.opacity = opacity;
    if (color !== undefined) this.sprite.material.color.set(color);
  }
}

/** A beam that can take any colour: `GlowBeam` with its colours set per use. */
class Beam {
  readonly beam: GlowBeam;
  constructor() {
    this.beam = new GlowBeam(0xffffff, 0xffffff, 1);
  }
  colors(core: Color, glow: Color) {
    const u = (this.beam.mesh.material as THREE.ShaderMaterial).uniforms;
    u.uCore.value.set(core);
    u.uGlow.value.set(glow);
  }
}

/** One playing piece: it waits `delay`, runs `life` seconds (`tick` with 0..1), then gives its parts back. */
interface Piece {
  start: number;
  delay: number;
  life: number;
  tick(k: number, t: number): void;
  end(): void;
}

const SHARDS = 180;
const A = new THREE.Vector3();
const B = new THREE.Vector3();
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();

export class ShowFx {
  readonly group = new THREE.Group();
  /** Its own sparks, bigger than a fight's own: one geyser would empty those. */
  readonly sparks = new Sparks(900, 0.22);
  private clock = 0;
  private live: Piece[] = [];
  private free = { ring: [] as Ring[], column: [] as Column[], glow: [] as Glow[], beam: [] as Beam[], head: [] as THREE.Mesh[] };
  private made = { ring: [] as Ring[], column: [] as Column[], glow: [] as Glow[], beam: [] as Beam[], head: [] as THREE.Mesh[] };
  private headGeo = new THREE.IcosahedronGeometry(1, 1);
  private shardMesh: THREE.InstancedMesh;
  private bits: { pos: THREE.Vector3; vel: THREE.Vector3; axis: THREE.Vector3; spin: number; age: number; life: number; size: number }[] = [];
  private shardNext = 0;

  constructor(private camera: THREE.Camera) {
    this.group.add(this.sparks.points);
    this.shardMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), new THREE.MeshBasicMaterial({ color: 0xffffff }), SHARDS);
    this.shardMesh.frustumCulled = false;
    this.shardMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SHARDS * 3), 3);
    for (let i = 0; i < SHARDS; i++) {
      this.bits.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), spin: 0, age: 1, life: 1, size: 0 });
      this.shardMesh.setMatrixAt(i, M.makeScale(0, 0, 0));
    }
    this.group.add(this.shardMesh);
  }

  /** A part from its pool, made (and added to the group) when the pool is empty. */
  private take<T>(free: T[], made: T[], make: () => T, obj: (o: T) => THREE.Object3D): T {
    let o = free.pop();
    if (!o) {
      o = make();
      made.push(o);
      this.group.add(obj(o));
    }
    return o;
  }

  private play(delay: number, life: number, tick: Piece['tick'], end: Piece['end']) {
    this.live.push({ start: this.clock, delay, life: Math.max(0.05, life), tick, end });
  }

  /** A shockwave over the floor, out to `radius` in `life` seconds. */
  ring(x: number, z: number, o: { radius: number; life: number; color: Color; width?: number; peak?: number; delay?: number }) {
    const r = this.take(this.free.ring, this.made.ring, () => new Ring(), (x) => x.mesh);
    r.mat.uniforms.uColor.value.set(o.color);
    const width = o.width ?? 0.6, peak = o.peak ?? 1;
    r.set(x, z, 0, width, 0);
    this.play(o.delay ?? 0, o.life, (k) => r.set(x, z, o.radius * easeOut(k), width * (1 + k), peak * (1 - k) ** 1.5), () => {
      r.mesh.visible = false;
      this.free.ring.push(r);
    });
  }

  /** A column rising from the floor: it shoots up in the first quarter of its life and fades. */
  column(x: number, z: number, o: { radius: number; height: number; life: number; color: Color; peak?: number; delay?: number }) {
    const c = this.take(this.free.column, this.made.column, () => new Column(), (x) => x.mesh);
    c.mat.uniforms.uColor.value.set(o.color);
    c.mesh.position.set(x, 0, z);
    c.mesh.visible = false;
    const peak = o.peak ?? 1;
    this.play(o.delay ?? 0, o.life, (k, t) => {
      c.mesh.visible = true;
      c.mesh.scale.set(o.radius * (0.7 + 0.5 * k), o.height * easeOut(k * 4), o.radius * (0.7 + 0.5 * k));
      c.mat.uniforms.uOpacity.value = peak * swell(k, 0.12);
      c.mat.uniforms.uTime.value = t;
    }, () => {
      c.mesh.visible = false;
      this.free.column.push(c);
    });
  }

  /** Shards flying out of a point, falling and shrinking. */
  shards(x: number, y: number, z: number, o: { count: number; color: Color; speed: number; life: number; size?: number; up?: number }) {
    const col = new THREE.Color(o.color);
    for (let i = 0; i < o.count; i++) {
      const s = this.bits[this.shardNext];
      const idx = this.shardNext;
      this.shardNext = (this.shardNext + 1) % SHARDS;
      const a = Math.random() * Math.PI * 2, up = (o.up ?? 0.6) * (0.4 + Math.random());
      s.pos.set(x, y, z);
      s.vel.set(Math.cos(a), up, Math.sin(a)).normalize().multiplyScalar(o.speed * (0.5 + Math.random() * 0.7));
      s.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      s.spin = (Math.random() - 0.5) * 14;
      s.age = 0;
      s.life = o.life * (0.6 + Math.random() * 0.6);
      s.size = (o.size ?? 0.16) * (0.6 + Math.random() * 0.8);
      this.shardMesh.setColorAt(idx, col);
    }
    if (this.shardMesh.instanceColor) this.shardMesh.instanceColor.needsUpdate = true;
  }

  /** A burst of sparks. */
  burst(x: number, y: number, z: number, n: number, speed: number, rise: number, life: number, color: Color, gravity = 9) {
    this.sparks.emit(x, y, z, n, speed, rise, life, color, gravity);
  }

  /** A glow that grows at a point over `seconds` and pops at the end (a shot charging). */
  charge(x: number, y: number, z: number, seconds: number, color: Color, size = 1.6) {
    const g = this.take(this.free.glow, this.made.glow, () => new Glow(), (x) => x.sprite);
    g.set(x, y, z, 0.01, 0, color);
    this.play(0, seconds, (k, t) => g.set(x, y, z, size * (0.25 + 0.75 * k * k) * (1 + 0.08 * Math.sin(t * 30)), 0.25 + 0.6 * k * k), () => {
      g.sprite.visible = false;
      this.free.glow.push(g);
      this.burst(x, y, z, 10, 3.5, 1, 0.4, color, 2);
    });
  }

  /** A beam's flash from a to b: out at once, fading over `life`. */
  beam(a: THREE.Vector3, b: THREE.Vector3, o: { life: number; core: Color; glow: Color; width: number; delay?: number }) {
    const bm = this.take(this.free.beam, this.made.beam, () => new Beam(), (x) => x.beam.mesh);
    bm.colors(o.core, o.glow);
    const from = a.clone(), to = b.clone();
    bm.beam.mesh.visible = false;
    this.play(o.delay ?? 0, o.life, (k, t) => bm.beam.set(from, to, this.camera, t, 1.6 * (1 - k) ** 2, o.width * (1 + 0.6 * (1 - k))), () => {
      bm.beam.mesh.visible = false;
      this.free.beam.push(bm);
    });
  }

  /** Rays along the floor from (x, z) outward, growing to `length`: a flare. */
  rays(x: number, z: number, o: { count: number; length: number; life: number; core: Color; glow: Color; width: number; turn?: number }) {
    for (let i = 0; i < o.count; i++) {
      const bm = this.take(this.free.beam, this.made.beam, () => new Beam(), (x) => x.beam.mesh);
      bm.colors(o.core, o.glow);
      const a = (o.turn ?? 0) + (i / o.count) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      const from = new THREE.Vector3(x + dx * 0.8, 0.12, z + dz * 0.8), to = new THREE.Vector3();
      bm.beam.mesh.visible = false;
      this.play(0, o.life, (k, t) => {
        const len = o.length * easeOut(k * 2.5);
        to.set(x + dx * len, 0.12, z + dz * len);
        bm.beam.set(from, to, this.camera, t, 1.4 * swell(k, 0.2), o.width, true);
      }, () => {
        bm.beam.mesh.visible = false;
        this.free.beam.push(bm);
      });
    }
  }

  /** A meteor: a glowing head with a streak behind it, from `from` to `to`, landing in `seconds`. Speeds up as it falls. */
  meteor(from: THREE.Vector3, to: THREE.Vector3, seconds: number, o: { core: Color; glow: Color; size: number; trail: number; delay?: number }) {
    const head = this.take(this.free.glow, this.made.glow, () => new Glow(), (x) => x.sprite);
    const tail = this.take(this.free.beam, this.made.beam, () => new Beam(), (x) => x.beam.mesh);
    tail.colors(o.core, o.glow);
    head.set(0, 0, 0, 0.01, 0, o.core);
    tail.beam.mesh.visible = false;
    const f = from.clone(), dir = to.clone().sub(from).normalize();
    this.play(o.delay ?? 0, seconds, (k, t) => {
      const e = k ** 1.5;
      A.lerpVectors(f, to, e);
      B.copy(A).addScaledVector(dir, -o.trail * (0.4 + e));
      head.set(A.x, A.y, A.z, o.size * (1 + 0.1 * Math.sin(t * 40)), 0.95);
      tail.beam.set(A, B, this.camera, t, 1.3, o.size * 0.55);
      if (Math.random() < 0.6) this.sparks.emit(A.x, A.y, A.z, 2, 1.2, 0.3, 0.5, o.glow, 1);
    }, () => {
      head.sprite.visible = false;
      tail.beam.mesh.visible = false;
      this.free.glow.push(head);
      this.free.beam.push(tail);
    });
  }

  /** A glowing blob thrown along an arc `height` high, from `from` to `to`, landing in `seconds`, with sparks behind it. */
  arc(from: THREE.Vector3, to: THREE.Vector3, seconds: number, o: { color: Color; size: number; height: number; delay?: number }) {
    const head = this.take(this.free.head, this.made.head, () => new THREE.Mesh(this.headGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })), (x) => x);
    (head.material as THREE.MeshBasicMaterial).color.set(o.color);
    head.visible = false;
    const f = from.clone(), t2 = to.clone();
    this.play(o.delay ?? 0, seconds, (k) => {
      A.lerpVectors(f, t2, k);
      A.y += o.height * 4 * k * (1 - k);
      head.visible = true;
      head.position.copy(A);
      head.scale.setScalar(o.size);
      head.rotation.set(k * 9, k * 5, 0);
      if (Math.random() < 0.8) this.sparks.emit(A.x, A.y, A.z, 2, 0.8, 0.2, 0.45, o.color, 2);
    }, () => {
      head.visible = false;
      this.free.head.push(head);
    });
  }

  /** A mechanic done right: a column of light, a shockwave, a shower of sparks. `scale` for the biggest (the light turned). */
  triumph(x: number, z: number, color: Color, scale = 1) {
    this.column(x, z, { radius: 1.2 * scale, height: 10 * scale, life: 0.9, color: 0xfff2dc, peak: 0.9 });
    this.ring(x, z, { radius: 8 * scale, life: 0.9, color, width: 0.6 * scale });
    this.shards(x, 1, z, { count: Math.round(12 * scale), color, speed: 5 * scale, life: 1, size: 0.18 });
    this.burst(x, 0.8, z, Math.round(50 * scale), 6 * scale, 5, 0.9, color);
  }

  update(dt: number) {
    this.clock += dt;
    this.sparks.update(dt);
    const keep: Piece[] = [];
    for (const p of this.live) {
      const t = this.clock - p.start - p.delay;
      if (t < 0) { keep.push(p); continue; }
      const k = t / p.life;
      if (k >= 1) { p.end(); continue; }
      p.tick(k, t);
      keep.push(p);
    }
    this.live = keep;
    // The shards.
    for (let i = 0; i < SHARDS; i++) {
      const s = this.bits[i];
      if (s.age >= s.life) continue;
      s.age += dt;
      s.vel.y -= 9 * dt;
      s.pos.addScaledVector(s.vel, dt);
      if (s.pos.y < 0.05) { s.pos.y = 0.05; s.vel.multiplyScalar(0.4); s.vel.y = Math.abs(s.vel.y) * 0.3; }
      const k = s.age / s.life, size = k >= 1 ? 0 : s.size * Math.sqrt(1 - k);
      Q.setFromAxisAngle(s.axis, s.age * s.spin);
      this.shardMesh.setMatrixAt(i, M.compose(s.pos, Q, S.setScalar(size)));
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;
  }

  /** Everything playing stops (a new fight). */
  clear() {
    for (const p of this.live) p.end();
    this.live = [];
    for (const s of this.bits) s.age = s.life;
  }

  dispose() {
    this.clear();
    for (const r of this.made.ring) { r.mesh.geometry.dispose(); r.mat.dispose(); }
    for (const c of this.made.column) { c.mesh.geometry.dispose(); c.mat.dispose(); }
    for (const g of this.made.glow) g.sprite.material.dispose();
    for (const b of this.made.beam) { b.beam.mesh.geometry.dispose(); (b.beam.mesh.material as THREE.Material).dispose(); }
    for (const h of this.made.head) (h.material as THREE.Material).dispose();
    this.headGeo.dispose();
    this.shardMesh.geometry.dispose();
    (this.shardMesh.material as THREE.Material).dispose();
    this.sparks.points.geometry.dispose();
    (this.sparks.points.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }
}

// --- a barrier round a boss in its stage: a shell lit at its rim, with bands of light running over it --------------------------------

const shellVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const shellFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity, uTime;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vUv;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.6);
    float bands = smoothstep(0.82, 1.0, sin(vUv.y * 48.0 - uTime * 3.0)) * smoothstep(0.6, 1.0, sin(vUv.x * 72.0 + uTime));
    float a = (rim * 0.9 + bands * 0.35 * (0.3 + rim)) * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

export class Shell {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  constructor(color: Color) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: shellVertex, fragmentShader: shellFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.mat);
    this.mesh.renderOrder = 3;
  }
  set(opacity: number, time: number) {
    this.mesh.visible = opacity > 0.003;
    this.mat.uniforms.uOpacity.value = opacity;
    this.mat.uniforms.uTime.value = time;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

// --- the enrage, round the boss: a red heat rising off it and a pulse on the floor -------------------------------------------------

export class RageAura {
  readonly group = new THREE.Group();
  private column = new Column();
  private ring = new Ring();
  private time = 0;
  on = 0;
  constructor(private radius: number, private height: number) {
    this.column.mat.uniforms.uColor.value.set(0xff3a1e);
    this.ring.mat.uniforms.uColor.value.set(0xff4a2a);
    this.group.add(this.column.mesh, this.ring.mesh);
  }
  /** Follows the boss; `on` eases in once it has enraged. */
  update(dt: number, x: number, z: number, enraged: boolean) {
    this.time += dt;
    this.on += ((enraged ? 1 : 0) - this.on) * Math.min(1, dt * 2);
    const c = this.column.mesh;
    c.visible = this.on > 0.01;
    c.position.set(x, 0, z);
    c.scale.set(this.radius * 1.15, this.height * 1.25, this.radius * 1.15);
    this.column.mat.uniforms.uOpacity.value = this.on * (0.32 + 0.1 * Math.sin(this.time * 6));
    this.column.mat.uniforms.uTime.value = this.time;
    const k = (this.time * 0.8) % 1;
    this.ring.set(x, z, this.radius * (1 + 2.2 * k), 0.35, this.on * 0.7 * (1 - k));
  }
  dispose() {
    this.group.removeFromParent();
    for (const o of [this.column, this.ring]) {
      o.mesh.geometry.dispose();
      o.mat.dispose();
    }
  }
}

