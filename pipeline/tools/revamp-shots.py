"""
Pictures of the revamped heroes (docs/lore/codex/revamp.md) for docs/heroes/revamp/<hero>/: per hero its sheet, its
face, the line-up beside two others, its motion (pipeline/tools/revamp-shots.js) and one frame of a CPU duel on the game
page from the game's own camera. Run it once on the old models ("before") and once on the new ("after").

    python pipeline/tools/revamp-shots.py before --only prism,ledger --port 5263
    python pipeline/tools/revamp-shots.py before --only door,mirror --out docs/heroes/touch --port 5284

It needs a dev server on that port (`node node_modules/vite/bin/vite.js --port 5263 --strictPort`), `pip install
playwright` and Google Chrome. Errors in the page are printed per hero.
"""
import argparse
import base64
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "heroes" / "revamp"
# theme: (folder, hero name, the three shown beside it)
HEROES = {
    # the last one beside it is the hero it was most like (revamp.md's four groups)
    "prism": ("opaline", "Opaline", ["Sefu", "Kaia", "Silvane"]),
    "ledger": ("mr-ledger", "Mr. Ledger", ["Sefu", "Kaia", "Wick"]),
    "storm": ("kaia", "Kaia", ["Sefu", "Lyra", "Isolde"]),
    "forge": ("brannoc", "Brannoc", ["Sefu", "Kaia", "Bram"]),
    "timber": ("hank", "Hank", ["Sefu", "Kaia", "Bram"]),
    "yarn": ("grandma-ironknit", "Grandma Ironknit", ["Sefu", "Kaia", "Pip"]),
    # the sixteen touches (revamp.md, "The touches"; pictures to docs/heroes/touch with --out) and Big Yoko (his painted
    # underwear covered): beside Sefu, Kaia and the hero it was most like
    "door": ("wick", "Wick", ["Sefu", "Kaia", "Mr. Ledger"]),
    "mirror": ("silvane", "Silvane", ["Sefu", "Kaia", "Opaline"]),
    "mason": ("bram", "Bram", ["Sefu", "Kaia", "Brannoc"]),
    "chrono": ("tempo", "Tempo", ["Sefu", "Kaia", "Wick"]),
    "blood": ("vesper", "Vesper", ["Sefu", "Kaia", "Silvane"]),
    "clockwork": ("ada", "Ada", ["Sefu", "Kaia", "Bram"]),
    "referee": ("referee-whistler", "Referee Whistler", ["Sefu", "Kaia", "Bram"]),
    "chef": ("madame-cleaver", "Madame Cleaver", ["Sefu", "Kaia", "Bram"]),
    "weather": ("barry-cloudsley", "Barry Cloudsley", ["Sefu", "Kaia", "Zephyr"]),
    "sky": ("zephyr", "Zephyr", ["Sefu", "Kaia", "Barry Cloudsley"]),
    "tide": ("marin", "Marin", ["Sefu", "Kaia", "Isolde"]),
    "bard": ("cantor", "Cantor", ["Sefu", "Kaia", "Tempo"]),
    "courier": ("pip", "Pip", ["Sefu", "Kaia", "Grandma Ironknit"]),
    "ink": ("shiori", "Shiori", ["Sefu", "Kaia", "Lyra"]),
    "magic": ("the-great-zambini", "The Great Zambini", ["Sefu", "Kaia", "Wick"]),
    "phoenix": ("anka", "Anka", ["Sefu", "Kaia", "Auriel"]),
    "sumo": ("big-yoko", "Big Yoko", ["Sefu", "Kaia", "Auriel"]),
}

DUEL = """
async ({ hero, foe, seconds }) => {
  game.cpu.start({ hero, foe, level: 3 });
  const api = game.api, d = api.duel;
  const t0 = Date.now();
  while (!(d.on && d.heroRt && d.foe && !d.waiting && d.countdown < 0) && Date.now() - t0 < 90000) await new Promise((r) => setTimeout(r, 200));
  await new Promise((r) => setTimeout(r, 300));
  api.view.paused = true;
  let simMs = performance.now();
  performance.now = () => simMs;
  const st = document.createElement('style');
  st.textContent = '*{animation:none!important}';
  document.head.append(st);
  d.autopilot = true;
  for (let f = 0; f < 60 * seconds && !d.result; f++) { simMs += 1000 / 60; api.step(1 / 60); }
  api.render();
  // where the hero stands on the screen, for a close crop
  const g = d.host.arena.caster.group, p = g.getWorldPosition(new g.position.constructor());
  p.y += 1.3;
  p.project(d.host.arena.camera);
  return { time: +d.time.toFixed(2), over: !!d.result, x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
}
"""


def save(path, data_url):
    path.write_bytes(base64.b64decode(data_url.split(",", 1)[1]))
    print(f"  saved {path.relative_to(ROOT)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("prefix", help="before or after")
    ap.add_argument("--only", default="")
    ap.add_argument("--port", type=int, default=5263)
    ap.add_argument("--out", default=str(OUT), help="the folder of the hero folders (docs/heroes/touch for the touches)")
    ap.add_argument("--arena", default="temple", help="the CPU duel's arena, the same before and after")
    ap.add_argument("--duel-only", type=float, default=0, help="only a CPU duel of that many seconds, for the error check")
    args = ap.parse_args()
    script = (ROOT / "pipeline" / "tools" / "revamp-shots.js").read_text(encoding="utf-8")
    themes = [t for t in HEROES if not args.only or t in args.only.split(",")]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--ignore-gpu-blocklist"])
        for theme in themes:
            folder, hero, beside = HEROES[theme]
            out = Path(args.out).resolve() / folder
            out.mkdir(parents=True, exist_ok=True)
            print(theme, hero)
            for part in (("duel",) if args.duel_only else ("pictures", "duel")):
                page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=2)
                logs = []
                page.on("console", lambda m: logs.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: logs.append(str(e)))
                page.goto(f"http://localhost:{args.port}/game" + ("" if part == "pictures" else f"?arena={args.arena}"), wait_until="load", timeout=180000)
                page.wait_for_function("typeof game !== 'undefined' && !!game.api", timeout=180000)
                if part == "pictures":
                    page.evaluate("(rv) => { window._rv = rv; }", {"theme": theme, "beside": beside})
                    res = page.evaluate(f"(async () => {{\n{script}\n}})()")
                    if res.get("error"):
                        print("  ", res["error"])
                    for key, val in res.items():
                        if isinstance(val, str) and val.startswith("data:image/"):
                            save(out / f"{args.prefix}_{key}.jpg", val)
                else:
                    res = page.evaluate(DUEL, {"hero": hero, "foe": "Sefu", "seconds": args.duel_only or 4.5})
                    print("  duel", res)
                    if not args.duel_only:
                        page.wait_for_timeout(300)
                        page.screenshot(path=str(out / f"{args.prefix}_duel.jpg"), type="jpeg", quality=85, scale="css")
                        print(f"  saved {(out / (args.prefix + '_duel.jpg')).relative_to(ROOT)}")
                        x = max(0, min(1280 - 360, res["x"] - 180))
                        y = max(0, min(800 - 360, res["y"] - 200))
                        page.screenshot(path=str(out / f"{args.prefix}_duel_close.jpg"), type="jpeg", quality=90,
                                        clip={"x": x, "y": y, "width": 360, "height": 360})
                        print(f"  saved {(out / (args.prefix + '_duel_close.jpg')).relative_to(ROOT)}")
                if logs:
                    print(f"  {len(logs)} page errors:", [l[:200] for l in logs[:4]])
                page.close()
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
