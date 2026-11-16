import type GUI from 'three/addons/libs/lil-gui.module.min.js';
import { CPU_BALANCE, CPU_LEVELS } from '../cpuLevels';
import type { TelegraphSpec } from '../effects/telegraph';
import type { Effect, EffectModule } from '../effects/types';
import { spellDef } from '../heroes/framework/spell';
import { CARD_BY_FOLDER, DRAFT_FOLDERS } from '../heroes/index';
import type { HeroKit } from '../heroes';
import type { Runtime } from '../runtime';
import { Floor, SLOT_COLORS } from './floor';
import { Panel, type LastCast } from './panel';

/**
 * The hero workbench (docs/pipeline/hero-framework.md, section 13): pick a hero (the drafts of pipeline/tools/new-hero.py too),
 * change its numbers and its spell blocks' numbers live, fight the CPU or the training dummies, see each spell's reach and its
 * last cast's zones on the floor and its timing in a panel, and read its balance check (the command to run, and its last
 * result if one is saved).
 *
 * One entry, `mountWorkbench(rt, gui)`, on any runtime with a lil-gui panel: its own page (`/workbench.html`,
 * src/workbench/main.ts), or the tool page (`/?bench`, one line in src/tool/main.ts). It only adds: a panel folder, a layer on
 * the floor, an overlay; it chains the runtime's hooks it uses (`played`, `afterStep`, `kitChanged`) after the page's own.
 *
 * Live changes are not saved (a reload brings the files' numbers back): the overlay lists every number changed, to copy back
 * into the hero's files (`numbers.ts` for a hero made by new-hero.py, else the spell's file or the card).
 */
export interface Workbench {
  pick(name: string): void;
  fight(mode?: 'play' | 'run'): void;
  dummies(): void;
  stop(): void;
  /** The numbers changed so far, as lines to copy back. */
  readonly changes: string[];
  readonly floor: Floor;
  readonly panel: Panel;
  /** Its panel (the page's whole panel, or its folder on the tool page). */
  readonly gui: GUI;
}

type Num = { obj: Record<string, unknown>; key: string; label: string; file: string };

export function mountWorkbench(rt: Runtime, gui: GUI, opts: { ownPanel?: boolean } = {}): Workbench {
  const floor = new Floor();
  rt.scene.add(floor.group);
  const panel = new Panel();
  const drafts = new Set(DRAFT_FOLDERS.map((f) => CARD_BY_FOLDER[f].kit.name));
  const folderOf = new Map(Object.entries(CARD_BY_FOLDER).map(([f, c]) => [c.kit.name, f]));
  const changed = new Map<string, { from: number; to: number; line: string }>();
  const last: (LastCast | null)[] = [null, null, null, null];

  const kitOf = (name: string) => rt.kits.find((k) => k.name === name) ?? rt.kits[0];
  const state = {
    hero: rt.heroMode.kitName || rt.kits[0].name,
    opponent: 'random',
    level: CPU_BALANCE.name,
    reach: true,
    casts: true,
    hazards: false,
  };
  const label = (n: string) => (drafts.has(n) ? `${n} (draft)` : n);

  // its own page gives it the whole panel; on the tool page it is one folder of the tool's
  const root = opts.ownPanel ? gui : gui.addFolder('Hero workbench');
  // on a phone the panels start folded, so the fight shows (a tap on a title opens it)
  if (innerWidth < 700) root.close();
  root.add(state, 'hero', Object.fromEntries(rt.kits.map((k) => [label(k.name), k.name]))).name('hero').onChange((n: string) => pick(n));
  root.add({ f: () => fight('play') }, 'f').name('▶ fight the CPU');
  root.add({ f: () => fight('run') }, 'f').name('▶ CPU plays it, against the CPU');
  root.add({ f: () => dummies() }, 'f').name('▶ the dummies (hero mode)');
  root.add({ f: () => stop() }, 'f').name('■ stop');
  root.add(state, 'opponent', ['random', ...rt.kits.map((k) => k.name)]).name('opponent').onChange((n: string) => {
    rt.duel.opponentChoice = n;
    if (rt.duel.on) rt.duel.start(rt.duel.mode);
  });
  root.add(state, 'level', CPU_LEVELS.map((l) => l.name)).name('CPU level').onChange((n: string) => {
    rt.duel.cpuLevel = CPU_LEVELS.find((l) => l.name === n) ?? CPU_BALANCE;
  });
  root.add(state, 'hazards').name('arena hazards').onChange((v: boolean) => {
    rt.duel.hazardsOn = v;
    if (rt.duel.on) rt.duel.start(rt.duel.mode);
  });
  root.add(state, 'reach').name('reach on the floor');
  root.add(state, 'casts').name('last casts on the floor').onChange((v: boolean) => floor.showCasts(v));
  let numbers: GUI | null = null;

  function record(n: Num, from: number, to: number) {
    const key = `${n.file}|${n.label}`;
    const was = changed.get(key)?.from ?? from;
    if (Math.abs(was - to) < 1e-9) changed.delete(key);
    else changed.set(key, { from: was, to, line: `${n.file}: ${n.label} ${fmt(was)} -> ${fmt(to)}` });
    panel.changes([...changed.values()].map((c) => c.line));
  }

  /** A number in the panel that writes through to the live object, and is listed when changed. */
  function num(f: GUI, n: Num, min: number, max: number, step: number, after?: (v: number) => void) {
    const before = Number(n.obj[n.key]);
    f.add(n.obj as Record<string, number>, n.key, min, Math.max(max, before), step).name(n.label.replace(/^. /, '')).onChange((v: number) => {
      record(n, before, v);
      after?.(v);
      panel.timing(timings());
    });
  }

  /** The panel's numbers for the hero now picked: the card's, then each spell's (its blocks' numbers where it has them). */
  function buildNumbers(kit: HeroKit) {
    numbers?.destroy();
    numbers = root.addFolder(`Numbers: ${kit.name}`);
    const folder = folderOf.get(kit.name) ?? '?';
    const made = drafts.has(kit.name) ? `src/heroes/${folder}/numbers.ts` : `src/heroes/${folder}/hero.ts`;
    num(numbers, { obj: kit as unknown as Record<string, unknown>, key: 'maxHp', label: 'HP', file: `src/heroes/${folder}/hero.ts` }, 300, 1200, 10);
    kit.spells.forEach((sp, i) => {
      const f = numbers!.addFolder(`${sp.key} ${sp.name}`);
      f.domElement.style.setProperty('--title-text-color', SLOT_COLORS[i]);
      const card = sp as unknown as Record<string, unknown>;
      num(f, { obj: card, key: 'cooldown', label: `${sp.key} cooldown`, file: made }, 0, 40, 0.5);
      if (sp.range > 0) num(f, { obj: card, key: 'range', label: `${sp.key} range`, file: made }, 0, 25, 0.5);
      const module = moduleOf(sp.label);
      const def = module && spellDef(module);
      const file = drafts.has(kit.name) ? made : `src/heroes/${folder}/spells/ (${sp.label})`;
      if (def) {
        const r = def.rules as unknown as Record<string, unknown>;
        const hit = def.rules.hit as unknown as Record<string, unknown>;
        if (!def.noDamage) {
          num(f, { obj: hit, key: 'damage', label: `${sp.key} damage`, file }, 0, def.maxDamage || 200, 1, (v) => {
            // a cast made from now on starts from the rules' damage; the instance already built takes the slider's
            const e = effectOf(sp.label) as unknown as { settings?: { damage: number } } | undefined;
            if (e?.settings) e.settings.damage = v;
          });
        }
        num(f, { obj: r, key: 'windup', label: `${sp.key} wind-up (s)`, file }, 0, 3, 0.05);
        if ('delay' in r) num(f, { obj: r, key: 'delay', label: `${sp.key} delay to the impact (s)`, file }, 0, 4, 0.05);
        if ('warn' in r) num(f, { obj: r, key: 'warn', label: `${sp.key} danger zone shown at (s)`, file }, 0, 2, 0.02);
        const sh = def.rules.shape as unknown as Record<string, unknown>;
        for (const [k, lo, hi, st] of [['speed', 1, 60, 0.5], ['range', 1, 30, 0.5], ['radius', 0.1, 8, 0.05], ['length', 1, 30, 0.5],
          ['width', 0.2, 8, 0.1], ['mark', 0.2, 6, 0.1], ['inside', 0.2, 8, 0.1], ['late', 0, 1, 0.01]] as const) {
          if (typeof sh[k] === 'number') num(f, { obj: sh, key: k, label: `${sp.key} ${def.rules.shape.kind} ${k}`, file }, lo, hi, st);
        }
        if (def.rules.move) num(f, { obj: def.rules.move as unknown as Record<string, unknown>, key: 'seconds', label: `${sp.key} move (s)`, file }, 0.05, 3, 0.05);
        num(f, { obj: def as unknown as Record<string, unknown>, key: 'seconds', label: `${sp.key} length of the effect (s)`, file }, 0.2, 10, 0.1);
        const tune = def.tune as Record<string, number[]> | undefined;
        for (const k in tune) {
          const [, lo, hi, st] = tune[k];
          // a slider of the spell: the start value of every new cast (`tune`), and the one already built
          const box = { v: tune[k][0] };
          num(f, { obj: box, key: 'v', label: `${sp.key} ${k}`, file }, lo, hi, st, (v) => {
            tune[k] = [v, lo, hi, st];
            const e = effectOf(sp.label) as unknown as { settings?: Record<string, number> } | undefined;
            if (e?.settings) e.settings[k] = v;
          });
        }
        if (def.rules.shape.kind === 'zone' || def.rules.shape.kind === 'circle') {
          f.add({ note: 'its area: in the file' }, 'note').name(`${def.rules.shape.kind} shape`).disable();
        }
      } else if (module) {
        // a spell written as its own code: its own sliders, on the instance (a recast while it still plays makes a fresh one)
        const e = effectOf(sp.label, true);
        if (e) module.buildGui(f, e);
        f.add({ note: 'own code: its sliders' }, 'note').name('not on the blocks').disable();
      }
      f.close();
    });
    panel.timing(timings());
  }

  function moduleOf(labelName: string): EffectModule | undefined {
    return rt.slots.get(labelName)?.module;
  }

  function effectOf(labelName: string, build = false): Effect | undefined {
    const slot = rt.slots.get(labelName);
    if (!slot) return undefined;
    return build ? rt.ensureEffect(slot) : slot.effect;
  }

  /** Each slot's timing: from its last cast's zones, else (a spell on the blocks) from its rules. */
  function timings() {
    const kit = rt.heroMode.currentKit ?? kitOf(state.hero);
    return kit.spells.map((sp, i) => {
      const def = moduleOf(sp.label) && spellDef(moduleOf(sp.label)!);
      const r = def?.rules;
      const impact = r ? r.windup + (r.shape.kind === 'circle' || r.shape.kind === 'target' || r.shape.kind === 'zone' ? r.delay ?? 0 : 0) : undefined;
      return {
        key: sp.key, name: sp.name, color: SLOT_COLORS[i], cooldown: sp.cooldown, range: sp.range,
        windup: r?.windup, impact, length: def?.seconds, blocks: !!def, shape: r?.shape.kind, last: last[i],
      };
    });
  }

  function pick(name: string) {
    state.hero = name;
    rt.setKit(name);
    last.fill(null);
    floor.clearCasts();
    const kit = kitOf(name);
    buildNumbers(kit);
    panel.hero(kit.name, drafts.has(kit.name), folderOf.get(kit.name) ?? '');
    root.controllersRecursive().forEach((c) => c.updateDisplay());
  }

  function fight(mode: 'play' | 'run' = 'play') {
    rt.duel.opponentChoice = state.opponent;
    rt.duel.cpuLevel = CPU_LEVELS.find((l) => l.name === state.level) ?? CPU_BALANCE;
    rt.duel.hazardsOn = state.hazards;
    rt.setDuel(true, mode);
  }

  function dummies() {
    if (rt.duel.on) rt.setDuel(false);
    rt.setHeroMode(true);
  }

  function stop() {
    if (rt.duel.on) rt.setDuel(false);
    rt.setHeroMode(false);
  }

  // --- the runtime's hooks, chained after the page's own ---------------------------------------------------------
  const h = rt.hooks;
  const played = h.played, afterStep = h.afterStep, kitChanged = h.kitChanged;
  h.played = (slot) => {
    played?.(slot);
    const kit = rt.heroMode.currentKit;
    const i = kit?.spells.findIndex((s) => s.label === slot.module.label) ?? -1;
    if (i < 0 || !rt.heroMode.enabled) return;
    const zones: TelegraphSpec[] = rt.zones.map((z) => ({ ...z, shape: { ...z.shape } }));
    const e = slot.effect as (Effect & { duration?: number }) | undefined;
    last[i] = { zones, length: e?.duration ?? null, at: performance.now() };
    floor.lastCast(i, zones);
    panel.timing(timings());
  };
  h.afterStep = (dt) => {
    afterStep?.(dt);
    const kit = rt.heroMode.enabled ? rt.heroMode.currentKit : null;
    floor.reach(rt.arena.caster.group.position, kit ? kit.spells.map((s) => s.range) : [], state.reach && !!kit);
    const a = rt.active;
    const i = kit && a ? kit.spells.findIndex((s) => s.label === a.module.label) : -1;
    panel.now(i, a?.effect?.playing ? rt.effectClock : -1);
  };
  h.kitChanged = (name) => {
    kitChanged?.(name);
    if (name !== state.hero && rt.kits.some((k) => k.name === name)) {
      state.hero = name;
      buildNumbers(kitOf(name));
      panel.hero(name, drafts.has(name), folderOf.get(name) ?? '');
      root.controllersRecursive().forEach((c) => c.updateDisplay());
    }
  };

  const first = kitOf(state.hero);
  buildNumbers(first);
  panel.hero(first.name, drafts.has(first.name), folderOf.get(first.name) ?? '');

  return {
    pick, fight, dummies, stop, floor, panel, gui: root,
    get changes() { return [...changed.values()].map((c) => c.line); },
  };
}

function fmt(v: number) {
  return Number.isInteger(v) ? String(v) : String(+v.toFixed(3));
}
