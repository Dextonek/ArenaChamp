import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { BARD, BARD_CSS, GLYPH, Lyre, Notes, SoundRings, Stave } from '../../effects/parts/bard';
import type { Projectile } from '../../effects/projectile';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Discordant Note (bard kit, Q: a skillshot that bounces). Cantor strums his golden lyre; a big dark note glyph forms in
 * front of him with two sound rings, and at 0.2 it flies along the aim line (`ctx.projectile`, bounce 1) trailing a short
 * five-line stave ribbon. Each hit bursts into small notes and a sound ring with a two-frame gold star, and the note
 * bounces on to the nearest other enemy. The visual follows the projectile handle. Clean by about 1.5 s.
 * See pipeline/designs/kit-bard.md.
 */
export interface DiscordantNoteSettings {
  damage: number;
  knock: number;
}

export const defaultDiscordantNote = (): DiscordantNoteSettings => ({ damage: 47, knock: 2 });

const WINDUP = 0.2;
const SPEED = 20;
const RANGE = 12;
const RADIUS = 0.45;
/** The firing point is this far in front of the caster's feet. */
const MUZZLE = 0.8;
const SETTLE = 0.45;
const TRAIL_LEN = 2.6;
const BIG = 1.0; // glyph cell size of the flying note (the drawn note is about 0.85 of it)

export class DiscordantNote implements Effect {
  readonly group = new THREE.Group();
  readonly settings: DiscordantNoteSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The bolt's line, caster to max range, for the telegraph. */
  line: TelegraphShape = { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 0, width: RADIUS * 2 };
  private time = 0;
  private fired = false;
  private goneAt = -1;
  private bolt: Projectile | null = null;
  private big = -1;
  private flags = { lyre: false, strum2: false, ring1: false, ring2: false };
  private emitT = 0;
  private starAge = 9;
  private fadeFrom = -1;

  private dir = new THREE.Vector3(0, 0, 1);
  private muzzle = new THREE.Vector3();
  private lyrePos = new THREE.Vector3();
  private trail: THREE.Vector3[] = [];
  private starPos = new THREE.Vector3();

  private lyre = new Lyre();
  private notes = new Notes(48);
  private stave = new Stave(36);
  private rings = new SoundRings(6);
  private star = new StarBurst({ points: 8, inner: 0.3, color: BARD.accent, core: 0xfff6d0, additive: false });

  private rise = new THREE.Vector3(0, 0.8, 0);
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: DiscordantNoteSettings = defaultDiscordantNote()) {
    this.settings = settings;
    this.group.add(this.stave.mesh, this.lyre.mesh, this.notes.mesh, this.rings.mesh, this.star.mesh);
    this.reset();
  }

  get duration() {
    return 1.5;
  }

  /** Seconds until the note has flown its full range (the telegraph's last moment). */
  get flightEnd() {
    return WINDUP + RANGE / SPEED;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.dir.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.line = {
      kind: 'line', x1: ctx.from.x, z1: ctx.from.z, x2: ctx.from.x + this.dir.x * RANGE, z2: ctx.from.z + this.dir.z * RANGE,
      width: RADIUS * 2,
    };
    this.muzzle.set(ctx.from.x + this.dir.x * MUZZLE, 1.15, ctx.from.z + this.dir.z * MUZZLE);
    // The lyre is held out low on his left, in front of the chest.
    this.lyrePos.set(ctx.from.x + this.dir.x * 0.35 - this.dir.z * 0.45, 0.55, ctx.from.z + this.dir.z * 0.35 + this.dir.x * 0.45);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.goneAt = -1;
    this.bolt = null;
    this.big = -1;
    this.emitT = 0;
    this.starAge = 9;
    this.fadeFrom = -1;
    this.trail.length = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.lyre.reset();
    this.notes.reset();
    this.stave.reset();
    this.rings.reset();
    this.star.set(this.starPos, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.lyre.update(dt);
    this.notes.update(dt);
    this.stave.update(dt);
    this.rings.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings, f = this.flags;

    // --- Windup: he strums, the big note forms with two sound rings. ---
    if (!f.lyre) {
      f.lyre = true;
      this.lyre.show(this.lyrePos, 0.95);
      this.lyre.strum(1);
    }
    if (!f.strum2 && t >= 0.13) { f.strum2 = true; this.lyre.strum(1.2); }
    if (!f.ring1 && t >= 0.03) {
      f.ring1 = true;
      this.rings.pulse(this.muzzle, 1.1, 0.3, this.dir, { r0: 0.2, width: 0.13 });
      this.big = this.notes.hold(this.muzzle, GLYPH.quarter, MIN(0.01), false);
    }
    if (!f.ring2 && t >= 0.11) {
      f.ring2 = true;
      this.rings.pulse(this.muzzle, 1.5, 0.3, this.dir, { r0: 0.2, width: 0.13 });
    }
    if (this.big >= 0 && !this.bolt) this.notes.resize(this.big, BIG * easeOut((t - 0.03) / 0.17));

    // --- Fire. A network duel has no bolts (the context leaves `projectile` out): the spell then shows only the windup. ---
    if (!this.fired && t >= WINDUP) {
      this.fired = true;
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.muzzle.clone(), dir: this.dir.clone(), speed: SPEED, range: RANGE, radius: RADIUS, bounce: 1,
          hit: { damage: s.damage, knock: s.knock, color: BARD_CSS.body },
        });
        this.bolt.onHit((_target, at) => this.onHit(at));
        this.shake = 0.05;
        this.trail.push(this.muzzle.clone());
      } else this.goneAt = t;
    }

    // --- The note follows the handle; a short stave trails behind it. ---
    const b = this.bolt;
    if (b) {
      if (b.alive) {
        this.v1.copy(b.pos).setY(1.15);
        this.notes.move(this.big, this.v1);
        this.notes.resize(this.big, BIG);
        this.followTrail(this.v1);
        this.emitT += dt;
        while (this.emitT >= 0.09) {
          this.emitT -= 0.09;
          this.v2.copy(this.v1).addScaledVector(b.dir, -0.9 - Math.random() * 0.8);
          this.v2.y += (Math.random() - 0.3) * 0.5;
          this.notes.emit(this.v2, this.rise, 1, 0.5, { size: 0.5, spread: 0.6, gravity: 1.5 });
        }
      } else if (this.goneAt < 0) {
        this.goneAt = t;
        this.fadeFrom = t;
        if (this.big >= 0) { this.notes.kill(this.big); this.big = -1; }
      }
    }
    // The stave trail thins away once the note is gone.
    if (this.fadeFrom >= 0) {
      const k = Math.min(1, (t - this.fadeFrom) / 0.3);
      this.stave.setRange(1, k);
      if (k >= 1) this.stave.reset();
    }

    // --- The hit accent: a small gold star for two frames. ---
    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0, 0.03);
    this.star.set(this.starPos, 0.9 * sp.scale, sp.opacity, this.starAge * 4);
    this.shake *= Math.exp(-dt * 12);

    if (this.goneAt >= 0 && t >= this.goneAt + SETTLE && !this.notes.busy && !this.rings.busy) {
      this.playing = false;
      this.reset();
    } else if (t >= 3) {
      this.playing = false;
      this.reset();
    }
  }

  /** Keeps the last `TRAIL_LEN` metres of the note's path as the stave ribbon. */
  private followTrail(head: THREE.Vector3) {
    const tr = this.trail;
    const last = tr[tr.length - 1];
    if (!last || last.distanceToSquared(head) > 0.04) tr.push(head.clone());
    else last.copy(head);
    let len = 0;
    for (let i = tr.length - 1; i > 0; i--) {
      len += tr[i].distanceTo(tr[i - 1]);
      if (len > TRAIL_LEN) { tr.splice(0, i - 1); break; }
    }
    if (tr.length >= 2) {
      this.stave.setPath(tr, 0.06, 1, 0);
      this.stave.wave(0.07);
    }
  }

  /** A hit: small notes burst out, a sound ring, a two-frame gold star. */
  private onHit(at: THREE.Vector3) {
    this.starPos.set(at.x, 1.15, at.z);
    this.starAge = 0;
    this.shake = 0.12;
    this.notes.emit(this.starPos, this.v2.set(0, 2.2, 0), 7, 0.9, { size: 0.55, spread: 3.2, gravity: 5 });
    this.rings.pulse(this.starPos, 1.9, 0.35, this.v1.set(0, 0.3, 1), { r0: 0.3, width: 0.14 });
  }
}

const MIN = (x: number) => Math.max(x, 1e-3);
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const discordantNoteModule: EffectModule = {
  label: 'discordant note',
  category: 'hero: bard',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new DiscordantNote(),
  telegraphs(effect) {
    const e = effect as DiscordantNote;
    if (!e.ctx) return [];
    // Armed at the launch, then shown until the note has passed; a bolt's hit is the dodge check, not the zone.
    return [{ shape: e.line, start: 0, impact: WINDUP, until: e.flightEnd }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as DiscordantNote;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as DiscordantNote).settings;
    f.add(s, 'damage', 0, 100, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
