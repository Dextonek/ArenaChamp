import { clamp, type Ctx } from '../../core';
import { SERIF } from '../paper';

/**
 * Jade Serpent's title card, top left: the shared card's layout (art/paper.ts `titleCard`) in the piece's colours, a
 * green-black band with mint-to-jade letters and a jade first square (the shared card's red square clashes here).
 */

const INK = '#0c1510';

export function jadeTitle(ctx: Ctx, k: number, dark: boolean) {
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
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText('翠蛇', 50, 110);
  ctx.strokeText('翠蛇', 44, 104);
  ctx.fillStyle = '#f8fbf3';
  ctx.fillText('翠蛇', 44, 104);
  // The name in English.
  ctx.font = `800 26px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#cfe8d8' : '#1d3326';
  ctx.fillText('JADE SERPENT', 46, 156);
  // The move's name on a green-black brush band.
  ctx.fillStyle = '#0a130e';
  ctx.beginPath();
  ctx.moveTo(34, 176);
  ctx.lineTo(474, 172);
  ctx.lineTo(478, 186); ctx.lineTo(470, 190); ctx.lineTo(482, 240); ctx.lineTo(474, 268);
  ctx.lineTo(40, 272);
  ctx.lineTo(30, 252); ctx.lineTo(38, 236); ctx.lineTo(28, 200);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, 196, 0, 256);
  g.addColorStop(0, '#e4ffef');
  g.addColorStop(0.45, '#62d79c');
  g.addColorStop(1, '#1d7a4c');
  ctx.font = `900 58px ${SERIF}`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#03180d';
  ctx.strokeText('風刃・竹斬', 64, 245);
  ctx.fillStyle = g;
  ctx.fillText('風刃・竹斬', 64, 245);
  // Four small squares after the band, the first jade, the last a touch of gold.
  ['#3fbf7f', '#8a9089', '#8a9089', '#c9a24a'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(486 + i * 15, 268, 9, 9);
  });
  ctx.font = `700 17px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#8fa596' : '#4c5a50';
  ctx.fillText('FUJIN · THE BAMBOO CUT', 48, 306);
  ctx.restore();
}
