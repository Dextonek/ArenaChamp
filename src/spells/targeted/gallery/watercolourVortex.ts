import * as THREE from 'three';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Flecks, clamp01, easeOut, smooth } from '../../../heroes/sheath/partsBig';
import { Daubs, WaterFloor } from './g4Parts';

/**
 * Watercolour vortex (gallery 4, pipeline/designs/gallery-20.md). A circle of 3.5 m at the aim: wet pigment swirls into a
 * whirlpool on the floor; at 1.6 s everyone inside (live position) takes 40 and is dragged up to 4 m toward the centre (no knock);
 * the pull is followed by a bloom that runs out to the rim, and the wash dries into rings.
 * Answer: leave the circle, 3.5 m from the middle: 0.25 + 3.5 / 4 = 1.13 s; the zone shows 1.56 s.
 * On the blocks: a circle that lands at 0.3 + 1.3 s, a hit with `pull`, `from: 'centre'`.
 */
const WIND = 0.3;
const FUSE = 1.3;
const HIT = WIND + FUSE;
const RADIUS = 3.5;
const DURATION = 3.4;
const BEAT = HIT - 0.22; // the whirl stops, the pigment holds its breath
const BLOOM_AT = HIT + 0.22; // the pull is done, the colour opens

const COLORS = {
  dark: '#1a2a55', // prussian indigo
  accent: '#d03f83', // quinacridone magenta
  foil: '#f5efe2', // paper
  hot: '#ffd466', // cadmium yellow, one drop
};

/** The floor's turn at time t (radians): it speeds up, holds still at the beat, whips at the pull and settles. */
function swirlAt(t: number): number {
  const sp = (x: number) => 0.7 * x + 1.9 * x * x;
  if (t <= BEAT) return sp(t);
  const v = 0.7 + 3.8 * BEAT;
  const base = sp(BEAT) + v * 0.06 * (1 - Math.exp(-(Math.min(t, HIT) - BEAT) / 0.06));
  if (t <= HIT) return base;
  return base + 15 * 0.2 * (1 - Math.exp(-(t - HIT) / 0.2));
}

class VortexLook implements Look<null> {
  private floor = new WaterFloor(RADIUS, COLORS);
  private daubs = new Daubs(44, RADIUS, COLORS);
  private flecks = new Flecks(220, 0.24);
  private dark = new THREE.Color(COLORS.dark);
  private accent = new THREE.Color(COLORS.accent);
  private foil = new THREE.Color(COLORS.foil);
  private cx = 0;
  private cz = 0;
  private hit = false;
  private bloomed = false;

  constructor(group: THREE.Group) {
    group.add(this.floor.mesh, this.daubs.mesh, this.flecks.mesh);
  }

  reset() {
    this.hit = false;
    this.bloomed = false;
    this.floor.set(0, 0, 0, 0, 0, 0, 0);
    this.daubs.hide();
    this.flecks.clear();
  }

  cast(c: Cast<null>) {
    const p = c.centres[0];
    this.cx = p.x; this.cz = p.z;
    this.floor.mesh.position.set(p.x, 0.03, p.z);
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  impact(c: Cast<null>) {
    this.hit = true;
    c.shake = 0.18;
    // the pigment that was sucked in spits up from the middle
    this.flecks.burst(this.cx, 0.2, this.cz, 40, 2.4, 5.2, this.dark, 1.4, 8);
    this.flecks.burst(this.cx, 0.2, this.cz, 34, 3.0, 4.6, this.accent, 1.3, 8);
  }

  frame(c: Cast<null>, t: number) {
    const swirl = swirlAt(t);
    const build = easeOut(clamp01((t - 0.05) / 1.25));
    const beat = smooth((t - BEAT) / 0.1) * (1 - smooth((t - HIT) / 0.08));
    const bloom = t > BLOOM_AT ? 1 - Math.pow(1 - clamp01((t - BLOOM_AT) / 0.85), 3) : 0;
    const dry = smooth((t - 2.3) / 0.5);
    const alpha = smooth(t / 0.2) * (1 - smooth((t - 2.95) / 0.45));
    // the one hot drop: gathers in the middle at the beat, flashes with the pull, then is gone
    const core = (smooth((t - BEAT + 0.1) / 0.2) * 0.8) * (t < HIT ? 1 : 1 - smooth((t - HIT) / 0.25));
    this.floor.set(swirl, build, bloom, dry, alpha, core, beat);
    this.daubs.update(t, swirl, HIT, BLOOM_AT, 2.9, this.cx, this.cz);
    if (this.hit && !this.bloomed && t >= BLOOM_AT) {
      this.bloomed = true;
      c.shake = Math.max(c.shake, 0.12);
      // droplets thrown out with the front
      this.flecks.burst(this.cx, 0.25, this.cz, 30, 5.2, 2.2, this.foil, 1.1, 6);
      this.flecks.burst(this.cx, 0.25, this.cz, 20, 6.0, 2.0, this.accent, 1.0, 6);
    }
  }

  after(c: Cast<null>) {
    c.shake *= 0.86;
  }
}

export const watercolourVortexModule = spell<null>({
  label: 'watercolour vortex',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: WIND,
    delay: FUSE,
    shape: { kind: 'circle', radius: RADIUS, at: (c) => [{ x: c.ctx!.point.x, z: c.ctx!.point.z }] },
    hit: { damage: 40, knock: 0, color: '#d03f83', pull: 4, from: 'centre' },
  },
  look: VortexLook,
  noScreen: true,
  bloom: { enabled: true, strength: 0.3, radius: 0.4, threshold: 0.9 },
  frame: 8,
  maxDamage: 120,
});
