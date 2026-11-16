"""Brannoc the Ashen Smith (src/kits/forge.ts): a Kilnborn smith, ash-grey with ember seams: the hammer on its chain, the
anvil, rivets, and the Heat that he quenches (the art bible's Forge row, ash as its foil)."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

PAL["brannoc"] = row("#fff3d0", "#ffb03a", "#ff5a12", "#6fe0ff", "#120a08", ash="#cfc6b8", iron="#4a4440")


def hot(ic):
    p = ic.p
    return ic.grad(p["core"], (0.35, p["hot"]), (0.75, p["body"]), (1, "#8a2008"))


def iron(ic):
    p = ic.p
    return ic.grad("#a8a098", (0.45, p["iron"]), (1, "#141010"))


def hammer(ic, c, ang, s=1.0, white=False):
    """A forge hammer: a square iron head glowing at its face, a short haft."""
    p = ic.p
    a, b = place([(0, 0), (-16 * s, 0)], ang, c)
    ic.line(poly([a, b], closed=False), ic.grad("#b07a4a", (1, "#3a2010")), 3.0 * s, ink_w=5.6 * s)
    head = [(-5 * s, -6.5 * s), (5 * s, -6.5 * s), (5 * s, 6.5 * s), (-5 * s, 6.5 * s)]
    ic.shape(poly(place(head, ang + 90, c)), hot(ic) if white else iron(ic))
    face = place([(-5 * s, 6.5 * s), (5 * s, 6.5 * s)], ang + 90, c)
    ic.line(poly(face, closed=False), p["hot"], 2.0, ink=False)
    for u in (-2, 2):
        a, b = place([(u * s, -5.6 * s), (u * s, 5.6 * s)], ang + 90, c)
        ic.line(poly([a, b], closed=False), p["body"], 0.9, ink=False, opacity=80)


def chain(ic, a, b, n=7):
    p = ic.p
    ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    for k in range(n):
        t = (k + 0.5) / n
        x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        e = ic.add("shape.ellipse", x=x - 2.3, y=y - 1.4, width=4.6, height=2.8, rotation=ang + (90 if k % 2 else 0) * 0.3)
        ic.paint(ic.id(e), fill="none", stroke=p["dark"], weight=2.8)
        e2 = ic.add("shape.ellipse", x=x - 2.3, y=y - 1.4, width=4.6, height=2.8, rotation=ang + (90 if k % 2 else 0) * 0.3)
        ic.paint(ic.id(e2), fill="none", stroke=ic.grad("#ffd8a0", (1, p["body"])), weight=1.2)


def sparks(ic, pts):
    p = ic.p
    for x, y, r in pts:
        spark(ic, x, y, r, p["hot"])


def bra_q(ic):
    """Chain Hammer: the hammer flies on its chain, drags whoever it hits to him; white-hot it hits harder."""
    p = ic.p
    chain(ic, (14, 40), (34, 28), 6)
    glow(ic, 42, 22, 12, p["body"], opacity=80)
    hammer(ic, (40, 24), -36, 1.15, white=True)
    sparks(ic, [(54, 12, 2.6), (56, 30, 2.0), (48, 8, 1.8)])


def bra_w(ic):
    """Forge Roar: he roars at the forge: armour for three seconds, and his next blow is a slam."""
    p = ic.p
    for x, ang, h, w in ((18, -110, 18, 7), (32, -90, 26, 9), (46, -70, 18, 7)):
        ic.shape(curve(place(tongue_pts(h, w, lean=0.12), ang, (x, 40))), hot(ic), shadow=False, ink_w=3)
    anvil = [(14, 34), (50, 34), (50, 37), (44, 39), (38, 42), (38, 47), (44, 52), (20, 52), (26, 47), (26, 42), (20, 39),
             (8, 37), (8, 34.6)]
    ic.shape(poly(anvil), iron(ic))
    ic.line(poly([(10, 34.6), (50, 34)], closed=False), p["hot"], 1.6, ink=False)
    ic.line(poly([(24, 47), (40, 47)], closed=False), GOLD[2], 1.0, ink=False)
    sparks(ic, [(12, 20, 2.4), (52, 22, 2.8), (40, 10, 2.0)])


def bra_e(ic):
    """Red-Hot Rivet: a rivet flicked at you burns on for two seconds."""
    p = ic.p
    streaks(ic, [(8, 22, 20, 26), (7, 32, 18, 33), (10, 41, 20, 38)], color=p["hot"], weight=2.0)
    glow(ic, 38, 31, 15, p["body"], opacity=85)
    shank = poly(place([(-2, -3.6), (12, -3.2), (12, 3.2), (-2, 3.6)], -12, (34, 32)))
    ic.shape(shank, hot(ic))
    head = ic.add("shape.ellipse", x=26, y=24, width=9, height=16, rotation=-12)
    ic.solid(ic.id(head), hot(ic), ink_w=3.6)
    sparks(ic, [(52, 22, 2.6), (54, 38, 2.2), (46, 44, 1.8)])
    for x, y in ((48, 28), (50, 34)):
        dot(ic, x, y, 1.0, p["core"])


def bra_r(ic):
    """Quench: he spends all his Heat at once: a ring bursts round him and throws everyone back."""
    p = ic.p
    ring(ic, 32, 46, 25, 8, ic.grad(p["hot"], (1, p["body"])), w=3)
    for k in range(8):
        a = k * 45 + 22.5
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        chevron(ic, (32 + ca * 26, 46 + sa * 9), a, 2.6, p["hot"], 1.8)
    for x, y, r in ((22, 22, 6.5), (42, 20, 7), (32, 13, 7.5)):
        ic.shape(blob_d((x, y), r, n=5, wobble=0.16, phase=x), ic.grad("#ffffff", (0.5, p["ash"]), (1, "#7a7068")), shadow=False,
                 ink_w=2.8)
    hammer(ic, (32, 46), -90, 1.15, white=True)
    star(ic, 32, 46, 9, 2.2, ic.grad(p["core"], (1, p["hot"])), points=4, ink_w=0)


ICONS = {"q": bra_q, "w": bra_w, "e": bra_e, "r": bra_r}
