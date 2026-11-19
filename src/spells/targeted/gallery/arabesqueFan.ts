import * as THREE from 'three';
import { ShockRefraction } from '../../../effects/parts';
import type { Projectile } from '../../../effects/projectile';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Flecks } from '../../../heroes/sheath/partsBig';
import { Decals, GirihStars, Ribbon, clamp01, easeOut, hash, ringGeometry, smooth, starStampGeometry, tileHome } from './g9Parts';

/**
 * Arabesque fan (gallery 13, Persian girih tiles: cobalt and turquoise glaze, white glaze dots, gold lines). Five eight-pointed
 * tile stars thrown in a 50 degree fan, 9 m, 13 m/s (0.7 s to the reach) after a 0.85 s wind-up. The centre star is the cast's
 * bolt; the four others are bolts of their own (`ctx.projectile`, from `on.release`) along their own directions, each 34 damage and
 * a small shove to the first enemy it touches. Where a star stops (in an enemy, at a wall or at its reach) it shatters, so the hit
 * is each star's own. The danger zone is the centre star's line (the runner draws the cast's bolt only).
 *
 * The look. 0-0.62: a stack of loose tiles in her hand is flung out in a flourish, tile after tile, to five sites in a wide arc in
 * front of her, tumbling, and snaps together into five stars (a gold spark where each one closes). 0.62-0.85: the dead beat: the
 * stars hang still and tremble, the glaze catches a slow band of light, the gold lines ignite. The throw: the five arcs fold into the
 * fan, the stars spin flat at speed, each with a ribbon of glaze behind it and its shadow on the floor. The stop: the star drops and
 * shudders for 0.12 s, then the nine tiles go off in all directions, tumble, land flat and lie; a gold girih star is stamped on the
 * floor under them, a ring of force goes out. The tiles shrink away from 1.2 s after the stop, the stamp fades with them.
 * Palette: cobalt and turquoise (dark layer and accent, swapped star by star), white glaze (foil), gold (lines), a pale gold core.
 */
interface Fan {
  bolts: (Projectile | null)[];
  hitAt: ({ x: number; z: number } | null)[];
}

const N = 5;
const MID = 2;
const WIND = 0.85;
const SPEED = 14;
const RANGE = 9;
const FAN = (12.5 * Math.PI) / 180; // between neighbours: 50 degrees across the five
const RADIUS = 0.4;
const DAMAGE = 34;
const SC0 = 0.4; // a star's scale at the wind-up and at the throw's start
const SC1 = 0.7; // in flight
const FLY_Y = 1.05;
const REST_Y = 1.25;
const BEAT = 0.12; // after a stop: the star shudders, then goes off
const NP = 9;
const Y = new THREE.Vector3(0, 1, 0);

class FanLook implements Look<Fan> {
  private stars = new GirihStars(N);
  private shadows = new Decals(starStampGeometry(), N, '#080d1c', '#080d1c', 0, 0.32);
  private stamps = new Decals(starStampGeometry(), N, '#e0ae4a', '#27b8b0', 0.9, 0.1);
  private rings = new Decals(ringGeometry(0.8), N + 1, '#f3d58a', '#f3d58a', 0.85, 0);
  private ribbons: Ribbon[] = [];
  private shocks: ShockRefraction[] = [];
  private flecks = new Flecks(700, 0.2);
  private gold = new THREE.Color('#e0ae4a');
  private white = new THREE.Color('#f3eee2');
  private turq = new THREE.Color('#2cc4ba');
  private cobalt = new THREE.Color('#2b56b8');
  private hot = new THREE.Color('#fff0c4');
  private left = new THREE.Vector3(1, 0, 0);
  private hand = new THREE.Vector3();
  private rest: THREE.Vector3[] = [];
  private spin = new Float32Array(N);
  private stopAt = new Float32Array(N).fill(-1);
  private sx = new Float32Array(N);
  private sz = new Float32Array(N);
  private lastX = new Float32Array(N);
  private lastZ = new Float32Array(N);
  private lastY = new Float32Array(N);
  private lastS = new Float32Array(N);
  private done = new Uint8Array(N * NP);
  private starDone = new Uint8Array(N);
  private shattered = new Uint8Array(N);
  private trail = new Float32Array(N);
  private go = false;
  // per tile at the shatter: start (x, y, z), velocity (x, y, z), landing time, spin axis, spin rate, resting yaw
  private tx = new Float32Array(N * NP * 3);
  private tv = new Float32Array(N * NP * 3);
  private tl = new Float32Array(N * NP);
  private tw = new Float32Array(N * NP);
  private tq = new Float32Array(N * NP * 4); // the tile's orientation at the stop (x, y, z, w)
  private ty = new Float32Array(N * NP);
  private p = new THREE.Vector3();
  private o = new THREE.Vector3();
  private qh = new THREE.Quaternion();
  private qt = new THREE.Quaternion();
  private qf = new THREE.Quaternion();
  private ax = new THREE.Vector3();
  private e = new THREE.Euler();
  private c = new THREE.Vector3();

  constructor(group: THREE.Group) {
    for (let i = 0; i < N; i++) {
      this.rest.push(new THREE.Vector3());
      this.ribbons.push(new Ribbon(26, 0.16, 0.34, '#f3eee2', i % 2 ? '#2cc4ba' : '#2b56b8'));
      this.shocks.push(new ShockRefraction({ facing: 'ground' }));
    }
    group.add(this.shadows.mesh, this.stamps.mesh, this.rings.mesh, ...this.ribbons.map((r) => r.mesh), ...this.stars.meshes, this.flecks.mesh, ...this.shocks.map((s) => s.mesh));
    this.resetAll();
  }

  private resetAll() {
    for (let i = 0; i < N; i++) this.stars.hideStar(i);
    this.stars.flush();
    this.shadows.clear();
    this.stamps.clear();
    this.rings.clear();
    for (const r of this.ribbons) r.clear();
    this.flecks.clear();
    this.spin.fill(0);
    for (let i = 0; i < N; i++) this.spin[i] = hash(i * 3.3) * 6.28;
    this.stopAt.fill(-1);
    this.done.fill(0);
    this.starDone.fill(0);
    this.shattered.fill(0);
    this.trail.fill(0);
    this.go = false;
    this.stars.material.uniforms.uGlow.value = 0;
  }

  reset(c: Cast<Fan>) {
    this.resetAll();
    for (const s of this.shocks) s.set(c.from, 0, 0);
  }

  cast(c: Cast<Fan>) {
    this.left.set(c.dir.z, 0, -c.dir.x);
    this.hand.copy(c.from).addScaledVector(c.dir, 0.3).addScaledVector(this.left, 0.3).setY(1.2);
    for (let i = 0; i < N; i++) {
      const a = c.yaw + (i - MID) * FAN * 3;
      this.rest[i].set(c.from.x + Math.sin(a) * 1.3, REST_Y + (i % 2) * 0.08, c.from.z + Math.cos(a) * 1.3);
    }
  }

  tick(dt: number) {
    this.flecks.update(dt);
    for (const r of this.ribbons) r.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
    for (const r of this.ribbons) r.update(dt);
  }

  /** The release: the stars fly. */
  released(c: Cast<Fan>) {
    c.shake = 0.1;
    this.go = true;
    this.flecks.burst(this.hand.x, 1.2, this.hand.z, 14, 2.6, 1.5, this.gold, 0.7, 4);
    this.flecks.burst(this.hand.x, 1.2, this.hand.z, 8, 2.2, 1.5, this.white, 0.6, 4);
  }

  /** The centre star's bolt stopped. */
  stopped(c: Cast<Fan>, x: number, z: number) {
    this.stopStar(MID, c.time, x, z);
  }

  private stopStar(s: number, t: number, x: number, z: number) {
    if (this.stopAt[s] >= 0) return;
    this.stopAt[s] = t;
    this.sx[s] = x;
    this.sz[s] = z;
  }

  frame(c: Cast<Fan>, t: number, dt: number) {
    const u = this.stars.material.uniforms;
    u.uTime.value = t;
    // the dead beat: the gold lines ignite while everything hangs; the throw lets go
    const beat = smooth((t - 0.68) / 0.15);
    u.uGlow.value = this.go ? 0.18 * Math.exp(-(t - WIND) * 6) : 0.5 * beat * beat;
    for (let s = 0; s < N; s++) {
      if (this.stopAt[s] < 0 && c.released) this.pollStop(c, s, t);
      if (!c.released) this.assemble(c, s, t, dt);
      else if (this.stopAt[s] < 0) this.flight(c, s, t, dt);
      else this.burst(c, s, t, dt);
    }
    const ra = clamp01((t - WIND) / 0.4);
    this.rings.set(N, this.hand.x, this.hand.z, 0.5 + 1.4 * easeOut(ra), 0, 0.8 * (1 - ra) * (1 - ra) * (this.go ? 1 : 0));
    this.stars.flush();
    c.shake *= 0.9;
  }

  private bolt(c: Cast<Fan>, s: number): Projectile | null {
    return s === MID ? c.bolt : c.state.bolts[s];
  }

  /** A side star that died with no enemy in it (reach, wall) or that hit one: it stops where the bolt did. */
  private pollStop(c: Cast<Fan>, s: number, t: number) {
    if (s === MID) return;
    const b = c.state.bolts[s];
    if (!b || b.alive) return;
    const h = c.state.hitAt[s];
    if (h) this.stopStar(s, t, h.x, h.z);
    else this.stopStar(s, t, b.pos.x - b.dir.x * 0.2, b.pos.z - b.dir.z * 0.2);
  }

  /** The tile `k` of star `s`, whole, round `centre`, spun and tilted. */
  private whole(s: number, k: number, centre: THREE.Vector3, sc: number, tilt: THREE.Quaternion | null) {
    tileHome(k, this.spin[s], sc, this.o, this.qh);
    if (tilt) {
      this.o.applyQuaternion(tilt);
      this.qh.premultiply(tilt);
    }
    this.p.copy(centre).add(this.o);
    this.stars.put(s, k, this.p, this.qh, sc);
  }

  /** 0-0.85: the tiles are flung from her hand one by one and snap into five stars; then the beat. */
  private assemble(c: Cast<Fan>, s: number, t: number, dt: number) {
    this.spin[s] += 2.2 * dt;
    const site = this.rest[s];
    const shake = t > 0.66 ? Math.sin(t * 95 + s * 2) * 0.012 * smooth((t - 0.66) / 0.08) : 0;
    this.c.set(site.x + shake, site.y + 0.03 * Math.sin(t * 3 + s), site.z - shake * 0.7);
    let closed = 0;
    for (let k = 0; k < NP; k++) {
      const idx = s * NP + k;
      const h = hash(idx * 1.7 + 0.3);
      const delay = 0.03 + h * 0.36;
      const pr = clamp01((t - delay) / 0.24);
      if (pr >= 1) {
        closed++;
        this.whole(s, k, this.c, SC0, null);
        if (!this.done[idx]) {
          this.done[idx] = 1;
          if (k === 8 || hash(idx * 4.1) > 0.7) this.flecks.burst(this.c.x, this.c.y, this.c.z, 1, 0.8, 0.6, hash(idx) > 0.5 ? this.gold : this.white, 0.5, 2);
        }
        continue;
      }
      // from the stack in her hand to its place in the star, over an arc, tumbling
      tileHome(k, this.spin[s], SC0, this.o, this.qh);
      const e = easeOut(pr);
      this.p.set(
        this.hand.x + (this.c.x + this.o.x - this.hand.x) * e,
        this.hand.y + (this.c.y + this.o.y - this.hand.y) * e,
        this.hand.z + (this.c.z + this.o.z - this.hand.z) * e,
      );
      const arc = Math.sin(Math.PI * pr);
      this.p.y += arc * (0.35 + 0.5 * h);
      this.p.addScaledVector(this.left, arc * 0.35 * (h - 0.5) * 2);
      this.ax.set(hash(idx * 2.9) - 0.5, hash(idx * 3.7) - 0.5 + 0.7, hash(idx * 5.3) - 0.5).normalize();
      this.qt.setFromAxisAngle(this.ax, (1 - e) * (7 + 8 * h));
      this.qh.premultiply(this.qt);
      this.stars.put(s, k, this.p, this.qh, 0.1 + (SC0 - 0.1) * smooth(pr * 2));
    }
    if (closed === NP && !this.starDone[s]) {
      this.starDone[s] = 1;
      this.flecks.burst(this.c.x, this.c.y, this.c.z, 5, 1.3, 1.0, this.gold, 0.6, 2);
      this.rings.set(s, this.c.x, this.c.z, 0.5, 0, 0.7);
    }
    // its shadow comes with the star
    this.shadows.set(s, this.c.x, this.c.z, SC0 * 1.05, -this.spin[s], smooth(closed / NP));
    if (this.starDone[s]) {
      const a = clamp01((t - 0.2) / 0.3);
      if (t < 0.9) this.rings.set(s, this.c.x, this.c.z, 0.5 + 0.7 * easeOut(clamp01((t - 0.2) / 0.3)), 0, 0.7 * (1 - smooth(a)));
    }
  }

  /** The throw: the star follows its bolt, spinning flat, the wide arc folding into the fan; a ribbon and a shadow behind it. */
  private flight(c: Cast<Fan>, s: number, t: number, dt: number) {
    const b = this.bolt(c, s);
    if (!b) return;
    const flown = Math.min(RANGE, Math.hypot(b.pos.x - c.from.x, b.pos.z - c.from.z));
    const fold = 1 - smooth(flown / 1.9);
    const site = this.rest[s];
    const px = b.pos.x + (site.x - c.from.x) * fold;
    const pz = b.pos.z + (site.z - c.from.z) * fold;
    const py = FLY_Y + (REST_Y - FLY_Y) * fold;
    const sc = SC0 + (SC1 - SC0) * smooth(flown / 4);
    this.spin[s] += (2.2 + 14 * smooth((t - WIND) / 0.1)) * dt * (s % 2 ? -1 : 1);
    this.lastX[s] = px; this.lastY[s] = py; this.lastZ[s] = pz; this.lastS[s] = sc;
    this.c.set(px, py, pz);
    this.e.set(0.1 * Math.sin(t * 9 + s), 0, 0.1 * Math.cos(t * 7 + s * 2));
    this.qf.setFromEuler(this.e);
    for (let k = 0; k < NP; k++) this.whole(s, k, this.c, sc, this.qf);
    this.shadows.set(s, px, pz, sc * 1.05, -this.spin[s], 1);
    this.ribbons[s].push(px, py - 0.05, pz);
    this.trail[s] += dt;
    while (this.trail[s] > 0.035) {
      this.trail[s] -= 0.035;
      const i = Math.floor(t * 60) + s * 11;
      this.flecks.burst(px - c.dir.x * 0.1, py, pz - c.dir.z * 0.1, 1, 0.5, 0.3, hash(i) > 0.66 ? this.gold : hash(i * 1.3) > 0.5 ? this.white : s % 2 ? this.turq : this.cobalt, 0.55, 1.5);
    }
  }

  /** After the stop: the star drops and shudders, goes off in nine tiles that tumble, land flat and lie; the gold star is stamped. */
  private burst(c: Cast<Fan>, s: number, t: number, dt: number) {
    const ca = t - this.stopAt[s];
    const sx = this.sx[s], sz = this.sz[s];
    this.ribbons[s].update(0);
    if (ca < BEAT) {
      const k = ca / BEAT;
      const y = this.lastY[s] + (0.62 - this.lastY[s]) * easeOut(k * 1.6);
      const sh = Math.sin(ca * 120) * 0.035 * smooth(ca / 0.04);
      this.c.set(sx + sh, y, sz - sh * 0.7);
      const sc = this.lastS[s] * (1 + 0.1 * k);
      this.stars.material.uniforms.uGlow.value = Math.max(this.stars.material.uniforms.uGlow.value, 0.6 * k);
      for (let i = 0; i < NP; i++) this.whole(s, i, this.c, sc, null);
      this.shadows.set(s, sx, sz, sc * 1.05, -this.spin[s], 1 - 0.4 * k);
      this.stamps.set(s, sx, sz, 0.5 + 0.2 * k, -this.spin[s], 0.25 * k);
      c.shake = Math.max(c.shake, 0.04);
      return;
    }
    const u = ca - BEAT;
    const sc = this.lastS[s] * 1.1;
    if (!this.shattered[s]) {
      this.shattered[s] = 1;
      this.shatter(s, sx, sz, sc);
      c.shake = Math.max(c.shake, 0.2);
      this.stars.material.uniforms.uGlow.value = 0.5;
    }
    this.shadows.set(s, sx, sz, sc, 0, 0);
    // the tiles: thrown, tumbling, landed flat, lying, then shrinking away
    for (let k = 0; k < NP; k++) {
      const idx = s * NP + k, b = idx * 3;
      const h = hash(idx * 1.9 + 1);
      const flyT = Math.min(u, this.tl[idx]);
      const d = (1 - Math.exp(-2.4 * u)) / 2.4;
      const y = u < this.tl[idx] ? this.tx[b + 1] + this.tv[b + 1] * u - 5.5 * u * u : 0.09;
      this.p.set(this.tx[b] + this.tv[b] * d, y, this.tx[b + 2] + this.tv[b + 2] * d);
      const q4 = idx * 4;
      this.qh.set(this.tq[q4], this.tq[q4 + 1], this.tq[q4 + 2], this.tq[q4 + 3]);
      this.ax.set(hash(idx * 2.1) - 0.5, 0.6, hash(idx * 3.3) - 0.5).normalize();
      this.qt.setFromAxisAngle(this.ax, this.tw[idx] * flyT);
      this.qh.premultiply(this.qt);
      this.qf.setFromAxisAngle(Y, this.ty[idx]);
      this.qh.slerp(this.qf, smooth((u - this.tl[idx]) / 0.2));
      const fade = 1 - smooth((ca - (1.15 + 0.4 * h)) / 0.45);
      this.stars.put(s, k, this.p, this.qh, fade < 0.02 ? 1e-4 : sc * fade);
    }
    // the gold star stamped under them, the ring of force
    const stamp = easeOut(u / 0.4);
    this.stamps.set(s, sx, sz, 0.5 + 0.6 * stamp, -this.spin[s], smooth(ca / 0.25) * (1 - smooth((ca - 1.1) / 0.6)));
    const ra = clamp01(u / 0.35);
    this.rings.set(s, sx, sz, 0.35 + 1.8 * easeOut(ra), 0, 0.9 * (1 - ra) * (1 - ra));
    this.shocks[s].set(this.c.set(sx, 0, sz), 0.4 + 2.2 * ra, 0.05 * (1 - ra) * (1 - ra));
    this.stars.material.uniforms.uGlow.value *= Math.exp(-dt * 8);
  }

  private shatter(s: number, sx: number, sz: number, sc: number) {
    const y0 = 0.62;
    for (let k = 0; k < NP; k++) {
      const idx = s * NP + k, b = idx * 3;
      const h = hash(idx * 1.3 + 5);
      const ang = k < 8 ? this.spin[s] + k * (Math.PI / 4) : hash(idx) * 6.28;
      tileHome(k, this.spin[s], sc, this.o, this.qh);
      this.tx[b] = sx + this.o.x; this.tx[b + 1] = y0; this.tx[b + 2] = sz + this.o.z;
      const sp = k < 8 ? 2.4 + 2.2 * h : 0.8 + 0.6 * h;
      this.tv[b] = Math.cos(ang) * sp; this.tv[b + 1] = k < 8 ? 2.8 + 2.2 * h : 5 + h; this.tv[b + 2] = Math.sin(ang) * sp;
      this.tq[idx * 4] = this.qh.x; this.tq[idx * 4 + 1] = this.qh.y; this.tq[idx * 4 + 2] = this.qh.z; this.tq[idx * 4 + 3] = this.qh.w;
      const vy = this.tv[b + 1];
      this.tl[idx] = (vy + Math.sqrt(vy * vy + 22 * (y0 - 0.09))) / 11;
      this.tw[idx] = (hash(idx * 4.4) - 0.5) * 22;
      this.ty[idx] = -(ang + h * 1.2);
    }
    const x = sx, z = sz;
    this.flecks.burst(x, 0.6, z, 14, 3.6, 4.2, this.white, 1.0, 8);
    this.flecks.burst(x, 0.6, z, 12, 3.2, 4.4, s % 2 ? this.turq : this.cobalt, 1.1, 8);
    this.flecks.burst(x, 0.6, z, 9, 3.0, 4.6, this.gold, 1.0, 8);
    this.flecks.burst(x, 0.6, z, 3, 1.2, 1.4, this.hot, 0.5, 4);
  }
}

export const arabesqueFanModule = spell<Fan>({
  label: 'arabesque fan',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 0.5 },
  seconds: 3.3,
  state: () => ({ bolts: [null, null, null, null, null], hitAt: [null, null, null, null, null] }),
  rules: {
    windup: WIND,
    shape: { kind: 'bolt', speed: SPEED, range: RANGE, radius: RADIUS },
    hit: { damage: DAMAGE, knock: 2, color: '#e0ae4a' },
    warn: 0.02,
    on: {
      // the four other stars: bolts of their own, each along its own direction, with the cast's hit
      release(c) {
        const ctx = c.ctx;
        if (!ctx?.projectile) return;
        for (let i = 0; i < N; i++) {
          if (i === MID) continue;
          const a = c.yaw + (i - MID) * FAN;
          const bolt = ctx.projectile({
            from: c.from.clone(), dir: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), speed: SPEED, range: RANGE, radius: RADIUS,
            hit: c.hitOptions(),
          });
          bolt.onHit((_t, at) => { c.state.hitAt[i] = { x: at.x, z: at.z }; });
          c.state.bolts[i] = bolt;
        }
      },
    },
  },
  look: FanLook,
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.88 },
  frame: 7,
  maxDamage: 100,
});
