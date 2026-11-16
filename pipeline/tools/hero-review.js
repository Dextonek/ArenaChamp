// The heroes' model review (docs/heroes/review/): a measured check of every hero of the fourth style through every clip
// the game plays on it, for clipping and feet. The game's own figure (HeroFigure.followReal, as in a fight) is posed
// state by state; every vertex is skinned on the CPU, and four things are measured:
// - held: a thing in a hand (a staff, a blade: bound to hand_l / hand_r, more than 13 cm from the wrist) inside the body,
//   the head, the other arm, the robe or the cape (anything but its own hand and forearm);
// - arm: a forearm or a hand inside the chest, the hips, the legs, the robe or the head;
// - poke: a leg that is inside a skirt, robe or coat while standing and comes out through it (a shin through a hem);
// - feet: the lowest foot vertex under the floor, or (standing) above it.
// "Inside" is the nearest vertex of the other part within 12 cm with the point behind its surface (its normal) by more
// than 1.5 cm (2 cm for an arm), and not mostly beside it. Depths are in the game's metres (the model x HERO_SCALE).
// Run with pipeline/tools/page-shots.py on the game page; `?only=astral,forge` limits the heroes (theme names):
//   python pipeline/tools/page-shots.py pipeline/tools/hero-review.js <out> --page "/game?only=astral" --port 5197 --json review.json
// It returns per hero the worst of each kind per state, and (with `&pics=1`) a picture of each state that was flagged,
// the offending points marked in red.
const t00 = performance.now();
while (!(window.game && game.api) && performance.now() - t00 < 120000) await new Promise((r) => setTimeout(r, 200));
const { HeroPreview } = await import('/src/game/heroPreview.ts');
const { castStyle } = await import('/src/heroFigure.ts');
const pv = (window._v4pv ??= new HeroPreview());
const fig = pv.figure;
const V = pv.at.constructor, M4 = pv.camera.matrixWorld.constructor;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = new URLSearchParams(location.search);
const only = (q.get('only') ?? '').split(',').filter(Boolean);
const pics = q.get('pics') === '1';
const kits = game.api.kits.flatMap((k) => (k.alt ? [k, k.alt] : [k]));
const themeOf = (k) => /models\/heroes\/([a-z]+)_v4\.glb$/.exec(k.model ?? '')?.[1];
const list = kits.filter((k) => themeOf(k) && (!only.length || only.includes(themeOf(k))));

const SCALE = 1.3;
const NEAR = 0.12, IN_HELD = 0.015, IN_ARM = 0.02, OUT_POKE = 0.012;
const HAND = /^(hand|thumb|index|middle|ring|pinky)_/;
const FORE = /^(lowerarm|hand|thumb|index|middle|ring|pinky)_/;
const ARM = /^(clavicle|upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/;
const LEGB = /^(thigh|calf|foot|ball)_/;
const FOOT = /^(foot|ball)_/;
const sideOf = (n) => (/_l$/.test(n) ? 'l' : /_r$/.test(n) ? 'r' : '');

const load = async (k) => {
  fig.atEase = false;
  pv.shown = undefined;
  pv.show(k.model, k);
  const t0 = performance.now();
  while (!fig.loaded && performance.now() - t0 < 30000) await sleep(30);
  return fig.real;
};

/** The model's vertices, every mesh in one list: rest data and a category each. */
function gather(real) {
  const meshes = [];
  real.root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const bones = meshes[0].skeleton.bones;
  const V0 = [];
  for (const m of meshes) {
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
    const bi = meshes[0].skeleton.bones === m.skeleton.bones ? null : m.skeleton.bones.map((b) => bones.indexOf(b));
    const skin = /^MI_Superhero/.test(m.material.name);
    for (let i = 0; i < P.count; i++) {
      const idx = [SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)].map((j) => (bi ? bi[j] : j));
      const w = [SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i)];
      let d = 0;
      for (let j = 1; j < 4; j++) if (w[j] > w[d]) d = j;
      const p = new V(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(m.bindMatrix);
      const n = new V(N.getX(i), N.getY(i), N.getZ(i)).transformDirection(m.bindMatrix);
      V0.push({ p, n, idx, w, dom: bones[idx[d]].name, domW: w[d], skin, mat: m.material.name });
    }
  }
  return { meshes, bones, V0 };
}

/** Skins every vertex into the root's own frame (model units), with normals. */
function skinAll(real, G, out) {
  real.root.updateMatrixWorld(true);
  const inv = real.root.matrixWorld.clone().invert();
  const mesh = G.meshes[0];
  const B = G.bones.map((b, i) => new M4().multiplyMatrices(inv, b.matrixWorld).multiply(mesh.skeleton.boneInverses[i]));
  const e = B.map((m) => m.elements);
  for (let i = 0; i < G.V0.length; i++) {
    const v = G.V0[i], o = (out[i] ??= { p: new V(), n: new V() });
    let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
    const px = v.p.x, py = v.p.y, pz = v.p.z, qx = v.n.x, qy = v.n.y, qz = v.n.z;
    for (let j = 0; j < 4; j++) {
      const w = v.w[j];
      if (w <= 0) continue;
      const m = e[v.idx[j]];
      x += w * (m[0] * px + m[4] * py + m[8] * pz + m[12]);
      y += w * (m[1] * px + m[5] * py + m[9] * pz + m[13]);
      z += w * (m[2] * px + m[6] * py + m[10] * pz + m[14]);
      nx += w * (m[0] * qx + m[4] * qy + m[8] * qz);
      ny += w * (m[1] * qx + m[5] * qy + m[9] * qz);
      nz += w * (m[2] * qx + m[6] * qy + m[10] * qz);
    }
    o.p.set(x, y, z);
    o.n.set(nx, ny, nz).normalize();
  }
  return out;
}

/** A grid of points for nearest-vertex queries. */
function grid(S, ids, cell = 0.04) {
  const m = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  for (const i of ids) {
    const p = S[i].p, k = key(Math.floor(p.x / cell), Math.floor(p.y / cell), Math.floor(p.z / cell));
    let a = m.get(k);
    if (!a) m.set(k, (a = []));
    a.push(i);
  }
  return {
    near(p, r = NEAR) {
      const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell), n = Math.ceil(r / cell);
      let best = -1, bd = r * r;
      for (let dx = -n; dx <= n; dx++) for (let dy = -n; dy <= n; dy++) for (let dz = -n; dz <= n; dz++) {
        const a = m.get(key(cx + dx, cy + dy, cz + dz));
        if (!a) continue;
        for (const i of a) {
          const d = S[i].p.distanceToSquared(p);
          if (d < bd) { bd = d; best = i; }
        }
      }
      return best;
    },
  };
}

/** How far `p` is behind the surface at vertex j (positive = inside), or 0 when it is beside it rather than behind it. */
const depth = (S, p, j) => {
  const q0 = S[j], dx = p.x - q0.p.x, dy = p.y - q0.p.y, dz = p.z - q0.p.z;
  const along = dx * q0.n.x + dy * q0.n.y + dz * q0.n.z;
  const side = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
  return side > 2 * Math.abs(along) + 0.03 ? 0 : -along;
};

/** The states of a fight, each a list of frames ({ n: frames to run first, then a sample }). */
function states(k) {
  const melee = !!k.melee;
  const st = [];
  const idle = { name: 'idle', frames: [{ n: 90 }, { n: 25 }, { n: 25 }, { n: 25 }], ground: 'stand' };
  st.push(idle);
  for (const [name, v] of [['walk', 1.6], ['run', 4.2], ['sprint', 7.5], ['back', -3]]) {
    const fr = [{ n: 50, walk: v }];
    for (let i = 0; i < 6; i++) fr.push({ n: 6, walk: v });
    st.push({ name, frames: fr, ground: 'move' });
  }
  const wind = (n) => ({ n, state: (i) => ({ attack: { wind: Math.min(1, i / 24), release: 0, melee } }) });
  const after = (n) => ({ n, state: () => ({ attack: { wind: -1, release: 10, melee } }) });
  st.push({ name: 'attack', frames: [{ n: 60 }, wind(8), wind(8), wind(8), after(3), after(6), after(8), after(10)], ground: 'act', keepState: true });
  k.spells.forEach((sp, i) => {
    const style = castStyle(sp, i, true, melee, 0.6);
    const fr = [{ n: 60 }, { n: 4, before: () => fig.cast(style, 0.6, i === 3) }];
    for (let j = 0; j < 7; j++) fr.push({ n: 6 });
    st.push({ name: `${'QWER'[i]} ${sp.name ?? ''} (${style})`, frames: fr, ground: 'act' });
  });
  st.push({ name: 'hit', frames: [{ n: 60 }, { n: 2, before: () => fig.hit(1) }, { n: 6 }, { n: 8 }], ground: 'act' });
  st.push({ name: 'stun', frames: [{ n: 40, state: () => ({ status: { stunned: true } }) }, { n: 20, state: () => ({ status: { stunned: true } }) }], ground: 'act' });
  st.push({ name: 'knock-up', frames: [{ n: 30, state: () => ({ status: { lift: 1 } }) }, { n: 15, state: () => ({ status: { lift: 1 } }) }], ground: 'air' });
  st.push({ name: 'death', frames: [{ n: 30 }, { n: 1, before: () => fig.fall(0.3) }, { n: 1, before: () => fig.fall(0.6) }, { n: 1, before: () => fig.fall(0.95) }], ground: 'dead' });
  return st;
}

const results = {}, shots = {};
const REPORT = { held: +(q.get('rh') ?? 0.03), arm: +(q.get('ra') ?? 0.04), poke: +(q.get('rp') ?? 0.025) };
const slug = (t) => t.replace(/\(.*\)/, '').trim().replace(/[^A-Za-z0-9]+/g, '-').slice(0, 30);
// three's own module, as the game loaded it (for the red marks)
const THREE = await (async () => {
  const src = await (await fetch('/src/motion/real.ts')).text();
  const url = /from ["']([^"']*three[^"']*\.js[^"']*)["']/.exec(src)?.[1];
  return import(url);
})();
/** The pose as it is now, from the front three-quarter and the side, the points in `ids` marked red. */
function picture(real, S, ids, title) {
  const W = 360, H = 460, c = document.createElement('canvas');
  c.width = W * 3; c.height = H + 24;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fc8'; g.font = 'bold 15px sans-serif'; g.fillText(title, 8, 17);
  const geo = new THREE.BufferGeometry().setFromPoints(ids.map((i) => S[i].p));
  const dots = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xff2020, size: 5, sizeAttenuation: false, depthTest: false }));
  dots.renderOrder = 99;
  real.root.add(dots);
  real.root.updateMatrixWorld(true);
  const ctr = new V();
  for (const i of ids) ctr.add(S[i].p);
  ctr.multiplyScalar(1 / Math.max(1, ids.length));
  const wc = real.root.localToWorld(ctr.clone()), base = real.root.getWorldPosition(new V());
  const views = [[0.7, 6.0, base.clone().setY(base.y + 1.2)], [Math.PI / 2, 6.0, base.clone().setY(base.y + 1.2)], [0.35, 2.2, wc]];
  views.forEach(([yaw, dist, look], k) => {
    const cy = k === 2 ? look.y + 0.4 : base.y + 1.45;
    pv.camera.position.set(look.x + Math.sin(yaw) * dist, cy, look.z + Math.cos(yaw) * dist);
    pv.camera.lookAt(look);
    pv.renderer.setSize(W * 2, H * 2, false);
    pv.camera.aspect = W / H;
    pv.camera.updateProjectionMatrix();
    pv.renderer.render(pv.scene, pv.camera);
    g.drawImage(pv.canvas, k * W, 24, W, H);
  });
  real.root.remove(dots);
  geo.dispose();
  return c.toDataURL('image/jpeg', 0.85);
}
for (const k of list) {
  const theme = themeOf(k);
  const real = await load(k);
  if (!real?.loaded) { results[theme] = { error: 'not loaded' }; continue; }
  fig.stand();
  const G = gather(real);
  // categories, from the idle pose (the hand's own place)
  const pos = new V();
  for (let f = 0; f < 60; f++) fig.follow(1 / 60, pos, 0, {});
  const S = skinAll(real, G, []);
  const handAt = { l: real.root.worldToLocal(G.bones.find((b) => b.name === 'hand_l').getWorldPosition(new V())), r: real.root.worldToLocal(G.bones.find((b) => b.name === 'hand_r').getWorldPosition(new V())) };
  const cat = G.V0.map((v, i) => {
    const s = sideOf(v.dom);
    if (/^hand_/.test(v.dom) && v.domW > 0.98 && S[i].p.distanceTo(handAt[s]) > 0.13) return 'held_' + s;
    if (FORE.test(v.dom)) return 'fore_' + s;
    if (ARM.test(v.dom)) return 'upper_' + s;
    if (LEGB.test(v.dom)) return 'leg';
    if (/^(Head|neck)/.test(v.dom)) return 'head';
    return 'torso';
  });
  const ids = (f) => cat.map((c, i) => (f(c, i) ? i : -1)).filter((i) => i >= 0);
  const every = (ids, n) => (ids.length <= n ? ids : ids.filter((_, j) => j % Math.ceil(ids.length / n) === 0));
  // loose cloth: off the skin by more than 2.5 cm in the idle pose, on the hips, the chest or the legs
  const skinIds = ids((c, i) => G.V0[i].skin);
  const gSkin = grid(S, skinIds);
  const loose = cat.map((c, i) => !G.V0[i].skin && (c === 'torso' || c === 'leg') && (() => { const j = gSkin.near(S[i].p, 0.2); return j < 0 || S[j].p.distanceTo(S[i].p) > 0.025; })());
  const looseIds = loose.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
  // legs inside the loose cloth when standing
  const gLoose = grid(S, looseIds);
  const legIn = every(ids((c, i) => c === 'leg' && !loose[i]), 1500).filter((i) => { const j = gLoose.near(S[i].p); return j >= 0 && depth(S, S[i].p, j) > 0.005; });
  const held = { l: every(ids((c) => c === 'held_l'), 700), r: every(ids((c) => c === 'held_r'), 700) };
  const fore = { l: every(ids((c) => c === 'fore_l'), 500), r: every(ids((c) => c === 'fore_r'), 500) };
  const feet = ids((c, i) => FOOT.test(G.V0[i].dom));
  const all = cat.map((_, i) => i);
  const info = { verts: G.V0.length, held: { l: ids((c) => c === 'held_l').length, r: ids((c) => c === 'held_r').length }, loose: looseIds.length, legsInCloth: legIn.length };
  const rows = [];
  const flagged = [];
  for (const s of states(k)) {
    fig.stand();
    fig.setModel(k.model, pos.set(0, 0, 0), k);
    const p = new V();
    let worst = { held: 0, arm: 0, poke: 0, below: 0, above: -9 }, what = {}, frameAt = {};
    let fi = 0, armOut = 0;
    const shotAt = {};
    for (const fr of s.frames) {
      for (let j = 0; j < fr.n; j++) {
        if (fr.before && j === 0) fr.before();
        if (fr.walk) p.z += fr.walk / 60;
        fig.group.rotation.y = 0;
        fig.follow(1 / 60, p, 0, fr.state ? fr.state(j) : {});
      }
      if (fi++ === 0) continue;
      armOut = Math.max(armOut, ...(real.armsOut ?? [0, 0]));
      skinAll(real, G, S);
      const at = 0;
      const bad = { held: [], arm: [], poke: [] }, top = { held: 0, arm: 0, poke: 0 };
      // held things: against everything but their own hand and forearm
      for (const sd of ['l', 'r']) {
        if (!held[sd].length) continue;
        const tgt = grid(S, all.filter((i) => cat[i] !== `held_${sd}` && cat[i] !== `fore_${sd}`));
        for (const i of held[sd]) {
          const j = tgt.near(S[i].p);
          if (j < 0) continue;
          const d = depth(S, S[i].p, j);
          if (d > IN_HELD) { bad.held.push(i); top.held = Math.max(top.held, d * SCALE); }
          if (d > IN_HELD && d * SCALE > worst.held) { worst.held = d * SCALE; what.held = `${sd} hand's item in ${cat[j]}${loose[j] ? ' (cloth)' : ''}`; frameAt.held = { fi, i }; }
        }
      }
      // forearms and hands: against the chest, hips, legs, cloth and head
      if (s.ground !== 'dead') {
        const tgt = grid(S, all.filter((i) => cat[i] === 'torso' || cat[i] === 'leg' || cat[i] === 'head'));
        for (const sd of ['l', 'r']) for (const i of fore[sd]) {
          const j = tgt.near(S[i].p);
          if (j < 0) continue;
          const d = depth(S, S[i].p, j);
          if (d > IN_ARM) { bad.arm.push(i); top.arm = Math.max(top.arm, d * SCALE); }
          if (d > IN_ARM && d * SCALE > worst.arm) { worst.arm = d * SCALE; what.arm = `${sd} forearm/hand in ${cat[j]}${loose[j] ? ' (cloth)' : ''}`; frameAt.arm = { fi, i }; }
        }
      }
      // legs out through the cloth
      if (legIn.length && s.ground !== 'dead') {
        const gl = grid(S, looseIds);
        for (const i of legIn) {
          const j = gl.near(S[i].p);
          if (j < 0) continue;
          const d = -depth(S, S[i].p, j);
          if (d > OUT_POKE) { bad.poke.push(i); top.poke = Math.max(top.poke, d * SCALE); }
          if (d > OUT_POKE && d * SCALE > worst.poke) { worst.poke = d * SCALE; what.poke = 'leg out through cloth'; frameAt.poke = { fi, i }; }
        }
      }
      if (pics) for (const kind of ['held', 'arm', 'poke']) {
        if (top[kind] >= REPORT[kind] && top[kind] >= (shotAt[kind] ?? 0)) {
          shotAt[kind] = top[kind];
          shots[`${theme}__${slug(s.name)}__${kind}`] = picture(real, S, bad[kind], `${k.name}: ${s.name}, ${kind} ${(top[kind] * 100).toFixed(0)} cm`);
        }
      }
      // feet
      if (s.ground === 'stand' || s.ground === 'move' || s.ground === 'act') {
        let lo = 9;
        for (const i of feet) lo = Math.min(lo, S[i].p.y - at);
        worst.below = Math.max(worst.below, -lo * SCALE);
        worst.above = Math.max(worst.above, lo * SCALE);
      }
      if (s.ground === 'dead') {
        let lo = 9;
        for (const i of all) lo = Math.min(lo, S[i].p.y - at);
        worst.below = Math.max(worst.below, -lo * SCALE);
      }
    }
    const row = { state: s.name, held: +worst.held.toFixed(3), arm: +worst.arm.toFixed(3), poke: +worst.poke.toFixed(3), below: +worst.below.toFixed(3), above: s.ground === 'stand' ? +worst.above.toFixed(3) : undefined, armOut: Math.round(armOut * 57.3), what, frameAt };
    rows.push(row);
  }
  fig.stand();
  results[theme] = { hero: k.name, info, rows };
}
return { results, ms: Math.round(performance.now() - t00), ...shots };
