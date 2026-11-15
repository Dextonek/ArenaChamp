"""
The shared part of the VectorCraft spell icons (pipeline/icons/vectorcraft/make.py runs them): the builder that writes
VectorCraft's command lists, the geometry helpers, the family's frame and the rules every icon follows.

The family rules (one frame, one light, one outline) live here, so all icons follow them:
- Artboard 64 x 64. Frame: the hero's dark ground, lit from the upper left, and an octagon medallion with a gold edge
  that fits inside both the desktop slot (a rounded square) and the phone slot (a circle).
- The game's icons are version B: the picture drawn inside the octagon and then scaled 118% about the centre (strokes
  too), so its big shapes break over the frame's edge. Keep the lower left (before the scale, about x < 22 and y > 42)
  quiet: the spell bar puts the key letter there.
- Light from the upper left: most fills are gradients from the light colour at the upper left to the body colour at the
  lower right, and main shapes cast a soft ink shadow down and to the right.
- Outline: main shapes have an ink outline 2.5 pt wide outside the fill (a 5 pt stroke on a copy under it), 1.25 px at
  32 px; small parts take 2.4-3 pt. Gold lines and highlights are thinner (1.3-1.8 pt): detail, not what the icon says.
- Colours: the hero's palette row (docs/ART_BIBLE.md section 2); gold only on edges and highlights.

VectorCraft's pitfalls, found on the sample (docs/icons/sample/index.html): tapered strokes export as a jagged outline
(draw tapers as shapes), "stroke outside" exports a mask (use a wider stroke on a copy underneath), a new shape takes the
last paint used (paint every shape), a copy inside a list is `$N.ids.0`, and gradient ids repeat across files (one SVG
per icon, or rename them when joining).
"""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
B_SCALE = 118      # variant B: the picture this many percent about the centre
INK_W = 5.0       # the ink outline's stroke (half of it shows outside the fill)
SHADOW = (1.3, 1.7)  # the cast shadow's offset: light from the upper left
LIGHT = -50        # gradient angle (counter-clockwise from left-to-right): upper left light, lower right body
GOLD = ["#f4dc94", "#c9a24a", "#5a3f14"]  # pale, gold, deep: a gold edge lit from the upper left

PAL = {}  # filled by the hero modules (draw/<stem>.py, their PAL)


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


def mix(a, b, t):
    """The colour t of the way from a to b ('#rrggbb')."""
    a, b = [int(a[i:i + 2], 16) for i in (1, 3, 5)], [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(a, b))


def row(core, hot, body, accent, dark, **foils):
    """A hero's palette row (art bible section 2) with the frame's two grounds made from it: `lit` (the upper left of
    the ground) and `mid` (the medallion's middle)."""
    p = dict(core=core, hot=hot, body=body, accent=accent, dark=dark)
    p["lit"] = mix(dark, body, 0.2)
    p["mid"] = mix(dark, body, 0.08)
    p.update(foils)
    return p


def circle_d(cx, cy, rx, ry=None):
    ry = ry or rx
    return (f"M{f(cx - rx)} {f(cy)} A{f(rx)} {f(ry)} 0 1 1 {f(cx + rx)} {f(cy)} "
            f"A{f(rx)} {f(ry)} 0 1 1 {f(cx - rx)} {f(cy)} Z")
