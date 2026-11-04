import type { HeroKit } from '../heroes';

/**
 * Yarn kit data: Grandma Ironknit (kits v5, new hero). Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * a dark wine ground, rose wool, pale horn needles and a little cream. Signature shape: a ball of wool with a strand pulled out and a
 * long needle through it.
 */
const S = {
  core: '#fff0f6', hot: '#ff9cc4', pink: '#e86a9a', shade: '#a73b69', wine: '#7a2a4c', foil: '#c8c0a8', cream: '#f2e6d0', dark: '#1e0c18', grey: '#9a9aa6',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#4a1e3a');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A strand of wool along a quadratic curve: a dark band, the rose strand, a pale core. */
function strand(g: CanvasRenderingContext2D, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, w: number, tint = S.pink) {
  g.lineCap = 'round';
  const path = () => { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); };
  g.strokeStyle = S.dark; g.lineWidth = w * 1.7; path(); g.stroke();
  g.strokeStyle = tint; g.lineWidth = w; path(); g.stroke();
  g.strokeStyle = S.hot; g.lineWidth = w * 0.35; g.globalAlpha = 0.8; path(); g.stroke();
  g.globalAlpha = 1;
}

/** A ball of wool at (cx,cy), radius r: slanted bands of rose wool in a dark outline. */
function ball(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.fillStyle = S.dark;
  g.beginPath(); g.arc(cx, cy, r * 1.12, 0, Math.PI * 2); g.fill();
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  g.fillStyle = S.pink; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.lineWidth = r * 0.2;
  for (let i = -4; i < 6; i++) {
    g.strokeStyle = i % 3 === 0 ? S.hot : i % 3 === 1 ? S.shade : S.pink;
    g.beginPath(); g.moveTo(cx - r + i * r * 0.4, cy - r); g.lineTo(cx - r * 0.2 + i * r * 0.4, cy + r); g.stroke();
  }
  g.strokeStyle = S.cream; g.lineWidth = r * 0.1;
  g.beginPath(); g.moveTo(cx - r, cy - r * 0.1); g.quadraticCurveTo(cx, cy + r * 0.3, cx + r, cy - r * 0.2); g.stroke();
  g.restore();
}

/** A long needle from (x1,y1) (the knob) to (x2,y2) (the point). */
function needle(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  g.lineCap = 'round';
  g.strokeStyle = S.dark; g.lineWidth = w * 1.8;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.strokeStyle = S.foil; g.lineWidth = w;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.strokeStyle = S.core; g.lineWidth = w * 0.3;
  g.beginPath(); g.moveTo(x1, y1 - w * 0.2); g.lineTo(x2, y2 - w * 0.2); g.stroke();
  g.fillStyle = S.dark; g.beginPath(); g.arc(x1, y1, w * 1.25, 0, Math.PI * 2); g.fill();
  g.fillStyle = S.pink; g.beginPath(); g.arc(x1, y1, w * 0.85, 0, Math.PI * 2); g.fill();
}

/** A small four-point glint. */
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number, c = S.core) {
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(x, y - r); g.lineTo(x + r * 0.22, y - r * 0.22); g.lineTo(x + r, y); g.lineTo(x + r * 0.22, y + r * 0.22);
  g.lineTo(x, y + r); g.lineTo(x - r * 0.22, y + r * 0.22); g.lineTo(x - r, y); g.lineTo(x - r * 0.22, y - r * 0.22);
  g.closePath(); g.fill();
}

/** A knot: a little tied bundle of wool. */
function knot(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = S.dark; g.beginPath(); g.arc(x, y, r * 1.35, 0, Math.PI * 2); g.fill();
  g.fillStyle = S.pink; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = S.hot; g.lineWidth = r * 0.35;
  g.beginPath(); g.arc(x, y, r * 0.55, 0.3, 4); g.stroke();
}

/** A grey cat's head at (cx,cy), `r` its radius: two ears, yellow eyes, a pink nose, whiskers. */
function catHead(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const ears = (k: number, fill: string) => {
    g.fillStyle = fill;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + sx * r * 0.95 * k, cy - r * 0.15);
      g.lineTo(cx + sx * r * 0.75 * k, cy - r * 1.35 * k);
      g.lineTo(cx + sx * r * 0.2, cy - r * 0.8);
      g.closePath(); g.fill();
    }
  };
  ears(1.16, S.dark);
  g.fillStyle = S.dark; g.beginPath(); g.ellipse(cx, cy, r * 1.14, r * 0.98, 0, 0, Math.PI * 2); g.fill();
  ears(1, S.grey);
  g.fillStyle = S.pink;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + sx * r * 0.78, cy - r * 0.35);
    g.lineTo(cx + sx * r * 0.66, cy - r * 1.05);
    g.lineTo(cx + sx * r * 0.34, cy - r * 0.7);
    g.closePath(); g.fill();
  }
  g.fillStyle = S.grey; g.beginPath(); g.ellipse(cx, cy, r, r * 0.86, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6a6a76';
  for (const dx of [-0.3, 0, 0.3]) g.fillRect(cx + r * dx - r * 0.04, cy - r * 0.85, r * 0.08, r * 0.3);
  for (const sx of [-1, 1]) {
    g.fillStyle = '#d8e04a'; g.beginPath(); g.ellipse(cx + sx * r * 0.38, cy - r * 0.08, r * 0.2, r * 0.17, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = S.dark; g.fillRect(cx + sx * r * 0.38 - r * 0.03, cy - r * 0.24, r * 0.06, r * 0.32);
  }
  g.fillStyle = S.pink;
  g.beginPath(); g.moveTo(cx - r * 0.1, cy + r * 0.18); g.lineTo(cx + r * 0.1, cy + r * 0.18); g.lineTo(cx, cy + r * 0.3); g.closePath(); g.fill();
  g.strokeStyle = S.cream; g.lineWidth = Math.max(1, r * 0.04);
  for (const sx of [-1, 1]) for (const dy of [0.2, 0.34]) { g.beginPath(); g.moveTo(cx + sx * r * 0.3, cy + r * dy); g.lineTo(cx + sx * r * 1.15, cy + r * (dy - 0.12 + (dy - 0.27))); g.stroke(); }
}

/** A knitted sweater at (cx,cy), `w` wide: body, sleeves, a cream stripe, a ribbed hem. */
function sweaterShape(g: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  const h = w * 0.95;
  const body = () => {
    g.beginPath();
    g.moveTo(cx - w * 0.28, cy - h * 0.5);
    g.lineTo(cx - w * 0.5, cy - h * 0.38);
    g.lineTo(cx - w * 0.62, cy + h * 0.12);
    g.lineTo(cx - w * 0.44, cy + h * 0.18);
    g.lineTo(cx - w * 0.34, cy - h * 0.02);
    g.lineTo(cx - w * 0.32, cy + h * 0.5);
    g.lineTo(cx + w * 0.32, cy + h * 0.5);
    g.lineTo(cx + w * 0.34, cy - h * 0.02);
    g.lineTo(cx + w * 0.44, cy + h * 0.18);
    g.lineTo(cx + w * 0.62, cy + h * 0.12);
    g.lineTo(cx + w * 0.5, cy - h * 0.38);
    g.lineTo(cx + w * 0.28, cy - h * 0.5);
    g.quadraticCurveTo(cx, cy - h * 0.34, cx - w * 0.28, cy - h * 0.5);
    g.closePath();
  };
  g.lineJoin = 'round';
  g.strokeStyle = S.dark; g.lineWidth = w * 0.09; body(); g.stroke();
  g.fillStyle = S.pink; body(); g.fill();
  g.save(); body(); g.clip();
  g.fillStyle = S.cream; g.fillRect(cx - w, cy - h * 0.06, w * 2, h * 0.11);
  g.fillStyle = S.wine; g.fillRect(cx - w, cy + h * 0.38, w * 2, h * 0.14);
  g.strokeStyle = S.hot; g.lineWidth = w * 0.025;
  for (let row = 0; row < 7; row++) {
    for (let col = -4; col <= 4; col++) {
      const x = cx + col * w * 0.12 + (row % 2) * w * 0.06, y = cy - h * 0.42 + row * h * 0.1;
      if (Math.abs(y - (cy - h * 0.0)) < h * 0.07) continue;
      g.beginPath(); g.moveTo(x - w * 0.035, y - w * 0.03); g.lineTo(x, y + w * 0.03); g.lineTo(x + w * 0.035, y - w * 0.03); g.stroke();
    }
  }
  g.restore();
  g.strokeStyle = S.wine; g.lineWidth = w * 0.07;
  g.beginPath(); g.ellipse(cx, cy - h * 0.44, w * 0.14, h * 0.07, 0, 0, Math.PI); g.stroke();
}

export const yarnKit: HeroKit = {
  name: 'Grandma Ironknit',
  maxHp: 620,
  title: 'the Knitter',
  accent: S.pink,
  foil: S.foil,
  portrait(g, s) {
    iconGround(g, s);
    // Loose strands of wool across the back and a ball in the corner.
    strand(g, 0, s * 0.3, s * 0.3, s * 0.5, s * 0.55, s * 0.2, s * 0.03);
    strand(g, s, s * 0.45, s * 0.7, s * 0.2, s * 0.6, s * 0.05, s * 0.03, S.hot);
    ball(g, s * 0.84, s * 0.78, s * 0.13);
    // A grey cat's head by her shoulder.
    catHead(g, s * 0.17, s * 0.82, s * 0.1);
    // Shoulders in a rose shawl with a darker fringe.
    g.fillStyle = S.dark;
    g.beginPath();
    g.moveTo(s * 0.1, s); g.quadraticCurveTo(s * 0.14, s * 0.68, s * 0.34, s * 0.6); g.quadraticCurveTo(s * 0.5, s * 0.55, s * 0.66, s * 0.6); g.quadraticCurveTo(s * 0.86, s * 0.68, s * 0.9, s);
    g.closePath(); g.fill();
    g.fillStyle = S.pink;
    g.beginPath();
    g.moveTo(s * 0.13, s); g.quadraticCurveTo(s * 0.17, s * 0.7, s * 0.35, s * 0.62); g.quadraticCurveTo(s * 0.5, s * 0.57, s * 0.65, s * 0.62); g.quadraticCurveTo(s * 0.83, s * 0.7, s * 0.87, s);
    g.closePath(); g.fill();
    g.strokeStyle = S.hot; g.lineWidth = s * 0.012;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(s * (0.2 + i * 0.12), s * (0.98 - Math.abs(i - 2.5) * 0.02)); g.lineTo(s * (0.2 + i * 0.12), s); g.stroke(); }
    g.strokeStyle = S.shade; g.lineWidth = s * 0.014;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(s * 0.3, s * (0.72 + i * 0.07)); g.quadraticCurveTo(s * 0.5, s * (0.76 + i * 0.07), s * 0.7, s * (0.72 + i * 0.07)); g.stroke(); }
    // A grey bun with two needles through it.
    g.fillStyle = S.dark; g.beginPath(); g.arc(s * 0.5, s * 0.13, s * 0.105, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#cfcfd8'; g.beginPath(); g.arc(s * 0.5, s * 0.13, s * 0.09, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#a8a8b4'; g.lineWidth = s * 0.012;
    g.beginPath(); g.arc(s * 0.5, s * 0.13, s * 0.055, 0.5, 4.5); g.stroke();
    needle(g, s * 0.34, s * 0.04, s * 0.7, s * 0.2, s * 0.018);
    needle(g, s * 0.66, s * 0.03, s * 0.3, s * 0.22, s * 0.018);
    // A kind round face, hair pulled back, big round glasses, a small smile.
    g.fillStyle = '#e8c9ae';
    g.beginPath(); g.ellipse(s * 0.5, s * 0.42, s * 0.15, s * 0.19, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#cfcfd8';
    g.beginPath(); g.ellipse(s * 0.5, s * 0.3, s * 0.16, s * 0.1, 0, Math.PI, Math.PI * 2); g.fill();
    g.fillStyle = '#d9a58e';
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(s * (0.5 + sx * 0.1), s * 0.5, s * 0.03, s * 0.02, 0, 0, Math.PI * 2); g.fill(); }
    for (const sx of [-1, 1]) {
      g.fillStyle = 'rgba(240,248,255,0.85)';
      g.beginPath(); g.arc(s * (0.5 + sx * 0.075), s * 0.4, s * 0.062, 0, Math.PI * 2); g.fill();
      g.strokeStyle = S.foil; g.lineWidth = s * 0.016; g.stroke();
      g.fillStyle = S.dark; g.beginPath(); g.arc(s * (0.5 + sx * 0.075), s * 0.405, s * 0.018, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = S.foil; g.lineWidth = s * 0.014;
    g.beginPath(); g.moveTo(s * 0.46, s * 0.395); g.quadraticCurveTo(s * 0.5, s * 0.375, s * 0.54, s * 0.395); g.stroke();
    g.strokeStyle = '#a45b6e'; g.lineWidth = s * 0.012;
    g.beginPath(); g.moveTo(s * 0.46, s * 0.5); g.quadraticCurveTo(s * 0.5, s * 0.535, s * 0.54, s * 0.5); g.stroke();
    glint(g, s * 0.3, s * 0.38, s * 0.03);
  },
  spells: [
    {
      key: 'Q', label: 'knitting needle', name: 'Knitting Needle', range: 9, cooldown: 3.5, aim: 'line',
      blurb: 'A needle as long as a sword (9 m, 22 m/s, 0.3 s wind-up): 62 damage. Step off its line.',
      icon(g, s) {
        iconGround(g, s);
        strand(g, s * 0.04, s * 0.9, s * 0.1, s * 0.62, s * 0.3, s * 0.66, s * 0.045);
        needle(g, s * 0.22, s * 0.82, s * 0.9, s * 0.2, s * 0.06);
        g.fillStyle = S.core;
        g.beginPath(); g.moveTo(s * 0.97, s * 0.14); g.lineTo(s * 0.86, s * 0.14); g.lineTo(s * 0.9, s * 0.25); g.closePath(); g.fill();
        glint(g, s * 0.82, s * 0.28, s * 0.07);
        glint(g, s * 0.2, s * 0.3, s * 0.045, S.hot);
      },
    },
    {
      key: 'W', label: 'cast on', name: 'Cast On', range: 9, cooldown: 0.6, summon: true,
      blurb: 'Two charges, one back every 6 s. She ties a line of yarn from her to the nearest cover the way you aim (9 m), or 9 m out into nothing. Three at most. Walk across one and you are stuck 0.4 s, then slowed 1 s. One hit cuts it.',
      icon(g, s) {
        iconGround(g, s);
        // Two pillars with a sagging line tied between them; a ball of wool on the floor.
        for (const x of [0.06, 0.8]) {
          g.fillStyle = S.dark; g.fillRect(s * (x - 0.02), s * 0.14, s * 0.2, s * 0.74);
          g.fillStyle = '#6a5a68'; g.fillRect(s * x, s * 0.16, s * 0.16, s * 0.7);
          g.fillStyle = '#8a7a88'; g.fillRect(s * x, s * 0.16, s * 0.04, s * 0.7);
        }
        strand(g, s * 0.2, s * 0.36, s * 0.5, s * 0.66, s * 0.8, s * 0.36, s * 0.07);
        knot(g, s * 0.2, s * 0.36, s * 0.05);
        knot(g, s * 0.8, s * 0.36, s * 0.05);
        ball(g, s * 0.5, s * 0.76, s * 0.14);
        glint(g, s * 0.5, s * 0.55, s * 0.06);
      },
    },
    {
      key: 'E', label: 'sweater', name: 'Sweater', range: 7, cooldown: 11,
      blurb: 'She throws a sweater on you (7 m, 0.5 s, needs sight when it lands): slowed 2 s, then it shrinks: 50 damage. Reach cover first.',
      icon(g, s) {
        iconGround(g, s);
        sweaterShape(g, s * 0.5, s * 0.5, s * 0.7);
        // It tightens: arrows squeeze in from both sides.
        g.fillStyle = S.core;
        for (const sx of [-1, 1]) {
          g.beginPath();
          g.moveTo(s * (0.5 + sx * 0.46), s * 0.82); g.lineTo(s * (0.5 + sx * 0.3), s * 0.76); g.lineTo(s * (0.5 + sx * 0.3), s * 0.88);
          g.closePath(); g.fill();
        }
        glint(g, s * 0.78, s * 0.2, s * 0.06);
      },
    },
    {
      key: 'R', label: 'mr biscuit', name: 'Mr. Biscuit', range: 0, cooldown: 24, summon: true,
      blurb: 'A big grey cat springs out of a ball of wool at her feet: 200 HP, 6 s, 4.5 m/s. He runs at you and sits on you: 25 damage a second and a slow. Shoot him, or lead him off: he stops to play with a cut line.',
      icon(g, s) {
        iconGround(g, s);
        strand(g, s * 0.04, s * 0.74, s * 0.3, s * 0.96, s * 0.58, s * 0.84, s * 0.05);
        catHead(g, s * 0.5, s * 0.42, s * 0.27);
        ball(g, s * 0.74, s * 0.82, s * 0.14);
        glint(g, s * 0.14, s * 0.2, s * 0.05, S.hot);
      },
    },
  ],
};
