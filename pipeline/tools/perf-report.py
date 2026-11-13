"""
Writes docs/perf/performance.html from the performance tool's result files (docs/perf/data/): before and after for every
scene and for loading, what was changed, the quality levels side by side, and what is still slow.

    python pipeline/tools/perf-report.py

It reads: baseline.json, after.json (the game as it is, at High) and after-auto.json (at Auto) from `perf.py scenes`;
after-medium.json and after-low.json if they are there; baseline-load.json, after-load.json and after-auto-load.json
from `perf.py load`; step-*.json (the game at the commits in between) for what each change bought. The text of the page
(what was changed, what is still slow) is in this file: change it here when the game changes. The pictures it shows are
in docs/perf/img/, beside the page. Needs `pip install pillow` for the cut-outs of the quality levels.
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "perf"
DATA = OUT / "data"
IMG = OUT / "img"

SCENES = [
    ("menu", "The Play screen", "The menu with the hero turning on its stand. Nothing of the fight shows here."),
    ("duel-temple", "Duel in the Night Temple", "Lyra against Oblivion, the computer playing both, with the arena's rays and breaking walls."),
    ("duel-harbour", "Duel in the Harbour", "Anka against Isolde in one of the four arenas in the heroes' style."),
    ("raid-solo", "The Sun Warden, alone", "Kaia against the Raid's first boss in his hall."),
    ("raid-party", "The Sun Warden, a party of ten", "Kaia and nine partners that walk, attack and cast, in the Hall of Noon (the room for ten)."),
    ("tower-horde", "The Tower, a horde floor", "Kaia against a floor of keepers, begun again each time it is cleared."),
]
PROFILES = [
    ("desktop", "Desktop, full HD", "1920 x 1080, the processor at its own speed"),
    ("desktop-4x", "Slower laptop", "1920 x 1080, the processor slowed 4 times"),
    ("phone", "Phone screen, fast processor", "844 x 390 at 3 pixels a point (drawn at 1688 x 780), the processor at its own speed"),
    ("phone-4x", "Mid-range phone", "the phone screen, the processor slowed 4 times"),
    ("phone-6x", "Slow phone", "the phone screen, the processor slowed 6 times"),
]


def load(name):
    f = DATA / f"{name}.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else None


def rows(data):
    return {(r["profile"], r["id"]): r for r in (data or {}).get("runs", []) if not r.get("crashed")}


def fps(ms):
    return 1000 / ms if ms else 0


def e(s):
    return html.escape(str(s))


def bar(ms, worst, cls):
    w = max(2, min(100, 100 * ms / worst)) if worst else 0
    return f'<div class="bar {cls}" style="width:{w:.1f}%"></div>'


def rate(ms):
    """Frames a second as words: nothing draws faster than a screen shows."""
    return "over 120 a second" if fps(ms) > 120 else f"{fps(ms):.0f} a second"


def cell(r, worst, cls):
    if not r:
        return '<td class="num muted">not run</td>'
    ms = r["frame"]["median"]
    return (f'<td class="num"><b>{ms:.1f} ms</b> <span class="fps">{rate(ms)}</span>{bar(ms, worst, cls)}'
            f'<span class="sub">worst 1%: {r["frame"]["p99"]:.0f} ms · longest: {r["frame"]["max"]:.0f} ms</span></td>')


def line_svg(series, height=120, width=900, cap=None):
    """Frame times over the scene as lines: [(label, class, [tenths of ms])]."""
    top = cap or max(max(s[2]) for s in series) / 10
    top = max(top, 20)
    out = [f'<svg viewBox="0 0 {width} {height}" class="line" preserveAspectRatio="none" role="img" aria-label="Frame times over the scene">']
    for ms in (16.7, 33.3, 50):
        if ms < top:
            y = height - height * ms / top
            out.append(f'<line x1="0" x2="{width}" y1="{y:.1f}" y2="{y:.1f}" class="grid"/><text x="4" y="{y - 3:.1f}" class="gl">{ms:.0f} ms</text>')
    for label, cls, data in series:
        n = len(data)
        step = max(1, n // 450)
        pts = []
        for i in range(0, n, step):
            v = max(data[i:i + step]) / 10
            pts.append(f"{width * i / n:.1f},{height - height * min(v, top) / top:.1f}")
        out.append(f'<polyline class="{cls}" points="{" ".join(pts)}"/>')
    out.append("</svg>")
    return "".join(out)


def crops():
    """Cut-outs of the same frame at each quality level, at the screen's own size, for the side-by-side."""
    try:
        from PIL import Image
    except ImportError:
        return []
    out = []
    for level in ("high", "medium", "low", "auto"):
        src = IMG / f"quality-{level}-desktop-duel-temple.jpg"
        if not src.exists():
            continue
        im = Image.open(src)
        w, h = im.size
        box = (int(w * 0.36), int(h * 0.28), int(w * 0.36) + 520, int(h * 0.28) + 360)
        dst = IMG / f"quality-{level}-crop.jpg"
        im.crop(box).save(dst, quality=92)
        out.append((level, src.name, dst.name))
    return out


CSS = """
:root { --bg:#0e0d12; --card:#17151d; --line:#2a2733; --text:#ece6da; --muted:#9a93a6; --gold:#e6bd62; --before:#b5564e; --after:#5aa87c; --auto:#5a8fd0; }
@media (prefers-color-scheme: light) { :root { --bg:#f6f3ec; --card:#fff; --line:#ddd6c8; --text:#221d17; --muted:#6d6558; --gold:#9a6d14; --before:#b5564e; --after:#2f8a58; --auto:#2f6fb8; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:15px/1.55 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
main { max-width: 1080px; margin: 0 auto; padding: 20px 16px 60px; }
h1 { font-size: 28px; margin: 8px 0 4px; color: var(--gold); }
h2 { font-size: 21px; margin: 38px 0 8px; color: var(--gold); border-bottom:1px solid var(--line); padding-bottom:6px; }
h3 { font-size: 16px; margin: 22px 0 6px; }
p { margin: 8px 0; } .muted { color: var(--muted); } .small { font-size: 13px; }
.tiles { display:grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap:12px; margin:16px 0; }
.tile { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 14px; }
.tile .k { color:var(--muted); font-size:13px; } .tile .v { font-size:22px; font-weight:700; margin:2px 0; } .tile .v small { font-size:13px; font-weight:500; color:var(--muted); }
.scroll { overflow-x:auto; } table { border-collapse:collapse; width:100%; min-width:640px; margin:8px 0; background:var(--card); border:1px solid var(--line); border-radius:8px; }
th, td { padding:7px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; } th { font-size:13px; color:var(--muted); font-weight:600; }
td.num { white-space:nowrap; } .fps { color:var(--muted); font-size:13px; margin-left:4px; } .sub { display:block; color:var(--muted); font-size:12px; }
.bar { height:6px; border-radius:3px; margin:4px 0 2px; } .bar.before { background:var(--before); } .bar.after { background:var(--after); } .bar.auto { background:var(--auto); }
.key i { display:inline-block; width:12px; height:12px; border-radius:3px; margin:0 5px 0 12px; vertical-align:-1px; } .key .before { background:var(--before); } .key .after { background:var(--after); } .key .auto { background:var(--auto); }
img { max-width:100%; height:auto; border-radius:8px; border:1px solid var(--line); display:block; }
.pair { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:10px; margin:10px 0; } figure { margin:0; } figcaption { font-size:13px; color:var(--muted); margin-top:4px; }
svg.line { width:100%; height:120px; background:var(--card); border:1px solid var(--line); border-radius:8px; display:block; }
svg .grid { stroke:var(--line); stroke-width:1; } svg .gl { fill:var(--muted); font-size:10px; }
svg polyline { fill:none; stroke-width:1.2; vector-effect:non-scaling-stroke; } svg .before { stroke:var(--before); } svg .after { stroke:var(--after); } svg .auto { stroke:var(--auto); }
ul { padding-left: 20px; margin: 6px 0; } li { margin: 5px 0; } code { background:var(--card); border:1px solid var(--line); border-radius:4px; padding:1px 5px; font-size:13px; }
.note { background:var(--card); border-left:3px solid var(--gold); padding:10px 14px; border-radius:0 8px 8px 0; margin:12px 0; }
"""


def main():
    base, after, auto = load("baseline"), load("after"), load("after-auto")
    b, a, o = rows(base), rows(after), rows(auto)
    med, low = rows(load("after-medium")), rows(load("after-low"))
    lb, la, lo = load("baseline-load"), load("after-load"), load("after-auto-load")
    out = []
    w = out.append
    gpu = (base or after or {}).get("gpu", "this computer's graphics card")
    w(f"<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>"
      f"<title>Arena of Kits: how smoothly it runs</title><style>{CSS}</style></head><body><main>")
    w("<h1>Arena of Kits: how smoothly it runs</h1>")
    w(f"<p class='muted'>Measured {e((after or {}).get('when', ''))[:10]} on the code at commit {e((after or {}).get('commit', ''))}, against the game as it is live "
      f"(a frozen copy at {e((base or {}).get('commit', ''))}). Graphics card: {e(gpu)}.</p>")

    # --- the short answer ---
    def pick(table, prof, scene):
        r = table.get((prof, scene))
        return r["frame"]["median"] if r else None
    tiles = []
    for prof, scene, label in (("desktop", "duel-temple", "A duel, desktop"), ("phone-4x", "duel-temple", "A duel, mid-range phone"), ("desktop", "raid-party", "Raid of ten, desktop"), ("phone-4x", "raid-party", "Raid of ten, mid-range phone")):
        x, y, z = pick(b, prof, scene), pick(a, prof, scene), pick(o, prof, scene)
        if x and y:
            tiles.append(f"<div class='tile'><div class='k'>{label}</div><div class='v'>{fps(x):.0f} → {fps(y):.0f}{f' → {fps(z):.0f}' if z else ''} <small>frames a second</small></div>"
                         f"<div class='k'>before → now{' → now with Auto' if z else ''}</div></div>")
    if lb and la:
        x, y = lb["runs"][0], la["runs"][0]
        tiles.append(f"<div class='tile'><div class='k'>Menu on screen, desktop</div><div class='v'>{x['firstFrameMs'] / 1000:.1f} → {y['firstFrameMs'] / 1000:.1f} <small>seconds</small></div><div class='k'>before → now</div></div>")
        tiles.append(f"<div class='tile'><div class='k'>Stutters in a fight's first 20 s</div><div class='v'>{x['fight']['over50']} → {y['fight']['over50']}{f' → ' + str(lo['runs'][0]['fight']['over50']) if lo else ''} <small>frames over 50 ms</small></div><div class='k'>before → now{' → now with Auto' if lo else ''}</div></div>")
    w("<div class='tiles'>" + "".join(tiles) + "</div>")
    w("<div class='note'><b>In short.</b> The game was held back by drawing, not by its rules: every pixel of floor was shaded two or three times, the menu drew a 3D scene nobody could see, "
      "and every shader was compiled twice, the second time with the game frozen. Those are fixed with the picture unchanged. On top of that there is now a Graphics setting; "
      "its Auto level fits the sharpness to the device and holds 60 frames a second where the fixes alone do not. <b>High, the look as it was, is still the default</b>: "
      "the pictures of each level are below, for you to say whether Auto should be the start.</div>")

    # --- how it was measured ---
    w("<h2>How this was measured</h2>")
    w("<p>A tool (<code>pipeline/tools/perf.py</code>) plays six fixed scenes of the real game in a browser, with the real graphics card, and times every frame of 25 seconds of each: "
      "the game's own step, the drawing, and the wait until the card has really finished the frame. Each scene is the same fight every time (the clock and the dice are the tool's), "
      "so before and after can be laid side by side. A frame must take under 16.7 ms for 60 frames a second, under 33 ms for 30. "
      "On a real screen a frame that misses one refresh waits for the next: a game at 24 ms a frame shows as 30 a second half the time, so the step from 24 to under 16.7 is the one that is felt.</p>")
    w("<ul><li><b>Before</b> is the game as it is live, measured again today from a frozen copy of that code, on the same computer.</li>"
      "<li><b>Desktop</b>: 1920 x 1080. <b>Phone screen</b>: 844 x 390 points at 3 pixels a point, with touch. The slowed rows use Chrome's own processor throttle (4 and 6 times).</li>"
      "<li>The graphics card is this computer's Intel UHD 630, an ordinary laptop's. It stands in for a phone's card too: <b>no real phone was measured.</b></li>"
      "<li>The scene tables come from a browser without a window, which is fair for frame times but compiles shaders late: for stutters read the Loading section, taken in a visible browser.</li>"
      "<li>On the slowed rows the browser overlaps the processor's work with the card's, as a real one does; on the unslowed rows the two are added. So compare before with after along a row, not one row with another.</li></ul>")
    w("<p class='key small'>In the tables: <i class='before'></i>before <i class='after'></i>now, at High (the same picture) <i class='auto'></i>now, at Auto</p>")

    # --- scenes ---
    w("<h2>Every scene, before and after</h2>")
    for sid, title, what in SCENES:
        w(f"<h3>{e(title)}</h3><p class='muted small'>{e(what)}</p>")
        pic = IMG / f"after-desktop-{sid}.jpg"
        if pic.exists():
            w(f"<img src='img/{pic.name}' alt='{e(title)}, as the tool saw it' loading='lazy'>")
        w("<div class='scroll'><table><tr><th>Device</th><th>Before</th><th>Now (High)</th><th>Now (Auto)</th></tr>")
        for pid, pname, pwhat in PROFILES:
            trio = [t.get((pid, sid)) for t in (b, a, o)]
            if not any(trio):
                continue
            worst = max(r["frame"]["median"] for r in trio if r)
            w(f"<tr><td><b>{e(pname)}</b><span class='sub'>{e(pwhat)}</span></td>{cell(trio[0], worst, 'before')}{cell(trio[1], worst, 'after')}{cell(trio[2], worst, 'auto')}</tr>")
        w("</table></div>")
        x, y, z = b.get(("desktop", sid)), a.get(("desktop", sid)), o.get(("desktop", sid))
        if x and y:
            series = [("before", "before", x["line"]), ("now", "after", y["line"])] + ([("auto", "auto", z["line"])] if z else [])
            w("<p class='muted small'>Every frame of the scene on the desktop, left to right; a spike is a stutter.</p>")
            w(line_svg(series, cap=min(120, max(60, x["frame"]["p99"] * 1.4))))
            w("<div class='scroll'><table><tr><th>On the desktop</th><th>Before</th><th>Now</th></tr>")
            for label, fn in (
                ("Draw calls a frame (every canvas, every pass)", lambda r: f"{r['glDraws']['median']}"),
                ("Triangles a frame", lambda r: f"{r['triangles']['median']:,}"),
                ("Particles at the most", lambda r: f"{r['particles']['max']:,}"),
                ("Garbage made, MB a second", lambda r: f"{r['allocMBs']:.1f}"),
                ("Script each frame (step + draw calls), ms", lambda r: f"{r['step']['median'] + r['draw']['median']:.1f}"),
                ("Wait for the graphics card each frame, ms", lambda r: f"{r['gpu']['median']:.1f}"),
                ("Shaders built in the middle of the scene", lambda r: f"{r.get('compiledShaders', '?')}"),
                ("Frames over 33 ms / over 50 ms", lambda r: f"{r['over33']} / {r['over50']} of {r['frames']}"),
                ("Textures / geometries alive at the end", lambda r: f"{r['textures']} / {r['geometries']}"),
                ("Memory in use at the end, MB", lambda r: f"{r['heapMB']:.0f}"),
            ):
                w(f"<tr><td>{label}</td><td class='num'>{fn(x)}</td><td class='num'>{fn(y)}</td></tr>")
            w("</table></div>")

    # --- loading ---
    if lb and la:
        w("<h2>Loading</h2>")
        w("<p>The built game, served as the live site serves it (scripts compressed, models as they are), in a visible browser with nothing cached. "
          "Then the first fight (a duel in the Night Temple) and its first 20 seconds in real time.</p>")
        w("<div class='scroll'><table><tr><th></th><th>Before</th><th>Now (High)</th>" + ("<th>Now (Auto)</th>" if lo else "") + "</tr>")
        for i, (pid, pname) in enumerate((("desktop", "Desktop"), ("phone-4x", "Mid-range phone"))):
            sets = [d["runs"][i] if d and len(d["runs"]) > i else None for d in (lb, la, lo)]
            if not lo:
                sets = sets[:2]

            def line(label, fn):
                w(f"<tr><td>{pname}: {label}</td>" + "".join(f"<td class='num'>{fn(s) if s else ''}</td>" for s in sets) + "</tr>")
            line("menu on screen after", lambda s: f"{s['firstFrameMs'] / 1000:.1f} s")
            line("page frozen while it starts", lambda s: f"{s['menu']['blockedMs'] / 1000:.1f} s")
            line("downloaded for the menu", lambda s: f"{s['menu']['bytes'] / 1e6:.2f} MB in {s['menu']['requests']} files")
            line("first fight ready after", lambda s: f"{s['fight']['toCountdownMs'] / 1000:.1f} s")
            line("downloaded for the first fight", lambda s: f"{s['fight']['bytes'] / 1e6:.2f} MB more")
            line("the fight's first 20 s: a frame takes", lambda s: f"{s['fight']['medianMs']:.0f} ms ({fps(s['fight']['medianMs']):.0f} a second)")
            line("... frames over 50 ms", lambda s: f"{s['fight']['over50']}")
            line("... the longest frame", lambda s: f"{s['fight']['longestMs']:.0f} ms")
        w("</table></div>")
        w("<p class='muted small'>The menu now also fetches the heroes' animation clips (1.3 MB) once it is idle, so they are counted under the menu instead of under the first fight; the total is the same. "
          "The phone row's time to the first fight under Auto is longer than a real phone's would be: Auto times the scene, and Chrome's throttle stretches exactly that wait.</p>")
        files = la.get("files", {})
        w("<h3>What the game is made of</h3><div class='scroll'><table><tr><th>File</th><th>Size</th><th>Compressed (as sent)</th></tr>")
        for c in files.get("chunks", []):
            w(f"<tr><td><code>{e(c['file'])}</code></td><td class='num'>{c['bytes'] / 1e6:.2f} MB</td><td class='num'>{c['gzip'] / 1e6:.2f} MB</td></tr>")
        w("</table></div><div class='scroll'><table><tr><th>Models</th><th>Files the game uses</th><th>Their size</th><th>The largest</th></tr>")
        names = {"heroes": "Heroes (one file each)", "arenas": "Arenas and boss rooms", "bosses": "Bosses", "anim": "Animation clips", "weapons": "Weapons (the VFX tool's)", "figures": "Older figures"}
        for k, v in files.get("models", {}).items():
            big = ", ".join(f"{n} {s / 1e6:.2f} MB" for n, s in v["largest"][:2])
            w(f"<tr><td>{names.get(k, k)}</td><td class='num'>{v['used']}</td><td class='num'>{v['usedBytes'] / 1e6:.1f} MB</td><td>{e(big)}</td></tr>")
        w("</table></div><p class='muted small'>A fight downloads two heroes (about 0.5 MB each), its arena (0.5 to 1.3 MB) and, once, the clips. Nothing here was changed: see what is still slow.</p>")

    # --- numbers the text below quotes ---
    def ms(table, prof, scene):
        r = table.get((prof, scene))
        return f"{r['frame']['median']:.0f}" if r else "?"

    def field(table, prof, scene, fn):
        r = table.get((prof, scene))
        return fn(r) if r else "?"
    script = lambda r: f"{r['step']['median'] + r['draw']['median']:.1f}"
    garbage = lambda r: f"{r['allocMBs']:.0f}"
    fights = [sid for sid, _, _ in SCENES if sid != "menu"]
    now_ms = sorted(a[("desktop", sid)]["frame"]["median"] for sid in fights if ("desktop", sid) in a)
    was_ms = sorted(b[("desktop", sid)]["frame"]["median"] for sid in fights if ("desktop", sid) in b)
    auto_px = o.get(("desktop", "duel-temple"), {}).get("canvas", [0, 0])
    l0, l1 = (lb["runs"][0], la["runs"][0]) if lb and la else (None, None)

    # --- what was changed ---
    w("<h2>What was changed, and what each change bought</h2>")
    steps = [(name, rows(load(name))) for name in ("step-a", "step-b")]
    if all(s[1] for s in steps):
        w("<p>The same scenes on the desktop at each stage of the work (ms a frame):</p><div class='scroll'><table><tr><th>Scene</th><th>Before</th><th>After the drawing fixes</th><th>After the processor fixes</th><th>Now</th></tr>")
        for sid, title, _ in SCENES:
            vals = [t.get(("desktop", sid)) for t in (b, steps[0][1], steps[1][1], a)]
            if not all(vals):
                continue
            w(f"<tr><td>{e(title)}</td>" + "".join(f"<td class='num'>{v['frame']['median']:.1f}</td>" for v in vals) + "</tr>")
        w("</table></div>")
    w(f"""<h3>Drawing (the graphics card)</h3><ul>
<li><b>Floors are no longer shaded two or three times.</b> The engine drew solid things in the order their materials were made: the ground first, then every floor laid over it. Each pixel of floor was shaded for each layer, and a lit, textured floor that fills the screen is the dearest thing in the picture. Now the big surfaces are drawn last, the highest first, and what lies under another is skipped. <i>Night Temple duel {ms(b, 'desktop', 'duel-temple')} → {ms(a, 'desktop', 'duel-temple')} ms, Tower floor {ms(b, 'desktop', 'tower-horde')} → {ms(a, 'desktop', 'tower-horde')} ms, Sun Warden {ms(b, 'desktop', 'raid-solo')} → {ms(a, 'desktop', 'raid-solo')} ms on the desktop, nearly all of it from this; the picture is the same.</i></li>
<li><b>The menu no longer draws the fight's scene.</b> The menus cover the whole canvas, but the 3D scene behind them was drawn through the whole post chain every frame. <i>Play screen {ms(b, 'desktop', 'menu')} → {ms(a, 'desktop', 'menu')} ms.</i></li>
<li><b>Three full-screen passes fewer</b>: no multisampled canvas (the last pass is one quad), no copy pass when nothing bends the picture, tone mapping folded into the finish pass. <i>About 2 ms a frame at full HD.</i></li>
</ul><h3>Stutters</h3><ul>
<li><b>The shader warm-up really warms up.</b> It compiled shaders for drawing straight to the canvas, but the game draws into the post chain's own target, which is a different shader: each was built again the first time it was drawn. And the engine quietly swapped its shadow type at the first shadow, which changed the identity of every shader once more. Both are fixed; the warm-up also builds both heroes' spell effects before the fight. <i>The page stood still waiting for shaders for 1.3 s before the menu and 1.6 s behind the first loading page; now not at all before the menu and 0.35 s behind the loading page. In the fight's first 20 seconds: frames over 50 ms {l0['fight']['over50'] if l0 else '?'} → {l1['fight']['over50'] if l1 else '?'}, the longest {l0['fight']['longestMs'] if l0 else 0:.0f} → {l1['fight']['longestMs'] if l1 else 0:.0f} ms.</i></li>
<li><b>The post chain's and the reflections' shaders compile in the background</b> from the moment the page opens, and nothing is drawn behind the loading page until they are done.</li>
<li><b>A built shader is kept.</b> The engine deleted a shader when the last thing using it went (a damage number, a bolt) and built it again the next time.</li>
</ul><h3>The processor</h3><ul>
<li><b>No garbage from the cover and path checks.</b> The helpers that ask "how far is this point from that wall" made a small object and an array on every call, thousands of times a frame in a hall with much cover. Now none, with results the same to the last bit, so no hero walks a hair differently. <i>Raid of ten: garbage {field(b, 'desktop', 'raid-party', garbage)} → {field(a, 'desktop', 'raid-party', garbage)} MB a second; a duel {field(b, 'desktop', 'duel-temple', garbage)} → {field(a, 'desktop', 'duel-temple', garbage)}.</i></li>
<li><b>No shader looked up for nothing.</b> The distortion pass changed the set of lights the engine counted, which made it look every lit material's shader up again, twice a frame; a see-through two-sided glow was drawn in two goes and looked up twice as well. <i>Raid of ten: script {field(b, 'desktop', 'raid-party', script)} → {field(a, 'desktop', 'raid-party', script)} ms a frame on the desktop, which is four to six times that on a phone.</i></li>
<li><b>The scene's matrices once a frame</b>, not once for each of its draws; <b>hidden spell effects out of the scene</b> (a session kept every effect it ever built, and the engine walked all of them every frame).</li>
</ul><h3>Loading</h3><ul>
<li><b>The reflections and the Play screen's hero renderer are made when first needed</b>, not before the menu. <i>Menu on screen: {l0['firstFrameMs'] / 1000 if l0 else 0:.1f} → {l1['firstFrameMs'] / 1000 if l1 else 0:.1f} s on the desktop.</i></li>
<li><b>The heroes' clips are fetched while the menu is idle.</b></li>
</ul><h3>New: the Graphics setting</h3><ul>
<li><b>High</b> (the look as it was), <b>Medium</b>, <b>Low</b> and <b>Auto</b>, on a button at the top of the menu (on a phone with an account: on the Profile screen), kept in the browser. Only sharpness and the shadows under the figures change; spells, lights and glow are the same at every level.</li>
</ul>""")

    # --- quality ---
    w("<h2>The Graphics levels, side by side</h2>")
    w("<p>The same frame of the same fight at each level (desktop, full HD). <b>For you to decide:</b> High stays the default unless you say Auto should be. "
      "Auto is what makes the game hold 60 frames a second on a slow graphics card; it costs sharpness and nothing else.</p>")
    cut = crops()
    if cut:
        w("<div class='pair'>")
        for level, full, crop in cut:
            r = {"high": a, "medium": med, "low": low, "auto": o}[level].get(("desktop", "duel-temple"))
            cap = f"{level.capitalize()}: drawn at {r['canvas'][0]} x {r['canvas'][1]}, {r['frame']['median']:.1f} ms a frame ({fps(r['frame']['median']):.0f} a second)" if r else level.capitalize()
            w(f"<figure><a href='img/{full}'><img src='img/{crop}' alt='A cut-out of the fight at {level}' loading='lazy'></a><figcaption>{e(cap)} (cut-out at the screen's own size; tap for the whole picture)</figcaption></figure>")
        w("</div>")
    w("<div class='scroll'><table><tr><th>Scene</th><th>Device</th><th>High</th><th>Medium</th><th>Low</th><th>Auto</th></tr>")
    for sid, title, _ in SCENES:
        for pid, pname, _ in PROFILES:
            vals = [t.get((pid, sid)) for t in (a, med, low, o)]
            if not (vals[1] or vals[2]):
                continue
            w(f"<tr><td>{e(title)}</td><td>{e(pname)}</td>" + "".join(
                f"<td class='num'>{v['frame']['median']:.1f} ms<span class='sub'>{v['canvas'][0]} x {v['canvas'][1]}</span></td>" if v else "<td class='muted'>not run</td>" for v in vals) + "</tr>")
    w("</table></div>")
    w("<ul><li><b>Medium</b> draws at most 1.2 million pixels (full HD has 2.1) and softer shadows. <b>Low</b> draws at most 0.6 million and no shadows under the figures.</li>"
      "<li><b>Auto</b> times the real scene behind each loading page and draws as many pixels as fit in a 60th of a second, never fewer than Low; during the fight it follows the frame rate. "
      "Where the processor, not the card, is the limit (a big raid on a phone), fewer pixels do not help: there it leaves out the shadows, which are a second draw call for everything that casts one, "
      "and during the fight a cut in pixels that buys nothing is taken back, so the picture is not made soft for no gain.</li></ul>")

    # --- same picture ---
    same = [(n, IMG / f"cmp-base-desktop-{n}.jpg", IMG / f"cmp-new-desktop-{n}.jpg") for n in ("duel-temple", "tower-horde", "raid-solo")]
    same = [s for s in same if s[1].exists() and s[2].exists()]
    if same:
        w("<h2>The picture is the same, and so are the fights</h2>")
        w("<p>Each scene's fight is written down as it is played (health and places every second). With the spells built at the first cast as before, the changed game plays the very same fights as the live one, "
          "to the last number. The same frame before and after, pixel by pixel, differs only by the film grain (about 1 of 255 on average; no pixel far apart). "
          "The Raid's own rule checks pass unchanged (234, 77, 246, 40 and 143 rows), and the server's test. On the final code all 40 heroes were played once as the player and once as the opponent with no error, and the game's own ways into a fight were run as their buttons start them (a CPU duel, the Raid's hall, a Tower climb, and a raid of three through the real server).</p><div class='pair'>")
        for n, x, y in same[:2]:
            w(f"<figure><img src='img/{x.name}' alt='Before' loading='lazy'><figcaption>Before: {e(n)}</figcaption></figure><figure><img src='img/{y.name}' alt='After' loading='lazy'><figcaption>After: the same frame</figcaption></figure>")
        w("</div>")

    # --- still slow ---
    w(f"""<h2>What is still slow, and why</h2><ul>
<li><b>A big raid on a phone.</b> Ten heroes in the Hall of Noon are about 760 draw calls a frame, and a phone's processor needs most of a frame just to issue them (mid-range phone: {ms(b, 'phone-4x', 'raid-party')} → {ms(a, 'phone-4x', 'raid-party')} ms a frame at High, {ms(o, 'phone-4x', 'raid-party')} ms at Auto; that is still only about {fps(o[('phone-4x', 'raid-party')]['frame']['median']) if ('phone-4x', 'raid-party') in o else 0:.0f} frames a second). Half of them are the shadow pass drawing the hall's many small blocks a second time; Auto and Low leave those out. The rest are the heroes themselves (about ten separate pieces each) and the hall (about 120 pieces). To go further the hall's blocks would have to be drawn as a few batches instead of one by one, and a hero's pieces joined in Blender: a change to how arenas and heroes are built, not done here.</li>
<li><b>Lit surfaces are dear on an integrated card.</b> A floor that fills the screen costs about 7 ms at full HD, most of it the soft reflections every lit material takes from the sky. One layer of floor is the least there can be; the Night Temple still has two (a see-through ring floor over its apron). Fewer pixels (Medium, Low, Auto) is what helps here.</li>
<li><b>At High on integrated graphics a full-HD fight is {fps(now_ms[-1]):.0f} to {fps(now_ms[0]):.0f} frames a second</b>, not 60 ({now_ms[0]:.0f} to {now_ms[-1]:.0f} ms a frame; it was {fps(was_ms[-1]):.0f} to {fps(was_ms[0]):.0f}). Auto gets 60 there by drawing {auto_px[0]} x {auto_px[1]} instead of 1920 x 1080 and letting the browser stretch it.</li>
<li><b>The first cast of some spells still costs one long frame</b> (60 to 100 ms): what a spell makes at the moment it is cast (a bolt, a danger zone's shape) is not known before, so its shader is built then, once a session.</li>
<li><b>The Play screen's turning hero</b> has its own small renderer, and costs about 8 ms a frame on this card. Fine at 60, but it is the menu's whole cost.</li>
<li><b>Downloads were not made smaller.</b> The game's script is 5 MB (1.4 MB as sent) because every spell of every hero is in it; splitting it by hero would shorten the download on a slow line but not the start, which was measured to be shaders, not script. Models are sent uncompressed (a hero 0.5 MB, the clips 1.3 MB), and every file is asked for again on each visit (the server answers "unchanged" for each). Both are settings of the build and the deploy, left for a decision.</li>
<li><b>Garbage.</b> A duel still makes {field(a, 'desktop', 'duel-temple', garbage)} MB a second (from {field(b, 'desktop', 'duel-temple', garbage)}), a raid of ten {field(a, 'desktop', 'raid-party', garbage)} (from {field(b, 'desktop', 'raid-party', garbage)}): the rest is spread over many spells and the engine's own drawing.</li>
</ul>""")
    w("""<h2>What was not measured</h2><ul>
<li><b>A real phone</b>, and Safari on an iPhone: the phone rows are this computer with a phone-sized screen and a slowed processor. A phone's graphics card may be faster or slower than this one.</li>
<li><b>Online play</b>: a network duel or a raid through the server. The scenes are offline; the raid of ten has nine scripted partners on one screen.</li>
<li><b>A long session</b>: the scenes are 25 seconds. Memory that only grows over an hour would not show.</li>
<li><b>The Auto level's following of the frame rate during a fight</b> on real slow hardware: the choice before the fight is measured; the adjusting during it was tried on made-up devices (a slow card, a slow processor, a phone held to 30 a second, a heavy spell) and seen to work in a visible browser on this computer, no more.</li>
<li>Whether it <b>feels</b> smooth: that is for a person playing.</li>
</ul>""")
    w("""<h2>Running it again</h2><p>All of it is one tool, documented in <code>docs/pipeline/performance.md</code>:</p>
<ul><li><code>python pipeline/tools/perf.py scenes --label after</code>: every scene on every device (about 25 minutes).</li>
<li><code>python pipeline/tools/perf.py load --label after --headed</code>: loading and the first fight, after <code>npm run build</code>.</li>
<li><code>python pipeline/tools/perf.py parts | passes | profile | census | flips --scene raid-party</code>: where a scene's time goes.</li>
<li><code>python pipeline/tools/perf-report.py</code>: this page.</li></ul>""")
    w("</main></body></html>")
    (OUT / "performance.html").write_text("\n".join(out), encoding="utf-8")
    print(f"wrote {OUT / 'performance.html'} ({sum(len(x) for x in out) // 1024} KB)")


if __name__ == "__main__":
    main()
