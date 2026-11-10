"""
The kit for heroes of the fourth style (pipeline/designs/style-v4/README.md): a realistic body, one continuous skin, on
the skeleton of Quaternius' Universal Animation Library, dressed in Blender. Plain bpy and bmesh plus figkit.py; the
body, hair and eyes are from pipeline/assets/ubc (Universal Base Characters, CC0).

A hero is one function `build(R)` in blender/heroes/real/<theme>.py that dresses a `Real`:

    R = Real("astral", sex="f")                 # the body: sex, height, width, depth, head size, skin tint
    R.mat("tunic", "#241a5c", rough=0.62)        # materials, by key
    R.hair("Hair_Long", "#16102e")               # a hair style of the pack (or build one with a piece bound to "Head")
    R.fitted("Tunic", ["pelvis", "spine", "clavicle", "upperarm"], "tunic")   # clothes cut from the body's own surface
    R.skirt("violet", hem=0.71, flare=1.55, trim="gold")                       # loose cloth, bound so legs lift it
    f = R.piece("hand_r"); f.tube(...)           # anything else: a figkit Fig bound to one bone (or "near", or a function)
    R.finish(out)                                # merge, drop hidden skin, one small texture, write the GLB

Blender's frame: X the figure's left, -Y its front, Z up; metres. The body stands in a T-pose, palms down. Heights are
read from the skeleton after the build is shaped (`R.z`: floor 0, ankle, knee, hip, waist, chest, neck, head, top).

What the game reads (src/motion/real.ts): the file name `<theme>_v4.glb`, the 65 bone names, feet at the origin facing
-Y. A thing held in a hand is bound to `hand_r` (or `hand_l`) and built along `R.grip("r")`: from the palm toward the
front, which is where a blade points in the pack's sword clips and where a torch stands in its torch clip.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector, kdtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figkit  # noqa: E402

PI = math.pi
PACK = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "pipeline", "assets", "ubc"))
OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "models", "heroes"))
BODY = {
    "f": ("Superhero_Female_FullBody.gltf", "T_Superhero_Female_Light_BaseColor.png"),
    "m": ("Superhero_Male_FullBody.gltf", "T_Superhero_Male_Ligh.png"),
}
TORSO = ("pelvis", "spine_01", "spine_02", "spine_03", "thigh_l", "thigh_r")


class Real:
    def __init__(self, name, sex="f", height=1.0, width=1.0, depth=1.0, head=1.0, skin=None, eyes=None, pack=PACK):
        """`height`, `width`, `depth`: the whole figure's build (1 = the pack's body), applied last: write the hero at
        the pack body's own size. `head`: the head's size against that. `skin`: the skin's average tone (None: as the pack
        has it). `eyes`: a colour the eye texture is multiplied by."""
        self.name, self.sex, self.pack = name, sex, pack
        self.build = (width, depth, height, head)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        gltf, light = BODY[sex]
        bpy.ops.import_scene.gltf(filepath=os.path.join(pack, "Base Characters", "Godot - UE", gltf))
        self.rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
        for o in list(bpy.data.objects):
            if o.type == "MESH" and o.parent is None:
                bpy.data.objects.remove(o, do_unlink=True)
        meshes = [o for o in bpy.data.objects if o.type == "MESH"]
        self.body = max(meshes, key=lambda o: len(o.data.vertices))
        self.eyes = bpy.data.objects.get("Eyes")
        self.brows = bpy.data.objects.get("Eyebrows")
        self.fig = figkit.Fig(name)
        self.M = self.fig.mats
        self.pieces = []
        self.covered = set()
        self._skin(os.path.join(pack, "Base Characters", "Textures", light), skin, eyes)
        self._read()

    # ---- the body ------------------------------------------------------------------------------------------------
    def _pivot(self):
        return self.rig.matrix_world @ self.rig.data.bones["neck_01"].head_local

    def _shaper(self):
        """co -> co for the build: the body scaled in width, depth and height, the head by its own size about the neck."""
        w, d, h, hd = self.build
        p = self._pivot()
        p2 = Vector((p.x * w, p.y * d, p.z * h))
        k = hd * h

        def shape(co, head_w=0.0):
            b = Vector((co.x * w, co.y * d, co.z * h))
            if head_w <= 0:
                return b
            return b.lerp(p2 + (co - p) * k, min(1.0, head_w))
        return shape

    def _head_w(self, ob):
        idx = [g.index for g in ob.vertex_groups if g.name in ("Head", "neck_01")]
        out = []
        for v in ob.data.vertices:
            out.append(sum(g.weight for g in v.groups if g.group in idx))
        return out

    def _shape_all(self):
        """Applies the build to the finished, merged figure: every hero is written at the pack body's own size, and its
        width, depth, height and head size come last, so nothing built on it has to know them."""
        if self.build == (1.0, 1.0, 1.0, 1.0):
            return
        shape = self._shaper()
        ob = self.body
        hw = self._head_w(ob)
        mw, inv = ob.matrix_world, ob.matrix_world.inverted()
        for v, w in zip(ob.data.vertices, hw):
            v.co = inv @ shape(mw @ v.co, w)
        w, d, h, hd = self.build
        bpy.context.view_layer.objects.active = self.rig
        bpy.ops.object.mode_set(mode="EDIT")
        hb = self.rig.data.edit_bones["Head"]
        ln = (hb.tail - hb.head).length
        for b in self.rig.data.edit_bones:
            b.head = Vector((b.head.x * w, b.head.y * d, b.head.z * h))
            b.tail = Vector((b.tail.x * w, b.tail.y * d, b.tail.z * h))
        # the head bone keeps pointing up, as long as the head is now
        hb.tail = hb.head + Vector((0, 0, max(0.03, ln * hd * h)))
        bpy.ops.object.mode_set(mode="OBJECT")

    def _skin(self, light, skin, eyes):
        for ob, tint in ((self.body, skin), (self.eyes, eyes)):
            if not ob:
                continue
            nt = ob.data.materials[0].node_tree
            bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
            tex = next(n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image and not any(k in n.image.name for k in ("Normal", "Roughness")))
            if ob is self.body and os.path.exists(light):
                tex.image = bpy.data.images.load(light)
            if ob is self.body and tex.image.size[0] > 1024:
                tex.image.scale(1024, 1024)
            if tint and ob is self.body:
                self._tone(tex.image, tint)
                tint = None
            for name in ("Normal", "Roughness", "Metallic", "Base Color"):
                for l in list(bsdf.inputs[name].links):
                    nt.links.remove(l)
            if tint:
                mix = nt.nodes.new("ShaderNodeMix")
                mix.data_type = "RGBA"
                mix.blend_type = "MULTIPLY"
                mix.inputs["Factor"].default_value = 1.0
                nt.links.new(tex.outputs["Color"], mix.inputs["A"])
                mix.inputs["B"].default_value = figkit.rgb(tint)
                nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
            else:
                nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
            bsdf.inputs["Roughness"].default_value = 0.62 if ob is self.body else 0.25
            bsdf.inputs["Metallic"].default_value = 0.0
            ob.data.materials[0].blend_method = "OPAQUE"

    @staticmethod
    def _tone(img, tone):
        """Moves the skin texture's average colour to `tone` (sRGB hex), keeping its shading."""
        import numpy as np
        px = np.empty(len(img.pixels), dtype=np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(-1, 4)
        h = tone.lstrip("#")
        want = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)
        # the texture's pixels are sRGB values here: work on them as they are
        mean = px[:, :3].mean(axis=0)
        px[:, :3] = np.clip(px[:, :3] * (want / np.maximum(mean, 1e-4)), 0, 1)
        img.pixels.foreach_set(px.reshape(-1))
        img.update()

    def _read(self):
        body = self.body
        self.names = [g.name for g in body.vertex_groups]
        mw = body.matrix_world
        self.world = [mw @ v.co for v in body.data.vertices]
        self.dom = []
        for v in body.data.vertices:
            best = max(v.groups, key=lambda g: g.weight) if v.groups else None
            self.dom.append(self.names[best.group] if best else "")
        self.kd = kdtree.KDTree(len(self.world))
        for i, p in enumerate(self.world):
            self.kd.insert(p, i)
        self.kd.balance()
        b = self.bone
        self.z = dict(ankle=b("foot_l").z, knee=b("calf_l").z, hip=b("thigh_l").z, waist=b("spine_01").z + 0.03,
                      chest=b("spine_03").z, neck=b("neck_01").z, head=b("Head").z, top=max(p.z for p in self.world))

    def bone(self, n):
        """Where a bone starts, in the world."""
        return self.rig.matrix_world @ self.rig.data.bones[n].head_local

    def ring(self, z, grow=1.0, dz=0.018, groups=TORSO):
        """The body's outline at height z: (centre, half width, half depth)."""
        pts = [p for p, d in zip(self.world, self.dom) if abs(p.z - z) < dz and d in groups]
        if len(pts) < 4:
            return self.ring(z, grow, dz * 2, groups) if dz < 0.2 else (Vector((0, 0, z)), 0.15 * grow, 0.1 * grow)
        x0, x1 = min(p.x for p in pts), max(p.x for p in pts)
        y0, y1 = min(p.y for p in pts), max(p.y for p in pts)
        return (Vector(((x0 + x1) / 2, (y0 + y1) / 2, z)), (x1 - x0) / 2 * grow, (y1 - y0) / 2 * grow)

    def grip(self, side="r"):
        """A held thing's frame in that hand: (palm centre, the way it points: the front, the way its top faces: up)."""
        h, f = self.bone(f"hand_{side}"), self.bone(f"middle_01_{side}")
        return h.lerp(f, 0.75) + Vector((0, 0, -0.02)), Vector((0, -1, 0)), Vector((0, 0, 1))

    # ---- materials, hair --------------------------------------------------------------------------------------------
    def mat(self, key, color, **kw):
        return self.fig.mat(key, color, **kw)

    def hair(self, style, color, rough=0.45, brows=True):
        """A hair style of the pack: Hair_Long, Hair_Buns, Hair_SimpleParted, Hair_Buzzed, Hair_BuzzedFemale, Hair_Beard."""
        key = f"hair_{len(self.M)}"
        self.mat(key, color, rough=rough)
        ob = None
        if style:
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=os.path.join(self.pack, "Hairstyles", "Rigged to Head Bone", "glTF (Godot -Unreal)", style + ".gltf"))
            new = [o for o in bpy.data.objects if o not in before]
            for o in new:
                if o.type == "MESH" and o.parent is not None:
                    o.parent = self.rig
                    for m in o.modifiers:
                        if m.type == "ARMATURE":
                            m.object = self.rig
                    ob = o
            for o in new:
                if o is not ob:
                    bpy.data.objects.remove(o, do_unlink=True)
            ob.data.materials.clear()
            ob.data.materials.append(self.M[key])
        if brows and self.brows:
            self.brows.data.materials.clear()
            self.brows.data.materials.append(self.M[key])
        return ob

    def bald(self):
        """No eyebrows either (a mask, a helm or an animal head covers the face)."""
        if self.brows:
            bpy.data.objects.remove(self.brows, do_unlink=True)
            self.brows = None

    def faceless(self):
        """No human face at all: the eyes and brows go, and the head's skin (an animal head or a full helm replaces it)."""
        for ob in (self.brows, self.eyes):
            if ob:
                bpy.data.objects.remove(ob, do_unlink=True)
        self.brows = self.eyes = None
        self.hide(["Head"])

    # ---- clothes cut from the body --------------------------------------------------------------------------------
    def region(self, groups, below=None, above=None, where=None):
        """A test for body vertices: led by a bone whose name starts with one of `groups`, between two heights."""
        groups = tuple(groups)

        def pred(i):
            if not self.dom[i].startswith(groups):
                return False
            z = self.world[i].z
            if below is not None and z > below:
                return False
            if above is not None and z < above:
                return False
            return where(self.world[i]) if where else True
        return pred

    def fitted(self, name, groups, mat, offset=0.006, below=None, above=None, where=None, keep_skin=False):
        """A fitted garment: the body's own faces in that region, pushed out by `offset` m. It moves exactly as the body."""
        pred = groups if callable(groups) else self.region(groups, below, above, where)
        body = self.body
        ob = body.copy()
        ob.data = body.data.copy()
        ob.name = name
        bpy.context.scene.collection.objects.link(ob)
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bm.verts.ensure_lookup_table()
        bm.normal_update()
        keep = [pred(v.index) for v in bm.verts]
        if not keep_skin:
            self.covered.update(i for i, k in enumerate(keep) if k)
        for v in bm.verts:
            v.co += v.normal * offset
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(keep[v.index] for v in f.verts)], context="FACES")
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.materials.clear()
        ob.data.materials.append(self.M[mat])
        return ob

    def hide(self, groups, below=None, above=None, where=None):
        """Removes that part of the body's skin (under a helm, an animal head, a full robe)."""
        pred = self.region(groups, below, above, where)
        self.covered.update(i for i in range(len(self.world)) if pred(i))

    # ---- loose pieces -------------------------------------------------------------------------------------------------
    def piece(self, how):
        """A figkit Fig for built shapes. `how` binds it: a bone name (rigid), "near" (the weights of the nearest body
        point) or f(co) -> {bone: weight}."""
        f = figkit.Fig(self.name)
        f.mats = self.M
        f.how = how
        self.pieces.append(f)
        return f

    def hang_w(self, top, hem, hold=0.92):
        """Weights for cloth hung from the waist over the legs: the pelvis at `top`, each side its thigh more toward `hem`."""
        z = self.z

        def w(co):
            t = max(0.0, min(1.0, (top - co.z) / max(1e-4, top - (z["hip"] - 0.06)))) ** 0.7
            left = max(0.0, min(1.0, 0.5 + co.x / 0.1))
            th = hold * t
            # below the knee a long robe follows the shins a little, so a stride moves its hem
            sh = 0.0
            if co.z < z["knee"]:
                sh = 0.35 * min(1.0, (z["knee"] - co.z) / max(1e-4, z["knee"] - hem))
            out = {"pelvis": 1 - th}
            for n, s in (("l", left), ("r", 1 - left)):
                if th * s > 0.001:
                    out[f"thigh_{n}"] = th * s * (1 - sh)
                    if sh > 0:
                        out[f"calf_{n}"] = th * s * sh
            return out
        return w

    def skirt(self, mat, hem, flare=1.5, top=None, trim=None, trim_h=0.022, depth=1.3, seg=36, arc=None, grow=1.0):
        """A skirt or a robe's lower half from the waist (`top`) to height `hem`: `flare` times the hips' width at the
        hem, `depth` times as deep as wide there. `arc` (a0, a1) for an open front or a tail."""
        z = self.z
        top = z["waist"] if top is None else top
        cw, rxw, ryw = self.ring(top)
        ch, rxh, ryh = self.ring(z["hip"] - 0.02)
        f = self.piece(self.hang_w(top, hem))
        mid = (hem + ch.z) / 2
        k = min(1.0, (ch.z - hem) / 0.25)
        rings = [(Vector((ch.x, ch.y - 0.01 * k, hem)), rxh * flare * grow, ryh * flare * depth * grow),
                 (Vector((ch.x, ch.y - 0.005 * k, mid)), rxh * (1.24 + (flare - 1.24) * 0.55) * grow, ryh * (1.34 + (flare * depth - 1.34) * 0.5) * grow),
                 (ch, rxh * 1.24 * grow, ryh * 1.34 * grow), (cw, rxw * 1.07 * grow, ryw * 1.1 * grow)]
        if hem > ch.z - 0.04:
            rings = [(Vector((ch.x, ch.y, hem)), rxh * flare * grow, ryh * flare * depth * grow), (cw, rxw * 1.07 * grow, ryw * 1.1 * grow)]
        f.loft(mat, rings, seg=seg, arc=arc)
        if trim:
            c0, rx0, ry0 = rings[0]
            f.loft(trim, [(c0, rx0 * 1.012, ry0 * 1.012), (c0 + Vector((0, 0, trim_h)), rx0 * 0.995, ry0 * 0.995)], seg=seg, arc=arc)
        return f

    def band(self, mat, z, height=0.06, grow=1.1, seg=36, how="near"):
        """A belt or a sash round the body at height z."""
        c, rx, ry = self.ring(z)
        f = self.piece(how)
        f.loft(mat, [(c + Vector((0, 0, -height / 2)), rx * (grow + 0.02), ry * (grow + 0.06)), (c + Vector((0, 0, height / 2)), rx * grow, ry * (grow + 0.04))], seg=seg)
        return f

    def collar(self, mat, height=0.055, grow=1.0):
        """A band round the base of the neck (it hides the edge of a tunic)."""
        z = self.z["neck"]
        neck = [p for p, d in zip(self.world, self.dom) if d == "neck_01" and abs(p.z - (z + 0.02)) < 0.03]
        cx, cy = sum(p.x for p in neck) / len(neck), sum(p.y for p in neck) / len(neck)
        rx, ry = max(abs(p.x - cx) for p in neck), max(abs(p.y - cy) for p in neck)
        f = self.piece("spine_03")
        f.loft(mat, [(Vector((cx, cy, z - 0.02)), rx * 1.5 * grow, ry * 1.45 * grow), (Vector((cx, cy, z - 0.02 + height * 0.6)), rx * 1.22 * grow, ry * 1.2 * grow),
                     (Vector((cx, cy, z - 0.02 + height)), rx * 1.12 * grow, ry * 1.1 * grow)], seg=28)
        return f, Vector((cx, cy - ry * 1.5 * grow, z - 0.03))

    def cape(self, mat, hem, width=0.36, top=None, trim=None, spread=1.3, seg=20):
        """A cape down the back from the shoulders to height `hem`: it follows the spine, stiffer toward the hem."""
        z = self.z
        cc, rxc, ryc = self.ring(z["chest"])
        cn, rxn, ryn = self.ring(z["neck"] - 0.05, dz=0.02)
        hip, chest = z["hip"], z["chest"]

        def w(co):
            if co.z > chest:
                return {"spine_03": 1.0}
            if co.z > hip:
                t = (co.z - hip) / (chest - hip)
                return {"spine_03": t, "pelvis": 1 - t}
            return {"pelvis": 1.0}
        f = self.piece(w)
        rings = [(Vector((0, cc.y + 0.03, hem)), width, width * 0.83), (Vector((0, cc.y + 0.02, hip)), width * 0.75, width * 0.58),
                 (Vector((0, cc.y + 0.01, chest)), rxc * 1.12, ryc * 1.3), (Vector((0, cc.y, (top or z["neck"]) - 0.05)), rxn * 0.75, ryn * 0.9)]
        rings = [r for r in rings if r[0].z >= hem - 1e-6]
        f.loft(mat, rings, arc=(PI - spread, PI + spread), seg=seg)
        if trim:
            c0, rx0, ry0 = rings[0]
            f.tube(trim, [(c0.x + rx0 * math.sin(a), c0.y - ry0 * math.cos(a), c0.z) for a in [PI - spread + 2 * spread * k / 16 for k in range(17)]], 0.007, seg=6)
        return f, rings

    # ---- common parts ---------------------------------------------------------------------------------------------------
    def leg_r(self, side, z, dz=0.02):
        """(centre, radius) of that leg at height z."""
        sx = 1 if side == "l" else -1
        pts = [p for p, d in zip(self.world, self.dom) if abs(p.z - z) < dz and d.startswith(("thigh_", "calf_")) and p.x * sx > 0]
        if not pts:
            return Vector((0.1 * sx, 0, z)), 0.06
        c = Vector((sum(p.x for p in pts) / len(pts), sum(p.y for p in pts) / len(pts), z))
        return c, max(math.hypot(p.x - c.x, p.y - c.y) for p in pts)

    def arm_r(self, side, t, bones=("lowerarm", "hand"), dx=0.02):
        """(centre, radius) of that forearm at `t` of the way from the elbow (0) to the wrist (1)."""
        e, w = self.bone(f"{bones[0]}_{side}"), self.bone(f"{bones[1]}_{side}")
        c = e.lerp(w, t)
        pts = [p for p, d in zip(self.world, self.dom) if abs(p.x - c.x) < dx and d.startswith(("lowerarm_", "upperarm_", "hand_")) and p.x * c.x > 0]
        if not pts:
            return c, 0.04
        c = Vector((c.x, sum(p.y for p in pts) / len(pts), sum(p.z for p in pts) / len(pts)))
        return c, max(math.hypot(p.y - c.y, p.z - c.z) for p in pts)

    def boots(self, mat, top=None, cuff=None, toe=None, offset=0.009):
        """Boots to height `top` (default: just over the knee): the leg's own surface, a real foot over the bare toes,
        an optional cuff ring and toe cap."""
        w = d = h = 1.0
        z = self.z
        top = z["knee"] + 0.09 if top is None else top
        self.fitted("Boots", lambda i: self.dom[i].startswith(("foot_", "ball_")) or (self.dom[i].startswith(("calf_", "thigh_")) and self.world[i].z < top), mat, offset=offset)
        for n in "lr":
            f = self.piece(f"foot_{n}")
            heel, tb = self.bone(f"foot_{n}"), self.bone(f"ball_{n}")
            f.ellipsoid(mat, Vector((heel.x, (heel.y + tb.y) / 2 - 0.05 * d, 0.05 * h)), (0.058 * w, 0.155 * d, 0.055 * h), seg=(18, 10))
            if toe:
                f.ellipsoid(toe, Vector((heel.x, tb.y - 0.105 * d, 0.04 * h)), (0.045 * w, 0.04 * d, 0.035 * h), seg=(12, 8))
            if cuff:
                c, r = self.leg_r(n, top - 0.01)
                bone = "calf" if top < z["knee"] else "thigh"
                self.piece(f"{bone}_{n}").torus(cuff, c, r + offset + 0.004, 0.008, seg=(24, 6))

    def cuffs(self, mat, at=(0.1, 0.93), thick=0.007, offset=0.008):
        """Rings round each forearm at those shares of the way from elbow to wrist."""
        for n in "lr":
            f = self.piece(f"lowerarm_{n}")
            e, w = self.bone(f"lowerarm_{n}"), self.bone(f"hand_{n}")
            for t in at:
                c, r = self.arm_r(n, t)
                f.torus(mat, c, r + offset, thick, normal=(w - e), seg=(20, 6))

    def pauldrons(self, mat, size=(0.07, 0.06, 0.03), lift=0.035, out=0.03, bone="upperarm"):
        """A rounded plate on each shoulder."""
        w = d = h = 1.0
        for s, n in ((1, "l"), (-1, "r")):
            f = self.piece(f"{bone}_{n}")
            f.ellipsoid(mat, self.bone(f"upperarm_{n}") + Vector((out * s, 0, lift)), (size[0] * w, size[1] * d, size[2] * h), seg=(16, 8))

    def held(self, side="r"):
        """A piece bound to that hand and its frame: (fig, palm centre, the way it points, up)."""
        o, d, up = self.grip(side)
        return self.piece(f"hand_{side}"), o, d, up

    def head_piece(self):
        """A piece bound to the head, and (head centre, head radius) to build round."""
        z = self.z
        hz = (z["head"] + z["top"]) / 2 + 0.02
        pts = [p for p, d in zip(self.world, self.dom) if d == "Head"]
        r = max(max(abs(p.x) for p in pts), 0.08)
        cy = sum(p.y for p in pts) / len(pts)
        return self.piece("Head"), Vector((0, cy, hz)), r

    # ---- out ----------------------------------------------------------------------------------------------------------
    def _bind(self, ob, how):
        rig, body = self.rig, self.body
        ob.parent = rig
        ob.matrix_parent_inverse = rig.matrix_world.inverted()
        ob.modifiers.new("Armature", "ARMATURE").object = rig
        groups = {}

        def add(n, i, w):
            if n not in groups:
                groups[n] = ob.vertex_groups.new(name=n)
            groups[n].add([i], w, "REPLACE")
        for v in ob.data.vertices:
            if how == "near":
                _, idx, _ = self.kd.find(ob.matrix_world @ v.co)
                for g in body.data.vertices[idx].groups:
                    if g.weight > 0.01:
                        add(self.names[g.group], v.index, g.weight)
            elif callable(how):
                for n, w in how(ob.matrix_world @ v.co).items():
                    add(n, v.index, w)
            else:
                add(how, v.index, 1.0)

    def finish(self, out=None):
        """Binds the pieces, drops the skin under the clothes, merges everything into one mesh and writes the GLB."""
        out = out or os.path.join(OUT, f"{self.name}_v4.glb")
        for f in self.pieces:
            for ob in f.finish():
                self._bind(ob, f.how)
        body = self.body
        bm = bmesh.new()
        bm.from_mesh(body.data)
        covered = self.covered
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(v.index in covered for v in f.verts)], context="FACES")
        bm.to_mesh(body.data)
        bm.free()
        meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == self.rig]
        bpy.ops.object.select_all(action="DESELECT")
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.join()
        body.name = self.name
        self._shape_all()
        self.rig.select_set(True)
        bpy.context.view_layer.objects.active = self.rig
        bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_animations=False,
                                  export_skins=True, export_cameras=False, export_lights=False, export_image_format="JPEG", export_image_quality=80,
                                  export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True, export_vertex_color="NONE")
        print(f"WROTE {out} {round(os.path.getsize(out) / 1024)} KB, {len(body.data.polygons)} faces, {len(body.data.materials)} materials")
        return out

    def render(self, path, size=(420, 520)):
        """A check picture of the finished figure as it stands in Blender (the T-pose): front, three-quarter, side, back
        and the face, side by side in one PNG. Call after `finish`."""
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x, scene.render.resolution_y = size
        scene.render.film_transparent = False
        scene.view_settings.view_transform = "Standard"
        world = bpy.data.worlds.new("w")
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.05, 0.06, 1)
        world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
        scene.world = world
        for name, rot, energy in (("key", (0.9, 0.0, 0.6), 3.0), ("fill", (1.1, 0.0, -2.2), 1.2), ("rim", (2.2, 0.0, 2.8), 2.0)):
            light = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
            light.data.energy = energy
            light.rotation_euler = rot
            scene.collection.objects.link(light)
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        cam.data.lens = 60
        scene.collection.objects.link(cam)
        scene.camera = cam
        h = max((self.body.matrix_world @ v.co).z for v in self.body.data.vertices)
        head = self.bone("Head")
        views = [(0.0, None), (0.7, None), (PI / 2, None), (PI, None), (0.25, head)]
        tiles = []
        for i, (yaw, face) in enumerate(views):
            if face is None:
                target, dist = Vector((0, 0, h * 0.5)), max(3.2, h * 2.6)
            else:
                target, dist = face + Vector((0, 0, 0.09 * self.build[2] * self.build[3])), 1.0 * max(0.6, self.build[2])
            cam.location = target + Vector((math.sin(yaw) * dist, -math.cos(yaw) * dist, dist * 0.12))
            d = (target - cam.location).normalized()
            cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
            scene.render.filepath = f"{path}.{i}.png"
            bpy.ops.render.render(write_still=True)
            tiles.append(bpy.data.images.load(scene.render.filepath))
        import numpy as np
        w, hh = size
        sheet = np.zeros((hh, w * len(tiles), 4), dtype=np.float32)
        for i, img in enumerate(tiles):
            px = np.empty(w * hh * 4, dtype=np.float32)
            img.pixels.foreach_get(px)
            sheet[:, i * w:(i + 1) * w, :] = px.reshape(hh, w, 4)
        outimg = bpy.data.images.new("sheet", w * len(tiles), hh)
        outimg.pixels.foreach_set(sheet.reshape(-1))
        outimg.filepath_raw = path
        outimg.file_format = "PNG"
        outimg.save()
        for i in range(len(tiles)):
            os.remove(f"{path}.{i}.png")
        print(f"RENDERED {path}")
