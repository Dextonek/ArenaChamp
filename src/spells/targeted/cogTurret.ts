import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { CLOCKWORK_CSS, Gear, Sparks, Spring, SteamPuffs, turretLook } from '../../effects/parts/clockwork';
import type { Summon } from '../../effects/summon';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Cog Turret (clockwork kit, W: a summon). Gears and a spring fly in from her backpack one after another and click
 * together at the point (a big flat base gear, an upright gear and a small one meshing with it, a spring standing on the
 * base), cyan sparks at every click and steam from the joints. At 0.5 the turret is summoned (`ctx.summon`, a brass
 * tripod with a spinning gear body, see `turretLook`) and anyone standing on the spot is thrown off; the assembly folds
 * away under it. The spell's own visual is clean by 1.6 s; it stays `playing` only while the turret lives so it can
 * scatter into cogs when it dies. See pipeline/designs/kit-clockwork.md.
 */
export interface CogTurretSettings {
  hp: number;
  seconds: number;
  damage: number;
  attackEvery: number;
  range: number;
  /** Damage and knockback to anyone standing on the spot when it lands. */
  hitDamage: number;
  hitKnock: number;
}

export const defaultCogTurret = (): CogTurretSettings => ({ hp: 80, seconds: 6, damage: 12, attackEvery: 1.4, range: 8, hitDamage: 20, hitKnock: 3 });

const BUILD_END = 0.5; // the last click, the summon and the small hit
const FOLD_T = 0.5;
const VISUAL_END = 1.6;
const RADIUS = 2;
const MAX_TIME = 10; // safety: the turret never lives longer than this in practice

export class CogTurret implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CogTurretSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private run = 0;
  private flags = { assembled: false, built: false, folded: false };
  private steamT = 0;

  private point = new THREE.Vector3(0, 0, -8);
  private pack = new THREE.Vector3(0, 1.3, 0);
  private fwd = new THREE.Vector3(0, 0, 1);
  private side = new THREE.Vector3(1, 0, 0);
  private summoned: Summon | null = null;

  private gears = new Gear(4);
  private spring = new Spring(5);
  private sparks = new Sparks(40);
  private steam = new SteamPuffs(32);
  /** Cogs of the turret when it dies. */
  private dead = new Gear(10);

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: CogTurretSettings = defaultCogTurret()) {
    this.settings = settings;
    this.group.add(this.gears.mesh, this.dead.mesh, this.spring.mesh, this.sparks.mesh, this.steam.mesh);
    this.gears.onClick = (pos) => {
      this.sparks.burst(this.v3.copy(pos).setY(pos.y + 0.1), 5);
      this.steam.puff(this.v3, this.up, 2);
    };
    this.reset();
  }

  private up = new THREE.Vector3(0, 1, 0);

  get duration() {
    return VISUAL_END;
  }

  get impactTime() {
    return BUILD_END;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.fwd.set(this.point.x - ctx.from.x, 0, this.point.z - ctx.from.z);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.fwd.normalize();
    this.side.set(this.fwd.z, 0, -this.fwd.x);
    // Her backpack: behind her shoulders.
    this.pack.set(ctx.from.x - this.fwd.x * 0.3, 1.3, ctx.from.z - this.fwd.z * 0.3);
  }

  play() {
    this.run++;
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.steamT = 0;
    this.summoned = null;
    this.flags.assembled = this.flags.built = this.flags.folded = false;
    this.gears.reset();
    this.dead.reset();
    this.spring.reset();
    this.sparks.reset();
    this.steam.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.gears.update(dt);
    this.dead.update(dt);
    this.sparks.update(dt);
    this.steam.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, f = this.flags, ctx = this.ctx, P = this.point;

    // --- 0..0.5: the parts fly in from the backpack and click together. ---
    if (!f.assembled) {
      f.assembled = true;
      this.gears.place(this.v1.set(P.x, 0.09, P.z), this.up, 0.85, 1.6, { from: this.pack, thick: 0.12 });
      this.gears.place(this.v1.set(P.x, 0.7, P.z), this.side, 0.45, -2.6, { from: this.pack, thick: 0.1 });
      this.gears.place(this.v1.set(P.x + this.fwd.x * 0.72, 0.7, P.z + this.fwd.z * 0.72), this.side, 0.3, 4.3, { from: this.pack, thick: 0.1 });
      this.gears.assemble(BUILD_END);
    }
    if (t < FOLD_T + 0.15) {
      // The spring stands on the base gear: squeezed at first, springing up as the base clicks, hidden as it folds.
      if (t >= 0.12) {
        this.v1.set(P.x, 0.14, P.z);
        this.v2.set(P.x, 0.62, P.z);
        this.spring.set(this.v1, this.v2, 4, 0.13);
        const k = Math.min((t - 0.12) / 0.3, 1);
        this.spring.stretch(0.35 + 0.65 * (1 - Math.pow(1 - k, 3)) + (t > FOLD_T ? -0.4 * Math.min((t - FOLD_T) / 0.15, 1) : 0));
      }
      // Steam from the joints while it goes together.
      this.steamT += dt;
      if (this.steamT >= 0.1 && t < BUILD_END) {
        this.steamT = 0;
        this.v1.set(P.x + (Math.random() - 0.5) * 0.9, 0.5 + Math.random() * 0.4, P.z + (Math.random() - 0.5) * 0.9);
        this.steam.puff(this.v1, this.up, 1);
      }
    } else this.spring.hide();

    // --- 0.5: the turret and the small hit under it. ---
    if (!f.built && t >= BUILD_END) {
      f.built = true;
      const s = this.settings;
      this.shake = 0.12;
      this.sparks.ring(P, 1.4, 8, 0.2);
      this.sparks.burst(this.v1.set(P.x, 0.5, P.z), 6);
      this.steam.puff(this.v1.set(P.x, 0.4, P.z), this.up, 5);
      // A network duel has no summons (the context leaves `summon` out): the spell then shows only the assembly.
      if (ctx?.summon) {
        this.summoned = ctx.summon({
          kind: 'turret', at: P.clone(), hp: s.hp, seconds: s.seconds, damage: s.damage, attackEvery: s.attackEvery, range: s.range,
          color: CLOCKWORK_CSS.body, look: turretLook,
        });
        const run = this.run;
        this.summoned.onDeath((u) => {
          if (run !== this.run) return;
          this.scatterTurret(u.pos);
        });
      }
      if (ctx) {
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (Math.hypot(p.x - P.x, p.z - P.z) <= RADIUS) ctx.hit(e, { damage: s.hitDamage, knock: s.hitKnock, from: P, color: CLOCKWORK_CSS.body });
        }
      }
    }
    if (!f.folded && t >= FOLD_T) {
      f.folded = true;
      this.gears.fold(0.2);
    }
    this.shake *= Math.exp(-dt * 12);

    // Done once the visual is clean and the turret is gone (it lives up to `seconds`, then scatters).
    const turretAlive = !!this.summoned && this.summoned.alive;
    if (t >= VISUAL_END && !turretAlive && !this.dead.busy && !this.gears.busy) {
      this.playing = false;
      this.reset();
    } else if (t >= MAX_TIME + this.settings.seconds) {
      this.playing = false;
      this.reset();
    }
  }

  /** The turret died: its gears and a few cogs burst out of where it stood, with steam. */
  private scatterTurret(at: THREE.Vector3) {
    this.v1.set(at.x, 0.6, at.z);
    for (let i = 0; i < 6; i++) {
      this.v2.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
      this.dead.place(this.v1, this.v2, 0.2 + Math.random() * 0.14, 6, { instant: true });
    }
    this.dead.scatter(5, 1.0, this.v1);
    this.sparks.burst(this.v1, 6);
    this.steam.puff(this.v1, this.up, 4);
  }
}

export const cogTurretModule: EffectModule = {
  label: 'cog turret',
  category: 'hero: clockwork',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new CogTurret(),
  telegraphs(effect) {
    const e = effect as CogTurret;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: BUILD_END }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CogTurret;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as CogTurret).settings;
    f.add(s, 'hp', 10, 300, 5);
    f.add(s, 'seconds', 2, 12, 0.5);
    f.add(s, 'damage', 1, 40, 1);
    f.add(s, 'attackEvery', 0.4, 4, 0.1);
    f.add(s, 'range', 3, 12, 0.5);
    f.add(s, 'hitDamage', 0, 60, 1);
    f.add(s, 'hitKnock', 0, 8, 0.5);
  },
};
