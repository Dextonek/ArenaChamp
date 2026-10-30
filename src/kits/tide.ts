import type { HeroKit } from '../heroes';

/**
 * Tide kit data: Marin, the Tide Dancer. Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * deep-water ground, foam foil, thick smooth blue water ribbons with a dark underside and a foam crest, one coral
 * accent. Signature shape: the water ribbon curling like a dancer's sash.
 */
const S = { core: '#ffffff', hot: '#bff2ff', body: '#1f9fd6', accent: '#ff9a6a', dark: '#05253a', foam: '#eaf8fb' };

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#0b3d5c');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A thick water ribbon along the points: dark underside, blue body, lighter top, a foam crest on the end. */
function ribbon(g: CanvasRenderingContext2D, pts: [number, number][], w: number, foam = true) {
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
  g.strokeStyle = S.dark;
  g.lineWidth = w * 1.25;
  path();
  g.stroke();
  g.strokeStyle = S.body;
  g.lineWidth = w;
  path();
  g.stroke();
  g.save();
  g.translate(0, -w * 0.16);
  g.strokeStyle = S.hot;
  g.globalAlpha = 0.75;
  g.lineWidth = w * 0.4;
  path();
  g.stroke();
  g.restore();
  if (foam) {
    // Foam crest: pale blobs fading back from the head.
    const n = pts.length, h = pts[n - 1], p = pts[n - 2];
    g.fillStyle = S.foam;
    for (let i = 0; i < 5; i++) {
      const k = i / 5;
      const x = h[0] + (p[0] - h[0]) * k * 0.9 + (i % 2 ? w * 0.18 : -w * 0.18);
      const y = h[1] + (p[1] - h[1]) * k * 0.9 + (i % 2 ? -w * 0.1 : w * 0.1);
      g.beginPath();
      g.arc(x, y, w * (0.34 - k * 0.2), 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** Small teardrops at the points. */
function drops(g: CanvasRenderingContext2D, pts: [number, number, number][]) {
  for (const [x, y, r] of pts) {
    g.fillStyle = S.hot;
    g.beginPath();
    g.moveTo(x, y - r * 1.9);
    g.quadraticCurveTo(x + r * 1.1, y - r * 0.2, x, y + r);
    g.quadraticCurveTo(x - r * 1.1, y - r * 0.2, x, y - r * 1.9);
    g.fill();
  }
}

/** A foam crown ring on the floor (spikes up from an ellipse). */
function crown(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, h: number) {
  g.fillStyle = S.foam;
  g.strokeStyle = S.body;
  g.lineWidth = Math.max(1, rx * 0.06);
  g.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry * 0.4;
    const tip = h * (0.6 + 0.4 * ((i * 7) % 5) / 4);
    if (i === 0) g.moveTo(x, y);
    const a2 = a + Math.PI / n / 2;
    g.lineTo(cx + Math.cos(a2) * rx * 1.08, y - tip);
    g.lineTo(cx + Math.cos(a + Math.PI / n) * rx, cy + Math.sin(a + Math.PI / n) * ry * 0.4);
  }
  g.lineTo(cx + rx, cy);
  g.ellipse(cx, cy, rx, ry * 0.4, 0, 0, Math.PI);
  g.closePath();
  g.fill();
  g.stroke();
}

function coral(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = S.accent;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

export const tideKit: HeroKit = {
  name: 'Marin',
  title: 'the Tide Dancer',
  accent: S.body,
  foil: S.foam,
  maxHp: 620,
  portrait(g, s) {
    iconGround(g, s);
    // Sashes of water sweeping round her, behind and in front.
    ribbon(g, [[s * 0.04, s * 0.7], [s * 0.2, s * 0.4], [s * 0.4, s * 0.3], [s * 0.34, s * 0.14]], s * 0.075);
    ribbon(g, [[s * 0.96, s * 0.56], [s * 0.82, s * 0.28], [s * 0.64, s * 0.2], [s * 0.7, s * 0.06]], s * 0.07);
    drops(g, [[s * 0.12, s * 0.2, s * 0.018], [s * 0.88, s * 0.14, s * 0.016], [s * 0.2, s * 0.86, s * 0.016]]);
    // Shoulders in a wave-blue wrap.
    g.fillStyle = '#0b3550';
    g.beginPath();
    g.moveTo(s * 0.16, s);
    g.quadraticCurveTo(s * 0.2, s * 0.68, s * 0.34, s * 0.56);
    g.quadraticCurveTo(s * 0.5, s * 0.46, s * 0.66, s * 0.56);
    g.quadraticCurveTo(s * 0.8, s * 0.68, s * 0.84, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.foam;
    g.lineWidth = s * 0.016;
    g.stroke();
    // Head with a swept dark hair line and a coral flower.
    g.fillStyle = '#e8c9b0';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.4, s * 0.13, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.34, s * 0.15, s * 0.14, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.35, s * 0.34);
    g.quadraticCurveTo(s * 0.3, s * 0.56, s * 0.38, s * 0.7);
    g.quadraticCurveTo(s * 0.4, s * 0.5, s * 0.42, s * 0.34);
    g.fill();
    g.fillStyle = S.body;
    g.fillRect(s * 0.43, s * 0.42, s * 0.04, s * 0.014);
    g.fillRect(s * 0.53, s * 0.42, s * 0.04, s * 0.014);
    coral(g, s * 0.64, s * 0.3, s * 0.03);
    g.fillStyle = S.foam;
    g.beginPath();
    g.arc(s * 0.64, s * 0.3, s * 0.012, 0, Math.PI * 2);
    g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'tide whip', name: 'Tide Whip', range: 10, cooldown: 3,
      blurb: 'Spins a water ribbon off her wrist; it lashes one enemy, wraps it and hooks it 3 m toward her.',
      icon(g, s) {
        iconGround(g, s);
        // A whip of water from low left curling to the right, wrapping a small post.
        ribbon(g, [[s * 0.08, s * 0.78], [s * 0.2, s * 0.5], [s * 0.4, s * 0.62], [s * 0.6, s * 0.4], [s * 0.76, s * 0.46]], s * 0.1);
        g.strokeStyle = S.foam;
        g.lineWidth = s * 0.02;
        g.beginPath();
        g.ellipse(s * 0.8, s * 0.5, s * 0.1, s * 0.05, 0, 0, Math.PI * 2);
        g.stroke();
        drops(g, [[s * 0.6, s * 0.2, s * 0.025], [s * 0.88, s * 0.3, s * 0.02], [s * 0.3, s * 0.3, s * 0.02]]);
        coral(g, s * 0.82, s * 0.5, s * 0.03);
      },
    },
    {
      key: 'W', label: 'whirlpool', name: 'Whirlpool', range: 10, cooldown: 7, cc: true,
      blurb: 'A pool spreads and three ribbons spiral up, pulling enemies in twice, and a water column knocks them up.',
      icon(g, s) {
        iconGround(g, s);
        // A pool ellipse with three spiral ribbons rising.
        g.fillStyle = '#0d4f74';
        g.strokeStyle = S.foam;
        g.lineWidth = s * 0.02;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.78, s * 0.4, s * 0.12, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const pts: [number, number][] = [];
          for (let k = 0; k <= 5; k++) {
            const u = k / 5, an = a + u * 4.4, r = s * (0.34 - 0.24 * u);
            pts.push([s * 0.5 + Math.cos(an) * r, s * 0.74 - u * s * 0.5 + Math.sin(an) * r * 0.3]);
          }
          ribbon(g, pts, s * 0.07, true);
        }
        drops(g, [[s * 0.5, s * 0.12, s * 0.025], [s * 0.3, s * 0.2, s * 0.018], [s * 0.72, s * 0.22, s * 0.018]]);
      },
    },
    {
      key: 'E', label: 'undertow dance', name: 'Undertow Dance', range: 6, cooldown: 9,
      blurb: 'She surfs up to 6 m to the aim, healing 15 on landing, and leaves a foam strip for 3 s that slows whoever crosses it.',
      icon(g, s) {
        iconGround(g, s);
        // A flat ring of water with a foam rim round a small figure.
        g.strokeStyle = S.foam;
        g.lineWidth = s * 0.13;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.66, s * 0.38, s * 0.15, 0, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = S.body;
        g.lineWidth = s * 0.09;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.66, s * 0.38, s * 0.15, 0, 0, Math.PI * 2);
        g.stroke();
        // Two sashes round her.
        ribbon(g, [[s * 0.32, s * 0.52], [s * 0.42, s * 0.36], [s * 0.62, s * 0.34], [s * 0.7, s * 0.24]], s * 0.07);
        ribbon(g, [[s * 0.68, s * 0.5], [s * 0.58, s * 0.62], [s * 0.4, s * 0.6], [s * 0.3, s * 0.4]], s * 0.06, false);
        g.fillStyle = S.foam;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.5, s * 0.05, s * 0.12, 0, 0, Math.PI * 2);
        g.fill();
        coral(g, s * 0.5, s * 0.34, s * 0.025);
      },
    },
    {
      key: 'R', label: "leviathan's waltz", name: "Leviathan's Waltz", range: 12, cooldown: 20, aim: 'line', cc: true,
      blurb: "Ultimate. A water serpent coils over a 12 m strip from her, rears up and dives through it: everything on it is knocked up.",
      icon(g, s) {
        iconGround(g, s);
        // The serpent: a coiling ribbon with a head and a foam mane, over a foam crown on the floor.
        crown(g, s * 0.5, s * 0.86, s * 0.34, s * 0.16, s * 0.1);
        ribbon(g, [[s * 0.14, s * 0.62], [s * 0.3, s * 0.5], [s * 0.2, s * 0.32], [s * 0.42, s * 0.22], [s * 0.64, s * 0.34], [s * 0.74, s * 0.18]], s * 0.13, false);
        // Head: a rounded wedge with two eye dots and a mane of foam spikes.
        const hx = s * 0.76, hy = s * 0.16;
        g.fillStyle = S.body;
        g.strokeStyle = S.dark;
        g.lineWidth = s * 0.016;
        g.beginPath();
        g.ellipse(hx, hy, s * 0.1, s * 0.07, -0.3, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = S.foam;
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.moveTo(hx - s * 0.04 - i * s * 0.025, hy - s * 0.05);
          g.lineTo(hx - s * 0.1 - i * s * 0.035, hy - s * (0.12 + 0.02 * (i % 2)));
          g.lineTo(hx - s * 0.02 - i * s * 0.025, hy - s * 0.02);
          g.fill();
        }
        g.beginPath();
        g.arc(hx + s * 0.02, hy - s * 0.015, s * 0.012, 0, Math.PI * 2);
        g.arc(hx + s * 0.055, hy + s * 0.005, s * 0.01, 0, Math.PI * 2);
        g.fill();
        drops(g, [[s * 0.1, s * 0.3, s * 0.02], [s * 0.5, s * 0.1, s * 0.02], [s * 0.9, s * 0.5, s * 0.02]]);
        coral(g, s * 0.5, s * 0.84, s * 0.03);
      },
    },
  ],
};
