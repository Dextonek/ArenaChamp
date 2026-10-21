import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Emitter, defaultSettings } from '../emitter';

/**
 * "Divine sword" set piece: a giant sword falls from the sky onto an enemy while a swarm of
 * small spectral swords forms a spinning drill ahead of its tip and orbits the blade.
 * On impact the swarm scatters and sticks into the ground around the crater.
 */
export interface DivineSwordSettings {
  swordCount: number;
  drillFraction: number; // share of small swords in the drill; the rest orbit the blade
  giantScale: number; // giant sword length in world units
  smallScale: number; // small sword length in world units
  fallHeight: number; // where the giant sword's tip starts
  summonTime: number; // seconds the swarm takes to gather before the fall
  fallTime: number;
  drillLength: number;
  drillRadius: number;
  drillArms: number;
  drillTwist: number; // turns of each drill arm along its length
  drillSpin: number; // radians per second at the moment of impact
  orbitRadius: number;
  orbitSpin: number;
  glowColor: string;
  swarmColor: string;
  loop: boolean;
}

export const defaultDivineSword = (): DivineSwordSettings => ({
  swordCount: 1000,
  drillFraction: 0.7,
  giantScale: 14,
  smallScale: 0.9,
  fallHeight: 40,
  summonTime: 1.8,
  fallTime: 1.6,
  drillLength: 9,
  drillRadius: 3.2,
  drillArms: 6,
  drillTwist: 1.25,
  drillSpin: 14,
  orbitRadius: 3.6,
  orbitSpin: -3,
  glowColor: '#ffd36b',
  swarmColor: '#7fd4ff',
  loop: false,
});

const AFTERMATH = 4.5; // seconds after impact until the effect has fully faded
const FADE = 1.2; // final fade-out length inside the aftermath
const GRAVITY = 28;
const DOWN = new THREE.Vector3(0, -1, 0);

/** A unit sword (about 1 long) with its tip at the origin, pointing down -Y. */
function createSwordGeometry(): THREE.BufferGeometry {
  const bladeLen = 0.72, tipLen = 0.14, w = 0.09;
  const profile = new THREE.Shape();
  profile.moveTo(0, 0);
  profile.lineTo(w / 2, tipLen);
  profile.lineTo(w / 2, bladeLen);
  profile.lineTo(-w / 2, bladeLen);
  profile.lineTo(-w / 2, tipLen);
  profile.closePath();
  const blade = new THREE.ExtrudeGeometry(profile, {
    depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 1,
  });
  blade.translate(0, 0, -0.006);

  const guard = new THREE.BoxGeometry(0.3, 0.035, 0.05).translate(0, bladeLen + 0.02, 0);
  const grip = new THREE.CylinderGeometry(0.018, 0.022, 0.2, 8).translate(0, bladeLen + 0.14, 0);
  const pommel = new THREE.SphereGeometry(0.035, 10, 8).translate(0, bladeLen + 0.26, 0);

  // mergeGeometries needs all-indexed or all-non-indexed input, with matching attributes.
  const parts = [blade, guard, grip, pommel].map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.clearGroups();
    return ng;
  });
  const merged = mergeGeometries(parts, false)!;
  merged.computeVertexNormals();
  return merged;
}

const smoothstep = (x: number) => {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

interface SwarmSword {
  start: THREE.Vector3; // where it appears in the sky
  delay: number; // when it starts flying into formation
  drill: boolean;
  arm: number; // drill arm index
  t: number; // 0 = drill apex, 1 = drill base / orbit height factor
  jitter: number;
  // aftermath state
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  dir: THREE.Vector3;
  stuck: boolean;
}

export class DivineSword {
  readonly group = new THREE.Group();
  readonly settings: DivineSwordSettings;
  /** Particle emitters owned by the effect (main needs them for pixel-scale updates). */
  readonly emitters: Emitter[] = [];
  /** Camera shake amount for this frame, in world units. */
  shake = 0;
  playing = false;

  private time = 0;
  private spinAngle = 0;
  private orbitAngle = 0;
  private impacted = false;
  private tipY = 0;

  private swordGeo = createSwordGeometry();
  private giant: THREE.Mesh;
  private giantMat: THREE.MeshStandardMaterial;
  private swarm!: THREE.InstancedMesh;
  private swarmMat: THREE.MeshStandardMaterial;
  private swords: SwarmSword[] = [];
  private pillar: THREE.Mesh;
  private pillarMat: THREE.ShaderMaterial;
  private shockwave: THREE.Mesh;
  private shockMat: THREE.MeshBasicMaterial;
  private crater: THREE.Mesh;
  private craterMat: THREE.MeshBasicMaterial;
  private enemy: THREE.Group;
  private enemyMat: THREE.MeshStandardMaterial;
  private flashLight = new THREE.PointLight(0xffe2a0, 0, 60, 1.5);
  private trail: Emitter;
  private sparks: Emitter;
  private dust: Emitter;

  private dummy = new THREE.Object3D();
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private q = new THREE.Quaternion();

  constructor(settings: DivineSwordSettings = defaultDivineSword()) {
    this.settings = settings;
    const s = settings;

    // Giant sword.
    this.giantMat = new THREE.MeshStandardMaterial({
      color: 0xf2ead2, metalness: 0.95, roughness: 0.22,
      emissive: new THREE.Color(s.glowColor), emissiveIntensity: 0.6, transparent: true,
    });
    this.giant = new THREE.Mesh(this.swordGeo, this.giantMat);
    this.group.add(this.giant);

    // Small swords (rebuilt when the count changes).
    this.swarmMat = new THREE.MeshStandardMaterial({
      color: 0xd8ecff, metalness: 0.6, roughness: 0.3,
      emissive: new THREE.Color(s.swarmColor), emissiveIntensity: 0.7,
    });
    this.buildSwarm();

    // Light pillar from the sky along the fall path.
    this.pillarMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(s.glowColor) }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity;
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main() {
          float facing = abs(dot(vN, vView));          // bright core, soft edges
          float ends = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
          gl_FragColor = vec4(uColor * 1.5, pow(facing, 2.5) * ends * uOpacity);
        }`,
    });
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1, 32, 1, true), this.pillarMat);
    this.group.add(this.pillar);

    // Shockwave ring and glowing crater on the ground.
    this.shockMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(s.glowColor).multiplyScalar(2), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.shockwave = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 96), this.shockMat);
    this.shockwave.rotation.x = -Math.PI / 2;
    this.shockwave.position.y = 0.05;
    this.group.add(this.shockwave);

    this.craterMat = new THREE.MeshBasicMaterial({
      color: 0xff8a2a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.crater = new THREE.Mesh(new THREE.RingGeometry(0.3, 3.2, 64), this.craterMat);
    this.crater.rotation.x = -Math.PI / 2;
    this.crater.position.y = 0.03;
    this.group.add(this.crater);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64),
      new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.95, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);

    // Enemy: a simple horned figure at the impact point.
    this.enemyMat = new THREE.MeshStandardMaterial({ color: 0x5a1820, roughness: 0.6, emissive: 0x000000 });
    this.enemy = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.1, 6, 16), this.enemyMat);
    body.position.y = 1.1;
    const hornGeo = new THREE.ConeGeometry(0.12, 0.5, 8);
    const hornL = new THREE.Mesh(hornGeo, this.enemyMat);
    hornL.position.set(-0.3, 2.05, 0); hornL.rotation.z = 0.4;
    const hornR = new THREE.Mesh(hornGeo, this.enemyMat);
    hornR.position.set(0.3, 2.05, 0); hornR.rotation.z = -0.4;
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.2) });
    const eyeGeo = new THREE.SphereGeometry(0.07, 8, 6);
    for (const x of [-0.18, 0.18]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, 1.55, 0.5);
      this.enemy.add(eye);
    }
    this.enemy.add(body, hornL, hornR);
    this.group.add(this.enemy);

    this.group.add(this.flashLight);
    this.flashLight.position.set(0, 2, 0);

    // Particles: golden motes trailing the tip, impact sparks, impact dust.
    this.trail = new Emitter({
      ...defaultSettings(), maxParticles: 3000, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 1.2, speed: 1.5, speedJitter: 0.8, spread: 180, gravity: -2, drag: 1,
      sizeStart: 0.3, sizeEnd: 0, colorStart: '#fff2c4', colorEnd: s.glowColor,
      opacityStart: 0.45, opacityEnd: 0, additive: true,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 3000, rate: 0, lifetime: 1.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, originY: 0.3, speed: 16, speedJitter: 0.6, spread: 80,
      gravity: 18, drag: 0.6, sizeStart: 0.22, sizeEnd: 0.04, colorStart: '#fff8e0', colorEnd: '#ff8a20',
      opacityStart: 1, opacityEnd: 0, additive: true,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 600, rate: 0, lifetime: 3.5, lifetimeJitter: 0.3,
      shape: 'cone', shapeSize: 2, originY: 0.3, speed: 9, speedJitter: 0.4, spread: 85,
      gravity: -0.3, drag: 1.8, sizeStart: 2, sizeEnd: 7, colorStart: '#8a7f70', colorEnd: '#3a3a40',
      opacityStart: 0.4, opacityEnd: 0, additive: false,
    });
    this.emitters.push(this.trail, this.sparks, this.dust);
    for (const e of this.emitters) this.group.add(e.points);

    this.reset();
  }

  /** Recreates the instanced swarm (call after changing swordCount). */
  buildSwarm() {
    if (this.swarm) {
      this.group.remove(this.swarm);
      this.swarm.dispose();
    }
    const n = Math.max(1, Math.floor(this.settings.swordCount));
    this.swarm = new THREE.InstancedMesh(this.swordGeo, this.swarmMat, n);
    this.swarm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.swarm.frustumCulled = false;
    this.group.add(this.swarm);

    const s = this.settings;
    const drillCount = Math.round(n * s.drillFraction);
    this.swords = [];
    for (let i = 0; i < n; i++) {
      const drill = i < drillCount;
      const local = drill ? i : i - drillCount;
      const total = drill ? drillCount : n - drillCount;
      // Spread evenly along the formation with a little noise so it doesn't look gridded.
      const u = (local + Math.random() * 0.8) / Math.max(1, total);
      // Drill: sqrt keeps density even over the cone's area instead of piling up at the apex.
      const t = drill ? Math.sqrt(u) : u;
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 22;
      this.swords.push({
        start: new THREE.Vector3(Math.cos(a) * r, s.fallHeight * (0.6 + Math.random() * 0.7), Math.sin(a) * r),
        delay: Math.random() * s.summonTime * 0.55,
        drill,
        arm: drill ? local % Math.max(1, Math.round(s.drillArms)) : 0,
        t,
        jitter: Math.random(),
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        dir: new THREE.Vector3(0, -1, 0),
        stuck: false,
      });
    }
  }

  /** Applies colour changes from the settings. */
  applyStyle() {
    const s = this.settings;
    this.giantMat.emissive.set(s.glowColor);
    this.swarmMat.emissive.set(s.swarmColor);
    (this.pillarMat.uniforms.uColor.value as THREE.Color).set(s.glowColor);
    this.shockMat.color.set(s.glowColor).multiplyScalar(2);
    this.trail.settings.colorEnd = s.glowColor;
    this.trail.applyStyle();
  }

  play() {
    if (this.swords.length !== Math.floor(this.settings.swordCount)) this.buildSwarm();
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.spinAngle = 0;
    this.orbitAngle = 0;
    this.impacted = false;
    this.shake = 0;
    this.tipY = this.settings.fallHeight;
    for (const e of this.emitters) e.clear();
    for (const sw of this.swords) sw.stuck = false;
    this.enemy.visible = true;
    this.enemy.scale.setScalar(1);
    this.enemyMat.emissive.setRGB(0, 0, 0);
    this.giantMat.opacity = 0;
    this.giantMat.emissiveIntensity = 0.6;
    this.shockMat.opacity = 0;
    this.craterMat.opacity = 0;
    this.pillarMat.uniforms.uOpacity.value = 0;
    this.flashLight.intensity = 0;
    this.layout(0);
  }

  get duration() {
    const s = this.settings;
    return s.summonTime + s.fallTime + AFTERMATH;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;

    const s = this.settings;
    this.time += dt;
    const impactTime = s.summonTime + s.fallTime;

    if (this.time >= this.duration) {
      if (s.loop) this.play();
      else {
        this.playing = false;
        this.layout(dt);
        return;
      }
    }

    if (!this.impacted && this.time >= impactTime) this.onImpact();
    this.layout(dt);
  }

  /** Positions everything for the current time. */
  private layout(dt: number) {
    const s = this.settings;
    const t = this.time;
    const impactTime = s.summonTime + s.fallTime;
    const sinkDepth = s.giantScale * 0.22;

    // --- Giant sword ---------------------------------------------------------
    let fall = 0;
    if (t < s.summonTime) {
      this.tipY = s.fallHeight;
    } else if (t < impactTime) {
      fall = (t - s.summonTime) / s.fallTime;
      // Accelerating fall (roughly t^2.4) so it feels heavy.
      this.tipY = s.fallHeight * (1 - Math.pow(fall, 2.4));
    } else {
      fall = 1;
      const after = t - impactTime;
      this.tipY = -sinkDepth * smoothstep(after / 0.12);
    }
    this.giant.scale.setScalar(s.giantScale);
    this.giant.position.set(0, this.tipY, 0);
    // A slow turn while it hangs in the sky, locked once it falls.
    this.giant.rotation.y = t < s.summonTime ? t * 0.4 : s.summonTime * 0.4;

    const appear = smoothstep(t / (s.summonTime * 0.5));
    const fadeOut = this.impacted ? 1 - smoothstep((t - (this.duration - FADE)) / FADE) : 1;
    this.giantMat.opacity = appear * fadeOut;
    this.giant.visible = this.giantMat.opacity > 0.001;
    this.giantMat.depthWrite = this.giantMat.opacity > 0.95;

    // Charge up the glow as it falls, burst on impact, then settle.
    if (!this.impacted) {
      this.giantMat.emissiveIntensity = 0.4 + 0.8 * fall * fall;
    } else {
      const after = t - impactTime;
      this.giantMat.emissiveIntensity = 0.8 + 3 * Math.exp(-after * 3);
    }

    // Light pillar.
    const pillarTop = s.fallHeight + s.giantScale + 10;
    const pillarBottom = Math.max(0, this.tipY);
    this.pillar.scale.set(1, pillarTop - pillarBottom, 1);
    this.pillar.position.y = (pillarTop + pillarBottom) / 2;
    const pillarOn = this.impacted ? 0.6 * Math.exp(-(t - impactTime) * 1.5) : appear * (0.15 + 0.3 * fall);
    this.pillarMat.uniforms.uOpacity.value = pillarOn * fadeOut;

    // Trail motes follow the tip during the fall.
    if (!this.impacted && t >= s.summonTime) {
      this.trail.settings.originY = this.tipY + s.giantScale * 0.85;
      this.trail.burst(Math.ceil(400 * dt));
    }

    // --- Swarm ---------------------------------------------------------------
    const spinRate = !this.impacted
      ? s.drillSpin * (0.25 + 0.75 * fall)
      : s.drillSpin * Math.exp(-(t - impactTime) * 4);
    this.spinAngle += spinRate * dt;
    this.orbitAngle += s.orbitSpin * dt;

    const arms = Math.max(1, Math.round(s.drillArms));
    const swarmFade = this.impacted ? 1 - smoothstep((t - (this.duration - FADE)) / FADE) : 1;
    const target = this.v1, dir = this.v2;

    for (let i = 0; i < this.swords.length; i++) {
      const sw = this.swords[i];
      let scale = s.smallScale;

      if (!this.impacted) {
        this.formationPose(sw, arms, target, dir);
        // Fly from the sky into formation; scale up as they arrive.
        const p = smoothstep((t - sw.delay) / (s.summonTime * 0.5));
        sw.pos.lerpVectors(sw.start, target, p);
        sw.dir.copy(dir);
        if (p < 1) {
          // While flying in, point along the flight path.
          const fly = this.v2.copy(target).sub(sw.start).normalize();
          sw.dir.lerp(fly, 1 - p).normalize();
        }
        scale *= Math.sqrt(p);
      } else if (!sw.stuck) {
        sw.vel.y -= GRAVITY * dt;
        sw.pos.addScaledVector(sw.vel, dt);
        if (sw.vel.lengthSq() > 1e-4) sw.dir.copy(sw.vel).normalize();
        if (sw.pos.y <= 0.1 && sw.vel.y < 0) {
          // Stick into the ground, tip first.
          sw.stuck = true;
          sw.pos.y = 0.1 - 0.25 * s.smallScale;
          sw.dir.y = Math.min(sw.dir.y, -0.6);
          sw.dir.normalize();
        }
      }
      scale *= swarmFade;

      this.q.setFromUnitVectors(DOWN, sw.dir);
      this.dummy.position.copy(sw.pos);
      this.dummy.quaternion.copy(this.q);
      this.dummy.scale.setScalar(Math.max(scale, 1e-4));
      this.dummy.updateMatrix();
      this.swarm.setMatrixAt(i, this.dummy.matrix);
    }
    this.swarm.instanceMatrix.needsUpdate = true;
    this.swarmMat.emissiveIntensity = this.impacted
      ? 0.25 + 1.2 * Math.exp(-(t - impactTime) * 1.5)
      : 0.3 + 0.35 * fall;

    // --- Impact aftermath ----------------------------------------------------
    if (this.impacted) {
      const after = t - impactTime;
      const wave = after / 0.9;
      this.shockwave.scale.setScalar(1 + wave * 26);
      this.shockMat.opacity = Math.max(0, 1 - wave) * 0.9;
      this.craterMat.opacity = Math.exp(-after * 0.8) * 0.9 * fadeOut;
      this.flashLight.intensity = 400 * Math.exp(-after * 6);
      this.shake = 0.9 * Math.exp(-after * 5);

      // Enemy: white-hot flash, then crushed.
      const hit = Math.exp(-after * 5);
      this.enemyMat.emissive.setRGB(6 * hit, 5 * hit, 4 * hit);
      const squash = 1 - smoothstep(after / 0.25);
      this.enemy.scale.set(1 + (1 - squash) * 0.6, Math.max(squash, 0.001), 1 + (1 - squash) * 0.6);
      this.enemy.visible = squash > 0.01;
    }
  }

  /** Where a swarm sword sits in the drill / orbit formation right now. */
  private formationPose(sw: SwarmSword, arms: number, outPos: THREE.Vector3, outDir: THREE.Vector3) {
    const s = this.settings;
    if (sw.drill) {
      // Conical helix: apex leads below the giant tip, widening up around the blade.
      const apex = this.tipY - s.drillLength * 0.3;
      const y = apex + sw.t * s.drillLength;
      const r = 0.5 + s.drillRadius * Math.pow(sw.t, 0.85) * (0.9 + 0.2 * sw.jitter);
      const ang = this.spinAngle + (sw.arm / arms) * Math.PI * 2 + sw.t * s.drillTwist * Math.PI * 2;
      const c = Math.cos(ang), sn = Math.sin(ang);
      outPos.set(c * r, y, sn * r);
      // Point down the drill flute: downward, along the spin, and slightly inward.
      outDir.set(-sn * 0.9 - c * 0.35, -1, c * 0.9 - sn * 0.35).normalize();
    } else {
      // Orbit rings around the blade, tips down and canted along the orbit.
      const h = this.tipY + s.giantScale * (0.15 + 0.7 * sw.t);
      const r = s.orbitRadius * (0.85 + 0.4 * sw.jitter);
      const ang = this.orbitAngle + sw.t * Math.PI * 2 * 7 + sw.jitter * 0.6;
      const c = Math.cos(ang), sn = Math.sin(ang);
      outPos.set(c * r, h, sn * r);
      const dirSign = Math.sign(s.orbitSpin) || 1;
      outDir.set(-sn * 0.6 * dirSign, -1, c * 0.6 * dirSign).normalize();
    }
  }

  private onImpact() {
    this.impacted = true;
    const s = this.settings;
    this.sparks.burst(2500);
    this.dust.burst(450);
    // Scatter the swarm outward; each one later sticks into the ground.
    for (const sw of this.swords) {
      const radial = this.v1.set(sw.pos.x, 0, sw.pos.z);
      if (radial.lengthSq() < 1e-4) radial.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      radial.normalize();
      const speed = 6 + Math.random() * 14;
      sw.vel.set(radial.x * speed, 4 + Math.random() * 12, radial.z * speed);
      // Swords already below ground (deep in the drill) pop back up.
      sw.pos.y = Math.max(sw.pos.y, 0.2 + Math.random() * s.smallScale);
    }
  }

  dispose() {
    this.swordGeo.dispose();
    this.swarm.dispose();
    for (const e of this.emitters) e.dispose();
  }
}
