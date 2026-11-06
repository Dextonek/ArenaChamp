import { nextPaint, sleep, type LoadingScreen } from '../game/loading';
import type { NetClient, Profile, ServerMsg } from '../net/client';
import type { GameApi } from '../runtime';
import { NetLink } from './net';
import { BOSSES } from './sunWarden';

const MOVE_HZ = 20;
/** The loading page stays up at least this long, so it can be read and never just flickers. */
const LOADING_MIN = 700;
/** This hero's HP goes to the partner's bar at most this often (ms). */
const HP_MS = 200;

/**
 * Runs a raid for two on top of the duel's boss fight, next to `MatchController`: on `raid_start` it sets the hero and starts
 * `Duel.startBoss` with a partner and a network link; it streams this side's position (and the boss's, on the screen that
 * runs its brain) and hands what the hub says to the fight. Each screen stays one hero against one enemy, plus a third body
 * it only draws (src/raid/partner.ts).
 */
export class RaidController {
  active = false;
  private moveTimer = 0;
  private lastSent = '';
  private lastBoss = '';
  private lastHp = -1;
  private hpAt = 0;
  private link: NetLink | null = null;
  private run = 0;
  private leave: HTMLButtonElement;
  private over = false;

  constructor(
    private net: NetClient,
    private api: GameApi,
    private loading: LoadingScreen,
    private ui: { onEnter(): void; onExit(): void; onProfile(p: Profile): void; toast(text: string): void },
  ) {
    this.leave = document.createElement('button');
    this.leave.className = 'btn ghost forfeit';
    this.leave.textContent = 'Leave';
    this.leave.style.display = 'none';
    this.leave.addEventListener('click', () => {
      if (confirm('Leave this raid? There is no way back in.')) this.exit();
    });
    document.body.appendChild(this.leave);

    const fight = () => (this.active ? api.duel.boss : null);
    net.on('raid_start', (m) => void this.start(m));
    net.on('match_fight', (m) => {
      if (!this.active) return;
      this.run++;
      loading.hide();
      api.duel.countdownFrom(m.countdown);
    });
    net.on('peer_move', (m) => { if (this.active) api.duel.partnerMove(m.x, m.z, m.yaw, m.ts); });
    net.on('peer_cast', (m) => { if (this.active) api.duel.partnerCast(m); });
    net.on('peer_attack', (m) => { if (this.active) api.duel.partnerAttack(); void m; });
    net.on('boss_cast', (m) => { if (this.active) this.link?.on.cast(m); });
    net.on('boss_move', (m) => fight()?.bossMove(m.x, m.z, m.yaw, m.ts));
    net.on('boss_hp', (m) => { if (this.active) this.link?.on.hp?.(m.hp); });
    net.on('boss_phase', (m) => { if (this.active) this.link?.on.phase(m.phase); });
    net.on('boss_gauge', (m) => { if (this.active) this.link?.on.stagger(m.value); });
    net.on('boss_kneel', (m) => { if (this.active) this.link?.on.kneel(m.seconds); });
    net.on('boss_stood', (m) => { if (this.active) this.link?.on.stood(m.id, m.part, m.count); });
    net.on('boss_wall', (m) => { if (this.active) this.link?.on.wall(m.index); });
    net.on('partner_hp', (m) => { if (this.active) api.duel.partnerHp(m.hp, m.max); });
    net.on('peer_down', (m) => { if (this.active) api.duel.raidDown(m.side); });
    net.on('revived', (m) => { if (this.active) api.duel.raidRevived(m.side, m.hp, m.left); });
    net.on('partner_left', () => {
      if (!this.active) return;
      ui.toast('Your partner left: the fight goes on');
      api.duel.partnerLeft();
    });
    net.on('boss_brain', () => fight()?.takeBrain());
    net.on('raid_end', (m) => this.end(m));
    net.on('socket', (m) => {
      if (!m.open && this.active) {
        ui.toast('Connection lost: the raid is over');
        this.exit();
      }
    });
  }

  private async start(m: Extract<ServerMsg, { t: 'raid_start' }>) {
    const { api, net } = this;
    const def = BOSSES[m.boss];
    const mine = api.kits.find((k) => k.name === m.you.hero), theirs = api.kits.find((k) => k.name === m.partner.hero);
    if (!def || !mine || !theirs) {
      this.ui.toast('This raid needs a newer page: reload');
      net.send({ t: 'match_leave' });
      return;
    }
    const run = ++this.run;
    this.active = true;
    this.over = false;
    this.ui.onEnter();
    this.loading.show({ mine, theirs: def.kit(m.hp), names: [m.you.name, def.title], title: def.name, line: 'Loading the arena', note: `With ${m.partner.name}, ${theirs.name}` });
    await nextPaint();
    if (run !== this.run || !this.active) return;
    if (api.duel.on) api.duel.stop();
    api.setKit(mine.name);
    api.setHeroMode(true);
    api.duel.holdStart = true;
    this.link = new NetLink(net, m.side, m.hp, m.side === 0);
    api.duel.startBoss({ def, link: this.link, seed: m.id, mode: 'play', name: m.you.name, partner: { kit: theirs, name: m.partner.name } });
    this.leave.style.display = '';
    this.lastSent = this.lastBoss = '';
    this.lastHp = -1;
    clearInterval(this.moveTimer);
    this.moveTimer = window.setInterval(() => this.sendMove(), 1000 / MOVE_HZ);
    this.sendMove();
    this.loading.setLine('Loading the heroes');
    await Promise.all([api.duel.whenReady(), sleep(LOADING_MIN)]);
    if (run !== this.run || !this.active) return;
    this.loading.setLine(`Waiting for ${m.partner.name}`);
    net.send({ t: 'match_loaded', maxHp: mine.maxHp ?? 600 });
  }

  private sendMove() {
    if (!this.active) return;
    const { api, net, link } = this, c = api.arena.caster.group;
    const x = +c.position.x.toFixed(3), z = +c.position.z.toFixed(3), yaw = +c.rotation.y.toFixed(3), key = `${x},${z},${yaw}`;
    const ts = Math.round(performance.now());
    if (key !== this.lastSent) {
      this.lastSent = key;
      net.send({ t: 'move', x, z, yaw, ts });
    }
    const foe = api.duel.bossFigure;
    if (link?.brain && foe) {
      const bx = +foe.group.position.x.toFixed(3), bz = +foe.group.position.z.toFixed(3), byaw = +foe.group.rotation.y.toFixed(3), bkey = `${bx},${bz},${byaw}`;
      if (bkey !== this.lastBoss) {
        this.lastBoss = bkey;
        net.send({ t: 'boss_move', x: bx, z: bz, yaw: byaw, ts });
      }
    }
    // The partner's bar: this hero's HP when it has changed, a few times a second.
    const hp = Math.round(api.duel.heroHp);
    if (hp !== this.lastHp && ts - this.hpAt >= HP_MS) {
      this.lastHp = hp;
      this.hpAt = ts;
      link?.heroHp(hp);
    }
  }

  private end(m: Extract<ServerMsg, { t: 'raid_end' }>) {
    if (m.profile) this.ui.onProfile(m.profile);
    if (!this.active) return;
    this.run++;
    this.over = true;
    this.loading.hide();
    clearInterval(this.moveTimer);
    this.leave.style.display = 'none';
    this.link?.on.end(m.result === 'cleared' ? 'win' : 'lose');
  }

  /** Leaves the raid screen (the card's button, the Leave button, a lost connection). */
  exit() {
    if (!this.active) return;
    this.active = false;
    this.run++;
    this.loading.hide();
    clearInterval(this.moveTimer);
    this.leave.style.display = 'none';
    if (!this.over) this.net.send({ t: 'match_leave' });
    this.link = null;
    this.api.duel.stop();
    this.api.duel.holdStart = false;
    this.api.setHeroMode(false);
    this.ui.onExit();
  }
}
