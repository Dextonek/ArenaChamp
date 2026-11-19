import type { HeroKey } from '../../heroes';
import { C } from './numbers';

/**
 * Kagen's canvas icons and portrait. In the game the VectorCraft icons (`public/icons/spells/kagen-*.svg`, drawn by
 * pipeline/icons/vectorcraft/draw/kagen.py, shown through src/icons/vc.ts) are drawn instead, and these are their fallback: what
 * a slot shows until its file has loaded, or if it fails. Each is the same picture in plain canvas strokes: Issen a white slash
 * with a cinnabar after-line, Noto the scarlet sheath in its ring with the blade sliding home, Senbon katanas falling point-down
 * into a ring, Sekai-giri one long cut tearing open like a burning almond. Signature shape: the scarlet sheath.
 * The portrait is drawn by hand from the agreed model (docs/heroes/new/sheath-gate2-large.jpg): the face, the swept dark hair
 * and braid, the pale scar on the left cheek, the star lines on the jaw, the black coat over grey with its pale edge, the
 * cinnabar sash, the red-sun crest, the lacquer plate on the left shoulder, the katana in the right hand and the scarlet sheath
 * rising behind the left shoulder. Everything is built when called (nothing at the top level).
 */
const S = {
  steel: C.steel, steelLo: '#9fa8b2', paper: C.foil, paperLo: '#bdb8ae', cin: C.accent, cinHi: '#ff8a52', cinLo: '#8e2a10',
  dark: C.dark, gold: C.gold, goldHi: '#f4dc94', glow: '#3a1a10', grip: '#3a2e26',
  // his skin (umber), his hair (blue-black) and the coat's greys
  skin: '#8d5b3d', skinHi: '#a97352', skinLo: '#68402a', hair: '#15131b', hairHi: '#2f2d3e', lip: '#6a3a2a', star: '#2c3a78',
  coat: '#1b1712', coatHi: '#34302a', grey: '#7d7f86', greyLo: '#585a62',
};

type G = CanvasRenderingContext2D;
const rad = (deg: number) => (deg * Math.PI) / 180;

function ground(g: G, s: number) {
  const r = g.createRadialGradient(s * 0.42, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, S.glow);
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A polygon in (u along, v across) axes, in shares of the canvas, turned `deg` and moved to (x, y); fills with `fill` under a dark outline. */
function part(g: G, s: number, x: number, y: number, deg: number, pts: Array<[number, number]>, fill: string | CanvasGradient, lw = 0.03) {
  const a = rad(deg), c = Math.cos(a), n = Math.sin(a);
  g.beginPath();
  pts.forEach(([u, v], i) => {
    const px = (x + u * c - v * n) * s, py = (y + u * n + v * c) * s;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  });
  g.closePath();
  g.lineJoin = 'round';
  g.strokeStyle = S.dark;
  g.lineWidth = Math.max(1.2, lw * s);
  g.stroke();
  g.fillStyle = fill;
  g.fill();
}

function ring(g: G, s: number, x: number, y: number, rx: number, ry: number) {
  g.beginPath();
  g.ellipse(x * s, y * s, rx * s, ry * s, 0, 0, Math.PI * 2);
  g.strokeStyle = S.dark;
  g.lineWidth = s * 0.08;
  g.stroke();
  g.strokeStyle = S.cin;
  g.lineWidth = s * 0.045;
  g.stroke();
}

function glint(g: G, x: number, y: number, r: number) {
  g.fillStyle = '#fffaf0';
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

/** A katana point-down: its tip at (x, y), leaning `deg` from the vertical, with guard and grip above it. */
function sword(g: G, s: number, x: number, y: number, deg: number, len: number, w: number) {
  const up = deg - 90;
  const sg = g.createLinearGradient(x * s, y * s, (x + 0.05) * s, (y - len) * s);
  sg.addColorStop(0, '#fffaf0');
  sg.addColorStop(1, S.steelLo);
  part(g, s, x, y, up, [[0, 0], [0.05, -w], [len, -w], [len, w], [0.05, w]], sg, 0.03);
  part(g, s, x, y, up, [[len, -w * 1.9], [len + 0.03, -w * 1.9], [len + 0.03, w * 1.9], [len, w * 1.9]], S.gold, 0.02);
  part(g, s, x, y, up, [[len + 0.03, -w * 0.8], [len + 0.16, -w * 0.8], [len + 0.16, w * 0.8], [len + 0.03, w * 0.8]], S.grip, 0.02);
}

const icon = (k: HeroKey) => (g: G, s: number) => {
  ground(g, s);
  g.lineCap = 'round';
  if (k === 'Q') {
    part(g, s, 0, 0, 0, [[0.1, 0.4], [0.55, 0.53], [0.84, 0.78], [0.5, 0.58]], S.cin, 0.04);
    part(g, s, 0, 0, 0, [[0.12, 0.2], [0.5, 0.3], [0.88, 0.76], [0.45, 0.4]], S.steel, 0.05);
    glint(g, s * 0.86, s * 0.76, s * 0.08);
  } else if (k === 'W') {
    ring(g, s, 0.5, 0.74, 0.36, 0.14);
    // the sheath leans from its gold mouth (upper right) to its foot; the blade slides in from above
    part(g, s, 0.6, 0.36, 110, [[0, -0.085], [0.46, -0.085], [0.52, 0], [0.46, 0.085], [0, 0.085]], S.cin, 0.05);
    part(g, s, 0.6, 0.36, 110, [[-0.3, -0.03], [0.02, -0.03], [0.02, 0.03], [-0.3, 0.03]], S.steel, 0.04);
    part(g, s, 0.6, 0.36, 110, [[-0.03, -0.11], [0.05, -0.11], [0.05, 0.11], [-0.03, 0.11]], S.gold, 0.035);
  } else if (k === 'E') {
    ring(g, s, 0.5, 0.78, 0.34, 0.13);
    sword(g, s, 0.3, 0.74, 78, 0.44, 0.032);
    sword(g, s, 0.7, 0.74, 102, 0.44, 0.032);
    sword(g, s, 0.5, 0.8, 90, 0.48, 0.038);
  } else {
    part(g, s, 0, 0, 0, [[0.66, 0.0], [0.57, 0.5], [0.34, 1], [0.43, 0.5]], S.dark, 0.05);
    part(g, s, 0, 0, 0, [[0.63, 0.1], [0.55, 0.5], [0.37, 0.92], [0.45, 0.5]], S.cin, 0.0);
    g.strokeStyle = '#fffaf0';
    g.lineWidth = s * 0.025;
    g.beginPath();
    g.moveTo(s * 0.64, s * 0.08);
    g.lineTo(s * 0.5, s * 0.5);
    g.lineTo(s * 0.36, s * 0.92);
    g.stroke();
    glint(g, s * 0.5, s * 0.5, s * 0.08);
  }
};

export const icons: Record<HeroKey, (g: CanvasRenderingContext2D, size: number) => void> = {
  Q: icon('Q'), W: icon('W'), E: icon('E'), R: icon('R'),
};

/** The portrait: head and shoulders, front, 3/4 of the figure's height as the others'; his sword and its scarlet sheath behind. */
export function portrait(g: CanvasRenderingContext2D, s: number) {
  ground(g, s);
  const cx = s * 0.5;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // the pale ring of the crest, large and faint behind the head, and a cinnabar light
  const lg = g.createRadialGradient(cx, s * 0.44, 0, cx, s * 0.44, s * 0.5);
  lg.addColorStop(0, 'rgba(207,74,28,0.4)');
  lg.addColorStop(1, 'rgba(207,74,28,0)');
  g.fillStyle = lg;
  g.fillRect(0, 0, s, s);
  g.beginPath();
  g.arc(cx, s * 0.44, s * 0.4, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(235,232,226,0.22)';
  g.lineWidth = s * 0.012;
  g.stroke();
  // the katana in his right hand (viewer's left): a long steel blade rising behind the shoulder, a gold guard below
  part(g, s, 0.2, 0.92, -75, [[0, -0.014], [0.74, -0.018], [0.8, 0.002], [0.74, 0.018], [0, 0.018]],
    (() => { const q = g.createLinearGradient(0.1 * s, 0.9 * s, 0.34 * s, 0.2 * s); q.addColorStop(0, '#fffaf0'); q.addColorStop(1, S.steelLo); return q; })(), 0.014);
  // the scarlet sheath (viewer's right, at his left hip), its foot rising behind the shoulder, two paper seals on it
  const sh = g.createLinearGradient(0.74 * s, 0.4 * s, 0.9 * s, 0.7 * s);
  sh.addColorStop(0, S.cinHi);
  sh.addColorStop(0.4, S.cin);
  sh.addColorStop(1, S.cinLo);
  part(g, s, 0.93, 0.96, -112, [[0, -0.036], [0.6, -0.036], [0.64, -0.026], [0.66, 0], [0.64, 0.026], [0.6, 0.036], [0, 0.036]], sh, 0.016);
  part(g, s, 0.93, 0.96, -112, [[0.55, -0.04], [0.65, -0.04], [0.68, 0], [0.65, 0.04], [0.55, 0.04]], S.dark, 0.0);
  for (const u of [0.32, 0.46]) {
    part(g, s, 0.93, 0.96, -112, [[u - 0.022, -0.055], [u + 0.022, -0.052], [u + 0.022, 0.055], [u - 0.022, 0.052]], S.paper, 0.012);
    part(g, s, 0.93, 0.96, -112, [[u - 0.006, -0.05], [u + 0.006, -0.05], [u + 0.006, 0.05], [u - 0.006, 0.05]], S.cin, 0);
  }
  // the braid, hanging behind the neck at the viewer's left, tied with a cinnabar cord
  g.fillStyle = S.hair;
  g.strokeStyle = S.dark;
  g.lineWidth = s * 0.012;
  g.beginPath();
  g.moveTo(cx - s * 0.1, s * 0.5);
  g.quadraticCurveTo(cx - s * 0.2, s * 0.58, cx - s * 0.2, s * 0.74);
  g.lineTo(cx - s * 0.15, s * 0.76);
  g.quadraticCurveTo(cx - s * 0.14, s * 0.6, cx - s * 0.06, s * 0.5);
  g.closePath();
  g.stroke();
  g.fill();
  g.strokeStyle = S.hairHi;
  g.lineWidth = s * 0.006;
  for (const k of [0.56, 0.62, 0.68]) {
    g.beginPath();
    g.moveTo(cx - s * 0.185, s * k);
    g.lineTo(cx - s * 0.155, s * (k + 0.03));
    g.stroke();
  }
  g.fillStyle = S.cin;
  g.beginPath();
  g.ellipse(cx - s * 0.175, s * 0.745, s * 0.03, s * 0.012, 0.2, 0, Math.PI * 2);
  g.fill();
  // neck
  g.fillStyle = S.skin;
  g.strokeStyle = S.dark;
  g.lineWidth = s * 0.012;
  g.beginPath();
  g.moveTo(cx - s * 0.06, s * 0.54);
  g.lineTo(cx - s * 0.066, s * 0.68);
  g.lineTo(cx + s * 0.066, s * 0.68);
  g.lineTo(cx + s * 0.06, s * 0.54);
  g.closePath();
  g.stroke();
  g.fill();
  g.fillStyle = S.skinLo;
  g.beginPath();
  g.moveTo(cx - s * 0.06, s * 0.57);
  g.lineTo(cx + s * 0.06, s * 0.57);
  g.lineTo(cx + s * 0.064, s * 0.64);
  g.quadraticCurveTo(cx, s * 0.62, cx - s * 0.064, s * 0.64);
  g.closePath();
  g.globalAlpha = 0.5;
  g.fill();
  g.globalAlpha = 1;
  // the black coat: broad shoulders, the grey under it showing in the open collar
  const coat = () => {
    g.beginPath();
    g.moveTo(cx - s * 0.07, s * 0.65);
    g.quadraticCurveTo(cx - s * 0.2, s * 0.68, cx - s * 0.3, s * 0.76);
    g.quadraticCurveTo(cx - s * 0.36, s * 0.84, cx - s * 0.36, s);
    g.lineTo(cx + s * 0.36, s);
    g.quadraticCurveTo(cx + s * 0.36, s * 0.84, cx + s * 0.3, s * 0.76);
    g.quadraticCurveTo(cx + s * 0.2, s * 0.68, cx + s * 0.07, s * 0.65);
    g.closePath();
  };
  coat();
  g.strokeStyle = S.dark;
  g.lineWidth = s * 0.03;
  g.stroke();
  const cg = g.createLinearGradient(cx - s * 0.3, s * 0.7, cx + s * 0.3, s);
  cg.addColorStop(0, S.coatHi);
  cg.addColorStop(0.5, S.coat);
  cg.addColorStop(1, S.dark);
  g.fillStyle = cg;
  g.fill();
  // the grey under-shirt in the V of the collar, its edge pale
  g.beginPath();
  g.moveTo(cx - s * 0.075, s * 0.655);
  g.lineTo(cx - s * 0.12, s * 0.8);
  g.lineTo(cx - s * 0.095, s);
  g.lineTo(cx + s * 0.095, s);
  g.lineTo(cx + s * 0.12, s * 0.8);
  g.lineTo(cx + s * 0.075, s * 0.655);
  g.quadraticCurveTo(cx, s * 0.7, cx - s * 0.075, s * 0.655);
  g.closePath();
  g.fillStyle = S.grey;
  g.fill();
  g.fillStyle = S.greyLo;
  g.beginPath();
  g.moveTo(cx - s * 0.075, s * 0.67);
  g.quadraticCurveTo(cx, s * 0.72, cx + s * 0.075, s * 0.67);
  g.lineTo(cx + s * 0.09, s * 0.76);
  g.quadraticCurveTo(cx, s * 0.74, cx - s * 0.09, s * 0.76);
  g.closePath();
  g.fill();
  // the pale edge of the lapels, in two lines down the opening
  g.strokeStyle = S.paper;
  g.lineWidth = s * 0.012;
  for (const d of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + d * s * 0.075, s * 0.655);
    g.lineTo(cx + d * s * 0.12, s * 0.8);
    g.lineTo(cx + d * s * 0.095, s);
    g.stroke();
  }
  // the cinnabar sash at the foot of the picture
  g.fillStyle = S.cin;
  g.beginPath();
  g.moveTo(cx - s * 0.355, s * 0.935);
  g.quadraticCurveTo(cx, s * 0.965, cx + s * 0.355, s * 0.935);
  g.lineTo(cx + s * 0.36, s);
  g.lineTo(cx - s * 0.36, s);
  g.closePath();
  g.fill();
  g.strokeStyle = S.cinLo;
  g.lineWidth = s * 0.008;
  g.stroke();
  // the red-sun crest in its pale ring on the chest (viewer's left), and the lacquer plate on his left shoulder (viewer's right)
  g.beginPath();
  g.arc(cx - s * 0.22, s * 0.84, s * 0.04, 0, Math.PI * 2);
  g.fillStyle = S.paper;
  g.fill();
  g.beginPath();
  g.arc(cx - s * 0.22, s * 0.84, s * 0.026, 0, Math.PI * 2);
  g.fillStyle = S.cin;
  g.fill();
  const pg = g.createLinearGradient(cx + s * 0.16, s * 0.68, cx + s * 0.34, s * 0.8);
  pg.addColorStop(0, '#6a6258');
  pg.addColorStop(0.5, '#2c2620');
  pg.addColorStop(1, '#14100c');
  g.beginPath();
  g.moveTo(cx + s * 0.15, s * 0.7);
  g.quadraticCurveTo(cx + s * 0.27, s * 0.64, cx + s * 0.34, s * 0.76);
  g.quadraticCurveTo(cx + s * 0.3, s * 0.82, cx + s * 0.2, s * 0.8);
  g.quadraticCurveTo(cx + s * 0.16, s * 0.76, cx + s * 0.15, s * 0.7);
  g.closePath();
  g.fillStyle = pg;
  g.fill();
  g.strokeStyle = S.gold;
  g.lineWidth = s * 0.01;
  g.stroke();
  g.strokeStyle = 'rgba(244,241,234,0.55)';
  g.lineWidth = s * 0.008;
  g.beginPath();
  g.moveTo(cx + s * 0.19, s * 0.7);
  g.quadraticCurveTo(cx + s * 0.26, s * 0.67, cx + s * 0.31, s * 0.72);
  g.stroke();
  // his face: a lean oval, a firm jaw, umber, the light from the upper left
  const face = () => {
    g.beginPath();
    g.moveTo(cx - s * 0.11, s * 0.4);
    g.bezierCurveTo(cx - s * 0.112, s * 0.5, cx - s * 0.06, s * 0.6, cx, s * 0.608);
    g.bezierCurveTo(cx + s * 0.06, s * 0.6, cx + s * 0.112, s * 0.5, cx + s * 0.11, s * 0.4);
    g.bezierCurveTo(cx + s * 0.11, s * 0.3, cx - s * 0.11, s * 0.3, cx - s * 0.11, s * 0.4);
    g.closePath();
  };
  face();
  g.strokeStyle = S.dark;
  g.lineWidth = s * 0.012;
  g.stroke();
  g.fillStyle = S.skin;
  g.fill();
  g.save();
  face();
  g.clip();
  g.fillStyle = S.skinLo;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.ellipse(cx + s * 0.13, s * 0.5, s * 0.07, s * 0.14, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.skinHi;
  g.globalAlpha = 0.4;
  g.beginPath();
  g.ellipse(cx - s * 0.05, s * 0.47, s * 0.04, s * 0.03, -0.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.globalAlpha = 1;
  // the hair: dark, swept back from the brow and up, a tuft over the forehead
  g.fillStyle = S.hair;
  g.strokeStyle = S.dark;
  g.lineWidth = s * 0.012;
  g.beginPath();
  g.moveTo(cx - s * 0.12, s * 0.42);
  g.bezierCurveTo(cx - s * 0.15, s * 0.28, cx - s * 0.1, s * 0.2, cx - s * 0.02, s * 0.19);
  g.bezierCurveTo(cx + s * 0.06, s * 0.17, cx + s * 0.14, s * 0.23, cx + s * 0.12, s * 0.42);
  g.lineTo(cx + s * 0.1, s * 0.36);
  g.quadraticCurveTo(cx + s * 0.04, s * 0.31, cx - s * 0.02, s * 0.33);
  g.quadraticCurveTo(cx - s * 0.09, s * 0.33, cx - s * 0.1, s * 0.4);
  g.closePath();
  g.stroke();
  g.fill();
  g.strokeStyle = S.hairHi;
  g.lineWidth = s * 0.008;
  for (const [a, b, c2, d] of [[-0.07, 0.3, 0.0, 0.215], [-0.02, 0.32, 0.07, 0.22], [0.02, 0.29, 0.11, 0.27]]) {
    g.beginPath();
    g.moveTo(cx + s * a, s * b);
    g.quadraticCurveTo(cx + s * (a + c2) / 2, s * (d - 0.02), cx + s * c2, s * d);
    g.stroke();
  }
  // brows (heavy, level), eyes (dark, steady), the nose, the mouth
  for (const d of [-1, 1]) {
    const ex = cx + d * s * 0.05, ey = s * 0.452;
    g.strokeStyle = S.hair;
    g.lineWidth = s * 0.016;
    g.beginPath();
    g.moveTo(ex - d * s * 0.036, s * 0.425);
    g.quadraticCurveTo(ex, s * 0.412, ex + d * s * 0.04, s * 0.428);
    g.stroke();
    g.fillStyle = S.paper;
    g.beginPath();
    g.moveTo(ex - d * s * 0.026, ey + s * 0.004);
    g.quadraticCurveTo(ex, ey - s * 0.02, ex + d * s * 0.028, ey - s * 0.002);
    g.quadraticCurveTo(ex, ey + s * 0.014, ex - d * s * 0.026, ey + s * 0.004);
    g.fill();
    g.fillStyle = S.hair;
    g.beginPath();
    g.arc(ex, ey - s * 0.002, s * 0.0105, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.dark;
    g.beginPath();
    g.arc(ex, ey - s * 0.002, s * 0.006, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.dark;
    g.lineWidth = Math.max(1, s * 0.009);
    g.beginPath();
    g.moveTo(ex - d * s * 0.028, ey + s * 0.003);
    g.quadraticCurveTo(ex, ey - s * 0.024, ex + d * s * 0.032, ey - s * 0.006);
    g.stroke();
  }
  g.strokeStyle = S.skinLo;
  g.lineWidth = s * 0.009;
  g.beginPath();
  g.moveTo(cx + s * 0.004, s * 0.46);
  g.quadraticCurveTo(cx + s * 0.02, s * 0.51, cx, s * 0.522);
  g.quadraticCurveTo(cx - s * 0.015, s * 0.526, cx - s * 0.026, s * 0.518);
  g.stroke();
  g.strokeStyle = S.lip;
  g.lineWidth = s * 0.011;
  g.beginPath();
  g.moveTo(cx - s * 0.036, s * 0.56);
  g.quadraticCurveTo(cx, s * 0.568, cx + s * 0.036, s * 0.558);
  g.stroke();
  // the pale scar on his left cheek (viewer's right), slanting down
  g.strokeStyle = '#e6c9b0';
  g.lineWidth = s * 0.008;
  g.beginPath();
  g.moveTo(cx + s * 0.072, s * 0.47);
  g.lineTo(cx + s * 0.052, s * 0.545);
  g.stroke();
  // the fine blue-black star lines on the jaw: a few short strokes joining small points, both sides
  g.strokeStyle = S.star;
  g.fillStyle = S.star;
  g.globalAlpha = 0.85;
  g.lineWidth = s * 0.004;
  for (const d of [-1, 1]) {
    const pts: Array<[number, number]> = [[0.092, 0.5], [0.074, 0.545], [0.05, 0.578], [0.03, 0.598]];
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(cx + d * s * x, s * y) : g.moveTo(cx + d * s * x, s * y)));
    g.stroke();
    for (const [x, y] of pts) {
      g.beginPath();
      g.arc(cx + d * s * x, s * y, s * 0.006, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
}
