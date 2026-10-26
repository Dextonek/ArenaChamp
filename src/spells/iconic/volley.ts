import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  ENEMY_POS, Enemy, GlowSphere, createCaster, createGround, createRing, frameArena, mergeParts, smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Volley (hunter): the caster draws a bow and looses a flight of glowing arrows straight up. They arc high into the
 * sky and rain down over a marked circle around the enemy, sticking into the ground at angles; a few hit the enemy.
 */
export interface VolleySettings {
  arrowCount: number;
  radius: number; // radius of the target area
  peakHeight: number;
  drawTime: number;
  color: string;
  loop: boolean;
}

export const defaultVolley = (): VolleySettings => ({
  arrowCount: 60,
  radius: 5,
  peakHeight: 20,
  drawTime: 1,
  color: '#b8e04a',
  loop: false,
});

const MAX_ARROWS = 80;
const LAUNCH_SPREAD = 0.6; // arrows leave the bow over this many seconds
const AFTERMATH = 1.3;
const BOW_POS = new THREE.Vector3(0.7, 1.9, 13.1);
const UP = new THREE.Vector3(0, 1, 0);

/** Arrow with its tip at the origin, pointing +Y, shaft and fletching trailing behind along -Y (about 1.65 long). */
function createArrowGeometry(): THREE.BufferGeometry {
  const head = new THREE.ConeGeometry(0.1, 0.35, 6).translate(0, -0.175, 0);
  const shaft = new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5).translate(0, -1, 0);
  const fletchA = new THREE.BoxGeometry(0.3, 0.3, 0.012).translate(0, -1.5, 0);
  const fletchB = new THREE.BoxGeometry(0.012, 0.3, 0.3).translate(0, -1.5, 0);
  return mergeParts([head, shaft, fletchA, fletchB]);
}

interface ArrowParams {
  delay: number; // launch delay after release
  flight: number;
  ang: number;
  rr: number; // 0..1 (sqrt-distributed) radius fraction
  hit: boolean; // lands in the enemy
  jx: number;
  jz: number; // how far it leans once stuck
  hitY: number;
}

export class Volley implements Effect {
  readonly group = new THREE.Group();
  readonly settings: VolleySettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private landed: boolean[] = new Array(MAX_ARROWS).fill(false);
  private released = false;
  private params: ArrowParams[] = [];

  private caster = createCaster(0x5a6b3a);
  private enemy = new Enemy();
  private bow = new THREE.Group();
  private bowMat = new THREE.MeshStandardMaterial({ color: 0x4a3a22, roughness: 0.6, emissive: 0x3a5a10, emissiveIntensity: 0.5 });
  private stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
  private nocked: THREE.Mesh;
  private arrowMat = new THREE.MeshStandardMaterial({
    color: 0x9ab33a, roughness: 0.5, emissive: 0xb8e04a, emissiveIntensity: 0.9,
  });
  private arrows: THREE.InstancedMesh;
  private trailMat = new THREE.MeshBasicMaterial({
    color: 0xa6d84a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private trails: THREE.InstancedMesh;
  private nockGlow = new GlowSphere(0xc8f060, { rim: false });
  private ringOuter = createRing(0xb8e04a, 0.93, 1, 96);
  private ringInner = createRing(0xb8e04a, 0.58, 0.62, 96);
  private ringRune = createRing(0xb8e04a, 0.78, 0.84, 6);
  private dust: Emitter;
  private glints: Emitter;
  private dummy = new THREE.Object3D();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();

  constructor(settings: VolleySettings = defaultVolley()) {
    this.settings = settings;

    let seed = 1337;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < MAX_ARROWS; i++) {
      this.params.push({
        delay: rnd() * LAUNCH_SPREAD, flight: 1.3 + rnd() * 0.6, ang: rnd() * Math.PI * 2, rr: Math.sqrt(rnd()),
        hit: i % 7 === 3, jx: (rnd() - 0.5) * 1.4, jz: (rnd() - 0.5) * 1.4, hitY: 0.5 + rnd() * 1.4,
      });
    }

    // Bow: a curved tube with the belly toward the enemy (-Z) and a string line between the tips.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -1.2, 0.05), new THREE.Vector3(0, -0.6, -0.3), new THREE.Vector3(0, 0, -0.42),
      new THREE.Vector3(0, 0.6, -0.3), new THREE.Vector3(0, 1.2, 0.05),
    ]);
    const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.055, 6), this.bowMat);
    const string = new THREE.Line(this.stringGeo, new THREE.LineBasicMaterial({ color: 0xd8e8a0 }));
    this.nocked = new THREE.Mesh(createArrowGeometry(), this.arrowMat);
    this.nocked.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0, 0, -1));
    this.bow.add(limb, string, this.nocked);

    const arrowGeo = createArrowGeometry();
    this.arrows = new THREE.InstancedMesh(arrowGeo, this.arrowMat, MAX_ARROWS);
    const trailGeo = new THREE.CylinderGeometry(0.07, 0.0, 1, 5, 1, true).translate(0, -0.5, 0);
    this.trails = new THREE.InstancedMesh(trailGeo, this.trailMat, MAX_ARROWS);
    this.arrows.frustumCulled = false;
    this.trails.frustumCulled = false;

    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.bow, this.arrows, this.trails, this.nockGlow.mesh);
    this.group.add(this.ringOuter.mesh, this.ringInner.mesh, this.ringRune.mesh);

    // Dark normal-blended dust behind bright glints.
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 1.1, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.2, originY: 0.1, speed: 1.4, speedJitter: 0.6, spread: 75, gravity: -0.4, drag: 1.2,
      sizeStart: 0.45, sizeEnd: 1.1, colorStart: '#6b5d48', colorEnd: '#2e2a24', opacityStart: 0.5, opacityEnd: 0,
      additive: false, sizeJitter: 0.4, erosion: 0.55, spin: 0.6,
    });
    this.glints = new Emitter({
      ...defaultSettings(), maxParticles: 1200, rate: 0, lifetime: 0.5, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.1, speed: 4.5, speedJitter: 0.6, spread: 70, gravity: 9, drag: 0.8,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#f4ffc0', colorEnd: '#7ac830', colorMid: '#c8f060',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });
    this.emitters.push(this.dust, this.glints);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.arrowMat.emissive.set(c);
    this.trailMat.color.set(c);
    for (const r of [this.ringOuter, this.ringInner, this.ringRune]) r.material.color.set(c);
    this.nockGlow.color.set(c);
    this.glints.settings.colorEnd = c;
    this.glints.applyStyle();
  }

  get duration() {
    return this.settings.drawTime + LAUNCH_SPREAD + 1.9 + AFTERMATH;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.released = false;
    this.landed.fill(false);
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
    for (const e of this.emitters) e.clear();
    this.layout();
  }

  /** Where arrow i comes down (the tip's resting point). */
  private landing(i: number, out: THREE.Vector3) {
    const p = this.params[i];
    if (p.hit) return out.set(ENEMY_POS.x + Math.cos(p.ang) * 0.35, p.hitY, ENEMY_POS.z + Math.sin(p.ang) * 0.35);
    const r = p.rr * this.settings.radius;
    return out.set(ENEMY_POS.x + Math.cos(p.ang) * r, 0, ENEMY_POS.z + Math.sin(p.ang) * r);
  }

  private landTime(i: number) {
    return this.settings.drawTime + this.params[i].delay + this.params[i].flight;
  }

  update(dt: number) {
    for (const e of this.emitters) e.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
    }
    const s = this.settings;
    if (!this.released && this.time >= s.drawTime) {
      this.released = true;
      this.glints.burst(60, this.tmpA.set(BOW_POS.x, BOW_POS.y + 1.2, BOW_POS.z - 0.8));
      this.shake = 0.15;
    }
    let hits = 0;
    for (let i = 0; i < s.arrowCount; i++) {
      if (this.landed[i] || this.time < this.landTime(i)) continue;
      this.landed[i] = true;
      this.landing(i, this.tmpA);
      if (this.params[i].hit) {
        this.glints.burst(26, this.tmpA);
        hits++;
      } else {
        this.tmpA.y = 0.12;
        this.dust.burst(4, this.tmpA);
        this.glints.burst(7, this.tmpA);
      }
    }
    if (hits > 0) this.shake = Math.max(this.shake, 0.12);
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const draw = smoothstep(t / s.drawTime);
    const fade = 1 - smoothstep((t - (this.duration - 0.9)) / 0.9);
    this.shake *= 0.9;

    // Bow: tilts up toward the sky while drawing, string snaps back on release.
    const sinceRelease = t - s.drawTime;
    const pull = t < s.drawTime ? 0.15 + 0.6 * draw : 0.75 * Math.max(0, 1 - sinceRelease * 12);
    const tilt = 1.15 * draw;
    this.bow.position.copy(BOW_POS);
    this.bow.rotation.set(tilt, 0, 0);
    const posAttr = this.stringGeo.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setXYZ(0, 0, -1.2, 0.05);
    posAttr.setXYZ(1, 0, 0, 0.05 + pull);
    posAttr.setXYZ(2, 0, 1.2, 0.05);
    posAttr.needsUpdate = true;
    this.stringGeo.computeBoundingSphere();
    this.nocked.visible = t < s.drawTime;
    this.nocked.position.set(0, 0, 0.05 + pull - 1.65);
    // Caster crouches a touch while drawing.
    this.caster.group.position.y = -0.12 * draw * (1 - smoothstep(sinceRelease / 0.4));

    // Nock glow: anticipation at the bow, fades at release.
    this.nockGlow.mesh.position.set(BOW_POS.x, BOW_POS.y + 0.2 + 0.9 * draw, BOW_POS.z - 0.1 - 0.5 * draw);
    this.nockGlow.mesh.scale.setScalar(0.15 + 0.35 * draw);
    this.nockGlow.opacity = t < s.drawTime ? 0.45 * draw : 0.45 * Math.exp(-sinceRelease * 8);

    // Arrows in flight / stuck.
    const start = this.tmpA;
    const land = this.tmpB;
    const dir = this.tmpC;
    const d = this.dummy;
    const sink = fade;
    for (let i = 0; i < MAX_ARROWS; i++) {
      const p = this.params[i];
      const u = (t - s.drawTime - p.delay) / p.flight;
      if (i >= s.arrowCount || u < 0) {
        d.position.set(0, -50, 0); d.scale.setScalar(1e-4); d.updateMatrix(); // never 0: a singular instance matrix gives NaN normals → black bloomed frame
        this.arrows.setMatrixAt(i, d.matrix);
        this.trails.setMatrixAt(i, d.matrix);
        continue;
      }
      start.set(BOW_POS.x, BOW_POS.y + 1.4, BOW_POS.z - 0.9);
      this.landing(i, land);
      const k = Math.min(u, 1);
      const H = s.peakHeight;
      d.position.set(
        start.x + (land.x - start.x) * k,
        start.y + (land.y - start.y) * k + 4 * H * k * (1 - k),
        start.z + (land.z - start.z) * k,
      );
      dir.set(land.x - start.x, land.y - start.y + 4 * H * (1 - 2 * Math.min(k, 1)), land.z - start.z).normalize();
      if (u > 1) {
        // Stuck: settles to a lean over a few frames, sunk slightly in, then fades out at the end.
        const settle = smoothstep((u - 1) * p.flight / 0.12);
        dir.x += p.jx * settle; dir.z += p.jz * settle; dir.normalize();
        d.position.copy(land).addScaledVector(dir, -0.15);
      }
      d.quaternion.setFromUnitVectors(UP, dir);
      d.scale.setScalar(Math.max(1e-4, u > 1 ? sink : 1));
      d.updateMatrix();
      this.arrows.setMatrixAt(i, d.matrix);

      // Streak trail, only while flying: starts behind the tail and trails off.
      if (u < 1) {
        const tail = d.position.clone().addScaledVector(dir, -1.5);
        d.position.copy(tail);
        d.scale.set(1, Math.max(1e-4, 3.5 * smoothstep(u / 0.08)), 1);
      } else {
        d.scale.setScalar(1e-4);
      }
      d.updateMatrix();
      this.trails.setMatrixAt(i, d.matrix);
    }
    this.arrows.instanceMatrix.needsUpdate = true;
    this.trails.instanceMatrix.needsUpdate = true;
    this.arrows.count = MAX_ARROWS;

    // Target circle marks the area from the release until the last arrow lands.
    const lastLand = s.drawTime + LAUNCH_SPREAD + 1.9;
    const mark = smoothstep((t - s.drawTime + 0.3) / 0.4) * (1 - smoothstep((t - lastLand) / 0.7));
    const pulse = 0.75 + 0.25 * Math.sin(t * 9);
    ([this.ringOuter, this.ringInner, this.ringRune] as const).forEach((r, idx) => {
      const sc = s.radius * (idx === 0 ? 1 : idx === 1 ? 0.95 : 1.05) * (0.9 + 0.1 * mark);
      r.mesh.scale.setScalar(sc);
      r.material.opacity = mark * pulse * (idx === 0 ? 0.55 : 0.4) * fade;
    });
    this.ringInner.mesh.rotation.z = -t * 0.9;
    this.ringRune.mesh.rotation.z = t * 0.6;

    // Enemy flashes with every arrow that strikes it.
    let flash = 0;
    for (let i = 0; i < s.arrowCount; i++) {
      if (!this.params[i].hit) continue;
      const since = t - this.landTime(i);
      if (since >= 0) flash += Math.exp(-since * 9);
    }
    this.enemy.setFlash(Math.min(flash, 1.2));
  }
}

export const volleyModule: EffectModule = {
  label: 'volley',
  category: 'iconic',
  create: () => new Volley(),
  telegraphs(effect) {
    const s = (effect as Volley).settings;
    // The arrow rain: first arrows land 1.3 s after release, the last ones LAUNCH_SPREAD + 1.9 s after it.
    return [
      {
        shape: { kind: 'circle', x: ENEMY_POS.x, z: ENEMY_POS.z, radius: s.radius },
        start: Math.max(0.1, s.drawTime - 0.3), impact: s.drawTime + 1.3, until: s.drawTime + LAUNCH_SPREAD + 1.9,
      },
    ];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const s = (effect as Volley).settings;
    // Caster at z = 14, target area around the origin, arrows peaking high above.
    frameArena(camera, controls, new THREE.Vector3(0, s.peakHeight * 0.35, 7), Math.max(12, s.peakHeight * 0.65));
  },
  buildGui(f, effect) {
    const v = effect as Volley;
    const s = v.settings;
    f.add(s, 'loop');
    f.add(s, 'arrowCount', 40, 80, 1).name('arrows');
    f.add(s, 'radius', 2, 9, 0.1).name('area radius');
    f.add(s, 'peakHeight', 8, 35, 0.5).name('peak height');
    f.add(s, 'drawTime', 0.4, 2, 0.05).name('draw time');
    f.addColor(s, 'color').onChange(() => v.applyStyle());
  },
};
