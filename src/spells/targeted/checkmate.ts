import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Checkmate (targeted, single enemy): the world darkens and an 8x8 marble chessboard flips in tile by tile from the
 * chosen enemy outward (the enemy stands on the centre of tile e5). Polished-ebony pieces with an ivory rim light
 * rise from the board and make three legal moves that all attack that tile: a rook slides along the rank, a bishop
 * along its diagonal, a knight hops in its L. Each arrival is a tap ring, a red check glint and a small hit. Then
 * the queen rises in the far corner, a thin red line traces her diagonal to the enemy, a dead beat, and she slides
 * the whole diagonal in 0.1 s and takes the tile: short impact frames, the tile shatters into chips, a ring pop and
 * the big hit. The pieces topple like tipped kings and sink, and the board flips away in a wave.
 *
 * Recipes: a-ow-doomfist-meteor-strike (the landing tile is marked before it is hit), g-castorice-dash-crescent-spike
 * (the sharp instant dash strike), i-toon-spiked-scribble-ring-pop (hard star plus ring pop on the hit).
 */
export interface CheckmateSettings {
  damage: number;
  loop: boolean;
}

export const defaultCheckmate = (): CheckmateSettings => ({
  damage: 90,
  loop: false,
});

// Timeline (seconds).
const D = 2.2; // impact: the queen lands on the target tile
const DURATION = 4.6;
const QUEEN_LINE0 = 1.85;
const QUEEN_LINE1 = 2.05;
const QUEEN_MOVE0 = 2.1;
const FLIP_AWAY = 3.0;

const S = 1.5; // tile size (m)
const TILE_H = 0.12;
const TOP = TILE_H + 0.005; // standing height of the pieces
const TARGET_TILE: [number, number] = [4, 4];

const ACCENT = 0xe0302a;
const IVORY_TILE = 0xd8d2c4;
const EBONY_TILE = 0x3a3834;
const IVORY_TRIM = 0x9d988b;
const RING = 0xcfc9bb;

const CHIPS = 14;
const CRACKS = 8;

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Faint grey veins on pale stone (128²). Multiplied by the instance colour; kept mid-bright so ivory stays below bloom. */
function marbleTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const rnd = lcg(11);
  g.fillStyle = '#dedcd4';
  g.fillRect(0, 0, 128, 128);
  g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    g.strokeStyle = `rgba(110,108,102,${0.18 + rnd() * 0.22})`;
    g.lineWidth = 0.8 + rnd() * 1.6;
    g.beginPath();
    let x = rnd() * 128, y = 0;
    g.moveTo(x, y);
    while (y < 128) {
      x += (rnd() - 0.5) * 26;
      y += 12 + rnd() * 16;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Polished ebony with an ivory fresnel rim (an "ivory rim light" that follows the camera). */
function ebonyMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: 0x24222a, roughness: 0.26, metalness: 0.15, emissive: 0x0c0b10, emissiveIntensity: 1,
  });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       totalEmissiveRadiance += vec3(0.74, 0.72, 0.66) * pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 3.0) * 0.55;`,
    );
  };
  return m;
}

const pts = (a: number[][]) => a.map(([r, y]) => new THREE.Vector2(r, y));
const lathe = (a: number[][]) => new THREE.LatheGeometry(pts(a), 40);

/** Shared pawn-like foot of every piece, ending in a collar at y = 0.42. */
const FOOT = [[0, 0], [0.58, 0], [0.6, 0.05], [0.58, 0.12], [0.46, 0.18], [0.5, 0.22], [0.5, 0.26], [0.36, 0.34], [0.3, 0.42]];

interface PieceDef {
  kind: 'rook' | 'bishop' | 'knight' | 'queen';
  start: [number, number];
  end: [number, number];
  rise0: number;
  rise1: number;
  mv0: number;
  mv1: number;
  hop: number;
  height: number;
  /** Local direction the piece falls when it topples (away from the target). */
  fall: THREE.Vector2;
  topple0: number;
}

const PIECES: PieceDef[] = [
  // Rook: file 0 → 3 along rank 5 (e5's rank).
  { kind: 'rook', start: [0, 4], end: [3, 4], rise0: 0.7, rise1: 0.92, mv0: 0.95, mv1: 1.2, hop: 0, height: 2.25, fall: new THREE.Vector2(-1, 0), topple0: 2.75 },
  // Bishop: (7,1) → (5,3), the long diagonal that passes through the target tile.
  { kind: 'bishop', start: [7, 1], end: [5, 3], rise0: 0.85, rise1: 1.07, mv0: 1.25, mv1: 1.5, hop: 0, height: 2.7, fall: new THREE.Vector2(1, -1), topple0: 2.95 },
  // Knight: (7,5) → (5,6): an L (two files, one rank), attacks (4,4).
  { kind: 'knight', start: [7, 5], end: [5, 6], rise0: 1.0, rise1: 1.22, mv0: 1.5, mv1: 1.8, hop: 1.5, height: 2.4, fall: new THREE.Vector2(1, 1), topple0: 3.15 },
  // Queen: far corner → the target tile along the whole diagonal.
  { kind: 'queen', start: [7, 7], end: TARGET_TILE, rise0: 1.65, rise1: 2.0, mv0: QUEEN_MOVE0, mv1: D, hop: 0, height: 2.75, fall: new THREE.Vector2(1, 1), topple0: 3.4 },
];
const ARRIVE = [PIECES[0].mv1, PIECES[1].mv1, PIECES[2].mv1];

export class Checkmate implements Effect {
  readonly group = new THREE.Group();
  readonly settings: CheckmateSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private arrived = [false, false, false];
  private risen = [false, false, false, false];
  private center = new THREE.Vector3();
  private aim = 0;

  /** Everything on the board lives here, in board space: +x = file, +z = rank (away from the caster). */
  private board = new THREE.Group();
  private tiles: THREE.InstancedMesh;
  private tileDist: number[] = [];
  private chips: THREE.InstancedMesh;
  private chipState = Array.from({ length: CHIPS }, () => ({
    p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(),
  }));
  private pit: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private cracks: THREE.InstancedMesh;
  private crackSeed = Array.from({ length: CRACKS }, (_, i) => ({
    a: (i / CRACKS) * Math.PI * 2 + (Math.random() - 0.5) * 0.4, len: 1.0 + Math.random() * 1.4,
  }));

  private pieces: THREE.Group[] = [];
  private queenLine: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private rings: ReturnType<typeof createRing>[] = [];
  private glints: StarBurst[] = [];
  private pop = createRing(RING, 0.84, 1, 96);
  private pop2 = createRing(ACCENT, 0.94, 1, 96);
  private hitStar = new StarBurst({ points: 10, inner: 0.3, color: ACCENT, core: 0xf4efe4, additive: false });

  private dust: Emitter;
  private sparks: Emitter;

  // Scratch.
  private m4 = new THREE.Matrix4();
  private qa = new THREE.Quaternion();
  private v3 = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private eu = new THREE.Euler();
  private axis = new THREE.Vector3();

  constructor(settings: CheckmateSettings = defaultCheckmate()) {
    this.settings = settings;
    this.screen.tint.set(0x1c1c26);
    this.screen.impactColor.set(ACCENT);
    this.screen.speedLineColor.set(0xf4efe4);
    this.screen.edgeTint.set(ACCENT);
    this.group.add(this.board);

    // --- The board: 64 instanced marble tiles, ivory and ebony. ---
    const tileMat = new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.34, metalness: 0 });
    this.tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(S * 0.98, TILE_H, S * 0.98), tileMat, 64);
    this.tiles.frustumCulled = false;
    const ivory = new THREE.Color(IVORY_TILE), ebony = new THREE.Color(EBONY_TILE);
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        this.tiles.setColorAt(i + j * 8, (i + j) % 2 === 0 ? ebony : ivory);
        this.tileDist.push(Math.hypot(i - TARGET_TILE[0], j - TARGET_TILE[1]));
      }
    }
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
    this.board.add(this.tiles);

    // Pit under the shattered tile, cracks that run over the neighbours, chips of the broken tile.
    this.pit = new THREE.Mesh(
      new THREE.PlaneGeometry(S * 0.98, S * 0.98).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.pit.position.set(0, 0.02, 0);
    this.board.add(this.pit);
    this.cracks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.01, 1), new THREE.MeshBasicMaterial({ color: 0x050505 }), CRACKS,
    );
    this.cracks.frustumCulled = false;
    this.board.add(this.cracks);
    const chipMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0 });
    this.chips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.12, 0.38), chipMat, CHIPS);
    this.chips.frustumCulled = false;
    for (let i = 0; i < CHIPS; i++) this.chips.setColorAt(i, i % 3 === 0 ? ivory : ebony);
    if (this.chips.instanceColor) this.chips.instanceColor.needsUpdate = true;
    this.group.add(this.chips);

    // --- The pieces. ---
    const body = ebonyMaterial();
    const trim = new THREE.MeshStandardMaterial({ color: IVORY_TRIM, roughness: 0.4, metalness: 0 });
    for (const def of PIECES) {
      const g = this.buildPiece(def.kind, body, trim);
      g.visible = false;
      this.pieces.push(g);
      this.board.add(g);
    }
    this.screen.silhouettes = [];

    // --- The queen's line, tap rings, check glints, impact pop. ---
    this.queenLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.queenLine.position.y = 0.135;
    this.queenLine.renderOrder = 5;
    this.board.add(this.queenLine);
    for (let i = 0; i < 3; i++) {
      const r = createRing(RING, 0.84, 1, 64);
      r.mesh.position.y = 0.14;
      r.material.opacity = 0;
      this.rings.push(r);
      const gl = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: ACCENT, core: 0xf4efe4, additive: false });
      this.glints.push(gl);
      this.board.add(r.mesh, gl.mesh);
    }
    for (const r of [this.pop, this.pop2]) {
      r.mesh.position.y = 0.14;
      r.material.opacity = 0;
      this.board.add(r.mesh);
    }
    this.board.add(this.hitStar.mesh);

    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 0.9, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.4, speed: 2.2, speedJitter: 0.6, spread: 80, gravity: -0.1, drag: 2,
      sizeStart: 0.35, sizeEnd: 0.9, colorStart: '#8a867c', colorEnd: '#3a3834',
      opacityStart: 0.28, opacityEnd: 0, additive: false, colorMid: '#5a5750', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 0.6, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.3, speed: 9, speedJitter: 0.6, spread: 85, gravity: 12, drag: 1.2,
      sizeStart: 0.1, sizeEnd: 0.02, colorStart: '#f4efe4', colorEnd: '#b8b4ac',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.emitters.push(this.dust, this.sparks);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  private buildPiece(kind: PieceDef['kind'], body: THREE.Material, trim: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    const collar = (y: number, r: number) => {
      const t = add(new THREE.TorusGeometry(r, 0.035, 8, 40), trim, 0, y, 0);
      t.rotation.x = Math.PI / 2;
    };
    if (kind === 'rook') {
      add(lathe([...FOOT, [0.34, 0.5], [0.28, 0.8], [0.26, 1.3], [0.34, 1.42], [0.5, 1.55], [0.5, 1.95], [0.38, 1.95], [0.38, 1.82], [0, 1.82]]), body);
      collar(1.45, 0.38);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const m = add(new THREE.BoxGeometry(0.22, 0.3, 0.1), body, Math.sin(a) * 0.45, 2.1, Math.cos(a) * 0.45);
        m.rotation.y = a;
      }
    } else if (kind === 'bishop') {
      add(lathe([...FOOT, [0.34, 0.5], [0.22, 0.9], [0.2, 1.3], [0.34, 1.42], [0.22, 1.5]]), body);
      collar(1.45, 0.36);
      const mitre: number[][] = [];
      for (let k = 0; k <= 14; k++) {
        const f = (k / 14) * Math.PI;
        mitre.push([0.42 * Math.sin(f) * (1 - 0.35 * (f / Math.PI)), 1.5 + (1 - Math.cos(f)) * 0.55]);
      }
      add(lathe(mitre), body);
      add(new THREE.SphereGeometry(0.1, 14, 10), trim, 0, 2.68, 0);
      // The slit: a thin ivory cut across the mitre, visible from the front and back.
      const slit = add(new THREE.BoxGeometry(0.035, 0.6, 0.9), trim, 0, 2.05, 0);
      slit.rotation.z = 0.6;
    } else if (kind === 'knight') {
      add(lathe([...FOOT, [0.45, 0.5], [0.45, 0.58], [0, 0.58]]), body);
      collar(0.5, 0.45);
      const head = new THREE.Shape();
      head.moveTo(-0.4, 0);
      for (const [x, y] of [
        [0.4, 0], [0.38, 0.35], [0.55, 0.62], [0.98, 0.74], [1.05, 0.92], [0.9, 1.08], [0.55, 1.28],
        [0.42, 1.52], [0.28, 1.3], [0.1, 1.3], [-0.12, 1.0], [-0.34, 0.6],
      ]) head.lineTo(x, y);
      head.closePath();
      const geo = new THREE.ExtrudeGeometry(head, {
        depth: 0.4, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3,
      });
      geo.translate(0, 0, -0.2);
      const horse = add(geo, body, 0, 0.56, 0);
      horse.scale.setScalar(1.15);
      horse.rotation.y = Math.PI - 0.5;
      for (const sz of [-1, 1]) {
        const eye = add(new THREE.SphereGeometry(0.045, 8, 6), trim, 0, 0, 0);
        const p = new THREE.Vector3(0.62, 1.08, sz * 0.27).multiplyScalar(1.15);
        p.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - 0.5);
        eye.position.set(p.x, p.y + 0.56, p.z);
      }
    } else {
      add(lathe([...FOOT, [0.34, 0.6], [0.22, 1.4], [0.3, 1.6], [0.5, 1.95], [0.52, 2.15], [0.4, 2.25], [0.2, 2.28], [0, 2.28]]), body);
      collar(1.52, 0.3);
      collar(0.45, 0.31);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const x = Math.sin(a), z = Math.cos(a);
        const cone = add(new THREE.ConeGeometry(0.07, 0.4, 8), body, x * 0.44, 2.32, z * 0.44);
        cone.rotation.set(z * 0.22, 0, -x * 0.22);
        add(new THREE.SphereGeometry(0.065, 8, 6), trim, x * 0.5, 2.55, z * 0.5);
      }
      add(new THREE.SphereGeometry(0.15, 16, 12), body, 0, 2.5, 0);
    }
    return g;
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  /** Board space → world, for particles and hit origins (board +z points from the caster toward the target). */
  private toWorld(lx: number, lz: number, out = new THREE.Vector3()): THREE.Vector3 {
    const c = Math.cos(this.aim), s = Math.sin(this.aim);
    return out.set(this.center.x + lx * c + lz * s, 0, this.center.z - lx * s + lz * c);
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.targetPos[0] ?? ctx.point).setY(0);
    this.aim = Number.isFinite(ctx.aim) ? ctx.aim : Math.PI;
    this.board.position.copy(this.center);
    this.board.rotation.y = this.aim;
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group), this.pieces[3]];
    this.screen.focus.set(this.center.x, 1.2, this.center.z);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.arrived = [false, false, false];
    this.risen = [false, false, false, false];
    this.shake = 0;
    clearScreenFx(this.screen);
    for (const e of this.emitters) e.clear();
    for (const c of this.chipState) c.p.set(0, -50, 0);
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
    PIECES.forEach((p, i) => {
      if (!this.risen[i] && this.time >= p.rise1) {
        this.risen[i] = true;
        const w = this.toWorld(...this.tileXZ(p.start));
        this.dust.burst(10, w.setY(0.2));
      }
    });
    ARRIVE.forEach((at, i) => {
      if (!this.arrived[i] && this.time >= at) this.onArrive(i);
    });
    if (!this.impacted && this.time >= D) this.onImpact();
    this.layout(dt);
  }

  private tileXZ(t: [number, number]): [number, number] {
    return [(t[0] - TARGET_TILE[0]) * S, (t[1] - TARGET_TILE[1]) * S];
  }

  private onArrive(i: number) {
    this.arrived[i] = true;
    const w = this.toWorld(...this.tileXZ(PIECES[i].end));
    this.dust.burst(14, w.clone().setY(0.2));
    const ctx = this.ctx;
    if (!ctx || !ctx.targets[0]) return;
    ctx.hit(ctx.targets[0], { damage: 6, knock: 1.5, from: w });
  }

  private onImpact() {
    this.impacted = true;
    const c = this.center;
    this.sparks.burst(140, new THREE.Vector3(c.x, 0.3, c.z));
    this.dust.burst(30, new THREE.Vector3(c.x, 0.2, c.z));
    // The target tile breaks into chips.
    for (const ch of this.chipState) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2.5 + Math.random() * 5;
      ch.p.set(c.x, 0.3, c.z);
      ch.v.set(Math.cos(a) * sp, 5 + Math.random() * 6, Math.sin(a) * sp);
      ch.w.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      ch.r.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    }
    const ctx = this.ctx;
    if (!ctx) return;
    const from = this.toWorld(...this.tileXZ(PIECES[3].start));
    ctx.targets.forEach((e, i) => {
      const tp = ctx.targetPos[i] ?? c;
      const origin = from.distanceToSquared(tp) < 0.09 ? new THREE.Vector3(tp.x + 1, 0, tp.z + 1) : from;
      ctx.hit(e, { damage: this.settings.damage, knock: 6, from: origin });
    });
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const BIG = Math.max(0, after);

    // --- The world darkens for the whole build-up and drains while the board flips away. ---
    this.screen.darken = 0.6 * smoothstep(t / 0.7) * (1 - smoothstep((t - FLIP_AWAY) / 1.2));

    // --- The board: tiles flip up from edge-on outward from the target, and away again in a wave. ---
    for (let n = 0; n < 64; n++) {
      const i = n % 8, j = Math.floor(n / 8);
      const d = this.tileDist[n];
      const k = smoothstep((t - d * 0.06) / 0.36);
      const kk = smoothstep((t - FLIP_AWAY - d * 0.1) / 0.55);
      const isTarget = i === TARGET_TILE[0] && j === TARGET_TILE[1];
      let s = (k < 0.002 || kk > 0.995) ? 1e-4 : 1 - smoothstep((kk - 0.45) / 0.55);
      if (isTarget && this.impacted) s = 1e-4;
      s = Math.max(1e-4, s);
      this.eu.set(-(1 - k) * Math.PI / 2 + kk * Math.PI, 0, 0);
      this.qa.setFromEuler(this.eu);
      this.v3.set((i - TARGET_TILE[0]) * S, TILE_H / 2 + (1 - k) * 0.5 + Math.sin(kk * Math.PI) * 0.9, (j - TARGET_TILE[1]) * S);
      this.m4.compose(this.v3, this.qa, this.sc.setScalar(s));
      this.tiles.setMatrixAt(n, this.m4);
    }
    this.tiles.instanceMatrix.needsUpdate = true;

    // --- The pieces: rise, move, topple, sink. ---
    PIECES.forEach((def, idx) => {
      const g = this.pieces[idx];
      const rp = THREE.MathUtils.clamp((t - def.rise0) / (def.rise1 - def.rise0), 0, 1);
      const re = 1 - Math.pow(1 - rp, 3);
      const mp = THREE.MathUtils.clamp((t - def.mv0) / (def.mv1 - def.mv0), 0, 1);
      const me = def.kind === 'queen' ? Math.pow(mp, 2.2) : mp * mp * (3 - 2 * mp);
      const [sx, sz] = this.tileXZ(def.start);
      const [ex, ez] = this.tileXZ(def.end);
      let y = TOP - def.height * 1.25 * (1 - re) + def.hop * Math.sin(Math.PI * mp);
      const tp = THREE.MathUtils.clamp((t - def.topple0) / 0.55, 0, 1);
      const phi = (Math.PI / 2) * tp * tp;
      const sink = 3.4 * smoothstep((t - def.topple0 - 0.7) / 0.9);
      y += 0.55 * Math.sin(phi) - sink;
      g.position.set(sx + (ex - sx) * me, y, sz + (ez - sz) * me);
      this.axis.set(def.fall.y, 0, -def.fall.x).normalize();
      g.quaternion.setFromAxisAngle(this.axis, phi);
      g.visible = rp > 0 && sink < 3.3;
    });

    // --- The queen's red line: traced along her diagonal, gone with the strike. ---
    {
      const [sx, sz] = this.tileXZ(PIECES[3].start);
      const [ex, ez] = this.tileXZ(PIECES[3].end);
      const h = smoothstep((t - QUEEN_LINE0) / (QUEEN_LINE1 - QUEEN_LINE0));
      const len = Math.hypot(ex - sx, ez - sz) * h;
      const dir = Math.atan2(ex - sx, ez - sz);
      this.queenLine.rotation.y = dir;
      this.queenLine.scale.set(1, 1, Math.max(1e-3, len));
      this.queenLine.position.set(sx + Math.sin(dir) * len / 2, 0.135, sz + Math.cos(dir) * len / 2);
      const op = after < 0 ? 0.9 * smoothstep((t - QUEEN_LINE0) / 0.05) : Math.max(0, 0.9 * (1 - after / 0.18));
      this.queenLine.material.opacity = op;
      this.queenLine.visible = op > 0.01;
    }

    // --- Arrivals: tap ring, red check glint above the piece. ---
    for (let i = 0; i < 3; i++) {
      const age = t - ARRIVE[i];
      const [ex, ez] = this.tileXZ(PIECES[i].end);
      const r = this.rings[i];
      r.mesh.position.set(ex, 0.14, ez);
      r.mesh.scale.setScalar(0.5 + Math.max(0, age) * 4);
      r.material.opacity = age > 0 && age < 0.45 ? 0.7 * (1 - age / 0.45) : 0;
      const pop = StarBurst.pop(age, 0.1, 0.2);
      this.glints[i].set(this.v3.set(ex, PIECES[i].height * 0.92 + 0.3, ez), 1.1 * pop.scale, pop.opacity, 0.2);
    }

    // --- Impact: short frames, hard star, ring pop, chips, pit and cracks. ---
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D, 0.6, 12);
    this.screen.speedLines = after < 0
      ? 0.5 * smoothstep((t - QUEEN_LINE0) / 0.35)
      : Math.max(0, 0.5 - after * 5);

    const star = StarBurst.pop(after - 0.04, 0.08, 0.16);
    this.hitStar.set(this.v3.set(0, 1.3, 0), 3.2 * star.scale, star.opacity, 0.3);
    const pe = 1 - Math.pow(1 - THREE.MathUtils.clamp((after - 0.04) / 0.45, 0, 1), 3);
    this.pop.mesh.position.set(0, 0.14, 0);
    this.pop.mesh.scale.setScalar(0.7 + 5 * pe);
    this.pop.material.opacity = after > 0.04 && after < 0.49 ? 0.75 * (1 - (after - 0.04) / 0.45) : 0;
    const pe2 = 1 - Math.pow(1 - THREE.MathUtils.clamp((after - 0.1) / 0.35, 0, 1), 3);
    this.pop2.mesh.position.set(0, 0.15, 0);
    this.pop2.mesh.scale.setScalar(0.5 + 3.4 * pe2);
    this.pop2.material.opacity = after > 0.1 && after < 0.45 ? 0.7 * (1 - (after - 0.1) / 0.35) : 0;

    const fadeAway = 1 - smoothstep((t - 3.3) / 0.7);
    this.pit.material.opacity = this.impacted ? Math.min(1, after / 0.05) * fadeAway : 0;
    const grow = after < 0 ? 0 : smoothstep(after / 0.18);
    for (let i = 0; i < CRACKS; i++) {
      const c = this.crackSeed[i];
      const l = Math.max(1e-4, c.len * grow * fadeAway);
      const rot = this.qa.setFromAxisAngle(this.axis.set(0, 1, 0), c.a);
      this.v3.set(Math.sin(c.a) * l / 2, TILE_H + 0.012, Math.cos(c.a) * l / 2);
      this.m4.compose(this.v3, rot, this.sc.set(grow > 0 ? 0.07 : 1e-4, 1, l));
      this.cracks.setMatrixAt(i, this.m4);
    }
    this.cracks.instanceMatrix.needsUpdate = true;

    const chipFade = 1 - smoothstep((t - D - 1.2) / 0.6);
    const q0 = new THREE.Quaternion();
    for (let i = 0; i < CHIPS; i++) {
      const ch = this.chipState[i];
      if (dt > 0 && ch.p.y > -10) {
        ch.v.y -= 22 * dt;
        ch.p.addScaledVector(ch.v, dt);
        if (ch.p.y < 0.08) { ch.p.y = 0.08; ch.v.set(0, 0, 0); ch.w.set(0, 0, 0); }
        ch.r.set(ch.r.x + ch.w.x * dt, ch.r.y + ch.w.y * dt, ch.r.z + ch.w.z * dt);
      }
      this.m4.compose(ch.p, q0.setFromEuler(ch.r), this.sc.setScalar(Math.max(1e-4, (0.6 + (i % 4) * 0.2) * chipFade)));
      this.chips.setMatrixAt(i, this.m4);
    }
    this.chips.instanceMatrix.needsUpdate = true;

    let shake = BIG > 0 || after >= 0 ? 0.9 * Math.exp(-BIG * 7) : 0;
    for (let i = 0; i < 3; i++) {
      const a = t - ARRIVE[i];
      if (a > 0) shake = Math.max(shake, 0.12 * Math.exp(-a * 9));
    }
    this.shake = shake;
  }
}

export const checkmateModule: EffectModule = {
  label: 'checkmate',
  category: 'targeted',
  targeting: { mode: 'enemy' },
  create: () => new Checkmate(),
  telegraphs(effect) {
    const e = effect as Checkmate;
    const c = e.ctx?.targetPos[0] ?? e.ctx?.point;
    if (!c) return [];
    return [{ shape: { kind: 'circle', x: c.x, z: c.z, radius: 1.8 }, start: 0.1, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.5, radius: 0.45, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as Checkmate;
    if (e.ctx) frameCast(camera, controls, e.ctx, 4);
  },
  buildGui(f, effect) {
    const s = (effect as Checkmate).settings;
    f.add(s, 'loop');
    f.add(s, 'damage', 1, 150, 1);
  },
};
