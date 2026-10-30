import type { gameApi as GameApi } from '../main';
import type { HeroKit } from '../heroes';
import type { NetClient, Profile, ServerMsg } from '../net/client';

type Api = typeof GameApi;
const MOVE_HZ = 20;

/**
 * Runs one network match on top of the existing duel: on `match_start` it sets the hero, turns hero mode on and
 * starts `Duel.startNet` against the other player's hero; it streams this side's position, relays casts, hits and
 * dodges, and shows the server's result. `onExit` brings the menu back.
 */
export class MatchController {
  active = false;
  private moveTimer = 0;
  private lastSent = '';
  private names: [string, string] = ['', ''];
  private forfeit: HTMLButtonElement;

  constructor(
    private net: NetClient,
    private api: Api,
    private ui: { onEnter(): void; onExit(): void; onProfile(p: Profile): void; toast(text: string): void },
  ) {
    this.forfeit = document.createElement('button');
    this.forfeit.className = 'btn ghost forfeit';
    this.forfeit.textContent = 'Forfeit';
    this.forfeit.style.display = 'none';
    this.forfeit.addEventListener('click', () => {
      if (confirm('Forfeit this match? It counts as a loss.')) net.send({ t: 'match_leave' });
    });
    document.body.appendChild(this.forfeit);

    api.duel.onLeave = () => this.exit();
    // Browsers slow the timers of a hidden tab to about once a second, so the other player sees this hero jump.
    document.addEventListener('visibilitychange', () => {
      if (this.active && document.hidden) this.ui.toast('This tab is hidden: your opponent sees you stutter. Play in two windows, not two tabs.');
    });
    net.on('match_start', (m) => this.start(m));
    net.on('match_fight', (m) => this.active && api.duel.countdownFrom(m.countdown));
    net.on('peer_move', (m) => this.active && api.duel.peerMove(m.x, m.z, m.yaw, m.ts));
    net.on('peer_cast', (m) => this.active && api.duel.peerCast(m));
    net.on('peer_hit', (m) => this.active && api.duel.peerHit(m.damage, m.hp, m.color));
    net.on('peer_dodged', () => this.active && api.duel.peerDodged());
    net.on('hp', (m) => this.active && api.duel.setPlayerHp(m.hp));
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
    const { api, net } = this;
    this.active = true;
    this.names = [m.you.name, m.foe.name];
    this.ui.onEnter();
    if (api.duel.on) api.duel.stop();
    api.setKit(mine.name);
    api.setHeroMode(true);
    api.duel.startNet({
      opponent: theirs,
      side: m.side,
      names: this.names,
      net: {
        cast: (c) => net.send({ t: 'cast', ...c }),
        tookHit: (id, damage, color) => net.send({ t: 'took_hit', id, damage, color }),
        dodged: (id) => net.send({ t: 'dodged', id }),
      },
    });
    this.forfeit.style.display = '';
    this.lastSent = '';
    clearInterval(this.moveTimer);
    this.moveTimer = window.setInterval(() => this.sendMove(), 1000 / MOVE_HZ);
    this.sendMove();
    // The hero figures load asynchronously; the server starts the countdown once both sides are here.
    net.send({ t: 'match_loaded' });
  }

  private sendMove() {
    if (!this.active) return;
    const c = this.api.arena.caster.group;
    const msg = { t: 'move', x: +c.position.x.toFixed(3), z: +c.position.z.toFixed(3), yaw: +c.rotation.y.toFixed(3) };
    const key = `${msg.x},${msg.z},${msg.yaw}`;
    if (key === this.lastSent) return;
    this.lastSent = key;
    // The sender's clock lets the other side place each position at the moment it was true, not when it arrived.
    this.net.send({ ...msg, ts: Math.round(performance.now()) });
  }

  private end(m: Extract<ServerMsg, { t: 'match_end' }>) {
    if (m.profile) this.ui.onProfile(m.profile);
    if (!this.active) return;
    clearInterval(this.moveTimer);
    this.forfeit.style.display = 'none';
    const [me, foe] = this.names;
    const why = m.reason === 'ko' ? '' : m.reason === 'forfeit' ? ' (forfeit)' : m.reason === 'disconnect' ? ' (disconnected)' : ` (${m.reason})`;
    const head = m.result === 'win' ? `${foe} falls after ${m.seconds} s${why}.` : `${me} falls to ${foe} after ${m.seconds} s${why}.`;
    const p = m.profile;
    const tail = p ? ` Record: ${p.wins} W · ${p.losses} L · ${p.matches} matches.` : '';
    this.api.duel.netEnd(m.result, head + tail);
  }

  /** Leaves the match screen (the card's "Back to menu", a lost connection). */
  exit() {
    const was = this.active;
    this.active = false;
    clearInterval(this.moveTimer);
    this.forfeit.style.display = 'none';
    if (was) this.net.send({ t: 'match_leave' });
    this.api.duel.stop();
    this.api.setHeroMode(false);
    this.ui.onExit();
  }
}
