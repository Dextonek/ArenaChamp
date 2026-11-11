import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { PHOENIX, PHOENIX_CSS, disc, ring } from '../../effects/parts/phoenix';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { FLIGHT_AIR, FLIGHT_DAMAGE, FLIGHT_GO, FLIGHT_RADIUS, FLIGHT_RANGE, embersOf, flightEmber, spendEmber, type Ember } from '../../traits/phoenix';

/**
 * Ember Flight (phoenix kit, E: she flies to one of her embers). At the cast the ember is chosen: of her embers within 12 m
 * of her, the one nearest the aimed spot (the CPU names its own, `flightEmber`). She turns to feathers and slides there
 * (`ctx.moveCaster`, 0.7 s in all: 0.25 s to go and 0.45 s in the air); she can be hit on the way. She lands in a burst of
 * 1.8 m: an enemy inside it at that moment, on its LIVE position, takes 40. The ember is spent (`spendEmber`, both screens).
 * The landing circle is the telegraph (impact 0.7 s) and the hit shape: 1.8 m takes 0.7 s to leave with a reaction. If the
 * ember is stamped out while she flies she still lands there, with no burst. With no ember in reach nothing happens (the
 * trait's `canCast` refuses the cast when none burns at all). Clean by 1.4 s.
 * Network duels: the other screen has no `moveCaster` (her client streams the move); the landing is the same ember there.
 *
 * PLACEHOLDER LOOK (gate 4, first step): a streak along the path, a disc that fills and a ring that bursts.
 */
export interface EmberFlightSettings {
  damage: number;
  loop: boolean;
}

export const defaultEmberFlight = (): EmberFlightSettings => ({ damage: FLIGHT_DAMAGE, loop: false });

const LAND_T = FLIGHT_GO + FLIGHT_AIR;
const DURATION = LAND_T + 0.7;
const HIT_R = FLIGHT_RADIUS;

export class EmberFlight implements Effect {
  readonly group = new THREE.Group();
  readonly settings: EmberFlightSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The ember she flies to (null: none in reach), and where she will really land. */
  ember: Ember | null = null;
  readonly land = new THREE.Vector3();
  private start = new THREE.Vector3();
  private time = 0;
  private landed = false;
  private burst = false;

  private warn = disc(HIT_R, PHOENIX.body, 0, 0.03);
  private rim = ring(HIT_R, PHOENIX.hot, 0, 0.05, 0.08);
  private bang = ring(HIT_R, PHOENIX.core, 0, 0.06, 0.45);
  private streak = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PHOENIX.hot, transparent: true, opacity: 0, depthWrite: false }));

  constructor(settings: EmberFlightSettings = defaultEmberFlight()) {
    this.settings = settings;
    this.streak.renderOrder = 3;
    this.group.add(this.warn, this.rim, this.bang, this.streak);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return LAND_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    // Only embers within reach of her count; of those, the one nearest the aim (or the CPU's own pick).
    const pick = flightEmber(ctx.caster, ctx.point.x, ctx.point.z);
    const inReach = (e: Ember) => Math.hypot(e.x - this.start.x, e.z - this.start.z) <= FLIGHT_RANGE + 0.5;
    this.ember = pick && inReach(pick) ? pick : embersOf(ctx.caster).filter(inReach).sort((a, b) => Math.hypot(a.x - ctx.point.x, a.z - ctx.point.z) - Math.hypot(b.x - ctx.point.x, b.z - ctx.point.z))[0] ?? null;
    if (this.ember) this.land.set(this.ember.x, 0, this.ember.z);
    else this.land.copy(this.start);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    // The flight: she slides to the ember (the engine clamps the spot into the ring and out of the walls).
    if (ctx?.moveCaster && this.ember) this.land.copy(ctx.moveCaster(this.land, LAND_T)).setY(0);
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landed = false;
    this.burst = false;
    this.warn.visible = this.rim.visible = this.bang.visible = this.streak.visible = false;
  }

  private mat(m: THREE.Mesh) {
    return m.material as THREE.MeshBasicMaterial;
  }

  private touchDown() {
    const ctx = this.ctx, e = this.ember;
    if (!ctx || !e) return;
    // The burst needs the ember: one stamped out while she flew gives none.
    this.burst = spendEmber(ctx.caster, e.id);
    if (!this.burst) return;
    for (const en of ctx.enemies?.() ?? ctx.targets) {
      const p = en.group.position;
      if (Math.hypot(p.x - e.x, p.z - e.z) > HIT_R) continue;
      ctx.hit(en, { damage: this.settings.damage, knock: 3, from: new THREE.Vector3(e.x, 0, e.z), color: PHOENIX_CSS.body });
    }
    this.shake = 0.22;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const e = this.ember;
    if (e) {
      const k = Math.min(1, t / LAND_T);
      if (!this.landed) {
        this.warn.visible = this.rim.visible = this.streak.visible = true;
        this.warn.position.set(e.x, 0.03, e.z);
        this.rim.position.set(e.x, 0.05, e.z);
        this.warn.scale.setScalar(Math.max(0.05, k));
        this.mat(this.warn).opacity = 0.15 + 0.3 * k;
        this.mat(this.rim).opacity = 0.5 + 0.4 * Math.abs(Math.sin(t * (8 + 20 * k)));
        // the streak from where she left to the ember
        const dx = e.x - this.start.x, dz = e.z - this.start.z, len = Math.hypot(dx, dz) || 1;
        this.streak.position.set(this.start.x + dx / 2, 0.07, this.start.z + dz / 2);
        this.streak.rotation.y = Math.atan2(dx, dz);
        this.streak.scale.set(1, 1, len);
        this.mat(this.streak).opacity = 0.45 * (1 - k);
      } else {
        const a = t - LAND_T, p = Math.min(1, a / 0.4);
        this.warn.visible = this.rim.visible = this.streak.visible = false;
        this.bang.visible = this.burst && a < 0.5;
        this.bang.position.set(e.x, 0.06, e.z);
        this.bang.scale.setScalar(0.3 + 0.8 * p);
        this.mat(this.bang).opacity = 0.85 * (1 - p) * (1 - p);
      }
    }
    if (!this.landed && t >= LAND_T) {
      this.landed = true;
      this.touchDown();
    }
    this.shake *= 0.88;
  }
}

export const emberFlightModule: EffectModule = {
  label: 'ember flight',
  category: 'hero: phoenix',
  // The aim only says which ember: she lands on the one nearest it.
  targeting: { mode: 'ground', radius: HIT_R },
  create: () => new EmberFlight(),
  telegraphs(effect) {
    const e = effect as EmberFlight;
    if (!e.ctx || !e.ember) return [];
    // The real shape: the circle at the ember she flies to.
    return [{ shape: { kind: 'circle', x: e.ember.x, z: e.ember.z, radius: HIT_R }, start: 0.04, impact: LAND_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as EmberFlight;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as EmberFlight).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
