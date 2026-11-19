import * as THREE from 'three';
import type { Enemy } from '../../../effects/common';
import { clearScreenFx, createScreenFx } from '../../../effects/parts';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Flecks } from '../../../heroes/sheath/partsBig';
import { BeamStrokes, Blots, CharcoalStick, FanSketch, easeOut, smooth } from './g6Parts';

/**
 * Charcoal Tempest (gallery group 6, #9; charcoal sketch: paper white, graphite, smudge, hatching). A beam swept across a fan
 * in front of the caster, 7 m long and 100 degrees, held 1.5 s after a 0.9 s wind-up. The danger zone is the whole fan; each
 * enemy is hit (55) once, by the beam, on the frame it passes them (`on.frame`), so whoever leaves the fan before the beam
 * reaches them is spared. Answer: step out of the fan sideways, at most 3.5 m: 0.25 + 3.5 / 4 = 1.1 s; the beam needs up to 2.4 s.
 * On the blocks: a zone (a cone) whose own judging is put past the end (`delay`), and the beam's hits in `on.frame`.
 *
 * The look. 0-0.9 the fan is sketched on the floor in pale pencil with a dark line beside it (the sides run out from his feet,
 * then the arc), faint hatching fills it, three scribbled loops are drawn round his hand, a charcoal stick points along the aim.
 * 0.75-0.9 the dead beat: every line thins to a hair and holds. 0.9 the beam snaps out: a broad ragged black stroke crossed by
 * pale hatch marks with a bright paper core and a jagged paper edge, redrawn twelve times a second, sweeping the fan from one
 * side to the other in 1.5 s and leaving the swept floor rubbed to smudge with cross-hatching. Each enemy it passes gets a charcoal
 * blot crossed by pale scribbles, a ring and a puff of dust. After 2.4 s the beam wipes out and the smudge fades by 3.1 s.
 */

const RANGE = 7;
const ANGLE = 100;
const HALF = (ANGLE / 2) * Math.PI / 180;
const WIND = 0.9;
const SWEEP = 1.5;
const DURATION = 3.1;

/** The beam's bearing from the aim, `a` s after it starts: from -HALF to +HALF, a little slower at both ends. */
const bearing = (a: number) => {
  const s = Math.min(1, Math.max(0, a / SWEEP));
  return -HALF + 2 * HALF * (0.5 * s + 0.5 * smooth(s));
};

interface State { struck: Set<Enemy> }

class CharcoalLook implements Look<State> {
  readonly screen = createScreenFx();
  private fan = new FanSketch(RANGE, HALF);
  private beam = new BeamStrokes(RANGE);
  private blots = new Blots(8);
  private stick = new CharcoalStick();
  private flecks = new Flecks(200, 0.2);
  private black = new THREE.Color('#1b1b1e');
  private graph = new THREE.Color('#8a8a92');
  private paper = new THREE.Color('#f0ebde');
  private started = false;

  constructor(group: THREE.Group) {
    this.screen.tint.set('#2e2e34');
    this.screen.edgeTint.set('#e8e4d8');
    group.add(this.fan.mesh, this.blots.mesh, this.beam.mesh, this.stick.group, this.flecks.mesh);
  }

  reset() {
    this.started = false;
    clearScreenFx(this.screen);
    this.fan.set(0, 0, 0, 0, 0, 0, 0, 0);
    this.beam.set(0, 0, 0, 0, 0, 0);
    this.blots.clear();
    this.stick.set(0, 0, 0, false);
    this.flecks.clear();
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  /** The beam struck an enemy: a blot where they stand, dust and a pale scribble ring. */
  struck(c: Cast<State>, who: Enemy) {
    const p = who.group.position;
    this.blots.add(p.x, p.z, c.time, 3.4);
    this.flecks.burst(p.x, 0.5, p.z, 12, 3.4, 2.6, this.black, 1.3, 6);
    this.flecks.burst(p.x, 0.7, p.z, 9, 3.0, 2.8, this.paper, 1.1, 6);
    this.flecks.burst(p.x, 0.4, p.z, 6, 2.0, 1.6, this.graph, 1.4, 5);
    c.shake = Math.max(c.shake, 0.2);
  }

  frame(c: Cast<State>, t: number) {
    const from = c.from, yaw = c.yaw, fx = this.screen;
    this.fan.place(from.x, from.z, yaw);
    if (t < WIND) {
      // the fan is sketched, the loops scribbled; the last 0.17 s is the dead beat
      const hush = smooth((t - (WIND - 0.17)) / 0.1);
      this.fan.set(t, 2 * easeOut(t / 0.55), smooth((t - 0.25) / 0.4), 0, 0, 1, hush, smooth((t - 0.1) / 0.6));
      this.beam.set(0, 0, 0, 0, 0, t);
      this.stick.set(from.x, from.z, yaw, true);
      fx.darken = 0.18 * smooth(t / 0.6);
      return;
    }
    const a = t - WIND;
    if (!this.started) {
      this.started = true;
      c.shake = 0.18;
    }
    const beta = bearing(a);
    const b01 = (beta + HALF) / (2 * HALF);
    const byaw = yaw + beta;
    const fade = 1 - smooth((t - (DURATION - 0.6)) / 0.55);
    this.fan.set(t, 2, 1 - smooth(a / 0.3), b01, smooth(a / 0.15), fade, 0, 0);
    this.beam.set(from.x, from.z, byaw, RANGE * easeOut(a / 0.1), 1 - smooth((a - SWEEP) / 0.2), t);
    this.stick.set(from.x, from.z, byaw, a < SWEEP + 0.2);
    this.blots.update(t, fade);
    fx.darken = 0.18 * (1 - smooth((a - SWEEP) / 0.5));
  }

  after(c: Cast<State>) {
    c.shake *= 0.86;
  }
}

/** The beam's hits: an enemy whose bearing the beam has just crossed (within the fan, inside its range) is hit, once. */
function beamHits(c: Cast<State>, t: number) {
  const st = c.state, ctx = c.ctx;
  if (t < WIND) {
    if (st.struck.size) st.struck.clear();
    return;
  }
  if (!ctx || t > WIND + SWEEP + 0.05) return;
  const beta = bearing(t - WIND);
  for (const en of ctx.enemies?.() ?? ctx.targets) {
    if (st.struck.has(en)) continue;
    const dx = en.group.position.x - c.from.x, dz = en.group.position.z - c.from.z;
    if (Math.hypot(dx, dz) > RANGE) continue;
    let b = Math.atan2(dx, dz) - c.yaw;
    b = Math.atan2(Math.sin(b), Math.cos(b));
    if (Math.abs(b) > HALF || b > beta || b < beta - 0.3) continue;
    st.struck.add(en);
    ctx.hit(en, c.hitOptions(undefined, c.from.clone()));
    c.look.struck?.(c, en);
  }
}

export const charcoalTempestModule = spell<State>({
  label: 'charcoal tempest',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RANGE },
  seconds: DURATION,
  state: () => ({ struck: new Set<Enemy>() }),
  rules: {
    windup: WIND,
    // judged only past the end of the cast: the beam does the hitting, the zone is the fan it can reach
    delay: 2.4,
    shape: { kind: 'zone', area: (c) => ({ kind: 'cone', x: c.from.x, z: c.from.z, radius: RANGE, angle: ANGLE, dir: c.yaw }) },
    hit: { damage: 55, knock: 3, color: '#ece8dc' },
    on: { frame: beamHits },
  },
  look: CharcoalLook,
  bloom: { enabled: true, strength: 0.25, radius: 0.4, threshold: 0.9 },
  frame: 10,
  maxDamage: 160,
});
