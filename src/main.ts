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
import { DivineSword } from './effects/divineSword';

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

const sword = new DivineSword();
sword.group.visible = false;
scene.add(sword.group);

// --- Post-processing --------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1, 0.5, 0.2);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const bloom: BloomSettings = { ...presets[initialPreset].bloom };
const swordBloom: BloomSettings = { enabled: true, strength: 0.55, radius: 0.45, threshold: 0.85 };
function applyBloom() {
  bloomPass.enabled = bloom.enabled;
  bloomPass.strength = bloom.strength;
  bloomPass.radius = bloom.radius;
  bloomPass.threshold = bloom.threshold;
}
applyBloom();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  for (const e of [emitter, ...sword.emitters]) e.setPixelScale(h * renderer.getPixelRatio(), camera.fov);
}
window.addEventListener('resize', resize);
resize();

// --- Controls panel ---------------------------------------------------------
const view = { paused: false, timeScale: 1, showGrid: true, restart: () => emitter.clear() };
const s: EmitterSettings = emitter.settings;
const gui = new GUI({ title: 'VFX Tool' });
const refreshPanel = () => gui.controllersRecursive().forEach((c) => c.updateDisplay());

const mode = { name: 'particles' as 'particles' | 'divine sword' };
const preset = { name: initialPreset };

gui.add(mode, 'name', ['particles', 'divine sword']).name('mode').onChange(() => setMode());
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

const fBloom = gui.addFolder('Bloom');
fBloom.add(bloom, 'enabled').onChange(applyBloom);
fBloom.add(bloom, 'strength', 0, 3, 0.01).onChange(applyBloom);
fBloom.add(bloom, 'radius', 0, 1, 0.01).onChange(applyBloom);
fBloom.add(bloom, 'threshold', 0, 1, 0.01).onChange(applyBloom);

// Divine sword set piece.
const ds = sword.settings;
const swordActions = {
  play: () => sword.play(),
  frameCamera: () => frameSword(),
};
const fSword = gui.addFolder('Divine Sword');
fSword.add(swordActions, 'play').name('▶ play');
fSword.add(swordActions, 'frameCamera').name('frame camera');
fSword.add(ds, 'loop');
fSword.add(ds, 'swordCount', 50, 4000, 50).name('sword count').onFinishChange(() => sword.buildSwarm());
fSword.add(ds, 'drillFraction', 0, 1, 0.01).name('drill share').onFinishChange(() => sword.buildSwarm());
fSword.add(ds, 'giantScale', 4, 30, 0.1).name('giant size');
fSword.add(ds, 'smallScale', 0.2, 3, 0.01).name('small size');
fSword.add(ds, 'fallHeight', 10, 80, 0.5).name('fall height');
fSword.add(ds, 'summonTime', 0.3, 5, 0.05).name('summon time');
fSword.add(ds, 'fallTime', 0.3, 5, 0.05).name('fall time');
fSword.add(ds, 'drillLength', 1, 25, 0.1).name('drill length');
fSword.add(ds, 'drillRadius', 0.5, 10, 0.05).name('drill radius');
fSword.add(ds, 'drillArms', 1, 16, 1).name('drill arms').onFinishChange(() => sword.buildSwarm());
fSword.add(ds, 'drillTwist', 0, 4, 0.05).name('drill twist');
fSword.add(ds, 'drillSpin', 0, 40, 0.1).name('drill spin');
fSword.add(ds, 'orbitRadius', 0.5, 10, 0.05).name('orbit radius');
fSword.add(ds, 'orbitSpin', -15, 15, 0.1).name('orbit spin');
fSword.addColor(ds, 'glowColor').name('glow color').onChange(() => sword.applyStyle());
fSword.addColor(ds, 'swarmColor').name('swarm color').onChange(() => sword.applyStyle());

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

/** Frames the whole fall: from the summon height down to the impact point. */
function frameSword() {
  const top = ds.fallHeight + ds.giantScale;
  const dist = top * 1.25;
  camera.position.set(dist * 0.55, top * 0.2, dist * 0.85);
  controls.target.set(0, top * 0.42, 0);
}

function setMode() {
  const isSword = mode.name === 'divine sword';
  sword.group.visible = isSword;
  emitter.points.visible = !isSword;
  grid.visible = !isSword && view.showGrid;
  presetCtrl.show(!isSword);
  fSword.show(isSword);
  for (const f of [fEmit, fMotion, fLook]) f.show(!isSword);
  Object.assign(bloom, isSword ? swordBloom : presets[preset.name].bloom);
  applyBloom();
  if (isSword) {
    frameSword();
    sword.play();
  } else {
    camera.position.set(4, 3, 6);
    controls.target.set(0, 1, 0);
  }
  refreshPanel();
}
setMode();

// Space replays the sword.
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && mode.name === 'divine sword' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    sword.play();
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
  if (mode.name === 'particles') emitter.update(dt);
  else sword.update(dt);
}

function render() {
  // Camera shake: offset only for this frame so OrbitControls keeps the real position.
  shakeOffset.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(sword.shake * 2);
  camera.position.add(shakeOffset);
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
    stats.textContent = mode.name === 'particles'
      ? `${fps} fps · ${emitter.aliveCount} particles`
      : `${fps} fps · ${ds.swordCount} swords · space = replay`;
  }
});

// Debug hook for checking effects from the console / automated browser.
(window as unknown as { vfx: unknown }).vfx = { emitter, sword, mode, setMode, step, render, controls, bloom };
