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

let slabTexture: THREE.CanvasTexture | null = null;

/**
 * Stylised stone-slab floor (drawn once, shared): mid-dark slate slabs of varied value with dark grout, worn edges
 * and a few cracks. Kept dark enough that additive layers still pop and black smoke still reads.
 */
function groundSlabTexture(): THREE.CanvasTexture {
  if (slabTexture) return slabTexture;
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d')!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#0b0c0f';
  g.fillRect(0, 0, S, S);
  // Running-bond rows of slabs; the pattern tiles because rows and columns wrap at S.
  const rows = 4;
  const rowH = S / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 3 + (r % 2);
    const colW = S / cols;
    const shift = (r % 2) * colW * 0.5;
    for (let c = -1; c < cols; c++) {
      const x0 = c * colW + shift + 5, y0 = r * rowH + 5, w = colW - 10, h = rowH - 10;
      const v = 0.82 + rnd() * 0.3;
      const base = [27 * v, 28 * v, 34 * v].map(Math.round);
      const grad = g.createLinearGradient(x0, y0, x0 + w, y0 + h);
      grad.addColorStop(0, `rgb(${base[0] + 5},${base[1] + 5},${base[2] + 6})`);
      grad.addColorStop(1, `rgb(${base[0] - 5},${base[1] - 5},${base[2] - 4})`);
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(x0, y0, w, h, 10);
      g.fill();
      // Worn lighter top edge and a darker bottom edge give the slabs a little bevel.
      g.strokeStyle = 'rgba(110,114,130,0.12)';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(x0 + 10, y0 + 2); g.lineTo(x0 + w - 10, y0 + 2); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.moveTo(x0 + 10, y0 + h - 2); g.lineTo(x0 + w - 10, y0 + h - 2); g.stroke();
    }
  }
  // Speckle and stains.
  for (let i = 0; i < 9000; i++) {
    const a = rnd() * 0.05;
    g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.6})`;
    g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  for (let i = 0; i < 18; i++) {
    const x = rnd() * S, y = rnd() * S, r = 30 + rnd() * 90;
    const st = g.createRadialGradient(x, y, 0, x, y, r);
    st.addColorStop(0, 'rgba(0,0,0,0.16)');
    st.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = st;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Hairline cracks.
  g.strokeStyle = 'rgba(8,8,10,0.55)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    let x = rnd() * S, y = rnd() * S;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; g.lineTo(x, y); }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  slabTexture = tex;
  return tex;
}

/** A large ground disc: stone slabs that darken toward the rim (the scene fog takes over beyond it). */
export function createGround(radius = 60): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 96);
  // Radial darkening as vertex colours: centre 1, rim 0.35 (CircleGeometry interpolates centre → rim linearly).
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const d = Math.hypot(pos.getX(i), pos.getY(i)) / radius;
    const k = 1 - 0.65 * d;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const map = groundSlabTexture().clone();
  map.needsUpdate = true;
  map.repeat.set(radius / 4, radius / 4); // ~8 m texture tile → slabs of ~2-2.7 m
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.92, metalness: 0 }),
  );
  ground.receiveShadow = true;
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
  /** Only the materials and the flash/reset API, no robe: a subclass builds its own meshes (`parts/minion.ts`). */
  bare?: boolean;
}

/**
 * A hooded figure standing at its group's origin (robe ~1.75, head top ~2.25, horns to ~2.6), eyes toward +Z by
 * default, with the old capsule's footprint (hem radius 0.6). `material` is the robe/body (the hit flash and older
 * spells drive it), `trim` the horns, mask, belt and cuffs.
 * `new Enemy()` is the horned red target; `createCaster()` gives the golden caster.
 */
export class Enemy {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshStandardMaterial;
  private facing: number;
  private home = new THREE.Vector3();

  /** Secondary material (horns, mask, belt, cuffs); `setFlash` drives it together with `material`. */
  readonly trim: THREE.MeshStandardMaterial;

  constructor(opts: FigureOptions = {}) {
    const horned = opts.horns ?? true;
    this.material = new THREE.MeshStandardMaterial({ color: opts.color ?? 0x5a1820, roughness: 0.62, emissive: 0x000000, flatShading: false });
    this.trim = new THREE.MeshStandardMaterial({
      // Bone / pale gold kept mid-tone: lit near-white trim bloomed into glowing horns under low bloom thresholds.
      color: horned ? 0x6f6656 : 0x9c8a5e, roughness: horned ? 0.85 : 0.45, metalness: horned ? 0 : 0.4, emissive: 0x000000,
    });
    this.facing = opts.facing ?? 0;
    if (opts.bare) {
      this.group.rotation.y = this.facing;
      return;
    }
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.group.add(m);
      return m;
    };

    // Robe + torso as one lathe: wide hem (r 0.6) at the ground, waist, broad shoulders, neck. Same footprint and
    // ~2.3 m height as the old capsule, so spells sized around the figure still fit.
    const robe = new THREE.LatheGeometry([
      new THREE.Vector2(0.001, 0), new THREE.Vector2(0.6, 0), new THREE.Vector2(0.58, 0.08), new THREE.Vector2(0.48, 0.55),
      new THREE.Vector2(0.38, 0.95), new THREE.Vector2(0.36, 1.12), new THREE.Vector2(0.46, 1.42), new THREE.Vector2(0.52, 1.56),
      new THREE.Vector2(0.44, 1.66), new THREE.Vector2(0.2, 1.74), new THREE.Vector2(0.001, 1.76),
    ], 18);
    add(robe, this.material);
    // Head (a slightly tall egg) and hood rim.
    add(new THREE.SphereGeometry(0.27, 18, 14).scale(1, 1.12, 1), this.material, 0, 1.97, 0);
    add(new THREE.TorusGeometry(0.29, 0.05, 6, 20).rotateX(Math.PI / 2).rotateX(0.35), this.trim, 0, 1.92, -0.04);
    // Belt and two arms hanging at the sides, with cuffs.
    add(new THREE.CylinderGeometry(0.385, 0.385, 0.09, 18), this.trim, 0, 1.06, 0);
    const armGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.82, 10);
    const cuffGeo = new THREE.CylinderGeometry(0.135, 0.135, 0.08, 10);
    for (const s of [-1, 1]) {
      const arm = add(armGeo, this.material, s * 0.5, 1.2, 0.02);
      arm.rotation.z = s * 0.14;
      add(cuffGeo, this.trim, s * 0.555, 0.82, 0.02).rotation.z = s * 0.14;
    }
    if (horned) {
      // Curved horns from a tapered tube, sweeping up and back; a bone mask plate over the face.
      for (const s of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(s * 0.16, 2.12, 0.02), new THREE.Vector3(s * 0.34, 2.32, -0.04),
          new THREE.Vector3(s * 0.38, 2.52, -0.16), new THREE.Vector3(s * 0.3, 2.62, -0.3),
        ]);
        const horn = new THREE.TubeGeometry(curve, 12, 0.07, 8);
        // Taper the tube toward its tip.
        const p = horn.attributes.position, n = 9;
        for (let i = 0; i < p.count; i++) {
          const ring = Math.floor(i / n), k = 1 - 0.85 * (ring / 12);
          const c = curve.getPoint(ring / 12);
          p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
        }
        horn.computeVertexNormals();
        add(horn, this.trim);
      }
      add(new THREE.SphereGeometry(0.2, 14, 8, -Math.PI / 2, Math.PI, 0.9, 1.1).scale(1.15, 1, 0.7), this.trim, 0, 1.96, 0.14);
    } else {
      // Caster: a shoulder mantle and a thin halo-like circlet.
      add(new THREE.CylinderGeometry(0.42, 0.56, 0.22, 18, 1, true), this.trim, 0, 1.5, 0);
      add(new THREE.TorusGeometry(0.24, 0.025, 6, 24).rotateX(Math.PI / 2), this.trim, 0, 2.13, 0);
    }
    // Glowing eye slits on the face (+Z).
    const eyeMat = new THREE.MeshBasicMaterial({ color: opts.eyeColor ?? new THREE.Color(2, 0.2, 0.15) });
    const eyeGeo = new THREE.BoxGeometry(0.11, 0.035, 0.03);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(s * 0.1, 1.99, 0.27);
      eye.rotation.z = s * -0.18;
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
    this.trim.emissive.setRGB(0, 0, 0);
  }

  /**
   * Hit flash, 0 = none, 1 = full. Without `tint` it is the old white-hot flash (callers often pass > 1, so the
   * peak is capped). With `tint` it is a tinted flash that stays below the bloom threshold, so the hit VFX on top
   * still reads (the arena uses this for every `ctx.hit`).
   */
  setFlash(v: number, tint?: THREE.Color) {
    if (tint) {
      const f = Math.min(Math.max(0, v), 1);
      this.material.emissive.copy(tint).multiplyScalar(0.45 * f);
      this.trim.emissive.copy(this.material.emissive);
      return;
    }
    // Kept modest: at 6x the figure became a bloom-blown white blob that hid the hit effect itself.
    const f = Math.min(Math.max(0, v), 1.2);
    this.material.emissive.setRGB(2.4 * f, 2 * f, 1.6 * f);
    this.trim.emissive.copy(this.material.emissive);
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
