import type { HeroKit } from '../heroes';

/**
 * Bard kit data: Cantor, the Last Verse. Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * plum-black ground, parchment foil, rose magenta glow, dark ink notes with a rose rim, one golden lyre accent.
 * Signature shape: flowing five-line staves with notes riding them and thin sound rings.
 */
const S = { core: '#ffffff', hot: '#ffb8e6', body: '#e04aa8', accent: '#ffd24a', dark: '#1e0a1a', foil: '#f2e6d0', plum: '#4a1a40' };

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#3e1236');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A quarter note: dark ink head and stem with a rose rim. `a` tilts the whole glyph. */
function note(g: CanvasRenderingContext2D, x: number, y: number, size: number, a = 0, flag = false) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const pass of [0, 1]) {
    const k = pass === 0 ? size * 0.07 : 0;
    g.fillStyle = g.strokeStyle = pass === 0 ? S.body : S.dark;
    g.beginPath();
    g.ellipse(-size * 0.14, size * 0.28, size * 0.26 + k, size * 0.18 + k, -0.45, 0, Math.PI * 2);
  g.fill();
    g.lineWidth = size * 0.1 + k * 2;
    g.beginPath();
    g.moveTo(size * 0.08, size * 0.22);
    g.lineTo(size * 0.08, -size * 0.5);
    if (flag) g.bezierCurveTo(size * 0.3, -size * 0.34, size * 0.5, -size * 0.2, size * 0.4, size * 0.04);
    g.stroke();
  }
  g.restore();
}

/** A beamed pair of notes. */
function pair(g: CanvasRenderingContext2D, x: number, y: number, size: number, a = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const pass of [0, 1]) {
    const k = pass === 0 ? size * 0.07 : 0;
    g.fillStyle = g.strokeStyle = pass === 0 ? S.body : S.dark;
    for (const [hx, hy] of [[-0.3, 0.3], [0.26, 0.22]]) {
      g.beginPath();
      g.ellipse(size * hx, size * hy, size * 0.22 + k, size * 0.15 + k, -0.45, 0, Math.PI * 2);
      g.fill();
    }
    g.lineWidth = size * 0.09 + k * 2;
    g.beginPath();
    g.moveTo(-size * 0.1, size * 0.26);
    g.lineTo(-size * 0.1, -size * 0.4);
    g.moveTo(size * 0.46, size * 0.18);
    g.lineTo(size * 0.46, -size * 0.48);
    g.stroke();
    g.lineWidth = size * 0.2 + k * 2;
    g.beginPath();
    g.moveTo(-size * 0.1, -size * 0.38);
    g.lineTo(size * 0.46, -size * 0.46);
    g.stroke();
  }
  g.restore();
}

/** A five-line stave along a curve `fn(u) -> [x, y]` (u 0..1): parchment lines with a rose edge. */
function stave(g: CanvasRenderingContext2D, fn: (u: number) => [number, number], w: number, until = 1) {
  const N = 30;
  for (const pass of [0, 1]) {
    for (let l = -2; l <= 2; l++) {
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * until, [x, y] = fn(u), [x2, y2] = fn(Math.min(1, u + 0.01)), [x1, y1] = fn(Math.max(0, u - 0.01));
        let dx = x2 - x1, dy = y2 - y1;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;
        const px = x - dy * l * w * 1.9, py = y + dx * l * w * 1.9;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.lineCap = 'round';
      g.strokeStyle = pass === 0 ? S.body : S.foil;
      g.lineWidth = pass === 0 ? w * 1.5 : w * 0.75;
      g.stroke();
    }
  }
}

/** A sound ring seen on the floor (a flat ellipse): white leading edge over rose. */
function ring(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, w: number) {
  g.strokeStyle = S.body;
  g.lineWidth = w;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = S.core;
  g.lineWidth = w * 0.4;
  g.beginPath();
  g.ellipse(cx, cy, rx * 1.02, ry * 1.02, 0, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
}

/** A golden lyre with its base at (cx, by) and height h. */
function lyre(g: CanvasRenderingContext2D, cx: number, by: number, h: number) {
  const w = h * 0.5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const pass of [0, 1]) {
    g.strokeStyle = pass === 0 ? '#8a5a14' : S.accent;
    g.lineWidth = h * (pass === 0 ? 0.14 : 0.085);
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + sx * w * 0.2, by - h * 0.1);
      g.bezierCurveTo(cx + sx * w * 0.8, by - h * 0.25, cx + sx * w * 0.95, by - h * 0.7, cx + sx * w * 0.5, by - h * 0.98);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(cx - w * 0.5, by - h * 0.98);
    g.lineTo(cx + w * 0.5, by - h * 0.98);
    g.stroke();
  }
  g.fillStyle = S.accent;
  g.strokeStyle = '#8a5a14';
  g.lineWidth = h * 0.03;
  g.beginPath();
  g.ellipse(cx, by - h * 0.06, w * 0.5, h * 0.1, 0, 0, Math.PI);
  g.fill();
  g.stroke();
  g.strokeStyle = '#fff0c8';
  g.lineWidth = Math.max(1, h * 0.022);
  for (let i = 0; i < 6; i++) {
    const x = cx + (i - 2.5) * w * 0.17;
    g.beginPath();
    g.moveTo(x, by - h * 0.95);
    g.lineTo(x, by - h * 0.1);
    g.stroke();
  }
}

export const bardKit: HeroKit = {
  name: 'Cantor',
  title: 'the Last Verse',
  accent: S.body,
  foil: S.foil,
  maxHp: 640,
  portrait(g, s) {
    iconGround(g, s);
    // Staves drift behind him with a few notes riding them.
    stave(g, (u) => [s * (0.02 + u * 0.96), s * (0.2 - Math.sin(u * 5) * 0.04 + u * 0.06)], s * 0.008);
    note(g, s * 0.16, s * 0.22, s * 0.16, 0.1);
    pair(g, s * 0.86, s * 0.3, s * 0.14, -0.1);
    // Shoulders in a rose and plum coat with a lyre strap.
    g.fillStyle = S.plum;
    g.beginPath();
    g.moveTo(s * 0.12, s);
    g.quadraticCurveTo(s * 0.16, s * 0.7, s * 0.34, s * 0.6);
    g.quadraticCurveTo(s * 0.5, s * 0.52, s * 0.66, s * 0.6);
    g.quadraticCurveTo(s * 0.84, s * 0.7, s * 0.88, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.body;
    g.lineWidth = s * 0.026;
    g.stroke();
    // The parchment scarf printed with notes.
    g.fillStyle = S.foil;
    g.beginPath();
    g.moveTo(s * 0.32, s * 0.6);
    g.quadraticCurveTo(s * 0.5, s * 0.7, s * 0.68, s * 0.6);
    g.lineTo(s * 0.7, s * 0.7);
    g.quadraticCurveTo(s * 0.5, s * 0.8, s * 0.3, s * 0.7);
    g.closePath();
    g.fill();
    g.fillStyle = S.dark;
    for (const x of [0.4, 0.5, 0.6]) {
      g.beginPath();
      g.arc(s * x, s * 0.7, s * 0.013, 0, Math.PI * 2);
      g.fill();
    }
    // Head: a long lean face, dark hair, under a wide hat with a rose feather.
    g.fillStyle = '#ecd2bc';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.46, s * 0.11, s * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a1426';
    g.beginPath();
    g.moveTo(s * 0.38, s * 0.42);
    g.quadraticCurveTo(s * 0.34, s * 0.56, s * 0.4, s * 0.6);
    g.quadraticCurveTo(s * 0.42, s * 0.5, s * 0.44, s * 0.4);
    g.moveTo(s * 0.62, s * 0.42);
    g.quadraticCurveTo(s * 0.66, s * 0.56, s * 0.6, s * 0.6);
    g.quadraticCurveTo(s * 0.58, s * 0.5, s * 0.56, s * 0.4);
    g.fill();
    g.fillStyle = S.plum;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.34, s * 0.3, s * 0.05, -0.08, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.body;
    g.lineWidth = s * 0.015;
    g.stroke();
    g.fillStyle = S.plum;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.28, s * 0.14, s * 0.1, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.36, s * 0.3);
    g.lineTo(s * 0.64, s * 0.3);
    g.lineTo(s * 0.62, s * 0.33);
    g.lineTo(s * 0.38, s * 0.33);
    g.closePath();
    g.fillStyle = S.body;
    g.fill();
    // The feather curls over the brim.
    g.strokeStyle = S.hot;
    g.lineWidth = s * 0.03;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 0.62, s * 0.3);
    g.bezierCurveTo(s * 0.86, s * 0.2, s * 0.9, s * 0.04, s * 0.74, s * 0.06);
    g.stroke();
    g.strokeStyle = S.body;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(s * 0.62, s * 0.3);
    g.bezierCurveTo(s * 0.84, s * 0.2, s * 0.88, s * 0.06, s * 0.76, s * 0.07);
    g.stroke();
    // Eyes and a small smile.
    g.fillStyle = S.dark;
    g.fillRect(s * 0.44, s * 0.45, s * 0.035, s * 0.012);
    g.fillRect(s * 0.525, s * 0.45, s * 0.035, s * 0.012);
    g.fillStyle = '#b86a78';
    g.fillRect(s * 0.47, s * 0.53, s * 0.06, s * 0.01);
    // The golden lyre at the shoulder.
    lyre(g, s * 0.2, s * 0.98, s * 0.46);
  },
  spells: [
    {
      key: 'Q', label: 'discordant note', name: 'Discordant Note', range: 12, cooldown: 3, aim: 'line',
      blurb: 'Hurls a big dark note that bursts into music on its target, then bounces to the nearest other enemy.',
      icon(g, s) {
        iconGround(g, s);
        // A stave streaming from the lower left, a big note flying up and right, two sound rings and a gold spark.
        stave(g, (u) => [s * (0.04 + u * 0.5), s * (0.92 - u * 0.5 + Math.sin(u * 7) * 0.025)], s * 0.018, 1);
        ring(g, s * 0.72, s * 0.36, s * 0.2, s * 0.24, s * 0.03);
        ring(g, s * 0.72, s * 0.36, s * 0.3, s * 0.34, s * 0.02);
        note(g, s * 0.64, s * 0.46, s * 0.48, 0.3, true);
        g.fillStyle = S.accent;
        for (const [x, y, r] of [[0.88, 0.14, 0.035], [0.52, 0.12, 0.022], [0.92, 0.6, 0.025]]) {
          g.beginPath();
          g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          g.fill();
        }
      },
    },
    {
      key: 'W', label: 'silencing refrain', name: 'Silencing Refrain', range: 10, cooldown: 7,
      blurb: 'A stave coils round the ground and the music stops dead: enemies inside take damage and are silenced.',
      icon(g, s) {
        iconGround(g, s);
        // A stave coiling round a ring on the floor, a huge rest in the middle and frozen notes.
        stave(g, (u) => {
          const a = u * Math.PI * 3.2 + 0.6, r = 0.4 - u * 0.12;
          return [s * (0.5 + Math.cos(a) * r), s * (0.62 + Math.sin(a) * r * 0.5)];
        }, s * 0.016);
        g.strokeStyle = S.body;
        g.lineWidth = s * 0.02;
        g.beginPath();
        g.moveTo(s * 0.42, s * 0.14);
        g.lineTo(s * 0.6, s * 0.3);
        g.lineTo(s * 0.42, s * 0.46);
        g.lineTo(s * 0.6, s * 0.6);
        g.bezierCurveTo(s * 0.34, s * 0.56, s * 0.34, s * 0.8, s * 0.56, s * 0.78);
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.lineWidth = s * 0.15;
        g.stroke();
        g.strokeStyle = S.dark;
        g.lineWidth = s * 0.1;
        g.stroke();
        note(g, s * 0.16, s * 0.34, s * 0.2, -0.2);
        pair(g, s * 0.84, s * 0.4, s * 0.18, 0.15);
      },
    },
    {
      key: 'E', label: 'ballad of valor', name: 'Ballad of Valor', range: 0, cooldown: 9,
      blurb: 'Two staves circle him: a shield, then two sound rings that shove enemies away and a heal at the second.',
      icon(g, s) {
        iconGround(g, s);
        // Two staves circling a small figure, gold notes rising, a ring racing out on the floor.
        ring(g, s * 0.5, s * 0.8, s * 0.42, s * 0.12, s * 0.025);
        g.fillStyle = S.foil;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.56, s * 0.06, s * 0.16, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.body;
        g.beginPath();
        g.arc(s * 0.5, s * 0.36, s * 0.06, 0, Math.PI * 2);
        g.fill();
        stave(g, (u) => [s * (0.5 + Math.cos(u * Math.PI * 2) * 0.3), s * (0.62 + Math.sin(u * Math.PI * 2) * 0.1)], s * 0.014);
        stave(g, (u) => [s * (0.5 + Math.cos(-u * Math.PI * 2 + 1) * 0.3), s * (0.46 + Math.sin(-u * Math.PI * 2 + 1) * 0.09)], s * 0.014);
        for (const [x, y, sz] of [[0.18, 0.3, 0.2], [0.84, 0.26, 0.18], [0.5, 0.12, 0.17]]) {
          g.save();
          g.translate(s * x, s * y);
          g.fillStyle = S.accent;
          g.strokeStyle = S.accent;
          g.lineWidth = s * sz * 0.1;
          g.lineCap = 'round';
          g.beginPath();
          g.ellipse(-s * sz * 0.14, s * sz * 0.28, s * sz * 0.26, s * sz * 0.18, -0.45, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          g.moveTo(s * sz * 0.08, s * sz * 0.22);
          g.lineTo(s * sz * 0.08, -s * sz * 0.5);
          g.stroke();
          g.restore();
        }
      },
    },
    {
      key: 'R', label: 'crescendo', name: 'Crescendo', range: 0, cooldown: 20, cc: true,
      blurb: 'Ultimate. A giant golden lyre rises over him, the notes freeze, then one deafening chord stuns everything within 5 m.',
      icon(g, s) {
        iconGround(g, s);
        // A giant golden lyre, staves spiralling up into it and sound rings on the floor.
        ring(g, s * 0.5, s * 0.86, s * 0.44, s * 0.1, s * 0.022);
        ring(g, s * 0.5, s * 0.86, s * 0.3, s * 0.07, s * 0.016);
        stave(g, (u) => [s * (0.06 + u * 0.3), s * (0.84 - u * 0.52 + Math.sin(u * 6) * 0.03)], s * 0.012);
        stave(g, (u) => [s * (0.94 - u * 0.3), s * (0.84 - u * 0.52 + Math.sin(u * 6 + 1) * 0.03)], s * 0.012);
        lyre(g, s * 0.5, s * 0.86, s * 0.8);
        note(g, s * 0.14, s * 0.4, s * 0.17, -0.2);
        pair(g, s * 0.86, s * 0.42, s * 0.15, 0.2);
        g.fillStyle = S.accent;
        for (const [x, y, r] of [[0.5, 0.06, 0.03], [0.08, 0.1, 0.02], [0.92, 0.12, 0.022]]) {
          g.beginPath();
          g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          g.fill();
        }
      },
    },
  ],
};
