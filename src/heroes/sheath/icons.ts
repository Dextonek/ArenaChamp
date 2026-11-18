import type { HeroKey } from '../../heroes';
import { C } from './numbers';

/**
 * Kagen's stand-in icons and portrait (canvas), made by pipeline/tools/new-hero.py: the shape of each spell's block in
 * the hero's colours. Gate 4 draws the real ones: the VectorCraft icons (pipeline/icons/vectorcraft/draw/), which the game
 * shows once the hero is released, and a portrait drawn from the agreed model (the same colours, held thing and hair).
 */
const GLYPH: Record<HeroKey, string> = { Q: 'bolt', W: 'circle', E: 'dash', R: 'circle' };

function ground(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.42, s * 0.05, s * 0.5, s * 0.5, s * 0.8);
  r.addColorStop(0, '#2a2420');
  r.addColorStop(1, C.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

function glyph(g: CanvasRenderingContext2D, s: number, kind: string) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = C.accent;
  g.fillStyle = C.accent;
  g.lineWidth = s * 0.07;
  const c = s / 2;
  g.beginPath();
  if (kind === 'bolt') {
    g.moveTo(s * 0.2, s * 0.8);
    g.lineTo(s * 0.62, s * 0.38);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.7, s * 0.3, s * 0.12, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'circle' || kind === 'nova') {
    g.ellipse(c, c * 1.1, s * 0.34, s * 0.22, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(c, c * 1.1, s * 0.07, 0, Math.PI * 2);
    g.fillStyle = C.foil;
    g.fill();
  } else if (kind === 'cone') {
    g.moveTo(s * 0.2, s * 0.78);
    g.lineTo(s * 0.86, s * 0.3);
    g.lineTo(s * 0.86, s * 0.78);
    g.closePath();
    g.globalAlpha = 0.85;
    g.fill();
  } else if (kind === 'target') {
    g.arc(c, c, s * 0.28, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(c, s * 0.12); g.lineTo(c, s * 0.34);
    g.moveTo(c, s * 0.66); g.lineTo(c, s * 0.88);
    g.moveTo(s * 0.12, c); g.lineTo(s * 0.34, c);
    g.moveTo(s * 0.66, c); g.lineTo(s * 0.88, c);
    g.stroke();
  } else {
    g.moveTo(s * 0.16, s * 0.62);
    g.lineTo(s * 0.7, s * 0.62);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.62, s * 0.44);
    g.lineTo(s * 0.86, s * 0.62);
    g.lineTo(s * 0.62, s * 0.8);
    g.closePath();
    g.fill();
  }
  g.restore();
}

const icon = (k: HeroKey) => (g: CanvasRenderingContext2D, s: number) => {
  ground(g, s);
  glyph(g, s, GLYPH[k]);
};

export const icons: Record<HeroKey, (g: CanvasRenderingContext2D, size: number) => void> = {
  Q: icon('Q'), W: icon('W'), E: icon('E'), R: icon('R'),
};

/** A stand-in portrait: a head and shoulders in the accent, the foil behind. */
export function portrait(g: CanvasRenderingContext2D, s: number) {
  ground(g, s);
  g.fillStyle = C.foil;
  g.globalAlpha = 0.25;
  g.beginPath();
  g.arc(s / 2, s * 0.45, s * 0.4, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = C.accent;
  g.beginPath();
  g.arc(s / 2, s * 0.4, s * 0.17, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(s / 2, s * 0.95, s * 0.34, s * 0.32, 0, Math.PI, 0);
  g.fill();
}
