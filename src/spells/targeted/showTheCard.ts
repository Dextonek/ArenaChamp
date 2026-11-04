import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, flashBeat, impactFrameAt } from '../../effects/parts';
import { stillSees } from '../../effects/channel';
import { CardFlight, GroundSign, PointingArm, REFEREE, REFEREE_CSS, SoundRings } from '../../effects/parts/referee';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { CARD_DELAY, CARD_RADIUS } from '../../traits/referee';

/**
 * Show the Card (referee kit, R: the pointing arm). A big sleeved arm swings up out of his shoulder and points at the aimed spot (9 m,
 * `CARD_RANGE`), one finger straight, and a white dashed line draws along the floor from him to a circle of radius 1.2 at the spot
 * (the telegraph, closing in on the countdown). At 0.2 s his other hand throws a yellow card: it flies at the spot, flipping end over
 * end, and lands at 0.6 s (`CARD_DELAY`), with the finger jabbing at the same moment: one impact frame (a short cut in black and
 * white), a short whiteout blink, a flat ring of sound on the floor, and a HANDS OFF sign stamped under whoever is hit.
 *
 * The hit: whoever's live position is inside the circle at that moment AND is still seen by him (`stillSees`: cover saves them) takes a
 * hit of damage 1 that the trait (`dealt`, slot 3) turns into a yellow card now (a second yellow is a red: 60 and silence) and the
 * rule HANDS OFF for 3 s (hit him in that time and it is another yellow). No sight: the card falls on a bare floor and the sign does not
 * show. The arm lowers and goes; clean by about 2.2 s, under the gameplay camera. See pipeline/designs/kit-referee.md.
 */
export interface ShowTheCardSettings {
  /** The hit the trait replaces: it only has to exist. */
  damage: number;
  loop: boolean;
}

export const defaultShowTheCard = (): ShowTheCardSettings => ({ damage: 1, loop: false });

// Timeline (seconds).
const RAISE_T = 0.28;
const THROW_T = 0.2;
const LAND_T = CARD_DELAY;
const LOWER_T = LAND_T + 0.5;
const GONE_T = LAND_T + 0.9;
const DURATION = 2.2;
const SHOULDER_Y = 1.5;
const ARM_SCALE = 1.7;
const MIN = 1e-3;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class ShowTheCard implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ShowTheCardSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  point = new THREE.Vector3(0, 0, -6);
  private time = 0;
  private from = new THREE.Vector3();
  private yaw = 0;
  private thrown = false;
  private landed = false;
  private seen = true;
  private hitAt: { x: number; z: number } | null = null;

  private arm = new PointingArm();
  private cards = new CardFlight(6);
  private rings = new SoundRings(8);
  private sign = new GroundSign('hands', 2.6);
  private line: THREE.Mesh;
  private flood = new THREE.Mesh(
    new THREE.CircleGeometry(CARD_RADIUS, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: REFEREE.yellow, transparent: true, depthWrite: false, opacity: 0 }),
  );
  private blast = new StarBurst({ points: 12, inner: 0.28, color: REFEREE.hotYellow, core: REFEREE.white, additive: false });
  private shock = new ShockRefraction({ facing: 'ground' });
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: ShowTheCardSettings = defaultShowTheCard()) {
    this.settings = settings;
    // The dashed line: a flat strip along +z, 1 m long, 0.22 wide, scaled to the length; its texture is dashes.
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = REFEREE_CSS.white;
    for (let i = 0; i < 4; i++) g.fillRect(0, i * 32 + 4, 16, 18);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.line = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    this.line.renderOrder = 2;
    this.line.visible = false;
    this.flood.renderOrder = 1;
    this.screen.impactColor.set(REFEREE.white);
    this.screen.tint.set(REFEREE.dark);
    this.group.add(this.flood, this.line, this.sign.mesh, this.arm.group, this.cards.group, this.rings.group, this.blast.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return LAND_T;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    const s = ctx.sentFrom ?? ctx.from;
    this.from.set(s.x, 0, s.z);
    this.yaw = Math.atan2(this.point.x - s.x, this.point.z - s.z);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.thrown = false;
    this.landed = false;
    this.seen = true;
    this.hitAt = null;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(REFEREE.white);
    this.screen.tint.set(REFEREE.dark);
    this.arm.group.visible = false;
    this.cards.reset();
    this.rings.reset();
    this.sign.set(0, 0, 0);
    this.line.visible = false;
    this.blast.set(this.point, 0, 0);
    this.shock.set(this.point, 0, 0);
    (this.flood.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    this.cards.update(dt);
    this.rings.update(dt);
    if (!this.playing) return;
    this.time += dt;
    const t = this.time, ctx = this.ctx, p = this.point;
    if (t >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
      this.shake = 0;
      this.reset();
      return;
    }

    // --- The arm swings up out of his shoulder and points at the spot; it jabs at the landing, then lowers. ---
    const dist = Math.hypot(p.x - this.from.x, p.z - this.from.z);
    const raise = easeOut(t / RAISE_T);
    const lower = smoothstep((t - LOWER_T) / (GONE_T - LOWER_T));
    this.arm.group.visible = t < GONE_T;
    this.arm.group.position.set(this.from.x + Math.sin(this.yaw) * 0.35 + Math.cos(this.yaw) * 0.5, SHOULDER_Y, this.from.z + Math.cos(this.yaw) * 0.35 - Math.sin(this.yaw) * 0.5);
    // Up out of his side, then out along the aim, pitched down at the spot.
    const pitch = Math.atan2(SHOULDER_Y + 0.4, Math.max(2, dist)) * raise;
    this.arm.group.rotation.set(0, 0, 0);
    this.arm.group.rotation.y = this.yaw + (1 - raise) * 0.9;
    this.arm.group.rotateX(-(1 - raise) * 1.2 + pitch * 0.35 + lower * 1.3);
    this.arm.group.scale.setScalar(Math.max(MIN, ARM_SCALE * (0.5 + 0.5 * raise) * (1 - lower * 0.4)));
    const jab = t >= LAND_T - 0.05 && t < LAND_T + 0.25 ? 0.35 * Math.sin(((t - LAND_T + 0.05) / 0.3) * Math.PI) : 0;
    this.arm.jab(jab);

    // --- The dashed line along the floor from him to the spot: it runs out and flickers toward the landing. ---
    const run = easeOut((t - 0.05) / 0.25);
    const lop = t < LAND_T ? 0.35 + 0.35 * smoothstep(t / 0.35) : 0.7 * (1 - smoothstep((t - LAND_T) / 0.3));
    this.line.visible = t > 0.05 && lop > 0.01 && dist > 1;
    this.line.position.set(this.from.x, 0.07, this.from.z);
    this.line.rotation.y = this.yaw;
    this.line.scale.set(1, 1, Math.max(MIN, dist * run));
    (this.line.material as THREE.MeshBasicMaterial).opacity = lop;
    (this.line.material as THREE.MeshBasicMaterial).map!.repeat.set(1, Math.max(1, dist * 0.8));

    // --- 0.2 The other hand throws a yellow card: it flies at the spot, flipping, and lands at 0.6 s. ---
    if (!this.thrown && t >= THROW_T) {
      this.thrown = true;
      this.v1.set(this.from.x - Math.cos(this.yaw) * 0.55, 1.6, this.from.z + Math.sin(this.yaw) * 0.55);
      this.v2.set(p.x, 1.0, p.z);
      this.cards.throw(this.v1, this.v2, { flight: LAND_T - THROW_T, color: REFEREE.yellow, lift: 1.2 + dist * 0.12, spin: 20, size: 1.4, hold: 0.6 });
    }

    // --- 0.6 The landing: who is in the circle now, and seen, is hit (the trait makes it a card and HANDS OFF). ---
    if (!this.landed && t >= LAND_T) {
      this.landed = true;
      this.slam(ctx);
    }
    // The circle shows from the cast (it is the telegraph); a yellow flood fills it at the landing.
    const fm = this.flood.material as THREE.MeshBasicMaterial;
    this.flood.position.set(p.x, 0.045, p.z);
    if (this.landed) {
      const a = t - LAND_T;
      this.screen.impact = impactFrameAt(t, LAND_T, [2, 1], 0.04);
      const fb = flashBeat(t, LAND_T + 0.08, 0.04, 0.25, 0);
      this.screen.exposure = fb.exposure;
      this.screen.whiteout = 0.35 * fb.whiteout;
      this.screen.darken = 0.25 * (1 - smoothstep((a - 0.15) / 0.6));
      fm.opacity = (this.seen ? 0.5 : 0.15) * Math.exp(-a * 2);
      const g = smoothstep(a / 0.4);
      this.shock.set(this.v1.set(p.x, 0, p.z), 0.4 + 3.4 * g, 0.045 * (1 - g) * (1 - g));
      const bp = StarBurst.pop(a - 0.03, 0.03, 0.2);
      this.blast.set(this.v1.set(p.x, 1.1, p.z), 3.2 * bp.scale, bp.opacity, a * 2);
      this.shake = 0.6 * Math.exp(-a * 9);
      // The sign stamps down under the one hit.
      if (this.hitAt) {
        const bounce = a < 0.18 ? 2.2 - 1.2 * easeOut(a / 0.18) : 1;
        this.sign.set(this.hitAt.x, this.hitAt.z, 0.95 * Math.min(1, a / 0.05) * (1 - smoothstep((a - 0.9) / 0.4)), bounce);
      }
    } else fm.opacity = 0;
  }

  private slam(ctx: CastContext | null) {
    const p = this.point;
    if (ctx) {
      const list = ctx.enemies?.() ?? ctx.targets;
      for (const e of list) {
        const q = e.group.position;
        if (Math.hypot(q.x - p.x, q.z - p.z) > CARD_RADIUS) continue;
        // Cover saves them: he must see them when the card lands.
        if (!stillSees(ctx, q)) { this.seen = false; continue; }
        ctx.hit(e, { damage: this.settings.damage, knock: 0, from: p, color: REFEREE_CSS.yellow });
        if (!this.hitAt) this.hitAt = { x: q.x, z: q.z };
      }
    }
    // A flat ring of sound on the floor, a dark one under it, and a few cards flipped up from the landing.
    this.rings.fire({ x: p.x, y: 0.1, z: p.z, r0: 0.4, r1: 3.2, life: 0.5, yaw: null, opacity: 0.85, thick: 2 });
    this.rings.fire({ x: p.x, y: 0.08, z: p.z, r0: 0.3, r1: 2.6, life: 0.55, yaw: null, color: REFEREE.foil, opacity: 0.8, thick: 2 });
    if (this.seen) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.6;
        this.v1.set(p.x, 0.9, p.z);
        this.v2.set(p.x + Math.cos(a) * 1.9, 0.2, p.z + Math.sin(a) * 1.9);
        this.cards.throw(this.v1, this.v2, { flight: 0.4, color: i === 1 ? REFEREE.red : REFEREE.yellow, lift: 1.6, spin: 14, size: 0.9, hold: 0.25 });
      }
    }
    this.shake = 0.6;
  }
}

export const showTheCardModule: EffectModule = {
  label: 'show the card',
  category: 'hero: referee',
  targeting: { mode: 'ground', radius: CARD_RADIUS },
  create: () => new ShowTheCard(),
  telegraphs(effect) {
    const e = effect as ShowTheCard;
    if (!e.ctx) return [];
    return [{ shape: { kind: 'circle', x: e.point.x, z: e.point.z, radius: CARD_RADIUS }, start: 0, impact: LAND_T }];
  },
  bloom: { enabled: true, strength: 0.3, radius: 0.35, threshold: 0.88 },
  frameCamera(camera, controls, effect) {
    const e = effect as ShowTheCard;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as ShowTheCard).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 0, 20, 1);
  },
};
