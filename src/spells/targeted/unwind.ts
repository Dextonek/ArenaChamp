import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { Afterimage, CHRONO_CSS, Dial, FrozenMotes } from '../../effects/parts/chrono';
import type { TelegraphShape } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { unwindDest } from '../../traits/chrono';

/**
 * Unwind (chrono kit, R: a rewind). The trait (`src/traits/chrono.ts`) has already sent Tempo back to where he stood
 * 2.5 s ago (`moveTo`, 0.25 s) and healed him up to the HP he had then; this effect draws it and makes the hits. A dial
 * opens on the spot he leaves (the old spot, `ctx.from`) with a pale afterimage standing on it; as he slides, an
 * afterimage replays the path backward from the old spot to the new one, where a second dial opens. Both dials' hands
 * run backward. At 0.95 both flash outward to radius 2.5 and every enemy inside either circle (positions re-checked
 * now) takes a small burst, once. Both circles are telegraphed from the cast. The new spot comes from the trait
 * (`unwindDest`); on the other screen of a network duel there is none, so the circle starts on the old spot and moves to
 * where the figure really arrives at 0.3 (the zone check follows it, the drawn ring does not). Clean by 1.8 s.
 */
export interface UnwindSettings {
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultUnwind = (): UnwindSettings => ({ damage: 30, knock: 2, loop: false });

// Timeline (seconds).
const DASH_END = 0.3; // he has arrived; the figure's own spot is read
const BURST_T = 0.95;
const FLASH_LEN = 0.15;
const FADE_T = 1.2;
const DURATION = 1.8;

const RADIUS = 2.5;
const OPEN_R = 1.2;

type Circle = Extract<TelegraphShape, { kind: 'circle' }>;

export class Unwind implements Effect {
  readonly group = new THREE.Group();
  readonly settings: UnwindSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  /** The two burst circles (shared with the telegraphs, so a moved new spot moves the zone check). */
  readonly oldSpot: Circle = { kind: 'circle', x: 0, z: 0, radius: RADIUS };
  readonly newSpot: Circle = { kind: 'circle', x: 0, z: 0, radius: RADIUS };
  private known = false;
  private time = 0;
  private flags = { opened: false, replay: false, open2: false, burst: false, fade: false };

  private dialA = new Dial({ face: 'ring', marks: 'quarter', order: 8 });
  private dialB = new Dial({ face: 'ring', marks: 'quarter', order: 9 });
  private mark = new Afterimage(1);
  private echoes = new Afterimage(3);
  private motes = new FrozenMotes();

  private v1 = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(settings: UnwindSettings = defaultUnwind()) {
    this.settings = settings;
    this.group.add(this.dialA.group, this.dialB.group, this.mark.group, this.echoes.group, this.motes.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return BURST_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.oldSpot.x = ctx.from.x;
    this.oldSpot.z = ctx.from.z;
    const dest = unwindDest.get(ctx.caster);
    unwindDest.delete(ctx.caster);
    this.known = !!dest;
    this.newSpot.x = dest ? dest.x : ctx.from.x;
    this.newSpot.z = dest ? dest.z : ctx.from.z;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const k of Object.keys(this.flags) as (keyof typeof this.flags)[]) this.flags[k] = false;
    this.dialA.reset();
    this.dialB.reset();
    this.mark.reset();
    this.echoes.reset();
    this.motes.reset();
  }

  /** The afterimages run the path he walked, backward: from the old spot to the new one. */
  private replay() {
    this.flags.replay = true;
    const a = new THREE.Vector3(this.oldSpot.x, 0, this.oldSpot.z), b = new THREE.Vector3(this.newSpot.x, 0, this.newSpot.z);
    this.echoes.replay([b, a], 0.3, 0.07);
  }

  private openNew() {
    this.flags.open2 = true;
    this.dialB.show(this.v1.set(this.newSpot.x, 0.06, this.newSpot.z), OPEN_R, this.up, 0.1);
    this.dialB.tick(-8);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.motes.drift(this.v1.set(this.newSpot.x + Math.cos(a) * 0.8, 0, this.newSpot.z + Math.sin(a) * 0.8), 0.4, 1);
    }
    this.motes.release(0.9);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.dialA.update(dt);
    this.dialB.update(dt);
    this.mark.update(dt);
    this.echoes.update(dt);
    this.motes.update(dt);
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
    const f = this.flags;

    // --- 0: a dial opens on the old spot, an afterimage of him stays standing on it. ---
    if (!f.opened) {
      f.opened = true;
      this.dialA.show(this.v1.set(this.oldSpot.x, 0.06, this.oldSpot.z), OPEN_R, this.up, 0.1);
      this.dialA.tick(-8);
      this.v1.set(this.oldSpot.x, 0, this.oldSpot.z);
      this.mark.stand(0, this.v1, ctx?.aim ?? 0, 0.36);
    }
    // --- The trait sent him already: the replay and the new dial start with the dash. ---
    if (this.known && !f.replay) {
      this.replay();
      this.openNew();
    }
    // --- He has arrived: the figure's own spot is the truth (the only source on the other screen). ---
    if (t >= DASH_END && !f.open2) {
      const p = ctx?.caster.group.position;
      if (p) {
        this.newSpot.x = p.x;
        this.newSpot.z = p.z;
      }
      this.replay();
      this.openNew();
    }

    // --- 0.95: both dials flash out to radius 2.5 and hit everyone inside. ---
    if (!f.burst && t >= BURST_T) {
      f.burst = true;
      this.dialA.flash(1);
      this.dialB.flash(1);
      this.mark.fade(0.2);
      this.shake = 0.22;
      for (const s of [this.oldSpot, this.newSpot]) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.motes.drift(this.v1.set(s.x + Math.cos(a) * 1.4, 0, s.z + Math.sin(a) * 1.4), 0.4, 1);
        }
      }
      this.motes.release(0.9);
      if (ctx) {
        for (const e of ctx.targets) {
          const p = e.group.position;
          const inA = Math.hypot(p.x - this.oldSpot.x, p.z - this.oldSpot.z) <= RADIUS;
          const inB = Math.hypot(p.x - this.newSpot.x, p.z - this.newSpot.z) <= RADIUS;
          if (!inA && !inB) continue;
          const src = inA ? this.oldSpot : this.newSpot;
          ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: new THREE.Vector3(src.x, 0, src.z), color: CHRONO_CSS.body });
        }
      }
    }
    if (f.burst) {
      const r = OPEN_R + (RADIUS - OPEN_R) * easeOut((t - BURST_T) / FLASH_LEN);
      this.dialA.place(this.v1.set(this.oldSpot.x, 0.06, this.oldSpot.z), r);
      this.dialB.place(this.v1.set(this.newSpot.x, 0.06, this.newSpot.z), r);
    }

    if (!f.fade && t >= FADE_T) {
      f.fade = true;
      this.dialA.hide(0.4);
      this.dialB.hide(0.4);
    }
    this.shake *= Math.exp(-dt * 12);
  }
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const unwindModule: EffectModule = {
  label: 'unwind',
  category: 'hero: chrono',
  // Self cast; the radius is wide so ctx.targets holds an enemy near the new spot too (the effect re-checks both circles).
  targeting: { mode: 'self', radius: 14 },
  create: () => new Unwind(),
  telegraphs(effect) {
    const e = effect as Unwind;
    if (!e.ctx) return [];
    // Both circles from the cast; the burst lands at BURST_T (well inside the duel's 4.2 s).
    return [
      { shape: e.oldSpot, start: 0.1, impact: BURST_T },
      { shape: e.newSpot, start: 0.1, impact: BURST_T },
    ];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.3, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as Unwind;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as Unwind).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 100, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
