import type { HeroKit } from '../heroes';
import { paintCard, paintHand, paintProhibit, paintRunner, paintWand } from '../effects/parts/referee';

/**
 * Referee kit data: Referee Whistler (new heroes kit 14). Four spells (labels as registered), canvas-drawn icons in the kit's
 * palette: a black ground, white and pale grey, a yellow card and a red card. Signature shape: the whistle, and the round "no" sign
 * (a pictogram in a red ring with a bar).
 */
const S = {
  core: '#f2f2f2', white: '#dcdcdc', grey: '#8d8d8d', dark: '#141414', foil: '#1a1a1a', yellow: '#e6b800', red: '#d63a2a', skin: '#e2b998',
  // the Arbiter's armour, tabard, horn, sigil and crest (the _v3 model)
  armor: '#38323e', cloth: '#26212c', ivory: '#b6b09e', gold: '#d2ae55', silver: '#b8bec8', helm: '#2c2832', crest: '#8c2a32', redDeep: '#9a2a30', sigil: '#ff7a42',
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
  title: 'the Arbiter',
  accent: S.core,
  foil: S.foil,
  portrait(g, s) {
    iconGround(g, s);
    // Dark lacquered shoulders with small gold-edged pauldrons, the black and ivory tabard down the chest.
    g.fillStyle = S.armor;
    g.beginPath();
    g.moveTo(s * 0.1, s);
    g.quadraticCurveTo(s * 0.12, s * 0.72, s * 0.32, s * 0.64);
    g.lineTo(s * 0.68, s * 0.64);
    g.quadraticCurveTo(s * 0.88, s * 0.72, s * 0.9, s);
    g.closePath();
    g.fill();
    for (const dir of [-1, 1]) {
      g.fillStyle = S.gold;
      g.beginPath();
      g.ellipse(s * (0.5 + dir * 0.36), s * 0.74, s * 0.1, s * 0.055, dir * 0.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.armor;
      g.beginPath();
      g.ellipse(s * (0.5 + dir * 0.36), s * 0.735, s * 0.09, s * 0.045, dir * 0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = S.cloth;
    g.fillRect(s * 0.36, s * 0.64, s * 0.28, s * 0.36);
    g.fillStyle = S.ivory;
    for (const x of [0.4, 0.475, 0.55]) g.fillRect(s * x, s * 0.64, s * 0.05, s * 0.36);
    g.strokeStyle = S.gold;
    g.lineWidth = s * 0.008;
    g.strokeRect(s * 0.36, s * 0.64, s * 0.28, s * 0.36);
    // The silver horn on its gold chain, its bell flaring toward the shoulder.
    g.strokeStyle = S.gold;
    g.lineWidth = s * 0.006;
    g.beginPath();
    g.moveTo(s * 0.34, s * 0.62);
    g.quadraticCurveTo(s * 0.3, s * 0.8, s * 0.4, s * 0.86);
    g.stroke();
    g.fillStyle = S.silver;
    g.beginPath();
    g.moveTo(s * 0.4, s * 0.86);
    g.quadraticCurveTo(s * 0.56, s * 0.84, s * 0.66, s * 0.72);
    g.lineTo(s * 0.72, s * 0.8);
    g.quadraticCurveTo(s * 0.58, s * 0.94, s * 0.4, s * 0.9);
    g.closePath();
    g.fill();
    // A red and gold sigil tablet, the sigil glowing.
    const glow = g.createRadialGradient(s * 0.82, s * 0.9, 0, s * 0.82, s * 0.9, s * 0.14);
    glow.addColorStop(0, 'rgba(255,122,66,0.8)');
    glow.addColorStop(1, 'rgba(255,90,42,0)');
    g.fillStyle = glow;
    g.fillRect(s * 0.66, s * 0.74, s * 0.32, s * 0.26);
    g.fillStyle = S.gold;
    g.fillRect(s * 0.76, s * 0.82, s * 0.12, s * 0.18);
    g.fillStyle = S.redDeep;
    g.fillRect(s * 0.78, s * 0.84, s * 0.08, s * 0.14);
    g.fillStyle = S.sigil;
    g.beginPath();
    g.ellipse(s * 0.82, s * 0.9, s * 0.022, s * 0.034, 0, 0, Math.PI * 2);
    g.fill();
    // A big, calm square face under a black helm with a gold band and a red crest.
    g.fillStyle = S.skin;
    g.beginPath();
    g.roundRect(s * 0.36, s * 0.3, s * 0.28, s * 0.32, s * 0.07);
    g.fill();
    for (const sx of [0.44, 0.56]) {
      g.fillStyle = S.core;
      g.beginPath();
      g.ellipse(s * sx, s * 0.46, s * 0.027, s * 0.03, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = S.dark;
      g.beginPath();
      g.arc(s * sx, s * 0.465, s * 0.014, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = S.dark;
    g.lineWidth = s * 0.012;
    g.lineCap = 'round';
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * (0.5 + dir * 0.03), s * 0.415);
      g.lineTo(s * (0.5 + dir * 0.1), s * 0.41);
      g.stroke();
    }
    g.strokeStyle = '#8a4a40';
    g.lineWidth = s * 0.009;
    g.beginPath();
    g.moveTo(s * 0.46, s * 0.565);
    g.lineTo(s * 0.54, s * 0.565);
    g.stroke();
    g.fillStyle = S.helm;
    g.beginPath();
    g.moveTo(s * 0.33, s * 0.4);
    g.quadraticCurveTo(s * 0.32, s * 0.16, s * 0.5, s * 0.15);
    g.quadraticCurveTo(s * 0.68, s * 0.16, s * 0.67, s * 0.4);
    g.lineTo(s * 0.64, s * 0.36);
    g.lineTo(s * 0.36, s * 0.36);
    g.closePath();
    g.fill();
    g.fillStyle = S.gold;
    g.fillRect(s * 0.335, s * 0.335, s * 0.33, s * 0.026);
    g.fillStyle = S.crest;
    g.beginPath();
    g.moveTo(s * 0.4, s * 0.17);
    g.quadraticCurveTo(s * 0.5, s * 0.03, s * 0.62, s * 0.16);
    g.quadraticCurveTo(s * 0.52, s * 0.1, s * 0.4, s * 0.17);
    g.closePath();
    g.fill();
  },
  spells: [
    {
      key: 'Q', label: 'whistle blast', name: 'Whistle Blast', range: 8, cooldown: 3.5, aim: 'line',
      blurb: 'A ring of sound (8 m, 0.3 s wind-up): 78 damage. Sidestep it.',
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
      blurb: 'He points at a spot (9 m, 0.6 s): a yellow card to whoever he still sees there, and HANDS OFF for 3 s: hit him and you get another. Two yellows are a red: 90 damage and silenced 1.5 s.',
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
