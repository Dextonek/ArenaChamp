import * as THREE from 'three';
import { clamp, lerp } from '../core';
import type { Layers } from '../piece';
import { creature, drawCreature, loadCreature, type Creature } from '../stage3d';
import type { EyeLook } from './eye';

/**
 * Scarlet Sheath's eye as a real 3D model (blender/creatures/eye.py): a dragon's face round one eye, a brow and rings of
 * scales, two lids that close about the eye's centre, and the eyeball, painted here: a burning iris of radial fibres, a
 * slit pupil that opens into a round one, and a spinning hole of light inside it (the 2D eye's `dilate` and `vortex`).
 * Posed from the same `EyeLook` the drawn eye takes, so the piece's timing is unchanged.
 */

export const EYE_URL = '/models/showpiece/eye.glb';

let painted: WeakSet<Creature> = new WeakSet();
const uniforms = {
  uDilate: { value: 0 },
  uVortex: { value: 0 },
  uTime: { value: 0 },
  uLook: { value: new THREE.Vector2() },
  uGlowOnly: { value: 0 },
};

const VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vN;
  void main() {
    vPos = position;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const FRAG = /* glsl */ `
  uniform float uDilate, uVortex, uTime, uGlowOnly;
  uniform vec2 uLook;
  varying vec3 vPos;
  varying vec3 vN;
  #include <common>
  float hash(float x) { return fract(sin(x * 91.7) * 4375.5453); }
  void main() {
    vec3 p = normalize(vPos);
    // Where it looks: the eye turned a little left or right, up or down.
    float cy = cos(uLook.x), sy = sin(uLook.x), cx = cos(uLook.y), sx = sin(uLook.y);
    p = vec3(cy * p.x - sy * p.z, p.y, sy * p.x + cy * p.z);
    p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);
    vec2 s = p.xy / (1.0 + p.z);
    float r = length(s), th = atan(s.y, s.x);
    const float IR = 0.5;
    float k = r / IR;
    // The iris: hot in the middle, red to its edge, light and dark fibres out from the pupil.
    vec3 iris = mix(vec3(1.0, 0.6, 0.28), vec3(0.9, 0.26, 0.07), smoothstep(0.0, 0.45, k));
    iris = mix(iris, vec3(0.55, 0.07, 0.02), smoothstep(0.5, 0.97, k));
    float f1 = hash(floor(th * 40.0)), f2 = hash(floor(th * 63.0) + 7.0);
    iris += smoothstep(0.55, 1.0, f1) * smoothstep(0.12, 0.55, k) * (1.0 - smoothstep(0.85, 1.0, k)) * vec3(0.5, 0.32, 0.15);
    iris *= 1.0 - 0.45 * smoothstep(0.7, 1.0, f2) * smoothstep(0.2, 0.7, k);
    float limbus = smoothstep(IR * 0.86, IR * 0.99, r);
    vec3 col = mix(iris, vec3(0.1, 0.01, 0.01), limbus);
    vec3 sclera = vec3(0.26, 0.05, 0.03) * (1.0 - 0.4 * smoothstep(0.6, 1.4, r));
    col = mix(col, sclera, smoothstep(IR, IR * 1.05, r));
    float inIris = (1.0 - limbus) * (1.0 - smoothstep(IR, IR * 1.05, r));
    // The pupil: a tilted slit that rounds out as it opens.
    float a = 0.32;
    vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * s;
    float pw = mix(0.035, 0.27, uDilate), ph = mix(0.36, 0.27, uDilate);
    float pd = length(q / vec2(pw, ph));
    float pupil = 1.0 - smoothstep(0.93, 1.0, pd);
    col = mix(col, vec3(0.012, 0.0, 0.0), pupil);
    vec3 emi = iris * 0.4 * inIris * (1.0 - pupil);
    // The hole: a ring of light at the pupil's edge, and blades of light spiralling in.
    if (uVortex > 0.0) {
      float ring = exp(-pow((pd - 1.0) / 0.06, 2.0));
      float rr = pd, a2 = atan(q.y, q.x);
      float blades = smoothstep(0.55, 0.95, sin(a2 * 7.0 + log(max(rr, 0.02)) * 5.0 + uTime * 5.5)) * smoothstep(0.08, 0.35, rr) * pupil;
      float specks = step(0.985, hash(floor(a2 * 30.0 + uTime * 3.0) + floor(rr * 20.0 - uTime * 6.0) * 13.0)) * pupil;
      vec3 v = vec3(1.0, 0.86, 0.66) * ring * 1.6 + vec3(1.0, 0.78, 0.55) * blades * 0.9 + vec3(1.0, 0.5, 0.2) * specks;
      emi += v * uVortex;
      col += v * uVortex;
    }
    // Light: a soft key, and the wet highlight.
    vec3 n = normalize(vN);
    float dif = 0.4 + 0.6 * max(dot(n, normalize(vec3(0.4, 0.6, 0.7))), 0.0);
    float spec = pow(max(dot(reflect(-normalize(vec3(-0.5, 0.55, 0.65)), n), vec3(0.0, 0.0, 1.0)), 0.0), 80.0);
    vec3 lit = col * dif * 0.7 + emi + spec * vec3(1.0) * (1.0 - uVortex * 0.6);
    gl_FragColor = vec4(uGlowOnly > 0.5 ? emi * 0.8 : lit, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** Loads the eye and paints its eyeball (once). */
export async function loadEye() {
  const c = await loadCreature(EYE_URL);
  paint(c);
  return c;
}

function paint(c: Creature) {
  if (painted.has(c)) return;
  painted.add(c);
  for (const m of c.meshes) {
    if (m.name !== 'Eyeball') continue;
    m.mesh.material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
    m.mesh.userData.glowMaterial = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uGlowOnly: { value: 1 } }, vertexShader: VERT, fragmentShader: FRAG, toneMapped: false,
    });
  }
}

/** How far each lid turns to close the eye (radians about the eye's horizontal axis). */
const SHUT_UPPER = 0.95;
const SHUT_LOWER = -0.42;
/** And how far each is drawn back, under the face, when the eye is open (the face's own socket is the opening then). */
const OPEN_UPPER = -0.55;
const OPEN_LOWER = 0.5;

/**
 * Draws the eye where the drawn eye would be: centred at (e.x, e.y) in picture units, turned by e.angle, e.scale its
 * size, with its lids, pupil and hole from `e`. Call it inside the rift's clip.
 */
export function eye3d(L: Layers, e: EyeLook) {
  const c = creature(EYE_URL);
  if (!c || e.alpha <= 0) return;
  paint(c);
  const open = clamp(e.open);
  for (const m of c.meshes) {
    if (m.name === 'LidUpper') m.mesh.rotation.x = lerp(SHUT_UPPER, OPEN_UPPER, open);
    if (m.name === 'LidLower') m.mesh.rotation.x = lerp(SHUT_LOWER, OPEN_LOWER, open);
  }
  uniforms.uDilate.value = clamp(e.dilate);
  uniforms.uVortex.value = clamp(e.vortex);
  uniforms.uTime.value = e.t;
  uniforms.uLook.value.set(e.look * 0.35, -0.05);
  // About 270 picture units for the eyeball's radius at scale 1 (the drawn iris was 160 across its radius), a 20° lens.
  const D = 540 / (270 * e.scale * Math.tan((10 * Math.PI) / 180));
  drawCreature(L, c, {
    eye: [0, 0.1, D],
    at: [0, 0.1, 0],
    fov: 20,
    roll: -e.angle,
    rim: 0xff7a3a,
    key: 0xffd6b0,
    glow: 1,
    alpha: e.alpha,
    shift: [e.x - 960, e.y - 540],
  });
}
