// Paste into the VFX tool page under the dev server (browser javascript tool). Forces each boss move in a stepped fight
// and checks its rules: what it costs in the zone, that walking out dodges it, what cover does, and the boss's own rules.
//
//   eval(await (await fetch('/pipeline/tools/raid-check.js')).text());
//   await _raidCheck()    // { ok, failed: [...], rows: [...] }
(() => {
  // Every hero's four spells and basic attack replayed as a partner: nothing in them may touch this screen's hero or the boss.
  //   _raidPartners(['Lyra', 'Bram'])  in the background; _raidPartners.result() when done
  let partners = { done: true, rows: [], errors: [] };
  window._raidPartners = (names) => {
    if (!partners.done) return 'already running';
    partners = { done: false, rows: [], errors: [], n: 0 };
    const tick = () => new Promise((ok) => { const c = new MessageChannel(); c.port1.onmessage = () => ok(); c.port2.postMessage(0); });
    (async () => {
      const d = vfx.duel, a = vfx.arena;
      const { SUN_WARDEN: def } = await import('/src/raid/sunWarden.ts');
      const { LocalLink } = await import('/src/raid/link.ts');
      const { HERO_KITS } = await import('/src/heroes.ts');
      const V = a.caster.group.position.constructor;
      let simMs = performance.now();
      performance.now = () => simMs;
      const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
      const logError = console.error;
      let now = '';
      console.error = (...x) => { if (partners.errors.length < 20) partners.errors.push(`${now}: ${x.map((v) => String(v?.stack ?? v)).join(' ').slice(0, 300)}`); logError(...x); };
      vfx.view.paused = true;
      if (!d.on) vfx.setDuel(true, 'play');
      d.holdStart = false;
      try {
        for (const name of names) {
          const kit = HERO_KITS.find((k) => k.name === name);
          vfx.heroPickCtrl.setValue(name === 'Lyra' ? 'Bram' : 'Lyra');
          for (let slot = 0; slot < 5; slot++) {
            now = `${name} slot ${slot}`;
            // A fresh fight: the hero to one side and the partner to the other, the boss between them.
            const link = new LocalLink(def);
            d.startBoss({ def, link, seed: 'partners', mode: 'play', name: 'me', partner: { kit, name: 'partner' } });
            d.boss.brain.pause = 1e9;
            a.placeFoe(d.foe, new V(0, 0, 7.5 + 1));
            a.obstacles = [];
            const me = a.caster.group.position;
            me.set(-6, 0, 11);
            d.partnerMove(6, 11, 0, undefined);
            step(0.2);
            const before = { hp: d.playerHp, boss: a.hpOf(d.foe), x: me.x, z: me.z, units: a.summons.alive('opponent').length + a.summons.alive('hero').length };
            if (slot < 4) {
              const spell = kit.spells[slot], spec = vfx.targeting?.(spell.label);
              const b = d.foe.group.position;
              d.partnerCast({ id: 1, slot, x: b.x, z: b.z, fx: 6, fz: 11, enemy: true, yaw: Math.atan2(b.x - 6, b.z - 11), bend: spell.aim === 'arc' ? 0.6 : undefined });
              void spec;
            } else d.partnerAttack();
            step(3.5);
            const st = a.statusOf(a.caster);
            const row = {
              hp: d.playerHp - before.hp, boss: a.hpOf(d.foe) - before.boss, moved: Math.hypot(me.x - before.x, me.z - before.z),
              status: !!st && (st.stunned || st.cannotMove || st.cannotCast || st.speedMul !== 1), buffs: st?.activeBuffs().length ?? 0,
              units: a.summons.alive('opponent').length + a.summons.alive('hero').length - before.units,
            };
            partners.n++;
            if (row.hp || row.boss || row.moved > 0.001 || row.status || row.buffs || row.units) partners.rows.push({ name, slot, ...row });
            await tick();
          }
        }
      } catch (e) {
        partners.errors.push(`${now}: ${String(e?.stack ?? e)}`);
      }
      delete performance.now;
      console.error = logError;
      partners.done = true;
    })();
    return 'started';
  };
  window._raidPartners.result = () => partners;

  // Each upgrade changes the number it says, and nothing lasts past the run. Tiers: more boss HP, shorter shown times.
  //   await _raidUpgrades()    // { ok, failed, rows }
  window._raidUpgrades = async (hero = 'Bram') => {
    const d = vfx.duel, a = vfx.arena, hm = vfx.heroMode;
    const { SUN_WARDEN: def } = await import('/src/raid/sunWarden.ts');
    const { LocalLink } = await import('/src/raid/link.ts');
    const { RunUpgrades, offersFor, UPGRADES } = await import('/src/raid/upgrades.ts');
    const { HERO_KITS } = await import('/src/heroes.ts');
    const { NO_MODS } = await import('/src/traits/index.ts');
    const rows = [], failed = [];
    const check = (name, got, want, tol = 0.011) => {
      const pass = Math.abs(got - want) <= tol;
      rows.push(`${pass ? 'ok  ' : 'FAIL'} ${name}: ${+got.toFixed(3)} (want ${want})`);
      if (!pass) failed.push(name);
    };
    vfx.view.paused = true;
    if (!d.on) vfx.setDuel(true, 'play');
    vfx.heroPickCtrl.setValue(hero);
    d.holdStart = false;
    const kit = HERO_KITS.find((k) => k.name === hero);
    const fresh = (ids = [], tier = 1) => {
      const up = new RunUpgrades();
      for (const id of ids) up.add(id);
      const link = new LocalLink(def, tier);
      d.startBoss({ def, link, seed: 'up', mode: 'play', upgrades: up, tier });
      d.boss.brain.pause = 1e9;
      return { up, link };
    };
    const dealt = (damage = 100) => d.resolve('hero', d.foe, { damage }, NO_MODS, 'spell', 0, 1).damage;
    const base = kit.maxHp ?? 600;
    try {
      fresh([]);
      const cool0 = hm.castRules(0, 10, 1), cool3 = hm.castRules(3, 10, 1), walk = hm.speed;
      check('no upgrades: damage', dealt(), 100, 0.5);

      fresh(['hands']);
      check('Quick Hands: Q', hm.castRules(0, 10, 1) / cool0, 0.85);
      fresh(['ready']);
      check('Ready Again: R', hm.castRules(3, 10, 1) / cool3, 0.75);
      check('Ready Again: Q untouched', hm.castRules(0, 10, 1) / cool0, 1);
      fresh(['stride']);
      check('Long Stride', hm.speed / walk, 1.15);
      fresh(['glass']);
      check('Glass Edge: max HP', d.heroMax / base, 0.85, 0.002);
      check('Glass Edge: damage', dealt(), 125, 0.5);
      fresh(['stone']);
      check('Stone Skin: max HP', d.heroMax / base, 1.2, 0.002);
      check('it starts full', d.heroHp / d.heroMax, 1);

      fresh(['opportunist']);
      check('Opportunist: not open', dealt(), 100, 0.5);
      d.boss.exposedFor(3);
      check('Opportunist: open', dealt(), 160 * 1, 0.5);

      const b = fresh(['breaker']);
      a.applyStatus(d.foe, 'stun', 1);
      check('Bone Breaker: the gauge', b.link.gauge, 22 * 1.4);

      const w = d.boss.script.world;
      const st = fresh(['stubborn']);
      const world = d.boss.script.world;
      void w;
      world.hitMe({ share: 5, from: { x: 0, z: 0 }, move: 'test' });
      check('Stubborn: a killing hit leaves 1 HP', d.heroHp, 1);
      world.hitMe({ share: 5, from: { x: 0, z: 0 }, move: 'test' });
      check('Stubborn: only once a fight', d.heroHp, 0);
      void st;

      fresh(['fresh']);
      d.boss.link.on.phase(1);
      check('Fresh Start: a shield at a phase', a.shieldOf(a.caster).amount / d.heroMax, 0.1);

      fresh(['ricochet']);
      check('Ricochet: a bolt bounces once', a.heroBolt({ reflect: 0 }).reflect, 1);

      // Nothing lasts past the run.
      fresh([]);
      check('without it: speed', hm.speed / walk, 1);
      check('without it: max HP', d.heroMax / base, 1);
      check('without it: no bounce', a.heroBolt ? 1 : 0, 0);

      // Offers: three, only what the hero can use, none it holds.
      const owned = new RunUpgrades();
      const offers = offersFor(kit, owned, 'a');
      check('three offers', offers.length, 3);
      check('the same seed, the same offers', offersFor(kit, owned, 'a').map((u) => u.id).join() === offers.map((u) => u.id).join() ? 1 : 0, 1);
      owned.add(offers[0].id);
      check('none it holds', offersFor(kit, owned, 'a').some((u) => u.id === offers[0].id) ? 1 : 0, 0);
      const noBolts = HERO_KITS.filter((k) => !UPGRADES.find((u) => u.id === 'ricochet').fits(k)).length;
      rows.push(`note heroes with no line bolts, never offered Ricochet: ${noBolts}`);

      // Tiers.
      const t3 = fresh([], 3);
      check('tier 3: boss HP', t3.link.maxHp, Math.round(def.hp.solo * 1.15 * 1.15), 0.5);
      const shown = d.boss.script.ctx.shown;
      check('tier 3: a shown time', shown(2.5), 2.5 * 0.81);
      check('tier 3: never under 1 s', shown(1.1), 1);
      check('tier 3: two extra moves', d.boss.brain.extra.length, 2, 0);
    } catch (e) {
      failed.push(String(e?.stack ?? e));
    }
    d.stop();
    return { ok: !failed.length, failed, rows };
  };

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
      check('sweep: in the cone', take(() => cast('sweep'), 1.8), 0.2);
      place(0, 5);
      check('sweep: walked out', take(() => { cast('sweep'); place(6.5, 1); }, 1.8), 0);
      place(0, -0.5);
      check('sweep: behind him', take(() => cast('sweep', { x: 0, z: 5 }), 1.8), 0);

      // Pillar Fall: under a stone, or stepped away.
      fresh(0, 1);
      place(-3, 13);
      check('pillar: stood still', take(() => cast('pillars'), 1.7), 0.15);
      place(-3, 13);
      check('pillar: walked out', take(() => { cast('pillars'); place(3, 13); }, 1.7), 0);

      // Sun Ray: stopped by cover, cracks the wall.
      fresh(0, 1);
      place(0, 5);
      check('ray: in the line', take(() => cast('ray'), 2.7), 0.22);
      fresh(3.5, 7);
      place(9.5, 7);
      const hp0 = d.wallHp.reduce((s, v) => s + Math.max(0, v), 0);
      check('ray: behind a wall', take(() => cast('ray'), 2.7), 0);
      check('ray: the wall took a hit', hp0 - d.wallHp.reduce((s, v) => s + Math.max(0, v), 0), 1, 0);

      // Noon: open floor, behind a wall (it falls), behind a column (it stays).
      fresh(0, 1);
      place(0, 5);
      check('noon: in the open', take(() => cast('noon'), 4.2), 0.4);
      yes('noon: he stands open', a.statusOf(d.foe).buff('vulnerable') === 0.5);
      fresh(3.5, 7);
      place(9.5, 7);
      const n0 = a.obstacles.length;
      check('noon: behind a wall', take(() => cast('noon'), 4.2), 0);
      check('noon: that wall fell', n0 - a.obstacles.length, 1, 0);
      const col = a.obstacles.find((o) => o.kind === 'pillar' && o.height >= 2), cl = Math.hypot(col.ax, col.az - 7), cdx = col.ax / cl, cdz = (col.az - 7) / cl;
      fresh(col.ax - cdx * 3.5, col.az - cdz * 3.5);
      place(col.ax + cdx * 1.6, col.az + cdz * 1.6);
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
      check('order: stood in wedge 1', lost(d.playerMax), 0.16);
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
      check('eclipse near: close', take(() => cast('eclipse', { step: 0 }), 1.8), 0.15);
      place(0, 12);
      check('eclipse near: far off', take(() => cast('eclipse', { step: 0 }), 1.8), 0);
      place(0, 12);
      check('eclipse far: far off', take(() => cast('eclipse', { step: 1 }), 1.8), 0.15);
      place(0, 3);
      check('eclipse far: close', take(() => cast('eclipse', { step: 1 }), 1.8), 0);

      // Anchors, alone: stand in the gold or pay.
      fresh(0, 1);
      const before = d.boss.script;
      place(-11, 7);
      check('anchor: nobody in it', take(() => cast('anchors', { step: 0 }), 3.2), 0.25);
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
      check('walking sun: it passed once', lost(d.playerMax), 0.12);

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
        const r = 15.5 * Math.sqrt(Math.random()), an = Math.random() * 6.283, x = Math.cos(an) * r, z = 7 + Math.sin(an) * r;
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
