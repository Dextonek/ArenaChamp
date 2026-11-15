"""
Sheets of spell icons at 32 px (each brought down from its 128 px picture the way a browser does, then shown `--zoom`
times larger with hard pixels), one hero to a row.

    python -I pipeline/icons/vectorcraft/sheet.py old  <out.png> [stems...]      today's icons (docs/icons/old)
    python -I pipeline/icons/vectorcraft/sheet.py pair <out.png> stems...         today / new / grey / under the key letter / round, per spell
    python -I pipeline/icons/vectorcraft/sheet.py new  <out.png> [stems...] [--zoom 1] [--cols 2]   the new icons only

Without stems: every hero that has pictures. Needs Pillow. Reads docs/icons/old/<stem>-<slot>.png (old-icons.js) and
docs/icons/new/<stem>-<slot>.png (make.py).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
OLD = ROOT / "docs" / "icons" / "old"
NEW = ROOT / "docs" / "icons" / "new"
SLOTS = ["q", "w", "e", "r"]
BG = (14, 12, 18)


def small(path, px=32):
    return Image.open(path).convert("RGB").resize((px, px), Image.LANCZOS)


def keyed(path, slot):
    """As the desktop bar shows it: the key letter's dark badge over the lower left (src/heroMode.ts's slot)."""
    im = Image.open(path).convert("RGB")
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((8, 88, 48, 120), radius=6, fill=(24, 22, 26), outline=(120, 110, 100), width=2)
    try:
        font = ImageFont.truetype("arialbd.ttf", 22)
    except OSError:
        font = None
    d.text((28, 104), slot.upper(), fill=(240, 236, 228), anchor="mm", font=font)
    return im.resize((32, 32), Image.LANCZOS)


def rounded(path):
    """As the phone bar shows it: inside a round slot with a grey ring."""
    im = Image.open(path).convert("RGB")
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).ellipse((2, 2, 125, 125), fill=255)
    out = Image.new("RGB", im.size, BG)
    out.paste(im, (0, 0), mask)
    ImageDraw.Draw(out).ellipse((2, 2, 125, 125), outline=(150, 150, 155), width=5)
    return out.resize((32, 32), Image.LANCZOS)


def stems_in(folder):
    seen = []
    for p in sorted(folder.glob("*-q.png")):
        seen.append(p.name[:-6])
    return seen


def main():
    args = sys.argv[1:]
    zoom = 3
    cols = 1
    if "--zoom" in args:
        i = args.index("--zoom")
        zoom = int(args[i + 1])
        del args[i:i + 2]
    if "--cols" in args:
        i = args.index("--cols")
        cols = int(args[i + 1])
        del args[i:i + 2]
    mode, out, stems = args[0], Path(args[1]), args[2:]
    folder = OLD if mode == "old" else NEW
    stems = stems or stems_in(folder)
    cell, gap, label = 32 * zoom, max(4, 3 * zoom), 150 if zoom > 1 else 120
    per = {"old": 1, "new": 1, "pair": 5}[mode]
    block = label + len(SLOTS) * (per * (cell + gap) + gap * 2)
    rows = (len(stems) + cols - 1) // cols
    W, H = cols * block + 20, 20 + rows * (cell + gap) + 10
    sheet = Image.new("RGB", (W, H), BG)
    dr = ImageDraw.Draw(sheet)
    for n, stem in enumerate(stems):
        x0, y = 10 + (n // rows) * block, 10 + (n % rows) * (cell + gap)
        dr.text((x0, y + cell // 2 - 6), stem, fill=(220, 215, 205))
        x = x0 + label
        for slot in SLOTS:
            files = {"old": [OLD], "new": [NEW], "pair": [OLD, NEW, NEW, NEW, NEW]}[mode]
            for k, f in enumerate(files):
                p = f / f"{stem}-{slot}.png"
                if not p.exists():
                    x += cell + gap
                    continue
                if mode == "pair" and k == 3:
                    im = keyed(p, slot)
                elif mode == "pair" and k == 4:
                    im = rounded(p)
                else:
                    im = small(p)
                if mode == "pair" and k == 2:
                    im = im.convert("L").convert("RGB")
                sheet.paste(im.resize((cell, cell), Image.NEAREST), (x, y))
                x += cell + gap
            x += gap * 2
    sheet.save(out)
    print(f"saved {out} ({W} x {H})")


if __name__ == "__main__":
    main()
