import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import { AshMotes, Crackle, Rift, Shards, VOID, VOID_CSS } from '../../effects/parts/void';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Void Mantle (void kit, E: self burst plus a void maw shell, no shield, no silence). A ring of five standing rifts
 * (about 1.4 tall) opens round Oblivion at radius 1.4 and turns slowly. Round him a dark, slowly turning shell of tears
 * with a violet rim (low-opacity faces, bright rim lines; the model stays readable) forms in 0.3 s and lasts `shell`
 * seconds (2.0) from the cast; the duel trait swallows the next enemy spell inside that window. At 1.0 s the rifts flare
 * and one crack ring races out to radius 4: every enemy still inside is hit. From 2.0 s the rifts zip shut one by
 * one. Clean by 2.6 s. See pipeline/designs/kit-void.md.
 */
export interface VoidMantleSettings {
  damage: number;
  /** Seconds the maw shell stays up (the trait swallows the next enemy spell meanwhile). */
  shell: number;
  loop: boolean;
}

export const defaultVoidMantle = (): VoidMantleSettings => ({ damage: 25, shell: 2, loop: false });

// Timeline (seconds).
const OPEN_END = 0.3;
const PULSE_1 = 1.0;
const ZIP_T = 2.0;
const DURATION = 2.6;
const RADIUS = 4;
const RING_R = 1.4;
const RIFTS = 5;
const RIFT_H = 1.4;
const SHELL_IN = 0.3; // the shell forms
const SHELL_OUT = 0.25; // and collapses at the end of `shell`
const SHELL_R = 1.9;
const SHELL_Y = 1.15;
const TEARS = 7;
const SHELL_VIOLET = 0xa45cff;

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
  private pulseAt = [-9];
  private fadeAt = [-9];
  private flags = { open: false, pulse1: false, zip: false };
  private slots: number[] = [];

  // Parts.
  private rift = new Rift(RIFTS);
  private crackle = new Crackle();
  private shards = new Shards(12);
  private motes = new AshMotes(24);
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // The maw shell: low-opacity dark faces, bright violet rim lines, tears and an equator ring, turning slowly.
  private shell = new THREE.Group();
  private shellInner = new THREE.Group();
  private faceMat = new THREE.MeshBasicMaterial({ color: 0x1a0830, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  private rimMat = new THREE.LineBasicMaterial({ color: SHELL_VIOLET, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private innerMat = new THREE.LineBasicMaterial({ color: 0x6a2cc4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private tearMat = new THREE.MeshBasicMaterial({ color: 0x05000a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  private tearRimMat = new THREE.LineBasicMaterial({ color: 0xd6b0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private bandMat = new THREE.MeshBasicMaterial({ color: SHELL_VIOLET, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });

  // Scratch.
  private v1 = new THREE.Vector3();

  constructor(settings: VoidMantleSettings = defaultVoidMantle()) {
    this.settings = settings;
    this.screen.impactColor.set(VOID.hot);
    this.screen.tint.set(VOID.dark);
    this.buildShell();
    this.group.add(this.crackle.mesh, this.rift.mesh, this.shards.mesh, this.motes.mesh, this.groundShock.mesh, this.shell);
    this.reset();
  }

  /** The shell, built once at the origin: faces + rim lines on a faceted sphere, an inner counter-turning cage, slit tears, an equator band. */
  private buildShell() {
    const geo = new THREE.IcosahedronGeometry(SHELL_R, 1);
    const faces = new THREE.Mesh(geo, this.faceMat);
    faces.renderOrder = 5;
    const rim = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), this.rimMat);
    rim.renderOrder = 7;
    const inner = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(SHELL_R * 0.82, 0), 1), this.innerMat);
    inner.renderOrder = 7;
    this.shellInner.add(inner);
    this.shell.add(faces, rim, this.shellInner);
    // Tears: dark slits with a bright violet outline, lying on the shell surface, facing out.
    const slit = new THREE.Shape();
    slit.moveTo(0, -0.7); slit.quadraticCurveTo(0.17, 0, 0, 0.7); slit.quadraticCurveTo(-0.17, 0, 0, -0.7);
    const slitGeo = new THREE.ShapeGeometry(slit);
    const slitLine = new THREE.BufferGeometry().setFromPoints(slit.getPoints(12));
    for (let i = 0; i < TEARS; i++) {
      const a = (i / TEARS) * Math.PI * 2 + (i % 2) * 0.4;
      const lat = ((i * 5) % 7) / 7 * 1.4 - 0.7; // -0.7..0.7 rad
      const tear = new THREE.Group();
      tear.add(new THREE.Mesh(slitGeo, this.tearMat), new THREE.Line(slitLine, this.tearRimMat));
      tear.position.set(Math.cos(a) * Math.cos(lat), Math.sin(lat), Math.sin(a) * Math.cos(lat)).multiplyScalar(SHELL_R * 1.01);
      tear.lookAt(tear.position.clone().multiplyScalar(2));
      tear.rotateZ((i % 3) * 0.5 - 0.5);
      tear.scale.setScalar(0.8 + (i % 3) * 0.25);
      tear.renderOrder = 6;
      tear.children.forEach((c) => { c.renderOrder = 6; });
      this.shell.add(tear);
    }
    const band = new THREE.Mesh(new THREE.RingGeometry(SHELL_R * 0.99, SHELL_R * 1.04, 48).rotateX(-Math.PI / 2), this.bandMat);
    band.renderOrder = 7;
    this.shell.add(band);
    this.shell.visible = false;
  }

  get duration() {
    return Math.max(DURATION, this.settings.shell + 0.3);
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
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.pulseAt[0] = -9;
    this.fadeAt[0] = -9;
    const f = this.flags;
    f.open = f.pulse1 = f.zip = false;
    this.slots.length = 0;
    clearScreenFx(this.screen);
    this.screen.tint.set(VOID.dark);
    this.rift.reset();
    this.crackle.reset();
    this.shards.reset();
    this.motes.reset();
    this.groundShock.set(this.from, 0, 0);
    this.shell.visible = false;
    this.faceMat.opacity = this.rimMat.opacity = this.innerMat.opacity = this.tearMat.opacity = this.tearRimMat.opacity = this.bandMat.opacity = 0;
  }

  private pulse() {
    const ctx = this.ctx;
    this.pulseAt[0] = PULSE_1;
    this.fadeAt[0] = PULSE_1 + 0.3;
    this.shake = 0.15;
    this.rift.flare(1, 0.25);
    this.crackle.width = 0.42;
    this.crackle.grow(this.center, RADIUS, 0.25);
    this.shards.burst(this.v1.copy(this.center).setY(0.4), 4, 3.2, 0.2);
    this.motes.emit(this.center, 2.5, 6);
    if (!ctx) return;
    // Re-check at the pulse: only enemies still inside the radius are hit.
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.center.x, p.z - this.center.z) > RADIUS) continue;
      ctx.hit(e, { damage: this.settings.damage, knock: 1, color: VOID_CSS.body });
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
    if (this.time >= this.duration) {
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
    if (!f.pulse1 && t >= PULSE_1) { f.pulse1 = true; this.pulse(); }
    for (let i = 0; i < 1; i++) {
      if (this.fadeAt[i] > 0 && t >= this.fadeAt[i]) {
        this.fadeAt[i] = -9;
        this.crackle.fade(0.5);
      }
    }
    // 2.0..2.4: the rifts zip shut one by one.
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

    // The maw shell: forms in SHELL_IN, turns slowly, collapses over SHELL_OUT at the end of `shell`; it follows him.
    const sEnd = this.settings.shell;
    const sk = smoothstep(t / SHELL_IN) * (1 - smoothstep((t - (sEnd - SHELL_OUT)) / SHELL_OUT));
    this.shell.visible = sk > 0.001;
    if (this.shell.visible) {
      this.shell.position.set(this.center.x, SHELL_Y, this.center.z);
      this.shell.scale.setScalar(0.7 + 0.3 * sk);
      this.shell.rotation.y = t * 0.55;
      this.shell.rotation.x = 0.12 * Math.sin(t * 0.8);
      this.shellInner.rotation.set(t * -0.9, t * 0.7, 0);
      const flicker = 0.85 + 0.15 * Math.sin(t * 7);
      this.faceMat.opacity = 0.14 * sk;
      this.rimMat.opacity = 0.75 * sk * flicker;
      this.innerMat.opacity = 0.35 * sk;
      this.tearMat.opacity = 0.6 * sk;
      this.tearRimMat.opacity = 0.85 * sk * flicker;
      this.bandMat.opacity = 0.35 * sk;
    }

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
    f.add(s, 'shell', 0.5, 4, 0.1);
  },
};
