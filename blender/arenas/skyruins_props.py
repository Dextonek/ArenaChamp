"""
Sky Ruins cover props, in the heroes' sculpted-and-painted style (see blender/heroes/sculpt.py): tall fluted marble
columns with capitals, tall broken columns, low broken drum stacks, broken balustrade fragments and broken arch
bases. Shafts are stacks of fluted drums (lathes) with worn, chipped edges; broken tops are plane cuts of fresh pale
marble ("chip", a separate material) with shards; gold trims the neckings, imposts and post caps; ivy is its own
material, draped up the shafts in a spiral (patchy), with leaves and hanging strands. Each prop is built in its own
collection at the origin (its base centre), painted (ambient occlusion, edge light, height gradient) and exported to
public/models/arenas/skyruins_props.glb as objects named "<Prop>__<material>" for src/arenas/skyruins.ts to place.

Sizes match the collision capsules in src/arenas/skyruins.ts (SKYRUINS_OBSTACLES): the columns cover a pillar of
r 0.85 (plinth 1.9 m square), the drum stacks one of r 0.7 (plinth 1.55 m), the balustrades a wall of r 0.35 (0.7 m
deep, BAL_L long with the capsule ends), the arch bases one of r 0.4 (0.9 m deep, ARCH_L long). The drum stacks and
the balustrades stay under 1.6 m (they stand near the z axis, where the gameplay camera looks over them).

The backdrop (floating islands with ruins, the far broken arch, edge blocks, balustrade modules, hanging rocks,
a toppled column) is in the second half and goes to skyruins_backdrop.glb.

Run inside Blender (through the MCP server), one or two props per call, then export:

    import sys, importlib
    sys.path.insert(0, r"C:\\VFXTool\\blender\\arenas")
    import skyruins_props as sp; importlib.reload(sp)
    sp.build("ColumnA")    # ... see PROPS
    sp.export()            # builds what is missing, writes the GLB, returns triangles per prop
    sp.clear()

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
from mathutils import Euler, Matrix, Vector, noise  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

import dao_blender as dao  # noqa: E402
import kit  # noqa: E402
import sculpt  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "public", "models", "arenas", "skyruins_props.glb")

MARBLE = "#bdb8c6"
CHIP = "#e2dde6"
GOLD = "#d8ae52"
IVY = "#46723a"
ROCK = "#585466"
GRASS = "#5a7c3e"

#: Wall module lengths along x (wall segment + 2 x the capsule radius); src/arenas/skyruins.ts stretches them to fit.
BAL_L = 3.04
ARCH_L = 3.13


class Props:
    def __init__(self):
        self.mats = {}

    def mat(self, part, color, **kw):
        if part not in self.mats:
            self.mats[part] = kit.material(f"skyruins_props_{part}", color, **kw)
        return self.mats[part]

    def marble(self):
        return self.mat("marble", MARBLE, roughness=0.62)

    def chip(self):
        return self.mat("chip", CHIP, roughness=0.8)

    def gold(self):
        return self.mat("gold", GOLD, metallic=0.75, roughness=0.32)

    def ivy(self):
        return self.mat("ivy", IVY, roughness=0.85)

    def rock(self):
        return self.mat("rock", ROCK, roughness=0.92)

    def grass(self):
        return self.mat("grass", GRASS, roughness=1.0)


# ---- shape helpers (as in glade_props.py) ------------------------------------------------------------------------

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


def _chisel(ob, rnd, n, keep=0.0, depth=(0.84, 0.94), squash=(1.0, 1.0), el=(-0.15, 1.2), centre=(0, 0, 0)):
    """Cuts `n` flat facets off a shape (planes from random sides and above, measured from `centre`): broken stone,
    chipped edges. The cuts stay `keep` m from the centre at floor level (`squash` scales that along x, y)."""
    c = Vector(centre)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    for _ in range(n):
        az, e = rnd.random() * 2 * math.pi, el[0] + rnd.random() * (el[1] - el[0])
        nrm = Vector((math.cos(az) * math.cos(e), math.sin(az) * math.cos(e), math.sin(e)))
        top = max((v.co - c).dot(nrm) for v in bm.verts)
        k = keep * math.hypot(squash[0] * math.cos(az), squash[1] * math.sin(az))
        d = max(k * max(0.0, math.cos(e)), top * (depth[0] + rnd.random() * (depth[1] - depth[0])))
        if d >= top - 0.01:
            continue
        _cut(bm, c + nrm * d, nrm)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def _nick(ob, rnd, n, size=(0.04, 0.1)):
    """Knocks `n` small chips off the edges of `ob`: shallow plane cuts at random rim vertices, each facing out
    and a little up or down."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
    bm.normal_update()
    verts = [v for v in bm.verts if len(v.link_faces) >= 2]
    for _ in range(n):
        if not verts:
            break
        v = rnd.choice(verts)
        nrm = v.normal.copy()
        nrm += Vector(((rnd.random() - 0.5) * 0.6, (rnd.random() - 0.5) * 0.6, (rnd.random() - 0.5) * 0.6))
        if nrm.length < 1e-3:
            continue
        nrm.normalize()
        co = v.co - nrm * (size[0] + rnd.random() * (size[1] - size[0]))
        _cut(bm, co, nrm)
        bm.normal_update()
        verts = [x for x in bm.verts if x.is_valid and len(x.link_faces) >= 2]
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def _break(ob, cuts, chip, name):
    """Snaps `ob` off with plane cuts [(point, normal)] and returns the flat broken faces as a separate object of
    `chip` (fresh pale marble)."""
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
    bm.to_mesh(ob.data)
    bm.free()
    return kit.mesh_object(name, out, chip, smooth=False)


def _shard(name, base, w, d, h, lean, tilt, mat, rnd, n=6):
    """A chip or broken fragment: the convex hull of points round a tapering block `w` x `d` x `h` (base sunk
    0.05 m), its tip off-centre, leaning toward angle `lean` by `tilt` radians."""
    bm = bmesh.new()
    pts = []
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.6
        pts.append((math.cos(a) * w / 2 * (0.75 + rnd.random() * 0.25), math.sin(a) * d / 2 * (0.75 + rnd.random() * 0.25), -0.05))
    for k in range(n - 2):
        a = k * 2 * math.pi / (n - 2) + rnd.random() * 0.8
        s = 0.55 + rnd.random() * 0.3
        pts.append((math.cos(a) * w / 2 * s, math.sin(a) * d / 2 * s, h * (0.5 + rnd.random() * 0.3)))
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


def _tree_of(obs):
    bm = bmesh.new()
    for ob in (obs if isinstance(obs, (list, tuple)) else [obs]):
        bm.from_mesh(ob.data)
    t = BVHTree.FromBMesh(bm)
    bm.free()
    return t


def _drape(src, name, mat, rnd, up=0.45, thresh=-0.15, thick=0.045, scale=1.8, where=None, keep_small=10):
    """A layer draped over the faces of `src` that look up more than `up` (patchy by noise): a copy of those faces
    lifted along the normals, its edges tucked back onto the surface. `where(co)` limits it to a region."""
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
        if len(comp) < keep_small:
            small += comp
    for v in out.verts:
        if v in small:
            continue
        lump = 0.6 + 0.8 * (0.5 + 0.5 * noise.noise(v.co * 7 + off))
        v.co += nrm[v] * (0.006 if v.is_boundary else thick * lump)
    bmesh.ops.delete(out, geom=small, context="VERTS")
    return kit.mesh_object(name, out, mat)


def _flute(ob, n, depth, z0, z1, r_of, ph=0.0):
    """Presses `n` rounded flutes into a lathe shaft between heights z0 and z1 (fading out at both ends)."""
    for v in ob.data.vertices:
        z = v.co.z
        if z < z0 or z > z1:
            continue
        k = min(1.0, (z - z0) / 0.08, (z1 - z) / 0.08)
        a = math.atan2(v.co.y, v.co.x)
        d = 0.5 + 0.5 * math.cos(n * a + ph)
        s = 1 - depth * (1 - d) ** 2 * k / max(r_of(z), 1e-3)
        v.co.x *= s
        v.co.y *= s


def _drum(name, z0, z1, r0, r1, mat, rnd, seed, seg=64, rows=5, flutes=16, chips=4):
    """One fluted drum of a column shaft from z0 to z1 (radius r0 at the foot, r1 at the top), its rims chamfered,
    turned a little against its neighbours, worn (noise) and chipped at the rims."""
    prof = [(0.0, z0), (r0 - 0.03, z0)]
    for k in range(rows + 1):
        t = k / rows
        z = z0 + 0.03 + (z1 - z0 - 0.06) * t
        prof.append((r0 + (r1 - r0) * t, z))
    prof += [(r1 - 0.03, z1), (0.0, z1)]
    ob = kit.lathe(name, prof, mat, seg=seg)
    _flute(ob, flutes, 0.05, z0 + 0.02, z1 - 0.02, lambda z: r0 + (r1 - r0) * (z - z0) / max(z1 - z0, 1e-3), ph=rnd.random() * 0.12)
    _rough(ob, 0.008, 4.0, seed)
    if chips:
        _nick(ob, rnd, chips, size=(0.012, 0.035))
    return ob


def _leaves(name, tree, mat, rnd, pts, size=(0.07, 0.13)):
    """Ivy leaves: small flat ellipsoids dropped onto a surface at `pts` [(point outside, direction in)], turned
    at random on the surface and lifted a little off it."""
    out = []
    for i, (p, d) in enumerate(pts):
        loc, hn, _, _ = tree.ray_cast(Vector(p), Vector(d), 3)
        if loc is None:
            continue
        s = size[0] + rnd.random() * (size[1] - size[0])
        lf = kit.blob(f"{name}{i}", (s * 0.5, 0, 0), (s, s * 0.7, s * 0.12), mat, segs=(5, 2))
        tilt = Euler(((rnd.random() - 0.5) * 0.8, -0.3 - rnd.random() * 0.4, rnd.random() * 6.28)).to_matrix().to_4x4()
        lf.data.transform(Matrix.Translation(loc + hn * 0.015) @ Vector((0, 0, 1)).rotation_difference(hn).to_matrix().to_4x4() @ tilt)
        out.append(lf)
    return out


def _ivy(P, shaft_obs, rnd, ph, z0, z1, rad, vines=2, strands=3, top=None, turn=1.5):
    """Ivy winding up a shaft (radius ~`rad`) between z0 and z1: `vines` thin stems spiralling up (`turn` radians
    per metre) with clusters of leaves along them, and strands with leaves hanging from `top` when given."""
    ivy = P.ivy()
    out = []
    tree = _tree_of(shaft_obs)
    for j in range(vines):
        p0 = ph + j * 2.6 + rnd.random() * 0.5
        za, zb = z0 + rnd.random() * 0.2, z1 - rnd.random() * (z1 - z0) * (0.35 if j else 0.0)
        n = max(3, int((zb - za) / 0.14))
        pts, lpts = [], []
        for k in range(n + 1):
            z = za + (zb - za) * k / n
            a = p0 + (z - z0) * turn * (1 if j % 2 == 0 else -0.7) + math.sin(z * 4 + j) * 0.12
            loc, hn, _, _ = tree.ray_cast(Vector((math.cos(a) * (rad + 1), math.sin(a) * (rad + 1), z)), Vector((-math.cos(a), -math.sin(a), 0)), 3)
            if loc is None:
                continue
            pts.append(loc + hn * 0.012)
            for _ in range(3 if k % 2 else 4):
                b = a + (rnd.random() - 0.5) * 0.7
                lpts.append(((math.cos(b) * (rad + 1), math.sin(b) * (rad + 1), z + (rnd.random() - 0.5) * 0.14), (-math.cos(b), -math.sin(b), 0)))
        if len(pts) >= 2:
            out.append(kit.chain(f"Vine{j}", pts, [0.016] * len(pts), ivy, seg=4))
        out += _leaves(f"Leaf{j}_", tree, ivy, rnd, lpts)
    if top is not None:
        for k in range(strands):
            a = ph + 1.2 + k * 2.0 + rnd.random() * 0.5
            ln = 0.5 + rnd.random() * 0.7
            r = rad + 0.03
            p = [(math.cos(a) * r, math.sin(a) * r, top - 0.05), (math.cos(a) * (r + 0.04), math.sin(a) * (r + 0.04), top - ln * 0.5),
                 (math.cos(a + 0.1) * (r + 0.02), math.sin(a + 0.1) * (r + 0.02), top - ln)]
            out.append(kit.chain(f"Strand{k}", p, [0.016, 0.013, 0.008], ivy, seg=4))
            out += _leaves(f"SLeaf{k}_", tree, ivy, rnd, [((math.cos(a + (rnd.random() - 0.5) * 0.3) * (r + 1), math.sin(a) * (r + 1), top - ln * t), (-math.cos(a), -math.sin(a), 0))
                                                          for t in (0.2, 0.4, 0.6, 0.8, 1.0)])
    return out


def _base(P, rnd, half, h=0.3, ring=0.82, top=0.5):
    """A chipped square plinth (half-width `half`, `h` high) with a moulded round base (torus) up to `top`."""
    marble = P.marble()
    plinth = kit.box("Plinth", (0, 0, h / 2), (2 * half, 2 * half, h), marble, bevel=0.04, segments=2)
    _chisel(plinth, rnd, 5, keep=half - 0.02, el=(0.35, 1.1), depth=(0.92, 0.97))
    _nick(plinth, rnd, 4, size=(0.04, 0.09))
    mould = kit.lathe("Mould", [(0.0, h), (ring + 0.04, h), (ring + 0.04, h + 0.06), (ring, h + 0.1), (ring - 0.04, top - 0.06),
                                (ring - 0.08, top), (0.0, top)], marble, seg=48)
    return [plinth, mould]


# ---- the cover props ---------------------------------------------------------------------------------------------

def column(P, coll, seed=3, H=4.4, broken=None, ivy=True):
    """A fluted marble column on a chipped square plinth (half-width 0.95), its shaft a stack of drums (r 0.7 at the
    foot). Intact (`broken` None): gold necking, echinus and a chipped abacus with volutes, `H` tall. Broken: the
    shaft snapped off along the plane cuts `broken` (pale fresh marble) with shards on the break, a broken abacus slab
    lying low at the foot. Ivy spirals up the shaft."""
    marble, chip, gold = P.marble(), P.chip(), P.gold()
    rnd = random.Random(seed)
    ph = rnd.random() * 6.28
    out = _base(P, rnd, 0.95)
    shaft_top = H - 0.62 if broken is None else H + 0.4
    n = max(2, round((shaft_top - 0.5) / 1.1))
    zs = [0.5 + (shaft_top - 0.5) * k / n for k in range(n + 1)]
    r_at = lambda z: 0.7 - 0.07 * (z - 0.5) / 4.0  # noqa: E731
    drums = []
    for k in range(n):
        d = _drum(f"Drum{k}", zs[k], zs[k + 1], r_at(zs[k]), r_at(zs[k + 1]), marble, rnd, seed + k, chips=3)
        d.data.transform(Matrix.Rotation((rnd.random() - 0.5) * 0.04, 4, "Z") @ Matrix.Translation(((rnd.random() - 0.5) * 0.02, (rnd.random() - 0.5) * 0.02, 0)))
        drums.append(d)
    if broken is not None:
        top = drums[-1]
        out.append(_break(top, broken, chip, "Break"))
        # shards standing on the break
        tree = _tree_of(out[-1])
        for k in range(5):
            a = ph + k * 1.3
            r = 0.25 + rnd.random() * 0.3
            loc, _, _, _ = tree.ray_cast(Vector((math.cos(a) * r, math.sin(a) * r, H + 3)), Vector((0, 0, -1)), 8)
            if loc is not None:
                out.append(_shard(f"Shard{k}", tuple(loc), 0.18 + rnd.random() * 0.1, 0.12, 0.1 + rnd.random() * 0.15, a, 0.3, chip if k % 2 else marble, rnd))
        # a broken slab of the fallen abacus lying low at the foot, beyond the plinth
        a = ph + 2.4
        slab = kit.box("Slab", (math.cos(a) * 1.45, math.sin(a) * 1.45, 0.1), (0.9, 0.7, 0.2), marble, bevel=0.03, segments=2, rotation=Euler((0.05, -0.08, a)))
        out.append(_break(slab, [((math.cos(a) * 1.45, math.sin(a) * 1.45, 0.1), (math.cos(a + 0.6), math.sin(a + 0.6), 0.1))], chip, "SlabBreak"))
        out.append(slab)
        for k in range(4):
            b = ph + 0.8 + k * 1.5
            out.append(_shard(f"Rubble{k}", (math.cos(b) * (1.1 + rnd.random() * 0.4), math.sin(b) * (1.1 + rnd.random() * 0.4), 0.0),
                              0.2 + rnd.random() * 0.15, 0.16, 0.1 + rnd.random() * 0.1, b, 0.2, marble, rnd))
    else:
        t = shaft_top
        out.append(kit.torus("Necking", (0, 0, t - 0.12), r_at(t) + 0.01, 0.035, gold, seg=(40, 5)))
        out.append(kit.lathe("Echinus", [(0.0, t), (r_at(t), t), (0.8, t + 0.16), (0.86, t + 0.26), (0.0, t + 0.26)], marble, seg=48))
        ab = kit.box("Abacus", (0, 0, t + 0.38), (1.72, 1.72, 0.24), marble, bevel=0.04, segments=2)
        _chisel(ab, rnd, 3, el=(-0.2, 0.9), depth=(0.88, 0.95), centre=(0, 0, t + 0.38))
        _nick(ab, rnd, 5, size=(0.04, 0.1))
        out.append(ab)
        out.append(kit.box("AbacusGold", (0, 0, t + 0.3), (1.6, 1.6, 0.04), gold, bevel=0.01, segments=2))
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            c = Vector((math.cos(a) * 0.86, math.sin(a) * 0.86, t + 0.17))
            out.append(kit.torus(f"Volute{k}", tuple(c), 0.11, 0.04, marble, seg=(14, 6), axis=(-math.sin(a), math.cos(a), 0)))
            out.append(kit.blob(f"VoluteEye{k}", tuple(c), (0.045, 0.045, 0.045), gold, segs=(8, 6)))
    out.append(kit.torus("FootGold", (0, 0, 0.62), r_at(0.62) + 0.02, 0.03, gold, seg=(40, 5)))
    out += drums
    if ivy:
        out += _ivy(P, drums, rnd, ph, 0.6, min(shaft_top, H) - 0.35, 0.68, vines=2, top=(H - 0.3) if broken else None)
    return out


def drums(P, coll, seed=7, H=1.35):
    """A low broken drum stack (about `H`): a chipped plinth (half-width 0.78), one whole drum and the stump of a
    second snapped off at a slant (pale break, shards), rubble at its foot, ivy over one side."""
    marble, chip = P.marble(), P.chip()
    rnd = random.Random(seed)
    ph = rnd.random() * 6.28
    out = _base(P, rnd, 0.78, h=0.24, ring=0.66, top=0.4)
    d0 = _drum("Drum0", 0.4, 0.95, 0.6, 0.59, marble, rnd, seed, chips=4)
    d1 = _drum("Drum1", 0.97, 1.7, 0.59, 0.58, marble, rnd, seed + 1, chips=3)
    d1.data.transform(Matrix.Translation((0.02, -0.03, 0)) @ Matrix.Rotation(0.06, 4, "Z"))
    a = rnd.random() * 6.28
    out.append(_break(d1, [((0, 0, H - 0.18), (math.cos(a) * 0.45, math.sin(a) * 0.45, 1)),
                           ((math.cos(a + 2.5) * 0.25, math.sin(a + 2.5) * 0.25, H - 0.08), (math.cos(a + 2.5) * 0.6, math.sin(a + 2.5) * 0.6, 1))], chip, "Break"))
    tree = _tree_of(out[-1])
    for k in range(4):
        b = ph + k * 1.6
        r = 0.2 + rnd.random() * 0.25
        loc, _, _, _ = tree.ray_cast(Vector((math.cos(b) * r, math.sin(b) * r, 5)), Vector((0, 0, -1)), 8)
        if loc is not None:
            out.append(_shard(f"Shard{k}", tuple(loc), 0.16, 0.11, 0.08 + rnd.random() * 0.08, b, 0.3, chip, rnd))
    out += [d0, d1]
    for k in range(3):
        c = ph + 1.0 + k * 1.9
        out.append(_shard(f"Rubble{k}", (math.cos(c) * 1.0, math.sin(c) * 1.0, 0.0), 0.18, 0.14, 0.08 + rnd.random() * 0.08, c, 0.2, marble, rnd))
    out += _ivy(P, [d0, d1], rnd, ph, 0.45, H - 0.2, 0.58, vines=2, strands=2, top=H - 0.25, turn=2.5)
    return out


def _baluster(name, x, y, z, mat, h=0.62, seg=10):
    """A vase-shaped baluster `h` tall standing at (x, y, z)."""
    k = h / 0.62
    prof = [(0.0, 0.0), (0.085, 0.0), (0.085, 0.05), (0.055, 0.1), (0.1, 0.28), (0.07, 0.42), (0.045, 0.5), (0.07, 0.56),
            (0.07, 0.62), (0.0, 0.62)]
    return kit.lathe(name, [(r, z + zz * k) for r, zz in prof], mat, seg=seg, centre=(x, y, 0))


def balustrade(P, coll, seed=11, broken_rail=1, gone=(2,), L=BAL_L):
    """A broken balustrade fragment `L` long (x) and 0.7 m deep: a stepped, chipped plinth, two end posts with gold
    caps, vase balusters under a rail that is snapped off toward `broken_rail` (+1 / -1; pale break), the balusters
    in `gone` lying fallen, ivy over the plinth and rail. About 1.15 m."""
    marble, chip, gold = P.marble(), P.chip(), P.gold()
    rnd = random.Random(seed)
    out = []
    plinth = kit.box("Plinth", (0, 0, 0.11), (L, 0.7, 0.22), marble, bevel=0.03, segments=2)
    _nick(plinth, rnd, 8, size=(0.04, 0.1))
    step = kit.box("Step", (0, 0, 0.28), (L - 0.3, 0.46, 0.12), marble, bevel=0.025, segments=2)
    _nick(step, rnd, 5, size=(0.03, 0.07))
    out += [plinth, step]
    px = L / 2 - 0.28
    posts = []
    for s in (-1, 1):
        hp = 0.8 if s != broken_rail else 0.62
        post = kit.box(f"Post{s}", (s * px, 0, 0.22 + hp / 2), (0.42, 0.42, hp), marble, bevel=0.03, segments=2)
        if s == broken_rail:
            out.append(_break(post, [((s * px, 0, 0.22 + hp - 0.06), (s * 0.4, 0.3, 1))], chip, f"PostBreak{s}"))
        else:
            _nick(post, rnd, 4, size=(0.03, 0.08))
            out.append(kit.box(f"PostCap{s}", (s * px, 0, 1.06), (0.5, 0.5, 0.08), marble, bevel=0.02, segments=2))
            out.append(kit.box(f"PostGold{s}", (s * px, 0, 1.0), (0.46, 0.46, 0.04), gold, bevel=0.01, segments=2))
        posts.append(post)
    out += posts
    # balusters between the posts
    nb = 7
    x0, x1 = -px + 0.36, px - 0.36
    balus = []
    for i in range(nb):
        x = x0 + (x1 - x0) * i / (nb - 1)
        if i in gone:
            continue
        b = _baluster(f"Bal{i}", x, 0, 0.34, marble)
        _rough(b, 0.006, 6.0, seed + i)
        balus.append(b)
    out += balus
    # the fallen balusters lying on the floor in front
    for j, i in enumerate(gone):
        x = x0 + (x1 - x0) * i / (nb - 1)
        b = _baluster(f"Fallen{i}", 0, 0, 0, marble)
        b.data.transform(Matrix.Translation((x + 0.1, -0.55 - 0.05 * j, 0.09)) @ Matrix.Rotation(0.4 + j, 4, "Z") @ Matrix.Rotation(1.57, 4, "Y") @ Matrix.Translation((0, 0, -0.31)))
        out.append(b)
    # the rail, snapped off toward `broken_rail`
    rail = kit.box("Rail", (0, 0, 0.99), (2 * px, 0.3, 0.12), marble, bevel=0.025, segments=2)
    cx = broken_rail * (px * 0.35 + rnd.random() * 0.2)
    out.append(_break(rail, [((cx, 0, 0.99), (broken_rail * 1.0, 0.35, 0.3))], chip, "RailBreak"))
    _nick(rail, rnd, 4, size=(0.02, 0.05))
    out.append(rail)
    out.append(_shard("RailPiece", (broken_rail * (px + 0.45), 0.5, 0.0), 0.5, 0.26, 0.14, 0.3, 0.1, marble, rnd))
    out.append(_drape(plinth, "PlinthIvy", P.ivy(), rnd, up=0.5, thresh=0.05, thick=0.03, scale=2.4))
    tree = _tree_of(out)
    # ivy creeping along the plinth and up one post: leaves dropped from above and from the sides
    ivx = -broken_rail * px
    pts = [((ivx + (rnd.random() - 0.3) * 1.6 * broken_rail, (rnd.random() - 0.5) * 0.7, 3.0), (0, 0, -1)) for k in range(26)]
    pts += [((ivx + (rnd.random() - 0.5) * 0.5, -1.0 if k % 2 else 1.0, 0.25 + rnd.random() * 0.7), (0, 1.0 if k % 2 else -1.0, 0)) for k in range(14)]
    out += _leaves("Leaf", tree, P.ivy(), rnd, pts)
    return out


def arch(P, coll, seed=13, tall=1, L=ARCH_L):
    """A broken arch base `L` long (x) and 0.9 m deep: a stepped, chipped plinth with two piers, the pier at
    `tall` (+1 / -1) whole (2.0 m) with a gold-banded impost and a stub of the arch ring springing from it (snapped
    off, pale break), the other pier broken low; fallen voussoirs and blocks heaped between them (the gap is not
    passable, the capsule is one wall). Ivy on the piers."""
    marble, chip, gold = P.marble(), P.chip(), P.gold()
    rnd = random.Random(seed)
    out = []
    p0 = kit.box("Plinth", (0, 0, 0.14), (L, 0.92, 0.28), marble, bevel=0.035, segments=2)
    _nick(p0, rnd, 6)
    p1 = kit.box("Plinth2", (0, 0, 0.36), (L - 0.16, 0.8, 0.18), marble, bevel=0.03, segments=2)
    _nick(p1, rnd, 5, size=(0.03, 0.08))
    out += [p0, p1]
    px = L / 2 - 0.5
    piers = []
    for s in (-1, 1):
        x = s * px
        out.append(kit.box(f"PierFoot{s}", (x, 0, 0.53), (0.86, 0.86, 0.16), marble, bevel=0.03, segments=2))
        if s == tall:
            pier = kit.box(f"Pier{s}", (x, 0, 0.6 + 0.85), (0.74, 0.74, 1.7), marble, bevel=0.03, segments=2)
            _nick(pier, rnd, 6)
            out.append(kit.box(f"Impost{s}", (x, 0, 2.38), (0.9, 0.9, 0.16), marble, bevel=0.03, segments=2))
            out.append(kit.box(f"ImpostGold{s}", (x, 0, 2.28), (0.82, 0.82, 0.05), gold, bevel=0.01, segments=2))
            # the arch ring springing toward the other pier: an annular sector in x/z (0.7 deep)
            ri, ro, cx, cz = px - 0.37, px + 0.37, 0.0, 2.46
            arc = []
            na = 10
            a_end = 1.4  # radians swept from the springing
            for k in range(na + 1):
                t = a_end * k / na
                a = (math.pi - t) if s < 0 else t
                arc.append((cx + math.cos(a) * ro, cz + math.sin(a) * ro))
            for k in range(na, -1, -1):
                t = a_end * k / na
                a = (math.pi - t) if s < 0 else t
                arc.append((cx + math.cos(a) * ri, cz + math.sin(a) * ri))
            ring = kit.extrude_shape("ArchRing", arc, 0.7, marble)
            a = (math.pi - a_end * 0.85) if s < 0 else a_end * 0.85
            n = Vector((-math.sin(a), 0, math.cos(a))) * (-1 if s < 0 else 1)
            out.append(_break(ring, [((cx + math.cos(a) * px, 0, cz + math.sin(a) * px), (n.x + 0.2, 0.25, n.z))], chip, "ArchBreak"))
            _nick(ring, rnd, 4, size=(0.03, 0.08))
            out.append(ring)
        else:
            pier = kit.box(f"Pier{s}", (x, 0, 0.6 + 0.8), (0.74, 0.74, 1.6), marble, bevel=0.03, segments=2)
            out.append(_break(pier, [((x, 0, 1.75), (s * 0.5, 0.35, 1)), ((x - s * 0.2, 0.1, 1.6), (-s * 0.4, -0.5, 1))], chip, f"PierBreak{s}"))
            _nick(pier, rnd, 4)
        piers.append(pier)
    out += piers
    # the heap between the piers: tumbled voussoirs and blocks
    for k in range(7):
        x = (rnd.random() - 0.5) * (2 * px - 0.9)
        y = (rnd.random() - 0.5) * 0.5
        w = 0.32 + rnd.random() * 0.25
        blk = kit.box(f"Block{k}", (x, y, 0.55 + rnd.random() * 0.25), (w, 0.3 + rnd.random() * 0.2, 0.26 + rnd.random() * 0.12), marble,
                      bevel=0.03, segments=2, rotation=Euler((rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5), rnd.uniform(0, 3.1))))
        _nick(blk, rnd, 2, size=(0.03, 0.06))
        out.append(blk)
    for k in range(3):
        b = rnd.random() * 6.28
        out.append(_shard(f"Rubble{k}", ((rnd.random() - 0.5) * L, 0.75 * (1 if k % 2 else -1), 0.0), 0.3, 0.22, 0.14 + rnd.random() * 0.1, b, 0.2, marble, rnd))
    # ivy on the tall pier and the plinth
    out.append(_drape(p1, "PlinthIvy", P.ivy(), rnd, up=0.5, thresh=0.0, thick=0.03, scale=2.0))
    tree = _tree_of(piers)
    pts = []
    for k in range(34):
        side = rnd.choice(((1, 0), (-1, 0), (0, 1), (0, -1)))
        x = tall * px + (rnd.random() - 0.5) * 0.6
        z = 0.7 + rnd.random() * 1.5 * (1 - abs(x - tall * px))
        pts.append(((x + side[0] * 1.5, side[1] * 1.5, z), (-side[0], -side[1], 0)))
    out += _leaves("Leaf", tree, P.ivy(), rnd, pts)
    out.append(kit.chain("Strand0", [(tall * px + 0.38, -0.3, 2.3), (tall * px + 0.4, -0.32, 1.8), (tall * px + 0.39, -0.3, 1.4)], [0.018, 0.014, 0.008], P.ivy(), seg=4))
    return out


PROPS = {
    "ColumnA": (column, {"seed": 3, "H": 4.4}),
    "ColumnB": (column, {"seed": 17, "H": 4.6}),
    "BrokenA": (column, {"seed": 5, "H": 3.2, "broken": [((0, 0, 3.0), (0.5, 0.25, 1)), ((0.25, -0.1, 3.25), (-0.6, 0.3, 1))]}),
    "BrokenB": (column, {"seed": 23, "H": 2.8, "broken": [((0, 0, 2.55), (-0.4, -0.45, 1)), ((-0.2, 0.2, 2.85), (0.5, -0.3, 1))]}),
    "DrumA": (drums, {"seed": 7, "H": 1.35}),
    "DrumB": (drums, {"seed": 29, "H": 1.3}),
    "BalA": (balustrade, {"seed": 11, "broken_rail": 1, "gone": (4,)}),
    "BalB": (balustrade, {"seed": 31, "broken_rail": -1, "gone": (1, 2)}),
    "ArchA": (arch, {"seed": 13, "tall": 1}),
    "ArchB": (arch, {"seed": 37, "tall": -1}),
}

TINTS = {"marble": {"shadow": (0.66, 0.62, 0.8)}, "chip": {"shadow": (0.75, 0.7, 0.82)}, "gold": {"shadow": (0.7, 0.55, 0.4)},
         "ivy": {"shadow": (0.45, 0.62, 0.5)}, "rock": {"shadow": (0.6, 0.56, 0.72)}, "grass": {"shadow": (0.5, 0.62, 0.45)}}

#: Normals sharper than this stay faceted (breaks and chips crisp, shafts soft).
SHARP = {"marble": 35, "chip": 30, "gold": 50, "ivy": 70, "rock": 32, "grass": 60}


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
        if ob.type != "MESH" or not len(ob.data.polygons):
            bpy.data.objects.remove(ob, do_unlink=True)
            continue
        by.setdefault(ob.data.materials[0].name, []).append(ob)
    out = []
    for mname, obs in by.items():
        short = mname.replace("skyruins_props_", "")
        ob = kit.join(f"{name}__{short}", obs) if len(obs) > 1 else obs[0]
        ob.name = f"{name}__{short}"
        _tidy(ob, SHARP.get(short, 40))
        out.append(ob)
    return out


def footprint(coll, below=0.3):
    """The smallest reach of the prop at its foot (below `below` m) over 36 directions, its x / y extent and height."""
    pts = [v.co for o in coll.objects if o.type == "MESH" for v in o.data.vertices if v.co.z < below]
    reach = []
    for k in range(36):
        d = Vector((math.cos(k * math.pi / 18), math.sin(k * math.pi / 18), 0))
        reach.append(max((p.x * d.x + p.y * d.y) for p in pts))
    top = max(v.co.z for o in coll.objects if o.type == "MESH" for v in o.data.vertices)
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    return {"min_reach": round(min(reach), 2), "x": (round(min(xs), 2), round(max(xs), 2)), "y": (round(min(ys), 2), round(max(ys), 2)), "height": round(top, 3)}


def _build(table, prefix, name):
    importlib.reload(sculpt)
    dao.setup_scene()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    fn, kw = table[name]
    kit.clear(f"{prefix} {name}")
    coll = kit.collection(f"{prefix} {name}")
    objs = _merge(name, fn(Props(), coll, **kw))
    top = max((ob.matrix_world @ v.co).z for ob in objs for v in ob.data.vertices)
    sculpt.paint(coll, height=max(top, 1.0), ao_dist=0.25 if top < 6 else 0.8, tints=TINTS)
    st = kit.stats(coll)
    st.update(footprint(coll))
    return st


def build(name):
    """Builds one cover prop into the collection "Sky <name>" (emptied first). Returns its stats."""
    return _build(PROPS, "Sky", name)


def _export(table, prefix, out, builder):
    colls = []
    for name in table:
        c = bpy.data.collections.get(f"{prefix} {name}")
        if c is None or not c.objects:
            builder(name)
            c = bpy.data.collections[f"{prefix} {name}"]
        colls.append(c)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    objs = [o for c in colls for o in c.objects]
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    dao._export(
        out, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_animations=False,
        export_skins=False, export_morph=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    )
    tris = {c.name: kit.stats(c)["triangles"] for c in colls}
    return {"triangles": tris, "kb": round(os.path.getsize(out) / 1024), "path": out}


def export():
    return _export(PROPS, "Sky", OUT, build)


def clear():
    """Deletes the prop collections (after exporting: keep the shared scene light)."""
    for name in PROPS:
        kit.clear(f"Sky {name}")
    kit.purge()


# ---- the backdrop: floating islands with ruins, the far broken arch, the platform's edge pieces -------------------
# Exported to public/models/arenas/skyruins_backdrop.glb and placed (seeded) by src/arenas/skyruins.ts. Cheaper than
# the cover (coarser voxels, fewer segments): it is seen from 12 m and further.
#
#     sp.build_back("IslandA")   # ... see BACKDROP
#     sp.export_back()
#     sp.clear_back()

BACK_OUT = os.path.join(os.path.dirname(OUT), "skyruins_backdrop.glb")


def _rock_mass(name, P, rnd, R, depth, seed, target=2400, n=6):
    """A floating rock: a broad lumpy top `R` wide over tiers that narrow into a hanging tail `depth` below,
    melted into one, its top cut flat, its sides chiselled into strata-like facets."""
    rock = P.rock()
    parts = [kit.blob(f"{name}T", (0, 0, -0.3), (R, R * 0.88, 0.75), rock, segs=(20, 10))]
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.6
        d = R * (0.55 + rnd.random() * 0.25)
        r = R * (0.35 + rnd.random() * 0.15)
        parts.append(kit.blob(f"{name}R{k}", (math.cos(a) * d, math.sin(a) * d, -0.4 - rnd.random() * 0.4), (r, r * 0.9, r * 0.6), rock, segs=(12, 8)))
    z, r = -0.8, R * 0.8
    for k in range(4):
        h = depth * (0.22 + rnd.random() * 0.06)
        parts.append(kit.blob(f"{name}L{k}", ((rnd.random() - 0.5) * R * 0.2, (rnd.random() - 0.5) * R * 0.2, z - h * 0.5), (r, r * 0.92, h * 0.75), rock, segs=(14, 8)))
        z -= h
        r *= 0.62
    parts.append(kit.blob(f"{name}Tip", (0, 0, z - r), (r, r, r * 2.2), rock, segs=(10, 8)))
    ob = sculpt.fuse(parts, name, voxel=max(0.06, R * 0.035), smooth=4, target=target)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    _cut(bm, (0, 0, 0.15), (0, 0, 1))
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    _rough(ob, R * 0.03, 1.4 / R, seed, up=0.2)
    _chisel(ob, rnd, 14, keep=R * 0.5, el=(-0.7, 0.25), depth=(0.9, 0.97))
    return ob


def _mini_column(name, x, y, z, h, r, P, rnd, broken=False, capital=True):
    """A small, cheap column (12 sides, faint flutes) for the far ruins."""
    marble = P.marble()
    out = [kit.box(f"{name}P", (x, y, z + 0.1), (r * 2.6, r * 2.6, 0.2), marble, bevel=0.02, segments=1)]
    sh = kit.lathe(f"{name}S", [(0.0, z + 0.2), (r, z + 0.2), (r * 0.9, z + h), (0.0, z + h)], marble, seg=12, centre=(x, y, 0))
    if broken:
        a = rnd.random() * 6.28
        out.append(_break(sh, [((x, y, z + h * 0.8), (math.cos(a) * 0.5, math.sin(a) * 0.5, 1))], P.chip(), f"{name}B"))
    elif capital:
        out.append(kit.box(f"{name}C", (x, y, z + h + 0.1), (r * 2.4, r * 2.4, 0.2), marble, bevel=0.02, segments=1))
    out.append(sh)
    return out


def island(P, coll, seed=1, R=4.5, depth=6.0, ruin="ring"):
    """A floating rocky island: grass on its flat top, a hanging tail, ivy vines hanging from the rim, and ruins:
    `ring` a broken ring of columns with a lintel, `temple` a colonnade on a stepped floor with a pediment stub,
    `stump` one big broken column with fallen drums."""
    rnd = random.Random(seed)
    marble = P.marble()
    rock = _rock_mass("Rock", P, rnd, R, depth, seed)
    out = [rock]
    out.append(_drape(rock, "Grass", P.grass(), rnd, up=0.7, thresh=-0.5, thick=0.12, scale=0.6))
    for k in range(9):
        a = k * 2 * math.pi / 9 + rnd.random() * 0.4
        ln = 1.2 + rnd.random() * 2.2
        r0 = R * 0.86
        out.append(kit.chain(f"Vine{k}", [(math.cos(a) * r0, math.sin(a) * r0, 0.0), (math.cos(a) * r0 * 0.98, math.sin(a) * r0 * 0.98, -ln * 0.5),
                                          (math.cos(a) * r0 * 0.9, math.sin(a) * r0 * 0.9, -ln)], [0.07, 0.05, 0.02], P.ivy(), seg=4))
    z = 0.15
    if ruin == "ring":
        n = 6
        for k in range(n):
            a = k * 2 * math.pi / n + 0.3
            h = 3.2 if k in (0, 1, 3) else 1.4 + rnd.random() * 1.0
            out += _mini_column(f"C{k}", math.cos(a) * R * 0.5, math.sin(a) * R * 0.5, z, h, 0.3, P, rnd, broken=k not in (0, 1, 3))
        a0, a1 = 0.3, 0.3 + 2 * math.pi / n
        mid = Vector(((math.cos(a0) + math.cos(a1)) * R * 0.25, (math.sin(a0) + math.sin(a1)) * R * 0.25, z + 3.2 + 0.36))
        out.append(kit.box("Lintel", tuple(mid), (R * 0.5 + 0.8, 0.6, 0.32), marble, bevel=0.03, segments=1, rotation=Euler((0, 0, (a0 + a1) / 2 + math.pi / 2))))
        out.append(kit.box("Floor", (0, 0, z + 0.06), (R * 1.1, R * 1.1, 0.12), marble, bevel=0.02, segments=1, rotation=Euler((0, 0, 0.3))))
    elif ruin == "temple":
        out.append(kit.box("Step0", (0, 0, z + 0.12), (R * 1.3, R * 0.8, 0.24), marble, bevel=0.03, segments=1))
        out.append(kit.box("Step1", (0, 0, z + 0.33), (R * 1.15, R * 0.66, 0.18), marble, bevel=0.03, segments=1))
        zz = z + 0.42
        for row in (-1, 1):
            for k in range(5):
                x = (k - 2) * R * 0.26
                broken = (row, k) in ((1, 1), (1, 4), (-1, 0))
                out += _mini_column(f"T{row}{k}", x, row * R * 0.24, zz, 3.4 if not broken else 1.2 + rnd.random(), 0.28, P, rnd, broken=broken)
        out.append(kit.box("Entab", (-R * 0.13, -R * 0.24, zz + 3.4 + 0.4), (R * 0.82, 0.62, 0.4), marble, bevel=0.03, segments=1))
        out.append(kit.box("EntabGold", (-R * 0.13, -R * 0.24 - 0.32, zz + 3.4 + 0.4), (R * 0.8, 0.04, 0.08), P.gold()))
        ped = kit.extrude_shape("Pediment", [(-R * 0.4, 0), (R * 0.4, 0), (R * 0.1, 0.9), (-R * 0.05, 0.9)], 0.5, marble)
        ped.data.transform(Matrix.Translation((-R * 0.13, -R * 0.24, zz + 3.4 + 0.6)))
        out.append(ped)
    else:
        out += _mini_column("Big", 0.2, -0.3, z, 4.0, 0.6, P, rnd, broken=True)
        for k in range(3):
            d = kit.lathe(f"Dr{k}", [(0.0, -0.4), (0.55, -0.4), (0.55, 0.4), (0.0, 0.4)], marble, seg=12)
            d.data.transform(Matrix.Translation((0.9 + k * 0.85, -0.9 + k * 0.25, z + 0.55)) @ Matrix.Rotation(0.3 + k * 0.2, 4, "Z") @ Matrix.Rotation(1.57, 4, "Y"))
            out.append(d)
    return out


def far_arch(P, coll, seed=2):
    """The big broken arch on its islet off to the west: an islet (R 3.4), two piers (one whole, one broken), the
    arch ring broken off past the apex, gold on the imposts, ivy hanging from the ring."""
    rnd = random.Random(seed)
    marble, chip, gold = P.marble(), P.chip(), P.gold()
    out = [_rock_mass("Rock", P, rnd, 3.4, 4.5, seed, target=1800)]
    out.append(_drape(out[0], "Grass", P.grass(), rnd, up=0.7, thresh=-0.5, thick=0.1, scale=0.8))
    z, S = 0.15, 1.9
    out.append(kit.box("Base", (0, 0, z + 0.15), (1.2, 2 * S + 1.4, 0.3), marble, bevel=0.03, segments=1))
    out.append(kit.box("PierA", (0, -S, z + 1.65), (0.9, 0.9, 3.0), marble, bevel=0.03, segments=1))
    out.append(kit.box("ImpA", (0, -S, z + 3.25), (1.05, 1.05, 0.2), marble, bevel=0.03, segments=1))
    out.append(kit.box("GoldA", (0, -S, z + 3.12), (0.96, 0.96, 0.06), gold))
    pb = kit.box("PierB", (0, S, z + 1.2), (0.9, 0.9, 2.1), marble, bevel=0.03, segments=1)
    out.append(_break(pb, [((0, S, z + 2.0), (0.3, 0.5, 1))], chip, "PierBBreak"))
    out.append(pb)
    ri, ro, cz = S - 0.45, S + 0.45, z + 3.35
    a_end = 2.0  # radians swept from the -y pier, past the apex
    pts = []
    for k in range(13):
        t = a_end * k / 12
        a = math.pi - t
        pts.append((math.cos(a) * ro, cz + math.sin(a) * ro))
    for k in range(12, -1, -1):
        t = a_end * k / 12
        a = math.pi - t
        pts.append((math.cos(a) * ri, cz + math.sin(a) * ri))
    ring = kit.extrude_shape("Ring", pts, 0.8, marble)
    # the outline is in x/z: turn it so the arch spans along y
    ring.data.transform(Matrix.Rotation(math.pi / 2, 4, "Z"))
    a = math.pi - a_end * 0.9
    out.append(_break(ring, [((0, math.cos(a) * S, cz + math.sin(a) * S), (0.2, math.sin(a), -math.cos(a)))], chip, "RingBreak"))
    out.append(ring)
    for k in range(5):
        # hanging from the underside of the ring (which reaches y ~0.4 past the apex)
        y = -ri + 0.15 + (ri + 0.25) * k / 4
        zt = cz + math.sqrt(max(0.0, ri * ri - y * y)) + 0.05
        out.append(kit.chain(f"Vine{k}", [(0.2, y, zt), (0.23, y, zt - 0.6), (0.2, y + 0.05, zt - 1.2 - rnd.random())], [0.04, 0.03, 0.012], P.ivy(), seg=4))
    for k in range(4):
        out.append(_shard(f"Block{k}", ((rnd.random() - 0.5) * 2.4, (rnd.random() - 0.5) * 3, z), 0.6, 0.5, 0.4, rnd.random() * 6, 0.3, marble, rnd))
    return out


def bal_module(P, coll, seed=4):
    """A cheap 1 m balustrade module for the platform edge: base, three balusters (6 sides), rail. ~0.85 m."""
    marble = P.marble()
    out = [kit.box("Base", (0, 0, 0.07), (1.0, 0.24, 0.14), marble), kit.box("Rail", (0, 0, 0.78), (1.0, 0.18, 0.1), marble)]
    for k in (-1, 0, 1):
        out.append(_baluster(f"B{k}", k * 0.32, 0, 0.14, marble, h=0.59, seg=6))
    return out


def bal_post(P, coll, seed=5):
    """An end post for the edge balustrade with a gold band. ~0.95 m."""
    marble = P.marble()
    return [kit.box("Post", (0, 0, 0.44), (0.28, 0.28, 0.88), marble), kit.box("Cap", (0, 0, 0.92), (0.34, 0.34, 0.07), marble),
            kit.box("Gold", (0, 0, 0.86), (0.3, 0.3, 0.04), P.gold())]


def edge_block(P, coll, seed=6, size=(0.9, 0.5, 0.4)):
    """A chiselled slate block for the crumbling platform edge."""
    rnd = random.Random(seed)
    ob = kit.box("Block", (0, 0, size[2] / 2), size, P.rock())
    _chisel(ob, rnd, 7, el=(-0.3, 1.0), depth=(0.8, 0.95), centre=(0, 0, size[2] / 2))
    return [ob]


def chunk(P, coll, seed=8, R=1.0):
    """A hanging rock chunk (under the platform edge, or loose debris floating near it): chiselled, pointed below."""
    rnd = random.Random(seed)
    rock = P.rock()
    ob = sculpt.fuse([kit.blob("C0", (0, 0, 0), (R, R * 0.85, R * 0.6), rock, segs=(12, 8)),
                      kit.blob("C1", (0.1 * R, 0, -R * 0.7), (R * 0.6, R * 0.55, R * 0.8), rock, segs=(10, 8))], "Chunk", voxel=R * 0.08, smooth=3, target=260)
    _chisel(ob, rnd, 9, el=(-0.8, 0.9), depth=(0.82, 0.94))
    return [ob]


def toppled(P, coll, seed=9):
    """A toppled column outside the ring: three drums lying in a line (pale breaks), the capital and fragments."""
    rnd = random.Random(seed)
    marble, chip = P.marble(), P.chip()
    out = []
    for k in range(3):
        d = _drum(f"D{k}", -0.45, 0.45, 0.5, 0.5, marble, rnd, seed + k, seg=24, rows=2, flutes=12, chips=2)
        m = Matrix.Translation((k * 0.95 + (0.12 if k == 2 else 0), 0.06 * k, 0.5)) @ Matrix.Rotation(0.1 if k == 2 else 0.0, 4, "Z") @ Matrix.Rotation(1.57, 4, "Y")
        if k == 2:
            brk = _break(d, [((0, 0, 0.3), (0.4, 0.3, 1))], chip, "Brk")
            brk.data.transform(m)
            out.append(brk)
        d.data.transform(m)
        out.append(d)
    cap = kit.lathe("Ech", [(0.0, 0.0), (0.5, 0.0), (0.66, 0.16), (0.7, 0.26), (0.0, 0.26)], marble, seg=16)
    cap.data.transform(Matrix.Translation((-0.85, 0.2, 0.55)) @ Matrix.Rotation(1.4, 4, "Y"))
    out.append(cap)
    ab = kit.box("Abacus", (-1.6, 0.5, 0.12), (1.3, 1.3, 0.22), marble, bevel=0.02, segments=1, rotation=Euler((0.1, 0, 0.5)))
    _chisel(ab, rnd, 3, el=(-0.2, 0.6), depth=(0.85, 0.95), centre=(-1.6, 0.5, 0.12))
    out.append(ab)
    for k in range(4):
        out.append(_shard(f"S{k}", (rnd.random() * 3 - 1, 0.9 * (1 if k % 2 else -1), 0.0), 0.3, 0.22, 0.14, rnd.random() * 6, 0.2, marble, rnd))
    return out


BACKDROP = {
    "IslandA": (island, {"seed": 41, "R": 4.5, "depth": 6.0, "ruin": "ring"}),
    "IslandB": (island, {"seed": 43, "R": 6.0, "depth": 8.0, "ruin": "temple"}),
    "IslandC": (island, {"seed": 47, "R": 3.4, "depth": 5.0, "ruin": "stump"}),
    "FarArch": (far_arch, {"seed": 49}),
    "Toppled": (toppled, {"seed": 51}),
    "BalSeg": (bal_module, {"seed": 53}),
    "BalPost": (bal_post, {"seed": 55}),
    "EdgeA": (edge_block, {"seed": 57, "size": (0.9, 0.5, 0.4)}),
    "EdgeB": (edge_block, {"seed": 59, "size": (0.7, 0.55, 0.28)}),
    "ChunkA": (chunk, {"seed": 61, "R": 1.0}),
    "ChunkB": (chunk, {"seed": 63, "R": 0.8}),
}


def build_back(name):
    """Builds one backdrop prop into the collection "SkyBack <name>" (emptied first). Returns its stats."""
    return _build(BACKDROP, "SkyBack", name)


def export_back():
    return _export(BACKDROP, "SkyBack", BACK_OUT, build_back)


def clear_back():
    """Deletes the backdrop collections."""
    for name in BACKDROP:
        kit.clear(f"SkyBack {name}")
    kit.purge()
