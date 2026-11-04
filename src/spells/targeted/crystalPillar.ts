import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst } from '../../effects/parts';
import type { MinionLook } from '../../effects/parts/minion';
import { Crystal, Glitter, PRISM, PRISM_CSS, SpectrumBeam } from '../../effects/parts/prism';
import type { SummonUnit } from '../../effects/summon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { pillar, type Obstacle } from '../../obstacles';

/**
 * Crystal (prism kit v5, W: terrain; shown as "Crystal", label 'crystal pillar'). A pale seed of glass and a floor ring mark
 * a spot (8 m, at least 1.5 m from her); at 0.5 s a tall lavender crystal bursts up there and stands for 6 s as a real
 * obstacle (`ctx.addObstacle`, a pillar of radius 0.7): it blocks walking, sight and bolts for both heroes and the AI, and
 * her own bolts reflect off it like off any wall. Its place comes only from `ctx.sentFrom` and `ctx.point`, so both
 * screens of a network duel build the same one.
 *
 * It breaks at 80 damage. Obstacles take no damage in this engine (the arena's breakable walls are only the arena's
 * own: `Duel.blastWalls`), so the crystal's HP lives in a summoned unit: `ctx.summon` makes a 'turret' with 80 HP, damage 0
 * and no reach, at the crystal's spot, with an invisible look (this effect draws the crystal; the unit gives the HP bar
 * and a target the enemy's spells and attacks can hit). It is made BEFORE the obstacle (so the engine does not push it out)
 * and pinned to the spot every frame (a knock would push it out of the crystal). When it dies by damage the `onDeath`
 * hook removes the obstacle and the crystal shatters into loose shards; otherwise both end at 6 s (cracks and a blink in the
 * last 0.9 s). Without `ctx.summon` the crystal is unbreakable and only times out.
 *
 * The telegraph is the crystal's footprint (a 0.9 m circle, impact at the rise): it roots her until then. Clean by 7.5 s.
 * See pipeline/designs/kit-prism.md.
 */
export interface CrystalPillarSettings {
  hp: number;
  loop: boolean;
}

export const defaultCrystalPillar = (): CrystalPillarSettings => ({ hp: 80, loop: false });

// Timeline (seconds).
const RISE_T = 0.5;
const LIFE = 6; // seconds it stands, counted from the rise
const SHATTER_T = RISE_T + LIFE;
const CRACK_T = SHATTER_T - 0.9;
const DURATION = SHATTER_T + 1.0;

const RANGE = 8;
const MIN_DIST = 1.5;
const OBSTACLE_R = 0.7;
const FOOT_R = 0.95; // the telegraph circle
const HEIGHT = 2.9; // the crystal's tip to tip
const WIDTH = 1.35;
const SHARDS = 4;
const MIN = 1e-3;
const UP = new THREE.Vector3(0, 1, 0);

/** The summoned unit's look: nothing. The effect draws the crystal; the unit gives the HP bar (over the tip) and the target. */
const HIDDEN: MinionLook = () => ({ root: new THREE.Group(), animate() { /* no figure */ }, barY: 3.3 });

const easeOutBack = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
};

export class CrystalPillarFx implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CrystalPillarSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** Where the crystal stands, from sentFrom and point only. */
  readonly centre = new THREE.Vector3(0, 0, 4);
  private time = 0;
  private flags = { risen: false, shattered: false };
  private obstacle: Obstacle | null = null;
  private obstacleCtx: CastContext | null = null;
  private unit: SummonUnit | null = null;
  private broke = false;
  private hpSeen = 1;
  private bump = 0;
  private endAt = DURATION;
  private mainIdx = -1;
  private shardIdx: number[] = [];
  private sparkT = 0;

  private crystals = new Crystal(SHARDS + 2);
  private beams = new SpectrumBeam(4);
  private glitter = new Glitter(90);
  private pop = new StarBurst({ points: 8, inner: 0.3, color: PRISM.blue, core: 0xffffff, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: PRISM.dark, transparent: true, opacity: 0, depthWrite: false });
  private rim: THREE.Mesh;
  private rimMat = new THREE.MeshBasicMaterial({ color: PRISM.foil, transparent: true, opacity: 0, depthWrite: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: CrystalPillarSettings = defaultCrystalPillar()) {
    this.settings = settings;
    // A dark layer under the crystal and a pale ring round its foot: it reads on a bright floor.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.shade.visible = false;
    this.rim = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 56).rotateX(-Math.PI / 2), this.rimMat);
    this.rim.renderOrder = 2;
    this.rim.visible = false;
    this.group.add(this.shade, this.rim, this.crystals.mesh, this.beams.mesh, this.glitter.mesh, this.pop.mesh, this.groundShock.mesh);
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
    // Both screens must agree on the crystal: only sentFrom and point (not the drawn `from`).
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); len = MIN_DIST; } else { dx /= len; dz /= len; }
    len = THREE.MathUtils.clamp(len, MIN_DIST, RANGE);
    this.centre.set(s.x + dx * len, 0, s.z + dz * len);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private dropObstacle() {
    if (this.obstacle) this.obstacleCtx?.removeObstacle?.(this.obstacle);
    this.obstacle = null;
    this.obstacleCtx = null;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.risen = this.flags.shattered = false;
    this.broke = false;
    this.unit = null;
    this.hpSeen = 1;
    this.bump = 0;
    this.endAt = DURATION;
    this.sparkT = 0;
    this.mainIdx = -1;
    this.shardIdx.length = 0;
    this.dropObstacle();
    this.crystals.reset();
    this.beams.reset();
    this.glitter.reset();
    this.pop.set(this.centre, 0, 0);
    this.groundShock.set(this.centre, 0, 0);
    this.shade.visible = this.rim.visible = false;
    this.shadeMat.opacity = this.rimMat.opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.crystals.update(dt);
    this.glitter.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.endAt && !this.crystals.busy && !this.glitter.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time, f = this.flags, C = this.centre;

    // --- The seed: a small crystal and the floor ring, growing toward the rise. ---
    if (this.mainIdx === -1) {
      this.mainIdx = this.crystals.place(this.v1.set(C.x, 0.1, C.z), UP, HEIGHT, WIDTH, { scale: MIN, spin: 0.7 });
      for (let i = 0; i < SHARDS; i++) {
        this.shardIdx.push(this.crystals.place(this.v1.set(C.x, 0.1, C.z), UP, 0.95, 0.42, { scale: MIN, spin: 1.1 }));
      }
      this.shade.visible = this.rim.visible = true;
      this.shade.position.copy(C);
      this.rim.position.copy(C).setY(0.04);
      this.shade.position.y = 0.03;
    }
    if (!f.risen) {
      const k = smoothstep(t / RISE_T);
      this.shade.scale.setScalar(FOOT_R * (0.5 + 0.7 * k));
      this.shadeMat.opacity = 0.4 * k;
      this.rim.scale.setScalar(FOOT_R * (0.5 + 0.5 * k));
      this.rimMat.opacity = 0.35 + 0.5 * k;
      // The seed: a thin pale shard that swells and flickers.
      this.setMain(0.08 + 0.12 * k + 0.02 * Math.sin(t * 40));
      this.sparkT += dt;
      if (this.sparkT >= 0.07) { this.sparkT = 0; this.glitter.burst(this.v1.set(C.x, 0.3, C.z), 1, 1.2); }
    }
    if (!f.risen && t >= RISE_T) {
      f.risen = true;
      this.rise();
    }

    if (f.risen && !f.shattered) {
      this.keepUnit();
      const age = t - RISE_T;
      // The crystal bursts up with an overshoot; the foot shards lean out round it.
      const grow = easeOutBack(age / 0.28);
      this.bump *= Math.exp(-dt * 10);
      let blink = 1;
      if (t >= CRACK_T) {
        // Cracking: a blink and flecks shed from the crystal, faster toward the end.
        const k = smoothstep((t - CRACK_T) / (SHATTER_T - CRACK_T));
        blink = 1 + 0.07 * Math.sin(t * (14 + 24 * k)) * k;
        this.sparkT += dt;
        if (this.sparkT >= 0.1 - 0.06 * k) { this.sparkT = 0; this.glitter.burst(this.v1.set(C.x, 0.6 + Math.random() * 1.8, C.z), 2, 2.2); }
      } else if (age > 0.6) {
        this.sparkT += dt;
        if (this.sparkT >= 0.45) { this.sparkT = 0; this.glitter.burst(this.v1.set(C.x + (Math.random() - 0.5), 0.4 + Math.random() * 2, C.z + (Math.random() - 0.5)), 1, 0.8); }
      }
      this.setMain(Math.max(grow, MIN) * blink * (1 + this.bump));
      this.layShards(Math.max(grow, MIN) * blink);
      this.rimMat.opacity = 0.9 * (1 - smoothstep((age - 0.2) / 0.5)) + 0.35;
      this.shadeMat.opacity = 0.4;
      // Spectrum rays from the tip to the floor, a flash on the rise that fades.
      const rays = 1 - smoothstep((age - 0.05) / 0.45);
      for (let i = 0; i < 4; i++) {
        const a = i * 1.5708 + 0.6;
        this.v1.set(C.x, HEIGHT * 0.9, C.z);
        this.v2.set(C.x + Math.cos(a) * 2.4, 0.2, C.z + Math.sin(a) * 2.4);
        this.beams.set(this.v1, this.v2, 0.5, rays, undefined, 0.3, i);
      }
      const sp = StarBurst.pop(age, 0.05, 0.18);
      this.pop.set(this.v1.set(C.x, HEIGHT * 0.5, C.z), 2.0 * sp.scale, sp.opacity, age * 3);
      const gp = THREE.MathUtils.clamp(age / 0.4, 0, 1);
      this.groundShock.set(C, 0.5 + 3.2 * gp, 0.04 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * 0.9, 0.35 * Math.exp(-age * 9));
      if (t >= SHATTER_T || this.broke) this.shatter();
    }
    if (f.shattered) {
      this.rimMat.opacity *= Math.exp(-dt * 6);
      this.shadeMat.opacity *= Math.exp(-dt * 6);
      this.shake *= Math.exp(-dt * 10);
    }
  }

  /** The crystal comes up: its HP (a unit), then the obstacle, then the burst. */
  private rise() {
    const ctx = this.ctx, C = this.centre;
    if (ctx) {
      // The unit first, so the engine does not push it out of the obstacle; the obstacle second.
      const sm = ctx.summon?.({
        kind: 'turret', at: C.clone(), hp: this.settings.hp, seconds: LIFE + 0.1, damage: 0, attackEvery: 999, range: 0.01,
        color: PRISM_CSS.body, look: HIDDEN,
      });
      this.unit = sm?.units[0] ?? null;
      this.hpSeen = 1;
      sm?.onDeath((u) => {
        if (!u.slain) return;
        // Broken by damage: the way through opens at once; the shards fly in `update`.
        this.broke = true;
        this.dropObstacle();
      });
      const o = pillar(C.x, C.z, OBSTACLE_R);
      o.height = HEIGHT;
      this.obstacle = ctx.addObstacle ? ctx.addObstacle(o, LIFE) : null;
      this.obstacleCtx = this.obstacle ? ctx : null;
    }
    this.glitter.burst(this.v1.set(C.x, 0.8, C.z), 22, 5, 1.6);
    this.shake = 0.35;
    this.bump = 0;
  }

  /** Holds the HP unit on the crystal (a knock would push it out); a drop in its HP flinches the crystal. */
  private keepUnit() {
    const u = this.unit;
    if (!u || !u.alive) return;
    u.pos.set(this.centre.x, 0, this.centre.z);
    u.knock.set(0, 0, 0);
    const k = u.hp / u.max;
    if (k < this.hpSeen - 1e-4) {
      this.hpSeen = k;
      this.bump = 0.09;
      this.shake = Math.max(this.shake, 0.18);
      this.glitter.burst(this.v1.set(this.centre.x, 1.2, this.centre.z), 6, 3.5);
    }
  }

  private setMain(scale: number) {
    if (this.mainIdx < 0) return;
    this.crystals.setScale(this.mainIdx, scale);
    this.crystals.move(this.mainIdx, this.v2.set(this.centre.x, HEIGHT * 0.5 * scale, this.centre.z));
  }

  private layShards(k: number) {
    for (let i = 0; i < this.shardIdx.length; i++) {
      const a = (i / SHARDS) * Math.PI * 2 + 0.4, r = 0.78;
      const dir = this.v1.set(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4).normalize();
      this.crystals.setScale(this.shardIdx[i], Math.max(k, MIN));
      this.crystals.move(this.shardIdx[i], this.v2.set(this.centre.x + Math.cos(a) * r, 0.4 * k, this.centre.z + Math.sin(a) * r), dir);
    }
  }

  /** It breaks (damage) or runs out (time): the crystal bursts into loose shards. */
  private shatter() {
    const f = this.flags, C = this.centre;
    if (f.shattered) return;
    f.shattered = true;
    this.dropObstacle();
    this.crystals.shatter(5.5, 0.9, this.v1.set(C.x, 1.2, C.z));
    this.glitter.burst(this.v1.set(C.x, 1.3, C.z), 28, 6, 1.5);
    this.beams.reset();
    this.pop.set(C, 0, 0);
    this.shake = 0.3;
    this.endAt = Math.min(this.endAt, this.time + 1.0);
  }
}

export const crystalPillarModule: EffectModule = {
  label: 'crystal pillar',
  category: 'hero: prism',
  // The aim point is where the crystal stands; the radius only sizes the marker.
  targeting: { mode: 'ground', radius: FOOT_R },
  create: () => new CrystalPillarFx(),
  telegraphs(effect) {
    const e = effect as CrystalPillarFx;
    if (!e.ctx) return [];
    // The footprint of the crystal: it roots her until it rises.
    return [{ shape: { kind: 'circle', x: e.centre.x, z: e.centre.z, radius: FOOT_R }, start: 0.04, impact: RISE_T }];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CrystalPillarFx;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as CrystalPillarFx).settings;
    f.add(s, 'loop');
    f.add(s, 'hp', 1, 300, 1);
  },
};
