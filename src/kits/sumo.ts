import type { HeroKit } from '../heroes';

/**
 * Sumo kit data: Big Yoko (new heroes). Four spells (labels as registered), canvas-drawn icons in the kit's palette: a dark warm
 * brown ground, the red belt, straw rope, warm skin and white salt. Signature shape: the straw-rope ring seen from the side, with a
 * pale line inside it.
 */
const S = {
  core: '#fff8ea', foil: '#f4ead0', red: '#e63a3a', shade: '#a42626', rope: '#d2ac5a', ropeDark: '#8a6a2c', sand: '#dcc58f',
  skin: '#e6b08a', skinShade: '#b97a56', dust: '#cdbb98', dark: '#1e1412',
};

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.8);
  r.addColorStop(0, '#4a2a22');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** The straw-rope ring seen from above at a tilt: an ellipse of twisted rope centred at (cx,cy). */
function ropeRing(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, w: number) {
  g.lineCap = 'round';
  g.strokeStyle = S.dark;
  g.lineWidth = w * 1.5;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = S.rope;
  g.lineWidth = w;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();
  // The twist: short dark ticks across the rope.
  g.strokeStyle = S.ropeDark;
  g.lineWidth = w * 0.28;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    g.beginPath();
    g.moveTo(x - Math.sin(a) * w * 0.4 - Math.cos(a) * w * 0.3, y + Math.cos(a) * w * 0.4 - Math.sin(a) * w * 0.3);
    g.lineTo(x + Math.sin(a) * w * 0.4 + Math.cos(a) * w * 0.3, y - Math.cos(a) * w * 0.4 + Math.sin(a) * w * 0.3);
    g.stroke();
  }
}

/** A salt crystal: a small pale diamond. */
function crystal(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = S.core;
  g.beginPath();
  g.moveTo(0, -r * 1.5);
  g.lineTo(r * 0.8, 0);
  g.lineTo(0, r * 1.5);
  g.lineTo(-r * 0.8, 0);
  g.closePath();
  g.fill();
  g.strokeStyle = S.dark;
  g.lineWidth = r * 0.25;
  g.stroke();
  g.restore();
}

/** An open hand, palm toward the viewer, centred at (cx,cy), `h` the palm's half-height, tilted by `rot`. */
function palm(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, rot = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const finger = (x: number, len: number, a: number) => {
    g.save();
    g.translate(x, -h * 0.7);
    g.rotate(a);
    for (const [c, w] of [[S.dark, h * 0.5], [S.skin, h * 0.36]] as const) {
      g.fillStyle = c;
      g.beginPath();
      g.roundRect(-w / 2, -len, w, len + h * 0.2, w / 2);
      g.fill();
    }
    g.restore();
  };
  finger(-h * 0.5, h * 1.0, -0.2);
  finger(-h * 0.17, h * 1.25, -0.06);
  finger(h * 0.17, h * 1.25, 0.06);
  finger(h * 0.5, h * 1.0, 0.2);
  g.save();
  g.translate(-h * 0.85, h * 0.1);
  g.rotate(-0.9);
  for (const [c, w] of [[S.dark, h * 0.5], [S.skin, h * 0.36]] as const) {
    g.fillStyle = c;
    g.beginPath();
    g.roundRect(-w / 2, -h * 0.9, w, h * 1.1, w / 2);
    g.fill();
  }
  g.restore();
  g.fillStyle = S.dark;
  g.beginPath();
  g.ellipse(0, 0, h * 0.95, h * 1.05, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.skin;
  g.beginPath();
  g.ellipse(0, 0, h * 0.82, h * 0.92, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.red;
  g.beginPath();
  g.arc(0, h * 0.1, h * 0.3, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Speed lines trailing from (x,y) back along `ang`, `n` of them. */
function streaks(g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, n: number, w: number, c = S.core) {
  g.lineCap = 'round';
  g.strokeStyle = c;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * w * 2.2;
    const sx = x + Math.cos(ang + Math.PI / 2) * off, sy = y + Math.sin(ang + Math.PI / 2) * off;
    g.lineWidth = w * (1 - Math.abs(i - (n - 1) / 2) * 0.18);
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + Math.cos(ang) * len * (1 - Math.abs(i - (n - 1) / 2) * 0.2), sy + Math.sin(ang) * len * (1 - Math.abs(i - (n - 1) / 2) * 0.2));
    g.stroke();
  }
}

export const sumoKit: HeroKit = {
  name: 'Big Yoko',
  maxHp: 840,
  melee: true,
  title: 'the Sumo',
  accent: S.red,
  foil: S.foil,
  portrait(g, s) {
    ground(g, s);
    // The rope ring behind him.
    ropeRing(g, s * 0.5, s * 0.92, s * 0.62, s * 0.2, s * 0.05);
    // Huge shoulders and arms, bare, and the red belt.
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.9, s * 0.5, s * 0.34, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = S.skin;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.92, s * 0.47, s * 0.31, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = S.skinShade;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.99, s * 0.3, s * 0.12, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = S.red;
    g.fillRect(s * 0.3, s * 0.93, s * 0.4, s * 0.07);
    g.fillStyle = S.shade;
    g.fillRect(s * 0.3, s * 0.93, s * 0.4, s * 0.012);
    // The topknot: a small bun on a dark oiled head.
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.17, s * 0.075, s * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(s * 0.47, s * 0.2, s * 0.06, s * 0.06);
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.34, s * 0.255, s * 0.25, 0, 0, Math.PI * 2);
    g.fill();
    // The face: round, wide, skin, a calm half-closed look and a small straight mouth.
    g.fillStyle = S.skin;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.4, s * 0.235, s * 0.235, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#efbf9c';
    g.beginPath();
    g.ellipse(s * 0.44, s * 0.35, s * 0.07, s * 0.045, -0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.skinShade;
    g.beginPath();
    g.ellipse(s * 0.33, s * 0.46, s * 0.05, s * 0.04, 0, 0, Math.PI * 2);
    g.ellipse(s * 0.67, s * 0.46, s * 0.05, s * 0.04, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = S.dark;
    g.lineWidth = s * 0.012;
    g.lineCap = 'round';
    for (const x of [0.4, 0.6]) {
      g.beginPath();
      g.moveTo(s * (x - 0.05), s * 0.395);
      g.quadraticCurveTo(s * x, s * 0.415, s * (x + 0.05), s * 0.395);
      g.stroke();
      g.beginPath();
      g.moveTo(s * (x - 0.055), s * 0.365);
      g.lineTo(s * (x + 0.055), s * 0.372 * (x < 0.5 ? 0.97 : 1.03) * 1.0);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.41);
    g.lineTo(s * 0.51, s * 0.45);
    g.lineTo(s * 0.49, s * 0.455);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.45, s * 0.52);
    g.lineTo(s * 0.55, s * 0.52);
    g.stroke();
    // A pinch of salt in the air.
    crystal(g, s * 0.86, s * 0.22, s * 0.025, 0.3);
    crystal(g, s * 0.78, s * 0.14, s * 0.018, -0.4);
    crystal(g, s * 0.9, s * 0.36, s * 0.016, 0.8);
  },
  spells: [
    {
      key: 'Q', label: 'palm strike', name: 'Palm Strike', range: 2.8, cooldown: 3,
      blurb: 'An open palm slaps the way he faces (2.8 m, 0.4 s): 40 damage, and you are shoved 3 m. A shove that takes you out of his ring is a ring-out.',
      icon(g, s) {
        ground(g, s);
        streaks(g, s * 0.5, s * 0.5, Math.PI, s * 0.42, 5, s * 0.03, S.dust);
        palm(g, s * 0.58, s * 0.52, s * 0.22, 0.2);
        // The impact star on the right.
        g.fillStyle = S.core;
        g.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2, r = i % 2 ? s * 0.06 : s * 0.13;
          g.lineTo(s * 0.85 + Math.cos(a) * r, s * 0.2 + Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
      },
    },
    {
      key: 'W', label: 'stomp', name: 'Stomp', range: 0, cooldown: 11,
      blurb: 'He stomps a new ring at his feet (0.5 s): 40 damage and slowed 1 s within 3 m. The ring is 5 m wide and stands 8 s: a push that takes you out of it is a ring-out.',
      icon(g, s) {
        ground(g, s);
        ropeRing(g, s * 0.5, s * 0.56, s * 0.42, s * 0.2, s * 0.06);
        // Cracks run out from the middle.
        g.lineCap = 'round';
        g.lineJoin = 'round';
        for (const [dx, dy] of [[-0.3, -0.1], [0.32, -0.08], [-0.2, 0.14], [0.22, 0.15], [0.02, -0.17]]) {
          g.strokeStyle = S.dark;
          g.lineWidth = s * 0.05;
          g.beginPath();
          g.moveTo(s * 0.5, s * 0.56);
          g.lineTo(s * (0.5 + dx * 0.45), s * (0.56 + dy * 0.2));
          g.lineTo(s * (0.5 + dx * 0.55), s * (0.56 + dy * 0.45));
          g.lineTo(s * (0.5 + dx), s * (0.56 + dy));
          g.stroke();
          g.strokeStyle = S.red;
          g.lineWidth = s * 0.02;
          g.stroke();
        }
        // A bare foot coming down on it.
        g.fillStyle = S.dark;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.3, s * 0.17, s * 0.2, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.skin;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.3, s * 0.145, s * 0.175, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.skinShade;
        for (let i = 0; i < 5; i++) {
          g.beginPath();
          g.arc(s * (0.4 + i * 0.05), s * 0.14 - Math.abs(i - 2) * s * 0.008, s * (i === 0 ? 0.03 : 0.024), 0, Math.PI * 2);
          g.fill();
        }
      },
    },
    {
      key: 'E', label: 'sumo charge', name: 'Charge', range: 6, cooldown: 10, dash: true,
      blurb: 'He runs 6 m down the aim (0.4 s wind-up, strip shown): the first enemy on it takes 40 and is carried along ahead of him. If that carries you out of his ring, it is a ring-out.',
      icon(g, s) {
        ground(g, s);
        streaks(g, s * 0.62, s * 0.5, Math.PI, s * 0.55, 5, s * 0.035, S.dust);
        streaks(g, s * 0.62, s * 0.5, Math.PI, s * 0.5, 3, s * 0.02, S.red);
        // A round shoulder, a belt and a bowed head, going right.
        g.fillStyle = S.dark;
        g.beginPath();
        g.ellipse(s * 0.68, s * 0.5, s * 0.25, s * 0.27, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.skin;
        g.beginPath();
        g.ellipse(s * 0.68, s * 0.5, s * 0.225, s * 0.245, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.red;
        g.fillRect(s * 0.52, s * 0.6, s * 0.34, s * 0.07);
        g.fillStyle = S.dark;
        g.beginPath();
        g.ellipse(s * 0.84, s * 0.4, s * 0.09, s * 0.1, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(s * 0.8, s * 0.31, s * 0.035, s * 0.025, 0, 0, Math.PI * 2);
        g.fill();
        // A ring line on the floor with the rope across it.
        ropeRing(g, s * 0.5, s * 0.9, s * 0.52, s * 0.1, s * 0.035);
      },
    },
    {
      key: 'R', label: 'salt throw', name: 'Salt Throw', range: 0, cooldown: 22,
      blurb: 'He throws a fistful of salt: a 6 m cone after 0.6 s blinds you for 1.5 s. His ring gets 2 m smaller for the rest of its life, and he is 30% faster for 4 s.',
      icon(g, s) {
        ground(g, s);
        ropeRing(g, s * 0.5, s * 0.84, s * 0.46, s * 0.14, s * 0.045);
        // A fist on the left and an arc of crystals thrown across.
        g.fillStyle = S.dark;
        g.beginPath();
        g.ellipse(s * 0.2, s * 0.6, s * 0.14, s * 0.12, 0.3, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.skin;
        g.beginPath();
        g.ellipse(s * 0.2, s * 0.6, s * 0.115, s * 0.1, 0.3, 0, Math.PI * 2);
        g.fill();
        const pts: [number, number, number][] = [];
        for (let i = 0; i < 17; i++) {
          const k = i / 16, spread = (i % 3 - 1) * 0.05;
          pts.push([0.3 + k * 0.62, 0.5 - Math.sin(k * Math.PI) * 0.34 + k * 0.24 + spread, 0.028 + 0.012 * ((i * 5) % 3)]);
        }
        for (const [x, y, r] of pts) crystal(g, s * x, s * y, s * r, x * 5);
        for (const [x, y] of [[0.5, 0.72], [0.66, 0.76], [0.82, 0.78]]) crystal(g, s * x, s * y, s * 0.02, x * 3);
      },
    },
  ],
};
