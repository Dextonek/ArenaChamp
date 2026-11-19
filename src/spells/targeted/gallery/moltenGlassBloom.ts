import * as THREE from 'three';
import { StarBurst, chromaPulse, clearScreenFx, createScreenFx } from '../../../effects/parts';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Flecks } from '../../../heroes/sheath/partsBig';
import { FloorGlow, FloorScorch, GlassBloom, GlassGob, easeOut, hash, smooth } from './g6Parts';

/**
 * Molten Glass Bloom (gallery group 6, #7; Glassblowing: orange-hot glass cooling to clear blue-green, soot). A cone in front of
 * the caster, 6.2 m long and 66 degrees, judged once at 1.2 s: everyone inside is hit (48). Answer: step out of the cone, at most
 * 3 m sideways at its far end: 0.25 + 3 / 4 = 1.0 s; it shows 1.2 s.
 * On the blocks: a zone (a cone), no move.
 *
 * The look. 0-0.9 a gob of molten glass hangs on a blowpipe in front of him, a lumpy ball with a small hot core, a dark sooty
 * rim, an orange pool of light on the floor; he blows it up in three puffs, embers rise, the screen darkens a little. 0.9-1.2 the
 * dead beat: the wobble stops, the glass dims, the pipe holds still. 1.2 the hit: the gob is blown to a ball and bursts into
 * 21 petals of glass in three layers that open over the cone, hot orange at the base; soot and sparks, a small shake, a gold
 * star. They cool from the tips, orange to dark red to clear blue-green with bright edges (a scorched cone of soot with frost
 * speckle lies under them), crack with a white flash at 1.9-2.1 s and burst into shards that fly, bounce, glint and settle as
 * pale chips, gone by 3.2 s.
 */

const RANGE = 6.2;
const ANGLE = 66;
const HALF = (ANGLE / 2) * Math.PI / 180;
const WIND = 1.2;
const DURATION = 3.4;
const PIV = 1.2; // the gob's distance in front of him
const HEIGHT = 1.0;

class GlassLook implements Look<null> {
  readonly screen = createScreenFx();
  private gob = new GlassGob();
  private bloom = new GlassBloom(RANGE, HALF);
  private scorch = new FloorScorch(RANGE, HALF);
  private glow = new FloorGlow('#ff7a1c');
  private flecks = new Flecks(300, 0.2);
  private star = new StarBurst({ points: 8, inner: 0.2, color: '#ffc27a', core: '#fff1d0', additive: false });
  private orange = new THREE.Color('#ff8a24');
  private soot = new THREE.Color('#2a2624');
  private pale = new THREE.Color('#c8fff4');
  private at = new THREE.Vector3();
  private v = new THREE.Vector3();
  private hit = false;
  private cracked = false;
  private ember = -1;

  constructor(group: THREE.Group) {
    this.screen.impactColor.set('#ff8a24');
    this.screen.edgeTint.set('#ff7a1c');
    this.screen.tint.set('#3a2c26');
    group.add(this.scorch.mesh, this.glow.mesh, this.gob.group, this.bloom.petals, this.bloom.shards, this.flecks.mesh, this.star.mesh);
  }

  reset() {
    this.hit = false;
    this.cracked = false;
    this.ember = -1;
    clearScreenFx(this.screen);
    this.gob.hide();
    this.bloom.hide();
    this.scorch.set(0, 0, 0);
    this.glow.set(0, 0, 0, 0);
    this.flecks.clear();
    this.star.set(this.v.set(0, 0, 0), 1e-3, 0);
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  frame(c: Cast<null>, t: number) {
    const from = c.from, dir = c.dir, fx = this.screen;
    this.at.copy(from).addScaledVector(dir, PIV).setY(HEIGHT);
    this.scorch.place(from.x, from.z, c.yaw);

    if (t < WIND) {
      // he draws the glass and blows it up in three puffs; the last 0.3 s is the dead beat
      const hush = smooth((t - (WIND - 0.3)) / 0.12);
      const grow = smooth(t / 0.9);
      let puff = 0;
      for (let k = 0; k < 3; k++) { const d = (t - (0.28 + 0.22 * k)) / 0.08; puff += Math.exp(-d * d); }
      const radius = (0.13 + 0.24 * grow + 0.05 * puff) * smooth(t / 0.2) * (1 - 0.12 * hush);
      this.gob.set(from, dir, this.at, radius + 1e-3, (0.95 + 0.05 * puff) * (1 - 0.4 * hush), 1 - hush, t, smooth(t / 0.25));
      this.glow.set(this.at.x, this.at.z, 0.9 + 0.7 * grow, 0.3 * smooth(t / 0.5) * (1 - 0.65 * hush));
      // embers rise off the hot glass
      const e = Math.floor(t * 12);
      if (e !== this.ember && hush < 0.5 && t > 0.1) {
        this.ember = e;
        this.flecks.burst(this.at.x, this.at.y, this.at.z, 1, 0.5, 0.9, this.orange, 0.9, -0.8);
      }
      const gl = 0.5 + 0.5 * Math.sin(t * 9);
      this.star.set(this.v.copy(this.at).setY(HEIGHT + 0.02), (0.18 + 0.2 * grow) * (0.7 + 0.3 * gl) * (1 - hush) + 1e-3, 0.55 * smooth(t / 0.4) * (1 - hush), t * 1.5);
      fx.darken = 0.26 * smooth(t / 0.8);
      fx.chroma = 0;
      return;
    }

    const a = t - WIND;
    if (!this.hit) {
      this.hit = true;
      c.shake = 0.28;
      // sparks and soot thrown from the burst
      this.flecks.burst(this.at.x, this.at.y, this.at.z, 40, 5.5, 3.2, this.orange, 1.1, 6);
      this.flecks.burst(this.at.x, this.at.y, this.at.z, 22, 3.2, 2.0, this.soot, 1.5, 3);
    }
    // the gob is blown up and is gone as the petals sprout
    const blow = easeOut(a / 0.1);
    this.gob.set(from, dir, this.at, a < 0.12 ? 0.37 + 0.55 * blow : 0, 1, 1, t, a < 0.12 ? 1 - smooth(a / 0.12) : 0);
    this.bloom.update(a, this.at.x, this.at.y, this.at.z, c.yaw);
    // the floor: soot lands, frost forms as the glass cools, a hot rim at the hit
    const hot = Math.exp(-a * 5);
    this.scorch.set(0.85 * smooth(a / 0.5) * (1 - smooth((a - 1.5) / 0.6)), 0.9 * smooth((a - 0.45) / 0.4) * (1 - smooth((a - 1.5) / 0.6)), hot);
    this.glow.set(this.at.x + dir.x * 1.2, this.at.z + dir.z * 1.2, 2.4, 0.22 * Math.exp(-a * 2.5));
    // the petals crack: pale flecks along the cone
    if (!this.cracked && a >= 0.82) {
      this.cracked = true;
      for (let k = 0; k < 14; k++) {
        const u = 1.6 + (RANGE - 2) * hash(k * 3.1 + 1), b = (hash(k * 5.3 + 2) * 2 - 1) * HALF * 0.9, yy = c.yaw + b;
        this.flecks.burst(from.x + Math.sin(yy) * u, 0.4, from.z + Math.cos(yy) * u, 4, 1.4, 2.4, this.pale, 1.2, 6);
      }
    }
    const p = StarBurst.pop(a, 0.04, 0.16);
    this.star.set(this.v.copy(this.at), 1.5 * p.scale + 1e-3, p.opacity, 0.3);
    fx.darken = 0.26 * (1 - smooth(a / 0.9));
    fx.chroma = chromaPulse(t, WIND, 0.3, 12);
  }

  after(c: Cast<null>) {
    c.shake *= 0.87;
  }
}

export const moltenGlassBloomModule = spell<null>({
  label: 'molten glass bloom',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RANGE },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: WIND,
    shape: { kind: 'zone', area: (c) => ({ kind: 'cone', x: c.from.x, z: c.from.z, radius: RANGE, angle: ANGLE, dir: c.yaw }) },
    hit: { damage: 48, knock: 3, color: '#ffc27a' },
  },
  look: GlassLook,
  bloom: { enabled: true, strength: 0.4, radius: 0.45, threshold: 0.86 },
  frame: 9,
  maxDamage: 160,
});
