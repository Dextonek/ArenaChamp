"""Marin the Tide Dancer (src/kits/tide.ts): sea water that spins, coral, the tide's high and low, and the moon that pulls
it (the art bible's Tide row, foam as its foil, coral as the accent)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["marin"] = row("#ffffff", "#bff2ff", "#1f9fd6", "#ff9a6a", "#05253a", foam="#eaf8fb", deep="#0a5a8a")


def sea(ic):
    p = ic.p
    return (p["core"], (0.35, p["hot"]), (1, p["body"]))


def mar_q(ic):
    """Wave Disc: a spinning disc of water: high tide pushes, low tide pulls."""
    p = ic.p
    streaks(ic, [(5, 22, 14, 24), (5, 32, 13, 32), (7, 41, 15, 39)], color=p["hot"], weight=1.8)
    c = (36, 31)
    disc(ic, c[0], c[1], 15, ic.grad(p["hot"], (0.5, p["body"]), (1, p["deep"])), ry=6.5, ink_w=4.2)
    for k in range(3):
        a0 = k * 120
        swoosh(ic, c, 10, a0, a0 + 100, 3.0, sea(ic), ry=4.2, head=0.7, ink=False)
    dot(ic, c[0], c[1], 2.2, p["core"])
    for x, y in ((50, 22), (53, 38), (22, 42)):
        dot(ic, x, y, 1.5, p["hot"])


def coral(ic, foot, h):
    p = ic.p
    x, y = foot
    branches = [((x, y), (x - 1, y - h)), ((x - 0.5, y - h * 0.45), (x - 9, y - h * 0.8)),
                ((x - 6, y - h * 0.68), (x - 8, y - h * 1.0)), ((x, y - h * 0.3), (x + 9, y - h * 0.65)),
                ((x + 6, y - h * 0.52), (x + 11, y - h * 0.9)), ((x - 0.6, y - h * 0.8), (x + 4, y - h * 1.08))]
    for a, b in branches:
        ic.line(curve([a, ((a[0] + b[0]) / 2 + 1, (a[1] + b[1]) / 2), b], closed=False),
                ic.grad("#ffd8c0", (0.5, p["accent"]), (1, "#b8442a")), 3.4, ink_w=6.2)
    for a, b in branches:
        dot(ic, b[0], b[1], 1.8, "#ffd8c0")


def mar_w(ic):
    """Coral Spire: a coral pillar rises at the spot: a wall, and it shoves or drags with the tide."""
    p = ic.p
    ring(ic, 32, 51, 19, 4.8, ic.grad(p["hot"], (1, p["body"])), w=2.2)
    for x, ang, h in ((18, -125, 9), (46, -55, 9), (24, -105, 6), (40, -75, 6)):
        ic.shape(curve(place(tongue_pts(h, 4.4, lean=0.1), ang, (x, 50))), ic.grad(p["core"], (1, p["body"])), shadow=False,
                 ink_w=2.4)
    coral(ic, (32, 51), 40)


def mar_e(ic):
    """Mist Form: she turns to water and flows six metres, through you, and reforms in a splash."""
    p = ic.p
    swoosh(ic, (30, 50), 21, 190, 340, 7.5, sea(ic), ry=30, head=0.8)
    for x, ang, h in ((44, -110, 10), (52, -70, 12), (58, -40, 8)):
        ic.shape(curve(place(tongue_pts(h, 4.6, lean=0.15), ang, (x, 47))), ic.grad(p["core"], (0.5, p["hot"]), (1, p["body"])),
                 shadow=False, ink_w=2.4)
    for x, y in ((46, 30), (55, 34), (50, 24)):
        dot(ic, x, y, 1.6, p["hot"])
    ring(ic, 50, 49, 9, 2.6, p["foam"], w=1.6)


def mar_r(ic):
    """Moon's Pull: she stands under a moon that holds the tide low and drags you to her."""
    p = ic.p
    glow(ic, 32, 18, 14, p["hot"], opacity=60)
    moon = ic.add("shape.ellipse", x=21, y=7, width=22, height=22)
    cut = ic.add("shape.ellipse", x=26, y=4, width=21, height=21)
    cr = ic.add("object.pathfinder.minusFront", ids=[ic.id(moon), ic.id(cut)])
    ic.solid(ic.ids(cr), ic.grad("#ffffff", (0.5, p["foam"]), (1, "#8ab8c8")), ink_w=3.6)
    for y, a in ((40, 8), (48, 10)):
        ic.line(curve([(6, y), (16, y - 3), (26, y), (36, y - 3), (46, y), (58, y - 3)], closed=False), sea(ic)[1][1], 2.4,
                ink_w=4.8)
    for x in (16, 48):
        chevron(ic, (x + (4 if x < 32 else -4), 34), 0 if x < 32 else 180, 3.0, p["accent"], 2.2)
    star(ic, 32, 33, 4, 1.2, p["core"], points=4, ink_w=0)


ICONS = {"q": mar_q, "w": mar_w, "e": mar_e, "r": mar_r}
