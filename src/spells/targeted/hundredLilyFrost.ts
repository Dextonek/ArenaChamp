import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  SmokeBall, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { LilyBurst, StarFlare } from '../../effects/weapons/kit';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Hundred Lily Frost (targeted, up to six enemies): the world goes cold and a pale glint gathers at the caster's
 * hand while frost mist rolls out along the ground. Under every chosen enemy, nearest first, a closed bud of six
 * tall crystal petals punches out of the floor and holds it in place. All the buds open together into crystal
 * lilies with a straight-spiked stamen glow, then snap shut (implode, thin ring tightening, focus lines), pause
 * for a dead beat, and shatter at once: impact frames, a violet flash at each centre and a spray of curved petal
 * shards that mirror the petal shape. Snow, black-blue smoke and frosted ground marks linger, then the frame clears.
 */
export interface HundredLilyFrostSettings {
  /** Seconds the open lilies are held before they snap shut. */
  holdTime: number;
  /** Petal height in metres. */
  petalHeight: number;
  damage: number;
  loop: boolean;
}

export const defaultHundredLilyFrost = (): HundredLilyFrostSettings => ({
  holdTime: 0.9,
  petalHeight: 2.2,
  damage: 45,
  loop: false,
});

const MAX = 6;
const PETALS = 6;
const SHARDS_PER = 18;
const SHARDS = MAX * SHARDS_PER;
const DEG = Math.PI / 180;
const BUD_START = 0.6;
const BUD_STEP = 0.18;
const BUD_RISE = 0.22;
const BLOOM_TIME = 0.45;
const IMPLODE_TIME = 0.3;
const DEAD_BEAT = 0.1;
const AFTERMATH = 1.6;
const RING_R = 0.6;
const PETAL_VAR = [1, 0.82, 1, 0.82, 1, 0.82];

const MIN_SCALE = 1e-4;
const MIN_VEC = new THREE.Vector3(MIN_SCALE, MIN_SCALE, MIN_SCALE);

const easeOutBack = (x: number) => {
  const k = THREE.MathUtils.clamp(x, 0, 1) - 1;
  return 1 + 2.70158 * k * k * k + 1.70158 * k * k;
};
const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);

/** Value ramp for the petal: dark base, saturated body, white tip. */
const C_DARK = new THREE.Color(0x0e1f3a);
const C_BODY = new THREE.Color(0x5ab8f0);
const C_TIP = new THREE.Color(0xf4fbff);

/** A faceted lancet petal, height 1 along +Y, base at the origin; flat facets with per-face shade. */
function petalGeometry(): THREE.BufferGeometry {
  const w = 0.125, t = 0.05, m = 0.4;
  const B = [0, 0, 0], L = [-w, m, 0], R = [w, m, 0], F = [0, m, t], K = [0, m, -t], T = [0, 1, 0];
  const faces: { v: number[][]; shade: number }[] = [
    { v: [B, R, F], shade: 1.0 }, { v: [B, F, L], shade: 0.7 }, { v: [L, F, T], shade: 0.8 }, { v: [F, R, T], shade: 1.05 },
    { v: [B, K, R], shade: 0.85 }, { v: [B, L, K], shade: 0.6 }, { v: [L, T, K], shade: 0.7 }, { v: [K, T, R], shade: 0.95 },
  ];
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const f of faces) {
    for (const v of f.v) {
      pos.push(v[0], v[1], v[2]);
      if (v[1] <= m) c.copy(C_DARK).lerp(C_BODY, v[1] / m);
      else c.copy(C_BODY).lerp(C_TIP, (v[1] - m) / (1 - m));
      c.multiplyScalar(f.shade);
      col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** The same lancet as a flat, bent shard: dark blue in the middle, hot white along the edge. */
function shardGeometry(): THREE.BufferGeometry {
  const bend = (v: number[]) => [v[0], v[1], 0.35 * v[1] * v[1]];
  const B = bend([0, 0, 0]), R = bend([0.14, 0.35, 0]), T = bend([0, 1, 0]), L = bend([-0.14, 0.35, 0]), C = bend([0, 0.4, 0]);
  const tris = [[C, B, R], [C, R, T], [C, T, L], [C, L, B]];
  const dark = new THREE.Color(0x14305a), hot = new THREE.Color(0xffffff);
  const pos: number[] = [];
  const col: number[] = [];
  for (const tri of tris) {
    tri.forEach((v, i) => {
      pos.push(v[0], v[1], v[2]);
      const k = i === 0 ? dark : hot;
      col.push(k.r, k.g, k.b);
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

interface Flower {
  group: THREE.Group;
  ground: THREE.Group;
  pivots: THREE.Group[];
  bodies: THREE.Mesh[];
  rims: THREE.Mesh[];
  disc: THREE.Mesh;
  discMat: THREE.MeshBasicMaterial;
  mark: ReturnType<typeof createRing>;
  tight: ReturnType<typeof createRing>;
  lily: LilyBurst;
  budStar: StarBurst;
  hitStar: StarBurst;
  pos: THREE.Vector3;
  tb: number;
  budDone: boolean;
}

interface Shard { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; size: number; life: number; landed: boolean; live: boolean }

export class HundredLilyFrost implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HundredLilyFrostSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private shattered = false;
  private smokeDone = false;
  private n = 0;
  private hand = new THREE.Vector3();
  private centroid = new THREE.Vector3();
  private enemies: (CastContext['targets'][number] | undefined)[] = [];

  private flowers: Flower[] = [];
  private flare = new StarFlare(0xf4fbff, 0xbfe8ff);
  private smoke = new SmokeBall({ color: 0x1a3358, rim: 0x0e1f3a, flake: 0xbfe8ff, maxBalls: 8 });

  private petalMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  private rimMat = new THREE.MeshBasicMaterial({
    color: 0xbfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private shardMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  private shards = new THREE.InstancedMesh(shardGeometry(), this.shardMat, SHARDS);
  private shardState: Shard[] = Array.from({ length: SHARDS }, () => ({
    p: new THREE.Vector3(0, -50, 0), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), size: 0.6, life: 1, landed: false, live: false,
  }));

  private mist: Emitter;
  private glitter: Emitter;
  private snow: Emitter;
  private sparks: Emitter;

  constructor(settings: HundredLilyFrostSettings = defaultHundredLilyFrost()) {
    this.settings = settings;
    this.screen.tint.set(0x0e1f3a);
    this.screen.impactColor.set(0x5ab8f0);
    this.screen.speedLineColor.set(0xbfe8ff);
    this.shards.frustumCulled = false;
    this.group.add(this.shards, this.flare.group, this.smoke.mesh);

    const petalGeo = petalGeometry();
    const discGeo = new THREE.CircleGeometry(1, 48);
    for (let i = 0; i < MAX; i++) {
      const group = new THREE.Group();
      const ground = new THREE.Group();
      const pivots: THREE.Group[] = [];
      const bodies: THREE.Mesh[] = [];
      const rims: THREE.Mesh[] = [];
      for (let p = 0; p < PETALS; p++) {
        const yaw = new THREE.Group();
        yaw.rotation.y = (p / PETALS) * Math.PI * 2;
        const pivot = new THREE.Group();
        pivot.position.z = RING_R;
        const body = new THREE.Mesh(petalGeo, this.petalMat);
        const rim = new THREE.Mesh(petalGeo, this.rimMat);
        pivot.add(body, rim);
        yaw.add(pivot);
        group.add(yaw);
        pivots.push(pivot);
        bodies.push(body);
        rims.push(rim);
      }
      const discMat = new THREE.MeshBasicMaterial({ color: 0x0e1f3a, transparent: true, opacity: 0, depthWrite: false });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.03;
      const mark = createRing(0xbfe8ff, 0.86, 1, 64);
      const tight = createRing(0xf4fbff, 0.95, 1, 64);
      mark.mesh.position.y = 0.05;
      tight.mesh.position.y = 0.06;
      ground.add(disc, mark.mesh, tight.mesh);
      const lily = new LilyBurst(0xbfe8ff, 0xbfe8ff, { curl: 0, filaments: 10, seed: 3 + i });
      const budStar = new StarBurst({ points: 8, inner: 0.3, color: 0xbfe8ff, core: 0xf4fbff, additive: false });
      const hitStar = new StarBurst({ points: 10, inner: 0.25, color: 0x8a7cff, core: 0xf4fbff, additive: false });
      group.visible = false;
      ground.visible = false;
      this.group.add(group, ground, lily.group, budStar.mesh, hitStar.mesh);
      this.flowers.push({
        group, ground, pivots, bodies, rims, disc, discMat, mark, tight, lily, budStar, hitStar,
        pos: new THREE.Vector3(), tb: 0, budDone: false,
      });
    }

    this.mist = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, speed: 0.9, speedJitter: 0.6, spread: 90, gravity: -0.05, drag: 1.2,
      sizeStart: 1.1, sizeEnd: 2.4, colorStart: '#d8f0ff', colorEnd: '#6a9acc',
      opacityStart: 0.3, opacityEnd: 0, additive: false, colorMid: '#bfe8ff', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.glitter = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.2, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, speed: 1.4, speedJitter: 0.7, spread: 40, gravity: -0.3, drag: 0.8,
      sizeStart: 0.09, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#8fd0ff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.snow = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.8, speed: 0.3, speedJitter: 0.6, spread: 180, gravity: 0.6, drag: 1.5,
      sizeStart: 0.17, sizeEnd: 0.08, colorStart: '#f4fbff', colorEnd: '#bfe8ff',
      opacityStart: 0.7, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 9, speedJitter: 0.6, spread: 180, gravity: 9, drag: 1.6,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffffff', colorEnd: '#5ab8f0',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.mist, this.glitter, this.snow, this.sparks, this.smoke.emitter);
    for (const e of [this.mist, this.glitter, this.snow, this.sparks]) this.group.add(e.points);
    this.reset();
  }

  /** Times of the beats for the current cast. */
  private get nEff() {
    return Math.max(1, this.n);
  }
  private get bloomStart() {
    return BUD_START + BUD_STEP * this.nEff + 0.1;
  }
  private get implodeStart() {
    return this.bloomStart + this.settings.holdTime;
  }
  get impactTime() {
    return this.implodeStart + IMPLODE_TIME + DEAD_BEAT;
  }
  get duration() {
    return this.impactTime + AFTERMATH;
  }
  /** Bud start time of flower i (telegraph start). */
  budTime(i: number) {
    return this.flowers[i]?.tb ?? BUD_START;
  }
  get flowerPositions(): readonly THREE.Vector3[] {
    return this.flowers.slice(0, this.n).map((f) => f.pos);
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const fwd = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    this.hand.copy(ctx.from).addScaledVector(right, 0.5).addScaledVector(fwd, 0.3).setY(2.4);

    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    const count = Math.min(MAX, pts.length);
    // Nearest to the caster first: a clear spatial order (front to back).
    const order = Array.from({ length: count }, (_, i) => i)
      .sort((a, b) => pts[a].distanceToSquared(ctx.from) - pts[b].distanceToSquared(ctx.from));
    this.n = count;
    this.centroid.set(0, 0, 0);
    this.enemies = [];
    order.forEach((src, rank) => {
      const f = this.flowers[rank];
      f.pos.copy(pts[src]).setY(0);
      f.tb = BUD_START + BUD_STEP * rank;
      this.enemies.push(ctx.targets[src]);
      this.centroid.add(f.pos);
    });
    this.centroid.divideScalar(Math.max(1, count));
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shattered = false;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const s of this.shardState) { s.live = false; s.landed = false; s.p.set(0, -50, 0); }
    for (const f of this.flowers) f.budDone = false;
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    for (let i = 0; i < this.n; i++) {
      const f = this.flowers[i];
      if (!f.budDone && this.time >= f.tb + 0.15) this.onBud(i);
    }
    if (!this.shattered && this.time >= this.impactTime) this.onShatter();
    if (!this.smokeDone && this.shattered && this.time >= this.impactTime + 0.1) {
      this.smokeDone = true;
      for (let i = 0; i < this.n; i++) this.smoke.trigger(this.flowers[i].pos.clone().setY(0.7), 0.8, 1.2);
    }
    this.layout(dt);
  }

  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const D = this.impactTime;
    const I = this.implodeStart;
    const B = this.bloomStart;
    const after = t - D;
    const over = t >= this.duration;
    const imp = clamp01((t - I) / IMPLODE_TIME);
    const from = this.ctx?.from ?? new THREE.Vector3();

    // --- World grade, focus lines on the implode, impact frames on the shatter. ---
    this.screen.darken = over ? 0 : t < D ? 0.75 * smoothstep(t / 0.5) : 0.75 * Math.exp(-Math.max(0, after - 0.15) * 2.4);
    this.screen.speedLines = t < I ? 0 : t < D ? 0.8 * smoothstep(imp) : Math.max(0, 0.8 - after * 5);
    this.screen.impact = impactFrameAt(t, D, [1, 2, 1]);

    // --- Cold glint with a long horizontal flare at the caster's hand (the cold cue). ---
    const gl = t < 0.55 ? Math.pow(clamp01(t / 0.55), 2) : 1 - smoothstep((t - 0.55) / 0.4);
    this.flare.set(this.hand, 0.3 + 1.1 * gl, 0.8 * gl, t * 0.8);

    // --- Frost mist rolls out along the ground from the caster toward the targets. ---
    if (dt > 0 && t < 1.2 && this.n > 0) {
      for (let k = 0; k < 4; k++) {
        const f = this.flowers[Math.floor(Math.random() * this.n)];
        const u = Math.random();
        this.mist.burst(1, new THREE.Vector3(
          from.x + (f.pos.x - from.x) * u + (Math.random() - 0.5) * 1.2, 0.15,
          from.z + (f.pos.z - from.z) * u + (Math.random() - 0.5) * 1.2,
        ));
      }
    }

    // --- Flowers. ---
    const obI = easeOutBack((I - B) / BLOOM_TIME);
    this.shake = after > 0 ? 0.8 * Math.exp(-after * 6) : 0;
    for (let i = 0; i < MAX; i++) {
      const f = this.flowers[i];
      const active = i < this.n;
      const age = t - f.tb;
      const bloomOn = active && t >= f.tb;
      f.ground.visible = bloomOn;
      f.group.visible = bloomOn && t < D;
      f.lily.set(f.pos, 0, 0);
      f.budStar.set(f.pos, 0, 0);
      f.hitStar.set(f.pos, 0, 0);
      if (!active) continue;

      f.ground.position.copy(f.pos);
      f.group.position.copy(f.pos);
      f.group.rotation.y = t * 0.3;

      // Open amount: closed bud (0) → bloom with overshoot (≈1) → snap shut (ease-in) → 0.
      let open = 0;
      if (t >= B) open = t < I ? easeOutBack((t - B) / BLOOM_TIME) : obI * (1 - imp * imp);
      const flick = t >= B && t < I ? 1 : 0;

      for (let p = 0; p < PETALS; p++) {
        const grow = easeOutBack((age - p * 0.015) / BUD_RISE);
        const sc = s.petalHeight * Math.max(grow, 0.02) * PETAL_VAR[p];
        const tilt = (4 + 36 * open + (Math.sin(i * 1.7 + p * 2.1) * 3 + Math.sin(t * 9 + p * 2 + i) * 1.5 * flick) * open) * DEG;
        this.pivots(f, p).rotation.x = tilt;
        f.bodies[p].scale.set(sc, sc, sc);
        f.rims[p].scale.set(sc * 1.12, sc * 1.05, sc * 1.1);
      }

      // Stamen glow in the flower's centre (straight crystal spikes), flickering rather than brightening.
      const lilyOp = t < B ? 0 : t < I ? 0.25 + 0.03 * Math.sin(t * 23 + i * 2) : 0.25 * (1 - imp);
      f.lily.set(f.pos.clone().setY(1.1), 1.5 * Math.max(0, open) + 0.01, lilyOp, t * 0.6 + i);

      // Bud pop and the violet flash at the shatter (2–3 frames only).
      const pop = StarBurst.pop(age - 0.15);
      f.budStar.set(f.pos.clone().setY(0.5), 2.2 * pop.scale, pop.opacity, i * 0.6);
      const hp = StarBurst.pop(after, 0.04, 0.06);
      f.hitStar.set(f.pos.clone().setY(1.2), 3.8 * hp.scale, hp.opacity, i * 0.9);

      // Ground: dark disc under the flower, pale mark ring, thin tightening ring on the implode.
      const mk = smoothstep(age / 0.3);
      const decay = after > 0 ? Math.max(0, 1 - after / (AFTERMATH - 0.1)) : 1;
      f.discMat.opacity = 0.45 * mk * decay;
      f.disc.scale.setScalar(2.1 * (0.5 + 0.5 * mk));
      f.mark.mesh.scale.setScalar(2.2 + 0.4 * mk);
      f.mark.material.opacity = 0.3 * mk * decay;
      f.tight.mesh.scale.setScalar(Math.max(MIN_SCALE, 2.8 - 2.4 * imp * imp));
      f.tight.material.opacity = t >= I && t < D ? 0.75 * smoothstep(imp * 4) : 0;
      if (t >= D) f.tight.material.opacity = 0;
    }
    this.rimMat.opacity = t < D ? 0.3 : 0;

    // --- Petal shards: flat, bent, spinning, with drag, then lying on the ground and twinkling out. ---
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    for (let i = 0; i < SHARDS; i++) {
      const sh = this.shardState[i];
      if (dt > 0 && sh.live && !sh.landed) {
        sh.v.x *= Math.exp(-1.2 * dt);
        sh.v.z *= Math.exp(-1.2 * dt);
        sh.v.y -= 17 * dt;
        sh.p.addScaledVector(sh.v, dt);
        sh.r.set(sh.r.x + sh.w.x * dt, sh.r.y + sh.w.y * dt, sh.r.z + sh.w.z * dt);
        if (sh.p.y < 0.06) {
          sh.p.y = 0.06;
          sh.landed = true;
          sh.v.set(0, 0, 0);
          sh.r.set(-Math.PI / 2, 0, sh.r.z); // lies flat; Rz turns it in the ground plane
        }
      }
      const k = sh.live ? 1 - smoothstep((after - sh.life) / 0.4) : 0;
      if (k < 0.02) {
        m.compose(sh.p, q.identity(), MIN_VEC);
      } else {
        m.compose(sh.p, q.setFromEuler(sh.r), sc.setScalar(Math.max(MIN_SCALE, sh.size * k)));
      }
      this.shards.setMatrixAt(i, m);
    }
    this.shards.instanceMatrix.needsUpdate = true;
    this.shards.visible = this.shattered && after < AFTERMATH;

    // --- Glitter rises out of the open flowers (sustained by flicker, not more light). ---
    if (dt > 0 && t >= B && t < I) {
      for (let i = 0; i < this.n; i++) {
        if (Math.random() < 0.5) this.glitter.burst(1, new THREE.Vector3(this.flowers[i].pos.x, 0.4, this.flowers[i].pos.z));
      }
    }
  }

  private pivots(f: Flower, p: number) {
    return f.pivots[p];
  }

  private onBud(i: number) {
    const f = this.flowers[i];
    f.budDone = true;
    this.sparks.burst(14, f.pos.clone().setY(0.3));
    const e = this.enemies[i];
    if (this.ctx && e) this.ctx.hit(e, { damage: 10, knock: 0, from: f.pos, color: '#bfe8ff' });
  }

  private onShatter() {
    this.shattered = true;
    this.glitter.clear();
    let si = 0;
    for (let i = 0; i < this.n; i++) {
      const f = this.flowers[i];
      const c = f.pos;
      this.sparks.burst(110, c.clone().setY(1.1));
      this.snow.burst(26, c.clone().setY(3.4));
      this.mist.burst(14, c.clone().setY(0.2));
      for (let k = 0; k < SHARDS_PER; k++, si++) {
        const sh = this.shardState[si];
        const a = Math.random() * Math.PI * 2 + (k / SHARDS_PER) * Math.PI * 2;
        const sp = 4 + Math.random() * 5;
        sh.p.set(c.x + Math.cos(a) * RING_R, 0.5 + Math.random() * 0.9, c.z + Math.sin(a) * RING_R);
        sh.v.set(Math.cos(a) * sp, 4 + Math.random() * 5, Math.sin(a) * sp);
        sh.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
        sh.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        sh.size = 0.7 + Math.random() * 0.7;
        sh.life = 0.9 + Math.random() * 0.4;
        sh.landed = false;
        sh.live = true;
      }
      // Hit: knock away from the caster (never from the enemy's own feet).
      const e = this.enemies[i];
      const ctx = this.ctx;
      if (ctx && e) {
        const d = new THREE.Vector3().subVectors(c, ctx.from).setY(0);
        if (d.lengthSq() < 1e-4) d.set(0, 0, -1);
        const origin = c.clone().addScaledVector(d.normalize(), -1).setY(0);
        ctx.hit(e, { damage: this.settings.damage, knock: 6, from: origin, color: '#bfe8ff' });
      }
    }
  }
}

export const hundredLilyFrostModule: EffectModule = {
  label: 'hundred lily frost',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAX },
  create: () => new HundredLilyFrost(),
  telegraphs(effect) {
    const e = effect as HundredLilyFrost;
    if (!e.ctx) return [];
    return e.flowerPositions.map((p, i) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.6 }, start: e.budTime(i), impact: e.impactTime,
    }));
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as HundredLilyFrost;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3.5);
  },
  buildGui(f, effect) {
    const s = (effect as HundredLilyFrost).settings;
    f.add(s, 'loop');
    f.add(s, 'holdTime', 0.3, 2, 0.05).name('hold time');
    f.add(s, 'petalHeight', 0.8, 2.6, 0.05).name('petal height');
    f.add(s, 'damage', 1, 150, 1);
  },
};
