import * as THREE from 'three';
import { RING, seeded } from '../common';
import type { HazardWorld } from '../hazards/base';
import { Sparks } from '../hazards/fx';
import { REVEAL, type ShiftLook } from './base';

export type FloorStyle = 'lava' | 'water' | 'sun' | 'thorn' | 'storm';

/** What one stage leaves on the floor. Past the ring's radius means no edge zone; 0 no zone in the middle. */
export interface FloorStep {
  edge?: number;
  vent?: number;
  /** Water channels open (Frost). */
  channels?: boolean;
  /** Nothing is drawn beyond this radius: the floor is gone there (Sky Ruins). */
  clip?: number;
}

/** Two straight strips point-symmetric about the ring's centre: `normal` across them, `offset` and `half` width in metres. */
export interface FloorChannels {
  normal: { x: number; z: number };
  offset: number;
  half: number;
}

const NONE = 99;
/** How strongly Last stand covers the floor: the spells' zones and the cover must still read on it. */
const LAST_COVER = 0.78;

const vertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vP = w.xz - vec2(${RING.x.toFixed(1)}, ${RING.z.toFixed(1)});
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const common = /* glsl */ `
  varying vec2 vP;
  uniform float uEdge, uVent, uAll, uTime, uChan, uChanHalf, uChanOffset, uClip;
  uniform vec2 uChanNormal;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    v *= 1.14;
    return v;
  }
  // x: the cell's own random number, y: distance to its point, z: distance to its border.
  vec3 cells(vec2 p) {
    vec2 g = floor(p), f = fract(p), mg = vec2(0.0), mr = vec2(0.0);
    float md = 8.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 r = o + vec2(hash(g + o), hash(g + o + 17.3)) - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = o; }
    }
    float border = 8.0;
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
      vec2 o = mg + vec2(float(i), float(j));
      vec2 r = o + vec2(hash(g + o), hash(g + o + 17.3)) - f;
      if (dot(mr - r, mr - r) > 0.0001) border = min(border, dot(0.5 * (mr + r), normalize(r - mr)));
    }
    return vec3(hash(g + mg), sqrt(md), border);
  }
`;

/** The look of each floor: fills `col` and `a` from `p` (metres), `sd` (metres inside the zone) and `rim` (1 on its edge). */
const STYLES: Record<FloorStyle, { body: string; scorch: string; scorchAlpha: number }> = {
  lava: {
    // Cooling crust plates with glowing veins between them, pooling here and there; hottest along the edge.
    body: /* glsl */ `
      vec2 q = p * 0.5 + 1.6 * vec2(fbm(p * 0.25 + uTime * 0.03), fbm(p * 0.25 - uTime * 0.025));
      vec3 c = cells(q);
      float vein = smoothstep(0.1, 0.015, c.z);
      float pool = smoothstep(0.6, 0.78, fbm(q * 1.4 + uTime * 0.05));
      float heat = clamp(max(vein, pool) + rim * 0.6, 0.0, 1.0);
      float pulse = 0.86 + 0.14 * sin(uTime * 1.6 + c.x * 6.28);
      vec3 crust = mix(vec3(0.045, 0.02, 0.018), vec3(0.1, 0.045, 0.034), c.x);
      vec3 hot = mix(vec3(0.5, 0.09, 0.02), vec3(0.88, 0.32, 0.05), heat);
      col = mix(crust, hot * pulse, heat);
      a = 0.97;
    `,
    scorch: 'vec3(0.03, 0.012, 0.01)',
    scorchAlpha: 0.7,
  },
  water: {
    // Dark moving water with broken sheets of ice, fewer the farther from the edge: the ice is sinking.
    body: /* glsl */ `
      float ripple = fbm(p * 1.2 + uTime * vec2(0.06, -0.04));
      col = mix(vec3(0.012, 0.055, 0.085), vec3(0.03, 0.135, 0.185), ripple);
      col += vec3(0.05, 0.1, 0.12) * smoothstep(0.62, 0.72, fbm(p * 2.6 - uTime * vec2(0.09, 0.05)));
      vec3 c = cells(p * 0.62);
      float keep = 0.34 + sd * 0.2;
      float floe = step(keep, c.x) * smoothstep(0.03, 0.09, c.z);
      vec3 ice = vec3(0.25, 0.35, 0.43) * (0.78 + 0.34 * noise(p * 3.1));
      col = mix(col, ice, floe * 0.94);
      col += rim * vec3(0.3, 0.46, 0.55);
      a = 0.97;
    `,
    scorch: 'vec3(0.2, 0.3, 0.36)',
    scorchAlpha: 0.32,
  },
  sun: {
    // A bed of embers on a burnt floor, with gold fire running along its seams.
    body: /* glsl */ `
      vec2 q = p * 0.85;
      float f = fbm(q + vec2(0.0, -uTime * 0.5));
      float seam = abs(fbm(q * 1.7 + vec2(uTime * 0.25, -uTime * 0.8)) - 0.5);
      float flame = smoothstep(0.46, 0.8, f) * 0.5 + smoothstep(0.08, 0.0, seam) * 0.62;
      col = mix(vec3(0.055, 0.024, 0.012), vec3(0.58, 0.24, 0.05), clamp(flame, 0.0, 1.0));
      col = mix(col, vec3(0.9, 0.56, 0.15), smoothstep(0.82, 1.08, flame));
      col += rim * vec3(0.42, 0.24, 0.05);
      a = 0.86;
    `,
    scorch: 'vec3(0.05, 0.02, 0.01)',
    scorchAlpha: 0.55,
  },
  thorn: {
    // A dark mat of brambles, with pale thorn tips along them and a sour glow at the edge.
    body: /* glsl */ `
      float r1 = abs(fbm(p * 0.9) - 0.5), r2 = abs(fbm(p * 1.7 + 3.0) - 0.5);
      float vine = max(smoothstep(0.05, 0.0, r1), smoothstep(0.035, 0.0, r2) * 0.8);
      col = mix(vec3(0.024, 0.03, 0.014), vec3(0.11, 0.13, 0.045), vine);
      vec3 c = cells(p * 2.2);
      col = mix(col, vec3(0.46, 0.37, 0.18), smoothstep(0.1, 0.03, c.y) * vine);
      col += rim * vec3(0.28, 0.4, 0.07) * (0.8 + 0.2 * sin(uTime * 2.2));
      a = 0.96;
    `,
    scorch: 'vec3(0.02, 0.025, 0.01)',
    scorchAlpha: 0.6,
  },
  storm: {
    // Thin arcs of lightning crawling over the stone.
    body: /* glsl */ `
      float n = fbm(p * 0.8 + uTime * vec2(0.3, -0.2));
      float arc = smoothstep(0.03, 0.0, abs(n - 0.5));
      col = mix(vec3(0.05, 0.06, 0.15), vec3(0.58, 0.66, 1.0), arc);
      a = 0.42 + 0.56 * arc;
    `,
    scorch: 'vec3(0.0)',
    scorchAlpha: 0,
  },
};

function fragment(style: FloorStyle) {
  const s = STYLES[style];
  return /* glsl */ `
    ${common}
    void main() {
      vec2 p = vP;
      float d = length(p);
      if (d > uClip) discard;
      float ang = atan(p.y, p.x);
      // A rough edge, small enough that what you see is what hurts.
      float jag = (noise(vec2(ang * 7.0, 1.5)) - 0.5) * 0.4 + (noise(vec2(ang * 29.0, 4.0)) - 0.5) * 0.16;
      float sd = d + jag - uEdge;
      if (uVent > 0.01) sd = max(sd, uVent - (d + jag * 0.5));
      if (uChan > 0.0) sd = max(sd, uChan * uChanHalf - (abs(abs(dot(p, uChanNormal)) - uChanOffset) + (noise(p * 1.3) - 0.5) * 0.3));
      // Safe floor costs nothing: it is most of the screen, and the looks below are not cheap on a phone.
      if (uAll <= 0.0 && sd < -0.85) discard;
      float inside = smoothstep(-0.05, 0.05, sd);
      float rim = smoothstep(0.24, 0.0, abs(sd)) * (1.0 - uAll);
      vec3 col = vec3(0.0);
      float a = 1.0;
      ${s.body}
      float zone = max(inside, uAll * ${LAST_COVER.toFixed(2)});
      // A scorched band on the floor just outside the zone.
      float near = smoothstep(-0.8, 0.0, sd) * (1.0 - inside) * ${s.scorchAlpha.toFixed(2)} * (1.0 - uAll);
      float alpha = max(zone * a, near);
      if (alpha < 0.004) discard;
      gl_FragColor = vec4(mix(${s.scorch}, col, zone > near ? 1.0 : inside), alpha);
    }
  `;
}

const ease = (u: number) => u * u * (3 - 2 * u);

/**
 * The parts of a floor a stage changes: one disc whose shader knows the zones, so an edge can creep in while the stage
 * shows and arrive when it lands. Drawn after the see-through floors and before the spells' zones (`renderOrder`), which
 * must read on it.
 */
export class ZoneFloor implements ShiftLook {
  readonly group = new THREE.Group();
  readonly drawsZones = true;
  private mat: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private sparks = new Sparks(170, 0.13);
  private thorns: { mesh: THREE.InstancedMesh; spots: { x: number; z: number; r: number; yaw: number; tilt: number; s: number }[] } | null = null;
  private edge = { from: NONE, to: NONE, now: NONE };
  private vent = { from: 0, to: 0, now: 0 };
  private began = -1;
  private showing = false;
  private channels = 0;
  private channelsTo = 0;
  private all = 0;
  private allTo = 0;
  private dummy = new THREE.Object3D();
  private time = 0;

  constructor(private style: FloorStyle, private steps: FloorStep[], channels?: FloorChannels, private extra?: ShiftLook) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertex, fragmentShader: fragment(style), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      uniforms: {
        uEdge: { value: NONE }, uVent: { value: 0 }, uAll: { value: 0 }, uTime: { value: 0 }, uClip: { value: NONE },
        uChan: { value: 0 }, uChanHalf: { value: channels?.half ?? 0 }, uChanOffset: { value: channels?.offset ?? 0 },
        uChanNormal: { value: new THREE.Vector2(channels?.normal.x ?? 0, channels?.normal.z ?? 0) },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(RING.r, 128).rotateX(-Math.PI / 2), this.mat);
    this.mesh.position.set(RING.x, 0.035, RING.z);
    this.mesh.renderOrder = 0.5;
    this.mesh.visible = false;
    this.group.add(this.mesh, this.sparks.points);
    if (style === 'thorn') this.buildThorns();
    if (extra) this.group.add(extra.group);
  }

  /** Thorn spikes standing out of the bramble floor, each from when the edge has passed it. */
  private buildThorns() {
    const rnd = seeded(5151), count = 300;
    const geo = new THREE.ConeGeometry(0.11, 1, 5, 2).translate(0, 0.5, 0);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + pos.getY(i) * pos.getY(i) * 0.22); // curved
    geo.computeVertexNormals();
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x5c5626, roughness: 0.75, flatShading: true }), count);
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    const spots: NonNullable<ZoneFloor['thorns']>['spots'] = [];
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2, r = 6.7 + rnd() * 5.1;
      spots.push({ x: RING.x + Math.cos(a) * r, z: RING.z + Math.sin(a) * r, r, yaw: rnd() * Math.PI * 2, tilt: (rnd() - 0.5) * 0.5, s: 0.5 + rnd() * rnd() * 0.95 });
    }
    this.thorns = { mesh, spots };
    this.group.add(mesh);
    this.placeThorns(0);
  }

  private placeThorns(dt: number) {
    const t = this.thorns;
    if (!t) return;
    const d = this.dummy;
    t.spots.forEach((s, i) => {
      // Up to full height over the 0.6 m after the edge passes it.
      const u = THREE.MathUtils.clamp((s.r - this.edge.now) / 0.6, 0, 1);
      d.position.set(s.x, 0, s.z);
      d.rotation.set(s.tilt, s.yaw, s.tilt * 0.6);
      d.scale.set(u > 0 ? 1 : 0, u * s.s, u > 0 ? 1 : 0);
      d.updateMatrix();
      t.mesh.setMatrixAt(i, d.matrix);
    });
    t.mesh.instanceMatrix.needsUpdate = true;
    if (dt > 0 && Math.random() < dt * 30) {
      const a = Math.random() * Math.PI * 2, r = this.edge.now;
      this.sparks.emit(RING.x + Math.cos(a) * r, 0.1, RING.z + Math.sin(a) * r, 1, 1.2, 1.8, 0.7, 0x5a6a20, 6);
    }
  }

  begin(index: number) {
    this.extra?.begin?.(index);
    this.began = -1;
    this.showing = true;
    const step = this.steps[index];
    if (!step) {
      // Past the last step: Last stand, the whole floor.
      this.allTo = 1;
      this.mesh.visible = true;
      return;
    }
    this.edge.from = this.edge.now;
    this.edge.to = step.edge ?? NONE;
    // An edge that starts now comes in from the rim, not from nowhere.
    if (this.edge.from >= NONE && this.edge.to < NONE) this.edge.from = RING.r + 0.4;
    this.vent.from = this.vent.now;
    this.vent.to = step.vent ?? 0;
    this.channelsTo = step.channels ? 1 : 0;
    if (this.edge.to < NONE || this.vent.to > 0 || step.channels) this.mesh.visible = true;
  }

  land(index: number) {
    this.extra?.land?.(index);
    const clip = this.steps[index]?.clip;
    if (clip !== undefined) this.mat.uniforms.uClip.value = clip;
  }

  update(dt: number, clock: number, world: HazardWorld) {
    this.extra?.update(dt, clock, world);
    this.time += dt;
    this.sparks.update(dt);
    const u = this.mat.uniforms;
    u.uTime.value = this.time;
    if (this.showing) {
      if (this.began < 0) this.began = clock;
      const k = Math.min(1, (clock - this.began) / REVEAL), e = ease(k);
      this.edge.now = this.edge.from + (this.edge.to - this.edge.from) * e;
      this.vent.now = this.vent.from + (this.vent.to - this.vent.from) * e;
      this.channels = Math.max(this.channels, this.channelsTo * e);
      this.all = Math.max(this.all, this.allTo * e);
      if (this.thorns) this.placeThorns(dt);
      if (k >= 1) this.showing = false;
      u.uEdge.value = this.edge.now;
      u.uVent.value = this.vent.now;
      u.uChan.value = this.channels;
      u.uAll.value = this.all;
    }
    if (this.mesh.visible) this.emit(dt);
  }

  /** The little that rises from the floor: embers off lava, motes off sunfire. */
  private emit(dt: number) {
    const rate = this.style === 'lava' ? 26 : this.style === 'sun' ? 34 : 0;
    if (!rate || Math.random() > dt * rate) return;
    const a = Math.random() * Math.PI * 2;
    const inner = Math.min(this.edge.now, RING.r);
    const r = this.all > 0.5 ? Math.random() * RING.r : inner + Math.random() * Math.max(0, RING.r - inner);
    const color = this.style === 'lava' ? 0xd86a20 : 0xd8a040;
    this.sparks.emit(RING.x + Math.cos(a) * r, 0.1, RING.z + Math.sin(a) * r, 1, 0.5, 2.6, 1.3, color, 0.3);
  }
}
