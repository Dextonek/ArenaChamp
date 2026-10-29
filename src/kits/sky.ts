import type { HeroKit } from '../heroes';

/**
 * Sky kit data: Zephyr, the Wind Blade (a melee hero). Four spells (labels as registered), canvas-drawn icons in the
 * kit's palette: dark storm-teal ground, cloud foil, sharp pale mint sickle crescents with a hot leading edge and a dark
 * inner edge, thin spiral gust ribbons, small leaves, one blossom-pink accent. Signature shape: the wind crescent.
 */
const S = { core: '#ffffff', hot: '#e6fff6', body: '#7fe6c8', accent: '#ff8fb0', dark: '#0d2a2a', cloud: '#eef3f6' };

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#17504c');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A sickle: the arc of radius `r` round (cx, cy) from angle a0 to a1, `w` thick in the middle, needle tips. */
function sickle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, a0: number, a1: number, w: number, tint = S.body) {
  const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r];
  const am = (a0 + a1) / 2, ri = r - w;
  // Control point so the inner edge passes through the point `w` inside the outer middle.
  const cxm = 2 * (cx + Math.cos(am) * ri) - 0.5 * (p0[0] + p1[0]);
  const cym = 2 * (cy + Math.sin(am) * ri) - 0.5 * (p0[1] + p1[1]);
  g.beginPath();
  g.moveTo(p0[0], p0[1]);
  g.arc(cx, cy, r, a0, a1);
  g.quadraticCurveTo(cxm, cym, p0[0], p0[1]);
  g.closePath();
  g.fillStyle = tint;
  g.fill();
  // Dark inner edge, hot leading edge.
  g.lineCap = 'round';
  g.strokeStyle = S.dark;
  g.lineWidth = Math.max(1, w * 0.22);
  g.beginPath();
  g.moveTo(p1[0], p1[1]);
  g.quadraticCurveTo(cxm, cym, p0[0], p0[1]);
  g.stroke();
  g.strokeStyle = S.hot;
  g.lineWidth = Math.max(1, w * 0.3);
  g.beginPath();
  g.arc(cx, cy, r, a0, a1);
  g.stroke();
}

/** A thin gust ribbon along the points: translucent mint, a hot centre line, a faint dark rim. */
function gust(g: CanvasRenderingContext2D, pts: [number, number][], w: number) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const path = () => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    g.lineTo(l[0], l[1]);
  };
  g.save();
  g.strokeStyle = S.dark;
  g.globalAlpha = 0.5;
  g.lineWidth = w * 1.35;
  path();
  g.stroke();
  g.strokeStyle = S.body;
  g.globalAlpha = 0.85;
  g.lineWidth = w;
  path();
  g.stroke();
  g.strokeStyle = S.hot;
  g.globalAlpha = 0.9;
  g.lineWidth = w * 0.3;
  path();
  g.stroke();
  g.restore();
}

/** Speed-line streaks: short strokes from (x, y) along (dx, dy). */
function lines(g: CanvasRenderingContext2D, items: [number, number, number, number][], w: number) {
  g.lineCap = 'round';
  g.strokeStyle = S.cloud;
  g.lineWidth = w;
  for (const [x, y, dx, dy] of items) {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + dx, y + dy);
    g.stroke();
  }
}

/** A small two-tone leaf at (x, y) turned by `rot`. */
function leaf(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, tint = S.body) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = tint;
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(r * 0.7, 0, 0, r);
  g.closePath();
  g.fill();
  g.fillStyle = S.cloud;
  g.globalAlpha = 0.7;
  g.beginPath();
  g.moveTo(0, -r);
  g.quadraticCurveTo(-r * 0.7, 0, 0, r);
  g.closePath();
  g.fill();
  g.restore();
}

function blossom(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = S.accent;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.core;
  g.beginPath();
  g.arc(x, y, r * 0.35, 0, Math.PI * 2);
  g.fill();
}

const PI = Math.PI;

export const skyKit: HeroKit = {
  name: 'Zephyr',
  title: 'the Wind Blade',
  accent: S.body,
  foil: S.cloud,
  maxHp: 700,
  melee: true,
  portrait(g, s) {
    iconGround(g, s);
    // A big pale crescent behind him and a long scarf of wind streaming out to the side.
    sickle(g, s * 0.5, s * 0.58, s * 0.46, PI * 1.12, PI * 1.9, s * 0.07);
    gust(g, [[s * 0.6, s * 0.52], [s * 0.78, s * 0.46], [s * 0.88, s * 0.6], [s * 0.98, s * 0.5]], s * 0.07);
    gust(g, [[s * 0.62, s * 0.58], [s * 0.76, s * 0.66], [s * 0.86, s * 0.8], [s * 0.96, s * 0.74]], s * 0.05);
    lines(g, [[s * 0.06, s * 0.3, s * 0.14, s * 0.02], [s * 0.1, s * 0.5, s * 0.12, -s * 0.01], [s * 0.04, s * 0.7, s * 0.14, s * 0.01]], s * 0.012);
    // Shoulders in mint and white.
    g.fillStyle = '#1b6a62';
    g.beginPath();
    g.moveTo(s * 0.16, s);
    g.quadraticCurveTo(s * 0.2, s * 0.7, s * 0.34, s * 0.6);
    g.quadraticCurveTo(s * 0.5, s * 0.5, s * 0.66, s * 0.6);
    g.quadraticCurveTo(s * 0.8, s * 0.7, s * 0.84, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.cloud;
    g.lineWidth = s * 0.016;
    g.stroke();
    // The scarf round his neck.
    g.fillStyle = S.body;
    g.beginPath();
    g.moveTo(s * 0.34, s * 0.6);
    g.quadraticCurveTo(s * 0.5, s * 0.68, s * 0.66, s * 0.58);
    g.lineTo(s * 0.64, s * 0.65);
    g.quadraticCurveTo(s * 0.5, s * 0.75, s * 0.36, s * 0.67);
    g.closePath();
    g.fill();
    // Head with swept white hair and a blossom.
    g.fillStyle = '#e8c9b0';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.42, s * 0.13, s * 0.16, 0, 0, PI * 2);
    g.fill();
    g.fillStyle = S.cloud;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.35, s * 0.16, s * 0.14, 0, PI, PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.64, s * 0.36);
    g.quadraticCurveTo(s * 0.74, s * 0.4, s * 0.8, s * 0.3);
    g.quadraticCurveTo(s * 0.7, s * 0.46, s * 0.62, s * 0.44);
    g.closePath();
    g.fill();
    g.fillStyle = S.dark;
    g.fillRect(s * 0.43, s * 0.44, s * 0.04, s * 0.014);
    g.fillRect(s * 0.53, s * 0.44, s * 0.04, s * 0.014);
    blossom(g, s * 0.37, s * 0.32, s * 0.028);
    leaf(g, s * 0.2, s * 0.2, s * 0.04, 0.6);
    leaf(g, s * 0.84, s * 0.2, s * 0.035, -0.5, S.accent);
  },
  spells: [
    {
      key: 'Q', label: 'gale edge', name: 'Gale Edge', range: 3, cooldown: 2.5,
      blurb: 'A melee swing: two crossing wind crescents cut the cone in front of him and shove everything in it back.',
      icon(g, s) {
        iconGround(g, s);
        // Two crossing sickles with speed lines behind them.
        lines(g, [[s * 0.08, s * 0.4, s * 0.2, 0], [s * 0.05, s * 0.58, s * 0.24, 0], [s * 0.12, s * 0.74, s * 0.16, 0]], s * 0.02);
        sickle(g, s * 0.42, s * 0.62, s * 0.46, -PI * 0.78, -PI * 0.12, s * 0.12);
        sickle(g, s * 0.42, s * 0.34, s * 0.46, PI * 0.12, PI * 0.78, s * 0.1);
        blossom(g, s * 0.84, s * 0.48, s * 0.04);
        leaf(g, s * 0.78, s * 0.2, s * 0.045, 0.5);
        leaf(g, s * 0.88, s * 0.78, s * 0.04, -0.7, S.accent);
      },
    },
    {
      key: 'W', label: 'tailwind rush', name: 'Tailwind Rush', range: 8, cooldown: 7, dash: true, cc: true,
      blurb: 'A gap closer: he rides a gust to the spot and a spiral wind lifts everyone there off their feet.',
      icon(g, s) {
        iconGround(g, s);
        // A long gust streak from the lower left to a landing spiral at the upper right.
        gust(g, [[s * 0.06, s * 0.86], [s * 0.26, s * 0.74], [s * 0.46, s * 0.64], [s * 0.66, s * 0.5]], s * 0.1);
        sickle(g, s * 0.2, s * 0.9, s * 0.64, -PI * 0.42, -PI * 0.16, s * 0.1);
        gust(g, [[s * 0.66, s * 0.62], [s * 0.86, s * 0.56], [s * 0.8, s * 0.38], [s * 0.64, s * 0.4], [s * 0.7, s * 0.2], [s * 0.84, s * 0.1]], s * 0.07);
        lines(g, [[s * 0.1, s * 0.62, s * 0.18, 0], [s * 0.2, s * 0.5, s * 0.16, 0]], s * 0.016);
        leaf(g, s * 0.9, s * 0.3, s * 0.045, 0.7);
        leaf(g, s * 0.56, s * 0.16, s * 0.04, -0.4, S.accent);
      },
    },
    {
      key: 'E', label: 'cyclone guard', name: 'Cyclone Guard', range: 0, cooldown: 9,
      blurb: 'A whirl of crescents wraps him in a shield; twice it flares out as a ring that cuts and shoves enemies near.',
      icon(g, s) {
        iconGround(g, s);
        // A ring of sickles round a small core with a shield arc over it.
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * PI * 2 + 0.3;
          sickle(g, s * 0.5, s * 0.52, s * (0.34 + 0.03 * (i % 2)), a, a + PI * 0.34, s * 0.08);
        }
        g.strokeStyle = S.cloud;
        g.globalAlpha = 0.8;
        g.lineWidth = s * 0.02;
        g.beginPath();
        g.arc(s * 0.5, s * 0.52, s * 0.2, PI * 1.15, PI * 1.85);
        g.stroke();
        g.globalAlpha = 1;
        g.fillStyle = S.hot;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.54, s * 0.05, s * 0.1, 0, 0, PI * 2);
        g.fill();
        leaf(g, s * 0.14, s * 0.2, s * 0.04, 0.5);
        leaf(g, s * 0.86, s * 0.84, s * 0.04, -0.6, S.accent);
      },
    },
    {
      key: 'R', label: 'thousand winds', name: 'Thousand Winds', range: 13, cooldown: 20, cc: true,
      blurb: 'Ultimate. A sky-high cyclone of blades closes over the zone; he dives into its eye and the winds burst out.',
      icon(g, s) {
        iconGround(g, s);
        // A funnel of small sickles over a ring of crescents on the floor, a tall crescent through the middle, a pink star.
        g.strokeStyle = S.cloud;
        g.globalAlpha = 0.7;
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.84, s * 0.42, s * 0.1, 0, 0, PI * 2);
        g.stroke();
        g.globalAlpha = 1;
        for (let i = 0; i < 11; i++) {
          const k = i / 10, y = s * (0.14 + 0.62 * k), half = s * (0.14 + 0.28 * k) * (0.9 + 0.2 * ((i * 7) % 3) / 2);
          const x = s * 0.5 + (i % 2 ? -1 : 1) * half * (0.55 + 0.4 * ((i * 5) % 4) / 3);
          sickle(g, x, y, s * 0.09, i % 2 ? PI * 0.6 : -PI * 0.1, i % 2 ? PI * 1.2 : PI * 0.5, s * 0.03);
        }
        gust(g, [[s * 0.22, s * 0.78], [s * 0.7, s * 0.62], [s * 0.3, s * 0.44], [s * 0.66, s * 0.28], [s * 0.46, s * 0.12]], s * 0.045);
        sickle(g, s * 0.2, s * 0.5, s * 0.46, -PI * 0.36, PI * 0.36, s * 0.1, S.cloud);
        blossom(g, s * 0.5, s * 0.5, s * 0.035);
        leaf(g, s * 0.14, s * 0.26, s * 0.04, 0.4);
        leaf(g, s * 0.9, s * 0.4, s * 0.04, -0.5, S.accent);
      },
    },
  ],
};
