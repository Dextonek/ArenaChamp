import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, Enemy, GlowSphere, LightPillar, createCaster, createGround, createRing, frameArena, smoothstep,
  softDotTexture,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Lay on Hands (reworked): the caster steps up to a kneeling, dimly lit ally and lays a hand on it. A blinding
 * column of light descends, a huge golden rune circle blooms under them, healing light spirals up around the
 * ally, the ally rises back to full height and brightens, then a final radiant burst with rising motes.
 */
export interface LayOnHandsSettings {
  runeSize: number;
  color: string;
  loop: boolean;
}

export const defaultLayOnHands = (): LayOnHandsSettings => ({
  runeSize: 5.5,
  color: '#ffcf6a',
  loop: false,
});

const WALK = 1.2; // caster steps up to the ally
const TOUCH = 1.4; // hand placed
const PILLAR = 1.6; // column of light descends
const RISE0 = 2.4; // ally starts to rise
const RISE1 = 3.3;
const BURST = 3.5; // final radiant burst
const DURATION = 5.4;
const SPIRAL_COUNT = 650;
const SPIRAL_HEIGHT = 5.5;

const ALLY_POS = new THREE.Vector3(-3, 0, 6);
const CASTER_END = new THREE.Vector3(-3, 0, 8.4);
const ALLY_DIM = new THREE.Color(0x1c3552);
const ALLY_BRIGHT = new THREE.Color(0x5a96d6);

export class LayOnHands implements Effect {
  readonly group = new THREE.Group();
  readonly settings: LayOnHandsSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private burstDone = false;

  private caster = createCaster();
  private ally = new Enemy({ color: 0x3a6ea5, horns: false, eyeColor: new THREE.Color(1.5, 1.3, 0.8) }).setHome(ALLY_POS);
  private handGlow = new GlowSphere(0xffe2a0, { rim: false });
  private pillar = new LightPillar(0xffe6a0, 1.3);
  private hex = createRing(0xffc94a, 0.82, 1, 6);
  private hex2 = createRing(0xffc94a, 0.5, 0.56, 6);
  private circleOuter = createRing(0xffc94a, 0.92, 1, 96);
  private circleMid = createRing(0xffd27a, 0.66, 0.7, 96);
  private circleInner = createRing(0xffc94a, 0.3, 0.34, 64);
  private aura = new GlowSphere(0xffe0a0, { rim: false });
  private burstSphere = new GlowSphere(0xffd27a);
  private shock = createRing(0xffd27a, 0.9, 1, 96);
  private spiral: THREE.Points;
  private spiralMat: THREE.PointsMaterial;
  private spiralPos = new Float32Array(SPIRAL_COUNT * 3);
  private seeds = new Float32Array(SPIRAL_COUNT * 4); // angle, radius, rise speed, height offset
  private sparks: Emitter;
  private motes: Emitter;

  constructor(settings: LayOnHandsSettings = defaultLayOnHands()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.ally.group);
    this.group.add(this.handGlow.mesh, this.pillar.mesh, this.aura.mesh, this.burstSphere.mesh);
    this.group.add(this.hex.mesh, this.hex2.mesh, this.circleOuter.mesh, this.circleMid.mesh, this.circleInner.mesh);
    this.group.add(this.shock.mesh);

    for (let i = 0; i < SPIRAL_COUNT; i++) {
      this.seeds[i * 4] = Math.random() * Math.PI * 2;
      this.seeds[i * 4 + 1] = 0.7 + Math.random() * 1.5;
      this.seeds[i * 4 + 2] = 0.9 + Math.random() * 0.9;
      this.seeds[i * 4 + 3] = Math.random() * SPIRAL_HEIGHT;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.spiralPos, 3));
    this.spiralMat = new THREE.PointsMaterial({
      color: 0xffe9b0, size: 0.17, map: softDotTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.spiral = new THREE.Points(geo, this.spiralMat);
    this.spiral.frustumCulled = false;
    this.group.add(this.spiral);

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.0, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, speed: 8, speedJitter: 0.6, spread: 180, gravity: 4, drag: 0.8,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ffb02a',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 800, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'cone', shapeSize: 2.2, speed: 1.8, speedJitter: 0.5, spread: 25, gravity: -0.7, drag: 0.6,
      sizeStart: 0.2, sizeEnd: 0, colorStart: '#fff2c4', colorEnd: settings.color,
      opacityStart: 0.4, opacityEnd: 0, additive: true,
      colorMid: '#ffd98a', sizeJitter: 0.4, erosion: 0.5, spin: 0.4,
    });
    this.emitters.push(this.sparks, this.motes);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.pillar.color.set(c);
    this.hex.material.color.set(c);
    this.hex2.material.color.set(c);
    this.circleOuter.material.color.set(c);
    this.circleInner.material.color.set(c);
    this.burstSphere.color.set(c);
    this.motes.settings.colorEnd = c;
    this.motes.applyStyle();
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
    this.burstDone = false;
    this.shake = 0;
    this.caster.reset();
    this.ally.reset();
    for (const e of this.emitters) e.clear();
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
    if (!this.burstDone && this.time >= BURST) this.onBurst();
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const after = t - BURST;
    const burst = this.burstDone;
    const fade = 1 - smoothstep((t - (DURATION - 0.9)) / 0.9);

    // Caster steps up to the ally (little hops), then stands with a hand on it.
    const walk = smoothstep(t / WALK);
    const hop = t < WALK ? Math.abs(Math.sin(walk * Math.PI * 3)) * 0.12 : 0;
    const cp = this.caster.group.position;
    cp.lerpVectors(CASTER_POS, CASTER_END, walk);
    cp.y = hop;

    // Hand glow where the hand rests on the ally's shoulder.
    const touch = smoothstep((t - WALK) / (TOUCH - WALK));
    this.handGlow.mesh.position.set(cp.x, 1.7, cp.z - 1.0);
    this.handGlow.mesh.scale.setScalar(0.2 + 0.3 * touch);
    this.handGlow.opacity = (burst ? 0.5 * Math.exp(-after * 5) : 0.5 * touch) * fade;

    // Column of light.
    const pil = smoothstep((t - PILLAR) / 0.25);
    const pillarOp = burst ? 0.55 * Math.exp(-after * 2.2) : 0.55 * pil;
    this.pillar.set(ALLY_POS.x, ALLY_POS.z, 0, 18, pillarOp * fade);

    // Rune circle: blooms out beneath them, layers counter-rotating.
    const bloom = smoothstep((t - 1.7) / 0.7);
    const r = s.runeSize * bloom;
    const runeOp = (burst ? 0.5 + 0.2 * Math.exp(-after * 3) : 0.5 * bloom) * fade;
    const cx = (ALLY_POS.x + CASTER_END.x) / 2;
    const cz = (ALLY_POS.z + CASTER_END.z) / 2;
    const layers: [typeof this.hex, number, number, number][] = [
      [this.hex, 1, 0.55, 0.8], [this.hex2, 0.6, -0.9, 0.7], [this.circleOuter, 1, 0.1, 0.9],
      [this.circleMid, 0.78, -0.4, 0.7], [this.circleInner, 0.34, 1.4, 0.8],
    ];
    for (const [ring, k, spin, op] of layers) {
      ring.mesh.position.set(cx, 0.04, cz);
      ring.mesh.scale.setScalar(Math.max(0.001, r * k));
      ring.mesh.rotation.z = t * spin;
      ring.material.opacity = runeOp * op;
    }

    // Healing light spiralling up around the ally.
    const sp = smoothstep((t - 1.8) / 0.5);
    this.spiralMat.opacity = (burst ? 0.5 * Math.exp(-after * 2.5) : 0.5 * sp) * fade;
    const lt = Math.max(0, t - 1.8);
    for (let i = 0; i < SPIRAL_COUNT; i++) {
      const a0 = this.seeds[i * 4];
      const rad = this.seeds[i * 4 + 1];
      const speed = this.seeds[i * 4 + 2];
      const y = (this.seeds[i * 4 + 3] + speed * lt) % SPIRAL_HEIGHT;
      const k = y / SPIRAL_HEIGHT;
      const a = a0 + (i % 2 === 0 ? 1 : -1) * (lt * 2.2 + y * 1.1);
      const rr = rad * (1 - 0.55 * k);
      this.spiralPos[i * 3] = ALLY_POS.x + Math.cos(a) * rr;
      this.spiralPos[i * 3 + 1] = 0.1 + y;
      this.spiralPos[i * 3 + 2] = ALLY_POS.z + Math.sin(a) * rr;
    }
    this.spiral.geometry.attributes.position.needsUpdate = true;

    // Soft glow envelops the ally.
    const env = smoothstep((t - 2.0) / 0.6);
    this.aura.mesh.position.set(ALLY_POS.x, 1.1, ALLY_POS.z);
    this.aura.mesh.scale.setScalar(2.0 + 0.15 * Math.sin(t * 6));
    this.aura.opacity = (burst ? 0.3 * Math.exp(-after * 3) : 0.3 * env) * fade;

    // Ally: kneeling, tilted and dim, rises to full height and brightens.
    const heal = smoothstep((t - RISE0) / (RISE1 - RISE0));
    this.ally.group.scale.set(1, 0.68 + 0.32 * heal, 1);
    this.ally.group.rotation.x = 0.28 * (1 - heal);
    this.ally.material.color.copy(ALLY_DIM).lerp(ALLY_BRIGHT, heal);
    this.ally.setFlash(0.1 * env + (burst ? 0.4 * Math.exp(-after * 4) : 0));

    // Final burst.
    if (burst) {
      this.burstSphere.mesh.position.set(ALLY_POS.x, 1.2, ALLY_POS.z);
      this.burstSphere.mesh.scale.setScalar(1 + after * 9);
      this.burstSphere.opacity = 0.55 * Math.exp(-after * 4);
      this.shock.mesh.position.set(ALLY_POS.x, 0.05, ALLY_POS.z);
      this.shock.mesh.scale.setScalar(1 + after * 20);
      this.shock.material.opacity = Math.max(0, 0.7 * (1 - after / 0.8));
      this.shake = 0.25 * Math.exp(-after * 7);
    } else {
      this.burstSphere.opacity = 0;
      this.shock.material.opacity = 0;
    }
  }

  private onBurst() {
    this.burstDone = true;
    const at = new THREE.Vector3(ALLY_POS.x, 1.2, ALLY_POS.z);
    this.sparks.burst(500, at);
    this.motes.burst(450, new THREE.Vector3(ALLY_POS.x, 0.2, ALLY_POS.z));
  }
}

export const layOnHandsModule: EffectModule = {
  label: 'lay on hands',
  category: 'paladin',
  create: () => new LayOnHands(),
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls) {
    // Caster and ally close together near z = 6..8, column of light rising above.
    frameArena(camera, controls, new THREE.Vector3(-2, 3.5, 7.5), 9);
  },
  buildGui(f, effect) {
    const l = effect as LayOnHands;
    const s = l.settings;
    f.add(s, 'loop');
    f.add(s, 'runeSize', 2, 12, 0.1).name('rune size');
    f.addColor(s, 'color').onChange(() => l.applyStyle());
  },
};
