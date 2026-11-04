import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import { DOOR, DOOR_CSS, DOOR_HEIGHT, Flecks, flatRing } from '../../effects/parts/door';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { SLAM_DAMAGE, SLAM_RADIUS, SLAM_STUN, SLAM_WIND, bookOf, standingDoors, type DoorRec } from '../../traits/door';

/**
 * Slam (door kit v5, E: both doors slam). Every door of his that stands (one or two) is the centre of a 1.5 m circle: for 0.7 s the
 * light in its crack grows hotter and wider, a red warning disc fills the circle on the floor inside a brass ring, and brass flecks
 * rattle off the frame. At 0.7 s the doors SLAM: a big star on each, a ring of force along the floor, a burst of brass, the camera
 * jolts. An enemy inside either circle at that moment, on its LIVE position (`ctx.enemies`, not the list frozen at the cast), takes 40
 * and a 0.5 s stun. A door that broke meanwhile does not slam. The circles come from the doors that stand (the trait's records,
 * the same on both screens), they are the telegraph (impact 0.7 s: he is rooted until then) and the hit shape. The CPU casts it only
 * with a door within 1.5 m of the enemy (`aiHold`). Clean by 1.7 s. See pipeline/designs/kit-door.md.
 */
export interface DoorSlamSettings {
  damage: number;
  stun: number;
  loop: boolean;
}

export const defaultDoorSlam = (): DoorSlamSettings => ({ damage: SLAM_DAMAGE, stun: SLAM_STUN, loop: false });

// Timeline (seconds).
const HIT_T = SLAM_WIND;
const DURATION = HIT_T + 1.0;
const HIT_R = SLAM_RADIUS;
const MAX_DOORS = 2;

export class DoorSlamFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DoorSlamSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The circles that are hit: one per door that stood at the cast. */
  circles: TelegraphShape[] = [];
  private recs: DoorRec[] = [];
  private time = 0;
  private slammed = false;

  private flecks = new Flecks(90);
  private stars: StarBurst[] = [];
  private shocks: ShockRefraction[] = [];
  private discs: THREE.Mesh[] = [];
  private discMats: THREE.MeshBasicMaterial[] = [];
  private rims: ReturnType<typeof flatRing>[] = [];
  private bangs: ReturnType<typeof flatRing>[] = [];
  private slits: THREE.Mesh[] = [];
  private slitMats: THREE.MeshBasicMaterial[] = [];
  private starAge = [9, 9];
  private v1 = new THREE.Vector3();

  constructor(settings: DoorSlamSettings = defaultDoorSlam()) {
    this.settings = settings;
    this.group.add(this.flecks.mesh);
    for (let i = 0; i < MAX_DOORS; i++) {
      const star = new StarBurst({ points: 9, inner: 0.3, color: DOOR.hot, core: 0xffffff, additive: false });
      const shock = new ShockRefraction({ facing: 'ground' });
      const mat = new THREE.MeshBasicMaterial({ color: DOOR.red, transparent: true, opacity: 0, depthWrite: false });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(HIT_R, 48).rotateX(-Math.PI / 2), mat);
      disc.renderOrder = 1;
      disc.visible = false;
      const rim = flatRing(HIT_R, 0.12, DOOR.brass, 0);
      rim.mesh.visible = false;
      const bang = flatRing(HIT_R, 0.3, DOOR.hot, 0);
      bang.mesh.visible = false;
      const slitMat = new THREE.MeshBasicMaterial({ color: DOOR.glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const slit = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), slitMat);
      slit.visible = false;
      slit.frustumCulled = false;
      this.stars.push(star);
      this.shocks.push(shock);
      this.discs.push(disc);
      this.discMats.push(mat);
      this.rims.push(rim);
      this.bangs.push(bang);
      this.slits.push(slit);
      this.slitMats.push(slitMat);
      this.group.add(disc, rim.mesh, bang.mesh, slit, star.mesh, shock.mesh);
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
    // The doors that stand now: the same records on both screens.
    this.recs = standingDoors(bookOf(ctx.caster)).slice(0, MAX_DOORS);
    this.circles = this.recs.map((d): TelegraphShape => ({ kind: 'circle', x: d.x, z: d.z, radius: HIT_R }));
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.slammed = false;
    this.starAge[0] = this.starAge[1] = 9;
    this.flecks.reset();
    for (let i = 0; i < MAX_DOORS; i++) {
      this.discs[i].visible = this.rims[i].mesh.visible = this.bangs[i].mesh.visible = this.slits[i].visible = false;
      this.discMats[i].opacity = this.rims[i].mat.opacity = this.bangs[i].mat.opacity = this.slitMats[i].opacity = 0;
      this.stars[i].set(this.v1.set(0, 0, 0), 0, 0);
      this.shocks[i].set(this.v1.set(0, 0, 0), 0, 0);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.flecks.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time;
    if (t >= DURATION && !this.flecks.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    for (let i = 0; i < this.recs.length; i++) {
      const d = this.recs[i];
      // A door that broke does not slam (before the hit; after it the burst plays out on its own).
      const gone = d.gone && !this.slammed;
      const k = smoothstep(t / HIT_T);
      if (!this.slammed && !gone) {
        // The warning: the crack's light grows hotter and wider, the red disc fills, brass rattles off the frame.
        this.discs[i].visible = this.rims[i].mesh.visible = this.slits[i].visible = true;
        this.discs[i].position.set(d.x, 0.03, d.z);
        this.rims[i].mesh.position.set(d.x, 0.05, d.z);
        this.discMats[i].opacity = 0.12 + 0.3 * k;
        this.rims[i].mat.opacity = 0.45 + 0.4 * Math.abs(Math.sin(t * (10 + 24 * k)));
        const w = 0.1 + 0.3 * k, h = DOOR_HEIGHT * 0.88;
        this.slits[i].scale.set(w, h, 1);
        this.slits[i].position.set(d.x + 0.44, h / 2 + 0.1, d.z + 0.12);
        this.slitMats[i].opacity = 0.25 + 0.6 * k;
        if (Math.random() < 0.15 + 0.5 * k) this.flecks.burst(this.v1.set(d.x + (Math.random() - 0.5) * 1.0, 0.4 + Math.random() * 1.8, d.z + 0.15), 1, 1.2, 0.8, 0.2);
      } else if (gone) {
        this.discMats[i].opacity = this.rims[i].mat.opacity = this.slitMats[i].opacity = 0;
      }
    }

    if (!this.slammed && t >= HIT_T) {
      this.slammed = true;
      this.slam();
    }
    if (this.slammed) {
      const a = t - HIT_T;
      for (let i = 0; i < this.recs.length; i++) {
        const d = this.recs[i];
        this.discMats[i].opacity *= Math.exp(-dt * 7);
        this.rims[i].mat.opacity *= Math.exp(-dt * 6);
        this.slitMats[i].opacity *= Math.exp(-dt * 9);
        this.bangs[i].mesh.visible = a < 0.5;
        const p = THREE.MathUtils.clamp(a / 0.4, 0, 1);
        this.bangs[i].mesh.position.set(d.x, 0.06, d.z);
        this.bangs[i].mesh.scale.setScalar(0.3 + 0.9 * p);
        this.bangs[i].mat.opacity = 0.75 * (1 - p) * (1 - p);
        this.shocks[i].set(this.v1.set(d.x, 0, d.z), 0.4 + HIT_R * 1.3 * p, 0.05 * (1 - p) * (1 - p));
        this.starAge[i] += dt;
        const sp = StarBurst.pop(this.starAge[i], 0.04, 0.16);
        this.stars[i].set(this.v1.set(d.x, DOOR_HEIGHT * 0.5, d.z), 3.0 * sp.scale + 1e-3, sp.opacity, this.starAge[i] * 4);
      }
      this.shake = Math.max(this.shake * Math.exp(-dt * 9), 0.4 * Math.exp(-a * 9));
    }
  }

  /** The doors slam: a burst on each that stands, and everyone inside a circle, on the live position, is hit and stunned. */
  private slam() {
    const ctx = this.ctx, s = this.settings;
    const live: DoorRec[] = [];
    for (let i = 0; i < this.recs.length; i++) {
      const d = this.recs[i];
      if (d.gone) continue;
      live.push(d);
      this.starAge[i] = 0;
      this.flecks.burst(this.v1.set(d.x, 1.2, d.z), 22, 6, 1.4);
      this.flecks.burst(this.v1.set(d.x, 0.2, d.z), 14, 4, 1.1, 0.1);
      this.bangs[i].mesh.visible = true;
    }
    if (live.length === 0) return;
    this.shake = 0.4;
    if (!ctx) return;
    // The live positions of every enemy, not the list frozen at the cast: whoever stands in a circle now is hit.
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const p = e.group.position;
      const door = live.find((d) => insideTelegraph({ kind: 'circle', x: d.x, z: d.z, radius: HIT_R }, p.x, p.z));
      if (!door) continue;
      ctx.hit(e, {
        damage: s.damage, knock: 2.5, from: this.v1.set(door.x, 0, door.z).clone(), color: DOOR_CSS.brass, status: { kind: 'stun', seconds: s.stun },
      });
    }
  }
}

export const doorSlamModule: EffectModule = {
  label: 'door slam',
  category: 'hero: door',
  // Cast on himself: the circles are at his doors, wherever they are.
  targeting: { mode: 'self', radius: 30 },
  create: () => new DoorSlamFx(),
  telegraphs(effect) {
    const e = effect as DoorSlamFx;
    if (!e.ctx) return [];
    // The real shape: a circle at each door; it roots him until the slam.
    return e.circles.map((shape) => ({ shape, start: 0.04, impact: HIT_T }));
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as DoorSlamFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as DoorSlamFx).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'stun', 0.1, 1.5, 0.05);
  },
};
