import type { HeroKit } from '../heroes';

/**
 * Dawn kit data (Auriel, the Dawn Paladin): four spells with canvas-drawn icons in the kit's palette. Signature shape:
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
  maxHp: 600,
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
      key: 'Q', label: 'radiant spear', name: 'Radiant Spear', range: 12, cooldown: 3, aim: 'line',
      blurb: 'Fires a spear of light along the aim that pierces everything it meets; a hit shields her for 10.',
      icon(g, s) {
        ground(g, s);
        sigil(g, s * 0.72, s * 0.8, s * 0.22, s * 0.07, s);
        // Six shards in a line from the lower left to the upper right.
        for (let i = 0; i < 6; i++) {
          const t = i / 6, x = s * (0.1 + t * 0.62), y = s * (0.86 - t * 0.6);
          shard(g, x, y, x + s * 0.17, y - s * 0.115, s * (i === 5 ? 0.1 : 0.075), s, i % 2 ? D.hot : i === 5 ? D.foil : D.body);
        }
        spark(g, s * 0.8, s * 0.2, s * 0.1);
      },
    },
    {
      key: 'W', label: 'aegis wall', name: 'Aegis Wall', range: 10, cooldown: 7, cc: true,
      blurb: 'A ring of shields stands open for 1.2 s, then closes into a dome that stuns whoever is still inside.',
      icon(g, s) {
        ground(g, s);
        sigil(g, s * 0.5, s * 0.84, s * 0.4, s * 0.1, s);
        // Five shields standing in an arc, the centre one tallest.
        const xs = [0.14, 0.3, 0.5, 0.7, 0.86], hs = [0.4, 0.5, 0.62, 0.5, 0.4], ws = [0.17, 0.2, 0.26, 0.2, 0.17];
        for (let i = 0; i < 5; i++) {
          const face = i === 2 ? D.foil : i % 2 ? D.hot : D.body;
          shield(g, s * xs[i], s * (0.8 - hs[i]), s * ws[i], s * hs[i], s, face);
        }
        hex(g, s * 0.5, s * 0.12, s * 0.07, s, D.hot);
      },
    },
    {
      key: 'E', label: 'radiant parry', name: 'Radiant Parry', range: 0, cooldown: 11, parry: true,
      blurb: 'A sun-shield stance for 0.6 s. The first hit on her in that window is parried: no damage, and the enemy takes 20 and is stunned 0.6 s (a summoned unit is parried without the stun). If nothing hits her the stance fades.',
      icon(g, s) {
        ground(g, s);
        sigil(g, s * 0.5, s * 0.86, s * 0.4, s * 0.09, s);
        // A halo of ray ticks behind a big kite shield, a blade glancing off it, and the flash of the parry.
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          g.beginPath();
          g.moveTo(s * 0.5 + Math.cos(a - 0.1) * s * 0.3, s * 0.46 + Math.sin(a - 0.1) * s * 0.3);
          g.lineTo(s * 0.5 + Math.cos(a) * s * (i % 2 ? 0.46 : 0.6), s * 0.46 + Math.sin(a) * s * (i % 2 ? 0.46 : 0.6));
          g.lineTo(s * 0.5 + Math.cos(a + 0.1) * s * 0.3, s * 0.46 + Math.sin(a + 0.1) * s * 0.3);
          g.closePath();
          g.fillStyle = 'rgba(255,231,160,0.26)';
          g.fill();
        }
        ring(g, s * 0.5, s * 0.46, s * 0.34, s * 0.34, s * 0.03, D.dark);
        ring(g, s * 0.5, s * 0.46, s * 0.34, s * 0.34, s * 0.016, D.body);
        shield(g, s * 0.5, s * 0.16, s * 0.46, s * 0.62, s, D.foil);
        shield(g, s * 0.5, s * 0.26, s * 0.3, s * 0.4, s, D.hot);
        hex(g, s * 0.5, s * 0.4, s * 0.06, s, D.body);
        // The deflected blade, snapped away to the upper right.
        shard(g, s * 0.78, s * 0.36, s * 0.92, s * 0.1, s * 0.07, s, D.body);
        spark(g, s * 0.74, s * 0.3, s * 0.12);
      },
    },
    {
      key: 'R', label: 'dawn descent', name: 'Dawn Descent', range: 12, cooldown: 16, dash: true, cc: true,
      blurb: 'Ultimate. She leaps up to 12 m in a high arc and cannot be touched while airborne (1 s). She lands on the aimed spot: a 2.5 m zone takes 40 and stuns 1 s, and a shield of 40 wraps her for 3 s.',
      icon(g, s) {
        ground(g, s);
        // The landing zone at the bottom right, the arc of the leap from the upper left, a figure of shards coming down.
        sigil(g, s * 0.66, s * 0.82, s * 0.3, s * 0.085, s);
        ring(g, s * 0.66, s * 0.82, s * 0.2, s * 0.055, s * 0.016, D.core);
        g.beginPath();
        g.moveTo(s * 0.08, s * 0.8);
        g.quadraticCurveTo(s * 0.3, s * -0.2, s * 0.58, s * 0.42);
        g.strokeStyle = 'rgba(255,231,160,0.55)';
        g.lineWidth = s * 0.03;
        g.setLineDash([s * 0.05, s * 0.04]);
        g.stroke();
        g.setLineDash([]);
        // A halo disc behind the falling figure, a blade pointing down, the guard and the wings.
        ring(g, s * 0.62, s * 0.4, s * 0.17, s * 0.17, s * 0.03, D.dark);
        ring(g, s * 0.62, s * 0.4, s * 0.17, s * 0.17, s * 0.016, D.body);
        shard(g, s * 0.66, s * 0.76, s * 0.62, s * 0.42, s * 0.2, s, D.hot);
        shard(g, s * 0.66, s * 0.76, s * 0.64, s * 0.54, s * 0.09, s, D.foil);
        shard(g, s * 0.48, s * 0.34, s * 0.78, s * 0.3, s * 0.06, s, D.body);
        hex(g, s * 0.62, s * 0.24, s * 0.06, s, D.foil);
        spark(g, s * 0.66, s * 0.8, s * 0.09);
        spark(g, s * 0.26, s * 0.2, s * 0.06);
      },
    },
  ],
};
