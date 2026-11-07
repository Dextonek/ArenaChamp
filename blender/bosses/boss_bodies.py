"""
Raid boss bodies (design: pipeline/designs/raid-noonfall.md, "The bodies"): the Sun Warden, Ash and Ember.
Not heroes drawn big. Each is rigid parts in a named hierarchy, NO armature and NO skinning; the game poses them in
code (src/raid/bodies/*.ts). Every part is an object whose origin is the point it turns about, under one root empty
named for the boss. Stone, basalt and burnt cloth are chiselled from convex hulls (hard flat facets), with carved gold
inlay or glowing seams as separate thin pieces, and a baked colour attribute (dark at the bottom, light at the top,
a little different on every facet).

Run inside Blender (through the MCP server):

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\bosses")
    import boss_bodies; importlib.reload(boss_bodies)
    boss_bodies.build("warden")      # into the collection "Boss warden" (then "ash", "ember")
    boss_bodies.export("warden")     # build + public/models/bosses/warden.glb, then clear
    boss_bodies.sheet("warden")      # build + docs/bosses/warden_sheet.jpg (front and game camera, 1.8 m hero beside it)

Blender coordinates: metres, z up, the figure faces -Y; +X is the figure's own left. The export is y-up, so in the
game it faces +Z. Materials are Principled BSDF only, glow through Emission, nothing transparent (the game fades a
boss itself). A part that must glow on its own has its own material, because the game scales a material's emission
for the whole node (and the nodes under it).
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "public", "models", "bosses")
DOCS = os.path.join(ROOT, "docs", "bosses")
HERO = os.path.join(ROOT, "public", "models", "heroes", "forge_v2.glb")


# --- Materials and parts -------------------------------------------------------------------------------------------

def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h):
    h = h.lstrip("#")
    return tuple(_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


def material(name, color, metal=0.0, rough=0.8, emit=None, strength=0.0):
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*hexc(color), 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Emission Color"].default_value = (*hexc(emit or color), 1)
    b.inputs["Emission Strength"].default_value = strength
    m["glow"] = strength >= 1.0
    return m


class Part:
    """One rigid piece: geometry given in WORLD coordinates (rest pose), turning about `pivot`."""

    def __init__(self, boss, name, pivot, parent):
        self.boss, self.name, self.parent = boss, name, parent
        self.pivot = Vector(pivot)
        self.bm = bmesh.new()
        self.mats = []
        self.rng = random.Random(sum(map(ord, name)) * 7 + 3)

    def _mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _v(self, p):
        return self.bm.verts.new(Vector(p) - self.pivot)

    def face(self, pts, m):
        try:
            f = self.bm.faces.new([self._v(p) for p in pts])
            f.material_index = self._mi(m)
        except ValueError:
            pass

    def hull(self, pts, m, xf=None):
        """A faceted solid: the convex hull of the points (placed by the 4x4 `xf`, if any)."""
        xf = xf or Matrix.Identity(4)
        tmp = bmesh.new()
        vs = [tmp.verts.new(xf @ Vector(p)) for p in pts]
        res = bmesh.ops.convex_hull(tmp, input=vs)
        dead = list({g for g in res["geom_interior"] + res["geom_unused"] if isinstance(g, bmesh.types.BMVert)})
        bmesh.ops.delete(tmp, geom=dead, context="VERTS")
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
        bmesh.ops.dissolve_limit(tmp, angle_limit=0.02, verts=tmp.verts, edges=tmp.edges)
        mi = self._mi(m)
        mp = {}
        for f in tmp.faces:
            nv = []
            for v in f.verts:
                if v not in mp:
                    mp[v] = self.bm.verts.new(v.co - self.pivot)
                nv.append(mp[v])
            try:
                self.bm.faces.new(nv).material_index = mi
            except ValueError:
                pass
        tmp.free()

    def chunk(self, size, m, xf=None, bevel=0.06, taper=(1.0, 1.0), at=(0, 0, 0)):
        """A chamfered block: `size` (x, y, z) about `at`, the top scaled by `taper`, placed by `xf`."""
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        b = min(bevel, hx * 0.9, hy * 0.9, hz * 0.9)
        pts = []
        for sx in (-1, 1):
            for sy in (-1, 1):
                for sz in (-1, 1):
                    k = taper if sz > 0 else (1, 1)
                    cx, cy, cz = sx * hx * k[0], sy * hy * k[1], sz * hz
                    for d in ((b, 0, 0), (0, b, 0), (0, 0, b)):
                        pts.append((at[0] + cx - sx * d[0], at[1] + cy - sy * d[1], at[2] + cz - sz * d[2]))
        self.hull(pts, m, xf)

    def rock(self, c, radii, m, n=18, rough=0.25, rot=None, xf=None):
        """A faceted boulder: hull of scattered points on an ellipsoid."""
        r = self.rng
        pts = []
        for i in range(n):
            z = 1 - 2 * (i + 0.5) / n
            a = i * 2.399963
            s = math.sqrt(1 - z * z)
            k = 1 + r.uniform(-rough, rough)
            pts.append((s * math.cos(a) * radii[0] * k, s * math.sin(a) * radii[1] * k, z * radii[2] * k))
        base = Matrix.Translation(c) @ (rot.to_4x4() if rot else Matrix.Identity(4))
        self.hull(pts, m, (xf or Matrix.Identity(4)) @ base)

    def lathe(self, rings, m, sides=8, xf=None, rot0=0.0, jitter=0.0, loop=False, cap=True, zshape=None):
        """Rings of (z, r) turned about the local z axis into a faceted solid (a polygon of `sides`).
        `m` may be a list, one material per band between rings; `zshape(angle, ring)` lifts a vertex."""
        xf = xf or Matrix.Identity(4)
        r = self.rng
        grid = []
        for ri, (z, rad) in enumerate(rings):
            row = []
            for k in range(sides):
                a = rot0 + k * math.tau / sides
                q = rad * (1 + r.uniform(-jitter, jitter)) if rad > 0 else 0
                row.append(self._v(xf @ Vector((q * math.cos(a), q * math.sin(a), z + (zshape(a, ri) if zshape else 0)))))
            grid.append(row)
        n = len(grid)
        for i in range(n - 1 + (1 if loop else 0)):
            mi = self._mi(m[i] if isinstance(m, (list, tuple)) else m)
            a, b = grid[i], grid[(i + 1) % n]
            for k in range(sides):
                k2 = (k + 1) % sides
                try:
                    self.bm.faces.new([a[k], a[k2], b[k2], b[k]]).material_index = mi
                except ValueError:
                    pass
        mi = self._mi(m[0] if isinstance(m, (list, tuple)) else m)
        if cap and not loop:
            for row, flip in ((grid[0], True), (grid[-1], False)):
                if rings[0 if flip else -1][1] > 0:
                    try:
                        self.bm.faces.new(row[::-1] if flip else row).material_index = mi
                    except ValueError:
                        pass

    def finish(self):
        bm = self.bm
        if self.boss.solid:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(self.name)
        for f in bm.faces:
            f.smooth = False
        bm.to_mesh(me)
        bm.free()
        for mm in self.mats:
            me.materials.append(mm)
        self.boss.colour(me, self.pivot, self.mats)
        ob = bpy.data.objects.new(self.name, me)
        self.boss.coll.objects.link(ob)
        self.boss.attach(ob, self)
        return ob


class Boss:
    def __init__(self, name, height):
        self.name, self.height, self.solid = name, height, True
        self.coll = bpy.data.collections.new("Boss " + name)
        bpy.context.scene.collection.children.link(self.coll)
        root = bpy.data.objects.new(name, None)
        root.empty_display_type = "PLAIN_AXES"
        self.coll.objects.link(root)
        self.pivots = {name: Vector((0, 0, 0))}
        self.objs = {name: root}
        self.mat = {}

    def m(self, key, *a, **k):
        self.mat[key] = material(f"{self.name}_{key}", *a, **k)
        return self.mat[key]

    def part(self, name, pivot, parent=None):
        return Part(self, name, pivot, parent or self.name)

    def attach(self, ob, part):
        ob.parent = self.objs[part.parent]
        ob.matrix_parent_inverse = Matrix.Identity(4)
        ob.location = part.pivot - self.pivots[part.parent]
        self.pivots[part.name] = part.pivot
        self.objs[part.name] = ob

    def empty(self, name, pivot, parent=None):
        """A node with no mesh of its own (a joint that only holds others)."""
        p = self.part(name, pivot, parent)
        ob = bpy.data.objects.new(name, None)
        self.coll.objects.link(ob)
        self.attach(ob, p)
        return ob

    def colour(self, me, pivot, mats):
        """Baked shading in a `Col` attribute: dark low, light high, each facet a little different, up-facing lighter."""
        att = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        rng = random.Random(len(me.polygons) * 31 + 5)
        H = self.height
        for poly in me.polygons:
            mm = mats[poly.material_index] if poly.material_index < len(mats) else None
            glow = bool(mm and mm.get("glow"))
            jit = rng.uniform(0.84, 1.0)
            up = poly.normal.z * 0.10
            for li in poly.loop_indices:
                z = pivot.z + me.vertices[me.loops[li].vertex_index].co.z
                t = max(0.0, min(1.0, z / H))
                v = 1.0 if glow else (0.50 + 0.50 * t ** 0.8) * jit + up
                att.data[li].color = (v, v, v, 1.0)


# --- Shared pieces ---------------------------------------------------------------------------------------------------

def R(x=0.0, y=0.0, z=0.0):
    return Euler((x, y, z)).to_matrix().to_4x4()


def T(x=0.0, y=0.0, z=0.0):
    return Matrix.Translation((x, y, z))


def interp(rings, z):
    for (z0, r0), (z1, r1) in zip(rings, rings[1:]):
        if z0 <= z <= z1 and z1 > z0:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return rings[-1][1]


# --- Sun Warden ------------------------------------------------------------------------------------------------------

def build_warden():
    B = Boss("warden", 5.4)
    B.m("stone", "#2c2a35", 0.05, 0.85)
    B.m("stone_hi", "#57536a", 0.05, 0.75)
    B.m("gold", "#d2ae55", 0.85, 0.35, "#e0a93a", 0.35)
    B.m("gold_mask", "#d2ae55", 0.85, 0.35, "#e0a93a", 0.35)
    B.m("gold_slab", "#d2ae55", 0.85, 0.35, "#e0a93a", 0.35)
    B.m("gold_fist", "#d2ae55", 0.85, 0.35, "#e0a93a", 0.35)
    B.m("gold_stones", "#d2ae55", 0.85, 0.35, "#e0a93a", 0.35)
    B.m("eyes", "#3a2a10", 0.0, 0.5, "#ffd36a", 4.0)
    B.m("sun", "#1a0e06", 0.0, 0.6, "#ffb83a", 6.0)
    B.m("corona", "#1a0e06", 0.0, 0.6, "#ffe9a8", 5.0)
    B.m("halo", "#e3b45a", 0.7, 0.4, "#ffa83a", 1.6)
    B.m("halo_rune", "#26232d", 0.1, 0.7)
    s, hi, gold = B.mat["stone"], B.mat["stone_hi"], B.mat["gold"]
    SUN = Vector((0, -0.12, 4.98))

    # core: a tapered, chiselled monolith, hovering. Its widest part is the chest.
    prof = [(1.28, 0.05), (1.55, 0.30), (2.0, 0.52), (2.5, 0.72), (2.56, 0.82), (3.2, 0.93), (3.55, 0.99),
            (3.62, 1.06), (4.0, 1.02), (4.25, 0.88), (4.42, 0.62)]
    ap = math.cos(math.pi / 8)
    core = B.part("core", (0, 0, 3.0))
    core.lathe(prof, s, sides=8, rot0=math.pi / 8, jitter=0.025)
    # stepped plinth under the chest and a pendant point below
    core.lathe([(1.28, 0.05), (1.02, 0.13), (0.78, 0.0)], gold, sides=4, rot0=math.pi / 4)
    # gold bands over the two ledges
    for z0, z1 in ((2.5, 2.6), (3.52, 3.68)):
        r0, r1 = interp(prof, z0), interp(prof, z1)
        core.lathe([(z0, r0 - 0.03), (z0, r0 + 0.035), (z1, r1 + 0.035), (z1, r1 - 0.03)], gold, sides=8, rot0=math.pi / 8)

    def inlay(d, p0, p1, w, lift=0.035, m=gold):
        """A gold line on the face looking along `d` from (t0, z0) to (t1, z1), `w` wide."""
        dv = Vector((d[0], d[1], 0))
        tv = Vector((-d[1], d[0], 0))
        (t0, z0), (t1, z1) = p0, p1
        L = math.hypot(t1 - t0, z1 - z0) or 1
        nt, nz = -(z1 - z0) / L * w / 2, (t1 - t0) / L * w / 2
        pts = []
        for (t, z) in ((t0, z0), (t1, z1)):
            for sgn in (-1, 1):
                tt, zz = t + sgn * nt, z + sgn * nz
                a = interp(prof, zz) * ap
                for off in (-0.03, lift):
                    pts.append(dv * (a + off) + tv * tt + Vector((0, 0, zz)))
        core.hull(pts, m)

    for d in ((0, -1), (0, 1), (1, 0), (-1, 0)):
        inlay(d, (0, 1.72), (0, 3.4), 0.07)
        inlay(d, (0, 3.0), (0.36, 2.6), 0.06)
        inlay(d, (0, 3.0), (-0.36, 2.6), 0.06)
        inlay(d, (0, 2.2), (0.22, 1.95), 0.05)
        inlay(d, (0, 2.2), (-0.22, 1.95), 0.05)
        inlay(d, (0.34, 3.05), (0.34, 3.42), 0.05)
        inlay(d, (-0.34, 3.05), (-0.34, 3.42), 0.05)
    # crown: a ring of stone spikes round the top, under the halo
    for k in range(8):
        a = k * math.tau / 8 + 0.2
        lean = 0.22
        xf = T(0.6 * math.cos(a), 0.6 * math.sin(a), 4.38) @ R(lean * math.sin(a), -lean * math.cos(a), 0)
        core.lathe([(0, 0.12), (0.18, 0.1), (0.42 + (k % 2) * 0.16, 0.0)], hi, sides=4, xf=xf, rot0=a)
    # a few loose chips of carved stone on the chest (cracks and wear)
    for _ in range(6):
        a = core.rng.uniform(0, math.tau)
        z = core.rng.uniform(2.0, 3.4)
        rr = interp(prof, z) * 0.97
        core.rock((rr * math.cos(a), rr * math.sin(a), z), (0.11, 0.11, 0.09), hi, n=8, rough=0.3)
    core.finish()

    # mask: a broad carved shield on the front, brow, slit eyes, nose ridge, gold teeth
    mask = B.part("mask", (0, -1.0, 3.85), "core")
    pl = [(0.8, -0.82, 4.32), (-0.8, -0.82, 4.32), (0.5, -0.82, 3.4), (-0.5, -0.82, 3.4), (0, -0.82, 3.12),
          (0.74, -1.2, 4.26), (-0.74, -1.2, 4.26), (0.44, -1.2, 3.46), (-0.44, -1.2, 3.46), (0, -1.2, 3.22)]
    mask.hull(pl, s)
    mask.chunk((1.62, 0.2, 0.16), hi, at=(0, -1.27, 4.03), bevel=0.05)
    mask.chunk((1.5, 0.05, 0.05), B.mat["gold_mask"], at=(0, -1.23, 4.3), bevel=0.015)
    for sx in (-1, 1):
        mask.chunk((0.4, 0.06, 0.08), B.mat["eyes"], xf=T(sx * 0.32, -1.225, 3.87) @ R(0, -sx * 0.32, 0), bevel=0.02)
        mask.chunk((0.22, 0.52, 0.72), hi, xf=T(sx * 0.82, -1.0, 3.8) @ R(0, 0, sx * 0.42) @ R(0, 0, 0), bevel=0.05, taper=(0.5, 0.8))
        mask.chunk((0.05, 0.05, 0.4), B.mat["gold_mask"], xf=T(sx * 0.54, -1.23, 3.62) @ R(0, sx * 0.3, 0), bevel=0.012)
    mask.chunk((0.14, 0.16, 0.62), hi, at=(0, -1.28, 3.72), taper=(0.6, 0.8), bevel=0.04)
    for x in (-0.19, -0.065, 0.065, 0.19):
        mask.chunk((0.045, 0.045, 0.2), B.mat["gold_mask"], at=(x, -1.215, 3.42), bevel=0.012)
    mask.chunk((0.09, 0.05, 0.3), B.mat["gold_mask"], at=(0, -1.225, 4.17), bevel=0.015)
    mask.finish()

    # halo: a broad notched band round the sun, tilted to face the camera, with spikes outside
    halo = B.part("halo", SUN, "core")
    tilt = T(*SUN) @ R(0.3, 0, 0)
    ring = [(0.0, 0.86), (0.07, 0.93), (0.07, 1.2), (0.0, 1.3), (-0.07, 1.2), (-0.07, 0.93)]
    halo.lathe(ring, B.mat["halo"], sides=28, xf=tilt, loop=True)
    for k in range(14):
        a = k * math.tau / 14
        xf = tilt @ T(1.07 * math.cos(a), 1.07 * math.sin(a), 0.08) @ R(0, 0, a)
        halo.chunk((0.17, 0.2, 0.07), B.mat["halo_rune"], xf=xf, bevel=0.025, taper=(0.8, 0.7))
        xs = tilt @ T(0, 0, 0) @ R(0, 0, a)
        long_ = 0.62 if k % 2 == 0 else 0.4
        halo.lathe([(0, 0.1), (0.1, 0.09), (long_, 0.0)], B.mat["halo"], sides=4,
                   xf=xs @ T(1.26, 0, 0) @ R(0, math.pi / 2, 0), rot0=math.pi / 4)
    halo.finish()

    # sun: a small faceted ball; the corona's spikes hide inside it until the game scales them out
    sun = B.part("sun", SUN, "core")
    sun.rock(tuple(SUN), (0.34, 0.34, 0.34), B.mat["sun"], n=30, rough=0.04)
    sun.finish()
    cor = B.part("corona", SUN, "sun")
    for k in range(16):
        d = Vector((math.sin(k * 2.4) * math.cos(k * 1.7), math.sin(k * 1.9), math.cos(k * 2.4)))
        d = (d if d.length > 0.1 else Vector((0, 0, 1))).normalized()
        q = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        cor.lathe([(0.08, 0.06), (0.2, 0.05), (0.31, 0.0)], B.mat["corona"], sides=4, xf=T(*SUN) @ q)
    cor.finish()

    # slabs: two stacked stone slabs for shoulders, gold-edged; they can break away
    for name, sg in (("slabL", 1), ("slabR", -1)):
        pv = Vector((sg * 0.85, 0, 3.75))
        P = B.part(name, pv, "core")
        xf = T(*pv) @ R(0, -0.28 * sg, 0) @ T(sg * 0.65, 0, 0.2)
        P.chunk((1.2, 0.64, 1.45), s, xf=xf, bevel=0.1, taper=(0.9, 0.9))
        P.chunk((1.4, 0.8, 0.26), hi, xf=xf @ T(0, 0, 0.82), bevel=0.07)
        P.chunk((1.0, 0.05, 0.07), B.mat["gold_slab"], xf=xf @ T(0, -0.335, 0.55), bevel=0.015)
        for x in (-0.3, 0, 0.3):
            P.chunk((0.06, 0.05, 0.62), B.mat["gold_slab"], xf=xf @ T(x, -0.335, -0.1), bevel=0.015)
        P.chunk((0.06, 0.05, 0.5), B.mat["gold_slab"], xf=xf @ T(0.62 * sg, -0.335, 0.0), bevel=0.015)
        P.chunk((0.5, 0.45, 0.45), s, xf=T(*pv) @ R(0, 0, 0) @ T(0, 0, -0.05), bevel=0.08)
        P.finish()

    # fists: huge, free of the body, knuckles forward, wrist broken to a point behind
    for name, sg in (("fistL", 1), ("fistR", -1)):
        pv = Vector((sg * 2.5, -0.35, 2.5))
        P = B.part(name, pv)
        xf = T(*pv) @ R(0, 0, -sg * 0.25) @ Matrix.Scale(1.35, 4)
        gf = B.mat["gold_fist"]
        P.chunk((1.1, 1.05, 0.98), s, xf=xf, bevel=0.14, taper=(1.0, 0.95))
        for i, x in enumerate((-0.4, -0.13, 0.13, 0.4)):
            P.chunk((0.27, 0.6, 0.3), hi, xf=xf @ T(x, -0.6, 0.27), bevel=0.06)
            P.chunk((0.25, 0.4, 0.3), s, xf=xf @ T(x, -0.46, -0.27), bevel=0.06)
            P.chunk((0.22, 0.09, 0.07), gf, xf=xf @ T(x, -0.93, 0.34), bevel=0.02)
        P.chunk((0.55, 0.3, 0.26), hi, xf=xf @ T(-sg * 0.46, -0.52, 0.0) @ R(0, 0, -sg * 0.5), bevel=0.06)
        wr = xf @ T(0, 0.5, 0) @ R(-math.pi / 2, 0, 0)
        P.lathe([(0, 0.52), (0.5, 0.42), (0.95, 0.0)], s, sides=6, xf=wr, rot0=0.2)
        P.lathe([(0.06, 0.6), (0.06, 0.65), (0.2, 0.65), (0.2, 0.6)], gf, sides=6, xf=wr, rot0=0.2)
        P.lathe([(0.34, 0.5), (0.34, 0.55), (0.46, 0.5), (0.46, 0.46)], gf, sides=6, xf=wr, rot0=0.2)
        P.finish()

    # stones: a ring of small floating stones round the base
    st = B.part("stones", (0, 0, 0.85))
    r = st.rng
    for k in range(14):
        a = k * math.tau / 14 + r.uniform(-0.12, 0.12)
        rad = r.uniform(1.55, 2.05)
        z = 0.85 + r.uniform(-0.28, 0.32)
        sz = r.uniform(0.17, 0.4)
        m_ = hi if k % 3 == 0 else s
        st.rock((rad * math.cos(a), rad * math.sin(a), z), (sz, sz * r.uniform(0.7, 1.1), sz * r.uniform(0.8, 1.3)), m_, n=12, rough=0.3,
                rot=Euler((r.uniform(0, 3), r.uniform(0, 3), r.uniform(0, 3))).to_matrix())
        if k % 4 == 1:
            st.chunk((sz * 0.7, sz * 0.7, 0.05), B.mat["gold_stones"], xf=T(rad * math.cos(a), rad * math.sin(a), z + sz * 0.95) @ R(0, 0, a), bevel=0.015)
    st.finish()
    return B


# --- Ash ---------------------------------------------------------------------------------------------------------------

def _limb_xf(p0, p1):
    d = (Vector(p1) - Vector(p0)).normalized()
    return T(*p0) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()


def limb(part, p0, p1, r0, r1, m, sides=6, belly=1.12, jitter=0.04):
    """A faceted column from p0 to p1, fatter in the middle."""
    L = (Vector(p1) - Vector(p0)).length
    part.lathe([(0, r0), (L * 0.5, (r0 + r1) / 2 * belly), (L, r1)], m, sides=sides, xf=_limb_xf(p0, p1), rot0=0.3, jitter=jitter)


def limb_plates(part, p0, p1, r0, r1, rows, count, thick, m, seam, gap=0.16, skew=0.0):
    """Armour plates round a column, in rows, with gaps; some get a glowing crack."""
    L = (Vector(p1) - Vector(p0)).length
    base = _limb_xf(p0, p1)
    r = part.rng
    for row in range(rows):
        z0, z1 = L * (row + 0.05) / rows, L * (row + 0.95) / rows
        zc = (z0 + z1) / 2
        rad = r0 + (r1 - r0) * zc / L
        for k in range(count):
            ang = (k + 0.5 + row * 0.5 + skew) * math.tau / count
            arc = rad * math.tau / count * (1 - gap)
            ln = (z1 - z0) * (1 - gap) * r.uniform(0.9, 1.0)
            # local x tangent, y axis, z radial
            t = Vector((-math.sin(ang), math.cos(ang), 0))
            rv = Vector((math.cos(ang), math.sin(ang), 0))
            M = Matrix((t, Vector((0, 0, 1)), rv)).transposed().to_4x4()
            xf = base @ T(*(rv * (rad + thick * 0.35))) @ T(0, 0, zc) @ M
            th = thick * r.uniform(0.8, 1.2)
            part.chunk((arc, ln, th), m, xf=xf, bevel=0.08, taper=(0.72, 0.7))
            if r.random() < 0.4:
                a = r.uniform(-0.4, 0.4)
                part.chunk((0.035, ln * 0.8, 0.03), seam, xf=xf @ T(0, 0, th / 2 + 0.01) @ R(0, 0, a), bevel=0.008)


def ellipsoid_tiles(a, b, c, nlat, nlon, thick, gap, rng):
    """Cells of an ellipsoid (local frame): centre, normal, tangents and half sizes."""
    out = []
    for i in range(nlat):
        th = (i + 0.5) / nlat * math.pi
        n = max(3, round(nlon * math.sin(th)))
        for j in range(n):
            ph = (j + 0.5 + (i % 2) * 0.5) / n * math.tau
            p = Vector((a * math.sin(th) * math.cos(ph), b * math.sin(th) * math.sin(ph), c * math.cos(th)))
            nm = Vector((p.x / a ** 2, p.y / b ** 2, p.z / c ** 2)).normalized()
            dph = Vector((-a * math.sin(th) * math.sin(ph), b * math.sin(th) * math.cos(ph), 0))
            dth = Vector((a * math.cos(th) * math.cos(ph), b * math.cos(th) * math.sin(ph), -c * math.sin(th)))
            wph = dph.length * (math.tau / n) / 2 * (1 - gap)
            wth = dth.length * (math.pi / nlat) / 2 * (1 - gap)
            out.append({"p": p, "n": nm, "u": dph.normalized(), "v": dth.normalized(), "w": wph, "h": wth, "t": thick * rng.uniform(0.8, 1.25)})
    return out


def emit_tile(part, tile, xf, m, seam, rng):
    p, n, u, v, w, h, th = (tile[k] for k in ("p", "n", "u", "v", "w", "h", "t"))
    pts = []
    for k in range(6):
        ang = k * math.tau / 6 + 0.3
        cu, cv = math.cos(ang), math.sin(ang)
        pts.append(p + n * -0.12 + u * (cu * w) + v * (cv * h))
        pts.append(p + n * (th + rng.uniform(-0.05, 0.06)) + u * (cu * w * 0.66) + v * (cv * h * 0.66))
    part.hull(pts, m, xf)
    if rng.random() < 0.45:
        a = rng.uniform(0, math.pi)
        d = u * math.cos(a) + v * math.sin(a)
        ln = min(w, h) * 0.85
        e = n * (th + 0.015)
        sq = n.cross(d).normalized() * 0.018
        part.hull([p + e + d * ln + sq, p + e + d * ln - sq, p + e - d * ln + sq, p + e - d * ln - sq,
                   p + e + n * 0.03 + d * ln * 0.9, p + e + n * 0.03 - d * ln * 0.9], seam, xf)


def build_ash():
    B = Boss("ash", 5.8)
    bas, hi, seam = B.m("basalt", "#2d2825", 0.1, 0.9), B.m("basalt_hi", "#51463f", 0.1, 0.8), B.m("seam", "#3a1208", 0.0, 0.6, "#ff6a1f", 1.8)
    core_m = B.m("core", "#3a1208", 0.0, 0.5, "#ffb347", 5.0)
    eye = B.m("eye", "#3a1208", 0.0, 0.5, "#ffd27a", 6.0)
    rng = random.Random(11)
    hip = Vector((0, 0.55, 2.05))
    TF = T(*hip) @ R(0.35, 0, 0)
    a_, b_, c_ = 1.4, 1.2, 1.95
    cen = Vector((0, 0, c_))

    # torso: its origin is at the hips; the cells that never fall away are part of it
    tiles = ellipsoid_tiles(a_, b_, c_, 6, 12, 0.34, 0.2, rng)
    for t in tiles:
        t["p"] = t["p"] + cen
    groups = {"plateA": [], "plateB": [], "plateC": [], "plateD": [], "plateE": [], None: []}

    def region(t):
        n = t["n"]
        if n.y < -0.3 and abs(n.x) <= 0.5 and -0.55 < n.z <= 0.1:
            return "plateE"
        if n.z <= 0.1:
            return None
        if n.y < -0.3:
            return "plateA" if n.x > 0.2 else ("plateB" if n.x < -0.2 else None)
        if n.y > 0.3:
            return "plateC" if n.x > 0 else "plateD"
        return None
    for t in tiles:
        groups[region(t)].append(t)
    torso = B.part("torso", hip)
    for t in groups[None]:
        emit_tile(torso, t, TF, bas if rng.random() < 0.7 else hi, seam, rng)
    # hips: a heavy block, and a ridge of tall plates down the back
    torso.rock(tuple(TF @ Vector((0, 0.1, 0.35))), (1.0, 0.85, 0.55), bas, n=16, rough=0.15)
    for k, zl in enumerate((1.4, 2.0, 2.6, 3.1, 3.55)):
        yl = b_ * math.sqrt(max(0.0, 1 - ((zl - c_) / c_) ** 2)) + 0.05
        sz = 0.55 + 0.12 * (k % 2)
        torso.chunk((0.32, 0.16, sz), hi, xf=TF @ T(0, yl, zl) @ R(-0.45, 0, 0), bevel=0.04, taper=(0.4, 0.8))
    torso.finish()
    for nm in ("plateA", "plateB", "plateC", "plateD", "plateE"):
        ts = groups[nm]
        if not ts:
            continue
        cw = sum(((TF @ t["p"]) for t in ts), Vector()) / len(ts)
        P = B.part(nm, cw, "torso")
        for t in ts:
            emit_tile(P, t, TF, bas if rng.random() < 0.7 else hi, seam, rng)
        P.finish()
    core = B.part("core", TF @ cen, "torso")
    core.rock(tuple(TF @ cen), (a_ - 0.12, b_ - 0.12, c_ - 0.12), core_m, n=64, rough=0.0, rot=TF.to_3x3())
    core.finish()

    # head: small and sunk between the shoulders, brow low, two ember slits, tusks
    hd = Vector((0, -1.55, 4.8))
    head = B.part("head", hd, "torso")
    head.rock(tuple(hd), (0.52, 0.55, 0.45), bas, n=16, rough=0.12)
    head.chunk((0.95, 0.3, 0.2), hi, at=(0, hd.y - 0.42, hd.z + 0.1), bevel=0.05, taper=(0.9, 0.8))
    for sx in (-1, 1):
        head.chunk((0.3, 0.06, 0.07), eye, xf=T(sx * 0.2, hd.y - 0.5, hd.z - 0.02) @ R(0, -sx * 0.25, 0), bevel=0.015)
        head.lathe([(0, 0.09), (0.3, 0.0)], hi, sides=4, xf=T(sx * 0.3, hd.y - 0.35, hd.z - 0.25) @ R(-0.5, 0, 0))
    head.chunk((0.55, 0.3, 0.2), bas, at=(0, hd.y - 0.3, hd.z - 0.32), bevel=0.04)
    head.finish()

    # arms: shoulder, a plated upper arm, a huge plated forearm over a glowing core, a boulder fist on the floor
    for sg, sn in ((1, "L"), (-1, "R")):
        S = Vector((sg * 1.65, -0.9, 4.55))
        E = Vector((sg * 2.05, -1.5, 3.0))
        Wr = Vector((sg * 2.1, -2.2, 1.6))
        arm = B.part("arm" + sn, S, "torso")
        arm.rock(tuple(S), (0.85, 0.85, 0.8), bas, n=16, rough=0.1)
        arm.chunk((1.5, 1.1, 0.5), hi, xf=T(sg * 1.85, -0.9, 5.05) @ R(0, -sg * 0.35, 0), bevel=0.09, taper=(0.8, 0.8))
        arm.chunk((1.1, 0.8, 0.35), bas, xf=T(sg * 1.95, -0.95, 5.4) @ R(0, -sg * 0.5, 0), bevel=0.07, taper=(0.7, 0.7))
        limb(arm, S, E, 0.75, 0.68, seam, sides=7)
        limb_plates(arm, S, E, 0.74, 0.68, 2, 5, 0.3, bas, seam, gap=0.2)
        arm.finish()
        fo = B.part("fore" + sn, E, "arm" + sn)
        fo.rock(tuple(E), (0.78, 0.78, 0.7), bas, n=14, rough=0.1)
        limb(fo, E, Wr, 0.8, 1.05, seam, sides=7, belly=1.05)
        limb_plates(fo, E, Wr, 0.82, 1.07, 2, 6, 0.4, bas, seam, gap=0.18)
        fo.finish()
        FC = Vector((sg * 2.1, -2.35, 0.82))
        fist = B.part("fist" + sn, Wr, "fore" + sn)
        fist.rock(tuple(FC), (0.82, 0.85, 0.8), bas, n=18, rough=0.14)
        for x in (-0.45, -0.15, 0.15, 0.45):
            fist.chunk((0.3, 0.45, 0.4), hi, xf=T(FC.x + x, FC.y - 0.62, FC.z - 0.1) @ R(0.2, 0, 0), bevel=0.07, taper=(0.9, 0.7))
        fist.chunk((0.5, 0.4, 0.12), seam, at=(FC.x, FC.y - 0.2, FC.z + 0.78), bevel=0.03)
        for x in (-0.3, 0.3):
            fist.chunk((0.05, 0.55, 0.03), seam, xf=T(FC.x + x, FC.y - 0.15, FC.z + 0.82) @ R(0, 0, x), bevel=0.01)
        fist.finish()

    # legs: short, thick and bent, behind him
    for sg, sn in ((1, "L"), (-1, "R")):
        H = Vector((sg * 0.85, 0.6, 2.15))
        K = Vector((sg * 1.1, -0.1, 1.15))
        An = Vector((sg * 1.1, 0.3, 0.4))
        leg = B.part("leg" + sn, H, "torso")
        limb(leg, H, K, 0.8, 0.65, seam, sides=7)
        limb_plates(leg, H, K, 0.8, 0.66, 1, 5, 0.3, bas, seam, gap=0.2)
        limb(leg, K, An, 0.62, 0.72, seam, sides=7)
        limb_plates(leg, K, An, 0.62, 0.72, 1, 5, 0.3, hi, seam, gap=0.2)
        leg.rock(tuple(K), (0.62, 0.62, 0.55), bas, n=12, rough=0.1)
        leg.chunk((1.1, 1.5, 0.45), bas, at=(sg * 1.1, -0.15, 0.25), bevel=0.09, taper=(0.8, 0.75))
        for x in (-0.3, 0, 0.3):
            leg.chunk((0.26, 0.4, 0.28), hi, at=(sg * 1.1 + x, -0.85, 0.2), bevel=0.05, taper=(0.9, 0.7))
        leg.finish()
    return B


# --- Ember -------------------------------------------------------------------------------------------------------------

def tatters(part, B, count, ztop, length, rtop, flare, width, cloth, edge, seed, bow=0.0):
    """Hanging strips of burnt cloth: each a few stacked slices that narrow to a ragged point, the last one glowing."""
    r = random.Random(seed)
    for i in range(count):
        ang = (i + r.uniform(-0.3, 0.3)) * math.tau / count
        z0 = r.uniform(*ztop)
        ln = r.uniform(*length)
        w0 = r.uniform(*width)
        rv = Vector((math.cos(ang), math.sin(ang), 0))
        tv = Vector((-math.sin(ang), math.cos(ang), 0))
        wob = r.uniform(-0.12, 0.12)
        pts = []
        for j in range(4):
            f = j / 3
            rad = rtop(z0 - ln * f) + flare * f ** 1.3 + bow * math.sin(f * 3.1)
            c = rv * rad + Vector((0, 0, z0 - ln * f)) + tv * wob * f
            w = max(0.02, w0 * (1 - f) ** 0.7)
            pts.append((c, w))
        for j in range(3):
            (ca, wa), (cb, wb) = pts[j], pts[j + 1]
            hp = []
            for c, w in ((ca, wa), (cb, wb)):
                for sx in (-1, 1):
                    for sr in (-0.012, 0.012):
                        hp.append(c + tv * (sx * w / 2) + rv * sr)
            part.hull(hp, edge if j == 2 else cloth)


def build_ember():
    B = Boss("ember", 4.0)
    cloth = B.m("cloth", "#2b211e", 0.0, 0.95)
    cloth_hi = B.m("cloth_hi", "#4a3a34", 0.0, 0.9)
    inner = B.m("inner", "#070404", 0.0, 1.0)
    edge = B.m("edge", "#3a0d0a", 0.0, 0.8, "#ff5a1a", 2.4)
    corem = B.m("core", "#fff1d0", 0.0, 0.4, "#fff4dc", 9.0)
    flame = B.m("flame", "#ff9a2a", 0.0, 0.5, "#ff7a1f", 4.0)
    iron = B.m("iron", "#2c2522", 0.7, 0.6)
    lamp = {"L": B.m("lanternL", "#3a1208", 0.0, 0.5, "#ffb347", 6.0), "R": B.m("lanternR", "#3a1208", 0.0, 0.5, "#ffb347", 6.0)}

    # mantle: a slim bell of charred cloth, hung with torn strips whose tips still burn
    prof = [(0.95, 0.52), (1.5, 0.6), (2.1, 0.58), (2.65, 0.52), (2.95, 0.36)]
    man = B.part("mantle", (0, 0, 3.0))
    man.lathe(prof, cloth, sides=10, rot0=0.2, jitter=0.07)
    # shoulder cape: short wide tatters, then long ragged ones to the hem
    tatters(man, B, 11, (2.55, 2.75), (0.55, 0.9), lambda z: interp(prof, z) + 0.04, 0.5, (0.34, 0.46), cloth_hi, edge, 3)
    tatters(man, B, 15, (1.9, 2.5), (0.9, 1.5), lambda z: interp(prof, z) + 0.03, 0.30, (0.22, 0.34), cloth, edge, 5, bow=0.05)
    tatters(man, B, 13, (1.5, 2.0), (0.8, 1.2), lambda z: interp(prof, z) + 0.06, 0.45, (0.2, 0.3), cloth, edge, 9, bow=0.08)
    man.finish()

    # hood: an empty cowl, peaked at the back and open at the front, with nothing in it
    ring = [(2.45, 0.22), (2.65, 0.36), (2.95, 0.5), (3.25, 0.58), (3.38, 0.6), (3.38, 0.52), (3.25, 0.5), (2.95, 0.42), (2.65, 0.28), (2.45, 0.14)]
    hood = B.part("hood", (0, 0, 2.9))

    def shape(a, ri):
        frac = max(0.0, (ring[ri][0] - 2.45) / 0.93)
        sn = math.sin(a)
        return frac * (0.7 * max(0.0, sn) ** 1.4 - 0.32 * max(0.0, -sn))
    mats = [cloth, cloth, cloth, cloth, cloth, inner, inner, inner, inner, inner]
    hood.lathe(ring, mats, sides=12, rot0=0.1, jitter=0.05, loop=True, zshape=shape)
    for k in range(9):
        a = math.pi * (0.1 + 0.8 * k / 8) + hood.rng.uniform(-0.1, 0.1)
        zt = 3.38 + shape(a, 4)
        rr = 0.58
        hood.lathe([(0, 0.1), (0.2 + hood.rng.uniform(0, 0.35), 0.0)], cloth_hi, sides=3,
                   xf=T(rr * math.cos(a), rr * math.sin(a), zt) @ R(math.sin(a) * 0.3, -math.cos(a) * 0.3, 0))
    hood.finish()

    # core: the flame, white-hot at the heart, rising out of the hood, with orange licks round it
    core = B.part("core", (0, 0, 2.85))
    core.lathe([(2.35, 0.0), (2.5, 0.25), (2.8, 0.4), (3.2, 0.38), (3.55, 0.26), (3.85, 0.12), (4.1, 0.0)], corem, sides=8, jitter=0.1)
    for k in range(9):
        a = k * math.tau / 9 + 0.2
        ln = 0.95 + 0.55 * (k % 3) / 2
        core.lathe([(0, 0.17), (ln * 0.5, 0.12), (ln, 0.0)], flame, sides=4,
                   xf=T(0.3 * math.cos(a), 0.3 * math.sin(a), 3.05) @ R(math.sin(a) * 0.5, -math.cos(a) * 0.5, 0), rot0=a)
    core.finish()

    # lanterns: a small iron cage round a glowing gem, on a short chain; they orbit
    for sg, sn in ((1, "L"), (-1, "R")):
        c = Vector((sg * 1.05, 0, 2.1))
        la = B.part("lantern" + sn, c)
        la.rock(tuple(c), (0.14, 0.14, 0.15), lamp[sn], n=14, rough=0.05)
        for dx in (-1, 1):
            for dy in (-1, 1):
                la.chunk((0.05, 0.05, 0.4), iron, at=(c.x + dx * 0.15, c.y + dy * 0.15, c.z), bevel=0.012)
        la.lathe([(0, 0.24), (0.14, 0.05)], iron, sides=4, xf=T(c.x, c.y, c.z + 0.2), rot0=math.pi / 4)
        la.lathe([(0, 0.24), (-0.14, 0.04)], iron, sides=4, xf=T(c.x, c.y, c.z - 0.2), rot0=math.pi / 4)
        la.chunk((0.025, 0.025, 0.45), iron, at=(c.x, c.y, c.z + 0.55), bevel=0.008)
        la.finish()
    return B


# --- Export, checks, sheets -----------------------------------------------------------------------------------------

BUILD = {"warden": build_warden, "ash": build_ash, "ember": build_ember}


def clear(name=None):
    for c in [c for c in bpy.data.collections if c.name.startswith("Boss " + (name or ""))]:
        for o in list(c.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(c)
    for kind in ("meshes", "materials", "images", "cameras", "lights"):
        coll = getattr(bpy.data, kind)
        for d in [d for d in coll if d.users == 0]:
            coll.remove(d)


def build(name):
    clear(name)
    return BUILD[name]()


def triangles(coll):
    n = 0
    for o in coll.all_objects:
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            n += len(o.data.loop_triangles)
    return n


def _export(path, **kw):
    import re
    while True:
        try:
            return bpy.ops.export_scene.gltf(filepath=path, **kw)
        except TypeError as e:  # an option this Blender version doesn't have
            m = re.search(r'"(\w+)"', str(e))
            if not m or m.group(1) not in kw:
                raise
            kw.pop(m.group(1))


def glb_nodes(path):
    import json
    import struct
    with open(path, "rb") as f:
        f.read(12)
        ln, _ = struct.unpack("<II", f.read(8))
        j = json.loads(f.read(ln))
    nodes = j["nodes"]

    def tree(i):
        n = nodes[i]
        return {n.get("name", "?"): [tree(c) for c in n.get("children", [])]} if n.get("children") else n.get("name", "?")
    return {"tree": [tree(i) for i in j["scenes"][0]["nodes"]], "materials": [m.get("name") for m in j.get("materials", [])],
            "ext": j.get("extensionsUsed"), "attrs": sorted({k for m in j["meshes"] for p in m["primitives"] for k in p["attributes"]}),
            "alpha": [m.get("name") for m in j.get("materials", []) if m.get("alphaMode", "OPAQUE") != "OPAQUE"]}


def export(name, keep=False):
    B = build(name)
    path = os.path.join(OUT, f"{name}.glb")
    os.makedirs(OUT, exist_ok=True)
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    objs = list(B.coll.all_objects)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    _export(path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
            export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
            export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
            export_vertex_color="ACTIVE", export_all_vertex_colors=False)
    res = {"boss": name, "triangles": triangles(B.coll), "kb": round(os.path.getsize(path) / 1024), "path": path}
    if not keep:
        clear(name)
    return res


def _studio(name, aim_z):
    """Dark floor, warm key light, cool rim, soft sky; EEVEE."""
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 960, 720
    sc.render.film_transparent = False
    try:
        sc.eevee.taa_render_samples = 24
    except Exception:
        pass
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("Boss world")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.045, 0.04, 0.06, 1)
    bg.inputs["Strength"].default_value = 1.0
    sc.world = w
    mf = material(f"{name}_floor", "#1d1b22", 0.0, 0.9)
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=14, fill_type="NGON", location=(0, 0, 0))
    fl = bpy.context.object
    fl.name = "Boss floor"
    fl.data.materials.append(mf)
    for nm, loc, e, col, en in (("key", (-6, -9, 12), (0.9, 0, -0.5), (1.0, 0.86, 0.7), 4.0), ("rim", (7, 8, 9), (1.0, 0, 2.4), (0.6, 0.7, 1.0), 3.0),
                                ("fill", (7, -9, 6), (1.2, 0, 0.6), (0.9, 0.9, 1.0), 1.2)):
        d = bpy.data.lights.new("Boss " + nm, "SUN")
        d.energy = en
        d.color = col
        d.angle = 0.25
        o = bpy.data.objects.new("Boss " + nm, d)
        o.rotation_euler = e
        o.location = loc
        bpy.context.scene.collection.objects.link(o)
    return fl


def _hero(x):
    """A 1.8 m hero for scale: a real hero model if it imports, else a capsule."""
    before = set(bpy.data.objects)
    try:
        bpy.ops.import_scene.gltf(filepath=HERO)
        new = [o for o in bpy.data.objects if o not in before]
        zs = []
        for o in new:
            if o.type == "MESH":
                zs += [(o.matrix_world @ Vector(c)).z for c in o.bound_box]
        h = max(zs) - min(zs)
        for o in new:
            if o.parent is None:
                o.scale = o.scale * (1.8 / h)
                o.location.x += x
        bpy.context.view_layer.update()
        return new
    except Exception:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.28, depth=1.5, location=(x, 0, 0.75))
        c = bpy.context.object
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22, location=(x, 0, 1.58))
        return [c, bpy.context.object]


def _cam(name, loc, target, lens=50):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.clip_end = 200
    o = bpy.data.objects.new(name, cam)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def sheet(name, aim_z=2.7):
    """docs/bosses/<name>_sheet.jpg: from the front (left) and from the game's camera (right), a 1.8 m hero beside it."""
    import numpy as np
    bpy.app.driver_namespace["boss_keep"] = {o.name for o in bpy.data.objects}
    B = build(name)
    _studio(name, aim_z)
    hero = _hero(-3.6)
    sc = bpy.context.scene
    views = {}
    # front: level, a long lens
    views["front"] = _cam("Boss cam front", (0, -26, aim_z), (-0.6, 0, aim_z), 70)
    # game: 55 degrees down, 22 m away, aimed at the middle of the fight
    d = 22.0
    tgt = Vector((-1.2, 0, 2.2))
    views["game"] = _cam("Boss cam game", tgt + Vector((0, -d * math.cos(math.radians(55)), d * math.sin(math.radians(55)))), tgt, 46)
    imgs = []
    for k, cam in views.items():
        sc.camera = cam
        p = os.path.join(bpy.app.tempdir, f"{name}_{k}.png")
        sc.render.filepath = p
        sc.render.image_settings.file_format = "PNG"
        bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(p)
        a = np.empty(len(im.pixels), dtype=np.float32)
        im.pixels.foreach_get(a)
        imgs.append(a.reshape(im.size[1], im.size[0], 4))
        bpy.data.images.remove(im)
    both = np.concatenate(imgs, axis=1)
    out = bpy.data.images.new("sheet", both.shape[1], both.shape[0])
    out.pixels.foreach_set(both.ravel())
    os.makedirs(DOCS, exist_ok=True)
    path = os.path.join(DOCS, f"{name}_sheet.jpg")
    out.filepath_raw = path
    out.file_format = "JPEG"
    out.save()
    bpy.data.images.remove(out)
    return {"sheet": path, "front": os.path.join(bpy.app.tempdir, f"{name}_front.png"), "game": os.path.join(bpy.app.tempdir, f"{name}_game.png")}


def cleanup_scene():
    """After a sheet: remove the studio, the hero and the boss."""
    clear()
    keep = bpy.app.driver_namespace.get("boss_keep", set())
    for o in [o for o in bpy.data.objects if o.name not in keep]:
        bpy.data.objects.remove(o, do_unlink=True)
    for kind in ("meshes", "materials", "images", "cameras", "lights", "worlds", "armatures", "actions"):
        coll = getattr(bpy.data, kind)
        for d in [d for d in coll if d.users == 0]:
            coll.remove(d)
