import type { HeroKit } from '../heroes';

/**
 * Forge kit data (Brannoc, the Ashen Smith): dark soot ground, ash-grey iron foil, molten orange. Icons are drawn on
 * canvases in the kit palette, one signature shape each (see pipeline/designs/kit-forge.md).
 */
const F = { core: '#fff3d0', hot: '#ffb03a', body: '#ff5a12', accent: '#6fe0ff', dark: '#120a08', ash: '#cfc6b8', iron: '#3a3430', ironLit: '#5a524b' };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.75);
  r.addColorStop(0, '#2c140a');
  r.addColorStop(1, F.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A glowing orange spot of molten metal. */
function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = F.body;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = F.hot;
  g.beginPath(); g.arc(x, y, r * 0.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = F.core;
  g.beginPath(); g.arc(x, y, r * 0.25, 0, Math.PI * 2); g.fill();
}

/** The anvil silhouette: iron body, ash rim line (or a hot one). */
function anvil(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, hot: boolean) {
  const x0 = cx - w / 2, h = w * 0.55;
  g.beginPath();
  g.moveTo(x0, cy - h * 0.45);
  g.lineTo(x0 + w * 0.68, cy - h * 0.45);
  g.lineTo(x0 + w, cy - h * 0.2);
  g.lineTo(x0 + w * 0.68, cy);
  g.lineTo(x0 + w * 0.62, cy);
  g.lineTo(x0 + w * 0.66, cy + h * 0.3);
  g.lineTo(x0 + w * 0.8, cy + h * 0.3);
  g.lineTo(x0 + w * 0.8, cy + h * 0.55);
  g.lineTo(x0 + w * 0.2, cy + h * 0.55);
  g.lineTo(x0 + w * 0.2, cy + h * 0.3);
  g.lineTo(x0 + w * 0.34, cy + h * 0.3);
  g.lineTo(x0 + w * 0.38, cy);
  g.lineTo(x0, cy);
  g.closePath();
  g.fillStyle = F.iron;
  g.fill();
  g.strokeStyle = hot ? F.hot : F.ash;
  g.lineWidth = Math.max(1.5, w * 0.04);
  g.stroke();
}

export const forgeKit: HeroKit = {
  name: 'Brannoc',
  title: 'the Ashen Smith',
  maxHp: 780,
  melee: true,
  accent: F.body,
  foil: F.ash,
  portrait(g, s) {
    ground(g, s);
    // A broad iron helm, an ash beard, and the forge glowing in his chest.
    g.fillStyle = F.iron;
    g.beginPath();
    g.moveTo(s * 0.26, s * 0.52);
    g.quadraticCurveTo(s * 0.26, s * 0.14, s * 0.5, s * 0.14);
    g.quadraticCurveTo(s * 0.74, s * 0.14, s * 0.74, s * 0.52);
    g.lineTo(s * 0.66, s * 0.52);
    g.lineTo(s * 0.66, s * 0.4);
    g.lineTo(s * 0.34, s * 0.4);
    g.lineTo(s * 0.34, s * 0.52);
    g.closePath();
    g.fill();
    g.strokeStyle = F.ash;
    g.lineWidth = s * 0.02;
    g.stroke();
    g.fillStyle = F.hot;
    g.fillRect(s * 0.38, s * 0.36, s * 0.24, s * 0.035);
    g.fillStyle = F.ash;
    g.beginPath();
    g.moveTo(s * 0.32, s * 0.48);
    g.lineTo(s * 0.68, s * 0.48);
    g.lineTo(s * 0.6, s * 0.7);
    g.lineTo(s * 0.5, s * 0.78);
    g.lineTo(s * 0.4, s * 0.7);
    g.closePath();
    g.fill();
    g.fillStyle = F.iron;
    g.fillRect(s * 0.1, s * 0.82, s * 0.24, s * 0.18);
    g.fillRect(s * 0.66, s * 0.82, s * 0.24, s * 0.18);
    glow(g, s * 0.5, s * 0.88, s * 0.1);
  },
  spells: [
    {
      key: 'Q', label: 'chain hammer', name: 'Chain Hammer', range: 9, cooldown: 9, cc: true, aim: 'line',
      blurb: 'Hurls a hammer on a chain 9 m down the aim: 40 damage, drags the first enemy it touches 4 m to him and slows them 1 s. Tempered: stunned 0.75 s.',
      icon(g, s) {
        ground(g, s);
        // A chain of links running from the bottom left to a hammer head at the top right, with a pull arrow over it.
        const link = (x: number, y: number, rot: number, hot: boolean) => {
          g.save();
          g.translate(x, y);
          g.rotate(rot);
          g.strokeStyle = hot ? F.hot : F.ash;
          g.lineWidth = s * 0.05;
          g.beginPath(); g.ellipse(0, 0, s * 0.07, s * 0.04, 0, 0, Math.PI * 2); g.stroke();
          g.restore();
        };
        const rot = -Math.atan2(0.5, 0.52);
        for (let i = 0; i < 6; i++) {
          const k = i / 5;
          link(s * (0.1 + k * 0.5), s * (0.88 - k * 0.5), rot + (i % 2 ? 0.5 : 0), i > 3);
        }
        g.save();
        g.translate(s * 0.68, s * 0.3);
        g.rotate(rot + 0.2);
        g.fillStyle = F.iron;
        g.fillRect(-s * 0.2, -s * 0.12, s * 0.4, s * 0.24);
        g.strokeStyle = F.ash;
        g.lineWidth = s * 0.025;
        g.strokeRect(-s * 0.2, -s * 0.12, s * 0.4, s * 0.24);
        g.fillStyle = F.hot;
        g.fillRect(-s * 0.2, -s * 0.12, s * 0.06, s * 0.24);
        g.fillRect(s * 0.14, -s * 0.12, s * 0.06, s * 0.24);
        g.restore();
        glow(g, s * 0.8, s * 0.2, s * 0.05);
        glow(g, s * 0.34, s * 0.9, s * 0.03);
      },
    },
    {
      key: 'W', label: 'forge roar', name: 'Forge Roar', range: 0, cooldown: 11,
      buff: { kind: 'armor', amount: 0.3, seconds: 3 },
      blurb: 'For 3 s: +30% armour. His next basic attack is a slam: +35 damage, a 0.5 s knock-up and 2 Heat. Tempered: a 0.8 s knock-up. No speed.',
      icon(g, s) {
        ground(g, s);
        // A hot anvil with three roar arcs rolling off its horn and an iron plate edge under it.
        g.strokeStyle = F.ash;
        g.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          g.lineWidth = s * (0.045 - i * 0.008);
          g.beginPath(); g.arc(s * 0.5, s * 0.5, s * (0.26 + i * 0.1), -0.9, 0.9); g.stroke();
          g.beginPath(); g.arc(s * 0.5, s * 0.5, s * (0.26 + i * 0.1), Math.PI - 0.9, Math.PI + 0.9); g.stroke();
        }
        g.strokeStyle = F.hot;
        g.lineWidth = s * 0.03;
        g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.2, -0.7, 0.7); g.stroke();
        anvil(g, s * 0.5, s * 0.5, s * 0.5, true);
        glow(g, s * 0.5, s * 0.36, s * 0.05);
        glow(g, s * 0.12, s * 0.84, s * 0.03);
        glow(g, s * 0.9, s * 0.84, s * 0.03);
      },
    },
    {
      key: 'E', label: 'red-hot rivet', name: 'Red-Hot Rivet', range: 6, cooldown: 4,
      blurb: 'Flicks a white-hot rivet at an enemy in sight (6 m): 25, then 12 burn over 2 s, and 2 Heat. Tempered: the enemy takes 20% more from him for 3 s.',
      icon(g, s) {
        ground(g, s);
        // A big rivet on the diagonal, domed head bottom left, hot tip top right, heat shimmer and sparks around it.
        g.strokeStyle = F.hot;
        g.lineWidth = s * 0.025;
        g.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(s * (0.2 + i * 0.1), s * (0.14 + i * 0.05));
          g.quadraticCurveTo(s * (0.3 + i * 0.1), s * (0.22 + i * 0.05), s * (0.22 + i * 0.1), s * (0.3 + i * 0.05));
          g.stroke();
        }
        g.save();
        g.translate(s * 0.5, s * 0.5);
        g.rotate(-Math.PI / 4);
        g.fillStyle = F.body;
        g.fillRect(-s * 0.3, -s * 0.07, s * 0.55, s * 0.14);
        g.fillStyle = F.hot;
        g.fillRect(-s * 0.3, -s * 0.04, s * 0.55, s * 0.08);
        g.fillStyle = F.core;
        g.beginPath(); g.moveTo(s * 0.25, -s * 0.07); g.lineTo(s * 0.38, 0); g.lineTo(s * 0.25, s * 0.07); g.closePath(); g.fill();
        g.fillStyle = F.iron;
        g.beginPath(); g.ellipse(-s * 0.32, 0, s * 0.1, s * 0.16, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = F.ash;
        g.lineWidth = s * 0.025;
        g.stroke();
        g.restore();
        glow(g, s * 0.82, s * 0.2, s * 0.045);
        glow(g, s * 0.74, s * 0.34, s * 0.03);
        glow(g, s * 0.24, s * 0.82, s * 0.03);
        glow(g, s * 0.4, s * 0.88, s * 0.025);
      },
    },
    {
      key: 'R', label: 'molten core', name: 'Molten Core', range: 6, cooldown: 24,
      blurb: 'For 6 s his chest cracks open: immune to slows, roots and knock-ups, and every basic attack sprays a 3 m cone: +25 damage, +1 Heat. Recast to Quench: he plants himself, a 3 m ring shows for 0.6 s, then it bursts for 30 plus 10 per second left. Tempered: also stunned 0.75 s.',
      icon(g, s) {
        ground(g, s);
        // A broad iron chest plate split by jagged molten cracks around a white-hot heart, sparks flying off the cracks.
        g.fillStyle = F.iron;
        g.beginPath();
        g.moveTo(s * 0.18, s * 0.24);
        g.quadraticCurveTo(s * 0.5, s * 0.1, s * 0.82, s * 0.24);
        g.lineTo(s * 0.78, s * 0.74);
        g.quadraticCurveTo(s * 0.5, s * 0.94, s * 0.22, s * 0.74);
        g.closePath();
        g.fill();
        g.strokeStyle = F.ash;
        g.lineWidth = s * 0.025;
        g.stroke();
        g.lineCap = 'round';
        g.lineJoin = 'round';
        const crack = (pts: [number, number][], w: number) => {
          g.strokeStyle = F.dark;
          g.lineWidth = w + s * 0.025;
          g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(s * x, s * y) : g.moveTo(s * x, s * y))); g.stroke();
          g.strokeStyle = F.body;
          g.lineWidth = w;
          g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(s * x, s * y) : g.moveTo(s * x, s * y))); g.stroke();
          g.strokeStyle = F.hot;
          g.lineWidth = w * 0.4;
          g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(s * x, s * y) : g.moveTo(s * x, s * y))); g.stroke();
        };
        crack([[0.5, 0.5], [0.4, 0.38], [0.44, 0.28], [0.34, 0.2]], s * 0.045);
        crack([[0.5, 0.5], [0.62, 0.4], [0.58, 0.3], [0.7, 0.22]], s * 0.04);
        crack([[0.5, 0.5], [0.36, 0.6], [0.3, 0.72]], s * 0.04);
        crack([[0.5, 0.5], [0.64, 0.62], [0.62, 0.8]], s * 0.035);
        glow(g, s * 0.5, s * 0.5, s * 0.12);
        glow(g, s * 0.2, s * 0.14, s * 0.03);
        glow(g, s * 0.82, s * 0.14, s * 0.035);
        glow(g, s * 0.5, s * 0.94, s * 0.03);
      },
    },
  ],
};
