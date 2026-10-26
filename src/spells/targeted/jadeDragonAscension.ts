import * as THREE from 'three';
import { Emitter, defaultSettings } from '../../emitter';
import {
  GlowSphere, LightPillar, createRing, smoothstep, softDotTexture,
} from '../../effects/common';
import {
  CrescentArc, SmokeBall, StarBurst, clearScreenFx, createScreenFx, impactFrameAt,
} from '../../effects/parts';
import { frameCast, type CastContext } from '../../effects/targeting';
import type { Effect, EffectModule } from '../../effects/types';

/**
 * Jade Dragon Ascension (targeted ground AoE, radius 5): a gold spark draws a jade sigil on the ground, motes and
 * a toon spiral implode into its centre, then a spirit dragon made of silk ribbons coils up out of the sigil to
 * ~11 m, hangs perfectly still, and dives straight back down through it. The dive is the hit: impact frames, a
 * jade star, light pillar, shock rings, dark ground plates and toon smoke, then colour drains and the sigil erodes.
 *
 * Recipes: c-unity-summon-circle (drawn sigil), e-geodraws-crimson-pillar (ribbons wound round a pillar),
 * g-castorice-dragon-rise-cutscene (held reveal, then crash down; the axis turns flat → vertical → flat).
 */
export interface JadeDragonAscensionSettings {
  height: number;
  damage: number;
  loop: boolean;
}

export const defaultJadeDragonAscension = (): JadeDragonAscensionSettings => ({
  height: 11,
  damage: 55,
  loop: false,
});

// Timeline (seconds).
const DRAW = 0.9;
const IMPLODE_END = 1.2;
const RISE_START = 1.2;
const RISE_END = 2.4;
const HOLD_END = 3.0;
const IMPACT = 3.35;
const DURATION = 5.2;
const RADIUS = 5;

const JADE_CORE = 0xf2fff6;
const JADE_HOT = 0x9ff2c8;
const JADE_BODY = 0x2fbf7a;
const GOLD = 0xe8b84a;
const GOLD_BRIGHT = 0xffd060;
const DARK = 0x0b2a1c;

const MOTES = 110;
const VORTEX = 80;
const PLATES = 8;
const SEGS = 48;
const TWIST = (2 * 2 * Math.PI) / 11;

const ribbonVert = /* glsl */ `
  attribute vec3 aTan;
  attribute float aSide;
  uniform float uWidth;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 tw = mat3(modelMatrix) * aTan;
    vec3 off = cross(tw, cameraPosition - wp);
    float l = length(off);
    off = l > 1e-5 ? off / l : vec3(0.0, 0.0, 1.0);
    float u = uv.x;
    float w = uWidth * (0.5 + 0.5 * smoothstep(0.0, 0.08, u)) * (1.0 - 0.88 * u);
    wp += off * aSide * w;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const ribbonFrag = /* glsl */ `
  uniform vec3 uHot, uBody, uDark;
  uniform float uOpacity, uTime, uErosion, uUnder;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float u = vUv.x;
    float across = vUv.y * 2.0 - 1.0;
    float n = noise(vec2(u * 24.0 - uTime * 2.0, across * 3.0));
    // Ragged, eroded tail.
    if (n < uErosion * 0.9 + smoothstep(0.55, 1.0, u) * 0.55) discard;
    if (uUnder > 0.5) { gl_FragColor = vec4(uDark, uOpacity * (1.0 - 0.5 * u)); return; }
    vec3 col = mix(uHot, uBody, smoothstep(0.0, 0.3, u));
    // The hot centre streak starts a little behind the neck, so the drawn head is not swallowed by bloom.
    col = mix(col, uHot, (1.0 - abs(across)) * 0.5 * (1.0 - u) * smoothstep(0.04, 0.14, u));
    col = mix(col, uDark, smoothstep(0.6, 1.0, u) * 0.7);
    gl_FragColor = vec4(col, uOpacity * (1.0 - 0.6 * u) * (0.5 + 0.5 * smoothstep(0.0, 0.1, u)));
  }
`;

/**
 * The dragon's head as a hard-edged profile drawing (canvas, 1024 × 512): an eastern dragon facing +X with an open
 * jaw, fangs, a gold eye, two gold antlers, a dark mane and beard, a black outline and a white edge along the brow
 * and snout. The neck sits at the left edge, where the body ribbon joins.
 */
function dragonHeadTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 512;
  const g = cv.getContext('2d')!;
  g.scale(2, 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const dark = '#0b2a1c';

  // Mane and beard: dark jade flame spikes behind the skull and under the jaw.
  g.fillStyle = '#16573a';
  g.strokeStyle = dark;
  g.lineWidth = 5;
  const spikes = (pts: number[][]) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fill();
    g.stroke();
  };
  spikes([[210, 80], [150, 30], [175, 78], [105, 38], [130, 92], [45, 70], [80, 112], [10, 110], [40, 135]]);
  spikes([[330, 180], [300, 238], [272, 186], [228, 246], [215, 182], [150, 236], [150, 172], [70, 214], [60, 160]]);

  // Back antler (darker gold), drawn behind the skull.
  const antler = (main: number[][], tine: number[][], color: string, w: number) => {
    g.strokeStyle = dark;
    g.lineWidth = w + 7;
    for (const p of [main, tine]) {
      g.beginPath();
      g.moveTo(p[0][0], p[0][1]);
      g.quadraticCurveTo(p[1][0], p[1][1], p[2][0], p[2][1]);
      g.stroke();
    }
    g.strokeStyle = color;
    g.lineWidth = w;
    for (const p of [main, tine]) {
      g.beginPath();
      g.moveTo(p[0][0], p[0][1]);
      g.quadraticCurveTo(p[1][0], p[1][1], p[2][0], p[2][1]);
      g.stroke();
    }
  };
  antler([[205, 72], [150, 40], [70, 32]], [[135, 46], [128, 20], [150, 6]], '#8a6420', 9);

  // Skull + open jaw.
  const head = new Path2D();
  head.moveTo(30, 104);
  head.bezierCurveTo(110, 90, 170, 70, 230, 58); // back of the skull to the brow
  head.quadraticCurveTo(262, 50, 286, 70); // brow ridge
  head.quadraticCurveTo(330, 84, 400, 88); // nose bridge
  head.quadraticCurveTo(470, 88, 498, 100); // snout top
  head.quadraticCurveTo(512, 104, 500, 118); // nose tip
  head.lineTo(440, 124); // upper lip
  head.quadraticCurveTo(360, 126, 300, 138); // mouth corner
  head.lineTo(452, 160); // lower jaw, open
  head.quadraticCurveTo(470, 166, 452, 176);
  head.quadraticCurveTo(380, 192, 290, 186); // chin
  head.quadraticCurveTo(190, 178, 120, 168); // throat
  head.lineTo(30, 160);
  head.closePath();
  const grad = g.createLinearGradient(500, 0, 30, 0);
  grad.addColorStop(0, '#9ff2c8');
  grad.addColorStop(0.35, '#2fbf7a');
  grad.addColorStop(0.8, '#1c7a4c');
  grad.addColorStop(1, '#0b2a1c');
  g.fillStyle = grad;
  g.fill(head);
  g.strokeStyle = dark;
  g.lineWidth = 7;
  g.stroke(head);

  // Mouth interior (dark) with fangs.
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(440, 126); g.quadraticCurveTo(360, 130, 304, 140); g.lineTo(446, 160); g.closePath();
  g.fill();
  g.fillStyle = '#f4fff8';
  for (const [x, y, d] of [[420, 126, 1], [380, 129, 1], [430, 158, -1], [392, 151, -1]]) {
    g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x, y + 18 * d); g.lineTo(x + 6, y); g.closePath(); g.fill();
  }

  // White edge along the brow, nose bridge and snout (light from above).
  g.strokeStyle = '#f2fff6';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(236, 62); g.quadraticCurveTo(262, 54, 284, 72); g.quadraticCurveTo(330, 86, 400, 90);
  g.quadraticCurveTo(468, 90, 494, 102);
  g.stroke();
  // Nostril and cheek scale lines.
  g.strokeStyle = dark;
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(474, 104); g.quadraticCurveTo(482, 98, 488, 106); g.stroke();
  g.beginPath(); g.moveTo(250, 120); g.quadraticCurveTo(222, 140, 236, 168); g.stroke();
  g.beginPath(); g.moveTo(196, 114); g.quadraticCurveTo(170, 136, 184, 166); g.stroke();

  // Eye: gold almond with a black slit and a white glint.
  g.fillStyle = '#ffd060';
  g.strokeStyle = dark;
  g.lineWidth = 4;
  g.beginPath(); g.ellipse(300, 94, 17, 9, -0.25, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = dark;
  g.beginPath(); g.ellipse(302, 94, 3, 8, -0.25, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(294, 90, 2.5, 0, Math.PI * 2); g.fill();

  // Front antler (bright gold) over the skull.
  antler([[236, 62], [190, 18], [100, 8]], [[168, 22], [170, 2], [196, 0]], '#e8b84a', 10);

  // Whisker: a long gold-white tendril from the nose sweeping back.
  g.strokeStyle = dark;
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(478, 116); g.bezierCurveTo(420, 210, 300, 150, 200, 240); g.stroke();
  g.strokeStyle = '#ffe8a8';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(478, 116); g.bezierCurveTo(420, 210, 300, 150, 200, 240); g.stroke();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A camera-facing silk strip along a polyline spine: u = 0 at the head, 1 at the tail. */
class RibbonStrip {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private pos = new Float32Array((SEGS + 1) * 2 * 3);
  private tan = new Float32Array((SEGS + 1) * 2 * 3);
  private geo = new THREE.BufferGeometry();

  constructor(width: number, under: boolean, gold = false) {
    const side = new Float32Array((SEGS + 1) * 2);
    const uv = new Float32Array((SEGS + 1) * 2 * 2);
    const index: number[] = [];
    for (let i = 0; i <= SEGS; i++) {
      for (let j = 0; j < 2; j++) {
        const v = i * 2 + j;
        side[v] = j === 0 ? -1 : 1;
        uv[v * 2] = i / SEGS;
        uv[v * 2 + 1] = j;
      }
      if (i < SEGS) { const b = i * 2; index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aTan', new THREE.BufferAttribute(this.tan, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(index);
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: under ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uWidth: { value: width }, uOpacity: { value: 0 }, uTime: { value: 0 }, uErosion: { value: 0 },
        uUnder: { value: under ? 1 : 0 },
        uHot: { value: new THREE.Color(gold ? GOLD_BRIGHT : JADE_HOT) }, uBody: { value: new THREE.Color(gold ? GOLD : JADE_BODY) },
        uDark: { value: new THREE.Color(DARK) },
      },
      vertexShader: ribbonVert,
      fragmentShader: ribbonFrag,
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = under ? 1 : gold ? 3 : 2;
    this.mesh.visible = false;
  }

  /** `pts` has SEGS + 1 points, head first. */
  setSpine(pts: THREE.Vector3[]) {
    for (let i = 0; i <= SEGS; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(SEGS, i + 1)];
      let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
      const l = Math.hypot(tx, ty, tz);
      if (l > 1e-6) { tx /= l; ty /= l; tz /= l; } else { tx = 0; ty = 1; tz = 0; }
      for (let j = 0; j < 2; j++) {
        const v = (i * 2 + j) * 3;
        this.pos[v] = pts[i].x; this.pos[v + 1] = pts[i].y; this.pos[v + 2] = pts[i].z;
        this.tan[v] = tx; this.tan[v + 1] = ty; this.tan[v + 2] = tz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aTan.needsUpdate = true;
  }

  style(opacity: number, erosion: number, time: number) {
    const u = this.material.uniforms;
    u.uOpacity.value = opacity;
    u.uErosion.value = erosion;
    u.uTime.value = time;
    this.mesh.visible = opacity > 0.002;
  }
}

export class JadeDragonAscension implements Effect {
  readonly group = new THREE.Group();
  readonly settings: JadeDragonAscensionSettings;
  readonly emitters: Emitter[] = [];
  readonly screen = createScreenFx();
  shake = 0;
  playing = false;

  /** Last cast; frameCamera and telegraphs read it. Null until the first play(). */
  ctx: CastContext | null = null;
  private time = 0;
  private impacted = false;
  private smokeDone = false;
  private smallHit: boolean[] = [];
  private center = new THREE.Vector3();

  // Sigil.
  private floorDisc = new THREE.Mesh(
    new THREE.CircleGeometry(RADIUS + 0.4, 64),
    new THREE.MeshBasicMaterial({ color: DARK, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  private outerRing = createRing(GOLD_BRIGHT, 0.94, 1, 128);
  private innerRing = createRing(GOLD_BRIGHT, 0.9, 1, 96);
  private diamondRing = createRing(JADE_HOT, 0.93, 1, 4);
  private tickMat = new THREE.MeshBasicMaterial({
    color: GOLD_BRIGHT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  private ticks: THREE.Mesh[] = [];
  private spark = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: GOLD, core: 0xffffff });

  // Anticipation.
  private motePos = new Float32Array(MOTES * 3);
  private moteSeed = Array.from({ length: MOTES }, () => ({
    a: Math.random() * Math.PI * 2, d: Math.random() * 0.7, s: 0.6 + Math.random() * 0.8, r: 4.3 + Math.random() * 0.7,
  }));
  private moteGeo = new THREE.BufferGeometry();
  private moteMat = new THREE.PointsMaterial({
    size: 0.2, map: softDotTexture(), color: JADE_HOT, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private motes = new THREE.Points(this.moteGeo, this.moteMat);
  private implodePlane = new THREE.Group();
  private implode: CrescentArc[] = [];

  // Dragon.
  private ribbons: RibbonStrip[] = [];
  private under = new RibbonStrip(0.65 * 1.3, true);
  private goldLine = new RibbonStrip(0.1, false, true);
  private spine: THREE.Vector3[] = Array.from({ length: SEGS + 1 }, () => new THREE.Vector3());
  private ribbonLen = [9, 6.5, 5.5];
  private head = new THREE.Vector3();
  private headGlow = new GlowSphere(JADE_CORE, { rim: false });
  private headStar = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: JADE_HOT, core: 0xffffff });
  private headMat = new THREE.MeshBasicMaterial({
    map: dragonHeadTexture(), transparent: true, alphaTest: 0.5, depthWrite: false, side: THREE.DoubleSide,
  });
  private eyeMat = new THREE.MeshBasicMaterial({
    map: softDotTexture(), color: GOLD_BRIGHT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  private holdStar = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: 0xffffff, core: 0xffffff, additive: false });
  private hornRig = new THREE.Group();

  // Impact.
  private impactStar = new StarBurst({ points: 12, color: JADE_HOT, core: 0xffffff, additive: false });
  private impactGlint = new StarBurst({ points: 4, inner: 0.12, jitter: 0, color: GOLD, core: 0xffffff });
  private pillar = new LightPillar(JADE_HOT, 1.6);
  private shock = createRing(JADE_HOT, 0.9, 1, 96);
  private shockGold = createRing(GOLD, 0.97, 1, 96);
  private plates: THREE.InstancedMesh;
  private plateSeed = Array.from({ length: PLATES }, (_, i) => ({
    a: (i / PLATES) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
    r: 1.4 + Math.random() * 1.6, size: 0.8 + Math.random() * 0.6, tilt: 0.7 + Math.random() * 0.4,
  }));
  private smoke = new SmokeBall({ color: 0x1d3a34, rim: 0x3a5a50, flake: '#1d3a34', maxBalls: 8 });
  private vortexPos = new Float32Array(VORTEX * 3);
  private vortexSeed = Array.from({ length: VORTEX }, () => ({
    a: Math.random() * Math.PI * 2, r: 1.5 + Math.random() * 4.5, y: Math.random(), w: 0.8 + Math.random() * 0.6,
  }));
  private vortexGeo = new THREE.BufferGeometry();
  private vortexMat = new THREE.PointsMaterial({
    size: 1.3, map: softDotTexture(), color: 0x2a4a42, transparent: true, opacity: 0, depthWrite: false,
  });
  private vortex = new THREE.Points(this.vortexGeo, this.vortexMat);

  private scales: Emitter;
  private sparks: Emitter;
  private dust: Emitter;

  constructor(settings: JadeDragonAscensionSettings = defaultJadeDragonAscension()) {
    this.settings = settings;
    this.screen.tint.set(0x1d4a3a);
    this.screen.impactColor.set(JADE_BODY);
    this.screen.speedLineColor.set(0xe6fff6);

    this.floorDisc.rotation.x = -Math.PI / 2;
    this.floorDisc.position.y = 0.02;
    for (const r of [this.outerRing, this.innerRing, this.diamondRing]) r.mesh.geometry.setDrawRange(0, 0);
    this.outerRing.mesh.scale.setScalar(RADIUS);
    this.innerRing.mesh.scale.setScalar(3.3);
    this.diamondRing.mesh.scale.setScalar(2.3);
    const tickGeo = new THREE.PlaneGeometry(0.3, 1.5);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(tickGeo, this.tickMat.clone());
      m.rotation.order = 'YXZ';
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.ticks.push(m);
      this.group.add(m);
    }
    this.group.add(this.floorDisc, this.outerRing.mesh, this.innerRing.mesh, this.diamondRing.mesh, this.spark.mesh);

    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    this.motes.frustumCulled = false;
    for (let i = 0; i < 3; i++) {
      const arc = new CrescentArc({ radius: 4, width: 1.1, style: 'toon', sweep: Math.PI * 1.2, edge: JADE_CORE, mid: JADE_BODY, outer: DARK });
      arc.mesh.rotation.z = (i * Math.PI * 2) / 3;
      this.implodePlane.add(arc.mesh);
      this.implode.push(arc);
    }
    this.implodePlane.rotation.x = -Math.PI / 2;
    this.group.add(this.motes, this.implodePlane);

    // One thick body ribbon (black under-ribbon + gold spine line) and two thin qi whiskers.
    const widths = [0.65, 0.1, 0.08];
    for (let k = 0; k < 3; k++) this.ribbons.push(new RibbonStrip(widths[k], false));
    this.group.add(this.under.mesh, ...this.ribbons.map((r) => r.mesh), this.goldLine.mesh);
    // Head: a drawn profile (snout +X in the texture) turned so the snout points up the travel direction. The rig
    // billboards (see below) and rolls by π on the dive, so the snout leads both ways. The neck (texture's left
    // edge) sits on the body ribbon's head point.
    const HEAD_L = 3.4;
    const headMesh = new THREE.Mesh(new THREE.PlaneGeometry(HEAD_L, HEAD_L / 2), this.headMat);
    headMesh.rotation.z = Math.PI / 2;
    headMesh.position.set(0, HEAD_L / 2 - 0.25, 0);
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), this.eyeMat);
    // Eye at texture (300, 94) of 512 × 256 → plane (x, y) before the 90° turn, then turned.
    const ex = (300 / 512 - 0.5) * HEAD_L, ey = (0.5 - 94 / 256) * (HEAD_L / 2);
    eye.position.set(-ey, HEAD_L / 2 - 0.25 + ex, 0.01);
    this.hornRig.add(headMesh, eye);
    const camQ = new THREE.Quaternion();
    const parentQ = new THREE.Quaternion();
    const face = (_r: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
      this.hornRig.parent?.getWorldQuaternion(parentQ);
      camera.getWorldQuaternion(camQ);
      this.hornRig.quaternion.copy(parentQ.invert().multiply(camQ));
      this.hornRig.rotateZ(this.hornFlip);
      this.hornRig.updateMatrixWorld(true);
    };
    headMesh.onBeforeRender = face;
    eye.onBeforeRender = face;
    this.group.add(this.hornRig, this.headGlow.mesh, this.headStar.mesh, this.holdStar.mesh);

    this.group.add(this.impactStar.mesh, this.impactGlint.mesh, this.pillar.mesh, this.shock.mesh, this.shockGold.mesh);

    const tri = new THREE.Shape();
    tri.moveTo(-1.2, 0); tri.lineTo(1.2, 0); tri.lineTo(0, 3.5); tri.closePath();
    this.plates = new THREE.InstancedMesh(
      new THREE.ShapeGeometry(tri),
      new THREE.MeshBasicMaterial({ color: DARK, side: THREE.DoubleSide }),
      PLATES,
    );
    this.plates.frustumCulled = false;
    this.group.add(this.plates, this.smoke.mesh);

    this.vortexGeo.setAttribute('position', new THREE.BufferAttribute(this.vortexPos, 3));
    this.vortex.frustumCulled = false;
    this.group.add(this.vortex);

    this.scales = new Emitter({
      ...defaultSettings(), maxParticles: 700, rate: 0, lifetime: 1.8, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 0.5, speed: 1.2, speedJitter: 0.6, spread: 180, gravity: 1.4, drag: 1.2,
      sizeStart: 0.2, sizeEnd: 0.05, colorStart: '#fff2c0', colorEnd: '#e8b84a',
      opacityStart: 0.8, opacityEnd: 0, additive: true, sizeJitter: 0.4, erosion: 0.3, spin: 0.8,
    });
    this.sparks = new Emitter({
      ...defaultSettings(), maxParticles: 900, rate: 0, lifetime: 0.8, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.4, speed: 12, speedJitter: 0.6, spread: 90, gravity: 9, drag: 1.4,
      sizeStart: 0.14, sizeEnd: 0.02, colorStart: '#f2fff6', colorEnd: '#2fbf7a',
      opacityStart: 0.9, opacityEnd: 0, additive: true, sizeJitter: 0.3, erosion: 0,
    });
    this.dust = new Emitter({
      ...defaultSettings(), maxParticles: 400, rate: 0, lifetime: 2.4, lifetimeJitter: 0.4,
      shape: 'sphere', shapeSize: 2.2, speed: 4, speedJitter: 0.6, spread: 80, gravity: -0.15, drag: 1.4,
      sizeStart: 1, sizeEnd: 2.4, colorStart: '#3a5a50', colorEnd: '#0b2a1c',
      opacityStart: 0.4, opacityEnd: 0, additive: false, colorMid: '#1d3a34', sizeJitter: 0.4, erosion: 0.6, spin: 0.4,
      groundFade: 0.3,
    });
    this.emitters.push(this.scales, this.sparks, this.dust, this.smoke.emitter);
    for (const e of this.emitters) this.group.add(e.points);
    this.reset();
  }

  /** Body direction from the head: -1 below (rising), +1 above (diving). */
  private trail = -1;
  /** Head rig roll: 0 while rising (snout up), π while diving (snout down). */
  private hornFlip = 0;

  get duration() {
    return DURATION;
  }

  get impactTime() {
    return IMPACT;
  }

  cast(ctx: CastContext) {
    this.ctx = ctx;
    this.center.copy(ctx.point).setY(0);
    this.screen.silhouettes = [ctx.caster.group, ...ctx.targets.map((e) => e.group)];
    this.outerRing.mesh.position.set(this.center.x, 0.05, this.center.z);
    this.innerRing.mesh.position.set(this.center.x, 0.06, this.center.z);
    this.diamondRing.mesh.position.set(this.center.x, 0.07, this.center.z);
    this.floorDisc.position.set(this.center.x, 0.02, this.center.z);
    this.implodePlane.position.set(this.center.x, 0.08, this.center.z);
    this.shock.mesh.position.set(this.center.x, 0.09, this.center.z);
    this.shockGold.mesh.position.set(this.center.x, 0.1, this.center.z);
    this.ticks.forEach((m, i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      m.position.set(this.center.x + Math.cos(a) * 4.2, 0.07, this.center.z + Math.sin(a) * 4.2);
      m.rotation.y = -a - Math.PI / 2;
    });
  }

  play() {
    this.reset();
    this.playing = true;
  }

  private reset() {
    this.time = 0;
    this.impacted = false;
    this.smokeDone = false;
    this.smallHit = [];
    this.shake = 0;
    this.hornFlip = 0;
    this.trail = -1;
    clearScreenFx(this.screen);
    this.smoke.clear();
    for (const e of this.emitters) e.clear();
    this.layout(0);
  }

  update(dt: number) {
    this.scales.update(dt);
    this.sparks.update(dt);
    this.dust.update(dt);
    this.smoke.update(dt);
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= DURATION) {
      if (this.settings.loop) { this.play(); return; }
      this.playing = false;
      clearScreenFx(this.screen);
    }
    if (!this.impacted && this.time >= IMPACT) this.onImpact();
    if (!this.smokeDone && this.time >= IMPACT + 0.1) this.onSmoke();
    this.layout(dt);
  }

  /** Hit source that is never exactly on the target (no zero-length knock direction). */
  private safeFrom(p: THREE.Vector3): THREE.Vector3 {
    const from = this.center.clone();
    if (from.distanceToSquared(p) < 0.09) from.set(p.x - 0.5, 0, p.z + 0.5);
    return from;
  }

  /** The dragon's spine for ribbon k: head first, sampled down the visible length. */
  private buildSpine(k: number, headY: number, spin: number, squeeze: number, straight: number): number {
    const L = this.ribbonLen[k];
    const H = this.settings.height;
    // trail -1: the body hangs below the head (rise, hold); +1: it streams above it (head-first dive).
    const trail = this.trail;
    const uMax = trail < 0 ? Math.min(1, headY / (L * -trail)) : 1;
    const phase = k === 0 ? 0 : k === 1 ? 2.1 : 4.2;
    for (let i = 0; i <= SEGS; i++) {
      const u = (i / SEGS) * uMax;
      const y = Math.max(0, headY + trail * u * L);
      // Serpentine: radius wobbles +-30% along the body and the coil opens up toward the tail.
      const wob = 1 + 0.3 * Math.sin(u * L * 1.1 - spin * 0.6 + phase);
      let r = THREE.MathUtils.lerp(2.5, 1.2, Math.min(1, y / H)) * wob * (1 + 0.5 * u);
      // Whiskers wander off the main path.
      if (k > 0) r += (0.9 + 0.6 * Math.sin(u * 9 + phase)) * smoothstep(u / 0.2);
      r *= squeeze * (1 - 0.85 * straight) * (0.15 + 0.85 * smoothstep(u / 0.15));
      const ang = phase + y * TWIST * (1 - 0.35 * u) + spin;
      this.spine[i].set(this.center.x + Math.cos(ang) * r, y, this.center.z + Math.sin(ang) * r);
    }
    return uMax;
  }

  private layout(dt: number) {
    const t = this.time;
    const D = IMPACT;
    const after = t - D;
    const ctx = this.ctx;
    const c = this.center;
    const H = this.settings.height;
    const sigilFade = 1 - smoothstep((t - 4.0) / 0.8);

    // --- Layer 1: world darkens and tints for the build-up, drains after the hit. ---
    this.screen.darken = 0.7 * smoothstep(t / DRAW) * (1 - smoothstep((t - 3.5) / 1.3));

    // --- Layer 2: the sigil is drawn by a moving gold spark, then the inner ring and ticks pop in. ---
    const draw = THREE.MathUtils.clamp(t / DRAW, 0, 1);
    const drawE = 1 - Math.pow(1 - draw, 2);
    const outerN = Math.floor(128 * drawE * sigilFade);
    this.outerRing.mesh.geometry.setDrawRange(0, outerN * 6);
    const hold = smoothstep((t - 0.9) / 0.4);
    this.outerRing.material.color.set(GOLD_BRIGHT).lerp(new THREE.Color(JADE_HOT), 0.25 * hold);
    this.outerRing.material.opacity = 0.6 * sigilFade;
    this.floorDisc.material.opacity = 0.55 * smoothstep(t / DRAW) * sigilFade;
    const innerOn = t >= 0.62;
    this.innerRing.mesh.geometry.setDrawRange(0, innerOn ? Math.floor(96 * sigilFade) * 6 : 0);
    this.innerRing.mesh.rotation.z = t * 0.5;
    this.innerRing.material.opacity = innerOn ? 0.6 * sigilFade : 0;
    const diaOn = t >= 0.7;
    this.diamondRing.mesh.geometry.setDrawRange(0, diaOn ? 4 * 6 : 0);
    this.diamondRing.mesh.rotation.z = -t * 0.8;
    this.diamondRing.material.opacity = diaOn ? 0.5 * sigilFade : 0;
    this.ticks.forEach((m, i) => {
      const on = t >= 0.66 + i * 0.033;
      m.visible = on && sigilFade > 0.01;
      (m.material as THREE.MeshBasicMaterial).opacity = 0.6 * sigilFade;
    });
    // Spark runs the circle while it draws, then is gone.
    if (t < DRAW + 0.05) {
      const th = drawE * Math.PI * 2;
      const sp = new THREE.Vector3(c.x + Math.cos(th) * RADIUS, 0.2, c.z - Math.sin(th) * RADIUS);
      this.spark.set(sp, 0.9, t < DRAW ? 1 : Math.max(0, 1 - (t - DRAW) / 0.05), t * 6);
    } else {
      this.spark.set(c, 0, 0);
    }

    // --- Layer 6a: jade qi motes drift up from the rim, then are pulled into the centre. ---
    const pull = smoothstep((Math.min(t, 1.15) - DRAW) / 0.25);
    for (let i = 0; i < MOTES; i++) {
      const m = this.moteSeed[i];
      const age = Math.max(0, t - m.d * 0.6);
      const rise = Math.min(age * m.s * 1.4, 3.2);
      const r = m.r * (1 - pull);
      const a = m.a + t * 0.5 + pull * 3;
      this.motePos[i * 3] = c.x + Math.cos(a) * r;
      this.motePos[i * 3 + 1] = 0.2 + THREE.MathUtils.lerp(rise, 0.9, pull);
      this.motePos[i * 3 + 2] = c.z + Math.sin(a) * r;
    }
    this.moteGeo.attributes.position.needsUpdate = true;
    this.moteMat.opacity = t < IMPLODE_END ? 0.65 * smoothstep(t / 0.2) : 0;

    // --- Implode: three toon crescents tighten at the centre; a dead beat at 1.15–1.2. ---
    const imp = smoothstep((Math.min(t, 1.15) - DRAW) / 0.25);
    this.implode.forEach((arc, i) => {
      arc.head = 0.25 + imp * 1.0;
      arc.length = 0.65;
      arc.time = Math.min(t, 1.15);
      arc.opacity = t > DRAW && t < IMPLODE_END ? 1 : 0;
      arc.mesh.scale.setScalar(Math.max(1e-3, 1 - 0.85 * imp));
      arc.mesh.rotation.z = (i * Math.PI * 2) / 3 + imp * 2.6;
    });

    // --- Layers 3-5: the dragon. Rise (ease-out), hold perfectly still, then dive down the axis. ---
    const rise = THREE.MathUtils.clamp((t - RISE_START) / (RISE_END - RISE_START), 0, 1);
    const riseE = 1 - Math.pow(1 - rise, 2);
    const dive = THREE.MathUtils.clamp((t - HOLD_END) / (IMPACT - HOLD_END), 0, 1);
    const inHold = t >= RISE_END && t < HOLD_END;
    let headY = 0.3 + (H - 0.3) * riseE;
    if (t >= HOLD_END) headY = H - (H - 0.5) * dive * dive;
    const squeeze = 1 - 0.25 * smoothstep((t - RISE_END) / 0.3) * (1 - dive);
    const straight = smoothstep(dive * 1.6);
    const spin = 3.2 * riseE;
    // The dragon turns over at the start of the dive: snout down, body streaming up behind it.
    const turn = smoothstep(dive * 3);
    this.trail = -1 + 2 * turn;
    const alive = t >= RISE_START && !this.impacted;
    const dragonOp = alive ? 0.9 : after > 0 ? 0.9 * Math.exp(-after * 16) : 0;
    const erosion = after > 0 ? Math.min(1, after * 5) * 0.8 : 0.1 * (1 - rise);
    for (let k = 0; k < 3; k++) {
      const visible = dragonOp > 0.01 && headY > 0.4;
      if (visible) {
        this.buildSpine(k, headY, spin, squeeze, straight);
        this.ribbons[k].setSpine(this.spine);
        if (k === 0) {
          this.under.setSpine(this.spine);
          const top = this.spine.map((p) => p.clone().setY(p.y + 0.12));
          this.goldLine.setSpine(top);
        }
      }
      this.ribbons[k].style(visible ? dragonOp * (k === 0 ? 1 : 0.8) : 0, erosion, t);
      if (k === 0) {
        this.under.style(visible ? dragonOp * 0.95 : 0, erosion, t);
        this.goldLine.style(visible ? dragonOp * 0.8 : 0, erosion, t);
      }
    }
    this.head.set(c.x, headY, c.z);
    const headOn = alive && headY > 0.4;
    this.headGlow.mesh.position.copy(this.head);
    this.headGlow.mesh.scale.setScalar(0.9 + 0.3 * dive);
    // No glow ball at the neck: it swallowed the drawn head. The eye carries the head's light.
    this.headGlow.opacity = 0;
    this.headStar.set(this.head, 0, 0, 0);
    this.headMat.opacity = headOn ? 1 : 0;
    // The eye flares gold → white when the dragon reaches the top (the "it sees you" beat), embers otherwise.
    const eyeOpen = StarBurst.pop(t - RISE_END, 0.5, 0.25);
    this.eyeMat.opacity = headOn ? 0.25 + 0.6 * eyeOpen.opacity * (t < HOLD_END ? 1 : 0) : 0;
    this.eyeMat.color.set(GOLD_BRIGHT).lerp(new THREE.Color(0xffffff), eyeOpen.opacity);
    this.hornRig.scale.setScalar(1.6);
    this.hornRig.position.copy(this.head);
    this.hornRig.visible = headOn;
    this.hornFlip = Math.PI * turn;

    // Hold glint: white first, then warm gold; the speed lines converge on the head.
    const hg = StarBurst.pop(t - RISE_END, 0.4, 0.35);
    this.holdStar.color.set(0xffffff).lerp(new THREE.Color(GOLD), smoothstep((t - RISE_END) / 0.3));
    // The glint sits above the snout tip so it never covers the head.
    this.holdStar.set(this.head.clone().setY(this.head.y + 4.4), 3.5 * hg.scale, hg.opacity * (t < HOLD_END ? 1 : 0), 0.2);
    this.screen.speedLines = t < RISE_END ? 0 : t < IMPACT ? Math.min(0.5, (t - RISE_END) / 0.4) : Math.max(0, 0.5 - after * 3);
    this.screen.focus.set(c.x, t < IMPACT ? headY : 1.2, c.z);

    if (dt > 0 && alive && !inHold && t < IMPACT) {
      // Gold scales shed from the head while it moves (nothing moves during the hold).
      this.scales.burst(t < HOLD_END ? 2 : 5, this.head);
    }

    // --- Enemies in the circle lift as the coil passes, then take the small hit. ---
    if (ctx) {
      const lift = after >= 0 ? 0 : 0.5 * smoothstep((t - 1.35) / 0.4);
      const off = new THREE.Vector3(0, lift, 0);
      ctx.targets.forEach((e, i) => {
        ctx.displace(e, off);
        if (dt > 0 && !this.smallHit[i] && t >= 1.5 + i * 0.06 && !this.impacted) {
          this.smallHit[i] = true;
          ctx.hit(e, { damage: 10, knock: 0.3, from: this.safeFrom(ctx.targetPos[i]) });
        }
      });
    }

    // --- Impact: stars, pillar, shock rings, plates. ---
    this.screen.impact = impactFrameAt(t, D, [1, 2, 1]);
    const ip = StarBurst.pop(after - 0.1, 0.14, 0.2);
    this.impactStar.set(new THREE.Vector3(c.x, 1.6, c.z), 8 * ip.scale, ip.opacity, 0.15);
    const ig = StarBurst.pop(after - 0.14, 0.05, 0.25);
    this.impactGlint.set(new THREE.Vector3(c.x, 3.4, c.z), 2.2 * ig.scale, ig.opacity, t * 2);
    const pa = (after - 0.1) / 0.25;
    this.pillar.set(c.x, c.z, 0, 24, pa >= 0 && pa < 1 ? 0.5 * (1 - pa) : 0);

    const sa = after - 0.05;
    const se = 1 - Math.pow(1 - THREE.MathUtils.clamp(sa / 0.45, 0, 1), 3);
    this.shock.mesh.scale.setScalar(1 + 8 * se);
    this.shock.material.color.set(JADE_HOT).lerp(new THREE.Color(JADE_BODY), se);
    this.shock.material.opacity = sa > 0 && sa < 0.5 ? 0.8 * (1 - sa / 0.5) : 0;
    const ga = after - 0.12;
    const ge = 1 - Math.pow(1 - THREE.MathUtils.clamp(ga / 0.5, 0, 1), 3);
    this.shockGold.mesh.scale.setScalar(1 + 6 * ge);
    this.shockGold.material.opacity = ga > 0 && ga < 0.5 ? 0.7 * (1 - ga / 0.5) : 0;

    this.updatePlates(after);
    this.updateVortex(t, after);

    this.shake = after >= 0 ? 0.9 * Math.exp(-after * 6) : t > RISE_START && t < RISE_END ? 0.03 : t >= HOLD_END ? 0.15 * dive : 0;
  }

  private updatePlates(after: number) {
    const c = this.center;
    const m = new THREE.Matrix4();
    const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const qYaw = new THREE.Quaternion();
    const qTilt = new THREE.Quaternion();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3();
    for (let i = 0; i < PLATES; i++) {
      const s = this.plateSeed[i];
      if (after < 0) {
        m.compose(pos.set(0, -10, 0), q.identity(), sc.setScalar(1e-4));
        this.plates.setMatrixAt(i, m);
        continue;
      }
      const grow = Math.min(1, after / 0.12);
      const phi = s.tilt * (1 - Math.pow(1 - Math.min(1, after / 0.3), 2));
      const sink = 2.4 * smoothstep((after - 0.7) / 1.1);
      const scale = Math.max(1e-4, s.size * (0.3 + 0.7 * grow) * (1 - smoothstep((after - 1.5) / 0.3)));
      qYaw.setFromAxisAngle(up, -s.a - Math.PI / 2);
      axis.set(-Math.sin(s.a), 0, Math.cos(s.a));
      qTilt.setFromAxisAngle(axis, phi);
      q.copy(qTilt).multiply(qYaw).multiply(qFlat);
      pos.set(c.x + Math.cos(s.a) * s.r, 0.02 - sink, c.z + Math.sin(s.a) * s.r);
      m.compose(pos, q, sc.setScalar(scale));
      this.plates.setMatrixAt(i, m);
    }
    this.plates.instanceMatrix.needsUpdate = true;
  }

  private updateVortex(t: number, after: number) {
    const c = this.center;
    const on = THREE.MathUtils.clamp((after - 0.2) / 0.5, 0, 1);
    for (let i = 0; i < VORTEX; i++) {
      const s = this.vortexSeed[i];
      const r = s.r * (0.5 + 0.5 * on);
      const a = s.a + Math.max(0, after) * (1.8 * s.w) / (0.6 + r * 0.25);
      this.vortexPos[i * 3] = c.x + Math.cos(a) * r;
      this.vortexPos[i * 3 + 1] = 0.3 + s.y * 1.6 * on + Math.max(0, after) * 0.15;
      this.vortexPos[i * 3 + 2] = c.z + Math.sin(a) * r;
    }
    this.vortexGeo.attributes.position.needsUpdate = true;
    this.vortexMat.opacity = 0.4 * on * (1 - smoothstep((t - 4.4) / 0.7));
    this.vortex.visible = this.vortexMat.opacity > 0.003;
  }

  private onImpact() {
    this.impacted = true;
    const c = this.center;
    this.sparks.burst(450, new THREE.Vector3(c.x, 0.6, c.z));
    this.dust.burst(180, new THREE.Vector3(c.x, 0.4, c.z));
    this.scales.burst(160, new THREE.Vector3(c.x, 2.5, c.z));
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.targets.forEach((e, i) => {
      ctx.hit(e, { damage: this.settings.damage, knock: 7, from: this.safeFrom(ctx.targetPos[i]) });
    });
  }

  private onSmoke() {
    this.smokeDone = true;
    const c = this.center;
    // A toon smoke ring bulging outward round the crater.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      this.smoke.trigger(new THREE.Vector3(c.x + Math.cos(a) * 2.8, 0.9, c.z + Math.sin(a) * 2.8), 1.5, 1.3);
    }
  }
}

export const jadeDragonAscensionModule: EffectModule = {
  label: 'jade dragon ascension',
  category: 'targeted',
  targeting: { mode: 'ground', radius: RADIUS },
  create: () => new JadeDragonAscension(),
  telegraphs(effect) {
    const e = effect as JadeDragonAscension;
    const p = e.ctx?.point;
    if (!p) return [];
    return [{ shape: { kind: 'circle', x: p.x, z: p.z, radius: RADIUS }, start: 0.05, impact: e.impactTime }];
  },
  bloom: { enabled: true, strength: 0.6, radius: 0.5, threshold: 0.82 },
  frameCamera(camera, controls, effect) {
    const e = effect as JadeDragonAscension;
    if (e.ctx) frameCast(camera, controls, e.ctx, e.settings.height + 2);
  },
  buildGui(f, effect) {
    const s = (effect as JadeDragonAscension).settings;
    f.add(s, 'loop');
    f.add(s, 'height', 6, 16, 0.5);
    f.add(s, 'damage', 1, 150, 1);
  },
};
