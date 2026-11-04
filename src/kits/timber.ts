import type { HeroKit } from '../heroes';

/**
 * Timber kit data: Hank, the Lumberjack (kits v5). Four spells (labels as registered) with canvas-drawn icons in the kit's palette:
 * plaid red, wood brown and pine green on a dark forest ground, with a pale cream (sawdust, birch) for the foil. Signature shape: the
 * chunky pine, and the double axe.
 */
const K = {
  cream: '#f1e2c0', hot: '#e8b868', wood: '#b5763a', bark: '#6a4426', red: '#c8322e', redDark: '#7a1c1a', pine: '#3f6b3a',
  pineDark: '#23421f', pineLit: '#7fbf55', dark: '#1c120b', steel: '#cfd5d8', skin: '#e0a878',
};

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#2b3a22');
  r.addColorStop(1, K.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A chunky pine: a trunk and `tiers` stacked cones (`w` the width of the lowest, `h` the whole height), base at (cx, by). */
function pine(g: CanvasRenderingContext2D, cx: number, by: number, w: number, h: number, tiers: number, lit = false) {
  const trunkH = h * 0.22;
  g.fillStyle = K.dark;
  g.fillRect(cx - w * 0.1, by - trunkH, w * 0.2, trunkH);
  g.fillStyle = K.bark;
  g.fillRect(cx - w * 0.07, by - trunkH, w * 0.14, trunkH);
  for (let i = 0; i < tiers; i++) {
    const k = i / Math.max(1, tiers - 1);
    const tw = w * (1 - k * 0.55), th = (h - trunkH) / (tiers * 0.72 + 0.28);
    const y1 = by - trunkH - i * th * 0.72;
    g.fillStyle = K.dark;
    g.beginPath();
    g.moveTo(cx - tw * 0.58, y1 + th * 0.06);
    g.lineTo(cx, y1 - th * 1.04);
    g.lineTo(cx + tw * 0.58, y1 + th * 0.06);
    g.closePath();
    g.fill();
    g.fillStyle = lit ? (i % 2 ? K.pineLit : '#97d26a') : i < tiers / 2 ? K.pineDark : K.pine;
    if (!lit && i === tiers - 1) g.fillStyle = K.pineLit;
    g.beginPath();
    g.moveTo(cx - tw * 0.5, y1);
    g.lineTo(cx, y1 - th);
    g.lineTo(cx + tw * 0.5, y1);
    g.closePath();
    g.fill();
  }
}

/** Plaid red: a red block with dark and cream stripes both ways. */
function plaid(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.fillStyle = K.red;
  g.fillRect(x, y, w, h);
  const n = 5;
  g.fillStyle = K.redDark;
  for (let i = 0; i < n; i++) {
    g.fillRect(x + (w * (i + 0.2)) / n, y, w * 0.12, h);
    g.fillRect(x, y + (h * (i + 0.2)) / n, w, h * 0.12);
  }
  g.fillStyle = K.cream;
  g.globalAlpha = 0.55;
  for (let i = 0; i < n; i++) {
    g.fillRect(x + (w * (i + 0.6)) / n, y, w * 0.035, h);
    g.fillRect(x, y + (h * (i + 0.6)) / n, w, h * 0.035);
  }
  g.globalAlpha = 1;
}

/** A double axe at (cx, cy), `len` the haft's length, turned by `rot` (0 = haft up). */
function axe(g: CanvasRenderingContext2D, cx: number, cy: number, len: number, rot: number) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.fillStyle = K.dark;
  g.fillRect(-len * 0.055, -len * 0.5, len * 0.11, len);
  g.fillStyle = K.bark;
  g.fillRect(-len * 0.035, -len * 0.5, len * 0.07, len);
  g.fillStyle = K.red;
  g.fillRect(-len * 0.045, len * 0.18, len * 0.09, len * 0.28);
  const head = (sx: number, color: string, scale = 1) => {
    g.beginPath();
    g.moveTo(0, -len * 0.38 - len * 0.08);
    g.quadraticCurveTo(sx * len * 0.3 * scale, -len * 0.62 * scale, sx * len * 0.34 * scale, -len * 0.28);
    g.quadraticCurveTo(sx * len * 0.3 * scale, -len * 0.38, 0, -len * 0.3);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  };
  for (const sx of [-1, 1]) {
    head(sx, K.dark, 1.1);
    head(sx, K.steel);
  }
  g.restore();
}

/** Flying specks of sawdust and chips. */
function chips(g: CanvasRenderingContext2D, s: number, pts: [number, number, number][]) {
  for (const [x, y, r] of pts) {
    g.fillStyle = K.dark;
    g.fillRect(s * (x - r * 0.7), s * (y - r * 0.4), s * r * 1.4, s * r * 0.8);
    g.fillStyle = K.cream;
    g.fillRect(s * (x - r * 0.5), s * (y - r * 0.25), s * r, s * r * 0.5);
  }
}

export const timberKit: HeroKit = {
  name: 'Hank',
  title: 'the Lumberjack',
  maxHp: 740,
  melee: true,
  accent: K.wood,
  foil: K.pine,
  portrait(g, s) {
    ground(g, s);
    // Pines behind him, a double axe over his shoulder.
    pine(g, s * 0.14, s * 0.62, s * 0.26, s * 0.5, 4);
    pine(g, s * 0.88, s * 0.58, s * 0.22, s * 0.42, 4);
    axe(g, s * 0.84, s * 0.4, s * 0.8, 0.5);
    // Shoulders in plaid, with suspenders.
    g.fillStyle = K.dark;
    g.beginPath();
    g.moveTo(s * 0.06, s);
    g.quadraticCurveTo(s * 0.1, s * 0.7, s * 0.5, s * 0.68);
    g.quadraticCurveTo(s * 0.9, s * 0.7, s * 0.94, s);
    g.closePath();
    g.fill();
    g.save();
    g.beginPath();
    g.moveTo(s * 0.09, s);
    g.quadraticCurveTo(s * 0.13, s * 0.73, s * 0.5, s * 0.71);
    g.quadraticCurveTo(s * 0.87, s * 0.73, s * 0.91, s);
    g.closePath();
    g.clip();
    plaid(g, 0, s * 0.68, s, s * 0.34);
    g.restore();
    g.fillStyle = K.dark;
    g.fillRect(s * 0.3, s * 0.72, s * 0.07, s * 0.28);
    g.fillRect(s * 0.63, s * 0.72, s * 0.07, s * 0.28);
    g.fillStyle = K.hot;
    g.fillRect(s * 0.315, s * 0.88, s * 0.04, s * 0.04);
    g.fillRect(s * 0.645, s * 0.88, s * 0.04, s * 0.04);
    // The face, a huge beard, a woolly hat.
    g.fillStyle = K.dark;
    g.beginPath(); g.ellipse(s * 0.5, s * 0.46, s * 0.25, s * 0.27, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = K.skin;
    g.beginPath(); g.ellipse(s * 0.5, s * 0.44, s * 0.22, s * 0.24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = K.dark;
    g.beginPath();
    g.moveTo(s * 0.27, s * 0.48);
    g.quadraticCurveTo(s * 0.26, s * 0.88, s * 0.5, s * 0.9);
    g.quadraticCurveTo(s * 0.74, s * 0.88, s * 0.73, s * 0.48);
    g.quadraticCurveTo(s * 0.62, s * 0.58, s * 0.5, s * 0.56);
    g.quadraticCurveTo(s * 0.38, s * 0.58, s * 0.27, s * 0.48);
    g.fill();
    g.fillStyle = K.wood;
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.5);
    g.quadraticCurveTo(s * 0.3, s * 0.84, s * 0.5, s * 0.86);
    g.quadraticCurveTo(s * 0.7, s * 0.84, s * 0.7, s * 0.5);
    g.quadraticCurveTo(s * 0.6, s * 0.6, s * 0.5, s * 0.58);
    g.quadraticCurveTo(s * 0.4, s * 0.6, s * 0.3, s * 0.5);
    g.fill();
    g.fillStyle = K.hot;
    g.beginPath(); g.ellipse(s * 0.5, s * 0.74, s * 0.1, s * 0.07, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = K.dark;
    g.fillRect(s * 0.37, s * 0.42, s * 0.08, s * 0.035);
    g.fillRect(s * 0.55, s * 0.42, s * 0.08, s * 0.035);
    g.fillStyle = '#c98a5a';
    g.beginPath(); g.ellipse(s * 0.5, s * 0.5, s * 0.045, s * 0.05, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = K.dark;
    g.beginPath();
    g.moveTo(s * 0.26, s * 0.36);
    g.quadraticCurveTo(s * 0.26, s * 0.08, s * 0.5, s * 0.08);
    g.quadraticCurveTo(s * 0.74, s * 0.08, s * 0.74, s * 0.36);
    g.closePath();
    g.fill();
    g.save();
    g.beginPath();
    g.moveTo(s * 0.285, s * 0.35);
    g.quadraticCurveTo(s * 0.285, s * 0.11, s * 0.5, s * 0.11);
    g.quadraticCurveTo(s * 0.715, s * 0.11, s * 0.715, s * 0.35);
    g.closePath();
    g.clip();
    plaid(g, s * 0.25, s * 0.08, s * 0.5, s * 0.3);
    g.restore();
    g.fillStyle = K.cream;
    g.fillRect(s * 0.27, s * 0.31, s * 0.46, s * 0.07);
    g.fillStyle = K.cream;
    g.beginPath(); g.arc(s * 0.5, s * 0.07, s * 0.05, 0, Math.PI * 2); g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'axe swing', name: 'Axe Swing', range: 3, cooldown: 3,
      blurb: 'A quick 3 m swing in front of him: 40. Any tree of his that the swing touches falls away from him along a strip 8 m long and 1.6 m wide, shown for 0.6 s: 30, 60 or 110 by its size. A stump stays.',
      icon(g, s) {
        ground(g, s);
        // A pale swing fan, a sapling cut at the foot, a big double axe sweeping across it, chips flying.
        g.fillStyle = K.dark;
        g.beginPath(); g.moveTo(s * 0.5, s * 0.9); g.arc(s * 0.5, s * 0.9, s * 0.62, -Math.PI * 0.86, -Math.PI * 0.14); g.closePath(); g.fill();
        g.fillStyle = K.cream;
        g.globalAlpha = 0.85;
        g.beginPath(); g.arc(s * 0.5, s * 0.9, s * 0.62, -Math.PI * 0.86, -Math.PI * 0.14); g.arc(s * 0.5, s * 0.9, s * 0.52, -Math.PI * 0.14, -Math.PI * 0.86, true); g.closePath(); g.fill();
        g.globalAlpha = 1;
        pine(g, s * 0.2, s * 0.9, s * 0.22, s * 0.36, 3);
        axe(g, s * 0.55, s * 0.5, s * 0.78, 0.7);
        chips(g, s, [[0.3, 0.3, 0.035], [0.4, 0.22, 0.03], [0.22, 0.46, 0.028], [0.74, 0.74, 0.03], [0.82, 0.62, 0.025]]);
      },
    },
    {
      key: 'W', label: 'fast growth', name: 'Fast Growth', range: 6, cooldown: 7, cc: true,
      blurb: 'Grows a tree at a spot up to 6 m away. After 0.7 s anything within 1.5 m of it takes 40 and is knocked up 0.5 s. A sapling has 30 HP and blocks nothing; young at 1.2 s (120 HP, real cover); full at 2.5 s. Two charges.',
      icon(g, s) {
        ground(g, s);
        // The ring on the ground, three stages of one tree growing left to right, roots bursting at the foot.
        g.strokeStyle = K.cream;
        g.lineWidth = s * 0.03;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.84, s * 0.44, s * 0.12, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = K.dark;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.84, s * 0.4, s * 0.09, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = K.bark;
        g.lineWidth = s * 0.04;
        g.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const x = s * (0.18 + i * 0.13);
          g.beginPath(); g.moveTo(x, s * 0.86); g.lineTo(x + (i % 2 ? 1 : -1) * s * 0.03, s * (0.77 - (i % 3) * 0.02)); g.stroke();
        }
        pine(g, s * 0.2, s * 0.84, s * 0.2, s * 0.26, 2, true);
        pine(g, s * 0.45, s * 0.84, s * 0.3, s * 0.52, 3);
        pine(g, s * 0.76, s * 0.84, s * 0.4, s * 0.78, 5);
        chips(g, s, [[0.12, 0.7, 0.03], [0.62, 0.78, 0.03], [0.9, 0.9, 0.028]]);
      },
    },
    {
      key: 'E', label: 'caber toss', name: 'Caber Toss', range: 9, cooldown: 9, aim: 'line',
      blurb: 'Rips up the nearest tree within 3 m and hurls it 9 m end over end: 30, 60 or 90 by its size, and a knock-back. With no tree he throws his axe for 30, and Q is gone until he walks to where it landed.',
      icon(g, s) {
        ground(g, s);
        // A tree tumbling across the icon, root ball first, with its arc of motion behind it.
        g.strokeStyle = K.cream;
        g.lineWidth = s * 0.035;
        g.lineCap = 'round';
        g.globalAlpha = 0.8;
        for (let i = 0; i < 3; i++) {
          g.beginPath(); g.arc(s * 0.38, s * 0.62, s * (0.34 + i * 0.07), Math.PI * 0.95, Math.PI * 1.45); g.stroke();
        }
        g.globalAlpha = 1;
        g.save();
        g.translate(s * 0.56, s * 0.46);
        g.rotate(0.9);
        g.fillStyle = K.dark;
        g.fillRect(-s * 0.4, -s * 0.07, s * 0.62, s * 0.14);
        g.fillStyle = K.wood;
        g.fillRect(-s * 0.4, -s * 0.045, s * 0.62, s * 0.09);
        g.fillStyle = K.dark;
        g.beginPath(); g.arc(-s * 0.4, 0, s * 0.13, 0, Math.PI * 2); g.fill();
        g.fillStyle = K.bark;
        g.beginPath(); g.arc(-s * 0.4, 0, s * 0.1, 0, Math.PI * 2); g.fill();
        g.rotate(Math.PI / 2);
        pine(g, s * 0.0, -s * 0.1, s * 0.5, s * 0.5, 3);
        g.restore();
        chips(g, s, [[0.8, 0.8, 0.032], [0.7, 0.9, 0.026], [0.9, 0.7, 0.026], [0.2, 0.2, 0.03]]);
      },
    },
    {
      key: 'R', label: 'timber call', name: 'TIMBER!', range: 10, cooldown: 24, aim: 'line',
      blurb: 'Five trees grow in a row along the aim, 2 m apart: real cover. Recast within 4 s: he swings and they fall like dominoes along the row, 90 on whoever lies in the way (3 hits at most). Without it they fall harmlessly after 8 s.',
      icon(g, s) {
        ground(g, s);
        // Five pines in a row falling like dominoes (each turned further than the last), birds scattering above.
        for (let i = 0; i < 5; i++) {
          g.save();
          g.translate(s * (0.1 + i * 0.16), s * 0.8);
          g.rotate(i * 0.3 - 0.1);
          pine(g, 0, 0, s * 0.2, s * 0.62, 3, i % 2 === 1);
          g.restore();
        }
        g.fillStyle = K.dark;
        for (const [x, y] of [[0.2, 0.14], [0.5, 0.1], [0.8, 0.2], [0.65, 0.3], [0.35, 0.28]]) {
          g.beginPath();
          g.moveTo(s * (x - 0.06), s * (y + 0.01));
          g.quadraticCurveTo(s * (x - 0.02), s * (y - 0.05), s * x, s * y);
          g.quadraticCurveTo(s * (x + 0.02), s * (y - 0.05), s * (x + 0.06), s * (y + 0.01));
          g.quadraticCurveTo(s * (x + 0.02), s * (y - 0.01), s * x, s * (y + 0.03));
          g.quadraticCurveTo(s * (x - 0.02), s * (y - 0.01), s * (x - 0.06), s * (y + 0.01));
          g.fill();
        }
        g.strokeStyle = K.cream;
        g.lineWidth = s * 0.03;
        g.beginPath(); g.moveTo(s * 0.06, s * 0.9); g.lineTo(s * 0.94, s * 0.9); g.stroke();
        chips(g, s, [[0.9, 0.78, 0.03], [0.1, 0.45, 0.026]]);
      },
    },
  ],
};
