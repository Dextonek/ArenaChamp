import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { CrescentArc, clearScreenFx, createScreenFx } from '../../effects/parts';
import {
  FROST, FROST_CSS, FrostBreath, FrostFerns, IceCrystals, RimeRing, RimeSleeves, Snow,
} from '../../effects/parts/frost';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Glacial Mantle (frost kit, E: self aura). Frost ferns grow out from under her and up her coat; six long ice crystals
 * grow at her shoulders and hips like armour plates, pointing outward and down. A blizzard band of snow and thin pale
 * wind arcs circles her; twice the crystals flare, a rime ring races out to the radius and the enemies inside get
 * ferns at their feet and a small hit. Then the mantle shatters and the ferns fade. Loopable between 0.35 and 2.8.
 * See pipeline/designs/kit-frost.md.
 */
export interface GlacialMantleSettings {
  damage: number;
  loop: boolean;
}

export const defaultGlacialMantle = (): GlacialMantleSettings => ({ damage: 12, loop: false });

// Timeline (seconds).
const FORM_END = 0.35;
const PULSE_1 = 1.0;
const PULSE_2 = 2.0;
const SHATTER_T = 2.8;
const DURATION = 3.3;
const RADIUS = 4;
const PLATES = 6;
const ARCS = 4;
const MAX_ENEMY_FERNS = 4;

export class GlacialMantle implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GlacialMantleSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private from = new THREE.Vector3(0, 0, 14);
  private fwd = new THREE.Vector3(0, 0, -1);
  private chest = new THREE.Vector3(0, 1.25, 14);

  private flags = { breath: false, plates: false, snow: false, pulse1: false, pulse2: false, shattered: false };
  private pulseAt = [-9, -9];

  // Parts.
  private breath = new FrostBreath(16);
  private ferns = new FrostFerns({ variant: 0, maxShards: 24 });
  private enemyFerns = Array.from({ length: MAX_ENEMY_FERNS }, (_, i) => new FrostFerns({ variant: i % 2, maxShards: 0 }));
  private sleeves = new RimeSleeves(1);
  private plates = new IceCrystals({ maxSpikes: PLATES, maxShards: 60 });
  private snow = new Snow({ max: 56 });
  private ring = new RimeRing();
  private arcs: CrescentArc[] = [];
  private arcPivots: THREE.Group[] = [];

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: GlacialMantleSettings = defaultGlacialMantle()) {
    this.settings = settings;
    this.screen.tint.set(FROST.dark);
    this.ferns.renderOrder = 2;
    for (const f of this.enemyFerns) f.renderOrder = 3;
    this.ring.mesh.renderOrder = 4;
    for (let i = 0; i < ARCS; i++) {
      const arc = new CrescentArc({ radius: 2.9, width: 0.24, sweep: Math.PI * 0.95, style: 'toon', edge: FROST.core, mid: FROST.rime, outer: FROST.body });
      arc.mesh.rotation.x = -Math.PI / 2; // lie in the horizontal plane
      const pivot = new THREE.Group();
      pivot.add(arc.mesh);
      this.arcs.push(arc);
      this.arcPivots.push(pivot);
    }
    this.group.add(
      this.ferns.mesh, ...this.enemyFerns.map((f) => f.mesh), this.ring.mesh, this.sleeves.mesh, this.plates.mesh,
      ...this.arcPivots, this.snow.mesh, this.breath.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return PULSE_1;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.chest.copy(ctx.from).addScaledVector(this.fwd, 0.15).setY(1.25);
    this.screen.focus.copy(this.chest);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.pulseAt[0] = this.pulseAt[1] = -9;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(FROST.dark);
    this.breath.reset();
    this.ferns.reset();
    for (const f of this.enemyFerns) f.reset();
    this.sleeves.clear();
    this.plates.reset();
    this.snow.reset();
    this.ring.set(this.from, 0, 0.5, 0);
    for (const a of this.arcs) a.opacity = 0;
  }

  /** The six plates: three at the shoulders, three at the hips, alternating around her, pointing outward and down. */
  private growPlates() {
    const base = new THREE.Vector3(), dir = new THREE.Vector3();
    const yaw = Math.atan2(this.fwd.x, this.fwd.z);
    for (let i = 0; i < PLATES; i++) {
      const a = yaw + Math.PI / 6 + (i / PLATES) * Math.PI * 2;
      const rx = Math.sin(a), rz = Math.cos(a);
      const shoulder = i % 2 === 0;
      base.set(this.from.x + rx * 0.38, shoulder ? 1.55 : 0.95, this.from.z + rz * 0.38);
      dir.set(rx * 0.78, -0.62, rz * 0.78);
      this.plates.spike(base, dir, shoulder ? 2.7 : 2.25, 0.55, 0.25, 0.04 + i * 0.03);
    }
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.breath.update(dt);
    this.ferns.update(dt);
    for (const f of this.enemyFerns) f.update(dt);
    this.plates.update(dt);
    this.snow.update(dt);
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;
    const f = this.flags;

    // Events.
    if (!f.breath && t >= 0.02) {
      f.breath = true;
      this.ferns.grow(this.from, 2.2, FORM_END);
      this.breath.blow(this.v1.copy(this.chest), this.v2.copy(this.fwd).setY(0.1), 1.2, 0.2);
    }
    if (!f.plates && t >= 0.02) {
      f.plates = true;
      this.growPlates();
    }
    if (!f.snow && t >= FORM_END) {
      f.snow = true;
      this.snow.swirl(this.from, 3.5, 44, { y: 1.3, ySpread: 1.8, speed: 3.0, band: 0.43 });
    }
    for (let p = 0; p < 2; p++) {
      const at = p === 0 ? PULSE_1 : PULSE_2;
      const key = p === 0 ? 'pulse1' : 'pulse2';
      if (!f[key] && t >= at) {
        f[key] = true;
        this.pulseAt[p] = at;
        if (ctx) {
          const n = Math.min(MAX_ENEMY_FERNS, ctx.targets.length);
          for (let i = 0; i < n; i++) this.enemyFerns[i].grow(this.v1.copy(ctx.targetPos[i]).setY(0), 1.3, 0.25);
          for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.damage, knock: 0, color: FROST_CSS.body });
        }
      }
    }
    if (!f.shattered && t >= SHATTER_T) {
      f.shattered = true;
      this.plates.shatter(6, 4, 0.28);
      this.ferns.fade(0.4);
      for (const ef of this.enemyFerns) ef.fade(0.4);
      this.snow.stop();
    }

    this.layout();
  }

  private layout() {
    const t = this.time;

    // --- Screen: a gentle cold darken so the pale ferns and plates read. ---
    this.screen.darken = 0.25 * smoothstep(t / 0.35) * (1 - smoothstep((t - SHATTER_T) / 0.4));

    // --- Rime climbs her coat, then fades with the ferns. ---
    this.sleeves.set(0, this.from, 2.2, 1.0, smoothstep(t / FORM_END), 1 - smoothstep((t - SHATTER_T) / 0.4));

    // --- Plates flare pale at each pulse. ---
    let flare = 0;
    for (const at of this.pulseAt) {
      const k = (this.time - at) / 0.4;
      if (k >= 0 && k < 1) flare = Math.max(flare, (1 - k) * (1 - k));
    }
    this.plates.flare = flare;

    // --- The rime ring races out to the radius at each pulse. ---
    let ringR = 0, ringOp = 0;
    for (const at of this.pulseAt) {
      const k = (t - at) / 0.4;
      if (k >= 0 && k < 1) {
        ringR = RADIUS * (1 - Math.pow(1 - k, 3));
        ringOp = 1 - k * k;
      }
    }
    this.ring.set(this.from, ringR, 0.55, ringOp);

    // --- Wind arcs: thin pale bands circling her at different heights. ---
    const wind = smoothstep((t - FORM_END) / 0.25) * (1 - smoothstep((t - (SHATTER_T - 0.2)) / 0.3));
    for (let i = 0; i < ARCS; i++) {
      const arc = this.arcs[i], pv = this.arcPivots[i];
      pv.position.set(this.from.x, [0.55, 1.05, 1.5, 0.85][i], this.from.z);
      pv.rotation.y = t * (2.6 + 0.3 * i) + (i * Math.PI) / 2;
      arc.head = 1;
      arc.length = 0.9;
      arc.erosion = 0.1;
      arc.time = t;
      arc.opacity = 0.9 * wind;
    }

    // --- A small shake on each pulse. ---
    let sh = 0;
    for (const at of this.pulseAt) if (t >= at) sh = Math.max(sh, 0.12 * Math.exp(-(t - at) * 10));
    this.shake = sh;
  }
}

export const glacialMantleModule: EffectModule = {
  label: 'glacial mantle',
  category: 'hero: frost',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new GlacialMantle(),
  telegraphs(effect) {
    const e = effect as GlacialMantle;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: 0, impact: PULSE_1 }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as GlacialMantle;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as GlacialMantle).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
  },
};
