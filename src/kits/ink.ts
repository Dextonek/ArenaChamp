import type { HeroKit } from '../heroes';

/**
 * Ink kit data: Shiori, the Last Brush. Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * sumi-black ground with an indigo glow, wet tapered brushstrokes with dry-brush streaks, pale rice-paper patches under
 * the ink, vermilion square seals. Signature shape: the wet brushstroke.
 */
const S = {
  core: '#ffffff', hot: '#c8d4ff', body: '#3a5ae8', accent: '#ff4a2a', dark: '#0b0a0e', foil: '#efe6d2',
};

type Pt = [number, number];

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#1d2658');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A smooth curve through `pts` (Catmull-Rom), `n` points. */
function curve(pts: Pt[], n = 28): Pt[] {
  const out: Pt[] = [];
  const m = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const f = (i / (n - 1)) * m, j = Math.min(Math.floor(f), m - 1), t = f - j;
    const p0 = pts[Math.max(j - 1, 0)], p1 = pts[j], p2 = pts[j + 1], p3 = pts[Math.min(j + 2, m)];
    const c = (a: number, b: number, c2: number, d: number) =>
      0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

/** The ribbon polygon along `pts` with half widths `w * k(t)`. */
function ribbon(g: CanvasRenderingContext2D, line: Pt[], w: number, from: number, to: number, grow = 0) {
  const n = line.length, a = Math.floor(from * (n - 1)), b = Math.floor(to * (n - 1));
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = a; i <= b; i++) {
    const t = i / (n - 1), p = line[i], q = line[Math.min(i + 1, n - 1)], o = line[Math.max(i - 1, 0)];
    let dx = q[0] - o[0], dy = q[1] - o[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const press = 0.55 + 0.45 * Math.min(1, t / 0.09);
    const hw = (w * 0.5 * press * (1 - 0.92 * Math.pow(Math.max(0, t - 0.14) / 0.86, 1.15)) + grow) * (1 + 0.1 * Math.sin(t * 13));
    left.push([p[0] - dy * hw, p[1] + dx * hw]);
    right.push([p[0] + dy * hw, p[1] - dx * hw]);
  }
  g.beginPath();
  left.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
  g.closePath();
  g.fill();
}

/** A wet brushstroke: indigo rim glow, sumi body, a pale wet highlight, and a dry tail of thin streaks. */
function brush(g: CanvasRenderingContext2D, pts: Pt[], w: number, body = S.dark) {
  const line = curve(pts);
  g.fillStyle = S.body;
  ribbon(g, line, w, 0, 0.62, w * 0.1);
  g.fillStyle = body;
  ribbon(g, line, w, 0, 0.62);
  // The dry tail: separate thin bristle lines that give out at different points.
  const ends = [0.98, 0.88, 0.94, 0.8, 0.9];
  ends.forEach((e, k) => {
    const off = (k - 2) * w * 0.12;
    g.beginPath();
    for (let i = Math.floor(0.55 * (line.length - 1)); i <= Math.floor(e * (line.length - 1)); i++) {
      const p = line[i], q = line[Math.min(i + 1, line.length - 1)];
      const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
      const t = i / (line.length - 1), sc = 1 - 0.9 * Math.pow(Math.max(0, t - 0.14) / 0.86, 1.15);
      const x = p[0] - (dy / l) * off * sc * 3, y = p[1] + (dx / l) * off * sc * 3;
      if (i === Math.floor(0.55 * (line.length - 1))) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokeStyle = body;
    g.lineWidth = Math.max(1, w * 0.07);
    g.stroke();
  });
  g.strokeStyle = 'rgba(200,212,255,0.4)';
  g.lineWidth = Math.max(1, w * 0.05);
  g.beginPath();
  for (let i = 1; i < Math.floor(0.5 * (line.length - 1)); i++) {
    const p = line[i], q = line[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
    const x = p[0] + (dy / l) * w * 0.14, y = p[1] - (dx / l) * w * 0.14;
    if (i === 1) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}

/** An ink drop with a rim glow. */
function drop(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = S.body;
  g.beginPath();
  g.arc(x, y, r * 1.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.dark;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** A torn patch of rice paper. */
function paper(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed = 1) {
  g.fillStyle = S.foil;
  g.beginPath();
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, j = 1 + 0.07 * Math.sin(i * 2.7 + seed) + 0.05 * Math.sin(i * 5.1 + seed * 2);
    const x = cx + Math.cos(a) * rx * j, y = cy + Math.sin(a) * ry * j;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
}

/** A vermilion square seal with a pale border and a carved glyph. */
function seal(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, rot = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.fillStyle = S.foil;
  g.fillRect(-size / 2, -size / 2, size, size);
  g.fillStyle = S.accent;
  g.fillRect(-size * 0.42, -size * 0.42, size * 0.84, size * 0.84);
  g.strokeStyle = S.foil;
  g.lineWidth = Math.max(1, size * 0.1);
  g.strokeRect(-size * 0.2, -size * 0.2, size * 0.4, size * 0.4);
  g.beginPath();
  g.moveTo(0, -size * 0.32); g.lineTo(0, size * 0.32);
  g.moveTo(-size * 0.2, 0); g.lineTo(size * 0.2, 0);
  g.stroke();
  g.restore();
}

/** A folded paper crane facing right (`flip` -1 faces left), `u` is its half-length. */
function crane(g: CanvasRenderingContext2D, cx: number, cy: number, u: number, flip = 1) {
  g.save();
  g.translate(cx, cy);
  g.scale(flip, 1);
  const poly = (pts: Pt[], fill: string) => {
    g.fillStyle = fill;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * u, y * u) : g.moveTo(x * u, y * u)));
    g.closePath();
    g.fill();
  };
  // Far wing, tail, body, neck and head, near wing with its ink-brushed tip, the vermilion dot.
  poly([[-0.1, -0.1], [0.3, -1.0], [0.55, -0.85]], '#cfc6b0');
  poly([[-0.9, 0.0], [-0.1, -0.25], [-0.1, 0.2]], '#d8cfb8');
  poly([[-0.1, -0.3], [0.7, 0.0], [0.15, 0.4], [-0.5, 0.25]], S.foil);
  poly([[0.6, -0.05], [0.95, -0.7], [1.05, -0.62], [0.78, 0.05]], '#e2d9c3');
  poly([[0.95, -0.7], [1.3, -0.6], [1.05, -0.62]], S.dark);
  poly([[0.05, 0.0], [-0.1, -0.2], [0.2, -1.1], [0.45, -0.9], [0.4, -0.15]], S.foil);
  poly([[0.2, -1.1], [0.1, -0.7], [0.45, -0.9]], S.dark);
  g.fillStyle = S.accent;
  g.beginPath();
  g.arc(1.0 * u, -0.69 * u, u * 0.09, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export const inkKit: HeroKit = {
  name: 'Shiori',
  title: 'the Last Brush',
  accent: S.body,
  foil: S.foil,
  portrait(g, s) {
    iconGround(g, s);
    // Paper talisman strips floating round her, a vermilion mark on each.
    for (const [x, y, rot] of [[0.14, 0.3, -0.25], [0.86, 0.22, 0.2], [0.26, 0.14, 0.15], [0.74, 0.4, -0.15]] as [number, number, number][]) {
      g.save();
      g.translate(s * x, s * y);
      g.rotate(rot);
      g.fillStyle = S.foil;
      g.fillRect(-s * 0.03, -s * 0.09, s * 0.06, s * 0.18);
      g.fillStyle = S.accent;
      g.fillRect(-s * 0.014, -s * 0.06, s * 0.028, s * 0.03);
      g.fillStyle = S.dark;
      g.fillRect(-s * 0.012, -s * 0.01, s * 0.024, s * 0.006);
      g.fillRect(-s * 0.012, s * 0.02, s * 0.024, s * 0.006);
      g.restore();
    }
    // The huge brush on the right: handle, ferrule, wet bristles.
    brush(g, [[s * 0.9, s * 0.02], [s * 0.88, s * 0.3], [s * 0.86, s * 0.6]], s * 0.05);
    g.fillStyle = S.foil;
    g.fillRect(s * 0.84, s * 0.58, s * 0.05, s * 0.05);
    brush(g, [[s * 0.86, s * 0.63], [s * 0.85, s * 0.8], [s * 0.86, s * 0.98]], s * 0.1);
    // Shoulders in a rice-paper white robe, the hem washed in ink that bleeds upward, an indigo sash.
    g.fillStyle = S.foil;
    g.beginPath();
    g.moveTo(s * 0.14, s);
    g.quadraticCurveTo(s * 0.18, s * 0.68, s * 0.34, s * 0.58);
    g.quadraticCurveTo(s * 0.5, s * 0.5, s * 0.66, s * 0.58);
    g.quadraticCurveTo(s * 0.82, s * 0.68, s * 0.86, s);
    g.closePath();
    g.fill();
    const wash = g.createLinearGradient(0, s * 0.72, 0, s);
    wash.addColorStop(0, 'rgba(11,10,14,0)');
    wash.addColorStop(1, 'rgba(11,10,14,0.95)');
    g.fillStyle = wash;
    g.fill();
    g.fillStyle = S.body;
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.72);
    g.quadraticCurveTo(s * 0.5, s * 0.78, s * 0.7, s * 0.72);
    g.lineTo(s * 0.7, s * 0.8);
    g.quadraticCurveTo(s * 0.5, s * 0.86, s * 0.3, s * 0.8);
    g.closePath();
    g.fill();
    seal(g, s * 0.62, s * 0.88, s * 0.1);
    // Head: a calm face, long black hair parted in the middle, a hairpin shaped like a brush.
    g.fillStyle = S.dark;
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.4);
    g.quadraticCurveTo(s * 0.22, s * 0.7, s * 0.3, s * 0.92);
    g.lineTo(s * 0.38, s * 0.9);
    g.lineTo(s * 0.4, s * 0.4);
    g.closePath();
    g.moveTo(s * 0.7, s * 0.4);
    g.quadraticCurveTo(s * 0.78, s * 0.7, s * 0.7, s * 0.92);
    g.lineTo(s * 0.62, s * 0.9);
    g.lineTo(s * 0.6, s * 0.4);
    g.closePath();
    g.fill();
    g.fillStyle = '#ecd9d2';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.43, s * 0.115, s * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.36, s * 0.16, s * 0.15, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.21);
    g.quadraticCurveTo(s * 0.4, s * 0.3, s * 0.38, s * 0.44);
    g.lineTo(s * 0.42, s * 0.3);
    g.quadraticCurveTo(s * 0.47, s * 0.26, s * 0.5, s * 0.21);
    g.moveTo(s * 0.5, s * 0.21);
    g.quadraticCurveTo(s * 0.6, s * 0.3, s * 0.62, s * 0.44);
    g.lineTo(s * 0.58, s * 0.3);
    g.closePath();
    g.fill();
    g.strokeStyle = S.foil;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(s * 0.58, s * 0.3);
    g.lineTo(s * 0.74, s * 0.1);
    g.stroke();
    g.fillStyle = S.accent;
    g.beginPath();
    g.arc(s * 0.74, s * 0.1, s * 0.016, 0, Math.PI * 2);
    g.fill();
    // Eyes: calm half-closed lids, indigo irises; a vermilion mouth.
    for (const sx of [0.445, 0.555]) {
      g.fillStyle = S.dark;
      g.fillRect(s * (sx - 0.03), s * 0.425, s * 0.06, s * 0.012);
      g.fillStyle = S.body;
      g.beginPath();
      g.ellipse(s * sx, s * 0.445, s * 0.02, s * 0.014, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#b8453a';
    g.fillRect(s * 0.47, s * 0.52, s * 0.06, s * 0.009);
  },
  spells: [
    {
      key: 'Q', label: 'brushstroke', name: 'Brushstroke', range: 12, cooldown: 3, aim: 'line',
      blurb: 'Flings a wet brushstroke that hits the first enemy; if it flies its full range it splits into three small strokes.',
      icon(g, s) {
        iconGround(g, s);
        // A fat stroke flying up and to the right, drying out behind it; three drops fan off its end, a seal in the corner.
        paper(g, s * 0.3, s * 0.72, s * 0.24, s * 0.16, 2);
        brush(g, [[s * 0.9, s * 0.2], [s * 0.66, s * 0.38], [s * 0.4, s * 0.62], [s * 0.1, s * 0.9]], s * 0.2);
        drop(g, s * 0.92, s * 0.1, s * 0.035);
        drop(g, s * 0.82, s * 0.07, s * 0.028);
        drop(g, s * 0.96, s * 0.3, s * 0.03);
        drop(g, s * 0.74, s * 0.18, s * 0.02);
        seal(g, s * 0.82, s * 0.84, s * 0.14, -0.1);
      },
    },
    {
      key: 'W', label: 'ink snare', name: 'Ink Snare', range: 10, cooldown: 8, cc: true,
      blurb: 'Ink bleeds into paper on the ground, then grasping strokes rise to hurt and root everyone inside.',
      icon(g, s) {
        iconGround(g, s);
        // A torn paper disc on the floor, a dark pool bleeding into it, grasping strokes rising round a seal.
        paper(g, s * 0.5, s * 0.74, s * 0.42, s * 0.17, 5);
        g.fillStyle = S.body;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.74, s * 0.3, s * 0.115, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.dark;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.74, s * 0.27, s * 0.095, 0, 0, Math.PI * 2);
        g.fill();
        brush(g, [[s * 0.24, s * 0.76], [s * 0.18, s * 0.5], [s * 0.3, s * 0.26]], s * 0.1);
        brush(g, [[s * 0.76, s * 0.76], [s * 0.84, s * 0.48], [s * 0.72, s * 0.24]], s * 0.1);
        brush(g, [[s * 0.4, s * 0.8], [s * 0.36, s * 0.52], [s * 0.46, s * 0.18]], s * 0.11);
        brush(g, [[s * 0.6, s * 0.8], [s * 0.66, s * 0.5], [s * 0.56, s * 0.2]], s * 0.11);
        seal(g, s * 0.5, s * 0.74, s * 0.15);
        drop(g, s * 0.12, s * 0.86, s * 0.022);
        drop(g, s * 0.9, s * 0.88, s * 0.02);
      },
    },
    {
      key: 'E', label: 'paper familiars', name: 'Paper Familiars', range: 0, cooldown: 14, summon: true,
      blurb: 'Folds two paper cranes that fight for her for six seconds, shooting ink darts; a splash of ink hurts nearby enemies.',
      icon(g, s) {
        iconGround(g, s);
        // A ring of ink splashing out on the floor, two cranes above it, a seal under each.
        g.strokeStyle = S.body;
        g.lineWidth = s * 0.024;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.78, s * 0.42, s * 0.12, 0, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = S.hot;
        g.globalAlpha = 0.45;
        g.lineWidth = s * 0.008;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.78, s * 0.42, s * 0.12, 0, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
        seal(g, s * 0.3, s * 0.8, s * 0.13, 0.1);
        seal(g, s * 0.72, s * 0.76, s * 0.11, -0.1);
        crane(g, s * 0.36, s * 0.5, s * 0.2, 1);
        crane(g, s * 0.72, s * 0.34, s * 0.14, -1);
        drop(g, s * 0.1, s * 0.62, s * 0.02);
        drop(g, s * 0.92, s * 0.6, s * 0.022);
      },
    },
    {
      key: 'R', label: 'final calligraphy', name: 'Final Calligraphy', range: 13, cooldown: 20, cc: true,
      blurb: 'Ultimate. A giant brush writes one huge character across a sheet of paper; a giant seal stamps it and the ink erupts, blinding everyone inside.',
      icon(g, s) {
        iconGround(g, s);
        // A big paper sheet with a huge character in five strokes, the brush above it, a giant seal dropping in.
        paper(g, s * 0.5, s * 0.64, s * 0.46, s * 0.34, 9);
        brush(g, [[s * 0.42, s * 0.3], [s * 0.48, s * 0.34], [s * 0.54, s * 0.4]], s * 0.1);
        brush(g, [[s * 0.14, s * 0.46], [s * 0.4, s * 0.48], [s * 0.7, s * 0.46], [s * 0.82, s * 0.5]], s * 0.1);
        brush(g, [[s * 0.52, s * 0.36], [s * 0.5, s * 0.6], [s * 0.5, s * 0.8], [s * 0.42, s * 0.82]], s * 0.12);
        brush(g, [[s * 0.5, s * 0.58], [s * 0.36, s * 0.7], [s * 0.2, s * 0.84]], s * 0.1);
        brush(g, [[s * 0.52, s * 0.58], [s * 0.66, s * 0.7], [s * 0.84, s * 0.86]], s * 0.11);
        brush(g, [[s * 0.1, s * 0.02], [s * 0.2, s * 0.2], [s * 0.3, s * 0.36]], s * 0.07);
        seal(g, s * 0.74, s * 0.24, s * 0.3, 0.08);
        drop(g, s * 0.9, s * 0.58, s * 0.025);
        drop(g, s * 0.08, s * 0.68, s * 0.022);
      },
    },
  ],
};
