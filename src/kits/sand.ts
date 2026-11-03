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
  maxHp: 600,
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
      key: 'Q', label: 'sand lash', name: 'Sand Lash', range: 10, cooldown: 3.5, cc: true, aim: 'line',
      blurb: 'A whip of sand flies 10 m down the aim: the first enemy it touches takes 54 damage and is rooted 0.8 s in a stone shackle. Step off the line to dodge it.',
      icon(g, s) {
        ground(g, s);
        // A lash streaking left to right along the floor, its tip cracking into a stone shackle on the right.
        ribbon(g, s * 0.04, s * 0.7, s * 0.3, s * 0.42, s * 0.66, s * 0.58, s * 0.11);
        ribbon(g, s * 0.1, s * 0.84, s * 0.34, s * 0.7, s * 0.6, s * 0.7, s * 0.05);
        g.strokeStyle = S.stoneShade;
        g.lineWidth = s * 0.012;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(s * (0.04 + i * 0.05), s * (0.3 + i * 0.07)); g.lineTo(s * (0.2 + i * 0.05), s * (0.3 + i * 0.07)); g.stroke(); }
        grains(g, [[s * 0.2, s * 0.58, 1], [s * 0.3, s * 0.78, 0], [s * 0.12, s * 0.5, 0], [s * 0.46, s * 0.3, 1]], s * 0.018);
        // The shackle: four stone shards round the tip, a turquoise crack between them.
        const cx = s * 0.78, cy = s * 0.62;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.5;
          pillar(g, cx + Math.cos(a) * s * 0.14, cy + Math.sin(a) * s * 0.06 + s * 0.1, s * 0.1, s * 0.22, -Math.cos(a) * s * 0.03);
        }
        g.strokeStyle = S.accent;
        g.lineWidth = s * 0.02;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(s * 0.7, s * 0.34); g.lineTo(s * 0.78, s * 0.44); g.lineTo(s * 0.74, s * 0.44); g.lineTo(s * 0.82, s * 0.56); g.stroke();
      },
    },
    {
      key: 'W', label: 'quicksand', name: 'Quicksand', range: 10, cooldown: 7, cc: true,
      blurb: 'A glyph ring floods with swirling sand that slows whoever stands in it for 2 s, then stone pillars close and root them.',
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
      // Range 11 is only the duel AI's reach: it burrows when the enemy is out of Q's range; the tunnel itself is 7 m.
      key: 'E', label: 'burrow', name: 'Burrow', range: 11, cooldown: 11, dash: true,
      blurb: 'Dives into the sand and tunnels up to 7 m toward the aim, untouchable for 1.1 s while a moving mound shows where he is. He erupts with 45 damage and a 0.5 s knock-up on enemies within 2 m of the exit.',
      icon(g, s) {
        ground(g, s);
        // A furrow of mounds crossing the floor from the lower left, and the eruption at the upper right.
        ribbon(g, s * 0.04, s * 0.88, s * 0.3, s * 0.82, s * 0.62, s * 0.62, s * 0.07);
        for (let i = 0; i < 3; i++) {
          const x = s * (0.12 + i * 0.15), y = s * (0.86 - i * 0.07);
          g.fillStyle = S.body;
          g.beginPath(); g.ellipse(x, y, s * 0.07, s * 0.035, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = S.hot;
          g.beginPath(); g.ellipse(x - s * 0.01, y - s * 0.01, s * 0.035, s * 0.015, 0, 0, Math.PI * 2); g.fill();
        }
        ring(g, s * 0.7, s * 0.7, s * 0.26, s * 0.09, s * 0.035);
        // The column: a fan of stone shards and sand ribbons bursting up out of the hole.
        pillar(g, s * 0.6, s * 0.7, s * 0.09, s * 0.26, -s * 0.08);
        pillar(g, s * 0.8, s * 0.7, s * 0.09, s * 0.3, s * 0.08);
        pillar(g, s * 0.7, s * 0.72, s * 0.1, s * 0.42, 0);
        ribbon(g, s * 0.64, s * 0.66, s * 0.56, s * 0.3, s * 0.7, s * 0.14, s * 0.06);
        ribbon(g, s * 0.76, s * 0.66, s * 0.86, s * 0.3, s * 0.74, s * 0.16, s * 0.06);
        grains(g, [[s * 0.52, s * 0.34, 1], [s * 0.9, s * 0.42, 0], [s * 0.6, s * 0.12, 0], [s * 0.84, s * 0.16, 1], [s * 0.46, s * 0.5, 0]], s * 0.018);
        g.strokeStyle = S.accent;
        g.lineWidth = s * 0.022;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(s * 0.66, s * 0.3); g.lineTo(s * 0.7, s * 0.2); g.lineTo(s * 0.74, s * 0.3); g.stroke();
      },
    },
    {
      key: 'R', label: 'dune surge', name: 'Dune Surge', range: 12, cooldown: 20, cc: true, aim: 'line',
      blurb: 'Ultimate. A sand wave 3 m wide rolls 12 m down the aim at 11 m/s. The first enemy it reaches is carried on its crest to the end, where the wave crashes: 92 damage and a 1.3 s root. Anything else it passes takes 16 and is thrown ahead.',
      icon(g, s) {
        ground(g, s);
        // A tall wave seen from the side, curling over to the right, three ridges stacked behind its crest.
        ribbon(g, s * 0.04, s * 0.84, s * 0.3, s * 0.78, s * 0.66, s * 0.66, s * 0.1);
        ribbon(g, s * 0.1, s * 0.74, s * 0.34, s * 0.58, s * 0.66, s * 0.5, s * 0.1);
        ribbon(g, s * 0.16, s * 0.62, s * 0.36, s * 0.3, s * 0.72, s * 0.3, s * 0.12);
        // The curling crest.
        ribbon(g, s * 0.5, s * 0.34, s * 0.74, s * 0.12, s * 0.84, s * 0.36, s * 0.09);
        g.strokeStyle = S.stone;
        g.lineWidth = s * 0.02;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(s * 0.52, s * 0.28); g.quadraticCurveTo(s * 0.74, s * 0.06, s * 0.84, s * 0.3); g.stroke();
        // The carried body on the crest, and the stone that sets where it crashes.
        g.fillStyle = S.dark;
        g.beginPath(); g.arc(s * 0.82, s * 0.46, s * 0.04, 0, Math.PI * 2); g.fill();
        g.fillRect(s * 0.8, s * 0.48, s * 0.04, s * 0.1);
        pillar(g, s * 0.78, s * 0.9, s * 0.1, s * 0.28, -s * 0.05);
        slab(g, s * 0.84, s * 0.86, s * 0.14, s * 0.1, false);
        grains(g, [[s * 0.2, s * 0.48, 1], [s * 0.1, s * 0.56, 0], [s * 0.92, s * 0.52, 1], [s * 0.64, s * 0.2, 0]], s * 0.018);
        // Speed marks along the base.
        g.strokeStyle = S.accent;
        g.lineWidth = s * 0.02;
        g.beginPath(); g.moveTo(s * 0.04, s * 0.94); g.lineTo(s * 0.34, s * 0.94); g.moveTo(s * 0.12, s * 0.9); g.lineTo(s * 0.3, s * 0.9); g.stroke();
      },
    },
  ],
};
