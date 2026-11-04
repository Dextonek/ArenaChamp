import type { HeroKit } from '../heroes';

/**
 * Courier kit data: Pip, the last courier (kits v5). Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * a deep postman's-blue ground, brown paper and string, cream envelopes, bright yellow and a little red. Signature shape: the
 * brown-paper parcel tied with string, a red FRAGILE sticker on its front.
 */
const K = {
  core: '#fff6dc', paper: '#e6d6ac', cream: '#eee3c4', brown: '#b98a52', brownDark: '#7a5230', string: '#e4d49c', dark: '#141c30',
  accent: '#ffd24a', foil: '#3a6ac8', blueDark: '#24427e', blueLight: '#8fb0ee', red: '#d9463a', skin: '#f0c8a0',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#2a427a');
  r.addColorStop(1, K.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A parcel centred at (cx, cy), `w` wide, turned by `rot`: dark outline, brown paper, string both ways with a bow, a red sticker. */
function parcel(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, rot = 0, sticker = true) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const h = w * 0.72;
  g.fillStyle = K.dark;
  g.fillRect(-w / 2 - w * 0.05, -h / 2 - w * 0.05, w * 1.1, h + w * 0.1);
  g.fillStyle = K.brown;
  g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle = K.brownDark;
  g.fillRect(-w / 2, h / 2 - h * 0.16, w, h * 0.16);
  g.fillStyle = K.string;
  g.fillRect(-w * 0.05, -h / 2, w * 0.1, h);
  g.fillRect(-w / 2, -h * 0.05, w, h * 0.1);
  g.beginPath();
  g.moveTo(0, -h * 0.05);
  g.lineTo(-w * 0.2, -h * 0.3);
  g.lineTo(-w * 0.02, -h * 0.2);
  g.moveTo(0, -h * 0.05);
  g.lineTo(w * 0.2, -h * 0.3);
  g.lineTo(w * 0.02, -h * 0.2);
  g.fill();
  if (sticker) {
    g.fillStyle = K.dark;
    g.fillRect(-w * 0.43, h * 0.02, w * 0.38, h * 0.3);
    g.fillStyle = K.red;
    g.fillRect(-w * 0.41, h * 0.05, w * 0.34, h * 0.24);
    g.fillStyle = K.cream;
    g.fillRect(-w * 0.36, h * 0.12, w * 0.24, h * 0.04);
    g.fillRect(-w * 0.36, h * 0.2, w * 0.16, h * 0.04);
  }
  g.restore();
}

/** An airmail envelope centred at (cx, cy), `w` wide, turned by `rot`: cream with a blue and red border, a V flap, a red seal. */
function envelope(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, rot = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const h = w * 0.68;
  g.fillStyle = K.dark;
  g.fillRect(-w / 2 - w * 0.06, -h / 2 - w * 0.06, w * 1.12, h + w * 0.12);
  g.fillStyle = K.cream;
  g.fillRect(-w / 2, -h / 2, w, h);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? K.red : K.foil;
    g.fillRect(-w / 2 + (i * w) / 8, -h / 2, w / 8, h * 0.1);
    g.fillRect(-w / 2 + (i * w) / 8, h / 2 - h * 0.1, w / 8, h * 0.1);
  }
  g.fillStyle = K.paper;
  g.beginPath();
  g.moveTo(-w / 2, -h / 2 + h * 0.1);
  g.lineTo(w / 2, -h / 2 + h * 0.1);
  g.lineTo(0, h * 0.12);
  g.closePath();
  g.fill();
  g.strokeStyle = K.brownDark;
  g.lineWidth = w * 0.015;
  g.stroke();
  g.fillStyle = K.red;
  g.beginPath();
  g.arc(0, h * 0.06, w * 0.07, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = K.accent;
  g.fillRect(w * 0.27, h * 0.14, w * 0.14, h * 0.22);
  g.restore();
}

/** A paper streak: a pale rounded bar from (x1, y1) to (x2, y2). */
function streak(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, c = K.paper) {
  g.lineCap = 'round';
  g.strokeStyle = c;
  g.globalAlpha = 0.75;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  g.globalAlpha = 1;
}

/** A small four-point glint. */
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number, c = K.core) {
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

export const courierKit: HeroKit = {
  name: 'Pip',
  maxHp: 580,
  title: 'the last courier',
  accent: K.accent,
  foil: K.foil,
  portrait(g, s) {
    iconGround(g, s);
    // The enormous bag behind him: brown leather, a yellow strap, a flap with a buckle.
    g.fillStyle = K.dark;
    g.fillRect(s * 0.02, s * 0.5, s * 0.52, s * 0.5);
    g.fillStyle = K.brown;
    g.fillRect(s * 0.05, s * 0.53, s * 0.46, s * 0.47);
    g.fillStyle = K.brownDark;
    g.beginPath();
    g.moveTo(s * 0.05, s * 0.53);
    g.lineTo(s * 0.51, s * 0.53);
    g.lineTo(s * 0.51, s * 0.64);
    g.lineTo(s * 0.28, s * 0.72);
    g.lineTo(s * 0.05, s * 0.64);
    g.closePath();
    g.fill();
    g.fillStyle = K.accent;
    g.fillRect(s * 0.26, s * 0.7, s * 0.05, s * 0.06);
    // Envelopes poking out of the top.
    envelope(g, s * 0.16, s * 0.5, s * 0.2, -0.3);
    envelope(g, s * 0.37, s * 0.47, s * 0.2, 0.25);
    // His blue jacket and the bag's strap across it.
    g.fillStyle = K.foil;
    g.beginPath();
    g.moveTo(s * 0.4, s);
    g.quadraticCurveTo(s * 0.44, s * 0.72, s * 0.58, s * 0.66);
    g.quadraticCurveTo(s * 0.7, s * 0.62, s * 0.8, s * 0.66);
    g.quadraticCurveTo(s * 0.94, s * 0.74, s * 0.96, s);
    g.closePath();
    g.fill();
    g.strokeStyle = K.blueDark;
    g.lineWidth = s * 0.012;
    g.stroke();
    g.strokeStyle = K.accent;
    g.lineWidth = s * 0.035;
    g.beginPath();
    g.moveTo(s * 0.52, s * 0.62);
    g.lineTo(s * 0.5, s * 0.9);
    g.stroke();
    // Head: a thin, hurried face; a big nose; round cheeks.
    g.fillStyle = K.skin;
    g.beginPath();
    g.ellipse(s * 0.68, s * 0.46, s * 0.12, s * 0.15, 0.1, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.795, s * 0.5, s * 0.03, s * 0.04, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e89a86';
    g.beginPath();
    g.arc(s * 0.65, s * 0.52, s * 0.025, 0, Math.PI * 2);
    g.fill();
    // His eyes (wide, looking ahead) and a whistling little "o" mouth.
    g.fillStyle = K.core;
    g.beginPath();
    g.ellipse(s * 0.71, s * 0.43, s * 0.028, s * 0.034, 0, 0, Math.PI * 2);
    g.ellipse(s * 0.77, s * 0.43, s * 0.025, s * 0.032, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = K.dark;
    g.beginPath();
    g.arc(s * 0.72, s * 0.435, s * 0.013, 0, Math.PI * 2);
    g.arc(s * 0.775, s * 0.435, s * 0.012, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.74, s * 0.55, s * 0.015, 0, Math.PI * 2);
    g.fill();
    // The blue postman's cap with a yellow badge and a short peak.
    g.fillStyle = K.dark;
    g.beginPath();
    g.ellipse(s * 0.68, s * 0.34, s * 0.15, s * 0.1, 0.05, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = K.foil;
    g.beginPath();
    g.ellipse(s * 0.68, s * 0.34, s * 0.135, s * 0.09, 0.05, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = K.blueDark;
    g.fillRect(s * 0.545, s * 0.335, s * 0.29, s * 0.03);
    g.fillStyle = K.dark;
    g.fillRect(s * 0.75, s * 0.335, s * 0.13, s * 0.03);
    g.fillStyle = K.accent;
    g.beginPath();
    g.arc(s * 0.68, s * 0.3, s * 0.03, 0, Math.PI * 2);
    g.fill();
    // A letter in his raised hand, and a glint.
    g.fillStyle = K.skin;
    g.beginPath();
    g.arc(s * 0.9, s * 0.62, s * 0.035, 0, Math.PI * 2);
    g.fill();
    envelope(g, s * 0.86, s * 0.52, s * 0.18, 0.4);
    glint(g, s * 0.94, s * 0.34, s * 0.04);
    glint(g, s * 0.12, s * 0.3, s * 0.03, K.accent);
  },
  spells: [
    {
      key: 'Q', label: 'express letter', name: 'Express Letter', range: 8, cooldown: 3, aim: 'line',
      blurb: 'A letter flicked at the aim (8 m): 35 damage, +15 for each Charge he holds. He keeps them.',
      icon(g, s) {
        iconGround(g, s);
        streak(g, s * 0.04, s * 0.78, s * 0.5, s * 0.55, s * 0.045);
        streak(g, s * 0.02, s * 0.62, s * 0.4, s * 0.46, s * 0.03, K.blueLight);
        envelope(g, s * 0.62, s * 0.46, s * 0.46, -0.32);
        glint(g, s * 0.9, s * 0.2, s * 0.07, K.accent);
        glint(g, s * 0.16, s * 0.3, s * 0.04);
      },
    },
    {
      key: 'W', label: 'fragile', name: 'Fragile', range: 9, cooldown: 9,
      blurb: 'A parcel thrown at a spot (9 m). After 1 s it bursts, 2.5 m wide: 50 damage and a 1 s slow. Walk out of the ring.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = 'rgba(217,70,58,0.75)';
        g.lineWidth = s * 0.03;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.78, s * 0.4, s * 0.15, 0, 0, Math.PI * 2);
        g.stroke();
        parcel(g, s * 0.5, s * 0.5, s * 0.5, -0.12);
        // Scraps and stickers flying off it.
        g.fillStyle = K.red;
        g.fillRect(s * 0.1, s * 0.22, s * 0.16, s * 0.08);
        g.fillStyle = K.cream;
        g.fillRect(s * 0.78, s * 0.26, s * 0.1, s * 0.08);
        g.fillStyle = K.paper;
        g.fillRect(s * 0.82, s * 0.62, s * 0.09, s * 0.06);
        glint(g, s * 0.82, s * 0.14, s * 0.06, K.accent);
      },
    },
    {
      key: 'E', label: 'shortcut', name: 'Shortcut', range: 6, cooldown: 9, dash: true, escape: true,
      blurb: 'A sprint of up to 6 m. With a Charge he spends one and Shortcut is ready again almost at once.',
      icon(g, s) {
        iconGround(g, s);
        // Three speed streaks and a dashed route, a tumbling envelope behind.
        streak(g, s * 0.06, s * 0.3, s * 0.52, s * 0.3, s * 0.05);
        streak(g, s * 0.02, s * 0.5, s * 0.6, s * 0.5, s * 0.06, K.accent);
        streak(g, s * 0.1, s * 0.7, s * 0.5, s * 0.7, s * 0.04, K.blueLight);
        g.fillStyle = K.accent;
        for (let i = 0; i < 4; i++) g.fillRect(s * (0.1 + i * 0.1), s * 0.86, s * 0.06, s * 0.035);
        // A running sock-and-shoe: a yellow arrow head.
        g.fillStyle = K.accent;
        g.beginPath();
        g.moveTo(s * 0.96, s * 0.5);
        g.lineTo(s * 0.64, s * 0.26);
        g.lineTo(s * 0.72, s * 0.5);
        g.lineTo(s * 0.64, s * 0.74);
        g.closePath();
        g.fill();
        g.strokeStyle = K.dark;
        g.lineWidth = s * 0.02;
        g.stroke();
        envelope(g, s * 0.3, s * 0.18, s * 0.24, 0.5);
        glint(g, s * 0.88, s * 0.16, s * 0.05);
      },
    },
    {
      key: 'R', label: 'final delivery', name: 'Final Delivery', range: 6, cooldown: 24,
      blurb: 'Spends all his Charges. A parcel with your name hunts you for 1.5 s (5 m/s), then bursts: 80, +40 per Charge, within 2 m. Touch cover first and you sign for it: it goes back.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = 'rgba(217,70,58,0.8)';
        g.lineWidth = s * 0.03;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.74, s * 0.36, s * 0.14, 0, 0, Math.PI * 2);
        g.stroke();
        parcel(g, s * 0.5, s * 0.5, s * 0.58, 0.1, false);
        // The big label with a name, and SIGN HERE as a yellow band.
        g.fillStyle = K.dark;
        g.fillRect(s * 0.34, s * 0.42, s * 0.34, s * 0.2);
        g.fillStyle = K.cream;
        g.fillRect(s * 0.36, s * 0.44, s * 0.3, s * 0.16);
        g.fillStyle = K.dark;
        g.fillRect(s * 0.39, s * 0.47, s * 0.2, s * 0.03);
        g.fillRect(s * 0.39, s * 0.53, s * 0.14, s * 0.03);
        g.fillStyle = K.accent;
        g.fillRect(s * 0.14, s * 0.1, s * 0.5, s * 0.14);
        g.fillStyle = K.dark;
        g.font = `900 ${Math.round(s * 0.1)}px Impact, Arial Black, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('SIGN HERE', s * 0.39, s * 0.175, s * 0.46);
        streak(g, s * 0.04, s * 0.88, s * 0.3, s * 0.7, s * 0.04, K.paper);
        glint(g, s * 0.88, s * 0.3, s * 0.07, K.accent);
        glint(g, s * 0.82, s * 0.76, s * 0.04);
      },
    },
  ],
};
