"""Sefu the Dune Sovereign (src/kits/sand.ts): a king of the dunes who judges: the rearing cobra, the crook of gold and
lapis, scarabs, and the gold sarcophagus (the art bible's Sand row, sandstone as the foil)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["sefu"] = row("#fff6dc", "#ffd27a", "#c8913f", "#3fd4c8", "#2a1a0c", stone="#e8d8b4", lapis="#2a4aa8",
                  lapis_lo="#14245a", venom="#7affb8")


def gold(ic):
    return ic.grad("#fff0b0", (0.4, "#e8b84a"), (1, "#8a5a18"))


def sef_q(ic):
    """Cobra Spit: a cobra rears and spits venom down the line: it hurts and blinds."""
    p = ic.p
    sand = ic.grad(p["stone"], (0.45, p["body"]), (1, "#5a3a14"))
    # The cobra, seen from the side, in the desert's colour: a coil, the neck rising in an S, the hood spread behind the
    # head; gold only on the hood's edge.
    coil = ic.add("shape.ellipse", x=22, y=43, width=24, height=9)
    ic.solid(ic.id(coil), sand, ink_w=4)
    hood = ic.add("shape.ellipse", x=19, y=13, width=12, height=20, rotation=-18)
    ic.solid(ic.id(hood), ic.grad(p["stone"], (0.5, p["body"]), (1, "#5a3a14")), ink_w=4)
    ic.line(poly(arc_pts((25, 23), 6.6, 200, 330, 8, ry=10.4), closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.2,
            ink=False)
    for k in range(3):
        ic.line(curve([(21.5 + k * 1.2, 17 + k * 4.5), (25 + k * 1.2, 16 + k * 4.5), (28.5 + k * 1.2, 17.5 + k * 4.5)],
                      closed=False), p["lapis"], 1.4, ink=False)
    neck = curve([(38, 46), (28, 40), (25, 31), (28, 22), (34, 18)], closed=False)
    ic.line(neck, sand, 5.2, ink_w=8.4)
    ic.line(neck, "#5a3a14", 5.2, ink=False, dash=[1.2, 3.4], cap="butt")
    head = curve([(32, 15), (38, 14.5), (43, 17), (38, 20.5), (32, 21)], sharp=(2,), k=0.6)
    ic.shape(head, sand, shadow=False, ink_w=3)
    dot(ic, 37, 16.6, 0.9, p["dark"])
    swoosh(ic, (40, 46), 30, -86, -38, 4.4, (p["core"], (0.4, p["venom"]), (1, p["accent"])), head=0.85, ink_w=2.4)
    for x, y in ((57, 26), (59, 33), (55, 34)):
        dot(ic, x, y, 1.4, p["venom"])


def crook(ic, foot, top, r=6):
    """The heqa crook: gold and lapis bands, the hook at the top."""
    p = ic.p
    ang = math.atan2(top[1] - foot[1], top[0] - foot[0])
    c = (top[0] - r * math.cos(ang + math.pi / 2), top[1] - r * math.sin(ang + math.pi / 2))
    a0 = math.degrees(ang) + 90
    hook = arc_pts(c, r, a0, a0 - 200, 10)
    d = curve([foot, top] + hook[1:], closed=False, sharp=(0, 1))
    ic.line(d, gold(ic), 3.6, ink_w=6.4)
    ic.line(d, p["lapis"], 3.6, ink=False, dash=[2.2, 2.6], cap="butt")
    return hook[-1]


def sef_w(ic):
    """Shepherd's Crook: he hooks you with the crook and drags you to him: Judged."""
    p = ic.p
    end = crook(ic, (18, 52), (36, 13), r=7)
    disc(ic, 47, 32, 6.5, ic.grad(p["core"], (0.5, p["hot"]), (1, p["body"])), ink_w=3.4)
    ic.line(curve([(44, 27), (40, 21), (41, 16)], closed=False), p["hot"], 1.4, ink=False)
    for x in (36, 30):
        chevron(ic, (x, 38), 200, 3.2, p["accent"], 2.4)
    # The Judged mark: an eye of lapis over the target.
    eye = curve([(41, 21.5), (47, 18), (53, 21.5), (47, 25)], sharp=(0, 2), k=0.7)
    ic.shape(eye, ic.grad("#ffffff", (1, p["stone"])), shadow=False, ink_w=2.2)
    dot(ic, 47, 21.5, 1.6, p["lapis"])


def scarab(ic, c, ang, s=1.0, fill=None):
    """A scarab seen from above: a domed back split in two, a head, legs."""
    p = ic.p
    for side in (-1, 1):
        for u, du in ((-2.6, -2.4), (0.8, 0), (3.6, 2.2)):
            a, b = place([(u * s, side * 3.6 * s), ((u + du) * s, side * 7.6 * s)], ang, c)
            ic.line(poly([a, b], closed=False), "#e8b84a", 1.0 * s, ink=True, ink_w=2.4 * s)
    body = curve(place([(-6.5 * s, 0), (-4.6 * s, -5 * s), (1.6 * s, -5.4 * s), (3.4 * s, -4.4 * s), (4.6 * s, 0),
                        (3.4 * s, 4.4 * s), (1.6 * s, 5.4 * s), (-4.6 * s, 5 * s)], ang, c), sharp=(3, 5), k=0.7)
    ic.shape(body, fill or ic.grad(p["accent"], (0.5, "#1f8a88"), (1, "#0e3a40")), shadow=False, ink_w=2.4 * s)
    hd = place([(6.4 * s, 0)], ang, c)[0]
    disc(ic, hd[0], hd[1], 2.1 * s, gold(ic), shadow=False, ink_w=2.0 * s)
    a, b = place([(-6 * s, 0), (2.4 * s, 0)], ang, c)
    ic.line(poly([a, b], closed=False), p["dark"], 1.0 * s, ink=False)
    a, b = place([(2.4 * s, -4.8 * s), (2.4 * s, 4.8 * s)], ang, c)
    ic.line(poly([a, b], closed=False), p["dark"], 1.0 * s, ink=False)


def sef_e(ic):
    """Scarab Stride: he runs six metres as a stream of scarabs; through you, they bite."""
    p = ic.p
    for x, y, s, op in ((14, 38, 0.6, 60), (22, 34, 0.7, 75), (30, 31, 0.8, 90)):
        m = ic.mark()
        scarab(ic, (x, y), -20, s)
        ic.add("object.setProps", ids=[ic.group(m)], opacity=op)
    streaks(ic, [(8, 24, 18, 21), (10, 46, 20, 42)], color=p["hot"], weight=1.8)
    scarab(ic, (43, 25), -20, 1.45, fill=ic.grad("#7af0e0", (0.45, p["accent"]), (1, "#0e3a40")))


def sef_r(ic):
    """Sarcophagus: a gold sarcophagus rises round you and shuts; it opens in scarabs."""
    p = ic.p
    ring(ic, 32, 52, 15, 3.8, p["accent"], w=2.0)
    case = curve([(32, 5), (40, 9), (42, 18), (40, 26), (41, 44), (37, 54), (27, 54), (23, 44), (24, 26), (22, 18), (24, 9)],
                 sharp=(5, 6), k=0.6)
    ic.shape(case, gold(ic))
    # The nemes: lapis stripes over the head, the face of gold, the crossed crook and flail.
    for k in range(4):
        y = 12 + k * 3
        ic.line(poly([(24.5 + k * 0.2, y), (28, y + 1)], closed=False), p["lapis"], 1.6, ink=False)
        ic.line(poly([(39.5 - k * 0.2, y), (36, y + 1)], closed=False), p["lapis"], 1.6, ink=False)
    face = ic.add("shape.ellipse", x=28, y=10, width=8, height=11)
    ic.solid(ic.id(face), ic.grad("#fff0b0", (1, "#c8902a")), shadow=False, ink_w=2.0)
    for x in (30.5, 33.5):
        dot(ic, x, 15, 0.7, p["dark"])
    collar = curve([(25, 26), (32, 31), (39, 26)], closed=False)
    ic.line(collar, p["lapis"], 3.0, ink=False)
    ic.line(curve([(26, 28.6), (32, 33.6), (38, 28.6)], closed=False), p["accent"], 1.2, ink=False)
    ic.line(poly([(28, 34), (36, 44)], closed=False), p["lapis"], 1.8, ink=True, ink_w=3.6)
    ic.line(poly([(36, 34), (28, 44)], closed=False), GOLD[0], 1.8, ink=True, ink_w=3.6)
    for x, y, a in ((14, 40, -60), (50, 40, -120)):
        scarab(ic, (x, y), a, 0.55)


ICONS = {"q": sef_q, "w": sef_w, "e": sef_e, "r": sef_r}
