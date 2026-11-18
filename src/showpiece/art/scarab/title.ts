import { clamp, type Ctx } from '../../core';
import { SERIF } from '../paper';

/**
 * Sun Scarab's title card, top left: the shared card's layout (art/paper.ts `titleCard`) in the piece's colours, a
 * lapis-black band with gold letters, a turquoise first square and a gold last one. Drawn on the flat layer (text never
 * goes on the glow layer).
 */

const INK = '#1d1209';

export function scarabTitle(ctx: Ctx, k: number, dark: boolean) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // The name in kanji: papyrus white, outlined in ink, with a hard offset shadow.
  ctx.font = `900 74px ${SERIF}`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 12;
  ctx.fillStyle = 'rgba(40,20,0,0.35)';
  ctx.fillText('聖甲', 50, 110);
  ctx.strokeText('聖甲', 44, 104);
  ctx.fillStyle = '#fbf3df';
  ctx.fillText('聖甲', 44, 104);
  // The name in English.
  ctx.font = `800 26px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#e8dcc0' : '#3a2410';
  ctx.fillText('SUN SCARAB', 46, 156);
  // The move's name on a lapis-black brush band.
  ctx.fillStyle = '#0a1030';
  ctx.beginPath();
  ctx.moveTo(34, 176);
  ctx.lineTo(474, 172);
  ctx.lineTo(478, 186); ctx.lineTo(470, 190); ctx.lineTo(482, 240); ctx.lineTo(474, 268);
  ctx.lineTo(40, 272);
  ctx.lineTo(30, 252); ctx.lineTo(38, 236); ctx.lineTo(28, 200);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, 196, 0, 256);
  g.addColorStop(0, '#fff5d0');
  g.addColorStop(0.45, '#f5c142');
  g.addColorStop(1, '#c4620e');
  ctx.font = `900 58px ${SERIF}`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1a0c02';
  ctx.strokeText('日輪・転生', 64, 245);
  ctx.fillStyle = g;
  ctx.fillText('日輪・転生', 64, 245);
  // Four small squares after the band: turquoise first, gold last.
  ['#2fbfae', '#8f8676', '#8f8676', '#e8b032'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(486 + i * 15, 268, 9, 9);
  });
  ctx.font = `700 17px "Consolas","Menlo",monospace`;
  ctx.fillStyle = dark ? '#a99c86' : '#5a4c38';
  ctx.fillText('NICHIRIN · THE ROLLING SUN', 48, 306);
  ctx.restore();
}

/** Wipes the glow layer away under the title, so nothing glows through it. */
export function clearTitleGlow(ctx: Ctx, k: number) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(240, 150, 120, 240, 150, 560);
  g.addColorStop(0, `rgba(0,0,0,${k})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 820, 720);
  ctx.restore();
}
