import type { HeroKit } from '../heroes';

/**
 * Bone kit data: Mortis, the Ossuary Lord. Four spells (labels as registered), canvas-drawn icons in the kit's palette:
 * a teal-black ground, chunky ivory bone with dark crevices, teal soulfire wisps, one ember accent. Signature shape:
 * bone architecture (ribs, vertebrae, skull-capped spires, cages).
 */
const S = { core: '#f4fffb', hot: '#b8fff0', body: '#3fd8b8', accent: '#ff5a3a', dark: '#0a1412', bone: '#ece4d0', crev: '#3a291b' };

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#12302b');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** A bone: dark outline, ivory shaft, round knobs at both ends. */
function bone(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, knobs = true) {
  g.lineCap = 'round';
  g.strokeStyle = S.crev;
  g.lineWidth = w * 1.4;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  g.strokeStyle = S.bone;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  if (!knobs) return;
  for (const [x, y] of [[x1, y1], [x2, y2]]) {
    g.fillStyle = S.bone;
    g.strokeStyle = S.crev;
    g.lineWidth = Math.max(1, w * 0.22);
    g.beginPath();
    g.arc(x, y, w * 0.72, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}

/** A teal soulfire wisp: a teardrop flame pointing up with a hot core. */
function wisp(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const path = (k: number) => {
    g.beginPath();
    g.moveTo(x, y - r * 2.1 * k);
    g.quadraticCurveTo(x + r * 1.1 * k, y - r * 0.2 * k, x, y + r * 0.9 * k);
    g.quadraticCurveTo(x - r * 1.1 * k, y - r * 0.2 * k, x, y - r * 2.1 * k);
  };
  g.fillStyle = S.body;
  path(1);
  g.fill();
  g.fillStyle = S.hot;
  path(0.55);
  g.fill();
}

/** A skull, looking at the viewer: cranium, jaw, two sockets with teal eyes. */
function skull(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.fillStyle = S.bone;
  g.strokeStyle = S.crev;
  g.lineWidth = Math.max(1, r * 0.1);
  g.beginPath();
  g.ellipse(cx, cy, r, r * 0.92, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.roundRect(cx - r * 0.52, cy + r * 0.58, r * 1.04, r * 0.62, r * 0.14);
  g.fill();
  g.stroke();
  g.fillStyle = S.dark;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + sx * r * 0.38, cy + r * 0.02, r * 0.27, r * 0.3, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.moveTo(cx, cy + r * 0.22);
  g.lineTo(cx - r * 0.1, cy + r * 0.5);
  g.lineTo(cx + r * 0.1, cy + r * 0.5);
  g.fill();
  g.fillStyle = S.hot;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(cx + sx * r * 0.38, cy + r * 0.04, r * 0.11, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = S.crev;
  g.lineWidth = Math.max(1, r * 0.06);
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(cx + i * r * 0.26, cy + r * 0.74);
    g.lineTo(cx + i * r * 0.26, cy + r * 1.1);
    g.stroke();
  }
}

/** A stack of three tapering bone segments (a spire) from the ground up. */
function spire(g: CanvasRenderingContext2D, x: number, y: number, h: number, w: number) {
  g.fillStyle = S.bone;
  g.strokeStyle = S.crev;
  g.lineWidth = Math.max(1, w * 0.12);
  const n = 3;
  for (let i = 0; i < n; i++) {
    const y0 = y - (h * i) / n, y1 = y - (h * (i + 1)) / n;
    const w0 = w * (1 - i * 0.28), w1 = w * (1 - (i + 1) * 0.28);
    g.beginPath();
    g.moveTo(x - w0 / 2, y0);
    g.lineTo(x - w1 / 2, y1);
    if (i === n - 1) g.lineTo(x, y1 - h / n * 0.5);
    g.lineTo(x + w1 / 2, y1);
    g.lineTo(x + w0 / 2, y0);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

function ember(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = S.accent;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function ring(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, col: string, w: number) {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();
}

export const boneKit: HeroKit = {
  name: 'Mortis',
  title: 'the Ossuary Lord',
  accent: S.body,
  foil: S.bone,
  maxHp: 580,
  portrait(g, s) {
    iconGround(g, s);
    // A staff on the right: a bone shaft with a small skull on top and a soulfire wisp above it.
    bone(g, s * 0.84, s * 1.0, s * 0.84, s * 0.3, s * 0.035, false);
    skull(g, s * 0.84, s * 0.24, s * 0.07);
    wisp(g, s * 0.84, s * 0.1, s * 0.035);
    // Robe shoulders with a ribcage mantle.
    g.fillStyle = '#16231f';
    g.beginPath();
    g.moveTo(s * 0.1, s);
    g.quadraticCurveTo(s * 0.14, s * 0.7, s * 0.32, s * 0.6);
    g.quadraticCurveTo(s * 0.5, s * 0.52, s * 0.68, s * 0.6);
    g.quadraticCurveTo(s * 0.86, s * 0.7, s * 0.9, s);
    g.closePath();
    g.fill();
    g.strokeStyle = S.body;
    g.lineWidth = s * 0.012;
    g.stroke();
    // Rib arcs sweeping over the chest.
    for (let i = 0; i < 4; i++) {
      const y = s * (0.72 + i * 0.065), w = s * (0.17 - i * 0.015);
      g.strokeStyle = S.crev;
      g.lineWidth = s * 0.03;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(s * 0.5 - w, y - s * 0.05);
      g.quadraticCurveTo(s * 0.5, y + s * 0.06, s * 0.5 + w, y - s * 0.05);
      g.stroke();
      g.strokeStyle = S.bone;
      g.lineWidth = s * 0.02;
      g.beginPath();
      g.moveTo(s * 0.5 - w, y - s * 0.05);
      g.quadraticCurveTo(s * 0.5, y + s * 0.06, s * 0.5 + w, y - s * 0.05);
      g.stroke();
    }
    bone(g, s * 0.5, s * 0.62, s * 0.5, s * 0.98, s * 0.022, false);
    // The hood, dark with a teal rim, round the skull face.
    g.fillStyle = '#101c19';
    g.beginPath();
    g.moveTo(s * 0.22, s * 0.66);
    g.quadraticCurveTo(s * 0.2, s * 0.16, s * 0.5, s * 0.12);
    g.quadraticCurveTo(s * 0.8, s * 0.16, s * 0.78, s * 0.66);
    g.quadraticCurveTo(s * 0.5, s * 0.56, s * 0.22, s * 0.66);
    g.closePath();
    g.fill();
    g.strokeStyle = S.body;
    g.lineWidth = s * 0.014;
    g.stroke();
    skull(g, s * 0.5, s * 0.38, s * 0.17);
    wisp(g, s * 0.37, s * 0.22, s * 0.02);
    wisp(g, s * 0.64, s * 0.2, s * 0.025);
    wisp(g, s * 0.2, s * 0.62, s * 0.02);
  },
  spells: [
    {
      key: 'Q', label: 'bone fan', name: 'Bone Fan', range: 8, cooldown: 5, aim: 'line',
      blurb: 'Flicks three bone shards in a fan (30 each). Every bone pile within 3 m of him throws one more (six at most).',
      icon(g, s) {
        iconGround(g, s);
        // Five pointed shards fanning out and up from a small pile on the floor at the lower left.
        const ox = s * 0.2, oy = s * 0.8;
        const fan: [number, number][] = [[-1.0, -0.32], [-0.62, -0.7], [-0.1, -0.86], [0.46, -0.78], [0.86, -0.44]];
        for (const [dx, dy] of fan) {
          const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, len = s * 0.62;
          const x1 = ox + ux * len * 0.78, y1 = oy + uy * len * 0.78;
          bone(g, ox + ux * s * 0.06, oy + uy * s * 0.06, x1, y1, s * 0.045, false);
          // The point.
          const nx = -uy, ny = ux;
          g.fillStyle = S.bone;
          g.strokeStyle = S.crev;
          g.lineWidth = s * 0.012;
          g.beginPath();
          g.moveTo(x1 + nx * s * 0.045, y1 + ny * s * 0.045);
          g.lineTo(ox + ux * len, oy + uy * len);
          g.lineTo(x1 - nx * s * 0.045, y1 - ny * s * 0.045);
          g.closePath();
          g.fill();
          g.stroke();
        }
        // The pile: a heap of short bones and a small skull.
        bone(g, s * 0.08, s * 0.9, s * 0.3, s * 0.86, s * 0.04);
        bone(g, s * 0.14, s * 0.84, s * 0.32, s * 0.93, s * 0.035);
        skull(g, s * 0.2, s * 0.86, s * 0.07);
        wisp(g, s * 0.34, s * 0.74, s * 0.022);
        wisp(g, s * 0.54, s * 0.2, s * 0.02);
        ember(g, s * 0.9, s * 0.18, s * 0.022);
      },
    },
    {
      key: 'W', label: 'raise dead', name: 'Raise Dead', range: 9, cooldown: 9, summon: true,
      blurb: 'A skeleton claws out of the ground at the spot, and one more for every bone pile within 4 m of it (three more at most).',
      icon(g, s) {
        iconGround(g, s);
        // A mound of earth with a skeletal hand reaching out of it, a skull rising behind, bones round the foot.
        g.fillStyle = '#071210';
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.84, s * 0.44, s * 0.13, 0, 0, Math.PI * 2);
        g.fill();
        ring(g, s * 0.5, s * 0.84, s * 0.44, s * 0.13, S.crev, s * 0.02);
        skull(g, s * 0.5, s * 0.34, s * 0.14);
        // The forearm and the hand: a palm, four fingers with knuckles and a thumb.
        bone(g, s * 0.5, s * 0.9, s * 0.5, s * 0.66, s * 0.07);
        g.fillStyle = S.bone;
        g.strokeStyle = S.crev;
        g.lineWidth = s * 0.016;
        g.beginPath();
        g.roundRect(s * 0.37, s * 0.52, s * 0.26, s * 0.16, s * 0.04);
        g.fill();
        g.stroke();
        const fingers: [number, number, number][] = [[0.39, 0.5, 0.28], [0.46, 0.5, 0.2], [0.54, 0.5, 0.18], [0.61, 0.5, 0.26]];
        fingers.forEach(([x, y, top], i) => {
          const lean = (i - 1.5) * 0.04;
          bone(g, s * x, s * y, s * (x + lean), s * (y - (y - top) * 0.55), s * 0.032);
          bone(g, s * (x + lean), s * (y - (y - top) * 0.55), s * (x + lean * 2.4), s * top, s * 0.026);
        });
        bone(g, s * 0.37, s * 0.6, s * 0.27, s * 0.5, s * 0.032);
        bone(g, s * 0.27, s * 0.5, s * 0.24, s * 0.42, s * 0.026);
        wisp(g, s * 0.3, s * 0.3, s * 0.02);
        wisp(g, s * 0.74, s * 0.38, s * 0.024);
        g.fillStyle = '#8a7d6c';
        for (const [x, y, r] of [[0.16, 0.86, 0.04], [0.84, 0.88, 0.035], [0.3, 0.94, 0.03], [0.7, 0.95, 0.03]]) {
          g.beginPath();
          g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          g.fill();
        }
      },
    },
    {
      key: 'E', label: 'bone armour', name: 'Bone Armour', range: 0, cooldown: 14,
      blurb: 'A cage of ribs closes round him: a shield of 30, plus 30 per living skeleton (120 at most), for 4 s. When it breaks, or at 3.5 s, its shards fly at the enemy for 38.',
      icon(g, s) {
        iconGround(g, s);
        // A shield ring in soulfire, a ribcage cuirass inside it, shards springing off the rim.
        ring(g, s * 0.5, s * 0.5, s * 0.4, s * 0.4, '#071210', s * 0.07);
        ring(g, s * 0.5, s * 0.5, s * 0.4, s * 0.4, S.body, s * 0.022);
        // Shoulder spikes either side.
        spire(g, s * 0.2, s * 0.5, s * 0.22, s * 0.1);
        spire(g, s * 0.8, s * 0.5, s * 0.22, s * 0.1);
        // The sternum and the rib arcs, four each side.
        bone(g, s * 0.5, s * 0.2, s * 0.5, s * 0.8, s * 0.04, false);
        for (let i = 0; i < 4; i++) {
          const y = s * (0.3 + i * 0.12), w = s * (0.27 - i * 0.025);
          for (const sx of [-1, 1]) {
            for (const [col, lw] of [[S.crev, 0.05], [S.bone, 0.034]] as [string, number][]) {
              g.strokeStyle = col;
              g.lineWidth = s * lw;
              g.lineCap = 'round';
              g.beginPath();
              g.moveTo(s * 0.5, y);
              g.quadraticCurveTo(s * 0.5 + sx * w * 0.9, y - s * 0.08, s * 0.5 + sx * w, y + s * 0.1);
              g.stroke();
            }
          }
        }
        wisp(g, s * 0.5, s * 0.52, s * 0.028);
        wisp(g, s * 0.38, s * 0.4, s * 0.018);
        wisp(g, s * 0.62, s * 0.64, s * 0.018);
        // Shards flying out of the rim.
        for (const [x1, y1, x2, y2] of [[0.1, 0.18, 0.04, 0.08], [0.9, 0.2, 0.96, 0.1], [0.92, 0.82, 0.97, 0.9]]) {
          bone(g, s * x1, s * y1, s * x2, s * y2, s * 0.03, false);
        }
        ember(g, s * 0.5, s * 0.1, s * 0.022);
      },
    },
    {
      key: 'R', label: 'grave grasp', name: 'Grave Grasp', range: 9, cooldown: 22, cc: true,
      blurb: 'Ultimate. A giant skeletal hand bursts out under the enemy (60 damage), drags it 4 m toward him in 0.8 s and holds it rooted for 1 s while two skeletons claw out beside it (28 damage more). Needs line of sight.',
      icon(g, s) {
        iconGround(g, s);
        // The floor, with drag furrows running to the left.
        g.fillStyle = '#071210';
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.88, s * 0.48, s * 0.11, 0, 0, Math.PI * 2);
        g.fill();
        g.lineCap = 'round';
        for (const [col, w] of [[S.dark, 0.034], [S.body, 0.012]] as [string, number][]) {
          g.strokeStyle = col;
          g.lineWidth = s * w;
          for (const y of [0.86, 0.92]) {
            g.beginPath();
            g.moveTo(s * 0.9, s * y);
            g.lineTo(s * 0.34, s * (y + 0.02));
            g.stroke();
          }
        }
        // The forearm rising from the right, the big fist closing on a little soul.
        bone(g, s * 0.94, s * 0.9, s * 0.74, s * 0.5, s * 0.11);
        bone(g, s * 0.84, s * 0.92, s * 0.68, s * 0.6, s * 0.05);
        g.fillStyle = S.bone;
        g.strokeStyle = S.crev;
        g.lineWidth = s * 0.02;
        g.beginPath();
        g.ellipse(s * 0.62, s * 0.42, s * 0.18, s * 0.15, 0.3, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        // The captive: a wisp and a tiny skull held in the hollow of the fingers.
        wisp(g, s * 0.36, s * 0.56, s * 0.04);
        skull(g, s * 0.36, s * 0.62, s * 0.06);
        // Four fingers curling over it from the top, with knuckles.
        for (let i = 0; i < 4; i++) {
          const x0 = s * (0.52 - i * 0.07), y0 = s * (0.3 + i * 0.02);
          const pts: [number, number][] = [[x0, y0], [x0 - s * 0.14, y0 - s * 0.04], [x0 - s * 0.2, y0 + s * 0.08], [x0 - s * 0.16, y0 + s * 0.22]];
          for (const [col, lw] of [[S.crev, 0.07], [S.bone, 0.05]] as [string, number][]) {
            g.strokeStyle = col;
            g.lineWidth = s * lw * (1 - i * 0.07);
            g.beginPath();
            pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
            g.stroke();
          }
          g.fillStyle = S.bone;
          g.beginPath();
          g.arc(pts[1][0], pts[1][1], s * 0.034, 0, Math.PI * 2);
          g.arc(pts[2][0], pts[2][1], s * 0.03, 0, Math.PI * 2);
          g.fill();
        }
        // The thumb across the front.
        bone(g, s * 0.66, s * 0.56, s * 0.46, s * 0.7, s * 0.05);
        wisp(g, s * 0.84, s * 0.26, s * 0.026);
        wisp(g, s * 0.16, s * 0.3, s * 0.02);
        ember(g, s * 0.28, s * 0.12, s * 0.022);
      },
    },
  ],
};
