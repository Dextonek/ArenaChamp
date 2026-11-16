"""Opaline the Lightbreaker (src/kits/prism.ts): of the Gloaming folk, crystal grown into her from the Deep's light:
light that bounces and splits, crystals of amethyst and cream (the art bible's Prism row, its spectrum as the accent)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["opaline"] = row("#ffffff", "#f2eeff", "#b8b0ff", "#ff5a6a", "#14102a", amethyst="#8a5ad8", cream="#f4ead8",
                     spectrum=["#ff5a6a", "#ffd24a", "#5aff9a", "#5ab8ff"])


def crystal_fill(ic):
    p = ic.p
    return ic.grad("#ffffff", (0.35, p["hot"]), (0.7, p["body"]), (1, p["amethyst"]))


def crystal(ic, foot, h, w, ang=0):
    """A crystal: a six-sided prism with a pointed top, two faces lit, one in shade."""
    p = ic.p
    pts = [(-w, 0), (-w, -h * 0.7), (0, -h), (w, -h * 0.7), (w, 0), (0, h * 0.12)]
    ic.shape(poly(place(pts, ang, foot)), crystal_fill(ic))
    face = place([(0, h * 0.12), (0, -h), (w, -h * 0.7), (w, 0)], ang, foot)
    ic.path(poly(face), fill=ic.grad((0, p["amethyst"], 0.15), (1, p["amethyst"], 0.6)), stroke="none")
    a, b = place([(-w * 0.5, -h * 0.65), (-w * 0.5, -h * 0.15)], ang, foot)
    ic.line(poly([a, b], closed=False), "#ffffff", 1.2, ink=False)


def beam(ic, pts, w=2.2):
    p = ic.p
    ic.line(poly(pts, closed=False), p["body"], w + 2, ink=True, ink_w=w + 4.6)
    ic.line(poly(pts, closed=False), "#ffffff", w * 0.6, ink=False)


def opa_q(ic):
    """Ricochet Light: a bolt of light that bounces off walls and crystals, harder at each bounce."""
    p = ic.p
    crystal(ic, (47, 50), 26, 6)
    beam(ic, [(6, 18), (44, 34), (30, 10)])
    for k, c in enumerate(p["spectrum"]):
        ic.line(poly([(44, 34), (56 - k * 0.5, 14 + k * 3)], closed=False), c, 1.4, ink=False)
    star(ic, 44, 34, 7, 1.6, "#ffffff", points=4, ink_w=0)
    chevron(ic, (30, 10), -120, 3.2, "#ffffff", 2.2)


def opa_w(ic):
    """Crystal: a crystal rises at the spot: it blocks, and her light bounces off it."""
    p = ic.p
    ring(ic, 32, 51, 18, 4.6, p["body"], w=2.0)
    crystal(ic, (24, 51), 22, 5, ang=-14)
    crystal(ic, (42, 51), 20, 5, ang=16)
    crystal(ic, (33, 52), 40, 8)
    for x, y in ((14, 16), (52, 22)):
        spark(ic, x, y, 3, p["hot"])


def opa_e(ic):
    """Blinding Flare: a flash round her: blinded, and pushed away."""
    p = ic.p
    for k in range(12):
        a = math.radians(k * 30)
        L = 26 if k % 2 == 0 else 20
        c = p["spectrum"][k % 4] if k % 2 else "#ffffff"
        ic.line(poly([(32 + 9 * math.cos(a), 32 + 9 * math.sin(a)), (32 + L * math.cos(a), 32 + L * math.sin(a))],
                     closed=False), c, 2.0 if k % 2 == 0 else 1.4, ink=True, ink_w=3.6)
    glow(ic, 32, 32, 16, p["body"], opacity=90)
    star(ic, 32, 32, 14, 3.4, ic.grad("#ffffff", (0.5, p["hot"]), (1, p["body"])), points=8, ink_w=3)
    star(ic, 32, 32, 6, 2, "#ffffff", points=4, rotation=45, ink_w=0)


def opa_r(ic):
    """Shatterlight: six shards ring your spot and fire inward through it."""
    p = ic.p
    c = (32, 33)
    ring(ic, c[0], c[1], 23, 23, p["body"], w=1.4, dash=[2.4, 2.4])
    star(ic, c[0], c[1], 6, 1.6, "#ffffff", points=4, ink_w=0)
    for k in range(6):
        a = k * 60 - 90
        x, y = c[0] + 21 * math.cos(math.radians(a)), c[1] + 21 * math.sin(math.radians(a))
        shard(ic, (x, y), a + 180, 12, 3.4, crystal_fill(ic), back=0.3, ink_w=2.8)
        ic.line(poly([(c[0] + 7 * math.cos(math.radians(a)), c[1] + 7 * math.sin(math.radians(a))),
                      (c[0] + 11 * math.cos(math.radians(a)), c[1] + 11 * math.sin(math.radians(a)))], closed=False),
                p["spectrum"][k % 4], 1.6, ink=False)


ICONS = {"q": opa_q, "w": opa_w, "e": opa_e, "r": opa_r}
