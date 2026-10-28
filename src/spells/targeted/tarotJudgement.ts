import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import { createRing, smoothstep } from '../../effects/common';
import {
  CrescentArc, LightningArc, SmokeBall, StarBurst, chromaPulse, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Tarot Judgement (targeted, `enemies`, up to five targets): five giant tarot cards (backs showing: violet with a
 * gilt lattice) fan out of the caster's hand, fly to the enemies spinning and stand upright behind each one,
 * their backs to the caster. They land with a small tick, then all flip at once to show their faces (sun, moon,
 * tower, star, wheel: gilt, violet and teal on black lacquer, drawn on canvas). After a one-beat pause every card
 * shatters into gilt shards while its arcana bursts out in colour (sun star, moon crescent, tower bolt, star
 * glint, spinning wheel) with a short impact frame and a big hit. The shards flutter down and the world clears.
 *
 * Cards are unlit textured planes (materials, below the bloom threshold); white is only in tiny cores.
 */
export interface TarotJudgementSettings {
  tickDamage: number;
  damage: number;
  loop: boolean;
}

export const defaultTarotJudgement = (): TarotJudgementSettings => ({ tickDamage: 6, damage: 40, loop: false });

const CARDS = 5;
const D = 2.0; // all cards shatter together
const DURATION = 4.6;
const SHARDS_PER = 14;
const CARD_W = 1.7;
const CARD_H = 2.8;
const STAND_Y = 2.4; // card centre above the target's feet
const BEHIND = 1.5; // card stands this far behind its enemy (away from the caster) so the enemy stays visible

const GILT = 0xd8a83a;
const GILT_HI = 0xffe8a8;
const VIOLET = 0x5a2a8a;
const VIOLET_HI = 0x8a5ad0;
const TEAL = 0x3ad0c0;
const TEAL_HI = 0xbff4ee;
const BLACK = 0x0c0814;

type Kind = 'sun' | 'moon' | 'tower' | 'star' | 'wheel';
const KINDS: Kind[] = ['sun', 'moon', 'tower', 'star', 'wheel'];

const fanAt = (i: number) => 0.1 + 0.08 * i;
const departAt = (i: number) => 0.7 + 0.07 * i;
const arriveAt = (i: number) => 1.3 + 0.07 * i;
const flipAt = (i: number) => 1.6 + 0.02 * i;
const FLIP_TIME = 0.26;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3);
const easeOutBack = (x: number) => {
  const k = THREE.MathUtils.clamp(x, 0, 1) - 1;
  return 1 + 2.2 * k * k * k + 1.2 * k * k;
};
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

function makeCanvas(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  return { cv, g };
}

function toTexture(cv: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  const p = new Path2D();
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
  p.closePath();
  return p;
}

/** A pointed star path with `n` spikes (outer radius ro, inner ri), rotated by `rot`. */
function starPath(cx: number, cy: number, n: number, ro: number, ri: number, rot = -Math.PI / 2) {
  const p = new Path2D();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? ro : ri;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

/** Fill, then a hard black outline: the drawn-shape look of the art bible. */
function fillOutline(g: CanvasRenderingContext2D, path: Path2D, fill: string, lw = 7) {
  g.fillStyle = fill;
  g.fill(path);
  g.lineWidth = lw;
  g.strokeStyle = '#000000';
  g.stroke(path);
}

/** A crescent as its own canvas: a disc with a disc cut out (black outline version drawn bigger underneath). */
function crescentCanvas(S: number, color: string, ro: number, rc: number, dx: number, dy: number) {
  const { cv, g } = makeCanvas(S, S);
  g.fillStyle = color;
  g.beginPath(); g.arc(S / 2 - 14, S / 2, ro, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(S / 2 - 14 + dx, S / 2 + dy, rc, 0, Math.PI * 2); g.fill();
  return cv;
}

/** The arcana symbol on a transparent 256 x 256 canvas, centred, radius about 105. */
function symbolCanvas(kind: Kind) {
  const S = 256;
  const { cv, g } = makeCanvas(S, S);
  const c = S / 2;
  if (kind === 'sun') {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const long = k % 2 === 0;
      const tip = long ? 122 : 94;
      const half = long ? 0.17 : 0.14;
      const p = new Path2D();
      p.moveTo(c + Math.cos(a - half) * 60, c + Math.sin(a - half) * 60);
      p.lineTo(c + Math.cos(a) * tip, c + Math.sin(a) * tip);
      p.lineTo(c + Math.cos(a + half) * 60, c + Math.sin(a + half) * 60);
      p.closePath();
      fillOutline(g, p, long ? hex(GILT) : '#b8862a', 6);
    }
    const disc = new Path2D(); disc.arc(c, c, 58, 0, Math.PI * 2);
    fillOutline(g, disc, hex(GILT), 8);
    const ring = new Path2D(); ring.arc(c, c, 40, 0, Math.PI * 2);
    fillOutline(g, ring, hex(TEAL), 6);
    const core = new Path2D(); core.arc(c, c, 20, 0, Math.PI * 2);
    fillOutline(g, core, hex(GILT_HI), 5);
  } else if (kind === 'moon') {
    const black = crescentCanvas(S, '#000000', 100, 62, 40, -14);
    const gilt = crescentCanvas(S, hex(GILT), 90, 70, 40, -14);
    g.drawImage(black, 0, 0);
    g.drawImage(gilt, 0, 0);
    for (const [x, y, r] of [[196, 78, 22], [176, 184, 15]]) {
      fillOutline(g, starPath(x, y, 4, r, r * 0.3), hex(TEAL), 5);
    }
    const dot = new Path2D(); dot.arc(206, 132, 7, 0, Math.PI * 2);
    fillOutline(g, dot, hex(TEAL_HI), 4);
  } else if (kind === 'tower') {
    const body = new Path2D();
    body.moveTo(88, 232); body.lineTo(100, 90); body.lineTo(156, 90); body.lineTo(168, 232); body.closePath();
    fillOutline(g, body, hex(VIOLET_HI), 8);
    // Gilt brick courses.
    g.strokeStyle = hex(GILT);
    g.lineWidth = 5;
    for (let y = 118; y < 232; y += 28) { g.beginPath(); g.moveTo(94, y); g.lineTo(162, y); g.stroke(); }
    // Crown with crenellations.
    const crown = new Path2D();
    crown.moveTo(88, 90); crown.lineTo(88, 52); crown.lineTo(106, 52); crown.lineTo(106, 66); crown.lineTo(120, 66);
    crown.lineTo(120, 52); crown.lineTo(136, 52); crown.lineTo(136, 66); crown.lineTo(150, 66); crown.lineTo(150, 52);
    crown.lineTo(168, 52); crown.lineTo(168, 90); crown.closePath();
    fillOutline(g, crown, hex(GILT), 7);
    const win = new Path2D();
    win.moveTo(116, 170); win.lineTo(116, 146); win.quadraticCurveTo(128, 128, 140, 146); win.lineTo(140, 170); win.closePath();
    fillOutline(g, win, hex(BLACK), 5);
    // The lightning strike.
    const bolt = new Path2D();
    bolt.moveTo(206, 14); bolt.lineTo(150, 96); bolt.lineTo(174, 100); bolt.lineTo(122, 178);
    bolt.lineTo(146, 182); bolt.lineTo(92, 248); bolt.lineTo(124, 168); bolt.lineTo(102, 164);
    bolt.lineTo(160, 90); bolt.lineTo(136, 86); bolt.closePath();
    fillOutline(g, bolt, hex(TEAL), 6);
  } else if (kind === 'star') {
    fillOutline(g, starPath(c, c, 8, 112, 50), hex(GILT), 8);
    fillOutline(g, starPath(c, c, 8, 62, 30, -Math.PI / 2 + Math.PI / 8), hex(TEAL), 6);
    const hub = new Path2D(); hub.arc(c, c, 12, 0, Math.PI * 2);
    fillOutline(g, hub, hex(GILT_HI), 4);
    for (const [x, y] of [[26, 30], [230, 38], [228, 226], [30, 220]]) {
      fillOutline(g, starPath(x, y, 4, 17, 5), hex(VIOLET_HI), 4);
    }
  } else {
    // Wheel of Fortune: a gilt rim, eight spokes, teal hub, studs outside the rim.
    g.lineCap = 'butt';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      g.strokeStyle = '#000000'; g.lineWidth = 16;
      g.beginPath(); g.moveTo(c + Math.cos(a) * 18, c + Math.sin(a) * 18); g.lineTo(c + Math.cos(a) * 88, c + Math.sin(a) * 88); g.stroke();
      g.strokeStyle = hex(GILT); g.lineWidth = 9;
      g.beginPath(); g.moveTo(c + Math.cos(a) * 18, c + Math.sin(a) * 18); g.lineTo(c + Math.cos(a) * 88, c + Math.sin(a) * 88); g.stroke();
      const stud = new Path2D(); stud.arc(c + Math.cos(a - Math.PI / 8) * 112, c + Math.sin(a - Math.PI / 8) * 112, 9, 0, Math.PI * 2);
      fillOutline(g, stud, hex(TEAL), 4);
    }
    g.strokeStyle = '#000000'; g.lineWidth = 32;
    g.beginPath(); g.arc(c, c, 88, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = hex(GILT); g.lineWidth = 20;
    g.beginPath(); g.arc(c, c, 88, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = hex(VIOLET_HI); g.lineWidth = 5;
    g.beginPath(); g.arc(c, c, 88, 0, Math.PI * 2); g.stroke();
    const hub = new Path2D(); hub.arc(c, c, 24, 0, Math.PI * 2);
    fillOutline(g, hub, hex(TEAL), 7);
    const core = new Path2D(); core.arc(c, c, 9, 0, Math.PI * 2);
    fillOutline(g, core, hex(GILT_HI), 3);
  }
  return cv;
}

/** Shared card chrome: black outline, gilt border, dark panel. Returns the context and the panel centre. */
function cardBase(panelInner: string, panelOuter: string) {
  const W = 256, H = 416;
  const { cv, g } = makeCanvas(W, H);
  fillOutline(g, roundRect(4, 4, W - 8, H - 8, 22), '#000000', 2);
  fillOutline(g, roundRect(10, 10, W - 20, H - 20, 18), hex(GILT), 3);
  g.fillStyle = '#0c0814';
  g.fill(roundRect(17, 17, W - 34, H - 34, 14));
  const panel = roundRect(26, 26, W - 52, H - 52, 10);
  const grad = g.createRadialGradient(W / 2, 208, 20, W / 2, 208, 230);
  grad.addColorStop(0, panelInner);
  grad.addColorStop(1, panelOuter);
  g.fillStyle = grad;
  g.fill(panel);
  g.lineWidth = 3;
  g.strokeStyle = '#8a6a1c';
  g.stroke(panel);
  // Corner diamonds.
  for (const [x, y] of [[44, 44], [W - 44, 44], [44, H - 44], [W - 44, H - 44]]) {
    const d = new Path2D();
    d.moveTo(x, y - 10); d.lineTo(x + 8, y); d.lineTo(x, y + 10); d.lineTo(x - 8, y); d.closePath();
    fillOutline(g, d, hex(GILT), 3);
  }
  return { cv, g, W, H };
}

/** A card face: the arcana symbol in a gilt roundel on a dark violet panel. */
function faceTexture(kind: Kind, symbol: HTMLCanvasElement) {
  const { cv, g, W } = cardBase('#3a1e62', '#1c0f30');
  const cx = W / 2, cy = 208;
  g.fillStyle = '#150a26';
  g.beginPath(); g.arc(cx, cy, 116, 0, Math.PI * 2); g.fill();
  g.lineWidth = 4; g.strokeStyle = hex(GILT);
  g.beginPath(); g.arc(cx, cy, 116, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.strokeStyle = '#8a6a1c';
  g.beginPath(); g.arc(cx, cy, 106, 0, Math.PI * 2); g.stroke();
  g.drawImage(symbol, cx - 106, cy - 106, 212, 212);
  // Name plates: a gilt line with three teal diamonds at the top and bottom.
  for (const y of [70, 346]) {
    g.lineWidth = 3; g.strokeStyle = hex(GILT);
    g.beginPath(); g.moveTo(66, y); g.lineTo(190, y); g.stroke();
    for (const x of [cx - 24, cx, cx + 24]) {
      const d = new Path2D();
      d.moveTo(x, y - 7); d.lineTo(x + 6, y); d.lineTo(x, y + 7); d.lineTo(x - 6, y); d.closePath();
      fillOutline(g, d, hex(x === cx ? GILT : TEAL), 2);
    }
  }
  // A small mark of the kind: pips along the bottom plate (1..5).
  const n = KINDS.indexOf(kind) + 1;
  for (let k = 0; k < n; k++) {
    const d = new Path2D(); d.arc(cx + (k - (n - 1) / 2) * 16, 372, 4, 0, Math.PI * 2);
    fillOutline(g, d, hex(GILT), 2);
  }
  return toTexture(cv);
}

/** The card back: violet with a gilt lattice, concentric rings and an eight-point star. */
function backTexture() {
  const { cv, g, W } = cardBase('#6a34a0', '#2e1650');
  const cx = W / 2, cy = 208;
  g.save();
  g.clip(roundRect(26, 26, W - 52, 364, 10));
  // Diamond lattice.
  g.strokeStyle = '#7a44b4';
  g.lineWidth = 2;
  for (let k = -12; k <= 12; k++) {
    g.beginPath(); g.moveTo(cx + k * 26 - 220, cy - 220); g.lineTo(cx + k * 26 + 220, cy + 220); g.stroke();
    g.beginPath(); g.moveTo(cx + k * 26 + 220, cy - 220); g.lineTo(cx + k * 26 - 220, cy + 220); g.stroke();
  }
  g.restore();
  // Concentric rings with radial ticks.
  for (const [r, lw] of [[104, 4], [82, 3], [56, 4]]) {
    g.strokeStyle = '#000000'; g.lineWidth = lw + 4;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = hex(GILT); g.lineWidth = lw;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  }
  g.strokeStyle = hex(GILT);
  g.lineWidth = 2;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * 82, cy + Math.sin(a) * 82); g.lineTo(cx + Math.cos(a) * 104, cy + Math.sin(a) * 104); g.stroke();
  }
  fillOutline(g, starPath(cx, cy, 8, 54, 22), hex(GILT), 5);
  fillOutline(g, starPath(cx, cy, 8, 30, 12, -Math.PI / 2 + Math.PI / 8), hex(TEAL), 4);
  const hub = new Path2D(); hub.arc(cx, cy, 6, 0, Math.PI * 2);
  fillOutline(g, hub, hex(GILT_HI), 2);
  return toTexture(cv);
}

export class TarotJudgement implements Effect {
  readonly group = new THREE.Group();
  readonly settings: TarotJudgementSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;
  ctx: CastContext | null = null;

  private time = 0;
  private landed: boolean[] = Array(CARDS).fill(false);
  private shattered = false;
  private hitDone = false;
  private smokeDone = false;

  // Cast geometry.
  private from = new THREE.Vector3();
  private aim = 0;
  private hand = new THREE.Vector3();
  private centroid = new THREE.Vector3();
  private standPos: THREE.Vector3[] = Array.from({ length: CARDS }, () => new THREE.Vector3());
  private groundPos: THREE.Vector3[] = Array.from({ length: CARDS }, () => new THREE.Vector3());
  private standYaw: number[] = Array(CARDS).fill(0);
  private targetIdx: number[] = Array(CARDS).fill(0);
  private firstOfTarget: boolean[] = Array(CARDS).fill(false);

  // Cards.
  private cards: THREE.Group[] = [];
  private glyphs: THREE.Mesh[] = [];
  private glyphMats: THREE.MeshBasicMaterial[] = [];
  private rings: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial }[] = [];
  private pops: (StarBurst | null)[] = [];
  private crescent: CrescentArc;
  private crescentHolder = new THREE.Group();
  private bolt: LightningArc;
  private casterRing = createRing(GILT, 0.84, 1, 6);
  private smoke = new SmokeBall({ maxBalls: CARDS, color: 0x0c0814, rim: 0x3a2a5a, flake: 0x0c0814 });

  // Shards.
  private shardMesh: THREE.InstancedMesh;
  private shards = Array.from({ length: CARDS * SHARDS_PER }, () => ({
    p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(),
    s: 1, phase: 0, live: false, card: 0,
  }));

  private motes: Emitter;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private tmpD = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpS = new THREE.Vector3();

  constructor(settings: TarotJudgementSettings = defaultTarotJudgement()) {
    this.settings = settings;
    this.screen.tint.set(0x1a0a30);
    this.screen.impactColor.set(GILT);
    this.screen.edgeTint.set(TEAL);
    this.screen.speedLineColor.set(GILT);

    const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
    const glyphGeo = new THREE.PlaneGeometry(1, 1);
    const backTex = backTexture();
    for (let i = 0; i < CARDS; i++) {
      const kind = KINDS[i];
      const symbol = symbolCanvas(kind);
      // Unlit textured planes: the multiplier keeps the gilt well under the bloom threshold.
      const front = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({
        map: faceTexture(kind, symbol), color: 0xd8d8d8, alphaTest: 0.5, side: THREE.FrontSide,
      }));
      front.position.z = 0.01;
      const back = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({
        map: backTex, color: 0xd8d8d8, alphaTest: 0.5, side: THREE.FrontSide,
      }));
      back.rotation.y = Math.PI;
      back.position.z = -0.01;
      const card = new THREE.Group();
      card.rotation.order = 'YXZ';
      card.add(front, back);
      card.visible = false;
      this.cards.push(card);
      this.group.add(card);

      // The arcana glyph that bursts out of the card: coloured, normal-blended, below the bloom threshold.
      const gm = new THREE.MeshBasicMaterial({
        map: toTexture(symbol), color: 0xd8d8d8, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const glyph = new THREE.Mesh(glyphGeo, gm);
      glyph.visible = false;
      glyph.renderOrder = 20;
      this.glyphs.push(glyph);
      this.glyphMats.push(gm);
      this.group.add(glyph);

      // Two stacked ground rings (gilt + violet): the ring-stack pop from the recipes.
      for (const col of [GILT, VIOLET_HI]) {
        const ring = createRing(col, 0.9, 1, 64);
        this.rings.push(ring);
        this.group.add(ring.mesh);
      }

      let pop: StarBurst | null = null;
      if (kind === 'sun') pop = new StarBurst({ points: 12, inner: 0.45, color: GILT, core: GILT_HI, additive: false });
      else if (kind === 'star') pop = new StarBurst({ points: 5, inner: 0.38, jitter: 0.1, color: TEAL, core: TEAL_HI, additive: false });
      if (pop) { pop.mesh.renderOrder = 30; this.group.add(pop.mesh); }
      this.pops.push(pop);
    }

    this.crescent = new CrescentArc({
      radius: 1.3, width: 1.0, sweep: Math.PI * 1.4, style: 'toon', edge: TEAL_HI, mid: TEAL, outer: BLACK,
    });
    this.crescentHolder.add(this.crescent.mesh);
    this.crescentHolder.visible = false;
    this.group.add(this.crescentHolder);
    this.bolt = new LightningArc({ width: 0.3, core: TEAL_HI, glow: TEAL });
    this.group.add(this.bolt.mesh);
    this.group.add(this.casterRing.mesh, this.smoke.mesh);

    // Gilt/violet/teal shard kites: flat, unlit, per-instance colour.
    const kite = new THREE.Shape();
    kite.moveTo(0, 0.2); kite.lineTo(0.1, 0); kite.lineTo(0, -0.14); kite.lineTo(-0.1, 0); kite.closePath();
    this.shardMesh = new THREE.InstancedMesh(
      new THREE.ShapeGeometry(kite),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
      CARDS * SHARDS_PER,
    );
    this.shardMesh.frustumCulled = false;
    const palette = [GILT, GILT, VIOLET_HI, TEAL, GILT, VIOLET];
    const col = new THREE.Color();
    for (let k = 0; k < CARDS * SHARDS_PER; k++) {
      col.setHex(palette[k % palette.length]).multiplyScalar(0.9);
      this.shardMesh.setColorAt(k, col);
      this.shards[k].card = Math.floor(k / SHARDS_PER);
    }
    this.group.add(this.shardMesh);

    // Sparse gilt motes (additive, small).
    this.motes = new Emitter({
      ...defaultSettings(), maxParticles: 500, rate: 0, lifetime: 1.4, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.5, speed: 1.6, speedJitter: 0.7, spread: 180, gravity: 1.2, drag: 1.2,
      sizeStart: 0.13, sizeEnd: 0.02, colorStart: '#ffe8a8', colorEnd: '#d8a83a',
      opacityStart: 0.5, opacityEnd: 0, additive: true, colorMid: '#d8a83a', sizeJitter: 0.4, erosion: 0.3, spin: 0.5,
    });
    this.emitters.push(this.motes, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.smoke.hold = 0.25;
    this.reset();
  }

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return D;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.from.copy(ctx.from);
    this.aim = ctx.aim;
    const fwd = new THREE.Vector3(Math.sin(ctx.aim), 0, Math.cos(ctx.aim));
    this.hand.copy(ctx.from).addScaledVector(fwd, 0.4).setY(2.7);
    const pts = ctx.targetPos.length ? ctx.targetPos : [ctx.point];
    this.centroid.set(0, 0, 0);
    for (const p of pts) this.centroid.add(p);
    this.centroid.divideScalar(pts.length).setY(0);

    // Cards cycle over the targets; several cards on one enemy stand side by side.
    const count: number[] = Array(pts.length).fill(0);
    for (let i = 0; i < CARDS; i++) count[i % pts.length]++;
    const seen: number[] = Array(pts.length).fill(0);
    for (let i = 0; i < CARDS; i++) {
      const j = i % pts.length;
      this.targetIdx[i] = j;
      const slot = seen[j]++;
      this.firstOfTarget[i] = slot === 0;
      const d = new THREE.Vector3().copy(pts[j]).sub(ctx.from).setY(0);
      if (d.lengthSq() < 1e-6) d.copy(fwd);
      d.normalize();
      const side = new THREE.Vector3(-d.z, 0, d.x);
      const off = (slot - (count[j] - 1) / 2) * 1.75;
      this.groundPos[i].copy(pts[j]).addScaledVector(d, BEHIND).addScaledVector(side, off).setY(0);
      this.standPos[i].copy(this.groundPos[i]).setY(STAND_Y);
      this.standYaw[i] = Math.atan2(d.x, d.z); // front faces away from the caster until the flip
    }
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.screen.focus.copy(this.centroid).setY(1.6);
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.landed.fill(false);
    this.shattered = false;
    this.hitDone = false;
    this.smokeDone = false;
    this.shake = 0;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    for (const s of this.shards) { s.live = false; s.p.set(0, -50, 0); }
    this.layout(0);
  }

  update(dt: number) {
    this.motes.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    for (let i = 0; i < CARDS; i++) if (!this.landed[i] && this.time >= arriveAt(i)) this.onLand(i);
    if (!this.shattered && this.time >= D) this.onShatter();
    if (!this.hitDone && this.time >= D + 0.04) this.onHit();
    if (!this.smokeDone && this.time >= D + 0.18) this.onSmoke();
    this.bolt.update(dt);
    this.layout(dt);
  }

  /** Fan slot of card i around the caster's raised hand (backs toward the camera behind the caster). */
  private fanPose(i: number, t: number, outPos: THREE.Vector3) {
    const k = i - (CARDS - 1) / 2;
    const fwd = this.tmpC.set(Math.sin(this.aim), 0, Math.cos(this.aim));
    const right = this.tmpB.set(-fwd.z, 0, fwd.x);
    outPos.copy(this.hand).addScaledVector(fwd, 1.6).addScaledVector(right, k * 1.05);
    outPos.y += 0.5 - 0.1 * k * k + 0.08 * Math.sin(t * 2.4 + i * 1.3);
    return -k * 0.2; // roll
  }

  private layout(dt: number) {
    const t = this.time;
    const after = t - D;
    const live = t < DURATION;
    const fade = 1 - smoothstep((t - (DURATION - 1.0)) / 0.9);

    // --- World grade, focus lines into the shatter, short impact frames, a small chroma pulse. ---
    this.screen.darken = t < D ? 0.5 * smoothstep(t / 0.7) : 0.5 * Math.exp(-Math.max(0, after - 0.1) * 2.4);
    this.screen.speedLines = t < D ? 0.35 * smoothstep((t - (D - 0.3)) / 0.3) : Math.max(0, 0.35 - after * 4);
    this.screen.impact = impactFrameAt(t, D, [1, 2], 0.04);
    this.screen.chroma = chromaPulse(t, D + 0.04, 0.4);

    // --- Caster rune: a gilt hexagon that opens with the fan and fades as the cards leave. ---
    this.casterRing.mesh.position.set(this.from.x, 0.05, this.from.z);
    this.casterRing.mesh.scale.setScalar(1.3 + 1.2 * smoothstep(t / 0.8));
    this.casterRing.mesh.rotation.z = t * 1.6;
    this.casterRing.material.opacity = live ? 0.45 * smoothstep(t / 0.4) * (1 - smoothstep((t - 0.9) / 0.6)) : 0;

    // --- Cards. ---
    for (let i = 0; i < CARDS; i++) {
      const card = this.cards[i];
      const t0 = fanAt(i), td = departAt(i), ta = arriveAt(i), tf = flipAt(i);
      if (!live || t < t0 || t >= D) { card.visible = false; continue; }
      card.visible = true;
      const pos = this.tmpA;
      let yaw = this.aim;
      let roll = 0;
      let scale = 0.8 * easeOutBack((t - t0) / 0.35);
      if (t < td) {
        roll = this.fanPose(i, t, pos);
      } else if (t < ta) {
        const u = (t - td) / (ta - td);
        const ue = u * u * (3 - 2 * u);
        const start = this.tmpD;
        const roll0 = this.fanPose(i, td, start);
        const end = this.standPos[i];
        const ctrl = this.tmpB.copy(start).lerp(end, 0.5);
        ctrl.y = Math.max(start.y, end.y) + 2.6;
        const k = 1 - ue;
        pos.set(
          k * k * start.x + 2 * k * ue * ctrl.x + ue * ue * end.x,
          k * k * start.y + 2 * k * ue * ctrl.y + ue * ue * end.y,
          k * k * start.z + 2 * k * ue * ctrl.z + ue * ue * end.z,
        );
        yaw = this.aim + wrapPi(this.standYaw[i] - this.aim) * ue + Math.PI * 4 * (1 - ue); // two full spins
        roll = roll0 * (1 - ue) + 0.25 * Math.sin(ue * Math.PI * 2) * (1 - ue);
        scale = THREE.MathUtils.lerp(0.8, 1, ue);
        if (dt > 0 && Math.random() < 0.6) this.motes.burst(1, this.tmpC.copy(pos));
      } else {
        pos.copy(this.standPos[i]);
        pos.y += 0.07 * Math.sin((t - ta) * 5 + i * 1.7);
        yaw = this.standYaw[i];
        scale = 1 + 0.1 * Math.exp(-(t - ta) * 9);
      }
      // The flip: half a turn about the vertical axis with a small pop at the edge-on moment.
      let flip = 0;
      if (t >= tf) {
        const f = THREE.MathUtils.clamp((t - tf) / FLIP_TIME, 0, 1);
        flip = f * f * (3 - 2 * f);
        scale *= 1 + 0.1 * Math.sin(f * Math.PI);
      }
      card.position.copy(pos);
      card.rotation.set(0, yaw + Math.PI * flip, roll);
      card.scale.setScalar(Math.max(1e-3, scale));
    }

    // --- The arcana burst: glyph, ground rings, and one kind-specific part per card. ---
    for (let i = 0; i < CARDS; i++) {
      const kind = KINDS[i];
      const age = after - i * 0.025;
      const glyph = this.glyphs[i];
      const p = this.standPos[i];
      if (!live || age < 0 || age > 1.2) {
        glyph.visible = false;
      } else {
        glyph.visible = true;
        const g = easeOutCubic(age / 0.5);
        glyph.position.copy(p);
        glyph.rotation.set(0, this.standYaw[i] + Math.PI, kind === 'wheel' ? age * 3.2 : 0);
        glyph.scale.setScalar(Math.max(1e-3, CARD_W * 1.15 + 1.6 * g));
        this.glyphMats[i].opacity = Math.max(0, 1 - smoothstep((age - 0.15) / 0.9)) * 0.9;
      }
      for (let r = 0; r < 2; r++) {
        const ring = this.rings[i * 2 + r];
        const ra = age - r * 0.07;
        ring.mesh.position.set(this.groundPos[i].x, 0.05 + r * 0.01, this.groundPos[i].z);
        ring.mesh.scale.setScalar(Math.max(1e-3, 0.8 + Math.max(0, ra) * (r === 0 ? 14 : 10)));
        ring.material.opacity = live && ra > 0 ? 0.45 * Math.max(0, 1 - ra / 0.7) : 0;
      }
      const pop = this.pops[i];
      if (pop) {
        const a = StarBurst.pop(age, 0.1, 0.2);
        if (!live || a.opacity === 0) pop.set(this.tmpA.set(0, 0, 0), 0, 0);
        else pop.set(this.tmpA.copy(p), (kind === 'sun' ? 3.2 : 2.6) * a.scale, a.opacity, i * 0.7 + age * 2);
      }
    }
    // Moon: a toon crescent sweeping round the card; tower: a teal bolt from above onto the card.
    const moonAge = after - 1 * 0.025;
    this.crescentHolder.visible = live && moonAge >= 0 && moonAge < 0.7;
    if (this.crescentHolder.visible) {
      this.crescentHolder.position.copy(this.standPos[1]);
      this.crescentHolder.rotation.set(0, this.standYaw[1] + Math.PI, 0);
      this.crescentHolder.scale.setScalar(1 + moonAge * 1.2);
      this.crescent.head = moonAge * 3.4;
      this.crescent.length = 0.7;
      this.crescent.erosion = smoothstep(moonAge / 0.7) * 0.8;
      this.crescent.opacity = 1;
      this.crescent.time = t;
    }
    const towerAge = after - 2 * 0.025;
    if (live && towerAge >= 0 && towerAge < 0.22) {
      const top = this.tmpA.copy(this.standPos[2]).setY(7.5);
      this.bolt.setEnds(top, this.tmpB.copy(this.standPos[2]).setY(0.2));
      this.bolt.opacity = 0.9;
    } else {
      this.bolt.opacity = 0;
    }

    // --- Shards: flutter down, settle on the ground, shrink away at the end. ---
    for (let k = 0; k < this.shards.length; k++) {
      const s = this.shards[k];
      if (s.live && dt > 0) {
        if (s.p.y > 0.06) {
          s.v.y -= 7 * dt;
          const drag = Math.max(0, 1 - 1.6 * dt);
          s.v.x *= drag; s.v.z *= drag;
          if (s.v.y < -2.2) s.v.y = -2.2; // paper-like terminal speed
          s.p.addScaledVector(s.v, dt);
          s.p.x += Math.sin(t * 6 + s.phase) * 0.5 * dt;
          s.r.set(s.r.x + s.w.x * dt, s.r.y + s.w.y * dt, s.r.z + s.w.z * dt);
        } else {
          s.p.y = 0.06;
          s.v.set(0, 0, 0);
        }
      }
      const sc = s.live ? Math.max(1e-4, s.s * fade) : 1e-4;
      this.tmpM.compose(s.live ? s.p : this.tmpA.set(0, -50, 0), this.tmpQ.setFromEuler(s.r), this.tmpS.set(sc, sc, sc));
      this.shardMesh.setMatrixAt(k, this.tmpM);
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;

    // --- Shake: a tick per landing, one heavy hit at the shatter. ---
    let sh = 0;
    for (let i = 0; i < CARDS; i++) { const a = t - arriveAt(i); if (a >= 0) sh = Math.max(sh, 0.07 * Math.exp(-a * 14)); }
    if (t >= D) sh = Math.max(sh, 0.6 * Math.exp(-(t - D) * 7));
    this.shake = sh;
  }

  private onLand(i: number) {
    this.landed[i] = true;
    const ctx = this.ctx;
    this.motes.burst(8, this.tmpA.copy(this.groundPos[i]).setY(0.3));
    if (!ctx || !this.firstOfTarget[i]) return;
    const e = ctx.targets[this.targetIdx[i]];
    if (e) ctx.hit(e, { damage: this.settings.tickDamage, knock: 0, from: this.standPos[i], color: '#d8a83a' });
  }

  /** Each card breaks into gilt, violet and teal shards flying out of its face. */
  private onShatter() {
    this.shattered = true;
    for (let k = 0; k < this.shards.length; k++) {
      const s = this.shards[k];
      const i = s.card;
      const c = this.standPos[i];
      const right = this.tmpB.set(Math.cos(this.standYaw[i]), 0, -Math.sin(this.standYaw[i]));
      const lx = (Math.random() - 0.5) * CARD_W, ly = (Math.random() - 0.5) * CARD_H;
      s.p.copy(c).addScaledVector(right, lx).setY(c.y + ly);
      const out = this.tmpC.copy(s.p).sub(c).setY(0);
      if (out.lengthSq() < 1e-6) out.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      out.normalize();
      const sp = 2.5 + Math.random() * 4;
      s.v.copy(out).multiplyScalar(sp);
      s.v.y = 1.5 + Math.random() * 4.5 + ly * 0.8;
      s.w.set(Math.random() * 9 - 4.5, Math.random() * 9 - 4.5, Math.random() * 9 - 4.5);
      s.r.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      s.s = 0.9 + Math.random() * 1.1;
      s.phase = Math.random() * 6.28;
      s.live = true;
    }
    for (let i = 0; i < CARDS; i++) this.motes.burst(14, this.tmpA.copy(this.standPos[i]));
  }

  private onHit() {
    this.hitDone = true;
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e) => {
      ctx.hit(e, { damage: this.settings.damage, knock: 3, from: this.centroid, color: '#ffe8a8' });
    });
  }

  /** Small black blobs where each card stood. */
  private onSmoke() {
    this.smokeDone = true;
    for (let i = 0; i < CARDS; i++) this.smoke.trigger(this.tmpA.copy(this.standPos[i]).setY(1.4), 0.9, 0.4);
  }
}

export const tarotJudgementModule: EffectModule = {
  label: 'tarot judgement',
  category: 'targeted',
  targeting: { mode: 'enemies', maxTargets: CARDS },
  create: () => new TarotJudgement(),
  telegraphs(effect) {
    const e = effect as TarotJudgement;
    const pts = e.ctx?.targetPos ?? [];
    return pts.map((p) => ({
      shape: { kind: 'circle' as const, x: p.x, z: p.z, radius: 1.8 }, start: 0.8, impact: D,
    }));
  },
  bloom: { enabled: true, strength: 0.55, radius: 0.5, threshold: 0.85 },
  frameCamera(camera, controls, effect) {
    const e = effect as TarotJudgement;
    if (e.ctx) frameCast(camera, controls, e.ctx, 6);
  },
  buildGui(f, effect) {
    const s = (effect as TarotJudgement).settings;
    f.add(s, 'loop');
    f.add(s, 'tickDamage', 1, 60, 1).name('tick damage');
    f.add(s, 'damage', 1, 150, 1);
  },
};
