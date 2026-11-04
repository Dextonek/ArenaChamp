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

/** A lightning rod standing at (x, yBase): dark outline, pale shaft, two prongs, a spark on the tip. */
function rod(g: CanvasRenderingContext2D, s: number, x: number, yBase: number, h: number, w: number) {
  g.lineCap = 'round';
  for (const [col, mul] of [[S.dark, 2.2], [S.rain, 1]] as const) {
    g.strokeStyle = col;
    g.lineWidth = w * mul;
    g.beginPath();
    g.moveTo(x, yBase);
    g.lineTo(x, yBase - h);
    g.moveTo(x - w * 2.4, yBase - h * 0.78);
    g.lineTo(x, yBase - h * 0.55);
    g.lineTo(x + w * 2.4, yBase - h * 0.78);
    g.stroke();
  }
  g.fillStyle = S.dark;
  g.beginPath();
  g.ellipse(x, yBase, w * 3.4, w * 1.2, 0, 0, Math.PI * 2);
  g.fill();
  spark(g, x, yBase - h - w * 0.8, w * 1.3);
}

/** A flat ground ring (an ellipse) drawn as a dashed or solid outline. */
function groundRing(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, lw: number, dash = 0) {
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.setLineDash(dash ? [dash, dash * 0.8] : []);
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
}

export const stormKit: HeroKit = {
  name: 'Kaia',
  title: 'the Tempest Caller',
  maxHp: 580,
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
      key: 'Q', label: 'sky strike', name: 'Sky Strike', range: 7, cooldown: 4,
      blurb: 'A strike falls on an enemy in sight (7 m) 0.35 s later: 60, and a rod stands 1.5 m in front of them, toward her. Rods within 5 m of them arc for 18.',
      icon(g, s) {
        iconGround(g, s);
        cloud(g, s * 0.58, s * 0.3, s * 0.62);
        // A thick bolt falls on a ring on the ground; a rod stands short of it on the left.
        groundRing(g, s * 0.6, s * 0.84, s * 0.22, s * 0.07, S.rain, s * 0.02);
        bolt(g, s * 0.58, s * 0.3, s * 0.6, s * 0.82, s * 0.07, 2, 21);
        rod(g, s, s * 0.2, s * 0.9, s * 0.4, s * 0.025);
        spark(g, s * 0.6, s * 0.82, s * 0.03);
      },
    },
    {
      key: 'W', label: 'thunder rod', name: 'Thunder Rod', range: 9, cooldown: 9,
      blurb: 'A great rod at a spot (9 m) for 3 s. From 1.2 s, each second: enemies within 3.5 m take 24 and are slowed. Cast again from 1.2 s to fire it once for 50 and end it.',
      icon(g, s) {
        iconGround(g, s);
        // The 3.5 m zone as a dashed ring, a tall great rod in its middle, arcs running from the tip to the rim.
        groundRing(g, s * 0.5, s * 0.8, s * 0.42, s * 0.12, S.hot, s * 0.02, s * 0.05);
        bolt(g, s * 0.5, s * 0.2, s * 0.14, s * 0.78, s * 0.03, 1, 33);
        bolt(g, s * 0.5, s * 0.2, s * 0.86, s * 0.78, s * 0.03, 1, 37);
        rod(g, s, s * 0.5, s * 0.84, s * 0.62, s * 0.04);
        spark(g, s * 0.14, s * 0.78, s * 0.02);
        spark(g, s * 0.86, s * 0.78, s * 0.02);
      },
    },
    {
      key: 'E', label: 'polarity', name: 'Polarity', range: 8, cooldown: 11, cc: true,
      blurb: 'Magnetises an enemy in sight (8 m): 20, then after 1 s they are yanked 3 m toward her nearest rod (her, with none). Ending within 1 m of the rod: stunned 0.6 s.',
      icon(g, s) {
        iconGround(g, s);
        // A horseshoe magnet (pale tip, yellow tip) on the left pulling toward a rod on the right along dashed arcs.
        const cx = s * 0.3, cy = s * 0.46, r = s * 0.15;
        g.lineCap = 'round';
        for (const [col, w] of [[S.dark, s * 0.17], [S.body, s * 0.1]] as const) {
          g.strokeStyle = col;
          g.lineWidth = w;
          g.beginPath();
          g.moveTo(cx - r, cy - s * 0.2);
          g.lineTo(cx - r, cy);
          g.arc(cx, cy, r, Math.PI, 0, true);
          g.lineTo(cx + r, cy - s * 0.2);
          g.stroke();
        }
        g.strokeStyle = S.rain;
        g.lineWidth = s * 0.1;
        g.beginPath();
        g.moveTo(cx - r, cy - s * 0.2);
        g.lineTo(cx - r, cy - s * 0.12);
        g.stroke();
        g.strokeStyle = S.accent;
        g.beginPath();
        g.moveTo(cx + r, cy - s * 0.2);
        g.lineTo(cx + r, cy - s * 0.12);
        g.stroke();
        rod(g, s, s * 0.82, s * 0.9, s * 0.5, s * 0.03);
        g.strokeStyle = S.accent;
        g.lineWidth = s * 0.025;
        g.setLineDash([s * 0.05, s * 0.04]);
        for (const dy of [-0.06, 0.08]) {
          g.beginPath();
          g.moveTo(s * 0.5, s * (0.5 + dy));
          g.quadraticCurveTo(s * 0.62, s * (0.34 + dy), s * 0.74, s * (0.5 + dy));
          g.stroke();
        }
        g.setLineDash([]);
        spark(g, s * 0.82, s * 0.38, s * 0.03);
      },
    },
    {
      key: 'R', label: 'supercell storm', name: 'Supercell', range: 0, cooldown: 24,
      blurb: 'A storm over her for 6 s. Every 0.8 s, if the enemy is within 7 m of her or 3 m of a rod, a bolt marks their spot (1.2 m) and falls 0.6 s later: 32. Rods arc as normal.',
      icon(g, s) {
        iconGround(g, s);
        cloud(g, s * 0.5, s * 0.34, s * 0.86);
        rain(g, s * 0.06, s * 0.3, s * 0.88, s * 0.7, 14, s * 0.011);
        // Two marked circles on the ground, a bolt falling on one of them.
        groundRing(g, s * 0.3, s * 0.82, s * 0.16, s * 0.055, S.hot, s * 0.02);
        groundRing(g, s * 0.68, s * 0.74, s * 0.16, s * 0.055, S.accent, s * 0.025);
        bolt(g, s * 0.62, s * 0.4, s * 0.68, s * 0.74, s * 0.06, 2, 47);
        spark(g, s * 0.68, s * 0.74, s * 0.028);
      },
    },
  ],
};
