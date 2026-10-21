import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  CASTER_POS, ENEMY_POS, Enemy, GlowSphere, LightPillar, createCaster, createGround, createRing,
  smoothstep,
} from '../../effects/common';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Avenging Wrath (reworked): a column of light slams down on the caster, who rises into the air while two huge
 * wings of light unfold behind them feather by feather (three fanned rows each), then beat gently. A halo
 * ignites above the head, a golden aura shell wraps the caster and feathers of light drift down. The enemy is
 * not hit - it only recoils from the shockwave of light.
 */
export interface AvengingWrathSettings {
  wingSize: number; // length of the longest feather
  riseHeight: number;
  duration: number; // total seconds
  color: string;
  loop: boolean;
}

export const defaultAvengingWrath = (): AvengingWrathSettings => ({
  wingSize: 5.5,
  riseHeight: 1.6,
  duration: 5.2,
  color: '#ffcf6a',
  loop: false,
});

const SLAM = 0.3;
const WING_START = 0.7;
const WING_SWEEP = 40 * Math.PI / 180; // how far back the wing plane is swept from the sideways axis
const FADE = 0.9;

interface Row { n: number; a0: number; a1: number; len: number; wid: number; rootUp: number; delay: number }
const ROWS: Row[] = [
  { n: 16, a0: 8, a1: 118, len: 1, wid: 0.34, rootUp: 0, delay: 0 },
  { n: 14, a0: 2, a1: 104, len: 0.66, wid: 0.4, rootUp: 0.1, delay: 0.12 },
  { n: 10, a0: -4, a1: 86, len: 0.4, wid: 0.5, rootUp: 0.2, delay: 0.24 },
];
const FEATHERS_PER_WING = ROWS.reduce((n, r) => n + r.n, 0);
const FALLERS = 28;

/** Leaf-shaped feather, root at the origin, tip at +Y (length 1); vertex colours fade it toward the tip. */
function createFeatherGeometry(): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(0.2, 0.3, 0, 1);
  sh.quadraticCurveTo(-0.2, 0.3, 0, 0);
  const g = new THREE.ShapeGeometry(sh, 8);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = 1 - 0.75 * pos.getY(i);
    col[i * 3] = c; col[i * 3 + 1] = c; col[i * 3 + 2] = c;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export class AvengingWrath implements Effect {
  readonly group = new THREE.Group();
  readonly settings: AvengingWrathSettings;
  readonly emitters: Emitter[] = [];
  shake = 0;
  playing = false;

  private time = 0;
  private slammed = false;

  private caster = createCaster();
  private enemy = new Enemy();
  private aura = new GlowSphere(0xffd27a);
  private core = new GlowSphere(0xfff0c0, { rim: false });
  private pillar = new LightPillar(0xffd36b, 1.7);
  private halo = createRing(0xffe2a0, 0.86, 1, 64);
  private shock = createRing(0xffd27a, 0.9, 1, 96);
  private ground = createRing(0xffc94a, 0.92, 1, 6);
  private wingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.3, 0.95, 0.45), vertexColors: true, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private fallMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.3, 1.0, 0.55), vertexColors: true, transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private feather = createFeatherGeometry();
  private wings: THREE.InstancedMesh;
  private fallers: THREE.InstancedMesh;
  private sparks: Emitter;
  private motes: Emitter;

  private dummy = new THREE.Object3D();
  private m = new THREE.Matrix4();
  private fallSeed: { x: number; z: number; ph: number; t0: number }[] = [];

  constructor(settings: AvengingWrathSettings = defaultAvengingWrath()) {
    this.settings = settings;
    this.group.add(createGround(), this.caster.group, this.enemy.group);
    this.group.add(this.aura.mesh, this.core.mesh, this.pillar.mesh, this.halo.mesh, this.shock.mesh, this.ground.mesh);

    this.wings = new THREE.InstancedMesh(this.feather, this.wingMat, FEATHERS_PER_WING * 2);
    this.wings.frustumCulled = false;
    this.fallers = new THREE.InstancedMesh(this.feather, this.fallMat, FALLERS);
    this.fallers.frustumCulled = false;
    this.group.add(this.wings, this.fallers);
    for (let i = 0; i < FALLERS; i++) {
      this.fallSeed.push({
        x: (Math.random() - 0.5) * 7, z: (Math.random() - 0.5) * 7, ph: Math.random() * 6.28, t0: 1.0 + i * 0.12,
      });
    }

    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 1500, rate: 0, lifetime: 0.9, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.6, speed: 10, speedJitter: 0.6, spread: 85, gravity: 8, drag: 0.8,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#fff4d0', colorEnd: '#ffb02a',
      opacityStart: 0.8, opacityEnd: 0, additive: true,
    });
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 2.2, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 2.6, speed: 0.5, speedJitter: 0.5, spread: 180, gravity: -0.5, drag: 0.5,
      sizeStart: 0.17, sizeEnd: 0, colorStart: '#fff2c4', colorEnd: settings.color,
      opacityStart: 0.45, opacityEnd: 0, additive: true,
    });
    this.emitters.push(this.sparks, this.motes);
    for (const e of this.emitters) this.group.add(e.points);
    this.applyStyle();
    this.reset();
  }

  applyStyle() {
    const c = this.settings.color;
    this.pillar.color.set(c);
    this.aura.color.set(c);
    this.halo.material.color.set(c);
    this.ground.material.color.set(c);
    this.motes.settings.colorEnd = c;
    this.motes.applyStyle();
  }

  get duration() {
    return this.settings.duration;
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.slammed = false;
    this.shake = 0;
    this.caster.reset();
    this.enemy.reset();
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
    if (!this.slammed && this.time >= SLAM) {
      this.slammed = true;
      this.sparks.burst(700, CASTER_POS);
      this.shake = 0.5;
    }
    this.shake *= Math.exp(-dt * 7);
    this.layout();
  }

  private layout() {
    const s = this.settings;
    const t = this.time;
    const dur = this.duration;
    const fade = 1 - smoothstep((t - (dur - FADE)) / FADE);
    const after = Math.max(0, t - SLAM);

    // Caster is lifted and hovers; settles back down at the end.
    const rise = smoothstep((t - 0.25) / 1.0) * (1 - smoothstep((t - (dur - 1.2)) / 1.0));
    const hover = rise * (s.riseHeight + 0.12 * Math.sin(t * 2.2));
    this.caster.group.position.y = hover;
    this.caster.setFlash(t >= SLAM ? 0.7 * Math.exp(-after * 5) : 0);
    const cx = CASTER_POS.x, cz = CASTER_POS.z;

    // Column of light: head slams down in SLAM seconds, then the column lingers and thins out.
    const drop = smoothstep(t / SLAM);
    const top = 42;
    const bottom = top * (1 - drop);
    const pillarOp = t < SLAM ? 0.7 * drop : (0.65 * Math.exp(-after * 1.3) + 0.1) * fade;
    this.pillar.set(cx, cz, bottom, top, pillarOp);

    // Shockwave on the ground; the enemy recoils when it arrives.
    const shockT = after / 0.9;
    this.shock.mesh.position.set(cx, 0.04, cz);
    this.shock.mesh.scale.setScalar(Math.max(0.001, 1 + after * 22));
    this.shock.material.opacity = t >= SLAM && shockT < 1 ? 0.7 * (1 - shockT) : 0;
    const arrive = after - (CASTER_POS.z - ENEMY_POS.z) / 22;
    const kick = arrive > 0 ? Math.exp(-arrive * 2.5) * smoothstep(arrive / 0.12) : 0;
    this.enemy.group.position.z = ENEMY_POS.z - 1.8 * kick;
    this.enemy.group.rotation.x = -0.35 * kick;
    this.enemy.setFlash(0.6 * kick);

    // Hex rune on the ground under the caster.
    this.ground.mesh.position.set(cx, 0.05, cz);
    this.ground.mesh.scale.setScalar(2.4 + 0.4 * rise);
    this.ground.mesh.rotation.z = t * 0.7;
    this.ground.material.opacity = 0.5 * smoothstep((t - SLAM) / 0.4) * fade;

    // Aura shell and soft core.
    const auraIn = smoothstep((t - SLAM) / 0.5) * fade;
    this.aura.mesh.position.set(cx, 1.3 + hover, cz);
    this.aura.mesh.scale.setScalar(2.5 + 0.1 * Math.sin(t * 3));
    this.aura.opacity = (0.3 + 0.25 * Math.exp(-after * 3)) * auraIn;
    this.core.mesh.position.set(cx, 1.3 + hover, cz);
    this.core.mesh.scale.setScalar(1.6);
    this.core.opacity = (0.12 + 0.5 * Math.exp(-after * 6)) * auraIn;

    // Halo over the head.
    const haloIn = smoothstep((t - 0.55) / 0.5) * fade;
    this.halo.mesh.position.set(cx, 3.0 + hover + 0.06 * Math.sin(t * 3), cz);
    this.halo.mesh.rotation.set(-Math.PI / 2 + 0.22, 0, t * 1.2);
    this.halo.mesh.scale.setScalar(0.7 * (0.6 + 0.4 * haloIn));
    this.halo.material.opacity = 0.75 * haloIn;

    this.layoutWings(t, hover, fade);
    this.layoutFallers(t, fade);

    this.motes.points.position.set(cx, 1.3 + hover, cz);
    this.motes.settings.rate = 80 * auraIn;
  }

  private layoutWings(t: number, hover: number, fade: number) {
    const s = this.settings;
        const m = this.m;
    const beatT = Math.max(0, t - (WING_START + 1.6));
    const beat = Math.sin(beatT * 3.2) * smoothstep(beatT / 0.6);
    const up = new THREE.Vector3(0, 1, 0);
    const h = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const d = new THREE.Vector3();
    const x = new THREE.Vector3();
    const root = new THREE.Vector3();
    let idx = 0;
    for (let side = -1; side <= 1; side += 2) {
      h.set(side * Math.sin(WING_SWEEP), 0, Math.cos(WING_SWEEP));
      nrm.set(-h.z, 0, h.x);
      const shoulder = new THREE.Vector3(side * 0.25, 1.85 + hover, CASTER_POS.z + 0.4);
      for (const row of ROWS) {
        for (let i = 0; i < row.n; i++, idx++) {
          const f = i / (row.n - 1);
          const u = smoothstep((t - WING_START - row.delay - f * 0.6) / 0.9);
          const aOpen = THREE.MathUtils.degToRad(row.a0 + (row.a1 - row.a0) * f);
          const aClosed = THREE.MathUtils.degToRad(row.a0 * 0.1);
          // Beat lifts and lowers the whole fan, strongest at the tips of the wing.
          const a = aClosed + (aOpen - aClosed) * u + beat * 0.14 * (0.4 + f);
          d.copy(h).multiplyScalar(Math.sin(a)).addScaledVector(up, Math.cos(a));
          const shape = 0.7 + 0.3 * Math.sin(Math.PI * (0.15 + 0.7 * f));
          const len = s.wingSize * row.len * shape * (0.15 + 0.85 * u) * fade;
          root.copy(shoulder).addScaledVector(up, row.rootUp * s.wingSize * 0.3);
          x.crossVectors(d, nrm).normalize();
          const wid = len * row.wid;
          m.makeBasis(x.clone().multiplyScalar(wid), d.clone().multiplyScalar(Math.max(0.0001, len)), nrm);
          m.setPosition(root);
          this.wings.setMatrixAt(idx, m);
        }
      }
    }
    this.wings.instanceMatrix.needsUpdate = true;
  }

  private layoutFallers(t: number, fade: number) {
    const dn = this.dummy;
    for (let i = 0; i < FALLERS; i++) {
      const f = this.fallSeed[i];
      const age = t - f.t0;
      const life = 3.4;
      if (age < 0 || age > life) {
        dn.scale.setScalar(0.0001);
        dn.position.set(0, -50, 0);
      } else {
        dn.position.set(
          CASTER_POS.x + f.x * 0.6 + Math.sin(age * 2 + f.ph) * 0.7,
          9 - age * 2.4,
          CASTER_POS.z + f.z * 0.6 + Math.cos(age * 1.7 + f.ph) * 0.5,
        );
        dn.rotation.set(age * 1.3 + f.ph, f.ph * 3, age * 0.9);
        const sc = 0.9 * smoothstep(age / 0.4) * (1 - smoothstep((age - 2.6) / 0.8)) * fade;
        dn.scale.setScalar(Math.max(0.0001, sc));
      }
      dn.updateMatrix();
      this.fallers.setMatrixAt(i, dn.matrix);
    }
    this.fallers.instanceMatrix.needsUpdate = true;
  }
}

export const avengingWrathModule: EffectModule = {
  label: 'avenging wrath',
  category: 'paladin',
  create: () => new AvengingWrath(),
  bloom: { enabled: true, strength: 0.55, radius: 0.55, threshold: 0.82 },
  frameCamera(camera, controls) {
    // Frame on the caster (z = 14); the enemy stays at the far edge.
    // Exception to the side view: the wings spread along X, so from +X they're edge-on. Look at the caster
    // from the enemy's side (slightly left of centre) so the wings open across the screen.
    camera.position.set(4, 4.5, CASTER_POS.z - 15);
    controls.target.set(-2.5, 3.6, CASTER_POS.z);
  },
  buildGui(f, effect) {
    const a = effect as AvengingWrath;
    const s = a.settings;
    f.add(s, 'loop');
    f.add(s, 'wingSize', 2, 10, 0.1).name('wing size');
    f.add(s, 'riseHeight', 0, 4, 0.1).name('rise height');
    f.add(s, 'duration', 3, 8, 0.1);
    f.addColor(s, 'color').onChange(() => a.applyStyle());
  },
};
