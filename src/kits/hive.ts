import type { HeroKit } from '../heroes';

/**
 * Hive kit data (v5): Sirix, the Swarm Warden (a melee bruiser who spends a swarm of wasps). Four spells (labels as registered), canvas-drawn
 * icons in the kit's palette: chitin-black ground with a faint honeycomb, wax foil, amber hexagon cells and small striped
 * wasps, serrated dark claw crescents with an amber rim, a green accent on the eyes. Signature shape: the hexagon and the swarm.
 */
const H = { core: '#fffbe0', hot: '#ffe08a', body: '#f0b020', accent: '#7aff5a', dark: '#120e06', wax: '#f6e6b0' };
const PI = Math.PI;

function hexPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot = 0) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * PI * 2;
    if (i) g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#4a3208');
  r.addColorStop(1, H.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
  // A faint honeycomb lattice.
  g.strokeStyle = H.wax;
  g.globalAlpha = 0.09;
  g.lineWidth = Math.max(1, s * 0.008);
  const R = s * 0.12;
  for (let q = -1; q < 9; q++) {
    for (let r2 = -1; r2 < 9; r2++) {
      hexPath(g, 1.5 * R * q, Math.sqrt(3) * R * (r2 + q / 2), R * 0.96);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
}

/** A honeycomb cell: amber face, wax frame, dark hollow. */
function cell(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, face = H.body) {
  hexPath(g, cx, cy, r);
  g.fillStyle = H.dark;
  g.fill();
  hexPath(g, cx, cy, r * 0.88);
  g.fillStyle = face;
  g.fill();
  g.strokeStyle = H.wax;
  g.lineWidth = Math.max(1, r * 0.14);
  g.stroke();
  hexPath(g, cx, cy, r * 0.42);
  g.fillStyle = '#8a5a0c';
  g.fill();
}

/** A small striped wasp at (x, y), `len` long, pointing along `rot`. */
function wasp(g: CanvasRenderingContext2D, x: number, y: number, len: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const u = len / 10;
  // Wings.
  g.fillStyle = H.wax;
  g.globalAlpha = 0.75;
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.ellipse(-u * 0.5, sd * u * 3.4, u * 3.2, u * 1.4, sd * 0.5, 0, PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // Striped abdomen, dark thorax and head with a green eye.
  g.fillStyle = H.body;
  g.beginPath();
  g.ellipse(-u * 3.2, 0, u * 4, u * 1.9, 0, 0, PI * 2);
  g.fill();
  g.fillStyle = H.dark;
  for (const dx of [-5, -3.4, -1.8]) g.fillRect(u * dx, -u * 1.8, u * 0.9, u * 3.6);
  g.beginPath();
  g.ellipse(u * 1.4, 0, u * 1.8, u * 1.5, 0, 0, PI * 2);
  g.fill();
  g.beginPath();
  g.arc(u * 3.4, 0, u * 1.3, 0, PI * 2);
  g.fill();
  g.fillStyle = H.accent;
  g.beginPath();
  g.arc(u * 3.9, -u * 0.5, u * 0.5, 0, PI * 2);
  g.fill();
  g.restore();
}

/** A serrated claw crescent: the arc of radius `r` round (cx, cy) from a0 to a1, `w` thick, dark with an amber rim and teeth. */
function claw(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, a0: number, a1: number, w: number) {
  const N = 16;
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = a0 + (a1 - a0) * u, teeth = ((i * 3) % 4) / 4;
    const ro = r - w * 0.28 * teeth * Math.sin(PI * u);
    const x = cx + Math.cos(a) * ro, y = cy + Math.sin(a) * ro;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const u = i / N, a = a0 + (a1 - a0) * u;
    const ri = r - w * Math.pow(Math.sin(PI * u), 0.8);
    g.lineTo(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri);
  }
  g.closePath();
  g.fillStyle = H.dark;
  g.fill();
  g.strokeStyle = H.body;
  g.lineWidth = Math.max(1, w * 0.22);
  g.lineJoin = 'round';
  g.stroke();
  // Hexagonal flecks.
  g.fillStyle = H.body;
  for (const u of [0.3, 0.5, 0.7]) {
    const a = a0 + (a1 - a0) * u, rr = r - w * 0.55;
    hexPath(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, w * 0.14, a);
    g.fill();
  }
}

function drop(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = H.body;
  g.beginPath();
  g.moveTo(x, y - r * 1.5);
  g.quadraticCurveTo(x + r * 1.1, y, x, y + r);
  g.quadraticCurveTo(x - r * 1.1, y, x, y - r * 1.5);
  g.fill();
  g.fillStyle = H.hot;
  g.beginPath();
  g.arc(x - r * 0.25, y - r * 0.1, r * 0.2, 0, PI * 2);
  g.fill();
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = H.accent;
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2, rr = i % 2 ? r * 0.42 : r;
    if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.fillStyle = H.core;
  g.beginPath();
  g.arc(x, y, r * 0.28, 0, PI * 2);
  g.fill();
}

export const hiveKit: HeroKit = {
  name: 'Sirix',
  title: 'the Swarm Warden',
  accent: H.body,
  foil: H.wax,
  maxHp: 720,
  melee: true,
  portrait(g, s) {
    iconGround(g, s);
    // Honeycomb cells behind, and the wing-cloak: pale translucent wings spread behind the shoulders.
    cell(g, s * 0.84, s * 0.2, s * 0.09);
    cell(g, s * 0.7, s * 0.12, s * 0.07);
    cell(g, s * 0.14, s * 0.22, s * 0.075);
    g.fillStyle = H.wax;
    g.globalAlpha = 0.5;
    for (const sd of [-1, 1]) {
      g.beginPath();
      g.ellipse(s * (0.5 + sd * 0.34), s * 0.5, s * 0.1, s * 0.32, sd * 0.35, 0, PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(s * (0.5 + sd * 0.4), s * 0.66, s * 0.07, s * 0.2, sd * 0.7, 0, PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // Black chitin shoulders and chest with hexagonal pauldrons.
    g.fillStyle = '#1e1708';
    g.beginPath();
    g.moveTo(s * 0.12, s);
    g.quadraticCurveTo(s * 0.16, s * 0.7, s * 0.32, s * 0.62);
    g.quadraticCurveTo(s * 0.5, s * 0.54, s * 0.68, s * 0.62);
    g.quadraticCurveTo(s * 0.84, s * 0.7, s * 0.88, s);
    g.closePath();
    g.fill();
    g.strokeStyle = H.body;
    g.lineWidth = s * 0.012;
    g.stroke();
    for (const sd of [-1, 1]) {
      hexPath(g, s * (0.5 + sd * 0.3), s * 0.7, s * 0.13, PI / 6);
      g.fillStyle = H.dark;
      g.fill();
      g.strokeStyle = H.body;
      g.lineWidth = s * 0.016;
      g.stroke();
      hexPath(g, s * (0.5 + sd * 0.3), s * 0.7, s * 0.07, PI / 6);
      g.fillStyle = '#3a2a0c';
      g.fill();
    }
    cell(g, s * 0.5, s * 0.86, s * 0.08, H.body);
    // The crested insect helm: a dark rounded skull, a tall crest, mandibles and two slanted amber eye lenses.
    g.fillStyle = H.dark;
    g.beginPath();
    g.ellipse(s * 0.5, s * 0.4, s * 0.17, s * 0.2, 0, 0, PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.44, s * 0.26);
    g.lineTo(s * 0.5, s * 0.04);
    g.lineTo(s * 0.56, s * 0.26);
    g.closePath();
    g.fill();
    g.strokeStyle = H.body;
    g.lineWidth = s * 0.012;
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.4, s * 0.52);
    g.lineTo(s * 0.43, s * 0.62);
    g.lineTo(s * 0.48, s * 0.55);
    g.moveTo(s * 0.6, s * 0.52);
    g.lineTo(s * 0.57, s * 0.62);
    g.lineTo(s * 0.52, s * 0.55);
    g.stroke();
    for (const sd of [-1, 1]) {
      g.save();
      g.translate(s * (0.5 + sd * 0.085), s * 0.4);
      g.rotate(sd * -0.45);
      g.fillStyle = H.body;
      g.beginPath();
      g.ellipse(0, 0, s * 0.065, s * 0.035, 0, 0, PI * 2);
      g.fill();
      g.fillStyle = H.accent;
      g.beginPath();
      g.ellipse(0, 0, s * 0.03, s * 0.016, 0, 0, PI * 2);
      g.fill();
      g.restore();
    }
    // Claw gauntlets low in the corners and a few wasps.
    claw(g, s * 0.1, s * 0.98, s * 0.3, -PI * 0.5, -PI * 0.02, s * 0.075);
    claw(g, s * 0.9, s * 0.98, s * 0.3, -PI * 0.98, -PI * 0.5, s * 0.075);
    wasp(g, s * 0.2, s * 0.4, s * 0.1, -0.5);
    wasp(g, s * 0.82, s * 0.4, s * 0.1, PI + 0.4);
    wasp(g, s * 0.74, s * 0.08, s * 0.08, PI * 0.8);
  },
  spells: [
    {
      key: 'Q', label: 'barbed stinger', name: 'Barbed Stinger', range: 8, cooldown: 6, aim: 'line',
      blurb: 'A stinger flies 8 m: 45, and the barb stays on them for 3 s. Cast it again within 3 s to leap onto the barbed enemy: 25, and with 2 wasps spent it poisons them for 30 over 3 s.',
      icon(g, s) {
        iconGround(g, s);
        // A long barbed stinger from the lower left to the upper right, venom beading at its tip, a wasp riding behind it.
        g.save();
        g.translate(s * 0.5, s * 0.5);
        g.rotate(-0.7);
        g.fillStyle = H.dark;
        g.strokeStyle = H.body;
        g.lineWidth = s * 0.02;
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(-s * 0.44, -s * 0.06);
        g.lineTo(s * 0.12, -s * 0.06);
        g.lineTo(s * 0.5, 0);
        g.lineTo(s * 0.12, s * 0.06);
        g.lineTo(-s * 0.44, s * 0.06);
        g.closePath();
        g.fill();
        g.stroke();
        // Back-swept barbs, three each side.
        g.fillStyle = H.body;
        for (const sd of [-1, 1]) {
          for (const x of [-0.04, 0.1, 0.24]) {
            g.beginPath();
            g.moveTo(s * x, sd * s * 0.06);
            g.lineTo(s * (x - 0.13), sd * s * 0.17);
            g.lineTo(s * (x - 0.04), sd * s * 0.06);
            g.closePath();
            g.fill();
            g.stroke();
          }
        }
        g.strokeStyle = H.wax;
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.moveTo(-s * 0.38, 0);
        g.lineTo(s * 0.34, 0);
        g.stroke();
        g.restore();
        drop(g, s * 0.84, s * 0.2, s * 0.045);
        star(g, s * 0.8, s * 0.28, s * 0.05);
        wasp(g, s * 0.2, s * 0.8, s * 0.17, -0.7);
        wasp(g, s * 0.34, s * 0.9, s * 0.1, -0.5);
        cell(g, s * 0.84, s * 0.8, s * 0.08);
      },
    },
    {
      key: 'W', label: 'hive shell', name: 'Hive Shell', range: 0, cooldown: 10, buff: { kind: 'armor', amount: 0.4, seconds: 3 },
      blurb: 'Chitin plates close round him: 40% less damage for 3 s. Each hit he takes spends a wasp, which stings the attacker for 15.',
      icon(g, s) {
        iconGround(g, s);
        // A dome of chitin hexagons over a wasp core, a wasp striking the shell from the right.
        const cx = s * 0.46, cy = s * 0.74;
        const plate = (x: number, y: number, r: number, a: number) => {
          hexPath(g, x, y, r, a);
          g.fillStyle = '#1e1708';
          g.fill();
          g.strokeStyle = H.body;
          g.lineWidth = s * 0.018;
          g.stroke();
          hexPath(g, x, y, r * 0.5, a);
          g.fillStyle = '#4a3208';
          g.fill();
        };
        for (let i = 0; i < 9; i++) {
          const a = PI + (i / 8) * PI;
          plate(cx + Math.cos(a) * s * 0.36, cy + Math.sin(a) * s * 0.4, s * 0.095, a);
        }
        for (let i = 0; i < 5; i++) {
          const a = PI + ((i + 0.5) / 5) * PI;
          plate(cx + Math.cos(a) * s * 0.2, cy + Math.sin(a) * s * 0.23, s * 0.085, a + 0.3);
        }
        cell(g, cx, cy - s * 0.04, s * 0.1);
        g.fillStyle = H.wax;
        g.fillRect(s * 0.06, cy + s * 0.04, s * 0.88, s * 0.025);
        wasp(g, s * 0.86, s * 0.3, s * 0.16, PI + 0.5);
        star(g, s * 0.7, s * 0.4, s * 0.05);
        wasp(g, s * 0.12, s * 0.24, s * 0.1, 0.4);
      },
    },
    {
      key: 'E', label: 'swarm cloud', name: 'Swarm Cloud', range: 9, cooldown: 9,
      blurb: 'All his wasps fly to a spot 9 m away and hang there for 3 s as a cloud: from 1 s, 7 damage per wasp each second to everyone inside, and blinded. They come back when it ends.',
      icon(g, s) {
        iconGround(g, s);
        // A ring of cells on the floor and a spiral of wasps turning over it.
        const cx = s * 0.5, cy = s * 0.5;
        g.strokeStyle = H.wax;
        g.globalAlpha = 0.6;
        g.lineWidth = s * 0.014;
        g.setLineDash([s * 0.04, s * 0.03]);
        g.beginPath();
        g.ellipse(cx, s * 0.62, s * 0.4, s * 0.26, 0, 0, PI * 2);
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
        cell(g, cx, s * 0.7, s * 0.09);
        cell(g, cx - s * 0.2, s * 0.64, s * 0.06);
        cell(g, cx + s * 0.2, s * 0.66, s * 0.06);
        for (let i = 0; i < 12; i++) {
          const a = i * 0.95, r = s * (0.07 + i * 0.026);
          const x = cx + Math.cos(a) * r, y = cy - s * 0.04 + Math.sin(a) * r * 0.7;
          wasp(g, x, y, s * (0.09 + (i % 3) * 0.02), a + PI / 2);
        }
        drop(g, s * 0.9, s * 0.2, s * 0.035);
      },
    },
    {
      key: 'R', label: 'swarm surge', name: 'Swarm Surge', range: 10, cooldown: 22, aim: 'line',
      blurb: 'Ultimate. He looses every wasp down a 10 m column, 4 m wide: 18 per wasp, shoves 4 m and blinds 1 s. The swarm does not come back: he is a plain fighter afterwards.',
      icon(g, s) {
        iconGround(g, s);
        // A wide wedge of wasps flying right, speed lines of wax behind them, a green star at the head.
        g.strokeStyle = H.wax;
        g.globalAlpha = 0.5;
        g.lineWidth = s * 0.014;
        for (const y of [0.3, 0.4, 0.6, 0.7]) {
          g.beginPath();
          g.moveTo(s * 0.04, s * y);
          g.lineTo(s * (0.3 + (y > 0.5 ? 0.7 - y : y - 0.2)), s * y);
          g.stroke();
        }
        g.globalAlpha = 1;
        for (let col = 0; col < 5; col++) {
          const spread = 0.05 + col * 0.045;
          for (let row = -2; row <= 2; row++) {
            const x = s * (0.18 + col * 0.15 + Math.abs(row) * 0.015);
            const y = s * (0.5 + row * spread);
            wasp(g, x, y, s * (0.1 + col * 0.01), row * 0.08);
          }
        }
        star(g, s * 0.9, s * 0.5, s * 0.06);
        cell(g, s * 0.9, s * 0.16, s * 0.07);
        cell(g, s * 0.9, s * 0.84, s * 0.07);
      },
    },
  ],
};
