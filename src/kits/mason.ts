import type { HeroKit } from '../heroes';

/**
 * Mason kit data (Bram, the Pillar Mason): a dark floor, warm limestone and sand, a chalk-pale foil. Icons are drawn on
 * canvases in the kit palette, one signature shape each; the portrait is Gerald's grumpy face, not Bram's (see
 * pipeline/designs/kit-mason.md).
 */
const M = { core: '#f6efdc', hot: '#dcc58f', body: '#c9b48a', stone: '#9a958c', stoneLit: '#b4afa5', stoneDark: '#5b5853', foil: '#e6e0d0', dark: '#1c1a18', fury: '#b06a58', sweat: '#8fd3ff' };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.75);
  r.addColorStop(0, '#2e2a24');
  r.addColorStop(1, M.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A chunky pillar: a base block, a shaft, a cap slab; chalk outline. `w` is the shaft width, `h` its height, standing on `by`. */
function pillar(g: CanvasRenderingContext2D, cx: number, by: number, w: number, h: number, s: number) {
  const edge = Math.max(1.5, s * 0.014);
  g.lineWidth = edge;
  g.strokeStyle = M.foil;
  g.fillStyle = M.stoneDark;
  g.fillRect(cx - w * 0.65, by - h * 0.08, w * 1.3, h * 0.08);
  g.strokeRect(cx - w * 0.65, by - h * 0.08, w * 1.3, h * 0.08);
  g.fillStyle = M.stone;
  g.fillRect(cx - w / 2, by - h * 0.92, w, h * 0.84);
  g.strokeRect(cx - w / 2, by - h * 0.92, w, h * 0.84);
  g.fillStyle = M.stoneLit;
  g.fillRect(cx - w * 0.62, by - h, w * 1.24, h * 0.09);
  g.strokeRect(cx - w * 0.62, by - h, w * 1.24, h * 0.09);
  // A lit edge and a crack.
  g.fillStyle = M.stoneLit;
  g.fillRect(cx - w / 2 + edge, by - h * 0.9, w * 0.12, h * 0.8);
  g.strokeStyle = M.dark;
  g.lineWidth = edge;
  g.beginPath();
  g.moveTo(cx + w * 0.3, by - h * 0.7);
  g.lineTo(cx + w * 0.12, by - h * 0.5);
  g.lineTo(cx + w * 0.26, by - h * 0.3);
  g.stroke();
}

/** Gerald's face on a block: slanted heavy brows, half-lidded eyes, a downturned mouth. `cx, cy` is the face's centre. */
function grumpy(g: CanvasRenderingContext2D, cx: number, cy: number, u: number, flushed: boolean) {
  g.fillStyle = flushed ? M.fury : M.stoneLit;
  g.fillRect(cx - u * 0.55, cy - u * 0.62, u * 1.1, u * 1.24);
  g.strokeStyle = M.foil;
  g.lineWidth = Math.max(1.5, u * 0.05);
  g.strokeRect(cx - u * 0.55, cy - u * 0.62, u * 1.1, u * 1.24);
  for (const sx of [-1, 1]) {
    const ex = cx + sx * u * 0.27, ey = cy - u * 0.12;
    g.fillStyle = M.dark;
    g.beginPath(); g.arc(ex, ey, u * 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = M.core;
    g.beginPath(); g.arc(ex, ey, u * 0.16, 0, Math.PI * 2); g.fill();
    g.fillStyle = M.dark;
    g.beginPath(); g.arc(ex + sx * -u * 0.03, ey + u * 0.05, u * 0.07, 0, Math.PI * 2); g.fill();
    // The lid: stone over the top of the eye.
    g.fillStyle = flushed ? M.fury : M.stoneLit;
    g.fillRect(ex - u * 0.22, ey - u * 0.22, u * 0.44, u * 0.24);
    // The brow, slanting down toward the nose.
    g.save();
    g.translate(ex, ey - u * 0.22);
    g.rotate(sx * -0.4);
    g.fillStyle = M.stoneDark;
    g.fillRect(-u * 0.25, -u * 0.07, u * 0.5, u * 0.14);
    g.restore();
  }
  // Nose, then the flat unhappy mouth.
  g.fillStyle = M.stone;
  g.fillRect(cx - u * 0.07, cy - u * 0.12, u * 0.14, u * 0.34);
  g.strokeStyle = M.dark;
  g.lineWidth = Math.max(2, u * 0.07);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - u * 0.26, cy + u * 0.4);
  g.lineTo(cx + u * 0.26, cy + u * 0.38);
  g.moveTo(cx - u * 0.26, cy + u * 0.4);
  g.lineTo(cx - u * 0.33, cy + u * 0.47);
  g.moveTo(cx + u * 0.26, cy + u * 0.38);
  g.lineTo(cx + u * 0.33, cy + u * 0.45);
  g.stroke();
}

/** A few chips of stone. */
function chips(g: CanvasRenderingContext2D, s: number, pts: [number, number, number][]) {
  for (const [x, y, r] of pts) {
    g.fillStyle = M.stoneLit;
    g.save();
    g.translate(s * x, s * y);
    g.rotate(x * 9);
    g.fillRect(-s * r, -s * r * 0.7, s * r * 2, s * r * 1.4);
    g.strokeStyle = M.dark;
    g.lineWidth = Math.max(1, s * 0.01);
    g.strokeRect(-s * r, -s * r * 0.7, s * r * 2, s * r * 1.4);
    g.restore();
  }
}

export const masonKit: HeroKit = {
  name: 'Bram',
  title: 'the Pillar Mason',
  maxHp: 760,
  melee: true,
  accent: M.body,
  foil: '#6d6a66',
  portrait(g, s) {
    ground(g, s);
    // Gerald, big: a chipped block with a moss tuft, the grumpy face filling the frame, a bored sweat-free stare.
    g.fillStyle = M.stoneDark;
    g.fillRect(s * 0.1, s * 0.12, s * 0.8, s * 0.82);
    g.fillStyle = M.stone;
    g.fillRect(s * 0.16, s * 0.18, s * 0.68, s * 0.76);
    g.strokeStyle = M.foil;
    g.lineWidth = s * 0.02;
    g.strokeRect(s * 0.16, s * 0.18, s * 0.68, s * 0.76);
    // The chipped top corner and the moss.
    g.fillStyle = M.dark;
    g.beginPath(); g.moveTo(s * 0.7, s * 0.18); g.lineTo(s * 0.84, s * 0.18); g.lineTo(s * 0.84, s * 0.32); g.closePath(); g.fill();
    g.fillStyle = '#6f8f5a';
    g.beginPath(); g.ellipse(s * 0.3, s * 0.18, s * 0.1, s * 0.04, 0, 0, Math.PI * 2); g.fill();
    grumpy(g, s * 0.5, s * 0.54, s * 0.62, false);
    g.strokeStyle = M.dark;
    g.lineWidth = s * 0.012;
    g.beginPath(); g.moveTo(s * 0.2, s * 0.7); g.lineTo(s * 0.27, s * 0.78); g.lineTo(s * 0.23, s * 0.88); g.stroke();
  },
  spells: [
    {
      key: 'Q', label: 'raise gerald', name: 'Raise Gerald', range: 9, cooldown: 6, cc: true,
      blurb: 'Marks a spot (9 m): 0.7 s later Gerald bursts up there, 50 damage and a 0.5 s knock-up to anyone within 1.5 m. He is a real pillar with 220 HP. A new Gerald crumbles the old one.',
      icon(g, s) {
        ground(g, s);
        // A star of floor cracks, a pillar bursting out of the middle, stones flying.
        g.strokeStyle = M.foil;
        g.lineCap = 'round';
        g.lineWidth = s * 0.028;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.2, r0 = s * 0.16, r1 = s * (0.34 + (i % 3) * 0.06);
          g.beginPath();
          g.moveTo(s * 0.5 + Math.cos(a) * r0, s * 0.78 + Math.sin(a) * r0 * 0.4);
          g.lineTo(s * 0.5 + Math.cos(a + 0.12) * r1 * 0.7, s * 0.78 + Math.sin(a + 0.12) * r1 * 0.3);
          g.lineTo(s * 0.5 + Math.cos(a) * r1, s * 0.78 + Math.sin(a) * r1 * 0.4);
          g.stroke();
        }
        pillar(g, s * 0.5, s * 0.82, s * 0.24, s * 0.62, s);
        g.fillStyle = M.dark;
        g.fillRect(s * 0.44, s * 0.32, s * 0.04, s * 0.04);
        g.fillRect(s * 0.53, s * 0.32, s * 0.04, s * 0.04);
        chips(g, s, [[0.22, 0.4, 0.04], [0.8, 0.34, 0.05], [0.3, 0.2, 0.03], [0.72, 0.18, 0.035], [0.14, 0.62, 0.03]]);
      },
    },
    {
      key: 'W', label: 'the shove', name: 'The Shove', range: 8, cooldown: 7, aim: 'line',
      blurb: 'Needs Gerald within 3 m. He slides 8 m along your aim at 8 m/s: 60 damage to the first enemy he touches, who is carried along. Stopped by a wall with them: stunned 0.9 s.',
      icon(g, s) {
        ground(g, s);
        // A pillar sliding right, speed lines behind it, a floor scrape, the arrow of the shove.
        g.strokeStyle = M.hot;
        g.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          g.lineWidth = s * (0.04 - i * 0.006);
          g.beginPath();
          g.moveTo(s * (0.08 + i * 0.03), s * (0.3 + i * 0.12));
          g.lineTo(s * (0.4 - i * 0.02), s * (0.3 + i * 0.12));
          g.stroke();
        }
        g.fillStyle = M.stoneDark;
        g.beginPath(); g.moveTo(s * 0.1, s * 0.84); g.lineTo(s * 0.95, s * 0.84); g.lineTo(s * 0.9, s * 0.9); g.lineTo(s * 0.05, s * 0.9); g.closePath(); g.fill();
        g.save();
        g.translate(s * 0.66, s * 0.84);
        g.rotate(0.12);
        pillar(g, 0, 0, s * 0.26, s * 0.66, s);
        g.fillStyle = M.dark;
        g.fillRect(-s * 0.08, -s * 0.5, s * 0.05, s * 0.04);
        g.fillRect(s * 0.03, -s * 0.5, s * 0.05, s * 0.04);
        g.restore();
        // The arrow.
        g.fillStyle = M.body;
        g.beginPath();
        g.moveTo(s * 0.3, s * 0.12); g.lineTo(s * 0.52, s * 0.12); g.lineTo(s * 0.52, s * 0.05); g.lineTo(s * 0.68, s * 0.16); g.lineTo(s * 0.52, s * 0.27); g.lineTo(s * 0.52, s * 0.2); g.lineTo(s * 0.3, s * 0.2);
        g.closePath(); g.fill();
        chips(g, s, [[0.24, 0.8, 0.025], [0.15, 0.76, 0.02]]);
      },
    },
    {
      key: 'E', label: 'a good lean', name: 'A Good Lean', range: 8, cooldown: 11,
      blurb: 'Needs Gerald within 8 m. Dash to him and stop 1.5 m short, with a shield of 60 for 2 s. He did not ask for the hug.',
      icon(g, s) {
        ground(g, s);
        // A shield of chalk round a pillar, the dash chevrons coming in from the left, a worried sweat drop.
        g.strokeStyle = M.foil;
        g.lineWidth = s * 0.035;
        g.beginPath(); g.arc(s * 0.62, s * 0.5, s * 0.34, Math.PI * 0.55, Math.PI * 1.55); g.stroke();
        g.strokeStyle = M.hot;
        g.lineWidth = s * 0.02;
        g.beginPath(); g.arc(s * 0.62, s * 0.5, s * 0.29, Math.PI * 0.6, Math.PI * 1.5); g.stroke();
        pillar(g, s * 0.66, s * 0.84, s * 0.22, s * 0.66, s);
        g.fillStyle = M.dark;
        g.fillRect(s * 0.6, s * 0.38, s * 0.04, s * 0.05);
        g.fillRect(s * 0.7, s * 0.38, s * 0.04, s * 0.05);
        g.fillRect(s * 0.6, s * 0.5, s * 0.14, s * 0.025);
        g.fillStyle = M.sweat;
        g.beginPath(); g.ellipse(s * 0.82, s * 0.34, s * 0.025, s * 0.04, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = M.body;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        for (let i = 0; i < 3; i++) {
          g.lineWidth = s * (0.055 - i * 0.01);
          g.beginPath();
          g.moveTo(s * (0.08 + i * 0.11), s * 0.3); g.lineTo(s * (0.2 + i * 0.11), s * 0.5); g.lineTo(s * (0.08 + i * 0.11), s * 0.7);
          g.stroke();
        }
      },
    },
    {
      key: 'R', label: 'gerald no', name: 'Gerald, No!', range: 10, cooldown: 24, aim: 'line',
      blurb: 'Needs Gerald. He topples along your aim: a 10 m shadow for 1.0 s, then 150 damage to anyone in it. He breaks into rubble that slows for 3 s, and you have no pillar left.',
      icon(g, s) {
        ground(g, s);
        // A long shadow across the floor, the pillar falling face first at a steep tilt, rubble and a shout.
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.beginPath(); g.moveTo(s * 0.1, s * 0.84); g.lineTo(s * 0.96, s * 0.68); g.lineTo(s * 0.98, s * 0.8); g.lineTo(s * 0.1, s * 0.94); g.closePath(); g.fill();
        g.strokeStyle = M.foil;
        g.lineWidth = s * 0.014;
        g.stroke();
        g.save();
        g.translate(s * 0.22, s * 0.84);
        g.rotate(1.05);
        pillar(g, 0, 0, s * 0.2, s * 0.62, s);
        g.fillStyle = M.dark;
        g.fillRect(-s * 0.06, -s * 0.44, s * 0.04, s * 0.05);
        g.fillRect(s * 0.02, -s * 0.44, s * 0.04, s * 0.05);
        g.beginPath(); g.ellipse(-s * 0.02, -s * 0.3, s * 0.03, s * 0.045, 0, 0, Math.PI * 2); g.fill();
        g.restore();
        chips(g, s, [[0.62, 0.62, 0.045], [0.74, 0.56, 0.035], [0.84, 0.7, 0.05], [0.7, 0.76, 0.03], [0.9, 0.58, 0.03]]);
        // The exclamation mark.
        g.fillStyle = M.fury;
        g.fillRect(s * 0.78, s * 0.1, s * 0.07, s * 0.26);
        g.beginPath(); g.arc(s * 0.815, s * 0.44, s * 0.04, 0, Math.PI * 2); g.fill();
      },
    },
  ],
};
