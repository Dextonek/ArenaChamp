import type { HeroKit } from '../heroes';

/**
 * Astral kit data (Lyra, the Star Archer): four spells with canvas-drawn icons in the kit's palette. Signature shape:
 * constellations, four-point stars joined by thin gold lines. See pipeline/designs/kit-astral.md.
 */
const A = { core: '#fffbe8', hot: '#ffe08a', body: '#5a3fc0', accent: '#7ff3ff', dark: '#070414', foil: '#e8e0c8' };

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

export const astralKit: HeroKit = {
  name: 'Lyra',
  maxHp: 550,
  title: 'the Star Archer',
  accent: A.hot,
  foil: A.foil,
  portrait(g, s) {
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
  },
  spells: [
    {
      key: 'Q', label: 'starshot', name: 'Starshot', range: 14, cooldown: 2, aim: 'line',
      blurb: 'A skillshot: a star arrow flies along the aim line and hits the first enemy; 20% more damage beyond 8 m.',
      icon(g, s) {
        ground(g, s);
        const p: [number, number][] = [[0.22, 0.76], [0.5, 0.5], [0.66, 0.3], [0.84, 0.2]];
        link(g, s * p[0][0], s * p[0][1], s * p[1][0], s * p[1][1], s * 0.03);
        link(g, s * p[1][0], s * p[1][1], s * p[2][0], s * p[2][1], s * 0.03);
        link(g, s * p[2][0], s * p[2][1], s * p[3][0], s * p[3][1], s * 0.03);
        star(g, s * p[1][0], s * p[1][1], s * 0.1);
        star(g, s * p[2][0], s * p[2][1], s * 0.085);
        star(g, s * p[3][0], s * p[3][1], s * 0.11);
        star(g, s * p[0][0], s * p[0][1], s * 0.07);
      },
    },
    {
      key: 'W', label: 'constellation snare', name: 'Constellation Snare', range: 11, cooldown: 7, cc: true,
      blurb: 'A trap: a star net lies on the spot for 3 s and snaps the moment an enemy stands inside, hurting, rooting and dragging them in.',
      icon(g, s) {
        ground(g, s);
        g.strokeStyle = A.foil;
        g.lineWidth = s * 0.03;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.55, s * 0.4, s * 0.3, 0, 0, Math.PI * 2); g.stroke();
        const p: [number, number][] = [[0.22, 0.5], [0.4, 0.34], [0.68, 0.36], [0.82, 0.58], [0.6, 0.76], [0.32, 0.72], [0.5, 0.55]];
        const e: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5]];
        for (const [a, b] of e) link(g, s * p[a][0], s * p[a][1], s * p[b][0], s * p[b][1], s * 0.02);
        p.forEach(([x, y], i) => star(g, s * x, s * y, s * (i === 6 ? 0.085 : 0.06)));
      },
    },
    {
      key: 'E', label: 'orbit veil', name: 'Orbit Veil', range: 0, cooldown: 9,
      buff: { kind: 'haste', amount: 0.25, seconds: 3 },
      blurb: 'A backstep: a turning constellation fires gold lines that hurt and slow enemies nearby, then carries her 5 m away from them.',
      icon(g, s) {
        ground(g, s);
        g.strokeStyle = A.foil;
        g.lineWidth = s * 0.025;
        g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.4, 0, Math.PI * 2); g.stroke();
        g.lineWidth = s * 0.015;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.5, s * 0.3, s * 0.14, -0.5, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.ellipse(s * 0.5, s * 0.5, s * 0.22, s * 0.3, 0.4, 0, Math.PI * 2); g.stroke();
        const p: [number, number][] = [[0.24, 0.62], [0.74, 0.38], [0.62, 0.76], [0.36, 0.24], [0.5, 0.5]];
        link(g, s * p[0][0], s * p[0][1], s * p[3][0], s * p[3][1], s * 0.02);
        link(g, s * p[3][0], s * p[3][1], s * p[1][0], s * p[1][1], s * 0.02);
        link(g, s * p[1][0], s * p[1][1], s * p[2][0], s * p[2][1], s * 0.02);
        link(g, s * p[2][0], s * p[2][1], s * p[0][0], s * p[0][1], s * 0.02);
        p.forEach(([x, y], i) => star(g, s * x, s * y, s * (i === 4 ? 0.09 : 0.06)));
      },
    },
    {
      key: 'R', label: 'celestial hunt', name: 'Celestial Hunt', range: 60, cooldown: 20,
      blurb: 'Ultimate. Global: a giant constellation stag is drawn over the spot you pick anywhere in the ring and charges it 2.5 s later.',
      icon(g, s) {
        ground(g, s);
        // The stag: a simplified outline (body, legs, head and antler) joined by gold lines.
        const n: [number, number][] = [
          [0.14, 0.52], [0.3, 0.46], [0.5, 0.46], [0.6, 0.38], [0.68, 0.3], [0.82, 0.38], [0.72, 0.44], [0.62, 0.52],
          [0.54, 0.6], [0.34, 0.6], [0.18, 0.6], [0.56, 0.8], [0.34, 0.82], [0.2, 0.8], [0.62, 0.14], [0.52, 0.2], [0.76, 0.18],
        ];
        const e: [number, number][] = [
          [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 0], [8, 11], [9, 12], [10, 13],
          [4, 14], [14, 15], [14, 16],
        ];
        for (const [a, b] of e) link(g, s * n[a][0], s * n[a][1], s * n[b][0], s * n[b][1], s * 0.016);
        n.forEach(([x, y], i) => star(g, s * x, s * y, s * (i % 5 === 0 ? 0.05 : 0.036)));
        g.strokeStyle = A.foil;
        g.lineWidth = s * 0.02;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.9, s * 0.36, s * 0.05, 0, 0, Math.PI * 2); g.stroke();
      },
    },
  ],
};
