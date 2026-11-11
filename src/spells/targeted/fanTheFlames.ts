import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { PHOENIX, PHOENIX_CSS, disc, ring } from '../../effects/parts/phoenix';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { FLARE_DAMAGE, FLARE_RADIUS, FLARE_WIND, MAX_EMBERS, burnOut, embersOf, type Ember } from '../../traits/phoenix';

/**
 * Fan the Flames (phoenix kit, W: no aim). One sweep of the fan: every ember of hers that burns is the centre of a 2.2 m
 * ring. For 0.8 s each ring fills; then they flare: an enemy inside any of them at that moment, on its LIVE position
 * (`ctx.enemies`, not the list frozen at the cast), takes 60, once, however many rings it stands in. An ember stamped out
 * meanwhile does not flare. Then every ember burns out (the trait's `burnOut`, both screens): she has no nest until the
 * next quill lands. The rings come from the embers at the cast (the trait's records, the same on both screens): they are
 * the telegraph (impact 0.8 s: she is rooted until then) and the hit shape. 2.2 m takes 0.8 s to leave with a reaction, so
 * the answer holds from the very middle. The CPU casts it only with the enemy inside a ring (`aiHold`). Clean by 1.6 s.
 *
 * PLACEHOLDER LOOK (gate 4, first step): a disc that fills and a ring that bursts.
 */
export interface FanTheFlamesSettings {
  damage: number;
  loop: boolean;
}

export const defaultFanTheFlames = (): FanTheFlamesSettings => ({ damage: FLARE_DAMAGE, loop: false });

const HIT_T = FLARE_WIND;
const DURATION = HIT_T + 0.8;
const HIT_R = FLARE_RADIUS;

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

  private discs: THREE.Mesh[] = [];
  private rims: THREE.Mesh[] = [];
  private bangs: THREE.Mesh[] = [];

  constructor(settings: FanTheFlamesSettings = defaultFanTheFlames()) {
    this.settings = settings;
    for (let i = 0; i < MAX_EMBERS; i++) {
      const d = disc(HIT_R, PHOENIX.body, 0, 0.03), r = ring(HIT_R, PHOENIX.hot, 0, 0.05, 0.08), b = ring(HIT_R, PHOENIX.core, 0, 0.06, 0.5);
      this.discs.push(d);
      this.rims.push(r);
      this.bangs.push(b);
      this.group.add(d, r, b);
    }
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
    for (let i = 0; i < MAX_EMBERS; i++) this.discs[i].visible = this.rims[i].visible = this.bangs[i].visible = false;
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
    for (let i = 0; i < this.recs.length; i++) {
      const e = this.recs[i];
      if (!this.flared) {
        const on = !live || live.has(e.id);
        this.discs[i].visible = this.rims[i].visible = on;
        this.discs[i].position.set(e.x, 0.03, e.z);
        this.rims[i].position.set(e.x, 0.05, e.z);
        this.discs[i].scale.setScalar(Math.max(0.05, k));
        this.mat(this.discs[i]).opacity = 0.15 + 0.3 * k;
        this.mat(this.rims[i]).opacity = 0.5 + 0.4 * Math.abs(Math.sin(t * (8 + 20 * k)));
      } else {
        const a = t - HIT_T, p = Math.min(1, a / 0.4);
        this.discs[i].visible = this.rims[i].visible = false;
        this.bangs[i].visible = !!this.lit[i] && a < 0.5;
        this.bangs[i].position.set(e.x, 0.06, e.z);
        this.bangs[i].scale.setScalar(0.3 + 0.8 * p);
        this.mat(this.bangs[i]).opacity = 0.85 * (1 - p) * (1 - p);
      }
    }
    if (!this.flared && t >= HIT_T) {
      this.flared = true;
      this.flare();
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
