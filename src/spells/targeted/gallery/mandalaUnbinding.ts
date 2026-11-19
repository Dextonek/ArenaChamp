import * as THREE from 'three';
import { ShockRefraction, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt } from '../../../effects/parts';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Flecks, clamp01, easeOut, smooth } from '../../../heroes/sheath/partsBig';
import { MANDALA_R, RING_MID, SAND, SandMandala, SandWind, Vortex, sandAt } from './g3Parts';

/**
 * Mandala Unbinding (gallery 5, Tibetan sand mandala). A circle of 4 m at the aim, shown as the danger zone from the cast. After
 * 1.75 s the mandala is swept away and everyone inside the circle at that moment (live positions) takes 120 and is knocked out
 * from the centre, once. Answer: leave the circle: it shows 1.7 s, the rule 0.25 + 4 / 4 = 1.25 s.
 * On the blocks: a circle that lands after a long fuse (windup 0.3 + delay 1.45).
 *
 * The look. 0.1-1.45: the mandala is laid ring by ring in coloured sand, from the middle out: a star of white sand, vermilion with
 * white dots, lapis with saffron gates, sixteen petals, a chain of diamonds, a ring of flames, a white rim; a bright point of sand
 * runs round each ring as it is laid and grains fall from a pinch of fingers above it. 1.45-1.75 the dead beat: the picture is
 * whole and lit, the world darkens round it, a pale glint at the centre, nothing else moves. 1.75: one dark impact frame (the
 * figures in saffron), the pattern is wound into a spiral and wiped from the middle out while two arms of wind rise in a funnel
 * and the sand goes up with it in a spiral; a refraction ring, a shake. The grains are gone by 3.1.
 */

const GO = 0.3;
const DELAY = 1.45;
const IMPACT = GO + DELAY;
const LAY0 = 0.1;
const LAY1 = 1.45;
const SWEEP_T = 0.9;
const DURATION = 3.1;
const GRAINS = 700;
const DAMAGE = 120;

class MandalaLook implements Look<null> {
  readonly screen = createScreenFx();
  private floor = new SandMandala();
  private wind = new SandWind(GRAINS, 0.17);
  private vortex = new Vortex();
  private pour = new Flecks(160, 0.13);
  private shock = new ShockRefraction({ facing: 'ground' });
  private glint = new StarBurst({ points: 4, inner: 0.16, color: SAND.saffron, core: SAND.hot, additive: false });
  private pop = new StarBurst({ points: 8, inner: 0.3, color: SAND.saffron, core: SAND.white, additive: false });
  private cx = 0;
  private cz = 0;
  private v = new THREE.Vector3();
  private col = new THREE.Color();
  private swept = false;
  private poured = 0;

  constructor(group: THREE.Group) {
    this.screen.impactColor.set(SAND.saffron);
    this.screen.edgeTint.set(SAND.saffron);
    this.screen.speedLineColor.set(SAND.saffron);
    this.screen.tint.set('#2a2c4a');
    group.add(this.floor.mesh, this.wind.mesh, this.vortex.mesh, this.pour.mesh, this.shock.mesh, this.glint.mesh, this.pop.mesh);
  }

  reset() {
    this.swept = false;
    this.poured = 0;
    clearScreenFx(this.screen);
    this.floor.set(this.cx, this.cz, 0, 0, 0, 0, 0);
    this.wind.hide();
    this.vortex.set(this.cx, this.cz, 0, 0, 0);
    this.pour.clear();
    this.shock.set(this.v.set(this.cx, 0, this.cz), 0, 0);
    this.glint.set(this.v.set(0, 0, 0), 1e-3, 0);
    this.pop.set(this.v.set(0, 0, 0), 1e-3, 0);
  }

  /** The figures an impact frame cuts out: the caster and everyone in the fight. */
  cast(c: Cast<null>) {
    const ctx = c.ctx!;
    this.cx = c.centres[0].x;
    this.cz = c.centres[0].z;
    this.screen.silhouettes = [ctx.caster.group, ...(ctx.enemies?.() ?? ctx.targets).map((e) => e.group)];
    this.screen.focus.set(this.cx, 0.5, this.cz);
  }

  tick(dt: number) {
    this.pour.update(dt);
  }

  idle(dt: number) {
    this.pour.update(dt);
  }

  frame(c: Cast<null>, t: number) {
    const x = this.cx, z = this.cz, fx = this.screen;
    if (t < IMPACT) {
      // the rings are laid, middle out: `lay` runs 0..7 over the build
      const lay = 7 * smooth((t - LAY0) / (LAY1 - LAY0)) ;
      const beat = smooth((t - (LAY1 + 0.02)) / 0.12);
      this.floor.set(x, z, lay, 0, smooth((t - LAY0) / 0.15), 0.04 * beat, t);
      // the point of sand at the front of the ring being laid, and the grains falling from it
      const k = Math.min(6, Math.floor(lay));
      const part = lay - k;
      if (lay > 0.01 && lay < 6.995) {
        const ang = -(part - 0.25) * Math.PI * 2;
        const px = x + Math.cos(ang) * RING_MID[k], pz = z + Math.sin(ang) * RING_MID[k];
        this.v.set(px, 0.12, pz);
        this.glint.set(this.v, 0.5 + 0.12 * Math.sin(t * 40), 0.9, t * 3);
        const want = Math.floor((t - LAY0) * 70);
        for (; this.poured < want; this.poured++) {
          this.col.set(sandAt(RING_MID[k], this.poured));
          this.pour.burst(px, 0.75, pz, 1, 0.35, 0.1, this.col, 0.5, 5);
        }
      } else {
        // the dead beat: a pale glint at the centre, nothing else moves
        const g = smooth((t - LAY1 - 0.02) / 0.15);
        this.glint.set(this.v.set(x, 0.35, z), (0.35 + 0.5 * g) * g + 1e-3, 0.9 * g, 0.2);
      }
      fx.darken = 0.34 * smooth(t / 0.9) + 0.14 * beat;
      fx.impact = 0;
      fx.chroma = 0;
      return;
    }

    const a = t - IMPACT;
    const s = clamp01(a / SWEEP_T);
    if (!this.swept) {
      this.swept = true;
      c.shake = 0.55;
    }
    // one dark impact frame, a chroma pulse, the world's light returns
    fx.impact = impactFrameAt(t, IMPACT, [1], 0.05);
    fx.chroma = chromaPulse(t, IMPACT, 0.45, 9);
    fx.darken = 0.46 * (1 - smooth(a / 0.9));
    this.floor.set(x, z, 7, s, 1 - smooth((a - 0.75) / 0.25), 0.3 * (1 - s), t);
    this.wind.update(a, x, z);
    const grow = easeOut(a / 0.7);
    this.vortex.set(x, z, grow, 0.9 * (1 - smooth((a - 0.5) / 0.7)), a);
    const q = easeOut(a / 0.5);
    this.shock.set(this.v.set(x, 0, z), 0.8 + (MANDALA_R + 0.8) * q, 0.06 * (1 - q) * (1 - q));
    const p = StarBurst.pop(a, 0.04, 0.16);
    this.pop.set(this.v.set(x, 0.8, z), 2.6 * p.scale + 1e-3, p.opacity, a * 3);
    this.glint.set(this.v.set(x, 0.35, z), 1e-3, 0);
  }

  after(c: Cast<null>) {
    c.shake *= 0.88;
  }
}

export const mandalaUnbindingModule = spell<null>({
  label: 'mandala unbinding',
  category: 'targeted',
  targeting: { mode: 'ground', radius: MANDALA_R },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: GO,
    delay: DELAY,
    shape: { kind: 'circle', radius: MANDALA_R, at: (c) => [{ x: c.ctx!.point.x, z: c.ctx!.point.z }] },
    hit: { damage: DAMAGE, knock: 5, color: SAND.saffron },
    warn: 0.04,
  },
  look: MandalaLook,
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.92 },
  frame: 11,
  maxDamage: 200,
});
