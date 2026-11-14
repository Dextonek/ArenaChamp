// "Nothing else moved" (the props pass, 2026-11-14): a print of everything a floor draws, to lay one checkout's beside another's. Each
// floor is built in the game (world-tool.js `_world`); every vertex of every mesh of its zone (and every instance of an instanced one) is
// put in its 4 m square and the square gets a count and an order-free hash of the rounded positions (1 cm). Two prints differ only in
// the squares where something drawn changed. The scenes' and the depth's records are listed too (kind and place). Needs no hooks in the
// game: run it on the branch's base (a git worktree) and on the branch, then compare (pipeline/tools/props-same.py).
//   eval(await (await fetch('/pipeline/tools/props-same.js')).text());
//   await _propsPrint([1, 2])            // -> [{ floor, cells: { 'i:j': [count, hash] }, scenes: ['kind x z'], packs: [...] }]
(() => {
  const mix = (h, v) => (Math.imul(h ^ v, 0x5bd1e995) ^ (h >>> 15)) >>> 0;
  window._propsPrint = async (floors, o = {}) => {
    if (!window._world) eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
    const THREE = await import('/node_modules/three/build/three.module.js');
    const out = [];
    for (const n of floors) {
      await _world({ floor: n, hero: 'Kaia' });
      _world.packs(false);
      await new Promise((ok) => setTimeout(ok, o.wait ?? 2500)); // the harbour file's props
      const api = window.game?.api ?? { arena: vfx.arena };
      let root = api.arena.caster.group, zg = null;
      while (root.parent) root = root.parent;
      root.traverse((x) => { if (!zg && x.isMesh && x.geometry?.type === 'PlaneGeometry' && x.geometry.parameters.widthSegments > 50) zg = x.parent; });
      const cells = new Map(), v = new THREE.Vector3(), m = new THREE.Matrix4(), w = new THREE.Matrix4();
      const put = (x, y, z, tag) => {
        const k = `${Math.floor(x / 4)}:${Math.floor(z / 4)}`, c = cells.get(k) ?? [0, 0];
        const h = mix(mix(mix(tag, Math.round(x * 100)), Math.round(y * 100)), Math.round(z * 100));
        c[0]++; c[1] = (c[1] + h) >>> 0; // a sum: the same whatever the order
        cells.set(k, c);
      };
      zg.updateMatrixWorld(true);
      let meshes = 0;
      zg.traverse((x) => {
        if (!x.visible || !x.geometry?.attributes?.position || x.isPoints) return;
        const P = x.geometry.attributes.position, tag = (x.material?.color ? x.material.color.getHex() : 7) >>> 0;
        meshes++;
        if (x.isInstancedMesh) {
          for (let i = 0; i < x.count; i++) { x.getMatrixAt(i, m); w.multiplyMatrices(x.matrixWorld, m); v.setFromMatrixPosition(w); put(v.x, v.y, v.z, tag ^ 0x9e37); }
          return;
        }
        if (x.geometry.type === 'PlaneGeometry' && x.geometry.parameters.widthSegments > 50) return; // the ground: not a prop
        for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(x.matrixWorld); put(v.x, v.y, v.z, tag); }
      });
      const recs = [];
      zg.traverse((x) => { for (const key of ['seaScenes', 'woodScenes']) for (const s of x.userData?.[key] ?? []) recs.push(`${s.kind} ${s.x.toFixed(2)} ${s.z.toFixed(2)}`); });
      const g = _world.game();
      out.push({
        floor: n, meshes, cells: Object.fromEntries(cells), scenes: recs.sort(),
        spots: [...g.zone.packs.values()].map((p) => `${p.id}`).sort(), doors: g.floor.doors.map((d) => `${d.id} ${d.at.x.toFixed(2)} ${d.at.z.toFixed(2)}`),
      });
      _world.end();
    }
    return out;
  };
})();
