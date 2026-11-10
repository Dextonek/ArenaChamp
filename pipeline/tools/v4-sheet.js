// A review sheet for heroes of the fourth style (public/models/heroes/<theme>_v4.glb), drawn by the game's own figure
// code in the hero stand's light: per hero a row of front, face, back, walking, the basic attack at its hit, and the
// game camera's view. Paste into the game page (browser javascript tool), with the frame sink running
// (node pipeline/tools/frame-sink.mjs <folder>):
//
//   eval(await (await fetch('/pipeline/tools/v4-sheet.js')).text());
//   await _v4sheet('sheet.jpg', ['astral', 'forge'])        // themes; the JPEG goes to the sink
//
// A theme's hero is the kit whose current model path contains that theme. Models are cached per page: reload the page
// after rebuilding a GLB.
window._v4sheet = async (file, themes, o = {}) => {
  const { HeroPreview } = await import('/src/game/heroPreview.ts');
  const pv = (window._v4pv ??= new HeroPreview());
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const V = pv.at.constructor;
  const W = o.w ?? 230, H = o.h ?? 300, label = 26;
  const wind = (u) => ({ n: Math.max(1, Math.round(24 * u)), state: (k, m) => ({ attack: { wind: k / 24, release: 0, melee: m } }) });
  const after = (s) => ({ n: Math.max(1, Math.round(60 * s)), state: (k, m) => ({ attack: { wind: -1, release: 10, melee: m } }) });
  const views = [
    { t: 'front', ease: true, yaw: 0.45, cam: [0, 1.35, 6.2], look: [0, 1.2, 0] },
    { t: 'face', ease: true, yaw: 0.25, face: true },
    { t: 'back', ease: true, yaw: Math.PI - 0.6, cam: [0, 1.35, 6.2], look: [0, 1.2, 0] },
    { t: 'walking', ease: false, yaw: 1.2, cam: [0, 1.35, 6.6], look: [0, 1.2, 0], frames: [{ n: 60 }, { n: 50, walk: 3.6 }] },
    { t: 'attack', ease: false, yaw: 0.8, cam: [0, 1.35, 6.6], look: [0, 1.2, 0], frames: [{ n: 60 }, wind(1), after(0.03)] },
    { t: 'game camera', ease: false, yaw: 0.3, cam: [0, 7.0, 5.0], look: [0, 1.0, 0] },
  ];
  const c = document.createElement('canvas');
  c.width = 120 + W * views.length;
  c.height = label + H * themes.length;
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#aaa';
  g.font = '14px sans-serif';
  views.forEach((v, i) => g.fillText(v.t, 120 + i * W + 6, 18));
  const missing = [];
  for (let r = 0; r < themes.length; r++) {
    const theme = themes[r];
    const kit = game.api.kits.find((k) => (k.model ?? '').includes(`/${theme}_`) || (k.model ?? '').includes(`/${theme}.`));
    const url = `models/heroes/${theme}_v4.glb`;
    g.fillStyle = '#fc8';
    g.font = 'bold 15px sans-serif';
    g.fillText(kit?.name ?? theme, 6, label + r * H + H / 2);
    if (!kit) { missing.push(theme); continue; }
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      pv.figure.atEase = v.ease;
      pv.shown = undefined;
      pv.show(url, kit);
      const t0 = performance.now();
      while (!pv.figure.loaded && performance.now() - t0 < 20000) await sleep(30);
      const melee = !!pv.figure.melee, pos = new V();
      for (const fr of v.frames ?? [{ n: 120 }]) for (let k = 0; k < fr.n; k++) {
        if (fr.walk) pos.z += fr.walk / 60;
        pv.figure.group.rotation.y = v.yaw;
        pv.figure.follow(1 / 60, pos, 0, fr.state ? fr.state(k, melee) : {});
      }
      const root = pv.figure.shown;
      root.position.x = 0;
      root.position.z = 0;
      if (v.face) {
        // the head, wherever this hero's build puts it
        root.updateMatrixWorld(true);
        const head = root.getObjectByName('Head')?.getWorldPosition(new V()) ?? new V(0, 2, 0);
        pv.camera.position.set(head.x + 0.25, head.y + 0.12, head.z + 1.5);
        pv.camera.lookAt(head.x, head.y + 0.1, head.z);
      } else {
        pv.camera.position.set(...v.cam);
        pv.camera.lookAt(...v.look);
      }
      pv.renderer.setSize(W * 2, H * 2, false);
      pv.camera.aspect = W / H;
      pv.camera.updateProjectionMatrix();
      pv.renderer.render(pv.scene, pv.camera);
      g.drawImage(pv.canvas, 120 + i * W, label + r * H, W, H);
    }
  }
  pv.camera.position.set(0, 1.55, 6.2);
  pv.camera.lookAt(0, 1.2, 0);
  const url = c.toDataURL('image/jpeg', 0.88), bin = atob(url.split(',')[1]), buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  await fetch('http://127.0.0.1:5199/' + file, { method: 'PUT', body: buf });
  return missing.length ? `no kit for ${missing.join(', ')}` : 'ok';
};

// Everyone side by side, standing as in a fight (staffs and shields held): `await _v4lineup('lineup.jpg')`. The picture
// in pipeline/designs/style-v4/lineup_v4.jpg is this.
window._v4lineup = async (file, cols = 8) => {
  const { HeroPreview } = await import('/src/game/heroPreview.ts');
  const pv = (window._v4pv ??= new HeroPreview());
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const V = pv.at.constructor, W = 190, H = 280, label = 20;
  const kits = game.api.kits.flatMap((k) => (k.alt ? [k, k.alt] : [k])).filter((k) => /_v4\.glb$/.test(k.model ?? ''));
  const c = document.createElement('canvas');
  c.width = W * cols;
  c.height = (H + label) * Math.ceil(kits.length / cols);
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < kits.length; i++) {
    const kit = kits[i], x = (i % cols) * W, y = Math.floor(i / cols) * (H + label);
    pv.figure.atEase = false;
    pv.shown = undefined;
    pv.show(kit.model, kit);
    const t0 = performance.now();
    while (!pv.figure.loaded && performance.now() - t0 < 20000) await sleep(30);
    const pos = new V();
    for (let k = 0; k < 90; k++) {
      pv.figure.group.rotation.y = 0.35;
      pv.figure.follow(1 / 60, pos, 0, {});
    }
    pv.camera.position.set(0, 1.45, 6.6);
    pv.camera.lookAt(0, 1.3, 0);
    pv.renderer.setSize(W * 2, H * 2, false);
    pv.camera.aspect = W / H;
    pv.camera.updateProjectionMatrix();
    pv.renderer.render(pv.scene, pv.camera);
    g.drawImage(pv.canvas, x, y, W, H);
    g.fillStyle = '#fc8';
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'center';
    g.fillText(kit.alt || !kit.base ? kit.name.replace(' and Pom', '') : 'Pom', x + W / 2, y + H + 14);
  }
  pv.camera.position.set(0, 1.55, 6.2);
  pv.camera.lookAt(0, 1.2, 0);
  const url = c.toDataURL('image/jpeg', 0.88), bin = atob(url.split(',')[1]), buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  await fetch('http://127.0.0.1:5199/' + file, { method: 'PUT', body: buf });
  return kits.length;
};
