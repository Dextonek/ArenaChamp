"""
A CPU duel on the game page (/game) with each hero given, at desktop (1280) and phone (375) width: picks the hero on the
Play screen, presses Fight, waits for the fight's HUD and saves a picture; prints the page's console errors and the icon
files it fetched (status codes).

    python pipeline/icons/vectorcraft/game-duel.py <out folder> "Bram,Shiori,Pim and Pom" [--port 5264]

Needs a dev server already running on the port, Google Chrome and `pip install playwright`.
"""
import argparse
import asyncio
from pathlib import Path

SIZES = [("desktop", 1280, 800, False), ("phone", 375, 812, True)]

PICK = """(hero) => { const b = [...document.querySelectorAll('button.pick')].find((e) => (e.title || '').startsWith(hero + ','));
  if (b) b.click(); return !!b; }"""
FIGHT = """() => { const b = [...document.querySelectorAll('button')].find((e) => /^Fight/.test(e.textContent.trim()));
  if (b) b.click(); return b ? b.textContent.trim() : null; }"""


async def run(a):
    from playwright.async_api import async_playwright
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
        for hero in [h.strip() for h in a.heroes.split(",")]:
            for name, w, h, touch in SIZES:
                ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=touch)
                page = await ctx.new_page()
                errors, icons = [], []
                page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.on("response", lambda r: icons.append(r.status) if "/icons/spells/" in r.url else None)
                await page.goto(f"http://localhost:{a.port}/game", wait_until="load", timeout=120000)
                await page.wait_for_function("typeof game !== 'undefined' && !!game.go", timeout=120000)
                await page.evaluate("game.go('cpu')")
                await page.wait_for_timeout(1500)
                picked = await page.evaluate(PICK, hero)
                await page.wait_for_timeout(800)
                fight = await page.evaluate(FIGHT)
                await page.wait_for_timeout(14000)
                await page.add_style_tag(content="*{animation:none!important;transition:none!important}")
                stem = "-".join("".join(c if c.isalnum() else " " for c in hero.lower()).split())
                await page.screenshot(path=str(out / f"duel-{stem}-{name}.jpg"), type="jpeg", quality=80)
                print(f"{hero} {name}: picked {picked}, pressed {fight!r}, icon files {len(icons)} "
                      f"(failed {sum(1 for s in icons if s >= 400)}), {len(errors)} console errors")
                for e in errors[:5]:
                    print("    " + e[:220])
                await ctx.close()
        await browser.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("heroes")
    ap.add_argument("--port", type=int, default=5264)
    asyncio.run(run(ap.parse_args()))
