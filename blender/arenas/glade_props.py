"""
Verdant Glade cover props, in the heroes' sculpted-and-painted style (see blender/heroes/sculpt.py): two broken giant
stumps with flaring roots, two carved standing stones on mossy plinths, two giant mushroom clusters on moss hummocks,
a great fallen log for the middle and two fallen trunks with an upturned root plate for the wings. Bark and roots are
sculpted shapes melted into one surface (`sculpt.fuse`) with grooves pressed in; broken ends are flat cuts of pale
wood with splinters; stones are chiselled, with carved runes glowing faintly (a separate emissive material, kept
thin); moss is a separate material draped over the upward faces. Each prop is built in its own collection at the
origin (its base centre), fitted to its height, painted (ambient occlusion, edge light, height gradient) and
exported together to public/models/arenas/glade_props.glb as objects named "<Prop>__<material>" for
src/arenas/glade.ts to place.

Sizes match the collision capsules in src/arenas/glade.ts (GLADE_OBSTACLES): the stumps cover a pillar of r 1.0
(root collar), the stones one of r 0.6 (plinth), the mushroom clusters one of r 0.7 (hummock); the log modules are
as long as their walls with the capsule ends (LOG_L) and about 1.0 m deep (the capsule is 0.8). LogA stays under
1.6 m (it lies across the middle, where the gameplay camera looks over it).

Run inside Blender (through the MCP server), one or two props per call (a fuse takes a while), then export:

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\arenas")
    import glade_props; importlib.reload(glade_props)
    glade_props.build("StumpA")    # ... see PROPS
    glade_props.export()           # builds what is missing, writes the GLB, returns triangles per prop
    glade_props.clear()

Blender coordinates: metres, z up. In three.js (y up) the model's -Y becomes +Z.
"""
import importlib
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for p in (os.path.join(os.path.dirname(HERE), "heroes"), r"C:\projectG\xianxia\blender"):
    if p not in sys.path:
        sys.path.insert(0, p)

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector, noise  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

import dao_blender as dao  # noqa: E402
import kit  # noqa: E402
import sculpt  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "models", "arenas", "glade_props.glb")

BARK = "#4a3a2a"
WOOD = "#a48660"
MOSS = "#4f7a2a"
STONE = "#6e7068"
RUNE = "#7affd0"
STEM = "#ddd2b6"
CAP = "#a4482a"

#: The log modules' lengths along x (wall segment + 2 x 0.4 m ends); src/arenas/glade.ts stretches them to fit.
LOG_L = {"LogA": 4.68, "LogB": 3.8, "LogC": 3.8}


class Props:
    def __init__(self):
        self.mats = {}

    def mat(self, part, color, **kw):
        if part not in self.mats:
            self.mats[part] = kit.material(f"glade_props_{part}", color, **kw)
        return self.mats[part]

    def bark(self):
        return self.mat("bark", BARK, roughness=0.92)

    def wood(self):
        return self.mat("wood", WOOD, roughness=0.85)

    def moss(self):
        return self.mat("moss", MOSS, roughness=1.0, sheen=0.3)

    def stone(self):
        return self.mat("stone", STONE, roughness=0.86)

    def rune(self):
        return self.mat("rune", RUNE, emission="#3affb4", strength=2.0)

    def stem(self):
        return self.mat("stem", STEM, roughness=0.7)

    def cap(self):
        return self.mat("cap", CAP, roughness=0.55)


# ---- shape helpers -----------------------------------------------------------------------------------------------

def _cut_below(ob, z=-0.06):
    """Drops everything under the floor (hidden anyway): fewer triangles."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1), clear_inner=True)
    bm.to_mesh(ob.data)
    bm.free()


def _rough(ob, amp, scale, seed, up=1.0):
    """Pushes vertices along their normals by fractal noise; `up` scales it on top faces."""
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for v in ob.data.vertices:
        n = v.normal
        k = amp * (1 + (up - 1) * max(0.0, n.z))
        d = noise.fractal(v.co * scale + off, 0.6, 2.1, 4)
        v.co += n * d * k


def _grooves(ob, n, amp, seed, axis="z", c=(0.0, 0.0)):
    """Presses bark grooves into a fused surface: narrow wavy furrows running along `axis` ("z" for a standing
    trunk, "x" for a log round the line y = c[0], z = c[1]), only on the faces that look sideways from that axis."""
    for v in ob.data.vertices:
        nr = v.normal
        if axis == "z":
            a, along, side = math.atan2(v.co.y - c[1], v.co.x - c[0]), v.co.z, math.hypot(nr.x, nr.y)
        else:
            a, along, side = math.atan2(v.co.z - c[1], v.co.y - c[0]), v.co.x, math.hypot(nr.y, nr.z)
        ph = 1.4 * noise.noise(Vector((along * 0.8, seed, a * 0.5))) + 0.5 * math.sin(along * 1.3 + seed)
        g = math.cos(n * a + ph)
        d = amp * (0.3 * g - max(0.0, g) ** 10)
        v.co += nr * d * side


def _cut(bm, co, nrm, planes=None):
    """Cuts a closed bmesh with a plane (drops the side `nrm` points to) and closes the cut with a face; the plane
    is remembered in `planes` (to find the cut faces later)."""
    nrm = Vector(nrm).normalized()
    co = Vector(co)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=nrm, clear_outer=True, dist=0.0001)
    d = co.dot(nrm)
    cut = [e for e in bm.edges if e.is_boundary and all(abs(v.co.dot(nrm) - d) < 1e-3 for v in e.verts)]
    if cut:
        bmesh.ops.holes_fill(bm, edges=cut, sides=0)
    if planes is not None:
        planes.append((nrm, d))


def _chisel(ob, rnd, n, keep=0.0, depth=(0.84, 0.94), squash=(1.0, 1.0), el=(-0.15, 1.2)):
    """Cuts `n` flat facets off a sculpted rock (planes from random sides and above), so it reads as broken stone
    instead of a pillow. The cuts stay `keep` m from the centre at floor level (`squash` scales that along x, y)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    for _ in range(n):
        az, e = rnd.random() * 2 * math.pi, el[0] + rnd.random() * (el[1] - el[0])
        nrm = Vector((math.cos(az) * math.cos(e), math.sin(az) * math.cos(e), math.sin(e)))
        top = max(v.co.dot(nrm) for v in bm.verts)
        k = keep * math.hypot(squash[0] * math.cos(az), squash[1] * math.sin(az))
        d = max(k * max(0.0, math.cos(e)), top * (depth[0] + rnd.random() * (depth[1] - depth[0])))
        if d >= top - 0.01:
            continue
        _cut(bm, nrm * d, nrm)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def _break(ob, cuts, wood, name):
    """Snaps `ob` off with plane cuts [(point, normal)] and returns the flat broken faces as a separate object of
    `wood` (pale split wood)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    planes = []
    for co, nrm in cuts:
        _cut(bm, co, nrm, planes)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    on = [f for f in bm.faces if any(all(abs(v.co.dot(n) - d) < 2e-3 for v in f.verts) for n, d in planes)]
    out = bmesh.new()
    vm = {}
    for f in on:
        vs = []
        for v in f.verts:
            if v not in vm:
                vm[v] = out.verts.new(v.co.copy())
            vs.append(vm[v])
        try:
            out.faces.new(vs)
        except ValueError:
            pass
    bmesh.ops.delete(bm, geom=on, context="FACES_ONLY")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    # the floor stays open (it was only closed for the cuts)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.98 and all(v.co.z < -0.04 for v in f.verts)], context="FACES_ONLY")
    bm.to_mesh(ob.data)
    bm.free()
    return kit.mesh_object(name, out, wood, smooth=False)


def _shard(name, base, w, d, h, lean, tilt, mat, rnd, n=6):
    """A splinter or chip: the convex hull of points round a tapering block `w` x `d` x `h` (base sunk 0.1 m), its
    tip off-centre, leaning toward angle `lean` by `tilt` radians."""
    bm = bmesh.new()
    pts = []
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.6
        pts.append((math.cos(a) * w / 2 * (0.75 + rnd.random() * 0.25), math.sin(a) * d / 2 * (0.75 + rnd.random() * 0.25), -0.1))
    for k in range(n - 2):
        a = k * 2 * math.pi / (n - 2) + rnd.random() * 0.8
        s = 0.5 + rnd.random() * 0.3
        pts.append((math.cos(a) * w / 2 * s, math.sin(a) * d / 2 * s, h * (0.4 + rnd.random() * 0.3)))
    pts.append(((rnd.random() - 0.5) * w * 0.4, (rnd.random() - 0.5) * d * 0.3, h))
    verts = [bm.verts.new(p) for p in pts]
    res = bmesh.ops.convex_hull(bm, input=verts)
    loose = {g for g in res["geom_interior"] + res["geom_unused"] if isinstance(g, bmesh.types.BMVert)}
    bmesh.ops.delete(bm, geom=list(loose), context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = kit.mesh_object(name, bm, mat, smooth=False)
    axis = Vector((-math.sin(lean), math.cos(lean), 0))
    ob.data.transform(Matrix.Translation(Vector(base)) @ Matrix.Rotation(tilt, 4, axis) @ Matrix.Rotation(lean, 4, "Z"))
    return ob


def _tree_of(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    t = BVHTree.FromBMesh(bm)
    bm.free()
    return t


def _drape(src, name, mat, rnd, up=0.45, thresh=-0.15, thick=0.045, scale=1.8, where=None):
    """Moss draped over the upward faces of `src` (patchy by noise): a copy of those faces lifted along the normals,
    its edges tucked back onto the surface. `where(co)` limits it to a region."""
    bm = bmesh.new()
    bm.from_mesh(src.data)
    bm.normal_update()
    off = Vector((rnd.random() * 50, rnd.random() * 50, rnd.random() * 50))
    sel = []
    for f in bm.faces:
        c = f.calc_center_median()
        if f.normal.z > up and noise.noise(c * scale + off) > thresh and (where is None or where(c)):
            sel.append(f)
    out = bmesh.new()
    vm, nrm = {}, {}
    for f in sel:
        vs = []
        for v in f.verts:
            if v not in vm:
                nv = out.verts.new(v.co.copy())
                vm[v], nrm[nv] = nv, v.normal.copy()
            vs.append(vm[v])
        try:
            out.faces.new(vs)
        except ValueError:
            pass
    bm.free()
    # drop specks (islands of a few faces)
    out.verts.ensure_lookup_table()
    seen, small = set(), []
    for v in out.verts:
        if v in seen:
            continue
        stack, comp = [v], []
        seen.add(v)
        while stack:
            a = stack.pop()
            comp.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b not in seen:
                    seen.add(b)
                    stack.append(b)
        if len(comp) < 10:
            small += comp
    for v in out.verts:
        if v in small:
            continue
        lump = 0.6 + 0.8 * (0.5 + 0.5 * noise.noise(v.co * 7 + off))
        v.co += nrm[v] * (0.006 if v.is_boundary else thick * lump)
    bmesh.ops.delete(out, geom=small, context="VERTS")
    return kit.mesh_object(name, out, mat)


def _carve(name, tree, mat, strokes, frame, r=0.02, step=0.05):
    """Carved runes glowing faintly: polylines in a face's (u, v) plane, dropped onto the surface along the face
    normal (half sunk). `frame` = (origin, u, v, n): the rays come from origin + n * 3 along -n."""
    o, u, vv, n = (Vector(x) for x in frame)
    out = []
    for i, line in enumerate(strokes):
        pts = []
        for (a0, b0), (a1, b1) in zip(line, line[1:]):
            seg = max(1, int(math.hypot(a1 - a0, b1 - b0) / step))
            for k in range(seg + (1 if (a1, b1) == line[-1] else 0)):
                t = k / seg
                a, b = a0 + (a1 - a0) * t, b0 + (b1 - b0) * t
                loc, hn, _, _ = tree.ray_cast(o + u * a + vv * b + n * 3, -n, 6)
                if loc is not None:
                    pts.append(loc - hn * r * 0.3)
        if len(pts) >= 2:
            out.append(kit.chain(f"{name}{i}", pts, [r * (0.6 if k in (0, len(pts) - 1) else 1.0) for k in range(len(pts))],
                                 mat, seg=4, smooth=False))
    return out


GLYPHS = [
    [[(0, -1), (0, 1)], [(0, 0.6), (0.55, 0.15), (0, -0.3)], [(0, 0.05), (-0.5, -0.55)]],
    [[(-0.45, -1), (-0.45, 1)], [(0.45, -1), (0.45, 1)], [(-0.45, 0.55), (0.45, -0.15)]],
    [[(0, -1), (0, 1)], [(-0.6, 0.35), (0, 1), (0.6, 0.35)], [(-0.4, -0.45), (0.4, -0.45)]],
    [[(-0.5, -1), (0.5, 1)], [(0.5, -1), (-0.5, 1)], [(-0.55, 0), (0.55, 0)]],
    [[(0, 1), (0, -1)], [(0, -1), (0.55, -0.4)], [(0, 0.2), (-0.5, 0.75)]],
]


def _glyph(gi, cx, cz, s, ring=False):
    """Strokes of glyph `gi` scaled `s` round (cx, cz); `ring` adds a carved circle round it."""
    out = [[(cx + a * s, cz + b * s) for a, b in line] for line in GLYPHS[gi]]
    if ring:
        out.append([(cx + math.cos(k * math.pi / 12) * s * 1.45, cz + math.sin(k * math.pi / 12) * s * 1.45) for k in range(25)])
    return out


# ---- the props ---------------------------------------------------------------------------------------------------

def stump(P, coll, seed=3, H=3.5, cuts=(), fork=False):
    """A broken giant trunk with a flared, lobed foot and seven roots running out over the ground (root collar
    r ~1.1, roots to ~1.7 m), deep bark grooves, a top snapped off along `cuts` (pale wood with splinters), moss on
    the roots and the broken top. `fork`: a split top with a second, lower lobe."""
    bark, wood, moss = P.bark(), P.wood(), P.moss()
    rnd = random.Random(seed)
    ph = rnd.random() * 6.28
    prof = [(1.0, -0.2), (0.95, 0.0), (0.84, 0.3), (0.72, 0.7), (0.66, 1.3), (0.63, 2.0), (0.61, 2.8), (0.6, H + 0.6)]
    trunk = kit.lathe("Trunk", prof, bark, seg=48)
    for v in trunk.data.vertices:
        th = math.atan2(v.co.y, v.co.x)
        low = max(0.0, 1 - v.co.z / 1.1) ** 2
        k = 1 + 0.05 * math.sin(7 * th + ph) + 0.03 * math.sin(11 * th + ph * 1.7) + 0.3 * low * (0.3 + 0.7 * (0.5 + 0.5 * math.cos(6 * th + ph)))
        v.co.x *= k
        v.co.y *= k
        v.co.x += 0.04 * math.sin(v.co.z * 0.9 + ph)
    parts = [trunk]
    for k in range(7):
        a = ph + k * 2 * math.pi / 7 + (rnd.random() - 0.5) * 0.4
        b = a + (rnd.random() - 0.5) * 0.5
        L = 1.45 + rnd.random() * 0.3
        pts = [(math.cos(a) * 0.35, math.sin(a) * 0.35, 1.0 + rnd.random() * 0.2), (math.cos(a) * 0.85, math.sin(a) * 0.85, 0.5),
               (math.cos(b) * 1.2, math.sin(b) * 1.2, 0.22), (math.cos(b) * L, math.sin(b) * L, 0.02), (math.cos(b) * (L + 0.2), math.sin(b) * (L + 0.2), -0.12)]
        r0 = 0.26 + rnd.random() * 0.06
        parts.append(kit.chain(f"Root{k}", pts, [r0, r0 * 0.85, r0 * 0.55, r0 * 0.35, r0 * 0.2], bark, seg=10))
    if fork:
        parts.append(kit.chain("Fork", [(0.1, 0.0, H - 1.0), (0.35, 0.15, H - 0.2), (0.55, 0.25, H + 0.4)], [0.42, 0.36, 0.32], bark, seg=16))
    ob = sculpt.fuse(parts, "StumpBark", voxel=0.04, smooth=6, target=6200)
    _cut_below(ob)
    _grooves(ob, 15, 0.075, seed)
    _rough(ob, 0.02, 2.5, seed)
    top = _break(ob, cuts, wood, "StumpTop")
    out = [ob, top]
    # splinters standing round the broken rim (dropped onto the broken face)
    tree = _tree_of(top)
    for k in range(11):
        a = ph + k * 2 * math.pi / 11 + rnd.random() * 0.4
        rr = 0.36 + rnd.random() * 0.16
        x, y = math.cos(a) * rr, math.sin(a) * rr
        loc, _, _, _ = tree.ray_cast(Vector((x, y, H + 3)), Vector((0, 0, -1)), 6)
        if loc is None:
            continue
        out.append(_shard(f"Splinter{k}", (x, y, loc.z), 0.2 + rnd.random() * 0.1, 0.1, 0.3 + rnd.random() * 0.6,
                          a, 0.08 + rnd.random() * 0.2, wood if k % 3 else bark, rnd))
    out.append(_drape(ob, "StumpMoss", moss, rnd, up=0.4, thresh=-0.2, where=lambda c: c.z < 1.4 or c.z > H - 1.0))
    out.append(_drape(top, "TopMoss", moss, rnd, up=0.5, thresh=0.15, thick=0.035, where=lambda c: c.xy.length > 0.3))
    return out


def standing(P, coll, seed=5, runes=((0, 3), (1, 2)), lean=0.08):
    """A carved standing stone, about 2.5 m: a chiselled slab (1.25 x 0.9 m at its foot) leaning a little, on a
    chiselled plinth of r ~0.8 with a fallen chip, runes carved on both wide faces (one ringed), moss on the top
    and the plinth."""
    stone, moss, rune = P.stone(), P.moss(), P.rune()
    rnd = random.Random(seed)
    body = sculpt.fuse([
        kit.blob("B0", (0, 0, 0.9), (0.66, 0.46, 1.2), stone, segs=(24, 14)),
        kit.blob("B1", (0.04, 0, 1.75), (0.56, 0.4, 0.9), stone, segs=(20, 12)),
        kit.blob("B2", (0, 0, 0.25), (0.7, 0.5, 0.45), stone, segs=(20, 10)),
    ], "StoneBody", voxel=0.03, smooth=6, target=2600)
    _cut_below(body)
    _rough(body, 0.03, 1.6, seed)
    _chisel(body, rnd, 24, keep=0.6, squash=(1.0, 0.72), depth=(0.85, 0.95), el=(-0.1, 0.7))
    # a slanted broken top
    bm = bmesh.new()
    bm.from_mesh(body.data)
    a = rnd.random() * 6.28
    _cut(bm, (0, 0, 2.45), (math.cos(a) * 0.35, math.sin(a) * 0.2, 1))
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(body.data)
    bm.free()
    body.data.transform(Matrix.Rotation(lean, 4, "Y"))
    plinth = sculpt.fuse([kit.blob("P0", (0, 0, 0), (0.86, 0.74, 0.3), stone, segs=(20, 10))] +
                         [kit.blob(f"P{k}", (math.cos(k * 2.1 + seed) * 0.55, math.sin(k * 2.1 + seed) * 0.5, 0), (0.38, 0.32, 0.24), stone, segs=(14, 8))
                          for k in range(3)], "StonePlinth", voxel=0.03, smooth=6, target=900)
    _cut_below(plinth)
    _chisel(plinth, rnd, 10, keep=0.82, el=(0.2, 1.3))
    chip = sculpt.fuse([kit.blob("C0", (0.95, -0.55, 0.05), (0.24, 0.2, 0.18), stone, segs=(12, 8))], "StoneChip", voxel=0.03, smooth=4, target=200)
    _cut_below(chip)
    _chisel(chip, rnd, 5)
    out = [body, plinth, chip]
    tree = _tree_of(body)
    front = ((0, 0, 0), (1, 0, 0), (0, 0, 1), (0, -1, 0))
    back = ((0, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 1, 0))
    (g0, g1), (g2, g3) = runes
    out += _carve("RuneF", tree, rune, _glyph(g0, 0.02, 1.5, 0.2, ring=True) + _glyph(g1, 0.0, 0.85, 0.12), front)
    out += _carve("RuneB", tree, rune, _glyph(g2, -0.02, 1.55, 0.15) + _glyph(g3, 0.0, 1.05, 0.15), back)
    out.append(_drape(body, "StoneMoss", moss, rnd, up=0.5, thresh=-0.35, thick=0.04))
    out.append(_drape(plinth, "PlinthMoss", moss, rnd, up=0.35, thresh=-0.1, thick=0.04))
    return out


def _mushroom(name, base, h, R, lean, flat, P, rnd, spots=6):
    """A mushroom: a curved stem (a bulb at the foot) from `base`, `h` tall, leaning toward angle `lean`, under a
    cap of radius `R` (`flat` 0..1 flattens the dome), pale gills beneath and pale spots on top."""
    stem, cap = P.stem(), P.cap()
    bx, by, bz = base
    dx, dy = math.cos(lean[0]) * lean[1], math.sin(lean[0]) * lean[1]
    top = Vector((bx + dx * h, by + dy * h, bz + h))
    pts = [(bx, by, bz - 0.12), (bx + dx * h * 0.2, by + dy * h * 0.2, bz + h * 0.3), (bx + dx * h * 0.6, by + dy * h * 0.6, bz + h * 0.7), tuple(top)]
    sr = R * 0.2
    out = [kit.chain(f"{name}Stem", pts, [sr * 1.9, sr * 1.25, sr * 1.05, sr], stem, seg=12)]
    k = (1 - flat * 0.55) * R
    prof = [(0.001, 0.05), (R * 0.88, 0.0), (R, 0.04), (R * 0.97, 0.16 * k), (R * 0.8, 0.36 * k), (R * 0.5, 0.52 * k), (0.001, 0.58 * k)]
    c = kit.lathe(f"{name}Cap", prof, cap, seg=28)
    gills = kit.lathe(f"{name}Gills", [(R * 0.86, 0.008), (sr * 0.8, 0.045)], stem, seg=28, cap=(False, False))
    bm = bmesh.new()
    bm.from_mesh(gills.data)
    bm.normal_update()
    if sum(f.normal.z for f in bm.faces) > 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(gills.data)
    bm.free()
    tilt = Vector((dx, dy, 1)).normalized()
    m = Matrix.Translation(top + Vector((0, 0, -0.02))) @ Vector((0, 0, 1)).rotation_difference(tilt).to_matrix().to_4x4()
    c.data.transform(m)
    gills.data.transform(m)
    out += [c, gills]
    tree = _tree_of(c)
    for s in range(spots):
        a = rnd.random() * 6.28
        d = R * (0.15 + rnd.random() * 0.6)
        loc, hn, _, _ = tree.ray_cast(Vector((top.x + math.cos(a) * d, top.y + math.sin(a) * d, top.z + 3)), Vector((0, 0, -1)), 6)
        if loc is None:
            continue
        sz = R * (0.07 + rnd.random() * 0.06)
        sp = kit.blob(f"{name}Spot{s}", (0, 0, 0), (sz, sz * 0.85, sz * 0.3), stem, segs=(8, 5))
        sp.data.transform(Matrix.Translation(loc) @ Vector((0, 0, 1)).rotation_difference(hn).to_matrix().to_4x4())
        out.append(sp)
    return out


def shrooms(P, coll, seed=7, tall=True):
    """A giant mushroom cluster on a moss hummock (r ~0.85): `tall` one big dome-capped mushroom among four smaller
    ones; otherwise a spread of flatter, leaning caps."""
    moss = P.moss()
    rnd = random.Random(seed)
    hum = sculpt.fuse([kit.blob("H0", (0, 0, 0), (0.86, 0.8, 0.34), moss, segs=(20, 10))] +
                      [kit.blob(f"H{k}", (math.cos(k * 1.7 + seed) * 0.5, math.sin(k * 1.7 + seed) * 0.5, 0), (0.42, 0.36, 0.26), moss, segs=(14, 8))
                       for k in range(4)], "Hummock", voxel=0.03, smooth=6, target=1400)
    _cut_below(hum)
    _rough(hum, 0.05, 3.0, seed)
    out = [hum]
    tree = _tree_of(hum)
    if tall:
        spec = [((0.05, 0.0), 1.05, 0.56, (0.3, 0.05), 0.0), ((-0.45, 0.32), 0.68, 0.34, (2.5, 0.28), 0.15),
                ((0.48, -0.32), 0.5, 0.28, (5.6, 0.35), 0.2), ((-0.2, -0.52), 0.32, 0.18, (4.4, 0.4), 0.3),
                ((0.5, 0.42), 0.24, 0.14, (0.9, 0.5), 0.3)]
    else:
        spec = [((-0.1, 0.1), 0.92, 0.5, (2.0, 0.2), 0.5), ((0.42, -0.2), 0.75, 0.42, (5.5, 0.32), 0.6),
                ((-0.35, -0.42), 0.48, 0.3, (4.1, 0.4), 0.55), ((0.35, 0.5), 0.36, 0.22, (1.0, 0.45), 0.6),
                ((-0.6, 0.15), 0.22, 0.13, (3.0, 0.5), 0.5), ((0.62, 0.12), 0.18, 0.11, (0.0, 0.5), 0.4)]
    for i, ((x, y), h, R, lean, flat) in enumerate(spec):
        loc, _, _, _ = tree.ray_cast(Vector((x, y, 3)), Vector((0, 0, -1)), 6)
        z = loc.z - 0.05 if loc is not None else 0.0
        out += _mushroom(f"M{i}", (x, y, z), h, R, lean, flat, P, rnd, spots=7 if R > 0.3 else 3)
    return out


def _log_body(name, bark, rnd, L, R, seed, cz=None, x0=0.0, extra=(), target=4200):
    """A fallen trunk along x, `L` long round x = `x0`, radius ~`R`, resting on the ground (a slight bend, bulges,
    two branch stubs), melted into one surface with `extra` parts (closed meshes), with lengthwise grooves."""
    half = L / 2
    cz = R * 0.92 if cz is None else cz
    n = 9
    pts, radii = [], []
    for k in range(n):
        t = k / (n - 1)
        x = -half - 0.15 + (L + 0.3) * t
        pts.append((x0 + x, 0.06 * math.sin(t * 3.0 + seed), cz + 0.03 * math.sin(t * 5 + seed)))
        radii.append(R * (1.05 - 0.12 * t + 0.05 * math.sin(t * 9 + seed)))
    parts = [kit.chain(f"{name}Body", pts, radii, bark, seg=28)]
    for k, (t, a) in enumerate([(0.3 + rnd.random() * 0.1, 1.1), (0.68 + rnd.random() * 0.1, -0.6)]):
        x = x0 - half + L * t
        d = Vector((0.25, math.cos(a), math.sin(a))).normalized()
        p0 = Vector((x, 0, cz))
        parts.append(kit.chain(f"{name}Stub{k}", [p0, p0 + d * (R + 0.2), p0 + d * (R + 0.42)], [R * 0.32, R * 0.26, R * 0.22], bark, seg=10))
    ob = sculpt.fuse(parts + list(extra), name, voxel=0.035, smooth=6, target=target)
    _cut_below(ob)
    _grooves(ob, 16, 0.035, seed, axis="x", c=(0.0, cz))
    _rough(ob, 0.015, 3.0, seed)
    return ob


def log(P, coll, name="LogA", seed=11, plate=0):
    """A fallen trunk LOG_L[name] long (x), about 1 m thick, ends snapped off (pale wood, splinters), moss along
    its top, bracket fungi on the flanks. `plate` = +1 / -1: an upturned root plate (earth and roots, ~1.9 m) at
    that end instead of a broken one."""
    bark, wood, moss, stem = P.bark(), P.wood(), P.moss(), P.stem()
    rnd = random.Random(seed)
    L = LOG_L[name]
    half = L / 2
    R = 0.48 if not plate else 0.44
    cz = R * 0.92
    ends = [(-1, 0.0), (1, 0.0)] if not plate else [(-plate, 0.0)]
    cuts = []
    for s, _ in ends:
        a = rnd.random() * 0.5 - 0.25
        x = s * (half - 0.08)
        cuts.append(((x, 0, cz), (s, a, 0.25 * (rnd.random() - 0.5))))
        cuts.append(((x - s * 0.18, 0, cz + R * 0.3), (s * 0.6, rnd.random() - 0.5, 1)))
    if plate:
        # a root plate: the trunk ends in a flared foot that has torn a disc of earth and roots out of the ground
        px = plate * (half - 0.32)
        disc = [kit.blob("Earth", (px, 0, 0.92), (0.22, 0.9, 0.92), bark, segs=(20, 12))]
        for k in range(5):
            a = k * 2 * math.pi / 5 + rnd.random() * 0.4
            disc.append(kit.blob(f"Clod{k}", (px + plate * 0.05, math.cos(a) * 0.62, 0.92 + math.sin(a) * 0.62), (0.26, 0.3, 0.3), bark, segs=(12, 8)))
        for k in range(9):
            a = k * 2 * math.pi / 9 + rnd.random() * 0.3
            r1 = 0.95 + rnd.random() * 0.25
            p0 = Vector((px, math.cos(a) * 0.5, 0.92 + math.sin(a) * 0.5))
            p1 = Vector((px + plate * 0.08, math.cos(a) * r1, 0.92 + math.sin(a) * r1 * 0.95))
            p2 = Vector((px + plate * (0.2 + rnd.random() * 0.15), math.cos(a + 0.2) * (r1 + 0.18), 0.92 + math.sin(a + 0.2) * (r1 + 0.1)))
            if p2.z < 0.05:
                p2.z = 0.05
            disc.append(kit.chain(f"PRoot{k}", [p0, p1, p2], [0.11, 0.07, 0.035], bark, seg=8))
        body = _log_body(f"{name}Bark", bark, rnd, L - 0.5, R, seed, cz, x0=-plate * 0.25, extra=disc, target=6000)
    else:
        body = _log_body(f"{name}Bark", bark, rnd, L, R, seed, cz)
    wood_ob = _break(body, cuts, wood, f"{name}Ends")
    out = [body, wood_ob]
    tree = _tree_of(body)
    for k, (s, _) in enumerate(ends):
        x = s * (half - 0.12)
        for j in range(4):
            a = rnd.random() * 6.28
            y, z = math.cos(a) * R * 0.75, cz + math.sin(a) * R * 0.75
            out.append(_shard(f"Spl{k}{j}", (x - s * 0.2, y, z), 0.12, 0.07, 0.2 + rnd.random() * 0.2, 0.0 if s > 0 else math.pi,
                              0.8 + (rnd.random() - 0.5) * 0.4, wood, rnd))
    # bracket fungi on the flanks
    for k in range(5):
        x = -half + 0.5 + (L - 1.0) * rnd.random()
        side = 1 if k % 2 else -1
        z = cz + (rnd.random() - 0.3) * R * 0.6
        loc, hn, _, _ = tree.ray_cast(Vector((x, side * 3, z)), Vector((0, -side, 0)), 6)
        if loc is None:
            continue
        for j in range(2 if k % 2 else 3):
            w = 0.16 - j * 0.04
            br = kit.blob(f"Bracket{k}{j}", (0, w * 0.55, 0), (w, w * 0.75, 0.035), stem, segs=(12, 6))
            m = Matrix.Translation(loc + Vector((0.06 * j, 0, -0.1 * j))) @ Matrix.Rotation(math.atan2(hn.y, hn.x) - math.pi / 2, 4, "Z")
            br.data.transform(m)
            out.append(br)
    out.append(_drape(body, f"{name}Moss", moss, rnd, up=0.45, thresh=-0.25, thick=0.05))
    return out


PROPS = {
    "StumpA": (stump, 3.6, {"seed": 3, "H": 3.6, "cuts": [((0, 0, 3.3), (0.45, 0.2, 1)), ((0.2, -0.1, 3.0), (-0.9, 0.3, 1))]}),
    "StumpB": (stump, 3.6, {"seed": 13, "H": 3.0, "fork": True, "cuts": [((0, 0, 2.75), (-0.6, -0.3, 1)), ((0.5, 0.2, 3.6), (0.3, 0.5, 1))]}),
    "StoneA": (standing, 2.5, {"seed": 5, "runes": ((0, 3), (1, 2)), "lean": 0.08}),
    "StoneB": (standing, 2.5, {"seed": 19, "runes": ((2, 4), (3, 0)), "lean": -0.06}),
    "ShroomA": (shrooms, 1.45, {"seed": 7, "tall": True}),
    "ShroomB": (shrooms, 1.45, {"seed": 29, "tall": False}),
    "LogA": (log, 1.1, {"name": "LogA", "seed": 11}),
    "LogB": (log, 1.9, {"name": "LogB", "seed": 23, "plate": 1}),
    "LogC": (log, 1.9, {"name": "LogC", "seed": 31, "plate": -1}),
}

TINTS = {"bark": {"shadow": (0.7, 0.58, 0.5)}, "wood": {"shadow": (0.75, 0.6, 0.45)}, "moss": {"shadow": (0.55, 0.7, 0.45)},
         "stone": {"shadow": (0.6, 0.68, 0.66)}, "stem": {"shadow": (0.75, 0.65, 0.55)}, "cap": {"shadow": (0.7, 0.45, 0.4)},
         "leaf": {"shadow": (0.45, 0.62, 0.5)}, "fern": {"shadow": (0.5, 0.65, 0.45)}}

#: Normals sharper than this stay faceted (chiselled stone and split wood crisp, bark and moss soft).
SHARP = {"leaf": 70, "fern": 80, "stone": 28, "wood": 30, "rune": 40, "bark": 50, "moss": 60, "stem": 50, "cap": 60}


def _tidy(ob, sharp):
    """Welds seams and dissolves flat areas: fewer triangles, no seam lines."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.6), verts=bm.verts, edges=bm.edges)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.set_sharp_from_angle(angle=math.radians(sharp))


def _merge(name, parts):
    """Joins a prop's parts by material: objects named "<Prop>__<material>"."""
    by = {}
    for ob in parts:
        by.setdefault(ob.data.materials[0].name, []).append(ob)
    out = []
    for mname, obs in by.items():
        short = mname.replace("glade_props_", "")
        ob = kit.join(f"{name}__{short}", obs) if len(obs) > 1 else obs[0]
        ob.name = f"{name}__{short}"
        _tidy(ob, SHARP.get(short, 40))
        out.append(ob)
    return out


def _fit(objs, height):
    """Scales the prop along z to exactly `height` (the obstacle's height in src/arenas/glade.ts)."""
    top = max((ob.matrix_world @ v.co).z for ob in objs for v in ob.data.vertices)
    for ob in objs:
        ob.data.transform(Matrix.Diagonal((1, 1, height / top, 1)))
    return top


def footprint(coll, below=0.3):
    """The smallest radius the prop reaches at its foot (below `below` m) over 36 directions, and its height."""
    pts = [v.co for o in coll.objects if o.type == "MESH" for v in o.data.vertices if v.co.z < below]
    reach = []
    for k in range(36):
        d = Vector((math.cos(k * math.pi / 18), math.sin(k * math.pi / 18), 0))
        reach.append(max((p.x * d.x + p.y * d.y) for p in pts))
    top = max(v.co.z for o in coll.objects if o.type == "MESH" for v in o.data.vertices)
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    return {"min_reach": round(min(reach), 2), "x": (round(min(xs), 2), round(max(xs), 2)), "y": (round(min(ys), 2), round(max(ys), 2)), "height": round(top, 3)}


def build(name):
    """Builds one prop into the collection "Glade <name>" (emptied first). Returns its stats."""
    importlib.reload(sculpt)
    dao.setup_scene()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    fn, height, kw = PROPS[name]
    kit.clear(f"Glade {name}")
    coll = kit.collection(f"Glade {name}")
    objs = _merge(name, fn(Props(), coll, **kw))
    raw = _fit(objs, height)
    sculpt.paint(coll, height=height, ao_dist=0.25, tints=TINTS)
    st = kit.stats(coll)
    st.update(footprint(coll))
    st["raw_height"] = round(raw, 3)
    return st


def export():
    colls = []
    for name in PROPS:
        c = bpy.data.collections.get(f"Glade {name}")
        if c is None or not c.objects:
            build(name)
            c = bpy.data.collections[f"Glade {name}"]
        colls.append(c)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    objs = [o for c in colls for o in c.objects]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    dao._export(
        OUT, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
        export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    )
    tris = {c.name: kit.stats(c)["triangles"] for c in colls}
    return {"triangles": tris, "kb": round(os.path.getsize(OUT) / 1024), "path": OUT}


def clear():
    """Deletes the prop collections (after exporting: keep the shared scene light)."""
    for name in PROPS:
        kit.clear(f"Glade {name}")
    kit.purge()


# ---- the backdrop: forest trees, bushes, rocks, ferns and rim stones outside the ring ------------------------------
# Exported to public/models/arenas/glade_backdrop.glb and scattered (seeded) by src/arenas/glade.ts. Cheaper than the
# cover (coarser voxels, smaller triangle targets): it is seen from 12 m and further.
#
#     glade_props.build_back("TreeA")   # ... see BACKDROP
#     glade_props.export_back()
#     glade_props.clear_back()

BACK_OUT = os.path.join(os.path.dirname(OUT), "glade_backdrop.glb")
LEAF = "#3c6428"
FERN = "#4c7c30"


def _leaf(P):
    return P.mat("leaf", LEAF, roughness=0.95, sheen=0.4)


def _fern_mat(P):
    return P.mat("fern", FERN, roughness=0.9, double_sided=True)


def _crown(name, P, rnd, centre, R, H, n=7, target=900, seed=1):
    """A foliage mass: lumpy clumps melted into one canopy `R` wide and `H` tall round `centre`."""
    cx, cy, cz = centre
    parts = [kit.blob(f"{name}C", (cx, cy, cz), (R * 0.7, R * 0.7, H * 0.45), _leaf(P), segs=(16, 10))]
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.6
        d = R * (0.45 + rnd.random() * 0.25)
        r = R * (0.38 + rnd.random() * 0.15)
        parts.append(kit.blob(f"{name}{k}", (cx + math.cos(a) * d, cy + math.sin(a) * d, cz + (rnd.random() - 0.4) * H * 0.4),
                              (r, r * 0.9, r * 0.75), _leaf(P), segs=(12, 8)))
    for k in range(3):
        a = rnd.random() * 6.28
        r = R * (0.3 + rnd.random() * 0.1)
        parts.append(kit.blob(f"{name}T{k}", (cx + math.cos(a) * R * 0.25, cy + math.sin(a) * R * 0.25, cz + H * 0.32),
                              (r, r, r * 0.8), _leaf(P), segs=(12, 8)))
    ob = sculpt.fuse(parts, name, voxel=max(0.04, R * 0.05), smooth=4, target=target)
    _rough(ob, R * 0.08, 1.8 / R, seed)
    return ob


def tree(P, coll, seed=1, H=16.0, crowns=((0, 0, 1.0),), dead=False):
    """A tall forest tree: a fluted trunk with a root flare and three or four big branches (melted into one), under
    one or two foliage masses (`crowns`: (dx, dy, size) as fractions of the default). `dead`: a broken, bare snag
    with moss on it."""
    bark, moss = P.bark(), P.moss()
    rnd = random.Random(seed)
    ph = rnd.random() * 6.28
    top = H * (0.62 if dead else 0.72)
    prof = [(1.6, -0.3), (1.35, 0.0), (1.05, 0.6), (0.85, 1.6), (0.75, top * 0.4), (0.62, top * 0.75), (0.45, top)]
    trunk = kit.lathe("TTrunk", prof, bark, seg=14)
    for v in trunk.data.vertices:
        th = math.atan2(v.co.y, v.co.x)
        low = max(0.0, 1 - v.co.z / 1.4) ** 2
        k = 1 + 0.06 * math.sin(6 * th + ph) + 0.35 * low * (0.5 + 0.5 * math.cos(5 * th + ph))
        v.co.x = v.co.x * k + 0.25 * math.sin(v.co.z * 0.25 + ph)
        v.co.y *= k
    parts = [trunk]
    for k in range(4):
        a = ph + k * 2 * math.pi / 4 + rnd.random() * 0.6
        z0 = top * ((0.3 + rnd.random() * 0.35) if dead else (0.55 + rnd.random() * 0.3))
        ln = H * (0.18 + rnd.random() * 0.08)
        p0 = Vector((0.25 * math.sin(z0 * 0.25 + ph), 0, z0))
        d = Vector((math.cos(a), math.sin(a), 0.9 + rnd.random() * 0.4)).normalized()
        parts.append(kit.chain(f"TBr{k}", [p0, p0 + d * ln * 0.55, p0 + d * ln + Vector((0, 0, ln * 0.15))], [0.38, 0.25, 0.12], bark, seg=8))
    ob = sculpt.fuse(parts, "TreeBark", voxel=0.09, smooth=4, target=1100 if dead else 900)
    _cut_below(ob)
    _grooves(ob, 9, 0.06, seed)
    out = [ob]
    if dead:
        out.append(_break(ob, [((0, 0, top - 0.3), (0.5, 0.2, 1))], P.wood(), "SnagTop"))
        out.append(_drape(ob, "SnagMoss", moss, rnd, up=0.3, thresh=-0.1, thick=0.06, scale=0.8))
    else:
        R = H * 0.3
        for i, (dx, dy, s) in enumerate(crowns):
            out.append(_crown(f"Crown{i}", P, rnd, (dx * R, dy * R, top + R * 0.05 * s), R * s, R * 1.2 * s, n=9, target=int(1300 * s), seed=seed + i))
        out.append(_drape(ob, "TreeMoss", moss, rnd, up=0.35, thresh=-0.05, thick=0.05, scale=1.0, where=lambda c: c.z < 1.5))
    return out


def bush(P, coll, seed=2, R=1.0):
    """A low, lumpy bush about `R` wide."""
    rnd = random.Random(seed)
    ob = _crown("Bush", P, rnd, (0, 0, R * 0.38), R, R * 0.9, n=5, target=320, seed=seed)
    _cut_below(ob, 0.0)
    return [ob]


def fern(P, coll, seed=3, n=8, L=0.75):
    """A fern: `n` arching fronds `L` long with serrated (zigzag) edges, double-sided."""
    rnd = random.Random(seed)
    mat = _fern_mat(P)
    out = []
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.5
        ln = L * (0.75 + rnd.random() * 0.4)
        rise = 0.55 + rnd.random() * 0.3
        pts = []
        for j in range(11):
            t = j / 10
            pts.append((math.cos(a) * ln * t, math.sin(a) * ln * t, ln * rise * math.sin(t * math.pi * 0.85) * (1 - 0.35 * t)))

        def width(t, ln=ln):
            return ln * 0.22 * math.sin(math.pi * min(1.0, 0.1 + t)) * (1.0 if round(t * 10) % 2 == 0 else 0.5)
        out.append(kit.ribbon(f"Frond{k}", pts, width, mat, normal=(0, 0, 1)))
    return out


def rock(P, coll, seed=4, R=1.0, H=0.7, target=420, moss_amt=-0.1):
    """A chiselled mossy rock `R` wide and `H` tall."""
    stone, moss = P.stone(), P.moss()
    rnd = random.Random(seed)
    parts = [kit.blob("R0", (0, 0, H * 0.3), (R * 0.7, R * 0.6, H * 0.75), stone, segs=(14, 9))]
    for k in range(3):
        a = k * 2.1 + rnd.random()
        parts.append(kit.blob(f"R{k + 1}", (math.cos(a) * R * 0.4, math.sin(a) * R * 0.35, H * 0.15), (R * 0.45, R * 0.4, H * 0.55), stone, segs=(12, 8)))
    ob = sculpt.fuse(parts, "Rock", voxel=max(0.025, R * 0.04), smooth=5, target=target)
    _cut_below(ob)
    _rough(ob, R * 0.04, 1.6 / R, seed)
    _chisel(ob, rnd, 9, keep=R * 0.5)
    return [ob, _drape(ob, "RockMoss", moss, rnd, up=0.5, thresh=moss_amt, thick=0.03 * R, scale=2.0 / R)]


BACKDROP = {
    "TreeA": (tree, 16.0, {"seed": 41, "H": 16.0, "crowns": ((0, 0, 1.0),)}),
    "TreeB": (tree, 18.0, {"seed": 43, "H": 18.0, "crowns": ((0.15, 0.1, 0.85), (-0.2, -0.15, 0.7))}),
    "TreeC": (tree, 9.0, {"seed": 47, "H": 14.0, "dead": True}),
    "BushA": (bush, 1.0, {"seed": 51, "R": 1.0}),
    "BushB": (bush, 0.8, {"seed": 53, "R": 0.85}),
    "FernA": (fern, 0.55, {"seed": 61, "n": 8, "L": 0.75}),
    "FernB": (fern, 0.45, {"seed": 67, "n": 6, "L": 0.6}),
    "RockA": (rock, 0.7, {"seed": 71, "R": 1.0, "H": 0.7}),
    "RockB": (rock, 0.5, {"seed": 73, "R": 0.8, "H": 0.5, "target": 320}),
    "RimA": (rock, 0.32, {"seed": 81, "R": 0.5, "H": 0.32, "target": 130, "moss_amt": -0.4}),
    "RimB": (rock, 0.26, {"seed": 83, "R": 0.45, "H": 0.26, "target": 110, "moss_amt": -0.2}),
}


def build_back(name):
    """Builds one backdrop prop into the collection "GladeBack <name>" (emptied first). Returns its stats."""
    importlib.reload(sculpt)
    dao.setup_scene()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    fn, height, kw = BACKDROP[name]
    kit.clear(f"GladeBack {name}")
    coll = kit.collection(f"GladeBack {name}")
    objs = _merge(name, fn(Props(), coll, **kw))
    raw = max((ob.matrix_world @ v.co).z for ob in objs for v in ob.data.vertices)
    sculpt.paint(coll, height=max(height, raw), ao_dist=0.25 if raw < 3 else 0.8, tints=TINTS)
    st = kit.stats(coll)
    st["height"] = round(raw, 3)
    return st


def export_back():
    colls = []
    for name in BACKDROP:
        c = bpy.data.collections.get(f"GladeBack {name}")
        if c is None or not c.objects:
            build_back(name)
            c = bpy.data.collections[f"GladeBack {name}"]
        colls.append(c)
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    objs = [o for c in colls for o in c.objects]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    dao._export(
        BACK_OUT, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
        export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    )
    tris = {c.name: kit.stats(c)["triangles"] for c in colls}
    return {"triangles": tris, "kb": round(os.path.getsize(BACK_OUT) / 1024), "path": BACK_OUT}


def clear_back():
    """Deletes the backdrop collections."""
    for name in BACKDROP:
        kit.clear(f"GladeBack {name}")
    kit.purge()
