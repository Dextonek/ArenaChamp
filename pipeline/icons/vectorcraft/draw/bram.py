"""Bram the Stonewright (src/kits/mason.ts): Gerald, the limestone pillar older than the Deep, carries Bram's maker's mark
(a square with a dot in its corner, docs/lore/codex/heroes/bram.md), cut in amber rune-light."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Stone / rune" (Bram; src/kits/mason.ts M): limestone ladder, rune amber accent, the Underforge's dark.
PAL["bram"] = row("#f6efdc", "#ffd890", "#c9b48a", "#ff9a2a", "#1c1a18",
                  stone="#9a958c", stone_dark="#5b5853", foil="#e6e0d0")


def pillar(ic, at, H=34, w=12.5, ang=0.0, mark=True):
    """Gerald: a limestone pillar standing on `at` (its base's middle), turned `ang` degrees about it: a base, a fluted
    shaft and a capital in one outline, the maker's mark glowing on the shaft."""
    p = ic.p
    W = w * 0.64
    outline = [(-W, 0), (-W, -0.09 * H), (-w / 2, -0.11 * H), (-w / 2, -0.86 * H), (-W, -0.89 * H), (-W, -H), (W, -H),
               (W, -0.89 * H), (w / 2, -0.86 * H), (w / 2, -0.11 * H), (W, -0.09 * H), (W, 0)]
    ic.shape(poly(place(outline, ang, at)), ic.grad(p["core"], (0.4, p["body"]), (1, p["stone_dark"])))
    # The joints of base and capital, and the flutes: lines in the stone's shade.
    for a, b in (((-W, -0.09 * H), (W, -0.09 * H)), ((-W, -0.89 * H), (W, -0.89 * H))):
        ic.line(poly(place([a, b], ang, at), closed=False), p["stone_dark"], 1.1, ink=False)
    for x in (-0.22 * w, 0.22 * w):
        ic.line(poly(place([(x, -0.16 * H), (x, -0.36 * H)], ang, at), closed=False), p["stone"], 1.2, ink=False)
        ic.line(poly(place([(x, -0.66 * H), (x, -0.82 * H)], ang, at), closed=False), p["stone"], 1.2, ink=False)
    # A thin gold band under the capital: structure, not surface.
    ic.line(poly(place([(-w / 2 + 0.4, -0.84 * H), (w / 2 - 0.4, -0.84 * H)], ang, at), closed=False),
            ic.grad(GOLD[0], (1, GOLD[1])), 1.2, ink=False)
    if mark:
        cx, cy = place([(0, -0.51 * H)], ang, at)[0]
        glow(ic, cx, cy, w * 0.75, p["accent"], opacity=80)
        s = w * 0.27
        sq = place([(-s, -0.51 * H - s), (s, -0.51 * H - s), (s, -0.51 * H + s), (-s, -0.51 * H + s)], ang, at)
        ic.line(poly(sq), p["dark"], 3.6, ink=False)
        ic.line(poly(sq), ic.grad(p["hot"], (1, p["accent"])), 1.7, ink=False)
        dx, dy = place([(s * 0.45, -0.51 * H - s * 0.45)], ang, at)[0]
        dot(ic, dx, dy, 1.05, p["hot"])


def rubble(ic, pts):
    p = ic.p
    for x, y, r, a in pts:
        ic.shape(poly(place([(-r, -r * 0.6), (r * 0.3, -r), (r, 0), (0, r * 0.8), (-r * 0.8, r * 0.5)], a, (x, y))),
                 ic.grad(p["body"], (1, p["stone_dark"])), shadow=False, ink_w=2.4)


def bram_q(ic):
    """Raise Gerald: the pillar bursts up out of the floor, rock thrown aside, the ground ring cracked in amber."""
    p = ic.p
    ring(ic, 33, 50, 18, 4.6, ic.grad(p["hot"], (0.5, p["accent"]), (1, "#a8441a")), w=2.4)
    cracks(ic, (33, 50), [(10, 17), (170, 15), (40, 10)], color=p["accent"], weight=1.3)
    streaks(ic, [(20.5, 22, 20.5, 33), (46, 20, 46, 31), (16.5, 27, 16.5, 35)], color=p["core"], weight=2.0)
    pillar(ic, (33, 50), H=37, w=13)
    rubble(ic, [(50.5, 41, 3.0, 20), (24, 38.5, 2.4, -30), (45.5, 13, 2.0, 50), (53, 31, 1.8, 0)])


def bram_w(ic):
    """The Shove: Gerald slides along the aim, leaning into it, and slams whoever is in the way."""
    p = ic.p
    streaks(ic, [(9, 19, 23, 19), (7, 27, 22, 27), (11, 35, 23, 35)], color=p["core"], weight=2.2)
    sh = ic.add("path.create", d=poly([(16, 49), (40, 49), (42, 52.5), (14, 52.5)]))
    ic.paint(ic.id(sh), fill=p["dark"], stroke="none")
    ic.add("object.setProps", ids=[ic.id(sh)], opacity=60)
    pillar(ic, (36, 50), H=34, w=13, ang=9)
    star(ic, 52, 30, 9, 2.6, ic.grad(p["core"], (0.5, p["hot"]), (1, p["accent"])), rotation=0, ink_w=3)
    star(ic, 52, 30, 5, 1.6, p["core"], rotation=45, ink_w=0)


def bram_e(ic):
    """A Good Lean: he dashes to Gerald and stops behind a stone shield, the pillar at his back."""
    p = ic.p
    pillar(ic, (45, 50), H=33, w=12)
    streaks(ic, [(8, 18, 17, 22), (10, 26, 17, 28)], color=p["core"], weight=2.2)
    shield = [(16, 15.5), (24.5, 13), (33, 15.5), (33, 29), (30.5, 37.5), (24.5, 43.5), (18.5, 37.5), (16, 29)]
    ic.shape(curve(shield, sharp=(0, 1, 2, 5), k=0.6), ic.grad(p["core"], (0.45, p["body"]), (1, p["stone_dark"])))
    inner = [(19, 18), (24.5, 16.4), (30, 18), (30, 28.5), (28.2, 34.8), (24.5, 39), (20.8, 34.8), (19, 28.5)]
    ic.line(curve(inner, sharp=(0, 1, 2, 5), k=0.6), ic.grad(GOLD[0], (1, GOLD[2])), 1.4, ink=False)
    # The maker's mark on the shield too: a square with a dot in its corner.
    glow(ic, 24.5, 27, 6.5, p["accent"], opacity=85)
    sq = [(21, 23.5), (28, 23.5), (28, 30.5), (21, 30.5)]
    ic.line(poly(sq), p["dark"], 4.0, ink=False)
    ic.line(poly(sq), ic.grad(p["hot"], (1, p["accent"])), 2.0, ink=False)
    dot(ic, 26, 25.5, 1.2, p["hot"])


def bram_r(ic):
    """Gerald, No!: the pillar topples along the aim, its long shadow on the floor where it will land."""
    p = ic.p
    sh = ic.add("path.create", d=poly([(28, 50), (60, 47), (61, 52.5), (28, 54)]))
    ic.paint(ic.id(sh), fill=ic.grad((0, p["accent"], 0.15), (1, p["accent"], 0.6), start=[28, 50], end=[61, 50]),
             stroke="none")
    for r, w in ((37, 2.2), (29, 1.8)):
        ic.line(poly(arc_pts((28, 50), r, -100, -62, 8), closed=False), p["core"], w, ink=True)
    chevron(ic, (28 + 37 * math.cos(math.radians(-58)), 50 + 37 * math.sin(math.radians(-58))), 30, 3.6, p["core"], 2.2)
    pillar(ic, (28, 51), H=34, w=12.5, ang=44)
    rubble(ic, [(55, 44, 2.6, 10), (49.5, 48.5, 2.0, 40)])


ICONS = {'q': bram_q, 'w': bram_w, 'e': bram_e, 'r': bram_r}
