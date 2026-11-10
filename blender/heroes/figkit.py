"""
A small stand-alone figure kit: plain bpy and bmesh, no modules from outside this repo (the older builders, hero_figures.py
and moba_figures.py, need C:\\projectG\\xianxia\\blender). Written 2026-11-10 when the user chose a new hero style built
with new builders on any computer.

Blender's frame: X the figure's left, -Y its front, Z up; metres at the model's own size (the game draws heroes 1.3x).
A `Fig` gathers geometry per material key and turns each key into one mesh object (`finish`). Angles round the body's
upright axis start at the front (0), go to its left (pi/2) and its back (pi).
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(hexs):
    h = hexs.lstrip("#")
    return tuple(_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


class Fig:
    def __init__(self, name):
        self.name = name
        self.bms = {}
        self.mats = {}
        self.flat = set()
        # facet: few, flat faces everywhere (a folded-paper or cut-gem look)
        self.facet = False

    # ---- materials ---------------------------------------------------------------------------------------
    def mat(self, key, color, rough=0.6, metal=0.0, emit=None, strength=1.0, double=False, flat=False):
        m = bpy.data.materials.new(f"{self.name}_{key}")
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = rgb(color)
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
        if emit:
            b.inputs["Emission Color"].default_value = rgb(emit)
            b.inputs["Emission Strength"].default_value = strength
        m.use_backface_culling = not double
        self.mats[key] = m
        if flat:
            self.flat.add(key)
        return key

    def bm(self, key):
        if key not in self.mats:
            raise KeyError(f"no material {key}")
        if key not in self.bms:
            self.bms[key] = bmesh.new()
        return self.bms[key]

    # ---- shapes ------------------------------------------------------------------------------------------
    def ellipsoid(self, key, c, r, seg=(20, 12), rot=None, keep=None):
        """An ellipsoid at `c` with radii `r`; `keep(co)` False removes that vertex (an open hood of hair)."""
        bm = self.bm(key)
        if self.facet:
            seg = (max(6, seg[0] // 3), max(4, seg[1] // 3))
        m = Matrix.Translation(Vector(c)) @ (rot or Matrix.Identity(4)) @ Matrix.Diagonal((r[0], r[1], r[2], 1.0))
        vs = bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=1.0, matrix=m)["verts"]
        if keep:
            bmesh.ops.delete(bm, geom=[v for v in vs if not keep(v.co)], context="VERTS")

    def tube(self, key, pts, radii, seg=10, caps=True, squash=None):
        """A round tube through `pts`, its radius per point (a list or one number). `squash` (a, f): flatten along axis a by f."""
        bm = self.bm(key)
        if self.facet:
            seg = min(seg, 5)
        pts = [Vector(p) for p in pts]
        if not isinstance(radii, (list, tuple)):
            radii = [radii] * len(pts)
        rings = []
        ref = None
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            a = ref - t * ref.dot(t) if ref is not None else t.orthogonal()
            if a.length < 1e-6:
                a = t.orthogonal()
            a.normalize()
            ref = a
            b = t.cross(a).normalized()
            ring = []
            for k in range(seg):
                ang = 2 * math.pi * k / seg
                off = (a * math.cos(ang) + b * math.sin(ang)) * radii[i]
                if squash:
                    ax = Vector(squash[0]).normalized()
                    off -= ax * off.dot(ax) * (1 - squash[1])
                ring.append(bm.verts.new(p + off))
            rings.append(ring)
        for r0, r1 in zip(rings, rings[1:]):
            for k in range(seg):
                bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
        if caps:
            bm.faces.new(list(reversed(rings[0])))
            bm.faces.new(rings[-1])

    def loft(self, key, rings, seg=28, arc=None, cap_top=False, cap_bot=False):
        """Stacked rings (centre, rx, ry), bottom to top, joined into a skin. `arc` (a0, a1): only that part round the body."""
        bm = self.bm(key)
        if self.facet and arc is None:
            seg = 8
        a0, a1 = arc or (0.0, 2 * math.pi)
        n = seg if arc is None else seg + 1
        rows = []
        for c, rx, ry in rings:
            c = Vector(c)
            rows.append([bm.verts.new((c.x + rx * math.sin(a0 + (a1 - a0) * k / seg), c.y - ry * math.cos(a0 + (a1 - a0) * k / seg), c.z)) for k in range(n)])
        for r0, r1 in zip(rows, rows[1:]):
            for k in range(n if arc is None else n - 1):
                bm.faces.new((r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]))
        if arc is None:
            if cap_bot:
                bm.faces.new(list(reversed(rows[0])))
            if cap_top:
                bm.faces.new(rows[-1])

    def torus(self, key, c, big, small, normal=(0, 0, 1), seg=(36, 8), arc=None):
        """A ring of radius `big` round `c` in the plane with `normal`, `small` thick; `arc` (a0, a1) for part of it."""
        n = Vector(normal).normalized()
        u = n.orthogonal().normalized()
        v = n.cross(u).normalized()
        a0, a1 = arc or (0.0, 2 * math.pi)
        k = seg[0]
        pts = [Vector(c) + (u * math.cos(a0 + (a1 - a0) * i / k) + v * math.sin(a0 + (a1 - a0) * i / k)) * big for i in range(k + 1)]
        if arc is None:
            bm = self.bm(key)
            rings = []
            for i in range(k):
                p = pts[i]
                out = (p - Vector(c)).normalized()
                rings.append([bm.verts.new(p + (out * math.cos(2 * math.pi * j / seg[1]) + n * math.sin(2 * math.pi * j / seg[1])) * small) for j in range(seg[1])])
            for i in range(k):
                r0, r1 = rings[i], rings[(i + 1) % k]
                for j in range(seg[1]):
                    bm.faces.new((r0[j], r0[(j + 1) % seg[1]], r1[(j + 1) % seg[1]], r1[j]))
        else:
            self.tube(key, pts, small, seg=seg[1])

    def star(self, key, c, big, small, thick=0.012, points=4, normal=(0, -1, 0), turn=0.0):
        """A flat star facing `normal`."""
        bm = self.bm(key)
        n = Vector(normal).normalized()
        u = n.orthogonal().normalized()
        v = n.cross(u).normalized()
        front, back = [], []
        for i in range(points * 2):
            a = turn + math.pi * i / points
            r = big if i % 2 == 0 else small
            p = Vector(c) + (u * math.cos(a) + v * math.sin(a)) * r
            front.append(bm.verts.new(p + n * thick / 2))
            back.append(bm.verts.new(p - n * thick / 2))
        bm.faces.new(front)
        bm.faces.new(list(reversed(back)))
        m = len(front)
        for i in range(m):
            j = (i + 1) % m
            bm.faces.new((front[j], front[i], back[i], back[j]))

    # ---- out ---------------------------------------------------------------------------------------------
    def finish(self, collection=None):
        """One mesh object per material key."""
        coll = collection or bpy.context.scene.collection
        objs = []
        for key, bm in self.bms.items():
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
            smooth = key not in self.flat and not self.facet
            for f in bm.faces:
                f.smooth = smooth
            me = bpy.data.meshes.new(f"{self.name}_{key}")
            bm.to_mesh(me)
            bm.free()
            me.materials.append(self.mats[key])
            ob = bpy.data.objects.new(key.capitalize(), me)
            coll.objects.link(ob)
            objs.append(ob)
        self.bms = {}
        return objs
