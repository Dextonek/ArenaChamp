import type { HeroKit } from '../heroes';

/**
 * Ledger kit data: Mr. Ledger, the Debt Collector (kits v5, new heroes). Four spells (labels as registered), canvas-drawn icons in
 * the kit's palette: a dark green cloth ground, cream paper, black ink, red rubber-stamp ink and gold leaf. Signature shape: a sheet
 * of ruled paper with a red stamp across it.
 */
const L = {
  core: '#f5edd0', hot: '#efe4c0', paper: '#e6d9ae', shade: '#b9aa7c', gold: '#d9c27a', brass: '#b08a3a', foil: '#3f4a3a',
  cloth: '#2d3a2c', wood: '#6d4a2a', ink: '#1c211c', red: '#b3261e', hotRed: '#d9453a', dark: '#161a14', suit: '#8a9088',
  // the Tithe-Keeper's robe, collar, book, quill and wax seal (the _v3 model)
  robe: '#2c2030', oxblood: '#7a2230', cover: '#6a1a26', goldRobe: '#d2ae55', hair: '#8c8c98', vane: '#8a7a98', seal: '#ff5a3c',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#4a5a48');
  r.addColorStop(1, L.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A sheet of paper centred at (cx,cy), `w` x `h`, turned by `rot`: ruled rows, a dollar total, and with `stamp` a red stamp across it. */
function sheet(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, rot = 0, stamp = '') {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.fillStyle = L.dark;
  g.fillRect(-w / 2 - w * 0.05, -h / 2 - w * 0.05, w * 1.1, h + w * 0.1);
  g.fillStyle = L.paper;
  g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle = L.shade;
  g.fillRect(-w / 2, -h / 2, w, h * 0.07);
  g.fillStyle = L.ink;
  g.fillRect(-w * 0.34, -h * 0.34, w * 0.68, h * 0.07);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = L.shade;
    g.fillRect(-w * 0.38, -h * 0.17 + i * h * 0.13, w * 0.76, h * 0.025);
    g.fillStyle = L.ink;
    g.fillRect(-w * 0.34, -h * 0.2 + i * h * 0.13, w * (0.22 + ((i * 3) % 4) * 0.08), h * 0.035);
  }
  g.font = `900 ${Math.round(h * 0.2)}px Georgia, serif`;
  g.textAlign = 'left';
  g.fillStyle = L.ink;
  g.fillText('$', -w * 0.38, h * 0.43);
  g.fillRect(-w * 0.2, h * 0.4, w * 0.55, h * 0.03);
  if (stamp) {
    g.save();
    g.rotate(-0.38);
    g.translate(w * 0.06, h * 0.08);
    g.strokeStyle = L.hotRed;
    g.fillStyle = L.hotRed;
    g.lineWidth = Math.max(2, w * 0.05);
    g.strokeRect(-w * 0.38, -h * 0.12, w * 0.76, h * 0.24);
    g.font = `900 ${Math.round(h * 0.17)}px Impact, Arial Black, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(stamp, 0, h * 0.01, w * 0.68);
    g.restore();
  }
  g.restore();
}

/** A speed streak behind a flying paper. */
function streak(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  g.lineCap = 'round';
  g.strokeStyle = L.gold;
  g.globalAlpha = 0.75;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  g.globalAlpha = 1;
  g.strokeStyle = L.core;
  g.lineWidth = w * 0.35;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

/** A gold coin. */
function coin(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = L.dark;
  g.beginPath();
  g.ellipse(x, y, r * 1.15, r * 1.15 * 0.8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = L.gold;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = L.brass;
  g.lineWidth = r * 0.16;
  g.beginPath();
  g.ellipse(x, y, r * 0.62, r * 0.5, 0, 0, Math.PI * 2);
  g.stroke();
}

/** The ledger: a dark green cover with gold corners and a label; `open` draws it spread with ruled pages. */
function tome(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, open = false) {
  g.save();
  g.translate(cx, cy);
  if (open) {
    g.fillStyle = L.dark;
    g.fillRect(-w * 0.56, -h * 0.52, w * 1.12, h * 1.04);
    g.fillStyle = L.cloth;
    g.fillRect(-w * 0.52, -h * 0.48, w * 1.04, h * 0.96);
    g.fillStyle = L.paper;
    g.fillRect(-w * 0.47, -h * 0.42, w * 0.45, h * 0.84);
    g.fillRect(w * 0.02, -h * 0.42, w * 0.45, h * 0.84);
    g.fillStyle = L.shade;
    g.fillRect(-w * 0.02, -h * 0.42, w * 0.04, h * 0.84);
    for (let i = 0; i < 6; i++) {
      g.fillRect(-w * 0.43, -h * 0.3 + i * h * 0.12, w * 0.37, h * 0.015);
      g.fillRect(w * 0.06, -h * 0.3 + i * h * 0.12, w * 0.37, h * 0.015);
    }
    g.strokeStyle = L.ink;
    g.lineWidth = h * 0.03;
    g.beginPath();
    g.moveTo(w * 0.08, -h * 0.2);
    for (let i = 0; i < 8; i++) g.lineTo(w * (0.1 + i * 0.045), -h * 0.2 + (i % 2 ? -0.05 : 0.04) * h + i * h * 0.01);
    g.stroke();
  } else {
    g.fillStyle = L.dark;
    g.fillRect(-w / 2 - w * 0.04, -h / 2 - w * 0.04, w * 1.08, h + w * 0.08);
    g.fillStyle = L.cloth;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = L.dark;
    g.fillRect(-w / 2, -h / 2, w * 0.1, h);
    g.fillStyle = L.gold;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) g.fillRect(sx > 0 ? w / 2 - w * 0.16 : -w / 2, sy > 0 ? h / 2 - w * 0.16 : -h / 2, w * 0.16, w * 0.16);
    g.fillStyle = L.paper;
    g.fillRect(-w * 0.2, -h * 0.28, w * 0.46, h * 0.3);
    g.fillStyle = L.ink;
    g.fillRect(-w * 0.14, -h * 0.2, w * 0.34, h * 0.04);
    g.fillRect(-w * 0.14, -h * 0.11, w * 0.24, h * 0.04);
  }
  g.restore();
}

/** A red rubber stamp seen from the side: a round knob, a neck, a wooden block with a brass band and the red face. */
function stampTool(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = L.dark;
  g.beginPath();
  g.arc(0, -s * 0.5, s * 0.2, 0, Math.PI * 2);
  g.fill();
  g.fillRect(-s * 0.1, -s * 0.4, s * 0.2, s * 0.3);
  g.fillRect(-s * 0.37, -s * 0.12, s * 0.74, s * 0.36);
  g.fillStyle = L.wood;
  g.beginPath();
  g.arc(0, -s * 0.5, s * 0.16, 0, Math.PI * 2);
  g.fill();
  g.fillRect(-s * 0.07, -s * 0.38, s * 0.14, s * 0.28);
  g.fillRect(-s * 0.33, -s * 0.08, s * 0.66, s * 0.28);
  g.fillStyle = L.brass;
  g.fillRect(-s * 0.34, 0, s * 0.68, s * 0.07);
  g.fillStyle = L.hotRed;
  g.fillRect(-s * 0.37, s * 0.22, s * 0.74, s * 0.08);
  g.fillStyle = L.core;
  g.beginPath();
  g.arc(-s * 0.06, -s * 0.54, s * 0.04, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export const ledgerKit: HeroKit = {
  name: 'Mr. Ledger',
  maxHp: 600,
  title: 'the Tithe-Keeper',
  accent: L.gold,
  foil: L.foil,
  portrait(g, s) {
    iconGround(g, s);
    // Ruled rows of figures on the wall behind him, and the long quill of his staff rising behind his shoulder.
    g.fillStyle = 'rgba(245,237,208,0.1)';
    for (let i = 0; i < 7; i++) g.fillRect(s * 0.06, s * (0.1 + i * 0.12), s * 0.88, s * 0.012);
    g.strokeStyle = L.gold;
    g.lineWidth = s * 0.012;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 0.8, s * 0.95);
    g.quadraticCurveTo(s * 0.83, s * 0.45, s * 0.9, s * 0.06);
    g.stroke();
    g.fillStyle = L.vane;
    g.beginPath();
    g.moveTo(s * 0.9, s * 0.06);
    g.quadraticCurveTo(s * 0.7, s * 0.22, s * 0.8, s * 0.5);
    g.quadraticCurveTo(s * 0.84, s * 0.3, s * 0.9, s * 0.06);
    g.fill();
    // The high stiff oxblood collar behind his head, a gold rim.
    g.fillStyle = L.oxblood;
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.68);
    g.lineTo(s * 0.26, s * 0.3);
    g.quadraticCurveTo(s * 0.5, s * 0.22, s * 0.74, s * 0.3);
    g.lineTo(s * 0.7, s * 0.68);
    g.closePath();
    g.fill();
    g.strokeStyle = L.goldRobe;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(s * 0.26, s * 0.3);
    g.quadraticCurveTo(s * 0.5, s * 0.22, s * 0.74, s * 0.3);
    g.stroke();
    // Narrow shoulders in black robes, an oxblood panel down the chest edged in gold, a gold belt.
    g.fillStyle = L.robe;
    g.beginPath();
    g.moveTo(s * 0.16, s);
    g.quadraticCurveTo(s * 0.18, s * 0.72, s * 0.36, s * 0.64);
    g.lineTo(s * 0.64, s * 0.64);
    g.quadraticCurveTo(s * 0.82, s * 0.72, s * 0.84, s);
    g.closePath();
    g.fill();
    g.fillStyle = L.oxblood;
    g.beginPath();
    g.moveTo(s * 0.43, s * 0.64);
    g.lineTo(s * 0.57, s * 0.64);
    g.lineTo(s * 0.6, s);
    g.lineTo(s * 0.4, s);
    g.closePath();
    g.fill();
    g.strokeStyle = L.goldRobe;
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(s * 0.43, s * 0.64);
    g.lineTo(s * 0.4, s);
    g.moveTo(s * 0.57, s * 0.64);
    g.lineTo(s * 0.6, s);
    g.stroke();
    g.fillStyle = L.goldRobe;
    g.fillRect(s * 0.38, s * 0.88, s * 0.24, s * 0.024);
    // Two swags of gold coins on chains.
    for (const dir of [-1, 1]) {
      g.strokeStyle = L.goldRobe;
      g.lineWidth = s * 0.006;
      g.beginPath();
      g.moveTo(s * (0.5 + dir * 0.09), s * 0.64);
      g.quadraticCurveTo(s * (0.5 + dir * 0.16), s * 0.76, s * (0.5 + dir * 0.06), s * 0.86);
      g.stroke();
      for (const [rx, ry] of [[0.138, 0.71], [0.14, 0.775], [0.095, 0.835]]) {
        g.beginPath();
        g.arc(s * (0.5 + dir * rx), s * ry, s * 0.017, 0, Math.PI * 2);
        g.fill();
      }
    }
    // The great book at his side, its red wax seal glowing.
    g.fillStyle = L.dark;
    g.fillRect(s * 0.02, s * 0.62, s * 0.3, s * 0.38);
    g.fillStyle = L.cover;
    g.fillRect(s * 0.04, s * 0.64, s * 0.26, s * 0.36);
    g.fillStyle = L.goldRobe;
    for (const [bx, by] of [[0.04, 0.64], [0.26, 0.64]]) g.fillRect(s * bx, s * by, s * 0.04, s * 0.04);
    g.fillRect(s * 0.04, s * 0.72, s * 0.26, s * 0.014);
    g.fillRect(s * 0.04, s * 0.9, s * 0.26, s * 0.014);
    const glow = g.createRadialGradient(s * 0.17, s * 0.81, 0, s * 0.17, s * 0.81, s * 0.12);
    glow.addColorStop(0, 'rgba(255,90,60,0.9)');
    glow.addColorStop(1, 'rgba(255,58,36,0)');
    g.fillStyle = glow;
    g.fillRect(s * 0.04, s * 0.68, s * 0.26, s * 0.26);
    g.fillStyle = L.seal;
    g.beginPath();
    g.arc(s * 0.17, s * 0.81, s * 0.05, 0, Math.PI * 2);
    g.fill();
    // A long, narrow, calm face.
    g.fillStyle = '#e0c2a6';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.46, s * 0.1, s * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    for (const sx of [0.455, 0.545]) {
      g.fillStyle = L.core;
      g.beginPath();
      g.ellipse(s * sx, s * 0.44, s * 0.026, s * 0.03, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = L.seal;
      g.beginPath();
      g.arc(s * sx, s * 0.446, s * 0.014, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = L.ink;
    g.lineWidth = s * 0.008;
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * (0.5 + dir * 0.03), s * 0.395);
      g.quadraticCurveTo(s * (0.5 + dir * 0.06), s * 0.375, s * (0.5 + dir * 0.09), s * 0.4);
      g.stroke();
    }
    g.strokeStyle = '#8a4a4a';
    g.beginPath();
    g.moveTo(s * 0.47, s * 0.54);
    g.quadraticCurveTo(s * 0.5, s * 0.55, s * 0.53, s * 0.54);
    g.stroke();
    // Grey hair slicked back from the brow.
    g.fillStyle = L.hair;
    g.beginPath();
    g.moveTo(s * 0.39, s * 0.4);
    g.quadraticCurveTo(s * 0.36, s * 0.18, s * 0.5, s * 0.16);
    g.quadraticCurveTo(s * 0.64, s * 0.18, s * 0.61, s * 0.4);
    g.quadraticCurveTo(s * 0.58, s * 0.3, s * 0.5, s * 0.28);
    g.quadraticCurveTo(s * 0.42, s * 0.3, s * 0.39, s * 0.4);
    g.closePath();
    g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'invoice', name: 'Invoice', range: 9, cooldown: 3.5, aim: 'line',
      blurb: 'A paper flies (9 m): 72 damage that goes on the target\'s tab instead of hurting now. The tab comes due 3 s after the last charge, at +40%.',
      icon(g, s) {
        iconGround(g, s);
        streak(g, s * 0.04, s * 0.84, s * 0.42, s * 0.6, s * 0.06);
        streak(g, s * 0.1, s * 0.94, s * 0.4, s * 0.76, s * 0.035);
        sheet(g, s * 0.6, s * 0.46, s * 0.4, s * 0.52, 0.5, 'DUE');
        g.fillStyle = L.core;
        g.beginPath();
        g.arc(s * 0.82, s * 0.2, s * 0.02, 0, Math.PI * 2);
        g.arc(s * 0.2, s * 0.3, s * 0.014, 0, Math.PI * 2);
        g.fill();
      },
    },
    {
      key: 'W', label: 'late fee', name: 'Late Fee', range: 9, cooldown: 9,
      blurb: 'At a spot (9 m), after 1 s: a notice lands on a 2.5 m circle. 62 damage on the tab, and slowed 1.5 s.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = L.gold;
        g.lineWidth = s * 0.02;
        g.setLineDash([s * 0.05, s * 0.035]);
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.66, s * 0.42, s * 0.22, 0, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = 'rgba(179,38,30,0.5)';
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.66, s * 0.38, s * 0.19, 0, 0, Math.PI * 2);
        g.fill();
        sheet(g, s * 0.5, s * 0.42, s * 0.46, s * 0.58, -0.12, 'LATE');
        coin(g, s * 0.16, s * 0.84, s * 0.06);
        coin(g, s * 0.86, s * 0.78, s * 0.05);
        coin(g, s * 0.78, s * 0.9, s * 0.04);
      },
    },
    {
      key: 'E', label: 'call it in', name: 'Call It In', range: 0, cooldown: 8,
      blurb: 'The ledger is slammed shut: the tab on the enemy comes due now, without the interest. Needs no target, and a tab to call.',
      icon(g, s) {
        iconGround(g, s);
        tome(g, s * 0.5, s * 0.58, s * 0.72, s * 0.62, true);
        // A pencil scratching on the right page.
        g.save();
        g.translate(s * 0.72, s * 0.42);
        g.rotate(0.9);
        g.fillStyle = L.dark;
        g.fillRect(-s * 0.03, -s * 0.2, s * 0.06, s * 0.3);
        g.fillStyle = '#d9a63a';
        g.fillRect(-s * 0.022, -s * 0.2, s * 0.044, s * 0.26);
        g.fillStyle = L.shade;
        g.beginPath();
        g.moveTo(-s * 0.022, s * 0.06);
        g.lineTo(s * 0.022, s * 0.06);
        g.lineTo(0, s * 0.11);
        g.closePath();
        g.fill();
        g.fillStyle = '#d96a6a';
        g.fillRect(-s * 0.022, -s * 0.24, s * 0.044, s * 0.04);
        g.restore();
        coin(g, s * 0.14, s * 0.18, s * 0.06);
        coin(g, s * 0.84, s * 0.14, s * 0.045);
      },
    },
    {
      key: 'R', label: 'foreclosure', name: 'Foreclosure', range: 9, cooldown: 24,
      blurb: 'A huge stamp falls at a spot (9 m) in 0.8 s. Seen in the 2.2 m circle, the target pays their whole tab now at +60%, and takes 20% more from him for 3 s. Cover saves them.',
      icon(g, s) {
        iconGround(g, s);
        g.strokeStyle = L.hotRed;
        g.lineWidth = s * 0.02;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.8, s * 0.4, s * 0.15, 0, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = 'rgba(179,38,30,0.6)';
        g.fillRect(s * 0.22, s * 0.7, s * 0.56, s * 0.17);
        g.fillStyle = L.core;
        g.font = `900 ${Math.round(s * 0.1)}px Impact, Arial Black, sans-serif`;
        g.textAlign = 'center';
        g.fillText('FINAL', s * 0.5, s * 0.8, s * 0.5);
        stampTool(g, s * 0.5, s * 0.48, s * 0.62);
        g.fillStyle = L.hotRed;
        for (const [x, y, r] of [[0.14, 0.62, 0.03], [0.86, 0.66, 0.035], [0.9, 0.84, 0.02], [0.1, 0.86, 0.025]] as const) {
          g.beginPath();
          g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          g.fill();
        }
      },
    },
  ],
};
