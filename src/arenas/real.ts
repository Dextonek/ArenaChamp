import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Obstacle } from '../obstacles';
import { RING } from './common';

/**
 * Arenas of the realistic style (2026-11-11, after the heroes'): scanned props from Poly Haven (CC0), cut down and laid
 * out in Blender (blender/arenas/real/kit.py, one script per arena) and written as one file,
 * public/models/arenas/<id>.glb, with an object per obstacle (`cover0`, `cover1`... in the order of the obstacle list)
 * and one `back` for everything round the ring. The same script writes src/arenas/real/<id>.json: the obstacles, so the
 * layout lives in one place, and the spots the game lights or animates (`marks`).
 *
 * A file is loaded once and kept; each build of the arena gets its own copy of the objects, which share the file's
 * geometry, materials and textures. So an arena's `dispose` must not free what `realProps` gave it.
 */
export interface RealLayout {
  obstacles: Obstacle[];
  marks: { kind: string; x: number; y: number; z: number }[];
}

export interface RealProps {
  /** One object per obstacle, in the obstacle list's order (null where the file has none). */
  cover: (THREE.Object3D | null)[];
  back: THREE.Object3D | null;
}

/** How a file's materials are fitted to the arena's light (the scans are photographed in daylight). */
export interface RealTune {
  /** Albedo times this (dusk and night arenas want less than 1). */
  dim?: number;
  /** How much of the sky's reflection the props take. */
  env?: number;
  /** Per material (a part of its name): its own `dim`, a `tint` multiplied in, an emissive colour and strength. */
  parts?: Record<string, { dim?: number; tint?: number; emissive?: number; strength?: number; rough?: number }>;
}

const files = new Map<string, Promise<THREE.Group>>();

function loadFile(id: string, tune: RealTune) {
  let f = files.get(id);
  if (!f) {
    f = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`${import.meta.env.BASE_URL}models/arenas/${id}.glb`).then((g) => {
      const seen = new Set<THREE.Material>();
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
          if (seen.has(mat)) continue;
          seen.add(mat);
          const part = Object.entries(tune.parts ?? {}).find(([k]) => mat.name.includes(k))?.[1];
          mat.color.multiplyScalar(part?.dim ?? tune.dim ?? 1);
          if (part?.tint !== undefined) mat.color.multiply(new THREE.Color(part.tint));
          mat.envMapIntensity = tune.env ?? 0.5;
          if (part?.rough !== undefined) mat.roughness = part.rough;
          if (part?.emissive !== undefined) {
            mat.emissive.set(part.emissive);
            mat.emissiveIntensity = part.strength ?? 1;
          }
          for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) if (t) t.anisotropy = 4;
        }
      });
      return g.scene;
    });
    files.set(id, f);
  }
  return f;
}

/** The arena's props, a fresh copy of the objects (see the note on sharing above). */
export function realProps(id: string, covers: number, tune: RealTune = {}): Promise<RealProps> {
  return loadFile(id, tune).then((scene) => {
    const copy = (name: string) => scene.getObjectByName(name)?.clone(true) ?? null;
    return { cover: Array.from({ length: covers }, (_, i) => copy(`cover${i}`)), back: copy('back') };
  });
}

const textures = new Map<string, THREE.Texture>();

/** A tiling texture of public/textures/arenas/, loaded once and kept. */
export function realTexture(file: string, repeat: number, srgb = false) {
  const key = `${file}:${repeat}`;
  let t = textures.get(key);
  if (!t) {
    t = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/arenas/${file}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, t);
  }
  return t;
}

/**
 * A scanned ground material: `<name>_diff.jpg`, `<name>_nor.jpg` and `<name>_rough.jpg`, `repeat` times across the
 * mesh's UVs. `color` dims it into the floors' dark band (see `floorDisc`); `rough` scales the scan's roughness (below
 * 1: wet).
 */
export function realGround(name: string, repeat: number, color: number, rough = 1, env = 0.35) {
  const m = new THREE.MeshStandardMaterial({
    map: realTexture(`${name}_diff.jpg`, repeat, true), normalMap: realTexture(`${name}_nor.jpg`, repeat), roughnessMap: realTexture(`${name}_rough.jpg`, repeat),
    color, roughness: rough, envMapIntensity: env,
  });
  m.normalScale.set(0.7, 0.7);
  return m;
}

/**
 * The sea round an arena: a wide disc at height `y` with a hole of radius `inner` where the arena stands. Waves are a
 * few moving sine swells whose slopes tilt the surface; it shows the sky's horizon colour at a glancing angle and its
 * own deep colour looking down, a glint from the sun, and foam where it meets the arena's foot.
 */
export class Sea {
  readonly mesh: THREE.Mesh;
  private uniforms: Record<string, THREE.IUniform>;

  constructor(o: { y: number; inner: number; deep: number; sky: number; glint: number; sun: THREE.Vector3; foam?: number }) {
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 }, uDeep: { value: new THREE.Color(o.deep) }, uSky: { value: new THREE.Color(o.sky) }, uGlint: { value: new THREE.Color(o.glint) },
        uFoam: { value: new THREE.Color(o.foam ?? 0x8a98a4) }, uSun: { value: o.sun.clone().normalize() }, uCentre: { value: new THREE.Vector2(RING.x, RING.z) },
        uInner: { value: o.inner },
      },
    ]);
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, fog: true,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uInner;
        uniform vec3 uDeep, uSky, uGlint, uFoam, uSun;
        uniform vec2 uCentre;
        varying vec3 vWorld;
        #include <fog_pars_fragment>
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        // the slope of one swell: direction d, wavelength l, speed s, steepness a
        vec2 swell(vec2 p, vec2 d, float l, float s, float a) {
          float k = 6.2832 / l;
          return d * (a * cos(dot(p, d) * k + uTime * s));
        }
        void main() {
          vec2 p = vWorld.xz;
          vec2 slope = swell(p, normalize(vec2(1.0, 0.35)), 9.0, 0.9, 0.10) + swell(p, normalize(vec2(-0.4, 1.0)), 5.2, 1.3, 0.08)
            + swell(p, normalize(vec2(0.7, -0.7)), 2.3, 1.9, 0.06) + swell(p, normalize(vec2(-0.9, -0.2)), 1.1, 2.6, 0.045);
          slope += (vec2(noise(p * 1.7 + uTime * 0.25), noise(p * 1.7 - uTime * 0.2 + 7.0)) - 0.5) * 0.16;
          vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
          vec3 v = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          vec3 col = mix(uDeep, uSky, 0.12 + 0.75 * fres);
          vec3 h = normalize(v + uSun);
          col += uGlint * pow(max(dot(n, h), 0.0), 140.0) * 1.6;
          // foam at the arena's foot: a broken band that breathes with the swell
          float r = length(p - uCentre) - uInner;
          float band = smoothstep(1.5, 0.0, r) * (0.55 + 0.45 * sin(uTime * 0.8 + r * 3.0));
          float foam = smoothstep(0.62, 0.95, noise(p * 1.9 + uTime * 0.15) * 0.55 + band * 0.8);
          col = mix(col, uFoam, 0.6 * foam * smoothstep(2.0, 0.0, r));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.RingGeometry(o.inner - 0.2, 320, 96, 24), material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(RING.x, o.y, RING.z);
  }

  update(time: number) {
    this.uniforms.uTime.value = time;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

let glowTexture: THREE.Texture | null = null;

/** Soft additive glows (a lantern's light with no lamp in the scene): one sprite per spot, flickering a little. */
export class Glows {
  readonly group = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  private material: THREE.SpriteMaterial;

  constructor(spots: { x: number; y: number; z: number }[], color: number, private size: number) {
    if (!glowTexture) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glowTexture = new THREE.CanvasTexture(c);
    }
    this.material = new THREE.SpriteMaterial({ map: glowTexture, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 });
    for (const s of spots) {
      const sp = new THREE.Sprite(this.material);
      sp.position.set(s.x, s.y, s.z);
      sp.scale.setScalar(size);
      this.sprites.push(sp);
      this.group.add(sp);
    }
  }

  update(time: number) {
    this.sprites.forEach((s, i) => s.scale.setScalar(this.size * (1 + 0.07 * Math.sin(time * 7.3 + i * 2.1) + 0.04 * Math.sin(time * 13.1 + i))));
  }

  dispose() {
    this.material.dispose();
  }
}
