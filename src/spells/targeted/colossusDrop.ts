import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { GlowSphere, LightPillar, createRing, smoothstep, softDotTexture } from '../../effects/common';
import {
  HeatHaze, ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearCinematic, clearScreenFx, createCinematic, createScreenFx, flashBeat,
  impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Colossus Drop (targeted cinematic ultimate, up to 8 enemies, ~45 s): the caster fires an orange signal flare, a
 * red targeting ring is painted on the arena, and a ten-metre steel mech drops from orbit behind a heat shield, brakes
 * on cyan retro-thrusters and slams down behind the enemies. It stands, its visor lights, its chest cannon opens in
 * two charge stages, a dead beat, then a thick beam sweeps left to right across every enemy (one hit each as the beam
 * crosses it, plus a small hit from the landing), and the mech climbs out of the sky on its thrusters.
 *
 * Camera: scripted with `cinematic` (hard cuts, held shots, letterbox in/out). The real caster is never moved or hidden.
 * Every shot is framed inside the letterbox (about 75% of the height).
 *
 * Recipes: a-ow-doomfist-meteor-strike (landing marked on the ground from above), a-val-brimstone-orbital-strike (a
 * strike called from orbit), g-castorice-dragon-breath-crater (over-the-shoulder beam, stage switches marked by one
 * inverted frame), a-lol-lux-final-spark (long charge, short thick release beam), VFX_PRINCIPLES section 10.
 *
 * Timeline (script seconds, scaled by duration / 45):
 *  0 call (flare) | 2.8 ring from above | 5 drop | 12.9 retro-thrusters | 15 landing | 17.2 reveal | 21.4 over the
 *  shoulder | 24.6 stance | 27.2 charge | 32.6 stage 2 | 35.4 dead beat | 36 fire, sweep 36.3-38.9 | 39.6 exit |
 *  42.6 calm wide | 45 end
 */
export interface ColossusDropSettings {
  /** Total length in seconds; every act scales with it. */
  duration: number;
  /** Beam damage per enemy. */
  damage: number;
  /** Landing damage per enemy. */
  landDamage: number;
  loop: boolean;
}

export const defaultColossusDrop = (): ColossusDropSettings => ({ duration: 45, damage: 90, landDamage: 10, loop: false });

const BASE_DURATION = 45;
const MAX_TARGETS = 8;
const CLOUDS = 22;
const WALLS = 14;
const PARTS = 150;

const U = {
  flare: 1.6, ring: 2.8, ringOn: 3.0, fall: 5, fallB: 8.2, fallC: 10.6, brake: 12.9, land: 15, reveal: 17.2, shoulder: 21.4,
  stance: 24.6, charge: 27.2, wide: 30.2, st2: 32.6, dead: 35.4, fire: 36, sweep0: 36.3, sweep1: 38.9, side: 37.6,
  exit: 39.6, rise: 40.4, calm: 42.6, end: 45,
};

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function ramp(u: number, pts: readonly (readonly [number, number])[]): number {
  if (u <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (u <= pts[i][0]) {
      const a = pts[i - 1], b = pts[i];
      const d = b[0] - a[0];
      return d <= 1e-6 ? b[1] : a[1] + ((b[1] - a[1]) * (u - a[0])) / d;
    }
  }
  return pts[pts.length - 1][1];
}

/** Height of the mech's feet above the ground, script time: falls from orbit, brakes, stands, climbs away. */
function mechY(u: number): number {
  if (u < U.fall) return 340;
  if (u < U.brake) {
    const p = (u - U.fall) / (U.brake - U.fall);
    return 70 + 270 * (1 - Math.pow(p, 1.8));
  }
  if (u < U.land) {
    const q = (u - U.brake) / (U.land - U.brake);
    return 70 * Math.pow(1 - q, 1.7);
  }
  if (u < U.rise) return 0;
  const a = (u - U.rise) / 3;
  return 150 * a * a;
}

// --- Textures --------------------------------------------------------------------------------------------

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cloudTexture() {
  return canvasTexture(128, 128, (c) => {
    for (let i = 0; i < 9; i++) {
      const x = 64 + (Math.random() - 0.5) * 56, y = 64 + (Math.random() - 0.5) * 30, r = 22 + Math.random() * 26;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    }
  });
}

/** A dark scorch disc with jagged orange cracks (a ground decal for the landing). */
function crackTexture() {
  return canvasTexture(512, 512, (c) => {
    const g = c.createRadialGradient(256, 256, 0, 256, 256, 250);
    g.addColorStop(0, 'rgba(8,10,14,0.85)');
    g.addColorStop(0.7, 'rgba(8,10,14,0.55)');
    g.addColorStop(1, 'rgba(8,10,14,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 512);
    c.strokeStyle = '#ff8a2a';
    c.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      let a = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
      let x = 256, y = 256;
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        a += (Math.random() - 0.5) * 0.7;
        const step = 22 + Math.random() * 18;
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
        c.lineTo(x, y);
        c.lineWidth = Math.max(1.5, 6 - s * 0.6);
      }
      c.stroke();
    }
  });
}

// --- Shared geometry ------------------------------------------------------------------------------------

const boxCache = new Map<string, THREE.BoxGeometry>();
function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `${w},${h},${d}`;
  let g = boxCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    boxCache.set(key, g);
  }
  return g;
}

/** Cone with its wide base at y = 0 and its apex at y = -1 (a jet pointing down). */
const JET_GEO = new THREE.ConeGeometry(1, 1, 14, 1, true).rotateX(Math.PI).translate(0, -0.5, 0);
/** Open shell: radius 1 at y = 0 narrowing to 0.1 at y = 1 (the re-entry sheath trailing upward). */
const SHELL_GEO = new THREE.CylinderGeometry(0.1, 1, 1, 20, 1, true).translate(0, 0.5, 0);
/** Lower hemisphere of radius 1 (the heat shield bowls). */
const BOWL_GEO = new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const BEAM_GEO = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true).translate(0, 0.5, 0);
const BALL_GEO = new THREE.SphereGeometry(1, 14, 10);

/** Cyan toon retro-thruster flame: three nested flat cones pointing down from the group origin. */
class Jet {
  readonly group = new THREE.Group();
  private layers: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; r: number; l: number; o: number }[] = [];
  private seed = Math.random() * 10;

  constructor() {
    const defs = [
      { color: new THREE.Color(0x1f8fb0), r: 1, l: 1, o: 0.8, order: 20 },
      { color: new THREE.Color(0x7ff0ff).multiplyScalar(1.2), r: 0.62, l: 0.8, o: 0.9, order: 21 },
      { color: new THREE.Color(0xe8ffff), r: 0.28, l: 0.55, o: 0.9, order: 22 },
    ];
    for (const d of defs) {
      const mat = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(JET_GEO, mat);
      mesh.renderOrder = d.order;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.layers.push({ mesh, mat, r: d.r, l: d.l, o: d.o });
    }
    this.group.visible = false;
  }

  set(len: number, rad: number, op: number, t: number) {
    const on = op > 0.01 && len > 0.05;
    this.group.visible = on;
    if (!on) return;
    const fl = 1 + 0.09 * Math.sin(t * 61 + this.seed) + 0.05 * Math.sin(t * 97 + this.seed * 2);
    for (const l of this.layers) {
      l.mesh.scale.set(Math.max(1e-3, rad * l.r), Math.max(1e-3, len * l.l * fl), Math.max(1e-3, rad * l.r));
      l.mat.opacity = l.o * op;
    }
  }
}

/** The pool of cloud / dust quads that always face the camera. */
class QuadField {
  readonly group = new THREE.Group();
  private quads: THREE.Mesh[] = [];
  private mat: THREE.MeshBasicMaterial;
  private tmp = new THREE.Quaternion();

  constructor(count: number, tex: THREE.Texture, color: number, geo: THREE.PlaneGeometry) {
    this.mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, this.mat);
      m.visible = false;
      m.frustumCulled = false;
      this.quads.push(m);
      this.group.add(m);
    }
  }

  set opacity(v: number) {
    this.mat.opacity = v;
  }

  place(i: number, pos: THREE.Vector3, w: number, h: number, rot: number, camQ: THREE.Quaternion) {
    const m = this.quads[i];
    m.visible = true;
    m.position.copy(pos);
    m.scale.set(w, h, 1);
    m.quaternion.copy(camQ).multiply(this.tmp.setFromAxisAngle(Z_AXIS, rot));
  }

  hideAll() {
    for (const m of this.quads) m.visible = false;
  }
}

// --- The mech ----------------------------------------------------------------------------------------------

/**
 * ~10.5 m tall, feet at y = 0, facing +Z: armoured torso, pauldrons, a head with a visor, arms, legs, a chest cannon
 * with four sliding panels. Steel #6a7a8a and dark #2a3038 with orange warning stripes; only the visor, the cannon
 * core and the thruster flames glow (everything else stays below the bloom threshold).
 */
class Mech {
  readonly group = new THREE.Group();
  readonly footJets: Jet[] = [];
  readonly backJets: Jet[] = [];
  private arms: { g: THREE.Group; s: number }[] = [];
  private panels: { mesh: THREE.Mesh; sx: number; sy: number; base: THREE.Vector3 }[] = [];
  private visorMat = new THREE.MeshBasicMaterial({ color: 0x0e1218 });
  private coreMat = new THREE.MeshBasicMaterial({ color: 0x0e1218 });
  private shieldMats: THREE.MeshBasicMaterial[] = [];
  private plumeMats: THREE.MeshBasicMaterial[] = [];
  private shield = new THREE.Group();
  private plume = new THREE.Group();
  private visorOff = new THREE.Color(0x0e1218);
  private visorOn = new THREE.Color(0x7ff0ff).multiplyScalar(1.6);

  constructor() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x6a7a8a, metalness: 0.45, roughness: 0.55, emissive: 0x6a7a8a, emissiveIntensity: 0.14 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.5, roughness: 0.5, emissive: 0x2a3038, emissiveIntensity: 0.25 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xe0701a, metalness: 0.2, roughness: 0.6, emissive: 0xe0701a, emissiveIntensity: 0.1 });
    const g = this.group;
    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    const cyl = (r: number, h: number, seg = 16) => new THREE.CylinderGeometry(r, r, h, seg);
    const kneeGeo = cyl(0.8, 1.9).rotateZ(Math.PI / 2);
    const hipGeo = new THREE.SphereGeometry(0.85, 14, 10);

    for (const s of [-1, 1]) {
      const x = s * 1.75;
      // Leg: foot, shin with hazard stripes, knee, thigh, hip.
      part(boxGeo(2, 0.8, 3.2), dark, x, 0.4, 0.5);
      part(boxGeo(2.04, 0.18, 0.5), orange, x, 0.55, 1.75);
      part(boxGeo(1.5, 2.5, 1.7), steel, x, 2.05, 0);
      part(boxGeo(1.6, 1.6, 0.3), dark, x, 2.3, 0.95);
      for (let i = 0; i < 3; i++) {
        const st = part(boxGeo(1.62, 0.16, 0.1), orange, x, 1.7 + i * 0.4, 1.14);
        st.rotation.z = i % 2 ? -0.45 : 0.45;
      }
      part(kneeGeo, dark, x, 3.45, 0.2);
      part(boxGeo(1.2, 1, 0.5), steel, x, 3.5, 1.0);
      part(boxGeo(1.7, 2.2, 1.9), steel, x, 4.65, 0);
      part(hipGeo, dark, s * 1.9, 5.7, 0);
      // Shoulder pauldron: a rounded dome, a flat plate and an orange ring.
      const pauldron = new THREE.Group();
      pauldron.position.set(s * 3.15, 9.0, 0);
      g.add(pauldron);
      const dome = part(new THREE.SphereGeometry(1.25, 14, 10), steel, 0, 0, 0, pauldron);
      dome.scale.set(1, 0.8, 1.1);
      part(boxGeo(2.4, 0.3, 2.5), dark, 0, 0.8, 0, pauldron);
      part(boxGeo(2.2, 0.9, 2.3), dark, 0, 0.35, 0, pauldron).scale.setScalar(0.9);
      const ring = part(new THREE.TorusGeometry(1.2, 0.12, 6, 20), orange, 0, -0.2, 0, pauldron);
      ring.rotation.x = Math.PI / 2;
      // Arm (pivots at the shoulder): upper arm, elbow, forearm with an orange cuff, fist.
      const arm = new THREE.Group();
      arm.position.set(s * 3.15, 8.7, 0);
      g.add(arm);
      part(cyl(0.6, 2.1), steel, 0, -1.2, 0, arm);
      part(new THREE.SphereGeometry(0.65, 12, 8), dark, 0, -2.4, 0, arm);
      part(boxGeo(1.15, 2.4, 1.4), steel, 0, -3.7, 0, arm);
      part(boxGeo(1.2, 0.25, 1.45), orange, 0, -2.85, 0, arm);
      part(boxGeo(1.1, 1.1, 1.3), dark, 0, -5.2, 0, arm);
      this.arms.push({ g: arm, s });
    }

    // Pelvis, waist, chest, back, neck, head.
    part(boxGeo(4.6, 0.9, 2.6), dark, 0, 5.95, 0);
    part(boxGeo(1.4, 1, 0.4), steel, 0, 5.7, 1.35);
    part(cyl(1.2, 0.8), dark, 0, 6.7, 0);
    part(boxGeo(4.6, 2.5, 3), steel, 0, 8.1, 0);
    for (const s of [-1, 1]) part(boxGeo(1.4, 1.8, 0.3), dark, s * 1.5, 8.4, 1.6);
    part(boxGeo(4.4, 0.5, 0.1), dark, 0, 6.95, 1.52);
    for (let i = -3; i <= 3; i++) {
      const st = part(boxGeo(0.5, 0.36, 0.1), orange, i * 0.62, 6.95, 1.58);
      st.rotation.z = 0.5;
    }
    part(boxGeo(3.2, 3, 1.3), dark, 0, 8, -2);
    part(cyl(0.5, 0.5), dark, 0, 9.45, 0);
    part(boxGeo(1.5, 1.1, 1.5), steel, 0, 10, 0.05);
    part(boxGeo(0.3, 0.5, 1.4), dark, 0, 10.7, -0.1);
    part(boxGeo(1, 0.35, 0.5), dark, 0, 9.58, 0.7);
    part(boxGeo(1.2, 0.3, 0.15), this.visorMat, 0, 10.02, 0.83);
    for (const s of [-1, 1]) {
      part(cyl(0.3, 0.3, 10).rotateZ(Math.PI / 2), dark, s * 0.85, 10, 0);
      part(boxGeo(0.1, 2.2, 0.1), dark, s * 1.4, 10, -2.2);
      // Back thruster nozzles.
      part(cyl(0.55, 1.2), steel, s * 0.9, 7.1, -2.2);
    }

    // Chest cannon: open housing, glowing core, flange and four sliding panels.
    const housing = new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.5, roughness: 0.5, emissive: 0x2a3038, emissiveIntensity: 0.25, side: THREE.DoubleSide });
    part(new THREE.CylinderGeometry(1.25, 1.25, 0.7, 24, 1, true).rotateX(Math.PI / 2), housing, 0, 8, 1.6);
    part(new THREE.CircleGeometry(1.15, 24), this.coreMat, 0, 8, 1.4);
    part(new THREE.TorusGeometry(1.28, 0.12, 6, 28), orange, 0, 8, 1.95);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const base = v3(sx * 0.6, 8 + sy * 0.6, 2.05);
        const mesh = part(boxGeo(1.2, 1.2, 0.14), steel, base.x, base.y, base.z);
        const st = part(boxGeo(1.25, 0.16, 0.16), orange, 0, -sy * 0.25, 0.05, mesh);
        st.rotation.z = sx * sy * 0.5;
        this.panels.push({ mesh, sx, sy, base });
      }
    }

    // Jets: under each foot and below the back nozzles.
    for (const s of [-1, 1]) {
      const fj = new Jet();
      fj.group.position.set(s * 1.75, 0.05, 0.5);
      g.add(fj.group);
      this.footJets.push(fj);
      const bj = new Jet();
      bj.group.position.set(s * 0.9, 6.5, -2.2);
      g.add(bj.group);
      this.backJets.push(bj);
    }

    // Re-entry: toon heat-shield bowls under the feet and a sheath trailing upward.
    const bowls: [number, number][] = [[4.6, 0xd8420f], [3.4, 0xff8a2a], [2.2, 0xffd27a]];
    bowls.forEach(([r, hex], i) => {
      const mat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(BOWL_GEO, mat);
      m.scale.set(r, r * 0.5, r);
      m.renderOrder = 10 + i;
      this.shield.add(m);
      this.shieldMats.push(mat);
    });
    this.shield.position.y = 0.4;
    g.add(this.shield);
    const shells: [number, number, number][] = [[4.4, 55, 0xd8420f], [3.4, 42, 0xff8a2a], [2.4, 30, 0xffc060]];
    shells.forEach(([r, h, hex], i) => {
      const mat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(SHELL_GEO, mat);
      m.scale.set(r, h, r);
      m.renderOrder = 13 + i;
      m.frustumCulled = false;
      this.plume.add(m);
      this.plumeMats.push(mat);
    });
    this.plume.position.y = 0.4;
    g.add(this.plume);
    g.visible = false;
  }

  /** Arms forward (0..1), cannon panels open (0..1), visor light, cannon core light. */
  pose(arms: number, open: number, visor: number, core: number) {
    for (const a of this.arms) {
      a.g.rotation.x = -arms * 0.9;
      a.g.rotation.z = a.s * (0.08 + 0.3 * arms);
    }
    for (const p of this.panels) p.mesh.position.set(p.base.x + p.sx * open * 1.05, p.base.y + p.sy * open * 1.05, p.base.z);
    this.visorMat.color.lerpColors(this.visorOff, this.visorOn, clamp(visor, 0, 1));
    this.coreMat.color.lerpColors(this.visorOff, this.visorOn, clamp(core, 0, 1));
  }

  /** Re-entry glow 0..1: the heat-shield bowls and the trailing sheath. */
  heat(v: number, t: number) {
    this.shield.visible = v > 0.01;
    this.plume.visible = v > 0.01;
    const f = 1 + 0.06 * Math.sin(t * 40);
    this.shield.scale.setScalar(f);
    const sh = [0.9, 0.95, 0.9];
    this.shieldMats.forEach((m, i) => { m.opacity = sh[i] * v; });
    const pl = [0.2, 0.2, 0.18];
    this.plumeMats.forEach((m, i) => { m.opacity = pl[i] * v; });
    this.plume.scale.set(1, 1 + 0.05 * Math.sin(t * 33), 1);
  }
}

// --- The effect ------------------------------------------------------------------------------------------

export class ColossusDrop implements Effect {
  readonly group = new THREE.Group();
  readonly settings: ColossusDropSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private kick = 0;
  private landDone = false;
  private keys: ShotKey[] = [];
  private chClock = 0;
  private ventClock = 0;
  private theta = 0;

  // Cast geometry.
  private P = v3(0, 0, 14);
  private C = v3();
  private M = v3(0, 0, 4);
  private fwd = v3(0, 0, -1);
  private right = v3(1, 0, 0);
  private baseYaw = Math.PI;
  private targetSil: THREE.Object3D[] = [];
  /** Targets in sweep order (left to right as the mech sees them). */
  private order: { idx: number; pos: THREE.Vector3 }[] = [];
  private pathPts: THREE.Vector3[] = [];
  private cum: number[] = [0];
  private pathLen = 1;
  private uHit: number[] = [];
  private beamDone: boolean[] = [];
  private smokeDone: boolean[] = [];
  private boomT: number[] = [];
  private landT = 0;

  // Camera helper for billboards.
  private camHelp = new THREE.PerspectiveCamera();
  private camForward = v3();

  // Sky and clouds.
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private clouds: QuadField;
  private cloudSeed = Array.from({ length: CLOUDS }, () => ({
    a: Math.random() * Math.PI * 2, d: 10 + Math.random() * 60, y: 70 + Math.random() * 270, s: 22 + Math.random() * 26, r: Math.random() * 6.28,
  }));

  // The mech and its VFX.
  private mech = new Mech();
  private oc = v3();
  private ball = new GlowSphere(0x7ff0ff, { rim: false });
  private ballCore = new GlowSphere(0xffffff, { rim: false });
  private chargeRings: { g: THREE.Group; ring: ReturnType<typeof createRing> }[] = [];
  private cleanRing = createRing(0x7ff0ff, 0.94, 1, 64);
  private cleanRingG = new THREE.Group();
  private partGeo = new THREE.BufferGeometry();
  private partPos = new Float32Array(PARTS * 3);
  private partMat = new THREE.PointsMaterial({
    size: 0.26, map: softDotTexture(), color: 0x7ff0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private parts: THREE.Points;
  private partSeed = Array.from({ length: PARTS }, () => ({ dir: v3().randomDirection(), ph: Math.random() }));

  // Call: flare and targeting ring.
  private flareGlow = new GlowSphere(0xff8a2a, { rim: false });
  private flareStar = new StarBurst({ points: 4, inner: 0.14, color: 0xff8a2a, core: 0xffe9c0, additive: false });
  private flareTrail = new LightPillar(0xff8a2a, 0.12);
  private signal = new LightPillar(0xff5a2a, 0.35);
  private retG = new THREE.Group();
  private retUnder: THREE.Mesh;
  private retOuter = createRing(0xff4a2a, 0.94, 1, 96);
  private retHex = createRing(0xff8a2a, 0.9, 1, 6);
  private chevrons: THREE.Group;

  // Landing.
  private landRing = createRing(0xffc060, 0.9, 1, 96);
  private landRing2 = createRing(0xff6a1f, 0.94, 1, 96);
  private landShock = new ShockRefraction({ facing: 'ground', width: 0.3 });
  private jetHaze = new HeatHaze({ width: 7, height: 12 });
  private landStar = new StarBurst({ points: 12, inner: 0.22, color: 0xff8a2a, core: 0xffd27a, additive: false });
  private crack: THREE.Mesh;
  private crackMat: THREE.MeshBasicMaterial;
  private walls: QuadField;
  private wallSeed = Array.from({ length: WALLS }, (_, i) => ({ a: (i / WALLS) * Math.PI * 2 + Math.random() * 0.3, h: 6 + Math.random() * 5, r: Math.random() * 6.28, y: Math.random() * 2 }));

  // Beam.
  private beamDark: THREE.Mesh;
  private beamBody: THREE.Mesh;
  private beamCore: THREE.Mesh;
  private muzzle = new GlowSphere(0x7ff0ff, { rim: false });
  private muzzleStar = new StarBurst({ points: 8, inner: 0.2, color: 0x7ff0ff, core: 0xe8ffff, additive: false });
  private endRing = createRing(0x7ff0ff, 0.88, 1, 48);
  private endStar = new StarBurst({ points: 8, inner: 0.2, color: 0xff8a2a, core: 0xffd27a, additive: false });
  private scorch: { dark: THREE.Mesh; glow: THREE.Mesh }[] = [];
  private booms: { fire: THREE.Mesh; core: THREE.Mesh; fireMat: THREE.MeshBasicMaterial; coreMat: THREE.MeshBasicMaterial; ring: ReturnType<typeof createRing>; star: StarBurst }[] = [];
  private smoke = new SmokeBall({ maxBalls: MAX_TARGETS + 3 });

  // Emitters.
  private sparks: Emitter;
  private dust: Emitter;
  private steam: Emitter;
  private embers: Emitter;
  private trail: Emitter;

  private tmpA = v3();
  private tmpB = v3();
  private tmpC = new THREE.Color();
  private tmpQ = new THREE.Quaternion();
  private tmpD = v3();

  constructor(settings: ColossusDropSettings = defaultColossusDrop()) {
    this.settings = settings;
    this.screen.tint.set(0x40508a);
    this.screen.impactColor.set(0xff8a2a);
    this.screen.whiteColor.set(0xdff8ff);
    this.screen.speedLineColor.set(0xffb060);
    this.screen.edgeTint.set(0xff8a2a);

    // Sky dome follows the camera (the scene background is not a believable sky for a drop from orbit).
    this.skyMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide,
      uniforms: { uTop: { value: new THREE.Color(0x101830) }, uHor: { value: new THREE.Color(0x3a3040) }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHor; uniform float uOpacity; varying vec3 vDir;
        void main() { gl_FragColor = vec4(mix(uHor, uTop, smoothstep(-0.05, 0.7, vDir.y)), uOpacity); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), this.skyMat);
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);

    this.clouds = new QuadField(CLOUDS, cloudTexture(), 0x7a8498, new THREE.PlaneGeometry(1, 1));
    this.walls = new QuadField(WALLS, cloudTexture(), 0x6a5a50, new THREE.PlaneGeometry(1, 1));
    this.group.add(this.clouds.group, this.walls.group, this.mech.group);

    // Emitters (burst only).
    const em = (over: Partial<ReturnType<typeof defaultSettings>>) => {
      const e = new Emitter({ ...defaultSettings(), rate: 0, shape: 'sphere', ...over });
      this.group.add(e.points);
      return e;
    };
    this.sparks = em({
      maxParticles: 600, lifetime: 0.9, lifetimeJitter: 0.4, shapeSize: 0.3, speed: 13, speedJitter: 0.6, spread: 100, gravity: 9, drag: 0.6,
      sizeStart: 0.22, sizeEnd: 0.03, colorStart: '#fff4d6', colorEnd: '#ff6a1f', colorMid: '#ffc247', opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3,
    });
    this.dust = em({
      maxParticles: 450, lifetime: 3, lifetimeJitter: 0.4, shapeSize: 2.5, speed: 8, speedJitter: 0.6, spread: 85, gravity: -0.1, drag: 1.5,
      sizeStart: 2.2, sizeEnd: 5, colorStart: '#6a5a50', colorEnd: '#2a2220', opacityStart: 0.42, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.6, spin: 0.4, groundFade: 0.4,
    });
    this.steam = em({
      maxParticles: 220, lifetime: 1.8, lifetimeJitter: 0.4, shapeSize: 0.25, speed: 3, speedJitter: 0.5, spread: 22, gravity: -0.5, drag: 0.8,
      sizeStart: 0.6, sizeEnd: 1.8, colorStart: '#e8eef2', colorEnd: '#8a949c', opacityStart: 0.5, opacityEnd: 0, additive: false, sizeJitter: 0.4, erosion: 0.5, spin: 0.3,
    });
    this.embers = em({
      maxParticles: 260, lifetime: 2.6, lifetimeJitter: 0.4, shapeSize: 0.4, speed: 1.2, speedJitter: 0.7, spread: 60, gravity: -0.4, drag: 0.6,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#ffe08a', colorEnd: '#7a2a08', colorMid: '#ff7a2a', opacityStart: 0.75, opacityEnd: 0, additive: true, sizeJitter: 0.4, groundFade: 0.15,
    });
    this.trail = em({
      maxParticles: 260, lifetime: 1.6, lifetimeJitter: 0.3, shapeSize: 3, speed: 1.5, speedJitter: 0.5, spread: 180, gravity: 0, drag: 0.3,
      sizeStart: 0.55, sizeEnd: 0.1, colorStart: '#ffc060', colorEnd: '#a02a0a', opacityStart: 0.6, opacityEnd: 0, additive: true, sizeJitter: 0.4,
    });
    this.emitters.push(this.sparks, this.dust, this.steam, this.embers, this.trail, this.smoke.emitter);
    this.group.add(this.smoke.mesh);

    // Charge: rings that contract onto the cannon, a ball and inward-flying motes.
    for (let i = 0; i < 3; i++) {
      const ring = createRing(0x7ff0ff, 0.92, 1, 64);
      ring.mesh.rotation.set(0, 0, 0);
      ring.mesh.position.set(0, 0, 0);
      const g = new THREE.Group();
      g.add(ring.mesh);
      this.chargeRings.push({ g, ring });
      this.group.add(g);
    }
    this.cleanRing.mesh.rotation.set(0, 0, 0);
    this.cleanRing.mesh.position.set(0, 0, 0);
    this.cleanRingG.add(this.cleanRing.mesh);
    this.partGeo.setAttribute('position', new THREE.BufferAttribute(this.partPos, 3));
    this.parts = new THREE.Points(this.partGeo, this.partMat);
    this.parts.frustumCulled = false;
    this.parts.visible = false;
    this.group.add(this.ball.mesh, this.ballCore.mesh, this.cleanRingG, this.parts);

    // Call: flare and the targeting reticle.
    this.retUnder = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x0e1218, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    this.retUnder.position.y = 0.03;
    this.chevrons = new THREE.Group();
    const tri = new THREE.Shape();
    tri.moveTo(-1, 0);
    tri.lineTo(1, 0.7);
    tri.lineTo(1, -0.7);
    tri.closePath();
    const triGeo = new THREE.ShapeGeometry(tri).rotateX(-Math.PI / 2);
    const triMat = new THREE.MeshBasicMaterial({ color: 0xff6a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = (i * Math.PI) / 2;
      const m = new THREE.Mesh(triGeo, triMat);
      m.position.set(1, 0.05, 0);
      m.userData.mat = triMat;
      arm.add(m);
      this.chevrons.add(arm);
    }
    this.retHex.mesh.position.y = 0.05;
    this.retG.add(this.retUnder, this.retOuter.mesh, this.retHex.mesh, this.chevrons);
    this.group.add(
      this.retG, this.flareGlow.mesh, this.flareStar.mesh, this.flareTrail.mesh, this.signal.mesh,
    );

    // Landing.
    this.crackMat = new THREE.MeshBasicMaterial({
      map: crackTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    this.crack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.crackMat);
    this.crack.rotation.x = -Math.PI / 2;
    this.crack.visible = false;
    this.group.add(this.crack, this.landRing.mesh, this.landRing2.mesh, this.landStar.mesh, this.landShock.mesh, this.jetHaze.mesh);

    // Beam: a dark under-beam, a cyan body and a pale core.
    const beamMat = (color: number, op: number, additive: boolean, order: number) => {
      const m = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(BEAM_GEO, m);
      mesh.renderOrder = order;
      mesh.frustumCulled = false;
      mesh.visible = false;
      return mesh;
    };
    this.beamDark = beamMat(0x0e1218, 0.85, false, 5);
    this.beamBody = beamMat(0x7ff0ff, 0.5, true, 6);
    this.beamCore = beamMat(0xe8ffff, 0.55, true, 7);
    this.group.add(this.beamDark, this.beamBody, this.beamCore, this.muzzle.mesh, this.muzzleStar.mesh, this.endRing.mesh, this.endStar.mesh);

    // Scorch line along the sweep and one toon fireball per enemy.
    const scorchGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_TARGETS + 2; i++) {
      const dark = new THREE.Mesh(scorchGeo, new THREE.MeshBasicMaterial({
        color: 0x0e1218, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }));
      const glow = new THREE.Mesh(scorchGeo, new THREE.MeshBasicMaterial({
        color: 0xff6a1f, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      }));
      dark.visible = glow.visible = false;
      this.scorch.push({ dark, glow });
      this.group.add(dark, glow);
    }
    for (let i = 0; i < MAX_TARGETS; i++) {
      const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, depthWrite: false });
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false });
      const fire = new THREE.Mesh(BALL_GEO, fireMat);
      const core = new THREE.Mesh(BALL_GEO, coreMat);
      fire.visible = core.visible = false;
      fire.renderOrder = 8;
      core.renderOrder = 9;
      const ring = createRing(0xff8a2a, 0.88, 1, 48);
      const star = new StarBurst({ points: 8, inner: 0.2, color: 0xff8a2a, core: 0xffd27a, additive: false });
      this.booms.push({ fire, core, fireMat, coreMat, ring, star });
      this.group.add(fire, core, ring.mesh, star.mesh);
    }
    this.reset();
  }

  get duration() {
    return this.settings.duration;
  }

  private get k() {
    return this.settings.duration / BASE_DURATION;
  }

  /** Beam arrival on the first / last target, in seconds after play(). */
  get impactTime() {
    return U.land * this.k;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.P.copy(ctx.from).setY(0);
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    this.C.set(0, 0, 0);
    for (const p of pts) this.C.add(p);
    this.C.divideScalar(pts.length).setY(0);
    this.fwd.copy(this.C).sub(this.P).setY(0);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.right.set(-this.fwd.z, 0, this.fwd.x);
    this.baseYaw = Math.atan2(this.fwd.x, this.fwd.z);

    // Landing site: 9 m behind the rearmost enemy (seen from the caster), never on top of the caster.
    let minF = Infinity;
    for (const p of pts) minF = Math.min(minF, this.tmpA.copy(p).sub(this.C).dot(this.fwd));
    this.M.copy(this.C).addScaledVector(this.fwd, minF - 9).setY(0);
    if (this.M.distanceTo(this.P) < 7.5) this.M.copy(this.P).addScaledVector(this.fwd, 7.5);

    // Sweep order and path: enemies sorted left to right (as the mech sees them), extended 3.5 m past both ends.
    this.order = pts
      .map((p, idx) => ({ idx, pos: p.clone().setY(0), lat: this.tmpA.copy(p).sub(this.M).dot(this.right) }))
      .sort((a, b) => a.lat - b.lat)
      .map(({ idx, pos }) => ({ idx, pos }));
    const first = this.order[0].pos, last = this.order[this.order.length - 1].pos;
    this.pathPts = [first.clone().addScaledVector(this.right, -3.5), ...this.order.map((o) => o.pos.clone()), last.clone().addScaledVector(this.right, 3.5)];
    this.cum = [0];
    for (let i = 1; i < this.pathPts.length; i++) this.cum.push(this.cum[i - 1] + this.pathPts[i].distanceTo(this.pathPts[i - 1]));
    this.pathLen = Math.max(1, this.cum[this.cum.length - 1]);
    this.uHit = this.order.map((_, j) => this.uAtArc(this.cum[j + 1]));
    this.beamDone = this.order.map(() => false);
    this.smokeDone = this.order.map(() => false);
    this.boomT = this.order.map(() => 0);

    this.targetSil = ctx.targets.map((e) => e.group);
    this.screen.silhouettes = [this.mech.group, ...this.targetSil];

    this.retG.position.set(this.M.x, 0, this.M.z);
    this.crack.position.set(this.M.x, 0.03, this.M.z);
    this.crack.scale.setScalar(26);
    this.buildKeys();
    this.reset();
  }

  /** Script time at which the beam end has travelled `arc` metres along the path. */
  private uAtArc(arc: number) {
    return U.sweep0 + (arc / this.pathLen) * (U.sweep1 - U.sweep0);
  }

  /** Beam end on the ground at script time u (travels the path linearly). */
  private pathAt(u: number, out: THREE.Vector3) {
    if (this.pathPts.length < 2) return out.copy(this.M);
    const s = clamp((u - U.sweep0) / (U.sweep1 - U.sweep0), 0, 1) * this.pathLen;
    let i = 0;
    while (i < this.cum.length - 2 && this.cum[i + 1] < s) i++;
    const seg = Math.max(1e-4, this.cum[i + 1] - this.cum[i]);
    return out.lerpVectors(this.pathPts[i], this.pathPts[i + 1], clamp((s - this.cum[i]) / seg, 0, 1));
  }

  /** Danger zones: the landing circle and one strip per sweep segment, each lit until the beam has passed. */
  telegraphSpecs(): TelegraphSpec[] {
    if (!this.ctx) return [];
    const k = this.k;
    const out: TelegraphSpec[] = [
      { shape: { kind: 'circle', x: this.M.x, z: this.M.z, radius: 6.5 }, start: U.ringOn * k, impact: U.land * k },
    ];
    for (let i = 0; i < this.pathPts.length - 1; i++) {
      const a = this.pathPts[i], b = this.pathPts[i + 1];
      out.push({
        shape: { kind: 'line', x1: a.x, z1: a.z, x2: b.x, z2: b.z, width: 3.2 },
        start: U.charge * k,
        impact: this.uAtArc(this.cum[i]) * k,
        until: this.uAtArc(this.cum[i + 1]) * k + 0.2,
      });
    }
    return out;
  }

  /** Pulls a low camera out of the enemies' bodies. */
  private keepClear(pos: THREE.Vector3) {
    for (const p of this.ctx?.targetPos ?? []) {
      const dx = pos.x - p.x, dz = pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.8) {
        if (d > 1e-3) { pos.x = p.x + (dx / d) * 2.8; pos.z = p.z + (dz / d) * 2.8; }
        else pos.x = p.x + 2.8;
      }
    }
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    const P = this.P, M = this.M, C = this.C, f = this.fwd, r = this.right;
    const add = (t: number, pos: THREE.Vector3, target: THREE.Vector3, fov: number, o: { cut?: boolean; ease?: ShotKey['ease'] } = {}) => {
      if (pos.y < 5) this.keepClear(pos);
      keys.push({ t, position: pos, target, fov, roll: 0, cut: o.cut, ease: o.ease });
    };
    /** base + f * fw + r * rt + (0, y, 0) */
    const pf = (base: THREE.Vector3, fw: number, rt: number, y: number) =>
      base.clone().addScaledVector(f, fw).addScaledVector(r, rt).add(v3(0, y, 0));
    const up = (base: THREE.Vector3, x: number, y: number, z: number) => base.clone().add(v3(x, y, z));
    const mw = (t: number) => up(M, 0, mechY(t), 0);
    /** A shot that follows something: one key every `step` seconds, a cut at the start. */
    const track = (t0: number, t1: number, step: number, make: (t: number) => [THREE.Vector3, THREE.Vector3, number]) => {
      for (let t = t0; t < t1 - 1e-6; t += step) {
        const [p, tg, fov] = make(t);
        add(t, p, tg, fov, { cut: t === t0, ease: 'linear' });
      }
      const [p, tg, fov] = make(t1 - 0.001);
      add(t1 - 0.001, p, tg, fov, { ease: 'linear' });
    };
    const mid = M.clone().lerp(C, 0.5).setY(0);

    // 1. Call: close on the caster (the flare launches), then the ring painted on the arena from above.
    add(0, pf(P, 7.2, 2.6, 0.9), up(P, 0, 2.2, 0), 40);
    add(U.flare, pf(P, 7.0, 2.5, 0.9), up(P, 0, 2.4, 0), 40, { ease: 'linear' });
    add(U.ring - 0.001, pf(P, 6.6, 2.3, 0.9), up(P, 0, 4.2, 0), 40, { ease: 'inOut' });
    add(U.ring, pf(M, -17, 15, 20), up(M, 0, 0, 0), 48, { cut: true });
    add(U.fall - 0.001, pf(M, -14, 12, 16), up(M, 0, 0, 0), 48, { ease: 'linear' });

    // 2. Drop: beside the falling mech, from its front, then from the ground looking up as it grows.
    track(U.fall, U.fallB, 0.25, (t) => [mw(t).addScaledVector(r, 28).addScaledVector(f, 6).add(v3(0, -2, 0)), mw(t).add(v3(0, 5, 0)), 42]);
    track(U.fallB, U.fallC, 0.25, (t) => [mw(t).addScaledVector(f, 30).addScaledVector(r, -10).add(v3(0, 4, 0)), mw(t).add(v3(0, 4.5, 0)), 40]);
    track(U.fallC, U.brake, 0.25, (t) => [pf(M, 10, 34, 1.6), mw(t).add(v3(0, 5, 0)), lerp(13, 26, ss(U.fallC, U.brake, t))]);
    track(U.brake, U.land, 0.2, (t) => [pf(M, 6, 24, 1.8), mw(t).add(v3(0, 5, 0)), 52]);

    // 3. Landing: wide, dust walls rolling out. Reveal: a held low push-in. Over the shoulder toward the enemies.
    add(U.land, pf(M, -26, 24, 3.5), up(M, 0, 3.5, 0), 46, { cut: true });
    add(U.reveal - 0.001, pf(M, -24, 22, 3.8), up(M, 0, 3.8, 0), 46, { ease: 'linear' });
    add(U.reveal, pf(M, 21, 6, 1.3), up(M, 0, 5.2, 0), 52, { cut: true });
    add(U.shoulder - 0.001, pf(M, 16.5, 4.5, 1.6), up(M, 0, 5.6, 0), 52, { ease: 'linear' });
    add(U.shoulder, pf(M, -14, 5, 15), pf(C, 0, 0, 1.5), 46, { cut: true });
    add(U.stance - 0.001, pf(M, -15.5, 5.5, 16), pf(C, 0, 0, 1.5), 46, { ease: 'linear' });
    add(U.stance, pf(M, 3, 24, 3.2), up(M, 0, 5.3, 0), 44, { cut: true });
    add(U.charge - 0.001, pf(M, 3, 21, 3.4), up(M, 0, 5.3, 0), 44, { ease: 'linear' });

    // 4. Charge: close on the cannon, a low 3/4 wide, a low close-up from the other side, held through the dead beat.
    add(U.charge, pf(M, 9.3, 2, 7.2), pf(M, 2, 0, 8), 38, { cut: true });
    add(U.wide - 0.001, pf(M, 8.2, 1.5, 7.6), pf(M, 2, 0, 8), 38, { ease: 'linear' });
    add(U.wide, pf(M, 22, 15, 2.4), up(M, 0, 6, 0), 50, { cut: true });
    add(U.st2 - 0.001, pf(M, 20, 14, 2.6), up(M, 0, 6, 0), 50, { ease: 'linear' });
    add(U.st2, pf(M, 7.4, -2.6, 5.4), pf(M, 2.2, 0, 8.2), 36, { cut: true });
    add(U.dead - 0.001, pf(M, 6.6, -2.2, 5.8), pf(M, 2.2, 0, 8.2), 36, { ease: 'linear' });
    add(U.fire - 0.001, pf(M, 6.6, -2.2, 5.8), pf(M, 2.2, 0, 8.2), 36);

    // 5. Fire: behind and above the mech, then from the side as the sweep crosses the line.
    const aim = M.clone().lerp(C, 0.6).setY(2);
    add(U.fire, pf(M, -11, 5.8, 13.5), aim, 50, { cut: true });
    add(U.side - 0.001, pf(M, -12.5, 6.4, 14), aim, 50, { ease: 'linear' });
    add(U.side, up(mid, 0, 5, 0).addScaledVector(r, 26), up(mid, 0, 3, 0), 54, { cut: true });
    add(U.exit - 0.001, up(mid, 0, 5.4, 0).addScaledVector(r, 24), up(mid, 0, 3, 0), 54, { ease: 'linear' });

    // 6. Exit: wide as the mech climbs out of the top of the frame, then a calm wide of the scorched sweep line.
    track(U.exit, U.calm, 0.3, (t) => [pf(M, 10, 38, 6), up(M, 0, 10 + 0.25 * mechY(t), 0), 54]);
    add(U.calm, pf(M, -14, 2, 12), M.clone().lerp(C, 0.8).setY(0), 52, { cut: true });
    add(U.end, pf(M, -15, 2, 12.5), M.clone().lerp(C, 0.8).setY(0), 52, { ease: 'linear' });
    this.keys = keys;
  }

  play() {
    this.reset();
    this.playing = true;
    this.cinematic.active = true;
    this.layout(0);
  }

  private reset() {
    this.time = 0;
    this.kick = 0;
    this.landDone = false;
    this.chClock = 0;
    this.ventClock = 0;
    this.theta = 0;
    this.beamDone = this.beamDone.map(() => false);
    this.smokeDone = this.smokeDone.map(() => false);
    this.boomT = this.boomT.map(() => 0);
    this.shake = 0;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  /** End of the timeline: everything back to neutral and hidden. */
  private finish() {
    this.playing = false;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.shake = 0;
    this.time = 0;
    this.layout(0);
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      if (this.settings.loop) { this.play(); return; }
      this.finish();
      return;
    }
    const u = this.time / this.k;
    this.kick *= Math.exp(-dt * 4);
    if (!this.landDone && u >= U.land) this.onLand();
    this.order.forEach((_, j) => {
      if (!this.beamDone[j] && u >= this.uHit[j]) this.onBeamHit(j);
      if (this.beamDone[j] && !this.smokeDone[j] && this.time >= this.boomT[j] + 0.25) this.onSmoke(j);
    });
    this.layout(dt);
  }

  // --- Events -------------------------------------------------------------------------------------------

  private onLand() {
    this.landDone = true;
    this.landT = this.time;
    const M = this.M;
    this.sparks.burst(240, this.tmpA.set(M.x, 1, M.z));
    this.dust.burst(220, this.tmpA.set(M.x, 0.6, M.z));
    this.kick = 1.6;
    this.smoke.trigger(this.tmpA.set(M.x, 1.2, M.z).addScaledVector(this.right, 4), 2.2, 1.4);
    this.smoke.trigger(this.tmpA.set(M.x, 1.2, M.z).addScaledVector(this.right, -4), 2.2, 1.4);
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e) => ctx.hit(e, { damage: this.settings.landDamage, knock: 4, from: M, color: '#ffd27a' }));
  }

  private onBeamHit(j: number) {
    this.beamDone[j] = true;
    this.boomT[j] = this.time;
    const o = this.order[j];
    this.sparks.burst(30, this.tmpA.set(o.pos.x, 1.2, o.pos.z));
    this.kick = Math.max(this.kick, 0.35);
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.hit(ctx.targets[o.idx], { damage: this.settings.damage, knock: 8, from: this.oc, color: '#7ff0ff' });
  }

  private onSmoke(j: number) {
    this.smokeDone[j] = true;
    const o = this.order[j];
    this.smoke.trigger(this.tmpA.set(o.pos.x, 1, o.pos.z), 1.4, 1.2);
  }

  // --- Layout -------------------------------------------------------------------------------------------

  /** Mech-local point to world, using the mech's current position and yaw. */
  private toWorld(lx: number, ly: number, lz: number, out: THREE.Vector3) {
    const g = this.mech.group;
    const c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y);
    return out.set(g.position.x + lx * c + lz * s, g.position.y + ly, g.position.z - lx * s + lz * c);
  }

  private layout(dt: number) {
    const k = this.k;
    const t = this.time;
    const u = t / k;
    const on = this.playing;
    const live = on && dt > 0;
    const cin = this.cinematic;
    sampleShots(this.keys, u, cin);
    cin.letterbox = on ? ss(0, 1, u) * (1 - ss(U.end - 1.5, U.end, u)) : 0;
    this.camHelp.position.copy(cin.position);
    this.camHelp.lookAt(cin.target);
    this.camHelp.rotateZ(cin.roll);
    this.camHelp.getWorldDirection(this.camForward);
    const camQ = this.camHelp.quaternion;

    // Sky dome and clouds.
    const camY = cin.position.y;
    const domeOp = on ? ss(U.ring - 0.2, U.ring + 0.2, u) * (1 - ss(U.end - 1.5, U.end - 0.2, u)) : 0;
    this.sky.position.copy(cin.position);
    this.skyMat.uniforms.uOpacity.value = domeOp;
    (this.skyMat.uniforms.uTop.value as THREE.Color).setHex(0x101830).lerp(this.tmpC.setHex(0x04060e), ss(30, 300, camY));
    (this.skyMat.uniforms.uHor.value as THREE.Color).setHex(0x3a3040).lerp(this.tmpC.setHex(0x6a7a98), ss(30, 220, camY));
    this.layoutClouds(u, on, camQ);

    this.layoutCall(u, on, live);
    this.layoutMech(u, t, dt, live);
    this.layoutLanding(u, t, dt, live, camQ);
    this.layoutCharge(u, dt, live);
    this.layoutBeam(u, t, dt, live);
    this.layoutScreen(u, t);

    // Camera shake: events kick it, long moments hold a low rumble.
    const base = Math.max(
      u >= U.fall && u < U.brake ? 0.03 + 0.07 * ss(U.fall, U.brake, u) : 0,
      u >= U.brake && u < U.land ? 0.18 : 0,
      u >= U.st2 && u < U.dead ? 0.05 : 0,
      u >= U.sweep0 && u < U.sweep1 + 0.3 ? 0.14 : 0,
      u >= U.rise && u < U.calm ? 0.06 : 0,
    );
    this.shake = on ? Math.max(base, this.kick) : 0;
  }

  private layoutClouds(u: number, on: boolean, camQ: THREE.Quaternion) {
    if (!on || u < U.fall - 0.2 || u > U.land) { this.clouds.hideAll(); return; }
    this.clouds.opacity = 0.5 * ss(U.fall - 0.2, U.fall + 0.6, u) * (1 - ss(U.brake, U.land, u));
    for (let i = 0; i < CLOUDS; i++) {
      const c = this.cloudSeed[i];
      this.tmpA.set(this.M.x + Math.cos(c.a) * c.d, c.y, this.M.z + Math.sin(c.a) * c.d);
      this.clouds.place(i, this.tmpA, c.s, c.s * 0.5, c.r, camQ);
    }
  }

  /** Act 1: the flare from the caster's hand and the red targeting ring painted on the landing site. */
  private layoutCall(u: number, on: boolean, live: boolean) {
    const P = this.P, M = this.M;
    const hand = this.tmpB.set(P.x, 0, P.z).addScaledVector(this.right, 1.3).addScaledVector(this.fwd, 0.25);
    hand.y = 1.3 + 1.0 * ss(0.7, 1.5, u);
    const flying = on && u >= U.flare && u < U.ring + 0.4;
    const held = on && u >= 0.7 && u < U.flare;
    if (held || flying) {
      const a = Math.max(0, u - U.flare);
      const pos = this.tmpA.copy(hand);
      if (flying) pos.y = hand.y + 20 * a + 50 * a * a;
      const size = 0.3 + 0.4 * ss(0.7, 1.5, u);
      this.flareGlow.mesh.position.copy(pos);
      this.flareGlow.mesh.scale.setScalar(size);
      this.flareGlow.opacity = 0.55 * (1 - ss(U.ring - 0.1, U.ring + 0.4, u));
      this.flareStar.set(pos, size * 1.6, 0.95 * (1 - ss(U.ring - 0.1, U.ring + 0.4, u)), u * 2);
      this.flareTrail.set(hand.x, hand.z, hand.y, Math.max(hand.y + 0.01, pos.y), flying ? 0.5 * (1 - ss(U.ring - 0.2, U.ring + 0.4, u)) : 0);
      if (live && flying && a < 0.9) this.sparks.burst(2, pos);
    } else {
      this.flareGlow.opacity = 0;
      this.flareStar.set(this.tmpA.set(0, -50, 0), 0, 0, 0);
      this.flareTrail.set(0, 0, 0, 1, 0);
    }

    // Signal pillar from orbit, then the reticle contracts onto the site until the mech arrives.
    this.signal.set(M.x, M.z, 0, 260, on ? 0.4 * ss(U.ringOn, U.ringOn + 0.3, u) * (1 - ss(U.ringOn + 0.9, U.ringOn + 1.6, u)) : 0);
    const op = on ? ss(U.ringOn - 0.1, U.ringOn + 0.6, u) * (1 - ss(U.land - 0.1, U.land, u)) : 0;
    const R = 8 - 1.6 * ss(U.ringOn, U.land - 0.2, u);
    this.retG.visible = op > 0.01;
    const pulse = 1 + 0.03 * Math.sin(u * 9);
    this.retUnder.scale.setScalar(R * 1.05);
    (this.retUnder.material as THREE.MeshBasicMaterial).opacity = 0.42 * op;
    this.retOuter.mesh.scale.setScalar(R * pulse);
    this.retOuter.material.opacity = 0.5 * op;
    this.retHex.mesh.scale.setScalar(R * 0.72);
    this.retHex.mesh.rotation.z = u * 0.5;
    this.retHex.material.opacity = 0.42 * op;
    this.chevrons.children.forEach((arm) => {
      const m = arm.children[0] as THREE.Mesh;
      m.position.x = R * (0.95 - 0.12 * Math.sin(u * 6));
      m.scale.setScalar(R * 0.16);
      (m.userData.mat as THREE.MeshBasicMaterial).opacity = 0.5 * op;
    });
    this.chevrons.rotation.y = u * 0.2;
  }

  /** The mech: fall with heat shield, retro-thrusters, landing, stance, charge pose, recoil, climb away. */
  private layoutMech(u: number, t: number, dt: number, live: boolean) {
    const mech = this.mech;
    const M = this.M;
    const on = this.playing;
    const y = mechY(u);
    const shown = on && u >= U.fall - 0.1 && y < 380;
    mech.group.visible = shown;

    // Aim: the mech swivels onto the first end of the sweep when it fires, follows the beam, then turns back.
    const aimU = clamp(u, U.sweep0, U.sweep1);
    const e = this.pathAt(aimU, this.tmpA);
    const target = clamp(Math.atan2(this.tmpD.copy(e).sub(M).dot(this.right), this.tmpD.copy(e).sub(M).dot(this.fwd)), -1.2, 1.2);
    let th = 0;
    if (u >= U.fire) th = target * ss(U.fire, U.sweep0, u);
    if (u >= U.sweep1) th *= 1 - ss(U.sweep1 + 0.3, U.rise, u);
    this.theta = th;
    const rec = u >= U.fire ? 0.55 * Math.exp(-(t - U.fire * this.k) * 5) : 0;
    const crouch = this.landDone ? 0.06 * Math.exp(-(t - this.landT) * 5) : 0;
    mech.group.position.set(M.x - this.fwd.x * rec, y, M.z - this.fwd.z * rec);
    mech.group.rotation.set(0, this.baseYaw - this.theta, 0);
    mech.group.scale.set(1, 1 - crouch, 1);

    const arms = 0.85 * ss(U.charge, U.charge + 1.6, u) * (1 - ss(U.exit + 0.4, U.rise, u));
    const open = ss(U.charge + 0.2, U.charge + 1.7, u) * (1 - ss(U.exit, U.rise, u));
    const visor = u < 18.3 ? 0 : (0.45 + 0.55 * ss(18.7, 19.2, u)) * (0.85 + 0.15 * Math.sin(u * 9) * (u < 21 ? 1 : 0.3));
    const chg = this.chargeAmount(u);
    mech.pose(arms, open, shown ? visor : 0, open > 0.05 ? Math.min(1, chg) : 0);

    // Re-entry glow: on while falling, gone when the thrusters take over.
    const heat = u < U.brake ? ss(U.fall, U.fall + 0.5, u) : 1 - ss(U.brake, U.brake + 0.4, u);
    mech.heat(on ? heat : 0, t);

    // Retro-thrusters under the feet while braking and just after touchdown; all four on the climb away.
    const brakeOn = u >= U.brake ? ss(U.brake, U.brake + 0.25, u) * (1 - ss(U.land, U.land + 0.7, u)) : 0;
    const climbOn = ss(U.exit + 0.2, U.rise + 0.4, u) * (u < U.calm ? 1 : 0);
    const near = ss(0, 70, y);
    const footLen = brakeOn > 0 ? lerp(8, 15, near) : 6 + 14 * climbOn;
    const jetOn = Math.max(brakeOn, climbOn);
    for (const j of mech.footJets) j.set(footLen, 1.05, jetOn, t);
    for (const j of mech.backJets) j.set(footLen * 0.55, 0.6, jetOn, t);
    // Heat shimmer above the thruster blast (braking and climb-out), fades with the jets.
    this.jetHaze.set(this.tmpA.set(M.x, Math.max(0, y - 2), M.z), on ? 0.014 * jetOn : 0, t, 1 + 0.6 * near);

    // Streaming sparks behind the falling mech, a ground blast under the jets.
    if (live && u >= U.fall && u < U.brake) this.trail.burst(4, this.tmpA.set(M.x + (Math.random() - 0.5) * 6, y + 6 + Math.random() * 12, M.z + (Math.random() - 0.5) * 6));
    if (live && u >= U.brake + 1 && u < U.land + 0.5) {
      const a = Math.random() * Math.PI * 2;
      this.dust.burst(5, this.tmpA.set(M.x + Math.cos(a) * 3, 0.4, M.z + Math.sin(a) * 3));
    }
    if (live && u >= U.rise && u < U.calm - 0.5) {
      const a = Math.random() * Math.PI * 2;
      this.dust.burst(4, this.tmpA.set(M.x + Math.cos(a) * 3.5, 0.4, M.z + Math.sin(a) * 3.5));
      this.sparks.burst(3, this.tmpA.set(M.x, Math.max(0.4, y - 0.5), M.z));
    }

    // Steam vents at the shoulders, back and hips once it stands (reveal to charge).
    if (live && u >= U.land + 1 && u < U.charge + 3) {
      this.ventClock += dt;
      if (this.ventClock > 0.12) {
        this.ventClock = 0;
        const s = Math.random() < 0.5 ? -1 : 1;
        const vents = [[2.3, 9.6, -0.4], [1.2, 8.8, -2.7], [1.9, 5.9, 0.3]];
        const v = vents[Math.floor(Math.random() * vents.length)];
        this.steam.burst(2, this.toWorld(s * v[0], v[1], v[2], this.tmpA));
      }
    }
    // The cannon muzzle, used by the charge and the beam.
    this.toWorld(0, 8, 2.15, this.oc);
  }

  /** Charge level 0..1 (1.2 in the beam's first instant), 0 outside the charge and fire. */
  private chargeAmount(u: number) {
    return ramp(u, [[U.charge, 0], [U.charge + 1.2, 0.15], [U.st2, 0.55], [U.dead, 1], [U.fire, 1], [U.fire + 0.3, 1.2], [U.sweep1, 1], [U.sweep1 + 0.9, 0]]);
  }

  private layoutLanding(u: number, t: number, dt: number, live: boolean, camQ: THREE.Quaternion) {
    const M = this.M;
    const hit = this.landDone;
    const a = hit ? Math.max(0, t - this.landT) : 0;
    this.landRing.mesh.position.set(M.x, 0.05, M.z);
    this.landRing.mesh.scale.setScalar(1 + a * 30);
    this.landRing.material.opacity = hit ? Math.max(0, 0.8 * (1 - a / 1.3)) : 0;
    const a2 = a - 0.15;
    this.landRing2.mesh.position.set(M.x, 0.06, M.z);
    this.landRing2.mesh.scale.setScalar(1 + Math.max(0, a2) * 20);
    this.landRing2.material.opacity = hit && a2 > 0 ? Math.max(0, 0.6 * (1 - a2 / 1.6)) : 0;
    const sp = clamp(a / 0.5, 0, 1);
    this.landShock.set(this.tmpB.set(M.x, 0, M.z), 1 + a * 30, hit && sp < 1 ? 0.045 * (1 - sp) * (1 - sp) : 0);
    const pop = StarBurst.pop(a - 0.02, 0.12, 0.3);
    this.landStar.set(this.tmpB.set(M.x, 3, M.z), 16 * pop.scale, hit ? pop.opacity : 0, 0.2);

    // Dust walls rush out from the impact.
    const wallOn = hit && a < 4.4;
    if (wallOn) {
      const R = 30 * (1 - Math.exp(-1.4 * a));
      this.walls.opacity = 0.6 * ss(0, 0.15, a) * (1 - ss(2, 4.4, a));
      for (let i = 0; i < WALLS; i++) {
        const w = this.wallSeed[i];
        this.walls.place(i, this.tmpB.set(M.x + Math.cos(w.a) * R, 2.5 + w.h * 0.3 + w.y, M.z + Math.sin(w.a) * R), 12, w.h, w.r, camQ);
      }
    } else this.walls.hideAll();

    // Cracked, scorched ground: the cracks cool.
    const crackOn = hit && this.playing && u < U.end - 0.3;
    this.crack.visible = crackOn;
    this.crackMat.opacity = crackOn ? ss(0, 0.2, a) * (1 - ss(U.end - 3, U.end - 0.4, u)) : 0;
    this.crackMat.color.setScalar(0.35 + 0.65 * Math.exp(-a / 6));
    if (live && hit && u > U.land + 0.5 && u < U.calm + 1) {
      const ang = Math.random() * Math.PI * 2, rad = Math.random() * 7;
      this.embers.burst(1, this.tmpB.set(M.x + Math.cos(ang) * rad, 0.1, M.z + Math.sin(ang) * rad));
    }
    void dt;
  }

  /** Chest cannon charge: contracting rings, a ball, inward motes; a clean ring held through the dead beat. */
  private layoutCharge(u: number, dt: number, live: boolean) {
    const on = this.playing && u >= U.charge && u < U.sweep1 + 1;
    const dead = u >= U.dead && u < U.fire;
    const ch = on ? this.chargeAmount(u) : 0;
    const OC = this.oc;
    const yaw = this.mech.group.rotation.y;
    if (live && on && !dead && u < U.fire) this.chClock += dt * (u < U.st2 ? 1.1 : 1.8);
    const stage2 = u >= U.st2;
    const ballR = lerp(0.2, 1.5, Math.min(1, ch)) * (1 + (dead ? 0 : 0.05 * Math.sin(u * 30)));
    this.ball.mesh.position.copy(OC).addScaledVector(this.fwdOf(yaw), 0.15);
    this.ball.mesh.scale.setScalar(ballR);
    this.ball.opacity = on ? 0.32 * Math.min(1, ch * 1.4) * (1 - ss(U.sweep1, U.sweep1 + 0.9, u)) : 0;
    this.ballCore.mesh.position.copy(this.ball.mesh.position);
    this.ballCore.mesh.scale.setScalar(ballR * 0.45);
    this.ballCore.opacity = on && ch > 0.5 ? 0.22 * (1 - ss(U.sweep1, U.sweep1 + 0.9, u)) : 0;

    // Contracting rings face the cannon (rotate with the mech).
    this.chargeRings.forEach((cr, i) => {
      const ph = (this.chClock * (stage2 ? 1.1 : 0.7) + i / 3) % 1;
      const show = on && !dead && u < U.fire && u >= U.charge + 0.8;
      cr.g.visible = show;
      cr.g.position.copy(OC).addScaledVector(this.fwdOf(yaw), 0.5 + 1.2 * ph);
      cr.g.rotation.set(0, yaw, 0);
      cr.ring.mesh.scale.setScalar(Math.max(1e-3, 5.5 * (1 - ph) + 0.8));
      cr.ring.material.opacity = show ? 0.55 * Math.sin(Math.PI * ph) : 0;
    });
    // One clean thin ring: grows with the charge, held steady in the dead beat.
    this.cleanRingG.position.copy(OC).addScaledVector(this.fwdOf(yaw), 0.9);
    this.cleanRingG.rotation.set(0, yaw, 0);
    this.cleanRing.mesh.scale.setScalar(1.7 + 0.2 * Math.sin(u * 8) * (dead ? 0 : 1));
    this.cleanRing.material.opacity = on && u >= U.st2 && u < U.fire + 0.1 ? 0.6 : 0;

    // Motes pulled onto the core.
    const vis = on && !dead && u < U.fire && u >= U.charge + 0.5;
    this.parts.visible = vis;
    if (vis) {
      this.partGeo.setDrawRange(0, stage2 ? PARTS : 90);
      for (let i = 0; i < PARTS; i++) {
        const sd = this.partSeed[i];
        const f = (this.chClock * 0.6 + sd.ph) % 1;
        const rad = 0.5 + 8 * Math.pow(1 - f, 1.4);
        this.partPos[i * 3] = OC.x + sd.dir.x * rad;
        this.partPos[i * 3 + 1] = OC.y + sd.dir.y * rad;
        this.partPos[i * 3 + 2] = OC.z + sd.dir.z * rad;
      }
      (this.partGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      this.partMat.opacity = 0.55 * ss(U.charge + 0.5, U.charge + 1.5, u);
      this.partMat.color.setHex(stage2 ? 0xbff8ff : 0x7ff0ff);
    } else this.partMat.opacity = 0;
  }

  private fwdOf(yaw: number) {
    return this.tmpD.set(Math.sin(yaw), 0, Math.cos(yaw));
  }

  /** The sweep beam, its muzzle and end flare, the scorch line behind it and a toon fireball on each enemy. */
  private layoutBeam(u: number, t: number, dt: number, live: boolean) {
    const OC = this.oc;
    const w = this.playing ? ss(U.fire, U.fire + 0.35, u) * (1 - ss(U.sweep1 + 0.1, U.sweep1 + 0.8, u)) : 0;
    const on = w > 0.01;
    const e = this.pathAt(u, this.tmpA);
    const end = this.tmpB.set(e.x, 0.9, e.z);
    const dir = this.tmpD.copy(end).sub(OC);
    const len = Math.max(0.1, dir.length());
    dir.divideScalar(len);
    this.tmpQ.setFromUnitVectors(Y_AXIS, dir);
    const flick = 1 + 0.06 * Math.sin(t * 55) + 0.04 * Math.sin(t * 91);
    const rad = 1.0 * w * flick;
    const set = (m: THREE.Mesh, r: number) => {
      m.visible = on;
      m.position.copy(OC);
      m.quaternion.copy(this.tmpQ);
      m.scale.set(Math.max(1e-3, r), len, Math.max(1e-3, r));
    };
    set(this.beamDark, rad * 1.5);
    set(this.beamBody, rad);
    set(this.beamCore, rad * 0.4);
    this.muzzle.mesh.position.copy(OC);
    this.muzzle.mesh.scale.setScalar(2.2 * w * flick);
    this.muzzle.opacity = on ? 0.4 * w : 0;
    this.muzzleStar.set(OC, 5.5 * w, on ? 0.9 * w : 0, u * 1.3);
    this.endRing.mesh.position.set(e.x, 0.07, e.z);
    this.endRing.mesh.scale.setScalar(2.6 + 0.5 * Math.sin(t * 20));
    this.endRing.material.opacity = on ? 0.5 * w : 0;
    this.endStar.set(this.tmpB.set(e.x, 0.9, e.z), 4.2 * w * flick, on ? 0.9 * w : 0, u * 2);
    if (live && on && u >= U.sweep0 && u < U.sweep1) {
      this.sparks.burst(5, this.tmpB.set(e.x, 0.6, e.z));
      this.dust.burst(1, this.tmpB.set(e.x, 0.5, e.z));
    }

    // Scorch line behind the beam end: dark char with a thin glowing seam that cools.
    const s = clamp((u - U.sweep0) / (U.sweep1 - U.sweep0), 0, 1) * this.pathLen;
    const drawn = this.playing && u >= U.sweep0;
    const seamOp = 0.5 * (1 - 0.75 * ss(U.sweep1, U.sweep1 + 3, u));
    const fade = 1 - ss(U.end - 1.5, U.end - 0.2, u);
    this.scorch.forEach((sc, i) => {
      const covered = drawn && i < this.pathPts.length - 1 ? clamp(s - this.cum[i], 0, this.cum[i + 1] - this.cum[i]) : 0;
      const vis = covered > 0.05;
      sc.dark.visible = sc.glow.visible = vis;
      if (!vis) return;
      const a = this.pathPts[i], b = this.pathPts[i + 1];
      const d = this.tmpD.copy(b).sub(a).setY(0).normalize();
      const cx = a.x + d.x * covered * 0.5, cz = a.z + d.z * covered * 0.5;
      const yaw = Math.atan2(d.x, d.z);
      sc.dark.position.set(cx, 0.04, cz);
      sc.dark.rotation.y = yaw;
      sc.dark.scale.set(3.6, 1, covered);
      (sc.dark.material as THREE.MeshBasicMaterial).opacity = 0.65 * fade;
      sc.glow.position.set(cx, 0.05, cz);
      sc.glow.rotation.y = yaw;
      sc.glow.scale.set(1.1, 1, covered);
      (sc.glow.material as THREE.MeshBasicMaterial).opacity = seamOp * fade;
    });
    if (live && u >= U.sweep1 && u < U.calm + 1.5 && Math.random() < 0.7) {
      const i = Math.floor(Math.random() * this.cum.length);
      const p = this.pathPts[Math.min(i, this.pathPts.length - 1)];
      this.embers.burst(1, this.tmpB.set(p.x + (Math.random() - 0.5) * 3, 0.15, p.z + (Math.random() - 0.5) * 3));
    }

    // Toon fireball, ground ring and star on each enemy at the moment the beam crosses it.
    this.booms.forEach((b, j) => {
      const o = this.order[j];
      const age = o && this.beamDone[j] ? t - this.boomT[j] : -1;
      const show = age >= 0 && age < 1.1 && !!o;
      b.fire.visible = b.core.visible = show;
      if (!show) {
        b.ring.material.opacity = 0;
        b.star.set(this.tmpB.set(0, -50, 0), 0, 0, 0);
        return;
      }
      const grow = 1 - Math.exp(-age * 10);
      const shrink = 1 - ss(0.35, 1.1, age);
      const r = 2.6 * grow * shrink;
      b.fire.position.set(o.pos.x, 1.3 + age * 0.8, o.pos.z);
      b.fire.scale.setScalar(Math.max(1e-3, r));
      b.fireMat.opacity = 0.9 * shrink;
      b.core.position.copy(b.fire.position);
      b.core.scale.setScalar(Math.max(1e-3, r * 0.55));
      b.coreMat.opacity = 0.9 * (1 - ss(0.1, 0.5, age));
      b.ring.mesh.position.set(o.pos.x, 0.06, o.pos.z);
      b.ring.mesh.scale.setScalar(1 + age * 12);
      b.ring.material.opacity = Math.max(0, 0.7 * (1 - age / 0.7));
      const pop = StarBurst.pop(age, 0.1, 0.25);
      b.star.set(this.tmpB.set(o.pos.x, 1.4, o.pos.z), 6 * pop.scale, pop.opacity, j * 0.7);
    });
  }

  private layoutScreen(u: number, t: number) {
    const fx = this.screen;
    const k = this.k;
    const on = this.playing;
    fx.darken = on ? ramp(u, [
      [0, 0.3], [U.ring, 0.35], [U.fall, 0.15], [U.brake, 0.1], [U.land, 0.1], [U.land + 0.1, 0.2], [U.reveal, 0.25],
      [U.stance, 0.3], [U.charge, 0.5], [U.dead, 0.62], [U.fire, 0.45], [U.exit, 0.3], [U.calm, 0.1], [U.end, 0],
    ]) : 0;
    // Grade: cold dusk, warm during the drop and landing, cyan during the charge.
    const warm = ramp(u, [[4.5, 0], [7, 1], [U.brake, 1], [U.land + 0.1, 0.3], [U.reveal, 0]]);
    const cyan = ramp(u, [[U.charge - 0.3, 0], [U.charge + 1.5, 1], [U.fire, 1], [U.sweep1, 0.5], [U.exit, 0]]);
    fx.tint.setHex(0x40508a).lerp(this.tmpC.setHex(0x8a5a38), warm).lerp(this.tmpC.setHex(0x2a5a8a), cyan);

    // Speed lines: the drop, the braking, the charge implode, the beam's first instant.
    fx.speedLines = on ? Math.max(
      0.4 * ss(U.fall, U.fall + 0.6, u) * (1 - ss(U.brake - 0.3, U.brake + 0.2, u)),
      u >= U.brake && u < U.land ? 0.55 : 0,
      u >= U.land && u < U.land + 0.5 ? 0.7 * (1 - ss(U.land, U.land + 0.5, u)) : 0,
      u >= U.st2 && u < U.dead ? 0.35 * ss(U.st2, U.dead, u) : 0,
      u >= U.fire && u < U.fire + 1.2 ? 0.5 * (1 - ss(U.fire, U.fire + 1.2, u)) : 0,
    ) : 0;
    fx.speedLineColor.setHex(u >= U.charge && u < U.exit ? 0x7ff0ff : 0xffb060);
    const mp = this.mech.group.position;
    if (u < U.fall) fx.focus.copy(this.P).add(this.tmpA.set(0, 2.5, 0));
    else if (u < U.land) fx.focus.set(mp.x, mp.y + 5, mp.z);
    else if (u >= U.charge && u < U.sweep1) fx.focus.copy(this.oc);
    else fx.focus.set(this.M.x, 4, this.M.z);

    // Impact frames: the landing (dark then light), one inverted frame at the cut into the drop and at stage 2.
    let mode: 0 | 1 | 2 | 3 | 4 = 0;
    let colour = this.tmpC.setHex(0xff8a2a);
    const landMode = impactFrameAt(t, U.land * k, [1, 2], 0.04);
    const dropMode = impactFrameAt(t, U.fall * k, [4], 0.04);
    const stageMode = impactFrameAt(t, U.st2 * k, [4], 0.04);
    if (landMode) { mode = landMode; colour = this.tmpC.setHex(0xff8a2a); }
    else if (dropMode) { mode = dropMode; colour = this.tmpC.setHex(0xff8a2a); }
    else if (stageMode) { mode = stageMode; colour = this.tmpC.setHex(0x7ff0ff); }
    fx.impact = on ? mode : 0;
    fx.impactColor.copy(colour);

    // The beam's first instant: anti-flash then a short whiteout.
    fx.exposure = 1;
    fx.whiteout = 0;
    if (on && t > U.fire * k - 0.05 && t < U.fire * k + 1) Object.assign(fx, flashBeat(t, U.fire * k, 0.05, 0.3));

    // Chroma pulses: landing, stage 2, fire and each beam hit.
    let ch = Math.max(
      this.landDone ? chromaPulse(t, this.landT, 1, 8) : 0,
      chromaPulse(t, U.st2 * k, 0.6, 9),
      chromaPulse(t, U.fire * k, 0.8, 8),
    );
    for (let j = 0; j < this.boomT.length; j++) if (this.beamDone[j]) ch = Math.max(ch, chromaPulse(t, this.boomT[j], 0.45, 9));
    fx.chroma = on ? ch : 0;
  }
}

export const colossusDropModule: EffectModule = {
  label: 'colossus drop',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: MAX_TARGETS },
  create: () => new ColossusDrop(),
  telegraphs(effect) {
    return (effect as ColossusDrop).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as ColossusDrop;
    if (e.ctx) frameCast(camera, controls, e.ctx, 12);
  },
  buildGui(f, effect) {
    const s = (effect as ColossusDrop).settings;
    f.add(s, 'loop');
    f.add(s, 'duration', 30, 70, 1).name('duration (s)');
    f.add(s, 'damage', 1, 150, 1).name('beam damage');
    f.add(s, 'landDamage', 0, 60, 1).name('landing damage');
  },
};
