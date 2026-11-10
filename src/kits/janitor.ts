import type { HeroKit } from '../heroes';

/**
 * Janitor kit data: Gus, the Caretaker (kits v5). Four spells (labels as registered), canvas-drawn icons in the kit's palette: a deep
 * blue ground, soapy pale-blue water and white foam, safety yellow, grey overalls. Signature shapes: the mop with its strings, the
 * yellow A-frame sign, the wheeled bucket, and a wet floor with a shine across it.
 */
const S = {
  core: '#f2f6f8', foam: '#e4f1f6', pale: '#c4e4f2', water: '#74c0ea', deep: '#3a6a8a', yellow: '#ffd23a', yellowDeep: '#d9a514',
  grey: '#8a929a', greyDark: '#4a5058', steel: '#b4bcc4', rubber: '#23282e', wood: '#a4906a', string: '#d8d6c8', dark: '#0f1a24', skin: '#e0b79a',
  // the Temple Keeper's robe, hat, beard, bronze, straw and glowing water (the _v3 model)
  robe: '#44546c', collar: '#7a8aa4', sash: '#242a3a', bronze: '#a07040', bronzeDark: '#6a4a28', hat: '#37323f', beard: '#a8a4a0', haft: '#5a4030', straw: '#b8a070', paper: '#c4bcaa', aqua: '#7adfff',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#24465e');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A puddle of wet floor: a dark underlay, pale water, a shine and a bright rim, centred on (cx, cy). */
function puddle(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rot = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.fillStyle = S.deep;
  g.beginPath(); g.ellipse(0, 0, rx * 1.06, ry * 1.1, 0, 0, Math.PI * 2); g.fill();
  const gr = g.createLinearGradient(-rx, -ry, rx, ry);
  gr.addColorStop(0, S.pale);
  gr.addColorStop(0.5, S.water);
  gr.addColorStop(1, '#4f98c4');
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = S.core;
  g.lineCap = 'round';
  g.lineWidth = ry * 0.22;
  g.beginPath(); g.moveTo(-rx * 0.55, ry * 0.1); g.lineTo(rx * 0.15, -ry * 0.45); g.stroke();
  g.lineWidth = ry * 0.09;
  g.beginPath(); g.moveTo(-rx * 0.15, ry * 0.5); g.lineTo(rx * 0.5, ry * 0.05); g.stroke();
  g.strokeStyle = S.foam;
  g.lineWidth = ry * 0.07;
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.stroke();
  g.restore();
}

/** A bubble: a pale ring with a bright speck. */
function bubble(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = 'rgba(196,228,242,0.28)';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = S.pale;
  g.lineWidth = r * 0.16;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.fillStyle = S.core;
  g.beginPath(); g.arc(x - r * 0.35, y - r * 0.4, r * 0.2, 0, Math.PI * 2); g.fill();
}

/** A mop with its head at (x, y) and the handle going up and to the right at `rot` (0 = straight up). `h` is the handle's length. */
function mop(g: CanvasRenderingContext2D, x: number, y: number, h: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = S.dark;
  g.fillRect(-h * 0.034, -h, h * 0.068, h);
  g.fillStyle = S.wood;
  g.fillRect(-h * 0.022, -h, h * 0.044, h);
  g.fillStyle = S.dark;
  g.fillRect(-h * 0.09, -h * 0.07, h * 0.18, h * 0.1);
  g.fillStyle = S.steel;
  g.fillRect(-h * 0.075, -h * 0.06, h * 0.15, h * 0.075);
  for (let i = 0; i < 9; i++) {
    const k = i / 8 - 0.5;
    g.strokeStyle = i % 3 ? S.string : S.pale;
    g.lineWidth = h * 0.035;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(k * h * 0.12, h * 0.03);
    g.quadraticCurveTo(k * h * 0.28, h * 0.14, k * h * 0.42, h * 0.27);
    g.stroke();
  }
  g.restore();
}

/** The yellow A-frame sign standing on its feet at (cx, base), `h` tall: a pictogram of someone slipping. */
function sign(g: CanvasRenderingContext2D, cx: number, base: number, h: number) {
  const w = h * 0.7, top = base - h;
  g.fillStyle = S.dark;
  g.beginPath(); g.moveTo(cx - w * 0.28, top - h * 0.03); g.lineTo(cx + w * 0.28, top - h * 0.03); g.lineTo(cx + w * 0.54, base + h * 0.03); g.lineTo(cx - w * 0.54, base + h * 0.03); g.closePath(); g.fill();
  g.fillStyle = S.yellow;
  g.beginPath(); g.moveTo(cx - w * 0.22, top); g.lineTo(cx + w * 0.22, top); g.lineTo(cx + w * 0.48, base); g.lineTo(cx - w * 0.48, base); g.closePath(); g.fill();
  g.fillStyle = S.yellowDeep;
  g.beginPath(); g.moveTo(cx + w * 0.22, top); g.lineTo(cx + w * 0.28, top + h * 0.02); g.lineTo(cx + w * 0.54, base); g.lineTo(cx + w * 0.48, base); g.closePath(); g.fill();
  // The slipping figure.
  g.strokeStyle = S.dark;
  g.fillStyle = S.dark;
  g.lineCap = 'round';
  g.lineWidth = h * 0.045;
  const px = cx, py = top + h * 0.28;
  g.beginPath(); g.arc(px - h * 0.03, py, h * 0.05, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(px, py + h * 0.06); g.lineTo(px + h * 0.05, py + h * 0.24); g.stroke();
  g.beginPath(); g.moveTo(px + h * 0.01, py + h * 0.11); g.lineTo(px - h * 0.12, py + h * 0.04); g.stroke();
  g.beginPath(); g.moveTo(px + h * 0.05, py + h * 0.24); g.lineTo(px - h * 0.07, py + h * 0.37); g.stroke();
  g.beginPath(); g.moveTo(px + h * 0.05, py + h * 0.24); g.lineTo(px + h * 0.16, py + h * 0.33); g.stroke();
  g.fillStyle = S.deep;
  g.beginPath(); g.ellipse(px + h * 0.02, py + h * 0.4, h * 0.2, h * 0.035, 0, 0, Math.PI * 2); g.fill();
}

/** The wheeled bucket at (cx, cy) (its middle), `h` tall, tipped by `rot`. */
function bucket(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, rot = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  const w = h * 1.1;
  g.fillStyle = S.dark;
  g.beginPath(); g.moveTo(-w * 0.55, -h * 0.5); g.lineTo(w * 0.55, -h * 0.5); g.lineTo(w * 0.4, h * 0.42); g.lineTo(-w * 0.4, h * 0.42); g.closePath(); g.fill();
  g.fillStyle = '#4f86a8';
  g.beginPath(); g.moveTo(-w * 0.5, -h * 0.45); g.lineTo(w * 0.5, -h * 0.45); g.lineTo(w * 0.36, h * 0.38); g.lineTo(-w * 0.36, h * 0.38); g.closePath(); g.fill();
  g.fillStyle = S.yellow;
  g.beginPath(); g.moveTo(-w * 0.485, -h * 0.25); g.lineTo(w * 0.485, -h * 0.25); g.lineTo(w * 0.455, -h * 0.05); g.lineTo(-w * 0.455, -h * 0.05); g.closePath(); g.fill();
  g.fillStyle = S.water;
  g.beginPath(); g.ellipse(0, -h * 0.45, w * 0.5, h * 0.1, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = S.steel;
  g.lineWidth = h * 0.05;
  g.beginPath(); g.ellipse(0, -h * 0.45, w * 0.5, h * 0.1, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = S.core;
  g.lineWidth = h * 0.04;
  g.beginPath(); g.moveTo(-w * 0.3, -h * 0.4); g.lineTo(-w * 0.12, -h * 0.48); g.stroke();
  g.fillStyle = S.rubber;
  for (const wx of [-0.3, 0.3]) { g.beginPath(); g.arc(wx * w, h * 0.5, h * 0.1, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

export const janitorKit: HeroKit = {
  name: 'Gus',
  maxHp: 700,
  melee: true,
  title: 'the Temple Keeper',
  accent: S.yellow,
  foil: S.deep,
  portrait(g, s) {
    iconGround(g, s);
    // The ritual sweeping staff behind his shoulder: a straw head with white paper streamers.
    g.strokeStyle = S.haft;
    g.lineWidth = s * 0.022;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 0.84, s);
    g.lineTo(s * 0.8, s * 0.2);
    g.stroke();
    g.strokeStyle = S.straw;
    g.lineWidth = s * 0.02;
    for (let i = 0; i < 9; i++) {
      const dx = (i - 4) * s * 0.026;
      g.beginPath();
      g.moveTo(s * 0.8, s * 0.2);
      g.lineTo(s * 0.8 + dx * 1.6, s * 0.02);
      g.stroke();
    }
    g.fillStyle = S.paper;
    for (const dx of [-0.05, 0.05]) {
      g.beginPath();
      g.moveTo(s * (0.8 + dx), s * 0.22);
      g.lineTo(s * (0.8 + dx + 0.03), s * 0.3);
      g.lineTo(s * (0.8 + dx - 0.01), s * 0.36);
      g.lineTo(s * (0.8 + dx + 0.03), s * 0.43);
      g.lineTo(s * (0.8 + dx + 0.045), s * 0.41);
      g.lineTo(s * (0.8 + dx + 0.01), s * 0.35);
      g.lineTo(s * (0.8 + dx + 0.05), s * 0.29);
      g.lineTo(s * (0.8 + dx + 0.02), s * 0.22);
      g.closePath();
      g.fill();
    }
    // Broad shoulders in grey-blue robes, the pale crossed collar, a dark sash with a bronze cord.
    g.fillStyle = S.robe;
    g.beginPath();
    g.moveTo(s * 0.06, s);
    g.quadraticCurveTo(s * 0.1, s * 0.72, s * 0.3, s * 0.64);
    g.lineTo(s * 0.7, s * 0.64);
    g.quadraticCurveTo(s * 0.9, s * 0.72, s * 0.94, s);
    g.closePath();
    g.fill();
    g.fillStyle = S.collar;
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * (0.5 + dir * 0.13), s * 0.64);
      g.lineTo(s * (0.5 - dir * 0.04), s * 0.86);
      g.lineTo(s * (0.5 - dir * 0.09), s * 0.84);
      g.lineTo(s * (0.5 + dir * 0.06), s * 0.64);
      g.closePath();
      g.fill();
    }
    g.fillStyle = S.sash;
    g.fillRect(s * 0.2, s * 0.9, s * 0.6, s * 0.06);
    g.fillStyle = S.bronze;
    g.fillRect(s * 0.2, s * 0.915, s * 0.6, s * 0.012);
    // The bronze water urn at his side, the water glowing aqua.
    const glow = g.createRadialGradient(s * 0.17, s * 0.74, 0, s * 0.17, s * 0.74, s * 0.16);
    glow.addColorStop(0, 'rgba(90,200,255,0.8)');
    glow.addColorStop(1, 'rgba(60,170,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, s * 0.56, s * 0.36, s * 0.36);
    g.fillStyle = S.bronze;
    g.beginPath();
    g.moveTo(s * 0.04, s * 0.74);
    g.quadraticCurveTo(s * 0.02, s * 0.94, s * 0.12, s);
    g.lineTo(s * 0.24, s);
    g.quadraticCurveTo(s * 0.34, s * 0.94, s * 0.31, s * 0.74);
    g.closePath();
    g.fill();
    g.fillStyle = S.bronzeDark;
    g.fillRect(s * 0.04, s * 0.86, s * 0.27, s * 0.016);
    g.fillStyle = S.bronze;
    g.beginPath();
    g.ellipse(s * 0.175, s * 0.74, s * 0.14, s * 0.035, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.aqua;
    g.beginPath();
    g.ellipse(s * 0.175, s * 0.74, s * 0.11, s * 0.024, 0, 0, Math.PI * 2);
    g.fill();
    // A calm, heavy-lidded old face with a short grey beard.
    g.fillStyle = S.skin;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.46, s * 0.14, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.beard;
    g.beginPath();
    g.moveTo(s * 0.37, s * 0.5);
    g.quadraticCurveTo(s * 0.4, s * 0.68, s * 0.5, s * 0.7);
    g.quadraticCurveTo(s * 0.6, s * 0.68, s * 0.63, s * 0.5);
    g.quadraticCurveTo(s * 0.5, s * 0.56, s * 0.37, s * 0.5);
    g.closePath();
    g.fill();
    for (const sx of [0.44, 0.56]) {
      g.fillStyle = S.core;
      g.beginPath();
      g.ellipse(s * sx, s * 0.455, s * 0.026, s * 0.024, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.dark;
      g.beginPath();
      g.arc(s * sx, s * 0.46, s * 0.013, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.skin;
      g.beginPath();
      g.ellipse(s * sx, s * 0.44, s * 0.03, s * 0.016, 0, Math.PI, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = S.beard;
    g.lineWidth = s * 0.012;
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * (0.5 + dir * 0.03), s * 0.415);
      g.lineTo(s * (0.5 + dir * 0.09), s * 0.425);
      g.stroke();
    }
    // The broad flat lacquered hat, a bronze rim, a boss on top.
    g.fillStyle = S.hat;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.34, s * 0.3, s * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.34, s * 0.34);
    g.quadraticCurveTo(s * 0.36, s * 0.16, s * 0.5, s * 0.16);
    g.quadraticCurveTo(s * 0.64, s * 0.16, s * 0.66, s * 0.34);
    g.closePath();
    g.fill();
    g.strokeStyle = S.bronze;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.34, s * 0.3, s * 0.05, 0, 0, Math.PI);
    g.stroke();
    g.fillStyle = S.bronze;
    g.beginPath();
    g.arc(s * 0.5, s * 0.165, s * 0.02, 0, Math.PI * 2);
    g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'big mop', name: 'Big Mop', range: 3.5, cooldown: 3.5,
      blurb: 'A mop swipe in front of him (3.5 m, 0.3 s): 60 damage, and a strip of wet floor 6 m long. It wipes your rods, flowers and ink along the strip.',
      icon(g, s) {
        iconGround(g, s);
        // A wet strip running up the right, a wide swipe of foam, and the mop in the middle of it.
        puddle(g, s * 0.62, s * 0.56, s * 0.42, s * 0.14, -0.55);
        g.strokeStyle = S.foam;
        g.globalAlpha = 0.85;
        g.lineWidth = s * 0.05;
        g.lineCap = 'round';
        g.beginPath(); g.arc(s * 0.3, s * 0.78, s * 0.5, -1.15, -0.2); g.stroke();
        g.lineWidth = s * 0.02;
        g.beginPath(); g.arc(s * 0.3, s * 0.78, s * 0.58, -1.1, -0.3); g.stroke();
        g.globalAlpha = 1;
        mop(g, s * 0.4, s * 0.74, s * 0.62, 0.7);
        bubble(g, s * 0.78, s * 0.28, s * 0.05);
        bubble(g, s * 0.64, s * 0.2, s * 0.03);
        bubble(g, s * 0.88, s * 0.5, s * 0.03);
      },
    },
    {
      key: 'W', label: 'wet floor sign', name: 'Wet Floor Sign', range: 8, cooldown: 0.8, summon: true,
      blurb: 'A folding sign at a spot (8 m) for 6 s, a real obstacle with 40 health. A hero who slides into it takes 40 and is stunned 0.6 s. Two charges, one back every 8 s.',
      icon(g, s) {
        iconGround(g, s);
        puddle(g, s * 0.5, s * 0.88, s * 0.44, s * 0.1);
        sign(g, s * 0.5, s * 0.88, s * 0.74);
        bubble(g, s * 0.18, s * 0.3, s * 0.05);
        bubble(g, s * 0.84, s * 0.22, s * 0.035);
      },
    },
    {
      key: 'E', label: 'mop bucket', name: 'Mop Bucket', range: 8, cooldown: 10, aim: 'line',
      blurb: 'He throws the wheeled bucket (8 m, 0.3 s wind-up): 55 damage, and the floor 2.5 m round where it stops is wet.',
      icon(g, s) {
        iconGround(g, s);
        // A puddle where it lands, the bucket tumbling in from the left, a trail of drops.
        puddle(g, s * 0.68, s * 0.8, s * 0.3, s * 0.1);
        for (let i = 0; i < 6; i++) {
          g.fillStyle = i % 2 ? S.pale : S.water;
          g.beginPath(); g.ellipse(s * (0.1 + i * 0.045), s * (0.4 + i * 0.012), s * 0.018, s * 0.028, -0.5, 0, Math.PI * 2); g.fill();
        }
        bucket(g, s * 0.48, s * 0.46, s * 0.36, 0.95);
        bubble(g, s * 0.82, s * 0.5, s * 0.045);
        bubble(g, s * 0.74, s * 0.3, s * 0.03);
      },
    },
    {
      key: 'R', label: 'flood', name: 'Flood', range: 0, cooldown: 24,
      blurb: 'After a 1 s warning the whole floor within 7 m of him is wet for 5 s. He surfs on it: +35% speed. Stand near cover, which stops a slide, or walk straight lines.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = 'rgba(196,228,242,0.5)';
        g.lineWidth = s * 0.014;
        g.beginPath(); g.ellipse(s * 0.5, s * 0.6, s * 0.46, s * 0.27, 0, 0, Math.PI * 2); g.stroke();
        puddle(g, s * 0.5, s * 0.62, s * 0.4, s * 0.22);
        // A wave rolling over the middle with a foamy crest, and bubbles above it.
        g.fillStyle = S.water;
        g.beginPath();
        g.moveTo(s * 0.14, s * 0.66);
        g.quadraticCurveTo(s * 0.2, s * 0.3, s * 0.52, s * 0.28);
        g.quadraticCurveTo(s * 0.72, s * 0.27, s * 0.74, s * 0.42);
        g.quadraticCurveTo(s * 0.6, s * 0.36, s * 0.52, s * 0.46);
        g.quadraticCurveTo(s * 0.62, s * 0.6, s * 0.86, s * 0.66);
        g.closePath();
        g.fill();
        g.strokeStyle = S.foam;
        g.lineWidth = s * 0.035;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(s * 0.2, s * 0.5); g.quadraticCurveTo(s * 0.26, s * 0.3, s * 0.52, s * 0.28); g.quadraticCurveTo(s * 0.7, s * 0.27, s * 0.73, s * 0.4); g.stroke();
        g.strokeStyle = S.core;
        g.lineWidth = s * 0.012;
        g.beginPath(); g.moveTo(s * 0.3, s * 0.42); g.quadraticCurveTo(s * 0.4, s * 0.34, s * 0.54, s * 0.34); g.stroke();
        bubble(g, s * 0.22, s * 0.22, s * 0.05);
        bubble(g, s * 0.8, s * 0.24, s * 0.04);
        bubble(g, s * 0.68, s * 0.14, s * 0.03);
        mop(g, s * 0.34, s * 0.78, s * 0.4, -0.4);
      },
    },
  ],
};
