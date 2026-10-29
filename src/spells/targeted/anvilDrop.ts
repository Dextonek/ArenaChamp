import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  FORGE_CSS, ForgeIron, ForgeSigil, IronChunks, QuenchSteam, SlagBlobs, SlagPool, Sparks,
} from '../../effects/parts/forge';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Anvil Drop (forge kit, W: ground zone): a ring of molten runes draws itself on the ground while a huge dark anvil
 * with hot edges falls from the sky onto it. It slams (slag splashes out in a ring, a crater of slag, heavy sparks,
 * a ground shock), holds, then crumbles into iron chunks that sink while the crater cools to black. See
 * pipeline/designs/kit-forge.md.
 */
export interface AnvilDropSettings {
  damage: number;
  loop: boolean;
}

export const defaultAnvilDrop = (): AnvilDropSettings => ({ damage: 65, loop: false });

// Timeline (seconds).
const FALL_T = 0.1; // the anvil starts to fall
const HIT_T = 0.7;
const CRUMBLE_T = 1.3;
const DURATION = 2.3;

const RADIUS = 3.5;
const ANVIL_SCALE = 2.5;
const START_Y = 9;
const SINK_Y = -0.4;
const BLOBS = 9;

export class AnvilDrop implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AnvilDropSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private point = new THREE.Vector3(0, 0, -8);

  // Event flags.
  private flags = { impacted: false, crumbled: false, steam1: false, steam2: false, steam3: false };

  // Parts.
  private sigil = new ForgeSigil();
  private anvil = ForgeIron.anvil(ANVIL_SCALE);
  private pool = new SlagPool({ plate: 0.8 });
  private blobs = new SlagBlobs(16, 10);
  private sparks = new Sparks(140);
  private chunks = new IronChunks(40);
  private steam = new QuenchSteam(10);
  private groundShock = new ShockRefraction({ facing: 'ground' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: AnvilDropSettings = defaultAnvilDrop()) {
    this.settings = settings;
    this.blobs.splatCool = 0.55;
    this.blobs.splatFade = 0.3;
    this.steam.life = 0.55;
    this.group.add(
      this.sigil.mesh, this.pool.mesh, this.blobs.mesh, this.anvil, this.chunks.mesh, this.sparks.mesh, this.steam.mesh,
      this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point);
    this.pool.place(this.point);
    this.sigil.set(this.point, RADIUS, 0);
    this.anvil.rotation.y = ctx.aim;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.sigil.reset();
    this.pool.reset();
    this.blobs.reset();
    this.sparks.reset();
    this.chunks.reset();
    this.steam.reset();
    this.anvil.visible = false;
    this.groundShock.set(this.point, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.sparks.update(dt);
    this.pool.update(dt);
    this.blobs.update(dt);
    this.chunks.update(dt);
    this.steam.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.impacted && t >= HIT_T) {
      f.impacted = true;
      this.slam();
      if (ctx) {
        ctx.targets.forEach((e, i) => {
          const p = ctx.targetPos[i];
          if (p && Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS) {
            ctx.hit(e, { damage: this.settings.damage, knock: 6, from: this.point, color: FORGE_CSS.body });
          }
        });
      }
    }
    if (!f.crumbled && t >= CRUMBLE_T) {
      f.crumbled = true;
      this.chunks.burst(this.v1.copy(this.point).setY(1.0), 26, 3.5, 0.5, 0.35, 0.9, 1.4);
      this.sparks.burst(this.v1.copy(this.point).setY(1.2), this.v2.set(0, 1, 0), 8, 4, 1.0);
      this.shake = Math.max(this.shake, 0.15);
    }
    if (!f.steam1 && t >= 1.0) { f.steam1 = true; this.steam.puff(this.ringPoint(0.4, 2.2), 0.6); }
    if (!f.steam2 && t >= 1.3) { f.steam2 = true; this.steam.puff(this.ringPoint(2.3, 1.8), 0.55); this.steam.puff(this.ringPoint(4.2, 2.4), 0.5); }
    if (!f.steam3 && t >= 1.6) { f.steam3 = true; this.steam.puff(this.ringPoint(5.5, 2.0), 0.5); }

    this.layout();
  }

  private ringPoint(angle: number, r: number) {
    return this.v1.set(this.point.x + Math.cos(angle) * r, 0.3, this.point.z + Math.sin(angle) * r);
  }

  /** The slam: slag ring, crater, sparks, shake. */
  private slam() {
    for (let i = 0; i < BLOBS; i++) {
      const a = (i / BLOBS) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const sp = 5 + Math.random() * 2;
      this.v1.set(this.point.x + Math.cos(a) * 1.2, 0.5, this.point.z + Math.sin(a) * 1.2);
      this.v2.set(Math.cos(a) * sp, 3 + Math.random() * 0.8, Math.sin(a) * sp);
      this.blobs.throw(this.v1, this.v2, 0.22 + Math.random() * 0.08);
    }
    this.pool.spread(3, 0.3);
    this.pool.cool(1.1, 0.25);
    this.pool.fade(0.25, 1.35);
    this.sparks.burst(this.v1.copy(this.point).setY(0.8), this.v2.set(0, 1, 0), 40, 11, 1.2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      this.sparks.burst(this.v1.copy(this.point).setY(0.5), this.v2.set(Math.cos(a), 0.35, Math.sin(a)), 4, 8, 0.4);
    }
    this.shake = 0.5;
  }

  private layout() {
    const t = this.time;
    const after = t - HIT_T;
    const f = this.flags;

    // --- 0..0.5 The rune ring draws on; it flares at the slam and fades with the crater. ---
    this.sigil.reveal = smoothstep(t / 0.5);
    this.sigil.opacity = 1 - smoothstep((t - 1.55) / 0.55);
    this.sigil.glow = f.impacted ? 0.5 + 0.5 * Math.exp(-after * 5) : 0.5 + 0.3 * smoothstep(t / 0.6);

    // --- The anvil: falls with a fast ease-in, sinks into the floor, holds, crumbles away. ---
    if (t < CRUMBLE_T) {
      const u = THREE.MathUtils.clamp((t - FALL_T) / (HIT_T - FALL_T), 0, 1);
      this.anvil.position.set(this.point.x, START_Y + (SINK_Y - START_Y) * u * u, this.point.z);
      this.anvil.visible = true;
      const heat = t < HIT_T ? 0.2 : 0.05 + 0.85 * Math.exp(-after * 7);
      ForgeIron.heat(this.anvil, heat);
    } else {
      this.anvil.visible = false;
    }

    // --- Slam: ground refraction. ---
    if (f.impacted) {
      const gp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.groundShock.set(this.point, 1 + 4 * gp, 0.045 * (1 - gp) * (1 - gp));
      this.shake = 0.5 * Math.exp(-after * 9) + (f.crumbled ? 0.15 * Math.exp(-(t - CRUMBLE_T) * 10) : 0);
    }
  }
}

export const anvilDropModule: EffectModule = {
  label: 'anvil drop',
  category: 'hero: forge',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new AnvilDrop(),
  telegraphs(effect) {
    const e = effect as AnvilDrop;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as AnvilDrop;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as AnvilDrop).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 200, 1);
  },
};
