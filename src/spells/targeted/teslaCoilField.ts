import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, mergeParts, smoothstep } from '../../effects/common';
import {
  LightningArc, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Tesla Coil Field (targeted, ground AoE, 5.5 m, steampunk electric): the world goes dark and four tesla coils
 * (iron base, ridged copper windings, a brass toroid on top; mid-tone lit materials below the bloom threshold, only
 * a thin violet rim on each toroid glows) push up out of the ground at the corners of the area. Thin bolts (each
 * with a black under-copy) crackle from toroid to toroid, closing a square cage, then cross over to the centre;
 * two small damage ticks run along the cross arcs. Dead beat: the arcs stop and the toroid rims charge violet.
 * Then all four discharge at once: violet impact frames, four thick bolts converge on one small violet-white
 * point (living on single frames), a ground nova of branching arcs, a ripple and a small toon smoke puff per
 * coil. The coils sink back into the ground and the bolts evaporate into dashes.
 *
 * Recipes: c-electric-blast-branching-ground (branching arcs along the ground), a-smite-zeus-chain-lightning
 * (arcs hopping between points), j-cghow-outlined-stylized-bolt (a black copy of the same path behind each bolt).
 */
export interface TeslaCoilFieldSettings {
  damage: number;
  loop: boolean;
}

export const defaultTeslaCoilField = (): TeslaCoilFieldSettings => ({ damage: 50, loop: false });

const D = 2.15; // all four coils discharge
const DURATION = 4.6;
const COILS = 4;
const AREA_R = 5.5;
const COIL_R = 3.5; // coil ring radius
const COIL_S = 1.5; // coil scale
const TOP_Y = 2.15; // toroid height in coil units
const SINK = 3.6;
const FRAME = 0.04; // one "lightning frame"
const KEY = 0.06; // cage arcs redraw this often
const NOVA = 8;
const TAU = Math.PI * 2;

const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

/** Runs fn with a deterministic Math.random, so two LightningArcs with equal options roll the same path. */
function seeded(seed: number, fn: () => void) {
  const orig = Math.random;
  let s = (seed * 2654435761) >>> 0 || 1;
  Math.random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  try { fn(); } finally { Math.random = orig; }
}

const easeOutBack = (k: number) => {
  const c = 1.9;
  const x = k - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

interface Coil {
  g: THREE.Group;
  glowMat: THREE.MeshBasicMaterial;
  ripple: ReturnType<typeof createRing>;
  risen: boolean;
}

interface Pair {
  bright: LightningArc;
  black: LightningArc;
}

interface FinalBolt extends Pair {
  thin: LightningArc;
}

const DASH_U: [number, number][] = [[0.1, 0.24], [0.4, 0.54], [0.7, 0.82], [0, 0.08], [0.92, 1], [0.04, 0.1]];

export class TeslaCoilField implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TeslaCoilFieldSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private struck = false;
  private smokeDone = false;
  private ticks = [false, false];
  private humT = 0;
  private finalKey = -2;
  private cageKey = -1;
  private center = new THREE.Vector3();
  private base: THREE.Vector3[] = Array.from({ length: COILS }, () => new THREE.Vector3());
  private tops: THREE.Vector3[] = Array.from({ length: COILS }, () => new THREE.Vector3());

  // Coils: mid-tone materials (below the bloom threshold).
  private iron = new THREE.MeshStandardMaterial({ color: 0x3a3631, metalness: 0.45, roughness: 0.5 });
  private copper = new THREE.MeshStandardMaterial({ color: 0xa8642f, metalness: 0.4, roughness: 0.45 });
  private brass = new THREE.MeshStandardMaterial({
    color: 0xa8873c, metalness: 0.35, roughness: 0.45, emissive: 0x5a3cc8, emissiveIntensity: 0,
  });
  private coils: Coil[] = [];

  // Cage: four sides, four cross arcs to the centre.
  private sides: Pair[] = [];
  private cross: Pair[] = [];
  private cageGlints: StarBurst[] = [];

  // Discharge.
  private finals: FinalBolt[] = [];
  private nova: LightningArc[] = [];
  private star = new StarBurst({ points: 12, color: 0x9b8cff, core: 0xe6dcff, additive: false });
  private darkStar = new StarBurst({ points: 12, color: 0x07030c, core: 0x1a1230, additive: false });
  private centerGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0x5a7aff, core: 0xe6dcff });
  private areaRing = createRing(0x5a7aff, 0.985, 1, 128);
  private diamond = createRing(0x9b8cff, 0.93, 1, 4);
  private shock = createRing(0x9b8cff, 0.9, 1, 128);
  private refract = new ShockRefraction({ facing: 'ground' });
  private shock2 = createRing(0xc87a3a, 0.96, 1, 128);
  private scorchMat = new THREE.MeshBasicMaterial({ color: 0x05040a, transparent: true, opacity: 0, depthWrite: false });
  private scorch = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.scorchMat);
  private smoke = new SmokeBall({ color: 0x14100c, rim: 0x4a3f36, flake: '#241c16', maxBalls: 8 });
  private sparks: Emitter;
  private allArcs: LightningArc[] = [];

  constructor(settings: TeslaCoilFieldSettings = defaultTeslaCoilField()) {
    this.settings = settings;
    this.screen.tint.set(0x161228);
    this.screen.impactColor.set(0x9b6bff);
    this.screen.speedLineColor.set(0xe0d8ff);
    this.screen.edgeTint.set(0x5a7aff);

    // --- Coil geometry (units: coil height ~2.4, scaled by COIL_S). ---
    const baseGeo = new THREE.LatheGeometry([
      [0, 0], [0.62, 0], [0.62, 0.12], [0.5, 0.16], [0.5, 0.42], [0.4, 0.5], [0.4, 0.56], [0, 0.56],
    ].map(([x, y]) => new THREE.Vector2(x, y)), 24);
    const wind: THREE.Vector2[] = [new THREE.Vector2(0, 0.56), new THREE.Vector2(0.3, 0.56)];
    const turns = 12;
    for (let i = 0; i < turns; i++) {
      const y0 = 0.62 + (i / turns) * 1.1;
      const dy = 1.1 / turns;
      wind.push(new THREE.Vector2(0.36, y0 + dy * 0.2), new THREE.Vector2(0.36, y0 + dy * 0.55), new THREE.Vector2(0.3, y0 + dy * 0.9));
    }
    wind.push(new THREE.Vector2(0.3, 1.78), new THREE.Vector2(0, 1.78));
    const windGeo = new THREE.LatheGeometry(wind, 24);
    const neckGeo = new THREE.CylinderGeometry(0.1, 0.16, 0.36, 12);
    neckGeo.translate(0, 1.78 + 0.18, 0);
    const collarGeo = new THREE.TorusGeometry(0.34, 0.05, 8, 24);
    collarGeo.rotateX(Math.PI / 2);
    collarGeo.translate(0, 1.78, 0);
    const bandGeo = new THREE.TorusGeometry(0.52, 0.045, 8, 28);
    bandGeo.rotateX(Math.PI / 2);
    bandGeo.translate(0, 0.44, 0);
    const brassParts = mergeParts([neckGeo, collarGeo, bandGeo]);
    const toroidGeo = new THREE.TorusGeometry(0.5, 0.17, 14, 40);
    toroidGeo.rotateX(Math.PI / 2);
    toroidGeo.translate(0, TOP_Y, 0);
    const capGeo = new THREE.SphereGeometry(0.15, 12, 8);
    capGeo.translate(0, TOP_Y + 0.17, 0);
    // Glowing rim: a thin ring on the toroid's outer equator, the only bright part of the coil.
    const rimGeo = new THREE.TorusGeometry(0.675, 0.032, 8, 48);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.translate(0, TOP_Y, 0);
    const rippleGeo = new THREE.RingGeometry(0.9, 1, 48);
    for (let i = 0; i < COILS; i++) {
      const g = new THREE.Group();
      const glowMat = new THREE.MeshBasicMaterial({ color: 0x9b8cff });
      g.add(
        new THREE.Mesh(baseGeo, this.iron), new THREE.Mesh(windGeo, this.copper),
        new THREE.Mesh(brassParts, this.brass), new THREE.Mesh(toroidGeo, this.brass),
        new THREE.Mesh(capGeo, this.brass), new THREE.Mesh(rimGeo, glowMat),
      );
      g.visible = false;
      const ripple = createRing(0xc87a3a, 0.9, 1, 48);
      ripple.mesh.geometry = rippleGeo;
      ripple.mesh.position.y = 0.06;
      this.group.add(g, ripple.mesh);
      this.coils.push({ g, glowMat, ripple, risen: false });
    }

    // --- Arcs: black under-copy + thin bright bolt per cage arc; paths are pinned per frame key. ---
    const mk = (width: number, core: THREE.ColorRepresentation, glow: THREE.ColorRepresentation, segs: number, branches: number, black = false) => {
      const a = new LightningArc({ width, segments: segs, jitter: 0.08, branches, rerollEvery: 1e9, dropChance: 0, core, glow });
      if (black) {
        (a.mesh.material as THREE.ShaderMaterial).blending = THREE.NormalBlending;
        a.mesh.renderOrder = 3;
      } else a.mesh.renderOrder = 4;
      this.allArcs.push(a);
      this.group.add(a.mesh);
      return a;
    };
    const cagePair = (): Pair => ({
      black: mk(0.26, 0x120a24, 0x05040a, 12, 1, true),
      bright: mk(0.1, 0xffffff, 0x5a7aff, 12, 1),
    });
    for (let i = 0; i < COILS; i++) {
      this.sides.push(cagePair());
      this.cross.push(cagePair());
    }
    for (let i = 0; i < COILS; i++) {
      this.finals.push({
        black: mk(0.9, 0x120a24, 0x05040a, 16, 3, true),
        bright: mk(0.34, 0xffffff, 0x5a7aff, 16, 3),
        thin: mk(0.16, 0xffffff, 0xe0d8ff, 16, 1),
      });
    }
    for (let i = 0; i < NOVA; i++) {
      const a = new LightningArc({ width: 0.17, segments: 10, jitter: 0.1, branches: 1, core: 0xe0d8ff, glow: 0x5a7aff, rerollEvery: 0.04, dropChance: 0.2 });
      a.mesh.renderOrder = 4;
      this.allArcs.push(a);
      this.nova.push(a);
      this.group.add(a.mesh);
    }
    for (let i = 0; i < COILS; i++) {
      const s = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0x5a7aff, core: 0xe0d8ff });
      this.cageGlints.push(s);
      this.group.add(s.mesh);
    }

    this.scorch.rotation.x = -Math.PI / 2;
    this.scorch.position.y = 0.03;
    this.scorch.visible = false;
    this.darkStar.mesh.renderOrder = 5;
    this.star.mesh.renderOrder = 6;
    this.group.add(
      this.scorch, this.areaRing.mesh, this.diamond.mesh, this.shock.mesh, this.shock2.mesh,
      this.centerGlint.mesh, this.darkStar.mesh, this.star.mesh, this.smoke.mesh, this.refract.mesh,
    );

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.25, speed: 8, speedJitter: 0.6, spread: 90, gravity: 9, drag: 1.6,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#e0d8ff', colorEnd: '#5a7aff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, colorMid: '#9b8cff', sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.sparks, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.point).setY(0);
    for (let i = 0; i < COILS; i++) {
      const a = Math.PI / 4 + (i / COILS) * TAU;
      this.base[i].set(this.center.x + Math.cos(a) * COIL_R, 0, this.center.z + Math.sin(a) * COIL_R);
      this.tops[i].set(this.base[i].x, TOP_Y * COIL_S, this.base[i].z);
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.set(this.center.x, 1, this.center.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.struck = false;
    this.smokeDone = false;
    this.ticks = [false, false];
    this.humT = 0;
    this.finalKey = -2;
    this.cageKey = -1;
    this.shake = 0;
    for (const c of this.coils) c.risen = false;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.sparks.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    let ended = false;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      ended = true;
    }
    const t = this.time;
    // Coil dust puffs as each one breaks through the ground.
    this.coils.forEach((c, i) => {
      if (!c.risen && this.ctx && t >= 0.2 + i * 0.09) {
        c.risen = true;
        this.smoke.trigger(new THREE.Vector3(this.base[i].x, 0.4, this.base[i].z), 0.55, 0.6);
        this.sparks.burst(14, new THREE.Vector3(this.base[i].x, 0.3, this.base[i].z));
      }
    });
    // A hum of small sparks off the toroids while the cage crackles.
    if (this.ctx && dt > 0 && t > 0.9 && t < 1.95) {
      this.humT += dt;
      while (this.humT >= 0.11) {
        this.humT -= 0.11;
        this.sparks.burst(5, this.tops[Math.floor(Math.random() * COILS)]);
      }
    }
    if (!this.ticks[0] && t >= 1.35) this.onTick(0);
    if (!this.ticks[1] && t >= 1.75) this.onTick(1);
    if (!this.struck && t >= D) this.onStrike();
    if (!this.smokeDone && t >= D + 0.35) this.onSmoke();
    for (const a of this.allArcs) a.update(dt);
    this.layout(dt);
    if (ended) clearScreenFx(this.screen);
  }

  /** Same seed and options: the black copy follows exactly the bright path, only wider. */
  private pair(p: Pair, a: THREE.Vector3, b: THREE.Vector3, seed: number) {
    p.bright.setEnds(a, b);
    p.black.setEnds(a, b);
    seeded(seed, () => p.bright.reroll());
    seeded(seed, () => p.black.reroll());
  }

  private layout(_dt: number) {
    const t = this.time;
    const after = t - D;
    const struck = t >= D;
    const ctx = this.ctx;
    const has = !!ctx;
    const c = this.center;
    const tmp = new THREE.Vector3();
    const a0 = new THREE.Vector3(), b0 = new THREE.Vector3();

    // --- 1. World: darkens, holds to the strike, releases. Speed lines pull in during the dead beat. ---
    this.screen.darken = has ? (t < D ? 0.75 * smoothstep(t / 0.5) : 0.75 * Math.exp(-Math.max(0, after - 0.5) * 2.2)) : 0;
    this.screen.speedLines = has ? (t < D ? 0.7 * smoothstep((t - 1.95) / 0.2) : Math.max(0, 0.7 - after * 8)) : 0;
    this.screen.impact = has ? impactFrameAt(t, D, [1, 2], 0.04) : 0;
    this.screen.chroma = has ? chromaPulse(t, D, 0.6, 9) : 0;

    // --- 2. Coils: rise with overshoot, rim charges in the dead beat, flares on the strike, sink at the end. ---
    const sink = smoothstep((after - 1.0) / 1.0);
    const chargeK = smoothstep((t - 1.9) / 0.2);
    const cageOn = t > 0.8 && t < 1.9 ? 1 : 0;
    this.brass.emissiveIntensity = struck ? 0.5 * Math.exp(-after * 4) : 0.4 * chargeK;
    this.coils.forEach((co, i) => {
      const k = THREE.MathUtils.clamp((t - 0.1 - i * 0.09) / 0.55, 0, 1);
      const rise = easeOutBack(k);
      const y = -SINK * (1 - rise) - SINK * sink;
      co.g.position.set(this.base[i].x, y, this.base[i].z);
      co.g.scale.setScalar(COIL_S);
      co.g.rotation.y = i * 0.7;
      co.g.visible = has && k > 0.001 && sink < 0.995;
      // Rim: dim at rest, flickers while the cage runs, ramps to the discharge, then dies.
      let glow = 0.3 * k;
      if (cageOn) glow = 0.55 + 0.2 * hash(Math.floor(t / KEY) + i * 5);
      if (t >= 1.9 && !struck) glow = 0.6 + 0.8 * chargeK * (0.85 + 0.15 * Math.sin(t * 60));
      if (struck) glow = 1.5 * Math.exp(-after * 6) + 0.12;
      co.glowMat.color.setRGB(0.62, 0.55, 1.0).multiplyScalar(glow * (1 - sink));
      this.tops[i].set(this.base[i].x, y + TOP_Y * COIL_S, this.base[i].z);
      // Copper ripple on the ground as the coil breaks through.
      const ra = t - (0.2 + i * 0.09);
      co.ripple.mesh.position.set(this.base[i].x, 0.06, this.base[i].z);
      co.ripple.mesh.scale.setScalar(Math.max(1e-4, 0.5 + Math.max(0, ra) * 4));
      co.ripple.material.opacity = has && ra >= 0 && ra < 0.45 ? 0.45 * (1 - ra / 0.45) : 0;
    });

    // --- 3. Ground telegraph: area ring, a square that implodes in the dead beat. ---
    const areaOp = has ? (t < D ? 0.4 * smoothstep((t - 0.4) / 0.4) : 0.7 * Math.exp(-after * 8)) : 0;
    this.areaRing.mesh.position.set(c.x, 0.05, c.z);
    this.areaRing.mesh.scale.setScalar(AREA_R);
    this.areaRing.material.opacity = areaOp;
    this.diamond.mesh.position.set(c.x, 0.05, c.z);
    this.diamond.mesh.rotation.z = Math.PI / 4;
    this.diamond.mesh.scale.setScalar(Math.max(1e-4, COIL_R * 1.42 * (1 - 0.8 * chargeK)));
    this.diamond.material.opacity = has ? (t < D ? (0.2 + 0.4 * chargeK) * smoothstep((t - 0.5) / 0.4) : 0.6 * Math.exp(-after * 10)) : 0;

    // --- 4. The cage: sides first, then the cross arcs; each redraws every KEY, with forced flicker. ---
    const key = Math.floor(t / KEY);
    const fresh = key !== this.cageKey;
    this.cageKey = key;
    const sideEnv = has ? smoothstep((t - 0.8) / 0.12) * (1 - smoothstep((t - 1.86) / 0.04)) : 0;
    const crossEnv = has ? smoothstep((t - 1.15) / 0.12) * (1 - smoothstep((t - 1.86) / 0.04)) : 0;
    const drive = (p: Pair, from: THREE.Vector3, to: THREE.Vector3, env: number, seed: number) => {
      a0.copy(from);
      b0.copy(to);
      const on = env > 0.01 && hash(seed * 3.7 + key) > 0.22;
      if (on) {
        if (fresh) this.pair(p, a0, b0, seed * 101 + key * 7);
        else {
          p.bright.setEnds(a0, b0);
          p.black.setEnds(a0, b0);
        }
      }
      p.bright.opacity = on ? 0.8 * env : 0;
      p.black.opacity = on ? 0.9 * env : 0;
    };
    for (let i = 0; i < COILS; i++) {
      drive(this.sides[i], this.tops[i], this.tops[(i + 1) % COILS], sideEnv, i + 1);
      b0.set(c.x, 0.3, c.z);
      drive(this.cross[i], this.tops[i], b0, crossEnv, i + 11);
      // Spark glint where the cross arcs land at the centre (ground).
      this.cageGlints[i].set(
        tmp.set(c.x + (hash(key + i) - 0.5) * 0.5, 0.25, c.z + (hash(key + i * 3) - 0.5) * 0.5),
        0.5 + 0.3 * hash(key * 2 + i), has && crossEnv > 0.01 && hash(i * 9 + key) > 0.5 ? 0.8 : 0, t * 5,
      );
    }

    // --- 5. Dead beat glint, then the converging strike on single frames. ---
    this.centerGlint.set(tmp.set(c.x, 0.3, c.z), 0.4 + 0.8 * chargeK, has && t >= 1.95 && t < D + 0.08 ? 0.9 : 0, t * 2);
    const fb = has && t >= D + 0.08 ? Math.floor((t - D - 0.08) / FRAME) : -1;
    const fkey = fb < 12 ? fb : -1;
    const freshF = fkey !== this.finalKey;
    this.finalKey = fkey;
    const thickF = fkey === 0 || fkey === 3;
    const thinF = fkey === 1 || fkey === 2 || fkey === 4 || fkey === 5;
    const dashF = fkey >= 6;
    this.finals.forEach((fb2, i) => {
      const th = (i / COILS) * TAU;
      b0.set(c.x + Math.cos(th) * 0.2, 0.25, c.z + Math.sin(th) * 0.2);
      a0.copy(this.tops[i]);
      if (fkey >= 0 && fkey <= 5) {
        if (freshF) {
          this.pair(fb2, a0, b0, 301 + i * 13 + fkey * 7);
          fb2.thin.setEnds(a0, b0);
          fb2.thin.reroll();
        } else {
          fb2.bright.setEnds(a0, b0);
          fb2.black.setEnds(a0, b0);
          fb2.thin.setEnds(a0, b0);
        }
      }
      fb2.bright.opacity = thickF ? 0.8 : 0;
      fb2.black.opacity = thickF ? 0.9 : 0;
      if (dashF && fkey < 12) {
        // Evaporating: one dash per frame, then only the ends of the path.
        const [u0, u1] = DASH_U[fkey - 6];
        const p = new THREE.Vector3().lerpVectors(a0, b0, u0);
        const q = new THREE.Vector3().lerpVectors(a0, b0, u1);
        fb2.thin.setEnds(p, q);
        fb2.thin.opacity = fkey < 9 ? 1 : 0.8;
      } else fb2.thin.opacity = thinF ? 1 : 0;
    });
    // The converging point stays small and violet-white (two strobe frames), a black star behind it.
    this.star.set(tmp.set(c.x, 0.9, c.z), 1.9, thickF ? 0.9 : 0, fkey * 0.4);
    this.darkStar.set(tmp.set(c.x, 0.9, c.z), 2.8, fkey >= 0 && fkey <= 5 ? 0.9 : 0, fkey * 0.3 + 0.2);

    // --- 6. Ground discharge: branching nova arcs, ripples, scorch. ---
    const ga = t - D - 0.08;
    this.nova.forEach((arc, i) => {
      if (!struck || !has || ga < 0 || ga > 1.6) { arc.opacity = 0; return; }
      const ang = (i / NOVA) * TAU + 0.3;
      const far = 1.6 + (AREA_R - 1.4) * smoothstep(ga / 0.5);
      const dieE = smoothstep((ga - 0.6) / 0.8);
      const near = Math.min(far - 0.4, 0.4 + dieE * (AREA_R - 0.4));
      a0.set(c.x + Math.cos(ang) * near, 0.2, c.z + Math.sin(ang) * near);
      b0.set(c.x + Math.cos(ang) * far, 0.2, c.z + Math.sin(ang) * far);
      arc.setEnds(a0, b0);
      arc.opacity = 0.9 * (1 - smoothstep((ga - 1.25) / 0.35));
    });
    this.shock.mesh.position.set(c.x, 0.06, c.z);
    this.shock.mesh.scale.setScalar(Math.max(1e-4, Math.min(AREA_R + 1, 0.5 + Math.max(0, after) * 15)));
    this.shock.material.opacity = struck && has ? Math.max(0, 0.5 * (1 - after / 0.7)) : 0;
    const a2 = after - 0.1;
    this.shock2.mesh.position.set(c.x, 0.07, c.z);
    this.shock2.mesh.scale.setScalar(Math.max(1e-4, Math.min(AREA_R + 2, 0.5 + Math.max(0, a2) * 11)));
    this.shock2.material.opacity = struck && has && a2 > 0 ? Math.max(0, 0.45 * (1 - a2 / 0.8)) : 0;
    // Screen distortion riding the first ground ring (same radius), gone by 0.45 s.
    const rp = after / 0.45;
    this.refract.set(c, Math.min(AREA_R + 1, 0.5 + Math.max(0, after) * 15), struck && has && rp < 1 ? 0.04 * (1 - rp) * (1 - rp) : 0);
    this.scorch.position.set(c.x, 0.03, c.z);
    this.scorch.scale.setScalar(2.4);
    this.scorchMat.opacity = struck && has ? 0.85 * (1 - smoothstep((after - 1.3) / 0.8)) : 0;
    this.scorch.visible = this.scorchMat.opacity > 0.002;

    // --- 7. Shake: faint ticks while the cage runs, big on the strike. ---
    let sh = 0;
    if (this.ticks[0]) sh = Math.max(sh, 0.06 * Math.exp(-(t - 1.35) * 14));
    if (this.ticks[1]) sh = Math.max(sh, 0.06 * Math.exp(-(t - 1.75) * 14));
    this.shake = struck ? 0.85 * Math.exp(-after * 5) : sh;
  }

  /** Small damage tick on enemies standing under a cross arc. */
  private onTick(n: number) {
    this.ticks[n] = true;
    const ctx = this.ctx;
    if (!ctx) return;
    const c = this.center;
    ctx.targets.forEach((e, i) => {
      const p = ctx.targetPos[i];
      if (!p) return;
      for (let k = 0; k < COILS; k++) {
        const b = this.base[k];
        const dx = c.x - b.x, dz = c.z - b.z;
        const l2 = dx * dx + dz * dz || 1;
        const u = THREE.MathUtils.clamp(((p.x - b.x) * dx + (p.z - b.z) * dz) / l2, 0, 1);
        if (Math.hypot(p.x - (b.x + dx * u), p.z - (b.z + dz * u)) <= 1.3) {
          ctx.hit(e, { damage: 6, knock: 1, from: b });
          return;
        }
      }
    });
  }

  private onStrike() {
    this.struck = true;
    const c = this.center;
    this.sparks.burst(240, new THREE.Vector3(c.x, 0.4, c.z));
    for (let i = 0; i < COILS; i++) this.sparks.burst(30, this.tops[i]);
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.damage, knock: 4, from: c }));
  }

  private onSmoke() {
    this.smokeDone = true;
    for (let i = 0; i < COILS; i++) {
      this.smoke.trigger(new THREE.Vector3(this.base[i].x, 0.6, this.base[i].z), 0.6, 0.7);
    }
  }
}

export const teslaCoilFieldModule: EffectModule = {
  label: 'tesla coil field',
  category: 'targeted',
  targeting: { mode: 'ground', radius: AREA_R },
  create: () => new TeslaCoilField(),
  telegraphs(effect) {
    const e = effect as TeslaCoilField;
    const p = e.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: AREA_R }, start: 0.5, impact: D }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as TeslaCoilField;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as TeslaCoilField).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
