import * as THREE from 'three';
import { StarBurst } from '../../../effects/parts';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Blade, flatRing } from '../../../heroes/sheath/parts';
import { Flecks } from '../../../heroes/sheath/partsBig';
import { GlazeShell, KilnFloor, Pieces, easeOut, hash, shardGeometry, smooth } from './g1Parts';

/**
 * Kintsugi Shatter (gallery group 1, a sure hit, Raku pottery: black glaze, crackle, molten gold). A click on an enemy. A gold
 * thread runs along the floor from the caster to their feet (0.3 s), then a disc of black glaze is painted out under them and
 * a gold crackle creeps across it while a robe of translucent black glaze, crazed with gold seams that climb from the floor,
 * closes over the figure (it follows them). Flecks of gold rise. The last 0.3 s is the dead beat: the pulse stops, the seams
 * burn at full, the glaze shivers. At 1.6 s the glaze bursts: 52 damage, a sure hit on their live position, and 30 black shards
 * (cream on the back, gold on every broken edge) fly out, slow down and hang in the air, then are pulled back one by one
 * (from 2.2 s) to where the body is and mend, each flaring gold as it locks; the mended vessel stands for a breath, all its
 * seams gold, and dissolves upward as gold dust by 3.4 s. The floor's glaze cells let go at the hit and leave the gold lines.
 * On the blocks: `target` (mark 1.5 m, where they stood at the cast; the warning is the build, 0.25 + 1.5 / 4 = 0.63 s and more).
 */

const W = 0.3; // the thread arrives, the spell is set
const D = 1.3; // the build and the dead beat
const HIT = W + D;
const DURATION = 3.5;
const BEAT = 0.3; // the dead beat before the hit
const SHARDS = 30;
const MARK = 1.5;
const FLOOR_R = 2.4;

const GOLD = new THREE.Color('#d9a23a');
const CREAM = new THREE.Color('#f1e8d0');
const CORE = new THREE.Color('#fff0c4');

// Where each shard sits on the robe (its home), where it is thrown, and when it returns: by index.
const GOLDEN = 2.399963;
const shardAng = (i: number) => i * GOLDEN + (hash(i * 3.1) - 0.5) * 0.4;
const shardY = (i: number) => 0.26 + (i % 6) * 0.31 + (hash(i * 5.3) - 0.5) * 0.14;
const shardR = (y: number) => 0.66 - 0.19 * Math.min(1, y / 1.2) - 0.18 * Math.max(0, (y - 1.4) / 0.6) + 0.05;
const shardSize = (i: number) => 0.72 + 0.5 * hash(i * 7.7);
const returnAt = (i: number) => 0.55 + 0.25 * hash(i * 9.1);
const RETURN = 0.5;

class KintsugiLook implements Look<null> {
  private floor = new KilnFloor(FLOOR_R);
  private shell = new GlazeShell();
  private thread = new Blade(GOLD, true, 4);
  private piecesA = new Pieces(shardGeometry(0), (SHARDS + 1) >> 1);
  private piecesB = new Pieces(shardGeometry(1), SHARDS >> 1);
  private flecks = new Flecks(240, 0.2);
  private ring = flatRing(GOLD, 0.05, true, 4);
  private star = new StarBurst({ points: 8, inner: 0.2, color: GOLD, core: CREAM });
  private foe = new THREE.Vector3();
  private hitFoe = new THREE.Vector3();
  private dir = new THREE.Vector3(0, 0, -1);
  private v = new THREE.Vector3();
  private burst = false;
  private mended = false;
  private motes = 0;
  private moteAt = 0;

  constructor(group: THREE.Group) {
    group.add(this.floor.mesh, this.shell.mesh, this.thread.mesh, this.piecesA.mesh, this.piecesB.mesh, this.flecks.mesh, this.ring.mesh, this.star.mesh);
  }

  reset() {
    this.burst = this.mended = false;
    this.motes = 0;
    this.moteAt = 0;
    this.floor.set(0, 0, 0, 0, 0, 0, 0);
    this.shell.set(0, 0, 0, 0, 0, 0, 0);
    this.thread.hide();
    this.piecesA.reset();
    this.piecesB.reset();
    this.flecks.clear();
    this.ring.mesh.visible = false;
    this.star.set(this.v.set(0, 0, 0), 1e-3, 0);
  }

  cast(c: Cast<null>) {
    this.foe.copy(c.spot);
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  /** Where shard i is at `a` s after the hit: thrown, slowing to hang, then pulled back to the live body. */
  private shard(i: number, a: number, glow: { v: number }) {
    const ang = shardAng(i), y0 = shardY(i), r0 = shardR(y0), ux = Math.cos(ang), uz = Math.sin(ang);
    const size = shardSize(i), tr = returnAt(i);
    const k = 2.4;
    const f = (1 - Math.exp(-k * Math.min(a, tr))) / k; // the throw: fast, then slowing to a hang
    const speed = 3.6 + 2.6 * hash(i * 2.9), lift = (y0 - 0.9) * 1.1 + 0.5 + 1.1 * hash(i * 4.4);
    const bob = 0.07 * Math.sin(a * 2.3 + i);
    const sx = this.hitFoe.x + ux * (r0 + speed * 0.62 * f), sz = this.hitFoe.z + uz * (r0 + speed * 0.62 * f);
    const sy = Math.max(0.14, y0 + lift * f + bob);
    const spinX = (hash(i * 1.3) - 0.5) * 9, spinZ = (hash(i * 6.1) - 0.5) * 9;
    const sp = (1 - Math.exp(-2.5 * Math.min(a, tr))) / 2.5;
    const hy = Math.PI / 2 - ang;
    let q = smooth((a - tr) / RETURN);
    const hx = this.foe.x + ux * r0, hz = this.foe.z + uz * r0;
    const e = q * q * (3 - 2 * q);
    const x = sx + (hx - sx) * e, z = sz + (hz - sz) * e, yy = sy + (y0 - sy) * e + Math.sin(Math.PI * q) * 0.55;
    const rx = spinX * sp * (1 - e), rz = spinZ * sp * (1 - e), ry = hy + (hash(i * 8.8) - 0.5) * 2 * (1 - e);
    // a gold flare as it locks home, then a long ember of it
    q = (a - tr - RETURN) / 0.35;
    glow.v = 0.12 + (q > 0 ? 1.4 * (1 - smooth(q)) : 0);
    const arrived = a >= tr + RETURN;
    const m = i >> 1, A = i % 2 === 0 ? this.piecesA : this.piecesB;
    const s = size * (arrived ? 1 + 0.18 * Math.max(0, 1 - q * 3) : 1);
    A.set(m, x, yy, z, rx, ry, rz, s, s * 0.9, s, glow.v);
  }

  private glowBox = { v: 0 };

  frame(c: Cast<null>, t: number) {
    const tg = c.target;
    if (tg) this.foe.set(tg.group.position.x, 0, tg.group.position.z);
    const from = c.ctx && !c.ctx.sentFrom ? c.ctx.caster.group.position : c.from;
    this.dir.set(this.foe.x - from.x, 0, this.foe.z - from.z);
    const dist = this.dir.length();
    if (dist > 0.05) this.dir.multiplyScalar(1 / dist);

    // the thread: gold lacquer run along the floor to their feet
    const run = easeOut(t / W);
    this.thread.set(this.v.set(from.x, 0, from.z), this.dir, 0.4, 0.4 + Math.max(0.01, (dist - 0.8) * run), 0.2, 0.07, 0.9 * (1 - smooth((t - 0.45) / 0.5)));

    const beat = smooth((t - (HIT - BEAT)) / 0.1);
    const a = t - HIT;
    const pulse = (0.5 + 0.5 * Math.sin(t * (5 + 7 * smooth(t / HIT)))) * (1 - beat);
    const build = 0.12 + 0.3 * smooth(t / (HIT - BEAT)) * pulse;

    if (a < 0) {
      // the build: glaze painted on the floor, the crackle creeping, the robe of glaze closing over them, motes rising
      this.floor.set(this.foe.x, this.foe.z, FLOOR_R * 0.96 * easeOut((t - 0.15) / 0.7), 3.1 * easeOut((t - 0.3) / 1.2), 0, build + beat * 0.5, 1);
      this.shell.set(this.foe.x, this.foe.z, smooth((t - 0.35) / 0.5), 1.35 * easeOut((t - 0.45) / 1.05), build + beat * 0.5, 0.012 * beat, t);
      // gold motes lift off the glaze, stopping in the dead beat
      if (t > 0.5 && beat < 0.01 && t >= this.moteAt) {
        this.moteAt = t + 0.07;
        const k = this.motes++, ang = k * GOLDEN, rr = 0.4 + 1.7 * hash(k * 1.7);
        this.flecks.burst(this.foe.x + Math.cos(ang) * rr, 0.1, this.foe.z + Math.sin(ang) * rr, 1, 0.12, 0.7, k % 3 === 0 ? CREAM : GOLD, 1.5, -0.5);
      }
      this.ring.mesh.visible = false;
      return;
    }

    if (!this.burst) {
      this.burst = true;
      this.hitFoe.copy(this.foe);
      c.shake = 0.38;
      for (let k = 0; k < 4; k++) {
        const y = 0.5 + k * 0.45;
        this.flecks.burst(this.foe.x, y, this.foe.z, 12, 4.4, 2.6, GOLD, 1.1, 7);
        this.flecks.burst(this.foe.x, y, this.foe.z, 7, 3.0, 3.2, CREAM, 1.0, 7);
      }
    }
    // the floor's glaze cells let go, the gold lines flare and settle; the ring runs out
    const lift = smooth(a / 0.55);
    const seamFade = 1 - smooth((t - 2.95) / 0.5);
    this.floor.set(this.hitFoe.x, this.hitFoe.z, FLOOR_R * 0.96, 3.1, lift, 0.9 * (1 - smooth(a / 0.6)) + 0.35, seamFade);
    const rg = easeOut(a / 0.4);
    this.ring.mesh.visible = a < 0.45;
    this.ring.mesh.position.set(this.hitFoe.x, 0.06, this.hitFoe.z);
    this.ring.mesh.scale.set(0.6 + 2.4 * rg, 1, 0.6 + 2.4 * rg);
    this.ring.material.opacity = 0.9 * (1 - rg) * (1 - rg);
    const sp = StarBurst.pop(a, 0.04, 0.12);
    this.star.set(this.v.set(this.hitFoe.x, 1.15, this.hitFoe.z), 1.0 * sp.scale + 1e-3, sp.opacity, 0.3);

    // the shards: out, hanging, pulled back
    for (let i = 0; i < SHARDS; i++) {
      if (a > 1.42) { (i % 2 === 0 ? this.piecesA : this.piecesB).hide(i >> 1); continue; }
      this.shard(i, a, this.glowBox);
    }
    this.piecesA.commit();
    this.piecesB.commit();

    // the mended vessel: stands with every seam gold, then dissolves upward
    const mendA = smooth((a - 1.28) / 0.14);
    if (mendA > 0 && !this.mended) {
      this.mended = true;
      c.shake = Math.max(c.shake, 0.12);
      this.flecks.burst(this.foe.x, 1.0, this.foe.z, 26, 0.5, 0.9, GOLD, 1.4, -1.1);
      this.flecks.burst(this.foe.x, 1.4, this.foe.z, 14, 0.4, 0.8, CORE, 1.3, -1.3);
    }
    const out = 1 - smooth((t - 3.0) / 0.45);
    this.shell.set(this.foe.x, this.foe.z, mendA * out, 2.0, 0.35 + 0.5 * (1 - smooth((a - 1.3) / 0.5)), 0, t);
  }

  after(c: Cast<null>) {
    c.shake *= 0.9;
  }
}

export const kintsugiShatterModule = spell<null>({
  label: 'kintsugi shatter',
  category: 'targeted',
  // Click an enemy: a sure hit (the engine checks the range and the sight at the cast); the build is the warning.
  targeting: { mode: 'enemy' },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: W,
    delay: D,
    shape: { kind: 'target', mark: MARK },
    hit: { damage: 52, knock: 2.2, color: '#d9a23a', projectile: true },
    warn: 0.04,
  },
  look: KintsugiLook,
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.84 },
  frame: 3,
  maxDamage: 160,
});
