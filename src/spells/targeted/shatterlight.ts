import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Crystal, Glitter, PRISM, PRISM_CSS, SPECTRUM, SpectrumBeam } from '../../effects/parts/prism';
import type { Projectile } from '../../effects/projectile';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';

/**
 * Shatterlight (prism kit v5, R: a delayed ring of bolts). Click an enemy (10 m; the engine checks sight at the cast). Six
 * crystal shards rise out of a ring of radius 2.5 m round the spot the target stood on at the cast (`ctx.point`, fixed: the
 * ring does not follow them), turned inward, each tied to the middle by a thin spectral line that brightens for the full
 * 1.2 s. At 1.2 s (the telegraph's impact: a 2.5 m circle, which roots her until then) each shard fires inward through the
 * middle as a real bolt (`ctx.projectile`: radius 0.3, 14 m/s, 8 m range, `reflect: 1`): 30 each, +25% for the bounce off
 * a wall, and each hits at most once (one bolt each). Standing where lines cross takes several; stepping out of the ring
 * takes none, because the bolts are dodged by touch, not by the circle (a `projectile` hit always passes the zone check). One short
 * impact frame as they go; a flash where they cross; a flash at every wall bounce. Clean by about 2.5 s.
 *
 * The ring's angles come only from `sentFrom` and the aimed spot, so both screens draw the same ring. Network duels: bolts fly on
 * the victim's screen, so the caster's screen has no `ctx.projectile` and draws each shard along the same `bankPath` instead.
 * See pipeline/designs/kit-prism.md.
 */
export interface ShatterlightSettings {
  damage: number;
}

export const defaultShatterlight = (): ShatterlightSettings => ({ damage: 36 });

// Timeline (seconds).
const FORM_T = 0.5; // shards finish rising
const LAUNCH_T = 1.2; // the telegraph's impact: they fire
const MAX_T = 3.2;

const COUNT = 6;
const RING_R = 2.5;
const SPEED = 14;
const RANGE = 8;
const RADIUS = 0.3;
const SHARD_Y = 1.1;
const SHARD_LEN = 0.95;
const SHARD_W = 0.4;
const MIN = 1e-3;
const FLASHES = 4;
const CROSS_T = LAUNCH_T + RING_R / SPEED;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

interface Shard {
  idx: number;
  /** Where it stands on the ring (feet), and its way inward. */
  spot: THREE.Vector3;
  dir: THREE.Vector3;
  bolt: Projectile | null;
  /** Metres a drawn-only shard has flown along `path` (-1 = none yet, -2 = done). */
  drawn: number;
  path: { x: number; z: number }[];
  cum: number[];
  passed: number;
  state: 'form' | 'fly' | 'done';
  bend: THREE.Vector3;
  last: THREE.Vector3;
}

export class ShatterlightFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ShatterlightSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The middle of the ring: where the target stood at the cast. */
  readonly centre = new THREE.Vector3(0, 0, 4);
  private time = 0;
  private launched = false;
  private crossed = false;
  private goneAt = -1;
  private shards: Shard[] = [];

  private crystals = new Crystal(COUNT);
  private beams = new SpectrumBeam(COUNT);
  private glitter = new Glitter(120);
  private stars: StarBurst[] = [];
  private flash = { pos: [] as THREE.Vector3[], age: [] as number[], size: [] as number[], next: 0 };
  private mark = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: PRISM.hot, core: 0xffffff, additive: false });
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: PRISM.dark, transparent: true, opacity: 0, depthWrite: false });
  private rim: THREE.Mesh;
  private rimMat = new THREE.MeshBasicMaterial({ color: PRISM.foil, transparent: true, opacity: 0, depthWrite: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: ShatterlightSettings = defaultShatterlight()) {
    this.settings = settings;
    this.screen.impactColor.set(PRISM.foil);
    this.screen.tint.set(PRISM.dark);
    // A dark layer inside the ring and a pale ring round it: both read on a bright floor.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.rim = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 72).rotateX(-Math.PI / 2), this.rimMat);
    this.rim.renderOrder = 2;
    this.shade.visible = this.rim.visible = false;
    this.group.add(this.shade, this.rim, this.crystals.mesh, this.beams.mesh, this.glitter.mesh, this.mark.mesh);
    for (let i = 0; i < FLASHES; i++) {
      const s = new StarBurst({ points: 8, inner: 0.3, color: i % 2 ? PRISM.gold : PRISM.blue, core: 0xffffff, additive: false });
      this.stars.push(s);
      this.group.add(s.mesh);
      this.flash.pos.push(new THREE.Vector3());
      this.flash.age.push(9);
      this.flash.size.push(1);
    }
    for (let i = 0; i < COUNT; i++) {
      this.shards.push({
        idx: -1, spot: new THREE.Vector3(), dir: new THREE.Vector3(), bolt: null, drawn: -1, path: [], cum: [], passed: 0, state: 'form',
        bend: new THREE.Vector3(), last: new THREE.Vector3(),
      });
    }
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return LAUNCH_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the ring: the spot comes from the cast's point, the angles from sentFrom.
    const s = ctx.sentFrom ?? ctx.from;
    this.centre.set(ctx.point.x, 0, ctx.point.z);
    let dx = this.centre.x - s.x, dz = this.centre.z - s.z;
    if (Math.hypot(dx, dz) < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); }
    const a0 = Math.atan2(dx, dz) + Math.PI / 6;
    this.shards.forEach((sh, i) => {
      const a = a0 + (i / COUNT) * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a);
      sh.spot.set(this.centre.x + sx * RING_R, 0, this.centre.z + sz * RING_R);
      sh.dir.set(-sx, 0, -sz);
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centre).setY(1.4);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.launched = this.crossed = false;
    this.goneAt = -1;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.crystals.reset();
    this.beams.reset();
    this.glitter.reset();
    this.mark.set(this.centre, 0, 0);
    this.shade.visible = this.rim.visible = false;
    this.shadeMat.opacity = this.rimMat.opacity = 0;
    for (let i = 0; i < FLASHES; i++) { this.flash.age[i] = 9; this.stars[i].set(this.flash.pos[i], 0, 0); }
    this.flash.next = 0;
    for (const sh of this.shards) {
      sh.idx = -1;
      sh.bolt = null;
      sh.drawn = -1;
      sh.passed = 0;
      sh.state = 'form';
    }
  }

  /** A flash: a pale star and glitter at `at` (a wall bounce, a hit, the crossing). */
  private flare(at: THREE.Vector3, size: number, glitter: number) {
    const i = this.flash.next++ % FLASHES;
    this.flash.pos[i].set(at.x, SHARD_Y, at.z);
    this.flash.age[i] = 0;
    this.flash.size[i] = size;
    this.glitter.burst(this.flash.pos[i], glitter, 4, 1.3);
    this.shake = Math.max(this.shake, 0.06);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.crystals.update(dt);
    this.glitter.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, C = this.centre;

    // --- 0..0.5: the ring is drawn and the shards rise out of it, one after another; they turn inward and hum louder. ---
    if (this.shards[0].idx === -1) {
      this.shards.forEach((sh) => {
        sh.idx = this.crystals.place(this.v1.set(sh.spot.x, 0.2, sh.spot.z), sh.dir, SHARD_LEN, SHARD_W, { scale: MIN, spin: 5 });
      });
      this.shade.visible = this.rim.visible = true;
      this.shade.position.set(C.x, 0.03, C.z);
      this.rim.position.set(C.x, 0.05, C.z);
      this.shade.scale.setScalar(RING_R);
      this.rim.scale.setScalar(RING_R);
    }
    const ring = smoothstep(t / 0.3);
    const fade = this.launched ? 1 - smoothstep((t - LAUNCH_T) / 0.35) : 1;
    this.shadeMat.opacity = 0.24 * ring * fade;
    this.rimMat.opacity = (0.5 + 0.35 * smoothstep((t - 0.6) / 0.6)) * ring * fade;
    const arm = smoothstep((t - 0.3) / (LAUNCH_T - 0.3)); // 0 -> 1 as the release nears
    if (!this.launched) {
      this.shards.forEach((sh, i) => {
        const k = easeOut((t - i * 0.05) / (FORM_T - 0.3));
        const hum = 1 + 0.12 * arm * Math.sin(t * (18 + 20 * arm) + i);
        this.crystals.setScale(sh.idx, Math.max(k * hum, MIN));
        this.crystals.move(sh.idx, this.v1.set(sh.spot.x, 0.2 + (SHARD_Y - 0.2) * k, sh.spot.z), sh.dir);
        // A thin spectral line from the shard through to the middle: it brightens as the release nears.
        this.v2.set(sh.spot.x, SHARD_Y, sh.spot.z);
        this.v3.set(C.x, 0.3, C.z);
        this.beams.set(this.v2, this.v3, 0.4, (0.25 + 0.65 * arm) * Math.min(1, k), SPECTRUM[i % 4], 0.5, i);
      });
      // The middle: a small four-point glint that swells and spins.
      this.mark.set(this.v1.set(C.x, 0.4, C.z), 0.35 + 0.55 * arm, ring, t * 3);
      this.screen.darken = 0.18 * smoothstep(t / 0.5);
    }

    // --- 1.2: they fire. ---
    if (!this.launched && t >= LAUNCH_T) {
      this.launched = true;
      this.launch();
    }
    if (this.launched) {
      this.screen.impact = impactFrameAt(t, LAUNCH_T, [2], 0.04);
      this.screen.darken = 0.18 * (1 - smoothstep((t - LAUNCH_T) / 0.5));
      this.fly(dt);
      if (!this.crossed && t >= CROSS_T) {
        this.crossed = true;
        this.flare(this.v1.set(C.x, 0, C.z), 1.7, 18);
        this.mark.set(this.v1, 0, 0);
      }
      this.shake *= Math.exp(-dt * 10);
    }

    const flying = this.shards.some((sh) => sh.state !== 'done');
    if (this.launched && !flying && this.goneAt < 0) this.goneAt = t;
    for (let i = 0; i < FLASHES; i++) {
      this.flash.age[i] += dt;
      const sp = StarBurst.pop(this.flash.age[i], 0.05, 0.16);
      this.stars[i].set(this.flash.pos[i], this.flash.size[i] * sp.scale, sp.opacity, this.flash.age[i] * 4);
    }
    if ((this.goneAt >= 0 && t >= this.goneAt + 0.7 && !this.glitter.busy && !this.crystals.busy) || t >= MAX_T) {
      this.playing = false;
      this.reset();
    }
  }

  /** The release: each shard becomes a bolt (or, with no bolts on this screen, a drawn bolt along the same path). */
  private launch() {
    const ctx = this.ctx;
    this.beams.reset();
    this.mark.set(this.centre, 0, 0);
    this.shake = 0.2;
    this.shards.forEach((sh) => {
      sh.state = 'fly';
      sh.bend.set(sh.spot.x, SHARD_Y, sh.spot.z);
      this.glitter.burst(this.v1.set(sh.spot.x, SHARD_Y, sh.spot.z), 4, 2.5);
      if (ctx?.projectile) {
        sh.bolt = ctx.projectile({
          from: sh.spot.clone(), dir: sh.dir.clone(), speed: SPEED, range: RANGE, radius: RADIUS,
          hit: { damage: this.settings.damage, knock: 1, color: PRISM_CSS.body },
          reflect: 1,
          onReflect: (_b, at) => { sh.bend.set(at.x, SHARD_Y, at.z); this.flare(at, 1.2, 8); },
        });
        sh.bolt.onHit((_target, at, b) => this.flare(this.v1.set(at.x, 0, at.z), 1.0 + 0.3 * b.reflections, 10));
      } else {
        sh.path = bankPath(sh.spot, sh.dir, RANGE, 1, ctx?.obstacles?.() ?? [], 2);
        sh.cum = [0];
        for (let i = 1; i < sh.path.length; i++) {
          sh.cum.push(sh.cum[i - 1] + Math.hypot(sh.path[i].x - sh.path[i - 1].x, sh.path[i].z - sh.path[i - 1].z));
        }
        sh.drawn = 0;
        sh.passed = 0;
      }
    });
  }

  /** Moves each shard's crystal with its bolt and lays its trail. */
  private fly(dt: number) {
    this.shards.forEach((sh, i) => {
      if (sh.state !== 'fly') return;
      let live = false;
      const pos = this.v1, dir = this.v2;
      if (sh.bolt) {
        live = sh.bolt.alive;
        if (live) { pos.copy(sh.bolt.pos); dir.copy(sh.bolt.dir); }
      } else if (sh.drawn >= 0) {
        sh.drawn += SPEED * dt;
        const total = sh.cum[sh.cum.length - 1];
        live = sh.drawn < total;
        if (live) {
          let k = 1;
          while (k < sh.cum.length - 1 && sh.drawn > sh.cum[k]) k++;
          const a = sh.path[k - 1], b = sh.path[k], l = Math.max(1e-4, sh.cum[k] - sh.cum[k - 1]);
          const u = THREE.MathUtils.clamp((sh.drawn - sh.cum[k - 1]) / l, 0, 1);
          pos.set(a.x + (b.x - a.x) * u, SHARD_Y, a.z + (b.z - a.z) * u);
          dir.set(b.x - a.x, 0, b.z - a.z).normalize();
          while (sh.passed < sh.path.length - 2 && sh.drawn >= sh.cum[sh.passed + 1]) {
            sh.passed++;
            sh.bend.set(sh.path[sh.passed].x, SHARD_Y, sh.path[sh.passed].z);
            this.flare(sh.bend, 1.2, 8);
          }
        }
      }
      if (live) {
        sh.last.copy(pos);
        this.crystals.move(sh.idx, pos, dir);
        this.crystals.setScale(sh.idx, 1);
        const back = Math.min(1.4, Math.hypot(pos.x - sh.bend.x, pos.z - sh.bend.z) + 0.05);
        this.v3.copy(pos).addScaledVector(dir, -back);
        this.beams.set(this.v3, pos, 0.4, 0.9, SPECTRUM[i % 4], 0.1, i);
      } else {
        sh.state = 'done';
        this.beams.hide(i);
        this.crystals.hide(sh.idx);
        // A shard that ended (a hit, max range, or a wall past its bounce) pops into a little glitter where it was.
        this.glitter.burst(sh.last, 4, 2);
      }
    });
  }
}

export const shatterlightModule: EffectModule = {
  label: 'shatterlight',
  category: 'hero: prism',
  // A click on the enemy (the engine checks sight at the cast); the ring is built round the spot they stood on.
  targeting: { mode: 'enemy' },
  create: () => new ShatterlightFx(),
  telegraphs(effect) {
    const e = effect as ShatterlightFx;
    if (!e.ctx) return [];
    // The ring she roots for. The shards are bolts, so this is the warning and the root, not the gate: a `projectile` hit always passes.
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: RING_R + 0.7 }, start: 0.04, impact: LAUNCH_T }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ShatterlightFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as ShatterlightFx).settings;
    f.add(s, 'damage', 0, 100, 1);
  },
};
