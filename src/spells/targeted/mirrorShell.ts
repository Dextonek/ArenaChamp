import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction } from '../../effects/parts';
import { Crystal, Glitter, PRISM, PRISM_CSS, SpectrumBeam } from '../../effects/parts/prism';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Mirror Shell (prism kit, E: blink and shield, no damage). Six flat crystal mirrors assemble round Opaline (radius 1.3,
 * waist to head), turning slowly, and she gets a 45 HP shield for 3 s (`ctx.shieldSelf`). At 0.3 s the mirrors flash
 * and throw spectral beams outward while she blinks 4 m sideways (`ctx.moveCaster`, 0.12 s), perpendicular to the line
 * to the enemy so a marksman never blinks into it; the shell goes with her. At 1.8 s the mirrors shatter into glitter.
 * Clean by 2.3 s. See pipeline/designs/kit-prism.md.
 */
export interface MirrorShellSettings {
  shield: number;
  loop: boolean;
}

export const defaultMirrorShell = (): MirrorShellSettings => ({ shield: 45, loop: false });

// Timeline (seconds).
const ASSEMBLE_END = 0.3;
const PULSE_1 = 0.3; // the flash and the blink
const BLINK_LEN = 0.12;
const BLINK = 4;
const SHATTER_T = 1.8;
const DURATION = 2.3;

const RADIUS = 4;
const SHELL_R = 1.3;
const COUNT = 6;
const PANE_LEN = 1.25;
const PANE_W = 0.8;
const PANE_Y = 1.25;

export class MirrorShell implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MirrorShellSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private from = new THREE.Vector3(0, 0, 14);
  /** Where she cast from and where the blink puts her (sideways of the line to the enemy). */
  readonly start = new THREE.Vector3();
  private land = new THREE.Vector3();
  /** Where the blink is aimed (clamped to the ring when it starts). */
  get blinkTo() {
    return this.land;
  }
  private flags = { panes: false, pulse1: false, shattered: false };
  private pulseAt = [-9];
  private idx: number[] = [];
  private angle = 0;

  private panes = new Crystal(COUNT + 1);
  private beams = new SpectrumBeam(COUNT);
  private glitter = new Glitter(80);
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: PRISM.dark, transparent: true, opacity: 0, depthWrite: false });
  private rim: THREE.Mesh;
  private rimMat = new THREE.MeshBasicMaterial({ color: PRISM.foil, transparent: true, opacity: 0, depthWrite: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: MirrorShellSettings = defaultMirrorShell()) {
    this.settings = settings;
    // A dark layer under her feet and a pale ring where the mirrors stand.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.shade.visible = false;
    this.rim = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 56).rotateX(-Math.PI / 2), this.rimMat);
    this.rim.renderOrder = 2;
    this.rim.visible = false;
    this.group.add(this.shade, this.rim, this.panes.mesh, this.beams.mesh, this.glitter.mesh, this.groundShock.mesh);
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
    this.start.copy(this.from);
    // Sideways of the line to the enemy; of the two sides, the one nearer the middle of the ring.
    const e = ctx.targetPos[0] ?? ctx.point;
    this.v1.set(e.x - this.from.x, 0, e.z - this.from.z);
    if (this.v1.lengthSq() < 0.25) this.v1.set(Math.sin(ctx.caster.group.rotation.y), 0, Math.cos(ctx.caster.group.rotation.y));
    this.v1.normalize();
    this.v2.set(-this.v1.z, 0, this.v1.x);
    const a = this.v2.clone().multiplyScalar(BLINK).add(this.from), b = this.v2.clone().multiplyScalar(-BLINK).add(this.from);
    this.land.copy(a.lengthSq() <= b.lengthSq() ? a : b);
    this.groundShock.set(this.from, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
    this.ctx?.shieldSelf?.(this.settings.shield, 3, PRISM_CSS.body);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.angle = 0.4;
    this.pulseAt[0] = -9;
    this.flags.panes = this.flags.pulse1 = this.flags.shattered = false;
    this.idx.length = 0;
    this.panes.reset();
    this.beams.reset();
    this.glitter.reset();
    this.shade.visible = false;
    this.rim.visible = false;
    this.shadeMat.opacity = 0;
    this.rimMat.opacity = 0;
    this.groundShock.set(this.from, 0, 0);
  }

  private paneAngle(i: number) {
    return this.angle + (i / COUNT) * Math.PI * 2;
  }

  private pulse(index: number) {
    const ctx = this.ctx, P = this.from;
    this.pulseAt[index] = PULSE_1;
    void ctx;
    this.shake = 0.15;
    // Each mirror throws a spectral beam straight out and down to the zone edge.
    for (let i = 0; i < COUNT; i++) {
      const a = this.paneAngle(i), c = Math.cos(a), s = Math.sin(a);
      this.v1.set(P.x + c * SHELL_R, PANE_Y, P.z + s * SHELL_R);
      this.v2.set(P.x + c * RADIUS, 0.25, P.z + s * RADIUS);
      this.beams.set(this.v1, this.v2, 0.5, 1, undefined, 0.4, i);
      this.glitter.burst(this.v1, 2, 2);
    }
    // The blink: she slides to the spot sideways of the enemy line; the shell below follows her position.
    if (ctx?.moveCaster) ctx.moveCaster(this.land, BLINK_LEN);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.panes.update(dt);
    this.glitter.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags;
    // The shell follows her if she walks on.
    const cp = this.ctx?.caster.group.position;
    if (cp && !f.shattered) this.from.set(cp.x, 0, cp.z);
    const P = this.from;

    if (!f.panes) {
      f.panes = true;
      for (let i = 0; i < COUNT; i++) this.idx[i] = this.panes.place(this.v1.copy(P).setY(PANE_Y), this.up, PANE_LEN, PANE_W, { flat: 0.2, spin: 0, scale: 1e-3 });
      this.shade.visible = this.rim.visible = true;
    }

    // --- 0..0.3: the mirrors fly in and stand; then they turn slowly round her, each also flashing at the pulses. ---
    if (!f.shattered) {
      const k = easeOut(t / ASSEMBLE_END);
      this.angle += dt * (0.9 + 2.5 * (1 - k));
      let flash = 0;
      for (const at of this.pulseAt) { const s = t - at; if (s >= 0 && s < 0.25) flash = Math.max(flash, Math.sin((s / 0.25) * Math.PI)); }
      for (let i = 0; i < COUNT; i++) {
        const a = this.paneAngle(i), r = SHELL_R + (1 - k) * 1.2;
        this.v1.set(P.x + Math.cos(a) * r, PANE_Y + (1 - k) * 0.5 + Math.sin(t * 2 + i * 1.3) * 0.05, P.z + Math.sin(a) * r);
        this.panes.move(this.idx[i], this.v1);
        this.panes.setRoll(this.idx[i], Math.atan2(-Math.cos(a), -Math.sin(a)));
        this.panes.setScale(this.idx[i], Math.max(k, 1e-3) * (1 + 0.28 * flash));
      }
    }

    if (!f.pulse1 && t >= PULSE_1) { f.pulse1 = true; this.pulse(0); }
    if (!f.shattered && t >= SHATTER_T) {
      f.shattered = true;
      this.panes.shatter(3.5, 0.5, this.v1.copy(P).setY(PANE_Y));
      for (let i = 0; i < COUNT; i++) {
        const a = this.paneAngle(i);
        this.glitter.burst(this.v1.set(P.x + Math.cos(a) * SHELL_R, PANE_Y, P.z + Math.sin(a) * SHELL_R), 3, 2.5);
      }
    }

    // --- The beams flash and fade after each pulse; the ring on the floor races out. ---
    let gr = 0, gs = 0, sh = 0, bo = 0;
    for (const at of this.pulseAt) {
      const s = t - at;
      if (s < 0 || s > 0.5) continue;
      bo = Math.max(bo, 1 - s / 0.4);
      const k = Math.min(s / 0.4, 1);
      if (s < 0.4) { gr = 0.8 + (RADIUS - 0.8) * (1 - Math.pow(1 - k, 3)); gs = 0.02 * (1 - k) * (1 - k); }
      sh = Math.max(sh, 0.15 * Math.exp(-s * 10));
    }
    for (let i = 0; i < COUNT; i++) {
      if (bo > 0.01) {
        const a = this.paneAngle(i), c = Math.cos(a), s = Math.sin(a);
        this.beams.set(this.v1.set(P.x + c * SHELL_R, PANE_Y - (1 - bo) * 0.2, P.z + s * SHELL_R), this.v2.set(P.x + c * RADIUS, 0.25, P.z + s * RADIUS), 0.5 * (0.5 + 0.5 * bo), bo, undefined, 0.4, i);
      } else this.beams.hide(i);
    }
    this.groundShock.set(P, Math.max(gr, 0.1), gs);
    this.shake = sh;

    // --- Dark layer and pale ring on the floor, fading with the shatter. ---
    const fade = 1 - smoothstep((t - SHATTER_T) / 0.4);
    this.shadeMat.opacity = 0.4 * Math.min(1, t / ASSEMBLE_END) * fade;
    this.rimMat.opacity = 0.6 * Math.min(1, t / ASSEMBLE_END) * fade;
    this.shade.position.set(P.x, 0.03, P.z);
    this.shade.scale.setScalar(1.7);
    this.rim.position.set(P.x, 0.05, P.z);
    this.rim.scale.setScalar(SHELL_R);
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const mirrorShellModule: EffectModule = {
  label: 'mirror shell',
  category: 'hero: prism',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new MirrorShell(),
  telegraphs(effect) {
    const e = effect as MirrorShell;
    const ctx = e.ctx;
    if (!ctx) return [];
    // No hit: the line only shows where she blinks to.
    return [{ shape: { kind: 'line', x1: e.start.x, z1: e.start.z, x2: e.blinkTo.x, z2: e.blinkTo.z, width: 0.8 }, start: 0, impact: PULSE_1 }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as MirrorShell;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as MirrorShell).settings;
    f.add(s, 'loop');
    f.add(s, 'shield', 0, 100, 1);
  },
};
