import { RAID_RUN, raidTierFactor } from '../../server/protocol.mjs';
import { nextPaint, sleep, type LoadingScreen } from '../game/loading';
import type { HeroKit } from '../heroes';
import type { NetClient, Profile, ServerMsg } from '../net/client';
import type { GameApi } from '../runtime';
import { twinFlames } from './ashEmber';
import { BOSSES } from './bosses';
import { RaidHall, fadeTo } from './hall';
import { NetLink } from './net';
import { scoreText, type RaidScore } from './run';
import { RunUpgrades, offersFor, vaultOffers } from './upgrades';
import { omenNames } from './omens';
import { TierOmens, doorsFor, shrineCard, type PathId } from './paths';

const MOVE_HZ = 20;
/** A party of more than two sends its walk less often: the hub bundles everyone's 10 times a second anyway. */
const PARTY_MOVE_HZ = 10;
/** The loading page only shows when a room takes longer than this to load (ms). */
const SLOW_LOAD = 1200;
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
  private pingAt = 0;
  private hpAt = 0;
  private link: NetLink | null = null;
  private run = 0;
  private leave: HTMLButtonElement;
  private hall: RaidHall;
  /** The clear screen: seconds left to go on, and whether this player has said so. */
  private clearLeft = 0;
  private clearTimer = 0;
  private wentOn = false;
  /** The hub has ended the run. */
  private over = false;
  private match = '';
  private side = 0;
  private mine: HeroKit | null = null;
  /** The other heroes of this raid, by side (pipeline/designs/raid-party.md). */
  private party: { side: number; kit: HeroKit; name: string }[] = [];
  /** How many the boss is tuned for now (the band). */
  private band = 2;
  private myName = '';
  private upgrades = new RunUpgrades();
  /** This tier's omens, as the side doors have left them; both screens change them only on what the hub says. */
  private omens = new TierOmens('', 0);
  private omensTier = 0;
  /** This hall's side room is behind us. */
  private sideDone = false;
  /** The hall's last offer, for a side room that opens from it. */
  private lastOffer: Extract<ServerMsg, { t: 'raid_offer' }> | null = null;
  private score: RaidScore = { tier: 1, bosses: 0, seconds: 0 };
  /** The boss just beaten was the last of its tier. */
  private lastOfTier = false;

  constructor(
    private net: NetClient,
    private api: GameApi,
    private loading: LoadingScreen,
    private ui: { onEnter(): void; onExit(): void; onProfile(p: Profile): void; toast(text: string): void },
  ) {
    this.hall = new RaidHall(api);
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
    net.on('raid_gate', (m) => { if (this.active) this.hall.openGate(m.seconds); });
    net.on('raid_side_go', (m) => this.sideRoom(m.door, m.seconds));
    net.on('raid_stage', (m) => void this.stage(m));
    net.on('raid_won', (m) => this.won(m));
    net.on('match_fight', (m) => {
      if (!this.active) return;
      this.run++;
      loading.hide();
      void fadeTo(false);
      api.duel.countdownFrom(m.countdown);
    });
    // A raid for two names nobody in its messages: then it is the one partner.
    const who = (side?: number) => side ?? this.party[0]?.side ?? 1 - this.side;
    net.on('peer_move', (m) => { if (this.active) api.duel.partnerMove(who(m.side), m.x, m.z, m.yaw, m.ts); });
    net.on('party_moves', (m) => {
      if (!this.active) return;
      for (const [side, x, z, yaw, ts] of m.list) if (side !== this.side) api.duel.partnerMove(side, x, z, yaw, ts ?? undefined);
    });
    net.on('peer_cast', (m) => { if (this.active) api.duel.partnerCast(who(m.side), m); });
    net.on('peer_attack', (m) => { if (this.active) api.duel.partnerAttack(who(m.side)); });
    net.on('peer_form', (m) => { if (this.active) api.duel.partnerForm(who(m.side), m.alt); });
    net.on('peer_debuff', (m) => { if (this.active) api.duel.bossDebuff(m.kind, m.amount, m.seconds, m.which); });
    net.on('boss_cast', (m) => { if (this.active) this.link?.on.cast(m); });
    // Twin Flames: `which` says whose it is, and the fight sorts it (src/raid/fight.ts).
    net.on('boss_move', (m) => fight()?.bossMove(m.x, m.z, m.yaw, m.ts, m.which));
    net.on('boss_hp', (m) => { if (this.active) this.link?.on.hp?.(m.hp, m.which); });
    net.on('boss_phase', (m) => { if (this.active) this.link?.on.phase(m.phase, m.which); });
    net.on('boss_gauge', (m) => { if (this.active) this.link?.on.stagger(m.value, m.which); });
    net.on('boss_kneel', (m) => { if (this.active) this.link?.on.kneel(m.seconds, m.which); });
    net.on('boss_rage', (m) => { if (this.active) this.link?.on.rage?.(m.which, m.on); });
    net.on('boss_fell', (m) => { if (this.active) this.link?.on.fell?.(m.which); });
    net.on('boss_stood', (m) => { if (this.active) this.link?.on.stood(m.id, m.part, m.count); });
    net.on('boss_done', (m) => { if (this.active) this.link?.on.done(m.id, m.part, m.side); });
    net.on('peer_add', (m) => { if (this.active) this.link?.on.addHit?.(m.id, m.part, m.amount); });
    net.on('boss_wall', (m) => { if (this.active) this.link?.on.wall(m.index); });
    net.on('partner_hp', (m) => { if (this.active) api.duel.partnerHp(who(m.side), m.hp, m.max); });
    net.on('peer_down', (m) => { if (this.active) api.duel.raidDown(m.side); });
    net.on('revived', (m) => { if (this.active) api.duel.raidRevived(m.side, m.hp, m.left); });
    net.on('partner_left', (m) => {
      if (!this.active) return;
      const side = who(m.side), gone = this.party.find((p) => p.side === side);
      ui.toast(this.party.length > 1 ? `${gone?.name ?? 'A player'} left: the run goes on` : 'Your partner left: the run goes on');
      this.party = this.party.filter((p) => p.side !== side);
      api.duel.partnerLeft(side);
    });
    net.on('boss_brain', (m) => fight()?.takeBrain(m.which));
    net.on('brain_moved', (m) => { if (m.side !== this.side) fight()?.dropBrain(m.which); });
    net.on('raid_end', (m) => this.end(m));
    net.on('socket', (m) => {
      if (!m.open && this.active) {
        ui.toast('Connection lost: the raid is over');
        this.exit();
      }
    });
  }

  /** The one partner of a raid for two. */
  private get partner() {
    return this.party.length === 1 ? this.party[0] : null;
  }

  /** How often this screen sends its walk. */
  private get moveHz() {
    return this.party.length > 1 ? PARTY_MOVE_HZ : MOVE_HZ;
  }

  private askLeave() {
    if (confirm('Leave this raid? There is no way back in.')) this.exit();
  }

  private start(m: Extract<ServerMsg, { t: 'raid_start' }>) {
    const { api, net } = this;
    const mine = api.kits.find((k) => k.name === m.you.hero);
    const others = (m.party ?? (m.partner ? [{ side: 1 - m.side, ...m.partner }] : [])).filter((p) => p.side !== m.side);
    const party = others.map((p) => ({ side: p.side, name: p.name, kit: api.kits.find((k) => k.name === p.hero) }));
    if (!mine || party.some((p) => !p.kit)) {
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
    this.party = party.map((p) => ({ side: p.side, name: p.name, kit: p.kit! }));
    this.band = m.band ?? 2;
    this.upgrades = new RunUpgrades();
    this.omensTier = 0;
    this.score = { tier: 1, bosses: 0, seconds: 0 };
    this.ui.onEnter();
  }

  /** Both walked into the same side door: the hub opens it. The Vault adds an omen, the Shrine lifts one (the hub adds its time). */
  private sideRoom(door: PathId, seconds: number) {
    const m = this.lastOffer;
    if (!this.active || !m) return;
    this.sideDone = true;
    let lifted = null;
    if (door === 'vault') {
      const more = this.omens.next();
      if (more) this.omens.add(more.id);
    } else {
      lifted = this.omens.first();
      if (lifted) this.omens.lift(lifted.id);
    }
    this.offer({ ...m, seconds }, door, lifted);
  }

  /** The hall before a fight, or a side room of it (`door`). It takes the first card when time runs out; the hub waits a little longer. */
  private offer(m: Extract<ServerMsg, { t: 'raid_offer' }>, door: PathId | null = null, lifted: ReturnType<TierOmens['first']> = null) {
    if (!this.active || !this.mine) return;
    if (!door) {
      this.lastOffer = m;
      this.sideDone = false;
    }
    if (this.omensTier !== m.tier) {
      this.omens = new TierOmens(this.match, m.tier);
      this.omensTier = m.tier;
    }
    const { api, net } = this, def = BOSSES[m.boss], run = ++this.run;
    clearInterval(this.clearTimer);
    if (api.duel.on) api.duel.stop();
    this.leave.style.display = '';
    this.loading.hide();
    if (!def) {
      this.ui.toast('This raid needs a newer page: reload');
      return;
    }
    clearInterval(this.moveTimer);
    this.link = null;
    const mine = this.mine;
    // The tier's omens: both screens roll the same ones from the match's id, and change them only on what the hub says.
    this.upgrades.omens = this.omens.list;
    const seed = `${this.match}-${this.side}-${m.tier}-${m.stage}`, depth = (m.tier - 1) * RAID_RUN.length + m.stage;
    void this.hall.enter({
      omens: this.upgrades.omens,
      doors: door ? [] : doorsFor(depth, this.omens, this.sideDone),
      title: door === 'vault' ? 'The Vault: walk onto an altar to take one more' : door === 'shrine' ? 'The Shrine: walk onto the altar' : undefined,
      noun: door === 'shrine' ? 'blessing' : undefined,
      takeDoor: (d) => {
        if (run === this.run && this.active) net.send({ t: 'raid_side', door: d });
      },
      hero: mine.name, name: this.myName, partner: this.partner ?? undefined, party: this.party.length > 1 ? this.party : undefined, side: this.side, solo: !this.party.length, next: def, tier: m.tier, seconds: m.seconds,
      seed: `${this.match}-hall`, offers: door === 'vault' ? vaultOffers(mine, this.upgrades, seed) : door === 'shrine' ? [shrineCard(lifted)] : offersFor(mine, this.upgrades, seed, depth),
      waiting: this.partner ? `Waiting for ${this.partner.name}` : this.party.length ? 'Waiting for the party' : undefined,
      pick: (u) => {
        if (run !== this.run || !this.active) return;
        if (door !== 'shrine') this.upgrades.add(u.id);
        net.send({ t: 'raid_pick' });
      },
      enter: () => {
        if (this.active) net.send({ t: 'raid_enter' });
      },
    }, (when) => this.ready(when, { mine, title: 'Noonfall', line: 'Loading the hall' })).then(() => {
      if (run !== this.run || !this.active) return;
      this.lastSent = '';
      clearInterval(this.moveTimer);
      this.moveTimer = window.setInterval(() => this.sendMove(), 1000 / this.moveHz);
      this.sendMove();
    });
  }

  /** Waits for what is loading. The loading page only shows if it takes a while, so a gate stays a gate. */
  private async ready(when: Promise<void>, page: Parameters<LoadingScreen['show']>[0]) {
    let waiting = true;
    const slow = sleep(SLOW_LOAD).then(() => {
      if (waiting) this.loading.show(page);
    });
    await when;
    waiting = false;
    void slow;
    this.loading.hide();
  }

  private async stage(m: Extract<ServerMsg, { t: 'raid_stage' }>) {
    // Twin Flames: a party fights Ash and Ember both at once, and this screen's boss is the one in its own half of the room.
    const half = m.twin?.half[this.side] === 1 ? 1 : 0, twin = m.twin && m.boss === 'ash' ? m.twin : null;
    const { api, net } = this, def = twin ? twinFlames(half) : BOSSES[m.boss], mine = this.mine;
    if (!this.active || !def || !mine) {
      if (this.active) this.ui.toast('This raid needs a newer page: reload');
      return;
    }
    const run = ++this.run;
    clearInterval(this.clearTimer);
    this.score.tier = m.tier;
    clearInterval(this.moveTimer);
    await fadeTo(true);
    if (run !== this.run || !this.active) return;
    this.hall.close();
    await nextPaint();
    if (run !== this.run || !this.active) return;
    if (api.duel.on) api.duel.stop();
    api.setKit(mine.name);
    api.setHeroMode(true);
    api.duel.holdStart = true;
    this.band = m.band ?? this.band;
    this.link = twin
      ? new NetLink(net, this.side, twin.hp[half], twin.brain[half] === this.side, twin.staggerMax)
      : new NetLink(net, this.side, m.hp, m.brain === this.side || !this.party.length, m.staggerMax);
    api.duel.startBoss({
      def, link: this.link, seed: `${this.match}-${m.tier}-${m.stage}`, mode: 'play', name: this.myName, partner: this.partner ?? undefined, party: this.party.length > 1 ? this.party : undefined, band: this.band, tier: m.tier, upgrades: this.upgrades,
      twin: twin ? { half, halves: twin.half, hp: twin.hp } : undefined,
      card: (result) => this.card(result),
    });
    this.leave.style.display = '';
    this.lastSent = this.lastBoss = '';
    this.lastHp = -1;
    clearInterval(this.moveTimer);
    this.moveTimer = window.setInterval(() => this.sendMove(), 1000 / this.moveHz);
    this.sendMove();
    await this.ready(api.duel.whenReady(), {
      mine, theirs: def.kit(m.hp), names: [this.myName, def.title], title: twin ? 'Twin Flames' : def.name, line: 'Loading the arena',
      note: [twin ? `A party of ${this.party.length + 1}, set for ${this.band}: you fight ${def.name} in the ${half ? 'east' : 'west'} half. Bring both down together` : this.party.length > 1 ? `A party of ${this.party.length + 1}: the boss is set for ${this.band}` : this.partner ? `With ${this.partner.name}, ${this.partner.kit.name}` : m.tier > 1 ? `Tier ${m.tier}: shown times ${Math.round((1 - raidTierFactor(m.tier)) * 100)} % shorter` : '', this.upgrades.omens.length ? `Omens: ${omenNames(this.upgrades.omens)}` : ''].filter(Boolean).join('. ') || undefined,
    });
    if (run !== this.run || !this.active) return;
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
      ? `Waiting for ${this.party.length > 1 ? 'the party' : this.partner?.name ?? 'your partner'}: ${left} s left.`
      : `${this.party.length > 1 ? 'All of you have' : this.partner ? 'Both of you have' : 'You have'} to go on within ${left} s, or the run ends here.`;
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
    // The hub moves the brain away from a screen it hears nothing from for 4 s: a brain standing still says so once a second.
    if (link?.brain && ts - this.pingAt >= 1000) {
      this.pingAt = ts;
      net.send({ t: 'ping' });
    }
    const foe = api.duel.bossFigure;
    if (link?.brain && foe) {
      const bx = +foe.group.position.x.toFixed(3), bz = +foe.group.position.z.toFixed(3), byaw = +foe.group.rotation.y.toFixed(3), bkey = `${bx},${bz},${byaw}`;
      if (bkey !== this.lastBoss) {
        this.lastBoss = bkey;
        net.send({ t: 'boss_move', x: bx, z: bz, yaw: byaw, ts, which: link.which });
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
    clearInterval(this.moveTimer);
    clearInterval(this.clearTimer);
    this.leave.style.display = 'none';
    const { duel } = this.api, text = `The run ends. ${scoreText(this.score)}`;
    // On the clear screen the fight is already over: only the button to go on goes.
    if (duel.boss && !duel.isOver && !duel.inHall) this.link?.on.end(m.result === 'cleared' ? 'win' : 'lose');
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
    this.hall.close();
    void fadeTo(false, 0);
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
