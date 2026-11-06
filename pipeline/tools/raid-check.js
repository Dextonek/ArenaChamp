// Paste into the VFX tool page under the dev server (browser javascript tool). Forces each boss move in a stepped fight
// and checks its rules: what it costs in the zone, that walking out dodges it, what cover does, and the boss's own rules.
//
//   eval(await (await fetch('/pipeline/tools/raid-check.js')).text());
//   await _raidCheck()    // { ok, failed: [...], rows: [...] }
(() => {
  window._raidCheck = async (hero = 'Lyra') => {
    const d = vfx.duel, a = vfx.arena;
    const { SUN_WARDEN: def } = await import('/src/raid/sunWarden.ts');
    const { LocalLink } = await import('/src/raid/link.ts');
    const THREE_V = a.caster.group.position.constructor;
    const rows = [], failed = [];
    let simMs = performance.now();
    performance.now = () => simMs;
    const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
    const check = (name, got, want, tol = 0.012) => {
      const pass = Math.abs(got - want) <= tol;
      rows.push(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${+got.toFixed(3)} (want ${want})`);
      if (!pass) failed.push(name);
    };
    const yes = (name, v) => check(name, v ? 1 : 0, 1, 0);
    let seq = 1000;
    const fresh = (bx = 0, bz = 2) => {
      vfx.view.paused = true;
      if (!d.on) vfx.setDuel(true, 'play');
      vfx.heroPickCtrl.setValue(hero);
      d.holdStart = false;
      d.startBoss({ def, link: new LocalLink(def), seed: 'check', mode: 'play' });
      d.boss.brain.pause = 1e9;
      a.placeFoe(d.foe, new THREE_V(bx, 0, bz));
      step(0.05);
    };
    const place = (x, z) => { a.caster.group.position.set(x, 0, z); };
    const cast = (move, o = {}) => {
      const b = d.foe.group.position, me = a.caster.group.position;
      const x = o.x ?? me.x, z = o.z ?? me.z;
      d.boss.link.cast({ id: ++seq, move, step: o.step ?? 0, x, z, fx: b.x, fz: b.z, dir: o.dir ?? Math.atan2(x - b.x, z - b.z), seed: o.seed ?? 12345, target: 0 });
    };
    const lost = (before) => (before - d.playerHp) / d.playerMax;
    const take = (fn, seconds) => { d.playerHp = d.playerMax; fn(); step(seconds); return lost(d.playerMax); };

    try {
      // Stone Sweep: in the cone, behind him, walking out.
      fresh(0, 1);
      place(0, 5);
      check('sweep: in the cone', take(() => cast('sweep'), 1.8), 0.22);
      place(0, 5);
      check('sweep: walked out', take(() => { cast('sweep'); place(6.5, 1); }, 1.8), 0);
      place(0, -0.5);
      check('sweep: behind him', take(() => cast('sweep', { x: 0, z: 5 }), 1.8), 0);

      // Pillar Fall: under a stone, or stepped away.
      fresh(0, 1);
      place(-3, 13);
      check('pillar: stood still', take(() => cast('pillars'), 1.7), 0.18);
      place(-3, 13);
      check('pillar: walked out', take(() => { cast('pillars'); place(3, 13); }, 1.7), 0);

      // Sun Ray: stopped by cover, cracks the wall.
      fresh(0, 1);
      place(0, 5);
      check('ray: in the line', take(() => cast('ray'), 2.7), 0.25);
      fresh(-3.2, 1);
      place(-3.2, 7);
      const hp0 = d.wallHp.reduce((s, v) => s + Math.max(0, v), 0);
      check('ray: behind a wall', take(() => cast('ray'), 2.7), 0);
      check('ray: the wall took a hit', hp0 - d.wallHp.reduce((s, v) => s + Math.max(0, v), 0), 1, 0);

      // Noon: open floor, behind a wall (it falls), behind a column (it stays).
      fresh(0, 1);
      place(0, 5);
      check('noon: in the open', take(() => cast('noon'), 4.2), 0.7);
      yes('noon: he stands open', a.statusOf(d.foe).buff('vulnerable') === 0.5);
      fresh(-3.2, 1);
      place(-3.2, 7);
      const n0 = a.obstacles.length;
      check('noon: behind a wall', take(() => cast('noon'), 4.2), 0);
      check('noon: that wall fell', n0 - a.obstacles.length, 1, 0);
      fresh(8, 0);
      place(8, 6);
      const n1 = a.obstacles.length;
      check('noon: behind a column', take(() => cast('noon'), 4.2), 0);
      check('noon: the column stands', n1 - a.obstacles.length, 0, 0);

      // Sun Order: wedge 1 fires at 2.5 s. Stood in it, hit once; stepping into it after it fired, nothing.
      const spot = (s) => ({ x: s.x + Math.sin(s.dir) * 5, z: s.z + Math.cos(s.dir) * 5 });
      const wedges = () => { cast('order'); const sc = d.boss.script; return sc.active[sc.active.length - 1].played.threats.map((t) => spot(t.shape)); };
      fresh(0, 1);
      const [s1] = wedges();
      place(s1.x, s1.z);
      d.playerHp = d.playerMax;
      step(2.7);
      check('order: stood in wedge 1', lost(d.playerMax), 0.25);
      step(3);
      fresh(0, 1);
      const [a1, a2] = wedges();
      place(a2.x, a2.z);
      d.playerHp = d.playerMax;
      step(2.6);
      place(a1.x, a1.z);
      step(3);
      check('order: stepped into 1 after it fired', lost(d.playerMax), 0);

      // Eclipse: near, far, near.
      fresh(0, 1);
      place(0, 3);
      check('eclipse near: close', take(() => cast('eclipse', { step: 0 }), 1.8), 0.2);
      place(0, 12);
      check('eclipse near: far off', take(() => cast('eclipse', { step: 0 }), 1.8), 0);
      place(0, 12);
      check('eclipse far: far off', take(() => cast('eclipse', { step: 1 }), 1.8), 0.2);
      place(0, 3);
      check('eclipse far: close', take(() => cast('eclipse', { step: 1 }), 1.8), 0);

      // Anchors, alone: stand in the gold or pay.
      fresh(0, 1);
      const before = d.boss.script;
      place(-11, 7);
      check('anchor: nobody in it', take(() => cast('anchors', { step: 0 }), 3.2), 0.3);
      cast('anchors', { step: 0 });
      const gold = before.active[before.active.length - 1].played.threats[0].shape;
      place(gold.x, gold.z);
      d.playerHp = d.playerMax;
      step(3.2);
      check('anchor: stood in it', lost(d.playerMax), 0);

      // Walking Sun: a turn of the ray hits each time it passes.
      fresh(0, 1);
      const sc = d.boss.script;
      cast('walking');
      const ray = sc.active[sc.active.length - 1].played.threats[0];
      const s4 = ray.shapeAt(4);
      place(s4.x2 * 0.5 + s4.x1 * 0.5, s4.z2 * 0.5 + s4.z1 * 0.5);
      d.playerHp = d.playerMax;
      step(4.3);
      check('walking sun: it passed once', lost(d.playerMax), 0.15);

      // The boss's own rules: not moved, stagger, kneel, +50 %.
      fresh(0, 2);
      const at = d.foe.group.position.clone();
      a.hitFilter = null;
      a.hit(d.foe, { damage: 1, knock: 8, pull: 4, from: new THREE_V(0, 0, 10) });
      a.carryFigure(d.foe, new THREE_V(3, 0, 0));
      step(0.5);
      check('not moved by knock, pull or carry', d.foe.group.position.distanceTo(at), 0, 0.001);
      yes('stun does not hold him', !a.applyStatus(d.foe, 'stun', 1.2) && !a.statusOf(d.foe).stunned);
      yes('root does not hold him', !a.applyStatus(d.foe, 'root', 1.2) && a.statusOf(d.foe).speedMul > 0);
      a.applyStatus(d.foe, 'slow', 2);
      step(1.1);
      yes('slow runs at half length', !a.statusOf(d.foe).has('slow'));
      for (let i = 0; i < 6; i++) a.applyStatus(d.foe, 'stun', 1.2);
      yes('a full gauge makes him kneel', d.boss.stats.kneels === 1);
      yes('kneeling he takes +50 %', a.statusOf(d.foe).buff('vulnerable') === 0.5);
      yes('kneeling counts as stunned', a.statusOf(d.foe).stunned);

      // Phases: HP thresholds; the end of the fight.
      fresh(0, 2);
      a.hit(d.foe, { damage: def.hp.solo * 0.31, knock: 0 });
      yes('phase 2 at 70 %', d.boss.stats.phases === 1);
      a.hit(d.foe, { damage: def.hp.solo * 0.36, knock: 0 });
      yes('phase 3 at 35 %', d.boss.stats.phases === 2);
      a.hit(d.foe, { damage: def.hp.solo, knock: 0 });
      step(0.1);
      yes('he falls at 0', d.result?.winner === vfx.heroMode.currentKit.name);

      // The shadows drawn for Noon against what really blocks the light.
      fresh(0, 1);
      cast('noon');
      step(0.1);
      const noon = d.boss.script.active[d.boss.script.active.length - 1];
      const mesh = d.boss.script.group.children.find((c) => c.isMesh && c.material.uniforms?.uCenter);
      const pos = mesh.geometry.attributes.position;
      const inTri = (p, q, r, x, z) => {
        const s = (q.x - p.x) * (z - p.z) - (q.z - p.z) * (x - p.x), t = (r.x - q.x) * (z - q.z) - (r.z - q.z) * (x - q.x), u = (p.x - r.x) * (z - r.z) - (p.z - r.z) * (x - r.x);
        return (s >= 0 && t >= 0 && u >= 0) || (s <= 0 && t <= 0 && u <= 0);
      };
      const shadowed = (x, z) => {
        for (let i = 0; i < pos.count; i += 3) {
          const v = (k) => ({ x: pos.getX(i + k), z: pos.getZ(i + k) });
          if (inTri(v(0), v(1), v(2), x, z)) return true;
        }
        return false;
      };
      let wrong = 0, n = 0;
      const src = noon.cast;
      for (let k = 0; k < 1500; k++) {
        const r = 11.5 * Math.sqrt(Math.random()), an = Math.random() * 6.283, x = Math.cos(an) * r, z = 7 + Math.sin(an) * r;
        if (a.obstacles.some((o) => { const dx = o.bx - o.ax, dz = o.bz - o.az, l = dx * dx + dz * dz, t = l ? Math.min(1, Math.max(0, ((x - o.ax) * dx + (z - o.az) * dz) / l)) : 0; return Math.hypot(x - o.ax - dx * t, z - o.az - dz * t) <= o.r + 0.1; })) continue;
        n++;
        const open = a.lineOfSight(new THREE_V(src.fx, 0, src.fz), new THREE_V(x, 0, z));
        if (open === shadowed(x, z)) wrong++;
      }
      check('shadows match what blocks the light (share wrong)', wrong / n, 0, 0.03);
    } catch (e) {
      failed.push(String(e?.stack ?? e));
    }
    delete performance.now;
    return { ok: !failed.length, failed, rows };
  };
})();
