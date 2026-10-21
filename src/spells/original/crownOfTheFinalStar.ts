import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, smoothstep,
  softDotTexture,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Crown of the Final Star (original): seven stars ignite above the caster's head and spin into a crown that rises
 * over the enemy and widens into a vast constellation while the sky goes indigo. An eighth star is born at the
 * centre, swells white -> blue -> violet, pulls the seven in along spiral paths, collapses to a pinpoint (a beat of
 * darkness) and goes supernova: flash, layered shells, a rain of stardust and shards, a starlight crater under the
 * crushed enemy, then a slow afterglow with a faint new constellation.
 */
export interface FinalStarSettings {
  crownHeight: number;
  crownRadius: number;
  color: string; // constellation line / star tint
  loop: boolean;
}

export const defaultFinalStar = (): FinalStarSettings => ({
  crownHeight: 12,
  crownRadius: 6,
  color: '#9db8ff',
  loop: false,
});

const DURATION = 7.0;
const T_FINAL = 2.6; // the eighth star is born
const T_PULL = 3.6; // the seven are drawn in
const T_COLLAPSE = 4.5; // pinpoint
const T_NOVA = 4.85;
const STARS = 7;
const TRAIL = 36; // dust samples per star trail
const TRAIL_DT = 0.022;
const SKY_STARS = 360;
const TWO_PI = Math.PI * 2;
const WHITE = new THREE.Color(0xffffff);
const BLUE = new THREE.Color(0x5f9cff);
const VIOLET = new THREE.Color(0x9a5cff);
const SKY_INDIGO = new THREE.Color(0x070a24);
const SKY_VIOLET = new THREE.Color(0x1a1450);

/** Cross-shaped star flare quad (normal +X, faces the side camera). Spin it with mesh.rotation.x. */
function flareMaterial(color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float v = exp(-abs(p.x) * 24.0) * exp(-abs(p.y) * 2.8);
        float h = exp(-abs(p.y) * 24.0) * exp(-abs(p.x) * 2.8);
        float c = exp(-length(p) * 7.0);
        float edge = 1.0 - smoothstep(0.85, 1.0, length(p));
        gl_FragColor = vec4(uColor, clamp(v + h + c * 0.8, 0.0, 1.0) * edge * uOpacity);
      }`,
  });
}

interface Flare { mesh: THREE.Mesh; mat: THREE.ShaderMaterial }

function makeFlare(color: THREE.ColorRepresentation, geo: THREE.BufferGeometry): Flare {
  const mat = flareMaterial(color);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return { mesh, mat };
}

function setFlare(f: Flare, pos: THREE.Vector3, size: number, opacity: number, rot: number) {
  f.mat.uniforms.uOpacity.value = opacity;
  f.mesh.visible = opacity > 0.003 && size > 0.001;
  f.mesh.position.copy(pos);
  f.mesh.scale.set(1, size, size);
  f.mesh.rotation.x = rot;
}

// Constellation chords: the seven ring edges plus a heptagram {7/3}.
const SEGMENTS: [number, number][] = [];
for (let i = 0; i < STARS; i++) SEGMENTS.push([i, (i + 1) % STARS]);
for (let i = 0; i < STARS; i++) SEGMENTS.push([i, (i + 3) % STARS]);

// The faint new constellation left behind (offsets in the camera plane: y, z).
const NEW_STARS: [number, number][] = [[-2.5, -5], [0.5, -3.2], [-1, -1], [2, 0.8], [0, 3], [3, 5]];

export class CrownOfTheFinalStar implements Effect {
  readonly group = new THREE.Group();
  readonly settings: FinalStarSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private impacted = false;

  private caster = createCaster(0x22305a);
  private enemy = new Enemy();

  // Sky.
  private dome = new THREE.Mesh(
    new THREE.SphereGeometry(70, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x070a24, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false }),
  );
  private dim = new THREE.Mesh(
    new THREE.CircleGeometry(60, 48),
    new THREE.MeshBasicMaterial({ color: 0x080a28, transparent: true, opacity: 0, depthWrite: false }),
  );
  private skyA: THREE.Points;
  private skyB: THREE.Points;
  private afterglow = new GlowSphere(0x5a4cff, { rim: false });

  // The crown.
  private geo = new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2);
  private cores: GlowSphere[] = [];
  private flares: Flare[] = [];
  private crownGlow = new GlowSphere(0x9db8ff, { rim: false });
  private trails: THREE.Points;
  private trailColors: Float32Array;
  private lines: THREE.LineSegments;
  private lineMat = new THREE.LineBasicMaterial({
    color: 0x9db8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  // The final star.
  private finalCore = new GlowSphere(0xffffff, { rim: false });
  private finalHalo = new GlowSphere(0x5f9cff);
  private finalSoft = new GlowSphere(0x5f9cff, { rim: false });
  private finalFlare: Flare;
  private starLight = new THREE.PointLight(0x9db8ff, 0, 80, 1.5);

  // Supernova.
  private flash = new GlowSphere(0xffffff, { rim: false });
  private shellBright = new GlowSphere(0xe6eeff);
  private shellColour = new GlowSphere(0x7a5cff);
  private equator = createRing(0xc6d4ff, 0.9, 1, 128);
  private crater = createRing(0x7a9cff, 0.55, 1, 64);
  private craterRim = createRing(0xb8a0ff, 0.92, 1, 6);
  private craterPool = new GlowSphere(0x6a8cff, { rim: false });
  private groundLight = new THREE.PointLight(0xaec4ff, 0, 60, 1.5);

  // Aftermath constellation.
  private newFlares: Flare[] = [];
  private newLines: THREE.LineSegments;
  private newLineMat = new THREE.LineBasicMaterial({
    color: 0x9db8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  private nebula: Emitter;
  private shards: Emitter;
  private dust: Emitter;
  private sparkle: Emitter;

  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private tmpC = new THREE.Color();
  private starPositions: THREE.Vector3[] = [];
  private centre = new THREE.Vector3();

  constructor(settings: FinalStarSettings = defaultFinalStar()) {
    this.settings = settings;
    const g = this.group;
    this.dome.renderOrder = -2;
    this.dim.renderOrder = -1;
    this.dim.rotation.x = -Math.PI / 2;
    this.dim.position.y = 0.02;
    g.add(createGround(), this.dome, this.dim, this.caster.group, this.enemy.group);

    // Twinkling sky: two point layers that breathe in opposite phase.
    const makeSky = () => {
      const pos = new Float32Array(SKY_STARS * 3), col = new Float32Array(SKY_STARS * 3);
      for (let i = 0; i < SKY_STARS; i++) {
        const u = 0.05 + 0.95 * Math.random(), a = Math.random() * TWO_PI, r = Math.sqrt(1 - u * u) * 58;
        pos.set([r * Math.cos(a), u * 58, r * Math.sin(a)], i * 3);
        const c = new THREE.Color().setHSL(0.6 + Math.random() * 0.1, 0.5, 0.75 + Math.random() * 0.2);
        col.set([c.r, c.g, c.b], i * 3);
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(geom, new THREE.PointsMaterial({
        map: softDotTexture(), vertexColors: true, size: 1.1, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      pts.frustumCulled = false;
      return pts;
    };
    this.skyA = makeSky();
    this.skyB = makeSky();
    g.add(this.skyA, this.skyB, this.afterglow.mesh);

    // Seven crown stars: soft core + cross flare.
    for (let i = 0; i < STARS; i++) {
      this.cores.push(new GlowSphere(0xdfe9ff, { rim: false }));
      this.flares.push(makeFlare(0xbcd0ff, this.geo));
      this.starPositions.push(new THREE.Vector3());
      g.add(this.cores[i].mesh, this.flares[i].mesh);
    }
    g.add(this.crownGlow.mesh);

    // Star-dust trails following each star along its path.
    this.trailColors = new Float32Array(STARS * TRAIL * 3);
    this.trails = new THREE.Points(
      new THREE.BufferGeometry()
        .setAttribute('position', new THREE.BufferAttribute(new Float32Array(STARS * TRAIL * 3), 3))
        .setAttribute('color', new THREE.BufferAttribute(this.trailColors, 3)),
      new THREE.PointsMaterial({
        map: softDotTexture(), vertexColors: true, size: 0.3, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    this.trails.frustumCulled = false;
    g.add(this.trails);

    // Constellation lines.
    this.lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEGMENTS.length * 6), 3)),
      this.lineMat,
    );
    this.lines.frustumCulled = false;
    g.add(this.lines);

    // Final star.
    this.finalFlare = makeFlare(0xffffff, this.geo);
    g.add(this.finalSoft.mesh, this.finalHalo.mesh, this.finalCore.mesh, this.finalFlare.mesh, this.starLight, this.groundLight);

    // Supernova + crater.
    g.add(this.flash.mesh, this.shellBright.mesh, this.shellColour.mesh, this.equator.mesh);
    g.add(this.crater.mesh, this.craterRim.mesh, this.craterPool.mesh);
    this.crater.mesh.position.y = 0.05;
    this.craterRim.mesh.position.y = 0.06;

    // New constellation.
    for (let i = 0; i < NEW_STARS.length; i++) {
      const f = makeFlare(0xbcd0ff, this.geo);
      this.newFlares.push(f);
      g.add(f.mesh);
    }
    this.newLines = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array((NEW_STARS.length - 1) * 6), 3)),
      this.newLineMat,
    );
    this.newLines.frustumCulled = false;
    g.add(this.newLines);

    this.nebula = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 3.4, lifetimeJitter: 0.35,
      shape: 'sphere', shapeSize: 1.2, speed: 5, speedJitter: 0.5, spread: 180, gravity: -0.1, drag: 1.3,
      sizeStart: 2, sizeEnd: 6.5, colorStart: '#2a1c6a', colorMid: '#161046', colorEnd: '#080624',
      opacityStart: 0.55, opacityEnd: 0, additive: false, sizeJitter: 0.5, erosion: 0.55, spin: 0.4,
    });
    this.shards = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 2.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, speed: 16, speedJitter: 0.6, spread: 180, gravity: 7, drag: 0.5,
      sizeStart: 0.22, sizeEnd: 0.04, colorStart: '#ffffff', colorMid: '#9db8ff', colorEnd: '#6a3cff',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.5, erosion: 0, groundFade: 0.3,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 2.4, lifetimeJitter: 0.3,
      shape: 'cone', shapeSize: 5, originY: settings.crownHeight, speed: -3, speedJitter: 0.4, spread: 20, gravity: 6, drag: 0.3,
      sizeStart: 0.14, sizeEnd: 0.03, colorStart: '#f0f4ff', colorMid: '#8aa8ff', colorEnd: '#6a3cff',
      opacityStart: 0.7, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0, groundFade: 0.3,
    });
    this.sparkle = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 4, lifetimeJitter: 0.3,
      shape: 'cone', shapeSize: 8, originY: settings.crownHeight + 3, speed: -0.5, speedJitter: 0.5, spread: 30, gravity: 0.35, drag: 0.4,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#ffffff', colorMid: '#a8b8ff', colorEnd: '#7a5cff',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.5, erosion: 0, groundFade: 0.3,
    });
    this.emitters.push(this.nebula, this.shards, this.dust, this.sparkle);
    for (const e of this.emitters) g.add(e.points);
    this.nebula.points.renderOrder = -0.5;

    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.lineMat.color.set(c);
    this.newLineMat.color.set(c);
    this.dust.settings.originY = this.settings.crownHeight;
    this.sparkle.settings.originY = this.settings.crownHeight + 3;
    this.dust.applyStyle();
    this.sparkle.applyStyle();
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
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
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
    if (!this.impacted && this.time >= T_NOVA) this.onNova();
    this.layout();
  }

  // --- Crown kinematics (pure functions of time, so trails can be sampled in the past) --------------------------------
  private expand = (tt: number) => smoothstep((tt - 1.1) / 1.4);
  private pull = (tt: number) => smoothstep((tt - T_PULL) / (T_COLLAPSE - T_PULL));
  private radius(tt: number) {
    return (1 + (this.settings.crownRadius - 1) * this.expand(tt)) * Math.pow(1 - this.pull(tt), 1.3);
  }
  private spin = (tt: number) => 0.9 * tt + 10 * Math.pow(this.pull(tt), 2);
  private tilt = (tt: number) => 1.45 * smoothstep((tt - 1.8) / 1.2);
  private ignite = (i: number, tt: number) => smoothstep((tt - 0.2 - i * 0.14) / 0.25);

  private centreAt(tt: number, out: THREE.Vector3) {
    const k = smoothstep((tt - 1.0) / 1.6);
    return out.set(0, 3.8 + (this.settings.crownHeight - 3.8) * k + 2 * Math.sin(Math.PI * k), 14 * (1 - k));
  }

  private starPos(i: number, tt: number, out: THREE.Vector3) {
    const R = this.radius(tt), th = this.spin(tt) + (i * TWO_PI) / STARS, ph = this.tilt(tt);
    const lx = R * Math.cos(th), lz = R * Math.sin(th);
    this.centreAt(tt, out);
    out.x += lx * Math.cos(ph); out.y += lx * Math.sin(ph); out.z += lz;
    return out;
  }

  private layout() {
    const s = this.settings;
    const H = s.crownHeight;
    const t = this.time;
    const after = t - T_NOVA;
    const post = this.impacted;
    const fade = 1 - smoothstep((t - (DURATION - 0.9)) / 0.9);
    const pull = this.pull(t);
    const centre = this.centreAt(t, this.centre);

    // --- Caster lifts its head ------------------------------------------------------------------------------------
    const lift = smoothstep(t / 0.9) * (1 - smoothstep((t - 3.6) / 0.8));
    this.caster.group.rotation.x = 0.22 * lift;

    // --- Sky ------------------------------------------------------------------------------------------------------
    const sky = smoothstep((t - 1.5) / 1.3);
    const blackout = smoothstep((t - (T_COLLAPSE + 0.05)) / 0.15) * (1 - smoothstep((t - T_NOVA) / 0.05));
    const skyOut = 1 - smoothstep((t - (DURATION - 1.4)) / 1.3);
    const domeMat = this.dome.material as THREE.MeshBasicMaterial;
    domeMat.color.lerpColors(SKY_INDIGO, SKY_VIOLET, post ? 0.6 * smoothstep(after / 1.0) : 0);
    domeMat.opacity = Math.min(0.95, 0.82 * sky + 0.15 * blackout) * skyOut;
    (this.dim.material as THREE.MeshBasicMaterial).opacity = (0.45 * sky + 0.2 * blackout) * skyOut;
    const twinkle = sky * (1 - blackout) * skyOut;
    (this.skyA.material as THREE.PointsMaterial).opacity = 0.8 * twinkle * (0.55 + 0.35 * Math.sin(t * 2.6));
    (this.skyB.material as THREE.PointsMaterial).opacity = 0.8 * twinkle * (0.55 + 0.35 * Math.sin(t * 2.6 + Math.PI));
    this.skyA.rotation.y = this.skyB.rotation.y = t * 0.01;
    this.afterglow.mesh.position.set(0, H, 0);
    this.afterglow.mesh.scale.setScalar(13);
    this.afterglow.opacity = post ? 0.13 * Math.exp(-after * 0.5) * skyOut : 0;

    // --- Seven stars ----------------------------------------------------------------------------------------------
    const alive = 1 - smoothstep((t - (T_COLLAPSE - 0.15)) / 0.2);
    const grow = 1 + 0.8 * this.expand(t);
    const swallow = 1 - 0.9 * Math.pow(pull, 3);
    for (let i = 0; i < STARS; i++) {
      const p = this.starPos(i, t, this.starPositions[i]);
      const ig = this.ignite(i, t) * alive;
      const size = 0.28 * grow * swallow * (1 + 0.1 * Math.sin(t * 7 + i * 1.7));
      this.cores[i].mesh.position.copy(p);
      this.cores[i].mesh.scale.setScalar(Math.max(0.001, size * ig));
      this.cores[i].opacity = 0.85 * ig;
      setFlare(this.flares[i], p, 2.4 * grow * swallow * ig, 0.7 * ig, t * 0.6 + i);
    }
    this.crownGlow.mesh.position.copy(centre);
    this.crownGlow.mesh.scale.setScalar(1.6 + 3 * this.expand(t));
    this.crownGlow.opacity = 0.12 * smoothstep((t - 0.5) / 0.6) * (1 - this.expand(t)) * alive;

    // Star-dust trails: each star's recent path, sampled from the past.
    const tr = this.trails.geometry.attributes.position as THREE.BufferAttribute;
    const trailOp = alive;
    for (let i = 0; i < STARS; i++) {
      const ig = this.ignite(i, t);
      for (let j = 0; j < TRAIL; j++) {
        const tt = Math.max(0, t - j * TRAIL_DT);
        this.starPos(i, tt, this.tmp);
        const idx = i * TRAIL + j;
        tr.setXYZ(idx, this.tmp.x, this.tmp.y, this.tmp.z);
        const k = Math.pow(1 - j / TRAIL, 1.6) * ig * trailOp * 0.7;
        this.trailColors[idx * 3] = 0.65 * k; this.trailColors[idx * 3 + 1] = 0.78 * k; this.trailColors[idx * 3 + 2] = 1.0 * k;
      }
    }
    tr.needsUpdate = true;
    (this.trails.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    // Constellation lines drawing in between the stars.
    const lp = this.lines.geometry.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j < SEGMENTS.length; j++) {
      const a = this.starPositions[SEGMENTS[j][0]], b = this.starPositions[SEGMENTS[j][1]];
      const d = smoothstep((t - 2.2 - j * 0.05) / 0.4);
      this.tmp.lerpVectors(a, b, d);
      lp.setXYZ(j * 2, a.x, a.y, a.z);
      lp.setXYZ(j * 2 + 1, this.tmp.x, this.tmp.y, this.tmp.z);
    }
    lp.needsUpdate = true;
    this.lineMat.opacity = 0.5 * (1 - 0.7 * pull) * (1 - smoothstep((t - T_COLLAPSE) / 0.2));

    // --- The final star ---------------------------------------------------------------------------------------------
    const born = smoothstep((t - T_FINAL) / 1.2);
    const collapse = smoothstep((t - T_COLLAPSE) / (T_NOVA - T_COLLAPSE));
    const gone = post ? 0 : 1;
    const pulseAmp = 0.04 + 0.1 * smoothstep((t - 3.4) / 0.8);
    const pulse = 1 + pulseAmp * Math.sin(t * (9 + 10 * pull));
    const size = Math.max(0.1, (0.2 + 2.0 * born + 0.7 * pull) * Math.pow(1 - collapse, 2) * pulse) * gone;
    const toBlue = smoothstep((t - 3.0) / 1.0), toViolet = smoothstep((t - 3.9) / 0.7);
    this.tmpC.copy(WHITE).lerp(BLUE, toBlue).lerp(VIOLET, toViolet);
    this.finalHalo.color.copy(this.tmpC);
    this.finalSoft.color.copy(this.tmpC);
    (this.finalFlare.mat.uniforms.uColor.value as THREE.Color).copy(this.tmpC).lerp(WHITE, 0.4);
    this.starLight.color.copy(this.tmpC);
    this.finalCore.color.copy(WHITE).lerp(this.tmpC, 0.35);
    const fv = born * gone;
    this.finalCore.mesh.position.copy(centre);
    this.finalCore.mesh.scale.setScalar(size);
    this.finalCore.opacity = 0.9 * fv;
    this.finalHalo.mesh.position.copy(centre);
    this.finalHalo.mesh.scale.setScalar(size * 1.7);
    this.finalHalo.opacity = 0.45 * fv;
    this.finalSoft.mesh.position.copy(centre);
    this.finalSoft.mesh.scale.setScalar(size * 3.5);
    this.finalSoft.opacity = 0.14 * fv;
    setFlare(this.finalFlare, centre, size * 5, 0.8 * fv, t * 0.3);
    this.starLight.position.copy(centre);
    this.starLight.intensity = 250 * fv * (1 - collapse);

    // --- Supernova --------------------------------------------------------------------------------------------------
    if (post) {
      this.flash.mesh.position.copy(centre);
      this.flash.mesh.scale.setScalar(10 + after * 40);
      this.flash.opacity = 1.0 * Math.exp(-after * 18);
      this.shellBright.mesh.position.copy(centre);
      this.shellBright.mesh.scale.setScalar(1 + after * 24);
      this.shellBright.opacity = 0.6 * Math.exp(-after * 3);
      this.shellColour.mesh.position.copy(centre);
      this.shellColour.mesh.scale.setScalar(1 + after * 12);
      this.shellColour.opacity = 0.4 * Math.exp(-after * 1.6);
      this.equator.mesh.position.set(0, H, 0);
      this.equator.mesh.scale.setScalar(1 + after * 22);
      this.equator.material.opacity = Math.max(0, 0.7 * (1 - after / 1.3));
      this.shake = 1.2 * Math.exp(-after * 6);
      this.groundLight.position.set(ENEMY_POS.x, 3, ENEMY_POS.z);
      this.groundLight.intensity = 600 * Math.exp(-after * 4) + 80 * smoothstep((after - 0.5) / 0.5) * Math.exp(-after * 0.5);
    } else {
      this.flash.opacity = 0;
      this.shellBright.opacity = 0;
      this.shellColour.opacity = 0;
      this.equator.material.opacity = 0;
      this.groundLight.intensity = 0;
      this.shake = 0;
    }

    // Crater of starlight under the enemy once the shards land.
    const crater = post ? smoothstep((after - 0.4) / 0.7) : 0;
    this.crater.mesh.scale.setScalar(Math.max(0.01, 4.5 * crater));
    this.crater.material.opacity = 0.6 * crater * fade;
    this.craterRim.mesh.scale.setScalar(Math.max(0.01, 5.6 * crater));
    this.craterRim.mesh.rotation.z = t * 0.4;
    this.craterRim.material.opacity = 0.4 * crater * fade;
    this.craterPool.mesh.position.set(ENEMY_POS.x, 0.1, ENEMY_POS.z);
    this.craterPool.mesh.scale.set(6, 0.12, 6);
    this.craterPool.opacity = 0.45 * crater * fade;

    // Rain of stardust, then slow falling sparkle.
    this.dust.settings.rate = post && after > 0.05 && after < 1.5 ? 700 * (1 - after / 1.5) : 0;
    this.sparkle.settings.rate = post && after > 0.6 && t < DURATION - 1 ? 60 * Math.exp(-(after - 0.6) * 0.4) : 0;

    // Enemy: lit by the flash, then crushed as the shards land.
    this.enemy.setFlash(post ? 1.2 * Math.exp(-after * 8) : 0);
    this.enemy.setCrush(post ? smoothstep((after - 0.8) / 0.7) : 0);

    // --- Faint new constellation lingering ----------------------------------------------------------------------------
    const nc = post ? smoothstep((after - 0.9) / 0.6) * skyOut : 0;
    const np = this.newLines.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < NEW_STARS.length; i++) {
      this.tmp.set(0, H + 1 + NEW_STARS[i][0], NEW_STARS[i][1]);
      setFlare(this.newFlares[i], this.tmp, 1.3, 0.45 * nc * (0.8 + 0.2 * Math.sin(t * 3 + i * 2)), i);
      if (i < NEW_STARS.length - 1) {
        this.tmp2.set(0, H + 1 + NEW_STARS[i + 1][0], NEW_STARS[i + 1][1]);
        np.setXYZ(i * 2, this.tmp.x, this.tmp.y, this.tmp.z);
        np.setXYZ(i * 2 + 1, this.tmp2.x, this.tmp2.y, this.tmp2.z);
      }
    }
    np.needsUpdate = true;
    this.newLineMat.opacity = 0.25 * nc;
  }

  private onNova() {
    this.impacted = true;
    this.shards.burst(700, this.centreAt(DURATION, this.tmp));
    this.nebula.burst(350, this.centre);
  }
}

export const crownOfTheFinalStarModule: EffectModule = {
  label: 'crown of the final star',
  category: 'original',
  create: () => new CrownOfTheFinalStar(),
  // Supernova at 4.85 s; stardust keeps raining on the crater for a moment after.
  telegraphs: () => [{ shape: { kind: 'circle', x: 0, z: 0, radius: 7 }, start: 2.6, impact: 4.85, until: 5.6 }],
  bloom: { enabled: true, strength: 0.6, radius: 0.55, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const s = (effect as CrownOfTheFinalStar).settings;
    frameArena(camera, controls, new THREE.Vector3(0, s.crownHeight * 0.7, 7), Math.max(14, s.crownHeight * 1.3));
  },
  buildGui(f, effect) {
    const c = effect as CrownOfTheFinalStar;
    const s = c.settings;
    f.add(s, 'loop');
    f.add(s, 'crownHeight', 8, 24, 0.5).name('crown height').onChange(() => c.applyStyle());
    f.add(s, 'crownRadius', 3, 10, 0.1).name('crown radius');
    f.addColor(s, 'color').name('constellation').onChange(() => c.applyStyle());
  },
};
