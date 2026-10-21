import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  ENEMY_POS, Enemy, GlowSphere, LightPillar, createCaster, createGround, createRing, createSwordGeometry,
  frameArena, smoothstep, softDotTexture,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Solar Verdict (original): the sun itself passes judgement. The caster raises a blade, the scene dims to amber-black
 * and a sun forms high above the enemy (white-gold core, rotating flare spikes, writhing prominence arcs). A sigil with
 * a sun-wheel and a pair of scales burns into the ground; the sun's light narrows into converging sunbeams, the ground
 * goes white-hot, and a single pillar of sunlight slams down. The enemy is burned black and crumbles; the sun sets.
 */
export interface SolarVerdictSettings {
  sunHeight: number;
  sunSize: number;
  color: string; // corona tint
  loop: boolean;
}

export const defaultSolarVerdict = (): SolarVerdictSettings => ({
  sunHeight: 17,
  sunSize: 2.6,
  color: '#ffa63a',
  loop: false,
});

const DURATION = 6.8;
const T_SUN = 1.0; // sun starts forming
const T_BEAMS = 2.9; // sunbeams start converging
const T_SLAM = 4.05; // the pillar starts to fall
const T_IMPACT = 4.3;
const BEAMS = 6;
const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const WHITE = new THREE.Color(0xfff4d8);
const CHAR = new THREE.Color(0x0b0807);

/** Tapered additive blade: bright wide root, pointed tip (uv.y 0 = root, 1 = tip). */
function spikeMaterial(color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main() {
        float w = 1.0 - abs(vUv.x * 2.0 - 1.0);
        float l = 1.0 - vUv.y;
        gl_FragColor = vec4(uColor, pow(w, 1.5) * pow(l, 1.3) * uOpacity);
      }`,
  });
}

const setSpike = (m: THREE.ShaderMaterial, v: number) => { m.uniforms.uOpacity.value = v; };

/** Orients a LightPillar as a beam between two world points. */
function aim(p: LightPillar, a: THREE.Vector3, b: THREE.Vector3, opacity: number, width = 1) {
  p.set(0, 0, 0, 1, opacity);
  const d = tmpA.subVectors(b, a);
  const len = d.length();
  p.mesh.position.copy(a).addScaledVector(d, 0.5);
  p.mesh.quaternion.setFromUnitVectors(UP, d.normalize());
  p.mesh.scale.set(width, Math.max(0.001, len), width);
}

interface SigilPart { mat: THREE.MeshBasicMaterial; base: number; color: THREE.Color }

export class SolarVerdict implements Effect {
  readonly group = new THREE.Group();
  readonly settings: SolarVerdictSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;
  private crumbled = false;
  private sunPos = new THREE.Vector3();

  private caster = createCaster(0xd8b45a);
  private enemy = new Enemy();
  private enemyBase = this.enemy.material.color.clone();

  // Backdrop that darkens the world.
  private dome = new THREE.Mesh(
    new THREE.SphereGeometry(70, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x1c0e03, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false }),
  );
  private dim = new THREE.Mesh(
    new THREE.CircleGeometry(60, 48),
    new THREE.MeshBasicMaterial({ color: 0x140a02, transparent: true, opacity: 0, depthWrite: false }),
  );

  // Blade.
  private bladeMat = new THREE.MeshStandardMaterial({
    color: 0xd9c07a, metalness: 0.7, roughness: 0.35, emissive: 0xffc24a, emissiveIntensity: 0.6,
  });
  private bladePivot = new THREE.Group();
  private bladeGlow = new GlowSphere(0xfff0c0, { rim: false });
  private link = new LightPillar(0xffd890, 0.14); // thread of light from blade tip to sun

  // Sun.
  private sunCore = new GlowSphere(0xfff0c8, { rim: false });
  private sunHalo = new GlowSphere(0xffa030);
  private sunSoft = new GlowSphere(0xff9020, { rim: false });
  private spikeA = spikeMaterial(0xffd890);
  private spikeB = spikeMaterial(0xffa040);
  private spikesA: THREE.Mesh[] = [];
  private spikesB: THREE.Mesh[] = [];
  private arcMat = new THREE.MeshBasicMaterial({
    color: 0xff7a1e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private arcs: THREE.Mesh[] = [];
  private sunLight = new THREE.PointLight(0xffc070, 0, 80, 1.5);
  private inflow: THREE.Points;
  private inflowSeeds: Float32Array;

  // Sigil.
  private sigil = new THREE.Group();
  private wheel = new THREE.Group();
  private rayMat = spikeMaterial(0xffa030);
  private sigilParts: SigilPart[] = [];
  private polyRings: THREE.Mesh[] = [];
  private pool = new GlowSphere(0xfff0c8, { rim: false });
  private poolDisc = createRing(0xfff2d0, 0, 1, 64);

  // Verdict.
  private beams: LightPillar[] = [];
  private slam = new LightPillar(0xffd890, 1.2);
  private slamCore = new LightPillar(0xfff6e0, 0.5);

  // Impact.
  private flash = new GlowSphere(0xfff6e0, { rim: false });
  private nova = new GlowSphere(0xffe9b0);
  private shock = createRing(0xffd27a, 0.88, 1, 96);
  private molten = createRing(0xff5a14, 0.55, 1, 64);
  private craterGlow = new GlowSphere(0xff5a10, { rim: false });
  private groundLight = new THREE.PointLight(0xffd890, 0, 60, 1.5);

  private embers: Emitter;
  private sparks: Emitter;
  private ash: Emitter;

  constructor(settings: SolarVerdictSettings = defaultSolarVerdict()) {
    this.settings = settings;
    const g = this.group;
    this.dome.renderOrder = -2;
    this.dim.renderOrder = -1;
    this.dim.rotation.x = -Math.PI / 2;
    this.dim.position.y = 0.02;
    g.add(createGround(), this.dome, this.dim, this.caster.group, this.enemy.group);

    // Blade held point-up in the caster's raised hand (geometry: tip at origin pointing -Y).
    const blade = new THREE.Mesh(createSwordGeometry(), this.bladeMat);
    blade.scale.setScalar(2);
    blade.position.y = -1.72;
    this.bladePivot.add(blade);
    g.add(this.bladePivot, this.bladeGlow.mesh, this.link.mesh);

    // Sun.
    g.add(this.sunSoft.mesh, this.sunHalo.mesh, this.sunCore.mesh, this.sunLight, this.groundLight);
    const spikeGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(Math.PI / 2);
    for (let i = 0; i < 18; i++) {
      const a = new THREE.Mesh(spikeGeo, this.spikeA);
      a.userData = { ang: (i / 18) * Math.PI * 2, len: 2.0 + 1.0 * (0.5 + 0.5 * Math.sin(i * 7.1)), w: 0.32 };
      const b = new THREE.Mesh(spikeGeo, this.spikeB);
      b.userData = { ang: ((i + 0.5) / 18) * Math.PI * 2, len: 1.4 + 0.6 * (0.5 + 0.5 * Math.sin(i * 3.7)), w: 0.24 };
      this.spikesA.push(a); this.spikesB.push(b);
      g.add(a, b);
    }
    for (let i = 0; i < 3; i++) {
      const arc = new THREE.Mesh(new THREE.BufferGeometry(), this.arcMat);
      arc.visible = false;
      this.arcs.push(arc);
      g.add(arc);
    }
    // Sunlight motes gathering into the sun while it forms.
    this.inflowSeeds = new Float32Array(260 * 4);
    for (let i = 0; i < 260; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      this.inflowSeeds.set([r * Math.cos(a), u, r * Math.sin(a), Math.random()], i * 4);
    }
    this.inflow = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(260 * 3), 3)),
      new THREE.PointsMaterial({
        map: softDotTexture(), color: 0xffd890, size: 0.6, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    this.inflow.frustumCulled = false;
    g.add(this.inflow);

    this.buildSigil();
    g.add(this.sigil, this.pool.mesh, this.poolDisc.mesh);
    this.poolDisc.mesh.position.y = 0.06;

    for (let i = 0; i < BEAMS; i++) {
      const b = new LightPillar(0xfff0c0, 0.28);
      this.beams.push(b);
      g.add(b.mesh);
    }
    g.add(this.slam.mesh, this.slamCore.mesh);
    g.add(this.flash.mesh, this.nova.mesh, this.shock.mesh, this.molten.mesh, this.craterGlow.mesh);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.1, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.7, speed: 14, speedJitter: 0.6, spread: 80, gravity: 12, drag: 0.7,
      sizeStart: 0.17, sizeEnd: 0.02, colorStart: '#fff6e0', colorMid: '#ffc860', colorEnd: '#ff6a18',
      opacityStart: 0.85, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.embers = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 2.0, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 5.5, originY: 0.1, speed: 2.6, speedJitter: 0.5, spread: 14, gravity: -0.6, drag: 0.5,
      sizeStart: 0.13, sizeEnd: 0.03, colorStart: '#fff0c0', colorMid: '#ffa030', colorEnd: '#ff4a10',
      opacityStart: 0.75, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.ash = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 3.2, lifetimeJitter: 0.35,
      shape: 'sphere', shapeSize: 1.8, originY: 0.9, speed: 3.2, speedJitter: 0.5, spread: 60, gravity: -0.7, drag: 0.8,
      sizeStart: 1.2, sizeEnd: 3.2, colorStart: '#2c2219', colorMid: '#17110d', colorEnd: '#0a0807',
      opacityStart: 0.75, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.6, spin: 0.5, groundFade: 0.4,
    });
    // Dark ash first so the bright layers draw over it.
    this.emitters.push(this.ash, this.embers, this.sparks);
    for (const e of this.emitters) g.add(e.points);
    this.ash.points.renderOrder = -0.5;

    this.applyStyle();
    this.reset();
  }

  /** Sigil on the ground: concentric rings, a 12-ray sun-wheel and a flat pair of balanced scales. */
  private buildSigil() {
    const addRing = (color: number, inner: number, outer: number, seg: number, base: number, poly = false) => {
      const r = createRing(color, inner, outer, seg);
      this.sigil.add(r.mesh);
      this.sigilParts.push({ mat: r.material, base, color: new THREE.Color(color) });
      if (poly) this.polyRings.push(r.mesh);
    };
    addRing(0xffa940, 7.35, 7.5, 96, 0.55);
    addRing(0xffd27a, 8.1, 8.5, 96, 0.45);
    addRing(0xffc060, 3.3, 3.45, 64, 0.6);
    addRing(0xffa940, 3.85, 4.0, 12, 0.5, true);

    // Sun-wheel: 12 tapered rays between the inner and outer ring.
    const rayGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(-Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const len = i % 2 === 0 ? 3.1 : 2.0;
      const ray = new THREE.Mesh(rayGeo, this.rayMat);
      ray.rotation.y = a;
      ray.scale.set(0.5, 1, len);
      ray.position.set(-Math.sin(a) * 4.2, 0.05, -Math.cos(a) * 4.2);
      this.wheel.add(ray);
    }
    this.sigil.add(this.wheel);

    // Scales (flat on the ground): beam along Z, post along X, a ring pan hanging from each end.
    const glyphMat = new THREE.MeshBasicMaterial({
      color: 0xffe0a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.sigilParts.push({ mat: glyphMat, base: 0.7, color: new THREE.Color(0xffe0a0) });
    const bar = (w: number, h: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), glyphMat);
      m.position.set(x, 0.06, z);
      this.sigil.add(m);
    };
    bar(0.14, 3.4, 0.8, 0); // beam
    bar(2.7, 0.14, -0.55, 0); // post
    bar(0.14, 0.9, -1.9, 0); // base
    for (const sgn of [-1, 1]) {
      bar(0.7, 0.07, 0.45, sgn * 1.6); // string
      const pan = createRing(0xffe0a0, 0.45, 0.6, 32);
      pan.mesh.position.set(-0.45, 0.06, sgn * 1.6);
      this.sigil.add(pan.mesh);
      this.sigilParts.push({ mat: pan.material, base: 0.7, color: new THREE.Color(0xffe0a0) });
    }
    const pivot = createRing(0xffe0a0, 0.14, 0.24, 16);
    pivot.mesh.position.set(0.8, 0.06, 0);
    this.sigil.add(pivot.mesh);
    this.sigilParts.push({ mat: pivot.material, base: 0.8, color: new THREE.Color(0xffe0a0) });
  }

  applyStyle() {
    this.spikeB.uniforms.uColor.value.set(this.settings.color);
    this.sunHalo.color.set(this.settings.color);
  }

  get duration() {
    return DURATION;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.crumbled = false;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    this.enemy.material.color.copy(this.enemyBase);
    for (const e of this.emitters) { e.settings.rate = 0; e.clear(); }
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    if (!this.impacted && this.time >= T_IMPACT) this.onImpact();
    if (this.impacted && !this.crumbled && this.time >= T_IMPACT + 0.9) {
      this.crumbled = true;
      this.ash.burst(140, ENEMY_POS);
    }
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const after = t - T_IMPACT;
    const post = this.impacted;
    const fade = 1 - smoothstep((t - (DURATION - 0.8)) / 0.8);
    this.sunPos.set(0, s.sunHeight, 0);

    // --- Darkness: sky dome + dimmed ground -------------------------------------------------------------------------
    const dark = smoothstep((t - 0.4) / 1.6) * (1 - smoothstep((t - 5.4) / 1.4));
    (this.dome.material as THREE.MeshBasicMaterial).opacity = 0.78 * dark;
    (this.dim.material as THREE.MeshBasicMaterial).opacity = 0.5 * dark;

    // --- Caster raises the blade -----------------------------------------------------------------------------------
    const raise = smoothstep(t / 1.0);
    const swing = smoothstep((t - T_SLAM) / 0.25);
    const ang = Math.PI * 0.5 + Math.PI * 0.5 * raise - 0.3 * Math.PI * swing;
    const hand = tmpB.copy(this.caster.group.position).add(new THREE.Vector3(0.5, 1.9, -0.2));
    this.bladePivot.position.copy(hand);
    this.bladePivot.rotation.set(ang, 0, 0.12 * raise);
    this.bladeMat.emissiveIntensity = 0.5 + 0.5 * smoothstep((t - 0.6) / 1.2) + (post ? 1.5 * Math.exp(-after * 5) : 0);
    const tip = new THREE.Vector3(hand.x, hand.y - 1.72 * Math.cos(ang), hand.z - 1.72 * Math.sin(ang));
    this.bladeGlow.mesh.position.copy(tip);
    this.bladeGlow.mesh.scale.setScalar(0.25 + 0.45 * raise);
    this.bladeGlow.opacity = (0.5 * raise) * (post ? Math.exp(-after * 3) : 1);

    // --- The sun ----------------------------------------------------------------------------------------------------
    const form = smoothstep((t - T_SUN) / 1.6);
    const setting = 1 - smoothstep((t - 5.2) / 1.3);
    const sun = form * setting;
    const charge = smoothstep((t - T_BEAMS) / (T_SLAM - T_BEAMS));
    const slamBoost = post ? Math.exp(-after * 3) : 0;
    const R = s.sunSize * sun * (1 + 0.15 * charge + 0.2 * slamBoost) * (1 + 0.04 * Math.sin(t * 6));
    this.sunCore.mesh.position.copy(this.sunPos);
    this.sunCore.mesh.scale.setScalar(Math.max(0.001, R));
    this.sunCore.opacity = 0.9 * sun;
    this.sunHalo.mesh.position.copy(this.sunPos);
    this.sunHalo.mesh.scale.setScalar(Math.max(0.001, R * 1.4));
    this.sunHalo.opacity = 0.4 * sun;
    this.sunSoft.mesh.position.copy(this.sunPos);
    this.sunSoft.mesh.scale.setScalar(Math.max(0.001, R * 2.4));
    this.sunSoft.opacity = 0.14 * sun;
    this.sunLight.position.copy(this.sunPos);
    this.sunLight.intensity = 300 * sun * (0.4 + 0.6 * charge);

    // Corona: two counter-rotating rings of tapered flare spikes.
    const spikeBoost = 1 + 0.25 * charge + 0.4 * slamBoost;
    setSpike(this.spikeA, 0.4 * sun * Math.min(spikeBoost, 1.25));
    setSpike(this.spikeB, 0.3 * sun * Math.min(spikeBoost, 1.25));
    for (let i = 0; i < this.spikesA.length; i++) {
      const a = this.spikesA[i], b = this.spikesB[i];
      const ud = a.userData as { ang: number; len: number; w: number };
      const vd = b.userData as { ang: number; len: number; w: number };
      a.position.copy(this.sunPos); b.position.copy(this.sunPos);
      a.rotation.x = ud.ang + t * 0.25;
      b.rotation.x = vd.ang - t * 0.4;
      const fa = 1 + 0.12 * Math.sin(t * 3 + i), fb = 1 + 0.15 * Math.sin(t * 4.3 + i * 1.7);
      a.scale.set(1, Math.max(0.001, ud.len * R * fa), Math.max(0.001, ud.w * R));
      b.scale.set(1, Math.max(0.001, vd.len * R * fb), Math.max(0.001, vd.w * R));
    }

    // Prominence arcs: half-loops rising off the surface, rebuilt each frame so they writhe.
    this.arcMat.opacity = 0.45 * sun;
    for (let i = 0; i < this.arcs.length; i++) {
      const m = this.arcs[i];
      if (R < 0.05) { m.visible = false; continue; }
      m.visible = true;
      const span = 1.0 + 0.25 * i, h = (0.9 + 0.25 * i) * R;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) {
        const u = k / 12, a = (u - 0.5) * span;
        const rho = R * 0.9 + h * Math.sin(Math.PI * u) * (1 + 0.25 * Math.sin(t * 1.7 + i * 2.1 + u * 5));
        pts.push(new THREE.Vector3(0.45 * R * Math.sin(t * 1.3 + i + u * 6) * Math.sin(Math.PI * u), rho * Math.cos(a), rho * Math.sin(a)));
      }
      m.geometry.dispose();
      m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.11 * R, 6);
      m.position.copy(this.sunPos);
      m.rotation.set(i * 2.1 + t * 0.15 + 0.5, 0.5 * Math.sin(t * 0.3 + i), 0);
    }

    // Motes of light streaming into the sun while it forms.
    const inflowOn = smoothstep((t - 0.9) / 0.4) * (1 - smoothstep((t - 2.9) / 0.4));
    (this.inflow.material as THREE.PointsMaterial).opacity = 0.7 * inflowOn;
    const ip = this.inflow.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 260; i++) {
      const sd = this.inflowSeeds;
      const p = (t * 0.55 + sd[i * 4 + 3]) % 1;
      const r = 1.2 * s.sunSize + (14 - 1.2 * s.sunSize) * (1 - p * p);
      ip.setXYZ(i, this.sunPos.x + sd[i * 4] * r, this.sunPos.y + sd[i * 4 + 1] * r, this.sunPos.z + sd[i * 4 + 2] * r);
    }
    ip.needsUpdate = true;

    // A thread of light from the blade tip up to the sun.
    const linkOp = 0.3 * smoothstep((t - 1.3) / 0.8) * (post ? Math.exp(-after * 6) : 1);
    aim(this.link, tip, this.sunPos, linkOp * (sun > 0.05 ? 1 : 0));

    // --- Sigil burns into the ground -------------------------------------------------------------------------------
    const burn = smoothstep((t - 1.8) / 1.4);
    const heat = post ? Math.exp(-after * 1.6) : smoothstep((t - 3.3) / 0.8);
    const sigOp = burn * (post ? 0.5 + 0.5 * Math.exp(-after * 0.8) : 1) * fade;
    this.sigil.scale.setScalar(0.75 + 0.25 * burn);
    this.wheel.rotation.y = t * 0.35;
    for (const m of this.polyRings) m.rotation.z = t * 0.3;
    for (const p of this.sigilParts) {
      p.mat.opacity = p.base * sigOp;
      p.mat.color.lerpColors(p.color, WHITE, heat * 0.7);
    }
    setSpike(this.rayMat, 0.45 * sigOp);
    (this.rayMat.uniforms.uColor.value as THREE.Color).lerpColors(new THREE.Color(0xffa030), WHITE, heat * 0.7);

    // Ground goes white-hot.
    this.pool.mesh.position.set(ENEMY_POS.x, 0.1, ENEMY_POS.z);
    this.pool.mesh.scale.set(6.5, 0.15, 6.5);
    this.pool.opacity = 0.55 * heat * fade;
    this.poolDisc.mesh.scale.setScalar(4);
    this.poolDisc.material.opacity = 0.3 * heat * fade;

    // Heat-shimmer embers rise from the burning ground.
    let rate = 0;
    if (!post && t > 1.9) rate = 40 + 150 * heat;
    else if (post) rate = 110 * Math.exp(-after * 1.0);
    this.embers.settings.rate = rate * (t < DURATION - 1 ? 1 : 0);

    // --- Converging sunbeams ----------------------------------------------------------------------------------------
    const appear = smoothstep((t - T_BEAMS) / 0.5);
    const ro = 4.5 + (0.15 - 4.5) * charge;
    const beamOp = post ? 0.3 * Math.exp(-after * 8) : 0.3 * appear * (1 - 0.4 * charge);
    for (let i = 0; i < BEAMS; i++) {
      const phi = (i / BEAMS) * Math.PI * 2 + t * 0.6;
      const a = tmpA.set(this.sunPos.x + Math.cos(phi) * R * 1.1, this.sunPos.y - R * 0.6, this.sunPos.z + Math.sin(phi) * R * 1.1).clone();
      const b = new THREE.Vector3(ENEMY_POS.x + Math.cos(phi) * ro, 0, ENEMY_POS.z + Math.sin(phi) * ro);
      aim(this.beams[i], a, b, sun > 0.05 ? beamOp : 0);
    }

    // --- The pillar of sunlight slams down ---------------------------------------------------------------------------
    if (!post && t >= T_SLAM) {
      const k = (t - T_SLAM) / (T_IMPACT - T_SLAM);
      const front = this.sunPos.y * (1 - k * k);
      const bottom = Math.max(0, front), top = Math.min(this.sunPos.y, front + 12);
      this.slam.set(ENEMY_POS.x, ENEMY_POS.z, bottom, top, 0.6);
      this.slamCore.set(ENEMY_POS.x, ENEMY_POS.z, bottom, top, 0.7);
    } else if (post) {
      const w = 1 + after * 0.5;
      this.slam.set(ENEMY_POS.x, ENEMY_POS.z, 0, this.sunPos.y, 0.6 * Math.exp(-after * 3));
      this.slam.mesh.scale.x = this.slam.mesh.scale.z = w;
      this.slamCore.set(ENEMY_POS.x, ENEMY_POS.z, 0, this.sunPos.y, 0.7 * Math.exp(-after * 5));
    } else {
      this.slam.set(0, 0, 0, 1, 0);
      this.slamCore.set(0, 0, 0, 1, 0);
    }

    // --- Impact -----------------------------------------------------------------------------------------------------
    if (post) {
      this.flash.mesh.position.set(ENEMY_POS.x, 1.3, ENEMY_POS.z);
      this.flash.mesh.scale.setScalar(8 + after * 30);
      this.flash.opacity = 0.95 * Math.exp(-after * 16);
      this.nova.mesh.position.set(ENEMY_POS.x, 1.2, ENEMY_POS.z);
      this.nova.mesh.scale.setScalar(1 + after * 20);
      this.nova.opacity = 0.55 * Math.exp(-after * 3.5);
      this.shock.mesh.scale.setScalar(1 + after * 26);
      this.shock.material.opacity = Math.max(0, 0.8 * (1 - after / 0.8));
      this.molten.mesh.scale.setScalar(Math.max(0.01, 4.2 * smoothstep(after / 0.5)));
      this.molten.mesh.rotation.z = t * 0.2;
      this.molten.material.opacity = 0.6 * Math.exp(-after * 0.9) * fade;
      this.craterGlow.mesh.position.set(ENEMY_POS.x, 0.1, ENEMY_POS.z);
      this.craterGlow.mesh.scale.set(4.2, 0.12, 4.2);
      this.craterGlow.opacity = 0.4 * Math.exp(-after * 0.7) * fade;
      this.groundLight.position.set(ENEMY_POS.x, 3, ENEMY_POS.z);
      this.groundLight.intensity = 500 * Math.exp(-after * 5) + 60 * Math.exp(-after * 0.8);
      this.shake = 1.0 * Math.exp(-after * 6);
    } else {
      this.flash.opacity = 0;
      this.nova.opacity = 0;
      this.shock.material.opacity = 0;
      this.molten.material.opacity = 0;
      this.craterGlow.opacity = 0;
      this.groundLight.intensity = 0;
      this.shake = 0;
    }

    // --- Enemy: heats, is burned black, crumbles ----------------------------------------------------------------------
    const burnt = post ? smoothstep(after / 0.25) : 0;
    this.enemy.material.color.lerpColors(this.enemyBase, CHAR, burnt);
    this.enemy.setFlash(post ? 1.2 * Math.exp(-after * 9) : 0.45 * charge);
    this.enemy.group.position.x = ENEMY_POS.x + (post ? 0 : 0.03 * charge * Math.sin(t * 60));
    this.enemy.setCrush(post ? smoothstep((after - 0.5) / 1.0) : 0);
  }

  private onImpact() {
    this.impacted = true;
    this.sparks.burst(800, ENEMY_POS);
    this.ash.burst(300, ENEMY_POS);
    this.embers.burst(300, ENEMY_POS);
  }
}

export const solarVerdictModule: EffectModule = {
  label: 'solar verdict',
  category: 'original',
  create: () => new SolarVerdict(),
  // The sigil marks the verdict area; the pillar lands at 4.3 s.
  telegraphs: () => [{ shape: { kind: 'circle', x: 0, z: 0, radius: 5 }, start: 1.8, impact: 4.3 }],
  bloom: { enabled: true, strength: 0.6, radius: 0.55, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const s = (effect as SolarVerdict).settings;
    frameArena(camera, controls, new THREE.Vector3(0, s.sunHeight * 0.45, 6), Math.max(12, s.sunHeight * 0.9));
  },
  buildGui(f, effect) {
    const v = effect as SolarVerdict;
    const s = v.settings;
    f.add(s, 'loop');
    f.add(s, 'sunHeight', 8, 30, 0.5).name('sun height');
    f.add(s, 'sunSize', 1.5, 5, 0.1).name('sun size');
    f.addColor(s, 'color').name('corona').onChange(() => v.applyStyle());
  },
};
