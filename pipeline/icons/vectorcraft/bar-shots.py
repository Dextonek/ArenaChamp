"""
Pictures of the VectorCraft icons in the real spell bar (the duel's hero HUD), desktop (1280) and phone (375), for the
batch pages (docs/icons/batch-<n>/bar/):

    python pipeline/icons/vectorcraft/bar-shots.py <out folder> "Bram,Bo,Big Yoko" [--port 5264]

Needs a dev server already running on the port (node node_modules/vite/bin/vite.js --port <port> --strictPort), Google
Chrome and `pip install playwright`. It starts a CPU duel in the tool page with each hero, against Brannoc held still,
and saves <out>/<stem>-<desktop|phone>.jpg, printing the page's console errors. (The sample's pictures, with and
without the old `?icons=vc` flag, are in docs/icons/sample/bar/.)
"""
import argparse
import asyncio
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]


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

# The crop: the slot icons (their canvases are 128 px) and, on desktop, the hero's portrait plate beside them; the tool
# page's fps readout is hidden (the HUD is the game's own, src/heroMode.ts; the duel runs in the tool page).
BOX = """(desktop) => {
  for (const el of document.querySelectorAll('div')) if (!el.children.length && / fps/.test(el.textContent)) el.style.display = 'none';
  const rs = [...document.querySelectorAll('canvas')].filter((c) => c.width === 128 || (desktop && c.width === 64))
    .map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0 && r.top > innerHeight / 2);
  const pad = desktop ? 22 : 16;
  const x0 = Math.max(0, Math.min(...rs.map((r) => r.left)) - pad), y0 = Math.max(0, Math.min(...rs.map((r) => r.top)) - pad);
  const x1 = Math.min(innerWidth, Math.max(...rs.map((r) => r.right)) + pad);
  const y1 = Math.min(innerHeight, Math.max(...rs.map((r) => r.bottom)) + pad + (desktop ? 18 : 0));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}"""

SHOTS = [("desktop", 1280, 800, ""), ("phone", 375, 812, "&touch=1")]


def stem(hero):
    return "pim" if hero == "Pim and Pom" else "-".join("".join(c if c.isalnum() else " " for c in hero.lower()).split())


async def run(port, out, heroes):
    from playwright.async_api import async_playwright
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
        for hero in heroes:
            for name, w, h, extra in SHOTS:
                ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=bool(extra))
                page = await ctx.new_page()
                errors = []
                page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(str(e)))
                await page.goto(f"http://localhost:{port}/" + (f"?{extra[1:]}" if extra else ""), wait_until="load", timeout=120000)
                await page.wait_for_function("typeof vfx !== 'undefined'", timeout=120000)
                await asyncio.wait_for(page.evaluate(START, hero), timeout=90)
                await page.add_style_tag(content="*{animation:none!important;transition:none!important} .lil-gui.root{display:none!important}")
                await page.wait_for_timeout(1500)
                path = out / f"{stem(hero)}-{name}.jpg"
                box = await page.evaluate(BOX, name == "desktop")
                await page.screenshot(path=str(path), type="jpeg", quality=88, clip=box)
                print(f"saved {path}; {len(errors)} console errors" + "".join(f"\n    {e[:200]}" for e in errors[:4]))
                await ctx.close()
        await browser.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("heroes")
    ap.add_argument("--port", type=int, default=5264)
    a = ap.parse_args()
    asyncio.run(run(a.port, Path(a.out), [h.strip() for h in a.heroes.split(",")]))