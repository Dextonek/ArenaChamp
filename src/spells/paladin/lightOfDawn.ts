import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, Enemy, GlowSphere, createCaster, createGround, createHammerGeometry, createRing, frameArena,
  smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Light of Dawn (reworked): the caster raises the weapon, a sun rises behind the allies and a wide sunrise-coloured
 * cone of light sweeps forward across the ground with rays of light. Each ally the wave touches gets a heal pop
 * (glow flash, ring at the feet, rising motes).
 */
export interface LightOfDawnSettings {
  coneRange: number;
  waveSpeed: number;
  color: string;
  loop: boolean;
}

export const defaultLightOfDawn = (): LightOfDawnSettings => ({
  coneRange: 17,
  waveSpeed: 14,
  color: '#ffb866',
  loop: false,
});

const RAISE = 1.2; // weapon raised, then released
const AFTERMATH = 2.4;
const CONE_HALF = THREE.MathUtils.degToRad(50); // 100 degree fan
const RAY_COUNT = 9;

// Allies in a fan in front of the caster: [angle in degrees off straight ahead, distance from the caster].
const FAN: [number, number][] = [[-40, 7], [-20, 8.5], [0, 9.5], [20, 8.5], [40, 7]];

const WAVE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WAVE_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = pow(clamp(r, 0.0, 1.0), 2.2) * smoothstep(1.0, 0.82, r);
    vec3 c = mix(uColor, vec3(1.0, 0.92, 0.7), smoothstep(0.5, 1.0, r));
    gl_FragColor = vec4(c, a * uOpacity);
  }`;

function createWave(color: THREE.ColorRepresentation) {
  const geo = new THREE.CircleGeometry(1, 64, Math.PI / 2 - CONE_HALF, CONE_HALF * 2);
  geo.rotateX(-Math.PI / 2); // onto the ground, fan opening toward -Z
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: WAVE_VERT, fragmentShader: WAVE_FRAG,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = 0.05;
  mesh.visible = false;
  return { mesh, material };
}

export class LightOfDawn implements Effect {
  readonly group = new THREE.Group();
  readonly settings: LightOfDawnSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private hit: boolean[] = FAN.map(() => false);

  private caster = createCaster();
  private allies = FAN.map(([a, r]) => {
    const rad = THREE.MathUtils.degToRad(a);
    const pos = new THREE.Vector3(CASTER_POS.x + r * Math.sin(rad), 0, CASTER_POS.z - r * Math.cos(rad));
    return new Enemy({ color: 0x3a6ea5, horns: false, eyeColor: new THREE.Color(1.5, 1.3, 0.8) }).setHome(pos);
  });
  private weaponMat = new THREE.MeshStandardMaterial({
    color: 0xc9a24e, metalness: 0.7, roughness: 0.35, emissive: 0xffb04a, emissiveIntensity: 0.5,
  });
  private weapon = new THREE.Mesh(createHammerGeometry(), this.weaponMat);
  private handGlow = new GlowSphere(0xffe2a0, { rim: false });
  private sun = new GlowSphere(0xffa860, { rim: false });
  private halo = new GlowSphere(0xff9a5a, { rim: false });
  private waveA = createWave(0xff9a4a);
  private waveB = createWave(0xffc27a);
  private rayMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.6, 1.15, 0.55), transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });
  private rays: THREE.Mesh[] = [];
  private pops = FAN.map(() => new GlowSphere(0xffe0a0));
  private popRings = FAN.map(() => createRing(0xffd27a, 0.85, 1, 64));
  private motes: Emitter;
  private sparks: Emitter;

  constructor(settings: LightOfDawnSettings = defaultLightOfDawn()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.weapon, this.handGlow.mesh, this.sun.mesh, this.halo.mesh);
    this.group.add(this.waveA.mesh, this.waveB.mesh);
    for (const a of this.allies) this.group.add(a.group);
    for (const p of this.pops) this.group.add(p.mesh);
    for (const r of this.popRings) this.group.add(r.mesh);

    // Rays lie on the ground, start at the caster and reach forward (-Z); length is scaled per frame.
    const rayGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
    for (let i = 0; i < RAY_COUNT; i++) {
      const m = new THREE.Mesh(rayGeo, this.rayMat);
      const k = i / (RAY_COUNT - 1) - 0.5;
      m.rotation.y = -k * CONE_HALF * 2 * 0.92;
      m.position.set(CASTER_POS.x, 0.09, CASTER_POS.z - 0.8);
      m.visible = false;
      this.rays.push(m);
      this.group.add(m);
    }

    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 1.8, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 0.8, speed: 1.8, speedJitter: 0.5, spread: 25, gravity: -0.8, drag: 0.6,
      sizeStart: 0.18, sizeEnd: 0, colorStart: '#fff2c4', colorEnd: settings.color,
      opacityStart: 0.45, opacityEnd: 0, additive: true,
      colorMid: '#ffd98a', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 4, speedJitter: 0.6, spread: 180, gravity: 3, drag: 0.8,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ffb02a',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.motes, this.sparks);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    this.waveA.material.uniforms.uColor.value.set(this.settings.color);
    this.motes.settings.colorEnd = this.settings.color;
    this.motes.applyStyle();
  }

  get duration() {
    return RAISE + this.settings.coneRange / this.settings.waveSpeed + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.hit = FAN.map(() => false);
    this.shake = 0;
    this.caster.reset();
    for (const a of this.allies) a.reset();
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  private hitTime(i: number) {
    return RAISE + FAN[i][1] / this.settings.waveSpeed;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    for (let i = 0; i < FAN.length; i++) {
      if (!this.hit[i] && this.time >= this.hitTime(i)) this.onHit(i);
    }
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const age = t - RAISE; // time since release
    const fade = 1 - smoothstep((t - (this.duration - 0.8)) / 0.8);

    // Sunrise behind the allies: rises during the raise, hangs low, fades out.
    const rise = smoothstep(t / (RAISE + 0.6));
    this.sun.mesh.position.set(0, -1.2 + 2.6 * rise, -8);
    this.sun.mesh.scale.setScalar(2.6);
    this.sun.opacity = 0.2 * rise * fade;
    this.halo.mesh.position.set(0, 0.3 + 1.4 * rise, -4);
    // A 14-unit halo filled the whole backdrop with an orange dome; keep it a modest sunrise glow.
    this.halo.mesh.scale.setScalar(4.2);
    this.halo.opacity = 0.035 * rise * fade;

    // Caster raises the weapon, then sweeps it forward on release.
    const raise = smoothstep(t / RAISE);
    const swing = smoothstep(age / 0.2);
    const cp = this.caster.group.position;
    this.weapon.position.set(cp.x + 0.55, 1.1 + 1.3 * raise, cp.z - 0.3);
    this.weapon.rotation.set(-0.9 * swing, 0, -0.25 * (1 - raise));
    this.weapon.scale.setScalar(2.2);
    this.weaponMat.emissiveIntensity = 0.5 + 0.7 * raise + (age > 0 ? 1.2 * Math.exp(-age * 3) : 0);
    this.handGlow.mesh.position.set(
      this.weapon.position.x, this.weapon.position.y + 2.2 * Math.cos(0.9 * swing), this.weapon.position.z - 2.2 * Math.sin(0.9 * swing),
    );
    this.handGlow.mesh.scale.setScalar(0.25 + 0.45 * raise);
    this.handGlow.opacity = (age < 0 ? 0.5 * raise : 0.5 * Math.exp(-age * 3)) * fade;

    // Cone wave: expands from the caster, fading as it goes.
    this.layoutWave(this.waveA, age, s.waveSpeed, s.coneRange, 0.42, fade);
    this.layoutWave(this.waveB, age - 0.15, s.waveSpeed * 0.9, s.coneRange * 0.85, 0.28, fade);

    // Rays of light sweep forward.
    const grow = smoothstep(age / 0.9);
    const rayFade = age < 0 ? 0 : (1 - smoothstep((age - 0.6) / 1.1)) * fade;
    this.rayMat.opacity = 0.14 * rayFade;
    this.rays.forEach((r, i) => {
      const len = s.coneRange * (0.75 + 0.25 * ((i * 7) % 5) / 4) * grow;
      r.scale.set(0.3 + 0.25 * ((i * 3) % 4) / 3, 1, Math.max(0.001, len));
      r.visible = this.rayMat.opacity > 0.002;
    });

    // Allies: dim until touched, then healed, with a pop at their feet.
    for (let i = 0; i < FAN.length; i++) {
      const a = age - (this.hitTime(i) - RAISE);
      const ally = this.allies[i];
      const healed = a > 0 ? smoothstep(a / 0.4) : 0;
      ally.material.color.setHex(0x1c3552).lerp(new THREE.Color(0x5a96d6), healed);
      ally.group.scale.set(1, 0.92 + 0.08 * healed, 1);
      ally.group.position.y = a > 0 ? 0.25 * Math.sin(Math.min(a, 0.5) / 0.5 * Math.PI) : 0;
      ally.setFlash(a > 0 ? 0.5 * Math.exp(-a * 5) : 0);
      const home = ally.group.position;
      const pop = this.pops[i];
      pop.mesh.position.set(home.x, 1.2, home.z);
      pop.mesh.scale.setScalar(0.6 + Math.max(0, a) * 5);
      pop.opacity = a > 0 ? 0.55 * Math.exp(-a * 5) * fade : 0;
      const ring = this.popRings[i];
      ring.mesh.position.set(home.x, 0.06, home.z);
      ring.mesh.scale.setScalar(0.6 + Math.max(0, a) * 6);
      ring.material.opacity = a > 0 ? Math.max(0, 0.6 * (1 - a / 0.7)) * fade : 0;
    }
  }

  private layoutWave(w: ReturnType<typeof createWave>, age: number, speed: number, range: number, peak: number, fade: number) {
    const radius = Math.min(range, Math.max(0, age) * speed);
    w.mesh.position.set(CASTER_POS.x, 0.05, CASTER_POS.z);
    w.mesh.scale.setScalar(Math.max(0.001, radius));
    const op = age < 0 ? 0 : peak * (1 - smoothstep((age * speed - range * 0.6) / (range * 0.8)));
    w.material.uniforms.uOpacity.value = op * fade;
    w.mesh.visible = op * fade > 0.002;
  }

  private onHit(i: number) {
    this.hit[i] = true;
    const p = this.allies[i].group.position;
    this.motes.burst(120, new THREE.Vector3(p.x, 0.2, p.z));
    this.sparks.burst(50, new THREE.Vector3(p.x, 1.2, p.z));
    this.shake = 0.1;
  }
}

export const lightOfDawnModule: EffectModule = {
  label: 'light of dawn',
  category: 'paladin',
  create: () => new LightOfDawn(),
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    // Caster at z = 14, allies around z = 5..7, wave reaching toward z = -3.
    frameArena(camera, controls, new THREE.Vector3(0, 2, 6), 12);
  },
  buildGui(f, effect) {
    const l = effect as LightOfDawn;
    const s = l.settings;
    f.add(s, 'loop');
    f.add(s, 'coneRange', 8, 30, 0.5).name('cone range');
    f.add(s, 'waveSpeed', 6, 30, 0.5).name('wave speed');
    f.addColor(s, 'color').onChange(() => l.applyStyle());
  },
};
