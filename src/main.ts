import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { Emitter, type EmitterSettings } from './emitter';
import { presets, presetNames, presetSettings, type BloomSettings } from './presets';
import { effectModules } from './effects';
import { FinishPass } from './post';
import { TelegraphLayer, type TelegraphSpec } from './effects/telegraph';
import { PlayerDummy } from './player';
import { Arena } from './arena';
import { Hotbar } from './hotbar';
import { CASTER_POS } from './effects/common';
import type { Effect, EffectModule } from './effects/types';
import { DISTORT_LAYER } from './effects/parts/distortion';

const container = document.getElementById('app')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// Applied by OutputPass; keeps overlapping additive particles from clipping to flat white.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Soft contact shadows under the figures and big objects (only meshes that opt in with castShadow).
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 90 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun);
// A cool rim light from behind the arena so figures and objects separate from the dark sky.
const rim = new THREE.DirectionalLight(0x8fa8ff, 0.9);
rim.position.set(-8, 12, -30);
scene.add(rim);

// --- Stage: sky dome + distance fog -------------------------------------------
// A gradient night sky (deep zenith, muted horizon band with a faint warm glow, sparse stars) instead of a flat
// colour, and fog that only eats the far ground. Both are switched off while an effect runs its own cinematic
// camera (the cutscenes build their own space sets far away).
const SKY_HORIZON = new THREE.Color(0x232a40);
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(320, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uHorizon: { value: SKY_HORIZON }, uZenith: { value: new THREE.Color(0x05070f) }, uGlow: { value: new THREE.Color(0x4a3a4a) } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon, uZenith, uGlow;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float h = clamp(vDir.y, -1.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
        col += uGlow * exp(-abs(h) * 14.0) * 0.6;                 // thin warm band at the horizon
        col = mix(col, uHorizon * 0.6, smoothstep(0.0, -0.2, h));  // below the horizon: dim
        vec3 q = floor(vDir * 260.0);
        float star = step(0.9965, hash(q)) * smoothstep(0.08, 0.4, h);
        col += vec3(0.85, 0.9, 1.0) * star * (0.35 + 0.65 * hash(q + 3.1));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  }),
);
skyDome.renderOrder = -10;
skyDome.frustumCulled = false;
scene.add(skyDome);
const fog = new THREE.Fog(SKY_HORIZON, 48, 150);
scene.fog = fog;

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
// Screen distortion: distortion meshes (layer DISTORT_LAYER) are rendered into a half-res float target as signed
// UV offsets; this pass bends the rendered frame by them (with a slight per-channel split) before bloom.
const distortTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
const distortPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tDistort: { value: distortTarget.texture }, uOn: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tDistort;
    uniform float uOn;
    varying vec2 vUv;
    void main() {
      vec2 o = texture2D(tDistort, vUv).rg * uOn;
      float r = texture2D(tDiffuse, vUv + o * 1.06).r;
      vec4 c = texture2D(tDiffuse, vUv + o);
      float b = texture2D(tDiffuse, vUv + o * 0.94).b;
      gl_FragColor = vec4(r, c.g, b, c.a);
    }
  `,
});
// ShaderPass clones its uniforms, and a cloned render-target texture no longer points at the target: re-link it.
distortPass.uniforms.tDistort.value = distortTarget.texture;
composer.addPass(distortPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1, 0.5, 0.2);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
const finish = new FinishPass();
composer.addPass(finish.pass);
// Antialiasing last: the composer renders into targets without MSAA, so hard drawn edges were jagged.
const fxaa = new ShaderPass(FXAAShader);
composer.addPass(fxaa);

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

// Shared caster + clickable enemy pack for targeted effects. A pick replays the active effect at the new target.
const arena = new Arena(camera, renderer.domElement);
scene.add(arena.group);
arena.onPick = () => active?.effect?.play();

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
  const pr = renderer.getPixelRatio();
  fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
  distortTarget.setSize(Math.max(1, Math.floor(w * pr / 2)), Math.max(1, Math.floor(h * pr / 2)));
  pixelScale(emitter);
  for (const slot of slots.values()) slot.effect?.emitters.forEach(pixelScale);
}
window.addEventListener('resize', resize);
resize();

// --- Controls panel ---------------------------------------------------------
const view = { paused: false, timeScale: 1, showGrid: false, restart: () => emitter.clear() };
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
const playMode = { on: false };
fView.add(playMode, 'on').name('play mode (P)').onChange((v: boolean) => setPlayMode(v));
fView.add(gameplay, 'zones').name('danger zones').onChange((v: boolean) => (telegraphs.group.visible = v));
fView.add(gameplay, 'player').name('player dummy (WASD)').onChange((v: boolean) => {
  if (v && playMode.on) setPlayMode(false);
  player.setEnabled(v);
});

const fArena = gui.addFolder('Targets');
const arenaOpts = { count: arena.count };
fArena.add(arenaOpts, 'count', 1, 10, 1).name('enemies').onFinishChange((n: number) => { arena.setCount(n); active?.effect?.play(); });
fArena.add({ shuffle: () => { arena.shuffle(); active?.effect?.play(); } }, 'shuffle');
fArena.add({ clear: () => { arena.clearSelection(); active?.effect?.play(); } }, 'clear').name('clear selection');
fArena.show(false);

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
    const targeting = slot.module.targeting;
    effect.play = () => {
      if (targeting && effect.cast) effect.cast(arena.context(targeting));
      placeEffect(effect, !targeting && playMode.on);
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
  const targeted = !!next?.module.targeting;
  arena.setVisible(targeted || playMode.on);
  fArena.show(targeted || playMode.on);

  if (next) {
    const effect = ensureEffect(next);
    Object.assign(bloom, next.module.bloom);
    if (effect) {
      effect.group.visible = true;
      next.folder?.show(true);
      // Targeted effects learn their targets in play(), and frame the camera around them.
      // In play mode the camera stays with the caster.
      if (targeted) effect.play();
      if (!playMode.on) next.module.frameCamera(camera, controls, effect);
      if (!targeted) effect.play();
    }
  } else if (!playMode.on) {
    Object.assign(bloom, presets[preset.name].bloom);
    camera.position.set(4, 3, 6);
    controls.target.set(0, 1, 0);
  }
  applyBloom();
  refreshPanel();
}
setMode();

// Space replays the active effect; 1–5 cast the hotbar slots; P toggles play mode.
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.code === 'Space' && active?.effect) {
    e.preventDefault();
    active.effect.play();
  }
  const digit = /^Digit([1-5])$/.exec(e.code);
  if (digit && !e.repeat) hotbar.cast(Number(digit[1]) - 1);
  if (e.code === 'KeyP' && !e.repeat) setPlayMode(!playMode.on);
});

/**
 * Selects an effect by label from any category (keeps the category / mode dropdowns in sync) and plays it.
 * Re-casting the effect that is already active just replays it.
 */
function selectMode(label: string) {
  const slot = slots.get(label);
  if (!slot) throw new Error(`unknown effect "${label}"`);
  if (active === slot && slot.effect) { slot.effect.play(); return; }
  category.name = slot.module.category ?? DEFAULT_CATEGORY;
  setModeOptions(categories.get(category.name)!);
  mode.name = label;
  setMode();
}

// --- Play mode: walk the caster with WASD, orbit with mouse drag, cast from the hotbar ---------------------
const hotbar = new Hotbar(
  [...categories.entries()].map(([c, labels]) => ({ category: c, labels: labels.filter((l) => l !== 'particles') })),
  ['tempest lattice', 'gale bullet', 'cinder bow', 'ember comet', 'starbreaker lance'],
  (label) => {
    if (!playMode.on) setPlayMode(true);
    selectMode(label);
  },
);
hotbar.setVisible(false);
const walkKeys = new Set<string>();
const WALK_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
window.addEventListener('keydown', (e) => {
  if (!playMode.on || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const k = e.key.toLowerCase();
  if (WALK_KEYS.includes(k)) { walkKeys.add(k); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => walkKeys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => walkKeys.clear());

function setPlayMode(on: boolean) {
  playMode.on = on;
  hotbar.setVisible(on);
  walkKeys.clear();
  if (on) {
    // The blue dodge dummy also listens to WASD; one walker at a time.
    gameplay.player = false;
    player.setEnabled(false);
    arena.homeCaster();
    const c = arena.caster.group.position;
    controls.target.set(c.x, 1.6, c.z - 4);
    camera.position.set(c.x + 7, 8, c.z + 11);
  } else if (active?.effect) {
    placeEffect(active.effect, false);
    arena.homeCaster();
  }
  lastCaster.copy(arena.caster.group.position);
  setMode();
}

const lastCaster = new THREE.Vector3();
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

/**
 * Non-targeted effects are authored around a caster at CASTER_POS facing -Z. In play mode they are moved and
 * turned so that caster stands where the player's caster is, facing the current target; their own ground is
 * hidden in favour of the arena's. The danger-zone layer gets the same transform.
 */
function placeEffect(effect: Effect, onCaster: boolean) {
  const rot = onCaster ? arena.aimYaw() - Math.PI : 0;
  const pos = onCaster
    ? arena.caster.group.position.clone().setY(0).sub(CASTER_POS.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot))
    : new THREE.Vector3();
  for (const g of [effect.group, telegraphs.group]) {
    g.position.copy(pos);
    g.rotation.set(0, rot, 0);
  }
  for (const child of effect.group.children) if (child.name === 'ground') child.visible = !onCaster;
}

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
  if (playMode.on) walk(dt);
  if (arena.group.visible) arena.update(dt);
  player.update(dt, effectClock, zones);
}

// Impact-frame silhouettes: the listed objects are drawn flat white into this mask (layer 7 only).
const SILHOUETTE_LAYER = 7;
const maskTarget = new THREE.WebGLRenderTarget(1, 1);
const maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const focusUv = new THREE.Vector2();
const _focus = new THREE.Vector3();

const _clear = new THREE.Color();
let distortActive = false;
/** Renders the distortion layer into its target; skipped (and the pass bypassed) when nothing is on that layer. */
function renderDistortion() {
  let any = false;
  const root = active?.effect?.group;
  if (root?.visible) root.traverseVisible((o) => { if (!any && o.layers.mask === 1 << DISTORT_LAYER) any = true; });
  distortPass.uniforms.uOn.value = any ? 1 : 0;
  if (!any && !distortActive) return;
  distortActive = any;
  const bg = scene.background, fogRef = scene.fog, layers = camera.layers.mask;
  const prevAlpha = renderer.getClearAlpha();
  renderer.getClearColor(_clear);
  scene.background = null;
  scene.fog = null;
  camera.layers.set(DISTORT_LAYER);
  renderer.setRenderTarget(distortTarget);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  if (any) renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.setClearColor(_clear, prevAlpha);
  camera.layers.mask = layers;
  scene.background = bg;
  scene.fog = fogRef;
}

function renderSilhouetteMask(objects: THREE.Object3D[]) {
  const w = Math.max(1, Math.floor(renderer.domElement.width / 2)), h = Math.max(1, Math.floor(renderer.domElement.height / 2));
  if (maskTarget.width !== w || maskTarget.height !== h) maskTarget.setSize(w, h);
  for (const o of objects) o.traverse((c) => c.layers.enable(SILHOUETTE_LAYER));
  const bg = scene.background, override = scene.overrideMaterial, layers = camera.layers.mask;
  scene.background = new THREE.Color(0x000000);
  scene.overrideMaterial = maskMaterial;
  camera.layers.set(SILHOUETTE_LAYER);
  renderer.setRenderTarget(maskTarget);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.background = bg;
  scene.overrideMaterial = override;
  camera.layers.mask = layers;
}

const _camSave = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 50 };

function render() {
  // Cutscene camera: render this frame through the effect's scripted camera, then restore the orbit camera.
  const cine = active?.effect?.group.visible ? active.effect.cinematic : undefined;
  const cineOn = !!cine?.active;
  skyDome.visible = !cineOn;
  scene.fog = cineOn ? null : fog;
  if (cineOn) {
    _camSave.pos.copy(camera.position);
    _camSave.quat.copy(camera.quaternion);
    _camSave.fov = camera.fov;
    camera.position.copy(cine.position);
    camera.lookAt(cine.target);
    camera.rotateZ(cine.roll);
    camera.fov = cine.fov;
    camera.updateProjectionMatrix();
  }
  // Camera shake: offset only for this frame so OrbitControls keeps the real position.
  const shake = active?.effect?.shake ?? 0;
  shakeOffset.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 2);
  camera.position.add(shakeOffset);
  finish.update(shake);
  const fx = active?.effect?.group.visible ? active.effect.screen : undefined;
  if (fx) {
    _focus.copy(fx.focus).project(camera);
    focusUv.set(_focus.x * 0.5 + 0.5, _focus.y * 0.5 + 0.5);
  } else focusUv.set(0.5, 0.5);
  renderDistortion();
  const impact = !!fx && fx.impact > 0;
  if (impact) renderSilhouetteMask(fx.silhouettes);
  finish.setScreen(fx, focusUv, impact ? maskTarget.texture : null, camera.aspect);
  composer.render();
  camera.position.sub(shakeOffset);
  if (cineOn) {
    drawLetterbox(cine.letterbox);
    camera.position.copy(_camSave.pos);
    camera.quaternion.copy(_camSave.quat);
    camera.fov = _camSave.fov;
    camera.updateProjectionMatrix();
  }
}

/** Black cinema bars (2.39:1 at amount 1) drawn straight into the canvas, so frame captures include them. */
function drawLetterbox(amount: number) {
  if (amount <= 0) return;
  const w = renderer.domElement.width, h = renderer.domElement.height;
  const bar = Math.round(Math.max(0, (h - w / 2.39) / 2) * Math.min(1, amount));
  if (bar <= 0) return;
  const prev = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(null);
  renderer.setScissorTest(true);
  renderer.setClearColor(0x000000, 1);
  const pr = renderer.getPixelRatio();
  for (const y of [0, h - bar]) {
    renderer.setScissor(0, y / pr, w / pr, bar / pr);
    renderer.setViewport(0, y / pr, w / pr, bar / pr);
    renderer.clear(true, true, false);
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w / pr, h / pr);
  renderer.setClearColor(prev, prevAlpha);
}

renderer.setAnimationLoop(() => {
  // Clamp so a backgrounded tab doesn't dump one huge step on return.
  const rawDt = Math.min(clock.getDelta(), 0.1);
  if (!view.paused) step(rawDt * view.timeScale);
  controls.update();
  render();
  const dur = (active?.effect as { duration?: number } | undefined)?.duration;
  hotbar.setProgress(playMode.on && dur && active?.effect?.playing ? effectClock / dur : null);

  fpsFrames++; fpsTime += rawDt;
  if (fpsTime >= 0.5) {
    fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    stats.style.color = active?.error ? '#ff7a6b' : '#8b93a7';
    stats.textContent = !active
      ? `${fps} fps · ${emitter.aliveCount} particles`
      : active.error
        ? `${active.module.label} failed to build: ${active.error}`
        : playMode.on
          ? `${fps} fps · ${active.module.label} · WASD walk · drag = camera · 1–5 cast · click enemy / ground to target · P exit · hits ${arena.hits} · kills ${arena.kills}`
          : `${fps} fps · ${active.module.label} · space = replay · P = play mode` +
          (active.module.targeting ? ` · click enemy / ground to target (shift = add) · hits ${arena.hits} · kills ${arena.kills}` : '') +
          (player.enabled ? ` · WASD to move · hits ${player.hits} · dodges ${player.dodges}` : '');
  }
});

// Debug hook for checking effects from the console / automated browser:
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
  active?.effect?.play();
  for (let i = 0; i < Math.round(t * 60); i++) step(1 / 60);
  render();
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
  if (active?.error) errors.push(active.error);
  const effect = active?.effect;
  if (effect) {
    view.paused = true;
    try {
      effect.play();
      for (; frames < seconds * 60; frames++) {
        step(1 / 60);
        maxShake = Math.max(maxShake, effect.shake);
        let bad = !Number.isFinite(effect.shake);
        effect.group.traverse((o) => {
          if (!bad && o.visible && ![o.position.x, o.position.y, o.position.z, o.scale.x, o.scale.y, o.scale.z].every(Number.isFinite)) bad = true;
        });
        if (bad) nanFrames++;
        effect.group.updateMatrixWorld(true);
        if (hasSingularLitMatrix(effect.group)) singularFrames++;
        if (frames % 15 === 0) render(); // compiles every material that shows up during the timeline
      }
      render();
    } catch (e) {
      errors.push(`frame ${frames}: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    }
  }
  renderer.debug.onShaderError = prevShaderError;
  return {
    label, ok: errors.length === 0 && nanFrames === 0 && singularFrames === 0, errors, nanFrames, singularFrames, frames,
    maxShake: +maxShake.toFixed(3), zones: zones.length, targeted: !!active?.module.targeting,
    arenaHits: arena.hits - hits0, emitters: effect?.emitters.length ?? 0,
  };
}

(window as unknown as { vfx: unknown }).vfx = {
  emitter, mode, setMode, selectMode, setPlayMode, hotbar, step, render, scrub, selfTest, controls, bloom, slots, player, telegraphs, arena, view,
  get effect() { return active?.effect; },
};
