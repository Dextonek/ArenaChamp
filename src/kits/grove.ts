import type { HeroKit } from '../heroes';

/**
 * Grove kit data (Fenna, the Grove Warden): dark forest-green ground, pale bark foil, leaf-green spiral vines with
 * pink-and-cream flowers. Icons are drawn on canvases in the kit palette, one signature shape each: the spiral vine
 * that blooms (see pipeline/designs/kit-grove.md).
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
      key: 'Q', label: 'bloom lash', name: 'Bloom Lash', range: 10, cooldown: 3,
      blurb: 'A spiral vine coils across to one enemy and a flower blooms on top; the lash heals her for 8.',
      icon(g, s) {
        ground(g, s);
        // A vine spiralling over the ground from the lower left up to a flower at the upper right.
        const pts: Pt[] = [];
        for (let i = 0; i <= 56; i++) {
          const u = i / 56;
          pts.push([s * (0.08 + 0.64 * u) , s * (0.84 - 0.34 * u) + Math.sin(u * 5.5 * Math.PI) * s * 0.07 * (1 - u * 0.4)]);
        }
        vine(g, pts, s * 0.07);
        leaf(g, s * 0.26, s * 0.66, -2.1, s * 0.13);
        leaf(g, s * 0.4, s * 0.64, 2.2, s * 0.12);
        leaf(g, s * 0.55, s * 0.5, -2.0, s * 0.12);
        // Coils up around the target on the right, then the flower.
        vine(g, spiral(s * 0.76, s * 0.6, s * 0.3, s * 0.07, 2.5), s * 0.065);
        flower(g, s * 0.76, s * 0.3, s * 0.2, 0.1);
        motes(g, [[s * 0.9, s * 0.2, 0], [s * 0.6, s * 0.12, 1], [s * 0.94, s * 0.4, 1], [s * 0.68, s * 0.06, 0]], s * 0.016);
      },
    },
    {
      key: 'W', label: 'overgrowth', name: 'Overgrowth', range: 9, cooldown: 7, cc: true,
      blurb: 'Vines grow up round the chosen enemy and burst into flowers; unless it steps away it is rooted for 1.2 s.',
      icon(g, s) {
        ground(g, s);
        const cx = s * 0.5, cy = s * 0.74;
        rootRing(g, cx, cy, s * 0.43, s * 0.15, s * 0.045);
        // Roots from the centre.
        g.strokeStyle = G.body;
        g.lineCap = 'round';
        g.lineWidth = s * 0.02;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.2;
          g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a) * s * 0.2, cy + Math.sin(a) * s * 0.05 - s * 0.02, cx + Math.cos(a) * s * 0.34, cy + Math.sin(a) * s * 0.11); g.stroke();
        }
        // Spiral vines with flowers at the tips.
        const spots: [number, number, number][] = [[0.22, 0.72, 0.4], [0.78, 0.72, 0.42], [0.38, 0.84, 0.3], [0.64, 0.84, 0.32], [0.5, 0.68, 0.46]];
        spots.sort((a, b) => a[1] - b[1]);
        for (const [x, y, h] of spots) {
          vine(g, spiral(s * x, s * y, s * h, s * 0.045, 2.2, x * 9), s * 0.045);
          flower(g, s * x, s * (y - h), s * 0.13, (x - 0.5) * 0.5);
        }
        motes(g, [[s * 0.1, s * 0.3, 1], [s * 0.9, s * 0.28, 1], [s * 0.5, s * 0.16, 0]], s * 0.014);
      },
    },
    {
      key: 'E', label: 'verdant ward', name: 'Verdant Ward', range: 9, cooldown: 12, summon: true,
      blurb: 'A flowering vine grows where she points (80 HP, 6 s) and fires petals at whatever comes near.',
      icon(g, s) {
        ground(g, s);
        // The outer range ring, pale at the edge.
        g.strokeStyle = G.bark;
        g.lineWidth = s * 0.025;
        g.setLineDash([s * 0.07, s * 0.05]);
        g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.43, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
        // Three vines with flowers tipped outward, petal jets leaving them.
        const ang = [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6];
        for (const a of ang) {
          const bx = s * 0.5 + Math.cos(a) * s * 0.1, by = s * 0.52 + Math.sin(a) * s * 0.1;
          const fx = s * 0.5 + Math.cos(a) * s * 0.3, fy = s * 0.52 + Math.sin(a) * s * 0.3;
          const pts: Pt[] = [];
          for (let i = 0; i <= 30; i++) {
            const u = i / 30;
            const px = bx + (fx - bx) * u, py = by + (fy - by) * u;
            const nx = -Math.sin(a), ny = Math.cos(a);
            const w = Math.sin(u * Math.PI * 4) * s * 0.025;
            pts.push([px + nx * w, py + ny * w]);
          }
          vine(g, pts, s * 0.05);
          flower(g, fx, fy, s * 0.15, a + Math.PI / 2);
          motes(g, [
            [fx + Math.cos(a) * s * 0.17, fy + Math.sin(a) * s * 0.17, 0],
            [fx + Math.cos(a + 0.35) * s * 0.23, fy + Math.sin(a + 0.35) * s * 0.23, 1],
            [fx + Math.cos(a - 0.3) * s * 0.21, fy + Math.sin(a - 0.3) * s * 0.21, 0],
          ], s * 0.016);
        }
        g.fillStyle = G.bark;
        g.beginPath(); g.arc(s * 0.5, s * 0.52, s * 0.06, 0, Math.PI * 2); g.fill();
        g.strokeStyle = G.dark;
        g.lineWidth = s * 0.014;
        g.stroke();
      },
    },
    {
      key: 'R', label: 'world blossom', name: 'World Blossom', range: 0, cooldown: 20, cc: true,
      blurb: 'Ultimate. A colossal flower closes over her and slams down: she heals 45 and every enemy within 5 m is rooted.',
      icon(g, s) {
        ground(g, s);
        rootRing(g, s * 0.5, s * 0.86, s * 0.46, s * 0.12, s * 0.04);
        // The braided trunk: two strands twisting up.
        vine(g, spiral(s * 0.5, s * 0.84, s * 0.46, s * 0.05, 3, 0), s * 0.06);
        vine(g, spiral(s * 0.5, s * 0.84, s * 0.46, s * 0.05, 3, Math.PI), s * 0.06);
        // The colossal flower, wide open, cream inside and a pink rim.
        flower(g, s * 0.5, s * 0.4, s * 0.4, 0);
        // Small flowers bursting at the sides.
        flower(g, s * 0.12, s * 0.88, s * 0.1, -0.3);
        flower(g, s * 0.88, s * 0.88, s * 0.1, 0.3);
        flower(g, s * 0.26, s * 0.92, s * 0.08, -0.15);
        flower(g, s * 0.74, s * 0.92, s * 0.08, 0.15);
        motes(g, [[s * 0.1, s * 0.4, 0], [s * 0.9, s * 0.38, 0], [s * 0.2, s * 0.2, 1], [s * 0.82, s * 0.16, 1], [s * 0.5, s * 0.1, 0], [s * 0.66, s * 0.62, 1]], s * 0.018);
      },
    },
  ],
};
