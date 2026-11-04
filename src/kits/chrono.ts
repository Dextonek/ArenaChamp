import type { HeroKit } from '../heroes';

/**
 * Chrono kit data: Tempo, the Unwound Hour. Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * green-black ground, ivory dial foil, radium chartreuse numerals and hands, one red second hand accent.
 * Signature shape: the luminous clock dial, tapered clock hands and pale afterimages.
 */
const S = { gold: '#ffc83a', core: '#ffffff', hot: '#f4ffd0', body: '#d4ff5a', accent: '#ff4a4a', dark: '#0c100a', foil: '#f4ecd8', coat: '#1b2416', ghost: '#e4ffa0' };

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#222d17');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/** A tapered clock-hand blade from the pivot (px, py), `ang` clockwise from up, with a dark outline. */
function blade(g: CanvasRenderingContext2D, px: number, py: number, ang: number, len: number, w: number, fill: string, edge = S.dark, alpha = 1) {
  const dx = Math.sin(ang), dy = -Math.cos(ang), nx = Math.cos(ang), ny = Math.sin(ang);
  const P = (x: number, y: number): [number, number] => [px + nx * x * w + dx * y * len, py + ny * x * w + dy * y * len];
  const pts = [P(0, -0.22), P(0.5, 0), P(0.14, 0.6), P(0, 1), P(-0.14, 0.6), P(-0.5, 0)];
  g.save();
  g.globalAlpha = alpha;
  g.lineJoin = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  if (edge) {
    g.strokeStyle = edge;
    g.lineWidth = Math.max(2, w * 0.3);
    g.stroke();
  }
  g.fillStyle = fill;
  g.fill();
  g.restore();
}

/** A luminous dial: disc (ivory or dark), chartreuse rim, twelve ticks and optional numerals. `squash` flattens it to lie on the floor. */
function dial(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, o: { ivory?: boolean; numerals?: 'all' | 'quarter' | 'none'; squash?: number; alpha?: number } = {}) {
  const sq = o.squash ?? 1;
  g.save();
  g.globalAlpha = o.alpha ?? 1;
  g.translate(cx, cy);
  g.scale(1, sq);
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fillStyle = o.ivory ? S.foil : '#141b0e';
  g.fill();
  g.strokeStyle = S.dark;
  g.lineWidth = r * 0.16;
  g.stroke();
  g.strokeStyle = S.body;
  g.lineWidth = r * 0.08;
  g.stroke();
  g.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, sx = Math.sin(a), sy = -Math.cos(a), r0 = i % 3 ? 0.76 : 0.68;
    for (const pass of [0, 1]) {
      g.strokeStyle = pass === 0 ? S.dark : S.body;
      g.lineWidth = r * (pass === 0 ? 0.15 : 0.07);
      g.beginPath();
      g.moveTo(sx * r * r0, sy * r * r0);
      g.lineTo(sx * r * 0.88, sy * r * 0.88);
      g.stroke();
    }
  }
  const nums = o.numerals ?? 'none';
  if (nums !== 'none') {
    g.font = `bold ${r * 0.34}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (let i = 0; i < 12; i++) {
      if (nums === 'quarter' && i % 3) continue;
      const a = (i / 12) * Math.PI * 2, x = Math.sin(a) * r * 0.5, y = -Math.cos(a) * r * 0.5;
      g.strokeStyle = S.dark;
      g.lineWidth = r * 0.1;
      g.strokeText(ROMAN[i], x, y);
      g.fillStyle = S.body;
      g.fillText(ROMAN[i], x, y);
    }
  }
  g.restore();
}

/** A slim pale figure (an afterimage) with its feet at (x, y), `h` tall. */
function ghostFigure(g: CanvasRenderingContext2D, x: number, y: number, h: number, alpha: number, solid = false) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = solid ? S.coat : S.ghost;
  g.strokeStyle = solid ? S.body : S.ghost;
  g.lineWidth = h * 0.03;
  g.beginPath();
  g.moveTo(x - h * 0.2, y);
  g.quadraticCurveTo(x - h * 0.16, y - h * 0.5, x - h * 0.11, y - h * 0.68);
  g.lineTo(x + h * 0.11, y - h * 0.68);
  g.quadraticCurveTo(x + h * 0.16, y - h * 0.5, x + h * 0.2, y);
  g.closePath();
  g.fill();
  if (solid) g.stroke();
  g.beginPath();
  g.arc(x, y - h * 0.78, h * 0.095, 0, Math.PI * 2);
  g.fillStyle = solid ? S.foil : S.ghost;
  g.fill();
  g.fillStyle = solid ? S.body : S.ghost;
  g.fillRect(x + h * 0.2, y - h * 0.92, h * 0.035, h * 0.92);
  g.restore();
}

/** A small pale diamond mote. */
function mote(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = S.foil;
  g.beginPath();
  g.moveTo(x, y - r * 1.3);
  g.lineTo(x + r, y);
  g.lineTo(x, y + r * 1.3);
  g.lineTo(x - r, y);
  g.closePath();
  g.fill();
}

export const chronoKit: HeroKit = {
  name: 'Tempo',
  title: 'the Unwound Hour',
  maxHp: 580,
  accent: S.body,
  foil: S.foil,
  portrait(g, s) {
    iconGround(g, s);
    // A glowing clock dial floats behind his head like a halo.
    g.fillStyle = 'rgba(212,255,90,0.12)';
    g.beginPath();
    g.arc(s * 0.5, s * 0.38, s * 0.36, 0, Math.PI * 2);
    g.fill();
    dial(g, s * 0.5, s * 0.38, s * 0.32, { numerals: 'quarter', alpha: 0.95 });
    blade(g, s * 0.5, s * 0.38, 0.4, s * 0.2, s * 0.045, S.body);
    // The staff: a giant minute hand with a red second hand pinned at its pivot.
    blade(g, s * 0.86, s * 0.9, 0.12, s * 0.8, s * 0.07, S.body);
    g.fillStyle = S.dark;
    g.beginPath();
    g.arc(s * 0.86, s * 0.9, s * 0.035, 0, Math.PI * 2);
    g.fill();
    blade(g, s * 0.86, s * 0.9, 2.2, s * 0.2, s * 0.04, S.accent);
    // Shoulders in a long dark coat with a chartreuse edge.
    g.fillStyle = S.coat;
    g.beginPath();
    g.moveTo(s * 0.1, s);
    g.quadraticCurveTo(s * 0.14, s * 0.72, s * 0.34, s * 0.62);
    g.quadraticCurveTo(s * 0.5, s * 0.56, s * 0.66, s * 0.62);
    g.quadraticCurveTo(s * 0.86, s * 0.72, s * 0.9, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.body;
    g.lineWidth = s * 0.02;
    g.stroke();
    // The ivory dial-face shoulder plate.
    dial(g, s * 0.24, s * 0.74, s * 0.1, { ivory: true });
    blade(g, s * 0.24, s * 0.74, 0.3, s * 0.07, s * 0.02, S.dark, '');
    // Neck and a long lean face.
    g.fillStyle = '#e8d8c4';
    g.fillRect(s * 0.46, s * 0.56, s * 0.08, s * 0.08);
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.46, s * 0.1, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    // White hair swept back and tied in a tail.
    g.fillStyle = '#f2f4ee';
    g.beginPath();
    g.moveTo(s * 0.39, s * 0.46);
    g.quadraticCurveTo(s * 0.36, s * 0.3, s * 0.5, s * 0.29);
    g.quadraticCurveTo(s * 0.64, s * 0.3, s * 0.61, s * 0.46);
    g.quadraticCurveTo(s * 0.58, s * 0.36, s * 0.5, s * 0.36);
    g.quadraticCurveTo(s * 0.42, s * 0.36, s * 0.39, s * 0.46);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.61, s * 0.36);
    g.quadraticCurveTo(s * 0.74, s * 0.4, s * 0.7, s * 0.58);
    g.quadraticCurveTo(s * 0.66, s * 0.46, s * 0.6, s * 0.42);
    g.fill();
    g.fillStyle = S.accent;
    g.fillRect(s * 0.6, s * 0.38, s * 0.03, s * 0.025);
    // Eyes and the monocle on a chain.
    g.fillStyle = S.dark;
    g.fillRect(s * 0.44, s * 0.45, s * 0.035, s * 0.012);
    g.fillRect(s * 0.525, s * 0.45, s * 0.035, s * 0.012);
    g.strokeStyle = S.body;
    g.lineWidth = s * 0.014;
    g.beginPath();
    g.arc(s * 0.543, s * 0.456, s * 0.034, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = s * 0.006;
    g.beginPath();
    g.moveTo(s * 0.55, s * 0.49);
    g.quadraticCurveTo(s * 0.6, s * 0.6, s * 0.56, s * 0.7);
    g.stroke();
    g.fillStyle = '#b87a74';
    g.fillRect(s * 0.47, s * 0.54, s * 0.05, s * 0.008);
  },
  spells: [
    {
      key: 'Q', label: 'tick bolt', name: 'Tick', range: 9, cooldown: 3, aim: 'line',
      blurb: 'A spinning clock hand (9 m, 50). A direct hit takes 1 s off Tick. Echo: the same line again 1.5 s later, from where he stood, for 20.',
      icon(g, s) {
        iconGround(g, s);
        // The echo still to come: a pale ghost hand and a ghost dial at the start (lower left), the real hand flying up and right.
        dial(g, s * 0.2, s * 0.8, s * 0.17, { numerals: 'none', alpha: 0.55 });
        const ang = 0.95, dx = Math.sin(ang), dy = -Math.cos(ang);
        blade(g, s * 0.2, s * 0.8, ang, s * 0.62, s * 0.1, S.ghost, '', 0.3);
        for (const [k, a] of [[2, 0.25], [1, 0.38]]) {
          blade(g, s * (0.4 + dx * 0.1 * k * 1.3), s * (0.64 + dy * 0.1 * k * 1.3), ang, s * 0.46, s * 0.1, S.ghost, '', a);
        }
        blade(g, s * 0.44, s * 0.62, ang, s * 0.5, s * 0.13, S.body);
        blade(g, s * 0.44, s * 0.62, ang + 2.2, s * 0.2, s * 0.07, S.accent);
        g.fillStyle = S.dark;
        g.beginPath();
        g.arc(s * 0.44, s * 0.62, s * 0.03, 0, Math.PI * 2);
        g.fill();
        mote(g, s * 0.86, s * 0.16, s * 0.025);
        mote(g, s * 0.62, s * 0.1, s * 0.018);
      },
    },
    {
      key: 'W', label: 'slow time', name: 'Slow Time', range: 9, cooldown: 9,
      blurb: 'Time thickens in a 3.5 m circle (9 m): after 1.2 s enemies inside take 30 and are slowed 2 s. He moves 30% faster inside for 3 s. Echo 1.5 s later: 12 and the slow again.',
      icon(g, s) {
        iconGround(g, s);
        // A floor dial with slow hands, a pale ghost dial in its middle, motes hanging in the air above it.
        dial(g, s * 0.5, s * 0.72, s * 0.44, { numerals: 'quarter', squash: 0.5 });
        g.save();
        g.translate(s * 0.5, s * 0.72);
        g.scale(1, 0.5);
        blade(g, 0, 0, 0.9, s * 0.3, s * 0.08, S.body);
        blade(g, 0, 0, 3.7, s * 0.2, s * 0.1, S.body);
        g.restore();
        dial(g, s * 0.5, s * 0.72, s * 0.17, { numerals: 'none', squash: 0.5, alpha: 0.6 });
        ghostFigure(g, s * 0.5, s * 0.7, s * 0.5, 0.45);
        for (const [x, y, r] of [[0.16, 0.26, 0.028], [0.3, 0.12, 0.02], [0.72, 0.2, 0.03], [0.86, 0.36, 0.02], [0.52, 0.1, 0.022]]) mote(g, s * x, s * y, s * r);
        g.fillStyle = S.accent;
        g.beginPath();
        g.arc(s * 0.5, s * 0.72, s * 0.022, 0, Math.PI * 2);
        g.fill();
      },
    },
    {
      key: 'E', label: 'time skip', name: 'Time Skip', range: 6, cooldown: 11, dash: true,
      blurb: 'He vanishes for 0.6 s (untouchable) and returns on the marker 6 m away with a pulse of 35. Echo 1.5 s later at the same spot: 14.',
      icon(g, s) {
        iconGround(g, s);
        // A pale afterimage where he left, a dashed arc to a floor-dial marker, and him standing in it.
        dial(g, s * 0.76, s * 0.82, s * 0.2, { numerals: 'none', squash: 0.45 });
        dial(g, s * 0.76, s * 0.82, s * 0.1, { numerals: 'none', squash: 0.45, alpha: 0.6 });
        ghostFigure(g, s * 0.22, s * 0.84, s * 0.56, 0.4);
        ghostFigure(g, s * 0.76, s * 0.84, s * 0.56, 1, true);
        g.strokeStyle = S.body;
        g.lineWidth = s * 0.035;
        g.lineCap = 'round';
        g.setLineDash([s * 0.06, s * 0.045]);
        g.beginPath();
        g.moveTo(s * 0.3, s * 0.3);
        g.bezierCurveTo(s * 0.42, s * 0.12, s * 0.6, s * 0.12, s * 0.7, s * 0.28);
        g.stroke();
        g.setLineDash([]);
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(s * 0.62, s * 0.16);
        g.lineTo(s * 0.74, s * 0.32);
        g.lineTo(s * 0.8, s * 0.14);
        g.closePath();
        g.fillStyle = S.body;
        g.fill();
        mote(g, s * 0.12, s * 0.2, s * 0.02);
        mote(g, s * 0.5, s * 0.5, s * 0.016);
      },
    },
    {
      key: 'R', label: 'stolen hour', name: 'Stolen Hour', range: 8, cooldown: 24,
      blurb: 'A clock face forms over an enemy (8 m); after 0.8 s, if he still sees them: 70 and slowed 2 s, and for 4 s his echoes hit at 80% and he moves 30% faster. Echo: 28.',
      icon(g, s) {
        iconGround(g, s);
        // A big ivory face with golden hands stopped at twelve and a crack, a ghost figure under it, a small ghost dial beside it.
        ghostFigure(g, s * 0.5, s * 0.96, s * 0.52, 0.5);
        dial(g, s * 0.5, s * 0.36, s * 0.32, { ivory: true, numerals: 'quarter' });
        blade(g, s * 0.5, s * 0.36, 0, s * 0.24, s * 0.06, S.gold);
        blade(g, s * 0.5, s * 0.36, 0.1, s * 0.15, s * 0.07, S.gold);
        blade(g, s * 0.5, s * 0.36, 2.5, s * 0.2, s * 0.03, S.accent);
        g.strokeStyle = S.dark;
        g.lineWidth = s * 0.02;
        g.lineJoin = 'miter';
        g.beginPath();
        g.moveTo(s * 0.5, s * 0.36);
        g.lineTo(s * 0.58, s * 0.5);
        g.lineTo(s * 0.54, s * 0.56);
        g.lineTo(s * 0.62, s * 0.66);
        g.stroke();
        dial(g, s * 0.84, s * 0.78, s * 0.11, { numerals: 'none', alpha: 0.55 });
        blade(g, s * 0.84, s * 0.78, 0.5, s * 0.08, s * 0.025, S.gold, '', 0.8);
        mote(g, s * 0.12, s * 0.14, s * 0.022);
        mote(g, s * 0.9, s * 0.2, s * 0.018);
      },
    },
  ],
};
