import type { HeroKit } from '../heroes';

/**
 * Door kit data: Wick, the Doorman (kits v5, new heroes). Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * a dark wine-brown ground, polished brass, dark wood, the red of his livery and the warm light that spills from a door's crack.
 * Signature shape: an upright door in its frame, ajar, with warm light at the crack and a brass number plate.
 */
const S = {
  core: '#ffffff', hot: '#e6c984', brass: '#b08a4a', shade: '#7a5c2c', glow: '#ffcf7a', wood: '#5a3321', woodLt: '#7a4a2c',
  woodDk: '#2c1a10', ink: '#120a06', red: '#6a2a2a', redLt: '#8c3a38', glove: '#f0ebdd', dark: '#1a0d0a',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#3a2018');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A door in its frame, its base at y = `base`, `h` tall, `w` wide, centred on `cx`, ajar so the light shows at the crack (`num`: a plate). */
function door(g: CanvasRenderingContext2D, cx: number, base: number, h: number, w: number, red = false, num = '') {
  const top = base - h, fw = w * 0.14;
  // The warm room behind, and the dark outline round the whole.
  g.fillStyle = S.ink;
  g.fillRect(cx - w / 2 - fw - 3, top - h * 0.08 - 3, w + fw * 2 + 6, h * 1.08 + 3);
  const gl = g.createLinearGradient(cx, top, cx, base);
  gl.addColorStop(0, '#c98a3a');
  gl.addColorStop(1, S.hot);
  g.fillStyle = gl;
  g.fillRect(cx - w / 2, top, w, h);
  // The frame: two posts, a lintel and a brass cornice.
  g.fillStyle = S.woodDk;
  g.fillRect(cx - w / 2 - fw, top, fw, h);
  g.fillRect(cx + w / 2, top, fw, h);
  g.fillRect(cx - w / 2 - fw, top - h * 0.06, w + fw * 2, h * 0.08);
  g.fillStyle = S.brass;
  g.fillRect(cx - w / 2 - fw * 1.3, top - h * 0.1, w + fw * 2.6, h * 0.045);
  // The leaf, hung ajar: a trapezoid leaving a bright crack on the right.
  g.fillStyle = red ? S.red : S.wood;
  g.beginPath();
  g.moveTo(cx - w / 2, top + h * 0.02);
  g.lineTo(cx + w * 0.34, top + h * 0.06);
  g.lineTo(cx + w * 0.34, base - h * 0.02);
  g.lineTo(cx - w / 2, base);
  g.closePath();
  g.fill();
  // Two panels and a brass knob.
  g.fillStyle = red ? S.redLt : S.woodLt;
  g.fillRect(cx - w * 0.4, top + h * 0.12, w * 0.62, h * 0.3);
  g.fillRect(cx - w * 0.4, top + h * 0.5, w * 0.62, h * 0.34);
  g.fillStyle = S.hot;
  g.beginPath();
  g.arc(cx + w * 0.22, top + h * 0.56, w * 0.045, 0, Math.PI * 2);
  g.fill();
  if (num) {
    g.fillStyle = S.brass;
    g.fillRect(cx - w * 0.28, top + h * 0.18, w * 0.4, h * 0.14);
    g.fillStyle = S.woodDk;
    g.font = `bold ${Math.round(h * 0.13)}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(num, cx - w * 0.08, top + h * 0.25);
  }
}

/** A brass key at (cx,cy), `len` long, turned by `rot` (0: pointing right). */
function key(g: CanvasRenderingContext2D, cx: number, cy: number, len: number, rot = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const r = len * 0.17;
  g.fillStyle = S.ink;
  g.fillRect(-len * 0.3, -len * 0.045, len * 0.82, len * 0.09);
  g.fillRect(len * 0.3, 0, len * 0.08, len * 0.18);
  g.fillRect(len * 0.42, 0, len * 0.08, len * 0.14);
  g.beginPath();
  g.arc(-len * 0.4, 0, r + len * 0.03, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.brass;
  g.fillRect(-len * 0.3, -len * 0.03, len * 0.8, len * 0.06);
  g.fillRect(len * 0.32, 0, len * 0.05, len * 0.15);
  g.fillRect(len * 0.44, 0, len * 0.05, len * 0.11);
  g.beginPath();
  g.arc(-len * 0.4, 0, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.dark;
  g.beginPath();
  g.arc(-len * 0.4, 0, r * 0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.hot;
  g.fillRect(-len * 0.28, -len * 0.025, len * 0.5, len * 0.02);
  g.restore();
}

/** A thin ray from (x1,y1) to (x2,y2): a pale core in a brass band. */
function ray(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, tint = S.brass) {
  g.lineCap = 'round';
  g.strokeStyle = tint;
  g.globalAlpha = 0.8;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  g.globalAlpha = 1;
  g.strokeStyle = S.hot;
  g.lineWidth = w * 0.4;
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

export const doorKit: HeroKit = {
  name: 'Wick',
  maxHp: 620,
  title: 'the Doorman',
  accent: S.brass,
  foil: S.red,
  portrait(g, s) {
    iconGround(g, s);
    // A door behind him, ajar, the warm light at its crack.
    door(g, s * 0.5, s * 0.95, s * 0.82, s * 0.5, false, '7');
    // The long red coat: shoulders, a stiff collar, two rows of brass buttons.
    g.fillStyle = S.red;
    g.beginPath();
    g.moveTo(s * 0.16, s);
    g.quadraticCurveTo(s * 0.2, s * 0.7, s * 0.36, s * 0.62);
    g.quadraticCurveTo(s * 0.5, s * 0.57, s * 0.64, s * 0.62);
    g.quadraticCurveTo(s * 0.8, s * 0.7, s * 0.84, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.ink;
    g.lineWidth = s * 0.012;
    g.stroke();
    g.fillStyle = S.redLt;
    g.fillRect(s * 0.3, s * 0.62, s * 0.1, s * 0.38);
    g.fillRect(s * 0.6, s * 0.62, s * 0.1, s * 0.38);
    g.fillStyle = S.brass;
    for (let i = 0; i < 4; i++) for (const bx of [0.44, 0.56]) {
      g.beginPath();
      g.arc(s * bx, s * (0.72 + i * 0.07), s * 0.016, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = S.hot;
    g.fillRect(s * 0.38, s * 0.6, s * 0.24, s * 0.03);
    // A long thin pale face, a white moustache, kind tired eyes.
    g.fillStyle = '#e8d0b8';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.46, s * 0.085, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.glove;
    g.beginPath();
    g.moveTo(s * 0.4, s * 0.5);
    g.quadraticCurveTo(s * 0.5, s * 0.46, s * 0.6, s * 0.5);
    g.quadraticCurveTo(s * 0.56, s * 0.56, s * 0.5, s * 0.52);
    g.quadraticCurveTo(s * 0.44, s * 0.56, s * 0.4, s * 0.5);
    g.fill();
    g.strokeStyle = S.ink;
    g.lineWidth = s * 0.008;
    for (const ex of [0.465, 0.535]) {
      g.beginPath();
      g.moveTo(s * (ex - 0.016), s * 0.44);
      g.quadraticCurveTo(s * ex, s * 0.45, s * (ex + 0.016), s * 0.44);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.45);
    g.lineTo(s * 0.51, s * 0.49);
    g.stroke();
    // The little round hat with a brass band and a strap.
    g.fillStyle = S.red;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.34, s * 0.105, s * 0.045, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(s * 0.4, s * 0.27, s * 0.2, s * 0.07);
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.27, s * 0.1, s * 0.03, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.brass;
    g.fillRect(s * 0.4, s * 0.32, s * 0.2, s * 0.018);
    g.strokeStyle = S.ink;
    g.lineWidth = s * 0.008;
    g.strokeRect(s * 0.4, s * 0.27, s * 0.2, s * 0.07);
    // A white-gloved hand holding up a ring of keys.
    g.fillStyle = S.glove;
    g.beginPath();
    g.arc(s * 0.8, s * 0.64, s * 0.05, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.ink;
    g.stroke();
    g.strokeStyle = S.brass;
    g.lineWidth = s * 0.014;
    g.beginPath();
    g.arc(s * 0.8, s * 0.54, s * 0.05, 0, Math.PI * 2);
    g.stroke();
    key(g, s * 0.84, s * 0.48, s * 0.2, -0.9);
    key(g, s * 0.76, s * 0.5, s * 0.17, -2.4);
    glint(g, s * 0.9, s * 0.36, s * 0.04);
    glint(g, s * 0.14, s * 0.3, s * 0.03, S.glow);
  },
  spells: [
    {
      key: 'Q', label: 'key toss', name: 'Key Toss', range: 9, cooldown: 3.5, aim: 'line',
      blurb: 'A brass key (9 m): 50 damage. It flies into a door and out of its pair, going the same way, and through all four doors of the Grand Lobby.',
      icon(g, s) {
        iconGround(g, s);
        // A door on the right, a ray in from the lower left, out again toward the upper left.
        door(g, s * 0.78, s * 0.9, s * 0.62, s * 0.26);
        ray(g, s * 0.04, s * 0.84, s * 0.64, s * 0.62, s * 0.05);
        ray(g, s * 0.9, s * 0.18, s * 0.44, s * 0.1, s * 0.04, S.glow);
        key(g, s * 0.34, s * 0.7, s * 0.36, -0.36);
        glint(g, s * 0.66, s * 0.6, s * 0.1);
        glint(g, s * 0.22, s * 0.3, s * 0.04);
      },
    },
    {
      key: 'W', label: 'wick door', name: 'Door', range: 9, cooldown: 0.6,
      blurb: 'Two charges (4 s each). A door at a spot (9 m) for 10 s, 40 HP, two at a time with the same number. Anyone who walks into one leaves by the other, and so does a bolt, whoever shot it.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = 'rgba(230,201,132,0.45)';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.92, s * 0.34, s * 0.06, 0, 0, Math.PI * 2);
        g.stroke();
        door(g, s * 0.34, s * 0.88, s * 0.62, s * 0.3, false, '7');
        door(g, s * 0.7, s * 0.88, s * 0.62, s * 0.3, false, '7');
        ray(g, s * 0.34, s * 0.94, s * 0.7, s * 0.94, s * 0.025);
        glint(g, s * 0.52, s * 0.24, s * 0.06);
        glint(g, s * 0.92, s * 0.4, s * 0.04, S.glow);
      },
    },
    {
      key: 'E', label: 'door slam', name: 'Slam', range: 0, cooldown: 9, cc: true,
      blurb: 'Both doors slam: 40 damage and a 0.5 s stun on an enemy within 1.5 m of either door, after 0.7 s.',
      icon(g, s) {
        iconGround(g, s);
        // Two doors with a red ring on the floor round each and a burst at the crack.
        for (const cx of [0.28, 0.72]) {
          g.fillStyle = 'rgba(140,58,56,0.55)';
          g.beginPath();
          g.ellipse(s * cx, s * 0.88, s * 0.24, s * 0.07, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = S.brass;
          g.lineWidth = s * 0.016;
          g.stroke();
          door(g, s * cx, s * 0.86, s * 0.56, s * 0.24, true);
        }
        g.fillStyle = S.core;
        g.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, r = i % 2 ? s * 0.07 : s * 0.17;
          g.lineTo(s * 0.5 + Math.cos(a) * r, s * 0.46 + Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
        g.strokeStyle = S.glow;
        g.lineWidth = s * 0.012;
        g.stroke();
      },
    },
    {
      key: 'R', label: 'grand lobby', name: 'Grand Lobby', range: 9, cooldown: 24,
      blurb: 'Four tall doors ring the enemy (3 m, 9 m, in sight) for 4 s. Walking into one sets you down at the far side of the ring, and his Q flies through them all. The gaps are 2 m.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = 'rgba(230,201,132,0.5)';
        g.lineWidth = s * 0.016;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.58, s * 0.4, s * 0.22, 0, 0, Math.PI * 2);
        g.stroke();
        // Four doors on the ring, the far ones first; a small figure in the middle.
        const spots: [number, number, number][] = [[0.5, 0.4, 0.17], [0.16, 0.6, 0.2], [0.84, 0.6, 0.2], [0.5, 0.86, 0.26]];
        for (const [x, y, k] of spots) door(g, s * x, s * (y + 0.12 * k + 0.1), s * (0.34 * k + 0.2), s * (0.14 * k + 0.1), true);
        g.fillStyle = S.glove;
        g.beginPath();
        g.arc(s * 0.5, s * 0.62, s * 0.03, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.red;
        g.fillRect(s * 0.475, s * 0.65, s * 0.05, s * 0.07);
        key(g, s * 0.5, s * 0.12, s * 0.26, 0.3);
        glint(g, s * 0.5, s * 0.58, s * 0.09);
      },
    },
  ],
};
