import type { HeroKit } from '../heroes';

/**
 * Cat kit data: Sir Whiskers, a cat knight (kits v5). Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * a warm dark brown ground, ginger fur, cream foil, bright steel and a red plume. Signature shape: a pointed-ear cat head in a helmet,
 * and three crossed claw strokes.
 */
const S = {
  core: '#fff6e0', foil: '#f4e6c8', body: '#e8a13a', warm: '#c9741f', dark: '#2a1608', plume: '#c8423a', steel: '#c4ced8', steelDark: '#7d8a98',
  clay: '#b5653a', clayDark: '#6e3a20', pink: '#ff9eb4',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#4a2c14');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A claw stroke from (x1,y1) to (x2,y2): a dark band under an amber band under a white core, tapering to a point at the end. */
function claw(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  const lens = (k: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x1, y1);
    g.quadraticCurveTo(x1 + dx * 0.3 + nx * w * k, y1 + dy * 0.3 + ny * w * k, x2, y2);
    g.quadraticCurveTo(x1 + dx * 0.3 - nx * w * k * 0.6, y1 + dy * 0.3 - ny * w * k * 0.6, x1, y1);
    g.fill();
  };
  lens(1.4, S.dark);
  lens(1, S.body);
  lens(0.4, S.core);
}

/** A cat head centred at (cx,cy), `r` its radius: ginger, pointed ears with pink insides, almond eyes, a small nose. */
function catHead(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, helmet = false) {
  for (const sx of [-1, 1]) {
    g.fillStyle = S.dark;
    g.beginPath();
    g.moveTo(cx + sx * r * 1.05, cy - r * 0.2);
    g.lineTo(cx + sx * r * 0.95, cy - r * 1.35);
    g.lineTo(cx + sx * r * 0.2, cy - r * 0.85);
    g.closePath();
    g.fill();
    g.fillStyle = S.body;
    g.beginPath();
    g.moveTo(cx + sx * r * 0.98, cy - r * 0.28);
    g.lineTo(cx + sx * r * 0.9, cy - r * 1.22);
    g.lineTo(cx + sx * r * 0.3, cy - r * 0.82);
    g.closePath();
    g.fill();
    g.fillStyle = S.pink;
    g.beginPath();
    g.moveTo(cx + sx * r * 0.88, cy - r * 0.45);
    g.lineTo(cx + sx * r * 0.84, cy - r * 1.0);
    g.lineTo(cx + sx * r * 0.45, cy - r * 0.78);
    g.closePath();
    g.fill();
  }
  g.fillStyle = S.dark;
  g.beginPath();
  g.ellipse(cx, cy, r * 1.08, r * 0.98, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.body;
  g.beginPath();
  g.ellipse(cx, cy, r, r * 0.9, 0, 0, Math.PI * 2);
  g.fill();
  // Tabby stripes on the brow, cream cheeks.
  g.strokeStyle = S.warm;
  g.lineWidth = r * 0.09;
  for (const k of [-0.18, 0, 0.18]) {
    g.beginPath();
    g.moveTo(cx + r * k, cy - r * 0.88);
    g.lineTo(cx + r * k * 0.8, cy - r * 0.5);
    g.stroke();
  }
  g.fillStyle = S.foil;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + sx * r * 0.42, cy + r * 0.34, r * 0.38, r * 0.3, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Eyes: bright almond slits, a pleased smile.
  for (const sx of [-1, 1]) {
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(cx + sx * r * 0.4, cy - r * 0.08, r * 0.2, r * 0.13, sx * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#9be37a';
    g.beginPath();
    g.ellipse(cx + sx * r * 0.4, cy - r * 0.08, r * 0.15, r * 0.09, sx * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.dark;
    g.fillRect(cx + sx * r * 0.4 - r * 0.02, cy - r * 0.16, r * 0.04, r * 0.16);
  }
  g.fillStyle = S.pink;
  g.beginPath();
  g.moveTo(cx - r * 0.08, cy + r * 0.12);
  g.lineTo(cx + r * 0.08, cy + r * 0.12);
  g.lineTo(cx, cy + r * 0.24);
  g.closePath();
  g.fill();
  g.strokeStyle = S.dark;
  g.lineWidth = r * 0.05;
  g.beginPath();
  g.moveTo(cx, cy + r * 0.24);
  g.quadraticCurveTo(cx - r * 0.1, cy + r * 0.38, cx - r * 0.24, cy + r * 0.3);
  g.moveTo(cx, cy + r * 0.24);
  g.quadraticCurveTo(cx + r * 0.1, cy + r * 0.38, cx + r * 0.24, cy + r * 0.3);
  g.stroke();
  if (helmet) {
    // A steel cap over the brow with a red plume and a shine.
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(cx, cy - r * 0.62, r * 0.78, r * 0.36, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = S.steel;
    g.beginPath();
    g.ellipse(cx, cy - r * 0.62, r * 0.7, r * 0.3, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.core;
    g.lineWidth = r * 0.05;
    g.beginPath();
    g.moveTo(cx - r * 0.4, cy - r * 0.74);
    g.quadraticCurveTo(cx - r * 0.2, cy - r * 0.9, cx + r * 0.05, cy - r * 0.9);
    g.stroke();
    g.fillStyle = S.dark;
    g.beginPath();
    g.moveTo(cx - r * 0.06, cy - r * 0.9);
    g.quadraticCurveTo(cx + r * 0.1, cy - r * 1.85, cx + r * 0.75, cy - r * 1.5);
    g.quadraticCurveTo(cx + r * 0.4, cy - r * 1.4, cx + r * 0.16, cy - r * 0.9);
    g.closePath();
    g.fill();
    g.fillStyle = S.plume;
    g.beginPath();
    g.moveTo(cx - r * 0.02, cy - r * 0.92);
    g.quadraticCurveTo(cx + r * 0.1, cy - r * 1.75, cx + r * 0.66, cy - r * 1.48);
    g.quadraticCurveTo(cx + r * 0.36, cy - r * 1.4, cx + r * 0.14, cy - r * 0.92);
    g.closePath();
    g.fill();
  }
}

/** A clay pot centred at (cx,cy), `h` tall, tilted by `rot`. */
function pot(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, rot = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const body = (grow: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-h * 0.3 - grow, -h * 0.5 - grow);
    g.quadraticCurveTo(-h * 0.62 - grow, -h * 0.05, -h * 0.3 - grow, h * 0.5 + grow);
    g.lineTo(h * 0.3 + grow, h * 0.5 + grow);
    g.quadraticCurveTo(h * 0.62 + grow, -h * 0.05, h * 0.3 + grow, -h * 0.5 - grow);
    g.closePath();
    g.fill();
  };
  body(h * 0.06, S.dark);
  body(0, S.clay);
  g.fillStyle = S.dark;
  g.fillRect(-h * 0.36, -h * 0.58, h * 0.72, h * 0.14);
  g.fillStyle = S.foil;
  g.fillRect(-h * 0.32, -h * 0.55, h * 0.64, h * 0.09);
  g.fillStyle = S.body;
  g.fillRect(-h * 0.5, h * 0.02, h, h * 0.09);
  // A cream paw print on its belly.
  g.fillStyle = S.foil;
  g.beginPath();
  g.ellipse(0, h * 0.28, h * 0.1, h * 0.08, 0, 0, Math.PI * 2);
  g.fill();
  for (const sx of [-0.14, -0.05, 0.05, 0.14]) {
    g.beginPath();
    g.arc(h * sx, h * 0.15, h * 0.035, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function pillar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.fillStyle = S.dark;
  g.fillRect(x - w * 0.55, y - h * 0.02, w * 1.1, h * 1.04);
  const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  gr.addColorStop(0, '#9a8a78');
  gr.addColorStop(1, '#5e5246');
  g.fillStyle = gr;
  g.fillRect(x - w / 2, y, w, h);
  g.fillStyle = S.foil;
  g.fillRect(x - w * 0.62, y - h * 0.05, w * 1.24, h * 0.07);
}

function heart(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string, crack = false) {
  const path = () => {
    g.beginPath();
    g.moveTo(cx, cy + r);
    g.bezierCurveTo(cx - r * 1.6, cy - r * 0.1, cx - r * 0.9, cy - r * 1.3, cx, cy - r * 0.5);
    g.bezierCurveTo(cx + r * 0.9, cy - r * 1.3, cx + r * 1.6, cy - r * 0.1, cx, cy + r);
    g.closePath();
  };
  path();
  g.lineWidth = r * 0.3;
  g.lineJoin = 'round';
  g.strokeStyle = S.dark;
  g.stroke();
  g.fillStyle = fill;
  g.fill();
  if (crack) {
    g.strokeStyle = S.dark;
    g.lineWidth = r * 0.2;
    g.lineJoin = 'miter';
    g.beginPath();
    g.moveTo(cx, cy - r * 0.5);
    g.lineTo(cx - r * 0.22, cy - r * 0.1);
    g.lineTo(cx + r * 0.2, cy + r * 0.18);
    g.lineTo(cx - r * 0.05, cy + r * 0.6);
    g.stroke();
  }
}

export const catKit: HeroKit = {
  name: 'Sir Whiskers',
  maxHp: 540,
  hpChunks: 9,
  melee: true,
  title: 'the Cat Knight',
  accent: '#e8a13a',
  foil: '#f4e6c8',
  portrait(g, s) {
    iconGround(g, s);
    // A cream halo of nine lives behind him, a steel pauldron and a red cloak at the shoulders.
    g.strokeStyle = 'rgba(244,230,200,0.35)';
    g.lineWidth = s * 0.012;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1.08 + (i / 8) * 0.84);
      g.beginPath();
      g.arc(s * 0.5 + Math.cos(a) * s * 0.36, s * 0.44 + Math.sin(a) * s * 0.36, s * 0.018, 0, Math.PI * 2);
      g.fillStyle = S.foil;
      g.fill();
    }
    g.fillStyle = S.plume;
    g.beginPath();
    g.moveTo(s * 0.08, s);
    g.quadraticCurveTo(s * 0.12, s * 0.68, s * 0.3, s * 0.62);
    g.lineTo(s * 0.7, s * 0.62);
    g.quadraticCurveTo(s * 0.88, s * 0.68, s * 0.92, s);
    g.closePath();
    g.fill();
    g.fillStyle = S.steel;
    g.beginPath();
    g.moveTo(s * 0.18, s);
    g.quadraticCurveTo(s * 0.2, s * 0.74, s * 0.34, s * 0.7);
    g.quadraticCurveTo(s * 0.5, s * 0.78, s * 0.66, s * 0.7);
    g.quadraticCurveTo(s * 0.8, s * 0.74, s * 0.82, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.dark;
    g.lineWidth = s * 0.012;
    g.stroke();
    g.strokeStyle = S.core;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(s * 0.26, s * 0.86);
    g.quadraticCurveTo(s * 0.28, s * 0.76, s * 0.38, s * 0.74);
    g.stroke();
    // A gorget, then the head with its helmet and plume.
    g.fillStyle = S.foil;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.7, s * 0.17, s * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    catHead(g, s * 0.5, s * 0.42, s * 0.23, true);
    // The small sword raised at the side.
    g.save();
    g.translate(s * 0.86, s * 0.6);
    g.rotate(0.35);
    g.fillStyle = S.dark;
    g.fillRect(-s * 0.03, -s * 0.34, s * 0.06, s * 0.38);
    g.fillStyle = S.steel;
    g.fillRect(-s * 0.018, -s * 0.33, s * 0.036, s * 0.35);
    g.fillStyle = S.body;
    g.fillRect(-s * 0.07, s * 0.03, s * 0.14, s * 0.025);
    g.restore();
  },
  spells: [
    {
      key: 'Q', label: 'scratch', name: 'Scratch', range: 2.5, cooldown: 3,
      blurb: 'A 2.5 m claw in front of him: 46 damage. His next attack within 2 s is ready at once.',
      icon(g, s) {
        iconGround(g, s);
        // Three crossed claw strokes with a spray of fur.
        claw(g, s * 0.1, s * 0.22, s * 0.88, s * 0.78, s * 0.1);
        claw(g, s * 0.1, s * 0.52, s * 0.92, s * 0.46, s * 0.1);
        claw(g, s * 0.18, s * 0.86, s * 0.82, s * 0.14, s * 0.1);
        g.fillStyle = S.foil;
        for (const [x, y, r] of [[0.82, 0.22, 0.025], [0.9, 0.64, 0.02], [0.2, 0.7, 0.022], [0.62, 0.9, 0.018]] as const) {
          g.beginPath();
          g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          g.fill();
        }
      },
    },
    {
      key: 'W', label: 'knock it over', name: 'Knock It Over', range: 9, cooldown: 9, cc: true,
      blurb: 'With cover within 4 m of him, a pot falls on the spot at 9 m after 0.7 s (1.5 m): 50 damage and a 0.5 s stun. In the open it does nothing.',
      icon(g, s) {
        iconGround(g, s);
        // A pillar on the left, a wobbling pot tipping off, a dark shadow with a cream rim on the floor below, a swiping paw.
        pillar(g, s * 0.2, s * 0.3, s * 0.2, s * 0.62);
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.beginPath();
        g.ellipse(s * 0.7, s * 0.86, s * 0.24, s * 0.07, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = S.foil;
        g.lineWidth = s * 0.014;
        g.stroke();
        g.strokeStyle = 'rgba(244,230,200,0.6)';
        g.lineWidth = s * 0.012;
        g.setLineDash([s * 0.03, s * 0.03]);
        g.beginPath();
        g.moveTo(s * 0.34, s * 0.28);
        g.quadraticCurveTo(s * 0.62, s * 0.0, s * 0.7, s * 0.62);
        g.stroke();
        g.setLineDash([]);
        pot(g, s * 0.68, s * 0.55, s * 0.3, 0.55);
        claw(g, s * 0.3, s * 0.3, s * 0.46, s * 0.18, s * 0.05);
        claw(g, s * 0.3, s * 0.38, s * 0.48, s * 0.3, s * 0.05);
      },
    },
    {
      key: 'E', label: 'pounce', name: 'Pounce', range: 7, cooldown: 8, dash: true,
      blurb: 'Spends the life he is on: leaps 7 m onto you for 60 damage, then cannot cast for 0.4 s. Not on his last life.',
      icon(g, s) {
        iconGround(g, s);
        // A leap arc from the lower left to a landing ring on the right, a cat head at the front, a cracked heart at the start.
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.beginPath();
        g.ellipse(s * 0.78, s * 0.84, s * 0.2, s * 0.06, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = S.body;
        g.lineWidth = s * 0.012;
        g.stroke();
        g.lineCap = 'round';
        g.strokeStyle = S.dark;
        g.lineWidth = s * 0.1;
        g.beginPath();
        g.moveTo(s * 0.1, s * 0.82);
        g.quadraticCurveTo(s * 0.38, s * 0.02, s * 0.72, s * 0.6);
        g.stroke();
        g.strokeStyle = S.body;
        g.lineWidth = s * 0.06;
        g.stroke();
        g.strokeStyle = S.core;
        g.lineWidth = s * 0.018;
        g.stroke();
        catHead(g, s * 0.74, s * 0.52, s * 0.14);
        heart(g, s * 0.18, s * 0.66, s * 0.07, S.plume, true);
      },
    },
    {
      key: 'R', label: 'land on my feet', name: 'Land on My Feet', range: 0, cooldown: 24, save: true,
      blurb: 'For 4 s, the next life he would lose is not lost: he lands on his feet and leaps 3 m away. His attacks are 30% faster until then.',
      icon(g, s) {
        iconGround(g, s);
        // A ring of nine tiny hearts round a cat's paw print, with a glowing floor ring.
        g.strokeStyle = 'rgba(244,230,200,0.5)';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.8, s * 0.38, s * 0.09, 0, 0, Math.PI * 2);
        g.stroke();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
          heart(g, s * (0.5 + Math.cos(a) * 0.37), s * (0.46 + Math.sin(a) * 0.37), s * 0.045, i < 8 ? S.plume : S.pink, false);
        }
        // The big paw.
        g.fillStyle = S.dark;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.58, s * 0.19, s * 0.15, 0, 0, Math.PI * 2);
        g.fill();
        for (const [x, y] of [[0.3, 0.38], [0.42, 0.28], [0.58, 0.28], [0.7, 0.38]] as const) {
          g.beginPath();
          g.ellipse(s * x, s * y, s * 0.075, s * 0.09, (x - 0.5) * 1.2, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = S.body;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.58, s * 0.16, s * 0.12, 0, 0, Math.PI * 2);
        g.fill();
        for (const [x, y] of [[0.3, 0.38], [0.42, 0.28], [0.58, 0.28], [0.7, 0.38]] as const) {
          g.beginPath();
          g.ellipse(s * x, s * y, s * 0.055, s * 0.07, (x - 0.5) * 1.2, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = S.foil;
        g.beginPath();
        g.ellipse(s * 0.46, s * 0.54, s * 0.05, s * 0.03, -0.5, 0, Math.PI * 2);
        g.fill();
      },
    },
  ],
};
