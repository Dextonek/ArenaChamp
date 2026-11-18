import { clamp, type Ctx } from '../../core';
import { SERIF } from '../paper';

/**
 * Raijin's title card, top left: the shared card's layout (art/paper.ts `titleCard`) in the thunder's colours, an
 * indigo-black band with gold-to-violet letters and a gold first square.
 */

const INK = '#120e24';

export function raijinTitle(ctx: Ctx, k: number, dark: boolean) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 74px ${SERIF}`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText('雷鼓', 50, 110);
  ctx.strokeText('雷鼓', 44, 104);
  ctx.fillStyle = '#fbf7ef';
  ctx.fillText('雷鼓', 44, 104);
  ctx.font = `800 26px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#d8d0f4' : '#1f1a46';
  ctx.fillText('RAIJIN’S VERDICT', 46, 156);
  ctx.fillStyle = '#0c0a1c';
  ctx.beginPath();
  ctx.moveTo(34, 176);
  ctx.lineTo(474, 172);
  ctx.lineTo(478, 186); ctx.lineTo(470, 190); ctx.lineTo(482, 240); ctx.lineTo(474, 268);
  ctx.lineTo(40, 272);
  ctx.lineTo(30, 252); ctx.lineTo(38, 236); ctx.lineTo(28, 200);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, 196, 0, 256);
  g.addColorStop(0, '#fff4c0');
  g.addColorStop(0.45, '#ffc23a');
  g.addColorStop(1, '#9a62ff');
  ctx.font = `900 58px ${SERIF}`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1a0f3a';
  ctx.strokeText('天罰・万雷', 64, 245);
  ctx.fillStyle = g;
  ctx.fillText('天罰・万雷', 64, 245);
  ['#e8b030', '#8c8a92', '#8c8a92', '#8c8a92'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(486 + i * 15, 268, 9, 9);
  });
  ctx.font = `700 17px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#948cb8' : '#4f4a66';
  ctx.fillText('TENBATSU · TEN THOUSAND THUNDERS', 48, 306);
  ctx.restore();
}
