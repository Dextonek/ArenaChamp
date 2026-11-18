import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Layers } from './piece';

/**
 * Real 3D creatures inside the showpieces' 2D layers (the user, 2026-11-18: "make the models more real, with continuous
 * bodies, like the champs"). A creature is a model built straight in Blender (blender/creatures/dragon.py: the snout's
 * tip at x = 0, the tail along +x, y up) and bent here along a path, every frame, on the processor: a vertex's x says
 * how far behind the head it sits along the path, its y and z where it sits across it. The frames along the path turn
 * as little as they can (rotation-minimising), so a coil does not flip.
 *
 * The picture is drawn by its own WebGL renderer (lit like the game's heroes: a room for reflections, a warm key, a cool
 * rim, ACES) into a canvas the size of the layers, and then drawn into the flat layer like any other figure. Its
 * silhouette is cut out of the glow layer (so a glow behind it stays behind it) and its glowing parts (the eyes) are
 * added to the glow layer, where they bloom.
 */

export interface Creature {
  /** The model's meshes, each with its straight positions and normals kept. */
  meshes: { mesh: THREE.Mesh; pos: Float32Array; nrm: Float32Array; name: string }[];
  root: THREE.Group;
  /** The model's length along x (snout to tail). */
  length: number;
}

const cache = new Map<string, Promise<Creature>>();
const loaded = new Map<string, Creature>();

/** Loads a creature once (`url` under /models/showpiece/). */
export function loadCreature(url: string): Promise<Creature> {
  let p = cache.get(url);
  if (!p) {
    p = new GLTFLoader().loadAsync(url).then((gltf) => {
      const root = new THREE.Group();
      const meshes: Creature['meshes'] = [];
      let length = 0;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const g = m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        g.computeBoundingBox();
        length = Math.max(length, g.boundingBox!.max.x);
        const mesh = new THREE.Mesh(g, m.material);
        mesh.frustumCulled = false;
        root.add(mesh);
        // The object's name in Blender (a mesh with several materials comes as a group of that name).
        const name = (m.parent && m.parent !== gltf.scene && !m.name.startsWith(m.parent.name) ? m.parent.name : m.name) || m.parent?.name || '';
        meshes.push({ mesh, name, pos: (g.attributes.position.array as Float32Array).slice(), nrm: (g.attributes.normal.array as Float32Array).slice() });
      });
      const c = { meshes, root, length };
      loaded.set(url, c);
      return c;
    });
    cache.set(url, p);
  }
  return p;
}

/** A creature already loaded, or null (draw nothing yet). */
export const creature = (url: string) => loaded.get(url) ?? null;

// --- The stage ------------------------------------------------------------------------------------------------------
let stage: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  key: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  glowMat: THREE.MeshBasicMaterial;
} | null = null;

function getStage() {
  if (stage) return stage;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x20160f, 0.9);
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
  key.position.set(5, 7, 10);
  const rim = new THREE.DirectionalLight(0x8fe8ff, 1.4);
  rim.position.set(-6, 3, -8);
  scene.add(hemi, key, rim);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  // In the glow pass the body only hides what is behind it (depth, no colour), so the glow layer stays clear there.
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x000000, colorWrite: false });
  stage = { renderer, scene, camera, key, rim, hemi, glowMat };
  return stage;
}

// --- Bending along a path -------------------------------------------------------------------------------------------
const tmp = new THREE.Vector3();

/** A path sampled by arc length, with rotation-minimising frames. */
export class Path {
  readonly pts: THREE.Vector3[] = [];
  readonly tan: THREE.Vector3[] = [];
  readonly up: THREE.Vector3[] = [];
  readonly side: THREE.Vector3[] = [];
  readonly length: number;
  readonly step: number;

  /**
   * `points` from where the tail trails to where the head goes; `upHint` is "up" (the creature's back) at the start. With
   * `upAt`, "up" is asked for at every point instead (where the back should face: away from a spiral's axis, say) and only
   * kept square to the path; otherwise the frames are carried along turning as little as they can.
   */
  constructor(points: THREE.Vector3[], upHint = new THREE.Vector3(0, 1, 0), samples = 400, upAt?: (p: THREE.Vector3, t: THREE.Vector3) => THREE.Vector3) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.length = curve.getLength();
    this.step = this.length / samples;
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      this.pts.push(curve.getPointAt(u));
      this.tan.push(curve.getTangentAt(u).normalize());
    }
    // Double reflection (Wang et al.): each frame turned from the last as little as the curve allows.
    let r = upHint.clone().sub(this.tan[0].clone().multiplyScalar(upHint.dot(this.tan[0]))).normalize();
    if (r.lengthSq() < 1e-6) r = new THREE.Vector3(1, 0, 0);
    this.up.push(r.clone());
    for (let i = 0; i < samples; i++) {
      const v1 = this.pts[i + 1].clone().sub(this.pts[i]);
      const c1 = v1.dot(v1) || 1e-9;
      const rL = r.clone().sub(v1.clone().multiplyScalar((2 / c1) * v1.dot(r)));
      const tL = this.tan[i].clone().sub(v1.clone().multiplyScalar((2 / c1) * v1.dot(this.tan[i])));
      const v2 = this.tan[i + 1].clone().sub(tL);
      const c2 = v2.dot(v2) || 1e-9;
      r = rL.sub(v2.multiplyScalar((2 / c2) * v2.dot(rL))).normalize();
      this.up.push(r.clone());
    }
    if (upAt) {
      for (let i = 0; i <= samples; i++) {
        const want = upAt(this.pts[i], this.tan[i]);
        const u = want.clone().sub(this.tan[i].clone().multiplyScalar(want.dot(this.tan[i])));
        if (u.lengthSq() > 1e-6) this.up[i].copy(u.normalize());
      }
    }
    for (let i = 0; i <= samples; i++) this.side.push(this.tan[i].clone().cross(this.up[i]).normalize());
  }

  /** The point and frame at distance d along the path (beyond either end: straight on along the end's tangent). */
  at(d: number, out: { p: THREE.Vector3; t: THREE.Vector3; u: THREE.Vector3; s: THREE.Vector3 }) {
    const n = this.pts.length - 1;
    const f = d / this.step;
    const i = Math.max(0, Math.min(n - 1, Math.floor(f)));
    const k = Math.max(0, Math.min(1, f - i));
    out.p.lerpVectors(this.pts[i], this.pts[i + 1], k);
    out.t.lerpVectors(this.tan[i], this.tan[i + 1], k).normalize();
    out.u.lerpVectors(this.up[i], this.up[i + 1], k).normalize();
    out.s.lerpVectors(this.side[i], this.side[i + 1], k).normalize();
    if (f < 0) out.p.addScaledVector(this.tan[0], f * this.step);
    else if (f > n) out.p.addScaledVector(this.tan[n], (f - n) * this.step);
    return out;
  }
}

const frame = { p: new THREE.Vector3(), t: new THREE.Vector3(), u: new THREE.Vector3(), s: new THREE.Vector3() };

/**
 * Bends the creature along `path`: its head at distance `head` along the path, its body trailing back towards the path's
 * start, `scale` world units for each of the model's metres; `roll` turns it about its own length (radians).
 */
export function pose(c: Creature, path: Path, head: number, scale = 1, roll = 0) {
  const cr = Math.cos(roll), sr = Math.sin(roll);
  for (const { mesh, pos, nrm } of c.meshes) {
    const P = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const N = mesh.geometry.attributes.normal as THREE.BufferAttribute;
    const pa = P.array as Float32Array, na = N.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y0 = pos[i + 1], z0 = pos[i + 2];
      const y = y0 * cr - z0 * sr, z = y0 * sr + z0 * cr;
      path.at(head - x * scale, frame);
      const { p, t, u, s } = frame;
      // Model +x runs back from the head (against the path's direction); +y is the frame's up; +z its side.
      pa[i] = p.x + (u.x * y + s.x * -z) * scale;
      pa[i + 1] = p.y + (u.y * y + s.y * -z) * scale;
      pa[i + 2] = p.z + (u.z * y + s.z * -z) * scale;
      const nx = nrm[i], ny0 = nrm[i + 1], nz0 = nrm[i + 2];
      const ny = ny0 * cr - nz0 * sr, nz = ny0 * sr + nz0 * cr;
      tmp.set(-t.x * nx + u.x * ny - s.x * nz, -t.y * nx + u.y * ny - s.y * nz, -t.z * nx + u.z * ny - s.z * nz).normalize();
      na[i] = tmp.x; na[i + 1] = tmp.y; na[i + 2] = tmp.z;
    }
    P.needsUpdate = true;
    N.needsUpdate = true;
  }
}

export interface View {
  /** Where the camera is and what it looks at (world units). */
  eye: [number, number, number];
  at: [number, number, number];
  /** Vertical field of view in degrees. */
  fov?: number;
  /** The rim light's colour (the scene's own light, e.g. the moon). */
  rim?: number;
  key?: number;
  /** How bright its glowing parts are on the glow layer, 0 to 1 (default 1). */
  glow?: number;
  /** How much of the creature is drawn, 0 to 1 (fades it in or out). */
  alpha?: number;
  /** Nothing below this height (world units) is drawn: the water's surface it rises out of. */
  clipBelow?: number;
  /** Turns the picture about the view's axis (radians, as the 2D canvas turns: positive is clockwise on screen). */
  roll?: number;
  /** Moves the whole picture by this much (picture units), e.g. so the point looked at sits off the frame's centre. */
  shift?: [number, number];
}

/**
 * Draws a posed creature into the layers: into the flat layer as a figure, cut out of the glow layer, its glowing parts
 * added to the glow layer. Call it where it belongs in the drawing order: what is drawn after it is in front of it.
 */
export function drawCreature(L: Layers, c: Creature, v: View) {
  const st = getStage();
  const w = L.flat.canvas.width, h = L.flat.canvas.height;
  const r = st.renderer;
  if (r.domElement.width !== w || r.domElement.height !== h) r.setSize(w, h, false);
  st.camera.fov = v.fov ?? 30;
  st.camera.aspect = w / h;
  st.camera.position.set(...v.eye);
  st.camera.up.set(Math.sin(v.roll ?? 0), Math.cos(v.roll ?? 0), 0);
  st.camera.lookAt(new THREE.Vector3(...v.at));
  // A shift moves the lens, not the picture, so the picture still covers the whole frame.
  const [sx, sy] = v.shift ?? [0, 0];
  if (sx || sy) st.camera.setViewOffset(w, h, (-sx * w) / 1920, (-sy * h) / 1080, w, h);
  else st.camera.clearViewOffset();
  st.camera.updateProjectionMatrix();
  st.rim.color.setHex(v.rim ?? 0x8fe8ff);
  st.key.color.setHex(v.key ?? 0xfff0d8);
  st.scene.add(c.root);
  r.clippingPlanes = v.clipBelow === undefined ? [] : [new THREE.Plane(new THREE.Vector3(0, 1, 0), -v.clipBelow)];
  const alpha = v.alpha ?? 1;

  // The figure.
  r.render(st.scene, st.camera);
  // Drawn over the whole picture in picture units, under whatever transform the piece has set (a camera move of its own).
  for (const ctx of [L.flat, L.glow]) ctx.save();
  L.flat.globalAlpha = alpha;
  L.flat.drawImage(r.domElement, 0, 0, 1920, 1080);
  // Its silhouette, out of the glow layer.
  L.glow.globalAlpha = alpha;
  L.glow.globalCompositeOperation = 'destination-out';
  L.glow.drawImage(r.domElement, 0, 0, 1920, 1080);
  // Its glowing parts only (everything else black), added to the glow layer.
  const glow = (v.glow ?? 1) * alpha;
  if (glow > 0) {
    const saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const order = new Map<THREE.Mesh, number>();
    for (const { mesh } of c.meshes) {
      saved.set(mesh, mesh.material);
      order.set(mesh, mesh.renderOrder);
      // Glowing parts draw after the parts that only hide what is behind them, so an eye under its lid stays hidden.
      mesh.renderOrder = 1;
      // A part painted in code says itself what of it glows.
      if (mesh.userData.glowMaterial) {
        mesh.material = mesh.userData.glowMaterial as THREE.Material;
        continue;
      }
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const em = mats.map((m) => {
        const s = m as THREE.MeshStandardMaterial;
        const e = s.emissive && s.emissiveIntensity > 0 && (s.emissive.r + s.emissive.g + s.emissive.b) > 0.01;
        return e ? new THREE.MeshBasicMaterial({ color: s.emissive.clone().multiplyScalar(Math.min(2, s.emissiveIntensity)) }) : st.glowMat;
      });
      mesh.material = Array.isArray(mesh.material) ? em : em[0];
      if (em.every((m) => m === st.glowMat)) mesh.renderOrder = 0;
    }
    r.render(st.scene, st.camera);
    for (const [mesh, m] of saved) {
      const now = mesh.material;
      for (const x of Array.isArray(now) ? now : [now]) if (x !== st.glowMat && x !== mesh.userData.glowMaterial) x.dispose();
      mesh.material = m;
      mesh.renderOrder = order.get(mesh) ?? 0;
    }
    L.glow.globalCompositeOperation = 'lighter';
    L.glow.globalAlpha = glow;
    L.glow.drawImage(r.domElement, 0, 0, 1920, 1080);
  }
  for (const ctx of [L.flat, L.glow]) ctx.restore();
  st.scene.remove(c.root);
}
