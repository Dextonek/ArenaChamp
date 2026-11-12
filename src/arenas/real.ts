import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Obstacle } from '../obstacles';
import { RING } from './common';

/**
 * Arenas in the heroes' style (2026-11-11): props built in Blender the way the heroes' weapons and crowns are (clean
 * forms, a few plain materials, gold edges, one glow; blender/arenas/real/kit.py, one script per arena) and written as
 * one file,
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
  /** The file's other objects that were asked for by name (a room that changes: the pieces that fall), null where the file has none. */
  named: Record<string, THREE.Object3D | null>;
}

/** How a file's materials are fitted to the arena's light (the scans are photographed in daylight). */
export interface RealTune {
  /** Albedo times this (dusk and night arenas want less than 1). */
  dim?: number;
  /** How much of the sky's reflection the props take. */
  env?: number;
  /** Per material (a part of its name): its own `dim`, a `tint` multiplied in, an emissive colour and strength. */
  parts?: Record<string, { dim?: number; tint?: number; emissive?: number; strength?: number; rough?: number; metal?: number }>;
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
          if (part?.metal !== undefined) mat.metalness = part.metal;
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
export function realProps(id: string, covers: number, tune: RealTune = {}, names: readonly string[] = []): Promise<RealProps> {
  return loadFile(id, tune).then((scene) => {
    const copy = (name: string) => scene.getObjectByName(name)?.clone(true) ?? null;
    return { cover: Array.from({ length: covers }, (_, i) => copy(`cover${i}`)), back: copy('back'), named: Object.fromEntries(names.map((n) => [n, copy(n)])) };
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
 * The sea round an arena: a wide disc at height `y` with a hole of radius `inner` where the arena stands. Drawn, not
 * photographed (the user found the first, rippled sea too realistic beside the heroes): three broad swells and nothing
 * finer, its deep colour looking down and the sky's at a glancing angle, the crests as lighter `band`s with a clean
 * edge, the low sun's glint as shapes, and a clean ring of foam breathing at the arena's foot.
 */
export class Sea {
  readonly mesh: THREE.Mesh;
  private uniforms: Record<string, THREE.IUniform>;

  constructor(o: { y: number; inner: number; deep: number; sky: number; band: number; glint: number; sun: THREE.Vector3; foam?: number }) {
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 }, uDeep: { value: new THREE.Color(o.deep) }, uSky: { value: new THREE.Color(o.sky) }, uBand: { value: new THREE.Color(o.band) }, uGlint: { value: new THREE.Color(o.glint) },
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
        uniform vec3 uDeep, uSky, uBand, uGlint, uFoam, uSun;
        uniform vec2 uCentre;
        varying vec3 vWorld;
        #include <fog_pars_fragment>
        // one swell: direction d, wavelength l, speed s. x: its height (-1..1), yz: its slope
        vec3 swell(vec2 p, vec2 d, float l, float s) {
          float k = 6.2832 / l, ph = dot(p, d) * k + uTime * s;
          return vec3(sin(ph), d * cos(ph));
        }
        void main() {
          vec2 p = vWorld.xz;
          // three broad swells and nothing finer: drawn water, not photographed
          vec3 w = 0.5 * swell(p, normalize(vec2(1.0, 0.35)), 15.0, 0.55) + 0.3 * swell(p, normalize(vec2(-0.4, 1.0)), 9.5, 0.8)
            + 0.2 * swell(p, normalize(vec2(0.7, -0.7)), 6.0, 1.1);
          vec3 n = normalize(vec3(-w.y * 0.22, 1.0, -w.z * 0.22));
          vec3 v = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          vec3 col = mix(uDeep, uSky, 0.1 + 0.6 * fres);
          // the crests: long lighter bands with a clean edge (the first swell's own crests, a little bent by the second:
          // all three thresholded together made round blobs)
          float crest = swell(p, normalize(vec2(1.0, 0.35)), 15.0, 0.55).x + 0.3 * swell(p, normalize(vec2(-0.4, 1.0)), 23.0, 0.3).x;
          col = mix(col, uBand, 0.3 * smoothstep(0.86, 0.93, crest));
          // the low sun's glint: shapes with an edge, not a sparkle
          vec3 h = normalize(v + uSun);
          col += uGlint * 0.45 * smoothstep(0.5, 0.57, pow(max(dot(n, h), 0.0), 90.0));
          // foam at the arena's foot: a clean ring that breathes in lobes, and a thin second line further out
          vec2 q = p - uCentre;
          float r = length(q) - uInner, ang = atan(q.y, q.x);
          float reach = 0.22 + 0.1 * sin(ang * 7.0 + uTime * 0.7) + 0.07 * sin(ang * 13.0 - uTime * 0.5);
          float foam = 1.0 - smoothstep(reach, reach + 0.05, r);
          float line = smoothstep(0.0, 0.04, r - reach - 0.45) * (1.0 - smoothstep(0.1, 0.14, r - reach - 0.45));
          col = mix(col, uFoam, max(0.85 * foam, 0.4 * line));
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

  /** `size` of one glow in metres; a spot's own `size` multiplies it. */
  constructor(spots: { x: number; y: number; z: number; size?: number }[], color: number, private size: number) {
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
      sp.scale.setScalar(size * (s.size ?? 1));
      sp.userData.size = s.size ?? 1;
      this.sprites.push(sp);
      this.group.add(sp);
    }
  }

  update(time: number) {
    this.sprites.forEach((s, i) => s.scale.setScalar(this.size * s.userData.size * (1 + 0.07 * Math.sin(time * 7.3 + i * 2.1) + 0.04 * Math.sin(time * 13.1 + i))));
  }

  dispose() {
    this.material.dispose();
  }
}
