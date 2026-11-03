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
      key: 'Q', label: 'slag flick', name: 'Slag Flick', range: 7, cooldown: 3, aim: 'line',
      blurb: 'Flicks a gob of white-hot slag 7 m down the aim. The first enemy it touches takes damage and is slowed for 1 s.',
      icon(g, s) {
        ground(g, s);
        // A long hot streak across the frame ending in a molten gob, a dotted line ahead of it, sparks behind.
        const grad = g.createLinearGradient(s * 0.06, s * 0.9, s * 0.74, s * 0.26);
        grad.addColorStop(0, 'rgba(255,90,18,0)');
        grad.addColorStop(1, F.hot);
        g.strokeStyle = grad;
        g.lineWidth = s * 0.13;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(s * 0.06, s * 0.9); g.lineTo(s * 0.7, s * 0.3); g.stroke();
        g.strokeStyle = F.ash;
        g.lineWidth = s * 0.02;
        g.setLineDash([s * 0.03, s * 0.05]);
        g.beginPath(); g.moveTo(s * 0.78, s * 0.22); g.lineTo(s * 0.95, s * 0.06); g.stroke();
        g.setLineDash([]);
        glow(g, s * 0.72, s * 0.28, s * 0.13);
        glow(g, s * 0.34, s * 0.84, s * 0.04);
        glow(g, s * 0.52, s * 0.86, s * 0.03);
        glow(g, s * 0.2, s * 0.62, s * 0.03);
      },
    },
    {
      key: 'W', label: 'anvil drop', name: 'Anvil Drop', range: 8, cooldown: 5,
      blurb: 'Lobs a small anvil (2 m circle) onto the spot; whoever is under it is knocked aside and slowed for 1.5 s.',
      icon(g, s) {
        ground(g, s);
        g.strokeStyle = F.ash;
        g.lineWidth = s * 0.03;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.78, s * 0.4, s * 0.12, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = F.hot;
        g.lineWidth = s * 0.025;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          g.beginPath();
          g.moveTo(s * 0.5 + Math.cos(a) * s * 0.31, s * 0.78 + Math.sin(a) * s * 0.075);
          g.lineTo(s * 0.5 + Math.cos(a + 0.2) * s * 0.34, s * 0.78 + Math.sin(a + 0.2) * s * 0.085);
          g.stroke();
        }
        anvil(g, s * 0.5, s * 0.42, s * 0.62, true);
        glow(g, s * 0.2, s * 0.82, s * 0.045);
        glow(g, s * 0.82, s * 0.8, s * 0.05);
      },
    },
    {
      key: 'E', label: 'bellows ward', name: 'Bellows Ward', range: 0, cooldown: 9,
      buff: { kind: 'armor', amount: 0.25, seconds: 3 },
      blurb: 'Two loops of molten chain whirl around him: a shield of 100 for 3 s, and each burst drags nearby enemies 1.5 m toward him.',
      icon(g, s) {
        ground(g, s);
        const link = (x: number, y: number, rot: number, hot: boolean) => {
          g.save();
          g.translate(x, y);
          g.rotate(rot);
          g.strokeStyle = hot ? F.body : F.ash;
          g.lineWidth = s * 0.055;
          g.beginPath(); g.ellipse(0, 0, s * 0.075, s * 0.045, 0, 0, Math.PI * 2); g.stroke();
          g.restore();
        };
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          link(s * 0.5 + Math.cos(a) * s * 0.36, s * 0.5 + Math.sin(a) * s * 0.36, a + Math.PI / 2, false);
        }
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.3;
          link(s * 0.5 + Math.cos(a) * s * 0.2, s * 0.5 + Math.sin(a) * s * 0.2, a + Math.PI / 2, true);
        }
        glow(g, s * 0.5, s * 0.5, s * 0.08);
      },
    },
    {
      key: 'R', label: 'forge charge', name: 'Forge Charge', range: 8, cooldown: 20, cc: true, aim: 'line',
      blurb: 'Ultimate. Charges 8 m down the aim and carries the first enemy he touches. Slam it into a wall or pillar on the way and the charge stops there: 110 damage and a 1.2 s stun. In the open it is knocked up at the end (62 damage).',
      icon(g, s) {
        ground(g, s);
        // A stone wall on the right with a molten crack, an iron body pressed into it, speed streaks driving in from the left.
        g.fillStyle = F.iron;
        g.fillRect(s * 0.74, s * 0.14, s * 0.2, s * 0.74);
        g.strokeStyle = F.ash;
        g.lineWidth = s * 0.02;
        g.strokeRect(s * 0.74, s * 0.14, s * 0.2, s * 0.74);
        for (let i = 1; i < 5; i++) {
          g.beginPath(); g.moveTo(s * 0.74, s * (0.14 + i * 0.148)); g.lineTo(s * 0.94, s * (0.14 + i * 0.148)); g.stroke();
        }
        g.strokeStyle = F.body;
        g.lineWidth = s * 0.03;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(s * 0.74, s * 0.5); g.lineTo(s * 0.82, s * 0.42); g.lineTo(s * 0.78, s * 0.3); g.stroke();
        g.beginPath(); g.moveTo(s * 0.74, s * 0.5); g.lineTo(s * 0.84, s * 0.6); g.lineTo(s * 0.8, s * 0.74); g.stroke();
        // The caught body, then the charging smith: a broad helm and shoulders with chevrons behind.
        g.fillStyle = F.ironLit;
        g.beginPath(); g.ellipse(s * 0.66, s * 0.5, s * 0.075, s * 0.16, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = F.ash; g.lineWidth = s * 0.02; g.stroke();
        g.fillStyle = F.iron;
        g.beginPath();
        g.moveTo(s * 0.26, s * 0.34); g.lineTo(s * 0.5, s * 0.36); g.lineTo(s * 0.58, s * 0.5); g.lineTo(s * 0.5, s * 0.66); g.lineTo(s * 0.26, s * 0.68);
        g.quadraticCurveTo(s * 0.2, s * 0.5, s * 0.26, s * 0.34);
        g.closePath(); g.fill();
        g.strokeStyle = F.ash; g.lineWidth = s * 0.022; g.stroke();
        g.fillStyle = F.hot;
        g.fillRect(s * 0.44, s * 0.46, s * 0.1, s * 0.035);
        g.strokeStyle = F.hot;
        g.lineWidth = s * 0.035;
        for (let i = 0; i < 3; i++) {
          g.beginPath(); g.moveTo(s * (0.06 + i * 0.06), s * (0.36 + i * 0.14)); g.lineTo(s * (0.2 + i * 0.03), s * 0.5); g.lineTo(s * (0.06 + i * 0.06), s * (0.64 - i * 0.14)); g.stroke();
        }
        glow(g, s * 0.72, s * 0.5, s * 0.06);
        glow(g, s * 0.62, s * 0.8, s * 0.035);
        glow(g, s * 0.58, s * 0.2, s * 0.03);
      },
    },
  ],
};
