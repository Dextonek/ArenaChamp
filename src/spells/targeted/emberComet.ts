import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, LightningArc, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Ember Comet (targeted, ground AoE): the comet's own shadow slides in from the caster's side and grows on the
 * ground at the aim point (the telegraph carries the theme). A dark faceted rock with fire only on its leading
 * edge crosses the sky in ~0.35 s and slams down: the screen strobes yellow-white three times, a crisp star pops,
 * orange toon crescents and one thin magenta line cut across the impact, big dark plates tilt up around the crater,
 * and a cluster of round red cartoon puffs swirls with black crescent rings, sparks and black shards. Two smaller
 * rocks land as aftershocks (the last one bigger), then the frame is clean and the plates sink.
 *
 * Built from the user's reference video recipes f-html-meteor-slam and f-html-meteor-volley.
 */
export interface EmberCometSettings {
  rockSize: number;
  damage: number;
  loop: boolean;
}

export const defaultEmberComet = (): EmberCometSettings => ({ rockSize: 2.2, damage: 60, loop: false });

const DURATION = 3.0;
const HIT = 0.9;
const STROBE_FRAME = 2 / 60;
const PLATES = 7;
const CROWN = 9; // spikes per aftershock
const PUFFS_MAIN = 8;
const PUFFS_SMALL = 4;
const PUFF_TOTAL = PUFFS_MAIN + PUFFS_SMALL * 2;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

interface Strike {
  pos: THREE.Vector3;
  fallStart: number;
  fallDur: number;
  hit: number;
  rock: number; // rock radius multiplier (main uses settings.rockSize)
  back: number;
  height: number;
  damage: number;
  radius: number; // enemies within this of pos are hit (aftershocks only)
  done: boolean;
}

interface Puff {
  strike: number;
  off: THREE.Vector3;
  size: number;
  delay: number;
}

export class EmberComet implements Effect {
  readonly group = new THREE.Group();
  readonly settings: EmberCometSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;

  private point = new THREE.Vector3();
  /** Unit ground direction from the aim point toward the caster (the side the comet arrives from). */
  private dir = new THREE.Vector3(0, 0, 1);
  private perp = new THREE.Vector3(1, 0, 0);
  private from = new THREE.Vector3();
  private strikes: Strike[];

  // Rock + shadow per strike.
  private rockGeo = EmberComet.makeRockGeometry();
  private rockMat = new THREE.MeshStandardMaterial({
    color: 0x2b2330, roughness: 0.85, metalness: 0.1, flatShading: true, emissive: 0xff4a10, emissiveIntensity: 0.25,
  });
  private rocks: THREE.Mesh[] = [];
  private fronts: GlowSphere[] = [];
  private prevFront: (THREE.Vector3 | null)[] = [null, null, null];
  private shadowGeo = new THREE.CircleGeometry(1, 7);
  private shadows: THREE.Mesh[] = [];
  private shadowMats: THREE.MeshBasicMaterial[] = [];

  // Caster rune and impact layers.
  private casterRune = createRing(0xff6a20, 0.86, 1, 6);
  private flash = new GlowSphere(0xffd890, { rim: false });
  private shocks = [createRing(0xffa040, 0.9, 1, 96), createRing(0xff7a28, 0.9, 1, 96), createRing(0xff7a28, 0.9, 1, 96)];
  private stars: StarBurst[] = [];
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xfff2c0, core: 0xffffff });
  private orangePlane = new THREE.Group();
  private orangeArcs: CrescentArc[] = [];
  private zap = new LightningArc({ width: 0.2, segments: 8, jitter: 0.01, branches: 0, rerollEvery: 0.03, dropChance: 0, core: 0xffffff, glow: 0xff60e0 });

  // Crater plates and spike crowns (lit, never zero scale).
  private plateMat = new THREE.MeshStandardMaterial({ color: 0x2e2733, roughness: 0.9, flatShading: true, emissive: 0xff3a10, emissiveIntensity: 0 });
  private plates: THREE.InstancedMesh;
  private plateSeed = Array.from({ length: PLATES }, (_, i) => ({
    a: (i / PLATES) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
    r: 2.2 + Math.random() * 1.0,
    s: 0.9 + Math.random() * 0.6,
    tilt: 0.55 + Math.random() * 0.4,
  }));
  private crownMat = new THREE.MeshStandardMaterial({ color: 0x15101a, roughness: 0.8, flatShading: true });
  private crown: THREE.InstancedMesh;
  private crownSeed = Array.from({ length: CROWN * 2 }, (_, i) => ({
    a: ((i % CROWN) / CROWN) * Math.PI * 2 + Math.random() * 0.3,
    h: 0.8 + Math.random() * 0.9,
    w: 0.8 + Math.random() * 0.4,
  }));

  // Red cartoon puffs (one instanced mesh, per-instance tone: red -> dark) and black rings.
  private puffTone: THREE.InstancedBufferAttribute;
  private puffs: THREE.InstancedMesh;
  private puffDefs: Puff[] = [];
  private ringPlanes: THREE.Group[] = [];
  private rings: CrescentArc[] = [];

  private flame: Emitter;
  private sparks: Emitter;
  private shards: Emitter;

  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpS = new THREE.Vector3();
  private tmpP = new THREE.Vector3();
  private tmpV = new THREE.Vector3();
  private tmpW = new THREE.Vector3();
  private tmpT = new THREE.Vector3();
  private readonly UP = new THREE.Vector3(0, 1, 0);
  private readonly AX = new THREE.Vector3(1, 0, 0);

  constructor(settings: EmberCometSettings = defaultEmberComet()) {
    this.settings = settings;
    this.screen.tint.set(0x3a2a40);
    this.screen.impactColor.set(0xfff3c0);
    this.screen.speedLineColor.set(0xffd090);

    this.strikes = [
      { pos: new THREE.Vector3(), fallStart: 0.55, fallDur: 0.35, hit: HIT, rock: 1, back: 12, height: 25, damage: settings.damage, radius: Infinity, done: false },
      { pos: new THREE.Vector3(), fallStart: 1.05, fallDur: 0.2, hit: 1.25, rock: 0.55, back: 7, height: 14, damage: 20, radius: 2, done: false },
      { pos: new THREE.Vector3(), fallStart: 1.3, fallDur: 0.2, hit: 1.5, rock: 0.75, back: 7, height: 14, damage: 20, radius: 2.4, done: false },
    ];

    for (let i = 0; i < 3; i++) {
      const rock = new THREE.Mesh(this.rockGeo, this.rockMat);
      rock.visible = false;
      this.rocks.push(rock);
      const front = new GlowSphere(0xff7a20, { rim: false });
      this.fronts.push(front);
      const mat = new THREE.MeshBasicMaterial({ color: 0x07040a, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      this.shadowMats.push(mat);
      const sh = new THREE.Mesh(this.shadowGeo, mat);
      sh.rotation.x = -Math.PI / 2;
      sh.visible = false;
      this.shadows.push(sh);
      this.group.add(rock, front.mesh, sh);
    }

    // Plates: flat triangular slabs, base on the ground, tip up.
    const tri = new THREE.Shape();
    tri.moveTo(-0.7, 0); tri.lineTo(0.7, 0); tri.lineTo(0.1, 2.2); tri.closePath();
    const plateGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.35, bevelEnabled: false });
    plateGeo.translate(0, 0, -0.175);
    this.plates = new THREE.InstancedMesh(plateGeo, this.plateMat, PLATES);
    this.plates.frustumCulled = false;
    const coneGeo = new THREE.ConeGeometry(0.22, 1, 5);
    coneGeo.translate(0, 0.5, 0);
    this.crown = new THREE.InstancedMesh(coneGeo, this.crownMat, CROWN * 2);
    this.crown.frustumCulled = false;

    // Puffs: toon red spheres. aTone 0 = bright red, 1 = burnt dark.
    for (let i = 0; i < PUFF_TOTAL; i++) {
      const strike = i < PUFFS_MAIN ? 0 : i < PUFFS_MAIN + PUFFS_SMALL ? 1 : 2;
      const big = strike === 0;
      const ang = Math.random() * Math.PI * 2;
      const rad = (big ? 0.2 + Math.random() * 1.5 : 0.1 + Math.random() * 0.7);
      this.puffDefs.push({
        strike,
        off: new THREE.Vector3(Math.cos(ang) * rad, Math.random() * 0.5, Math.sin(ang) * rad),
        size: big ? 0.8 + Math.random() * 0.5 : 0.45 + Math.random() * 0.3,
        delay: (i % (big ? PUFFS_MAIN : PUFFS_SMALL)) * 0.04,
      });
    }
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
    this.puffTone = new THREE.InstancedBufferAttribute(new Float32Array(PUFF_TOTAL), 1);
    puffGeo.setAttribute('aTone', this.puffTone);
    const puffMat = new THREE.ShaderMaterial({
      uniforms: {
        uBody0: { value: new THREE.Color(0xe0201a) }, uRim0: { value: new THREE.Color(0xff8a5a) },
        uBody1: { value: new THREE.Color(0x3a0a0a) }, uRim1: { value: new THREE.Color(0x7a2a20) },
      },
      vertexShader: /* glsl */ `
        attribute float aTone; varying vec3 vN; varying vec3 vView; varying float vTone;
        void main() {
          vec4 p = instanceMatrix * vec4(position, 1.0);
          vec4 mv = modelViewMatrix * p;
          vec3 n = normalMatrix * (mat3(instanceMatrix) * normal);
          vN = n / max(length(n), 1e-6);
          vView = normalize(-mv.xyz);
          vTone = aTone;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBody0, uRim0, uBody1, uRim1; varying vec3 vN; varying vec3 vView; varying float vTone;
        void main() {
          vec3 body = mix(uBody0, uBody1, vTone);
          vec3 col = body;
          float l = dot(vN, normalize(vec3(-0.3, 0.7, 0.6)));
          if (l > 0.55) col = mix(body, vec3(1.0, 0.45, 0.3), 0.45 * (1.0 - vTone));
          else if (l < -0.2) col = body * 0.65;
          float rim = 1.0 - abs(dot(vN, vView));
          if (rim > 0.74) col = mix(uRim0, uRim1, vTone);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.puffs = new THREE.InstancedMesh(puffGeo, puffMat, PUFF_TOTAL);
    this.puffs.frustumCulled = false;

    for (let i = 0; i < 3; i++) {
      const plane = new THREE.Group();
      const arc = new CrescentArc({ radius: 1, width: 0.4, style: 'toon', edge: 0x2a1212, mid: 0x0b0607, outer: 0x000000, sweep: Math.PI * 1.5 });
      plane.add(arc.mesh);
      this.ringPlanes.push(plane);
      this.rings.push(arc);
      this.group.add(plane);
    }
    for (let i = 0; i < 3; i++) {
      const arc = new CrescentArc({ radius: 1, width: 0.55, style: 'toon', edge: 0xfff0b0, mid: 0xff8a20, outer: 0x6a1a05, sweep: Math.PI * 1.3 });
      arc.mesh.rotation.z = (i * Math.PI * 2) / 3;
      this.orangePlane.add(arc.mesh);
      this.orangeArcs.push(arc);
    }
    this.orangePlane.rotation.x = -Math.PI / 2;

    for (let i = 0; i < 3; i++) {
      const big = i === 0;
      const star = new StarBurst({ points: big ? 12 : 8, color: 0xffd060, core: 0xfffbe0, additive: false });
      this.stars.push(star);
      this.group.add(star.mesh);
    }

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 11, speedJitter: 0.6, spread: 100, gravity: 10, drag: 0.9,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#ffc070', colorEnd: '#e02010',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.flame = new Emitter({
      ...defaultSettings(), maxParticles: 1800, rate: 0, lifetime: 0.45, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.3, speed: 1.2, speedJitter: 0.8, spread: 180, gravity: -1, drag: 2,
      sizeStart: 0.9, sizeEnd: 0.15, colorStart: '#fff0b0', colorEnd: '#a01808', colorMid: '#ff8a20',
      opacityStart: 0.45, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.5, spin: 0.5,
    });
    this.shards = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 1.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 9, speedJitter: 0.7, spread: 110, gravity: 10, drag: 0.8,
      sizeStart: 0.3, sizeEnd: 0.1, colorStart: '#1a0f14', colorEnd: '#0a0508',
      opacityStart: 0.95, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.2, spin: 1.5,
    });
    this.emitters.push(this.flame, this.sparks, this.shards);
    for (const e of this.emitters) this.group.add(e.points);

    this.group.add(this.casterRune.mesh, this.flash.mesh, this.orangePlane, this.zap.mesh, this.glint.mesh);
    for (const s of this.shocks) this.group.add(s.mesh);
    this.group.add(this.plates, this.crown, this.puffs);
    this.reset();
  }

  /** Low-poly rock: an icosahedron with positions displaced by a deterministic function (so shared corners agree). */
  private static makeRockGeometry() {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + 0.22 * Math.sin(x * 7.1 + y * 3.3) * Math.cos(z * 5.7 + x * 2.1) + 0.12 * Math.sin(y * 9.3 - z * 4.1);
      p.setXYZ(i, x * k * 1.1, y * k * 0.9, z * k);
    }
    g.computeVertexNormals();
    return g;
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return HIT;
  }

  /** Aim point and the two aftershock spots (world), for telegraphs. */
  get spots(): THREE.Vector3[] {
    return this.strikes.map((s) => s.pos);
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.point.copy(ctx.point).setY(0);
    this.from.copy(ctx.from).setY(0);
    this.dir.copy(this.from).sub(this.point).setY(0);
    if (this.dir.lengthSq() < 1e-6) this.dir.set(0, 0, 1);
    this.dir.normalize();
    this.perp.set(-this.dir.z, 0, this.dir.x);
    const [m, a, b] = this.strikes;
    m.pos.copy(this.point);
    a.pos.copy(this.point).addScaledVector(this.tmpV.copy(this.perp).multiplyScalar(0.9).addScaledVector(this.dir, 0.44).normalize(), 3);
    b.pos.copy(this.point).addScaledVector(this.tmpV.copy(this.perp).multiplyScalar(-0.75).addScaledVector(this.dir, -0.66).normalize(), 3);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.point).setY(1);
    this.casterRune.mesh.position.set(this.from.x, 0.05, this.from.z);
    this.orangePlane.position.set(this.point.x, 0.2, this.point.z);
    this.ringPlanes.forEach((p, i) => {
      p.position.set(this.point.x, 1.3, this.point.z);
      p.rotation.set(-Math.PI / 2 + (i - 1) * 0.55, i * 1.1, 0);
    });
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.shake = 0;
    for (const s of this.strikes) s.done = false;
    this.prevFront = [null, null, null];
    clearScreenFx(this.screen);
    this.zap.opacity = 0;
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    this.strikes.forEach((s, i) => { if (!s.done && this.time >= s.hit) this.onStrike(i); });
    this.zap.update(dt);
    this.layout(dt);
  }

  /** Rock centre for strike i at fall progress v (0..1, may exceed the range for a direction estimate). */
  private rockAt(i: number, v: number, out: THREE.Vector3) {
    const s = this.strikes[i];
    const e = v * v;
    const r = this.rockRadius(i);
    return out.copy(s.pos).addScaledVector(this.dir, s.back * (1 - e)).setY(r * 0.8 + s.height * (1 - e));
  }

  private rockRadius(i: number) {
    return i === 0 ? this.settings.rockSize : this.settings.rockSize * this.strikes[i].rock;
  }

  private layout(dt: number) {
    const t = this.time;
    const P = this.point;
    const after = t - HIT;

    // --- Screen grade: slightly dark during the build-up, focus lines while the comet falls. ---
    this.screen.darken = t < HIT ? 0.3 * smoothstep(t / 0.35) : 0.3 * Math.exp(-after * 8);
    this.screen.speedLines = t > 0.55 && t < HIT ? 0.55 * smoothstep((t - 0.55) / 0.3) : 0;
    this.screen.impact = impactFrameAt(t, HIT, [2, 0, 2, 0, 2], STROBE_FRAME);

    // --- Caster rune: an ember glyph under the caster while the shadow starts to slide. ---
    const charge = smoothstep(t / 0.5);
    this.casterRune.mesh.scale.setScalar(1.2 + 1.2 * charge);
    this.casterRune.mesh.rotation.z = t * 3;
    this.casterRune.material.opacity = t < 0.55 ? 0.5 * charge : 0.5 * Math.exp(-(t - 0.55) * 6);

    // --- Per strike: shadow on the ground (the telegraph), rock, fire at the leading edge. ---
    let shake = 0;
    this.strikes.forEach((s, i) => {
      const age = t - s.hit;
      const rock = this.rocks[i], shadow = this.shadows[i], mat = this.shadowMats[i], front = this.fronts[i];
      const R = this.rockRadius(i);
      const v = (t - s.fallStart) / s.fallDur;
      const falling = v >= 0 && t < s.hit;

      // Shadow: main slides in from the caster's side and grows, then follows the rock's ground point;
      // after the hit it stays as the scorched crater and fades. Aftershock shadows just grow on their spot.
      let sx = s.pos.x, sz = s.pos.z, radius = 0.01, op = 0;
      if (i === 0) {
        if (t < 0.55) {
          const u = smoothstep(t / 0.55);
          const d = 16 - 4 * u;
          sx += this.dir.x * d; sz += this.dir.z * d;
          radius = 1.8 * (0.6 + 0.6 * u);
          op = 0.3 + 0.4 * u;
        } else if (t < s.hit) {
          const e = clamp01(v) * clamp01(v);
          const d = s.back * (1 - e);
          sx += this.dir.x * d; sz += this.dir.z * d;
          radius = 1.8 * (1.2 + 0.4 * clamp01(v));
          op = 0.7 + 0.15 * clamp01(v);
        } else {
          radius = 2.4;
          op = 0.6 * (1 - smoothstep((t - 1.8) / 0.8));
        }
      } else if (t >= 0.9 && t < s.hit) {
        const u = (t - 0.9) / (s.hit - 0.9);
        radius = R * (0.5 + 0.7 * u);
        op = 0.2 + 0.45 * u;
      } else if (t >= s.hit) {
        radius = R * 1.3;
        op = 0.55 * (1 - smoothstep((t - s.hit) / 0.9));
      }
      shadow.position.set(sx, 0.03 + i * 0.002, sz);
      shadow.scale.set(Math.max(radius, 1e-3), Math.max(radius, 1e-3), 1);
      shadow.rotation.z = i * 1.3 + (t < s.hit ? t * 0.8 : 0.8 * s.hit);
      mat.opacity = op;
      shadow.visible = op > 0.01;

      // Rock + fire. Fire only on the leading edge: glow + flame bursts at the front, streaks behind.
      if (falling) {
        this.rockAt(i, v, this.tmpP);
        this.rockAt(i, v + 0.03, this.tmpT);
        const travel = this.tmpT.sub(this.tmpP);
        if (travel.lengthSq() < 1e-9) travel.set(0, -1, 0);
        travel.normalize();
        rock.visible = true;
        rock.position.copy(this.tmpP);
        rock.scale.setScalar(Math.max(R, 1e-4));
        rock.rotation.set(t * 3 + i, t * 2.2, t * 1.4 + i * 2);
        const fp = this.tmpW.copy(this.tmpP).addScaledVector(travel, R * 0.9);
        front.mesh.position.copy(fp);
        front.mesh.scale.setScalar(R * 0.8);
        front.opacity = 0.5;
        if (dt > 0) {
          const prev = this.prevFront[i];
          const n = i === 0 ? 14 : 8;
          if (prev) {
            for (let k = 1; k <= 3; k++) this.flame.burst(Math.round(n / 3) + 1, this.tmpV.copy(prev).lerp(fp, k / 3));
          } else {
            this.flame.burst(n, fp);
          }
          this.prevFront[i] = (prev ?? new THREE.Vector3()).copy(fp);
          this.flame.burst(i === 0 ? 6 : 3, this.tmpV.copy(this.tmpP).addScaledVector(travel, -R * 0.6));
          this.shards.burst(i === 0 ? 3 : 1, this.tmpV.copy(this.tmpP).addScaledVector(travel, -R * 1.1));
        }
        shake = Math.max(shake, 0.03);
      } else {
        rock.visible = false;
        front.opacity = 0;
      }

      // Impact shockwave ring.
      const ring = this.shocks[i];
      if (age >= 0) {
        const speed = i === 0 ? 24 : 14;
        ring.mesh.position.set(s.pos.x, 0.06, s.pos.z);
        ring.mesh.scale.setScalar(1 + age * speed);
        ring.material.opacity = Math.max(0, (i === 0 ? 0.8 : 0.55) * (1 - age / (i === 0 ? 0.5 : 0.35)));
        shake = Math.max(shake, (i === 0 ? 0.9 : i === 1 ? 0.35 : 0.5) * Math.exp(-age * (i === 0 ? 6 : 9)));
      } else {
        ring.material.opacity = 0;
      }

      // Star pop.
      const pop = StarBurst.pop(age, i === 0 ? 0.14 : 0.08, i === 0 ? 0.2 : 0.14);
      const size = i === 0 ? 5.5 : i === 1 ? 2.4 : 3.2;
      this.stars[i].set(this.tmpV.set(s.pos.x, 1.4, s.pos.z), size * pop.scale, pop.opacity, i * 0.5);
    });
    this.shake = shake;

    // --- Main impact extras: flash, glint, flat orange crescents, magenta line. ---
    const a = after;
    this.flash.mesh.position.set(P.x, 1.2, P.z);
    this.flash.mesh.scale.setScalar(2 + Math.max(0, a) * 8);
    this.flash.opacity = a >= 0 ? 0.85 * Math.exp(-a * 14) : 0;
    const g = StarBurst.pop(a - 0.06, 0.05, 0.25);
    this.glint.set(this.tmpV.set(P.x, 3.4, P.z), 1.1 * g.scale, g.opacity, t * 2);

    this.orangeArcs.forEach((arc, i) => {
      if (a < 0 || a > 0.5) { arc.opacity = 0; return; }
      const sc = Math.max(1e-3, 4 * easeOut(a / 0.1) * (1 - 0.1 * i));
      arc.mesh.scale.setScalar(sc);
      arc.head = a * 6 + i * 0.15;
      arc.length = 0.55;
      arc.time = t;
      arc.opacity = 1 - smoothstep((a - 0.3) / 0.2);
    });
    const zapOn = a >= 0 && a < STROBE_FRAME * 2 + 0.01;
    if (zapOn) {
      this.zap.setEnds(
        this.tmpP.copy(P).addScaledVector(this.perp, -4.5).setY(1.2),
        this.tmpV.copy(P).addScaledVector(this.perp, 4.5).setY(1.2),
      );
    }
    this.zap.opacity = zapOn ? 0.95 : 0;

    // --- Crater plates: big dark triangles tilt up around the crater, then sink. ---
    const sink = smoothstep((t - 2.1) / 0.9);
    const rise = easeOut(a / 0.12);
    this.plateMat.emissiveIntensity = a >= 0 ? 0.8 * Math.exp(-a * 2.2) : 0;
    for (let i = 0; i < PLATES; i++) {
      const pl = this.plateSeed[i];
      let theta = 1.5, y = -5;
      if (a >= 0) {
        theta = 1.5 + (pl.tilt - 1.5) * rise;
        theta += (1.5 - theta) * sink;
        y = -0.1 - sink * 1.8;
      }
      this.tmpQ.setFromAxisAngle(this.UP, pl.a).multiply(this.tmpQ2.setFromAxisAngle(this.AX, theta));
      this.tmpP.set(P.x + Math.sin(pl.a) * pl.r, y, P.z + Math.cos(pl.a) * pl.r);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS.setScalar(Math.max(1e-4, pl.s)));
      this.plates.setMatrixAt(i, this.tmpM);
    }
    this.plates.instanceMatrix.needsUpdate = true;

    // --- Aftershock spike crowns: black cones burst out around each small rock, later sink. ---
    for (let k = 0; k < 2; k++) {
      const s = this.strikes[k + 1];
      const ca = t - s.hit;
      const grow = easeOut(ca / 0.08);
      const crownSink = smoothstep((ca - 0.9) / 0.5);
      for (let j = 0; j < CROWN; j++) {
        const cs = this.crownSeed[k * CROWN + j];
        const rad = this.rockRadius(k + 1) * 0.55 + 0.25;
        const lift = ca >= 0 ? grow * (1 - crownSink) : 0;
        this.tmpQ.setFromAxisAngle(this.UP, cs.a).multiply(this.tmpQ2.setFromAxisAngle(this.AX, 0.5));
        this.tmpP.set(s.pos.x + Math.sin(cs.a) * rad, -0.05, s.pos.z + Math.cos(cs.a) * rad);
        const h = Math.max(1e-4, cs.h * (k === 1 ? 1.3 : 1) * lift);
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS.set(Math.max(1e-4, cs.w * (k === 1 ? 1.2 : 1)), h, Math.max(1e-4, cs.w)));
        this.crown.setMatrixAt(k * CROWN + j, this.tmpM);
      }
    }
    this.crown.instanceMatrix.needsUpdate = true;

    // --- Red cartoon puffs: bulge out, darken toward burnt, shrink away. ---
    const tone = this.puffTone.array as Float32Array;
    for (let i = 0; i < PUFF_TOTAL; i++) {
      const d = this.puffDefs[i];
      const s = this.strikes[d.strike];
      const age = t - s.hit - 0.05 - d.delay;
      if (age < 0 || t > 2.5) {
        this.tmpM.compose(this.tmpP.set(0, -50, 0), this.tmpQ.identity(), this.tmpS.setScalar(1e-4));
        this.puffs.setMatrixAt(i, this.tmpM);
        tone[i] = 0;
        continue;
      }
      const big = d.strike === 0;
      const grow = easeOut(age / (big ? 0.6 : 0.4));
      const shrink = smoothstep((age - (big ? 0.9 : 0.55)) / (big ? 0.7 : 0.45));
      const m = 0.5 + 0.9 * grow;
      const sc = Math.max(1e-4, d.size * m * (1 - shrink));
      this.tmpP.copy(s.pos).addScaledVector(d.off, 0.5 + 0.5 * grow);
      this.tmpP.y += d.size * 0.5 + age * 0.5;
      this.tmpM.compose(this.tmpP, this.tmpQ.identity(), this.tmpS.setScalar(sc));
      this.puffs.setMatrixAt(i, this.tmpM);
      tone[i] = smoothstep((age - 0.4) / 0.7);
    }
    this.puffs.instanceMatrix.needsUpdate = true;
    this.puffTone.needsUpdate = true;

    // --- Black rings swirl round the puff cluster, expanding and thinning. ---
    const ra = a - 0.05;
    this.rings.forEach((arc, i) => {
      if (ra < 0 || ra > 1.3) { arc.opacity = 0; return; }
      arc.mesh.scale.setScalar(Math.max(1e-3, 1.5 + ra * 2.4 + i * 0.35));
      arc.mesh.rotation.z = ra * (9 + i * 2) + i * 2;
      arc.head = 1.1;
      arc.length = Math.max(0.05, 0.95 - ra * 0.65);
      arc.erosion = clamp01(ra * 0.7);
      arc.time = t;
      arc.opacity = 1 - smoothstep((ra - 1.0) / 0.3);
    });

  }

  private onStrike(i: number) {
    const s = this.strikes[i];
    s.done = true;
    const c = this.tmpP.copy(s.pos).setY(0.3);
    const main = i === 0;
    this.sparks.burst(main ? 420 : 160, c);
    this.shards.burst(main ? 140 : 50, c);
    this.flame.burst(main ? 160 : 60, this.tmpV.copy(s.pos).setY(0.6));
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, k) => {
      const tp = ctx.targetPos[k];
      if (!tp) return;
      const dx = tp.x - s.pos.x, dz = tp.z - s.pos.z;
      if (!main && Math.hypot(dx, dz) > s.radius) return;
      // A target standing exactly on the spot gets a nudged source so the knockback direction is defined.
      const src = s.pos.clone();
      if (dx * dx + dz * dz < 1e-4) src.add(new THREE.Vector3(0.01, 0, 0.01));
      ctx.hit(e, { damage: s.damage, knock: main ? 9 : 5, from: src, color: main ? '#ffb040' : undefined });
    });
  }
}

export const emberCometModule: EffectModule = {
  label: 'ember comet',
  category: 'targeted',
  targeting: { mode: 'ground', radius: 4 },
  create: () => new EmberComet(),
  telegraphs(effect) {
    const e = effect as EmberComet;
    if (!e.ctx) return [];
    const [m, a, b] = e.spots;
    return [
      { shape: { kind: 'circle' as const, x: m.x, z: m.z, radius: 4 }, start: 0.05, impact: 0.9 },
      { shape: { kind: 'circle' as const, x: a.x, z: a.z, radius: 2 }, start: 0.9, impact: 1.25 },
      { shape: { kind: 'circle' as const, x: b.x, z: b.z, radius: 2 }, start: 0.9, impact: 1.5 },
    ];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as EmberComet;
    if (e.ctx) frameCast(camera, controls, e.ctx, 12);
  },
  buildGui(f, effect) {
    const s = (effect as EmberComet).settings;
    f.add(s, 'loop');
    f.add(s, 'rockSize', 1, 4, 0.1).name('rock size');
    f.add(s, 'damage', 1, 150, 1);
  },
};
