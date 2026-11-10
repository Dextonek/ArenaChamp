// How closely the hero figure follows the animator's clip it replays (src/heroFigure.ts `replay`, src/motion/clips.ts):
// the angle between where each limb points on the hero and where it points in the clip, at the same moment. Paste into
// the VFX tool page (browser javascript tool):
//
//   eval(await (await fetch('/pipeline/tools/motion-check.js')).text());
//   await _motionCheck('Hank', 'attack')                     // -> the worst angle per limb through the basic attack
//   await _motionCheck('Hank', 'attack', { windup: 0.2 })    // at another wind-up time
//   await _motionCheck('Kaia', 'cast:thrust')
//   await _motionCheck('Sefu', 'walk', { speed: 4 })
//   await _motionCheck('Sefu', 'idle')
//
// Each line: limb, worst angle in degrees, the clip second it happened at. `rows` in the result has every sample
// (game time, clip, clip time, weight). Limbs: upper arm, forearm, thigh, shin (L and R) and what each hand holds.
// Arms that are not the clip's own on purpose (a second hand on a haft, a staff that only tips part of the way) show
// as large angles: read them with the hero in mind.
window._motionCheck = async (name, what, o = {}) => {
  const { sampleClip, newClipPose } = await import('/src/motion/clips.ts');
  const hm = vfx.heroMode, F = hm.figure;
  if (!hm.enabled) vfx.setHeroMode(true);
  vfx.view.paused = true;
  vfx.heroPickCtrl.setValue(name);
  for (let k = 0; k < 100 && !F.figure?.loaded; k++) await new Promise((r) => setTimeout(r, 100));
  const H = F.figure, bones = H.bones, P = newClipPose();
  const V = () => new H.root.position.constructor(), Qn = () => new H.root.quaternion.constructor();
  const base = hm.host.arena.caster.group.position.clone(), pos = base.clone(), dt = 1 / 60;
  const worst = {}, rows = [];
  const dirOf = (a, b) => {
    const pa = bones.get(a)?.getWorldPosition(V()), pb = bones.get(b)?.getWorldPosition(V());
    if (!pa || !pb) return null;
    const inv = H.root.getWorldQuaternion(Qn()).invert();
    return pb.sub(pa).normalize().applyQuaternion(inv);
  };
  const itemDir = (side) => {
    const hand = bones.get('hand' + side), rest = H.handRest[side], held = H.held[side];
    if (!hand || !rest || !held) return null;
    const q = H.root.getWorldQuaternion(Qn()).invert().multiply(hand.getWorldQuaternion(Qn())).multiply(rest.clone().invert());
    return held.dir.clone().applyQuaternion(q).normalize();
  };
  const deg = (a, b) => (a && b ? (Math.acos(Math.min(1, Math.max(-1, a.dot(b)))) * 180) / Math.PI : null);
  const measure = (gameT) => {
    const p = F.played;
    if (!p || p.w < 0.98) { rows.push([+gameT.toFixed(3), p?.clip ?? '-', p ? +p.t.toFixed(3) : 0, p ? +p.w.toFixed(2) : 0]); return; }
    H.root.updateMatrixWorld(true);
    sampleClip(p.clip, p.t, P, p.mirror, p.loop);
    const e = {};
    for (const s of ['L', 'R']) {
      e['upper' + s] = deg(dirOf('arm' + s, 'fore' + s), P.arm[s].upper);
      e['fore' + s] = deg(dirOf('fore' + s, 'hand' + s), P.arm[s].fore);
      e['thigh' + s] = deg(dirOf('thigh' + s, 'shin' + s), P.leg[s].thigh);
      e['shin' + s] = deg(dirOf('shin' + s, 'foot' + s), P.leg[s].shin);
      e['item' + s] = deg(itemDir(s), P.arm[s].aim);
    }
    for (const [k, v] of Object.entries(e)) if (v != null && (!worst[k] || v > worst[k][0])) worst[k] = [+v.toFixed(1), +p.t.toFixed(2)];
    rows.push([+gameT.toFixed(3), p.clip, +p.t.toFixed(3), +p.w.toFixed(2)]);
  };
  const run = (sec, state, move) => {
    for (let i = 0, n = Math.max(1, Math.round(sec / dt)); i < n; i++) {
      if (move) pos.addScaledVector(move, dt);
      F.follow(dt, pos, 0, state(i * dt));
      measure(i * dt);
    }
  };
  pos.copy(base); F.stand();
  for (let i = 0; i < 36; i++) F.follow(dt, pos, 0, {});
  if (what === 'attack') {
    const melee = o.melee ?? F.melee, windup = o.windup ?? 0.3, release = 0.18, total = windup + (o.after ?? 0.7);
    run(total, (t) => ({ attack: t < windup ? { wind: t / windup, release: 0, melee } : { wind: -1, release: Math.max(0, 1 - (t - windup) / release), melee } }));
  } else if (what === 'walk') {
    run(o.sec ?? 1.6, () => ({}), base.clone().set(0, 0, o.speed ?? 4));
  } else if (what === 'idle') {
    run(o.sec ?? 2, () => ({}));
  } else if (what.startsWith('cast:')) {
    F.cast(what.slice(5), o.dur ?? 0.7, false);
    run((o.dur ?? 0.7) + 0.3, () => ({}));
  }
  F.stand();
  vfx.view.paused = false;
  window._mc = { worst, rows };
  const clips = [...new Set(rows.map((r) => r[1]))].join(', ');
  return `${name} ${what} [${clips}]\n` + Object.entries(worst).map(([k, [v, t]]) => `${k} ${v}° at ${t}s`).join('\n');
};
