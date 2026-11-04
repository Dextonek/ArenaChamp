import type { HeroKit } from '../heroes';

/** Blood kit data (Vesper, the Crimson Countess): four spells with canvas-drawn icons in the kit's palette. Kits v5. */

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
      key: 'Q', label: 'lancet', name: 'Lancet', range: 7, cooldown: 4,
      blurb: 'A blood needle (7 m): 40 damage, and it stays in for 3 s. From 1 s on, cast again to rip it out: 35 more and 20 HP back, only while she sees them within 8 m.',
      icon(g, s) {
        iconGround(g, s);
        // A long bone needle driven into a drop, a thread running back from its eye.
        g.strokeStyle = B.bone;
        g.lineWidth = s * 0.028;
        g.beginPath();
        g.moveTo(s * 0.12, s * 0.9);
        g.bezierCurveTo(s * 0.12, s * 0.62, s * 0.3, s * 0.78, s * 0.32, s * 0.6);
        g.stroke();
        thorn(g, s * 0.26, s * 0.74, s * 0.84, s * 0.2, s * 0.13);
        drop(g, s * 0.66, s * 0.66, s * 0.09);
        drop(g, s * 0.34, s * 0.36, s * 0.05);
      },
    },
    {
      // Range 11 is only the duel AI's reach: it flows in when the enemy is out of Q's range; the flow itself is 5 m.
      key: 'W', label: 'mist waltz', name: 'Mist Waltz', range: 11, cooldown: 11, dash: true,
      blurb: 'She flows 5 m as mist. Her next two basic attacks within 3 s reach 1.5 m farther and deal +18.',
      icon(g, s) {
        iconGround(g, s);
        // Three soft wisps trailing off a bone arrow, a mist of drops.
        for (const [x, y, r, a] of [[0.24, 0.72, 0.17, 0.5], [0.42, 0.58, 0.19, 0.65], [0.6, 0.44, 0.17, 0.8]]) {
          g.fillStyle = `rgba(140,15,34,${a})`;
          g.beginPath();
          g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = `rgba(233,220,198,${a})`;
          g.lineWidth = s * 0.014;
          g.beginPath();
          g.arc(s * x, s * y, s * r, Math.PI * 1.05, Math.PI * 1.7);
          g.stroke();
        }
        g.fillStyle = B.bone;
        g.beginPath();
        g.moveTo(s * 0.9, s * 0.16);
        g.lineTo(s * 0.64, s * 0.2);
        g.lineTo(s * 0.84, s * 0.4);
        g.closePath();
        g.fill();
        drop(g, s * 0.3, s * 0.34, s * 0.05);
        drop(g, s * 0.68, s * 0.78, s * 0.05);
      },
    },
    {
      key: 'E', label: 'hemocurse', name: 'Hemocurse', range: 7, cooldown: 12,
      blurb: 'A curse (7 m): 25 damage, for 3 s. Each spell the enemy casts costs them 30 HP, and if she is Hungry she heals 15. It breaks at 8 m or without sight.',
      icon(g, s) {
        iconGround(g, s);
        // A bone ring with a drop inside, thorned like a sigil, a broken link at the bottom.
        g.strokeStyle = B.bone;
        g.lineWidth = s * 0.03;
        g.beginPath();
        g.arc(s * 0.5, s * 0.5, s * 0.36, Math.PI * 0.62, Math.PI * 2.38);
        g.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3, r = s * 0.36;
          if (Math.sin(a) > 0.75) continue;
          thorn(g, s * 0.5 + Math.cos(a) * r, s * 0.5 + Math.sin(a) * r, s * 0.5 + Math.cos(a) * (r + s * 0.12), s * 0.5 + Math.sin(a) * (r + s * 0.12), s * 0.07);
        }
        drop(g, s * 0.5, s * 0.55, s * 0.13);
        g.fillStyle = B.hot;
        g.beginPath();
        g.arc(s * 0.5, s * 0.84, s * 0.025, 0, Math.PI * 2);
        g.fill();
      },
    },
    {
      key: 'R', label: 'sanguine feast', name: 'Sanguine Feast', range: 8, cooldown: 24,
      blurb: 'Ultimate. She roots herself and drinks (8 m) for 1.6 s: pulses of 35, 35, then 40 plus 20% of their missing HP, and 45 HP back if she is Hungry. A stun or silence, cover, or 9 m of distance ends it.',
      icon(g, s) {
        iconGround(g, s);
        // Two fangs over a falling drop, a bone ring round the whole.
        g.strokeStyle = B.bone;
        g.lineWidth = s * 0.022;
        g.beginPath();
        g.arc(s * 0.5, s * 0.5, s * 0.4, 0, Math.PI * 2);
        g.stroke();
        thorn(g, s * 0.34, s * 0.2, s * 0.4, s * 0.58, s * 0.16);
        thorn(g, s * 0.66, s * 0.2, s * 0.6, s * 0.58, s * 0.16);
        drop(g, s * 0.5, s * 0.74, s * 0.1);
      },
    },
  ],
};
