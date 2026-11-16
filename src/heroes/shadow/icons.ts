import type { HeroKey, HeroKit, HeroSpell } from '../../heroes';

/**
 * Shadow kit data (Nyx, the Umbral Stalker): four spells with canvas-drawn icons in the kit's palette. Signature
 * shape: flat cut-paper shadows, matte black with a thin violet edge line. See pipeline/designs/kit-shadow.md.
 */
export const S = { core: '#f4e8ff', hot: '#c88cff', body: '#6a2ec0', accent: '#5affd2', dark: '#050308', foil: '#cfcad8' };

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

/** Nyx's portrait, drawn on a canvas. */
export const portrait: HeroKit['portrait'] = function (g, s) {
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
};

/** The canvas icons of the four spells (the fallback behind public/icons/spells/; src/icons/vc.ts). */
export const icons: Record<HeroKey, HeroSpell['icon']> = {
  Q(g, s) {
    ground(g, s);
    ellipse(g, s * 0.5, s * 0.8, s * 0.4, s * 0.12, S.foil);
    // A dagger driven down at a hooded figure's back, a mint cut across it.
    figure(g, s * 0.62, s * 0.9, s * 0.62, s);
    blade(g, s * 0.2, s * 0.14, s * 0.52, s * 0.62, s * 0.13, s);
    crescent(g, s * 0.3, s * 0.4, s * 0.2, 0.5, 0.25, s);
    mintCut(g, s * 0.36, s * 0.42, s * 0.78, s * 0.7, s * 0.022);
  },
  W(g, s) {
    ground(g, s);
    ellipse(g, s * 0.5, s * 0.74, s * 0.44, s * 0.17, S.foil);
    ellipse(g, s * 0.5, s * 0.74, s * 0.36, s * 0.12, S.dark, S.hot, s * 0.014);
    // Lumpy smoke wisps rising round a half-faded figure.
    const puffs: [number, number, number][] = [[0.28, 0.66, 0.13], [0.72, 0.64, 0.14], [0.4, 0.5, 0.15], [0.62, 0.46, 0.13], [0.5, 0.3, 0.12], [0.3, 0.36, 0.09], [0.72, 0.32, 0.08]];
    g.globalAlpha = 0.55;
    figure(g, s * 0.5, s * 0.78, s * 0.58, s);
    g.globalAlpha = 1;
    for (const [x, y, r] of puffs) disc(g, s * x, s * y, s * r, '#1c0c38', S.hot, s * 0.013);
    mintCut(g, s * 0.44, s * 0.2, s * 0.58, s * 0.14, s * 0.014);
  },
  E(g, s) {
    ground(g, s);
    ellipse(g, s * 0.5, s * 0.84, s * 0.42, s * 0.1, S.foil);
    // The copy where she was (ghost), stepped afterimages, and her at the far end.
    g.globalAlpha = 0.4;
    figure(g, s * 0.2, s * 0.88, s * 0.5, s);
    g.globalAlpha = 0.65;
    figure(g, s * 0.4, s * 0.88, s * 0.54, s);
    g.globalAlpha = 1;
    figure(g, s * 0.74, s * 0.9, s * 0.74, s);
    mintCut(g, s * 0.3, s * 0.3, s * 0.62, s * 0.3, s * 0.018);
  },
  R(g, s) {
    ground(g, s);
    disc(g, s * 0.5, s * 0.34, s * 0.26, S.foil);
    disc(g, s * 0.58, s * 0.3, s * 0.24, '#0a0614');
    crescent(g, s * 0.34, s * 0.34, s * 0.26, 0.4, 0.3, s);
    ellipse(g, s * 0.5, s * 0.88, s * 0.4, s * 0.1, S.foil);
    ellipse(g, s * 0.5, s * 0.88, s * 0.3, s * 0.07, 'rgba(0,0,0,0)', S.accent, s * 0.016);
    figure(g, s * 0.5, s * 0.92, s * 0.5, s);
    mintCut(g, s * 0.44, s * 0.52, s * 0.56, s * 0.52, s * 0.014);
  },
};
