import { clamp, type Ctx } from '../../core';
import { SERIF } from '../paper';

/**
 * Sakura Requiem's title card, top left: the shared card's layout (art/paper.ts `titleCard`) in the piece's colours, a
 * plum-black band with white-to-cherry letters and a pink first square.
 */

const INK = '#1c0a15';

export function sakuraTitle(ctx: Ctx, k: number) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // The name in kanji: white, outlined in ink, with a hard offset shadow.
  ctx.font = `900 74px ${SERIF}`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 12;
  ctx.fillStyle = 'rgba(40,0,20,0.35)';
  ctx.fillText('桜花', 50, 110);
  ctx.strokeText('桜花', 44, 104);
  ctx.fillStyle = '#fff6f9';
  ctx.fillText('桜花', 44, 104);
  // The name in English.
  ctx.font = `800 26px "Consolas","Menlo",monospace`;
  ctx.fillStyle = '#4a1834';
  ctx.fillText('SAKURA REQUIEM', 46, 156);
  // The move's name on a plum-black brush band.
  ctx.fillStyle = '#16070f';
  ctx.beginPath();
  ctx.moveTo(34, 176);
  ctx.lineTo(474, 172);
  ctx.lineTo(478, 186); ctx.lineTo(470, 190); ctx.lineTo(482, 240); ctx.lineTo(474, 268);
  ctx.lineTo(40, 272);
  ctx.lineTo(30, 252); ctx.lineTo(38, 236); ctx.lineTo(28, 200);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, 196, 0, 256);
  g.addColorStop(0, '#fff3f8');
  g.addColorStop(0.45, '#ff9cc2');
  g.addColorStop(1, '#d9406f');
  ctx.font = `900 58px ${SERIF}`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#2a0618';
  ctx.strokeText('散華・千刃', 64, 245);
  ctx.fillStyle = g;
  ctx.fillText('散華・千刃', 64, 245);
  // Four small squares after the band, the first cherry, the last plum.
  ['#ef7aa5', '#8f8890', '#8f8890', '#6a2148'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(486 + i * 15, 268, 9, 9);
  });
  ctx.font = `700 17px "Consolas","Menlo",monospace`;
  ctx.fillStyle = '#5a4c55';
  ctx.fillText('SANGE · A THOUSAND PETAL BLADES', 48, 306);
  ctx.restore();
}
