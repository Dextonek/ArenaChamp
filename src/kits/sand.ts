import type { HeroKit } from '../heroes';

/**
 * Sand kit data (Sefu, the Dune Sovereign): dark umber ground, pale sandstone foil, ochre sand ribbons. Icons are drawn
 * on canvases in the kit palette, one signature shape each (see pipeline/designs/kit-sand.md).
 */
const S = { core: '#fff6dc', hot: '#ffd27a', body: '#c8913f', accent: '#3fd4c8', dark: '#2a1a0c', stone: '#e8d8b4', stoneShade: '#b9a67f' };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.75);
  r.addColorStop(0, '#3d2611');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** Loose grains. */
function grains(g: CanvasRenderingContext2D, pts: number[][], r: number) {
  for (const [x, y, k] of pts) {
    g.fillStyle = k ? S.hot : S.body;
    g.beginPath(); g.arc(x, y, r * (k ? 0.8 : 1), 0, Math.PI * 2); g.fill();
  }
}

/** A stone ground ring (ellipse) with dark glyph ticks. */
function ring(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, lw: number) {
  g.strokeStyle = S.dark;
  g.lineWidth = lw * 1.5;
  g.beginPath(); g.ellipse(cx, cy + lw * 0.2, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = S.stone;
  g.lineWidth = lw;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = S.dark;
  g.lineWidth = Math.max(1.2, lw * 0.22);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (rx - lw * 0.3), cy + Math.sin(a) * (ry - lw * 0.3 * (ry / rx)));
    g.lineTo(cx + Math.cos(a) * (rx + lw * 0.3), cy + Math.sin(a) * (ry + lw * 0.3 * (ry / rx)));
    g.stroke();
  }
}

/** A rearing cobra: a thin neck from the base centre (cx, by), a wide hood striped gold and turquoise, a small head. */
function cobra(g: CanvasRenderingContext2D, cx: number, by: number, w: number, h: number) {
  const hy = by - h * 0.62;
  const shape = (grow: number) => {
    g.beginPath();
    g.moveTo(cx - w * 0.08 - grow, by);
    g.quadraticCurveTo(cx - w * 0.1 - grow, hy + h * 0.16, cx - w / 2 - grow, hy);
    g.quadraticCurveTo(cx - w * 0.42, hy - h * 0.3 - grow, cx, hy - h * 0.3 - grow);
    g.quadraticCurveTo(cx + w * 0.42, hy - h * 0.3 - grow, cx + w / 2 + grow, hy);
    g.quadraticCurveTo(cx + w * 0.1 + grow, hy + h * 0.16, cx + w * 0.08 + grow, by);
    g.closePath();
  };
  shape(h * 0.035); g.fillStyle = S.dark; g.fill();
  shape(0); g.fillStyle = S.body; g.fill();
  // Nemes stripes across the hood.
  g.save();
  shape(0); g.clip();
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? S.accent : S.hot;
    g.fillRect(cx - w, hy - h * 0.26 + i * h * 0.1, w * 2, h * 0.05);
  }
  g.restore();
  // The head, with a dark eye, over the hood.
  g.fillStyle = S.dark; g.beginPath(); g.ellipse(cx, hy - h * 0.36, w * 0.13, h * 0.08, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = S.hot; g.beginPath(); g.ellipse(cx, hy - h * 0.36, w * 0.1, h * 0.06, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = S.dark; g.beginPath(); g.arc(cx + w * 0.04, hy - h * 0.37, w * 0.022, 0, Math.PI * 2); g.fill();
}

/** A streak of venom: a dark underside, a turquoise body and a pale lit crest, ending in a round drop. */
function venom(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number) {
  g.lineCap = 'round';
  const pass = (col: string, lw: number, dy: number) => {
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.beginPath(); g.moveTo(x0, y0 + dy); g.quadraticCurveTo((x0 + x1) / 2, y0 + dy - w * 0.4, x1, y1 + dy); g.stroke();
  };
  pass(S.dark, w * 1.3, w * 0.1);
  pass(S.accent, w, 0);
  pass('#d8fffa', w * 0.3, -w * 0.22);
  g.fillStyle = S.dark; g.beginPath(); g.arc(x1, y1, w * 0.8, 0, Math.PI * 2); g.fill();
  g.fillStyle = S.accent; g.beginPath(); g.arc(x1, y1, w * 0.62, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d8fffa'; g.beginPath(); g.arc(x1 - w * 0.18, y1 - w * 0.2, w * 0.18, 0, Math.PI * 2); g.fill();
}

/** A scarab seen from above at (x, y), `r` long, pointing along `ang` (radians from straight up). */
function scarab(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.strokeStyle = S.dark;
  g.lineWidth = Math.max(1.2, r * 0.22);
  g.lineCap = 'round';
  for (const k of [-1, 1]) for (const d of [-0.3, 0.1, 0.5]) { g.beginPath(); g.moveTo(k * r * 0.5, r * d); g.lineTo(k * r * 0.95, r * (d + 0.25)); g.stroke(); }
  g.fillStyle = S.dark; g.beginPath(); g.ellipse(0, 0, r * 0.66, r * 0.86, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2c14e'; g.beginPath(); g.ellipse(0, r * 0.06, r * 0.55, r * 0.74, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = S.accent; g.beginPath(); g.ellipse(0, -r * 0.62, r * 0.3, r * 0.2, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = S.dark; g.lineWidth = Math.max(1, r * 0.12);
  g.beginPath(); g.moveTo(0, -r * 0.4); g.lineTo(0, r * 0.78); g.stroke();
  g.restore();
}

/** A gold mummiform coffin standing on (cx, by), `h` tall, `w` wide at the shoulders: turquoise bands, a pale mask, a striped headdress. */
function coffin(g: CanvasRenderingContext2D, cx: number, by: number, w: number, h: number) {
  const top = by - h;
  const shape = (grow: number) => {
    g.beginPath();
    g.moveTo(cx - w * 0.3 - grow, by);
    g.lineTo(cx - w * 0.4 - grow, by - h * 0.45);
    g.lineTo(cx - w * 0.5 - grow, by - h * 0.66);
    g.lineTo(cx - w * 0.36 - grow, by - h * 0.76);
    g.lineTo(cx - w * 0.38 - grow, by - h * 0.92);
    g.quadraticCurveTo(cx, top - grow * 1.4 - h * 0.04, cx + w * 0.38 + grow, by - h * 0.92);
    g.lineTo(cx + w * 0.36 + grow, by - h * 0.76);
    g.lineTo(cx + w * 0.5 + grow, by - h * 0.66);
    g.lineTo(cx + w * 0.4 + grow, by - h * 0.45);
    g.lineTo(cx + w * 0.3 + grow, by);
    g.closePath();
  };
  shape(h * 0.03); g.fillStyle = S.dark; g.fill();
  shape(0); g.fillStyle = '#d6991f'; g.fill();
  g.save();
  shape(0); g.clip();
  // Turquoise bands down the body, with dark seams.
  for (let i = 0; i < 3; i++) {
    const y = by - h * (0.12 + i * 0.13);
    g.fillStyle = S.accent; g.fillRect(cx - w, y - h * 0.035, w * 2, h * 0.06);
    g.fillStyle = S.dark; g.fillRect(cx - w, y - h * 0.04, w * 2, h * 0.012); g.fillRect(cx - w, y + h * 0.02, w * 2, h * 0.012);
  }
  // The pale collar and the headdress stripes.
  g.fillStyle = S.stone; g.fillRect(cx - w, by - h * 0.68, w * 2, h * 0.08);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? S.accent : '#f2c14e'; g.fillRect(cx - w, by - h * (0.78 + i * 0.05), w * 2, h * 0.025); }
  g.restore();
  // The mask: a pale oval with dark eyes and a dark beard.
  g.fillStyle = S.dark; g.beginPath(); g.ellipse(cx, by - h * 0.84, w * 0.17, h * 0.09, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = S.stone; g.beginPath(); g.ellipse(cx, by - h * 0.84, w * 0.14, h * 0.075, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = S.dark;
  g.fillRect(cx - w * 0.1, by - h * 0.86, w * 0.07, h * 0.014); g.fillRect(cx + w * 0.03, by - h * 0.86, w * 0.07, h * 0.014);
  g.fillRect(cx - w * 0.04, by - h * 0.76, w * 0.08, h * 0.04);
}

export const sandKit: HeroKit = {
  name: 'Sefu',
  title: 'the Dune Sovereign',
  accent: S.body,
  foil: S.stone,
  maxHp: 620,
  portrait(g, s) {
    ground(g, s);
    // Layered linen shoulders, a gold collar, a bearded face under a striped gold headdress, the crook behind.
    g.fillStyle = S.stone;
    g.beginPath();
    g.moveTo(s * 0.08, s); g.lineTo(s * 0.16, s * 0.72); g.lineTo(s * 0.36, s * 0.62); g.lineTo(s * 0.64, s * 0.62); g.lineTo(s * 0.84, s * 0.72); g.lineTo(s * 0.92, s);
    g.closePath(); g.fill();
    g.strokeStyle = S.stoneShade;
    g.lineWidth = s * 0.012;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(s * (0.2 + i * 0.02), s * (0.78 + i * 0.05)); g.lineTo(s * (0.8 - i * 0.02), s * (0.78 + i * 0.05)); g.stroke(); }
    g.strokeStyle = S.body;
    g.lineWidth = s * 0.05;
    g.beginPath(); g.arc(s * 0.5, s * 0.6, s * 0.2, Math.PI * 0.1, Math.PI * 0.9); g.stroke();
    g.strokeStyle = S.accent;
    g.lineWidth = s * 0.014;
    g.beginPath(); g.arc(s * 0.5, s * 0.6, s * 0.17, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    // Headdress: a gold trapezoid with turquoise stripes, falling past the cheeks.
    g.fillStyle = S.body;
    g.beginPath();
    g.moveTo(s * 0.28, s * 0.62); g.lineTo(s * 0.3, s * 0.26); g.quadraticCurveTo(s * 0.5, s * 0.1, s * 0.7, s * 0.26); g.lineTo(s * 0.72, s * 0.62);
    g.lineTo(s * 0.62, s * 0.6); g.lineTo(s * 0.62, s * 0.34); g.lineTo(s * 0.38, s * 0.34); g.lineTo(s * 0.38, s * 0.6);
    g.closePath(); g.fill();
    g.strokeStyle = S.hot;
    g.lineWidth = s * 0.018;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(s * 0.3, s * (0.34 + i * 0.07)); g.lineTo(s * 0.38, s * (0.34 + i * 0.07)); g.moveTo(s * 0.62, s * (0.34 + i * 0.07)); g.lineTo(s * 0.7, s * (0.34 + i * 0.07)); g.stroke(); }
    g.strokeStyle = S.accent;
    g.lineWidth = s * 0.016;
    g.beginPath(); g.moveTo(s * 0.34, s * 0.26); g.quadraticCurveTo(s * 0.5, s * 0.16, s * 0.66, s * 0.26); g.stroke();
    // Face and beard.
    g.fillStyle = '#a8742f';
    g.fillRect(s * 0.38, s * 0.34, s * 0.24, s * 0.22);
    g.fillStyle = S.dark;
    g.fillRect(s * 0.41, s * 0.4, s * 0.06, s * 0.025);
    g.fillRect(s * 0.53, s * 0.4, s * 0.06, s * 0.025);
    g.fillStyle = S.accent;
    g.fillRect(s * 0.42, s * 0.405, s * 0.025, s * 0.015);
    g.fillRect(s * 0.555, s * 0.405, s * 0.025, s * 0.015);
    g.fillStyle = S.dark;
    g.beginPath(); g.moveTo(s * 0.43, s * 0.54); g.lineTo(s * 0.57, s * 0.54); g.lineTo(s * 0.54, s * 0.72); g.lineTo(s * 0.5, s * 0.76); g.lineTo(s * 0.46, s * 0.72); g.closePath(); g.fill();
    // The sandstone crook, held on the right.
    g.strokeStyle = S.stone;
    g.lineWidth = s * 0.035;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(s * 0.88, s); g.lineTo(s * 0.88, s * 0.22); g.arc(s * 0.8, s * 0.22, s * 0.08, 0, -Math.PI, true); g.stroke();
    grains(g, [[s * 0.2, s * 0.2, 1], [s * 0.14, s * 0.32, 0], [s * 0.1, s * 0.14, 0]], s * 0.012);
  },
  spells: [
    {
      key: 'Q', label: 'cobra spit', name: 'Cobra Spit', range: 9, cooldown: 5, aim: 'line',
      blurb: 'A cobra rears and spits venom 9 m down the aim: 62 damage and blinded 1.2 s on the first enemy it touches. Half the cooldown back when it hits a Judged enemy. Step off the line to dodge it.',
      icon(g, s) {
        ground(g, s);
        // The cobra rearing on the left, its venom streaking away to the right.
        cobra(g, s * 0.26, s * 0.96, s * 0.4, s * 0.8);
        venom(g, s * 0.5, s * 0.5, s * 0.92, s * 0.44, s * 0.11);
        venom(g, s * 0.5, s * 0.66, s * 0.74, s * 0.7, s * 0.05);
        grains(g, [[s * 0.58, s * 0.3, 1], [s * 0.7, s * 0.34, 0], [s * 0.82, s * 0.66, 1], [s * 0.64, s * 0.8, 0]], s * 0.016);
      },
    },
    {
      key: 'W', label: "shepherd's crook", name: "Shepherd's Crook", range: 6, cooldown: 10, cc: true,
      blurb: 'He hooks the crook round an enemy 6 m away (he must see them) and drags them 3 m toward him: 35 damage and slowed 0.5 s. The enemy is Judged for 3 s.',
      icon(g, s) {
        ground(g, s);
        // A sandstone crook from the lower left, its hook closed round the neck of a dark figure; pull chevrons behind it.
        g.lineCap = 'round';
        const body = (lw: number) => { g.lineWidth = lw; };
        // The figure: shoulders and a head, dark with a pale rim so it reads on the floor.
        g.fillStyle = S.stoneShade;
        g.beginPath(); g.arc(s * 0.72, s * 0.38, s * 0.1, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(s * 0.5, s * 0.96); g.lineTo(s * 0.56, s * 0.62); g.lineTo(s * 0.88, s * 0.62); g.lineTo(s * 0.94, s * 0.96); g.closePath(); g.fill();
        g.fillStyle = S.dark;
        g.beginPath(); g.arc(s * 0.72, s * 0.39, s * 0.08, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(s * 0.54, s * 0.96); g.lineTo(s * 0.6, s * 0.66); g.lineTo(s * 0.84, s * 0.66); g.lineTo(s * 0.9, s * 0.96); g.closePath(); g.fill();
        // The crook.
        const crook = () => {
          g.beginPath();
          g.moveTo(s * 0.06, s * 0.9);
          g.lineTo(s * 0.46, s * 0.5);
          g.arc(s * 0.6, s * 0.5, s * 0.14, Math.PI, Math.PI * 2.2);
          g.stroke();
        };
        g.strokeStyle = S.dark; body(s * 0.12); crook();
        g.strokeStyle = S.stone; body(s * 0.075); crook();
        g.strokeStyle = S.body; body(s * 0.02);
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(s * (0.14 + i * 0.08), s * (0.82 - i * 0.08)); g.lineTo(s * (0.18 + i * 0.08), s * (0.86 - i * 0.08)); g.stroke(); }
        // Pull chevrons.
        g.strokeStyle = S.accent;
        body(s * 0.03);
        for (let i = 0; i < 3; i++) { const x = s * (0.34 + i * 0.07); g.beginPath(); g.moveTo(x + s * 0.04, s * 0.2); g.lineTo(x, s * 0.26); g.lineTo(x + s * 0.04, s * 0.32); g.stroke(); }
        grains(g, [[s * 0.1, s * 0.5, 1], [s * 0.2, s * 0.3, 0], [s * 0.92, s * 0.5, 1]], s * 0.016);
      },
    },
    {
      // Range 11 is only the duel AI's reach: it dashes when the enemy is farther than Q reaches; the dash itself is 6 m.
      key: 'E', label: 'scarab stride', name: 'Scarab Stride', range: 11, cooldown: 12, dash: true,
      blurb: 'He skitters 6 m down the aim as a stream of scarabs in 0.5 s, the line shown as he starts. Running through an enemy bites: 30 now, then 30 poison over 2 s. He can still be hit.',
      icon(g, s) {
        ground(g, s);
        // A dashed line over the floor from the lower left, scarabs growing along it, a dark figure bitten at the end.
        g.strokeStyle = S.accent;
        g.lineWidth = s * 0.026;
        g.lineCap = 'round';
        g.setLineDash([s * 0.07, s * 0.05]);
        g.beginPath(); g.moveTo(s * 0.06, s * 0.9); g.lineTo(s * 0.66, s * 0.4); g.stroke();
        g.setLineDash([]);
        for (let i = 0; i < 6; i++) {
          const k = i / 5;
          scarab(g, s * (0.14 + k * 0.5) + (i % 2 ? s * 0.03 : -s * 0.03), s * (0.84 - k * 0.42) + (i % 2 ? -s * 0.03 : s * 0.03), s * (0.05 + k * 0.05), -0.7 + (i % 3) * 0.1);
        }
        // The bitten figure and two drops of poison.
        g.fillStyle = S.stoneShade;
        g.beginPath(); g.arc(s * 0.8, s * 0.3, s * 0.085, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(s * 0.64, s * 0.78); g.lineTo(s * 0.7, s * 0.46); g.lineTo(s * 0.92, s * 0.46); g.lineTo(s * 0.97, s * 0.78); g.closePath(); g.fill();
        g.fillStyle = S.dark;
        g.beginPath(); g.arc(s * 0.8, s * 0.31, s * 0.068, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(s * 0.67, s * 0.78); g.lineTo(s * 0.72, s * 0.5); g.lineTo(s * 0.9, s * 0.5); g.lineTo(s * 0.94, s * 0.78); g.closePath(); g.fill();
        g.fillStyle = S.accent;
        for (const [x, y, r] of [[0.74, 0.56, 0.03], [0.84, 0.66, 0.036], [0.78, 0.72, 0.024]]) { g.beginPath(); g.arc(s * x, s * y, s * r, 0, Math.PI * 2); g.fill(); }
        grains(g, [[s * 0.2, s * 0.6, 0], [s * 0.4, s * 0.86, 1], [s * 0.52, s * 0.22, 0]], s * 0.016);
      },
    },
    {
      key: 'R', label: 'sarcophagus', name: 'Sarcophagus', range: 9, cooldown: 24, cc: true,
      blurb: 'A gold sarcophagus rises at the enemy 9 m away (he must see them). 0.7 s later, if they are still inside its 1.6 m circle, it shuts: sealed 1.2 s, unable to act and unable to be hit. It opens in scarabs: 110 damage and Judged. Step out and it shuts on nothing.',
      icon(g, s) {
        ground(g, s);
        ring(g, s * 0.5, s * 0.86, s * 0.44, s * 0.12, s * 0.045);
        coffin(g, s * 0.5, s * 0.92, s * 0.5, s * 0.86);
        // Scarabs pouring from its foot.
        scarab(g, s * 0.16, s * 0.82, s * 0.06, 0.4);
        scarab(g, s * 0.84, s * 0.8, s * 0.06, -0.5);
        scarab(g, s * 0.1, s * 0.62, s * 0.045, 0.9);
        scarab(g, s * 0.92, s * 0.6, s * 0.045, -0.9);
        grains(g, [[s * 0.22, s * 0.7, 1], [s * 0.78, s * 0.72, 0], [s * 0.5, s * 0.06, 1]], s * 0.016);
      },
    },
  ],
};
