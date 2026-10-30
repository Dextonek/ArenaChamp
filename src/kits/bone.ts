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
      key: 'Q', label: 'bone spear', name: 'Bone Spear', range: 11, cooldown: 3, aim: 'line',
      blurb: 'Assembles a spear of vertebrae and throws it down a line; it pierces everything it meets and clatters apart.',
      icon(g, s) {
        iconGround(g, s);
        // A vertebra spear, low left to high right: five chunky segments, a pointed head, soulfire in the gaps.
        const x0 = s * 0.12, y0 = s * 0.84, x1 = s * 0.7, y1 = s * 0.26;
        const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
        const ang = Math.atan2(dy, dx);
        for (let i = 0; i < 5; i++) {
          const k = 0.04 + i * 0.17, cx = x0 + dx * k, cy = y0 + dy * k;
          g.save();
          g.translate(cx + ux * s * 0.06, cy + uy * s * 0.06);
          g.rotate(ang);
          g.fillStyle = S.bone;
          g.strokeStyle = S.crev;
          g.lineWidth = s * 0.014;
          g.beginPath();
          g.roundRect(-s * 0.085, -s * 0.052, s * 0.17, s * 0.104, s * 0.03);
          g.fill();
          g.stroke();
          if (i % 2 === 1) {
            g.beginPath();
            g.moveTo(-s * 0.02, -s * 0.05);
            g.lineTo(0, -s * 0.11);
            g.lineTo(s * 0.02, -s * 0.05);
            g.fill();
            g.stroke();
          }
          g.restore();
          if (i < 4) wisp(g, cx + ux * s * 0.15, cy + uy * s * 0.15 + s * 0.012, s * 0.017);
        }
        g.save();
        g.translate(x1 + ux * s * 0.02, y1 + uy * s * 0.02);
        g.rotate(ang);
        g.fillStyle = S.bone;
        g.strokeStyle = S.crev;
        g.lineWidth = s * 0.014;
        g.beginPath();
        g.moveTo(-s * 0.03, -s * 0.07);
        g.lineTo(s * 0.2, 0);
        g.lineTo(-s * 0.03, s * 0.07);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
        // Chips flying off the tail.
        g.fillStyle = S.bone;
        for (const [x, y, r] of [[0.08, 0.64, 0.016], [0.22, 0.9, 0.014], [0.34, 0.74, 0.012], [0.88, 0.14, 0.014]]) {
          g.beginPath();
          g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          g.fill();
        }
        ember(g, s * 0.9, s * 0.2, s * 0.024);
      },
    },
    {
      key: 'W', label: 'grave call', name: 'Grave Call', range: 10, cooldown: 9, summon: true,
      blurb: 'The ground cracks open; two skeletons claw out in a burst of bone and fight for him for a few seconds.',
      icon(g, s) {
        iconGround(g, s);
        // A cracked floor ellipse, teal light in the cracks.
        g.fillStyle = '#071210';
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.78, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
        g.fill();
        ring(g, s * 0.5, s * 0.78, s * 0.42, s * 0.14, S.crev, s * 0.02);
        g.lineCap = 'round';
        g.lineJoin = 'round';
        const cracks: [number, number][][] = [
          [[0.5, 0.78], [0.36, 0.72], [0.26, 0.76], [0.14, 0.72]],
          [[0.5, 0.78], [0.66, 0.84], [0.78, 0.8], [0.9, 0.84]],
          [[0.5, 0.78], [0.44, 0.88], [0.34, 0.9]],
          [[0.5, 0.78], [0.58, 0.7], [0.72, 0.72]],
        ];
        for (const [col, w] of [[S.dark, 0.034], [S.body, 0.014]] as [string, number][]) {
          g.strokeStyle = col;
          g.lineWidth = s * w;
          for (const c of cracks) {
            g.beginPath();
            c.forEach(([x, y], i) => (i ? g.lineTo(s * x, s * y) : g.moveTo(s * x, s * y)));
            g.stroke();
          }
        }
        // Spires either side, a skull clawing out in the middle, and the claw fingers.
        spire(g, s * 0.2, s * 0.76, s * 0.34, s * 0.12);
        spire(g, s * 0.8, s * 0.78, s * 0.28, s * 0.1);
        skull(g, s * 0.5, s * 0.5, s * 0.15);
        bone(g, s * 0.3, s * 0.74, s * 0.34, s * 0.52, s * 0.03);
        bone(g, s * 0.7, s * 0.74, s * 0.66, s * 0.5, s * 0.03);
        wisp(g, s * 0.4, s * 0.3, s * 0.022);
        wisp(g, s * 0.62, s * 0.26, s * 0.02);
        g.fillStyle = '#8a7d6c';
        for (const [x, y, r] of [[0.14, 0.86, 0.04], [0.86, 0.88, 0.035], [0.5, 0.94, 0.03]]) {
          g.beginPath();
          g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          g.fill();
        }
      },
    },
    {
      key: 'E', label: 'ossuary ward', name: 'Ossuary Ward', range: 9, cooldown: 9, cc: true,
      blurb: 'A cage of ribs grows round the chosen enemy, closes and roots it for 1.2 s, and flexes again to cut it with bone shards.',
      icon(g, s) {
        iconGround(g, s);
        ring(g, s * 0.5, s * 0.8, s * 0.4, s * 0.12, '#071210', s * 0.1);
        ring(g, s * 0.5, s * 0.8, s * 0.4, s * 0.12, S.crev, s * 0.016);
        // A dome of curved ribs from the ground ellipse up to a point.
        const tops = [0.5, 0.5, 0.5, 0.5, 0.5];
        const feet: [number, number][] = [[0.14, 0.78], [0.28, 0.9], [0.5, 0.93], [0.72, 0.9], [0.86, 0.78]];
        const back: [number, number][] = [[0.3, 0.72], [0.5, 0.7], [0.7, 0.72]];
        const arcs = (pts: [number, number][], w: number) => {
          pts.forEach(([x, y], i) => {
            const ctrlX = x + (0.5 - x) * 0.05 + (x < 0.5 ? -0.16 : x > 0.5 ? 0.16 : 0.0);
            g.strokeStyle = S.crev;
            g.lineWidth = s * w * 1.45;
            g.lineCap = 'round';
            g.beginPath();
            g.moveTo(s * x, s * y);
            g.quadraticCurveTo(s * ctrlX, s * (0.1 + (i % 2) * 0.05), s * tops[0], s * 0.14);
            g.stroke();
            g.strokeStyle = S.bone;
            g.lineWidth = s * w;
            g.beginPath();
            g.moveTo(s * x, s * y);
            g.quadraticCurveTo(s * ctrlX, s * (0.1 + (i % 2) * 0.05), s * tops[0], s * 0.14);
            g.stroke();
          });
        };
        arcs(back, 0.026);
        skull(g, s * 0.5, s * 0.58, s * 0.1);
        wisp(g, s * 0.34, s * 0.48, s * 0.02);
        wisp(g, s * 0.66, s * 0.44, s * 0.022);
        arcs(feet, 0.034);
        g.fillStyle = S.bone;
        for (const [x, y, r] of [[0.06, 0.6, 0.014], [0.94, 0.62, 0.014], [0.04, 0.86, 0.012], [0.96, 0.88, 0.012]]) {
          g.beginPath();
          g.arc(s * x, s * y, s * r, 0, Math.PI * 2);
          g.fill();
        }
        ember(g, s * 0.5, s * 0.14, s * 0.022);
      },
    },
    {
      key: 'R', label: 'legion of the ossuary', name: 'Legion of the Ossuary', range: 13, cooldown: 20, summon: true,
      blurb: 'Ultimate. A giant skeletal hand rises, closes and slams the zone; bone spires burst up and two skeleton archers join him.',
      icon(g, s) {
        iconGround(g, s);
        // A ring of spires on the floor, the hand reaching up out of it.
        ring(g, s * 0.5, s * 0.86, s * 0.44, s * 0.11, '#071210', s * 0.08);
        spire(g, s * 0.1, s * 0.88, s * 0.22, s * 0.07);
        spire(g, s * 0.9, s * 0.88, s * 0.22, s * 0.07);
        spire(g, s * 0.24, s * 0.95, s * 0.2, s * 0.06);
        spire(g, s * 0.78, s * 0.95, s * 0.18, s * 0.06);
        // Forearm bones.
        bone(g, s * 0.44, s * 0.9, s * 0.46, s * 0.62, s * 0.075);
        bone(g, s * 0.58, s * 0.9, s * 0.56, s * 0.64, s * 0.05);
        // Palm.
        g.fillStyle = S.bone;
        g.strokeStyle = S.crev;
        g.lineWidth = s * 0.016;
        g.beginPath();
        g.roundRect(s * 0.32, s * 0.46, s * 0.4, s * 0.2, s * 0.06);
        g.fill();
        g.stroke();
        // Four fingers fanning up (three bones each) and a thumb.
        const fingers: [number, number, number, number][] = [[0.36, -0.28, 0.2, 0.13], [0.45, -0.1, 0.24, 0.15], [0.55, 0.06, 0.23, 0.14], [0.66, 0.24, 0.18, 0.11]];
        for (const [fx, a, l1, l2] of fingers) {
          let x = s * fx, y = s * 0.48, ang = -Math.PI / 2 + a;
          for (let j = 0; j < 3; j++) {
            const len = s * (j === 0 ? l1 : j === 1 ? l2 : l2 * 0.8);
            const nx = x + Math.cos(ang) * len, ny = y + Math.sin(ang) * len;
            bone(g, x, y, nx, ny, s * (0.05 - j * 0.008));
            if (j < 2) wisp(g, nx, ny + s * 0.01, s * 0.013);
            x = nx;
            y = ny;
            ang += a * 0.25 + 0.08;
          }
        }
        bone(g, s * 0.33, s * 0.6, s * 0.2, s * 0.5, s * 0.05);
        bone(g, s * 0.2, s * 0.5, s * 0.14, s * 0.38, s * 0.04);
        ember(g, s * 0.52, s * 0.57, s * 0.03);
        g.fillStyle = S.body;
        g.beginPath();
        g.arc(s * 0.52, s * 0.57, s * 0.012, 0, Math.PI * 2);
        g.fill();
      },
    },
  ],
};
