import type { HeroKit } from '../heroes';

/**
 * Sand kit data (Sefu, the Dune Sovereign): dark umber ground, pale sandstone foil, ochre sand ribbons. Icons are drawn
 * on canvases in the kit palette, one signature shape each (see pipeline/designs/kit-sand.md).
 */
const S = { core: '#fff6dc', hot: '#ffd27a', body: '#c8913f', accent: '#3fd4c8', dark: '#2a1a0c', stone: '#e8d8b4', stoneShade: '#b9a67f' };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.75);
  r.addColorStop(0, '#3d2611');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A thick sand ribbon along a quadratic curve: dark underside, ochre body, a lit crest on top. */
function ribbon(g: CanvasRenderingContext2D, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number) {
  g.lineCap = 'round';
  const pass = (col: string, lw: number, dy: number) => {
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.beginPath(); g.moveTo(x0, y0 + dy); g.quadraticCurveTo(cx, cy + dy, x1, y1 + dy); g.stroke();
  };
  pass(S.dark, w * 1.25, w * 0.12);
  pass(S.body, w, 0);
  pass(S.hot, w * 0.38, -w * 0.2);
}

/** Loose grains. */
function grains(g: CanvasRenderingContext2D, pts: number[][], r: number) {
  for (const [x, y, k] of pts) {
    g.fillStyle = k ? S.hot : S.body;
    g.beginPath(); g.arc(x, y, r * (k ? 0.8 : 1), 0, Math.PI * 2); g.fill();
  }
}

/** A pale carved slab (x, y = top-left) with a lit top edge and a dark incised line pattern. */
function slab(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, glyphs = true) {
  g.fillStyle = S.stone;
  g.fillRect(x, y, w, h);
  g.fillStyle = S.stoneShade;
  g.fillRect(x, y + h * 0.7, w, h * 0.3);
  g.strokeStyle = S.dark;
  g.lineWidth = Math.max(1.2, h * 0.07);
  g.strokeRect(x, y, w, h);
  if (glyphs && w > h * 1.2) {
    g.lineWidth = Math.max(1.2, h * 0.08);
    const n = Math.max(2, Math.floor(w / (h * 0.9)));
    for (let i = 0; i < n; i++) {
      const cx = x + (w * (i + 0.5)) / n;
      g.beginPath(); g.moveTo(cx - h * 0.18, y + h * 0.5); g.lineTo(cx, y + h * 0.28); g.lineTo(cx + h * 0.18, y + h * 0.5); g.lineTo(cx, y + h * 0.7); g.closePath(); g.stroke();
    }
  }
}

/** A tapered stone pillar from the base centre (bx, by), `h` tall, leaning by `lean` pixels at the top. */
function pillar(g: CanvasRenderingContext2D, bx: number, by: number, w: number, h: number, lean: number) {
  g.beginPath();
  g.moveTo(bx - w / 2, by);
  g.lineTo(bx - w * 0.3 + lean, by - h);
  g.lineTo(bx + w * 0.3 + lean, by - h);
  g.lineTo(bx + w / 2, by);
  g.closePath();
  g.fillStyle = S.stone;
  g.fill();
  g.strokeStyle = S.dark;
  g.lineWidth = Math.max(1.5, w * 0.1);
  g.stroke();
  g.beginPath();
  g.moveTo(bx - w * 0.15 + lean * 0.5, by - h * 0.62); g.lineTo(bx + w * 0.15 + lean * 0.5, by - h * 0.62);
  g.moveTo(bx - w * 0.15 + lean * 0.8, by - h * 0.33); g.lineTo(bx + w * 0.15 + lean * 0.8, by - h * 0.33);
  g.stroke();
}

/** A stone ground ring (ellipse) with dark glyph ticks. */
function ring(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, lw: number) {
  g.strokeStyle = S.dark;
  g.lineWidth = lw * 1.5;
  g.beginPath(); g.ellipse(cx, cy + lw * 0.2, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = S.stone;
  g.lineWidth = lw;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = S.dark;
  g.lineWidth = Math.max(1.2, lw * 0.22);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (rx - lw * 0.3), cy + Math.sin(a) * (ry - lw * 0.3 * (ry / rx)));
    g.lineTo(cx + Math.cos(a) * (rx + lw * 0.3), cy + Math.sin(a) * (ry + lw * 0.3 * (ry / rx)));
    g.stroke();
  }
}

export const sandKit: HeroKit = {
  name: 'Sefu',
  title: 'the Dune Sovereign',
  accent: S.body,
  foil: S.stone,
  portrait(g, s) {
    ground(g, s);
    // Layered linen shoulders, a gold collar, a bearded face under a striped gold headdress, the crook behind.
    g.fillStyle = S.stone;
    g.beginPath();
    g.moveTo(s * 0.08, s); g.lineTo(s * 0.16, s * 0.72); g.lineTo(s * 0.36, s * 0.62); g.lineTo(s * 0.64, s * 0.62); g.lineTo(s * 0.84, s * 0.72); g.lineTo(s * 0.92, s);
    g.closePath(); g.fill();
    g.strokeStyle = S.stoneShade;
    g.lineWidth = s * 0.012;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(s * (0.2 + i * 0.02), s * (0.78 + i * 0.05)); g.lineTo(s * (0.8 - i * 0.02), s * (0.78 + i * 0.05)); g.stroke(); }
    g.strokeStyle = S.body;
    g.lineWidth = s * 0.05;
    g.beginPath(); g.arc(s * 0.5, s * 0.6, s * 0.2, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
    g.strokeStyle = S.accent;
    g.lineWidth = s * 0.014;
    g.beginPath(); g.arc(s * 0.5, s * 0.6, s * 0.17, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    // Headdress: a gold trapezoid with turquoise stripes, falling past the cheeks.
    g.fillStyle = S.body;
    g.beginPath();
    g.moveTo(s * 0.28, s * 0.62); g.lineTo(s * 0.3, s * 0.26); g.quadraticCurveTo(s * 0.5, s * 0.1, s * 0.7, s * 0.26); g.lineTo(s * 0.72, s * 0.62);
    g.lineTo(s * 0.62, s * 0.6); g.lineTo(s * 0.62, s * 0.34); g.lineTo(s * 0.38, s * 0.34); g.lineTo(s * 0.38, s * 0.6);
    g.closePath(); g.fill();
    g.strokeStyle = S.hot;
    g.lineWidth = s * 0.018;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(s * 0.3, s * (0.34 + i * 0.07)); g.lineTo(s * 0.38, s * (0.34 + i * 0.07)); g.moveTo(s * 0.62, s * (0.34 + i * 0.07)); g.lineTo(s * 0.7, s * (0.34 + i * 0.07)); g.stroke(); }
    g.strokeStyle = S.accent;
    g.lineWidth = s * 0.016;
    g.beginPath(); g.moveTo(s * 0.34, s * 0.26); g.quadraticCurveTo(s * 0.5, s * 0.16, s * 0.66, s * 0.26); g.stroke();
    // Face and beard.
    g.fillStyle = '#a8742f';
    g.fillRect(s * 0.38, s * 0.34, s * 0.24, s * 0.22);
    g.fillStyle = S.dark;
    g.fillRect(s * 0.41, s * 0.4, s * 0.06, s * 0.025);
    g.fillRect(s * 0.53, s * 0.4, s * 0.06, s * 0.025);
    g.fillStyle = S.accent;
    g.fillRect(s * 0.42, s * 0.405, s * 0.025, s * 0.015);
    g.fillRect(s * 0.555, s * 0.405, s * 0.025, s * 0.015);
    g.fillStyle = S.dark;
    g.beginPath(); g.moveTo(s * 0.43, s * 0.54); g.lineTo(s * 0.57, s * 0.54); g.lineTo(s * 0.54, s * 0.72); g.lineTo(s * 0.5, s * 0.76); g.lineTo(s * 0.46, s * 0.72); g.closePath(); g.fill();
    // The sandstone crook, held on the right.
    g.strokeStyle = S.stone;
    g.lineWidth = s * 0.035;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(s * 0.88, s); g.lineTo(s * 0.88, s * 0.22); g.arc(s * 0.8, s * 0.22, s * 0.08, 0, -Math.PI, true); g.stroke();
    grains(g, [[s * 0.2, s * 0.2, 1], [s * 0.14, s * 0.32, 0], [s * 0.1, s * 0.14, 0]], s * 0.012);
  },
  spells: [
    {
      key: 'Q', label: 'sand lash', name: 'Sand Lash', range: 10, cooldown: 3,
      blurb: 'Sand pours from the floor and cracks across to one enemy like a whip, setting into a stone shackle that crumbles.',
      icon(g, s) {
        ground(g, s);
        // A ribbon whipping up from the lower left and over to a stone shackle ring at the lower right.
        ribbon(g, s * 0.1, s * 0.86, s * 0.2, s * 0.12, s * 0.72, s * 0.62, s * 0.1);
        grains(g, [[s * 0.1, s * 0.74, 1], [s * 0.17, s * 0.8, 0], [s * 0.06, s * 0.66, 0], [s * 0.2, s * 0.9, 1]], s * 0.018);
        // The shackle: a stone ring of four shards.
        const cx = s * 0.74, cy = s * 0.74;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.5;
          pillar(g, cx + Math.cos(a) * s * 0.17, cy + Math.sin(a) * s * 0.07 + s * 0.05, s * 0.11, s * 0.2, -Math.cos(a) * s * 0.03);
        }
        g.strokeStyle = S.accent;
        g.lineWidth = s * 0.018;
        g.beginPath(); g.moveTo(s * 0.82, s * 0.5); g.lineTo(s * 0.9, s * 0.42); g.moveTo(s * 0.86, s * 0.5); g.lineTo(s * 0.86, s * 0.4); g.stroke();
      },
    },
    {
      key: 'W', label: 'quicksand', name: 'Quicksand', range: 10, cooldown: 7,
      blurb: 'A glyph ring floods with swirling sand that drags enemies in, then stone pillars close around them like teeth.',
      icon(g, s) {
        ground(g, s);
        const cx = s * 0.5, cy = s * 0.7;
        ring(g, cx, cy, s * 0.42, s * 0.16, s * 0.05);
        // The swirl: dark funnel with spiral ridges.
        g.fillStyle = S.body;
        g.beginPath(); g.ellipse(cx, cy, s * 0.34, s * 0.12, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = S.hot;
        g.lineWidth = s * 0.018;
        g.beginPath();
        for (let i = 0; i <= 40; i++) {
          const a = i * 0.45, r = 1 - i / 44;
          const x = cx + Math.cos(a) * s * 0.3 * r, y = cy + Math.sin(a) * s * 0.105 * r;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
        g.fillStyle = S.dark;
        g.beginPath(); g.ellipse(cx, cy, s * 0.05, s * 0.02, 0, 0, Math.PI * 2); g.fill();
        // Pillars closing in.
        pillar(g, s * 0.2, s * 0.72, s * 0.14, s * 0.5, s * 0.1);
        pillar(g, s * 0.8, s * 0.72, s * 0.14, s * 0.5, -s * 0.1);
        pillar(g, s * 0.36, s * 0.84, s * 0.12, s * 0.4, s * 0.07);
        pillar(g, s * 0.64, s * 0.84, s * 0.12, s * 0.4, -s * 0.07);
      },
    },
    {
      key: 'E', label: 'dune ward', name: 'Dune Ward', range: 0, cooldown: 9,
      blurb: 'Three sand ribbons wind around him and twice fling a ring of sand outward, then set into stone and crumble.',
      icon(g, s) {
        ground(g, s);
        // The outer flung-sand ring, pale at the edge.
        g.strokeStyle = S.stone;
        g.lineWidth = s * 0.03;
        g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.42, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = S.body;
        g.lineWidth = s * 0.05;
        g.setLineDash([s * 0.09, s * 0.04]);
        g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.36, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
        // Three ribbons in a spiral around the middle.
        for (let i = 0; i < 3; i++) {
          const a0 = (i / 3) * Math.PI * 2 + 0.4;
          const p = (a: number, r: number): [number, number] => [s * 0.5 + Math.cos(a) * r, s * 0.5 + Math.sin(a) * r];
          const [x0, y0] = p(a0, s * 0.14);
          const [cx, cy] = p(a0 + 1.1, s * 0.34);
          const [x1, y1] = p(a0 + 2.2, s * 0.2);
          ribbon(g, x0, y0, cx, cy, x1, y1, s * 0.075);
        }
        g.fillStyle = S.stone;
        g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.07, 0, Math.PI * 2); g.fill();
        g.strokeStyle = S.dark;
        g.lineWidth = s * 0.015;
        g.stroke();
      },
    },
    {
      key: 'R', label: 'tomb of kings', name: 'Tomb of Kings', range: 13, cooldown: 20,
      blurb: 'Ultimate. Sand ribbons stack a sandstone pyramid over the zone, then it implodes and bursts into stone shards.',
      icon(g, s) {
        ground(g, s);
        ring(g, s * 0.5, s * 0.82, s * 0.46, s * 0.14, s * 0.04);
        g.fillStyle = S.body;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.82, s * 0.36, s * 0.1, 0, 0, Math.PI * 2); g.fill();
        // The stepped pyramid, six tiers.
        for (let k = 0; k < 6; k++) {
          const w = s * (0.62 - k * 0.095);
          slab(g, s * 0.5 - w / 2, s * 0.76 - (k + 1) * s * 0.105, w, s * 0.105, k < 4);
        }
        // The lit glyph on its face.
        g.strokeStyle = S.accent;
        g.lineWidth = s * 0.03;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(s * 0.43, s * 0.47); g.lineTo(s * 0.5, s * 0.38); g.lineTo(s * 0.57, s * 0.47); g.lineTo(s * 0.5, s * 0.56); g.closePath(); g.stroke();
        // Shards flying out.
        pillar(g, s * 0.08, s * 0.86, s * 0.07, s * 0.14, s * 0.02);
        pillar(g, s * 0.93, s * 0.84, s * 0.07, s * 0.16, -s * 0.02);
        grains(g, [[s * 0.14, s * 0.62, 1], [s * 0.88, s * 0.6, 0], [s * 0.2, s * 0.5, 0], [s * 0.8, s * 0.44, 1]], s * 0.016);
      },
    },
  ],
};
