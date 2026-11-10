import type { HeroKit } from '../heroes';

/**
 * Mole kit data: Mabel, the mole (new heroes, section 19). Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * a warm dark-soil ground, loose earth in browns, and the gold of her helmet lamp. Signature shape: the dark round pit with its raised
 * rim of dirt, and three gold claw strokes.
 */
const S = {
  core: '#fff6d6', foil: '#ffcf5a', soil: '#a98258', dirt: '#6b4e33', light: '#d9b98a', dark: '#2b1d12', deep: '#120b06', fur: '#4a3b34', snout: '#e8a9a0', steel: '#9aa3ad',
  // the Deepdelver's leather, bronze helm, lantern crystal, gold and claws (the _v3 model)
  leather: '#7a5030', leatherDark: '#3a2416', helm: '#6a5242', crystal: '#ffb040', gold: '#d2ae55', bone: '#d8cfae', nose: '#a85a6a',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#4a3524');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A hole seen from above-ish: a spoil ring, a black pit, a raised rim lit on the upper left, a few crumbs. */
function pit(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  g.fillStyle = S.dirt;
  g.beginPath();
  g.ellipse(cx, cy + ry * 0.08, rx * 1.3, ry * 1.3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = S.deep;
  g.beginPath();
  g.ellipse(cx, cy, rx * 1.08, ry * 1.08, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = S.soil;
  g.lineWidth = rx * 0.28;
  g.beginPath();
  g.ellipse(cx, cy, rx * 0.98, ry * 0.98, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = S.light;
  g.lineWidth = rx * 0.14;
  g.beginPath();
  g.ellipse(cx, cy, rx * 0.98, ry * 0.98, 0, Math.PI * 0.85, Math.PI * 1.55);
  g.stroke();
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(cx, cy + ry * 0.1, rx * 0.6, ry * 0.58, 0, 0, Math.PI * 2);
  g.fill();
}

/** A chunky clod with a dark outline. */
function clod(g: CanvasRenderingContext2D, x: number, y: number, r: number, c = S.soil, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, rr = r * (i % 2 ? 0.82 : 1.05);
    if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = c;
  g.fill();
  g.lineWidth = r * 0.22;
  g.strokeStyle = S.deep;
  g.stroke();
  g.restore();
}

/** A curved claw stroke from (x1,y1) to (x2,y2) bulging by `bend`: a dark band under a gold one. */
function stroke(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, bend: number, w: number, c = S.foil) {
  const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2 + bend * 0.2;
  g.lineCap = 'round';
  g.strokeStyle = S.deep;
  g.lineWidth = w * 1.7;
  g.beginPath();
  g.moveTo(x1, y1);
  g.quadraticCurveTo(mx, my, x2, y2);
  g.stroke();
  g.strokeStyle = c;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y1);
  g.quadraticCurveTo(mx, my, x2, y2);
  g.stroke();
}

/** A heap of loose earth with a lit crown and a little gold lamp on top. */
function mound(g: CanvasRenderingContext2D, cx: number, base: number, w: number, h: number, lamp = true) {
  g.fillStyle = S.deep;
  g.beginPath();
  g.moveTo(cx - w * 0.56, base + h * 0.04);
  g.quadraticCurveTo(cx - w * 0.34, base - h * 1.1, cx, base - h * 1.06);
  g.quadraticCurveTo(cx + w * 0.34, base - h * 1.1, cx + w * 0.56, base + h * 0.04);
  g.closePath();
  g.fill();
  g.fillStyle = S.soil;
  g.beginPath();
  g.moveTo(cx - w * 0.5, base);
  g.quadraticCurveTo(cx - w * 0.3, base - h * 0.98, cx, base - h);
  g.quadraticCurveTo(cx + w * 0.3, base - h * 0.98, cx + w * 0.5, base);
  g.closePath();
  g.fill();
  g.fillStyle = S.light;
  g.beginPath();
  g.moveTo(cx - w * 0.2, base - h * 0.5);
  g.quadraticCurveTo(cx - w * 0.12, base - h * 0.95, cx, base - h * 0.98);
  g.quadraticCurveTo(cx + w * 0.06, base - h * 0.85, cx - w * 0.04, base - h * 0.5);
  g.closePath();
  g.fill();
  if (lamp) {
    const r = g.createRadialGradient(cx, base - h * 1.05, 1, cx, base - h * 1.05, w * 0.24);
    r.addColorStop(0, 'rgba(255,246,214,1)');
    r.addColorStop(0.4, 'rgba(255,207,90,0.8)');
    r.addColorStop(1, 'rgba(255,207,90,0)');
    g.fillStyle = r;
    g.fillRect(cx - w * 0.3, base - h * 1.4, w * 0.6, w * 0.6);
  }
}

/** A small pickaxe, handle from (x,y) up to the head, tilted by `rot`. */
function pick(g: CanvasRenderingContext2D, x: number, y: number, len: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.lineCap = 'round';
  g.strokeStyle = S.deep;
  g.lineWidth = len * 0.16;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -len);
  g.stroke();
  g.strokeStyle = S.dirt;
  g.lineWidth = len * 0.09;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -len);
  g.stroke();
  g.beginPath();
  g.moveTo(-len * 0.5, -len * 0.82);
  g.quadraticCurveTo(0, -len * 1.2, len * 0.5, -len * 0.82);
  g.quadraticCurveTo(0, -len * 1.02, -len * 0.5, -len * 0.82);
  g.fillStyle = S.steel;
  g.fill();
  g.strokeStyle = S.deep;
  g.lineWidth = len * 0.06;
  g.stroke();
  g.fillStyle = S.foil;
  g.beginPath();
  g.arc(len * 0.5, -len * 0.82, len * 0.06, 0, Math.PI * 2);
  g.arc(-len * 0.5, -len * 0.82, len * 0.06, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export const moleKit: HeroKit = {
  name: 'Mabel',
  maxHp: 680,
  melee: true,
  title: 'the Deepdelver',
  accent: '#8a6a4a',
  foil: '#ffcf5a',
  portrait(g, s) {
    iconGround(g, s);
    // A soil bank behind her with a dug-out tunnel mouth.
    g.fillStyle = S.dirt;
    g.fillRect(0, s * 0.74, s, s * 0.26);
    g.fillStyle = S.soil;
    g.fillRect(0, s * 0.74, s, s * 0.02);
    // The pick slung across her back, its head over her left shoulder.
    pick(g, s * 0.3, s * 0.82, s * 0.62, -0.45);
    // Her body: a stout round frame in a studded leather cuirass with gold straps.
    g.fillStyle = S.fur;
    g.beginPath();
    g.moveTo(s * 0.14, s);
    g.quadraticCurveTo(s * 0.16, s * 0.68, s * 0.34, s * 0.62);
    g.quadraticCurveTo(s * 0.5, s * 0.58, s * 0.66, s * 0.62);
    g.quadraticCurveTo(s * 0.84, s * 0.68, s * 0.86, s);
    g.closePath();
    g.fill();
    g.fillStyle = S.leather;
    g.beginPath();
    g.moveTo(s * 0.26, s);
    g.quadraticCurveTo(s * 0.28, s * 0.7, s * 0.4, s * 0.64);
    g.lineTo(s * 0.6, s * 0.64);
    g.quadraticCurveTo(s * 0.72, s * 0.7, s * 0.74, s);
    g.closePath();
    g.fill();
    g.fillStyle = S.leatherDark;
    g.fillRect(s * 0.37, s * 0.64, s * 0.04, s * 0.36);
    g.fillRect(s * 0.59, s * 0.64, s * 0.04, s * 0.36);
    g.fillStyle = S.gold;
    for (const [sx, sy] of [[0.45, 0.76], [0.55, 0.76], [0.45, 0.84], [0.55, 0.84], [0.45, 0.92], [0.55, 0.92]]) {
      g.beginPath();
      g.arc(s * sx, s * sy, s * 0.012, 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(s * 0.455, s * 0.68, s * 0.09, s * 0.035);
    // The head: a dark fur wedge with a long muzzle and a small dusky-rose nose, small calm black eyes.
    g.fillStyle = S.fur;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.47, s * 0.2, s * 0.17, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#6a554c';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.55, s * 0.1, s * 0.085, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.nose;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.585, s * 0.05, s * 0.036, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = S.deep;
    for (const sx of [0.39, 0.61]) {
      g.beginPath();
      g.ellipse(s * sx, s * 0.48, s * 0.022, s * 0.03, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.core;
      g.beginPath();
      g.arc(s * (sx + 0.007), s * 0.47, s * 0.007, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.deep;
    }
    g.strokeStyle = S.deep;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(s * 0.47, s * 0.62);
    g.quadraticCurveTo(s * 0.5, s * 0.635, s * 0.53, s * 0.62);
    g.stroke();
    // The close bronze helm with a gold band, brass goggles pushed up on its brow, the glowing crystal lantern on top.
    g.fillStyle = S.helm;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.36, s * 0.2, s * 0.125, 0, Math.PI, Math.PI * 2);
    g.closePath();
    g.fill();
    g.fillStyle = S.gold;
    g.fillRect(s * 0.3, s * 0.352, s * 0.4, s * 0.024);
    g.strokeStyle = S.gold;
    g.lineWidth = s * 0.011;
    for (const sx of [0.42, 0.58]) {
      g.beginPath();
      g.arc(s * sx, s * 0.325, s * 0.03, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#b8742a';
      g.fill();
    }
    const glow = g.createRadialGradient(s * 0.5, s * 0.17, 1, s * 0.5, s * 0.17, s * 0.24);
    glow.addColorStop(0, 'rgba(255,200,100,0.95)');
    glow.addColorStop(0.35, 'rgba(255,160,40,0.5)');
    glow.addColorStop(1, 'rgba(255,160,40,0)');
    g.fillStyle = glow;
    g.fillRect(s * 0.25, s * 0, s * 0.5, s * 0.4);
    g.strokeStyle = S.gold;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(s * 0.45, s * 0.25);
    g.lineTo(s * 0.41, s * 0.17);
    g.lineTo(s * 0.5, s * 0.07);
    g.lineTo(s * 0.59, s * 0.17);
    g.lineTo(s * 0.55, s * 0.25);
    g.closePath();
    g.fillStyle = S.crystal;
    g.fill();
    g.stroke();
    g.fillStyle = S.core;
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.11);
    g.lineTo(s * 0.54, s * 0.17);
    g.lineTo(s * 0.5, s * 0.22);
    g.lineTo(s * 0.46, s * 0.17);
    g.closePath();
    g.fill();
    // Huge digging claws at the edges of the frame, each tipped in gold, and a gold-banded bracer.
    for (const sx of [0.1, 0.9]) {
      g.fillStyle = S.fur;
      g.beginPath();
      g.ellipse(s * sx, s * 0.8, s * 0.095, s * 0.075, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.leatherDark;
      g.fillRect(s * (sx - 0.095), s * 0.86, s * 0.19, s * 0.04);
      g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        g.strokeStyle = S.bone;
        g.lineWidth = s * 0.016;
        g.beginPath();
        g.moveTo(s * (sx + i * 0.03), s * 0.76);
        g.lineTo(s * (sx + i * 0.045), s * 0.68);
        g.stroke();
        g.strokeStyle = S.gold;
        g.beginPath();
        g.moveTo(s * (sx + i * 0.042), s * 0.695);
        g.lineTo(s * (sx + i * 0.045), s * 0.68);
        g.stroke();
      }
    }
  },
  spells: [
    {
      key: 'Q', label: 'mole claw', name: 'Claw', range: 2.5, cooldown: 3,
      blurb: 'A swipe of her digging claws, 2.5 m in front of her: 68 damage.',
      icon(g, s) {
        iconGround(g, s);
        stroke(g, s * 0.16, s * 0.84, s * 0.4, s * 0.16, -s * 0.08, s * 0.07);
        stroke(g, s * 0.38, s * 0.88, s * 0.64, s * 0.2, -s * 0.08, s * 0.08, S.core);
        stroke(g, s * 0.6, s * 0.9, s * 0.86, s * 0.28, -s * 0.08, s * 0.07);
        clod(g, s * 0.84, s * 0.64, s * 0.05, S.light, 0.4);
        clod(g, s * 0.9, s * 0.8, s * 0.04, S.soil, 1);
        clod(g, s * 0.12, s * 0.3, s * 0.045, S.dirt, 0.2);
      },
    },
    {
      key: 'W', label: 'mole dig', name: 'Dig', range: 6, cooldown: 7,
      blurb: 'A hole at a spot (6 m), opening after 0.7 s, 1.5 m in radius. It stays 8 s, three at most. Whoever walks in falls: rooted 0.8 s, then slowed. She walks across her own.',
      icon(g, s) {
        iconGround(g, s);
        pit(g, s * 0.5, s * 0.64, s * 0.3, s * 0.17);
        pick(g, s * 0.62, s * 0.52, s * 0.4, 0.5);
        clod(g, s * 0.2, s * 0.4, s * 0.06, S.light, 0.3);
        clod(g, s * 0.82, s * 0.3, s * 0.05, S.soil, 0.9);
        clod(g, s * 0.3, s * 0.18, s * 0.04, S.foil, 0.1);
      },
    },
    {
      key: 'E', label: 'mole tunnel', name: 'Mole Run', range: 7.2, cooldown: 10, dash: true,
      blurb: 'She dives (0.3 s) and tunnels up to 7.2 m in 1.2 s, 40% faster than she walks, a mound on the surface showing where. Nothing can hit her and she cannot cast. She pops up: 60 and a 0.5 s knock-up within 1.5 m.',
      icon(g, s) {
        iconGround(g, s);
        // The furrow runs from a dark pit on the left up to the mound.
        g.fillStyle = S.deep;
        g.beginPath();
        g.moveTo(s * 0.12, s * 0.8);
        g.quadraticCurveTo(s * 0.4, s * 0.84, s * 0.66, s * 0.78);
        g.lineTo(s * 0.7, s * 0.86);
        g.quadraticCurveTo(s * 0.4, s * 0.94, s * 0.1, s * 0.9);
        g.closePath();
        g.fill();
        pit(g, s * 0.16, s * 0.84, s * 0.13, s * 0.07);
        mound(g, s * 0.68, s * 0.84, s * 0.46, s * 0.44);
        clod(g, s * 0.48, s * 0.56, s * 0.045, S.light, 0.4);
        clod(g, s * 0.9, s * 0.5, s * 0.045, S.soil, 0.2);
        clod(g, s * 0.8, s * 0.22, s * 0.04, S.dirt, 0.6);
      },
    },
    {
      key: 'R', label: 'sinkhole', name: 'Sinkhole', range: 9, cooldown: 24,
      blurb: 'The ground drops under the enemy: a pit 4 m in radius at their spot (9 m, sight needed), 1.3 s warning. Whoever is inside takes 115 and is rooted 1 s.',
      icon(g, s) {
        iconGround(g, s);
        // Cracks run in to a big pit; a boot-print of pale dust at the rim.
        g.strokeStyle = S.foil;
        g.lineWidth = s * 0.02;
        g.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.3;
          g.beginPath();
          g.moveTo(s * (0.5 + Math.cos(a) * 0.3), s * (0.54 + Math.sin(a) * 0.18));
          g.lineTo(s * (0.5 + Math.cos(a + 0.1) * 0.47), s * (0.54 + Math.sin(a + 0.1) * 0.3));
          g.stroke();
        }
        pit(g, s * 0.5, s * 0.54, s * 0.34, s * 0.22);
        clod(g, s * 0.15, s * 0.2, s * 0.05, S.light, 0.3);
        clod(g, s * 0.86, s * 0.24, s * 0.05, S.soil, 0.7);
        clod(g, s * 0.5, s * 0.14, s * 0.045, S.foil, 0.2);
      },
    },
  ],
};
