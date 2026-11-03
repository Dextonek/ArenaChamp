import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { GustRibbon, Leaves, SKY, SKY_CSS, SpeedLines, WindCrescent, WindWraith } from '../../effects/parts/sky';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Sky Rend (sky kit, R: a targeted flurry, `projectile` hits). Zephyr coils the wind round himself (0.25 s: two gust
 * spirals, the screen dims, a pink flare), then vanishes into it: his figure is hidden (and sunk under the floor for a duel
 * opponent, whose body is drawn by the duel) while a jade streak shoots to the enemy. Six times, 0.2 s apart from 0.35 s,
 * a jade afterimage of him cuts through the enemy from a new side (the sides turn 2.4 rad each time, so no two in a row
 * come from the same quarter): a wraith slides across, a big crescent and speed lines slash through the body, a star
 * pops, a refraction ring runs, the screen kicks. Each cut is `damage` (15, doubled by his trait on a knocked-up enemy:
 * `dealt` in `src/traits/sky.ts`) and every hit is `projectile: true`, judged on the target's live position, so the enemy cannot walk out of
 * it. The sixth is the finisher: bigger crescents, an impact frame, a chromatic pulse, a hard knock. His real body slides
 * to each side (`ctx.moveCaster`, 0.05 s) and at 1.4 s to a spot 1.4 m behind the enemy (by its facing), where he steps
 * out of the wind at 1.5 s with a pink star and a ring. He is untouchable the whole time (`REND_AIR`, 1.6 s, shared with
 * the trait). Clean by 2.4 s; `reset()` shows his figure again.
 * Network duels: the other screen has no `moveCaster` (his client streams his real moves), so there the figure stays
 * hidden at wherever it is streamed until 1.5 s, and the hits land from the victim's own client on its live position.
 */
export interface SkyRendSettings {
  damage: number;
  loop: boolean;
}

export const defaultSkyRend = (): SkyRendSettings => ({ damage: 15, loop: false });

// Timeline (seconds).
const LEAD = 0.25;
const FIRST = 0.35;
const STEP = 0.2;
const STRIKES = 6;
const END_T = 1.5;
const DURATION = 2.4;
const SIDE = 1.6; // metres from the enemy a striker starts
const BEHIND = 1.4;
const TURN = 2.4; // radians between two strikers' sides
const HIDE_Y = -8;
const UP = new THREE.Vector3(0, 1, 0);
const strikeAt = (k: number) => FIRST + STEP * k;

export class SkyRend implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SkyRendSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private target: Enemy | null = null;
  private time = 0;
  private done = { lead: false, vanish: false, back: false, out: false };
  private struck = 0;
  private hidden = false;
  private baseA = 0;
  private startPos = new THREE.Vector3();
  private foe = new THREE.Vector3();
  private popAt = [-1, -1, -1];
  private popBig = [false, false, false];
  private popPos = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private shockAt = -1;
  private shockPos = new THREE.Vector3();
  private outAt = -1;
  private outPos = new THREE.Vector3();

  // Parts.
  private crescents = new WindCrescent(16);
  private gather = new GustRibbon(32);
  private gatherB = new GustRibbon(32);
  private streak = new GustRibbon(28);
  private lines = new SpeedLines(64);
  private leaves = new Leaves(40);
  private wraith = new WindWraith(8);
  private pops = [0, 1, 2].map(() => new StarBurst({ points: 8, inner: 0.3, color: SKY.accent, core: 0xfff0f5, additive: false }));
  private flare = new StarBurst({ points: 4, inner: 0.18, jitter: 0, color: SKY.hot, core: SKY.core, additive: false });
  private shock = new ShockRefraction({ facing: 'camera' });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private d = new THREE.Vector3();

  constructor(settings: SkyRendSettings = defaultSkyRend()) {
    this.settings = settings;
    this.screen.impactColor.set(SKY.hot);
    this.screen.tint.set(SKY.dark);
    this.screen.speedLineColor.set(SKY.hot);
    this.group.add(
      this.crescents.mesh, this.gather.mesh, this.gatherB.mesh, this.streak.mesh, this.lines.mesh, this.leaves.mesh, this.wraith.mesh,
      ...this.pops.map((p) => p.mesh), this.flare.mesh, this.shock.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return strikeAt(STRIKES - 1);
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    this.startPos.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.foe.copy(this.target ? this.target.group.position : ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.foe).setY(1.2);
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
    // The first striker comes from the side he stands on.
    this.baseA = Math.atan2(this.startPos.x - this.foe.x, this.startPos.z - this.foe.z);
    // 0..0.25: the wind coils round him.
    this.v1.copy(this.startPos).setY(0);
    this.gather.spiral(this.v1, 0.7, 2.2, 2.5, LEAD + 0.05, 0.26);
    this.gatherB.spiral(this.v1, 0.45, 2.0, 3, LEAD + 0.05, 0.18);
  }

  /** Hides his figure (and sinks a duel opponent's under the floor: the duel draws that body separately). */
  private hide() {
    const ctx = this.ctx;
    if (!ctx || this.hidden) return;
    this.hidden = true;
    ctx.caster.group.visible = false;
    ctx.displace(ctx.caster, this.v3.set(0, HIDE_Y, 0));
  }

  private show() {
    const ctx = this.ctx;
    if (!ctx || !this.hidden) return;
    this.hidden = false;
    ctx.caster.group.visible = true;
    ctx.displace(ctx.caster, this.v3.set(0, 0, 0));
  }

  private reset() {
    this.show();
    this.time = 0;
    this.shake = 0;
    this.struck = 0;
    this.shockAt = -1;
    this.outAt = -1;
    this.popAt.fill(-1);
    const d = this.done;
    d.lead = d.vanish = d.back = d.out = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(SKY.hot);
    this.screen.tint.set(SKY.dark);
    this.screen.speedLineColor.set(SKY.hot);
    this.crescents.reset();
    this.gather.reset();
    this.gatherB.reset();
    this.streak.reset();
    this.lines.reset();
    this.leaves.reset();
    this.wraith.reset();
    for (const p of this.pops) p.set(this.foe, 1e-3, 0);
    this.flare.set(this.foe, 1e-3, 0);
    this.shock.set(this.foe, 0, 0);
    this.groundShock.set(this.foe, 0, 0);
  }

  /** The enemy's live feet (its figure moves while the strikes play). */
  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.crescents.update(dt);
    this.gather.update(dt);
    this.gatherB.update(dt);
    this.streak.update(dt);
    this.lines.update(dt);
    this.leaves.update(dt);
    this.wraith.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const d = this.done;
    this.liveFoe();

    if (!d.vanish && t >= LEAD) {
      d.vanish = true;
      this.vanish();
    }
    while (this.struck < STRIKES && t >= strikeAt(this.struck)) this.strike(this.struck++);
    if (!d.back && t >= strikeAt(STRIKES - 1) + 0.05) {
      d.back = true;
      this.stepBehind();
    }
    if (!d.out && t >= END_T) {
      d.out = true;
      this.out();
    }
    this.layout(t);
    this.shake *= Math.exp(-dt * 9);
  }

  /** 0.25 s: he goes into the wind, a streak shoots to the enemy. */
  private vanish() {
    this.v1.copy(this.startPos).setY(0.9);
    this.leaves.blow(this.v1, UP, 12, 6);
    this.lines.burst(this.v1, UP, 12, 2.4);
    this.v2.copy(this.startPos).setY(0);
    this.wraith.show(this.v2, this.d.set(this.foe.x - this.startPos.x, 0, this.foe.z - this.startPos.z), 0.4, 2, 2.5, 0.8);
    this.v2.lerpVectors(this.startPos, this.foe, 0.5).setY(2.2);
    this.v3.copy(this.foe).setY(1.3);
    this.streak.along([this.v1.clone(), this.v2.clone(), this.v3.clone()], 0.3, 0.3);
    this.hide();
    this.shake = 0.2;
    this.shockAt = LEAD;
    this.shockPos.copy(this.v1);
  }

  /** Strike `k`: a striker cuts through the enemy from a new side. */
  private strike(k: number) {
    const ctx = this.ctx;
    const last = k === STRIKES - 1;
    const a = this.baseA + k * TURN;
    this.v1.set(this.foe.x + Math.sin(a) * SIDE, 0, this.foe.z + Math.cos(a) * SIDE);
    this.d.set(this.foe.x - this.v1.x, 0, this.foe.z - this.v1.z).normalize();
    if (ctx?.moveCaster) ctx.moveCaster(this.v1, 0.05);
    this.wraith.show(this.v1, this.d, 0.34, 2, 4.5, 0.85);
    // The cut: a crescent through the chest, standing up and rolled by turns, plus streaks along the line.
    this.v2.copy(this.foe).setY(1.25);
    const tilt = (k % 2 ? 1 : -1) * (0.7 + 0.15 * (k % 3));
    this.crescents.slash(this.v2, this.d, last ? 2.2 : 1.5, last ? 150 : 120, tilt, 0.38, { width: last ? 0.9 : 0.55, sweep: 0.08, tone: k % 3 === 1 ? 0.7 : 0 });
    if (last) this.crescents.slash(this.v2, this.d, 2.2, 150, -tilt, 0.42, { width: 0.8, sweep: 0.1, reverse: true });
    this.v3.copy(this.v1).setY(0.2);
    this.lines.sweep(this.v3, this.v2.copy(this.foe).addScaledVector(this.d, 1.6), last ? 12 : 7, 1.7, 0.2);
    this.v2.copy(this.foe).addScaledVector(this.d, 0.5).setY(1.0);
    this.leaves.blow(this.v2, this.d, last ? 8 : 3, 6);
    // Star and refraction ring on the body.
    const i = k % this.pops.length;
    this.popAt[i] = this.time;
    this.popBig[i] = last;
    this.popPos[i].copy(this.foe).setY(1.2).addScaledVector(this.d, -0.2);
    this.shockAt = this.time;
    this.shockPos.copy(this.foe).setY(1.2);
    this.shake = last ? 0.45 : 0.14;
    if (!ctx || !this.target) return;
    // `projectile: true`: judged by the live position, so the target cannot walk out of it.
    ctx.hit(this.target, {
      damage: this.settings.damage, knock: last ? 3 : 0.6, from: this.v1.clone(), color: SKY_CSS.body, projectile: true,
    });
  }

  /** 1.4 s: his real body slides to the spot behind the enemy. */
  private stepBehind() {
    const ctx = this.ctx;
    const yaw = this.target ? this.target.group.rotation.y : this.baseA + Math.PI;
    this.v1.set(this.foe.x - Math.sin(yaw) * BEHIND, 0, this.foe.z - Math.cos(yaw) * BEHIND);
    this.outPos.copy(ctx?.moveCaster ? ctx.moveCaster(this.v1, END_T - strikeAt(STRIKES - 1) - 0.05) : this.v1).setY(0);
  }

  /** 1.5 s: he steps out of the wind behind the enemy. */
  private out() {
    const ctx = this.ctx;
    this.show();
    if (ctx) ctx.caster.group.rotation.y = Math.atan2(this.foe.x - ctx.caster.group.position.x, this.foe.z - ctx.caster.group.position.z);
    this.outAt = this.time;
    this.v1.copy(this.outPos).setY(0.9);
    this.leaves.blow(this.v1, UP, 10, 5);
    this.lines.burst(this.v1, UP, 8, 2.0);
    this.shake = Math.max(this.shake, 0.22);
  }

  private layout(t: number) {
    // --- The screen: dims through the coil and the cuts, frames and a chromatic kick on the finisher, focus lines on the enemy. ---
    const dim = smoothstep(t / LEAD) * (1 - smoothstep((t - END_T) / 0.3));
    this.screen.darken = 0.35 * dim;
    this.screen.speedLines = 0.3 * smoothstep((t - LEAD) / 0.1) * (1 - smoothstep((t - END_T + 0.1) / 0.2));
    this.screen.focus.copy(this.foe).setY(1.2);
    const lastT = strikeAt(STRIKES - 1);
    this.screen.impact = impactFrameAt(t, lastT, [1, 2], 0.04);
    this.screen.chroma = t >= lastT ? chromaPulse(t, lastT, 0.8, 7) : 0;
    this.screen.edgeTint.set(SKY.body);

    // --- The coil's pink flare grows through the lead, then pops. ---
    if (t < LEAD) {
      this.v1.copy(this.startPos).setY(1.2);
      this.flare.set(this.v1, 0.2 + 1.0 * smoothstep(t / LEAD), 0.9 * smoothstep(t / 0.1), t * 6);
    } else if (t < LEAD + 0.25) {
      const fp = StarBurst.pop(t - LEAD, 0.04, 0.12);
      this.v1.copy(this.startPos).setY(1.2);
      this.flare.set(this.v1, 1.6 * fp.scale + 1e-3, fp.opacity, 0.4);
    } else this.flare.set(this.foe, 1e-3, 0);

    // --- The stars on the body, one per cut, three in rotation. ---
    for (let i = 0; i < this.pops.length; i++) {
      if (this.popAt[i] < 0) continue;
      const age = t - this.popAt[i];
      const sp = StarBurst.pop(age, 0.0, 0.06);
      this.pops[i].set(this.popPos[i], (this.popBig[i] ? 2.2 : 1.1) * sp.scale + 1e-3, sp.opacity, 0.2 + i * 0.5);
    }

    // --- Refraction ring on the last cut; a ground ring where he steps out. ---
    if (this.shockAt >= 0) {
      const p = THREE.MathUtils.clamp((t - this.shockAt) / 0.3, 0, 1);
      this.shock.set(this.shockPos, 0.3 + 1.6 * p, 0.05 * (1 - p) * (1 - p));
    }
    if (this.outAt >= 0) {
      const gp = THREE.MathUtils.clamp((t - this.outAt) / 0.5, 0, 1);
      this.groundShock.set(this.outPos, 0.5 + 2.4 * gp, 0.06 * (1 - gp) * (1 - gp));
      const sp = StarBurst.pop(t - this.outAt, 0.03, 0.1);
      this.v1.copy(this.outPos).setY(1.2);
      this.flare.set(this.v1, 1.8 * sp.scale + 1e-3, sp.opacity, 0.3);
    }
  }
}

export const skyRendModule: EffectModule = {
  label: 'sky rend',
  category: 'hero: sky',
  // Click an enemy: six hits that always land (`projectile`), so there is no zone to dodge.
  targeting: { mode: 'enemy' },
  create: () => new SkyRend(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SkyRend;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as SkyRend).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 80, 1);
  },
};
