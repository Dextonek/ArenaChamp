import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { CrescentArc, StarBurst, clearScreenFx, createScreenFx } from '../../effects/parts';
import { ASTRAL, ASTRAL_CSS, ConstellationLines, StarPoints } from '../../effects/parts/astral';
import { BoltSet, type BoltLook } from '../../effects/parts/bolt';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Starshot (astral kit, Q: bouncing skillshot, range 14). Lyra draws a bow of light (a gold crescent and a string) and
 * at 0.27 s the star arrow leaves along the aim line as a skillshot (`ctx.projectile`, bounce 1): it hits the first
 * enemy it touches and turns to the nearest other enemy within 6 m. Each hit pops a star over the enemy (a cyan accent
 * for 2 frames) and a gold line joins the stars in order: the shot leaves a small constellation. Then the lines snap
 * and the stars fall as tiny shooting stars. See pipeline/designs/kit-astral.md.
 */
export interface StarshotSettings {
  damage: number;
  loop: boolean;
}

export const defaultStarshot = (): StarshotSettings => ({ damage: 52, loop: false });

// Timeline (seconds).
const BOW_END = 0.22;
const RELEASE_T = 0.27;
const SPEED = 22;
const RANGE = 14;
const RADIUS = 0.4;
/** The firing point is this far in front of the caster's feet. */
const MUZZLE = 0.8;
const SETTLE = 0.5;
const MAX_T = 3;
const STAR_Y = 1.7;
const MAX_HITS = 2;

const LOOK: BoltLook = { core: ASTRAL_CSS.core, body: ASTRAL_CSS.hot, rim: ASTRAL_CSS.body, size: 0.45, trail: 3.5, hit: ASTRAL_CSS.accent };

export class Starshot implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StarshotSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The bolt's line, caster to max range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;

  // Cast geometry, computed in cast().
  private fwd = new THREE.Vector3(0, 0, -1);
  private hand = new THREE.Vector3(0, 1.4, 13);
  private bowPos = new THREE.Vector3(0, 1.5, 12);
  private starPts: THREE.Vector3[] = [];

  private flags = { fired: false, snapped: false, muzzle: false };
  private hits = 0;
  private popAge = [9, 9];
  private goneAt = -1;

  // Parts.
  private bowPivot = new THREE.Group();
  private bow = new CrescentArc({ radius: 0.75, width: 0.16, sweep: Math.PI * 0.9, style: 'toon', edge: ASTRAL.core, mid: ASTRAL.hot, outer: ASTRAL.body });
  private string = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.07),
    new THREE.MeshBasicMaterial({ color: ASTRAL.hot, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );
  private bolts = new BoltSet(this.group);
  private stars = new StarPoints({ max: 16 });
  private lines = new ConstellationLines({ maxLines: 8 });
  private pops = [0, 1].map(() => new StarBurst({ points: 10, inner: 0.3, color: ASTRAL.accent, core: ASTRAL.core, additive: false }));
  private muzzle = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: ASTRAL.hot, core: ASTRAL.core, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();

  constructor(settings: StarshotSettings = defaultStarshot()) {
    this.settings = settings;
    this.lines.widthScale = 1.6;
    for (let i = 0; i < MAX_HITS; i++) this.starPts.push(new THREE.Vector3());

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

    this.group.add(this.bowPivot, this.lines.mesh, this.stars.mesh, ...this.pops.map((p) => p.mesh), this.muzzle.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return RELEASE_T;
  }

  /** When the bolt has flown its full range (the telegraph stays drawn until then). */
  get flightEnd() {
    return RELEASE_T + RANGE / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.55).setY(1.4);
    this.bowPos.copy(ctx.from).addScaledVector(this.fwd, 0.95).setY(1.55);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.fwd.x * RANGE, z2: ctx.from.z + this.fwd.z * RANGE,
      width: RADIUS * 2,
    };
    this.bowPivot.position.copy(this.bowPos);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.fired = this.flags.snapped = this.flags.muzzle = false;
    this.hits = 0;
    this.popAge = [9, 9];
    this.goneAt = -1;
    clearScreenFx(this.screen);
    this.bolts.clear();
    this.stars.reset();
    this.lines.reset();
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
    this.time += dt;
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;

    // --- Release: the arrow leaves along the aim line. A network duel has no bolts (`projectile` is left out). ---
    if (!f.fired && t >= RELEASE_T) {
      f.fired = true;
      if (ctx?.projectile) {
        const bolt = ctx.projectile({
          from: ctx.from.clone().addScaledVector(this.fwd, MUZZLE), dir: this.fwd.clone(), speed: SPEED, range: RANGE - MUZZLE,
          radius: RADIUS, bounce: 1,
          hit: { damage: this.settings.damage, knock: 2, color: ASTRAL_CSS.hot },
        });
        this.bolts.follow(bolt, LOOK);
        bolt.onHit((_target, at) => this.onHit(at));
      } else this.goneAt = t;
    }

    this.bolts.update(dt);
    if (f.fired && this.goneAt < 0 && !this.bolts.busy) this.goneAt = t;

    // Once the arrow is gone the constellation holds a beat, then the lines snap and the stars fall.
    if (!f.snapped && this.goneAt >= 0 && t >= this.goneAt + SETTLE) {
      f.snapped = true;
      this.lines.snap(0.6);
      this.stars.fallAll(1, 0.5);
    }

    this.layout(dt);

    if ((f.snapped && t >= this.goneAt + SETTLE + 1.2) || t >= MAX_T) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  /** A hit: a star over the enemy, a gold line to the previous star, a cyan accent for 2 frames. */
  private onHit(at: THREE.Vector3) {
    const i = Math.min(this.hits, MAX_HITS - 1);
    this.starPts[i].set(at.x, STAR_Y, at.z);
    this.stars.add(this.starPts[i], 0.78);
    if (this.hits > 0 && this.hits < MAX_HITS) {
      this.lines.connect(this.starPts[i - 1], this.starPts[i], 0.1);
      // A small companion star halfway along the new line.
      this.v1.addVectors(this.starPts[i - 1], this.starPts[i]).multiplyScalar(0.5);
      this.v1.y += 0.45;
      this.stars.add(this.v1, 0.34, 0.05);
      this.lines.connect(this.starPts[i - 1], this.v1, 0.08, 0.04);
      this.lines.connect(this.v1, this.starPts[i], 0.08, 0.12);
    }
    this.popAge[i] = 0;
    if (this.hits === 0) this.shake = 0.15;
    this.hits++;
  }

  private layout(dt: number) {
    const t = this.time;

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
      if (this.popAge[i] > 5) continue;
      const sp = StarBurst.pop(this.popAge[i], 0.02, 0.04);
      this.pops[i].set(this.starPts[i], 0.95 * sp.scale, sp.opacity, i);
      this.popAge[i] += dt;
    }
    this.shake *= 0.85;
  }
}

export const starshotModule: EffectModule = {
  label: 'starshot',
  category: 'hero: astral',
  targeting: { mode: 'ground', radius: 1 },
  create: () => new Starshot(),
  telegraphs(effect) {
    const e = effect as Starshot;
    if (!e.ctx) return [];
    // Armed at the release, then shown until the arrow has flown its range; a bolt's hit is the dodge check, not the zone.
    return [{ shape: e.line, start: 0, impact: RELEASE_T, until: e.flightEnd }];
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
