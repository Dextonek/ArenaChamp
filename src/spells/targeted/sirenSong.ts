import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep, type Enemy } from '../../effects/common';
import { StarBurst } from '../../effects/parts';
import { BARD, BARD_CSS, GLYPH, Notes, SoundRings, Stave } from '../../effects/parts/bard';
import { stillSees } from '../../effects/channel';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { cantorTuned } from '../../traits/bard';

/**
 * Siren Song (bard kit v5, W: a charming note). Click an enemy within 8 m (the engine checks sight at the cast). A big note
 * leaves his hands and flies at 10 m/s (`SPEED`) at the enemy's LIVE position, drawn here and not a `ctx.projectile`, so it
 * cannot be sidestepped: a stave streams behind it and small notes drop off it. Each frame it asks `stillSees` (him to the
 * enemy): if cover comes between, the note breaks on it (a fizz: it scatters, a ring, nothing hits). It also gives up after
 * 2 s. On arrival the enemy takes a hit of 0 damage with `projectile: true` and a charm (`CHARM_S` 0.8 s, `CHARM_TUNED_S` 1.1 s
 * when his last cast was in tune: `cantorTuned`). The engine's `charm` walks them to him and stops them acting; a gold clef
 * floats over their head for as long as it lasts. Cooldown 12 s, `cc`. The effect draws no telegraph: the note is the warning.
 * Network duels: both screens fly the note and check cover on the live positions; only the victim's screen's hit counts.
 */
export interface SirenSongSettings {
  /** Metres per second the note flies. */
  speed: number;
  loop: boolean;
}

export const defaultSirenSong = (): SirenSongSettings => ({ speed: 10, loop: false });

// Timeline (seconds).
const DURATION = 3.8;
const GIVE_UP = 2; // a note that has not arrived by now fizzles
const ARRIVE = 0.45; // close enough to land
const CHARM_S = 0.8;
const CHARM_TUNED_S = 1.1;
const CHEST = 1.2;
const TRAIL = 6;
const TRAIL_LEN = 2.2;

export class SirenSong implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SirenSongSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private target: Enemy | null = null;
  private time = 0;
  private tuned = false;
  /** 0 = flying, 1 = landed, 2 = broken on cover or given up. */
  private state = 0;
  private endAt = -1;
  private charmUntil = 0;
  private noteId = -1;
  private clefId = -1;
  private drip = 0;
  private note = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, 1);
  private foe = new THREE.Vector3();

  // Parts.
  private notes = new Notes(40);
  private trail = new Stave(32);
  private rings = new SoundRings(4);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: BARD.accent, core: BARD.core, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private path = Array.from({ length: TRAIL }, () => new THREE.Vector3());

  constructor(settings: SirenSongSettings = defaultSirenSong()) {
    this.settings = settings;
    this.group.add(this.trail.mesh, this.notes.mesh, this.rings.mesh, this.pop.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return 0.8;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.target = ctx.targets[0] ?? null;
    this.tuned = !!cantorTuned.get(ctx.caster);
    this.liveFoe();
  }

  play() {
    this.reset();
    this.playing = true;
    this.liveFoe();
    const ctx = this.ctx;
    if (!ctx) return;
    this.note.set(ctx.caster.group.position.x, CHEST + 0.1, ctx.caster.group.position.z);
    this.dir.set(this.foe.x - this.note.x, 0, this.foe.z - this.note.z).normalize();
    this.noteId = this.notes.hold(this.note, GLYPH.eighth, 1.1, this.tuned);
  }

  private reset() {
    if (this.noteId >= 0) this.notes.kill(this.noteId);
    if (this.clefId >= 0) this.notes.kill(this.clefId);
    this.noteId = this.clefId = -1;
    this.time = 0;
    this.shake = 0;
    this.state = 0;
    this.endAt = -1;
    this.charmUntil = 0;
    this.drip = 0;
    this.trail.reset();
    this.notes.reset();
    this.rings.reset();
    this.pop.set(this.foe, 0, 0);
  }

  private liveFoe() {
    if (this.target) this.foe.copy(this.target.group.position).setY(0);
    else if (this.ctx) this.foe.copy(this.ctx.point).setY(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
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
    this.liveFoe();
    if (ctx && this.state === 0) this.fly(ctx, dt);
    if (this.state === 1 && this.clefId >= 0) {
      // The clef rides over the charmed head and goes when the charm does.
      if (t >= this.charmUntil) {
        this.notes.kill(this.clefId);
        this.clefId = -1;
      } else {
        this.notes.move(this.clefId, this.v1.set(this.foe.x, 2.55 + 0.08 * Math.sin(t * 6), this.foe.z));
      }
    }
    this.layout(t);
    this.trail.update(dt);
    this.notes.update(dt);
    this.rings.update(dt);
    this.shake *= Math.exp(-dt * 12);
  }

  /** One frame of flight: home on the live position, break on cover, land on arrival. */
  private fly(ctx: CastContext, dt: number) {
    this.v1.set(this.foe.x, CHEST, this.foe.z);
    if (!this.target || !stillSees(ctx, this.foe) || this.time > GIVE_UP) {
      this.fizzle();
      return;
    }
    const d = this.note.distanceTo(this.v1);
    if (d <= ARRIVE) {
      this.land(ctx);
      return;
    }
    this.dir.subVectors(this.v1, this.note).normalize();
    this.note.addScaledVector(this.dir, Math.min(d, this.settings.speed * dt));
    this.notes.move(this.noteId, this.note);
    this.drip -= dt;
    if (this.drip <= 0) {
      this.drip = 0.07;
      this.notes.emit(this.note, this.v2.set(0, 0.5, 0), 1, 0.5, { size: 0.32, gold: this.tuned, spread: 0.5, gravity: 0.6 });
    }
  }

  /** The note reaches them: the charm lands. */
  private land(ctx: CastContext) {
    this.state = 1;
    this.endAt = this.time;
    const secs = this.tuned ? CHARM_TUNED_S : CHARM_S;
    this.charmUntil = this.time + secs;
    this.notes.kill(this.noteId);
    this.noteId = -1;
    ctx.hit(this.target!, {
      damage: 0, knock: 0, from: ctx.from, color: BARD_CSS.body, projectile: true, status: { kind: 'charm', seconds: secs },
    });
    this.rings.pulse(this.v1.copy(this.foe).setY(0.1), 1.8, 0.5, undefined, { r0: 0.4, width: 0.2, tone: this.tuned ? 'gold' : 'rose' });
    this.notes.emit(this.v1.set(this.foe.x, CHEST, this.foe.z), this.v2.set(0, 2.4, 0), 7, 0.9, { size: 0.5, gold: this.tuned, spread: 2 });
    this.clefId = this.notes.hold(this.v1.set(this.foe.x, 2.5, this.foe.z), GLYPH.clef, 0.95, true);
    this.shake = 0.12;
  }

  /** Cover or distance breaks the note: it scatters and nothing happens. */
  private fizzle() {
    this.state = 2;
    this.endAt = this.time;
    this.notes.kill(this.noteId);
    this.noteId = -1;
    this.notes.emit(this.note, this.v2.set(0, 1, 0), 6, 0.8, { size: 0.45, spread: 2.2, gravity: 5 });
    this.rings.pulse(this.v1.copy(this.note).setY(0.1), 1.0, 0.35, undefined, { r0: 0.3, width: 0.14, tone: 'dark' });
  }

  private layout(t: number) {
    // The stave streaming behind the note: it trails while flying, and drains away after.
    if (this.state === 0 || this.endAt >= 0) {
      const after = this.endAt >= 0 ? t - this.endAt : 0;
      const back = this.v2.copy(this.dir).multiplyScalar(-TRAIL_LEN);
      for (let k = 0; k < TRAIL; k++) {
        const u = k / (TRAIL - 1);
        this.path[k].copy(this.note).addScaledVector(back, 1 - u).setY(this.note.y);
        this.path[k].y += 0.15 * Math.sin(u * 5 + t * 8);
      }
      this.trail.setPath(this.path, 0.1, 1, 0);
      this.trail.wave(0.1);
      this.trail.alpha = this.endAt >= 0 ? 1 - smoothstep(after / 0.3) : smoothstep(t / 0.15);
    }
    if (this.state === 1) {
      const sp = StarBurst.pop(t - this.endAt, 0, 0.03);
      this.pop.set(this.v1.set(this.foe.x, CHEST, this.foe.z), 1.0 * sp.scale, sp.opacity, 0.2);
    }
  }
}

export const sirenSongModule: EffectModule = {
  label: 'siren song',
  category: 'hero: bard',
  // Click an enemy. The note homes on the live position and the hit is `projectile`, so only cover stops it.
  targeting: { mode: 'enemy' },
  create: () => new SirenSong(),
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as SirenSong;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as SirenSong).settings;
    f.add(s, 'loop');
    f.add(s, 'speed', 4, 20, 0.5);
  },
};
