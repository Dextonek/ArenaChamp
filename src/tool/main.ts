import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { Emitter, type EmitterSettings } from '../emitter';
import { presets, presetNames, presetSettings } from '../presets';
import { effectModules } from '../effects';
import { HERO_KITS } from '../heroes';
import { meleeTestKit, rangedTestKit, summonTestKit } from '../kits/test';
import { createRuntime, type EffectSlot } from '../runtime';
import { CPU_BALANCE, CPU_LEVELS } from '../cpuLevels';
import { PlayerDummy } from './player';
import { Hotbar } from './hotbar';

/**
 * The VFX tool (index.html): every effect in the panel, the particle editor with its presets, play mode (walk the
 * caster with WASD, cast from the hotbar), the dodge dummy, hero mode and duels for testing kits, and the `vfx`
 * console hook. It runs on the shared runtime (src/runtime.ts), the same scene the duel game (src/game/) uses.
 */
const rt = createRuntime({ modules: effectModules, heroCycle: true });
const { scene, camera, controls, renderer, arena, heroMode, duel, telegraphs, slots, bloom } = rt;

const grid = new THREE.GridHelper(10, 20, 0x2a3040, 0x1a1e28);
scene.add(grid);

const initialPreset = 'fire';
const emitter = new Emitter(presetSettings(initialPreset));
scene.add(emitter.points);
rt.pixelScale(emitter);
Object.assign(bloom, presets[initialPreset].bloom);
rt.state.idleBloom = presets[initialPreset].bloom;
rt.applyBloom();

// The dodge dummy: a player figure that has to walk out of the danger zones.
const player = new PlayerDummy(camera);
scene.add(player.group);

// --- Controls panel ---------------------------------------------------------
const view = Object.assign(rt.view, { showGrid: false, restart: () => emitter.clear() });
const s: EmitterSettings = emitter.settings;
const gui = new GUI({ title: 'VFX Tool' });
const refreshPanel = () => gui.controllersRecursive().forEach((c) => c.updateDisplay());

const mode = { name: 'particles' };
const preset = { name: initialPreset };

// Category → modes. 'particles' lives with the set pieces.
const DEFAULT_CATEGORY = 'set pieces';
const categories = new Map<string, string[]>([[DEFAULT_CATEGORY, ['particles']]]);
for (const m of effectModules) {
  const c = m.category ?? DEFAULT_CATEGORY;
  if (!categories.has(c)) categories.set(c, []);
  categories.get(c)!.push(m.label);
}
const category = { name: DEFAULT_CATEGORY };
const categoryCtrl = gui.add(category, 'name', [...categories.keys()]).name('category').onChange((c: string) => {
  const modes = categories.get(c)!;
  // options() replaces the controller with a new one.
  setModeOptions(modes);
  mode.name = modes[0];
  setMode();
});
type ModeCtrl = { options(o: string[]): ModeCtrl; name(n: string): ModeCtrl; onChange(f: () => void): ModeCtrl; domElement: HTMLElement };
let modeCtrl: ModeCtrl = gui.add(mode, 'name', categories.get(DEFAULT_CATEGORY)!).name('mode').onChange(() => setMode());
/** Swaps the mode list. options() rebuilds the controller at the end of the panel, so move it back under category. */
function setModeOptions(modes: string[]) {
  modeCtrl = modeCtrl.options(modes).name('mode').onChange(() => setMode());
  categoryCtrl.domElement.after(modeCtrl.domElement);
}
const presetCtrl = gui.add(preset, 'name', presetNames).name('preset').onChange((name: string) => {
  Object.assign(s, presetSettings(name));
  Object.assign(bloom, presets[name].bloom);
  rt.state.idleBloom = presets[name].bloom;
  emitter.applyStyle();
  emitter.clear();
  rt.applyBloom();
  refreshPanel();
});

const fView = gui.addFolder('View');
fView.add(view, 'paused');
fView.add(view, 'timeScale', 0, 3, 0.01).name('time scale');
fView.add(view, 'showGrid').name('grid').onChange((v: boolean) => (grid.visible = v && mode.name === 'particles'));
fView.add(view, 'restart');
const gameplay = { zones: true, player: false };
fView.add(rt.state, 'playMode').name('play mode (P)').onChange((v: boolean) => {
  if (!v && heroMode.enabled) rt.setHeroMode(false);
  else setPlayMode(v);
});
const heroState = { on: false };
const heroCtrl = fView.add(heroState, 'on').name('hero mode (H)').onChange((v: boolean) => rt.setHeroMode(v));
const heroPick = { hero: HERO_KITS[0].name };
const heroPickCtrl = fView.add(heroPick, 'hero', HERO_KITS.map((k) => k.name)).name('hero').onChange((name: string) => rt.setKit(name));
const duelState = { opponent: 'random' };
fView.add({ play: () => setDuel(true, 'play') }, 'play').name('▶ play duel (B)');
fView.add({ run: () => setDuel(true, 'run') }, 'run').name('▶ run duel, AI vs AI (N)');
fView.add({ leave: () => setDuel(false) }, 'leave').name('leave duel');
fView.add(duelState, 'opponent', ['random', ...HERO_KITS.map((k) => k.name)]).name('opponent').onChange((n: string) => {
  duel.opponentChoice = n;
  if (duel.on) duel.start();
});
// The opponent's CPU level (src/cpuLevels.ts); a run duel's autopilot always plays Normal.
const levelState = { level: duel.cpuLevel.name };
fView.add(levelState, 'level', CPU_LEVELS.map((l) => l.name)).name('CPU level').onChange((n: string) => {
  duel.cpuLevel = CPU_LEVELS.find((l) => l.name === n) ?? CPU_BALANCE;
});
fView.add(duel, 'hazardsOn').name('arena hazards').onChange(() => {
  if (duel.on) duel.start();
});
fView.add(gameplay, 'zones').name('danger zones').onChange((v: boolean) => (telegraphs.group.visible = v));
fView.add(gameplay, 'player').name('player dummy (WASD)').onChange((v: boolean) => {
  if (v && rt.state.playMode) setPlayMode(false);
  player.setEnabled(v);
});

const fArena = gui.addFolder('Targets');
const arenaOpts = { count: arena.count };
fArena.add(arenaOpts, 'count', 1, 10, 1).name('enemies').onFinishChange((n: number) => { arena.setCount(n); rt.active?.effect?.play(); });
fArena.add({ shuffle: () => { arena.shuffle(); rt.active?.effect?.play(); } }, 'shuffle');
fArena.add({ clear: () => { arena.clearSelection(); rt.active?.effect?.play(); } }, 'clear').name('clear selection');
fArena.show(false);

const fBloom = gui.addFolder('Bloom');
fBloom.add(bloom, 'enabled').onChange(rt.applyBloom);
fBloom.add(bloom, 'strength', 0, 3, 0.01).onChange(rt.applyBloom);
fBloom.add(bloom, 'radius', 0, 1, 0.01).onChange(rt.applyBloom);
fBloom.add(bloom, 'threshold', 0, 1, 0.01).onChange(rt.applyBloom);

const style = () => emitter.applyStyle();
const fEmit = gui.addFolder('Emission');
fEmit.add(s, 'rate', 0, 3000, 1);
fEmit.add(s, 'maxParticles', 100, 50000, 100).name('max particles').onFinishChange(style);
fEmit.add(s, 'lifetime', 0.05, 15, 0.01);
fEmit.add(s, 'lifetimeJitter', 0, 1, 0.01).name('lifetime jitter');
fEmit.add(s, 'shape', ['point', 'sphere', 'box', 'cone']);
fEmit.add(s, 'shapeSize', 0, 5, 0.01).name('shape size');
fEmit.add(s, 'originY', -2, 10, 0.01).name('height');

const fMotion = gui.addFolder('Motion');
fMotion.add(s, 'speed', 0, 20, 0.01);
fMotion.add(s, 'speedJitter', 0, 1, 0.01).name('speed jitter');
fMotion.add(s, 'spread', 0, 180, 1).name('spread °');
fMotion.add(s, 'gravity', -10, 10, 0.01);
fMotion.add(s, 'drag', 0, 5, 0.01);

const fLook = gui.addFolder('Appearance');
fLook.add(s, 'sizeStart', 0, 3, 0.01).name('size start').onChange(style);
fLook.add(s, 'sizeEnd', 0, 3, 0.01).name('size end').onChange(style);
fLook.addColor(s, 'colorStart').name('color start').onChange(style);
fLook.addColor(s, 'colorEnd').name('color end').onChange(style);
fLook.add(s, 'opacityStart', 0, 1, 0.01).name('opacity start').onChange(style);
fLook.add(s, 'opacityEnd', 0, 1, 0.01).name('opacity end').onChange(style);
fLook.add(s, 'additive').onChange(style);

// --- The panel follows the runtime ---------------------------------------------------------------------------
/** Each built effect's panel folder (▶ play, frame camera, and the effect's own settings). */
const folders = new Map<EffectSlot, GUI>();
rt.hooks.effectBuilt = (slot, effect) => {
  const folder = gui.addFolder(slot.module.label);
  folder.add({ play: () => effect.play() }, 'play').name('▶ play');
  folder.add({ frame: () => slot.module.frameCamera(camera, controls, effect) }, 'frame').name('frame camera');
  slot.module.buildGui(folder, effect);
  folders.set(slot, folder);
};
rt.hooks.effectDropped = (slot) => {
  folders.get(slot)?.destroy();
  folders.delete(slot);
};
rt.hooks.selecting = (slot) => {
  category.name = slot.module.category ?? DEFAULT_CATEGORY;
  setModeOptions(categories.get(category.name)!);
  mode.name = slot.module.label;
};
rt.hooks.activated = (next, phase) => {
  if (phase === 'switch') {
    for (const f of folders.values()) f.show(false);
    const isParticles = !next;
    emitter.points.visible = isParticles;
    grid.visible = isParticles && view.showGrid;
    presetCtrl.show(isParticles);
    for (const f of [fEmit, fMotion, fLook]) f.show(isParticles);
    fArena.show(!!next?.module.targeting || rt.state.playMode);
    return;
  }
  if (next?.effect?.group.visible) folders.get(next)?.show(true);
  refreshPanel();
};
rt.hooks.played = () => player.onPlay();
rt.hooks.heroMode = (on) => {
  heroState.on = on;
  heroCtrl.updateDisplay();
  if (on) {
    hotbar.setVisible(false);
    fBloom.controllers.forEach((c) => c.updateDisplay());
  }
};
rt.hooks.kitChanged = (name) => {
  heroPick.hero = name;
  heroPickCtrl.updateDisplay();
};
rt.hooks.resized = () => rt.pixelScale(emitter);

/** The mode dropdown's choice ('particles' = the particle editor, no effect active). */
function setMode() {
  rt.activate(mode.name);
}

/** Selects an effect by label from any category (keeps the category / mode dropdowns in sync) and plays it. */
function selectMode(label: string) {
  rt.selectEffect(label);
}

/** A duel with the opponent chosen in the panel. */
function setDuel(on: boolean, m: 'play' | 'run' = 'play') {
  if (on) duel.opponentChoice = duelState.opponent;
  rt.setDuel(on, m);
}

setMode();

// Space replays the active effect; 1–5 cast the hotbar slots; P toggles play mode.
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.code === 'Space' && rt.active?.effect) {
    e.preventDefault();
    rt.active.effect.play();
  }
  const digit = /^Digit([1-5])$/.exec(e.code);
  if (digit && !e.repeat && !heroMode.enabled) hotbar.cast(Number(digit[1]) - 1);
  if (e.code === 'KeyP' && !e.repeat) {
    if (heroMode.enabled) rt.setHeroMode(false);
    else setPlayMode(!rt.state.playMode);
  }
  if (e.code === 'KeyH' && !e.repeat) rt.setHeroMode(!heroMode.enabled);
  if (e.code === 'KeyB' && !e.repeat) setDuel(!(duel.on && duel.mode === 'play'), 'play');
  if (e.code === 'KeyN' && !e.repeat) setDuel(!(duel.on && duel.mode === 'run'), 'run');
});

// --- Play mode: walk the caster with WASD, orbit with mouse drag, cast from the hotbar ---------------------
const hotbar = new Hotbar(
  [...categories.entries()].map(([c, labels]) => ({ category: c, labels: labels.filter((l) => l !== 'particles') })),
  ['tempest lattice', 'gale bullet', 'cinder bow', 'ember comet', 'starbreaker lance'],
  (label) => {
    if (!rt.state.playMode) setPlayMode(true);
    selectMode(label);
  },
);
hotbar.setVisible(false);
const walkKeys = new Set<string>();
const WALK_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
window.addEventListener('keydown', (e) => {
  if (!rt.state.playMode || heroMode.enabled || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const k = e.key.toLowerCase();
  if (WALK_KEYS.includes(k)) { walkKeys.add(k); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => walkKeys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => walkKeys.clear());

const lastCaster = new THREE.Vector3();
rt.hooks.playMode = (on) => {
  hotbar.setVisible(on);
  walkKeys.clear();
  // The blue dodge dummy also listens to WASD; one walker at a time.
  if (on) {
    gameplay.player = false;
    player.setEnabled(false);
  }
  lastCaster.copy(arena.caster.group.position);
};

function setPlayMode(on: boolean) {
  rt.setPlayMode(on);
}

const walkSpeed = 9;
function walk(dt: number) {
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const move = new THREE.Vector3();
  if (walkKeys.has('w') || walkKeys.has('arrowup')) move.add(fwd);
  if (walkKeys.has('s') || walkKeys.has('arrowdown')) move.sub(fwd);
  if (walkKeys.has('d') || walkKeys.has('arrowright')) move.add(right);
  if (walkKeys.has('a') || walkKeys.has('arrowleft')) move.sub(right);
  if (move.lengthSq() > 0) arena.walk(move.normalize().multiplyScalar(walkSpeed * dt));
  // Camera follows the caster; mouse drag still orbits around it.
  const c = arena.caster.group.position;
  const d = new THREE.Vector3(c.x - lastCaster.x, 0, c.z - lastCaster.z);
  camera.position.add(d);
  controls.target.add(d);
  lastCaster.set(c.x, 0, c.z);
}

rt.hooks.beforeStep = (dt) => { if (!rt.active) emitter.update(dt); };
rt.hooks.walkStep = (dt) => { if (rt.state.playMode && !heroMode.enabled) walk(dt); };
rt.hooks.afterStep = (dt) => player.update(dt, rt.effectClock, rt.zones);

// --- Stats overlay ----------------------------------------------------------
const stats = document.createElement('div');
stats.style.cssText = 'position:fixed;left:10px;bottom:10px;font:12px ui-monospace,monospace;color:#8b93a7;pointer-events:none';
document.body.appendChild(stats);
let fpsFrames = 0, fpsTime = 0, fps = 0;
rt.hooks.frame = (rawDt) => {
  const active = rt.active;
  const dur = (active?.effect as { duration?: number } | undefined)?.duration;
  hotbar.setProgress(rt.state.playMode && dur && active?.effect?.playing ? rt.effectClock / dur : null);
  fpsFrames++; fpsTime += rawDt;
  if (fpsTime < 0.5) return;
  fps = Math.round(fpsFrames / fpsTime);
  fpsFrames = 0; fpsTime = 0;
  stats.style.color = active?.error ? '#ff7a6b' : '#8b93a7';
  stats.textContent = !active
    ? `${fps} fps · ${emitter.aliveCount} particles`
    : active.error
      ? `${active.module.label} failed to build: ${active.error}`
      : duel.on && duel.mode === 'run'
        ? `${fps} fps · run duel (AI vs AI) · ${heroMode.kitName} vs the opponent · N leave · Rematch on the card`
      : duel.on
        ? `${fps} fps · play duel · click ground = move · Q W E R = aim, click = cast · walk out of the red zones to dodge · B leave`
      : heroMode.enabled
        ? `${fps} fps · hero mode · ${active.module.label} · click ground = move · Q W E R = aim, click = cast · wheel = zoom · H exit · hits ${arena.hits} · kills ${arena.kills}`
      : rt.state.playMode
        ? `${fps} fps · ${active.module.label} · WASD walk · drag = camera · 1–5 cast · click enemy / ground to target · P exit · hits ${arena.hits} · kills ${arena.kills}`
        : `${fps} fps · ${active.module.label} · space = replay · P = play mode` +
        (active.module.targeting ? ` · click enemy / ground to target (shift = add) · hits ${arena.hits} · kills ${arena.kills}` : '') +
        (player.enabled ? ` · WASD to move · hits ${player.hits} · dodges ${player.dodges}` : '');
};

// --- Debug hooks for the console and the automated browser checks ----------------------------------------
// vfx.mode.name = '<label>'; vfx.setMode(); then vfx.step(1/60) + vfx.render() to scrub.
const _m = new THREE.Matrix4();
/**
 * True when a visible lit mesh (or one of its instances) has a zero-scale matrix. Its normals become NaN, and
 * bloom spreads that NaN over the whole frame, which turns black.
 */
function hasSingularLitMatrix(root: THREE.Object3D): boolean {
  let found = false;
  root.traverseVisible((o) => {
    if (found || !(o instanceof THREE.Mesh)) return;
    const mat = o.material as THREE.Material;
    if (!(mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial || mat instanceof THREE.MeshLambertMaterial)) return;
    if (Math.abs(o.matrixWorld.determinant()) < 1e-15) { found = true; return; }
    if (o instanceof THREE.InstancedMesh) {
      for (let i = 0; i < o.count && !found; i++) {
        o.getMatrixAt(i, _m);
        if (Math.abs(_m.determinant()) < 1e-15) found = true;
      }
    }
  });
  return found;
}

/** Restarts the active effect and steps it to `t` seconds at 60 fps, then renders (for screenshots). */
function scrub(t: number) {
  view.paused = true;
  rt.active?.effect?.play();
  for (let i = 0; i < Math.round(t * 60); i++) rt.step(1 / 60);
  rt.render();
}

/**
 * Automated check used by the forge-vfx pipeline: plays `label` paused at 60 fps for `seconds`, and reports
 * build/runtime errors, frames with non-finite transforms, peak shake, zones and arena hits.
 */
function selfTest(label: string, seconds = 6) {
  const errors: string[] = [];
  // Shader compile errors only reach the console; collect them while this test renders.
  const prevShaderError = renderer.debug.onShaderError;
  renderer.debug.onShaderError = (gl, _program, vs, fs) => {
    const log = `${gl.getShaderInfoLog(fs) ?? ''}\n${gl.getShaderInfoLog(vs) ?? ''}`;
    errors.push(`shader compile error: ${log.split('\n').find((l) => l.includes('ERROR')) ?? log.trim()}`);
  };
  let nanFrames = 0, maxShake = 0, frames = 0, singularFrames = 0;
  const hits0 = arena.hits;
  try { selectMode(label); } catch (e) { errors.push(String(e)); }
  if (rt.active?.error) errors.push(rt.active.error);
  const effect = rt.active?.effect;
  if (effect) {
    view.paused = true;
    try {
      effect.play();
      for (; frames < seconds * 60; frames++) {
        rt.step(1 / 60);
        maxShake = Math.max(maxShake, effect.shake);
        let bad = !Number.isFinite(effect.shake);
        effect.group.traverse((o) => {
          if (!bad && o.visible && ![o.position.x, o.position.y, o.position.z, o.scale.x, o.scale.y, o.scale.z].every(Number.isFinite)) bad = true;
        });
        if (bad) nanFrames++;
        effect.group.updateMatrixWorld(true);
        if (hasSingularLitMatrix(effect.group)) singularFrames++;
        if (frames % 15 === 0) rt.render(); // compiles every material that shows up during the timeline
      }
      rt.render();
    } catch (e) {
      errors.push(`frame ${frames}: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    }
  }
  renderer.debug.onShaderError = prevShaderError;
  return {
    label, ok: errors.length === 0 && nanFrames === 0 && singularFrames === 0, errors, nanFrames, singularFrames, frames,
    maxShake: +maxShake.toFixed(3), zones: rt.zones.length, targeted: !!rt.active?.module.targeting,
    arenaHits: arena.hits - hits0, emitters: effect?.emitters.length ?? 0,
  };
}

(window as unknown as { vfx: unknown }).vfx = {
  emitter, mode, setMode, selectMode, setPlayMode, setHeroMode: rt.setHeroMode, heroMode, heroPickCtrl, setDuel, duel,
  testKits: { melee: meleeTestKit, ranged: rangedTestKit, summon: summonTestKit }, hotbar, step: rt.step, render: rt.render,
  scrub, selfTest, controls, bloom, slots, player, telegraphs, arena, view,
  get effect() { return rt.active?.effect; },
};
