import type { HeroKit } from '../heroes';

/**
 * Phoenix kit data: Anka, the Firebird (hero 40; pipeline/designs/kit-phoenix.md). Four spells (labels as registered),
 * canvas-drawn icons in the kit's palette: ember red, gold, flame, a pale ash foil and the teal eye of a feather.
 * Signature shape: the long feather with an eye near its tip. The portrait is the agreed model
 * (docs/heroes/anka_model.jpg): the bob under a gold circlet with its crest of three feathers, the gold collar, the
 * sleeveless bodice, the wings swept out and down, and the open fan in her left hand.
 */
const S = {
  core: '#fff6d8', hot: '#ffc24a', body: '#ff7b3a', red: '#c23a22', deep: '#4c1410', gold: '#e0a935', teal: '#2fb8a8', ash: '#eadcc4', dark: '#1a0806',
  // the same family: the flame and amber of her feathers, the lit and shaded sides of red, gold and teal, the ground's glow
  flame: '#ffb54a', amber: '#e0802a', redHi: '#de5536', redLo: '#8f2616', goldHi: '#f6d57a', goldLo: '#a8741f', tealHi: '#9fe9dc', glow: '#5a1c12',
  // her skin, her dark-red hair and her mouth
  skin: '#c98e66', skinHi: '#dca783', skinLo: '#a56b49', hair: '#6e1c12', hairHi: '#96321e', lip: '#a3452f',
};
/** Three of the colours above as `r,g,b`, for lights that fade out. */
const L = { flame: '255,181,74', body: '255,123,58', core: '255,246,216' };

type G = CanvasRenderingContext2D;
const rad = (deg: number) => (deg * Math.PI) / 180;

function ground(g: G, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.45, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, S.glow);
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A soft round light of the colour `rgb` (one of `L`), `a` strong in the middle. */
function light(g: G, x: number, y: number, r: number, rgb: string, a: number) {
  const q = g.createRadialGradient(x, y, 0, x, y, r);
  q.addColorStop(0, `rgba(${rgb},${a})`);
  q.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = q;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function dot(g: G, x: number, y: number, r: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/**
 * The kit's shape: a feather from its quill end (x1, y1) to its point (x2, y2), `w` wide, bent sideways by `bend`
 * (a share of its length): a thin dark outline, a vane with a shaded half, a flame tip, a gold shaft and, with `eye`,
 * the gold-rimmed teal eye below the tip.
 */
function feather(g: G, x1: number, y1: number, x2: number, y2: number, w: number, eye = true, bend = 0, vane = S.red, shade = S.redLo, tip = S.hot) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const half = (t: number) => ((w / 2) * Math.pow(t, 0.9) * Math.pow(1 - t, 0.7)) / 0.334;
  const at = (t: number, k: number): [number, number] => {
    const o = bend * len * t * t + half(t) * k;
    return [x1 + dx * t + nx * o, y1 + dy * t + ny * o];
  };
  const edge = (t0: number, t1: number, k: number, start = false) => {
    for (let i = 0; i <= 16; i++) {
      const [x, y] = at(t0 + ((t1 - t0) * i) / 16, k);
      if (start && i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
  };
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.beginPath();
  edge(0, 1, 1, true);
  edge(1, 0, -1);
  g.closePath();
  g.strokeStyle = S.deep;
  g.lineWidth = Math.max(1, w * 0.14);
  g.stroke();
  g.fillStyle = vane;
  g.fill();
  g.fillStyle = shade;
  g.beginPath();
  edge(0, 1, -1, true);
  edge(1, 0, 0);
  g.closePath();
  g.fill();
  // The flame tip, the vane running into it along the shaft.
  const flameTip = (t0: number, notch: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    edge(t0, 1, 1, true);
    edge(1, t0, -1);
    g.lineTo(...at(t0 + notch, 0));
    g.closePath();
    g.fill();
  };
  flameTip(0.7, 0.09, tip);
  flameTip(0.89, 0.03, S.core);
  g.strokeStyle = S.gold;
  g.lineWidth = Math.max(1, w * 0.1);
  g.beginPath();
  edge(0, 0.9, 0, true);
  g.stroke();
  if (eye) {
    const [ex, ey] = at(0.6, 0);
    dot(g, ex, ey, w * 0.27, S.deep);
    dot(g, ex, ey, w * 0.23, S.gold);
    dot(g, ex, ey, w * 0.14, S.teal);
    dot(g, ex - w * 0.04, ey - w * 0.04, w * 0.045, S.tealHi);
  }
}

/** A lick of flame: a point at (x1, y1) that widens to `w` at (x2, y2) and ends round. */
function lick(g: G, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2 - uy * w * 0.5, y2 + ux * w * 0.5);
  g.quadraticCurveTo(x2 + ux * w * 0.7, y2 + uy * w * 0.7, x2 + uy * w * 0.5, y2 - ux * w * 0.5);
  g.closePath();
  g.fill();
}

/** An ember ring lying on the floor, `rx` wide: a glow, a dark rim, a flame ring and a pale line inside. */
function emberRing(g: G, x: number, y: number, rx: number, s: number) {
  const ry = rx * 0.4;
  light(g, x, y, rx * 1.35, L.body, 0.5);
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = `rgba(${L.body},0.4)`;
  g.fill();
  g.strokeStyle = S.deep;
  g.lineWidth = Math.max(2.4, s * 0.06);
  g.stroke();
  g.strokeStyle = S.hot;
  g.lineWidth = Math.max(1.4, s * 0.034);
  g.stroke();
  g.beginPath();
  g.ellipse(x, y, rx * 0.6, ry * 0.6, 0, 0, Math.PI * 2);
  g.strokeStyle = S.core;
  g.lineWidth = Math.max(1, s * 0.012);
  g.stroke();
}

/**
 * Her open fan, its pivot at (px, py), `r` long, opened from the angle a0 to a1 in `n` pleats: a scalloped flame
 * edge, a red pleated leaf, gold ribs, a teal or a gold stud on each rib.
 */
function fan(g: G, px: number, py: number, r: number, a0: number, a1: number, s: number, n = 8) {
  const da = (a1 - a0) / n;
  const pt = (a: number, k: number): [number, number] => [px + Math.cos(a) * r * k, py + Math.sin(a) * r * k];
  const leaf = (k: number, bulge: number, from = 0, to = n) => {
    g.beginPath();
    g.moveTo(...pt(a0 + da * from, 0.3));
    g.lineTo(...pt(a0 + da * from, k));
    for (let i = from; i < to; i++) g.quadraticCurveTo(...pt(a0 + da * (i + 0.5), k + bulge), ...pt(a0 + da * (i + 1), k));
    g.arc(px, py, r * 0.3, a0 + da * to, a0 + da * from, true);
    g.closePath();
  };
  g.lineJoin = 'round';
  g.lineCap = 'round';
  leaf(0.92, 0.15);
  g.strokeStyle = S.deep;
  g.lineWidth = Math.max(1.6, s * 0.022);
  g.stroke();
  g.fillStyle = S.hot;
  g.fill();
  leaf(0.855, 0.1);
  g.fillStyle = S.amber;
  g.fill();
  leaf(0.8, 0.06);
  g.fillStyle = S.red;
  g.fill();
  g.fillStyle = S.redLo;
  for (let i = 1; i < n; i += 2) {
    leaf(0.8, 0.06, i, i + 1);
    g.fill();
  }
  // The ribs run from the pivot through the leaf; the two guards are thicker and reach the edge.
  for (let i = 0; i <= n; i++) {
    const guard = i === 0 || i === n;
    g.strokeStyle = S.gold;
    g.lineWidth = Math.max(1, s * (guard ? 0.016 : 0.009));
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(...pt(a0 + da * i, guard ? 0.92 : 0.855));
    g.stroke();
  }
  for (let i = 1; i < n; i++) {
    const [x, y] = pt(a0 + da * i, i % 2 ? 0.67 : 0.53);
    dot(g, x, y, r * 0.042, i % 2 ? S.gold : S.goldLo);
    dot(g, x, y, r * 0.028, i % 2 ? S.teal : S.goldHi);
  }
  dot(g, px, py, r * 0.085, S.deep);
  dot(g, px, py, r * 0.065, S.gold);
  dot(g, px, py, r * 0.03, S.goldHi);
}

/** A small four-point glint. */
function glint(g: G, x: number, y: number, r: number, color = S.core) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, k = i % 2 ? r * 0.26 : r;
    g.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  g.closePath();
  g.fill();
}

/** An oval stone in a gold setting. */
function stone(g: G, x: number, y: number, rx: number, ry: number) {
  for (const [k, color] of [[1.25, S.deep], [1, S.gold], [0.62, S.teal]] as const) {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2);
    g.fill();
  }
  dot(g, x - rx * 0.18, y - ry * 0.22, rx * 0.2, S.tealHi);
}

export const phoenixKit: HeroKit = {
  name: 'Anka',
  maxHp: 460,
  title: 'the Firebird',
  accent: S.body,
  foil: S.ash,
  portrait(g, s) {
    ground(g, s);
    const cx = s * 0.46;
    light(g, cx, s * 0.44, s * 0.52, L.flame, 0.36);
    // The two wings behind her, swept out and down like a cloak: long flame feathers, some with eyes, under a row
    // of shorter amber ones.
    for (const d of [-1, 1]) {
      const wx = cx + d * s * 0.12, wy = s * 0.63;
      for (const [deg, len, eye] of [[66, 0.24, false], [51, 0.28, true], [36, 0.31, false], [21, 0.335, true], [6, 0.345, false], [-9, 0.34, true], [-23, 0.31, false]] as const) {
        feather(g, wx, wy, wx + d * Math.cos(rad(deg)) * s * len, wy + Math.sin(rad(deg)) * s * len, s * 0.07, eye, d * 0.1);
      }
      for (const [deg, len] of [[56, 0.12], [38, 0.14], [20, 0.155], [2, 0.16], [-16, 0.15]] as const) {
        feather(g, wx, wy, wx + d * Math.cos(rad(deg)) * s * len, wy + Math.sin(rad(deg)) * s * len, s * 0.056, false, d * 0.08, S.amber, S.red);
      }
    }
    // The bob, behind the neck: dark red, cut level at the shoulders.
    g.lineJoin = 'round';
    g.fillStyle = S.hair;
    g.beginPath();
    g.moveTo(cx, s * 0.28);
    g.bezierCurveTo(cx - s * 0.16, s * 0.28, cx - s * 0.175, s * 0.44, cx - s * 0.16, s * 0.6);
    g.quadraticCurveTo(cx - s * 0.155, s * 0.668, cx - s * 0.09, s * 0.662);
    g.lineTo(cx + s * 0.09, s * 0.662);
    g.quadraticCurveTo(cx + s * 0.155, s * 0.668, cx + s * 0.16, s * 0.6);
    g.bezierCurveTo(cx + s * 0.175, s * 0.44, cx + s * 0.16, s * 0.28, cx, s * 0.28);
    g.closePath();
    g.strokeStyle = S.deep;
    g.lineWidth = s * 0.014;
    g.stroke();
    g.fill();
    // Neck, bare shoulders and arms.
    g.fillStyle = S.skin;
    g.beginPath();
    g.moveTo(cx - s * 0.042, s * 0.55);
    g.lineTo(cx - s * 0.046, s * 0.64);
    g.quadraticCurveTo(cx - s * 0.085, s * 0.69, cx - s * 0.155, s * 0.706);
    g.quadraticCurveTo(cx - s * 0.224, s * 0.722, cx - s * 0.23, s * 0.8);
    g.lineTo(cx - s * 0.218, s);
    g.lineTo(cx + s * 0.218, s);
    g.lineTo(cx + s * 0.23, s * 0.8);
    g.quadraticCurveTo(cx + s * 0.224, s * 0.722, cx + s * 0.155, s * 0.706);
    g.quadraticCurveTo(cx + s * 0.085, s * 0.69, cx + s * 0.046, s * 0.64);
    g.lineTo(cx + s * 0.042, s * 0.55);
    g.closePath();
    g.strokeStyle = S.deep;
    g.lineWidth = s * 0.012;
    g.stroke();
    g.fill();
    g.fillStyle = S.skinLo;
    g.beginPath();
    g.moveTo(cx - s * 0.043, s * 0.56);
    g.lineTo(cx + s * 0.043, s * 0.56);
    g.lineTo(cx + s * 0.045, s * 0.612);
    g.quadraticCurveTo(cx, s * 0.656, cx - s * 0.045, s * 0.612);
    g.closePath();
    g.fill();
    g.fillStyle = S.skinHi;
    g.globalAlpha = 0.6;
    g.beginPath();
    g.ellipse(cx + s * 0.165, s * 0.738, s * 0.03, s * 0.014, 0.3, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    // The ember-red sleeveless bodice: narrow at the collar, gold piping on the armholes, two gold bars on the chest.
    const bodice = () => {
      g.beginPath();
      g.moveTo(cx - s * 0.06, s * 0.66);
      g.quadraticCurveTo(cx - s * 0.074, s * 0.785, cx - s * 0.146, s * 0.868);
      g.lineTo(cx - s * 0.15, s);
      g.lineTo(cx + s * 0.15, s);
      g.lineTo(cx + s * 0.146, s * 0.868);
      g.quadraticCurveTo(cx + s * 0.074, s * 0.785, cx + s * 0.06, s * 0.66);
      g.closePath();
    };
    bodice();
    g.strokeStyle = S.deep;
    g.lineWidth = s * 0.03;
    g.stroke();
    g.fillStyle = S.red;
    g.fill();
    g.fillStyle = S.redLo;
    for (const d of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + d * s * 0.092, s * 0.81);
      g.quadraticCurveTo(cx + d * s * 0.112, s * 0.858, cx + d * s * 0.146, s * 0.868);
      g.lineTo(cx + d * s * 0.15, s);
      g.lineTo(cx + d * s * 0.105, s);
      g.closePath();
      g.fill();
    }
    g.fillStyle = S.redHi;
    g.beginPath();
    g.moveTo(cx - s * 0.03, s * 0.72);
    g.quadraticCurveTo(cx, s * 0.76, cx + s * 0.03, s * 0.72);
    g.lineTo(cx + s * 0.022, s);
    g.lineTo(cx - s * 0.022, s);
    g.closePath();
    g.fill();
    bodice();
    g.strokeStyle = S.gold;
    g.lineWidth = s * 0.013;
    g.stroke();
    g.lineCap = 'round';
    for (const d of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + d * s * 0.046, s * 0.8);
      g.lineTo(cx + d * s * 0.05, s * 0.97);
      g.stroke();
    }
    // A gold band on the upper arm at the viewer's left.
    g.lineCap = 'butt';
    g.strokeStyle = S.deep;
    g.lineWidth = s * 0.034;
    g.beginPath();
    g.moveTo(cx - s * 0.218, s * 0.852);
    g.quadraticCurveTo(cx - s * 0.185, s * 0.866, cx - s * 0.15, s * 0.862);
    g.stroke();
    g.strokeStyle = S.gold;
    g.lineWidth = s * 0.022;
    g.stroke();
    // The gold collar with its teal stone.
    g.beginPath();
    g.moveTo(cx - s * 0.068, s * 0.622);
    g.quadraticCurveTo(cx, s * 0.666, cx + s * 0.068, s * 0.622);
    g.lineTo(cx + s * 0.074, s * 0.666);
    g.quadraticCurveTo(cx, s * 0.718, cx - s * 0.074, s * 0.666);
    g.closePath();
    g.strokeStyle = S.deep;
    g.lineWidth = s * 0.014;
    g.stroke();
    g.fillStyle = S.gold;
    g.fill();
    g.strokeStyle = S.goldHi;
    g.lineWidth = s * 0.009;
    g.beginPath();
    g.moveTo(cx - s * 0.056, s * 0.636);
    g.quadraticCurveTo(cx, s * 0.676, cx + s * 0.056, s * 0.636);
    g.stroke();
    stone(g, cx, s * 0.716, s * 0.018, s * 0.024);
    // Her face: a calm oval with a narrow chin, warm bronze, shaded at the viewer's left.
    const face = () => {
      g.beginPath();
      g.moveTo(cx - s * 0.105, s * 0.43);
      g.bezierCurveTo(cx - s * 0.103, s * 0.525, cx - s * 0.04, s * 0.594, cx, s * 0.594);
      g.bezierCurveTo(cx + s * 0.04, s * 0.594, cx + s * 0.103, s * 0.525, cx + s * 0.105, s * 0.43);
      g.bezierCurveTo(cx + s * 0.105, s * 0.32, cx - s * 0.105, s * 0.32, cx - s * 0.105, s * 0.43);
      g.closePath();
    };
    face();
    g.strokeStyle = S.deep;
    g.lineWidth = s * 0.012;
    g.stroke();
    g.fillStyle = S.skin;
    g.fill();
    g.fillStyle = S.skinLo;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(cx - s * 0.105, s * 0.43);
    g.bezierCurveTo(cx - s * 0.103, s * 0.525, cx - s * 0.04, s * 0.594, cx, s * 0.594);
    g.bezierCurveTo(cx - s * 0.05, s * 0.575, cx - s * 0.082, s * 0.52, cx - s * 0.078, s * 0.43);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = S.skinHi;
    g.globalAlpha = 0.38;
    g.beginPath();
    g.ellipse(cx + s * 0.06, s * 0.5, s * 0.026, s * 0.02, -0.5, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.lineCap = 'round';
    // Eyes under level brows, the lids a little lowered; a fine nose; a closed mouth.
    for (const d of [-1, 1]) {
      const ex = cx + d * s * 0.047, ey = s * 0.464;
      g.fillStyle = S.ash;
      g.beginPath();
      g.moveTo(ex - d * s * 0.028, ey + s * 0.005);
      g.quadraticCurveTo(ex, ey - s * 0.023, ex + d * s * 0.03, ey - s * 0.003);
      g.quadraticCurveTo(ex, ey + s * 0.018, ex - d * s * 0.028, ey + s * 0.005);
      g.fill();
      dot(g, ex, ey - s * 0.001, s * 0.0105, S.hair);
      dot(g, ex, ey - s * 0.001, s * 0.0055, S.dark);
      dot(g, ex + s * 0.004, ey - s * 0.005, s * 0.003, S.core);
      g.strokeStyle = S.deep;
      g.lineWidth = Math.max(1, s * 0.009);
      g.beginPath();
      g.moveTo(ex - d * s * 0.03, ey + s * 0.006);
      g.quadraticCurveTo(ex, ey - s * 0.025, ex + d * s * 0.036, ey - s * 0.009);
      g.stroke();
      g.strokeStyle = S.hair;
      g.lineWidth = Math.max(1, s * 0.008);
      g.beginPath();
      g.moveTo(ex - d * s * 0.03, ey - s * 0.036);
      g.quadraticCurveTo(ex + d * s * 0.008, ey - s * 0.055, ex + d * s * 0.04, ey - s * 0.04);
      g.stroke();
    }
    g.strokeStyle = S.skinLo;
    g.lineWidth = Math.max(1, s * 0.007);
    g.beginPath();
    g.moveTo(cx + s * 0.007, s * 0.474);
    g.quadraticCurveTo(cx + s * 0.017, s * 0.512, cx + s * 0.013, s * 0.523);
    g.quadraticCurveTo(cx, s * 0.533, cx - s * 0.012, s * 0.523);
    g.stroke();
    g.fillStyle = S.lip;
    g.beginPath();
    g.moveTo(cx - s * 0.031, s * 0.554);
    g.quadraticCurveTo(cx - s * 0.012, s * 0.542, cx, s * 0.548);
    g.quadraticCurveTo(cx + s * 0.012, s * 0.542, cx + s * 0.031, s * 0.554);
    g.quadraticCurveTo(cx, s * 0.56, cx - s * 0.031, s * 0.554);
    g.fill();
    g.fillStyle = S.red;
    g.beginPath();
    g.moveTo(cx - s * 0.026, s * 0.557);
    g.quadraticCurveTo(cx, s * 0.58, cx + s * 0.026, s * 0.557);
    g.quadraticCurveTo(cx, s * 0.561, cx - s * 0.026, s * 0.557);
    g.fill();
    // The fringe, parted in the middle and falling down both cheeks into the bob.
    g.fillStyle = S.hair;
    g.beginPath();
    g.moveTo(cx - s * 0.13, s * 0.56);
    g.bezierCurveTo(cx - s * 0.165, s * 0.4, cx - s * 0.125, s * 0.28, cx, s * 0.28);
    g.bezierCurveTo(cx + s * 0.125, s * 0.28, cx + s * 0.165, s * 0.4, cx + s * 0.13, s * 0.56);
    g.lineTo(cx + s * 0.086, s * 0.53);
    g.bezierCurveTo(cx + s * 0.104, s * 0.44, cx + s * 0.062, s * 0.39, cx + s * 0.004, s * 0.346);
    g.bezierCurveTo(cx - s * 0.062, s * 0.39, cx - s * 0.104, s * 0.44, cx - s * 0.086, s * 0.53);
    g.closePath();
    g.fill();
    g.strokeStyle = S.hairHi;
    g.lineWidth = s * 0.012;
    for (const d of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + d * s * 0.03, s * 0.31);
      g.quadraticCurveTo(cx + d * s * 0.105, s * 0.345, cx + d * s * 0.122, s * 0.46);
      g.moveTo(cx + d * s * 0.138, s * 0.5);
      g.quadraticCurveTo(cx + d * s * 0.15, s * 0.58, cx + d * s * 0.128, s * 0.64);
      g.stroke();
    }
    // The crest of three feathers, then the gold circlet and its stone over their quills.
    feather(g, cx - s * 0.02, s * 0.35, cx - s * 0.112, s * 0.12, s * 0.054, false, 0.06);
    feather(g, cx + s * 0.02, s * 0.35, cx + s * 0.112, s * 0.12, s * 0.054, false, -0.06);
    feather(g, cx, s * 0.35, cx, s * 0.058, s * 0.066, false);
    g.beginPath();
    g.moveTo(cx - s * 0.137, s * 0.378);
    g.quadraticCurveTo(cx, s * 0.318, cx + s * 0.137, s * 0.378);
    g.strokeStyle = S.deep;
    g.lineWidth = s * 0.034;
    g.stroke();
    g.strokeStyle = S.gold;
    g.lineWidth = s * 0.022;
    g.stroke();
    g.beginPath();
    g.moveTo(cx - s * 0.125, s * 0.366);
    g.quadraticCurveTo(cx, s * 0.31, cx + s * 0.125, s * 0.366);
    g.strokeStyle = S.goldHi;
    g.lineWidth = s * 0.006;
    g.stroke();
    stone(g, cx, s * 0.348, s * 0.019, s * 0.025);
    // Her open fan, held up beside her face in her left hand: the forearm rises to it from below.
    const hx = s * 0.78, hy = s * 0.705;
    fan(g, hx, hy, s * 0.265, rad(-130), rad(-34), s);
    g.beginPath();
    g.moveTo(hx - s * 0.022, hy + s * 0.03);
    g.lineTo(hx + s * 0.024, hy + s * 0.03);
    g.lineTo(hx + s * 0.07, s);
    g.lineTo(hx - s * 0.02, s);
    g.closePath();
    g.strokeStyle = S.deep;
    g.lineWidth = s * 0.012;
    g.stroke();
    g.fillStyle = S.skin;
    g.fill();
    g.beginPath();
    g.moveTo(hx - s * 0.03, hy + s * 0.085);
    g.lineTo(hx + s * 0.04, hy + s * 0.085);
    g.strokeStyle = S.deep;
    g.lineWidth = s * 0.034;
    g.stroke();
    g.strokeStyle = S.gold;
    g.lineWidth = s * 0.022;
    g.stroke();
    g.beginPath();
    g.ellipse(hx + s * 0.002, hy + s * 0.012, s * 0.034, s * 0.037, 0, 0, Math.PI * 2);
    g.strokeStyle = S.deep;
    g.lineWidth = s * 0.012;
    g.stroke();
    g.fillStyle = S.skin;
    g.fill();
    // The fingers fold round the handle from the right, the thumb lies across from the left.
    g.strokeStyle = S.skinLo;
    g.lineWidth = Math.max(1, s * 0.005);
    for (const k of [-0.003, 0.012, 0.027]) {
      g.beginPath();
      g.moveTo(hx + s * 0.03, hy + s * k);
      g.quadraticCurveTo(hx + s * 0.014, hy + s * (k + 0.004), hx, hy + s * k);
      g.stroke();
    }
    g.beginPath();
    g.ellipse(hx - s * 0.019, hy + s * 0.006, s * 0.012, s * 0.024, 0.3, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = S.skinHi;
    g.fill();
    // Sparks and two glints.
    for (const [x, y, r] of [[0.2, 0.26, 0.009], [0.13, 0.4, 0.007], [0.29, 0.15, 0.006], [0.64, 0.2, 0.008], [0.72, 0.31, 0.006]] as const) dot(g, s * x, s * y, s * r, S.hot);
    glint(g, s * 0.885, s * 0.4, s * 0.03);
    glint(g, cx - s * 0.006, s * 0.338, s * 0.014);
  },
  spells: [
    {
      key: 'Q', label: 'ember quill', name: 'Ember Quill', range: 10, cooldown: 3.5, aim: 'line',
      blurb: 'A feather (10 m): 54 damage. Where it ends, in the enemy or in the floor, it stays as an ember and becomes her nest.',
      icon(g, s) {
        ground(g, s);
        // One long feather flying point first to the ember ring it is headed for, a thin trail of flame behind it.
        emberRing(g, s * 0.72, s * 0.83, s * 0.2, s);
        lick(g, s * 0.01, s * 0.0, s * 0.3, s * 0.25, s * 0.14, S.amber);
        lick(g, s * 0.07, s * 0.05, s * 0.29, s * 0.245, s * 0.065, S.hot);
        lick(g, s * 0.3, s * 0.04, s * 0.5, s * 0.22, s * 0.04, S.flame);
        lick(g, s * 0.03, s * 0.34, s * 0.22, s * 0.5, s * 0.04, S.flame);
        feather(g, s * 0.17, s * 0.13, s * 0.74, s * 0.66, s * 0.27);
        glint(g, s * 0.72, s * 0.83, s * 0.07);
      },
    },
    {
      key: 'W', label: 'fan the flames', name: 'Fan the Flames', range: 0, cooldown: 9,
      blurb: 'Every ember flares after 0.8 s in a ring of 2.2 m: 54 damage, once. The embers burn out.',
      icon(g, s) {
        ground(g, s);
        // The open fan over two embers that flare as rings of flame, a small feather standing in each.
        light(g, s * 0.5, s * 0.4, s * 0.5, L.flame, 0.3);
        for (const x of [0.27, 0.73]) emberRing(g, s * x, s * 0.84, s * 0.2, s);
        fan(g, s * 0.5, s * 0.58, s * 0.47, rad(-177), rad(-17), s, 9);
        for (const x of [0.27, 0.73]) feather(g, s * x, s * 0.87, s * x, s * 0.61, s * 0.13, false);
      },
    },
    {
      key: 'E', label: 'ember flight', name: 'Ember Flight', range: 12, cooldown: 10,
      blurb: 'She flies to her ember nearest the aimed spot (12 m) and lands in a burst of 1.8 m: 40 damage. The ember is spent. Needs an ember.',
      icon(g, s) {
        ground(g, s);
        // A streak of feathers arcing from the lower left into an ember ring, where she arrives in a burst of feathers.
        const ex = s * 0.66, ey = s * 0.47;
        emberRing(g, ex, s * 0.57, s * 0.26, s);
        const p = (t: number): [number, number] => [
          (1 - t) * (1 - t) * s * 0.1 + 2 * (1 - t) * t * s * 0.14 + t * t * s * 0.6,
          (1 - t) * (1 - t) * s * 0.95 + 2 * (1 - t) * t * s * 0.4 + t * t * s * 0.5,
        ];
        const streak = (w: number, color: string) => {
          g.fillStyle = color;
          g.beginPath();
          g.moveTo(...p(0));
          for (const side of [1, -1]) {
            for (let i = 1; i <= 12; i++) {
              const t = side > 0 ? i / 12 : 1 - i / 12, [x, y] = p(t), [x2, y2] = p(t + 0.01), l = Math.hypot(x2 - x, y2 - y) || 1;
              g.lineTo(x - ((y2 - y) / l) * w * t * side, y + ((x2 - x) / l) * w * t * side);
            }
          }
          g.closePath();
          g.fill();
        };
        streak(s * 0.05, S.amber);
        streak(s * 0.022, S.hot);
        for (const [t0, t1, w] of [[0.03, 0.31, 0.09], [0.35, 0.62, 0.1], [0.66, 0.93, 0.11]] as const) {
          const [x, y] = p(t0), [x2, y2] = p(t1);
          feather(g, x, y, x2, y2, s * w, false);
        }
        light(g, ex, ey, s * 0.3, L.core, 0.55);
        for (const [deg, len] of [[-64, 0.3], [64, 0.3], [-32, 0.35], [32, 0.35], [0, 0.37]] as const) {
          feather(g, ex, ey, ex + Math.sin(rad(deg)) * s * len, ey - Math.cos(rad(deg)) * s * len, s * 0.115, false, deg === 0 ? 0 : deg < 0 ? 0.08 : -0.08);
        }
        dot(g, ex, ey, s * 0.06, S.hot);
        dot(g, ex, ey, s * 0.035, S.core);
      },
    },
    {
      key: 'R', label: 'firebird', name: 'Firebird', range: 12, cooldown: 24, aim: 'line', overCover: true,
      blurb: 'She spreads wings of fire for 1 s, then crosses 12 m as a great firebird: 120 damage to everyone in the 3 m lane. An ember is left where she took off.',
      icon(g, s) {
        ground(g, s);
        // A great firebird seen from above, flying up the icon: wings spread across it, a long tail of feathers with eyes.
        const bx = s * 0.5;
        light(g, bx, s * 0.36, s * 0.56, L.flame, 0.42);
        for (const [deg, len] of [[-30, 0.4], [30, 0.4], [-15, 0.47], [15, 0.47], [0, 0.52]] as const) {
          feather(g, bx, s * 0.44, bx + Math.sin(rad(deg)) * s * len, s * 0.44 + Math.cos(rad(deg)) * s * len, s * 0.1, true, deg === 0 ? 0 : deg < 0 ? -0.1 : 0.1);
        }
        for (const d of [-1, 1]) {
          const wx = bx + d * s * 0.04, wy = s * 0.35;
          for (const [deg, len] of [[52, 0.24], [33, 0.31], [15, 0.38], [-3, 0.42], [-20, 0.44], [-36, 0.41]] as const) {
            feather(g, wx, wy, wx + d * Math.cos(rad(deg)) * s * len, wy + Math.sin(rad(deg)) * s * len, s * 0.105, false, d * 0.1);
          }
          for (const [deg, len] of [[40, 0.15], [18, 0.18], [-4, 0.2], [-25, 0.2]] as const) {
            feather(g, wx, wy, wx + d * Math.cos(rad(deg)) * s * len, wy + Math.sin(rad(deg)) * s * len, s * 0.085, false, d * 0.08, S.body, S.amber);
          }
        }
        // Body, head and beak in gold and flame.
        g.lineJoin = 'round';
        g.beginPath();
        g.ellipse(bx, s * 0.38, s * 0.055, s * 0.12, 0, 0, Math.PI * 2);
        g.strokeStyle = S.deep;
        g.lineWidth = Math.max(1.5, s * 0.03);
        g.stroke();
        g.fillStyle = S.hot;
        g.fill();
        g.beginPath();
        g.moveTo(bx, s * 0.105);
        g.quadraticCurveTo(bx + s * 0.012, s * 0.19, bx + s * 0.048, s * 0.235);
        g.quadraticCurveTo(bx + s * 0.05, s * 0.285, bx, s * 0.3);
        g.quadraticCurveTo(bx - s * 0.05, s * 0.285, bx - s * 0.048, s * 0.235);
        g.quadraticCurveTo(bx - s * 0.012, s * 0.19, bx, s * 0.105);
        g.closePath();
        g.stroke();
        g.fillStyle = S.hot;
        g.fill();
        g.fillStyle = S.gold;
        g.beginPath();
        g.moveTo(bx, s * 0.105);
        g.lineTo(bx + s * 0.017, s * 0.185);
        g.lineTo(bx - s * 0.017, s * 0.185);
        g.closePath();
        g.fill();
        g.fillStyle = S.core;
        g.beginPath();
        g.ellipse(bx, s * 0.36, s * 0.026, s * 0.1, 0, 0, Math.PI * 2);
        g.fill();
      },
    },
  ],
};
