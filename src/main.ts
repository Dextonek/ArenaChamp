import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { Emitter, type EmitterSettings } from './emitter';
import { presets, presetNames, presetSettings, type BloomSettings } from './presets';
import { effectModules } from './effects';
import { FinishPass } from './post';
import { TelegraphLayer, type TelegraphSpec } from './effects/telegraph';
import { PlayerDummy } from './player';
import type { Effect, EffectModule } from './effects/types';

const container = document.getElementById('app')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// Applied by OutputPass; keeps overlapping additive particles from clipping to flat white.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Background via scene.background, not setClearColor: the composer's render target clear skips the
// sRGB→linear conversion, which washed the backdrop out to grey.
scene.background = new THREE.Color(0x1a1f2b);
// Reflections for the metal swords (particles use their own shader and ignore lighting).
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x20160f, 0.6));
const sun = new THREE.DirectionalLight(0xfff0d8, 1.5);
sun.position.set(10, 30, 15);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 400);
camera.position.set(4, 3, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;

const grid = new THREE.GridHelper(10, 20, 0x2a3040, 0x1a1e28);
scene.add(grid);

const initialPreset = 'fire';
const emitter = new Emitter(presetSettings(initialPreset));
scene.add(emitter.points);

// --- Post-processing --------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1, 0.5, 0.2);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
const finish = new FinishPass();
composer.addPass(finish.pass);

const bloom: BloomSettings = { ...presets[initialPreset].bloom };
function applyBloom() {
  bloomPass.enabled = bloom.enabled;
  bloomPass.strength = bloom.strength;
  bloomPass.radius = bloom.radius;
  bloomPass.threshold = bloom.threshold;
}
applyBloom();

// --- Set-piece effects (created lazily so one broken effect can't take down the app) ---
interface EffectSlot {
  module: EffectModule;
  effect?: Effect;
  folder?: GUI;
  error?: string;
}
const slots = new Map<string, EffectSlot>(effectModules.map((m) => [m.label, { module: m }]));
let active: EffectSlot | undefined;

// Danger zones + the player dummy that has to dodge them. The clock restarts whenever the active effect plays.
const telegraphs = new TelegraphLayer();
scene.add(telegraphs.group);
const player = new PlayerDummy(camera);
scene.add(player.group);
let effectClock = 0;
let zones: TelegraphSpec[] = [];

function onEffectPlay(slot: EffectSlot) {
  if (slot !== active || !slot.effect) return;
  effectClock = 0;
  zones = slot.module.telegraphs?.(slot.effect) ?? [];
  telegraphs.set(zones);
  player.onPlay();
}

function pixelScale(e: Emitter) {
  e.setPixelScale(window.innerHeight * renderer.getPixelRatio(), camera.fov);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  pixelScale(emitter);
  for (const slot of slots.values()) slot.effect?.emitters.forEach(pixelScale);
}
window.addEventListener('resize', resize);
resize();

// --- Controls panel ---------------------------------------------------------
const view = { paused: false, timeScale: 1, showGrid: true, restart: () => emitter.clear() };
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
gui.add(category, 'name', [...categories.keys()]).name('category').onChange((c: string) => {
  const modes = categories.get(c)!;
  // options() replaces the controller with a new one.
  modeCtrl = modeCtrl.options(modes).name('mode').onChange(() => setMode());
  mode.name = modes[0];
  setMode();
});
let modeCtrl: { options(o: string[]): typeof modeCtrl; name(n: string): typeof modeCtrl; onChange(f: () => void): typeof modeCtrl } = gui.add(mode, 'name', categories.get(DEFAULT_CATEGORY)!).name('mode').onChange(() => setMode());
const presetCtrl = gui.add(preset, 'name', presetNames).name('preset').onChange((name: string) => {
  Object.assign(s, presetSettings(name));
  Object.assign(bloom, presets[name].bloom);
  emitter.applyStyle();
  emitter.clear();
  applyBloom();
  refreshPanel();
});

const fView = gui.addFolder('View');
fView.add(view, 'paused');
fView.add(view, 'timeScale', 0, 3, 0.01).name('time scale');
fView.add(view, 'showGrid').name('grid').onChange((v: boolean) => (grid.visible = v && mode.name === 'particles'));
fView.add(view, 'restart');
const gameplay = { zones: true, player: false };
fView.add(gameplay, 'zones').name('danger zones').onChange((v: boolean) => (telegraphs.group.visible = v));
fView.add(gameplay, 'player').name('player dummy (WASD)').onChange((v: boolean) => player.setEnabled(v));

const fBloom = gui.addFolder('Bloom');
fBloom.add(bloom, 'enabled').onChange(applyBloom);
fBloom.add(bloom, 'strength', 0, 3, 0.01).onChange(applyBloom);
fBloom.add(bloom, 'radius', 0, 1, 0.01).onChange(applyBloom);
fBloom.add(bloom, 'threshold', 0, 1, 0.01).onChange(applyBloom);

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

/** Builds an effect, its scene objects and its panel folder on first use. */
function ensureEffect(slot: EffectSlot): Effect | undefined {
  if (slot.effect || slot.error) return slot.effect;
  try {
    const effect = slot.module.create();
    // Route every play() — including an effect's own loop restart — through the zone/player reset.
    const play = effect.play.bind(effect);
    effect.play = () => {
      play();
      onEffectPlay(slot);
    };
    effect.group.visible = false;
    scene.add(effect.group);
    effect.emitters.forEach(pixelScale);
    const folder = gui.addFolder(slot.module.label);
    folder.add({ play: () => effect.play() }, 'play').name('▶ play');
    folder.add({ frame: () => slot.module.frameCamera(camera, controls, effect) }, 'frame').name('frame camera');
    slot.module.buildGui(folder, effect);
    slot.effect = effect;
    slot.folder = folder;
  } catch (err) {
    slot.error = err instanceof Error ? err.message : String(err);
    console.error(`Effect "${slot.module.label}" failed to build`, err);
  }
  return slot.effect;
}

function setMode() {
  const next = slots.get(mode.name);
  for (const slot of slots.values()) {
    if (slot.effect) slot.effect.group.visible = false;
    slot.folder?.show(false);
  }
  active = next;
  zones = [];
  telegraphs.set(zones);
  const isParticles = !next;
  emitter.points.visible = isParticles;
  grid.visible = isParticles && view.showGrid;
  presetCtrl.show(isParticles);
  for (const f of [fEmit, fMotion, fLook]) f.show(isParticles);

  if (next) {
    const effect = ensureEffect(next);
    Object.assign(bloom, next.module.bloom);
    if (effect) {
      effect.group.visible = true;
      next.folder?.show(true);
      next.module.frameCamera(camera, controls, effect);
      effect.play();
    }
  } else {
    Object.assign(bloom, presets[preset.name].bloom);
    camera.position.set(4, 3, 6);
    controls.target.set(0, 1, 0);
  }
  applyBloom();
  refreshPanel();
}
setMode();

// Space replays the active effect.
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && active?.effect && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    active.effect.play();
  }
});

// --- Stats overlay ----------------------------------------------------------
const stats = document.createElement('div');
stats.style.cssText = 'position:fixed;left:10px;bottom:10px;font:12px ui-monospace,monospace;color:#8b93a7;pointer-events:none';
document.body.appendChild(stats);

// --- Loop -------------------------------------------------------------------
const clock = new THREE.Clock();
let fpsFrames = 0, fpsTime = 0, fps = 0;
const shakeOffset = new THREE.Vector3();

function step(dt: number) {
  if (!active) emitter.update(dt);
  else active.effect?.update(dt);
  effectClock += dt;
  telegraphs.update(effectClock);
  player.update(dt, effectClock, zones);
}

function render() {
  // Camera shake: offset only for this frame so OrbitControls keeps the real position.
  const shake = active?.effect?.shake ?? 0;
  shakeOffset.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 2);
  camera.position.add(shakeOffset);
  finish.update(shake);
  composer.render();
  camera.position.sub(shakeOffset);
}

renderer.setAnimationLoop(() => {
  // Clamp so a backgrounded tab doesn't dump one huge step on return.
  const rawDt = Math.min(clock.getDelta(), 0.1);
  if (!view.paused) step(rawDt * view.timeScale);
  controls.update();
  render();

  fpsFrames++; fpsTime += rawDt;
  if (fpsTime >= 0.5) {
    fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    stats.style.color = active?.error ? '#ff7a6b' : '#8b93a7';
    stats.textContent = !active
      ? `${fps} fps · ${emitter.aliveCount} particles`
      : active.error
        ? `${active.module.label} failed to build: ${active.error}`
        : `${fps} fps · ${active.module.label} · space = replay` +
          (player.enabled ? ` · WASD to move · hits ${player.hits} · dodges ${player.dodges}` : '');
  }
});

// Debug hook for checking effects from the console / automated browser:
// vfx.mode.name = '<label>'; vfx.setMode(); then vfx.step(1/60) + vfx.render() to scrub.
(window as unknown as { vfx: unknown }).vfx = {
  emitter, mode, setMode, step, render, controls, bloom, slots, player, telegraphs,
  get effect() { return active?.effect; },
};
