import * as THREE from 'three';
import { MinionFx } from '../../effects/parts/minion';
import { TelegraphLayer } from '../../effects/telegraph';
import type { GameApi } from '../../runtime';
import type { EnemySpec } from './def';
import { BUILT, FOE_MODELS } from './foeKinds';
import { preloadFoe, returnFoe } from './foeModels';
import { codeLookOf } from './looks';

/**
 * The first enemy of a session froze the game about 0.4 s while its shaders were built (pipeline/designs/tower-50.md): the floor's
 * fight is compiled behind the loading page (`runtime.ts` `warmUp`), but no enemy exists then (a pack appears when the hero comes near).
 * So, when a floor's fight begins, one figure of every kind on the floor (and a red zone of the packs' tactics, tactics.ts) stands
 * 400 m under the ground, in the scene, where the warm-up compiles it; it stays there with its materials alive (so their shaders are not
 * let go) until the zone goes. Out of every view and every shadow's box, it is culled and never drawn.
 *
 * The kinds drawn from a model (foeKinds.ts) have their file loaded here too, and one figure of each stands with the others. A file
 * that lands after the warm-up has run is compiled on its own: the renderer is taken from a mesh that draws nothing (`onBeforeRender`
 * hands it over, with the target and the camera the scene is drawn with), and the loaded figures are compiled for that target, outside
 * the frame. The figures go back to their files' pools when the zone goes, so the first pack takes them ready-made.
 * `globalThis.__noPrewarm = true` before a floor starts leaves it all out (for the A/B).
 */
export function prewarmFoes(api: GameApi, enemies: Record<string, EnemySpec>) {
  if ((globalThis as { __noPrewarm?: boolean }).__noPrewarm) return { dispose() {} };
  const group = new THREE.Group();
  group.name = 'prewarm-foes';
  group.position.set(0, -400, 0);
  const seen = new Set<string>();
  const files = new Set<string>();
  for (const spec of Object.values(enemies)) {
    const m = FOE_MODELS[spec.look as string];
    if (m && BUILT.has(m.id) && !(globalThis as { __codeFoes?: boolean }).__codeFoes) files.add(m.id);
    const key = `${spec.look}|${spec.melee}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // The code look in any case: a model kind shows it while its file loads.
    const fx = new MinionFx();
    fx.setup(spec.melee ? 'melee' : 'ranged', spec.color, false, codeLookOf(spec));
    fx.group.position.x = seen.size * 2;
    group.add(fx.group, fx.bar);
  }
  const zones = new TelegraphLayer();
  zones.set([{ shape: { kind: 'circle', x: 0, z: 0, radius: 2 }, start: 0, impact: 1 }, { shape: { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 6, width: 1.5 }, start: 0, impact: 1 }]);
  zones.update(0.5);
  group.add(zones.group);
  api.arena.group.add(group);

  // The models: loaded now, stood beside the others, compiled when they have landed.
  let gone = false;
  const held: { id: string; fig: import('../../motion/real').RealHero }[] = [];
  let seenBy: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera; target: THREE.WebGLRenderTarget | null } | null = null;
  let hook: THREE.Mesh | null = null;
  if (files.size) {
    // A mesh that draws nothing (no colour, no depth, never culled): only so that the renderer hands itself over.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    hook = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
    hook.frustumCulled = false;
    hook.onBeforeRender = (renderer, scene, camera) => {
      if (!seenBy && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) seenBy = { renderer, scene: scene as THREE.Scene, camera, target: renderer.getRenderTarget() };
    };
    group.add(hook);
    let x = 0;
    const loads = [...files].map((id) => preloadFoe(id).then((fig) => {
      if (gone) { returnFoe(id, fig); return; }
      fig.root.position.set(-4 - 2 * x++, 0, 0);
      group.add(fig.root);
      held.push({ id, fig });
    }));
    void Promise.all(loads).then(() => {
      const t0 = performance.now();
      const compile = () => {
        if (gone) return;
        const s = seenBy;
        if (!s) {
          if (performance.now() - t0 < 20000) setTimeout(compile, 100);
          return;
        }
        const before = s.renderer.getRenderTarget();
        try {
          s.renderer.setRenderTarget(s.target);
          void s.renderer.compileAsync(group, s.camera, s.scene).catch(() => undefined);
        } catch (e) {
          console.warn('Compiling the enemy models stopped early:', e);
        }
        s.renderer.setRenderTarget(before);
      };
      setTimeout(compile, 0);
    });
  }
  return {
    dispose() {
      gone = true;
      zones.set([]);
      group.removeFromParent();
      for (const h of held) returnFoe(h.id, h.fig);
      held.length = 0;
      if (hook) {
        hook.geometry.dispose();
        (hook.material as THREE.Material).dispose();
      }
    },
  };
}
