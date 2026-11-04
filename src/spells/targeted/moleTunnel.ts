import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { Clods, Furrow, GroundRing, LampGlow, MOLE, MOLE_CSS, Mound, Puffs, buildPit } from '../../effects/parts/mole';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphShape } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';
import {
  TUNNEL_DAMAGE, TUNNEL_DIVE, TUNNEL_KNOCKUP, TUNNEL_MAX, TUNNEL_MIN, TUNNEL_RADIUS, TUNNEL_UNDER,
} from '../../traits/mole';

/**
 * Tunnel (mole kit, E: a dive and a tunnel). Mabel crouches (0.3 s): a dark pit opens under her feet, clods spray, her lamp flares, and
 * she drops in. Underground she moves for 1.2 s toward the aim, up to 7.2 m (4.3 m/s +40%, 2 m at least; `ctx.moveCaster`, which eases
 * out, so she is fastest at the start and slows toward the end). Her figure is not drawn (the trait's `figureHidden`) and she is sealed:
 * nothing can hit her and she cannot cast (src/traits/mole.ts). A big mound of dirt with a gold ring and a glowing lamp on top moves
 * over the surface where she really is, with a torn furrow behind it and clods kicked out to the sides: that is what the other player
 * reads. At 1.5 s she bursts out: 40 and a 0.5 s knock-up to everyone within 1.5 m of the exit on their live position, a fountain of
 * clods and a ring of dust. The exit circle is the telegraph, shown from the dive. The path is the same maths on both screens (from
 * `sentFrom` and the aim point), so the mound is drawn without `moveCaster`. Clean by about 2.5 s. See pipeline/designs/kit-mole.md.
 */
export interface MoleTunnelSettings {
  damage: number;
  /** Knock-up seconds (engine cap 0.8). */
  knockUp: number;
  loop: boolean;
}

export const defaultMoleTunnel = (): MoleTunnelSettings => ({ damage: TUNNEL_DAMAGE, knockUp: TUNNEL_KNOCKUP, loop: false });

const POP_T = TUNNEL_DIVE + TUNNEL_UNDER;
const DURATION = POP_T + 1.1;
const TAIL = 3;

/** The engine's dash easing (`Arena.stepDash`): ease-out cubic. */
const ease = (k: number) => 1 - (1 - k) ** 3;

export class MoleTunnel implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MoleTunnelSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  readonly start = new THREE.Vector3();
  readonly exit = new THREE.Vector3(0, 0, 6);
  /** The telegraph's shape: one object, mutated, so the duel reads the live exit. */
  readonly zone: TelegraphShape = { kind: 'circle', x: 0, z: 6, radius: TUNNEL_RADIUS };
  private dir = new THREE.Vector3(0, 0, 1);
  private time = 0;
  private flags = { dive: false, go: false, pop: false };
  private lastKick = 0;
  private kickSide = 1;
  private lastPuff = 0;
  private popAt = -1;

  private pit = buildPit(1.0);
  private exitPit = buildPit(0.9);
  private mound = new Mound();
  private furrow = new Furrow();
  private clods = new Clods(70);
  private puffs = new Puffs(26);
  private ring = new GroundRing(MOLE.light);
  private ring2 = new GroundRing(MOLE.foil);
  private lamp = new LampGlow();
  private star = new StarBurst({ points: 12, inner: 0.3, color: MOLE.foil, core: 0xffffff, additive: false });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: MoleTunnelSettings = defaultMoleTunnel()) {
    this.settings = settings;
    this.group.add(
      this.pit, this.exitPit, this.furrow.mesh, this.mound.mesh, this.clods.mesh, this.puffs.mesh, this.ring.mesh, this.ring2.mesh,
      this.lamp.mesh, this.star.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return POP_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree: only `sentFrom` and the aim point.
    this.start.copy(ctx.sentFrom ?? ctx.from).setY(0);
    this.v1.set(ctx.point.x - this.start.x, 0, ctx.point.z - this.start.z);
    const len = this.v1.length();
    if (len < 0.3) this.v1.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.dir.copy(this.v1).normalize();
    this.exit.copy(this.start).addScaledVector(this.dir, THREE.MathUtils.clamp(len, TUNNEL_MIN, TUNNEL_MAX));
    this.syncZone();
    this.pit.position.set(this.start.x, 0, this.start.z);
    this.exitPit.position.set(this.exit.x, 0, this.exit.z);
  }

  private syncZone() {
    const z = this.zone as { x: number; z: number };
    z.x = this.exit.x;
    z.z = this.exit.z;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.popAt = -1;
    this.lastKick = 0;
    this.lastPuff = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.clods.reset();
    this.puffs.reset();
    this.mound.hide();
    this.furrow.hide();
    this.pit.scale.setScalar(1e-4);
    this.exitPit.scale.setScalar(1e-4);
    this.ring.set(this.exit, 0, 0);
    this.ring2.set(this.exit, 0, 0);
    this.lamp.set(this.exit, 0, 0);
    this.star.set(this.exit, 0, 0);
  }

  /** Where she is on the surface at time t (ground): at the start until the dive ends, then the dash's easing. */
  private at(t: number, out: THREE.Vector3) {
    const k = THREE.MathUtils.clamp((t - TUNNEL_DIVE) / TUNNEL_UNDER, 0, 1);
    return out.copy(this.start).lerp(this.exit, ease(k));
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.clods.update(dt);
    this.puffs.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, f = this.flags;
    if (t >= DURATION) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      if (loop) this.play();
      return;
    }

    // --- 0..0.3: the crouch. A pit opens under her, clods spray, the lamp flares. ---
    if (!f.dive && t >= 0.02) {
      f.dive = true;
      this.v1.set(this.start.x, 0.2, this.start.z);
      this.clods.burst(this.v1, 12, 4.2, 1, 1.1);
      this.puffs.ring(this.start, 0.8, 6, 0.8);
    }
    if (t < TUNNEL_DIVE + 0.35) {
      const open = THREE.MathUtils.smoothstep(t, 0.02, 0.25) * (1 - THREE.MathUtils.smoothstep(t, TUNNEL_DIVE + 0.05, TUNNEL_DIVE + 0.35));
      this.pit.scale.setScalar(Math.max(1e-4, open));
      this.lamp.set(this.v1.set(this.start.x, 1.6, this.start.z), 1.3, 0.9 * (1 - THREE.MathUtils.smoothstep(t, 0.1, TUNNEL_DIVE + 0.05)) + 0.1);
    } else this.pit.scale.setScalar(1e-4);

    // --- 0.3: she is under. The real slide (her own screen), and the mound rises where she was. ---
    if (!f.go && t >= TUNNEL_DIVE) {
      f.go = true;
      const reached = ctx?.moveCaster?.(this.v1.copy(this.exit), TUNNEL_UNDER);
      if (reached) {
        this.exit.copy(reached).setY(0);
        this.syncZone();
        this.exitPit.position.set(this.exit.x, 0, this.exit.z);
      }
      this.shake = 0.12;
      this.clods.burst(this.v1.set(this.start.x, 0.3, this.start.z), 8, 3.4, 1, 1);
      this.puffs.puff(this.v1.set(this.start.x, 0.3, this.start.z), 1.1, MOLE.soil);
    }

    // --- 0.3..1.5: the mound over the surface, its furrow behind, clods kicked to the sides. ---
    if (f.go && !f.pop) {
      const along = this.at(t, this.v1);
      const rise = THREE.MathUtils.smoothstep(t, TUNNEL_DIVE, TUNNEL_DIVE + 0.15);
      const yaw = Math.atan2(this.dir.x, this.dir.z);
      this.mound.set(along, yaw, 1.05 * rise, t, 1);
      // The furrow: from `TAIL` m behind (not before the start) to the mound.
      const travelled = this.v2.copy(along).sub(this.start).dot(this.dir);
      this.v3.copy(along).addScaledVector(this.dir, -Math.min(TAIL, Math.max(0, travelled)));
      this.furrow.set(this.v3, along, 0.7, rise);
      this.lamp.set(this.v2.set(along.x, 1.15, along.z), 1.0, 0.55 + 0.25 * Math.sin(t * 21));
      // Speed now (ease-out derivative): it throws more dirt the faster she goes.
      const speed = 3 * (1 - THREE.MathUtils.clamp((t - TUNNEL_DIVE) / TUNNEL_UNDER, 0, 1)) ** 2;
      if (t - this.lastKick >= 0.055 && speed > 0.15) {
        this.lastKick = t;
        this.kickSide = -this.kickSide;
        const side = this.v3.set(this.dir.z * this.kickSide, 0, -this.dir.x * this.kickSide);
        this.v2.set(along.x + side.x * 0.7, 0.35, along.z + side.z * 0.7);
        this.clods.throw(this.v2, new THREE.Vector3(side.x * (2 + 2 * speed) + this.dir.x * 1.5, 2.2 + 1.6 * speed, side.z * (2 + 2 * speed) + this.dir.z * 1.5), 0.14 + Math.random() * 0.1, 0.8);
      }
      if (t - this.lastPuff >= 0.1) {
        this.lastPuff = t;
        this.puffs.puff(this.v2.set(along.x - this.dir.x * 0.5, 0.35, along.z - this.dir.z * 0.5), 0.55 + 0.25 * speed);
      }
    }

    // --- 1.5: she bursts out. Everyone inside the exit circle on their live position is hit. ---
    if (!f.pop && t >= POP_T) {
      f.pop = true;
      this.popAt = t;
      this.shake = 0.4;
      this.mound.hide();
      this.furrow.hide();
      if (ctx) {
        const foes = ctx.enemies?.() ?? ctx.targets;
        for (const e of foes) {
          const p = e.group.position;
          if (Math.hypot(p.x - this.exit.x, p.z - this.exit.z) > TUNNEL_RADIUS) continue;
          ctx.hit(e, {
            damage: this.settings.damage, knock: 3, from: this.exit.clone(), color: MOLE_CSS.soil,
            status: { kind: 'knockup', seconds: this.settings.knockUp },
          });
        }
      }
      this.clods.burst(this.v1.set(this.exit.x, 0.3, this.exit.z), 24, 4.4, 1.2, 1.7);
      this.puffs.ring(this.exit, 0.8, 8, 0.95);
      this.puffs.puff(this.v1.set(this.exit.x, 0.5, this.exit.z), 1.3, MOLE.soil);
    }
    if (this.popAt >= 0) {
      const a = t - this.popAt;
      const open = THREE.MathUtils.smoothstep(a, 0, 0.1) * (1 - THREE.MathUtils.smoothstep(a, 0.35, 0.9));
      this.exitPit.scale.setScalar(Math.max(1e-4, open));
      const rk = THREE.MathUtils.clamp(a / 0.45, 0, 1);
      this.ring.set(this.exit, 0.6 + (TUNNEL_RADIUS + 0.5) * rk, 0.8 * (1 - rk) * (1 - rk));
      this.ring2.set(this.exit, 0.4 + TUNNEL_RADIUS * rk, 0.7 * (1 - rk));
      const sp = StarBurst.pop(a, 0.03, 0.12);
      this.star.set(this.v1.set(this.exit.x, 1.1, this.exit.z), 1.3 * sp.scale, sp.opacity, a * 5);
      this.lamp.set(this.v2.set(this.exit.x, 1.7, this.exit.z), 1.4, Math.max(0, 0.9 - a * 2.5));
    }
    this.shake *= Math.exp(-dt * 10);
  }
}

export const moleTunnelModule: EffectModule = {
  label: 'mole tunnel',
  category: 'hero: mole',
  // Aimed at a spot (the tunnel goes toward it, 7.2 m at most); `radius` decides which enemies are in `targets` near the exit.
  targeting: { mode: 'ground', radius: TUNNEL_MAX + TUNNEL_RADIUS },
  create: () => new MoleTunnel(),
  telegraphs(effect) {
    const e = effect as MoleTunnel;
    if (!e.ctx) return [];
    // The exit, shown from the dive; the same shape object every call, so a moveCaster correction reaches the duel's copy.
    return [{ shape: e.zone, start: TUNNEL_DIVE, impact: POP_T, until: POP_T + 0.15 }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as MoleTunnel;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as MoleTunnel).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'knockUp', 0, 0.8, 0.1);
  },
};
