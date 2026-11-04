import type { HeroKit } from '../heroes';

/**
 * Balloon kit data: Professor Puff, balloon scientist (new heroes). Four spells (labels as registered), canvas-drawn icons in the kit's
 * palette: a dark plum ground, glossy pink rubber with a pale window highlight, pale foil, a brass pump. Signature shape: the pear-shaped
 * balloon with its knot and string.
 */
const S = {
  core: '#ffffff', hot: '#ffd2e3', body: '#ff8fb8', shade: '#c9507f', deep: '#8a2f5a', foil: '#fff1a8', sky: '#8fd8ff', brass: '#d9a441', dark: '#2a1424',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#4a2440');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A balloon centred at (cx,cy), `h` its half-height, with a dark outline, a pale window highlight, a knot and (when `string`) a string. */
function balloon(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, body = S.body, shade = S.shade, string = true) {
  const w = h * 0.86;
  const shape = (k: number) => {
    g.beginPath();
    g.moveTo(cx, cy - h * k);
    g.bezierCurveTo(cx + w * 1.25 * k, cy - h * k, cx + w * 1.05 * k, cy + h * 0.55 * k, cx + h * 0.05 * k, cy + h * k);
    g.bezierCurveTo(cx - w * 1.05 * k, cy + h * 0.55 * k, cx - w * 1.25 * k, cy - h * k, cx, cy - h * k);
    g.closePath();
  };
  if (string) {
    g.strokeStyle = S.dark;
    g.lineWidth = h * 0.2;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx, cy + h * 1.1);
    g.quadraticCurveTo(cx + h * 0.35, cy + h * 1.5, cx - h * 0.1, cy + h * 1.95);
    g.stroke();
    g.strokeStyle = '#f2e8d2';
    g.lineWidth = h * 0.08;
    g.stroke();
  }
  g.fillStyle = S.dark;
  shape(1.12);
  g.fill();
  const gr = g.createRadialGradient(cx - w * 0.35, cy - h * 0.4, h * 0.05, cx, cy, h * 1.1);
  gr.addColorStop(0, S.hot);
  gr.addColorStop(0.35, body);
  gr.addColorStop(1, shade);
  g.fillStyle = gr;
  shape(1);
  g.fill();
  // The knot, a small dark-edged triangle at the bottom.
  g.fillStyle = S.dark;
  g.beginPath();
  g.moveTo(cx - h * 0.2, cy + h * 1.2);
  g.lineTo(cx + h * 0.2, cy + h * 1.2);
  g.lineTo(cx + h * 0.02, cy + h * 0.92);
  g.closePath();
  g.fill();
  g.fillStyle = shade;
  g.beginPath();
  g.moveTo(cx - h * 0.13, cy + h * 1.15);
  g.lineTo(cx + h * 0.13, cy + h * 1.15);
  g.lineTo(cx + h * 0.02, cy + h * 0.97);
  g.closePath();
  g.fill();
  // The window highlight and a pinpoint glint.
  g.fillStyle = 'rgba(255,255,255,0.78)';
  g.beginPath();
  g.ellipse(cx - w * 0.42, cy - h * 0.42, w * 0.2, h * 0.3, -0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.core;
  g.beginPath();
  g.arc(cx - w * 0.18, cy - h * 0.74, h * 0.06, 0, Math.PI * 2);
  g.fill();
}

/** A thin ray with a white core. */
function ray(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, tint = S.hot) {
  g.lineCap = 'round';
  g.strokeStyle = tint;
  g.globalAlpha = 0.8;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  g.globalAlpha = 1;
  g.strokeStyle = S.core;
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

/** A soap-bubble ring with a glint. */
function bubble(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.strokeStyle = S.hot;
  g.lineWidth = r * 0.22;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = S.core;
  g.beginPath();
  g.arc(x - r * 0.4, y - r * 0.4, r * 0.18, 0, Math.PI * 2);
  g.fill();
}

export const balloonKit: HeroKit = {
  name: 'Professor Puff',
  maxHp: 560,
  title: 'balloon scientist',
  accent: S.body,
  foil: S.foil,
  portrait(g, s) {
    iconGround(g, s);
    // A bunch of balloons tied behind his shoulder.
    balloon(g, s * 0.24, s * 0.3, s * 0.15, S.body, S.shade);
    balloon(g, s * 0.78, s * 0.26, s * 0.14, S.foil, '#d9b84a');
    balloon(g, s * 0.5, s * 0.14, s * 0.12, S.sky, '#4f9fd0');
    // Shoulders in a white lab coat with a brass pump strap.
    g.fillStyle = '#ece6f0';
    g.beginPath();
    g.moveTo(s * 0.1, s);
    g.quadraticCurveTo(s * 0.14, s * 0.72, s * 0.34, s * 0.64);
    g.quadraticCurveTo(s * 0.5, s * 0.6, s * 0.66, s * 0.64);
    g.quadraticCurveTo(s * 0.86, s * 0.72, s * 0.9, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.dark;
    g.lineWidth = s * 0.012;
    g.stroke();
    g.fillStyle = S.brass;
    g.fillRect(s * 0.28, s * 0.66, s * 0.07, s * 0.34);
    g.fillRect(s * 0.65, s * 0.66, s * 0.07, s * 0.34);
    g.fillStyle = S.shade;
    g.beginPath();
    g.moveTo(s * 0.44, s * 0.64);
    g.lineTo(s * 0.5, s * 0.74);
    g.lineTo(s * 0.56, s * 0.64);
    g.closePath();
    g.fill();
    // A round head: a pink face, a tuft of hair, big goggles pushed up on the brow with brass rims.
    g.fillStyle = S.dark;
    g.beginPath();
    g.arc(s * 0.5, s * 0.48, s * 0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f6c6b4';
    g.beginPath();
    g.arc(s * 0.5, s * 0.48, s * 0.185, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c9d2de';
    g.beginPath();
    g.moveTo(s * 0.36, s * 0.4);
    g.quadraticCurveTo(s * 0.4, s * 0.24, s * 0.46, s * 0.3);
    g.quadraticCurveTo(s * 0.5, s * 0.2, s * 0.55, s * 0.3);
    g.quadraticCurveTo(s * 0.62, s * 0.24, s * 0.64, s * 0.4);
    g.closePath();
    g.fill();
    g.strokeStyle = S.brass;
    g.lineWidth = s * 0.035;
    g.beginPath();
    g.moveTo(s * 0.33, s * 0.4);
    g.lineTo(s * 0.67, s * 0.4);
    g.stroke();
    for (const sx of [0.42, 0.58]) {
      g.fillStyle = S.brass;
      g.beginPath();
      g.arc(s * sx, s * 0.46, s * 0.085, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#bfe8ff';
      g.beginPath();
      g.arc(s * sx, s * 0.46, s * 0.062, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.core;
      g.beginPath();
      g.arc(s * (sx - 0.02), s * 0.44, s * 0.016, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = S.dark;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.arc(s * 0.5, s * 0.54, s * 0.05, 0.2, Math.PI - 0.2);
    g.stroke();
    glint(g, s * 0.86, s * 0.5, s * 0.04);
  },
  spells: [
    {
      key: 'Q', label: 'air hose', name: 'Air Hose', range: 8, cooldown: 3.5, aim: 'line',
      blurb: 'A jet of air (8 m, 22 m/s, 0.3 s wind-up): 45 damage, 3 Air and a 1 m push. Each Air pushes it 8% farther.',
      icon(g, s) {
        iconGround(g, s);
        // A hose nozzle on the left blowing a jet and a small balloon rocketing out on it.
        g.fillStyle = S.dark;
        g.fillRect(s * 0.04, s * 0.5, s * 0.22, s * 0.2);
        g.fillStyle = S.brass;
        g.fillRect(s * 0.06, s * 0.53, s * 0.18, s * 0.14);
        g.fillStyle = S.dark;
        g.beginPath();
        g.moveTo(s * 0.26, s * 0.46);
        g.lineTo(s * 0.34, s * 0.42);
        g.lineTo(s * 0.34, s * 0.78);
        g.lineTo(s * 0.26, s * 0.74);
        g.closePath();
        g.fill();
        ray(g, s * 0.34, s * 0.52, s * 0.9, s * 0.4, s * 0.06);
        ray(g, s * 0.34, s * 0.62, s * 0.84, s * 0.62, s * 0.05, S.foil);
        ray(g, s * 0.34, s * 0.72, s * 0.9, s * 0.84, s * 0.05);
        bubble(g, s * 0.5, s * 0.34, s * 0.055);
        bubble(g, s * 0.64, s * 0.27, s * 0.04);
        balloon(g, s * 0.66, s * 0.5, s * 0.17, S.body, S.shade, false);
        glint(g, s * 0.9, s * 0.2, s * 0.05);
      },
    },
    {
      key: 'W', label: 'helium bomb', name: 'Helium Bomb', range: 9, cooldown: 9,
      blurb: 'A balloon floats to a spot (9 m) and pops after 1.0 s: 40 damage and 3 Air to everyone within 2.5 m.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = 'rgba(255,210,227,0.5)';
        g.lineWidth = s * 0.016;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.84, s * 0.4, s * 0.1, 0, 0, Math.PI * 2);
        g.stroke();
        balloon(g, s * 0.5, s * 0.4, s * 0.27, S.foil, '#d9b84a');
        // Four short pop strokes round it.
        for (const [dx, dy] of [[-0.42, -0.18], [0.42, -0.2], [-0.4, 0.28], [0.4, 0.3]]) {
          ray(g, s * (0.5 + dx * 0.72), s * (0.4 + dy * 0.72), s * (0.5 + dx), s * (0.4 + dy), s * 0.035, S.body);
        }
        glint(g, s * 0.84, s * 0.14, s * 0.05);
        glint(g, s * 0.14, s * 0.62, s * 0.04, S.body);
      },
    },
    {
      key: 'E', label: 'hot air', name: 'Hot Air', range: 9, cooldown: 10,
      blurb: 'He inflates and floats 6 m away from the spot you aim at. Anyone within 2.5 m of where he left is pushed 3 m.',
      icon(g, s) {
        iconGround(g, s);
        // A big balloon lifting a small round figure, with a ring on the ground where he left.
        g.strokeStyle = 'rgba(255,210,227,0.5)';
        g.lineWidth = s * 0.016;
        g.beginPath();
        g.ellipse(s * 0.28, s * 0.88, s * 0.2, s * 0.06, 0, 0, Math.PI * 2);
        g.stroke();
        balloon(g, s * 0.62, s * 0.34, s * 0.25, S.body, S.shade, false);
        g.strokeStyle = '#f2e8d2';
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.moveTo(s * 0.62, s * 0.66);
        g.lineTo(s * 0.55, s * 0.78);
        g.moveTo(s * 0.62, s * 0.66);
        g.lineTo(s * 0.7, s * 0.78);
        g.stroke();
        g.fillStyle = S.dark;
        g.beginPath();
        g.arc(s * 0.62, s * 0.84, s * 0.09, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#ece6f0';
        g.beginPath();
        g.arc(s * 0.62, s * 0.84, s * 0.07, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.brass;
        g.fillRect(s * 0.56, s * 0.82, s * 0.12, s * 0.03);
        bubble(g, s * 0.26, s * 0.62, s * 0.05);
        bubble(g, s * 0.16, s * 0.74, s * 0.035);
        ray(g, s * 0.38, s * 0.8, s * 0.5, s * 0.72, s * 0.035);
        glint(g, s * 0.9, s * 0.62, s * 0.045);
      },
    },
    {
      key: 'R', label: 'pop!', name: 'Pop!', range: 9, cooldown: 22,
      blurb: 'A pin flies at you (9 m, 0.6 s, it needs sight when it lands): 50 damage plus 20 per Air, and all your Air goes out in a 3 m shove.',
      icon(g, s) {
        iconGround(g, s);
        // A balloon bursting: scraps and a spiky star, with a brass pin coming in from the left.
        g.fillStyle = S.deep;
        g.beginPath();
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2, r = s * (i % 2 ? 0.2 : 0.4);
          g.lineTo(s * 0.58 + Math.cos(a) * r, s * 0.5 + Math.sin(a) * r * 0.9);
        }
        g.closePath();
        g.fill();
        g.fillStyle = S.body;
        g.beginPath();
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2, r = s * (i % 2 ? 0.16 : 0.33);
          g.lineTo(s * 0.58 + Math.cos(a) * r, s * 0.5 + Math.sin(a) * r * 0.9);
        }
        g.closePath();
        g.fill();
        g.fillStyle = S.hot;
        g.beginPath();
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + 0.2, r = s * (i % 2 ? 0.07 : 0.17);
          g.lineTo(s * 0.58 + Math.cos(a) * r, s * 0.5 + Math.sin(a) * r * 0.9);
        }
        g.closePath();
        g.fill();
        g.fillStyle = S.foil;
        for (const [x, y, r] of [[0.9, 0.22, 0.045], [0.88, 0.8, 0.04], [0.34, 0.16, 0.035], [0.3, 0.84, 0.04]]) {
          g.beginPath();
          g.moveTo(s * x, s * (y - r * 1.4));
          g.lineTo(s * (x + r), s * (y + r));
          g.lineTo(s * (x - r * 1.2), s * (y + r * 0.6));
          g.closePath();
          g.fill();
        }
        // The pin.
        g.strokeStyle = S.dark;
        g.lineWidth = s * 0.07;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(s * 0.1, s * 0.62);
        g.lineTo(s * 0.5, s * 0.5);
        g.stroke();
        g.strokeStyle = S.brass;
        g.lineWidth = s * 0.035;
        g.beginPath();
        g.moveTo(s * 0.1, s * 0.62);
        g.lineTo(s * 0.5, s * 0.5);
        g.stroke();
        g.fillStyle = S.body;
        g.beginPath();
        g.arc(s * 0.08, s * 0.63, s * 0.06, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.core;
        g.beginPath();
        g.arc(s * 0.065, s * 0.61, s * 0.016, 0, Math.PI * 2);
        g.fill();
        glint(g, s * 0.58, s * 0.5, s * 0.1);
      },
    },
  ],
};
