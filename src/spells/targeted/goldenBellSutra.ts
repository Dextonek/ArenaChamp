import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, LightPillar, createRing, smoothstep } from '../../effects/common';
import { ShockRefraction, StarBurst, clearScreenFx, createScreenFx, impactFrameAt } from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Golden Bell Sutra (targeted, `self` mode): a thin gold pillar of light calls a giant translucent temple bell
 * (dark bronze body, bright thin fresnel rim, gold bands and studs) out of the sky. It lands over the caster,
 * hangs still while sutra glyphs scroll round its waist, then is struck: it wobbles, impact frames flash, and
 * rings of sutra script blast outward and knock back everything in range. Echoes fade, gold leaf showers down,
 * and the bell rises up the pillar, drops its body to a bare outline and breaks into drifting motes.
 *
 * Palette row: Solar / holy (docs/ART_BIBLE.md). Recipes: c-ue4-energy-shield-dome (fresnel shell + floor line),
 * f-beyondfx-sunrise-pillar-strike (pillar + hang), e-seo-wind-bullet (rings pushed out from the caster).
 */
export interface GoldenBellSutraSettings {
  damage: number;
  knock: number;
  loop: boolean;
}

export const defaultGoldenBellSutra = (): GoldenBellSutraSettings => ({ damage: 50, knock: 9, loop: false });

const DURATION = 4.4;
const CALL_END = 0.5; // bell starts to appear
const LAND = 1.25;
const STRIKE = 1.7; // D
const LIFT = 2.6;
const BELL_H = 3.7;
const MOUTH_R = 1.6;
const RADIUS = 6;
const FOCAL = new THREE.Vector3(1.34, 1.2, 0); // strike spot on the bell's +X side (the camera side)
const FLAKES = 44;
const S = 1.45; // bell scale: ~5.4 m tall, ~4.6 m mouth
const RING_W = 0.6; // sound-wave band width in metres

// Sound-wave rings: offset after the strike, strength, final radius.
const WAVES = [
  { off: 0, k: 1, r: 7.2, dur: 0.45 },
  { off: 0.12, k: 0.9, r: 7.2, dur: 0.45 },
  { off: 0.24, k: 0.8, r: 7.2, dur: 0.45 },
  { off: 0.35, k: 0.4, r: 5.4, dur: 0.6 },
  { off: 0.7, k: 0.26, r: 4.4, dur: 0.6 },
];

const tmpC = new THREE.Vector3();
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

/** Short bars and dots in rows: sutra-looking script that is not real text. White on transparent. */
function glyphTexture(): THREE.CanvasTexture {
  const w = 512, h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.fillStyle = '#fff';
  for (let row = 0; row < 3; row++) {
    const y = 14 + row * 26;
    let x = 4;
    while (x < w - 10) {
      const kind = rnd();
      if (kind < 0.55) { const bw = 5 + rnd() * 16; g.fillRect(x, y, bw, 7); x += bw + 5; }
      else if (kind < 0.8) { g.fillRect(x, y - 3, 4, 13); g.fillRect(x + 7, y, 10, 4); x += 22; }
      else { g.beginPath(); g.arc(x + 4, y + 4, 3.5, 0, Math.PI * 2); g.fill(); x += 14; }
      if (rnd() < 0.12) x += 14;
    }
  }
  // Soft top and bottom so the band has no hard edge.
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createLinearGradient(0, 0, 0, h);
  mask.addColorStop(0, 'rgba(0,0,0,0)');
  mask.addColorStop(0.3, 'rgba(0,0,0,1)');
  mask.addColorStop(0.7, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Rewrites a unit RingGeometry (1 phi segment) in place to the band between radii rIn and rOut. */
function setBand(geo: THREE.BufferGeometry, rIn: number, rOut: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const n = pos.count / 2;
  for (let i = 0; i < pos.count; i++) {
    const rad = i < n ? rIn : rOut;
    const th = ((i % n) / (n - 1)) * Math.PI * 2;
    pos.setXY(i, rad * Math.cos(th), rad * Math.sin(th));
  }
  pos.needsUpdate = true;
  geo.boundingSphere = null;
}

/** Classic temple bell (zhong): flat shoulders, slight belly, flared mouth. Profile is (radius, height). */
function bellGeometry(): THREE.BufferGeometry {
  const pts = [
    [MOUTH_R, 0], [1.56, 0.12], [1.46, 0.4], [1.36, 0.9], [1.3, 1.5], [1.22, 2.3], [1.08, 3.0],
    [0.86, 3.4], [0.55, 3.62], [0.3, 3.7], [0, 3.7],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 56);
}

const BELL_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

/** Dark bronze, mostly see-through, a little denser toward the silhouette so the shape holds. Normal blend. */
function bodyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(0x3a2a10) }, uBody: { value: 0 } },
    vertexShader: BELL_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uBody;
      varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
      void main() {
        float facing = abs(dot(vN, vView));
        float shade = mix(0.55, 1.0, smoothstep(0.0, 3.7, vLocal.y));
        gl_FragColor = vec4(uColor * shade, uBody * (0.55 + 0.25 * pow(1.0 - facing, 1.5)));
      }`,
  });
}

/** Additive thin bright rim + mouth edge + the glowing strike spot, with a noise dissolve for the exit. */
function rimMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0xffe39a) }, uOpacity: { value: 0 }, uDissolve: { value: 0 },
      uFocal: { value: 0 }, uFocalPos: { value: FOCAL.clone() },
    },
    vertexShader: BELL_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; uniform float uDissolve; uniform float uFocal; uniform vec3 uFocalPos;
      varying vec3 vN; varying vec3 vView; varying vec3 vLocal;
      void main() {
        float facing = abs(dot(vN, vView));
        float rim = pow(1.0 - facing, 3.2);
        float mouth = 1.0 - smoothstep(0.0, 0.1, vLocal.y);
        float focal = (1.0 - smoothstep(0.0, 0.42, distance(vLocal, uFocalPos))) * uFocal;
        float a = rim * 0.9 + mouth * 0.5 + focal * 0.8;
        float n = fract(sin(dot(floor(vLocal * 9.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float th = uDissolve * 1.5 - (1.0 - vLocal.y / 3.7) * 0.5;
        if (n < th) discard;
        a += (1.0 - smoothstep(0.0, 0.1, n - th)) * uDissolve * 0.8;
        gl_FragColor = vec4(uColor, a * uOpacity);
      }`,
  });
}

export class GoldenBellSutra implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GoldenBellSutraSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private landed = false;
  private struck = false;
  private from = new THREE.Vector3();

  private bell = new THREE.Group();
  private bodyMat = bodyMaterial();
  private rimMat = rimMaterial();
  private bandMat = new THREE.MeshBasicMaterial({ color: 0xc9a24a, transparent: true, opacity: 0, depthWrite: false });
  private studMat = new THREE.MeshBasicMaterial({ color: 0xd2ae55, transparent: true, opacity: 0, depthWrite: false });
  private glyphTex = glyphTexture();
  private wallTex = glyphTexture();
  private glyphMat = new THREE.MeshBasicMaterial({
    map: this.glyphTex, color: 0xffe39a, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  private focalGlow = new GlowSphere(0xffe39a, { rim: false });
  private pillar = new LightPillar(0xffe39a, 0.5);
  private glint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffe39a, core: 0xfffbe8, additive: false });
  private strikeStar = new StarBurst({ points: 9, color: 0x6fe0ff, core: 0xfffbe8, additive: false });

  private groundRing = createRing(0xf2b53c, 0.9, 1, 96);
  private groundRune = createRing(0xffe39a, 0.97, 1, 6);
  private mouthLine = createRing(0xffe39a, 0.955, 1, 96);
  private refract = new ShockRefraction({ facing: 'camera' });
  private waveRing = WAVES.map(() => createRing(0xffe39a, 0.74, 1, 96));
  private waveDark = WAVES.map(() => createRing(0x2a1a06, 0.7, 1, 96));
  private waveWall: THREE.Mesh[] = [];
  private waveWallMat: THREE.MeshBasicMaterial[] = [];

  private leafGold = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.22, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xe0b455, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    FLAKES,
  );
  private leafDark = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.3, 0.4).translate(0, 0, -0.01),
    new THREE.MeshBasicMaterial({ color: 0x2a1a06, side: THREE.DoubleSide }),
    FLAKES,
  );
  private flake = Array.from({ length: FLAKES }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = 1.1 + Math.random() * 0.4;
    return {
      birth: STRIKE + Math.random() * 0.6, a, r, y0: 0.8 + Math.random() * 2.4,
      out: 0.4 + Math.random() * 1.2, w: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      drift: Math.random() * Math.PI * 2, size: 0.7 + Math.random() * 0.7,
    };
  });

  private motes: Emitter; // gold dust falling through the pillar, and later the bell breaking up
  private sparks: Emitter;
  private dust: Emitter;

  constructor(settings: GoldenBellSutraSettings = defaultGoldenBellSutra()) {
    this.settings = settings;
    this.screen.tint.set(0x2a1a06);
    this.screen.impactColor.set(0xf2b53c);

    // --- Bell: translucent dark body, additive rim shell a hair bigger, bands, studs, loop knob, glyph band. ---
    const geo = bellGeometry();
    const body = new THREE.Mesh(geo, this.bodyMat);
    const rim = new THREE.Mesh(geo, this.rimMat);
    rim.scale.set(1.012, 1.004, 1.012);
    body.renderOrder = 1;
    rim.renderOrder = 3;
    this.bell.add(body, rim);
    const band = (y: number, r: number, tube: number) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 64), this.bandMat);
      m.rotation.x = Math.PI / 2;
      m.position.y = y;
      m.renderOrder = 2;
      this.bell.add(m);
    };
    band(0.3, 1.5, 0.05);
    band(2.78, 1.05, 0.045);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), this.studMat);
      s.position.set(Math.cos(a) * 1.0, 2.52, Math.sin(a) * 1.0);
      s.renderOrder = 2;
      this.bell.add(s);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.3, 12), this.studMat);
    stem.position.y = 3.82;
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 28), this.bandMat);
    loop.position.y = 4.1;
    stem.renderOrder = loop.renderOrder = 2;
    this.bell.add(stem, loop);
    this.glyphTex.repeat.set(2.5, 1);
    const glyphBand = new THREE.Mesh(new THREE.CylinderGeometry(1.27, 1.34, 1.3, 64, 1, true), this.glyphMat);
    glyphBand.position.y = 1.7;
    glyphBand.renderOrder = 4;
    this.bell.add(glyphBand);
    this.focalGlow.mesh.position.copy(FOCAL).multiplyScalar(1.03);
    this.focalGlow.mesh.scale.setScalar(0.32);
    this.bell.add(this.focalGlow.mesh);
    this.bell.visible = false;

    // --- Sound waves: a dark ring under a gold ring, plus a short glyph wall riding the front. ---
    this.wallTex.repeat.set(18, 1);
    WAVES.forEach((_, i) => {
      this.waveDark[i].material.blending = THREE.NormalBlending;
      this.waveDark[i].mesh.position.y = 0.03;
      const mat = new THREE.MeshBasicMaterial({
        map: this.wallTex, color: 0xffe39a, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 72, 1, true), mat);
      wall.visible = false;
      this.waveWall.push(wall);
      this.waveWallMat.push(mat);
      this.group.add(this.waveDark[i].mesh, this.waveRing[i].mesh, wall);
    });

    this.leafDark.frustumCulled = false;
    this.leafGold.frustumCulled = false;
    this.leafDark.renderOrder = 5;
    this.leafGold.renderOrder = 6;

    this.group.add(this.bell, this.pillar.mesh, this.glint.mesh, this.strikeStar.mesh, this.refract.mesh);
    this.group.add(this.groundRing.mesh, this.groundRune.mesh, this.mouthLine.mesh, this.leafDark, this.leafGold);

    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 1400, rate: 0, lifetime: 1.4, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.12, speed: 0.3, speedJitter: 0.6, spread: 180, gravity: 0.5, drag: 0.8,
      sizeStart: 0.11, sizeEnd: 0.03, colorStart: '#fffbe8', colorEnd: '#f2b53c', colorMid: '#ffe39a',
      opacityStart: 0.6, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 9, speedJitter: 0.6, spread: 100, gravity: 8, drag: 1.2,
      sizeStart: 0.12, sizeEnd: 0.02, colorStart: '#fffbe8', colorEnd: '#f2b53c',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    // Dark normal-blended dust so the gold has something to read against.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 2.0, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 2.6, speedJitter: 0.6, spread: 80, gravity: -0.2, drag: 1.4,
      sizeStart: 0.8, sizeEnd: 1.9, colorStart: '#8a6a30', colorEnd: '#2a1a06', colorMid: '#4a3414',
      opacityStart: 0.4, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.4, groundFade: 0.3,
    });
    this.emitters.push(this.motes, this.sparks, this.dust);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return STRIKE;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.from).setY(1.5);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.landed = false;
    this.struck = false;
    this.shake = 0;
    clearScreenFx(this.screen);
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
    if (!this.landed && this.time >= LAND) this.onLand();
    if (!this.struck && this.time >= STRIKE) this.onStrike();
    this.layout(dt);
  }

  /** Bell base height above the ground: waits up high, slow ease-out descent, a hang, a fast last drop. */
  private bellY(t: number) {
    if (t < CALL_END) return 10;
    if (t < 1.1) return 10 - 9.5 * easeOut((t - CALL_END) / 0.6);
    if (t < LAND) { const v = (t - 1.1) / (LAND - 1.1); return 0.5 * (1 - v * v); }
    if (t < LIFT) return 0;
    const u = clamp01((t - LIFT) / 1.1);
    return 14 * u * u;
  }

  private layout(dt: number) {
    const t = this.time;
    const aw = t - STRIKE;
    const f = this.from;
    const live = dt > 0 && this.playing;

    // 1. World darkens for the call, stays low through the hold, eases off over the lift.
    const dark = 0.6 * smoothstep(t / 0.5);
    this.screen.darken = t < STRIKE ? dark : dark * (0.5 + 0.5 * Math.exp(-aw * 2)) * (1 - smoothstep((t - 3.0) / 0.8));
    this.screen.impact = impactFrameAt(t, STRIKE, [1, 2]);
    this.screen.speedLines = 0;

    // 2. Pillar of light from the call until the bell is gone; falling gold dust through it.
    // It ends at the bell's top once it lands, so it never lights the bell from inside.
    const pil = 0.32 * smoothstep(t / 0.5) * (1 - smoothstep((t - LAND) / 0.3));
    this.pillar.set(f.x, f.z, 0, 24, pil);
    if (live && t < LAND) {
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.7;
        this.motes.burst(1, new THREE.Vector3(f.x + Math.cos(a) * r, 8 + Math.random() * 3, f.z + Math.sin(a) * r));
      }
    }

    // 3. Cold glint where the bell will appear, 10 m up: a small crisp star, gone as the bell arrives.
    const gl = StarBurst.pop(t - 0.12, 0.22, 0.2);
    this.glint.set(new THREE.Vector3(f.x, 10 + 1.8, f.z), 1.1 * gl.scale, gl.opacity, t * 1.5);

    // 4. The bell: position, slow turn, wobble, material state.
    const y = this.bellY(t);
    const show = t >= CALL_END && !(t > 3.9);
    this.bell.visible = show;
    this.bell.position.set(f.x, y, f.z);
    this.bell.rotation.y = t < LAND ? 0.9 * (1 - easeOut((t - CALL_END) / 0.75)) : 0;
    const lift = 1 - smoothstep((t - LIFT) / 0.3);
    let wob = aw > 0 ? 0.06 * Math.exp(-aw * 2.4) * Math.sin(Math.PI * 10 * aw) : 0;
    for (const e of [0.35, 0.7]) {
      const ae = aw - e;
      if (ae > 0) wob += 0.014 * Math.exp(-ae * 5) * Math.sin(Math.PI * 10 * ae);
    }
    this.bell.scale.setScalar(S * (1 + wob * lift));

    const appear = smoothstep((t - CALL_END) / 0.25);
    const bodyOn = t < LIFT ? appear : 1 - smoothstep((t - LIFT) / 0.5); // body drops out first: outline stays
    const dim = t > 1.62 && t < STRIKE ? 0.7 : 1; // dead beat before the strike
    this.bodyMat.uniforms.uBody.value = bodyOn;
    this.bandMat.opacity = 0.9 * bodyOn;
    this.studMat.opacity = 0.9 * bodyOn;
    this.rimMat.uniforms.uOpacity.value = appear * dim * 0.9;
    this.rimMat.uniforms.uDissolve.value = smoothstep((t - 3.05) / 0.75);
    this.glyphTex.offset.x = (t < 1.62 ? t : 1.62) * 0.07;
    this.glyphMat.opacity = 0.85 * smoothstep((t - LAND) / 0.35) * (1 - smoothstep((t - LIFT) / 0.3)) * (1 + 0.5 * Math.exp(-Math.max(0, aw) * 5) * (aw > 0 ? 1 : 0));
    // Strike spot: slow pulse while held, bright flash at the strike, then settles and fades with the lift.
    const pulse = 0.45 + 0.15 * Math.sin(t * 5);
    const focal = (t < STRIKE ? pulse * smoothstep((t - LAND) / 0.3) : 0.25 + 1.0 * Math.exp(-aw * 6)) * (1 - smoothstep((t - LIFT) / 0.4));
    this.rimMat.uniforms.uFocal.value = focal;
    this.focalGlow.opacity = (t >= CALL_END ? 0.45 * focal : 0) * bodyOn;

    // Cyan star on the strike spot for two frames, then a shrink.
    const pop = StarBurst.pop(aw, 0.04, 0.12);
    this.strikeStar.set(new THREE.Vector3(f.x + FOCAL.x * 1.05 * S, y + FOCAL.y * S, f.z), 1.5 * pop.scale, pop.opacity, 0.2);

    // 5. Ground: gold ring and rune, with the bright line where the bell cuts the floor.
    const landed = t >= LAND;
    const gr = landed ? smoothstep((t - LAND) / 0.3) * (1 - smoothstep((t - 3.6) / 0.6)) : 0;
    this.groundRing.mesh.position.set(f.x, 0.05, f.z);
    this.groundRing.mesh.scale.setScalar(3.6);
    this.groundRing.material.opacity = 0.32 * gr;
    this.groundRune.mesh.position.set(f.x, 0.055, f.z);
    this.groundRune.mesh.scale.setScalar(3.6);
    this.groundRune.mesh.rotation.z = t * 0.35;
    this.groundRune.material.opacity = 0.35 * gr;
    const cut = landed ? (1 - smoothstep((y - 0.05) / 0.5)) * dim : 0;
    this.mouthLine.mesh.position.set(f.x, 0.07, f.z);
    this.mouthLine.mesh.scale.setScalar(MOUTH_R * S * (1 + wob * lift));
    this.mouthLine.material.opacity = 0.75 * cut * (1 - smoothstep((t - 3.0) / 0.4));

    // 6. Sound-wave rings with glyph walls, then echoes.
    WAVES.forEach((w, i) => {
      const a = aw - w.off;
      const p = clamp01(a / w.dur);
      const on = a > 0 && p < 1;
      const r0 = MOUTH_R * S;
      const r = r0 + (w.r - r0) * (1 - Math.pow(1 - p, 1.6)); // outer edge of the band
      const op = w.k * (1 - p * p);
      const ring = this.waveRing[i], dark = this.waveDark[i], wall = this.waveWall[i];
      if (on) {
        setBand(ring.mesh.geometry, Math.max(0.1, r - RING_W), r);
        setBand(dark.mesh.geometry, Math.max(0.1, r - RING_W * 1.5), r + RING_W * 0.25);
      }
      ring.mesh.position.set(f.x, 0.06 + i * 0.002, f.z);
      ring.material.color.setHex(0xf2b53c).lerp(new THREE.Color(0x8a5a14), p);
      ring.material.opacity = on ? 0.6 * op : 0;
      dark.mesh.position.set(f.x, 0.03, f.z);
      dark.material.opacity = on ? 0.6 * op : 0;
      wall.visible = on && op > 0.02;
      wall.position.set(f.x, 0.6, f.z);
      wall.scale.set(Math.max(r - RING_W * 0.5, 1e-3), 1.2, Math.max(r - RING_W * 0.5, 1e-3));
      wall.rotation.y = -a * 2.2 + i;
      this.waveWallMat[i].opacity = 0.75 * op * smoothstep(a / 0.05);
    });

    // Screen distortion riding the first sound ring (same radius curve), gone by 0.5 s.
    const w0 = WAVES[0];
    const rp0 = clamp01(aw / w0.dur);
    const dp = clamp01(aw / 0.5);
    this.refract.set(
      tmpC.set(f.x, 0.6, f.z), MOUTH_R * S + (w0.r - MOUTH_R * S) * (1 - Math.pow(1 - rp0, 1.6)),
      aw > 0 && dp < 1 ? 0.04 * (1 - dp) * (1 - dp) : 0,
    );

    // 7. Gold leaf: flakes shed from the bell, flutter down, settle, and shrink away. Deterministic in t.
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    for (let i = 0; i < FLAKES; i++) {
      const fl = this.flake[i];
      const tau = t - fl.birth;
      const life = 1.6;
      let s = 1e-4;
      if (tau > 0 && tau < life) {
        const out = fl.out * tau / (1 + tau);
        const y0 = fl.y0 * S;
        const fall = Math.min(y0, 0.5 * 2.6 * tau * tau);
        pos.set(
          f.x + Math.cos(fl.a) * (fl.r * S + out) + Math.sin(tau * 3 + fl.drift) * 0.12,
          Math.max(0.05, y0 - fall),
          f.z + Math.sin(fl.a) * (fl.r * S + out) + Math.cos(tau * 3 + fl.drift) * 0.12,
        );
        const resting = y0 - fall <= 0.05;
        const spin = resting ? 0 : tau;
        e.set(fl.w.x * spin * 0.5 + (resting ? 1.4 : 0), fl.w.y * spin * 0.5, fl.w.z * spin * 0.5);
        s = Math.max(1e-4, fl.size * (1 - smoothstep((tau - (life - 0.4)) / 0.4)));
      } else {
        pos.set(0, -50, 0);
        e.set(0, 0, 0);
      }
      q.setFromEuler(e);
      sc.setScalar(s);
      m.compose(pos, q, sc);
      this.leafGold.setMatrixAt(i, m);
      this.leafDark.setMatrixAt(i, m);
    }
    this.leafGold.instanceMatrix.needsUpdate = true;
    this.leafDark.instanceMatrix.needsUpdate = true;

    // 8. The bell breaks into motes as it rises: bursts along its outline while the dissolve runs.
    if (live && t > 3.05 && t < 3.85) {
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const h = Math.random() * BELL_H;
        const hw = h * S;
        const r = h < 0.3 ? MOUTH_R : 1.5 - 0.35 * (h / BELL_H) - (h > 3 ? (h - 3) * 1.1 : 0);
        this.motes.burst(2, new THREE.Vector3(f.x + Math.cos(a) * r * S, y + hw, f.z + Math.sin(a) * r * S));
      }
    }

    // 9. Camera shake: landing thud, the strike, small echo bumps.
    const sl = t > LAND ? 0.3 * Math.exp(-(t - LAND) * 8) : 0;
    const ss = aw > 0 ? 0.8 * Math.exp(-aw * 6) : 0;
    const se = Math.max(0, 0.15 * Math.exp(-(aw - 0.35) * 8) * (aw > 0.35 ? 1 : 0), 0.1 * Math.exp(-(aw - 0.7) * 8) * (aw > 0.7 ? 1 : 0));
    this.shake = Math.max(sl, ss, se);
  }

  private onLand() {
    this.landed = true;
    const f = this.from;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.dust.burst(14, new THREE.Vector3(f.x + Math.cos(a) * 2.6, 0.1, f.z + Math.sin(a) * 2.6));
    }
    this.sparks.burst(60, new THREE.Vector3(f.x, 0.2, f.z));
  }

  private onStrike() {
    this.struck = true;
    const f = this.from;
    this.sparks.burst(260, new THREE.Vector3(f.x, 1.2, f.z));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.dust.burst(10, new THREE.Vector3(f.x + Math.cos(a) * 3.0, 0.1, f.z + Math.sin(a) * 3.0));
    }
    const ctx = this.ctx;
    if (ctx) {
      ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.damage, knock: this.settings.knock, from: ctx.from.clone().setY(0) }));
    }
  }
}

export const goldenBellSutraModule: EffectModule = {
  label: 'golden bell sutra',
  category: 'targeted',
  targeting: { mode: 'self', radius: RADIUS },
  create: () => new GoldenBellSutra(),
  telegraphs(effect) {
    const e = effect as GoldenBellSutra;
    const c = e.ctx?.from;
    if (!c) return [];
    return [{ shape: { kind: 'circle' as const, x: c.x, z: c.z, radius: RADIUS }, start: CALL_END, impact: STRIKE }];
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.84 },
  frameCamera(camera, controls, effect) {
    const e = effect as GoldenBellSutra;
    if (e.ctx) frameCast(camera, controls, e.ctx, 14);
  },
  buildGui(f, effect) {
    const s = (effect as GoldenBellSutra).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
    f.add(s, 'knock', 0, 20, 0.5);
  },
};
