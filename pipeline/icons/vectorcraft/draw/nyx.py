"""Nyx the Umbral Stalker (src/kits/shadow.ts): a dagger out of the dark, smoke, a shadow that walks on its own, and the
night she brings down; the art bible's Shadow row, the moon as its foil."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["nyx"] = row("#f4e8ff", "#c88cff", "#6a2ec0", "#5affd2", "#050308", moon="#cfcad8", deep="#2a1050")


def dagger(ic, hilt, ang, L):
    p = ic.p
    blade = [(0, -2.4), (0.62 * L, -1.8), (L, 0), (0.62 * L, 1.8), (0, 2.4)]
    ic.shape(poly(place(blade, ang, hilt)), ic.grad("#ffffff", (0.45, p["moon"]), (1, "#4a4458")))
    ic.line(poly(place([(0.05 * L, 0), (0.85 * L, 0)], ang, hilt), closed=False), p["hot"], 0.9, ink=False)
    guard = place([(-1.4, -6), (1.4, -6), (1.4, 6), (-1.4, 6)], ang, hilt)
    ic.shape(poly(guard), ic.grad(GOLD[0], (1, GOLD[2])), shadow=False, ink_w=2.6)
    grip = place([(-1.4, -1.6), (-8.5, -1.6), (-8.5, 1.6), (-1.4, 1.6)], ang, hilt)
    ic.shape(poly(grip), ic.grad("#4a2a6a", (1, "#120820")), shadow=False, ink_w=2.6)
    px, py = place([(-10, 0)], ang, hilt)[0]
    disc(ic, px, py, 2.0, ic.grad(p["core"], (1, p["hot"])), shadow=False, ink_w=2.2)


def nyx_q(ic):
    """Umbral Cut: a dagger out of the shadow at your back: worse from behind."""
    p = ic.p
    swoosh(ic, (30, 36), 22, -170, -10, 7, (p["core"], (0.4, p["hot"]), (1, p["body"])), head=0.4)
    dagger(ic, (24, 18), 52, 30)
    spark(ic, 52, 38, 3.6, p["accent"])


def nyx_w(ic):
    """Smoke Veil: a cloud of dark smoke at her feet: inside it she is gone and you are blind."""
    p = ic.p
    for x, y, r, op in ((20, 38, 10, 100), (44, 37, 10.5, 100), (32, 29, 13, 100), (25, 45, 8, 100), (40, 46, 8.5, 100)):
        ic.shape(blob_d((x, y), r, n=6, wobble=0.12, phase=x), ic.grad("#7a5aa0", (0.5, "#3a2458"), (1, "#140a22")),
                 shadow=False, ink_w=3)
    m = ic.mark()
    hooded(ic, (32, 33), 1.05, ic.grad(p["hot"], (1, p["body"])), ink=False)
    ic.add("object.setProps", ids=[ic.group(m)], opacity=45)
    for x, y, r in ((22, 44, 7), (42, 45, 7.5)):
        ic.shape(blob_d((x, y), r, n=5, wobble=0.14, phase=x), ic.grad("#6a4a90", (1, "#140a22")), shadow=False, ink_w=2.6)
    for x, y in ((14, 20), (50, 22)):
        ic.line(curve([(x, y + 4), (x + 2, y), (x - 1, y - 4)], closed=False), "#7a5aa0", 1.8, ink=False)


def hooded(ic, c, s, fill, ink=True):
    """A cloaked figure: a pointed hood over the head, shoulders, a cloak flaring to a ragged hem."""
    pts = [(0.5, -16), (4.6, -11), (4.6, -7), (8.5, -4.5), (10, 5), (12.5, 13), (5, 11), (0, 13.5), (-5, 11), (-12.5, 13),
           (-10, 5), (-8.5, -4.5), (-4.6, -7), (-4.6, -11)]
    d = curve([(c[0] + x * s, c[1] + y * s) for x, y in pts], sharp=(0, 5, 6, 7, 8, 9), k=0.5)
    if ink:
        return ic.shape(d, fill)
    s2 = ic.add("path.create", d=d)
    ic.paint(ic.id(s2), fill=fill, stroke="none")
    return ic.id(s2)


def nyx_e(ic):
    """Shadow Double: she darts away, through cover; a shadow of her stays and walks at you."""
    p = ic.p
    m = ic.mark()
    hooded(ic, (18, 32), 1.1, ic.grad("#3a2458", (1, "#0a0614")))
    ic.add("object.setProps", ids=[ic.group(m)], opacity=85)
    for x, y in ((16.8, 21.5), (20, 21.5)):
        dot(ic, x, y, 0.9, p["accent"])
    streaks(ic, [(28, 24, 37, 24), (29, 32, 38, 32), (30, 40, 38, 40)], color=p["hot"], weight=2.0)
    hooded(ic, (47, 31), 1.2, ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"])))
    face = ic.add("shape.ellipse", x=44.6, y=15.5, width=5, height=5.4)
    ic.paint(ic.id(face), fill=p["deep"], stroke="none")
    dagger(ic, (55, 36), -60, 12)


def nyx_r(ic):
    """Nightfall: the arena goes dark; she is faster, harder, and fades after every blow."""
    p = ic.p
    glow(ic, 33, 28, 22, p["body"], opacity=60)
    moon = ic.add("shape.ellipse", x=15, y=10, width=36, height=36)
    cut = ic.add("shape.ellipse", x=22, y=6, width=34, height=34)
    cr = ic.add("object.pathfinder.minusFront", ids=[ic.id(moon), ic.id(cut)])
    ic.solid(ic.ids(cr), ic.grad("#ffffff", (0.45, p["moon"]), (1, "#6a6278")), ink_w=4)
    for x, y, r in ((44, 17, 2.6), (50, 30, 1.8), (40, 40, 2.2), (54, 42, 1.4), (37, 25, 1.4)):
        spark(ic, x, y, r * 1.4, p["hot"])
    dagger(ic, (40, 52), -30, 18)


ICONS = {"q": nyx_q, "w": nyx_w, "e": nyx_e, "r": nyx_r}
