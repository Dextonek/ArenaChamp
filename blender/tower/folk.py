"""Shared parts of the Climb's people (docs/tower/models/README.md), on top of the heroes' kit (blender/heroes/realkit.py)
and their parts (blender/heroes/real/parts_*.py): a held thing's frame, poles, a hanging lantern, a wide hat, a veil, a
basket or a frame on the back with its straps, a tray carried in front. Stateless: every function takes the `Real`.

A thing held in the LEFT hand (the people stand in the hero Sefu's way of holding: a staff upright) is built along the
hand's frame: `d` is up the staff when held, `fwd` the way the figure faces, `side` across; lengths along `d` are
multiplied by `s` (parts_c.along) so that they come out in the figure's own height.
"""
import math
from types import SimpleNamespace

from mathutils import Vector

from realkit import PI
from real import parts_a as PA
from real import parts_c as P


def hand(R, side="l"):
    """The held thing's frame in that hand: f (the piece), o (the palm), d (up the staff), fwd, side, up, s."""
    f, o, d, up = R.held(side)
    fwd = R.bone(f"hand_{side}") - R.bone(f"middle_01_{side}")
    fwd.y = fwd.z = 0.0
    fwd.normalize()
    return SimpleNamespace(f=f, o=o, d=d, up=up, fwd=fwd, side=up.cross(d).normalized(), s=P.along(R), R=R)


def at(h, t, fwd=0.0, side=0.0):
    """A point `t` m up the staff from the palm (in the figure's height), moved `fwd` and `side` m."""
    return h.o + h.d * t * h.s + h.fwd * fwd + h.side * side


def pole(h, key, back=1.25, front=0.6, r=0.014, butt="gold", rings=(), ring_key="gold"):
    """A shaft from `back` m below the palm to `front` m above it; a round butt; gold rings at those heights."""
    h.f.tube(key, [at(h, -back), at(h, front)], r, seg=10)
    if butt:
        h.f.ellipsoid(butt, at(h, -back - 0.01), P.rr(h.R, r * 1.5), seg=(10, 8))
    for t in rings:
        h.f.tube(ring_key, [at(h, t - 0.02), at(h, t + 0.02)], r * 1.4, seg=10)
    return at(h, front)


def lantern(h, top, frame, glass, glow, size=1.0, chain=0.05):
    """A lantern hanging from `top` (down is -d when the staff stands): a ring, a chain, a cap, a glass body in a cage
    of four rods, a base, a light inside."""
    f, d, s = h.f, h.d, h.s
    k = size
    f.torus(frame, top - d * 0.012 * s, 0.014 * k, 0.004, normal=h.side, seg=(12, 5))
    c0 = top - d * chain * s
    f.tube(frame, [top - d * 0.02 * s, c0], 0.004, seg=5)
    P.hull(f, frame, [c0, c0 - d * 0.03 * k * s, c0 - d * 0.05 * k * s], [0.012 * k, 0.04 * k, 0.05 * k], seg=14, side=h.fwd)
    g0, g1 = c0 - d * 0.05 * k * s, c0 - d * 0.17 * k * s
    P.hull(f, glass, [g0, g0.lerp(g1, 0.5), g1], [0.04 * k, 0.047 * k, 0.04 * k], seg=14, side=h.fwd)
    for a in range(4):
        u = h.fwd * math.cos(PI / 4 + a * PI / 2) + h.side * math.sin(PI / 4 + a * PI / 2)
        f.tube(frame, [g0 + u * 0.044 * k, g0.lerp(g1, 0.5) + u * 0.051 * k, g1 + u * 0.044 * k], 0.0045 * k, seg=5)
    P.hull(f, frame, [g1, g1 - d * 0.025 * k * s], [0.05 * k, 0.03 * k], seg=14, side=h.fwd)
    f.ellipsoid(glow, g0.lerp(g1, 0.55), P.rr(h.R, 0.026 * k), seg=(10, 8))
    return g1 - d * 0.025 * k * s


def wide_hat(R, key, band, brim=0.25, crown=(0.12, 0.13, 0.085), tilt=(0.0, 0.08), lift=0.05, band_h=0.012, rim=None, peak=0.0):
    """A wide round hat: a flat brim `brim` m from the middle, a soft crown, a band round it. `tilt` (x, y) leans it.
    `peak` draws the crown up to a point (a pointed or a conical hat). Returns (fig, brim centre, its normal)."""
    f, c, r = R.head_piece()
    z = R.z
    nrm = Vector((tilt[0], tilt[1], 1)).normalized()
    rot = Vector((0, 0, 1)).rotation_difference(nrm).to_matrix().to_4x4()
    hb = Vector((0.0, c.y + 0.015, z["top"] - lift))
    f.ellipsoid(key, hb, (brim, brim * 1.03, 0.013), seg=(36, 6), rot=rot)
    if rim:
        f.torus(rim, hb, brim, 0.006, normal=nrm, seg=(44, 5))
    if peak:
        P.hull(f, key, [hb + nrm * 0.005, hb + nrm * crown[2] * 0.6, hb + nrm * (crown[2] + peak)], [crown[0], crown[0] * 0.75, 0.01],
               [crown[1], crown[1] * 0.75, 0.01], seg=22)
    else:
        f.ellipsoid(key, hb + nrm * 0.03, crown, seg=(24, 12), rot=rot)
    f.torus(band, hb + nrm * (band_h + 0.008), crown[0] * 1.01, band_h, normal=nrm, seg=(28, 6))
    return f, hb, nrm


def back_frame(R):
    """(piece bound down the back, centre of the back at the chest, chest ring (c, rx, ry), base of the neck's y)."""
    z = R.z
    cc, rxc, ryc = R.ring(z["chest"])
    return R.piece(PA.spine_w(R)), Vector((0, cc.y + ryc, z["chest"])), (cc, rxc, ryc), R.bone("neck_01").y


def shoulder_straps(R, f, key, back_y, front_y=None, r=0.012, x=0.09):
    """Two straps from a load on the back over the shoulders to under the arms."""
    z = R.z
    cc, rxc, ryc = R.ring(z["chest"])
    ny = R.bone("neck_01").y
    fy = cc.y - ryc - 0.02 if front_y is None else front_y
    for sx in (1, -1):
        f.tube(key, [Vector((x * sx, back_y, z["chest"] + 0.07)), Vector((x * 0.95 * sx, ny - 0.02, z["neck"] - 0.05)),
                     Vector((x * sx, fy, z["chest"] + 0.04)), Vector((x * 1.25 * sx, fy + 0.03, z["chest"] - 0.1))], r, seg=6, squash=((0, 1, 0), 0.35))


def basket(f, key, rim, c, r0, r1, h, bands=(), band_key=None, seg=20):
    """An upright basket or barrel: bottom ring at `c` radius r0, top radius r1, `h` tall, with rims and bands."""
    P.hull(f, key, [c, c + Vector((0, 0, h * 0.5)), c + Vector((0, 0, h))], [r0, (r0 + r1) / 2 * 1.03, r1], [r0 * 0.78, (r0 + r1) / 2 * 0.8, r1 * 0.78],
           seg=seg, side=Vector((1, 0, 0)))
    for t in (0.0, 1.0) + tuple(bands):
        rr = r0 + (r1 - r0) * t
        f.torus(rim if t in (0.0, 1.0) else (band_key or rim), c + Vector((0, 0, h * t)), rr * 1.02, 0.009, seg=(seg + 4, 5))
    return c + Vector((0, 0, h))


def veil(R, key, lining=None, edge=None, hem=None, width=0.3, spread=1.25, grow=1.3, open=0.5):
    """A veil: a hood laid over the head (open at the face) and a long drape from it down the back to `hem`."""
    z = R.z
    f, c, hr, rim = PA.hood(R, key, lining=lining, edge=edge, grow=grow, open=open, tilt=0.18, peak=0.0, edge_r=0.007)
    PA.cloak(R, key, hem=z["hip"] - 0.1 if hem is None else hem, width=width, depth=0.8, spread=spread, top_spread=1.0, lining=lining, trim=edge,
             nu=14, nv=10)
    return f, c, hr


def tray(R, key, rim, depth=0.17, width=0.2, z_off=0.0, strap=None):
    """A pedlar's tray carried at the waist in front, on a strap round the neck. Returns (fig, centre of its top)."""
    z = R.z
    cw, rxw, ryw = R.ring(z["waist"])
    f = R.piece("pelvis")
    top = Vector((0, cw.y - ryw - depth - 0.02, z["waist"] + 0.02 + z_off))
    c = top - Vector((0, 0, 0.03))
    P.box(f, key, c, (width, depth, 0.03))
    for sx in (1, -1):
        f.tube(rim, [top + Vector((width * sx, -depth, 0.004)), top + Vector((width * sx, depth, 0.004))], 0.008, seg=6)
    for sy in (1, -1):
        f.tube(rim, [top + Vector((-width, depth * sy, 0.004)), top + Vector((width, depth * sy, 0.004))], 0.008, seg=6)
    if strap:
        ny = R.bone("neck_01").y
        s = R.piece("spine_03")
        for sx in (1, -1):
            s.tube(strap, [top + Vector((width * 0.8 * sx, depth, 0.0)), Vector((0.1 * sx, cw.y - ryw - 0.05, z["chest"])), Vector((0.075 * sx, ny - 0.04, z["neck"] - 0.04)),
                           Vector((0.0, ny + 0.06, z["neck"] - 0.05))], 0.008, seg=6, squash=((0, 1, 0), 0.4))
    return f, top
