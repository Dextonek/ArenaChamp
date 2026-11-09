import type { HeroKit } from '../heroes';
import { paintCloud, paintWeather } from '../effects/parts/weather';

/**
 * Weather kit data: Barry Cloudsley, the weatherman (new heroes, 17). Four spells (labels as registered), canvas-drawn icons in the
 * kit's palette: a deep blue ground, sky blue, sunshine yellow, cloud white and a storm grey. Signature shapes: a smiling cloud and
 * a weather card.
 */
const W = {
  core: '#ffffff', sky: '#6ac8ff', deep: '#2f5ea8', dark: '#16233b', sun: '#f4e65a', cloud: '#e4edf8', grey: '#7b8aa2', storm: '#4a5870', mint: '#b8f0d0',
  // the Sky Augur's coat and trim (the _v3 model)
  slate: '#303c54', panel: '#4a8ac4', gold: '#d2ae55',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createLinearGradient(0, 0, 0, s);
  r.addColorStop(0, '#2c5a9c');
  r.addColorStop(1, W.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A gust: a few white curls running to the right, each ending in a small hook. */
function gust(g: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, tint = W.core) {
  g.strokeStyle = tint;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + len * 0.72, y);
  g.arc(x + len * 0.72, y - len * 0.14, len * 0.14, Math.PI / 2, -Math.PI * 0.95, true);
  g.stroke();
}

/** A jagged yellow bolt from (x, y0) to (x, y1), `w` wide. */
function bolt(g: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number) {
  const h = y1 - y0;
  g.beginPath();
  g.moveTo(x + w * 0.2, y0);
  g.lineTo(x - w * 0.55, y0 + h * 0.5);
  g.lineTo(x - w * 0.05, y0 + h * 0.46);
  g.lineTo(x - w * 0.35, y1);
  g.lineTo(x + w * 0.6, y0 + h * 0.4);
  g.lineTo(x + w * 0.1, y0 + h * 0.44);
  g.lineTo(x + w * 0.5, y0);
  g.closePath();
  g.fillStyle = W.sun;
  g.fill();
  g.strokeStyle = W.core;
  g.lineWidth = w * 0.08;
  g.stroke();
}

export const weatherKit: HeroKit = {
  name: 'Barry Cloudsley',
  maxHp: 610,
  title: 'the Sky Augur',
  accent: W.sky,
  foil: W.sun,
  portrait(g, s) {
    // A storm sky behind him, rain slanting across it.
    const sky = g.createLinearGradient(0, 0, 0, s);
    sky.addColorStop(0, '#3a5a86');
    sky.addColorStop(1, W.dark);
    g.fillStyle = sky;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(200,225,255,0.14)';
    g.lineWidth = s * 0.006;
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 37) % 100) / 100, y = 0.05 + ((i * 13) % 7) * 0.06;
      g.beginPath();
      g.moveTo(s * x, s * y);
      g.lineTo(s * (x - 0.06), s * (y + 0.15));
      g.stroke();
    }
    // The storm-slate coat: broad shoulders, a sky-blue front panel with gold edges and buttons.
    g.fillStyle = W.slate;
    g.beginPath();
    g.moveTo(s * 0.06, s);
    g.quadraticCurveTo(s * 0.1, s * 0.7, s * 0.32, s * 0.63);
    g.quadraticCurveTo(s * 0.5, s * 0.6, s * 0.68, s * 0.63);
    g.quadraticCurveTo(s * 0.9, s * 0.7, s * 0.94, s);
    g.closePath();
    g.fill();
    g.fillStyle = W.panel;
    g.fillRect(s * 0.44, s * 0.64, s * 0.12, s * 0.36);
    g.strokeStyle = W.gold;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(s * 0.44, s * 0.64);
    g.lineTo(s * 0.44, s);
    g.moveTo(s * 0.56, s * 0.64);
    g.lineTo(s * 0.56, s);
    g.stroke();
    g.fillStyle = W.gold;
    for (const y of [0.76, 0.85, 0.94]) {
      g.beginPath();
      g.arc(s * 0.5, s * y, s * 0.014, 0, Math.PI * 2);
      g.fill();
    }
    // The high collar standing up behind his jaw, with a gold rim.
    g.fillStyle = '#1a2232';
    g.beginPath();
    g.moveTo(s * 0.33, s * 0.66);
    g.lineTo(s * 0.34, s * 0.5);
    g.quadraticCurveTo(s * 0.5, s * 0.6, s * 0.66, s * 0.5);
    g.lineTo(s * 0.67, s * 0.66);
    g.closePath();
    g.fill();
    g.strokeStyle = W.gold;
    g.lineWidth = s * 0.009;
    g.beginPath();
    g.moveTo(s * 0.34, s * 0.5);
    g.quadraticCurveTo(s * 0.5, s * 0.6, s * 0.66, s * 0.5);
    g.stroke();
    // The cloud mantle heaped on his shoulders: a storm-grey underside, then the cloud.
    const puffs = [[0.11, 0.75, 0.07], [0.19, 0.68, 0.08], [0.3, 0.645, 0.072], [0.7, 0.645, 0.072], [0.81, 0.68, 0.08], [0.89, 0.75, 0.07], [0.25, 0.76, 0.06], [0.75, 0.76, 0.06]];
    for (const [shade, lift, k] of [[W.storm, 0.015, 1], [W.cloud, 0, 0.88]] as const) {
      g.fillStyle = shade;
      for (const [x, y, r] of puffs) {
        g.beginPath();
        g.arc(s * x, s * (y + lift), s * r * k, 0, Math.PI * 2);
        g.fill();
      }
    }
    // The head: a calm, sure face under windswept hair.
    g.fillStyle = '#f2c9a4';
    g.fillRect(s * 0.46, s * 0.52, s * 0.08, s * 0.1);
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.42, s * 0.12, s * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#4e2c14';
    g.beginPath();
    g.moveTo(s * 0.37, s * 0.43);
    g.quadraticCurveTo(s * 0.34, s * 0.25, s * 0.5, s * 0.22);
    g.quadraticCurveTo(s * 0.62, s * 0.2, s * 0.74, s * 0.15);
    g.quadraticCurveTo(s * 0.69, s * 0.24, s * 0.65, s * 0.28);
    g.quadraticCurveTo(s * 0.67, s * 0.35, s * 0.63, s * 0.42);
    g.quadraticCurveTo(s * 0.6, s * 0.3, s * 0.5, s * 0.3);
    g.quadraticCurveTo(s * 0.42, s * 0.31, s * 0.39, s * 0.41);
    g.closePath();
    g.fill();
    for (const dx of [-0.045, 0.045]) {
      g.fillStyle = W.dark;
      g.beginPath();
      g.ellipse(s * (0.5 + dx), s * 0.41, s * 0.014, s * 0.02, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = W.sky;
      g.beginPath();
      g.arc(s * (0.504 + dx), s * 0.404, s * 0.006, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#3a2210';
    g.lineWidth = s * 0.009;
    g.beginPath();
    g.moveTo(s * 0.44, s * 0.375);
    g.lineTo(s * 0.48, s * 0.368);
    g.moveTo(s * 0.52, s * 0.368);
    g.lineTo(s * 0.56, s * 0.375);
    g.stroke();
    g.strokeStyle = '#a45b4a';
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(s * 0.46, s * 0.49);
    g.quadraticCurveTo(s * 0.5, s * 0.512, s * 0.54, s * 0.49);
    g.stroke();
    // The weathervane staff in front of his right shoulder: a dark shaft, the glowing orb in a gold ring, the arrow on top.
    g.strokeStyle = '#262c38';
    g.lineWidth = s * 0.022;
    g.beginPath();
    g.moveTo(s * 0.86, s);
    g.lineTo(s * 0.86, s * 0.28);
    g.stroke();
    const glow = g.createRadialGradient(s * 0.86, s * 0.2, 0, s * 0.86, s * 0.2, s * 0.13);
    glow.addColorStop(0, 'rgba(170,228,255,0.9)');
    glow.addColorStop(0.35, 'rgba(106,200,255,0.45)');
    glow.addColorStop(1, 'rgba(106,200,255,0)');
    g.fillStyle = glow;
    g.fillRect(s * 0.72, s * 0.06, s * 0.28, s * 0.28);
    g.fillStyle = '#c8eeff';
    g.beginPath();
    g.arc(s * 0.86, s * 0.2, s * 0.035, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = W.gold;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.arc(s * 0.86, s * 0.2, s * 0.072, 0, Math.PI * 2);
    g.moveTo(s * 0.86, s * 0.128);
    g.lineTo(s * 0.86, s * 0.07);
    g.moveTo(s * 0.78, s * 0.07);
    g.lineTo(s * 0.95, s * 0.07);
    g.stroke();
    g.fillStyle = W.gold;
    g.beginPath();
    g.moveTo(s * 0.755, s * 0.07);
    g.lineTo(s * 0.795, s * 0.048);
    g.lineTo(s * 0.795, s * 0.092);
    g.closePath();
    g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'cold front', name: 'Cold Front', range: 9, cooldown: 3.5, aim: 'line',
      blurb: 'A gust (9 m): 64 damage. In Rain it slows for 1.5 s. In Wind it knocks the target back further.',
      icon(g, s) {
        iconGround(g, s);
        // A wind-driven gust of white curls with a few ice-blue specks, and a small cloud puff at the head.
        gust(g, s * 0.06, s * 0.3, s * 0.7, s * 0.05, W.mint);
        gust(g, s * 0.02, s * 0.5, s * 0.9, s * 0.07);
        gust(g, s * 0.1, s * 0.7, s * 0.6, s * 0.05, W.sky);
        paintCloud(g, s * 0.78, s * 0.5, s * 0.2);
        g.fillStyle = W.core;
        for (const [x, y, r] of [[0.3, 0.14, 0.02], [0.52, 0.22, 0.015], [0.2, 0.85, 0.018], [0.6, 0.82, 0.02]]) {
          g.beginPath();
          g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          g.fill();
        }
      },
    },
    {
      key: 'W', label: 'lightning risk', name: 'Lightning Risk', range: 9, cooldown: 9,
      blurb: 'A cloud marks a spot (9 m): after 0.8 s lightning strikes it, 64 damage within 1.5 m.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = 'rgba(244,230,90,0.7)';
        g.lineWidth = s * 0.02;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.84, s * 0.34, s * 0.09, 0, 0, Math.PI * 2);
        g.stroke();
        bolt(g, s * 0.5, s * 0.34, s * 0.84, s * 0.3);
        paintCloud(g, s * 0.5, s * 0.26, s * 0.34, '#8794ac', W.storm);
        g.fillStyle = W.dark;
        for (const dx of [-0.07, 0.07]) {
          g.beginPath();
          g.ellipse(s * (0.5 + dx), s * 0.27, s * 0.014, s * 0.024, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = W.dark;
        g.lineWidth = s * 0.012;
        g.beginPath();
        g.arc(s * 0.5, s * 0.285, s * 0.06, 0.3, Math.PI - 0.3);
        g.stroke();
      },
    },
    {
      key: 'E', label: 'forecast update', name: 'Forecast Update', range: 0, cooldown: 12,
      blurb: 'The forecast changes now, to the other weather. It costs a Cold Front cooldown of 6 s. Cannot be cast in the last 0.6 s before a change.',
      icon(g, s) {
        iconGround(g, s);
        // A white weather card with a sun on it, and two round arrows chasing each other round it.
        g.fillStyle = '#f4f9ff';
        g.fillRect(s * 0.24, s * 0.26, s * 0.52, s * 0.48);
        g.strokeStyle = W.dark;
        g.lineWidth = s * 0.02;
        g.strokeRect(s * 0.24, s * 0.26, s * 0.52, s * 0.48);
        g.fillStyle = W.sun;
        g.fillRect(s * 0.24, s * 0.26, s * 0.52, s * 0.07);
        paintWeather(g, 1, s * 0.5, s * 0.52, s * 0.15);
        g.strokeStyle = W.sky;
        g.lineWidth = s * 0.05;
        g.lineCap = 'round';
        for (const k of [0, 1]) {
          const a0 = k * Math.PI + 0.35, a1 = a0 + 1.9;
          g.beginPath();
          g.arc(s * 0.5, s * 0.5, s * 0.4, a0, a1);
          g.stroke();
          const ex = s * 0.5 + Math.cos(a1) * s * 0.4, ey = s * 0.5 + Math.sin(a1) * s * 0.4;
          g.fillStyle = W.sky;
          g.beginPath();
          g.moveTo(ex + Math.cos(a1 + 1.57) * s * 0.07, ey + Math.sin(a1 + 1.57) * s * 0.07);
          g.lineTo(ex + Math.cos(a1) * s * 0.07 - Math.cos(a1 + 1.57) * s * 0.07 * 0.4, ey + Math.sin(a1) * s * 0.07 - Math.sin(a1 + 1.57) * s * 0.07 * 0.4);
          g.lineTo(ex - Math.cos(a1 + 1.57) * s * 0.07, ey - Math.sin(a1 + 1.57) * s * 0.07);
          g.closePath();
          g.fill();
        }
      },
    },
    {
      key: 'R', label: 'severe warning', name: 'Severe Warning', range: 9, cooldown: 24,
      blurb: 'A tornado at a spot (9 m): after a 1 s warning it walks at the enemy at 2.5 m/s for 4 s, 25 damage a second within 2 m. Walk away: you are faster.',
      icon(g, s) {
        iconGround(g, s);
        paintCloud(g, s * 0.5, s * 0.2, s * 0.4, '#8794ac', W.storm);
        // The funnel: stacked, narrowing, slightly slewed bars.
        for (let i = 0; i < 7; i++) {
          const u = i / 6, y = s * (0.3 + u * 0.55), w = s * (0.4 - u * 0.32), x = s * (0.5 + Math.sin(u * 2.4) * 0.05);
          g.fillStyle = i % 2 ? W.cloud : W.grey;
          g.beginPath();
          g.ellipse(x, y, w, s * 0.045, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = W.mint;
        for (const [x, y] of [[0.14, 0.52], [0.84, 0.46], [0.2, 0.74], [0.8, 0.7]]) {
          g.beginPath();
          g.ellipse(s * x, s * y, s * 0.03, s * 0.016, 0.6, 0, Math.PI * 2);
          g.fill();
        }
        // A yellow warning triangle in the corner.
        g.fillStyle = W.sun;
        g.beginPath();
        g.moveTo(s * 0.86, s * 0.64);
        g.lineTo(s * 0.97, s * 0.86);
        g.lineTo(s * 0.75, s * 0.86);
        g.closePath();
        g.fill();
        g.fillStyle = W.dark;
        g.fillRect(s * 0.855, s * 0.7, s * 0.02, s * 0.08);
        g.fillRect(s * 0.855, s * 0.8, s * 0.02, s * 0.025);
      },
    },
  ],
};
