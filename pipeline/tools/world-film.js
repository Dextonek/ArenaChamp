// Films a real run of floor 1 for the user (docs/tower/worlds/floor1.mp4): the route bot plays the floor through the real pieces
// (`_worldRoute`), and six moments of it are filmed frame by frame at true speed (two 1/60 s steps a frame, 30 frames a second),
// as `clip-film.js` does. The 3D view is the game's own camera; the page's own HUD (the floor panel, the talk card, banners, the
// duel's bars) is drawn on top by a small painter of the page's fixed-position elements (boxes, borders and text), since a canvas
// does not hold the page's HTML.
//
//   node pipeline/tools/frame-sink.mjs <folder>                     (a sink on 127.0.0.1:5199, ends itself after 9 minutes)
//   eval(await (await fetch('/pipeline/tools/world-tool.js')).text());
//   eval(await (await fetch('/pipeline/tools/world-film.js')).text());
//   _worldFilm({ hero: 'Lyra' })        // in the background; _worldFilm.status() says where it is; frames land as s1_0000.jpg ...
//   then per segment:  ffmpeg -framerate 30 -i s1_%04d.jpg -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 26 -movflags +faststart -an s1.mp4
//
// The page should be 16:9 (the tool resizes the pane to 960x540 for it).
(() => {
  const W = 640, H = 360;
  const painter = (g, S) => {
    const fixed = (e) => /position:\s*fixed/.test(e.getAttribute('style') || '');
    const roots = [...document.body.children].filter((e) => e.tagName !== 'CANVAS' && e.tagName !== 'STYLE' && fixed(e));
    const clear = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
    const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
    const text = (n, cs) => {
      const raw = n.textContent.replace(/\s+/g, ' ').trim();
      if (!raw) return;
      const t = cs.textTransform === 'uppercase' ? raw.toUpperCase() : raw;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      const rects = [...rg.getClientRects()].filter((r) => r.width > 0);
      if (!rects.length) return;
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${Math.max(5, parseFloat(cs.fontSize) * S)}px ${cs.fontFamily}`;
      g.fillStyle = cs.color;
      g.textBaseline = 'middle';
      if (cs.textShadow && cs.textShadow !== 'none') { g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 4; } else g.shadowBlur = 0;
      const words = t.split(' ');
      let w = 0;
      for (const r of rects) {
        let line = '';
        while (w < words.length) {
          const next = line ? `${line} ${words[w]}` : words[w];
          if (line && g.measureText(next).width > r.width * S * 1.04) break;
          line = next;
          w++;
        }
        if (line) g.fillText(line, r.left * S, (r.top + r.height / 2) * S);
      }
      g.shadowBlur = 0;
    };
    const paint = (e) => {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return
      // A shape cut out with clip-path (the duel's objective arrow) would come out as its box.
      if (cs.clipPath && cs.clipPath !== 'none') return;
      const r = e.getBoundingClientRect();
      const full = r.width >= innerWidth * 0.97 && r.height >= innerHeight * 0.97;
      const a = g.globalAlpha;
      g.globalAlpha = a * +cs.opacity;
      if (!full && r.width > 0 && r.height > 0) {
        const rad = (parseFloat(cs.borderTopLeftRadius) || 0) * S;
        if (!clear(cs.backgroundColor)) { g.fillStyle = cs.backgroundColor; rr(r.left * S, r.top * S, r.width * S, r.height * S, rad); g.fill(); }
        if (parseFloat(cs.borderTopWidth) > 0 && !clear(cs.borderTopColor)) { g.strokeStyle = cs.borderTopColor; g.lineWidth = Math.max(1, parseFloat(cs.borderTopWidth) * S); rr(r.left * S, r.top * S, r.width * S, r.height * S, rad); g.stroke(); }
      }
      for (const n of e.childNodes) { if (n.nodeType === 3) text(n, cs); else if (n.nodeType === 1 && n.tagName !== 'CANVAS' && n.namespaceURI !== 'http://www.w3.org/2000/svg') paint(n); }
      g.globalAlpha = a;
    };
    for (const r of roots) paint(r);
  };

  const status = { done: true, seg: '', shots: {}, err: null, log: [] };
  window._worldFilm = (o = {}) => {
    if (!status.done) return 'already running';
    Object.assign(status, { done: false, seg: '', shots: {}, err: null, log: [] });
    const sink = o.sink ?? 'http://127.0.0.1:5199';
    (async () => {
      try {
        const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
        const out = document.createElement('canvas');
        out.width = W; out.height = H;
        const g = out.getContext('2d');
        const sent = [];
        const S = W / innerWidth;
        let cur = null, steps = 0, seq = 0;
        const grab = () => {
          // A piece's fight is filmed from a nearer camera than the duel's own (the fight's two figures in view); the zone's own camera follows the hero.
          const cam = vfx.controls.object, keep = cur.near ? { p: cam.position.clone(), q: cam.quaternion.clone() } : null;
          if (cur.near) {
            const a = vfx.arena.caster.group.position, b = vfx.duel.foe?.group.position ?? a;
            const d = Math.hypot(a.x - b.x, a.z - b.z), far = Math.max(cur.near, d * 0.9 + 7);
            cam.position.set((a.x + b.x) / 2, far * 0.85, (a.z + b.z) / 2 + far * 0.6);
            cam.lookAt((a.x + b.x) / 2, 0.8, (a.z + b.z) / 2);
            cam.updateMatrixWorld();
          }
          vfx.render();
          if (keep) { cam.position.copy(keep.p); cam.quaternion.copy(keep.q); }
          const sw = gl.width, sh = gl.height, ar = W / H;
          let cw = sw, ch = sw / ar;
          if (ch > sh) { ch = sh; cw = sh * ar; }
          g.globalAlpha = 1;
          g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
          painter(g, S);
          const bin = atob(out.toDataURL('image/jpeg', 0.9).split(',')[1]), bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          sent.push(fetch(`${sink}/${cur.name}_${String(seq).padStart(4, '0')}.jpg`, { method: 'PUT', body: bytes }));
          seq++;
        };
        let pieceSteps = 0, lastPiece = null;
        // The moments, in the order a floor goes. `when` says when one may start (it starts once); `seconds` is its length;
        // `at` are things done at a second of it.
        const z = () => _world.game()?.zone;
        const segs = [
          { name: 's1', seconds: 5, when: (G) => G.run.clock > 0.5, at: { 0.8: () => z()?.people.talk('gus'), 4.3: () => z()?.hud?.closeCard?.() ?? _world.game().hud.closeCard() }, what: 'the camp and a talk card' },
          { name: 's2', seconds: 5, when: (G) => !!z() && [...z().packs.values()].some((p) => p.state === 'awake' && p.left > 0 && !p.hunter && p.units.some((u) => Math.hypot(u.pos.x - z().ctx.hero.x, u.pos.z - z().ctx.hero.z) < 10)), what: 'a pack wakes and the fight' },
          { name: 's3', seconds: 6, when: (G) => !!z() && !!z().law && z().law.status().warn && G.run.clock > 60 && +(/in (\d+) s/.exec(z().law.status().text)?.[1] ?? 99) <= 3, what: 'the tide comes in' },
          { name: 's4', seconds: 5, when: (G) => !!G.run.carry?.held, what: 'carrying the key' },
          { name: 's5', seconds: 5, near: 12, when: (G) => G.piece === 'ruler' && pieceSteps > 60 * 28, what: 'the Drowned Captain' },
          { name: 's6', seconds: 5, near: 11, when: (G) => G.piece === 'gate' && pieceSteps > 60 * 5, what: 'the gatekeeper' },
        ];
        let recSteps = 0; const fired = new Set(), doneSegs = new Set();
        const until = (G) => {
          steps++;
          if (G.piece !== lastPiece) { lastPiece = G.piece; pieceSteps = 0; }
          if (G.piece) pieceSteps++;
          if (cur) {
            recSteps++;
            const sec = recSteps / 60;
            for (const [t, fn] of Object.entries(cur.at ?? {})) if (!fired.has(cur.name + t) && sec >= +t) { fired.add(cur.name + t); try { fn(); } catch (e) { status.log.push(`${cur.name} at ${t}: ${e}`); } }
            if (recSteps % 2 === 0) grab();
            if (sec >= cur.seconds) { status.shots[cur.name] = seq; doneSegs.add(cur.name); cur = null; }
          } else {
            // Any moment that is not filmed yet may start when its time comes (they do not have to come in the order they are listed).
            const s = segs.find((x) => !doneSegs.has(x.name) && x.when(G));
            if (s) { cur = s; recSteps = 0; seq = 0; status.seg = cur.name; status.log.push(`${cur.name} (${cur.what}) at ${G.run.clock.toFixed(1)}s`); }
          }
          return doneSegs.size >= segs.length && !cur;
        };
        const res = await window._worldRoute({ floor: 1, hero: o.hero ?? 'Lyra', maxSeconds: o.maxSeconds ?? 1500, until });
        await Promise.all(sent);
        status.route = { ok: res.ok, seconds: res.seconds, falls: res.falls, stars: res.stars };
        status.skipped = segs.filter((x) => !doneSegs.has(x.name)).map((x) => x.name);
      } catch (e) { status.err = String(e?.stack ?? e).slice(0, 500); }
      window._world.end?.();
      status.done = true;
    })();
    return 'started';
  };
  window._worldFilm.status = () => status;
})();
