import type { HeroKit } from '../heroes';

/**
 * Frost kit data: Isolde, the Winter Warden. Four spells (labels as registered), canvas-drawn icons in the kit's
 * palette: deep navy ground, rime white foil, blue ice, one pink glint. Signature shapes: frost ferns and faceted crystals.
 */
const F = { core: '#f6fcff', hot: '#c9efff', body: '#4fb4e8', accent: '#ff9ec4', dark: '#081626', rime: '#e8f4fa' };

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.75);
  r.addColorStop(0, '#12304c');
  r.addColorStop(1, F.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A faceted ice crystal from (x1,y1) to the tip (x2,y2), `w` wide at the base, with a pale core line. */
function crystal(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  const sx = x1 + dx * 0.62, sy = y1 + dy * 0.62; // where the shaft ends and the head begins
  g.beginPath();
  g.moveTo(x1 + nx * w / 2, y1 + ny * w / 2);
  g.lineTo(sx + nx * w * 0.46, sy + ny * w * 0.46);
  g.lineTo(x2, y2);
  g.lineTo(sx - nx * w * 0.46, sy - ny * w * 0.46);
  g.lineTo(x1 - nx * w / 2, y1 - ny * w / 2);
  g.closePath();
  g.fillStyle = F.body;
  g.fill();
  // Lit facet toward the upper left.
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.lineTo(sx + nx * w * 0.46, sy + ny * w * 0.46);
  g.lineTo(x1 + nx * w / 2, y1 + ny * w / 2);
  g.closePath();
  g.fillStyle = '#7fcdf2';
  g.fill();
  // Dark base.
  g.beginPath();
  g.moveTo(x1 + nx * w / 2, y1 + ny * w / 2);
  g.lineTo(x1 + dx * 0.3 + nx * w * 0.5, y1 + dy * 0.3 + ny * w * 0.5);
  g.lineTo(x1 + dx * 0.3 - nx * w * 0.5, y1 + dy * 0.3 - ny * w * 0.5);
  g.lineTo(x1 - nx * w / 2, y1 - ny * w / 2);
  g.closePath();
  g.fillStyle = 'rgba(8,22,38,0.55)';
  g.fill();
  // Pale core line along the long axis.
  g.strokeStyle = F.rime;
  g.lineWidth = Math.max(1, w * 0.08);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x1 + dx * 0.2, y1 + dy * 0.2);
  g.lineTo(x1 + dx * 0.85, y1 + dy * 0.85);
  g.stroke();
}

/** A small frost fern: a stem with feathery side branches that shrink toward the tip. */
function fern(g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, w: number, depth = 0) {
  const steps = 7;
  g.strokeStyle = F.rime;
  g.lineCap = 'round';
  for (let i = 0; i < steps; i++) {
    const k0 = i / steps, k1 = (i + 1) / steps;
    g.lineWidth = Math.max(1, w * (1 - 0.6 * k0));
    g.beginPath();
    g.moveTo(x + Math.cos(ang) * len * k0, y + Math.sin(ang) * len * k0);
    g.lineTo(x + Math.cos(ang) * len * k1, y + Math.sin(ang) * len * k1);
    g.stroke();
    if (depth < 1 && i > 0 && i < steps - 1) {
      const sl = len * 0.42 * (1 - k1) * (0.8 + 0.4 * ((i * 7) % 3) / 2);
      const bx = x + Math.cos(ang) * len * k1, by = y + Math.sin(ang) * len * k1;
      fern(g, bx, by, ang + 0.95, sl, w * 0.6, depth + 1);
      fern(g, bx, by, ang - 0.95, sl * (0.8 + 0.3 * ((i * 5) % 2)), w * 0.6, depth + 1);
    }
  }
}

export const frostKit: HeroKit = {
  name: 'Isolde',
  title: 'the Winter Warden',
  accent: F.body,
  foil: F.rime,
  maxHp: 600,
  portrait(g, s) {
    iconGround(g, s);
    // Frost fern fan behind, a tall crystal, and a hooded face with one pink glint.
    for (let i = 0; i < 5; i++) fern(g, s * 0.5, s * 0.92, -Math.PI / 2 + (i - 2) * 0.5, s * 0.5, s * 0.03);
    crystal(g, s * 0.82, s * 0.95, s * 0.7, s * 0.14, s * 0.12);
    crystal(g, s * 0.16, s * 0.95, s * 0.27, s * 0.3, s * 0.09);
    // Hood and coat.
    g.fillStyle = '#0d2038';
    g.beginPath();
    g.moveTo(s * 0.2, s);
    g.quadraticCurveTo(s * 0.24, s * 0.62, s * 0.34, s * 0.46);
    g.quadraticCurveTo(s * 0.5, s * 0.14, s * 0.66, s * 0.46);
    g.quadraticCurveTo(s * 0.76, s * 0.62, s * 0.8, s);
    g.closePath();
    g.fill();
    g.strokeStyle = F.rime;
    g.lineWidth = s * 0.016;
    g.stroke();
    // Face opening.
    g.fillStyle = '#c4dff0';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.5, s * 0.1, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = F.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.46, s * 0.1, s * 0.09, 0, Math.PI, Math.PI * 2);
    g.fill();
    // Eyes and the pink glint.
    g.fillStyle = F.body;
    g.fillRect(s * 0.44, s * 0.5, s * 0.04, s * 0.012);
    g.fillRect(s * 0.52, s * 0.5, s * 0.04, s * 0.012);
    g.fillStyle = F.accent;
    g.beginPath();
    g.arc(s * 0.5, s * 0.34, s * 0.018, 0, Math.PI * 2);
    g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'rime spear', name: 'Rime Spear', range: 12, cooldown: 3, aim: 'line',
      blurb: 'Throws an ice javelin down the aim that pierces everything it meets and slows it for 1.5 s.',
      icon(g, s) {
        iconGround(g, s);
        for (let i = 0; i < 3; i++) fern(g, s * 0.8, s * 0.82, Math.PI + (i - 1) * 0.55, s * 0.28, s * 0.02);
        crystal(g, s * 0.16, s * 0.84, s * 0.88, s * 0.14, s * 0.15);
        g.fillStyle = F.accent;
        g.beginPath();
        g.arc(s * 0.88, s * 0.14, s * 0.018, 0, Math.PI * 2);
        g.fill();
      },
    },
    {
      key: 'W', label: 'frostfern field', name: 'Frostfern Field', range: 9, cooldown: 7, aim: 'line', cc: true,
      blurb: 'Frost ferns race 9 m down the aim from her feet, then crack into crystals and root whoever is still in the strip.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = F.rime;
        g.lineWidth = s * 0.025;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.8, s * 0.4, s * 0.1, 0, 0, Math.PI * 2);
        g.stroke();
        for (let i = 0; i < 5; i++) fern(g, s * 0.5, s * 0.8, Math.PI + (i - 2) * 0.6, s * 0.34, s * 0.022);
        const cs: [number, number, number][] = [[0.24, 0.4, 0.1], [0.5, 0.18, 0.13], [0.76, 0.42, 0.1]];
        for (const [x, top, w] of cs) crystal(g, s * x, s * 0.82, s * (x + (x - 0.5) * 0.2), s * top, s * w);
      },
    },
    {
      key: 'E', label: 'glacial mantle', name: 'Glacial Mantle', range: 0, cooldown: 10,
      blurb: 'Ice block: she freezes herself solid for 1.5 s. Nothing can hurt her, and she cannot act. Then the ice shatters and a blizzard circles her, slowing enemies that come close.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = F.rime;
        g.lineWidth = s * 0.025;
        g.beginPath();
        g.arc(s * 0.5, s * 0.5, s * 0.4, 0.3, Math.PI * 1.55);
        g.stroke();
        const cx = s * 0.5, cy = s * 0.5;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.25;
          crystal(g, cx + Math.cos(a) * s * 0.07, cy + Math.sin(a) * s * 0.07, cx + Math.cos(a) * s * (i % 2 ? 0.27 : 0.34), cy + Math.sin(a) * s * (i % 2 ? 0.27 : 0.34), s * 0.11);
        }
        g.fillStyle = F.rime;
        g.beginPath();
        g.arc(cx, cy, s * 0.045, 0, Math.PI * 2);
        g.fill();
      },
    },
    {
      key: 'R', label: "winter's crown", name: "Winter's Crown", range: 0, cooldown: 20, cc: true,
      blurb: 'Ultimate. A colossal crown of ice forms over her and drives down: everything within 5 m is stunned.',
      icon(g, s) {
        iconGround(g, s);
        // Ground ferns, then an upside-down crown of crystals above them.
        for (let i = 0; i < 5; i++) fern(g, s * 0.5, s * 0.86, Math.PI + (i - 2) * 0.62, s * 0.32, s * 0.02);
        const teeth: [number, number][] = [[0.2, 0.58], [0.33, 0.7], [0.5, 0.76], [0.67, 0.7], [0.8, 0.58]];
        for (const [x, tip] of teeth) crystal(g, s * (x + (x - 0.5) * 0.25), s * 0.1, s * x, s * tip, s * 0.13);
        g.fillStyle = F.accent;
        g.beginPath();
        g.arc(s * 0.5, s * 0.82, s * 0.018, 0, Math.PI * 2);
        g.fill();
      },
    },
  ],
};
