// Paste into the VFX tool page under the dev server (browser javascript tool). Plays a boss's move in a stepped fight and lays frames
// of it side by side, cropped round the boss and the hero: to check that its body strikes when its zone lands.
//
//   eval(await (await fetch('/pipeline/tools/boss-anim.js')).text());
//   await _fx.ready()                                  // both bosses' models loaded
//   await _strip('Stone Sweep', async () => { await _fx.boss('sun'); _fx.foe(0, 3); _fx.place(0, 8); _fx.face(); _fx.cast('sweep'); },
//     [[1.2, '-0.4 s'], [1.6, '0 LANDS'], ...])         // [seconds after the setup, label (null: no frame), what to do then]
//   // then look at the page: the sheet covers it. _strip.hide() takes it away.
(() => {
  window._fx = {
    seq: 7000,
    async boss(which) {
      const d = vfx.duel;
      const mod = which === 'ash' ? await import('/src/raid/ashEmber.ts') : await import('/src/raid/sunWarden.ts');
      const def = which === 'ash' ? mod.ASH_AND_EMBER : mod.SUN_WARDEN;
      const { LocalLink } = await import('/src/raid/link.ts');
      vfx.view.paused = true;
      if (!d.on) vfx.setDuel(true, 'play');
      vfx.heroPickCtrl.setValue('Lyra');
      d.holdStart = false;
      d.startBoss({ def, link: new LocalLink(def), seed: 'anim', mode: 'play' });
      this.step(0.5);
      d.boss.brain.pause = 1e9;
      d.boss.brain.rimWait = 1e9;
      return def.id;
    },
    async ready() {
      document.querySelectorAll('.lil-gui').forEach((e) => { e.style.display = 'none'; });
      for (const who of ['sun', 'ash']) {
        await this.boss(who);
        for (let i = 0; i < 40 && !vfx.duel.figure.figure?.loaded; i++) await new Promise((r) => setTimeout(r, 250));
      }
      await new Promise((r) => setTimeout(r, 1200));
      return 'ready';
    },
    step(s) { for (let i = 0; i < Math.round(s * 60); i++) vfx.step(1 / 60); },
    /** A step of a move, aimed at the hero (or at `x`, `z`); `rim`: from the one on the rim; `from`: from there (a tag's rim spot). */
    cast(move, o = {}) {
      const d = vfx.duel, b = o.from ?? (o.rim ? d.rimAt : d.foe.group.position), me = vfx.arena.caster.group.position;
      const x = o.x ?? me.x, z = o.z ?? me.z;
      d.boss.link.cast({ id: ++this.seq, move, step: o.step ?? 0, x, z, fx: b.x, fz: b.z, dir: Math.atan2(x - b.x, z - b.z), seed: o.seed ?? 4242, target: 0, rim: o.rim, form: o.form });
    },
    place(x, z) { vfx.arena.caster.group.position.set(x, 0, z); vfx.duel.playerHp = vfx.duel.playerMax; },
    foe(x, z) { const V = vfx.arena.caster.group.position.constructor; vfx.arena.placeFoe(vfx.duel.foe, new V(x, 0, z)); },
    /** The boss turns to the hero, as the brain turns it before a move. */
    face() { const d = vfx.duel, b = d.foe.group.position, me = vfx.arena.caster.group.position; d.foe.group.rotation.y = Math.atan2(me.x - b.x, me.z - b.z); },
  };

  window._strip = async (title, setup, plan, o = {}) => {
    await setup?.();
    const gl = document.querySelector('canvas'), V = vfx.arena.caster.group.position.constructor;
    const W = 400, H = 285, frames = [];
    let t = 0;
    for (const [at, label, fn, fo = {}] of plan) {
      _fx.step(at - t);
      t = at;
      if (fn) await fn();
      if (!label) continue;
      vfx.render();
      const cam = vfx.duel.boss.script.world.camera, oo = { ...o, ...fo };
      const from = (oo.rim ? new V(vfx.duel.rimAt.x, 2.5, vfx.duel.rimAt.z) : vfx.duel.foe.group.position.clone().setY(2.5)).project(cam);
      const me = vfx.arena.caster.group.position.clone().setY(1).project(cam);
      const sx = (v) => ((v.x + 1) / 2) * gl.width, sy = (v) => ((1 - v.y) / 2) * gl.height;
      const k = oo.toward ?? 0.3, cx = sx(from) + (sx(me) - sx(from)) * k, cy = sy(from) + (sy(me) - sy(from)) * k;
      const span = Math.max(Math.hypot(sx(from) - sx(me), sy(from) - sy(me)) * (oo.wide ?? 2.2), gl.height * (oo.span ?? 0.8));
      const f = document.createElement('canvas');
      f.width = W;
      f.height = H;
      const g = f.getContext('2d');
      g.drawImage(gl, cx - span / 2, cy - (span * H) / W / 2, span, (span * H) / W, 0, 0, W, H);
      g.fillStyle = '#000b';
      g.fillRect(0, H - 24, W, 24);
      g.fillStyle = label.includes('LANDS') ? '#ffd27a' : '#fff';
      g.font = 'bold 15px sans-serif';
      g.fillText(label, 8, H - 7);
      frames.push(f);
    }
    const sheet = document.createElement('canvas');
    sheet.width = W * 2;
    sheet.height = 30 + H * Math.ceil(frames.length / 2);
    const g = sheet.getContext('2d');
    g.fillStyle = '#111';
    g.fillRect(0, 0, sheet.width, sheet.height);
    g.fillStyle = '#ffd27a';
    g.font = 'bold 18px sans-serif';
    g.fillText(title, 8, 21);
    frames.forEach((f, i) => g.drawImage(f, (i % 2) * W, 30 + Math.floor(i / 2) * H));
    let img = document.getElementById('strip');
    if (!img) {
      img = document.createElement('img');
      img.id = 'strip';
      img.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#111;z-index:99999;';
      document.body.append(img);
    }
    img.src = sheet.toDataURL('image/jpeg', 0.92);
    img.style.display = '';
    // A frame for the sheet to show in; a hidden page gets no frames, so a timer stands in.
    await new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 300); });
    return `${title}: ${frames.length} frames`;
  };
  window._strip.hide = () => { const img = document.getElementById('strip'); if (img) img.style.display = 'none'; };
})();
