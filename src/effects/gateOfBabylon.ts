import * as THREE from 'three';
import { Emitter, defaultSettings } from '../emitter';
import { Enemy, GlowSphere, createGround, createSpearGeometry, createSwordGeometry, smoothstep } from './common';
import type { Effect, EffectModule } from './types';

/**
 * "Gate of Babylon": a wall of golden ripple portals opens in the sky behind the caster and fires
 * volleys of swords and spears at the enemy. Weapons stick into the ground; the barrage ends with
 * every portal firing at once.
 */
export interface GateSettings {
  portalCount: number;
  weaponCount: number; // total weapons, including the final volley
  openTime: number; // seconds for all portals to open
  barrageTime: number; // seconds of staggered fire before the final volley
  wallDistance: number; // how far behind the enemy... in front of it, toward the caster
  wallWidth: number;
  wallHeightMin: number;
  wallHeightMax: number;
  portalSize: number;
  weaponScale: number; // weapon length in world units
  weaponSpeed: number;
  aimSpread: number; // radius of the impact area around the enemy
  finalVolley: boolean;
  portalColor: string;
  loop: boolean;
}

export const defaultGate = (): GateSettings => ({
  portalCount: 36,
  weaponCount: 260,
  openTime: 1.2,
  barrageTime: 3.5,
  wallDistance: 30,
  wallWidth: 34,
  wallHeightMin: 6,
  wallHeightMax: 22,
  portalSize: 2.4,
  weaponScale: 2.6,
  weaponSpeed: 75,
  aimSpread: 6,
  finalVolley: true,
  portalColor: '#ffc94a',
  loop: false,
});

const EMERGE = 0.35; // seconds a weapon slides out of its portal before launching
const AFTERMATH = 3.5;
const FADE = 1;
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const ENEMY_POS = new THREE.Vector3(0, 1.1, 0);

const portalVertex = /* glsl */ `
  attribute float aOpen;
  attribute float aSeed;
  varying vec2 vUv;
  varying float vOpen;
  varying float vSeed;
  void main() {
    vUv = uv;
    vOpen = aOpen;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const portalFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vOpen;
  varying float vSeed;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float open = vOpen;
    if (open <= 0.001 || r > open) discard;
    float rn = r / max(open, 0.001);
    // Water-like ripples flowing outward, plus a bright rim and a rotating rune band.
    float ripple = 0.5 + 0.5 * sin(rn * 28.0 - uTime * 7.0 + vSeed * 6.28);
    float rim = smoothstep(0.82, 0.97, rn) * (1.0 - smoothstep(0.97, 1.0, rn));
    float ang = atan(p.y, p.x);
    float runes = step(0.55, fract(ang * 3.8197 + uTime * 0.6 + vSeed)) * smoothstep(0.68, 0.72, rn) * (1.0 - smoothstep(0.78, 0.8, rn));
    float core = 1.0 - rn;
    float intensity = 0.18 + 0.35 * ripple * core + 1.2 * rim + 0.5 * runes;
    float alpha = (0.35 + 0.65 * rim + 0.4 * runes) * smoothstep(1.0, 0.9, rn) * clamp(open * 1.5, 0.0, 1.0);
    gl_FragColor = vec4(uColor * intensity, alpha);
  }
`;

interface Weapon {
  portal: number;
  fireTime: number;
  type: 0 | 1; // 0 = sword, 1 = spear
  slot: number; // instance index within its type's mesh
  target: THREE.Vector3;
  launch: THREE.Vector3; // tip position when it leaves the portal
  dir: THREE.Vector3;
  impactTime: number;
  impacted: boolean;
  spin: number;
}

export class GateOfBabylon implements Effect {
  readonly group = new THREE.Group();
  readonly settings: GateSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private endTime = 0; // when the last weapon lands
  private killed = false;

  private portals!: THREE.InstancedMesh;
  private portalOpen!: THREE.InstancedBufferAttribute;
  private portalMat: THREE.ShaderMaterial;
  private portalPos: THREE.Vector3[] = [];
  private portalDelay: number[] = [];
  private portalSizes: number[] = [];
  private glints: GlowSphere[] = []; // short anticipation flash at each portal centre as it opens

  private weaponMat = new THREE.MeshStandardMaterial({
    // Matte-ish metal: hundreds of mirror-like blades piled together reflect the environment into a white blob.
    color: 0xffffff, metalness: 0.9, roughness: 0.35, envMapIntensity: 0.6,
    emissive: 0xffb84a, emissiveIntensity: 0.1,
  });
  private swordGeo = createSwordGeometry();
  private spearGeo = createSpearGeometry();
  private swords!: THREE.InstancedMesh;
  private spears!: THREE.InstancedMesh;
  private streaks!: THREE.InstancedMesh;
  private streakMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.6, 1.2, 0.5), transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private streakGeo = new THREE.CylinderGeometry(0.06, 0.005, 1, 6, 1, true).translate(0, 0.5, 0);
  private weapons: Weapon[] = [];

  private enemy = new Enemy();
  private enemyFlash = 0;
  private wallLight = new THREE.PointLight(0xffc56a, 0, 45, 2);
  private sparks: Emitter;
  private dust: Emitter;
  private haze: Emitter;

  private dummy = new THREE.Object3D();
  private v1 = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(settings: GateSettings = defaultGate()) {
    this.settings = settings;
    this.portalMat = new THREE.ShaderMaterial({
      vertexShader: portalVertex,
      fragmentShader: portalFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(settings.portalColor) } },
    });

    this.group.add(createGround());
    this.group.add(this.enemy.group);
    this.wallLight.position.set(0, 14, -settings.wallDistance + 4);
    this.group.add(this.wallLight);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 5000, rate: 0, lifetime: 0.7, lifetimeJitter: 0.5,
      shape: 'point', shapeSize: 0, speed: 7, speedJitter: 0.6, spread: 75, gravity: 16, drag: 0.8,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ff9a2a',
      opacityStart: 0.55, opacityEnd: 0, additive: true,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 2.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 2.2, speedJitter: 0.5, spread: 70, gravity: -0.2, drag: 1.6,
      sizeStart: 0.9, sizeEnd: 3, colorStart: '#6a645a', colorMid: '#4a4640', colorEnd: '#2a2a30',
      opacityStart: 0.2, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 0.4, groundFade: 0.3,
    });
    // Subtle dark haze hanging around the enemy during the barrage, for depth behind the bright weapons.
    this.haze = new Emitter({
      ...defaultSettings(), maxParticles: 300, rate: 0, lifetime: 3, lifetimeJitter: 0.3,
      shape: 'sphere', shapeSize: 4, originY: 1.5, speed: 0.5, speedJitter: 0.5, spread: 180, gravity: 0, drag: 1,
      sizeStart: 3, sizeEnd: 5, colorStart: '#4a4640', colorMid: '#38363a', colorEnd: '#24242a',
      opacityStart: 0.1, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 0.3, groundFade: 0.3,
    });
    this.emitters.push(this.sparks, this.dust, this.haze);
    for (const e of this.emitters) this.group.add(e.points);

    this.build();
  }

  /** (Re)creates portals and weapons from the settings and schedules the barrage. */
  build() {
    const s = this.settings;
    for (const m of [this.portals, this.swords, this.spears, this.streaks]) {
      if (m) { this.group.remove(m); m.dispose(); }
    }

    // Portals on a gently curved wall facing the enemy, stratified so they don't overlap much.
    const n = Math.max(1, Math.floor(s.portalCount));
    const plane = new THREE.PlaneGeometry(1, 1);
    this.portalOpen = new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    const seeds = new Float32Array(n).map(() => Math.random());
    plane.setAttribute('aOpen', this.portalOpen);
    plane.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.portals = new THREE.InstancedMesh(plane, this.portalMat, n);
    this.portals.frustumCulled = false;
    this.group.add(this.portals);

    const aspect = s.wallWidth / Math.max(1, s.wallHeightMax - s.wallHeightMin);
    const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
    const rows = Math.ceil(n / cols);
    this.portalPos = [];
    this.portalDelay = [];
    this.portalSizes = [];
    for (const g of this.glints) { this.group.remove(g.mesh); g.mesh.geometry.dispose(); }
    this.glints = [];
    for (let i = 0; i < n; i++) {
      const cx = ((i % cols) + 0.15 + Math.random() * 0.7) / cols;
      const cy = (Math.floor(i / cols) + 0.15 + Math.random() * 0.7) / rows;
      const x = (cx - 0.5) * s.wallWidth;
      const y = s.wallHeightMin + cy * (s.wallHeightMax - s.wallHeightMin);
      // Curve the wall so outer portals are a bit closer to the enemy.
      const z = -s.wallDistance + (x * x) / (s.wallWidth * 1.4);
      this.portalPos.push(new THREE.Vector3(x, y, z));
      // Open from the centre outward.
      this.portalDelay.push((Math.abs(cx - 0.5) * 1.4 + Math.random() * 0.3) * s.openTime * 0.7);
      const size = s.portalSize * (0.75 + Math.random() * 0.5);
      this.portalSizes.push(size);
      const glint = new GlowSphere(s.portalColor, { rim: false });
      glint.mesh.position.copy(this.portalPos[i]);
      this.group.add(glint.mesh);
      this.glints.push(glint);
      this.dummy.position.copy(this.portalPos[i]);
      this.dummy.lookAt(ENEMY_POS);
      this.dummy.scale.setScalar(size);
      this.dummy.updateMatrix();
      this.portals.setMatrixAt(i, this.dummy.matrix);
    }
    this.portals.instanceMatrix.needsUpdate = true;

    // Weapons: staggered fire during the barrage, then one per portal in the final volley.
    const total = Math.max(1, Math.floor(s.weaponCount));
    const volley = s.finalVolley ? Math.min(n, total) : 0;
    this.weapons = [];
    let swordSlots = 0, spearSlots = 0;
    for (let i = 0; i < total; i++) {
      const isVolley = i >= total - volley;
      const portal = isVolley ? i - (total - volley) : Math.floor(Math.random() * n);
      const opened = this.portalDelay[portal] + 0.5;
      const fireTime = isVolley
        ? s.openTime + s.barrageTime + 0.4
        : Math.max(opened + EMERGE, s.openTime * 0.6 + Math.pow(Math.random(), 0.8) * s.barrageTime);
      const type: 0 | 1 = Math.random() < 0.65 ? 0 : 1;
      const slot = type === 0 ? swordSlots++ : spearSlots++;
      // Volley aims tight at the enemy; the barrage carpets the area around it.
      const spread = isVolley ? s.aimSpread * 0.35 : s.aimSpread;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const target = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      const dir = target.clone().sub(this.portalPos[portal]).normalize();
      const launch = this.portalPos[portal].clone().addScaledVector(dir, s.weaponScale * 0.6);
      const dist = launch.distanceTo(target);
      this.weapons.push({
        portal, fireTime, type, slot, target, launch, dir,
        impactTime: fireTime + dist / s.weaponSpeed,
        impacted: false,
        spin: (Math.random() - 0.5) * 6,
      });
    }
    this.endTime = Math.max(...this.weapons.map((w) => w.impactTime));

    const mk = (geo: THREE.BufferGeometry, count: number) => {
      const m = new THREE.InstancedMesh(geo, this.weaponMat, Math.max(1, count));
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      // Mixed treasury: gold, silver, bronze and the odd crimson blade.
      // Mid-tone values: near-white tints under the sun turn a pile of blades into a white blob.
      const palette = [0xc9a24e, 0x9ea6b0, 0x9a6a3c, 0xb0443a];
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) {
        m.setColorAt(i, c.setHex(palette[Math.random() < 0.08 ? 3 : Math.floor(Math.random() * 3)]));
      }
      this.group.add(m);
      return m;
    };
    this.swords = mk(this.swordGeo, swordSlots);
    this.spears = mk(this.spearGeo, spearSlots);
    this.streaks = new THREE.InstancedMesh(this.streakGeo, this.streakMat, total);
    this.streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.streaks.frustumCulled = false;
    this.group.add(this.streaks);
  }

  applyStyle() {
    (this.portalMat.uniforms.uColor.value as THREE.Color).set(this.settings.portalColor);
    for (const g of this.glints) g.color.set(this.settings.portalColor);
  }

  get duration() {
    return this.endTime + AFTERMATH;
  }

  play() {
    this.build();
    this.time = 0;
    this.killed = false;
    this.enemyFlash = 0;
    this.shake = 0;
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.haze.settings.rate = 0;
    this.playing = true;
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

    // Dark haze around the enemy only while the barrage is running.
    this.haze.settings.rate = this.time > this.settings.openTime * 0.6 && this.time < this.endTime ? 70 : 0;
    this.shake *= Math.exp(-dt * 8);
    this.enemyFlash *= Math.exp(-dt * 7);
    for (const w of this.weapons) {
      if (!w.impacted && this.time >= w.impactTime) this.onImpact(w);
    }
    if (!this.killed && this.time >= this.endTime) {
      this.killed = true;
      this.enemyFlash = 1.5;
      this.shake += 0.6;
      this.sparks.burst(400, ENEMY_POS);
      this.dust.burst(80, ENEMY_POS);
    }
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const closing = 1 - smoothstep((t - (this.duration - FADE)) / FADE);
    this.portalMat.uniforms.uTime.value = t;

    // Portals: pop open with a little overshoot, then close at the end.
    let openSum = 0;
    for (let i = 0; i < this.portalPos.length; i++) {
      const p = THREE.MathUtils.clamp((t - this.portalDelay[i]) / 0.5, 0, 1);
      const overshoot = p < 1 ? Math.sin(p * Math.PI * 0.5) * (1 + 0.25 * Math.sin(p * Math.PI)) : 1;
      const v = Math.min(overshoot, 1.1) * closing;
      this.portalOpen.setX(i, v);
      openSum += v;
      // Anticipation glint: a quick bloom of light just as the portal starts to open.
      const gl = (t - this.portalDelay[i] + 0.1) / 0.4;
      const gv = gl > 0 && gl < 1 ? Math.sin(gl * Math.PI) : 0;
      this.glints[i].opacity = gv * 0.45 * closing;
      this.glints[i].mesh.scale.setScalar(this.portalSizes[i] * (0.25 + 0.3 * gl));
    }
    this.portalOpen.needsUpdate = true;
    this.wallLight.intensity = (openSum / Math.max(1, this.portalPos.length)) * 120;

    // Weapons.
    const weaponFade = closing;
    for (let i = 0; i < this.weapons.length; i++) {
      const w = this.weapons[i];
      const mesh = w.type === 0 ? this.swords : this.spears;
      const local = t - w.fireTime;
      let visible = true;
      let streakLen = 0;
      const pos = this.v1;

      if (local < -EMERGE) {
        visible = false;
      } else if (local < 0) {
        // Slide out of the portal, tip first.
        const e = smoothstep((local + EMERGE) / EMERGE);
        pos.copy(this.portalPos[w.portal]).addScaledVector(w.dir, s.weaponScale * 0.6 * e);
        this.dummy.scale.setScalar(s.weaponScale * Math.max(e, 0.05) * weaponFade);
      } else if (!w.impacted) {
        pos.copy(w.launch).addScaledVector(w.dir, s.weaponSpeed * local);
        this.dummy.scale.setScalar(s.weaponScale * weaponFade);
        streakLen = Math.min(s.weaponSpeed * local, s.weaponScale * 3.5);
      } else {
        // Stuck in the ground, tip buried.
        pos.copy(w.target).addScaledVector(w.dir, s.weaponScale * 0.18);
        this.dummy.scale.setScalar(s.weaponScale * weaponFade);
      }

      if (visible && weaponFade > 0.001) {
        this.q.setFromUnitVectors(DOWN, w.dir);
        this.dummy.position.copy(pos);
        this.dummy.quaternion.copy(this.q);
        if (local < 0) this.dummy.rotateY(local * w.spin); // a slight twist as it emerges
        this.dummy.updateMatrix();
        mesh.setMatrixAt(w.slot, this.dummy.matrix);
      } else {
        mesh.setMatrixAt(w.slot, this.hidden);
      }

      if (streakLen > 0) {
        // Streak trails back from the weapon's hilt toward the portal.
        this.q.setFromUnitVectors(UP, this.v1.copy(w.dir).negate());
        this.dummy.position.copy(w.launch).addScaledVector(w.dir, s.weaponSpeed * local + s.weaponScale);
        this.dummy.quaternion.copy(this.q);
        this.dummy.scale.set(s.weaponScale * 0.6, streakLen, s.weaponScale * 0.6);
        this.dummy.updateMatrix();
        this.streaks.setMatrixAt(i, this.dummy.matrix);
      } else {
        this.streaks.setMatrixAt(i, this.hidden);
      }
    }
    this.swords.instanceMatrix.needsUpdate = true;
    this.spears.instanceMatrix.needsUpdate = true;
    this.streaks.instanceMatrix.needsUpdate = true;

    // Enemy reacts to every nearby hit, then is crushed by the final volley.
    this.enemy.setFlash(Math.min(this.enemyFlash, 1.2));
    if (this.killed) {
      this.enemy.setCrush(smoothstep((t - this.endTime) / 0.3));
    } else {
      // Recoil a little with each flash.
      this.enemy.group.rotation.x = -0.15 * Math.min(this.enemyFlash, 1);
    }
  }

  private onImpact(w: Weapon) {
    w.impacted = true;
    this.sparks.burst(10, w.target);
    if (Math.random() < 0.4) this.dust.burst(1, w.target);
    this.shake = Math.min(this.shake + 0.05, 0.5);
    const d = Math.hypot(w.target.x, w.target.z);
    if (d < 1.6) this.enemyFlash = Math.min(this.enemyFlash + 0.35, 1.5);
  }
}

export const gateOfBabylonModule: EffectModule = {
  label: 'gate of babylon',
  create: () => new GateOfBabylon(),
  telegraphs(effect) {
    const s = (effect as GateOfBabylon).settings;
    // The barrage carpets the aim area until the final volley lands.
    return [{
      shape: { kind: 'circle', x: 0, z: 0, radius: s.aimSpread + 1 },
      start: s.openTime * 0.4, impact: s.openTime + 0.2, until: s.openTime + s.barrageTime + 0.9,
    }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.8 },
  frameCamera(camera, controls, effect) {
    const s = (effect as GateOfBabylon).settings;
    // From in front of the enemy and to the side, so the portal faces and the enemy both read.
    camera.position.set(-s.wallDistance * 0.75, s.wallHeightMax * 0.45, s.wallDistance * 0.55);
    controls.target.set(0, s.wallHeightMax * 0.35, -s.wallDistance * 0.45);
  },
  buildGui(f, effect) {
    const gate = effect as GateOfBabylon;
    const s = gate.settings;
    // Layout changes take effect on the next play (which rebuilds everything).
    f.add(s, 'loop');
    f.add(s, 'portalCount', 1, 150, 1).name('portals');
    f.add(s, 'weaponCount', 10, 3000, 10).name('weapons');
    f.add(s, 'openTime', 0.2, 4, 0.05).name('open time');
    f.add(s, 'barrageTime', 0.5, 10, 0.1).name('barrage time');
    f.add(s, 'finalVolley').name('final volley');
    f.add(s, 'wallDistance', 10, 60, 0.5).name('wall distance');
    f.add(s, 'wallWidth', 5, 80, 0.5).name('wall width');
    f.add(s, 'wallHeightMin', 1, 40, 0.5).name('wall bottom');
    f.add(s, 'wallHeightMax', 2, 60, 0.5).name('wall top');
    f.add(s, 'portalSize', 0.5, 6, 0.05).name('portal size');
    f.add(s, 'weaponScale', 0.5, 8, 0.05).name('weapon size');
    f.add(s, 'weaponSpeed', 10, 200, 1).name('weapon speed');
    f.add(s, 'aimSpread', 0.5, 15, 0.1).name('aim spread');
    f.addColor(s, 'portalColor').name('portal color').onChange(() => gate.applyStyle());
  },
};
