import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  AshFlakes, FORGE, FORGE_CSS, ForgeSigil, PulseRing, QuenchSteam, SlagCone, SlagPool, Sparks,
} from '../../effects/parts/forge';
import { insideTelegraph, type TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { CORE_SECONDS, fxOf } from '../../traits/forge';

/**
 * Molten Core (forge kit v5, R: a stance, then Quench on the recast). Cast: his chest cracks open (0.4 s: a white-hot star
 * at the chest, a ring of heat out to 2.6 m, sparks) and a cracked glow sits on his chest for the whole 6 s, following his
 * live position (a dark soot disc under jagged molten cracks, pulsing). Every basic attack he swings while it burns sprays a
 * 3 m slag cone (a fan that sweeps out, cools to a dark crust and fades, with sparks): the trait counts the swings
 * (`forgeFx.swings`, shown as 'slag' and mirrored on the other screen) and this effect draws one cone per count. The
 * stance's rules (immunity to slows, roots and knock-ups, +25 per attack, 3 m reach, +1 Heat) are the trait's. It ends at
 * 6 s or when he Quenches (`forgeFx.coreOffAt`), the glow dying in 0.4 s.
 * Recast, Quench (the trait's free second cast, it opens 0.3 s later and ends the core): he stands held 0.6 s while a 3 m
 * forge ring is drawn round him on the ground (0.6 s, the whole telegraph), then it bursts: everyone inside the ring at that
 * moment (their live position) takes 30 plus 10 per second the core had left (`projectile: true`, one short impact frame),
 * with a ring of cold steam, a heat ring, a ripple and a slag pool that quenches to black. The effect tells the two casts
 * apart by itself (a second cast of the same caster figure within 6.6 s of a core is the Quench, a clock per figure, so both
 * screens of a network duel agree); the `mode` setting forces one. The seconds left come from `forgeFx.quenchLeft` (written
 * by the trait, mirrored on the other screen), else from the clock. Clean by 2.4 s after the Quench.
 * See pipeline/designs/kit-forge.md.
 * Since the Heat rework (2026-11-12, `src/traits/forge.ts`) the game plays only the Quench: R is the Quench at any Heat, the
 * trait writes `forgeFx.quenchAt` at the cast and this effect takes a fresh one as "this cast is the Quench", with
 * `quenchLeft` carrying the Heat (0.06 s a point: 30 + 0.6 a point of Heat). The stance is still here for the VFX tool.
 */
export interface MoltenCoreSettings {
  /** Quench: base damage, and damage per second the core had left. */
  damage: number;
  perSecond: number;
  /** 'auto' reads the recast clock; 'core' / 'quench' force one (the tool's play button). */
  mode: 'auto' | 'core' | 'quench';
  loop: boolean;
}

export const defaultMoltenCore = (): MoltenCoreSettings => ({ damage: 30, perSecond: 10, mode: 'auto', loop: false });

// Timeline (seconds).
const IGNITE_T = 0.4;
const FADE_S = 0.4;
const CORE_DURATION = CORE_SECONDS + FADE_S;
const RING_T = 0.6; // Quench: the ring has shown this long, then it bursts
const QUENCH_DURATION = 2.4;
const RING_R = 3;
const CONE_R = 3;
const RECAST_CLOCK = 6600; // ms: a second cast inside this, after a core, is the Quench
const RADIUS = 6; // the AI casts it when the enemy is inside this minus 0.6

/** When each caster figure last cast Molten Core, and whether that cast was the Quench. */
const lastCast = new WeakMap<object, { at: number; quench: boolean }>();

let glowTex: THREE.CanvasTexture | null = null;

/** The chest glow: a dark soot disc, jagged molten cracks (dark outline, orange body, hot core) round a white-hot heart. */
function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const S = 256, c = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  if (g) {
    const soot = g.createRadialGradient(c, c, 0, c, c, c);
    soot.addColorStop(0, 'rgba(18,10,8,0.85)');
    soot.addColorStop(0.7, 'rgba(18,10,8,0.6)');
    soot.addColorStop(1, 'rgba(18,10,8,0)');
    g.fillStyle = soot;
    g.fillRect(0, 0, S, S);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const rays = 9;
    for (let i = 0; i < rays; i++) {
      const a0 = (i / rays) * Math.PI * 2 + rnd() * 0.4;
      const pts: [number, number][] = [[c, c]];
      let a = a0, r = 0;
      const len = 70 + rnd() * 50;
      while (r < len) {
        r += 14 + rnd() * 14;
        a += (rnd() - 0.5) * 0.7;
        pts.push([c + Math.cos(a) * r, c + Math.sin(a) * r]);
      }
      const path = () => { g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); };
      g.strokeStyle = '#120a08'; g.lineWidth = 17; path(); g.stroke();
      g.strokeStyle = '#ff5a12'; g.lineWidth = 10; path(); g.stroke();
      g.strokeStyle = '#ffb03a'; g.lineWidth = 4; path(); g.stroke();
    }
    const heart = g.createRadialGradient(c, c, 0, c, c, 40);
    heart.addColorStop(0, '#fff3d0');
    heart.addColorStop(0.35, '#ffb03a');
    heart.addColorStop(1, 'rgba(255,90,18,0)');
    g.fillStyle = heart;
    g.beginPath(); g.arc(c, c, 40, 0, Math.PI * 2); g.fill();
  }
  glowTex = new THREE.CanvasTexture(cv);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export class MoltenCore implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MoltenCoreSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** True when the last cast is the Quench. */
  quench = false;
  /** The Quench ring (from the caster at the cast). */
  ring: TelegraphShape = { kind: 'circle', x: 0, z: 0, radius: RING_R };
  private time = 0;
  private startMs = 0;
  private seen = 0;
  private offAt = -1;
  private ignited = false;
  private burst = false;
  private emberT = 0;
  private left = 0;
  private center = new THREE.Vector3();

  private glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false }));
  private cones = new SlagCone(4);
  private heat = new PulseRing();
  private sigil = new ForgeSigil();
  private sparks = new Sparks(150);
  private steam = new QuenchSteam(24);
  private ash = new AshFlakes(40);
  private pool = new SlagPool();
  private star = new StarBurst({ points: 8, inner: 0.3, color: FORGE.hot, core: FORGE.core, additive: false });
  private cold = new StarBurst({ points: 8, inner: 0.3, color: FORGE.accent, core: FORGE.core, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: MoltenCoreSettings = defaultMoltenCore()) {
    this.settings = settings;
    this.steam.life = 0.7;
    this.glow.renderOrder = 6;
    this.glow.visible = false;
    this.screen.impactColor.set(FORGE.hot);
    this.screen.tint.set(FORGE.dark);
    this.group.add(
      this.pool.mesh, this.sigil.mesh, this.cones.group, this.heat.mesh, this.glow, this.sparks.mesh, this.steam.mesh, this.ash.mesh,
      this.star.mesh, this.cold.mesh, this.shock.mesh,
    );
    this.reset();
  }

  get duration() {
    return this.quench ? QUENCH_DURATION : CORE_DURATION;
  }

  get impactTime() {
    return this.quench ? RING_T : IGNITE_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    const now = performance.now();
    const prev = lastCast.get(ctx.caster);
    const auto = !!prev && !prev.quench && now - prev.at < RECAST_CLOCK;
    const m = this.settings.mode;
    // In a duel his trait says so (the Heat rule: every R is the Quench): it wrote `quenchAt` just before this cast.
    const told = now - fxOf(ctx.caster).quenchAt < 1500;
    this.quench = m === 'quench' || (m === 'auto' && (auto || told));
    lastCast.set(ctx.caster, { at: now, quench: this.quench });
    this.center.copy(ctx.from).setY(0);
    this.ring = { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RING_R };
    if (this.quench) {
      const fx = fxOf(ctx.caster);
      // The trait wrote the seconds left just before this cast; without it (the tool) the clock says.
      const fresh = now - fx.quenchAt < 1500;
      this.left = fresh ? fx.quenchLeft : Math.max(0, CORE_SECONDS - (prev ? (now - prev.at) / 1000 : CORE_SECONDS / 2));
    }
  }

  play() {
    this.reset();
    this.playing = true;
    this.startMs = performance.now();
    const ctx = this.ctx;
    if (!ctx) return;
    const fx = fxOf(ctx.caster);
    // A Quench ends the glow of the core that came before it (on both screens, and in the tool).
    if (this.quench) fx.coreOffAt = this.startMs;
    this.seen = fx.swings;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.offAt = -1;
    this.ignited = false;
    this.burst = false;
    this.emberT = 0;
    clearScreenFx(this.screen);
    this.screen.tint.set(FORGE.dark);
    this.glow.visible = false;
    this.cones.reset();
    this.heat.reset();
    this.sigil.reset();
    this.sigil.reveal = 0;
    this.sparks.reset();
    this.steam.reset();
    this.ash.reset();
    this.pool.reset();
    this.star.set(this.center, 0, 0);
    this.cold.set(this.center, 0, 0);
    this.shock.set(this.center, 0, 0);
  }

  /** The caster's live feet position and facing. */
  private body() {
    const c = this.ctx?.caster.group.position;
    if (c) this.center.set(c.x, 0, c.z);
    return this.ctx?.caster.group.rotation.y ?? 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.sparks.update(dt);
    this.steam.update(dt);
    this.ash.update(dt);
    this.pool.update(dt);
    this.cones.update(dt);
    this.time += dt;
    if (this.quench) this.updateQuench(dt);
    else this.updateCore(dt);
    if (this.time >= this.duration || (!this.quench && this.offAt >= 0 && this.time >= this.offAt + FADE_S)) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      if (loop) this.play();
    }
  }

  /** The stance: the glow, the embers, one cone per swing. */
  private updateCore(dt: number) {
    const t = this.time, ctx = this.ctx;
    const yaw = this.body();
    const fwdX = Math.sin(yaw), fwdZ = Math.cos(yaw);

    if (!this.ignited && t >= IGNITE_T * 0.5) {
      this.ignited = true;
      this.shake = 0.2;
      this.v1.set(this.center.x + fwdX * 0.3, 1.25, this.center.z + fwdZ * 0.3);
      this.sparks.burst(this.v1, this.v2.set(0, 1, 0), 22, 7, 1.2);
      this.ash.fall(this.center, 2.0, 10, 4, 1.2);
    }
    if (this.ignited) {
      const a = t - IGNITE_T * 0.5;
      const sp = StarBurst.pop(a, 0.02, 0.06);
      this.star.set(this.v1.set(this.center.x + fwdX * 0.4, 1.3, this.center.z + fwdZ * 0.4), 1.3 * sp.scale, sp.opacity, 0.2);
      const g = smoothstep(a / 0.4);
      this.heat.set(this.center, 0.4 + 2.2 * g, 1 - g * g, 0.3);
      this.shake *= Math.exp(-dt * 10);
    }

    // The end: burnt out at 6 s, or Quenched.
    if (this.offAt < 0 && (t >= CORE_SECONDS || (ctx && fxOf(ctx.caster).coreOffAt >= this.startMs))) {
      this.offAt = t;
      this.steam.puff(this.v1.set(this.center.x, 1.3, this.center.z), 0.5);
    }

    // The glow follows his chest.
    const open = smoothstep(t / IGNITE_T);
    const fade = this.offAt < 0 ? 1 : 1 - smoothstep((t - this.offAt) / FADE_S);
    const pulse = 1 + 0.08 * Math.sin(t * 7) + 0.04 * Math.sin(t * 17);
    this.glow.visible = open * fade > 0.01;
    this.glow.position.set(this.center.x + fwdX * 0.35, 1.3, this.center.z + fwdZ * 0.35);
    this.glow.scale.setScalar(Math.max(1.5 * open * pulse, 1e-4));
    this.glow.material.opacity = Math.min(1, fade);

    // One cone per swing.
    if (ctx) {
      const sw = fxOf(ctx.caster).swings;
      if (sw > this.seen && this.offAt < 0) {
        this.seen = sw;
        this.cones.fire(this.center, yaw, CONE_R, 0.6);
        this.v1.set(this.center.x + fwdX * 1.0, 0.7, this.center.z + fwdZ * 1.0);
        this.sparks.burst(this.v1, this.v2.set(fwdX, 0.3, fwdZ), 16, 8, 0.7);
        this.shake = 0.12;
      } else if (sw > this.seen) {
        this.seen = sw;
      }
    }

    // Embers off the cracks.
    this.emberT -= dt;
    if (this.emberT <= 0 && this.offAt < 0 && t > IGNITE_T) {
      this.emberT = 0.18 + 0.2 * Math.random();
      this.v1.set(this.center.x + fwdX * 0.3 + (Math.random() - 0.5) * 0.6, 1.25 + (Math.random() - 0.5) * 0.4, this.center.z + fwdZ * 0.3);
      this.sparks.burst(this.v1, this.v2.set(0, 1, 0), 1, 3, 1.2);
      if (Math.random() < 0.3) this.steam.puff(this.v1.setY(1.7), 0.28);
    }
  }

  /** Quench: the ring is drawn for 0.6 s, then it bursts. */
  private updateQuench(dt: number) {
    const t = this.time, ctx = this.ctx;
    this.center.copy(ctx?.from ?? this.center).setY(0);
    const R = this.ring as Extract<TelegraphShape, { kind: 'circle' }>;

    if (t < RING_T) {
      // The ring draws itself round him and glows hotter; heat gathers at the chest.
      const k = t / RING_T;
      this.sigil.set(this.center, RING_R, t * 0.6);
      this.sigil.reveal = smoothstep(k / 0.7);
      this.sigil.opacity = 1;
      this.sigil.glow = 0.4 + 0.6 * k;
      if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        this.v1.set(this.center.x + Math.cos(a) * RING_R, 0.1, this.center.z + Math.sin(a) * RING_R);
        this.sparks.burst(this.v1, this.v2.set(-Math.cos(a) * 0.4, 1, -Math.sin(a) * 0.4), 1, 4, 0.5);
      }
    }

    if (!this.burst && t >= RING_T) {
      this.burst = true;
      this.shake = 0.4;
      this.v1.set(this.center.x, 1.2, this.center.z);
      this.sparks.burst(this.v1, this.v2.set(0, 1, 0), 40, 9, 1.4);
      this.ash.fall(this.center, 3, 14, 4, 1.4);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
        const r = 0.8 + Math.random() * 2.2;
        this.v1.set(this.center.x + Math.cos(a) * r, 0.3 + Math.random() * 0.5, this.center.z + Math.sin(a) * r);
        this.steam.puff(this.v1, 0.5 + Math.random() * 0.4, i % 3 === 0);
      }
      this.pool.place(this.center);
      this.pool.spread(2.8, 0.3);
      this.pool.cool(0.9, 0.2);
      this.pool.fade(0.6, 1.3);
      if (ctx) {
        const dmg = this.settings.damage + this.settings.perSecond * this.left;
        for (const e of ctx.targets) {
          const p = e.group.position;
          if (!insideTelegraph(R, p.x, p.z)) continue;
          ctx.hit(e, { damage: dmg, knock: 3.5, from: ctx.from, color: FORGE_CSS.body, projectile: true });
        }
      }
    }
    this.screen.impact = impactFrameAt(t, RING_T, [1], 0.04);

    if (this.burst) {
      const a = t - RING_T;
      this.sigil.opacity = 1 - smoothstep(a / 0.4);
      this.sigil.glow = 1;
      const g = smoothstep(a / 0.3);
      this.heat.set(this.center, 0.3 + (RING_R + 0.2) * g, 1 - g * g, 0.4);
      const sp = StarBurst.pop(a, 0.02, 0.06);
      this.cold.set(this.v1.set(this.center.x, 1.2, this.center.z), 1.6 * sp.scale, sp.opacity, 0.2);
      this.shock.set(this.center, 0.4 + 3.4 * g, 0.04 * (1 - g) * (1 - g));
      this.shake = Math.max(this.shake * Math.exp(-dt * 9), 0);
    }
  }
}

export const moltenCoreModule: EffectModule = {
  label: 'molten core',
  category: 'hero: forge',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new MoltenCore(),
  telegraphs(effect) {
    const e = effect as MoltenCore;
    if (!e.ctx || !e.quench) return [];
    return [{ shape: e.ring, start: 0, impact: RING_T }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as MoltenCore;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as MoltenCore).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'perSecond', 0, 30, 1);
    f.add(s, 'mode', ['auto', 'core', 'quench']);
  },
};
