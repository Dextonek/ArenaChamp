"""
MOBA-style hero figures, built from scratch (concept: docs/heroes/moba_concept_sheet.png): one signature shape per hero,
a readable silhouette, dark at the feet and brightest at the head and weapon, saturated accents. Each figure has its
own joint positions (a tank's wide shoulders, short legs) on the same 16 bones, names, parents and bone directions as
the game rig (dao_blender.RIG), so src/effects/weapons/hero.ts and src/heroFigure.ts pose it like any hero.

Run inside Blender (through the MCP server):

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\heroes")
    import moba_figures; importlib.reload(moba_figures)
    moba_figures.build("forge")        # into the collection "Moba forge"
    moba_figures.export("forge")       # build + public/models/heroes/forge_v2.glb, then clear

Blender coordinates: metres, z up, the figure faces -Y; +X is the figure's left.
"""
import importlib
import math
import os
import sys

XB = r"C:\projectG\xianxia\blender"
if XB not in sys.path:
    sys.path.insert(0, XB)

import bpy  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402

import dao_blender as dao  # noqa: E402
import figure_kit  # noqa: E402
import kit  # noqa: E402

if os.path.dirname(os.path.abspath(__file__)) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sculpt  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "models", "heroes")
SIDES = (("R", -1), ("L", 1))


def rig_table(j):
    """The game rig's bones at the joints in `j` (same names, parents and directions as dao_blender.RIG)."""
    t = {
        "pelvis": ((0, 0, j["hip"]), (0, 0, j["waist"]), None),
        "chest": ((0, 0, j["waist"]), (0, 0, j["neck"]), "pelvis"),
        "neck": ((0, 0, j["neck"]), (0, 0, j["head"]), "chest"),
        "head": ((0, 0, j["head"]), (0, 0, j["top"]), "neck"),
    }
    sx, sy, sz = j["shoulder"]
    ex, ez, wx, wz, hl = j["elbow_x"], j["elbow_z"], j["wrist_x"], j["wrist_z"], j["hand"]
    lx, kz = j["leg_x"], j["knee"]
    for s, x in SIDES:
        t.update({
            f"upper_arm.{s}": ((sx * x, sy, sz), (ex * x, 0, ez), "chest"),
            f"forearm.{s}": ((ex * x, 0, ez), (wx * x, -0.05, wz), f"upper_arm.{s}"),
            f"hand.{s}": ((wx * x, -0.05, wz), ((wx + 0.015) * x, -0.07, wz - hl), f"forearm.{s}"),
            f"thigh.{s}": ((lx * x, 0, j["hip"] + 0.04), (lx * x, 0, kz), "pelvis"),
            f"shin.{s}": ((lx * x, 0, kz), (lx * x, 0, 0.06), f"thigh.{s}"),
            f"foot.{s}": ((lx * x, 0, 0.06), (lx * x, -0.14, 0.02), f"shin.{s}"),
        })
    return t


class MobaFigure:
    """A figure from parts: each part is skinned rigidly to one bone, near a list of bones, or by a weight function."""

    def __init__(self, key, joints):
        self.key = key
        self.joints = joints
        self.parts = []
        self.chains = []
        self.mats = {}

    # ---- helpers ------------------------------------------------------------------------------------
    def mat(self, part, color, **kw):
        if part not in self.mats:
            self.mats[part] = kit.material(f"moba_{self.key}_{part}", color, **kw)
        return self.mats[part]

    def add(self, ob, w):
        """`w`: a bone name (rigid), a list of bones (nearest), or a function co -> {bone: weight}."""
        self.parts.append((ob, w))
        return ob

    def sway(self, name, parent, points):
        self.chains.append((name, parent, [Vector(p) for p in points]))
        return [f"sway_{name}_{i}" for i in range(len(points) - 1)]

    # ---- shared body parts (the later heroes; Forge and Storm build their own) ----------------------
    def shoulder_pts(self, x):
        J = self.J
        sx, sy, sz = J["shoulder"]
        return (Vector((sx * x, sy, sz)), Vector((J["elbow_x"] * x, 0, J["elbow_z"])), Vector((J["wrist_x"] * x, -0.05, J["wrist_z"])))

    def hand_at(self, x):
        J = self.J
        return Vector(((J["wrist_x"] + 0.008) * x, -0.06, J["wrist_z"] - 0.06))

    def joints_fill(self, neck=None, shoulder=None, elbow=None, wrist=None, hip=None, knee=None):
        """
        Round joint pieces where two parts meet, each `(material, radius)`, weighted between the two bones it joins:
        a neck column from chest to head, and a ball at each shoulder, elbow, wrist, hip and knee. They fill the gap a
        bent limb would open and round off the seam between, say, a sleeve and a leather forearm.
        """
        J = self.J
        if neck:
            m, r = neck
            self.add(tube("Neck", (0, 0.005, J["neck"] - 0.05), (0, 0.0, J["head"] + 0.05), [(0, r * 1.15, r * 1.1), (0.5, r, r * 0.95), (1, r * 0.95, r * 0.9)], m, seg=14), ["chest", "neck", "head"])
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            for spec, c, bones in ((shoulder, sh, ["chest", f"upper_arm.{s}"]), (elbow, el, [f"upper_arm.{s}", f"forearm.{s}"]),
                                   (wrist, wr, [f"forearm.{s}", f"hand.{s}"])):
                if spec:
                    self.add(blob(f"Joint{s}{bones[1]}", c, (spec[1], spec[1], spec[1]), spec[0], (14, 10)), bones)
            X = J["leg_x"] * x
            for spec, c, bones in ((hip, (X, 0, J["hip"] + 0.04), ["pelvis", f"thigh.{s}"]), (knee, (X, 0, J["knee"]), [f"thigh.{s}", f"shin.{s}"])):
                if spec:
                    self.add(blob(f"Joint{s}{bones[1]}", c, (spec[1], spec[1], spec[1]), spec[0], (14, 10)), bones)

    def legs(self, cloth, boot, thigh=(0.075, 0.055), shin=0.05, boot_r=0.062, boot_top=0.36, toe=0.2, cuff=None):
        """Legs from hip to ankle and boots with a toe pointing forward (-Y)."""
        lx = self.J["leg_x"]
        hip, knee = self.J["hip"], self.J["knee"]
        for s, x in SIDES:
            X = lx * x
            self.add(tube(f"Thigh{s}", (X, 0, hip + 0.04), (X, 0, knee), [(0, thigh[0], thigh[0]), (1, thigh[1], thigh[1])], cloth, seg=12), [f"thigh.{s}", f"shin.{s}", "pelvis"])
            self.add(tube(f"Shin{s}", (X, 0, knee + 0.02), (X, 0, 0.1), [(0, thigh[1], thigh[1]), (1, shin, shin)], cloth, seg=12), [f"shin.{s}", f"thigh.{s}"])
            self.add(tube(f"BootShaft{s}", (X, 0, boot_top), (X, 0, 0.05), [(0, boot_r * 1.08, boot_r * 1.08), (1, boot_r, boot_r)], boot, seg=12), f"shin.{s}")
            pts = [(X, 0.03, 0.045), (X, -0.06, 0.04), (X, -0.06 - toe * 0.5, 0.033), (X, -0.06 - toe * 0.75, 0.04)]
            self.add(chain(f"Boot{s}", pts, [(boot_r, boot_r * 0.75), (boot_r * 0.98, boot_r * 0.7), (boot_r * 0.7, boot_r * 0.48), (0.012, 0.012)], boot, seg=12), f"foot.{s}")
            if cuff:
                self.add(torus(f"BootCuff{s}", (X, 0, boot_top), boot_r * 1.15, 0.012, cuff, seg=(16, 6)), f"shin.{s}")

    def arms(self, upper, lower, skin, r=(0.055, 0.048, 0.042), flare=0.0, cuff=None, hand=(0.04, 0.045, 0.06)):
        """Upper arms, forearms (flaring by `flare` toward the wrist, with an optional cuff) and hands."""
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            self.add(tube(f"UpperArm{s}", sh, el, [(0, r[0], r[0]), (1, r[1], r[1])], upper, seg=12), [f"upper_arm.{s}", f"forearm.{s}"])
            end = wr + (wr - el) * (0.08 if flare else 0.0)
            self.add(tube(f"Forearm{s}", el, end, [(0, r[1], r[1]), (0.6, r[2] + flare * 0.5, r[2] + flare * 0.5), (1, r[2] + flare, r[2] + flare)], lower, seg=14, cap=(True, not flare)), f"forearm.{s}")
            if cuff:
                self.add(tube(f"Cuff{s}", el.lerp(wr, 0.8), end + (wr - el) * 0.02, [(0, r[2] + flare * 0.75, r[2] + flare * 0.75), (1, r[2] + flare + 0.008, r[2] + flare + 0.008)], cuff, seg=14, cap=(False, False)), f"forearm.{s}")
            self.mitten(x, skin, size=hand[2] / 0.06)

    def head_shape(self, hc, r, skin, chin=0.55):
        """
        One smooth head: a rounded skull narrowing to a soft chin that sits a little forward (`chin` = jaw width
        0..1). Replaces a plain ball plus a separate chin blob, which read as a beak.
        """
        prof = [(-1.0, 0.06, 0.06, -0.3), (-0.88, 0.32 + 0.25 * chin, 0.42, -0.25), (-0.65, 0.62 + 0.2 * chin, 0.74, -0.13),
                (-0.35, 0.92, 0.95, -0.04), (0.0, 1.0, 1.0, 0.0), (0.4, 0.96, 0.98, 0.02), (0.72, 0.76, 0.8, 0.03),
                (0.92, 0.42, 0.46, 0.03), (1.0, 0.06, 0.06, 0.03)]
        rings = [kit.ring_z(hc.z + k * r[2], r[0] * sx, r[1] * sy, hc.y + cy * r[1]) for k, sx, sy, cy in prof]
        return self.add(loft("Head", rings, skin, seg=28), "head")

    def face(self, hc, r, skin, mouth, nose=0.016, smile=0.006, width=0.022, z=-0.5, out=0.003):
        """A small nose and a curved mouth on the front of a head from `head_shape`."""
        def front(dx, k):
            # the surface point at x offset dx and height k (-1..1) on the shaped head
            ry = r[1] * (0.95 if k > -0.4 else 0.95 + (k + 0.4) * 0.45)
            return hc.y - ry * math.sqrt(max(0.0, 1 - (dx / r[0]) ** 2)) - 0.04 * r[1] * max(0.0, -k)
        nz = hc.z - 0.18 * r[2]
        self.add(blob("Nose", (0, front(0, -0.18) - 0.004, nz), (nose * 0.85, nose, nose * 1.1), skin, (10, 8)), "head")
        mz = hc.z + z * r[2]
        pts = [Vector((dx, front(dx, z) - out + 0.006, mz + smile * (1 - (dx / width) ** 2) * -1 + smile)) for dx in (-width, -width * 0.5, 0, width * 0.5, width)]
        self.add(chain("Mouth", pts, [0.003, 0.0045, 0.005, 0.0045, 0.003], mouth, seg=6), "head")

    def mitten(self, x, skin, size=1.0, bone=None):
        """A hand: a palm, a thumb toward the front and a row of curled knuckles."""
        s = "L" if x > 0 else "R"
        h = self.hand_at(x)
        self.add(blob(f"Palm{s}", h, (0.034 * size, 0.042 * size, 0.05 * size), skin, (14, 10)), bone or f"hand.{s}")
        self.add(blob(f"Thumb{s}", h + Vector((-0.016 * x * size, -0.04 * size, 0.012 * size)), (0.014 * size, 0.016 * size, 0.026 * size), skin, (10, 8)), bone or f"hand.{s}")
        self.add(blob(f"Knuckles{s}", h + Vector((0.004 * x, -0.012 * size, -0.045 * size)), (0.03 * size, 0.034 * size, 0.022 * size), skin, (12, 8)), bone or f"hand.{s}")

    def eyes(self, hc, r, white, iris, glint, spread=0.042, size=(0.022, 0.03), z=0.005, lash=None):
        """Big stylised eyes on a head centred at `hc` with radii `r` (white, iris, glint, optional lash line)."""
        for s, x in SIDES:
            ex = spread * x
            ey = hc.y - r[1] * math.sqrt(max(0.0, 1 - (ex / r[0]) ** 2)) + 0.012
            c = Vector((ex, ey, hc.z + z))
            self.add(blob(f"EyeWhite{s}", c, (size[0], 0.012, size[1]), white, (12, 8)), "head")
            self.add(blob(f"Iris{s}", c + Vector((0, -0.008, -0.002)), (size[0] * 0.62, 0.008, size[1] * 0.68), iris, (12, 8)), "head")
            self.add(blob(f"Glint{s}", c + Vector((0.006 * x, -0.014, 0.008)), (0.006, 0.003, 0.007), glint, (6, 4)), "head")
            if lash:
                arc = [c + Vector((size[0] * 1.05 * math.cos(a) * x, -0.008, size[1] * 0.95 * math.sin(a))) for a in (0.2, 0.9, 1.6, 2.3, 2.9)]
                self.add(chain(f"Lash{s}", arc, [0.004, 0.006, 0.006, 0.006, 0.004], lash, seg=5), "head")

    def bell(self, name, rings, mat, lining=None, weights=None, hem=None, zig=0.0, n=24):
        """A skirt or coat bell from (z, rx, ry) rings (top first), with an optional lining and hem (zigzag `zig`)."""
        w = weights or short_skirt(self.J["hip"], self.J["knee"], 0.12)
        self.add(loft(name, [kit.ring_z(z, rx, ry) for z, rx, ry in rings], mat, seg=n, cap=(False, False)), w)
        if lining:
            self.add(loft(name + "Lining", [kit.ring_z(z - 0.005, rx * 0.97, ry * 0.97) for z, rx, ry in rings], lining, seg=n, cap=(False, False)), w)
        if hem:
            z0, rx, ry = rings[-1]
            pts = []
            for k in range(2 * n + 1):
                a = 2 * math.pi * k / (2 * n)
                pts.append(Vector(((rx + 0.006) * math.cos(a), (ry + 0.006) * math.sin(a), z0 + ((zig if k % 2 else -zig * 0.6) if zig else 0.0))))
            self.add(chain(name + "Hem", pts, [0.011] * len(pts), hem, seg=6), w)

    def cape(self, name, mat, top, width, length, tails=3, parent="chest", ragged=0.0, back=0.14):
        """A cape from the shoulders down the back, as `tails` panels each on its own sway chain."""
        for k in range(tails):
            u = (k + 0.5) / tails - 0.5
            x0 = u * width
            pts = [Vector((x0, back, top)), Vector((x0 * 1.15, back + 0.07, top - length * 0.35)),
                   Vector((x0 * 1.3, back + 0.12, top - length * 0.7)), Vector((x0 * 1.4, back + 0.15, top - length * (1 - ragged * (k % 2))))]
            bones = self.sway(f"{name}{k}", parent, pts)
            w0 = width / tails * 0.62
            for i in range(3):
                a, b = pts[i], pts[i + 1]
                r0, r1 = w0 * (1 + 0.12 * i), w0 * (1 + 0.12 * (i + 1)) * (0.4 if (i == 2 and ragged) else 1)
                self.add(tube(f"{name}{k}_{i}", a, b, [(0, r0, 0.012), (1, r1, 0.012)], mat, seg=8, side=(1, 0, 0)), bones[i])

    # ---- build --------------------------------------------------------------------------------------
    def build(self):
        coll = kit.collection(f"Moba {self.key}")
        rig = self.make_rig(coll)
        self.body()
        self.add_chains(rig)
        for ob, w in self.parts:
            if w is None:
                continue
            if isinstance(w, str):
                g = ob.vertex_groups.new(name=w)
                g.add(list(range(len(ob.data.vertices))), 1.0, "REPLACE")
            elif callable(w):
                figure_kit.weight_fn(ob, w)
            else:
                # a soft falloff: skin bends across the joint instead of creasing at it
                figure_kit.weight_near(ob, rig, w, power=3.5)
        if self.SCULPT:
            self.sculpt_pass()
        self.merge()
        for part, cap in self.CAPS.items():
            ob = coll.objects.get(part.capitalize())
            if ob:
                sculpt.cap(ob, cap)
        for ob in [o for o in coll.objects if o.type == "MESH"]:
            ob.parent = rig
            md = ob.modifiers.new("Armature", "ARMATURE")
            md.object = rig
        if self.SCULPT:
            sculpt.paint(coll, height=self.J["top"], tints=self.PAINT)
        return coll

    # ---- sculpted finish (SCULPT = True) -------------------------------------------------------------
    SCULPT = False
    # the silhouette of the first concept sheet (docs/heroes/moba_concept_sheet.png) instead of the refined one
    CONCEPT = False
    # (group name, material part, name prefixes left out, voxel size, triangle budget, fold spec or None[, smooth
    # iterations]); prefixes starting with ("only", ...) take just the parts with those prefixes instead
    FUSE = ()
    # (part name prefixes, sculpt.folds arguments): cloth folds pressed into open garments (skirts and their linings)
    FOLDS = ()
    # {material part: triangle cap} for the merged, un-fused meshes (collapse decimate, weights kept)
    CAPS = {}
    # {material part: sculpt.paint tint options} (skin warmth, hair tips)
    PAINT = {}

    def sculpt_pass(self):
        """Melts each FUSE group (its parts already weighted) into one continuous, smoothed surface."""
        for name, mat_part, leave, voxel, budget, fold, *rest in self.FUSE:
            mname = f"moba_{self.key}_{mat_part}"
            only = leave[:1] == ("only",)

            def picked(ob):
                hit = ob.name.startswith(tuple(leave[1:] if only else leave))
                return hit if only else not hit
            group = [(ob, w) for ob, w in self.parts if ob.data.materials and ob.data.materials[0].name == mname and picked(ob)]
            if len(group) < 2:
                continue
            obs = [ob for ob, _ in group]
            fused = sculpt.fuse(obs, name, voxel=voxel, target=budget, smooth=rest[0] if rest else 16)
            if fold:
                sculpt.folds(fused, **fold)
            ids = {id(ob) for ob in obs}
            self.parts = [(ob, w) for ob, w in self.parts if id(ob) not in ids] + [(fused, None)]
        for prefixes, kw in self.FOLDS:
            for ob, _ in self.parts:
                if ob.name.startswith(tuple(prefixes)):
                    sculpt.folds(ob, **kw)
        # small face parts (a mouth) laid back onto the fused surface, which the smoothing moved
        for part, onto, offset in self.WRAP:
            target = next((ob for ob, _ in self.parts if ob.name == onto), None)
            for ob, _ in self.parts:
                if target and ob.name.startswith(part):
                    md = ob.modifiers.new("Wrap", "SHRINKWRAP")
                    md.target, md.wrap_method, md.wrap_mode, md.offset = target, "NEAREST_SURFACEPOINT", "OUTSIDE_SURFACE", offset
                    sculpt._apply(ob, md)

    # (part name prefix, fused group name, offset): parts shrink-wrapped onto a fused surface after the sculpt pass
    WRAP = ()

    def make_rig(self, coll):
        if bpy.context.object and bpy.context.object.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
        arm = bpy.data.armatures.new(f"Rig_{self.key}")
        rig = bpy.data.objects.new(f"Rig_{self.key}", arm)
        coll.objects.link(rig)
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode="EDIT")
        table = rig_table(self.joints)
        for bone, (head, tail, _) in table.items():
            b = arm.edit_bones.new(bone)
            b.head, b.tail = Vector(head), Vector(tail)
        for bone, (_, _, parent) in table.items():
            if parent:
                b = arm.edit_bones[bone]
                b.parent = arm.edit_bones[parent]
                b.use_connect = (b.head - b.parent.tail).length < 1e-4
        bpy.ops.object.mode_set(mode="OBJECT")
        arm.display_type = "STICK"
        self.rig = rig
        return rig

    def add_chains(self, rig):
        if not self.chains:
            return
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode="EDIT")
        eb = rig.data.edit_bones
        for name, parent, pts in self.chains:
            prev = eb[parent]
            for i in range(len(pts) - 1):
                b = eb.new(f"sway_{name}_{i}")
                b.head, b.tail = pts[i], pts[i + 1]
                b.parent = prev
                b.use_connect = i > 0
                prev = b
        bpy.ops.object.mode_set(mode="OBJECT")

    def merge(self):
        """Join the parts by material: a handful of meshes per figure."""
        by_mat = {}
        for ob, _ in self.parts:
            key = ob.data.materials[0].name if ob.data.materials else ""
            by_mat.setdefault(key, []).append(ob)
        for name, obs in by_mat.items():
            short = name.replace(f"moba_{self.key}_", "").capitalize() or "Mesh"
            if len(obs) > 1:
                kit.join(short, obs)
            else:
                obs[0].name = short

    def body(self):
        raise NotImplementedError


# Smooth surfaces: the kit's shapes at about twice their usual resolution round the curve (no visible facets from
# the game camera or close up), and hard-edged boxes with a soft four-step bevel.
def _big(r):
    """Parts this size or larger get the smooth resolution; small ones (rivets, eyes, rings) keep their own."""
    return r >= 0.045


def blob(name, centre, radii, mat=None, segs=(24, 16), **kw):
    if _big(max(radii)):
        segs = (max(int(1.6 * segs[0]), 32), max(int(1.6 * segs[1]), 20))
    return kit.blob(name, centre, radii, mat, segs=segs, **kw)


def tube(name, p0, p1, radii, mat=None, seg=16, **kw):
    r = max(max(a, b) for _, a, b in radii)
    return kit.tube(name, p0, p1, radii, mat, seg=max(int(1.6 * seg), 24) if _big(r) else seg, **kw)


def chain(name, points, radii, mat=None, seg=16, **kw):
    return kit.chain(name, points, radii, mat, seg=max(seg, 8), **kw)


def torus(name, centre, major, minor, mat=None, seg=(48, 12), **kw):
    return kit.torus(name, centre, major, minor, mat, seg=(max(seg[0], 32), max(seg[1], 8)), **kw)


def loft(name, rings, mat=None, seg=24, **kw):
    return kit.loft(name, rings, mat, seg=max(2 * seg, 40), **kw)


def lathe(name, profile, mat=None, seg=48, **kw):
    return kit.lathe(name, profile, mat, seg=max(2 * seg, 32), **kw)


def box(name, centre, size, mat=None, bevel=0.0, segments=2, **kw):
    return kit.box(name, centre, size, mat, bevel=max(bevel, 0.006), segments=max(segments, 4), **kw)


def short_skirt(hip, knee, half):
    """Weights for an apron or coat skirt: the pelvis at the waist, following each thigh lower down."""
    def w(p):
        s = figure_kit.smooth(hip + 0.02, knee + 0.05, p.z)
        left = figure_kit.clamp(0.5 + p.x / half)
        wl, wr = 0.9 * s * left, 0.9 * s * (1 - left)
        return {"pelvis": 1 - wl - wr, "thigh.L": wl, "thigh.R": wr}
    return w


# ============================================================================================ Brannoc
class Forge(MobaFigure):
    """
    Brannoc, the Ashen Smith (tank): a wall of rounded iron shoulders with molten seams, a barrel chest with a
    furnace grate, a small head in a forge visor over a great braided red beard, huge forearms and fists, a leather
    apron, short heavy legs in iron-shod boots; a big hammer hanging from the right hand.
    """

    J = dict(hip=0.80, waist=0.92, neck=1.44, head=1.50, top=1.74, shoulder=(0.30, 0.02, 1.37),
             elbow_x=0.37, elbow_z=1.10, wrist_x=0.41, wrist_z=0.84, hand=0.12, leg_x=0.13, knee=0.44)

    SCULPT = True
    # the head finer (a crisp nose, brow and jaw), then the body: neck, muscled arms and fists
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "BrowRidge", "Jaw", "Ear", "Cheek"), 0.0042, 5000, None, 8),
            ("Skin", "skin", ("Face",), 0.0075, 7000, None, 20),
            ("Beard", "beard", ("Braid", "Brow"), 0.0048, 2500, None, 10))
    CAPS = {"iron": 5500, "trousers": 2600, "steel": 2200, "gold": 2200, "beard": 4200}
    PAINT = {"skin": dict(warm=1.0), "beard": dict(shadow=(0.62, 0.3, 0.38))}

    def __init__(self):
        super().__init__("forge", self.J)

    def body(self):
        boot = self.mat("boot", "#16110f", roughness=0.7)
        cloth = self.mat("trousers", "#2a2330", roughness=0.9)
        leather = self.mat("leather", "#6a3c20", roughness=0.75)
        iron = self.mat("iron", "#4e484a", metallic=0.35, roughness=0.5)
        steel = self.mat("steel", "#9a928c", metallic=0.35, roughness=0.4)
        skin = self.mat("skin", "#b5744a", roughness=0.6)
        molten = self.mat("molten", "#ff6a14", roughness=0.5, emission="#ff6a14", strength=3.0)
        fire = self.mat("fire", "#ffb83a", roughness=0.4, emission="#ffa424", strength=4.0)
        beard = self.mat("beard", "#d8471c", roughness=0.8)
        gold = self.mat("gold", "#e8b84a", metallic=0.8, roughness=0.3)
        wood = self.mat("haft", "#5a3a22", roughness=0.7)
        J = self.J
        lx = J["leg_x"]

        # --- legs and boots (darkest) ---
        for s, x in SIDES:
            X = lx * x
            self.add(tube(f"Thigh{s}", (X, 0, 0.84), (X, 0, 0.44), [(0, 0.1, 0.1), (0.5, 0.105, 0.1), (1, 0.085, 0.085)], cloth, seg=14), [f"thigh.{s}", f"shin.{s}", "pelvis"])
            self.add(tube(f"Shin{s}", (X, 0, 0.46), (X, 0, 0.12), [(0, 0.085, 0.085), (1, 0.08, 0.08)], cloth, seg=14), [f"shin.{s}", f"thigh.{s}"])
            self.add(tube(f"BootShaft{s}", (X, 0.0, 0.34), (X, 0.0, 0.07), [(0, 0.1, 0.1), (0.3, 0.11, 0.11), (1, 0.105, 0.11)], boot, seg=14), f"shin.{s}")
            self.add(box(f"Boot{s}", (X, -0.05, 0.05), (0.2, 0.32, 0.1), boot, bevel=0.035, segments=3), f"foot.{s}")
            self.add(box(f"BootCap{s}", (X, -0.17, 0.065), (0.19, 0.08, 0.09), iron, bevel=0.03, segments=3), f"foot.{s}")
            self.add(torus(f"BootRing{s}", (X, 0, 0.32), 0.108, 0.018, iron, seg=(20, 6)), f"shin.{s}")

        # --- apron (mid-dark leather), front and back flaps ---
        skirt = short_skirt(J["hip"], J["knee"], 0.16)
        front = [(-0.27, 0.0), (0.27, 0.0), (0.24, -0.38), (0.12, -0.46), (-0.12, -0.46), (-0.24, -0.38)]
        ap = kit.extrude_shape("Apron", front, 0.03, leather, bevel=0.008, centre=(0, -0.235, 0.9))
        self.add(ap, skirt)
        back = [(-0.25, 0.0), (0.25, 0.0), (0.2, -0.3), (-0.2, -0.3)]
        self.add(kit.extrude_shape("ApronBack", back, 0.03, leather, bevel=0.008, centre=(0, 0.2, 0.9)), skirt)
        self.add(box("ApronSeam", (0, -0.252, 0.66), (0.3, 0.012, 0.03), molten, bevel=0.005), skirt)
        dark = self.mat("leatherdark", "#3a2010", roughness=0.8)
        edge = [Vector((a_, -0.252, 0.9 + b_)) for a_, b_ in [(-0.27, 0.0), (-0.24, -0.38), (-0.12, -0.46), (0.12, -0.46), (0.24, -0.38), (0.27, 0.0)]]
        self.add(chain("ApronEdge", edge, [0.009] * len(edge), dark, seg=6), skirt)
        self.add(box("Pocket", (0.13, -0.256, 0.74), (0.13, 0.016, 0.1), dark, bevel=0.01), skirt)
        for k, dx in enumerate((-0.015, 0.015)):
            self.add(tube(f"Tong{k}", (0.13 + dx, -0.262, 0.76), (0.13 + dx * 2.2, -0.262, 0.9), [(0, 0.007, 0.007), (1, 0.006, 0.006)], iron, seg=6), skirt)

        # --- barrel torso (iron), belt, furnace ---
        rings = []
        barrel = [(0.82, 0.25, 0.2), (0.92, 0.29, 0.23), (1.08, 0.33, 0.26), (1.24, 0.35, 0.27), (1.38, 0.32, 0.25), (1.46, 0.22, 0.18), (1.5, 0.1, 0.09)]
        # concept: a huge inverted triangle, narrow at the belt, a wall of shoulder up top
        # (the top pulled back behind the beard)
        wedge = [(0.82, 0.21, 0.18, 0), (0.92, 0.24, 0.2, 0), (1.06, 0.31, 0.24, 0), (1.22, 0.4, 0.27, 0.01), (1.35, 0.45, 0.25, 0.04),
                 (1.44, 0.38, 0.19, 0.07), (1.5, 0.16, 0.1, 0.08)]
        for z, rx, ry, *cy in (wedge if self.CONCEPT else barrel):
            rings.append(kit.ring_z(z, rx, ry, cy[0] if cy else 0.0))
        self.add(loft("Torso", rings, iron, seg=28), ["chest", "pelvis"])
        self.add(loft("Belt", [kit.ring_z(0.89, 0.3, 0.24), kit.ring_z(0.95, 0.305, 0.245)], leather, seg=28), "pelvis")
        self.add(box("Buckle", (0, -0.31, 0.92), (0.11, 0.03, 0.08), gold, bevel=0.01), "pelvis")
        c = Vector((0, -0.26, 1.2))
        glow = blob("Furnace", c + Vector((0, 0.02, 0)), (0.13, 0.04, 0.13), fire, (20, 12))
        self.add(glow, "chest")
        self.add(torus("FurnaceRing", c, 0.14, 0.03, steel, seg=(32, 8), axis=(0, 1, 0)), "chest")
        for k in range(3):
            self.add(box(f"Grate{k}", (0, c.y - 0.02, c.z - 0.06 + 0.06 * k), (0.25, 0.02, 0.022), iron, bevel=0.006), "chest")
        # molten seams across the barrel's front, under the furnace
        for s, x in SIDES:
            pts = [(0.08 * x, -0.27, 1.02), (0.17 * x, -0.255, 1.06), (0.24 * x, -0.22, 1.02)]
            self.add(chain(f"Seam{s}", pts, [0.01, 0.013, 0.008], molten, seg=6), "chest")
        # a forge pack on his back: an iron box with rivets and two short chimneys glowing at the top
        self.add(box("ForgePack", (0, 0.27, 1.2), (0.36, 0.12, 0.3), steel, bevel=0.035), "chest")
        self.add(box("PackGrate", (0, 0.335, 1.16), (0.2, 0.01, 0.1), fire, bevel=0.01), "chest")
        for k in range(3):
            self.add(box(f"PackBar{k}", (0, 0.342, 1.13 + 0.03 * k), (0.22, 0.012, 0.012), iron, bevel=0.004), "chest")
        for s, x in SIDES if not self.CONCEPT else ():
            base = Vector((0.11 * x, 0.29, 1.34))
            self.add(tube(f"Chimney{s}", base, base + Vector((0.02 * x, 0.03, 0.2)), [(0, 0.035, 0.035), (1, 0.04, 0.04)], iron, seg=12), "chest")
            self.add(torus(f"ChimneyLip{s}", base + Vector((0.02 * x, 0.03, 0.2)), 0.042, 0.01, fire, seg=(18, 6)), "chest")
            for k, (dx, dz) in enumerate([(-0.14, 0.12), (0.14, 0.12), (-0.14, -0.12), (0.14, -0.12)]):
                if (dx > 0) == (x > 0):
                    self.add(blob(f"PackRivet{s}{k}", (dx, 0.334, 1.2 + dz), (0.014, 0.01, 0.014), gold, (8, 6)), "chest")

        # --- arms: thick upper arms, huge forearms with iron bracers, big fists ---
        sx, sy, sz = J["shoulder"]
        for s, x in SIDES:
            sh, el, wr = Vector((sx * x, sy, sz)), Vector((J["elbow_x"] * x, 0, J["elbow_z"])), Vector((J["wrist_x"] * x, -0.05, J["wrist_z"]))
            self.add(tube(f"UpperArm{s}", sh, el, [(0, 0.1, 0.1), (0.5, 0.11, 0.1), (1, 0.09, 0.09)], skin, seg=14), [f"upper_arm.{s}", f"forearm.{s}"])
            self.add(tube(f"Forearm{s}", el, wr, [(0, 0.1, 0.1), (0.35, 0.13, 0.125), (1, 0.1, 0.095)], skin, seg=14), [f"forearm.{s}", f"upper_arm.{s}"])
            self.add(tube(f"Bracer{s}", el.lerp(wr, 0.3), el.lerp(wr, 0.95), [(0, 0.14, 0.135), (1, 0.115, 0.11)], iron, seg=14), f"forearm.{s}")
            self.add(torus(f"BracerRim{s}", el.lerp(wr, 0.32), 0.14, 0.014, molten, seg=(20, 6), axis=(wr - el).normalized()), f"forearm.{s}")
            hand = Vector(((J["wrist_x"] + 0.01) * x, -0.06, J["wrist_z"] - 0.075))
            fs = 1.3 if self.CONCEPT else 1.0  # concept: fists as big as his head
            self.add(blob(f"Fist{s}", hand, (0.1 * fs, 0.105 * fs, 0.11 * fs), skin, (16, 12)), f"hand.{s}")
            # muscles, melted into the arm by the sculpt pass
            up = (el - sh)
            self.add(blob(f"Biceps{s}", sh.lerp(el, 0.55) + Vector((0, -0.06, 0)), (0.075, 0.07, 0.11), skin, (14, 10)), [f"upper_arm.{s}"])
            self.add(blob(f"Triceps{s}", sh.lerp(el, 0.45) + Vector((0.02 * x, 0.06, 0)), (0.07, 0.065, 0.12), skin, (14, 10)), [f"upper_arm.{s}"])
            self.add(blob(f"ForearmBelly{s}", el.lerp(wr, 0.25) + Vector((0.04 * x, -0.03, 0)), (0.085, 0.08, 0.11), skin, (14, 10)), [f"forearm.{s}"])
            for k in range(4):
                fz = hand.z - 0.05
                fx = hand.x + (-0.045 + 0.03 * k) * x * 0.9
                fx = hand.x + (fx - hand.x) * fs
                self.add(blob(f"Finger{s}{k}", (fx, hand.y - 0.085 * fs, fz), (0.022 * fs, 0.03 * fs, 0.035 * fs), skin, (10, 8)), f"hand.{s}")
            self.add(blob(f"Thumb{s}", hand + Vector((-0.06 * x, -0.07, 0.03)) * fs, (0.03 * fs, 0.035 * fs, 0.04 * fs), skin, (10, 8)), f"hand.{s}")
            self.add(box(f"Knuckles{s}", hand + Vector((0, -0.08, -0.02)) * fs, (0.15 * fs, 0.05 * fs, 0.07 * fs), iron, bevel=0.02), f"hand.{s}")

        # --- the signature: two huge rounded iron pauldrons with molten seams and rivets ---
        # (concept: smoking chimney stacks on the shoulders instead)
        smoke = self.mat("smoke", "#6a6466", roughness=1.0)
        for s, x in SIDES if self.CONCEPT else ():
            pw = (lambda arm: (lambda p: {"chest": 0.75, arm: 0.25}))(f"upper_arm.{s}")
            base = Vector((0.33 * x, 0.02, 1.4))
            self.add(box(f"Stack{s}", base + Vector((0, 0, 0.1)), (0.16, 0.16, 0.2), steel, bevel=0.025, segments=3), pw)
            self.add(box(f"StackBand{s}", base + Vector((0, 0, 0.05)), (0.175, 0.175, 0.035), iron, bevel=0.01), pw)
            self.add(box(f"StackGlow{s}", base + Vector((0, 0, 0.205)), (0.12, 0.12, 0.012), fire, bevel=0.004), pw)
            for k, (dx, dz, r) in enumerate([(0.0, 0.27, 0.055), (0.03 * x, 0.34, 0.042), (0.0, 0.4, 0.03)]):
                self.add(blob(f"Smoke{s}{k}", base + Vector((dx, 0.02, dz)), (r, r, r * 0.9), smoke, (12, 8)), "chest")
            for k, dy in enumerate((-0.083, 0.083)):
                self.add(chain(f"StackSeam{s}{k}", [base + Vector((-0.05, dy, 0.03)), base + Vector((0.0, dy, 0.09)), base + Vector((0.05, dy, 0.04))], [0.008, 0.01, 0.007], molten, seg=6), pw)
        for s, x in SIDES if not self.CONCEPT else ():
            pc = Vector((0.34 * x, 0.0, 1.42))
            # mostly on the chest, a third on the arm: it lifts with a raised arm without tipping on every step
            pw = (lambda arm: (lambda p: {"chest": 0.65, arm: 0.35}))(f"upper_arm.{s}")
            shell = blob(f"Pauldron{s}", pc, (0.26, 0.24, 0.16), steel, (24, 14), keep=lambda co, z=pc.z: co.z > z - 0.07)
            self.add(shell, pw)
            self.add(blob(f"PauldronUnder{s}", pc + Vector((0.02 * x, 0, -0.06)), (0.24, 0.22, 0.05), iron, (20, 8)), pw)
            arc = [pc + Vector(((-0.17 + 0.34 * t) * x * 0.9 + 0.02 * x, -0.12 * math.sin(math.pi * t) - 0.05, 0.12 * math.sin(math.pi * t) + 0.02)) for t in (0.05, 0.3, 0.55, 0.8, 0.98)]
            self.add(chain(f"PauldronSeam{s}", arc, [0.012, 0.016, 0.017, 0.015, 0.01], molten, seg=6), pw)
            for k, (dx, dy) in enumerate([(-0.12, -0.12), (0.0, -0.17), (0.12, -0.12), (0.17, 0.02)]):
                p = pc + Vector((dx * x, dy, 0.1 - 0.25 * (dx * dx + dy * dy)))
                self.add(blob(f"Rivet{s}{k}", p, (0.022, 0.022, 0.018), gold, (8, 6)), pw)

        # --- head: small, in a forge visor; a great braided beard (bright) ---
        hc = Vector((0, -0.05, 1.575)) if self.CONCEPT else Vector((0, -0.02, 1.62))
        self.add(blob("Head", hc, (0.12, 0.125, 0.135), skin, (20, 14)), "head")
        self.add(blob("Nose", hc + Vector((0, -0.125, -0.005)), (0.028, 0.03, 0.035), skin, (10, 8)), "head")
        self.add(tube("NoseBridge", hc + Vector((0, -0.112, 0.035)), hc + Vector((0, -0.13, -0.0)), [(0, 0.016, 0.014), (1, 0.022, 0.02)], skin, seg=10), "head")
        self.add(blob("BrowRidge", hc + Vector((0, -0.1, 0.03)), (0.1, 0.035, 0.025), skin, (14, 8)), "head")
        self.add(blob("Jaw", hc + Vector((0, -0.04, -0.08)), (0.105, 0.09, 0.07), skin, (14, 10)), "head")
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.12 * x, 0.0, 0.0)), (0.018, 0.035, 0.045), skin, (10, 8)), "head")
        self.add(blob("Cap", hc + Vector((0, 0.005, 0.05)), (0.132, 0.136, 0.11), iron, (20, 12), keep=lambda co: co.z > hc.z + 0.02), "head")
        # the back of the head: dark hair down to the neck and a bound topknot
        self.add(blob("HairBack", hc + Vector((0, 0.04, -0.01)), (0.122, 0.1, 0.12), self.mat("hair", "#2a1a14", roughness=0.8), (18, 12),
                      keep=lambda co: co.y > hc.y + 0.02), "head")
        knot = hc + Vector((0, 0.12, 0.06))
        self.add(blob("Topknot", knot, (0.045, 0.04, 0.05), self.mat("hair", "#2a1a14", roughness=0.8), (12, 10)), "head")
        self.add(torus("KnotRing", knot + Vector((0, -0.01, -0.03)), 0.03, 0.008, molten, seg=(16, 6), axis=(0, 1, 0.3)), "head")
        self.add(box("VisorBand", hc + Vector((0, -0.09, 0.04)), (0.25, 0.07, 0.06), iron, bevel=0.015), "head")
        if self.CONCEPT:
            # a welding mask: one glowing slit across the visor
            self.add(box("Slit", hc + Vector((0, -0.127, 0.04)), (0.17, 0.012, 0.022), fire, bevel=0.006), "head")
        for s, x in SIDES if not self.CONCEPT else ():
            self.add(blob(f"Lens{s}", hc + Vector((0.056 * x, -0.127, 0.04)), (0.034, 0.012, 0.022), fire, (12, 8)), "head")
        self.add(blob("Brow", hc + Vector((0, -0.1, -0.03)), (0.075, 0.025, 0.016), beard, (12, 8)), "head")
        # beard: a wide moustache mass, then a thick braid down to the furnace (sway chain)
        self.add(blob("BeardMass", hc + Vector((0, -0.07, -0.11)), (0.11, 0.075, 0.075), beard, (18, 12)), "head")
        for s, x in SIDES:
            curl = [hc + Vector(v) for v in [(0.0, -0.13, -0.05), (0.05 * x, -0.135, -0.055), (0.1 * x, -0.115, -0.08), (0.12 * x, -0.09, -0.12), (0.11 * x, -0.08, -0.15)]]
            self.add(chain(f"Moustache{s}", curl, [0.016, 0.022, 0.02, 0.014, 0.006], beard, seg=10), "head")
            self.add(blob(f"Cheek{s}", hc + Vector((0.07 * x, -0.09, -0.03)), (0.032, 0.02, 0.026), skin, (10, 8)), "head")
        braid = [hc + Vector(v) for v in [(0, -0.12, -0.13), (0, -0.2, -0.22), (0, -0.25, -0.32), (0, -0.27, -0.42)]]
        bones = self.sway("beard", "head", braid)
        for k in range(len(braid) - 1):
            a, b = braid[k], braid[k + 1]
            r = 0.07 - 0.015 * k
            self.add(blob(f"Braid{k}", a.lerp(b, 0.5), (r, r * 0.8, (b - a).length * 0.62), beard, (14, 10),
                              rotation=Euler(((b - a).normalized().to_track_quat("Z", "Y").to_euler()))), bones[k])
            self.add(torus(f"BraidRing{k}", b, r * 0.75, 0.012, gold, seg=(16, 6), axis=(b - a).normalized()), bones[k])

        # --- the hammer, hanging from the right hand, head low by the boot ---
        hand_r = Vector((-(J["wrist_x"] + 0.01), -0.06, J["wrist_z"] - 0.075))
        top, bot = hand_r + Vector((0, -0.01, 0.1)), hand_r + Vector((-0.02, -0.06, -0.4))
        self.add(tube("Haft", top, bot, [(0, 0.024, 0.024), (1, 0.028, 0.028)], wood, seg=10), "hand.R")
        self.add(torus("HaftWrap", hand_r + Vector((0, -0.01, 0.05)), 0.03, 0.01, leather, seg=(14, 6)), "hand.R")
        head = bot + Vector((0, -0.01, -0.06))
        self.add(box("HammerHead", head, (0.2, 0.38, 0.19), iron, bevel=0.03, segments=3), "hand.R")
        for k, dy in enumerate((-0.2, 0.2)):
            self.add(box(f"HammerFace{k}", head + Vector((0, dy, 0)), (0.215, 0.025, 0.205), molten, bevel=0.01), "hand.R")
        self.add(box("HammerBand", head, (0.215, 0.06, 0.205), gold, bevel=0.01), "hand.R")
        self.joints_fill(neck=(skin, 0.085), shoulder=(skin, 0.1), elbow=(skin, 0.098), wrist=(skin, 0.092), hip=(cloth, 0.1), knee=(cloth, 0.09))


# ============================================================================================ Kaia
class Storm(MobaFigure):
    """
    Kaia, the Storm Spark (mage): slim and vertical; wild white spiky hair crackling with sparks, a big head, a
    cropped navy storm coat flaring into a zigzag hem with cyan trim and two coat tails, storm-cloud shoulder pads
    with gold clasps, flared sleeves with white cuffs, slim dark legs in pointed boots; a tall staff in the left hand
    topped by a gold cage round a glowing lightning orb.
    """

    J = dict(hip=0.9, waist=1.02, neck=1.42, head=1.48, top=1.7, shoulder=(0.165, 0.01, 1.38),
             elbow_x=0.205, elbow_z=1.14, wrist_x=0.23, wrist_z=0.92, hand=0.09, leg_x=0.085, knee=0.5)

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear", "Cheek"), 0.0036, 9000, None, 10),
            ("Skin", "skin", ("Face",), 0.0045, 3000, None, 12),
            ("CoatBody", "coat", ("CoatSkirt", "Sleeve", "Tail"), 0.008, 6000, None),
            ("CloudR", "cloud", ("only", "CloudR"), 0.006, 2000, None, 10),
            ("CloudL", "cloud", ("only", "CloudL"), 0.006, 2000, None, 10))
    FOLDS = ((("CoatSkirt", "CoatLining"), dict(below=0.99, n=11, amp=0.011, seed=3.0)),)
    CAPS = {"legs": 2600, "gold": 2400, "hair": 2800}
    WRAP = (("Mouth", "Face", 0.0012),)
    # white hair turning storm-cyan toward the spike tips
    PAINT = {"skin": dict(warm=1.0), "hair": dict(tip=(0.42, 0.78, 1.0), centre=(0, -0.005, 1.6), r0=0.12, r1=0.26),
             "cloud": dict(shadow=(0.55, 0.6, 0.9))}

    def __init__(self):
        super().__init__("storm", self.J)

    def body(self):
        boot = self.mat("boot", "#141a30", roughness=0.6)
        legs = self.mat("legs", "#23243a", roughness=0.85)
        coat = self.mat("coat", "#2f5ab4", roughness=0.7)
        coat_in = self.mat("coatin", "#16264e", roughness=0.8, double_sided=True)
        cuff = self.mat("cuff", "#e8eef6", roughness=0.7)
        cloud = self.mat("cloud", "#5a6c90", roughness=0.85)
        skin = self.mat("skin", "#f0d2bc", roughness=0.6)
        hair = self.mat("hair", "#f4f8ff", roughness=0.7)
        zap = self.mat("zap", "#7ae6ff", roughness=0.4, emission="#5ad8ff", strength=3.0)
        orb = self.mat("orb", "#eaffff", roughness=0.2, emission="#9ff0ff", strength=5.0)
        gold = self.mat("gold", "#e2b552", metallic=0.7, roughness=0.3)
        eye = self.mat("eye", "#141a30", roughness=0.3)
        staff = self.mat("staff", "#d8e2ea", metallic=0.4, roughness=0.35)
        J = self.J
        lx = J["leg_x"]

        # --- slim legs and pointed boots (darkest) ---
        for s, x in SIDES:
            X = lx * x
            self.add(tube(f"Thigh{s}", (X, 0, 0.94), (X, 0, 0.5), [(0, 0.075, 0.075), (1, 0.055, 0.055)], legs, seg=12), [f"thigh.{s}", f"shin.{s}", "pelvis"])
            self.add(tube(f"Shin{s}", (X, 0, 0.52), (X, 0, 0.1), [(0, 0.055, 0.055), (1, 0.045, 0.045)], legs, seg=12), [f"shin.{s}", f"thigh.{s}"])
            self.add(tube(f"BootShaft{s}", (X, 0, 0.36), (X, 0, 0.05), [(0, 0.065, 0.065), (1, 0.058, 0.06)], boot, seg=12), f"shin.{s}")
            toe = [(X, 0.03, 0.04), (X, -0.06, 0.035), (X, -0.15, 0.03), (X + 0.005 * x, -0.21, 0.05)]
            self.add(chain(f"Boot{s}", toe, [(0.06, 0.045), (0.058, 0.04), (0.04, 0.028), (0.008, 0.008)], boot, seg=12), f"foot.{s}")
            self.add(torus(f"BootCuff{s}", (X, 0, 0.36), 0.07, 0.012, gold, seg=(16, 6)), f"shin.{s}")

        # --- coat: a fitted body flaring into a short bell with a zigzag cyan hem ---
        body = [kit.ring_z(z, rx, ry) for z, rx, ry in [(0.98, 0.15, 0.11), (1.08, 0.14, 0.1), (1.22, 0.165, 0.115), (1.34, 0.18, 0.12), (1.42, 0.12, 0.09), (1.46, 0.06, 0.05)]]
        self.add(loft("CoatBody", body, coat, seg=24), ["chest", "pelvis"])
        skirt = short_skirt(J["hip"], J["knee"], 0.12)
        n, rings = 24, []
        bell = [(1.02, 0.155, 0.115), (0.92, 0.2, 0.15), (0.8, 0.25, 0.19), (0.68, 0.29, 0.22)]
        self.add(loft("CoatSkirt", [kit.ring_z(z, rx, ry) for z, rx, ry in bell], coat, seg=n, cap=(False, False)), skirt)
        self.add(loft("CoatLining", [kit.ring_z(z - 0.005, rx * 0.97, ry * 0.97) for z, rx, ry in bell], coat_in, seg=n, cap=(False, False)), skirt)
        hem = []
        for k in range(2 * n + 1):
            a = 2 * math.pi * k / (2 * n)
            z = 0.68 + (0.035 if k % 2 else -0.025)
            hem.append(Vector((0.292 * math.cos(a), 0.222 * math.sin(a), z)))
        self.add(chain("Hem", hem, [0.012] * len(hem), zap, seg=6), skirt)
        self.add(loft("Belt", [kit.ring_z(1.0, 0.158, 0.118), kit.ring_z(1.05, 0.155, 0.115)], gold, seg=24), "pelvis")
        bolt = [(0.0, -0.125, 1.38), (-0.03, -0.13, 1.28), (0.02, -0.13, 1.25), (-0.015, -0.125, 1.12)]
        self.add(chain("ChestBolt", bolt, [0.014, 0.014, 0.014, 0.004], zap, seg=6), "chest")
        back = [(0.0, 0.125, 1.38), (0.03, 0.13, 1.28), (-0.02, 0.13, 1.25), (0.015, 0.125, 1.12)]
        self.add(chain("BackBolt", back, [0.014, 0.014, 0.014, 0.004], zap, seg=6), "chest")
        # two pointed coat tails behind, on a sway chain each
        for s, x in SIDES:
            pts = [(0.07 * x, 0.15, 1.0), (0.09 * x, 0.2, 0.82), (0.1 * x, 0.23, 0.62), (0.11 * x, 0.25, 0.45)]
            bones = self.sway(f"coat{s}", "pelvis", pts)
            for k in range(3):
                a, b = Vector(pts[k]), Vector(pts[k + 1])
                w0, w1 = 0.07 - 0.02 * k, 0.05 - 0.02 * k
                panel = tube(f"Tail{s}{k}", a, b, [(0, w0, 0.012), (1, max(w1, 0.004), 0.01)], coat, seg=8, side=(1, 0, 0))
                self.add(panel, bones[k])

        # --- sleeves: navy upper arms, forearms flaring into white cuffs; small hands ---
        sx, sy, sz = J["shoulder"]
        for s, x in SIDES:
            sh, el, wr = Vector((sx * x, sy, sz)), Vector((J["elbow_x"] * x, 0, J["elbow_z"])), Vector((J["wrist_x"] * x, -0.05, J["wrist_z"]))
            self.add(tube(f"UpperArm{s}", sh, el, [(0, 0.06, 0.06), (1, 0.05, 0.05)], coat, seg=12), [f"upper_arm.{s}", f"forearm.{s}"])
            self.add(tube(f"Sleeve{s}", el, wr + (wr - el) * 0.08, [(0, 0.05, 0.05), (0.6, 0.075, 0.075), (1, 0.105, 0.1)], coat, seg=14, cap=(True, False)), f"forearm.{s}")
            self.add(tube(f"Cuff{s}", el.lerp(wr, 0.78), wr + (wr - el) * 0.1, [(0, 0.09, 0.088), (1, 0.112, 0.108)], cuff, seg=14, cap=(False, False)), f"forearm.{s}")
            self.mitten(x, skin)

        # --- storm-cloud shoulder pads with gold clasps ---
        for s, x in SIDES:
            pc = Vector((0.18 * x, 0.0, 1.43))
            pw = (lambda arm: (lambda p: {"chest": 0.6, arm: 0.4}))(f"upper_arm.{s}")
            for k, (dx, dy, dz, r) in enumerate([(0, 0, 0, 0.075), (0.05, -0.04, -0.03, 0.055), (0.05, 0.05, -0.02, 0.055), (-0.04, -0.05, 0.01, 0.05), (0.07, 0.0, -0.05, 0.05)]):
                self.add(blob(f"Cloud{s}{k}", pc + Vector((dx * x, dy, dz)), (r, r, r * 0.85), cloud, (14, 10)), pw)
            self.add(blob(f"Clasp{s}", pc + Vector((0, -0.075, 0.0)), (0.022, 0.012, 0.022), gold, (10, 8)), pw)

        # --- head: big, bright; white spiky hair with sparks ---
        C = self.CONCEPT
        # concept: a bigger head (a sprite's proportions)
        hc, hr = (Vector((0, -0.005, 1.6)), (0.135, 0.14, 0.15)) if C else (Vector((0, -0.005, 1.58)), (0.115, 0.12, 0.13))
        k_ = hr[0] / 0.115
        self.head_shape(hc, hr, skin, chin=0.5)
        # face shapes the sculpt pass melts in: cheeks, a soft chin, small ears
        for s, x in SIDES:
            self.add(blob(f"Cheek{s}", hc + Vector((0.05 * x, -0.09, -0.04)) * k_, (0.022, 0.014, 0.018), skin, (12, 8)), "head")
            self.add(blob(f"Ear{s}", hc + Vector((0.113 * x, 0.005, -0.005)) * k_, (0.014, 0.026, 0.034), skin, (10, 8)), "head")
        self.face(hc, hr, skin, self.mat("mouth", "#7a2a3c", roughness=0.5), nose=0.012, smile=0.007, width=0.024, out=0.005)
        for s, x in SIDES:
            e = 1.25 if C else 1.0  # concept: big eyes
            self.add(blob(f"Eye{s}", hc + Vector((0.042 * x * e, -0.105 * k_, 0.005)), (0.022 * e, 0.012 * e, 0.03 * e), eye, (12, 8)), "head")
            self.add(blob(f"Glint{s}", hc + Vector((0.046 * x * e, -0.116 * k_, 0.014 * e)), (0.008 * e, 0.004 * e, 0.009 * e), zap, (6, 4)), "head")
        self.add(blob("HairCap", hc + Vector((0, 0.012, 0.03)) * k_, (0.125 * k_, 0.13 * k_, 0.12 * k_), hair, (22, 14),
                          keep=lambda co: co.z > hc.z + 0.01 or co.y > hc.y + 0.03), "head")
        # pointed bangs over the forehead
        for k, dx in enumerate((-0.07, -0.035, 0.0, 0.035, 0.07)):
            top = hc + Vector((dx * 0.8, -0.085, 0.11)) * k_
            tip = hc + Vector((dx * 1.15, -0.118 + 0.01 * abs(dx) / 0.07, 0.035 - 0.012 * (k % 2))) * k_
            self.add(tube(f"Bang{k}", top, tip, [(0, 0.03, 0.02), (0.6, 0.018, 0.012), (1, 0.002, 0.002)], hair, seg=8), "head")
        self.add(blob("HairBack", hc + Vector((0, 0.045, -0.035)) * k_, (0.118 * k_, 0.09 * k_, 0.105 * k_), hair, (16, 10)), "head")
        # concept: a floating thundercloud of hair (round puffs, melted into one cloud by the sculpt pass)
        puffs = [(-0.126, 0.03, 0.09, 0.11), (0.0, 0.05, 0.15, 0.135), (0.13, 0.03, 0.094, 0.105), (-0.16, 0.06, -0.03, 0.075),
                 (0.16, 0.06, -0.03, 0.072), (-0.055, 0.04, 0.22, 0.085), (0.07, 0.04, 0.215, 0.078), (0.0, 0.11, 0.06, 0.12)]
        for k, (px, py, pz, r) in enumerate(puffs if C else ()):
            self.add(blob(f"HairCloud{k}", hc + Vector((px * 1.15, py, pz * 1.15 + 0.01)), (r * 1.25, r * 1.1, r * 1.05), hair, (16, 12)), "head")
        spikes = [] if C else [(-0.08, 0.0, 0.09, -1.1, 0.0, 0.5, 0.2), (-0.05, -0.04, 0.11, -0.6, -0.2, 1.0, 0.24), (-0.01, 0.02, 0.12, -0.15, 0.1, 1.0, 0.3),
                  (0.04, -0.03, 0.12, 0.45, -0.15, 1.0, 0.26), (0.08, 0.01, 0.09, 1.0, 0.1, 0.6, 0.22), (0.0, 0.07, 0.09, 0.0, 0.8, 0.7, 0.22),
                  (-0.07, 0.06, 0.06, -0.8, 0.7, 0.4, 0.18), (0.07, 0.06, 0.06, 0.8, 0.7, 0.4, 0.18), (-0.1, -0.02, 0.02, -1.0, -0.2, 0.0, 0.14),
                  (0.1, -0.02, 0.02, 1.0, -0.2, 0.0, 0.14)]
        for k, (x0, y0, z0, dx, dy, dz, ln) in enumerate(spikes):
            base = hc + Vector((x0, y0, z0))
            d = Vector((dx, dy, dz)).normalized()
            self.add(tube(f"Spike{k}", base, base + d * ln, [(0, 0.05, 0.035), (0.6, 0.025, 0.018), (1, 0.002, 0.002)], hair, seg=8), "head")
        for k, (x0, z0, sg) in enumerate([(-0.2, 0.2, -1), (0.19, 0.25, 1)]):
            p = hc + Vector((x0, -0.02, z0))
            pts = [p, p + Vector((0.03 * sg, 0, -0.04)), p + Vector((0.0, 0, -0.05)), p + Vector((0.03 * sg, 0, -0.1))]
            self.add(chain(f"Spark{k}", pts, [0.008, 0.008, 0.008, 0.002], zap, seg=5), "head")

        # --- the staff in the left hand: tall, a gold cage round a glowing orb ---
        hand_l = Vector((J["wrist_x"] + 0.008, -0.06, J["wrist_z"] - 0.06))
        a, b = hand_l + Vector((0.02, -0.03, -0.8)), hand_l + Vector((0.11, -0.09, 0.98 + (0.45 if C else 0.0)))
        self.add(tube("Staff", a, b, [(0, 0.014, 0.014), (1, 0.018, 0.018)], staff, seg=10), "hand.L")
        self.add(torus("Grip", hand_l + Vector((0, -0.01, 0.03)), 0.022, 0.008, gold, seg=(12, 6)), "hand.L")
        oc = b + Vector((0, 0, 0.1))
        if C:
            # three prongs round a big orb (a lightning rod)
            self.add(blob("Orb", oc + Vector((0, 0, 0.02)), (0.085, 0.085, 0.085), orb, (18, 12)), "hand.L")
            for k, d in enumerate([(-0.11, 0.0, 0.2), (0.11, 0.0, 0.2), (0.0, 0.0, 0.26)]):
                tip = b + Vector(d)
                mid = b + Vector((d[0] * 0.9, 0.0, d[2] * 0.4))
                self.add(chain(f"Prong{k}", [b, mid, tip], [0.016, 0.013, 0.004], staff, seg=8), "hand.L")
        for k in range(0 if C else 3):
            ang = k * math.pi / 3
            self.add(torus(f"Cage{k}", oc, 0.085, 0.008, gold, seg=(24, 6), axis=(math.cos(ang), math.sin(ang), 0)), "hand.L")
        self.add(lathe("CageCup", [(0.016, -0.12), (0.05, -0.08), (0.07, -0.05), (0.0, -0.05)], gold, seg=16, centre=oc), "hand.L")
        if not C:
            self.add(blob("CageTip", oc + Vector((0, 0, 0.1)), (0.014, 0.014, 0.03), gold, (8, 6)), "hand.L")
        self.joints_fill(neck=(skin, 0.042), shoulder=(coat, 0.06), elbow=(coat, 0.052), hip=(legs, 0.075), knee=(legs, 0.057))


# ============================================================================================ Vesper
class Blood(MobaFigure):
    """
    Vesper, the Crimson Countess (juggernaut caster): tall and regal; a tall fan of dark collar blades with crimson
    faces behind her head, a ruby crown, long black hair, a black corset bodice over a crimson-lined bell skirt with a
    gold hem, a long crimson cape in three tails, red glowing eyes; a short ruby scepter in the left hand.
    """

    J = dict(hip=0.92, waist=1.04, neck=1.45, head=1.51, top=1.75, shoulder=(0.165, 0.01, 1.4),
             elbow_x=0.205, elbow_z=1.16, wrist_x=0.23, wrist_z=0.94, hand=0.09, leg_x=0.085, knee=0.52)

    def __init__(self):
        super().__init__("blood", self.J)

    def body(self):
        boot = self.mat("boot", "#140a0e", roughness=0.5)
        legs = self.mat("legs", "#1c1218", roughness=0.8)
        black = self.mat("bodice", "#2a1620", roughness=0.55)
        crimson = self.mat("crimson", "#b0142c", roughness=0.6)
        lining = self.mat("lining", "#5a0a18", roughness=0.7, double_sided=True)
        gold = self.mat("gold", "#e2b552", metallic=0.7, roughness=0.3)
        skin = self.mat("skin", "#f2dcd2", roughness=0.55)
        hair = self.mat("hair", "#1a1018", roughness=0.6)
        ruby = self.mat("ruby", "#ff2a44", roughness=0.15, emission="#ff1a3a", strength=3.0)
        white = self.mat("eyewhite", "#fff4f0", roughness=0.4)
        lips = self.mat("lips", "#a01828", roughness=0.4)
        J = self.J

        self.legs(legs, boot, toe=0.22, cuff=gold)
        self.add(loft("Bodice", [kit.ring_z(z, rx, ry) for z, rx, ry in
                                 [(0.98, 0.14, 0.1), (1.08, 0.12, 0.09), (1.2, 0.14, 0.1), (1.32, 0.17, 0.115), (1.42, 0.13, 0.095), (1.47, 0.06, 0.05)]], black, seg=24), ["chest", "pelvis"])
        self.add(loft("Band", [kit.ring_z(1.13, 0.124, 0.091), kit.ring_z(1.16, 0.126, 0.092)], gold, seg=24), "chest")
        self.add(blob("Gem", (0, -0.12, 1.36), (0.026, 0.014, 0.032), ruby, (10, 8)), "chest")
        # a gold V neckline and laced front
        for s, x in SIDES:
            vee = [Vector((0.11 * x, -0.07, 1.43)), Vector((0.06 * x, -0.105, 1.36)), Vector((0.02 * x, -0.118, 1.26)), Vector((0.0, -0.12, 1.2))]
            self.add(chain(f"Neckline{s}", vee, [0.006, 0.007, 0.007, 0.005], gold, seg=6), "chest")
        for k in range(4):
            z = 1.04 + 0.04 * k
            self.add(blob(f"Lacing{k}", (0, -0.096 - 0.004 * k, z), (0.02, 0.006, 0.006), gold, (8, 6)), "chest")
        self.bell("Skirt", [(1.04, 0.13, 0.1), (0.94, 0.2, 0.16), (0.8, 0.27, 0.21), (0.66, 0.32, 0.25)], crimson, lining, hem=gold)
        self.add(loft("Belt", [kit.ring_z(1.01, 0.14, 0.105), kit.ring_z(1.06, 0.135, 0.1)], gold, seg=24), "pelvis")
        self.arms(black, black, skin, flare=0.035, cuff=crimson)
        # pointed shoulder caps
        for s, x in SIDES:
            pc = Vector((0.17 * x, 0.0, 1.42))
            pw = (lambda arm: (lambda p: {"chest": 0.6, arm: 0.4}))(f"upper_arm.{s}")
            self.add(blob(f"ShoulderCap{s}", pc, (0.07, 0.07, 0.04), crimson, (14, 10)), pw)
            self.add(tube(f"ShoulderSpike{s}", pc + Vector((0.03 * x, 0, 0.02)), pc + Vector((0.12 * x, 0.02, 0.1)), [(0, 0.03, 0.03), (1, 0.002, 0.002)], black, seg=8), pw)
        # signature: the collar-blade fan behind the head
        n = 9
        for k in range(n):
            t = (k - (n - 1) / 2) / ((n - 1) / 2)
            a = math.pi / 2 + t * 1.45
            base = Vector((0.11 * math.cos(a), 0.03 + 0.07 * math.sin(a), 1.42))
            ln = 0.34 + 0.1 * abs(t) + (0.08 if k == (n - 1) // 2 else 0.0)
            d = Vector((1.1 * math.cos(a), 0.12 + 0.3 * math.sin(a), 1.0)).normalized()
            self.add(tube(f"Blade{k}", base, base + d * ln, [(0, 0.04, 0.008), (0.75, 0.026, 0.006), (1, 0.002, 0.002)], black, seg=8), "chest")
            self.add(tube(f"BladeFace{k}", base + Vector((0, -0.007, 0.01)), base + d * ln * 0.78, [(0, 0.026, 0.004), (1, 0.002, 0.002)], crimson, seg=8), "chest")
        # head, face, hair, crown
        hc = Vector((0, -0.005, 1.6))
        r = (0.1, 0.105, 0.12)
        self.head_shape(hc, r, skin, chin=0.4)
        self.eyes(hc, r, white, ruby, white, spread=0.04, size=(0.02, 0.022), lash=hair)
        self.face(hc, r, skin, lips, nose=0.011, smile=-0.003, width=0.022)
        self.add(blob("HairCap", hc + Vector((0, 0.012, 0.025)), (0.112, 0.118, 0.11), hair, (22, 14), keep=lambda co: co.z > hc.z + 0.02 or co.y > hc.y + 0.02), "head")
        for s, x in SIDES:
            self.add(chain(f"Bang{s}", [hc + Vector((0.02 * x, -0.1, 0.07)), hc + Vector((0.07 * x, -0.1, 0.03)), hc + Vector((0.095 * x, -0.07, -0.04))], [0.025, 0.02, 0.008], hair, seg=10), "head")
        locks = [hc + Vector(v) for v in [(0, 0.08, 0.0), (0, 0.13, -0.15), (0, 0.17, -0.32), (0, 0.19, -0.5)]]
        bones = self.sway("hair", "head", locks)
        for i in range(3):
            self.add(tube(f"Hair{i}", locks[i], locks[i + 1], [(0, 0.1 - 0.02 * i, 0.04), (1, 0.08 - 0.025 * i, 0.03)], hair, seg=12, side=(1, 0, 0)), bones[i])
        crown = hc + Vector((0, -0.01, 0.1))
        self.add(torus("Crown", crown, 0.085, 0.01, gold, seg=(32, 6)), "head")
        for k in range(5):
            a = -math.pi / 2 + (k - 2) * 0.45
            p = crown + Vector((0.085 * math.cos(a), 0.085 * math.sin(a), 0.0))
            self.add(tube(f"CrownSpike{k}", p, p + Vector((0, 0, 0.05 + (0.03 if k == 2 else 0))), [(0, 0.012, 0.012), (1, 0.002, 0.002)], gold, seg=6), "head")
        self.add(blob("CrownGem", crown + Vector((0, -0.088, 0.02)), (0.016, 0.01, 0.02), ruby, (8, 6)), "head")
        # cape
        self.cape("cape", crimson, 1.42, 0.36, 1.0, tails=3)
        # scepter in the left hand
        h = self.hand_at(1)
        a, b = h + Vector((0, 0, -0.18)), h + Vector((0.02, -0.04, 0.42))
        self.add(tube("Scepter", a, b, [(0, 0.012, 0.012), (1, 0.016, 0.016)], gold, seg=8), "hand.L")
        self.add(blob("ScepterGem", b + Vector((0, 0, 0.05)), (0.035, 0.035, 0.05), ruby, (12, 10)), "hand.L")
        self.add(torus("ScepterRing", b + Vector((0, 0, 0.02)), 0.04, 0.008, gold, seg=(20, 6)), "hand.L")
        self.joints_fill(neck=(skin, 0.042), shoulder=(black, 0.058), elbow=(black, 0.05), wrist=(skin, 0.036), hip=(legs, 0.075), knee=(legs, 0.056))


# ============================================================================================ Isolde
class Frost(MobaFigure):
    """
    Isolde, the Winter Warden (controller): tall and calm; a halo of ice shards standing behind her head, silver hair
    in a high bun, ice-crystal shoulder spikes, a pale blue bodice over a white bell skirt with a shard hem, a deep blue
    sash; an ice spear in the left hand.
    """

    J = dict(hip=0.92, waist=1.04, neck=1.45, head=1.51, top=1.75, shoulder=(0.165, 0.01, 1.4),
             elbow_x=0.205, elbow_z=1.16, wrist_x=0.23, wrist_z=0.94, hand=0.09, leg_x=0.085, knee=0.52)

    def __init__(self):
        super().__init__("frost", self.J)

    def body(self):
        boot = self.mat("boot", "#1a2a48", roughness=0.5)
        legs = self.mat("legs", "#24324e", roughness=0.8)
        blue = self.mat("bodice", "#6aa8e0", roughness=0.55)
        white = self.mat("skirt", "#e6f2fc", roughness=0.6)
        lining = self.mat("lining", "#8ab8e0", roughness=0.7, double_sided=True)
        sash = self.mat("sash", "#1e4a8a", roughness=0.6)
        silver = self.mat("silver", "#d0dce8", metallic=0.7, roughness=0.25)
        ice = self.mat("ice", "#bfeaff", roughness=0.05, coat=1.0, emission="#7fd4ff", strength=1.5)
        skin = self.mat("skin", "#f0dcd4", roughness=0.55)
        hair = self.mat("hair", "#e8eef6", roughness=0.6)
        eyew = self.mat("eyewhite", "#ffffff", roughness=0.4)
        iris = self.mat("iris", "#3ab0ff", roughness=0.2, emission="#3ab0ff", strength=1.0)
        lash = self.mat("lash", "#2a3a5a", roughness=0.5)

        self.legs(legs, boot, toe=0.2, cuff=silver)
        self.add(loft("Bodice", [kit.ring_z(z, rx, ry) for z, rx, ry in
                                 [(0.98, 0.14, 0.1), (1.08, 0.125, 0.09), (1.2, 0.14, 0.1), (1.32, 0.165, 0.112), (1.42, 0.125, 0.092), (1.47, 0.06, 0.05)]], blue, seg=24), ["chest", "pelvis"])
        self.add(loft("Collar", [kit.ring_z(1.42, 0.13, 0.1), kit.ring_z(1.49, 0.085, 0.075)], white, seg=24, cap=(False, False)), "chest")
        self.bell("Skirt", [(1.04, 0.13, 0.1), (0.92, 0.21, 0.16), (0.78, 0.28, 0.21), (0.64, 0.33, 0.25)], white, lining, hem=ice, zig=0.04)
        self.add(loft("Sash", [kit.ring_z(1.0, 0.142, 0.106), kit.ring_z(1.07, 0.137, 0.102)], sash, seg=24), "pelvis")
        for s, x in SIDES:
            tail = [Vector((0.05 * x, 0.11, 1.03)), Vector((0.08 * x, 0.18, 0.86)), Vector((0.1 * x, 0.24, 0.68))]
            bones = self.sway(f"sash{s}", "pelvis", tail)
            for i in range(2):
                self.add(tube(f"SashTail{s}{i}", tail[i], tail[i + 1], [(0, 0.035, 0.008), (1, 0.042, 0.008)], sash, seg=8, side=(1, 0, 0)), bones[i])
        self.add(blob("SashKnot", (0, 0.11, 1.04), (0.045, 0.03, 0.035), sash, (12, 8)), "pelvis")
        self.add(blob("Brooch", (0, -0.12, 1.36), (0.025, 0.012, 0.03), ice, (10, 8)), "chest")
        # frost-flake pattern round the skirt: six small six-armed flakes
        frost = self.mat("frostline", "#9fd2f4", roughness=0.4)
        skirt_w = short_skirt(self.J["hip"], self.J["knee"], 0.12)
        for k in range(6):
            a = -math.pi / 2 + (k - 2.5) * 0.55
            c = Vector((0.3 * math.cos(a) * 0.93, 0.225 * math.sin(a) * 0.93 - 0.005, 0.75))
            out = Vector((math.cos(a), math.sin(a) * 0.75, 0)).normalized()
            side = Vector((-out.y, out.x, 0))
            for j in range(3):
                ang = j * math.pi / 3
                d = side * math.cos(ang) + Vector((0, 0, 1)) * math.sin(ang)
                self.add(tube(f"Flake{k}{j}", c - d * 0.03, c + d * 0.03, [(0, 0.004, 0.004), (1, 0.004, 0.004)], frost, seg=5), skirt_w)
        self.arms(blue, blue, skin, flare=0.03, cuff=white)
        # ice-crystal shoulder spikes
        for s, x in SIDES:
            pc = Vector((0.17 * x, 0.0, 1.43))
            pw = (lambda arm: (lambda p: {"chest": 0.6, arm: 0.4}))(f"upper_arm.{s}")
            self.add(blob(f"Pad{s}", pc, (0.07, 0.07, 0.04), silver, (14, 10)), pw)
            for k, (dx, dz, ln) in enumerate([(0.6, 1.0, 0.13), (1.0, 0.5, 0.1), (0.2, 1.0, 0.08)]):
                d = Vector((dx * x, 0.05 * (k - 1), dz)).normalized()
                self.add(tube(f"Shard{s}{k}", pc + Vector((0.02 * x, 0, 0.02)), pc + d * ln, [(0, 0.025, 0.02), (1, 0.002, 0.002)], ice, seg=6), pw)
        # signature: the ice-shard halo behind the head
        hc = Vector((0, -0.005, 1.6))
        halo = hc + Vector((0, 0.12, 0.06))
        for k in range(9):
            a = math.pi / 2 + (k - 4) * 0.36
            d = Vector((math.cos(a) * 1.0, 0.0, math.sin(a) * 1.0)).normalized()
            ln = 0.16 + (0.1 if k == 4 else 0.05 * (k % 2))
            base = halo + d * 0.13
            self.add(tube(f"Halo{k}", base, base + d * ln, [(0, 0.03, 0.012), (1, 0.002, 0.002)], ice, seg=6), "head")
        self.add(torus("HaloRing", halo, 0.13, 0.01, silver, seg=(40, 6), axis=(0, 1, 0)), "head")
        r = (0.1, 0.105, 0.12)
        self.head_shape(hc, r, skin, chin=0.4)
        self.eyes(hc, r, eyew, iris, eyew, spread=0.04, size=(0.02, 0.024), lash=lash)
        self.face(hc, r, skin, self.mat("lips", "#9a4a64", roughness=0.4), nose=0.011, smile=0.005, width=0.021)
        self.add(blob("HairCap", hc + Vector((0, 0.012, 0.03)), (0.112, 0.118, 0.11), hair, (22, 14), keep=lambda co: co.z > hc.z + 0.02 or co.y > hc.y + 0.02), "head")
        self.add(blob("Bun", hc + Vector((0, 0.06, 0.13)), (0.07, 0.065, 0.06), hair, (16, 12)), "head")
        for s, x in SIDES:
            self.add(chain(f"Bang{s}", [hc + Vector((0.01 * x, -0.1, 0.075)), hc + Vector((0.07 * x, -0.1, 0.035)), hc + Vector((0.098 * x, -0.06, -0.06))], [0.024, 0.02, 0.008], hair, seg=10), "head")
        # ice spear in the left hand
        h = self.hand_at(1)
        a, b = h + Vector((0.01, -0.02, -0.75)), h + Vector((0.09, -0.08, 0.95))
        self.add(tube("Spear", a, b, [(0, 0.012, 0.012), (1, 0.015, 0.015)], silver, seg=8), "hand.L")
        d = (b - a).normalized()
        self.add(tube("SpearHead", b, b + d * 0.24, [(0, 0.045, 0.02), (0.3, 0.05, 0.022), (1, 0.002, 0.002)], ice, seg=8), "hand.L")
        self.add(torus("SpearCollar", b, 0.025, 0.008, silver, seg=(16, 6), axis=d), "hand.L")
        self.joints_fill(neck=(skin, 0.042), shoulder=(blue, 0.058), elbow=(blue, 0.05), wrist=(skin, 0.036), hip=(legs, 0.075), knee=(legs, 0.056))


# ============================================================================================ Zephyr
class Sky(MobaFigure):
    """
    Zephyr, the Wind Blade (assassin): lean and quick; a very long jade scarf streaming behind him on a sway chain,
    a cloth mask over the lower face, white hair swept back like wind, a short teal coat over light leather, wrapped
    shins; a curved blade in the right hand.
    """

    J = dict(hip=0.93, waist=1.05, neck=1.46, head=1.52, top=1.76, shoulder=(0.19, 0.01, 1.42),
             elbow_x=0.235, elbow_z=1.17, wrist_x=0.26, wrist_z=0.93, hand=0.1, leg_x=0.095, knee=0.52)

    def __init__(self):
        super().__init__("sky", self.J)

    def body(self):
        boot = self.mat("boot", "#1a2622", roughness=0.6)
        legs = self.mat("legs", "#2a3a3a", roughness=0.8)
        wrap = self.mat("wrap", "#c8d4cc", roughness=0.8)
        coat = self.mat("coat", "#1fa08a", roughness=0.6)
        coat_in = self.mat("lining", "#0e5a4e", roughness=0.7, double_sided=True)
        leather = self.mat("leather", "#5a4030", roughness=0.7)
        scarf = self.mat("scarf", "#36dcb4", roughness=0.6)
        skin = self.mat("skin", "#e8c8ac", roughness=0.55)
        hair = self.mat("hair", "#eef6f4", roughness=0.6)
        steel = self.mat("steel", "#d8e4ea", metallic=0.8, roughness=0.2)
        edge = self.mat("edge", "#8ffff0", roughness=0.2, emission="#5affe8", strength=2.0)
        eyew = self.mat("eyewhite", "#ffffff", roughness=0.4)
        iris = self.mat("iris", "#20c8a0", roughness=0.2)
        brow = self.mat("brow", "#b8c8c4", roughness=0.6)

        self.legs(legs, boot, thigh=(0.07, 0.052), shin=0.046, boot_r=0.055, boot_top=0.22, toe=0.2)
        for s, x in SIDES:
            X = self.J["leg_x"] * x
            # wraps hugging the shin (its radius tapers from 0.052 at the knee to 0.046 at the ankle)
            self.add(tube(f"WrapCore{s}", (X, 0, 0.22), (X, 0, 0.47), [(0, 0.052, 0.052), (1, 0.054, 0.054)], wrap, seg=12), f"shin.{s}")
            for k in range(4):
                self.add(torus(f"Wrap{s}{k}", (X, 0, 0.25 + 0.06 * k), 0.054, 0.007, self.mat("wrapline", "#8a9890", roughness=0.8), seg=(16, 6)), f"shin.{s}")
        self.add(loft("Torso", [kit.ring_z(z, rx, ry) for z, rx, ry in
                                [(0.96, 0.15, 0.11), (1.08, 0.145, 0.1), (1.22, 0.165, 0.11), (1.34, 0.19, 0.12), (1.43, 0.14, 0.1), (1.48, 0.06, 0.05)]], coat, seg=24), ["chest", "pelvis"])
        self.add(loft("Belt", [kit.ring_z(0.99, 0.158, 0.118), kit.ring_z(1.05, 0.152, 0.112)], leather, seg=24), "pelvis")
        # a short split coat skirt: front open, two side panels
        self.bell("CoatSkirt", [(1.04, 0.155, 0.115), (0.9, 0.2, 0.15), (0.74, 0.24, 0.18)], coat, coat_in, hem=edge)
        self.add(box("Strap", (0, -0.12, 1.25), (0.05, 0.02, 0.36), leather, rotation=Euler((0, 0.6, 0))), "chest")
        self.add(box("StrapBuckle", (0.0, -0.133, 1.25), (0.045, 0.012, 0.04), steel, rotation=Euler((0, 0.6, 0))), "chest")
        # the coat's front opening: a darker edge down the middle
        self.add(chain("CoatEdge", [Vector((0.02, -0.122, 1.44)), Vector((0.03, -0.112, 1.2)), Vector((0.025, -0.16, 0.9)), Vector((0.02, -0.18, 0.75))], [0.008, 0.008, 0.008, 0.008], coat_in, seg=6), ["chest", "pelvis"])
        self.arms(coat, leather, skin, r=(0.058, 0.05, 0.045), hand=(0.045, 0.05, 0.065))
        for s, x in SIDES:
            pc = Vector((0.19 * x, 0.0, 1.43))
            pw = (lambda arm: (lambda p: {"chest": 0.55, arm: 0.45}))(f"upper_arm.{s}")
            self.add(blob(f"Pad{s}", pc, (0.075, 0.075, 0.045), leather, (14, 10)), pw)
        # head: swept-back hair, mask, sharp eyes
        hc = Vector((0, -0.005, 1.61))
        r = (0.1, 0.108, 0.12)
        self.head_shape(hc, r, skin, chin=0.6)
        self.eyes(hc, r, eyew, iris, eyew, spread=0.04, size=(0.02, 0.016), z=0.01)
        for s, x in SIDES:
            self.add(chain(f"Brow{s}", [hc + Vector((0.02 * x, -0.1, 0.035)), hc + Vector((0.055 * x, -0.095, 0.045)), hc + Vector((0.075 * x, -0.08, 0.05))], [0.006, 0.008, 0.004], brow, seg=6), "head")
        self.add(blob("Mask", hc + Vector((0, -0.03, -0.055)), (0.105, 0.1, 0.06), scarf, (18, 12), keep=lambda co: co.z < hc.z - 0.015), "head")
        self.add(blob("HairCap", hc + Vector((0, 0.015, 0.035)), (0.112, 0.12, 0.105), hair, (22, 14), keep=lambda co: co.z > hc.z + 0.02 or co.y > hc.y + 0.03), "head")
        for k, (x0, z0, ln) in enumerate([(0.0, 0.1, 0.26), (-0.06, 0.07, 0.22), (0.06, 0.07, 0.22), (-0.09, 0.02, 0.17), (0.09, 0.02, 0.17), (0.0, 0.03, 0.2)]):
            base = hc + Vector((x0, -0.02, z0))
            d = Vector((x0 * 1.5, 1.0, 0.35 - 0.2 * abs(x0) * 10 * 0.1)).normalized()
            self.add(tube(f"Swept{k}", base, base + d * ln, [(0, 0.04, 0.03), (0.6, 0.022, 0.016), (1, 0.002, 0.002)], hair, seg=8), "head")
        # signature: the long scarf, wrapped at the neck, streaming behind on a sway chain
        self.add(torus("ScarfWrap", (0, 0.0, 1.47), 0.085, 0.035, scarf, seg=(28, 10)), "neck")
        tail = [Vector(v) for v in [(0.05, 0.09, 1.47), (0.08, 0.16, 1.32), (0.1, 0.21, 1.15), (0.12, 0.25, 0.98), (0.13, 0.28, 0.8)]]
        bones = self.sway("scarf", "neck", tail)
        for i in range(4):
            self.add(tube(f"Scarf{i}", tail[i], tail[i + 1], [(0, 0.06, 0.012), (1, 0.06 - 0.008 * i, 0.012)], scarf, seg=8, side=(0, 0, 1)), bones[i])
        # curved blade in the right hand, pointing down and forward
        h = self.hand_at(-1)
        self.add(tube("Grip", h + Vector((0, 0, 0.06)), h + Vector((0, -0.02, -0.08)), [(0, 0.016, 0.016), (1, 0.016, 0.016)], leather, seg=8), "hand.R")
        self.add(torus("Guard", h + Vector((0, -0.02, -0.08)), 0.035, 0.01, steel, seg=(16, 6)), "hand.R")
        arc = [h + Vector((0, -0.02 - 0.12 * t - 0.25 * t * t, -0.09 - 0.55 * t + 0.12 * t * t)) for t in (0.0, 0.25, 0.5, 0.75, 1.0)]
        self.add(chain("Blade", arc, [(0.006, 0.03), (0.006, 0.035), (0.005, 0.033), (0.004, 0.025), (0.002, 0.004)], steel, seg=6, side=(1, 0, 0)), "hand.R")
        self.add(chain("BladeEdge", [p + Vector((0, -0.028, -0.004)) for p in arc[1:]], [0.005, 0.006, 0.005, 0.002], edge, seg=5), "hand.R")
        self.joints_fill(neck=(skin, 0.045), shoulder=(coat, 0.062), elbow=(leather, 0.054), wrist=(skin, 0.04), hip=(legs, 0.072), knee=(legs, 0.054))


# ============================================================================================ Oblivion
class Void(MobaFigure):
    """
    Oblivion, the Unmaker (juggernaut): huge and dark; a horned great-helm with a glowing violet eye slit, layered
    spiked pauldrons, black plate with a violet rift core in the chest, a tattered cape in four tails, armoured legs;
    a greatsword with a violet void edge held low in the right hand.
    """

    J = dict(hip=0.86, waist=0.98, neck=1.49, head=1.55, top=1.82, shoulder=(0.28, 0.02, 1.43),
             elbow_x=0.35, elbow_z=1.16, wrist_x=0.39, wrist_z=0.9, hand=0.12, leg_x=0.13, knee=0.46)

    def __init__(self):
        super().__init__("void", self.J)

    def body(self):
        plate = self.mat("plate", "#4a4458", metallic=0.5, roughness=0.38)
        dark = self.mat("dark", "#141018", roughness=0.7)
        trim = self.mat("trim", "#8a84a0", metallic=0.6, roughness=0.3)
        bone = self.mat("bone", "#e6dcc8", roughness=0.5)
        rift = self.mat("rift", "#c060ff", roughness=0.3, emission="#a040ff", strength=4.0)
        cape = self.mat("cape", "#2a0f3a", roughness=0.8, double_sided=True)
        J = self.J
        lx = J["leg_x"]

        # armoured legs
        for s, x in SIDES:
            X = lx * x
            self.add(tube(f"Thigh{s}", (X, 0, 0.9), (X, 0, 0.46), [(0, 0.1, 0.1), (1, 0.085, 0.085)], dark, seg=12), [f"thigh.{s}", f"shin.{s}", "pelvis"])
            self.add(tube(f"Greave{s}", (X, -0.01, 0.48), (X, -0.01, 0.06), [(0, 0.1, 0.1), (0.5, 0.105, 0.105), (1, 0.11, 0.11)], plate, seg=14), f"shin.{s}")
            self.add(blob(f"Knee{s}", (X, -0.07, 0.47), (0.08, 0.05, 0.08), trim, (14, 10)), f"shin.{s}")
            self.add(tube(f"KneeSpike{s}", (X, -0.1, 0.48), (X, -0.2, 0.52), [(0, 0.03, 0.03), (1, 0.002, 0.002)], bone, seg=8), f"shin.{s}")
            self.add(box(f"Sabaton{s}", (X, -0.06, 0.05), (0.2, 0.3, 0.1), plate, bevel=0.03), f"foot.{s}")
        # plate skirt (tassets) in front and back panels
        skirt = short_skirt(J["hip"], J["knee"], 0.16)
        self.bell("Tassets", [(0.98, 0.27, 0.21), (0.85, 0.31, 0.24), (0.68, 0.33, 0.26)], plate, dark, weights=skirt, hem=trim)
        # torso: broad plate cuirass with a rift core
        self.add(loft("Cuirass", [kit.ring_z(z, rx, ry) for z, rx, ry in
                                  [(0.9, 0.25, 0.19), (1.0, 0.27, 0.2), (1.16, 0.31, 0.23), (1.32, 0.34, 0.25), (1.44, 0.28, 0.21), (1.52, 0.12, 0.1)]], plate, seg=28), ["chest", "pelvis"])
        self.add(loft("Belt", [kit.ring_z(0.96, 0.272, 0.205), kit.ring_z(1.02, 0.275, 0.207)], trim, seg=28), "pelvis")
        # tasset plates over the skirt, front and sides, each edged in trim
        for k in range(5):
            a = -math.pi / 2 + (k - 2) * 0.42
            c0 = Vector((0.3 * math.cos(a), 0.235 * math.sin(a), 0.82))
            out = Vector((math.cos(a), math.sin(a) * 0.78, 0)).normalized()
            rot = Euler((0, 0, math.atan2(out.y, out.x) + math.pi / 2))
            self.add(box(f"Tasset{k}", c0 + out * 0.02, (0.13, 0.025, 0.2), plate, bevel=0.01, rotation=rot), skirt)
            self.add(box(f"TassetRim{k}", c0 + out * 0.03 + Vector((0, 0, -0.1)), (0.135, 0.012, 0.016), trim, bevel=0.004, rotation=rot), skirt)
        c = Vector((0, -0.24, 1.24))
        self.add(blob("Rift", c, (0.06, 0.03, 0.14), rift, (14, 12)), "chest")
        # thin rift veins running out from the core across the cuirass
        for s, x in SIDES:
            for k, (dz, ex, ez) in enumerate([(0.08, 0.2, 0.18), (-0.06, 0.22, -0.12)]):
                pts = [c + Vector((0.06 * x, 0.005, dz)), c + Vector((0.12 * x, 0.02, dz + ez * 0.4)), c + Vector((ex * x, 0.06, dz + ez))]
                self.add(chain(f"Vein{s}{k}", pts, [0.008, 0.006, 0.002], rift, seg=6), "chest")
        for s, x in SIDES:
            self.add(tube(f"RiftJaw{s}", c + Vector((0.07 * x, 0.0, 0.16)), c + Vector((0.07 * x, -0.01, -0.16)), [(0, 0.012, 0.02), (0.5, 0.025, 0.03), (1, 0.012, 0.02)], trim, seg=10), "chest")
        # arms: plated, with gauntlets
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            self.add(tube(f"UpperArm{s}", sh, el, [(0, 0.095, 0.095), (1, 0.085, 0.085)], dark, seg=12), [f"upper_arm.{s}", f"forearm.{s}"])
            self.add(tube(f"Vambrace{s}", el, wr, [(0, 0.09, 0.09), (0.4, 0.11, 0.105), (1, 0.095, 0.09)], plate, seg=14), f"forearm.{s}")
            self.add(blob(f"Elbow{s}", el + Vector((0, 0.04, 0)), (0.07, 0.06, 0.07), trim, (12, 8)), f"forearm.{s}")
            self.add(blob(f"Gauntlet{s}", self.hand_at(x) + Vector((0, 0, -0.01)), (0.08, 0.085, 0.095), plate, (14, 10)), f"hand.{s}")
        # signature 1: layered spiked pauldrons
        for s, x in SIDES:
            pc = Vector((0.33 * x, 0.0, 1.47))
            pw = (lambda arm: (lambda p: {"chest": 0.65, arm: 0.35}))(f"upper_arm.{s}")
            for k in range(3):
                self.add(blob(f"Pauldron{s}{k}", pc + Vector((0.02 * k * x, 0, -0.06 * k)), (0.2 - 0.02 * k, 0.19 - 0.015 * k, 0.1), plate if k == 0 else dark, (20, 12), keep=(lambda co, z=pc.z - 0.06 * k: co.z > z - 0.04)), pw)
                self.add(torus(f"PauldronRim{s}{k}", pc + Vector((0.02 * k * x, 0, -0.06 * k - 0.035)), 0.18 - 0.02 * k, 0.008, trim, seg=(28, 6)), pw)
            for k, (dx, dy, ln) in enumerate([(0.3, -0.3, 0.2), (0.5, 0.0, 0.26), (0.3, 0.35, 0.2)]):
                base = pc + Vector((0.05 * x, dy * 0.25, 0.06))
                d = Vector((dx * x, dy, 1.0)).normalized()
                self.add(tube(f"PSpike{s}{k}", base, base + d * ln, [(0, 0.035, 0.035), (1, 0.002, 0.002)], bone, seg=8), pw)
        # signature 2: the horned great-helm with a glowing eye slit
        hc = Vector((0, -0.01, 1.65))
        self.add(blob("Helm", hc, (0.135, 0.145, 0.16), plate, (22, 16)), "head")
        self.add(box("Faceplate", hc + Vector((0, -0.12, -0.02)), (0.2, 0.06, 0.22), plate, bevel=0.03), "head")
        self.add(box("EyeSlit", hc + Vector((0, -0.152, 0.025)), (0.16, 0.012, 0.025), rift, bevel=0.006), "head")
        self.add(box("Crest", hc + Vector((0, 0.0, 0.14)), (0.03, 0.26, 0.06), trim, bevel=0.012), "head")
        for s, x in SIDES:
            horn = [hc + Vector(v) for v in [(0.11 * x, -0.02, 0.07), (0.2 * x, 0.0, 0.14), (0.26 * x, 0.04, 0.26), (0.24 * x, 0.08, 0.38)]]
            self.add(chain(f"Horn{s}", horn, [0.04, 0.032, 0.02, 0.003], bone, seg=10), "head")
        # tattered cape
        self.cape("cape", cape, 1.46, 0.5, 1.15, tails=4, ragged=0.25, back=0.2)
        # greatsword held low in the right hand, blade down and forward
        h = self.hand_at(-1)
        self.add(tube("SwordGrip", h + Vector((0, 0, 0.12)), h + Vector((0, -0.02, -0.06)), [(0, 0.022, 0.022), (1, 0.022, 0.022)], dark, seg=8), "hand.R")
        self.add(blob("Pommel", h + Vector((0, 0.005, 0.14)), (0.03, 0.03, 0.03), rift, (10, 8)), "hand.R")
        guard = h + Vector((0, -0.025, -0.08))
        self.add(box("Guard", guard, (0.28, 0.05, 0.05), trim, bevel=0.015), "hand.R")
        tip = guard + Vector((0, -0.42, -0.72))
        d = (tip - guard).normalized()
        self.add(tube("Blade", guard, tip, [(0, 0.07, 0.014), (0.85, 0.06, 0.012), (1, 0.003, 0.003)], dark, seg=8, side=(1, 0, 0)), "hand.R")
        for s, x in SIDES:
            self.add(tube(f"VoidEdge{s}", guard + Vector((0.068 * x, 0, 0)), tip + Vector((0.004 * x, 0, 0)), [(0, 0.008, 0.008), (0.85, 0.01, 0.01), (1, 0.002, 0.002)], rift, seg=6), "hand.R")
        self.joints_fill(neck=(dark, 0.085), shoulder=(dark, 0.1), wrist=(dark, 0.085), hip=(dark, 0.1), knee=(dark, 0.088))


class ForgeConcept(Forge):
    """Brannoc in the concept sheet's shape: an inverted-triangle torso, a head sunk into the shoulders, smoking chimney
    stacks on the shoulders, fists as big as his head, a welding mask with one glowing slit."""
    CONCEPT = True
    # everything smooth: the iron body and helmet, the trousers, boots, chimney stacks and smoke each melted into one shape
    FUSE = Forge.FUSE + (("IronBody", "iron", ("only", "Torso", "Bracer", "Cap", "VisorBand"), 0.008, 6000, None, 14),
                         ("Legs", "trousers", (), 0.008, 3000, None, 14),
                         ("Boots", "boot", (), 0.008, 2500, None, 10),
                         ("Stacks", "steel", ("only", "Stack", "ForgePack"), 0.008, 2500, None, 8),
                         ("SmokeR", "smoke", ("only", "SmokeR"), 0.008, 600, None, 6),
                         ("SmokeL", "smoke", ("only", "SmokeL"), 0.008, 600, None, 6))


class StormConcept(Storm):
    """Kaia in the concept sheet's shape: a big head with big eyes, a thundercloud of hair, a staff twice her height
    with three prongs round the orb."""
    CONCEPT = True
    FUSE = Storm.FUSE + (("HairCloud", "hair", ("only", "HairCloud", "HairCap", "HairBack"), 0.007, 4000, None, 12),
                         ("LegsBody", "legs", (), 0.006, 3000, None, 12),
                         ("Boots", "boot", (), 0.006, 1800, None, 8))
    PAINT = dict(Storm.PAINT, hair=dict(shadow=(0.6, 0.7, 1.0)))


FIGURES = {"forge": Forge, "storm": Storm, "forge_c": ForgeConcept, "storm_c": StormConcept, "blood": Blood, "frost": Frost, "sky": Sky, "void": Void}


def _reload():
    for mod in (kit, dao, figure_kit):
        importlib.reload(mod)


def build(name, reload=True):
    if reload:
        _reload()
    dao.setup_scene()
    f = FIGURES[name]()
    return f.build(), f


def export(name, keep=False, reload=True):
    """Build a figure and export it to public/models/heroes/<name>_v2.glb (meshopt, skinned)."""
    coll, f = build(name, reload)
    path = os.path.join(OUT, f"{name}_v2.glb")
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    objs = list(coll.objects)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    dao._export(
        path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
        export_skins=True, export_morph=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    )
    st = kit.stats(coll)
    if not keep:
        kit.clear(coll)
        kit.purge()
    return {"hero": name, "triangles": st["triangles"], "kb": round(os.path.getsize(path) / 1024), "path": path}
