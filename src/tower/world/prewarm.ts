import * as THREE from 'three';
import { MinionFx } from '../../effects/parts/minion';
import { TelegraphLayer } from '../../effects/telegraph';
import type { GameApi } from '../../runtime';
import type { EnemySpec } from './def';
import { lookOf } from './looks';

/**
 * The first enemy of a session froze the game about 0.4 s while its shaders were built (pipeline/designs/tower-50.md): the floor's
 * fight is compiled behind the loading page (`runtime.ts` `warmUp`), but no enemy exists then (a pack appears when the hero comes near).
 * So, when a floor's fight begins, one figure of every kind on the floor (and a red zone of the packs' tactics, tactics.ts) stands
 * 400 m under the ground, in the scene, where the warm-up compiles it; it stays there with its materials alive (so their shaders are not
 * let go) until the zone goes. Out of every view and every shadow's box, it is culled and never drawn.
 * `globalThis.__noPrewarm = true` before a floor starts leaves it out (for the A/B).
 */
export function prewarmFoes(api: GameApi, enemies: Record<string, EnemySpec>) {
  if ((globalThis as { __noPrewarm?: boolean }).__noPrewarm) return { dispose() {} };
  const group = new THREE.Group();
  group.name = 'prewarm-foes';
  group.position.set(0, -400, 0);
  const seen = new Set<string>();
  for (const spec of Object.values(enemies)) {
    const key = `${spec.look}|${spec.melee}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fx = new MinionFx();
    fx.setup(spec.melee ? 'melee' : 'ranged', spec.color, false, lookOf(spec));
    fx.group.position.x = seen.size * 2;
    group.add(fx.group, fx.bar);
  }
  const zones = new TelegraphLayer();
  zones.set([{ shape: { kind: 'circle', x: 0, z: 0, radius: 2 }, start: 0, impact: 1 }, { shape: { kind: 'line', x1: 0, z1: 0, x2: 0, z2: 6, width: 1.5 }, start: 0, impact: 1 }]);
  zones.update(0.5);
  group.add(zones.group);
  api.arena.group.add(group);
  return {
    dispose() {
      zones.set([]);
      group.removeFromParent();
    },
  };
}
