"""Mum the Silent One (src/kits/mime.ts): the sample's second hero."""
import math

from vclib import *  # noqa: F401,F403  the builder, the geometry and the rules
from vclib import GOLD, PAL

# Mum has no row in section 2. A proposed "Dusk / chalk" row from her kit's own colours (src/kits/mime.ts S):
# core chalk, hot lilac, body ribbon violet, accent scarf red, dark ink; foils ivory mask, hood, gold trim.
PAL['mum'] = dict(core="#f7f7f2", hot="#b8b4f4", body="#5c4a8c", accent="#d23a3a", dark="#0c0c12",
                ash="#c4bca6", red="#d23a3a", gold="#d2ae55", lit="#2c2640", mid="#17151f", hood="#201b2a")


def _rects(ic, parts, pos, ang, sc):
    """Rounded rectangles given in the hand's own frame (cx, cy, w, h, radius, rotation), placed in the icon."""
    out = []
    for cx, cy, w, h, r, rr in parts:
        x, y = rot((cx * sc, cy * sc), math.radians(ang), pos)
        out.append(ic.id(ic.add("shape.rectangle", x=x - w * sc / 2, y=y - h * sc / 2, width=w * sc, height=h * sc,
                                radius=r * sc, rotation=rr + ang)))
    return out


def _cuff(ic, pos, ang, sc, y0=12.6):
    """The violet cuff with a gold edge at the top and a red harlequin diamond."""
    p = ic.p
    c = _rects(ic, [(0, y0 + 2.2, 11.6, 4.6, 1.2, 0)], pos, ang, sc)[0]
    ic.solid(c, ic.grad("#8a76c4", (0.5, p["body"]), (1, p["hood"])), shadow=False, ink_w=3)
    a, b = rot((-5.3 * sc, y0 * sc), math.radians(ang), pos), rot((5.3 * sc, y0 * sc), math.radians(ang), pos)
    ic.line(poly([a, b], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.3, ink=False)
    dm = [(0, y0 + 0.9), (1.5, y0 + 2.4), (0, y0 + 3.9), (-1.5, y0 + 2.4)]
    ic.path(poly([rot((x * sc, y * sc), math.radians(ang), pos) for x, y in dm]), fill=p["accent"], stroke="none")


def glove(ic, pos, ang=0, sc=1.0, cuff=True):
    """Mum's glove, open, palm out, fingers up (turned by `ang` degrees clockwise): slender porcelain-white fingers,
    built from rounded rectangles joined with Pathfinder (Unite)."""
    p = ic.p
    parts = [(0, 3.2, 11.2, 10.5, 4, 0),                 # palm
             (-4.15, -5.6, 3.1, 11.2, 1.55, -7),         # index
             (-1.3, -6.3, 3.1, 12.6, 1.55, -2),          # middle
             (1.55, -5.9, 3.1, 11.8, 1.55, 3),           # ring
             (4.25, -4.3, 2.8, 9, 1.4, 10),              # little
             (-7, 3.2, 3.3, 9.2, 1.65, -44),             # thumb
             (0, 9.5, 9.2, 6.4, 1, 0)]                   # wrist
    ids = _rects(ic, parts, pos, ang, sc)
    g = ic.add("object.pathfinder.unite", ids=ids)
    ic.solid(ic.ids(g), ic.grad(p["core"], (0.55, "#ebe7dc"), (1, p["ash"])))
    if cuff:
        _cuff(ic, pos, ang, sc)


def fist(ic, pos, ang=0, sc=1.0):
    """Mum's glove closed round a rope she mimes: the curled fingers seen from the front, the thumb across them."""
    p = ic.p
    parts = [(0, 1.4, 12, 11, 4, 0),                     # back of the hand
             (-4.5, -3.6, 3.2, 6.4, 1.6, 0), (-1.5, -4, 3.2, 6.8, 1.6, 0), (1.5, -3.8, 3.2, 6.6, 1.6, 0),
             (4.5, -3.2, 3.2, 5.8, 1.6, 0),              # the four curled fingers
             (-4.2, 1, 3.6, 8.6, 1.8, 62),               # the thumb across
             (0, 8.4, 9.2, 6, 1, 0)]                     # wrist
    ids = _rects(ic, parts, pos, ang, sc)
    g = ic.add("object.pathfinder.unite", ids=ids)
    ic.solid(ic.ids(g), ic.grad(p["core"], (0.55, "#ebe7dc"), (1, p["ash"])))
    for x in (-3, 0, 3):
        a, b = rot((x * sc, -5.6 * sc), math.radians(ang), pos), rot((x * sc, -2.4 * sc), math.radians(ang), pos)
        ic.line(poly([a, b], closed=False), p["ash"], 1.1, ink=False)
    _cuff(ic, pos, ang, sc, y0=11)


def chalk(ic, d, weight=3.0, dash=(4.4, 3.2), fill=None, fill_opacity=None):
    """What cannot be seen, drawn in chalk: a soft ink line under a dashed chalk line; with `fill`, a faint lilac body."""
    p = ic.p
    if fill:
        b = ic.add("path.create", d=d)
        ic.paint(ic.id(b), fill=fill, stroke="none")
        ic.add("object.setProps", ids=[ic.id(b)], opacity=fill_opacity or 22)
    u = ic.add("path.create", d=d)
    ic.paint(ic.id(u), fill="none", stroke=p["dark"], weight=weight + 2.6, cap="round", join="round")
    ic.add("object.setProps", ids=[ic.id(u)], opacity=65)
    c = ic.add("path.create", d=d)
    ic.paint(ic.id(c), fill="none", stroke=p["core"], weight=weight, cap="round", join="round", dash=list(dash))


def mum_q(ic):
    """Invisible Ball: a ball nobody can see, flying: only its chalk outline, the air it pushes aside and the chalk
    line on the floor under it show. (No glove here: a glove behind the ball and its trail read as a magnifying glass.)"""
    p = ic.p
    c, r = (39, 27), 13.5
    # The chalk line on the floor that shows where it goes, ending in an arrowhead.
    ic.line(poly([(9, 50.5), (50, 50.5)], closed=False), p["hot"], 2.4, dash=[3.6, 2.8])
    ic.line(poly([(45.5, 46.5), (51, 50.5), (45.5, 54.5)], closed=False), p["hot"], 2.4)
    # Speed lines behind it, the middle one longest.
    for y, x0, ln in ((19.5, 20.5, 9), (27, 21, 14), (34.5, 20.5, 9)):
        ic.line(poly([(x0, y), (x0 - ln, y)], closed=False), p["core"], 2.6)
    chalk(ic, circle_d(*c, r), weight=3.2, dash=(4.6, 3.3), fill=p["hot"], fill_opacity=26)
    # The light on it, upper left, and its shadow on the floor.
    ic.line(f"M{f(c[0] - 8.5)} {f(c[1] - 1)} A9 9 0 0 1 {f(c[0] - 1)} {f(c[1] - 8.5)}", p["core"], 1.8, ink=False,
            opacity=70)
    sh = ic.add("shape.ellipse", x=c[0] - 9, y=50.5 - 2.2, width=18, height=4.4)
    ic.paint(ic.id(sh), fill=p["dark"], stroke="none")
    ic.add("object.setProps", ids=[ic.id(sh)], opacity=60)


def mum_w(ic):
    """Wall: her flat glove pressed on a wall nobody can see; only the chalk shows where it stands."""
    p = ic.p
    pane = poly([(14.5, 10.5), (49.5, 14.5), (49.5, 51.5), (14.5, 55.5)])
    chalk(ic, pane, weight=3, dash=(5, 3.4), fill=p["hot"], fill_opacity=20)
    for x0, w in ((19, 4.5), (26, 2.2)):
        ic.path(poly([(x0, 14), (x0 + w, 14.5), (x0 + w - 7, 26), (x0 - 7, 25.5)]), fill=p["core"], stroke="none")
        ic.add("object.setProps", ids=[ic.live[-1]], opacity=35)
    glove(ic, (32.5, 33.5), ang=0, sc=1.25)


def mum_e(ic):
    """Rope Trick: she hauls on a rope nobody can see; its chalk loop has caught you, and you come to her."""
    p = ic.p
    loop = (46.5, 19.5)
    rope = curve([(21.5, 39.5), (29, 28.5), (39.5, 23)], closed=False)
    chalk(ic, rope, weight=3.2, dash=(4.4, 3))
    chalk(ic, circle_d(*loop, 8.4, 6.8), weight=3.2, dash=(4.4, 3))
    e = ic.add("shape.ellipse", x=loop[0] - 3.6, y=loop[1] - 3.6, width=7.2, height=7.2)
    ic.solid(ic.id(e), ic.grad("#ff7a6a", (1, "#8c1e22")), shadow=False, ink_w=2.6)
    # Two chevrons on the rope, pointing to her: the pull.
    for cx, cy in ((31, 30), (37.5, 25.5)):
        ang = math.atan2(30 - 25.5, 31 - 37.5)
        tip = (cx + math.cos(ang) * 2.2, cy + math.sin(ang) * 2.2)
        arms = [rot((-3.6, 3.4), ang, tip), tip, rot((-3.6, -3.4), ang, tip)]
        ic.line(poly(arms, closed=False), p["hot"], 2.4)
    fist(ic, (16, 46), ang=38, sc=1.0)


def mum_r(ic):
    """Boxed In: four walls nobody can see close round you, a box drawn in chalk; she seals it with her glove."""
    p = ic.p
    fx0, fx1, fy0, fy1, dx, dy = 14.5, 40.5, 27, 53, 11.5, -11
    top = poly([(fx0, fy0), (fx0 + dx, fy0 + dy), (fx1 + dx, fy0 + dy), (fx1, fy0)])
    side = poly([(fx1, fy0), (fx1 + dx, fy0 + dy), (fx1 + dx, fy1 + dy), (fx1, fy1)])
    front = poly([(fx0, fy0), (fx1, fy0), (fx1, fy1), (fx0, fy1)])
    # Back edges, faint: the box is see-through.
    for d in (poly([(fx0 + dx, fy0 + dy), (fx0 + dx, fy1 + dy), (fx1 + dx, fy1 + dy)], closed=False),
              poly([(fx0, fy1), (fx0 + dx, fy1 + dy)], closed=False)):
        ic.line(d, p["hot"], 1.6, ink=False, dash=[2.4, 2.6], opacity=55)
    e = ic.add("shape.ellipse", x=(fx0 + fx1) / 2 + 4 - 4.2, y=(fy0 + fy1) / 2 - 2 - 4.2, width=8.4, height=8.4)
    ic.solid(ic.id(e), ic.grad("#ff7a6a", (1, "#8c1e22")), shadow=False, ink_w=2.6)
    for d, op in ((side, 12), (top, 34), (front, 18)):
        chalk(ic, d, weight=2.9, dash=(4.4, 3.1), fill=p["hot"], fill_opacity=op)
    glove(ic, (49, 47.5), ang=-38, sc=0.68)


ICONS = {'q': mum_q, 'w': mum_w, 'e': mum_e, 'r': mum_r}
