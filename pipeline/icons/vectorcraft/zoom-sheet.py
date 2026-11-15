"""
The sample's 32 px check as one picture: for each spell, today's icon and the VectorCraft one, each brought down to
32 px the way a browser does and then shown three times larger with hard pixels, plus the new one in greyscale.

    python -I pipeline/icons/vectorcraft/zoom-sheet.py      -> docs/icons/sample/zoom32.png

Needs Pillow. Reads docs/icons/sample/old/<hero>-<slot>.png (old-icons.js) and docs/icons/sample/<hero>-<slot>.png (make.py).
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
S = ROOT / "docs" / "icons" / "sample"
Z, PX, GAP = 3, 32, 10
cell = PX * Z
heroes = ["anka", "mum"]
slots = ["q", "w", "e", "r"]
cols = 3  # old, new, new grey
W = len(heroes) * (cols * (cell + GAP) + 40) + 20
H = 40 + len(slots) * (cell + GAP) + 10
sheet = Image.new("RGB", (W, H), (14, 12, 18))
dr = ImageDraw.Draw(sheet)
for hi, hero in enumerate(heroes):
    x0 = 20 + hi * (cols * (cell + GAP) + 40)
    for ci, label in enumerate(("today", "VectorCraft", "greyscale")):
        dr.text((x0 + ci * (cell + GAP), 14), f"{hero.title()} {label}", fill=(220, 215, 205))
    for si, slot in enumerate(slots):
        y = 40 + si * (cell + GAP)
        old = Image.open(S / "old" / f"{hero}-{slot}.png").convert("RGB")
        new = Image.open(S / f"{hero}-{slot}.png").convert("RGB")
        for ci, im in enumerate((old, new, new.convert("L").convert("RGB"))):
            small = im.resize((PX, PX), Image.LANCZOS).resize((cell, cell), Image.NEAREST)
            sheet.paste(small, (x0 + ci * (cell + GAP), y))
sheet.save(S / "zoom32.png")
print(f"saved {S / 'zoom32.png'}")
