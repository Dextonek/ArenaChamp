import * as THREE from 'three';
import type { Enemy } from '../../../effects/common';
import type { Look } from '../../../heroes/framework/blocks';
import { spell, type Cast } from '../../../heroes/framework/spell';
import { Chips, Flecks, LaneFloor, bubbleFlecks, clamp01, easeOut, hash, paint, smooth } from './g8Parts';

/**
 * Coral bastion (gallery 8, pipeline/designs/gallery-20.md). A wall of reef raised along a lane from the caster toward the aim,
 * 8 m long and 1.6 m wide, in 0.8 s from his end to the far one: whoever the growing front passes inside the lane is hit once
 * (38, a small knock). It is a look only, not an obstacle. Answer: leave the lane before the front reaches you, 0.8 m to its
 * edge: 0.25 + 0.8 / 4 = 0.45 s; the zone shows 0.9 s.
 * On the blocks: a lane with no move whose `front` is the growth (`late` = the growth time).
 */
const WIND = 0.9; // the water gathers, the dead beat is the last quarter second
const BEAT = WIND - 0.25;
const GROW = 0.8; // the front's travel
const LEN = 8;
const WID = 1.6;
const BLEACH = 2.3;
const CRUMBLE = 2.7;
const DURATION = 3.5;

const COLORS = {
  deep: '#0a1f2c', // the dark layer: deep water
  coral: '#ff7a59', // the accent: coral
  coralHi: '#ff9f7c',
  pink: '#ee5a86',
  magenta: '#a8366f',
  foam: '#c8f5e6', // the pale foil: sea-foam
  hot: '#fff0b0', // the hot core: a few polyp tips
  bone: '#f0e6d2',
  sand: '#ddc590',
};

/** The reef as one geometry in lane space (x across, z along from the caster), each segment growing from its own base. */
function buildReef(): { geo: THREE.BufferGeometry; colonies: { x: number; z: number; t: number }[] } {
  const pos: number[] = [], col: number[] = [], base: number[] = [], par: number[] = [];
  const colonies: { x: number; z: number; t: number }[] = [];
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
  const palette = [COLORS.coral, COLORS.coralHi, COLORS.pink, COLORS.magenta, COLORS.coral].map((c) => new THREE.Color(c));
  const deep = new THREE.Color(COLORS.deep), foam = new THREE.Color(COLORS.foam), hot = new THREE.Color(COLORS.hot);
  const tint = new THREE.Color();
  let seed = 1;

  const add = (g: THREE.BufferGeometry, bx: number, by: number, bz: number, start: number, dur: number, rnd: number, kind: number) => {
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      col.push(c.getX(i), c.getY(i), c.getZ(i));
      base.push(bx, by, bz);
      par.push(start, dur, rnd, kind);
    }
  };

  const branch = (b: THREE.Vector3, d: THREE.Vector3, len: number, r: number, depth: number, start: number, tone: THREE.Color, cz: number) => {
    const sd = seed++;
    const dur = 0.2 + 0.03 * depth;
    const g = new THREE.CylinderGeometry(r * 0.66, r, len, 6, 1, false);
    g.translate(0, len / 2, 0);
    q.setFromUnitVectors(up, d);
    g.applyQuaternion(q);
    g.translate(b.x, b.y, b.z);
    tint.copy(tone).lerp(deep, 0.5 - 0.15 * depth);
    add(paint(g, tint, { seed: sd, vary: 0.1, smooth: true }), b.x, b.y, b.z, start, dur, hash(sd * 1.9), 0);
    const end = b.clone().addScaledVector(d, len);
    if (depth < 3) {
      const kids = depth === 0 ? 3 : 2;
      const az0 = hash(sd * 3.1) * 6.28;
      for (let k = 0; k < kids; k++) {
        const az = az0 + (k / kids) * 6.28 + (hash(sd * 7.7 + k) - 0.5) * 0.7;
        const tilt = 0.5 + 0.35 * hash(sd * 5.3 + k);
        const axis = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const p1 = new THREE.Vector3().crossVectors(d, axis).normalize();
        const p2 = new THREE.Vector3().crossVectors(d, p1);
        const nd = d.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(p1, Math.sin(tilt) * Math.cos(az)).addScaledVector(p2, Math.sin(tilt) * Math.sin(az));
        nd.y += 0.28;
        if (Math.abs(end.x) > 0.55) nd.x -= Math.sign(end.x) * 0.5;
        nd.normalize();
        branch(end, nd, len * 0.8, r * 0.68, depth + 1, start + dur * 0.72, tone, cz);
      }
    } else {
      const glow = hash(sd * 2.7) < 0.2;
      const tg = paint(new THREE.IcosahedronGeometry(r * 1.45, 0).translate(end.x, end.y, end.z), glow ? hot : foam, { seed: sd, vary: 0.06 });
      add(tg, end.x, end.y, end.z, start + dur * 0.75, 0.1, hash(sd * 1.3), glow ? 1 : 0);
    }
  };

  // the staghorn: a branching antler, twelve along the line
  const STAG = 15;
  for (let i = 0; i < STAG; i++) {
    const z = 0.4 + i * (LEN - 0.8) / (STAG - 1);
    const x = (hash(i * 3.7 + 1) - 0.5) * 0.9;
    const start = (z / LEN) * GROW * 0.85;
    const tone = palette[i % palette.length];
    colonies.push({ x, z, t: start });
    const lean = new THREE.Vector3((hash(i * 5.9) - 0.5) * 0.3, 1, (hash(i * 6.3) - 0.5) * 0.3).normalize();
    branch(new THREE.Vector3(x, -0.02, z), lean, 0.72, 0.115, 0, start, tone, z);
  }

  // a brain mound with a ring of tube sponges, between the antlers
  for (let i = 0; i < 6; i++) {
    const z = 0.9 + i * 1.3, side = i % 2 ? 1 : -1;
    const x = side * (0.45 + 0.2 * hash(i * 8.1));
    const start = (z / LEN) * GROW * 0.85 + 0.04;
    colonies.push({ x, z, t: start });
    const dome = new THREE.SphereGeometry(0.4, 9, 6);
    dome.scale(1, 0.6, 1);
    dome.translate(x, 0, z);
    add(paint(dome, palette[(i + 2) % palette.length], { seed: 40 + i, vary: 0.1, smooth: true }), x, 0, z, start, 0.28, hash(i * 9.3), 0);
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7 + i, bx = x + Math.cos(a) * 0.17, bz = z + Math.sin(a) * 0.17;
      const bump = new THREE.SphereGeometry(0.13, 6, 5);
      bump.scale(1, 0.7, 1);
      bump.translate(bx, 0.2, bz);
      add(paint(bump, foam, { seed: 50 + i * 4 + k, vary: 0.08, smooth: true }), bx, 0.12, bz, start + 0.1, 0.16, hash(i * 4 + k + 3), 0);
    }
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i * 0.7 + 1, rr = 0.55 + 0.1 * k, h = 0.45 + 0.4 * hash(i * 3 + k + 11);
      const tx = x + Math.cos(a) * rr * 0.8, tz = z + Math.sin(a) * rr;
      const tube = new THREE.CylinderGeometry(0.1, 0.075, h, 7, 1, false);
      tube.translate(tx, h / 2, tz);
      add(paint(tube, '#8a3d95', { seed: 60 + i * 3 + k, vary: 0.1, smooth: true }), tx, 0, tz, start + 0.06 + 0.05 * k, 0.22, hash(i * 3 + k + 7), 0);
      const mouth = new THREE.CylinderGeometry(0.075, 0.075, 0.03, 7).translate(tx, h + 0.005, tz);
      add(paint(mouth, deep, { seed: 70 + k, vary: 0.05, smooth: true }), tx, h, tz, start + 0.14 + 0.05 * k, 0.1, hash(i * 3 + k + 17), 0);
    }
  }

  // a table coral: a plate on a stem, a foam rim
  for (let i = 0; i < 3; i++) {
    const z = 1.6 + i * 2.6, x = (i % 2 ? -1 : 1) * 0.3;
    const start = (z / LEN) * GROW * 0.85 + 0.02;
    colonies.push({ x, z, t: start });
    const stem = new THREE.CylinderGeometry(0.06, 0.09, 0.5, 6).translate(x, 0.25, z);
    add(paint(stem, COLORS.magenta, { seed: 80 + i, vary: 0.1, smooth: true }), x, 0, z, start, 0.2, hash(i * 2.1 + 19), 0);
    const plate = new THREE.CylinderGeometry(0.55, 0.26, 0.14, 9).translate(x, 0.56, z);
    add(paint(plate, COLORS.pink, { seed: 90 + i, vary: 0.1, smooth: true }), x, 0.5, z, start + 0.12, 0.22, hash(i * 2.1 + 23), 0);
    const rim = new THREE.CylinderGeometry(0.57, 0.57, 0.06, 9, 1, true).translate(x, 0.63, z);
    add(paint(rim, foam, { seed: 100 + i, vary: 0.06, smooth: true }), x, 0.6, z, start + 0.2, 0.18, hash(i * 2.1 + 29), 0);
  }

  colonies.sort((a, b) => a.t - b.t);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aBase', new THREE.Float32BufferAttribute(base, 3));
  geo.setAttribute('aP', new THREE.Float32BufferAttribute(par, 4));
  return { geo, colonies };
}

/** The reef's material: segments grow from their bases, then bleach to bone and sink to sand, all in the vertex shader. */
function reefMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uGrow: { value: 0 }, uBleach: { value: 0 }, uCrumble: { value: 0 }, uPulse: { value: 0 },
      uBone: { value: new THREE.Color(COLORS.bone) }, uSandC: { value: new THREE.Color(COLORS.sand) }, uHot: { value: new THREE.Color(COLORS.hot) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aCol; attribute vec3 aBase; attribute vec4 aP;
      uniform float uGrow, uCrumble;
      varying vec3 vCol; varying float vZ, vR, vKind;
      void main() {
        float g = clamp((uGrow - aP.x) / aP.y, 0.0, 1.0);
        float e = (1.0 + 2.7 * pow(g - 1.0, 3.0) + 1.7 * pow(g - 1.0, 2.0)) * step(0.0001, g);
        float s = 1.0 - smoothstep(aP.z * 0.55, aP.z * 0.55 + 0.35, uCrumble);
        vec3 p = aBase + (position - aBase) * e * s;
        p.y -= (1.0 - s) * aBase.y * 0.9;
        vCol = aCol; vZ = position.z / ${LEN.toFixed(1)}; vR = aP.z; vKind = aP.w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vZ, vR, vKind;
      uniform float uBleach, uCrumble, uPulse; uniform vec3 uBone, uSandC, uHot;
      void main() {
        float b = clamp((uBleach - vZ * 0.35 - vR * 0.2) / 0.45, 0.0, 1.0);
        float lum = dot(vCol, vec3(0.3, 0.5, 0.2));
        vec3 c = mix(vCol, uBone * (0.7 + 0.5 * lum), b);
        c = mix(c, uSandC * (0.65 + 0.5 * lum), smoothstep(0.1, 0.7, uCrumble) * b);
        c = mix(c, uHot, vKind * uPulse * (1.0 - b));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

const FISH = 36;

/** Little reef fish: a school gathers by the line during the wind-up and bolts away from the growth as it reaches them. */
class School {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  constructor() {
    const pts = [
      // body: a flat lozenge along +x, nose at +x
      [0.5, 0, 0], [0, 0.17, 0], [0, 0, 0.07], [0.5, 0, 0], [0, 0, 0.07], [0, -0.17, 0],
      [0.5, 0, 0], [0, 0, -0.07], [0, 0.17, 0], [0.5, 0, 0], [0, -0.17, 0], [0, 0, -0.07],
      [0, 0.17, 0], [-0.36, 0, 0.03], [0, 0, 0.07], [0, -0.17, 0], [0, 0, 0.07], [-0.36, 0, 0.03],
      [0, 0.17, 0], [0, 0, -0.07], [-0.36, 0, -0.03], [0, -0.17, 0], [-0.36, 0, -0.03], [0, 0, -0.07],
      // tail fin
      [-0.34, 0, 0], [-0.62, 0.22, 0], [-0.62, -0.22, 0], [-0.34, 0, 0], [-0.62, -0.22, 0], [-0.62, 0.22, 0],
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    const g = paint(geo, '#ffffff', { vary: 0.1, both: true });
    const c = g.attributes.color;
    for (let i = 0; i < c.count; i++) {
      const x = g.attributes.position.getX(i), k = x > 0.2 ? 1.15 : x < -0.3 ? 0.75 : 1;
      c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
    }
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), FISH);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const gold = new THREE.Color('#ffb53d'), teal = new THREE.Color('#47d6c4'), pale = new THREE.Color(COLORS.foam), col = new THREE.Color();
    for (let i = 0; i < FISH; i++) this.mesh.setColorAt(i, col.copy(i % 3 === 0 ? gold : i % 3 === 1 ? teal : pale).multiplyScalar(0.85 + 0.3 * hash(i * 4.1)));
  }

  /** Where fish `i` is `t` s after the cast, in lane space (x across, y up, z along). */
  private at(i: number, t: number, out: THREE.Vector3) {
    const hz = LEN * (0.03 + 0.94 * ((i + hash(i * 2.1)) / FISH));
    const hx = (i % 2 ? 1 : -1) * (0.65 + 0.9 * hash(i * 3.3));
    const hy = 0.3 + 0.9 * hash(i * 5.1);
    const w = 1.7 + 1.1 * hash(i * 7.7), ph = hash(i * 9.1) * 6.28, r = 0.26 + 0.2 * hash(i * 11.3);
    const tf = WIND + GROW * 0.85 * (hz / LEN) - 0.06; // the growth reaches it
    const swirl = (tt: number, o: THREE.Vector3) => {
      const gather = smooth((tt - BEAT + 0.12) / 0.12) * (1 - smooth((tt - WIND + 0.03) / 0.05));
      const a = w * Math.min(tt, tf) + ph;
      o.set(hx * (1 - 0.45 * gather) + Math.cos(a) * r, hy + Math.sin(a * 1.3) * 0.12, hz + Math.sin(a) * r);
    };
    if (t <= tf) { swirl(t, out); return; }
    swirl(tf, out);
    const tau = t - tf, d = (1 - Math.exp(-2.4 * tau)) / 2.4;
    out.x += Math.sign(hx) * (2.8 + 1.5 * hash(i * 13.3)) * d;
    out.y += (1.4 + 1.2 * hash(i * 15.1)) * d;
    out.z += (1.4 + 2.2 * hash(i * 17.9)) * d;
  }

  update(t: number, c: Cast<null>) {
    const dx = c.dir.x, dz = c.dir.z, lx = dz, lz = -dx;
    for (let i = 0; i < FISH; i++) {
      const hz = LEN * (0.03 + 0.94 * ((i + hash(i * 2.1)) / FISH));
      const tf = WIND + GROW * 0.85 * (hz / LEN) - 0.06;
      const appear = smooth((t - 0.3 - 0.25 * hash(i * 6.1)) / 0.2) * (1 - smooth((t - tf - 0.75) / 0.45));
      this.at(i, t, this.a);
      this.at(i, t + 0.03, this.b);
      const wx = (v: THREE.Vector3) => c.from.x + dx * v.z + lx * v.x;
      const wz = (v: THREE.Vector3) => c.from.z + dz * v.z + lz * v.x;
      const vx = wx(this.b) - wx(this.a), vz = wz(this.b) - wz(this.a);
      this.p.set(wx(this.a), this.a.y, wz(this.a));
      this.e.set(0, Math.atan2(-vz, vx), Math.sin(t * 22 + i * 1.7) * 0.28, 'YXZ');
      this.q.setFromEuler(this.e);
      this.s.setScalar(Math.max(0.42 * appear, 1e-4));
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

class CoralLook implements Look<null> {
  private reef: THREE.Mesh;
  private mat = reefMaterial();
  private colonies: { x: number; z: number; t: number }[];
  private floor = new LaneFloor(LEN, WID + 0.3, 0, { dark: COLORS.deep, acc: COLORS.coral, pale: COLORS.foam, hot: COLORS.hot, sand: COLORS.sand });
  private school = new School();
  private bubbles = bubbleFlecks(140, 0.17);
  private sand = new Flecks(220, 0.13);
  private chips = new Chips(80, [COLORS.coral, COLORS.pink, COLORS.bone, COLORS.coralHi, COLORS.sand]);
  private foam = new THREE.Color(COLORS.foam);
  private sandC = new THREE.Color(COLORS.sand);
  private coral = new THREE.Color(COLORS.coral);
  private next = 0;
  private acc = 0;
  private n = 0;
  private crumbled = 0;

  constructor(group: THREE.Group) {
    const built = buildReef();
    this.colonies = built.colonies;
    this.reef = new THREE.Mesh(built.geo, this.mat);
    this.reef.frustumCulled = false;
    this.reef.visible = false;
    group.add(this.floor.group, this.reef, this.school.mesh, this.bubbles.mesh, this.sand.mesh, this.chips.mesh);
  }

  reset() {
    this.next = 0;
    this.acc = 0;
    this.n = 0;
    this.crumbled = 0;
    this.reef.visible = false;
    this.floor.set(0, 0, 0, 0, 0, 0);
    this.school.mesh.visible = false;
    this.bubbles.clear();
    this.sand.clear();
    this.chips.clear();
  }

  tick(dt: number) {
    this.bubbles.update(dt);
    this.sand.update(dt);
    this.chips.update(dt);
  }

  idle(dt: number) {
    this.bubbles.update(dt);
    this.sand.update(dt);
    this.chips.update(dt);
  }

  /** World position of lane space (x across, z along). */
  private world(c: Cast<null>, x: number, z: number, out: THREE.Vector3, y = 0) {
    return out.set(c.from.x + c.dir.x * z + c.dir.z * x, y, c.from.z + c.dir.z * z - c.dir.x * x);
  }

  private v = new THREE.Vector3();

  struck(c: Cast<null>, who: Enemy) {
    const p = who.group.position;
    this.chips.burst(p.x, 0.5, p.z, 9, 0, 2.2, 0, 2.6, 0.13, 1.4);
    this.bubbles.burst(p.x, 0.5, p.z, 10, 1.4, 1.8, this.foam, 0.9, -1.4);
    this.sand.burst(p.x, 0.2, p.z, 10, 2.2, 2.4, this.coral, 0.9, 6);
    c.shake = Math.max(c.shake, 0.2);
  }

  frame(c: Cast<null>, t: number, dt: number) {
    const m = this.mat.uniforms;
    this.floor.place(c.from.x, c.from.z, c.dir.x, c.dir.z);
    this.reef.position.set(c.from.x, 0, c.from.z);
    this.reef.rotation.y = Math.atan2(c.dir.x, c.dir.z);
    const hush = smooth((t - BEAT) / 0.1) * (1 - smooth((t - WIND) / 0.05));
    const ct = t < BEAT ? t : t < WIND ? BEAT + (t - BEAT) * 0.15 : BEAT + 0.04 + (t - WIND);
    const sand = smooth((t - CRUMBLE - 0.1) / 0.6);
    const fade = 1 - smooth((t - 3.05) / 0.45);
    this.floor.set(ct, easeOut(t / 0.55) * 1.04, smooth(t / 0.2) * (1 - 0.3 * hush) * fade, hush, 0, sand);

    // the water gathers: bubbles and sand lift off the line, rising faster toward the beat, then nothing moves
    if (t < BEAT) {
      this.acc += dt * (14 + 22 * smooth(t / BEAT));
      while (this.acc >= 1) {
        this.acc -= 1;
        const s = this.n++, z = hash(s * 1.7 + 2) * LEN * clamp01(t / 0.55 + 0.1), x = (hash(s * 2.3 + 5) - 0.5) * WID;
        this.world(c, x, z, this.v);
        if (s % 3) this.bubbles.burst(this.v.x, 0.05, this.v.z, 1, 0.1, 0.5, this.foam, 1.1, -1.3);
        else this.sand.burst(this.v.x, 0.05, this.v.z, 1, 0.3, 1.1, this.sandC, 0.8, 4);
      }
    }
    this.school.mesh.visible = t > 0.3 && t < 3.0;
    if (this.school.mesh.visible) this.school.update(t, c);

    // the growth
    const gt = Math.max(0, t - WIND);
    m.uGrow.value = gt;
    this.reef.visible = t >= WIND && t < DURATION - 0.02;
    while (this.next < this.colonies.length && gt >= this.colonies[this.next].t) {
      const k = this.colonies[this.next++];
      this.world(c, k.x, k.z, this.v);
      this.sand.burst(this.v.x, 0.1, this.v.z, 8, 1.5, 1.6, this.sandC, 0.8, 6);
      this.bubbles.burst(this.v.x, 0.2, this.v.z, 4, 0.5, 0.8, this.foam, 1.0, -1.5);
      this.chips.burst(this.v.x, 0.15, this.v.z, 2, 0, 1.5, 0, 1.6, 0.08, 1.0);
    }
    if (t >= WIND && t < WIND + 0.14) c.shake = Math.max(c.shake, 0.14);
    else if (gt > 0 && gt < GROW + 0.3) c.shake = Math.max(c.shake, 0.06);

    // hold: the polyp tips pulse; then it bleaches along its length, then crumbles to sand
    m.uPulse.value = t > 1.7 && t < BLEACH + 0.2 ? 0.5 + 0.5 * Math.sin((t - 1.7) * 9) : 0;
    m.uBleach.value = clamp01((t - BLEACH) / 0.75) * 1.25;
    const cr = clamp01((t - CRUMBLE) / 0.75);
    m.uCrumble.value = cr;
    if (cr > 0 && cr < 1 && this.crumbled < 400) {
      this.acc += dt * 60;
      while (this.acc >= 1) {
        this.acc -= 1;
        const s = this.n++, k = this.colonies[s % this.colonies.length];
        this.world(c, k.x + (hash(s * 1.3) - 0.5) * 0.7, k.z + (hash(s * 2.9) - 0.5) * 0.7, this.v, 0.25 + 1.0 * hash(s * 3.7));
        this.sand.burst(this.v.x, this.v.y, this.v.z, 2, 0.5, -0.5, this.sandC, 0.9, 7);
        if (s % 4 === 0) this.chips.burst(this.v.x, this.v.y, this.v.z, 1, 0, 0, 0, 0.8, 0.12, 1.1);
        this.crumbled++;
      }
    }
  }

  after(c: Cast<null>) {
    c.shake *= 0.86;
  }
}

export const coralBastionModule = spell<null>({
  label: 'coral bastion',
  category: 'targeted',
  targeting: { mode: 'ground', radius: WID / 2 },
  seconds: DURATION,
  state: () => null,
  rules: {
    windup: WIND,
    // no move: the lane's clock runs over one second, so the growth maps that onto its own time
    shape: { kind: 'lane', length: LEN, width: WID, late: GROW, front: (c, even) => Math.min(c.reach, even / GROW) },
    hit: { damage: 38, knock: 1.2, color: '#ff7a59' },
  },
  look: CoralLook,
  noScreen: true,
  bloom: { enabled: true, strength: 0.4, radius: 0.45, threshold: 0.85 },
  frame: 8,
  maxDamage: 120,
});
