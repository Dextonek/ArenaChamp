"""Gus the Temple Keeper (src/kits/janitor.ts): the keeper of a temple's floors: a ritual sweeping staff with paper
streamers, a bronze water urn, a standing ward of paper, and the temple's water, which he walks on."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Temple water" (Gus; src/kits/janitor.ts S): foam, pale water, water, the ward's yellow, the deep.
PAL["gus"] = row("#f2f6f8", "#c4e4f2", "#74c0ea", "#ffd23a", "#0f1a24",
                 deep="#3a6a8a", bronze="#c08a4a", bronze_lo="#6a4a28", haft="#6a4a30", straw="#d8c48a",
                 paper="#f6f0dc")


def water(ic):
    p = ic.p
    return ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"]))


def streamer(ic, top, ang=0, s=1.0):
    pts = [(0, 0), (1.8, 0), (1.8, 2.6), (0.4, 2.6), (0.4, 5.2), (-1.2, 5.2), (-1.2, 8), (-2.8, 8), (-2.8, 5.8),
           (-1.2, 5.8), (-1.2, 3.2), (0, 3.2)]
    ic.shape(poly(place([(x * s, y * s) for x, y in pts], ang, top)), ic.grad(ic.p["paper"], (1, "#c8c0a8")),
             shadow=False, ink_w=2.0)


def gus_q(ic):
    """Big Mop: a sweep of the temple broom: a swipe in front of him that leaves a strip of wet floor."""
    p = ic.p
    swoosh(ic, (30, 26), 22, 165, 25, 7.5, (p["core"], (0.5, p["hot"]), (1, p["body"])), ry=18, head=0.55)
    # The staff, then the broom's head: a fan of straw bound with a bronze collar.
    ic.line(poly([(50, 51), (24, 19)], closed=False), ic.grad("#9a7a5a", (1, p["haft"])), 3.2, ink_w=6)
    head = [(25.5, 21.5), (21, 17), (8, 9), (10, 15.5), (12.5, 22), (15, 26), (21.5, 24.5)]
    ic.shape(curve(head, sharp=(0, 6), k=0.6), ic.grad("#fff0c0", (0.5, p["straw"]), (1, "#8a7440")))
    for a, b in (((20.5, 21.5), (11, 13.5)), ((21.5, 23), (13.2, 20)), ((19.5, 19.8), (11.5, 10.5))):
        ic.line(poly([a, b], closed=False), "#8a7440", 0.9, ink=False)
    collar = ic.add("shape.rectangle", x=21.5, y=17.6, width=6, height=6, radius=1.2, rotation=-49)
    ic.solid(ic.id(collar), ic.grad(GOLD[0], (0.5, p["bronze"]), (1, p["bronze_lo"])), shadow=False, ink_w=2.4)
    streamer(ic, (38, 36), ang=-20, s=1.0)
    for x, y in ((44, 13), (51.5, 21)):
        dot(ic, x, y, 1.6, p["hot"])


def gus_w(ic):
    """Wet Floor Sign: a standing ward of wood and paper, set on the wet floor: slide into it and you stop."""
    p = ic.p
    puddle = ic.add("shape.ellipse", x=12, y=44, width=42, height=9)
    ic.paint(ic.id(puddle), fill=ic.grad((0, p["hot"], 0.85), (1, p["body"], 0.6)), stroke="none")
    ring(ic, 33, 48.5, 21, 4.5, p["core"], w=1.4)
    # The frame: two legs and a crossbar of dark wood, the paper ward hung in it.
    for a, b in (((22, 49), (29.5, 10)), ((44, 49), (36.5, 10))):
        ic.line(poly([a, b], closed=False), ic.grad("#9a7a5a", (1, p["haft"])), 3.2, ink_w=6)
    ic.line(poly([(27.5, 11.5), (38.5, 11.5)], closed=False), ic.grad(GOLD[0], (1, p["bronze"])), 2.6, ink_w=5)
    ward = poly([(25, 14), (41, 14), (42.5, 40), (23.5, 40)])
    ic.shape(ward, ic.grad("#fff3a8", (0.45, p["accent"]), (1, "#b88a10")))
    drop = curve([(33, 18.5), (37.6, 27.5), (36.8, 32), (33, 34), (29.2, 32), (28.4, 27.5)], sharp=(0,), k=0.7)
    ic.shape(drop, ic.grad(p["core"], (0.45, p["body"]), (1, p["deep"])), shadow=False, ink_w=2.6)
    ic.line(poly([(25.5, 37.5), (40.5, 37.5)], closed=False), p["haft"], 1.1, ink=False)


def gus_e(ic):
    """Mop Bucket: the bronze water urn thrown end over end; where it stops, the floor is wet."""
    p = ic.p
    for r in (18, 24):
        ic.line(poly(arc_pts((30, 34), r, 200, 250, 6), closed=False), p["core"], 2.0)
    c, ang = (29, 30), 34
    body = [(-8, -6), (-6.5, -10), (6.5, -10), (8, -6), (10, 2), (8, 9), (4, 12), (-4, 12), (-8, 9), (-10, 2)]
    body = [(y, x) for x, y in body]  # the urn lies along the throw, its mouth toward the upper right
    ic.shape(curve(place([(-x, y) for x, y in body], ang - 180, c), sharp=(1, 2), k=0.6),
             ic.grad("#f0c890", (0.4, p["bronze"]), (1, p["bronze_lo"])))
    for u in (-2, 5):
        a, b = place([(u, -9.6), (u, 9.6)], ang + 90, c)
        ic.line(poly([a, b], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.3, ink=False)
    mouth = place([(11.5, 0)], ang, c)[0]
    m = ic.add("shape.ellipse", x=mouth[0] - 2.8, y=mouth[1] - 7.2, width=5.6, height=14.4, rotation=ang)
    ic.solid(ic.id(m), ic.grad(p["deep"], (1, "#081018")), shadow=False, ink_w=2.6)
    swoosh(ic, (mouth[0] - 4, mouth[1] + 14), 14, -95, -5, 6.0, (p["core"], (0.5, p["hot"]), (1, p["body"])), head=0.6)
    for x, y, r in ((53, 31, 2.0), (49, 37.5, 1.6), (55.5, 22, 1.4)):
        disc(ic, x, y, r, water(ic), shadow=False, ink_w=2.0)


def gus_r(ic):
    """Flood: the temple's water rises over the whole floor round him, and he rides its wave."""
    p = ic.p
    # The floor of water, inside the medallion (its lower corners, 27.6 from the centre).
    o = [(32 + 27.6 * math.cos(math.radians(a)), 32 + 27.6 * math.sin(math.radians(a))) for a in (22.5, 67.5, 112.5, 157.5)]
    sea = curve([(o[3][0] + 0.4, 43), (16, 40), (28, 44), (40, 40), (52, 44), (o[0][0] - 0.4, 41.5)] + o, sharp=(0, 5, 6, 7, 8, 9), k=0.8)
    s = ic.add("path.create", d=sea)
    ic.paint(ic.id(s), fill=ic.grad(p["body"], (1, p["deep"]), angle=-90), stroke="none")
    wave = [(14, 50), (16, 36), (24, 22), (36, 13), (48, 13), (55, 19), (54.5, 27), (48.5, 24), (43, 25.5), (46, 31),
            (40.5, 29), (34, 33), (31, 42), (34, 50)]
    ic.shape(curve(wave, sharp=(0, 13), k=0.7), ic.grad(p["core"], (0.25, p["hot"]), (0.6, p["body"]), (1, p["deep"])))
    foam = [(36, 13.2), (48, 13), (55, 19), (54.5, 27), (48.5, 24), (51, 21), (47, 17.5), (40, 17), (31, 21)]
    ic.shape(curve(foam, sharp=(4,), k=0.7), ic.grad(p["core"], (1, p["hot"])), shadow=False, ink_w=2.4)
    for a, b in (((22, 40), (28, 27)), ((27.5, 44), (32, 34))):
        ic.line(poly([a, b], closed=False), p["core"], 1.4, ink=False, opacity=75)
    chevron(ic, (56, 37), 0, 3.4, p["accent"], 2.4)
    chevron(ic, (51, 37), 0, 3.4, p["accent"], 2.4)


ICONS = {"q": gus_q, "w": gus_w, "e": gus_e, "r": gus_r}
