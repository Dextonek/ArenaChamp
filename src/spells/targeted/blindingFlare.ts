import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, flashBeat } from '../../effects/parts';
import { Crystal, Glitter, PRISM, PRISM_CSS, SPECTRUM, SpectrumBeam } from '../../effects/parts/prism';
import { frameCast, type CastContext, type HitOptions } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { shapeMove } from '../../traits/tide';

/**
 * Blinding Flare (prism kit v5, E: a zone round her, no aim). Six mirror panes fly in round Opaline and a white glare builds
 * on the floor (0.25 s, a 3 m circle in the telegraph, which roots her until then). At 0.25 s the flare goes off: every enemy
 * within 3 m of where she stood (judged on its live position at that moment) is blinded for 1.5 s and pushed 2 m straight
 * away from her (`shapeMove` from `traits/tide.ts` with `high` set: a push is a `pull` toward a point behind the victim, so a
 * player and the CPU move the same metres, synced online). No damage. The flare is a white disc and ring racing out to 3 m,
 * eight spectrum rays, a pale star, a brief whiteout. `cc: true` so the CPU casts it first when someone is inside 2.4 m.
 * The panes shatter at 0.8 s; clean by about 1.5 s. See pipeline/designs/kit-prism.md.
 *
 * Both screens build the circle from `ctx.sentFrom`; the hit is decided where the victim is (each screen judges its own hero).
 */
export interface BlindingFlareSettings {
  blind: number;
  push: number;
  loop: boolean;
}

export const defaultBlindingFlare = (): BlindingFlareSettings => ({ blind: 1.5, push: 2, loop: false });

// Timeline (seconds).
const HIT_T = 0.25;
const SHATTER_T = 0.8;
const DURATION = 1.5;

const RADIUS = 3;
const COUNT = 6;
const PANE_LEN = 1.1;
const PANE_W = 0.7;
const PANE_Y = 1.2;
const PANE_R = 1.25;
const MIN = 1e-3;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class BlindingFlareFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BlindingFlareSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where she stood (from sentFrom): the centre of the circle. */
  readonly centre = new THREE.Vector3(0, 0, 14);
  private time = 0;
  private flags = { panes: false, hit: false, shattered: false };
  private idx: number[] = [];
  private angle = 0;

  private panes = new Crystal(COUNT + 1);
  private beams = new SpectrumBeam(8);
  private glitter = new Glitter(90);
  private star = new StarBurst({ points: 12, inner: 0.25, color: PRISM.foil, core: 0xffffff, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private disc: THREE.Mesh;
  private discMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  private edge: THREE.Mesh;
  private edgeMat = new THREE.MeshBasicMaterial({ color: PRISM.foil, transparent: true, opacity: 0, depthWrite: false });
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: PRISM.dark, transparent: true, opacity: 0, depthWrite: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: BlindingFlareSettings = defaultBlindingFlare()) {
    this.settings = settings;
    this.screen.whiteColor.set(0xf4f2ff);
    // A dark layer under the glare (so the white reads on a pale floor), the white disc, and a bright ring on its edge.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), this.discMat);
    this.disc.renderOrder = 2;
    this.edge = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2), this.edgeMat);
    this.edge.renderOrder = 3;
    for (const m of [this.shade, this.disc, this.edge]) m.visible = false;
    this.group.add(this.shade, this.disc, this.edge, this.panes.mesh, this.beams.mesh, this.glitter.mesh, this.star.mesh, this.groundShock.mesh);
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
    const s = ctx.sentFrom ?? ctx.from;
    this.centre.set(s.x, 0, s.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.angle = 0.3;
    this.flags.panes = this.flags.hit = this.flags.shattered = false;
    this.idx.length = 0;
    clearScreenFx(this.screen);
    this.panes.reset();
    this.beams.reset();
    this.glitter.reset();
    this.star.set(this.centre, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
    for (const m of [this.shade, this.disc, this.edge]) m.visible = false;
    this.discMat.opacity = this.edgeMat.opacity = this.shadeMat.opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.panes.update(dt);
    this.glitter.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags;
    const C = this.centre;

    if (!f.panes) {
      f.panes = true;
      for (let i = 0; i < COUNT; i++) this.idx[i] = this.panes.place(this.v1.set(C.x, PANE_Y, C.z), this.up, PANE_LEN, PANE_W, { flat: 0.2, spin: 0, scale: MIN });
      for (const m of [this.shade, this.disc, this.edge]) { m.visible = true; m.position.set(C.x, 0.03, C.z); }
    }

    // --- 0..0.25: the panes fly in and turn; a dark ring and a building white rim mark the 3 m. ---
    if (!f.shattered) {
      const k = easeOut(t / HIT_T);
      this.angle += dt * (2.5 + 7 * Math.min(1, t / HIT_T));
      const flash = f.hit ? Math.max(0, 1 - (t - HIT_T) / 0.3) : 0;
      for (let i = 0; i < COUNT; i++) {
        const a = this.angle + (i / COUNT) * Math.PI * 2;
        const r = PANE_R + (1 - k) * 1.5 + flash * 0.5;
        this.v1.set(C.x + Math.cos(a) * r, PANE_Y + (1 - k) * 0.4, C.z + Math.sin(a) * r);
        this.panes.move(this.idx[i], this.v1);
        this.panes.setRoll(this.idx[i], Math.atan2(-Math.cos(a), -Math.sin(a)));
        this.panes.setScale(this.idx[i], Math.max(f.hit ? 1 + 0.35 * flash : k, MIN));
      }
    }
    if (!f.hit) {
      const k = smoothstep(t / HIT_T);
      this.shade.position.set(C.x, 0.03, C.z);
      this.shade.scale.setScalar(RADIUS);
      this.shadeMat.opacity = 0.28 * k;
      this.edge.position.set(C.x, 0.05, C.z);
      this.edge.scale.setScalar(RADIUS * (0.35 + 0.65 * k));
      this.edgeMat.opacity = 0.55 * k;
      this.star.set(this.v1.set(C.x, 1.4, C.z), 0.5 * k, k * 0.9, t * 8);
      if (Math.random() < 0.5) this.glitter.burst(this.v1.set(C.x, PANE_Y, C.z), 1, 1.4);
    }
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.flare();
    }
    if (f.hit) this.layout(t - HIT_T);
    if (!f.shattered && t >= SHATTER_T) {
      f.shattered = true;
      this.panes.shatter(3.5, 0.5, this.v1.set(C.x, PANE_Y, C.z));
      for (let i = 0; i < COUNT; i++) {
        const a = this.angle + (i / COUNT) * Math.PI * 2;
        this.glitter.burst(this.v1.set(C.x + Math.cos(a) * PANE_R, PANE_Y, C.z + Math.sin(a) * PANE_R), 3, 2.5);
      }
    }
  }

  /** The flare goes off: the hit on whoever stands within 3 m now, the rays and the glitter. */
  private flare() {
    const ctx = this.ctx, C = this.centre, s = this.settings;
    if (ctx) {
      // Live positions at this moment, never the list frozen at the cast: every enemy alive (units too).
      for (const e of ctx.enemies?.() ?? ctx.targets) {
        const p = e.group.position;
        if (Math.hypot(p.x - C.x, p.z - C.z) > RADIUS) continue;
        const opts: HitOptions = { damage: 0, knock: 0, status: { kind: 'blind', seconds: s.blind }, color: PRISM_CSS.foil };
        shapeMove(opts, true, C, p, C, s.push);
        ctx.hit(e, opts);
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      this.v1.set(C.x + Math.cos(a) * 0.6, 1.3, C.z + Math.sin(a) * 0.6);
      this.v2.set(C.x + Math.cos(a) * RADIUS, 0.25, C.z + Math.sin(a) * RADIUS);
      this.beams.set(this.v1, this.v2, 0.5, 1, SPECTRUM[i % 4], 0.35, i);
    }
    this.glitter.burst(this.v1.set(C.x, 1.3, C.z), 30, 6, 1.5);
    this.shake = 0.3;
  }

  private layout(a: number) {
    const C = this.centre;
    // The white disc and its ring race out to 3 m and fade; the rays fade; a pale star pops.
    const k = easeOut(a / 0.22);
    this.disc.position.set(C.x, 0.04, C.z);
    this.disc.scale.setScalar(Math.max(RADIUS * k, MIN));
    this.discMat.opacity = 0.65 * Math.max(0, 1 - a / 0.55);
    this.edge.position.set(C.x, 0.05, C.z);
    this.edge.scale.setScalar(Math.max(RADIUS * (0.35 + 0.65 * k), MIN));
    this.edgeMat.opacity = Math.max(0, 1 - a / 0.7);
    this.shadeMat.opacity = 0.28 * Math.max(0, 1 - a / 0.5);
    const ray = Math.max(0, 1 - a / 0.45);
    for (let i = 0; i < 8; i++) {
      const an = (i / 8) * Math.PI * 2 + 0.2;
      this.v1.set(C.x + Math.cos(an) * (0.6 + 1.2 * k), 1.3 - 1.0 * k, C.z + Math.sin(an) * (0.6 + 1.2 * k));
      this.v2.set(C.x + Math.cos(an) * RADIUS, 0.25, C.z + Math.sin(an) * RADIUS);
      this.beams.set(this.v1, this.v2, 0.5, ray, SPECTRUM[i % 4], 0.35, i);
    }
    const sp = StarBurst.pop(a, 0.06, 0.2);
    this.star.set(this.v1.set(C.x, 1.4, C.z), 3.2 * sp.scale, sp.opacity, a * 3);
    const gp = THREE.MathUtils.clamp(a / 0.4, 0, 1);
    this.groundShock.set(C, 0.5 + RADIUS * gp, 0.04 * (1 - gp) * (1 - gp));
    const fb = flashBeat(this.time, HIT_T, 0.04, 0.22, 0.1);
    this.screen.exposure = fb.exposure;
    this.screen.whiteout = fb.whiteout * 0.5;
    this.shake *= 0.9;
  }
}

export const blindingFlareModule: EffectModule = {
  label: 'blinding flare',
  category: 'hero: prism',
  // Centred on her: the radius brings the enemies within 3 m into `ctx.targets` (the hit re-checks them live).
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new BlindingFlareFx(),
  telegraphs(effect) {
    const e = effect as BlindingFlareFx;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as BlindingFlareFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as BlindingFlareFx).settings;
    f.add(s, 'loop');
    f.add(s, 'blind', 0, 4, 0.1);
    f.add(s, 'push', 0, 4, 0.5);
  },
};
