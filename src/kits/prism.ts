import type { HeroKit } from '../heroes';

/**
 * Prism kit data: Opaline, the Lightbreaker (kits v5). Four spells (labels as registered), canvas-drawn icons in the kit's palette:
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
      key: 'Q', label: 'ricochet light', name: 'Ricochet Light', range: 12, cooldown: 3, aim: 'line', bank: true,
      blurb: 'A bolt of light (12 m) that bounces off up to two walls, pillars or crystals: 50 damage, +25% for each bounce. A hit after bouncing takes 1 s per bounce off this spell.',
      icon(g, s) {
        iconGround(g, s);
        // A wall on the right; a white beam runs in from the lower left, hits it, and leaves as a golden beam to the upper left.
        g.fillStyle = S.dark;
        g.fillRect(s * 0.76, s * 0.08, s * 0.2, s * 0.84);
        g.fillStyle = S.shade;
        g.fillRect(s * 0.76, s * 0.08, s * 0.045, s * 0.84);
        g.strokeStyle = S.hot;
        g.lineWidth = s * 0.014;
        g.strokeRect(s * 0.76, s * 0.08, s * 0.2, s * 0.84);
        beam(g, s * 0.06, s * 0.86, s * 0.76, s * 0.5, s * 0.06);
        beam(g, s * 0.76, s * 0.5, s * 0.1, s * 0.12, s * 0.06, S.gold);
        shard(g, s * 0.3, s * 0.72, s * 0.1, s * 0.045, 1.1, S.body);
        glint(g, s * 0.76, s * 0.5, s * 0.15);
        glint(g, s * 0.22, s * 0.28, s * 0.05);
      },
    },
    {
      key: 'W', label: 'crystal pillar', name: 'Crystal', range: 8, cooldown: 12,
      blurb: 'A crystal rises at a spot (8 m) for 6 s, or until 80 damage breaks it. It blocks walking, sight and bolts for both of you, and her bolts bounce off it.',
      icon(g, s) {
        iconGround(g, s);
        // A floor ring, a tall crystal with two small ones at its foot, a beam bouncing off its side.
        g.strokeStyle = 'rgba(240,244,255,0.5)';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.84, s * 0.38, s * 0.1, 0, 0, Math.PI * 2);
        g.stroke();
        beam(g, s * 0.02, s * 0.3, s * 0.4, s * 0.46, s * 0.04);
        beam(g, s * 0.4, s * 0.46, s * 0.14, s * 0.9, s * 0.04, S.blue);
        shard(g, s * 0.5, s * 0.46, s * 0.4, s * 0.16, 0, S.body);
        shard(g, s * 0.26, s * 0.76, s * 0.12, s * 0.05, -0.3, S.shade);
        shard(g, s * 0.76, s * 0.74, s * 0.14, s * 0.055, 0.3, S.body);
        glint(g, s * 0.5, s * 0.18, s * 0.09);
        glint(g, s * 0.86, s * 0.34, s * 0.04);
      },
    },
    {
      key: 'E', label: 'blinding flare', name: 'Blinding Flare', range: 0, cooldown: 10, cc: true,
      blurb: 'A flash of light (3 m) round her: enemies in it are blinded for 1.5 s and pushed 2 m away.',
      icon(g, s) {
        iconGround(g, s);
        // A white burst: a pale disc, spectrum rays out of it, a ring on the floor.
        g.strokeStyle = 'rgba(240,244,255,0.55)';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.8, s * 0.42, s * 0.11, 0, 0, Math.PI * 2);
        g.stroke();
        const tints = [S.red, S.gold, S.green, S.blue, S.red, S.gold, S.green, S.blue];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.2;
          beam(g, s * 0.5, s * 0.46, s * (0.5 + Math.cos(a) * 0.46), s * (0.46 + Math.sin(a) * 0.4), s * 0.045, tints[i]);
        }
        const r = g.createRadialGradient(s * 0.5, s * 0.46, s * 0.02, s * 0.5, s * 0.46, s * 0.2);
        r.addColorStop(0, '#ffffff');
        r.addColorStop(0.6, S.hot);
        r.addColorStop(1, 'rgba(184,176,255,0)');
        g.fillStyle = r;
        g.beginPath();
        g.arc(s * 0.5, s * 0.46, s * 0.2, 0, Math.PI * 2);
        g.fill();
        glint(g, s * 0.5, s * 0.46, s * 0.17);
      },
    },
    {
      key: 'R', label: 'shatterlight', name: 'Shatterlight', range: 10, cooldown: 22,
      blurb: 'Click an enemy (10 m, in sight). Six shards ring the spot they stand on and, after 1.2 s, each fires inward through it: 30 damage each, and each bounces once off a wall. Step out of the ring to dodge.',
      icon(g, s) {
        iconGround(g, s);
        // A ring of six shards seen at an angle, each throwing a beam in to a glint at the middle.
        g.strokeStyle = 'rgba(240,244,255,0.45)';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.58, s * 0.4, s * 0.2, 0, 0, Math.PI * 2);
        g.stroke();
        const ring: [number, number][] = [];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.5;
          ring.push([s * (0.5 + Math.cos(a) * 0.4), s * (0.58 + Math.sin(a) * 0.2)]);
        }
        ring.sort((a, b) => a[1] - b[1]);
        const tints = [S.red, S.gold, S.green, S.blue, S.red, S.gold];
        ring.forEach(([x, y], i) => beam(g, x, y - s * 0.04, s * 0.5, s * 0.52, s * 0.035, tints[i]));
        for (const [x, y] of ring) shard(g, x, y - s * 0.06, s * 0.11, s * 0.045, 0, S.body);
        glint(g, s * 0.5, s * 0.52, s * 0.14);
      },
    },
  ],
};
