import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, flashBeat, impactFrameAt } from '../../effects/parts';
import { ASTRAL, ASTRAL_CSS, ConstellationLines, StarArrow, StarChart, StarPoints } from '../../effects/parts/astral';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { lyraMarks, type LyraMark } from '../../traits/astral';

/**
 * Meteor Mark (astral kit, R: mark, then strike). A star arrow climbs from her hand into the sky (0.35 s) and a large
 * four-point star hangs 12 m up, to the side of the enemy, tethered to them by a gold line; a parchment chart turns
 * under their feet. It follows them (smoothly, a step behind) for 1.5 s and swells with what she deals them. At 1.5 s
 * it FIXES: the spot is the enemy's position at that instant, the reticle collapses, a great chart draws on the spot
 * with a ring closing on its centre (and, from now, the module's circle telegraph), and the star lets go and falls
 * as a meteor (a star arrow with a long tail and a big head) from where it hung. At 2.4 s it lands: the hit is decided
 * by the enemy's live position against the fixed spot (1.8 m) and goes through `ctx.hit` with `projectile: true`
 * (the telegraph is decided late, so it cannot gate it): 135 plus 25% of the damage she dealt the marked enemy
 * meanwhile. The landing is an impact frame, a whiteout blink, a crater with a gold rim, a ground refraction ring,
 * a star burst, stars thrown outward and a constellation of eight spokes that holds, then snaps and falls. The tally
 * is `lyraMarks` (src/traits/astral.ts), opened at `play()` and closed just before the strike; where the trait does
 * not track (the other screen of a network duel) the strike is the flat 135. Clean by about 4.1 s, well inside the
 * duel's hit window (the hit lands at 2.4 s). See pipeline/designs/kit-astral.md.
 */
export interface MeteorMarkSettings {
  /** Damage of the strike before the tally. */
  base: number;
  /** Share of the damage dealt to the marked enemy meanwhile. */
  share: number;
  loop: boolean;
}

export const defaultMeteorMark = (): MeteorMarkSettings => ({ base: 120, share: 0.25, loop: false });

// Timeline (seconds).
const LOCK_T = 0.35; // the arrow reaches the sky, the star appears
const FIX_T = 1.5; // the spot is fixed
const STRIKE_T = 2.4; // the meteor lands
const END_T = 4.1;
const RADIUS = 1.8;
const SKY = 12;
const SLANT = 4;

export class MeteorMark implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MeteorMarkSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The spot, once fixed (the telegraph reads both). */
  readonly spot = new THREE.Vector3();
  fixed = false;
  private time = 0;
  private flags = { lock: false, strike: false, snapped: false };
  private owner: object | null = null;
  private mark: LyraMark | null = null;
  private hand = new THREE.Vector3(0, 1.4, 13);
  private sky = new THREE.Vector3(0, SKY, 0);
  private head = new THREE.Vector3(0, 1.9, 0);
  private feet = new THREE.Vector3();
  private lineId = -1;
  private right = new THREE.Vector3(1, 0, 0);

  private climb = new StarArrow();
  private meteor = new StarArrow();
  private stars = new StarPoints({ max: 40 });
  private lines = new ConstellationLines({ maxLines: 12, maxShards: 28 });
  private reticle = new StarChart({ color: ASTRAL.foil });
  private great = new StarChart({ color: ASTRAL.hot });
  private skyStar = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: ASTRAL.hot, core: ASTRAL.core, additive: false });
  private corona = new StarBurst({ points: 10, inner: 0.3, color: ASTRAL.accent, core: ASTRAL.core, additive: false });
  private meteorHead = new StarBurst({ points: 4, inner: 0.25, jitter: 0, color: ASTRAL.hot, core: ASTRAL.core, additive: false });
  private blast = new StarBurst({ points: 12, inner: 0.28, color: ASTRAL.accent, core: ASTRAL.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private closing = new THREE.Mesh(
    new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: ASTRAL.hot, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );
  private crater = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: ASTRAL.dark, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );
  private rim = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: ASTRAL.hot, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: MeteorMarkSettings = defaultMeteorMark()) {
    this.settings = settings;
    this.meteor.tailLength = 8;
    this.lines.widthScale = 1.6;
    this.crater.renderOrder = 1;
    this.rim.renderOrder = 2;
    this.closing.renderOrder = 3;
    this.screen.impactColor.set(ASTRAL.core);
    this.screen.tint.set(ASTRAL.dark);
    this.group.add(
      this.reticle.mesh, this.great.mesh, this.crater, this.rim, this.closing, this.lines.mesh, this.stars.mesh,
      this.climb.mesh, this.meteor.mesh, this.skyStar.mesh, this.corona.mesh, this.meteorHead.mesh, this.blast.mesh, this.shock.mesh,
    );
    this.reset();
  }

  get duration() {
    return END_T;
  }

  get impactTime() {
    return STRIKE_T;
  }

  get fixTime() {
    return FIX_T;
  }

  get strikeTime() {
    return STRIKE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.right.set(Math.cos(ctx.aim), 0, -Math.sin(ctx.aim));
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((t) => t.group)];
    this.follow();
    this.sky.set(this.feet.x + this.right.x * SLANT, SKY, this.feet.z + this.right.z * SLANT);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx, e = ctx?.targets[0];
    if (ctx && e) {
      // Open the mark at once: the trait counts what she deals them from now until the strike.
      this.owner = ctx.caster;
      this.mark = { live: true, target: e, tally: 0, tracked: false };
      lyraMarks.set(this.owner, this.mark);
    }
    if (ctx) {
      this.hand.set(ctx.caster.group.position.x, 1.4, ctx.caster.group.position.z);
      this.follow();
      this.sky.set(this.feet.x + this.right.x * SLANT, SKY, this.feet.z + this.right.z * SLANT);
      this.climb.fly(this.hand, this.sky, LOCK_T);
    }
  }

  private reset() {
    if (this.owner && lyraMarks.get(this.owner) === this.mark) {
      if (this.mark) this.mark.live = false;
      lyraMarks.delete(this.owner);
    }
    this.owner = null;
    this.mark = null;
    this.time = 0;
    this.shake = 0;
    this.fixed = false;
    this.lineId = -1;
    this.flags.lock = this.flags.strike = this.flags.snapped = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(ASTRAL.core);
    this.screen.tint.set(ASTRAL.dark);
    this.climb.reset();
    this.meteor.reset();
    this.stars.reset();
    this.lines.reset();
    this.reticle.reset();
    this.great.reset();
    this.skyStar.set(this.sky, 0, 0);
    this.corona.set(this.sky, 0, 0);
    this.meteorHead.set(this.sky, 0, 0);
    this.blast.set(this.feet, 0, 0);
    this.shock.set(this.feet, 0, 0);
    (this.closing.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.crater.material as THREE.MeshBasicMaterial).opacity = 0;
    (this.rim.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  /** Reads the marked enemy's feet and head from the live figure (the cast's point when there is none). */
  private follow() {
    const ctx = this.ctx;
    if (!ctx) return;
    const e = ctx.targets[0];
    const p = e ? e.group.position : ctx.point;
    this.feet.set(p.x, 0, p.z);
    this.head.set(p.x, 1.9, p.z);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.stars.update(dt);
    this.lines.update(dt);
    this.climb.update(dt);
    this.meteor.update(dt);
    this.time += dt;
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;

    // --- Following: until the spot is fixed the star and the reticle track the enemy's live position. ---
    if (!this.fixed) {
      this.follow();
      this.v1.set(this.feet.x + this.right.x * SLANT, SKY, this.feet.z + this.right.z * SLANT);
      if (t < LOCK_T) this.v1.copy(this.sky);
      this.sky.lerp(this.v1, 1 - Math.exp(-dt * 5));
    }

    // --- 0.35 The arrow arrives: the star appears and the tether draws down to the enemy. ---
    if (!f.lock && t >= LOCK_T) {
      f.lock = true;
      this.lineId = this.lines.connect(this.sky, this.head, 0.2);
      this.shake = 0.12;
    }

    // --- 1.5 Fix: the spot is where the enemy stands now; the star lets go and falls. ---
    if (!this.fixed && t >= FIX_T) {
      this.fixed = true;
      this.spot.copy(this.feet);
      this.shake = Math.max(this.shake, 0.2);
      this.v1.copy(this.sky);
      this.v2.set(this.spot.x, 0.4, this.spot.z);
      this.meteor.fly(this.v1, this.v2, STRIKE_T - FIX_T);
      if (this.lineId >= 0) this.lines.snap(0.35);
      this.lineId = -1;
    }

    // --- 2.4 Strike: the hit, decided by the live position against the fixed spot. ---
    if (!f.strike && t >= STRIKE_T) {
      f.strike = true;
      this.strike(ctx);
    }
    if (f.strike && !f.snapped && t >= STRIKE_T + 0.55) {
      f.snapped = true;
      this.lines.snap(0.55);
    }

    this.layout(dt);

    if (t >= END_T) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  private strike(ctx: CastContext | null) {
    const at = this.spot;
    const mark = this.mark;
    // The tally stops here: the strike's own hit must not count into it.
    if (mark) mark.live = false;
    const e = ctx?.targets[0];
    if (ctx && e) {
      const p = e.group.position;
      if (Math.hypot(p.x - at.x, p.z - at.z) <= RADIUS) {
        const extra = mark && mark.tracked ? this.settings.share * mark.tally : 0;
        ctx.hit(e, { damage: Math.round(this.settings.base + extra), knock: 5, from: new THREE.Vector3(at.x, 0, at.z), color: ASTRAL_CSS.hot, projectile: true });
      }
    }
    this.shake = 0.95;
    // Eight spokes of a constellation from the crater's centre, and stars thrown outward.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const r = RADIUS * (i % 2 ? 1.1 : 1.5);
      this.v1.set(at.x, 0.15, at.z);
      this.v2.set(at.x + Math.cos(a) * r, 0.15, at.z + Math.sin(a) * r);
      this.lines.connect(this.v1, this.v2, 0.14);
      const s = this.stars.add(this.v2, 0.34 + (i % 2) * 0.16);
      void s;
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 4;
      this.v1.set(at.x, 0.4, at.z);
      const id = this.stars.add(this.v1, 0.22 + Math.random() * 0.14);
      this.stars.fall(id, this.v2.set(Math.cos(a) * sp, 4 + Math.random() * 4, Math.sin(a) * sp), 0.9);
    }
  }

  private layout(dt: number) {
    const t = this.time;
    const at = this.spot;
    const tally = this.mark ? this.mark.tally : 0;

    // --- The hanging star: pops in, then breathes; it swells with the tally; it is gone when it falls. ---
    if (!this.fixed && t >= LOCK_T) {
      const born = StarBurst.pop(t - LOCK_T, 0.06, 1.2);
      const size = (1.1 + Math.min(0.9, tally / 150)) * Math.min(1, smoothstep((t - LOCK_T) / 0.12) * 1.2);
      this.skyStar.set(this.sky, size * (1 + 0.08 * Math.sin(t * 9)), 1, t * 0.8);
      this.corona.set(this.sky, size * 1.5 * (0.9 + 0.1 * Math.sin(t * 6)), 0.5 * (born.opacity > 0 ? 1 : 0), -t * 0.5);
      // The tether and the reticle follow the enemy.
      if (this.lineId >= 0) this.lines.move(this.lineId, this.sky, this.head);
      this.reticle.set(this.feet, 1.15);
      this.reticle.reveal = smoothstep((t - 0.15) / 0.3);
      this.reticle.opacity = 0.9;
      this.reticle.spin = t * 2.2;
    } else if (this.fixed) {
      this.skyStar.set(this.sky, 0, 0);
      this.corona.set(this.sky, 0, 0);
      this.reticle.opacity = Math.max(0, this.reticle.opacity - dt * 9);
    }

    // --- The fixed spot: the great chart draws on, a ring closes on its centre. ---
    if (this.fixed) {
      const a = t - FIX_T, k = Math.min(1, a / (STRIKE_T - FIX_T));
      this.great.set(at, RADIUS * 1.12);
      this.great.reveal = smoothstep(a / 0.2);
      this.great.opacity = (0.55 + 0.45 * k) * (t < STRIKE_T ? 1 : Math.max(0, 1 - (t - STRIKE_T) / 0.5));
      this.great.spin = -a * 1.5;
      const cm = this.closing.material as THREE.MeshBasicMaterial;
      this.closing.position.set(at.x, 0.07, at.z);
      this.closing.scale.setScalar(Math.max(0.05, RADIUS * (1 - smoothstep(k))));
      cm.opacity = t < STRIKE_T ? 0.9 : 0;
    }

    // --- The meteor: a big head on the arrow, with stars shed along its fall. ---
    if (this.meteor.active && t < STRIKE_T) {
      const p = this.meteor.position;
      const grow = 1.2 + 1.6 * this.meteor.progress;
      this.meteorHead.set(p, grow, 1, t * 3);
      if (Math.random() < 0.6) {
        const id = this.stars.add(this.v2.set(p.x, p.y, p.z), 0.18 + Math.random() * 0.12);
        this.stars.fall(id, this.v1.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2), 0.5);
      }
    } else if (t >= STRIKE_T) this.meteorHead.set(at, 0, 0);

    // --- The landing: impact frame, a whiteout blink, the burst, the refraction ring, the crater. ---
    if (this.flags.strike) {
      const a = t - STRIKE_T;
      this.screen.impact = impactFrameAt(t, STRIKE_T, [2, 1], 0.04);
      const fb = flashBeat(t, STRIKE_T + 0.08, 0.04, 0.3, 0);
      this.screen.exposure = fb.exposure;
      this.screen.whiteout = 0.7 * fb.whiteout;
      this.screen.darken = 0.35 * (1 - smoothstep((a - 0.2) / 0.9));
      const bp = StarBurst.pop(a - 0.08, 0.03, 0.2);
      this.blast.set(this.v1.set(at.x, 1.3, at.z), 4.2 * bp.scale, bp.opacity, a);
      const g = smoothstep(a / 0.55);
      this.shock.set(this.v1.set(at.x, 0, at.z), 0.5 + 5.2 * g, 0.055 * (1 - g) * (1 - g));
      const cr = this.crater.material as THREE.MeshBasicMaterial, rm = this.rim.material as THREE.MeshBasicMaterial;
      const grow = smoothstep(a / 0.15);
      this.crater.position.set(at.x, 0.045, at.z);
      this.crater.scale.setScalar(RADIUS * 0.95 * grow);
      cr.opacity = 0.8 * (1 - smoothstep((a - 1.1) / 0.5));
      this.rim.position.set(at.x, 0.06, at.z);
      this.rim.scale.setScalar(RADIUS * (0.6 + 0.4 * grow));
      rm.opacity = 0.95 * (1 - smoothstep((a - 0.2) / 1.1));
      this.stars.opacity = 1;
    }
    this.shake *= Math.exp(-dt * 9);
  }
}

export const meteorMarkModule: EffectModule = {
  label: 'meteor mark',
  category: 'hero: astral',
  targeting: { mode: 'enemy' },
  create: () => new MeteorMark(),
  telegraphs(effect) {
    const e = effect as MeteorMark;
    // The spot is decided at 1.5 s, so no zone exists before then; the strike's hit is a `projectile` hit.
    if (!e.ctx || !e.fixed) return [];
    return [{ shape: { kind: 'circle', x: e.spot.x, z: e.spot.z, radius: RADIUS }, start: e.fixTime, impact: e.strikeTime }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.45, threshold: 0.84 },
  frameCamera(camera, controls, effect) {
    const e = effect as MeteorMark;
    if (e.ctx) frameCast(camera, controls, e.ctx, 9);
  },
  buildGui(f, effect) {
    const s = (effect as MeteorMark).settings;
    f.add(s, 'loop');
    f.add(s, 'base', 1, 300, 1);
    f.add(s, 'share', 0, 1, 0.05);
  },
};
