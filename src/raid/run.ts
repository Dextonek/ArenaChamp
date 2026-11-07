import { RAID_RUN, raidTierFactor } from '../../server/protocol.mjs';
import type { GameApi } from '../runtime';
import { nextPaint, sleep, type LoadingScreen } from '../game/loading';
import { LocalLink } from './link';
import { OfferScreen } from './offer';
import { BOSSES } from './bosses';
import { RunUpgrades, offersFor } from './upgrades';

/** The loading page stays up at least this long, so it can be read and never just flickers. */
const LOADING_MIN = 900;
/** How long a fallen boss stays on screen before the pick. */
const WON_PAUSE = 2200;
const PICK_SECONDS = 30;

/** A run's score: more bosses beaten is better, then a faster time. */
export interface RaidScore {
  tier: number;
  bosses: number;
  seconds: number;
}

/** "3:12" */
export const clockOf = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** What the result card says about a run so far. */
export const scoreText = (s: RaidScore) => `${s.bosses} ${s.bosses === 1 ? 'boss' : 'bosses'} beaten, tier ${s.tier}, ${clockOf(s.seconds)}.`;

function loadBest(): RaidScore | null {
  try {
    return JSON.parse(localStorage.getItem('raid.best') ?? 'null');
  } catch {
    return null;
  }
}

/**
 * A raid on this screen, with no server and no account: pick an upgrade, fight, pick, fight the next boss; beat them all and
 * the next tier is offered, keeping the upgrades, for a higher score. One loss ends it. HP is full at each fight. The loading
 * page, the 3-2-1 and the fight are as in `CpuMatch`.
 */
export class RaidRun {
  active = false;
  private leave: HTMLButtonElement;
  private offers = new OfferScreen(() => this.askLeave());
  private hero = '';
  private stage = 0;
  private tier = 1;
  private beaten = 0;
  private seconds = 0;
  private upgrades = new RunUpgrades();
  private seed = '';
  /** What the result card's button does: the next tier, or the run again from the start. */
  private again: 'tier' | 'restart' = 'restart';
  /** Each wait gets a number: one the player already left does not go on. */
  private run = 0;

  constructor(
    private api: GameApi,
    private loading: LoadingScreen,
    private ui: { onEnter(): void; onExit(): void },
  ) {
    this.leave = document.createElement('button');
    this.leave.className = 'btn ghost forfeit raid-leave';
    this.leave.textContent = 'Leave';
    this.leave.style.display = 'none';
    this.leave.addEventListener('click', () => this.askLeave());
    document.body.appendChild(this.leave);
    const rematch = api.duel.onRematch;
    api.duel.onRematch = () => {
      if (!this.active) { rematch?.(); return; }
      if (this.again === 'tier') void this.nextTier();
      else void this.start({ hero: this.hero });
    };
    const finish = api.duel.onFinish;
    api.duel.onFinish = (result) => {
      finish?.(result);
      if (this.active) void this.finished(result);
    };
  }

  private askLeave() {
    if (confirm('Leave this raid? The run ends here.')) this.exit();
  }

  /** The best run this browser has seen. */
  get best() {
    return loadBest();
  }

  private get score(): RaidScore {
    return { tier: this.tier, bosses: this.beaten, seconds: this.seconds };
  }

  private saveBest() {
    const s = this.score, b = loadBest();
    if (s.bosses > 0 && (!b || s.bosses > b.bosses || (s.bosses === b.bosses && s.seconds < b.seconds))) {
      try { localStorage.setItem('raid.best', JSON.stringify(s)); } catch { /* the score just isn't kept */ }
    }
  }

  async start(o: { hero: string }) {
    this.run++;
    this.active = true;
    this.hero = o.hero;
    this.stage = 0;
    this.tier = 1;
    this.beaten = 0;
    this.seconds = 0;
    this.upgrades = new RunUpgrades();
    this.seed = String(Math.random());
    this.ui.onEnter();
    if (this.api.duel.on) this.api.duel.stop();
    this.offer();
  }

  private async nextTier() {
    this.tier++;
    this.stage = 0;
    if (this.api.duel.on) this.api.duel.stop();
    this.offer();
  }

  /** The pick before a fight. */
  private offer() {
    const kit = this.api.kits.find((k) => k.name === this.hero);
    const def = BOSSES[RAID_RUN[this.stage]];
    if (!kit || !def) return;
    const run = this.run;
    this.loading.hide();
    this.offers.show({
      title: 'Choose an upgrade',
      line: `Next: ${def.name}${this.tier > 1 ? `, tier ${this.tier}` : ''}. You keep it for the whole run.`,
      offers: offersFor(kit, this.upgrades, `${this.seed}-${this.tier}-${this.stage}`),
      seconds: PICK_SECONDS,
    }, (u) => {
      if (run !== this.run || !this.active) return;
      if (u) this.upgrades.add(u.id);
      this.offers.hide();
      void this.fight();
    });
  }

  private async fight() {
    const { api } = this;
    const def = BOSSES[RAID_RUN[this.stage]];
    const run = ++this.run;
    const link = new LocalLink(def, this.tier);
    this.loading.show({ mine: api.kits.find((k) => k.name === this.hero), theirs: def.kit(link.maxHp), title: def.name, line: 'Loading the arena', note: this.tier > 1 ? `Tier ${this.tier}: shown times ${Math.round((1 - raidTierFactor(this.tier)) * 100)} % shorter` : undefined });
    await nextPaint();
    if (run !== this.run) return;
    if (api.duel.on) api.duel.stop();
    api.setKit(this.hero);
    api.setHeroMode(true);
    api.duel.holdStart = true;
    api.duel.startBoss({
      def, link, seed: `${this.seed}-${this.tier}-${this.stage}`, mode: 'play', tier: this.tier, upgrades: this.upgrades,
      card: (result, seconds) => this.card(result, seconds),
    });
    this.leave.style.display = '';
    this.loading.setLine('Loading the heroes');
    await Promise.all([api.duel.whenReady(), sleep(LOADING_MIN)]);
    if (run !== this.run) return;
    this.loading.hide();
    api.duel.countdownFrom(3);
  }

  /** What the duel's card says when a fight ends, or null for none: the run just goes on. */
  private card(result: 'win' | 'lose', seconds: number) {
    if (result === 'lose') {
      this.seconds += seconds;
      this.again = 'restart';
      this.saveBest();
      return { title: 'DEFEATED', text: `The run ends. ${scoreText(this.score)}`, again: 'Try again' };
    }
    this.seconds += seconds;
    this.beaten++;
    if (this.stage < RAID_RUN.length - 1) return null;
    this.again = 'tier';
    this.saveBest();
    return { title: 'RAID CLEARED', text: `${scoreText(this.score)} The next tier is harder, and you keep your upgrades.`, again: `Go on to tier ${this.tier + 1}` };
  }

  /** A fight ended. A boss beaten with more to come: on to the next pick. */
  private async finished(result: 'win' | 'lose') {
    if (result !== 'win' || this.stage >= RAID_RUN.length - 1) return;
    const run = ++this.run;
    await sleep(WON_PAUSE);
    if (run !== this.run || !this.active) return;
    this.stage++;
    this.api.duel.stop();
    this.leave.style.display = 'none';
    this.offer();
  }

  exit() {
    if (!this.active) return;
    // What was beaten counts, however the run ends.
    this.saveBest();
    this.active = false;
    this.run++;
    this.offers.hide();
    this.loading.hide();
    this.leave.style.display = 'none';
    this.api.duel.stop();
    this.api.duel.holdStart = false;
    this.api.setHeroMode(false);
    this.ui.onExit();
  }
}
