import * as THREE from 'three';
import type { Enemy } from '../../../effects/common';
import { ShockRefraction } from '../../../effects/parts';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Flecks } from '../../../heroes/sheath/partsBig';
import { Decals, Glints, Ribbon, clamp01, crescentFlatGeometry, crescentGeometry, crescentMaterial, crescentPts, easeOut, hash, ringGeometry, smooth } from './g9Parts';

/**
 * Crescent return (gallery 17, moon silver: indigo night, a silver crescent, star dust). A boomerang: a flat silver crescent
 * thrown out along a 9 m lane (1.4 m wide, no caster move) and back. A 0.55 s wind-up, then the crescent flies out in 0.5 s
 * (the lane's front, slowing as it nears the end), hangs for 0.14 s at the far end and comes home in 0.65 s, speeding up; it is
 * caught in her hand at 1.84 s. Everyone in the lane is hit once on the way out (the runner's sweep, 44) and once more on the way
 * back (`on.frame`, 44, tugged toward her); the second pass is judged as the crescent passes each enemy, only inside the lane.
 *
 * The look. 0-0.4: star dust gathers from a wide ring round her hand into the outline of a crescent, which fills in as a blade of
 * pale light and hardens to silver; a silver ring is drawn on the floor under her. 0.4-0.55: the dead beat: the dust is gone, the
 * crescent hangs drawn back, nearly still, one glint runs along it. The throw: it spins flat (24 rad/s), loops in a lens inside the
 * lane (out on her left, back on her right) and every turn flashes its edge; a ribbon of silver fading to indigo and a spray of
 * four-pointed stars follow it, the stars drifting and twinkling for a second, and its shadow runs on the floor. Each hit: a silver
 * ring, flecks, a small shake. The catch: a flash, a ring, the crescent folds into her hand. The dust clears by 3.0 s.
 * Palette: indigo (dark layer: the ribbon's edges, the shadow), silver (foil: the blade), pale blue (accent: the stars), a white core.
 */
interface Return {
  back: Set<Enemy>;
  hits: { x: number; z: number }[];
}

const WIND = 0.55;
const REACH = 9;
const WIDTH = 1.4;
const OUT = 0.5;
const HANG = 0.14;
const BACK = 0.65;
const CATCH = WIND + OUT + HANG + BACK;
const DAMAGE = 44;
const LAT = 0.42; // how far the loop swings to either side
const SC = 0.8; // the crescent's size (its disc's radius)
const GATHER = 64;
const SLOTS = 8; // hit and catch rings

const outAlong = (k: number) => 1 - Math.pow(1 - clamp01(k), 2);
const backAlong = (k: number) => 1 - Math.pow(clamp01(k), 1.7);

class ReturnLook implements Look<Return> {
  private blade = new THREE.Mesh(crescentGeometry(), crescentMaterial());
  private shadow = new Decals(crescentFlatGeometry(), 1, '#0b0f30', '#0b0f30', 0, 0.38);
  private rings = new Decals(ringGeometry(0.82), SLOTS + 1, '#e4ecff', '#e4ecff', 0.9, 0);
  private trail = new Ribbon(80, 0.4, 0.9, '#eef3ff', '#2a3590');
  private dust = new Glints(360);
  private gather = new Glints(GATHER);
  private flecks = new Flecks(300, 0.2);
  private shock = new ShockRefraction({ facing: 'ground' });
  private silver = new THREE.Color('#d6dff0');
  private pale = new THREE.Color('#f4f8ff');
  private blue = new THREE.Color('#8ea8ff');
  private left = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3();
  private outline: [number, number][] = [];
  private spin = 0;
  private caught = false;
  private seen = 0; // how many of the state's return hits are drawn
  private dustT = 0;
  private slot = 0;
  private hitT = new Float32Array(SLOTS).fill(-1);
  private hitX = new Float32Array(SLOTS);
  private hitZ = new Float32Array(SLOTS);
  private bump = 0;
  private p = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  constructor(group: THREE.Group) {
    this.blade.frustumCulled = false;
    this.blade.visible = false;
    const pts = crescentPts();
    for (let i = 0; i < GATHER; i++) this.outline.push(pts[Math.floor((i / GATHER) * (pts.length - 1))]);
    group.add(this.shadow.mesh, this.rings.mesh, this.trail.mesh, this.blade, this.dust.mesh, this.gather.mesh, this.flecks.mesh, this.shock.mesh);
  }

  reset(c: Cast<Return>) {
    this.blade.visible = false;
    this.shadow.clear();
    this.rings.clear();
    this.trail.clear();
    this.dust.clear();
    this.gather.clear();
    this.flecks.clear();
    this.shock.set(c.from, 0, 0);
    this.spin = 0;
    this.caught = false;
    this.seen = 0;
    this.dustT = 0;
    this.slot = 0;
    this.hitT.fill(-1);
    this.bump = 0;
  }

  cast(c: Cast<Return>) {
    this.left.set(c.dir.z, 0, -c.dir.x);
    this.hand.copy(c.from).addScaledVector(c.dir, 0.65).addScaledVector(this.left, 0.4).setY(1.4);
  }

  tick(dt: number) {
    this.flecks.update(dt);
    this.dust.update(dt);
    this.gather.update(dt);
    this.trail.update(dt);
  }

  idle(dt: number) {
    this.tick(dt);
  }

  released(c: Cast<Return>) {
    c.shake = 0.08;
    this.ring(this.hand.x, this.hand.z, c.time);
    this.flecks.burst(this.hand.x, 1.3, this.hand.z, 10, 2.4, 1.2, this.silver, 0.6, 4);
    this.flecks.burst(this.hand.x, 1.3, this.hand.z, 6, 2.0, 1.2, this.blue, 0.6, 4);
  }

  /** A ring on the floor from the next free slot. */
  private ring(x: number, z: number, t: number) {
    const i = this.slot++ % SLOTS;
    this.hitT[i] = t;
    this.hitX[i] = x;
    this.hitZ[i] = z;
  }

  /** The runner's sweep struck someone on the way out. */
  struck(c: Cast<Return>, who: Enemy) {
    this.hitAt(c, who.group.position.x, who.group.position.z);
  }

  private hitAt(c: Cast<Return>, x: number, z: number) {
    this.ring(x, z, c.time);
    this.bump = 0.5;
    c.shake = Math.max(c.shake, 0.1);
    this.flecks.burst(x, 1.0, z, 12, 3.0, 2.4, this.silver, 0.7, 6);
    this.flecks.burst(x, 1.0, z, 8, 2.6, 2.4, this.blue, 0.7, 6);
    this.flecks.burst(x, 1.0, z, 3, 1.4, 1.5, this.pale, 0.4, 4);
  }

  /** Where the crescent is at `t`: the lens loop inside the lane, blended into her hand at both ends. Returns the distance along the lane. */
  private where(c: Cast<Return>, t: number, out: THREE.Vector3): number {
    let along = 0, lat = 0;
    if (t >= WIND && t < WIND + OUT) {
      along = Math.min(REACH, c.front(t));
      lat = LAT * Math.sin(Math.PI * (along / REACH));
    } else if (t >= WIND + OUT && t < WIND + OUT + HANG) {
      along = REACH;
      lat = 0;
    } else if (t >= WIND + OUT + HANG && t < CATCH) {
      along = REACH * backAlong((t - WIND - OUT - HANG) / BACK);
      lat = -LAT * Math.sin(Math.PI * (along / REACH));
    }
    const blend = 1 - smooth(along / 1.5);
    out.set(
      c.from.x + c.dir.x * along + this.left.x * lat + (this.hand.x - c.from.x) * blend,
      1.0 + 0.3 * blend + (t >= WIND + OUT && t < WIND + OUT + HANG ? 0.1 * Math.sin(((t - WIND - OUT) / HANG) * Math.PI) : 0),
      c.from.z + c.dir.z * along + this.left.z * lat + (this.hand.z - c.from.z) * blend,
    );
    return along;
  }

  frame(c: Cast<Return>, t: number, dt: number) {
    const mat = this.blade.material as THREE.ShaderMaterial;
    const flying = t >= WIND && t < CATCH;
    // the dust gathers into a crescent, the blade fills in, hangs through the beat
    if (t < WIND) this.windup(c, t, mat, dt);
    else if (flying) this.flight(c, t, mat, dt);
    else if (t < CATCH + 0.2) this.catching(c, t, mat);
    this.bump *= Math.exp(-dt * 6);
    mat.uniforms.uGlow.value = this.bump + (t < WIND ? 0.85 * (1 - smooth((t - 0.15) / 0.3)) : 0);
    // the new hits of the way back
    while (this.seen < c.state.hits.length) {
      const h = c.state.hits[this.seen++];
      this.hitAt(c, h.x, h.z);
    }
    // the rings on the floor: silver, opening and fading
    for (let i = 0; i < SLOTS; i++) {
      const a = this.hitT[i] < 0 ? -1 : t - this.hitT[i];
      if (a < 0 || a > 0.5) { this.rings.set(i, 0, 0, 1e-4, 0, 0); continue; }
      const k = a / 0.5;
      this.rings.set(i, this.hitX[i], this.hitZ[i], 0.4 + 1.5 * easeOut(k), 0, (1 - k) * (1 - k));
    }
    // the moon circle drawn under her while she gathers
    const mc = t < WIND ? smooth(t / 0.35) : 1 - smooth((t - WIND) / 0.3);
    this.rings.set(SLOTS, c.from.x, c.from.z, 1.15 - 0.15 * smooth((t - 0.4) / 0.15) + 0.3 * (1 - mc), 0, 0.55 * mc);
    c.shake *= 0.9;
  }

  private windup(c: Cast<Return>, t: number, mat: THREE.ShaderMaterial, dt: number) {
    const beat = t >= 0.4;
    this.spin += (beat ? 1.2 : 5) * dt;
    const form = smooth((t - 0.18) / 0.22);
    const pull = beat ? 0.25 * smooth((t - 0.4) / 0.08) : 0.25 * smooth(t / 0.4);
    this.p.set(this.hand.x - c.dir.x * pull, this.hand.y + 0.1 * form, this.hand.z - c.dir.z * pull);
    this.blade.visible = form > 0.02;
    this.setBlade(this.p, SC * (0.2 + 0.8 * easeOut(form)), this.spin, 0);
    mat.uniforms.uSpin.value = this.spin;
    // the dust: from a wide ring into the outline, then gone for the beat
    const cs = Math.cos(this.spin), sn = Math.sin(this.spin);
    for (let j = 0; j < GATHER; j++) {
      const h = hash(j * 1.9 + 4);
      const p0 = smooth((t - 0.02 - 0.2 * h) / 0.3);
      const [ox, oz] = this.outline[j];
      const lx = ox * SC, lz = oz * SC;
      // the outline's point in the world, turned with the blade (Y rotation: x' = x cos + z sin, z' = -x sin + z cos)
      const tx = this.p.x + lx * cs + lz * sn, tz = this.p.z - lx * sn + lz * cs, ty = this.p.y;
      const a0 = h * 6.28 + (1 - p0) * 2.5, r0 = (1.4 + 1.2 * hash(j * 2.7)) * (1 - p0);
      const x = tx + Math.cos(a0) * r0, z = tz + Math.sin(a0) * r0;
      const y = ty + (0.3 + 1.6 * hash(j * 3.3) - 0.9) * (1 - p0);
      const alpha = 0.95 * smooth(p0 * 3) * (1 - smooth((t - 0.34) / 0.07));
      this.gather.set(j, x, y, z, j % 3 === 0 ? this.pale : j % 3 === 1 ? this.blue : this.silver, 0.4 + 0.2 * hash(j * 5.1), alpha);
    }
    this.shadow.set(0, 0, 0, 1e-4, 0, 0);
    if (t > 0.5 && t < 0.52) this.flecks.burst(this.p.x, this.p.y, this.p.z, 4, 0.6, 0.4, this.pale, 0.4, 1);
  }

  private flight(c: Cast<Return>, t: number, mat: THREE.ShaderMaterial, dt: number) {
    if (t - dt < WIND) for (let j = 0; j < GATHER; j++) this.gather.set(j, 0, -50, 0, this.silver, 0.1, 0);
    this.where(c, t, this.p);
    const hang = t >= WIND + OUT && t < WIND + OUT + HANG;
    this.spin += (hang ? 34 : 24) * dt;
    this.blade.visible = true;
    // a slight lean toward the loop's inside, flat otherwise
    const side = t < WIND + OUT + HANG ? 1 : -1;
    this.setBlade(this.p, SC, this.spin, 0.12 * side);
    mat.uniforms.uSpin.value = this.spin;
    if (hang && this.bump < 0.3) this.bump = 0.3;
    this.shadow.set(0, this.p.x, this.p.z, SC, this.spin, 1);
    this.trail.push(this.p.x, this.p.y - 0.02, this.p.z);
    // star dust off the blade's horns, drifting and twinkling
    this.dustT += dt;
    while (this.dustT > 0.02) {
      this.dustT -= 0.02;
      const i = Math.floor(t * 50);
      const a = hash(i * 1.7) * 6.28, r = hash(i * 2.9) * 0.45;
      const col = hash(i * 3.1) > 0.6 ? this.pale : hash(i * 4.3) > 0.4 ? this.blue : this.silver;
      this.dust.spawn(
        this.p.x + Math.cos(a) * r, this.p.y + (hash(i * 5.3) - 0.5) * 0.3, this.p.z + Math.sin(a) * r, col,
        0.4 + 0.5 * hash(i * 6.1), 0.7 + 0.5 * hash(i * 7.3), (hash(i * 8.1) - 0.5) * 0.8, 0.15 + 0.3 * hash(i * 9.1), (hash(i * 10.3) - 0.5) * 0.8, 1.6,
      );
    }
  }

  private catching(c: Cast<Return>, t: number, mat: THREE.ShaderMaterial) {
    const a = t - CATCH;
    if (!this.caught) {
      this.caught = true;
      c.shake = Math.max(c.shake, 0.1);
      this.ring(this.hand.x, this.hand.z, t);
      this.flecks.burst(this.hand.x, 1.3, this.hand.z, 10, 2.0, 1.5, this.silver, 0.6, 4);
      this.flecks.burst(this.hand.x, 1.3, this.hand.z, 6, 1.8, 1.5, this.pale, 0.5, 4);
      this.bump = 0.7;
    }
    // it folds into her hand
    const k = smooth(a / 0.12);
    this.spin += 0.5;
    this.blade.visible = k < 1;
    this.setBlade(this.hand, SC * (1 - k), this.spin, 0);
    mat.uniforms.uSpin.value = this.spin;
    this.shadow.set(0, this.hand.x, this.hand.z, SC * (1 - k), this.spin, 1 - k);
  }

  private setBlade(at: THREE.Vector3, scale: number, yaw: number, lean: number) {
    this.e.set(lean, yaw, lean * 0.6);
    this.q.setFromEuler(this.e);
    this.blade.position.copy(at);
    this.blade.quaternion.copy(this.q);
    this.blade.scale.setScalar(Math.max(1e-4, scale));
  }
}

export const crescentReturnModule = spell<Return>({
  label: 'crescent return',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 0.5 },
  seconds: 3.1,
  state: () => ({ back: new Set<Enemy>(), hits: [] }),
  rules: {
    windup: WIND,
    shape: {
      kind: 'lane',
      length: REACH,
      width: WIDTH,
      late: OUT,
      // the crescent slows as it nears the far end (the look follows the same front)
      front: (c, even) => c.reach * outAlong(even / (c.reach * OUT)),
    },
    hit: { damage: DAMAGE, knock: 2.5, color: '#b9c8f0' },
    warn: 0.04,
    on: {
      // the way back: whoever the crescent has passed, inside the lane, is hit once more
      frame(c, t) {
        const ctx = c.ctx;
        const t0 = WIND + OUT + HANG;
        if (!ctx || t < t0 || t > CATCH + 0.05) return;
        const a = REACH * backAlong((t - t0) / BACK);
        for (const en of ctx.enemies?.() ?? ctx.targets) {
          if (c.state.back.has(en)) continue;
          const dx = en.group.position.x - c.from.x, dz = en.group.position.z - c.from.z;
          const along = dx * c.dir.x + dz * c.dir.z;
          const perp = Math.abs(dx * c.dir.z - dz * c.dir.x);
          if (along < a || along > REACH || perp > WIDTH / 2) continue;
          c.state.back.add(en);
          // tugged home: the knock comes from the far end of the lane
          ctx.hit(en, c.hitOptions({ damage: DAMAGE, knock: 1.5, color: '#b9c8f0' }, new THREE.Vector3(c.from.x + c.dir.x * REACH, 0, c.from.z + c.dir.z * REACH)));
          c.state.hits.push({ x: en.group.position.x, z: en.group.position.z });
        }
      },
    },
  },
  look: ReturnLook,
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.88 },
  frame: 8,
  maxDamage: 120,
});
