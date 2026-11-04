import type { HeroKit } from '../heroes';
import { paintCloud, paintWeather } from '../effects/parts/weather';

/**
 * Weather kit data: Barry Cloudsley, the weatherman (new heroes, 17). Four spells (labels as registered), canvas-drawn icons in the
 * kit's palette: a deep blue ground, sky blue, sunshine yellow, cloud white and a storm grey. Signature shapes: a smiling cloud and
 * a weather card.
 */
const W = {
  core: '#ffffff', sky: '#6ac8ff', deep: '#2f5ea8', dark: '#16233b', sun: '#f4e65a', cloud: '#e4edf8', grey: '#7b8aa2', storm: '#4a5870', mint: '#b8f0d0',
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
  title: 'the Weatherman',
  accent: W.sky,
  foil: W.sun,
  portrait(g, s) {
    // The weather map behind him: a sky blue board with a cloud, a sun and a wind curl stuck on it.
    const sky = g.createLinearGradient(0, 0, 0, s);
    sky.addColorStop(0, '#5aa7e8');
    sky.addColorStop(1, '#2c5a9c');
    g.fillStyle = sky;
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 1; i < 6; i++) g.fillRect(0, (s * i) / 6, s, s * 0.006);
    paintWeather(g, 1, s * 0.2, s * 0.2, s * 0.13);
    paintWeather(g, 0, s * 0.8, s * 0.22, s * 0.13);
    paintWeather(g, 2, s * 0.84, s * 0.55, s * 0.09);
    // The raincoat over one arm: yellow, with a dark hem.
    g.fillStyle = '#f0c93a';
    g.beginPath();
    g.moveTo(s * 0.02, s);
    g.lineTo(s * 0.04, s * 0.66);
    g.quadraticCurveTo(s * 0.12, s * 0.58, s * 0.26, s * 0.64);
    g.lineTo(s * 0.34, s);
    g.closePath();
    g.fill();
    g.strokeStyle = '#8a6a10';
    g.lineWidth = s * 0.01;
    g.stroke();
    // The blue suit: shoulders, a white shirt and a bad tie.
    g.fillStyle = W.deep;
    g.beginPath();
    g.moveTo(s * 0.1, s);
    g.quadraticCurveTo(s * 0.14, s * 0.7, s * 0.34, s * 0.62);
    g.quadraticCurveTo(s * 0.5, s * 0.58, s * 0.66, s * 0.62);
    g.quadraticCurveTo(s * 0.86, s * 0.7, s * 0.9, s);
    g.closePath();
    g.fill();
    g.fillStyle = '#f4f9ff';
    g.beginPath();
    g.moveTo(s * 0.4, s * 0.62);
    g.lineTo(s * 0.5, s * 0.78);
    g.lineTo(s * 0.6, s * 0.62);
    g.closePath();
    g.fill();
    g.fillStyle = '#ff7a3a';
    g.beginPath();
    g.moveTo(s * 0.47, s * 0.65);
    g.lineTo(s * 0.53, s * 0.65);
    g.lineTo(s * 0.55, s * 0.72);
    g.lineTo(s * 0.5, s * 0.96);
    g.lineTo(s * 0.45, s * 0.72);
    g.closePath();
    g.fill();
    g.strokeStyle = W.sun;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(s * 0.46, s * 0.72);
    g.lineTo(s * 0.54, s * 0.76);
    g.moveTo(s * 0.46, s * 0.8);
    g.lineTo(s * 0.54, s * 0.84);
    g.moveTo(s * 0.47, s * 0.88);
    g.lineTo(s * 0.53, s * 0.91);
    g.stroke();
    // The head: a broad smile of teeth, perfect hair in a swept wave.
    g.fillStyle = '#f2c9a4';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.42, s * 0.12, s * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#6b4a2a';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.33, s * 0.14, s * 0.12, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.36, s * 0.33);
    g.quadraticCurveTo(s * 0.46, s * 0.2, s * 0.66, s * 0.3);
    g.quadraticCurveTo(s * 0.58, s * 0.34, s * 0.5, s * 0.3);
    g.quadraticCurveTo(s * 0.44, s * 0.34, s * 0.36, s * 0.36);
    g.fill();
    g.fillStyle = '#8a643c';
    g.beginPath();
    g.ellipse(s * 0.56, s * 0.265, s * 0.05, s * 0.016, -0.35, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = W.dark;
    for (const dx of [-0.045, 0.045]) {
      g.beginPath();
      g.ellipse(s * (0.5 + dx), s * 0.4, s * 0.012, s * 0.018, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = W.dark;
    g.lineWidth = s * 0.009;
    g.beginPath();
    g.moveTo(s * 0.455, s * 0.375);
    g.lineTo(s * 0.485, s * 0.37);
    g.moveTo(s * 0.515, s * 0.37);
    g.lineTo(s * 0.545, s * 0.375);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(s * 0.43, s * 0.465);
    g.quadraticCurveTo(s * 0.5, s * 0.535, s * 0.57, s * 0.465);
    g.quadraticCurveTo(s * 0.5, s * 0.48, s * 0.43, s * 0.465);
    g.fill();
    g.strokeStyle = '#a45b4a';
    g.lineWidth = s * 0.008;
    g.stroke();
    // The pointer, held out to the map.
    g.strokeStyle = '#e8edf4';
    g.lineWidth = s * 0.014;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 0.7, s * 0.78);
    g.lineTo(s * 0.9, s * 0.3);
    g.stroke();
    g.fillStyle = W.sun;
    g.beginPath();
    g.arc(s * 0.9, s * 0.3, s * 0.02, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f2c9a4';
    g.beginPath();
    g.arc(s * 0.7, s * 0.78, s * 0.04, 0, Math.PI * 2);
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
