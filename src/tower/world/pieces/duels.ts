import { CPU_BALANCE, cpuLevel } from '../../../cpuLevels';
import { setSunlit } from '../../hooks';
import { buildFloor } from '../../floors';
import { KIND_NAME, type FloorPlan } from '../../week';
import { bossFight, type PieceRun } from './core';
import type { GateDef, RivalDef, TrialDef } from './types';

/**
 * The three set pieces that are not the ruler's: the gatekeeper's duel (a real CPU duel, `Duel.start`), one room of the weekly Tower
 * (`buildFloor`, by kind), and the rival's duel (the weekly Tower's Duel kind: an echo with a boss's moves, where boons act).
 */

/** What the gate says as the duel begins. */
export const GATE_RULE = 'At the gate your boons are set aside: the gatekeeper tests you alone';

/** The gatekeeper's duel: one round, the hero's real spells on both sides, in the floor's arena under its twist. */
export function startGate(run: PieceRun, g: GateDef, floor: number) {
  const { api, input } = run;
  const d = api.duel;
  if (d.on) d.stop();
  api.setKit(input.hero);
  api.setHeroMode(true);
  // A hero never meets itself: Marin at Marin's own gate meets the first other hero.
  const foe = api.kits.find((k) => k.name === g.hero && k.name !== input.hero) ?? api.kits.find((k) => k.name !== input.hero)!;
  const was = { level: d.cpuLevel, hazards: d.hazardsOn, hazardsRuns: d.hazardsInRuns, shifts: d.shiftsOn, shiftsRuns: d.shiftsInRuns, hold: d.holdStart, choice: d.opponentChoice, arena: d.arenaChoice };
  run.onEnd(() => {
    d.cpuLevel = was.level;
    d.hazardsOn = was.hazards;
    d.hazardsInRuns = was.hazardsRuns;
    d.shiftsOn = was.shifts;
    d.shiftsInRuns = was.shiftsRuns;
    d.holdStart = was.hold;
    d.opponentChoice = was.choice;
    d.arenaChoice = was.arena;
  });
  d.cpuLevel = cpuLevel(g.level) ?? CPU_BALANCE;
  d.opponentChoice = foe.name;
  d.arenaChoice = g.arena;
  // The ring's twist is the arena's own shift or hazard, in a run too.
  const shift = g.twist.kind === 'shift';
  d.shiftsOn = d.shiftsInRuns = shift;
  d.hazardsOn = d.hazardsInRuns = !shift;
  d.holdStart = input.mode === 'play';
  d.start(input.mode);
  // TOWER-HOOK: the arena's shift runs on the fight clock (stage one at 35 s); `Duel.shiftOffset` is public and was made for tests. It
  // sets the tide `early` seconds ahead. (A hazard starts its first event at 8 s by itself.) The duel should take a twist to begin with.
  if (shift) d.shiftOffset = g.twist.early ?? 0;
  // The rule of the gate: the boons are set aside. `Duel.start` takes no upgrades (stage 0, question 4), so nothing of the climb's is
  // applied: not the walk, not the damage, not the health. That is the rule, said on the screen, and not a cheat round it.
  run.note(`gate: ${foe.name} at level ${d.cpuLevel.name} in ${d.currentArena?.name ?? g.arena}, ${g.twist.name}; boons set aside`);
  run.hud?.setGoal(`Gate: beat ${foe.name} · ${g.twist.name}`);
  run.hud?.say(GATE_RULE, `${foe.name} · ${g.twist.name}`, 4);
  run.watch((result) => ({ won: result === 'win', hp: input.hp, seconds: d.result?.seconds ?? 0 }));
  if (input.mode === 'play') {
    void d.whenReady().then(() => {
      if (!run.over) d.countdownFrom(3);
    });
  }
  void floor;
}

/** Plans are built as the weekly Tower builds them, at a height that fits the floor (about two weekly floors a floor). */
function planOf(n: number, kind: FloorPlan['kind'], seed: string, more: Partial<FloorPlan> = {}): FloorPlan {
  return { n, kind, seed, ...more };
}

/** A floor of the weekly Tower, entered with the hero's health and boons, and left with the outcome: no landing, no climb. */
function weekly(run: PieceRun, plan: FloorPlan, title: string) {
  const { api, input } = run;
  const was = input.boons.twist;
  input.boons.twist = plan.twist;
  run.onEnd(() => { input.boons.twist = was; });
  const floor = buildFloor(plan, { api, boons: input.boons, hero: input.hero, goal: (text) => run.hud?.setGoal(text) });
  bossFight(run, { def: floor.def, link: floor.link, seed: plan.seed, tier: floor.tier, boons: input.boons });
  setSunlit(api, input.boons);
  floor.begin();
  run.hud?.setDark(plan.twist === 'dark');
  run.hud?.say(title, `${KIND_NAME[plan.kind]}${plan.twist === 'dark' ? ' · Lightless: dark beyond a few steps' : ''}`, 2.6);
  run.note(`${KIND_NAME[plan.kind]} at the weekly Tower's floor ${plan.n}`);
}

/** The trial room: one room of the weekly Tower by kind. `seedN` is the number its seed is made from (`PiecesDef.tunedAs`, else the floor). */
export function startTrial(run: PieceRun, t: TrialDef, floor: number, seedN = floor) {
  weekly(run, planOf(t.height, t.kind, `world-trial-${seedN}`, t.twist ? { twist: t.twist } : {}), `Trial of floor ${floor}`);
}

/** The rival's duel: the echo of the rival's hero with its twist, where boons act. `seedN` as for the trial. */
export function startRival(run: PieceRun, r: RivalDef, floor: number, seedN = floor) {
  weekly(run, planOf(r.height ?? 2 * seedN, 'duel', `world-rival-${seedN}`, { foe: r.hero, duel: r.twist }), r.line);
}
