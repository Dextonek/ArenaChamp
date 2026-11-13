"""
Compares the pictures of two runs of the performance tool, scene by scene: python pipeline/tools/perf-diff.py cmp-base cmp-new
For runs that were the same fight (the tool prints "same fight"): the same frame before and after a change. Prints how far
apart the two pictures are (the mean difference of a pixel, of 255; the film grain alone gives about 1) and the share of
pixels that differ by more than 24 of 255, and saves a picture of where they differ to docs/perf/img/diff-<...>.jpg.
Needs `pip install pillow`.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops

IMG = Path(__file__).resolve().parents[2] / "docs" / "perf" / "img"


def main():
    a, b = sys.argv[1], sys.argv[2]
    for fa in sorted(IMG.glob(f"{a}-*.jpg")):
        fb = IMG / fa.name.replace(a, b, 1)
        if not fb.exists():
            continue
        ia, ib = Image.open(fa).convert("RGB"), Image.open(fb).convert("RGB")
        if ia.size != ib.size:
            print(f"{fa.name}: sizes differ {ia.size} {ib.size}")
            continue
        diff = ImageChops.difference(ia, ib).convert("L")
        hist = diff.histogram()
        n = ia.size[0] * ia.size[1]
        mean = sum(i * c for i, c in enumerate(hist)) / n
        far = sum(hist[25:]) / n
        out = IMG / ("diff-" + fa.name.replace(a + "-", f"{a}-{b}-", 1))
        diff.point(lambda v: min(255, v * 8)).save(out, quality=80)
        print(f"{fa.name[len(a) + 1:-4]:28} mean difference {mean:5.2f} of 255, pixels far apart {far * 100:5.2f} %  -> {out.name}")


if __name__ == "__main__":
    main()
