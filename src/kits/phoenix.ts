import type { HeroKit } from '../heroes';

/**
 * Phoenix kit data: Anka, the Firebird (hero 40; pipeline/designs/kit-phoenix.md). Four spells (labels as registered),
 * canvas-drawn icons in the kit's palette: ember red, gold, flame, a pale ash foil and the teal eye of a feather.
 * Signature shape: the long feather with an eye near its tip.
 *
 * PLACEHOLDER ICONS AND PORTRAIT (gate 4, first step): plain shapes, to be drawn from the agreed model.
 */
const S = { core: '#fff6d8', hot: '#ffc24a', body: '#ff7b3a', red: '#c23a22', deep: '#4c1410', gold: '#e0a935', teal: '#2fb8a8', ash: '#eadcc4', dark: '#1a0806' };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.45, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#5a1c12');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A feather from (x1, y1) (the quill) to (x2, y2), `w` wide: vane, flame tip, gold shaft, teal eye. */
function feather(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, eye = true) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const at = (t: number, k: number): [number, number] => [x1 + dx * t + nx * w * k, y1 + dy * t + ny * w * k];
  const leaf = (t0: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(...at(t0, 0));
    g.quadraticCurveTo(...at((t0 + 1) / 2 + 0.1, 0.62), ...at(1, 0));
    g.quadraticCurveTo(...at((t0 + 1) / 2 + 0.1, -0.62), ...at(t0, 0));
    g.fill();
  };
  leaf(0.06, S.red);
  leaf(0.6, S.hot);
  g.strokeStyle = S.gold;
  g.lineWidth = Math.max(1, w * 0.14);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(...at(0.92, 0));
  g.stroke();
  if (eye) {
    const [ex, ey] = at(0.72, 0);
    g.fillStyle = S.gold;
    g.beginPath();
    g.arc(ex, ey, w * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.teal;
    g.beginPath();
    g.arc(ex, ey, w * 0.16, 0, Math.PI * 2);
    g.fill();
  }
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1, stroke = '') {
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = Math.max(1, r * 0.08);
    g.stroke();
  }
}

export const phoenixKit: HeroKit = {
  name: 'Anka',
  maxHp: 480,
  title: 'the Firebird',
  accent: S.body,
  foil: S.ash,
  portrait(g, s) {
    ground(g, s);
    for (const [a, l] of [[-0.9, 0.42], [-0.45, 0.5], [0.45, 0.5], [0.9, 0.42]] as const) feather(g, s * 0.5, s * 0.72, s * (0.5 + Math.sin(a) * l), s * (0.72 - Math.cos(a) * l * 0.7), s * 0.09);
    circle(g, s * 0.5, s * 0.48, s * 0.15, '#c98e66');
    g.fillStyle = S.red;
    g.fillRect(s * 0.3, s * 0.64, s * 0.4, s * 0.36);
    for (const x of [-0.07, 0, 0.07]) feather(g, s * (0.5 + x), s * 0.36, s * (0.5 + x * 2.2), s * 0.08, s * 0.05, false);
    g.fillStyle = S.gold;
    g.fillRect(s * 0.36, s * 0.38, s * 0.28, s * 0.03);
  },
  spells: [
    {
      key: 'Q', label: 'ember quill', name: 'Ember Quill', range: 10, cooldown: 3.5, aim: 'line',
      blurb: 'A feather (10 m): 58 damage. Where it ends, in the enemy or in the floor, it stays as an ember and becomes her nest.',
      icon(g, s) {
        ground(g, s);
        circle(g, s * 0.74, s * 0.74, s * 0.16, S.body, 0.5, S.hot);
        feather(g, s * 0.12, s * 0.2, s * 0.76, s * 0.76, s * 0.16);
      },
    },
    {
      key: 'W', label: 'fan the flames', name: 'Fan the Flames', range: 0, cooldown: 9,
      blurb: 'Every ember flares after 0.8 s in a ring of 2.2 m: 60 damage, once. The embers burn out.',
      icon(g, s) {
        ground(g, s);
        for (const [x, y] of [[0.28, 0.66], [0.7, 0.62], [0.5, 0.3]] as const) {
          circle(g, s * x, s * y, s * 0.2, S.body, 0.55, S.hot);
          circle(g, s * x, s * y, s * 0.07, S.core);
        }
      },
    },
    {
      key: 'E', label: 'ember flight', name: 'Ember Flight', range: 12, cooldown: 10,
      blurb: 'She flies to her ember nearest the aimed spot (12 m) and lands in a burst of 1.8 m: 40 damage. The ember is spent. Needs an ember.',
      icon(g, s) {
        ground(g, s);
        circle(g, s * 0.74, s * 0.3, s * 0.18, S.body, 0.55, S.hot);
        g.strokeStyle = S.hot;
        g.lineWidth = s * 0.06;
        g.setLineDash([s * 0.08, s * 0.05]);
        g.beginPath();
        g.moveTo(s * 0.16, s * 0.84);
        g.quadraticCurveTo(s * 0.3, s * 0.3, s * 0.7, s * 0.32);
        g.stroke();
        g.setLineDash([]);
        feather(g, s * 0.1, s * 0.9, s * 0.34, s * 0.62, s * 0.1, false);
      },
    },
    {
      key: 'R', label: 'firebird', name: 'Firebird', range: 12, cooldown: 24, aim: 'line', overCover: true,
      blurb: 'She spreads wings of fire for 1 s, then crosses 12 m as a great firebird: 120 damage to everyone in the 3 m lane. An ember is left where she took off.',
      icon(g, s) {
        ground(g, s);
        for (const [a, l] of [[-1.25, 0.46], [-0.8, 0.4], [0.8, 0.4], [1.25, 0.46]] as const) feather(g, s * 0.5, s * 0.6, s * (0.5 + Math.sin(a) * l), s * (0.6 - Math.cos(a) * l), s * 0.11, false);
        g.fillStyle = S.hot;
        g.beginPath();
        g.moveTo(s * 0.5, s * 0.14);
        g.lineTo(s * 0.6, s * 0.62);
        g.lineTo(s * 0.5, s * 0.9);
        g.lineTo(s * 0.4, s * 0.62);
        g.closePath();
        g.fill();
        circle(g, s * 0.5, s * 0.3, s * 0.04, S.teal);
      },
    },
  ],
};
