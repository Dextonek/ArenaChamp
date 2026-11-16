"""
The VectorCraft icons where the game shows them outside a fight: the Heroes page (its table and a hero's spells) and the
Shop, at desktop (1280) and phone (375) width, with the console's errors and the icon files the page asked for.

    python pipeline/icons/vectorcraft/game-shots.py <out folder> [--port 5264] [--hero Mum]

Needs a dev server already running on the port, Google Chrome and `pip install playwright`.
"""
import argparse
import asyncio
from pathlib import Path

SIZES = [("desktop", 1280, 800, False), ("phone", 375, 812, True)]


async def run(a):
    from playwright.async_api import async_playwright
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio"])
        for name, w, h, touch in SIZES:
            ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, has_touch=touch)
            page = await ctx.new_page()
            errors, icons = [], []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("response", lambda r: icons.append((r.status, r.url.split("/")[-1])) if "/icons/spells/" in r.url else None)
            await page.goto(f"http://localhost:{a.port}/game", wait_until="load", timeout=120000)
            await page.wait_for_function("typeof game !== 'undefined' && !!game.go", timeout=120000)
            await page.add_style_tag(content="*{animation:none!important;transition:none!important}")
            for screen in ("cpu", "shop", "heroes"):
                await page.evaluate(f"game.go('{screen}')")
                await page.wait_for_timeout(2500)
                if screen == "cpu" and a.hero:
                    # open the hero's own card, where its four spells show large
                    await page.evaluate("""(hero) => { const b = [...document.querySelectorAll('button.pick')].find((e) => (e.title || '').startsWith(hero + ',')); if (b) { b.click(); (document.querySelector('.hs-show') || b).scrollIntoView(); } }""", a.hero)
                    await page.wait_for_timeout(2000)
                    await page.screenshot(path=str(out / f"{screen}-{a.hero.lower()}-{name}.jpg"), type="jpeg", quality=85)
                    await page.evaluate("game.go('cpu')")
                    await page.wait_for_timeout(2000)
                await page.screenshot(path=str(out / f"{screen}-{name}.jpg"), type="jpeg", quality=85, full_page=False)
            bad = [i for i in icons if i[0] >= 400]
            print(f"{name}: {len(icons)} icon files asked for, {len(bad)} failed {bad[:4]}; {len(errors)} console errors")
            for e in errors[:6]:
                print("   ", e[:240])
            await ctx.close()
        await browser.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--port", type=int, default=5264)
    ap.add_argument("--hero", default="")
    asyncio.run(run(ap.parse_args()))
