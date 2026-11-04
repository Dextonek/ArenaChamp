import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { StarBurst } from '../../effects/parts';
import { Coins, LEDGER, PaperBits, Tome } from '../../effects/parts/ledger';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { CALL_DELAY } from '../../traits/ledger';

/**
 * Call It In (ledger kit, E: no target, no hit of its own). The ledger swings open in the air in front of Mr. Ledger (0.18 s), a
 * pencil scratches a line of figures down the right page (0.12 - 0.42 s, the page really fills in), and the book is slammed shut
 * at 0.46 s with a thump and a spray of paper. At 0.5 s (`CALL_DELAY`) a stream of invoices and gold coins leaves it for the
 * enemy hero and bursts over them: that is the moment the tab comes due, without the interest. The damage is the trait's
 * (`victimTick` in `src/traits/ledger.ts`, from `show('call')`, on the screen that holds the tab); this effect is the
 * look, and so it needs no telegraph and does not root him. The book shrinks away; clean by about 1.5 s. See
 * pipeline/designs/kit-ledger.md.
 */
export interface CallItInSettings {
  loop: boolean;
}

export const defaultCallItIn = (): CallItInSettings => ({ loop: false });

// Timeline (seconds).
const OPEN_T = 0.18;
const WRITE_FROM = 0.12;
const WRITE_TO = 0.42;
const SLAM_T = 0.46;
const SEND_T = CALL_DELAY;
const GONE_T = 1.0;
const DURATION = 1.7;

const FRONT = 1.3;

export class CallItIn implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CallItInSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { slam: false, send: false };
  private spot = new THREE.Vector3();
  private foe = new THREE.Vector3();
  private aim = 0;

  private tome = new Tome();
  private lectern = new THREE.Group();
  private bits = new PaperBits(80);
  private coins = new Coins(20);
  private pop = new StarBurst({ points: 10, inner: 0.3, color: LEDGER.gold, core: LEDGER.core, additive: false });
  private foePop = new StarBurst({ points: 12, inner: 0.3, color: LEDGER.hotRed, core: LEDGER.core, additive: false });
  private v1 = new THREE.Vector3();

  constructor(settings: CallItInSettings = defaultCallItIn()) {
    this.settings = settings;
    this.lectern.add(this.tome.group);
    this.group.add(this.lectern, this.bits.mesh, this.coins.mesh, this.pop.mesh, this.foePop.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SEND_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.aim = ctx.aim;
    const c = ctx.caster.group.position;
    this.spot.set(c.x + Math.sin(ctx.aim) * FRONT, 0.9, c.z + Math.cos(ctx.aim) * FRONT);
    // The enemy hero: the nearest live enemy to him; else a point ahead.
    let best: THREE.Vector3 | null = null, bd = Infinity;
    for (const e of ctx.enemies?.() ?? ctx.targets) {
      const d = Math.hypot(e.group.position.x - c.x, e.group.position.z - c.z);
      if (d < bd) { bd = d; best = e.group.position; }
    }
    if (best) this.foe.set(best.x, 1.2, best.z);
    else this.foe.set(c.x + Math.sin(ctx.aim) * 6, 1.2, c.z + Math.cos(ctx.aim) * 6);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.flags.slam = this.flags.send = false;
    this.tome.reset();
    this.bits.reset();
    this.coins.reset();
    this.pop.set(this.spot, 0, 0);
    this.foePop.set(this.foe, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.bits.update(dt);
    this.coins.update(dt);
    this.time += dt;
    const t = this.time, f = this.flags, s = this.spot;
    if (t >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      this.shake = 0;
      this.reset();
      return;
    }

    // --- The book hangs in front of him, tipped back so its pages face the camera, bobbing. Open, write, slam. ---
    this.lectern.position.set(s.x, s.y + Math.sin(t * 6) * 0.04, s.z);
    this.lectern.rotation.set(-0.45, this.aim + Math.PI, 0);
    const born = Math.min(1, t / 0.12);
    const shrink = t > GONE_T ? Math.max(0.001, 1 - (t - GONE_T) / 0.35) : 1;
    this.lectern.scale.setScalar(Math.max(0.001, born * shrink));
    this.tome.group.visible = shrink > 0.002;
    const open = f.slam ? 1 - Math.min(1, (t - SLAM_T) / 0.05) : smoothstep(t / OPEN_T);
    this.tome.set(open, t);
    if (!f.slam && t >= WRITE_FROM) this.tome.scratch(Math.min(1, (t - WRITE_FROM) / (WRITE_TO - WRITE_FROM)), t);

    // --- 0.46 Slam: a thump and a spray of paper off the cover. ---
    if (!f.slam && t >= SLAM_T) {
      f.slam = true;
      this.shake = 0.3;
      this.bits.burst(this.v1.copy(s), 18, 5, 1.1, 0.3);
      this.pop.set(this.v1.copy(s), 2.6, 1, 0);
    }
    if (f.slam) {
      const sp = StarBurst.pop(t - SLAM_T, 0.05, 0.18);
      this.pop.set(this.v1.copy(s), 2.6 * sp.scale, sp.opacity, t * 3);
    }

    // --- 0.5 The tab is called: invoices and coins fly at the enemy and burst over them. ---
    if (!f.send && t >= SEND_T) {
      f.send = true;
      this.bits.throwAt(this.v1.copy(s), this.foe, 34, 12, 1.3);
      this.coins.burst(this.v1.copy(s), 6, 3);
    }
    if (f.send) {
      const a = t - SEND_T;
      const sp = StarBurst.pop(a - 0.12, 0.05, 0.24);
      this.foePop.set(this.foe, 3.4 * sp.scale, sp.opacity, a * 4);
      if (a > 0.1 && a < 0.14) {
        this.bits.burst(this.foe, 20, 6, 1.2, 0.5);
        this.coins.burst(this.foe, 8, 4);
        this.shake = Math.max(this.shake, 0.2);
      }
    }
    this.shake *= Math.exp(-dt * 10);
  }
}

export const callItInModule: EffectModule = {
  label: 'call it in',
  category: 'hero: ledger',
  targeting: { mode: 'self', radius: 1 },
  create: () => new CallItIn(),
  // No zone: the damage is the tab coming due, not a hit of this spell.
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as CallItIn;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    f.add((effect as CallItIn).settings, 'loop');
  },
};
