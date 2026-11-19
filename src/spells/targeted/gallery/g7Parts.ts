import * as THREE from 'three';
import { mergeParts } from '../../../effects/common';
import { hash } from '../../../heroes/sheath/partsBig';

/**
 * Gallery group 7's pieces (art deco arc, solar orrery). Nothing here makes a three.js object when the file is loaded: every piece
 * is a class or a builder, made by its look's constructor. No dice: `hash` of an index. Flat colours with a baked shade; the
 * materials are basic ones, so they match the floor under the tool's and the game's lights.
 */

/** Paints a geometry with one colour (the position, colour and nothing else, so `mergeParts` can join pieces). */
export function paint(g: THREE.BufferGeometry, hex: string | THREE.Color): THREE.BufferGeometry {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// The zigzag bolt (art deco arc).
// ---------------------------------------------------------------------------------------------------------------

/**
 * A ribbon of up to `max` segments, each drawn as a flat quad (read from a steep camera) and a standing quad (read from a low
 * one). `begin`, `seg` ..., `end` rebuild it; the buffers are made once.
 */
export class Ribbon {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  private pos: Float32Array;
  private posA: THREE.BufferAttribute;
  private n = 0;

  constructor(private max: number, color: THREE.ColorRepresentation, additive = false, order = 5) {
    this.pos = new Float32Array(max * 8 * 3);
    const geo = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(this.pos, 3);
    this.posA.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posA);
    const idx: number[] = [];
    for (let q = 0; q < max * 2; q++) { const v = q * 4; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
    geo.setIndex(idx);
    this.material = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = order;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  begin() {
    this.n = 0;
  }

  seg(ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number) {
    if (this.n >= this.max) return;
    let dx = bx - ax, dz = bz - az;
    const l = Math.hypot(dx, dz);
    if (l < 1e-4) return;
    dx /= l; dz /= l;
    const nx = -dz * w * 0.5, nz = dx * w * 0.5, h = w * 0.5;
    const p = this.pos;
    let o = this.n * 24;
    const put = (x: number, y: number, z: number) => { p[o++] = x; p[o++] = y; p[o++] = z; };
    put(ax - nx, ay, az - nz); put(ax + nx, ay, az + nz); put(bx - nx, by, bz - nz); put(bx + nx, by, bz + nz);
    put(ax, ay - h, az); put(ax, ay + h, az); put(bx, by - h, bz); put(bx, by + h, bz);
    this.n++;
  }

  end() {
    this.posA.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, this.n * 12);
    this.mesh.visible = this.n > 0 && this.material.opacity > 0.003;
  }
}

const ZIGS = 6;

/**
 * A geometric bolt from (ax, az) to (bx, bz) at height `y`: a gold zigzag of straight strokes at fixed corners (not a jitter:
 * art deco is drawn with a ruler) over a thin pale core. `s`..`e` (0..1) is the part drawn, so it races out and its tail can
 * follow. Two ribbons, `gold` (wide) and `core` (thin).
 */
export class ZigBolt {
  readonly gold: Ribbon;
  readonly core: Ribbon;
  /** The lacquer under the gold, so the gold reads on any floor. */
  readonly dark: Ribbon;
  private u = new Float32Array(ZIGS + 2);

  constructor(gold: THREE.ColorRepresentation, core: THREE.ColorRepresentation) {
    this.dark = new Ribbon(ZIGS + 2, '#0c0b10', false, 4);
    this.gold = new Ribbon(ZIGS + 2, gold, false, 5);
    this.core = new Ribbon(ZIGS + 2, core, true, 6);
  }

  /** `amp`: the zigzag's sideways step in metres (0 draws a straight line); `w`: the gold's width. */
  set(ax: number, az: number, bx: number, bz: number, y: number, s: number, e: number, amp: number, w: number, opacity: number, coreOpacity: number) {
    this.dark.material.opacity = opacity * 0.8;
    this.gold.material.opacity = opacity;
    this.core.material.opacity = coreOpacity;
    this.dark.begin(); this.gold.begin(); this.core.begin();
    if (e - s > 0.002 && opacity > 0.003) {
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
      const px = -dz / l, pz = dx / l;
      // the sample points: the drawn ends and every corner between them
      let n = 0;
      const u = this.u;
      u[n++] = s;
      for (let j = 1; j < ZIGS; j++) { const f = j / ZIGS; if (f > s && f < e) u[n++] = f; }
      u[n++] = e;
      let lx = 0, lz = 0;
      for (let k = 0; k < n; k++) {
        const f = u[k];
        const off = amp * this.offset(f);
        const x = ax + dx * f + px * off, z = az + dz * f + pz * off;
        if (k > 0) {
          this.dark.seg(lx, y - 0.01, lz, x, y - 0.01, z, w * 1.8);
          this.gold.seg(lx, y, lz, x, y, z, w);
          this.core.seg(lx, y + 0.01, lz, x, y + 0.01, z, w * 0.34);
        }
        lx = x; lz = z;
      }
    }
    this.dark.end(); this.gold.end(); this.core.end();
  }

  /** The zigzag at fraction f: a triangle wave with corners at j / ZIGS, alternating, 0 at both ends. */
  private offset(f: number) {
    const k = f * ZIGS, j = Math.floor(k), r = k - j;
    const a = j === 0 ? 0 : (j % 2 ? 1 : -1), b = j + 1 >= ZIGS ? 0 : ((j + 1) % 2 ? 1 : -1);
    return a + (b - a) * r;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The sunburst fan.
// ---------------------------------------------------------------------------------------------------------------

/**
 * A fan of tapered rays about the origin in the XY plane (apex outward): `rays` of them over `span` radians (2 pi: a whole
 * sun, pi: the half-sun of a deco doorway, centred on +Y), the even ones long and the odd ones short. Pale at the root, `tip`
 * at the point. `flat` lays it on the floor.
 */
export function fanGeometry(rays: number, span: number, r0: number, rLong: number, rShort: number, half: number, root: string, tip: string, flat: boolean): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const a = new THREE.Color(root), b = new THREE.Color(tip);
  const full = span >= Math.PI * 1.99;
  for (let k = 0; k < rays; k++) {
    const ang = full ? (k / rays) * Math.PI * 2 + Math.PI / rays : Math.PI / 2 - span / 2 + (k + 0.5) / rays * span;
    const L = k % 2 === 0 ? rLong : rShort;
    const h = half * (k % 2 === 0 ? 1 : 0.8);
    const p = (r: number, d: number) => [Math.cos(ang + d) * r, Math.sin(ang + d) * r, 0];
    const tri = [p(r0, -h), p(r0, h), p(L, 0)];
    const cs = [a, a, b];
    for (let i = 0; i < 3; i++) { pos.push(tri[i][0], tri[i][1], tri[i][2]); col.push(cs[i].r, cs[i].g, cs[i].b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (flat) g.rotateX(-Math.PI / 2);
  return g;
}

/** A basic material that reads vertex colours, transparent and double sided. */
export function vertexMaterial(additive = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// The orrery (solar orrery).
// ---------------------------------------------------------------------------------------------------------------

/**
 * One ring of the orrery, lying in the XZ plane, radius `R`: a brass band with ivory tick marks and a few gold beads. It is
 * built whole (vertex colours) so a ring is one draw call.
 */
export function ringGeometry(R: number, tube: number, ticks: number, brass: string, ivory: string, gold: string): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(new THREE.TorusGeometry(R, tube, 8, Math.max(48, Math.round(R * 40))).rotateX(Math.PI / 2), brass));
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2, big = i % 6 === 0;
    const g = new THREE.BoxGeometry(big ? 0.1 : 0.055, tube * (big ? 1.9 : 1.5), big ? 0.17 : 0.1);
    g.rotateY(-a);
    g.translate(Math.cos(a) * R, 0, Math.sin(a) * R);
    parts.push(paint(g, big ? gold : ivory));
  }
  return mergeParts(parts);
}

/** An enamel planet: a sphere with a baked shade from the upper left and a band or two of a second colour; `ring` adds a saucer. */
export function planetGeometry(r: number, base: string, band: string, ring: boolean): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 22, 16);
  const pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 3);
  const a = new THREE.Color(base), b = new THREE.Color(band), c = new THREE.Color();
  const L = new THREE.Vector3(-0.45, 0.75, 0.5).normalize();
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i) / r;
    const inBand = Math.abs(y - 0.25) < 0.14 || Math.abs(y + 0.5) < 0.07;
    c.copy(inBand ? b : a);
    const nx = pos.getX(i) / r, nz = pos.getZ(i) / r;
    const lit = 0.5 + 0.5 * Math.max(0, nx * L.x + y * L.y + nz * L.z);
    col[i * 3] = c.r * lit; col[i * 3 + 1] = c.g * lit; col[i * 3 + 2] = c.b * lit;
  }
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!ring) return g;
  const s = paint(new THREE.TorusGeometry(r * 1.75, r * 0.12, 6, 36).rotateX(Math.PI / 2.4), band);
  return mergeParts([g, s]);
}

/**
 * The star chart on the floor: tick marks round the rim, a ring of small four-pointed stars at hash-chosen spots between
 * `inner` and `outer`, and thin lines joining some of them (constellations). One mesh, flat, vertex colours.
 */
export function starChartGeometry(outer: number, inner: number, ivory: string, gold: string): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const iv = new THREE.Color(ivory), go = new THREE.Color(gold);
  const tri = (x1: number, z1: number, x2: number, z2: number, x3: number, z3: number, c: THREE.Color) => {
    pos.push(x1, 0, z1, x2, 0, z2, x3, 0, z3);
    for (let i = 0; i < 3; i++) col.push(c.r, c.g, c.b);
  };
  const quad = (ax: number, az: number, bx: number, bz: number, w: number, c: THREE.Color) => {
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
    tri(ax - nx, az - nz, ax + nx, az + nz, bx + nx, bz + nz, c);
    tri(ax - nx, az - nz, bx + nx, bz + nz, bx - nx, bz - nz, c);
  };
  const N = 96;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, big = i % 8 === 0, l = big ? 0.55 : 0.28;
    quad(Math.cos(a) * (outer - 0.12), Math.sin(a) * (outer - 0.12), Math.cos(a) * (outer - 0.12 - l), Math.sin(a) * (outer - 0.12 - l), big ? 0.1 : 0.06, big ? go : iv);
  }
  const stars: number[][] = [];
  for (let i = 0; i < 16; i++) {
    const a = hash(i * 3.1 + 1) * Math.PI * 2, r = inner + (outer - 1.0 - inner) * Math.sqrt(hash(i * 5.3 + 2));
    const x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.16 + 0.16 * hash(i * 7.7 + 4);
    stars.push([x, z]);
    // a four-pointed star: two thin diamonds
    tri(x - s, z, x, z - s * 0.28, x, z + s * 0.28, go); tri(x + s, z, x, z - s * 0.28, x, z + s * 0.28, go);
    tri(x, z - s, x - s * 0.28, z, x + s * 0.28, z, go); tri(x, z + s, x - s * 0.28, z, x + s * 0.28, z, go);
  }
  for (let i = 0; i + 1 < stars.length; i++) {
    if (i % 4 === 3) continue;
    quad(stars[i][0], stars[i][1], stars[i + 1][0], stars[i + 1][1], 0.035, iv);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
