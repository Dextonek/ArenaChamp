import * as THREE from 'three';
import { StarBurst, clearScreenFx, createScreenFx } from '../../../effects/parts';
import type { Look } from '../../framework/blocks';
import { spell, type Cast } from '../../framework/spell';
import { C, Q } from '../numbers';
import { Blade, CINNABAR, INK, Flecks, PAPER, STEEL, clamp01, easeOut, flatRing, hash } from '../parts';

/**
 * Issen, One Flash (Kagen's Q). A thin line shows down the aim for 0.45 s (6 m by 1.2 m), then he crosses it in 0.15 s and
 * stands at its end (or where a wall or the ring stops him). Everyone the cut's front passes inside the lane, on their live
 * position, takes 32 once, and the passive leaves a cut mark on them (`dealt`, slot 0).
 * Answer: step off the line, 0.6 m to its edge: 0.25 + 0.6 / 4 = 0.40 s; it warns 0.45 s.
 * On the blocks: a lane with a move at the release, as Anka's Firebird.
 *
 * The look (the danger zone is the engine's, from the rules; this is his own, all inside the lane's 1.2 m). 0-0.45 the draw:
 * a fine rice-paper line with a cinnabar edge is laid down the aim from his feet; a ring of cinnabar light closes in on his
 * feet (the low crouch); a glint of steel runs down his blade, from behind him to the aim, in the last 0.2 s. 0.45 the flash:
 * one frame of impact (small, black with him in steel), a hot white-steel streak lies along the lane as the front runs over it
 * and its tail catches up, a wider cinnabar burn on the floor under it, a glint where he lands. 0.6-1.0 the after-line: a thin
 * cinnabar line hangs where the cut was, then splits like a cut opening, the two lips drawing apart over a pale gap and fading;
 * rice-paper flecks lift along it. Clean by about 1.2 s.
 */
const GO_T = Q.windup;
const END_T = GO_T + Q.seconds;
const SPLIT_T = END_T + 0.4;
const DONE_T = 1.25;
const FLECKS = 18;
// the look only
const LINE_Y = 0.06;

class IssenLook implements Look<null> {
  readonly screen = createScreenFx();
  private ink = new Blade(INK, false, 3);
  private guide = new Blade(PAPER, false, 4);
  private edge = new Blade(CINNABAR, false, 3);
  private streak = new Blade(STEEL, true, 7);
  private burn = new Blade(CINNABAR, false, 3);
  private lipA = new Blade(CINNABAR, false, 5);
  private lipB = new Blade(CINNABAR, false, 5);
  private gap = new Blade(PAPER, false, 4);
  private crouch = flatRing(CINNABAR, 0.05, false, 4);
  private glint = new StarBurst({ points: 4, inner: 0.16, color: PAPER, core: STEEL, additive: false });
  private endGlint = new StarBurst({ points: 6, inner: 0.2, color: STEEL, core: STEEL, additive: false });
  private flecks = new Flecks(FLECKS);
  private flecked = false;
  private v1 = new THREE.Vector3();

  constructor(group: THREE.Group) {
    this.screen.impactColor.set(C.steel);
    this.screen.edgeTint.set(C.accent);
    group.add(
      this.burn.mesh, this.ink.mesh, this.edge.mesh, this.guide.mesh, this.gap.mesh, this.lipA.mesh, this.lipB.mesh, this.streak.mesh,
      this.crouch.mesh, this.glint.mesh, this.endGlint.mesh, this.flecks.group,
    );
  }

  reset(c: Cast<null>) {
    clearScreenFx(this.screen);
    for (const b of [this.guide, this.ink, this.edge, this.streak, this.burn, this.lipA, this.lipB, this.gap]) b.hide();
    this.crouch.mesh.visible = false;
    this.glint.set(c.from, 0, 0);
    this.endGlint.set(c.from, 0, 0);
    this.flecks.reset();
    this.flecked = false;
  }

  cast(c: Cast<null>) {
    const ctx = c.ctx!;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(c.from).setY(1.2);
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  released(c: Cast<null>) {
    c.shake = 0.25;
  }

  frame(c: Cast<null>, t: number) {
    const from = c.from, dir = c.dir, reach = c.reach;
    if (t < GO_T) {
      // The draw: the fine line is laid out from his feet, the crouch of light closes in, the glint runs down the blade.
      const lay = easeOut(t / 0.28), k = t / GO_T;
      this.guide.set(from, dir, 0.3, 0.3 + (reach - 0.3) * lay, 0.08, LINE_Y + 0.02, 0.55 + 0.45 * k);
      this.ink.set(from, dir, 0.3, 0.3 + (reach - 0.3) * lay, 0.16, LINE_Y + 0.01, 0.35 + 0.4 * k);
      this.edge.set(from, dir, 0.3, 0.3 + (reach - 0.3) * lay, 0.3, LINE_Y, 0.25 + 0.5 * k);
      const r = 1.0 - 0.55 * easeOut(k);
      this.crouch.mesh.visible = true;
      this.crouch.mesh.position.set(from.x, 0.05, from.z);
      this.crouch.mesh.scale.setScalar(r);
      this.crouch.material.opacity = 0.2 + 0.6 * k;
      const g = clamp01((t - 0.22) / 0.2);
      const gp = StarBurst.pop(g, 0.04, 0.5);
      this.glint.set(this.v1.copy(from).addScaledVector(dir, -0.15 + 1.2 * g).setY(1.0), (0.12 + 0.2 * Math.sin(Math.PI * g)) * (g > 0 && g < 1 ? 1 : 0.01), g > 0 && g < 1 ? gp.opacity : 0, g * 6);
      return;
    }
    // The flash: the front runs over the lane; the streak's tail follows it in.
    const a = t - GO_T;
    const front = c.front(t);
    this.glint.set(from, 0, 0);
    this.crouch.mesh.visible = a < 0.1;
    this.crouch.material.opacity = 0.8 * Math.max(0, 1 - a / 0.1);
    const tail = reach * clamp01((t - GO_T - 0.08) / 0.24) ** 1.5;
    this.streak.set(from, dir, tail, Math.min(front, reach), 0.55 * (1 - 0.5 * clamp01(a / 0.3)), 0.85, a < 0.32 ? 1 - clamp01((a - 0.14) / 0.18) : 0);
    this.burn.set(from, dir, 0, Math.min(front, reach), 0.9, LINE_Y, 0.6 * (1 - clamp01(a / 0.32)));
    // the line fades into the cut
    const gl = 1 - clamp01(a / 0.12);
    this.guide.set(from, dir, 0.3, reach, 0.08, LINE_Y + 0.02, 0.9 * gl);
    this.ink.set(from, dir, 0.3, reach, 0.16, LINE_Y + 0.01, 0.6 * gl);
    this.edge.set(from, dir, 0.3, reach, 0.3, LINE_Y, 0.75 * gl);
    // the glint where he lands
    const lp = StarBurst.pop(a - 0.1, 0.05, 0.16);
    this.endGlint.set(this.v1.copy(from).addScaledVector(dir, reach).setY(0.9), 1.1 * lp.scale + 1e-3, lp.opacity, a * 4);
    // the flecks lift along the lane when the front has passed
    if (!this.flecked && a >= 0.05) {
      this.flecked = true;
      for (let i = 0; i < FLECKS; i++) {
        const along = 0.4 + (reach - 0.6) * ((i + hash(i + 1)) / FLECKS);
        const side = (hash(i + 20) - 0.5) * 0.7;
        this.v1.copy(from).addScaledVector(dir, along);
        this.v1.x -= dir.z * side;
        this.v1.z += dir.x * side;
        this.v1.y = 0.5 + hash(i + 40) * 0.7;
        this.flecks.put(this.v1, -dir.z * (side < 0 ? -1 : 1) + dir.x * 0.3, dir.x * (side < 0 ? -1 : 1) + dir.z * 0.3, 1.2 + 1.6 * hash(i + 60), 0.5 + 1.2 * hash(i + 80), 0.7 + 0.35 * hash(i + 100), i);
      }
    }
    // The after-line: thin cinnabar, hanging, then splitting open over a pale gap while it fades.
    if (t >= END_T) {
      const hang = clamp01((t - END_T) / 0.08);
      const open = easeOut((t - SPLIT_T) / 0.35);
      const fade = 1 - clamp01((t - SPLIT_T - 0.12) / 0.3);
      const w = 0.07 * (1 - 0.5 * open);
      const off = 0.02 + 0.22 * open;
      const y = 0.55 - 0.1 * open;
      this.lipA.set(from, dir, 0.2, reach + 0.1, w, y, 0.95 * hang * fade, off);
      this.lipB.set(from, dir, 0.2, reach + 0.1, w, y, 0.95 * hang * fade, -off);
      this.gap.set(from, dir, 0.3, reach, 0.5 * open * off * 2, y - 0.02, 0.55 * open * fade);
    }
  }

  after(c: Cast<null>, t: number) {
    // No full-screen frame (the ultimate's only): a pulse at the screen's edges.
    this.screen.chroma = t >= GO_T ? 0.5 * Math.exp(-(t - GO_T) * 14) : 0;
    c.shake *= 0.85;
    if (t >= DONE_T) {
      for (const b of [this.guide, this.ink, this.edge, this.streak, this.burn, this.lipA, this.lipB, this.gap]) b.hide();
    }
  }

  struck(c: Cast<null>) {
    c.shake = 0.4;
  }
}

export const issenModule = spell<null>({
  label: 'issen',
  category: 'hero: sheath',
  targeting: { mode: 'ground', radius: Q.width / 2 },
  seconds: Q.windup + Q.seconds + 0.8,
  state: () => null,
  rules: {
    windup: Q.windup,
    shape: { kind: 'lane', length: Q.range, width: Q.width, late: 0.05 },
    hit: { damage: Q.damage, knock: Q.knock, color: C.accent },
    move: { at: 'release', to: 'end', seconds: Q.seconds },
  },
  look: IssenLook,
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frame: 4,
  maxDamage: 120,
});
