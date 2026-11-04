import type { HeroKit } from '../heroes';
import { paintCard, paintHat, paintStar } from '../effects/parts/magic';

/**
 * Magic kit data: The Great Zambini, stage magician (new heroes, 15). Four spells (labels as registered), canvas-drawn icons in the kit's
 * palette: a deep violet stage ground, black tailcoat, purple cape lining, gold foil and paper-white cards. Signature shapes: the top
 * hat and the gold star.
 */
const M = {
  core: '#ffffff', hot: '#fff1c8', foil: '#ffe08a', gold: '#e0b050', violet: '#b05aff', purple: '#7a30c8', deep: '#2a1248', dark: '#120a1e',
  red: '#d8404a', card: '#d6cfc0', steel: '#c4cad8',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.35, s * 0.05, s * 0.5, s * 0.5, s * 0.8);
  r.addColorStop(0, '#4a2088');
  r.addColorStop(1, M.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A thin ray with a pale core. */
function ray(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, tint = M.violet) {
  g.lineCap = 'round';
  g.strokeStyle = tint;
  g.globalAlpha = 0.8;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  g.globalAlpha = 1;
  g.strokeStyle = M.core;
  g.lineWidth = w * 0.4;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

/** A sword centred at (cx, cy), `len` long, turned by `rot` (0: point up). */
function sword(g: CanvasRenderingContext2D, cx: number, cy: number, len: number, rot: number) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const w = len * 0.09;
  g.fillStyle = M.dark;
  g.beginPath();
  g.moveTo(0, -len * 0.54);
  g.lineTo(w * 1.5, -len * 0.38);
  g.lineTo(w * 1.5, len * 0.12);
  g.lineTo(-w * 1.5, len * 0.12);
  g.lineTo(-w * 1.5, -len * 0.38);
  g.closePath();
  g.fill();
  g.fillStyle = M.steel;
  g.beginPath();
  g.moveTo(0, -len * 0.5);
  g.lineTo(w, -len * 0.36);
  g.lineTo(w, len * 0.12);
  g.lineTo(-w, len * 0.12);
  g.lineTo(-w, -len * 0.36);
  g.closePath();
  g.fill();
  g.fillStyle = M.core;
  g.fillRect(-w * 0.25, -len * 0.4, w * 0.5, len * 0.5);
  g.fillStyle = M.foil;
  g.fillRect(-w * 3, len * 0.12, w * 6, len * 0.05);
  g.fillStyle = M.purple;
  g.fillRect(-w * 0.8, len * 0.17, w * 1.6, len * 0.2);
  g.fillStyle = M.foil;
  g.fillRect(-w * 1.3, len * 0.37, w * 2.6, len * 0.05);
  g.restore();
}

export const magicKit: HeroKit = {
  name: 'The Great Zambini',
  maxHp: 570,
  title: 'stage magician',
  accent: M.violet,
  foil: M.foil,
  portrait(g, s) {
    // A stage: a violet spotlight cone on a dark ground, gold stars hanging in it.
    g.fillStyle = M.dark;
    g.fillRect(0, 0, s, s);
    const cone = g.createLinearGradient(0, 0, 0, s);
    cone.addColorStop(0, 'rgba(176,90,255,0.55)');
    cone.addColorStop(1, 'rgba(176,90,255,0.05)');
    g.fillStyle = cone;
    g.beginPath();
    g.moveTo(s * 0.4, 0);
    g.lineTo(s * 0.6, 0);
    g.lineTo(s * 0.95, s);
    g.lineTo(s * 0.05, s);
    g.closePath();
    g.fill();
    paintStar(g, s * 0.14, s * 0.2, s * 0.05);
    paintStar(g, s * 0.87, s * 0.3, s * 0.04);
    paintStar(g, s * 0.8, s * 0.12, s * 0.025, M.hot);
    // The cape: purple, a high collar, the lining showing gold at the edge.
    g.fillStyle = M.deep;
    g.beginPath();
    g.moveTo(s * 0.05, s);
    g.quadraticCurveTo(s * 0.08, s * 0.62, s * 0.3, s * 0.54);
    g.lineTo(s * 0.7, s * 0.54);
    g.quadraticCurveTo(s * 0.92, s * 0.62, s * 0.95, s);
    g.closePath();
    g.fill();
    g.strokeStyle = M.violet;
    g.lineWidth = s * 0.02;
    g.stroke();
    // The tailcoat and a white shirt front with a gold stud.
    g.fillStyle = '#1b1226';
    g.beginPath();
    g.moveTo(s * 0.2, s);
    g.quadraticCurveTo(s * 0.22, s * 0.7, s * 0.36, s * 0.62);
    g.lineTo(s * 0.64, s * 0.62);
    g.quadraticCurveTo(s * 0.78, s * 0.7, s * 0.8, s);
    g.closePath();
    g.fill();
    g.fillStyle = '#e8e0f0';
    g.beginPath();
    g.moveTo(s * 0.43, s * 0.62);
    g.lineTo(s * 0.57, s * 0.62);
    g.lineTo(s * 0.54, s);
    g.lineTo(s * 0.46, s);
    g.closePath();
    g.fill();
    g.fillStyle = M.violet;
    g.beginPath();
    g.moveTo(s * 0.46, s * 0.64);
    g.lineTo(s * 0.54, s * 0.64);
    g.lineTo(s * 0.5, s * 0.7);
    g.closePath();
    g.fill();
    g.fillStyle = M.foil;
    g.beginPath();
    g.arc(s * 0.5, s * 0.8, s * 0.012, 0, Math.PI * 2);
    g.fill();
    // The face: pale, a thin waxed moustache, a smug smile, one raised brow.
    g.fillStyle = '#f0dcd0';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.44, s * 0.11, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = M.dark;
    g.lineWidth = s * 0.012;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 0.43, s * 0.4);
    g.lineTo(s * 0.48, s * 0.395);
    g.moveTo(s * 0.52, s * 0.385);
    g.lineTo(s * 0.57, s * 0.37);
    g.stroke();
    g.fillStyle = M.dark;
    g.beginPath();
    g.arc(s * 0.455, s * 0.42, s * 0.01, 0, Math.PI * 2);
    g.arc(s * 0.545, s * 0.42, s * 0.01, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.485);
    g.quadraticCurveTo(s * 0.42, s * 0.46, s * 0.37, s * 0.5);
    g.quadraticCurveTo(s * 0.44, s * 0.5, s * 0.5, s * 0.495);
    g.quadraticCurveTo(s * 0.56, s * 0.5, s * 0.63, s * 0.5);
    g.quadraticCurveTo(s * 0.58, s * 0.46, s * 0.5, s * 0.485);
    g.fill();
    g.strokeStyle = '#a45b6e';
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(s * 0.46, s * 0.52);
    g.quadraticCurveTo(s * 0.5, s * 0.54, s * 0.55, s * 0.515);
    g.stroke();
    // The top hat, tipped a little, with a violet band and a gold star on it.
    g.save();
    g.translate(s * 0.5, s * 0.32);
    g.rotate(-0.08);
    paintHat(g, 0, 0, s * 0.3);
    paintStar(g, 0, -s * 0.06, s * 0.03);
    g.restore();
    // The wand in his raised hand, a gold star at its tip.
    g.strokeStyle = M.dark;
    g.lineWidth = s * 0.03;
    g.beginPath();
    g.moveTo(s * 0.72, s * 0.82);
    g.lineTo(s * 0.9, s * 0.5);
    g.stroke();
    g.strokeStyle = M.core;
    g.lineWidth = s * 0.012;
    g.stroke();
    paintStar(g, s * 0.9, s * 0.46, s * 0.07);
    g.fillStyle = '#e8e0f0';
    g.beginPath();
    g.ellipse(s * 0.72, s * 0.83, s * 0.05, s * 0.04, 0, 0, Math.PI * 2);
    g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'card spray', name: 'Card Spray', range: 8, cooldown: 3.5, aim: 'line',
      blurb: 'Three playing cards in a 24 degree fan (8 m): 22 damage each. Close up they are a wall; past 5 m stand in a gap.',
      icon(g, s) {
        iconGround(g, s);
        ray(g, s * 0.2, s * 0.86, s * 0.9, s * 0.3, s * 0.03);
        ray(g, s * 0.2, s * 0.86, s * 0.94, s * 0.62, s * 0.03);
        ray(g, s * 0.2, s * 0.86, s * 0.7, s * 0.06, s * 0.03);
        paintCard(g, s * 0.74, s * 0.26, s * 0.3, 0.9, 1);
        paintCard(g, s * 0.78, s * 0.56, s * 0.3, 1.45, 0);
        paintCard(g, s * 0.54, s * 0.22, s * 0.3, 0.35, 2);
        paintStar(g, s * 0.2, s * 0.84, s * 0.1);
        paintStar(g, s * 0.1, s * 0.32, s * 0.05, M.hot);
      },
    },
    {
      key: 'W', label: 'sawn in half', name: 'Sawn in Half', range: 8, cooldown: 10, aim: 'line',
      blurb: 'A saw blade slides at you (8 m, 18 m/s): 50 damage and slowed 1.5 s.',
      icon(g, s) {
        iconGround(g, s);
        // The magician's box in two halves with a gap, striped purple and gold; the saw runs through the gap.
        for (const top of [true, false]) {
          const y = top ? s * 0.22 : s * 0.54;
          g.fillStyle = M.dark;
          g.fillRect(s * 0.1, y - s * 0.02, s * 0.8, s * 0.26);
          g.fillStyle = M.purple;
          g.fillRect(s * 0.12, y, s * 0.76, s * 0.22);
          g.fillStyle = M.foil;
          for (let i = 0; i < 4; i++) g.fillRect(s * (0.18 + i * 0.19), y, s * 0.04, s * 0.22);
          g.fillStyle = M.violet;
          g.fillRect(s * 0.12, y + (top ? s * 0.18 : 0), s * 0.76, s * 0.04);
        }
        g.fillStyle = M.dark;
        g.beginPath();
        g.moveTo(s * 0.02, s * 0.54);
        for (let i = 0; i < 9; i++) g.lineTo(s * (0.02 + i * 0.09), s * (i % 2 ? 0.5 : 0.455));
        g.lineTo(s * 0.9, s * 0.54);
        g.lineTo(s * 0.9, s * 0.45);
        g.lineTo(s * 0.02, s * 0.45);
        g.closePath();
        g.fillStyle = M.steel;
        g.fill();
        g.fillStyle = M.core;
        g.fillRect(s * 0.05, s * 0.5, s * 0.8, s * 0.02);
        g.fillStyle = M.foil;
        g.fillRect(s * 0.9, s * 0.43, s * 0.06, s * 0.13);
        paintStar(g, s * 0.84, s * 0.16, s * 0.06);
        paintStar(g, s * 0.16, s * 0.86, s * 0.05, M.hot);
      },
    },
    {
      key: 'E', label: 'hat trick', name: 'The Hat Trick', range: 0, cooldown: 13,
      blurb: 'Three hats shuffle at his feet for 1.5 s and he vanishes under one. Hit the right hat and he pops out stunned 1 s; a wrong one gives confetti. At 1.5 s he appears at his hat. An area spell hits all three.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = M.foil;
        g.lineWidth = s * 0.03;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(s * 0.3, s * 0.78, s * 0.2, Math.PI * 1.1, Math.PI * 1.95);
        g.stroke();
        g.beginPath();
        g.arc(s * 0.7, s * 0.78, s * 0.2, Math.PI * 0.05, Math.PI * 0.9, true);
        g.stroke();
        paintHat(g, s * 0.2, s * 0.62, s * 0.42);
        paintHat(g, s * 0.82, s * 0.62, s * 0.42);
        paintHat(g, s * 0.5, s * 0.92, s * 0.52);
        // A puff of smoke and stars above the middle hat.
        g.fillStyle = 'rgba(176,90,255,0.75)';
        for (const [x, y, r] of [[0.42, 0.3, 0.1], [0.54, 0.24, 0.12], [0.62, 0.34, 0.08], [0.48, 0.38, 0.09]] as const) {
          g.beginPath();
          g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          g.fill();
        }
        paintStar(g, s * 0.5, s * 0.22, s * 0.08);
        paintStar(g, s * 0.28, s * 0.14, s * 0.04, M.hot);
        paintStar(g, s * 0.82, s * 0.22, s * 0.045);
      },
    },
    {
      key: 'R', label: 'grand finale', name: 'The Grand Finale', range: 9, cooldown: 24,
      blurb: 'He vanishes. Three hats ring the enemy (radius 3 m) for 1.2 s, then swords fly from all three toward the centre: 30 each, stopped by walls. He steps out of one. Step out of the ring.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = 'rgba(255,224,138,0.55)';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.arc(s * 0.5, s * 0.5, s * 0.4, 0, Math.PI * 2);
        g.stroke();
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
          const hx = s * 0.5 + Math.cos(a) * s * 0.4, hy = s * 0.5 + Math.sin(a) * s * 0.4;
          sword(g, s * 0.5 + Math.cos(a) * s * 0.22, s * 0.5 + Math.sin(a) * s * 0.22, s * 0.5, a + Math.PI / 2 + Math.PI);
          paintHat(g, hx, hy + s * 0.07, s * 0.2);
        }
        paintStar(g, s * 0.5, s * 0.52, s * 0.1);
      },
    },
  ],
};
