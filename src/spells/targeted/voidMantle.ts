import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import { AshMotes, Crackle, Rift, Shards, VOID, VOID_CSS } from '../../effects/parts/void';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Void Mantle (void kit, E: self shield + two pulses, the second silences). A ring of five standing rifts (about 1.4 tall)
 * opens round Oblivion at radius 1.4 and turns slowly; he takes a 40 point shield for 3 s. At 1.0 s and 2.0 s the rifts
 * flare and a crack ring races out to radius 4: every enemy still inside is hit; the second pulse also silences. From
 * 2.6 s the rifts zip shut one by one. Clean by 3.2 s. See pipeline/designs/kit-void.md.
 */
export interface VoidMantleSettings {
  damage: number;
  shield: number;
  loop: boolean;
}

export const defaultVoidMantle = (): VoidMantleSettings => ({ damage: 12, shield: 40, loop: false });

// Timeline (seconds).
const OPEN_END = 0.3;
const PULSE_1 = 1.0;
const PULSE_2 = 2.0;
const ZIP_T = 2.6;
const DURATION = 3.2;
const RADIUS = 4;
const RING_R = 1.4;
const RIFTS = 5;
const RIFT_H = 1.4;

export class VoidMantle implements Effect {
  readonly group = new THREE.Group();
  readonly settings: VoidMantleSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private from = new THREE.Vector3(0, 0, 14);
  private center = new THREE.Vector3(0, 0, 14);
  private face = new THREE.Vector3(0, 0, -1);
  private pulseAt = [-9, -9];
  private fadeAt = [-9, -9];
  private flags = { open: false, pulse1: false, pulse2: false, zip: false };
  private slots: number[] = [];

  // Parts.
  private rift = new Rift(RIFTS);
  private crackle = new Crackle();
  private shards = new Shards(12);
  private motes = new AshMotes(24);
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();

  constructor(settings: VoidMantleSettings = defaultVoidMantle()) {
    this.settings = settings;
    this.screen.impactColor.set(VOID.hot);
    this.screen.tint.set(VOID.dark);
    this.group.add(this.crackle.mesh, this.rift.mesh, this.shards.mesh, this.motes.mesh, this.groundShock.mesh);
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
    this.center.copy(this.from);
    // The rifts stand flat toward the gameplay camera (behind the caster).
    this.face.set(-Math.sin(ctx.aim), 0, -Math.cos(ctx.aim));
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).setY(1.3);
    this.groundShock.set(this.from, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
    // The shield comes up with the ring.
    this.ctx?.shieldSelf?.(this.settings.shield, 3, VOID_CSS.body);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.pulseAt[0] = this.pulseAt[1] = -9;
    this.fadeAt[0] = this.fadeAt[1] = -9;
    const f = this.flags;
    f.open = f.pulse1 = f.pulse2 = f.zip = false;
    this.slots.length = 0;
    clearScreenFx(this.screen);
    this.screen.tint.set(VOID.dark);
    this.rift.reset();
    this.crackle.reset();
    this.shards.reset();
    this.motes.reset();
    this.groundShock.set(this.from, 0, 0);
  }

  private pulse(index: number) {
    const ctx = this.ctx;
    this.pulseAt[index] = index === 0 ? PULSE_1 : PULSE_2;
    this.fadeAt[index] = this.pulseAt[index] + 0.3;
    this.shake = 0.15;
    this.rift.flare(1, 0.25);
    this.crackle.width = 0.42;
    this.crackle.grow(this.center, RADIUS, 0.25);
    this.shards.burst(this.v1.copy(this.center).setY(0.4), 4, 3.2, 0.2);
    this.motes.emit(this.center, 2.5, 6);
    if (!ctx) return;
    // Re-check at the pulse: only enemies still inside the radius are hit. The second pulse silences.
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.center.x, p.z - this.center.z) > RADIUS) continue;
      if (index === 1) ctx.hit(e, { damage: this.settings.damage, knock: 1, color: VOID_CSS.body, status: { kind: 'silence', seconds: 1.0 } });
      else ctx.hit(e, { damage: this.settings.damage, knock: 1, color: VOID_CSS.body });
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.rift.update(dt);
    this.crackle.update(dt);
    this.shards.update(dt);
    this.motes.update(dt);
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
    // The ring follows him.
    const c = this.ctx?.caster.group.position;
    if (c) this.center.set(c.x, 0, c.z);

    // 0..0.3: five standing rifts open round him (built at the origin, placed on the orbit each frame).
    if (!f.open) {
      f.open = true;
      for (let i = 0; i < RIFTS; i++) {
        const s = this.rift.openStanding(this.v1.set(0, 0.03, 0), RIFT_H * (0.9 + 0.2 * ((i * 7) % 5) / 4), this.face, 0.5, OPEN_END, { delay: i * 0.03, seed: i * 5 + 1 });
        this.slots.push(s);
      }
      this.motes.emit(this.center, RING_R, 8);
    }
    if (!f.pulse1 && t >= PULSE_1) { f.pulse1 = true; this.pulse(0); }
    if (!f.pulse2 && t >= PULSE_2) { f.pulse2 = true; this.pulse(1); }
    for (let i = 0; i < 2; i++) {
      if (this.fadeAt[i] > 0 && t >= this.fadeAt[i]) {
        this.fadeAt[i] = -9;
        this.crackle.fade(0.5);
      }
    }
    // 2.6..3.0: the rifts zip shut one by one.
    if (!f.zip && t >= ZIP_T) {
      f.zip = true;
      this.slots.forEach((s, i) => this.rift.close(0.3, s, 0.025 + i * 0.025));
    }

    // The ring turns slowly.
    const spin = t * 0.9;
    this.slots.forEach((s, i) => {
      const a = spin + (i / RIFTS) * Math.PI * 2;
      this.rift.place(s, this.v1.set(this.center.x + Math.cos(a) * RING_R, 0, this.center.z + Math.sin(a) * RING_R));
    });

    // The ground ring of each pulse.
    let gr = 0, gs = 0, sh = 0;
    for (const at of this.pulseAt) {
      const s = t - at;
      if (s < 0 || s > 0.75) continue;
      if (s < 0.4) {
        const k = s / 0.4;
        gr = RADIUS * (1 - Math.pow(1 - k, 3));
        gs = 0.016 * (1 - k) * (1 - k);
      }
      sh = Math.max(sh, 0.15 * Math.exp(-s * 10));
    }
    this.groundShock.set(this.center, Math.max(gr, 0.1), gs);
    this.shake = sh;
    this.screen.darken = 0.1 * smoothstep(t / 0.35) * (1 - smoothstep((t - ZIP_T) / 0.5));
  }
}

export const voidMantleModule: EffectModule = {
  label: 'void mantle',
  category: 'hero: void',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new VoidMantle(),
  telegraphs(effect) {
    const e = effect as VoidMantle;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: 0, impact: PULSE_1 }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as VoidMantle;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as VoidMantle).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
    f.add(s, 'shield', 0, 150, 5);
  },
};
