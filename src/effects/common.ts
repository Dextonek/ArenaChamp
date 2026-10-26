import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared building blocks for set-piece effects: weapon meshes, the enemy dummy and the ground. */

export const smoothstep = (x: number) => {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Merges parts into one geometry (mergeGeometries needs matching attributes and indexing). */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared = parts.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.clearGroups();
    return ng;
  });
  const merged = mergeGeometries(prepared, false)!;
  merged.computeVertexNormals();
  return merged;
}

/** A unit sword (about 1 long) with its tip at the origin, pointing down -Y. */
export function createSwordGeometry(): THREE.BufferGeometry {
  const bladeLen = 0.72, tipLen = 0.14, w = 0.09;
  const profile = new THREE.Shape();
  profile.moveTo(0, 0);
  profile.lineTo(w / 2, tipLen);
  profile.lineTo(w / 2, bladeLen);
  profile.lineTo(-w / 2, bladeLen);
  profile.lineTo(-w / 2, tipLen);
  profile.closePath();
  const blade = new THREE.ExtrudeGeometry(profile, {
    depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 1,
  });
  blade.translate(0, 0, -0.006);

  const guard = new THREE.BoxGeometry(0.3, 0.035, 0.05).translate(0, bladeLen + 0.02, 0);
  const grip = new THREE.CylinderGeometry(0.018, 0.022, 0.2, 8).translate(0, bladeLen + 0.14, 0);
  const pommel = new THREE.SphereGeometry(0.035, 10, 8).translate(0, bladeLen + 0.26, 0);
  return mergeParts([blade, guard, grip, pommel]);
}

/** A unit spear (about 1.3 long) with its tip at the origin, pointing down -Y. */
export function createSpearGeometry(): THREE.BufferGeometry {
  const head = new THREE.ConeGeometry(0.05, 0.2, 4).rotateX(Math.PI).translate(0, 0.1, 0);
  const collar = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8).translate(0, 0.22, 0);
  const shaft = new THREE.CylinderGeometry(0.015, 0.015, 1.05, 6).translate(0, 0.765, 0);
  const butt = new THREE.SphereGeometry(0.025, 8, 6).translate(0, 1.3, 0);
  return mergeParts([head, collar, shaft, butt]);
}

/** A large dark ground disc. */
export function createGround(radius = 60): THREE.Mesh {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.name = 'ground'; // play mode hides an effect's own ground and uses the arena's
  return ground;
}

/** Where spells put the target and the caster. The caster stands on +Z and faces the enemy (-Z). */
export const ENEMY_POS = new THREE.Vector3(0, 0, 0);
export const CASTER_POS = new THREE.Vector3(0, 0, 14);

export interface FigureOptions {
  color?: THREE.ColorRepresentation;
  eyeColor?: THREE.Color;
  horns?: boolean;
  /** Y rotation applied on reset (the caster uses Math.PI to face -Z). */
  facing?: number;
}

/**
 * A simple capsule figure standing at its group's origin (about 2.3 tall), eyes toward +Z by default.
 * `new Enemy()` is the horned red target; `createCaster()` gives the golden caster.
 */
export class Enemy {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshStandardMaterial;
  private facing: number;
  private home = new THREE.Vector3();

  constructor(opts: FigureOptions = {}) {
    this.material = new THREE.MeshStandardMaterial({ color: opts.color ?? 0x5a1820, roughness: 0.6, emissive: 0x000000 });
    this.facing = opts.facing ?? 0;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.1, 6, 16), this.material);
    body.position.y = 1.1;
    this.group.add(body);
    if (opts.horns ?? true) {
      const hornGeo = new THREE.ConeGeometry(0.12, 0.5, 8);
      const hornL = new THREE.Mesh(hornGeo, this.material);
      hornL.position.set(-0.3, 2.05, 0); hornL.rotation.z = 0.4;
      const hornR = new THREE.Mesh(hornGeo, this.material);
      hornR.position.set(0.3, 2.05, 0); hornR.rotation.z = -0.4;
      this.group.add(hornL, hornR);
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: opts.eyeColor ?? new THREE.Color(2, 0.2, 0.15) });
    const eyeGeo = new THREE.SphereGeometry(0.07, 8, 6);
    for (const x of [-0.18, 0.18]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, 1.55, 0.5);
      this.group.add(eye);
    }
    this.group.rotation.y = this.facing;
  }

  /** Sets where reset() puts the figure back to. */
  setHome(p: THREE.Vector3) {
    this.home.copy(p);
    this.group.position.copy(p);
    return this;
  }

  /** Back to a whole, unlit figure at its home position. */
  reset() {
    this.group.visible = true;
    this.group.position.copy(this.home);
    this.group.scale.setScalar(1);
    this.group.rotation.set(0, this.facing, 0);
    this.material.emissive.setRGB(0, 0, 0);
  }

  /** White-hot hit flash, 0 = none, 1 = full. Callers often pass > 1, so the peak is capped. */
  setFlash(v: number) {
    // Kept modest: at 6x the figure became a bloom-blown white blob that hid the hit effect itself.
    const f = Math.min(Math.max(0, v), 1.2);
    this.material.emissive.setRGB(2.4 * f, 2 * f, 1.6 * f);
  }

  /** 0 = standing, 1 = flattened and hidden. */
  setCrush(v: number) {
    const squash = 1 - THREE.MathUtils.clamp(v, 0, 1);
    this.group.scale.set(1 + (1 - squash) * 0.6, Math.max(squash, 0.001), 1 + (1 - squash) * 0.6);
    this.group.visible = squash > 0.01;
  }
}

/** The golden caster at CASTER_POS, facing the enemy. Call reset() in play(). */
export function createCaster(color: THREE.ColorRepresentation = 0xb8963e): Enemy {
  return new Enemy({ color, horns: false, eyeColor: new THREE.Color(1.6, 1.4, 0.8), facing: Math.PI }).setHome(CASTER_POS);
}

/** A unit war hammer: handle along +Y from 0 to 1, head centred at y = 1 (head spans x ±0.22). */
export function createHammerGeometry(): THREE.BufferGeometry {
  const handle = new THREE.CylinderGeometry(0.028, 0.032, 1, 8).translate(0, 0.5, 0);
  const head = new THREE.BoxGeometry(0.44, 0.2, 0.2).translate(0, 1, 0);
  const capL = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12).rotateZ(Math.PI / 2).translate(-0.24, 1, 0);
  const capR = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12).rotateZ(Math.PI / 2).translate(0.24, 1, 0);
  const pommel = new THREE.SphereGeometry(0.05, 8, 6);
  return mergeParts([handle, head, capL, capR, pommel]);
}

/** A unit round shield (radius 0.5) facing +Z, with a raised boss and a cross. */
export function createShieldGeometry(): THREE.BufferGeometry {
  const disc = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32).rotateX(Math.PI / 2);
  const rim = new THREE.TorusGeometry(0.5, 0.03, 6, 32);
  const boss = new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0, 0.025);
  const barV = new THREE.BoxGeometry(0.08, 0.8, 0.03).translate(0, 0, 0.035);
  const barH = new THREE.BoxGeometry(0.8, 0.08, 0.03).translate(0, 0, 0.035);
  return mergeParts([disc, rim, boss, barV, barH]);
}

/**
 * A soft glowing sphere: bright where it faces the camera edge-on (fresnel rim) and fading toward the centre,
 * so a big one reads as an energy shell instead of a flat solid disc. Additive; set `opacity` and `color`.
 */
export class GlowSphere {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(color: THREE.ColorRepresentation = 0xffd27a, opts: { rim?: boolean } = {}) {
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 0 },
        uRim: { value: opts.rim === false ? 0 : 1 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity; uniform float uRim;
        varying vec3 vN; varying vec3 vView;
        void main() {
          float facing = abs(dot(vN, vView));
          // rim = 1: bright shell edge; rim = 0: soft core that fades to the edge.
          float a = mix(pow(facing, 1.5), pow(1.0 - facing, 2.0) + 0.15 * facing, uRim);
          gl_FragColor = vec4(uColor, a * uOpacity);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), this.material);
    this.mesh.visible = false;
  }

  set opacity(v: number) {
    this.material.uniforms.uOpacity.value = v;
    this.mesh.visible = v > 0.002;
  }

  get color(): THREE.Color {
    return this.material.uniforms.uColor.value as THREE.Color;
  }
}

/** A vertical beam of light (open cylinder, soft edges) from `bottom` to `top` height at an x/z position. */
export class LightPillar {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(color: THREE.ColorRepresentation = 0xffd36b, radius = 0.9) {
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity;
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main() {
          float facing = abs(dot(vN, vView));          // bright core, soft edges
          float ends = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
          gl_FragColor = vec4(uColor * 1.5, pow(facing, 2.5) * ends * uOpacity);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 32, 1, true), this.material);
    this.mesh.visible = false;
  }

  /** Places the beam between two heights; opacity 0 hides it. */
  set(x: number, z: number, bottom: number, top: number, opacity: number) {
    this.mesh.scale.set(1, Math.max(0.001, top - bottom), 1);
    this.mesh.position.set(x, (top + bottom) / 2, z);
    this.material.uniforms.uOpacity.value = opacity;
    this.mesh.visible = opacity > 0.002;
  }

  get color(): THREE.Color {
    return this.material.uniforms.uColor.value as THREE.Color;
  }
}

let softDot: THREE.Texture | undefined;
/**
 * A shared soft round sprite for `THREE.PointsMaterial` (`map: softDotTexture()`). Without a map, points render
 * as hard squares — which shows badly when one ends up near the camera.
 */
export function softDotTexture(): THREE.Texture {
  if (softDot) return softDot;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  softDot = new THREE.CanvasTexture(canvas);
  softDot.colorSpace = THREE.SRGBColorSpace;
  return softDot;
}

/** A flat additive ring on the ground (or anywhere) for shockwaves, rune circles and auras. */
export function createRing(color: THREE.ColorRepresentation, inner = 0.85, outer = 1, segments = 96) {
  const material = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, segments), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.04;
  return { mesh, material };
}

/**
 * Standard camera for a spell: side view from +X so the caster (+Z) is on screen-left and the enemy (-Z side)
 * on screen-right, with the content nudged left because the control panel covers the right third.
 * `center` is the middle of the action, `radius` how much has to fit around it.
 */
export function frameArena(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3 },
  center: THREE.Vector3,
  radius: number,
  heightBias = 0.35,
) {
  const dist = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 1.05;
  const target = new THREE.Vector3(center.x, center.y, center.z - radius * 0.45);
  controls.target.copy(target);
  camera.position.set(target.x + dist, target.y + dist * heightBias, target.z + dist * 0.18);
}
