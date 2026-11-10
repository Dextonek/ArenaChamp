// Checks of the fourth style's motion (src/motion/real.ts), by eye: a hero beside the animation pack's own figure at
// the same moments of a clip, and a blow with more or less of its legs. Paste into the game page (browser javascript
// tool), with the frame sink running (node pipeline/tools/frame-sink.mjs <folder>):
//
//   eval(await (await fetch('/pipeline/tools/v4-clips.js')).text());
//   await _v4cmp('cmp.jpg', 'hive', [['Melee_Hook', 0, 0.46], ['Sword_Attack', 0.1, 1.2]])   // [clip, from, to] seconds
//   await _v4legs('legs.jpg', [['cat', 'Sword_Regular_A', 0.23]], [1, 0.35, 0])              // [theme, clip, moment]
//   await _v4rods('rods.jpg', 'timber', 'r', { red: [0, 0, -1] }, [['Idle_Loop', 0.5, 0.2, 'side']])
//
// `_v4cmp` draws the pack's figure (pipeline/assets/ual/) above the hero, whole clips with no blending: what differs is
// the copy's fault, what looks wrong in both is the clip's. `_v4legs` shows a blow at its hit with that share of the
// legs (the rest standing), from the side and from the game's camera: how `LEGS` in real.ts was chosen. `_v4rods` puts
// coloured rods in a hand, each along a direction given in the model's own frame at rest (front +Z, up +Y, the hero's
// right -X), and draws the hero in [clip, moment, yaw, 'side' | 'cam'] frames: a way to try how a weapon should sit in
// the hand before building it in Blender. Models are cached per page: reload after rebuilding a GLB.
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const setup = async (theme) => {
    const { HeroPreview } = await import('/src/game/heroPreview.ts');
    const pv = (window._v4pv ??= new HeroPreview());
    const kit = game.api.kits.flatMap((k) => (k.alt ? [k, k.alt] : [k])).find((k) => (k.model ?? '').includes(`/${theme}_`));
    pv.figure.atEase = false;
    pv.shown = undefined;
    pv.show(`models/heroes/${theme}_v4.glb`, kit);
    const t0 = performance.now();
    while (!pv.figure.loaded && performance.now() - t0 < 15000) await sleep(30);
    return pv;
  };
  const put = async (c, file) => {
    const url = c.toDataURL('image/jpeg', 0.88), bin = atob(url.split(',')[1]), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    await fetch('http://127.0.0.1:5199/' + file, { method: 'PUT', body: buf });
  };
  const shot = (pv, g, x, y, W, H, view) => {
    if (view === 'cam') { pv.camera.position.set(0, 7.0, 5.0); pv.camera.lookAt(0, 1.0, 0); } else { pv.camera.position.set(0, 1.35, 7.2); pv.camera.lookAt(0, 1.25, 0); }
    pv.renderer.setSize(W * 2, H * 2, false);
    pv.camera.aspect = W / H;
    pv.camera.updateProjectionMatrix();
    pv.renderer.render(pv.scene, pv.camera);
    g.drawImage(pv.canvas, x, y, W, H);
  };
  const sheet = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#111';
    g.fillRect(0, 0, w, h);
    return [c, g];
  };
  const label = (g, s, x, y) => { g.fillStyle = '#fc8'; g.font = '12px sans-serif'; g.fillText(s, x + 4, y + 12); };

  window._v4cmp = async (file, theme, rows, yaw = 0.8, N = 8) => {
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const THREE = await import('/node_modules/.vite/deps/three.js');
    window._v4ref ??= {};
    for (const f of ['UAL1_Standard', 'UAL2_Standard']) {
      if (window._v4ref[f]) continue;
      const g = await new GLTFLoader().loadAsync(`/pipeline/assets/ual/${f}.glb`);
      g.scene.scale.setScalar(1.3);
      g.scene.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; });
      window._v4ref[f] = { scene: g.scene, clips: g.animations, mixer: new THREE.AnimationMixer(g.scene) };
    }
    const pv = await setup(theme), real = pv.figure.real;
    const W = 190, H = 240, L = 16, [c, g] = sheet(W * N, (2 * H + L) * rows.length);
    for (let r = 0; r < rows.length; r++) {
      const [clip, a, b] = rows[r];
      const ref = Object.values(window._v4ref).find((x) => x.clips.some((cl) => cl.name === clip));
      const rc = ref?.clips.find((cl) => cl.name === clip);
      for (let i = 0; i < N; i++) {
        const t = a + ((b - a) * i) / (N - 1), y0 = r * (2 * H + L);
        label(g, `${clip} ${t.toFixed(2)}`, i * W, y0);
        if (ref) {
          real.root.visible = false;
          pv.scene.add(ref.scene);
          ref.scene.rotation.y = yaw;
          ref.scene.position.set(0, real.root.position.y, 0);
          ref.mixer.stopAllAction();
          const act = ref.mixer.clipAction(rc);
          act.play();
          act.time = Math.min(rc.duration - 1e-3, t);
          ref.mixer.update(0);
          shot(pv, g, i * W, y0 + L, W, H);
          pv.scene.remove(ref.scene);
          real.root.visible = true;
        }
        real.root.position.set(0, real.root.position.y, 0);
        real.root.rotation.y = yaw;
        real.pose([{ clip, t, legs: 1, torso: 1, armR: 1, armL: 1 }]);
        shot(pv, g, i * W, y0 + L + H, W, H);
      }
    }
    await put(c, file);
    return 'ok';
  };

  window._v4legs = async (file, list, shares = [1, 0.35, 0]) => {
    const W = 200, H = 250, L = 16, [c, g] = sheet(W * shares.length * 2, (H + L) * list.length);
    for (let r = 0; r < list.length; r++) {
      const [theme, clip, hit] = list[r];
      const pv = await setup(theme), real = pv.figure.real;
      for (let v = 0; v < 2; v++) for (let i = 0; i < shares.length; i++) {
        const s = shares[i], x = (v * shares.length + i) * W, y = r * (H + L);
        real.root.position.set(0, real.root.position.y, 0);
        real.root.rotation.y = v ? 0.3 : 0.9;
        real.pose([{ clip: 'Idle_Loop', t: 0.5, loop: true, legs: 1 - s }, { clip, t: hit, legs: s, torso: 1, armR: 1, armL: 1 }]);
        shot(pv, g, x, y + L, W, H, v ? 'cam' : 'side');
        label(g, `${theme} ${clip} legs ${s}${v ? ' cam' : ''}`, x, y);
      }
    }
    await put(c, file);
    return 'ok';
  };

  window._v4rods = async (file, theme, side, rods, frames, len = 0.8) => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const pv = await setup(theme), real = pv.figure.real;
    let hand = null, mesh = null;
    real.root.traverse((o) => { if (o.name === `hand_${side}` && o.isBone) hand = o; if (o.isSkinnedMesh && o.skeleton.bones.some((b) => b.name === `hand_${side}`)) mesh ??= o; });
    hand = mesh.skeleton.bones.find((b) => b.name === `hand_${side}`);
    // the hand at rest, in the model's own frame: a direction there, said in the hand's
    const rest = new THREE.Matrix4().copy(mesh.skeleton.boneInverses[mesh.skeleton.bones.indexOf(hand)]).invert();
    const inv = new THREE.Quaternion().setFromRotationMatrix(rest).invert();
    const made = [], local = {};
    for (const [col, dir] of Object.entries(rods)) {
      const d = new THREE.Vector3(...dir).normalize().applyQuaternion(inv);
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 6), mat);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      rod.position.copy(d).multiplyScalar(len / 2);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat);
      tip.position.copy(d).multiplyScalar(len);
      hand.add(rod, tip);
      made.push(rod, tip);
      local[col] = d.toArray().map((v) => +v.toFixed(2));
    }
    const W = 210, H = 270, L = 16, [c, g] = sheet(W * frames.length, H + L);
    frames.forEach(([clip, t, yaw, view], i) => {
      real.root.position.set(0, real.root.position.y, 0);
      real.root.rotation.y = yaw;
      real.pose([{ clip, t, legs: 1, torso: 1, armR: 1, armL: 1 }]);
      shot(pv, g, i * W, L, W, H, view);
      label(g, `${clip} ${t} ${view}`, i * W, 0);
    });
    for (const m of made) hand.remove(m);
    await put(c, file);
    return local;
  };
})();
