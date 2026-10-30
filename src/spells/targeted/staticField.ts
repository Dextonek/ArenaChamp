import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  LightningTree, Puddles, RainSheet, Sparks, StormCloud, STORM, STORM_CSS,
} from '../../effects/parts/storm';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Static Field (storm kit, E: NOVA). A small storm cloud forms over her head and her rain cloak crackles. A ring
 * of short lightning arcs hops around her at radius 1.5 while light rain falls around her. Then the cloud flashes and
 * a ring races out from her to 5 m in half a second; whoever its front passes is struck, hit and stunned once. Then
 * the cloud breaks up. See pipeline/designs/kit-storm.md.
 */
export interface StaticFieldSettings {
  damage: number;
  /** Seconds of stun on the hit (the ring's front passes each enemy once). */
  stun: number;
  loop: boolean;
}

export const defaultStaticField = (): StaticFieldSettings => ({ damage: 20, stun: 0.5, loop: false });

// Timeline (seconds).
const FORM_END = 0.3;
const PULSE_1 = 0.9; // the nova leaves her
const NOVA_LEN = 0.5; // seconds for the ring to reach RADIUS
const BREAK_T = 2.0;
const DURATION = 2.6;
const RADIUS = 5;
const RING_R = 1.5;
const MAX_VIS = 6; // enemies that get their own bolt

export class StaticField implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StaticFieldSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private from = new THREE.Vector3(0, 0, 14);
  private chest = new THREE.Vector3(0, 1.4, 14);

  private flags = { cloud: false, rain: false, pulse1: false, broken: false };
  private pulseAt = [-9];
  private struck = new Set<unknown>();
  private arcTimer = 0;
  private sparkTimer = 0;
  private ringAngle = 0;
  private novaTimer = 0;
  /** Pale rain-foil ring on the ground, scaled to the nova front. */
  private foil = new THREE.Mesh(
    new THREE.RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: STORM.rain, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );

  // Parts.
  private cloud = new StormCloud(24);
  private rain = new RainSheet(70);
  private puddles = new Puddles();
  private tree = new LightningTree(14);
  private sparks = new Sparks(80);
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: StaticFieldSettings = defaultStaticField()) {
    this.settings = settings;
    this.screen.tint.set(STORM.dark);
    this.rain.height = 4.5;
    this.rain.slant = 0.25;
    this.group.add(this.puddles.mesh, this.rain.mesh, this.cloud.mesh, this.tree.mesh, this.sparks.mesh, this.groundShock.mesh, this.foil);
    this.foil.visible = false;
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return PULSE_1;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.chest.copy(ctx.from).setY(1.4);
    this.screen.focus.copy(this.chest);
    this.groundShock.set(this.from, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.arcTimer = 0;
    this.sparkTimer = 0;
    this.pulseAt[0] = -9;
    this.struck.clear();
    this.novaTimer = 1;
    this.foil.visible = false;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(STORM.dark);
    this.cloud.reset();
    this.rain.reset();
    this.puddles.reset();
    this.tree.reset();
    this.sparks.reset();
    this.groundShock.set(this.from, 0, 0);
  }

  /** A short arc hopping along the ring at a random angle and height. */
  private arc() {
    const a = this.ringAngle;
    const a2 = a + 0.4 + Math.random() * 0.35;
    const y1 = 0.6 + Math.random() * 1.0, y2 = 0.6 + Math.random() * 1.0;
    this.v1.set(this.from.x + Math.cos(a) * RING_R, y1, this.from.z + Math.sin(a) * RING_R);
    this.v2.set(this.from.x + Math.cos(a2) * RING_R, y2, this.from.z + Math.sin(a2) * RING_R);
    this.tree.strike(this.v1, this.v2, Math.random() < 0.4 ? 1 : 0, 0.12, 0.14 + Math.random() * 0.06, { hold: 0.6, levels: 1, jag: 1.2 });
    this.ringAngle = a2 + 0.5 + Math.random() * 2.2;
  }

  private pulse() {
    this.pulseAt[0] = PULSE_1;
    this.sparks.burst(this.chest, 12, 5);
    this.shake = 0.12;
    this.groundShock.set(this.from, 0.5, 0.02);
  }

  /** The ring's front is at `front` metres: strike whoever it has just passed (live positions), once each. */
  /** The visible ring: short lightning arcs joined round a circle of radius `front`, re-struck every 3 frames, plus the foil ring. */
  private novaRing(front: number, fade: number) {
    const r = Math.max(front, 0.5);
    this.foil.visible = fade > 0.01;
    this.foil.position.set(this.from.x, 0.07, this.from.z);
    this.foil.scale.setScalar(r);
    // Thickness stays >= 0.15 m: the foil is a 6% band, so widen it at small radii by scaling opacity only.
    (this.foil.material as THREE.MeshBasicMaterial).opacity = 0.85 * fade;
    if (this.novaTimer < 0.05) return;
    this.novaTimer = 0;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + Math.random() * 0.1, a1 = a0 + (Math.PI * 2) / n * 1.05;
      this.v1.set(this.from.x + Math.cos(a0) * r, 0.25 + Math.random() * 0.5, this.from.z + Math.sin(a0) * r);
      this.v2.set(this.from.x + Math.cos(a1) * r, 0.25 + Math.random() * 0.5, this.from.z + Math.sin(a1) * r);
      this.tree.strike(this.v1, this.v2, 0, 0.18, 0.06, { hold: 0.8, levels: 1, jag: 1.1 });
    }
  }

  private novaStep(front: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const e of ctx.targets) {
      if (this.struck.has(e)) continue;
      const p = e.group.position;
      if (Math.hypot(p.x - this.from.x, p.z - this.from.z) > front) continue;
      this.struck.add(e);
      if (this.struck.size <= MAX_VIS) {
        this.v1.copy(this.chest);
        this.v2.set(p.x, 1.1, p.z);
        this.tree.strike(this.v1, this.v2, 2, 0.18, 0.5, { hold: 0.35, levels: 2 });
        this.puddles.ripple(this.v1.set(p.x, 0, p.z), 1.4);
        this.sparks.burst(this.v2, 6, 4);
      }
      ctx.hit(e, { damage: this.settings.damage, knock: 1, from: ctx.from, color: STORM_CSS.body, status: { kind: 'stun', seconds: this.settings.stun } });
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.cloud.update(dt);
    this.rain.update(dt);
    this.puddles.update(dt);
    this.tree.update(dt);
    this.sparks.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    if (!f.cloud && t >= 0.02) {
      f.cloud = true;
      this.cloud.gather(this.from, 1.4, 3.4, FORM_END);
    }
    if (!f.rain && t >= FORM_END) {
      f.rain = true;
      this.rain.fall(this.from, 2.7, 0, 0.5);
      this.puddles.wet(this.from, 2.4);
      this.puddles.drizzle(this.from, 2.3, 5);
    }
    // The rain cloak crackles from the start; the ring of arcs hops around her from 0.3 to 2.6.
    if (t < BREAK_T) {
      this.sparkTimer += dt;
      while (this.sparkTimer >= 0.1) {
        this.sparkTimer -= 0.1;
        this.v1.set(this.from.x + (Math.random() - 0.5) * 0.9, 0.5 + Math.random() * 1.4, this.from.z + (Math.random() - 0.5) * 0.9);
        this.sparks.burst(this.v1, 2, 1.8);
      }
    }
    if (t >= FORM_END && t < BREAK_T) {
      this.arcTimer += dt;
      while (this.arcTimer >= 0.07) {
        this.arcTimer -= 0.07;
        this.arc();
      }
    }
    if (!f.pulse1 && t >= PULSE_1) { f.pulse1 = true; this.pulse(); }
    if (f.pulse1 && t < PULSE_1 + NOVA_LEN + 0.05) {
      const k = Math.min(1, (t - PULSE_1) / NOVA_LEN);
      const front = 0.5 + (RADIUS - 0.5) * (1 - Math.pow(1 - k, 3));
      this.novaTimer += dt;
      this.novaRing(front, 1 - 0.3 * k);
      this.novaStep(front);
    } else if (f.pulse1 && this.foil.visible) {
      // Fade the foil ring out after the front reaches 5 m.
      const o = (this.foil.material as THREE.MeshBasicMaterial).opacity - dt * 3;
      (this.foil.material as THREE.MeshBasicMaterial).opacity = Math.max(0, o);
      if (o <= 0) this.foil.visible = false;
    }
    if (!f.broken && t >= BREAK_T) {
      f.broken = true;
      this.cloud.disperse(0.4);
      this.rain.stop();
      this.puddles.dry(0.5);
    }

    this.layout();
  }

  private layout() {
    const t = this.time;

    this.screen.darken = 0.2 * smoothstep(t / 0.35) * (1 - smoothstep((t - BREAK_T) / 0.5));

    // The cloud flashes at each pulse; the ground ring races out to the radius.
    let flash = 0, gr = 0, gs = 0, sh = 0;
    for (const at of this.pulseAt) {
      const k = (t - at) / NOVA_LEN;
      if (k >= 0 && k < 1) {
        flash = Math.max(flash, (1 - k) * (1 - k));
        gr = RADIUS * (1 - Math.pow(1 - k, 3));
        gs = 0.02 * (1 - k) * (1 - k);
        sh = Math.max(sh, 0.12 * Math.exp(-(t - at) * 10));
      }
    }
    this.cloud.flash = flash;
    this.groundShock.set(this.from, Math.max(gr, 0.1), gs);
    this.shake = sh;
  }
}

export const staticFieldModule: EffectModule = {
  label: 'static field',
  category: 'hero: storm',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new StaticField(),
  telegraphs(effect) {
    const e = effect as StaticField;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: 0, impact: PULSE_1 + NOVA_LEN }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as StaticField;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as StaticField).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
    f.add(s, 'stun', 0, 1.2, 0.1);
  },
};
