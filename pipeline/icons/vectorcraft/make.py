"""
Spell icons drawn with VectorCraft (ArtCraft), a sample for two heroes: Anka (phoenix) and Mum (mime).

    python pipeline/icons/vectorcraft/make.py            # write every icon's command file and export it
    python pipeline/icons/vectorcraft/make.py anka q     # one hero, or one icon
    python pipeline/icons/vectorcraft/make.py --json-only

This script only writes the command files. What remakes an icon is its file, `pipeline/icons/vectorcraft/<hero>/<slot>.json`:
a list of VectorCraft commands run headless by

    vectorcraft-cli run --commands <hero>/<slot>.json --export <out>.svg --export <out>.png --scale 2

(`--scale 2`: the 64 pt artboard comes out as 128 px, the size the game draws its slot icons at). Exports go to
`docs/icons/sample/<hero>-<slot>.svg|png`. VectorCraft is at VC below (portable 0.24.1); set VECTORCRAFT_CLI to move it.

The family rules (one frame, one light, one line weight) live in this file, so all icons follow them:
- Artboard 64 x 64. Frame: the hero's dark ground, lit from the upper left, and an octagon medallion with a gold edge
  that fits inside both the desktop slot (a rounded square) and the phone slot (a circle).
- Light from the upper left: every fill is a gradient from the light colour at the upper left to the body colour at the
  lower right, and every main shape casts a soft ink shadow down and to the right.
- One line weight: every main shape has an ink outline 2.5 pt wide outside its fill (a 5 pt stroke on a copy under it),
  1.25 px at 32 px. Nothing that must be seen is thinner than 3 pt.
- Colours: the hero's palette row (docs/ART_BIBLE.md section 2); gold only on edges and highlights.
"""
import json
import math
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUT = ROOT / "docs" / "icons" / "sample"
VC = os.environ.get("VECTORCRAFT_CLI", r"C:\Users\erich\AppData\Local\Programs\ArtCraft\VectorCraft"
                    r"\vectorcraft-0.24.1-windows-x64-portable\vectorcraft-cli.exe")

INK_W = 5.0        # the ink outline's stroke (half of it shows outside the fill)
SHADOW = (1.3, 1.7)  # the cast shadow's offset: light from the upper left
LIGHT = -50        # gradient angle (counter-clockwise from left-to-right): upper left light, lower right body
GOLD = ["#f4dc94", "#c9a24a", "#5a3f14"]  # pale, gold, deep: a gold edge lit from the upper left

PAL = {
    # Art bible section 2, the Phoenix row (Anka): core, hot, body, accent, dark; foils ash, ember red, gold.
    "anka": dict(core="#fff6d8", hot="#ffc24a", body="#ff7b3a", accent="#2fb8a8", dark="#1a0806",
                 ash="#eadcc4", red="#c23a22", gold="#e0a935", lit="#4a170c", mid="#2e0d08"),
    # Mum has no row in section 2. A proposed "Dusk / chalk" row from her kit's own colours (src/kits/mime.ts S):
    # core chalk, hot lilac, body ribbon violet, accent scarf red, dark ink; foils ivory mask, hood, gold trim.
    "mum": dict(core="#f7f7f2", hot="#b8b4f4", body="#5c4a8c", accent="#d23a3a", dark="#0c0c12",
                ash="#c4bca6", red="#d23a3a", gold="#d2ae55", lit="#2c2640", mid="#17151f", hood="#201b2a"),
}


# ---------------------------------------------------------------------------------------------------------------- geometry
def rot(p, a, o=(0.0, 0.0)):
    c, s = math.cos(a), math.sin(a)
    return (o[0] + p[0] * c - p[1] * s, o[1] + p[0] * s + p[1] * c)


def place(points, ang_deg, at):
    """Local points (u along the axis, v across) turned by ang_deg (screen degrees, y down) and moved to `at`."""
    a = math.radians(ang_deg)
    return [rot(p, a, at) for p in points]


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def curve(points, closed=True, sharp=(), k=0.5):
    """SVG path through the points: Catmull-Rom curves, with corners at the indices in `sharp`."""
    n = len(points)
    def tan(i):
        if i in sharp or (not closed and (i == 0 or i == n - 1)):
            return (0.0, 0.0)
        a, b = points[(i - 1) % n], points[(i + 1) % n]
        return ((b[0] - a[0]) * k / 3, (b[1] - a[1]) * k / 3)
    d = f"M{f(points[0][0])} {f(points[0][1])}"
    segs = n if closed else n - 1
    for i in range(segs):
        p, q = points[i], points[(i + 1) % n]
        tp, tq = tan(i), tan((i + 1) % n)
        d += (f" C{f(p[0] + tp[0])} {f(p[1] + tp[1])} {f(q[0] - tq[0])} {f(q[1] - tq[1])} {f(q[0])} {f(q[1])}")
    return d + (" Z" if closed else "")


def poly(points, closed=True):
    d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in points)
    return d + (" Z" if closed else "")


def feather_pts(L, w):
    """A feather along +u: round back at u=0, widest at a third, pointed tip at u=L."""
    up = [(L, 0), (0.78 * L, 0.5 * w), (0.5 * L, 0.92 * w), (0.26 * L, w), (0.08 * L, 0.78 * w), (-0.02 * L, 0.36 * w)]
    lo = [(x, -y) for x, y in reversed(up[1:])]
    return up + [(-0.05 * L, 0)] + lo


def tongue_pts(h, w, lean=0.18):
    """A flame tongue along +u: a round base at u=0, a pointed tip at u=h that leans a little to one side."""
    return [(-0.1 * h, 0), (0.05 * h, 0.5 * w), (0.4 * h, 0.42 * w), (0.75 * h, 0.12 * w + lean * w), (h, lean * w * 1.6),
            (0.7 * h, -0.2 * w + lean * w * 0.4), (0.38 * h, -0.45 * w), (0.05 * h, -0.5 * w)]


# ---------------------------------------------------------------------------------------------------------------- builder
class Icon:
    """Builds one icon's VectorCraft command list. Every add returns the step number, so later steps can name its id."""

    def __init__(self, hero):
        self.p = PAL[hero]
        self.steps = []
        self.live = []
        self.add("file.new", width=64, height=64, units="Pixels", name=f"{hero} icon")

    MAKES = ("path.create", "shape.rectangle", "shape.ellipse", "shape.polygon", "shape.star", "object.group")
    MAKE_MANY = ("edit.duplicate", "object.pathfinder.unite", "object.pathfinder.minusFront")

    def add(self, command, **params):
        self.steps.append({"command": command, "params": params})
        n = len(self.steps) - 1
        # Track the objects alive in the document, so a group can take "everything drawn since mark()".
        ids = params.get("ids")
        if command.startswith("object.pathfinder") or command == "object.group":
            gone = set(ids if isinstance(ids, list) else [ids])
            self.live = [r for r in self.live if r not in gone and r.replace(".ids.0", ".ids") not in gone]
        if command in self.MAKES:
            self.live.append(f"${n}.id")
        elif command in self.MAKE_MANY or (command in ("object.rotate", "object.reflect") and params.get("copy")):
            self.live.append(f"${n}.ids.0")
        return n

    def mark(self):
        return len(self.live)

    def group(self, mark):
        """Group every object drawn since mark (one of `mark()`), and return the group's ref."""
        members = self.live[mark:]
        return self.id(self.add("object.group", ids=members))

    @staticmethod
    def id(step):
        return f"${step}.id"

    @staticmethod
    def ids(step):
        return f"${step}.ids"

    def grad(self, *colors, angle=LIGHT, kind="linear", **kw):
        stops = []
        for i, c in enumerate(colors):
            if isinstance(c, tuple):
                stops.append({"offset": c[0], "color": c[1], **({"opacity": c[2]} if len(c) > 2 else {})})
            else:
                stops.append({"offset": i / (len(colors) - 1), "color": c})
        g = {"kind": kind, "stops": stops, **kw}
        if kind == "linear" and "start" not in kw:
            g["angle"] = angle
        return g

    def paint(self, ref, fill=None, stroke=None, weight=None, **stroke_opts):
        """fill/stroke: '#hex', a gradient dict, or 'none'."""
        many = isinstance(ref, str) and ref.endswith(".ids")
        sel = {"ids": ref} if many else {"ids": [ref]}
        for kind, v in (("paint.setFill", fill), ("paint.setStroke", stroke)):
            if v is None:
                continue
            if v == "none":
                self.add(kind, **sel, none=True)
            elif isinstance(v, dict):
                self.add(kind, **sel, gradient=v)
            else:
                self.add(kind, **sel, color=v)
        if weight is not None or stroke_opts:
            self.add("stroke.set", **sel, **({"weight": weight} if weight is not None else {}), **stroke_opts)

    def path(self, d, **paint):
        s = self.add("path.create", d=d)
        self.paint(self.id(s), **paint)
        return self.id(s)

    def solid(self, ref, fill, shadow=True, ink=None, ink_w=INK_W):
        """The house style on a shape already drawn (ref): an ink outline outside it, a cast shadow, the fill on top.
        Returns the ref of the filled copy on top."""
        ink = ink or self.p["dark"]
        many = isinstance(ref, str) and ref.endswith(".ids")
        sel = {"ids": ref} if many else {"ids": [ref]}
        self.paint(ref, fill=ink, stroke=ink, weight=ink_w, join="round", cap="round")
        if shadow:
            sh = self.add("edit.duplicate", **sel, dx=SHADOW[0], dy=SHADOW[1])
            self.add("object.setProps", ids=self.ids(sh), opacity=55)
            self.add("object.arrange.sendBackward", ids=self.ids(sh))
        top = self.add("edit.duplicate", **sel)
        self.paint(self.ids(top), fill=fill, stroke="none")
        return self.ids(top)

    def shape(self, d, fill, **kw):
        s = self.add("path.create", d=d)
        return self.solid(self.id(s), fill, **kw)

    def line(self, d, color, weight, ink=True, ink_w=None, dash=None, cap="round", opacity=None):
        """An open stroke (chalk, gold, a rope), with an ink line under it when ink is set."""
        if ink:
            s = self.add("path.create", d=d)
            self.paint(self.id(s), fill="none", stroke=self.p["dark"], weight=ink_w or weight + 2.6, cap="round", join="round")
        s = self.add("path.create", d=d)
        opts = {"cap": cap, "join": "round"}
        if dash:
            opts["dash"] = dash
        self.paint(self.id(s), fill="none", stroke=color, weight=weight, **opts)
        if opacity is not None:
            self.add("object.setProps", ids=[self.id(s)], opacity=opacity)
        return self.id(s)

    # ------------------------------------------------------------------------------------------------------- the frame
    def frame(self):
        p = self.p
        bg = self.add("shape.rectangle", x=0, y=0, width=64, height=64)
        self.paint(self.id(bg), fill=self.grad(p["lit"], p["dark"], kind="radial", start=[24, 20], end=[24 + 50, 20]),
                   stroke="none")
        # The medallion: a regular octagon, flat sides up, down and across, its corners 29 from the centre (inside the
        # phone slot's circle), filled a little lighter, with a gold edge lit from the upper left.
        oc = self.add("shape.polygon", cx=32, cy=32, radius=29, sides=8, rotation=22.5)
        self.paint(self.id(oc), fill=self.grad(p["lit"], (0.55, p["mid"]), (1, p["dark"]), kind="radial", start=[25, 22],
                                               end=[25 + 40, 22]),
                   stroke=self.grad(GOLD[0], (0.3, GOLD[1]), (0.75, GOLD[2]), (1, GOLD[2])), weight=1.4, join="miter")
        # A black line inside the gold one, so the gold reads as an edge and not as a ring of light.
        ic = self.add("shape.polygon", cx=32, cy=32, radius=27.4, sides=8, rotation=22.5)
        self.paint(self.id(ic), fill="none", stroke=p["dark"], weight=1.2)
        self.add("object.setProps", ids=[self.id(ic)], opacity=70)

    def write(self, hero, slot):
        folder = HERE / hero
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{slot}.json"
        path.write_text(json.dumps(self.steps, indent=1) + "\n", encoding="utf-8")
        return path


# ---------------------------------------------------------------------------------------------------------------- Anka
def ember_ring(ic, cx, cy, rx, ry, tongues):
    """Anka's ember: flame tongues (x, angle, height, width) behind a ring of embers."""
    p = ic.p
    for x, ang, h, w in tongues:
        ic.shape(curve(place(tongue_pts(h, w), ang, (x, cy - ry * 0.35))), ic.grad(p["core"], (0.35, p["hot"]), (1, p["body"]),
                 angle=-90 - 0), shadow=False)
    d = f"M{f(cx - rx)} {f(cy)} A{f(rx)} {f(ry)} 0 1 0 {f(cx + rx)} {f(cy)} A{f(rx)} {f(ry)} 0 1 0 {f(cx - rx)} {f(cy)} Z"
    e = ic.add("shape.ellipse", x=cx - rx, y=cy - ry, width=2 * rx, height=2 * ry)
    ic.paint(ic.id(e), fill="none", stroke=p["dark"], weight=5.4)
    e2 = ic.add("shape.ellipse", x=cx - rx, y=cy - ry, width=2 * rx, height=2 * ry)
    ic.paint(ic.id(e2), fill="none", stroke=ic.grad(p["core"], (0.4, p["hot"]), (1, p["body"])), weight=2.6)
    return d


def feather(ic, back, tip, w, eye=True, colors=None, flames=0, notches=True, shadow=True):
    """One of Anka's feathers from its round back to its tip: notched on each edge, a gold quill down the middle, a teal
    eye near the back. With `flames`, its back end breaks into that many licks of flame (united into one shape)."""
    p = ic.p
    L = math.dist(back, tip)
    ang = math.degrees(math.atan2(tip[1] - back[1], tip[0] - back[0]))
    base = ic.add("path.create", d=curve(place(feather_pts(L, w), ang, back), sharp=(0,)))
    parts = [ic.id(base)]
    if flames:
        spread = [0] if flames == 1 else [(-1 + 2 * i / (flames - 1)) for i in range(flames)]
        for k in spread:
            h = L * (0.42 - 0.1 * abs(k))
            at = place([(0.16 * L, k * w * 0.45)], ang, back)[0]
            lick = ic.add("path.create", d=curve(place(tongue_pts(h, w * 1.05, lean=-0.35 * k), ang + 180 + 13 * k, at)))
            parts.append(ic.id(lick))
        base = ic.add("object.pathfinder.unite", ids=parts)
        parts = [ic.ids(base)]
    shape = base
    if notches:
        # Notches on the edges: little triangles cut out with Pathfinder (Minus Front).
        cuts = []
        for u, side in ((0.5, 1), (0.68, -1), (0.4, -1), (0.66, 1)):
            vw = w * (0.98 if u < 0.6 else 0.72)
            tri = [((u - 0.04) * L, side * (vw + 2)), ((u + 0.16) * L, side * vw * 0.1), ((u + 0.1) * L, side * (vw + 2))]
            cuts.append(ic.id(ic.add("path.create", d=poly(place(tri, ang, back)))))
        first = parts[0]
        ids = ([first] if not first.endswith(".ids") else [f"{first[:-4]}.ids.0"]) + cuts
        shape = ic.add("object.pathfinder.minusFront", ids=ids)
    ref = ic.ids(shape) if (notches or flames) else ic.id(shape)
    c = colors or (p["core"], p["hot"], p["body"])
    ic.solid(ref, ic.grad(c[0], (0.4, c[1]), (1, c[2])), shadow=shadow)
    # The quill: gold, lit from the upper left.
    q = place([(-0.04 * L, 0), (0.94 * L, 0)], ang, back)
    ic.line(poly(q, closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.3, ink=False)
    if eye:
        ex, ey = place([(0.27 * L, 0)], ang, back)[0]
        rx, ry = 0.12 * L, 0.6 * w
        for (k, fill) in ((1.0, p["dark"]), (0.78, GOLD[1]), (0.58, p["accent"])):
            e = ic.add("shape.ellipse", x=ex - rx * k, y=ey - ry * k, width=2 * rx * k, height=2 * ry * k, rotation=ang)
            ic.paint(ic.id(e), fill=fill, stroke="none")
        dot = ic.add("shape.ellipse", x=ex - rx * 0.22 - 0.4, y=ey - ry * 0.22 - 0.5, width=rx * 0.44, height=ry * 0.44)
        ic.paint(ic.id(dot), fill=p["core"], stroke="none")


def anka_q(ic):
    """Ember Quill: a feather thrown point first, its back breaking into flame, toward the ember it becomes."""
    ember_ring(ic, 45.5, 50, 11.5, 4.4, [(38.5, -100, 7, 4.2), (46, -88, 10, 5), (53, -78, 7, 4.2)])
    feather(ic, (21, 20), (46.5, 45.5), 5.6, flames=3)


def anka_w(ic):
    """Fan the Flames: her open fan, pleated in fire, over an ember that flares into a ring of flame."""
    p = ic.p
    pv = (32, 41)
    R, notch, r0, n = 26, 22.5, 8, 8
    a0, a1 = -172, -8
    step = (a1 - a0) / n
    def at(r, deg):
        return (pv[0] + r * math.cos(math.radians(deg)), pv[1] + r * math.sin(math.radians(deg)))
    # The handle: dark lacquer, below the pivot.
    ic.shape(poly([(30, 42), (34, 42), (33.3, 50.5), (30.7, 50.5)]), ic.grad("#5a463a", (1, "#1c1410")), shadow=False,
             ink_w=3)
    # The whole fan's outline and shadow: a sector with a scalloped edge, from the pivot.
    edge = [at(notch, a0)]
    for i in range(n):
        edge += [at(R, a0 + (i + 0.5) * step), at(notch, a0 + (i + 1) * step)]
    ic.shape(poly([pv] + edge), p["dark"])
    # The pleats: one pair (a lit fold and a shaded fold), turned about the pivot with Rotate (copy). The gradients are
    # centred on the pivot, so every copy is lit the same way: fire hottest at the edge.
    lit = ic.grad(p["body"], (0.55, p["hot"]), (1, p["core"]), kind="radial", start=list(pv), end=[pv[0] + R, pv[1]])
    shade = ic.grad(p["red"], (0.55, p["body"]), (1, p["hot"]), kind="radial", start=list(pv), end=[pv[0] + R, pv[1]])
    m = ic.mark()
    for i, fill in ((0, lit), (1, shade)):
        lo, hi = a0 + i * step, a0 + (i + 1) * step
        ic.path(poly([at(r0, lo), at(notch, lo), at(R, (lo + hi) / 2), at(notch, hi), at(r0, hi)]), fill=fill, stroke="none")
    pair = ic.group(m)
    for k in (1, 2, 3):
        ic.add("object.rotate", ids=[pair], angle=-2 * step * k, origin=list(pv), copy=True)
    # The two guard sticks and the rivet: gold on the structure.
    for deg in (a0, a1):
        ic.line(poly([pv, at(notch - 0.5, deg)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.8, ink_w=3.6)
    r = ic.add("shape.ellipse", x=pv[0] - 2.8, y=pv[1] - 2.8, width=5.6, height=5.6)
    ic.solid(ic.id(r), ic.grad(GOLD[0], (0.5, GOLD[1]), (1, GOLD[2])), shadow=False, ink_w=2.4)
    # In front of the fan: the ember it fans, flaring into a ring of flame.
    ember_ring(ic, 32, 52.5, 17, 4.8, [(14.5, -122, 12, 5.2), (21.5, -100, 8, 4.2), (42.5, -80, 8, 4.2), (49.5, -58, 12, 5.2)])


def comet(ic, a, c, b, w, colors):
    """A streak along the quadratic curve a -> c -> b, from nothing at a to `w` wide and round at b."""
    def q(t):
        return ((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
                (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1])
    left, right = [], []
    n = 14
    for i in range(n + 1):
        t = i / n
        x, y = q(t)
        t0, t1 = max(0, t - 0.01), min(1, t + 0.01)
        dx, dy = q(t1)[0] - q(t0)[0], q(t1)[1] - q(t0)[1]
        l = math.hypot(dx, dy) or 1
        nx, ny = -dy / l, dx / l
        ww = w * (t ** 0.8)
        left.append((x + nx * ww, y + ny * ww))
        right.append((x - nx * ww, y - ny * ww))
    x, y = q(1)
    x0, y0 = q(0.98)
    l = math.hypot(x - x0, y - y0)
    head = (x + (x - x0) / l * w, y + (y - y0) / l * w)
    pts = left + [head] + list(reversed(right))
    s = ic.add("path.create", d=curve(pts, sharp=(0, len(pts) - 1)))
    ic.paint(ic.id(s), fill=ic.grad(*colors, start=list(a), end=list(head)), stroke="none")
    return ic.id(s)


def anka_e(ic):
    """Ember Flight: she streaks in an arc to her ember and lands in a burst."""
    p = ic.p
    land = (43, 44)
    ember_ring(ic, 43, 49.5, 13.5, 5, [])
    # The streak: a dark wake under it, then the flame, fading to nothing at its start.
    comet(ic, (6, 55), (11, 12), (39, 39), 6.6, ((0, p["dark"], 0), (0.4, p["dark"], 0.7), (1, p["dark"])))
    comet(ic, (6, 55), (11, 12), (39, 39), 4.6, ((0, p["body"], 0), (0.4, p["body"]), (0.8, p["hot"]), (1, p["core"])))
    # The landing: an eight-point burst (two four-point stars, the small one turned 45 degrees).
    st = ic.add("shape.star", cx=land[0], cy=land[1], radius1=7.5, radius2=2.4, points=4, rotation=45)
    ic.solid(ic.id(st), ic.grad(p["hot"], (1, p["body"])), shadow=False, ink_w=3)
    st = ic.add("shape.star", cx=land[0], cy=land[1], radius1=12.5, radius2=3, points=4)
    ic.solid(ic.id(st), ic.grad(p["core"], (0.6, p["hot"]), (1, p["body"])), ink_w=3.4)
    d = ic.add("shape.ellipse", x=land[0] - 2, y=land[1] - 2, width=4, height=4)
    ic.paint(ic.id(d), fill="#ffffff", stroke="none")


def anka_r(ic):
    """Firebird: a great firebird seen from above, wings of fire spread, a tail of eyed feathers."""
    p = ic.p
    m = ic.mark()
    feather(ic, (41.5, 55), (34, 40), 3.4, notches=False, shadow=True)
    side_tail = ic.group(m)
    ic.add("object.reflect", ids=[side_tail], axis="vertical", origin=[32, 32], copy=True)
    feather(ic, (32, 58), (32, 40), 3.8, notches=False, shadow=True)
    # The right wing (a scalloped edge of four primaries), its gold leading edge and its coverts; then Reflect (copy).
    m = ic.mark()
    wing = [(34.5, 25), (40, 18), (46.5, 13.5), (53.5, 10.5), (50.5, 17.5), (57, 19.5), (51.5, 23.5), (56, 29.5),
            (48.5, 29.5), (50, 37), (43.5, 33.5), (40, 38), (35, 34)]
    ic.shape(curve(wing, sharp=(3, 4, 5, 6, 7, 8, 9, 10, 11)), ic.grad(p["hot"], (0.5, p["body"]), (1, p["red"])))
    cov = [(35, 26.5), (40, 21.5), (46, 18), (44.5, 25), (40, 30), (35.5, 31.5)]
    ic.shape(curve(cov, sharp=(2,)), ic.grad(p["hot"], (1, p["body"])), shadow=False, ink_w=3)
    ic.line(curve([(35.5, 24), (40, 18), (46.5, 13.5), (53, 10.8)], closed=False), ic.grad(GOLD[0], (1, GOLD[1])), 1.4,
            ink=False)
    right = ic.group(m)
    ic.add("object.reflect", ids=[right], axis="vertical", origin=[32, 32], copy=True)
    # Body and head (one shape: Pathfinder Unite), a hot core, a gold beak.
    body = ic.add("path.create", d=curve([(32, 19), (35, 23.5), (36, 31), (34.5, 39), (32, 44), (29.5, 39), (28, 31),
                                          (29, 23.5)], sharp=(4,)))
    head = ic.add("shape.ellipse", x=28.4, y=12.8, width=7.2, height=7.4)
    bh = ic.add("object.pathfinder.unite", ids=[ic.id(body), ic.id(head)])
    ic.solid(ic.ids(bh), ic.grad(p["core"], (0.45, p["hot"]), (1, p["body"])))
    g = ic.add("shape.ellipse", x=30, y=24, width=3.4, height=12)
    ic.paint(ic.id(g), fill=p["core"], stroke="none")
    ic.shape(poly([(32, 8.6), (34, 13.4), (30, 13.4)]), ic.grad(GOLD[0], (1, GOLD[1])), shadow=False, ink_w=2.4)


# ---------------------------------------------------------------------------------------------------------------- Mum
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


def circle_d(cx, cy, rx, ry=None):
    ry = ry or rx
    return (f"M{f(cx - rx)} {f(cy)} A{f(rx)} {f(ry)} 0 1 1 {f(cx + rx)} {f(cy)} "
            f"A{f(rx)} {f(ry)} 0 1 1 {f(cx - rx)} {f(cy)} Z")


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


ICONS = {
    "anka": {"q": anka_q, "w": anka_w, "e": anka_e, "r": anka_r},
    "mum": {"q": mum_q, "w": mum_w, "e": mum_e, "r": mum_r},
}


def export(hero, slot, path):
    OUT.mkdir(parents=True, exist_ok=True)
    stem = OUT / f"{hero}-{slot}"
    t = time.time()
    r = subprocess.run([VC, "run", "--commands", str(path), "--export", f"{stem}.svg", "--export", f"{stem}.png",
                        "--scale", "2"], capture_output=True, text=True, encoding="utf-8")
    lines = [json.loads(x) for x in r.stdout.splitlines() if x.startswith("{")]
    warn = [w for x in lines for w in (x.get("result") or {}).get("warnings", [])]
    if r.returncode != 0:
        sys.exit(f"{hero} {slot}: VectorCraft failed\n{r.stderr.strip()}")
    print(f"{hero} {slot}: {len(lines) - 2} steps, {time.time() - t:.1f} s, svg {Path(f'{stem}.svg').stat().st_size} B, "
          f"png {Path(f'{stem}.png').stat().st_size} B" + (f", warnings: {warn}" if warn else ""))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    only_json = "--json-only" in sys.argv
    for hero, slots in ICONS.items():
        if args and hero != args[0]:
            continue
        for slot, draw in slots.items():
            if len(args) > 1 and slot != args[1]:
                continue
            ic = Icon(hero)
            ic.frame()
            draw(ic)
            path = ic.write(hero, slot)
            if not only_json:
                export(hero, slot, path)


if __name__ == "__main__":
    main()
