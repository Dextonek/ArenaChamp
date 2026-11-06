import type { GameApi } from '../runtime';
import type { HeroKit } from '../heroes';
import type { NetClient, Profile, RoundPick, ServerMsg } from '../net/client';
import { arenaById, pickArena, type ArenaDef } from '../arenas';
import { nextPaint, sleep, type LoadingScreen } from './loading';

type Api = GameApi;
const MOVE_HZ = 20;
/** The loading page stays up at least this long, so it can be read and never just flickers. */
const LOADING_MIN = 700;
/** With a round's pick to read on it: a swapped hero or a chosen arena should not come as a surprise. */
const LOADING_PICK_MIN = 2000;

/** What the screen shows a round's loser: `choose` takes a hero, an arena, or neither to keep things as they are. */
export interface PickOffer {
  seconds: number;
  myHero: string;
  foeHero: string;
  /** The arena the next round gets if nobody chooses another. */
  nextArena: ArenaDef;
  choose(c: { hero?: string; arena?: string }): void;
}

/**
 * Runs one network match on top of the existing duel: on `match_start` it sets the hero, turns hero mode on and
 * starts `Duel.startNet` against the other player's hero; it streams this side's position, relays casts, hits and
 * dodges, and shows the server's result. A match is best of three rounds: `round_end` shows the round's winner and
 * offers its loser a pick (a hero swap or the next arena), and `round_start` runs `startNet` again (each round in its
 * own arena). Each round shows the loading page until this side has loaded and the server says both have
 * (`match_fight`), then the 3-2-1. `onExit` brings the menu back.
 */
export class MatchController {
  active = false;
  private moveTimer = 0;
  private lastSent = '';
  private names: [string, string] = ['', ''];
  private current: Extract<ServerMsg, { t: 'match_start' }> | null = null;
  /** The hero this side's kit is set to. */
  private hero = '';
  private forfeit: HTMLButtonElement;
  /** Each round's start gets a number: one the match already left does not go on after its waits. */
  private run = 0;

  constructor(
    private net: NetClient,
    private api: Api,
    private loading: LoadingScreen,
    private ui: { onEnter(): void; onExit(): void; onProfile(p: Profile): void; toast(text: string): void; pick(o: PickOffer): void; hidePick(): void },
  ) {
    this.forfeit = document.createElement('button');
    this.forfeit.className = 'btn ghost forfeit';
    this.forfeit.textContent = 'Forfeit';
    this.forfeit.style.display = 'none';
    this.forfeit.addEventListener('click', () => {
      if (confirm('Forfeit this match? It counts as a loss.')) net.send({ t: 'match_leave' });
    });
    document.body.appendChild(this.forfeit);

    // The duel card's "Back to menu" (`duel.onLeave`) is wired in main.ts: it ends this match or a CPU fight.
    // Browsers slow the timers of a hidden tab to about once a second, so the other player sees this hero jump.
    document.addEventListener('visibilitychange', () => {
      if (this.active && document.hidden) this.ui.toast('This tab is hidden: your opponent sees you stutter. Play in two windows, not two tabs.');
    });
    net.on('match_start', (m) => this.start(m));
    net.on('match_fight', (m) => {
      if (!this.active) return;
      this.run++;
      loading.hide();
      api.duel.countdownFrom(m.countdown);
    });
    net.on('peer_move', (m) => {
      if (!this.active) return;
      api.duel.peerMove(m.x, m.z, m.yaw, m.ts);
      if (m.r !== undefined) api.duel.peerResource(m.r);
    });
    net.on('peer_cast', (m) => this.active && api.duel.peerCast(m));
    net.on('peer_hit', (m) => this.active && api.duel.peerHit(m.damage, m.hp, m.color, m.soaked, m.id, m.blocked));
    net.on('peer_attack', (m) => this.active && api.duel.peerAttack(m.id, m.mods));
    net.on('peer_spend', (m) => this.active && api.duel.peerSpend(m.amount, m.hp));
    net.on('peer_buff', (m) => this.active && api.duel.peerBuff(m.kind, m.amount, m.seconds));
    net.on('peer_stacks', (m) => this.active && api.duel.peerStacks(m.name, m.n));
    net.on('peer_heal', (m) => this.active && api.duel.peerHeal(m.amount, m.hp));
    net.on('peer_status', (m) => this.active && api.duel.peerStatus(m.kind, m.seconds, m.color));
    net.on('peer_shield', (m) => this.active && api.duel.peerShield(m.amount, m.seconds, m.color));
    net.on('peer_dodged', () => this.active && api.duel.peerDodged());
    net.on('hp', (m) => this.active && api.duel.setPlayerHp(m.hp));
    net.on('round_end', (m) => {
      if (!this.active) return;
      api.duel.netRoundEnd(this.roundText(m));
      if (m.pick?.you) this.offerPick(m.round, m.pick.seconds);
    });
    net.on('round_start', (m) => {
      if (!this.active || !this.current) return;
      ui.hidePick();
      this.current.you.hero = m.you;
      this.current.foe.hero = m.foe;
      void this.beginRound(m.round, m.picked);
    });
    net.on('match_end', (m) => this.end(m));
    net.on('socket', (m) => {
      if (!m.open && this.active) {
        this.ui.toast('Connection lost: the match is over');
        this.exit();
      }
    });
  }

  private kit(name: string): HeroKit | undefined {
    return this.api.kits.find((k) => k.name === name);
  }

  private start(m: Extract<ServerMsg, { t: 'match_start' }>) {
    const mine = this.kit(m.you.hero), theirs = this.kit(m.foe.hero);
    if (!mine || !theirs) {
      this.ui.toast(`Unknown hero ${!mine ? m.you.hero : m.foe.hero}: reload the page`);
      this.net.send({ t: 'match_leave' });
      return;
    }
    const { api } = this;
    this.active = true;
    this.current = m;
    this.names = [m.you.name, m.foe.name];
    this.ui.onEnter();
    if (api.duel.on) api.duel.stop();
    api.setKit(mine.name);
    this.hero = mine.name;
    api.setHeroMode(true);
    this.forfeit.style.display = '';
    clearInterval(this.moveTimer);
    this.moveTimer = window.setInterval(() => this.sendMove(), 1000 / MOVE_HZ);
    void this.beginRound(1);
  }

  /** Sets up a round (both heroes at their starts, full HP, cooldowns ready) and tells the server this side is ready. */
  private async beginRound(round: number, picked?: RoundPick | null) {
    const { api, net } = this, m = this.current!;
    const mine = this.kit(m.you.hero), theirs = this.kit(m.foe.hero);
    if (!mine || !theirs) {
      // Only a hero this build doesn't know, from another client's swap.
      this.ui.toast(`Unknown hero ${!mine ? m.you.hero : m.foe.hero}: reload the page`);
      net.send({ t: 'match_leave' });
      return;
    }
    const run = ++this.run;
    const note = picked ? this.pickText(picked) : undefined;
    this.loading.show({ mine, theirs, names: this.names, title: round > 1 ? `Round ${round}` : 'Entering the arena', line: 'Loading the arena', note });
    // The page must be on screen before the arena is built, which holds the browser up for a moment.
    await nextPaint();
    if (run !== this.run || !this.active) return;
    if (mine.name !== this.hero) {
      this.hero = mine.name;
      api.setKit(mine.name);
    }
    api.duel.startNet({
      opponent: theirs,
      side: m.side,
      names: this.names,
      // Both players derive the same arena from the match id and round (no server field needed), unless the round's
      // loser chose one.
      arena: this.seed(round),
      arenaId: picked?.arena,
      net: {
        cast: (c) => net.send({ t: 'cast', ...c }),
        tookHit: (id, damage, color, soaked, blocked) => net.send({ t: 'took_hit', id, damage, color, soaked, blocked }),
        dodged: (id) => net.send({ t: 'dodged', id }),
        attack: (id, mods) => net.send({ t: 'attack', id, mods }),
        buff: (kind, amount, seconds) => net.send({ t: 'buff', kind, amount, seconds }),
        stacks: (name, n) => net.send({ t: 'stacks', name, n }),
        heal: (amount) => net.send({ t: 'heal', amount }),
        spend: (amount) => net.send({ t: 'spend', amount }),
        hazard: (damage, color) => net.send({ t: 'hazard', damage, color }),
        status: (kind, seconds, color) => net.send({ t: 'status', kind, seconds, color }),
        shield: (amount, seconds, color) => net.send({ t: 'shield', amount, seconds, color }),
      },
    });
    this.lastSent = '';
    this.sendMove();
    this.loading.setArena(api.duel.currentArena?.name ?? 'The arena');
    this.loading.setLine('Loading the heroes');
    await Promise.all([api.duel.whenReady(), sleep(note ? LOADING_PICK_MIN : LOADING_MIN)]);
    if (run !== this.run || !this.active) return;
    // This side is ready; the server starts the countdown once both are (or after its own wait runs out).
    this.loading.setLine(`Waiting for ${m.foe.name}`);
    net.send({ t: 'match_loaded', maxHp: mine.maxHp ?? 600 });
  }

  /** The seed of a round: both screens get the same arena and arena events from it. */
  private seed(round: number) {
    const id = this.current!.id;
    return round === 1 ? id : `${id}-${round}`;
  }

  private offerPick(round: number, seconds: number) {
    const m = this.current;
    if (!m) return;
    this.ui.pick({
      seconds, myHero: m.you.hero, foeHero: m.foe.hero, nextArena: pickArena(this.seed(round + 1)),
      choose: (c) => this.net.send({ t: 'round_pick', ...c }),
    });
  }

  /** What the loading page says about a pick. Undefined for an arena this build doesn't know: the seeded one is played. */
  private pickText(p: RoundPick) {
    const mine = p.by === this.names[0], who = mine ? 'You' : p.by;
    if (p.hero) return `${who} ${mine ? 'swap' : 'swaps'} to ${p.hero}`;
    const arena = p.arena ? arenaById(p.arena) : undefined;
    return arena ? `${who} ${mine ? 'choose' : 'chooses'} ${arena.name}` : undefined;
  }

  private roundText(m: Extract<ServerMsg, { t: 'round_end' }>) {
    const score = `${m.score[0]}-${m.score[1]}`;
    if (m.result === 'draw') return `Round ${m.round}: a tie · replay · ${score}`;
    const text = `Round ${m.round} to ${m.winner} · ${score}`;
    return m.pick && !m.pick.you ? `${text} · ${this.names[1]} is choosing` : text;
  }

  private sendMove() {
    if (!this.active) return;
    const c = this.api.arena.caster.group;
    // `r`: the hero's resource (src/traits), so the other screen shows its bar.
    const res = this.api.duel.heroRt?.trait?.resource ? Math.round(this.api.duel.heroRt.res) : undefined;
    const msg = { t: 'move', x: +c.position.x.toFixed(3), z: +c.position.z.toFixed(3), yaw: +c.rotation.y.toFixed(3), r: res };
    const key = `${msg.x},${msg.z},${msg.yaw},${res}`;
    if (key === this.lastSent) return;
    this.lastSent = key;
    // The sender's clock lets the other side place each position at the moment it was true, not when it arrived.
    this.net.send({ ...msg, ts: Math.round(performance.now()) });
  }

  private end(m: Extract<ServerMsg, { t: 'match_end' }>) {
    if (m.profile) this.ui.onProfile(m.profile);
    if (!this.active) return;
    this.run++;
    this.loading.hide();
    this.ui.hidePick();
    clearInterval(this.moveTimer);
    this.forfeit.style.display = 'none';
    const [me, foe] = this.names;
    const why = m.reason === 'ko' ? '' : m.reason === 'forfeit' ? ' (forfeit)' : m.reason === 'disconnect' ? ' (disconnected)' : ` (${m.reason})`;
    const score = m.score ? `, ${m.score[0]}-${m.score[1]} in rounds` : '';
    const head = m.result === 'win' ? `${foe} falls after ${m.seconds} s${score}${why}.` : `${me} falls to ${foe} after ${m.seconds} s${score}${why}.`;
    const p = m.profile;
    const tail = p ? ` Record: ${p.wins} W · ${p.losses} L · ${p.matches} matches.` : '';
    this.api.duel.netEnd(m.result, head + tail);
  }

  /** Leaves the match screen (the card's "Back to menu", a lost connection). */
  exit() {
    const was = this.active;
    this.active = false;
    this.run++;
    this.loading.hide();
    this.ui.hidePick();
    this.current = null;
    clearInterval(this.moveTimer);
    this.forfeit.style.display = 'none';
    if (was) this.net.send({ t: 'match_leave' });
    this.api.duel.stop();
    this.api.setHeroMode(false);
    this.ui.onExit();
  }
}
