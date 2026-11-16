"""Barry Cloudsley the Sky Augur (src/kits/weather.ts): a seer of the sky in a storm-slate coat with a mantle of cloud:
fronts, clouds, lightning, a tornado, and the augur's forecast that turns the weather."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Augury" (Barry Cloudsley; src/kits/weather.ts S): cloud white, sky blue, the sun's yellow as the accent.
PAL["barry-cloudsley"] = row("#ffffff", "#e4edf8", "#6ac8ff", "#f4e65a", "#16233b",
                             storm="#4a5870", deep="#2f5ea8", slate="#303c54", grey="#7b8aa2")


def cloud(ic, c, w, h, fill=None, ink_w=4.2):
    """A cloud: three domes on a flat base."""
    p = ic.p
    x, y = c
    d = (f"M{f(x - w / 2)} {f(y)} C{f(x - w / 2)} {f(y - h * 0.5)} {f(x - w * 0.3)} {f(y - h * 0.62)} {f(x - w * 0.18)} {f(y - h * 0.55)} "
         f"C{f(x - w * 0.12)} {f(y - h * 1.05)} {f(x + w * 0.2)} {f(y - h * 1.1)} {f(x + w * 0.24)} {f(y - h * 0.65)} "
         f"C{f(x + w * 0.42)} {f(y - h * 0.8)} {f(x + w / 2)} {f(y - h * 0.35)} {f(x + w / 2)} {f(y)} Z")
    return ic.shape(d, fill or ic.grad(p["core"], (0.5, p["hot"]), (1, p["grey"])), ink_w=ink_w)


def bolt(ic, top, s=1.0, fill=None):
    p = ic.p
    pts = [(0, 0), (6, 0), (2.5, 7), (7, 7), (-3.5, 21), (-0.5, 10.5), (-5, 10.5)]
    ic.shape(poly([(top[0] + x * s, top[1] + y * s) for x, y in pts]), fill or ic.grad("#ffffff", (0.4, p["accent"]), (1, "#d8a820")),
             ink_w=3.2)


def bar_q(ic):
    """Cold Front: a gust from the front's edge: it hits, and in Rain it slows."""
    p = ic.p
    for r, w, a in ((11, 4.0, 46), (17, 3.8, 44), (23, 3.2, 40)):
        swoosh(ic, (24, 31), r, -a, a, w, (p["core"], (0.5, p["hot"]), (1, p["body"])), head=0.5, ink_w=2.6)
    # The cold front itself: a curved line with its teeth, as the augur's charts draw it.
    front = [(15, 7), (12, 18), (12, 31), (15, 42)]
    ic.line(curve(front, closed=False), ic.grad(p["body"], (1, p["deep"])), 2.6, ink_w=4.8)
    for t in (0.18, 0.5, 0.82):
        y = 7 + 35 * t
        x = 12 + 3 * abs(t - 0.5) * 2 + 0.4
        tri = [(x, y - 3.4), (x + 6, y), (x, y + 3.4)]
        ic.shape(poly(tri), ic.grad(p["hot"], (1, p["body"])), shadow=False, ink_w=2.4)


def bar_w(ic):
    """Lightning Risk: a cloud marks the spot; a moment later lightning strikes it."""
    p = ic.p
    ring(ic, 34, 50, 13, 3.6, p["accent"], w=2.0)
    star(ic, 34, 49.5, 8, 1.6, p["accent"], points=4, ink_w=0)
    cloud(ic, (32, 23), 38, 15, ic.grad("#c8d4e6", (0.5, p["grey"]), (1, p["slate"])))
    bolt(ic, (32, 25), 1.15)


def bar_e(ic):
    """Forecast Update: the augur turns the forecast: sun to rain, rain to wind."""
    p = ic.p
    disc(ic, 32, 31, 20, ic.grad(p["slate"], (1, "#0c1424")), ink_w=4.6)
    e = ic.add("shape.ellipse", x=12, y=11, width=40, height=40)
    ic.paint(ic.id(e), fill="none", stroke=ic.grad(GOLD[0], (0.4, GOLD[1]), (1, GOLD[2])), weight=1.6)
    star(ic, 24, 24, 9, 4.5, ic.grad("#fffbe0", (0.5, p["accent"]), (1, "#d8a820")), points=8, ink_w=2.4)
    cloud(ic, (40, 42), 18, 8, ink_w=3.2)
    for x in (36, 41):
        ic.line(poly([(x, 44.5), (x - 1.2, 48)], closed=False), p["body"], 1.4, ink=False)
    for a0 in (-30, 150):
        a1 = a0 + 70
        ic.line(poly(arc_pts((32, 31), 25, a0, a1, 8), closed=False), p["core"], 2.2)
        tip = (32 + 25 * math.cos(math.radians(a1)), 31 + 25 * math.sin(math.radians(a1)))
        chevron(ic, tip, a1 + 90, 3.2, p["core"], 2.2)


def bar_r(ic):
    """Severe Warning: a tornado walks at you for four seconds."""
    p = ic.p
    cloud(ic, (33, 15), 42, 10, ic.grad("#c8d4e6", (0.5, p["grey"]), (1, p["slate"])))
    bands = [(33, 18, 15), (35, 26, 12), (37, 33, 9), (38, 39.5, 6.5), (37, 45, 4)]
    for x, y, r in bands:
        swoosh(ic, (x, y), r, 160, 380, 4.2, (p["core"], (0.5, p["hot"]), (1, p["body"])), ry=r * 0.32, head=0.6,
               ink_w=2.6)
    ring(ic, 36, 51, 10, 2.8, p["hot"], w=1.6)
    for x, y in ((51, 44), (55, 38)):
        ic.shape(poly(place([(-1.6, -1), (1.4, -1.6), (1.8, 1), (-1, 1.6)], x * 9, (x, y))), p["grey"], shadow=False,
                 ink_w=2)
    chevron(ic, (56, 51), 0, 3.0, p["accent"], 2.2)


ICONS = {"q": bar_q, "w": bar_w, "e": bar_e, "r": bar_r}
