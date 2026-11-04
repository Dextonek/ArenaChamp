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
  maxHp: 580,
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
      key: 'Q', label: 'homing drone', name: 'Homing Drone', range: 8, cooldown: 4,
      blurb: 'Click an enemy within 8 m. A drone flies out and always hits: 45. It tags them for 3 s, and her turrets deal 30% more to a tagged enemy. Needs sight.',
      icon(g, s) {
        iconGround(g, s);
        // A drone with two rotor gears and a cyan lens, a spark trail behind it and a tag ring under the target at the lower right.
        zig(g, [[s * 0.06, s * 0.9], [s * 0.18, s * 0.76], [s * 0.16, s * 0.68], [s * 0.3, s * 0.56], [s * 0.36, s * 0.5]], s * 0.045);
        zig(g, [[s * 0.1, s * 0.62], [s * 0.2, s * 0.6], [s * 0.26, s * 0.48]], s * 0.028);
        g.strokeStyle = S.hot;
        g.lineWidth = s * 0.03;
        g.beginPath();
        g.ellipse(s * 0.74, s * 0.82, s * 0.2, s * 0.08, 0, 0, Math.PI * 2);
        g.stroke();
        gear(g, s * 0.74, s * 0.82, s * 0.07, 6, S.brass, false);
        // The drone body: a brass ellipse with a steel band, a lens, a copper fin.
        g.save();
        g.translate(s * 0.56, s * 0.42);
        g.rotate(0.55);
        g.fillStyle = S.body;
        g.beginPath();
        g.moveTo(-s * 0.3, -s * 0.07);
        g.lineTo(-s * 0.2, -s * 0.2);
        g.lineTo(-s * 0.14, -s * 0.05);
        g.closePath();
        g.fill();
        g.fillStyle = S.brass;
        g.beginPath();
        g.ellipse(0, 0, s * 0.22, s * 0.14, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = S.dark;
        g.lineWidth = s * 0.02;
        g.stroke();
        g.fillStyle = S.foil;
        g.fillRect(-s * 0.02, -s * 0.14, s * 0.05, s * 0.28);
        g.fillStyle = S.accent;
        g.beginPath();
        g.arc(s * 0.15, 0, s * 0.045, 0, Math.PI * 2);
        g.fill();
        g.restore();
        gear(g, s * 0.5, s * 0.22, s * 0.13, 8, S.body, false);
        gear(g, s * 0.82, s * 0.42, s * 0.09, 8, S.brass, false);
        steam(g, s * 0.2, s * 0.84, s * 0.04);
      },
    },
    {
      key: 'W', label: 'deploy turret', name: 'Deploy Turret', range: 8, cooldown: 10, summon: true,
      blurb: 'Two charges, one back every 10 s. A turret at a spot within 8 m for 8 s: 80 HP, 12 damage every 1.4 s, range 8. Within 5 m of her it shoots 30% faster and glows.',
      icon(g, s) {
        iconGround(g, s);
        // A turret on a tripod, a copper ring on the floor round it (her 5 m), and two charge pips.
        g.strokeStyle = S.hot;
        g.lineWidth = s * 0.026;
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.86, s * 0.42, s * 0.12, 0, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = S.brass;
        g.lineWidth = s * 0.05;
        g.lineCap = 'round';
        for (const [x, y] of [[0.26, 0.9], [0.5, 0.96], [0.74, 0.9]]) {
          g.beginPath();
          g.moveTo(s * 0.5, s * 0.62);
          g.lineTo(s * x, s * y);
          g.stroke();
        }
        g.fillStyle = S.dark;
        g.fillRect(s * 0.52, s * 0.3, s * 0.34, s * 0.1);
        g.fillStyle = S.foil;
        g.fillRect(s * 0.54, s * 0.32, s * 0.3, s * 0.065);
        gear(g, s * 0.46, s * 0.42, s * 0.23, 12, S.body);
        g.fillStyle = S.accent;
        g.beginPath();
        g.arc(s * 0.89, s * 0.35, s * 0.04, 0, Math.PI * 2);
        g.fill();
        for (const x of [0.12, 0.24]) {
          g.fillStyle = S.hot;
          g.beginPath();
          g.arc(s * x, s * 0.14, s * 0.045, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = S.dark;
          g.lineWidth = s * 0.012;
          g.stroke();
        }
        spring(g, s * 0.5, s * 0.7, s * 0.5, s * 0.8, s * 0.045, 3);
        steam(g, s * 0.78, s * 0.64, s * 0.04);
        zig(g, [[s * 0.9, s * 0.18], [s * 0.82, s * 0.24], [s * 0.88, s * 0.28], [s * 0.78, s * 0.34]], s * 0.02);
      },
    },
    {
      key: 'E', label: 'grapple hook', name: 'Grapple', range: 9, cooldown: 10, aim: 'line',
      blurb: 'A hook (9 m, 0.25 s wind-up). On an enemy: 30 and slowed 1 s, she stays put. On a wall, pillar or her own turret she reels herself to it. It cannot pull the enemy.',
      icon(g, s) {
        iconGround(g, s);
        // A chain from the lower left up to a grapnel biting a wall block at the upper right, with sparks at the bite.
        g.fillStyle = '#3a2a1c';
        g.fillRect(s * 0.72, s * 0.04, s * 0.26, s * 0.6);
        g.strokeStyle = S.foil;
        g.lineWidth = s * 0.015;
        g.strokeRect(s * 0.72, s * 0.04, s * 0.26, s * 0.6);
        g.strokeStyle = S.dark;
        g.lineWidth = s * 0.02;
        for (const y of [0.2, 0.36, 0.52]) {
          g.beginPath();
          g.moveTo(s * 0.72, s * y);
          g.lineTo(s * 0.98, s * y);
          g.stroke();
        }
        // The chain: oval links, alternating.
        const x1 = s * 0.12, y1 = s * 0.88, x2 = s * 0.64, y2 = s * 0.34;
        for (let i = 0; i < 7; i++) {
          const u = (i + 0.5) / 7;
          g.save();
          g.translate(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u);
          g.rotate(Math.atan2(y2 - y1, x2 - x1) + (i % 2 ? Math.PI / 2 : 0));
          g.strokeStyle = S.dark;
          g.lineWidth = s * 0.07;
          g.beginPath();
          g.ellipse(0, 0, s * 0.06, s * 0.035, 0, 0, Math.PI * 2);
          g.stroke();
          g.strokeStyle = S.foil;
          g.lineWidth = s * 0.035;
          g.stroke();
          g.restore();
        }
        // The grapnel: a brass shank with three copper prongs.
        g.save();
        g.translate(s * 0.66, s * 0.32);
        g.rotate(-0.78);
        g.fillStyle = S.brass;
        g.fillRect(-s * 0.04, -s * 0.05, s * 0.2, s * 0.1);
        g.fillStyle = S.body;
        for (const a of [-0.7, 0, 0.7]) {
          g.save();
          g.translate(s * 0.14, 0);
          g.rotate(a);
          g.beginPath();
          g.moveTo(0, -s * 0.03);
          g.lineTo(s * 0.17, 0);
          g.lineTo(0, s * 0.03);
          g.closePath();
          g.fill();
          g.restore();
        }
        g.restore();
        zig(g, [[s * 0.78, s * 0.4], [s * 0.72, s * 0.46], [s * 0.78, s * 0.5], [s * 0.7, s * 0.56]], s * 0.024);
        gear(g, s * 0.16, s * 0.2, s * 0.1, 9, S.brass, false);
        steam(g, s * 0.3, s * 0.86, s * 0.04);
      },
    },
    {
      key: 'R', label: 'siege mode', name: 'Siege Mode', range: 9, cooldown: 24,
      blurb: 'She braces for 6 s, rooted, +20% armour. Turrets within 8 m of her fire twice as fast, and she fires heavy rounds (30 every 0.8 s) at an enemy within 9 m she can see. A stun, silence or knock-up ends it. Recast: pack up.',
      icon(g, s) {
        iconGround(g, s);
        // Four steel plates on the ground in a diamond round a gear, copper braces up to a collar, a heavy shell flying out.
        for (const [x, y] of [[0.5, 0.9], [0.14, 0.7], [0.86, 0.7], [0.5, 0.52]] as [number, number][]) {
          g.fillStyle = S.foil;
          g.beginPath();
          g.ellipse(s * x, s * y, s * 0.17, s * 0.07, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = S.dark;
          g.lineWidth = s * 0.018;
          g.stroke();
          g.strokeStyle = S.body;
          g.lineWidth = s * 0.04;
          g.beginPath();
          g.moveTo(s * x, s * (y - 0.03));
          g.lineTo(s * 0.5, s * 0.66);
          g.stroke();
        }
        gear(g, s * 0.5, s * 0.66, s * 0.17, 12, S.body);
        // A shoulder cannon with coil rings, and the shell leaving it toward the upper right.
        g.save();
        g.translate(s * 0.5, s * 0.46);
        g.rotate(-0.55);
        g.fillStyle = S.dark;
        g.fillRect(0, -s * 0.06, s * 0.3, s * 0.12);
        g.fillStyle = S.brass;
        g.fillRect(s * 0.02, -s * 0.045, s * 0.26, s * 0.09);
        for (let i = 0; i < 3; i++) {
          g.strokeStyle = i === 2 ? S.accent : S.foil;
          g.lineWidth = s * 0.028;
          g.beginPath();
          g.ellipse(s * (0.08 + i * 0.08), 0, s * 0.018, s * 0.08, 0, 0, Math.PI * 2);
          g.stroke();
        }
        g.restore();
        zig(g, [[s * 0.7, s * 0.28], [s * 0.78, s * 0.22], [s * 0.86, s * 0.14]], s * 0.04);
        g.fillStyle = S.body;
        g.beginPath();
        g.arc(s * 0.9, s * 0.1, s * 0.06, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = S.foil;
        g.lineWidth = s * 0.02;
        g.stroke();
        steam(g, s * 0.2, s * 0.5, s * 0.045);
        steam(g, s * 0.8, s * 0.5, s * 0.04);
      },
    },
  ],
};
