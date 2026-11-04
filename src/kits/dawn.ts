import type { HeroKit } from '../heroes';

/**
 * Dawn kit data (Auriel, the Dawn Paladin), kits v5: First Light, Dawnward, Oathbrand, Sunrise, with canvas-drawn icons in
 * the kit's palette. Her passive and every number live in `src/traits/dawn.ts`. Signature shape:
 * hard-light geometry, flat gold panels with crisp edges, a dark amber rim and a thin white core line. See
 * pipeline/designs/kit-dawn.md.
 */
const D = { core: '#fffdf2', hot: '#ffe7a0', body: '#f2b83c', accent: '#7fd8ff', dark: '#3a2408', foil: '#efe6d2' };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#6a4514');
  r.addColorStop(1, '#1a1006');
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** Fills a closed polygon as a hard-light panel: dark amber rim, face, thin white core line inside. */
function panel(g: CanvasRenderingContext2D, pts: [number, number][], s: number, face = D.body) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = face;
  g.fill();
  g.lineJoin = 'round';
  g.strokeStyle = D.dark;
  g.lineWidth = Math.max(1.5, s * 0.026);
  g.stroke();
  // Core line: the outline pulled inward, drawn thin and pale.
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const px = cx + (x - cx) * 0.62, py = cy + (y - cy) * 0.62;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  });
  g.closePath();
  g.strokeStyle = D.core;
  g.lineWidth = Math.max(1, s * 0.01);
  g.stroke();
}

/** A long blade shard from the base (x1, y1) to the tip (x2, y2), `w` wide. */
function shard(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, s: number, face = D.body) {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
  const at = (a: number, b: number): [number, number] => [x1 + ux * l * a + nx * w * b, y1 + uy * l * a + ny * w * b];
  panel(g, [at(1, 0), at(0.62, 0.5), at(0, 0.36), at(0, -0.36), at(0.62, -0.5)], s, face);
}

function hex(g: CanvasRenderingContext2D, x: number, y: number, r: number, s: number, face = D.body) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) pts.push([x + Math.cos((i / 6) * Math.PI * 2 + 0.5236) * r, y + Math.sin((i / 6) * Math.PI * 2 + 0.5236) * r]);
  panel(g, pts, s, face);
}

/** A kite shield with its flat top at y and its point at y + h. */
function shield(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number, face = D.body) {
  panel(g, [[x - w / 2, y], [x + w / 2, y], [x + w / 2, y + h * 0.5], [x, y + h], [x - w / 2, y + h * 0.5]], s, face);
}

function ring(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, w: number, col: string) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.strokeStyle = col;
  g.lineWidth = w;
  g.stroke();
}

/** The sun-wheel sigil seen from above: ivory band, gold ring, ray ticks. */
function sigil(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, s: number) {
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(58,36,8,0.7)'; g.fill();
  ring(g, x, y, rx, ry, s * 0.03, D.dark);
  ring(g, x, y, rx * 0.97, ry * 0.97, s * 0.018, D.body);
  ring(g, x, y, rx * 0.74, ry * 0.74, s * 0.022, D.foil);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * rx * 0.3, y + Math.sin(a) * ry * 0.3);
    g.lineTo(x + Math.cos(a) * rx * 0.68, y + Math.sin(a) * ry * 0.68);
    g.strokeStyle = D.body;
    g.lineWidth = s * 0.014;
    g.stroke();
  }
}

function spark(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = D.accent;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, rr = i % 2 === 0 ? r : r * 0.38;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

export const dawnKit: HeroKit = {
  name: 'Auriel',
  title: 'the Dawn Paladin',
  accent: D.body,
  foil: D.foil,
  maxHp: 550,
  portrait(g, s) {
    ground(g, s);
    // A sun disc with crisp rays behind her, a halo ring, and a helmed paladin in white and gold plate.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.beginPath();
      g.moveTo(s * 0.5 + Math.cos(a - 0.07) * s * 0.28, s * 0.4 + Math.sin(a - 0.07) * s * 0.28);
      g.lineTo(s * 0.5 + Math.cos(a) * s * (i % 2 ? 0.52 : 0.68), s * 0.4 + Math.sin(a) * s * (i % 2 ? 0.52 : 0.68));
      g.lineTo(s * 0.5 + Math.cos(a + 0.07) * s * 0.28, s * 0.4 + Math.sin(a + 0.07) * s * 0.28);
      g.closePath();
      g.fillStyle = 'rgba(255,231,160,0.28)';
      g.fill();
    }
    g.beginPath(); g.arc(s * 0.5, s * 0.4, s * 0.27, 0, Math.PI * 2); g.fillStyle = D.foil; g.fill();
    g.lineWidth = s * 0.018; g.strokeStyle = D.dark; g.stroke();
    // Shoulders (pauldrons) and breastplate.
    panel(g, [[s * 0.1, s], [s * 0.12, s * 0.8], [s * 0.3, s * 0.7], [s * 0.4, s * 0.72], [s * 0.42, s]], s, D.body);
    panel(g, [[s * 0.9, s], [s * 0.88, s * 0.8], [s * 0.7, s * 0.7], [s * 0.6, s * 0.72], [s * 0.58, s]], s, D.body);
    panel(g, [[s * 0.38, s], [s * 0.4, s * 0.7], [s * 0.6, s * 0.7], [s * 0.62, s]], s, D.foil);
    // Helm: a hex with a dark visor slit and a sky-blue glint.
    hex(g, s * 0.5, s * 0.46, s * 0.19, s, D.foil);
    g.fillStyle = D.dark;
    g.fillRect(s * 0.41, s * 0.44, s * 0.18, s * 0.035);
    g.fillStyle = D.accent;
    g.fillRect(s * 0.44, s * 0.448, s * 0.12, s * 0.014);
    // The halo ring above the head.
    ring(g, s * 0.5, s * 0.22, s * 0.17, s * 0.055, s * 0.032, D.dark);
    ring(g, s * 0.5, s * 0.22, s * 0.17, s * 0.055, s * 0.018, D.body);
    // A raised blade at her side.
    shard(g, s * 0.84, s * 0.72, s * 0.76, s * 0.1, s * 0.07, s, D.hot);
  },
  spells: [
    {
      key: 'Q', label: 'first light', name: 'First Light', range: 6, cooldown: 4,
      blurb: 'A wave of light in a 6 m cone: 50. Hitting the enemy gives her a 30 shield for 3 s, but not while Dawnward or Sunrise holds. When that shield ends it bursts for 18 in 3 m.',
      icon(g, s) {
        ground(g, s);
        sigil(g, s * 0.3, s * 0.84, s * 0.2, s * 0.06, s);
        // Five shards fanning out of a sun disc at the lower left, a small kite shield at its foot.
        for (let i = 0; i < 5; i++) {
          const a = -0.95 + i * 0.42, ox = s * 0.24, oy = s * 0.76, len = s * (i === 2 ? 0.78 : 0.62);
          shard(g, ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len, s * (i === 2 ? 0.11 : 0.085), s, i % 2 ? D.hot : i === 2 ? D.foil : D.body);
        }
        ring(g, s * 0.24, s * 0.76, s * 0.12, s * 0.12, s * 0.03, D.dark);
        ring(g, s * 0.24, s * 0.76, s * 0.12, s * 0.12, s * 0.016, D.body);
        hex(g, s * 0.24, s * 0.76, s * 0.075, s, D.foil);
        shield(g, s * 0.2, s * 0.5, s * 0.14, s * 0.2, s, D.hot);
        spark(g, s * 0.84, s * 0.14, s * 0.09);
      },
    },
    {
      key: 'W', label: 'dawnward', name: 'Dawnward', range: 0, cooldown: 9,
      blurb: 'A 70 shield for 3 s. While it holds, her basic attacks reach 3 m farther. Press again to pop it now. When it ends it bursts for 42 in 3 m. It cannot be cast while Sunrise holds.',
      icon(g, s) {
        ground(g, s);
        sigil(g, s * 0.5, s * 0.86, s * 0.4, s * 0.09, s);
        // Shield shards thrown out round a big kite shield that carries a sun.
        const pieces: [number, number, number][] = [[0.14, 0.32, 0.09], [0.86, 0.32, 0.09], [0.1, 0.62, 0.08], [0.9, 0.62, 0.08], [0.3, 0.12, 0.07], [0.7, 0.12, 0.07]];
        pieces.forEach(([x, y, w], i) => shield(g, s * x, s * y, s * w * 1.5, s * w * 2.4, s, i % 2 ? D.hot : D.body));
        shield(g, s * 0.5, s * 0.14, s * 0.46, s * 0.68, s, D.foil);
        shield(g, s * 0.5, s * 0.22, s * 0.32, s * 0.5, s, D.body);
        ring(g, s * 0.5, s * 0.42, s * 0.1, s * 0.1, s * 0.026, D.dark);
        hex(g, s * 0.5, s * 0.42, s * 0.085, s, D.hot);
        spark(g, s * 0.5, s * 0.42, s * 0.05);
      },
    },
    {
      key: 'E', label: 'oathbrand', name: 'Oathbrand', range: 7, cooldown: 11,
      blurb: 'A beam falls on the enemy (7 m) 0.5 s later if she still has sight: 50, and branded for 2.5 s. A burst that catches a branded enemy also stuns them 0.8 s.',
      icon(g, s) {
        ground(g, s);
        sigil(g, s * 0.5, s * 0.8, s * 0.38, s * 0.1, s);
        ring(g, s * 0.5, s * 0.8, s * 0.2, s * 0.055, s * 0.016, D.core);
        // A column of light falling on a brand: a hexagon cut with a sun, the beam's tip bright.
        shard(g, s * 0.5, s * 0.02, s * 0.5, s * 0.74, s * 0.3, s, D.hot);
        shard(g, s * 0.5, s * 0.06, s * 0.5, s * 0.72, s * 0.12, s, D.foil);
        hex(g, s * 0.5, s * 0.64, s * 0.15, s, D.body);
        hex(g, s * 0.5, s * 0.64, s * 0.09, s, D.foil);
        spark(g, s * 0.5, s * 0.64, s * 0.07);
        shard(g, s * 0.2, s * 0.3, s * 0.34, s * 0.5, s * 0.06, s, D.body);
        shard(g, s * 0.8, s * 0.3, s * 0.66, s * 0.5, s * 0.06, s, D.body);
      },
    },
    {
      key: 'R', label: 'sunrise', name: 'Sunrise', range: 0, cooldown: 24,
      blurb: 'A 200 shield for 5 s, and she floats. Press again to pop it. When it breaks, runs out or is popped, a 5 m ring appears fixed at her spot, closes for 1.6 s and bursts for 120. It does not follow her.',
      icon(g, s) {
        ground(g, s);
        // The big closing ring on the floor, and a sun rising over a kite shield at its centre.
        sigil(g, s * 0.5, s * 0.76, s * 0.46, s * 0.15, s);
        ring(g, s * 0.5, s * 0.76, s * 0.3, s * 0.095, s * 0.02, D.core);
        for (let i = 0; i < 13; i++) {
          const a = Math.PI + (i / 12) * Math.PI;
          g.beginPath();
          g.moveTo(s * 0.5 + Math.cos(a - 0.08) * s * 0.26, s * 0.58 + Math.sin(a - 0.08) * s * 0.26);
          g.lineTo(s * 0.5 + Math.cos(a) * s * (i % 2 ? 0.4 : 0.52), s * 0.58 + Math.sin(a) * s * (i % 2 ? 0.4 : 0.52));
          g.lineTo(s * 0.5 + Math.cos(a + 0.08) * s * 0.26, s * 0.58 + Math.sin(a + 0.08) * s * 0.26);
          g.closePath();
          g.fillStyle = i % 2 ? D.body : D.hot;
          g.fill();
          g.lineWidth = s * 0.012;
          g.strokeStyle = D.dark;
          g.stroke();
        }
        g.beginPath(); g.arc(s * 0.5, s * 0.58, s * 0.24, Math.PI, Math.PI * 2); g.closePath();
        g.fillStyle = D.foil; g.fill(); g.lineWidth = s * 0.026; g.strokeStyle = D.dark; g.stroke();
        g.beginPath(); g.arc(s * 0.5, s * 0.58, s * 0.14, Math.PI, Math.PI * 2); g.closePath();
        g.fillStyle = D.hot; g.fill();
        shield(g, s * 0.5, s * 0.5, s * 0.2, s * 0.3, s, D.body);
        hex(g, s * 0.5, s * 0.2, s * 0.06, s, D.foil);
      },
    },
  ],
};
