import type { HeroKey, HeroKit, HeroSpell } from '../../heroes';

/**
 * Astral kit data (Lyra, the Star Archer): four spells with canvas-drawn icons in the kit's palette. Signature shape:
 * constellations, four-point stars joined by thin gold lines. See pipeline/designs/kit-astral.md.
 */
export const A = { core: '#fffbe8', hot: '#ffe08a', body: '#5a3fc0', accent: '#7ff3ff', dark: '#070414', foil: '#e8e0c8' };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#2a1b66');
  r.addColorStop(1, A.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
  // A few tiny background stars.
  g.fillStyle = A.foil;
  for (const [x, y] of [[0.12, 0.2], [0.86, 0.14], [0.9, 0.62], [0.08, 0.78], [0.62, 0.9], [0.3, 0.07]]) {
    g.beginPath();
    g.arc(s * x, s * y, Math.max(1, s * 0.008), 0, Math.PI * 2);
    g.fill();
  }
}

/** A four-point star (concave sides), dark outline, gold body, white core. */
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  const k = 0.2;
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x + r * k, y - r * k, x + r, y);
  g.quadraticCurveTo(x + r * k, y + r * k, x, y + r);
  g.quadraticCurveTo(x - r * k, y + r * k, x - r, y);
  g.quadraticCurveTo(x - r * k, y - r * k, x, y - r);
  g.closePath();
  g.fillStyle = A.hot;
  g.fill();
  g.strokeStyle = '#2a1a6a';
  g.lineWidth = Math.max(1, r * 0.12);
  g.stroke();
  g.fillStyle = A.core;
  g.beginPath();
  g.arc(x, y, r * 0.18, 0, Math.PI * 2);
  g.fill();
}

/** A thin gold line with a violet underlay. */
function link(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  g.lineCap = 'round';
  g.strokeStyle = A.body;
  g.lineWidth = w * 3;
  g.globalAlpha = 0.55;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.globalAlpha = 1;
  g.strokeStyle = A.hot;
  g.lineWidth = w;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}

/** Lyra's portrait, drawn on a canvas. */
export const portrait: HeroKit['portrait'] = function (g, s) {
  ground(g, s);
  // A parchment ring with a gold bow-shaped constellation inside it.
  g.strokeStyle = A.foil;
  g.lineWidth = s * 0.025;
  g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.36, 0, Math.PI * 2); g.stroke();
  g.lineWidth = s * 0.01;
  g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.31, 0, Math.PI * 2); g.stroke();
  const pts: [number, number][] = [[0.34, 0.26], [0.5, 0.36], [0.62, 0.5], [0.5, 0.64], [0.34, 0.74]];
  for (let i = 0; i < pts.length - 1; i++) link(g, s * pts[i][0], s * pts[i][1], s * pts[i + 1][0], s * pts[i + 1][1], s * 0.018);
  link(g, s * pts[0][0], s * pts[0][1], s * pts[4][0], s * pts[4][1], s * 0.012);
  link(g, s * 0.34, s * 0.5, s * 0.66, s * 0.5, s * 0.014);
  pts.forEach(([x, y], i) => star(g, s * x, s * y, s * (i === 2 ? 0.075 : 0.05)));
  star(g, s * 0.34, s * 0.5, s * 0.04);
  star(g, s * 0.66, s * 0.5, s * 0.06);
};

/** The canvas icons of the four spells (the fallback behind public/icons/spells/; src/icons/vc.ts). */
export const icons: Record<HeroKey, HeroSpell['icon']> = {
  Q(g, s) {
    ground(g, s);
    // A long arrow of linked stars, a big star for its head, and three small stars falling after it.
    const p: [number, number][] = [[0.14, 0.84], [0.34, 0.64], [0.54, 0.44], [0.8, 0.2]];
    for (let i = 0; i < p.length - 1; i++) link(g, s * p[i][0], s * p[i][1], s * p[i + 1][0], s * p[i + 1][1], s * 0.03);
    star(g, s * p[0][0], s * p[0][1], s * 0.05);
    star(g, s * p[1][0], s * p[1][1], s * 0.06);
    star(g, s * p[2][0], s * p[2][1], s * 0.075);
    star(g, s * p[3][0], s * p[3][1], s * 0.13);
    for (const [x, y, r] of [[0.58, 0.72, 0.035], [0.74, 0.58, 0.03], [0.86, 0.74, 0.04]]) {
      link(g, s * x, s * (y - 0.1), s * x - s * 0.02, s * y, s * 0.012);
      star(g, s * x, s * y, s * r);
    }
  },
  W(g, s) {
    ground(g, s);
    g.strokeStyle = A.foil;
    g.lineWidth = s * 0.022;
    g.beginPath(); g.ellipse(s * 0.5, s * 0.5, s * 0.38, s * 0.2, -0.45, 0, Math.PI * 2); g.stroke();
    g.lineWidth = s * 0.012;
    g.beginPath(); g.ellipse(s * 0.5, s * 0.5, s * 0.3, s * 0.12, -0.45, 0, Math.PI * 2); g.stroke();
    link(g, s * 0.3, s * 0.62, s * 0.7, s * 0.38, s * 0.02);
    star(g, s * 0.3, s * 0.62, s * 0.13);
    star(g, s * 0.7, s * 0.38, s * 0.13);
    star(g, s * 0.5, s * 0.5, s * 0.04);
  },
  E(g, s) {
    ground(g, s);
    // A parchment wall, an arrow of stars driven into it, and a star pinned where it lands.
    g.fillStyle = A.foil;
    g.fillRect(s * 0.74, s * 0.12, s * 0.09, s * 0.76);
    g.strokeStyle = '#2a1a6a';
    g.lineWidth = s * 0.012;
    g.strokeRect(s * 0.74, s * 0.12, s * 0.09, s * 0.76);
    link(g, s * 0.12, s * 0.7, s * 0.72, s * 0.46, s * 0.03);
    star(g, s * 0.22, s * 0.66, s * 0.05);
    star(g, s * 0.42, s * 0.58, s * 0.06);
    star(g, s * 0.74, s * 0.45, s * 0.1);
    link(g, s * 0.56, s * 0.2, s * 0.4, s * 0.34, s * 0.012);
    star(g, s * 0.56, s * 0.2, s * 0.04);
    star(g, s * 0.4, s * 0.34, s * 0.03);
  },
  R(g, s) {
    ground(g, s);
    // The mark: rings under a crosshair of links, and the meteor falling in from the top left.
    g.strokeStyle = A.foil;
    g.lineWidth = s * 0.025;
    g.beginPath(); g.ellipse(s * 0.58, s * 0.74, s * 0.3, s * 0.12, 0, 0, Math.PI * 2); g.stroke();
    g.lineWidth = s * 0.014;
    g.beginPath(); g.ellipse(s * 0.58, s * 0.74, s * 0.18, s * 0.07, 0, 0, Math.PI * 2); g.stroke();
    link(g, s * 0.58, s * 0.58, s * 0.58, s * 0.9, s * 0.012);
    link(g, s * 0.22, s * 0.74, s * 0.94, s * 0.74, s * 0.012);
    link(g, s * 0.16, s * 0.1, s * 0.52, s * 0.62, s * 0.04);
    link(g, s * 0.3, s * 0.08, s * 0.58, s * 0.6, s * 0.02);
    star(g, s * 0.58, s * 0.74, s * 0.05);
    star(g, s * 0.52, s * 0.6, s * 0.14);
    star(g, s * 0.2, s * 0.14, s * 0.04);
    star(g, s * 0.34, s * 0.1, s * 0.035);
  },
};
