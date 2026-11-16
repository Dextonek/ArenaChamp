"""Silvane the Mirror Duchess (src/kits/mirror.ts): a duchess of the Gloaming in violet and silver, a fan collar of mirror
shards, hand mirrors whose glass glows pale blue; mirrors that bounce what is thrown at them."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Mirror" (Silvane; src/kits/mirror.ts S): the glass's pale blue ladder, violet as the accent, silver foils.
PAL["silvane"] = row("#ffffff", "#f4f9ff", "#cfe6ff", "#d9b8ff", "#121a2e",
                     silver="#c6cedb", shade="#8fa8cc", steel="#7d8aa0", glass="#5a4a98", gown="#34285c")
PAL["silvane"].update(lit="#2c2a52", mid="#191a32")


def glass(ic):
    p = ic.p
    return ic.grad("#ffffff", (0.3, p["body"]), (0.75, p["shade"]), (1, p["glass"]))


def hand_mirror(ic, c, ang, s=1.0):
    """A hand mirror: an oval of glass in a silver frame with gold beads, a handle."""
    p = ic.p
    a, b = place([(0, 9 * s), (0, 19 * s)], ang, c)
    ic.line(poly([a, b], closed=False), ic.grad("#ffffff", (1, p["steel"])), 2.6 * s, ink_w=5 * s)
    dot(ic, b[0], b[1], 1.8 * s, GOLD[1])
    fr = ic.add("shape.ellipse", x=c[0] - 7.5 * s, y=c[1] - 10 * s, width=15 * s, height=20 * s, rotation=ang)
    ic.solid(ic.id(fr), ic.grad("#ffffff", (0.5, p["silver"]), (1, p["steel"])), ink_w=3.4)
    gl = ic.add("shape.ellipse", x=c[0] - 5.6 * s, y=c[1] - 8 * s, width=11.2 * s, height=16 * s, rotation=ang)
    ic.paint(ic.id(gl), fill=glass(ic), stroke="none")
    hl = place([(-2.6 * s, -4 * s), (1 * s, -6 * s)], ang, c)
    ic.line(poly(hl, closed=False), "#ffffff", 1.4 * s, ink=False)
    top = place([(0, -10 * s)], ang, c)[0]
    dot(ic, top[0], top[1], 1.4 * s, GOLD[0])


def sil_q(ic):
    """Hand Mirror: a spinning hand mirror, stronger with every bounce; catch it and it is ready again."""
    p = ic.p
    ic.line(poly([(8, 44), (22, 14), (40, 40), (55, 18)], closed=False), p["accent"], 1.6, ink=False, dash=[2.4, 2.2])
    for x, y in ((22, 14), (40, 40)):
        star(ic, x, y, 4.6, 1.2, p["core"], points=4, ink_w=0)
    for r in (13,):
        ic.line(poly(arc_pts((43, 22), r, 150, 230, 6), closed=False), p["core"], 1.6, ink=False)
    hand_mirror(ic, (45, 22), 35, 0.95)


def sil_w(ic):
    """Vanity Stand: a standing mirror at the spot: a wall, and her mirrors bounce off it."""
    p = ic.p
    for a, b in (((24, 54), (30, 42)), ((40, 54), (34, 42))):
        ic.line(poly([a, b], closed=False), ic.grad(GOLD[0], (1, GOLD[2])), 2.2, ink_w=4.6)
    fr = ic.add("shape.ellipse", x=19, y=6, width=26, height=38)
    ic.solid(ic.id(fr), ic.grad("#ffffff", (0.5, p["silver"]), (1, p["steel"])), ink_w=4.4)
    gl = ic.add("shape.ellipse", x=22.5, y=9.5, width=19, height=31)
    ic.paint(ic.id(gl), fill=glass(ic), stroke="none")
    e = ic.add("shape.ellipse", x=19.8, y=6.8, width=24.4, height=36.4)
    ic.paint(ic.id(e), fill="none", stroke=ic.grad(GOLD[0], (0.5, GOLD[1]), (1, GOLD[2])), weight=1.2)
    ic.line(poly([(26, 16), (31, 12)], closed=False), "#ffffff", 1.8, ink=False)
    ic.line(poly([(26, 22), (34, 15)], closed=False), "#ffffff", 1.0, ink=False, opacity=70)
    for side in (-1, 1):
        x = 32 + side * 19
        ic.line(poly([(x, 20), (x - side * 5, 24), (x, 28)], closed=False), p["accent"], 1.8)


def sil_e(ic):
    """Through the Glass: she steps into her mirror and out of its far side."""
    p = ic.p
    fr = ic.add("shape.ellipse", x=24, y=8, width=16, height=40, rotation=0)
    ic.solid(ic.id(fr), ic.grad("#ffffff", (0.5, p["silver"]), (1, p["steel"])), ink_w=4)
    gl = ic.add("shape.ellipse", x=26.5, y=10.5, width=11, height=35)
    ic.paint(ic.id(gl), fill=glass(ic), stroke="none")
    streaks(ic, [(6, 24, 22, 24), (8, 32, 22, 32)], color=p["core"], weight=2.0)
    m = ic.mark()
    streaks(ic, [(42, 24, 52, 24), (42, 32, 54, 32)], color=p["accent"], weight=2.0)
    chevron(ic, (58, 28), 0, 4, p["accent"], 2.6)
    for x, y, a in ((46, 14, 30), (49, 42, -20)):
        shard(ic, (x, y), a, 6, 1.6, glass(ic), back=0.4, shadow=False, ink_w=2)


def sil_r(ic):
    """Hall of Mirrors: she spins and throws eight mirrors out in a ring."""
    p = ic.p
    ring(ic, 32, 32, 9, 9, p["accent"], w=1.8)
    star(ic, 32, 32, 6, 2, p["core"], points=4, ink_w=0)
    for k in range(8):
        a = k * 45 - 90
        x, y = 32 + 21 * math.cos(math.radians(a)), 32 + 21 * math.sin(math.radians(a))
        ic.line(poly([(32 + 11 * math.cos(math.radians(a)), 32 + 11 * math.sin(math.radians(a))),
                      (32 + 16 * math.cos(math.radians(a)), 32 + 16 * math.sin(math.radians(a)))], closed=False),
                p["core"], 1.4, ink=False)
        fr = ic.add("shape.ellipse", x=x - 3.6, y=y - 5, width=7.2, height=10, rotation=a + 90)
        ic.solid(ic.id(fr), ic.grad("#ffffff", (0.5, p["silver"]), (1, p["steel"])), shadow=False, ink_w=2.6)
        gl = ic.add("shape.ellipse", x=x - 2.4, y=y - 3.6, width=4.8, height=7.2, rotation=a + 90)
        ic.paint(ic.id(gl), fill=glass(ic), stroke="none")


ICONS = {"q": sil_q, "w": sil_w, "e": sil_e, "r": sil_r}
