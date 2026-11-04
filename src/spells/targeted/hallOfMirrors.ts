import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { Gleam, HandMirrors, MIRROR, MIRROR_CSS, Slivers } from '../../effects/parts/mirror';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';
import {
  BANK_BONUS, BANK_RANGE, HALL_BOUNCES, HALL_COUNT, HALL_DAMAGE, HALL_LANDED, HALL_RANGE, HALL_SPEED, HALL_WIND, REST_SECONDS, bookOf,
  sweepMarks, type MirrorMark,
} from '../../traits/mirror';

/**
 * Hall of Mirrors (mirror kit v5, R: eight mirrors outward). A 0.6 s spin: eight hand mirrors rise round Silvane in a ring and
 * whirl one and a quarter turns while thin pale spokes brighten along their eight lines on the floor (the telegraph: a spoke at the
 * aim, the others every 45 degrees, so the GAPS are drawn and plain to read: at 3 m a gap is 2.3 m wide, wider than a body). At
 * 0.6 s each mirror is thrown outward as a real bolt (`ctx.projectile`: 16 m/s, 12 m from her, radius 0.3, `reflect: 2`): 30 each,
 * +25% per bounce, one bolt each so each hits at most once; standing where two paths cross after a bounce can take several. One short
 * impact frame as they go; a flash at every bounce and hit. Clean by about 2.5 s.
 *
 * The catch: up to 4 of the mirrors that end after a bounce (the four whose end is nearest her, from `bankPath`, the same on both
 * screens) lie on the floor for 2.5 s as ground marks (`mirrorBooks`, drawn by `Trait.marks`, violet rim). Walking within 1 m of one
 * catches it (the trait's `tick`): each cuts 2 s off Hall of Mirrors.
 *
 * Telegraph: eight lines, each the first leg of its path (to where it first bounces), as wide as the bolt really hits (`boltWidth`),
 * from the cast to the launch (0.6 s, the root on her), and later legs are not drawn. The bolts are dodged by touch (a `projectile` hit
 * always passes the zone check). Network duels: bolts fly on the victim's screen, so the caster's screen draws each mirror along
 * the same `bankPath`. The directions come from the cast's aim point (hero mode), else the cast's yaw, else the nearest enemy.
 * See pipeline/designs/kit-mirror.md.
 */
export interface HallOfMirrorsSettings {
  damage: number;
}

export const defaultHallOfMirrors = (): HallOfMirrorsSettings => ({ damage: HALL_DAMAGE });

// Timeline (seconds).
const LAUNCH_T = HALL_WIND;
const MAX_T = 3.0;
const MUZZLE = 0.9;
const RADIUS = 0.3;
const LINE_W = boltWidth(RADIUS);
const SHARD_Y = 1.1;
const FLASHES = 5;
const TURNS = 1.25;
const MIN = 1e-3;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

interface Spoke {
  idx: number;
  ang: number;
  dir: THREE.Vector3;
  bolt: Projectile | null;
  /** Metres a drawn-only mirror has flown along `path` (-1 = none yet). */
  drawn: number;
  path: { x: number; z: number }[];
  cum: number[];
  passed: number;
  state: 'spin' | 'fly' | 'done';
  bend: THREE.Vector3;
  last: THREE.Vector3;
}

export class HallOfMirrorsFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: HallOfMirrorsSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Her feet at the cast, and the eight spokes. */
  readonly centre = new THREE.Vector3(0, 0, 4);
  private time = 0;
  private launched = false;
  private goneAt = -1;
  private playedAt = 0;
  private spokes: Spoke[] = [];
  private landing: number[] = [];

  private mirrors = new HandMirrors(HALL_COUNT);
  private spokeGleam = new Gleam(HALL_COUNT);
  private trails = new Gleam(HALL_COUNT);
  private slivers = new Slivers(130);
  private stars: StarBurst[] = [];
  private flash = { pos: [] as THREE.Vector3[], age: [] as number[], size: [] as number[], next: 0 };
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: MIRROR.dark, transparent: true, opacity: 0, depthWrite: false });
  private rim: THREE.Mesh;
  private rimMat = new THREE.MeshBasicMaterial({ color: MIRROR.foil, transparent: true, opacity: 0, depthWrite: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: HallOfMirrorsSettings = defaultHallOfMirrors()) {
    this.settings = settings;
    this.screen.impactColor.set(MIRROR.foil);
    this.screen.tint.set(MIRROR.dark);
    // A dark layer inside the spin and a pale ring round it: both read on a bright floor.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 56).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.rim = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 72).rotateX(-Math.PI / 2), this.rimMat);
    this.rim.renderOrder = 2;
    this.shade.visible = this.rim.visible = false;
    this.group.add(this.shade, this.rim, this.mirrors.mesh, this.spokeGleam.mesh, this.trails.mesh, this.slivers.mesh);
    for (let i = 0; i < FLASHES; i++) {
      const s = new StarBurst({ points: 8, inner: 0.3, color: i % 2 ? MIRROR.violet : MIRROR.body, core: 0xffffff, additive: false });
      this.stars.push(s);
      this.group.add(s.mesh);
      this.flash.pos.push(new THREE.Vector3());
      this.flash.age.push(9);
      this.flash.size.push(1);
    }
    for (let i = 0; i < HALL_COUNT; i++) {
      this.spokes.push({
        idx: -1, ang: 0, dir: new THREE.Vector3(), bolt: null, drawn: -1, path: [], cum: [], passed: 0, state: 'spin',
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
    // Both screens must agree on the spokes: the spot and angles come from sentFrom and the aim only.
    const s = ctx.sentFrom ?? ctx.from;
    this.centre.set(s.x, 0, s.z);
    const dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let a0: number;
    if (Math.hypot(dx, dz) > 0.5) a0 = Math.atan2(dx, dz);
    else if (Math.abs(ctx.aim) > 1e-4) a0 = ctx.aim;
    else {
      // The CPU's self cast: no aim of its own, so the nearest enemy.
      let best = Infinity;
      a0 = 0;
      for (const e of ctx.enemies?.() ?? []) {
        if (e === ctx.caster) continue;
        const ex = e.group.position.x - s.x, ez = e.group.position.z - s.z, d = Math.hypot(ex, ez);
        if (d < best && d > 0.1) { best = d; a0 = Math.atan2(ex, ez); }
      }
    }
    const obstacles = ctx.obstacles?.() ?? [];
    this.spokes.forEach((sp, i) => {
      sp.ang = a0 + (i / HALL_COUNT) * Math.PI * 2;
      sp.dir.set(Math.sin(sp.ang), 0, Math.cos(sp.ang));
      this.v1.set(s.x + sp.dir.x * MUZZLE, 0, s.z + sp.dir.z * MUZZLE);
      sp.path = bankPath(this.v1, sp.dir, HALL_RANGE - MUZZLE, HALL_BOUNCES, obstacles, BANK_RANGE);
      sp.path[0] = { x: s.x, z: s.z };
      sp.cum = [0];
      for (let k = 1; k < sp.path.length; k++) sp.cum.push(sp.cum[k - 1] + Math.hypot(sp.path[k].x - sp.path[k - 1].x, sp.path[k].z - sp.path[k - 1].z));
    });
    // The mirrors that lie on the floor: after a bounce, the four whose end is nearest her (ties by spoke number).
    this.landing = this.spokes
      .map((sp, i) => ({ i, n: sp.path.length, d: Math.hypot(sp.path[sp.path.length - 1].x - s.x, sp.path[sp.path.length - 1].z - s.z) }))
      .filter((c) => c.n >= 3)
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, HALL_LANDED)
      .map((c) => c.i);
  }

  /** The eight telegraph lines: the first leg of each path, `boltWidth` wide. */
  spokeSpecs(): TelegraphSpec[] {
    return this.spokes.map((sp) => {
      const a = sp.path[0], b = sp.path[1] ?? sp.path[0];
      return {
        shape: { kind: 'line', x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: LINE_W },
        start: 0.04,
        impact: LAUNCH_T,
        until: LAUNCH_T + Math.max(0, (sp.cum[1] ?? 0) - MUZZLE) / HALL_SPEED,
      } as TelegraphSpec;
    });
  }

  play() {
    this.reset();
    this.playing = true;
    this.playedAt = performance.now();
    this.register();
  }

  /** Writes the floor mirrors (both screens, from the paths alone). */
  private register() {
    const ctx = this.ctx;
    if (!ctx) return;
    const b = bookOf(ctx.caster), base = ++b.seq * 16;
    sweepMarks(b);
    for (const i of this.landing) {
      const sp = this.spokes[i], n = sp.path.length, a = sp.path[n - 2], e = sp.path[n - 1];
      const l = Math.hypot(e.x - a.x, e.z - a.z) || 1;
      const flight = LAUNCH_T + (sp.cum[n - 1] - MUZZLE) / HALL_SPEED;
      const m: MirrorMark = {
        id: base + i + 1, x: e.x - ((e.x - a.x) / l) * 0.25, z: e.z - ((e.z - a.z) / l) * 0.25, kind: 'hall',
        bornAt: this.playedAt + flight * 1000, until: this.playedAt + (flight + REST_SECONDS) * 1000, yaw: Math.atan2(e.x - a.x, e.z - a.z), gone: false,
      };
      b.marks.push(m);
    }
  }

  private reset() {
    this.time = 0;
    this.launched = false;
    this.goneAt = -1;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.mirrors.reset();
    this.spokeGleam.reset();
    this.trails.reset();
    this.slivers.reset();
    this.shade.visible = this.rim.visible = false;
    this.shadeMat.opacity = this.rimMat.opacity = 0;
    for (let i = 0; i < FLASHES; i++) { this.flash.age[i] = 9; this.stars[i].set(this.flash.pos[i], 0, 0); }
    this.flash.next = 0;
    for (const sp of this.spokes) {
      sp.idx = -1;
      sp.bolt = null;
      sp.drawn = -1;
      sp.passed = 0;
      sp.state = 'spin';
    }
  }

  /** A flash: a pale star and slivers at `at` (a bounce, a hit, the end). */
  private flare(at: THREE.Vector3, size: number, slivers: number) {
    const i = this.flash.next++ % FLASHES;
    this.flash.pos[i].set(at.x, SHARD_Y, at.z);
    this.flash.age[i] = 0;
    this.flash.size[i] = size;
    this.slivers.burst(this.flash.pos[i], slivers, 4, 1.3);
    this.shake = Math.max(this.shake, 0.06);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.mirrors.update(dt);
    this.slivers.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, C = this.centre;

    // --- 0..0.6: the mirrors rise round her and whirl; the spokes brighten on the floor. ---
    if (this.spokes[0].idx === -1) {
      this.spokes.forEach((sp) => { sp.idx = this.mirrors.place(this.v1.set(C.x, SHARD_Y, C.z), sp.ang, MIN, 18); });
      this.shade.visible = this.rim.visible = true;
      this.shade.position.set(C.x, 0.03, C.z);
      this.rim.position.set(C.x, 0.05, C.z);
    }
    const arm = smoothstep(t / LAUNCH_T);
    if (!this.launched) {
      const ring = smoothstep(t / 0.25);
      const r = 1.0 + 0.5 * easeOut(t / LAUNCH_T);
      this.shade.scale.setScalar(r + 0.3);
      this.rim.scale.setScalar(r + 0.3);
      this.shadeMat.opacity = 0.24 * ring;
      this.rimMat.opacity = (0.5 + 0.35 * arm) * ring;
      this.spokes.forEach((sp, i) => {
        // They whirl TURNS turns and settle on their own spoke as they launch.
        const phi = sp.ang - TURNS * Math.PI * 2 * (1 - easeOut(t / LAUNCH_T));
        const k = easeOut((t - i * 0.02) / 0.3);
        this.mirrors.move(sp.idx, this.v1.set(C.x + Math.sin(phi) * r, SHARD_Y, C.z + Math.cos(phi) * r), phi);
        this.mirrors.setScale(sp.idx, Math.max(k, MIN));
        this.mirrors.setSpin(sp.idx, 10 + 18 * arm);
        // A thin pale line along its spoke: it brightens toward the release.
        const leg = Math.min(sp.cum[1] ?? 12, HALL_RANGE);
        this.v2.set(C.x + sp.dir.x * MUZZLE, 0.3, C.z + sp.dir.z * MUZZLE);
        this.v3.set(C.x + sp.dir.x * leg, 0.3, C.z + sp.dir.z * leg);
        this.spokeGleam.set(this.v2, this.v3, 0.3, (0.2 + 0.55 * arm) * Math.min(1, k), i % 2 ? MIRROR.violet : MIRROR.body, 0.4, i);
      });
      this.screen.darken = 0.16 * smoothstep(t / 0.5);
    }

    // --- 0.6: they are thrown. ---
    if (!this.launched && t >= LAUNCH_T) {
      this.launched = true;
      this.launch();
    }
    if (this.launched) {
      this.screen.impact = impactFrameAt(t, LAUNCH_T, [2], 0.04);
      this.screen.darken = 0.16 * (1 - smoothstep((t - LAUNCH_T) / 0.5));
      const fade = 1 - smoothstep((t - LAUNCH_T) / 0.35);
      this.shadeMat.opacity = 0.24 * fade;
      this.rimMat.opacity = 0.85 * fade;
      this.fly(dt);
      this.shake *= Math.exp(-dt * 10);
    }

    const flying = this.spokes.some((sp) => sp.state !== 'done');
    if (this.launched && !flying && this.goneAt < 0) this.goneAt = t;
    for (let i = 0; i < FLASHES; i++) {
      this.flash.age[i] += dt;
      const sp = StarBurst.pop(this.flash.age[i], 0.05, 0.16);
      this.stars[i].set(this.flash.pos[i], this.flash.size[i] * sp.scale, sp.opacity, this.flash.age[i] * 4);
    }
    if ((this.goneAt >= 0 && t >= this.goneAt + 0.7 && !this.slivers.busy) || t >= MAX_T) {
      this.playing = false;
      this.reset();
    }
  }

  /** The release: each mirror becomes a bolt (or, with no bolts on this screen, a drawn bolt along the same path). */
  private launch() {
    const ctx = this.ctx, C = this.centre;
    this.spokeGleam.reset();
    this.shake = 0.22;
    this.spokes.forEach((sp, i) => {
      sp.state = 'fly';
      this.v1.set(C.x + sp.dir.x * MUZZLE, SHARD_Y, C.z + sp.dir.z * MUZZLE);
      sp.bend.copy(this.v1);
      this.mirrors.setSpin(sp.idx, 20);
      this.slivers.burst(this.v1, 3, 2.5);
      if (ctx?.projectile) {
        sp.bolt = ctx.projectile({
          from: this.v1.clone().setY(0), dir: sp.dir.clone(), speed: HALL_SPEED, range: HALL_RANGE - MUZZLE, radius: RADIUS,
          hit: { damage: this.settings.damage, knock: 1, color: MIRROR_CSS.body },
          reflect: HALL_BOUNCES, reflectRange: BANK_RANGE, reflectBonus: BANK_BONUS,
          onReflect: (_b, at) => { sp.bend.set(at.x, SHARD_Y, at.z); this.flare(at, 1.2, 8); },
        });
        sp.bolt.onHit((_target, at, b) => { sp.state = 'done'; this.endSpoke(sp, i, at, 1.0 + 0.3 * b.reflections, 12); });
      } else {
        sp.drawn = 0;
        sp.passed = 0;
      }
    });
  }

  /** A mirror ended: it leaves the air (a floor mark may take over) and bursts into a little glass where it was. */
  private endSpoke(sp: Spoke, i: number, at: THREE.Vector3, size: number, slivers: number) {
    this.mirrors.hide(sp.idx);
    this.trails.hide(i);
    this.flare(this.v3.copy(at).setY(0), size, slivers);
  }

  /** Moves each mirror with its bolt and lays its trail. */
  private fly(dt: number) {
    this.spokes.forEach((sp, i) => {
      if (sp.state !== 'fly') return;
      let live = false;
      const pos = this.v1, dir = this.v2;
      if (sp.bolt) {
        live = sp.bolt.alive;
        if (live) { pos.copy(sp.bolt.pos); dir.copy(sp.bolt.dir); }
      } else if (sp.drawn >= 0) {
        sp.drawn += HALL_SPEED * dt;
        const total = sp.cum[sp.cum.length - 1] - MUZZLE;
        live = sp.drawn < total;
        if (live) {
          const d = sp.drawn + MUZZLE;
          let k = 1;
          while (k < sp.cum.length - 1 && d > sp.cum[k]) k++;
          const a = sp.path[k - 1], b = sp.path[k], l = Math.max(1e-4, sp.cum[k] - sp.cum[k - 1]);
          const u = THREE.MathUtils.clamp((d - sp.cum[k - 1]) / l, 0, 1);
          pos.set(a.x + (b.x - a.x) * u, SHARD_Y, a.z + (b.z - a.z) * u);
          dir.set(b.x - a.x, 0, b.z - a.z).normalize();
          while (sp.passed < sp.path.length - 2 && d >= sp.cum[sp.passed + 1]) {
            sp.passed++;
            sp.bend.set(sp.path[sp.passed].x, SHARD_Y, sp.path[sp.passed].z);
            this.flare(sp.bend, 1.2, 8);
          }
        }
      }
      if (live) {
        sp.last.copy(pos);
        this.mirrors.move(sp.idx, pos, Math.atan2(dir.x, dir.z));
        this.mirrors.setScale(sp.idx, 1);
        const back = Math.min(1.3, Math.hypot(pos.x - sp.bend.x, pos.z - sp.bend.z) + 0.05);
        this.v3.copy(pos).addScaledVector(dir, -back);
        this.trails.set(this.v3, pos, 0.28, 0.8, i % 2 ? MIRROR.violet : undefined, 0.1, i);
      } else {
        sp.state = 'done';
        // It ended without a hit (max range, or a wall past its bounces): a floor mark takes over, or a pop of glass.
        this.endSpoke(sp, i, sp.last, 1.0, this.landing.includes(i) ? 5 : 8);
      }
    });
  }
}

export const hallOfMirrorsModule: EffectModule = {
  label: 'hall of mirrors',
  category: 'hero: mirror',
  // A spin round her: no click. The mirrors are bolts, so the radius only sizes the marker and the AI's reach.
  targeting: { mode: 'self', radius: 3 },
  create: () => new HallOfMirrorsFx(),
  telegraphs(effect) {
    const e = effect as HallOfMirrorsFx;
    if (!e.ctx) return [];
    // The eight spokes, each the first leg of its path, as wide as the bolt hits. They are the warning and the root, not the gate:
    // a `projectile` hit always passes the zone check.
    return e.spokeSpecs();
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as HallOfMirrorsFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    f.add((effect as HallOfMirrorsFx).settings, 'damage', 0, 100, 1);
  },
};
