// Paste into the VFX tool page (browser javascript tool). Renders frames of an effect inside the page and copies the
// WebGL canvas into a 2-column JPEG contact sheet, so it works even when the browser pane is hidden (screenshots of
// a hidden pane show stale frames). Return the string from the tool call; the tool saves large results to a file;
// decode with `python pipeline/tools/decode-sheets.py <saved result> docs/spells`.
//
//   _review('supernova seed', 'supernova', [0.5, 1.2, 1.8, 2.0, 2.6, 3.6], { dist: 16, h: 6, ty: 3 })
//   -> 'SELF [label, ok, arenaHits, nanFrames, singularFrames, errors] NAME:<slug>|data:image/jpeg;base64,...'
//
// Options: dist / h / ty (camera distance behind the cast point toward the caster, camera height, look-at height),
// count (enemies), caster ([x, y, z] start position, e.g. [0, 0, -1] for self-mode spells), dur (selfTest seconds).
window._sheet = (times, cam) => {
  const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const W = 640, H = 400;
  const out = document.createElement('canvas');
  out.width = W * 2; out.height = H * Math.ceil(times.length / 2);
  const g = out.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, out.width, out.height);
  vfx.view.paused = true;
  const c = vfx.controls;
  if (cam) { c.enableDamping = false; c.object.position.set(...cam[0]); c.target.set(...cam[1]); c.update(); }
  times.forEach((t, i) => {
    vfx.scrub(t); vfx.render();
    const sw = gl.width, sh = gl.height, ar = W / H;
    let cw = sw, ch = sw / ar; if (ch > sh) { ch = sh; cw = sh * ar; }
    g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, (i % 2) * W, Math.floor(i / 2) * H, W, H);
    g.fillStyle = '#fff'; g.font = '20px sans-serif'; g.fillText('t=' + t, (i % 2) * W + 8, Math.floor(i / 2) * H + 24);
  });
  return out.toDataURL('image/jpeg', 0.8);
};

window._review = (label, slug, times, o = {}) => {
  vfx.arena.caster.group.position.set(...(o.caster || [0, 0, 14]));
  vfx.arena.setCount(o.count || 5);
  const r = vfx.selfTest(label, o.dur || 6);
  vfx.view.paused = true; vfx.scrub(0.05);
  const P = vfx.effect.ctx.point, F = vfx.effect.ctx.from;
  let dx = F.x - P.x, dz = F.z - P.z, L = Math.hypot(dx, dz);
  if (L < 0.1) { dx = 0; dz = 1; L = 1; }
  dx /= L; dz /= L;
  const d = o.dist || 14, h = o.h || 6, ty = o.ty || 2;
  const cam = [[P.x + dx * d - dz * d * 0.35, h, P.z + dz * d + dx * d * 0.35], [P.x, ty, P.z]];
  const self = JSON.stringify([label, r.ok, r.arenaHits, r.nanFrames, r.singularFrames, r.errors.length]);
  return 'SELF ' + self + ' NAME:' + slug + '|' + _sheet(times, cam) + ' ';
};

// Several spells (or several times of one) on one sheet, each label self-tested once and framed like _review:
//   _multi('forge-recheck', [{ label: 'anvil drop', t: 0.6, dist: 13, h: 6, ty: 1.2, dur: 2.6, caster: [0, 0, 7] }, ...])
//   -> 'SELF [[label, ok, arenaHits, errors], ...] NAME:<slug>|data:image/jpeg;base64,...'
window._multi = (slug, items) => {
  const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const W = 640, H = 400, out = document.createElement('canvas');
  out.width = W * 2; out.height = H * Math.ceil(items.length / 2);
  const g = out.getContext('2d');
  const res = [];
  let last = null, cam;
  items.forEach((it, i) => {
    if (it.label !== last) {
      vfx.arena.caster.group.position.set(...(it.caster || [0, 0, 14]));
      vfx.arena.setCount(it.count || 5);
      const r = vfx.selfTest(it.label, it.dur || 5);
      res.push([it.label, r.ok, r.arenaHits, r.errors.length]);
      vfx.view.paused = true; vfx.scrub(0.05);
      const P = vfx.effect.ctx.point, F = vfx.effect.ctx.from;
      let dx = F.x - P.x, dz = F.z - P.z, L = Math.hypot(dx, dz);
      if (L < 0.1) { dx = 0; dz = 1; L = 1; }
      dx /= L; dz /= L;
      const d = it.dist || 14, h = it.h || 6, ty = it.ty || 2;
      cam = [[P.x + dx * d - dz * d * 0.35, h, P.z + dz * d + dx * d * 0.35], [P.x, ty, P.z]];
      last = it.label;
    }
    const c = vfx.controls;
    c.enableDamping = false; c.object.position.set(...cam[0]); c.target.set(...cam[1]); c.update();
    vfx.scrub(it.t); vfx.render();
    const sw = gl.width, sh = gl.height, ar = W / H;
    let cw = sw, ch = sw / ar; if (ch > sh) { ch = sh; cw = sh * ar; }
    g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, (i % 2) * W, Math.floor(i / 2) * H, W, H);
    g.fillStyle = '#fff'; g.font = '20px sans-serif';
    g.fillText(it.label + ' t=' + it.t, (i % 2) * W + 8, Math.floor(i / 2) * H + 24);
  });
  return 'SELF ' + JSON.stringify(res) + ' NAME:' + slug + '|' + out.toDataURL('image/jpeg', 0.8) + ' ';
};
