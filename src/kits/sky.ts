import type { HeroKit } from '../heroes';

/**
 * Sky kit data: Zephyr, the Wind Blade (a melee assassin, kits v4). Four spells (labels as registered), canvas-drawn icons in the
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
  maxHp: 690,
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
      key: 'Q', label: 'crosswind', name: 'Crosswind', range: 3, cooldown: 4,
      blurb: 'A 3 m cross-cut of wind in front of him: 38 damage. Press Q again within 2 s for a 3 m dash-slash through the aim (25 damage), a dash that gives a Gust.',
      icon(g, s) {
        iconGround(g, s);
        // Two long crescents cut across each other into an X, a pink blossom at the crossing, speed lines behind.
        lines(g, [[s * 0.04, s * 0.5, s * 0.14, 0], [s * 0.02, s * 0.62, s * 0.18, 0], [s * 0.08, s * 0.38, s * 0.12, 0]], s * 0.018);
        sickle(g, s * 0.866, s * 0.089, s * 0.731, 1.579, 3.017, s * 0.11);
        sickle(g, s * 0.134, s * 0.089, s * 0.731, 0.125, 1.563, s * 0.1, S.cloud);
        blossom(g, s * 0.5, s * 0.72, s * 0.05);
        leaf(g, s * 0.84, s * 0.14, s * 0.04, 0.6);
        leaf(g, s * 0.16, s * 0.9, s * 0.04, -0.6, S.accent);
      },
    },
    {
      key: 'W', label: 'skyward', name: 'Skyward', range: 5, cooldown: 8, dash: true, cc: true,
      blurb: 'He leaps into the air, untouchable for 0.8 s, and comes down on a spot within 5 m: 34 damage within 2 m and a 0.5 s knock-up. A dash: it gives a Gust and resets his basic attack when he lands.',
      icon(g, s) {
        iconGround(g, s);
        // A tall leap arc from the lower left over a blossom apex, down to a landing ring on the ground with a dome of crescents.
        g.strokeStyle = S.cloud;
        g.globalAlpha = 0.75;
        g.lineWidth = s * 0.018;
        g.beginPath();
        g.ellipse(s * 0.64, s * 0.84, s * 0.28, s * 0.07, 0, 0, PI * 2);
        g.stroke();
        g.globalAlpha = 1;
        gust(g, [[s * 0.08, s * 0.88], [s * 0.18, s * 0.5], [s * 0.38, s * 0.18], [s * 0.54, s * 0.4], [s * 0.64, s * 0.72]], s * 0.085);
        sickle(g, s * 0.64, s * 0.84, s * 0.26, PI * 1.12, PI * 1.88, s * 0.06, S.cloud);
        lines(g, [[s * 0.04, s * 0.58, 0, s * 0.16], [s * 0.12, s * 0.5, 0, s * 0.12]], s * 0.016);
        blossom(g, s * 0.38, s * 0.14, s * 0.04);
        leaf(g, s * 0.86, s * 0.34, s * 0.045, 0.7);
        leaf(g, s * 0.78, s * 0.62, s * 0.04, -0.4, S.accent);
      },
    },
    {
      key: 'E', label: 'feather step', name: 'Feather Step', range: 4, cooldown: 7, aim: 'line', dash: true, parry: true,
      blurb: 'A 4 m step in any direction, untouchable for 0.2 s: enough to slip a bolt or a swing. Two charges (one back every 7 s). A dash: it gives a Gust and resets his basic attack.',
      icon(g, s) {
        iconGround(g, s);
        // A quick step to the upper right: two fading ghosts behind, a streak, chevron crescents and trailing feathers.
        g.fillStyle = S.body;
        g.globalAlpha = 0.18;
        g.beginPath();
        g.ellipse(s * 0.18, s * 0.66, s * 0.07, s * 0.16, 0.3, 0, PI * 2);
        g.fill();
        g.globalAlpha = 0.34;
        g.beginPath();
        g.ellipse(s * 0.36, s * 0.58, s * 0.07, s * 0.16, 0.3, 0, PI * 2);
        g.fill();
        g.globalAlpha = 1;
        gust(g, [[s * 0.08, s * 0.8], [s * 0.3, s * 0.7], [s * 0.54, s * 0.56], [s * 0.78, s * 0.42]], s * 0.075);
        sickle(g, s * 0.78, s * 0.42, s * 0.2, -PI * 0.42, PI * 0.18, s * 0.06, S.cloud);
        sickle(g, s * 0.66, s * 0.48, s * 0.2, -PI * 0.42, PI * 0.18, s * 0.05, S.hot);
        leaf(g, s * 0.2, s * 0.86, s * 0.05, 0.9, S.cloud);
        leaf(g, s * 0.34, s * 0.82, s * 0.045, 0.7, S.accent);
        blossom(g, s * 0.86, s * 0.28, s * 0.035);
      },
    },
    {
      key: 'R', label: 'sky rend', name: 'Sky Rend', range: 7, cooldown: 24,
      blurb: 'Ultimate. Aim at an enemy within 7 m: he vanishes into the wind and strikes six times in 1.2 s from every side, 15 damage each (double on an airborne enemy), untouchable throughout, and ends behind them.',
      icon(g, s) {
        iconGround(g, s);
        // Six streaks converge on one point, a pinwheel of three crescents round them, a pink blossom in the eye.
        const cx = s * 0.5, cy = s * 0.5;
        const radial: [number, number, number, number][] = [];
        for (let k = 0; k < 6; k++) {
          const a = (k * PI) / 3 + 0.2;
          radial.push([cx + Math.cos(a) * s * 0.46, cy + Math.sin(a) * s * 0.46, -Math.cos(a) * s * 0.22, -Math.sin(a) * s * 0.22]);
        }
        lines(g, radial, s * 0.022);
        for (let k = 0; k < 3; k++) {
          const a = (k * 2 * PI) / 3 + 0.3;
          sickle(g, cx, cy, s * 0.4, a, a + 1.5, s * 0.09, k === 1 ? S.cloud : S.body);
        }
        g.fillStyle = S.dark;
        g.globalAlpha = 0.6;
        g.beginPath();
        g.arc(cx, cy, s * 0.1, 0, PI * 2);
        g.fill();
        g.globalAlpha = 1;
        blossom(g, cx, cy, s * 0.06);
        leaf(g, s * 0.12, s * 0.16, s * 0.04, 0.6);
        leaf(g, s * 0.88, s * 0.86, s * 0.04, -0.6, S.accent);
      },
    },
  ],
};
