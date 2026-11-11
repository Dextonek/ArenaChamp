import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { FeatherFlock, PHOENIX, PHOENIX_CSS, disc, emberLook, ring, softDisc } from '../../effects/parts/phoenix';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { FLIGHT_AIR, FLIGHT_DAMAGE, FLIGHT_GO, FLIGHT_RADIUS, FLIGHT_RANGE, STAMP_R, emberLive, embersOf, flightEmber, spendEmber, type Ember } from '../../traits/phoenix';

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
 * The look. She breaks into feathers where she stands (a burst of red and flame feathers), and a streak of feathers arcs
 * from there to the ember, leaving one after another, fast at first as her own slide is, and arriving as she lands; more
 * feathers whirl round her wherever she is on the way (her live position, so the other screen agrees). Meanwhile the
 * landing circle fills: flame orange spreads to the gold rim (a thin pale ash line outside it) and small flames grow along
 * it. She lands in a burst: flame feathers fly outward along the floor and stop at the rim (1.8 m), over a gold flash, a
 * small star, red feathers thrown up and a ring of force. If the ember was stamped out on the way there is no burst, only a
 * few loose feathers falling.
 * Timeline: leave 0, in the air to 0.7, the burst gone 0.55 s after it, clean by 1.4 s.
 * Without a trait (the VFX tool) the effect draws the ember's feather itself, and with no ember at all it shows the flight
 * to the aim point, for the look only: she does not move and nothing is hit.
 */
export interface EmberFlightSettings {
  damage: number;
  loop: boolean;
}

export const defaultEmberFlight = (): EmberFlightSettings => ({ damage: FLIGHT_DAMAGE, loop: false });

const LAND_T = FLIGHT_GO + FLIGHT_AIR;
const DURATION = LAND_T + 0.7;
const HIT_R = FLIGHT_RADIUS;
// The look only.
const DARTS = 16; // feathers in the streak that arcs to the ember
const WHIRL = 6; // feathers whirling round her on the way
const RIM = 12; // small flames standing along the landing circle
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

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

  // The look.
  /** Where the look lands: the ember; with none in reach and no trait (the VFX tool), the aim point, for show. */
  private spot = new THREE.Vector3();
  private hasSpot = false;
  /** No trait draws the embers on this screen (the VFX tool): the effect draws the ember's feather itself. */
  private own = false;
  private burstDone = false;
  private warn = disc(HIT_R, PHOENIX.body, 0, 0.03);
  private rim = ring(HIT_R, PHOENIX.hot, 0, 0.05, 0.1);
  private foil = ring(HIT_R + 0.08, PHOENIX.ash, 0, 0.045, 0.05);
  private bang = ring(HIT_R, PHOENIX.hot, 0, 0.06, 0.4);
  private glow = softDisc(1.1, PHOENIX.hot, 0, 0.055, 3);
  private star = new StarBurst({ points: 9, inner: 0.3, color: PHOENIX.body, core: PHOENIX.hot, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private flames = new FeatherFlock('flame', 150);
  private plumes = new FeatherFlock('eye', 70);
  private local: THREE.Object3D | null = null;
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: EmberFlightSettings = defaultEmberFlight()) {
    this.settings = settings;
    this.group.add(this.warn, this.foil, this.rim, this.bang, this.glow, this.flames.mesh, this.plumes.mesh, this.star.mesh, this.shock.mesh);
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
    // The look: where it lands, and whether the ember's own feather is ours to draw.
    this.own = !emberLive(ctx.caster);
    this.hasSpot = !!this.ember || this.own;
    if (this.ember) this.spot.set(this.ember.x, 0, this.ember.z);
    else this.spot.copy(ctx.point).setY(0);
    if (this.own && !this.local) {
      this.local = emberLook(STAMP_R);
      this.local.visible = false;
      this.group.add(this.local);
    }
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    // The flight: she slides to the ember (the engine clamps the spot into the ring and out of the walls).
    if (ctx?.moveCaster && this.ember) this.land.copy(ctx.moveCaster(this.land, LAND_T)).setY(0);
    this.takeWing();
  }

  /** The look of the cast: she breaks into feathers where she stands, and a streak of them arcs to the ember. */
  private takeWing() {
    if (!this.hasSpot) return;
    this.v1.set(this.start.x, 1.1, this.start.z);
    this.plumes.burst(this.v1, 10, 3.4, 0.55, 0.5);
    this.flames.burst(this.v1, 10, 3.6, 0.45, 0.45);
    const dist = this.start.distanceTo(this.spot);
    for (let i = 0; i < DARTS; i++) {
      // they leave one after another, fast at first as she is, and arrive as she lands
      const delay = 0.03 + (i / DARTS) * 0.3;
      this.v1.set(this.start.x + (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.8, this.start.z + (Math.random() - 0.5) * 0.6);
      this.v2.set(this.spot.x + (Math.random() - 0.5) * 0.9, 0.25, this.spot.z + (Math.random() - 0.5) * 0.9);
      const lift = Math.min(2.6, 0.8 + dist * 0.16) * (0.65 + 0.6 * Math.random());
      (i % 3 === 0 ? this.plumes : this.flames).dart(this.v1, this.v2, LAND_T - delay - Math.random() * 0.06, 0.65 + Math.random() * 0.35, lift, delay, 0.8, true);
    }
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.landed = false;
    this.burst = false;
    this.burstDone = false;
    this.flames.reset();
    this.plumes.reset();
    this.warn.visible = this.rim.visible = this.foil.visible = this.bang.visible = this.glow.visible = false;
    if (this.local) this.local.visible = false;
    this.star.set(this.spot, 0, 0);
    this.shock.set(this.spot, 0, 0);
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
    this.flames.update(dt);
    this.plumes.update(dt);
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
    // The look while she flies: the landing circle fills, and feathers whirl round her.
    const x = this.spot.x, z = this.spot.z;
    if (this.hasSpot && !this.landed) {
      const k = Math.min(1, t / LAND_T);
      this.warn.visible = this.rim.visible = this.foil.visible = true;
      this.warn.position.set(x, 0.03, z);
      this.rim.position.set(x, 0.05, z);
      this.foil.position.set(x, 0.045, z);
      this.warn.scale.setScalar(Math.max(0.05, k));
      this.mat(this.warn).opacity = 0.1 + 0.22 * k;
      this.mat(this.rim).opacity = 0.5 + 0.4 * Math.abs(Math.sin(t * (8 + 20 * k)));
      this.mat(this.foil).opacity = 0.32;
      // small flames stand along the rim and grow; their tips stay on the rim
      for (let j = 0; j < RIM; j++) {
        const a = (j / RIM) * Math.PI * 2 + hash(j + 5) * 0.25 + t * 0.5;
        const c = Math.cos(a), s = Math.sin(a);
        const size = (0.22 + 0.4 * k) * (0.8 + 0.4 * hash(j + 9)) * (1 + 0.14 * Math.sin(t * 15 + j * 2.1));
        this.v1.set(x + c * (HIT_R - 0.2), 0.04, z + s * (HIT_R - 0.2));
        this.flames.put(this.v1, this.v2.set(c * 0.3, 1, s * 0.3), size, 0, 1.25, this.v3.set(c, 0.5, s));
      }
      const dx = x - this.start.x, dz = z - this.start.z, len = Math.hypot(dx, dz) || 1;
      // feathers whirl round her where she is now (the other screen is sent her move, so both agree)
      const at = this.ember && this.ctx ? this.ctx.caster.group.position : this.v3.copy(this.start).lerp(this.spot, 1 - (1 - k) ** 3);
      const px = at.x, pz = at.z;
      for (let j = 0; j < WHIRL; j++) {
        const a = t * 13 + j * ((Math.PI * 2) / WHIRL), c = Math.cos(a), s = Math.sin(a);
        this.v1.set(px + c * 0.6, 0.45 + j * 0.24, pz + s * 0.6);
        this.v2.set(-s + (dx / len) * 0.8, 0.3, c + (dz / len) * 0.8);
        (j % 2 ? this.plumes : this.flames).put(this.v1, this.v2, 0.62 + 0.2 * hash(j + 2), 0, 1.2);
      }
      if (this.own && this.local) {
        this.local.visible = true;
        this.local.position.set(x, 0.02, z);
      }
    }
    if (!this.landed && t >= LAND_T) {
      this.landed = true;
      this.touchDown();
    }
    // The look of the landing: the burst needs the ember (the tool's show flight always bursts).
    if (this.hasSpot && this.landed) {
      const a = t - LAND_T, p = Math.min(1, a / 0.35), out = 1 - (1 - p) ** 3;
      const lit = this.ember ? this.burst : true;
      if (!this.burstDone) {
        this.burstDone = true;
        if (lit) {
          this.flames.ring(this.v1.set(x, 0, z), 18, 0.3, HIT_R, 0.32, 0.7, 0.12, Math.random() * 6.28);
          this.flames.burst(this.v1.set(x, 0.8, z), 6, 3, 0.4, 0.5);
          this.plumes.burst(this.v1, 8, 3.4, 0.55, 0.55);
        } else this.plumes.fall(this.v1.set(x, 1.1, z), 5, 0.4, 0.45, 0.5);
      }
      if (this.local) this.local.visible = false;
      this.foil.visible = false;
      this.warn.visible = this.rim.visible = lit && a < 0.4;
      this.mat(this.warn).opacity *= Math.exp(-dt * 8);
      this.mat(this.rim).opacity *= Math.exp(-dt * 6);
      // the ring of fire runs out to the rim and stops there
      this.bang.visible = lit && a < 0.45;
      this.bang.position.set(x, 0.06, z);
      this.bang.scale.setScalar(0.25 + 0.75 * out);
      this.mat(this.bang).opacity = 0.75 * (1 - p) * (1 - p);
      // the bright middle: gold, never white
      this.glow.visible = lit && a < 0.4;
      this.glow.position.set(x, 0.055, z);
      this.glow.scale.setScalar(0.7 + 0.6 * out);
      this.mat(this.glow).opacity = 0.7 * (1 - p) * (1 - p);
      const sp = StarBurst.pop(lit ? a : -1, 0.03, 0.1);
      this.star.set(this.v1.set(x, 0.9, z), 1.0 * sp.scale + 1e-3, sp.opacity, a * 4);
      this.shock.set(this.v1.set(x, 0, z), 0.4 + HIT_R * 1.1 * out, lit ? 0.04 * (1 - p) * (1 - p) : 0);
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
