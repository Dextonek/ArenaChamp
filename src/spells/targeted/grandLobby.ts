import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, flashBeat, impactFrameAt } from '../../effects/parts';
import { DOOR, LOBBY_HEIGHT, Flecks, Glove, KeyFlock, flatRing } from '../../effects/parts/door';
import { stillSees } from '../../effects/channel';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import {
  LOBBY_DOORS, LOBBY_RADIUS, LOBBY_RANGE, LOBBY_WIND, bindList, bookOf, endLobby, newLobby, syncBolts, type LobbyRec,
} from '../../traits/door';

/**
 * Grand Lobby (door kit v5, R). He raises both white-gloved hands with a key turning over each, and the floor round the enemy's
 * spot (9 m, in his sight) fills with a brass ring 3 m in radius while four keys circle it, four dark door-shaped shadows mark where
 * the doors will stand, and the telegraph shows the ring (0.8 s; he is rooted until then). At 0.8 s four tall red double doors in brass
 * frames rise on the ring, a big star on each, a ring of force along the floor, an impact frame and a warm flash, and they stand for
 * 4 s. The doors are the trait's records (`newLobby` in src/traits/door.ts, from `sentFrom` and `point` only, on both screens),
 * drawn with `marks`: they are not counted against his two doors and have no HP. Each is the other's mate across the ring: walking
 * into one (within 1.1 m of its middle) sets a hero down inside the ring at the far side; the opposite doors are two `BoltDoor`s,
 * so a bolt of either side that flies into one comes out of the opposite one, his Q included, and Q fired at a near door crosses
 * the whole ring. The gap between two doors is `LOBBY_GAP` = 4.24 - 2.2 = 2.04 m: anyone can walk out through a gap. Nobody is
 * confined. If he has no sight of the spot when the doors would rise, or it is farther than 9.5 m, the ring fizzles (a puff of
 * brass, no doors) and he is free again. Clean by about 2.3 s (the doors themselves stand 4 s).
 * See pipeline/designs/kit-door.md.
 */
export interface GrandLobbySettings {
  loop: boolean;
}

export const defaultGrandLobby = (): GrandLobbySettings => ({ loop: false });

// Timeline (seconds).
const RISE_T = LOBBY_WIND;
const DURATION = RISE_T + 1.5;
const FIZZLE_SLACK = 0.5;

export class GrandLobbyFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GrandLobbySettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The ring's middle (the aim point) and the angle of its first door. */
  readonly centre = new THREE.Vector3(0, 0, 4);
  private a0 = 0;
  private time = 0;
  private risen = false;
  private fizzled = false;
  private lob: LobbyRec | null = null;
  private sparkT = 0;
  private starAge = [9, 9, 9, 9];

  private flecks = new Flecks(120);
  private keys = new KeyFlock(4, 0.5);
  private handKeys = new KeyFlock(2, 0.42);
  private gloves = [new Glove(), new Glove()];
  private stars = [0, 1, 2, 3].map((i) => new StarBurst({ points: 9, inner: 0.3, color: i % 2 ? DOOR.glow : DOOR.hot, core: 0xffffff, additive: false }));
  private shock = new ShockRefraction({ facing: 'ground' });
  private ring = flatRing(LOBBY_RADIUS, 0.14, DOOR.brass, 0);
  private bang = flatRing(LOBBY_RADIUS, 0.4, DOOR.hot, 0);
  private disc: THREE.Mesh;
  private discMat = new THREE.MeshBasicMaterial({ color: DOOR.ink, transparent: true, opacity: 0, depthWrite: false });
  private shadows: THREE.Mesh[] = [];
  private shadowMat = new THREE.MeshBasicMaterial({ color: DOOR.red, transparent: true, opacity: 0, depthWrite: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: GrandLobbySettings = defaultGrandLobby()) {
    this.settings = settings;
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(LOBBY_RADIUS, 56).rotateX(-Math.PI / 2), this.discMat);
    this.disc.renderOrder = 1;
    this.disc.visible = false;
    this.ring.mesh.visible = this.bang.mesh.visible = false;
    this.group.add(this.disc, this.ring.mesh, this.bang.mesh, this.flecks.mesh, this.keys.group, this.handKeys.group, this.shock.mesh);
    for (let i = 0; i < LOBBY_DOORS; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6).rotateX(-Math.PI / 2), this.shadowMat);
      m.renderOrder = 2;
      m.visible = false;
      this.shadows.push(m);
      this.group.add(m);
    }
    for (const g of this.gloves) this.group.add(g.group);
    for (const s of this.stars) this.group.add(s.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return RISE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the ring: only sentFrom and point.
    const s = ctx.sentFrom ?? ctx.from;
    const dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    // Turned a quarter of a gap from his line to the middle, so a gap (not a door) faces him: a straight shot crosses the ring and hits what stands in it.
    this.a0 = (Math.hypot(dx, dz) < 0.05 ? ctx.aim : Math.atan2(dx, dz)) + Math.PI / 4;
    this.centre.set(ctx.point.x, 0, ctx.point.z);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // The ring's record, on both screens: its doors stand from the rise.
    const b = bookOf(ctx.caster);
    bindList(b, ctx);
    this.lob = newLobby(b, this.centre.x, this.centre.z, this.a0, RISE_T);
    for (const d of this.lob.doors) d.ctx = ctx;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.risen = false;
    this.fizzled = false;
    this.lob = null;
    this.sparkT = 0;
    this.starAge.fill(9);
    this.flecks.reset();
    this.keys.reset();
    this.handKeys.reset();
    for (const g of this.gloves) g.hide();
    this.shock.set(this.centre, 0, 0);
    this.disc.visible = this.ring.mesh.visible = this.bang.mesh.visible = false;
    this.discMat.opacity = this.ring.mat.opacity = this.bang.mat.opacity = this.shadowMat.opacity = 0;
    for (const m of this.shadows) m.visible = false;
    for (let i = 0; i < 4; i++) this.stars[i].set(this.v1.set(0, 0, 0), 0, 0);
    clearScreenFx(this.screen);
    this.screen.impactColor.set(DOOR.hot);
    this.screen.whiteColor.set(0xffe9b8);
    this.screen.tint.set(DOOR.woodDk);
  }

  /** The doors' places on the ring (the same as `newLobby` makes). */
  private doorAt(k: number, out: THREE.Vector3) {
    const a = this.a0 + (k / LOBBY_DOORS) * Math.PI * 2;
    return out.set(this.centre.x + Math.sin(a) * LOBBY_RADIUS, 0, this.centre.z + Math.cos(a) * LOBBY_RADIUS);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.flecks.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, C = this.centre, ctx = this.ctx;
    if (t >= DURATION && !this.flecks.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- The wind-up: raised gloves with a key over each; the ring fills; four keys circle; the shadows of the doors. ---
    if (!this.risen && !this.fizzled) {
      const k = smoothstep(t / RISE_T);
      if (!this.disc.visible) {
        this.disc.visible = this.ring.mesh.visible = true;
        for (const m of this.shadows) m.visible = true;
        this.disc.position.set(C.x, 0.03, C.z);
        this.ring.mesh.position.set(C.x, 0.05, C.z);
      }
      this.discMat.opacity = 0.2 * k;
      this.ring.mesh.scale.setScalar(0.35 + 0.65 * k);
      this.ring.mat.opacity = 0.3 + 0.6 * k;
      this.shadowMat.opacity = 0.5 * k;
      for (let i = 0; i < LOBBY_DOORS; i++) {
        this.doorAt(i, this.v1);
        this.shadows[i].position.set(this.v1.x, 0.06, this.v1.z);
        this.shadows[i].rotation.y = this.a0 + (i / LOBBY_DOORS) * Math.PI * 2;
        const a = t * 5 + (i / LOBBY_DOORS) * Math.PI * 2;
        this.v2.set(C.x + Math.cos(a) * LOBBY_RADIUS * 0.9, 1.1 + 0.8 * k + 0.12 * Math.sin(t * 8 + i), C.z + Math.sin(a) * LOBBY_RADIUS * 0.9);
        this.keys.show(i, this.v2, a + Math.PI / 2, t * 12 + i * 2, 0.4 + 0.6 * k);
        if (Math.random() < 0.12) this.flecks.burst(this.v1.setY(0.1), 1, 1.4, 0.9, 1.2);
      }
      if (ctx) {
        // His hands go up with a key turning over each.
        const f = ctx.from, yaw = this.a0;
        for (let h = 0; h < 2; h++) {
          const side = h ? 1 : -1;
          this.v1.set(f.x + Math.cos(yaw) * 0.5 * side, 1.0 + 0.55 * k, f.z - Math.sin(yaw) * 0.5 * side);
          this.gloves[h].place(this.v1, yaw, 0.8 + 0.3 * k);
          this.v2.copy(this.v1).setY(this.v1.y + 0.3);
          this.handKeys.show(h, this.v2, yaw, t * 16 + h * 3, 0.5 + 0.5 * k);
        }
      }
    }
    if (!this.risen && !this.fizzled && t >= RISE_T) {
      if (this.blocked()) this.fizzle();
      else {
        this.risen = true;
        this.rise();
      }
    }

    if (this.risen) {
      const a = t - RISE_T;
      // The impact frame and a warm flash, one short beat.
      this.screen.impact = impactFrameAt(t, RISE_T, [2, 1], 0.04);
      const fb = flashBeat(t, RISE_T, 0.04, 0.25, 0.12);
      this.screen.exposure = fb.exposure;
      this.screen.whiteout = 0.5 * fb.whiteout;
      this.screen.darken = 0.25 * (1 - smoothstep(a / 0.8));
      this.discMat.opacity = 0.2 * (1 - smoothstep(a / 0.6));
      this.shadowMat.opacity *= Math.exp(-dt * 12);
      this.ring.mat.opacity = 0.9 * (1 - smoothstep(a / 0.6)) + 0.25;
      this.bang.mesh.visible = a < 0.6;
      const p = THREE.MathUtils.clamp(a / 0.5, 0, 1);
      this.bang.mesh.position.set(C.x, 0.07, C.z);
      this.bang.mesh.scale.setScalar(0.3 + 0.8 * p);
      this.bang.mat.opacity = 0.8 * (1 - p) * (1 - p);
      this.shock.set(C, 0.5 + 3.6 * p, 0.05 * (1 - p) * (1 - p));
      this.shake = Math.max(this.shake * Math.exp(-dt * 9), 0.4 * Math.exp(-a * 8));
      for (let i = 0; i < LOBBY_DOORS; i++) {
        this.starAge[i] += dt;
        const sp = StarBurst.pop(this.starAge[i], 0.04, 0.18);
        this.doorAt(i, this.v1);
        this.stars[i].set(this.v1.setY(LOBBY_HEIGHT * 0.5), 3.0 * sp.scale + 1e-3, sp.opacity, this.starAge[i] * 4);
        // The keys and the gloves go: the doors have been given.
        const k = 1 - smoothstep(a / 0.4), ang = t * 5 + (i / LOBBY_DOORS) * Math.PI * 2;
        this.v2.set(C.x + Math.cos(ang) * LOBBY_RADIUS * 0.9, 1.9 + a, C.z + Math.sin(ang) * LOBBY_RADIUS * 0.9);
        this.keys.show(i, this.v2, ang + Math.PI / 2, t * 12 + i * 2, k);
      }
      for (let h = 0; h < 2; h++) { this.gloves[h].hide(); this.handKeys.hide(h); }
      // A little glitter along the ring while the doors stand.
      this.sparkT += dt;
      if (this.sparkT >= 0.12) { this.sparkT = 0; this.doorAt(Math.floor(Math.random() * LOBBY_DOORS), this.v1); this.flecks.burst(this.v1.setY(0.4 + Math.random() * 2), 1, 1.2, 0.9, 0.2); }
    }
    if (this.fizzled) {
      this.screen.darken *= Math.exp(-dt * 6);
      this.discMat.opacity *= Math.exp(-dt * 6);
      this.ring.mat.opacity *= Math.exp(-dt * 6);
      this.shadowMat.opacity *= Math.exp(-dt * 6);
    }
  }

  /** True when he has lost sight of the spot, or it is out of reach: the ring fizzles. */
  private blocked() {
    const ctx = this.ctx;
    if (!ctx) return false;
    const from = ctx.caster.group.position;
    return !stillSees(ctx, this.centre) || Math.hypot(this.centre.x - from.x, this.centre.z - from.z) > LOBBY_RANGE + FIZZLE_SLACK;
  }

  private fizzle() {
    const ctx = this.ctx, C = this.centre;
    this.fizzled = true;
    if (ctx) {
      endLobby(bookOf(ctx.caster));
      ctx.releaseCaster?.();
    }
    for (const m of this.shadows) m.visible = false;
    this.keys.reset();
    this.handKeys.reset();
    for (const g of this.gloves) g.hide();
    this.flecks.burst(this.v1.set(C.x, 1.0, C.z), 18, 4, 1.2);
    this.shake = 0.08;
  }

  /** The doors rise: the bolt list, a star and a burst on each, the first flash. */
  private rise() {
    const ctx = this.ctx;
    if (ctx) syncBolts(bookOf(ctx.caster));
    for (let i = 0; i < LOBBY_DOORS; i++) {
      this.doorAt(i, this.v1);
      this.starAge[i] = 0;
      this.flecks.burst(this.v2.set(this.v1.x, 1.4, this.v1.z), 22, 6, 1.4);
      this.flecks.burst(this.v2.set(this.v1.x, 0.2, this.v1.z), 10, 4, 1.1, 0.1);
      this.shadows[i].visible = false;
    }
    this.bang.mesh.visible = true;
    this.shake = 0.4;
  }
}

export const grandLobbyModule: EffectModule = {
  label: 'grand lobby',
  category: 'hero: door',
  // The aim point is the middle of the ring; the radius is the ring.
  targeting: { mode: 'ground', radius: LOBBY_RADIUS },
  create: () => new GrandLobbyFx(),
  telegraphs(effect) {
    const e = effect as GrandLobbyFx;
    if (!e.ctx) return [];
    // The ring's floor: it roots him until the doors rise.
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: LOBBY_RADIUS }, start: 0.04, impact: RISE_T }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GrandLobbyFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    f.add((effect as GrandLobbyFx).settings, 'loop');
  },
};
