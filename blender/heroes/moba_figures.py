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
from mathutils import Euler, Matrix, Vector  # noqa: E402

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

    def hand_grip(self, x):
        """The centre of a heavy fist from `fist`: a haft through here comes out above and below it."""
        return Vector(((self.J["wrist_x"] + 0.01) * x, -0.06, self.J["wrist_z"] - 0.075))

    def fist(self, x, skin, size=1.0):
        """A big closed hand for a heavy build: a fist, four fingers curled to the front, and a thumb across them."""
        s = "L" if x > 0 else "R"
        h = self.hand_grip(x)
        self.add(blob(f"Fist{s}", h, (0.092 * size, 0.098 * size, 0.1 * size), skin, (16, 12)), f"hand.{s}")
        for k in range(4):
            fx = h.x + (-0.054 + 0.036 * k) * size
            self.add(blob(f"Finger{s}{k}", (fx, h.y - 0.078 * size, h.z - 0.03 * size), (0.024 * size, 0.032 * size, 0.042 * size), skin, (10, 8)), f"hand.{s}")
        self.add(blob(f"Thumb{s}", h + Vector((-0.05 * x, -0.082, 0.035)) * size, (0.03 * size, 0.032 * size, 0.04 * size), skin, (10, 8)), f"hand.{s}")

    def grin(self, hc, r, z, width, lift, thick, mouth, teeth=None, skew=0.0):
        """A wide smile on a head from `head_shape`: a thick curved mouth, optional teeth in it. WRAP lays them on the face."""
        def line(w, k):
            pts = []
            for i in range(17):
                dx = w * (i / 8 - 1)
                y = hc.y - r[1] * 0.97 * math.sqrt(max(0.0, 1 - (dx / r[0]) ** 2)) - 0.012
                pts.append(Vector((dx, y, hc.z + z * r[2] + lift * (dx / width) ** 2 + skew * dx / width + k)))
            return pts
        # flat crescents, not tubes: a shrink-wrap lays a sheet cleanly on the face, but crumples a thin tube
        self.add(kit.ribbon("Mouth", line(width, 0.0), lambda t: 2 * thick * math.sin(math.pi * t) ** 0.7, mouth), "head")
        if teeth:
            self.add(kit.ribbon("Teeth", line(width * 0.72, thick * 0.32), lambda t: thick * 0.85 * math.sin(math.pi * t) ** 0.45, teeth), "head")

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
    Concept shapes: a big head with big eyes, the blade fan half again as tall (a crimson V behind her), a wide bell
    skirt and a long scepter with a fist-sized ruby in a gold claw.
    """

    J = dict(hip=0.92, waist=1.04, neck=1.45, head=1.51, top=1.82, shoulder=(0.165, 0.01, 1.4),
             elbow_x=0.205, elbow_z=1.16, wrist_x=0.23, wrist_z=0.94, hand=0.09, leg_x=0.085, knee=0.52)

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear", "Cheek"), 0.0036, 9000, None, 10),
            ("Skin", "skin", ("Face",), 0.0045, 3000, None, 12),
            ("BodiceBody", "bodice", (), 0.007, 5000, None, 12),
            ("LegsBody", "legs", (), 0.006, 2500, None, 12),
            ("Boots", "boot", (), 0.006, 1800, None, 8))
    FOLDS = ((("Skirt",), dict(below=1.0, n=13, amp=0.012, seed=5.0)),)
    WRAP = (("Mouth", "Face", 0.0012),)
    PAINT = {"skin": dict(warm=0.7), "hair": dict(shadow=(0.55, 0.35, 0.6)), "crimson": dict(shadow=(0.6, 0.3, 0.5))}

    def __init__(self):
        super().__init__("blood", self.J)

    def body(self):
        boot = self.mat("boot", "#140a0e", roughness=0.5)
        legs = self.mat("legs", "#1c1218", roughness=0.8)
        black = self.mat("bodice", "#2a1620", roughness=0.55)
        crimson = self.mat("crimson", "#b0142c", roughness=0.6)
        lining = self.mat("lining", "#5a0a18", roughness=0.7, double_sided=True)
        gold = self.mat("gold", "#e2b552", metallic=0.7, roughness=0.3)
        skin = self.mat("skin", "#eac6b6", roughness=0.55)
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
        self.bell("Skirt", [(1.04, 0.13, 0.1), (0.94, 0.22, 0.17), (0.8, 0.31, 0.24), (0.64, 0.38, 0.29)], crimson, lining, hem=gold)
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
            # concept: half again as tall and wide
            base = Vector((0.12 * math.cos(a), 0.05 + 0.07 * math.sin(a), 1.42))
            ln = (0.34 + 0.12 * abs(t) + (0.1 if k == (n - 1) // 2 else 0.0)) * 1.5
            d = Vector((1.25 * math.cos(a), 0.18 + 0.3 * math.sin(a), 1.0)).normalized()
            self.add(tube(f"Blade{k}", base, base + d * ln, [(0, 0.06, 0.012), (0.75, 0.04, 0.009), (1, 0.002, 0.002)], black, seg=8), "chest")
            self.add(tube(f"BladeFace{k}", base + Vector((0, -0.011, 0.01)), base + d * ln * 0.8, [(0, 0.04, 0.005), (1, 0.002, 0.002)], crimson, seg=8), "chest")
        # head, face, hair, crown
        # concept: a big head (a sprite's proportions) with big eyes
        hc = Vector((0, -0.01, 1.63))
        r = (0.125, 0.13, 0.142)
        self.head_shape(hc, r, skin, chin=0.4)
        for s, x in SIDES:
            self.add(blob(f"Cheek{s}", hc + Vector((0.055 * x, -0.112, -0.05)), (0.026, 0.016, 0.02), skin, (12, 8)), "head")
            self.add(blob(f"Ear{s}", hc + Vector((0.122 * x, 0.005, -0.005)), (0.014, 0.026, 0.034), skin, (10, 8)), "head")
        self.eyes(hc, r, white, ruby, white, spread=0.052, size=(0.028, 0.032), lash=self.mat("lash", "#1a1018", roughness=0.6))
        self.face(hc, r, skin, lips, nose=0.012, smile=-0.003, width=0.026, out=0.005)
        self.add(blob("HairCap", hc + Vector((0, 0.012, 0.025)), (0.14, 0.146, 0.132), hair, (22, 14), keep=lambda co: co.z > hc.z + 0.025 or co.y > hc.y + 0.025), "head")
        for s, x in SIDES:
            self.add(chain(f"Bang{s}", [hc + Vector((0.02 * x, -0.125, 0.085)), hc + Vector((0.088 * x, -0.122, 0.035)), hc + Vector((0.12 * x, -0.085, -0.05))], [0.032, 0.026, 0.01], hair, seg=10), "head")
        locks = [hc + Vector(v) for v in [(0, 0.1, 0.0), (0, 0.16, -0.15), (0, 0.2, -0.32), (0, 0.22, -0.5)]]
        bones = self.sway("hair", "head", locks)
        for i in range(3):
            self.add(tube(f"Hair{i}", locks[i], locks[i + 1], [(0, 0.12 - 0.02 * i, 0.05), (1, 0.1 - 0.025 * i, 0.04)], hair, seg=12, side=(1, 0, 0)), bones[i])
        crown = hc + Vector((0, -0.01, 0.125))
        self.add(torus("Crown", crown, 0.105, 0.013, gold, seg=(32, 6)), "head")
        for k in range(5):
            a = -math.pi / 2 + (k - 2) * 0.45
            p = crown + Vector((0.105 * math.cos(a), 0.105 * math.sin(a), 0.0))
            self.add(tube(f"CrownSpike{k}", p, p + Vector((0, 0, 0.07 + (0.045 if k == 2 else 0))), [(0, 0.017, 0.017), (1, 0.002, 0.002)], gold, seg=6), "head")
        self.add(blob("CrownGem", crown + Vector((0, -0.11, 0.025)), (0.022, 0.013, 0.028), ruby, (8, 6)), "head")
        # cape
        self.cape("cape", crimson, 1.42, 0.36, 1.0, tails=3)
        # scepter in the left hand
        h = self.hand_at(1)
        a, b = h + Vector((0, 0, -0.22)), h + Vector((0.03, -0.05, 0.62))
        self.add(tube("Scepter", a, b, [(0, 0.014, 0.014), (1, 0.02, 0.02)], gold, seg=8), "hand.L")
        self.add(blob("ScepterGem", b + Vector((0, 0, 0.08)), (0.058, 0.058, 0.08), ruby, (16, 12)), "hand.L")
        self.add(torus("ScepterRing", b + Vector((0, 0, 0.025)), 0.062, 0.011, gold, seg=(24, 6)), "hand.L")
        for k in range(3):
            d = Vector((math.cos(k * 2 * math.pi / 3), math.sin(k * 2 * math.pi / 3), 0))
            claw = [b + Vector((0, 0, 0.025)) + d * 0.06, b + Vector((0, 0, 0.09)) + d * 0.07, b + Vector((0, 0, 0.17)) + d * 0.03]
            self.add(chain(f"ScepterClaw{k}", claw, [0.01, 0.009, 0.002], gold, seg=6), "hand.L")
        self.joints_fill(neck=(skin, 0.042), shoulder=(black, 0.058), elbow=(black, 0.05), wrist=(skin, 0.036), hip=(legs, 0.075), knee=(legs, 0.056))


# ============================================================================================ Isolde
class Frost(MobaFigure):
    """
    Isolde, the Winter Warden (controller): tall and calm; a halo of ice shards standing behind her head, silver hair
    in a high bun, ice-crystal shoulder spikes, a pale blue bodice over a white bell skirt with a shard hem, a deep blue
    sash; an ice spear in the left hand.
    Concept shapes: a big head with big eyes, the shard halo half again as wide (a frozen sun behind her head), an ice
    tiara instead of the bun, a wide skirt and a spear taller than she is with a big crystal head.
    """

    J = dict(hip=0.92, waist=1.04, neck=1.45, head=1.51, top=1.82, shoulder=(0.165, 0.01, 1.4),
             elbow_x=0.205, elbow_z=1.16, wrist_x=0.23, wrist_z=0.94, hand=0.09, leg_x=0.085, knee=0.52)

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear", "Cheek"), 0.0036, 9000, None, 10),
            ("Skin", "skin", ("Face",), 0.0045, 3000, None, 12),
            ("BodiceBody", "bodice", (), 0.007, 5000, None, 12),
            ("LegsBody", "legs", (), 0.006, 2500, None, 12),
            ("Boots", "boot", (), 0.006, 1800, None, 8))
    FOLDS = ((("Skirt",), dict(below=1.0, n=13, amp=0.012, seed=7.0)),)
    WRAP = (("Mouth", "Face", 0.0012),)
    PAINT = {"skin": dict(warm=0.8), "hair": dict(shadow=(0.6, 0.7, 1.0)), "skirt": dict(shadow=(0.6, 0.72, 1.0))}

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
        # a soft glow: the concept halo is big enough that more blooms over her face
        ice = self.mat("ice", "#a8dcf6", roughness=0.05, coat=1.0, emission="#7fd4ff", strength=0.45)
        skin = self.mat("skin", "#f0dcd4", roughness=0.55)
        hair = self.mat("hair", "#e8eef6", roughness=0.6)
        eyew = self.mat("eyewhite", "#ffffff", roughness=0.4)
        iris = self.mat("iris", "#3ab0ff", roughness=0.2, emission="#3ab0ff", strength=1.0)
        lash = self.mat("lash", "#2a3a5a", roughness=0.5)

        self.legs(legs, boot, toe=0.2, cuff=silver)
        self.add(loft("Bodice", [kit.ring_z(z, rx, ry) for z, rx, ry in
                                 [(0.98, 0.14, 0.1), (1.08, 0.125, 0.09), (1.2, 0.14, 0.1), (1.32, 0.165, 0.112), (1.42, 0.125, 0.092), (1.47, 0.06, 0.05)]], blue, seg=24), ["chest", "pelvis"])
        self.add(loft("Collar", [kit.ring_z(1.42, 0.13, 0.1), kit.ring_z(1.49, 0.085, 0.075)], white, seg=24, cap=(False, False)), "chest")
        self.bell("Skirt", [(1.04, 0.13, 0.1), (0.92, 0.23, 0.17), (0.78, 0.32, 0.24), (0.62, 0.38, 0.29)], white, lining, hem=ice, zig=0.05)
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
            c = Vector((0.345 * math.cos(a) * 0.93, 0.26 * math.sin(a) * 0.93 - 0.005, 0.73))
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
        # concept: a big head with big eyes, and the halo half again as wide
        hc = Vector((0, -0.01, 1.63))
        halo = hc + Vector((0, 0.15, 0.07))
        for k in range(11):
            a = math.pi / 2 + (k - 5) * 0.34
            d = Vector((math.cos(a), 0.0, math.sin(a)))
            ln = (0.16 + (0.1 if k == 5 else 0.05 * (k % 2))) * 1.5
            base = halo + d * 0.19
            self.add(tube(f"Halo{k}", base, base + d * ln, [(0, 0.045, 0.016), (1, 0.002, 0.002)], ice, seg=6), "head")
        self.add(torus("HaloRing", halo, 0.19, 0.014, silver, seg=(48, 6), axis=(0, 1, 0)), "head")
        r = (0.125, 0.13, 0.142)
        self.head_shape(hc, r, skin, chin=0.4)
        for s, x in SIDES:
            self.add(blob(f"Cheek{s}", hc + Vector((0.055 * x, -0.112, -0.05)), (0.026, 0.016, 0.02), skin, (12, 8)), "head")
            self.add(blob(f"Ear{s}", hc + Vector((0.122 * x, 0.005, -0.005)), (0.014, 0.026, 0.034), skin, (10, 8)), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.052, size=(0.028, 0.034), lash=lash)
        self.face(hc, r, skin, self.mat("lips", "#9a4a64", roughness=0.4), nose=0.012, smile=0.006, width=0.025, out=0.005)
        self.add(blob("HairCap", hc + Vector((0, 0.012, 0.03)), (0.14, 0.146, 0.132), hair, (22, 14), keep=lambda co: co.z > hc.z + 0.025 or co.y > hc.y + 0.025), "head")
        self.add(blob("HairBack", hc + Vector((0, 0.06, -0.04)), (0.13, 0.1, 0.12), hair, (16, 10)), "head")
        for s, x in SIDES:
            self.add(chain(f"Bang{s}", [hc + Vector((0.01 * x, -0.125, 0.09)), hc + Vector((0.088 * x, -0.122, 0.04)), hc + Vector((0.122 * x, -0.075, -0.075))], [0.03, 0.025, 0.01], hair, seg=10), "head")
        # an ice tiara: five shards rising from a silver band, the middle one tallest
        tiara = hc + Vector((0, -0.02, 0.115))
        self.add(torus("Tiara", tiara, 0.11, 0.011, silver, seg=(32, 6)), "head")
        for k in range(5):
            a = -math.pi / 2 + (k - 2) * 0.42
            p = tiara + Vector((0.11 * math.cos(a), 0.11 * math.sin(a), 0.0))
            ln = 0.08 + 0.05 * (2 - abs(k - 2))
            self.add(tube(f"TiaraShard{k}", p, p + Vector((0.02 * (k - 2), 0.0, ln)), [(0, 0.022, 0.016), (1, 0.002, 0.002)], ice, seg=6), "head")
        # ice spear in the left hand: taller than she is, a big crystal head
        h = self.hand_at(1)
        a, b = h + Vector((0.01, -0.02, -0.82)), h + Vector((0.12, -0.1, 1.3))
        self.add(tube("Spear", a, b, [(0, 0.013, 0.013), (1, 0.017, 0.017)], silver, seg=8), "hand.L")
        d = (b - a).normalized()
        self.add(tube("SpearHead", b, b + d * 0.36, [(0, 0.06, 0.03), (0.3, 0.075, 0.035), (1, 0.002, 0.002)], ice, seg=8), "hand.L")
        for s, x in SIDES:
            self.add(tube(f"SpearWing{s}", b + d * 0.03, b + d * 0.12 + Vector((0.09 * x, 0, 0)), [(0, 0.025, 0.012), (1, 0.002, 0.002)], ice, seg=6), "hand.L")
        self.add(torus("SpearCollar", b, 0.03, 0.01, silver, seg=(16, 6), axis=d), "hand.L")
        self.joints_fill(neck=(skin, 0.042), shoulder=(blue, 0.058), elbow=(blue, 0.05), wrist=(skin, 0.036), hip=(legs, 0.075), knee=(legs, 0.056))


# ============================================================================================ Zephyr
class Sky(MobaFigure):
    """
    Zephyr, the Wind Blade (assassin): lean and quick; a very long jade scarf streaming behind him on a sway chain,
    a cloth mask over the lower face, white hair swept back like wind, a short teal coat over light leather, wrapped
    shins; a curved blade in the right hand.
    Concept shapes: a big head with sharp eyes, hair swept back in big blades, a scarf half again as long and wide
    streaming behind him, and a long curved blade.
    """

    J = dict(hip=0.93, waist=1.05, neck=1.46, head=1.52, top=1.84, shoulder=(0.19, 0.01, 1.42),
             elbow_x=0.235, elbow_z=1.17, wrist_x=0.26, wrist_z=0.93, hand=0.1, leg_x=0.095, knee=0.52)

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Ear"), 0.0036, 9000, None, 10),
            ("Skin", "skin", ("Face",), 0.0045, 3000, None, 12),
            ("CoatBody", "coat", ("CoatSkirt",), 0.007, 5000, None, 12),
            ("LegsBody", "legs", (), 0.006, 2500, None, 12),
            ("Boots", "boot", (), 0.006, 1800, None, 8))
    WRAP = (("Brow", "Face", 0.002),)
    PAINT = {"skin": dict(warm=1.0), "hair": dict(tip=(0.55, 0.95, 0.85), centre=(0, 0.0, 1.64), r0=0.12, r1=0.34)}

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
        # concept: a big head, sharp eyes, hair swept back in big blades
        hc = Vector((0, -0.01, 1.64))
        r = (0.122, 0.13, 0.14)
        self.head_shape(hc, r, skin, chin=0.6)
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.12 * x, 0.005, -0.005)), (0.014, 0.026, 0.034), skin, (10, 8)), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.05, size=(0.027, 0.02), z=0.012)
        for s, x in SIDES:
            self.add(chain(f"Brow{s}", [hc + Vector((0.022 * x, -0.122, 0.045)), hc + Vector((0.066 * x, -0.115, 0.058)), hc + Vector((0.092 * x, -0.095, 0.066))], [0.007, 0.009, 0.004], brow, seg=6), "head")
        self.add(blob("Mask", hc + Vector((0, -0.035, -0.065)), (0.128, 0.122, 0.072), scarf, (18, 12), keep=lambda co: co.z < hc.z - 0.018), "head")
        self.add(blob("HairCap", hc + Vector((0, 0.015, 0.035)), (0.136, 0.145, 0.127), hair, (22, 14), keep=lambda co: co.z > hc.z + 0.025 or co.y > hc.y + 0.035), "head")
        for k, (x0, z0, ln) in enumerate([(0.0, 0.12, 0.4), (-0.075, 0.085, 0.34), (0.075, 0.085, 0.34), (-0.11, 0.025, 0.26), (0.11, 0.025, 0.26), (0.0, 0.04, 0.3)]):
            base = hc + Vector((x0, -0.025, z0))
            d = Vector((x0 * 1.5, 1.0, 0.45 - 0.2 * abs(x0))).normalized()
            self.add(tube(f"Swept{k}", base, base + d * ln, [(0, 0.055, 0.04), (0.6, 0.03, 0.022), (1, 0.002, 0.002)], hair, seg=8), "head")
        # signature: the long scarf, wrapped at the neck, streaming behind on a sway chain (concept: half again as
        # long and wide, lifting as it goes)
        self.add(torus("ScarfWrap", (0, 0.0, 1.47), 0.09, 0.042, scarf, seg=(28, 10)), "neck")
        tail = [Vector(v) for v in [(0.05, 0.1, 1.47), (0.09, 0.22, 1.34), (0.13, 0.36, 1.2), (0.16, 0.5, 1.08), (0.2, 0.64, 0.98), (0.24, 0.78, 0.92)]]
        bones = self.sway("scarf", "neck", tail)
        for i in range(5):
            self.add(tube(f"Scarf{i}", tail[i], tail[i + 1], [(0, 0.09 - 0.004 * i, 0.014), (1, 0.086 - 0.004 * i - (0.06 if i == 4 else 0), 0.014)], scarf, seg=8, side=(0, 0, 1)), bones[i])
        # a long curved blade in the right hand, pointing down and forward
        h = self.hand_at(-1)
        self.add(tube("Grip", h + Vector((0, 0, 0.07)), h + Vector((0, -0.02, -0.08)), [(0, 0.018, 0.018), (1, 0.018, 0.018)], leather, seg=8), "hand.R")
        self.add(torus("Guard", h + Vector((0, -0.02, -0.08)), 0.045, 0.012, steel, seg=(16, 6)), "hand.R")
        arc = [h + Vector((0, -0.02 - 0.17 * t - 0.35 * t * t, -0.09 - 0.77 * t + 0.17 * t * t)) for t in (0.0, 0.25, 0.5, 0.75, 1.0)]
        self.add(chain("Blade", arc, [(0.007, 0.04), (0.007, 0.048), (0.006, 0.045), (0.005, 0.034), (0.002, 0.004)], steel, seg=6, side=(1, 0, 0)), "hand.R")
        self.add(chain("BladeEdge", [p + Vector((0, -0.038, -0.005)) for p in arc[1:]], [0.006, 0.007, 0.006, 0.002], edge, seg=5), "hand.R")
        self.joints_fill(neck=(skin, 0.045), shoulder=(coat, 0.062), elbow=(leather, 0.054), wrist=(skin, 0.04), hip=(legs, 0.072), knee=(legs, 0.054))


# ============================================================================================ Oblivion
class Void(MobaFigure):
    """
    Oblivion, the Unmaker (juggernaut): huge and dark; a horned great-helm with a glowing violet eye slit, layered
    spiked pauldrons, black plate with a violet rift core in the chest, a tattered cape in four tails, armoured legs;
    a greatsword with a violet void edge held low in the right hand.
    Concept shapes: a tower, not Brannoc's wedge: a straight-sided plate body with long tassets, horns rising half
    again as tall, taller pauldron spikes and a greatsword nearly as long as he is tall.
    """

    J = dict(hip=0.86, waist=0.98, neck=1.49, head=1.55, top=1.82, shoulder=(0.28, 0.02, 1.43),
             elbow_x=0.35, elbow_z=1.16, wrist_x=0.39, wrist_z=0.9, hand=0.12, leg_x=0.13, knee=0.46)

    SCULPT = True
    FUSE = (("PlateBody", "plate", ("only", "Cuirass", "Vambrace", "Gauntlet"), 0.008, 5000, None, 10),
            ("Helm", "plate", ("only", "Helm", "Faceplate"), 0.006, 3000, None, 8),
            ("Greaves", "plate", ("only", "Greave", "Sabaton"), 0.008, 2500, None, 8),
            ("DarkBody", "dark", ("only", "Thigh", "UpperArm", "Joint", "Neck"), 0.008, 3000, None, 12))
    WRAP = (("EyeSlit", "Helm", 0.003),)
    PAINT = {"plate": dict(shadow=(0.55, 0.45, 0.85)), "dark": dict(shadow=(0.5, 0.4, 0.8))}

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
        self.bell("Tassets", [(0.98, 0.29, 0.22), (0.82, 0.31, 0.235), (0.6, 0.32, 0.245)], plate, dark, weights=skirt, hem=trim)
        # torso: a straight-sided plate cuirass (a tower), a rift core in the chest
        self.add(loft("Cuirass", [kit.ring_z(z, rx, ry) for z, rx, ry in
                                  [(0.9, 0.29, 0.21), (1.0, 0.3, 0.22), (1.16, 0.31, 0.23), (1.32, 0.315, 0.235), (1.46, 0.3, 0.22), (1.53, 0.13, 0.1)]], plate, seg=28), ["chest", "pelvis"])
        self.add(loft("Belt", [kit.ring_z(0.96, 0.272, 0.205), kit.ring_z(1.02, 0.275, 0.207)], trim, seg=28), "pelvis")
        # tasset plates over the skirt, front and sides, each edged in trim
        for k in range(5):
            a = -math.pi / 2 + (k - 2) * 0.42
            c0 = Vector((0.31 * math.cos(a), 0.24 * math.sin(a), 0.8))
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
            for k, (dx, dy, ln) in enumerate([(0.15, -0.3, 0.3), (0.25, 0.0, 0.4), (0.15, 0.35, 0.3)]):
                base = pc + Vector((0.05 * x, dy * 0.25, 0.06))
                d = Vector((dx * x, dy, 1.0)).normalized()
                self.add(tube(f"PSpike{s}{k}", base, base + d * ln, [(0, 0.045, 0.045), (1, 0.002, 0.002)], bone, seg=8), pw)
        # signature 2: the horned great-helm with a glowing eye slit
        hc = Vector((0, -0.01, 1.65))
        self.add(blob("Helm", hc, (0.135, 0.145, 0.16), plate, (22, 16)), "head")
        self.add(box("Faceplate", hc + Vector((0, -0.12, -0.02)), (0.2, 0.06, 0.22), plate, bevel=0.03), "head")
        self.add(box("EyeSlit", hc + Vector((0, -0.152, 0.025)), (0.16, 0.012, 0.025), rift, bevel=0.006), "head")
        self.add(box("Crest", hc + Vector((0, 0.0, 0.14)), (0.03, 0.26, 0.06), trim, bevel=0.012), "head")
        for s, x in SIDES:
            horn = [hc + Vector(v) for v in [(0.11 * x, -0.02, 0.07), (0.19 * x, 0.0, 0.17), (0.22 * x, 0.04, 0.36), (0.18 * x, 0.08, 0.57)]]
            self.add(chain(f"Horn{s}", horn, [0.052, 0.042, 0.026, 0.003], bone, seg=10), "head")
        # tattered cape
        self.cape("cape", cape, 1.46, 0.5, 1.15, tails=4, ragged=0.25, back=0.2)
        # greatsword held low in the right hand, blade down and forward
        h = self.hand_at(-1)
        self.add(tube("SwordGrip", h + Vector((0, 0, 0.12)), h + Vector((0, -0.02, -0.06)), [(0, 0.022, 0.022), (1, 0.022, 0.022)], dark, seg=8), "hand.R")
        self.add(blob("Pommel", h + Vector((0, 0.005, 0.14)), (0.03, 0.03, 0.03), rift, (10, 8)), "hand.R")
        guard = h + Vector((0, -0.025, -0.08))
        self.add(box("Guard", guard, (0.36, 0.06, 0.06), trim, bevel=0.018), "hand.R")
        # concept: nearly as long as he is tall, held forward and low
        tip = guard + Vector((0, -0.78, -0.72))
        # a pale steel blade with thick void edges, so it reads against his dark plate and the night
        self.add(tube("Blade", guard, tip, [(0, 0.1, 0.018), (0.85, 0.085, 0.016), (1, 0.003, 0.003)], trim, seg=8, side=(1, 0, 0)), "hand.R")
        for s, x in SIDES:
            self.add(tube(f"VoidEdge{s}", guard + Vector((0.098 * x, 0, 0)), tip + Vector((0.004 * x, 0, 0)), [(0, 0.016, 0.016), (0.85, 0.018, 0.018), (1, 0.003, 0.003)], rift, seg=6), "hand.R")
        self.joints_fill(neck=(dark, 0.085), shoulder=(dark, 0.1), wrist=(dark, 0.085), hip=(dark, 0.1), knee=(dark, 0.088))


def band(name, centre, major, minor, mat=None, seg=(20, 6), axis=(0, 0, 1)):
    """A small decorative ring (an armband, a stripe) at its own low resolution; the torus wrapper's 40 x 8 minimum
    costs 640 triangles a ring."""
    return kit.torus(name, centre, major, minor, mat, seg=seg, axis=axis)


def arc_shell(name, rings, a0, a1, mat=None, thick=0.012, seg=40):
    """
    A curved band of cloth or plate round the z axis, open at the front: rings of (z, rx, ry, cy) from top to bottom,
    swept from angle a0 to a1 (radians; 0 = +X, the figure's left; pi/2 = +Y, the back), `thick` deep. For hoods and
    flaring headcloths that must leave the face free.
    """
    import bmesh
    bm = bmesh.new()
    outer, inner = [], []
    for z, rx, ry, cy in rings:
        o, i = [], []
        for k in range(seg + 1):
            a = a0 + (a1 - a0) * k / seg
            c, s = math.cos(a), math.sin(a)
            o.append(bm.verts.new((rx * c, cy + ry * s, z)))
            i.append(bm.verts.new(((rx - thick) * c, cy + (ry - thick) * s, z)))
        outer.append(o)
        inner.append(i)
    last = len(rings) - 1
    for r in range(last):
        for k in range(seg):
            bm.faces.new((outer[r][k], outer[r][k + 1], outer[r + 1][k + 1], outer[r + 1][k]))
            bm.faces.new((inner[r][k + 1], inner[r][k], inner[r + 1][k], inner[r + 1][k + 1]))
        for k in (0, seg):
            bm.faces.new((outer[r][k], outer[r + 1][k], inner[r + 1][k], inner[r][k]))
    for r in (0, last):
        for k in range(seg):
            bm.faces.new((outer[r][k], inner[r][k], inner[r][k + 1], outer[r][k + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return kit.mesh_object(name, bm, mat, True)


# ============================================================================================ Sefu
class Sand(MobaFigure):
    """
    Sefu, the Dune Sovereign (controller): a tall priest-king in bronze skin; a striped gold-and-turquoise nemes, a
    broad jewelled collar, gold armbands, bracers and greaves, a pleated linen kilt with a royal apron, kohl-lined gold
    eyes and a braided pharaoh's beard; a sandstone crook in the right hand.
    Concept shapes: a big head with sharp eyes, the nemes flaring half again as wide as his shoulders (a striped cobra
    hood behind him), a rearing gold cobra on the brow, and a crook taller than he is with a big hooked gold head.
    """

    J = dict(hip=0.93, waist=1.05, neck=1.46, head=1.52, top=1.86, shoulder=(0.195, 0.01, 1.42),
             elbow_x=0.24, elbow_z=1.17, wrist_x=0.265, wrist_z=0.93, hand=0.1, leg_x=0.095, knee=0.52)

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose"), 0.0036, 9000, None, 10),
            ("Skin", "skin", ("Face",), 0.0045, 7000, None, 12),
            ("Sandals", "sandal", (), 0.006, 1500, None, 8))
    FOLDS = ((("Kilt",), dict(below=1.0, n=17, amp=0.01, seed=3.0)),)
    WRAP = (("Mouth", "Face", 0.0012), ("Brow", "Face", 0.002), ("Kohl", "Face", 0.0015))
    PAINT = {"skin": dict(warm=1.0), "linen": dict(shadow=(0.72, 0.6, 0.48))}

    def __init__(self):
        super().__init__("sand", self.J)

    def body(self):
        skin = self.mat("skin", "#a8744c", roughness=0.55)
        sandal = self.mat("sandal", "#5a3a1e", roughness=0.7)
        linen = self.mat("linen", "#d8caa8", roughness=0.75)
        linen_in = self.mat("lining", "#cdb88c", roughness=0.8, double_sided=True)
        gold = self.mat("gold", "#cf9d3e", metallic=0.7, roughness=0.3, double_sided=True)
        teal = self.mat("turquoise", "#3fd4c8", roughness=0.4)
        lapis = self.mat("lapis", "#2a4fa8", roughness=0.4)
        carnelian = self.mat("carnelian", "#c8502a", roughness=0.4)
        stone = self.mat("sandstone", "#e8d8b4", roughness=0.85)
        gem = self.mat("gem", "#5ff0e0", roughness=0.15, emission="#3fd4c8", strength=1.6)
        kohl = self.mat("kohl", "#140c06", roughness=0.6)
        eyew = self.mat("eyewhite", "#fff8ec", roughness=0.4)
        iris = self.mat("iris", "#ffcf5a", roughness=0.2, emission="#ffc040", strength=1.2)
        J = self.J

        # legs: bronze skin, low sandals, gold greaves with turquoise bands
        self.legs(skin, sandal, thigh=(0.072, 0.054), shin=0.048, boot_r=0.05, boot_top=0.09, toe=0.2)
        for s, x in SIDES:
            X = J["leg_x"] * x
            self.add(tube(f"Greave{s}", (X, -0.005, 0.44), (X, -0.005, 0.15), [(0, 0.06, 0.06), (0.5, 0.064, 0.064), (1, 0.056, 0.056)], gold, seg=14, cap=(False, False)), f"shin.{s}")
            for k, z in enumerate((0.42, 0.17)):
                self.add(band(f"GreaveBand{s}{k}", (X, -0.005, z), 0.064, 0.008, teal, seg=(24, 6)), f"shin.{s}")
        # torso: bare bronze, a gold belt with a turquoise inlay
        self.add(loft("Torso", [kit.ring_z(z, rx, ry) for z, rx, ry in
                                [(0.96, 0.145, 0.108), (1.08, 0.14, 0.098), (1.2, 0.158, 0.106), (1.32, 0.182, 0.115), (1.42, 0.15, 0.1), (1.49, 0.06, 0.05)]], skin, seg=24), ["chest", "pelvis"])
        self.add(loft("Belt", [kit.ring_z(0.99, 0.156, 0.119), kit.ring_z(1.06, 0.151, 0.113)], gold, seg=24), "pelvis")
        self.add(loft("BeltInlay", [kit.ring_z(1.017, 0.159, 0.122), kit.ring_z(1.033, 0.158, 0.121)], teal, seg=24), "pelvis")
        # a pleated linen kilt and the royal apron hanging in front of it
        skirt = short_skirt(J["hip"], J["knee"], 0.12)
        self.bell("Kilt", [(1.03, 0.152, 0.115), (0.92, 0.2, 0.152), (0.78, 0.245, 0.185), (0.66, 0.265, 0.2)], linen, linen_in, hem=gold, n=28)
        apron = [Vector((0, -0.13, 1.0)), Vector((0, -0.182, 0.84)), Vector((0, -0.217, 0.66))]
        self.add(chain("Apron", apron, [(0.055, 0.008), (0.07, 0.008), (0.085, 0.008)], gold, seg=8), skirt)
        for k, dx in enumerate((-0.032, 0.0, 0.032)):
            self.add(chain(f"ApronStripe{k}", [p + Vector((dx * (1 + 0.4 * i), -0.008, 0)) for i, p in enumerate(apron)], [0.007, 0.008, 0.009], teal if k != 1 else lapis, seg=6), skirt)
        # arms: bare, gold armbands and wide bracers
        self.arms(skin, skin, skin, r=(0.058, 0.05, 0.045), hand=(0.045, 0.05, 0.065))
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            d = (el - sh).normalized()
            self.add(band(f"Armband{s}", sh.lerp(el, 0.42), 0.061, 0.012, gold, seg=(24, 6), axis=d), f"upper_arm.{s}")
            self.add(band(f"ArmbandInlay{s}", sh.lerp(el, 0.42) + d * 0.022, 0.06, 0.006, teal, seg=(24, 6), axis=d), f"upper_arm.{s}")
            f = (wr - el).normalized()
            self.add(tube(f"Bracer{s}", el.lerp(wr, 0.42), wr + f * 0.01, [(0, 0.05, 0.05), (1, 0.057, 0.057)], gold, seg=16, cap=(False, False)), f"forearm.{s}")
            self.add(band(f"BracerBand{s}", el.lerp(wr, 0.72), 0.057, 0.007, teal, seg=(24, 6), axis=f), f"forearm.{s}")
        # the broad jewelled collar over the shoulders: gold with turquoise, lapis and carnelian rows and a bead fringe
        cone = [(1.49, 0.078, 0.07), (1.465, 0.15, 0.118), (1.425, 0.215, 0.148), (1.385, 0.258, 0.168)]

        def collar_w(p):
            a = 0.3 * figure_kit.smooth(0.15, 0.26, abs(p.x))
            return {"chest": 1 - a, f"upper_arm.{'L' if p.x > 0 else 'R'}": a}

        def cone_at(u):
            i = min(int(u), len(cone) - 2)
            t = u - i
            return tuple(a + (b - a) * t for a, b in zip(cone[i], cone[i + 1]))
        self.add(loft("Collar", [kit.ring_z(z, rx, ry, cy=-0.005) for z, rx, ry in cone], gold, seg=28, cap=(False, False)), collar_w)
        for k, (u0, u1, m) in enumerate(((0.75, 1.05, teal), (1.4, 1.7, lapis), (2.05, 2.35, teal), (2.6, 2.85, carnelian))):
            rings = [cone_at(u) for u in (u0, u1)]
            self.add(loft(f"CollarRow{k}", [kit.ring_z(z, rx + 0.004, ry + 0.004, cy=-0.005) for z, rx, ry in rings], m, seg=28, cap=(False, False)), collar_w)
        for k in range(15):
            a = -math.pi + 0.25 + (math.pi - 0.5) * k / 14
            p = Vector((0.262 * math.cos(a), -0.005 + 0.172 * math.sin(a), 1.365))
            self.add(blob(f"Bead{k}", p, (0.013, 0.01, 0.022), teal if k % 2 else gold, (8, 6)), collar_w)
        # head: big, sharp kohl-lined gold eyes, a stern mouth, the braided pharaoh's beard
        hc = Vector((0, -0.01, 1.64))
        r = (0.122, 0.13, 0.14)
        self.head_shape(hc, r, skin, chin=0.62)
        self.eyes(hc, r, eyew, iris, eyew, spread=0.05, size=(0.028, 0.023), z=0.012, lash=kohl)
        for s, x in SIDES:
            self.add(chain(f"Kohl{s}", [Vector((0.072 * x, -0.118, hc.z + 0.012)), Vector((0.091 * x, -0.104, hc.z + 0.007)), Vector((0.107 * x, -0.087, hc.z + 0.0))], [0.005, 0.005, 0.0025], kohl, seg=8), "head")
            self.add(chain(f"Brow{s}", [hc + Vector((0.018 * x, -0.123, 0.05)), hc + Vector((0.058 * x, -0.118, 0.064)), hc + Vector((0.092 * x, -0.098, 0.066))], [0.009, 0.011, 0.006], kohl, seg=8), "head")
        self.face(hc, r, skin, self.mat("lips", "#6a3a26", roughness=0.45), nose=0.017, smile=-0.002, width=0.024, out=0.005)
        beard = [hc + Vector(v) for v in [(0, -0.07, -0.125), (0, -0.085, -0.2), (0, -0.088, -0.265), (0, -0.104, -0.292)]]
        self.add(chain("Beard", beard, [0.02, 0.019, 0.017, 0.012], gold, seg=10), "head")
        for k in range(3):
            p = beard[0].lerp(beard[2], 0.25 + 0.3 * k)
            self.add(band(f"BeardBand{k}", p, 0.019, 0.005, lapis, seg=(16, 6), axis=(0, -0.2, 1)), "head")
        # signature: the nemes. A striped cap over the head, a band across the brow with a rearing cobra, and the
        # side cloths flaring in alternating gold and turquoise bands far past the shoulders (a cobra hood)
        cap = hc + Vector((0, 0.012, 0.028))
        self.add(blob("NemesCap", cap, (0.146, 0.153, 0.139), gold, (26, 16),
                      keep=lambda co: co.z > hc.z + 0.07 or co.y > hc.y + 0.035 or (abs(co.x) > 0.09 and co.z > hc.z - 0.03)), "head")
        for k, dz in enumerate((0.095, 0.125)):
            rr = 0.1495 * math.sqrt(max(0.0, 1 - ((hc.z + dz - cap.z) / 0.139) ** 2)) + 0.002
            self.add(band(f"CapStripe{k}", (0, cap.y, hc.z + dz), rr, 0.008, teal, seg=(40, 6)), "head")
        fz = hc.z + 0.072
        f = math.sqrt(1 - ((fz - cap.z) / 0.139) ** 2)
        brow_pts = [Vector((0.15 * f * math.cos(a), cap.y + 0.157 * f * math.sin(a), fz)) for a in [-math.pi + 0.55 + (math.pi - 1.1) * k / 8 for k in range(9)]]
        self.add(chain("Headband", brow_pts, [0.011] * len(brow_pts), teal, seg=8), "head")
        # the rearing cobra: a gold body rising off the band, a flat gold hood with a turquoise inlay, the head forward
        self.add(chain("Uraeus", [Vector((0, -0.152, hc.z + 0.07)), Vector((0, -0.166, hc.z + 0.092)), Vector((0, -0.17, hc.z + 0.122)), Vector((0, -0.163, hc.z + 0.15))], [0.011, 0.012, 0.011, 0.009], gold, seg=8), "head")
        self.add(blob("UraeusHood", Vector((0, -0.166, hc.z + 0.124)), (0.03, 0.007, 0.033), gold, (12, 8)), "head")
        self.add(blob("UraeusInlay", Vector((0, -0.172, hc.z + 0.122)), (0.017, 0.005, 0.021), teal, (10, 6)), "head")
        self.add(blob("UraeusHead", Vector((0, -0.172, hc.z + 0.158)), (0.012, 0.019, 0.01), gold, (8, 6)), "head")

        def hood_w(p):
            s = figure_kit.smooth(1.44, 1.62, p.z)
            a = 0.35 * figure_kit.smooth(0.17, 0.3, abs(p.x)) * (1 - s)
            return {"head": s, "chest": 1 - s - a, f"upper_arm.{'L' if p.x > 0 else 'R'}": a}

        # flat against the back, flaring wide to the sides (a sphinx's headdress, not a bell); few bold stripes, so
        # they still read from the game camera
        def hood(z):
            t = (1.68 - z) / 0.365
            return (z, 0.152 + 0.21 * t ** 1.25, 0.148 + 0.012 * t, 0.02 + 0.012 * t)
        cuts = [1.68, 1.625, 1.6, 1.545, 1.52, 1.465, 1.44, 1.385, 1.36, 1.315]
        for k in range(len(cuts) - 1):
            self.add(arc_shell(f"Nemes{k}", [hood(cuts[k]), hood(cuts[k + 1])], -0.62, math.pi + 0.62, teal if k % 2 else gold, thick=0.012, seg=40), hood_w)
        # the two lappets falling in front of the shoulders onto the chest, banded the same way
        for s, x in SIDES:
            path = [Vector((0.15 * x, -0.075, 1.56)), Vector((0.152 * x, -0.135, 1.43)), Vector((0.148 * x, -0.18, 1.27))]
            for i in range(6):
                u0, u1 = i / 6, (i + 1) / 6
                a = path[0].lerp(path[1], u0 * 2) if u0 < 0.5 else path[1].lerp(path[2], u0 * 2 - 1)
                b = path[0].lerp(path[1], u1 * 2) if u1 <= 0.5 else path[1].lerp(path[2], u1 * 2 - 1)
                self.add(tube(f"Lappet{s}{i}", a, b, [(0, 0.046 + 0.006 * u0, 0.009), (1, 0.046 + 0.006 * u1, 0.009)], teal if i % 2 else gold, seg=8, side=(1, 0, 0)), hood_w)
        # the nemes' gathered tail down the back, banded like the rest
        tail = [Vector((0, 0.172, 1.345)), Vector((0, 0.165, 1.24)), Vector((0, 0.155, 1.14)), Vector((0, 0.15, 1.06))]
        for i in range(3):
            self.add(tube(f"NemesTail{i}", tail[i], tail[i + 1], [(0, 0.04 - 0.005 * i, 0.03 - 0.004 * i), (1, 0.035 - 0.005 * i - (0.02 if i == 2 else 0), 0.026 - 0.004 * i - (0.014 if i == 2 else 0))], teal if i % 2 else gold, seg=10, side=(1, 0, 0)), "chest")
        # the crook in the right hand: taller than he is, banded near the top, a big hooked gold head with a gem
        h = self.hand_at(-1)
        a, b = h + Vector((0, -0.01, -0.84)), h + Vector((-0.02, -0.06, 1.28))
        self.add(tube("Crook", a, b, [(0, 0.018, 0.018), (1, 0.022, 0.022)], stone, seg=10), "hand.R")
        for k in range(7):
            p = a.lerp(b, 0.62 + 0.055 * k)
            self.add(band(f"CrookBand{k}", p, 0.023, 0.007, teal if k % 2 else gold, seg=(16, 6), axis=b - a), "hand.R")
        self.add(tube("CrookFoot", a, a.lerp(b, 0.05), [(0, 0.024, 0.024), (1, 0.021, 0.021)], gold, seg=10), "hand.R")
        hook = [b + Vector(v) for v in [(0, 0, 0), (0, 0, 0.1), (-0.03, 0, 0.18), (-0.1, 0, 0.215), (-0.17, 0, 0.175), (-0.19, 0, 0.095)]]
        self.add(chain("CrookHook", hook, [0.024, 0.024, 0.023, 0.022, 0.02, 0.015], gold, seg=10), "hand.R")
        self.add(blob("CrookGem", b + Vector((0, -0.006, 0.03)), (0.034, 0.034, 0.04), gem, (14, 10)), "hand.R")
        self.joints_fill(neck=(skin, 0.045), shoulder=(skin, 0.062), elbow=(skin, 0.052), wrist=(skin, 0.042), hip=(skin, 0.074), knee=(skin, 0.054))


# ============================================================================================ Auriel
class Dawn(MobaFigure):
    """
    Auriel, the Dawn Paladin (support): ivory plate with gold trim (mid-value ivory: near-white blooms over the whole
    figure under the game's lights) over a white skirt with tasset plates, a sun on the
    breastplate, golden hair in a long braid under a winged circlet, sky-blue eyes; a hard-light sword in the right hand
    and a gold kite shield on the left forearm.
    Concept shapes: a big head with big eyes; the old halo of hard-light panels grown into a pair of raised wings (a
    gold arm to a wrist above her head and nine feather plates on each, about 1.4 m tip to tip); a kite shield half
    again as big.
    """

    J = dict(hip=0.92, waist=1.04, neck=1.45, head=1.51, top=1.82, shoulder=(0.168, 0.01, 1.4),
             elbow_x=0.208, elbow_z=1.16, wrist_x=0.232, wrist_z=0.94, hand=0.09, leg_x=0.086, knee=0.52)

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear", "Cheek"), 0.0036, 9000, None, 10),
            ("Skin", "skin", ("Face",), 0.0045, 3000, None, 12),
            ("BodiceBody", "bodice", (), 0.007, 5000, None, 12),
            ("LegsBody", "legs", (), 0.006, 2500, None, 12),
            ("Greaves", "greave", (), 0.006, 2000, None, 8))
    FOLDS = ((("Skirt",), dict(below=1.0, n=13, amp=0.01, seed=9.0)),)
    WRAP = (("Mouth", "Face", 0.0012),)
    PAINT = {"skin": dict(warm=0.8), "hair": dict(shadow=(0.8, 0.55, 0.35)), "skirt": dict(shadow=(0.78, 0.68, 0.52)),
             "bodice": dict(shadow=(0.7, 0.6, 0.5))}

    def __init__(self):
        super().__init__("dawn", self.J)

    def body(self):
        greave = self.mat("greave", "#ad9f80", metallic=0.45, roughness=0.32)
        legs = self.mat("legs", "#8e8068", roughness=0.75)
        plate = self.mat("bodice", "#b4a88c", metallic=0.35, roughness=0.35)
        skirt_m = self.mat("skirt", "#bdb3a0", roughness=0.6)
        lining = self.mat("lining", "#a8946a", roughness=0.7, double_sided=True)
        tasset = self.mat("tasset", "#b0a283", metallic=0.4, roughness=0.32)
        gold = self.mat("gold", "#e0a935", metallic=0.75, roughness=0.28)
        light = self.mat("glow", "#fff6dc", roughness=0.3, emission="#ffe2a0", strength=0.6)
        wing = self.mat("wing", "#c2b69a", roughness=0.35, double_sided=True)
        skin = self.mat("skin", "#e6cdb6", roughness=0.55)
        hair = self.mat("hair", "#d5ac58", roughness=0.55)
        eyew = self.mat("eyewhite", "#e6e6e6", roughness=0.4)
        iris = self.mat("iris", "#5ec8ff", roughness=0.2, emission="#5ec8ff", strength=0.6)
        gem = self.mat("gem", "#7fd8ff", roughness=0.1, emission="#7fd8ff", strength=1.5)
        J = self.J

        # legs: pale hose, ivory greaves to below the knee, gold knee cops
        self.legs(legs, greave, toe=0.2, boot_r=0.062, boot_top=0.42)
        for s, x in SIDES:
            X = J["leg_x"] * x
            self.add(band(f"BootCuff{s}", (X, 0, 0.42), 0.071, 0.012, gold, seg=(16, 6)), f"shin.{s}")
            self.add(kit.blob(f"KneeCop{s}", (X, -0.056, 0.49), (0.046, 0.02, 0.05), gold, segs=(14, 10)), f"shin.{s}")
        # breastplate with a gold gorget and a sun on the chest
        self.add(loft("Bodice", [kit.ring_z(z, rx, ry) for z, rx, ry in
                                 [(0.98, 0.14, 0.1), (1.08, 0.125, 0.09), (1.2, 0.14, 0.1), (1.32, 0.168, 0.115), (1.42, 0.128, 0.094), (1.47, 0.06, 0.05)]], plate, seg=24), ["chest", "pelvis"])
        self.add(loft("Gorget", [kit.ring_z(1.42, 0.136, 0.101), kit.ring_z(1.49, 0.086, 0.076)], gold, seg=24, cap=(False, False)), "chest")
        sun = Vector((0, -0.121, 1.3))
        self.add(band("SunRing", sun, 0.03, 0.007, gold, seg=(20, 6), axis=(0, 1, 0)), "chest")
        self.add(blob("SunCore", sun, (0.02, 0.008, 0.02), light, (12, 8)), "chest")
        for k in range(8):
            a = k * math.pi / 4
            d = Vector((math.cos(a), 0, math.sin(a)))
            self.add(tube(f"SunRay{k}", sun + d * 0.04, sun + d * (0.07 if k % 2 == 0 else 0.056), [(0, 0.006, 0.004), (1, 0.001, 0.001)], gold, seg=5), "chest")
        # skirt with gold hem, gold belt with a sky-blue gem, five tasset plates flaring with the skirt
        skirt_w = short_skirt(J["hip"], J["knee"], 0.12)
        self.bell("Skirt", [(1.04, 0.13, 0.1), (0.92, 0.2, 0.155), (0.78, 0.27, 0.205), (0.62, 0.32, 0.245)], skirt_m, lining, hem=gold)
        self.add(loft("Belt", [kit.ring_z(0.99, 0.142, 0.105), kit.ring_z(1.06, 0.137, 0.1)], gold, seg=24), "pelvis")
        self.add(blob("Buckle", (0, -0.112, 1.025), (0.026, 0.012, 0.024), gem, (10, 8)), "pelvis")
        for k in range(5):
            a = -math.pi / 2 + (k - 2) * 0.5
            out = Vector((math.cos(a), math.sin(a) * 0.77, 0)).normalized()
            c = Vector((0.245 * math.cos(a), 0.19 * math.sin(a), 0.875))
            rot = Euler((-0.46, 0, math.atan2(out.y, out.x) + math.pi / 2))
            self.add(kit.box(f"Tasset{k}", c, (0.11, 0.018, 0.17), tasset, bevel=0.008, segments=1, rotation=rot), skirt_w)
            self.add(kit.box(f"TassetRim{k}", c + out * 0.04 + Vector((0, 0, -0.078)), (0.115, 0.012, 0.016), gold, bevel=0.003, segments=1, rotation=rot), skirt_w)
        # arms in plate, gold cuffs; rounded pauldrons with small feather plates (the wings in miniature)
        self.arms(plate, plate, skin, r=(0.05, 0.044, 0.04), flare=0.015, cuff=gold)
        for s, x in SIDES:
            pc = Vector((0.17 * x, 0.0, 1.43))
            pw = (lambda arm: (lambda p: {"chest": 0.6, arm: 0.4}))(f"upper_arm.{s}")
            self.add(kit.blob(f"Pauldron{s}", pc, (0.085, 0.08, 0.052), tasset, segs=(20, 12), keep=lambda co, z=pc.z: co.z > z - 0.03), pw)
            self.add(band(f"PauldronRim{s}", pc + Vector((0, 0, -0.022)), 0.082, 0.009, gold, seg=(28, 6)), pw)
            for k, (ang, ln) in enumerate(((0.35, 0.12), (0.75, 0.15), (1.15, 0.11))):
                d = Vector((math.cos(ang) * x, 0.15, math.sin(ang))).normalized()
                side = Vector((-math.sin(ang) * x, 0, math.cos(ang)))
                base = pc + Vector((0.05 * x, 0.02 + 0.006 * k, 0.01))
                self.add(tube(f"PauldronFeather{s}{k}", base, base + d * ln, [(0, 0.022, 0.006), (0.5, 0.028, 0.007), (1, 0.002, 0.002)], gold, seg=6, side=side), pw)
        # head: big head and eyes, golden hair with a long braid, a winged circlet with a sky-blue gem
        hc = Vector((0, -0.01, 1.63))
        r = (0.125, 0.13, 0.142)
        self.head_shape(hc, r, skin, chin=0.4)
        for s, x in SIDES:
            self.add(blob(f"Cheek{s}", hc + Vector((0.055 * x, -0.112, -0.05)), (0.026, 0.016, 0.02), skin, (12, 8)), "head")
            self.add(blob(f"Ear{s}", hc + Vector((0.122 * x, 0.005, -0.005)), (0.014, 0.026, 0.034), skin, (10, 8)), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.052, size=(0.028, 0.034), lash=self.mat("lash", "#6a4418", roughness=0.5))
        self.face(hc, r, skin, self.mat("lips", "#c4686a", roughness=0.4), nose=0.012, smile=0.006, width=0.025, out=0.005)
        self.add(blob("HairCap", hc + Vector((0, 0.012, 0.03)), (0.14, 0.146, 0.132), hair, (22, 14), keep=lambda co: co.z > hc.z + 0.025 or co.y > hc.y + 0.025), "head")
        self.add(blob("HairBack", hc + Vector((0, 0.06, -0.04)), (0.13, 0.1, 0.12), hair, (16, 10)), "head")
        for s, x in SIDES:
            self.add(chain(f"Bang{s}", [hc + Vector((0.01 * x, -0.125, 0.09)), hc + Vector((0.088 * x, -0.122, 0.04)), hc + Vector((0.122 * x, -0.075, -0.075))], [0.03, 0.025, 0.01], hair, seg=10), "head")
            self.add(chain(f"SideLock{s}", [hc + Vector((0.118 * x, -0.06, 0.0)), hc + Vector((0.132 * x, -0.07, -0.1)), hc + Vector((0.12 * x, -0.06, -0.19))], [0.022, 0.02, 0.006], hair, seg=8), "head")
        locks = [hc + Vector(v) for v in [(0, 0.11, 0.0), (0, 0.17, -0.13), (0, 0.2, -0.3), (0, 0.21, -0.48)]]
        bones = self.sway("braid", "head", locks)
        for i in range(3):
            self.add(tube(f"Braid{i}", locks[i], locks[i + 1], [(0, 0.05 - 0.008 * i, 0.044 - 0.008 * i), (1, 0.042 - 0.008 * i - (0.022 if i == 2 else 0), 0.036 - 0.008 * i - (0.018 if i == 2 else 0))], hair, seg=12), bones[i])
        self.add(band("BraidTie", locks[1] + (locks[2] - locks[1]) * 0.1, 0.036, 0.008, gold, seg=(16, 6), axis=locks[2] - locks[1]), bones[1])
        ring = hc + Vector((0, 0.005, 0.09))
        self.add(band("Circlet", ring, 0.128, 0.01, gold, seg=(36, 6)), "head")
        self.add(blob("CircletGem", ring + Vector((0, -0.136, 0.0)), (0.018, 0.01, 0.024), gem, (10, 8)), "head")
        for s, x in SIDES:
            for k, (ang, ln) in enumerate(((0.35, 0.13), (0.7, 0.16), (1.05, 0.12))):
                d = Vector((0.45 * x, 0.75, 0.0)).normalized() * math.cos(ang) + Vector((0, 0, math.sin(ang)))
                base = ring + Vector((0.12 * x, 0.02 + 0.008 * k, 0.0))
                self.add(tube(f"CircletWing{s}{k}", base, base + d * ln, [(0, 0.018, 0.005), (0.4, 0.024, 0.006), (1, 0.002, 0.002)], gold, seg=6, side=(0, 0, 1)), "head")
        # signature: the wings. A gold arm rises from each shoulder blade to a high wrist; nine feather plates hang from
        # it, short at the root and long toward the tip, overlapping into one wing shape with a feathered trailing edge.
        # Each sits a little behind the one before (no two in one plane) and has a gold spine.
        for s, x in SIDES:
            spar = [Vector((0.09 * x, 0.13, 1.38)), Vector((0.21 * x, 0.18, 1.64)), Vector((0.35 * x, 0.23, 1.86)), Vector((0.46 * x, 0.27, 1.8))]
            self.add(kit.blob(f"WingRoot{s}", spar[0], (0.04, 0.03, 0.05), gold, segs=(12, 8)), "chest")
            self.add(chain(f"WingArm{s}", spar, [0.026, 0.024, 0.02, 0.008], gold, seg=8), "chest")
            lens = [(spar[i + 1] - spar[i]).length for i in range(3)]

            def along(u, spar=spar, lens=lens):
                dist = max(0.0, min(1.0, u)) * sum(lens)
                for i in range(3):
                    if dist <= lens[i] or i == 2:
                        return spar[i].lerp(spar[i + 1], min(1.0, dist / lens[i]))
                    dist -= lens[i]
            for k in range(9):
                u = k / 8
                anchor = along(0.04 + 0.96 * u) + Vector((0, 0.006 * k, 0))
                th = math.radians(4 + 24 * u)
                d = Vector((math.sin(th) * x, 0.06, -math.cos(th))).normalized()
                tangent = (along(0.04 + 0.96 * u + 0.05) - along(0.04 + 0.96 * u - 0.05)).normalized()
                ln = 0.3 + 0.22 * u
                self.add(tube(f"Feather{s}{k}", anchor, anchor + d * ln, [(0, 0.035, 0.01), (0.3, 0.05, 0.012), (0.75, 0.044, 0.01), (1, 0.004, 0.004)], wing, seg=10, side=tangent), "chest")
                self.add(tube(f"FeatherSpine{s}{k}", anchor, anchor + d * ln * 0.8, [(0, 0.008, 0.008), (1, 0.003, 0.003)], gold, seg=6, side=tangent), "chest")
        # the hard-light sword in the right hand, blade down and forward
        h = self.hand_at(-1)
        self.add(tube("SwordGrip", h + Vector((0, 0, 0.06)), h + Vector((0, -0.015, -0.06)), [(0, 0.015, 0.015), (1, 0.015, 0.015)], gold, seg=8), "hand.R")
        self.add(blob("Pommel", h + Vector((0, 0.003, 0.08)), (0.022, 0.022, 0.022), gem, (10, 8)), "hand.R")
        g = h + Vector((0, -0.02, -0.075))
        self.add(kit.box("SwordGuard", g, (0.2, 0.035, 0.035), gold, bevel=0.01, segments=1), "hand.R")
        self.add(blob("GuardSun", g + Vector((0, -0.02, 0)), (0.026, 0.01, 0.026), light, (10, 8)), "hand.R")
        tip = g + Vector((0, -0.32, -0.7))
        d = (tip - g).normalized()
        self.add(tube("SwordBlade", g, tip, [(0, 0.045, 0.01), (0.85, 0.04, 0.009), (1, 0.003, 0.003)], wing, seg=8, side=(1, 0, 0)), "hand.R")
        self.add(tube("SwordCore", g + d * 0.03, tip - d * 0.08, [(0, 0.012, 0.012), (1, 0.006, 0.006)], light, seg=6), "hand.R")
        # the kite shield on the left forearm, half again as big, facing out and a little forward, a sun on its face
        c = Vector((0.31, -0.04, 1.03))
        M = Matrix.Translation(c) @ Matrix.Rotation(math.radians(-20), 4, "Z") @ Matrix.Translation(-c)
        kite = [(-0.16, 0.2), (-0.09, 0.24), (0.09, 0.24), (0.16, 0.2), (0.15, 0.03), (0.09, -0.15), (0.0, -0.3), (-0.09, -0.15), (-0.15, 0.03)]
        shield = [kit.extrude_shape("ShieldRim", kite, 0.03, gold, bevel=0.008, axis="X", centre=c),
                  kit.extrude_shape("ShieldFace", [(u * 0.84, v * 0.84 + 0.004) for u, v in kite], 0.036, tasset, bevel=0.006, axis="X", centre=c),
                  blob("ShieldSun", c + Vector((0.02, 0, 0.03)), (0.01, 0.05, 0.05), light, (14, 10))]
        for k in range(8):
            a = k * math.pi / 4
            d = Vector((0, math.cos(a), math.sin(a)))
            p0 = c + Vector((0.021, 0, 0.03)) + d * 0.06
            shield.append(tube(f"ShieldRay{k}", p0, p0 + d * (0.05 if k % 2 == 0 else 0.03), [(0, 0.008, 0.004), (1, 0.001, 0.001)], gold, seg=5))
        for ob in shield:
            kit.transform(ob, M)
            self.add(ob, "forearm.L")
        self.joints_fill(neck=(skin, 0.042), shoulder=(plate, 0.056), elbow=(plate, 0.048), wrist=(skin, 0.036), hip=(legs, 0.075), knee=(legs, 0.056))


# ============================================================================================ plaid
def check_loft(name, rings, mats, rows, cols, per_row=3, per_col=4):
    """
    A loft through control `rings` (centre, u, v) in big two-colour checks: two objects, one per entry in `mats`, whose
    cells meet along mesh lines (paint and merge work per material, so a check pattern needs no texture). Open ends.
    """
    import bmesh
    n = rows * per_row + 1
    cs, us, vs = (kit.spline([r[i] for r in rings], n) for i in range(3))
    seg = cols * per_col
    out = []
    for which, m in enumerate(mats):
        bm = bmesh.new()
        verts = {}

        def V(r, k):
            k %= seg
            if (r, k) not in verts:
                a = 2 * math.pi * k / seg
                verts[(r, k)] = bm.verts.new(cs[r] + math.cos(a) * us[r] + math.sin(a) * vs[r])
            return verts[(r, k)]
        for r in range(n - 1):
            for k in range(seg):
                if (r // per_row + k // per_col) % 2 == which:
                    f = bm.faces.new((V(r, k), V(r, k + 1), V(r + 1, k + 1), V(r + 1, k)))
                    f.normal_update()
                    if f.normal.dot(f.calc_center_median() - cs[r]) < 0:
                        f.normal_flip()
        out.append(kit.mesh_object(f"{name}{which}", bm, m, True))
    return out


def sleeve_rings(sh, el, wr, radii):
    """Control rings down an arm for check_loft: a rounded cap inside the shoulder, then `radii` from shoulder to wrist."""
    back = (sh - el).normalized()
    path = [sh + back * radii[0] * f for f in (0.95, 0.72, 0.38)]
    rs = [radii[0] * f for f in (0.3, 0.7, 0.93)] + list(radii)
    k = len(radii) - 1
    for i in range(len(radii)):
        t = i / k
        path.append(sh.lerp(el, t * 2) if t <= 0.5 else el.lerp(wr, t * 2 - 1))
    rings = []
    for i, p in enumerate(path):
        a = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        u = (Vector((0, 1, 0)) - Vector((0, 1, 0)).dot(a) * a).normalized()
        rings.append((p, u * rs[i], a.cross(u) * rs[i]))
    return rings


# ============================================================================================ Bram
class Mason(MobaFigure):
    """
    Bram, the Pillar Mason (bruiser): a broad, friendly stonemason. A dusty grey shirt with rolled sleeves over huge bare
    forearms, a full leather apron with a pocket, a tool belt with a big chisel, dusty hair, a square jaw and a wide kind
    smile. Signature: a giant pale wooden mallet held out in the right hand, a T against the sky. Gerald is the kit's.
    """

    J = dict(hip=0.80, waist=0.92, neck=1.44, head=1.50, top=1.74, shoulder=(0.30, 0.02, 1.37),
             elbow_x=0.37, elbow_z=1.10, wrist_x=0.41, wrist_z=0.84, hand=0.12, leg_x=0.13, knee=0.44)

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Jaw", "Ear", "Cheek"), 0.0042, 6000, None, 8),
            ("Skin", "skin", ("Face",), 0.0075, 5000, None, 18),
            ("ShirtBody", "shirt", (), 0.008, 3500, None, 14),
            ("LegsBody", "trousers", (), 0.008, 2600, None, 14),
            ("Boots", "boot", (), 0.008, 2200, None, 10),
            ("HairBody", "hair", (), 0.006, 1500, None, 8))
    WRAP = (("Mouth", "Face", 0.002), ("Teeth", "Face", 0.0052))
    PAINT = {"skin": dict(warm=1.0), "leather": dict(shadow=(0.7, 0.52, 0.42)), "shirt": dict(shadow=(0.72, 0.68, 0.7))}

    def __init__(self):
        super().__init__("mason", self.J)

    def body(self):
        boot = self.mat("boot", "#3c2f26", roughness=0.8)
        cap_m = self.mat("bootcap", "#6e6558", roughness=0.9)
        cloth = self.mat("trousers", "#6d6a66", roughness=0.95)
        shirt = self.mat("shirt", "#a39d92", roughness=0.95)
        roll = self.mat("roll", "#c4bdae", roughness=0.95)
        leather = self.mat("leather", "#8c5426", roughness=0.7, double_sided=True)
        dark = self.mat("leatherdark", "#4c2c14", roughness=0.75, double_sided=True)
        dust = self.mat("dust", "#c9b48a", roughness=1.0)
        skin = self.mat("skin", "#c98d62", roughness=0.6)
        hair = self.mat("hair", "#94887a", roughness=0.9)
        browm = self.mat("brow", "#4e4238", roughness=0.8)
        kerchief = self.mat("kerchief", "#3f7aa8", roughness=0.75)
        wood = self.mat("mallet", "#d9b27a", roughness=0.7)
        wood_end = self.mat("malletend", "#f0d8a8", roughness=0.8)
        haft = self.mat("haft", "#7c5128", roughness=0.7)
        iron = self.mat("iron", "#55504e", metallic=0.4, roughness=0.45)
        steel = self.mat("steel", "#b8bcc0", metallic=0.6, roughness=0.3)
        brass = self.mat("brass", "#d8a838", metallic=0.7, roughness=0.3)
        pencil = self.mat("pencil", "#ffc21e", roughness=0.5)
        eyew = self.mat("eyewhite", "#fff8ec", roughness=0.4)
        iris = self.mat("iris", "#5a3a1c", roughness=0.25)
        J = self.J

        # legs and boots, darkest; dusty toe caps
        self.legs(cloth, boot, thigh=(0.105, 0.088), shin=0.08, boot_r=0.1, boot_top=0.32, toe=0.22)
        self.add(loft("Hips", [kit.ring_z(z, rx, ry) for z, rx, ry in [(0.96, 0.27, 0.22), (0.86, 0.27, 0.22), (0.76, 0.2, 0.17)]], cloth, seg=24), ["pelvis", "thigh.L", "thigh.R"])
        for s, x in SIDES:
            self.add(blob(f"BootCap{s}", (J["leg_x"] * x, -0.2, 0.055), (0.082, 0.085, 0.052), cap_m, (14, 10)), f"foot.{s}")
            self.add(band(f"BootCuff{s}", (J["leg_x"] * x, 0, 0.32), 0.108, 0.016, dark, seg=(22, 6)), f"shin.{s}")
        # a barrel of a torso in the dusty shirt
        barrel = [(0.86, 0.26, 0.21, 0), (0.98, 0.31, 0.26, -0.015), (1.12, 0.34, 0.28, -0.02), (1.26, 0.355, 0.275, -0.01), (1.38, 0.32, 0.245, 0.0), (1.46, 0.22, 0.17, 0.0), (1.5, 0.09, 0.08, 0.0)]
        self.add(loft("Torso", [kit.ring_z(z, rx, ry, cy) for z, rx, ry, cy in barrel], shirt, seg=28), ["chest", "pelvis"])

        # the apron: a bib on the chest and a wide skirt over the thighs, curved round him, a dark hem, a big pocket
        skirt = short_skirt(J["hip"], J["knee"], 0.2)

        def apron_w(p):
            if p.z < 0.97:
                return skirt(p)
            t = figure_kit.smooth(1.0, 1.14, p.z)
            return {"chest": t, "pelvis": 1 - t}
        front = -math.pi / 2
        bib = [(1.36, 0.325, 0.262, -0.002), (1.26, 0.368, 0.288, -0.01), (1.12, 0.352, 0.293, -0.02), (0.98, 0.324, 0.274, -0.015)]
        self.add(arc_shell("ApronBib", bib, front - 0.62, front + 0.62, leather, thick=0.012, seg=24), apron_w)
        low = [(0.99, 0.325, 0.275, -0.015), (0.86, 0.35, 0.3, -0.02), (0.68, 0.37, 0.32, -0.025), (0.5, 0.38, 0.33, -0.03)]
        self.add(arc_shell("ApronSkirt", low, front - 1.25, front + 1.25, leather, thick=0.012, seg=40), apron_w)
        hem = [(0.53, 0.383, 0.333, -0.03), (0.48, 0.388, 0.338, -0.032)]
        self.add(arc_shell("ApronHem", hem, front - 1.27, front + 1.27, dark, thick=0.014, seg=40), apron_w)
        pocket = [(0.86, 0.362, 0.312, -0.02), (0.68, 0.382, 0.332, -0.025)]
        self.add(arc_shell("Pocket", pocket, front - 0.6, front + 0.6, dark, thick=0.012, seg=20), apron_w)
        # dust: one big patted hand mark on the bib, where he wiped a hand
        hand = Vector((0.1, -0.3, 1.2))
        self.add(kit.blob("DustPalm", hand, (0.042, 0.01, 0.042), dust, segs=(12, 8)), apron_w)
        for k, (dx, dz) in enumerate(((-0.035, 0.06), (-0.012, 0.072), (0.012, 0.072), (0.034, 0.06), (-0.058, 0.012))):
            self.add(kit.blob(f"DustFinger{k}", hand + Vector((dx, 0.001, dz)), (0.011, 0.008, 0.026), dust, segs=(8, 6), rotation=Euler((0, 0.5 * dx / 0.035 * 0.5, 0))), apron_w)
        # straps from the bib over the shoulders, crossing on his back, tied at the belt
        for s, x in SIDES:
            pts = [(0.19 * x, -0.262, 1.33), (0.17 * x, -0.2, 1.43), (0.14 * x, -0.03, 1.495), (0.13 * x, 0.14, 1.44), (0.05 * x, 0.268, 1.27), (-0.1 * x, 0.285, 1.1), (-0.22 * x, 0.235, 0.98)]
            self.add(chain(f"Strap{s}", pts, [(0.03, 0.009)] * len(pts), dark, seg=8), ["chest", "pelvis"])
        # the tool belt, a brass buckle, a pouch on one hip, and the big chisel stuck through it on the other
        self.add(loft("Belt", [kit.ring_z(0.945, 0.326, 0.286, -0.016), kit.ring_z(1.015, 0.33, 0.288, -0.016)], dark, seg=28), "pelvis")
        self.add(kit.box("Buckle", (0, -0.31, 0.98), (0.1, 0.022, 0.08), brass, bevel=0.008, segments=1), "pelvis")
        self.add(box("Pouch", (-0.3, -0.17, 0.87), (0.14, 0.09, 0.15), dark, bevel=0.02), "pelvis")
        self.add(box("PouchFlap", (-0.302, -0.22, 0.925), (0.145, 0.02, 0.05), leather, bevel=0.008), "pelvis")
        top, tip = Vector((0.24, -0.285, 1.13)), Vector((0.285, -0.335, 0.74))
        self.add(tube("ChiselGrip", top, top.lerp(tip, 0.42), [(0, 0.026, 0.026), (0.1, 0.034, 0.034), (1, 0.03, 0.03)], haft, seg=10), "pelvis")
        self.add(band("ChiselFerrule", top.lerp(tip, 0.42), 0.032, 0.008, brass, seg=(14, 6), axis=tip - top), "pelvis")
        self.add(tube("ChiselBlade", top.lerp(tip, 0.42), tip, [(0, 0.024, 0.024), (0.7, 0.04, 0.012), (1, 0.042, 0.003)], steel, seg=8, side=(1, 0, 0)), "pelvis")
        self.add(band("ChiselLoop", top.lerp(tip, 0.3), 0.04, 0.01, leather, seg=(16, 6), axis=tip - top), "pelvis")

        # arms: sleeves rolled above the elbow, a thick pale roll, huge bare forearms and fists
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            self.add(tube(f"UpperArm{s}", sh, sh.lerp(el, 0.82), [(0, 0.115, 0.115), (0.5, 0.118, 0.112), (1, 0.104, 0.104)], shirt, seg=14), f"upper_arm.{s}")
            self.add(torus(f"Roll{s}", sh.lerp(el, 0.8), 0.104, 0.03, roll, seg=(32, 8), axis=el - sh), [f"upper_arm.{s}", f"forearm.{s}"])
            self.add(tube(f"Bicep{s}", sh.lerp(el, 0.6), el, [(0, 0.09, 0.09), (1, 0.092, 0.092)], skin, seg=14), [f"upper_arm.{s}", f"forearm.{s}"])
            self.add(tube(f"Forearm{s}", el, wr, [(0, 0.095, 0.095), (0.38, 0.135, 0.128), (1, 0.09, 0.085)], skin, seg=14), [f"forearm.{s}", f"upper_arm.{s}"])
            self.fist(x, skin, 1.08)

        # head: big, a square jaw, big ears, kind eyes under dark level brows, a wide smile with teeth
        hc = Vector((0, -0.035, 1.635))
        r = (0.135, 0.132, 0.15)
        self.head_shape(hc, r, skin, chin=1.0)
        self.add(blob("Jaw", hc + Vector((0, -0.025, -0.095)), (0.128, 0.105, 0.062), skin, (16, 10)), "head")
        for s, x in SIDES:
            self.add(blob(f"JawCorner{s}", hc + Vector((0.094 * x, -0.025, -0.115)), (0.034, 0.055, 0.03), skin, (10, 8)), "head")
            self.add(blob(f"Ear{s}", hc + Vector((0.137 * x, 0.008, -0.002)), (0.018, 0.034, 0.046), skin, (10, 8)), "head")
            self.add(blob(f"Cheek{s}", hc + Vector((0.07 * x, -0.108, -0.045)), (0.036, 0.022, 0.028), skin, (12, 8)), "head")
        self.add(blob("Nose", hc + Vector((0, -0.14, -0.022)), (0.03, 0.03, 0.03), skin, (12, 10)), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.058, size=(0.028, 0.032), z=0.022)
        for s, x in SIDES:
            # raised at the inner end: a kind, slightly worried brow
            pts = [hc + Vector((0.024 * x, -0.13, 0.088)), hc + Vector((0.062 * x, -0.123, 0.082)), hc + Vector((0.104 * x, -0.095, 0.052))]
            self.add(chain(f"Brow{s}", pts, [0.011, 0.014, 0.008], browm, seg=8), "head")
        self.grin(hc, r, -0.53, 0.07, 0.024, 0.021, self.mat("lips", "#6e2c20", roughness=0.5, double_sided=True), self.mat("teeth", "#fff8ec", roughness=0.4, double_sided=True))
        # short dusty hair, thick and tufted; a closed mass behind the hairline (the fuse drops an open shell)
        self.add(blob("HairCap", hc + Vector((0, 0.038, 0.05)), (0.147, 0.135, 0.128), hair, (22, 14)), "head")
        self.add(blob("HairBack", hc + Vector((0, 0.06, -0.05)), (0.135, 0.09, 0.095), hair, (16, 10)), "head")
        for k, (dx, dy, dz, rad) in enumerate(((0.0, -0.075, 0.135, 0.05), (0.07, -0.06, 0.125, 0.045), (-0.07, -0.06, 0.125, 0.045), (0.035, 0.0, 0.16, 0.05), (-0.04, 0.01, 0.16, 0.05),
                                               (0.105, 0.0, 0.115, 0.042), (-0.105, 0.0, 0.115, 0.042), (0.05, 0.08, 0.14, 0.045), (-0.05, 0.08, 0.14, 0.045))):
            self.add(blob(f"HairTuft{k}", hc + Vector((dx, dy, dz)), (rad * 1.1, rad, rad * 0.8), hair, (12, 8)), "head")
        for s, x in SIDES:
            self.add(chain(f"Sideburn{s}", [hc + Vector((0.128 * x, -0.025, 0.05)), hc + Vector((0.133 * x, -0.04, -0.03))], [0.022, 0.014], hair, seg=8), "head")
        # a carpenter's pencil behind the ear, a small joke
        self.add(tube("Pencil", hc + Vector((0.145, -0.075, 0.06)), hc + Vector((0.145, 0.085, 0.04)), [(0, 0.011, 0.011), (1, 0.011, 0.011)], pencil, seg=6), "head")
        # a blue neckerchief, the one saturated colour on him; a triangle shows on his back
        self.add(torus("Kerchief", (0, 0.0, 1.475), 0.125, 0.04, kerchief, seg=(32, 8)), ["chest", "neck"])
        self.add(tube("KerchiefBack", (0, 0.14, 1.47), (0, 0.205, 1.25), [(0, 0.15, 0.012), (1, 0.003, 0.003)], kerchief, seg=8, side=(1, 0, 0)), "chest")
        self.add(blob("KerchiefKnot", (0, -0.15, 1.45), (0.04, 0.03, 0.035), kerchief, (12, 8)), "chest")
        for s, x in SIDES:
            self.add(tube(f"KerchiefTail{s}", (0.01 * x, -0.165, 1.44), (0.055 * x, -0.25, 1.34), [(0, 0.022, 0.008), (1, 0.038, 0.008)], kerchief, seg=8, side=(1, 0, 0)), "chest")

        # signature: the giant mallet, held out from the right fist, a T: a pale barrel across the top of the haft
        h = self.hand_grip(-1)
        d = Vector((-0.45, -0.1, 0.89)).normalized()
        a = Vector((0.89, 0, 0.45)).normalized()
        self.add(tube("MalletHaft", h - d * 0.2, h + d * 0.74, [(0, 0.036, 0.036), (0.1, 0.031, 0.031), (1, 0.036, 0.036)], haft, seg=10), "hand.R")
        c = h + d * 0.74
        ln = 0.3
        self.add(tube("MalletHead", c - a * ln, c + a * ln, [(0, 0.11, 0.11), (0.03, 0.165, 0.165), (0.5, 0.178, 0.178), (0.97, 0.165, 0.165), (1, 0.11, 0.11)], wood, seg=18), "hand.R")
        for k, t in enumerate((-0.2, 0.2)):
            self.add(band(f"MalletBand{k}", c + a * t, 0.176, 0.017, iron, seg=(32, 6), axis=a), "hand.R")
        for k, t in enumerate((-1.0, 1.0)):
            self.add(kit.blob(f"MalletEnd{k}", c + a * t * ln, (0.11, 0.11, 0.008), wood_end, segs=(20, 6), rotation=a.to_track_quat("Z", "Y").to_euler()), "hand.R")
        self.joints_fill(neck=(skin, 0.09), elbow=(skin, 0.098), wrist=(skin, 0.09), hip=(cloth, 0.105), knee=(cloth, 0.09), shoulder=(shirt, 0.115))


# ============================================================================================ Silvane
class Mirror(MobaFigure):
    """
    Silvane, the Vain (marksman): tall and elegant, a silver floor-length gown with a small train and a big lilac bow on
    the back, opera gloves, half-lidded eyes and her whole head tipped back, nose in the air. Signature: a tower of
    perfect violet hair rising out of a high standing fan collar, and a big round hand mirror held out in the right
    hand, its glass on both faces so the bright pale blue disc reads from the front and from the game camera behind her.
    """

    J = dict(hip=0.98, waist=1.1, neck=1.52, head=1.58, top=1.9, shoulder=(0.165, 0.01, 1.46),
             elbow_x=0.205, elbow_z=1.22, wrist_x=0.232, wrist_z=1.0, hand=0.09, leg_x=0.085, knee=0.55)

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear", "Cheek"), 0.0036, 7000, None, 10),
            ("Skin", "skin", ("Face",), 0.005, 1200, None, 10),
            ("BodiceBody", "bodice", (), 0.006, 3500, None, 12),
            ("GloveBody", "glove", (), 0.0045, 2600, None, 10),
            ("LegsBody", "legs", (), 0.008, 1000, None, 10),
            ("Boots", "boot", (), 0.008, 800, None, 8),
            ("HairBody", "hair", ("Curl", "Ringlet"), 0.005, 4500, None, 8))
    FOLDS = ((("Gown",), dict(below=1.05, n=13, amp=0.011, seed=5.0)),)
    WRAP = (("Mouth", "Face", 0.002),)
    PAINT = {"skin": dict(warm=0.7), "hair": dict(shadow=(0.62, 0.5, 0.95)), "gown": dict(shadow=(0.62, 0.68, 0.95)),
             "bodice": dict(shadow=(0.62, 0.68, 0.95))}

    def __init__(self):
        super().__init__("mirror", self.J)

    def body(self):
        boot = self.mat("boot", "#3a3450", roughness=0.5)
        legs = self.mat("legs", "#7f88a0", roughness=0.8)
        gown = self.mat("gown", "#a9b3c8", metallic=0.35, roughness=0.36)
        lining = self.mat("lining", "#7e78b8", roughness=0.7, double_sided=True)
        plate = self.mat("bodice", "#b4bdd0", metallic=0.35, roughness=0.34)
        collar_m = self.mat("collar", "#b9c2d6", metallic=0.35, roughness=0.34, double_sided=True)
        collar_in = self.mat("collarin", "#d9b8ff", roughness=0.55, double_sided=True)
        glove = self.mat("glove", "#e0d4f2", roughness=0.5)
        bow = self.mat("bow", "#c49af5", roughness=0.5)
        gold = self.mat("gold", "#e6b840", metallic=0.75, roughness=0.26)
        # pale blue, not white: more emission blows out to white on screen
        glass = self.mat("glass", "#6a98c0", roughness=0.1, emission="#a8d8ff", strength=0.85)
        shine = self.mat("shine", "#ffffff", roughness=0.1, emission="#ffffff", strength=2.0)
        skin = self.mat("skin", "#f2dcd2", roughness=0.5)
        hair = self.mat("hair", "#8d55dc", roughness=0.42)
        roll = self.mat("hairroll", "#a877ee", roughness=0.42)
        eyew = self.mat("eyewhite", "#ffffff", roughness=0.4)
        iris = self.mat("iris", "#4aa8e8", roughness=0.2, emission="#4aa8e8", strength=0.5)
        lash = self.mat("lash", "#2a1c42", roughness=0.5)
        lid = self.mat("lid", "#b48fe6", roughness=0.45)
        J = self.J

        # thin legs: they only have to stay inside the gown through a stride
        self.legs(legs, boot, thigh=(0.06, 0.045), shin=0.04, toe=0.18, boot_r=0.046, boot_top=0.3)
        # the gown: from the waist to the floor, drawn a little backward into a short train
        table = [(1.12, 0.122, 0.092, 0.0), (0.98, 0.178, 0.135, 0.0), (0.82, 0.232, 0.175, 0.012), (0.62, 0.284, 0.218, 0.03), (0.42, 0.335, 0.268, 0.055), (0.24, 0.385, 0.325, 0.09), (0.09, 0.44, 0.39, 0.13)]

        def gown_w(p):
            s = figure_kit.smooth(J["hip"] + 0.02, J["knee"] + 0.05, p.z)
            left = figure_kit.clamp(0.5 + p.x / 0.14)
            wl, wr = 0.85 * s * left, 0.85 * s * (1 - left)
            return {"pelvis": 1 - wl - wr, "thigh.L": wl, "thigh.R": wr}
        self.add(loft("Gown", [kit.ring_z(z, rx, ry, cy) for z, rx, ry, cy in table], gown, seg=28, cap=(False, False)), gown_w)
        self.add(loft("GownLining", [kit.ring_z(z - 0.004, rx * 0.97, ry * 0.97, cy) for z, rx, ry, cy in table[3:]], lining, seg=28, cap=(False, False)), gown_w)
        # a gold hem and a row of little round mirrors round the skirt: her one idea, repeated
        z0, rx, ry, cy = table[-1]
        pts = [Vector(((rx + 0.006) * math.cos(a), cy + (ry + 0.006) * math.sin(a), z0)) for a in (2 * math.pi * k / 48 for k in range(49))]
        self.add(chain("Hem", pts, [0.016] * len(pts), gold, seg=6), gown_w)
        asc = list(reversed(table))
        for k in range(9):
            a = -math.pi / 2 + (k - 4) * 0.5
            z = 0.3
            r_x, r_y, c_y = figure_kit.interp(asc, z)
            n = Vector((math.cos(a) / r_x, math.sin(a) / r_y, 0.25 / r_x)).normalized()
            c = Vector(((r_x + 0.022) * math.cos(a), c_y + (r_y + 0.022) * math.sin(a), z))
            self.add(kit.blob(f"Sequin{k}", c, (0.036, 0.036, 0.008), glass, segs=(14, 6), rotation=n.to_track_quat("Z", "Y").to_euler()), gown_w)
            self.add(band(f"SequinRim{k}", c, 0.038, 0.007, gold, seg=(16, 5), axis=n), gown_w)
        # a narrow bodice, a thin gold belt, puffed sleeves, long gloves
        self.add(loft("Bodice", [kit.ring_z(z, rx, ry) for z, rx, ry in
                                 [(1.08, 0.13, 0.098), (1.17, 0.112, 0.085), (1.28, 0.136, 0.098), (1.38, 0.158, 0.108), (1.47, 0.126, 0.09), (1.53, 0.055, 0.05)]], plate, seg=24), ["chest", "pelvis"])
        self.add(loft("Belt", [kit.ring_z(1.09, 0.135, 0.104), kit.ring_z(1.13, 0.127, 0.098)], gold, seg=24), "pelvis")
        self.arms(plate, glove, glove, r=(0.05, 0.042, 0.036), hand=(0.04, 0.045, 0.06))
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            pw = (lambda arm: (lambda p: {"chest": 0.25, arm: 0.75}))(f"upper_arm.{s}")
            self.add(blob(f"Puff{s}", sh + Vector((0.026 * x, 0, -0.018)), (0.078, 0.078, 0.07), plate, (20, 14)), pw)
            self.add(band(f"PuffBand{s}", sh.lerp(el, 0.36), 0.06, 0.009, gold, seg=(20, 6), axis=el - sh), f"upper_arm.{s}")
            self.add(band(f"GloveTop{s}", el + (sh - el).normalized() * 0.025, 0.046, 0.007, gold, seg=(20, 6), axis=el - sh), f"upper_arm.{s}")
        # a big bow on the small of her back with two long tails: what the game camera sees of her gown
        self.add(blob("BowKnot", (0, 0.115, 1.12), (0.05, 0.04, 0.045), bow, (14, 10)), "pelvis")
        for s, x in SIDES:
            self.add(blob(f"BowLoop{s}", (0.14 * x, 0.145, 1.145), (0.125, 0.04, 0.085), bow, (18, 12), rotation=Euler((0, -0.28 * x, 0))), "pelvis")
            tail = [Vector((0.05 * x, 0.15, 1.1)), Vector((0.1 * x, 0.235, 0.86)), Vector((0.14 * x, 0.3, 0.62)), Vector((0.17 * x, 0.36, 0.38))]
            bones = self.sway(f"bow{s}", "pelvis", tail)
            for i in range(3):
                self.add(tube(f"BowTail{s}{i}", tail[i], tail[i + 1], [(0, 0.05 + 0.008 * i, 0.009), (1, 0.058 + 0.008 * i, 0.009)], bow, seg=8, side=(1, 0, 0)), bones[i])
        # a pale gem on the chest, a gold choker
        self.add(blob("Pendant", (0, -0.105, 1.42), (0.022, 0.012, 0.028), glass, (10, 8)), "chest")
        self.add(band("Choker", (0, 0, 1.565), 0.05, 0.008, gold, seg=(20, 6)), ["chest", "neck"])

        # the fan collar: rises off the shoulders and flares behind her head; a silver back, a lilac inside, a gold rim
        def fan(z, off=0.0):
            t = (z - 1.47) / 0.5
            return (z, 0.098 + 0.165 * t ** 1.2 - off, 0.1 + 0.17 * t ** 1.1 - off, 0.02 + 0.05 * t)
        cuts = [1.97, 1.86, 1.76, 1.66, 1.56, 1.47]
        a0, a1 = -0.42, math.pi + 0.42
        self.add(arc_shell("Collar", [fan(z) for z in cuts], a0, a1, collar_m, thick=0.008, seg=40), "chest")
        self.add(arc_shell("CollarIn", [fan(z, 0.009) for z in cuts], a0, a1, collar_in, thick=0.005, seg=40), "chest")

        def on_fan(z, a):
            _, rx_, ry_, cy_ = fan(z)
            return Vector((rx_ * math.cos(a), cy_ + ry_ * math.sin(a), z))
        rim = [on_fan(z, a0) for z in reversed(cuts)] + [on_fan(cuts[0], a0 + (a1 - a0) * k / 40) for k in range(1, 40)] + [on_fan(z, a1) for z in cuts]
        self.add(chain("CollarRim", rim, [0.009] * len(rim), gold, seg=6), "chest")

        # everything from here to the tilt is the head: built level, then the whole head tipped back round the neck
        first = len(self.parts)
        hc = Vector((0, -0.005, 1.725))
        r = (0.116, 0.122, 0.14)
        self.head_shape(hc, r, skin, chin=0.32)
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.114 * x, 0.005, -0.005)), (0.012, 0.024, 0.032), skin, (10, 8)), "head")
            self.add(chain(f"Earring{s}", [hc + Vector((0.118 * x, 0.0, -0.04)), hc + Vector((0.118 * x, -0.002, -0.09))], [0.007, 0.012], glass, seg=8), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.052, size=(0.03, 0.034), z=0.012)
        # half-closed lilac lids, a heavy lash line, thin arched brows: she has seen you and is not impressed
        for s, x in SIDES:
            ex = 0.052 * x
            ey = hc.y - r[1] * math.sqrt(1 - (ex / r[0]) ** 2) + 0.012
            c = Vector((ex, ey, hc.z + 0.012))
            self.add(blob(f"Lid{s}", c + Vector((0, -0.002, 0.014)), (0.033, 0.0165, 0.018), lid, (14, 8)), "head")
            arc = [c + Vector((d_ * x, -0.018 + 0.05 * d_ * d_ * 4, 0.002)) for d_ in (-0.036, 0.0, 0.036)] + [c + Vector((0.05 * x, 0.0, 0.014))]
            self.add(chain(f"Lash{s}", arc, [0.004, 0.007, 0.007, 0.002], lash, seg=6), "head")
            brow = [hc + Vector((0.022 * x, -0.112, 0.062)), hc + Vector((0.058 * x, -0.108, 0.086)), hc + Vector((0.098 * x, -0.078, 0.062))]
            self.add(chain(f"Brow{s}", brow, [0.004, 0.0065, 0.002], lash, seg=6), "head")
        # a small red smirk, up on one side
        self.grin(hc, r, -0.56, 0.034, 0.006, 0.0085, self.mat("lips", "#d42c68", roughness=0.35, double_sided=True), skew=0.005)
        # the nose: long, fine, and turned up
        self.add(chain("NoseBridge", [hc + Vector((0, -0.112, 0.012)), hc + Vector((0, -0.132, -0.02)), hc + Vector((0, -0.155, -0.045)), hc + Vector((0, -0.16, -0.048))], [0.01, 0.012, 0.015, 0.006], skin, seg=10), "head")
        # the hair, swept up from her neck into three perfect rolls and a bun: the tallest thing in the game
        self.add(blob("HairCap", hc + Vector((0, 0.035, 0.05)), (0.128, 0.125, 0.122), hair, (22, 14)), "head")
        self.add(blob("HairBack", hc + Vector((0, 0.05, -0.02)), (0.12, 0.095, 0.11), hair, (16, 10)), "head")
        self.add(blob("HairTower", hc + Vector((0, 0.02, 0.2)), (0.128, 0.128, 0.205), hair, (24, 16)), "head")
        self.add(blob("HairBun", hc + Vector((0, 0.02, 0.44)), (0.064, 0.064, 0.056), hair, (16, 12)), "head")
        # strands swept up the beehive in a lighter violet; three gold pins in the bun
        for k in range(8):
            pts = []
            for u in (0.0, 0.25, 0.5, 0.75, 1.0):
                dz = 0.05 + 0.33 * u
                rad = 0.131 * math.sqrt(max(0.0, 1 - ((dz - 0.2) / 0.208) ** 2))
                a = 2 * math.pi * k / 8 + 1.0 * u
                pts.append(hc + Vector((rad * math.cos(a), 0.02 + rad * math.sin(a), dz)))
            self.add(chain(f"Strand{k}", pts, [0.006, 0.014, 0.016, 0.012, 0.004], roll, seg=8), "head")
        for k, a in enumerate((-0.6, 0.0, 0.6)):
            self.add(blob(f"HairPin{k}", hc + Vector((0.06 * math.sin(a), 0.02 - 0.06 * math.cos(a), 0.47)), (0.014, 0.014, 0.014), gold, (10, 8)), "head")
        self.add(chain("CurlFront", [hc + Vector(v) for v in [(0.04, -0.09, 0.128), (0.0, -0.118, 0.115), (-0.03, -0.122, 0.09), (-0.018, -0.128, 0.075)]], [0.018, 0.016, 0.01, 0.003], hair, seg=8), "head")
        for s, x in SIDES:
            lock = [hc + Vector(v) for v in [(0.104 * x, -0.045, 0.03), (0.118 * x, -0.06, -0.04), (0.108 * x, -0.052, -0.1), (0.118 * x, -0.058, -0.15)]]
            self.add(chain(f"Ringlet{s}", lock, [0.017, 0.015, 0.012, 0.004], hair, seg=8), "head")
        tilt = Matrix.Translation((0, 0, J["head"])) @ Matrix.Rotation(math.radians(-18), 4, "X") @ Matrix.Translation((0, 0, -J["head"]))
        for ob, _ in self.parts[first:]:
            kit.transform(ob, tilt)

        # signature: the hand mirror in the right hand, up and out: a gold handle and frame, a bright pale glass on both
        # faces (a toilette mirror turns), with a diagonal shine that says "glass" at any distance
        h = self.hand_at(-1)
        d = Vector((-0.53, -0.03, 0.85)).normalized()
        c = h + d * 0.5
        n = Vector((-0.28, -0.96, 0.05)).normalized()
        side = d.cross(n).normalized()
        self.add(tube("MirrorHandle", h - d * 0.1, c - d * 0.2, [(0, 0.015, 0.015), (0.5, 0.013, 0.013), (1, 0.018, 0.018)], gold, seg=10), "hand.R")
        self.add(blob("MirrorPommel", h - d * 0.115, (0.024, 0.024, 0.024), gold, (10, 8)), "hand.R")
        self.add(blob("MirrorNeck", c - d * 0.215, (0.034, 0.034, 0.034), gold, (12, 8)), "hand.R")
        self.add(blob("MirrorGlass", c, (0.195, 0.195, 0.02), glass, (32, 12), rotation=n.to_track_quat("Z", "Y").to_euler()), "hand.R")
        self.add(torus("MirrorFrame", c, 0.205, 0.022, gold, seg=(44, 8), axis=n), "hand.R")
        self.add(blob("MirrorCrest", c + d * 0.24, (0.036, 0.036, 0.036), gold, (12, 8)), "hand.R")
        for k in (-1, 1):
            self.add(blob(f"MirrorLeaf{k}", c + d * 0.22 + side * 0.055 * k, (0.03, 0.03, 0.024), gold, (12, 8)), "hand.R")
        diag, perp = (d + side).normalized(), (d - side).normalized()
        for k, f in enumerate((-1, 1)):
            for j, (off, w) in enumerate(((0.05, 0.024), (-0.03, 0.011))):
                p = c + perp * off + n * f * 0.019
                ln = 0.145 - abs(off) * 0.5
                self.add(tube(f"MirrorShine{k}{j}", p - diag * ln, p + diag * ln, [(0, w * 0.6, 0.003), (0.5, w, 0.003), (1, w * 0.6, 0.003)], shine, seg=6, side=perp), "hand.R")
        self.joints_fill(neck=(skin, 0.04), shoulder=(plate, 0.056), elbow=(glove, 0.044), wrist=(glove, 0.034), hip=(legs, 0.07), knee=(legs, 0.052))


# ============================================================================================ Hank
class Timber(MobaFigure):
    """
    Hank Birchwood, the Lumberjack (bruiser): huge. A red and black check shirt in big checks, yellow suspenders, jeans
    with pale turn-ups, heavy boots, a green woolly hat with a bobble, a round red nose and small happy eyes.
    Signature: the beard, a brown avalanche from his ears to his belly on three sway bones, and the very large
    double-bitted axe held upright at his side, its head above his own, wider than his shoulders.
    """

    J = dict(hip=0.86, waist=0.98, neck=1.54, head=1.6, top=1.92, shoulder=(0.34, 0.02, 1.47),
             elbow_x=0.42, elbow_z=1.18, wrist_x=0.46, wrist_z=0.9, hand=0.12, leg_x=0.155, knee=0.47)

    SCULPT = True
    FUSE = (("Face", "skin", ("only", "Head", "Nose", "Ear", "Cheek"), 0.0042, 4500, None, 8),
            ("Skin", "skin", ("Face",), 0.0075, 3500, None, 18),
            ("BeardBody", "beard", (), 0.0065, 4500, None, 8),
            ("LegsBody", "jeans", (), 0.008, 3000, None, 14),
            ("Boots", "boot", (), 0.008, 2400, None, 10),
            ("HatBody", "hat", (), 0.006, 1800, None, 8))
    PAINT = {"skin": dict(warm=1.0), "beard": dict(shadow=(0.62, 0.42, 0.34)), "jeans": dict(shadow=(0.62, 0.7, 1.0))}

    def __init__(self):
        super().__init__("timber", self.J)

    def body(self):
        boot = self.mat("boot", "#3a2414", roughness=0.75)
        sole = self.mat("sole", "#17110c", roughness=0.9)
        jeans = self.mat("jeans", "#2f5596", roughness=0.9)
        pocket = self.mat("jeansdark", "#24427a", roughness=0.9)
        turn = self.mat("turnup", "#8fb0dc", roughness=0.9)
        red = self.mat("plaidred", "#d42a22", roughness=0.85)
        black = self.mat("plaidblack", "#1e1a20", roughness=0.85)
        susp = self.mat("suspenders", "#f0b828", roughness=0.6)
        brass = self.mat("brass", "#d8a838", metallic=0.7, roughness=0.3)
        belt = self.mat("belt", "#3a2414", roughness=0.7)
        skin = self.mat("skin", "#dc9c78", roughness=0.6)
        nose = self.mat("nosetip", "#e0604a", roughness=0.45)
        beard = self.mat("beard", "#7c4820", roughness=0.85)
        stache = self.mat("stache", "#935a2a", roughness=0.8)
        hat = self.mat("hat", "#3f6b3a", roughness=0.95)
        bobble = self.mat("bobble", "#e8dfc8", roughness=1.0)
        steel = self.mat("axesteel", "#7f8a96", metallic=0.55, roughness=0.32)
        edge = self.mat("axeedge", "#eef4fa", metallic=0.5, roughness=0.2)
        wood = self.mat("haft", "#a06a34", roughness=0.65)
        paint = self.mat("haftpaint", "#d42a22", roughness=0.5)
        eyew = self.mat("eyewhite", "#fff8ec", roughness=0.4)
        iris = self.mat("iris", "#3a2412", roughness=0.25)
        J = self.J

        # jeans with pale turn-ups and heavy boots with thick soles
        self.legs(jeans, boot, thigh=(0.122, 0.1), shin=0.092, boot_r=0.108, boot_top=0.33, toe=0.24)
        self.add(loft("Hips", [kit.ring_z(z, rx, ry, cy) for z, rx, ry, cy in [(1.0, 0.3, 0.26, -0.01), (0.9, 0.32, 0.26, 0), (0.8, 0.3, 0.24, 0), (0.72, 0.2, 0.17, 0)]], jeans, seg=24), ["pelvis", "thigh.L", "thigh.R"])
        for s, x in SIDES:
            X = J["leg_x"] * x
            self.add(tube(f"TurnUp{s}", (X, 0, 0.42), (X, 0, 0.33), [(0, 0.118, 0.118), (0.2, 0.128, 0.128), (1, 0.13, 0.13)], turn, seg=14), f"shin.{s}")
            self.add(blob(f"Sole{s}", (X, -0.085, 0.026), (0.112, 0.215, 0.026), sole, (20, 8)), f"foot.{s}")
            self.add(blob(f"BootToe{s}", (X, -0.2, 0.075), (0.092, 0.095, 0.068), boot, (14, 10)), f"foot.{s}")
            # back pockets, for the camera behind him
            self.add(kit.box(f"BackPocket{s}", (0.14 * x, 0.245, 0.86), (0.13, 0.016, 0.13), pocket, bevel=0.012, segments=1), "pelvis")

        # the shirt in big checks: a barrel over a belly, sleeves to the wrist, a black cuff
        tr = [(1.56, 0.12, 0.11, 0.01), (1.5, 0.3, 0.215, 0.01), (1.38, 0.405, 0.285, 0.0), (1.24, 0.395, 0.325, -0.02), (1.1, 0.375, 0.335, -0.035), (0.96, 0.32, 0.275, -0.015)]
        for ob in check_loft("Shirt", [kit.ring_z(z, rx, ry, cy) for z, rx, ry, cy in tr], (red, black), 4, 12, per_row=3, per_col=4):
            self.add(ob, ["chest", "pelvis"])
        self.add(loft("ShirtTop", [kit.ring_z(1.58, 0.1, 0.095, 0.01), kit.ring_z(1.54, 0.16, 0.14, 0.01)], black, seg=20), "chest")
        for s, x in SIDES:
            sh, el, wr = self.shoulder_pts(x)
            rings = sleeve_rings(sh, el, el.lerp(wr, 0.9), [0.125, 0.125, 0.112, 0.116, 0.1])
            for ob in check_loft(f"Sleeve{s}", rings, (black, red), 6, 4, per_row=3, per_col=6):
                self.add(ob, [f"upper_arm.{s}", f"forearm.{s}"])
            self.add(tube(f"Cuff{s}", el.lerp(wr, 0.8), wr + (wr - el).normalized() * 0.012, [(0, 0.114, 0.114), (1, 0.114, 0.114)], black, seg=16), f"forearm.{s}")
            self.fist(x, skin, 1.12)
        # buttons down the belly, under the beard's tip
        for k, z in enumerate((1.17, 1.07, 0.98)):
            self.add(kit.blob(f"Button{k}", (0, -0.37 + 0.11 * (1.17 - z), z), (0.018, 0.008, 0.018), bobble, segs=(10, 6)), "chest" if z > 1.03 else "pelvis")
        # the belt and yellow suspenders: a Y on his back, two straps on his front
        self.add(loft("Belt", [kit.ring_z(0.945, 0.325, 0.275, -0.013), kit.ring_z(1.015, 0.333, 0.288, -0.017)], belt, seg=28), "pelvis")
        self.add(kit.box("Buckle", (0, -0.3, 0.98), (0.095, 0.02, 0.075), brass, bevel=0.008, segments=1), "pelvis")
        # laid on the shirt's surface, a little proud of it
        def on_shirt(x_, z, back):
            rx, ry, cy = figure_kit.interp(list(reversed(tr)), z)
            return (x_, cy + (1 if back else -1) * (ry * math.sqrt(max(0.0, 1 - (x_ / rx) ** 2)) + 0.016), z)
        for s, x in SIDES:
            pts = [on_shirt(0.225 * x, z, False) for z in (1.02, 1.16, 1.3, 1.42)] + [(0.195 * x, -0.13, 1.5), (0.175 * x, 0.0, 1.535), (0.16 * x, 0.14, 1.505)] + [on_shirt(u * x, z, True) for u, z in ((0.14, 1.42), (0.075, 1.32), (0.012, 1.24))]
            self.add(chain(f"Suspender{s}", pts, [(0.042, 0.01)] * len(pts), susp, seg=8), ["chest", "pelvis"])
            self.add(kit.box(f"SuspClip{s}", (0.225 * x, on_shirt(0.225, 1.03, False)[1] - 0.008, 1.03), (0.062, 0.016, 0.05), brass, bevel=0.006, segments=1), "pelvis")
        back = [on_shirt(0.0, z, True) for z in (1.24, 1.13, 1.02)]
        self.add(chain("SuspenderBack", back, [(0.048, 0.01)] * 3, susp, seg=8), ["chest", "pelvis"])
        self.add(blob("SuspenderCross", (0, back[0][1] + 0.006, 1.24), (0.06, 0.012, 0.05), brass, (10, 6)), "chest")

        # the head: small next to the beard, a round red nose, small happy eyes between the hat and the moustache
        hc = Vector((0, -0.05, 1.735))
        r = (0.128, 0.125, 0.14)
        self.head_shape(hc, r, skin, chin=0.7)
        for s, x in SIDES:
            self.add(blob(f"Ear{s}", hc + Vector((0.128 * x, 0.01, -0.005)), (0.018, 0.03, 0.04), skin, (10, 8)), "head")
            self.add(blob(f"Cheek{s}", hc + Vector((0.075 * x, -0.095, -0.03)), (0.036, 0.022, 0.028), skin, (12, 8)), "head")
        self.eyes(hc, r, eyew, iris, eyew, spread=0.056, size=(0.031, 0.035), z=0.012)
        self.add(blob("NoseBall", hc + Vector((0, -0.138, -0.04)), (0.04, 0.038, 0.036), nose, (16, 12)), "head")
        # the beard: clumps melted together, wider than his neck by far, on the head at the top and on sway bones below
        pts = [(0, -0.21, 1.53), (0, -0.28, 1.4), (0, -0.33, 1.27), (0, -0.39, 1.11)]
        bones = self.sway("beard", "head", pts)

        def beard_w(p):
            s = figure_kit.smooth(1.42, 1.58, p.z)
            m = figure_kit.smooth(1.26, 1.42, p.z)
            k = figure_kit.smooth(1.14, 1.28, p.z)
            return {"head": s, bones[0]: (1 - s) * m, bones[1]: (1 - s) * (1 - m) * k, bones[2]: (1 - s) * (1 - m) * (1 - k)}
        y0 = hc.y
        clumps = [((0, -0.075, 1.625), (0.15, 0.1, 0.075)), ((0, -0.15, 1.54), (0.19, 0.115, 0.1)), ((0, -0.2, 1.42), (0.225, 0.13, 0.13)), ((0, -0.265, 1.28), (0.175, 0.105, 0.14)), ((0, -0.32, 1.15), (0.09, 0.075, 0.1))]
        for k, (c, rad) in enumerate(clumps):
            self.add(blob(f"BeardMass{k}", (c[0], y0 + c[1], c[2]), rad, beard, (20, 14)), beard_w)
        lobes = [(0.128, -0.02, 1.68, 0.05, 0.06, 0.09), (0.165, -0.06, 1.56, 0.068, 0.08, 0.1), (0.21, -0.12, 1.44, 0.082, 0.09, 0.115), (0.2, -0.17, 1.31, 0.07, 0.08, 0.11), (0.125, -0.24, 1.2, 0.07, 0.07, 0.12),
                 (0.07, -0.28, 1.1, 0.05, 0.055, 0.1), (0.075, -0.24, 1.46, 0.07, 0.08, 0.09), (0.1, -0.29, 1.33, 0.065, 0.07, 0.09)]
        for k, (lx, ly, lz, a, b, c) in enumerate(lobes):
            for s, x in SIDES:
                self.add(blob(f"BeardLobe{s}{k}", (lx * x, y0 + ly, lz), (a, b, c), beard, (14, 10)), beard_w)
        self.add(blob("BeardTip", (0.012, y0 - 0.335, 1.04), (0.042, 0.04, 0.065), beard, (12, 10)), beard_w)
        # the same hair at the nape, seen under the hat from behind
        self.add(blob("BeardNape", hc + Vector((0, 0.065, -0.05)), (0.122, 0.078, 0.09), beard, (16, 10)), "head")
        for s, x in SIDES:
            curl = [hc + Vector(v) for v in [(0.0, -0.15, -0.078), (0.05 * x, -0.16, -0.082), (0.105 * x, -0.14, -0.1), (0.15 * x, -0.095, -0.118)]]
            self.add(chain(f"Moustache{s}", curl, [0.024, 0.034, 0.03, 0.01], stache, seg=10), "head")
            brow = [hc + Vector((0.022 * x, -0.128, 0.066)), hc + Vector((0.06 * x, -0.122, 0.066)), hc + Vector((0.104 * x, -0.09, 0.03))]
            self.add(chain(f"Brow{s}", brow, [0.013, 0.016, 0.008], stache, seg=8), "head")
        # a small happy mouth showing between moustache and beard
        mouth = [hc + Vector((dx, -0.198 + 1.5 * dx * dx, -0.158 + 6 * dx * dx)) for dx in (-0.05, -0.025, 0, 0.025, 0.05)]
        self.add(chain("Mouth", mouth, [(0.005, 0.004), (0.016, 0.006), (0.02, 0.007), (0.016, 0.006), (0.005, 0.004)], self.mat("lips", "#c8483a", roughness=0.5), seg=8, side=(0, 0, 1)), "head")
        # the woolly hat: a thick turn-up, a slouching crown and a big bobble
        self.add(blob("HatCrown", hc + Vector((0, 0.014, 0.115)), (0.146, 0.15, 0.13), hat, (22, 14)), "head")
        self.add(loft("HatCuff", [kit.ring_z(hc.z + 0.074, 0.14, 0.14, hc.y + 0.012), kit.ring_z(hc.z + 0.088, 0.153, 0.15, hc.y + 0.012), kit.ring_z(hc.z + 0.136, 0.153, 0.15, hc.y + 0.014), kit.ring_z(hc.z + 0.158, 0.14, 0.138, hc.y + 0.014)], hat, seg=24), "head")
        self.add(band("HatStripe", (0, hc.y + 0.013, hc.z + 0.112), 0.15, 0.011, self.mat("hatstripe", "#f0b828", roughness=0.9), seg=(36, 6)), "head")
        self.add(blob("Bobble", hc + Vector((0.012, 0.018, 0.268)), (0.068, 0.068, 0.062), bobble, (16, 12)), "head")

        # signature: the axe. Upright from the right fist down to the ground, its head above his own, two great curved
        # bits across the view, so it reads wide from the front and from behind
        h = self.hand_grip(-1)
        d = Vector((-0.2, -0.015, 0.98)).normalized()
        low, top = h - d * 0.78, h + d * 1.26
        self.add(tube("AxeHaft", low, top, [(0, 0.03, 0.03), (0.5, 0.036, 0.036), (1, 0.032, 0.032)], wood, seg=10), "hand.R")
        for k, t in enumerate((-0.68, 0.5, 0.56)):
            self.add(band(f"HaftBand{k}", h + d * t, 0.04, 0.012, paint, seg=(14, 6), axis=d), "hand.R")
        c = h + d * 1.1
        M = Matrix.Translation(c) @ Matrix.Rotation(math.atan2(d.x, d.z), 4, "Y")
        bit = [(0.03, 0.082), (0.12, 0.085), (0.22, 0.12), (0.32, 0.19), (0.42, 0.285), (0.47, 0.19), (0.495, 0.1), (0.505, 0.0), (0.495, -0.1), (0.47, -0.19), (0.42, -0.285), (0.32, -0.19), (0.22, -0.12), (0.12, -0.085), (0.03, -0.082)]
        # the bright ground edge: a flat bead just inside the blade's curve, tapering to both tips
        strip = [(0.415, 0.272), (0.452, 0.19), (0.478, 0.1), (0.488, 0.0), (0.478, -0.1), (0.452, -0.19), (0.415, -0.272)]
        for f in (1, -1):
            b = kit.extrude_shape(f"AxeBit{f}", [(u * f, v) for u, v in bit], 0.034, steel, bevel=0.005, centre=(0, 0, 0))
            e = kit.chain(f"AxeEdge{f}", [Vector((u * f, 0, v)) for u, v in strip], [(0.006, 0.019), (0.021, 0.019), (0.024, 0.02), (0.026, 0.021), (0.024, 0.02), (0.021, 0.019), (0.006, 0.019)], edge, seg=8, side=(1, 0, 0))
            for ob in (b, e):
                kit.transform(ob, M)
                self.add(ob, "hand.R")
        eye = kit.box("AxeEye", (0, 0, 0), (0.12, 0.09, 0.2), steel, bevel=0.015, segments=2)
        kit.transform(eye, M)
        self.add(eye, "hand.R")
        self.add(blob("AxeCap", top + d * 0.01, (0.042, 0.042, 0.028), steel, (12, 8)), "hand.R")
        self.joints_fill(neck=(skin, 0.1), wrist=(skin, 0.092), hip=(jeans, 0.122), knee=(jeans, 0.1))


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


# the concept shapes are the chosen look (forge_v2.glb, storm_v2.glb); "forge_a" and "storm_a" build the earlier shapes
FIGURES = {"forge": ForgeConcept, "storm": StormConcept, "forge_a": Forge, "storm_a": Storm, "blood": Blood, "frost": Frost, "sky": Sky, "void": Void,
           "sand": Sand, "dawn": Dawn, "mason": Mason, "mirror": Mirror, "timber": Timber}


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
