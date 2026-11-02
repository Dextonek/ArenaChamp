"""
Ember Caldera cover props, in the heroes' sculpted-and-painted style (see blender/heroes/sculpt.py): two obsidian
ridges (a low one for the middle, a tall bladed one for the wings) and two basalt column clusters (a tall one and a
low one of snapped stumps). Glossy obsidian is faceted (convex hulls of scattered points), basalt columns are
chiselled hexagonal prisms with joints and worn, snapped tops, and both stand in a sculpted mound of cooled lava
crust (blobs melted into one surface with `sculpt.fuse`, then chiselled) with thin glowing cracks on it (a separate
emissive material, kept small). Each prop is built in its own collection at the origin (its base centre), painted
(ambient occlusion, edge light, height gradient), and exported together to public/models/arenas/caldera_props.glb as
objects named "<Prop>__<material>" for src/arenas/caldera.ts to instance.

Sizes match the collision capsules in src/arenas/caldera.ts (CALDERA_OBSTACLES): the ridge modules are as long as
their walls with the capsule ends (RidgeA 3.85 m, RidgeB 4.22 m along x) and about 1.2 m deep (the capsule is 0.8);
RidgeA stays under 1.6 m (it sits near the z axis, where the gameplay camera looks over it). BasaltA covers a pillar
of r 0.9 and BasaltB one of r 0.8.

Run inside Blender (through the MCP server), one prop per call (a fuse takes a while), then export:

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\arenas")
    import caldera_props; importlib.reload(caldera_props)
    caldera_props.build("RidgeA")    # ... "RidgeB", "BasaltA", "BasaltB"
    caldera_props.export()           # builds what is missing, writes the GLB, returns triangles per prop
    caldera_props.clear()

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

OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "models", "arenas", "caldera_props.glb")

OBSIDIAN = "#1c1724"
BASALT = "#4a4440"
CRUST = "#30251f"
GLOW = "#ff8a3a"

#: The ridge modules' lengths along x (wall segment + 2 x 0.4 m ends); src/arenas/caldera.ts stretches them to fit.
RIDGE_L = {"RidgeA": 3.85, "RidgeB": 4.22}


class Props:
    def __init__(self):
        self.mats = {}

    def mat(self, part, color, **kw):
        if part not in self.mats:
            self.mats[part] = kit.material(f"caldera_props_{part}", color, **kw)
        return self.mats[part]

    def materials(self):
        return (self.mat("obsidian", OBSIDIAN, roughness=0.12, metallic=0.1, coat=0.6),
                self.mat("basalt", BASALT, roughness=0.85),
                self.mat("crust", CRUST, roughness=0.95),
                self.mat("glow", GLOW, emission="#ff5a14", strength=3.0))


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
    """Pushes vertices along their normals by fractal noise (lumps of crust); `up` scales it on top faces."""
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for v in ob.data.vertices:
        n = v.normal
        k = amp * (1 + (up - 1) * max(0.0, n.z))
        d = noise.fractal(v.co * scale + off, 0.6, 2.1, 4)
        v.co += n * d * k


def _cut(bm, co, nrm):
    """Cuts a closed bmesh with a plane (drops the side `nrm` points to) and closes the cut with a face."""
    nrm = Vector(nrm).normalized()
    co = Vector(co)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=nrm, clear_outer=True, dist=0.0001)
    d = co.dot(nrm)
    cut = [e for e in bm.edges if e.is_boundary and all(abs(v.co.dot(nrm) - d) < 1e-3 for v in e.verts)]
    if cut:
        bmesh.ops.holes_fill(bm, edges=cut, sides=0)


def _chisel(ob, rnd, n, keep=0.0, depth=(0.84, 0.94), squash=(1.0, 1.0)):
    """Cuts `n` flat facets off a sculpted mound (planes from random sides and above, each closed with a face), so it
    reads as broken crust instead of a pillow. The cuts stay `keep` m from the centre at floor level (`squash` scales
    that along x and y, for long mounds)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    for _ in range(n):
        az, el = rnd.random() * 2 * math.pi, -0.15 + rnd.random() * 1.35
        nrm = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
        top = max(v.co.dot(nrm) for v in bm.verts)
        k = keep * math.hypot(squash[0] * math.cos(az), squash[1] * math.sin(az))
        d = max(k * max(0.0, math.cos(el)), top * (depth[0] + rnd.random() * (depth[1] - depth[0])))
        if d >= top - 0.01:
            continue
        _cut(bm, nrm * d, nrm)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def _crust(name, crust, rnd, blobs, target, chisel, keep, squash=(1.0, 1.0)):
    """Cooled lava crust: blobs (centre, radii) melted into one lumpy mound, roughened and chiselled."""
    parts = [kit.blob(f"{name}{i}", c, r, crust, segs=(18, 10)) for i, (c, r) in enumerate(blobs)]
    ob = sculpt.fuse(parts, name, voxel=0.035, smooth=8, target=target)
    _cut_below(ob)
    _rough(ob, 0.05, 2.2, rnd.random() * 10, up=0.6)
    _chisel(ob, rnd, chisel, keep=keep, squash=squash)
    return ob


def _shard(name, base, w, d, h, lean, tilt, mat, rnd, n=7, blunt=0.0):
    """A faceted obsidian shard: the convex hull of points scattered round a tapering block `w` x `d` x `h` (base
    sunk 0.15 m), its tip off-centre, leaning toward angle `lean` by `tilt` radians. `blunt` (0..1) breaks the tip off
    into a sloping fracture face instead of a point (chunky blocks)."""
    bm = bmesh.new()
    pts = []
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.6
        pts.append((math.cos(a) * w / 2 * (0.75 + rnd.random() * 0.25), math.sin(a) * d / 2 * (0.75 + rnd.random() * 0.25), -0.15))
    for k in range(n - 1):
        a = k * 2 * math.pi / (n - 1) + rnd.random() * 0.8
        f = 0.45 + blunt * 0.25 + rnd.random() * 0.3
        s = 0.55 + blunt * 0.2 + rnd.random() * 0.3
        pts.append((math.cos(a) * w / 2 * s, math.sin(a) * d / 2 * s, h * f))
    tip = ((rnd.random() - 0.5) * w * 0.4, (rnd.random() - 0.5) * d * 0.3, h)
    pts.append(tip)
    pts.append((tip[0] + (rnd.random() - 0.5) * w * 0.3, tip[1], h * (0.82 + rnd.random() * 0.1)))
    if blunt:
        # a fracture face: points round the top sloping down from the tip
        sa = rnd.random() * 6.28
        for k in range(4):
            a = sa + k * math.pi / 2 + rnd.random() * 0.5
            pts.append((tip[0] + math.cos(a) * w / 2 * blunt * 0.7, tip[1] + math.sin(a) * d / 2 * blunt * 0.7,
                        h * (1 - blunt * 0.18 * (1 + math.cos(a - sa))) - rnd.random() * 0.03))
    verts = [bm.verts.new(p) for p in pts]
    res = bmesh.ops.convex_hull(bm, input=verts)
    loose = {g for g in res["geom_interior"] + res["geom_unused"] if isinstance(g, bmesh.types.BMVert)}
    bmesh.ops.delete(bm, geom=list(loose), context="VERTS")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = kit.mesh_object(name, bm, mat, smooth=False)
    axis = Vector((-math.sin(lean), math.cos(lean), 0))
    ob.data.transform(Matrix.Translation(Vector(base)) @ Matrix.Rotation(tilt, 4, axis) @ Matrix.Rotation(lean + (rnd.random() - 0.5) * 0.6, 4, "Z"))
    return ob


def _column(name, base, r, h, mat, rnd, slant=0.0, chips=1, lean=0.0, tilt=0.0):
    """A basalt column: a chiselled hexagonal prism `h` tall (base sunk 0.2 m) with joint grooves, a worn chamfer at
    the top, `chips` broken-off corners and, when `slant` > 0, a top snapped off at that slope."""
    prof = [(r, -0.2)]
    j = 0.55 + rnd.random() * 0.4
    while j < h - 0.35:
        prof += [(r, j - 0.03), (r * 0.92, j), (r, j + 0.03)]
        j += 0.8 + rnd.random() * 0.6
    prof += [(r * 0.97, h - 0.07), (r * 0.84, h)]
    ob = kit.lathe(name, prof, mat, seg=6, smooth=False)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    # uneven sides: each of the six edges sits at its own radius
    fac = [0.9 + rnd.random() * 0.18 for _ in range(6)]
    for v in bm.verts:
        if v.co.xy.length > 1e-4:
            k = round(math.atan2(v.co.y, v.co.x) / (math.pi / 3)) % 6
            v.co.x *= fac[k]
            v.co.y *= fac[k]
    if slant > 0:
        a = rnd.random() * 2 * math.pi
        nrm = Vector((math.cos(a) * slant, math.sin(a) * slant, 1))
        _cut(bm, (0, 0, h - slant * r * 0.9), nrm)
    for _ in range(chips):
        a = rnd.random() * 2 * math.pi
        el = 0.5 + rnd.random() * 0.5
        nrm = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        top = max(v.co.dot(nrm) for v in bm.verts)
        _cut(bm, nrm * (top - 0.05 - rnd.random() * 0.07), nrm)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    axis = Vector((-math.sin(lean), math.cos(lean), 0))
    ob.data.transform(Matrix.Translation(Vector(base)) @ Matrix.Rotation(tilt, 4, axis) @ Matrix.Rotation(rnd.random() * 6.28, 4, "Z"))
    return ob


def _cracks(name, crust_ob, glow, rnd, starts, r=0.026, steps=6, step=0.13):
    """Thin glowing cracks following the crust surface: jagged polylines dropped onto it (half sunk), tapered ends."""
    bm = bmesh.new()
    bm.from_mesh(crust_ob.data)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    out = []
    for i, (x, y, a) in enumerate(starts):
        pts = []
        for _ in range(steps):
            loc, nrm, _, _ = tree.ray_cast(Vector((x, y, 6)), Vector((0, 0, -1)))
            if loc is None or loc.z < 0.015:
                break
            pts.append(loc - nrm * r * 0.35)
            a += (rnd.random() - 0.5) * 1.1
            x += math.cos(a) * step
            y += math.sin(a) * step
        if len(pts) < 3:
            continue
        radii = [r * (0.35 if k in (0, len(pts) - 1) else 0.8 + rnd.random() * 0.4) for k in range(len(pts))]
        out.append(kit.chain(f"{name}{i}", pts, radii, glow, seg=5, smooth=False))
    return out


# ---- the props ---------------------------------------------------------------------------------------------------

def ridge(P, coll, name, tall=False, seed=3):
    """An obsidian ridge RIDGE_L[name] long (x), about 1.2 m deep: a cooled lava mound with a row of glossy faceted
    obsidian blocks along its crest, smaller shards leaning out of its flanks, fallen shards at its feet and glowing
    cracks in the crust. `tall`: big blades up to ~2.3 m (wings); otherwise it stays under 1.6 m (near the z axis)."""
    obs, _, crust, glow = P.materials()
    rnd = random.Random(seed)
    L = RIDGE_L[name]
    half = L / 2
    H = 0.5 if tall else 0.4
    blobs = []
    n = 7
    for k in range(n):
        x = -half + 0.25 + (L - 0.5) * k / (n - 1)
        end = abs(x) > half - 0.5
        blobs.append(((x, (rnd.random() - 0.5) * 0.25, 0.0),
                      (0.5 if end else 0.5 + rnd.random() * 0.2, 0.5 + rnd.random() * 0.15, H * (0.6 if end else 0.7 + rnd.random() * 0.5))))
    for k in range(4):
        # low lobes of crust running out from the flanks
        side = 1 if k % 2 else -1
        blobs.append(((-half + 0.6 + (L - 1.2) * (k + rnd.random() * 0.5) / 3.5, side * 0.45, 0.0), (0.45 + rnd.random() * 0.2, 0.3, H * 0.45)))
    mound = _crust(f"{name}Crust", crust, rnd, blobs, 2400 if tall else 2000, 14, keep=0.5, squash=(half / 0.5, 1.0))
    parts = [mound]
    # crest: chunky broken blocks (tall: two big blades among them), leaning to alternate sides
    m = 6 if tall else 5
    for k in range(m):
        x = -half + 0.6 + (L - 1.2) * (k + 0.2 + rnd.random() * 0.6) / m
        side = 1 if k % 2 else -1
        if tall and k in (1, 4):
            h = 1.95 + rnd.random() * 0.35
            parts.append(_shard(f"Blade{k}", (x, side * 0.05, 0.0), 0.75 + rnd.random() * 0.15, 0.45, h,
                                side * math.pi / 2 + (rnd.random() - 0.5) * 0.4, 0.08 + rnd.random() * 0.08, obs, rnd, n=8, blunt=0.25))
        else:
            h = (1.15 if tall else 0.9) + rnd.random() * (0.45 if tall else 0.4)
            parts.append(_shard(f"Block{k}", (x, side * (0.05 + rnd.random() * 0.1), 0.0), 0.6 + rnd.random() * 0.25, 0.5 + rnd.random() * 0.2, h,
                                side * math.pi / 2 + (rnd.random() - 0.5) * 0.8, 0.1 + rnd.random() * 0.2, obs, rnd, n=8, blunt=0.5 + rnd.random() * 0.4))
    for k in range(4 if tall else 3):
        # lower blocks beside the crest
        side = -1 if k % 2 else 1
        x = -half + 0.7 + (L - 1.4) * (k + rnd.random() * 0.5) / (3.5 if tall else 2.5)
        parts.append(_shard(f"Low{k}", (x, side * (0.3 + rnd.random() * 0.08), 0.0), 0.45 + rnd.random() * 0.15, 0.38, 0.55 + rnd.random() * 0.3,
                            side * math.pi / 2 + (rnd.random() - 0.5) * 0.6, 0.25 + rnd.random() * 0.2, obs, rnd, n=7, blunt=0.7))
    # small shards leaning out of the flanks
    for k in range(6):
        side = 1 if k % 2 else -1
        x = -half + 0.4 + (L - 0.8) * (k + rnd.random() * 0.6) / 6
        parts.append(_shard(f"Flank{k}", (x, side * (0.45 + rnd.random() * 0.1), 0.05), 0.26 + rnd.random() * 0.1, 0.22, 0.3 + rnd.random() * 0.25,
                            side * math.pi / 2 + (rnd.random() - 0.5) * 0.6, 0.5 + rnd.random() * 0.3, obs, rnd, n=6, blunt=0.5))
    # fallen chips at the feet
    for k in range(4):
        side = 1 if k % 2 else -1
        x = -half + 0.3 + (L - 0.6) * rnd.random()
        parts.append(_shard(f"Fallen{k}", (x, side * (0.68 + rnd.random() * 0.12), 0.08), 0.2 + rnd.random() * 0.08, 0.16, 0.28 + rnd.random() * 0.15,
                            side * math.pi / 2 + (rnd.random() - 0.5), 1.25 + rnd.random() * 0.25, obs, rnd, n=5, blunt=0.5))
    # cracks running down the flanks from under the blocks
    starts = [(-half + 0.45 + (L - 0.9) * (k + rnd.random() * 0.6) / 6, (1 if k % 2 else -1) * 0.2,
               (1 if k % 2 else -1) * math.pi / 2 + (rnd.random() - 0.5) * 0.7) for k in range(6)]
    parts += _cracks(f"{name}Crack", mound, glow, rnd, starts, r=0.028)
    return parts


def basalt(P, coll, tall=True, seed=7):
    """A basalt column cluster on a cooled lava mound with glowing cracks. `tall`: a 3.3 m column in a ring of six
    shorter ones (some snapped) and an outer ring of stumps, covering a pillar of r 0.9. Otherwise a low cluster of
    snapped stumps (~1.3 m) round a crust mound with a toppled column leaning on it, covering a pillar of r 0.8."""
    _, bas, crust, glow = P.materials()
    rnd = random.Random(seed)
    R = 1.02 if tall else 0.92
    Hm = 0.32 if tall else 0.5
    blobs = [((0, 0, 0), (R * 0.75, R * 0.75, Hm))]
    for k in range(7):
        a = k * 2 * math.pi / 7 + rnd.random() * 0.5
        rr = R * (0.32 + rnd.random() * 0.1)
        blobs.append(((math.cos(a) * (R - rr), math.sin(a) * (R - rr), 0.0), (rr * 1.1, rr, Hm * (0.6 + rnd.random() * 0.4))))
    mound = _crust("BasaltCrust", crust, rnd, blobs, 1800, 9, keep=R * 0.94)
    parts = [mound]
    if tall:
        parts.append(_column("Main", (0, 0, 0), 0.37, 3.3, bas, rnd, slant=0.0, chips=2))
        for k in range(6):
            a = k * math.pi / 3 + 0.3 + (rnd.random() - 0.5) * 0.2
            snapped = k in (1, 4)
            parts.append(_column(f"Ring{k}", (math.cos(a) * 0.64, math.sin(a) * 0.64, 0), 0.27 + rnd.random() * 0.05,
                                 1.4 + rnd.random() * 1.3, bas, rnd, slant=0.5 + rnd.random() * 0.4 if snapped else 0.0, chips=1))
        for k in range(5):
            a = k * 2 * math.pi / 5 + 0.9 + rnd.random() * 0.3
            parts.append(_column(f"Stump{k}", (math.cos(a) * 0.9, math.sin(a) * 0.9, 0), 0.19 + rnd.random() * 0.05,
                                 0.35 + rnd.random() * 0.5, bas, rnd, slant=0.4 if k % 2 else 0.0, chips=1))
        # a broken drum leaning against the foot of the cluster
        parts.append(_column("Drum", (1.05, -0.6, 0.0), 0.2, 0.75, bas, rnd, chips=1, lean=math.pi - 0.5, tilt=1.0))
    else:
        for k, (d, a, r, h, s) in enumerate([(0.0, 0.0, 0.3, 1.3, 0.5), (0.5, 0.6, 0.26, 1.05, 0.7), (0.52, 2.2, 0.25, 0.85, 0.0),
                                             (0.55, 3.5, 0.27, 1.15, 0.6), (0.55, 4.7, 0.23, 0.7, 0.4), (0.82, 1.4, 0.2, 0.45, 0.0),
                                             (0.84, 5.6, 0.19, 0.5, 0.5)]):
            parts.append(_column(f"Stump{k}", (math.cos(a) * d, math.sin(a) * d, 0), r, h, bas, rnd, slant=s, chips=1))
        # a toppled column leaning on the mound's flank
        parts.append(_column("Toppled", (-0.8, -0.72, 0.0), 0.2, 0.85, bas, rnd, chips=1, lean=0.75, tilt=1.05))
    starts = [(math.cos(a) * R * 0.55, math.sin(a) * R * 0.55, a + (rnd.random() - 0.5) * 0.5)
              for a in (k * 2 * math.pi / 5 + 0.4 + rnd.random() * 0.3 for k in range(5))]
    parts += _cracks("BasaltCrack", mound, glow, rnd, starts, r=0.024, steps=5)
    return parts


PROPS = {
    "RidgeA": (ridge, 1.4, {"name": "RidgeA", "tall": False, "seed": 3}),
    "RidgeB": (ridge, 2.3, {"name": "RidgeB", "tall": True, "seed": 11}),
    "BasaltA": (basalt, 3.3, {"tall": True, "seed": 7}),
    "BasaltB": (basalt, 1.3, {"tall": False, "seed": 19}),
}

TINTS = {"obsidian": {"shadow": (0.62, 0.52, 0.78)}, "basalt": {"shadow": (0.78, 0.66, 0.62)}, "crust": {"shadow": (0.9, 0.55, 0.45)}}

#: Normals sharper than this stay faceted (obsidian and basalt facets crisp, crust soft).
SHARP = {"obsidian": 18, "basalt": 30, "crust": 40, "glow": 40}


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
        short = mname.replace("caldera_props_", "")
        ob = kit.join(f"{name}__{short}", obs) if len(obs) > 1 else obs[0]
        ob.name = f"{name}__{short}"
        _tidy(ob, SHARP.get(short, 40))
        out.append(ob)
    return out


def build(name):
    """Builds one prop into the collection "Caldera <name>" (emptied first). Returns its stats."""
    importlib.reload(sculpt)
    dao.setup_scene()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    fn, height, kw = PROPS[name]
    kit.clear(f"Caldera {name}")
    coll = kit.collection(f"Caldera {name}")
    _merge(name, fn(Props(), coll, **kw))
    sculpt.paint(coll, height=height, ao_dist=0.25, tints=TINTS)
    return kit.stats(coll)


def export():
    colls = []
    for name in PROPS:
        c = bpy.data.collections.get(f"Caldera {name}")
        if c is None or not c.objects:
            build(name)
            c = bpy.data.collections[f"Caldera {name}"]
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
        kit.clear(f"Caldera {name}")
    kit.purge()
