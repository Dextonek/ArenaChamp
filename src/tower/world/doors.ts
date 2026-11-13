import type { GameApi } from '../../runtime';
import type { TowerBoons } from '../boons';

/**
 * The contract between the floor's zone (stage 1A: `game.ts`) and the set pieces behind its doors (stage 1B: the ruler's fight, the
 * gatekeeper's duel, the trial room, the rival's duel). The zone calls the starter when the hero walks into a door; the starter
 * takes the duel over, plays the piece, and calls `done` with how it went. The zone is then rebuilt from the run.
 */
export type PieceKind = 'ruler' | 'gate' | 'trial' | 'rival';
export interface PieceIn {
  floor: number;
  hero: string;
  /** health as a share 0..1 */
  hp: number;
  boons: TowerBoons;
  /** the rival's hero name, if it was beaten and fights beside you */
  ally?: string;
  mode: 'play' | 'run';
}
export interface PieceOut {
  won: boolean;
  /** health left as a share 0..1 */
  hp: number;
  seconds: number;
}
export type PieceStarter = (api: GameApi, kind: PieceKind, input: PieceIn, done: (out: PieceOut) => void) => void;

/**
 * The stub that stands in until stage 1B is merged: it does not touch the duel and reports a win with the same health after one
 * simulated second. "Simulated": the zone's own clock counts it (`WorldGame.tick`), as `TowerRun.pump` counts what waits, so a
 * route bot that steps time itself gets the same answer as a person. The zone has been torn down before a starter is called, so
 * the stub still walks the route a real piece takes: leave, play, come back through `enterZone`.
 */
export const STUB_SECONDS = 1;
export const stubStarter: PieceStarter = (_api, _kind, input, done) => {
  stubWaits.push({ left: STUB_SECONDS, done: () => done({ won: true, hp: input.hp, seconds: STUB_SECONDS }) });
};
/** What the stub waits on: `WorldGame.tick` counts these down. */
export const stubWaits: { left: number; done(): void }[] = [];

let starter: PieceStarter = stubStarter;
export function setPieceStarter(fn: PieceStarter) {
  starter = fn;
}
export const pieceStarter = () => starter;
