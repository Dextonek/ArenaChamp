import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { BALLOON, BALLOON_CSS, Balloons, Bubbles, PopWords, Scraps } from '../../effects/parts/balloon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { BOMB_DAMAGE, BOMB_DELAY, BOMB_RADIUS } from '../../traits/balloon';

/**
 * Helium Bomb (balloon kit v5, W: a zone). A shiny pale-gold foil balloon is let go from Professor Puff's hand and floats to the aimed spot
 * (9 m) on a lazy arc in 0.4 s, then hangs 2.6 m above it, bobbing, with a dark shadow growing on the floor under it and a ring of soap
 * bubbles drifting in the 2.5 m circle. It swells from 0.7 m to twice that over the next 0.6 s, wobbling faster and flashing white in the last
 * third. At 1.0 s it POPS: a spiky star, a refraction ring the size of the zone, 18 torn rubber scraps fluttering down, a ring of bubbles and
 * the floating word POP, one short impact frame. Whoever stands inside 2.5 m at that moment (each enemy's live position, not a list from the
 * cast) takes 40 and is pushed out from the spot; the trait puts 3 Air on each hit.
 *
 * Telegraph: the real circle, 2.5 m, from the cast to the pop (1.0 s; its `impact` roots him until then). Clean by 2.2 s.
 * See pipeline/designs/kit-balloon.md.
 */
export interface HeliumBombSettings {
  damage: number;
  loop: boolean;
}

export const defaultHeliumBomb = (): HeliumBombSettings => ({ damage: BOMB_DAMAGE, loop: false });

// Timeline (seconds).
const FLOAT_T = 0.4;
const POP_T = BOMB_DELAY;
const DURATION = 2.2;
const HOVER_Y = 2.6;

export class HeliumBomb implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HeliumBombSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private popped = false;
  private idx = -1;
  private bubT = 0;

  private point = new THREE.Vector3(0, 0, -8);
  private hand = new THREE.Vector3();

  private balloons = new Balloons(2);
  private bubbles = new Bubbles(90);
  private scraps = new Scraps(30);
  private words = new PopWords(1);
  private star = new StarBurst({ points: 12, inner: 0.28, color: BALLOON.foil, core: 0xffffff, additive: false });
  private flare = new StarBurst({ points: 6, inner: 0.4, color: BALLOON.body, core: 0xffffff, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: BALLOON.dark, transparent: true, depthWrite: false, opacity: 0 }),
  );

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: HeliumBombSettings = defaultHeliumBomb()) {
    this.settings = settings;
    this.shadow.renderOrder = 1;
    this.screen.impactColor.set(BALLOON.hot);
    this.screen.tint.set(BALLOON.dark);
    this.group.add(this.shadow, this.balloons.mesh, this.bubbles.mesh, this.scraps.mesh, this.words.mesh, this.star.mesh, this.flare.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return POP_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.hand.set(ctx.from.x, 1.3, ctx.from.z);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(1.5);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.popped = false;
    this.idx = -1;
    this.bubT = 0;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(BALLOON.hot);
    this.screen.tint.set(BALLOON.dark);
    this.balloons.reset();
    this.bubbles.reset();
    this.scraps.reset();
    this.words.reset();
    this.star.set(this.point, 0, 0);
    this.flare.set(this.point, 0, 0);
    this.shock.set(this.point, 0, 0);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.balloons.update(dt);
    this.bubbles.update(dt);
    this.scraps.update(dt);
    this.words.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;

    // --- The balloon: let go from his hand, floats to the spot, hangs there and swells. ---
    if (this.idx === -1) {
      this.idx = this.balloons.place(this.hand, 'foil', 0.45);
      this.balloons.setBob(this.idx, 0.1);
    }
    if (!this.popped && this.idx >= 0) {
      const k = Math.min(1, t / FLOAT_T), e = 1 - Math.pow(1 - k, 3);
      this.v1.set(this.hand.x + (this.point.x - this.hand.x) * e, this.hand.y + (HOVER_Y - this.hand.y) * e + Math.sin(Math.PI * k) * 0.9, this.hand.z + (this.point.z - this.hand.z) * e);
      this.balloons.move(this.idx, this.v1);
      const swell = smoothstep((t - FLOAT_T) / (POP_T - FLOAT_T));
      this.balloons.setScale(this.idx, 0.45 + 0.25 * e + 0.7 * swell);
      this.balloons.jiggle(this.idx, 0.05 + 0.2 * swell * swell);
      // Flashes white faster and faster in the last third before the pop.
      const late = smoothstep((t - (POP_T - 0.35)) / 0.35);
      this.balloons.setFlash(this.idx, late * (0.5 + 0.5 * Math.sin(t * 44)) * 0.7);
      // The shadow on the floor grows with it.
      (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.32 * smoothstep(t / 0.3);
      this.shadow.position.set(this.point.x, 0.05, this.point.z);
      this.shadow.scale.setScalar(0.4 + 0.8 * swell + 0.2 * e);
      // A few bubbles drift up inside the circle while it hangs.
      if (t >= FLOAT_T * 0.6) {
        this.bubT += dt;
        if (this.bubT >= 0.09) {
          this.bubT = 0;
          const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * BOMB_RADIUS * 0.9;
          this.v2.set(this.point.x + Math.cos(a) * r, 0.3, this.point.z + Math.sin(a) * r);
          this.v1.set(0, 0.7 + Math.random() * 0.5, 0);
          this.bubbles.emit(this.v2, this.v1, 0.12, 0.26, 1.1, BALLOON.hot, 0, 0.5, 0.2);
        }
      }
    }

    // --- 1.0 The pop. ---
    if (!this.popped && t >= POP_T) {
      this.popped = true;
      this.pop(ctx);
    }
    if (this.popped) {
      const a = t - POP_T;
      this.screen.impact = impactFrameAt(t, POP_T, [1], 0.04);
      this.screen.darken = 0.2 * (1 - smoothstep(a / 0.5));
      const sp = StarBurst.pop(a, 0.04, 0.18);
      this.v1.set(this.point.x, HOVER_Y, this.point.z);
      this.star.set(this.v1, 3.3 * sp.scale, sp.opacity, a * 3);
      const fp = StarBurst.pop(a - 0.03, 0.02, 0.22);
      this.flare.set(this.v1, 4.6 * fp.scale, fp.opacity * 0.9, 0.4 - a);
      const g = smoothstep(a / 0.4);
      this.shock.set(this.v2.set(this.point.x, 0, this.point.z), 0.5 + BOMB_RADIUS * g, 0.05 * (1 - g) * (1 - g));
      (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - smoothstep(a / 0.25));
    }
    this.shake *= Math.exp(-dt * 9);
  }

  /** The pop: hit whoever stands in the circle now, and the whole snap. */
  private pop(ctx: CastContext | null) {
    const at = this.point;
    if (ctx) {
      // Re-check at impact: whoever stands in the circle now.
      for (const e of ctx.enemies?.() ?? ctx.targets) {
        const p = e.group.position;
        if (Math.hypot(p.x - at.x, p.z - at.z) <= BOMB_RADIUS) {
          ctx.hit(e, { damage: this.settings.damage, knock: 5, from: this.v2.set(at.x, 0, at.z).clone(), color: BALLOON_CSS.body });
        }
      }
    }
    if (this.idx >= 0) { this.balloons.hide(this.idx); this.idx = -2; }
    this.v1.set(at.x, HOVER_Y, at.z);
    this.scraps.burst(this.v1, 18, 6.5, 0.3, [BALLOON.foil, BALLOON.foil, BALLOON.body, 0xd9b84a]);
    this.bubbles.ring(this.v1, 10, 5, 0.5, 0.9, BALLOON.hot, 0);
    this.bubbles.ring(this.v1, 8, 4, 1.1, 0.7, BALLOON.hot, 1);
    this.v1.set(at.x, HOVER_Y + 0.4, at.z);
    this.words.show('POP', this.v1, 1.5, 1.1);
    this.shake = 0.38;
  }
}

export const heliumBombModule: EffectModule = {
  label: 'helium bomb',
  category: 'hero: balloon',
  targeting: { mode: 'ground', radius: BOMB_RADIUS },
  create: () => new HeliumBomb(),
  telegraphs(effect) {
    const e = effect as HeliumBomb;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: BOMB_RADIUS }, start: 0, impact: POP_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as HeliumBomb;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as HeliumBomb).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
