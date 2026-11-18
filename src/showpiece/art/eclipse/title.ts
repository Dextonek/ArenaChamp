import { clamp, type Ctx } from '../../core';
import { SERIF } from '../paper';

/**
 * Black Sun Eclipse's title card, top left: the shared card's layout (art/paper.ts `titleCard`) in the piece's colours,
 * a violet-black band with pale-to-violet letters, a magenta first square and a pale-gold last one. Drawn on the flat
 * layer (text never goes on the glow layer).
 */

const INK = '#0e0914';

export function eclipseTitle(ctx: Ctx, k: number, dark: boolean) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // The name in kanji: bone white, outlined in ink, with a hard offset shadow.
  ctx.font = `900 74px ${SERIF}`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText('黒陽', 50, 110);
  ctx.strokeText('黒陽', 44, 104);
  ctx.fillStyle = '#f7f2e8';
  ctx.fillText('黒陽', 44, 104);
  // The name in English.
  ctx.font = `800 26px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#e4d6f2' : '#2c1d3a';
  ctx.fillText('BLACK SUN ECLIPSE', 46, 156);
  // The move's name on a violet-black brush band.
  ctx.fillStyle = '#0c0812';
  ctx.beginPath();
  ctx.moveTo(34, 176);
  ctx.lineTo(474, 172);
  ctx.lineTo(478, 186); ctx.lineTo(470, 190); ctx.lineTo(482, 240); ctx.lineTo(474, 268);
  ctx.lineTo(40, 272);
  ctx.lineTo(30, 252); ctx.lineTo(38, 236); ctx.lineTo(28, 200);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, 196, 0, 256);
  g.addColorStop(0, '#fff2fb');
  g.addColorStop(0.45, '#d77ce8');
  g.addColorStop(1, '#6a2fc4');
  ctx.font = `900 58px ${SERIF}`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#12051c';
  ctx.strokeText('蝕界・天門', 64, 245);
  ctx.fillStyle = g;
  ctx.fillText('蝕界・天門', 64, 245);
  // Four small squares after the band: magenta first, a touch of pale gold last.
  ['#e0389e', '#8c8796', '#8c8796', '#d8c27a'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(486 + i * 15, 268, 9, 9);
  });
  ctx.font = `700 17px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#9a8ca8' : '#55505a';
  ctx.fillText('SHOKKAI · THE HEAVEN GATE', 48, 306);
  ctx.restore();
}
