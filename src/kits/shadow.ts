import type { HeroKit } from '../heroes';

/**
 * Shadow kit data (Nyx, the Umbral Stalker): four spells with canvas-drawn icons in the kit's palette. Signature
 * shape: flat cut-paper shadows, matte black with a thin violet edge line. See pipeline/designs/kit-shadow.md.
 */
const S = { core: '#f4e8ff', hot: '#c88cff', body: '#6a2ec0', accent: '#5affd2', dark: '#050308', foil: '#cfcad8' };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#2a1650');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** Fills the current path matte black with a thin violet edge line. */
function cutFill(g: CanvasRenderingContext2D, s: number, edge = 0.012) {
  g.fillStyle = S.dark;
  g.fill();
  g.strokeStyle = S.hot;
  g.lineWidth = Math.max(1.2, s * edge);
  g.lineJoin = 'round';
  g.stroke();
}

/** A curved dagger from the base (x1, y1) to the tip (x2, y2), `w` wide at the base. */
function blade(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, s: number) {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  const bow = l * 0.14;
  g.beginPath();
  g.moveTo(x1 + nx * w / 2, y1 + ny * w / 2);
  g.quadraticCurveTo((x1 + x2) / 2 + nx * (w * 0.5 + bow), (y1 + y2) / 2 + ny * (w * 0.5 + bow), x2, y2);
  g.quadraticCurveTo((x1 + x2) / 2 + nx * (-w * 0.3 + bow), (y1 + y2) / 2 + ny * (-w * 0.3 + bow), x1 - nx * w / 2, y1 - ny * w / 2);
  g.closePath();
  cutFill(g, s);
}

/** A hooded figure standing on (x, y) with height h. */
function figure(g: CanvasRenderingContext2D, x: number, y: number, h: number, s: number) {
  const w = h * 0.34;
  g.beginPath();
  g.moveTo(x, y - h);
  g.quadraticCurveTo(x + w * 0.5, y - h * 0.95, x + w * 0.5, y - h * 0.8);
  g.lineTo(x + w * 0.3, y - h * 0.72);
  g.quadraticCurveTo(x + w, y - h * 0.62, x + w * 0.95, y - h * 0.3);
  g.lineTo(x + w * 1.05, y - h * 0.08);
  g.lineTo(x + w * 0.5, y - h * 0.02);
  g.lineTo(x + w * 0.2, y - h * 0.08);
  g.lineTo(x, y);
  g.lineTo(x - w * 0.3, y - h * 0.07);
  g.lineTo(x - w * 0.55, y - h * 0.01);
  g.lineTo(x - w * 1.05, y - h * 0.1);
  g.quadraticCurveTo(x - w * 1.0, y - h * 0.6, x - w * 0.3, y - h * 0.72);
  g.lineTo(x - w * 0.5, y - h * 0.8);
  g.quadraticCurveTo(x - w * 0.5, y - h * 0.95, x, y - h);
  g.closePath();
  cutFill(g, s, 0.01);
}

/** A hand rising from (x, y) with height h, five claws. */
function hand(g: CanvasRenderingContext2D, x: number, y: number, h: number, s: number) {
  const fingers: [number, number, number][] = [[-0.2, -0.95, 0.4], [-0.1, -0.3, 0.64], [0, -0.04, 0.74], [0.1, 0.22, 0.66], [0.2, 0.55, 0.46]];
  g.beginPath();
  g.moveTo(x - 0.16 * h, y);
  g.lineTo(x - 0.22 * h, y - 0.26 * h);
  for (const [bx, a, len] of fingers) {
    g.lineTo(x + (bx - 0.05) * h, y - 0.28 * h);
    g.lineTo(x + (bx + Math.sin(a) * len) * h, y - (0.28 + Math.cos(a) * len) * h);
    g.lineTo(x + (bx + 0.05) * h, y - 0.28 * h);
  }
  g.lineTo(x + 0.22 * h, y - 0.26 * h);
  g.lineTo(x + 0.16 * h, y);
  g.closePath();
  cutFill(g, s, 0.012);
}

/** A thin crescent (tips at (cx, cy -+ r), bulge to the left), `thick` as a fraction of r. */
function crescent(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, bulge: number, thick: number, s: number) {
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.quadraticCurveTo(cx - r * bulge * 2, cy, cx, cy + r);
  g.quadraticCurveTo(cx - r * (bulge - thick) * 2, cy, cx, cy - r);
  g.closePath();
  cutFill(g, s, 0.012);
}

function disc(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, edge?: string, lw = 0) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (edge) {
    g.strokeStyle = edge;
    g.lineWidth = lw;
    g.stroke();
  }
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, edge?: string, lw = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (edge) {
    g.strokeStyle = edge;
    g.lineWidth = lw;
    g.stroke();
  }
}

function mintCut(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) {
  g.lineCap = 'round';
  g.strokeStyle = S.hot;
  g.lineWidth = w * 2.2;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.strokeStyle = S.accent;
  g.lineWidth = w;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}

export const shadowKit: HeroKit = {
  name: 'Nyx',
  maxHp: 600,
  title: 'the Umbral Stalker',
  accent: S.hot,
  foil: S.foil,
  portrait(g, s) {
    ground(g, s);
    // A pale moon behind her, two crossed daggers and the hooded figure with a mint slit for the eyes.
    disc(g, s * 0.5, s * 0.4, s * 0.3, S.foil);
    disc(g, s * 0.5, s * 0.4, s * 0.3, 'rgba(0,0,0,0)', S.hot, s * 0.012);
    blade(g, s * 0.2, s * 0.86, s * 0.56, s * 0.36, s * 0.07, s);
    blade(g, s * 0.8, s * 0.86, s * 0.44, s * 0.36, s * 0.07, s);
    figure(g, s * 0.5, s * 0.98, s * 0.9, s);
    g.fillStyle = S.accent;
    g.beginPath();
    g.moveTo(s * 0.455, s * 0.24); g.lineTo(s * 0.49, s * 0.255); g.lineTo(s * 0.455, s * 0.265); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(s * 0.545, s * 0.24); g.lineTo(s * 0.51, s * 0.255); g.lineTo(s * 0.545, s * 0.265); g.closePath(); g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'umbral blink', name: 'Umbral Blink', range: 7, cooldown: 3,
      blurb: 'A dash strike: she slides in stepped jumps to stand beside the enemy and cuts it with two crossed blades.',
      icon(g, s) {
        ground(g, s);
        ellipse(g, s * 0.5, s * 0.6, s * 0.4, s * 0.18, S.foil, undefined);
        blade(g, s * 0.16, s * 0.84, s * 0.84, s * 0.2, s * 0.13, s);
        blade(g, s * 0.84, s * 0.84, s * 0.16, s * 0.2, s * 0.13, s);
        mintCut(g, s * 0.34, s * 0.34, s * 0.66, s * 0.66, s * 0.022);
      },
    },
    {
      key: 'W', label: 'grasp of the deep', name: 'Grasp of the Deep', range: 0, cooldown: 7,
      blurb: 'A burst round her: a shadow pool opens, black hands rise and close on enemies within 3 m, hurt and silence them.',
      icon(g, s) {
        ground(g, s);
        ellipse(g, s * 0.5, s * 0.8, s * 0.44, s * 0.15, S.foil);
        ellipse(g, s * 0.5, s * 0.8, s * 0.36, s * 0.11, S.dark, S.hot, s * 0.014);
        hand(g, s * 0.3, s * 0.82, s * 0.5, s);
        hand(g, s * 0.7, s * 0.82, s * 0.5, s);
        hand(g, s * 0.5, s * 0.86, s * 0.7, s);
      },
    },
    {
      key: 'E', label: 'night shroud', name: 'Night Shroud', range: 0, cooldown: 9,
      blurb: 'No aim: she turns to the nearest enemy within 8 m and three shadow clones fly out at it as a fan of bolts.',
      icon(g, s) {
        ground(g, s);
        ellipse(g, s * 0.5, s * 0.7, s * 0.42, s * 0.2, S.foil);
        ellipse(g, s * 0.5, s * 0.7, s * 0.34, s * 0.15, S.dark, S.hot, s * 0.014);
        figure(g, s * 0.5, s * 0.78, s * 0.56, s);
        figure(g, s * 0.2, s * 0.7, s * 0.34, s);
        figure(g, s * 0.8, s * 0.7, s * 0.34, s);
        mintCut(g, s * 0.62, s * 0.3, s * 0.78, s * 0.2, s * 0.018);
      },
    },
    {
      key: 'R', label: 'eclipse execution', name: 'Eclipse Execution', range: 10, cooldown: 20,
      blurb: 'Ultimate. An eclipse darkens a small zone and a giant crescent blade cuts down through it for huge damage.',
      icon(g, s) {
        ground(g, s);
        disc(g, s * 0.5, s * 0.36, s * 0.27, S.foil);
        disc(g, s * 0.52, s * 0.36, s * 0.25, S.dark, S.hot, s * 0.014);
        ellipse(g, s * 0.5, s * 0.88, s * 0.42, s * 0.07, S.foil);
        // The crescent blade sweeping down in front of the eclipse (a smile turned on its side).
        g.save();
        g.translate(s * 0.5, s * 0.62);
        g.rotate(-Math.PI / 2);
        crescent(g, 0, 0, s * 0.4, 0.55, 0.3, s);
        g.restore();
        mintCut(g, s * 0.16, s * 0.84, s * 0.84, s * 0.84, s * 0.02);
      },
    },
  ],
};
