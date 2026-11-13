import type { GameApi } from '../../runtime';
import { startPiece } from './pieces';
import type { PieceHandle, PieceIn, PieceKind, PieceOut } from './pieces/types';

/**
 * The contract between the floor's zone (`game.ts`) and the set pieces behind its doors (`pieces/`): the zone calls the starter when the
 * hero walks into a door; the starter takes the duel over, plays the piece, and calls `done` with how it went; the zone is then rebuilt
 * from the run. One set of types: those of `pieces/types.ts`, re-exported here as the zone's side of it. The starter returns the piece's
 * handle so the route bot can `pump` it between two steps (a person's play ignores it).
 */
export type { PieceHandle, PieceIn, PieceKind, PieceOut };
export type PieceStarter = (api: GameApi, kind: PieceKind, input: PieceIn, done: (out: PieceOut) => void) => PieceHandle | void;

/**
 * The stub that stood in before the pieces were merged. It is kept for the tools (`setPieceStarter(stubStarter)` makes a door a one-second
 * win with the same health, counted by `WorldGame.tick`): the default is the real `startPiece`.
 */
export const STUB_SECONDS = 1;
export const stubStarter: PieceStarter = (_api, _kind, input, done) => {
  stubWaits.push({ left: STUB_SECONDS, done: () => done({ won: true, hp: input.hp, seconds: STUB_SECONDS }) });
};
/** What the stub waits on: `WorldGame.tick` counts these down. */
export const stubWaits: { left: number; done(): void }[] = [];

let starter: PieceStarter = startPiece;
export function setPieceStarter(fn: PieceStarter) {
  starter = fn;
}
export const pieceStarter = () => starter;
