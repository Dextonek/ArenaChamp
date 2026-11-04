import type { HeroKit } from '../heroes';
import { paintCard, paintHand, paintProhibit, paintRunner, paintWand } from '../effects/parts/referee';

/**
 * Referee kit data: Referee Whistler (new heroes kit 14). Four spells (labels as registered), canvas-drawn icons in the kit's
 * palette: a black ground, white and pale grey, a yellow card and a red card. Signature shape: the whistle, and the round "no" sign
 * (a pictogram in a red ring with a bar).
 */
const S = {
  core: '#f2f2f2', white: '#dcdcdc', grey: '#8d8d8d', dark: '#141414', foil: '#1a1a1a', yellow: '#e6b800', red: '#d63a2a', skin: '#e2b998',
};

function iconGround(g: CanvasRenderingContext2D, s: number) {
  const r = g.createRadialGradient(s * 0.5, s * 0.4, s * 0.05, s * 0.5, s * 0.5, s * 0.78);
  r.addColorStop(0, '#3a3a3a');
  r.addColorStop(1, S.dark);
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
}

/** The whistle in profile: a round chamber, a barrel, a mouthpiece, a ring for the cord. Centred at (cx, cy), `r` the chamber's radius. */
function whistle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot = 0) {
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.fillStyle = S.dark;
  g.beginPath();
  g.arc(r * 0.2, 0, r * 1.14, 0, Math.PI * 2);
  g.fill();
  g.fillRect(-r * 2.1, -r * 0.46, r * 2.2, r * 0.82);
  g.fillStyle = S.white;
  g.beginPath();
  g.arc(r * 0.2, 0, r, 0, Math.PI * 2);
  g.fill();
  g.fillRect(-r * 2.0, -r * 0.36, r * 2.1, r * 0.62);
  g.fillStyle = S.grey;
  g.fillRect(-r * 2.0, -r * 0.36, r * 1.0, r * 0.2);
  g.fillStyle = S.dark;
  g.beginPath();
  g.arc(r * 0.2, 0, r * 0.4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = S.core;
  g.lineWidth = r * 0.12;
  g.beginPath();
  g.arc(r * 0.2, 0, r * 0.7, Math.PI * 1.1, Math.PI * 1.5);
  g.stroke();
  g.strokeStyle = S.grey;
  g.lineWidth = r * 0.16;
  g.beginPath();
  g.arc(r * 1.45, 0, r * 0.3, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

/** Arcs of sound opening to the right from (x, y). */
function sound(g: CanvasRenderingContext2D, x: number, y: number, r: number, n = 3) {
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const rr = r * (0.7 + i * 0.55);
    g.strokeStyle = i % 2 ? S.white : S.core;
    g.lineWidth = r * 0.17;
    g.globalAlpha = 1 - i * 0.2;
    g.beginPath();
    g.arc(x, y, rr, -0.7, 0.7);
    g.stroke();
  }
  g.globalAlpha = 1;
}

export const refereeKit: HeroKit = {
  name: 'Referee Whistler',
  maxHp: 620,
  title: 'by the book',
  accent: S.core,
  foil: S.foil,
  portrait(g, s) {
    iconGround(g, s);
    // A stern little man in a striped shirt: shoulders with black and white stripes, a collar, a whistle on a cord.
    g.fillStyle = S.white;
    g.beginPath();
    g.moveTo(s * 0.1, s);
    g.quadraticCurveTo(s * 0.14, s * 0.72, s * 0.34, s * 0.62);
    g.quadraticCurveTo(s * 0.5, s * 0.57, s * 0.66, s * 0.62);
    g.quadraticCurveTo(s * 0.86, s * 0.72, s * 0.9, s);
    g.closePath();
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = S.foil;
    for (let i = 0; i < 7; i++) g.fillRect(s * (0.05 + i * 0.135), s * 0.5, s * 0.07, s * 0.6);
    g.restore();
    g.fillStyle = S.foil;
    g.beginPath();
    g.moveTo(s * 0.4, s * 0.64);
    g.lineTo(s * 0.5, s * 0.74);
    g.lineTo(s * 0.6, s * 0.64);
    g.lineTo(s * 0.57, s * 0.6);
    g.lineTo(s * 0.5, s * 0.67);
    g.lineTo(s * 0.43, s * 0.6);
    g.closePath();
    g.fill();
    // The cord, the whistle on his chest.
    g.strokeStyle = S.red;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(s * 0.42, s * 0.62);
    g.quadraticCurveTo(s * 0.46, s * 0.8, s * 0.52, s * 0.82);
    g.stroke();
    whistle(g, s * 0.54, s * 0.83, s * 0.04, 0.3);
    // A square, serious head: pale face, a dark cap of hair, a heavy straight brow, a tight mouth.
    g.fillStyle = S.skin;
    g.beginPath();
    g.roundRect(s * 0.38, s * 0.26, s * 0.24, s * 0.34, s * 0.06);
    g.fill();
    g.fillStyle = S.foil;
    g.beginPath();
    g.moveTo(s * 0.36, s * 0.4);
    g.quadraticCurveTo(s * 0.34, s * 0.2, s * 0.5, s * 0.2);
    g.quadraticCurveTo(s * 0.66, s * 0.2, s * 0.64, s * 0.4);
    g.lineTo(s * 0.62, s * 0.32);
    g.lineTo(s * 0.38, s * 0.32);
    g.closePath();
    g.fill();
    g.fillStyle = S.dark;
    g.fillRect(s * 0.4, s * 0.385, s * 0.08, s * 0.016);
    g.fillRect(s * 0.52, s * 0.385, s * 0.08, s * 0.016);
    g.fillStyle = S.foil;
    g.fillRect(s * 0.425, s * 0.415, s * 0.03, s * 0.02);
    g.fillRect(s * 0.545, s * 0.415, s * 0.03, s * 0.02);
    // The whistle between his lips.
    whistle(g, s * 0.5, s * 0.52, s * 0.035, 0);
    // A raised hand with a yellow card.
    paintCard(g, s * 0.82, s * 0.4, s * 0.17, S.yellow, 0.2);
    g.fillStyle = S.skin;
    g.beginPath();
    g.arc(s * 0.8, s * 0.55, s * 0.05, 0, Math.PI * 2);
    g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'whistle blast', name: 'Whistle Blast', range: 8, cooldown: 3.5, aim: 'line',
      blurb: 'A ring of sound (8 m, 0.3 s wind-up): 50 damage. Sidestep it.',
      icon(g, s) {
        iconGround(g, s);
        whistle(g, s * 0.3, s * 0.52, s * 0.15, -0.1);
        sound(g, s * 0.46, s * 0.52, s * 0.15, 3);
      },
    },
    {
      key: 'W', label: 'no running', name: 'No Running', range: 7, cooldown: 9,
      blurb: 'A rule for the enemy in sight within 7 m: no dashes, blinks or leaps for 3 s. Break it and you get a yellow card.',
      icon(g, s) {
        iconGround(g, s);
        paintProhibit(g, s * 0.5, s * 0.5, s * 0.42, paintRunner);
      },
    },
    {
      key: 'E', label: 'no casting', name: 'No Casting', range: 7, cooldown: 13,
      blurb: 'A rule for the enemy in sight within 7 m: no spells, only basic attacks, for 2 s. Cast anyway and the spell goes off, with a yellow card.',
      icon(g, s) {
        iconGround(g, s);
        paintProhibit(g, s * 0.5, s * 0.5, s * 0.42, paintWand);
      },
    },
    {
      key: 'R', label: 'show the card', name: 'Show the Card', range: 9, cooldown: 24,
      blurb: 'He points at a spot (9 m, 0.6 s): a yellow card to whoever he still sees there, and HANDS OFF for 3 s: hit him and you get another. Two yellows are a red: 60 damage and silenced 1.5 s.',
      icon(g, s) {
        iconGround(g, s);
        // A yellow card thrown at a ring, with an open hand's "stop" behind it.
        g.globalAlpha = 0.5;
        paintHand(g, s * 0.3, s * 0.62, s * 0.34);
        g.globalAlpha = 1;
        g.strokeStyle = S.core;
        g.lineWidth = s * 0.018;
        g.setLineDash([s * 0.04, s * 0.04]);
        g.beginPath();
        g.ellipse(s * 0.66, s * 0.74, s * 0.26, s * 0.1, 0, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        paintCard(g, s * 0.6, s * 0.42, s * 0.34, S.yellow, 0.35);
        sound(g, s * 0.2, s * 0.2, s * 0.08, 2);
      },
    },
  ],
};
