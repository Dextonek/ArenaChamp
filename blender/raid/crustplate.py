"""
The Heart of Noon's crust plate as a model (2026-11-19; the user: "lets make more models for the raid too"). In "Heartbeat" the Heart
throws plates of its crust out over the floor; hold one and it stands up as cover (src/raid/heart.ts). Until now a box with a gold bar.
Now: a slab of crust, cooled gold gone dark bronze, its edges broken, split in three by two cracks with molten light in them (low), and
a thin worn rim of dark bronze-gold along its front edge. No bright gold: on this floor gold means "stand here" (STAND_COLOR).

Built with the Raid bosses' toolkit. Still: one part. The size of the box it replaces, 2.3 (x) by 2.6 (y) by 0.32 (z, thick), the
underside at z = 0, so the game sets it down 0.16 lower than the box's middle. The rim runs along the -Y edge (the box's +Z edge in the
game, where its gold bar was). Faces -Y, z up, metres.

    blender --background --factory-startup --python blender/raid/run.py -- crustplate
"""
from mathutils import Vector

import boss_bodies as bb
from boss_bodies import Boss

HEIGHT = 0.32
W, L, TH = 2.3, 2.6, 0.32


def _clip(poly, nx, ny, d, keep):
    """The part of a convex polygon (x, y points) on one side of the line nx*x + ny*y = d (keep +1 or -1)."""
    out = []
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        sp, sq = keep * (nx * p[0] + ny * p[1] - d), keep * (nx * q[0] + ny * q[1] - d)
        if sp >= 0:
            out.append(p)
        if (sp >= 0) != (sq >= 0):
            t = sp / (sp - sq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def _inset(poly, k):
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    return [(cx + (p[0] - cx) * k, cy + (p[1] - cy) * k) for p in poly]


def build_crustplate():
    B = Boss("crustplate", HEIGHT)
    crust = B.m("crust", "#3a2c20", 0.35, 0.72)
    hi = B.m("crust_hi", "#5a4530", 0.35, 0.66)
    rim = B.m("rim", "#5a4422", 0.6, 0.6)
    lava = B.m("lava", "#4a1608", 0.0, 0.6, "#ff7a2a", 0.7)

    plate = B.part("crustplate", (0, 0, 0))
    r = plate.rng
    # the outline: a slab with cut corners (a convex outline: the broken places are chamfers)
    hw, hl = W / 2, L / 2
    outline = [(-hw + 0.1, -hl), (-0.2, -hl + 0.03), (0.35, -hl), (hw - 0.28, -hl + 0.02), (hw, -hl + 0.2), (hw - 0.07, 0.1), (hw - 0.04, hl - 0.5),
               (hw - 0.34, hl), (0.2, hl - 0.06), (-hw + 0.5, hl), (-hw + 0.1, hl - 0.15), (-hw, hl - 0.4), (-hw + 0.06, 0.2), (-hw + 0.05, -hl + 0.3)]
    # two cracks cut it into three pieces; each piece is pulled a little from its neighbours
    g = 0.045
    n1 = Vector((1.0, 0.3)).normalized()
    d1 = 0.12
    n2 = Vector((-0.25, 1.0)).normalized()
    d2 = 0.45
    left = _clip(outline, n1.x, n1.y, d1, -1)
    right = _clip(outline, n1.x, n1.y, d1, +1)
    rtop = _clip(right, n2.x, n2.y, d2, +1)
    rbot = _clip(right, n2.x, n2.y, d2, -1)
    pieces = []
    for poly, (nx, ny, off) in ((left, (n1.x, n1.y, -g / 2)), (rtop, (n1.x, n1.y, g / 2)), (rbot, (n1.x, n1.y, g / 2))):
        pieces.append([(p[0] + nx * off, p[1] + ny * off) for p in poly])
    pieces[1] = [(p[0] + n2.x * g / 2, p[1] + n2.y * g / 2) for p in pieces[1]]
    pieces[2] = [(p[0] - n2.x * g / 2, p[1] - n2.y * g / 2) for p in pieces[2]]
    tops = (TH, TH - 0.025, TH - 0.01)
    for k, poly in enumerate(pieces):
        pts = []
        for p in poly:
            pts.append((p[0] * 0.985, p[1] * 0.985, 0.0))
            pts.append((p[0], p[1], TH - 0.08 - r.uniform(0, 0.03)))
        for p in _inset(poly, 0.93):
            pts.append((p[0], p[1], tops[k] + r.uniform(-0.012, 0.012)))
        plate.hull(pts, crust)
        # a slightly raised, lighter pad on the face: a plate within the plate, so it reads as layered crust
        pad = _inset(poly, 0.62)
        plate.hull([(p[0], p[1], tops[k] - 0.01) for p in pad] + [(p[0], p[1], tops[k] + 0.03) for p in _inset(pad, 0.85)], hi)
    # the lava in the cracks: a thin sheet standing in each, its top set below the face so only a thin line shows
    for nrm, d, lo, hi_, shift in ((n1, d1, -1.3, 1.3, 0.0), (n2, d2, 0.0, 1.15, 0.35)):
        t = Vector((-nrm.y, nrm.x))
        c = Vector((nrm.x * d, nrm.y * d)) + Vector((n1.x, n1.y)) * shift
        a, b = c + t * lo, c + t * hi_
        q = nrm * g * 0.7
        plate.hull([(a.x + q.x, a.y + q.y, 0.05), (a.x - q.x, a.y - q.y, 0.05), (b.x + q.x, b.y + q.y, 0.05), (b.x - q.x, b.y - q.y, 0.05),
                    (a.x + q.x, a.y + q.y, TH - 0.07), (a.x - q.x, a.y - q.y, TH - 0.07), (b.x + q.x, b.y + q.y, TH - 0.07),
                    (b.x - q.x, b.y - q.y, TH - 0.07)], lava)
    # the rim: thin, worn, dark bronze-gold, in three pieces along the front edge and a stub on a side
    for x0, x1 in ((-0.95, -0.25), (-0.1, 0.55), (0.7, 0.98)):
        plate.hull([(x0, -hl - 0.01, TH - 0.05), (x1, -hl - 0.01, TH - 0.05), (x0 + 0.03, -hl + 0.09, TH - 0.05), (x1 - 0.03, -hl + 0.09, TH - 0.05),
                    (x0 + 0.02, -hl + 0.01, TH + 0.02), (x1 - 0.02, -hl + 0.01, TH + 0.02), (x0 + 0.04, -hl + 0.08, TH + 0.02),
                    (x1 - 0.04, -hl + 0.08, TH + 0.02)], rim)
    plate.hull([(hw - 0.05, -hl + 0.5, TH - 0.05), (hw - 0.05, -hl + 0.9, TH - 0.05), (hw - 0.14, -hl + 0.5, TH - 0.05), (hw - 0.14, -hl + 0.9, TH - 0.05),
                (hw - 0.06, -hl + 0.52, TH + 0.02), (hw - 0.06, -hl + 0.88, TH + 0.02), (hw - 0.13, -hl + 0.52, TH + 0.02), (hw - 0.13, -hl + 0.88, TH + 0.02)],
               rim)
    plate.finish()
    return B


def register():
    bb.BUILD["crustplate"] = build_crustplate
