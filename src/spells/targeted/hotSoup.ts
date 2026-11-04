import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { CHEF, CHEF_CSS, Chunks, POT_RADIUS, Vapour, buildPot } from '../../effects/parts/chef';
import { insideTelegraph, type TelegraphShape, type TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SOUP_DAMAGE, SOUP_DELAY, SOUP_RADIUS, SOUP_RANGE, SOUP_SLOW, addDish } from '../../traits/chef';

/**
 * Hot Soup (chef kit v5, W: a circle with a dish in the middle). A red ring and a shadow mark a spot (8 m from her, at least 1.5 m).
 * A huge steel stock pot drops out of the sky onto it (0.45 s), bounces the soup up out of itself, then rocks harder and harder, steam
 * and red bubbles breaking over its brim. At 1.0 s it tips over toward the enemy side and the whole pot of soup runs out across the
 * floor: a puddle that spreads to 2.5 m in 0.3 s, soup flying, a burst of steam.
 *
 * The hit: at 1.0 s every enemy whose LIVE position is inside the 2.5 m circle (the module's telegraph, the real shape) takes 40 and
 * is slowed 1.5 s. The delay is 1.0 s, so a walker (0.25 s to react plus 0.63 s to cross 2.5 m) just leaves it. At 1.3 s a fresh dish
 * (`addDish`) plops out at the circle's centre, on both screens: whoever stood in the puddle must step out and back in to eat it. The pot
 * slides off and dissolves; the puddle steams, then dries. Clean by 3.3 s. See pipeline/designs/kit-chef.md.
 */
export interface HotSoupSettings {
  damage: number;
  slow: number;
  loop: boolean;
}

export const defaultHotSoup = (): HotSoupSettings => ({ damage: SOUP_DAMAGE, slow: SOUP_SLOW, loop: false });

// Timeline (seconds).
const DROP_T = 0.45;
const TIP_T = SOUP_DELAY;
const TIP_END = TIP_T + 0.25;
const DISH_T = 1.3;
const FADE_T = 1.7;
const DRY_T = 2.6;
const END_T = 3.3;
const SKY = 7;
const MIN_DIST = 1.5;
const MIN = 1e-3;

export class HotSoup implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HotSoupSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The circle: where the pot lands, from sentFrom and point only. */
  readonly centre = new THREE.Vector3(0, 0, 5);
  readonly circle: TelegraphShape = { kind: 'circle', x: 0, z: 5, radius: SOUP_RADIUS };
  private time = 0;
  private flags = { landed: false, tipped: false, dish: false, gone: false };
  private steamT = 0;
  private yaw = 0;

  private root = new THREE.Group();
  private pivot = new THREE.Group();
  private pot = buildPot();
  private vapour = new Vapour(70);
  private drops = new Chunks(46);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: CHEF.core, core: 0xffffff, additive: false });
  private flash = new StarBurst({ points: 8, inner: 0.3, color: CHEF.tomato, core: CHEF.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private shade = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CHEF.dark, transparent: true, opacity: 0, depthWrite: false }),
  );
  private seed = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CHEF.foil, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private puddle = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CHEF.foil, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private froth = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 1, 56).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CHEF.tomato, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private v1 = new THREE.Vector3();

  constructor(settings: HotSoupSettings = defaultHotSoup()) {
    this.settings = settings;
    this.shade.renderOrder = 1;
    this.seed.renderOrder = 2;
    this.puddle.renderOrder = 2;
    this.froth.renderOrder = 3;
    this.pivot.add(this.pot.group);
    this.root.add(this.pivot);
    this.group.add(this.shade, this.seed, this.puddle, this.froth, this.root, this.vapour.mesh, this.drops.mesh, this.pop.mesh, this.flash.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return END_T;
  }

  get impactTime() {
    return TIP_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the circle: only sentFrom and point (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = MIN_DIST; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, MIN_DIST, SOUP_RANGE);
    this.centre.set(s.x + dx * len, 0, s.z + dz * len);
    this.yaw = Math.atan2(dx, dz);
    Object.assign(this.circle, { x: this.centre.x, z: this.centre.z });
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.landed = this.flags.tipped = this.flags.dish = this.flags.gone = false;
    this.steamT = 0;
    this.vapour.reset();
    this.drops.reset();
    this.root.visible = false;
    this.pop.set(this.centre, 0, 0);
    this.flash.set(this.centre, 0, 0);
    this.shock.set(this.centre, 0, 0);
    this.shade.visible = this.seed.visible = this.puddle.visible = this.froth.visible = false;
    for (const m of [this.shade, this.seed, this.puddle, this.froth]) (m.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.vapour.update(dt);
    this.drops.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, f = this.flags, C = this.centre, ctx = this.ctx;
    if (t >= END_T && !this.vapour.busy && !this.drops.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The seed: a red ring closes on the spot and a shadow grows under the falling pot. ---
    if (!this.shade.visible) {
      this.shade.visible = this.seed.visible = true;
      this.shade.position.set(C.x, 0.03, C.z);
      this.seed.position.set(C.x, 0.04, C.z);
    }
    if (!f.landed) {
      const k = smoothstep(t / DROP_T);
      this.shade.scale.setScalar(POT_RADIUS * (0.3 + 1.0 * k));
      (this.shade.material as THREE.MeshBasicMaterial).opacity = 0.5 * k;
      this.seed.scale.setScalar(POT_RADIUS * (2.4 - 1.3 * k));
      (this.seed.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.55 * k;
    }

    // --- The pot: it drops, lands, rocks harder and harder, and tips over at TIP_T. ---
    this.root.visible = !f.gone;
    this.root.position.set(C.x, 0, C.z);
    this.root.rotation.y = this.yaw;
    if (t < DROP_T) {
      const k = t / DROP_T;
      this.root.position.y = SKY * (1 - k * k);
      this.pivot.position.set(0, 0, 0);
      this.pot.group.position.set(0, 0, 0);
      this.pot.group.scale.set(1, 1.0, 1);
    } else if (!f.landed) {
      f.landed = true;
      this.shake = 0.4;
      this.vapour.burst(this.v1.set(C.x, 0.2, C.z), 14, CHEF.hot, 0.8, 3.4, 0.6, 0.9);
      this.drops.burst(this.v1.set(C.x, POT_HEIGHT_Y, C.z), 12, [CHEF.foil, CHEF.tomato], 2.5, 6, 0.11);
      this.pop.set(this.v1.set(C.x, 0.4, C.z), 0, 0);
      this.shade.scale.setScalar(POT_RADIUS * 1.3);
    }
    if (f.landed && !f.tipped) {
      const a = t - DROP_T, k = Math.min(1, a / (TIP_T - DROP_T));
      // A squash on landing, then a rock that grows.
      const squash = 1 - 0.18 * Math.exp(-a * 14) * Math.cos(a * 40);
      this.pot.group.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      this.pot.group.rotation.z = Math.sin(a * (16 + 14 * k)) * 0.24 * k * k;
      this.pot.group.rotation.x = Math.sin(a * (13 + 12 * k) + 1) * 0.1 * k * k;
      this.pot.soup.position.y = 1.1 + 0.02 * Math.sin(a * 30);
      this.bubbles(t);
      this.steamT += dt;
      if (this.steamT >= 0.07) {
        this.steamT = 0;
        this.vapour.burst(this.v1.set(C.x + (Math.random() - 0.5) * 1.2, 1.35, C.z + (Math.random() - 0.5) * 1.2), 1, CHEF.core, 1.4 + k, 0.5, 0.5, 1.1);
        if (Math.random() < 0.3 + 0.5 * k) this.drops.burst(this.v1.set(C.x, 1.3, C.z), 1, [CHEF.foil, CHEF.tomato], 1.6, 3.5, 0.09);
      }
    }
    if (f.landed && !f.tipped && t >= TIP_T) this.tip();
    if (f.tipped) this.pour(dt);

    if (f.tipped && !f.dish && t >= DISH_T) {
      f.dish = true;
      this.vapour.burst(this.v1.set(C.x, 0.4, C.z), 10, CHEF.core, 1.6, 1.2, 0.5, 1);
      this.pop.set(this.v1.set(C.x, 0.5, C.z), 2.4, 1, 0);
      if (ctx) addDish(ctx.caster, C.x, C.z, false);
    }
    if (f.dish) {
      const a = t - DISH_T, p = StarBurst.pop(a, 0.04, 0.2);
      this.pop.set(this.v1.set(C.x, 0.5, C.z), 2.4 * p.scale, p.opacity, a * 3);
    }
    if (f.tipped) {
      const a = t - TIP_T, p = StarBurst.pop(a, 0.03, 0.2);
      this.flash.set(this.v1.set(C.x, 1.2, C.z), 4.4 * p.scale, p.opacity, a * 2);
    }
    this.shake *= Math.exp(-dt * 9);
  }

  /** The soup's bubbles on the surface: rise, swell and pop, one after another. */
  private bubbles(t: number) {
    const bs = this.pot.bubbles;
    for (let i = 0; i < bs.length; i++) {
      const ph = (t * 2.3 + i * 0.37) % 1;
      const a = i * 2.4 + Math.floor(t * 2.3 + i * 0.37) * 1.3;
      const r = 0.18 + 0.5 * ((i * 0.37 + Math.floor(t * 2.3 + i * 0.37) * 0.23) % 1);
      bs[i].visible = true;
      bs[i].position.set(Math.cos(a) * r, 1.08 + 0.12 * Math.sin(ph * Math.PI), Math.sin(a) * r);
      bs[i].scale.setScalar(Math.max(MIN, 0.3 + 1.1 * Math.sin(ph * Math.PI) * (1 - ph * 0.4)));
    }
  }

  /** The pot tips toward the enemy: the soup runs out in a puddle. The hit is decided now, on live positions. */
  private tip() {
    const f = this.flags, C = this.centre, ctx = this.ctx;
    f.tipped = true;
    this.shake = 0.55;
    for (const b of this.pot.bubbles) b.visible = false;
    this.pot.group.rotation.set(0, 0, 0);
    this.pot.group.scale.set(1, 1, 1);
    this.pivot.position.set(0, 0, POT_RADIUS);
    this.pot.group.position.set(0, 0, -POT_RADIUS);
    this.vapour.burst(this.v1.set(C.x, 0.4, C.z), 16, CHEF.core, 2.4, 3.2, 0.7, 1.2);
    for (let i = 0; i < 3; i++) this.drops.burst(this.v1.set(C.x, 0.9, C.z), 10, [CHEF.foil, CHEF.tomato, CHEF.shade], 5.5, 5, 0.12);
    if (ctx) {
      // Everyone inside the circle now, wherever the cast was aimed (live positions).
      for (const e of ctx.enemies?.() ?? ctx.targets) {
        const p = e.group.position;
        if (!insideTelegraph(this.circle, p.x, p.z)) continue;
        ctx.hit(e, { damage: this.settings.damage, knock: 0, color: CHEF_CSS.body, from: C.clone(), status: { kind: 'slow', seconds: this.settings.slow } });
      }
    }
    this.puddle.visible = this.froth.visible = true;
    this.puddle.position.set(C.x, 0.05, C.z);
    this.froth.position.set(C.x, 0.07, C.z);
  }

  /** The tipped pot, the spreading puddle, the dry-up. */
  private pour(dt: number) {
    const t = this.time, f = this.flags, C = this.centre;
    const a = t - TIP_T;
    // The pot goes over its front edge, bounces once, slides off and dissolves into steam.
    const k = smoothstep(a / (TIP_END - TIP_T));
    const bounce = a > TIP_END - TIP_T ? 0.07 * Math.exp(-(a - 0.25) * 9) * Math.abs(Math.cos((a - 0.25) * 18)) : 0;
    this.pivot.rotation.x = k * (Math.PI / 2 + 0.12) - bounce;
    this.pivot.position.z = POT_RADIUS + Math.max(0, a - 0.35) * 2.2;
    const out = a > FADE_T - TIP_T ? Math.max(0, 1 - (a - (FADE_T - TIP_T)) / 0.3) : 1;
    this.root.scale.setScalar(Math.max(MIN, out));
    if (out <= 0.01 && !f.gone) {
      f.gone = true;
      this.vapour.burst(this.v1.set(C.x + Math.sin(this.yaw) * (POT_RADIUS + 1.6), 0.5, C.z + Math.cos(this.yaw) * (POT_RADIUS + 1.6)), 10, CHEF.core, 2, 2, 0.6, 1);
    }
    // The puddle: it spreads fast to the circle's size, holds, steams, then dries from the edge in.
    const spread = 1 - Math.pow(1 - Math.min(1, a / 0.3), 3);
    const dry = smoothstep((t - DRY_T) / (END_T - DRY_T - 0.2));
    const r = SOUP_RADIUS * spread * (1 - 0.35 * dry);
    this.puddle.scale.setScalar(Math.max(MIN, r));
    this.froth.scale.setScalar(Math.max(MIN, r));
    (this.puddle.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - dry);
    (this.froth.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - dry);
    const g = Math.min(1, a / 0.3);
    this.shock.set(C, 0.5 + SOUP_RADIUS * 1.6 * g, 0.05 * (1 - g) * (1 - g));
    (this.shade.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - smoothstep(a / 0.4));
    (this.seed.material as THREE.MeshBasicMaterial).opacity *= Math.exp(-dt * 8);
    this.steamT += dt;
    if (this.steamT >= 0.08 && t < DRY_T + 0.3) {
      this.steamT = 0;
      const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r * 0.9;
      this.vapour.burst(this.v1.set(C.x + Math.cos(ang) * rr, 0.15, C.z + Math.sin(ang) * rr), 1, CHEF.hot, 1.0, 0.3, 0.55, 1.2);
    }
  }
}

const POT_HEIGHT_Y = 1.2;

export const hotSoupModule: EffectModule = {
  label: 'hot soup',
  category: 'hero: chef',
  // The aim point is where the pot lands; the radius sizes the marker.
  targeting: { mode: 'ground', radius: SOUP_RADIUS },
  create: () => new HotSoup(),
  telegraphs(effect) {
    const e = effect as HotSoup;
    if (!e.ctx) return [];
    return [{ shape: e.circle, start: 0.04, impact: TIP_T } satisfies TelegraphSpec];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as HotSoup;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as HotSoup).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 120, 1);
    f.add(s, 'slow', 0, 4, 0.1);
  },
};
