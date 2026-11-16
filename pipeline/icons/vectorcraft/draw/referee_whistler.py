"""Referee Whistler the Arbiter (src/kits/referee.ts): the arena's judge in black and ivory, a silver horn on a chain, and
sigil tablets of gold and red in place of cards. His rules are seals: a sign struck through in red."""
import math

from vclib import *  # noqa: F401,F403
from vclib import GOLD, PAL

# Proposed row "Arbiter" (Referee Whistler; src/kits/referee.ts S): ivory, horn silver, the yellow sigil, the red one.
PAL["referee-whistler"] = row("#ffffff", "#ece6d2", "#b8bec8", "#e6b800", "#141414",
                              red="#d63a2a", red_deep="#8c2a32", ivory="#e4dfcf", steel="#6c7480")
PAL["referee-whistler"].update(lit="#34323a", mid="#1d1c21")


def horn_body(ic, a, c, b, w0, w1):
    """A horn along the curve a -> c -> b, from w0 wide at the mouthpiece to w1 at the bell."""
    def q(t):
        return ((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
                (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1])
    left, right = [], []
    n = 12
    for i in range(n + 1):
        t = i / n
        x, y = q(t)
        t0, t1 = max(0, t - 0.02), min(1, t + 0.02)
        dx, dy = q(t1)[0] - q(t0)[0], q(t1)[1] - q(t0)[1]
        l = math.hypot(dx, dy) or 1
        ww = w0 + (w1 - w0) * t ** 2.2
        left.append((x - dy / l * ww, y + dx / l * ww))
        right.append((x + dy / l * ww, y - dx / l * ww))
    return left + list(reversed(right))


def ref_q(ic):
    """Whistle Blast: the silver horn sounds, and a ring of sound goes out."""
    p = ic.p
    for r, w in ((9, 3.6), (15.5, 3.4), (22, 3.0)):
        swoosh(ic, (33, 27), r, -62, 62, w, (p["core"], (0.5, p["ivory"]), (1, p["body"])), head=0.5, ink_w=2.6)
    pts = horn_body(ic, (9, 37), (17, 22), (34, 26), 1.3, 6.2)
    ic.shape(curve(pts, sharp=(0, 12, 13, 25)), ic.grad(p["core"], (0.45, p["body"]), (1, p["steel"])))
    e = ic.add("shape.ellipse", x=31.5, y=19.5, width=5, height=13.4, rotation=12)
    ic.solid(ic.id(e), ic.grad(p["steel"], (1, p["dark"])), shadow=False, ink_w=2.4)
    for t in (0.35, 0.7):
        x = 9 + (34 - 9) * t
        y = (1 - t) ** 2 * 37 + 2 * (1 - t) * t * 22 + t * t * 26
        ic.line(poly([(x - 1.2, y - 2.8 - 2 * t), (x + 1.2, y + 2.8 + 2 * t)], closed=False),
                ic.grad(GOLD[0], (1, GOLD[1])), 1.6, ink=False)



def struck(ic, a, b):
    """His rule's red bar across a sign."""
    p = ic.p
    ic.line(poly([a, b], closed=False), ic.grad("#ff6a52", (1, p["red_deep"])), 3.8, ink_w=6.8)


def seal(ic, c, r):
    """A round seal of dark steel with a gold edge: the ground his rules are cut in."""
    p = ic.p
    disc(ic, c[0], c[1], r, ic.grad("#3a3a42", (1, "#141418")), ink_w=4.6)
    e = ic.add("shape.ellipse", x=c[0] - r, y=c[1] - r, width=2 * r, height=2 * r)
    ic.paint(ic.id(e), fill="none", stroke=ic.grad(GOLD[0], (0.35, GOLD[1]), (1, GOLD[2])), weight=1.6)


def ref_w(ic):
    """No Running: the sign of a dash, struck through: no dashes, blinks or leaps."""
    p = ic.p
    seal(ic, (32, 30.5), 20)
    arrow = [(14, 27.8), (35, 27.8), (35, 21.5), (49, 30.5), (35, 39.5), (35, 33.2), (14, 33.2)]
    ic.shape(poly(arrow), ic.grad(p["core"], (0.5, p["ivory"]), (1, p["body"])), ink_w=3.6)
    for y in (24, 37):
        ic.line(poly([(17, y), (26, y)], closed=False), p["body"], 1.6, ink=False)
    struck(ic, (17.5, 16), (46.5, 45))


def ref_e(ic):
    """No Casting: the sign of a spell, struck through: only basic attacks."""
    p = ic.p
    seal(ic, (32, 30.5), 20)
    star(ic, 32, 30.5, 13, 3.6, ic.grad(p["core"], (0.5, p["ivory"]), (1, p["body"])), ink_w=3.2)
    star(ic, 32, 30.5, 7, 2.2, ic.grad(p["core"], (1, p["ivory"])), rotation=45, ink_w=2.4)
    struck(ic, (17.5, 16), (46.5, 45))


def tablet(ic, c, w, h, ang, fill, sign=True):
    p = ic.p
    t = ic.add("shape.rectangle", x=c[0] - w / 2, y=c[1] - h / 2, width=w, height=h, radius=1.8, rotation=ang)
    top = ic.solid(ic.id(t), fill)
    t2 = ic.add("shape.rectangle", x=c[0] - w / 2 + 1.6, y=c[1] - h / 2 + 1.6, width=w - 3.2, height=h - 3.2, radius=1,
                rotation=ang)
    ic.paint(ic.id(t2), fill="none", stroke=ic.grad(GOLD[0], (1, GOLD[2])), weight=1.2)
    if sign:
        x, y = c
        star(ic, x, y, w * 0.24, w * 0.08, p["dark"], rotation=ang, ink_w=0)
    return top


def ref_r(ic):
    """Show the Card: he holds up the gold sigil; a second makes it red."""
    p = ic.p
    for a in range(-150, 31, 30):
        r0, r1 = 18, 27
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        ic.line(poly([(36 + ca * r0, 28 + sa * r0), (36 + ca * r1, 28 + sa * r1)], closed=False), p["hot"], 1.8,
                ink=False, opacity=70)
    tablet(ic, (27, 31), 15, 21, -16, ic.grad("#ff7a62", (0.5, p["red"]), (1, p["red_deep"])))
    glow(ic, 38, 27, 13, p["accent"], opacity=55)
    tablet(ic, (38, 27), 16, 22.5, 12, ic.grad("#fff2a8", (0.4, "#ffd23a"), (1, "#b88a00")))


ICONS = {"q": ref_q, "w": ref_w, "e": ref_e, "r": ref_r}
