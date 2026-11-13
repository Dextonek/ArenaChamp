import * as THREE from 'three';
import { HeroFigure } from '../../heroFigure';
import type { ZoneCtx } from './ctx';
import type { PersonDef, Spot } from './def';
import type { CardButton, Mark } from './hud';
import type { Quests } from './quests';
import { BOONS, boonsFor, type Boon } from '../boons';

/**
 * The people of a floor, as the roster's own hero models standing where the floor's data puts them (the keeper, the one with the
 * side quests, the trader, and the rival), marks over their heads that say who has something for you, and the card that opens when
 * the hero walks up (or a mark is tapped and the hero walks there). The card has a few lines and buttons: take a quest, hand it in,
 * buy, race. Plain page elements, 44 px buttons, so it works with a thumb on a phone.
 */

/** How near the hero must be for a card to open by itself (m), and how far it must go before the same card opens again. */
const TALK = 3.4, LEAVE = 7;

export class People {
  private figs = new Map<string, { fig: HeroFigure; pos: THREE.Vector3; yaw: number; posed: number }>();
  private opened = new Set<string>();
  private walking: string | null = null;
  private race: { t: number; route: Spot[]; len: number; speed: number } | null = null;
  private raceFig: { fig: HeroFigure; pos: THREE.Vector3; yaw: number; posed: number } | null = null;
  private t = 0;
  /** The cards the hero closed by walking away: nothing to do, they just go. */
  onShop: (what: 'heal' | 'boon' | 'life' | 'hint') => void = () => {};

  constructor(private z: ZoneCtx, private q: Quests) {
    for (const p of z.def.people) {
      const kit = z.api.kits.find((k) => k.name === p.hero);
      const fig = new HeroFigure();
      z.p.group.add(fig.group);
      const pos = new THREE.Vector3(p.at.x, 0, p.at.z);
      if (kit) {
        fig.setModel(kit.model, pos, kit);
        fig.stand();
      }
      // Out of sight until its model has loaded and been posed a few frames (a model that is still loading stands in a T-pose).
      fig.group.visible = false;
      this.figs.set(p.id, { fig, pos, yaw: p.face, posed: 0 });
      // A tap on the figure's own mark walks the hero there; the card opens on arrival.
    }
  }

  get raceOn() {
    return !!this.race;
  }

  /**
   * The route bot's talk: what a person does for a hero who walked up with a plan, with no card: hand in what is done, take what is
   * on offer, race, and buy what the hero needs. Returns what it did.
   */
  auto(id: string): string[] {
    const z = this.z, run = z.run, p = z.def.people.find((x) => x.id === id);
    const did: string[] = [];
    if (!p) return did;
    if (p.role === 'trader') {
      const s = z.def.shop, d = z.api.duel;
      const buy = (what: 'heal' | 'boon' | 'life', price: number, want: boolean) => { if (want && run.shards >= price) { run.shards -= price; this.onShop(what); did.push(what); } };
      buy('heal', s.heal, d.heroHp < d.heroMax * 0.6);
      buy('life', s.life, run.lives < 3);
      buy('boon', s.boon, !run.bought.includes('boon') && run.shards >= s.boon + 20);
      z.save();
    } else if (p.role === 'rival') {
      if (run.rival === 'none' && z.def.rival.mode === 'race') { this.startRace(); did.push('race'); }
    } else {
      for (const { q, st } of this.available(p)) {
        if (st.done && !st.handedIn) { this.q.handIn(q.id); did.push(`hand-in:${q.id}`); }
        else if (!st.taken) { this.q.take(q.id); did.push(`take:${q.id}`); }
      }
    }
    return did;
  }

  /** The hero asks for a card now (the tool's, and a tap on a mark when already near). */
  talk(id: string) {
    const p = this.z.def.people.find((x) => x.id === id);
    if (p) this.openCard(p);
  }

  /** Walk to a person: the card opens when the hero arrives. */
  goTo(id: string) {
    const p = this.z.def.people.find((x) => x.id === id);
    if (!p) return;
    if (Math.hypot(this.z.hero.x - p.at.x, this.z.hero.z - p.at.z) < TALK + 0.6) { this.openCard(p); return; }
    this.walking = id;
    this.z.api.heroMode.walkTo(p.at.x + Math.sin(p.face) * 1.6, p.at.z + Math.cos(p.face) * 1.6);
  }

  // --- what a person has for you ---------------------------------------------------------------------------------------

  private available(p: PersonDef) {
    const z = this.z;
    return z.def.quests.filter((q) => q.giver === p.id).map((q) => ({ q, st: z.run.q(q.id) }));
  }

  /** The glyph over a person's head. */
  private glyph(p: PersonDef): { glyph: string; tone: string } {
    const z = this.z;
    if (p.role === 'trader') return { glyph: '◆', tone: '#8cc4ff' };
    if (p.role === 'rival') return z.run.rival === 'none' ? { glyph: z.def.rival.mode === 'duel' ? '⚔' : '»', tone: '#ff9a8a' } : { glyph: '·', tone: '#a89870' };
    const qs = this.available(p);
    if (qs.some(({ st }) => st.done && !st.handedIn)) return { glyph: '?', tone: '#9df0b4' };
    if (qs.some(({ st }) => !st.taken)) return { glyph: '!', tone: '#ffd27a' };
    return { glyph: '…', tone: '#a89870' };
  }

  private openCard(p: PersonDef) {
    const z = this.z, hud = z.hud, run = z.run;
    const buttons: CardButton[] = [];
    let lines = [...p.greet];
    const reopen = () => this.openCard(p);
    if (p.role === 'trader') {
      const s = z.def.shop;
      lines = [p.greet[0], `You have ${run.shards} shards.`];
      const buy = (what: 'heal' | 'boon' | 'life' | 'hint', price: number, ok: () => boolean, label: string, sub: string, tone: CardButton['tone']) =>
        buttons.push({ label: `${label} · ${price}`, sub, off: run.shards < price || !ok(), tone, click: () => { if (run.shards < price) return; run.shards -= price; this.onShop(what); z.save(); reopen(); } });
      buy('heal', s.heal, () => z.api.duel.heroHp < z.api.duel.heroMax, 'A heal', 'Restore 35 % of your health', 'green');
      buy('boon', s.boon, () => !run.bought.includes('boon'), 'A boon', 'One of three shown, once on this floor', 'gold');
      buy('life', s.life, () => run.lives < 3, 'A life back', 'Up to three', 'red');
      buy('hint', s.hint, () => z.def.caches.some((c) => !run.caches.includes(c.id) && !run.hintShown.includes(c.id)), 'A hint', 'Shows where a cache lies', 'blue');
    } else if (p.role === 'rival') {
      lines = [...(z.def.rival.lines)];
      if (run.rival === 'none' && z.def.rival.mode === 'race') buttons.push({ label: 'Race', sub: `To ${z.def.rival.goal}. First there wins a boon`, tone: 'red', click: () => { hud.closeCard(); this.startRace(); } });
      else if (run.rival !== 'none') lines = [run.rival === 'won' ? 'You beat me. Fair enough. Take my luck with you.' : run.rival === 'lost' ? (z.def.rival.mode === 'duel' ? 'You lost, and so you will not see me again. Try again on the next floor.' : 'Too slow. Try again on the next floor.') : 'On your marks.'];
    } else {
      const qs = this.available(p);
      const mine = qs.filter(({ st }) => st.taken && !st.handedIn);
      const first = qs.every(({ st }) => !st.taken);
      if (!first && !qs.some(({ st }) => !st.taken)) lines = [mine.length ? 'Still at it? Come back when it is done.' : 'That is all I have for you.'];
      for (const { q, st } of qs) {
        if (st.done && !st.handedIn) {
          lines = [...q.outro];
          buttons.push({ label: `Hand in: ${q.name}`, sub: `${q.reward.shards} shards${q.reward.boon ? ' and a boon' : ''}${q.reward.relic ? ' and a relic' : ''}`, tone: 'green', click: () => { this.q.handIn(q.id); hud.closeCard(); } });
        } else if (!st.taken) {
          lines = [...lines.slice(0, first ? 1 : 0), q.intro[0]];
          buttons.push({ label: `Take: ${q.name}`, sub: q.steps.map((s) => s.text).join(' · '), tone: q.main ? 'gold' : 'blue', click: () => { this.q.take(q.id); hud.closeCard(); } });
        }
      }
      // The keeper steps you back to a waystone you touched.
      if (p.role === 'keeper') {
        for (const w of z.def.waystones.filter((x) => run.waystones.includes(x.id))) {
          buttons.push({ label: `Step to: ${w.name}`, sub: 'From the camp only', tone: 'blue', off: Math.hypot(z.hero.x - z.def.camp.x, z.hero.z - z.def.camp.z) > 16, click: () => { this.stepTo(w.at); hud.closeCard(); } });
        }
      }
    }
    hud.openCard({ for: p.id, name: p.name, role: p.role === 'keeper' ? 'Keeper' : p.role === 'giver' ? 'Quests' : p.role === 'trader' ? 'Trader' : 'Rival', lines, buttons });
  }

  /** The waystone step: the hero stands there at once. */
  stepTo(at: Spot) {
    const z = this.z;
    z.hero.set(at.x + 1.5, 0, at.z);
    z.api.heroMode.halt();
    z.api.heroMode.snapCameraNow();
    z.p.show.ring(at.x, at.z, { radius: 4, life: 0.8, color: 0x6ec8ff, width: 0.6, peak: 0.6 });
  }

  // --- the race --------------------------------------------------------------------------------------------------------

  startRace() {
    const z = this.z, r = z.def.rival;
    if (!r.route || z.run.rival !== 'none') return;
    let len = 0;
    for (let i = 1; i < r.route.length; i++) len += Math.hypot(r.route[i].x - r.route[i - 1].x, r.route[i].z - r.route[i - 1].z);
    const base = z.def.people.find((x) => x.role === 'rival');
    const fig = base ? this.figs.get(base.id) : undefined;
    if (!fig) return;
    this.raceFig = fig;
    this.race = { t: 0, route: r.route, len, speed: 4 * (r.pace ?? 0.92) };
    z.run.rival = 'running';
    z.banner('Race!', `To ${r.goal}: first there wins`, 2.6);
    z.save();
  }

  private raceUpdate(dt: number) {
    const z = this.z, r = z.def.rival, R = this.race!, f = this.raceFig!;
    R.t += dt;
    let d = R.t * R.speed;
    const done = d >= R.len;
    d = Math.min(d, R.len);
    let i = 1, acc = 0;
    while (i < R.route.length - 1 && acc + Math.hypot(R.route[i].x - R.route[i - 1].x, R.route[i].z - R.route[i - 1].z) < d) {
      acc += Math.hypot(R.route[i].x - R.route[i - 1].x, R.route[i].z - R.route[i - 1].z);
      i++;
    }
    const a = R.route[i - 1], b = R.route[i], seg = Math.hypot(b.x - a.x, b.z - a.z) || 1, k = Math.min(1, (d - acc) / seg);
    f.pos.set(a.x + (b.x - a.x) * k, 0, a.z + (b.z - a.z) * k);
    f.yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const heroNear = Math.hypot(z.hero.x - r.to!.x, z.hero.z - r.to!.z) < (r.r ?? 3);
    if (heroNear) {
      this.finishRace('won');
    } else if (done) {
      this.finishRace('lost');
    }
  }

  private finishRace(result: 'won' | 'lost') {
    const z = this.z, r = z.def.rival;
    this.race = null;
    z.run.rival = result;
    if (result === 'won') {
      // The one beaten fights beside the hero against the ruler.
      z.run.ally = r.hero;
      z.banner('You win the race', `${r.hero} is beaten: a boon`, 3);
      if (r.boon) z.offerBoon(`${r.hero}'s boon`);
      z.pay(15);
    } else z.banner(`${r.hero} was first`, 'Too slow. Nothing gained, nothing lost', 3);
    z.save();
  }

  // --- each frame ------------------------------------------------------------------------------------------------------

  update(dt: number) {
    const z = this.z, hero = z.hero;
    this.t += dt;
    if (this.race) this.raceUpdate(dt);
    const marks: Mark[] = [];
    for (const p of z.def.people) {
      const f = this.figs.get(p.id)!;
      const racing = this.race && this.raceFig === f;
      // A person turns to face the hero a little when it is near.
      const near = Math.hypot(hero.x - f.pos.x, hero.z - f.pos.z);
      if (!racing && near < 9) {
        const want = Math.atan2(hero.x - f.pos.x, hero.z - f.pos.z);
        let d = want - f.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        f.yaw += d * Math.min(1, dt * 3);
      }
      f.fig.follow(dt, f.pos, f.yaw);
      if (f.posed < 3 && f.fig.loaded && ++f.posed >= 3) f.fig.group.visible = true;
      const g = this.glyph(p), head = z.project(f.pos.x, 3.0, f.pos.z);
      marks.push({ id: p.id, glyph: g.glyph, label: p.name, tone: g.tone, x: head.x, y: head.y, show: !head.behind && near < 60, click: () => this.goTo(p.id) });
      // Walking up opens the card (a person climbing, not the autopilot).
      if (z.mode === 'play') {
        if (near < TALK && !this.opened.has(p.id) && !z.hud.cardOpen && !z.hud.cardsOpen) {
          this.opened.add(p.id);
          if (this.walking === p.id) this.walking = null;
          this.openCard(p);
        } else if (near > LEAVE) {
          this.opened.delete(p.id);
          if (z.hud.cardFor === p.id) z.hud.closeCard();
        }
      }
    }
    z.hud.setMarks(marks);
  }

  dispose() {
    for (const f of this.figs.values()) f.fig.group.removeFromParent();
    this.figs.clear();
    this.z.hud.clearMarks();
    this.z.hud.closeCard();
  }
}

export { BOONS, boonsFor };
export type { Boon };
