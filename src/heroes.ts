/**
 * Hero kits for hero mode (`src/heroMode.ts`): four spells bound to Q / W / E / R, R being the ultimate. A kit is
 * data only; a new hero is a new entry here, its spells are ordinary registered effects (looked up by label).
 */
export type HeroKey = 'Q' | 'W' | 'E' | 'R';

export interface HeroSpell {
  key: HeroKey;
  /** Effect label (as registered). */
  label: string;
  /** Name shown on the bar. */
  name: string;
  /** Cast range from the hero (ground units). Ignored for self-cast spells. */
  range: number;
  /** Seconds before it can be cast again. */
  cooldown: number;
  /** One-line tooltip. */
  blurb: string;
  /** Draws the slot icon into a `size` × `size` canvas. */
  icon: (g: CanvasRenderingContext2D, size: number) => void;
}

export interface HeroKit {
  name: string;
  title: string;
  /** Accent colour of the bar and the aim indicators (css). */
  accent: string;
  /** Pale foil colour for rings and text (css). */
  foil: string;
  /** Draws the portrait into a `size` × `size` canvas. */
  portrait: (g: CanvasRenderingContext2D, size: number) => void;
  spells: [HeroSpell, HeroSpell, HeroSpell, HeroSpell];
}

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

const bloodKit: HeroKit = {
  name: 'Vesper',
  title: 'the Crimson Countess',
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
      key: 'Q', label: 'hemolance', name: 'Hemolance', range: 11, cooldown: 2.5,
      blurb: 'Hardens her blood into a crystal lance and impales one enemy. The blood comes home.',
      icon(g, s) {
        iconGround(g, s);
        thorn(g, s * 0.2, s * 0.82, s * 0.86, s * 0.16, s * 0.2);
        drop(g, s * 0.28, s * 0.36, s * 0.07);
        drop(g, s * 0.68, s * 0.74, s * 0.05);
      },
    },
    {
      key: 'W', label: 'thorn garden', name: 'Thorn Garden', range: 10, cooldown: 6,
      blurb: 'A pool of blood inside a bone sigil freezes upward into a thicket of thorns.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = B.bone;
        g.lineWidth = s * 0.03;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.8, s * 0.38, s * 0.1, 0, 0, Math.PI * 2);
        g.stroke();
        const spikes: [number, number, number][] = [[0.24, 0.42, 0.13], [0.38, 0.22, 0.15], [0.52, 0.12, 0.17], [0.66, 0.26, 0.15], [0.78, 0.46, 0.12]];
        for (const [x, top, w] of spikes) thorn(g, s * x, s * 0.82, s * (x + (x - 0.5) * 0.25), s * top, s * w);
      },
    },
    {
      key: 'E', label: 'crimson pact', name: 'Crimson Pact', range: 0, cooldown: 9,
      blurb: 'A heart of blood beats over her and drains every enemy nearby.',
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
      key: 'R', label: 'sanguine eclipse', name: 'Sanguine Eclipse', range: 13, cooldown: 20,
      blurb: 'Ultimate. A bleeding moon rises; all the blood in the zone freezes into a thorn-star that falls on it.',
      icon(g, s) {
        iconGround(g, s);
        // Bone moon, red running down from the top.
        g.save();
        g.beginPath();
        g.arc(s * 0.5, s * 0.36, s * 0.24, 0, Math.PI * 2);
        g.fillStyle = B.bone;
        g.fill();
        g.clip();
        g.fillStyle = B.body;
        g.fillRect(0, 0, s, s * 0.22);
        for (const [x, l, w] of [[0.32, 0.18, 0.05], [0.42, 0.08, 0.04], [0.52, 0.22, 0.06], [0.63, 0.11, 0.04], [0.7, 0.16, 0.05]]) {
          g.fillRect(s * (x - w / 2), s * 0.2, s * w, s * l);
          g.beginPath();
          g.arc(s * x, s * (0.2 + l), s * w * 0.6, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
        // Thorn-star below it.
        const cx = s * 0.5, cy = s * 0.72;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.2, l = s * (i % 2 ? 0.13 : 0.22);
          thorn(g, cx, cy, cx + Math.cos(a) * l, cy + Math.sin(a) * l, s * 0.07);
        }
      },
    },
  ],
};

export const HERO_KITS: HeroKit[] = [bloodKit];
