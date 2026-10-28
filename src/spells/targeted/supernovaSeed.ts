import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  ShockRefraction, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Supernova Seed (targeted, single enemy): a star chart draws behind the enemy, a small star is planted in it and
 * swells while the world goes to deep space, then everything collapses to a pinpoint, a dead beat, and the star goes
 * supernova: short impact frames, three tilted shock shells, a two-lobed (hourglass) nebula with dark dust lanes
 * that hangs in the sky, spins and dims, and a neutron-star glint that pulses at its centre.
 * Palette: star yellow -> hot orange -> magenta / teal nebula -> space dark. White only in the tiny cores.
 */
export interface SupernovaSeedSettings {
  impactTime: number;
  damage: number;
  nebulaSize: number;
  loop: boolean;
}

export const defaultSupernovaSeed = (): SupernovaSeedSettings => ({
  impactTime: 1.95, damage: 70, nebulaSize: 1, loop: false,
});

const AFTERMATH = 3.05;
const ORBIT_N = 22;
const CHART_TILT = 0.96; // ~55 degrees toward the caster
const STAR_Y = 1.2;

const STAR = 0xfff2a8;
const HOT = 0xff8a2a;
const MAGENTA = 0xff4fa8;
const TEAL = 0x3fd0c0;

/** A cloud of soft points whose positions are dir * radius * growth(after); colours are baked per point. */
class Cloud {
  readonly points: THREE.Points;
  readonly mat: THREE.PointsMaterial;
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private dirs: Float32Array;
  private rad: Float32Array;
  private delay: Float32Array;
  private n: number;

  constructor(
    n: number, size: number, additive: boolean,
    gen: (i: number, dir: THREE.Vector3, col: THREE.Color) => { r: number; d: number },
  ) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.dirs = new Float32Array(n * 3);
    this.rad = new Float32Array(n);
    this.delay = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const dir = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const s = gen(i, dir, c);
      this.dirs[i * 3] = dir.x; this.dirs[i * 3 + 1] = dir.y; this.dirs[i * 3 + 2] = dir.z;
      this.rad[i] = s.r; this.delay[i] = s.d;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.mat = new THREE.PointsMaterial({
      size, map: softDotTexture(), vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
  }

  /** `after` seconds since the blast, `k` how fast the cloud opens, `scale` overall size. */
  update(after: number, k: number, scale: number) {
    const slow = 1 + 0.06 * Math.max(0, after);
    for (let i = 0; i < this.n; i++) {
      const e = after - this.delay[i];
      const r = e > 0 ? this.rad[i] * scale * slow * (1 - Math.exp(-e * k)) : 0;
      this.pos[i * 3] = this.dirs[i * 3] * r;
      this.pos[i * 3 + 1] = this.dirs[i * 3 + 1] * r;
      this.pos[i * 3 + 2] = this.dirs[i * 3 + 2] * r;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

export class SupernovaSeed implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SupernovaSeedSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private secondDone = false;
  private impactAt = new THREE.Vector3();

  // Scene graph: fxRoot (at the star, yawed to the aim) holds the tilted chart, shells and nebula.
  private fxRoot = new THREE.Group();
  private chartTilt = new THREE.Group();
  private chartSpin = new THREE.Group();
  private chartScale = new THREE.Group();
  private ringOuter = createRing(TEAL, 0.975, 1, 96);
  private ringHex = createRing(STAR, 0.975, 1, 6);
  private ringInner = createRing(HOT, 0.96, 1, 64);
  private chartLines: THREE.LineSegments;
  private chartDots: THREE.Points;
  private chartDotMat = new THREE.PointsMaterial({
    size: 0.26, map: softDotTexture(), color: STAR, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private orbitPos = new Float32Array(ORBIT_N * 3);
  private orbitGeo = new THREE.BufferGeometry();
  private orbitMat = new THREE.PointsMaterial({
    size: 0.4, map: softDotTexture(), color: STAR, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private orbit: THREE.Points;
  private orbitSeed = Array.from({ length: ORBIT_N }, (_, i) => ({ a: (i / ORBIT_N) * Math.PI * 2, r: 1.3 + Math.random() * 1.5, s: 1.5 + Math.random() * 2 }));

  private star = new StarBurst({ points: 4, inner: 0.16, jitter: 0.15, color: HOT, core: STAR, additive: false });
  private flare = new StarBurst({ points: 4, inner: 0.07, jitter: 0, color: STAR, core: STAR, additive: false });
  private pin = new StarBurst({ points: 4, inner: 0.2, jitter: 0, color: 0xffffff, core: 0xffffff, additive: false });
  private novaStar = new StarBurst({ points: 8, inner: 0.2, jitter: 0.3, color: TEAL, core: HOT, additive: false });
  private novaFlare = new StarBurst({ points: 12, inner: 0.25, jitter: 0.4, color: HOT, core: 0xffd060, additive: false });
  private refract = new ShockRefraction({ facing: 'camera', width: 0.3 });
  private neutron = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: TEAL, core: 0xffffff, additive: true });

  private shellTilts: THREE.Group[] = [];
  private shells = [
    { ring: createRing(STAR, 0.94, 1, 96), tilt: 0.96, roll: 0.1, rmax: 9, k: 3.2, life: 0.9, delay: 0 },
    { ring: createRing(HOT, 0.94, 1, 96), tilt: 0.7, roll: -0.35, rmax: 6.6, k: 2.6, life: 1.1, delay: 0.05 },
    { ring: createRing(MAGENTA, 0.94, 1, 96), tilt: 1.25, roll: 0.5, rmax: 4.6, k: 2.1, life: 1.3, delay: 0.1 },
  ];

  private nebulaRoot = new THREE.Group();
  private nebulaTilt = new THREE.Group();
  private nebulaSpin = new THREE.Group();
  private lobes: Cloud[] = [];
  private dust: Cloud[] = [];

  private scorch = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 48),
    new THREE.MeshBasicMaterial({ color: 0x0a0612, transparent: true, opacity: 0, depthWrite: false }),
  );

  private sparks: Emitter;
  private tealSparks: Emitter;

  constructor(settings: SupernovaSeedSettings = defaultSupernovaSeed()) {
    this.settings = settings;
    this.screen.tint.set(0x120a2a);
    this.screen.impactColor.set(STAR);
    this.screen.speedLineColor.set(STAR);
    this.screen.edgeTint.set(MAGENTA);

    // --- Star chart: three rings, constellation dots joined by thin lines, orbiting sparks. ---
    const dots: THREE.Vector3[] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + (k % 2) * 0.18;
      const r = k % 2 ? 1.75 : 2.3;
      dots.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const links: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [0, 3], [2, 5]];
    const linePos: number[] = [];
    for (const [a, b] of links) linePos.push(dots[a].x, 0, dots[a].z, dots[b].x, 0, dots[b].z);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    this.chartLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      color: STAR, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const dotGeo = new THREE.BufferGeometry().setFromPoints(dots);
    this.chartDots = new THREE.Points(dotGeo, this.chartDotMat);
    this.chartDots.frustumCulled = false;
    this.orbitGeo.setAttribute('position', new THREE.BufferAttribute(this.orbitPos, 3));
    this.orbit = new THREE.Points(this.orbitGeo, this.orbitMat);
    this.orbit.frustumCulled = false;
    this.ringOuter.mesh.scale.setScalar(3.1);
    this.ringHex.mesh.scale.setScalar(2.55);
    this.ringInner.mesh.scale.setScalar(1.4);
    this.ringOuter.mesh.position.y = this.ringHex.mesh.position.y = this.ringInner.mesh.position.y = 0;
    this.chartScale.add(this.ringOuter.mesh, this.ringHex.mesh, this.ringInner.mesh, this.chartLines, this.chartDots, this.orbit);
    this.chartSpin.add(this.chartScale);
    this.chartTilt.add(this.chartSpin);
    this.chartTilt.rotation.x = -CHART_TILT;
    this.fxRoot.add(this.chartTilt);

    // --- Shock shells on three different tilted planes. ---
    for (const s of this.shells) {
      const tilt = new THREE.Group();
      tilt.rotation.set(-s.tilt, 0, s.roll);
      s.ring.mesh.position.y = 0;
      tilt.add(s.ring.mesh);
      this.shellTilts.push(tilt);
      this.fxRoot.add(tilt);
    }

    // --- Nebula: two cones (hourglass) of magenta / teal motes plus dark dust, tilted and slowly spinning. ---
    // Soft overlapping sprites in three size classes per lobe (PointsMaterial has one size per cloud).
    const lobe = (sign: number) => (_i: number, dir: THREE.Vector3, col: THREE.Color) => {
      const phi = 0.62 * Math.sqrt(Math.random());
      const az = Math.random() * Math.PI * 2;
      dir.set(Math.sin(phi) * Math.cos(az), sign * Math.cos(phi), Math.sin(phi) * Math.sin(az));
      const R = 0.5 + Math.pow(Math.random(), 0.75) * 2.8;
      const t = (R - 0.5) / 2.8;
      const body = new THREE.Color(sign > 0 ? MAGENTA : TEAL);
      if (t < 0.22) col.set(HOT).lerp(body, t / 0.22 * 0.6);
      else col.copy(body).lerp(new THREE.Color(sign > 0 ? TEAL : MAGENTA), Math.max(0, t - 0.7) * 0.8);
      return { r: R, d: Math.random() * 0.1 };
    };
    for (const sign of [1, -1]) {
      for (const size of [0.7, 1.1, 1.6]) {
        const cl = new Cloud(70, size, true, lobe(sign));
        cl.points.renderOrder = 1;
        this.lobes.push(cl);
        this.nebulaSpin.add(cl.points);
      }
    }
    // Large dark sprites: a disc across the waist and lanes along the cone edges.
    for (const size of [1.2, 1.9]) {
      const cl = new Cloud(60, size, false, (i, dir, col) => {
        const az = Math.random() * Math.PI * 2;
        if (i % 2) {
          dir.set(Math.cos(az), (Math.random() - 0.5) * 0.2, Math.sin(az)).normalize();
          col.set(0x1c0d30);
          return { r: 0.4 + Math.random() * 1.9, d: Math.random() * 0.1 };
        }
        const phi = 0.45 + Math.random() * 0.2;
        const sg = Math.random() < 0.5 ? 1 : -1;
        dir.set(Math.sin(phi) * Math.cos(az), sg * Math.cos(phi), Math.sin(phi) * Math.sin(az));
        col.set(0x14081f);
        return { r: 1 + Math.random() * 2.2, d: Math.random() * 0.1 };
      });
      cl.points.renderOrder = 2;
      this.dust.push(cl);
      this.nebulaSpin.add(cl.points);
    }
    this.nebulaTilt.add(this.nebulaSpin);
    this.nebulaTilt.rotation.x = -0.5;
    this.nebulaRoot.add(this.nebulaTilt);
    this.nebulaRoot.position.y = 1.8;
    this.fxRoot.add(this.nebulaRoot);

    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.position.y = 0.03;

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.1, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 11, speedJitter: 0.6, spread: 180, gravity: 3, drag: 1.4,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffd060', colorEnd: '#ff4fa8',
      opacityStart: 0.9, opacityEnd: 0, additive: true, colorMid: '#ff8a2a', sizeJitter: 0.3, erosion: 0,
    });
    this.tealSparks = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 6, speedJitter: 0.7, spread: 180, gravity: -0.3, drag: 1.1,
      sizeStart: 0.16, sizeEnd: 0.02, colorStart: '#3fd0c0', colorEnd: '#06040e',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.3,
    });
    this.emitters.push(this.sparks, this.tealSparks);
    for (const e of this.emitters) this.group.add(e.points);
    this.group.add(
      this.fxRoot, this.scorch, this.star.mesh, this.flare.mesh, this.pin.mesh,
      this.novaStar.mesh, this.novaFlare.mesh, this.neutron.mesh, this.refract.mesh,
    );
    this.reset();
  }

  get duration() {
    return this.settings.impactTime + AFTERMATH;
  }

  get impactTime() {
    return this.settings.impactTime;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.impactAt.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.fxRoot.position.set(this.impactAt.x, STAR_Y, this.impactAt.z);
    this.fxRoot.rotation.y = ctx.aim;
    this.scorch.position.set(this.impactAt.x, 0.03, this.impactAt.z);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.set(this.impactAt.x, STAR_Y, this.impactAt.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.secondDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    if (!this.impacted && this.time >= this.impactTime) this.onImpact();
    if (this.impacted && !this.secondDone && this.time >= this.impactTime + 0.15) this.onSecond();
    this.layout(dt);
  }

  private layout(_dt: number) {
    const D = this.settings.impactTime;
    const t = this.time;
    const after = t - D;
    const dur = this.duration;
    const fade = 1 - smoothstep((t - (dur - 1.3)) / 1.3);
    const c = this.fxRoot.position;
    const imp = smoothstep((t - 1.6) / 0.3); // implode 1.6 -> 1.9
    const pre = t < D;

    // --- World: darken to deep space, hold through the blast, release slowly. ---
    const dark = pre ? 0.85 * smoothstep(t / 0.5) + 0.07 * smoothstep((t - 0.5) / 1.1) : 0.6 * Math.exp(-Math.max(0, after - 0.1) * 0.9);
    this.screen.darken = t >= dur ? 0 : dark * (t > dur - 0.8 ? Math.max(0, (dur - t) / 0.8) : 1);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D, 0.8, 10);
    this.screen.speedLines = pre ? 0.9 * imp : Math.max(0, 0.9 - after * 6);

    // --- Star chart: draws in 0 -> 0.5, rings contract during the implode. ---
    const draw = smoothstep(t / 0.5);
    const chartOp = pre ? (1 - smoothstep((t - 1.8) / 0.12)) : 0;
    const cs = (0.75 + 0.25 * draw) * (1 - 0.88 * imp * imp);
    this.chartScale.scale.setScalar(Math.max(1e-3, cs));
    this.chartSpin.rotation.y = t * 0.5 + imp * 2.2;
    this.ringOuter.material.opacity = 0.55 * draw * chartOp;
    this.ringHex.material.opacity = 0.5 * smoothstep((t - 0.1) / 0.4) * chartOp;
    this.ringInner.material.opacity = 0.5 * smoothstep((t - 0.2) / 0.4) * chartOp;
    this.chartDotMat.opacity = 0.9 * smoothstep((t - 0.15) / 0.3) * chartOp;
    this.chartLines.geometry.setDrawRange(0, 2 * Math.floor(smoothstep((t - 0.1) / 0.55) * 8));
    (this.chartLines.material as THREE.LineBasicMaterial).opacity = 0.7 * chartOp;

    // Orbiting sparks around the seed, drawn in during the implode.
    for (let i = 0; i < ORBIT_N; i++) {
      const o = this.orbitSeed[i];
      const r = o.r * (1 - 0.95 * imp * imp);
      const a = o.a + t * o.s;
      this.orbitPos[i * 3] = Math.cos(a) * r;
      this.orbitPos[i * 3 + 1] = Math.sin(t * 2 + i) * 0.15;
      this.orbitPos[i * 3 + 2] = Math.sin(a) * r;
    }
    this.orbitGeo.attributes.position.needsUpdate = true;
    this.orbitMat.opacity = 0.9 * smoothstep((t - 0.6) / 0.4) * chartOp;

    // --- The seed star: hard four-point flare + small core; swells, then collapses to a pinpoint. ---
    const swell = smoothstep((t - 0.5) / 1.1);
    const starSize = pre ? (0.4 + 0.95 * swell) * (1 - 0.96 * imp * imp) : 0;
    const starOp = pre && t >= 0.5 && t < 1.9 ? 1 : 0;
    const starPos = new THREE.Vector3(c.x, STAR_Y, c.z);
    const pulse = 1 + 0.06 * Math.sin(t * 14) * swell;
    this.star.set(starPos, starSize * pulse, starOp, t * 0.6);
    this.flare.set(starPos, starSize * 1.9, starOp * 0.85, t * 0.6 + Math.PI / 4);
    this.pin.set(starPos, Math.max(1e-4, 0.12 + 0.2 * swell * (1 - imp)), starOp, -t);

    // --- Supernova: cool star + warm flare for a couple of frames. ---
    const pop = StarBurst.pop(after, 0.04, 0.09);
    this.novaStar.set(starPos, 3.6 * pop.scale, pop.opacity, 0.2);
    const pop2 = StarBurst.pop(after - 0.03, 0.06, 0.14);
    this.novaFlare.set(starPos, 2.6 * pop2.scale, pop2.opacity, 0.5);

    // --- Shock shells on tilted planes, expanding at different speeds. ---
    this.shells.forEach((s, i) => {
      const e = after - s.delay;
      const r = e > 0 ? s.rmax * (1 - Math.exp(-e * s.k)) : 0;
      s.ring.mesh.scale.setScalar(Math.max(1e-3, r));
      s.ring.material.opacity = e > 0 && e < s.life ? 0.9 * Math.pow(1 - e / s.life, 1.4) : 0;
      this.shellTilts[i].visible = s.ring.material.opacity > 0.002;
    });

    // --- Air blast bend: follows the first shell's radius, decays over 0.6 s. ---
    const rp = Math.min(1, Math.max(0, after / 0.6));
    this.refract.set(starPos, Math.max(1e-3, this.shells[0].rmax * (1 - Math.exp(-Math.max(0, after) * this.shells[0].k))), after > 0 && after < 0.6 ? 0.05 * (1 - rp) * (1 - rp) : 0);

    // --- Nebula: opens fast, then keeps drifting and spinning, dims to dust. ---
    const neb = this.settings.nebulaSize;
    const nebOp = after > 0 ? smoothstep(after / 0.25) * fade : 0;
    this.nebulaSpin.rotation.y = Math.max(0, after) * 0.35;
    this.nebulaRoot.position.y = 2.2 + Math.max(0, after) * 0.12;
    const a = Math.max(0, after);
    for (const cl of this.lobes) cl.update(a, 4.5, neb);
    for (const cl of this.dust) cl.update(a, 3.2, neb);
    const dim = 1 - 0.45 * smoothstep((after - 0.8) / 2.2);
    for (const cl of this.lobes) cl.mat.opacity = 0.22 * dim * nebOp;
    for (const cl of this.dust) cl.mat.opacity = 0.45 * nebOp;
    this.nebulaRoot.visible = nebOp > 0.002;

    // --- Neutron-star glint at the centre: pulses, then fades. ---
    const nOp = after > 0.1 ? Math.max(0, 1 - (after - 0.1) / 2.6) * fade : 0;
    const nPulse = 0.5 + 0.5 * Math.sin(after * 7);
    this.neutron.set(
      new THREE.Vector3(c.x, this.nebulaRoot.position.y + STAR_Y - 0.3, c.z),
      0.5 + 0.35 * nPulse, nOp * (0.55 + 0.45 * nPulse), after * 0.8,
    );

    // --- Ground scorch under the blast. ---
    (this.scorch.material as THREE.MeshBasicMaterial).opacity = after > 0 ? 0.65 * smoothstep(after / 0.15) * fade : 0;
    this.scorch.visible = after > 0 && fade > 0.002;

    this.shake = pre ? (t > 1.6 ? 0.05 * imp : 0) : 0.7 * Math.exp(-after * 5);
  }

  private onImpact() {
    this.impacted = true;
    const c = new THREE.Vector3(this.impactAt.x, STAR_Y, this.impactAt.z);
    this.sparks.burst(360, c);
    this.tealSparks.burst(260, c);
    const ctx = this.ctx;
    if (ctx) {
      const first = ctx.targets[0];
      if (first) ctx.hit(first, { damage: this.settings.damage, knock: 5, from: this.impactAt });
    }
  }

  /** Enemies near the blast (when a spell cast gives more than one target) take the shell hit a beat later. */
  private onSecond() {
    this.secondDone = true;
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (i > 0 && p && p.distanceTo(this.impactAt) < 4) ctx.hit(e, { damage: 15, knock: 3, from: this.impactAt });
    });
  }
}

export const supernovaSeedModule: EffectModule = {
  label: 'supernova seed',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new SupernovaSeed(),
  telegraphs(effect) {
    const e = effect as SupernovaSeed;
    const c = e.ctx?.targetPos[0] ?? e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: 4 }, start: 0.1, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as SupernovaSeed;
    if (e.ctx) frameCast(camera, controls, e.ctx, 7);
  },
  buildGui(f, effect) {
    const s = (effect as SupernovaSeed).settings;
    f.add(s, 'loop');
    f.add(s, 'impactTime', 1.2, 4, 0.05).name('impact time');
    f.add(s, 'nebulaSize', 0.4, 2, 0.05).name('nebula size');
    f.add(s, 'damage', 1, 150, 1);
  },
};
