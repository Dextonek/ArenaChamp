import * as THREE from 'three';
import { RING } from '../arenas/common';
import { softDotTexture } from '../effects/common';
import type { Obstacle } from '../obstacles';

/**
 * First-pass looks of the boss's moves, all drawn in code. Mid-value colours, as with the arena events: a screen-long
 * near-white glow would bloom the whole frame. `renderOrder` 2 and up: over the zones.
 */

const stoneGeo = new THREE.CylinderGeometry(1, 1.25, 1, 9).translate(0, 0.5, 0);
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6e665a, roughness: 0.92, flatShading: true });

/** A stone drum that falls out of the sky onto (x, z) and lands at `at`, sinks away after. */
export class FallingStone {
  readonly mesh = new THREE.Mesh(stoneGeo, stoneMat);
  private fall = 0.4;
  /** `stays`: seconds it stands on the floor before it sinks. */
  constructor(private x: number, private z: number, radius: number, private at: number, private stays = 0) {
    this.mesh.scale.set(radius * 0.55, radius * 1.3, radius * 0.55);
    this.mesh.position.set(x, 30, z);
    this.mesh.rotation.y = (x * 7 + z * 3) % 6.28;
    this.mesh.visible = false;
    this.mesh.castShadow = true;
  }

  update(t: number) {
    const k = (t - (this.at - this.fall)) / this.fall;
    this.mesh.visible = k >= 0;
    if (k < 0) return;
    const after = t - this.at;
    this.mesh.position.set(this.x, after < 0 ? 16 * (1 - k * k) : -Math.max(0, after - this.stays) * 2.2, this.z);
  }
}

const pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0);
const pillarVertex = /* glsl */ `
  varying float vY;
  void main() {
    vY = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const pillarFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vY;
  void main() {
    gl_FragColor = vec4(uColor * pow(1.0 - vY, 1.6) * uOpacity, 1.0);
  }
`;

/** A rising wall of light round a gold zone, so "stand here" differs from "leave" by shape as well as by colour. */
export class LightPillar {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  constructor(x: number, z: number, radius: number, height: number, color: THREE.ColorRepresentation) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: pillarVertex, fragmentShader: pillarFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    });
    this.mesh = new THREE.Mesh(pillarGeo, this.mat);
    this.mesh.position.set(x, 0.04, z);
    this.mesh.scale.set(radius, height, radius);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
  }

  set opacity(v: number) {
    this.mat.uniforms.uOpacity.value = v;
    this.mesh.visible = v > 0.001;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mat.dispose();
  }
}

/** A gold arc on the floor that closes as a hero holds a spot. */
export class HoldRing {
  readonly mesh: THREE.Mesh;
  private count: number;
  constructor(x: number, z: number, radius: number, color: THREE.ColorRepresentation) {
    const geo = new THREE.RingGeometry(radius - 0.22, radius, 64, 1);
    this.count = geo.index?.count ?? 0;
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(x, 0.07, z);
    this.mesh.renderOrder = 3;
  }

  /** `held`: how much of the ring is closed, 0..1. */
  set(held: number) {
    this.mesh.geometry.setDrawRange(0, Math.floor(this.count * Math.min(1, held) / 6) * 6);
    this.mesh.visible = held > 0.001;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

const digitTextures = new Map<string, THREE.CanvasTexture>();
function digitTexture(text: string) {
  let tex = digitTextures.get(text);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.font = '800 96px ui-serif, Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 12;
  g.strokeStyle = '#1a0f06';
  g.strokeText(text, 64, 70);
  g.fillStyle = '#ffe0a0';
  g.fillText(text, 64, 70);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  digitTextures.set(text, tex);
  return tex;
}

/** A number floating over a wedge, facing the camera on both sides of the ring. */
export class NumberMark {
  readonly sprite: THREE.Sprite;
  constructor(text: string, x: number, z: number) {
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: digitTexture(text), transparent: true, depthWrite: false, depthTest: false }));
    this.sprite.position.set(x, 0.9, z);
    this.sprite.scale.setScalar(2);
    this.sprite.renderOrder = 4;
  }

  dispose() {
    this.sprite.removeFromParent();
    this.sprite.material.dispose();
  }
}

/** A growing sun over the boss's head. */
export class SunOrb {
  readonly sprite: THREE.Sprite;
  constructor(x: number, y: number, z: number) {
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: 0xffb860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.sprite.position.set(x, y, z);
    this.sprite.renderOrder = 3;
  }

  set(scale: number, opacity: number) {
    this.sprite.scale.setScalar(scale);
    this.sprite.material.opacity = opacity;
    this.sprite.visible = opacity > 0.001;
  }

  dispose() {
    this.sprite.removeFromParent();
    this.sprite.material.dispose();
  }
}

const poolGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
const poolVertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const poolFragment = /* glsl */ `
  uniform float uTime, uOpacity;
  varying vec2 vP;
  void main() {
    float d = length(vP);
    float n = 0.5 + 0.5 * sin(vP.x * 9.0 + uTime * 1.4) * sin(vP.y * 8.0 - uTime * 1.1);
    float edge = smoothstep(1.0, 0.82, d);
    vec3 col = mix(vec3(0.45, 0.08, 0.02), vec3(1.0, 0.42, 0.08), n * smoothstep(1.0, 0.3, d));
    gl_FragColor = vec4(col, edge * uOpacity);
  }
`;

/** Lava on the floor where something burned: it comes up, stays, and crusts over. */
export class LavaPool {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  constructor(x: number, z: number, private radius: number) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: poolVertex, fragmentShader: poolFragment, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    });
    this.mesh = new THREE.Mesh(poolGeo, this.mat);
    this.mesh.position.set(x, 0.05, z);
    this.mesh.scale.setScalar(0.01);
    this.mesh.renderOrder = 1;
  }

  /** `t`: seconds since it began; it is gone at `life`. */
  update(t: number, life: number) {
    const grow = THREE.MathUtils.clamp(t / 0.5, 0, 1), fade = THREE.MathUtils.clamp((life - t) / 0.8, 0, 1);
    this.mesh.visible = t > 0 && t < life;
    this.mesh.scale.setScalar(Math.max(0.01, this.radius * grow));
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uOpacity.value = 0.9 * fade;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mat.dispose();
  }
}

/** A circle lying on the floor that follows someone: only a look (Marked). */
export class FollowMark {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  constructor(radius: number, color: THREE.ColorRepresentation) {
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.RingGeometry(radius - 0.14, radius, 48).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  place(x: number, z: number, opacity: number) {
    this.mesh.visible = true;
    this.mesh.position.set(x, 0.06, z);
    this.mat.opacity = opacity;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

const waveVertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const waveFragment = /* glsl */ `
  uniform float uRadius, uHalf, uGap, uGapHalf, uOpacity;
  varying vec2 vP;
  void main() {
    float d = length(vP);
    float band = 1.0 - smoothstep(uHalf * 0.6, uHalf, abs(d - uRadius));
    if (band <= 0.0) discard;
    float a = atan(vP.x, vP.y) - uGap;
    a = atan(sin(a), cos(a));
    // In the gap the ring is gold: where to walk through. The rest is lava.
    float open = 1.0 - smoothstep(uGapHalf - 0.03, uGapHalf + 0.03, abs(a));
    vec3 lava = mix(vec3(0.62, 0.12, 0.02), vec3(0.82, 0.3, 0.05), band);
    vec3 col = mix(lava, vec3(1.0, 0.86, 0.45), open);
    gl_FragColor = vec4(col, band * uOpacity * mix(1.0, 0.45, open));
  }
`;

/** The Lava Wave: a ring growing from the vent, with one gap, which turns. */
export class WaveRing {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  constructor(x: number, z: number, reach: number, gapHalf: number) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: waveVertex, fragmentShader: waveFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uRadius: { value: 0 }, uHalf: { value: 0.6 }, uGap: { value: 0 }, uGapHalf: { value: gapHalf }, uOpacity: { value: 0 } },
    });
    // The shader reads the mesh's own position, so the ring's middle is its origin.
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(reach, 96).rotateX(-Math.PI / 2), this.mat);
    this.mesh.position.set(x, 0.07, z);
    this.mesh.renderOrder = 2;
  }

  set(radius: number, gap: number, half: number, opacity: number) {
    const u = this.mat.uniforms;
    u.uRadius.value = radius;
    u.uGap.value = gap;
    u.uHalf.value = half;
    u.uOpacity.value = opacity;
    this.mesh.visible = opacity > 0.001;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

const shadowVertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const shadowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity, uTime;
  uniform vec2 uCenter;
  uniform float uRadius;
  varying vec2 vP;
  void main() {
    if (distance(vP, uCenter) > uRadius) discard;
    float stripes = 0.75 + 0.25 * sin((vP.x + vP.y) * 4.0 + uTime * 3.0);
    gl_FragColor = vec4(uColor, uOpacity * stripes);
  }
`;

/**
 * The floor no light from `source` reaches: behind each piece of cover, cut off at the ring. It is drawn in gold because
 * it is where to stand, and rebuilt when the cover changes.
 */
export class ShadowFloor {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private geo = new THREE.BufferGeometry();
  private built = -1;
  constructor(private source: { x: number; z: number }, private cover: () => readonly Obstacle[], color: THREE.ColorRepresentation, radius: number) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: shadowVertex, fragmentShader: shadowFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uTime: { value: 0 },
        uCenter: { value: new THREE.Vector2(RING.x, RING.z) }, uRadius: { value: radius },
      },
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
  }

  private rebuild(list: readonly Obstacle[]) {
    this.built = list.length;
    const pos: number[] = [];
    const { x: sx, z: sz } = this.source;
    for (const o of list) {
      const mx = (o.ax + o.bx) / 2, mz = (o.az + o.bz) / 2;
      const base = Math.atan2(mx - sx, mz - sz);
      // The outline's two extreme points as seen from the source.
      let lo = Infinity, hi = -Infinity, pl = { x: 0, z: 0 }, ph = { x: 0, z: 0 };
      for (const [cx, cz] of [[o.ax, o.az], [o.bx, o.bz]]) {
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2, x = cx + Math.sin(a) * o.r, z = cz + Math.cos(a) * o.r;
          const off = Math.atan2(Math.sin(Math.atan2(x - sx, z - sz) - base), Math.cos(Math.atan2(x - sx, z - sz) - base));
          if (off < lo) { lo = off; pl = { x, z }; }
          if (off > hi) { hi = off; ph = { x, z }; }
        }
      }
      const out = (p: { x: number; z: number }) => {
        const d = Math.hypot(p.x - sx, p.z - sz) || 1;
        return { x: p.x + ((p.x - sx) / d) * 40, z: p.z + ((p.z - sz) / d) * 40 };
      };
      const el = out(pl), eh = out(ph), y = 0.06;
      pos.push(pl.x, y, pl.z, ph.x, y, ph.z, eh.x, y, eh.z, pl.x, y, pl.z, eh.x, y, eh.z, el.x, y, el.z);
    }
    this.geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  }

  update(t: number, opacity: number) {
    const list = this.cover();
    if (list.length !== this.built) this.rebuild(list);
    this.mat.uniforms.uOpacity.value = opacity;
    this.mat.uniforms.uTime.value = t;
    this.mesh.visible = opacity > 0.001;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geo.dispose();
    this.mat.dispose();
  }
}
