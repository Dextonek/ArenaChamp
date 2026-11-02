"""
Frostfall Lake cover props, in the heroes' sculpted-and-painted style (see blender/heroes/sculpt.py): a frozen
boulder for the middle of the ring, two ice-spire clusters and two wind-carved snow-drift modules. Rock and snow are
sculpted blobs melted into one surface (`sculpt.fuse`), the ice is faceted crystal. Each prop is built in its own
collection at the origin (its base centre), painted (ambient occlusion, edge light, height gradient), and exported
together to public/models/arenas/frost_props.glb as objects named "<Prop>__<material>" for src/arenas/frost.ts to
instance.

Sizes match the collision capsules in src/arenas/frost.ts (FROST_OBSTACLES): the boulder covers a pillar of r 0.9
and stays low (1.25 m, the gameplay camera looks along the z axis over it), the spires cover pillars of r 0.8, and
the drift modules are 4.2 m long (x) and at least 0.8 m deep (a wall of r 0.4 from its segment ends); longer or
shorter drifts stretch them along x.

Run inside Blender (through the MCP server), one prop per call (a fuse takes a while), then export:

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\arenas")
    import frost_props; importlib.reload(frost_props)
    frost_props.build("Boulder")    # ... "SpireA", "SpireB", "DriftA", "DriftB"
    frost_props.export()            # builds what is missing, writes the GLB, returns triangles per prop

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

import dao_blender as dao  # noqa: E402
import kit  # noqa: E402
import sculpt  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "models", "arenas", "frost_props.glb")

ICE = "#9ad4ee"
SNOW = "#e4ecf4"
ROCK = "#4c5462"

#: The drift module's length (a 3.4 m segment plus 2 x 0.4 m ends); src/arenas/frost.ts stretches it.
DRIFT_L = 4.2


class Props:
    def __init__(self):
        self.mats = {}

    def mat(self, part, color, **kw):
        if part not in self.mats:
            self.mats[part] = kit.material(f"frost_props_{part}", color, **kw)
        return self.mats[part]

    def materials(self):
        return (self.mat("ice", ICE, roughness=0.18, coat=0.4), self.mat("snow", SNOW, roughness=0.92),
                self.mat("rock", ROCK, roughness=0.88))


# ---- shape helpers -----------------------------------------------------------------------------------------------

def _crystal(name, base, h, r, lean, tilt, mat, rnd, sides=6):
    """A faceted ice crystal: a `sides`-sided prism with a pointed, slightly off-centre tip, `h` tall from its base
    (sunk 0.2 m into whatever it grows from), leaning toward angle `lean` by `tilt` radians."""
    sq = 0.8 + rnd.random() * 0.3
    prof = [(0.0, -0.2), (r, -0.2), (r * 0.97, h * 0.68), (r * 0.82, h * (0.74 + rnd.random() * 0.06)), (0.0, h)]
    ob = kit.lathe(name, prof, mat, seg=sides, smooth=False)
    tip = Vector(((rnd.random() - 0.5) * r * 0.5, (rnd.random() - 0.5) * r * 0.5, 0))
    for v in ob.data.vertices:
        v.co.y *= sq
        if v.co.z > h * 0.7:
            v.co += tip * ((v.co.z - h * 0.7) / (h * 0.3))
    axis = Vector((-math.sin(lean), math.cos(lean), 0))
    m = Matrix.Translation(Vector(base)) @ Matrix.Rotation(tilt, 4, axis) @ Matrix.Rotation(rnd.random() * 6.28, 4, "Z")
    ob.data.transform(m)
    return ob


def _cut_below(ob, z=-0.06):
    """Drops everything under the floor (hidden anyway): fewer triangles."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1), clear_inner=True)
    bm.to_mesh(ob.data)
    bm.free()


def _rough(ob, amp, scale, seed, up=1.0):
    """Pushes vertices along their normals by fractal noise (rock lumps, snow ripples); `up` scales it on top faces."""
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for v in ob.data.vertices:
        n = v.normal
        k = amp * (1 + (up - 1) * max(0.0, n.z))
        d = noise.fractal(v.co * scale + off, 0.6, 2.1, 4)
        v.co += n * d * k


def _chisel(ob, rnd, n, keep=0.0, depth=(0.84, 0.94)):
    """Cuts `n` flat facets off a sculpted rock (planes from random sides and above, each closed with a face), so it
    reads as broken stone instead of a pillow. The cuts stay `keep` m from the centre at floor level."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    # close the floor opening first, so every cut leaves one closed loop to fill
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    for _ in range(n):
        az, el = rnd.random() * 2 * math.pi, -0.15 + rnd.random() * 1.35
        nrm = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
        top = max(v.co.dot(nrm) for v in bm.verts)
        d = max(keep * max(0.0, math.cos(el)), top * (depth[0] + rnd.random() * (depth[1] - depth[0])))
        if d >= top - 0.01:
            continue
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=nrm * d, plane_no=nrm, clear_outer=True, dist=0.0001)
        cut = [e for e in bm.edges if e.is_boundary and all(abs(v.co.dot(nrm) - d) < 1e-3 for v in e.verts)]
        if cut:
            bmesh.ops.holes_fill(bm, edges=cut, sides=0)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def _fuse(parts, name, voxel, target):
    ob = sculpt.fuse(parts, name, voxel=voxel, smooth=8, target=target)
    _cut_below(ob)
    return ob


def _rock_base(name, rock, rnd, radius, height, n=7, target=1800):
    """A ring of rock blobs (reaching `radius` from the centre, `height` high) melted into one lumpy outcrop."""
    parts = [kit.blob(f"{name}C", (0, 0, height * 0.35), (radius * 0.7, radius * 0.7, height * 0.75), rock, segs=(20, 12))]
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.5
        rr = radius * (0.32 + rnd.random() * 0.12)
        d = radius - rr
        parts.append(kit.blob(f"{name}{k}", (math.cos(a) * d, math.sin(a) * d, height * (0.1 + rnd.random() * 0.25)),
                              (rr * 1.1, rr, height * (0.5 + rnd.random() * 0.4)), rock, segs=(16, 10)))
    ob = _fuse(parts, name, 0.035, target)
    _rough(ob, 0.08, 1.8, rnd.random() * 10)
    _chisel(ob, rnd, 9, keep=radius * 0.94)
    return ob


def _snow_cap(name, snow, rnd, blobs, target=1200):
    """Snow blobs (centre, radii) melted into one soft cap."""
    parts = [kit.blob(f"{name}{i}", c, r, snow, segs=(18, 10)) for i, (c, r) in enumerate(blobs)]
    ob = _fuse(parts, name, 0.03, target)
    _rough(ob, 0.015, 3.0, rnd.random() * 10, up=1.6)
    return ob


# ---- the props ---------------------------------------------------------------------------------------------------

def boulder(P, coll):
    """The low frozen boulder in the middle of the ring: a lumpy rock (radius 1.0) under a wind-swept snow cap, with
    small ice crystals growing out of its flanks; 1.25 m tall."""
    ice, snow, rock = P.materials()
    rnd = random.Random(3)
    parts = [_rock_base("BoulderRock", rock, rnd, 1.02, 1.0, n=8, target=2600)]
    parts.append(_snow_cap("BoulderSnow", snow, rnd, [
        ((0.05, 0.05, 0.98), (0.62, 0.55, 0.26)), ((-0.35, 0.2, 0.86), (0.4, 0.38, 0.2)),
        ((0.35, -0.25, 0.84), (0.42, 0.35, 0.18)), ((-0.75, -0.6, 0.0), (0.55, 0.45, 0.16)), ((0.8, 0.6, 0.0), (0.5, 0.42, 0.14)),
    ], target=1600))
    for k, (a, h, r, t) in enumerate([(0.4, 0.85, 0.12, 0.5), (0.75, 0.6, 0.09, 0.7), (2.6, 0.75, 0.11, 0.55),
                                      (3.9, 0.95, 0.13, 0.45), (4.2, 0.55, 0.08, 0.8), (5.5, 0.7, 0.1, 0.6)]):
        d = 0.78
        parts.append(_crystal(f"BIce{k}", (math.cos(a) * d, math.sin(a) * d, 0.3 + rnd.random() * 0.2), h, r, a, t, ice, rnd))
    return parts


def spire(P, coll, main=3.4, fan=False, seed=5):
    """An ice-spire cluster on a snowy rock outcrop (radius 0.95, covers a pillar of r 0.8): a tall crystal with a
    ring of satellites leaning outward, a toppled shard and a snapped stump. `fan`: two tall crystals in a fan
    instead of one spire."""
    ice, snow, rock = P.materials()
    rnd = random.Random(seed)
    parts = [_rock_base("SpireRock", rock, rnd, 0.95, 0.55, n=7)]
    parts.append(_snow_cap("SpireSnow", snow, rnd, [
        ((0.3, -0.4, 0.28), (0.55, 0.45, 0.2)), ((-0.45, 0.2, 0.3), (0.5, 0.5, 0.2)),
        ((0.55, 0.45, 0.06), (0.42, 0.4, 0.16)), ((-0.2, -0.75, 0.04), (0.45, 0.32, 0.12)),
    ]))
    if fan:
        parts.append(_crystal("Main0", (0.12, 0.05, 0.3), main, 0.38, 0.3, 0.12, ice, rnd))
        parts.append(_crystal("Main1", (-0.18, -0.1, 0.3), main * 0.82, 0.32, 3.4, 0.2, ice, rnd))
    else:
        parts.append(_crystal("Main0", (0, 0, 0.3), main, 0.44, 0.0, 0.04, ice, rnd))
    n = 5 if fan else 7
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.4
        d = 0.35 + rnd.random() * 0.2
        h = main * (0.28 + rnd.random() * 0.35)
        parts.append(_crystal(f"Sat{k}", (math.cos(a) * d, math.sin(a) * d, 0.25), h, 0.14 + rnd.random() * 0.1, a, 0.22 + rnd.random() * 0.25, ice, rnd))
    # a toppled shard lying against the outcrop and a snapped stump
    parts.append(_crystal("Toppled", (0.55, -0.55, 0.1), 1.3, 0.16, -0.8, 1.2, ice, rnd))
    stump = _crystal("Stump", (-0.6, 0.55, 0.15), 0.6, 0.22, 2.4, 0.3, ice, rnd)
    for v in stump.data.vertices:
        v.co.z = min(v.co.z, 0.45 + 0.15 * v.co.x)
    parts.append(stump)
    return parts


def _drift_body(name, snow, L, H, seed, double):
    """The snow of a drift as a height field melted into one closed surface: crest height `H` along x (one long
    ridge, or two humps when `double`), a long windward slope to -y, a steep lee face to +y under a slight cornice,
    rounded ends and wind ripples on the windward side. Returns (object, crest(x) -> (y, z))."""
    half = L / 2
    ph = seed * 0.37

    def end(x):
        return max(0.0, 1 - abs(x / half) ** 4) ** 0.5

    def crest_y(x):
        return 0.1 + 0.07 * math.sin(x * 1.4 + ph)

    def crest_h(x):
        if double:
            a, s = 0.22 * L, 0.3 * L
            hump = max(math.exp(-((x - a) / s) ** 2), math.exp(-((x + a) / s) ** 2))
            f = 0.62 + 0.38 * hump
        else:
            f = 0.9 + 0.1 * math.sin(x * 2.1 + ph)
        return H * f * max(0.0, 1 - (x / half) ** 2) ** 0.6

    def height(x, y):
        w = end(x)
        if w <= 0:
            return -0.2
        u = y - crest_y(x)
        h = crest_h(x)
        if u < 0:  # windward: long, gently convex slope with ripples
            t = min(1.0, -u / (1.0 * w))
            z = h * (1 - t) ** 1.5 + 0.05 * math.sin(x * 4.2 + y * 7 + ph + 0.6 * math.sin(x * 1.7)) * min(1.0, t * 3) * (1 - t)
        else:  # lee: a steep face
            t = u / (0.58 * w)
            z = h * max(0.0, 1 - t ** 3) ** 0.4
        return z if z > 0.04 else -0.2

    bm = bmesh.new()
    nx, ny = 96, 36
    y0, y1 = -1.05, 0.85
    grid = [[bm.verts.new((-half - 0.05 + (L + 0.1) * i / nx, y0 + (y1 - y0) * j / ny, 0)) for j in range(ny + 1)] for i in range(nx + 1)]
    for i in range(nx):
        for j in range(ny):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    for row in grid:
        for v in row:
            v.co.z = height(v.co.x, v.co.y)
    # the cornice: the top of the lee face leans out a little
    for row in grid:
        for v in row:
            if v.co.z > 0.5 and v.co.y > crest_y(v.co.x):
                v.co.y += 0.08 * (v.co.z - 0.5)
    # close it into a solid (a floor under the field) for the voxel remesh
    edges = [e for e in bm.edges if e.is_boundary]
    ext = bmesh.ops.extrude_edge_only(bm, edges=edges)
    for v in [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]:
        v.co.z = -0.3
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = kit.mesh_object(name, bm, snow)
    ob = _fuse([ob], name, 0.03, 4200)
    _drop_crumbs(ob)
    _rough(ob, 0.012, 3.0, seed)
    return ob, lambda x: (crest_y(x), crest_h(x))


def _drop_crumbs(ob, keep=0.05):
    """Deletes loose pieces smaller than `keep` of the mesh (thin edges of a height field melt into crumbs)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    seen, groups = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, comp = [v], []
        seen.add(v.index)
        while stack:
            a = stack.pop()
            comp.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen:
                    seen.add(b.index)
                    stack.append(b)
        groups.append(comp)
    small = [v for g in groups if len(g) < keep * len(bm.verts) for v in g]
    bmesh.ops.delete(bm, geom=small, context="VERTS")
    bm.to_mesh(ob.data)
    bm.free()


def _rock(name, rock, rnd, centre, radius, height, n=5):
    """A small chiselled rock (a fused blob cluster) standing at `centre`."""
    ob = _rock_base(name, rock, rnd, radius, height, n=n, target=700)
    ob.data.transform(Matrix.Translation(Vector(centre)))
    return ob


def drift(P, coll, seed=9, double=False):
    """A wind-carved snow drift DRIFT_L long (x) and about 1.6 m deep (y; the capsule is 0.8): a long windward slope
    (-y), a steep lee face (+y) under a slight cornice, wind ripples, rocks breaking through and ice shards in the
    crest. `double`: a lower ridge with two humps and a rock in the saddle. 1.15-1.3 m tall (1.6 with the shards)."""
    ice, snow, rock = P.materials()
    rnd = random.Random(seed)
    half = DRIFT_L / 2
    body, crest = _drift_body("DriftSnow", snow, DRIFT_L, 1.15 if double else 1.25, seed, double)
    parts = [body]
    rocks = [((-half + 0.45, -0.15, 0), 0.55, 0.85), ((half - 1.2, -0.7, 0), 0.38, 0.55)]
    if double:
        rocks.append(((0.05, 0.1, 0), 0.45, 1.05))
    for i, (c, r, h) in enumerate(rocks):
        parts.append(_rock(f"DriftRock{i}", rock, rnd, c, r, h))
    for k, (x, h) in enumerate([(-0.95, 0.55), (-0.6, 0.38), (0.25, 0.5), (0.85, 0.45), (1.2, 0.32)]):
        if double and abs(x) < 0.4:
            continue
        y, z = crest(x)
        parts.append(_crystal(f"DIce{k}", (x, y + 0.05, z - 0.15), h, 0.1 + rnd.random() * 0.05, 1.57 + (rnd.random() - 0.5), 0.2 + rnd.random() * 0.3, ice, rnd))
    return parts


PROPS = {
    "Boulder": (boulder, 1.35, {}),
    "SpireA": (spire, 3.4, {"main": 3.4, "fan": False, "seed": 5}),
    "SpireB": (spire, 4.0, {"main": 4.0, "fan": True, "seed": 17}),
    "DriftA": (drift, 1.3, {"seed": 9}),
    "DriftB": (drift, 1.15, {"seed": 23, "double": True}),
}

TINTS = {"snow": {"shadow": (0.62, 0.74, 0.95)}, "ice": {"shadow": (0.55, 0.75, 1.0)}, "rock": {"shadow": (0.7, 0.74, 0.9)}}


def _tidy(ob):
    """Welds seams (a lathe's first and last ring) and dissolves flat areas: fewer triangles, no seam lines."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.6), verts=bm.verts, edges=bm.edges)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = True
    # crystal facets stay sharp, sculpted rock and snow stay smooth
    ob.data.set_sharp_from_angle(angle=math.radians(40))


def _merge(name, parts):
    """Joins a prop's parts by material: objects named "<Prop>__<material>"."""
    by = {}
    for ob in parts:
        by.setdefault(ob.data.materials[0].name, []).append(ob)
    out = []
    for mname, obs in by.items():
        short = mname.replace("frost_props_", "")
        ob = kit.join(f"{name}__{short}", obs) if len(obs) > 1 else obs[0]
        ob.name = f"{name}__{short}"
        _tidy(ob)
        out.append(ob)
    return out


def build(name):
    """Builds one prop into the collection "Frost <name>" (emptied first). Returns its triangle count."""
    importlib.reload(sculpt)
    dao.setup_scene()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    fn, height, kw = PROPS[name]
    coll = kit.collection(f"Frost {name}")
    _merge(name, fn(Props(), coll, **kw))
    sculpt.paint(coll, height=height, ao_dist=0.25, tints=TINTS)
    return kit.stats(coll)


def export():
    colls = []
    for name in PROPS:
        c = bpy.data.collections.get(f"Frost {name}")
        if c is None or not c.objects:
            build(name)
            c = bpy.data.collections[f"Frost {name}"]
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
        kit.clear(f"Frost {name}")
    kit.purge()
