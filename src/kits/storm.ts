import type { HeroKit } from '../heroes';

/**
 * Storm kit data: Kaia, the Tempest Caller. Four spells (labels as registered), canvas-drawn icons in the kit's
 * palette: blue-black storm ground, rain grey foil, blue-white lightning with a dark outline, one yellow spark.
 * Signature shapes: the branching lightning tree and slanting rain under flat-bottomed cloud.
 */
const S = { core: '#ffffff', hot: '#d6f2ff', body: '#4aa8ff', accent: '#ffe36a', dark: '#0a1220', rain: '#c8d4de' };

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#142640');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A branching lightning tree from (x1,y1) to (x2,y2): jagged trunk, forks that thin out, dark outline, blue body, white core. */
function bolt(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, depth = 2, seed = 3) {
  let sd = seed * 977 + 13;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const lines: { pts: [number, number][]; w: number }[] = [];
  const make = (ax: number, ay: number, bx: number, by: number, wd: number, d: number) => {
    const n = 6, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const j = i === 0 || i === n ? 0 : (rnd() - 0.5) * L * 0.2;
      pts.push([ax + (dx * i) / n + nx * j, ay + (dy * i) / n + ny * j]);
    }
    lines.push({ pts, w: wd });
    if (d > 0) {
      for (let k = 0; k < 2; k++) {
        const [px, py] = pts[2 + Math.floor(rnd() * 3)];
        const ang = Math.atan2(dy, dx) + (k ? 1 : -1) * (0.5 + rnd() * 0.4);
        const len = L * (0.3 + rnd() * 0.2);
        make(px, py, px + Math.cos(ang) * len, py + Math.sin(ang) * len, wd * 0.58, d - 1);
      }
    }
  };
  make(x1, y1, x2, y2, w, depth);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const passes: [string, number, number][] = [[S.dark, 2.4, 1.6], [S.body, 1, 0], [S.core, 0.3, 0]];
  for (const [col, mul, add] of passes) {
    g.strokeStyle = col;
    for (const l of lines) {
      g.lineWidth = Math.max(1, l.w * mul + add);
      g.beginPath();
      l.pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.stroke();
    }
  }
}

/** A flat-bottomed dark cloud of three puffs with a pale underside, `w` wide, flat bottom at y. */
function cloud(g: CanvasRenderingContext2D, cx: number, y: number, w: number) {
  const puffs: [number, number, number][] = [[-0.3, 0.0, 0.26], [0.0, -0.1, 0.34], [0.3, 0.0, 0.26], [-0.12, -0.2, 0.2], [0.18, -0.2, 0.2]];
  g.fillStyle = '#1d2a40';
  g.strokeStyle = S.dark;
  g.lineWidth = Math.max(1.5, w * 0.03);
  g.beginPath();
  for (const [px, py, pr] of puffs) {
    g.moveTo(cx + px * w + pr * w, y + py * w);
    g.arc(cx + px * w, y + py * w, pr * w, 0, Math.PI * 2);
  }
  g.fill();
  // Flat bottom: cover what hangs below y, then the pale underside strip.
  g.fillStyle = '#0d1626';
  g.fillRect(cx - w * 0.7, y + 0.02 * w, w * 1.4, w * 0.5);
  g.fillStyle = '#8a98a8';
  g.beginPath();
  g.moveTo(cx - w * 0.5, y);
  g.quadraticCurveTo(cx, y + w * 0.02, cx + w * 0.5, y);
  g.lineTo(cx + w * 0.46, y - w * 0.07);
  g.quadraticCurveTo(cx, y - w * 0.12, cx - w * 0.46, y - w * 0.07);
  g.closePath();
  g.fill();
  g.strokeStyle = S.rain;
  g.lineWidth = Math.max(1, w * 0.018);
  g.beginPath();
  g.moveTo(cx - w * 0.44, y - w * 0.02);
  g.lineTo(cx + w * 0.44, y - w * 0.02);
  g.stroke();
}

/** Slanting rain streaks in a box, one shared angle. */
function rain(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, lw: number) {
  g.strokeStyle = S.rain;
  g.lineWidth = lw;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const rx = x + ((i * 0.618) % 1) * w, ry = y + (((i * 0.37) % 1) * 0.8 + 0.05) * h, len = h * (0.14 + 0.1 * ((i * 0.53) % 1));
    g.beginPath();
    g.moveTo(rx, ry);
    g.lineTo(rx - len * 0.3, ry + len);
    g.stroke();
  }
}

function spark(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = S.accent;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

export const stormKit: HeroKit = {
  name: 'Kaia',
  title: 'the Tempest Caller',
  maxHp: 560,
  accent: S.body,
  foil: S.rain,
  portrait(g, s) {
    iconGround(g, s);
    cloud(g, s * 0.5, s * 0.22, s * 0.8);
    rain(g, s * 0.05, s * 0.25, s * 0.9, s * 0.75, 18, s * 0.012);
    bolt(g, s * 0.26, s * 0.24, s * 0.16, s * 0.82, s * 0.035, 2, 5);
    // Hooked staff on the right, with a spark in the hook.
    g.strokeStyle = S.dark;
    g.lineWidth = s * 0.05;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 0.8, s * 1.0);
    g.lineTo(s * 0.74, s * 0.36);
    g.arc(s * 0.69, s * 0.3, s * 0.06, 0.4, Math.PI * 1.35, true);
    g.stroke();
    g.strokeStyle = S.rain;
    g.lineWidth = s * 0.022;
    g.stroke();
    spark(g, s * 0.69, s * 0.3, s * 0.02);
    // Rain cloak hood and shoulders.
    g.fillStyle = '#0e1c30';
    g.beginPath();
    g.moveTo(s * 0.18, s);
    g.quadraticCurveTo(s * 0.22, s * 0.66, s * 0.34, s * 0.52);
    g.quadraticCurveTo(s * 0.5, s * 0.26, s * 0.66, s * 0.52);
    g.quadraticCurveTo(s * 0.78, s * 0.66, s * 0.82, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.rain;
    g.lineWidth = s * 0.016;
    g.stroke();
    // Face opening, eyes and a bolt-blue gleam.
    g.fillStyle = '#c9d6e2';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.56, s * 0.1, s * 0.13, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.52, s * 0.1, s * 0.09, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = S.body;
    g.fillRect(s * 0.44, s * 0.56, s * 0.04, s * 0.014);
    g.fillRect(s * 0.52, s * 0.56, s * 0.04, s * 0.014);
  },
  spells: [
    {
      key: 'Q', label: 'arc lance', name: 'Arc Lance', range: 11, cooldown: 3,
      blurb: 'Points her staff and a branching bolt leaps to one enemy, then chains to a second one nearby for half damage.',
      icon(g, s) {
        iconGround(g, s);
        // Hooked staff low left, a horizontal bolt tree jumping to the right.
        g.strokeStyle = S.rain;
        g.lineWidth = s * 0.05;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(s * 0.06, s * 0.94);
        g.lineTo(s * 0.26, s * 0.5);
        g.arc(s * 0.31, s * 0.43, s * 0.06, Math.PI * 0.95, Math.PI * 1.95);
        g.stroke();
        bolt(g, s * 0.3, s * 0.4, s * 0.88, s * 0.52, s * 0.05, 2, 11);
        spark(g, s * 0.9, s * 0.52, s * 0.025);
      },
    },
    {
      key: 'W', label: 'ball lightning', name: 'Ball Lightning', range: 10, cooldown: 8, aim: 'line',
      blurb: 'Rolls a slow crackling orb 10 m that damages and slows what it meets. Cast again within 3 s to blink to the orb.',
      icon(g, s) {
        iconGround(g, s);
        // A bright orb with arcs jumping off it, a spark trail behind, and a dashed blink arrow over it.
        const ox = s * 0.62, oy = s * 0.56;
        g.strokeStyle = S.rain;
        g.lineWidth = s * 0.014;
        g.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const y = s * (0.4 + i * 0.09);
          g.globalAlpha = 0.5;
          g.beginPath();
          g.moveTo(s * 0.04, y);
          g.lineTo(s * (0.2 + 0.05 * i), y + s * 0.02);
          g.stroke();
        }
        g.globalAlpha = 1;
        const glow = g.createRadialGradient(ox, oy, s * 0.02, ox, oy, s * 0.22);
        glow.addColorStop(0, S.core);
        glow.addColorStop(0.35, S.hot);
        glow.addColorStop(0.7, S.body);
        glow.addColorStop(1, 'rgba(74,168,255,0)');
        g.fillStyle = glow;
        g.beginPath();
        g.arc(ox, oy, s * 0.22, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = S.dark;
        g.lineWidth = s * 0.02;
        g.beginPath();
        g.arc(ox, oy, s * 0.12, 0, Math.PI * 2);
        g.stroke();
        bolt(g, ox + s * 0.1, oy - s * 0.1, s * 0.94, s * 0.26, s * 0.035, 1, 52);
        bolt(g, ox - s * 0.1, oy + s * 0.1, s * 0.5, s * 0.92, s * 0.03, 1, 57);
        bolt(g, ox + s * 0.1, oy + s * 0.12, s * 0.94, s * 0.8, s * 0.028, 1, 61);
        // Dashed arc: she blinks to the orb.
        g.strokeStyle = S.accent;
        g.lineWidth = s * 0.025;
        g.setLineDash([s * 0.05, s * 0.04]);
        g.beginPath();
        g.moveTo(s * 0.14, s * 0.3);
        g.quadraticCurveTo(s * 0.4, s * 0.06, ox - s * 0.04, oy - s * 0.2);
        g.stroke();
        g.setLineDash([]);
        spark(g, s * 0.14, s * 0.3, s * 0.03);
      },
    },
    {
      key: 'E', label: 'static field', name: 'Static Field', range: 0, cooldown: 9, cc: true, buff: { kind: 'haste', amount: 0.25, seconds: 2 },
      blurb: 'A ring of lightning expands from her out to 5 m and stuns whoever its front passes: stand far, or inside before it starts.',
      icon(g, s) {
        iconGround(g, s);
        cloud(g, s * 0.5, s * 0.3, s * 0.5);
        // The ring of arcs around her, as short bolt segments along an ellipse.
        const cx = s * 0.5, cy = s * 0.66, rx = s * 0.36, ry = s * 0.16;
        for (let i = 0; i < 6; i++) {
          const a0 = (i / 6) * Math.PI * 2 + 0.2, a1 = a0 + 0.62;
          bolt(g, cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry, s * 0.035, 0, 31 + i);
        }
        g.fillStyle = S.rain;
        g.beginPath();
        g.ellipse(cx, cy - s * 0.04, s * 0.06, s * 0.1, 0, 0, Math.PI * 2);
        g.fill();
        spark(g, cx + s * 0.04, cy - s * 0.1, s * 0.02);
      },
    },
    {
      key: 'R', label: 'thunderlance', name: 'Thunderlance', range: 20, cooldown: 18, aim: 'line',
      blurb: 'Ultimate. Hold to charge up to 1.5 s, then one lightning bolt pierces 20 m down the line; a full charge hits 2.5 times harder than a tap.',
      icon(g, s) {
        iconGround(g, s);
        // One huge bolt shooting across the icon like a lance, rain behind it and a charge ring at the staff end.
        rain(g, s * 0.05, s * 0.08, s * 0.9, s * 0.84, 14, s * 0.011);
        bolt(g, s * 0.1, s * 0.82, s * 0.94, s * 0.16, s * 0.1, 3, 71);
        g.strokeStyle = S.accent;
        g.lineWidth = s * 0.03;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(s * 0.16, s * 0.76, s * 0.14, Math.PI * 0.55, Math.PI * 1.9);
        g.stroke();
        g.strokeStyle = S.rain;
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.arc(s * 0.16, s * 0.76, s * 0.19, Math.PI * 0.55, Math.PI * 1.55);
        g.stroke();
        spark(g, s * 0.91, s * 0.18, s * 0.03);
        spark(g, s * 0.34, s * 0.5, s * 0.02);
      },
    },
  ],
};
