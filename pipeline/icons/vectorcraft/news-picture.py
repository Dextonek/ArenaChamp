"""
The News page's picture of the new spell icons (public/news/spell-icons.jpg): all of them, a hero's four side by side,
in the order of the heroes' list.

    python -I pipeline/icons/vectorcraft/news-picture.py
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
kits = json.loads((ROOT / "docs" / "icons" / "spells.json").read_text(encoding="utf-8"))["kits"]
files = [ROOT / "docs" / "icons" / "new" / f"{k['stem']}-{s}.png" for k in kits for s in "qwer"]
files = [f for f in files if f.exists()]
cols, px, gap = 20, 54, 5
rows = (len(files) + cols - 1) // cols
im = Image.new("RGB", (cols * (px + gap) + gap + 20, rows * (px + gap) + gap + 20), (14, 12, 18))
for i, f in enumerate(files):
    im.paste(Image.open(f).convert("RGB").resize((px, px), Image.LANCZOS),
             (10 + gap + (i % cols) * (px + gap), 10 + gap + (i // cols) * (px + gap)))
out = ROOT / "public" / "news" / "spell-icons.jpg"
im.save(out, quality=74, optimize=True)
print(f"{len(files)} icons, {im.size}, {out.stat().st_size} B -> {out}")
