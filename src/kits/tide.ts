import type { HeroKit } from '../heroes';
import { MIST_SECONDS } from '../traits/tide';

/**
 * Tide kit data: Marin, the Tide Dancer. Four spells (Wave Disc, Coral Spire, Mist Form, Moon's Pull; labels as registered), canvas-drawn icons in the kit's palette:
 * deep-water ground, foam foil, thick smooth blue water ribbons with a dark underside and a foam crest, one coral
 * accent. Signature shape: the water ribbon curling like a dancer's sash.
 */
const S = { core: '#ffffff', hot: '#bff2ff', body: '#1f9fd6', accent: '#ff9a6a', dark: '#05253a', foam: '#eaf8fb' };

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#0b3d5c');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A thick water ribbon along the points: dark underside, blue body, lighter top, a foam crest on the end. */
function ribbon(g: CanvasRenderingContext2D, pts: [number, number][], w: number, foam = true) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const path = () => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    g.lineTo(l[0], l[1]);
  };
  g.strokeStyle = S.dark;
  g.lineWidth = w * 1.25;
  path();
  g.stroke();
  g.strokeStyle = S.body;
  g.lineWidth = w;
  path();
  g.stroke();
  g.save();
  g.translate(0, -w * 0.16);
  g.strokeStyle = S.hot;
  g.globalAlpha = 0.75;
  g.lineWidth = w * 0.4;
  path();
  g.stroke();
  g.restore();
  if (foam) {
    // Foam crest: pale blobs fading back from the head.
    const n = pts.length, h = pts[n - 1], p = pts[n - 2];
    g.fillStyle = S.foam;
    for (let i = 0; i < 5; i++) {
      const k = i / 5;
      const x = h[0] + (p[0] - h[0]) * k * 0.9 + (i % 2 ? w * 0.18 : -w * 0.18);
      const y = h[1] + (p[1] - h[1]) * k * 0.9 + (i % 2 ? -w * 0.1 : w * 0.1);
      g.beginPath();
      g.arc(x, y, w * (0.34 - k * 0.2), 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** Small teardrops at the points. */
function drops(g: CanvasRenderingContext2D, pts: [number, number, number][]) {
  for (const [x, y, r] of pts) {
    g.fillStyle = S.hot;
    g.beginPath();
    g.moveTo(x, y - r * 1.9);
    g.quadraticCurveTo(x + r * 1.1, y - r * 0.2, x, y + r);
    g.quadraticCurveTo(x - r * 1.1, y - r * 0.2, x, y - r * 1.9);
    g.fill();
  }
}

/** A foam crown ring on the floor (spikes up from an ellipse). */
function crown(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, h: number) {
  g.fillStyle = S.foam;
  g.strokeStyle = S.body;
  g.lineWidth = Math.max(1, rx * 0.06);
  g.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry * 0.4;
    const tip = h * (0.6 + 0.4 * ((i * 7) % 5) / 4);
    if (i === 0) g.moveTo(x, y);
    const a2 = a + Math.PI / n / 2;
    g.lineTo(cx + Math.cos(a2) * rx * 1.08, y - tip);
    g.lineTo(cx + Math.cos(a + Math.PI / n) * rx, cy + Math.sin(a + Math.PI / n) * ry * 0.4);
  }
  g.lineTo(cx + rx, cy);
  g.ellipse(cx, cy, rx, ry * 0.4, 0, 0, Math.PI);
  g.closePath();
  g.fill();
  g.stroke();
}

function coral(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = S.accent;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

export const tideKit: HeroKit = {
  name: 'Marin',
  title: 'the Tide Dancer',
  accent: S.body,
  foil: S.foam,
  maxHp: 670,
  portrait(g, s) {
    iconGround(g, s);
    // Sashes of water sweeping round her, behind and in front.
    ribbon(g, [[s * 0.04, s * 0.7], [s * 0.2, s * 0.4], [s * 0.4, s * 0.3], [s * 0.34, s * 0.14]], s * 0.075);
    ribbon(g, [[s * 0.96, s * 0.56], [s * 0.82, s * 0.28], [s * 0.64, s * 0.2], [s * 0.7, s * 0.06]], s * 0.07);
    drops(g, [[s * 0.12, s * 0.2, s * 0.018], [s * 0.88, s * 0.14, s * 0.016], [s * 0.2, s * 0.86, s * 0.016]]);
    // Shoulders in a wave-blue wrap.
    g.fillStyle = '#0b3550';
    g.beginPath();
    g.moveTo(s * 0.16, s);
    g.quadraticCurveTo(s * 0.2, s * 0.68, s * 0.34, s * 0.56);
    g.quadraticCurveTo(s * 0.5, s * 0.46, s * 0.66, s * 0.56);
    g.quadraticCurveTo(s * 0.8, s * 0.68, s * 0.84, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.foam;
    g.lineWidth = s * 0.016;
    g.stroke();
    // Head with a swept dark hair line and a coral flower.
    g.fillStyle = '#e8c9b0';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.4, s * 0.13, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.34, s * 0.15, s * 0.14, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.35, s * 0.34);
    g.quadraticCurveTo(s * 0.3, s * 0.56, s * 0.38, s * 0.7);
    g.quadraticCurveTo(s * 0.4, s * 0.5, s * 0.42, s * 0.34);
    g.fill();
    g.fillStyle = S.body;
    g.fillRect(s * 0.43, s * 0.42, s * 0.04, s * 0.014);
    g.fillRect(s * 0.53, s * 0.42, s * 0.04, s * 0.014);
    coral(g, s * 0.64, s * 0.3, s * 0.03);
    g.fillStyle = S.foam;
    g.beginPath();
    g.arc(s * 0.64, s * 0.3, s * 0.012, 0, Math.PI * 2);
    g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'wave disc', name: 'Wave Disc', range: 9, cooldown: 4, aim: 'line',
      blurb: 'Throws a spinning disc of water 9 m down the aim: 60 damage. High tide: it knocks the enemy back 2.5 m. Low tide: it pulls the enemy 2.5 m toward her.',
      icon(g, s) {
        iconGround(g, s);
        // A trailing water ribbon curling in from the lower left behind a spinning disc.
        ribbon(g, [[s * 0.06, s * 0.82], [s * 0.2, s * 0.62], [s * 0.1, s * 0.46], [s * 0.3, s * 0.4]], s * 0.09, false);
        const cx = s * 0.6, cy = s * 0.44, rx = s * 0.3, ry = s * 0.13;
        // Dark underside, blue body, pale top, foam rim.
        g.fillStyle = S.dark;
        g.beginPath(); g.ellipse(cx, cy + s * 0.05, rx * 0.95, ry * 1.1, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = S.body;
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = S.hot;
        g.beginPath(); g.ellipse(cx, cy - s * 0.01, rx * 0.8, ry * 0.75, 0, 0, Math.PI * 2); g.fill();
        // Three foam arms spiralling out from the middle.
        g.strokeStyle = S.foam;
        g.lineCap = 'round';
        g.lineWidth = s * 0.03;
        for (let i = 0; i < 3; i++) {
          const a0 = (i * Math.PI * 2) / 3;
          g.beginPath();
          for (let k = 0; k <= 10; k++) {
            const a = a0 + k * 0.17, rr = 0.15 + k * 0.075;
            const x = cx + Math.cos(a) * rx * rr * 1.1, y = cy + Math.sin(a) * ry * rr * 1.1;
            if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
        g.strokeStyle = S.foam;
        g.lineWidth = s * 0.025;
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
        // The tide's two answers: a pale chevron pointing away (High) and a blue one pointing back (Low).
        g.fillStyle = S.foam;
        g.beginPath(); g.moveTo(s * 0.9, s * 0.74); g.lineTo(s * 0.78, s * 0.67); g.lineTo(s * 0.78, s * 0.81); g.closePath(); g.fill();
        g.fillStyle = '#3ab8ea';
        g.beginPath(); g.moveTo(s * 0.5, s * 0.74); g.lineTo(s * 0.62, s * 0.67); g.lineTo(s * 0.62, s * 0.81); g.closePath(); g.fill();
        drops(g, [[s * 0.38, s * 0.22, s * 0.022], [s * 0.88, s * 0.28, s * 0.02], [s * 0.2, s * 0.28, s * 0.016]]);
        coral(g, s * 0.6, s * 0.44, s * 0.03);
      },
    },
    {
      key: 'W', label: 'coral spire', name: 'Coral Spire', range: 8, cooldown: 9,
      blurb: 'A coral pillar rises at a spot (8 m) and stands for 5 s as a real obstacle. As it rises, the enemy within 2.5 m is hit for 55: High tide shoves it 3 m away, Low tide drags it 2 m to the pillar.',
      icon(g, s) {
        iconGround(g, s);
        crown(g, s * 0.5, s * 0.86, s * 0.38, s * 0.16, s * 0.1);
        // A tall central spire and four leaning branches, deep red at the foot to a pale tip.
        const spike = (bx: number, by: number, w: number, tx: number, ty: number) => {
          const gr = g.createLinearGradient(bx, by, tx, ty);
          gr.addColorStop(0, '#8c3a4b');
          gr.addColorStop(0.55, S.accent);
          gr.addColorStop(1, '#ffe6d6');
          g.fillStyle = gr;
          g.strokeStyle = S.dark;
          g.lineWidth = s * 0.012;
          g.beginPath();
          g.moveTo(bx - w, by);
          g.quadraticCurveTo(bx - w * 0.5, (by + ty) / 2, tx, ty);
          g.quadraticCurveTo(bx + w * 0.5, (by + ty) / 2, bx + w, by);
          g.closePath();
          g.fill();
          g.stroke();
        };
        spike(s * 0.3, s * 0.82, s * 0.07, s * 0.2, s * 0.44);
        spike(s * 0.7, s * 0.82, s * 0.07, s * 0.82, s * 0.46);
        spike(s * 0.4, s * 0.84, s * 0.08, s * 0.34, s * 0.3);
        spike(s * 0.6, s * 0.84, s * 0.08, s * 0.66, s * 0.32);
        spike(s * 0.5, s * 0.86, s * 0.12, s * 0.5, s * 0.1);
        // A ring of water pushed out from the foot, and drops.
        g.strokeStyle = S.hot;
        g.lineWidth = s * 0.02;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.88, s * 0.44, s * 0.1, 0, 0, Math.PI * 2); g.stroke();
        drops(g, [[s * 0.12, s * 0.62, s * 0.02], [s * 0.9, s * 0.64, s * 0.02], [s * 0.7, s * 0.14, s * 0.016]]);
      },
    },
    {
      key: 'E', label: 'mist form', name: 'Mist Form', range: 6, cooldown: 10, dash: true, parry: true, buff: { kind: 'haste', amount: 0.4, seconds: MIST_SECONDS },
      blurb: 'She turns to water and flows up to 6 m to the aim, through the enemy if it is in the way: untouchable for 1 s and 40% faster. She reforms at the end spot in a splash: 40 damage within 3 m.',
      icon(g, s) {
        iconGround(g, s);
        // A dancer made of water: a pale see-through figure wrapped in two spiralling ribbons, with a foam ring at her feet.
        g.fillStyle = 'rgba(191,242,255,0.55)';
        g.beginPath(); g.ellipse(s * 0.5, s * 0.58, s * 0.12, s * 0.25, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(s * 0.5, s * 0.28, s * 0.085, 0, Math.PI * 2); g.fill();
        g.strokeStyle = S.foam;
        g.lineWidth = s * 0.016;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.58, s * 0.12, s * 0.25, 0, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(s * 0.5, s * 0.28, s * 0.085, 0, Math.PI * 2); g.stroke();
        ribbon(g, [[s * 0.3, s * 0.8], [s * 0.7, s * 0.62], [s * 0.3, s * 0.46], [s * 0.68, s * 0.28], [s * 0.52, s * 0.14]], s * 0.07);
        ribbon(g, [[s * 0.7, s * 0.8], [s * 0.3, s * 0.64], [s * 0.7, s * 0.46], [s * 0.34, s * 0.3]], s * 0.055, false);
        g.strokeStyle = S.foam;
        g.lineWidth = s * 0.05;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.88, s * 0.36, s * 0.09, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = S.body;
        g.lineWidth = s * 0.028;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.88, s * 0.36, s * 0.09, 0, 0, Math.PI * 2); g.stroke();
        drops(g, [[s * 0.18, s * 0.4, s * 0.02], [s * 0.84, s * 0.5, s * 0.02], [s * 0.78, s * 0.18, s * 0.016], [s * 0.22, s * 0.16, s * 0.016]]);
        coral(g, s * 0.58, s * 0.22, s * 0.028);
      },
    },
    {
      key: 'R', label: "moon's pull", name: "Moon's Pull", range: 12, cooldown: 22,
      blurb: "Ultimate. For 4 s the tide is held at Low and doubled: the enemy is dragged toward her from anywhere in the arena at 1.2 m/s for 20 damage a tick (four ticks), her pulls are twice as strong, and a 65 tide crash lands when it reaches her or the moon sets.",
      icon(g, s) {
        iconGround(g, s);
        // Water ribbons spiralling in from the corners toward a foam crown, under a crescent moon.
        crown(g, s * 0.5, s * 0.84, s * 0.2, s * 0.1, s * 0.09);
        ribbon(g, [[s * 0.04, s * 0.5], [s * 0.1, s * 0.82], [s * 0.34, s * 0.9], [s * 0.46, s * 0.8]], s * 0.085, false);
        ribbon(g, [[s * 0.96, s * 0.46], [s * 0.88, s * 0.8], [s * 0.66, s * 0.9], [s * 0.54, s * 0.8]], s * 0.085, false);
        ribbon(g, [[s * 0.06, s * 0.76], [s * 0.2, s * 0.56], [s * 0.34, s * 0.62], [s * 0.42, s * 0.7]], s * 0.06, false);
        ribbon(g, [[s * 0.94, s * 0.74], [s * 0.8, s * 0.54], [s * 0.66, s * 0.6], [s * 0.58, s * 0.7]], s * 0.06, false);
        // The moon: a pale disc with a dark bite, ringed in foam.
        const mx = s * 0.5, my = s * 0.3, mr = s * 0.2;
        g.fillStyle = 'rgba(191,242,255,0.22)';
        g.beginPath(); g.arc(mx, my, mr * 1.45, 0, Math.PI * 2); g.fill();
        g.fillStyle = S.foam;
        g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#0b3d5c';
        g.beginPath(); g.arc(mx + mr * 0.42, my - mr * 0.2, mr * 0.86, 0, Math.PI * 2); g.fill();
        g.strokeStyle = S.hot;
        g.lineWidth = s * 0.014;
        g.beginPath(); g.arc(mx, my, mr * 1.3, 0, Math.PI * 2); g.stroke();
        drops(g, [[s * 0.24, s * 0.3, s * 0.016], [s * 0.78, s * 0.22, s * 0.016], [s * 0.5, s * 0.64, s * 0.018]]);
        coral(g, s * 0.5, s * 0.82, s * 0.03);
      },
    },
  ],
};
