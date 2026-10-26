import * as THREE from 'three';

export interface CrescentArcOptions {
  /** Arc radius (to the middle of the band). Default 2. */
  radius?: number;
  /** Band width at the leading edge. Default 0.6. */
  width?: number;
  /** Angle the arc covers, radians. Default 1.6π. */
  sweep?: number;
  /**
   * 'soft': translucent additive sheet (wind, energy), builds up where arcs overlap.
   * 'toon': opaque flat bands, light inner edge → saturated middle → dark outer edge, with a thorny outer edge.
   */
  style?: 'soft' | 'toon';
  /** Leading-edge (hottest) colour. */
  edge?: THREE.ColorRepresentation;
  /** Body colour. */
  mid?: THREE.ColorRepresentation;
  /** Outer edge / tail colour (toon: the dark band). */
  outer?: THREE.ColorRepresentation;
}

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const fragment = /* glsl */ `
  uniform float uHead, uLength, uErosion, uOpacity, uTime, uToon;
  uniform vec3 uEdge, uMid, uOuter;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float d = uHead - vUv.x;                 // distance behind the leading edge, along the arc (0..1)
    if (d < 0.0 || d > uLength) discard;
    float k = d / max(uLength, 1e-4);        // 0 at the head, 1 at the tail
    float across = vUv.y * 2.0 - 1.0;        // -1 inner edge, +1 outer edge
    // Tapered crescent: round-ish head, long thinning tail that hooks toward the inner side.
    float hw = pow(1.0 - k, 0.7) * smoothstep(0.0, 0.035, d / max(uLength, 1e-4) + 0.02);
    float centre = -0.35 * k * k;            // the tail hooks inward
    float n = noise(vec2(vUv.x * 28.0 - uTime * 3.0, vUv.y * 4.0));
    // Thorny / ragged outer edge.
    float rag = (uToon > 0.5 ? 0.35 : 0.2) * (noise(vec2(vUv.x * 60.0, 3.1)) - 0.3);
    float edgeDist = abs(across - centre) - hw + (across > centre ? rag : 0.0);
    if (edgeDist > 0.0) discard;
    // Alpha erosion: the tail and the ends eat away first.
    if (n < uErosion * (0.4 + 0.9 * k)) discard;
    float t = (across - centre) / max(hw, 1e-3);   // -1 .. 1 across the band
    vec3 col;
    float a;
    if (uToon > 0.5) {
      // Hard bands: light inner edge, saturated middle, dark outer edge; brighter near the head.
      col = t < -0.35 ? uEdge : (t < 0.45 ? uMid : uOuter);
      col = mix(uEdge, col, smoothstep(0.0, 0.12, k));
      a = uOpacity;
    } else {
      col = mix(uEdge, uMid, smoothstep(0.0, 0.25, k));
      col = mix(col, uOuter, smoothstep(0.5, 1.0, k));
      a = uOpacity * (1.0 - k) * (0.55 + 0.45 * (1.0 - abs(t))) * (0.75 + 0.5 * n);
    }
    gl_FragColor = vec4(col, a);
  }
`;

/**
 * A crescent / wind / slash stroke along a circular arc (lying in the mesh's local XY plane, centred on its
 * origin). Drive `head` 0 → 1 to sweep it around; `length` is the visible tail as a fraction of the arc.
 * Place several on tilted planes (rotate the mesh) to build a cyclone or a sphere of wind from any camera.
 */
export class CrescentArc {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(opts: CrescentArcOptions = {}) {
    const radius = opts.radius ?? 2, width = opts.width ?? 0.6, sweep = opts.sweep ?? Math.PI * 1.6;
    const segs = 96;
    const pos: number[] = [], uv: number[] = [], index: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const a = u * sweep;
      for (let j = 0; j <= 1; j++) {
        const r = radius + (j - 0.5) * width;
        pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
        uv.push(u, j);
      }
      if (i < segs) {
        const b = i * 2;
        index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    const toon = opts.style === 'toon';
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: toon ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uHead: { value: 0 }, uLength: { value: 0.35 }, uErosion: { value: 0 }, uOpacity: { value: 0 }, uTime: { value: 0 },
        uToon: { value: toon ? 1 : 0 },
        uEdge: { value: new THREE.Color(opts.edge ?? 0xffffff) },
        uMid: { value: new THREE.Color(opts.mid ?? (toon ? 0x7ad8c8 : 0xbff4ea)) },
        uOuter: { value: new THREE.Color(opts.outer ?? (toon ? 0x1e4a5a : 0x3a8a8a)) },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.visible = false;
  }

  /** Leading edge position along the arc, 0..1 (+ the tail length to fully leave). */
  set head(v: number) { this.material.uniforms.uHead.value = v; }
  /** Visible tail length as a fraction of the arc. */
  set length(v: number) { this.material.uniforms.uLength.value = v; }
  /** 0 = whole, 1 = eaten away (tail first). */
  set erosion(v: number) { this.material.uniforms.uErosion.value = v; }
  set opacity(v: number) {
    this.material.uniforms.uOpacity.value = v;
    this.mesh.visible = v > 0.002;
  }
  /** Scrolls the noise; pass the effect time. */
  set time(v: number) { this.material.uniforms.uTime.value = v; }

  get edgeColor(): THREE.Color { return this.material.uniforms.uEdge.value; }
  get midColor(): THREE.Color { return this.material.uniforms.uMid.value; }
  get outerColor(): THREE.Color { return this.material.uniforms.uOuter.value; }
}
