import { raidTierFactor } from '../../server/protocol.mjs';
import { nextPaint, sleep, type LoadingScreen } from '../game/loading';
import type { HeroKit } from '../heroes';
import type { NetClient, Profile, ServerMsg } from '../net/client';
import type { GameApi } from '../runtime';
import { BOSSES } from './bosses';
import { NetLink } from './net';
import { OfferScreen } from './offer';
import { scoreText, type RaidScore } from './run';
import { RunUpgrades, offersFor } from './upgrades';

const MOVE_HZ = 20;
/** The loading page stays up at least this long, so it can be read and never just flickers. */
const LOADING_MIN = 700;
/** This hero's HP goes to the partner's bar at most this often (ms). */
const HP_MS = 200;

/**
 * Runs a raid for two on top of the duel's boss fight, next to `MatchController`. The hub leads the run: `raid_offer` opens a pick,
 * `raid_stage` loads the next fight, `raid_won` a boss fell, `raid_end` it is over. The upgrades stay here, on the hero's own screen.
 * During a fight it streams this side's position (and the boss's, on the screen that runs its brain) and hands what the hub says to
 * the fight. Each screen stays one hero against one enemy, plus a third body it only draws (src/raid/partner.ts).
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
  private offers = new OfferScreen(() => this.askLeave());
  /** The clear screen: seconds left to go on, and whether this player has said so. */
  private clearLeft = 0;
  private clearTimer = 0;
  private wentOn = false;
  /** The hub has ended the run. */
  private over = false;
  private match = '';
  private side: 0 | 1 = 0;
  private mine: HeroKit | null = null;
  private partner: { kit: HeroKit; name: string } | null = null;
  private myName = '';
  private upgrades = new RunUpgrades();
  private score: RaidScore = { tier: 1, bosses: 0, seconds: 0 };
  /** The boss just beaten was the last of its tier. */
  private lastOfTier = false;

  constructor(
    private net: NetClient,
    private api: GameApi,
    private loading: LoadingScreen,
    private ui: { onEnter(): void; onExit(): void; onProfile(p: Profile): void; toast(text: string): void },
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
      // The clear screen's button: go on to the next tier, once both have said so.
      net.send({ t: 'raid_next', go: true });
      this.wentOn = true;
      api.duel.waitingOn(this.clearedLine(), true);
    };

    const fight = () => (this.active ? api.duel.boss : null);
    net.on('raid_start', (m) => this.start(m));
    net.on('raid_offer', (m) => this.offer(m));
    net.on('raid_stage', (m) => void this.stage(m));
    net.on('raid_won', (m) => this.won(m));
    net.on('match_fight', (m) => {
      if (!this.active) return;
      this.run++;
      loading.hide();
      api.duel.countdownFrom(m.countdown);
    });
    net.on('peer_move', (m) => { if (this.active) api.duel.partnerMove(m.x, m.z, m.yaw, m.ts); });
    net.on('peer_cast', (m) => { if (this.active) api.duel.partnerCast(m); });
    net.on('peer_attack', () => { if (this.active) api.duel.partnerAttack(); });
    net.on('peer_form', (m) => { if (this.active) api.duel.partnerForm(m.alt); });
    net.on('peer_debuff', (m) => { if (this.active) api.duel.bossDebuff(m.kind, m.amount, m.seconds); });
    net.on('boss_cast', (m) => { if (this.active) this.link?.on.cast(m); });
    net.on('boss_move', (m) => fight()?.bossMove(m.x, m.z, m.yaw, m.ts));
    net.on('boss_hp', (m) => { if (this.active) this.link?.on.hp?.(m.hp); });
    net.on('boss_phase', (m) => { if (this.active) this.link?.on.phase(m.phase); });
    net.on('boss_gauge', (m) => { if (this.active) this.link?.on.stagger(m.value); });
    net.on('boss_kneel', (m) => { if (this.active) this.link?.on.kneel(m.seconds); });
    net.on('boss_stood', (m) => { if (this.active) this.link?.on.stood(m.id, m.part, m.count); });
    net.on('boss_done', (m) => { if (this.active) this.link?.on.done(m.id, m.part, m.side); });
    net.on('boss_wall', (m) => { if (this.active) this.link?.on.wall(m.index); });
    net.on('partner_hp', (m) => { if (this.active) api.duel.partnerHp(m.hp, m.max); });
    net.on('peer_down', (m) => { if (this.active) api.duel.raidDown(m.side); });
    net.on('revived', (m) => { if (this.active) api.duel.raidRevived(m.side, m.hp, m.left); });
    net.on('partner_left', () => {
      if (!this.active) return;
      ui.toast('Your partner left: the run goes on');
      this.partner = null;
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

  private askLeave() {
    if (confirm('Leave this raid? There is no way back in.')) this.exit();
  }

  private start(m: Extract<ServerMsg, { t: 'raid_start' }>) {
    const { api, net } = this;
    const mine = api.kits.find((k) => k.name === m.you.hero), theirs = api.kits.find((k) => k.name === m.partner.hero);
    if (!mine || !theirs) {
      this.ui.toast('This raid needs a newer page: reload');
      net.send({ t: 'match_leave' });
      return;
    }
    this.run++;
    this.active = true;
    this.over = false;
    this.match = m.id;
    this.side = m.side;
    this.mine = mine;
    this.myName = m.you.name;
    this.partner = { kit: theirs, name: m.partner.name };
    this.upgrades = new RunUpgrades();
    this.score = { tier: 1, bosses: 0, seconds: 0 };
    this.ui.onEnter();
  }

  /** The pick before a fight. The screen takes the first when time runs out; the hub waits a little longer. */
  private offer(m: Extract<ServerMsg, { t: 'raid_offer' }>) {
    if (!this.active || !this.mine) return;
    const { api, net } = this, def = BOSSES[m.boss], run = ++this.run;
    clearInterval(this.clearTimer);
    if (api.duel.on) api.duel.stop();
    this.leave.style.display = 'none';
    this.loading.hide();
    this.offers.show({
      title: 'Choose an upgrade',
      line: `Next: ${def?.name ?? 'the boss'}${m.tier > 1 ? `, tier ${m.tier}` : ''}. You keep it for the whole run.`,
      offers: offersFor(this.mine, this.upgrades, `${this.match}-${this.side}-${m.tier}-${m.stage}`),
      seconds: m.seconds,
      waiting: this.partner ? `Waiting for ${this.partner.name}` : undefined,
    }, (u) => {
      if (run !== this.run || !this.active) return;
      this.upgrades.add(u.id);
      net.send({ t: 'raid_pick' });
    });
  }

  private async stage(m: Extract<ServerMsg, { t: 'raid_stage' }>) {
    const { api, net } = this, def = BOSSES[m.boss], mine = this.mine;
    if (!this.active || !def || !mine) {
      if (this.active) this.ui.toast('This raid needs a newer page: reload');
      return;
    }
    const run = ++this.run;
    clearInterval(this.clearTimer);
    this.score.tier = m.tier;
    this.offers.hide();
    this.loading.show({
      mine, theirs: def.kit(m.hp), names: [this.myName, def.title], title: def.name, line: 'Loading the arena',
      note: this.partner ? `With ${this.partner.name}, ${this.partner.kit.name}` : m.tier > 1 ? `Tier ${m.tier}: shown times ${Math.round((1 - raidTierFactor(m.tier)) * 100)} % shorter` : undefined,
    });
    await nextPaint();
    if (run !== this.run || !this.active) return;
    if (api.duel.on) api.duel.stop();
    api.setKit(mine.name);
    api.setHeroMode(true);
    api.duel.holdStart = true;
    this.link = new NetLink(net, this.side, m.hp, m.brain === this.side || !this.partner);
    api.duel.startBoss({
      def, link: this.link, seed: `${this.match}-${m.tier}-${m.stage}`, mode: 'play', name: this.myName, partner: this.partner ?? undefined, tier: m.tier, upgrades: this.upgrades,
      card: (result) => this.card(result),
    });
    this.leave.style.display = '';
    this.lastSent = this.lastBoss = '';
    this.lastHp = -1;
    clearInterval(this.moveTimer);
    this.moveTimer = window.setInterval(() => this.sendMove(), 1000 / MOVE_HZ);
    this.sendMove();
    this.loading.setLine('Loading the heroes');
    await Promise.all([api.duel.whenReady(), sleep(LOADING_MIN)]);
    if (run !== this.run || !this.active) return;
    this.loading.setLine(this.partner ? `Waiting for ${this.partner.name}` : 'Starting');
    net.send({ t: 'match_loaded', maxHp: api.duel.heroMax });
  }

  /** What the duel's card says when a fight ends, or null for none: the run goes on by itself. */
  private card(result: 'win' | 'lose') {
    if (result === 'lose') return { title: 'DEFEATED', text: `The run ends. ${scoreText(this.score)}` };
    if (!this.lastOfTier) return null;
    return {
      title: 'RAID CLEARED',
      text: this.clearedLine(),
      again: `Go on to tier ${this.score.tier + 1}`,
    };
  }

  /** The clear card's words, with the time left to go on. */
  private clearedLine() {
    const left = Math.max(0, this.clearLeft);
    const clock = this.wentOn
      ? `Waiting for ${this.partner?.name ?? 'your partner'}: ${left} s left.`
      : `${this.partner ? 'Both of you have' : 'You have'} to go on within ${left} s, or the run ends here.`;
    return `${scoreText(this.score)} The next tier is harder, and you keep your upgrades. ${clock}`;
  }

  private won(m: Extract<ServerMsg, { t: 'raid_won' }>) {
    if (!this.active) return;
    this.run++;
    this.score = { tier: m.tier, bosses: m.bosses, seconds: m.seconds };
    this.lastOfTier = m.last;
    this.clearLeft = m.wait;
    this.wentOn = false;
    clearInterval(this.moveTimer);
    clearInterval(this.clearTimer);
    this.link?.on.end('win');
    if (m.last) {
      this.clearTimer = window.setInterval(() => {
        this.clearLeft--;
        this.api.duel.cardLine(this.clearedLine());
      }, 1000);
    }
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
    this.score = { tier: m.tier, bosses: m.bosses, seconds: m.seconds };
    this.loading.hide();
    this.offers.hide();
    clearInterval(this.moveTimer);
    clearInterval(this.clearTimer);
    this.leave.style.display = 'none';
    const { duel } = this.api, text = `The run ends. ${scoreText(this.score)}`;
    // On the clear screen the fight is already over: only the button to go on goes.
    if (duel.boss && !duel.isOver) this.link?.on.end(m.result === 'cleared' ? 'win' : 'lose');
    else if (duel.cardShown) duel.waitingOn(text, true);
    else {
      // Between fights there is no card to say it on.
      this.ui.toast(text);
      this.exit();
    }
  }

  /** Leaves the raid screen (the card's button, the Leave button, a lost connection). `gone`: the hub has already let this client go. */
  exit(gone = false) {
    if (!this.active) return;
    this.active = false;
    this.run++;
    this.loading.hide();
    this.offers.hide();
    clearInterval(this.moveTimer);
    clearInterval(this.clearTimer);
    this.leave.style.display = 'none';
    if (!this.over && !gone) this.net.send({ t: 'match_leave' });
    this.link = null;
    if (this.api.duel.on) this.api.duel.stop();
    this.api.duel.holdStart = false;
    this.api.setHeroMode(false);
    this.ui.onExit();
  }
}
