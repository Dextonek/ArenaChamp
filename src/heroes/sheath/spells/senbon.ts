import * as THREE from 'three';
import { ShockRefraction } from '../../../effects/parts';
import { insideTelegraph } from '../../../effects/telegraph';
import type { Enemy } from '../../../effects/common';
import type { Look } from '../../framework/blocks';
import { spell, type Cast } from '../../framework/spell';
import { C, E } from '../numbers';
import { BrushRing, FloorFlashes, Flecks, easeOut, hash, katanaGeometry, smooth, streakMesh } from '../partsBig';

/**
 * Senbon, Thousand Swords (Kagen's E). A ring of 3 m is painted at a spot within 8 m for 1.0 s, then katanas rain into it in
 * three waves, at 1.0, 1.4 and 1.8 s after the cast. Each wave that finds an enemy inside (live position): 10, and the
 * passive leaves a cut mark (`dealt`, slot 2). The ring stays drawn until the last wave.
 * Answer: walk out, 3 m from the very middle: 0.25 + 3 / 4 = 1.0 s; the first wave lands at 1.0 s.
 * On the blocks: a zone judged at 1.0 s (the first wave); the next two waves are this spell's own rule (`on.frame`), judged in
 * the same ring, which is the danger zone until the last.
 */
interface Rain { wave: number }

/**
 * The look (ported from the tool page's 'thousand swords', cut to a duel). 0-1.0: a cinnabar ring is painted on the floor by one
 * brush stroke (rice-paper rim, dry-brush end), a thin ring of the same hangs in the air over it and spectral katanas gather
 * under it, points down. At each wave (E.waves: 1.0, 1.4, 1.8 s) a volley of 7, 8 and 11 katanas drops in 0.16 s with a
 * steel-and-cinnabar streak and sticks in the floor inside the ring: a steel flash, paper flecks, a ring of force, the ring on
 * the floor flashing paper. The last wave is bigger (more blades, larger, a bigger shake). The blades thin away from 2.0 s
 * and are gone by 2.6 s, the ring with them. The blades land 0.03 s either side of their wave, inside the ring (2.7 m).
 */
const COUNTS = [7, 8, 11];
const TOTAL = COUNTS.reduce((a, b) => a + b, 0);
const DROP = 0.16; // seconds a blade falls
const SKY = 4.6; // the hanging ring's height
const HOVER = 2.6; // blades hang from here (their tips)
const EMBED = 0.3; // how deep a tip bites
const FADE_AT = 2.0;
const FADE_LEN = 0.5;
const GOLDEN = 2.39996;

class RainLook implements Look<Rain> {
  private ring = new BrushRing(E.radius);
  private sky = new THREE.Group();
  private skyMat = new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  private skyPaper = new THREE.MeshBasicMaterial({ color: C.foil, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  private swords = new THREE.InstancedMesh(katanaGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), TOTAL);
  private streaks = streakMesh(TOTAL);
  private flashes = new FloorFlashes(TOTAL);
  private flecks = new Flecks(360, 0.3);
  private shock = new ShockRefraction({ facing: 'ground' });
  private paper = new THREE.Color(C.foil);
  private steel = new THREE.Color(C.steel);
  private cin = new THREE.Color(C.accent);
  private cx = 0;
  private cz = 0;
  // per blade: its wave, landing spot, the second it lands, when it appears, how it hangs and lands
  private wave = new Uint8Array(TOTAL);
  private lx = new Float32Array(TOTAL);
  private lz = new Float32Array(TOTAL);
  private landT = new Float32Array(TOTAL);
  private appearT = new Float32Array(TOTAL);
  private hover = new Float32Array(TOTAL * 3); // dx, dy, dz
  private tilt = new Float32Array(TOTAL * 2); // final tilt about x and z
  private landed = new Uint8Array(TOTAL);
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(group: THREE.Group) {
    const outer = new THREE.Mesh(new THREE.RingGeometry(E.radius - 0.8, E.radius - 0.7, 72).rotateX(-Math.PI / 2), this.skyMat);
    const rim = new THREE.Mesh(new THREE.RingGeometry(E.radius - 0.7, E.radius - 0.66, 72).rotateX(-Math.PI / 2), this.skyPaper);
    outer.renderOrder = rim.renderOrder = 4;
    this.sky.add(outer, rim);
    this.sky.visible = false;
    this.swords.frustumCulled = false;
    this.swords.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.swords.count = 0;
    this.streaks.count = 0;
    group.add(this.ring.mesh, this.flashes.mesh, this.sky, this.swords, this.streaks, this.flecks.mesh, this.shock.mesh);
  }

  reset(c: Cast<Rain>) {
    this.landed.fill(0);
    this.ring.set(this.cx, this.cz, 0, 0, 0);
    this.sky.visible = false;
    this.swords.count = 0;
    this.streaks.count = 0;
    this.flashes.clear();
    this.flecks.clear();
    this.shock.set(c.from, 0, 0);
  }

  /** The ring's centre and every blade's place and times (the same on both screens: they come from the ring). */
  cast(c: Cast<Rain>) {
    const a = c.area;
    this.cx = a && a.kind === 'circle' ? a.x : c.ctx!.point.x;
    this.cz = a && a.kind === 'circle' ? a.z : c.ctx!.point.z;
    let i = 0;
    for (let w = 0; w < COUNTS.length; w++) {
      const n = COUNTS[w];
      for (let j = 0; j < n; j++, i++) {
        const r = (E.radius - 0.35) * Math.sqrt((j + 0.5) / n) * (0.9 + 0.1 * hash(i * 1.3 + 1));
        const ang = j * GOLDEN + w * 1.9 + 0.5 * hash(i * 2.9 + 2);
        this.wave[i] = w;
        this.lx[i] = this.cx + Math.cos(ang) * r;
        this.lz[i] = this.cz + Math.sin(ang) * r;
        this.landT[i] = E.waves[w] - 0.03 + 0.06 * hash(i * 3.7 + 3);
        this.appearT[i] = 0.1 + 0.7 * hash(i * 4.9 + 4) * (0.6 + 0.4 * (w / 2));
        this.hover[i * 3] = (hash(i * 5.3 + 5) - 0.5) * 0.7;
        this.hover[i * 3 + 1] = HOVER + 1.4 * hash(i * 6.1 + 6) + 0.3 * w;
        this.hover[i * 3 + 2] = (hash(i * 7.7 + 7) - 0.5) * 0.7;
        this.tilt[i * 2] = (hash(i * 8.3 + 8) - 0.5) * 0.34;
        this.tilt[i * 2 + 1] = (hash(i * 9.1 + 9) - 0.5) * 0.34;
      }
    }
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  frame(c: Cast<Rain>, t: number) {
    const last = E.waves[E.waves.length - 1];
    // the ring on the floor: painted by one stroke in 0.55 s, stronger toward the first wave, flashing paper at each wave, gone with the blades
    let flash = 0;
    for (const w of E.waves) if (t >= w) flash = Math.max(flash, Math.exp(-(t - w) * 11));
    const gone = 1 - smooth((t - FADE_AT - 0.1) / (FADE_LEN + 0.1));
    this.ring.set(this.cx, this.cz, easeOut(t / 0.55), (0.78 + 0.22 * smooth(t / E.waves[0])) * gone, flash);
    // the ring in the air, and its pulse at each wave
    const hang = smooth(t / 0.6) * (1 - smooth((t - last) / 0.5));
    this.sky.visible = hang > 0.01;
    this.sky.position.set(this.cx, SKY, this.cz);
    this.sky.scale.setScalar(1 - 0.04 * flash);
    this.skyMat.opacity = 0.7 * hang;
    this.skyPaper.opacity = 0.75 * hang;

    // the blades
    let shown = 0;
    for (let i = 0; i < TOTAL; i++) {
      const w = this.wave[i], big = w === COUNTS.length - 1 ? 1.2 : 1;
      const land = this.landT[i], start = land - DROP;
      const appear = smooth((t - this.appearT[i]) / 0.4);
      const fade = smooth((t - (FADE_AT + 0.3 * hash(i * 1.7 + 11))) / FADE_LEN);
      const hx = this.lx[i] + this.hover[i * 3], hz = this.lz[i] + this.hover[i * 3 + 2];
      const hy = this.hover[i * 3 + 1] + 0.12 * Math.sin(t * 2.2 + i);
      const htx = 0.06 * Math.sin(t * 1.3 + i * 2), htz = 0.06 * Math.cos(t * 1.1 + i);
      const ftx = this.tilt[i * 2], ftz = this.tilt[i * 2 + 1];
      const size = 0.8 * big; let x = hx, y = hy, z = hz, tx = htx, tz = htz, yaw = t * 0.7 + i, sw = 1;
      if (t >= start) {
        // falling, then stuck
        const k = Math.min(1, (t - start) / DROP), g = k * k;
        x = hx + (this.lx[i] - hx) * g;
        z = hz + (this.lz[i] - hz) * g;
        y = hy + (-EMBED - hy) * g;
        tx = htx + (ftx - htx) * g;
        tz = htz + (ftz - htz) * g;
        if (t >= land) {
          const a = t - land, q = 0.06 * Math.exp(-a * 3.2) * Math.sin(a * 38);
          tx = ftx + q; tz = ftz - q * 0.7;
          if (!this.landed[i]) {
            this.landed[i] = 1;
            this.bite(c, i, big);
          }
        }
        sw = 1 - fade;
      }
      const sc = size * appear * (t >= start ? 1 : 0.8);
      if (sc < 0.01 || sw < 0.01) { this.s.setScalar(1e-4); this.p.set(0, -9, 0); this.m.compose(this.p, this.q.identity(), this.s); this.swords.setMatrixAt(i, this.m); this.streaks.setMatrixAt(i, this.m); continue; }
      this.e.set(tx, yaw, tz);
      this.q.setFromEuler(this.e);
      this.p.set(x, y, z);
      this.s.set(sc * sw, sc, sc * sw);
      this.m.compose(this.p, this.q, this.s);
      this.swords.setMatrixAt(i, this.m);
      shown = i + 1;
      // the streak behind a falling blade
      if (t >= start && t < land + 0.03) {
        const k = Math.min(1, (t - start) / DROP);
        this.p.set(x, y + 2.3 * sc, z);
        this.s.set(0.42, 0.9 + 2.6 * k, 0.42);
        this.m.compose(this.p, this.q.identity(), this.s);
      } else {
        this.s.setScalar(1e-4); this.p.set(0, -9, 0);
        this.m.compose(this.p, this.q.identity(), this.s);
      }
      this.streaks.setMatrixAt(i, this.m);
    }
    this.swords.count = shown;
    this.streaks.count = shown;
    this.swords.instanceMatrix.needsUpdate = true;
    this.streaks.instanceMatrix.needsUpdate = true;

    // the flashes where the blades bit
    for (let i = 0; i < TOTAL; i++) {
      const age = (t - this.landT[i]) / 0.35;
      const big = this.wave[i] === COUNTS.length - 1 ? 1.35 : 1;
      this.flashes.set(i, this.lx[i], this.lz[i], 1.1 * big, age < 0 ? 1 : Math.min(1, age), hash(i * 2.1) * 3);
    }
    this.flashes.commit();

    // a ring of force at each wave
    let ring = 0, rq = 1;
    for (let w = 0; w < E.waves.length; w++) if (t >= E.waves[w] - 0.03) { ring = w + 1; rq = Math.min(1, (t - E.waves[w] + 0.03) / 0.38); }
    if (ring) this.shock.set(this.v.set(this.cx, 0, this.cz), (0.5 + 2.4 * rq) * (ring === 3 ? 1.1 : 1), (ring === 3 ? 0.07 : 0.05) * (1 - rq) * (1 - rq));
    else this.shock.set(this.v.set(this.cx, 0, this.cz), 0, 0);
  }

  /** A blade bites: paper flecks (rice paper, steel and a little cinnabar) thrown up from the spot. */
  private bite(c: Cast<Rain>, i: number, big: number) {
    const x = this.lx[i], z = this.lz[i];
    this.flecks.burst(x, 0.12, z, Math.round(4 * big), 2.6, 2.8, this.paper, 1.1);
    this.flecks.burst(x, 0.12, z, Math.round(2 * big), 2.2, 3.2, this.steel, 0.8);
    this.flecks.burst(x, 0.12, z, Math.round(2 * big), 2.2, 2.4, this.cin, 1.0);
    c.shake = Math.max(c.shake, this.wave[i] === COUNTS.length - 1 ? 0.35 : 0.2);
  }

  after(c: Cast<Rain>) {
    c.shake *= 0.85;
  }
}
export const senbonModule = spell<Rain>({
  label: 'senbon',
  category: 'hero: sheath',
  targeting: { mode: 'ground', radius: E.radius },
  seconds: E.waves[E.waves.length - 1] + 0.8,
  state: () => ({ wave: 1 }),
  rules: {
    windup: 0,
    delay: E.waves[0],
    shape: {
      kind: 'zone',
      area: (c) => ({ kind: 'circle', x: c.ctx!.point.x, z: c.ctx!.point.z, radius: E.radius }),
      until: E.waves[E.waves.length - 1] - E.waves[0] + 0.05,
    },
    hit: { damage: E.damage, knock: E.knock, color: C.accent },
    // the ring shows from the cast: its 1 s is exactly the walk out from the middle (0.25 + 3 / 4 s)
    warn: 0,
    on: {
      frame(c, t) {
        const ctx = c.ctx, area = c.area;
        if (!ctx || !area) return;
        while (c.state.wave < E.waves.length && t >= E.waves[c.state.wave]) {
          c.state.wave++;
          const caught: Enemy[] = [];
          for (const en of ctx.enemies?.() ?? ctx.targets) {
            const q = en.group.position;
            if (!insideTelegraph(area, q.x, q.z)) continue;
            ctx.hit(en, c.hitOptions(undefined, c.from.clone()));
            caught.push(en);
          }
          c.caught = caught;
        }
      },
    },
  },
  look: RainLook,
  bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.86 },
  frame: 5,
  maxDamage: 60,
});
