import * as THREE from 'three';
import type { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { chromaPulse, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Glitch Purge (targeted, `enemies`, up to five targets): digital theme, motion is deliberately stepped (positions
 * are re-rolled only every 4 frames, 15 fps) against the smooth spells. A hard square reticle blinks shut on each
 * target in turn; flat pixel blocks (cyan / magenta / near-black, unlit, below the bloom threshold) tear off every
 * enemy and jump to new offsets on each step, two RGB-offset ghost bars flicker beside it and a wireframe data cube
 * forms around it, with one small hit per target. At 1.6 s everything freezes for a dead beat. At D one short
 * X-ray card frame, then every target is deleted at once: a thin scanline (white core only in the line, cyan
 * body, magenta trail) wipes up through it while the cube collapses to a point and the pixels fall and wink out.
 *
 * Palette row: custom digital (core #ffffff, cyan #3af2ff, magenta #ff3ad0, accent #ffe03a, void #05050a); the
 * blocks use mid-saturation versions so a pile of them never blooms to white.
 * Recipes: i-xray-cyan-punch-impact-cards (X-ray card impact), i-chromatic-ink-charge-prism-burst (RGB-split
 * ghosts + chroma), i-void-cut-rotating-band-slash (the stepped cage / band cut).
 */
export interface GlitchPurgeSettings {
  tickDamage: number;
  damage: number;
  loop: boolean;
}

export const defaultGlitchPurge = (): GlitchPurgeSettings => ({ tickDamage: 8, damage: 40, loop: false });

const MAXT = 5;
const D = 1.95; // delete moment (impact card)
const HIT = D + 0.06; // after the card
const FREEZE = 1.6; // dead beat starts
const DURATION = 4.2;
const STEP_HZ = 15; // 4 frames at 60 fps
const BLK = 30; // glitch blocks per target
const DEB = 12; // debris born at the delete
const NB = BLK + DEB;

const CYAN = 0x2ad0e0;
const CYAN_HI = 0x3af2ff;
const MAGENTA = 0xd02ab0;
const VOID = 0x0a0a1a;

const lockAt = (i: number) => 0.1 + 0.14 * i;
const glitchAt = (i: number) => 0.5 + 0.1 * i;
const tickAt = (i: number) => 1.0 + 0.12 * i;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
/** Deterministic 0..1 hash so the glitch looks the same on every cast. */
const rnd = (a: number, b: number, c: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

const HIDDEN = 1e-4;

export class GlitchPurge implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GlitchPurgeSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private count = 0;
  private aim = 0;
  private tickDone: boolean[] = Array(MAXT).fill(false);
  private hitDone = false;
  private axes: THREE.Vector3[] = Array.from({ length: MAXT }, () => new THREE.Vector3());
  private centroid = new THREE.Vector3();

  private boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private blocks: THREE.InstancedMesh;
  private brackets: THREE.InstancedMesh;
  private ghostC: THREE.Mesh[] = [];
  private ghostM: THREE.Mesh[] = [];
  private cageC: THREE.LineSegments[] = [];
  private cageM: THREE.LineSegments[] = [];
  private scan: THREE.Mesh[][] = [];

  private tmpP = new THREE.Vector3();
  private tmpS = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpM = new THREE.Matrix4();
  private yAxis = new THREE.Vector3(0, 1, 0);

  constructor(settings: GlitchPurgeSettings = defaultGlitchPurge()) {
    this.settings = settings;
    this.screen.tint.set(0x0a1030);
    this.screen.impactColor.set(CYAN_HI);
    this.screen.edgeTint.set(MAGENTA);
    this.screen.keepHue.set(CYAN);

    // Unlit hard boxes: flat colour, no lighting, so the mid-saturation values stay exactly as set.
    const flat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.blocks = new THREE.InstancedMesh(this.boxGeo, flat, MAXT * NB);
    this.blocks.frustumCulled = false;
    const col = new THREE.Color();
    for (let i = 0; i < MAXT; i++) {
      for (let k = 0; k < NB; k++) {
        const r = rnd(i, k, 12);
        const hex = k >= BLK ? (k % 3 === 0 ? CYAN : VOID) : r < 0.4 ? CYAN : r < 0.75 ? MAGENTA : VOID;
        this.blocks.setColorAt(i * NB + k, col.setHex(hex));
      }
    }
    if (this.blocks.instanceColor) this.blocks.instanceColor.needsUpdate = true;
    this.group.add(this.blocks);

    this.brackets = new THREE.InstancedMesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: CYAN_HI }), MAXT * 8);
    this.brackets.frustumCulled = false;
    this.group.add(this.brackets);

    const cageGeo = new THREE.EdgesGeometry(this.boxGeo);
    for (let i = 0; i < MAXT; i++) {
      const gc = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.5, depthWrite: false }));
      const gm = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0.5, depthWrite: false }));
      gc.frustumCulled = gm.frustumCulled = false;
      this.ghostC.push(gc);
      this.ghostM.push(gm);
      const cc = new THREE.LineSegments(cageGeo, new THREE.LineBasicMaterial({ color: CYAN_HI }));
      const cm = new THREE.LineSegments(cageGeo, new THREE.LineBasicMaterial({ color: MAGENTA }));
      cc.frustumCulled = cm.frustumCulled = false;
      this.cageC.push(cc);
      this.cageM.push(cm);
      // Scanline: wide magenta trail, cyan body, thin white core (the only white in the spell).
      const trail = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: MAGENTA }));
      const body = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: CYAN }));
      const core = new THREE.Mesh(this.boxGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      for (const m of [trail, body, core]) m.frustumCulled = false;
      this.scan.push([trail, body, core]);
      this.group.add(gc, gm, cc, cm, trail, body, core);
    }
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.aim = Number.isFinite(ctx.aim) ? ctx.aim : 0;
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    this.count = Math.min(MAXT, pts.length);
    this.centroid.set(0, 0, 0);
    for (let i = 0; i < this.count; i++) {
      this.axes[i].copy(pts[i]).setY(0);
      this.centroid.add(pts[i]);
    }
    this.centroid.divideScalar(Math.max(1, this.count)).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hitDone = false;
    this.tickDone.fill(false);
    this.shake = 0;
    clearScreenFx(this.screen);
    this.layout();
  }

  update(dt: number) {
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    for (let i = 0; i < this.count; i++) {
      if (!this.tickDone[i] && this.time >= tickAt(i)) this.onTick(i);
    }
    if (!this.hitDone && this.time >= HIT) this.onHit();
    this.layout();
  }

  private setInst(mesh: THREE.InstancedMesh, idx: number, pos: THREE.Vector3, sx: number, sy: number, sz: number, yaw: number) {
    this.tmpQ.setFromAxisAngle(this.yAxis, yaw);
    this.tmpM.compose(pos, this.tmpQ, this.tmpS.set(sx, sy, sz));
    mesh.setMatrixAt(idx, this.tmpM);
  }

  private hideInst(mesh: THREE.InstancedMesh, idx: number) {
    this.tmpM.compose(this.tmpP.set(0, -50, 0), this.tmpQ.identity(), this.tmpS.set(HIDDEN, HIDDEN, HIDDEN));
    mesh.setMatrixAt(idx, this.tmpM);
  }

  private layout() {
    const t = this.time;
    const aw = t - D;
    const after = t - HIT;
    const n = this.count;
    const fade = 1 - smoothstep((t - (DURATION - 0.4)) / 0.4);
    // Stepped clock: frozen from FREEZE on, so the whole glitch holds still for the dead beat.
    const st = Math.floor(Math.min(t, FREEZE) * STEP_HZ);
    const sc = Math.floor(t * STEP_HZ); // free-running step for effects that keep going
    const aim = this.aim;
    const rightX = Math.cos(aim), rightZ = -Math.sin(aim);

    // --- World grade, colour drain, chroma, the short X-ray card. ---
    const grade = t < D ? smoothstep(t / 0.4) : Math.exp(-Math.max(0, aw - 0.1) * 3);
    this.screen.darken = 0.5 * grade;
    this.screen.desaturate = 0.55 * grade;
    let ch = chromaPulse(t, 0.05, 0.5);
    for (let i = 0; i < n; i++) ch = Math.max(ch, chromaPulse(t, tickAt(i), 0.35, 12));
    if (t > 0.5 && t < FREEZE) ch = Math.max(ch, 0.14 * rnd(st, 3, 5));
    this.screen.chroma = Math.max(ch, chromaPulse(t, D, 0.9));
    this.screen.impact = impactFrameAt(t, D, [3], 0.06);

    // --- Per-target pieces. ---
    for (let i = 0; i < MAXT; i++) {
      const on = i < n && t < DURATION;
      const ax = this.axes[i];

      // Reticle: four hard L-brackets close on the chest, blink while locking, solid in the dead beat.
      const lk = t - lockAt(i);
      const closing = easeOut(lk / 0.3);
      const collapse = after > 0 ? 1 - smoothstep(after / 0.3) : 1;
      const half = (2.4 - 1.0 * closing) * 0.5 * (0.3 + 0.7 * collapse) + 0.2 * collapse;
      let showRet = on && lk >= 0 && after < 0.3;
      if (showRet && lk < 0.3) showRet = Math.floor(t * 30) % 2 === 0;
      else if (showRet && t < FREEZE) showRet = rnd(i, st, 60) > 0.1;
      const arm = 0.55, th = 0.07;
      for (let c = 0; c < 4; c++) {
        const sx = c % 2 ? 1 : -1, sy = c < 2 ? 1 : -1;
        for (let a = 0; a < 2; a++) {
          const idx = i * 8 + c * 2 + a;
          if (!showRet) { this.hideInst(this.brackets, idx); continue; }
          const lx = a === 0 ? sx * (half - arm / 2) : sx * half;
          const ly = a === 0 ? sy * half : sy * (half - arm / 2);
          this.tmpP.set(ax.x + rightX * lx, 1.2 + ly, ax.z + rightZ * lx);
          this.setInst(this.brackets, idx, this.tmpP, a === 0 ? arm : th, a === 0 ? th : arm, th, aim);
        }
      }

      // Ghost bars: RGB-offset copies of a vertical slice, flickering on the step clock.
      const gOn = on && t >= glitchAt(i) + 0.1 && after < 0.05;
      const flick = rnd(i, st, 40) > 0.3;
      const gc = this.ghostC[i], gm = this.ghostM[i];
      gc.visible = gOn && flick;
      gm.visible = gOn && rnd(i, st, 41) > 0.3;
      if (gc.visible) {
        const off = (0.3 + 0.6 * rnd(i, st, 42)) * (rnd(i, st, 43) > 0.5 ? 1 : -1);
        gc.position.set(ax.x + rightX * off, 1.2 + (rnd(i, st, 44) - 0.5) * 0.3, ax.z + rightZ * off);
        gc.scale.set(0.15 + 0.5 * rnd(i, st, 45), 2.4, 0.3);
        gc.rotation.y = aim;
      }
      if (gm.visible) {
        const off = (0.3 + 0.6 * rnd(i, st, 46)) * (rnd(i, st, 47) > 0.5 ? 1 : -1);
        gm.position.set(ax.x + rightX * off, 1.2 + (rnd(i, st, 48) - 0.5) * 0.3, ax.z + rightZ * off);
        gm.scale.set(0.15 + 0.5 * rnd(i, st, 49), 2.4, 0.3);
        gm.rotation.y = aim;
      }

      // Data cube: wireframe forms (cyan + magenta, offset), stepped yaw, collapses to a point at the delete.
      const cf = smoothstep((t - (glitchAt(i) + 0.3)) / 0.5);
      const cc = after > 0 ? 1 - smoothstep(after / 0.3) : 1;
      const cageOn = on && cf > 0 && after < 0.32;
      this.cageC[i].visible = this.cageM[i].visible = cageOn;
      if (cageOn) {
        const s = Math.max(HIDDEN, cf * cc);
        const yaw = aim + (rnd(i, st, 70) - 0.5) * 0.7;
        this.cageC[i].position.set(ax.x, 1.2, ax.z);
        this.cageC[i].scale.set(1.7 * s, 2.8 * s, 1.7 * s);
        this.cageC[i].rotation.y = yaw;
        this.cageM[i].position.set(ax.x + rightX * 0.1, 1.2, ax.z + rightZ * 0.1);
        this.cageM[i].scale.set(1.8 * s, 2.9 * s, 1.8 * s);
        this.cageM[i].rotation.y = yaw + 0.12;
      }

      // Scanline wipe rising through the enemy: wide magenta trail, cyan body, thin white core.
      const sOn = on && after >= 0 && after < 0.5;
      const sy = 0.1 + 2.7 * easeOut(after / 0.42);
      const [trail, body, core] = this.scan[i];
      trail.visible = body.visible = core.visible = sOn;
      if (sOn) {
        trail.position.set(ax.x, sy - 0.22, ax.z);
        trail.scale.set(2.0, 0.28, 2.0);
        body.position.set(ax.x, sy, ax.z);
        body.scale.set(2.1, 0.1, 2.1);
        core.position.set(ax.x, sy, ax.z);
        core.scale.set(2.1, 0.03, 2.1);
      }
    }

    // --- Pixel blocks and debris. ---
    for (let i = 0; i < MAXT; i++) {
      const ax = this.axes[i];
      for (let k = 0; k < NB; k++) {
        const idx = i * NB + k;
        const deb = k >= BLK;
        if (i >= this.count) { this.hideInst(this.blocks, idx); continue; }
        const r6 = rnd(i, k, 7);
        const tear = rnd(i, k, 8) > 0.82;
        const size = deb ? 0.1 + 0.12 * r6 : 0.14 + 0.26 * r6;
        let sx = size * (tear ? 3.2 : 1), sy = size * (tear ? 0.45 : 1);
        const sz = size * 0.6;
        let visible = true;
        const p = this.tmpP;
        if (!deb) {
          const birth = glitchAt(i) + (0.8 * k) / BLK;
          if (t < birth) visible = false;
          const ageS = Math.max(0, Math.min(t, FREEZE) - birth);
          const grow = 0.35 + 0.65 * smoothstep(ageS / 0.35);
          // Re-rolled only on the step clock: the signature jitter.
          const rad = (0.6 + 1.5 * rnd(i, k, st)) * grow;
          const ang = rnd(i, k + 50, st) * Math.PI * 2;
          p.set(ax.x + Math.cos(ang) * rad, 1.2 + (rnd(i, k + 100, st) - 0.5) * 2.8 * grow, ax.z + Math.sin(ang) * rad);
          if (visible && t < FREEZE && rnd(i, k + 150, st) < 0.12) visible = false; // dropped frame
        } else {
          if (after < 0) visible = false;
          const dir = rnd(i, k, 13) * Math.PI * 2;
          const sp = 2 + 3 * rnd(i, k, 14);
          const sa = Math.floor(Math.max(0, after) * STEP_HZ) / STEP_HZ;
          p.set(ax.x + Math.cos(dir) * (0.3 + sp * sa), 1.2 + (rnd(i, k, 15) - 0.2) * 1.6 + 2.5 * sa, ax.z + Math.sin(dir) * (0.3 + sp * sa));
        }
        if (after > 0) {
          // Fall: stepped ballistic from the frozen pose, then blink out one by one.
          const sa = Math.floor(after * STEP_HZ) / STEP_HZ;
          p.x += (rnd(i, k, 9) - 0.5) * 3 * sa;
          p.z += (rnd(i, k, 10) - 0.5) * 3 * sa;
          p.y += (rnd(i, k, 16) - 0.4) * 2 * sa - 7 * sa * sa;
          p.y = Math.max(0.12 + size * 0.5, p.y);
          const life = 0.6 + 1.5 * rnd(i, k, 11);
          if (after > life) visible = false;
          else if (after > life - 0.3 && Math.floor(after * 30) % 2) visible = false;
        }
        if (!visible || t >= DURATION) { this.hideInst(this.blocks, idx); continue; }
        if (sx < HIDDEN) sx = HIDDEN;
        if (sy < HIDDEN) sy = HIDDEN;
        this.setInst(this.blocks, idx, p, sx * fade + HIDDEN, sy * fade + HIDDEN, sz, aim);
      }
    }
    this.blocks.instanceMatrix.needsUpdate = true;
    this.brackets.instanceMatrix.needsUpdate = true;

    // --- Shake: stepped twitch during the glitch, none in the dead beat, one heavy hit at the delete. ---
    let sh = t > 0.5 && t < FREEZE ? 0.05 * (rnd(sc, 1, 2) > 0.5 ? 1 : 0) : 0;
    if (after > 0) sh = Math.max(sh, 0.55 * Math.exp(-after * 7));
    this.shake = sh;
  }

  /** A small tinted tick on each target as its cube closes. */
  private onTick(i: number) {
    this.tickDone[i] = true;
    const ctx = this.ctx;
    const en = ctx?.targets[i];
    if (!ctx || !en) return;
    ctx.hit(en, { damage: this.settings.tickDamage, knock: 0, from: ctx.from, color: '#ff3ad0' });
  }

  /** The delete: the big hit on every target at once. */
  private onHit() {
    this.hitDone = true;
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((en, i) => {
      if (i >= MAXT) return;
      ctx.hit(en, { damage: this.settings.damage, knock: 1, from: ctx.from, color: '#3af2ff' });
    });
  }
}

export const glitchPurgeModule: EffectModule = {
  label: 'glitch purge',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAXT },
  create: () => new GlitchPurge(),
  telegraphs(effect) {
    const e = effect as GlitchPurge;
    const pts = e.ctx?.targetPos ?? [];
    return pts.slice(0, MAXT).map((p, j) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.6 }, start: lockAt(j), impact: HIT,
    }));
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GlitchPurge;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as GlitchPurge).settings;
    f.add(s, 'loop');
    f.add(s, 'tickDamage', 0, 40, 1).name('tick damage');
    f.add(s, 'damage', 1, 150, 1);
  },
};
