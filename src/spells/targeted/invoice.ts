import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { StarBurst } from '../../effects/parts';
import { InkSplats, Invoice, LEDGER, LEDGER_CSS, PaperBits } from '../../effects/parts/ledger';
import { boltWidth, type Projectile } from '../../effects/projectile';
import type { TelegraphSpec } from '../../effects/telegraph';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { INVOICE_DAMAGE, INVOICE_RADIUS, INVOICE_RANGE, INVOICE_SPEED, INVOICE_WIND } from '../../traits/ledger';

/**
 * Invoice (ledger kit, Q: a paper that flies). Mr. Ledger pulls a fresh invoice out of the ledger at his side over the 0.25 s wind-up
 * (it unrolls and flaps) and flicks it as a real bolt (`ctx.projectile`: 9 m from him, 20 m/s, radius 0.35): a sheet of paper that
 * lies flat, flutters at its corners, rolls and pitches in the air and sheds scraps, some red. It reaches 6 m at 0.55 s. A hit: the
 * sheet slaps flat on the target in a puff of paper and a red ink stamp-mark on the floor; 50 damage that does NOT hurt now, it
 * goes on the target's tab (`src/traits/ledger.ts`, `dealt`). A miss: it sinks and settles on the floor where its range ends.
 *
 * Telegraph: one thin line as wide as the bolt really hits (`boltWidth`), from the cast; its `impact` is the launch (0.25 s), so
 * the root on him ends there. Network duels: bolts fly on the victim's screen, so the caster's screen draws the same flight along
 * the same line. Clean by about 1.9 s. See pipeline/designs/kit-ledger.md.
 */
export interface InvoiceSettings {
  damage: number;
  knock: number;
}

export const defaultInvoice = (): InvoiceSettings => ({ damage: INVOICE_DAMAGE, knock: 1 });

// Timeline and numbers.
const MUZZLE = 0.8;
const BOLT_Y = 1.1;
const MAX_T = 2.2;
const LINE_W = boltWidth(INVOICE_RADIUS);
const FLIGHT = INVOICE_RANGE - MUZZLE;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const MIN = 1e-3;

export class InvoiceSpell implements Effect {
  readonly group = new THREE.Group();
  readonly settings: InvoiceSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  start = new THREE.Vector3();
  dir = new THREE.Vector3(0, 0, 1);
  private time = 0;
  private fired = false;
  private bolt: Projectile | null = null;
  private drawn = -1; // metres flown by the drawn-only bolt (-1: none, -2: done)
  private goneAt = -1;
  private landed = false;
  private trailT = 0;
  private tip = new THREE.Vector3();
  private lastPos = new THREE.Vector3();

  private sheet = new Invoice(0.8, 1.0);
  private bank = new THREE.Group();
  private flyer = new THREE.Group();
  private bits = new PaperBits(70);
  private ink = new InkSplats(3);
  private star = new StarBurst({ points: 8, inner: 0.35, color: LEDGER.gold, core: LEDGER.core, additive: false });
  private starAt = new THREE.Vector3();
  private starAge = 9;

  private v1 = new THREE.Vector3();

  constructor(settings: InvoiceSettings = defaultInvoice()) {
    this.settings = settings;
    this.sheet.mesh.rotation.x = -Math.PI / 2;
    this.bank.add(this.sheet.mesh);
    this.flyer.add(this.bank);
    this.group.add(this.flyer, this.bits.mesh, this.ink.group, this.star.mesh);
    this.reset();
  }

  get duration() {
    return MAX_T;
  }

  get impactTime() {
    return INVOICE_WIND;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    // Both screens must agree on the line: only sentFrom and the aim point.
    const s = ctx.sentFrom ?? ctx.from;
    let dx = ctx.point.x - s.x, dz = ctx.point.z - s.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = Math.sin(ctx.aim); dz = Math.cos(ctx.aim); } else { dx /= len; dz /= len; }
    this.dir.set(dx, 0, dz);
    this.start.set(s.x + dx * MUZZLE, 0, s.z + dz * MUZZLE);
    // His hand: a little ahead of him, left of centre, at hand height.
    this.tip.set(ctx.from.x + dx * 0.7 - dz * 0.35, 1.25, ctx.from.z + dz * 0.7 + dx * 0.35);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.fired = false;
    this.bolt = null;
    this.drawn = -1;
    this.goneAt = -1;
    this.landed = false;
    this.trailT = 0;
    this.starAge = 9;
    this.sheet.mesh.visible = false;
    this.bits.reset();
    this.ink.reset();
    this.star.set(this.starAt, 0, 0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.bits.update(dt);
    this.ink.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, s = this.settings;

    // --- Wind-up: the invoice is drawn out at his hand, unrolling and flapping. ---
    if (!this.fired) {
      const k = easeOut(t / INVOICE_WIND);
      this.sheet.mesh.visible = true;
      this.flyer.position.copy(this.tip);
      this.flyer.rotation.y = Math.atan2(this.dir.x, this.dir.z);
      this.flyer.scale.setScalar(Math.max(MIN, k));
      this.bank.rotation.set(0.5 * (1 - k), 0, Math.sin(t * 40) * 0.25);
      this.sheet.flutter(t, 2.2, 22);
      this.trailT += dt;
      if (this.trailT >= 0.06) { this.trailT = 0; this.bits.burst(this.tip, 1, 1.2, 0.8, 0.1); }
    }

    // --- Fire. A real bolt where there is one; else (a network duel's caster screen) a drawn bolt along the same line. ---
    if (!this.fired && t >= INVOICE_WIND) {
      this.fired = true;
      this.shake = 0.06;
      this.flyer.scale.setScalar(1);
      if (ctx?.projectile) {
        this.bolt = ctx.projectile({
          from: this.start.clone(), dir: this.dir.clone(), speed: INVOICE_SPEED, range: FLIGHT, radius: INVOICE_RADIUS,
          hit: { damage: s.damage, knock: s.knock, color: LEDGER_CSS.gold },
        });
        this.bolt.onHit((_target, at) => this.land(at, true));
      } else {
        this.drawn = 0;
      }
    }

    // --- The sheet rides the bolt (or the drawn line), fluttering; scraps come off it. ---
    const b = this.bolt;
    let live = false;
    if (b) {
      live = b.alive;
      if (live) { this.lastPos.copy(b.pos); this.ride(b.pos, dt); }
    } else if (this.drawn >= 0) {
      this.drawn += INVOICE_SPEED * dt;
      live = this.drawn < FLIGHT;
      if (live) {
        this.v1.set(this.start.x + this.dir.x * this.drawn, BOLT_Y, this.start.z + this.dir.z * this.drawn);
        this.lastPos.copy(this.v1);
        this.ride(this.v1, dt);
      } else this.drawn = -2;
    }
    if (this.fired && !live && this.goneAt < 0) {
      this.goneAt = t;
      if (!this.landed) this.settle();
    }

    // A landed sheet lies and fades; the star pops and shrinks.
    if (this.goneAt >= 0) {
      const a = t - this.goneAt;
      this.sheet.flutter(t, Math.max(0, 1 - a * 2.5), 10);
      this.flyer.scale.setScalar(Math.max(MIN, Math.min(1, (0.9 - a) / 0.4)));
    }
    this.starAge += dt;
    const sp = StarBurst.pop(this.starAge, 0.05, 0.18);
    this.star.set(this.starAt, 1.6 * sp.scale, sp.opacity, this.starAge * 4);
    this.shake *= Math.exp(-dt * 12);

    if ((this.goneAt >= 0 && t >= this.goneAt + 1.0 && !this.bits.busy) || t >= MAX_T) {
      this.playing = false;
      this.reset();
    }
  }

  /** Moves the sheet to the bolt: flat, rolling, pitching, flapping, shedding scraps. */
  private ride(pos: THREE.Vector3, dt: number) {
    const t = this.time;
    this.flyer.position.copy(pos);
    this.flyer.rotation.y = Math.atan2(this.dir.x, this.dir.z);
    this.bank.rotation.set(Math.sin(t * 11) * 0.45, 0, Math.sin(t * 8 + 1) * 0.6);
    this.sheet.mesh.rotation.z = t * 9;
    this.sheet.flutter(t, 1.4, 16);
    this.trailT += dt;
    if (this.trailT >= 0.05) { this.trailT = 0; this.bits.burst(this.v1.copy(pos).addScaledVector(this.dir, -0.5), 1, 1.0, 0.8, 0.35); }
  }

  /** The sheet hits: it slaps flat on the target in a puff of paper, with a red mark on the floor. */
  private land(at: THREE.Vector3, hit: boolean) {
    this.landed = true;
    this.starAt.set(at.x, BOLT_Y, at.z);
    this.starAge = 0;
    this.bits.burst(this.starAt, hit ? 22 : 8, hit ? 5 : 2.5, 1.1, 0.4);
    if (hit) this.ink.splat(at.x, at.z, 1.1, LEDGER.red, 2.0);
    this.shake = hit ? 0.14 : 0.04;
    this.sheet.mesh.visible = false;
    this.goneAt = this.time;
  }

  /** A miss: the sheet sinks to the floor where the range ends. */
  private settle() {
    this.landed = true;
    this.flyer.position.set(this.lastPos.x, 0.08, this.lastPos.z);
    this.bank.rotation.set(0, 0, 0);
    this.sheet.mesh.rotation.z = 0.4;
    this.starAt.set(this.lastPos.x, 0.3, this.lastPos.z);
    this.bits.burst(this.starAt, 6, 2, 0.9, 0.2);
  }
}

export const invoiceModule: EffectModule = {
  label: 'invoice',
  category: 'hero: ledger',
  // A skillshot is aimed at a spot (the ground point or the target's feet); `radius` only sizes the aim marker.
  targeting: { mode: 'ground', radius: INVOICE_RADIUS },
  create: () => new InvoiceSpell(),
  telegraphs(effect) {
    const e = effect as InvoiceSpell;
    if (!e.ctx) return [];
    const s = e.ctx.sentFrom ?? e.ctx.from;
    const spec: TelegraphSpec = {
      shape: { kind: 'line', x1: s.x, z1: s.z, x2: s.x + e.dir.x * INVOICE_RANGE, z2: s.z + e.dir.z * INVOICE_RANGE, width: LINE_W },
      start: 0,
      impact: INVOICE_WIND,
      until: INVOICE_WIND + FLIGHT / INVOICE_SPEED,
    };
    return [spec];
  },
  bloom: { enabled: true, strength: 0.25, radius: 0.3, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as InvoiceSpell;
    if (e.ctx) frameCast(camera, controls, e.ctx, 3);
  },
  buildGui(f, effect) {
    const s = (effect as InvoiceSpell).settings;
    f.add(s, 'damage', 0, 150, 1);
    f.add(s, 'knock', 0, 8, 0.5);
  },
};
