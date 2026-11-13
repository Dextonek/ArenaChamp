import type { GameApi } from '../../../runtime';
import { PieceRun, bossFight, crownFight } from './core';
import { startGate, startRival, startTrial } from './duels';
import { piecesOf } from './floors';
import { buildRuler } from './ruler';
import type { PieceHandle, PieceIn, PieceKind, PieceOut } from './types';

export type { PieceHandle, PieceIn, PieceKind, PieceOut, PieceReport, PiecesDef, RulerDef } from './types';
export { PIECES, piecesOf } from './floors';

/**
 * Starts one of a floor's four set pieces (pipeline/designs/tower-worlds-pieces.md): the fight the zone enters through a door. `done`
 * is called once with the outcome. The piece sets the hero, its boons and its health, and puts back what it changed before `done`;
 * it stops the duel, so the zone starts its own fight again.
 *
 * Returns a handle the contract does not ask for: in the autopilot's run (`mode: 'run'`) `pump()` between two steps of the simulation
 * reports a finished fight at once (as the weekly Tower's landing is pumped); without it the outcome comes as a microtask, when the code that
 * steps the simulation yields. `cancel()` ends the piece with no outcome.
 */
export function startPiece(api: GameApi, kind: PieceKind, input: PieceIn, done: (out: PieceOut) => void): PieceHandle {
  // A floor without set pieces of its own (one not built) plays those of the highest floor below it that has them.
  let floor = Math.max(1, Math.round(input.floor));
  while (floor > 1 && !piecesOf(floor)) floor--;
  const def = piecesOf(floor)!;
  // The seeds follow the number the pieces were tuned at (a handmade floor that moved up keeps its old fights); the titles say the floor.
  const seedN = def.tunedAs ?? floor;
  const titles: Record<PieceKind, string> = { ruler: def.ruler.name, gate: `The gate of floor ${floor}`, trial: `Trial of floor ${floor}`, rival: def.rival ? `Rival: ${def.rival.hero}` : 'Rival' };
  const run = new PieceRun(api, { ...input, floor }, titles[kind], done);
  switch (kind) {
    case 'ruler': {
      if (def.crown) {
        crownFight(run, def.crown, `world-crown-${floor}`, def.crownTier ?? 1);
        run.hud?.say(def.ruler.name, def.ruler.line, 3);
        break;
      }
      const ruler = buildRuler(api, def.ruler, { hard: def.hard, boons: input.boons, ally: input.ally, run });
      bossFight(run, { def: ruler.def, link: ruler.link, seed: `world-ruler-${seedN}`, tier: 1, boons: input.boons });
      ruler.begin();
      run.hud?.say(def.ruler.name, def.ruler.line, 3);
      void api.duel.whenReady().then(() => { if (!run.over) ruler.ready(); });
      break;
    }
    case 'gate':
      startGate(run, def.gate, floor);
      break;
    case 'trial':
      startTrial(run, def.trial, floor, seedN);
      break;
    case 'rival':
      if (!def.rival) throw new Error(`floor ${floor} has no rival duel: the zone runs its race`);
      startRival(run, def.rival, floor, seedN);
      break;
  }
  return run;
}
