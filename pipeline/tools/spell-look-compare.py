"""
A spell's LOOK, old code against new (docs/pipeline/hero-framework.md, section 12): the fight prints see health, places and
cooldowns, not particles; this plays each spell on the tool page of two checkouts with the same dice (seed 7) and the same
360 steps of a 60th of a second, and compares a fingerprint of everything the effect draws, every frame: each object's
visibility, place, turn and size, its materials' opacity, colour and number uniforms, instanced matrices and moving buffers,
the shake and the screen effect. SAME, or the first frame where the two part.

    # two dev servers, one per checkout (the old one e.g. `git worktree add --detach <dir> <ref>`, with node_modules linked):
    node node_modules/vite/bin/vite.js --config pipeline/tools/hero-prints.vite.config.ts --port 5263 --strictPort   # in the old
    node node_modules/vite/bin/vite.js --config pipeline/tools/hero-prints.vite.config.ts --port 5264 --strictPort   # in this one
    python -I pipeline/tools/spell-look-compare.py 5263 5264 out.json "cobra spit,stomp"

About 10 s a spell. It caught a dust puff raised by 1 cm (frame 16 of Cobra Spit). Stop the two servers by their PIDs afterwards.
Needs `pip install playwright` and Chrome.
"""
import asyncio, json, sys, time

JS = r"""
async (label) => {
  const mul = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const real = Math.random;
  Math.random = mul(7);
  const out = [];
  try {
    vfx.selectMode(label);
    const e = vfx.effect;
    if (!e) return { error: 'no effect' };
    vfx.view.paused = true;
    e.play();
    const r = (x) => Math.round(x * 1e4);
    for (let f = 0; f < 360; f++) {
      vfx.step(1 / 60);
      let h = 2166136261;
      const add = (v) => { h ^= (v | 0); h = Math.imul(h, 16777619); };
      let objs = 0;
      e.group.traverse((o) => {
        objs++;
        add(o.visible ? 1 : 2);
        if (!o.visible) return;
        for (const v of [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z]) add(r(v));
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          add(r(m.opacity ?? 1));
          if (m.color) add(m.color.getHex());
          if (m.uniforms) for (const k of Object.keys(m.uniforms).sort()) { const u = m.uniforms[k].value; if (typeof u === 'number') add(r(u)); }
        }
        if (o.isInstancedMesh) { add(o.count); const a = o.instanceMatrix.array; for (let i = 0; i < o.count * 16; i++) add(r(a[i])); }
        const g = o.geometry;
        if (g && g.attributes) for (const k of Object.keys(g.attributes).sort()) {
          const at = g.attributes[k];
          if (at.usage === 35048 || at.isInstancedBufferAttribute) { const a = at.array; for (let i = 0; i < a.length; i++) add(r(a[i])); }
        }
        if (g) add(g.drawRange.count === Infinity ? -1 : g.drawRange.count);
      });
      add(r(e.shake));
      const s = e.screen;
      if (s) for (const v of [s.darken, s.impact, s.whiteout || 0, s.speedLines || 0]) add(r(v));
      out.push([h >>> 0, objs]);
    }
  } catch (err) { return { error: String(err), frames: out }; }
  finally { Math.random = real; }
  return { frames: out };
}
"""


async def run(port, labels, browser):
    res = {}
    for label in labels:
        page = await browser.new_page()
        await page.goto(f"http://localhost:{port}/", wait_until="load", timeout=120000)
        await page.wait_for_function("() => window.vfx && window.vfx.selectMode", timeout=120000)
        await page.wait_for_timeout(1500)
        res[label] = await page.evaluate(JS, label)
        await page.close()
    return res


async def main():
    from playwright.async_api import async_playwright
    old_port, new_port, out, labels = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(",")
    t0 = time.time()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--use-angle=d3d11"])
        old = await run(old_port, labels, b)
        new = await run(new_port, labels, b)
        await b.close()
    report = {}
    for l in labels:
        o, n = old[l], new[l]
        if "error" in o or "error" in n:
            report[l] = {"old": o.get("error"), "new": n.get("error")}
            continue
        diff = next((i for i, (a, c) in enumerate(zip(o["frames"], n["frames"])) if a != c), None)
        report[l] = "SAME (360 frames)" if diff is None else f"DIFFERS from frame {diff}: old {o['frames'][diff]} new {n['frames'][diff]}"
        print(f"  {l:18} {report[l]}  (distinct frames old {len(set(map(tuple, o['frames'])))}, new {len(set(map(tuple, n['frames'])))})")
    json.dump({"report": report, "seconds": round(time.time() - t0, 1)}, open(out, "w"), indent=1)
    print("seconds", round(time.time() - t0, 1))


asyncio.run(main())
