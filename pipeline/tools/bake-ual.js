// Bakes clips from Quaternius' Universal Animation Library (CC0, pipeline/assets/ual/) into the same per-frame format as
// bake-motion.html does for the KayKit pack (src/motion/clips.ts reads both): per frame, in the character's own frame (X
// its left, Y up, Z forward), the hips' place from rest in leg lengths, the hips', chest's and head's turn from rest, which
// way each upper arm, forearm (and the item in each hand) points, which way each thigh and shin points and how each foot is
// turned from rest. Also the figure's own proportions, which the game fits the clips by (heroFigure.ts `fitLeg`, `fitArm`).
// The pack's figure is a realistic mannequin (Unreal-style bones): its thigh and shin are about equal and its idle arms
// hang 12-20 degrees out, close to our heroes (docs/knowledge/retargeting-arms.md).
//
// Paste into a dev-server page (browser javascript tool):
//   eval(await (await fetch('/pipeline/tools/bake-ual.js')).text());
//   await _bakeUal()          // -> summary; the JSON text is in window._ualJson (PUT it to the frame sink, copy to src/motion/ual.json)
window._bakeUal = async (names = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Sword_Idle']) => {
  const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const gltf = await new GLTFLoader().loadAsync('/pipeline/assets/ual/UAL1_Standard.glb');
  const b = {};
  gltf.scene.traverse((o) => { if (o.isBone) b[o.name] = o; });
  const B = {
    hips: b.pelvis, chest: b.spine_03, head: b.Head,
    upperarml: b.upperarm_l, lowerarml: b.lowerarm_l, wristl: b.hand_l, upperarmr: b.upperarm_r, lowerarmr: b.lowerarm_r, wristr: b.hand_r,
    upperlegl: b.thigh_l, lowerlegl: b.calf_l, footl: b.foot_l, upperlegr: b.thigh_r, lowerlegr: b.calf_r, footr: b.foot_r,
  };
  const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
  const wp = (o, out = V()) => o.getWorldPosition(out);
  const wq = (o, out = Q()) => o.getWorldQuaternion(out);
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const FPS = 30;
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const pose = (name, t) => {
    mixer.stopAllAction();
    const clip = gltf.animations.find((a) => a.name === name);
    mixer.clipAction(clip).reset().play();
    mixer.setTime(t);
    gltf.scene.updateMatrixWorld(true);
    return clip;
  };
  // rest: the pack's T-pose
  pose('A_TPose', 0);
  const R = { hips: wp(B.hips), q: {} };
  for (const n of ['hips', 'chest', 'head', 'footl', 'footr']) R.q[n] = wq(B[n]);
  const thigh = wp(B.upperlegl).distanceTo(wp(B.lowerlegl)), shin = wp(B.lowerlegl).distanceTo(wp(B.footl));
  const leg = thigh + shin;
  const restReach = wp(B.upperlegl).distanceTo(wp(B.footl)) / leg;
  // the hand's item: along the hand bone's own axis that points out of the fist at rest (T-pose: along the arm, +-X)
  const slotAxis = new THREE.Vector3(0, 1, 0);
  const frameOf = () => {
    const out = [];
    const push = (...v) => { for (const x of v) out.push(r3(x)); };
    const h = wp(B.hips).sub(R.hips).divideScalar(leg);
    push(h.x, h.y, h.z);
    for (const n of ['hips', 'chest', 'head']) { const d = wq(B[n]).multiply(R.q[n].clone().invert()); push(d.x, d.y, d.z, d.w); }
    for (const s of ['l', 'r']) {
      const ua = wp(B['lowerarm' + s]).sub(wp(B['upperarm' + s])).normalize();
      const la = wp(B['wrist' + s]).sub(wp(B['lowerarm' + s])).normalize();
      const aim = slotAxis.clone().applyQuaternion(wq(B['wrist' + s])).normalize();
      push(ua.x, ua.y, ua.z, la.x, la.y, la.z, aim.x, aim.y, aim.z);
    }
    for (const s of ['l', 'r']) {
      const ul = wp(B['lowerleg' + s]).sub(wp(B['upperleg' + s])).normalize();
      const ll = wp(B['foot' + s]).sub(wp(B['lowerleg' + s])).normalize();
      const f = wq(B['foot' + s]).multiply(R.q['foot' + s].clone().invert());
      push(ul.x, ul.y, ul.z, ll.x, ll.y, ll.z, f.x, f.y, f.z, f.w);
    }
    return out;
  };
  // how far the idle hangs the upper arms out from the sides (the figure's own hang, for fitting arms)
  let armOut = 0, k = 0;
  const idle = gltf.animations.find((a) => a.name === 'Idle_Loop');
  for (let i = 0; i < 8; i++) {
    pose('Idle_Loop', (idle.duration * i) / 8);
    for (const s of ['l', 'r']) {
      const u = wp(B['lowerarm' + s]).sub(wp(B['upperarm' + s])).normalize();
      armOut += Math.atan2(Math.abs(u.x), -u.y);
      k++;
    }
  }
  armOut /= k;
  const data = {
    source: 'Universal Animation Library 1 (Standard) by Quaternius (CC0), UAL1_Standard.glb',
    fps: FPS, stride: 0,
    figure: { thigh: r3(thigh), shin: r3(shin), restReach: r3(restReach), armOut: r3(armOut) },
    clips: {},
  };
  for (const name of names) {
    const clip = gltf.animations.find((a) => a.name === name);
    if (!clip) { console.warn('no clip', name); continue; }
    const n = Math.max(2, Math.round(clip.duration * FPS) + 1), frames = [];
    for (let i = 0; i < n; i++) {
      pose(name, Math.min(clip.duration - 1e-4, i / FPS));
      const f = frameOf();
      data.stride = f.length;
      frames.push(...f);
    }
    data.clips[name] = { dur: r3(clip.duration), hit: 0, frames };
  }
  mixer.stopAllAction();
  window._ualJson = JSON.stringify(data);
  return Object.entries(data.clips).map(([k2, c]) => `${k2}: ${c.dur}s, ${c.frames.length / data.stride} frames`).join('\n')
    + `\nstride ${data.stride}, figure ${JSON.stringify(data.figure)}, ${window._ualJson.length} chars`;
};
