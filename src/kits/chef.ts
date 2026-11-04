import type { HeroKit } from '../heroes';

/**
 * Chef kit data: Madame Cleaver, arena chef (kits v5). Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * a warm charcoal kitchen ground, chef's whites, steel, tomato red and a golden "good dish" glow. Signature shape: the big cleaver
 * with the hole near its spine.
 */
const C = {
  core: '#f2efe6', white: '#d8d4c8', shade: '#9a958a', red: '#d84a3a', redDeep: '#9a2e26', tomato: '#e8794a', steel: '#c4ccd4', steelDark: '#8f979e',
  gold: '#e0b84a', goldDeep: '#c98a28', wood: '#8a5a34', black: '#141110', char: '#2c2724', dark: '#1e1a18', smoke: '#6a6662', leaf: '#5f9a3e',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#4a3630');
  r.addColorStop(1, C.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A cleaver centred at (cx, cy), `h` its blade's half-length, turned by `rot` (0: blade up, handle down). */
function cleaver(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, rot = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const w = h * 0.6;
  // The handle: dark outline, wood, a red band, two rivets.
  g.fillStyle = C.dark;
  g.fillRect(-w * 0.26, h * 0.8, w * 0.52, h * 1.15);
  g.fillStyle = C.wood;
  g.fillRect(-w * 0.18, h * 0.84, w * 0.36, h * 1.07);
  g.fillStyle = C.red;
  g.fillRect(-w * 0.22, h * 0.9, w * 0.44, h * 0.14);
  g.fillStyle = C.core;
  g.beginPath();
  g.arc(0, h * 1.35, h * 0.045, 0, Math.PI * 2);
  g.arc(0, h * 1.62, h * 0.045, 0, Math.PI * 2);
  g.fill();
  // The blade: dark outline, steel, a bright edge, a hole near the spine, a pale streak.
  const blade = (k: number) => {
    g.beginPath();
    g.moveTo(-w * k, -h * k);
    g.lineTo(w * 0.8 * k, -h * k);
    g.quadraticCurveTo(w * k, -h * k, w * k, -h * 0.86 * k);
    g.lineTo(w * k, h * 0.9 * k);
    g.lineTo(-w * k, h * 0.9 * k);
    g.closePath();
  };
  g.fillStyle = C.dark;
  blade(1.14);
  g.fill();
  const gl = g.createLinearGradient(-w, 0, w, 0);
  gl.addColorStop(0, C.steelDark);
  gl.addColorStop(0.55, C.steel);
  gl.addColorStop(1, C.core);
  g.fillStyle = gl;
  blade(1);
  g.fill();
  g.fillStyle = C.core;
  g.fillRect(w * 0.82, -h * 0.82, w * 0.18, h * 1.68);
  g.fillStyle = C.dark;
  g.beginPath();
  g.arc(-w * 0.45, -h * 0.5, h * 0.12, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = C.core;
  g.lineWidth = h * 0.07;
  g.beginPath();
  g.moveTo(-w * 0.1, h * 0.7);
  g.lineTo(w * 0.35, -h * 0.2);
  g.stroke();
  g.restore();
}

/** A round plate seen from above and a little in front, centred at (cx, cy), `r` wide. */
function dish(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, kind: 'fresh' | 'good' | 'burnt') {
  g.fillStyle = C.dark;
  g.beginPath();
  g.ellipse(cx, cy + r * 0.12, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = kind === 'burnt' ? C.char : kind === 'good' ? C.gold : C.shade;
  g.beginPath();
  g.ellipse(cx, cy, r, r * 0.46, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = kind === 'burnt' ? '#4a403a' : C.white;
  g.beginPath();
  g.ellipse(cx, cy, r * 0.84, r * 0.36, 0, 0, Math.PI * 2);
  g.fill();
  const food = kind === 'burnt' ? C.black : kind === 'good' ? C.goldDeep : '#b87a3c';
  g.fillStyle = food;
  g.beginPath();
  g.ellipse(cx, cy - r * 0.1, r * 0.5, r * 0.34, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(cx, cy - r * 0.1, r * 0.5, r * 0.1, 0, 0, Math.PI);
  g.fill();
  if (kind === 'good') {
    g.fillStyle = '#f0d878';
    g.beginPath();
    g.ellipse(cx - r * 0.15, cy - r * 0.3, r * 0.17, r * 0.08, -0.4, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'fresh') {
    g.fillStyle = C.red;
    g.beginPath();
    g.arc(cx + r * 0.1, cy - r * 0.38, r * 0.1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C.leaf;
    g.beginPath();
    g.ellipse(cx - r * 0.3, cy - r * 0.05, r * 0.12, r * 0.05, 0.3, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = C.red;
    for (const [x, y] of [[-0.2, -0.2], [0.15, -0.28], [0.05, -0.1]]) {
      g.beginPath();
      g.arc(cx + r * x, cy + r * y, r * 0.06, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Steam curls (or smoke).
  g.lineCap = 'round';
  g.strokeStyle = kind === 'burnt' ? C.smoke : C.core;
  g.lineWidth = r * (kind === 'burnt' ? 0.16 : 0.1);
  g.globalAlpha = 0.85;
  for (const dx of [-0.25, 0.2]) {
    g.beginPath();
    g.moveTo(cx + r * dx, cy - r * 0.45);
    g.bezierCurveTo(cx + r * (dx + 0.25), cy - r * 0.9, cx + r * (dx - 0.25), cy - r * 1.2, cx + r * dx, cy - r * 1.6);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** A stock pot, `w` wide, with its soup and two handles; `tilt` turns it about its base. */
function pot(g: CanvasRenderingContext2D, cx: number, base: number, w: number, tilt = 0) {
  g.save();
  g.translate(cx, base);
  g.rotate(tilt);
  const h = w * 0.85;
  g.fillStyle = C.dark;
  g.fillRect(-w * 0.55, -h * 1.04, w * 1.1, h * 1.08);
  g.fillStyle = C.black;
  g.fillRect(-w * 0.72, -h * 0.82, w * 0.2, h * 0.1);
  g.fillRect(w * 0.52, -h * 0.82, w * 0.2, h * 0.1);
  const gl = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  gl.addColorStop(0, C.steelDark);
  gl.addColorStop(0.45, C.steel);
  gl.addColorStop(1, C.steelDark);
  g.fillStyle = gl;
  g.fillRect(-w / 2, -h, w, h);
  g.fillStyle = C.red;
  g.fillRect(-w / 2, -h * 0.62, w, h * 0.16);
  g.fillStyle = C.core;
  g.fillRect(-w * 0.4, -h * 0.9, w * 0.08, h * 0.78);
  g.fillStyle = C.red;
  g.beginPath();
  g.ellipse(0, -h, w / 2, w * 0.13, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = C.tomato;
  g.beginPath();
  g.ellipse(0, -h, w * 0.4, w * 0.08, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** A laid table in perspective: a cloth top, a hanging front with a red hem, three covered plates. */
function table(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, h: number) {
  const w = x1 - x0;
  g.fillStyle = C.dark;
  g.fillRect(x0 - h * 0.05, y - h * 0.05, w + h * 0.1, h * 1.14);
  const gl = g.createLinearGradient(0, y, 0, y + h);
  gl.addColorStop(0, C.core);
  gl.addColorStop(1, C.shade);
  g.fillStyle = gl;
  g.fillRect(x0, y, w, h);
  g.strokeStyle = C.shade;
  g.lineWidth = h * 0.05;
  for (let i = 1; i < 12; i++) {
    g.beginPath();
    g.moveTo(x0 + (w * i) / 12, y + h * 0.18);
    g.quadraticCurveTo(x0 + (w * i) / 12 + h * 0.06, y + h * 0.6, x0 + (w * i) / 12, y + h);
    g.stroke();
  }
  g.fillStyle = C.red;
  g.fillRect(x0, y + h * 0.84, w, h * 0.16);
  g.fillRect(x0, y, w, h * 0.12);
}

/** A covered plate: a silver dome on a plate, centred at (cx, base). */
function cloche(g: CanvasRenderingContext2D, cx: number, base: number, r: number, lifted = false) {
  g.fillStyle = C.dark;
  g.beginPath();
  g.ellipse(cx, base, r * 1.2, r * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = C.white;
  g.beginPath();
  g.ellipse(cx, base, r * 1.1, r * 0.24, 0, 0, Math.PI * 2);
  g.fill();
  if (lifted) {
    g.fillStyle = C.goldDeep;
    g.beginPath();
    g.ellipse(cx, base - r * 0.1, r * 0.6, r * 0.5, 0, Math.PI, Math.PI * 2);
    g.fill();
    return;
  }
  const gl = g.createLinearGradient(cx - r, 0, cx + r, 0);
  gl.addColorStop(0, C.steelDark);
  gl.addColorStop(0.5, C.core);
  gl.addColorStop(1, C.steelDark);
  g.fillStyle = C.dark;
  g.beginPath();
  g.ellipse(cx, base, r * 1.02, r * 1.08, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = gl;
  g.beginPath();
  g.ellipse(cx, base, r * 0.94, r, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = C.steelDark;
  g.beginPath();
  g.arc(cx, base - r * 1.05, r * 0.14, 0, Math.PI * 2);
  g.fill();
}

export const chefKit: HeroKit = {
  name: 'Madame Cleaver',
  maxHp: 640,
  title: 'Arena Chef',
  accent: C.core,
  foil: C.red,
  portrait(g, s) {
    iconGround(g, s);
    // A great steel cleaver raised behind her shoulder, and the pale light of the kitchen behind her head.
    const halo = g.createRadialGradient(s * 0.5, s * 0.3, s * 0.05, s * 0.5, s * 0.3, s * 0.5);
    halo.addColorStop(0, 'rgba(242,239,230,0.35)');
    halo.addColorStop(1, 'rgba(242,239,230,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, s, s);
    cleaver(g, s * 0.82, s * 0.34, s * 0.2, 0.35);
    // The jacket: a double-breasted white coat with two columns of buttons, a red neckerchief.
    g.fillStyle = C.dark;
    g.beginPath();
    g.moveTo(s * 0.06, s);
    g.quadraticCurveTo(s * 0.1, s * 0.66, s * 0.34, s * 0.6);
    g.lineTo(s * 0.66, s * 0.6);
    g.quadraticCurveTo(s * 0.9, s * 0.66, s * 0.94, s);
    g.closePath();
    g.fill();
    g.fillStyle = C.white;
    g.beginPath();
    g.moveTo(s * 0.1, s);
    g.quadraticCurveTo(s * 0.14, s * 0.68, s * 0.35, s * 0.62);
    g.lineTo(s * 0.65, s * 0.62);
    g.quadraticCurveTo(s * 0.86, s * 0.68, s * 0.9, s);
    g.closePath();
    g.fill();
    g.strokeStyle = C.shade;
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.64);
    g.lineTo(s * 0.5, s);
    g.moveTo(s * 0.36, s * 0.64);
    g.quadraticCurveTo(s * 0.34, s * 0.8, s * 0.4, s);
    g.moveTo(s * 0.64, s * 0.64);
    g.quadraticCurveTo(s * 0.66, s * 0.8, s * 0.6, s);
    g.stroke();
    g.fillStyle = C.steelDark;
    for (const x of [0.43, 0.57]) for (const y of [0.74, 0.84, 0.94]) {
      g.beginPath();
      g.arc(s * x, s * y, s * 0.018, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = C.red;
    g.beginPath();
    g.moveTo(s * 0.4, s * 0.62);
    g.lineTo(s * 0.6, s * 0.62);
    g.lineTo(s * 0.5, s * 0.74);
    g.closePath();
    g.fill();
    // The ladle in her other hand.
    g.strokeStyle = C.steelDark;
    g.lineWidth = s * 0.025;
    g.beginPath();
    g.moveTo(s * 0.16, s * 0.9);
    g.lineTo(s * 0.12, s * 0.5);
    g.stroke();
    g.fillStyle = C.steel;
    g.beginPath();
    g.ellipse(s * 0.11, s * 0.46, s * 0.04, s * 0.03, 0, 0, Math.PI * 2);
    g.fill();
    // The face: round, rosy, proud, chin up; heavy brows, a small stern mouth.
    g.fillStyle = '#efc7ac';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.46, s * 0.14, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e59a8a';
    for (const x of [0.4, 0.6]) {
      g.beginPath();
      g.ellipse(s * x, s * 0.5, s * 0.035, s * 0.022, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = C.dark;
    g.beginPath();
    g.moveTo(s * 0.4, s * 0.4);
    g.lineTo(s * 0.47, s * 0.425);
    g.lineTo(s * 0.46, s * 0.44);
    g.lineTo(s * 0.4, s * 0.425);
    g.closePath();
    g.moveTo(s * 0.6, s * 0.4);
    g.lineTo(s * 0.53, s * 0.425);
    g.lineTo(s * 0.54, s * 0.44);
    g.lineTo(s * 0.6, s * 0.425);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.44, s * 0.455, s * 0.016, s * 0.012, 0, 0, Math.PI * 2);
    g.ellipse(s * 0.56, s * 0.455, s * 0.016, s * 0.012, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#a45b4e';
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(s * 0.46, s * 0.54);
    g.quadraticCurveTo(s * 0.5, s * 0.55, s * 0.54, s * 0.54);
    g.stroke();
    g.strokeStyle = '#d8a58c';
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.46);
    g.lineTo(s * 0.51, s * 0.5);
    g.stroke();
    // The tall toque: pleats fanning up from a band, a red pin.
    g.fillStyle = C.dark;
    g.fillRect(s * 0.355, s * 0.29, s * 0.29, s * 0.07);
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.2, s * 0.19, s * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C.core;
    g.fillRect(s * 0.365, s * 0.3, s * 0.27, s * 0.055);
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.2, s * 0.175, s * 0.135, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = C.shade;
    g.lineWidth = s * 0.008;
    for (const x of [-0.1, -0.05, 0, 0.05, 0.1]) {
      g.beginPath();
      g.moveTo(s * (0.5 + x * 0.6), s * 0.3);
      g.quadraticCurveTo(s * (0.5 + x * 1.5), s * 0.2, s * (0.5 + x * 1.2), s * 0.09);
      g.stroke();
    }
    g.fillStyle = C.red;
    g.fillRect(s * 0.365, s * 0.325, s * 0.27, s * 0.014);
    // Dark hair at the temples.
    g.fillStyle = '#3a2a22';
    g.beginPath();
    g.ellipse(s * 0.36, s * 0.4, s * 0.025, s * 0.06, 0, 0, Math.PI * 2);
    g.ellipse(s * 0.64, s * 0.4, s * 0.025, s * 0.06, 0, 0, Math.PI * 2);
    g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'thrown cleaver', name: 'Thrown Cleaver', range: 9, cooldown: 3.5, aim: 'line',
      blurb: 'She throws her cleaver (9 m): 50 damage. It sticks in the floor where it stops, and a dish plops out there.',
      icon(g, s) {
        iconGround(g, s);
        // A ghost trail behind a tumbling cleaver and a fresh dish where it lands.
        g.globalAlpha = 0.22;
        cleaver(g, s * 0.2, s * 0.4, s * 0.13, 1.9);
        g.globalAlpha = 0.4;
        cleaver(g, s * 0.34, s * 0.36, s * 0.14, 2.3);
        g.globalAlpha = 1;
        cleaver(g, s * 0.52, s * 0.34, s * 0.18, 2.9);
        dish(g, s * 0.76, s * 0.8, s * 0.17, 'fresh');
        g.strokeStyle = C.core;
        g.lineWidth = s * 0.016;
        g.setLineDash([s * 0.04, s * 0.04]);
        g.beginPath();
        g.moveTo(s * 0.06, s * 0.52);
        g.quadraticCurveTo(s * 0.4, s * 0.1, s * 0.76, s * 0.66);
        g.stroke();
        g.setLineDash([]);
      },
    },
    {
      key: 'W', label: 'hot soup', name: 'Hot Soup', range: 8, cooldown: 9,
      blurb: 'A huge pot drops at a spot (8 m) and tips over after 1 s: 40 damage and a 1.5 s slow within 2.5 m, and a dish in the middle.',
      icon(g, s) {
        iconGround(g, s);
        // A red puddle spilling out from a tipped pot, steam over it, a dish in the middle.
        g.fillStyle = C.black;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.78, s * 0.46, s * 0.15, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = C.red;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.78, s * 0.42, s * 0.12, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = C.tomato;
        g.lineWidth = s * 0.016;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.78, s * 0.36, s * 0.09, 0, 0, Math.PI * 2);
        g.stroke();
        pot(g, s * 0.3, s * 0.64, s * 0.4, 1.05);
        g.lineCap = 'round';
        g.strokeStyle = C.core;
        g.lineWidth = s * 0.03;
        g.globalAlpha = 0.85;
        for (const x of [0.62, 0.78, 0.9]) {
          g.beginPath();
          g.moveTo(s * x, s * 0.68);
          g.bezierCurveTo(s * (x + 0.06), s * 0.5, s * (x - 0.06), s * 0.4, s * x, s * 0.24);
          g.stroke();
        }
        g.globalAlpha = 1;
        dish(g, s * 0.62, s * 0.8, s * 0.12, 'fresh');
      },
    },
    {
      key: 'E', label: 'burnt offering', name: 'Burnt Offering', range: 8, cooldown: 12,
      blurb: 'She lobs a burnt dish to a spot (8 m). Black and smoking: whoever walks over it eats 60 damage and a 0.8 s stun. On her it does nothing.',
      icon(g, s) {
        iconGround(g, s);
        g.fillStyle = 'rgba(216,74,58,0.35)';
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.78, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = C.red;
        g.lineWidth = s * 0.02;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.78, s * 0.36, s * 0.11, 0, 0, Math.PI * 2);
        g.stroke();
        // Smoke from the plate: three thick dark curls.
        g.lineCap = 'round';
        g.strokeStyle = C.smoke;
        g.lineWidth = s * 0.06;
        g.globalAlpha = 0.9;
        for (const x of [0.38, 0.5, 0.62]) {
          g.beginPath();
          g.moveTo(s * x, s * 0.56);
          g.bezierCurveTo(s * (x + 0.1), s * 0.4, s * (x - 0.1), s * 0.28, s * x, s * 0.1);
          g.stroke();
        }
        g.globalAlpha = 1;
        dish(g, s * 0.5, s * 0.74, s * 0.3, 'burnt');
        // A flame tongue.
        g.fillStyle = C.red;
        g.beginPath();
        g.moveTo(s * 0.5, s * 0.46);
        g.quadraticCurveTo(s * 0.57, s * 0.55, s * 0.54, s * 0.62);
        g.lineTo(s * 0.46, s * 0.62);
        g.quadraticCurveTo(s * 0.43, s * 0.54, s * 0.5, s * 0.46);
        g.fill();
        g.fillStyle = C.tomato;
        g.beginPath();
        g.moveTo(s * 0.5, s * 0.52);
        g.quadraticCurveTo(s * 0.53, s * 0.58, s * 0.51, s * 0.62);
        g.lineTo(s * 0.48, s * 0.62);
        g.quadraticCurveTo(s * 0.47, s * 0.57, s * 0.5, s * 0.52);
        g.fill();
      },
    },
    {
      key: 'R', label: 'dinner is served', name: 'Dinner Is Served', range: 0, cooldown: 24,
      blurb: 'An 8 m table rises in front of her for 5 s: real cover, 150 HP, with three dishes on it. Whoever stands at it for 1 s eats them: +25% damage for 5 s, and for her 50 HP.',
      icon(g, s) {
        iconGround(g, s);
        g.fillStyle = 'rgba(0,0,0,0.4)';
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.9, s * 0.47, s * 0.07, 0, 0, Math.PI * 2);
        g.fill();
        table(g, s * 0.06, s * 0.94, s * 0.56, s * 0.34);
        cloche(g, s * 0.24, s * 0.56, s * 0.1);
        cloche(g, s * 0.5, s * 0.56, s * 0.12);
        cloche(g, s * 0.76, s * 0.56, s * 0.1, true);
        // Candle flames at both ends, steam over the open plate, and the floor cracking where the table rises.
        g.fillStyle = C.tomato;
        for (const x of [0.1, 0.9]) {
          g.fillRect(s * (x - 0.012), s * 0.4, s * 0.024, s * 0.16);
          g.beginPath();
          g.moveTo(s * x, s * 0.3);
          g.quadraticCurveTo(s * (x + 0.035), s * 0.37, s * x, s * 0.4);
          g.quadraticCurveTo(s * (x - 0.035), s * 0.37, s * x, s * 0.3);
          g.fill();
        }
        g.lineCap = 'round';
        g.strokeStyle = C.core;
        g.lineWidth = s * 0.02;
        g.globalAlpha = 0.85;
        for (const x of [0.72, 0.8]) {
          g.beginPath();
          g.moveTo(s * x, s * 0.5);
          g.bezierCurveTo(s * (x + 0.05), s * 0.4, s * (x - 0.05), s * 0.32, s * x, s * 0.2);
          g.stroke();
        }
        g.globalAlpha = 1;
        g.strokeStyle = C.red;
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.moveTo(s * 0.3, s * 0.96);
        g.lineTo(s * 0.4, s * 0.9);
        g.lineTo(s * 0.46, s * 0.96);
        g.stroke();
      },
    },
  ],
};
