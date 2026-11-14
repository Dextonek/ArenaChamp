// Before-and-after pictures of the props pass (2026-11-14): each shot is one spot on one floor, drawn in place (everything there), the hero
// standing beside it, from the game's high camera (closer than a player's zoom) and from low beside it; the two views side by side in one
// JPEG (1280 x 360). Run the same plan on the branch's base and after the fix: the same spot, the same cameras.
//   eval(await (await fetch('/pipeline/tools/props-probe.js')).text());   // the ground and the floor (props-probe.js builds it)
//   eval(await (await fetch('/pipeline/tools/props-shots.js')).text());
//   await _propsShots([{ floor: 2, shots: [{ name: 'lantern', x: -0.85, z: 4.6, R: 1.2 }] }], 'before')   // -> [{ name, url }]
// A shot: `x, z` its middle, `R` how big it is (the cameras stand back by it), `y` the height to look at (else 0.45 of R over the ground),
// `low: [dx, dz]` the low camera's side (default south-west), `lowY` its height (absolute), `lowK` its distance x k, `hero: false` leaves the hero away, `game: k` the high camera's distance x k.
(() => {
  window._propsShots = async (plan, label = '') => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const api = window.game?.api ?? { arena: vfx.arena, heroMode: vfx.heroMode };
    const cam = vfx.controls.object, gl = [...document.querySelectorAll('canvas')].sort((x, y) => y.width * y.height - x.width * x.height)[0];
    const out = [];
    for (const f of plan) {
      await _propsProbe(f.floor, { max: 0 });
      _world.step(0.2);
      const ground = _propsProbe.ground, hero = api.arena.caster.group;
      for (const s of f.shots) {
        const R = s.R ?? 1.5, gy = ground(s.x, s.z), y = s.y ?? gy + Math.max(0.4, R * 0.45);
        const look = new THREE.Vector3(s.x, y, s.z);
        if (s.hero === false) hero.position.set(s.x, -50, s.z);
        else { const hx = s.x + (s.hx ?? R + 0.8), hz = s.z + (s.hz ?? 0.4); hero.position.set(hx, ground(hx, hz), hz); }
        hero.updateMatrixWorld(true);
        // `low: 'down'`: the low camera on the downhill side (the ground's slope at the spot), looking up at it
        const down = () => { const e = 1.5; return [-(ground(s.x + e, s.z) - ground(s.x - e, s.z)), -(ground(s.x, s.z + e) - ground(s.x, s.z - e))]; };
        const [ldx, ldz] = s.low === 'down' ? down() : s.low ?? [-0.55, 0.85], ln = Math.hypot(ldx, ldz) || 1, D = Math.max(3.5, R * 2.4) * (s.lowK ?? 1);
        const views = [
          look.clone().add(new THREE.Vector3(0, 15, 10.5).normalize().multiplyScalar(Math.max(6, R * 3.4) * (s.game ?? 1))),
          new THREE.Vector3(s.x + (ldx / ln) * D, s.lowY ?? Math.max(ground(s.x + (ldx / ln) * D, s.z + (ldz / ln) * D), -0.3) + Math.max(0.9, R * 0.45) * (s.lowH ?? 1), s.z + (ldz / ln) * D),
        ];
        const c = document.createElement('canvas');
        c.width = 1280; c.height = 360;
        const g = c.getContext('2d');
        for (let v = 0; v < 2; v++) {
          cam.position.copy(views[v]);
          cam.lookAt(look);
          cam.updateMatrixWorld();
          vfx.render();
          const sw = gl.width, sh = gl.height, ar = 640 / 360;
          let cw = sw, ch = sw / ar;
          if (ch > sh) { ch = sh; cw = sh * ar; }
          g.drawImage(gl, (sw - cw) / 2, (sh - ch) / 2, cw, ch, v * 640, 0, 640, 360);
        }
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, 1280, 22);
        g.fillStyle = '#f0ead8'; g.font = '14px sans-serif';
        g.fillText(`${s.name} · floor ${f.floor} · (${s.x.toFixed(1)}, ${s.z.toFixed(1)})${label ? ' · ' + label : ''}`, 8, 16);
        out.push({ name: s.name, url: c.toDataURL('image/jpeg', s.q ?? 0.8) });
      }
      _world.end();
    }
    return out;
  };
})();
