import * as THREE from 'three';
import { boltWidth } from '../../effects/projectile';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { CrescentArc, ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { ASTRAL, ASTRAL_CSS, ConstellationLines, StarPoints } from '../../effects/parts/astral';
import { BoltSet, type BoltLook } from '../../effects/parts/bolt';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { lyraDraws } from '../../traits/astral';

/**
 * Starfall Arrow (astral kit, Q: held skillshot). The trait's hold charges it while it is aimed (1 s) and passes the
 * draw to `lyraDraws` (keyed by her figure); `cast()` reads it. The draw sets the range (9 to 14 m), the bow, the
 * arrow's size and, at full draw, the pierce; the damage scale (35 to 70) travels as the cast's power, so `damage`
 * here is the full draw's 85. A gold crescent bow and string draw on, a flare at the nock, and at 0.3 s the arrow
 * leaves as a skillshot (`ctx.projectile`). Where it flew, small stars drop onto the line every 2 m; once it is
 * gone the constellation lines join them, hold a beat, then snap and the stars fall. A hit pops a cyan-edged star
 * (a full draw adds an impact frame and a ground ring). Without a trait entry (the other screen of a network duel)
 * it flies the full draw. Clean by about 3 s. See pipeline/designs/kit-astral.md.
 */
export interface StarfallArrowSettings {
  /** Damage at power 1 (a full draw; a loose string is half through the cast's power). */
  damage: number;
  loop: boolean;
}

export const defaultStarfallArrow = (): StarfallArrowSettings => ({ damage: 62, loop: false });

// Timeline (seconds).
const BOW_END = 0.24;
const RELEASE_T = 0.3;
const SPEED = 26;
const MIN_RANGE = 9;
const MAX_RANGE = 14;
const MUZZLE = 0.8;
const SETTLE = 0.45;
const MAX_T = 3.2;
const STAR_GAP = 2;
const MAX_MARKS = 7;

export class StarfallArrow implements Effect {
  readonly group = new THREE.Group();
  readonly settings: StarfallArrowSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The arrow's line, caster to its range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: boltWidth(0.4) };
  /** The draw this cast carries, 0..1. */
  charge = 1;
  private time = 0;

  private fwd = new THREE.Vector3(0, 0, -1);
  private hand = new THREE.Vector3(0, 1.4, 13);
  private bowPos = new THREE.Vector3(0, 1.55, 12);
  private range = MAX_RANGE;
  private flags = { fired: false, joined: false, snapped: false };
  private goneAt = -1;
  private hitAt = -1;
  private hitPos = new THREE.Vector3();
  private bolt: ReturnType<NonNullable<CastContext['projectile']>> | null = null;
  private marks: THREE.Vector3[] = [];
  private lastMark = 0;

  private bowPivot = new THREE.Group();
  private bow = new CrescentArc({ radius: 0.75, width: 0.16, sweep: Math.PI * 0.9, style: 'toon', edge: ASTRAL.core, mid: ASTRAL.hot, outer: ASTRAL.body });
  private string = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.07),
    new THREE.MeshBasicMaterial({ color: ASTRAL.hot, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );
  private bolts = new BoltSet(this.group);
  private stars = new StarPoints({ max: 24 });
  private lines = new ConstellationLines({ maxLines: MAX_MARKS + 2 });
  private pop = new StarBurst({ points: 10, inner: 0.3, color: ASTRAL.accent, core: ASTRAL.core, additive: false });
  private nock = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: ASTRAL.hot, core: ASTRAL.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: ASTRAL.hot, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }),
  );

  private look: BoltLook = { core: ASTRAL_CSS.core, body: ASTRAL_CSS.hot, rim: ASTRAL_CSS.body, size: 0.5, trail: 4, hit: ASTRAL_CSS.accent };
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();
  private v1 = new THREE.Vector3();

  constructor(settings: StarfallArrowSettings = defaultStarfallArrow()) {
    this.settings = settings;
    this.lines.widthScale = 1.5;
    for (let i = 0; i < MAX_MARKS; i++) this.marks.push(new THREE.Vector3());
    // The bow: a gold toon crescent on a camera-facing pivot with the string across its chord (as in the old Starshot).
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
    this.ring.renderOrder = 3;
    this.group.add(this.bowPivot, this.lines.mesh, this.stars.mesh, this.pop.mesh, this.nock.mesh, this.shock.mesh, this.ring);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return RELEASE_T;
  }

  /** When the arrow has flown its full range (the telegraph stays drawn until then). */
  get flightEnd() {
    return RELEASE_T + this.range / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const draw = lyraDraws.get(ctx.caster);
    this.charge = draw ? Math.min(1, Math.max(0, draw.charge)) : 1;
    this.range = MIN_RANGE + (MAX_RANGE - MIN_RANGE) * this.charge;
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(this.fwd, 0.55).setY(1.4);
    this.bowPos.copy(ctx.from).addScaledVector(this.fwd, 0.95).setY(1.55);
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.fwd.x * this.range, z2: ctx.from.z + this.fwd.z * this.range,
      width: boltWidth(0.4 + 0.1 * this.charge),
    };
    this.bowPivot.position.copy(this.bowPos);
    this.bowPivot.scale.setScalar(0.75 + 0.35 * this.charge);
    this.look.size = 0.36 + 0.2 * this.charge;
    this.look.trail = 2.6 + 2.6 * this.charge;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.impactColor.set(ASTRAL.hot);
    // The trait's entry is spent: a cast must not read the last one.
    lyraDraws.delete(ctx.caster);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.fired = this.flags.joined = this.flags.snapped = false;
    this.goneAt = this.hitAt = -1;
    this.bolt = null;
    this.lastMark = 0;
    this.marks.forEach((m, i) => m.set(0, 0, i));
    clearScreenFx(this.screen);
    this.bolts.clear();
    this.stars.reset();
    this.lines.reset();
    this.bow.opacity = 0;
    (this.string.material as THREE.MeshBasicMaterial).opacity = 0;
    this.string.visible = false;
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0;
    this.pop.set(this.hand, 0, 0);
    this.nock.set(this.hand, 0, 0);
    this.shock.set(this.hand, 0, 0);
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

    // --- Release: the arrow leaves along the aim line. A network duel has no bolts on the caster's own screen. ---
    if (!f.fired && t >= RELEASE_T) {
      f.fired = true;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: ctx.from.clone().addScaledVector(this.fwd, MUZZLE), dir: this.fwd.clone(), speed: SPEED, range: this.range - MUZZLE,
          radius: 0.4 + 0.1 * this.charge, pierce: this.charge >= 0.99,
          hit: { damage: this.settings.damage, knock: 2 + 2 * this.charge, color: ASTRAL_CSS.hot },
        });
        this.bolts.follow(this.bolt, this.look);
        this.bolt.onHit((_target, at) => this.onHit(at));
      } else this.goneAt = t;
    }

    // Stars drop onto the line behind the flying arrow.
    if (this.bolt && this.lastMark < MAX_MARKS) {
      const travelled = this.bolt.pos.distanceTo(ctx!.from);
      while (this.lastMark < MAX_MARKS && travelled > MUZZLE + STAR_GAP * (this.lastMark + 1) && this.bolt.alive) {
        const m = this.marks[this.lastMark];
        m.copy(ctx!.from).addScaledVector(this.fwd, MUZZLE + STAR_GAP * (this.lastMark + 1)).setY(1.1);
        this.stars.drop(m, 0.3 + 0.12 * this.charge, 2.2, 0.28);
        this.lastMark++;
      }
    }

    this.bolts.update(dt);
    if (f.fired && this.goneAt < 0 && !this.bolts.busy) this.goneAt = t;

    // Gone: the lines join the fallen stars in order, hold a beat, then snap and the stars fall.
    if (!f.joined && this.goneAt >= 0 && t >= this.goneAt) {
      f.joined = true;
      for (let i = 0; i < this.lastMark - 1; i++) this.lines.connect(this.marks[i], this.marks[i + 1], 0.12, i * 0.05);
    }
    if (!f.snapped && this.goneAt >= 0 && t >= this.goneAt + SETTLE) {
      f.snapped = true;
      this.lines.snap(0.6);
      this.stars.fallAll(1, 0.5);
    }

    this.layout();

    if ((f.snapped && t >= this.goneAt + SETTLE + 1.1) || t >= MAX_T) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
    }
  }

  /** A hit: a cyan-edged star on the enemy; a full draw adds an impact frame and a ground ring. */
  private onHit(at: THREE.Vector3) {
    if (this.hitAt < 0) this.hitAt = this.time;
    this.hitPos.set(at.x, 1.2, at.z);
    this.stars.add(this.hitPos, 0.7 + 0.2 * this.charge);
    this.shake = Math.max(this.shake, 0.12 + 0.2 * this.charge);
  }

  private layout() {
    const t = this.time;
    const c = this.charge;

    // --- 0..0.3 The bow draws on with its string, then fades at the release. ---
    this.bowPivot.position.copy(this.bowPos);
    this.bow.head = smoothstep(t / 0.2);
    this.bow.length = 1;
    this.bow.erosion = 0;
    this.bow.time = t;
    const bowA = t < BOW_END ? 1 : 1 - smoothstep((t - BOW_END) / 0.12);
    this.bow.opacity = bowA;
    const sm = this.string.material as THREE.MeshBasicMaterial;
    sm.opacity = bowA * smoothstep((t - 0.06) / 0.1);
    this.string.visible = sm.opacity > 0.01;

    // --- The nock: a star swells on the string with the draw and flashes out at the release. ---
    const swell = t < RELEASE_T ? smoothstep(t / RELEASE_T) : 0;
    const flash = StarBurst.pop(t - RELEASE_T, 0, 0.03);
    this.nock.set(this.hand, (0.3 + 0.35 * c) * swell + (0.7 + 0.5 * c) * flash.scale, swell * 0.9 + flash.opacity, t * 3);

    // --- Hit: the cyan accent, and for a full draw an impact frame and a ground ring. ---
    if (this.hitAt >= 0) {
      const a = t - this.hitAt;
      const sp = StarBurst.pop(a, 0.02, 0.05);
      this.pop.set(this.hitPos, (0.9 + 0.4 * c) * sp.scale, sp.opacity, 0.2);
      if (c >= 0.99) {
        this.screen.impact = impactFrameAt(t, this.hitAt, [1], 0.03);
        const g = smoothstep(a / 0.4);
        this.shock.set(this.v1.set(this.hitPos.x, 0, this.hitPos.z), 0.4 + 2.2 * g, 0.03 * (1 - g) * (1 - g));
        const rm = this.ring.material as THREE.MeshBasicMaterial;
        this.ring.position.set(this.hitPos.x, 0.06, this.hitPos.z);
        this.ring.scale.setScalar(0.5 + 2 * g);
        rm.opacity = 0.9 * (1 - g);
      }
    }
    this.shake *= 0.85;
  }
}

export const starfallArrowModule: EffectModule = {
  label: 'starfall arrow',
  category: 'hero: astral',
  targeting: { mode: 'ground', radius: 1 },
  create: () => new StarfallArrow(),
  telegraphs(effect) {
    const e = effect as StarfallArrow;
    if (!e.ctx) return [];
    // Armed at the release, shown until the arrow has flown its range; a bolt's hit is the dodge check, not the zone.
    return [{ shape: e.line, start: 0, impact: RELEASE_T, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as StarfallArrow;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as StarfallArrow).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
