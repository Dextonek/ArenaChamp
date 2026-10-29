import type { HeroKit } from '../heroes';

/**
 * Clockwork kit data: Ada, the Artificer. Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * oiled-iron ground, steel foil, machined copper and brass gears and springs, one cyan electric accent. Signature shape:
 * the toothed gear.
 */
const S = { core: '#ffffff', hot: '#ffd08a', body: '#d9773a', accent: '#6affea', dark: '#1a0f08', foil: '#d8dde2', brass: '#d9a655' };

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#34200f');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A toothed gear: body colour, steel teeth edge, dark hub and (optionally) spoke windows. */
function gear(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, teeth: number, fill = S.body, windows = true) {
  const step = (Math.PI * 2) / teeth;
  g.beginPath();
  for (let i = 0; i < teeth; i++) {
    for (const [da, k] of [[-0.36, 0.8], [-0.19, 1], [0.19, 1], [0.36, 0.8]]) {
      const a = (i + da) * step, x = cx + Math.cos(a) * r * k, y = cy + Math.sin(a) * r * k;
      if (i === 0 && da === -0.36) g.moveTo(x, y); else g.lineTo(x, y);
    }
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = S.foil;
  g.lineWidth = Math.max(1, r * 0.1);
  g.lineJoin = 'round';
  g.stroke();
  if (windows) {
    // Dark windows between six copper spokes.
    g.fillStyle = S.dark;
    const per = (Math.PI * 2) / 6;
    for (let k = 0; k < 6; k++) {
      const a0 = k * per + per * 0.2, a1 = k * per + per * 0.8;
      g.beginPath();
      g.arc(cx, cy, r * 0.68, a0, a1);
      g.arc(cx, cy, r * 0.4, a1, a0, true);
      g.closePath();
      g.fill();
    }
  }
  g.fillStyle = S.dark;
  g.beginPath();
  g.arc(cx, cy, r * 0.27, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = S.foil;
  g.lineWidth = Math.max(1, r * 0.06);
  g.stroke();
}

/** A cyan zigzag spark through the points. */
function zig(g: CanvasRenderingContext2D, pts: [number, number][], w: number) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = S.accent;
  g.lineWidth = w;
  g.stroke();
  g.strokeStyle = '#e8fffa';
  g.lineWidth = w * 0.35;
  g.stroke();
}

/** A coiled spring from (x1,y1) to (x2,y2): brass zigzag loops. */
function spring(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, coils: number) {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x1, y1);
  for (let i = 0; i < coils * 2; i++) {
    const u = (i + 0.5) / (coils * 2), side = i % 2 ? -1 : 1;
    g.lineTo(x1 + dx * u + nx * w * side, y1 + dy * u + ny * w * side);
  }
  g.lineTo(x2, y2);
  g.strokeStyle = S.dark;
  g.lineWidth = w * 0.7;
  g.stroke();
  g.strokeStyle = S.brass;
  g.lineWidth = w * 0.42;
  g.stroke();
}

function steam(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = '#f3f6fa';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.arc(x + r * 0.9, y - r * 0.4, r * 0.7, 0, Math.PI * 2);
  g.fill();
}

export const clockworkKit: HeroKit = {
  name: 'Ada',
  title: 'the Artificer',
  accent: S.body,
  foil: S.foil,
  portrait(g, s) {
    iconGround(g, s);
    // The brass backpack of gears behind her shoulders and a spring-loaded wrist launcher on the right.
    gear(g, s * 0.2, s * 0.34, s * 0.19, 11, S.brass, false);
    gear(g, s * 0.82, s * 0.28, s * 0.15, 9, S.body, false);
    gear(g, s * 0.9, s * 0.52, s * 0.09, 8, S.brass, false);
    zig(g, [[s * 0.76, s * 0.12], [s * 0.82, s * 0.2], [s * 0.78, s * 0.26], [s * 0.88, s * 0.34]], s * 0.016);
    // Shoulders in a dark coat with a copper trim.
    g.fillStyle = '#3a2314';
    g.beginPath();
    g.moveTo(s * 0.16, s);
    g.quadraticCurveTo(s * 0.2, s * 0.68, s * 0.34, s * 0.58);
    g.quadraticCurveTo(s * 0.5, s * 0.5, s * 0.66, s * 0.58);
    g.quadraticCurveTo(s * 0.8, s * 0.68, s * 0.84, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.body;
    g.lineWidth = s * 0.024;
    g.stroke();
    // Brass buttons down the front.
    g.fillStyle = S.brass;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(s * 0.5, s * (0.7 + i * 0.1), s * 0.012, 0, Math.PI * 2);
      g.fill();
    }
    // Head: a short dark bob under a leather cap, goggles pushed up on the forehead.
    g.fillStyle = '#e8c9b0';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.42, s * 0.12, s * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2b1a10';
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.34, s * 0.15, s * 0.13, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.35, s * 0.34);
    g.quadraticCurveTo(s * 0.32, s * 0.5, s * 0.38, s * 0.56);
    g.quadraticCurveTo(s * 0.4, s * 0.44, s * 0.42, s * 0.34);
    g.moveTo(s * 0.65, s * 0.34);
    g.quadraticCurveTo(s * 0.68, s * 0.5, s * 0.62, s * 0.56);
    g.quadraticCurveTo(s * 0.6, s * 0.44, s * 0.58, s * 0.34);
    g.fill();
    g.fillStyle = '#4a2f1a';
    g.fillRect(s * 0.36, s * 0.3, s * 0.28, s * 0.03);
    for (const sx of [0.43, 0.57]) {
      g.fillStyle = S.foil;
      g.beginPath();
      g.arc(s * sx, s * 0.29, s * 0.05, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.accent;
      g.beginPath();
      g.arc(s * sx, s * 0.29, s * 0.034, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = S.dark;
    g.fillRect(s * 0.44, s * 0.43, s * 0.035, s * 0.012);
    g.fillRect(s * 0.525, s * 0.43, s * 0.035, s * 0.012);
    g.fillStyle = '#c98a78';
    g.fillRect(s * 0.47, s * 0.5, s * 0.06, s * 0.01);
  },
  spells: [
    {
      key: 'Q', label: 'clockwork rivet shot', name: 'Rivet Shot', range: 12, cooldown: 3, aim: 'line',
      blurb: 'Fires a spinning copper rivet that slows what it hits, then ricochets to the nearest other enemy.',
      icon(g, s) {
        iconGround(g, s);
        // A rivet flying up and to the right with a cyan spark trail and two loose cogs.
        zig(g, [[s * 0.08, s * 0.9], [s * 0.2, s * 0.78], [s * 0.18, s * 0.7], [s * 0.34, s * 0.6], [s * 0.4, s * 0.56]], s * 0.045);
        zig(g, [[s * 0.12, s * 0.66], [s * 0.24, s * 0.64], [s * 0.3, s * 0.52]], s * 0.03);
        g.save();
        g.translate(s * 0.62, s * 0.4);
        g.rotate(-0.72);
        g.fillStyle = S.brass;
        g.fillRect(-s * 0.3, -s * 0.045, s * 0.26, s * 0.09);
        g.fillStyle = S.foil;
        g.fillRect(-s * 0.06, -s * 0.15, s * 0.07, s * 0.3);
        g.fillStyle = S.body;
        g.beginPath();
        g.ellipse(s * 0.01, 0, s * 0.19, s * 0.15, 0, -Math.PI / 2, Math.PI / 2);
        g.fill();
        g.strokeStyle = S.dark;
        g.lineWidth = s * 0.02;
        g.stroke();
        g.restore();
        gear(g, s * 0.84, s * 0.2, s * 0.09, 8, S.brass, false);
        gear(g, s * 0.78, s * 0.8, s * 0.07, 8, S.body, false);
      },
    },
    {
      key: 'W', label: 'cog turret', name: 'Cog Turret', range: 9, cooldown: 12, summon: true,
      blurb: 'Assembles a brass turret from loose gears; it shoots anything near for six seconds.',
      icon(g, s) {
        iconGround(g, s);
        // A tripod, a gear body, a barrel and a cyan lens; steam from the joints.
        g.strokeStyle = S.brass;
        g.lineWidth = s * 0.05;
        g.lineCap = 'round';
        for (const [x, y] of [[0.22, 0.92], [0.5, 0.96], [0.78, 0.92]]) {
          g.beginPath();
          g.moveTo(s * 0.5, s * 0.58);
          g.lineTo(s * x, s * y);
          g.stroke();
        }
        g.fillStyle = S.dark;
        g.fillRect(s * 0.54, s * 0.34, s * 0.34, s * 0.1);
        g.fillStyle = S.foil;
        g.fillRect(s * 0.56, s * 0.355, s * 0.3, s * 0.07);
        gear(g, s * 0.46, s * 0.4, s * 0.25, 12, S.body);
        g.fillStyle = S.brass;
        g.fillRect(s * 0.4, s * 0.34, s * 0.12, s * 0.12);
        g.fillStyle = S.accent;
        g.beginPath();
        g.arc(s * 0.9, s * 0.39, s * 0.04, 0, Math.PI * 2);
        g.fill();
        spring(g, s * 0.5, s * 0.66, s * 0.5, s * 0.78, s * 0.05, 3);
        steam(g, s * 0.2, s * 0.64, s * 0.05);
        steam(g, s * 0.78, s * 0.7, s * 0.04);
        zig(g, [[s * 0.9, s * 0.2], [s * 0.82, s * 0.26], [s * 0.88, s * 0.3], [s * 0.78, s * 0.36]], s * 0.022);
      },
    },
    {
      key: 'E', label: 'gear field', name: 'Gear Field', range: 0, cooldown: 9,
      blurb: 'Three big gears unfold round her and lurch twice; each lurch sends an electric ring that slows enemies inside.',
      icon(g, s) {
        iconGround(g, s);
        // Three nested flat gears seen at an angle round a small figure.
        for (const [r, t, c] of [[0.44, 18, S.brass], [0.3, 14, S.body], [0.16, 10, S.brass]] as [number, number, string][]) {
          g.save();
          g.translate(s * 0.5, s * 0.62);
          g.scale(1, 0.42);
          gear(g, 0, 0, s * r, t, c, r < 0.3);
          g.restore();
        }
        g.fillStyle = S.foil;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.5, s * 0.05, s * 0.13, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = S.body;
        g.beginPath();
        g.arc(s * 0.5, s * 0.34, s * 0.05, 0, Math.PI * 2);
        g.fill();
        zig(g, [[s * 0.1, s * 0.62], [s * 0.18, s * 0.54], [s * 0.2, s * 0.64], [s * 0.3, s * 0.56]], s * 0.03);
        zig(g, [[s * 0.9, s * 0.64], [s * 0.82, s * 0.7], [s * 0.78, s * 0.6], [s * 0.7, s * 0.68]], s * 0.03);
        steam(g, s * 0.12, s * 0.82, s * 0.045);
      },
    },
    {
      key: 'R', label: 'gearfall', name: 'Gearfall', range: 13, cooldown: 20, cc: true,
      blurb: 'Ultimate. A colossal gear is lowered on chains and slammed down, pinning everyone under its teeth.',
      icon(g, s) {
        iconGround(g, s);
        // A ring of small gears on the floor, a cyan spark ring, and the giant gear hanging on two chains.
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          gear(g, s * (0.5 + Math.cos(a) * 0.4), s * (0.84 + Math.sin(a) * 0.1), s * 0.05, 8, S.brass, false);
        }
        g.strokeStyle = S.accent;
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.84, s * 0.34, s * 0.07, 0, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = S.foil;
        g.lineWidth = s * 0.03;
        g.setLineDash([s * 0.04, s * 0.03]);
        for (const x of [0.2, 0.8]) {
          g.beginPath();
          g.moveTo(s * x, s * 0.02);
          g.lineTo(s * x, s * 0.4);
          g.stroke();
        }
        g.setLineDash([]);
        g.save();
        g.translate(s * 0.5, s * 0.5);
        g.scale(1, 0.7);
        gear(g, 0, 0, s * 0.38, 18, S.body);
        g.restore();
        zig(g, [[s * 0.14, s * 0.46], [s * 0.2, s * 0.5], [s * 0.16, s * 0.56], [s * 0.24, s * 0.6]], s * 0.024);
        steam(g, s * 0.86, s * 0.7, s * 0.05);
        steam(g, s * 0.1, s * 0.72, s * 0.04);
      },
    },
  ],
};
