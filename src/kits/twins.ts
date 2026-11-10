import type { HeroKit } from '../heroes';
import {
  BONK_DAMAGE, BONK_REACH, CHARGE_DAMAGE, CHARGE_RANGE, FLIP_DAMAGE, FLIP_DISTANCE, PEBBLE_DAMAGE, PEBBLE_RANGE, SHIELD_AMOUNT, SHIELD_SECONDS,
  SNARE_DAMAGE, SNARE_RANGE, SNARE_ROOT,
} from '../traits/twins';

/**
 * Twins kit data: Pim and Pom (kits v5). `twinsKit` is Pim (orange helmet, wooden sword, melee); `twinsKit.alt` is Pom (blue hood,
 * slingshot, ranged). The same name, so the same trait; each half has its own Q, W, E, the same Tag Out in R, icons, portrait, model
 * and basic attack. 620 HP in all (the real bar), cut in two halves. Icons are canvas-drawn toys: a dark plum-blue ground, flat bright
 * colours with a dark outline, small white stars.
 */
const S = {
  pim: '#ffb04a', pimMid: '#d98c34', pom: '#6ac8ff', pomMid: '#3f9fd6', wood: '#b07a40', woodDark: '#6b4423', rope: '#b89a62',
  skin: '#e8b899', yellow: '#ffd24a', pink: '#ff7aa8', glove: '#e6e2d4', stone: '#8a8478', steel: '#8fa2b8', dark: '#1a1424', white: '#ffffff',
  // the Changeling Twins' bark, amber and blue leaf clothes, eyes and weapon glows (the _v3 models)
  bark: '#6e4a2a', barkDark: '#4a2e18', amber: '#c8782a', amberDark: '#b0601e', blueLeaf: '#3a86b8', blueDark: '#2a6a98',
  glowAmber: '#ffa83a', glowBlue: '#4ab8ff', eye: '#3a6a4a',
};

function ground(g: CanvasRenderingContext2D, s: number, warm: boolean) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.8);
  r.addColorStop(0, warm ? '#4a2c3a' : '#243c5a');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A star with a dark edge. */
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, color = S.yellow, n = 5, rot = 0) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2 + rot, k = i % 2 ? 0.46 : 1;
    g.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.lineWidth = r * 0.16;
  g.lineJoin = 'round';
  g.strokeStyle = S.dark;
  g.stroke();
}

function outline(g: CanvasRenderingContext2D, s: number, w = 0.02) {
  g.lineWidth = s * w;
  g.lineJoin = 'round';
  g.strokeStyle = S.dark;
  g.stroke();
}

function disc(g: CanvasRenderingContext2D, s: number, x: number, y: number, r: number, color: string) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  outline(g, s, 0.018);
}

/** A thin speed streak. */
function streak(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color = S.white) {
  g.lineCap = 'round';
  g.strokeStyle = S.dark;
  g.lineWidth = w * 1.8;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = w;
  g.stroke();
}

/** The wooden sword, grip at (x,y), pointing along `rot` (0 = right), `len` long. */
function sword(g: CanvasRenderingContext2D, s: number, x: number, y: number, len: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const w = len * 0.12;
  g.beginPath();
  g.roundRect(0, -w / 2, len, w, w * 0.5);
  g.fillStyle = S.wood;
  g.fill();
  outline(g, s, 0.02);
  g.fillStyle = S.woodDark;
  g.fillRect(len * 0.04, -w * 1.3, w * 0.7, w * 2.6);
  g.beginPath();
  g.roundRect(-len * 0.22, -w * 0.35, len * 0.24, w * 0.7, w * 0.3);
  g.fillStyle = S.pimMid;
  g.fill();
  outline(g, s, 0.014);
  disc(g, s, -len * 0.24, 0, w * 0.5, S.pim);
  g.restore();
}

function helmet(g: CanvasRenderingContext2D, s: number, cx: number, cy: number, r: number) {
  // Head, then the dome with a yellow stripe, then two eyes and a grin.
  disc(g, s, cx, cy, r, S.skin);
  g.beginPath();
  g.arc(cx, cy - r * 0.05, r * 1.1, Math.PI, 0);
  g.closePath();
  g.fillStyle = S.pimMid;
  g.fill();
  outline(g, s, 0.02);
  g.fillStyle = S.yellow;
  g.fillRect(cx - r * 0.1, cy - r * 1.15, r * 0.2, r * 1.1);
  face(g, s, cx, cy + r * 0.2, r);
}

function hood(g: CanvasRenderingContext2D, s: number, cx: number, cy: number, r: number) {
  disc(g, s, cx, cy, r * 1.1, S.pomMid);
  disc(g, s, cx, cy + r * 0.1, r * 0.82, S.skin);
  g.beginPath();
  g.arc(cx, cy - r * 0.2, r * 0.9, Math.PI * 1.1, Math.PI * 1.9);
  g.lineTo(cx, cy - r * 0.2);
  g.closePath();
  g.fillStyle = S.pomMid;
  g.fill();
  disc(g, s, cx, cy - r * 1.25, r * 0.28, S.pom);
  face(g, s, cx, cy + r * 0.28, r);
}

function face(g: CanvasRenderingContext2D, s: number, cx: number, cy: number, r: number) {
  g.fillStyle = S.dark;
  for (const sx of [-0.32, 0.32]) {
    g.beginPath();
    g.arc(cx + r * sx, cy - r * 0.08, r * 0.1, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = S.dark;
  g.lineWidth = s * 0.014;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(cx, cy + r * 0.1, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  g.fillStyle = 'rgba(255,122,168,0.55)';
  for (const sx of [-0.55, 0.55]) {
    g.beginPath();
    g.arc(cx + r * sx, cy + r * 0.12, r * 0.13, 0, Math.PI * 2);
    g.fill();
  }
}

function shield(g: CanvasRenderingContext2D, s: number, cx: number, cy: number, r: number) {
  disc(g, s, cx, cy, r, S.pimMid);
  g.beginPath();
  g.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
  g.lineWidth = r * 0.14;
  g.strokeStyle = S.woodDark;
  g.stroke();
  star(g, cx, cy, r * 0.55, S.yellow);
}

function net(g: CanvasRenderingContext2D, s: number, cx: number, cy: number, rx: number, ry: number) {
  g.strokeStyle = S.dark;
  g.lineWidth = s * 0.05;
  const cobweb = (color: string, w: number) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.lineCap = 'round';
    for (const k of [0.38, 0.7, 1]) {
      g.beginPath();
      g.ellipse(cx, cy, rx * k, ry * k, 0, 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      g.stroke();
    }
  };
  cobweb(S.dark, s * 0.05);
  cobweb(S.rope, s * 0.022);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    disc(g, s, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, s * 0.035, S.pomMid);
  }
}

function glove(g: CanvasRenderingContext2D, s: number, x: number, y: number, r: number, cuff: string) {
  g.fillStyle = cuff;
  g.fillRect(x - r * 0.6, y + r * 0.6, r * 1.2, r * 1.1);
  g.strokeStyle = S.dark;
  g.lineWidth = s * 0.016;
  g.strokeRect(x - r * 0.6, y + r * 0.6, r * 1.2, r * 1.1);
  disc(g, s, x, y, r, S.glove);
  for (const sx of [-0.6, -0.2, 0.2, 0.6]) disc(g, s, x + r * sx, y - r * 0.8, r * 0.28, S.glove);
}

function slingshot(g: CanvasRenderingContext2D, s: number, cx: number, cy: number, h: number) {
  // A wooden Y with a pink band drawn back to a pebble.
  g.lineCap = 'round';
  const wood = (w: number, color: string) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(cx, cy + h);
    g.lineTo(cx, cy);
    g.lineTo(cx - h * 0.55, cy - h * 0.7);
    g.moveTo(cx, cy);
    g.lineTo(cx + h * 0.55, cy - h * 0.7);
    g.stroke();
  };
  wood(s * 0.1, S.dark);
  wood(s * 0.06, S.wood);
  streak(g, cx - h * 0.55, cy - h * 0.7, cx - h * 0.1, cy - h * 0.1, s * 0.02, S.pink);
  streak(g, cx + h * 0.55, cy - h * 0.7, cx - h * 0.1, cy - h * 0.1, s * 0.02, S.pink);
  disc(g, s, cx - h * 0.1, cy - h * 0.05, s * 0.05, S.stone);
}

/** A pointed leaf from (x, y), `len` long and `w` wide, tilted by `rot`: the Changeling Twins' trim. */
function leafShape(g: CanvasRenderingContext2D, s: number, x: number, y: number, len: number, w: number, rot: number, color: string) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(w, -len * 0.45, 0, -len);
  g.quadraticCurveTo(-w, -len * 0.45, 0, 0);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  outline(g, s, 0.012);
  g.restore();
}

/** A fae child's head for the portraits: round face, big green eyes, a small smile, long pointed ears, and either Pim's bark acorn-cap helm with an amber leaf crest or Pom's blue leaf hood with a glowing bead. */
function faeHead(g: CanvasRenderingContext2D, s: number, cx: number, cy: number, r: number, kind: 'acorn' | 'hood') {
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + sx * r * 0.85, cy - r * 0.05);
    g.lineTo(cx + sx * r * 1.75, cy - r * 0.6);
    g.lineTo(cx + sx * r * 0.92, cy + r * 0.3);
    g.closePath();
    g.fillStyle = S.skin;
    g.fill();
    outline(g, s, 0.014);
  }
  if (kind === 'hood') {
    // The hood: a mass behind the face and a point falling back with a glowing bead.
    disc(g, s, cx, cy - r * 0.05, r * 1.14, S.blueDark);
    g.beginPath();
    g.moveTo(cx - r * 0.3, cy - r * 1.0);
    g.quadraticCurveTo(cx - r * 0.2, cy - r * 1.7, cx + r * 0.7, cy - r * 1.45);
    g.quadraticCurveTo(cx + r * 0.1, cy - r * 1.35, cx + r * 0.3, cy - r * 0.95);
    g.closePath();
    g.fillStyle = S.blueDark;
    g.fill();
    outline(g, s, 0.014);
    g.save();
    g.shadowColor = S.glowBlue;
    g.shadowBlur = s * 0.05;
    disc(g, s, cx + r * 0.72, cy - r * 1.45, r * 0.2, '#9ad8ff');
    g.restore();
  }
  disc(g, s, cx, cy, r, S.skin);
  for (const sx of [-0.36, 0.36]) {
    g.fillStyle = '#fff8f0';
    g.beginPath();
    g.ellipse(cx + r * sx, cy + r * 0.02, r * 0.19, r * 0.25, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.eye;
    g.beginPath();
    g.ellipse(cx + r * sx, cy + r * 0.05, r * 0.13, r * 0.19, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.dark;
    g.beginPath();
    g.arc(cx + r * sx, cy + r * 0.07, r * 0.065, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.white;
    g.beginPath();
    g.arc(cx + r * (sx + 0.05), cy - r * 0.03, r * 0.04, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = S.dark;
  g.lineWidth = s * 0.012;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(cx, cy + r * 0.3, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  if (kind === 'hood') {
    g.strokeStyle = S.blueLeaf;
    g.lineWidth = r * 0.2;
    g.beginPath();
    g.arc(cx, cy - r * 0.05, r * 1.0, Math.PI * 1.02, Math.PI * 1.98);
    g.stroke();
    return;
  }
  // The bark acorn cap: a dome with darker bands, a stalk, an amber leaf crest swept back.
  g.beginPath();
  g.arc(cx, cy - r * 0.12, r * 1.1, Math.PI, 0);
  g.closePath();
  g.fillStyle = S.bark;
  g.fill();
  outline(g, s, 0.02);
  g.strokeStyle = S.barkDark;
  g.lineWidth = r * 0.12;
  for (const k of [0.45, 0.75]) {
    g.beginPath();
    g.arc(cx, cy - r * 0.12, r * 1.1 * k, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
  }
  g.fillStyle = S.barkDark;
  g.fillRect(cx - r * 0.07, cy - r * 1.4, r * 0.14, r * 0.3);
  leafShape(g, s, cx - r * 0.2, cy - r * 1.0, r * 0.7, r * 0.2, -0.9, S.amber);
  leafShape(g, s, cx + r * 0.2, cy - r * 1.0, r * 0.7, r * 0.2, 0.9, S.amber);
}

/** Shoulders in a leaf-hemmed tunic in `color`, a collar of small leaves, the satchel strap across. */
function faeShoulders(g: CanvasRenderingContext2D, s: number, color: string, leaf: string) {
  g.beginPath();
  g.moveTo(s * 0.18, s);
  g.quadraticCurveTo(s * 0.2, s * 0.72, s * 0.5, s * 0.7);
  g.quadraticCurveTo(s * 0.8, s * 0.72, s * 0.82, s);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  outline(g, s, 0.02);
  g.fillStyle = S.barkDark;
  g.save();
  g.translate(s * 0.5, s * 0.84);
  g.rotate(-0.55);
  g.fillRect(-s * 0.04, -s * 0.2, s * 0.08, s * 0.4);
  g.restore();
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    leafShape(g, s, s * (0.3 + 0.4 * t), s * (0.73 - 0.03 * Math.sin(Math.PI * t)), s * 0.13, s * 0.04, (t - 0.5) * 1.6 + Math.PI, leaf);
  }
}

/** Pim's portrait base and Pom's, by hand: head and shoulders with the hero's gear. */
function pimPortrait(g: CanvasRenderingContext2D, s: number) {
  ground(g, s, true);
  star(g, s * 0.84, s * 0.2, s * 0.06, S.glowAmber, 4);
  // The wooden sword behind him, its edges glowing amber.
  g.save();
  g.translate(s * 0.8, s * 0.9);
  g.rotate(-Math.PI * 0.42);
  g.beginPath();
  g.roundRect(0, -s * 0.04, s * 0.7, s * 0.08, s * 0.03);
  g.fillStyle = S.bark;
  g.fill();
  outline(g, s, 0.02);
  g.shadowColor = S.glowAmber;
  g.shadowBlur = s * 0.04;
  g.strokeStyle = S.glowAmber;
  g.lineWidth = s * 0.014;
  for (const sy of [-0.04, 0.04]) {
    g.beginPath();
    g.moveTo(s * 0.04, s * sy);
    g.lineTo(s * 0.66, s * sy * 0.8);
    g.stroke();
  }
  g.restore();
  faeShoulders(g, s, S.amberDark, S.amber);
  faeHead(g, s, s * 0.82, s * 0.57, s * 0.085, 'hood');
  faeHead(g, s, s * 0.5, s * 0.46, s * 0.21, 'acorn');
}

function pomPortrait(g: CanvasRenderingContext2D, s: number) {
  ground(g, s, false);
  star(g, s * 0.16, s * 0.2, s * 0.06, S.glowBlue, 4);
  faeShoulders(g, s, S.blueDark, S.blueLeaf);
  faeHead(g, s, s * 0.18, s * 0.58, s * 0.085, 'acorn');
  // The slingshot, a dark Y with a glowing blue band drawn back to a glowing stone.
  g.lineCap = 'round';
  const cx = s * 0.8, cy = s * 0.78, h = s * 0.2;
  for (const [w, color] of [[s * 0.1, S.dark], [s * 0.06, S.bark]] as [number, string][]) {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(cx, cy + h);
    g.lineTo(cx, cy);
    g.lineTo(cx - h * 0.55, cy - h * 0.7);
    g.moveTo(cx, cy);
    g.lineTo(cx + h * 0.55, cy - h * 0.7);
    g.stroke();
  }
  g.save();
  g.shadowColor = S.glowBlue;
  g.shadowBlur = s * 0.04;
  streak(g, cx - h * 0.55, cy - h * 0.7, cx - h * 0.1, cy - h * 0.1, s * 0.02, '#7ac8ff');
  streak(g, cx + h * 0.55, cy - h * 0.7, cx - h * 0.1, cy - h * 0.1, s * 0.02, '#7ac8ff');
  disc(g, s, cx - h * 0.1, cy - h * 0.05, s * 0.05, '#aee4ff');
  g.restore();
  faeHead(g, s, s * 0.5, s * 0.46, s * 0.21, 'hood');
}

/** Tag Out: two gloves slapping together, one orange cuff and one blue, a star between them. */
function tagIcon(g: CanvasRenderingContext2D, s: number) {
  ground(g, s, true);
  g.save();
  g.translate(s * 0.3, s * 0.62);
  g.rotate(-0.5);
  glove(g, s, 0, 0, s * 0.13, S.pimMid);
  g.restore();
  g.save();
  g.translate(s * 0.7, s * 0.62);
  g.rotate(0.5);
  glove(g, s, 0, 0, s * 0.13, S.pomMid);
  g.restore();
  star(g, s * 0.5, s * 0.3, s * 0.2, S.yellow, 8);
  streak(g, s * 0.5, s * 0.06, s * 0.5, s * 0.14, s * 0.02, S.white);
  streak(g, s * 0.24, s * 0.2, s * 0.3, s * 0.24, s * 0.02, S.white);
  streak(g, s * 0.76, s * 0.2, s * 0.7, s * 0.24, s * 0.02, S.white);
}

const tagOut = {
  key: 'R' as const, label: 'tag out', name: 'Tag Out', range: 0, cooldown: 8, anytime: true as const,
  blurb: 'Swap twins: a 0.5 s hold while the other pops out of the backpack. The one who comes in has the next spell ready 2 s sooner. The twin who rests heals 6 HP a second.',
  icon: tagIcon,
};

const pom: HeroKit = {
  name: 'Pim and Pom',
  title: 'the Changeling Twins',
  accent: S.pom,
  foil: S.pim,
  maxHp: 620,
  hpChunks: 2,
  model: 'models/heroes/pom_v3.glb',
  attack: { kind: 'ranged', range: 6, damage: 12, interval: 0.9, speed: 20, look: 'dart' },
  portrait: pomPortrait,
  spells: [
    {
      key: 'Q', label: 'pebble', name: 'Pebble', range: PEBBLE_RANGE, cooldown: 3, aim: 'line',
      blurb: `A pebble from the slingshot (${PEBBLE_RANGE} m, quick): ${PEBBLE_DAMAGE} damage. Sidestep it.`,
      icon(g, s) {
        ground(g, s, false);
        slingshot(g, s, s * 0.3, s * 0.62, s * 0.26);
        streak(g, s * 0.4, s * 0.55, s * 0.9, s * 0.36, s * 0.03, S.white);
        streak(g, s * 0.46, s * 0.68, s * 0.8, s * 0.56, s * 0.02, S.pom);
        disc(g, s, s * 0.8, s * 0.38, s * 0.09, S.stone);
        star(g, s * 0.9, s * 0.2, s * 0.08, S.yellow);
      },
    },
    {
      key: 'W', label: 'snare', name: 'Snare', range: SNARE_RANGE, cooldown: 9, cc: true,
      blurb: `A net drops on a spot (${SNARE_RANGE} m, 1 s warning, 2 m round): ${SNARE_DAMAGE} damage and a ${SNARE_ROOT} s root. Leave the circle.`,
      icon(g, s) {
        ground(g, s, false);
        g.strokeStyle = 'rgba(255,255,255,0.4)';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.66, s * 0.4, s * 0.2, 0, 0, Math.PI * 2);
        g.stroke();
        net(g, s, s * 0.5, s * 0.58, s * 0.36, s * 0.22);
        star(g, s * 0.82, s * 0.2, s * 0.08, S.yellow);
        star(g, s * 0.16, s * 0.28, s * 0.05, S.pim);
      },
    },
    {
      key: 'E', label: 'backflip', name: 'Backflip', range: FLIP_DISTANCE, cooldown: 10, dash: true, escape: true,
      blurb: `A hop ${FLIP_DISTANCE} m toward the aim. She leaves a party popper where she stood: after a moment it goes off for ${FLIP_DAMAGE}.`,
      icon(g, s) {
        ground(g, s, false);
        disc(g, s, s * 0.78, s * 0.74, s * 0.1, S.pomMid);
        g.fillStyle = S.yellow;
        g.fillRect(s * 0.69, s * 0.72, s * 0.18, s * 0.04);
        star(g, s * 0.82, s * 0.56, s * 0.06, S.yellow);
        // A looping arc to the upper left with a hooded head at the end.
        g.strokeStyle = S.dark;
        g.lineWidth = s * 0.07;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(s * 0.5, s * 0.55, s * 0.26, Math.PI * 0.08, Math.PI * 1.15, true);
        g.stroke();
        g.strokeStyle = S.white;
        g.lineWidth = s * 0.035;
        g.stroke();
        hood(g, s, s * 0.2, s * 0.4, s * 0.1);
      },
    },
    tagOut,
  ],
};

export const twinsKit: HeroKit = {
  name: 'Pim and Pom',
  title: 'the Changeling Twins',
  accent: S.pim,
  foil: S.pom,
  maxHp: 620,
  hpChunks: 2,
  melee: true,
  model: 'models/heroes/pim_v3.glb',
  attack: { kind: 'melee', range: 2.4, damage: 16, interval: 0.9, look: 'sweep' },
  portrait: pimPortrait,
  alt: pom,
  spells: [
    {
      key: 'Q', label: 'bonk', name: 'Bonk', range: BONK_REACH, cooldown: 3,
      blurb: `A wooden sword swings across a ${BONK_REACH} m cone in front of him: ${BONK_DAMAGE} damage. Stay out of 3 m.`,
      icon(g, s) {
        ground(g, s, true);
        g.beginPath();
        g.moveTo(s * 0.12, s * 0.9);
        g.arc(s * 0.12, s * 0.9, s * 0.84, -Math.PI * 0.42, -Math.PI * 0.06);
        g.closePath();
        g.fillStyle = 'rgba(255,176,74,0.28)';
        g.fill();
        sword(g, s, s * 0.14, s * 0.84, s * 0.6, -Math.PI * 0.3);
        star(g, s * 0.74, s * 0.34, s * 0.19, S.yellow, 8, 0.2);
        star(g, s * 0.74, s * 0.34, s * 0.09, S.white, 8);
        star(g, s * 0.9, s * 0.64, s * 0.06, S.pom);
        star(g, s * 0.56, s * 0.12, s * 0.05, S.pim);
      },
    },
    {
      key: 'W', label: 'pim charge', name: 'Charge', range: CHARGE_RANGE, cooldown: 9, dash: true,
      blurb: `He lowers his head and runs ${CHARGE_RANGE} m toward the aim after a short wind-up: ${CHARGE_DAMAGE} damage to whoever is in the lane when he arrives.`,
      icon(g, s) {
        ground(g, s, true);
        for (const [y, l] of [[0.3, 0.4], [0.5, 0.5], [0.7, 0.36]] as [number, number][]) streak(g, s * 0.04, s * y, s * (0.04 + l), s * y, s * 0.04, S.white);
        helmet(g, s, s * 0.6, s * 0.52, s * 0.2);
        g.fillStyle = S.pimMid;
        g.beginPath();
        g.roundRect(s * 0.4, s * 0.68, s * 0.4, s * 0.22, s * 0.05);
        g.fill();
        outline(g, s, 0.02);
        disc(g, s, s * 0.22, s * 0.86, s * 0.05, S.glove);
        disc(g, s, s * 0.12, s * 0.8, s * 0.035, S.glove);
        star(g, s * 0.88, s * 0.24, s * 0.08, S.yellow);
      },
    },
    {
      key: 'E', label: 'shield up', name: 'Shield Up', range: 0, cooldown: 10,
      blurb: `A little toy shield: ${SHIELD_AMOUNT} shield for ${SHIELD_SECONDS} s. Wait it out, or take the space.`,
      icon(g, s) {
        ground(g, s, true);
        shield(g, s, s * 0.5, s * 0.5, s * 0.34);
        star(g, s * 0.84, s * 0.2, s * 0.08, S.yellow);
        star(g, s * 0.14, s * 0.78, s * 0.06, S.pom);
        star(g, s * 0.2, s * 0.18, s * 0.04, S.white);
      },
    },
    tagOut,
  ],
};
