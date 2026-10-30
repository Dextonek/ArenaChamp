import type { HeroKit } from '../heroes';

/**
 * Prism kit data: Opaline, the Lightbreaker. Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * deep violet-black ground, pale lavender glass crystals with dark facet edges, light that enters white and leaves as thin
 * parallel bands of red, gold, green and blue. Signature shape: the refracting crystal.
 */
const S = {
  core: '#ffffff', hot: '#f2eeff', body: '#b8b0ff', shade: '#7f74d6', dark: '#14102a', foil: '#f0f4ff',
  red: '#ff5a6a', gold: '#ffd24a', green: '#5aff9a', blue: '#5ab8ff',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#2a2158');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A double-terminated faceted crystal centred at (cx,cy), `h` half-length, `w` half-width, turned by `rot` (0 = upright). */
function shard(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, w: number, rot = 0, fill = S.body) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const pts: [number, number][] = [[0, -h], [w, -h * 0.45], [w, h * 0.45], [0, h], [-w, h * 0.45], [-w, -h * 0.45]];
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  // The lighter top-left facets and a darker right edge.
  g.fillStyle = S.hot;
  g.beginPath();
  g.moveTo(0, -h);
  g.lineTo(-w, -h * 0.45);
  g.lineTo(-w * 0.25, -h * 0.1);
  g.closePath();
  g.fill();
  g.fillStyle = S.shade;
  g.beginPath();
  g.moveTo(w, -h * 0.45);
  g.lineTo(w, h * 0.45);
  g.lineTo(0, h);
  g.lineTo(w * 0.2, h * 0.1);
  g.closePath();
  g.fill();
  g.strokeStyle = S.dark;
  g.lineWidth = Math.max(1, w * 0.22);
  g.lineJoin = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.stroke();
  g.beginPath();
  g.moveTo(0, -h);
  g.lineTo(-w * 0.25, -h * 0.1);
  g.lineTo(0, h);
  g.lineWidth = Math.max(1, w * 0.1);
  g.stroke();
  g.restore();
}

/** A beam from (x1,y1) to (x2,y2): a white core with thin parallel bands (a single `tint` gives one colour each side). */
function beam(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, tint?: string) {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  g.lineCap = 'round';
  const cols = tint ? [tint, tint] : [S.red, S.gold];
  const cols2 = tint ? [tint, tint] : [S.green, S.blue];
  g.globalAlpha = 0.8;
  for (let k = 0; k < 2; k++) {
    for (const [side, c] of [[-1, cols[k]], [1, cols2[k]]] as [number, string][]) {
      const o = side * w * (k === 0 ? 0.62 : 0.34);
      g.strokeStyle = c;
      g.lineWidth = w * 0.3;
      g.beginPath();
      g.moveTo(x1 + nx * o, y1 + ny * o);
      g.lineTo(x2 + nx * o, y2 + ny * o);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.strokeStyle = S.core;
  g.lineWidth = w * 0.36;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

/** A small four-point glint. */
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number, c = S.core) {
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r * 0.22, y - r * 0.22);
  g.lineTo(x + r, y);
  g.lineTo(x + r * 0.22, y + r * 0.22);
  g.lineTo(x, y + r);
  g.lineTo(x - r * 0.22, y + r * 0.22);
  g.lineTo(x - r, y);
  g.lineTo(x - r * 0.22, y - r * 0.22);
  g.closePath();
  g.fill();
}

export const prismKit: HeroKit = {
  name: 'Opaline',
  maxHp: 560,
  title: 'the Lightbreaker',
  accent: S.body,
  foil: S.foil,
  portrait(g, s) {
    iconGround(g, s);
    // A floating ring of small prisms behind her head, light bending through one of them.
    g.strokeStyle = 'rgba(184,176,255,0.35)';
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.34, s * 0.34, s * 0.12, 0, 0, Math.PI * 2);
    g.stroke();
    for (const [x, y, h, rot] of [[0.16, 0.32, 0.075, 0.3], [0.84, 0.3, 0.075, -0.3], [0.3, 0.2, 0.06, 0.1], [0.7, 0.19, 0.06, -0.15], [0.5, 0.14, 0.07, 0]] as [number, number, number, number][]) {
      shard(g, s * x, s * y, s * h, s * h * 0.42, rot, S.body);
    }
    beam(g, s * 0.14, s * 0.2, s * 0.2, s * 0.3, s * 0.03);
    glint(g, s * 0.86, s * 0.46, s * 0.05);
    // Shoulders in a pale lavender robe with white trim and crystal epaulettes.
    g.fillStyle = '#6f66c4';
    g.beginPath();
    g.moveTo(s * 0.14, s);
    g.quadraticCurveTo(s * 0.18, s * 0.68, s * 0.34, s * 0.58);
    g.quadraticCurveTo(s * 0.5, s * 0.5, s * 0.66, s * 0.58);
    g.quadraticCurveTo(s * 0.82, s * 0.68, s * 0.86, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.hot;
    g.lineWidth = s * 0.022;
    g.stroke();
    shard(g, s * 0.27, s * 0.62, s * 0.08, s * 0.035, -0.5, S.body);
    shard(g, s * 0.73, s * 0.62, s * 0.08, s * 0.035, 0.5, S.body);
    // A crystal brooch at the throat.
    shard(g, s * 0.5, s * 0.72, s * 0.05, s * 0.026, 0, S.hot);
    // Head: a cool, calm face, long pale hair parted in the middle.
    g.fillStyle = '#e9d9d6';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.43, s * 0.115, s * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d9d2ff';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.36, s * 0.16, s * 0.15, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.34, s * 0.36);
    g.quadraticCurveTo(s * 0.3, s * 0.52, s * 0.37, s * 0.64);
    g.quadraticCurveTo(s * 0.4, s * 0.5, s * 0.42, s * 0.36);
    g.moveTo(s * 0.66, s * 0.36);
    g.quadraticCurveTo(s * 0.7, s * 0.52, s * 0.63, s * 0.64);
    g.quadraticCurveTo(s * 0.6, s * 0.5, s * 0.58, s * 0.36);
    g.fill();
    g.strokeStyle = S.dark;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.22);
    g.lineTo(s * 0.46, s * 0.32);
    g.stroke();
    // Eyes: pale prism-blue with a white glint; a faint spectrum fleck on the cheek.
    for (const sx of [0.445, 0.555]) {
      g.fillStyle = S.dark;
      g.fillRect(s * (sx - 0.03), s * 0.425, s * 0.06, s * 0.012);
      g.fillStyle = S.blue;
      g.beginPath();
      g.ellipse(s * sx, s * 0.445, s * 0.022, s * 0.016, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = S.gold;
    g.fillRect(s * 0.6, s * 0.49, s * 0.01, s * 0.01);
    g.fillStyle = '#b87f86';
    g.fillRect(s * 0.47, s * 0.52, s * 0.06, s * 0.009);
    // The wand: a thin dark staff on the right with a crystal tip.
    g.strokeStyle = S.dark;
    g.lineWidth = s * 0.016;
    g.beginPath();
    g.moveTo(s * 0.9, s * 0.98);
    g.lineTo(s * 0.9, s * 0.6);
    g.stroke();
    shard(g, s * 0.9, s * 0.54, s * 0.075, s * 0.03, 0, S.hot);
  },
  spells: [
    {
      key: 'Q', label: 'prism bolt', name: 'Prism Bolt', range: 14, cooldown: 2, aim: 'line',
      blurb: 'Fires a crystal that shatters on the first enemy into three spectral beams that fan out and hit again.',
      icon(g, s) {
        iconGround(g, s);
        // A crystal flying up and to the right with a white trail; three beams fan out of its end.
        beam(g, s * 0.06, s * 0.9, s * 0.4, s * 0.58, s * 0.05);
        beam(g, s * 0.58, s * 0.44, s * 0.94, s * 0.12, s * 0.055, S.red);
        beam(g, s * 0.58, s * 0.44, s * 0.96, s * 0.38, s * 0.055, S.gold);
        beam(g, s * 0.58, s * 0.44, s * 0.82, s * 0.8, s * 0.055, S.blue);
        shard(g, s * 0.5, s * 0.5, s * 0.17, s * 0.075, 0.9, S.body);
        glint(g, s * 0.62, s * 0.4, s * 0.1);
        glint(g, s * 0.2, s * 0.36, s * 0.045);
        glint(g, s * 0.84, s * 0.66, s * 0.04);
      },
    },
    {
      key: 'W', label: 'refraction field', name: 'Refraction Field', range: 10, cooldown: 7,
      blurb: 'A ring of crystals feeds a prism that bursts in spectral light: damage and a blind to everyone inside.',
      icon(g, s) {
        iconGround(g, s);
        // A floor ring with six crystals, white beams into a prism, and coloured rays flashing down.
        g.strokeStyle = 'rgba(240,244,255,0.5)';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.74, s * 0.4, s * 0.15, 0, 0, Math.PI * 2);
        g.stroke();
        const ring: [number, number][] = [];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          ring.push([s * (0.5 + Math.cos(a) * 0.4), s * (0.74 + Math.sin(a) * 0.15)]);
        }
        ring.sort((a, b) => a[1] - b[1]);
        for (const [x, y] of ring) beam(g, x, y - s * 0.08, s * 0.5, s * 0.34, s * 0.022, S.hot);
        for (const [x, y] of ring) shard(g, x, y - s * 0.02, s * 0.1, s * 0.04, x < s * 0.5 ? 0.2 : -0.2, S.body);
        for (const [dx, tint] of [[-0.34, S.red], [-0.12, S.gold], [0.12, S.green], [0.34, S.blue]] as [number, string][]) {
          beam(g, s * 0.5, s * 0.36, s * (0.5 + dx), s * 0.78, s * 0.04, tint);
        }
        shard(g, s * 0.5, s * 0.3, s * 0.15, s * 0.07, 0, S.hot);
        glint(g, s * 0.5, s * 0.3, s * 0.08);
      },
    },
    {
      key: 'E', label: 'mirror shell', name: 'Mirror Shell', range: 0, cooldown: 9,
      blurb: 'A blink: six crystal mirrors flash and she jumps 4 m sideways of the enemy, wrapped in a 45 HP shield. No damage.',
      icon(g, s) {
        iconGround(g, s);
        // Beams out to the sides, a ring of mirrors seen at an angle round a small figure.
        for (const [dx, dy, tint] of [[0.46, 0.04, S.red], [0.4, 0.2, S.gold], [-0.46, 0.04, S.green], [-0.4, 0.2, S.blue]] as [number, number, string][]) {
          beam(g, s * 0.5, s * 0.6, s * (0.5 + dx), s * (0.6 + dy), s * 0.04, tint);
        }
        g.strokeStyle = 'rgba(240,244,255,0.45)';
        g.lineWidth = s * 0.012;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.74, s * 0.3, s * 0.1, 0, 0, Math.PI * 2);
        g.stroke();
        const panes: [number, number][] = [];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.5;
          panes.push([s * (0.5 + Math.cos(a) * 0.3), s * (0.62 + Math.sin(a) * 0.1)]);
        }
        panes.sort((a, b) => a[1] - b[1]);
        for (const [x, y] of panes) {
          if (y < s * 0.62) shard(g, x, y, s * 0.14, s * 0.05, 0, S.shade);
        }
        // The figure: a pale robe and head.
        g.fillStyle = S.foil;
        g.beginPath();
        g.moveTo(s * 0.43, s * 0.8);
        g.quadraticCurveTo(s * 0.5, s * 0.46, s * 0.57, s * 0.8);
        g.closePath();
        g.fill();
        g.fillStyle = '#e9d9d6';
        g.beginPath();
        g.arc(s * 0.5, s * 0.44, s * 0.05, 0, Math.PI * 2);
        g.fill();
        for (const [x, y] of panes) {
          if (y >= s * 0.62) shard(g, x, y, s * 0.14, s * 0.05, 0, S.body);
        }
        glint(g, s * 0.2, s * 0.3, s * 0.05);
        glint(g, s * 0.8, s * 0.28, s * 0.04);
      },
    },
    {
      key: 'R', label: 'spectrum lance', name: 'Spectrum Lance', range: 0, cooldown: 20,
      blurb: 'Ultimate. No aim: she turns to the nearest enemy within 12 m and holds a rainbow beam there for 2 s, rooted, and it sweeps 70 degrees, hitting three times.',
      icon(g, s) {
        iconGround(g, s);
        // A ring on the floor, seven lances slamming down from the prism, the sky beam above.
        g.strokeStyle = 'rgba(240,244,255,0.5)';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.82, s * 0.42, s * 0.11, 0, 0, Math.PI * 2);
        g.stroke();
        const tints = [S.red, S.gold, S.green, S.blue, S.red, S.gold, S.blue];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.4;
          beam(g, s * 0.5, s * 0.44, s * (0.5 + Math.cos(a) * 0.4), s * (0.82 + Math.sin(a) * 0.1), s * 0.04, tints[i]);
        }
        beam(g, s * 0.5, 0, s * 0.5, s * 0.22, s * 0.07);
        for (const [x, y, h] of [[0.14, 0.3, 0.06], [0.86, 0.3, 0.06], [0.27, 0.12, 0.05], [0.73, 0.12, 0.05]] as [number, number, number][]) {
          shard(g, s * x, s * y, s * h, s * h * 0.42, 0, S.body);
        }
        shard(g, s * 0.5, s * 0.38, s * 0.2, s * 0.1, 0, S.hot);
        glint(g, s * 0.5, s * 0.38, s * 0.1);
      },
    },
  ],
};
