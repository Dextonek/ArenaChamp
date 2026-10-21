import * as THREE from 'three';

/**
 * Ground "telegraphs": red danger zones that show where and when an effect will hit, the classic
 * "don't stand in the red" mechanic. A zone fills up from its origin as a countdown, flashes on impact, and can
 * stay dangerous for a while (`until`) for lingering effects like burning ground.
 *
 * Effects only declare zones (`EffectModule.telegraphs`); main.ts draws them and tests the player dummy.
 * Directions: `dir` is a yaw in radians, 0 = toward +Z, π = toward -Z (from the caster to the enemy).
 */
export type TelegraphShape =
  | { kind: 'circle'; x: number; z: number; radius: number }
  | { kind: 'ring'; x: number; z: number; inner: number; outer: number }
  | { kind: 'cone'; x: number; z: number; radius: number; angle: number /* degrees, full width */; dir: number }
  | { kind: 'line'; x1: number; z1: number; x2: number; z2: number; width: number };

export interface TelegraphSpec {
  shape: TelegraphShape;
  /** Seconds after play() when the zone appears and starts its countdown. */
  start: number;
  /** Seconds after play() when the damage lands (countdown full). */
  impact: number;
  /** Optional: the zone keeps hurting until this time (lingering ground effect). */
  until?: number;
}

/** True when a ground point (x, z) lies inside the shape. */
export function insideTelegraph(shape: TelegraphShape, x: number, z: number): boolean {
  switch (shape.kind) {
    case 'circle':
      return Math.hypot(x - shape.x, z - shape.z) <= shape.radius;
    case 'ring': {
      const d = Math.hypot(x - shape.x, z - shape.z);
      return d >= shape.inner && d <= shape.outer;
    }
    case 'cone': {
      const dx = x - shape.x, dz = z - shape.z;
      const d = Math.hypot(dx, dz);
      if (d > shape.radius) return false;
      if (d < 1e-6) return true;
      let diff = Math.atan2(dx, dz) - shape.dir;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      return Math.abs(diff) <= THREE.MathUtils.degToRad(shape.angle) / 2;
    }
    case 'line': {
      const ax = shape.x2 - shape.x1, az = shape.z2 - shape.z1;
      const len2 = ax * ax + az * az || 1;
      const t = ((x - shape.x1) * ax + (z - shape.z1) * az) / len2;
      if (t < 0 || t > 1) return false;
      const px = shape.x1 + ax * t, pz = shape.z1 + az * t;
      return Math.hypot(x - px, z - pz) <= shape.width / 2;
    }
  }
}

const fillVertex = /* glsl */ `
  attribute float aFill;
  varying float vFill;
  varying vec2 vLocal;
  void main() {
    vFill = aFill;
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fillFragment = /* glsl */ `
  uniform float uProgress, uTime, uAlpha, uFlash;
  uniform vec3 uColor;
  varying float vFill;
  varying vec2 vLocal;
  void main() {
    float filled = step(vFill, uProgress);
    float stripes = 0.5 + 0.5 * sin((vLocal.x + vLocal.y) * 5.0 - uTime * 5.0);
    float a = 0.08 + 0.05 * stripes + filled * 0.2;
    // Bright moving front shows how close the hit is.
    a += smoothstep(0.035, 0.0, abs(vFill - uProgress)) * step(uProgress, 0.999) * 0.45;
    gl_FragColor = vec4(uColor * (1.0 + uFlash * 1.2), min(1.0, (a + uFlash * 0.45) * uAlpha));
  }
`;

const RED = new THREE.Color(0.9, 0.06, 0.03);

/** Builds a flat ribbon (width w) along a polyline in the XZ plane, for crisp zone outlines. */
function ribbon(points: THREE.Vector2[], w: number, closed: boolean): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const dir = new THREE.Vector2().subVectors(next, prev).normalize();
    const nrm = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(w / 2);
    const p = points[i];
    pos.push(p.x + nrm.x, 0, p.y + nrm.y, p.x - nrm.x, 0, p.y - nrm.y);
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = ((i + 1) % n) * 2;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function circlePts(r: number, from = 0, to = Math.PI * 2, segs = 72): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = from + (to - from) * (i / segs);
    pts.push(new THREE.Vector2(Math.sin(a) * r, Math.cos(a) * r));
  }
  return pts;
}

/** Fill geometry in local XY (later rotated onto the ground) with a per-vertex fill coordinate 0..1. */
function fillGeometry(shape: TelegraphShape): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  const fill = (fn: (x: number, y: number) => number) => {
    const p = g.attributes.position;
    const f = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) f[i] = fn(p.getX(i), p.getY(i));
    g.setAttribute('aFill', new THREE.BufferAttribute(f, 1));
  };
  switch (shape.kind) {
    case 'circle':
      g = new THREE.CircleGeometry(shape.radius, 72);
      fill((x, y) => Math.hypot(x, y) / shape.radius);
      break;
    case 'ring':
      g = new THREE.RingGeometry(shape.inner, shape.outer, 72, 4);
      fill((x, y) => (Math.hypot(x, y) - shape.inner) / Math.max(1e-3, shape.outer - shape.inner));
      break;
    case 'cone': {
      const half = THREE.MathUtils.degToRad(shape.angle) / 2;
      // CircleGeometry's theta starts at +X; centre the wedge on +Y (which becomes -Z after rotateX, see below).
      g = new THREE.CircleGeometry(shape.radius, 48, Math.PI / 2 - half, half * 2);
      fill((x, y) => Math.hypot(x, y) / shape.radius);
      break;
    }
    case 'line': {
      const len = Math.hypot(shape.x2 - shape.x1, shape.z2 - shape.z1);
      g = new THREE.PlaneGeometry(shape.width, len, 1, 16).translate(0, len / 2, 0);
      fill((_x, y) => y / Math.max(1e-3, len));
      break;
    }
  }
  return g;
}

interface Zone {
  spec: TelegraphSpec;
  group: THREE.Group;
  fillMat: THREE.ShaderMaterial;
  edgeMat: THREE.MeshBasicMaterial;
}

/** Draws a set of telegraph zones and animates them from the effect's clock. */
export class TelegraphLayer {
  readonly group = new THREE.Group();
  private zones: Zone[] = [];

  /** Replaces the zones (call on every play). */
  set(specs: TelegraphSpec[]) {
    for (const z of this.zones) {
      this.group.remove(z.group);
      z.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      z.fillMat.dispose();
      z.edgeMat.dispose();
    }
    this.zones = specs.map((spec) => this.build(spec));
  }

  private build(spec: TelegraphSpec): Zone {
    const s = spec.shape;
    const zoneGroup = new THREE.Group();
    const fillMat = new THREE.ShaderMaterial({
      vertexShader: fillVertex, fragmentShader: fillFragment, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide,
      uniforms: {
        uProgress: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 0 }, uFlash: { value: 0 },
        uColor: { value: RED.clone() },
      },
    });
    const edgeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.4, 0.12, 0.05), transparent: true, opacity: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide,
    });

    // Fill lies in local XY; rotateX(-π/2) maps local +Y to world -Z.
    const fillMesh = new THREE.Mesh(fillGeometry(s), fillMat);
    fillMesh.rotation.x = -Math.PI / 2;
    zoneGroup.add(fillMesh);

    const W = 0.12;
    const edges: THREE.BufferGeometry[] = [];
    if (s.kind === 'circle') edges.push(ribbon(circlePts(s.radius), W, true));
    if (s.kind === 'ring') edges.push(ribbon(circlePts(s.outer), W, true), ribbon(circlePts(s.inner), W, true));
    if (s.kind === 'cone') {
      const half = THREE.MathUtils.degToRad(s.angle) / 2;
      // Edge points in XZ with the wedge centred on -Z (matching the rotated fill), apex at the origin.
      const arc = circlePts(s.radius, Math.PI - half, Math.PI + half, 40);
      edges.push(ribbon([new THREE.Vector2(0, 0), ...arc], W, true));
    }
    if (s.kind === 'line') {
      const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1);
      const hw = s.width / 2;
      // Rectangle in XZ along -Z (matching the rotated fill).
      edges.push(ribbon([
        new THREE.Vector2(-hw, 0), new THREE.Vector2(-hw, -len), new THREE.Vector2(hw, -len), new THREE.Vector2(hw, 0),
      ], W, true));
    }
    for (const e of edges) zoneGroup.add(new THREE.Mesh(e, edgeMat));

    // Place and orient: local -Z must point along the zone's direction.
    if (s.kind === 'line') {
      zoneGroup.position.set(s.x1, 0.03, s.z1);
      zoneGroup.rotation.y = Math.atan2(s.x2 - s.x1, s.z2 - s.z1) + Math.PI;
    } else {
      zoneGroup.position.set(s.x, 0.03, s.z);
      if (s.kind === 'cone') zoneGroup.rotation.y = s.dir + Math.PI;
    }
    zoneGroup.visible = false;
    this.group.add(zoneGroup);
    return { spec, group: zoneGroup, fillMat, edgeMat };
  }

  /** Animates every zone for effect time `t` (seconds since play). */
  update(t: number) {
    for (const z of this.zones) {
      const { start, impact } = z.spec;
      const until = Math.max(impact, z.spec.until ?? impact);
      const fadeOut = 0.45;
      const visible = t >= start && t <= until + fadeOut;
      z.group.visible = visible;
      if (!visible) continue;
      const progress = THREE.MathUtils.clamp((t - start) / Math.max(1e-3, impact - start), 0, 1);
      const fadeIn = THREE.MathUtils.clamp((t - start) / 0.15, 0, 1);
      const out = t > until ? 1 - (t - until) / fadeOut : 1;
      const flash = t >= impact ? Math.exp(-(t - impact) * 9) : 0;
      const u = z.fillMat.uniforms;
      u.uProgress.value = progress;
      u.uTime.value = t;
      u.uAlpha.value = fadeIn * out;
      u.uFlash.value = flash;
      // Outline pulses faster as the hit gets close.
      const pulse = 0.5 + 0.5 * Math.sin(t * (6 + 14 * progress));
      z.edgeMat.opacity = fadeIn * out * (0.55 + 0.35 * pulse + 0.4 * flash);
    }
  }
}
