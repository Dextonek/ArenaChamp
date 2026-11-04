import type { HeroKit } from '../heroes';

/**
 * Void kit data: Oblivion, the Unmaker (a melee juggernaut who drags enemies in and silences them). Four spells (labels as
 * registered), canvas-drawn icons in the kit's palette: charcoal ground with faint ash cracks, jagged black slits with a
 * pink edge on one side and a cyan fringe on the other, ash-rimmed shards. Signature shape: the tear in the world.
 */
const V = { core: '#ffffff', hot: '#ffc4d4', body: '#ff2a55', accent: '#7affff', dark: '#000000', ash: '#d8d4e0' };
const PI = Math.PI;
const hsh = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#34323a');
  r.addColorStop(1, '#0e0d11');
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
  // Faint ash hairline cracks across the ground.
  g.strokeStyle = V.ash;
  g.globalAlpha = 0.12;
  g.lineWidth = Math.max(1, s * 0.008);
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    let x = hsh(i * 3.1) * s, y = hsh(i * 5.7) * s;
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (hsh(i * 7 + k) - 0.4) * s * 0.22;
      y += (hsh(i * 11 + k) - 0.4) * s * 0.22;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** Fills the band between polyline `a` and polyline `b`. */
function band(g: CanvasRenderingContext2D, a: [number, number][], b: [number, number][], color: string) {
  g.beginPath();
  a.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  for (let i = b.length - 1; i >= 0; i--) g.lineTo(b[i][0], b[i][1]);
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

/**
 * A torn slit along the polyline `pts`, `w` wide in the middle: a cyan fringe on one side, a hot pink edge on the other,
 * a pure black jagged cut between them. The widths wander and the outlines jag.
 */
function slit(g: CanvasRenderingContext2D, pts: [number, number][], w: number, seed = 1) {
  const n = pts.length;
  const L: [number, number][] = [], R: [number, number][] = [], C: [number, number][] = [], P: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const nx = -ty, ny = tx;
    const u = n > 1 ? i / (n - 1) : 0.5;
    const tap = Math.pow(Math.max(Math.sin(PI * u), 0.02), 0.6) * w * 0.5;
    const jl = 0.7 + 0.6 * hsh(i * 3.1 + seed), jr = 0.7 + 0.6 * hsh(i * 5.3 + seed + 4);
    const cw = w * 0.2 * (0.4 + 0.6 * tap / (w * 0.5)) * (i % 3 === 0 ? 1.4 : 0.8);
    const pw = w * 0.34 * (0.4 + 0.6 * tap / (w * 0.5)) * (i % 2 ? 1.3 : 0.8);
    const [x, y] = pts[i];
    L.push([x - nx * tap * jl, y - ny * tap * jl]);
    R.push([x + nx * tap * jr, y + ny * tap * jr]);
    C.push([x - nx * (tap * jl + cw), y - ny * (tap * jl + cw)]);
    P.push([x + nx * (tap * jr + pw), y + ny * (tap * jr + pw)]);
  }
  band(g, C, R, V.accent);
  band(g, L, P, V.body);
  // A hot line along the pink outer edge.
  g.strokeStyle = V.hot;
  g.lineWidth = Math.max(1, w * 0.06);
  g.beginPath();
  P.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.stroke();
  band(g, L, R, V.dark);
}

/** A straight-ish slit between two points with a few jittered middle points. */
function slitLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, seed = 1) {
  const pts: [number, number][] = [];
  const n = 8;
  const nx = -(y1 - y0), ny = x1 - x0;
  const l = Math.hypot(nx, ny) || 1;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), j = (hsh(i * 2.7 + seed) - 0.5) * 0.04;
    pts.push([x0 + (x1 - x0) * u + (nx / l) * j * l, y0 + (y1 - y0) * u + (ny / l) * j * l]);
  }
  slit(g, pts, w, seed);
}

/** A slit along an arc of radius `r` round (cx, cy) from a0 to a1. */
function slitArc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, a0: number, a1: number, w: number, seed = 1) {
  const pts: [number, number][] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i / (n - 1));
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  slit(g, pts, w, seed);
}

/** A world shard: a dark grey irregular flake with a pale ash rim. */
function shard(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0, seed = 1) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * PI * 2, rr = r * (0.55 + 0.45 * hsh(i * 1.9 + seed));
    pts.push([x + Math.cos(a) * rr * 1.1, y + Math.sin(a) * rr * 0.8]);
  }
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
  g.fillStyle = '#34323a';
  g.fill();
  g.strokeStyle = V.ash;
  g.lineWidth = Math.max(1, r * 0.22);
  g.lineJoin = 'round';
  g.stroke();
}

/** Glass-like cracks radiating from (cx, cy): black with a pink edge. */
function cracks(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, n: number, w: number, seed = 1) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + (hsh(i * 2.3 + seed) - 0.5) * 0.5;
    const len = 0.6 + 0.4 * hsh(i * 4.1 + seed);
    const pts: [number, number][] = [];
    let aa = a;
    for (let k = 0; k <= 5; k++) {
      aa += (hsh(i * 9 + k + seed) - 0.5) * 0.2;
      pts.push([cx + Math.cos(aa) * rx * len * (k / 5), cy + Math.sin(aa) * ry * len * (k / 5)]);
    }
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = V.body;
    g.lineWidth = w * 2.4;
    g.beginPath();
    pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.stroke();
    g.strokeStyle = V.dark;
    g.lineWidth = w;
    g.stroke();
  }
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = V.accent;
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2, rr = i % 2 ? r * 0.42 : r;
    if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.fillStyle = V.core;
  g.beginPath();
  g.arc(x, y, r * 0.28, 0, PI * 2);
  g.fill();
}

function mote(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = V.ash;
  g.beginPath();
  g.moveTo(x, y - r * 1.6);
  g.lineTo(x + r, y);
  g.lineTo(x, y + r * 1.6);
  g.lineTo(x - r, y);
  g.closePath();
  g.fill();
}

/** A jagged greatsword blade (a tear of void) from the hilt at (x0, y0) to the tip at (x1, y1). */
function blade(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number) {
  const l = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / l, ny = (x1 - x0) / l;
  const L: [number, number][] = [], R: [number, number][] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
    const hw = w * 0.5 * (u < 0.85 ? 1 - 0.25 * u : (1 - u) / 0.15 * 0.8);
    const jl = i % 2 ? 1.18 : 0.88, jr = i % 2 ? 0.9 : 1.15;
    L.push([x - nx * hw * jl, y - ny * hw * jl]);
    R.push([x + nx * hw * jr, y + ny * hw * jr]);
  }
  band(g, L, R, V.dark);
  g.strokeStyle = V.body;
  g.lineWidth = Math.max(1, w * 0.14);
  g.lineJoin = 'round';
  g.beginPath();
  R.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.stroke();
  g.strokeStyle = V.accent;
  g.lineWidth = Math.max(1, w * 0.08);
  g.beginPath();
  L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.stroke();
}

export const voidKit: HeroKit = {
  name: 'Oblivion',
  title: 'the Unmaker',
  accent: V.body,
  foil: V.ash,
  maxHp: 780,
  melee: true,
  portrait(g, s) {
    iconGround(g, s);
    // A tear behind him: a tall slit with a pink edge and a cyan fringe, and shards in the air.
    slitLine(g, s * 0.82, s * 0.02, s * 0.74, s * 0.62, s * 0.1, 2);
    slitLine(g, s * 0.14, s * 0.1, s * 0.2, s * 0.5, s * 0.06, 5);
    shard(g, s * 0.9, s * 0.34, s * 0.04, 0.4, 3);
    shard(g, s * 0.08, s * 0.64, s * 0.035, 1.1, 8);
    shard(g, s * 0.66, s * 0.1, s * 0.03, 2.0, 4);
    // The ragged cloak: a wide dark mass whose hem breaks up into floating black shards.
    g.fillStyle = '#0a090c';
    g.beginPath();
    g.moveTo(0, s);
    g.lineTo(s * 0.02, s * 0.74);
    g.quadraticCurveTo(s * 0.12, s * 0.58, s * 0.3, s * 0.54);
    g.lineTo(s * 0.7, s * 0.54);
    g.quadraticCurveTo(s * 0.88, s * 0.58, s * 0.98, s * 0.74);
    g.lineTo(s, s);
    g.closePath();
    g.fill();
    g.strokeStyle = V.ash;
    g.globalAlpha = 0.5;
    g.lineWidth = s * 0.008;
    g.stroke();
    g.globalAlpha = 1;
    for (let i = 0; i < 6; i++) shard(g, s * (0.1 + 0.16 * i), s * (0.92 + 0.04 * hsh(i * 3)), s * 0.035, i, i + 2);
    // Black plate: broad pauldrons and a chest, cracked with glowing pink rifts.
    g.fillStyle = '#17151b';
    g.beginPath();
    g.moveTo(s * 0.1, s);
    g.lineTo(s * 0.12, s * 0.7);
    g.lineTo(s * 0.3, s * 0.6);
    g.lineTo(s * 0.7, s * 0.6);
    g.lineTo(s * 0.88, s * 0.7);
    g.lineTo(s * 0.9, s);
    g.closePath();
    g.fill();
    g.strokeStyle = V.ash;
    g.lineWidth = s * 0.012;
    g.lineJoin = 'miter';
    g.stroke();
    for (const sd of [-1, 1]) {
      // A spiked pauldron.
      const px = s * (0.5 + sd * 0.33);
      g.fillStyle = '#1d1b22';
      g.beginPath();
      g.moveTo(px - sd * s * 0.17, s * 0.66);
      g.lineTo(px - sd * s * 0.06, s * 0.56);
      g.lineTo(px + sd * s * 0.1, s * 0.5);
      g.lineTo(px + sd * s * 0.14, s * 0.64);
      g.lineTo(px + sd * s * 0.06, s * 0.78);
      g.lineTo(px - sd * s * 0.14, s * 0.76);
      g.closePath();
      g.fill();
      g.stroke();
    }
    cracks(g, s * 0.5, s * 0.82, s * 0.18, s * 0.14, 6, s * 0.012, 3);
    slitLine(g, s * 0.2, s * 0.64, s * 0.3, s * 0.82, s * 0.03, 9);
    slitLine(g, s * 0.8, s * 0.66, s * 0.72, s * 0.9, s * 0.03, 12);
    // The horned featureless helm with one rift slit for a visor.
    g.fillStyle = '#0c0b0f';
    g.beginPath();
    g.moveTo(s * 0.33, s * 0.58);
    g.lineTo(s * 0.32, s * 0.3);
    g.quadraticCurveTo(s * 0.34, s * 0.14, s * 0.5, s * 0.12);
    g.quadraticCurveTo(s * 0.66, s * 0.14, s * 0.68, s * 0.3);
    g.lineTo(s * 0.67, s * 0.58);
    g.lineTo(s * 0.5, s * 0.64);
    g.closePath();
    g.fill();
    g.strokeStyle = V.ash;
    g.lineWidth = s * 0.014;
    g.stroke();
    for (const sd of [-1, 1]) {
      g.fillStyle = '#0c0b0f';
      g.beginPath();
      g.moveTo(s * (0.5 + sd * 0.16), s * 0.24);
      g.quadraticCurveTo(s * (0.5 + sd * 0.3), s * 0.2, s * (0.5 + sd * 0.27), s * 0.02);
      g.quadraticCurveTo(s * (0.5 + sd * 0.2), s * 0.14, s * (0.5 + sd * 0.14), s * 0.14);
      g.closePath();
      g.fill();
      g.stroke();
    }
    slitLine(g, s * 0.37, s * 0.36, s * 0.63, s * 0.34, s * 0.07, 6);
    // The greatsword: a jagged tear of void held up at the right.
    blade(g, s * 0.9, s * 0.96, s * 0.84, s * 0.1, s * 0.07);
    g.fillStyle = V.ash;
    g.fillRect(s * 0.86, s * 0.88, s * 0.1, s * 0.022);
    mote(g, s * 0.2, s * 0.3, s * 0.014);
    mote(g, s * 0.78, s * 0.42, s * 0.012);
  },
  spells: [
    {
      key: 'Q', label: 'gravity slam', name: 'Gravity Slam', range: 3, cooldown: 4,
      blurb: 'He slams the ground: 50 within 3 m, and enemies there are dragged 1.5 m toward him.',
      icon(g, s) {
        iconGround(g, s);
        // Glass cracks racing out from a blade driven into the ground, shards pulled in toward it.
        cracks(g, s * 0.5, s * 0.7, s * 0.46, s * 0.26, 10, s * 0.014, 5);
        blade(g, s * 0.5, s * 0.02, s * 0.5, s * 0.68, s * 0.12);
        shard(g, s * 0.16, s * 0.6, s * 0.04, 0.5, 2);
        shard(g, s * 0.84, s * 0.56, s * 0.045, 1.6, 4);
        shard(g, s * 0.28, s * 0.86, s * 0.035, 2.4, 7);
        shard(g, s * 0.74, s * 0.88, s * 0.035, 0.9, 9);
        mote(g, s * 0.2, s * 0.3, s * 0.016);
        mote(g, s * 0.82, s * 0.28, s * 0.014);
        star(g, s * 0.5, s * 0.7, s * 0.07);
      },
    },
    {
      key: 'W', label: 'null zone', name: 'Null Zone', range: 0, cooldown: 12, cc: true,
      blurb: 'A 3 m sphere of void stays where he cast it for 3 s. Enemies inside cannot cast, and bolts that enter it vanish.',
      icon(g, s) {
        iconGround(g, s);
        // A dome of void: an ash rim on the ground, a torn black arc over it, silenced motes inside.
        const cx = s * 0.5, cy = s * 0.62;
        g.fillStyle = '#050407';
        g.beginPath();
        g.ellipse(cx, cy, s * 0.42, s * 0.3, 0, PI, PI * 2);
        g.lineTo(cx + s * 0.42, cy);
        g.ellipse(cx, cy, s * 0.42, s * 0.12, 0, 0, PI);
        g.closePath();
        g.fill();
        g.strokeStyle = V.ash;
        g.globalAlpha = 0.7;
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(cx, cy, s * 0.42, s * 0.12, 0, 0, PI * 2);
        g.stroke();
        g.globalAlpha = 1;
        slitArc(g, cx, cy, s * 0.4, PI * 1.05, PI * 1.95, s * 0.09, 3);
        cracks(g, cx, cy + s * 0.04, s * 0.36, s * 0.08, 6, s * 0.01, 8);
        shard(g, s * 0.4, s * 0.5, s * 0.035, 0.6, 3);
        shard(g, s * 0.62, s * 0.56, s * 0.03, 1.8, 6);
        // A bar across a bolt: nothing gets through.
        g.strokeStyle = V.accent;
        g.lineWidth = s * 0.018;
        g.beginPath();
        g.moveTo(s * 0.12, s * 0.12);
        g.lineTo(s * 0.34, s * 0.28);
        g.stroke();
        mote(g, s * 0.86, s * 0.22, s * 0.014);
        star(g, cx, s * 0.52, s * 0.045);
      },
    },
    {
      key: 'E', label: 'phase step', name: 'Phase Step', range: 4, cooldown: 14, dash: true,
      blurb: 'He marks a spot within 4 m, then steps through the void to it 0.25 s later. His next basic attack within 3 s rips for +40 and weakens the enemy 20% for 2 s.',
      icon(g, s) {
        iconGround(g, s);
        // Two standing slits and a torn path between them, the far one with a star; a fist of void.
        slitLine(g, s * 0.2, s * 0.22, s * 0.22, s * 0.84, s * 0.1, 3);
        slitLine(g, s * 0.8, s * 0.2, s * 0.78, s * 0.8, s * 0.12, 7);
        g.setLineDash([s * 0.04, s * 0.035]);
        g.strokeStyle = V.ash;
        g.lineWidth = s * 0.016;
        g.beginPath();
        g.moveTo(s * 0.3, s * 0.5);
        g.lineTo(s * 0.7, s * 0.5);
        g.stroke();
        g.setLineDash([]);
        shard(g, s * 0.42, s * 0.34, s * 0.035, 0.7, 2);
        shard(g, s * 0.56, s * 0.7, s * 0.04, 1.9, 5);
        shard(g, s * 0.5, s * 0.5, s * 0.03, 2.8, 8);
        mote(g, s * 0.14, s * 0.1, s * 0.014);
        mote(g, s * 0.9, s * 0.9, s * 0.014);
        star(g, s * 0.78, s * 0.5, s * 0.06);
      },
    },
    {
      key: 'R', label: 'void black hole', name: 'Black Hole', range: 8, cooldown: 24, cc: true, aim: 'line',
      blurb: 'A black hole crawls 8 m down his aim for 4 s, pulling enemies within 5 m. Touching its core deals 90 and stuns 1 s, once. Recast: it collapses at once for 70 within 3 m, after a 0.5 s warning.',
      icon(g, s) {
        iconGround(g, s);
        // A black core inside a pink ring and a cyan fringe, torn slits spiralling in, shards pulled along.
        const cx = s * 0.5, cy = s * 0.52;
        g.fillStyle = '#0a090c';
        g.beginPath();
        g.ellipse(cx, cy, s * 0.46, s * 0.36, 0, 0, PI * 2);
        g.fill();
        g.strokeStyle = V.ash;
        g.globalAlpha = 0.6;
        g.lineWidth = s * 0.012;
        g.stroke();
        g.globalAlpha = 1;
        slitArc(g, cx, cy, s * 0.36, PI * 0.1, PI * 0.95, s * 0.08, 2);
        slitArc(g, cx, cy, s * 0.36, PI * 1.1, PI * 1.95, s * 0.08, 6);
        slitArc(g, cx, cy, s * 0.2, PI * 0.5, PI * 1.5, s * 0.06, 9);
        g.fillStyle = V.dark;
        g.beginPath();
        g.ellipse(cx, cy, s * 0.13, s * 0.11, 0, 0, PI * 2);
        g.fill();
        g.strokeStyle = V.accent;
        g.lineWidth = s * 0.02;
        g.stroke();
        shard(g, s * 0.14, s * 0.3, s * 0.04, 0.5, 2);
        shard(g, s * 0.86, s * 0.72, s * 0.04, 1.5, 4);
        shard(g, s * 0.7, s * 0.2, s * 0.03, 2.2, 6);
        mote(g, s * 0.1, s * 0.8, s * 0.014);
        mote(g, s * 0.9, s * 0.18, s * 0.014);
        star(g, cx, cy, s * 0.035);
      },
    },
  ],
};
