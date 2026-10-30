import type { HeroKit } from '../heroes';

/**
 * Hive kit data: Sirix, the Swarm Warden (a melee brawler with summons). Four spells (labels as registered), canvas-drawn
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
      key: 'Q', label: 'mandible rend', name: 'Mandible Rend', range: 3, cooldown: 2.5,
      blurb: 'A melee double claw swipe: two crossing serrated arcs rend the cone in front of him, shove and slow everything in it.',
      icon(g, s) {
        iconGround(g, s);
        // Two crossing serrated claw arcs, wasps buzzing off them, honey drops.
        claw(g, s * 0.4, s * 0.68, s * 0.5, -PI * 0.8, -PI * 0.12, s * 0.14);
        claw(g, s * 0.4, s * 0.32, s * 0.5, PI * 0.12, PI * 0.8, s * 0.12);
        wasp(g, s * 0.82, s * 0.5, s * 0.15, 0.2);
        wasp(g, s * 0.66, s * 0.14, s * 0.1, -0.5);
        drop(g, s * 0.88, s * 0.78, s * 0.04);
        drop(g, s * 0.72, s * 0.86, s * 0.03);
        star(g, s * 0.78, s * 0.3, s * 0.05);
      },
    },
    {
      key: 'W', label: 'swarm leap', name: 'Swarm Leap', range: 8, cooldown: 9, dash: true, summon: true,
      blurb: 'A gap closer: he leaps with the swarm streaming behind him, lands in a burst of honeycomb and two wasp soldiers peel off to fight.',
      icon(g, s) {
        iconGround(g, s);
        // A ribbon of wasps rising from the lower left to a honeycomb landing at the upper right.
        const pts: [number, number, number][] = [[0.1, 0.84, 0.3], [0.2, 0.72, 0.9], [0.3, 0.64, 0.5], [0.4, 0.56, 1.1], [0.5, 0.5, 0.6], [0.6, 0.42, 0.2]];
        for (const [x, y, r] of pts) wasp(g, s * x, s * y, s * 0.11, -0.7 + r * 0.3);
        cell(g, s * 0.78, s * 0.3, s * 0.12);
        cell(g, s * 0.78 + s * 0.21, s * 0.3 + s * 0.04, s * 0.09);
        cell(g, s * 0.67, s * 0.5, s * 0.085);
        cell(g, s * 0.84, s * 0.52, s * 0.075);
        wasp(g, s * 0.5, s * 0.82, s * 0.14, -0.3);
        wasp(g, s * 0.68, s * 0.8, s * 0.14, 0.3);
        drop(g, s * 0.9, s * 0.7, s * 0.04);
      },
    },
    {
      key: 'E', label: 'chitin carapace', name: 'Chitin Carapace', range: 0, cooldown: 9,
      blurb: 'Black chitin plates snap round him in a pure shield of 60 for 3 s while the swarm circles. No damage.',
      icon(g, s) {
        iconGround(g, s);
        // A shell of chitin hexagons round a core, wasps circling it.
        const cx = s * 0.5, cy = s * 0.52;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * PI * 2 + 0.3, rr = s * 0.27;
          hexPath(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, s * 0.1, a);
          g.fillStyle = '#1e1708';
          g.fill();
          g.strokeStyle = H.body;
          g.lineWidth = s * 0.02;
          g.stroke();
        }
        hexPath(g, cx, cy, s * 0.14);
        g.fillStyle = H.body;
        g.fill();
        g.strokeStyle = H.wax;
        g.lineWidth = s * 0.016;
        g.stroke();
        hexPath(g, cx, cy, s * 0.06);
        g.fillStyle = H.dark;
        g.fill();
        wasp(g, s * 0.16, s * 0.2, s * 0.12, 0.8);
        wasp(g, s * 0.84, s * 0.78, s * 0.12, PI + 0.8);
        wasp(g, s * 0.84, s * 0.22, s * 0.1, 2.2);
        wasp(g, s * 0.16, s * 0.8, s * 0.1, -0.9);
      },
    },
    {
      key: 'R', label: "queen's descent", name: "Queen's Descent", range: 13, cooldown: 20,
      blurb: 'Ultimate. A honeycomb tower closes round the zone and the whole swarm, shaped like a giant queen wasp, dives into its centre: slows, and three wasp soldiers drop where it lands.',
      icon(g, s) {
        iconGround(g, s);
        // A ring wall of cells on the floor, the swarm-queen diving head-first with folded wings, a green star at the centre.
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * PI * 2, rx = s * 0.4, ry = s * 0.12;
          cell(g, s * 0.5 + Math.cos(a) * rx, s * 0.84 + Math.sin(a) * ry, s * 0.06 + (Math.sin(a) > 0 ? s * 0.012 : 0));
        }
        g.save();
        g.translate(s * 0.5, s * 0.42);
        g.rotate(0.15);
        // Wings folded back along the body.
        g.fillStyle = H.wax;
        g.globalAlpha = 0.7;
        for (const sd of [-1, 1]) {
          g.beginPath();
          g.ellipse(sd * s * 0.1, -s * 0.12, s * 0.045, s * 0.2, sd * 0.25, 0, PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
        // Striped abdomen above, thorax and head pointing down.
        g.fillStyle = H.body;
        g.beginPath();
        g.ellipse(0, -s * 0.18, s * 0.1, s * 0.2, 0, 0, PI * 2);
        g.fill();
        g.fillStyle = H.dark;
        for (const y of [-0.3, -0.22, -0.14]) g.fillRect(-s * 0.1, s * y, s * 0.2, s * 0.035);
        g.beginPath();
        g.ellipse(0, s * 0.04, s * 0.085, s * 0.09, 0, 0, PI * 2);
        g.fill();
        g.beginPath();
        g.arc(0, s * 0.15, s * 0.06, 0, PI * 2);
        g.fill();
        g.fillStyle = H.accent;
        g.beginPath();
        g.arc(-s * 0.03, s * 0.17, s * 0.016, 0, PI * 2);
        g.arc(s * 0.03, s * 0.17, s * 0.016, 0, PI * 2);
        g.fill();
        g.restore();
        // A loose swarm around her.
        wasp(g, s * 0.18, s * 0.3, s * 0.1, 0.9);
        wasp(g, s * 0.82, s * 0.26, s * 0.1, 2.3);
        wasp(g, s * 0.26, s * 0.56, s * 0.09, 0.3);
        wasp(g, s * 0.76, s * 0.58, s * 0.09, PI - 0.3);
        star(g, s * 0.5, s * 0.72, s * 0.07);
      },
    },
  ],
};
