import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, HaloRing, LightBeams, LightPanels, Sigil, SunEmblems, SunRays, dawnEaseOutBack, dawnOrient, dawnShieldRing, dawnView,
} from '../../effects/parts/dawn';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { R_BURST, R_RING_RADIUS, R_RING_SECONDS, R_SHIELD_SECONDS, aurielShields, burstHit, type AurielShield } from '../../traits/dawn';

/**
 * Sunrise (dawn kit v5, R: the biggest shield, then a fixed ring). Auriel rises on a column of light: a sun disc as big as a
 * door opens behind her, a halo crowns her, eight kite shields of hard light turn round her and six feather plates circle
 * above them, a sun-wheel sigil turns under her feet (she floats: the figure itself stays on the ground, as the engine keeps
 * hits on the ground; the look is what lifts). The shield (200 for 5 s, recast Pop) is the trait's (`src/traits/dawn.ts`); the
 * effect draws it and watches the trait's `aurielShields` record. When the record says it ended (broken, run out, popped)
 * the shields shatter and a RING appears FIXED at the spot she stands on at that moment: a dark amber floor of 5 m radius with
 * a gold sun-wheel, a gold disc that closes over 1.6 s (`R_RING_SECONDS`), a bright ring that shrinks with it, twelve pillars
 * of light on its rim, and the screen dims. She can walk away; the ring does not follow. At the end of the 1.6 s it bursts for
 * 120 on every enemy inside 5 m on its live position (`projectile: true`; the ring on the floor is the warning, no telegraph can
 * carry a spot chosen at the end of the shield), with one impact frame. A branded enemy caught in it is stunned 0.8 s by the
 * trait. The cast is up to about 7.9 s old at the burst: the server allows hits for 12 s. Where the trait gives no record
 * (the VFX tool) the shield ends after 5 s on its own. If another record replaces it the shields crumble, no ring.
 * See pipeline/designs/kit-dawn.md.
 */
export interface SunriseSettings {
  /** Damage of the ring's burst. */
  damage: number;
  loop: boolean;
}

export const defaultSunrise = (): SunriseSettings => ({ damage: R_BURST, loop: false });

// Timeline (seconds).
const RISE = 0.5; // the shields are whole
const STANDALONE = R_SHIELD_SECONDS + 0.05; // no trait record: the shield ends here
const BURST_LIFE = 0.9; // clean this long after the burst
const CAP = 9.4; // hard end, whatever the record says

const SHIELDS = 8;
const FEATHERS = 6;
const SPARKS = 12;
const PILLARS = 12;
const COLUMN = PILLARS; // the light column behind her shares the pillar pool
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

export class Sunrise implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SunriseSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private rec: AurielShield | null = null;
  /** When the shield ended and the ring appeared (-1: not yet), and the ring's fixed centre. */
  private ringT = -1;
  private crumbleT = -1;
  private burst = false;
  private struck = false;
  private center = new THREE.Vector3();
  private ringAt = new THREE.Vector3();
  private view = new THREE.Vector3(0, 0.45, 0.9);
  private flat = new THREE.Vector3(0, 0, 1);

  // Parts.
  private panels = new LightPanels(SHIELDS + FEATHERS + SPARKS, 6);
  private sigil = new Sigil();
  private ringSigil = new Sigil();
  private halo = new HaloRing();
  private rim = new HaloRing();
  private closing = new HaloRing();
  private emblem = new SunEmblems(1);
  private pillars = new LightBeams(PILLARS + 1);
  private rays = new SunRays(18, 0.5);
  private floor: THREE.Mesh;
  private fill: THREE.Mesh;
  private flare = new StarBurst({ points: 12, inner: 0.25, color: DAWN.hot, core: DAWN.core, additive: false });
  private star = new StarBurst({ points: 10, inner: 0.3, color: DAWN.accent, core: DAWN.accent, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();

  constructor(settings: SunriseSettings = defaultSunrise()) {
    this.settings = settings;
    this.screen.tint.set(DAWN.dark);
    this.screen.impactColor.set(DAWN.foil);
    this.rays.normal.set(0, 1, 0);
    const disc = (c: number, order: number) => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
      );
      m.renderOrder = order;
      m.visible = false;
      return m;
    };
    // The ring's floor: a dark amber disc, and a gold disc closing on top of it.
    this.floor = disc(DAWN.dark, 1);
    this.fill = disc(DAWN.body, 1.5);
    this.group.add(
      this.floor, this.fill, this.sigil.mesh, this.ringSigil.mesh, this.panels.mesh, this.halo.mesh, this.rim.mesh, this.closing.mesh,
      this.emblem.mesh, this.pillars.mesh, this.rays.mesh, this.flare.mesh, this.star.mesh, this.shock.mesh,
    );
    this.reset();
  }

  get duration() {
    return STANDALONE + R_RING_SECONDS + BURST_LIFE;
  }

  get impactTime() {
    return STANDALONE + R_RING_SECONDS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.from).setY(0);
    dawnView(ctx.aim, this.view);
    this.flat.set(this.view.x, 0, this.view.z).normalize();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.center).setY(1.4);
  }

  play() {
    this.reset();
    this.playing = true;
    this.rec = this.current();
    this.layout(0);
    this.panels.assemble(RISE, 0.25, 6);
  }

  /** The trait's record when it is a live Sunrise. */
  private current(): AurielShield | null {
    const r = this.ctx ? aurielShields.get(this.ctx.caster) : undefined;
    return r && r.kind === 3 && !r.broke ? r : null;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.ringT = this.crumbleT = -1;
    this.burst = this.struck = false;
    this.rec = null;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(DAWN.foil);
    this.panels.reset();
    this.sigil.reset();
    this.ringSigil.reset();
    this.halo.reset();
    this.rim.reset();
    this.closing.reset();
    this.emblem.reset();
    this.pillars.reset();
    this.rays.reset();
    this.floor.visible = this.fill.visible = false;
    this.flare.set(this.center, 1e-3, 0);
    this.star.set(this.center, 1e-3, 0);
    this.shock.set(this.center, 0, 0);
  }

  private get endAt() {
    if (this.ringT >= 0) return Math.min(CAP, this.ringT + R_RING_SECONDS + BURST_LIFE);
    if (this.crumbleT >= 0) return Math.min(CAP, this.crumbleT + 0.7);
    return CAP;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.endAt) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const c = this.ctx?.caster.group.position;
    if (c && this.ringT < 0) this.center.set(c.x, 0, c.z);
    if (this.ringT < 0 && this.crumbleT < 0) this.watch();
    // The ring's burst comes when it has closed.
    if (this.ringT >= 0 && !this.burst && this.time >= this.ringT + R_RING_SECONDS) this.explode();
    this.layout(dt);
    this.panels.update(dt);
    this.shake *= Math.exp(-dt * 9);
  }

  /** The shield's end: the trait's record says broke (a replacement ends it with no ring), or the standalone timer. */
  private watch() {
    const ctx = this.ctx;
    if (!ctx) return;
    // The other screen may hear of the record a moment after the cast.
    if (!this.rec && this.time < 0.8) this.rec = this.current();
    if (this.rec) {
      const cur = aurielShields.get(ctx.caster);
      if (cur !== this.rec) this.crumble();
      else if (cur.broke) this.openRing();
    } else if (this.time >= STANDALONE) this.openRing();
  }

  private crumble() {
    this.crumbleT = this.time;
    this.panels.shatter(3, 0.6, this.center);
  }

  /** The shield is gone: the shields shatter and the ring appears where she stands now, fixed. */
  private openRing() {
    this.ringT = this.time;
    this.ringAt.copy(this.center);
    this.shake = 0.3;
    this.panels.shatter(6, 1.0, this.ringAt);
    this.screen.focus.copy(this.ringAt).setY(0.5);
  }

  /** The ring has closed: everyone inside 5 m, on their live positions, takes the hit. */
  private explode() {
    const ctx = this.ctx;
    this.burst = true;
    this.shake = 0.7;
    // Shards thrown out of the middle in a ring.
    for (let k = 0; k < SPARKS; k++) {
      const a = (k / SPARKS) * Math.PI * 2 + 0.2;
      this.v1.set(this.ringAt.x + Math.sin(a) * 0.8, 0.8, this.ringAt.z + Math.cos(a) * 0.8);
      dawnOrient(this.v2.set(Math.sin(a), 0, Math.cos(a)), UP, this.q1);
      this.panels.place(SHIELDS + FEATHERS + k, this.v1, this.q1, 1.1, 'shard', 1.2, k % 2 ? DAWN.hot : DAWN.body);
      this.panels.fling(SHIELDS + FEATHERS + k, this.v2.multiplyScalar(8 + (k % 3) * 1.5).setY(3.5), 0.9, 8);
    }
    if (!ctx) return;
    for (const e of ctx.targets) {
      const p = e.group.position;
      if (Math.hypot(p.x - this.ringAt.x, p.z - this.ringAt.z) > R_RING_RADIUS) continue;
      burstHit(ctx, e, { damage: this.settings.damage, knock: 7, from: this.ringAt.clone(), color: DAWN_CSS.body });
      this.struck = true;
    }
    if (!this.struck) this.shake = 0.45;
  }

  private layout(dt: number) {
    const t = this.time;
    const c = this.center;
    const standing = this.ringT < 0 && this.crumbleT < 0;

    if (standing) {
      const grow = smoothstep(t / RISE);
      // Anticipation: in the last half second of the shield everything shivers.
      const shiver = t > STANDALONE - 0.55 ? 0.06 * Math.sin(t * 46) : 0;
      const bob = 0.1 * Math.sin(t * 2.2);
      dawnShieldRing(this.panels, 0, SHIELDS, c, 1.55 + shiver, 1.5 + bob, 2.3 * (0.4 + 0.6 * grow), t * 1.1, 1.25);
      // Six feather plates circle above the shields, the other way round.
      for (let i = 0; i < FEATHERS; i++) {
        const a = -t * 1.7 + (i / FEATHERS) * Math.PI * 2;
        this.v2.set(Math.sin(a), 0, Math.cos(a));
        this.v1.set(c.x + this.v2.x * (0.9 + shiver), 2.7 + bob + 0.15 * Math.sin(t * 3 + i), c.z + this.v2.z * (0.9 + shiver));
        dawnOrient(this.v2, UP, this.q1);
        this.panels.place(SHIELDS + i, this.v1, this.q1, 1.2 * (0.4 + 0.6 * grow), 'feather', 1, i % 2 ? DAWN.foil : DAWN.hot);
      }
      // The sun-wheel under her feet, a gold ring round it, a halo crowning her, and a door-sized sun disc behind her.
      this.sigil.set(c, 2.8);
      this.sigil.hide = 0.35;
      this.sigil.reveal = grow;
      this.sigil.opacity = 0.7;
      this.rim.set(this.v1.set(c.x, 0.07, c.z), UP, 2.4);
      this.rim.opacity = 0.8 * grow;
      this.rim.spin(dt);
      this.halo.set(this.v1.set(c.x, 3.25 + bob, c.z), this.view, 0.9);
      this.halo.opacity = grow;
      this.halo.spin(dt);
      this.v1.set(c.x, 2.0 + bob, c.z).addScaledVector(this.view, -1.1);
      dawnOrient(this.view, UP, this.q1);
      this.q1.multiply(this.q2.setFromAxisAngle(Z, t * 0.4));
      this.emblem.opacity = 0.9;
      this.emblem.set(0, this.v1, this.q1, 3.6 * dawnEaseOutBack(t / 0.6));
      // A faint column of light under the disc: she is carried on it.
      this.pillars.opacity = 0.55 * grow;
      this.pillars.bright = 1.2;
      this.pillars.set(COLUMN, this.v1.set(c.x, 2.2, c.z).addScaledVector(this.view, -0.6), UP, this.flat, 5, 0.5);
      return;
    }

    // After the end: the figure's decorations go out.
    this.emblem.hide(0);
    this.halo.opacity = 0;
    this.rim.opacity = 0;
    this.pillars.hide(COLUMN);
    const since = t - (this.ringT >= 0 ? this.ringT : this.crumbleT);
    this.sigil.opacity = 0.7 * (1 - smoothstep(since / 0.3));
    if (this.ringT < 0) return;

    // --- The ring: fixed at the spot, closing over 1.6 s. ---
    const a = t - this.ringT;
    const k = THREE.MathUtils.clamp(a / R_RING_SECONDS, 0, 1);
    const appear = smoothstep(a / 0.12);
    const R = R_RING_RADIUS;
    const open = !this.burst;
    if (open) {
      const blink = a > R_RING_SECONDS - 0.4 ? 0.5 + 0.5 * Math.sin(t * 36) : 1;
      this.floor.visible = this.fill.visible = true;
      this.floor.position.set(this.ringAt.x, 0.03, this.ringAt.z);
      this.floor.scale.setScalar(R);
      (this.floor.material as THREE.MeshBasicMaterial).opacity = 0.5 * appear;
      this.fill.position.set(this.ringAt.x, 0.045, this.ringAt.z);
      this.fill.scale.setScalar(Math.max(1e-3, R * (1 - k)));
      (this.fill.material as THREE.MeshBasicMaterial).opacity = (0.3 + 0.25 * k) * appear * blink;
      // The sun-wheel counts down on the floor: it fills clockwise as the disc closes.
      this.ringSigil.set(this.ringAt, R);
      this.ringSigil.hide = 0.05;
      this.ringSigil.reveal = Math.max(0.02, k);
      this.ringSigil.opacity = 0.9 * appear;
      // The rim stays fixed; a second bright ring shrinks with the disc.
      this.rim.set(this.v1.set(this.ringAt.x, 0.08, this.ringAt.z), UP, R);
      this.rim.opacity = appear * blink;
      this.rim.spin(dt);
      this.closing.set(this.v1.set(this.ringAt.x, 0.1, this.ringAt.z), UP, Math.max(0.3, R * (1 - k)));
      this.closing.opacity = appear;
      this.closing.spin(-dt);
      // Twelve pillars of light stand on the rim and grow as the time runs out.
      this.pillars.opacity = appear;
      this.pillars.bright = 1.4 + 1.6 * k;
      const h = 2.2 + 3.4 * k;
      for (let i = 0; i < PILLARS; i++) {
        const ang = (i / PILLARS) * Math.PI * 2;
        this.v1.set(this.ringAt.x + Math.sin(ang) * R, h * 0.5, this.ringAt.z + Math.cos(ang) * R);
        this.pillars.set(i, this.v1, UP, this.flat, h * (0.85 + 0.15 * Math.sin(t * 7 + i * 1.7)), 0.28);
      }
      this.screen.darken = 0.3 * appear;
      this.screen.focus.copy(this.ringAt).setY(0.5);
      return;
    }

    // --- The burst: the disc is gone, a flash runs out past the rim, rays, a star, an impact frame. ---
    const b = t - (this.ringT + R_RING_SECONDS);
    this.fill.visible = false;
    const fadeB = 1 - smoothstep(b / 0.5);
    this.floor.position.set(this.ringAt.x, 0.03, this.ringAt.z);
    (this.floor.material as THREE.MeshBasicMaterial).opacity = 0.5 * fadeB;
    this.ringSigil.opacity = 0.9 * (1 - smoothstep(b / 0.4));
    this.ringSigil.reveal = 1;
    this.rim.set(this.v1.set(this.ringAt.x, 0.08, this.ringAt.z), UP, R + 0.8 * smoothstep(b / 0.25));
    this.rim.opacity = 1 - smoothstep((b - 0.1) / 0.45);
    this.rim.spin(dt);
    this.closing.set(this.v1.set(this.ringAt.x, 0.1, this.ringAt.z), UP, 0.3 + (R - 0.3) * (1 - Math.pow(1 - THREE.MathUtils.clamp(b / 0.22, 0, 1), 3)));
    this.closing.opacity = 1 - smoothstep((b - 0.1) / 0.4);
    this.closing.spin(dt);
    this.pillars.opacity = 1 - smoothstep(b / 0.35);
    this.pillars.bright = 3.2;
    for (let i = 0; i < PILLARS; i++) {
      const ang = (i / PILLARS) * Math.PI * 2;
      this.v1.set(this.ringAt.x + Math.sin(ang) * R, 4, this.ringAt.z + Math.cos(ang) * R);
      this.pillars.set(i, this.v1, UP, this.flat, 8 + 2 * smoothstep(b / 0.15), 0.4 * (1 - smoothstep(b / 0.35)) + 0.01);
    }
    this.rays.normal.set(0, 1, 0);
    this.rays.fan(this.v1.set(this.ringAt.x, 0.12, this.ringAt.z), this.v2.set(0, 0, 1), 18, R * 1.05, Math.PI, smoothstep(b / 0.16), 0.5);
    this.rays.fade(1 - smoothstep((b - 0.1) / 0.4));
    const sp = StarBurst.pop(b, 0, 0.08);
    this.flare.set(this.v1.set(this.ringAt.x, 1.5, this.ringAt.z), 3.4 * sp.scale + 1e-3, sp.opacity, 0.2);
    this.star.set(this.v1.set(this.ringAt.x, 1.5, this.ringAt.z), 2.0 * sp.scale + 1e-3, sp.opacity, 0.5);
    const gp = THREE.MathUtils.clamp(b / 0.4, 0, 1);
    this.shock.set(this.v1.set(this.ringAt.x, 0, this.ringAt.z), 0.5 + 5.2 * gp, 0.06 * (1 - gp) * (1 - gp));
    this.screen.impact = impactFrameAt(b, 0, [1, 2], 0.04);
    this.screen.darken = 0.3 * (1 - smoothstep(b / 0.4));
  }
}

export const sunriseModule: EffectModule = {
  label: 'sunrise',
  category: 'hero: dawn',
  // Centred on Auriel. The radius is large on purpose: `targets` is frozen at the cast, and the ring bursts 5 to 8 s later, so
  // every enemy that might stand in it then must be in it. The duel AI is held back by the trait's `aiHold` (8 m).
  targeting: { mode: 'self', radius: 30 },
  create: () => new Sunrise(),
  // No zone: the ring appears where she stands when the shield ends (`projectile: true`); the ring on the floor is the warning.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as Sunrise;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as Sunrise).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 250, 1);
  },
};
