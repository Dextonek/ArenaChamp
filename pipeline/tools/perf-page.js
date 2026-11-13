// The performance tool's half that runs inside the game page (pipeline/tools/perf.py injects it; docs/pipeline/performance.md).
// It plays fixed scenes of the real game with fixed steps and times every frame: the step (the game's rules and effects), the
// render (every renderer on the page) and the wait for the graphics card to finish it.
//
//   await _perf.info()                                   -> { gpu, ua, dpr, canvas, heroes, arenas }
//   await _perf.run({ scene: 'duel', hero: 'Lyra', foe: 'Oblivion', arena: 'temple', frames: 1500, seed: 7 })
//   scenes: 'menu' (the Play screen with the turning hero), 'duel' (a CPU duel, the autopilot as the player),
//           'raid' (a boss, alone; `party: 9` adds that many scripted partners in the party's room, `band` its width),
//           'tower' (a horde floor of a fixed week), 'idle' (hero mode with nothing happening)
//   `set: { pixelRatio, shadows, ... }` changes one thing for a what-if (see `apply` below).
//
// How a frame is timed. The page's own frame loop is taken over: `requestAnimationFrame` callbacks are kept and run by this
// tool, one batch a frame, so every renderer on the page (the game's, the Play screen's hero) draws exactly once per frame and
// nothing depends on the window being visible. After the draw, one pixel is read back from each canvas: that makes the
// browser wait until the graphics card has really finished, so the time is the frame's whole cost, not only the time to
// queue it. (With `sync: false` the wait is left out and only the processor's part is timed: the driver asks for that when it
// slows the processor, see perf.py.) Time (`performance.now`) follows the fight's own clock and the dice (`Math.random`) are seeded, so a scene is the
// same fight every run: its `print` (health and places each second) must match between two runs when no rule changed.
(() => {
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  const realRandom = Math.random;
  const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

  // --- the frame loop, taken over -------------------------------------------------------------------------------------
  let manual = false, queue = [];
  window.requestAnimationFrame = (cb) => {
    if (!manual) return realRaf(cb);
    queue.push(cb);
    return 0;
  };
  const flush = (ts) => {
    const batch = queue;
    queue = [];
    for (const cb of batch) cb(ts);
  };

  // --- every draw call of every WebGL context on the page --------------------------------------------------------------
  let draws = 0;
  for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
    if (!proto) continue;
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
      const real = proto[name];
      if (typeof real !== 'function') continue;
      proto[name] = function (...a) { draws++; return real.apply(this, a); };
    }
  }

  const mulberry = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const api = () => window.game.api;
  const pixel = new Uint8Array(4);
  /** Waits for the graphics card: one pixel read back from every canvas that is on the page. */
  const sync = () => {
    for (const c of document.querySelectorAll('canvas')) {
      if (!c.isConnected || !c.width) continue;
      const gl = c === api().renderer.domElement ? api().renderer.getContext() : c.classList.contains('hero-preview') && c.offsetParent !== null ? c.getContext('webgl2') : null;
      if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    }
  };

  /**
   * Particles on screen: the points of everything drawn as points (an emitter's: those alive) plus the copies of everything
   * drawn as instances. The spells draw their sparks, shards and trails one way or the other.
   */
  const particles = () => {
    let n = 0;
    api().scene.traverseVisible((o) => {
      if (o.isPoints) {
        const alive = o.geometry?.attributes?.aAlive?.array;
        if (alive) for (let i = 0; i < alive.length; i++) n += alive[i];
        else { const g = o.geometry, all = g?.attributes?.position?.count ?? 0; n += Math.min(all, g?.drawRange?.count ?? all); }
      } else if (o.isInstancedMesh) n += o.count;
    });
    return n;
  };

  /** Everything in the scene, drawn or hidden: a number that only grows is something that is never let go. */
  const objects = () => { let n = 0; api().scene.traverse(() => n++); return n; };

  /**
   * Whose shaders these are: for each program just built, an object that draws with it, as "spell or part of the scene >
   * object (material)". A spell's effect is named by its label; anything else by the names up its chain of parents.
   */
  const owners = (fresh) => {
    const a = api(), props = a.renderer.properties, want = new Set(fresh), out = [];
    const labelOf = new Map();
    for (const [label, slot] of a.slots) if (slot.effect) labelOf.set(slot.effect.group, label);
    a.scene.traverse((o) => {
      if (!want.size || !o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const prog = props.get(m)?.currentProgram;
        if (!prog || !want.has(prog)) continue;
        want.delete(prog);
        const chain = [];
        let top = o, label = '';
        for (let q = o; q && q !== a.scene; q = q.parent) { top = q; if (labelOf.has(q)) label = labelOf.get(q); if (q.name) chain.unshift(q.name); }
        const where = label ? `spell "${label}"` : top === a.arena.group ? 'arena' : top === a.duel.group ? 'duel' : top === a.heroMode.group ? 'hero mode' : top === a.telegraphs.group ? 'danger zones' : `scene child ${top.name || top.type}`;
        out.push(`${where} > ${chain.join('/') || o.type} (${m.name || m.type}${o.isInstancedMesh ? ', instanced' : ''}${o.isSkinnedMesh ? ', skinned' : ''})`);
      }
    });
    for (const p of want) out.push(`not in the scene any more (${p.name || 'shader'})`);
    return out;
  };

  /**
   * Materials that make three look their shader up again on every frame (`flips: true`): one material drawn by objects of
   * two kinds (a rigged mesh and a plain one, an instanced one and a single one ...), which switches it back and forth within
   * a frame, and materials marked as changed (`needsUpdate`) frame after frame. Each look-up builds a record of some forty
   * settings: time and garbage.
   */
  const flipWatch = () => {
    const a = api();
    const versions = new Map(), bumps = new Map(), kinds = new Map(), where = new Map();
    const labelOf = new Map();
    let frames = 0;
    const nameOf = (o, m) => {
      const chain = [];
      let label = '', top = o;
      for (let q = o; q && q !== a.scene; q = q.parent) { top = q; if (labelOf.has(q)) label = labelOf.get(q); if (q.name) chain.unshift(q.name); }
      const root = label ? `spell "${label}"` : top === a.arena.group ? 'arena' : top === a.duel.group ? 'duel' : top === a.heroMode.group ? 'hero mode' : `scene child ${top.name || top.type}`;
      return `${root} > ${chain.slice(-3).join('/') || o.type} (${m.name || m.type})`;
    };
    return {
      frame() {
        frames++;
        if (frames % 30 === 1) { labelOf.clear(); for (const [label, slot] of a.slots) if (slot.effect) labelOf.set(slot.effect.group, label); }
        a.scene.traverseVisible((o) => {
          if (!o.material || !(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            const g = o.geometry;
            const kind = `${o.isSkinnedMesh ? 'rigged' : 'plain'}${o.isInstancedMesh ? ` instanced${o.instanceColor ? '+colour' : ''}` : ''}${g?.attributes?.color?.itemSize === 4 && m.vertexColors ? ' alpha-colours' : ''}${g?.morphAttributes?.position ? ' morph' : ''}`;
            let set = kinds.get(m);
            if (!set) kinds.set(m, (set = new Set()));
            if (!set.has(kind)) { set.add(kind); if (!where.has(m)) where.set(m, nameOf(o, m)); }
            const v = versions.get(m);
            if (v !== undefined && v !== m.version) bumps.set(m, (bumps.get(m) ?? 0) + 1);
            versions.set(m, m.version);
          }
        });
      },
      result() {
        const shared = [], marked = [];
        for (const [m, set] of kinds) if (set.size > 1) shared.push({ material: where.get(m), kinds: [...set] });
        for (const [m, n] of bumps) if (n > frames / 20) marked.push({ material: where.get(m) ?? (m.name || m.type), timesAFrame: +(n / frames).toFixed(2) });
        marked.sort((x, y) => y.timesAFrame - x.timesAFrame);
        return { shared, marked: marked.slice(0, 40), markedAFrame: +[...bumps.values()].reduce((x, y) => x + y, 0).toFixed(0) / frames };
      },
    };
  };

  /**
   * Who the draw calls belong to, as the scene stands: every drawn thing counted under the part of the scene it hangs in
   * (the arena, each figure or group of the duel, each spell), with how many of them also cast a shadow (a second draw call
   * each) and their triangles. The parts with the most first.
   */
  const census = () => {
    const a = api(), rows = new Map();
    const labelOf = new Map();
    for (const [label, slot] of a.slots) if (slot.effect) labelOf.set(slot.effect.group, label);
    a.scene.traverseVisible((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
      const chain = [];
      for (let q = o; q && q !== a.scene; q = q.parent) chain.unshift(q);
      const top = chain[0];
      let key = labelOf.has(top) ? `spell "${labelOf.get(top)}"` : top === a.arena.group ? 'arena' : top === a.duel.group ? 'duel' : top === a.heroMode.group ? 'hero mode' : top === a.telegraphs.group ? 'danger zones' : `scene: ${top.name || top.type}`;
      // One level down inside the arena and the duel, by the first name on the way to the thing.
      if (top === a.arena.group || top === a.duel.group) {
        const second = chain[1], named = chain.slice(1).find((q) => q.name);
        key += ` > ${second?.userData?.perfName || named?.name || second?.type || '?'}`;
      }
      const row = rows.get(key) ?? { part: key, drawn: 0, shadows: 0, rigged: 0, triangles: 0 };
      row.drawn++;
      if (o.castShadow && o.isMesh) row.shadows++;
      if (o.isSkinnedMesh) row.rigged++;
      const g = o.geometry;
      row.triangles += Math.round(((g?.index ? g.index.count : g?.attributes?.position?.count ?? 0) / 3) * (o.isInstancedMesh ? o.count : 1));
      rows.set(key, row);
    });
    return [...rows.values()].sort((x, y) => y.drawn + y.shadows - (x.drawn + x.shadows));
  };

  const sceneCount = () => {
    let meshes = 0, lights = 0, skinned = 0, shadowCasters = 0;
    api().scene.traverseVisible((o) => {
      if (o.isMesh || o.isPoints || o.isLine) meshes++;
      if (o.isSkinnedMesh) skinned++;
      if (o.isLight) lights++;
      if (o.castShadow && o.isMesh) shadowCasters++;
    });
    return { meshes, lights, skinned, shadowCasters };
  };

  /** What-ifs: one thing changed, to see what it costs. None of them is a setting of the game. */
  const apply = (set) => {
    const a = api(), r = a.renderer;
    if (!set) return;
    if (set.pixelRatio) { if (a.quality) a.quality.fixed = set.pixelRatio; else r.setPixelRatio(set.pixelRatio); window.dispatchEvent(new Event('resize')); }
    if (set.shadows === false) a.scene.traverse((o) => { if (o.isDirectionalLight) o.castShadow = false; });
    // The spells' effects built at the first cast, as before the warm-up built them: the dice then fall as they did.
    if (set.noPrebuild) { const warm = a.duel.host.warmUp; a.duel.host.warmUp = () => warm([]); }
    if (set.quality && a.quality) a.quality.set(set.quality);
  };

  const quant = (v) => Math.round(v * 10) / 10;
  /** A fight is on: the menu goes, as the game's own start of a fight makes it go. */
  const hideMenu = () => { window.game.cpu.active = true; window.game.render(); };

  // --- the scenes --------------------------------------------------------------------------------------------------------
  // Each returns { frame(i), print() }: what to do before a frame's step, and the scene's state for the print.
  const scenes = {
    /** The Play screen (no account: the CPU duel's own), with the hero turning on its stand. */
    async menu() {
      window.game.go('cpu');
      await sleep(1500);
      return { stepped: false, frame() {}, print: () => [document.querySelectorAll('canvas.hero-preview').length] };
    },

    /** Hero mode in the default arena, nobody fighting: the floor of what a fight costs. */
    async idle(o) {
      const a = api();
      hideMenu();
      a.setKit(o.hero ?? 'Lyra');
      a.setHeroMode(true);
      await sleep(1200);
      return { stepped: true, frame() {}, print: () => [0] };
    },

    /** A CPU duel as a player sees it: the player's camera and bars, the autopilot at the keys. */
    async duel(o) {
      const a = api(), d = a.duel;
      const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
      hideMenu();
      a.setKit(o.hero ?? 'Lyra');
      a.setHeroMode(true);
      d.cpuLevel = CPU_BALANCE;
      d.pilotLevel = CPU_BALANCE;
      d.opponentChoice = o.foe ?? 'Oblivion';
      d.arenaChoice = o.arena ?? 'temple';
      d.hazardsInRuns = true;
      d.shiftsInRuns = true;
      d.holdStart = false;
      const begin = () => { d.start(o.mode ?? 'play'); d.autopilot = true; };
      begin();
      await d.whenReady();
      let rounds = 1;
      return {
        stepped: true,
        frame() { if (d.result) { begin(); rounds++; } },
        print: () => [Math.round(d.playerHp), Math.round(a.arena.hpOf(d.foe)), quant(a.arena.caster.group.position.x), quant(a.arena.caster.group.position.z), quant(d.foe.group.position.x), quant(d.foe.group.position.z), rounds],
      };
    },

    /** A raid boss with the autopilot. `party`: that many scripted partners that walk a ring round the boss, attack and cast. */
    async raid(o) {
      const a = api(), d = a.duel;
      const { BOSSES } = await import('/src/raid/bosses.ts');
      const { LocalLink } = await import('/src/raid/link.ts');
      const { RunUpgrades } = await import('/src/raid/upgrades.ts');
      const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
      const def = BOSSES[o.boss ?? 'sun'];
      const names = ['Bram', 'Kaia', 'Brannoc', 'Isolde', 'Sefu', 'Auriel', 'Cantor', 'Nyx', 'Hank', 'Marin', 'Vesper', 'Fenna', 'Mortis', 'Ada', 'Opaline', 'Sirix', 'Shiori', 'Tempo', 'Zephyr', 'Vitriol'];
      const n = o.party ?? 0;
      const party = Array.from({ length: n }, (_, i) => ({ side: i + 1, kit: a.kits.find((k) => k.name === names[i % names.length]), name: `Bot ${i + 1}` }));
      hideMenu();
      a.setKit(o.hero ?? 'Lyra');
      a.setHeroMode(true);
      d.holdStart = false;
      d.pilotLevel = CPU_BALANCE;
      let fights = 0;
      const begin = () => {
        d.startBoss({ def, link: new LocalLink(def, 1), seed: `perf-${fights++}`, mode: o.mode ?? 'run', tier: 1, upgrades: new RunUpgrades(), band: o.band ?? (n ? 10 : undefined), party: n ? party : undefined });
      };
      begin();
      await d.whenReady();
      return {
        stepped: true,
        frame(i) {
          if (d.result) begin();
          if (!n || !d.foe) return;
          const b = d.foe.group.position;
          for (const p of party) {
            // A ring round the boss, each partner a little further on; they walk it at about a hero's pace.
            const ang = (p.side / n) * Math.PI * 2 + i * 0.004, rad = 5.5 + (p.side % 3) * 1.6;
            const x = b.x + Math.cos(ang) * rad, z = b.z + Math.sin(ang) * rad;
            if (i % 3 === 0) d.partnerMove(p.side, x, z, Math.atan2(b.x - x, b.z - z));
            if ((i + p.side * 17) % 90 === 0) d.partnerAttack(p.side);
            if ((i + p.side * 41) % 240 === 0) d.partnerCast(p.side, { id: i, slot: Math.floor(i / 240 + p.side) % 4, x: b.x, z: b.z, fx: x, fz: z, enemy: true, yaw: Math.atan2(b.x - x, b.z - z) });
          }
        },
        print: () => [Math.round(d.playerHp), d.foe ? Math.round(a.arena.hpOf(d.foe)) : -1, quant(a.arena.caster.group.position.x), quant(a.arena.caster.group.position.z), fights],
      };
    },

    /** A horde floor of a fixed week's Tower, begun again whenever it is cleared or lost. */
    async tower(o) {
      const a = api(), d = a.duel, tower = window.game.tower;
      const { towerFor } = await import('/src/tower/week.ts');
      const { CPU_BALANCE } = await import('/src/cpuLevels.ts');
      const week = o.week ?? '2026-W46';
      const plan = towerFor(week, 40).find((p) => p.kind === (o.kind ?? 'horde') && p.n > (o.above ?? 10));
      d.pilotLevel = CPU_BALANCE;
      let climbs = 0;
      // The autopilot's climb has no loading page; a player's waits for the floor to be ready, so this does too.
      const begin = async () => { climbs++; await tower.start({ hero: o.hero ?? 'Kaia', mode: 'run', week, from: plan.n }); await d.whenReady(); };
      await begin();
      return {
        stepped: true,
        // The floor again once it is cleared or lost: the loop waits for it, so it begins on the same frame every run.
        frame() {
          tower.pump();
          if (tower.ended || tower.floor !== plan.n) { tower.exit(); return begin(); }
        },
        print: () => [Math.round(d.playerHp ?? 0), plan.n, quant(a.arena.caster.group.position.x), quant(a.arena.caster.group.position.z), climbs],
      };
    },
  };

  // --- the graphics card's own timer, for each step of drawing a frame ---------------------------------------------------
  // Even frames time the composer's passes, odd frames the shadow map alone (one timer at a time is all a card gives):
  // "scene" is the render pass less the shadows. The answers come back a few frames later.
  const passTimer = () => {
    const a = api(), gl = a.renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext || !a.composer) return null;
    const waiting = [], got = {};
    let odd = false;
    const timed = (name, real, when) => function (...x) {
      if (odd !== when) return real.apply(this, x);
      const q = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      const out = real.apply(this, x);
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      waiting.push([name, q]);
      return out;
    };
    const nameOf = (pass, i) => {
      const f = pass.material?.fragmentShader ?? '';
      const kind = f.includes('tDistort') ? 'distortion (copy)' : f.includes('uVignette') ? 'finish (vignette, grain, impact frames)' : /fxaa/i.test(f) || pass.material?.uniforms?.resolution ? 'antialiasing (FXAA)' : pass.constructor.name;
      return `${i + 1} ${kind}`;
    };
    const undo = [];
    a.composer.passes.forEach((pass, i) => { const real = pass.render; pass.render = timed(nameOf(pass, i), real, false); undo.push(() => { pass.render = real; }); });
    const sm = a.renderer.shadowMap, realShadow = sm.render;
    sm.render = timed('shadow map', realShadow, true);
    undo.push(() => { sm.render = realShadow; });
    return {
      next() { odd = !odd; },
      collect() {
        gl.getParameter(ext.GPU_DISJOINT_EXT);
        for (let i = waiting.length - 1; i >= 0; i--) {
          const [name, q] = waiting[i];
          if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) continue;
          (got[name] ??= []).push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(q);
          waiting.splice(i, 1);
        }
      },
      result() {
        undo.forEach((f) => f());
        const out = {};
        for (const [name, list] of Object.entries(got)) { list.sort((x, y) => x - y); out[name] = +list[list.length >> 1].toFixed(2); }
        return Object.fromEntries(Object.entries(out).sort((x, y) => x[0].localeCompare(y[0], undefined, { numeric: true })));
      },
    };
  };

  const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const stats = (list) => {
    const s = Float64Array.from(list).sort();
    const sum = s.reduce((x, y) => x + y, 0);
    return { median: +pct(s, 0.5).toFixed(2), mean: +(sum / s.length).toFixed(2), p95: +pct(s, 0.95).toFixed(2), p99: +pct(s, 0.99).toFixed(2), max: +s[s.length - 1].toFixed(2) };
  };

  window._perf = {
    async info() {
      const gl = api().renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const c = api().renderer.domElement;
      return {
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        ua: navigator.userAgent, dpr: window.devicePixelRatio, window: [innerWidth, innerHeight], canvas: [c.width, c.height],
        pixelRatio: api().renderer.getPixelRatio(), heroes: api().kits.map((k) => k.name),
        quality: api().quality?.level ?? null,
      };
    },

    /** Plays one scene and returns its numbers. One scene per page load: the first seconds then show the cold start as a player meets it. */
    async run(o) {
      const a = api(), r = a.renderer, info = r.info;
      const frames = o.frames ?? 1500, errors = [];
      const logError = console.error;
      console.error = (...x) => { if (errors.length < 10) errors.push(x.map((v) => String(v?.stack ?? v)).join(' ').slice(0, 300)); logError(...x); };
      const onError = (e) => { if (errors.length < 10) errors.push(String(e.error?.stack ?? e.message).slice(0, 300)); };
      window.addEventListener('error', onError);
      Math.random = mulberry(o.seed ?? 7);
      let out;
      try {
        apply(o.set);
        // Nothing of a fight moves until the frames are this tool's: the wait for the models is a different length every run.
        if (o.scene !== 'menu') a.view.paused = true;
        const scene = await scenes[o.scene](o);
        // From here the frames are this tool's: the page's loops move into the queue on their next turn.
        manual = true;
        await new Promise((ok) => realRaf(() => ok()));
        await tick();
        info.autoReset = false;
        let simMs = realNow();
        performance.now = () => simMs;
        Math.random = mulberry(o.seed ?? 7);
        const objects0 = objects(), memory0 = { geometries: info.memory.geometries, textures: info.memory.textures };
        const timer = o.passes ? passTimer() : null;
        const flips = o.flips ? flipWatch() : null;
        if (o.profile) await window._perfBegin?.();
        const total = new Float32Array(frames), stepT = new Float32Array(frames), drawT = new Float32Array(frames), gpuT = new Float32Array(frames);
        const calls = [], tris = [], glDraws = [], parts = [], heap = [], print = [];
        let allocated = 0, gcs = 0, lastHeap = performance.memory?.usedJSHeapSize ?? 0, programs0 = info.programs?.length ?? 0;
        const programsAt = [];
        // Shaders built during the scene: when, how long that frame took, and which kinds. Each is a stutter a player feels.
        const compiles = [];
        let known = new Set(info.programs ?? []);
        const began = realNow();
        for (let i = 0; i < frames; i++) {
          const wait = scene.frame(i);
          if (wait) await wait;
          if (o.set?.lightsAllLayers) a.scene.traverse((q) => { if (q.isLight) q.layers.enableAll(); });
          simMs += 1000 / 60;
          info.reset();
          draws = 0;
          const t0 = realNow();
          if (scene.stepped) a.step(1 / 60);
          const t1 = realNow();
          flush(simMs);
          const t2 = realNow();
          if (o.sync !== false) sync();
          const t3 = realNow();
          stepT[i] = t1 - t0; drawT[i] = t2 - t1; gpuT[i] = t3 - t2; total[i] = t3 - t0;
          if ((info.programs?.length ?? 0) !== known.size) {
            const fresh = info.programs.filter((p) => !known.has(p));
            known = new Set(info.programs);
            const kinds = {};
            for (const p of fresh) kinds[p.name || p.type || 'shader'] = (kinds[p.name || p.type || 'shader'] ?? 0) + 1;
            if (fresh.length) compiles.push({ at: +(i / 60).toFixed(2), ms: +total[i].toFixed(1), n: fresh.length, kinds, who: owners(fresh) });
          }
          const h = performance.memory?.usedJSHeapSize ?? 0;
          if (h > lastHeap) allocated += h - lastHeap; else if (lastHeap - h > 1e6) gcs++;
          lastHeap = h;
          if (i % 10 === 0) { calls.push(info.render.calls); tris.push(info.render.triangles); glDraws.push(draws); }
          if (i % 30 === 0) { parts.push(particles()); heap.push(h); programsAt.push(info.programs?.length ?? 0); }
          if (i % 60 === 59) print.push(scene.print());
          // The page must breathe: model loads, timers and the tool's own time limit all need the event loop.
          timer?.next();
          flips?.frame();
          if (i % 20 === 19) { await tick(); timer?.collect(); }
        }
        const wall = realNow() - began;
        delete performance.now;
        const counts = sceneCount();
        const num = (list) => { const s = [...list].sort((x, y) => x - y); return { median: s[s.length >> 1], max: s[s.length - 1] }; };
        // The longest frames, with when they came: the first casts of a session compile their shaders.
        const order = Array.from(total.keys()).sort((x, y) => total[y] - total[x]).slice(0, 8);
        const text = JSON.stringify(print);
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
        out = {
          scene: o.scene, opts: o, frames, wallSeconds: +(wall / 1000).toFixed(1), cpuOnly: o.sync === false,
          frame: stats(total), step: stats(stepT), draw: stats(drawT), gpu: stats(gpuT),
          // Without the first five seconds: the scene once everything it uses has been seen once.
          warm: stats(total.subarray(Math.min(300, frames >> 1))),
          over16: Array.from(total).filter((v) => v > 16.7).length, over33: Array.from(total).filter((v) => v > 33.4).length, over50: Array.from(total).filter((v) => v > 50).length,
          longest: order.map((i) => ({ at: +(i / 60).toFixed(2), ms: +total[i].toFixed(1), step: +stepT[i].toFixed(1), draw: +drawT[i].toFixed(1), gpu: +gpuT[i].toFixed(1) })),
          drawCalls: num(calls), triangles: num(tris), glDraws: num(glDraws), particles: num(parts),
          geometries: info.memory.geometries, textures: info.memory.textures, geometriesBefore: memory0.geometries, texturesBefore: memory0.textures,
          objects: objects(), objectsBefore: objects0, programs: info.programs?.length ?? 0, programsBefore: programs0, programsAt,
          heapMB: +((performance.memory?.usedJSHeapSize ?? 0) / 1048576).toFixed(1), heapMaxMB: +(Math.max(0, ...heap) / 1048576).toFixed(1),
          allocMBs: +(allocated / 1048576 / (frames / 60)).toFixed(2), gcs,
          ...counts,
          canvas: [r.domElement.width, r.domElement.height],
          quality: a.quality ? { level: a.quality.level, share: +a.quality.share.toFixed(3), lean: a.quality.lean, restMs: +a.quality.restMs.toFixed(1) } : null,
          // Every frame's time in tenths of a millisecond: the line on the page.
          line: Array.from(total, (v) => Math.round(v * 10)),
          passes: timer?.result() ?? null, compiles, flips: flips?.result() ?? null, census: o.census ? census() : null,
          compiledShaders: compiles.reduce((n, c) => n + c.n, 0), compileMs: +compiles.reduce((n, c) => n + c.ms, 0).toFixed(0),
          print, printHash: (hash >>> 0).toString(16), errors,
        };
      } catch (e) {
        delete performance.now;
        out = { scene: o.scene, opts: o, crashed: String(e?.stack ?? e).slice(0, 600), errors };
      }
      Math.random = realRandom;
      console.error = logError;
      window.removeEventListener('error', onError);
      return out;
    },

    /**
     * What each part of the picture costs the graphics card: the scene is played to frame `at`, held there, and drawn again
     * and again with one part hidden at a time (each child of the scene, of the arena and of the duel, two levels down), and
     * with the shadows, the fog, the bloom and half the resolution switched. Returns the frame's time as it is, and for each
     * part how much faster the frame is without it.
     */
    async parts(o) {
      const a = api(), r = a.renderer;
      Math.random = mulberry(o.seed ?? 7);
      apply(o.set);
      a.view.paused = true;
      const scene = await scenes[o.scene](o);
      manual = true;
      await new Promise((ok) => realRaf(() => ok()));
      await tick();
      let simMs = realNow();
      performance.now = () => simMs;
      for (let i = 0; i < (o.at ?? 600); i++) {
        const wait = scene.frame(i);
        if (wait) await wait;
        simMs += 1000 / 60;
        if (scene.stepped) a.step(1 / 60);
        if (i % 4 === 0) { flush(simMs); sync(); }
        if (i % 20 === 19) await tick();
      }
      delete performance.now;
      Math.random = realRandom;
      const time = (n = 12) => {
        const list = [];
        for (let i = 0; i < n; i++) { const t = realNow(); a.render(); sync(); list.push(realNow() - t); }
        list.sort((x, y) => x - y);
        return list[n >> 1];
      };
      time(6);
      const base = time(24);
      const rows = [];
      const nameOf = (obj, path) => `${path}${obj.name || obj.type}${obj.isMesh ? ` [${obj.material?.name || obj.material?.type}]` : ''}`;
      const seen = new Set();
      const visit = async (obj, path, depth) => {
        if (!obj.visible || seen.has(obj)) return;
        seen.add(obj);
        let draws0 = 0;
        obj.traverseVisible((q) => { if (q.isMesh || q.isPoints || q.isLine || q.isSprite) draws0++; });
        if (!draws0) return;
        obj.visible = false;
        const t = time();
        obj.visible = true;
        const saved = base - t;
        rows.push({ part: nameOf(obj, path), saves: +saved.toFixed(2), draws: draws0 });
        // Into a part that matters, to find what in it does.
        if (depth > 0 && saved > 0.8 && obj.children.length) {
          for (const c of obj.children) await visit(c, `${nameOf(obj, path)} > `, depth - 1);
          await tick();
        }
      };
      for (const c of a.scene.children) await visit(c, '', o.depth ?? 3);
      // Switches.
      const sw = {};
      const lights = [];
      a.scene.traverse((q) => { if (q.isLight && q.castShadow) lights.push(q); });
      for (const l of lights) l.castShadow = false;
      time(4); sw['no shadows'] = +(base - time()).toFixed(2);
      for (const l of lights) l.castShadow = true;
      time(4);
      const fog = a.scene.fog;
      const bloomOn = a.bloom.enabled;
      a.bloom.enabled = false; a.applyBloom();
      sw['no bloom'] = +(base - time()).toFixed(2);
      a.bloom.enabled = bloomOn; a.applyBloom();
      const env = a.scene.environment;
      a.scene.environment = null;
      time(4); sw['no reflections (environment map)'] = +(base - time()).toFixed(2);
      a.scene.environment = env;
      time(4);
      const pr = r.getPixelRatio();
      const ratio = (v) => { if (a.quality) a.quality.fixed = v; else r.setPixelRatio(v); window.dispatchEvent(new Event('resize')); };
      ratio(pr * 0.7071);
      time(4); sw['half the pixels'] = +(base - time()).toFixed(2);
      ratio(pr);
      if (a.quality) a.quality.fixed = null;
      time(4);
      const again = time(24);
      rows.sort((x, y) => y.saves - x.saves);
      return { scene: o.scene, opts: o, canvas: [r.domElement.width, r.domElement.height], frameMs: +base.toFixed(2), frameMsAgain: +again.toFixed(2), parts: rows.slice(0, 60), switches: sw, fogOn: !!fog };
    },

    /** One frame drawn now (for a picture after a run: the queue is this tool's, so nothing draws by itself). */
    draw() {
      // With fixed dice: a shaking camera's offset is rolled for every frame drawn, and two pictures of one frame must agree.
      Math.random = mulberry(1);
      flush(realNow());
      sync();
      Math.random = realRandom;
    },
  };
})();
