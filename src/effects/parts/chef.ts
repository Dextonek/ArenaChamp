import * as THREE from 'three';

/**
 * The chef kit (pipeline/designs/kit-chef.md): Madame Cleaver, arena chef. Chef's whites (kept under about 0.72, because the
 * bloom turns brighter areas into a halo), tomato red, steel, stock-pot silver, burnt black and a golden "good dish" glow.
 * `freshDishLook` / `goodDishLook` / `burntDishLook` = the dish on the floor (`Trait.markLook`): food you want, better food you
 * want more, food you do not want; `buildCleaver` = the big cleaver; `buildPot` = the stock pot; `buildTable` = the long laid
 * table with its cloth and three covered plates; `Vapour` = pooled steam / smoke puffs; `Chunks` = pooled bits that fly in an
 * arc (soup, crumbs, splinters). Everything is pooled or built once, takes world-space positions, has `reset()` where it
 * holds state, and stays under the bloom threshold (no colour above 0.92).
 */

/** Palette. Numbers for `THREE.Color`, `CHEF_CSS` for APIs that want a string. `core` is the pale foil, `foil` the tomato red. */
export const CHEF = {
  core: 0xf2efe6,
  hot: 0xd8d4c8,
  white: 0xb9b4a8,
  whiteShade: 0x9a958a,
  body: 0xd84a3a,
  shade: 0x9a2e26,
  tomato: 0xe8794a,
  steel: 0xb4bcc4,
  steelShade: 0x8f979e,
  wood: 0x8a5a34,
  gold: 0xe0b84a,
  goldDeep: 0xc98a28,
  roast: 0xb87a3c,
  leaf: 0x5f9a3e,
  char: 0x2c2724,
  black: 0x141110,
  smoke: 0x4a4642,
  dark: 0x1e1a18,
  foil: 0xd84a3a,
  accent: 0xf2efe6,
} as const;

export const CHEF_CSS = {
  core: '#f2efe6',
  hot: '#d8d4c8',
  white: '#b9b4a8',
  body: '#d84a3a',
  shade: '#9a2e26',
  tomato: '#e8794a',
  steel: '#b4bcc4',
  wood: '#8a5a34',
  gold: '#e0b84a',
  goldDeep: '#c98a28',
  smoke: '#4a4642',
  dark: '#1e1a18',
  foil: '#d84a3a',
  accent: '#f2efe6',
} as const;

const MIN = 1e-4;

function mat(color: number, opacity = 1, additive = false) {
  return new THREE.MeshBasicMaterial({
    color, transparent: opacity < 1 || additive, opacity, depthWrite: opacity >= 1 && !additive, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function flat(inner: number, outer: number, color: number, opacity: number, y: number, additive = false): THREE.Mesh {
  const m = new THREE.Mesh(
    inner > 0 ? new THREE.RingGeometry(inner, outer, 48).rotateX(-Math.PI / 2) : new THREE.CircleGeometry(outer, 48).rotateX(-Math.PI / 2),
    mat(color, opacity, additive),
  );
  m.position.y = y;
  m.renderOrder = 1;
  m.frustumCulled = false;
  return m;
}

/** A soft S-shaped curl, `h` tall, wandering `r` sideways: steam or smoke standing over a dish. */
function curl(h: number, r: number, phase: number, tube: number, color: number, opacity: number): THREE.Mesh {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const k = i / 8;
    pts.push(new THREE.Vector3(Math.sin(k * 5 + phase) * r * (0.4 + k), k * h, Math.cos(k * 4 + phase) * r * (0.4 + k)));
  }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, tube, 5), mat(color, opacity));
  m.frustumCulled = false;
  return m;
}

/** A plate (rim, well) of radius `r` standing at y 0. */
function plate(r: number, rim: number, well: number): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 0.05, 28), mat(well));
  base.position.y = 0.03;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, r * 0.07, 6, 28).rotateX(Math.PI / 2), mat(rim));
  ring.position.y = 0.06;
  g.add(base, ring);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// The dishes on the floor. Static: the mark system only places and scales them, so steam and glow are baked in.
// ---------------------------------------------------------------------------------------------------------------

/**
 * Fresh: a cream plate with a brown pie of food, a tomato and leaves on it and three white curls of steam standing over it, a pale
 * ring on the floor. Smaller than a good one. A person reads it as "hot food".
 */
export function freshDishLook(): THREE.Group {
  const g = new THREE.Group();
  g.add(flat(0, 0.62, CHEF.dark, 0.4, 0.004));
  g.add(flat(0.54, 0.64, CHEF.core, 0.85, 0.012));
  const p = plate(0.44, CHEF.whiteShade, CHEF.white);
  g.add(p);
  const food = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1), mat(CHEF.roast));
  food.position.y = 0.07;
  g.add(food);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mat(CHEF.foil));
  top.position.set(0.02, 0.3, 0.03);
  g.add(top);
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6).scale(1.4, 0.5, 1), mat(CHEF.leaf));
    const a = i * 2.1 + 0.5;
    l.position.set(Math.sin(a) * 0.3, 0.1, Math.cos(a) * 0.3);
    g.add(l);
  }
  for (let i = 0; i < 3; i++) {
    const c = curl(0.95, 0.09, i * 2.1, 0.034, CHEF.core, 0.62);
    c.position.set((i - 1) * 0.12, 0.3, (i % 2 ? 0.07 : -0.07));
    g.add(c);
  }
  return g;
}

/**
 * Good: bigger, golden, glowing a little. A gold-rimmed plate with a glazed golden roast on it, a soft gold halo and a gold ring on
 * the floor, four little gold glints floating round it and steam. A person reads it as "the better one, take it".
 */
export function goodDishLook(): THREE.Group {
  const g = new THREE.Group();
  g.add(flat(0, 1.1, CHEF.gold, 0.26, 0.004, true));
  g.add(flat(0, 0.8, CHEF.dark, 0.35, 0.006));
  g.add(flat(0.68, 0.82, CHEF.gold, 0.95, 0.014));
  const p = plate(0.62, CHEF.gold, CHEF.white);
  g.add(p);
  const roast = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1), mat(CHEF.goldDeep));
  roast.position.y = 0.08;
  g.add(roast);
  const glaze = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 0.9), mat(CHEF.gold));
  glaze.position.set(-0.04, 0.2, 0.03);
  g.add(glaze);
  const sheen = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6).scale(1.6, 0.5, 0.8), mat(CHEF.core));
  sheen.position.set(-0.12, 0.43, 0.02);
  sheen.rotation.z = 0.4;
  g.add(sheen);
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6).scale(1.4, 0.5, 1), mat(CHEF.leaf));
    const a = i * 1.6 + 0.2;
    l.position.set(Math.sin(a) * 0.46, 0.1, Math.cos(a) * 0.46);
    g.add(l);
  }
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 2) + 0.7;
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), mat(0xf0d878));
    s.position.set(Math.sin(a) * 0.82, 0.55 + (i % 2) * 0.35, Math.cos(a) * 0.82);
    s.scale.set(0.7, 1.5, 0.7);
    g.add(s);
  }
  for (let i = 0; i < 3; i++) {
    const c = curl(1.2, 0.12, i * 2.1 + 1, 0.04, CHEF.core, 0.6);
    c.position.set((i - 1) * 0.17, 0.42, i % 2 ? 0.1 : -0.1);
    g.add(c);
  }
  return g;
}

/** The burnt dish itself, without floor marks or smoke: a charred plate, black lumps with red embers in them, two small flames. 1 m wide, standing at y 0. */
export function buildBurntPlate(): THREE.Group {
  const g = new THREE.Group();
  g.add(plate(0.44, CHEF.dark, CHEF.char));
  const lumps: [number, number, number, number][] = [[0, 0.12, 0, 0.2], [0.17, 0.1, 0.08, 0.14], [-0.15, 0.1, -0.06, 0.15], [0.02, 0.28, 0.02, 0.13]];
  for (const [x, y, z, r] of lumps) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r), mat(CHEF.black));
    m.position.set(x, y, z);
    m.rotation.set(x * 9, y * 5, z * 7);
    g.add(m);
  }
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    const e = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), mat(CHEF.foil));
    e.position.set(Math.sin(a) * 0.2, 0.16 + (i % 3) * 0.07, Math.cos(a) * 0.2);
    g.add(e);
  }
  for (let i = 0; i < 2; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 6), mat(i ? CHEF.tomato : CHEF.foil));
    f.position.set(i ? 0.1 : -0.08, 0.46, i ? 0.04 : -0.04);
    g.add(f);
  }
  return g;
}

/**
 * Burnt: a charred plate, a heap of black lumps with red embers in them and two small flames, a black scorch on the floor with a red
 * ember ring round it, and two thick columns of dark smoke. A person reads it as "do not touch".
 */
export function burntDishLook(): THREE.Group {
  const g = new THREE.Group();
  g.add(flat(0, 0.85, CHEF.black, 0.6, 0.004));
  g.add(flat(0.62, 0.74, CHEF.foil, 0.9, 0.012));
  g.add(buildBurntPlate());
  for (let i = 0; i < 2; i++) {
    const c = curl(1.35, 0.18, i * 3 + 0.5, 0.075, CHEF.smoke, 0.7);
    c.position.set(i ? 0.1 : -0.1, 0.4, 0);
    g.add(c);
  }
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// The cleaver
// ---------------------------------------------------------------------------------------------------------------

/**
 * Madame Cleaver's cleaver: a broad steel blade with a hole near the spine, a bright edge, a dark outline, and a wooden handle
 * with a red band and two rivets. Lies flat in the xz plane, the tip toward +z, the handle toward -z, about 1.0 m long (`scale` 1),
 * origin at the middle of the blade. Spin it about x to tumble it end over end.
 */
export function buildCleaver(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const shape = (w: number, l: number) => {
    const s = new THREE.Shape();
    s.moveTo(-w, -l);
    s.lineTo(w, -l);
    s.lineTo(w, l * 0.86);
    s.quadraticCurveTo(w, l, w * 0.7, l);
    s.lineTo(-w, l);
    s.lineTo(-w, -l);
    return s;
  };
  const blade = (w: number, l: number, depth: number, color: number, y: number) => {
    const geo = new THREE.ExtrudeGeometry(shape(w, l), { depth, bevelEnabled: false }).rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat(color));
    m.position.y = y + depth / 2;
    return m;
  };
  g.add(blade(0.25, 0.37, 0.09, CHEF.dark, 0));
  const steel = blade(0.2, 0.32, 0.07, CHEF.steel, -0.005);
  g.add(steel);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.075, 0.6), mat(CHEF.core));
  edge.position.set(0.19, 0.0, 0.0);
  g.add(edge);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 14), mat(CHEF.dark));
  hole.position.set(-0.08, 0.0, 0.18);
  g.add(hole);
  const sheen = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 0.46), mat(CHEF.hot));
  sheen.position.set(0.0, -0.002, -0.02);
  g.add(sheen);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), mat(CHEF.dark));
  grip.position.set(0, 0.0, -0.57);
  const wood = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.38), mat(CHEF.wood));
  wood.position.copy(grip.position);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.095, 0.06), mat(CHEF.foil));
  band.position.set(0, 0, -0.45);
  g.add(grip, wood, band);
  for (const z of [-0.6, -0.7]) {
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), mat(CHEF.core));
    r.position.set(0, 0.045, z);
    g.add(r);
  }
  g.scale.setScalar(scale);
  for (const c of g.children) c.frustumCulled = false;
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// The pot
// ---------------------------------------------------------------------------------------------------------------

export const POT_RADIUS = 0.85;
export const POT_HEIGHT = 1.15;

export interface PotParts {
  /** Origin at the middle of the pot's base. */
  group: THREE.Group;
  /** The bubbles on the soup (move them yourself). */
  bubbles: THREE.Mesh[];
  soup: THREE.Mesh;
}

/** A big steel stock pot, a red stripe round it, two black handles, soup the colour of tomatoes up to the brim, a few bubbles. */
export function buildPot(): PotParts {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(POT_RADIUS, POT_RADIUS * 0.92, POT_HEIGHT, 30, 1, true), mat(CHEF.steelShade));
  body.position.y = POT_HEIGHT / 2;
  const base = new THREE.Mesh(new THREE.CircleGeometry(POT_RADIUS * 0.92, 30).rotateX(Math.PI / 2), mat(CHEF.dark));
  base.position.y = 0.01;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(POT_RADIUS * 1.005, POT_RADIUS * 0.94, POT_HEIGHT * 0.3, 30, 1, true), mat(CHEF.dark));
  shade.position.y = POT_HEIGHT * 0.15;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(POT_RADIUS * 1.012, POT_RADIUS * 0.985, 0.2, 30, 1, true), mat(CHEF.foil));
  stripe.position.y = POT_HEIGHT * 0.58;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(POT_RADIUS, 0.06, 8, 30).rotateX(Math.PI / 2), mat(CHEF.steel));
  rim.position.y = POT_HEIGHT;
  const soup = new THREE.Mesh(new THREE.CircleGeometry(POT_RADIUS * 0.97, 30).rotateX(-Math.PI / 2), mat(CHEF.foil));
  soup.position.y = POT_HEIGHT - 0.05;
  const froth = new THREE.Mesh(new THREE.RingGeometry(POT_RADIUS * 0.72, POT_RADIUS * 0.97, 30).rotateX(-Math.PI / 2), mat(CHEF.tomato));
  froth.position.y = POT_HEIGHT - 0.045;
  g.add(body, base, shade, stripe, rim, soup, froth);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 14, Math.PI).rotateZ(s > 0 ? -Math.PI / 2 : Math.PI / 2), mat(CHEF.dark));
    h.position.set(s * (POT_RADIUS + 0.02), POT_HEIGHT * 0.82, 0);
    g.add(h);
  }
  const bubbles: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(i % 2 ? CHEF.tomato : CHEF.core));
    b.visible = false;
    g.add(b);
    bubbles.push(b);
  }
  for (const c of g.children) c.frustumCulled = false;
  return { group: g, bubbles, soup };
}

// ---------------------------------------------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------------------------------------------

export const TABLE_WIDTH = 1.2;
export const TABLE_TOP = 1.0;

export interface TableParts {
  /** Runs along local x, its middle line at z 0, standing on y 0. */
  group: THREE.Group;
  /** The hanging cloth, front and back: `wave` sets their folds. */
  drapes: THREE.Mesh[];
  /** The three covered plates: the dome lifts off (`dome`), the food is under it. */
  plates: { group: THREE.Group; dome: THREE.Group; food: THREE.Group; x: number }[];
  /** `k` 0..1: how far the cloth hangs down, `t`: time for the folds. */
  wave(t: number, amount: number): void;
}

/**
 * A long laid table, `len` m: a cream cloth with a red runner, hanging in folds to just above the floor, three covered silver plates
 * with a golden roast under each, a candle at each end. Eight metres long it reads as a banquet, not a desk.
 */
export function buildTable(len: number): TableParts {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, TABLE_WIDTH), mat(CHEF.white));
  top.position.y = TABLE_TOP;
  const topDark = new THREE.Mesh(new THREE.BoxGeometry(len + 0.14, 0.1, TABLE_WIDTH + 0.14), mat(CHEF.dark));
  topDark.position.y = TABLE_TOP - 0.02;
  const runner = new THREE.Mesh(new THREE.BoxGeometry(len * 0.97, 0.01, 0.2), mat(CHEF.foil));
  runner.position.y = TABLE_TOP + 0.066;
  g.add(topDark, top, runner);
  const drapes: THREE.Mesh[] = [];
  const dh = TABLE_TOP - 0.1;
  for (const s of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(len, dh, 40, 4);
    const m = new THREE.Mesh(geo, mat(CHEF.white));
    m.position.set(0, TABLE_TOP - dh / 2, s * (TABLE_WIDTH / 2 + 0.07));
    m.rotation.y = s > 0 ? 0 : Math.PI;
    m.userData.base = Float32Array.from(geo.attributes.position.array as ArrayLike<number>);
    g.add(m);
    drapes.push(m);
    const hem = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.04), mat(CHEF.foil));
    hem.position.set(0, 0.14, s * (TABLE_WIDTH / 2 + 0.12));
    g.add(hem);
  }
  for (const s of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_WIDTH + 0.14, dh), mat(CHEF.whiteShade));
    end.position.set(s * (len / 2 + 0.07), TABLE_TOP - dh / 2, 0);
    end.rotation.y = Math.PI / 2;
    g.add(end);
    const cx = s * (len / 2 - 0.5);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 8), mat(CHEF.core));
    candle.position.set(cx, TABLE_TOP + 0.23, 0);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), mat(0xf0b050));
    flame.position.set(cx, TABLE_TOP + 0.5, 0);
    g.add(candle, flame);
  }
  const plates: TableParts['plates'] = [];
  for (const x of [-len * 0.3, 0, len * 0.3]) {
    const pg = new THREE.Group();
    pg.position.set(x, TABLE_TOP + 0.06, 0);
    pg.add(plate(0.46, CHEF.steel, CHEF.white));
    const food = new THREE.Group();
    const roast = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1), mat(CHEF.goldDeep));
    roast.position.y = 0.07;
    const glaze = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(CHEF.gold));
    glaze.position.set(-0.03, 0.2, 0.02);
    food.add(roast, glaze);
    const dome = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1), mat(CHEF.steel));
    shell.position.y = 0.05;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(CHEF.steelShade));
    knob.position.y = 0.45;
    const gleam = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6).scale(1.6, 0.5, 0.8), mat(CHEF.core));
    gleam.position.set(-0.17, 0.28, 0.12);
    gleam.rotation.z = 0.7;
    dome.add(shell, knob, gleam);
    pg.add(food, dome);
    g.add(pg);
    plates.push({ group: pg, dome, food, x });
  }
  for (const c of g.children) c.frustumCulled = false;
  const wave = (t: number, amount: number) => {
    for (const d of drapes) {
      const pos = d.geometry.attributes.position as THREE.BufferAttribute;
      const base = d.userData.base as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        const low = 1 - (y / dh + 0.5); // 0 at the top, 1 at the hem
        pos.setZ(i, Math.sin(x * 2.6 + t * 5) * 0.05 * (1 + amount * 3) * low + Math.sin(x * 7 + t * 8) * 0.02 * amount * low);
      }
      pos.needsUpdate = true;
    }
  };
  wave(0, 0);
  return { group: g, drapes, plates, wave };
}

// ---------------------------------------------------------------------------------------------------------------
// Vapour: steam and smoke puffs
// ---------------------------------------------------------------------------------------------------------------

interface Puff { m: THREE.Mesh; v: THREE.Vector3; age: number; life: number; size: number; grow: number }

/** Pooled puffs that rise, swell and fade: steam (pale) or smoke (dark). `burst(at, n, color, ...)`. */
export class Vapour {
  readonly mesh = new THREE.Group();
  private items: Puff[] = [];
  private next = 0;

  constructor(count: number) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: CHEF.core, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      m.frustumCulled = false;
      this.mesh.add(m);
      this.items.push({ m, v: new THREE.Vector3(), age: 9, life: 1, size: 1, grow: 1 });
    }
  }

  get busy() {
    return this.items.some((p) => p.age < p.life);
  }

  /** `n` puffs round `at`: rising at about `up` m/s, drifting `spread` m/s sideways, `size` m wide, `life` s. */
  burst(at: THREE.Vector3, n: number, color: number, up = 1.6, spread = 1, size = 0.45, life = 1.1) {
    for (let i = 0; i < n; i++) {
      const p = this.items[this.next++ % this.items.length];
      const a = Math.random() * Math.PI * 2, s = spread * Math.random();
      p.v.set(Math.cos(a) * s, up * (0.6 + Math.random() * 0.8), Math.sin(a) * s);
      p.m.position.set(at.x + (Math.random() - 0.5) * 0.3, at.y + Math.random() * 0.2, at.z + (Math.random() - 0.5) * 0.3);
      p.age = 0;
      p.life = life * (0.75 + Math.random() * 0.5);
      p.size = size * (0.7 + Math.random() * 0.6);
      p.grow = 0.9 + Math.random() * 0.8;
      (p.m.material as THREE.MeshBasicMaterial).color.setHex(color);
      p.m.visible = true;
    }
  }

  update(dt: number) {
    for (const p of this.items) {
      if (p.age >= p.life) continue;
      p.age += dt;
      if (p.age >= p.life) { p.m.visible = false; continue; }
      const k = p.age / p.life;
      p.m.position.addScaledVector(p.v, dt);
      p.v.multiplyScalar(Math.exp(-dt * 1.2));
      p.m.scale.setScalar(Math.max(MIN, p.size * (0.4 + k * p.grow)));
      (p.m.material as THREE.MeshBasicMaterial).opacity = 0.7 * Math.min(1, k * 8) * (1 - k);
    }
  }

  reset() {
    for (const p of this.items) { p.age = 9; p.m.visible = false; }
    this.next = 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Chunks: bits thrown in an arc
// ---------------------------------------------------------------------------------------------------------------

interface Chunk { m: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; age: number; life: number; size: number }

/** Pooled small bits (soup drops, crumbs, splinters, sparks) that fly in an arc, land and shrink away. */
export class Chunks {
  readonly mesh = new THREE.Group();
  private items: Chunk[] = [];
  private next = 0;

  constructor(count: number) {
    const geo = new THREE.OctahedronGeometry(1, 0);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: CHEF.foil, side: THREE.DoubleSide }));
      m.visible = false;
      m.frustumCulled = false;
      this.mesh.add(m);
      this.items.push({ m, v: new THREE.Vector3(), spin: new THREE.Vector3(), age: 9, life: 1, size: 0.1 });
    }
  }

  get busy() {
    return this.items.some((c) => c.age < c.life);
  }

  /** `n` bits from `at`, thrown outward at about `speed` and up at about `up` m/s, coloured from `colors`, `size` m. */
  burst(at: THREE.Vector3, n: number, colors: readonly number[], speed = 4, up = 4, size = 0.1) {
    for (let i = 0; i < n; i++) {
      const c = this.items[this.next++ % this.items.length];
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      c.v.set(Math.cos(a) * s, up * (0.5 + Math.random() * 0.9), Math.sin(a) * s);
      c.spin.set(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6);
      c.m.position.copy(at);
      c.age = 0;
      c.life = 0.9 + Math.random() * 0.7;
      c.size = size * (0.6 + Math.random() * 0.8);
      (c.m.material as THREE.MeshBasicMaterial).color.setHex(colors[i % colors.length]);
      c.m.visible = true;
    }
  }

  update(dt: number) {
    for (const c of this.items) {
      if (c.age >= c.life) continue;
      c.age += dt;
      if (c.age >= c.life) { c.m.visible = false; continue; }
      c.v.y -= 14 * dt;
      c.m.position.addScaledVector(c.v, dt);
      if (c.m.position.y < 0.06) { c.m.position.y = 0.06; c.v.set(c.v.x * 0.3, 0, c.v.z * 0.3); }
      c.m.rotation.x += c.spin.x * dt;
      c.m.rotation.y += c.spin.y * dt;
      const k = c.age / c.life;
      c.m.scale.setScalar(Math.max(MIN, c.size * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3)));
    }
  }

  reset() {
    for (const c of this.items) { c.age = 9; c.m.visible = false; }
    this.next = 0;
  }
}
