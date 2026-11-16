"""Wick the Doorwarden (src/kits/door.ts): the keeper of thresholds in a long crimson coat with gold braid: tall doors of
dark wood bound in brass, lamplight through them, and a ring of great brass keys."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Threshold" (Wick; src/kits/door.ts S): lamplight through a door, brass, his crimson as the accent.
PAL["wick"] = row("#fffbe8", "#ffe6a8", "#ffcf7a", "#c8423a", "#1a0d0a",
                  brass="#b08a4a", brass_lo="#7a5c2c", wood="#5a3321", wood_lt="#8a5a3a", wood_dk="#2c1a10")
PAL["wick"].update(lit="#3a2014", mid="#22120c")


def brass(ic):
    return ic.grad(GOLD[0], (0.45, ic.p["brass"]), (1, ic.p["brass_lo"]))


def doorway(ic, c, w, h, open_=0.0, light=True):
    """An arched door in its frame: dark wood planks bound in brass; `open_` swings the leaf to show the light."""
    p = ic.p
    x, y = c
    arch = curve([(x - w / 2, y), (x - w / 2, y - h + w / 2), (x, y - h), (x + w / 2, y - h + w / 2), (x + w / 2, y)],
                 sharp=(0, 1, 3, 4), k=0.8)
    ic.shape(arch, brass(ic))
    inner = curve([(x - w / 2 + 2, y), (x - w / 2 + 2, y - h + w / 2), (x, y - h + 2), (x + w / 2 - 2, y - h + w / 2), (x + w / 2 - 2, y)],
                  sharp=(0, 1, 3, 4), k=0.8)
    if light:
        ic.path(inner, fill=ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"]), angle=-90), stroke="none")
    else:
        ic.path(inner, fill=p["wood_dk"], stroke="none")
    if open_ < 1:
        lx = x - w / 2 + 2 + (w - 4) * open_
        leaf = curve([(lx, y), (lx, y - h + w / 2), ((lx + x + w / 2 - 2) / 2, y - h + 2 + (lx - (x - w / 2 + 2)) * 0.5),
                      (x + w / 2 - 2, y - h + w / 2), (x + w / 2 - 2, y)], sharp=(0, 1, 3, 4), k=0.8)
        ic.shape(leaf, ic.grad(p["wood_lt"], (0.5, p["wood"]), (1, p["wood_dk"])), shadow=False, ink_w=2.4)
        for k in (0.33, 0.66):
            xx = lx + (x + w / 2 - 2 - lx) * k
            ic.line(poly([(xx, y - 1), (xx, y - h + w / 2 - 1)], closed=False), p["wood_dk"], 0.8, ink=False)
        for yy in (y - h * 0.3, y - h * 0.65):
            ic.line(poly([(lx, yy), (x + w / 2 - 2, yy)], closed=False), p["brass"], 1.4, ink=False)


def key(ic, bow, ang, L, s=1.0):
    """A great brass key: a ring bow with a gem, a shaft, a toothed bit."""
    p = ic.p
    a, b = place([(0, 0), (L, 0)], ang, bow)
    ic.line(poly([a, b], closed=False), brass(ic), 2.6 * s, ink_w=5.2 * s)
    bit = [(L - 6 * s, 0), (L - 6 * s, 5 * s), (L - 4 * s, 5 * s), (L - 4 * s, 3 * s), (L - 2 * s, 3 * s), (L - 2 * s, 5.4 * s),
           (L, 5.4 * s), (L, 0)]
    ic.shape(poly(place(bit, ang, bow)), brass(ic), shadow=False, ink_w=2.6)
    e = ic.add("shape.ellipse", x=bow[0] - 5 * s, y=bow[1] - 5 * s, width=10 * s, height=10 * s)
    ic.paint(ic.id(e), fill="none", stroke=p["dark"], weight=5.6 * s)
    e2 = ic.add("shape.ellipse", x=bow[0] - 5 * s, y=bow[1] - 5 * s, width=10 * s, height=10 * s)
    ic.paint(ic.id(e2), fill="none", stroke=brass(ic), weight=2.8 * s)
    disc(ic, bow[0], bow[1], 2.2 * s, ic.grad("#ff9a8a", (1, "#8a1a18")), shadow=False, ink_w=1.8)


def wic_q(ic):
    """Key Toss: a brass key thrown; it flies into a door and out of its pair."""
    p = ic.p
    doorway(ic, (45, 50), 18, 36, open_=1.0)
    streaks(ic, [(6, 23, 14, 23), (5, 31, 12, 31)], color=p["hot"], weight=2.0)
    key(ic, (17, 27), 12, 26, 1.0)


def wic_w(ic):
    """Door: a door at the spot, and its pair: walk into one and leave by the other."""
    p = ic.p
    doorway(ic, (17, 40), 12, 24, open_=0.55)
    ic.line(curve([(22, 22), (30, 13), (40, 14)], closed=False), p["hot"], 1.6, ink=False, dash=[2.2, 2])
    chevron(ic, (41, 15), 10, 2.6, p["hot"], 1.8)
    doorway(ic, (41, 52), 22, 40, open_=0.55)


def wic_e(ic):
    """Slam: both doors slam shut at once, on whoever stands near either."""
    p = ic.p
    doorway(ic, (32, 52), 26, 44, open_=0.0, light=False)
    ic.line(poly([(32, 14), (32, 51)], closed=False), p["wood_dk"], 1.6, ink=False)
    for side in (-1, 1):
        for k, (dy, L) in enumerate(((-12, 8), (0, 10), (12, 8))):
            x0 = 32 + side * 17
            ic.line(poly([(x0, 34 + dy), (x0 + side * L, 34 + dy + (dy / 3))], closed=False), p["hot"], 2.0)
    star(ic, 32, 34, 7, 1.6, p["core"], points=4, ink_w=0)


def wic_r(ic):
    """Grand Lobby: four tall doors ring you; walk into one and you come out across the ring."""
    p = ic.p
    ring(ic, 32, 40, 21, 8, ic.grad(p["hot"], (1, p["body"])), w=1.8, dash=[2.6, 2.2])
    for x, y, s in ((32, 30, 0.8), (13, 41, 0.85), (51, 41, 0.85)):
        doorway(ic, (x, y), 10 * s, 20 * s, open_=0.4)
    doorway(ic, (32, 55), 11, 21, open_=0.4)
    star(ic, 32, 40, 5, 1.4, p["core"], points=4, ink_w=0)


ICONS = {"q": wic_q, "w": wic_w, "e": wic_e, "r": wic_r}
