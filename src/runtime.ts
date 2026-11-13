import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Emitter } from './emitter';
import type { BloomSettings } from './presets';
import { FinishPass } from './post';
import { TelegraphLayer, type TelegraphSpec } from './effects/telegraph';
import { Arena } from './arena';
import { HeroMode } from './heroMode';
import { HERO_KITS } from './heroes';
import { stopsAtCover } from './obstacles';
import { DEFAULT_STAGE, type ArenaStage } from './arenas';
import { Duel } from './duel';
import { CASTER_POS } from './effects/common';
import type { CastContext, Effect, EffectModule } from './effects/types';
import { DISTORT_LAYER } from './effects/parts/distortion';
import type { ScreenFx } from './effects/parts/screen';

/**
 * The 3D runtime that the VFX tool (index.html, src/tool/) and the duel game (game.html, src/game/) are both built
 * on: renderer, lights and sky, post-processing (distortion, bloom, impact frames, letterbox), the effect slots (built
 * lazily, the active effect and the lingering casts), the arena, hero mode, the duel and the frame loop. No app UI
 * lives here: the tool adds its panel, particle editor, play mode walk and debug hooks through `hooks`; the game adds
 * its menus on top of the returned object (`GameApi`). See docs/architecture/overview.md.
 */

/** One effect module and its lazily built instance. */
export interface EffectSlot {
  module: EffectModule;
  effect?: Effect;
  error?: string;
  /** A finished-soon copy of a spell's effect that was cast again (hero mode): it plays out in `lingering`, then is dropped. */
  detached?: true;
}

/** Where an app plugs into the runtime (the tool uses them all; the game none). Each is optional. */
export interface RuntimeHooks {
  /** An effect was built (the tool gives it a panel folder). */
  effectBuilt?(slot: EffectSlot, effect: Effect): void;
  /** An effect instance was dropped for good (the tool removes its folder). */
  effectDropped?(slot: EffectSlot): void;
  /** `selectEffect` is about to activate `slot` (the tool syncs its category / mode dropdowns). */
  selecting?(slot: EffectSlot): void;
  /** `activate` switched the active effect ('switch', before it plays) and finished ('done'). */
  activated?(next: EffectSlot | undefined, phase: 'switch' | 'done'): void;
  /** The active effect started playing (the tool's dodge dummy resets). */
  played?(slot: EffectSlot): void;
  /** Play mode turned on or off, after the caster and camera moved (the tool shows its hotbar, resets its walk). */
  playMode?(on: boolean): void;
  /** Hero mode turned on or off. */
  heroMode?(on: boolean): void;
  /** The hero changed (`setKit`). */
  kitChanged?(name: string): void;
  /** Steps, at their place in the runtime's step: first (the particle emitter), after the zones (the play-mode walk), last. */
  beforeStep?(dt: number): void;
  walkStep?(dt: number): void;
  afterStep?(dt: number): void;
  /** After every rendered frame, with the frame's real dt (the tool's stats line and hotbar progress). */
  frame?(rawDt: number): void;
  /** The window was resized (the tool rescales its particle emitter). */
  resized?(): void;
}

export interface RuntimeOptions {
  /** The effect modules this app can play: the tool, all of them; the game, the spells (`targetedModules`). */
  modules: EffectModule[];
  /** Keep stepping the simulation from a timer while the tab is hidden (a network duel must go on). */
  background?: boolean;
  /** A click on the hero's portrait goes to the next hero: the tool's shortcut. In the game a fight must not change hero. */
  heroCycle?: boolean;
}

/** Hero-mode bloom: the kit spells' look (a low threshold makes pale costumes glow before the first cast). */
export const HERO_BLOOM: BloomSettings = { enabled: true, strength: 0.45, radius: 0.4, threshold: 0.86 };

export type Runtime = ReturnType<typeof createRuntime>;
/** What the duel game (src/game/) drives: hero mode, the duel and the hero choice. */
export type GameApi = Pick<Runtime, 'arena' | 'heroMode' | 'duel' | 'kits' | 'setHeroMode' | 'setKit' | 'view'>;

/**
 * The order solid things are drawn in. Three's own order is by material (the oldest first), which drew the ground first and
 * every floor laid over it after: each pixel of floor was shaded two or three times, and a lit, textured floor that fills
 * the screen is the dearest thing in the picture (docs/pipeline/performance.md). Here the big surfaces (ground, floors,
 * anything wider than 24 m) come after everything else that writes depth, the highest first, so a floor under another is
 * skipped by the depth test before it is shaded. Solid things that do not write depth (flat glows on the floor) come last,
 * as they did in effect: over what they lie on. Within each kind the order is three's own. The picture is the same.
 */
const BIG_SURFACE = 12;
const _big = new WeakMap<THREE.BufferGeometry, boolean>();
interface DrawItem { object: THREE.Object3D; geometry: THREE.BufferGeometry | null; material: THREE.Material & { id: number }; groupOrder: number; renderOrder: number; z: number; id: number }
function drawKind(it: DrawItem) {
  if (!it.material.depthWrite) return 2;
  const g = it.geometry;
  if (!g) return 0;
  let big = _big.get(g);
  if (big === undefined) {
    if (!g.boundingSphere) g.computeBoundingSphere();
    big = (g.boundingSphere?.radius ?? 0) >= BIG_SURFACE && !(it.object as THREE.SkinnedMesh).isSkinnedMesh;
    _big.set(g, big);
  }
  return big ? 1 : 0;
}
/** How high a big surface lies: the world height of the middle of its geometry. */
function heightOf(it: DrawItem) {
  const c = it.geometry!.boundingSphere!.center, e = it.object.matrixWorld.elements;
  return e[1] * c.x + e[5] * c.y + e[9] * c.z + e[13];
}
function opaqueOrder(a: DrawItem, b: DrawItem) {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  const ka = drawKind(a), kb = drawKind(b);
  if (ka !== kb) return ka - kb;
  if (ka === 1) {
    const ha = heightOf(a), hb = heightOf(b);
    if (Math.abs(ha - hb) > 1e-4) return hb - ha;
  }
  if (a.material.id !== b.material.id) return a.material.id - b.material.id;
  if (a.z !== b.z) return a.z - b.z;
  return a.id - b.id;
}

/** Builds the scene into `#app` and starts the frame loop. Call once per page. */
export function createRuntime(opts: RuntimeOptions) {
  const hooks: RuntimeHooks = {};
  const container = document.getElementById('app')!;

  // No multisampling on the canvas: the scene is drawn into the composer's own targets, and the last pass (FXAA) covers
  // the whole canvas with one quad, which multisampling does nothing for but still stores and resolves four times over.
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Applied by OutputPass; keeps overlapping additive particles from clipping to flat white.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Soft contact shadows under the figures and big objects (only meshes that opt in with castShadow).
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.setOpaqueSort(opaqueOrder);

  const scene = new THREE.Scene();
  // Background via scene.background, not setClearColor: the composer's render target clear skips the
  // sRGB→linear conversion, which washed the backdrop out to grey.
  scene.background = new THREE.Color(0x1a1f2b);
  // Reflections for the metal swords (particles use their own shader and ignore lighting).
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  const hemi = new THREE.HemisphereLight(0x9fb4ff, 0x20160f, 0.6);
  scene.add(hemi);
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
      uniforms: {
        uHorizon: { value: SKY_HORIZON.clone() },
        uZenith: { value: new THREE.Color(0x05070f) },
        uGlow: { value: new THREE.Color(0x4a3a4a) },
        uStars: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uHorizon, uZenith, uGlow;
        uniform float uStars;
        varying vec3 vDir;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main() {
          float h = clamp(vDir.y, -1.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
          col += uGlow * exp(-abs(h) * 14.0) * 0.6;                 // thin warm band at the horizon
          col = mix(col, uHorizon * 0.6, smoothstep(0.0, -0.2, h));  // below the horizon: dim
          vec3 q = floor(vDir * 260.0);
          float star = step(0.9965, hash(q)) * smoothstep(0.08, 0.4, h);
          col += vec3(0.85, 0.9, 1.0) * star * (0.35 + 0.65 * hash(q + 3.1)) * uStars;
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

  /** A duel arena's sky, fog and lights (src/arenas); null puts back the default night. */
  function setStage(stage: ArenaStage | null) {
    const s = stage ?? DEFAULT_STAGE;
    const u = (skyDome.material as THREE.ShaderMaterial).uniforms;
    u.uZenith.value.set(s.zenith);
    u.uHorizon.value.set(s.horizon);
    u.uGlow.value.set(s.glow);
    u.uStars.value = s.stars;
    (scene.background as THREE.Color).set(s.background);
    fog.color.set(s.fog);
    fog.near = s.fogNear;
    fog.far = s.fogFar;
    hemi.color.set(s.hemiSky);
    hemi.groundColor.set(s.hemiGround);
    hemi.intensity = s.hemiIntensity;
    sun.color.set(s.sun);
    sun.intensity = s.sunIntensity;
    rim.color.set(s.rim);
    rim.intensity = s.rimIntensity;
  }

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 400);
  camera.position.set(4, 3, 6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;

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
  // The red contour round the enemy the mouse is on. Off (no cost) unless something is outlined.
  const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
  outlinePass.visibleEdgeColor.setRGB(1, 0.1, 0.06);
  outlinePass.hiddenEdgeColor.setRGB(0.3, 0.03, 0.02);
  outlinePass.edgeStrength = 3.5;
  outlinePass.edgeThickness = 1;
  outlinePass.enabled = false;
  composer.addPass(outlinePass);
  const outline = (object: THREE.Object3D | null) => {
    if ((outlinePass.selectedObjects[0] ?? null) === object) return;
    outlinePass.selectedObjects = object ? [object] : [];
    outlinePass.enabled = !!object;
  };
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1, 0.5, 0.2);
  composer.addPass(bloomPass);
  // Tone mapping and the screen's colour space are the finish pass's first step (src/post.ts): no OutputPass.
  const finish = new FinishPass();
  composer.addPass(finish.pass);
  // Antialiasing last: the composer renders into targets without MSAA, so hard drawn edges were jagged.
  const fxaa = new ShaderPass(FXAAShader);
  composer.addPass(fxaa);

  const bloom: BloomSettings = { ...HERO_BLOOM };
  function applyBloom() {
    bloomPass.enabled = bloom.enabled;
    bloomPass.strength = bloom.strength;
    bloomPass.radius = bloom.radius;
    bloomPass.threshold = bloom.threshold;
  }
  applyBloom();

  /**
   * `playMode`: the arena is live round the player's caster (the tool's play mode, and hero mode on top of it).
   * `idleBloom`: the bloom with no effect active outside play mode (the tool sets its particle preset's).
   */
  const state = { playMode: false, idleBloom: { ...HERO_BLOOM } as BloomSettings };
  /**
   * Time control: paused, and a multiplier on the frame time. `covered`: the canvas cannot be seen (the game's menus lie
   * over it, opaque), so nothing is drawn; the simulation still steps.
   */
  const view = { paused: false, timeScale: 1, covered: false };

  // --- Effects (created lazily so one broken effect can't take down the app) ---
  const slots = new Map<string, EffectSlot>(opts.modules.map((m) => [m.label, { module: m }]));
  let active: EffectSlot | undefined;
  /**
   * Hero mode only: earlier casts that are still playing when a new spell becomes `active`. They keep updating and
   * drawing until they finish, so spells overlap like in a MOBA. Everywhere else one effect plays at a time.
   */
  const lingering = new Set<EffectSlot>();
  let keepLingering = false;
  /** True while hero mode turns on or off: switching modes must not replay the spell that was cast last. */
  let quietMode = false;
  /** A cast context for the next play() instead of the arena's own (`castAs`: a duel opponent casting). */
  let castOverride: CastContext | null = null;

  /**
   * Plays a targeted effect for another caster (a duel opponent) with its own context. It joins the lingering
   * effects, so the player's active effect, panel and camera stay as they are. Returns the effect's danger zones.
   */
  function castAs(label: string, ctx: CastContext): TelegraphSpec[] {
    const slot = slots.get(label);
    const effect = slot && ensureEffect(slot);
    if (!slot || !effect) return [];
    castOverride = ctx;
    effect.play();
    castOverride = null;
    effect.group.visible = true;
    if (active !== slot) lingering.add(slot);
    return zonesOf(slot, effect);
  }

  /** What a cast's danger zones show: a line skillshot's strip ends where cover stops the bolt, as its aim strip did. */
  const BOLT_LINES = new Set(HERO_KITS.flatMap((k) => [...k.spells, ...(k.alt?.spells ?? [])]).filter((s) => stopsAtCover(s) && !s.passesOwnWalls).map((s) => s.label));
  function zonesOf(slot: EffectSlot, effect: Effect) {
    const out = slot.module.telegraphs?.(effect) ?? [];
    return BOLT_LINES.has(slot.module.label) ? arena.cutZones(out) : out;
  }

  // Danger zones of the active effect. Their clock restarts whenever the active effect plays.
  const telegraphs = new TelegraphLayer();
  scene.add(telegraphs.group);
  let effectClock = 0;
  let zones: TelegraphSpec[] = [];

  // Shared caster + clickable enemy pack for targeted effects. A pick replays the active effect at the new target.
  const arena = new Arena(camera, renderer.domElement);
  scene.add(arena.group);
  arena.onPick = () => active?.effect?.play();

  function onEffectPlay(slot: EffectSlot) {
    if (slot !== active || !slot.effect) return;
    effectClock = 0;
    zones = zonesOf(slot, slot.effect);
    telegraphs.set(zones);
    hooks.played?.(slot);
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
    for (const slot of slots.values()) slot.effect?.emitters.forEach(pixelScale);
    hooks.resized?.();
  }
  window.addEventListener('resize', resize);
  resize();

  /** Builds an effect and its scene objects on first use (the app adds its own panel through `effectBuilt`). */
  function ensureEffect(slot: EffectSlot): Effect | undefined {
    if (slot.effect || slot.error) return slot.effect;
    try {
      const effect = slot.module.create();
      // Route every play() — including an effect's own loop restart — through the zone reset.
      const play = effect.play.bind(effect);
      const targeting = slot.module.targeting;
      effect.play = () => {
        if (targeting && effect.cast) {
          effect.cast(castOverride ?? arena.context(targeting));
          castOverride = null;
        }
        placeEffect(effect, !targeting && state.playMode);
        play();
        onEffectPlay(slot);
      };
      effect.group.visible = false;
      scene.add(effect.group);
      effect.emitters.forEach(pixelScale);
      slot.effect = effect;
      hooks.effectBuilt?.(slot, effect);
    } catch (err) {
      slot.error = err instanceof Error ? err.message : String(err);
      console.error(`Effect "${slot.module.label}" failed to build`, err);
    }
    return slot.effect;
  }

  /**
   * Makes `label` the active effect (an unknown label, e.g. the tool's 'particles', means none): earlier casts keep
   * playing in hero mode, the danger zones reset, the arena shows for targeted effects and in play mode, and the
   * effect plays (targeted ones learn their targets first and frame the camera round them outside play mode).
   */
  function activate(label: string | null) {
    const next = label ? slots.get(label) : undefined;
    if (keepLingering && active && active !== next && active.effect?.playing) lingering.add(active);
    if (next) lingering.delete(next);
    for (const slot of slots.values()) if (slot.effect && !lingering.has(slot)) slot.effect.group.visible = false;
    active = next;
    zones = [];
    telegraphs.set(zones);
    const targeted = !!next?.module.targeting;
    arena.setVisible(targeted || state.playMode);
    hooks.activated?.(next, 'switch');

    if (next && !quietMode) {
      const effect = ensureEffect(next);
      Object.assign(bloom, next.module.bloom);
      if (effect) {
        effect.group.visible = true;
        // Targeted effects learn their targets in play(), and frame the camera around them.
        // In play mode the camera stays with the caster.
        if (targeted) effect.play();
        if (!state.playMode) next.module.frameCamera(camera, controls, effect);
        if (!targeted) effect.play();
      }
    } else if (!state.playMode) {
      Object.assign(bloom, state.idleBloom);
      camera.position.set(4, 3, 6);
      controls.target.set(0, 1, 0);
    }
    applyBloom();
    hooks.activated?.(next, 'done');
  }

  /**
   * Selects an effect by label and plays it. Re-casting the effect that is already active just replays it; in hero
   * mode a recast while the last one still plays (a bolt in flight) keeps that instance alive and casts a fresh one.
   */
  function selectEffect(label: string) {
    const slot = slots.get(label);
    if (!slot) throw new Error(`unknown effect "${label}"`);
    if (active === slot && slot.effect) {
      if (!(keepLingering && slot.effect.playing)) { slot.effect.play(); return; }
      lingering.add({ module: slot.module, effect: slot.effect, detached: true });
      hooks.effectDropped?.(slot);
      slot.effect = undefined;
    }
    hooks.selecting?.(slot);
    activate(label);
  }

  /** Play mode: the arena goes live round the player's caster (the tool walks it with WASD; hero mode clicks). */
  function setPlayMode(on: boolean) {
    state.playMode = on;
    if (on) {
      arena.homeCaster();
      const c = arena.caster.group.position;
      controls.target.set(c.x, 1.6, c.z - 4);
      camera.position.set(c.x + 7, 8, c.z + 11);
    } else if (active?.effect) {
      placeEffect(active.effect, false);
      arena.homeCaster();
    }
    hooks.playMode?.(on);
    activate(active?.module.label ?? null);
  }

  /** The hero: sets hero mode's kit and restarts a running offline duel with it (and an opponent of another kit). */
  function setKit(name: string) {
    const kit = HERO_KITS.find((k) => k.name === name);
    if (kit) heroMode.setKit(kit);
    if (duel.on && !duel.net) duel.start();
    hooks.kitChanged?.(name);
  }

  // --- Hero mode: a MOBA-style test of one hero kit (click to move, Q/W/E/R aim and cast in range) -----------
  // It runs on top of play mode (no auto-framing, effects follow the caster) with its own camera and HUD.
  const heroMode = new HeroMode(
    {
      arena,
      camera,
      dom: renderer.domElement,
      targeting: (label) => slots.get(label)?.module.targeting,
      nextKit: opts.heroCycle
        ? () => {
          const i = HERO_KITS.findIndex((k) => k.name === heroMode.kitName);
          setKit(HERO_KITS[(i + 1) % HERO_KITS.length].name);
        }
        : undefined,
      cast: (label) => {
        selectEffect(label);
        // Rooted until the spell lands: the latest danger-zone impact, else a short default.
        const impact = zones.length ? Math.max(...zones.map((z) => z.impact)) : 0.4;
        return Math.min(impact, 2.5);
      },
    },
    HERO_KITS[0],
  );
  scene.add(heroMode.group);

  /**
   * Before a fight (the loading page is up): builds the effects of the spells that can be cast in it, hidden, and compiles
   * every material in the scene, so the first cast of a spell does not stop the game to build its shaders.
   *
   * The shaders are compiled as the composer will use them: with its float target bound. Three keys a shader by where it
   * draws (a target: linear colour, no tone mapping; the canvas: sRGB and tone mapped), so a compile with no target bound
   * prepared shaders the game never used, and each was built again, in the middle of a frame, when first drawn.
   *
   * A spell that brings its own lights changes the shader of everything lit while it plays: those variants are compiled
   * too, one pass for each distinct set of lights.
   */
  function warmUp(labels: string[] = []): Promise<unknown> {
    const built: Effect[] = [];
    for (const label of labels) {
      const slot = slots.get(label);
      const effect = slot && ensureEffect(slot);
      if (effect) built.push(effect);
    }
    const before = renderer.getRenderTarget();
    renderer.setRenderTarget(composer.readBuffer);
    const waits: Promise<unknown>[] = [];
    try {
      waits.push(renderer.compileAsync(scene, camera));
      const seen = new Set<string>();
      for (const effect of built) {
        let points = 0, spots = 0, dirs = 0;
        effect.group.traverse((o) => {
          const l = o as THREE.Light & { isPointLight?: boolean; isSpotLight?: boolean; isDirectionalLight?: boolean };
          if (l.isPointLight) points++;
          else if (l.isSpotLight) spots++;
          else if (l.isDirectionalLight) dirs++;
        });
        const key = `${points}/${spots}/${dirs}`;
        if (key === '0/0/0' || seen.has(key) || effect.group.visible) continue;
        seen.add(key);
        // Shown for the length of this call only (nothing is drawn in between): its lights count as the scene's.
        const hidden: THREE.Object3D[] = [];
        effect.group.traverse((o) => { if ((o as THREE.Light).isLight && !o.visible) { o.visible = true; hidden.push(o); } });
        effect.group.visible = true;
        waits.push(renderer.compileAsync(scene, camera));
        effect.group.visible = false;
        for (const o of hidden) o.visible = false;
      }
    } catch (e) {
      console.warn('The shader warm-up stopped early:', e);
    }
    renderer.setRenderTarget(before);
    return Promise.all(waits.map((w) => w.catch(() => undefined)));
  }

  // --- Duel: the hero against an AI hero of another kit in a small ring (on top of hero mode) -----------------
  const duel = new Duel({
    outline,
    arena,
    heroMode,
    kits: HERO_KITS,
    castAs,
    playerZones: () => zones,
    targeting: (label) => slots.get(label)?.module.targeting,
    setStage,
    clearEffects,
    warmUp,
  });
  scene.add(duel.group);
  duel.onLeave = () => setDuel(false);

  /** Starts a duel ('play': you vs the AI, 'run': AI vs AI to watch) or ends it. */
  function setDuel(on: boolean, mode: 'play' | 'run' = 'play') {
    if (on) {
      if (!heroMode.enabled) setHeroMode(true);
      duel.start(mode);
    } else duel.stop();
  }

  function setHeroMode(on: boolean) {
    if (on === heroMode.enabled) return;
    keepLingering = on;
    clearEffects();
    if (!on && duel.on) setDuel(false);
    quietMode = true;
    if (on) {
      setPlayMode(true);
      arena.reset();
      controls.enabled = false;
      heroMode.setEnabled(true);
      Object.assign(bloom, HERO_BLOOM);
      applyBloom();
    } else {
      heroMode.setEnabled(false);
      controls.enabled = true;
      setPlayMode(false);
      arena.reset();
    }
    quietMode = false;
    hooks.heroMode?.(on);
  }

  function dropLingering() {
    for (const slot of lingering) if (slot.effect) retire(slot);
    lingering.clear();
  }

  /**
   * Ends every spell on screen, the active one too (hero mode on or off, a new duel round): nothing cast in the last
   * fight, an ult included, carries over. The active spell is rebuilt fresh on its next cast.
   */
  function clearEffects() {
    dropLingering();
    if (active?.effect) {
      scene.remove(active.effect.group);
      hooks.effectDropped?.(active);
      active.effect = undefined;
    }
    zones = [];
    telegraphs.set(zones);
  }

  /** A lingering effect is over: hide it (a detached copy leaves the scene for good). */
  function retire(slot: EffectSlot) {
    if (!slot.effect) return;
    slot.effect.group.visible = false;
    if (slot.detached) scene.remove(slot.effect.group);
  }

  /** The active effect plus the lingering ones that are still on screen. */
  function liveEffects(): Effect[] {
    const out: Effect[] = [];
    if (active?.effect?.group.visible) out.push(active.effect);
    for (const slot of lingering) if (slot.effect?.group.visible) out.push(slot.effect);
    return out;
  }

  /**
   * One screen-feedback state for the frame when several effects overlap: an impact frame wins, else the one doing
   * the most (darken, whiteout, focus lines, ...).
   */
  function pickScreen(effects: Effect[]): ScreenFx | undefined {
    let best: ScreenFx | undefined, bestScore = -1;
    for (const e of effects) {
      const fx = e.screen;
      // A spell that has ended must not leave its impact frame on the screen.
      if (!fx || !e.playing) continue;
      const score = (fx.impact > 0 ? 10 : 0) + fx.darken + fx.whiteout + fx.speedLines + fx.desaturate + fx.chroma + fx.crack;
      if (score > bestScore) { best = fx; bestScore = score; }
    }
    return best;
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

  // --- Loop -------------------------------------------------------------------
  const clock = new THREE.Clock();
  const shakeOffset = new THREE.Vector3();

  /** A bug in one spell ends that spell and is logged; it must not freeze a match. */
  function updateEffect(effect: Effect | undefined, dt: number) {
    if (!effect) return;
    try {
      effect.update(dt);
    } catch (e) {
      console.error('Spell effect failed and was stopped:', e);
      effect.playing = false;
      effect.group.visible = false;
    }
  }

  function step(dt: number) {
    hooks.beforeStep?.(dt);
    updateEffect(active?.effect, dt);
    for (const slot of lingering) {
      updateEffect(slot.effect, dt);
      if (!slot.effect?.playing) {
        if (slot.effect) retire(slot);
        lingering.delete(slot);
      }
    }
    effectClock += dt;
    telegraphs.update(effectClock);
    hooks.walkStep?.(dt);
    if (arena.group.visible) arena.update(dt);
    heroMode.update(dt);
    duel.update(dt);
    hooks.afterStep?.(dt);
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
    for (const e of liveEffects()) e.group.traverseVisible((o) => { if (!any && o.layers.mask === 1 << DISTORT_LAYER) any = true; });
    distortPass.uniforms.uOn.value = any ? 1 : 0;
    // With nothing bending the frame the pass would only copy it: skipped.
    distortPass.enabled = any;
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
    const live = liveEffects();
    const shake = live.reduce((m, e) => Math.max(m, e.shake), heroMode.enabled ? heroMode.hitShake : 0);
    shakeOffset.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 2);
    camera.position.add(shakeOffset);
    finish.update(shake, renderer.toneMappingExposure);
    const fx = pickScreen(live);
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

  let lastFrameAt = performance.now();
  renderer.setAnimationLoop(() => {
    lastFrameAt = performance.now();
    // Clamp so a backgrounded tab doesn't dump one huge step on return.
    const rawDt = Math.min(clock.getDelta(), 0.1);
    if (!view.paused) step(rawDt * view.timeScale);
    if (!heroMode.enabled) controls.update();
    if (!view.covered) render();
    hooks.frame?.(rawDt);
  });

  // A background tab: requestAnimationFrame stops, but a network duel must keep running (spells reach their impact
  // and this side's hits get reported). When no frame came for 250 ms, step the simulation from a timer in 1/30 s
  // substeps of the real time that passed (browsers slow background timers down to about once a second).
  if (opts.background) {
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      let t = Math.min((now - last) / 1000, 2);
      last = now;
      if (now - lastFrameAt < 250 || view.paused) return;
      while (t > 1e-4) {
        const dt = Math.min(t, 1 / 30);
        step(dt);
        t -= dt;
      }
    }, 100);
  }

  // Nothing active yet: the default night, the arena hidden until something needs it.
  activate(null);

  return {
    hooks,
    renderer,
    composer,
    scene,
    camera,
    controls,
    arena,
    heroMode,
    duel,
    telegraphs,
    slots,
    kits: HERO_KITS,
    bloom,
    state,
    view,
    /** The active effect slot, the danger zones of its last play, and the seconds since it played. */
    get active() { return active; },
    get zones() { return zones; },
    get effectClock() { return effectClock; },
    applyBloom,
    setStage,
    castAs,
    clearEffects,
    ensureEffect,
    activate,
    selectEffect,
    setPlayMode,
    setHeroMode,
    setDuel,
    setKit,
    placeEffect,
    pixelScale,
    step,
    render,
  };
}
