import type { HeroKit } from '../heroes';

/**
 * Mime kit data: Mum, the mime (kits v5, new heroes). Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * a dark ink ground, chalk white, a mid grey smudge and one red from her scarf. Signature shape: the white glove, and dashed chalk
 * lines for what cannot be seen.
 */
const S = {
  chalk: '#f7f7f2', dim: '#cfcfc8', smudge: '#8d8d96', dark: '#20202a', ink: '#0c0c12', red: '#d23a3a', skin: '#fbfbf6',
  // the Silent One's mask, hood, coat, ribbon and gold trim (the _v3 model)
  mask: '#c8c6c0', hood: '#201b2a', coat: '#3c3452', ivory: '#c4bca6', ribbon: '#5c4a8c', gold: '#d2ae55', lilac: '#b8b4f4', lips: '#7a3a4c',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.8);
  r.addColorStop(0, '#34343f');
  r.addColorStop(1, S.ink);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
  // A few chalk smudges on the stone.
  g.fillStyle = 'rgba(247,247,242,0.05)';
  for (const [x, y, w] of [[0.2, 0.3, 0.2], [0.75, 0.7, 0.26], [0.55, 0.15, 0.14]]) {
    g.beginPath();
    g.ellipse(s * x, s * y, s * w, s * w * 0.4, 0.4, 0, Math.PI * 2);
    g.fill();
  }
}

/** A white glove centred at (cx,cy), `h` the palm's half-height, turned by `rot`; `curl` 0 open palm .. 1 fist. */
function glove(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, rot = 0, curl = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const outline = (draw: () => void) => {
    g.strokeStyle = S.ink;
    g.lineWidth = h * 0.3;
    draw();
    g.stroke();
    g.fillStyle = S.chalk;
    draw();
    g.fill();
  };
  // Cuff, palm, four fingers, thumb.
  g.fillStyle = S.dark;
  g.fillRect(-h * 0.7, h * 0.85, h * 1.4, h * 0.45);
  const fingers = 1 - curl * 0.72;
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * h * 0.4, top = -h * (0.7 + (i === 1 || i === 2 ? 0.28 : 0) * fingers) * (0.35 + 0.65 * fingers) - h * 0.25;
    outline(() => { g.beginPath(); g.roundRect(x - h * 0.18, top, h * 0.36, h * 1.1, h * 0.18); });
  }
  outline(() => { g.beginPath(); g.ellipse(0, h * 0.25, h * 0.85, h * 0.8, 0, 0, Math.PI * 2); });
  outline(() => { g.beginPath(); g.ellipse(h * 0.92, h * 0.2, h * 0.2, h * 0.45, -0.7 + curl * 0.6, 0, Math.PI * 2); });
  g.restore();
}

/** A dashed chalk line from (x1,y1) to (x2,y2). */
function chalkLine(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color = S.chalk, alpha = 0.9) {
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = w;
  g.setLineDash([w * 2.6, w * 1.9]);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  g.restore();
}

/** A tiny four-point chalk glint. */
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number, c = S.chalk) {
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

/** A red scarf tail fluttering from (x,y) toward the lower right. */
function scarf(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.fillStyle = S.red;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + s * 0.5, y - s * 0.12, x + s, y + s * 0.18);
  g.lineTo(x + s * 0.95, y + s * 0.34);
  g.quadraticCurveTo(x + s * 0.5, y + s * 0.08, x, y + s * 0.22);
  g.closePath();
  g.fill();
}

export const mimeKit: HeroKit = {
  name: 'Mum',
  title: 'the Silent One',
  maxHp: 620,
  accent: S.chalk,
  foil: S.dark,
  portrait(g, s) {
    iconGround(g, s);
    // The long dark violet ribbon flying behind her shoulder.
    g.fillStyle = S.ribbon;
    g.beginPath();
    g.moveTo(s * 0.62, s * 0.6);
    g.quadraticCurveTo(s * 0.84, s * 0.42, s * 0.88, s * 0.12);
    g.lineTo(s * 0.97, s * 0.16);
    g.quadraticCurveTo(s * 0.94, s * 0.5, s * 0.72, s * 0.72);
    g.closePath();
    g.fill();
    // Narrow shoulders in a dark violet coat with ivory diamonds, a gold edge.
    g.fillStyle = S.coat;
    g.beginPath();
    g.moveTo(s * 0.12, s);
    g.quadraticCurveTo(s * 0.16, s * 0.74, s * 0.34, s * 0.66);
    g.lineTo(s * 0.66, s * 0.66);
    g.quadraticCurveTo(s * 0.84, s * 0.74, s * 0.88, s);
    g.closePath();
    g.fill();
    g.fillStyle = S.ivory;
    for (const [x, y, r] of [[0.5, 0.8, 0.045], [0.5, 0.94, 0.05], [0.26, 0.86, 0.04], [0.74, 0.86, 0.04]]) {
      g.beginPath();
      g.moveTo(s * x, s * (y - r));
      g.lineTo(s * (x + r), s * y);
      g.lineTo(s * x, s * (y + r));
      g.lineTo(s * (x - r), s * y);
      g.closePath();
      g.fill();
    }
    // An ivory ruff at the throat.
    g.fillStyle = S.ivory;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.665, s * 0.17, s * 0.045, 0, 0, Math.PI * 2);
    g.fill();
    // The dark hood, and the porcelain mask: dark eyes with a pale glint, a gold diamond on the brow, gold tear lines.
    g.fillStyle = S.hood;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.4, s * 0.19, s * 0.27, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.mask;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.43, s * 0.135, s * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    for (const sx of [0.44, 0.56]) {
      g.fillStyle = S.dark;
      g.beginPath();
      g.ellipse(s * sx, s * 0.42, s * 0.03, s * 0.042, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.lilac;
      g.beginPath();
      g.arc(s * sx, s * 0.43, s * 0.014, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = S.gold;
      g.lineWidth = s * 0.007;
      g.beginPath();
      g.moveTo(s * sx, s * 0.465);
      g.lineTo(s * sx, s * 0.54);
      g.stroke();
    }
    g.fillStyle = S.gold;
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.285);
    g.lineTo(s * 0.53, s * 0.32);
    g.lineTo(s * 0.5, s * 0.355);
    g.lineTo(s * 0.47, s * 0.32);
    g.closePath();
    g.fill();
    g.strokeStyle = S.lips;
    g.lineWidth = s * 0.01;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 0.47, s * 0.545);
    g.quadraticCurveTo(s * 0.5, s * 0.555, s * 0.53, s * 0.545);
    g.stroke();
    // Her big pale glove raised before the coat, a gold cuff, a faint glow round it.
    const aura = g.createRadialGradient(s * 0.2, s * 0.72, s * 0.02, s * 0.2, s * 0.72, s * 0.2);
    aura.addColorStop(0, 'rgba(196,194,255,0.45)');
    aura.addColorStop(1, 'rgba(196,194,255,0)');
    g.fillStyle = aura;
    g.fillRect(0, s * 0.5, s * 0.45, s * 0.45);
    glove(g, s * 0.2, s * 0.72, s * 0.085, -0.15, 0);
    g.fillStyle = S.gold;
    g.fillRect(s * 0.14, s * 0.795, s * 0.12, s * 0.03);
    glint(g, s * 0.08, s * 0.5, s * 0.03, S.lilac);
  },
  spells: [
    {
      key: 'Q', label: 'invisible ball', name: 'Invisible Ball', range: 9, cooldown: 3.5, aim: 'line', passesOwnWalls: true,
      blurb: 'She throws a ball you cannot see (9 m, 22 m/s, 0.3 s wind-up): 72 damage. Only a chalk line on the floor shows where it goes. It passes her own walls.',
      icon(g, s) {
        iconGround(g, s);
        // The line on the floor, and a dotted outline where the ball is (nothing in it); a glove cocked at the lower left.
        chalkLine(g, s * 0.34, s * 0.78, s * 0.94, s * 0.22, s * 0.05);
        g.save();
        g.strokeStyle = S.chalk;
        g.globalAlpha = 0.55;
        g.lineWidth = s * 0.02;
        g.setLineDash([s * 0.025, s * 0.035]);
        g.beginPath();
        g.arc(s * 0.66, s * 0.5, s * 0.14, 0, Math.PI * 2);
        g.stroke();
        g.restore();
        glove(g, s * 0.24, s * 0.62, s * 0.13, -0.5, 0.85);
        glint(g, s * 0.82, s * 0.36, s * 0.05);
        glint(g, s * 0.5, s * 0.2, s * 0.03, S.smudge);
      },
    },
    {
      key: 'W', label: 'mime wall', name: 'Wall', range: 9, cooldown: 0.6, summon: true,
      blurb: 'Three charges, one back every 3 s. An invisible wall 4 m long at a spot (9 m), solid for both of you for 5 s, with only faint chalk on the floor. One hit of any size breaks it. Three at most.',
      icon(g, s) {
        iconGround(g, s);
        // A chalk wall line across the floor with end ticks, a faint shimmer above it, a flat glove pressed on it.
        for (let i = 0; i < 7; i++) {
          g.fillStyle = `rgba(247,247,242,${0.05 + 0.04 * (i % 2)})`;
          g.fillRect(s * (0.14 + i * 0.1), s * 0.18, s * 0.04, s * 0.6);
        }
        chalkLine(g, s * 0.1, s * 0.82, s * 0.9, s * 0.82, s * 0.055);
        for (const x of [0.1, 0.9]) {
          g.strokeStyle = S.chalk;
          g.lineWidth = s * 0.04;
          g.beginPath();
          g.moveTo(s * x, s * 0.74);
          g.lineTo(s * x, s * 0.9);
          g.stroke();
        }
        glove(g, s * 0.5, s * 0.46, s * 0.17, 0, 0);
        glint(g, s * 0.82, s * 0.28, s * 0.05);
      },
    },
    {
      key: 'E', label: 'rope trick', name: 'Rope Trick', range: 7, cooldown: 11,
      blurb: 'She mimes a rope to you (7 m, 0.5 s, needs sight when it lands): 55 damage and you are pulled 3 m toward her. Cover breaks it.',
      icon(g, s) {
        iconGround(g, s);
        // A dashed line pulled hand over hand toward the lower left, a red scarf tail, two gloves one above the other.
        chalkLine(g, s * 0.98, s * 0.2, s * 0.3, s * 0.72, s * 0.045);
        glove(g, s * 0.34, s * 0.42, s * 0.13, 0.5, 0.9);
        glove(g, s * 0.52, s * 0.66, s * 0.13, 0.5, 0.9);
        scarf(g, s * 0.1, s * 0.84, s * 0.34);
        glint(g, s * 0.82, s * 0.3, s * 0.05);
      },
    },
    {
      key: 'R', label: 'the box', name: 'Boxed In', range: 9, cooldown: 22,
      blurb: 'Four walls close round your spot (9 m, sight) after 0.8 s: 3 m wide, standing 3 s. She can shoot in; you cannot get out until you break one. Each takes one hit.',
      icon(g, s) {
        iconGround(g, s);
        // A chalk box drawn in the air: a square in perspective, a glove at each of two corners, a red corner mark.
        const pts: [number, number][] = [[0.24, 0.3], [0.76, 0.3], [0.76, 0.78], [0.24, 0.78]];
        for (let i = 0; i < 4; i++) {
          const a = pts[i], b = pts[(i + 1) % 4];
          chalkLine(g, s * a[0], s * a[1], s * b[0], s * b[1], s * 0.05, S.chalk, 0.95);
        }
        g.fillStyle = 'rgba(247,247,242,0.07)';
        g.fillRect(s * 0.27, s * 0.33, s * 0.46, s * 0.42);
        g.fillStyle = S.red;
        g.beginPath();
        g.arc(s * 0.76, s * 0.3, s * 0.035, 0, Math.PI * 2);
        g.fill();
        glove(g, s * 0.18, s * 0.5, s * 0.11, -0.25, 0);
        glove(g, s * 0.84, s * 0.56, s * 0.11, 0.25, 0);
        glint(g, s * 0.5, s * 0.54, s * 0.05, S.smudge);
      },
    },
  ],
};
