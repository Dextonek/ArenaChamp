import type { GameApi } from '../runtime';
import type { HeroKit } from '../heroes';
import type { NetClient, RoundPick, ServerMsg, WatchPeerMsg } from '../net/client';
import { arenaById } from '../arenas';
import { nextPaint, type LoadingScreen } from './loading';

type StartMsg = Extract<ServerMsg, { t: 'watch_start' }>;

/** The eye drawn beside a count of watchers. */
const EYE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

let badge: HTMLDivElement | null = null;

/**
 * How many watch the duel this screen is in, as a small eye and a number in the corner (no names: the user's choice,
 * 2026-11-12). Nobody watching: nothing is shown. For the players (src/game/match.ts) and the watchers alike.
 */
export function showWatchers(n: number) {
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'watchers';
    badge.title = 'Watching this duel';
    document.body.appendChild(badge);
  }
  badge.innerHTML = `${EYE}<span>${Math.max(0, Math.round(n))}</span>`;
  badge.style.display = n > 0 ? '' : 'none';
}

export function hideWatchers() {
  if (badge) badge.style.display = 'none';
}

/**
 * Watching someone else's duel (since PROTOCOL 14). `watch(id)` asks the hub; `watch_start` says how the duel stands, and
 * from then on every message of both players comes wrapped in `watch_msg` with its hero's side. Side 0 is drawn as this
 * screen's hero and side 1 as the opponent (`Duel.startWatch`); the camera looks at the whole ring. This screen decides
 * nothing: every hit and HP comes from the players' screens through the hub. A round is loaded as the players load it, from
 * the same seed, so the arena and its events are theirs.
 */
export class WatchController {
  active = false;
  private current: StartMsg | null = null;
  private names: [string, string] = ['', ''];
  private heroes: [string, string] = ['', ''];
  /** The hero this screen's kit is set to (side 0's). */
  private hero = '';
  /** Each round's start gets a number: a round the watcher already left does not go on after its waits. */
  private run = 0;
  /** A round is being loaded: messages about the heroes wait for it (they would land in the last round's arena). */
  private loadingRound = false;
  /** The countdown the hub started while this screen was still loading, and when it was told. */
  private early: { countdown: number; at: number; hp: number[] } | null = null;
  private leave: HTMLButtonElement;

  constructor(
    private net: NetClient,
    private api: GameApi,
    private loading: LoadingScreen,
    private ui: { onEnter(): void; onExit(): void; toast(text: string): void },
  ) {
    this.leave = document.createElement('button');
    this.leave.className = 'btn ghost forfeit';
    this.leave.textContent = 'Stop watching';
    this.leave.style.display = 'none';
    this.leave.addEventListener('click', () => this.exit());
    document.body.appendChild(this.leave);

    net.on('watch_start', (m) => this.start(m));
    net.on('watch_msg', (m) => this.active && !this.loadingRound && this.peer(m.side, m.msg));
    net.on('watch_fight', (m) => {
      if (!this.active) return;
      if (this.loadingRound) { this.early = { countdown: m.countdown, at: performance.now(), hp: m.hp }; return; }
      api.duel.watchHp(m.hp);
      api.duel.countdownFrom(m.countdown);
    });
    net.on('watch_round_end', (m) => {
      if (!this.active || this.loadingRound) return;
      api.duel.watchHp(m.hp);
      const score = `${m.score[0]}-${m.score[1]}`;
      const head = m.winner < 0 ? `Round ${m.round}: a tie · ${score}` : `Round ${m.round} to ${this.names[m.winner]} · ${score}`;
      api.duel.netRoundEnd(m.picking >= 0 ? `${head} · ${this.names[m.picking]} is choosing` : head);
    });
    net.on('watch_round_start', (m) => {
      if (!this.active) return;
      this.heroes = [m.heroes[0], m.heroes[1]];
      void this.beginRound(m.round, m.picked, null);
    });
    net.on('watch_end', (m) => this.end(m));
    net.on('watchers', (m) => this.active && showWatchers(m.n));
    net.on('socket', (m) => {
      if (!m.open && this.active) {
        ui.toast('Connection lost');
        this.exit();
      }
    });
  }

  /** Asks to watch the duel `id` (from the Lobbies screen's list). The hub answers with `watch_start`, or an error. */
  watch(id: string) {
    this.net.send({ t: 'watch', id });
  }

  private kit(name: string): HeroKit | undefined {
    return this.api.kits.find((k) => k.name === name);
  }

  private start(m: StartMsg) {
    const a = this.kit(m.players[0]?.hero), b = this.kit(m.players[1]?.hero);
    if (!a || !b) {
      this.ui.toast(`Unknown hero ${!a ? m.players[0]?.hero : m.players[1]?.hero}: reload the page`);
      this.net.send({ t: 'watch_leave' });
      return;
    }
    const { api } = this;
    this.active = true;
    this.current = m;
    this.names = [m.players[0].name, m.players[1].name];
    this.heroes = [a.name, b.name];
    this.ui.onEnter();
    if (api.duel.on) api.duel.stop();
    api.setKit(a.name);
    this.hero = a.name;
    api.setHeroMode(true);
    this.leave.style.display = '';
    showWatchers(m.watchers);
    void this.beginRound(m.round, m.picked, m);
  }

  /** The round's seed: the players' screens build the same arena and events from it (src/game/match.ts `seed`). */
  private seed(round: number) {
    const id = this.current!.id;
    return round === 1 ? id : `${id}-${round}`;
  }

  /**
   * Loads a round as the players' screens do. `snap`: the duel as it stood when this watcher came in (the heroes' spots, their
   * HP, how far into the round it is); without one, a new round from its start.
   */
  private async beginRound(round: number, picked: RoundPick | null, snap: StartMsg | null) {
    const { api } = this;
    const mine = this.kit(this.heroes[0]), theirs = this.kit(this.heroes[1]);
    if (!mine || !theirs) {
      this.ui.toast(`Unknown hero ${!mine ? this.heroes[0] : this.heroes[1]}: reload the page`);
      this.exit();
      return;
    }
    const run = ++this.run;
    this.loadingRound = true;
    this.early = null;
    this.loading.show({ mine, theirs, names: this.names, title: `Watching · round ${round}`, line: 'Loading the arena' });
    await nextPaint();
    if (run !== this.run || !this.active) return;
    if (mine.name !== this.hero) {
      this.hero = mine.name;
      api.setKit(mine.name);
    }
    api.duel.startWatch({ opponent: theirs, names: this.names, arena: this.seed(round), arenaId: picked?.arena });
    this.loading.setArena(arenaById(picked?.arena ?? '')?.name ?? api.duel.currentArena?.name ?? 'The arena');
    this.loading.setLine('Loading the heroes');
    await api.duel.whenReady();
    if (run !== this.run || !this.active) return;
    this.loadingRound = false;
    this.loading.hide();
    if (snap) {
      snap.players.forEach((p, side) => { if (p.at) api.duel.watchPlace(side, p.at.x, p.at.z, p.at.yaw); });
      api.duel.watchHp(snap.players.map((p) => p.hp));
      if (snap.state === 'fight' && snap.countdown > 0) api.duel.countdownFrom(snap.countdown);
      else if (snap.state === 'fight') api.duel.watchLive(snap.elapsed);
      else if (snap.state === 'break') api.duel.netRoundEnd(`Round ${round} is over · ${snap.score[0]}-${snap.score[1]}`);
    }
    // (Set by `watch_fight` during the awaits above; TypeScript cannot see that.)
    const early = this.early as { countdown: number; at: number; hp: number[] } | null;
    this.early = null;
    if (early) {
      // The countdown started while this screen loaded: it ends when it ends on the players' screens.
      const left = early.countdown - (performance.now() - early.at) / 1000;
      api.duel.watchHp(early.hp);
      if (left > 0) api.duel.countdownFrom(left);
      else api.duel.watchLive(-left);
    }
  }

  /** A message about hero `side`: side 0 is this screen's hero, side 1 the opponent, as a player's screen draws its foe. */
  private peer(side: number, m: WatchPeerMsg) {
    const duel = this.api.duel;
    if (side === 0) return duel.watchMine(m);
    switch (m.t) {
      case 'peer_move':
        duel.peerMove(m.x, m.z, m.yaw, m.ts);
        if (m.r !== undefined) duel.peerResource(m.r);
        return;
      case 'peer_cast': return duel.peerCast(m);
      case 'peer_hit': return duel.peerHit(m.damage, m.hp, m.color, m.soaked, undefined, m.blocked);
      case 'peer_attack': return duel.peerAttack(m.id, m.mods);
      case 'peer_spend': return duel.peerSpend(m.amount, m.hp);
      case 'peer_buff': return duel.peerBuff(m.kind, m.amount, m.seconds);
      case 'peer_stacks': return duel.peerStacks(m.name, m.n);
      case 'peer_heal': return duel.peerHeal(m.amount, m.hp);
      case 'peer_status': return duel.peerStatus(m.kind, m.seconds, m.color);
      case 'peer_shield': return duel.peerShield(m.amount, m.seconds, m.color);
      case 'peer_dodged': return duel.peerDodged();
    }
  }

  private end(m: Extract<ServerMsg, { t: 'watch_end' }>) {
    if (!this.active) return;
    this.run++;
    this.loadingRound = false;
    this.loading.hide();
    this.api.duel.watchHp(m.hp);
    const winner = this.names[m.winner] ?? '', loser = this.names[1 - m.winner] ?? '';
    const why = m.reason === 'ko' ? '' : m.reason === 'forfeit' ? ' (forfeit)' : m.reason === 'disconnect' ? ' (disconnected)' : ` (${m.reason})`;
    const kit = this.kit(this.heroes[m.winner]);
    this.api.duel.netEnd(m.winner === 0 ? 'win' : 'loss', `${loser} falls after ${m.seconds} s, ${m.score[0]}-${m.score[1]} in rounds${why}.`, {
      text: `${winner.toUpperCase()} WINS`, color: kit?.accent ?? '#ffd27a',
    });
    // The duel is over and the hub has let this watcher go: leaving now tells it nothing.
    this.current = null;
  }

  /** Leaves the watched duel (the button, the card's "Back to menu", a lost connection). */
  exit() {
    const was = this.active;
    this.active = false;
    this.run++;
    this.loadingRound = false;
    this.loading.hide();
    if (was && this.current) this.net.send({ t: 'watch_leave' });
    this.current = null;
    this.leave.style.display = 'none';
    hideWatchers();
    this.api.duel.stop();
    this.api.setHeroMode(false);
    if (was) this.ui.onExit();
  }
}
