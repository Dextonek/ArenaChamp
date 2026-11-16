import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TOUCH } from '../../../touch';
import type { GameApi } from '../../../runtime';
import { RING } from '../../../arenas/common';
import type { FloorDef } from '../def';
import { floorKeep } from '../keep';

/**
 * The Climb's life (the user, 2026-11-16: "look at the map and fill it more, to be more lively"): what moves on a floor and is not
 * part of a fight. Birds that circle and land and lift off as the hero comes near, smoke from chimneys and fires, cloth in the wind,
 * rings and leaping fish in the shallows, boats on their moorings, people about their work. One file a chapter (`sea.ts`, ...) and
 * this shared core; built by `buildLife` (index.ts) with the zone's fight and gone with it.
 *
 * Rules every part keeps:
 * - **Nothing here is in a fight.** No obstacle, no unit, no hit; it keeps off the floor's spots (people, packs, quests, doors),
 *   its paths and its cover, and it never stands where the hero walks unless it is ankle-high.
 * - **Cheap.** Each kind of thing is one instanced mesh (one draw call however many there are), animated in its shader from one
 *   shared clock; the processor moves only the few birds and boats that act. No shadows. On a phone (`lite`) there are fewer.
 * - **Its own dice.** three.js rolls `Math.random` for the id of every object it makes, and the fight's dice are `Math.random` (the
 *   perf tool seeds them, so a scene is the same fight every run). Everything here is made, moved and put away under dice of its
 *   own (`quiet`), seeded from the floor's number: the fight is the same with life or without, and the life is the same every time.
 *
 * Switches: `?life=0` in the address (or `globalThis.__noLife = true`, for the perf tool's A/B) builds none; `?life=lite` or
 * `?life=full` forces a tier.
 */

export type Tier = 'full' | 'lite';

/** Which life a screen gets: none (switched off), `lite` (a phone, or the lowest picture quality) or `full`. */
export function lifeTier(api: GameApi): Tier | null {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('life') : null;
  const g = globalThis as { __noLife?: boolean; __lifeTier?: Tier };
  if (q === '0' || g.__noLife) return null;
  if (q === 'lite' || q === 'full') return q;
  if (g.__lifeTier) return g.__lifeTier;
  const quality = (api as Partial<GameApi>).quality;
  return TOUCH || quality?.level === 'low' || quality?.lean ? 'lite' : 'full';
}

/** A small seeded random stream (mulberry32): 0 <= x < 1. */
export function mulberry(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs `fn` with `Math.random` rolling `rnd` instead (see the head of this file), and puts the fight's dice back after. */
export function quiet<T>(rnd: () => number, fn: () => T): T {
  const fight = Math.random;
  Math.random = rnd;
  try {
    return fn();
  } finally {
    Math.random = fight;
  }
}

/** What a chapter's life gets to build with. */
export interface LifeEnv {
  /** Where its meshes go (the zone's fight group: gone with the zone). */
  group: THREE.Group;
  tier: Tier;
  /** Its own dice, for placing and choosing (never `Math.random`). */
  rnd: () => number;
  /** The shared clock of every shader here (s, stepped with the game). */
  time: { value: number };
  /** Disposed with the life. */
  own: { dispose(): void }[];
}

/** A chapter's life, as the zone runs it. */
export interface Life {
  update(dt: number): void;
  dispose(): void;
  /** How many of each thing it made (the perf check and the page). */
  counts: Record<string, number>;
}

// --- the palette (blender/arenas/real/STYLE.md): the heroes' own, as flat matte or polished metal ---------------------------------
export const PAL = {
  wood: 0x4a3220, plank: 0x6b4226, lacquer: 0x1d1b21, wine: 0x5e1a28, iron: 0x3c3f47, gold: 0xc9a24a, rope: 0xb89a5a, stone: 0x2c3140,
  cream: 0xd8cfb4, teal: 0x2b5560,
} as const;

/** A standard material of the palette's kind: matte (rough 0.5 to 0.85) or polished metal. */
export function palMat(env: LifeEnv, color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, flatShading: true, ...o });
  env.own.push(m);
  return m;
}
export const goldOf = (env: LifeEnv) => palMat(env, PAL.gold, { roughness: 0.34, metalness: 0.85, emissive: 0xffb050, emissiveIntensity: 0.18 });

/** Paints every vertex of `g` one colour (as a `color` attribute) and keeps only position, normal and colour (for merging). */
export function painted(g: THREE.BufferGeometry, color: number) {
  const n = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(color), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return n;
}

/** Adds a shader patch to a material (its own program: `key`). `uTime` is the life's clock. */
function patch(m: THREE.Material, key: string, time: { value: number }, f: (sh: THREE.WebGLProgramParametersWithUniforms) => void) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    f(sh);
  };
  m.customProgramCacheKey = () => `life-${key}`;
}

// --- birds ---------------------------------------------------------------------------------------------------------------------

/**
 * A bird's shape, built in code: body, head, beak, tail and two wings, coloured per part (vertex colours), with an `aWing`
 * attribute: 0 on the body, the share of the half span (signed, + the left wing) on the wings, which the shader flaps and folds.
 */
export function birdGeometry(o: { span: number; body: number; colors: { body: number; wing: number; tip: number; beak: number } }) {
  const parts: THREE.BufferGeometry[] = [];
  const wingOf = (g: THREE.BufferGeometry, side: number) => {
    const p = g.attributes.position, w = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) w[i] = side === 0 ? 0 : Math.max(0, (p.getX(i) * side) / (o.span / 2)) * side;
    g.setAttribute('aWing', new THREE.BufferAttribute(w, 1));
    return g;
  };
  const L = o.body, c = o.colors;
  parts.push(wingOf(painted(new THREE.SphereGeometry(1, 10, 6).scale(L * 0.19, L * 0.2, L * 0.5), c.body), 0)); // body, along +z
  parts.push(wingOf(painted(new THREE.SphereGeometry(1, 8, 6).scale(L * 0.13, L * 0.13, L * 0.15).translate(0, L * 0.12, L * 0.46), c.body), 0)); // head
  parts.push(wingOf(painted(new THREE.ConeGeometry(L * 0.035, L * 0.16, 5).rotateX(Math.PI / 2).translate(0, L * 0.1, L * 0.66), c.beak), 0)); // beak
  parts.push(wingOf(painted(new THREE.ConeGeometry(L * 0.12, L * 0.3, 4).rotateX(-Math.PI / 2).scale(1, 0.25, 1).translate(0, L * 0.02, -L * 0.6), c.wing), 0)); // tail
  for (const side of [1, -1]) {
    // a wing: a long tapered slab from the shoulder out, its outer third the tip's colour
    const inner = new THREE.BoxGeometry(o.span * 0.32, L * 0.03, L * 0.34, 3, 1, 1).translate(side * (o.span * 0.16 + L * 0.1), L * 0.06, L * 0.04);
    const outer = new THREE.BoxGeometry(o.span * 0.18, L * 0.025, L * 0.22, 2, 1, 1).translate(side * (o.span * 0.41 + L * 0.1), L * 0.06, -L * 0.02);
    parts.push(wingOf(painted(inner, c.wing), side), wingOf(painted(outer, c.tip), side));
  }
  return mergeGeometries(parts)!;
}

/** A place a bird can sit: on a post, a roof, a rock, the beach or the water (`float`). `wet()`: the ground floods now (lift off). */
export interface Perch { x: number; y: number; z: number; float?: boolean; wet?: () => boolean; taken?: boolean }

interface Bird {
  state: 'perch' | 'lift' | 'fly' | 'land';
  perch: Perch | null;
  pos: THREE.Vector3;
  yaw: number;
  bank: number;
  /** In flight: the circle's middle, radius, height, way round and where on it. */
  cx: number; cz: number; r: number; h: number; way: number; ang: number;
  t: number;
  next: number;
  from: THREE.Vector3;
  soar: boolean;
  flap: number; fold: number; phase: number;
  /** Seconds before it flaps again (the glide between flaps). */
  glide: number;
  /** Where round the hero it likes to wheel (an offset), and how long a far bird sits before it comes over. */
  ox: number; oz: number; rest: number;
}

/**
 * Sea birds, crows, bats...: one instanced mesh. Each bird sits on a perch, lifts off when the hero comes within `shy` m (or a fight
 * comes near, or its ground floods), circles a while, and lands on another free perch away from the hero; `soarers` never land.
 * The wings flap and fold in the shader; the processor moves only the bird's body.
 */
export class Flock {
  readonly mesh: THREE.InstancedMesh;
  private birds: Bird[] = [];
  private attr: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private s = new THREE.Vector3(1, 1, 1);
  private v = new THREE.Vector3();

  constructor(
    private env: LifeEnv,
    geo: THREE.BufferGeometry,
    private perches: Perch[],
    private o: { n: number; soarers: number; shy: number; heights: [number, number]; speed: number; flapHz: number; centres: { x: number; z: number; r: number }[]; danger: (x: number, z: number) => boolean },
    hero: THREE.Vector3,
  ) {
    const mat = palMat(env, 0xffffff, { vertexColors: true, roughness: 0.8 });
    patch(mat, 'bird', env.time, (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime;
          attribute float aWing;
          attribute vec3 aBird; // flap phase, flap 0..1, fold 0..1`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float side = sign(aWing), span = abs(aWing);
          if (span > 0.0) {
            float fold = aBird.z;
            // folded: the wing tucked along the body (in and back), its tip lower
            transformed.x *= mix(1.0, 0.4, fold);
            transformed.z -= fold * span * 0.18 * ${o.flapHz.toFixed(1)} / 4.5;
            // and laid on the back (folded inside the body, a sitting bird showed only its white body from above)
            transformed.y += fold * (0.15 - span * 0.02);
            // the beat: the wing turns up and down about the shoulder, the tip more than the root
            float a = sin(uTime * ${(o.flapHz * 6.2832).toFixed(3)} + aBird.x) * aBird.y * (0.55 + 0.35 * span);
            float c = cos(a), s = sin(a) * side;
            vec2 xy = vec2(transformed.x, transformed.y);
            transformed.x = xy.x * c - xy.y * s;
            transformed.y = xy.x * s + xy.y * c;
          }`);
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, o.n);
    env.own.push(geo);
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(o.n * 3), 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aBird', this.attr);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    env.group.add(this.mesh);
    const rnd = env.rnd;
    for (let i = 0; i < o.n; i++) {
      const soar = i < o.soarers || !perches.length;
      const c = o.centres[i % o.centres.length];
      const b: Bird = {
        state: 'fly', perch: null, pos: new THREE.Vector3(), yaw: 0, bank: 0, cx: c.x + (rnd() - 0.5) * c.r, cz: c.z + (rnd() - 0.5) * c.r, r: 5 + rnd() * 7,
        h: o.heights[0] + rnd() * (o.heights[1] - o.heights[0]), way: rnd() < 0.5 ? 1 : -1, ang: rnd() * 6.28, t: 0, next: 4 + rnd() * 20, from: new THREE.Vector3(),
        soar, flap: 0.3, fold: 0, phase: rnd() * 6.28, glide: rnd() * 2, ox: 0, oz: 0, rest: 15 + rnd() * 40,
      };
      this.aim(b);
      if (soar) { b.h += 6; b.cx = hero.x + b.ox; b.cz = hero.z + b.oz; }
      // most start sitting: half of them round where the hero comes in (a floor begins with birds about), the rest anywhere
      if (!soar) {
        const p = i % 2 === 0 ? this.freePerch(hero.x, hero.z, 55, hero) : this.freePerch(b.cx, b.cz, 1e9, null);
        if (p) this.sit(b, p);
      }
      if (b.state === 'fly') this.circle(b, 0);
      this.birds.push(b);
    }
    this.write();
  }

  private sit(b: Bird, p: Perch) {
    if (b.perch) b.perch.taken = false;
    b.perch = p;
    p.taken = true;
    b.state = 'perch';
    b.pos.set(p.x, p.y, p.z);
    b.yaw = this.env.rnd() * 6.28;
    b.bank = 0;
    b.flap = 0;
    b.fold = 1;
    b.next = 3 + this.env.rnd() * 6;
  }

  /** A free perch within `reach` m of (x, z), off the hero (1.6 times its shyness) and the fights; one of a few tried at random. */
  private freePerch(x: number, z: number, reach: number, hero: THREE.Vector3 | null): Perch | null {
    const rnd = this.env.rnd;
    // the perches within reach first (a list, not the whole floor's: on a floor five times the first, a few tries at random seldom hit one)
    const near = reach < 1e8 ? this.perches.filter((p) => !p.taken && Math.abs(p.x - x) < reach && Math.abs(p.z - z) < reach && Math.hypot(p.x - x, p.z - z) < reach) : this.perches;
    for (let k = 0; k < 16 && near.length; k++) {
      const p = near[Math.floor(rnd() * near.length)];
      if (p.taken || p.wet?.()) continue;
      if (hero && Math.hypot(p.x - hero.x, p.z - hero.z) < this.o.shy * 1.6) continue;
      if (this.o.danger(p.x, p.z)) continue;
      return p;
    }
    return null;
  }

  /** A new place round the hero to wheel over: 7 to 22 m off, any side (the game's camera sees about 20 m round the hero). */
  private aim(b: Bird) {
    const a = this.env.rnd() * 6.28, d = 7 + this.env.rnd() * 15;
    b.ox = Math.cos(a) * d;
    b.oz = Math.sin(a) * d;
  }

  /** Puts a bird on its circle at `ang`, facing along it. */
  private circle(b: Bird, dt: number) {
    const w = (this.o.speed / b.r) * b.way;
    b.ang += w * dt;
    b.pos.set(b.cx + Math.cos(b.ang) * b.r, b.h + Math.sin(b.ang * 2.3 + b.phase) * 0.5, b.cz + Math.sin(b.ang) * b.r);
    // facing along the circle (its velocity), banked into the turn
    b.yaw = Math.atan2(-Math.sin(b.ang) * b.way, Math.cos(b.ang) * b.way);
    b.bank = -0.35 * b.way;
  }

  update(dt: number, hero: THREE.Vector3) {
    const rnd = this.env.rnd;
    for (const b of this.birds) {
      b.t += dt;
      switch (b.state) {
        case 'perch': {
          const p = b.perch!;
          const near = Math.hypot(hero.x - p.x, hero.z - p.z) < this.o.shy;
          if (near || p.wet?.() || this.o.danger(p.x, p.z)) {
            // up and away from the hero, then round
            b.state = 'lift';
            b.t = 0;
            b.from.copy(b.pos);
            const away = Math.atan2(p.z - hero.z, p.x - hero.x) + (rnd() - 0.5) * 0.8;
            b.r = 5 + rnd() * 6;
            b.cx = p.x + Math.cos(away) * (b.r + 4);
            b.cz = p.z + Math.sin(away) * (b.r + 4);
            b.ang = Math.atan2(p.z - b.cz, p.x - b.cx);
            b.h = this.o.heights[0] + rnd() * (this.o.heights[1] - this.o.heights[0]);
            b.way = rnd() < 0.5 ? 1 : -1;
            b.next = 8 + rnd() * 14;
            this.aim(b);
            p.taken = false;
            b.perch = null;
            break;
          }
          // far from the hero, it sits a while, then comes over (so there are birds about wherever the hero goes)
          const far = Math.hypot(hero.x - p.x, hero.z - p.z) > 80;
          if (far && (b.rest -= dt) < 0) {
            b.rest = 20 + rnd() * 40;
            b.state = 'lift';
            b.t = 0;
            b.from.copy(b.pos);
            this.aim(b);
            b.r = 5 + rnd() * 6;
            b.cx = p.x + b.r;
            b.cz = p.z;
            b.ang = Math.PI;
            b.h = this.o.heights[0] + rnd() * (this.o.heights[1] - this.o.heights[0]);
            b.next = 10 + rnd() * 14;
            p.taken = false;
            b.perch = null;
            break;
          }
          // a look round now and then; a floating one bobs
          if ((b.next -= dt) < 0) { b.yaw += (rnd() - 0.5) * 2; b.next = 3 + rnd() * 6; }
          if (p.float) b.pos.y = p.y + Math.sin(this.env.time.value * 1.4 + b.phase) * 0.05;
          b.flap = 0;
          b.fold = 1;
          break;
        }
        case 'lift': {
          // 1.1 s from the perch to its circle, beating hard
          const k = Math.min(1, b.t / 1.1), e = k * k * (3 - 2 * k);
          const tx = b.cx + Math.cos(b.ang) * b.r, tz = b.cz + Math.sin(b.ang) * b.r;
          this.v.set(tx - b.from.x, 0, tz - b.from.z);
          b.pos.set(b.from.x + this.v.x * e, b.from.y + (b.h - b.from.y) * Math.sqrt(k), b.from.z + this.v.z * e);
          b.yaw = Math.atan2(this.v.x, this.v.z);
          b.bank = 0;
          b.flap = 1;
          b.fold = Math.max(0, 1 - k * 4);
          if (k >= 1) { b.state = 'fly'; b.t = 0; }
          break;
        }
        case 'fly': {
          // its circle drifts over to where the hero is (at a gull's cruising speed), then wheels there
          const tx = hero.x + b.ox - b.cx, tz = hero.z + b.oz - b.cz, td = Math.hypot(tx, tz);
          if (td > 6) { const k = Math.min(1, (this.o.speed * 1.1 * dt) / td); b.cx += tx * k; b.cz += tz * k; }
          this.circle(b, dt);
          // flaps a while, glides a while
          if ((b.glide -= dt) < 0) b.glide = b.flap > 0.5 ? 1.5 + rnd() * 3 : 0.8 + rnd() * 1.2;
          const flapping = b.glide < 1.0 && Math.floor(b.t / 3 + b.phase) % 2 === 0;
          b.flap += ((flapping ? 0.9 : 0.12) - b.flap) * Math.min(1, dt * 3);
          b.fold = 0;
          if (!b.soar && (b.next -= dt) < 0 && td < 30) {
            const p = this.freePerch(hero.x, hero.z, 32, hero);
            if (p) {
              p.taken = true;
              b.perch = p;
              b.state = 'land';
              b.t = 0;
              b.from.copy(b.pos);
              b.next = Math.max(1.6, Math.hypot(p.x - b.pos.x, p.z - b.pos.z) / this.o.speed);
            } else b.next = 3 + rnd() * 5;
          }
          break;
        }
        case 'land': {
          // a glide down to the perch, the last of it beating to a stop
          const p = b.perch!, k = Math.min(1, b.t / b.next), e = k * k * (3 - 2 * k);
          const dx = p.x - b.from.x, dz = p.z - b.from.z;
          b.pos.set(b.from.x + dx * e, b.from.y + (p.y - b.from.y) * (1 - (1 - k) * (1 - k)) + Math.sin(k * Math.PI) * 1.5, b.from.z + dz * e);
          b.yaw = Math.atan2(dx, dz);
          b.bank = 0;
          b.flap = k > 0.7 ? 1 : 0.15;
          b.fold = k > 0.95 ? (k - 0.95) * 20 : 0;
          if (k >= 1 || Math.hypot(hero.x - p.x, hero.z - p.z) < this.o.shy * 0.8) {
            if (k >= 1) { b.perch = null; this.sit(b, p); }
            else { p.taken = false; b.perch = null; b.state = 'fly'; b.next = 4 + rnd() * 6; b.t = 0; b.cx = b.pos.x - Math.cos(b.ang) * b.r; b.cz = b.pos.z - Math.sin(b.ang) * b.r; }
          }
          break;
        }
      }
    }
    this.write();
  }

  private write() {
    const a = this.attr.array as Float32Array;
    this.birds.forEach((b, i) => {
      this.e.set(0, b.yaw, b.bank);
      this.q.setFromEuler(this.e);
      this.m.compose(b.pos, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      a[i * 3] = b.phase;
      a[i * 3 + 1] = b.flap;
      a[i * 3 + 2] = b.fold;
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.attr.needsUpdate = true;
  }

  /** How many sit now (the page's count). */
  get sitting() {
    return this.birds.filter((b) => b.state === 'perch').length;
  }

  /** Where each bird is and what it does (the tools). */
  snapshot() {
    return this.birds.map((b) => ({ state: b.state, x: +b.pos.x.toFixed(1), y: +b.pos.y.toFixed(1), z: +b.pos.z.toFixed(1) }));
  }
}

// --- smoke and mist --------------------------------------------------------------------------------------------------------------

/** A soft round dot (the puff's shape), drawn once. */
function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Smoke from chimneys and fires (and low mist): one `Points` for every source, each source a column of `per` puffs that rise, drift
 * with the wind, grow and fade, on the shader's clock. Muted, never a glow.
 */
export class Puffs {
  private src: { x: number; y: number; z: number; rise: number; size: number; per: number; life: number; spread: number }[] = [];
  constructor(private env: LifeEnv, private wind: { x: number; z: number }) {}
  add(x: number, y: number, z: number, o: { rise?: number; size?: number; per?: number; life?: number; spread?: number } = {}) {
    this.src.push({ x, y, z, rise: o.rise ?? 4.5, size: o.size ?? 1.6, per: o.per ?? 9, life: o.life ?? 7, spread: o.spread ?? 0.25 });
    return this;
  }
  get count() {
    return this.src.reduce((n, s) => n + s.per, 0);
  }
  build(color = 0xb9b6ae, opacity = 0.42) {
    const n = this.count;
    if (!n) return null;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4), form = new Float32Array(n * 3);
    let i = 0;
    const rnd = this.env.rnd;
    for (const s of this.src) for (let k = 0; k < s.per; k++, i++) {
      pos.set([s.x + (rnd() - 0.5) * s.spread, s.y, s.z + (rnd() - 0.5) * s.spread], i * 3);
      seed.set([k / s.per + rnd() * 0.05, 1 / s.life, rnd() * 6.28, 0.8 + rnd() * 0.4], i * 4);
      form.set([s.rise, s.size, s.spread], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.setAttribute('aForm', new THREE.BufferAttribute(form, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const map = puffTexture();
    const mat = new THREE.PointsMaterial({ color, map, size: 1, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, fog: true });
    patch(mat, 'puff', this.env.time, (sh) => {
      sh.uniforms.uWind = { value: new THREE.Vector2(this.wind.x, this.wind.z) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime;
          uniform vec2 uWind;
          attribute vec4 aSeed; // phase, 1/life, wobble phase, size factor
          attribute vec3 aForm; // rise, size, spread
          varying float vFade;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float age = fract(uTime * aSeed.y + aSeed.x);
          float up = aForm.x * age;
          transformed += vec3(uWind.x * age * age * aForm.x * 0.8 + sin(uTime * 0.7 + aSeed.z) * 0.25 * age, up, uWind.y * age * age * aForm.x * 0.8 + cos(uTime * 0.6 + aSeed.z) * 0.25 * age);
          vFade = smoothstep(0.0, 0.12, age) * (1.0 - age) * (1.0 - age);`)
        .replace('gl_PointSize = size;', 'gl_PointSize = aForm.y * aSeed.w * (0.5 + 1.8 * age) * 2.9;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying float vFade;`)
        .replace('#include <alphatest_fragment>', `diffuseColor.a *= vFade;
          #include <alphatest_fragment>`);
    });
    this.env.own.push(g, mat, map);
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 2;
    this.env.group.add(pts);
    return pts;
  }
}

// --- cloth -------------------------------------------------------------------------------------------------------------------------

/**
 * Cloth in the wind: pennants (held along one edge, `fly`), washing and nets (held along the top, `hang`), sails (held on the mast,
 * bellied, `sail`). One instanced mesh of a plane 1 m square (its held edge at x = 0 or y = 0), sized and placed by each instance's
 * matrix and coloured by its instance colour; the wave is the shader's.
 */
export class Cloth {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;
  private attr: THREE.InstancedBufferAttribute;
  constructor(private env: LifeEnv, most: number, o: { map?: THREE.Texture; alphaTest?: number } = {}) {
    // x from 0 (held) to 1 (free); y from 0 (bottom) to 1 (top)
    const geo = new THREE.PlaneGeometry(1, 1, 8, 4).translate(0.5, 0.5, 0);
    const mat = palMat(env, 0xffffff, { side: THREE.DoubleSide, roughness: 0.85, map: o.map ?? null, alphaTest: o.alphaTest ?? 0, transparent: false });
    patch(mat, o.map ? 'net' : 'cloth', env.time, (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime;
          attribute vec3 aCloth; // mode (0 fly, 1 hang, 2 sail), phase, strength`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float u = position.x, v = position.y, ph = aCloth.y, k = aCloth.z;
          if (aCloth.x < 0.5) {
            // a pennant: a travelling wave along it, growing to the free end
            transformed.z += sin(uTime * 7.0 - u * 6.0 + ph) * 0.16 * u * k;
            transformed.y += sin(uTime * 3.1 - u * 3.0 + ph) * 0.05 * u * k;
          } else if (aCloth.x < 1.5) {
            // hung by its top: it swings and ripples, the bottom most
            float w = 1.0 - v;
            transformed.z += (sin(uTime * 2.3 + ph + u * 2.0) * 0.18 + sin(uTime * 5.3 + u * 7.0 + ph) * 0.05) * w * k;
          } else {
            // a sail: bellied by the wind, breathing
            float b = sin(u * 3.1416) * sin(v * 3.1416);
            transformed.z += b * (0.35 + 0.08 * sin(uTime * 1.7 + ph)) * k;
          }`);
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, most);
    this.mesh.count = 0;
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(most * 3), 3);
    geo.setAttribute('aCloth', this.attr);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    env.own.push(geo);
    env.group.add(this.mesh);
  }
  /** A cloth `w` by `h` m at `m` (its held edge at the matrix's origin), coloured, in mode 0 fly, 1 hang, 2 sail. Returns its index. */
  add(m: THREE.Matrix4, w: number, h: number, color: number, mode: 0 | 1 | 2, strength = 1) {
    const i = this.n++;
    if (i >= this.mesh.instanceMatrix.count) return -1;
    this.set(i, m, w, h);
    this.mesh.setColorAt(i, new THREE.Color(color));
    (this.attr.array as Float32Array).set([mode, this.env.rnd() * 6.28, strength], i * 3);
    this.mesh.count = this.n;
    return i;
  }
  private sm = new THREE.Matrix4();
  set(i: number, m: THREE.Matrix4, w: number, h: number) {
    this.sm.makeScale(w, h, 1).premultiply(m);
    this.mesh.setMatrixAt(i, this.sm);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  get count() {
    return this.n;
  }
  done() {
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.attr.needsUpdate = true;
  }
}

// --- water: rings and leaping fish ------------------------------------------------------------------------------------------------

/**
 * Rings that spread on still water and fish that leap from it: two instanced meshes, all on the shader's clock. Each spot has a
 * period; a fish's leap and its two rings (out and back in) share it, so a ring opens where it went in.
 */
export class Shallows {
  private rings: { x: number; y: number; z: number; ph: number; per: number; size: number }[] = [];
  private fish: { x: number; y: number; z: number; yaw: number; ph: number; per: number; len: number }[] = [];
  constructor(private env: LifeEnv) {}
  ring(x: number, y: number, z: number, per: number, ph: number, size = 1.4) {
    this.rings.push({ x, y, z, ph, per, size });
  }
  leap(x: number, y: number, z: number, yaw: number, per: number, ph: number, len = 1.6) {
    this.fish.push({ x, y, z, yaw, ph, per, len });
    // the ring where it leaves the water, and where it goes back in (a moment later in the period)
    this.ring(x - Math.sin(yaw) * len / 2, y, z - Math.cos(yaw) * len / 2, per, ph, 0.9);
    this.ring(x + Math.sin(yaw) * len / 2, y, z + Math.cos(yaw) * len / 2, per, ph - 0.06, 1.1);
  }
  get counts() {
    return { rings: this.rings.length, fish: this.fish.length };
  }
  build() {
    const env = this.env, m = new THREE.Matrix4();
    if (this.rings.length) {
      const geo = new THREE.RingGeometry(0.86, 1, 24, 1).rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0xe4ebe6, transparent: true, opacity: 0.55, depthWrite: false, fog: true });
      env.own.push(geo, mat);
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(this.rings.length * 3), 3);
      geo.setAttribute('aRing', attr);
      patch(mat, 'ring', env.time, (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', `#include <common>
            uniform float uTime;
            attribute vec3 aRing; // phase, period, size
            varying float vFade;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            float age = fract(uTime / aRing.y + aRing.x);
            // a ring lives the first 0.22 of its period
            float k = clamp(age / 0.22, 0.0, 1.0);
            transformed.xz *= aRing.z * (0.15 + 0.85 * sqrt(k));
            vFade = (age < 0.22 ? 1.0 : 0.0) * smoothstep(0.0, 0.06, k) * (1.0 - k);`);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
            varying float vFade;`)
          .replace('#include <alphatest_fragment>', `diffuseColor.a *= vFade;
            #include <alphatest_fragment>`);
      });
      const im = new THREE.InstancedMesh(geo, mat, this.rings.length);
      this.rings.forEach((r, i) => {
        im.setMatrixAt(i, m.makeTranslation(r.x, r.y, r.z));
        (attr.array as Float32Array).set([r.ph, r.per, r.size], i * 3);
      });
      im.frustumCulled = false;
      im.renderOrder = 1;
      env.group.add(im);
    }
    if (this.fish.length) {
      // a fish: a slim silver body along +z, a tail
      const geo = mergeGeometries([new THREE.SphereGeometry(1, 8, 5).scale(0.06, 0.09, 0.24), new THREE.ConeGeometry(0.08, 0.14, 4).rotateX(Math.PI / 2).scale(0.3, 1, 1).translate(0, 0, -0.27)])!;
      const mat = palMat(env, 0x9aa3a8, { roughness: 0.35, metalness: 0.75 });
      env.own.push(geo);
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(this.fish.length * 3), 3);
      geo.setAttribute('aLeap', attr);
      patch(mat, 'leap', env.time, (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', `#include <common>
            uniform float uTime;
            attribute vec3 aLeap; // phase, period, length`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            float age = fract(uTime / aLeap.y + aLeap.x);
            // the leap is the first 0.06 of the period (under a second); else it is under the water, drawn at nothing
            float k = age / 0.06;
            float on = k < 1.0 ? 1.0 : 0.0;
            float pitch = mix(0.9, -0.9, k);
            vec3 p = transformed;
            transformed.y = p.y * cos(pitch) - p.z * sin(pitch);
            transformed.z = p.y * sin(pitch) + p.z * cos(pitch);
            transformed *= on;
            transformed += on * vec3(0.0, sin(k * 3.1416) * 0.55 * aLeap.z / 1.6 - 0.05, (k - 0.5) * aLeap.z);`);
      });
      const im = new THREE.InstancedMesh(geo, mat, this.fish.length);
      const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
      this.fish.forEach((f, i) => {
        im.setMatrixAt(i, m.compose(new THREE.Vector3(f.x, f.y, f.z), q.setFromAxisAngle(up, f.yaw), one));
        (attr.array as Float32Array).set([f.ph, f.per, f.len], i * 3);
      });
      im.frustumCulled = false;
      im.castShadow = false;
      env.group.add(im);
    }
  }
}

// --- floating things: boats on their moorings -------------------------------------------------------------------------------------

/**
 * Things that float and bob: each a set of parts (a geometry per material, merged), one instanced mesh per part for all of them,
 * moved by the processor (a few matrices a frame) with a slow bob, roll and pitch of their own.
 */
export class Floaters {
  private items: { x: number; y: number; z: number; yaw: number; ph: number; amp: number; drift?: { r: number; w: number; cx: number; cz: number } }[] = [];
  private parts: { mesh: THREE.InstancedMesh; local: THREE.Matrix4 }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  /** Sails or flags that ride on them: a cloth index, its matrix on the boat, its size. */
  private cloths: { item: number; index: number; local: THREE.Matrix4; w: number; h: number }[] = [];
  constructor(private env: LifeEnv, private cloth: Cloth | null) {}
  add(x: number, y: number, z: number, yaw: number, amp = 1, drift?: { r: number; w: number; cx: number; cz: number }) {
    this.items.push({ x, y, z, yaw, ph: this.env.rnd() * 6.28, amp, drift });
    return this.items.length - 1;
  }
  /** A sail on item `item`, `local` its place on the boat (held edge at the mast). */
  sail(item: number, local: THREE.Matrix4, w: number, h: number, color: number, mode: 0 | 1 | 2 = 2) {
    if (!this.cloth) return;
    const index = this.cloth.add(new THREE.Matrix4(), w, h, color, mode, 1);
    if (index >= 0) this.cloths.push({ item, index, local, w, h });
  }
  get count() {
    return this.items.length;
  }
  /** The parts (geometry and material each), and per item an instance colour for the first part (the hull's paint). */
  build(parts: { geo: THREE.BufferGeometry; mat: THREE.Material; paint?: number[] }[]) {
    if (!this.items.length) return;
    for (const pt of parts) {
      const im = new THREE.InstancedMesh(pt.geo, pt.mat, this.items.length);
      if (pt.paint) this.items.forEach((_, i) => im.setColorAt(i, new THREE.Color(pt.paint![i % pt.paint!.length])));
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.castShadow = false;
      im.receiveShadow = true;
      this.env.group.add(im);
      this.env.own.push(pt.geo);
      this.parts.push({ mesh: im, local: new THREE.Matrix4() });
    }
    this.update(0);
  }
  private now = 0;
  update(dt: number) {
    this.now += dt;
    const t = this.now;
    this.items.forEach((it, i) => {
      let x = it.x, z = it.z, yaw = it.yaw;
      if (it.drift) {
        const a = it.drift.w * t + it.ph;
        x = it.drift.cx + Math.cos(a) * it.drift.r;
        z = it.drift.cz + Math.sin(a) * it.drift.r;
        yaw = Math.atan2(-Math.sin(a) * Math.sign(it.drift.w), Math.cos(a) * Math.sign(it.drift.w));
      }
      const bob = Math.sin(t * 1.1 + it.ph) * 0.06 * it.amp;
      this.e.set(Math.sin(t * 0.9 + it.ph * 1.3) * 0.035 * it.amp, yaw + Math.sin(t * 0.21 + it.ph) * 0.06, Math.sin(t * 1.3 + it.ph * 0.7) * 0.06 * it.amp);
      this.q.setFromEuler(this.e);
      this.m.compose(this.p.set(x, it.y + bob, z), this.q, this.one);
      for (const pt of this.parts) pt.mesh.setMatrixAt(i, this.m);
      for (const c of this.cloths) if (c.item === i) this.cloth!.set(c.index, this.sm.multiplyMatrices(this.m, c.local), c.w, c.h);
    });
    for (const pt of this.parts) pt.mesh.instanceMatrix.needsUpdate = true;
  }
  private sm = new THREE.Matrix4();
}

// --- static dressing: painted parts merged into two meshes per square of ground ------------------------------------------------

/**
 * Small things that do not move (coils of rope, baskets, poles, floats), each part painted its palette colour into the geometry and
 * merged: per square of `cell` m one matte mesh (vertex colours) and one gold (polished metal), so a whole floor of them is a few
 * draw calls and a square out of view is not drawn. No shadows (they are small; a shadow would draw each square twice).
 */
export class Dress {
  private cells = new Map<string, { matte: THREE.BufferGeometry[]; gold: THREE.BufferGeometry[] }>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  constructor(private env: LifeEnv, private cell = 40) {}
  /** `color` a palette colour, or 'gold'. */
  add(color: number | 'gold', geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, tilt = 0) {
    const g = painted(geo.index ? geo.toNonIndexed() : geo.clone(), color === 'gold' ? 0xffffff : color);
    this.m.compose(new THREE.Vector3(x, y, z), this.q.setFromEuler(this.e.set(tilt, yaw, 0)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(this.m);
    geo.dispose();
    const key = `${Math.floor(x / this.cell)}:${Math.floor(z / this.cell)}`;
    let c = this.cells.get(key);
    if (!c) this.cells.set(key, (c = { matte: [], gold: [] }));
    (color === 'gold' ? c.gold : c.matte).push(g);
    return this;
  }
  get parts() {
    let n = 0;
    for (const c of this.cells.values()) n += c.matte.length + c.gold.length;
    return n;
  }
  build() {
    const matte = palMat(this.env, 0xffffff, { vertexColors: true, roughness: 0.72 }), gold = goldOf(this.env);
    for (const c of this.cells.values()) {
      for (const [list, mat] of [[c.matte, matte], [c.gold, gold]] as const) {
        if (!list.length) continue;
        const merged = mergeGeometries(list, false);
        for (const g of list) g.dispose();
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat);
        mesh.receiveShadow = true;
        this.env.group.add(mesh);
        this.env.own.push(merged);
      }
    }
    this.cells.clear();
  }
}

// --- where things may stand -----------------------------------------------------------------------------------------------------

const segDist = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2)) : 0;
  return Math.hypot(px - (ax + ex * t), pz - (az + ez * t));
};

/**
 * The ground a floor's life must keep off: its roads (world segments), its cover, its spots (`floorKeep`: people, packs, patrols,
 * quests, doors...), the low ground that floods, the packs' homes (with room for their fights), and what life itself put down.
 */
export class Room {
  private taken: { x: number; z: number; r: number }[] = [];
  constructor(private o: {
    roads: [number, number, number, number][];
    cover: { ax: number; az: number; bx: number; bz: number; r: number; fixed?: boolean }[];
    keep: { x: number; z: number }[];
    low: { x: number; z: number; rx: number; rz: number; rot?: number }[];
    packs: { x: number; z: number; r: number }[];
  }) {}
  road(x: number, z: number) {
    let d = Infinity;
    for (const [ax, az, bx, bz] of this.o.roads) d = Math.min(d, segDist(x, z, ax, az, bx, bz));
    return d;
  }
  cover(x: number, z: number) {
    let d = Infinity;
    for (const c of this.o.cover) if (!c.fixed) d = Math.min(d, segDist(x, z, c.ax, c.az, c.bx, c.bz) - c.r);
    return d;
  }
  low(x: number, z: number) {
    return this.o.low.some((l) => {
      const c = Math.cos(-(l.rot ?? 0)), s = Math.sin(-(l.rot ?? 0)), dx = x - l.x, dz = z - l.z, u = dx * c - dz * s, v = dx * s + dz * c;
      return (u / (l.rx + 1.5)) ** 2 + (v / (l.rz + 1.5)) ** 2 < 1;
    });
  }
  /** Free for a thing `r` m round: off roads by `road`, off cover, spots, packs' fights, the flats and what is already down. */
  free(x: number, z: number, r: number, o: { road?: number; packs?: boolean; lowOk?: boolean } = {}) {
    if (this.road(x, z) < (o.road ?? 2.4) + r) return false;
    if (this.cover(x, z) < r + 0.35) return false;
    if (this.o.keep.some((k) => Math.hypot(k.x - x, k.z - z) < r + 2.2)) return false;
    if (o.packs !== false && this.o.packs.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r)) return false;
    if (!o.lowOk && this.low(x, z)) return false;
    if (this.taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + r)) return false;
    return true;
  }
  take(x: number, z: number, r: number) {
    this.taken.push({ x, z, r });
  }
  /** The nearest a pack's home is (m). */
  packNear(x: number, z: number) {
    let d = Infinity;
    for (const p of this.o.packs) d = Math.min(d, Math.hypot(p.x - x, p.z - z) - p.r);
    return d;
  }
}

// --- beasts on the ground: deer, foxes, hares, lizards, camels... -------------------------------------------------------------------

/**
 * A four-legged beast's shape, built in code facing +z, its feet at y = 0: body, neck and head, ears, tail, four legs, coloured per
 * part (vertex colours), with an `aPart` attribute (kind 0 body, 1 a leg, 2 the head and neck; the leg's step phase; the pivot's y
 * and z) that the shader swings (legs about the hip, the head down to graze about the neck's foot). Sizes are life size times `s`.
 */
export function beastGeometry(o: {
  s: number; shoulder: number; len: number; girth: number; neck: number; head: number; leg?: number;
  colors: { body: number; under?: number; leg: number; head?: number; tail?: number; ear?: number };
  ears?: 'long' | 'point' | 'round'; tail?: 'stub' | 'brush' | 'long'; low?: boolean;
  /** A hump on the back (its height as a share of the girth), and a saddle cloth over it (a colour). */
  hump?: number; saddle?: number;
}) {
  const parts: THREE.BufferGeometry[] = [];
  const s = o.s, c = o.colors, sh = o.shoulder * s, L = o.len * s, G = o.girth * s, legR = (o.leg ?? 0.045) * s;
  const tag = (g: THREE.BufferGeometry, kind: number, phase: number, py: number, pz: number) => {
    const n = g.attributes.position.count, a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) a.set([kind, phase, py, pz], i * 4);
    g.setAttribute('aPart', new THREE.BufferAttribute(a, 4));
    return g;
  };
  const bodyY = sh - G * 0.35;
  parts.push(tag(painted(new THREE.SphereGeometry(1, 10, 7).scale(G * 0.5, G * 0.55, L * 0.5).translate(0, bodyY, 0), c.body), 0, 0, 0, 0));
  if (c.under) parts.push(tag(painted(new THREE.SphereGeometry(1, 8, 5).scale(G * 0.38, G * 0.3, L * 0.4).translate(0, bodyY - G * 0.3, 0.02 * L), c.under), 0, 0, 0, 0));
  if (o.hump) {
    parts.push(tag(painted(new THREE.SphereGeometry(1, 9, 6).scale(G * 0.33, G * o.hump, L * 0.24).translate(0, bodyY + G * 0.42, -L * 0.04), c.body), 0, 0, 0, 0));
    if (o.saddle) {
      // a cloth over the hump, hanging down both flanks, a gold edge
      parts.push(tag(painted(new THREE.BoxGeometry(G * 0.72, 0.05 * s, L * 0.36).translate(0, bodyY + G * 0.42 + G * o.hump * 0.55, -L * 0.04), o.saddle), 0, 0, 0, 0));
      for (const side of [-1, 1]) {
        parts.push(tag(painted(new THREE.BoxGeometry(0.03 * s, G * 0.55, L * 0.34).translate(side * G * 0.47, bodyY + G * 0.12, -L * 0.04), o.saddle), 0, 0, 0, 0));
        parts.push(tag(painted(new THREE.BoxGeometry(0.035 * s, 0.035 * s, L * 0.35).translate(side * G * 0.48, bodyY - G * 0.15, -L * 0.04), PAL.gold), 0, 0, 0, 0));
      }
    }
  }
  // the neck and head, pivoting at the neck's foot (graze: the head down to the ground)
  const ny = bodyY + G * 0.15, nz = L * 0.4, nl = o.neck * s, hl = o.head * s;
  const up = o.low ? 0.35 : 0.85; // the neck's rise (0 level, about 1.2 upright)
  const ex = nz + Math.cos(up) * nl * 0.9, ey = ny + Math.sin(up) * nl * 0.9;
  const neck = new THREE.CylinderGeometry(G * 0.17, G * 0.24, nl, 7).translate(0, nl / 2, 0).rotateX(Math.PI / 2 - up).translate(0, ny, nz);
  parts.push(tag(painted(neck, c.body), 2, 0, ny, nz));
  const head = new THREE.SphereGeometry(1, 8, 6).scale(hl * 0.3, hl * 0.32, hl * 0.55).translate(0, ey + hl * 0.05, ex + hl * 0.25);
  parts.push(tag(painted(head, c.head ?? c.body), 2, 0, ny, nz));
  const muzzle = new THREE.ConeGeometry(hl * 0.18, hl * 0.45, 6).rotateX(Math.PI / 2).translate(0, ey - hl * 0.02, ex + hl * 0.75);
  parts.push(tag(painted(muzzle, c.head ?? c.body), 2, 0, ny, nz));
  for (const side of [-1, 1]) {
    const ear = o.ears === 'long'
      ? new THREE.ConeGeometry(hl * 0.08, hl * 0.8, 5).scale(1, 1, 0.5).rotateX(-0.25).translate(side * hl * 0.12, ey + hl * 0.6, ex + hl * 0.05)
      : o.ears === 'round'
        ? new THREE.SphereGeometry(hl * 0.12, 6, 4).translate(side * hl * 0.2, ey + hl * 0.3, ex + hl * 0.1)
        : new THREE.ConeGeometry(hl * 0.11, hl * 0.4, 4).rotateZ(-side * 0.35).translate(side * hl * 0.2, ey + hl * 0.4, ex + hl * 0.1);
    parts.push(tag(painted(ear, c.ear ?? c.head ?? c.body), 2, 0, ny, nz));
  }
  if (o.tail) {
    const t = o.tail === 'brush'
      ? new THREE.SphereGeometry(1, 7, 5).scale(G * 0.16, G * 0.16, L * 0.38).rotateX(0.5).translate(0, bodyY - G * 0.05, -L * 0.72)
      : o.tail === 'long'
        ? new THREE.ConeGeometry(G * 0.12, L * 0.9, 5).rotateX(-Math.PI / 2 + 0.15).translate(0, bodyY - G * 0.15, -L * 0.85)
        : new THREE.ConeGeometry(G * 0.1, L * 0.18, 5).rotateX(-Math.PI / 2 - 0.6).translate(0, bodyY + G * 0.2, -L * 0.52);
    parts.push(tag(painted(t, c.tail ?? c.body), 0, 0, 0, 0));
  }
  // the legs: a front pair and a hind pair, the diagonal pairs in step
  const hip = bodyY - G * 0.1, legLen = hip;
  for (const [lx, lz, ph] of [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]] as const) {
    const x = lx * G * 0.28, z = lz * L * 0.34;
    const leg = new THREE.CylinderGeometry(legR, legR * 0.75, legLen, 5).translate(x, hip - legLen / 2, z);
    parts.push(tag(painted(leg, c.leg), 1, ph, hip, z));
  }
  return mergeGeometries(parts)!;
}

interface Beast {
  home: { x: number; z: number };
  x: number; z: number; yaw: number; want: number;
  state: 'graze' | 'look' | 'alert' | 'flee' | 'away' | 'back';
  t: number; next: number;
  gait: number; graze: number; step: number;
  tx: number; tz: number;
}

/**
 * Beasts that graze or sit about (deer at a glade's edge, a fox, hares, lizards on a rock, camels at a well): one instanced mesh a
 * kind. Each keeps near its home, now and then lifts its head and looks round; when the hero comes within `shy` m (or a fight comes
 * near) it looks up, then bolts away from the hero, and comes back at a walk when the hero has gone. `shy: 0`: it never bolts (a
 * tethered camel), it only turns its head. The legs and the head move in the shader; the processor moves only the body.
 */
export class Beasts {
  readonly mesh: THREE.InstancedMesh;
  private list: Beast[] = [];
  private attr: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  constructor(
    private env: LifeEnv,
    geo: THREE.BufferGeometry,
    homes: { x: number; z: number }[],
    private o: { shy: number; walk: number; run: number; stride: number; flee: number; ok: (x: number, z: number) => boolean; danger: (x: number, z: number) => boolean; graze?: number; y?: (x: number, z: number) => number },
  ) {
    const mat = palMat(env, 0xffffff, { vertexColors: true, roughness: 0.85 });
    patch(mat, 'beast', env.time, (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime;
          attribute vec4 aPart; // kind (0 body, 1 leg, 2 head), the leg's phase, the pivot's y and z
          attribute vec3 aBeast; // the step's phase, gait 0..1 (0 still, 0.5 a walk, 1 a run), graze 0..1`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float g = aBeast.y;
          vec2 yz = transformed.yz - aPart.zw;
          if (aPart.x > 0.5 && aPart.x < 1.5) {
            // a leg: swung about the hip, further at a run
            float a = sin(aBeast.x + aPart.y) * (0.25 + 0.4 * g) * step(0.01, g);
            transformed.yz = aPart.zw + vec2(yz.x * cos(a) - yz.y * sin(a), yz.x * sin(a) + yz.y * cos(a));
          } else if (aPart.x > 1.5) {
            // the head and neck: down to the grass (graze), a nod at a run
            float a = aBeast.z * 1.05 + sin(aBeast.x * 2.0) * 0.08 * g;
            transformed.yz = aPart.zw + vec2(yz.x * cos(a) - yz.y * sin(a), yz.x * sin(a) + yz.y * cos(a));
          }
          // the body rises and falls with the step
          transformed.y += abs(sin(aBeast.x)) * 0.06 * g;`);
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, homes.length));
    this.mesh.count = homes.length;
    env.own.push(geo);
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, homes.length) * 3), 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aBeast', this.attr);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    env.group.add(this.mesh);
    const rnd = env.rnd;
    for (const h of homes) {
      const yaw = rnd() * 6.28;
      this.list.push({ home: h, x: h.x, z: h.z, yaw, want: yaw, state: 'graze', t: 0, next: 2 + rnd() * 6, gait: 0, graze: 1, step: rnd() * 6.28, tx: h.x, tz: h.z });
    }
    this.write();
  }

  get count() {
    return this.list.length;
  }

  /** A point `d` m from (x, z) away from (hx, hz), turned a little until `ok` (inside the floor, off the paths...). */
  private away(x: number, z: number, hx: number, hz: number, d: number) {
    const a0 = Math.atan2(z - hz, x - hx);
    for (let k = 0; k < 9; k++) {
      const a = a0 + Math.ceil(k / 2) * 0.35 * (k % 2 ? 1 : -1), tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d;
      if (this.o.ok(tx, tz)) return { x: tx, z: tz };
    }
    return { x, z };
  }

  update(dt: number, hero: THREE.Vector3) {
    const rnd = this.env.rnd, o = this.o;
    for (const b of this.list) {
      b.t += dt;
      const dh = Math.hypot(hero.x - b.x, hero.z - b.z);
      const scared = o.shy > 0 && (dh < o.shy || o.danger(b.x, b.z));
      let speed = 0, graze = 0;
      switch (b.state) {
        case 'graze': case 'look': {
          if (scared) { b.state = 'alert'; b.t = 0; b.next = 0.35 + rnd() * 0.5; break; }
          if (o.shy === 0 && dh < 9) b.want = Math.atan2(hero.x - b.x, hero.z - b.z); // a tethered one turns to look
          if ((b.next -= dt) < 0) {
            if (b.state === 'graze') { b.state = 'look'; b.next = 1.5 + rnd() * 2.5; if (rnd() < 0.5) b.want = b.yaw + (rnd() - 0.5) * 2; }
            else {
              b.state = 'graze';
              b.next = 3 + rnd() * 7;
              if (rnd() < 0.4) { const a = rnd() * 6.28, r = rnd() * 2.5, tx = b.home.x + Math.cos(a) * r, tz = b.home.z + Math.sin(a) * r; if (o.ok(tx, tz)) { b.tx = tx; b.tz = tz; } }
            }
          }
          // a slow step or two to a new mouthful
          const d = Math.hypot(b.tx - b.x, b.tz - b.z);
          if (d > 0.15) { speed = o.walk * 0.6; b.want = Math.atan2(b.tx - b.x, b.tz - b.z); }
          graze = b.state === 'graze' && d <= 0.15 ? (o.graze ?? 1) : 0;
          break;
        }
        case 'alert':
          // head up, turned to the hero, a moment
          b.want = Math.atan2(hero.x - b.x, hero.z - b.z);
          if (b.t > b.next) { const p = this.away(b.x, b.z, hero.x, hero.z, o.flee * (0.8 + rnd() * 0.4)); b.tx = p.x; b.tz = p.z; b.state = 'flee'; b.t = 0; }
          break;
        case 'flee': case 'back': {
          const d = Math.hypot(b.tx - b.x, b.tz - b.z);
          speed = b.state === 'flee' ? o.run * Math.min(1, 0.4 + b.t * 1.5) : o.walk;
          b.want = Math.atan2(b.tx - b.x, b.tz - b.z);
          if (b.state === 'back' && scared) { b.state = 'alert'; b.t = 0; b.next = 0.2; break; }
          if (d < 0.4) { b.state = b.state === 'flee' ? 'away' : 'graze'; b.t = 0; b.next = 2 + rnd() * 4; }
          break;
        }
        case 'away':
          // stands where it ran to, then grazes; goes home when the hero is well away from it (and from home)
          if (scared && b.t > 0.5) { const p = this.away(b.x, b.z, hero.x, hero.z, o.flee * 0.6); b.tx = p.x; b.tz = p.z; b.state = 'flee'; b.t = 0; break; }
          graze = b.t > 3 ? (o.graze ?? 1) : 0;
          if (b.t > 10 && dh > o.shy * 2.5 && Math.hypot(hero.x - b.home.x, hero.z - b.home.z) > o.shy * 2.5) { b.state = 'back'; b.tx = b.home.x; b.tz = b.home.z; b.t = 0; }
          break;
      }
      // turn towards where it wants to face, then move
      const dy = Math.atan2(Math.sin(b.want - b.yaw), Math.cos(b.want - b.yaw));
      b.yaw += dy * Math.min(1, dt * (speed > o.walk ? 8 : 4));
      if (speed > 0 && Math.abs(dy) < 1.2) { b.x += Math.sin(b.yaw) * speed * dt; b.z += Math.cos(b.yaw) * speed * dt; }
      const gaitTo = speed <= 0 ? 0 : speed <= o.walk ? 0.5 * Math.min(1, speed / o.walk) : 0.5 + 0.5 * Math.min(1, (speed - o.walk) / Math.max(0.1, o.run - o.walk));
      b.gait += (gaitTo - b.gait) * Math.min(1, dt * 6);
      b.graze += (graze - b.graze) * Math.min(1, dt * 2.5);
      b.step += dt * (speed / o.stride) * Math.PI * 2;
    }
    this.write();
  }

  private write() {
    const a = this.attr.array as Float32Array;
    this.list.forEach((b, i) => {
      this.q.setFromAxisAngle(this.up, b.yaw);
      this.m.compose(this.p.set(b.x, this.o.y ? this.o.y(b.x, b.z) : 0, b.z), this.q, this.one);
      this.mesh.setMatrixAt(i, this.m);
      a[i * 3] = b.step % 6.2831853;
      a[i * 3 + 1] = b.gait;
      a[i * 3 + 2] = b.graze;
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.attr.needsUpdate = true;
  }

  /** What each does (the tools). */
  snapshot() {
    return this.list.map((b) => ({ state: b.state, x: +b.x.toFixed(1), z: +b.z.toFixed(1) }));
  }
}

// --- motes: leaves, ash, dust and spores in the air; butterflies, moths and dragonflies ------------------------------------------

/**
 * Small things in the air, one instanced mesh, moved only in the shader. Two ways to be: drifting in a box round the hero (`around`:
 * the box moves with the hero and what leaves it on one side comes in on the other, so a whole floor has them for the cost of the box
 * full: ash falling, dust blowing, spores hanging) or hovering round fixed spots (`spots`: butterflies over a glade, moths at a
 * crystal, dragonflies over a pool). A `flake` tumbles; a `wing` is two wings that beat; a `mote` is a speck. Lit by the scene like
 * everything else (never a glow).
 */
export class Motes {
  readonly mesh: THREE.InstancedMesh;
  private center = { value: new THREE.Vector3() };
  constructor(env: LifeEnv, o: {
    n: number; shape: 'flake' | 'wing' | 'mote'; size: number; colors: number[];
    around?: { box: [number, number, number]; base: number; vel: [number, number, number]; sway: number };
    spots?: { x: number; y: number; z: number; r: number }[];
    spin?: number; flap?: number; roughness?: number; metal?: number;
  }) {
    const s = o.size;
    let geo: THREE.BufferGeometry;
    if (o.shape === 'wing') {
      // two wings from the body's line: each two triangles out to its side
      const g = new THREE.BufferGeometry();
      const v = [0, 0, 0.35, 1, 0, 0.5, 0.9, 0, -0.45, 0, 0, -0.35, 0, 0, 0.35, 0.9, 0, -0.45, 0, 0, 0.35, -0.9, 0, -0.45, -1, 0, 0.5, 0, 0, 0.35, 0, 0, -0.35, -0.9, 0, -0.45];
      g.setAttribute('position', new THREE.Float32BufferAttribute(v.map((k) => k * s * 0.5), 3));
      g.computeVertexNormals();
      geo = g;
    } else if (o.shape === 'flake') geo = new THREE.PlaneGeometry(s, s * 0.7);
    else geo = new THREE.OctahedronGeometry(s * 0.5, 0);
    const mat = palMat(env, 0xffffff, { side: THREE.DoubleSide, roughness: o.roughness ?? 0.85, metalness: o.metal ?? 0 });
    const A = o.around, n = o.n;
    patch(mat, `mote-${o.shape}-${A ? 'a' : 's'}-${o.spin ?? 0}-${o.flap ?? 0}-${A ? A.base + ',' + A.sway : ''}`, env.time, (sh) => {
      sh.uniforms.uCenter = this.center;
      sh.uniforms.uBox = { value: new THREE.Vector3(...(A?.box ?? [1, 1, 1])) };
      sh.uniforms.uVel = { value: new THREE.Vector3(...(A?.vel ?? [0, 0, 0])) };
      const turn = o.shape === 'wing'
        ? `
          // the wings beat about the body's line
          float beat = sin(uTime * ${((o.flap ?? 9) * 6.2832).toFixed(2)} + ph) * 0.9 + 0.25;
          transformed.y += abs(transformed.x) * sin(beat) * 1.2;
          transformed.x *= cos(beat);`
        : `
          // tumbling about an axis of its own
          vec3 ax = normalize(vec3(aMote.x - 0.5, aMote.y - 0.2, aMote.z - 0.5) + 0.001);
          transformed = rotAxis(transformed, ax, uTime * ${(o.spin ?? 1.5).toFixed(2)} * (0.6 + aMote.y) + ph);`;
      const place = A
        ? `
          // drifting in the box round the hero, wrapped (what leaves on one side comes in on the other)
          vec3 sway = vec3(sin(uTime * 0.9 + ph * 3.0), 0.0, cos(uTime * 0.7 + ph * 2.0)) * ${A.sway.toFixed(2)};
          vec3 w = aMote.xyz * uBox + uVel * uTime * (0.75 + 0.5 * aMote.y) + sway;
          vec3 rel = mod(w - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
          float hy = mod(w.y, uBox.y);
          at = vec3(uCenter.x + rel.x, ${A.base.toFixed(2)} + hy, uCenter.z + rel.z);
          // smaller to nothing at the box's sides, its top and its bottom (none pops in)
          float edge = smoothstep(0.5, 0.38, max(abs(rel.x) / uBox.x, abs(rel.z) / uBox.z)) * smoothstep(0.0, 0.12, hy / uBox.y) * smoothstep(1.0, 0.85, hy / uBox.y);
          transformed *= edge;`
        : `
          // hovering round its spot: a wandering loop, now and then a dart
          float t = uTime * (0.25 + 0.2 * aMote.y) + ph;
          at = aHome.xyz + vec3(sin(t * 1.3 + aMote.x * 6.0) + 0.4 * sin(t * 3.1), 0.0, cos(t * 1.1 + aMote.z * 6.0) + 0.4 * cos(t * 2.7)) * aHome.w
            + vec3(0.0, sin(t * 0.9 + aMote.y * 6.0) * 0.45 + sin(uTime * 7.0 + ph) * 0.04, 0.0);
          ${o.shape === 'wing' ? `
          // turned to the way it goes
          vec2 vel = vec2(cos(t * 1.3 + aMote.x * 6.0) * 1.3 + 1.24 * cos(t * 3.1), -sin(t * 1.1 + aMote.z * 6.0) * 1.1 - 1.08 * sin(t * 2.7));
          float yw = atan(vel.x, vel.y);
          transformed.xz = vec2(transformed.x * cos(yw) + transformed.z * sin(yw), -transformed.x * sin(yw) + transformed.z * cos(yw));` : ''}`;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime;
          uniform vec3 uCenter, uBox, uVel;
          attribute vec4 aMote; // seed (0..1) x, y, z, phase
          attribute vec4 aHome; // a spot's middle and reach (spots)
          vec3 rotAxis(vec3 p, vec3 k, float a) { return p * cos(a) + cross(k, p) * sin(a) + k * dot(k, p) * (1.0 - cos(a)); }`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = aMote.w * 6.2832;
          vec3 at;
          ${turn}
          ${place}
          transformed *= 0.75 + 0.5 * aMote.x;
          transformed += at;`);
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    env.own.push(geo);
    const mote = new Float32Array(n * 4), home = new Float32Array(n * 4), rnd = env.rnd, col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      mote.set([rnd(), rnd(), rnd(), rnd()], i * 4);
      if (o.spots?.length) { const sp = o.spots[i % o.spots.length]; home.set([sp.x, sp.y, sp.z, sp.r], i * 4); }
      this.mesh.setColorAt(i, col.set(o.colors[i % o.colors.length]));
    }
    geo.setAttribute('aMote', new THREE.InstancedBufferAttribute(mote, 4));
    geo.setAttribute('aHome', new THREE.InstancedBufferAttribute(home, 4));
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    env.group.add(this.mesh);
  }
  /** Moves the box with the hero (`around`). */
  follow(hero: THREE.Vector3) {
    this.center.value.set(hero.x, 0, hero.z);
  }
  get count() {
    return this.mesh.count;
  }
}

// --- the ground a chapter's life keeps off, from any chapter's look ----------------------------------------------------------------

/**
 * The `Room` of a floor from its look (any chapter's: its trails as offsets from the middle, its cover) and its floor (the spots,
 * the packs): what every chapter's life keeps off. `low`: ground that floods or is otherwise not to be stood on.
 */
export function roomOf(look: { paths?: [number, number][][]; pieces: { o: { ax: number; az: number; bx: number; bz: number; r: number; fixed?: boolean } }[] }, def: FloorDef, low: { x: number; z: number; rx: number; rz: number; rot?: number }[] = []) {
  const roads: [number, number, number, number][] = [];
  for (const p of look.paths ?? []) for (let i = 1; i < p.length; i++) roads.push([RING.x + p[i - 1][0], RING.z + p[i - 1][1], RING.x + p[i][0], RING.z + p[i][1]]);
  return new Room({
    roads, cover: look.pieces.map((p) => p.o), keep: floorKeep(def), low,
    packs: def.packs.map((p) => ({ x: p.at.x, z: p.at.z, r: p.named ? 4 : 8 })),
  });
}


// --- drips: drops falling from the dark into still water, each opening a ring where it lands -------------------------------------------

/**
 * Drops falling from the dark above into a pool: one `Points` for all, on the shader's clock. Each drop falls in the first tenth of
 * its period; the ring it opens is a `Shallows` ring on the same period, timed to the landing (`ring` below adds it).
 */
export class Drips {
  private list: { x: number; y: number; z: number; h: number; per: number; ph: number }[] = [];
  constructor(private env: LifeEnv) {}
  /** A drop falling `h` m onto (x, y, z) every `per` s; its ring goes to `rings`. */
  add(rings: Shallows, x: number, y: number, z: number, h: number, per: number, ph: number) {
    this.list.push({ x, y, z, h, per, ph });
    // the drop lands at a tenth of the period: the ring starts there
    rings.ring(x, y + 0.01, z, per, ph - 0.1, 0.55);
  }
  get count() {
    return this.list.length;
  }
  build(color = 0xc8d4e0) {
    const n = this.list.length;
    if (!n) return null;
    const pos = new Float32Array(n * 3), drop = new Float32Array(n * 3);
    this.list.forEach((d, i) => { pos.set([d.x, d.y, d.z], i * 3); drop.set([d.h, d.per, d.ph], i * 3); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aDrop', new THREE.BufferAttribute(drop, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const map = puffTexture();
    const mat = new THREE.PointsMaterial({ color, map, size: 1, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, fog: true });
    patch(mat, 'drip', this.env.time, (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime;
          attribute vec3 aDrop; // height, period, phase`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float age = fract(uTime / aDrop.y + aDrop.z);
          float k = clamp(age / 0.1, 0.0, 1.0);
          transformed.y += aDrop.x * (1.0 - k * k);
          float on = age < 0.1 ? 1.0 : 0.0;`)
        .replace('gl_PointSize = size;', 'gl_PointSize = 0.12 * on;');
    });
    this.env.own.push(g, mat, map);
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    this.env.group.add(pts);
    return pts;
  }
}

// --- swimmers: a slow fish going round a pool -------------------------------------------------------------------------------------

/**
 * Fish that go slowly round a pool just under its face: one instanced mesh, each on an ellipse of its own (the pool's), turned along
 * its way, its tail beating, all in the shader. Pale (blind cave fish, in the Deep), never lit from inside.
 */
export class Swimmers {
  private list: { x: number; y: number; z: number; rx: number; rz: number; rot: number; w: number; ph: number }[] = [];
  constructor(private env: LifeEnv) {}
  add(x: number, y: number, z: number, rx: number, rz: number, rot: number, w: number, ph: number) {
    this.list.push({ x, y, z, rx, rz, rot, w, ph });
  }
  get count() {
    return this.list.length;
  }
  build(color: number, len = 0.5) {
    const n = this.list.length;
    if (!n) return null;
    const geo = mergeGeometries([
      new THREE.SphereGeometry(1, 8, 5).scale(len * 0.13, len * 0.13, len * 0.5),
      new THREE.ConeGeometry(len * 0.16, len * 0.3, 4).rotateX(Math.PI / 2).scale(0.25, 1, 1).translate(0, 0, -len * 0.62),
    ])!;
    const mat = palMat(this.env, color, { roughness: 0.4, metalness: 0.3 });
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), path = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    geo.setAttribute('aSwim', attr);
    geo.setAttribute('aPath', path);
    patch(mat, 'swim', this.env.time, (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime;
          attribute vec4 aSwim; // the ellipse's middle x, y, z, its turn
          attribute vec4 aPath; // its half widths rx, rz, the angular speed, the phase`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float a = uTime * aPath.z + aPath.w;
          // the tail beats (the back of the body sways)
          transformed.x += sin(uTime * 5.0 + aPath.w) * 0.06 * smoothstep(0.0, -${(len * 0.7).toFixed(2)}, transformed.z);
          // turned along its way round the ellipse
          vec2 vel = vec2(-sin(a) * aPath.x, cos(a) * aPath.y) * sign(aPath.z);
          float hy = atan(vel.x, vel.y) + aSwim.w;
          transformed.xz = vec2(transformed.x * cos(hy) + transformed.z * sin(hy), -transformed.x * sin(hy) + transformed.z * cos(hy));
          vec2 p = vec2(cos(a) * aPath.x, sin(a) * aPath.y);
          p = vec2(p.x * cos(aSwim.w) + p.y * sin(aSwim.w), -p.x * sin(aSwim.w) + p.y * cos(aSwim.w));
          transformed += vec3(aSwim.x + p.x, aSwim.y, aSwim.z + p.y);`);
    });
    const im = new THREE.InstancedMesh(geo, mat, n);
    this.list.forEach((f, i) => {
      (attr.array as Float32Array).set([f.x, f.y, f.z, f.rot], i * 4);
      (path.array as Float32Array).set([f.rx, f.rz, f.w, f.ph], i * 4);
    });
    im.frustumCulled = false;
    im.castShadow = false;
    this.env.own.push(geo);
    this.env.group.add(im);
    return im;
  }
}
