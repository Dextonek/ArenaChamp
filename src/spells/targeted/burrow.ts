import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { SAND, SAND_CSS, Dust, SandPool, SandRibbon, SandWave, SandstoneBlocks } from '../../effects/parts/sand';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphShape } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';
import { BURROW_SECONDS } from '../../traits/sand';

/**
 * Burrow (sand kit, E: a dive and a tunnel). Sefu crouches and the sand under his feet swirls open (0.25 s), he
 * dives and the figure is hidden. A mound of sand with a furrow behind it tunnels up to 7 m toward the aim
 * (`ctx.moveCaster`, 0.75 s): that is where he really is, so the enemy can read it, but every hit on him is swallowed
 * for `BURROW_SECONDS` from the cast (the trait's `taken`, `src/traits/sand.ts`). He erupts at the end in a column of
 * sand: enemies within 2 m of the exit take 30 damage and are knocked up 0.5 s. The exit is a telegraph circle
 * (2.2 m) shown from the dive, and the hit is judged on live positions against it. Network duels: the tunnel is the
 * same maths from `sentFrom` and the aim point (no `moveCaster` is needed to draw it), the victim's client decides the
 * eruption hit, and the burrower's own client keeps the untouchable window. See kit-shapes-v3.md.
 */
export interface BurrowSettings {
  damage: number;
  /** Knock-up seconds (engine cap 0.8). */
  knockUp: number;
  loop: boolean;
}

export const defaultBurrow = (): BurrowSettings => ({ damage: 45, knockUp: 0.5, loop: false });

// Timeline (seconds).
const DIVE_T = 0.25;
const EXIT_T = BURROW_SECONDS - 0.1; // the eruption; the trait's untouchable window runs 0.1 s past it
const TUNNEL_S = EXIT_T - DIVE_T;
const DURATION = 2.4;

const MAX_DIST = 7;
const MIN_DIST = 2;
const HIT_R = 2.0; // enemies within this of the exit are hit
const ZONE_R = 2.2; // the telegraph, a little wider so a body at the edge still lands

/** The engine's dash easing (`Arena.stepDash`): ease-out cubic. */
const ease = (k: number) => 1 - (1 - k) ** 3;

export class Burrow implements Effect {
  readonly group = new THREE.Group();
  readonly settings: BurrowSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Path geometry (ground plane), from sentFrom and point only.
  readonly start = new THREE.Vector3(0, 0, 14);
  readonly exit = new THREE.Vector3(0, 0, 8);
  private dir = new THREE.Vector3(0, 0, -1);
  private side = new THREE.Vector3(1, 0, 0);
  /** The telegraph's shape: one object, mutated, so the duel reads the live exit. */
  readonly zone: TelegraphShape = { kind: 'circle', x: 0, z: 8, radius: ZONE_R };
  private hidden: Enemy | null = null;
  private lastPuff = 0;

  private flags = { dive: false, go: false, erupt: false, settle: false };
  private eruptAt = -1;

  // Parts.
  private diveHole = new SandPool();
  private mound = new SandPool();
  private furrow = new SandRibbon(26, 8, 18);
  private column = [new SandRibbon(22, 8, 10), new SandRibbon(22, 8, 10), new SandRibbon(22, 8, 10)];
  private blocks = new SandstoneBlocks(10);
  private dust = new Dust(14, 60);
  private ring = new SandWave();
  private pop = new StarBurst({ points: 12, inner: 0.3, color: SAND.accent, core: 0xe8fffc, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: BurrowSettings = defaultBurrow()) {
    this.settings = settings;
    this.screen.impactColor.set(SAND.stone);
    this.blocks.dust = this.dust;
    this.blocks.dustEvery = 2;
    this.dust.life = 0.6;
    this.diveHole.y = 0.07;
    this.mound.y = 0.08;
    this.group.add(
      this.diveHole.mesh, this.mound.mesh, this.furrow.mesh, ...this.column.map((c) => c.mesh), this.blocks.mesh,
      this.dust.mesh, this.ring.mesh, this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return EXIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    const len = this.v1.length();
    if (len < 0.3) this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.dir.copy(this.v1).normalize();
    this.side.set(this.dir.z, 0, -this.dir.x);
    this.exit.copy(this.start).addScaledVector(this.dir, THREE.MathUtils.clamp(len, MIN_DIST, MAX_DIST));
    this.syncZone();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.exit).setY(1);
    this.pop.set(this.exit, 0, 0);
    this.groundShock.set(this.exit, 0, 0);
  }

  private syncZone() {
    const z = this.zone as { x: number; z: number; radius: number };
    z.x = this.exit.x;
    z.z = this.exit.z;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  /** The figure comes back (never leave it hidden across a round or a new cast). */
  private show() {
    if (this.hidden) this.hidden.group.visible = true;
    this.hidden = null;
  }

  private reset() {
    this.show();
    this.time = 0;
    this.shake = 0;
    this.eruptAt = -1;
    this.lastPuff = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.diveHole.reset();
    this.mound.reset();
    this.furrow.reset();
    for (const c of this.column) c.reset();
    this.blocks.reset();
    this.dust.reset();
    this.ring.reset();
    this.pop.set(this.exit, 0, 0);
    this.groundShock.set(this.exit, 0, 0);
  }

  /** Where he is in the tunnel at time t (ground): still at the start until the dive ends, then the dash's easing. */
  private at(t: number, out: THREE.Vector3) {
    const k = THREE.MathUtils.clamp((t - DIVE_T) / TUNNEL_S, 0, 1);
    return out.copy(this.start).lerp(this.exit, ease(k));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.diveHole.update(dt);
    this.mound.update(dt);
    this.furrow.update(dt);
    for (const c of this.column) c.update(dt);
    this.blocks.update(dt);
    this.dust.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // --- 0..0.25: the sand under his feet swirls open; at 0.25 he dives and the figure is hidden. ---
    if (!f.dive && t >= 0.03) {
      f.dive = true;
      this.diveHole.place(this.start);
      this.diveHole.swirl = 0.9;
      this.diveHole.spread(1.2, 0.2);
      this.diveHole.settle(0.3, 0.2);
      this.diveHole.fade(0.3, 0.45);
      this.dust.puff(this.v1.copy(this.start).setY(0.3), 0.8);
    }
    if (!f.go && t >= DIVE_T) {
      f.go = true;
      // The real dash: where he reaches is where he erupts (the ring clamps it).
      const reached = ctx?.moveCaster?.(this.v1.copy(this.exit), TUNNEL_S);
      if (reached) { this.exit.copy(reached).setY(0); this.syncZone(); this.screen.focus.copy(this.exit).setY(1); }
      if (ctx) { ctx.caster.group.visible = false; this.hidden = ctx.caster; }
      this.dust.fall(this.v1.copy(this.start), 0.9, 10, 1.6, 0.5);
      this.mound.place(this.start);
      this.mound.swirl = 0.35;
      this.mound.spread(0.75, 0.2);
      this.shake = 0.12;
    }

    // Dust kicked up along the furrow while he moves.
    if (f.go && !f.erupt && t - this.lastPuff >= 0.07) {
      this.lastPuff = t;
      this.at(t, this.v1).setY(0.25);
      this.dust.puff(this.v1, 0.45);
    }

    if (!f.erupt && t >= EXIT_T) {
      f.erupt = true;
      this.eruptAt = t;
      this.show();
      this.erupt(ctx);
    }
    if (f.erupt && !f.settle && t >= EXIT_T + 0.7) {
      f.settle = true;
      this.blocks.crumble(0.5, 0.2);
    }
    this.layout(t);
  }

  /** The exit: the knock-up (judged on live positions, the zone filter decides in the duel) and the sand column. */
  private erupt(ctx: CastContext | null) {
    const at = this.exit;
    if (ctx) {
      for (const e of ctx.targets) {
        const p = e.group.position;
        if (Math.hypot(p.x - at.x, p.z - at.z) > HIT_R) continue;
        ctx.hit(e, {
          damage: this.settings.damage, knock: 3, from: at.clone(), color: SAND_CSS.body,
          status: { kind: 'knockup', seconds: this.settings.knockUp },
        });
      }
    }
    this.dust.puff(this.v1.copy(at).setY(0.4), 1.1);
    this.dust.fall(this.v1.copy(at), 1.6, 26, 3.4, 0.9);
    // Pale shards thrown out of the burst, and a ring of stone fangs around the hole.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      this.v1.set(at.x + Math.cos(a) * 0.5, 0.2, at.z + Math.sin(a) * 0.5);
      this.v2.set(Math.cos(a) * (3 + Math.random() * 2), 4 + Math.random() * 2.5, Math.sin(a) * (3 + Math.random() * 2));
      this.blocks.throwShard(this.v1, this.v2, new THREE.Vector3(0.16, 0.36, 0.14), 1.4, 0.4);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.8;
      this.v1.set(at.x + Math.cos(a) * 1.0, 0, at.z + Math.sin(a) * 1.0);
      this.v2.set(0.3, 0.7 + Math.random() * 0.3, 0.26);
      this.blocks.raise(this.v1, this.v2, 0.12, i * 0.015, { yaw: a, lean: 0.4, leanDir: Math.atan2(Math.cos(a), Math.sin(a)), taper: 0.25 });
    }
    this.mound.reset();
    this.mound.place(at);
    this.mound.swirl = 0.5;
    this.mound.spread(1.8, 0.2);
    this.mound.settle(0.5, 0.2);
    this.mound.fade(0.4, 0.7);
    this.shake = 0.5;
  }

  /** One twisting column of sand: a helix that rises from the hole, `phase` offsets the three strands. */
  private columnPath(phase: number, grow: number) {
    return (u: number, out: THREE.Vector3) => {
      const a = phase + u * Math.PI * 1.6 + this.time * 7;
      const r = (0.25 + 0.5 * u) * (1 - 0.2 * grow);
      return out.set(this.exit.x + Math.cos(a) * r, 0.05 + u * 2.6 * grow, this.exit.z + Math.sin(a) * r);
    };
  }

  private layout(t: number) {
    const f = this.flags;

    // --- The tunnel: a mound at his position with a furrow behind it on the ground. ---
    if (f.go && !f.erupt) {
      this.at(t, this.v1);
      const along = this.v2.copy(this.v1).sub(this.start).dot(this.dir);
      this.mound.place(this.v1);
      const tailLen = Math.min(2.8, along);
      if (tailLen < 0.3) this.furrow.hide();
      else {
        const p0 = this.v1.clone();
        this.furrow.shed = 30;
        this.furrow.setFunction((u, out) => {
          out.copy(p0).addScaledVector(this.dir, -tailLen * (1 - u));
          out.addScaledVector(this.side, Math.sin(u * 9 - t * 14) * 0.12 * u);
          out.y = 0.08 + 0.2 * u;
          return out;
        }, 0.7, 1, 0, t);
      }
    } else if (f.erupt) {
      this.furrow.hide();
    }

    // --- The eruption: three strands of sand shoot up, an impact frame, a star, a ring and the refraction. ---
    if (this.eruptAt >= 0) {
      const ak = t - this.eruptAt;
      const grow = 1 - Math.pow(1 - THREE.MathUtils.clamp(ak / 0.18, 0, 1), 3);
      const fall = smoothstep((ak - 0.35) / 0.4);
      this.column.forEach((c, i) => {
        c.shed = fall < 0.99 ? 28 : 0;
        c.setFunction(this.columnPath((i / 3) * Math.PI * 2, grow), 0.5 * (1 - 0.5 * fall), grow, Math.min(fall * 0.95, grow - 0.01), t);
      });
      this.screen.impact = impactFrameAt(t, this.eruptAt, [1], 0.04);
      const sp = StarBurst.pop(ak, 0, 0.04);
      this.pop.set(this.v1.copy(this.exit).setY(1.2), 1.6 * sp.scale, sp.opacity, 0.2);
      const rk = THREE.MathUtils.clamp(ak / 0.45, 0, 1);
      this.ring.set(this.exit, 0.3 + (HIT_R + 0.3) * rk, 0.95 * (1 - rk) * (1 - rk), 0.3);
      this.groundShock.set(this.exit, 0.5 + 2.6 * rk, 0.04 * (1 - rk) * (1 - rk));
      this.shake = Math.max(this.shake * 0.9, 0.5 * Math.exp(-ak * 9));
    } else {
      this.shake *= 0.9;
    }
    this.screen.darken = 0.12 * smoothstep((t - 0.1) / 0.3) * (1 - smoothstep((t - EXIT_T) / 0.4));
  }
}

export const burrowModule: EffectModule = {
  label: 'burrow',
  category: 'hero: sand',
  // Aimed at a spot (the tunnel goes toward it, 7 m at most); `radius` decides which enemies are in `targets` near the exit.
  targeting: { mode: 'ground', radius: 9 },
  create: () => new Burrow(),
  telegraphs(effect) {
    const e = effect as Burrow;
    if (!e.ctx) return [];
    // The exit, shown from the dive; the same shape object every call, so a moveCaster correction reaches the duel's copy.
    return [{ shape: e.zone, start: 0.1, impact: EXIT_T, until: EXIT_T + 0.15 }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Burrow;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Burrow).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'knockUp', 0, 0.8, 0.1);
  },
};
