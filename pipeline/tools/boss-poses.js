// Paste into the VFX tool page under the dev server (browser javascript tool). Poses one boss through its idle, walk, each cast
// style, kneel, phases and fall, and draws them as one contact sheet, so a body's look can be judged in one picture.
//
//   eval(await (await fetch('/pipeline/tools/boss-poses.js')).text());
//   await _bossPoses('warden')   // 'warden', 'ash' or 'ember'; the sheet opens as an <img> over the page, _bossPoses.close() hides it
(() => {
  let shown = null;
  window._bossPoses = async (who = 'warden', o = {}) => {
    const d = vfx.duel, a = vfx.arena, hm = vfx.heroMode;
    const { SUN_WARDEN } = await import('/src/raid/sunWarden.ts');
    const { ASH_AND_EMBER } = await import('/src/raid/ashEmber.ts');
    const { LocalLink } = await import('/src/raid/link.ts');
    const def = who === 'warden' ? SUN_WARDEN : ASH_AND_EMBER;
    const styles = o.styles ?? (who === 'warden' ? ['swing', 'raise', 'thrust', 'burst', 'channel'] : who === 'ash' ? ['slam', 'lunge', 'channel', 'raise'] : ['thrust', 'point', 'raise', 'burst']);
    const V = a.caster.group.position.constructor;
    const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { simMs += 1000 / 60; vfx.step(1 / 60); } };
    vfx.view.paused = true;
    if (!d.on) vfx.setDuel(true, 'play');
    vfx.heroPickCtrl.setValue(o.hero ?? 'Lyra');
    d.holdStart = false;
    d.startBoss({ def, link: new LocalLink(def), seed: 'poses', mode: 'play' });
    // The models load first, on the real clock; then time is stepped by hand.
    await d.whenReady();
    if (who === 'ember') d.figure.preload('models/bosses/ember.glb');
    let simMs = performance.now();
    const realNow = performance.now.bind(performance);
    performance.now = () => simMs;
    d.boss.brain.pause = 1e9;
    d.boss.brain.rimWait = 1e9;
    d.countdown = -1;
    if (who === 'ember') d.bossWorld().tag(1, 0, 3, 0, -9.4);
    const at = new V(0, 0, 4);
    a.placeFoe(d.foe, at);
    d.foe.group.rotation.y = 0;
    // The camera looks at the boss, and the hero stands well off to the side.
    a.caster.group.position.set(o.side ?? 9, 0, 4 + (o.back ?? 6));
    hm.focus = at.clone();
    hm.setZoom(o.zoom ?? 0.85);
    step(0.6);
    const shots = [];
    const W = o.w ?? 330, H = o.h ?? 300;
    const grab = (label) => {
      vfx.render();
      const src = vfx.view.renderer?.domElement ?? document.querySelector('canvas');
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      // The middle of the frame, where the boss stands.
      const k = o.crop ?? 1, sw = src.width * 0.5 * k, sh = src.height * 0.7 * k;
      g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2 - src.height * 0.08, sw, sh, 0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(0, 0, W, 22);
      g.fillStyle = '#ffd27a';
      g.font = '600 14px sans-serif';
      g.fillText(label, 6, 16);
      shots.push(c);
    };
    const hold = () => { d.playerHp = d.playerMax; };
    try {
      grab('idle');
      // Walking toward the hero, then away.
      for (let i = 0; i < 40; i++) { d.bossWorld().walk(1 / 60, 0, 12, 2.5); step(1 / 60); }
      grab('walking');
      a.placeFoe(d.foe, at);
      d.foe.group.rotation.y = 0;
      step(0.5);
      for (const style of styles) {
        const dur = 1.6;
        d.figure.cast(style, dur, false);
        step(dur * 0.55);
        hold();
        grab(`${style}: wind-up`);
        step(dur * 0.2 + 0.05);
        grab(`${style}: strike`);
        step(0.8);
      }
      d.figure.setBodyPhase(1);
      step(1.6);
      grab('phase 2');
      d.figure.setBodyPhase(2);
      step(1.6);
      grab('phase 3');
      a.statusOf(d.foe).hold(3);
      step(1.2);
      grab('kneeling');
      step(2);
      d.figure.fall(0.5);
      step(0.05);
      grab('falling');
      d.figure.fall(1);
      step(0.05);
      grab('fallen');
    } finally {
      performance.now = realNow;
      hm.focus = null;
    }
    window._bossPoses.shots = shots;
    const cols = o.cols ?? 4, rows = Math.ceil(shots.length / cols);
    const sheet = document.createElement('canvas');
    sheet.width = cols * W;
    sheet.height = rows * H;
    const g = sheet.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, sheet.width, sheet.height);
    shots.forEach((c, i) => g.drawImage(c, (i % cols) * W, Math.floor(i / cols) * H));
    shown?.remove();
    shown = new Image();
    shown.src = sheet.toDataURL('image/jpeg', 0.85);
    shown.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:auto;z-index:99;background:#000;';
    document.body.append(shown);
    return { shots: shots.length, cols, rows };
  };
  window._bossPoses.close = () => { shown?.remove(); shown = null; };
  // A few frames of the last sheet, two to a row, as big as the window allows: _bossPoses.show([0, 13, 14, 16])
  window._bossPoses.show = (list) => {
    const shots = window._bossPoses.shots ?? [], W = shots[0]?.width ?? 330, H = shots[0]?.height ?? 300, rows = Math.ceil(list.length / 2);
    const c = document.createElement('canvas');
    c.width = W * 2;
    c.height = H * rows;
    const g = c.getContext('2d');
    list.forEach((i, k) => shots[i] && g.drawImage(shots[i], (k % 2) * W, Math.floor(k / 2) * H));
    shown?.remove();
    shown = new Image();
    shown.src = c.toDataURL('image/jpeg', 0.9);
    shown.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;z-index:9999;background:#000;';
    document.body.append(shown);
    return list.length;
  };
})();
