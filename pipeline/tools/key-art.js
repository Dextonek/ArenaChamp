// Paste into the VFX tool page under the dev server (browser javascript tool). Builds the game's key art in the engine: the
// heroes in the current style lined up on an arena, facing the middle, which stays open for the login panel.
//
//   eval(await (await fetch('/pipeline/tools/key-art.js')).text());
//   await _keyArt({ arena: 'skyruins' })   // returns a JPEG data URL of the canvas; size the viewport first (1600 x 900)
//
// Options: arena (an arena id), left and right (hero names, front row first), spots and spotsRight ([metres out from
// the middle, z] per hero, when the arena's cover stands where the usual spots are), styles (a cast style per hero, or
// 'stand'), light, quality (JPEG, default 0.86).
window._keyArt = async (o = {}) => {
  const THREE = await import('/node_modules/.vite/deps/three.js').catch(() => import('three'));
  const { HeroFigure } = await import('/src/heroFigure.ts');
  const d = vfx.duel, hm = vfx.heroMode;
  vfx.view.paused = true;
  if (!d.on) vfx.setDuel(true, 'run');
  d.arenaChoice = o.arena ?? 'skyruins';
  d.hazardsInRuns = false;
  d.start('run');
  // The duel's own two figures, the capsule and the foes stay out of the picture.
  d.figure.group.visible = false;
  hm.figure.group.visible = false;
  vfx.arena.caster.group.visible = false;
  for (const f of vfx.arena.foes ?? []) f.figure.group.visible = false;
  for (const who of ['hero', 'foe', 'partner']) d.traitFx?.plate(who, null, 0, null);   // the bars over the heads
  let scene = d.group;
  while (scene.parent) scene = scene.parent;
  // the duel's small health bar over the far hero (drawn over everything)
  scene.traverse((x) => { if (x.material?.isMeshBasicMaterial && x.material.color.getHex() === 0xd83a2a) x.parent.visible = false; });

  const rig = new THREE.Group();
  d.group.add(rig);
  window._keyRig?.removeFromParent();
  window._keyRig = rig;
  const kits = d.host.kits;
  const CX = 0, CZ = 7;
  // Front row first. The middle stays open, because the panel sits there.
  const SPOTS = o.spots ?? [[5.6, 15.6], [8.3, 13.2], [4.3, 12.2], [6.9, 10.2]];
  const left = o.left ?? ['Brannoc', 'Vesper', 'Sefu', 'Zephyr'];
  const right = o.right ?? ['Oblivion', 'Isolde', 'Auriel', 'Kaia'];
  const STYLES = ['raise', 'thrust', 'point', 'burst'];
  const figs = [];
  const place = (name, spot, side, i) => {
    const kit = kits.find((k) => k.name === name);
    const f = new HeroFigure();
    rig.add(f.group);
    const pos = new THREE.Vector3(CX + side * spot[0], 0, spot[1]);
    f.setModel(kit.model, pos, kit);
    // They face the middle of the near arena, a little toward the camera.
    figs.push({ f, pos, yaw: Math.atan2(CX - pos.x, 17 - pos.z), style: o.styles?.[name] ?? STYLES[i % 4], kit });
    // The hero's colour: a ring at the feet and a light that wraps the figure.
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: kit.accent, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    ring.position.set(pos.x, 0.06, pos.z);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.95, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: kit.accent, transparent: true, opacity: o.disc ?? 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    disc.position.set(pos.x, 0.05, pos.z);
    const light = new THREE.PointLight(kit.accent, o.light ?? 2, 6, 1.8);   // 7 suited the older, darker models
    light.position.set(pos.x, 2.1, pos.z + 1.3);
    rig.add(ring, disc, light);
    // Sparks of the same colour rising round it.
    const n = 26, g = new THREE.BufferGeometry(), a = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const an = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 1.3;
      a[k * 3] = pos.x + Math.cos(an) * r;
      a[k * 3 + 1] = 0.2 + Math.random() * 3.4;
      a[k * 3 + 2] = pos.z + Math.sin(an) * r;
    }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    rig.add(new THREE.Points(g, new THREE.PointsMaterial({ color: kit.accent, size: 0.09, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })));
  };
  left.forEach((n, i) => place(n, SPOTS[i], -1, i));
  right.forEach((n, i) => place(n, (o.spotsRight ?? SPOTS)[i], 1, i + 1));

  // Wait for the models, then pose each at the strike of its cast.
  const tick = () => new Promise((ok) => setTimeout(ok, 50));
  for (let k = 0; k < 200 && figs.some((x) => !x.f.loaded); k++) await tick();
  for (const x of figs) if (x.style !== 'stand') x.f.cast(x.style, 1.0, true);
  for (let s = 0; s < 34; s++) for (const x of figs) x.f.follow(1 / 60, x.pos, x.yaw, {});

  // A low camera from the near edge of the ring, looking across it.
  const c = vfx.controls;
  c.enableDamping = false;
  c.object.fov = o.fov ?? 36;
  c.object.updateProjectionMatrix();
  c.object.position.set(0, o.h ?? 1.35, o.z ?? 22.5);
  c.target.set(0, o.ty ?? 2.7, 4);
  c.update();
  const gl = [...document.querySelectorAll('canvas')].sort((p, q) => q.width * q.height - p.width * p.height)[0];
  // A second pass after the compile, so nothing renders as a first-frame blank.
  vfx.render();
  await tick();
  vfx.render();
  return gl.toDataURL('image/jpeg', o.quality ?? 0.86);
};
