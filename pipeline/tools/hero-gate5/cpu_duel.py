"""A CPU duel on the game page through its own menus, at desktop and phone size (touch): pick the hero in the grid, fight,
rematch, leave; then the hero as the CPU's. Written for Anka (hero 40): the names below are hers, and the record counts her
rises. Screenshots and a record as JSON go to pipeline/sim/out/gate5/.

    python pipeline/tools/hero-gate5/cpu_duel.py            both sizes
    python pipeline/tools/hero-gate5/cpu_duel.py phone
"""
import asyncio
import json
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright

from srv import ARGS, OUT, PORT, Server

HERE = Path(__file__).parent
DRIVE = (HERE / "drive.js").read_text(encoding="utf-8")
NOANIM = "*{animation:none!important}"


async def state(page):
    return await page.evaluate("_drvState()")


async def wait_for(page, js, seconds, what):
    end = time.time() + seconds
    while time.time() < end:
        if await page.evaluate(js):
            return True
        await asyncio.sleep(0.25)
    raise RuntimeError(f"timed out after {seconds} s waiting for: {what}")


async def press(page, phone, locator):
    if phone:
        await locator.tap()
    else:
        await locator.click()


async def shot(page, name):
    path = OUT / f"anka-gate5-{name}.jpg"
    await page.screenshot(path=str(path), type="jpeg", quality=82)
    print("saved", path, flush=True)


async def to_cpu_screen(page, phone):
    """From wherever the page opened to the Play screen in its CPU mode."""
    door = page.locator("button.door", has_text="Duel the CPU")
    if await door.count():
        await press(page, phone, door.first)
    await page.wait_for_selector(".picker button.pick", timeout=20000)
    tab = page.locator("button.mode", has_text="CPU duel")
    if await tab.count() and "on" not in (await tab.first.get_attribute("class") or ""):
        await press(page, phone, tab.first)
    await page.wait_for_selector("select.foe-select", timeout=10000)


async def pick(page, phone, hero, foe):
    b = page.locator(f'.picker button.pick[title^="{hero},"]')
    await b.scroll_into_view_if_needed()
    await press(page, phone, b)
    await page.wait_for_selector(f'.picker button.pick.on[title^="{hero},"]', timeout=5000)
    await page.select_option("select.foe-select", value=foe)
    await asyncio.sleep(0.3)


async def start_fight(page, phone):
    await press(page, phone, page.locator("button.hs-find"))
    await wait_for(page, "(() => { const s = _drvState(); return s.on && !s.waiting && !(s.countdown > 0) && !s.locked && s.time > 0.2; })()", 90, "the fight to start")


async def real_inputs(page, phone, rec):
    """A few casts through the page's own controls, before the driver takes over."""
    if phone:
        # Tap the Q slot: it casts at the nearest enemy.
        box = await page.evaluate("(() => { const r = game.api.heroMode.slotEls[0].box.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width, r.height]; })()")
        rec["qSlot"] = [round(v) for v in box]
        await page.touchscreen.tap(box[0], box[1])
    else:
        size = page.viewport_size
        await page.mouse.move(size["width"] / 2, size["height"] * 0.35)
        await page.keyboard.press("q")
        await asyncio.sleep(0.15)
        await page.mouse.click(size["width"] / 2, size["height"] * 0.35)
    await asyncio.sleep(0.8)
    rec["realCast"] = await page.evaluate("(() => { const hm = game.api.heroMode; return { qReady: hm.ready(0), embers: _drvState().embers }; })()")


async def fight_to_end(page, mode, seconds=170, on_ash=None):
    await page.evaluate(f"_drv.mode = '{mode}'")
    end = time.time() + seconds
    shot_ash = False
    while time.time() < end:
        s = await state(page)
        if s["over"]:
            await page.evaluate("_drv.mode = 'off'")
            return s
        if on_ash and not shot_ash and (s["ash"] or s["foeAsh"]):
            shot_ash = True
            await on_ash()
        await asyncio.sleep(0.2)
    raise RuntimeError(f"the fight did not end within {seconds} s: {await state(page)}")


async def session(pw, name, w, h, phone):
    rec = {"size": f"{w}x{h}", "phone": phone, "console": [], "steps": []}
    browser = await pw.chromium.launch(channel="chrome", headless=True, args=ARGS)
    ctx = await browser.new_context(viewport={"width": w, "height": h}, is_mobile=phone, has_touch=phone, device_scale_factor=2 if phone else 1)
    page = await ctx.new_page()
    page.on("console", lambda m: rec["console"].append(m.text[:300]) if m.type == "error" else None)
    page.on("pageerror", lambda e: rec["console"].append("PAGEERROR " + str(e)[:300]))
    page.on("dialog", lambda dlg: asyncio.ensure_future(dlg.accept()))
    try:
        await page.goto(f"http://localhost:{PORT}/game", wait_until="load", timeout=120000)
        await page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=120000)
        await page.add_style_tag(content=NOANIM)
        await page.evaluate(DRIVE)
        rec["touchLayout"] = await page.evaluate("matchMedia('(pointer: coarse)').matches")
        rec["heroes"] = await page.evaluate("game.api.kits.length")

        # 1. Anka as my hero, against Kaia.
        await to_cpu_screen(page, phone)
        await pick(page, phone, "Anka", "Kaia")
        rec["gridCount"] = await page.locator(".picker button.pick").count()
        rec["rosterHead"] = await page.locator(".hs-roster-head").inner_text()
        rec["showName"] = await page.locator(".hs-name").inner_text()
        await asyncio.sleep(1.5)
        await page.locator('.picker button.pick[title^="Anka,"]').scroll_into_view_if_needed()
        await shot(page, f"grid-{name}")
        if phone:
            await page.evaluate("window.scrollTo(0, 0)")
            await asyncio.sleep(0.5)
            await shot(page, f"hero-{name}")
        await start_fight(page, phone)
        await real_inputs(page, phone, rec)
        await page.evaluate("_drv.mode = 'all'")
        await asyncio.sleep(5)
        await shot(page, f"fight-{name}")
        s = await fight_to_end(page, "all")
        rec["steps"].append({"fight": "Anka (me) v Kaia", "end": s, "drv": await page.evaluate("JSON.parse(JSON.stringify(_drv))")})
        await asyncio.sleep(1.2)
        await shot(page, f"result-{name}")

        # 2. Rematch through the card's button. This time she only lays embers and stands: the CPU fells her with a nest burning.
        await press(page, phone, page.get_by_role("button", name="Rematch"))
        await wait_for(page, "(() => { const s = _drvState(); return s.on && !s.over && !s.waiting && !(s.countdown > 0) && !s.locked && s.time > 0.2 && s.time < 10; })()", 90, "the rematch to start")
        before = await page.evaluate("JSON.parse(JSON.stringify(_drv))")

        async def ash_shot():
            await shot(page, f"rise-{name}")
        s = await fight_to_end(page, "quills", on_ash=ash_shot)
        after = await page.evaluate("JSON.parse(JSON.stringify(_drv))")
        rec["steps"].append({"fight": "rematch: Anka (me, quills only) v Kaia", "end": s, "rises": after["rises"] - before["rises"], "riseHp": after["riseHp"], "drv": after})
        await asyncio.sleep(1.0)
        await press(page, phone, page.get_by_role("button", name="Leave duel"))
        await page.wait_for_selector("button.hs-find", timeout=20000)

        # 3. Anka as the CPU's hero, against my Kaia.
        await pick(page, phone, "Kaia", "Anka")
        rec["barNote"] = await page.locator(".hs-note").first.inner_text()
        await start_fight(page, phone)
        await page.evaluate("_drv.mode = 'all'")
        await asyncio.sleep(6)
        await shot(page, f"foe-{name}")
        before = await page.evaluate("JSON.parse(JSON.stringify(_drv))")

        async def foe_ash_shot():
            await shot(page, f"foe-rise-{name}")
        s = await fight_to_end(page, "all", on_ash=foe_ash_shot)
        after = await page.evaluate("JSON.parse(JSON.stringify(_drv))")
        rec["steps"].append({"fight": "Kaia (me) v Anka (CPU)", "end": s, "foeRises": after["foeRises"] - before["foeRises"], "drv": after})
        await asyncio.sleep(1.0)
        await press(page, phone, page.get_by_role("button", name="Leave duel"))
        await page.wait_for_selector("button.hs-find", timeout=20000)
        rec["pageErrors"] = await page.evaluate("_drv.errors")
        rec["ok"] = True
    except Exception as e:
        rec["ok"] = False
        rec["failed"] = repr(e)[:600]
        try:
            await page.screenshot(path=str(OUT / f"fail-{name}.jpg"), type="jpeg", quality=70)
            rec["pageErrors"] = await page.evaluate("typeof _drv !== 'undefined' ? _drv.errors : []")
            rec["stateAtFail"] = await state(page)
        except Exception:
            pass
    await browser.close()
    return rec


async def main():
    which = sys.argv[1:] or ["desktop", "phone"]
    sizes = {"desktop": (1280, 800, False), "phone": (390, 844, True)}
    out = {}
    with Server():
        async with async_playwright() as pw:
            for name in which:
                w, h, phone = sizes[name]
                out[name] = await asyncio.wait_for(session(pw, name, w, h, phone), timeout=560)
                (OUT / f"cpu-duel-{name}.json").write_text(json.dumps(out[name], indent=1), encoding="utf-8")
                print(name, "ok" if out[name].get("ok") else "FAILED", out[name].get("failed", ""), flush=True)


asyncio.run(main())
