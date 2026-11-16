"""Madame Cleaver the Feastmistress (src/kits/chef.ts): a war cook of the Dune folk in dark leather and crimson: the
great cleaver with its ember edge, an iron cauldron, the feast's dishes under silver."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Feast / ember" (Madame Cleaver; src/kits/chef.ts S): the cleaver's ember edge, her crimson, a herb green.
PAL["madame-cleaver"] = row("#fff3e0", "#ffb03a", "#d84a3a", "#7fbf4a", "#1e1a18",
                            steel="#c4ccd4", steel_lo="#6e7480", char="#2c2724", wood="#8a5a34", wine="#7c2230",
                            soup="#e8794a")


def steel(ic):
    return ic.grad("#ffffff", (0.4, ic.p["steel"]), (1, ic.p["steel_lo"]))


def smoke(ic, x, y, s=1.0, op=85):
    """A toon wisp of smoke: two puffs and a curl."""
    p = ic.p
    ic.line(curve([(x, y + 4 * s), (x + 3 * s, y), (x - 1 * s, y - 5 * s), (x + 2.6 * s, y - 10 * s)], closed=False),
            ic.grad("#e8e2da", (1, "#8a8580")), 3.4 * s, ink_w=5.6 * s)
    ic.shape(blob_d((x + 2.6 * s, y - 11 * s), 2.6 * s, n=4, wobble=0.2, ry=2.2 * s), ic.grad("#f2ece4", (1, "#9a948e")),
             shadow=False, ink_w=2.0)


def cleaver(ic, c, ang, s=1.0):
    """The great cleaver: a broad blade with an ember edge, a hole near the spine, a dark wooden grip."""
    p = ic.p
    blade = [(-11, -8), (11, -8), (12.5, 7), (-11, 7)]
    ic.shape(poly(place([(x * s, y * s) for x, y in blade], ang, c)), steel(ic))
    edge = place([(-10.6 * s, 6.2 * s), (12.2 * s, 6.2 * s)], ang, c)
    ic.line(poly(edge, closed=False), ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"])), 2.2, ink=False)
    hx, hy = place([(7.5 * s, -4 * s)], ang, c)[0]
    dot(ic, hx, hy, 1.6 * s, p["dark"])
    spine = place([(-10.6 * s, -7.3 * s), (10.6 * s, -7.3 * s)], ang, c)
    ic.line(poly(spine, closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.2, ink=False)
    grip = place([(-11 * s, -3.2 * s), (-22 * s, -3.6 * s), (-22 * s, 2.4 * s), (-11 * s, 2.2 * s)], ang, c)
    ic.shape(poly(grip), ic.grad("#b07a4a", (1, "#4a2a18")), shadow=False, ink_w=3)
    for u in (-13.5, -19.5):
        a, b = place([(u * s, -3.4 * s), (u * s, 2.3 * s)], ang, c)
        ic.line(poly([a, b], closed=False), GOLD[1], 1.1, ink=False)


def cle_q(ic):
    """Thrown Cleaver: the great cleaver spins through the air and sticks where it stops."""
    p = ic.p
    for r, a0, a1 in ((21, 150, 250), (21, -30, 70)):
        swoosh(ic, (33, 30), r, a0, a1, 4.0, (p["core"], (0.5, p["hot"]), (1, p["body"])), head=0.55, ink_w=2.4)
    cleaver(ic, (35, 29), -32, 1.08)
    streaks(ic, [(5, 14, 12, 18), (8, 9, 14, 12)], color=p["hot"], weight=1.8)


def cauldron(ic, c, ang):
    p = ic.p
    body = [(-12, -6), (12, -6), (11, 2), (7, 8.5), (-7, 8.5), (-11, 2)]
    ic.shape(curve(place(body, ang, c), sharp=(0, 1), k=0.6), ic.grad("#6a6460", (0.5, p["char"]), (1, "#0e0c0c")))
    rim = place([(-13, -6.6), (13, -6.6)], ang, c)
    ic.line(poly(rim, closed=False), ic.grad(GOLD[0], (1, GOLD[2])), 2.6, ink_w=5)
    for side in (-1, 1):
        hx, hy = place([(side * 13.5, -2)], ang, c)[0]
        e = ic.add("shape.ellipse", x=hx - 2.2, y=hy - 2.2, width=4.4, height=4.4)
        ic.paint(ic.id(e), fill="none", stroke=p["dark"], weight=3.4)
        e2 = ic.add("shape.ellipse", x=hx - 2.2, y=hy - 2.2, width=4.4, height=4.4)
        ic.paint(ic.id(e2), fill="none", stroke=GOLD[1], weight=1.4)


def cle_w(ic):
    """Hot Soup: a huge pot drops and tips over, scalding everything round it."""
    p = ic.p
    ring(ic, 34, 50, 19, 4.6, ic.grad(p["hot"], (1, p["body"])), w=2.2)
    spill = curve([(30, 26), (42, 30), (52, 40), (55, 49), (44, 53), (31, 51), (22, 48), (27, 40)], k=0.8)
    ic.shape(spill, ic.grad("#ffd27a", (0.4, p["soup"]), (1, p["body"])), ink_w=3.6)
    for x, y, r in ((40, 45, 1.6), (47, 49, 1.2), (34, 47.5, 1.1)):
        dot(ic, x, y, r, p["core"], opacity=80)
    cauldron(ic, (26, 25), -40)
    for x in (43, 50):
        ic.line(curve([(x, 28), (x + 2.5, 23), (x - 1, 18), (x + 1.5, 13)], closed=False), p["core"], 1.6, ink=False,
                opacity=75)


def cle_e(ic):
    """Burnt Offering: a dish burnt black, still smoking: whoever walks over it is struck still."""
    p = ic.p
    plate = ic.add("shape.ellipse", x=10, y=34, width=44, height=16)
    ic.solid(ic.id(plate), ic.grad("#ffffff", (0.5, "#d8d4c8"), (1, "#8a857a")), ink_w=4.4)
    e = ic.add("shape.ellipse", x=13, y=35.6, width=38, height=12.4)
    ic.paint(ic.id(e), fill="none", stroke=ic.grad(GOLD[0], (1, GOLD[1])), weight=1.2)
    lump = [(19, 41), (21, 33), (27, 29), (35, 28), (42, 31.5), (45.5, 38), (41, 43), (29, 44)]
    ic.shape(curve(lump, k=0.75), ic.grad("#4a403a", (0.5, p["char"]), (1, "#000000")))
    for x, y in ((27, 35), (36, 33), (33, 39)):
        dot(ic, x, y, 1.4, p["hot"])
        glow(ic, x, y, 3.4, p["body"], opacity=80)
    smoke(ic, 25, 22, 1.2)
    smoke(ic, 38, 20, 1.45)


def cle_r(ic):
    """Dinner Is Served: a long table rises before her, three dishes on it: cover, and a feast."""
    p = ic.p
    top = poly([(8, 34), (48, 26), (58, 32), (18, 41)])
    ic.shape(top, ic.grad("#c8905a", (0.5, p["wood"]), (1, "#4a2a18")))
    front = poly([(8, 34), (18, 41), (18, 46), (8, 39)])
    ic.shape(front, ic.grad(p["wine"], (1, "#3a0e16")), shadow=False, ink_w=3)
    side = poly([(18, 41), (58, 32), (58, 37), (18, 46)])
    ic.shape(side, ic.grad(p["body"], (1, p["wine"])), shadow=False, ink_w=3)
    ic.line(poly([(18, 41), (58, 32)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.3, ink=False)
    for x, y, s in ((20, 33.5, 0.8), (33, 30.5, 1.0), (46, 27.5, 0.8)):
        cl = curve([(x - 5.5 * s, y), (x - 4.6 * s, y - 4.8 * s), (x, y - 6.6 * s), (x + 4.6 * s, y - 4.8 * s), (x + 5.5 * s, y)],
                   sharp=(0, 4))
        ic.shape(cl, steel(ic), shadow=False, ink_w=2.6)
        dot(ic, x, y - 7.2 * s, 1.1 * s, GOLD[1])
    glow(ic, 33, 23, 9, p["hot"], opacity=45)
    for x in (27, 33, 39):
        ic.line(curve([(x, 20), (x + 1.6, 16), (x - 0.8, 12)], closed=False), p["core"], 1.3, ink=False, opacity=65)
    chevron(ic, (33, 51), -90, 4.0, p["hot"], 2.4)


ICONS = {"q": cle_q, "w": cle_w, "e": cle_e, "r": cle_r}
