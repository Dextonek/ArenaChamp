import type { HeroKit } from '../heroes';

/** Blood kit data (Vesper, the Crimson Countess): four spells with canvas-drawn icons in the kit's palette. */

// --- Blood kit icons: dark crimson ground, bone foil, one shape each (the kit's signature shapes) ----------
const B = { core: '#fff1e6', hot: '#ff3b4e', body: '#8c0f22', dark: '#140306', bone: '#e9dcc6' };

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.75);
  r.addColorStop(0, '#3a0610');
  r.addColorStop(1, B.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A faceted crystal spike from (x1,y1) to the tip (x2,y2), `w` wide at the base. */
function thorn(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  g.beginPath();
  g.moveTo(x1 + nx * w / 2, y1 + ny * w / 2);
  g.lineTo(x2, y2);
  g.lineTo(x1 - nx * w / 2, y1 - ny * w / 2);
  g.closePath();
  g.fillStyle = B.body;
  g.fill();
  // Lit facet: the half toward the upper left, with the hot edge line.
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.lineTo(x1 + nx * w / 2, y1 + ny * w / 2);
  g.closePath();
  g.fillStyle = '#b3162c';
  g.fill();
  g.strokeStyle = B.hot;
  g.lineWidth = Math.max(1, w * 0.08);
  g.beginPath();
  g.moveTo(x1 + nx * w / 2, y1 + ny * w / 2);
  g.lineTo(x2, y2);
  g.stroke();
}

function drop(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.moveTo(x, y - r * 2.2);
  g.bezierCurveTo(x + r * 1.1, y - r * 0.6, x + r, y + r, x, y + r);
  g.bezierCurveTo(x - r, y + r, x - r * 1.1, y - r * 0.6, x, y - r * 2.2);
  g.fillStyle = B.body;
  g.fill();
  g.fillStyle = B.core;
  g.beginPath();
  g.arc(x - r * 0.35, y - r * 0.1, r * 0.18, 0, Math.PI * 2);
  g.fill();
}

export const bloodKit: HeroKit = {
  name: 'Vesper',
  title: 'the Crimson Countess',
  maxHp: 700,
  accent: B.hot,
  foil: B.bone,
  portrait(g, s) {
    iconGround(g, s);
    // A bone crescent behind a blood drop: the moon and the blood.
    g.fillStyle = B.bone;
    g.beginPath();
    g.arc(s * 0.5, s * 0.5, s * 0.34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = B.dark;
    g.beginPath();
    g.arc(s * 0.6, s * 0.44, s * 0.31, 0, Math.PI * 2);
    g.fill();
    drop(g, s * 0.56, s * 0.58, s * 0.13);
  },
  spells: [
    {
      key: 'Q', label: 'hemolance', name: 'Hemolance', range: 8, cooldown: 3, aim: 'line',
      blurb: 'Hardens her blood into a crystal lance and throws it down the aim line: the first enemy it touches is impaled; if it lands, the blood comes home and heals her 6.',
      icon(g, s) {
        iconGround(g, s);
        thorn(g, s * 0.2, s * 0.82, s * 0.86, s * 0.16, s * 0.2);
        drop(g, s * 0.28, s * 0.36, s * 0.07);
        drop(g, s * 0.68, s * 0.74, s * 0.05);
      },
    },
    {
      // Range 11 is only the duel AI's reach: it blinks when the enemy is out of Q's range; the blink itself is 5 m.
      key: 'W', label: 'blood step', name: 'Blood Step', range: 11, cooldown: 7, dash: true,
      blurb: 'She slips 5 m toward the aim in a blink and leaves a strip of crystal thorns behind: whoever crosses it within 4 s is cut and slowed.',
      icon(g, s) {
        iconGround(g, s);
        // A dashed bone arrow from the lower left to the upper right, thorns standing along it.
        g.strokeStyle = B.bone;
        g.lineWidth = s * 0.035;
        g.setLineDash([s * 0.07, s * 0.05]);
        g.beginPath();
        g.moveTo(s * 0.16, s * 0.8);
        g.lineTo(s * 0.74, s * 0.28);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = B.bone;
        g.beginPath();
        g.moveTo(s * 0.88, s * 0.14);
        g.lineTo(s * 0.64, s * 0.2);
        g.lineTo(s * 0.8, s * 0.36);
        g.closePath();
        g.fill();
        for (const k of [0.1, 0.3, 0.5, 0.7]) {
          const x = s * (0.16 + 0.58 * k), y = s * (0.8 - 0.52 * k);
          thorn(g, x + s * 0.04, y + s * 0.05, x + s * 0.13, y + s * 0.2 - s * 0.02, s * 0.06);
          thorn(g, x - s * 0.04, y - s * 0.05, x - s * 0.15, y - s * 0.17, s * 0.06);
        }
      },
    },
    {
      key: 'E', label: 'crimson pact', name: 'Crimson Pact', range: 0, cooldown: 9,
      buff: { kind: 'might', amount: 0.2, seconds: 3 },
      blurb: 'A heart of blood beats over her and latches onto the nearest enemy within 6 m: three drains, and she heals half of what they deal.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = B.bone;
        g.lineWidth = s * 0.025;
        g.beginPath();
        g.arc(s * 0.5, s * 0.52, s * 0.38, 0, Math.PI * 2);
        g.stroke();
        // Heart.
        const x = s * 0.5, y = s * 0.44, r = s * 0.17;
        g.beginPath();
        g.moveTo(x, y + r * 1.9);
        g.bezierCurveTo(x - r * 2.2, y + r * 0.5, x - r * 1.4, y - r * 1.3, x, y - r * 0.3);
        g.bezierCurveTo(x + r * 1.4, y - r * 1.3, x + r * 2.2, y + r * 0.5, x, y + r * 1.9);
        g.fillStyle = B.body;
        g.fill();
        g.strokeStyle = B.hot;
        g.lineWidth = s * 0.02;
        g.stroke();
        g.fillStyle = B.core;
        g.beginPath();
        g.arc(x - r * 0.7, y + r * 0.1, r * 0.16, 0, Math.PI * 2);
        g.fill();
      },
    },
    {
      key: 'R', label: 'blood bond', name: 'Blood Bond', range: 9, cooldown: 20,
      blurb: 'Ultimate. A thread of blood binds the enemy. Recast within 4 s (after 1.5 s) or let it run out: the bond pops for 50% of the damage she dealt them meanwhile.',
      icon(g, s) {
        iconGround(g, s);
        // Two drops joined by a bone thread, a thorn-star where the thread ends.
        g.strokeStyle = B.bone;
        g.lineWidth = s * 0.03;
        g.beginPath();
        g.moveTo(s * 0.28, s * 0.5);
        g.bezierCurveTo(s * 0.4, s * 0.72, s * 0.6, s * 0.28, s * 0.74, s * 0.5);
        g.stroke();
        drop(g, s * 0.24, s * 0.56, s * 0.1);
        const cx = s * 0.76, cy = s * 0.5;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.2, l = s * (i % 2 ? 0.1 : 0.17);
          thorn(g, cx, cy, cx + Math.cos(a) * l, cy + Math.sin(a) * l, s * 0.06);
        }
        // Bone ring around it all.
        g.beginPath();
        g.arc(s * 0.5, s * 0.5, s * 0.4, 0, Math.PI * 2);
        g.lineWidth = s * 0.02;
        g.stroke();
      },
    },
  ],
};
