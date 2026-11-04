import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { BOLT_Y, Flyers, Hats, MAGIC, MAGIC_CSS, Pieces, rabbitLook } from '../../effects/parts/magic';
import { SmokeBall } from '../../effects/parts/smokeBall';
import { boltWidth } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { bankPath } from '../../obstacles';
import {
  FINALE_DAMAGE, FINALE_RADIUS, FINALE_REACH, FINALE_RING, FINALE_SPEED, FINALE_WAIT, RABBIT_DAMAGE, RABBIT_HP, RABBIT_LIFE, RABBIT_SPEED, bookOf,
  shuffleOf, type HatAct,
} from '../../traits/magic';

/**
 * The Grand Finale (magic kit, R: the ultimate). A burst of purple smoke and a flourish: he is gone (not drawn and sealed for 1.2 s, the trait,
 * src/traits/magic.ts) and three top hats pop up in a ring 3 m round the enemy's spot (where they stood at the cast: step out of it), one after
 * another with a puff each, a thin gold circle drawn on the floor between them. For 1.2 s the hats glow and from 0.7 s a sword rises out of
 * each, point toward the centre. At 1.2 s the three swords fly: real bolts (`ctx.projectile`, 16 m/s, radius 0.3, 3.6 m from each hat, so
 * through the centre and 0.6 m past it), 30 damage each, stopped by walls and pillars (the lines are shortened at them, as the bolts are).
 * One impact frame as they leave. He steps out of one hat (his own client moves him with `ctx.moveCaster` at 1.15 s): smoke, a ring, a
 * star, confetti, and the white rabbit (Ta-da!: `ctx.summon`, 20 HP, 8 damage) runs at the enemy. Which hat, and where the ring starts to
 * turn, come from the shared key (`bookOf(caster).key`), so both screens agree.
 *
 * Telegraph: the three real sword lines, from each hat, as wide as the bolt really hits (`boltWidth`), from the cast; `impact` is 1.2 s, the
 * launch. The ring's centre is the cast's `point` (travels with the cast). Standing at the centre takes all three (90); 1 m out in a gap
 * between two lines is clear. Network duels: the caster's screen draws the same swords along the same lines. The hats here are not units. Clean
 * by about 3 s. See pipeline/designs/kit-magic.md.
 */
export interface GrandFinaleSettings {
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultGrandFinale = (): GrandFinaleSettings => ({ damage: FINALE_DAMAGE, knock: 2, loop: false });

// Timeline (seconds).
const LAUNCH = FINALE_WAIT;
const RISE_T = 0.7;
const MOVE_T = LAUNCH - 0.05;
const DURATION = LAUNCH + 1.8;
const LINE_W = boltWidth(FINALE_RADIUS);
const LOOK_HIT = MAGIC_CSS.steel;

const easeOutBack = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
};

export class GrandFinale implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GrandFinaleSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** One line per sword. */
  specs: TelegraphSpec[] = [];
  readonly centre = new THREE.Vector3(0, 0, 6);
  private spots: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private dirs: THREE.Vector3[] = [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -1)];
  private ranges = [FINALE_REACH, FINALE_REACH, FINALE_REACH];
  private origin = new THREE.Vector3();
  private right = 0;
  private time = 0;
  private flags = { start: false, moved: false, launched: false, emerged: false, rabbit: false };
  private appeared = [false, false, false];
  private act: HatAct | null = null;
  private emergeAt = -1;
  private hitFlash = { age: 9, pos: new THREE.Vector3(), size: 1 };

  private hats = new Hats(3);
  private confetti = new Pieces('confetti', 170);
  private stars = new Pieces('star', 80);
  private smoke = new SmokeBall({ color: 0x2a1448, rim: 0x8a4ad0, flake: 0xb05aff, maxBalls: 8 });
  private swords = new Flyers('sword', 3, this.stars, 2.2);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: MAGIC.foil, core: MAGIC.core, additive: false });
  private hitStar = new StarBurst({ points: 8, inner: 0.3, color: MAGIC.violet, core: MAGIC.hot, additive: false });
  private ring: THREE.Mesh;
  private ringMat = new THREE.MeshBasicMaterial({ color: MAGIC.foil, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  private floor: THREE.Mesh;
  private floorMat = new THREE.MeshBasicMaterial({ color: MAGIC.foil, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });

  private v1 = new THREE.Vector3();

  constructor(settings: GrandFinaleSettings = defaultGrandFinale()) {
    this.settings = settings;
    this.screen.tint.set(MAGIC.dark);
    this.screen.impactColor.set(MAGIC.violet);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.visible = false;
    // The thin gold circle on the floor between the hats.
    this.floor = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2), this.floorMat);
    this.floor.visible = false;
    this.floor.renderOrder = 1;
    this.emitters.push(this.smoke.emitter);
    this.group.add(
      this.floor, this.hats.group, this.confetti.mesh, this.stars.mesh, this.smoke.mesh, this.swords.group, this.pop.mesh, this.hitStar.mesh,
      this.ring,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return LAUNCH;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the ring: the aim point (the enemy's spot), the shared key and the obstacle list.
    const s = ctx.sentFrom ?? ctx.from;
    this.origin.set(s.x, 0, s.z);
    this.centre.set(ctx.point.x, 0, ctx.point.z);
    const key = bookOf(ctx.caster).key;
    this.right = shuffleOf(key).right;
    const a0 = key * 0.37;
    const obstacles = ctx.obstacles?.() ?? [];
    this.specs = [];
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i * Math.PI * 2) / 3;
      const p = this.spots[i].set(this.centre.x + Math.sin(a) * FINALE_RING, 0, this.centre.z + Math.cos(a) * FINALE_RING);
      this.dirs[i].set(this.centre.x - p.x, 0, this.centre.z - p.z).normalize();
      const path = bankPath(p, this.dirs[i], FINALE_REACH, 0, obstacles);
      const e = path[path.length - 1];
      this.ranges[i] = Math.max(0.1, Math.hypot(e.x - p.x, e.z - p.z));
      this.specs.push({
        shape: { kind: 'line', x1: p.x, z1: p.z, x2: e.x, z2: e.z, width: LINE_W },
        start: 0,
        impact: LAUNCH,
        until: LAUNCH + this.ranges[i] / FINALE_SPEED,
      });
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centre).setY(1);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    const b = bookOf(ctx.caster);
    const now = performance.now();
    this.act = { kind: 'finale', right: this.right, bornAt: now, until: now + LAUNCH * 1000, popped: false, told: false };
    b.act = this.act;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.act = null;
    this.emergeAt = -1;
    this.appeared = [false, false, false];
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.hitFlash.age = 9;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(MAGIC.violet);
    this.hats.hideAll();
    this.confetti.reset();
    this.stars.reset();
    this.smoke.clear();
    this.swords.reset();
    this.pop.set(this.centre, 0, 0);
    this.hitStar.set(this.centre, 0, 0);
    this.ring.visible = false;
    this.ringMat.opacity = 0;
    this.floor.visible = false;
    this.floorMat.opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.confetti.update(dt);
    this.stars.update(dt);
    this.smoke.update(dt);
    this.swords.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, f = this.flags, ctx = this.ctx, s = this.settings;
    if (t >= DURATION && !this.confetti.busy && !this.stars.busy && !this.swords.busy) {
      const loop = this.settings.loop;
      this.playing = false;
      this.reset();
      clearScreenFx(this.screen);
      if (loop) this.play();
      return;
    }

    // --- 0: purple smoke where he stood. ---
    if (!f.start) {
      f.start = true;
      this.smoke.trigger(this.v1.set(this.origin.x, 0.5, this.origin.z), 1.5, 1.0);
      this.confetti.burst(this.v1.set(this.origin.x, 0.6, this.origin.z), 24, 4.4, { size: 0.16, life: 1.0 });
      this.stars.burst(this.v1, 8, 3.2, { size: 0.26, life: 0.9, up: 1 });
      this.shake = 0.1;
    }

    // --- 0.1..0.3: the hats pop up round the enemy's spot, one after another, with a puff and a flourish of stars. ---
    for (let i = 0; i < 3; i++) {
      const at = 0.1 + i * 0.1;
      if (!this.appeared[i] && t >= at) {
        this.appeared[i] = true;
        const p = this.spots[i];
        this.smoke.trigger(this.v1.set(p.x, 0.4, p.z), 1.0, 0.8);
        this.confetti.burst(this.v1.set(p.x, 0.6, p.z), 14, 3.6, { size: 0.15, life: 0.9 });
        this.stars.burst(this.v1, 5, 3, { size: 0.22, life: 0.8, up: 1 });
        this.shake = Math.max(this.shake, 0.08);
      }
    }
    if (!f.emerged) {
      this.floor.visible = true;
      this.floor.position.set(this.centre.x, 0.04, this.centre.z);
      this.floor.scale.setScalar(FINALE_RING);
      this.floorMat.opacity = 0.7 * THREE.MathUtils.smoothstep(t, 0.1, 0.45);
    } else {
      this.floorMat.opacity *= Math.exp(-dt * 5);
    }
    const glow = THREE.MathUtils.smoothstep(t, RISE_T, LAUNCH);
    for (let i = 0; i < 3; i++) {
      if (!this.appeared[i] || (f.emerged && i === this.right && t - this.emergeAt > 0.6)) continue;
      const p = this.spots[i];
      let grow = easeOutBack((t - (0.1 + i * 0.1)) / 0.2), lift = 0, tilt = 0;
      if (f.emerged && i === this.right) {
        const a = t - this.emergeAt, k = THREE.MathUtils.smoothstep(a / 0.6, 0, 1);
        grow *= 1 - k * 0.98;
        lift = 0.3 * Math.sin(Math.min(1, a / 0.3) * Math.PI);
        tilt = 0.5 * Math.min(1, a / 0.3);
      } else if (f.emerged) {
        grow *= 1 - THREE.MathUtils.smoothstep((t - this.emergeAt) / 0.5, 0, 1);
      } else {
        tilt = Math.sin(t * 16 + i * 2) * 0.09 * glow;
        lift = 0.08 * glow * (0.5 + 0.5 * Math.sin(t * 12 + i));
      }
      this.hats.set(i, p.x, p.z, grow, lift, tilt, 0, f.emerged ? 0 : glow);
    }

    // --- 0.7..1.2: a sword rises out of each hat, point toward the centre. ---
    if (!f.launched) {
      const k = THREE.MathUtils.smoothstep(t, RISE_T, LAUNCH - 0.05);
      for (let i = 0; i < 3; i++) {
        if (t < RISE_T) continue;
        const p = this.spots[i];
        this.v1.set(p.x, 0.5 + 0.7 * k, p.z);
        this.swords.show(i, this.v1, this.dirs[i], 0.3 + 0.7 * k, 0, t);
      }
      if (t >= RISE_T && Math.random() < dt * 30) {
        const p = this.spots[Math.floor(Math.random() * 3)];
        this.stars.burst(this.v1.set(p.x, 0.9, p.z), 1, 1.2, { size: 0.2, life: 0.6, up: 0.3 });
      }
    }

    // --- 1.15: his own client moves him to the hat he steps out of. ---
    if (!f.moved && t >= MOVE_T) {
      f.moved = true;
      ctx?.moveCaster?.(this.spots[this.right].clone(), 0.05);
    }

    // --- 1.2: the swords fly (real bolts; or, on the caster's screen online, drawn along the same lines), and he steps out. ---
    if (!f.launched && t >= LAUNCH) {
      f.launched = true;
      this.shake = 0.35;
      for (let i = 0; i < 3; i++) {
        const from = new THREE.Vector3(this.spots[i].x, BOLT_Y, this.spots[i].z);
        const bolt = ctx?.projectile?.({
          from, dir: this.dirs[i].clone(), speed: FINALE_SPEED, range: this.ranges[i], radius: FINALE_RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: LOOK_HIT },
        }) ?? null;
        this.swords.launch(i, { bolt, from, dir: this.dirs[i], speed: FINALE_SPEED, range: this.ranges[i], onEnd: (at, hit) => this.land(at, hit) });
      }
    }
    this.screen.impact = impactFrameAt(t, LAUNCH, [1], 0.04);
    if (!f.emerged && t >= LAUNCH) this.emerge();
    if (f.emerged) this.after(t - this.emergeAt);

    // The star where a sword ended.
    this.hitFlash.age += dt;
    const hp = StarBurst.pop(this.hitFlash.age, 0.04, 0.14);
    this.hitStar.set(this.hitFlash.pos, this.hitFlash.size * hp.scale, hp.opacity, this.hitFlash.age * 4);
    this.shake *= Math.exp(-dt * 10);
  }

  /** A sword ends: a hit throws confetti and stars; a miss or a wall pops it. */
  private land(at: THREE.Vector3, hit: boolean) {
    this.hitFlash.age = 0;
    this.hitFlash.pos.copy(at);
    this.hitFlash.size = hit ? 2.2 : 1.1;
    this.confetti.burst(at, hit ? 26 : 10, hit ? 5.5 : 3, { size: 0.16, life: 1.0 });
    this.stars.burst(at, hit ? 8 : 3, hit ? 4.4 : 2.4, { size: 0.26, life: 0.9, up: 1 });
    if (hit) this.shake = Math.max(this.shake, 0.2);
  }

  /** He steps out of his hat: smoke, a ring, a star, confetti. */
  private emerge() {
    const f = this.flags, at = this.spots[this.right];
    f.emerged = true;
    this.emergeAt = this.time;
    this.smoke.trigger(this.v1.set(at.x, 0.7, at.z), 1.6, 1.0);
    this.confetti.burst(this.v1.set(at.x, 0.9, at.z), 40, 6.4, { size: 0.18, life: 1.2 });
    this.stars.burst(this.v1, 12, 5, { size: 0.3, life: 1.0, up: 1.1 });
  }

  private after(a: number) {
    const f = this.flags, ctx = this.ctx, at = this.spots[this.right];
    const rk = THREE.MathUtils.clamp(a / 0.5, 0, 1);
    this.ring.visible = rk < 1;
    this.ring.position.set(at.x, 0.07, at.z);
    this.ring.scale.setScalar(0.6 + 2.8 * (1 - (1 - rk) ** 3));
    this.ringMat.opacity = 0.9 * (1 - rk);
    const sp = StarBurst.pop(a, 0.06, 0.2);
    this.pop.set(this.v1.set(at.x, 1.3, at.z), 2.6 * sp.scale, sp.opacity, a * 3);
    // The rabbit runs at the enemy from the hat he came out of.
    if (!f.rabbit && a > 0.05 && ctx?.summon) {
      f.rabbit = true;
      ctx.summon({
        kind: 'melee', at: new THREE.Vector3(at.x, 0, at.z), count: 1, hp: RABBIT_HP, seconds: RABBIT_LIFE, damage: RABBIT_DAMAGE, attackEvery: 1.2,
        speed: RABBIT_SPEED, color: MAGIC_CSS.hot, look: rabbitLook,
      });
      this.smoke.trigger(this.v1.set(at.x, 0.3, at.z), 0.8, 0.6);
    }
  }
}

export const grandFinaleModule: EffectModule = {
  label: 'grand finale',
  category: 'hero: magic',
  // Click an enemy within 9 m: the ring is fixed where they stood. `radius` only sizes the marker.
  targeting: { mode: 'enemy' },
  create: () => new GrandFinale(),
  telegraphs(effect) {
    const e = effect as GrandFinale;
    return e.ctx ? e.specs : [];
  },
  bloom: { enabled: true, strength: 0.35, radius: 0.35, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GrandFinale;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as GrandFinale).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 150, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
