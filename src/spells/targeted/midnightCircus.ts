import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  ShockRefraction, SmokeBall, StarBurst, chromaPulse, clearCinematic, clearScreenFx, createCinematic, createScreenFx,
  impactFrameAt, sampleShots, type ShotKey,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { TelegraphSpec } from '../../effects/telegraph';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Midnight Circus (targeted enemies, up to 6, hero tier, 20 s cutscene): a sinister big top erupts from the floor
 * around the enemies. Striped panels burst up one after the other (drawn red and cream canvas stripes with a scalloped
 * gold-trimmed valance, a pennant on the pole), the lights go down to velvet dark, spotlights sweep the floor and lock
 * on each enemy in turn while a drumroll shakes the frame. A dead beat: only the spotlights, a gift box with a crank
 * that turns once. The lid bursts open and a harlequin jack springs up on a coil (drawn face: white, black diamond eye,
 * wide red grin; jester hat with bells), sways, and lunges at every enemy in turn (one hit each). Finale: the jack
 * spins, the tent peels open like a flower, confetti cannons fire, impact frames, a hit on everyone. A velvet curtain
 * falls across the frame and lifts on the empty arena with the confetti settling.
 *
 * Everything is a pure function of the clock `time` (hits, emitter bursts and smoke fire when the clock crosses them).
 * Camera: scripted with `cinematic`, every shot placed explicitly from the caster P0, the target centroid C, the tent
 * radius Rt, the jack ring Jc and the arena axes F (caster to targets) and R (right). Inside shots stay in the tent,
 * clear of the walls and under the roof; walls near the camera fade out. Every key is clamped to at most 24 from its
 * look-at (up to 46 for the two establishing wides).
 *
 * Design: pipeline/designs/midnight-circus.md.
 *
 * Palette: spotlight cream (tiny cores) | circus red | tent cream (a material) | gold trim | velvet dark.
 *
 * Timeline: 0 calliope (behind the caster, snap; cut 1.1 floor level, ripples, panels burst up) | 3.0 big top (wide,
 * pennant, lights down) | 6.0 spotlights (inside, drumroll 0.05 to 0.2) | 10.0 hush (box, crank turns) | 11.0 lid bursts,
 * jack springs up (low) | 11.75 close-up of the grin | 12.3 lunges (tracking, 0.45 s each, hit on arrival) | 15.0 finale
 * (inside, cut 16.0 high wide, tent peels open, confetti, hit on all) | 17.0 curtain falls, 18.5 lifts on the empty
 * arena | 20 end
 */
export interface MidnightCircusSettings {
  lungeDamage: number;
  finaleDamage: number;
  loop: boolean;
}

export const defaultMidnightCircus = (): MidnightCircusSettings => ({ lungeDamage: 40, finaleDamage: 30, loop: false });

const DURATION = 20;
const MAXT = 6;
const NP = 18; // tent panels
const WALL_H = 3.4;
const BOX_H = 2.2;
const REST_Y = 6.4; // jack head height at rest
const SNAP = 0.55;
const PANELS0 = 1.1;
const DARK0 = 4.0;
const SPOT0 = 6.0;
const HUSH = 10.0;
const BURST = 11.0;
const GRIN = 11.75;
const L0 = 12.3;
const FIN = 15.0;
const CURT0 = 17.0;
const GONE = 17.85;
const MAXRING = 90;

// Palette.
const RED = 0xc8233a;
const CREAM = 0xe8d8b0;
const GOLD = 0xd9a441;
const SPOT = 0xfff1c9;

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a: number, b: number, x: number) => smoothstep((x - a) / (b - a));
const outCubic = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const outBack = (x: number) => {
  const u = clamp(x, 0, 1) - 1;
  return 1 + 2.4 * u * u * u + 1.4 * u * u;
};
const angLerp = (a: number, b: number, k: number) => {
  const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * k;
};
const rotY = (v: THREE.Vector3, a: number) =>
  new THREE.Vector3(v.x * Math.cos(a) + v.z * Math.sin(a), v.y, -v.x * Math.sin(a) + v.z * Math.cos(a));

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function diamond(g: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number) {
  g.beginPath();
  g.moveTo(cx, cy - hh);
  g.lineTo(cx + hw, cy);
  g.lineTo(cx, cy + hh);
  g.lineTo(cx - hw, cy);
  g.closePath();
}

/** One wall panel: stripe colour, a darker hem, a scalloped valance in the other colour with a gold edge, dark seams. */
function wallTexture(base: string, alt: string): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    const gr = g.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.28)');
    gr.addColorStop(0.22, 'rgba(0,0,0,0)');
    gr.addColorStop(0.78, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, 232, 256, 24);
    // Valance: a band with hanging scallops.
    g.fillStyle = alt;
    g.fillRect(0, 0, 256, 54);
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(32 + 64 * k, 54, 32, 0, Math.PI);
      g.closePath();
      g.fillStyle = alt;
      g.fill();
      g.strokeStyle = '#1a0a10';
      g.lineWidth = 11;
      g.stroke();
      g.strokeStyle = '#d9a441';
      g.lineWidth = 5;
      g.stroke();
      g.fillStyle = '#d9a441';
      g.beginPath();
      g.arc(32 + 64 * k, 96, 6, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#d9a441';
    g.fillRect(0, 0, 256, 8);
    g.fillStyle = '#1a0a10';
    g.fillRect(0, 0, 7, 256);
    g.fillRect(249, 0, 7, 256);
  });
}

/** One roof panel (v runs from the eave at the bottom to the apex at the top). */
function roofTexture(base: string): THREE.CanvasTexture {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(0,0,0,0.3)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(60, 0, 8, 256);
    g.fillStyle = '#d9a441';
    g.fillRect(0, 244, 128, 12);
    g.fillStyle = '#1a0a10';
    g.fillRect(0, 0, 6, 256);
    g.fillRect(122, 0, 6, 256);
    g.fillRect(0, 238, 128, 6);
  });
}

/**
 * Jack's head, equirectangular: the face looks along +Z, which is u = 0.25 (x = 256 of 1024) on a three.js sphere.
 * A white face with dark outlines, one black diamond eye (red outline), one red diamond eye, slanted brows, red
 * cheeks and a wide red grin full of teeth.
 */
function faceTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 512, (g) => {
    g.fillStyle = '#f4ead2';
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#e1d2ae';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 17; c++) {
        if ((r + c) % 2 === 0) {
          diamond(g, c * 64, r * 64, 32, 32);
          g.fill();
        }
      }
    }
    // The face: a clean ellipse over the lattice.
    g.fillStyle = '#f6edd6';
    g.beginPath();
    g.ellipse(256, 262, 190, 215, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1a0a10';
    g.lineWidth = 5;
    // Cheeks.
    for (const s of [-1, 1]) {
      g.fillStyle = '#c8233a';
      g.beginPath();
      g.arc(256 + s * 118, 300, 28, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    // Slanted brows.
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(136, 162);
    g.lineTo(222, 192);
    g.moveTo(376, 162);
    g.lineTo(290, 192);
    g.stroke();
    // The black diamond eye (left) with a red outline and a tiny glint.
    diamond(g, 184, 236, 36, 52);
    g.fillStyle = '#0a0508';
    g.fill();
    g.strokeStyle = '#c8233a';
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = '#f6edd6';
    g.fillRect(172, 212, 11, 11);
    // The red diamond eye (right).
    diamond(g, 328, 236, 30, 42);
    g.fillStyle = '#c8233a';
    g.fill();
    g.strokeStyle = '#1a0a10';
    g.lineWidth = 8;
    g.stroke();
    diamond(g, 328, 236, 9, 15);
    g.fillStyle = '#0a0508';
    g.fill();
    // The grin.
    const mouth = () => {
      g.beginPath();
      g.moveTo(121, 318);
      g.quadraticCurveTo(256, 500, 391, 318);
      g.quadraticCurveTo(256, 380, 121, 318);
      g.closePath();
    };
    mouth();
    g.fillStyle = '#2a0810';
    g.fill();
    g.save();
    mouth();
    g.clip();
    g.fillStyle = '#fff6e0';
    g.fillRect(100, 300, 320, 74);
    g.fillStyle = '#d9334a';
    g.beginPath();
    g.ellipse(256, 398, 56, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1a0a10';
    g.lineWidth = 3;
    for (let x = 100; x < 420; x += 26) {
      g.beginPath();
      g.moveTo(x, 300);
      g.lineTo(x, 374);
      g.stroke();
    }
    g.restore();
    mouth();
    g.strokeStyle = '#1a0a10';
    g.lineWidth = 31;
    g.stroke();
    g.strokeStyle = '#c8233a';
    g.lineWidth = 20;
    g.stroke();
    g.strokeStyle = '#1a0a10';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(104, 300);
    g.quadraticCurveTo(112, 322, 126, 332);
    g.moveTo(408, 300);
    g.quadraticCurveTo(400, 322, 386, 332);
    g.stroke();
  });
}

/** The gift box: harlequin red and plum diamonds, gold lines and a gold frame with dark outlines. */
function boxTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (g) => {
    g.fillStyle = '#7d1b2c';
    g.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        diamond(g, c * 96 + 48, r * 96 + 48, 48, 48);
        g.fillStyle = (r + c) % 2 === 0 ? '#a82236' : '#2b1230';
        g.fill();
        g.strokeStyle = '#d9a441';
        g.lineWidth = 4;
        g.stroke();
      }
    }
    g.strokeStyle = '#1a0a10';
    g.lineWidth = 34;
    g.strokeRect(17, 17, 478, 478);
    g.strokeStyle = '#d9a441';
    g.lineWidth = 20;
    g.strokeRect(17, 17, 478, 478);
  });
}

/** Velvet curtain: vertical folds, a gold hem with a tassel fringe at the bottom edge. */
function curtainTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (g) => {
    for (let x = 0; x < 512; x += 2) {
      const f = 0.5 + 0.5 * Math.sin((x / 512) * Math.PI * 2 * 10);
      const k = 0.4 + 0.6 * f * f;
      g.fillStyle = `rgb(${Math.round(70 + 100 * k)},${Math.round(8 + 14 * k)},${Math.round(22 + 26 * k)})`;
      g.fillRect(x, 0, 2, 512);
    }
    const sh = g.createLinearGradient(0, 0, 0, 512);
    sh.addColorStop(0, 'rgba(0,0,0,0.5)');
    sh.addColorStop(0.35, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#1a0a10';
    g.fillRect(0, 462, 512, 30);
    g.fillStyle = '#d9a441';
    g.fillRect(0, 466, 512, 22);
    for (let x = 0; x < 512; x += 14) {
      g.fillStyle = '#1a0a10';
      g.fillRect(x, 488, 10, 24);
      g.fillStyle = '#d9a441';
      g.fillRect(x + 1, 488, 7, 21);
    }
  });
}

/** The lit disc on the floor: hard edge, brighter rim, no soft glow. */
function discTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = 'rgba(255,241,201,0.5)';
    g.beginPath();
    g.arc(64, 64, 58, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,230,170,0.75)';
    g.lineWidth = 6;
    g.stroke();
  });
}

function stripeTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(256, 32, (g) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#e0cfa4' : '#a82236';
      g.fillRect(i * 32, 0, 32, 32);
    }
    g.fillStyle = '#1a0a10';
    for (let i = 0; i < 8; i++) g.fillRect(i * 32, 0, 3, 32);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

interface Panel {
  pg: THREE.Group;
  wallHinge: THREE.Group;
  roofHinge: THREE.Group;
  wallMat: THREE.MeshStandardMaterial;
  roofMat: THREE.MeshStandardMaterial;
  delay: number;
  wx: number;
  wz: number;
}

interface Spot {
  cone: THREE.Mesh;
  floor: THREE.Mesh;
  coneMat: THREE.MeshBasicMaterial;
  floorMat: THREE.MeshBasicMaterial;
  apex: THREE.Vector3;
}

interface JackState {
  pos: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
  sx: number;
  sy: number;
}

interface Opts {
  cut?: boolean;
  ease?: ShotKey['ease'];
  inside?: boolean;
  max?: number;
}

export class MidnightCircus implements Effect {
  readonly group = new THREE.Group();
  readonly settings: MidnightCircusSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  readonly cinematic = createCinematic();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private kick = 0;
  private keys: ShotKey[] = [];
  private fired = { burst: false, fin: false, hit: [] as boolean[], vol: [false, false, false] };

  // Cast geometry.
  private P0 = v3(0, 0, 12);
  private C = v3();
  private F = v3(0, 0, -1);
  private R = v3(1, 0, 0);
  private Jc = v3();
  private Jf = v3(0, 0, 1);
  private Jp = v3(1, 0, 0);
  private yawJ = 0;
  private n = 1;
  private S = 1;
  private Rt = 13;
  private roofH = 8;
  private tp: THREE.Vector3[] = [];
  private slot = 0.45;
  private anchors: THREE.Vector3[] = [];
  private contact: THREE.Vector3[] = [];
  private lockT: number[] = [];
  private cannons: THREE.Vector3[] = [];
  private obst: { p: THREE.Vector3; r: number; h: number }[] = [];

  // Tent.
  private tent = new THREE.Group();
  private panels: Panel[] = [];
  private pole = new THREE.Group();
  private flag: THREE.Mesh;
  private ripples: ReturnType<typeof createRing>[] = [];
  private rippleShock: ShockRefraction;
  private wallTex: THREE.CanvasTexture[];
  private roofTex: THREE.CanvasTexture[];

  // Ring, box, jack.
  private curb = new THREE.Group();
  private box = new THREE.Group();
  private lid = new THREE.Group();
  private crank = new THREE.Group();
  private jackHead = new THREE.Group();
  private springMesh!: THREE.InstancedMesh;
  private bells: THREE.Mesh[] = [];

  // Light and fx.
  private spots: Spot[] = [];
  private jackSpot: Spot;
  private curtain: THREE.Mesh;
  private curtainMat: THREE.MeshBasicMaterial;
  private cannonMeshes: THREE.Group[] = [];
  private stars: StarBurst[] = [];
  private snapStar = new StarBurst({ points: 4, inner: 0.2, jitter: 0.15, color: RED, core: SPOT, additive: false });
  private burstStar = new StarBurst({ points: 8, inner: 0.3, jitter: 0.2, color: RED, core: SPOT, additive: false });
  private lungeShock: ShockRefraction[] = [];
  private finShock: ShockRefraction;
  private burstShock: ShockRefraction;
  private hitRings: ReturnType<typeof createRing>[] = [];
  private smoke = new SmokeBall({ maxBalls: 10, color: 0x120a14, rim: 0x3a2a40, flake: '#120a14' });
  private confR: Emitter;
  private confC: Emitter;
  private confG: Emitter;

  private js: JackState = { pos: v3(), yaw: 0, pitch: 0, roll: 0, sx: 1, sy: 1 };
  private tmpA = v3();
  private tmpB = v3();
  private tmpC = v3();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpM = new THREE.Matrix4();
  private dummy = new THREE.Object3D();

  constructor(settings: MidnightCircusSettings = defaultMidnightCircus()) {
    this.settings = settings;
    this.screen.tint.set(0x3a2048);
    this.screen.impactColor.set(RED);
    this.screen.edgeTint.set(RED);

    this.wallTex = [wallTexture('#b3263a', '#e0cfa4'), wallTexture('#e0cfa4', '#b3263a')];
    this.roofTex = [roofTexture('#a82236'), roofTexture('#d9c9a0')];

    this.group.add(this.tent);
    this.buildPole();
    this.flag = this.pole.children[1] as THREE.Mesh;
    this.group.add(this.pole);

    // Floor ripples and the ground refraction.
    for (const c of [RED, CREAM, GOLD]) {
      const r = createRing(c, 0.94, 1, 128);
      this.ripples.push(r);
      this.group.add(r.mesh);
    }
    this.rippleShock = new ShockRefraction({ facing: 'ground', width: 0.25 });
    this.group.add(this.rippleShock.mesh);

    this.buildRing();
    this.group.add(this.curb, this.box);
    this.buildJack();

    // Spotlights: one per enemy plus one for the box.
    const disc = discTexture();
    // Beam falloff: opaque at the apex (v = 1), fading to nothing toward the floor.
    const beam = canvasTexture(4, 128, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.6, '#555555');
      gr.addColorStop(1, '#000000');
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, 128);
    });
    beam.colorSpace = THREE.NoColorSpace;
    const mkSpot = (): Spot => {
      const coneMat = new THREE.MeshBasicMaterial({
        alphaMap: beam, color: SPOT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 28, 1, true).translate(0, -0.5, 0), coneMat);
      cone.frustumCulled = false;
      cone.visible = false;
      const floorMat = new THREE.MeshBasicMaterial({
        map: disc, color: 0xfff0c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), floorMat);
      floor.frustumCulled = false;
      floor.visible = false;
      floor.renderOrder = 2;
      this.group.add(cone, floor);
      return { cone, floor, coneMat, floorMat, apex: v3() };
    };
    for (let i = 0; i < MAXT; i++) this.spots.push(mkSpot());
    this.jackSpot = mkSpot();
    this.jackSpot.coneMat.color.set(0xffd890);
    this.jackSpot.floorMat.color.set(0xffd080);

    // Stars, refraction rings and ground rings for the hits.
    for (let i = 0; i < MAXT; i++) {
      const s = new StarBurst({ points: 8, inner: 0.3, jitter: 0.2, color: RED, core: SPOT, additive: false });
      this.stars.push(s);
      this.group.add(s.mesh);
      const sh = new ShockRefraction({ facing: 'camera', width: 0.3 });
      this.lungeShock.push(sh);
      this.group.add(sh.mesh);
      const ring = createRing(RED, 0.9, 1, 64);
      this.hitRings.push(ring);
      this.group.add(ring.mesh);
    }
    this.finShock = new ShockRefraction({ facing: 'camera', width: 0.3 });
    this.burstShock = new ShockRefraction({ facing: 'camera', width: 0.3 });
    this.group.add(this.finShock.mesh, this.burstShock.mesh, this.snapStar.mesh, this.burstStar.mesh);

    // Curtain, drawn in front of the camera.
    this.curtainMat = new THREE.MeshBasicMaterial({
      map: curtainTexture(), color: 0xdddddd, transparent: true, opacity: 1, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    });
    this.curtain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.curtainMat);
    this.curtain.renderOrder = 1000;
    this.curtain.frustumCulled = false;
    this.curtain.visible = false;
    this.group.add(this.curtain);

    // Confetti cannons (props) and confetti.
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x8a1c2e, roughness: 0.6, emissive: 0x240810 });
    const bandMat = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.5, emissive: 0x2a1c05 });
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Group();
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 1.6, 14).translate(0, 0.8, 0), cannonMat);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.18, 14).translate(0, 1.0, 0), bandMat);
      const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 14).translate(0, 1.6, 0), bandMat);
      c.add(barrel, band, mouth);
      const holder = new THREE.Group();
      holder.add(c);
      holder.visible = false;
      this.group.add(holder);
      this.cannonMeshes.push(holder);
    }
    const em = (colorStart: string, colorEnd: string) => {
      const e = new Emitter({
        ...defaultSettings(), rate: 0, shape: 'point', maxParticles: 900, lifetime: 7, lifetimeJitter: 0.25, speed: 15, speedJitter: 0.5,
        spread: 32, gravity: 3.2, drag: 1.3, sizeStart: 0.26, sizeEnd: 0.22, colorStart, colorEnd, opacityStart: 1, opacityEnd: 0.9,
        additive: false, sizeJitter: 0.4, groundFade: 0.12,
      });
      this.group.add(e.points);
      this.emitters.push(e);
      return e;
    };
    this.confR = em('#c8233a', '#9a1a2c');
    this.confC = em('#e8d8b0', '#d9c9a0');
    this.confG = em('#d9a441', '#c08f30');
    this.emitters.push(this.smoke.emitter);
    this.group.add(this.smoke.emitter.points, this.smoke.mesh);
    this.smoke.hold = 0.3;

    this.reset();
  }

  get duration() {
    return DURATION;
  }

  // --- Builders --------------------------------------------------------------------------------------------

  private buildPole() {
    const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.5, emissive: 0x2a1c05 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.2, 8).translate(0, 1.1, 0), gold);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.55);
    shape.lineTo(2.6, 0.05);
    shape.lineTo(0.2, -0.45);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape).translate(0, 1.55, 0);
    const flag = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xb3263a, side: THREE.DoubleSide }));
    this.pole.add(pole, flag);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8).translate(0, 2.25, 0), gold);
    this.pole.add(ball);
    this.pole.visible = false;
  }

  /** The circus ring curb and the gift box with its lid and crank (placed in cast()). */
  private buildRing() {
    const side = stripeTexture();
    const curb = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.7, 0.24, 48).translate(0, 0.12, 0),
      [
        new THREE.MeshStandardMaterial({ map: side, roughness: 0.8, emissive: 0x1a0a0c, emissiveMap: side }),
        new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 1 }),
        new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 1 }),
      ],
    );
    this.curb.add(curb);
    this.curb.visible = false;

    const tex = boxTexture();
    const side2 = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 });
    const top = new THREE.MeshStandardMaterial({ color: 0x2b1230, roughness: 0.8, emissive: 0x120614 });
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1).rotateX(-Math.PI / 2).translate(0, BOX_H + 0.01, 0), new THREE.MeshBasicMaterial({ color: 0x050206 }));
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, BOX_H, 2.6).translate(0, BOX_H / 2, 0), [side2, side2, top, top, side2, side2]);
    // Lid: hinged on the back top edge, opens by turning about X.
    this.lid.position.set(0, BOX_H, -1.3);
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(2.76, 0.3, 2.76).translate(0, 0.15, 1.3), [side2, side2, side2, top, side2, side2]);
    this.lid.add(lidMesh);
    // Crank on the front face (+Z): a short axle, an arm that turns and a gold knob.
    const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.45, emissive: 0x2a1c05 });
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 10).rotateX(Math.PI / 2).translate(0, 1.1, 1.55), gold);
    this.crank.position.set(0, 1.1, 1.88);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.95, 0.1).translate(0, 0.38, 0), gold);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10).translate(0, 0.86, 0.1), gold);
    this.crank.add(arm, knob);
    this.box.add(body, hole, this.lid, axle, this.crank);
    this.box.visible = false;
  }

  private buildJack() {
    const faceTex = faceTexture();
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.05, 40, 28), new THREE.MeshBasicMaterial({ map: faceTex, color: 0xdcdcdc }));
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10).translate(0, -0.2, 1.08), new THREE.MeshStandardMaterial({ color: 0xc8233a, roughness: 0.4, emissive: 0x401018 }));
    this.jackHead.rotation.order = 'YXZ';
    this.jackHead.add(head, nose);

    const goldMat = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.4, emissive: 0x4a3208 });
    const mats = [
      new THREE.MeshStandardMaterial({ color: 0xc8233a, roughness: 0.6, emissive: 0x4a0f18 }),
      new THREE.MeshStandardMaterial({ color: 0x3a1a58, roughness: 0.6, emissive: 0x1a0c2a }),
    ];
    // Jester hat: two bent horns, each ending in a gold bell.
    for (const s of [-1, 1]) {
      const m = mats[s === 1 ? 0 : 1];
      const p1 = new THREE.Group();
      p1.position.set(s * 0.5, 0.78, 0);
      p1.rotation.z = -s * 0.7;
      p1.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.58, 1.4, 14).translate(0, 0.7, 0), m));
      const p2 = new THREE.Group();
      p2.position.set(0, 1.4, 0);
      p2.rotation.z = -s * 0.95;
      p2.add(new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.3, 14).translate(0, 0.65, 0), m));
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10).translate(0, 1.36, 0), goldMat);
      p2.add(bell);
      this.bells.push(bell);
      p1.add(p2);
      this.jackHead.add(p1);
    }
    // Ruff collar: two pleated frusta, cream and red.
    const ruff1 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 1.2, 0.5, 16).translate(0, -1.0, 0), new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.8, flatShading: true, emissive: 0x2a2418 }));
    const ruff2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.75, 0.42, 16).translate(0, -1.4, 0), mats[0]);
    this.jackHead.add(ruff1, ruff2);
    this.jackHead.visible = false;
    this.group.add(this.jackHead);

    // Spring coils: instanced tilted rings along a curve.
    const coil = new THREE.MeshStandardMaterial({ color: 0xaab0bc, roughness: 0.4, metalness: 0.2, emissive: 0x20242c });
    this.springMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.55, 0.075, 7, 18).rotateX(Math.PI / 2), coil, MAXRING);
    this.springMesh.frustumCulled = false;
    this.springMesh.count = 0;
    this.springMesh.visible = false;
    this.group.add(this.springMesh);
  }

  /** Rebuilds the tent for the current cast: panels, valance textures, hinges. */
  private buildTent() {
    for (const p of this.panels) {
      this.tent.remove(p.pg);
      p.pg.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      p.wallMat.dispose();
      p.roofMat.dispose();
    }
    this.panels = [];
    const { Rt, roofH } = this;
    const w = ((Math.PI * 2) / NP) * 1.01;
    const aF = Math.atan2(this.F.x, this.F.z);
    const eave = Rt * 1.04;
    const wallGeo = new THREE.LatheGeometry([new THREE.Vector2(Rt, 0), new THREE.Vector2(Rt, WALL_H)], 4, -w / 2, w).translate(0, 0, -Rt);
    const roofGeo = new THREE.LatheGeometry([new THREE.Vector2(eave, WALL_H), new THREE.Vector2(0.001, WALL_H + roofH)], 4, -w / 2, w).translate(0, -WALL_H, -eave);
    for (let i = 0; i < NP; i++) {
      const a = (i / NP) * Math.PI * 2;
      const k = i % 2;
      const mk = (map: THREE.Texture) => new THREE.MeshStandardMaterial({
        map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.9, side: THREE.DoubleSide, color: 0xe0e0e0,
      });
      const wallMat = mk(this.wallTex[k]);
      const roofMat = mk(this.roofTex[k]);
      const pg = new THREE.Group();
      pg.rotation.y = a;
      const wallHinge = new THREE.Group();
      wallHinge.position.set(0, 0, Rt);
      wallHinge.add(new THREE.Mesh(wallGeo.clone(), wallMat));
      const roofHinge = new THREE.Group();
      roofHinge.position.set(0, WALL_H, eave - Rt);
      roofHinge.add(new THREE.Mesh(roofGeo.clone(), roofMat));
      wallHinge.add(roofHinge);
      pg.add(wallHinge);
      pg.visible = false;
      this.tent.add(pg);
      const ad = Math.abs(((a - aF + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      this.panels.push({ pg, wallHinge, roofHinge, wallMat, roofMat, delay: (ad / Math.PI) * 1.1, wx: Math.sin(a) * Rt, wz: Math.cos(a) * Rt });
    }
    wallGeo.dispose();
    roofGeo.dispose();
    this.pole.position.set(this.C.x, WALL_H + roofH - 0.2, this.C.z);
  }

  // --- Cast and camera keys --------------------------------------------------------------------------------

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.tp = ctx.targetPos.length ? ctx.targetPos.slice(0, MAXT).map((p) => p.clone().setY(0)) : [ctx.point.clone().setY(0)];
    this.n = this.tp.length;
    this.C.set(0, 0, 0);
    for (const p of this.tp) this.C.add(p);
    this.C.multiplyScalar(1 / this.n);
    this.P0.copy(ctx.from).setY(0);
    this.F.copy(this.C).sub(this.P0).setY(0);
    if (this.F.lengthSq() < 1e-4) this.F.set(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    if (this.F.lengthSq() < 1e-4) this.F.set(0, 0, -1);
    this.F.normalize();
    this.R.set(-this.F.z, 0, this.F.x);
    this.S = 0;
    for (const p of this.tp) this.S = Math.max(this.S, p.distanceTo(this.C));

    // The circus ring: beside the centroid when an enemy stands near it.
    let d = 0;
    for (; d < 6; d += 0.5) {
      this.Jc.copy(this.C).addScaledVector(this.R, d);
      if (this.tp.every((p) => p.distanceTo(this.Jc) >= 4.4)) break;
    }
    this.Jc.copy(this.C).addScaledVector(this.R, d).setY(0);
    // Tent radius; keep the wall off the caster.
    this.Rt = clamp(Math.max(this.S, d) + 8, 12, 19);
    const dp = this.P0.distanceTo(this.C);
    if (Math.abs(dp - this.Rt) < 2) {
      const lo = Math.max(this.S, d) + 6.5;
      this.Rt = dp - 2.2 >= lo ? dp - 2.2 : dp + 2.2;
    }
    this.roofH = this.Rt * 0.6;

    // The jack's front: the direction whose camera (7.8 out, inside the tent) has the clearest line to the box, so the
    // enemies and the caster never stand between the camera and the box. Ties go toward the caster side.
    let best = -1e9;
    for (let k = 0; k < 16; k++) {
      const dir = rotY(this.F.clone().negate(), (k / 16) * Math.PI * 2);
      const cam = this.Jc.clone().addScaledVector(dir, 7.8);
      if (cam.distanceTo(this.C) > this.Rt - 3.6) continue;
      let clear = 1e9;
      for (const q of [...this.tp, this.P0]) {
        const sx = this.Jc.x - cam.x, sz = this.Jc.z - cam.z;
        const u = clamp(((q.x - cam.x) * sx + (q.z - cam.z) * sz) / (sx * sx + sz * sz), 0, 1);
        clear = Math.min(clear, Math.hypot(q.x - (cam.x + sx * u), q.z - (cam.z + sz * u)));
      }
      const score = Math.min(clear, 6) + 0.01 * dir.dot(this.F.clone().negate());
      if (score > best) {
        best = score;
        this.Jf.copy(dir);
      }
    }
    if (best < -1e8) this.Jf.copy(this.F).negate();
    this.Jp.set(-this.Jf.z, 0, this.Jf.x);
    this.yawJ = Math.atan2(this.Jf.x, this.Jf.z);

    this.slot = Math.min(0.45, 2.6 / this.n);
    this.anchors = [];
    this.contact = [];
    this.lockT = [];
    for (let i = 0; i < this.n; i++) {
      const dir = this.tp[i].clone().sub(this.Jc).setY(0);
      if (dir.lengthSq() < 1e-3) dir.copy(this.Jf);
      dir.normalize();
      this.anchors.push(this.tp[i].clone().addScaledVector(dir, -1.7).setY(2.0));
      this.contact.push(this.tp[i].clone().addScaledVector(dir, -0.35).setY(1.8));
      this.lockT.push(8.0 + ((i + 1) * 1.9) / this.n);
    }
    this.cannons = [];
    for (let i = 0; i < 6; i++) {
      const dir = rotY(this.F.clone().negate(), (i / 6) * Math.PI * 2 + 0.3);
      this.cannons.push(this.C.clone().addScaledVector(dir, this.Rt * 0.46).setY(0));
    }
    this.obst = [
      ...this.tp.map((p) => ({ p, r: 1.9, h: 3.0 })),
      { p: this.P0, r: 1.9, h: 3.0 },
      { p: this.Jc, r: 2.8, h: 3.0 },
    ];

    this.tent.position.set(this.C.x, 0, this.C.z);
    this.buildTent();
    this.curb.position.copy(this.Jc);
    this.box.position.copy(this.Jc);
    this.box.rotation.y = this.yawJ;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.jackHead];
    this.buildKeys();
    this.reset();
  }

  private tentY(r: number) {
    return WALL_H + clamp((this.Rt - r) / this.Rt, 0, 1) * this.roofH;
  }

  /** Keeps an inside camera in the tent, clear of the walls and under the roof. */
  private keepInside(p: THREE.Vector3) {
    const dx = p.x - this.C.x, dz = p.z - this.C.z;
    const r = Math.hypot(dx, dz);
    const rmax = this.Rt - 3.6;
    if (r > rmax) {
      p.x = this.C.x + (dx / r) * rmax;
      p.z = this.C.z + (dz / r) * rmax;
    }
    p.y = Math.min(p.y, this.tentY(Math.min(r, rmax)) - 1.6);
  }

  /** Pushes a camera out of enemies, the caster and the box. */
  private clearOf(p: THREE.Vector3) {
    for (let k = 0; k < 2; k++) {
      for (const o of this.obst) {
        if (p.y > o.h) continue;
        const dx = p.x - o.p.x, dz = p.z - o.p.z;
        const hd = Math.hypot(dx, dz);
        if (hd < o.r) {
          const s = hd < 1e-4 ? 1 : o.r / hd;
          p.x = o.p.x + (hd < 1e-4 ? 1 : dx) * s;
          p.z = o.p.z + (hd < 1e-4 ? 0 : dz) * s;
        }
      }
    }
  }

  private buildKeys() {
    const keys: ShotKey[] = [];
    this.keys = keys;
    const { P0, C, F, R, Jc, Jf, Jp, Rt, S } = this;
    const up = (y: number) => v3(0, y, 0);
    const apexY = WALL_H + this.roofH;
    const key = (t: number, pos: THREE.Vector3, target: THREE.Vector3, fov: number, o: Opts = {}) => {
      const p = pos.clone();
      if (o.inside) this.keepInside(p);
      this.clearOf(p);
      if (p.y < 0.8) p.y = 0.8;
      const off = p.clone().sub(target);
      const lim = o.max ?? 24;
      if (off.length() > lim) p.copy(target).addScaledVector(off.normalize(), lim);
      keys.push({ t, position: p, target: target.clone(), fov, roll: 0, cut: !!o.cut, ease: o.ease ?? 'inOut' });
    };
    /** A shot sampled every `step` seconds from t0 to just before t1 (the first key is the cut). */
    const track = (t0: number, t1: number, step: number, fn: (t: number, k: number) => { pos: THREE.Vector3; look: THREE.Vector3; fov: number }, o: Opts = {}) => {
      const cnt = Math.max(1, Math.ceil((t1 - t0) / step));
      for (let j = 0; j <= cnt; j++) {
        const t = t0 + ((t1 - 0.001 - t0) * j) / cnt;
        const r = fn(t, (t - t0) / (t1 - t0));
        key(t, r.pos, r.look, r.fov, { ...o, cut: j === 0, ease: 'linear' });
      }
    };

    // 1. Calliope (0-1.1): behind the caster, the enemies far down the arena.
    const eye1 = (k: number) => P0.clone().addScaledVector(F, -(5.6 - 1.0 * k)).addScaledVector(R, 1.4 - 0.8 * k).add(up(2.5 - 0.4 * k));
    const look1 = P0.clone().addScaledVector(F, 1.6).add(up(1.5));
    key(0, eye1(0), look1, 44, { cut: true });
    key(PANELS0 - 0.001, eye1(1), look1, 44, { ease: 'linear' });

    // 2. Floor level among the enemies (1.1-3.0): the far panels burst up first.
    const c2 = (k: number) => C.clone().addScaledVector(F, -Rt * 0.36).addScaledVector(R, Rt * 0.16).add(up(1.1 + 0.6 * k));
    const l2 = (k: number) => C.clone().addScaledVector(F, Rt * 0.75).add(up(3.0 + 1.2 * k));
    key(PANELS0, c2(0), l2(0), 56, { cut: true, inside: true });
    key(3.0 - 0.001, c2(1), l2(1), 56, { ease: 'out', inside: true });

    // 3. Big top (3-6): wide from outside, a slow arc, the pennant and the roof in view.
    const dW = clamp(Rt * 2.5, 28, 46);
    const dir3 = v3(R.x * 0.8 - F.x * 0.6, 0, R.z * 0.8 - F.z * 0.6).normalize();
    track(3.0, 6.0, 0.25, (_t, k) => {
      const dir = rotY(dir3, lerp(-0.18, 0.22, k));
      const d = dW * (1 - 0.07 * k);
      const el = 0.42 - 0.05 * k;
      return { pos: C.clone().addScaledVector(dir, d * Math.cos(el)).add(up(d * Math.sin(el))), look: C.clone().add(up(apexY * 0.4)), fov: 50 };
    }, { max: 46 });

    // 4. Spotlights (6-10): inside, an orbit outside the enemy ring, looking at the middle.
    const rho4 = clamp(S + 3.5, Rt * 0.5, Rt - 3.8);
    const dir4 = F.clone().negate();
    track(SPOT0, HUSH, 0.2, (_t, k) => ({
      pos: C.clone().addScaledVector(rotY(dir4, 0.1 + 0.95 * k), rho4).add(up(3.2 + 1.3 * k)),
      look: C.clone().add(up(1.3)),
      fov: 54,
    }), { inside: true });

    // 5. Hush (10-11): the box, a slow push in, only the spotlights lit.
    const hush = (dist: number, side: number, y: number) => Jc.clone().addScaledVector(Jf, dist).addScaledVector(Jp, side).add(up(y));
    key(HUSH, hush(7.8, 1.6, 2.6), Jc.clone().add(up(1.5)), 42, { cut: true, inside: true });
    key(BURST - 0.001, hush(5.9, 1.0, 2.1), Jc.clone().add(up(1.5)), 42, { ease: 'linear', inside: true });

    // 6a. The lid bursts (11-11.75): low and to the side, looking up at the rising jack.
    const sideDir = rotY(Jf, 0.6);
    const low = (y: number) => Jc.clone().addScaledVector(sideDir, 8.6).add(up(y));
    key(BURST, low(1.0), Jc.clone().add(up(3.4)), 50, { cut: true, inside: true });
    key(GRIN - 0.001, low(1.6), Jc.clone().add(up(4.4)), 50, { ease: 'out', inside: true });

    // 6b. Close-up of the grin (11.75-12.3): in front of the face, tracking the sway.
    const rest = Jc.clone().add(up(REST_Y));
    track(GRIN, L0, 1 / 12, (t, k) => {
      const h = this.jackState(t, this.js).pos;
      const base = rest.clone().lerp(h, 0.55);
      return { pos: base.clone().addScaledVector(Jf, 4.8 - 0.8 * k).addScaledVector(Jp, 0.3), look: h.clone().add(up(-0.05)), fov: 38 };
    }, { inside: true });

    // 7. Lunges (12.3-15): tracking from the side, an orbit outside the action, never near the head.
    const Z1 = Jc.clone().lerp(C, 0.5);
    const rho7 = clamp(S * 0.9 + 9.5, 10.5, Rt - 3.8);
    const dir7 = rotY(Jf, 1.2);
    track(L0, FIN, 0.1, (t, k) => {
      const h = this.jackState(t, this.js).pos.clone();
      const pos = Z1.clone().addScaledVector(rotY(dir7, 1.1 * k), rho7).add(up(3.4 + 0.8 * k));
      const dh = pos.clone().sub(h);
      if (dh.length() < 5) pos.copy(h).addScaledVector(dh.normalize(), 5);
      return { pos, look: h.clone().lerp(Z1, 0.45).setY(h.y * 0.55 + 0.6), fov: 52 };
    }, { inside: true });

    // 8a. Finale (15-16): inside on the side opposite the ring, the jack spins and the roof peels.
    const away = Jc.clone().sub(C).setY(0);
    const dir8 = away.length() > 1 ? away.normalize().negate() : F.clone().negate();
    const mid8 = C.clone().lerp(Jc, 0.5);
    key(FIN, C.clone().addScaledVector(dir8, Math.min(Rt * 0.48, Rt - 3.8)).add(up(3.4)), mid8.clone().add(up(3.6)), 58, { cut: true, inside: true });
    key(16 - 0.001, C.clone().addScaledVector(dir8, Math.min(Rt * 0.62, Rt - 3.8)).add(up(4.6)), mid8.clone().add(up(3.4)), 58, { ease: 'out', inside: true });

    // 8b. High wide from outside (16-18.2): the petals lie flat, confetti, the jack spinning; the curtain falls over it.
    const dir9 = v3(-F.x * 0.8 + R.x * 0.5, 0, -F.z * 0.8 + R.z * 0.5).normalize();
    const hp = (k: number) => C.clone().addScaledVector(rotY(dir9, 0.25 * k), Rt * (1.45 - 0.1 * k)).add(up(Rt * 0.95));
    key(16, hp(0), C.clone().add(up(2.2)), 52, { cut: true, max: 46 });
    key(18.2 - 0.001, hp(1), C.clone().add(up(2.2)), 52, { ease: 'linear', max: 46 });

    // 9. The empty arena (18.2-20): the curtain is closed during the cut; a slow push in.
    const dirA = v3(-F.x * 0.6 + R.x * 0.8, 0, -F.z * 0.6 + R.z * 0.8).normalize();
    key(18.2, C.clone().addScaledVector(dirA, 14).add(up(4.8)), C.clone().add(up(1.3)), 50, { cut: true });
    key(DURATION - 0.001, C.clone().addScaledVector(dirA, 11.5).add(up(3.8)), C.clone().add(up(1.4)), 50, { ease: 'inOut' });
  }

  /** Danger zones: a circle at each target from 3 to 11.5. */
  telegraphSpecs(): TelegraphSpec[] {
    return this.tp.map((p) => ({ shape: { kind: 'circle', x: p.x, z: p.z, radius: 2 }, start: 3, impact: 11.5 }));
  }

  // --- Play / reset ----------------------------------------------------------------------------------------

  play() {
    this.reset();
    this.playing = true;
    this.cinematic.active = true;
    this.layout();
  }

  private reset() {
    this.time = 0;
    this.kick = 0;
    this.shake = 0;
    this.fired = { burst: false, fin: false, hit: this.tp.map(() => false), vol: [false, false, false] };
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    for (const e of this.emitters) e.clear();
    this.smoke.clear();
    this.layout();
  }

  private finish() {
    this.playing = false;
    clearScreenFx(this.screen);
    clearCinematic(this.cinematic);
    this.shake = 0;
    this.time = 0;
    this.layout();
  }

  update(dt: number) {
    for (const e of this.emitters) if (e !== this.smoke.emitter) e.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) {
        this.play();
        return;
      }
      this.finish();
      return;
    }
    this.kick *= Math.exp(-dt * 7);
    this.events(this.time);
    this.layout();
  }

  /** One-shot releases, fired when the clock crosses them. */
  private events(t: number) {
    const f = this.fired;
    if (!f.burst && t >= BURST) {
      f.burst = true;
      this.kick = Math.max(this.kick, 0.3);
      const at = this.tmpA.copy(this.Jc).setY(BOX_H + 0.4);
      this.confR.burst(30, at);
      this.confC.burst(30, at);
      this.confG.burst(20, at);
    }
    for (let i = 0; i < this.n; i++) {
      if (!f.hit[i] && t >= this.hitTime(i)) {
        f.hit[i] = true;
        this.kick = Math.max(this.kick, 0.2);
        const e = this.ctx?.targets[i];
        if (this.ctx && e) {
          this.ctx.hit(e, { damage: this.settings.lungeDamage, knock: 6, from: this.jackState(this.hitTime(i), this.js).pos.clone(), color: '#c8233a' });
        }
        this.smoke.trigger(this.tmpB.copy(this.contact[i]), 0.55, 0.7);
      }
    }
    if (!f.fin && t >= FIN + 0.1) {
      f.fin = true;
      this.kick = Math.max(this.kick, 0.45);
      const ctx = this.ctx;
      if (ctx) for (const e of ctx.targets) ctx.hit(e, { damage: this.settings.finaleDamage, knock: 8, color: '#d9a441' });
    }
    const vt = [FIN + 0.12, FIN + 0.5, FIN + 1.0];
    for (let k = 0; k < 3; k++) {
      if (f.vol[k] || t < vt[k]) continue;
      f.vol[k] = true;
      for (const c of this.cannons) {
        const at = this.tmpC.copy(c).setY(1.6);
        this.confR.burst(24, at);
        this.confC.burst(22, at);
        this.confG.burst(16, at);
      }
    }
  }

  private hitTime(i: number) {
    return L0 + i * this.slot + 0.38 * this.slot;
  }

  // --- The jack (a pure function of t) ---------------------------------------------------------------------

  private jackState(t: number, o: JackState): JackState {
    const { Jc, Jf, Jp } = this;
    const e = outBack((t - BURST) / 0.75);
    const w = ss(BURST + 0.4, GRIN + 0.3, t);
    o.pos.copy(Jc);
    o.pos.y = lerp(BOX_H - 0.1, REST_Y, e);
    o.pos.addScaledVector(Jp, Math.sin(t * 2.2) * 0.5 * w).addScaledVector(Jf, Math.cos(t * 1.7) * 0.3 * w);
    o.pos.y += Math.sin(t * 3) * 0.1 * w;
    o.yaw = this.yawJ + Math.sin(t * 1.3) * 0.25 * w;
    o.pitch = 0;
    o.roll = Math.sin(t * 2.2 + 1) * 0.12 * w;
    o.sx = o.sy = 1;
    // Lunges: out fast, a chomp, back.
    for (let i = 0; i < this.n; i++) {
      const u = (t - L0 - i * this.slot) / this.slot;
      if (u < 0 || u > 1) continue;
      const k = u < 0.38 ? outCubic(u / 0.38) : u < 0.58 ? 1 : 1 - ss(0.58, 1, u);
      const a = this.anchors[i];
      o.pos.lerp(a, k);
      const dir = this.tmpC.copy(this.tp[i]).sub(a).setY(0);
      const yawTo = dir.lengthSq() > 1e-4 ? Math.atan2(dir.x, dir.z) : this.yawJ;
      o.yaw = angLerp(o.yaw, yawTo, Math.min(1, k * 2));
      o.pitch = 0.5 * k;
      if (u >= 0.38 && u <= 0.58) {
        const c = Math.sin(((u - 0.38) / 0.2) * Math.PI);
        o.sx = 1 + 0.12 * c;
        o.sy = 1 - 0.16 * c;
      }
    }
    if (t >= FIN) {
      const tau = t - FIN;
      o.yaw += Math.PI * 6 * outCubic(tau / 1.8);
      o.pos.y += 1.3 * ss(0, 0.5, tau);
    }
    return o;
  }

  // --- Layout (pure function of time, apart from the releases above) ---------------------------------------

  private layout() {
    const on = this.playing;
    const t = on ? this.time : -1;
    const cin = this.cinematic;
    if (on) {
      sampleShots(this.keys, t, cin);
      cin.letterbox = ss(0.3, 0.9, t) * (1 - ss(19.3, 20, t));
      cin.active = t < DURATION;
    }
    this.layoutTent(t);
    this.layoutProps(t);
    this.layoutJack(t);
    this.layoutSpots(t);
    this.layoutHits(t);
    this.layoutCurtain(t);
    this.layoutScreen(t);
  }

  private layoutTent(t: number) {
    const on = this.playing && this.panels.length > 0;
    const cam = this.cinematic.position;
    const apexY = WALL_H + this.roofH;
    const eaveAng = Math.atan2(this.Rt, this.roofH);
    for (let i = 0; i < this.panels.length; i++) {
      const p = this.panels[i];
      const t0 = PANELS0 + p.delay;
      p.pg.visible = on && t >= t0 - 0.01 && t < GONE;
      const e = outCubic((t - t0) / 0.75);
      p.pg.position.y = -(apexY + 3) * (1 - e);
      // The finale: walls fall outward, then the roof folds out flat behind them.
      const tw = (t - FIN - 0.02 * i) / 0.9;
      const tr = (t - FIN - 0.12 - 0.02 * i) / 0.9;
      p.wallHinge.rotation.x = 1.54 * outCubic(tw);
      p.roofHinge.rotation.x = eaveAng * outCubic(tr);
      // Walls near the camera fade out so they never sit between it and the subject.
      let op = 1;
      if (on && t < FIN) {
        const dx = this.tent.position.x + p.wx - cam.x, dz = this.tent.position.z + p.wz - cam.z;
        op = ss(2.4, 5.2, Math.hypot(dx, dz));
      }
      // The lights go down: walls and roof fall to deep red-black, no emissive.
      const dk = on ? ss(DARK0, DARK0 + 1.6, t) : 0;
      for (const m of [p.wallMat, p.roofMat]) {
        m.color.setScalar(lerp(0.88, 0.1, dk));
        m.emissiveIntensity = 0.2 * (1 - dk);
      }
      p.wallMat.opacity = op;
      p.wallMat.transparent = op < 0.999;
      p.wallMat.depthWrite = op > 0.5;
    }
    // Pole and pennant.
    this.pole.visible = on && t >= PANELS0 + 1.1 && t < GONE;
    const tf = ss(3.0, 3.8, t);
    this.flag.scale.set(Math.max(0.01, tf), 1, 1);
    this.flag.rotation.y = Math.sin(t * 3.1) * 0.25 * tf;
    this.pole.position.y = apexY - 0.2 - (apexY + 3) * (1 - outCubic((t - PANELS0 - 1.1) / 0.75));
  }

  /** Floor ripples, the circus ring, the box with its crank and lid, the cannons, the snap. */
  private layoutProps(t: number) {
    const on = this.playing;
    const { Rt } = this;
    for (let i = 0; i < 3; i++) {
      const p = clamp((t - (PANELS0 + i * 0.28)) / 1.5, 0, 1);
      const r = this.ripples[i];
      r.mesh.position.set(this.C.x, 0.07 + i * 0.002, this.C.z);
      r.mesh.scale.setScalar(0.5 + Rt * 1.05 * outCubic(p));
      r.material.opacity = on && p > 0 && p < 1 ? 0.5 * (1 - p) : 0;
    }
    const q = clamp((t - PANELS0) / 1.8, 0, 1);
    this.rippleShock.set(this.tmpA.set(this.C.x, 0.05, this.C.z), 0.5 + Rt * 1.05 * outCubic(q), on && q > 0 && q < 1 ? 0.03 * (1 - q) * (1 - q) : 0);

    // Ring + box pop in under the rising tent.
    const pop = outBack((t - 2.0) / 0.7);
    this.curb.visible = this.box.visible = on && t >= 2.0 && t < GONE;
    this.curb.scale.set(pop, 1, pop);
    this.box.scale.setScalar(Math.max(0.001, pop));
    this.crank.rotation.z = -Math.PI * 2 * ss(10.1, 10.9, t);
    const open = outBack((t - BURST) / 0.25);
    const rattle = t > BURST - 0.12 && t < BURST ? Math.sin(t * 160) * 0.05 : 0;
    this.lid.rotation.x = -(1.95 * open) + rattle;

    // Cannons pop up just before the finale.
    const cp = ss(FIN - 0.4, FIN - 0.05, t);
    for (let i = 0; i < this.cannonMeshes.length; i++) {
      const m = this.cannonMeshes[i];
      const c = this.cannons[i];
      m.visible = on && !!c && t >= FIN - 0.4 && t < GONE;
      if (!c) continue;
      m.position.set(c.x, -1.7 * (1 - cp), c.z);
      const out = this.tmpA.copy(c).sub(this.C).setY(0).normalize();
      m.rotation.set(0, 0, 0);
      m.children[0].rotation.set(out.z * 0.14, 0, -out.x * 0.14);
    }

    // The snap: a small star at the caster's hand.
    const sa = t - SNAP;
    const hand = this.tmpB.copy(this.P0).addScaledVector(this.R, 0.55).addScaledVector(this.F, 0.45).setY(1.1);
    const sp = StarBurst.pop(sa, 0.08, 0.14);
    this.snapStar.set(hand, 0.55 * sp.scale, on && sa >= 0 ? sp.opacity : 0, 0.3);
  }

  private layoutJack(t: number) {
    const on = this.playing && this.n > 0;
    const live = on && t >= BURST - 0.02 && t < GONE;
    this.jackHead.visible = live;
    this.springMesh.visible = live;
    if (!live) {
      this.springMesh.count = 0;
      return;
    }
    const s = this.jackState(t, this.js);
    const h = this.jackHead;
    h.position.copy(s.pos);
    h.rotation.set(s.pitch, s.yaw, s.roll);
    h.scale.set(s.sx, s.sy, s.sx);
    for (let i = 0; i < this.bells.length; i++) this.bells[i].rotation.z = Math.sin(t * 14 + i) * 0.25;

    // Spring: coils along a curve from the box top to the neck.
    const B = this.tmpA.copy(this.Jc).setY(BOX_H);
    const N = this.tmpB.copy(s.pos).addScaledVector(v3(0, 1, 0), -0.95);
    if (t < BURST + 1) N.y = Math.max(N.y, B.y + 0.25);
    const len = B.distanceTo(N) * 1.12;
    const cnt = clamp(Math.ceil(len / 0.3), 2, MAXRING);
    const ctrl = this.tmpC.copy(B).addScaledVector(v3(0, 1, 0), clamp(0.5 * B.distanceTo(N), 1.2, 5));
    ctrl.x += (N.x - B.x) * 0.2;
    ctrl.z += (N.z - B.z) * 0.2;
    const d = this.dummy;
    const up = v3(0, 1, 0);
    const tan = v3();
    const tilt = this.tmpQ2.setFromAxisAngle(v3(1, 0, 0), 0.45);
    for (let i = 0; i < cnt; i++) {
      const u = (i + 0.5) / cnt;
      const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      d.position.set(a * B.x + b * ctrl.x + c * N.x, a * B.y + b * ctrl.y + c * N.y, a * B.z + b * ctrl.z + c * N.z);
      tan.set(
        2 * (1 - u) * (ctrl.x - B.x) + 2 * u * (N.x - ctrl.x),
        2 * (1 - u) * (ctrl.y - B.y) + 2 * u * (N.y - ctrl.y),
        2 * (1 - u) * (ctrl.z - B.z) + 2 * u * (N.z - ctrl.z),
      ).normalize();
      this.tmpQ.setFromUnitVectors(up, tan).multiply(tilt);
      d.quaternion.copy(this.tmpQ);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.springMesh.setMatrixAt(i, d.matrix);
    }
    this.springMesh.count = cnt;
    this.springMesh.instanceMatrix.needsUpdate = true;
  }

  private placeSpot(sp: Spot, target: THREE.Vector3, rb: number, coneOp: number, floorOp: number, k: number, tanHa = 0.158) {
    const d = this.tmpA.copy(target).sub(sp.apex);
    const L = d.length();
    sp.cone.position.copy(sp.apex);
    sp.cone.quaternion.setFromUnitVectors(v3(0, -1, 0), d.clone().normalize());
    sp.cone.scale.set(L * tanHa, L, L * tanHa);
    sp.coneMat.opacity = coneOp;
    sp.cone.visible = coneOp > 0.002;
    const cosPhi = clamp(sp.apex.y / Math.max(L, 1e-3), 0.25, 1);
    sp.floor.position.set(target.x, 0.06 + k * 0.002, target.z);
    sp.floor.rotation.y = Math.atan2(d.x, d.z);
    sp.floor.scale.set(rb, 1, rb / cosPhi);
    sp.floorMat.opacity = floorOp;
    sp.floor.visible = floorOp > 0.002;
  }

  /** Spotlights sweep the floor, then lock on each enemy; one more picks out the box. */
  private layoutSpots(t: number) {
    const on = this.playing && this.n > 0;
    const vis = on ? 1 - ss(FIN, FIN + 0.2, t) : 0;
    const rs = this.S + 4;
    const lockRadius = 1.9;
    for (let i = 0; i < MAXT; i++) {
      const sp = this.spots[i];
      if (i >= this.n || !on || vis <= 0.001) {
        sp.cone.visible = sp.floor.visible = false;
        continue;
      }
      const ang = i * 2.1 + t * (0.9 + 0.17 * i);
      const sweep = this.tmpC.set(this.C.x + Math.cos(ang) * rs, 0, this.C.z + Math.sin(ang * 0.8 + i) * rs * 0.8);
      const lk = ss(this.lockT[i] - 0.55, this.lockT[i], t);
      const target = this.tmpB.copy(sweep).lerp(this.tp[i], lk);
      const a0 = (i / MAXT) * Math.PI * 2 + 0.5;
      sp.apex.set(this.C.x + Math.cos(a0) * this.Rt * 0.4, this.tentY(this.Rt * 0.4) - 0.7, this.C.z + Math.sin(a0) * this.Rt * 0.4);
      // 2-3 beams sweep from 6; the rest fade in just before they lock; each goes out when its enemy is hit.
      const from = i < 3 ? SPOT0 - 0.3 : this.lockT[i] - 1.2;
      const dim = ss(from, from + 0.5, t) * (1 - ss(this.hitTime(i), this.hitTime(i) + 0.3, t));
      this.placeSpot(sp, target, lockRadius, 0.11 * vis * dim, 0.85 * vis * (0.5 + 0.5 * lk) * dim, i);
    }
    const js = this.jackSpot;
    const jv = on ? (0.3 * ss(HUSH - 0.4, HUSH, t) + 0.7 * ss(BURST, BURST + 0.15, t)) * (1 - ss(FIN, FIN + 0.2, t)) : 0;
    if (jv <= 0.001) {
      js.cone.visible = js.floor.visible = false;
    } else {
      const a = this.yawJ + Math.PI;
      js.apex.set(this.Jc.x + Math.sin(a) * 2.5, this.tentY(Math.hypot(this.Jc.x + Math.sin(a) * 2.5 - this.C.x, this.Jc.z + Math.cos(a) * 2.5 - this.C.z)) - 0.7, this.Jc.z + Math.cos(a) * 2.5);
      this.placeSpot(js, this.tmpC.copy(this.Jc), 2.7, 0.11 * jv, 0.8 * jv, MAXT, 0.2);
    }
  }

  /** Stars, refraction rings, ground rings at each lunge hit and at the finale; the burst at the lid. */
  private layoutHits(t: number) {
    const on = this.playing;
    for (let i = 0; i < MAXT; i++) {
      const live = on && i < this.n;
      const age = t - this.hitTime(i);
      const ageF = t - (FIN + 0.1);
      const pos = live ? this.contact[i] : this.P0;
      const posF = live ? this.tmpB.copy(this.tp[i]).setY(1.4) : this.P0;
      let size = 0, op = 0;
      let at = pos;
      if (live && age >= 0 && age < 0.35) {
        const p = StarBurst.pop(age, 0.05, 0.16);
        size = 1.3 * p.scale;
        op = p.opacity;
      } else if (live && ageF >= 0 && ageF < 0.35) {
        const p = StarBurst.pop(ageF, 0.05, 0.16);
        size = 1.1 * p.scale;
        op = p.opacity;
        at = posF;
      }
      this.stars[i].set(at, size, op, i * 0.7);
      const q = clamp(age / 0.4, 0, 1);
      this.lungeShock[i].set(pos, lerp(0.4, 3.2, outCubic(q)), live && age >= 0 && age < 0.4 ? 0.04 * (1 - q) * (1 - q) : 0);
      const ring = this.hitRings[i];
      const c = live ? this.tp[i] : this.P0;
      const rp = clamp(age / 0.5, 0, 1);
      ring.mesh.position.set(c.x, 0.09 + i * 0.002, c.z);
      ring.mesh.scale.setScalar(0.4 + 2.2 * outCubic(rp));
      ring.material.opacity = live && age >= 0 && age < 0.5 ? 0.55 * (1 - rp) : 0;
    }
    // Lid burst.
    const ba = t - BURST;
    const bp = StarBurst.pop(ba, 0.04, 0.14);
    this.burstStar.set(this.tmpA.copy(this.Jc).setY(BOX_H + 1.2), 1.6 * bp.scale, on && ba >= 0 ? bp.opacity : 0, 0.2);
    const bq = clamp(ba / 0.45, 0, 1);
    this.burstShock.set(this.tmpA.copy(this.Jc).setY(BOX_H + 1.2), lerp(0.5, 4.5, outCubic(bq)), on && ba >= 0 && ba < 0.45 ? 0.04 * (1 - bq) * (1 - bq) : 0);
    // The finale ring: wide, on the whole tent.
    const fa = t - (FIN + 0.1);
    const fq = clamp(fa / 0.9, 0, 1);
    this.finShock.set(this.tmpA.copy(this.Jc).setY(3), lerp(1, this.Rt * 1.3, outCubic(fq)), on && fa >= 0 && fa < 0.9 ? 0.05 * (1 - fq) * (1 - fq) : 0);
  }

  /** The velvet curtain: a plane held in front of the camera, lowered from above and lifted again. */
  private layoutCurtain(t: number) {
    const cin = this.cinematic;
    const fall = clamp((t - CURT0) / 0.7, 0, 1);
    const lift = ss(18.5, 19.3, t);
    const p = this.playing ? fall * fall * (1 - lift) : 0;
    this.curtain.visible = p > 0.001;
    if (!this.curtain.visible) return;
    const dist = 1.2;
    const fwd = this.tmpA.copy(cin.target).sub(cin.position).normalize();
    this.tmpM.lookAt(cin.position, cin.target, v3(0, 1, 0));
    this.curtain.quaternion.setFromRotationMatrix(this.tmpM);
    const camUp = this.tmpB.set(0, 1, 0).applyQuaternion(this.curtain.quaternion);
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cin.fov) / 2);
    const hc = visH * 1.3;
    const yb = lerp(visH / 2 + 0.02, -visH / 2 - 0.08 * visH, p);
    this.curtain.scale.set(visH * 4.2, hc, 1);
    this.curtain.position.copy(cin.position).addScaledVector(fwd, dist).addScaledVector(camUp, yb + hc / 2);
  }

  private layoutScreen(t: number) {
    const on = this.playing;
    const scr = this.screen;
    let d = 0.82 * ss(DARK0, DARK0 + 1.6, t);
    d += 0.1 * ss(HUSH - 0.4, HUSH, t);
    d -= 0.32 * ss(BURST, BURST + 0.3, t);
    d -= 0.0 * ss(FIN, FIN + 1.0, t);
    d -= 0.6 * ss(17, 18.2, t);
    scr.darken = on ? Math.max(0, d) : 0;
    scr.impact = on ? impactFrameAt(t, BURST, [1, 2], 0.04) || impactFrameAt(t, FIN + 0.1, [1, 2], 0.04) : 0;
    let ch = chromaPulse(t, FIN + 0.1, 0.55, 9);
    for (let i = 0; i < this.n; i++) ch = Math.max(ch, chromaPulse(t, this.hitTime(i), 0.3, 14));
    scr.chroma = on ? ch : 0;
    scr.speedLines = 0;
    if (on) scr.focus.copy(this.Jc).setY(3);
    const drum = t >= SPOT0 && t < HUSH ? 0.05 + 0.15 * ss(SPOT0, HUSH, t) : 0;
    this.shake = on ? drum + this.kick : 0;
  }
}

export const midnightCircusModule: EffectModule = {
  label: 'midnight circus',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: 6 },
  create: () => new MidnightCircus(),
  telegraphs(effect) {
    return (effect as MidnightCircus).telegraphSpecs();
  },
  bloom: { enabled: true, strength: 0.45, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as MidnightCircus;
    if (e.ctx) frameCast(camera, controls, e.ctx, 5);
  },
  buildGui(f, effect) {
    const s = (effect as MidnightCircus).settings;
    f.add(s, 'loop');
    f.add(s, 'lungeDamage', 1, 200, 1);
    f.add(s, 'finaleDamage', 1, 200, 1);
  },
};
