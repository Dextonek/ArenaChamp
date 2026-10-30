import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { BARD, BARD_CSS, Lyre, Notes, SoundRings, Stave } from '../../effects/parts/bard';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Crescendo (bard kit, R: the MOBA ultimate). Under the normal gameplay camera, no letterbox: the world darkens to
 * plum-black and a circle of staves marks radius 5 round him. In front of him a giant golden lyre (about 6 tall) rises, three
 * staves spiral up from the zone edge into it carrying hundreds of notes, its strings shimmer faster and enemies are
 * pulled a little toward the centre. At 1.6 every note stops mid-air and the strings draw back; a dead beat at 1.85;
 * at 2.0 the strings snap forward and a wall of sound rings races down onto the point. At 2.2 the chord lands: two
 * impact frames, concentric sound rings across the zone, every note scatters, a gold star, ground refraction, the hit
 * and a short stun. The notes drift down and fade, the lyre dissolves into notes, the dark lifts. Clean by 4.5 s.
 * See pipeline/designs/kit-bard.md.
 */
export interface CrescendoSettings {
  damage: number;
  stunSeconds: number;
  loop: boolean;
}

export const defaultCrescendo = (): CrescendoSettings => ({ damage: 95, stunSeconds: 0.8, loop: false });

// Timeline (seconds).
const MARK_END = 0.4; // darkness in, the ring of staves drawn
const RISE_T = 0.3; // the lyre starts to rise
const FREEZE_T = 1.6; // the lyre is up, every note stops, the strings draw back
const BEAT_T = 1.85; // dead beat 1.85..2.0
const CHORD_T = 2.0;
const HIT_T = 2.2;
const DISSOLVE_T = 2.6;
const DISSOLVE_END = 3.4;
const DURATION = 4.5;

const RADIUS = 5;
const LYRE_SCALE = 6;
const LYRE_Y = 0.2; // the lyre's base at rest (its top stays under y 8.5)
const LYRE_Y0 = -7; // buried below the floor at the start
const LYRE_BACK = 1.5; // from the point, away from `lean`: self-centred, so the lyre stands this far in front of him
const SPIRALS = 3;
const SPIRAL_PTS = 56;
const RING_PTS = 64;
const NOTE_RATE = 150; // notes per second while the staves feed the lyre

export class Crescendo implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CrescendoSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry.
  private point = new THREE.Vector3(0, 0, -8);
  private victims: { enemy: Enemy; feet: THREE.Vector3 }[] = [];
  /** Horizontal unit vector from the point toward the caster. */
  private lean = new THREE.Vector3(0, 0, 1);
  private lyrePos = new THREE.Vector3();
  private yaw = 0;

  private flags = { ring: false, lyre: false, hit: false, snapped: false, dissolved: false, scattered: false };
  private chord = 0;
  private burst = 0;
  private noteT = 0;
  private dissolveT = 0;

  // Parts.
  private lyre = new Lyre();
  private spirals: Stave[] = [];
  private ringStave = new Stave(RING_PTS);
  private notes = new Notes(360);
  private rings = new SoundRings(14);
  private shade: THREE.Mesh;
  private shadeMat = new THREE.MeshBasicMaterial({ color: BARD.dark, transparent: true, opacity: 0, depthWrite: false });
  private pop = new StarBurst({ points: 12, inner: 0.3, color: BARD.accent, core: 0xfff6d0, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private path: THREE.Vector3[] = [];
  private ringPath: THREE.Vector3[] = [];

  // Scratch.
  private center = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(settings: CrescendoSettings = defaultCrescendo()) {
    this.settings = settings;
    this.screen.impactColor.set(BARD.hot);
    this.screen.tint.set(BARD.dark);
    for (let i = 0; i < SPIRALS; i++) this.spirals.push(new Stave(SPIRAL_PTS));
    for (let i = 0; i < SPIRAL_PTS; i++) this.path.push(new THREE.Vector3());
    for (let i = 0; i <= RING_PTS; i++) this.ringPath.push(new THREE.Vector3());
    // A dark layer under the stave ring so the parchment reads on the floor.
    this.shade = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), this.shadeMat);
    this.shade.renderOrder = 1;
    this.shade.visible = false;
    this.group.add(
      this.shade, this.ringStave.mesh, ...this.spirals.map((s) => s.mesh), this.lyre.mesh, this.notes.mesh, this.rings.mesh,
      this.pop.mesh, this.groundShock.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the chord are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Self-centred: the chord is round Cantor; the lyre rises in front of him (lean points back at him).
    this.point.copy(ctx.from).setY(0);
    this.lean.set(-Math.sin(ctx.aim), 0, -Math.cos(ctx.aim));
    this.yaw = Math.atan2(this.lean.x, this.lean.z);
    this.lyrePos.copy(this.point).addScaledVector(this.lean, -LYRE_BACK);
    this.victims.length = 0;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      if (Math.hypot(p.x - this.point.x, p.z - this.point.z) > RADIUS) return;
      this.victims.push({ enemy: e, feet: p.clone().setY(0) });
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(2);
    this.groundShock.set(this.point, 0, 0);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.chord = 0;
    this.burst = 0;
    this.noteT = 0;
    this.dissolveT = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    clearScreenFx(this.screen);
    this.screen.tint.set(BARD.dark);
    this.lyre.reset();
    for (const s of this.spirals) s.reset();
    this.ringStave.reset();
    this.notes.reset();
    this.rings.reset();
    this.shade.visible = false;
    this.shadeMat.opacity = 0;
    this.pop.set(this.point, 0, 0);
    this.groundShock.set(this.point, 0, 0);
  }

  /** The lyre's base height at time `t`. */
  private lyreY(t: number) {
    return LYRE_Y0 + (LYRE_Y - LYRE_Y0) * easeOut((t - RISE_T) / (FREEZE_T - RISE_T));
  }

  /** Point `s` (0 zone edge .. 1 the lyre) of spiral `k`, in `out`. */
  private spiralAt(k: number, s: number, out: THREE.Vector3) {
    const a = (k / SPIRALS) * Math.PI * 2 + 0.3 + s * Math.PI * 2.3;
    const r = RADIUS * Math.pow(1 - s, 1.1);
    const w = Math.pow(s, 2.2);
    const cx = this.point.x * (1 - w) + this.lyrePos.x * w, cz = this.point.z * (1 - w) + this.lyrePos.z * w;
    return out.set(cx + Math.cos(a) * r, 0.3 + Math.pow(s, 0.9) * (this.center.y - 0.3), cz + Math.sin(a) * r);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    const held = this.playing && this.time >= BEAT_T && this.time < CHORD_T;
    const frozenNotes = this.playing && this.time >= FREEZE_T && this.time < HIT_T;
    this.lyre.frozen = this.rings.frozen = held;
    this.notes.frozen = this.ringStave.frozen = frozenNotes;
    for (const s of this.spirals) s.frozen = frozenNotes;
    this.lyre.update(dt);
    for (const s of this.spirals) s.update(dt);
    this.ringStave.update(dt);
    this.notes.update(dt);
    this.rings.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.finish();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;

    // --- 0..0.4: the ring of staves marks the zone, over a dark layer. ---
    if (!f.ring) {
      f.ring = true;
      this.shade.visible = true;
      this.shade.position.set(this.point.x, 0.03, this.point.z);
      this.shade.scale.setScalar(RADIUS + 0.3);
    }
    if (this.ringStave.mesh.visible || t < DISSOLVE_END + 0.6) {
      for (let i = 0; i <= RING_PTS; i++) {
        const a = (i / RING_PTS) * Math.PI * 2 + t * 0.25;
        this.ringPath[i].set(this.point.x + Math.cos(a) * RADIUS, 0.16, this.point.z + Math.sin(a) * RADIUS);
      }
      const rTail = smoothstep((t - 2.8) / 0.8);
      this.ringStave.setPath(this.ringPath, 0.1, easeOut(t / MARK_END), rTail);
      this.ringStave.wave(0.04);
    }

    // --- 0.3: the lyre rises behind the point. ---
    if (!f.lyre && t >= RISE_T) {
      f.lyre = true;
      this.lyre.show(this.v1.set(this.lyrePos.x, LYRE_Y0, this.lyrePos.z), LYRE_SCALE, this.yaw);
    }
    if (f.lyre && t < DISSOLVE_T) {
      this.lyre.place(this.v1.set(this.lyrePos.x, this.lyreY(t), this.lyrePos.z), LYRE_SCALE, this.yaw);
      if (t < FREEZE_T) this.lyre.shimmer(18 + 55 * smoothstep((t - RISE_T) / (FREEZE_T - RISE_T)));
      else this.lyre.shimmer(0);
      // The strings draw back from 1.6 and hold through the dead beat.
      if (t >= FREEZE_T && t < CHORD_T) this.lyre.pull(easeOut((t - FREEZE_T) / (BEAT_T - FREEZE_T)));
    }
    this.center.set(this.lyrePos.x, this.lyreY(t) + LYRE_SCALE * 0.52, this.lyrePos.z);

    // --- 0.3..1.1: three staves spiral up from the zone edge into the lyre. 0.45..1.6: they carry hundreds of notes. ---
    if (t >= RISE_T && t < 3.4) {
      const head = easeOut((t - RISE_T) / 0.8);
      const tail = smoothstep((t - 2.3) / 0.9);
      if (t < FREEZE_T) {
        for (let k = 0; k < SPIRALS; k++) {
          for (let i = 0; i < SPIRAL_PTS; i++) this.spiralAt(k, i / (SPIRAL_PTS - 1), this.path[i]);
          this.spirals[k].setPath(this.path, 0.09, head, tail);
          this.spirals[k].wave(0.1);
        }
      } else for (const s of this.spirals) s.setRange(head, tail);
    }
    if (t >= 0.45 && t < FREEZE_T) {
      this.noteT += dt;
      while (this.noteT >= 1 / NOTE_RATE) {
        this.noteT -= 1 / NOTE_RATE;
        const st = this.spirals[Math.floor(Math.random() * SPIRALS)];
        const u = Math.random() * 0.08;
        if (u > st.head * 0.6) continue;
        this.notes.ride(st, u, -1, { size: 0.78, du: 0.5 + Math.random() * 0.15, lift: 0.25 });
      }
    }
    for (const s of this.spirals) s.alpha = 1 - smoothstep((t - 3.1) / 0.6);

    // --- 1.85..2.0: the dead beat holds. 2.0: the strings snap forward and a wall of rings races down onto the point. ---
    if (!f.snapped && t >= CHORD_T) {
      f.snapped = true;
      this.lyre.pull(0);
      this.lyre.strum(1.8);
      this.shake = Math.max(this.shake, 0.15);
    }
    while (this.chord < 5 && t >= CHORD_T + this.chord * 0.03) {
      this.rings.pulse(
        this.v1.set(this.point.x, 7.2, this.point.z), RADIUS, 0.2, this.up,
        { r0: RADIUS, to: this.v2.set(this.point.x, 0.2, this.point.z), width: 0.32, tone: this.chord % 2 ? 'gold' : 'rose' },
      );
      this.chord++;
    }

    // --- 2.2: the chord lands. ---
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.hit();
    }
    while (f.hit && this.burst < 4 && t >= HIT_T + this.burst * 0.06) {
      this.rings.pulse(this.v1.set(this.point.x, 0.14, this.point.z), RADIUS, 0.55, this.up, { r0: 0.6, width: 0.28, tone: this.burst === 2 ? 'gold' : 'rose' });
      this.burst++;
    }

    // --- 2.6..3.4: the lyre dissolves into notes. ---
    if (t >= DISSOLVE_T && !f.dissolved) {
      const k = (t - DISSOLVE_T) / (DISSOLVE_END - DISSOLVE_T);
      if (k >= 1) {
        f.dissolved = true;
        this.lyre.hide();
      } else {
        this.lyre.place(this.v1.set(this.lyrePos.x, LYRE_Y, this.lyrePos.z), Math.max(LYRE_SCALE * (1 - easeIn(k)), 0.01), this.yaw);
        this.dissolveT += dt;
        while (this.dissolveT >= 0.025) {
          this.dissolveT -= 0.025;
          const h = Math.random() * LYRE_SCALE * (1 - k) * 1.05;
          this.v2.set((Math.random() - 0.5) * 0.7 * LYRE_SCALE * (1 - k), LYRE_Y + h, 0);
          this.v1.set(this.lyrePos.x + this.v2.x * Math.cos(this.yaw), this.v2.y, this.lyrePos.z - this.v2.x * Math.sin(this.yaw));
          this.notes.emit(this.v1, this.v3.set(0, 0.5, 0), 1, 0.8, { size: 0.7, spread: 1.6, gravity: 2, gold: Math.random() < 0.5 });
        }
      }
    }

    this.layout(dt);
  }

  private hit() {
    const ctx = this.ctx, P = this.point;
    // Every note scatters outward.
    this.notes.scatter(this.v1.set(P.x, 1, P.z), 9, 1.8, 2.5);
    this.shake = Math.max(this.shake, 0.75);
    // Re-check where everyone stands now: enemies who walked out are spared.
    if (ctx) for (const e of ctx.targets) {
      if (this.inside(e)) {
        ctx.hit(e, { damage: this.settings.damage, knock: 4, from: P, color: BARD_CSS.body, status: { kind: 'stun', seconds: this.settings.stunSeconds } });
      }
    }
  }

  private finish() {
    this.playing = false;
    this.shake = 0;
    const ctx = this.ctx;
    if (ctx) for (const v of this.victims) ctx.displace(v.enemy, this.v3.set(0, 0, 0));
    this.reset();
  }

  private layout(dt: number) {
    const t = this.time;
    const ctx = this.ctx;
    const after = t - HIT_T;
    const f = this.flags;

    // --- Screen: plum-black dark, a lift at the chord, lifting away as the lyre dissolves. Impact frames at the hit. ---
    let dk = 0.55 * smoothstep(t / MARK_END) * (1 - smoothstep((t - DISSOLVE_END) / 0.8));
    if (after >= 0) dk *= 1 - 0.3 * Math.exp(-after * 10);
    this.screen.darken = dk;
    this.screen.impact = impactFrameAt(t, HIT_T, [1, 2], 0.04);

    // --- The dark layer under the stave ring follows the darkness. ---
    this.shadeMat.opacity = 0.4 * smoothstep(t / MARK_END) * (1 - smoothstep((t - DISSOLVE_END) / 0.8));

    // --- The pull on the enemies: in while the lyre plays, released at the chord. ---
    if (ctx) {
      const pull = 0.4 * smoothstep((t - RISE_T) / (HIT_T - RISE_T)) * (1 - smoothstep(after / 0.3));
      for (const v of this.victims) {
        this.v3.set(this.point.x - v.feet.x, 0, this.point.z - v.feet.z).multiplyScalar(pull);
        ctx.displace(v.enemy, this.v3);
      }
    }

    // --- The chord: gold star at the centre, ground refraction, shake. ---
    if (f.hit) {
      const sp = StarBurst.pop(after, 0, 0.05);
      this.pop.set(this.v1.copy(this.point).setY(1.5), 2 * sp.scale, sp.opacity, 0.2);
      const gp = THREE.MathUtils.clamp(after / 0.5, 0, 1);
      this.groundShock.set(this.point, 1 + 11 * gp, 0.07 * (1 - gp) * (1 - gp));
      this.shake = Math.max(this.shake * Math.exp(-dt * 9), 0.75 * Math.exp(-after * 9));
    } else this.shake *= Math.exp(-dt * 12);
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeIn = (x: number) => Math.pow(Math.min(1, Math.max(0, x)), 2);

export const crescendoModule: EffectModule = {
  label: 'crescendo',
  category: 'hero: bard',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new Crescendo(),
  telegraphs(effect) {
    const e = effect as Crescendo;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.from.x, z: ctx.from.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Crescendo;
    if (e.ctx) frameCast(camera, controls, e.ctx, 10);
  },
  buildGui(f, effect) {
    const s = (effect as Crescendo).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 300, 1);
    f.add(s, 'stunSeconds', 0, 1.2, 0.1);
  },
};
