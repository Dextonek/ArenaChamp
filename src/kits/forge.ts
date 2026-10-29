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

/** A hammer: head centred at (cx, cy), the handle rising `handleLen` above it. */
function hammer(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, handleLen: number) {
  g.strokeStyle = F.ash;
  g.lineWidth = Math.max(1.5, w * 0.03);
  g.fillStyle = F.iron;
  g.fillRect(cx - w * 0.07, cy - handleLen, w * 0.14, handleLen);
  g.strokeRect(cx - w * 0.07, cy - handleLen, w * 0.14, handleLen);
  g.fillRect(cx - w / 2, cy - w * 0.22, w, w * 0.44);
  g.strokeRect(cx - w / 2, cy - w * 0.22, w, w * 0.44);
  g.fillStyle = F.ironLit;
  g.fillRect(cx - w / 2 + 2, cy - w * 0.22 + 2, w - 4, w * 0.1);
}

export const forgeKit: HeroKit = {
  name: 'Brannoc',
  title: 'the Ashen Smith',
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
      key: 'Q', label: 'rivet shot', name: 'Rivet Shot', range: 10, cooldown: 3,
      blurb: 'Pulls a white-hot rivet from his chest forge and flicks it through one enemy. The slag cools to black.',
      icon(g, s) {
        ground(g, s);
        // A rivet flying up-right on a hot streak.
        const grad = g.createLinearGradient(s * 0.1, s * 0.9, s * 0.68, s * 0.32);
        grad.addColorStop(0, 'rgba(255,90,18,0)');
        grad.addColorStop(1, F.hot);
        g.strokeStyle = grad;
        g.lineWidth = s * 0.1;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(s * 0.1, s * 0.9); g.lineTo(s * 0.66, s * 0.34); g.stroke();
        g.save();
        g.translate(s * 0.7, s * 0.3);
        g.rotate(Math.PI / 4);
        g.fillStyle = F.iron;
        g.fillRect(-s * 0.05, -s * 0.2, s * 0.1, s * 0.3);
        g.fillStyle = F.core;
        g.fillRect(-s * 0.03, -s * 0.2, s * 0.06, s * 0.1);
        g.fillStyle = F.ash;
        g.fillRect(-s * 0.15, s * 0.1, s * 0.3, s * 0.06);
        g.restore();
        glow(g, s * 0.78, s * 0.82, s * 0.07);
        glow(g, s * 0.62, s * 0.88, s * 0.04);
      },
    },
    {
      key: 'W', label: 'anvil drop', name: 'Anvil Drop', range: 10, cooldown: 7,
      blurb: 'A ring of molten runes marks the ground, then a huge anvil falls on it and splashes slag.',
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
      blurb: 'Two loops of molten chain whirl around him and burst outward in heat twice, then cool and fall.',
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
      key: 'R', label: 'forgefall', name: 'Forgefall', range: 13, cooldown: 20,
      blurb: 'Ultimate. Slag pours into the sky, forms a colossal hammer, and brings it down on the zone.',
      icon(g, s) {
        ground(g, s);
        // Molten crack web on the ground, ash ring around it.
        g.strokeStyle = F.body;
        g.lineWidth = s * 0.03;
        g.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.2;
          g.beginPath();
          g.moveTo(s * 0.5, s * 0.78);
          g.lineTo(s * 0.5 + Math.cos(a) * s * 0.42, s * 0.78 + Math.sin(a) * s * 0.15);
          g.stroke();
        }
        g.strokeStyle = F.ash;
        g.lineWidth = s * 0.02;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.78, s * 0.45, s * 0.16, 0, 0, Math.PI * 2); g.stroke();
        hammer(g, s * 0.5, s * 0.5, s * 0.6, s * 0.38);
        glow(g, s * 0.5, s * 0.76, s * 0.06);
      },
    },
  ],
};
