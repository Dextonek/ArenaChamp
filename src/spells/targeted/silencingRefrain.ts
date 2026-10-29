import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { BARD_CSS, GLYPH, Lyre, Notes, SoundRings, Stave } from '../../effects/parts/bard';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Silencing Refrain (bard kit, W: a silence zone). A stave ribbon spirals in from his lyre and coils around the zone
 * edge (radius 4); notes ride the coil inward while it tightens. At 0.75 the hush: every note freezes, one huge rest
 * glyph appears over the centre, a dark sound ring snaps inward and every enemy inside takes a hit and is silenced.
 * Then the notes fall and fade and the stave unwinds. Clean by 2.2 s. See pipeline/designs/kit-bard.md.
 */
export interface SilencingRefrainSettings {
  damage: number;
  silenceSeconds: number;
  loop: boolean;
}

export const defaultSilencingRefrain = (): SilencingRefrainSettings => ({ damage: 40, silenceSeconds: 1.5, loop: false });

// Timeline (seconds).
const COIL_END = 0.3; // the stave has spiralled in and coiled
const TIGHT_END = 0.7; // the coil is at its tightest
const HIT_T = 0.75;
const FALL_T = 1.0;
const UNWIND_END = 1.9;
const DURATION = 2.2;

const RADIUS = 4;
const TURNS = 1.35;
const LEAD = 10; // points of the lead-in from the lyre
const COIL = 40; // points of the coil
const REST_Y = 3.0;
const REST_SIZE = 3.4;

export class SilencingRefrain implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SilencingRefrainSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private point = new THREE.Vector3(0, 0, -8);
  private lyrePos = new THREE.Vector3();
  private angle0 = 0;
  private flags = { lyre: false, hit: false, fall: false };
  private noteT = 0;
  private restIdx = -1;

  private lyre = new Lyre();
  private stave = new Stave(56);
  private notes = new Notes(90);
  private rings = new SoundRings(4);
  private path: THREE.Vector3[] = [];

  private v1 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: SilencingRefrainSettings = defaultSilencingRefrain()) {
    this.settings = settings;
    for (let i = 0; i < LEAD + COIL; i++) this.path.push(new THREE.Vector3());
    this.group.add(this.stave.mesh, this.lyre.mesh, this.notes.mesh, this.rings.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT_T;
  }

  /** True while `e` stands inside the zone right now (enemies who walked out before the hush are spared). */
  private inside(e: CastContext['targets'][number]) {
    const p = e.group.position;
    return Math.hypot(p.x - this.point.x, p.z - this.point.z) <= RADIUS;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.angle0 = Math.atan2(ctx.from.z - this.point.z, ctx.from.x - this.point.x);
    const d = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.lyrePos.set(ctx.from.x + d.x * 0.35 - d.z * 0.45, 0.55, ctx.from.z + d.z * 0.35 + d.x * 0.45);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.noteT = 0;
    this.restIdx = -1;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.lyre.reset();
    this.stave.reset();
    this.notes.reset();
    this.rings.reset();
  }

  /** The coil's centre line at fraction `s` (0 = where the lead-in joins, 1 = the inner end). */
  private coilAt(s: number, rad: number, out: THREE.Vector3) {
    const a = this.angle0 - s * TURNS * Math.PI * 2;
    const r = rad * (1 - 0.38 * s);
    return out.set(this.point.x + Math.cos(a) * r, 0.5 + 0.9 * s, this.point.z + Math.sin(a) * r);
  }

  private buildPath(rad: number) {
    const start = this.coilAt(0, rad, this.v1);
    const from = this.lyrePos;
    for (let i = 0; i < LEAD; i++) {
      const u = i / LEAD;
      this.path[i].lerpVectors(from, start, easeOut(u));
      this.path[i].y += Math.sin(u * Math.PI) * 1.4;
    }
    for (let i = 0; i < COIL; i++) this.coilAt(i / (COIL - 1), rad, this.path[LEAD + i]);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.lyre.update(dt);
    this.stave.update(dt);
    this.notes.update(dt);
    this.rings.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      this.playing = false;
      this.reset();
      if (this.settings.loop) this.play();
      return;
    }
    const t = this.time, f = this.flags;

    if (!f.lyre) {
      f.lyre = true;
      this.lyre.show(this.lyrePos, 0.95);
      this.lyre.strum(1);
    }

    // --- The stave: spirals in from the lyre (0..0.3), coils round the edge, tightens, then unwinds after the hush. ---
    const rad = RADIUS * (1 - 0.4 * smoothstep((t - COIL_END) / (TIGHT_END - COIL_END)));
    this.buildPath(rad);
    const head = easeOut(t / COIL_END);
    const tail = t >= FALL_T ? smoothstep((t - FALL_T) / (UNWIND_END - FALL_T)) : 0;
    this.stave.setPath(this.path, 0.075, head, tail);
    this.stave.wave(t < HIT_T ? 0.1 : 0);
    this.stave.alpha = 1 - smoothstep((t - 1.6) / 0.3);

    // --- Notes ride the coil inward until the hush. ---
    if (t > 0.08 && t < HIT_T) {
      this.noteT += dt;
      while (this.noteT >= 0.022) {
        this.noteT -= 0.022;
        const u = LEAD / (LEAD + COIL) + Math.random() * 0.45 * Math.min(1, t / COIL_END);
        if (u > this.stave.head) continue;
        this.notes.ride(this.stave, u, -1, { size: 0.62, du: 0.38, lift: 0.22 });
      }
    }

    // --- 0.75: the hush. Everything freezes, the huge rest appears, a dark ring snaps in, the hit lands. ---
    if (!f.hit && t >= HIT_T) {
      f.hit = true;
      this.notes.frozen = true;
      this.stave.frozen = true;
      this.restIdx = this.notes.hold(this.v1.set(this.point.x, REST_Y, this.point.z), GLYPH.rest, 0.01);
      this.rings.pulse(this.v1.set(this.point.x, 0.12, this.point.z), RADIUS, 0.28, this.up, { r0: 0.5, inward: true, tone: 'dark', width: 0.3 });
      this.lyre.strum(1.4);
      this.shake = 0.2;
      const ctx = this.ctx;
      // Re-check where everyone stands now: enemies who walked out are spared.
      if (ctx) for (const e of ctx.targets) {
        if (this.inside(e)) {
          ctx.hit(e, { damage: this.settings.damage, knock: 0, from: this.point, color: BARD_CSS.body, status: { kind: 'silence', seconds: this.settings.silenceSeconds } });
        }
      }
    }
    if (this.restIdx >= 0) {
      const after = t - HIT_T;
      const grow = easeOut(after / 0.14);
      const out = smoothstep((t - FALL_T) / 0.35);
      this.notes.resize(this.restIdx, Math.max(REST_SIZE * grow * (1 - out), 0.01));
      if (out >= 1) { this.notes.kill(this.restIdx); this.restIdx = -1; }
    }

    // --- 1.0: the notes fall and fade, the lyre goes. ---
    if (!f.fall && t >= FALL_T) {
      f.fall = true;
      this.notes.frozen = false;
      this.stave.frozen = false;
      this.notes.fall(7, 0.9);
    }
    if (t >= 1.3) this.lyre.hide();

    this.shake *= Math.exp(-dt * 12);
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const silencingRefrainModule: EffectModule = {
  label: 'silencing refrain',
  category: 'hero: bard',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new SilencingRefrain(),
  telegraphs(effect) {
    const e = effect as SilencingRefrain;
    const ctx = e.ctx;
    if (!ctx) return [];
    return [{ shape: { kind: 'circle', x: ctx.point.x, z: ctx.point.z, radius: RADIUS }, start: 0, impact: HIT_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SilencingRefrain;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as SilencingRefrain).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 120, 1);
    f.add(s, 'silenceSeconds', 0, 1.5, 0.1);
  },
};
