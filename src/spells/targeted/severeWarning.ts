import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Dots, Specks, Tornado, WEATHER } from '../../effects/parts/weather';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import {
  ARENA_X, ARENA_Z, TORNADO_RADIUS, TORNADO_SPEED, TORNADO_WALK, TORNADO_WARN, bookOf, type TornadoRec,
} from '../../traits/weather';

/**
 * Severe Warning (weather kit, R: a tornado that walks). Barry points his pointer at a spot (9 m) and a warning goes up: a ring of the
 * 2 m hit radius draws on the ground there in pale blue and gold, dust and leaves spiral inward and a small whirl climbs out of the
 * floor (1.0 s: the telegraph is the circle, he is rooted until then). At 1.0 s the tornado stands up, 5 m tall, in one short impact
 * frame: a tall funnel with swirling bands, debris orbiting it and a skirt of dust. Then it WALKS at the enemy hero at 2.5 m/s for 4 s
 * (they walk at 4: it is a chase, not a trap), always toward their live position, which both screens have, kept inside the ring. While it
 * walks, anyone within 2 m takes 25 a second: the hits are the trait's (`victimTick` in src/traits/weather.ts, in four beats of 6, 6, 6, 7, on
 * the screen that decides the enemy's hits), read from the record this effect writes each frame (`bookOf(caster).tornado`: place and
 * `live`). It stops at 5.0 s, shrinks and thins out; clean by about 5.8 s. Under the gameplay camera, no cinematic.
 * See pipeline/designs/kit-weather.md.
 */
export interface SevereWarningSettings {
  loop: boolean;
}

export const defaultSevereWarning = (): SevereWarningSettings => ({ loop: false });

// Timeline (seconds).
const WALK_END = TORNADO_WARN + TORNADO_WALK;
const FADE = 0.7;
const DURATION = WALK_END + FADE + 0.1;
/** The ring the tornado is kept inside (the arena: `RING` in duel.ts), a little in from the edge. */
const KEEP = 11.2;

export class SevereWarning implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SevereWarningSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly spot = new THREE.Vector3();
  private time = 0;
  private born = false;
  private px = 0;
  private pz = 0;
  private rec: TornadoRec = { x: 0, z: 0, live: false };
  private v1 = new THREE.Vector3();

  private tornado = new Tornado();
  private swirl = new Dots(36);
  private dust = new Specks(60);
  private pop = new StarBurst({ points: 12, inner: 0.3, color: WEATHER.accent, core: WEATHER.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(TORNADO_RADIUS - 0.12, TORNADO_RADIUS, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: WEATHER.foil, transparent: true, depthWrite: false, opacity: 0 }),
  );
  private inner = new THREE.Mesh(
    new THREE.RingGeometry(TORNADO_RADIUS * 0.55 - 0.06, TORNADO_RADIUS * 0.55, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: WEATHER.accent, transparent: true, depthWrite: false, opacity: 0 }),
  );
  private fill = new THREE.Mesh(
    new THREE.CircleGeometry(TORNADO_RADIUS, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: WEATHER.storm, transparent: true, depthWrite: false, opacity: 0 }),
  );

  constructor(settings: SevereWarningSettings = defaultSevereWarning()) {
    this.settings = settings;
    this.fill.renderOrder = 1;
    this.ring.renderOrder = 2;
    this.inner.renderOrder = 2;
    this.screen.impactColor.set(WEATHER.core);
    this.group.add(this.fill, this.ring, this.inner, this.swirl.mesh, this.dust.mesh, this.tornado.mesh, this.pop.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return TORNADO_WARN;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.spot.copy(ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((t) => t.group)];
    this.screen.focus.copy(this.spot);
  }

  play() {
    this.reset();
    this.playing = true;
    this.px = this.spot.x;
    this.pz = this.spot.z;
    if (this.ctx) {
      this.rec.x = this.px;
      this.rec.z = this.pz;
      this.rec.live = false;
      bookOf(this.ctx.caster).tornado = this.rec;
    }
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.born = false;
    this.rec.live = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(WEATHER.core);
    this.tornado.hide();
    this.swirl.hide(0);
    this.swirl.flush();
    this.dust.reset();
    this.pop.set(this.spot, 0, 0);
    this.shock.set(this.spot, 0, 0);
    for (const m of [this.ring, this.inner, this.fill]) (m.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.dust.update(dt);
    if (!this.playing) { this.tornado.update(dt, 0); return; }
    this.time += dt;
    const t = this.time, ctx = this.ctx, sp = this.spot;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- 0 - 1.0 The warning: a ring draws on at the spot, dust and leaves spiral in, a small whirl climbs. ---
    if (t < TORNADO_WARN) {
      const k = t / TORNADO_WARN;
      this.place(this.ring, sp.x, sp.z, 0.06, 0.4 + 0.5 * smoothstep(t / 0.3));
      this.place(this.inner, sp.x, sp.z, 0.07, 0.8 * smoothstep(t / 0.4));
      this.inner.rotation.y = -t * 5;
      this.inner.scale.setScalar(1.4 - 0.4 * smoothstep(k));
      this.place(this.fill, sp.x, sp.z, 0.05, 0.28 * smoothstep(k));
      // Debris spirals inward on the ground: the Dots turn as they close on the middle.
      for (let i = 0; i < 36; i++) {
        const h = i / 36, r = TORNADO_RADIUS * (1.15 - 0.85 * smoothstep(k * (0.7 + h * 0.5))), a = i * 2.399 + t * 6;
        this.swirl.put(i, sp.x + Math.cos(a) * r, 0.15 + (i % 4) * 0.12 + k * 0.8 * h, sp.z + Math.sin(a) * r, 0.16 + (i % 3) * 0.04, i % 3 === 0 ? 0x8fbf6a : 0xe4edf8, 0.9);
      }
      this.swirl.flush();
      // A small whirl climbs out of the floor over the second.
      this.tornado.set(sp.x, sp.z, 0.12 * smoothstep(k) );
      this.tornado.update(dt, t);
    }

    // --- 1.0 The tornado stands up: one short impact frame, a ring out across the ground. ---
    if (!this.born && t >= TORNADO_WARN) {
      this.born = true;
      this.rec.live = true;
      this.shake = 0.5;
      this.swirl.hide(0);
      this.swirl.flush();
      this.dust.burst(sp.x, 0.3, sp.z, 24, 5, 0.9, 0.3, 0xcfc6ae, 3, true);
    }
    if (t >= TORNADO_WARN) {
      const a = t - TORNADO_WARN;
      this.screen.impact = impactFrameAt(t, TORNADO_WARN, [2, 1], 0.04);
      // The warning ring and fill fade as it stands.
      this.place(this.ring, sp.x, sp.z, 0.06, 0.9 * (1 - smoothstep(a / 0.35)));
      this.place(this.inner, sp.x, sp.z, 0.07, 0);
      this.place(this.fill, sp.x, sp.z, 0.05, 0.28 * (1 - smoothstep(a / 0.35)));
      const g = smoothstep(a / 0.5);
      this.shock.set(this.v1.set(sp.x, 0, sp.z), 0.5 + 5 * g, 0.05 * (1 - g) * (1 - g));
      const pp = StarBurst.pop(a, 0.04, 0.2);
      this.pop.set(this.v1.set(sp.x, 1.5, sp.z), 4 * pp.scale, pp.opacity, a * 3);

      // --- It walks at the enemy's live position. ---
      let k = Math.min(1, a / 0.5);
      if (t < WALK_END) {
        const e = ctx?.targets[0] ?? ctx?.enemies?.()[0];
        if (e) {
          const dx = e.group.position.x - this.px, dz = e.group.position.z - this.pz, d = Math.hypot(dx, dz);
          if (d > 0.01) {
            const step = Math.min(d, TORNADO_SPEED * dt);
            this.px += (dx / d) * step;
            this.pz += (dz / d) * step;
          }
          // Kept inside the ring.
          const ox = this.px - ARENA_X, oz = this.pz - ARENA_Z, od = Math.hypot(ox, oz);
          if (od > KEEP) { this.px = ARENA_X + (ox / od) * KEEP; this.pz = ARENA_Z + (oz / od) * KEEP; }
        }
        this.rec.live = true;
      } else {
        // The walk is over: it stops hurting at once and thins out.
        this.rec.live = false;
        k *= 1 - smoothstep((t - WALK_END) / FADE);
      }
      this.rec.x = this.px;
      this.rec.z = this.pz;
      this.tornado.set(this.px, this.pz, k);
      this.tornado.update(dt, t);
      this.shake = Math.max(this.shake * Math.exp(-dt * 6), 0.03 * k);
    }
  }

  private place(m: THREE.Mesh, x: number, z: number, y: number, opacity: number) {
    m.position.set(x, y, z);
    (m.material as THREE.MeshBasicMaterial).opacity = opacity;
  }
}

export const severeWarningModule: EffectModule = {
  label: 'severe warning',
  category: 'hero: weather',
  targeting: { mode: 'ground', radius: TORNADO_RADIUS },
  create: () => new SevereWarning(),
  telegraphs(effect) {
    const e = effect as SevereWarning;
    if (!e.ctx) return [];
    // The warning circle is the real hit shape where it stands; once it walks the hits follow it (the trait's `victimTick`).
    return [{ shape: { kind: 'circle', x: e.ctx.point.x, z: e.ctx.point.z, radius: TORNADO_RADIUS }, start: 0, impact: TORNADO_WARN }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as SevereWarning;
    if (e.ctx) frameCast(camera, controls, e.ctx, 7);
  },
  buildGui(f, effect) {
    f.add((effect as SevereWarning).settings, 'loop');
  },
};
