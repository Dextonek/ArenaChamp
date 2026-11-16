import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createRuntime } from '../runtime';
import { gameModules } from '../spells/targeted/game';
import { mountWorkbench } from './index';

/**
 * The hero workbench's own page (workbench.html): the game's spells on the shared runtime (src/runtime.ts), the drafts
 * included (src/heroes/index.ts shows them on this page), and the workbench (src/workbench/index.ts) in a lil-gui panel.
 * The same workbench opens on the tool page with `/?bench`.
 */
const rt = createRuntime({ modules: gameModules });
const gui = new GUI({ title: 'Hero workbench' });
const bench = mountWorkbench(rt, gui, { ownPanel: true });

// Start in hero mode with the training dummies: the hero stands on the floor with its reach drawn.
bench.dummies();

// For the browser checks (pipeline/tools/hero-check.py, the screenshots): the same names as the tool page's `vfx`.
(window as unknown as { vfx: unknown; bench: unknown }).vfx = {
  step: rt.step, render: rt.render, heroMode: rt.heroMode, duel: rt.duel, arena: rt.arena, setKit: rt.setKit,
  setHeroMode: rt.setHeroMode, setDuel: rt.setDuel, view: rt.view, kits: rt.kits,
};
(window as unknown as { bench: unknown }).bench = bench;
