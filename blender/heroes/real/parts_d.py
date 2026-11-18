"""Shared parts of the revamps (docs/lore/codex/revamp.md, 2026-11-15): the marks of a hero's people built on the pack's
body. Crystal grown out of the skin (Opaline, Gloaming folk), cracks of light along the skin (Brannoc, Kilnborn),
antlers (Hank, Wood folk). Each is placed from the body's own surface (`Real.surface`), at the pack body's own size.
(Grandma Ironknit's ears are built in real/yarn.py the way the twins' are, real/parts_c.py.)"""
import math
import random

from mathutils import Vector

from realkit import PI
from real.parts_b import shard


def V(x, y, z):
    return Vector((x, y, z))


def frame(n):
    """Two directions square to `n` and to each other."""
    n = Vector(n).normalized()
    u = (V(0, 0, 1) if abs(n.z) < 0.9 else V(1, 0, 0)).cross(n).normalized()
    return u, n.cross(u).normalized()


def crystals(f, key, c, n, size, count=4, lean=0.45, bias=(0, 0, 0), seed=0, sink=0.3, thick=0.2, faces=6, spread=0.3):
    """A cluster of crystals grown out of a surface at `c` (normal `n`): the first and longest straight out, the others
    leaning round it. `size` the longest one's length; `bias` leans the whole cluster (up, outward); `sink` how much of
    each is under the surface; `thick` the width against the length."""
    rnd = random.Random(seed)
    n = (Vector(n).normalized() + Vector(bias)).normalized()
    u, v = frame(n)
    for k in range(count):
        ang = 2 * PI * k / max(1, count - 1) + rnd.uniform(-0.5, 0.5)
        side = u * math.cos(ang) + v * math.sin(ang)
        tilt = 0.0 if k == 0 else rnd.uniform(lean * 0.5, lean)
        d = (n + side * tilt).normalized()
        L = size * (1.0 if k == 0 else rnd.uniform(0.4, 0.75))
        base = c + (side * size * spread * rnd.uniform(0.5, 1.0) if k else Vector())
        shard(f, key, base - d * L * sink, base + d * L * (1 - sink), L * thick, n=faces, mid=0.28 + 0.1 * rnd.random())


def on_skin(R, p, way, out=0.0):
    """The body's surface hit from `p` toward `way`, pushed `out` along its normal: (point, normal), or (p, -way)."""
    hit, nrm = R.surface(p, way)
    if hit is None:
        return Vector(p), -Vector(way).normalized()
    return hit + nrm * out, nrm


def crack(R, f, key, pts, way, r=0.004, out=0.0025, jag=0.012, seed=0, steps=3, flat=0.45):
    """A crack of light on the skin through `pts` (seen along `way`): each leg broken into `steps` jagged bits, every
    point laid on the surface and lifted `out`. A flat tube, so it reads as a line drawn on the skin, not a cord."""
    rnd = random.Random(seed)
    way = Vector(way).normalized()
    path = []
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b)
        for s in range(steps):
            t = s / steps
            q = a.lerp(b, t)
            if s:
                q += Vector((rnd.uniform(-jag, jag), rnd.uniform(-jag, jag), rnd.uniform(-jag, jag))) * 0.6
            path.append(q)
    path.append(Vector(pts[-1]))
    laid = []
    for q in path:
        hit, nrm = R.surface(q - way * 0.4, way)
        if hit is not None:
            laid.append((hit + nrm * out, nrm))
    if len(laid) < 2:
        return 0
    radii = [r * (0.45 if i in (0, len(laid) - 1) else rnd.uniform(0.8, 1.15)) for i in range(len(laid))]
    avg = sum((n for _, n in laid), Vector()).normalized()
    f.tube(key, [p for p, _ in laid], radii, seg=5, squash=(avg, flat))
    return len(laid)


def antler(f, key, base, up, out, length, r0, r1, tines, curve=0.25, seg=7, saw=None):
    """One antler from `base`: the beam rises along `up`, sweeps back and `out`; `tines` are (t along the beam, length,
    lean forward, lean out). Every tip is cut flat (`saw` the cap's material: the pale cut wood of a sawn tine)."""
    up, out = Vector(up).normalized(), Vector(out).normalized()
    back = up.cross(out).normalized()
    if back.y < 0:
        back = -back
    n = 9
    beam = []
    for i in range(n + 1):
        t = i / n
        p = base + up * length * t + out * length * (0.35 * t + 0.12 * t * t) + back * length * curve * t * t
        beam.append(p)
    radii = [r0 + (r1 - r0) * (i / n) for i in range(n + 1)]
    f.tube(key, beam, radii, seg=seg)
    if saw:
        tip_d = (beam[-1] - beam[-2]).normalized()
        f.tube(saw, [beam[-1] - tip_d * 0.003, beam[-1] + tip_d * 0.004], radii[-1] * 1.02, seg=seg)
    for t, ln, fw, ow in tines:
        i = min(n - 1, max(1, round(t * n)))
        p = beam[i]
        bd = (beam[i + 1] - beam[i - 1]).normalized()
        d = (bd * 0.45 + (-back) * fw + out * ow + up * 0.5).normalized()
        rr = radii[i] * 0.72
        q1 = p + d * ln * 0.55
        d2 = (d + up * 0.4).normalized()
        q2 = q1 + d2 * ln * 0.45
        f.tube(key, [p - d * rr, q1, q2], [rr, rr * 0.82, rr * 0.66], seg=seg)
        if saw:
            f.tube(saw, [q2 - d2 * 0.003, q2 + d2 * 0.004], rr * 0.68, seg=seg)


# ---- marks painted at the texture's own resolution (added 2026-11-16 for the touches) ---------------------------------
def paint_px(R, fn, color, alpha=1.0, groups=None, near=None):
    """Paints the skin's texture texel by texel: each texel's own place on the body (at the pack body's size) is found
    from its triangle, and `fn(P)` (P an (n, 3) numpy array) returns its weight 0..1, blended toward `color` by weight *
    alpha. `R.paint` weighs vertices and blends across faces, which smears a thin line where the mesh is coarse (Hank's
    freckles); this draws a 2 mm star line or a kohl wing as sharp as the 1K texture allows. Only faces whose vertices
    lead with a bone named in `groups` (prefixes), and lie within `near` = (centre, radius) if given, are drawn."""
    import numpy as np
    body = R.body
    nt = body.data.materials[0].node_tree
    img = next(n.image for n in nt.nodes if n.type == "TEX_IMAGE" and n.image and not any(k in n.image.name for k in ("Normal", "Roughness")))
    W, H = img.size
    px = np.empty(W * H * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(H, W, 4)
    h = color.lstrip("#")
    col = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)
    uvs = body.data.uv_layers.active.data
    acc = np.zeros((H, W), dtype=np.float32)
    world, dom = R.world, R.dom
    for poly in body.data.polygons:
        ids = list(poly.vertices)
        if groups and not any(dom[i].startswith(tuple(groups)) for i in ids):
            continue
        if near and min((world[i] - near[0]).length for i in ids) > near[1]:
            continue
        loops = list(poly.loop_indices)
        for k in range(1, len(ids) - 1):
            tri = (0, k, k + 1)
            P = np.array([(uvs[loops[t]].uv[0] * W, uvs[loops[t]].uv[1] * H) for t in tri], dtype=np.float64)
            X = np.array([tuple(world[ids[t]]) for t in tri], dtype=np.float64)
            x0, y0 = int(max(0, np.floor(P[:, 0].min()))), int(max(0, np.floor(P[:, 1].min())))
            x1, y1 = int(min(W - 1, np.ceil(P[:, 0].max()))), int(min(H - 1, np.ceil(P[:, 1].max())))
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            (ax, ay), (bx, by), (cx, cy) = P
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-9:
                continue
            l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den
            l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / den
            l3 = 1 - l1 - l2
            e = -0.6 / max(1.0, abs(den)) ** 0.5
            inside = (l1 >= e) & (l2 >= e) & (l3 >= e)
            if not inside.any():
                continue
            pts = l1[inside, None] * X[0] + l2[inside, None] * X[1] + l3[inside, None] * X[2]
            val = np.clip(np.asarray(fn(pts), dtype=np.float64), 0, 1)
            sub = acc[y0:y1 + 1, x0:x1 + 1]
            cur = sub[inside]
            sub[inside] = np.maximum(cur, val)
    a = (acc * alpha)[..., None]
    px[..., :3] = px[..., :3] * (1 - a) + col * a
    img.pixels.foreach_set(px.reshape(-1))
    img.update()


def line_w(P, pts, width, soft=0.6):
    """Weight of points P (n, 3) by their distance to the polyline `pts`: 1 within `width`/2, fading over `soft` of it."""
    import numpy as np
    d = np.full(len(P), 1e9)
    for a, b in zip(pts, pts[1:]):
        a, b = np.array(tuple(a)), np.array(tuple(b))
        ab = b - a
        t = np.clip(((P - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
        d = np.minimum(d, np.linalg.norm(P - (a + t[:, None] * ab), axis=1))
    h = width / 2
    return np.clip(1 - (d - h * (1 - soft)) / (h * soft * 2 + 1e-9), 0, 1)


def dot_w(P, c, r):
    """Weight of points P by their distance to `c`: a small round dot of radius `r`, its edge soft."""
    import numpy as np
    d = np.linalg.norm(P - np.array(tuple(c)), axis=1)
    return np.clip((r - d) / (r * 0.35) + 0.5, 0, 1)


def on_face(R, x, z, back=0.4):
    """The skin's point in front of the face at side `x` and height `z` (pack size): a ray from the front."""
    hit, _ = R.surface(Vector((x, -back, z)), Vector((0, 1, 0)))
    return hit if hit is not None else Vector((x, -0.1, z))


def on_side(R, x, y, z, out=0.4):
    """The skin's point at depth `y` and height `z` on the side of `x`'s sign (the jaw, the temple): a ray from that side."""
    s = 1 if x >= 0 else -1
    hit, _ = R.surface(Vector((s * out, y, z)), Vector((-s, 0, 0)))
    return hit if hit is not None else Vector((x, y, z))


def star_lines(R, color="#1c2742", width=0.003, dots=0.0036, alpha=0.9, ticks=False, seed=0):
    """The Northerners' star lines (docs/lore/codex/peoples/north.md): fine blue-black lines along each side of the jaw,
    from below the ear toward the chin, with a star (a dot) at each bend: the sky at the hour of their birth. With
    `ticks`, short marks across the line like a clock's minute ticks (Tempo)."""
    import numpy as np
    rnd = random.Random(seed)
    eye, half = R.eye_box()
    jaw = []
    # the jaw's edge on the pack's head (measured 2026-11-16, eye-relative, both bodies alike): below the ear at the back,
    # the angle of the jaw, along it to beside the chin; drawn a little above the edge, on the face's side
    edge = [(0.060, 0.094, -0.058), (0.058, 0.078, -0.072), (0.052, 0.056, -0.083), (0.043, 0.034, -0.090), (0.030, 0.016, -0.095)]
    for s in (1, -1):
        pts = []
        for x, dy, dz in edge:
            q = Vector((s * x, eye.y + dy, eye.z + dz))
            way = Vector((s, -0.35 * (1 - dy / 0.1), 0)).normalized()
            hit, _ = R.surface(q + way * 0.15, -way)
            pts.append(hit if hit is not None and (hit - q).length < 0.03 else q)
        jaw.append(pts)
    stars = []
    for pts in jaw:
        for i in (0, 2, 4):
            stars.append(pts[i])

    def fn(P):
        w = np.zeros(len(P))
        for pts in jaw:
            w = np.maximum(w, line_w(P, pts, width))
            if ticks:
                for a, b in zip(pts, pts[1:]):
                    m = (a + b) / 2
                    d = (b - a).normalized()
                    across = d.cross(Vector((m.x, 0, 0)).normalized()).normalized() * 0.005
                    w = np.maximum(w, line_w(P, [m - across, m + across], width * 0.8))
        if dots > 0:
            for c in stars:
                w = np.maximum(w, dot_w(P, c, dots))
        return w
    paint_px(R, fn, color, alpha, groups=("Head", "neck_01"))
    return jaw


def hand_lines(R, color="#1c2742", width=0.0022, alpha=0.9, seed=0, sides="lr"):
    """Star lines on the backs of the hands: from the wrist toward the knuckles of the middle fingers, with stars."""
    import numpy as np
    rnd = random.Random(seed)
    lines, stars = [], []
    for n in sides:
        w, m = R.bone(f"hand_{n}"), R.bone(f"middle_01_{n}")
        ax = (m - w)
        for off in (-0.014, 0.0, 0.014):
            side = ax.cross(Vector((0, 0, 1))).normalized() * off
            pts = []
            for t in (0.3, 0.55, 0.85):
                q = w + ax * t + side + Vector((0, 0, 0.08))
                hit, _ = R.surface(q, Vector((0, 0, -1)))
                if hit is not None:
                    pts.append(hit)
            if len(pts) >= 2:
                lines.append(pts)
                stars.append(pts[rnd.randrange(len(pts))])

    def fn(P):
        w = np.zeros(len(P))
        for pts in lines:
            w = np.maximum(w, line_w(P, pts, width))
        for c in stars:
            w = np.maximum(w, dot_w(P, c, width * 1.5))
        return w
    paint_px(R, fn, color, alpha, groups=("hand_", "index", "middle", "ring", "pinky", "thumb"))
    return lines


def back_of_head(R, x, z, out=0.0):
    """The skull's skin at the back of the head at side `x` and height `z` (a ray from behind), pushed `out` backward."""
    hit, _ = R.surface(Vector((x, 0.6, z)), Vector((0, -1, 0)))
    if hit is None:
        return None
    return hit + Vector((0, out, 0))


def _pack_png(R):
    """The pack's own skin texture for this body, top-down rows, at its own size (numpy, 0..1)."""
    import os
    import numpy as np
    import bpy
    from realkit import BODY
    path = os.path.join(R.pack, "Base Characters", "Textures", BODY[R.sex][1])
    src = bpy.data.images.load(path, check_existing=False)
    sw, sh = src.size
    a = np.empty(sw * sh * 4, dtype=np.float32)
    src.pixels.foreach_get(a)
    bpy.data.images.remove(src)
    return a.reshape(sh, sw, 4)[::-1, :, :3]   # top-down


def _skin_img(R):
    nt = R.body.data.materials[0].node_tree
    return next(n.image for n in nt.nodes if n.type == "TEX_IMAGE" and n.image and not any(k in n.image.name for k in ("Normal", "Roughness")))


def lips(R, color, alpha=0.85):
    """The lips recoloured (the Gloaming folk's dark lips): found in the pack's texture by their hue (redder than the skin
    round them, under 20 degrees), inside the mouth's box of the face island, measured on both bodies 2026-11-16."""
    import numpy as np
    a = _pack_png(R)
    img = _skin_img(R)
    W, H = img.size
    f = a.shape[1] // W
    if f > 1:
        a = a.reshape(H, f, W, f, 3).mean(axis=(1, 3))
    y0, y1, x0, x1 = (int(v * W / 1024) for v in (240, 300, 140, 240))
    box = a[y0:y1, x0:x1]
    g, b = box[..., 1], box[..., 2]
    mx, mn = box.max(axis=2), box.min(axis=2)
    hue = np.where(mx > mn, ((g - b) / np.maximum(mx - mn, 1e-6)) * 60.0, 0.0)   # red is the largest channel here
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    w = np.clip((21.0 - hue) / 3.0, 0, 1) * np.clip((sat - 0.45) / 0.08, 0, 1)
    px = np.empty(W * H * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(H, W, 4)[::-1].copy()   # top-down
    h = color.lstrip("#")
    col = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)
    sub = px[y0:y1, x0:x1, :3]
    # keep the lips' own shading: the colour times the lip's lightness against its mean
    lum = sub.mean(axis=2, keepdims=True)
    shade = lum / max(float((lum[..., 0] * w).sum() / max(w.sum(), 1e-6)), 1e-4)
    k = (w * alpha)[..., None]
    px[y0:y1, x0:x1, :3] = sub * (1 - k) + np.clip(col * shade, 0, 1) * k
    img.pixels.foreach_set(np.ascontiguousarray(px[::-1]).reshape(-1))
    img.update()


def eye_frame(R):
    """(left eye centre, right eye centre, eye radius) on the face, at the pack body's size; the centres at the eyes' front."""
    vs = [R.eyes.matrix_world @ v.co for v in R.eyes.data.vertices]
    L = [v for v in vs if v.x > 0]
    Rt = [v for v in vs if v.x < 0]
    cl = sum(L, Vector()) / len(L)
    cr = sum(Rt, Vector()) / len(Rt)
    rad = (max(v.z for v in L) - min(v.z for v in L)) / 2
    front = min(v.y for v in vs)
    cl.y = cr.y = front
    return cl, cr, rad


def kohl(R, color="#14100e", alpha=0.85, wing=0.03, width=0.0032):
    """Kohl round both eyes and drawn out to the temples (the Dune folk's): a line along the upper and the lower lid
    meeting in a wing that sweeps back toward the temple."""
    import numpy as np
    cl, cr, rad = eye_frame(R)
    lines = []
    for c in (cl, cr):
        s = 1 if c.x > 0 else -1
        rx, rz = rad * 1.3, rad * 0.62   # the lids' opening, not the eyeball's size
        up, lo = [], []
        for k in range(9):
            t = -1 + 2 * k / 8
            up.append(Vector((c.x + s * t * rx, c.y, c.z + 0.001 + rz * math.sqrt(max(0.0, 1 - t * t)))))
            lo.append(Vector((c.x + s * t * rx, c.y, c.z - 0.001 - rz * 0.75 * math.sqrt(max(0.0, 1 - t * t)))))
        tip = Vector((c.x + s * (rx + wing), c.y + wing * 0.8, c.z + wing * 0.3))
        lines.append(up + [tip])
        lines.append(lo + [tip])
    laid = []
    for pts in lines:
        out = []
        for p in pts:
            way = Vector((0.35 * (1 if p.x > 0 else -1), 1, 0)).normalized()
            hit, _ = R.surface(p - way * 0.2, way)
            out.append(hit if hit is not None and (hit - p).length < 0.04 else p)
        laid.append(out)

    def fn(P):
        w = np.zeros(len(P))
        for pts in laid:
            n = len(pts)
            for j, (a, b) in enumerate(zip(pts, pts[1:])):
                t = j / max(1, n - 2)   # thicker toward the outer corner and the wing
                w = np.maximum(w, line_w(P, [a, b], width * (0.6 + 0.9 * t)))
        return w
    paint_px(R, fn, color, alpha, groups=("Head",))


def henna(R, color="#7a2c14", alpha=0.75, sides="lr", width=0.0022):
    """Henna on the backs of the hands: a vine from the wrist to the knuckles of the middle finger with small leaves (dots)
    either side of it, and a row of dots across the wrist."""
    import numpy as np
    lines, dots = [], []
    for n in sides:
        w, m = R.bone(f"hand_{n}"), R.bone(f"middle_01_{n}")
        ax = m - w
        side = ax.cross(Vector((0, 0, 1))).normalized()
        pts = []
        for t in (0.0, 0.25, 0.5, 0.75, 0.95):
            q = w + ax * t + side * 0.006 * math.sin(t * 9) + Vector((0, 0, 0.08))
            hit, _ = R.surface(q, Vector((0, 0, -1)))
            if hit is not None:
                pts.append(hit)
        if len(pts) > 1:
            lines.append(pts)
            for p in pts[1:-1]:
                for sgn in (1, -1):
                    q = p + side * 0.009 * sgn + Vector((0, 0, 0.08))
                    hit, _ = R.surface(q, Vector((0, 0, -1)))
                    if hit is not None:
                        dots.append((hit, 0.0028))
        for k in range(7):
            q = w + side * (-0.027 + 0.009 * k) + Vector((0, 0, 0.08)) - ax * 0.05
            hit, _ = R.surface(q, Vector((0, 0, -1)))
            if hit is not None:
                dots.append((hit, 0.0022))

    def fn(P):
        out = np.zeros(len(P))
        for pts in lines:
            out = np.maximum(out, line_w(P, pts, width))
        for c, r in dots:
            out = np.maximum(out, dot_w(P, c, r))
        return out
    paint_px(R, fn, color, alpha, groups=("hand_", "index", "middle", "ring", "pinky", "thumb", "lowerarm"))


def tide_lines(R, color="#24609e", alpha=0.85, count=9, t0=0.16, t1=0.84, width=0.0034, sides="lr"):
    """The Coast folk's tide lines (as Kaia's, docs/lore/codex/peoples/coast.md): thin blue rings round the forearms, one
    for each great flood lived through; drawn texel by texel."""
    import numpy as np
    arms = []
    for n in sides:
        e, w = R.bone(f"lowerarm_{n}"), R.bone(f"hand_{n}")
        arms.append((np.array(tuple(e)), np.array(tuple((w - e).normalized())), (w - e).length))
    lines = [t0 + (t1 - t0) * k / max(1, count - 1) for k in range(count)]

    def fn(P):
        out = np.zeros(len(P))
        for e, ax, ln in arms:
            rel = P - e
            along = rel @ ax
            t = along / ln
            radial = np.linalg.norm(rel - np.outer(along, ax), axis=1)
            near = radial < 0.07
            for ti in lines:
                d = np.abs(t - ti) * ln
                out = np.maximum(out, np.where(near, np.clip(1 - (d - width * 0.3) / (width * 0.5), 0, 1), 0))
        return out
    paint_px(R, fn, color, alpha, groups=("lowerarm",))


def dawn_line(R, color="#d9a640", alpha=0.95, width=0.0028):
    """The Aubade folk's dawn line: a thin gold line from the middle of the brow down the bridge of the nose."""
    import numpy as np
    eye, half = R.eye_box()
    pts = []
    for dz in (0.05, 0.03, 0.012, -0.006):
        hit, _ = R.surface(Vector((0, -0.4, eye.z + dz)), Vector((0, 1, 0)))
        if hit is not None:
            pts.append(hit)

    def fn(P):
        return np.maximum(line_w(P, pts, width), dot_w(P, pts[0], width * 1.1))
    paint_px(R, fn, color, alpha, groups=("Head",))


def freckles(R, color="#8a4a2a", alpha=0.6, count=46, seed=7):
    """Small freckles across the nose and the upper cheeks."""
    import numpy as np
    rnd = random.Random(seed)
    eye, half = R.eye_box()
    dots = []
    for _ in range(count):
        x = rnd.uniform(-0.06, 0.06)
        z = eye.z - 0.012 - rnd.uniform(0.0, 0.03) - 0.25 * abs(x) * rnd.random()
        if abs(x) < 0.012 and z > eye.z - 0.02:
            continue
        hit, _ = R.surface(Vector((x, -0.4, z)), Vector((0, 1, 0)))
        if hit is not None:
            dots.append((hit, rnd.uniform(0.0011, 0.0019)))

    def fn(P):
        out = np.zeros(len(P))
        for c, r in dots:
            out = np.maximum(out, dot_w(P, c, r))
        return out
    paint_px(R, fn, color, alpha, groups=("Head",))


def ember_skin(R, strength=0.22, edges="#ffcf7a", edge_alpha=0.55):
    """An Ember's skin (docs/lore/codex/peoples/fallborn.md): lit faintly from within by its own texture as emission (the
    same image, so no size), and brighter and golder at its edges, the jaw's line, the hairline and the fingertips,
    painted, so they glow more. Kept low: under the floor's glow."""
    import numpy as np
    eye, half = R.eye_box()
    nt = R.body.data.materials[0].node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = next(n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image and not any(k in n.image.name for k in ("Normal", "Roughness")))
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = strength
    jaw = []
    for s in (1, -1):
        pts = []
        for x, dy, dz in ((0.060, 0.094, -0.06), (0.056, 0.074, -0.08), (0.047, 0.048, -0.095), (0.03, 0.02, -0.105), (0.0, 0.006, -0.112)):
            q = Vector((s * x, eye.y + dy, eye.z + dz))
            way = Vector((s, -0.3, -0.6)).normalized()
            hit, _ = R.surface(q + way * 0.15, -way)
            pts.append(hit if hit is not None and (hit - q).length < 0.03 else q)
        jaw.append(pts)
    line = []
    for k in range(13):
        a = -1.25 + 2.5 * k / 12
        q = Vector((0.085 * math.sin(a), eye.y + 0.09 - 0.09 * math.cos(a), eye.z + 0.062 + 0.012 * math.cos(a)))
        way = Vector((math.sin(a), -math.cos(a), 0.2)).normalized()
        hit, _ = R.surface(q + way * 0.15, -way)
        if hit is not None:
            line.append(hit)
    tips = [R.bone(f"{f}_03_{n}") for f in ("index", "middle", "ring", "pinky", "thumb") for n in "lr"]

    def fn(P):
        out = np.zeros(len(P))
        for pts in jaw:
            out = np.maximum(out, line_w(P, pts, 0.012, soft=0.95))
        if len(line) > 1:
            out = np.maximum(out, line_w(P, line, 0.014, soft=0.95))
        for c in tips:
            out = np.maximum(out, dot_w(P, c, 0.022) * 0.9)
        return out
    paint_px(R, fn, edges, edge_alpha, groups=("Head", "neck_01", "index", "middle", "ring", "pinky", "thumb"))


def knuckle_seams(R, strength=0.45):
    """The Kilnborn's ember seams at the knuckles, kept dim (Brannoc's are 0.7 and cross his chest; a worker's are a
    faint line of light over each hand's knuckles and a short one down the back of the hand)."""
    R.mat("seam", "#ff8a3c", rough=0.5, emit="#ff5a14", strength=strength)
    f = R.piece("near")
    down = Vector((0, 0, -1))
    for k, n in enumerate("lr"):
        knuck = [R.bone(f"{g}_01_{n}") + Vector((0, 0, 0.012)) for g in ("index", "middle", "ring", "pinky")]
        crack(R, f, "seam", [knuck[0], knuck[1], knuck[2], knuck[3]], down, r=0.0028, out=0.0018, jag=0.004, seed=40 + k, steps=2)
        w, m = R.bone(f"hand_{n}"), R.bone(f"middle_01_{n}")
        crack(R, f, "seam", [m.lerp(w, 0.1) + Vector((0, 0, 0.02)), m.lerp(w, 0.55) + Vector((0, 0, 0.02))], down, r=0.0024, out=0.0018,
              jag=0.005, seed=50 + k, steps=2)
