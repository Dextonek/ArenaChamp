import type { GameApi } from '../runtime';
import { CPU_BALANCE, CPU_NORMAL, cpuLevel } from '../cpuLevels';
import { nextPaint, sleep, type LoadingScreen } from './loading';

/** The loading page stays up at least this long, so it can be read and never just flickers. */
const LOADING_MIN = 900;

/**
 * A fight against the CPU (the "Play vs CPU" screen): the offline AI duel at a chosen level (src/cpuLevels.ts), with
 * no server and no account needed. The loading page shows while the arena and the figures load, then the 3-2-1, then
 * the fight. The result card's Rematch keeps the hero, the opponent choice and the level (a random opponent is drawn
 * again); its "Leave duel", and the Leave button during the fight, go back to the CPU screen. A win at a level is
 * reported through `onWin` (the screen marks that level as beaten).
 */
export class CpuMatch {
  active = false;
  private level = CPU_NORMAL.id;
  private leave: HTMLButtonElement;
  private last: { hero: string; foe: string; level: number } | null = null;
  /** Each start gets a number: a start the player already left does not go on after its waits. */
  private run = 0;

  constructor(
    private api: GameApi,
    private loading: LoadingScreen,
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
    // A rematch goes through the same loading page and countdown.
    api.duel.onRematch = () => {
      if (this.active && this.last) void this.start(this.last);
      else api.duel.start();
    };
  }

  /** Starts the fight: `hero` against `foe` (a hero name or 'random', never the same hero) at level `level` (1-5). */
  async start(o: { hero: string; foe: string; level: number }) {
    const { api } = this;
    const run = ++this.run;
    this.active = true;
    this.level = o.level;
    this.last = o;
    this.ui.onEnter();
    // The opponent is drawn here, so the loading page can show it.
    const others = api.kits.filter((k) => k.name !== o.hero);
    const foe = others.find((k) => k.name === o.foe) ?? others[Math.floor(Math.random() * others.length)];
    this.loading.show({ mine: api.kits.find((k) => k.name === o.hero), theirs: foe, title: 'Entering the arena', line: 'Loading the arena' });
    // The page must be on screen before the arena is built, which holds the browser up for a moment.
    await nextPaint();
    if (run !== this.run) return;
    if (api.duel.on) api.duel.stop();
    api.setKit(o.hero);
    api.setHeroMode(true);
    api.duel.cpuLevel = cpuLevel(o.level);
    api.duel.opponentChoice = foe.name;
    api.duel.arenaChoice = 'random';
    api.duel.holdStart = true;
    api.duel.start('play');
    this.leave.style.display = '';
    this.loading.setArena(api.duel.currentArena?.name ?? 'The arena');
    this.loading.setLine('Loading the heroes');
    await Promise.all([api.duel.whenReady(), sleep(LOADING_MIN)]);
    if (run !== this.run) return;
    this.loading.hide();
    api.duel.countdownFrom(3);
  }

  /** Ends the fight and brings the CPU screen back. */
  exit() {
    if (!this.active) return;
    this.active = false;
    this.run++;
    this.loading.hide();
    this.leave.style.display = 'none';
    this.api.duel.stop();
    this.api.duel.holdStart = false;
    this.api.duel.cpuLevel = CPU_BALANCE;
    this.api.setHeroMode(false);
    this.ui.onExit();
  }
}
