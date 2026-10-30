import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { CrescentArc, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { ASTRAL, ASTRAL_CSS, ConstellationLines, StarArrow, StarPoints } from '../../effects/parts/astral';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Starshot (astral kit, Q: quick chain shot). Lyra draws a bow of light (a gold crescent and a string), a star arrow
 * flies to the first enemy and on the hit splits and hops to the 2nd and 3rd nearest (0.08 s per hop). Each hit pops
 * a star over the enemy (a cyan accent for 2 frames) and a gold line remains joining the stars in order: the shot
 * leaves a small constellation. Then the lines snap and the stars fall as tiny shooting stars. See
 * pipeline/designs/kit-astral.md.
 */
export interface StarshotSettings {
  damage: number;
  loop: boolean;
}

export const defaultStarshot = (): StarshotSettings => ({ damage: 55, loop: false });

// Timeline (seconds).
const BOW_END = 0.22;
const RELEASE_T = 0.27;
const FLIGHT_1 = 0.25; // hand to the first target
const HOP = 0.08;
const HIT_T = [RELEASE_T + FLIGHT_1, RELEASE_T + FLIGHT_1 + HOP, RELEASE_T + FLIGHT_1 + 2 * HOP]; // 0.52, 0.60, 0.68
const SNAP_T = 0.8;
const DURATION = 1.6;
const MAX_HITS = 3;
const STAR_Y = 1.7;

export class Starshot implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StarshotSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private hand = new THREE.Vector3(0, 1.4, 13);
  private bowPos = new THREE.Vector3(0, 1.5, 12);
  private nHits = 1;
  private hitPts: THREE.Vector3[] = [];
  private starPts: THREE.Vector3[] = [];

  private flags = { launched: [false, false, false], hit: [false, false, false], snapped: false, muzzle: false };
  private starIds: number[] = [];

  // Parts.
  private bowPivot = new THREE.Group();
  private bow = new CrescentArc({ radius: 0.75, width: 0.16, sweep: Math.PI * 0.9, style: 'toon', edge: ASTRAL.core, mid: ASTRAL.hot, outer: ASTRAL.body });
  private string = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.07),
    new THREE.MeshBasicMaterial({ color: ASTRAL.hot, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );
  private arrows = [0, 1, 2].map(() => new StarArrow());
  private stars = new StarPoints({ max: 16 });
  private lines = new ConstellationLines({ maxLines: 8 });
  private pops = [0, 1, 2].map(() => new StarBurst({ points: 10, inner: 0.3, color: ASTRAL.accent, core: ASTRAL.core, additive: false }));
  private muzzle = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: ASTRAL.hot, core: ASTRAL.core, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();

  constructor(settings: StarshotSettings = defaultStarshot()) {
    this.settings = settings;
    this.lines.widthScale = 1.6;
    for (let i = 0; i < MAX_HITS; i++) { this.hitPts.push(new THREE.Vector3()); this.starPts.push(new THREE.Vector3()); }

    // The bow: a gold toon crescent on a camera-facing pivot, bulging toward the top of the screen, with the string
    // across its chord. The arc lives in the local XY plane; its mid-angle points at +Y.
    const sweep = Math.PI * 0.9;
    this.bow.mesh.rotation.z = Math.PI / 2 - sweep / 2;
    const chordY = 0.75 * Math.cos(sweep / 2), half = 0.75 * Math.sin(sweep / 2);
    this.string.scale.x = half * 2;
    this.string.position.set(0, chordY, 0);
    this.bowPivot.add(this.bow.mesh, this.string);
    this.bow.mesh.onBeforeRender = (_r, _s, camera) => {
      this.bowPivot.parent?.getWorldQuaternion(this.qa);
      camera.getWorldQuaternion(this.qb);
      this.bowPivot.quaternion.copy(this.qa.invert().multiply(this.qb));
      this.bowPivot.updateMatrixWorld(true);
    };
    this.string.renderOrder = 7;

    this.group.add(
      this.bowPivot, ...this.arrows.map((a) => a.mesh), this.lines.mesh, this.stars.mesh,
      ...this.pops.map((p) => p.mesh), this.muzzle.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T[0];
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.55).setY(1.4);
    this.bowPos.copy(ctx.from).addScaledVector(this.fwd, 0.95).setY(1.55);
    this.nHits = Math.max(1, Math.min(MAX_HITS, ctx.targets.length));
    for (let i = 0; i < MAX_HITS; i++) {
      const p = ctx.targetPos[i] ?? ctx.targetPos[0] ?? ctx.point;
      this.hitPts[i].copy(p).setY(1.1);
      this.starPts[i].copy(p).setY(STAR_Y);
    }
    this.bowPivot.position.copy(this.bowPos);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.launched = [false, false, false];
    this.flags.hit = [false, false, false];
    this.flags.snapped = false;
    this.flags.muzzle = false;
    this.starIds.length = 0;
    clearScreenFx(this.screen);
    this.stars.reset();
    this.lines.reset();
    for (const a of this.arrows) a.reset();
    this.bow.opacity = 0;
    (this.string.material as THREE.MeshBasicMaterial).opacity = 0;
    this.string.visible = false;
    for (const p of this.pops) p.set(this.hand, 0, 0);
    this.muzzle.set(this.hand, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.stars.update(dt);
    this.lines.update(dt);
    for (const a of this.arrows) a.update(dt);
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
    const ctx = this.ctx;

    // Events.
    for (let i = 0; i < this.nHits; i++) {
      const launch = i === 0 ? RELEASE_T : HIT_T[i - 1];
      if (!f.launched[i] && t >= launch) {
        f.launched[i] = true;
        const from = i === 0 ? this.hand : this.starPts[i - 1];
        this.arrows[i].fly(from, this.starPts[i], i === 0 ? FLIGHT_1 : HOP);
      }
      if (!f.hit[i] && t >= HIT_T[i]) {
        f.hit[i] = true;
        this.starIds.push(this.stars.add(this.starPts[i], 0.78));
        if (i > 0) {
          this.lines.connect(this.starPts[i - 1], this.starPts[i], 0.1);
          // A small companion star halfway along the new line.
          this.v1.addVectors(this.starPts[i - 1], this.starPts[i]).multiplyScalar(0.5);
          this.v1.y += 0.3 + 0.15 * i;
          const mid = this.stars.add(this.v1, 0.34, 0.05);
          this.starIds.push(mid);
          this.lines.connect(this.starPts[i - 1], this.v1, 0.08, 0.04);
          this.lines.connect(this.v1, this.starPts[i], 0.08, 0.12);
        }
        if (i === 0) this.shake = 0.15;
        if (ctx && ctx.targets[i]) {
          ctx.hit(ctx.targets[i], {
            damage: this.settings.damage, knock: 2, from: i === 0 ? ctx.from : this.hitPts[i - 1], color: ASTRAL_CSS.hot,
          });
        }
      }
    }
    if (!f.snapped && t >= SNAP_T) {
      f.snapped = true;
      this.lines.snap(0.6);
      this.stars.fallAll(1, 0.5);
    }

    this.layout();
  }

  private layout() {
    const t = this.time;
    const f = this.flags;

    // --- 0..0.35 The bow: a gold crescent draws on with its string, then fades at the release. ---
    this.bowPivot.position.copy(this.bowPos);
    this.bow.head = smoothstep(t / 0.2);
    this.bow.length = 1;
    this.bow.erosion = 0;
    this.bow.time = t;
    const bowA = t < BOW_END ? 1 : 1 - smoothstep((t - BOW_END) / 0.12);
    this.bow.opacity = bowA;
    const sm = this.string.material as THREE.MeshBasicMaterial;
    sm.opacity = bowA * smoothstep((t - 0.08) / 0.1);
    this.string.visible = sm.opacity > 0.01;

    // --- Release flash at the hand, 2 frames. ---
    const mp = StarBurst.pop(t - RELEASE_T, 0, 0.02);
    this.muzzle.set(this.hand, 0.75 * mp.scale, mp.opacity, 0.3);

    // --- Hit accents (cyan, 2-3 frames) over each enemy. ---
    for (let i = 0; i < MAX_HITS; i++) {
      if (!f.hit[i]) continue;
      const sp = StarBurst.pop(t - HIT_T[i], 0.02, 0.04);
      this.pops[i].set(this.hitPts[i], 0.95 * sp.scale, sp.opacity, i);
    }
    this.shake *= 0.85;
  }
}

export const starshotModule: EffectModule = {
  label: 'starshot',
  category: 'hero: astral',
  targeting: { mode: 'enemies', maxTargets: MAX_HITS },
  create: () => new Starshot(),
  telegraphs(effect) {
    const e = effect as Starshot;
    const ctx = e.ctx;
    if (!ctx) return [];
    const c = ctx.targetPos[0] ?? ctx.point;
    return [{ shape: { kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: c.x, z2: c.z, width: 1.0 }, start: 0.1, impact: HIT_T[0] }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Starshot;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Starshot).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
