import * as THREE from 'three';

/**
 * Shield visuals for a figure: a thin translucent bubble shell with a fresnel-style rim (a faint body, a bright edge,
 * a slow highlight band running up it), and a small pop of shards when it breaks. Flat unlit colour, no additive
 * blending, so nothing turns into a glowing white ball under bloom. See pipeline/designs/mechanics.md section 2.
 *
 * `ShieldFx` is one figure's bubble; `ShieldFxPool` hands them out and takes them back. The shell follows the figure
 * in world space; the shards stay where the bubble broke. Figures are about 2.3 m tall.
 */
const SHELL_SCALE = new THREE.Vector3(1.15, 1.5, 1.15);
const SHARDS = 9;
const SHARD_LIFE = 0.7;
const DEFAULT_TINT = '#bfe0ff';

const vertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vP;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vP = position;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAmt, uPing, uTime, uFlick;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vP;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    // A slow highlight band climbing the shell, strongest toward the edge.
    float band = smoothstep(0.9, 1.0, sin(vP.y * 5.0 - uTime * 1.6)) * (0.35 + rim);
    float a = uAmt * uFlick * (0.05 + 0.6 * rim + 0.22 * band + uPing * (0.12 + 0.4 * rim));
    gl_FragColor = vec4(mix(uColor, vec3(1.0), rim * 0.3 + uPing * 0.2), clamp(a, 0.0, 0.85));
  }
`;

export class ShieldFx {
  readonly group = new THREE.Group();
  private shell: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private shards: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3 }[] = [];
  private shardMat = new THREE.MeshBasicMaterial({ color: DEFAULT_TINT, transparent: true, depthWrite: false });
  private shardT = -1;
  private amt = 0;
  private ping = 0;
  private clock = Math.random() * 10;
  private tint = '';

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(DEFAULT_TINT) }, uAmt: { value: 0 }, uPing: { value: 0 }, uTime: { value: 0 }, uFlick: { value: 1 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
    });
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), this.mat);
    this.shell.renderOrder = 4;
    const shardGeo = new THREE.OctahedronGeometry(0.11).scale(1, 1.6, 0.5);
    for (let i = 0; i < SHARDS; i++) {
      const mesh = new THREE.Mesh(shardGeo, this.shardMat);
      mesh.visible = false;
      this.shards.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
      this.group.add(mesh);
    }
    this.group.add(this.shell);
    this.reset();
  }

  /** Back to nothing shown (the pool hands it to the next figure). */
  reset() {
    this.amt = 0;
    this.ping = 0;
    this.shardT = -1;
    this.shell.visible = false;
    for (const s of this.shards) s.mesh.visible = false;
  }

  /** True once the bubble has faded and the shards are gone. */
  get settled() {
    return this.amt < 0.02 && this.shardT < 0;
  }

  /** The bubble took a hit: its rim flares for a moment. */
  flare() {
    this.ping = 1;
  }

  /** The bubble broke at `pos` (the figure's feet): the shell drops away and the shards fly out. */
  burst(pos: THREE.Vector3) {
    this.amt *= 0.25;
    this.ping = 1;
    this.shardT = 0;
    for (const s of this.shards) {
      const a = Math.random() * Math.PI * 2, up = 0.3 + Math.random() * 1.6;
      s.mesh.position.set(pos.x + Math.cos(a) * 0.9, pos.y + 0.4 + Math.random() * 1.7, pos.z + Math.sin(a) * 0.9);
      s.vel.set(Math.cos(a) * (2.2 + Math.random() * 2), up * 2.2, Math.sin(a) * (2.2 + Math.random() * 2));
      s.spin.set(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6);
      s.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      s.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
      s.mesh.visible = true;
    }
  }

  /**
   * Follows a figure standing at `pos`. `active`: the shield is up; `frac` its strength 0..1 (a weak one is fainter);
   * `left` seconds until it expires (it flickers in the last 0.8 s); `tint` (css, optional) the bubble's colour.
   */
  update(dt: number, active: boolean, frac: number, left: number, pos: THREE.Vector3, tint = '') {
    this.clock += dt;
    this.amt += ((active ? 1 : 0) - this.amt) * (1 - Math.exp(-dt * 10));
    this.ping = Math.max(0, this.ping - dt * 4);
    if (tint && tint !== this.tint) {
      this.tint = tint;
      (this.mat.uniforms.uColor.value as THREE.Color).set(tint);
      this.shardMat.color.set(tint);
    }
    this.shell.visible = this.amt > 0.02;
    if (this.shell.visible) {
      this.shell.position.set(pos.x, pos.y + 1.2, pos.z);
      const k = (0.92 + 0.08 * this.amt) * (1 + this.ping * 0.04);
      this.shell.scale.copy(SHELL_SCALE).multiplyScalar(k);
      const u = this.mat.uniforms;
      u.uAmt.value = this.amt * (0.55 + 0.45 * frac);
      u.uPing.value = this.ping;
      u.uTime.value = this.clock;
      u.uFlick.value = left < 0.8 ? 0.65 + 0.35 * Math.sin(this.clock * 34) : 1;
    }
    if (this.shardT >= 0) {
      this.shardT += dt;
      const k = this.shardT / SHARD_LIFE;
      if (k >= 1) {
        this.shardT = -1;
        for (const s of this.shards) s.mesh.visible = false;
      } else {
        this.shardMat.opacity = 1 - k * k;
        for (const s of this.shards) {
          s.vel.y -= 9 * dt;
          s.mesh.position.addScaledVector(s.vel, dt);
          s.mesh.rotation.x += s.spin.x * dt;
          s.mesh.rotation.y += s.spin.y * dt;
          s.mesh.rotation.z += s.spin.z * dt;
        }
      }
    }
  }
}

/** Hands out `ShieldFx` and takes them back; new ones are added to `parent` (the arena group) on first use. */
export class ShieldFxPool {
  private free: ShieldFx[] = [];

  constructor(private parent: THREE.Object3D) {}

  acquire(): ShieldFx {
    let fx = this.free.pop();
    if (!fx) {
      fx = new ShieldFx();
      this.parent.add(fx.group);
    }
    fx.reset();
    fx.group.visible = true;
    return fx;
  }

  release(fx: ShieldFx) {
    fx.group.visible = false;
    this.free.push(fx);
  }
}
