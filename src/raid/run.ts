import type { GameApi } from '../runtime';
import { nextPaint, sleep, type LoadingScreen } from '../game/loading';
import { LocalLink } from './link';
import { BOSSES } from './sunWarden';

/** The loading page stays up at least this long, so it can be read and never just flickers. */
const LOADING_MIN = 900;

/**
 * A raid on this screen (the Raid screen's Start): the hero against a boss, offline, with no account needed. Shaped like
 * `CpuMatch`: the loading page while the arena and the figures load, then the 3-2-1, then the fight. The result card's
 * button tries again; its "Leave", and the Leave button during the fight, go back to the Raid screen.
 */
export class RaidRun {
  active = false;
  private leave: HTMLButtonElement;
  private last: { hero: string; boss: string } | null = null;
  /** Each start gets a number: a start the player already left does not go on after its waits. */
  private run = 0;

  constructor(
    private api: GameApi,
    private loading: LoadingScreen,
    private ui: { onEnter(): void; onExit(): void },
  ) {
    this.leave = document.createElement('button');
    this.leave.className = 'btn ghost forfeit';
    this.leave.textContent = 'Leave';
    this.leave.style.display = 'none';
    this.leave.addEventListener('click', () => {
      if (confirm('Leave this fight?')) this.exit();
    });
    document.body.appendChild(this.leave);
    const before = api.duel.onRematch;
    api.duel.onRematch = () => {
      if (this.active && this.last) void this.start(this.last);
      else before?.();
    };
  }

  async start(o: { hero: string; boss: string }) {
    const { api } = this;
    const def = BOSSES[o.boss];
    if (!def) return;
    const run = ++this.run;
    this.active = true;
    this.last = o;
    this.ui.onEnter();
    const link = new LocalLink(def);
    this.loading.show({ mine: api.kits.find((k) => k.name === o.hero), theirs: def.kit(link.maxHp), title: def.name, line: 'Loading the arena' });
    await nextPaint();
    if (run !== this.run) return;
    if (api.duel.on) api.duel.stop();
    api.setKit(o.hero);
    api.setHeroMode(true);
    api.duel.holdStart = true;
    api.duel.startBoss({ def, link, seed: String(Math.random()), mode: 'play' });
    this.leave.style.display = '';
    this.loading.setLine('Loading the heroes');
    await Promise.all([api.duel.whenReady(), sleep(LOADING_MIN)]);
    if (run !== this.run) return;
    this.loading.hide();
    api.duel.countdownFrom(3);
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.run++;
    this.loading.hide();
    this.leave.style.display = 'none';
    this.api.duel.stop();
    this.api.duel.holdStart = false;
    this.api.setHeroMode(false);
    this.ui.onExit();
  }
}
