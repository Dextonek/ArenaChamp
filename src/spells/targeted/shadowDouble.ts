import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { clearScreenFx, createScreenFx } from '../../effects/parts';
import { Afterimage, CutShape, CutShards, ShadowPool, ShadowWisps, SHADOW, SHADOW_CSS, shadowCloneLook, facing } from '../../effects/parts/shadow';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { watchCover } from '../../traits/shadow';

/**
 * Shadow Double (shadow kit, E: a dash and a summon, `ground` mode). She darts `distance` (4 m) toward the aim in `DART` (0.18 s) with
 * `ctx.moveCaster`: a dart passes through cover (the engine only pushes the END spot out of obstacles, so a wall or pillar on the line
 * does not stop it). A shadow copy stays where she stood (`ctx.summon`: one `melee` unit, 40 HP, 2.5 s, 15 per 0.9 s, black and violet
 * `shadowCloneLook`, hooded and thin) and walks at the enemy; one spell kills it. Where she stood: a black pool and a puff of wisps; three
 * black figure cut-outs trail along the dart and fade; where she lands, black shards. No damage of its own; the copy's blows are the damage.
 * Clean by 1.0 s (the copy outlives the effect: it belongs to the arena). Network duels leave `ctx.summon` undefined: then a plain black
 * figure cut-out stands where she was for 2.5 s as the look only (no blows). The copy's ground ring is the unit's own and shows
 * only as it appears and dies. See pipeline/designs/kit-shadow.md.
 */
export interface ShadowDoubleSettings {
  distance: number;
  hp: number;
  seconds: number;
  damage: number;
  loop: boolean;
}

export const defaultShadowDouble = (): ShadowDoubleSettings => ({ distance: 4, hp: 40, seconds: 2.5, damage: 15, loop: false });

const DART = 0.18;
const DURATION = 1.0;
const LOOK_SECONDS = 2.5;

export class ShadowDouble implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ShadowDoubleSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private arrived = false;
  private lookOnly = false;
  private lookT = 0;

  // Parts.
  private trail = new Afterimage(4);
  private pool = new ShadowPool();
  private wisps = new ShadowWisps(24);
  private shards = new CutShards(20);
  private stand = new CutShape({ kind: 'figure', edgeWidth: 0.1, renderOrder: 3 });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ShadowDoubleSettings = defaultShadowDouble()) {
    this.settings = settings;
    this.screen.tint.set(SHADOW.dark);
    this.group.add(this.pool.mesh, this.trail.mesh, this.wisps.mesh, this.shards.mesh, this.stand.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return DART;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    watchCover(ctx);
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    const d = this.v1.length();
    if (d < 0.3) this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    else this.dir.copy(this.v1).multiplyScalar(1 / d);
    this.end.copy(this.start).addScaledVector(this.dir, this.settings.distance);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // The dart: the engine clamps only the end spot into the ring and out of the walls, so cover on the line is passed through.
    if (ctx.moveCaster) this.end.copy(ctx.moveCaster(this.end, DART)).setY(0);
    // The copy stays where she stood.
    const handle = ctx.summon?.({
      kind: 'melee', at: this.start.clone(), count: 1, hp: this.settings.hp, seconds: this.settings.seconds,
      damage: this.settings.damage, attackEvery: 0.9, color: SHADOW_CSS.body, look: shadowCloneLook,
    });
    this.lookOnly = !handle;
    // Where she stood: a pool and wisps; the trail along the dart.
    this.pool.spread(this.start, 1.3, 1);
    this.pool.shrink(0.6);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.7;
      this.v1.set(this.start.x + Math.cos(a) * r, 0.2 + Math.random() * 0.8, this.start.z + Math.sin(a) * r);
      this.v2.set(Math.cos(a) * 0.9, 0.5 + Math.random() * 0.5, Math.sin(a) * 0.9);
      this.wisps.emit(this.v1, this.v2, 0.3 + Math.random() * 0.25, 0.7 + Math.random() * 0.4);
    }
    this.trail.face(ctx.aim);
    this.stand.edge = 1;
    this.shake = 0.08;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.arrived = false;
    this.lookOnly = false;
    this.lookT = 0;
    clearScreenFx(this.screen);
    this.trail.reset();
    this.pool.reset();
    this.wisps.reset();
    this.shards.reset();
    this.stand.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.pool.update(dt);
    this.wisps.update(dt);
    this.shards.update(dt);
    this.time += dt;
    // The look-only figure (no summon on this screen) outlives the rest of the effect.
    if (this.lookOnly) this.lookT += dt;
    const end = this.lookOnly ? Math.max(DURATION, LOOK_SECONDS) : DURATION;
    if (this.time >= end) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    // Three black figures along the dart, one after another, then fading.
    this.trail.trail(this.start, this.end, 3, smoothstep(t / 0.5) * 1.5);
    if (!this.arrived && t >= DART) {
      this.arrived = true;
      this.v1.copy(this.end).setY(0.9);
      this.shards.burst(this.v1, 0.5, 8, 3.5, 3, 0.8);
      this.shake = Math.max(this.shake, 0.1);
    }
    if (this.lookOnly) {
      this.stand.place(this.start, facing(this.ctx?.aim ?? 0, this.v2), 1.5, 0);
      this.stand.opacity = 1 - smoothstep((this.lookT - (LOOK_SECONDS - 0.4)) / 0.4);
    }
    this.shake *= Math.exp(-dt * 10);
  }
}

export const shadowDoubleModule: EffectModule = {
  label: 'shadow double',
  category: 'hero: shadow',
  // A dart toward the aim, no area: the radius only lets the AI cast it when the enemy is within reach.
  targeting: { mode: 'ground', radius: 1 },
  create: () => new ShadowDouble(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as ShadowDouble;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as ShadowDouble).settings;
    f.add(s, 'loop');
    f.add(s, 'distance', 2, 8, 0.5);
    f.add(s, 'hp', 10, 200, 5);
    f.add(s, 'seconds', 1, 6, 0.5);
    f.add(s, 'damage', 1, 60, 1);
  },
};
