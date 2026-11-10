import type { HeroKit } from '../heroes';

/**
 * Timber kit data: Hank, the Lumberjack (kits v5). Four spells (labels as registered) with canvas-drawn icons in the kit's palette:
 * plaid red, wood brown and pine green on a dark forest ground, with a pale cream (sawdust, birch) for the foil. Signature shape: the
 * chunky pine, and his one-bit axe.
 */
const K = {
  cream: '#f1e2c0', hot: '#e8b868', wood: '#b5763a', bark: '#6a4426', red: '#c8322e', redDark: '#7a1c1a', pine: '#3f6b3a',
  pineDark: '#23421f', pineLit: '#7fbf55', dark: '#1c120b', steel: '#cfd5d8', skin: '#e0a878',
  // the Moss Hewer's tunic, fur, hair and glowing axe edge (the _v3 model)
  moss: '#40583a', fur: '#6e5a44', leather: '#4a3220', beard: '#7a4824', braid: '#a8683a', hairBrown: '#6a3c1c', steelDark: '#59616b', glow: '#3ad868', glowHot: '#8ff0a0', gold: '#d8a838',
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

/** Hank's axe (one bit) at (cx, cy), `len` the haft's length, turned by `rot` (0 = haft up, the blade to the right). */
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
  head(1, K.dark, 1.1);
  head(1, K.steel);
  // the poll: a short block on the other side of the eye
  g.fillStyle = K.dark;
  g.fillRect(-len * 0.12, -len * 0.42, len * 0.12, len * 0.1);
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
  title: 'the Moss Hewer',
  maxHp: 780,
  melee: true,
  accent: K.wood,
  foil: K.pine,
  portrait(g, s) {
    ground(g, s);
    // Pines behind him, his big axe over his shoulder: dark steel with its edge glowing green.
    pine(g, s * 0.14, s * 0.62, s * 0.26, s * 0.5, 4);
    g.save();
    g.translate(s * 0.8, s * 0.54);
    g.rotate(0.3);
    const len = s * 0.52;
    g.fillStyle = K.dark;
    g.fillRect(-len * 0.055, -len * 0.5, len * 0.11, len);
    g.fillStyle = K.bark;
    g.fillRect(-len * 0.035, -len * 0.5, len * 0.07, len);
    // one bit, toward the middle of the picture, and the poll behind the eye
    g.fillStyle = K.dark;
    g.fillRect(0, -len * 0.43, len * 0.11, len * 0.1);
    for (const sx of [-1]) {
      for (const [scale, color] of [[1.1, K.dark], [1, K.steelDark], [1.02, '']] as const) {
        g.beginPath();
        g.moveTo(0, -len * 0.46);
        g.quadraticCurveTo(sx * len * 0.3 * scale, -len * 0.62 * scale, sx * len * 0.34 * scale, -len * 0.28);
        g.quadraticCurveTo(sx * len * 0.3 * scale, -len * 0.38, 0, -len * 0.3);
        g.closePath();
        if (color) {
          g.fillStyle = color;
          g.fill();
        } else {
          // the glowing edge: a bright green line along the blade's outer curve
          g.strokeStyle = K.glowHot;
          g.lineWidth = len * 0.035;
          g.stroke();
        }
      }
    }
    g.restore();
    // Shoulders: a moss-green tunic, a fur mantle heaped round the neck, a brown leather strap.
    g.fillStyle = K.dark;
    g.beginPath();
    g.moveTo(s * 0.04, s);
    g.quadraticCurveTo(s * 0.08, s * 0.68, s * 0.5, s * 0.66);
    g.quadraticCurveTo(s * 0.92, s * 0.68, s * 0.96, s);
    g.closePath();
    g.fill();
    g.fillStyle = K.moss;
    g.beginPath();
    g.moveTo(s * 0.07, s);
    g.quadraticCurveTo(s * 0.11, s * 0.71, s * 0.5, s * 0.69);
    g.quadraticCurveTo(s * 0.89, s * 0.71, s * 0.93, s);
    g.closePath();
    g.fill();
    g.fillStyle = K.fur;
    for (const [x, y, r] of [[0.14, 0.74, 0.085], [0.25, 0.7, 0.085], [0.36, 0.69, 0.08], [0.64, 0.69, 0.08], [0.75, 0.7, 0.085], [0.86, 0.74, 0.085], [0.09, 0.82, 0.07], [0.91, 0.82, 0.07]] as const) {
      g.beginPath(); g.arc(s * x, s * y, s * r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = K.leather;
    g.beginPath();
    g.moveTo(s * 0.2, s * 0.86);
    g.lineTo(s * 0.34, s * 0.78);
    g.lineTo(s * 0.4, s * 0.84);
    g.lineTo(s * 0.26, s * 0.93);
    g.closePath();
    g.fill();
    // The face, brown hair under a leather band, a huge braided beard.
    g.fillStyle = K.dark;
    g.beginPath(); g.ellipse(s * 0.5, s * 0.46, s * 0.25, s * 0.27, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#cf9468';
    g.beginPath(); g.ellipse(s * 0.5, s * 0.44, s * 0.22, s * 0.24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = K.dark;
    g.beginPath();
    g.moveTo(s * 0.27, s * 0.48);
    g.quadraticCurveTo(s * 0.26, s * 0.9, s * 0.5, s * 0.92);
    g.quadraticCurveTo(s * 0.74, s * 0.9, s * 0.73, s * 0.48);
    g.quadraticCurveTo(s * 0.62, s * 0.58, s * 0.5, s * 0.56);
    g.quadraticCurveTo(s * 0.38, s * 0.58, s * 0.27, s * 0.48);
    g.fill();
    g.fillStyle = K.beard;
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.5);
    g.quadraticCurveTo(s * 0.3, s * 0.86, s * 0.5, s * 0.88);
    g.quadraticCurveTo(s * 0.7, s * 0.86, s * 0.7, s * 0.5);
    g.quadraticCurveTo(s * 0.6, s * 0.6, s * 0.5, s * 0.58);
    g.quadraticCurveTo(s * 0.4, s * 0.6, s * 0.3, s * 0.5);
    g.fill();
    // Two braids tied in brass.
    for (const sx of [0.41, 0.59]) {
      g.strokeStyle = K.dark;
      g.lineWidth = s * 0.035;
      g.beginPath(); g.moveTo(s * sx, s * 0.62); g.lineTo(s * (sx + (sx < 0.5 ? 0.02 : -0.02)), s * 0.84); g.stroke();
      g.strokeStyle = K.braid;
      g.lineWidth = s * 0.024;
      g.setLineDash([s * 0.012, s * 0.012]);
      g.beginPath(); g.moveTo(s * sx, s * 0.62); g.lineTo(s * (sx + (sx < 0.5 ? 0.02 : -0.02)), s * 0.84); g.stroke();
      g.setLineDash([]);
      g.fillStyle = K.gold;
      g.fillRect(s * (sx + (sx < 0.5 ? 0.02 : -0.02) - 0.016), s * 0.835, s * 0.032, s * 0.018);
    }
    g.fillStyle = '#ffffff';
    for (const sx of [0.4, 0.6]) {
      g.beginPath(); g.ellipse(s * sx, s * 0.43, s * 0.03, s * 0.032, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#3a2412';
    for (const sx of [0.4, 0.6]) {
      g.beginPath(); g.ellipse(s * sx, s * 0.435, s * 0.018, s * 0.024, 0, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = K.hairBrown;
    g.lineWidth = s * 0.018;
    g.beginPath();
    g.moveTo(s * 0.34, s * 0.385); g.lineTo(s * 0.45, s * 0.395);
    g.moveTo(s * 0.66, s * 0.385); g.lineTo(s * 0.55, s * 0.395);
    g.stroke();
    g.fillStyle = '#bf8458';
    g.beginPath(); g.ellipse(s * 0.5, s * 0.5, s * 0.032, s * 0.038, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = K.hairBrown;
    g.beginPath();
    g.moveTo(s * 0.27, s * 0.38);
    g.quadraticCurveTo(s * 0.26, s * 0.1, s * 0.5, s * 0.1);
    g.quadraticCurveTo(s * 0.74, s * 0.1, s * 0.73, s * 0.38);
    g.quadraticCurveTo(s * 0.7, s * 0.3, s * 0.5, s * 0.29);
    g.quadraticCurveTo(s * 0.3, s * 0.3, s * 0.27, s * 0.38);
    g.fill();
    g.fillStyle = '#2a1a10';
    g.fillRect(s * 0.28, s * 0.3, s * 0.44, s * 0.03);
  },
  spells: [
    {
      key: 'Q', label: 'axe swing', name: 'Axe Swing', range: 3, cooldown: 3,
      blurb: 'A quick 3 m swing in front of him: 60. Any tree of his that the swing touches falls away from him along a strip 8 m long and 1.6 m wide, shown for 0.6 s: 30, 60 or 110 by its size. A stump stays.',
      icon(g, s) {
        ground(g, s);
        // A pale swing fan, a sapling cut at the foot, his big axe sweeping across it, chips flying.
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
      blurb: 'Grows a tree at a spot up to 6 m away. After 0.7 s anything within 1.5 m of it takes 50 and is knocked up 0.5 s. A sapling has 30 HP and blocks nothing; young at 1.2 s (120 HP, real cover); full at 2.5 s. Two charges.',
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
      key: 'R', label: 'timber call', name: 'TIMBER!', range: 10, cooldown: 24, aim: 'line', overCover: true,
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
