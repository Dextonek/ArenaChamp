import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import {
  DAWN, DAWN_CSS, HaloRing, LightPanels, Sigil, SunRays, dawnEaseOut, dawnFacing, dawnForward, dawnOrient,
} from '../../effects/parts/dawn';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';
import { PARRY_SECONDS, dawnParries, type DawnParry } from '../../traits/dawn';

/**
 * Radiant Parry (dawn kit, E: a timed counter). Auriel snaps into a sun-shield stance: a kite shield of hard light
 * clicks together in front of her chest (0.14 s) with a ring of six hexes turning round it, a halo behind and a sun
 * sigil under her feet; the white core lines build up as the window runs out. The stance lasts `PARRY_SECONDS` (0.6 s,
 * shared with her trait). The trait (`src/traits/dawn.ts`) swallows the FIRST hit that reaches her in that window and
 * records it in `dawnParries` (keyed by her figure); this effect sees the flag and plays the parry: impact frames, a
 * white star, a sun-ray burst, a refraction ring, the shield bursting into panels, a shake. 0.05 s later the enemy hero
 * takes `damage` and a stun (a homing hit: `projectile: true`, so the duel's zone checks let it through). A parried hit
 * from a summoned unit closes the window but gives no stun. If nothing hits her, the stance goes out at the end of the
 * window as a quiet whiff: the glow cuts off and the panels crumble without a flash or a shake. Online, the other screen
 * of a duel gets no hit reports for her trait, so there the stance always whiffs and no stun lands (the stun is offline
 * only). Clean by 1.85 s. See pipeline/designs/kit-shapes-v3.md.
 */
export interface RadiantParrySettings {
  damage: number;
  /** Stun seconds on the parried enemy (engine cap 1.2). */
  stun: number;
  /** Editor preview: parry by itself at 0.45 s (the real trigger is a hit on her, seen through her trait). */
  preview: boolean;
  loop: boolean;
}

export const defaultRadiantParry = (): RadiantParrySettings => ({ damage: 20, stun: 0.6, preview: false, loop: false });

// Timeline (seconds).
const SNAP = 0.14; // the shield clicks together
const WHIFF_T = PARRY_SECONDS + 0.06; // a hair after the trait's window, so a hit on its last frame still reads as a parry
const STUN_AFTER = 0.05; // the stun lands this long after the parry flash
const DURATION = 1.85;
const CENTER_FWD = 0.95; // the shield stands this far in front of her
const CENTER_Y = 1.25;
const HEX_RING = 1.25;
const HEXES = 6;
const SPOKES = 4;
const UP = new THREE.Vector3(0, 1, 0);

export class RadiantParry implements Effect {
  readonly group = new THREE.Group();
  readonly settings: RadiantParrySettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera reads it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private flags = { asm: false, stun: false, crumbled: false };
  private parryT = -1;
  private whiffT = -1;
  private owner: object | null = null;
  private rec: DawnParry | null = null;

  // Live geometry, read from the caster's figure every frame.
  private feet = new THREE.Vector3();
  private center = new THREE.Vector3(0, CENTER_Y, 0);
  private fwd = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private nrm = new THREE.Vector3(0, 0, 1);

  // Parts.
  private panels = new LightPanels(1 + HEXES + SPOKES, 6);
  private halo = new HaloRing();
  private sigil = new Sigil();
  private rays = new SunRays(12, 0.32);
  private star = new StarBurst({ points: 10, inner: 0.3, color: DAWN.accent, core: DAWN.core, additive: false });
  private flare = new StarBurst({ points: 4, inner: 0.18, jitter: 0, color: DAWN.hot, core: DAWN.core, additive: false });
  private shock = new ShockRefraction({ facing: 'camera' });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();

  constructor(settings: RadiantParrySettings = defaultRadiantParry()) {
    this.settings = settings;
    this.screen.impactColor.set(DAWN.foil);
    this.rays.mesh.renderOrder = 4;
    this.group.add(this.sigil.mesh, this.rays.mesh, this.halo.mesh, this.panels.mesh, this.star.mesh, this.flare.mesh, this.shock.mesh);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return SNAP;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.follow();
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.center);
  }

  play() {
    this.reset();
    this.playing = true;
    const ctx = this.ctx;
    if (!ctx) return;
    // Pick up the stance her trait opened for this cast; without a trait (the editor) the effect opens its own.
    this.owner = ctx.caster;
    let r = dawnParries.get(this.owner);
    if (!r || !r.live || r.parried) {
      r = { live: true, parried: false, fromUnit: false };
      dawnParries.set(this.owner, r);
    }
    this.rec = r;
  }

  private reset() {
    // Close the stance: a stale record must not parry a later cast.
    if (this.owner && this.rec && dawnParries.get(this.owner) === this.rec) {
      this.rec.live = false;
      dawnParries.delete(this.owner);
    }
    this.owner = null;
    this.rec = null;
    this.time = 0;
    this.shake = 0;
    this.parryT = this.whiffT = -1;
    const f = this.flags;
    f.asm = f.stun = f.crumbled = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(DAWN.foil);
    this.panels.reset();
    this.halo.reset();
    this.sigil.reset();
    this.rays.reset();
    this.star.set(this.center, 1e-3, 0);
    this.flare.set(this.center, 1e-3, 0);
    this.shock.set(this.center, 0, 0);
  }

  /** Reads her feet, facing and the shield's centre from the live figure. */
  private follow() {
    const ctx = this.ctx;
    if (!ctx) return;
    const p = ctx.caster.group.position;
    const yaw = ctx.caster.group.rotation.y;
    this.feet.set(p.x, 0, p.z);
    dawnForward(yaw, this.fwd);
    dawnFacing(yaw, this.nrm);
    this.right.crossVectors(UP, this.nrm).normalize();
    this.center.copy(this.feet).addScaledVector(this.fwd, CENTER_FWD).setY(CENTER_Y);
    this.rays.face(yaw);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      const loop = this.settings.loop;
      this.reset();
      this.playing = false;
      this.shake = 0;
      if (loop) this.play();
      return;
    }
    const t = this.time;
    const f = this.flags;
    const ctx = this.ctx;
    this.follow();
    this.layout(dt);

    if (!f.asm) {
      f.asm = true;
      this.panels.assemble(SNAP, 0.07, 3.5);
    }
    if (this.settings.preview && this.rec && t >= 0.45 && this.parryT < 0) this.rec.parried = true;

    // The trait's flag turns the stance into a parry; the first frame that sees it plays the flash.
    if (this.parryT < 0 && this.rec?.parried) {
      this.parryT = t;
      this.shake = 0.55;
      this.panels.glow = 3;
    }
    // Nothing hit her: the stance goes out. The record is closed first so a late hit is not swallowed by a dead stance.
    if (this.parryT < 0 && this.whiffT < 0 && t >= WHIFF_T) {
      this.whiffT = t;
      if (this.rec) this.rec.live = false;
    }

    if (this.parryT >= 0) {
      const after = t - this.parryT;
      if (!f.stun && after >= STUN_AFTER) {
        f.stun = true;
        // A parried unit's hit closes the window without the stun.
        const e = this.rec?.enemy ?? ctx?.targets[0];
        if (ctx && e && !this.rec?.fromUnit) {
          ctx.hit(e, {
            damage: this.settings.damage, knock: 0, from: this.feet, color: DAWN_CSS.hot, projectile: true,
            status: { kind: 'stun', seconds: this.settings.stun },
          });
        }
      }
      if (!f.crumbled && after >= 0.12) {
        f.crumbled = true;
        this.panels.shatter(7, 0.8, this.center);
      }
    } else if (this.whiffT >= 0 && !f.crumbled) {
      f.crumbled = true;
      this.panels.shatter(1.4, 0.55); // a quiet crumble: slow, no centre to burst from
    }
    this.panels.update(dt);
    this.halo.spin(dt);
    this.shake *= Math.exp(-dt * 9);
  }

  private layout(dt: number) {
    const t = this.time;
    const parried = this.parryT >= 0;
    const whiffed = this.whiffT >= 0;
    const after = parried ? t - this.parryT : whiffed ? t - this.whiffT : 0;
    const spin = t * 1.3;

    // --- The shield, six hexes turning round it and four spokes, all placed every frame on her live position. ---
    if (!parried || after < 0.12) {
      if (!whiffed || after < 0.01) {
        dawnOrient(this.nrm, UP, this.q1);
        this.panels.place(0, this.center, this.q1, 1.7, 'shield', 1.15, DAWN.hot);
        for (let i = 0; i < HEXES; i++) {
          const a = spin + (i / HEXES) * Math.PI * 2;
          this.v1.copy(this.center).addScaledVector(this.right, Math.cos(a) * HEX_RING).addScaledVector(UP, Math.sin(a) * HEX_RING);
          dawnOrient(this.nrm, UP, this.q1);
          this.panels.place(1 + i, this.v1, this.q1, 0.34, 'hex', 1, i % 2 ? DAWN.foil : DAWN.body);
        }
        for (let i = 0; i < SPOKES; i++) {
          const a = -spin * 0.6 + Math.PI / 4 + (i / SPOKES) * Math.PI * 2;
          this.v2.copy(this.right).multiplyScalar(Math.cos(a)).addScaledVector(UP, Math.sin(a));
          this.v1.copy(this.center).addScaledVector(this.v2, 1.7);
          dawnOrient(this.nrm, this.v2, this.q1);
          this.panels.place(1 + HEXES + i, this.v1, this.q1, 0.75, 'shard', 0.8, DAWN.hot);
        }
      }
    }
    // The core lines build as the window runs out; the whiff cuts them off, the parry overdrives them.
    if (!parried && !whiffed) this.panels.glow = 0.25 + 0.6 * smoothstep((t - 0.25) / (PARRY_SECONDS - 0.25));
    else if (whiffed) this.panels.glow = 0;
    else this.panels.glow = 3 * Math.exp(-after * 9);

    // --- Halo behind the shield, sigil under her feet. ---
    this.v1.copy(this.center).addScaledVector(this.fwd, -0.12);
    const haloIn = smoothstep((t - 0.04) / 0.14);
    const haloR = 1.3 * (0.55 + 0.45 * dawnEaseOut((t - 0.04) / 0.14)) * (parried ? 1 + 0.9 * dawnEaseOut(after / 0.3) : 1);
    this.halo.set(this.v1, this.nrm, haloR);
    this.halo.opacity = haloIn * (parried ? 1 - smoothstep(after / 0.45) : whiffed ? 1 - smoothstep(after / 0.18) : 1);

    this.sigil.set(this.v1.copy(this.feet), 1.4);
    this.sigil.reveal = smoothstep(t / 0.16);
    this.sigil.opacity = parried ? 1 - smoothstep((after - 0.1) / 0.5) : whiffed ? 1 - smoothstep(after / 0.25) : 1;

    // --- Sun rays: a low fan behind the shield while it stands; a full burst at the parry. ---
    if (parried) {
      this.rays.fan(this.center, UP, 12, 5.5, Math.PI, dawnEaseOut(after / 0.18), 0.5);
      this.rays.fade(1 - smoothstep(after / 0.5));
    } else if (!whiffed) {
      this.rays.fan(this.center, UP, 8, 2.6, Math.PI, dawnEaseOut((t - 0.1) / 0.3), 0.32);
      this.rays.fade(0.45 * smoothstep((t - 0.1) / 0.2));
    } else {
      this.rays.fade(0);
    }

    // --- The parry: impact frames, a white star, a four-point flare, a refraction ring. ---
    this.screen.impact = parried ? impactFrameAt(t, this.parryT, [1, 2], 0.04) : 0;
    if (parried) {
      const sp = StarBurst.pop(after, 0.04, 0.12);
      this.star.set(this.center, 3.2 * sp.scale + 1e-3, sp.opacity, 0.15);
      const fp = StarBurst.pop(after - 0.02, 0.08, 0.16);
      this.flare.set(this.center, 4.4 * fp.scale + 1e-3, fp.opacity, 0.5);
      const gp = THREE.MathUtils.clamp(after / 0.4, 0, 1);
      this.shock.set(this.center, 0.5 + 3.4 * gp, 0.07 * (1 - gp) * (1 - gp));
    } else {
      this.star.set(this.center, 1e-3, 0);
      this.flare.set(this.center, 1e-3, 0);
      this.shock.set(this.center, 0, 0);
    }
    void dt;
  }
}

export const radiantParryModule: EffectModule = {
  label: 'radiant parry',
  category: 'hero: dawn',
  // A self spell with a wide radius: the enemy hero is in `targets` from anywhere in the ring, so the stun has a target.
  targeting: { mode: 'self', radius: 12 },
  create: () => new RadiantParry(),
  // No zone: it is a stance on her, nothing to dodge.
  telegraphs: () => [],
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as RadiantParry;
    if (e.ctx) frameCast(camera, controls, e.ctx, 2);
  },
  buildGui(f, effect) {
    const s = (effect as RadiantParry).settings;
    f.add(s, 'loop');
    f.add(s, 'preview');
    f.add(s, 'damage', 0, 80, 1);
    f.add(s, 'stun', 0, 1.2, 0.1);
  },
};
