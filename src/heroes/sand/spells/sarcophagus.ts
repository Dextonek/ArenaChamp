import * as THREE from 'three';
import { smoothstep } from '../../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../../effects/parts';
import type { Look } from '../../framework/blocks';
import { spell, type Cast } from '../../framework/spell';
import { SAND, SAND_CSS, Dust, GlyphRing, Sarcophagus, ScarabSwarm } from '../parts';

/**
 * Sarcophagus (sand kit v5, R: a sealed tomb at the enemy's spot, `enemy` mode, 9 m, sight checked by the engine at the cast).
 * A circle of glyph-carved stone (1.6 m, the telegraph) is laid at the spot the enemy stood at the cast and a gold
 * mummiform sarcophagus rises out of the floor there with its two halves swung wide, in 0.4 s. At 0.7 s the halves slam shut
 * (`impact`, the one short warning-free moment, the shut is the hit). If the enemy is still inside 1.6 m (their live position)
 * `ctx.hit(target, { damage: 0, knock: 0, status: sealed 1.2 s })`: sealed, they cannot act and nothing can hit them from
 * either side, and the opaque gold case hides them. If they stepped out it shuts on nothing, and sinks: no seal, no damage.
 * The seal runs 1.2 s from the frame it landed. The frame it ends is not trusted (statuses tick each frame and the effect
 * cannot read the enemy's status), so the effect waits one more frame, then the halves burst open in scarabs and the 110 damage
 * lands (`projectile: true`: the hit is on the seal's own result, a figure no longer sealed, so `resolve` does not swallow it)
 * with a brief impact frame. The trait (`../trait.ts`) Judges them with that hit. So the burst comes about 1.3 s after the
 * seal, around 2.0 s after the cast; clean by about 3.1 s. Sefu is free to move and act from 0.7 s.
 * Network duels: the victim's client decides the seal and the burst from the cast's live positions; the dealer's screen draws
 * the same case at the same times.
 *
 * On the spell blocks (docs/pipeline/hero-framework.md): the seal is a sure hit that must still find them inside the circle;
 * the burst a frame after the seal ends is a hook of its own (`on.frame`), code.
 */

/** The seal and the burst of this cast. */
interface Tomb {
  /** The frame the seal landed (-1: shut on nothing, or not yet). */
  sealAt: number;
  armed: boolean;
  burstAt: number;
  /** Where the case stands: the spot, or where the sealed enemy stood when it shut (they are frozen there, inside it). */
  casePos: THREE.Vector3;
}

const RISE_T = 0.4; // fully up, halves wide
const SHUT_FROM = 0.55; // the halves start to swing shut
const SHUT_T = 0.7; // shut: the seal decision
const MISS_SINK_T = 0.95; // a shut-on-nothing case starts to sink
const MISS_END = 1.7;
const AFTER_BURST = 1.0; // from the burst to clean

const RADIUS = 1.6; // the telegraph circle, and how far from the spot the enemy may be at 0.7 s
const RING_R = 1.75; // the carved ring on the floor

class TombLook implements Look<Tomb, 'seal'> {
  readonly screen = createScreenFx();
  private spot = new THREE.Vector3();
  private yaw = 0;
  private decided = false;
  private flags = { rise: false };

  private ring = new GlyphRing();
  private case = new Sarcophagus();
  private swarm = new ScarabSwarm(40);
  private dust = new Dust(10, 40);
  private flash = new StarBurst({ points: 12, inner: 0.3, color: SAND.hot, core: SAND.core, additive: false });
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private shock = new ShockRefraction({ facing: 'camera' });

  private v1 = new THREE.Vector3();

  constructor(group: THREE.Group) {
    this.screen.impactColor.set(SAND.stone);
    this.screen.tint.set(SAND.dark);
    this.dust.life = 0.7;
    group.add(this.ring.mesh, this.case.mesh, this.swarm.mesh, this.dust.mesh, this.flash.mesh, this.groundShock.mesh, this.shock.mesh);
  }

  cast(c: Cast<Tomb, 'seal'>) {
    const ctx = c.ctx!;
    this.spot.copy(c.spot);
    c.state.casePos.copy(this.spot);
    // The face looks toward the caster's side, which is the camera's.
    this.yaw = Math.atan2(c.from.x - this.spot.x, c.from.z - this.spot.z);
    this.case.place(c.state.casePos, this.yaw);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.spot).setY(1.4);
  }

  reset(c: Cast<Tomb, 'seal'>) {
    const s = c.state;
    this.decided = false;
    s.sealAt = -1;
    s.armed = false;
    s.burstAt = -1;
    s.casePos.copy(this.spot);
    this.flags.rise = false;
    clearScreenFx(this.screen);
    this.screen.impactColor.set(SAND.stone);
    this.screen.tint.set(SAND.dark);
    this.ring.reset();
    this.ring.set(this.spot, RING_R, 0);
    this.case.reset();
    this.case.place(s.casePos, this.yaw);
    this.swarm.reset();
    this.dust.reset();
    this.flash.set(this.spot, 1e-3, 0);
    this.groundShock.set(this.spot, 0, 0);
    this.shock.set(this.spot, 0, 0);
  }

  tick(dt: number) {
    this.swarm.update(dt);
    this.dust.update(dt);
  }

  frame(_c: Cast<Tomb, 'seal'>, t: number) {
    if (!this.flags.rise && t >= 0.05) {
      this.flags.rise = true;
      this.dust.puff(this.v1.copy(this.spot).setY(0.3), 1.0);
      this.dust.fall(this.spot, 1.4, 14, 2.5, 0.8);
    }
  }

  /** 0.7 s: the halves shut. Still inside the circle (`c.landed`): sealed, the case shuts round them where they stand. */
  impacting(c: Cast<Tomb, 'seal'>) {
    const s = c.state;
    this.decided = true;
    c.shake = 0.35;
    this.dust.puff(this.v1.copy(this.spot).setY(0.3), 1.2);
    this.dust.fall(this.spot, 1.4, 14, 2.0, 0.6);
    if (!c.landed) return;
    const p = c.target!.group.position;
    s.sealAt = c.time;
    // The effect must outlive the seal: the burst sets the real end.
    c.extend(c.time + c.num('seal') + AFTER_BURST);
    s.casePos.set(p.x, 0, p.z);
    this.case.place(s.casePos, this.yaw);
    this.dust.puff(this.v1.copy(s.casePos).setY(0.3), 1.0);
  }

  /** The halves burst open in scarabs (before the burst's hit). */
  burst(c: Cast<Tomb, 'seal'>) {
    const at = c.state.casePos;
    c.shake = 0.8;
    this.swarm.burst(this.v1.copy(at).setY(0.6), 30, 6, 1.1);
    this.dust.puff(this.v1.copy(at).setY(0.4), 1.3);
    this.dust.fall(at, 1.6, 20, 3, 0.8);
  }

  after(c: Cast<Tomb, 'seal'>, t: number, dt: number) {
    this.layout(c, t);
    c.shake *= Math.exp(-dt * 9);
  }

  private layout(c: Cast<Tomb, 'seal'>, t: number) {
    const s = c.state, casePos = s.casePos;
    // --- The carved ring: swept on in 0.3 s, pulsing turquoise while they are sealed, gone with the case. ---
    const burstA = s.burstAt >= 0 ? t - s.burstAt : -1;
    const ringFade = burstA >= 0 ? 1 - smoothstep((burstA - 0.4) / 0.5) : this.decided && s.sealAt < 0 ? 1 - smoothstep((t - MISS_SINK_T) / 0.5) : 1;
    this.ring.reveal = smoothstep(t / 0.3);
    this.ring.opacity = ringFade;
    this.ring.lit = s.sealAt >= 0 && burstA < 0 ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
    this.ring.set(this.spot, RING_R, 0);

    // --- The case: rises with its halves wide, swings shut at 0.7 s, shakes while it holds, bursts open, sinks. ---
    let rise = smoothstep((t - 0.05) / (RISE_T - 0.05));
    let open = 1 - smoothstep((t - SHUT_FROM) / (SHUT_T - SHUT_FROM));
    if (burstA >= 0) {
      open = Math.min(1.7, smoothstep(burstA / 0.15) * 1.7);
      rise = 1 - smoothstep((burstA - 0.35) / 0.55);
    } else if (this.decided && s.sealAt < 0) {
      rise = 1 - smoothstep((t - MISS_SINK_T) / 0.5);
    }
    this.case.set(open, rise);
    const held = s.sealAt >= 0 && burstA < 0;
    const shake = held ? 0.035 * (0.4 + 0.6 * smoothstep((t - s.sealAt) / c.num('seal'))) : 0;
    this.case.mesh.position.x = casePos.x + Math.sin(t * 61) * shake;
    this.case.mesh.position.z = casePos.z + Math.cos(t * 53) * shake;

    // --- The screen: dims through the hold and the dead beat, one short impact frame on the burst. ---
    const dim = held ? smoothstep((t - s.sealAt) / 0.2) : burstA >= 0 ? 1 - smoothstep(burstA / 0.4) : 0;
    this.screen.darken = 0.3 * dim;
    this.screen.focus.copy(casePos).setY(1.4);
    this.screen.impact = burstA >= 0 ? impactFrameAt(t, s.burstAt, [1, 2], 0.04) : 0;

    // --- The shut and the burst: a star and rings. ---
    if (this.decided) {
      const a = t - SHUT_T;
      const sp = StarBurst.pop(a, 0.02, 0.08);
      this.flash.set(this.v1.copy(casePos).setY(1.4), (s.sealAt >= 0 ? 1.3 : 0.7) * sp.scale + 1e-3, sp.opacity, 0.2);
    }
    if (burstA >= 0) {
      const sp = StarBurst.pop(burstA, 0.03, 0.14);
      this.flash.set(this.v1.copy(casePos).setY(1.5), 2.4 * sp.scale + 1e-3, sp.opacity, 0.4);
      const g = THREE.MathUtils.clamp(burstA / 0.45, 0, 1);
      this.groundShock.set(casePos, 0.6 + 3.4 * g, 0.05 * (1 - g) * (1 - g));
      const k = THREE.MathUtils.clamp(burstA / 0.3, 0, 1);
      this.shock.set(this.v1.copy(casePos).setY(1.5), 0.4 + 2.0 * k, 0.05 * (1 - k) * (1 - k));
    }
  }
}

export const sarcophagusModule = spell<Tomb, 'seal'>({
  label: 'sarcophagus',
  category: 'hero: sand',
  // Click an enemy within 9 m (the engine checks sight at the cast). The circle is fixed where they stood: step out of it.
  targeting: { mode: 'enemy' },
  seconds: MISS_END,
  state: () => ({ sealAt: -1, armed: false, burstAt: -1, casePos: new THREE.Vector3() }),
  rules: {
    windup: SHUT_T,
    // One zone only: a longer one would root the caster for the whole seal. It ends at the shut (0.7 s).
    shape: { kind: 'target', mark: RADIUS, inside: RADIUS },
    hit: { damage: 110, none: true, knock: 0, color: SAND_CSS.hot, status: { kind: 'sealed', seconds: 'seal' } },
    warn: 0,
    on: {
      // The seal has run its time: wait one frame, then the case bursts open and the damage lands on an unsealed figure.
      frame: (c, t) => {
        const s = c.state;
        if (s.sealAt < 0 || s.burstAt >= 0) return;
        if (!s.armed) {
          if (t >= s.sealAt + c.num('seal')) s.armed = true;
          return;
        }
        s.burstAt = t;
        c.extend(t + AFTER_BURST);
        (c.look as TombLook).burst(c);
        // `projectile`: the seal and the circle were the check; the burst reaches the figure inside.
        if (c.ctx && c.target) c.ctx.hit(c.target, { damage: c.settings.damage, knock: 2, from: s.casePos.clone(), color: SAND_CSS.hot, projectile: true });
      },
    },
  },
  // Seal seconds (engine cap 1.2).
  tune: { seal: [1.2, 0.2, 1.2, 0.1] },
  look: TombLook,
  bloom: { enabled: true, strength: 0.5, radius: 0.4, threshold: 0.86 },
  frame: 3,
  maxDamage: 200,
});
