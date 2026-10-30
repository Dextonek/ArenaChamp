import * as THREE from 'three';
import { Emitter } from '../../emitter';
import { smoothstep } from '../../effects/common';
import {
  BLOOD, BLOOD_CSS, BloodDrops, BloodSigil, BloodTendril, ShockRefraction, StarBurst, clearScreenFx, createScreenFx,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Crimson Pact (blood kit, E: TETHER drain): arms spread, a bone sigil draws on under the caster and blood rises
 * from both palms into a heart of liquid blood above her head. The heart beats (lub-dub); on every beat a bone ring
 * pulses across the floor and a thin thread of blood whips out of the NEAREST enemy within 6 m (only that one) into
 * the heart, snaps taut, carries drops home and pulls back in; three beats drain it three times and she heals what
 * each beat deals (a target that walks beyond 6 m is not drained), while four long tendrils orbit the caster as a living cage. The heart then
 * contracts and splits into three beads that settle into orbit; the cage unravels into drops and the beads fade.
 * With `loop` on, the beat section (0.6..2.6) repeats seamlessly. See pipeline/designs/crimson-pact.md (MOBA timing).
 */
export interface CrimsonPactSettings {
  /** Damage of each of the three drains; she heals the same amount. */
  damage: number;
  loop: boolean;
}

export const defaultCrimsonPact = (): CrimsonPactSettings => ({ damage: 12, loop: false });

// Timeline (seconds). The beat section [LOOP_A, LOOP_B) is one cycle per beat period times two beats.
const OPEN_END = 0.3;
const HEART_END = 0.6;
const LOOP_A = 0.6;
const LOOP_B = 2.6;
const PERIOD = 1.0;
const SEAL_END = 3.0;
const DURATION = 3.2;
const RADIUS = 6;
const BEATS = [LOOP_A, LOOP_A + 0.7, LOOP_A + 1.4]; // three drains
const HEART_UP = 3.3;
const HEART_R = 0.55;
const BEAD_R = 0.12;
const MAX_THREADS = 10;
const ORBITS = 4;
const ORBIT_ARC = 2.0; // radians covered by one orbit tendril
const ORBIT_W = Math.PI / PERIOD; // rad/s: half a turn per beat period, so the 4-tendril cage repeats seamlessly

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x: number) => Math.pow(clamp01(x), 2);
/** 0 before x = 0, rises to 1 in `att`, then releases slowly over `rel`. */
const env = (x: number, att: number, rel: number) => (x < 0 ? 0 : x < att ? x / att : 1 - smoothstep((x - att) / rel));

// ---------------------------------------------------------------------------------------------------------------
// The heart: a lumpy liquid blob (vertex noise on a smooth icosphere), the kit's liquid look.
// ---------------------------------------------------------------------------------------------------------------

function blobMaterial(amp: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBody: { value: new THREE.Color(BLOOD.body) },
      uDark: { value: new THREE.Color(BLOOD.dark) },
      uHot: { value: new THREE.Color(BLOOD.hot) },
      uCore: { value: new THREE.Color(BLOOD.core) },
      uTime: { value: 0 },
      uAmp: { value: amp },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uAmp;
      varying vec3 vN; varying vec3 vView;
      float lump(vec3 p) {
        // Three clear lobes (fixed directions) plus a slow wobble.
        float l = 0.0;
        l += exp(2.6 * (dot(p, normalize(vec3(0.8, 0.5, 0.3))) - 1.0));
        l += exp(2.6 * (dot(p, normalize(vec3(-0.7, 0.2, 0.7))) - 1.0));
        l += 0.8 * exp(2.6 * (dot(p, normalize(vec3(0.0, -0.8, -0.6))) - 1.0));
        return 2.2 * l - 1.0 + 0.35 * sin(dot(p, vec3(2.3, -1.9, 2.9)) + uTime * 2.0) * sin(p.y * 3.0 - uTime * 1.5);
      }
      void main() {
        vec3 n0 = normalize(position);
        float d = lump(n0) * uAmp;
        vec3 p = n0 * (1.0 + d);
        // Gradient by finite differences, tangential part tilts the normal.
        float e = 0.01;
        float f0 = lump(n0);
        vec3 g = vec3(lump(n0 + vec3(e, 0.0, 0.0)) - f0, lump(n0 + vec3(0.0, e, 0.0)) - f0, lump(n0 + vec3(0.0, 0.0, e)) - f0) / e;
        g -= n0 * dot(g, n0);
        vec3 ln = normalize(n0 - uAmp * g / (1.0 + d));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec3 n = normalMatrix * ln;
        vN = n / max(length(n), 1e-6);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    // Same look as the liquid fragment in effects/parts/blood.ts.
    fragmentShader: /* glsl */ `
      uniform vec3 uBody, uDark, uHot, uCore;
      varying vec3 vN; varying vec3 vView;
      void main() {
        vec3 n = normalize(vN), v = normalize(vView);
        vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
        float ndl = dot(n, L);
        float f = 1.0 - abs(dot(n, v));
        vec3 col = uBody;
        col = mix(col, uDark, step(ndl, 0.0) * 0.5);
        if (f > 0.58 && ndl > -0.1) col = uHot;
        if (f > 0.70) col = uDark;
        float spec = dot(n, normalize(L + v));
        if (spec > 0.9985 && f < 0.5) col = uCore * 0.85;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export class CrimsonPact implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CrimsonPactSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  // Cast geometry, computed in cast().
  private from = new THREE.Vector3(0, 0, 14);
  private side = new THREE.Vector3(1, 0, 0);
  private heartPos = new THREE.Vector3(0, HEART_UP, 14);
  private chest = new THREE.Vector3(0, 1.25, 14);
  private handL = new THREE.Vector3();
  private handR = new THREE.Vector3();

  private beatFired = [false, false, false];
  private beatHit = [false, false, false];
  /** The nearest enemy within RADIUS at the cast, the one the heart latches onto (null = nobody in reach). */
  private tether: CastContext['targets'][number] | null = null;
  private sealed = false;
  private healed = false;

  // Parts.
  private sigil = new BloodSigil();
  private openT = [new BloodTendril({ segments: 32 }), new BloodTendril({ segments: 32 })];
  private veins = [new BloodTendril({ segments: 20 }), new BloodTendril({ segments: 20 })];
  private orbits: BloodTendril[] = [];
  private threads: BloodTendril[] = [];
  private threadFrom: THREE.Vector3[] = [];
  private threadPts: THREE.Vector3[][] = [];
  private heartMat = blobMaterial(0.11);
  private beadMat = blobMaterial(0.03);
  private heart = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 5), this.heartMat);
  private beads = [0, 1, 2].map(() => new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), this.beadMat));
  private pulses = Array.from({ length: MAX_THREADS }, () => new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), this.beadMat));
  private stubs = [new BloodTendril({ segments: 12 }), new BloodTendril({ segments: 12 })];
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(0.975, 1, 96),
    new THREE.MeshBasicMaterial({ color: BLOOD.bone, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private groundShock = new ShockRefraction({ facing: 'ground' });
  private drops = new BloodDrops({ maxDrops: 64, maxSplats: 10 });
  private chestPulse = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: BLOOD.hot, core: BLOOD.bone, additive: false });

  // Scratch.
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(settings: CrimsonPactSettings = defaultCrimsonPact()) {
    this.settings = settings;
    this.screen.impactColor.set(BLOOD.bone);

    for (const t of this.openT) { t.width = 0.17; t.bead = 1.4; t.wobble = 0.02; }
    for (const t of this.stubs) { t.width = 0.15; t.bead = 1.3; t.wobble = 0.01; }
    for (const t of this.veins) { t.width = 0.1; t.bead = 1.5; t.wobble = 0.015; }
    for (let i = 0; i < ORBITS; i++) {
      const t = new BloodTendril({ segments: 36 });
      t.width = 0.2;
      t.bead = 1.3;
      t.wobble = 0.015;
      t.setFunction((u, out) => this.orbitPath(i, u, out));
      this.orbits.push(t);
    }
    for (let i = 0; i < MAX_THREADS; i++) {
      const t = new BloodTendril({ segments: 24 });
      t.width = 0.1;
      t.bead = 1.0;
      t.wobble = 0.02;
      const pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
      t.setPoints(pts);
      this.threads.push(t);
      this.threadPts.push(pts);
      this.threadFrom.push(new THREE.Vector3());
    }
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.05;
    this.drops.splats.life = 0.3;
    this.drops.splats.dryAt = 0.05;
    this.drops.onArrive = () => { /* the heart absorbs them silently; the beat itself is the accent */ };

    this.group.add(
      this.sigil.mesh, ...this.openT.map((t) => t.mesh), ...this.veins.map((t) => t.mesh),
      ...this.orbits.map((t) => t.mesh), ...this.threads.map((t) => t.mesh), ...this.pulses, ...this.stubs.map((t) => t.mesh), this.heart, ...this.beads, this.ring,
      this.groundShock.mesh, this.drops.mesh, this.chestPulse.mesh,
    );
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return LOOP_A;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    const aim = ctx.aim;
    this.side.set(Math.cos(aim), 0, -Math.sin(aim));
    this.heartPos.copy(this.from).setY(HEART_UP);
    this.chest.copy(this.from).setY(1.25);
    this.handL.copy(this.from).addScaledVector(this.side, -0.75).setY(1.3);
    this.handR.copy(this.from).addScaledVector(this.side, 0.75).setY(1.3);
    this.sigil.set(this.v1.copy(this.from).setY(0.04), this.v2.set(0, 1, 0), 2.2);
    this.tether = null;
    let best = RADIUS;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      const d = p ? Math.hypot(p.x - ctx.from.x, p.z - ctx.from.z) : Infinity;
      if (d <= best) { best = d; this.tether = e; }
    });
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.heartPos);
    // The open tendrils: palm, out and up, to the heart point.
    [this.handL, this.handR].forEach((h, i) => {
      const s = i === 0 ? -1 : 1;
      this.openT[i].setPoints([
        h.clone(),
        h.clone().addScaledVector(this.side, s * 0.4).add(this.v1.set(0, 0.7, 0)),
        this.from.clone().addScaledVector(this.side, s * 0.6).setY(2.9),
        this.heartPos.clone(),
      ]);
    });
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    this.beatFired = [false, false, false];
    this.beatHit = [false, false, false];
    this.sealed = false;
    this.healed = false;
    clearScreenFx(this.screen);
    this.drops.reset();
    this.drops.mesh.visible = true;
    this.sigil.reset();
    for (const t of [...this.openT, ...this.veins, ...this.stubs, ...this.orbits, ...this.threads]) t.reset();
    for (const m of this.pulses) m.visible = false;
    this.heart.visible = false;
    for (const b of this.beads) b.visible = false;
    this.ring.visible = false;
    this.groundShock.set(this.from, 0, 0);
    this.chestPulse.set(this.chest, 0, 0);
    this.layout();
  }

  /** Orbit tendril i at u in 0..1 (root trailing, tip leading), a short arc at waist height tilted +-12 degrees. */
  private orbitPath(i: number, u: number, out: THREE.Vector3) {
    const th = i * (Math.PI * 2 / ORBITS) + ORBIT_W * this.time + (u - 1) * ORBIT_ARC;
    const R = i % 2 === 0 ? 1.4 : 1.8;
    const tilt = (i % 2 === 0 ? 1 : -1) * (12 * Math.PI) / 180;
    const sz = Math.sin(th) * R;
    return out.set(
      this.from.x + Math.cos(th) * R,
      1.0 + sz * Math.sin(tilt) + 0.08 * Math.sin(2 * th + i),
      this.from.z + sz * Math.cos(tilt),
    );
  }

  /** Heartbeat pulse parts (lub, dub) 0..1 at time t; zero outside the beat section. */
  private beatEnv(t: number): [number, number] {
    if (t < LOOP_A || t >= LOOP_B) return [0, 0];
    const p = (t - LOOP_A) % PERIOD;
    return [env(p, 0.05, 0.2), env(p - 0.22, 0.04, 0.2)];
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.drops.update(dt);
    this.time += dt;
    if (this.time >= LOOP_B && this.settings.loop) {
      // Seamless: every beat visual is a pure function of the phase inside the section.
      this.time -= LOOP_B - LOOP_A;
      this.beatFired = [false, false, false];
      this.beatHit = [false, false, false];
    }
    if (this.time >= DURATION) {
      this.playing = false;
      this.time = DURATION;
      this.layout();
      clearScreenFx(this.screen);
      this.shake = 0;
      this.hideAll();
      return;
    }
    const t = this.time;
    const ctx = this.ctx;

    // Beats: threads, drops, hits.
    for (let k = 0; k < BEATS.length; k++) {
      const tb = BEATS[k];
      if (!this.beatFired[k] && t >= tb && t < LOOP_B) {
        this.beatFired[k] = true;
        if (this.tether) {
          this.threadFrom[0].copy(this.tether.group.position).setY(1.1);
          this.drops.drain(this.threadFrom[0], (out) => out.copy(this.heartPos), 4, {
            delay: 0.08, stagger: 0.04, duration: 0.35, radius: 0.09, spread: 0.2,
          });
        }
      }
      if (!this.beatHit[k] && t >= tb + 0.08 && t < LOOP_B) {
        this.beatHit[k] = true;
        // The tether holds only while the enemy stays within 6 m (live position); the drain heals her.
        const e = this.tether;
        if (ctx && e && Math.hypot(e.group.position.x - this.from.x, e.group.position.z - this.from.z) <= RADIUS) {
          ctx.hit(e, { damage: this.settings.damage, knock: 0, from: ctx.from, color: BLOOD_CSS.body });
          ctx.healSelf?.(this.settings.damage * 0.5); // the drain returns half of what it takes
        }
      }
    }

    // Seal: the cage unravels into a few drops that fall and splat.
    if (!this.sealed && t >= LOOP_B) {
      this.sealed = true;
      for (let i = 0; i < ORBITS; i++) {
        this.orbitPath(i, 1, this.v1);
        for (let d = 0; d < 2; d++) {
          this.v2.set(this.v1.x - this.from.x, 0, this.v1.z - this.from.z).normalize().multiplyScalar(1.0 + Math.random() * 0.6);
          this.v2.y = -2 - Math.random();
          this.drops.emit(this.v1, this.v2, 0.06 + Math.random() * 0.03, 1);
        }
      }
    }
    if (!this.healed && t >= SEAL_END) this.healed = true;

    this.layout();
    this.drops.mesh.visible = t < 3.15;
  }

  private hideAll() {
    for (const t of [...this.openT, ...this.veins, ...this.stubs, ...this.orbits, ...this.threads]) t.mesh.visible = false;
    for (const m of this.pulses) m.visible = false;
    this.heart.visible = false;
    for (const b of this.beads) b.visible = false;
    this.ring.visible = false;
    this.sigil.opacity = 0;
    this.groundShock.set(this.from, 0, 0);
    this.chestPulse.set(this.chest, 0, 0);
    this.drops.reset();
  }

  private layout() {
    const t = this.time;
    this.heartMat.uniforms.uTime.value = t;
    this.beadMat.uniforms.uTime.value = t;
    const sealT = t - LOOP_B;
    const inSeal = t >= LOOP_B;
    const [lub, dub] = this.beatEnv(t);

    // --- Sigil: draws on while the arms open, fades in the seal. ---
    this.sigil.reveal = smoothstep(t / OPEN_END);
    this.sigil.opacity = 1 - smoothstep((sealT - 0.05) / 0.35);

    // --- 0..0.3 open, 0.3..0.6 knot: blood rises from both palms and is absorbed into the heart. ---
    const openOn = t < HEART_END;
    for (const tn of this.openT) {
      tn.head = easeOut(t / OPEN_END);
      tn.tail = smoothstep((t - OPEN_END) / (HEART_END - OPEN_END));
      tn.mesh.visible = openOn && t > 0;
      if (openOn && t > 0) tn.update(t);
    }

    // --- The heart: grows 0.3..0.6, beats, contracts in the seal. ---
    let hs = HEART_R * easeOut((t - OPEN_END) / (HEART_END - OPEN_END));
    hs *= 1 + 0.18 * lub + 0.1 * dub;
    if (inSeal) hs *= 1 - 0.8 * easeIn(sealT / 0.2);
    const heartOn = t > OPEN_END && sealT < 0.2;
    this.heart.visible = heartOn;
    this.heart.position.copy(this.heartPos);
    this.heart.scale.setScalar(Math.max(hs, 1e-4));
    // A beat lifts the body colour a little towards the hot red (stays far below the bloom threshold).
    const pulse = Math.min(1, lub + dub * 0.6);
    (this.heartMat.uniforms.uBody.value as THREE.Color).setHex(0x6a0a1a).lerp(this.v1c.setHex(BLOOD.hot).multiplyScalar(0.55), pulse * 0.45);

    // --- Two short vein tendrils hanging from the heart. ---
    this.veins.forEach((vn, i) => {
      const s = i === 0 ? -1 : 1;
      const sway = Math.sin(t * 3 + i * 2) * 0.06;
      const h = this.heartPos;
      vn.setPoints(this.veinPts[i].map((p, j) => {
        const k = j / 3;
        return p.set(h.x + this.side.x * (s * 0.18 + sway * k), h.y - 0.4 - 0.9 * k, h.z + this.side.z * (s * 0.18 + sway * k));
      }));
      vn.head = easeOut((t - 0.45) / 0.15);
      vn.tail = smoothstep(sealT / 0.25);
      const on = t > 0.45 && sealT < 0.25;
      vn.mesh.visible = on;
      if (on) vn.update(t);
    });

    // --- Two short aorta stubs on top of the heart. ---
    this.stubs.forEach((st, i) => {
      const s = i === 0 ? -1 : 1, h = this.heartPos, top = h.y + hs * 0.8;
      st.setPoints(this.stubPts[i].map((p, j) => {
        const k = j / 3;
        return p.set(h.x + this.side.x * s * (0.12 + 0.12 * k), top + 0.4 * k, h.z + this.side.z * s * (0.12 + 0.12 * k));
      }));
      st.head = easeOut((t - 0.45) / 0.15);
      st.tail = smoothstep(sealT / 0.2);
      const on = t > 0.45 && sealT < 0.2;
      st.mesh.visible = on;
      if (on) st.update(t);
    });

    // --- Orbit cage: grows in 0.3..0.6, a little thicker on each beat, unravels in the seal. ---
    this.orbits.forEach((tn) => {
      tn.head = easeOut((t - OPEN_END) / (HEART_END - OPEN_END));
      tn.tail = smoothstep(sealT / 0.25);
      tn.width = 0.2 + 0.035 * lub;
      const on = t > OPEN_END && sealT < 0.25;
      tn.mesh.visible = on;
      if (on) tn.update(t);
    });

    // --- Beats: ring on the floor, ground refraction, threads. ---
    let ringK = 0;
    let ringOn = false;
    for (let k = 0; k < BEATS.length; k++) {
      const age = this.beatAge(t, k);
      if (age >= 0 && age < 0.5 && t < LOOP_B) { ringK = age / 0.5; ringOn = true; }
    }
    this.ring.visible = ringOn;
    if (ringOn) {
      const r = 0.5 + (RADIUS - 0.5) * easeOut(ringK);
      this.ring.position.set(this.from.x, 0.05, this.from.z);
      this.ring.scale.setScalar(r);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - ringK) * Math.min(1, ringK * 12 + 0.3);
      this.groundShock.set(this.from, r, 0.025 * (1 - ringK) * (1 - ringK));
    } else {
      this.groundShock.set(this.from, 0, 0);
    }

    const n = this.tether ? 1 : 0;
    if (this.tether) this.threadFrom[0].copy(this.tether.group.position).setY(1.1); // the thread follows the enemy
    for (let i = 0; i < MAX_THREADS; i++) {
      const th = this.threads[i];
      let age = -1;
      for (let k = 0; k < BEATS.length; k++) {
        const a = this.beatAge(t, k);
        if (a >= 0 && a < 0.45 && t < LOOP_B) age = a;
      }
      if (i >= n || age < 0) { th.mesh.visible = false; this.pulses[i].visible = false; continue; }
      // whip out 0..0.08, taut 0.08..0.18, pull back into the heart 0.18..0.4
      const out = easeOut(age / 0.08);
      const taut = smoothstep((age - 0.04) / 0.1);
      th.head = out;
      th.tail = easeIn((age - 0.18) / 0.22);
      const pts = this.threadPts[i];
      const a = this.threadFrom[i], b = this.heartPos;
      const slack = (1 - taut) * 0.7 + 0.04 * Math.sin(age * 40) * (1 - clamp01((age - 0.3) / 0.1));
      pts[0].copy(a);
      pts[1].lerpVectors(a, b, 0.33); pts[1].y += slack - 0.3 * taut; pts[1].addScaledVector(this.side, slack * 0.5);
      pts[2].lerpVectors(a, b, 0.66); pts[2].y += slack * 0.6 - 0.35 * taut; pts[2].addScaledVector(this.side, -slack * 0.4);
      pts[3].copy(b);
      th.update(t);
      // A pulse of blood runs along the rope toward the heart.
      const pu = this.pulses[i], pk = clamp01((age - 0.06) / 0.2);
      pu.visible = pk > 0 && pk < 1;
      if (pu.visible) {
        const q = 1 - pk, w0 = q * q * q, w1 = 3 * q * q * pk, w2 = 3 * q * pk * pk, w3 = pk * pk * pk;
        pu.position.set(
          pts[0].x * w0 + pts[1].x * w1 + pts[2].x * w2 + pts[3].x * w3,
          pts[0].y * w0 + pts[1].y * w1 + pts[2].y * w2 + pts[3].y * w3,
          pts[0].z * w0 + pts[1].z * w1 + pts[2].z * w2 + pts[3].z * w3,
        );
        pu.scale.setScalar(0.14 * Math.sin(Math.PI * pk) + 0.02);
      }
    }

    // --- Seal: three beads fly out of the heart into a shoulder orbit, then fade. ---
    const beadOut = easeOut((t - (LOOP_B + 0.15)) / (SEAL_END - LOOP_B - 0.15));
    const fade = 1 - smoothstep((t - 3.05) / (DURATION - 3.05));
    this.beads.forEach((b, i) => {
      const on = t >= LOOP_B + 0.15 && fade > 0.01;
      b.visible = on;
      if (!on) return;
      const th = i * (Math.PI * 2 / 3) + 2.5 * t;
      this.v1.set(this.from.x + Math.cos(th) * 0.9, 1.55 + 0.06 * Math.sin(t * 4 + i), this.from.z + Math.sin(th) * 0.9);
      b.position.lerpVectors(this.heartPos, this.v1, beadOut);
      b.scale.setScalar(Math.max(BEAD_R * Math.min(1, beadOut * 3 + 0.3) * fade, 1e-4));
    });

    // --- A crimson pulse at the chest when the pact is sealed (she is healed). ---
    const ps = StarBurst.pop(t - SEAL_END, 0, 0.12);
    this.chestPulse.set(this.chest, 0.9 * ps.scale, ps.opacity > 0 && ps.scale > 0 ? 1 : 0, 0);
  }

  /** Seconds since beat k started, or -1. After a loop wrap the beat flags have been cleared and times repeat. */
  private beatAge(t: number, k: number) {
    const tb = BEATS[k];
    return t >= tb ? t - tb : -1;
  }

  private v1c = new THREE.Color();
  private stubPts = [0, 1].map(() => [0, 1, 2, 3].map(() => new THREE.Vector3()));
  private veinPts = [0, 1].map(() => [0, 1, 2, 3].map(() => new THREE.Vector3()));
}

export const crimsonPactModule: EffectModule = {
  label: 'crimson pact',
  category: 'hero: blood',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new CrimsonPact(),
  telegraphs(effect) {
    const e = effect as CrimsonPact;
    const c = e.ctx?.from;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: 0, impact: LOOP_A }];
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 },
  frameCamera(camera, controls, effect) {
    const e = effect as CrimsonPact;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as CrimsonPact).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 60, 1);
  },
};
