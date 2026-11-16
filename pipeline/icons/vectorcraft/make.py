"""
The heroes' spell icons, drawn with VectorCraft (ArtCraft), one family for all 40 heroes.

    python pipeline/icons/vectorcraft/make.py                  # every hero: write each icon's command file and export it
    python pipeline/icons/vectorcraft/make.py bram             # one hero
    python pipeline/icons/vectorcraft/make.py bram q           # one icon
    python pipeline/icons/vectorcraft/make.py bram --json-only # only the command files
    python pipeline/icons/vectorcraft/make.py anka --sample    # the sample's two versions (A in the frame, B at 118%)

Each hero's drawing is its module `draw/<stem>.py` (its palette row in PAL and an ICONS dict of slot -> function); the
rules they all follow, the frame and the builder are in `vclib.py`. What remakes an icon is its command file,
`<stem>/<slot>.json`, a list of VectorCraft commands run headless:

    vectorcraft-cli run --commands <stem>/<slot>.json --export <out>.svg --export <out>.png --scale 2

The game's icon is version B (the user's pick, 2026-11-15): the picture scaled 118% about the centre, over the frame's
edge. Exports: the SVG, made a little smaller (no indents, a 128 px size and the 64 viewBox kept), to
`public/icons/spells/<stem>-<slot>.svg` (the game loads it: src/icons/vc.ts); the 128 px PNG to `docs/icons/new/` for the
pages. `--sample` writes the sample's A and B to docs/icons/sample/ (`<slot>-a.json`, `<slot>.json`).
VectorCraft is at VC (portable 0.24.1); set VECTORCRAFT_CLI to move it.
"""
import importlib
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import vclib  # noqa: E402
from vclib import B_SCALE, Icon  # noqa: E402

ROOT = HERE.parents[2]
GAME = ROOT / "public" / "icons" / "spells"
PNGS = ROOT / "docs" / "icons" / "new"
SAMPLE = ROOT / "docs" / "icons" / "sample"
VC = os.environ.get("VECTORCRAFT_CLI", r"C:\Users\erich\AppData\Local\Programs\ArtCraft\VectorCraft"
                    r"\vectorcraft-0.24.1-windows-x64-portable\vectorcraft-cli.exe")


def heroes():
    out = {}
    for f in sorted((HERE / "draw").glob("*.py")):
        if f.stem.startswith("_"):
            continue
        out[f.stem.replace("_", "-")] = importlib.import_module(f"draw.{f.stem}").ICONS
    return out


def build(stem, slot, draw, scale=True):
    ic = Icon(stem)
    ic.frame()
    m = ic.mark()
    draw(ic)
    if scale:
        # Version B: the picture 118% about the centre (Scale, with its strokes), over the frame's edge.
        g = ic.group(m)
        ic.add("object.scale", ids=[g], sx=B_SCALE, sy=B_SCALE, origin=[32, 32], strokes=True)
    return ic


def slim(svg_path):
    """The exported SVG without indents and its title, drawn at 128 px (its viewBox stays 64): a browser that rasterises
    an SVG image at its own size before drawing it into a canvas then does so at the size the game draws."""
    s = svg_path.read_text(encoding="utf-8")
    s = re.sub(r"\n\s*", "", s)
    s = re.sub(r"<title>.*?</title>", "", s)
    s = s.replace('width="64" height="64" viewBox="0 0 64 64"', 'width="128" height="128" viewBox="0 0 64 64"', 1)
    s = s.replace(' data-name="Layer 1"', "").replace(' id="Layer_1"', "")
    svg_path.write_text(s, encoding="utf-8")


def export(json_path, svg, png, tag):
    t = time.time()
    r = subprocess.run([VC, "run", "--commands", str(json_path), "--export", str(svg), "--export", str(png), "--scale", "2"],
                       capture_output=True, text=True, encoding="utf-8")
    lines = [json.loads(x) for x in r.stdout.splitlines() if x.startswith("{")]
    warn = [w for x in lines for w in (x.get("result") or {}).get("warnings", [])]
    bad = [x for x in lines if x.get("ok") is False or x.get("error")]
    if r.returncode != 0 or bad:
        return f"{tag}: VectorCraft failed\n{r.stderr.strip()[:2000]}\n{json.dumps(bad[:2])[:2000]}"
    return (f"{tag}: {len(lines) - 2} steps, {time.time() - t:.1f} s, svg {svg.stat().st_size} B, png {png.stat().st_size} B"
            + (f", warnings: {warn}" if warn else ""))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    only_json = "--json-only" in sys.argv
    sample = "--sample" in sys.argv
    GAME.mkdir(parents=True, exist_ok=True)
    PNGS.mkdir(parents=True, exist_ok=True)
    jobs = []
    for stem, slots in heroes().items():
        if args and stem != args[0]:
            continue
        folder = HERE / stem
        folder.mkdir(exist_ok=True)
        for slot, draw in slots.items():
            if len(args) > 1 and slot not in args[1:]:
                continue
            path = folder / f"{slot}.json"
            path.write_text(json.dumps(build(stem, slot, draw).steps, indent=1) + "\n", encoding="utf-8")
            if sample:
                a = folder / f"{slot}-a.json"
                a.write_text(json.dumps(build(stem, slot, draw, scale=False).steps, indent=1) + "\n", encoding="utf-8")
                jobs.append((a, SAMPLE / f"{stem}-{slot}.svg", SAMPLE / f"{stem}-{slot}.png", f"{stem} {slot} (A)", False))
                jobs.append((path, SAMPLE / f"{stem}-{slot}-b.svg", SAMPLE / f"{stem}-{slot}-b.png", f"{stem} {slot} (B)", False))
            jobs.append((path, GAME / f"{stem}-{slot}.svg", PNGS / f"{stem}-{slot}.png", f"{stem} {slot}", True))
    if only_json:
        print(f"{len(jobs)} command files written")
        return
    failed = False
    with ThreadPoolExecutor(max_workers=4) as pool:
        for job, msg in zip(jobs, pool.map(lambda j: export(*j[:4]), jobs)):
            print(msg)
            if "failed" in msg:
                failed = True
            elif job[4]:
                slim(job[1])
    if failed:
        sys.exit(1)
    list_drawn()


def list_drawn():
    """Writes the heroes that have their icons into src/icons/vc.ts (its DRAWN list), so the game uses them."""
    vc = ROOT / "src" / "icons" / "vc.ts"
    stems = sorted({f.stem.rsplit("-", 1)[0] for f in GAME.glob("*.svg")})
    # a hero in a folder of its own (src/heroes/<theme>/hero.ts) names its stem on its card, and is not listed again
    carded = {m for f in (ROOT / "src" / "heroes").glob("*/hero.ts") for m in re.findall(r"^  icons: '([^']+)'", f.read_text(encoding="utf-8"), re.M)}
    stems = [s for s in stems if s not in carded]
    body = "".join(f"  '{s}',\n" for s in stems)
    t = vc.read_text(encoding="utf-8")
    t = re.sub(r"const DRAWN = new Set<string>\(\[\n.*?\]\);", lambda m: f"const DRAWN = new Set<string>([\n{body}]);", t,
               flags=re.S)
    vc.write_text(t, encoding="utf-8")
    print(f"src/icons/vc.ts: {len(stems)} heroes drawn (and {len(carded)} named by their cards)")


if __name__ == "__main__":
    main()
