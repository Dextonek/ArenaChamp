import * as THREE from 'three';
import { ShockRefraction } from '../../../effects/parts';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Flecks } from '../../../heroes/sheath/partsBig';
import { FloorCracks, backOut, clamp01, crystalGeometry, easeOut, facetMaterial, hash, rockGeometry, smooth } from './g5Parts';

/**
 * Geode heart (gallery 6, amethyst geode: grey rind, violet crystal, quartz white). A 10 m skillshot: a slow, heavy grey stone
 * (9 m/s, 1.1 s to its reach) thrown after a 0.3 s wind-up. The first enemy it touches takes 48 and a small shove; where it stops
 * (in that enemy, at a wall, at its reach) the stone cracks open and violet crystals spear out of the hollow. The crystals are the
 * aftermath only: the hit is the bolt's, so the danger zone is the bolt's line and nothing else.
 *
 * The look. 0-0.3: slabs of rind rise from the floor round her hand and gather into a stone, drawn back. The throw: the stone tumbles
 * slowly, a hairline of violet light leaks through it and grows, grey dust falls from it, a dark shadow runs on the floor under it.
 * The stop: it drops, shakes and glows for 0.18 s (the dead beat) while cracks begin to run on the floor; then the rind bursts into
 * chunks, a violet-pale flash and a ring of force, and 35 crystals spear out in four rings (three tall spires in the middle, shorter
 * and flatter outward) in 0.65 s, each overshooting a little and settling, with a flash as it grows; facets twinkle. At 1.3 s after
 * the crack they shrink away, outer ones first, shedding quartz and violet flecks; the cracks fade with them. Clean 2.0 s after the stop.
 * Palette: rind grey (dark layer), violet (accent), quartz white (foil beside every violet), a pale pink-violet hot core, rarely.
 */
interface Geode { _?: never }

const WIND = 0.3;
const SPEED = 9;
const RANGE = 10;
const FLY_Y = 1.25; // how high the stone leaves
const END_Y = 0.75; // and how low it has sunk at its reach
const CRACK_AT = 0.18; // after the stop: the dead beat, then the rind goes
const CHUNKS = 7;
const RINGS = [3, 7, 11, 14];
const NC = RINGS.reduce((a, b) => a + b, 0);
const FADE_START = 1.3; // after the crack
const GOLDEN = 2.39996;
const Y = new THREE.Vector3(0, 1, 0);

class GeodeLook implements Look<Geode> {
  private rind = facetMaterial(false);
  private crys = facetMaterial(true);
  private stone: THREE.InstancedMesh;
  private chunks: THREE.InstancedMesh;
  private crystals: THREE.InstancedMesh;
  private tint: THREE.InstancedBufferAttribute;
  private cracks = new FloorCracks(3.2);
  private flash = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#d9b6ff', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  private shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#0d0912', transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  );
  private flecks = new Flecks(520, 0.26);
  private shock = new ShockRefraction({ facing: 'ground' });
  private grey = new THREE.Color('#8c8696');
  private rindDark = new THREE.Color('#4a4552');
  private violet = new THREE.Color('#9a5cf0');
  private quartz = new THREE.Color('#efe6fa');
  private pink = new THREE.Color('#e7b8ff');
  // per crystal: ring, offset round the stop, lean (rad from upright), spin, length, thickness, delay, when it shrinks away
  private ring = new Uint8Array(NC);
  private ox = new Float32Array(NC);
  private oz = new Float32Array(NC);
  private ang = new Float32Array(NC);
  private lean = new Float32Array(NC);
  private spin = new Float32Array(NC);
  private len = new Float32Array(NC);
  private wid = new Float32Array(NC);
  private delay = new Float32Array(NC);
  private fadeAt = new Float32Array(NC);
  private born = new Uint8Array(NC);
  // per chunk: launch velocity (x, y, z), spin axis angles
  private cv = new Float32Array(CHUNKS * 4);
  private hand = new THREE.Vector3();
  private left = new THREE.Vector3(1, 0, 0);
  private stopAt = -1;
  private cracked = false;
  private faded = false;
  private sx = 0;
  private sz = 0;
  private dust = 0;
  private lastY = FLY_Y;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private ax = new THREE.Vector3();

  constructor(group: THREE.Group) {
    this.stone = new THREE.InstancedMesh(rockGeometry(1, 0.2, 3), this.rind, 1);
    this.chunks = new THREE.InstancedMesh(rockGeometry(0, 0.3, 17), this.rind, CHUNKS);
    const cg = crystalGeometry();
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(NC * 2), 2);
    this.tint.setUsage(THREE.DynamicDrawUsage);
    cg.setAttribute('aTint', this.tint);
    this.crystals = new THREE.InstancedMesh(cg, this.crys, NC);
    for (const mesh of [this.stone, this.chunks, this.crystals]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    this.flash.renderOrder = this.shadow.renderOrder = 3;
    this.flash.visible = this.shadow.visible = false;
    // the crystals: ring by ring, from the three spires of the middle to the low flat ones at the edge
    let k = 0;
    for (let r = 0; r < RINGS.length; r++) {
      const n = RINGS[r];
      for (let j = 0; j < n; j++, k++) {
        const h = (a: number) => hash(k * a + r * 5.1);
        this.ring[k] = r;
        const a = j * (r === 0 ? 2.1 : (Math.PI * 2) / n) + r * 0.9 + 0.4 * h(1.7);
        const dist = [0.12 + 0.06 * j, 0.55 + 0.3 * h(2.3), 1.0 + 0.6 * h(2.9), 1.7 + 0.7 * h(3.3)][r];
        this.ang[k] = a;
        this.ox[k] = Math.cos(a) * dist;
        this.oz[k] = Math.sin(a) * dist;
        this.lean[k] = r === 0 ? 0.08 + 0.17 * j : [0, 0.5 + 0.25 * h(4.1), 0.8 + 0.25 * h(4.7), 1.0 + 0.25 * h(5.3)][r];
        this.spin[k] = h(6.1) * Math.PI;
        this.len[k] = 1.25 * (r === 0 ? 2.1 - 0.3 * j : [0, 1.3 + 0.45 * h(7.1), 0.85 + 0.4 * h(7.7), 0.45 + 0.35 * h(8.3)][r]);
        this.wid[k] = 1.2 * (r === 0 ? 0.34 - 0.05 * j : [0, 0.2 + 0.06 * h(9.1), 0.15 + 0.05 * h(9.7), 0.11 + 0.04 * h(10.3)][r]);
        this.delay[k] = [0, 0.04, 0.1, 0.16][r] + 0.1 * h(11.1);
        this.fadeAt[k] = FADE_START + (RINGS.length - 1 - r) * 0.1 + 0.06 * h(12.1);
      }
    }
    for (let i = 0; i < CHUNKS; i++) {
      const a = i * GOLDEN + 0.5;
      this.cv[i * 4] = Math.cos(a) * (2.0 + 2.2 * hash(i * 1.9 + 3));
      this.cv[i * 4 + 1] = 3.2 + 2.2 * hash(i * 2.3 + 5);
      this.cv[i * 4 + 2] = Math.sin(a) * (2.0 + 2.2 * hash(i * 1.9 + 3));
      this.cv[i * 4 + 3] = (hash(i * 3.7) - 0.5) * 9;
    }
    this.hideAll();
    group.add(this.cracks.mesh, this.shadow, this.flash, this.stone, this.chunks, this.crystals, this.flecks.mesh, this.shock.mesh);
  }

  private hide(mesh: THREE.InstancedMesh, i: number) {
    this.m.makeScale(1e-4, 1e-4, 1e-4);
    mesh.setMatrixAt(i, this.m);
  }

  private hideAll() {
    for (let i = 0; i < CHUNKS; i++) this.hide(this.chunks, i);
    for (let i = 0; i < NC; i++) this.hide(this.crystals, i);
    this.hide(this.stone, 0);
    this.chunks.instanceMatrix.needsUpdate = this.crystals.instanceMatrix.needsUpdate = this.stone.instanceMatrix.needsUpdate = true;
  }

  reset(c: Cast<Geode>) {
    this.stopAt = -1;
    this.cracked = this.faded = false;
    this.dust = 0;
    this.born.fill(0);
    this.tint.array.fill(0);
    this.tint.needsUpdate = true;
    this.hideAll();
    this.cracks.set(0, 0, 0, 0, 0);
    this.flash.visible = this.shadow.visible = false;
    this.rind.uniforms.uGlow.value = 0;
    this.flecks.clear();
    this.shock.set(c.from, 0, 0);
  }

  cast(c: Cast<Geode>) {
    this.left.set(c.dir.z, 0, -c.dir.x);
    this.hand.copy(c.from).addScaledVector(c.dir, 0.3).addScaledVector(this.left, 0.3).setY(1.3);
  }

  tick(dt: number) {
    this.flecks.update(dt);
  }

  idle(dt: number) {
    this.flecks.update(dt);
  }

  released(c: Cast<Geode>) {
    c.shake = 0.06;
  }

  /** The stone has stopped (in an enemy, a wall or at its reach): it sits where it is until `CRACK_AT`. */
  stopped(c: Cast<Geode>, x: number, z: number) {
    this.stopAt = c.time;
    this.sx = x;
    this.sz = z;
  }

  /** Where the stone is, on the way: the bolt's own spot, easing from her hand at the start; height sinking over the flight. */
  private stonePos(c: Cast<Geode>, out: THREE.Vector3) {
    const b = c.bolt!;
    const flown = Math.min(RANGE, Math.hypot(b.pos.x - c.from.x, b.pos.z - c.from.z));
    const blend = 1 - smooth(flown / 1.4);
    out.set(b.pos.x, FLY_Y + (END_Y - FLY_Y) * (flown / RANGE), b.pos.z);
    out.x += (this.hand.x - c.from.x) * blend - c.dir.x * 0.3 * blend;
    out.z += (this.hand.z - c.from.z) * blend - c.dir.z * 0.3 * blend;
    out.y += (this.hand.y - FLY_Y) * blend;
    return flown;
  }

  private setStone(x: number, y: number, z: number, scale: number, rx: number, ry: number, rz: number) {
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.p.set(x, y, z);
    this.s.setScalar(Math.max(1e-4, scale));
    this.m.compose(this.p, this.q, this.s);
    this.stone.setMatrixAt(0, this.m);
    this.stone.instanceMatrix.needsUpdate = true;
  }

  frame(c: Cast<Geode>, t: number, dt: number) {
    this.rind.uniforms.uTime.value = t;
    this.crys.uniforms.uTime.value = t;
    this.windup(c, t);
    if (this.stopAt < 0) this.flight(c, t, dt);
    else this.aftermath(c, t - this.stopAt);
  }

  /** 0-0.3: slabs of rind rise from the floor round her hand and gather into the stone, drawn back. */
  private windup(c: Cast<Geode>, t: number) {
    const k = clamp01(t / (WIND - 0.03));
    for (let i = 0; i < CHUNKS; i++) {
      if (t >= WIND - 0.02 || this.cracked) { if (!this.cracked) this.hide(this.chunks, i); continue; }
      const a = i * GOLDEN + 0.5, rr = 1.2 + 0.5 * hash(i * 1.3);
      const gather = k * k;
      const x = this.hand.x + Math.cos(a) * rr * (1 - gather), z = this.hand.z + Math.sin(a) * rr * (1 - gather);
      const y = 0.1 + (this.hand.y - 0.1) * easeOut(k) * 0.9 + 0.3 * hash(i * 2.1) * (1 - gather);
      this.e.set(t * 6 + i, t * 5 + i * 2, i);
      this.q.setFromEuler(this.e);
      this.p.set(x, y, z);
      this.s.setScalar(0.3 * smooth(t / 0.08) * (1 - 0.5 * gather));
      this.m.compose(this.p, this.q, this.s);
      this.chunks.setMatrixAt(i, this.m);
    }
    this.chunks.instanceMatrix.needsUpdate = true;
    if (t < WIND && this.stopAt < 0) {
      // the stone itself pops into being in the last tenth, drawn back and trembling
      const pop = smooth((t - 0.17) / 0.12);
      const back = smooth(t / 0.25);
      const tr = Math.sin(t * 90) * 0.012 * pop;
      this.setStone(this.hand.x - c.dir.x * 0.3 * back + tr, this.hand.y + 0.05 * back, this.hand.z - c.dir.z * 0.3 * back, 0.6 * pop, 0.4, t * 3, 0.2);
      this.rind.uniforms.uGlow.value = 0.1 * pop;
    }
  }

  private flight(c: Cast<Geode>, t: number, dt: number) {
    if (!c.bolt || !c.bolt.alive) return;
    const pos = this.p;
    const flown = this.stonePos(c, pos);
    const px = pos.x, py = pos.y, pz = pos.z;
    const prog = flown / RANGE;
    this.lastY = py;
    const ft = t - WIND;
    // heavy and slow: a tumble, the glow leaking through the rind grows
    this.setStone(px, py, pz, 0.6, ft * 3.1 + 0.4, ft * 2.3, ft * 1.7 + 0.2);
    this.rind.uniforms.uGlow.value = 0.18 + 0.55 * prog + 0.12 * Math.sin(ft * 16);
    this.shadow.visible = true;
    this.shadow.position.set(px, 0.03, pz);
    this.shadow.scale.setScalar(0.5 + 0.1 * (1 - py / 1.4));
    // grey dust falls from it, a violet fleck now and then
    this.dust += dt;
    while (this.dust > 0.03) {
      this.dust -= 0.03;
      const i = Math.floor((t + this.dust) * 40);
      this.flecks.burst(px, py - 0.15, pz, 1, 0.5, 0.2, hash(i) > 0.7 ? this.violet : hash(i * 1.3) > 0.5 ? this.grey : this.rindDark, 0.9, 2.5);
    }
    c.shake *= 0.9;
  }

  private aftermath(c: Cast<Geode>, a: number) {
    const sx = this.sx, sz = this.sz;
    const beat = a < CRACK_AT;
    const ca = a - CRACK_AT; // seconds after the rind went
    this.shadow.visible = false;

    if (beat) {
      // the dead beat: the stone drops to the floor, shakes, glows hard; the floor begins to crack
      const k = easeOut(a / 0.1);
      const y0 = this.lastY;
      const y = y0 + (0.5 - y0) * k;
      const sh = Math.sin(a * 110) * 0.03 * smooth(a / 0.05);
      this.setStone(sx + sh, y, sz - sh * 0.7, 0.6 * (1 + 0.04 * Math.sin(a * 70)), 0.4 + sh, 0.9, 0.2);
      this.rind.uniforms.uGlow.value = 0.6 + 3.0 * (a / CRACK_AT);
      this.cracks.set(sx, sz, easeOut((a - 0.02) / 0.5) * 0.25, 0.4 + 0.6 * (a / CRACK_AT), 1);
      c.shake = Math.max(c.shake * 0.9, 0.05 + 0.05 * (a / CRACK_AT));
      return;
    }

    if (!this.cracked) {
      // the break: rind chunks fly, a flash, a ring of force, flecks
      this.cracked = true;
      this.hide(this.stone, 0);
      this.stone.instanceMatrix.needsUpdate = true;
      this.flecks.burst(sx, 0.4, sz, 16, 3.4, 4.0, this.grey, 1.1, 8);
      this.flecks.burst(sx, 0.4, sz, 10, 3.0, 4.6, this.violet, 1.0, 8);
      this.flecks.burst(sx, 0.4, sz, 8, 2.6, 5.0, this.quartz, 0.9, 8);
      this.flash.position.set(sx, 0.05, sz);
      this.flash.visible = true;
      c.shake = Math.max(c.shake, 0.3);
    }

    // the chunks: thrown out, land, lie a while, shrink away
    for (let i = 0; i < CHUNKS; i++) {
      const vx = this.cv[i * 4], vy = this.cv[i * 4 + 1], vz = this.cv[i * 4 + 2], sp = this.cv[i * 4 + 3];
      const d = (1 - Math.exp(-3 * ca)) / 3;
      const y = Math.max(0.1, 0.5 + vy * ca - 8 * ca * ca);
      const land = y <= 0.1 ? 1 : 0;
      const sc = 0.3 * (1 - smooth((ca - 0.9) / 0.4));
      if (sc < 0.01) { this.hide(this.chunks, i); continue; }
      this.e.set(sp * ca * (1 - land * 0.9) + i, sp * 0.7 * ca * (1 - land * 0.9), i * 0.5);
      this.q.setFromEuler(this.e);
      this.p.set(sx + vx * d, y, sz + vz * d);
      this.s.setScalar(sc);
      this.m.compose(this.p, this.q, this.s);
      this.chunks.setMatrixAt(i, this.m);
    }
    this.chunks.instanceMatrix.needsUpdate = true;
    this.rind.uniforms.uGlow.value = 0.8;

    // the flash on the floor and the ring of force
    const fl = Math.exp(-ca * 9);
    (this.flash.material as THREE.MeshBasicMaterial).opacity = 0.55 * fl;
    this.flash.scale.setScalar(0.8 + ca * 6);
    this.flash.visible = fl > 0.02;
    const sg = clamp01(ca / 0.4);
    this.shock.set(this.p.set(sx, 0, sz), 0.4 + 2.6 * sg, 0.06 * (1 - sg) * (1 - sg));
    c.shake = Math.max(c.shake * 0.88, 0.28 * Math.exp(-ca * 9));

    // the cracks run out and then fade with the crystals
    const fadeAll = 1 - smooth((ca - (FADE_START + 0.1)) / 0.5);
    this.cracks.set(sx, sz, 0.25 + 0.75 * easeOut(ca / 0.55), 0.25 + 0.75 * Math.exp(-ca * 2.2), fadeAll);

    this.crystalsAt(ca, sx, sz);
  }

  private crystalsAt(ca: number, sx: number, sz: number) {
    const tint = this.tint.array as Float32Array;
    for (let i = 0; i < NC; i++) {
      const dur = 0.4 + 0.1 * hash(i * 1.1);
      const g = (ca - this.delay[i]) / dur;
      const shrink = 1 - smooth((ca - this.fadeAt[i]) / 0.28);
      if (g <= 0 || shrink < 0.01) { this.hide(this.crystals, i); continue; }
      const grow = backOut(g);
      const thick = 0.35 + 0.65 * smooth(g * 2);
      const bx = sx + this.ox[i], bz = sz + this.oz[i];
      this.ax.set(Math.sin(this.ang[i]), 0, -Math.cos(this.ang[i]));
      this.q.setFromAxisAngle(this.ax, this.lean[i]);
      this.q2.setFromAxisAngle(Y, this.spin[i]);
      this.q.multiply(this.q2);
      this.p.set(bx, -0.08, bz);
      this.s.set(this.wid[i] * thick * (0.4 + 0.6 * shrink), this.len[i] * grow * shrink, this.wid[i] * thick * (0.4 + 0.6 * shrink));
      this.m.compose(this.p, this.q, this.s);
      this.crystals.setMatrixAt(i, this.m);
      tint[i * 2] = hash(i * 4.7 + 2);
      tint[i * 2 + 1] = 1 - smooth((ca - this.delay[i] - 0.05) / 0.55);
      if (!this.born[i] && g > 0.1) {
        this.born[i] = 1;
        if (this.ring[i] < 3) this.flecks.burst(bx, 0.1, bz, 2, 1.6, 2.4, hash(i * 9.1) > 0.5 ? this.quartz : this.pink, 0.8, 8);
      }
    }
    this.crystals.instanceMatrix.needsUpdate = true;
    this.tint.needsUpdate = true;
    if (!this.faded && ca >= FADE_START) {
      // they let go: quartz and violet dust over the cluster
      this.faded = true;
      for (let k = 0; k < 4; k++) {
        const a = k * 1.7;
        this.flecks.burst(sx + Math.cos(a) * 0.9, 0.5, sz + Math.sin(a) * 0.9, 8, 1.8, 2.2, k % 2 ? this.violet : this.quartz, 1.1, 3);
      }
    }
  }

  after(c: Cast<Geode>) {
    c.shake *= 0.9;
  }
}

export const geodeHeartModule = spell<Geode>({
  label: 'geode heart',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 0.45 },
  seconds: 3.5,
  state: () => ({}),
  rules: {
    windup: WIND,
    shape: { kind: 'bolt', speed: SPEED, range: RANGE, radius: 0.45 },
    hit: { damage: 48, knock: 2, color: '#b27cf5' },
    warn: 0.02,
  },
  look: GeodeLook,
  bloom: { enabled: true, strength: 0.35, radius: 0.4, threshold: 0.88 },
  frame: 5,
  maxDamage: 120,
});
