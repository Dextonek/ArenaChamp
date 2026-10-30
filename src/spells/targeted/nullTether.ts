import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import { AshMotes, Crackle, Rift, Shards, VOID, VOID_CSS } from '../../effects/parts/void';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Null Tether (void kit, W: drag everyone in). Glass-like cracks spread over the zone (0..0.3 s), then four black
 * tendril-rifts race along the ground from the zone to Oblivion's feet (0.3..0.6 s). At 0.65 s the tears snap taut and
 * yank: every enemy still inside the zone is hit, dragged toward him and slowed, and shards stream along the tears
 * toward him. From 0.8 s the tears close and the cracks fade. Clean by 1.8 s. See pipeline/designs/kit-void.md.
 */
export interface NullTetherSettings {
  damage: number;
  loop: boolean;
}

export const defaultNullTether = (): NullTetherSettings => ({ damage: 36, loop: false });

// Timeline (seconds).
const TENDRIL_T = 0.3;
const HIT_T = 0.65;
const CLOSE_T = 0.8;
const DURATION = 1.8;
const RADIUS = 3.5;
const TENDRILS = 4;

export class NullTether implements Effect {
  readonly group = new THREE.Group();
  readonly settings: NullTetherSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { crack: false, tendrils: false, hit: false, close: false };

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, 8);
  private from = new THREE.Vector3();
  private starts: THREE.Vector3[] = [];

  // Parts.
  private crackle = new Crackle();
  private rift = new Rift(TENDRILS + 1, true);
  private shards = new Shards(12);
  private motes = new AshMotes(24);

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: NullTetherSettings = defaultNullTether()) {
    this.settings = settings;
    this.screen.impactColor.set(VOID.hot);
    this.screen.tint.set(VOID.dark);
    for (let i = 0; i < TENDRILS; i++) this.starts.push(new THREE.Vector3());
    this.group.add(this.crackle.mesh, this.rift.mesh, this.shards.mesh, this.motes.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the pull are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.from.copy(ctx.from).setY(0);
    // Tendril roots spread round the zone, leaning toward the far side so they cross the whole circle.
    const toward = Math.atan2(this.point.x - this.from.x, this.point.z - this.from.z);
    for (let i = 0; i < TENDRILS; i++) {
      const a = toward + ((i + 0.5) / TENDRILS - 0.5) * 2.6 + (i % 2 ? 0.15 : -0.1);
      const r = RADIUS * (0.55 + 0.3 * ((i * 37) % 10) / 10);
      this.starts[i].set(this.point.x + Math.sin(a) * r, 0.03, this.point.z + Math.cos(a) * r);
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(1);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    const f = this.flags;
    f.crack = f.tendrils = f.hit = f.close = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(VOID.dark);
    this.crackle.reset();
    this.rift.reset();
    this.shards.reset();
    this.motes.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crackle.update(dt);
    this.rift.update(dt);
    this.shards.update(dt);
    this.motes.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;

    // 0..0.3: the cracks spread over the zone.
    if (!f.crack) {
      f.crack = true;
      this.crackle.width = 0.6;
      this.crackle.grow(this.point, RADIUS, 0.3);
      this.motes.emit(this.v1.copy(this.point).setY(0), RADIUS * 0.7, 8);
    }
    // 0.3..0.6: black tendrils race along the ground from the zone to his feet.
    if (!f.tendrils && t >= TENDRIL_T) {
      f.tendrils = true;
      for (let i = 0; i < TENDRILS; i++) {
        const s = this.starts[i];
        const pts: THREE.Vector3[] = [];
        const n = 12;
        // A shallow curve: the middle bows to one side, alternating, so they do not read as spokes.
        const side = i % 2 ? 1 : -1;
        const dx = this.from.x - s.x, dz = this.from.z - s.z;
        const len = Math.hypot(dx, dz) || 1;
        const px = -dz / len, pz = dx / len;
        for (let k = 0; k < n; k++) {
          const u = k / (n - 1);
          const bow = Math.sin(Math.PI * u) * len * 0.09 * side;
          pts.push(new THREE.Vector3(s.x + dx * u + px * bow, 0.035, s.z + dz * u + pz * bow));
        }
        this.rift.openPath(pts, new THREE.Vector3(0, 1, 0), 0.5 + (i % 3) * 0.06, 0.3, { sweep: 0.3, seed: 11 + i * 7, wedge: true });
      }
    }
    // 0.65: the tears snap taut and yank.
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.rift.snap();
      this.rift.flare(1, 0.12);
      this.shake = 0.3;
      // Shards stream along the tears toward him.
      this.v2.copy(this.from).setY(0.9);
      for (let i = 0; i < TENDRILS; i++) this.shards.drift(this.starts[i], this.v2, 3, 0.55, 0.4, 0.45);
      if (ctx) {
        for (const e of ctx.targets) {
          if (!this.inside(e)) continue;
          ctx.hit(e, { damage: this.settings.damage, knock: 0, pull: 4, color: VOID_CSS.body, status: { kind: 'slow', seconds: 1.0 } });
        }
      }
    }
    // 0.8..1.6: the tears close and the cracks fade.
    if (!f.close && t >= CLOSE_T) {
      f.close = true;
      this.rift.close(0.7);
      this.crackle.fade(0.8);
    }

    if (f.hit) {
      const after = t - HIT_T;
      this.shake = 0.3 * Math.exp(-after * 10);
    }
  }
}

export const nullTetherModule: EffectModule = {
  label: 'null tether',
  category: 'hero: void',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new NullTether(),
  telegraphs(effect) {
    const e = effect as NullTether;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as NullTether;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as NullTether).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 100, 1);
  },
};
