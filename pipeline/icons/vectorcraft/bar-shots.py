"""
Pictures of the VectorCraft sample icons in the real spell bar (the duel's hero HUD), desktop and phone, with the flag
(`?icons=vc`) and without it, for docs/icons/sample/index.html:

    python pipeline/icons/vectorcraft/bar-shots.py [--port 5263]

Needs a dev server already running on the port (node node_modules/vite/bin/vite.js --port 5263 --strictPort), Google
Chrome and `pip install playwright`. It starts a CPU duel in the tool page with the hero, against Brannoc held still, and
saves docs/icons/sample/bar/<hero>-<desktop|phone>-<vc|old>.jpg.
"""
import argparse
import asyncio
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "docs" / "icons" / "sample" / "bar"

START = """async (hero) => {
  const tick = () => new Promise((ok) => setTimeout(ok, 50));
  const { CPU_LEVELS } = await import('/src/cpuLevels.ts');
  const d = vfx.duel;
  if (!d.on) vfx.setDuel(true, 'play');
  vfx.heroPickCtrl.setValue(hero);
  d.opponentChoice = 'Brannoc';
  d.cpuLevel = { ...CPU_LEVELS[0], speed: 0.01, castGap: [999, 999], cooldown: 99 };
  d.arenaChoice = 'temple';
  d.hazardsInRuns = false;
  d.shiftsInRuns = false;
  d.start('play');
  const t0 = performance.now();
  while (!(vfx.heroMode.figure?.loaded && d.figure?.loaded) && performance.now() - t0 < 30000) await tick();
  for (let i = 0; i < 40; i++) await tick();
  return true;
}"""

SHOTS = [("desktop", 1280, 800, ""), ("phone", 375, 812, "&touch=1")]


async def run(port):
    from playwright.async_api import async_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
        for hero in ("Anka", "Mum"):
            for name, w, h, extra in SHOTS:
                for flag in ("vc", "old"):
                    ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2,
                                                    has_touch=bool(extra))
                    page = await ctx.new_page()
                    q = f"?icons={flag}{extra}" if flag == "vc" else (f"?{extra[1:]}" if extra else "")
                    await page.goto(f"http://localhost:{port}/{q}", wait_until="load", timeout=120000)
                    await page.wait_for_function("typeof vfx !== 'undefined'", timeout=120000)
                    await asyncio.wait_for(page.evaluate(START, hero), timeout=90)
                    await page.add_style_tag(content="*{animation:none!important;transition:none!important} .lil-gui.root{display:none!important}")
                    await page.wait_for_timeout(400)
                    out = OUT / f"{hero.lower()}-{name}-{flag}.jpg"
                    if name == "desktop":
                        await page.screenshot(path=str(out), type="jpeg", quality=88, clip={"x": 0, "y": h - 190, "width": w, "height": 190})
                    else:
                        await page.screenshot(path=str(out), type="jpeg", quality=88)
                    print(f"saved {out}")
                    await ctx.close()
        await browser.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=5263)
    asyncio.run(run(ap.parse_args().port))
