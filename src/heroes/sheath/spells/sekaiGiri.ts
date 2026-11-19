import * as THREE from 'three';
import { StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt } from '../../../effects/parts';
import type { Look } from '../../framework/blocks';
import { spell, type Cast } from '../../framework/spell';
import { C, R } from '../numbers';
import { CutLine, Flecks, Shards, Tear, easeOut, hash, smooth } from '../partsBig';

/**
 * Sekai-giri, World Sever (Kagen's R, the ultimate). He draws one cut along a 12 m line from his feet (2.4 m wide); the line
 * is drawn on the floor and he stands still for 1.3 s (the world going grey round it is the look only: nobody else is held).
 * Then it tears open all along at once: 110 to everyone on the line (live position), once. At the same moment the passive
 * opens every cut mark on the enemy wherever they stand, at 36 each (`victimTick`, on the screen that decides the enemy's
 * hits, told by `show('sever')` from `afterCast`).
 * Answer: leave the line, 1.2 m to its edge: 0.25 + 1.2 / 4 = 0.55 s; it shows 1.3 s. The ultimate never lands when cast.
 * On the blocks: a lane whose front is the whole line at once, no move.
 */

const GO = R.windup;
const DRAW = 0.9; // the brush reaches the far end
const DURATION = GO + 1.2;
const SHARDS = 72;

/**
 * The look (ported from the tool page's 'world sever': an iaido draw, a still moment, the world splits). 0-1.3: a fine
 * rice-paper line with cinnabar edges is drawn along the floor from his feet to the end of the lane (the engine's danger zone
 * lies under it), the world drains to grey (the screen keeps only cinnabar) and darkens round it, a slow pulse and a light
 * travel the line, his blade glints. The last 0.2 s is the dead beat: the pulse stops, the line thins to a hair, the grey is
 * deepest. At 1.3: one impact frame (black, cinnabar figures), the colour returns, the line tears open as a burning almond
 * along its whole length at once (black ink, a cinnabar lip with a hair of paper, ragged), a strip of steel light runs out
 * of it, shards of the floor drift up from the slit with cinnabar embers, a shake. It seals from 0.55 s after, gone by 2.4 s.
 * The marks that open on the enemy are the passive's (no look of their own here).
 */
class SeverLook implements Look<null> {
  readonly screen = createScreenFx();
  private cut = new CutLine(R.range, R.width);
  private tear = new Tear(R.range, 1.05);
  private shards = new Shards(SHARDS);
  private embers = new Flecks(260, 0.22);
  private glint = new StarBurst({ points: 4, inner: 0.16, color: C.foil, core: C.steel });
  private paper = new THREE.Color(C.foil);
  private cin = new THREE.Color(C.accent);
  private v = new THREE.Vector3();
  private tore = false;

  constructor(group: THREE.Group) {
    this.screen.impactColor.set(C.accent);
    this.screen.edgeTint.set(C.accent);
    this.screen.keepHue.set(C.accent);
    this.screen.speedLineColor.set(C.accent);
    this.screen.tint.set('#8d8e92');
    group.add(this.cut.group, this.tear.group, this.shards.mesh, this.embers.mesh, this.glint.mesh);
  }

  reset() {
    this.tore = false;
    clearScreenFx(this.screen);
    this.cut.set(0, 0, 0, 0, 0, 0);
    this.tear.set(0, 0, 0, 0, 0);
    this.shards.hide();
    this.embers.clear();
    this.glint.set(this.v.set(0, 0, 0), 1e-3, 0);
  }

  /** The figures an impact frame cuts out: him and everyone in the fight. */
  cast(c: Cast<null>) {
    const ctx = c.ctx!;
    this.screen.silhouettes = [ctx.caster.group, ...(ctx.enemies?.() ?? ctx.targets).map((e) => e.group)];
    this.screen.focus.copy(c.from).addScaledVector(c.dir, R.range * 0.5).setY(0.5);
  }

  tick(dt: number) {
    this.embers.update(dt);
  }

  idle(dt: number) {
    this.embers.update(dt);
  }

  frame(c: Cast<null>, t: number) {
    const from = c.from, dir = c.dir;
    this.cut.place(from.x, from.z, dir.x, dir.z);
    this.tear.place(from.x, from.z, dir.x, dir.z, R.range);
    const a = t - GO;
    const fx = this.screen;

    if (a < 0) {
      // the cut is drawn, the world drains round it, a slow pulse; the last 0.2 s is the dead beat
      const hush = smooth((t - (GO - 0.2)) / 0.12);
      const pulse = (0.5 + 0.5 * Math.sin(t * Math.PI * 1.7 - 1)) * smooth(t / 0.7) * (1 - hush);
      this.cut.set(t, easeOut(t / DRAW) * 1.04, 1, pulse, hush, 0.3 * smooth(t / 0.9));
      fx.desaturate = 0.92 * smooth(t / 1.0);
      fx.darken = 0.34 * smooth(t / 1.0) + 0.2 * hush;
      // his blade's glint: a slow flicker, and a hard one at the beat
      const g = 0.35 + 0.65 * Math.max(0, Math.sin(t * 5.2)) ** 3;
      const beat = hush > 0 ? 1.2 * hush : 0;
      this.glint.set(this.v.copy(from).addScaledVector(dir, 0.75).setY(1.15), (0.28 + 0.7 * beat) * smooth(t / 0.4) * (0.6 + 0.4 * g), 0.5 * smooth(t / 0.4) * (0.6 + 0.4 * g) + 0.5 * beat, t * 2);
      fx.impact = 0;
      fx.chroma = 0;
      return;
    }

    // the tear
    if (!this.tore) {
      this.tore = true;
      c.shake = 0.5;
      // embers along the slit, thrown up and left to fall
      for (let k = 0; k < 18; k++) {
        const u = (k + hash(k * 3.1)) / 18 * R.range;
        this.embers.burst(from.x + dir.x * u, 0.1, from.z + dir.z * u, 5, 1.6, 3.4, k % 3 === 0 ? this.paper : this.cin, 1.3, 3);
      }
    }
    const open = a < 0.55 ? easeOut(a / 0.12) : 1 - smooth((a - 0.55) / 0.5);
    const fade = 1 - smooth((a - 0.8) / 0.3);
    const q = Math.min(1, a / 0.32);
    this.tear.set(t, open, fade, 0.12 + 1.5 * easeOut(q), 0.42 * (1 - q) * (1 - q));
    this.cut.set(t, 1, 1 - smooth(a / 0.12), 0, 1, 0.3 * (1 - smooth(a / 0.5)));
    this.shards.update(a, from.x, from.z, dir.x, dir.z, R.range);
    // one impact frame, the colour returns, the grey lets go
    fx.impact = impactFrameAt(t, GO, [1], 0.05);
    fx.chroma = chromaPulse(t, GO, 0.5, 9);
    fx.desaturate = 0.92 * (1 - smooth(a / 0.35));
    fx.darken = 0.4 * (1 - smooth(a / 0.7));
    const p = StarBurst.pop(a, 0.04, 0.14);
    this.glint.set(this.v.copy(from).addScaledVector(dir, 0.75).setY(1.15), 1.6 * p.scale + 1e-3, p.opacity, 0.4);
  }

  after(c: Cast<null>) {
    c.shake *= 0.88;
  }
}

export const sekaiGiriModule = spell<null>({
  label: 'sekai giri',
  category: 'hero: sheath',
  targeting: { mode: 'ground', radius: R.width / 2 },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: R.windup,
    shape: { kind: 'lane', length: R.range, width: R.width, late: 0.08, front: () => R.range },
    hit: { damage: R.damage, knock: R.knock, color: C.accent },
  },
  look: SeverLook,
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.84 },
  frame: 7,
  maxDamage: 250,
});
