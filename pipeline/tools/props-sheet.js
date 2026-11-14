// Sheets of every kind of prop on a floor, each on its own (2026-11-14, the props pass): after `_propsProbe(floor)` (props-probe.js) has
// built the floor and recorded its parts, each kind (the line of code that placed it, a scene's name, a harbour-file prop) is drawn alone on
// the floor's own ground (the rest of the dressing hidden), the hero standing beside it for size, from the game's high camera and from low
// beside it. Twelve kinds a sheet (3 x 4 cells, each the two views side by side), returned as JPEG data URLs.
//   eval(await (await fetch('/pipeline/tools/props-sheet.js')).text());
//   const sheets = await _propsSheet({ per: 12, only: /scene:/ })   // -> [{ name, url, kinds: [...] }]
// `pick(kind, props)` chooses the example of a kind (default: the one nearest the walkable ground's middle); `at: { kind: propId }` forces one.
(() => {
  // the dressing's colours (land.ts PALETTE; the Wood scenes' C; woodDepth's C): a part's key to a colour
  const SEA = { wall: '#b4ab94', stone: '#4e4c4c', capstone: '#64605a', boulder: '#383c46', wood: '#4a3220', plank: '#6b4226', lacquer: '#1d1b21', wine: '#5e1a28', slate: '#3a3f4c', teal: '#2b5560', cream: '#d8cfb4', rock: '#615d5a', sail: '#d8cfb4', gold: '#c9a24a', rope: '#b89a5a', salt: '#e2dccc', leaf: '#4a6638', cloth: '#b9b2a0', iron: '#4d525e', canvas: '#a39a82', brass: '#b8923e' };
  const WOOD = { bark: '#3c2b1c', barkLight: '#5a4530', plank: '#6b4226', lacquer: '#1d1b21', wine: '#5e1a28', rope: '#b89a5a', stone: '#60645a', stoneDark: '#4a4c48', moss: '#55693c', straw: '#a88a4e', teal: '#2b5560', iron: '#3c3f47', ash: '#3a3836', cap: '#8a2e2a', stem: '#c9bfa4', cloth: '#7a6e5a', bread: '#9a6a34', green: '#4a6638', hide: '#7c5f3e', gold: '#b8923e' };
  const kindOf = (pr) => (pr.site.startsWith('scene:') ? pr.site : pr.site.startsWith('harbour-file') ? 'harbour-file ' + pr.parts.map((p) => p.site.split(' ')[1].replace(/_\d+$/, '')).sort()[0] : pr.site);
  window._propsSheet = async (o = {}) => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const RING = (await import('/src/arenas/common.ts')).RING;
    const api = window.game?.api ?? { arena: vfx.arena, heroMode: vfx.heroMode };
    const props = _propsProbe.props, ground = _propsProbe.ground, floor = _world.game().floor.n, PAL = floor <= 10 ? SEA : WOOD;
    const cam = vfx.controls.object, gl = [...document.querySelectorAll('canvas')].sort((x, y) => y.width * y.height - x.width * x.height)[0];
    // the zone's group (holding the ground) and what to hide
    let root = api.arena.caster.group, zg = null, gmesh = null;
    while (root.parent) root = root.parent;
    root.traverse((x) => { if (!zg && x.isMesh && x.geometry?.type === 'PlaneGeometry' && x.geometry.parameters.widthSegments > 50) { zg = x.parent; gmesh = x; } });
    // hide the rest of the dressing; keep the ground and the sea (a mesh of its own shader)
    const hidden = zg.children.filter((c) => c !== gmesh && c.visible && !(c.isMesh && c.material?.isShaderMaterial));
    for (const c of hidden) c.visible = false;
    // the kinds and their examples
    const kinds = new Map();
    for (const pr of props) { const k = kindOf(pr); if (!kinds.has(k)) kinds.set(k, []); kinds.get(k).push(pr); }
    const list = [...kinds.entries()].filter(([k]) => !o.only || o.only.test(k)).sort((a, b) => a[0].localeCompare(b[0]));
    const mats = new Map();
    const matOf = (key) => {
      const hex = key.startsWith('#') ? key : PAL[key] ?? SEA[key] ?? WOOD[key] ?? '#ff00ff';
      if (!mats.has(hex)) mats.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, metalness: /c9a24a|b8923e|b69242/.test(hex) ? 0.6 : 0, side: THREE.DoubleSide, flatShading: true }));
      return mats.get(hex);
    };
    const W = o.cell ?? 220, per = o.per ?? 12, cols = 3, sheets = [];
    const centreOf = (pr) => {
      const box = new THREE.Box3();
      for (const p of pr.parts) { const b = p.geo.boundingBox.clone().applyMatrix4(p.m); box.union(b); }
      return box;
    };
    const hero = api.arena.caster.group, keepHero = hero.position.clone(), keepCam = { p: cam.position.clone(), q: cam.quaternion.clone() };
    for (let s = 0; s * per < list.length; s++) {
      const chunk = list.slice(s * per, (s + 1) * per), rows = Math.ceil(chunk.length / cols);
      const out = document.createElement('canvas');
      out.width = cols * 2 * W; out.height = rows * (W + 22);
      const g = out.getContext('2d');
      g.fillStyle = '#101014'; g.fillRect(0, 0, out.width, out.height);
      const names = [];
      for (let i = 0; i < chunk.length; i++) {
        const [k, prs] = chunk[i];
        // the example: forced, or the one nearest the middle
        const pr = (o.at?.[k] !== undefined ? prs.find((q) => q.id === o.at[k]) : null) ?? prs.slice().sort((a, b) => Math.hypot(a.x - RING.x, a.z - RING.z) - Math.hypot(b.x - RING.x, b.z - RING.z))[0];
        const box = centreOf(pr), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
        const R = Math.max(0.6, Math.hypot(size.x, size.z) / 2, size.y / 2);
        const tmp = new THREE.Group();
        for (const p of pr.parts) { const m = new THREE.Mesh(p.geo, matOf(p.key)); m.matrixAutoUpdate = false; m.matrix.copy(p.m); m.castShadow = m.receiveShadow = true; tmp.add(m); }
        zg.add(tmp);
        // the hero beside it, east, on the ground
        const hx = c.x + Math.max(size.x / 2, 0.4) + 0.9, hz = c.z + 0.3;
        hero.position.set(hx, ground(hx, hz), hz);
        hero.updateMatrixWorld(true);
        const gy = ground(c.x, c.z), look = new THREE.Vector3(c.x + 0.45, Math.max(box.min.y, gy) + Math.min(size.y, 2.2) * 0.45, c.z);
        const views = [
          [look.clone().add(new THREE.Vector3(0, 15, 10.5).normalize().multiplyScalar(Math.max(7, R * 3.6))), look],
          [new THREE.Vector3(c.x - Math.max(3.2, R * 2.4) * 0.55, Math.max(gy, look.y - 0.3) + Math.max(0.9, R * 0.45), c.z + Math.max(3.2, R * 2.4) * 0.85), look],
        ];
        for (let v = 0; v < 2; v++) {
          cam.position.copy(views[v][0]);
          cam.lookAt(views[v][1]);
          cam.updateMatrixWorld();
          vfx.render();
          const sw = gl.width, sh = gl.height, side = Math.min(sw, sh) * 0.8;
          g.drawImage(gl, (sw - side) / 2, (sh - side) / 2, side, side, (i % cols) * 2 * W + v * W, Math.floor(i / cols) * (W + 22) + 22, W, W);
        }
        zg.remove(tmp);
        g.fillStyle = '#e8e2d0'; g.font = '12px sans-serif';
        const label = `${s * per + i + 1}. ${k.replace(/^scene:/, 'scene ')}  ${size.x.toFixed(1)}x${size.z.toFixed(1)}x${size.y.toFixed(1)} m  (${prs.length}x)`;
        g.fillText(label.slice(0, 64), (i % cols) * 2 * W + 4, Math.floor(i / cols) * (W + 22) + 15);
        names.push({ n: s * per + i + 1, kind: k, at: [+c.x.toFixed(1), +c.z.toFixed(1)], size: [+size.x.toFixed(2), +size.z.toFixed(2), +size.y.toFixed(2)], count: prs.length, prop: pr.id });
      }
      sheets.push({ name: `f${floor}-kinds-${s + 1}`, url: out.toDataURL('image/jpeg', o.q ?? 0.84), kinds: names });
    }
    for (const c of hidden) c.visible = true;
    hero.position.copy(keepHero);
    cam.position.copy(keepCam.p); cam.quaternion.copy(keepCam.q);
    for (const m of mats.values()) m.dispose();
    return sheets;
  };
})();
