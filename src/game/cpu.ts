import type { GameApi } from '../runtime';
import { CPU_NORMAL, cpuLevel } from '../cpuLevels';

/**
 * A fight against the CPU (the "Play vs CPU" screen): the offline AI duel at a chosen level (src/cpuLevels.ts), with
 * no server and no account needed. The result card's Rematch keeps the hero, the opponent choice and the level (a
 * random opponent is drawn again); its "Leave duel", and the Leave button during the fight, go back to the CPU
 * screen. A win at a level is reported through `onWin` (the screen marks that level as beaten).
 */
export class CpuMatch {
  active = false;
  private level = CPU_NORMAL.id;
  private leave: HTMLButtonElement;

  constructor(
    private api: GameApi,
    private ui: { onEnter(): void; onExit(): void; onWin(level: number): void },
  ) {
    // The same corner button as a network match's Forfeit (it moves under the duel bar on a phone).
    this.leave = document.createElement('button');
    this.leave.className = 'btn ghost forfeit';
    this.leave.textContent = 'Leave';
    this.leave.style.display = 'none';
    this.leave.addEventListener('click', () => {
      if (confirm('Leave this fight?')) this.exit();
    });
    document.body.appendChild(this.leave);
    api.duel.onFinish = (result) => {
      if (this.active && result === 'win') this.ui.onWin(this.level);
    };
  }

  /** Starts the fight: `hero` against `foe` (a hero name or 'random', never the same hero) at level `level` (1-5). */
  start(o: { hero: string; foe: string; level: number }) {
    const { api } = this;
    this.active = true;
    this.level = o.level;
    this.ui.onEnter();
    if (api.duel.on) api.duel.stop();
    api.setKit(o.hero);
    api.setHeroMode(true);
    api.duel.cpuLevel = cpuLevel(o.level);
    api.duel.opponentChoice = o.foe;
    api.duel.arenaChoice = 'random';
    api.duel.start('play');
    this.leave.style.display = '';
  }

  /** Ends the fight and brings the CPU screen back. */
  exit() {
    if (!this.active) return;
    this.active = false;
    this.leave.style.display = 'none';
    this.api.duel.stop();
    this.api.duel.cpuLevel = CPU_NORMAL;
    this.api.setHeroMode(false);
    this.ui.onExit();
  }
}
