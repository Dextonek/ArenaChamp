// The model review, round 2 (docs/models/review/round2/): every hero, and every person of the Climb, on a plain floor in rows, Sefu and
// Kaia at the head of each row (the art bible's yardstick), standing through the hero figure code (so with the hero review's raise
// off the floor). From the front, a narrow lens so heights compare; dashed lines at Sefu's and Kaia's tops; under each figure its sole
// and its top (m, held things and headdresses included).
//   python -I pipeline/tools/page-shots.py pipeline/tools/lineup-plain.js <out folder> --port 5177 --json lineup.json --timeout 400
const { HeroPreview } = await import('/src/game/heroPreview.ts');
const { HeroFigure } = await import('/src/heroFigure.ts');
const { HERO_KITS } = await import('/src/heroes.ts');
const { TOWER_FOLK } = await import('/src/tower/world/folk.ts');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pv = new HeroPreview();
const { renderer, scene, camera } = pv;
const C = pv.at.constructor;
const plinth = scene.children.find((o) => o.isMesh && o.geometry.type === 'CylinderGeometry');
for (const o of scene.children) if (o.isMesh) o.visible = false;
plinth.visible = true; plinth.scale.set(30, 1, 30); plinth.material.color.setHex(0x55504a);
pv.figure.group.visible = false;
renderer.setPixelRatio(1);
renderer.setClearColor(0x2a2c30, 1);
camera.far = 400;
const kit = (n) => HERO_KITS.find((k) => k.name === n);
const FOOTB = /foot|ball|toe/i;
const measure = (root) => {
  root.updateMatrixWorld(true);
  let foot = 1e9, top = -1e9;
  const v = new C();
  root.traverse((m) => {
    if (!m.isSkinnedMesh || !m.visible) return;
    const n = m.geometry.attributes.position.count, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, bones = m.skeleton.bones;
    for (let i = 0; i < n; i += 3) {
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
      let fw = 0; for (let k = 0; k < 4; k++) if (FOOTB.test(bones[si.getComponent(i, k)]?.name ?? '')) fw += sw.getComponent(i, k);
      if (fw > 0.5) foot = Math.min(foot, v.y);
      top = Math.max(top, v.y);
    }
  });
  return { sole: +foot.toFixed(2), top: +top.toFixed(2) };
};
const heroes = HERO_KITS.map((k) => k.name).filter((n) => n !== 'Sefu' && n !== 'Kaia');
const rows = [];
for (let i = 0; i < heroes.length; i += 10) rows.push(heroes.slice(i, i + 10).map((n) => ({ label: n, model: kit(n).model, kit: kit(n) })));
for (let i = 0; i < TOWER_FOLK.length; i += 9) rows.push(TOWER_FOLK.slice(i, i + 9).map((f) => ({ label: f.name.replace(/^The /, ''), model: `models/tower/${f.id}_v4.glb`, kit: kit(f.stand) })));
const out = { metrics: [] };
const W = 1500, H = 430, GAP = 1.25;
for (const [ri, row] of rows.entries()) {
  const list = [{ label: 'Sefu', model: kit('Sefu').model, kit: kit('Sefu') }, { label: 'Kaia', model: kit('Kaia').model, kit: kit('Kaia') }, ...row];
  const figs = list.map((e, i) => {
    const fig = new HeroFigure();
    fig.atEase = true;
    scene.add(fig.group);
    const pos = new C((i - (list.length - 1) / 2) * GAP, 0, 0);
    fig.setModel(e.model, pos, e.kit);
    fig.stand?.();
    return { ...e, fig, pos };
  });
  for (let k = 0; k < 400 && figs.some((f) => !f.fig.loaded); k++) await sleep(50);
  for (let k = 0; k < 40; k++) for (const f of figs) f.fig.follow(1 / 60, f.pos, 0, {});
  const span = list.length * GAP;
  camera.fov = 14;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  const dist = (span / 2 + 0.6) / Math.tan((camera.fov * camera.aspect * Math.PI) / 360);
  camera.position.set(0, 1.5, dist);
  camera.lookAt(0, 1.5, 0);
  camera.updateMatrixWorld();
  renderer.setSize(W, H, false);
  renderer.render(scene, camera);
  const c = document.createElement('canvas');
  c.width = W; c.height = H + 40;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1c20'; g.fillRect(0, 0, W, H + 40);
  g.drawImage(renderer.domElement, 0, 0);
  const sx = (p) => { const q = p.clone().project(camera); return [(q.x * 0.5 + 0.5) * W, (-q.y * 0.5 + 0.5) * H]; };
  const ms = figs.map((f) => measure(f.fig.group));
  for (const [k, col] of [[0, '#ffd27a'], [1, '#8fd0ff']]) {
    const [, y] = sx(new C(0, ms[k].top, 0));
    g.strokeStyle = col; g.setLineDash([8, 6]); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  g.setLineDash([]);
  g.font = '600 12px sans-serif'; g.textAlign = 'center';
  figs.forEach((f, i) => {
    const [x] = sx(f.pos);
    g.fillStyle = '#ffd27a'; g.fillText(f.label.slice(0, 16), x, H + 14);
    g.fillStyle = '#bbb'; g.fillText(`${ms[i].top.toFixed(2)} m`, x, H + 30);
    out.metrics.push({ row: ri, who: f.label, ...ms[i] });
  });
  out[`lineup-${ri + 1}`] = c.toDataURL('image/jpeg', 0.86);
  for (const f of figs) f.fig.group.removeFromParent();
}
return out;
