"""Grandma Ironknit the Weaver (src/kits/yarn.ts): an old fate-spinner of the Briarkin's Spindle court: needles as long as
swords, glowing rose yarn, a knit that binds, and Mr. Biscuit, the grey cat who comes out of the wool."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Spindle / rose" (Grandma Ironknit; src/kits/yarn.ts S): rose yarn's ladder, the court's silver accent.
PAL["grandma-ironknit"] = row("#fff0f6", "#ff9cc4", "#e86a9a", "#c8c6d8", "#1e0c18",
                              wine="#7a2a4c", shade="#a73b69", spool="#ff5a8a", silver="#a8a6b4", cream="#f2e6d0",
                              grey="#9a9aa6")


def yarn(ic):
    p = ic.p
    return ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"]))


def silver(ic):
    return ic.grad("#ffffff", (0.45, "#c8c6d8"), (1, "#6a6878"))


def needle(ic, eye, tip, w=2.2):
    """A knitting needle as long as a sword: silver, a pearl at the head."""
    p = ic.p
    ang = math.degrees(math.atan2(tip[1] - eye[1], tip[0] - eye[0]))
    L = math.dist(eye, tip)
    ic.shape(poly(place([(0, -w), (0.86 * L, -w * 0.7), (L, 0), (0.86 * L, w * 0.7), (0, w)], ang, eye)), silver(ic),
             ink_w=3)
    disc(ic, eye[0], eye[1], w * 1.5, ic.grad(p["core"], (0.5, p["hot"]), (1, p["shade"])), shadow=False, ink_w=2.6)


def ball(ic, c, r):
    """A ball of rose wool, its strands wound across it."""
    p = ic.p
    glow(ic, c[0], c[1], r * 1.6, p["spool"], opacity=55)
    disc(ic, c[0], c[1], r, ic.grad(p["core"], (0.35, p["hot"]), (0.8, p["body"]), (1, p["shade"])), ink_w=4.4)
    for a, k in ((-30, 0.55), (20, 0.75), (70, 0.4)):
        e = ic.add("shape.ellipse", x=c[0] - r * 0.92, y=c[1] - r * k, width=r * 1.84, height=r * 2 * k, rotation=a)
        ic.paint(ic.id(e), fill="none", stroke=p["shade"], weight=0.9)


def gra_q(ic):
    """Knitting Needle: a needle long as a sword thrown point first, a strand of rose yarn trailing."""
    p = ic.p
    ic.line(curve([(6, 40), (13, 27), (18, 33), (25, 22)], closed=False), yarn(ic), 2.2, ink_w=4.4)
    needle(ic, (21, 26), (54, 13), 2.8)
    for y in (22, 29):
        ic.line(poly([(30, y), (38, y - 3.2)], closed=False), p["core"], 1.6, ink=False, opacity=80)


def gra_w(ic):
    """Cast On: a line of yarn tied from her to the cover: walk across it and you are caught."""
    p = ic.p
    # The cover: a standing stone at the right; the line runs to it from a needle stuck in the floor.
    ic.shape(poly([(46, 52), (45, 22), (52, 16), (58, 21), (57, 52)]), ic.grad("#b8b4c4", (0.5, "#6a6478"), (1, "#2c2834")))
    needle(ic, (12, 18), (19, 47), 2.0)
    glow(ic, 32, 29, 14, p["spool"], opacity=55, ry=6)
    line = curve([(16, 26), (32, 30.5), (47, 28)], closed=False)
    ic.line(line, yarn(ic), 2.6, ink_w=5)
    ic.line(curve([(16.5, 27.2), (32, 31.6), (46.5, 29.2)], closed=False), p["shade"], 0.8, ink=False, dash=[1.2, 1.2])
    disc(ic, 32, 30.5, 3.0, yarn(ic), shadow=False, ink_w=2.6)
    for x in (26, 38):
        chevron(ic, (x, 41), 90, 2.6, p["hot"], 1.8)
        ic.line(poly([(x, 35.5), (x, 40)], closed=False), p["hot"], 1.8)


def gra_e(ic):
    """Sweater: a knit thrown over you that shrinks: slowed, then squeezed."""
    p = ic.p
    knit = curve([(12, 20), (32, 12), (52, 20), (53.5, 31), (51, 45), (44.5, 41.5), (38, 46), (32, 42.5), (26, 46), (19.5, 41.5), (13, 45), (10.5, 31)], sharp=(0, 2, 4, 5, 6, 7, 8, 9, 10), k=0.6)
    ic.shape(knit, ic.grad(p["hot"], (0.5, p["body"]), (1, p["wine"])))
    for row_y in (22, 29, 36):
        for k in range(-3, 4):
            x = 32 + k * 6
            if abs(x - 32) > 17:
                continue
            ic.line(poly([(x - 2.2, row_y - 2.2), (x, row_y + 1.2), (x + 2.2, row_y - 2.2)], closed=False), p["shade"],
                    1.2, ink=False)
    ic.line(curve([(14.5, 21.5), (32, 15), (49.5, 21.5)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.2, ink=False)
    for x, ang in ((8, 0), (56, 180)):
        chevron(ic, (x + (3 if ang == 0 else -3), 32), ang, 3.4, p["core"], 2.4)


def gra_r(ic):
    """Mr. Biscuit: a big grey cat springs out of a ball of wool and comes for you."""
    p = ic.p
    ball(ic, (45, 44), 10)
    ic.line(curve([(44, 34), (40, 31), (37, 34)], closed=False), yarn(ic), 1.8, ink_w=3.6)
    pts = [(18, 0), (17, -3), (15.5, -4), (15, -8.5), (12.5, -4.6), (9, -4.2), (0, -3.5), (-8, -4.5), (-12, -3), (-16, -5),
           (-22, -9), (-25, -8), (-21, -6.5), (-15, -1.5), (-13, 1), (-19, 6), (-18, 7.5), (-10, 3.4), (0, 2.8), (8, 2.4),
           (14, 6), (16, 5.4), (12.5, 1.6), (16, 1.5)]
    s, c, ang = 1.15, (27, 27), 28
    mirrored = [(-x * s, y * s) for x, y in pts]
    ic.shape(curve(place(mirrored, ang, c), sharp=(3, 11, 16, 21), k=0.45), ic.grad("#f0f0f4", (0.45, p["grey"]), (1, "#3e3e4a")))
    ex, ey = place([(-14.2 * s, -1.6 * s)], ang, c)[0]
    dot(ic, ex, ey, 0.9, "#ffd85a")
    for u in (2, -4):
        a2, b2 = place([(u * s, -3.4 * s), ((u - 1) * s, 0.5 * s)], ang, c)
        ic.line(poly([a2, b2], closed=False), "#5a5a66", 1.0, ink=False)

ICONS = {"q": gra_q, "w": gra_w, "e": gra_e, "r": gra_r}
