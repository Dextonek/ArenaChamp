import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  Afterimage, CutFlash, CutShape, CutShards, SHADOW, SHADOW_CSS, ShadowPool, facing, shadowEaseOut,
} from '../../effects/parts/shadow';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { MARK_SHARE, shadowMarks, type ShadowMarkTally } from '../../traits/shadow';

/**
 * Shadow Mark (shadow kit, R: the assassin's ultimate). A black crescent sigil with a violet edge settles over the clicked
 * enemy's head and a shadow pool spreads under its feet; both follow it. For 2 s the damage Nyx's hits do to it is
 * tallied (`shadowMarks`, filled by the trait's `dealt`). At 1.8 s she steps out of the shadows to stand behind it
 * (`ctx.moveCaster`, 0.15 s, on the enemy's live position and facing; a trail of her figures), and at 2.0 s she cuts
 * it with two crossed blades: base damage plus 30% of what the tally holds. The sigil pulses mint just before.
 * The mark cannot be walked out of: the zone (`telegraphs`) is a circle that is moved onto the enemy every frame, so
 * the duel's late-hit filter (it drops spell hits outside the cast's zones) lets the strike through; the zone itself
 * is only drawn for the first 0.35 s as the mark lands. Clean by 3.2 s.
 */
export interface ShadowMarkSettings {
  damage: number;
  loop: boolean;
}

export const defaultShadowMark = (): ShadowMarkSettings => ({ damage: 80, loop: false });

// Timeline (seconds).
const MARK_T = 0.2;
const LANDED_T = 0.35; // the zone's drawn impact: the mark has landed
const JUMP_T = 1.8;
const JUMP_SECONDS = 0.15;
const STRIKE_T = 2.0;
const DURATION = 3.2;

const BEHIND = 1.4; // metres behind the enemy she lands
const CHEST_Y = 1.3;
const SIGIL_Y = 3.1;
const BLADE_ROT = 0.62;
const UP = new THREE.Vector3(0, 1, 0);

export class ShadowMark implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ShadowMarkSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The hit zone: moved onto the enemy every frame (see the class doc). */
  readonly zone: Extract<TelegraphShape, { kind: 'circle' }> = { kind: 'circle', x: 0, z: 0, radius: 1.6 };
  private time = 0;
  private flags = { jumped: false, struck: false };
  private mark: ShadowMarkTally | null = null;
  private owner: object | null = null;
  private jumpAt = 0;
  private nrm = new THREE.Vector3(0, 0, 1);
  private right = new THREE.Vector3(1, 0, 0);
  private from = new THREE.Vector3();
  private land = new THREE.Vector3();
  private chest = new THREE.Vector3();

  private pool = new ShadowPool();
  private sigil = new CutShape({ kind: 'crescent', renderOrder: 8, edgeWidth: 0.12 });
  private dot = new CutShape({ kind: 'disc', fill: SHADOW.accent, renderOrder: 9, edgeWidth: 0.02 });
  private trail = new Afterimage(5);
  private blades = [new CutShape({ kind: 'blade', renderOrder: 6 }), new CutShape({ kind: 'blade', renderOrder: 6 })];
  private cut = new CutFlash();
  private shards = new CutShards(36);

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ShadowMarkSettings = defaultShadowMark()) {
    this.settings = settings;
    this.dot.edge = 0;
    this.group.add(this.pool.mesh, this.trail.mesh, ...this.blades.map((b) => b.mesh), this.sigil.mesh, this.dot.mesh, this.shards.mesh, this.cut.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return STRIKE_T;
  }

  /** The marked enemy's live ground position (the cast point if there is none). */
  private spot(out: THREE.Vector3) {
    const e = this.ctx?.targets[0];
    return e ? out.copy(e.group.position).setY(0) : out.copy(this.ctx?.point ?? out.set(0, 0, 0)).setY(0);
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    facing(ctx.aim, this.nrm);
    this.right.crossVectors(UP, this.nrm).normalize();
    this.cut.face(ctx.aim);
    this.trail.face(ctx.aim);
    this.spot(this.v1);
    this.zone.x = this.v1.x;
    this.zone.z = this.v1.z;
  }

  play() {
    this.reset();
    this.playing = true;
    if (!this.ctx) return;
    // Open the tally: the trait adds her hits' damage to it until the strike.
    this.owner = this.ctx.caster;
    this.mark = { active: true, taken: 0 };
    shadowMarks.set(this.owner, this.mark);
  }

  private reset() {
    if (this.mark) this.mark.active = false;
    this.mark = null;
    this.owner = null;
    this.time = 0;
    this.shake = 0;
    this.jumpAt = 0;
    this.flags.jumped = this.flags.struck = false;
    this.pool.reset();
    this.sigil.reset();
    this.dot.reset();
    this.dot.edge = 0;
    this.trail.reset();
    for (const b of this.blades) b.reset();
    this.cut.reset();
    this.shards.reset();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.pool.update(dt);
    this.shards.update(dt);
    this.cut.update(dt);
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
    const tp = this.spot(this.v1);
    // The zone follows the enemy, so the strike lands wherever it walked (see the class doc).
    this.zone.x = tp.x;
    this.zone.z = tp.z;
    this.chest.set(tp.x, CHEST_Y, tp.z);

    // --- The mark: a pool under the enemy's feet and the sigil over its head, until the strike. ---
    const marked = t >= MARK_T && !f.struck;
    this.pool.spread(tp, 1.3, marked ? smoothstep((t - MARK_T) / 0.25) : 1);
    this.pool.opacity = f.struck ? 0 : 1;
    if (marked) {
      const pulse = t > JUMP_T - 0.2 ? 1 + 0.18 * Math.sin(t * 40) : 1;
      this.v2.set(tp.x, SIGIL_Y + 0.12 * Math.sin(t * 3), tp.z);
      this.sigil.place(this.v2, this.nrm, 1.1 * shadowEaseOut((t - MARK_T) / 0.2) * pulse, t * 1.4);
      this.sigil.opacity = 1;
      this.dot.place(this.v2, this.nrm, 0.22 * pulse, 0);
      this.dot.opacity = t > JUMP_T - 0.3 ? 1 : 0;
    } else {
      this.sigil.opacity = 0;
      this.dot.opacity = 0;
    }

    // --- 1.8 s: she steps out of the shadows behind the enemy (its facing, live). ---
    if (!f.jumped && t >= JUMP_T) {
      f.jumped = true;
      this.jumpAt = t;
      const e = ctx?.targets[0];
      const yaw = e ? e.group.rotation.y : ctx?.aim ?? 0;
      this.land.set(tp.x - Math.sin(yaw) * BEHIND, 0, tp.z - Math.cos(yaw) * BEHIND);
      if (ctx) {
        this.from.copy(ctx.caster.group.position).setY(0.05);
        const real = ctx.moveCaster?.(this.land, JUMP_SECONDS);
        if (real) this.land.copy(real);
      }
      this.shards.burst(this.v2.set(this.from.x, 0.8, this.from.z), 1.0, 10, 4, 3, 0.9);
    }
    if (f.jumped && !f.struck) {
      this.trail.trail(this.from, this.v2.copy(this.land).setY(0.05), 4, Math.min(1, (t - this.jumpAt) / 0.3));
    }

    // --- 2.0 s: two crossed blades cut through it; base damage plus 30% of the tally. ---
    if (!f.struck && t >= STRIKE_T) {
      f.struck = true;
      this.shake = 0.6;
      this.cut.cut(this.chest, this.v2.copy(this.right).multiplyScalar(0.7).addScaledVector(UP, 0.7), 3);
      this.shards.burst(this.v2.set(tp.x, 0.6, tp.z), 1.8, 22, 5, 4, 1.2);
      const target = ctx?.targets[0];
      const share = this.mark ? this.mark.taken * MARK_SHARE : 0;
      if (this.mark) this.mark.active = false;
      if (ctx && target) {
        ctx.hit(target, { damage: this.settings.damage + share, knock: 3, from: this.land, color: SHADOW_CSS.hot });
      }
    }
    for (let i = 0; i < 2; i++) {
      const a = i === 0 ? BLADE_ROT : -BLADE_ROT;
      const u = (t - STRIKE_T) / 0.1;
      const off = -1.8 + 2.2 * shadowEaseOut(u);
      this.v2.copy(this.chest).addScaledVector(this.right, Math.cos(a) * off).addScaledVector(UP, Math.sin(a) * off);
      this.blades[i].place(this.v2, this.nrm, 3.7, a);
      // Held for a beat, then gone.
      this.blades[i].opacity = t >= STRIKE_T && t < STRIKE_T + 0.4 ? 1 : 0;
    }
    this.shake *= Math.exp(-dt * 10);
  }
}

export const shadowMarkModule: EffectModule = {
  label: 'shadow mark',
  category: 'hero: shadow',
  // Clicked enemy, else the nearest one.
  targeting: { mode: 'enemy' },
  create: () => new ShadowMark(),
  telegraphs(effect) {
    const e = effect as ShadowMark;
    if (!e.ctx) return [];
    // The live zone (moved onto the enemy by the effect) lets the 2 s strike pass the duel's late-hit filter. Drawn only as
    // the mark lands; the short impact also keeps the hero rooted for just that moment.
    return [{ shape: e.zone, start: 0, impact: LANDED_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as ShadowMark;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as ShadowMark).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
  },
};
