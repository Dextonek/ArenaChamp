import type { HeroKit } from '../heroes';

/**
 * Grove kit data (Fenna, the Grove Warden): dark forest-green ground, pale bark foil, leaf-green spiral vines with
 * pink-and-cream flowers. Icons are drawn on canvases in the kit palette, one signature shape each: the spiral vine
 * that blooms (v5 kit: Seed Shot, Strangle Vine, Pollen Glide, World Tree; see pipeline/designs/kit-grove.md).
 */
const G = { core: '#fffbe0', hot: '#ffe36a', body: '#4caf50', accent: '#ff7ab8', dark: '#14260f', bark: '#e8dcc0', leafDark: '#2f7a35', pinkDark: '#c4487f' };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.75);
  r.addColorStop(0, '#1f3d17');
  r.addColorStop(1, G.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

type Pt = [number, number];

/** A thick vine along a list of points: dark outline, green body, a lit top line. */
function vine(g: CanvasRenderingContext2D, pts: Pt[], w: number) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const pass = (col: string, lw: number, dy: number) => {
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y + dy) : g.lineTo(x, y + dy)));
    g.stroke();
  };
  pass(G.dark, w * 1.35, w * 0.08);
  pass(G.body, w, 0);
  pass('#8fdc7c', w * 0.3, -w * 0.22);
}

/** Points of a spiral stem rising from (x0, y0) to height h with `coils` turns and the given radius. */
function spiral(x0: number, y0: number, h: number, r: number, coils: number, phase = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const u = i / 48;
    out.push([x0 + Math.sin(phase + u * coils * Math.PI * 2) * r * Math.min(1, u * 4), y0 - h * u]);
  }
  return out;
}

/** A leaf: a pointed ellipse from (x, y) at angle `a`, `len` long, two-tone. */
function leaf(g: CanvasRenderingContext2D, x: number, y: number, a: number, len: number) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, -len * 0.34, len, 0);
  g.quadraticCurveTo(len * 0.5, len * 0.3, 0, 0);
  g.fillStyle = G.body;
  g.fill();
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, len * 0.3, len, 0);
  g.lineTo(0, 0);
  g.fillStyle = G.leafDark;
  g.fill();
  g.strokeStyle = G.dark;
  g.lineWidth = Math.max(1, len * 0.08);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, -len * 0.34, len, 0);
  g.quadraticCurveTo(len * 0.5, len * 0.3, 0, 0);
  g.stroke();
  g.restore();
}

/** A flower seen from the side as a cup: petals fan out from (x, y), cream inside, pink rim, a gold core. */
function flower(g: CanvasRenderingContext2D, x: number, y: number, size: number, tilt = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  const angles = [-0.95, -0.55, -0.18, 0.18, 0.55, 0.95];
  // Back petals first, the middle ones last.
  const order = [0, 5, 1, 4, 2, 3];
  for (const k of order) {
    const a = angles[k];
    g.save();
    g.rotate(a);
    const L = size * (1 - Math.abs(a) * 0.2);
    const W = size * 0.34;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-W, -L * 0.45, 0, -L);
    g.quadraticCurveTo(W, -L * 0.45, 0, 0);
    g.fillStyle = Math.abs(a) > 0.5 ? '#f3e9cf' : G.bark;
    g.fill();
    g.strokeStyle = G.accent;
    g.lineWidth = Math.max(1.5, size * 0.09);
    g.stroke();
    g.strokeStyle = G.pinkDark;
    g.lineWidth = Math.max(1, size * 0.04);
    g.beginPath(); g.moveTo(0, -L * 0.15); g.lineTo(0, -L * 0.7); g.stroke();
    g.restore();
  }
  g.fillStyle = G.hot;
  g.beginPath(); g.ellipse(0, -size * 0.1, size * 0.2, size * 0.1, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = G.dark;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-size * 0.1 + i * size * 0.07, -size * 0.1 + (i % 2) * size * 0.03, size * 0.018, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/** Loose petals / pollen. */
function motes(g: CanvasRenderingContext2D, pts: number[][], r: number) {
  for (const [x, y, k] of pts) {
    g.fillStyle = k ? G.hot : G.accent;
    g.beginPath(); g.arc(x, y, r * (k ? 0.8 : 1.1), 0, Math.PI * 2); g.fill();
  }
}

/** A ground ring of roots (ellipse) with small leaf ticks. */
function rootRing(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, lw: number) {
  g.strokeStyle = G.dark;
  g.lineWidth = lw * 1.5;
  g.beginPath(); g.ellipse(cx, cy + lw * 0.2, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = G.body;
  g.lineWidth = lw;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = G.bark;
  g.lineWidth = Math.max(1, lw * 0.22);
  g.setLineDash([lw * 1.3, lw * 1.1]);
  g.beginPath(); g.ellipse(cx, cy - lw * 0.1, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
}

export const groveKit: HeroKit = {
  name: 'Fenna',
  title: 'the Grove Warden',
  accent: G.body,
  foil: G.bark,
  maxHp: 600,
  portrait(g, s) {
    ground(g, s);
    // A living staff behind her on the right, topped by a bloom.
    vine(g, spiral(s * 0.86, s, s * 0.78, s * 0.025, 4, 0.5), s * 0.035);
    flower(g, s * 0.86, s * 0.22, s * 0.11, 0.15);
    // Cloak of layered leaves, a pale bark collar.
    g.fillStyle = G.leafDark;
    g.beginPath();
    g.moveTo(s * 0.06, s); g.lineTo(s * 0.14, s * 0.72); g.lineTo(s * 0.36, s * 0.62); g.lineTo(s * 0.64, s * 0.62); g.lineTo(s * 0.86, s * 0.72); g.lineTo(s * 0.94, s);
    g.closePath(); g.fill();
    for (let i = 0; i < 6; i++) leaf(g, s * (0.2 + i * 0.12), s * 0.97, -Math.PI / 2 + (i - 2.5) * 0.18, s * 0.26);
    g.strokeStyle = G.bark;
    g.lineWidth = s * 0.04;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(s * 0.36, s * 0.64); g.quadraticCurveTo(s * 0.5, s * 0.74, s * 0.64, s * 0.64); g.stroke();
    // Antler-like branches in her hair, with leaves and a pink bloom.
    g.strokeStyle = G.dark;
    g.lineWidth = s * 0.05;
    const branch = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x1, y1, x2, y2); g.stroke(); };
    branch(s * 0.38, s * 0.3, s * 0.28, s * 0.14, s * 0.2, s * 0.06);
    branch(s * 0.62, s * 0.3, s * 0.72, s * 0.14, s * 0.8, s * 0.06);
    branch(s * 0.3, s * 0.2, s * 0.2, s * 0.2, s * 0.12, s * 0.14);
    branch(s * 0.7, s * 0.2, s * 0.8, s * 0.2, s * 0.88, s * 0.14);
    g.strokeStyle = '#7a5a34';
    g.lineWidth = s * 0.028;
    branch(s * 0.38, s * 0.3, s * 0.28, s * 0.14, s * 0.2, s * 0.06);
    branch(s * 0.62, s * 0.3, s * 0.72, s * 0.14, s * 0.8, s * 0.06);
    branch(s * 0.3, s * 0.2, s * 0.2, s * 0.2, s * 0.12, s * 0.14);
    branch(s * 0.7, s * 0.2, s * 0.8, s * 0.2, s * 0.88, s * 0.14);
    leaf(g, s * 0.22, s * 0.08, -2.6, s * 0.1);
    leaf(g, s * 0.8, s * 0.08, -0.5, s * 0.1);
    leaf(g, s * 0.14, s * 0.15, 2.6, s * 0.08);
    leaf(g, s * 0.86, s * 0.15, 0.5, s * 0.08);
    // Long dark hair framing the face, the face, a leaf-green eye line.
    g.fillStyle = '#1d3a14';
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.64); g.lineTo(s * 0.3, s * 0.32); g.quadraticCurveTo(s * 0.5, s * 0.16, s * 0.7, s * 0.32); g.lineTo(s * 0.7, s * 0.64);
    g.lineTo(s * 0.62, s * 0.6); g.lineTo(s * 0.38, s * 0.6);
    g.closePath(); g.fill();
    g.fillStyle = '#d9a67a';
    g.beginPath();
    g.moveTo(s * 0.38, s * 0.34); g.quadraticCurveTo(s * 0.5, s * 0.28, s * 0.62, s * 0.34); g.lineTo(s * 0.6, s * 0.52); g.quadraticCurveTo(s * 0.5, s * 0.62, s * 0.4, s * 0.52);
    g.closePath(); g.fill();
    g.fillStyle = G.dark;
    g.fillRect(s * 0.41, s * 0.42, s * 0.06, s * 0.022);
    g.fillRect(s * 0.53, s * 0.42, s * 0.06, s * 0.022);
    g.fillStyle = G.body;
    g.fillRect(s * 0.425, s * 0.425, s * 0.025, s * 0.014);
    g.fillRect(s * 0.555, s * 0.425, s * 0.025, s * 0.014);
    g.fillStyle = G.accent;
    g.beginPath(); g.arc(s * 0.5, s * 0.535, s * 0.015, 0, Math.PI * 2); g.fill();
    flower(g, s * 0.36, s * 0.32, s * 0.07, -0.5);
    motes(g, [[s * 0.18, s * 0.42, 1], [s * 0.12, s * 0.52, 0], [s * 0.24, s * 0.56, 1], [s * 0.08, s * 0.34, 0]], s * 0.012);
  },
  spells: [
    {
      key: 'Q', label: 'seed shot', name: 'Seed Shot', range: 9, cooldown: 4, aim: 'line',
      blurb: 'A seed flies 9 m (0.25 s wind-up): 50 damage. A flower grows where it stops, on the enemy or at the end of its flight.',
      icon(g, s) {
        ground(g, s);
        // The flower that grows where the seed stops, on a root ring in the lower right.
        rootRing(g, s * 0.74, s * 0.84, s * 0.2, s * 0.06, s * 0.03);
        flower(g, s * 0.74, s * 0.82, s * 0.28, 0.1);
        // The seed's trail: a spiral vine from the upper left, ending at the seed.
        const pts: Pt[] = [];
        for (let i = 0; i <= 40; i++) {
          const u = i / 40;
          pts.push([s * (0.06 + 0.4 * u), s * (0.18 + 0.28 * u) + Math.sin(u * 4 * Math.PI) * s * 0.05 * u]);
        }
        vine(g, pts, s * 0.045);
        leaf(g, s * 0.2, s * 0.3, -1.9, s * 0.1);
        leaf(g, s * 0.32, s * 0.4, 2.0, s * 0.1);
        // The seed itself: a pale oval ringed in dark, a pink bud cap on its front, a leaf pair at its back.
        g.save();
        g.translate(s * 0.52, s * 0.5);
        g.rotate(0.62);
        leaf(g, -s * 0.12, 0, -2.6, s * 0.13);
        leaf(g, -s * 0.12, 0, 2.6, s * 0.13);
        g.fillStyle = G.dark;
        g.beginPath(); g.ellipse(0, 0, s * 0.19, s * 0.125, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = G.bark;
        g.beginPath(); g.ellipse(0, 0, s * 0.165, s * 0.1, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = G.accent;
        g.beginPath(); g.moveTo(s * 0.03, -s * 0.095); g.quadraticCurveTo(s * 0.2, -s * 0.06, s * 0.16, 0); g.quadraticCurveTo(s * 0.2, s * 0.06, s * 0.03, s * 0.095); g.quadraticCurveTo(s * 0.09, 0, s * 0.03, -s * 0.095); g.fill();
        g.fillStyle = '#fff';
        g.globalAlpha = 0.7;
        g.beginPath(); g.ellipse(-s * 0.04, -s * 0.04, s * 0.07, s * 0.02, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
        g.restore();
        motes(g, [[s * 0.1, s * 0.5, 1], [s * 0.2, s * 0.62, 0], [s * 0.5, s * 0.22, 1], [s * 0.86, s * 0.5, 0], [s * 0.9, s * 0.3, 1]], s * 0.016);
      },
    },
    {
      key: 'W', label: 'strangle vine', name: 'Strangle Vine', range: 7, cooldown: 11, cc: true,
      blurb: 'Vines (7 m, needs sight) coil round one enemy: 30 damage and rooted 1.0 s, or 1.4 s within 3 m of a flower.',
      icon(g, s) {
        ground(g, s);
        const cx = s * 0.5;
        rootRing(g, cx, s * 0.88, s * 0.4, s * 0.1, s * 0.04);
        // A pale figure the vines grip: head, shoulders, body.
        g.fillStyle = G.dark;
        g.beginPath(); g.arc(cx, s * 0.22, s * 0.105, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(cx - s * 0.24, s * 0.86); g.lineTo(cx - s * 0.2, s * 0.4); g.quadraticCurveTo(cx, s * 0.3, cx + s * 0.2, s * 0.4); g.lineTo(cx + s * 0.24, s * 0.86); g.closePath(); g.fill();
        g.fillStyle = G.bark;
        g.beginPath(); g.arc(cx, s * 0.22, s * 0.085, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(cx - s * 0.205, s * 0.86); g.lineTo(cx - s * 0.17, s * 0.42); g.quadraticCurveTo(cx, s * 0.33, cx + s * 0.17, s * 0.42); g.lineTo(cx + s * 0.205, s * 0.86); g.closePath(); g.fill();
        // Three vines of different reach spiral up it, thorn leaves along them, flowers at two tips.
        const coils: [number, number, number, number, number][] = [[0.2, 0.62, 2.4, 0, 0.055], [0.17, 0.52, 3.1, 2.1, 0.05], [0.23, 0.7, 1.9, 4.0, 0.06]];
        for (const [r, h, n, ph, w] of coils) vine(g, spiral(cx, s * 0.88, s * h, s * r, n, ph), s * w);
        leaf(g, cx - s * 0.18, s * 0.66, -2.5, s * 0.11);
        leaf(g, cx + s * 0.17, s * 0.55, -0.6, s * 0.11);
        leaf(g, cx - s * 0.12, s * 0.46, 2.4, s * 0.1);
        leaf(g, cx + s * 0.2, s * 0.76, 0.5, s * 0.1);
        flower(g, cx - s * 0.12, s * 0.34, s * 0.13, -0.4);
        flower(g, cx + s * 0.16, s * 0.32, s * 0.12, 0.45);
        motes(g, [[s * 0.1, s * 0.3, 1], [s * 0.9, s * 0.4, 0], [s * 0.14, s * 0.6, 0], [s * 0.88, s * 0.18, 1]], s * 0.015);
      },
    },
    {
      key: 'E', label: 'pollen glide', name: 'Pollen Glide', range: 6, cooldown: 12, dash: true, escape: true,
      blurb: 'She glides 6 m on a gust of pollen, and a flower grows where she lands. No heal of its own.',
      icon(g, s) {
        ground(g, s);
        // The gust: a pale wide ribbon from the lower left sweeping up and over to the landing flower in the lower right.
        const path: Pt[] = [];
        for (let i = 0; i <= 44; i++) {
          const u = i / 44;
          path.push([s * (0.08 + 0.7 * u), s * (0.74 - 0.5 * Math.sin(u * Math.PI)) + Math.sin(u * 7) * s * 0.025]);
        }
        g.lineCap = 'round';
        g.lineJoin = 'round';
        for (const [col, lw, dy] of [[G.dark, 0.13, 0.012], ['rgba(232,220,192,0.55)', 0.1, 0], [G.body, 0.035, 0]] as [string, number, number][]) {
          g.strokeStyle = col;
          g.lineWidth = s * lw;
          g.beginPath();
          path.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y + s * dy) : g.lineTo(x, y + s * dy)));
          g.stroke();
        }
        // A pale ghost where she lifted off, pollen motes along the gust, a spiral vine tendril trailing it.
        g.fillStyle = 'rgba(232,220,192,0.45)';
        g.beginPath(); g.ellipse(s * 0.12, s * 0.7, s * 0.07, s * 0.13, 0, 0, Math.PI * 2); g.fill();
        const tail: Pt[] = path.slice(2, 22).map(([x, y], i) => [x - s * 0.02, y + s * 0.07 + Math.sin(i * 0.9) * s * 0.02]);
        vine(g, tail, s * 0.03);
        motes(g, [[s * 0.3, s * 0.4, 1], [s * 0.42, s * 0.22, 1], [s * 0.55, s * 0.22, 0], [s * 0.62, s * 0.34, 1], [s * 0.22, s * 0.58, 0], [s * 0.7, s * 0.5, 1], [s * 0.46, s * 0.4, 0], [s * 0.36, s * 0.3, 1]], s * 0.018);
        rootRing(g, s * 0.8, s * 0.88, s * 0.17, s * 0.05, s * 0.028);
        flower(g, s * 0.8, s * 0.86, s * 0.26, 0.15);
        leaf(g, s * 0.8, s * 0.88, -2.4, s * 0.1);
        leaf(g, s * 0.8, s * 0.88, 2.4, s * 0.1);
      },
    },
    {
      key: 'R', label: 'world tree', name: 'World Tree', range: 9, cooldown: 24,
      blurb: 'A tree bursts up at a spot (9 m) after 1.2 s and stands 8 s: it blocks walking and bolts, roots an enemy within 3 m as it sprouts, and her flowers within 6 m heal 50% more. Recast: Uproot, a 3 m burst of thorns after 0.6 s: 60.',
      icon(g, s) {
        ground(g, s);
        const cx = s * 0.5;
        const glow = g.createRadialGradient(cx, s * 0.36, s * 0.02, cx, s * 0.36, s * 0.5);
        glow.addColorStop(0, 'rgba(255,251,224,0.7)');
        glow.addColorStop(1, 'rgba(255,251,224,0)');
        g.fillStyle = glow;
        g.fillRect(0, 0, s, s);
        rootRing(g, cx, s * 0.9, s * 0.43, s * 0.1, s * 0.04);
        // Branches fanning out from the trunk top, then the canopy as overlapping dark and bright blobs.
        g.lineCap = 'round';
        for (const [dx, dy] of [[-0.3, -0.12], [0.3, -0.12], [-0.16, -0.2], [0.16, -0.2]] as [number, number][]) {
          g.strokeStyle = G.dark; g.lineWidth = s * 0.06;
          g.beginPath(); g.moveTo(cx, s * 0.52); g.quadraticCurveTo(cx + dx * s * 0.5, s * 0.5 + dy * s * 0.4, cx + dx * s, s * (0.52 + dy)); g.stroke();
          g.strokeStyle = '#7a5a34'; g.lineWidth = s * 0.035;
          g.beginPath(); g.moveTo(cx, s * 0.52); g.quadraticCurveTo(cx + dx * s * 0.5, s * 0.5 + dy * s * 0.4, cx + dx * s, s * (0.52 + dy)); g.stroke();
        }
        const blobs: [number, number, number][] = [[0.22, 0.4, 0.15], [0.78, 0.4, 0.15], [0.34, 0.26, 0.17], [0.66, 0.26, 0.17], [0.5, 0.18, 0.19], [0.5, 0.36, 0.17]];
        for (const [x, y, r] of blobs) { g.fillStyle = G.dark; g.beginPath(); g.arc(s * x, s * y, s * (r + 0.02), 0, Math.PI * 2); g.fill(); }
        for (const [x, y, r] of blobs) { g.fillStyle = G.leafDark; g.beginPath(); g.arc(s * x, s * y, s * r, 0, Math.PI * 2); g.fill(); }
        for (const [x, y, r] of blobs) { g.fillStyle = G.body; g.beginPath(); g.arc(s * (x - 0.025), s * (y - 0.035), s * r * 0.7, 0, Math.PI * 2); g.fill(); }
        // The trunk: three vines twisted together from the roots up.
        for (const ph of [0, 2.1, 4.2]) vine(g, spiral(cx, s * 0.9, s * 0.46, s * 0.05, 2.2, ph), s * 0.06);
        // Blooms in the canopy.
        flower(g, s * 0.5, s * 0.2, s * 0.15, 0);
        flower(g, s * 0.24, s * 0.4, s * 0.11, -0.5);
        flower(g, s * 0.76, s * 0.4, s * 0.11, 0.5);
        flower(g, s * 0.36, s * 0.3, s * 0.09, -0.25);
        flower(g, s * 0.64, s * 0.3, s * 0.09, 0.25);
        motes(g, [[s * 0.1, s * 0.2, 1], [s * 0.9, s * 0.22, 0], [s * 0.14, s * 0.62, 0], [s * 0.88, s * 0.6, 1], [s * 0.3, s * 0.1, 1], [s * 0.7, s * 0.08, 0]], s * 0.016);
      },
    },
  ],
};
