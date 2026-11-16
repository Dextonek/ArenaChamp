import * as THREE from 'three';
import { smoothstep, type Enemy } from '../../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx } from '../../../effects/parts';
import { BoltSet, type BoltLook } from '../../../effects/parts/bolt';
import type { Look } from '../../framework/blocks';
import { spell, type Cast } from '../../framework/spell';
import { SAND, SAND_CSS, Dust, SandHood } from '../parts';

/**
 * Cobra Spit (sand kit v5, Q: 9 m line skillshot). A gold-and-turquoise cobra of sand rears up in front of Sefu in 0.2 s (the
 * wind-up, 0.25 s) and on the strike spits a bolt of venom (20 m/s, radius 0.35) down the aim from his feet: it reaches 6 m at
 * 0.55 s, so a sidestep after the hood rises is enough. The first enemy it touches takes 62 damage and is blinded 1.2 s. A hit
 * on a Judged enemy halves what is left of this spell's cooldown: that is the trait (`../trait.ts`, `dealt` and `peerNote`).
 * The hit splashes in a turquoise star and a ground ring; the hood dissolves to grains.
 * Timeline: hood up 0-0.2, strike and release 0.25, flight to 0.7, clean by 1.4 s.
 *
 * On the spell blocks (docs/pipeline/hero-framework.md): a bolt with a status. The rules are the `rules` below; the look is
 * the old file's drawing code, told the moments.
 */

const HOOD_UP_T = 0.2;
const WIND_T = 0.25; // the strike: the venom leaves
const REACH = 9; // from his feet: the kit's range
const SPEED = 20;
const RADIUS = 0.35;
const HOOD_AHEAD = 0.9; // the cobra stands this far in front of him

const LOOK: BoltLook = { core: '#e8fffc', body: SAND_CSS.accent, rim: SAND_CSS.dark, size: 0.32, trail: 3.2, hit: SAND_CSS.accent };

class CobraLook implements Look<null, 'blind'> {
  readonly screen = createScreenFx();
  private hoodBase = new THREE.Vector3();
  private hoodYaw = 0;
  private hitAt = -1;
  private hitPos = new THREE.Vector3();

  // Made in the constructor, in the old file's order (the bolts' set needs the group).
  private hood: SandHood;
  private bolts: BoltSet;
  private dust: Dust;
  private pop: StarBurst;
  private spit: StarBurst;
  private groundShock: ShockRefraction;

  private v1 = new THREE.Vector3();

  constructor(group: THREE.Group) {
    this.hood = new SandHood();
    this.bolts = new BoltSet(group);
    this.dust = new Dust(8, 20);
    this.pop = new StarBurst({ points: 10, inner: 0.3, color: SAND.accent, core: 0xe8fffc, additive: false });
    this.spit = new StarBurst({ points: 6, inner: 0.25, color: SAND.hot, core: SAND.core, additive: false });
    this.groundShock = new ShockRefraction({ facing: 'ground' });
    this.screen.impactColor.set(SAND.stone);
    this.hood.width = 1.7;
    this.hood.height = 2.3;
    this.dust.life = 0.5;
    group.add(this.hood.mesh, this.dust.mesh, this.pop.mesh, this.spit.mesh, this.groundShock.mesh);
  }

  cast(c: Cast<null, 'blind'>) {
    const ctx = c.ctx!;
    this.hoodBase.copy(c.from).addScaledVector(c.dir, HOOD_AHEAD);
    this.hoodYaw = Math.atan2(-c.dir.x, -c.dir.z); // the hood faces the camera side, as the quicksand cobra does
    this.hood.place(this.hoodBase, this.hoodYaw);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(c.from).addScaledVector(c.dir, REACH * 0.5).setY(1);
  }

  reset() {
    this.hitAt = -1;
    clearScreenFx(this.screen);
    this.hood.reset();
    this.hood.place(this.hoodBase, this.hoodYaw);
    this.bolts.clear();
    this.dust.reset();
    this.pop.set(this.hitPos, 0, 0);
    this.spit.set(this.hitPos, 0, 0);
    this.groundShock.set(this.hitPos, 0, 0);
  }

  tick(dt: number) {
    this.dust.update(dt);
    this.bolts.update(dt);
  }

  /** The strike: a jolt and a puff at the hood, before the venom leaves. */
  releasing(c: Cast<null, 'blind'>) {
    c.shake = 0.1;
    this.dust.puff(this.v1.copy(this.hoodBase).setY(0.3), 0.6);
  }

  released(c: Cast<null, 'blind'>) {
    if (c.bolt) this.bolts.follow(c.bolt, LOOK);
  }

  /** The hit splashes on the enemy; a miss ends in a small splash where the venom died. */
  stopped(c: Cast<null, 'blind'>, x: number, z: number, who: Enemy | null) {
    if (who) {
      const feet = who.group.position;
      this.hitAt = c.time;
      this.hitPos.set(feet.x, 1.2, feet.z);
      this.dust.puff(this.v1.set(x, 0.4, z), 0.6);
      this.dust.fall(this.v1.set(feet.x, 0, feet.z), 0.6, 6, 1.8, 0.6);
    } else if (c.bolt) this.dust.puff(this.v1.copy(c.bolt.pos).setY(0.3), 0.5);
  }

  /** The cobra rears (overshooting a little), strikes on the release, then dissolves to grains. */
  frame(c: Cast<null, 'blind'>, t: number) {
    const rear = smoothstep(t / HOOD_UP_T);
    const strike = t < WIND_T ? 0 : Math.max(0, 1 - (t - WIND_T) / 0.18);
    const erode = smoothstep((t - WIND_T - 0.05) / 0.3);
    this.hood.set(rear * (1 + 0.08 * Math.sin(rear * Math.PI)), strike, 0.92 * (1 - smoothstep((t - WIND_T - 0.25) / 0.2)), erode, t);
    const sp = StarBurst.pop(t - WIND_T, 0, 0.05);
    this.v1.copy(c.from).addScaledVector(c.dir, HOOD_AHEAD + 0.5).setY(1.6);
    this.spit.set(this.v1, 0.8 * sp.scale + 1e-3, sp.opacity, t * 3);

    if (this.hitAt >= 0) {
      const a = t - this.hitAt;
      const hp = StarBurst.pop(a, 0.02, 0.06);
      this.pop.set(this.hitPos, 1.1 * hp.scale + 1e-3, hp.opacity, 0.3);
      const g = THREE.MathUtils.clamp(a / 0.3, 0, 1);
      this.groundShock.set(this.v1.set(this.hitPos.x, 0, this.hitPos.z), 0.4 + 1.6 * g, 0.03 * (1 - g) * (1 - g));
      c.shake = Math.max(c.shake * 0.9, 0.14 * Math.exp(-a * 14));
    } else c.shake *= 0.9;
  }
}

export const cobraSpitModule = spell<null, 'blind'>({
  label: 'cobra spit',
  category: 'hero: sand',
  // A skillshot: the aim point only gives the direction (the venom flies its 9 m wherever the cursor is).
  targeting: { mode: 'ground', radius: RADIUS },
  seconds: 1.4,
  state: () => null,
  rules: {
    windup: WIND_T,
    shape: { kind: 'bolt', speed: SPEED, range: REACH, radius: RADIUS },
    hit: { damage: 62, knock: 1, color: SAND_CSS.body, status: { kind: 'blind', seconds: 'blind' } },
    warn: 0.02,
  },
  // Blind seconds on the hit (engine cap 2).
  tune: { blind: [1.2, 0, 2, 0.1] },
  look: CobraLook,
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frame: 2,
  maxDamage: 150,
});
