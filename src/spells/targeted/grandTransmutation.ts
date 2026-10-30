import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  ALCHEMY, ALCHEMY_CSS, AcidColumn, AcidPool, Bubbles, FigureShell, Flask, Fumes, GlassShards, TransmuteCircle,
} from '../../effects/parts/alchemy';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Grand Transmutation (alchemy kit, R: LINGER ultimate). Under the normal gameplay camera, no letterbox: she smashes a
 * big flask at her feet, the world darkens and a giant glass-ink alchemical circle draws on at the point. A column of
 * acid rises out of its centre, the glyphs light up one by one and fumes pour out along the floor while the enemies are
 * pulled toward the middle. The column coils into a sphere, everything stops for a dead beat, then the sphere bursts:
 * an impact frame, a wave of gold races over the circle and every enemy inside turns to a gold statue (a gold shell
 * drawn over the figure; the arena materials are never touched). Cracks run over them, then they shatter into gold
 * flakes and glass shards and the gold floor crumbles. The gold field stays 1.8 s after the burst: every tick slows
 * whoever stands in it (2 s), then it shatters. Every hit lands inside 4.2 s of the cast; clean by 5 s. See pipeline/designs/kit-alchemy.md.
 */
export interface GrandTransmutationSettings {
  goldDamage: number;
  shatterDamage: number;
  /** Damage of each of the two slow ticks while the gold field stands. */
  tickDamage: number;
  /** Seconds of slow on the gold hit and on every tick. */
  slow: number;
  loop: boolean;
}

export const defaultGrandTransmutation = (): GrandTransmutationSettings => ({ goldDamage: 75, shatterDamage: 50, tickDamage: 5, slow: 2, loop: false });

// Timeline (seconds).
const SMASH_T = 0.3;
const RISE_T = 0.4;
const COIL_T = 1.5;
const BEAT_T = 1.85; // dead beat 1.85 .. 2.0
const BURST_T = 2.0;
const TICKS = [2.8, 3.4]; // slow ticks while the gold field stands
const SHATTER_T = 3.8; // the field stands 1.8 s after the burst; the shatter still lands inside 4.2 s
const DURATION = 5.0;

const RADIUS = 7;
const COL_H = 6;
const COL_R = 0.95;
const SPHERE_H = 4.3;
const SPHERE_R = 1.7;
const MAX_VICTIMS = 8;
const PULL = 0.5;

// ---------------------------------------------------------------------------------------------------------------
// The gold floor (local shader): a slab of gold tiles that a wave races over, cracks and crumbles away.
// ---------------------------------------------------------------------------------------------------------------

function goldFloorMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    uniforms: {
      uGold: { value: new THREE.Color(ALCHEMY.gold) }, uDark: { value: new THREE.Color(ALCHEMY.dark) },
      uWave: { value: 0 }, uCrack: { value: 0 }, uCrumble: { value: 0 }, uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uGold, uDark; uniform float uWave, uCrack, uCrumble, uOpacity;
      varying vec2 vUv;
      float hash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float aa = max(fwidth(r), 1e-4);
        float inside = 1.0 - smoothstep(0.97 - aa, 0.97, r);
        float wave = 1.0 - smoothstep(uWave - 0.012, uWave, r);
        if (inside * wave < 0.004) discard;
        vec2 q = p * 4.5;
        q += 0.3 * vec2(sin(q.y * 1.7 + 1.0), sin(q.x * 1.9));
        vec2 cell = floor(q), fr = fract(q);
        float d = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
        float h = hash(cell);
        // Tiles of three golds, a thin seam between them, cracks that spread with uCrack.
        vec3 col = h > 0.7 ? mix(uGold, vec3(1.0, 0.93, 0.7), 0.4) : (h > 0.35 ? uGold : uGold * 0.72);
        float seam = 1.0 - smoothstep(0.02, 0.05, d);
        float crack = seam * step(hash(cell + 7.0), uCrack);
        col = mix(col, uDark * 2.5, max(seam * 0.35, crack));
        // The wave front runs pale.
        float front = (1.0 - smoothstep(0.0, 0.05, abs(r - uWave + 0.02))) * step(0.001, uWave);
        col = mix(col, vec3(1.0, 0.94, 0.74) * 0.92, front * 0.8);
        // Crumble: tiles drop out from the centre outward.
        float gone = step(hash(cell + 3.0) * 0.5 + r * 0.5, uCrumble);
        if (gone > 0.5) discard;
        gl_FragColor = vec4(col, inside * wave * uOpacity * 0.94);
      }`,
  });
}

interface Victim {
  enemy: Enemy;
  pos: THREE.Vector3; // feet at cast time
  dirH: THREE.Vector3; // horizontal unit toward the centre
  dist: number;
  shell: FigureShell;
  goldAt: number; // time the gold wave reaches this enemy
  shown: boolean;
}

export class GrandTransmutation implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GrandTransmutationSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private matTime = 0; // wobble clock; frozen in the dead beat

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -8);
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3(0, 1.5, 13.5);
  private smash = new THREE.Vector3(0, 0.3, 13);
  private sphereC = new THREE.Vector3(0, SPHERE_H, -8);
  private victims: Victim[] = [];

  private flags = { smashed: false, drained: false, burst: false, shattered: false };
  private ticksDone = 0;
  private bubbleTimer = 0;
  private fumeTimer = 0;

  // Parts.
  private bigFlask = new Flask();
  private splash = new AcidPool(12);
  private circle = new TransmuteCircle();
  private column = new AcidColumn();
  private bubbles = new Bubbles(60);
  private fumes = new Fumes(8);
  private shards = new GlassShards({ max: 140 });
  private flakes = new GlassShards({ max: 160, color: ALCHEMY.gold, edge: 0xfff0c0, opacity: 1 });
  private goldFloor: THREE.Mesh;
  private shells: FigureShell[] = [];
  private pop = new StarBurst({ points: 12, inner: 0.3, color: ALCHEMY.accent, core: ALCHEMY.core, additive: false });
  private groundRing = new ShockRefraction({ facing: 'ground' });
  private lens = new ShockRefraction({ facing: 'camera' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: GrandTransmutationSettings = defaultGrandTransmutation()) {
    this.settings = settings;
    this.screen.impactColor.set(ALCHEMY.glass);
    this.screen.tint.set(ALCHEMY.dark);

    this.goldFloor = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), goldFloorMaterial());
    this.goldFloor.frustumCulled = false;
    this.goldFloor.visible = false;
    this.goldFloor.renderOrder = 2;
    this.goldFloor.position.y = 0.035;
    this.goldFloor.scale.setScalar(RADIUS / 0.97);

    this.splash.boil = 8;
    this.splash.order = 1;
    this.circle.hole = 0.16;
    this.bubbles.rise = 0.9;
    for (let i = 0; i < MAX_VICTIMS; i++) this.shells.push(new FigureShell('gold'));

    this.group.add(
      this.goldFloor, this.splash.mesh, this.circle.mesh, this.column.mesh, this.bubbles.mesh, this.fumes.mesh,
      this.shards.mesh, this.flakes.mesh, ...this.shells.map((s) => s.mesh), this.bigFlask.mesh, this.pop.mesh,
      this.groundRing.mesh, this.lens.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return BURST_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.point.copy(ctx.point).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.5).addScaledVector(this.side, 0.35).setY(1.5);
    this.smash.copy(ctx.from).addScaledVector(this.fwd, 1.1).setY(0.35);
    this.sphereC.copy(this.point).setY(SPHERE_H);

    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p || this.victims.length >= MAX_VICTIMS) return;
      const dist = Math.hypot(p.x - this.point.x, p.z - this.point.z);
      if (dist > RADIUS) return;
      const dirH = new THREE.Vector3(this.point.x - p.x, 0, this.point.z - p.z);
      if (dirH.lengthSq() < 1e-4) dirH.set(0, 0, 0); else dirH.normalize();
      this.victims.push({
        enemy: e, pos: p.clone(), dirH, dist, shell: this.shells[this.victims.length],
        goldAt: BURST_T + (dist / RADIUS) * 0.3, shown: false,
      });
    });

    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.column.mesh];
    this.screen.focus.copy(this.sphereC);
    this.circle.set(this.point, RADIUS + 0.35);
    this.column.configure(this.v1.copy(this.point).setY(0.05), COL_H, COL_R, this.sphereC, SPHERE_R);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.matTime = 0;
    this.shake = 0;
    this.bubbleTimer = 0;
    this.fumeTimer = 0;
    this.ticksDone = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.bigFlask.reset();
    this.splash.reset();
    this.circle.reset();
    this.circle.hole = 0.16;
    this.column.reset();
    this.bubbles.reset();
    this.fumes.reset();
    this.shards.reset();
    this.flakes.reset();
    for (const s of this.shells) s.reset();
    for (const v of this.victims) v.shown = false;
    this.goldFloor.visible = false;
    const gu = (this.goldFloor.material as THREE.ShaderMaterial).uniforms;
    gu.uWave.value = 0; gu.uCrack.value = 0; gu.uCrumble.value = 0; gu.uOpacity.value = 1;
    this.pop.set(this.point, 0, 0);
    this.groundRing.set(this.point, 0, 0);
    this.lens.set(this.sphereC, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    const beat = this.time >= BEAT_T && this.time < BURST_T;
    if (!beat) {
      this.bubbles.update(dt);
      this.fumes.update(dt);
      this.splash.update(dt);
      this.matTime += dt;
    }
    this.shards.update(dt);
    this.flakes.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    // Events.
    if (!f.smashed && t >= SMASH_T) {
      f.smashed = true;
      this.bigFlask.mesh.visible = false;
      this.shards.burst(this.smash, 26, 6, { size: 0.28, life: 0.6 });
      this.splash.spread(this.v1.copy(this.smash).setY(0), 1.8, 0.2);
    }
    if (!f.drained && t >= 1.1) { f.drained = true; this.splash.drain(0.5); }
    // Bubbles rise off the column (and later the sphere); fumes pour out along the floor.
    if (t >= 0.55 && t < BEAT_T && !beat) {
      this.bubbleTimer += dt;
      while (this.bubbleTimer >= 0.07) {
        this.bubbleTimer -= 0.07;
        const a = Math.random() * Math.PI * 2;
        if (t < COIL_T) {
          const h = (0.4 + Math.random() * 0.85) * COL_H * easeOut((t - RISE_T) / 1.0);
          this.v1.set(this.point.x + Math.cos(a) * COL_R * 0.9, h, this.point.z + Math.sin(a) * COL_R * 0.9);
        } else {
          this.v1.set(Math.cos(a) * Math.random(), Math.random() * 2 - 1, Math.sin(a) * Math.random()).normalize()
            .multiplyScalar(SPHERE_R * 1.05).add(this.sphereC);
        }
        this.bubbles.emit(this.v1, 0.16 + Math.random() * 0.18, { life: 0.7 + Math.random() * 0.5, rise: 0.8 });
      }
    }
    if (t >= 0.5 && t < 1.6 && !beat) {
      this.fumeTimer += dt;
      while (this.fumeTimer >= 0.2) {
        this.fumeTimer -= 0.2;
        const a = Math.random() * Math.PI * 2;
        this.v1.set(Math.cos(a), 0, Math.sin(a));
        this.fumes.puff(this.v2.set(this.point.x + this.v1.x * 1.4, 0.12, this.point.z + this.v1.z * 1.4), 0.5, this.v3.copy(this.v1).multiplyScalar(2.6), 0.5);
      }
    }
    if (!f.burst && t >= BURST_T) {
      f.burst = true;
      this.burst();
    }
    while (f.burst && !f.shattered && this.ticksDone < TICKS.length && t >= TICKS[this.ticksDone]) {
      this.ticksDone++;
      this.eachInside((e) => this.ctx?.hit(e, { damage: this.settings.tickDamage, knock: 0, from: this.point, color: ALCHEMY_CSS.gold, status: { kind: 'slow', seconds: this.settings.slow } }));
    }
    if (!f.shattered && t >= SHATTER_T) {
      f.shattered = true;
      this.shatter();
    }

    this.layout();
  }

  /** The sphere bursts: acid spray, glass shards, the gold wave, every enemy inside is hit (and turns gold). */
  private burst() {
    for (let i = 0; i < 18; i++) {
      this.v1.randomDirection().multiplyScalar(6 + Math.random() * 3);
      this.bubbles.emit(this.sphereC, 0.18 + Math.random() * 0.16, { life: 0.25 + Math.random() * 0.25, vel: this.v1, rise: 0 });
    }
    this.shards.burst(this.sphereC, 24, 7, { size: 0.26, life: 0.6, up: 0 });
    this.shake = 0.7;
    this.eachInside((e) => this.ctx?.hit(e, { damage: this.settings.goldDamage, knock: 0, from: this.point, color: ALCHEMY_CSS.gold, status: { kind: 'slow', seconds: this.settings.slow } }));
  }

  /** Whoever stands in the field right now (live positions, re-checked at every hit). */
  private eachInside(fn: (e: Enemy) => void) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) fn(e);
    }
  }

  /** The statues shatter into gold flakes and glass shards; the enemies are knocked back. */
  private shatter() {
    for (const v of this.victims) {
      v.shell.mesh.visible = false;
      this.v1.copy(v.pos).add(this.v2.set(0, 1.1, 0));
      this.flakes.burst(this.v1, 14, 5, { size: 0.2, life: 0.8 });
      this.shards.burst(this.v1, 6, 5, { size: 0.22, life: 0.55 });
    }
    this.eachInside((e) => this.ctx?.hit(e, { damage: this.settings.shatterDamage, knock: 6, from: this.point, color: ALCHEMY_CSS.gold }));
    // Flakes off the crumbling floor.
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, d = RADIUS * 0.9 * Math.sqrt(Math.random());
      this.v1.set(this.point.x + Math.cos(a) * d, 0.1, this.point.z + Math.sin(a) * d);
      this.flakes.burst(this.v1, 1, 2.2, { size: 0.18, life: 0.7 });
    }
    this.shake = Math.max(this.shake, 0.3);
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v1.set(0, 0, 0));
    this.reset();
  }

  private layout() {
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    const after = t - BURST_T;

    // --- Screen: hard darken from the smash, lifted after the shatter; the glass impact frame at the burst. ---
    this.screen.darken = 0.6 * smoothstep(t / 0.4) * (1 - smoothstep((t - SHATTER_T - 0.5) / 0.7));
    this.screen.impact = impactFrameAt(t, BURST_T, [1, 2], 0.04);

    // --- 0..0.3 The big flask is plucked and smashed on the floor at her feet. ---
    const bf = this.bigFlask;
    if (t < SMASH_T) {
      bf.mesh.visible = true;
      bf.scale = 1.05 * smoothstep(t / 0.1);
      bf.slosh(t, 1.4);
      if (t < 0.1) { bf.mesh.position.copy(this.hand); bf.mesh.rotation.set(0, 0, 0); }
      else bf.lob(this.hand, this.smash, 0.9, (t - 0.1) / (SMASH_T - 0.1));
    }

    // --- The circle draws on from the smash, lights its glyphs one by one, fades after the shatter. ---
    this.circle.reveal = smoothstep((t - 0.25) / 0.75);
    this.circle.opacity = 1 - smoothstep((t - SHATTER_T) / 1.0);
    this.circle.lit = Math.min(6, Math.max(0, Math.floor((t - 0.4) / 0.18)));

    // --- 0.4..1.85 The column rises, coils into a sphere; the dead beat holds it. ---
    const rise = easeOut((t - RISE_T) / 1.0);
    const morph = smoothstep((t - COIL_T) / (BEAT_T - COIL_T));
    this.column.height = Math.max(COL_H * rise, 0.05);
    this.column.radius = COL_R * Math.min(1, 0.25 + 0.75 * easeOut((t - RISE_T) / 0.5));
    this.column.update(this.matTime, morph, 0.5 + 0.3 * morph);
    // Silhouette stays through the impact frames, gone right after.
    this.column.mesh.visible = t >= RISE_T && t < BURST_T + 0.09;

    // --- The enemies are pulled toward the middle, then ease back after the shatter. ---
    if (ctx) {
      const k = smoothstep((t - RISE_T) / 1.1) * (1 - smoothstep((t - SHATTER_T) / 0.3));
      for (const v of this.victims) {
        const amount = Math.min(PULL, v.dist) * k;
        ctx.displace(v.enemy, this.v1.set(v.dirH.x * amount, 0, v.dirH.z * amount));
      }
    }

    // --- 2.0 Burst: accent star at the centre, ground refraction, a lens ring. ---
    if (f.burst) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.sphereC, 2 * sp.scale, sp.opacity, 0.2);
      const gp = Math.min(1, Math.max(0, after / 0.5));
      this.groundRing.set(this.point, 1 + 11 * gp, gp < 1 ? 0.07 * (1 - gp) * (1 - gp) : 0);
      const lp = Math.min(1, Math.max(0, after / 0.35));
      this.lens.set(this.sphereC, 1 + 5 * lp, lp < 1 ? 0.05 * (1 - lp) * (1 - lp) : 0);
      this.shake = Math.max(0.7 * Math.exp(-after * 9), f.shattered ? 0.3 * Math.exp(-(t - SHATTER_T) * 10) : 0);
    }

    // --- Gold: the wave races over the floor and the circle; shells turn each enemy gold; cracks run; the floor crumbles. ---
    const gu = (this.goldFloor.material as THREE.ShaderMaterial).uniforms;
    this.goldFloor.visible = f.burst && t < SHATTER_T + 1.1;
    gu.uWave.value = f.burst ? Math.min(1.02, Math.max(0, after / 0.3) * 1.02) : 0;
    gu.uCrack.value = smoothstep((t - 2.1) / (SHATTER_T - 2.4));
    gu.uCrumble.value = f.shattered ? Math.min(1.05, (t - SHATTER_T) / 0.9) : 0;
    this.goldFloor.position.set(this.point.x, 0.035, this.point.z);
    for (const v of this.victims) {
      const sh = v.shell;
      const on = f.burst && !f.shattered && t >= v.goldAt;
      sh.mesh.visible = on;
      if (!on) continue;
      v.shown = true;
      sh.follow(v.enemy.group, 1.07);
      sh.crack = smoothstep((t - v.goldAt - 0.15) / (SHATTER_T - v.goldAt - 0.4));
      sh.flash = Math.exp(-(t - v.goldAt) * 18);
    }
  }
}

function easeOut(x: number) {
  const k = Math.min(1, Math.max(0, x));
  return 1 - Math.pow(1 - k, 3);
}

export const grandTransmutationModule: EffectModule = {
  label: 'grand transmutation',
  category: 'hero: alchemy',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new GrandTransmutation(),
  telegraphs(effect) {
    const e = effect as GrandTransmutation;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: BURST_T, until: SHATTER_T + 0.1 }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GrandTransmutation;
    if (e.ctx) frameCast(camera, controls, e.ctx, 8);
  },
  buildGui(f, effect) {
    const s = (effect as GrandTransmutation).settings;
    f.add(s, 'loop');
    f.add(s, 'goldDamage', 1, 300, 1);
    f.add(s, 'shatterDamage', 1, 200, 1);
    f.add(s, 'tickDamage', 0, 40, 1);
    f.add(s, 'slow', 0, 2.5, 0.1);
  },
};
