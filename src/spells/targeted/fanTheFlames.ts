import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { FeatherFlock, PHOENIX, PHOENIX_CSS, disc, emberLook, ring, softDisc } from '../../effects/parts/phoenix';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { FLARE_DAMAGE, FLARE_RADIUS, FLARE_WIND, MAX_EMBERS, STAMP_R, burnOut, emberLive, embersOf, type Ember } from '../../traits/phoenix';

/**
 * Fan the Flames (phoenix kit, W: no aim). One sweep of the fan: every ember of hers that burns is the centre of a 2.2 m
 * ring. For 0.8 s each ring fills; then they flare: an enemy inside any of them at that moment, on its LIVE position
 * (`ctx.enemies`, not the list frozen at the cast), takes 60, once, however many rings it stands in. An ember stamped out
 * meanwhile does not flare. Then every ember burns out (the trait's `burnOut`, both screens): she has no nest until the
 * next quill lands. The rings come from the embers at the cast (the trait's records, the same on both screens): they are
 * the telegraph (impact 0.8 s: she is rooted until then) and the hit shape. 2.2 m takes 0.8 s to leave with a reaction, so
 * the answer holds from the very middle. The CPU casts it only with the enemy inside a ring (`aiHold`). Clean by 1.6 s.
 *
 * The look. For the 0.8 s each ring fills: flame orange spreads from the ember to the gold rim (a thin pale ash line outside
 * it), small flames stand up along the rim and grow, and feathers of flame light one after another round the ember, turning
 * faster and rising. An ember stamped out meanwhile loses all of it at once. The flare: a ring of flame feathers bursts
 * outward along the floor and stops at the rim (2.2 m: what is drawn is what is hit), over a gold flash in the middle
 * (bright, not white), with a small star, a few red feathers thrown up and a ring of force. Short: gone 0.55 s after it.
 * Timeline: fill 0-0.8, flare 0.8, clean by 1.6 s.
 * Without a trait (the VFX tool) the effect draws the embers' feathers itself, and with no ember at all it shows one ring
 * at the aim point, for the look only: nothing is hit there.
 */
export interface FanTheFlamesSettings {
  damage: number;
  loop: boolean;
}

export const defaultFanTheFlames = (): FanTheFlamesSettings => ({ damage: FLARE_DAMAGE, loop: false });

const HIT_T = FLARE_WIND;
const DURATION = HIT_T + 0.8;
const HIT_R = FLARE_RADIUS;
// The look only.
const SWIRL = 14; // feathers of flame turning round each ember
const RIM = 16; // small flames standing along each rim
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export class FanTheFlames implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FanTheFlamesSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The circles that are hit: one per ember that burned at the cast. */
  circles: TelegraphShape[] = [];
  private recs: Ember[] = [];
  private time = 0;
  private flared = false;
  private lit: boolean[] = [];

  // The look.
  /** Where it is drawn: at each ember of the cast; with none at all and no trait (the VFX tool), one spot at the aim point, for show. */
  private spots: { x: number; z: number }[] = [];
  /** No trait draws the embers on this screen (the VFX tool): the effect draws their feathers itself. */
  private own = false;
  private burstDone = false;
  private discs: THREE.Mesh[] = [];
  private rims: THREE.Mesh[] = [];
  private foils: THREE.Mesh[] = [];
  private bangs: THREE.Mesh[] = [];
  private glows: THREE.Mesh[] = [];
  private stars: StarBurst[] = [];
  private shocks: ShockRefraction[] = [];
  private locals: THREE.Object3D[] = [];
  private flames = new FeatherFlock('flame', 240);
  private plumes = new FeatherFlock('eye', 40);
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: FanTheFlamesSettings = defaultFanTheFlames()) {
    this.settings = settings;
    for (let i = 0; i < MAX_EMBERS; i++) {
      const d = disc(HIT_R, PHOENIX.body, 0, 0.03), r = ring(HIT_R, PHOENIX.hot, 0, 0.05, 0.1), f = ring(HIT_R + 0.08, PHOENIX.ash, 0, 0.045, 0.05);
      const b = ring(HIT_R, PHOENIX.hot, 0, 0.06, 0.45), g = softDisc(1.2, PHOENIX.hot, 0, 0.055, 3);
      const star = new StarBurst({ points: 10, inner: 0.3, color: PHOENIX.body, core: PHOENIX.hot, additive: false });
      const shock = new ShockRefraction({ facing: 'ground' });
      this.discs.push(d);
      this.rims.push(r);
      this.foils.push(f);
      this.bangs.push(b);
      this.glows.push(g);
      this.stars.push(star);
      this.shocks.push(shock);
      this.group.add(d, f, r, b, g, star.mesh, shock.mesh);
    }
    this.group.add(this.flames.mesh, this.plumes.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // The embers that burn now: the same records on both screens.
    this.recs = embersOf(ctx.caster).slice(0, MAX_EMBERS);
    this.circles = this.recs.map((e): TelegraphShape => ({ kind: 'circle', x: e.x, z: e.z, radius: HIT_R }));
    // The look: where it is drawn, and whether the embers' own feathers are ours to draw.
    this.own = !emberLive(ctx.caster);
    this.spots = this.recs.map((e) => ({ x: e.x, z: e.z }));
    if (this.own && this.spots.length === 0) this.spots = [{ x: ctx.point.x, z: ctx.point.z }];
    while (this.own && this.locals.length < this.spots.length) {
      const o = emberLook(STAMP_R);
      o.visible = false;
      this.locals.push(o);
      this.group.add(o);
    }
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flared = false;
    this.lit = [];
    this.burstDone = false;
    this.flames.reset();
    this.plumes.reset();
    for (let i = 0; i < MAX_EMBERS; i++) {
      this.discs[i].visible = this.rims[i].visible = this.foils[i].visible = this.bangs[i].visible = this.glows[i].visible = false;
      this.stars[i].set(this.v1.set(0, 0, 0), 0, 0);
      this.shocks[i].set(this.v1, 0, 0);
    }
    for (const o of this.locals) o.visible = false;
  }

  /** The ring at spot `i` while it fills (`k` 0..1): the floor, the small flames on the rim, the feathers of flame turning and rising. */
  private drawFill(i: number, t: number, k: number) {
    const { x, z } = this.spots[i];
    this.discs[i].visible = this.rims[i].visible = this.foils[i].visible = this.glows[i].visible = true;
    this.discs[i].position.set(x, 0.03, z);
    this.rims[i].position.set(x, 0.05, z);
    this.foils[i].position.set(x, 0.045, z);
    this.glows[i].position.set(x, 0.055, z);
    this.discs[i].scale.setScalar(Math.max(0.05, k));
    this.glows[i].scale.setScalar(0.5 + 0.5 * k);
    this.mat(this.discs[i]).opacity = 0.1 + 0.2 * k;
    this.mat(this.rims[i]).opacity = 0.5 + 0.4 * Math.abs(Math.sin(t * (8 + 20 * k)));
    this.mat(this.foils[i]).opacity = 0.32;
    this.mat(this.glows[i]).opacity = 0.2 + 0.3 * k;
    // Feathers of flame light one after another, turn round the ember (the inner ones faster) and rise.
    const turn = t * 2.6 + k * k * 4.2;
    for (let j = 0; j < SWIRL; j++) {
      const born = THREE.MathUtils.clamp((k * 1.15 - j / SWIRL) / 0.22, 0, 1);
      if (born <= 0) continue;
      const far = 0.28 + 0.58 * hash(j + 1 + i * 17);
      const a = j * 2.39996 + i + turn * (1.5 - 0.8 * far);
      const c = Math.cos(a), s = Math.sin(a);
      this.v1.set(x + c * HIT_R * far, 0.14 + k * (0.25 + 1.25 * hash(j + 7)), z + s * HIT_R * far);
      this.v2.set(-s, 0.25 + 0.9 * k, c);
      this.flames.put(this.v1, this.v2, (0.5 + 0.35 * hash(j + 3)) * born, 0, 1.2);
    }
    // Small flames stand along the rim and grow as it fills; their tips stay on the rim.
    for (let j = 0; j < RIM; j++) {
      const a = (j / RIM) * Math.PI * 2 + hash(j + 5) * 0.2 + t * 0.5 + i;
      const c = Math.cos(a), s = Math.sin(a);
      const size = (0.24 + 0.42 * k) * (0.8 + 0.4 * hash(j + 9)) * (1 + 0.14 * Math.sin(t * 15 + j * 2.1));
      this.v1.set(x + c * (HIT_R - 0.22), 0.04, z + s * (HIT_R - 0.22));
      this.v2.set(c * 0.3, 1, s * 0.3);
      this.flames.put(this.v1, this.v2, size, 0, 1.25, this.v3.set(c, 0.5, s));
    }
  }

  /** The flare at spot `i`: flame feathers burst outward along the floor to the rim, a few red feathers are thrown up. */
  private burstAt(i: number) {
    const { x, z } = this.spots[i];
    this.flames.ring(this.v1.set(x, 0, z), 22, 0.35, HIT_R, 0.34, 0.8, 0.12, Math.random() * 6.28);
    this.flames.burst(this.v1.set(x, 0.5, z), 6, 3, 0.4, 0.5);
    this.plumes.burst(this.v1, 5, 3.2, 0.5, 0.55);
  }

  private mat(m: THREE.Mesh) {
    return m.material as THREE.MeshBasicMaterial;
  }

  private flare() {
    const ctx = this.ctx;
    if (!ctx) return;
    // Only the embers that still burn flare (one stamped out meanwhile does not).
    const live = new Set(embersOf(ctx.caster).map((e) => e.id));
    this.lit = this.recs.map((e) => live.has(e.id));
    const shapes = this.circles.filter((_, i) => this.lit[i]);
    if (shapes.length) {
      for (const en of ctx.enemies?.() ?? ctx.targets) {
        const p = en.group.position;
        const at = shapes.find((s) => insideTelegraph(s, p.x, p.z));
        if (!at || at.kind !== 'circle') continue;
        ctx.hit(en, { damage: this.settings.damage, knock: 3, from: new THREE.Vector3(at.x, 0, at.z), color: PHOENIX_CSS.body });
      }
      this.shake = 0.3;
    }
    burnOut(ctx.caster);
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
    const ctx = this.ctx;
    const live = ctx && !this.flared ? new Set(embersOf(ctx.caster).map((e) => e.id)) : null;
    const k = Math.min(1, t / HIT_T);
    // The look, while the rings fill. A spot with no ember behind it (the tool's show ring) always burns.
    for (let i = 0; i < this.spots.length; i++) {
      if (this.flared) break;
      const e = this.recs[i];
      // An ember stamped out meanwhile loses its ring at once.
      const on = !e || !live || live.has(e.id);
      if (on) this.drawFill(i, t, k);
      else this.discs[i].visible = this.rims[i].visible = this.foils[i].visible = this.glows[i].visible = false;
      if (this.own && this.locals[i]) {
        this.locals[i].visible = on;
        this.locals[i].position.set(this.spots[i].x, 0.02, this.spots[i].z);
      }
    }
    if (!this.flared && t >= HIT_T) {
      this.flared = true;
      this.flare();
    }
    // The look of the flare: only the embers that still burned burst.
    if (this.flared) {
      const a = t - HIT_T, p = Math.min(1, a / 0.35), out = 1 - (1 - p) ** 3;
      const first = !this.burstDone;
      this.burstDone = true;
      for (let i = 0; i < this.spots.length; i++) {
        const { x, z } = this.spots[i];
        const lit = this.recs[i] ? !!this.lit[i] : true;
        if (first && lit) this.burstAt(i);
        if (this.locals[i]) this.locals[i].visible = false;
        this.discs[i].visible = this.rims[i].visible = lit && a < 0.4;
        this.foils[i].visible = false;
        this.mat(this.discs[i]).opacity *= Math.exp(-dt * 8);
        this.mat(this.rims[i]).opacity *= Math.exp(-dt * 6);
        // the ring of fire runs out to the rim and stops there
        this.bangs[i].visible = lit && a < 0.45;
        this.bangs[i].position.set(x, 0.06, z);
        this.bangs[i].scale.setScalar(0.25 + 0.75 * out);
        this.mat(this.bangs[i]).opacity = 0.75 * (1 - p) * (1 - p);
        // the bright middle: gold, never white
        this.glows[i].visible = lit && a < 0.4;
        this.glows[i].position.set(x, 0.055, z);
        this.glows[i].scale.setScalar(0.7 + 0.6 * out);
        this.mat(this.glows[i]).opacity = 0.75 * (1 - p) * (1 - p);
        const sp = StarBurst.pop(lit ? a : -1, 0.03, 0.1);
        this.stars[i].set(this.v1.set(x, 0.6, z), 1.1 * sp.scale + 1e-3, sp.opacity, a * 4);
        this.shocks[i].set(this.v1.set(x, 0, z), 0.4 + HIT_R * 1.1 * out, lit ? 0.045 * (1 - p) * (1 - p) : 0);
      }
    }
    this.shake *= 0.88;
  }
}

export const fanTheFlamesModule: EffectModule = {
  label: 'fan the flames',
  category: 'hero: phoenix',
  // Cast on herself: the rings are at her embers, wherever they are.
  targeting: { mode: 'self', radius: 30 },
  create: () => new FanTheFlames(),
  telegraphs(effect) {
    const e = effect as FanTheFlames;
    if (!e.ctx) return [];
    // The real shape: a circle at each ember; it roots her until the flare.
    return e.circles.map((shape) => ({ shape, start: 0.04, impact: HIT_T }));
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as FanTheFlames;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as FanTheFlames).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
