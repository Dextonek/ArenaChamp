"""Shiori the Last Brush (src/kits/ink.ts): ink on rice paper: brush strokes that stay on the floor, a red seal, and one
great character (an invented one: strokes, not a real word). The art bible's Ink row, rice paper as its foil."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["shiori"] = row("#ffffff", "#c8d4ff", "#3a5ae8", "#ff4a2a", "#0b0a0e", paper="#efe6d2", paper_lo="#b8ac90",
                    ink="#141428")


def ink(ic):
    p = ic.p
    return ic.grad("#5a7aff", (0.4, p["body"]), (1, p["ink"]))


def stroke(ic, c, r, a0, a1, w, ry=None, head=0.3):
    """A brush stroke: heavy where the brush lands, thinning to a dry tip."""
    s = ic.add("path.create", d=swoosh_d(c, r, a0, a1, w, ry=ry, head=head))
    return ic.solid(ic.id(s), ink(ic), shadow=False, ink_w=2.6)


def bar(ic, a, b, w):
    """A straight brush stroke from a to b, heavy at a."""
    ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    L = math.dist(a, b)
    pts = [(-w * 0.3, -w * 0.5), (0.2 * L, -w * 0.55), (L, -w * 0.15), (L + w * 0.2, 0), (L, w * 0.2), (0.2 * L, w * 0.5),
           (-w * 0.3, w * 0.5), (-w * 0.6, 0)]
    return ic.shape(curve(place(pts, ang, a), sharp=(3,), k=0.4), ink(ic), shadow=False, ink_w=2.6)


def shi_q(ic):
    """Ink Lash: a lash of ink; its stroke stays on the floor, and where strokes cross, they burst."""
    p = ic.p
    stroke(ic, (32, 60), 36, -150, -40, 8.5, ry=34)
    for x, y, r in ((54, 34, 2.2), (57, 40, 1.4), (50, 26, 1.4)):
        dot(ic, x, y, r, p["body"])
    star(ic, 32, 26, 5.6, 1.4, p["core"], points=4, ink_w=0)


def shi_w(ic):
    """Seal of Binding: she stamps a seal on the floor: step in and you are rooted and stained."""
    p = ic.p
    ring(ic, 32, 47, 21, 6, p["accent"], w=1.8, dash=[2.4, 2])
    sq = ic.add("shape.rectangle", x=17, y=12, width=30, height=30, radius=2.4, rotation=0)
    ic.solid(ic.id(sq), ic.grad("#ff8a6a", (0.45, p["accent"]), (1, "#8a1a10")), ink_w=4)
    inner = ic.add("shape.rectangle", x=20, y=15, width=24, height=24, radius=1.2)
    ic.paint(ic.id(inner), fill="none", stroke=p["paper"], weight=1.6)
    # An invented seal-script mark: a square spiral and a bar.
    ic.line(poly([(25, 20), (39, 20), (39, 34), (27, 34), (27, 24), (35, 24), (35, 30), (31, 30)], closed=False), p["paper"],
            1.8, ink=False, cap="butt")


def brush(ic, tip, ang, L=26):
    p = ic.p
    a, b = place([(6, 0), (L, 0)], ang, tip)
    ic.line(poly([a, b], closed=False), ic.grad("#e0c890", (1, "#7a5a30")), 2.6, ink_w=5.2)
    for u in (10, 18):
        x, y = place([(u, 0)], ang, tip)[0]
        dot(ic, x, y, 1.2, GOLD[1])
    head = place([(-1, 0), (3, -2.6), (8, -2), (8, 2), (3, 2.6)], ang, tip)
    ic.shape(curve(head, sharp=(0, 2, 3), k=0.5), ink(ic), shadow=False, ink_w=2.4)


def shi_e(ic):
    """Flowing Script: she glides six metres and paints a stroke all along her way."""
    p = ic.p
    wave = [(8, 36), (16, 30), (25, 36), (34, 42), (43, 37), (49, 33)]
    left, right = [], []
    for i, (x, y) in enumerate(wave):
        w = 4.2 * (1 - i / (len(wave) - 1) * 0.75)
        left.append((x, y - w))
        right.append((x, y + w))
    ic.shape(curve(left + list(reversed(right)), sharp=(0, 5, 6, 11), k=0.6), ink(ic), shadow=False, ink_w=2.6)
    brush(ic, (49, 32), -62, 26)
    for x, y in ((18, 18), (26, 14), (34, 18)):
        ic.line(poly([(x, y), (x - 6, y)], closed=False), p["hot"], 1.6, ink=False)


def shi_r(ic):
    """The Last Character: one great character written in a second: it roots you, and every stroke of hers under you
    erupts."""
    p = ic.p
    paper = ic.add("shape.rectangle", x=9, y=9, width=46, height=44, radius=1.6, rotation=-4)
    ic.solid(ic.id(paper), ic.grad("#ffffff", (0.5, p["paper"]), (1, p["paper_lo"])), ink_w=4)
    # Not a real character: one spiralling stroke from the brush's landing inward, a stroke beneath it, two dots.
    left, right = [], []
    n = 22
    for i in range(n + 1):
        t = i / n
        a = math.radians(200 + 470 * t)
        r = 14 - 10 * t
        w = 5.2 * (1 - t) + 0.6
        cx, cy = 32 + r * math.cos(a), 29 + r * math.sin(a)
        left.append((32 + (r + w / 2) * math.cos(a), 29 + (r + w / 2) * math.sin(a)))
        right.append((32 + (r - w / 2) * math.cos(a), 29 + (r - w / 2) * math.sin(a)))
    ic.shape(curve(left + list(reversed(right)), sharp=(0, n, n + 1, 2 * n + 1), k=0.5), ink(ic), shadow=False, ink_w=2.6)
    bar(ic, (17, 46), (44, 45), 3.8)
    for x, y in ((48, 16), (49, 26)):
        disc(ic, x, y, 2.0, ink(ic), shadow=False, ink_w=2)
    sq = ic.add("shape.rectangle", x=44, y=43, width=7, height=7, radius=0.8)
    ic.solid(ic.id(sq), ic.grad("#ff8a6a", (1, "#8a1a10")), shadow=False, ink_w=1.8)


ICONS = {"q": shi_q, "w": shi_w, "e": shi_e, "r": shi_r}
