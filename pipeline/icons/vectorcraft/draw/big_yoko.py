"""Big Yoko the Mountain (src/kits/sumo.ts): a ceremonial wrestler at a shrine: the straw rope of his ring, zigzag paper
charms, sacred salt, crimson lacquer; and the Mountain himself."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Ring / shrine" (Big Yoko; src/kits/sumo.ts): rice-paper white, warm peach, his crimson, straw-rope gold.
PAL["big-yoko"] = row("#fff8ea", "#ffc9a0", "#e63a3a", "#d2ac5a", "#1e1412",
                      skin="#e6b08a", skin_shade="#a8694a", rope="#d2ac5a", rope_dark="#8a6a2c", lacquer="#7a1a22",
                      paper="#fffaf0", sand="#dcc58f")


def shide(ic, top, s=1.0, ang=0):
    """A zigzag paper charm hanging from the rope."""
    pts = [(0, 0), (2.4, 0), (2.4, 3), (0.6, 3), (0.6, 6), (-1.4, 6), (-1.4, 9.4), (-3.2, 9.4), (-3.2, 6.6),
           (-1.4, 6.6), (-1.4, 3.6), (0.2, 3.6), (0.2, 0.6), (0, 0.6)]
    pts = [(x * s, y * s) for x, y in pts]
    ic.shape(poly(place(pts, ang, top)), ic.grad(ic.p["paper"], (1, "#d8d0c0")), shadow=False, ink_w=2.2)


def rope_ring(ic, cx, cy, rx, ry, w=3.2):
    """The straw rope of his ring: a thick rope line with its twist in darker straw."""
    p = ic.p
    ring(ic, cx, cy, rx, ry, ic.grad(p["paper"], (0.3, p["rope"]), (1, p["rope_dark"])), w=w)
    e = ic.add("shape.ellipse", x=cx - rx, y=cy - ry, width=2 * rx, height=2 * ry)
    ic.paint(ic.id(e), fill="none", stroke=p["rope_dark"], weight=w * 0.9, dash=[0.9, 1.9])


def palm(ic, at, ang, sc=1.0):
    """His open palm, thrust: broad and heavy, the wrist bound in crimson."""
    p = ic.p
    parts = [(0, 2.6, 13, 12, 4.6, 0), (-4.7, -6.2, 3.7, 10.5, 1.85, -6), (-1.3, -7.2, 3.8, 12, 1.9, -1),
             (2.1, -6.7, 3.7, 11.2, 1.85, 4), (5.2, -4.6, 3.4, 8.6, 1.7, 11), (-8, 3.2, 3.8, 9, 1.9, -46),
             (0, 10, 10.4, 6.5, 1.2, 0)]
    ids = []
    for cx, cy, w, h, r, rr in parts:
        x, y = rot((cx * sc, cy * sc), math.radians(ang), at)
        ids.append(ic.id(ic.add("shape.rectangle", x=x - w * sc / 2, y=y - h * sc / 2, width=w * sc, height=h * sc,
                                radius=r * sc, rotation=rr + ang)))
    g = ic.add("object.pathfinder.unite", ids=ids)
    ic.solid(ic.ids(g), ic.grad("#f6d2b4", (0.55, p["skin"]), (1, p["skin_shade"])))
    x, y = rot((0, 13.6 * sc), math.radians(ang), at)
    w = ic.add("shape.rectangle", x=x - 6.4 * sc, y=y - 2.6 * sc, width=12.8 * sc, height=5.2 * sc, radius=1 * sc,
               rotation=ang)
    ic.solid(ic.id(w), ic.grad(p["body"], (1, p["lacquer"])), shadow=False, ink_w=2.6)
    a, b = rot((-6.2 * sc, 11 * sc), math.radians(ang), at), rot((6.2 * sc, 11 * sc), math.radians(ang), at)
    ic.line(poly([a, b], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.2, ink=False)


def yoko_q(ic):
    """Palm Strike: the open palm slams forward; the blow's air rings out ahead of it."""
    p = ic.p
    for r, w in ((10, 4.2), (16, 3.8), (22, 3.0)):
        swoosh(ic, (31, 30), r, -58, 58, w, (p["core"], (0.6, p["hot"]), (1, p["body"])), head=0.5, ink_w=2.6)
    streaks(ic, [(6, 22, 13, 22), (5, 31, 11, 31)], color=p["hot"], weight=2.0)
    palm(ic, (25, 31), 64, 1.15)


def yoko_w(ic):
    """Stomp: he stamps a new ring into the sand; the rope ring and its charms, the ground cracked and thrown up."""
    p = ic.p
    rope_ring(ic, 32, 45, 23, 7.5)
    for x, y in ((14, 41), (50, 41.5)):
        shide(ic, (x, y), 0.75)
    ring(ic, 32, 45, 12, 3.6, ic.grad(p["hot"], (1, p["body"])), w=2.2)
    for x, y, r in ((21, 41, 4.6), (43, 41.5, 5.0), (27, 38, 3.6), (37.5, 37.5, 4.0)):
        ic.shape(blob_d((x, y), r, n=5, wobble=0.2, ry=r * 0.7), ic.grad(p["paper"], (0.5, p["sand"]), (1, "#a08a5c")),
                 shadow=False, ink_w=2.6)
    star(ic, 32, 44, 13, 3.4, ic.grad(p["core"], (0.45, p["hot"]), (1, p["body"])), points=4, ink_w=3)
    star(ic, 32, 44, 8, 2.4, p["core"], points=4, rotation=45, ink_w=0)
    chevron(ic, (32, 27), 90, 6.4, ic.grad(p["hot"], (1, p["body"])), 3.8)
    chevron(ic, (32, 18), 90, 5.0, p["hot"], 3.0)

def mountain(ic, base_l, base_r, peak, fill):
    p = ic.p
    ic.shape(poly([base_l, (peak[0] - 4.5, peak[1] + 6), peak, (peak[0] + 3, peak[1] + 4.5), base_r]), fill)
    snow = [(peak[0] - 4.1, peak[1] + 5.6), peak, (peak[0] + 2.7, peak[1] + 4.2), (peak[0] + 1, peak[1] + 6.2),
            (peak[0] - 1.2, peak[1] + 5), (peak[0] - 2.6, peak[1] + 7.4)]
    ic.shape(poly(snow), ic.grad(p["paper"], (1, "#e8dccb")), shadow=False, ink_w=2.2)
    ic.line(poly([base_l, (peak[0] - 4.5, peak[1] + 6), peak], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.3,
            ink=False)


def yoko_e(ic):
    """Charge: the Mountain itself comes down the line, and whatever is in front is carried ahead of it."""
    p = ic.p
    streaks(ic, [(4, 22, 14, 22), (3, 30, 12, 30), (6, 38, 14, 38)], color=p["hot"], weight=2.2)
    mountain(ic, (14, 48), (54, 48), (38, 13), ic.grad(p["hot"], (0.35, p["body"]), (1, p["lacquer"])))
    mountain(ic, (14, 48), (36, 48), (24, 27), ic.grad(p["body"], (1, p["lacquer"])))
    rope = ic.add("path.create", d=poly([(15, 41), (53, 41)], closed=False))
    ic.paint(ic.id(rope), fill="none", stroke=p["dark"], weight=5.2, cap="round")
    rope2 = ic.add("path.create", d=poly([(15, 41), (53, 41)], closed=False))
    ic.paint(ic.id(rope2), fill="none", stroke=ic.grad(p["paper"], (0.3, p["rope"]), (1, p["rope_dark"])), weight=2.8,
             cap="round")
    shide(ic, (33, 42), 0.62)
    for x, ang, h in ((56, -40, 9), (58.5, -10, 7)):
        ic.shape(curve(place(tongue_pts(h, 4.4, lean=0.2), ang, (x - 4, 47))), ic.grad(p["paper"], (1, p["sand"])),
                 shadow=False, ink_w=2.6)


def yoko_r(ic):
    """Salt Throw: a fistful of the ring's salt thrown in a cone: it blinds, and the ring draws in."""
    p = ic.p
    cone = ic.add("path.create", d=curve([(15, 20), (54, 9), (57, 29), (52, 45), (15, 22)], sharp=(0, 4)))
    ic.paint(ic.id(cone), fill=ic.grad((0, p["paper"], 0.5), (1, p["paper"], 0), start=[15, 21], end=[56, 28]),
             stroke="none")
    grains = [(25, 18, 2.4), (31, 24, 3.2), (37, 15, 2.6), (40, 30, 3.6), (46, 21, 3.0), (50, 12, 2.2), (47, 37, 2.8),
              (53, 28, 2.4), (33, 33, 2.0), (28, 12, 1.8), (55, 19, 1.8), (43, 42, 2.0)]
    for x, y, r in grains:
        star(ic, x, y, r * 1.4, r * 0.55, ic.grad(p["paper"], (1, "#cfc6b6")), rotation=(x * 7) % 45, ink_w=2.0)
    for x, y, r in ((22, 22.5, 1.1), (36, 38, 1.2), (51, 6.5, 1.0), (57, 35, 1.0)):
        dot(ic, x, y, r, p["paper"])
    shide(ic, (11, 13), 1.05, ang=-18)


ICONS = {"q": yoko_q, "w": yoko_w, "e": yoko_e, "r": yoko_r}
