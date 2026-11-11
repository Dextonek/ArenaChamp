"""The kit for arenas of the realistic style (2026-11-11): scanned props from Poly Haven (CC0; fetched by
pipeline/tools/polyhaven-get.mjs into pipeline/assets/polyhaven/), cut down to a game's triangle and texture budget,
laid out in the game's own coordinates and written as one GLB that src/arenas/real.ts reads.

    A = Arena("harbour")
    m = A.load("wooden_barrels_01")                 # {object name: object}, textures shrunk to 512 px
    A.template("barrel", [m["wooden_barrels_01_barrel01"]], tris=1200)
    A.cover(pillar(0, 7, 0.9, 1.2))                 # an obstacle; what is `put` after it is that obstacle's mesh
    A.put("barrel", 0.3, 7.2, yaw=0.4)
    A.back()                                        # from here on: the backdrop, merged into one mesh per material
    A.finish()

Coordinates are the game's: x to the right, z toward the +z camera, y up; the ring's centre is (0, 7) and its radius
12 (docs/architecture/arenas.md has the layout rules). The heroes are 1.3 times life size, so props are placed at
`S` = 1.3 unless told otherwise. `finish` writes public/models/arenas/<name>.glb with the objects named `cover<i>`
(one per obstacle, in order) and `back`, and src/arenas/real/<name>.json with the obstacles and the `mark`ed spots.
"""
import glob
import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

S = 1.3
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ASSETS = os.path.join(REPO, "pipeline", "assets", "polyhaven")


def G(x, z, y=0.0):
    """A point of the game, in Blender (z up; the exporter turns it back)."""
    return Vector((x, -z, y))


def pillar(x, z, r, height):
    return {"kind": "pillar", "ax": x, "az": z, "bx": x, "bz": z, "r": r, "height": height}


def wall(ax, az, bx, bz, r, height):
    return {"kind": "wall", "ax": ax, "az": az, "bx": bx, "bz": bz, "r": r, "height": height}


def twin(o):
    """The same obstacle mirrored through the ring's centre (0, 7)."""
    return dict(o, ax=-o["ax"], az=14 - o["az"], bx=-o["bx"], bz=14 - o["bz"])


def _only(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


class Arena:
    def __init__(self, name):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.name = name
        self.templates = {}
        self.obstacles = []
        self.marks = []
        self.groups = {}      # group name -> [objects]
        self.group = None
        self.store = bpy.data.collections.new("library")   # templates and sources: not exported
        self.scene = bpy.context.scene

    # ---- sources ------------------------------------------------------------------------------------------------------
    def load(self, model, tex=512, normal=True, loose=()):
        """Imports a Poly Haven model. Its textures are shrunk to `tex` px; `normal=False` drops the normal maps (far
        things do not need them). Objects named in `loose` are split into their separate pieces, biggest first, as
        `<name>.0`, `<name>.1`... Returns {object name: object}, the meshes with their transforms applied."""
        before = set(bpy.data.objects)
        images = set(bpy.data.images)
        bpy.ops.import_scene.gltf(filepath=glob.glob(os.path.join(ASSETS, model, "*.gltf"))[0])
        out = {}
        for o in [o for o in bpy.data.objects if o not in before]:
            if o.type != "MESH" or not o.data.materials:
                bpy.data.objects.remove(o)
                continue
            world = o.matrix_world.copy()
            o.parent = None
            o.data.transform(world)
            o.matrix_world = Matrix.Identity(4)
            if o.name in loose:
                _only(o)
                bpy.ops.mesh.separate(type="LOOSE")
                parts = sorted(bpy.context.selected_objects, key=lambda p: -len(p.data.polygons))
                for i, p in enumerate(parts):
                    out[f"{o.name}.{i}"] = p
            else:
                out[o.name] = o
        for img in [i for i in bpy.data.images if i not in images]:
            if img.size[0] > tex:
                img.scale(tex, tex)
        if not normal:
            for o in out.values():
                for m in o.data.materials:
                    for n in [n for n in m.node_tree.nodes if n.type == "NORMAL_MAP"]:
                        m.node_tree.nodes.remove(n)
        for o in out.values():
            for c in list(o.users_collection):
                c.objects.unlink(o)
            self.store.objects.link(o)
        return out

    def flat(self, key, color, rough=0.8, metal=0.0, emit=None, strength=1.0):
        """A plain material (a rope, an iron hook, a lamp's flame)."""
        m = bpy.data.materials.new(key)
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        b.inputs["Base Color"].default_value = (*[c ** 2.2 for c in rgb], 1)
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
        if emit:
            e = [int(emit[i:i + 2], 16) / 255 for i in (1, 3, 5)]
            b.inputs["Emission Color"].default_value = (*[c ** 2.2 for c in e], 1)
            b.inputs["Emission Strength"].default_value = strength
        return m

    def template(self, key, parts, tris=None, origin="base"):
        """One reusable prop from `parts`: objects, or (object, Matrix) pairs to arrange several. Cut down to about
        `tris` triangles. Its origin goes to the middle of its base (`origin="base"`) or stays (`None`)."""
        copies = []
        for p in parts:
            src, mat = p if isinstance(p, tuple) else (p, Matrix.Identity(4))
            c = src.copy()
            c.data = src.data.copy()
            c.data.transform(mat)
            self.scene.collection.objects.link(c)
            copies.append(c)
        ob = copies[0]
        if len(copies) > 1:
            bpy.ops.object.select_all(action="DESELECT")
            for c in copies:
                c.select_set(True)
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.join()
        n = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        if tris and n > tris:
            # scans come with their vertices split along every texture seam, which stops the collapse: weld them first
            bm = bmesh.new()
            bm.from_mesh(ob.data)
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
            bm.to_mesh(ob.data)
            bm.free()
            for _ in range(3):
                now = sum(len(p.vertices) - 2 for p in ob.data.polygons)
                if now <= tris * 1.15:
                    break
                _only(ob)
                mod = ob.modifiers.new("d", "DECIMATE")
                mod.ratio = tris / now
                bpy.ops.object.modifier_apply(modifier="d")
        if origin == "base":
            pts = [v.co for v in ob.data.vertices]
            lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
            hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
            ob.data.transform(Matrix.Translation(-Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))
        for poly in ob.data.polygons:
            poly.use_smooth = True
        self.scene.collection.objects.unlink(ob)
        self.store.objects.link(ob)
        ob.name = key
        self.templates[key] = ob
        print(f"TEMPLATE {key}: {n} -> {sum(len(p.vertices) - 2 for p in ob.data.polygons)} triangles")
        return ob

    def size(self, key):
        pts = [v.co for v in self.templates[key].data.vertices]
        return Vector((max(p.x for p in pts) - min(p.x for p in pts), max(p.y for p in pts) - min(p.y for p in pts), max(p.z for p in pts)))

    # ---- layout -------------------------------------------------------------------------------------------------------
    def cover(self, obstacle):
        """The next obstacle: what is put after this is its mesh."""
        self.obstacles.append(obstacle)
        self.group = f"cover{len(self.obstacles) - 1}"
        return obstacle

    def back(self, group="back"):
        self.group = group

    def mark(self, kind, x, z, y=0.0):
        """A spot the game should know (a lantern's flame, a vent): written to the json as {kind, x, y, z}."""
        self.marks.append({"kind": kind, "x": round(x, 3), "y": round(y, 3), "z": round(z, 3)})

    def put(self, key, x, z, yaw=0.0, scale=S, y=0.0, tilt=(0.0, 0.0), stretch=(1.0, 1.0, 1.0)):
        """A copy of template `key` standing at the game's (x, z), turned `yaw` about the vertical, `tilt`ed about its
        own x and y axes first (radians)."""
        src = self.templates[key]
        ob = src.copy()
        ob.data = src.data.copy()
        self.scene.collection.objects.link(ob)
        sc = scale if isinstance(scale, (tuple, list)) else (scale,) * 3
        m = (Matrix.Translation(G(x, z, y)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(tilt[1], 4, "Y") @ Matrix.Rotation(tilt[0], 4, "X")
             @ Matrix.Diagonal((sc[0] * stretch[0], sc[1] * stretch[1], sc[2] * stretch[2], 1)))
        ob.data.transform(m)
        ob.data.update()
        self.groups.setdefault(self.group, []).append(ob)
        return ob

    # ---- out ----------------------------------------------------------------------------------------------------------
    def finish(self):
        out = []
        for name, obs in self.groups.items():
            ob = obs[0]
            if len(obs) > 1:
                bpy.ops.object.select_all(action="DESELECT")
                for o in obs:
                    o.select_set(True)
                bpy.context.view_layer.objects.active = ob
                bpy.ops.object.join()
            ob.name = name
            out.append(ob)
        bpy.ops.object.select_all(action="DESELECT")
        for o in out:
            o.select_set(True)
        glb = os.path.join(REPO, "public", "models", "arenas", f"{self.name}.glb")
        bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_yup=True, export_animations=False,
                                  export_cameras=False, export_lights=False, export_image_format="JPEG", export_image_quality=78,
                                  export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=True, export_vertex_color="NONE")
        os.makedirs(os.path.join(REPO, "src", "arenas", "real"), exist_ok=True)
        with open(os.path.join(REPO, "src", "arenas", "real", f"{self.name}.json"), "w", newline="\n") as f:
            json.dump({"obstacles": self.obstacles, "marks": self.marks}, f, indent=1)
            f.write("\n")
        tris = sum(len(p.vertices) - 2 for o in out for p in o.data.polygons)
        mats = {m.name for o in out for m in o.data.materials}
        print(f"WROTE {glb} {round(os.path.getsize(glb) / 1024)} KB, {tris} triangles, {len(mats)} materials, {len(out)} objects")
        return out

    def render(self, path, size=(1100, 700), floor="#2a2c30", sea=None):
        """A check picture of the layout from the game's +z camera and from above (not the game's look: no water, no
        night). Call after `finish`."""
        sc = self.scene
        sc.render.engine = "BLENDER_EEVEE"
        sc.render.image_settings.file_format = "JPEG"
        w = bpy.data.worlds.new("w")
        w.use_nodes = True
        w.node_tree.nodes["Background"].inputs[0].default_value = (0.35, 0.42, 0.5, 1)
        sc.world = w
        sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
        sun.data.energy = 3.5
        sun.rotation_euler = (math.radians(55), 0, math.radians(-40))
        sc.collection.objects.link(sun)
        bpy.ops.mesh.primitive_circle_add(vertices=96, radius=12, fill_type="NGON", location=G(0, 7, 0))
        bpy.context.object.data.materials.append(self.flat("_floor", floor))
        if sea is not None:
            bpy.ops.mesh.primitive_plane_add(size=400, location=G(0, 7, sea))
            bpy.context.object.data.materials.append(self.flat("_sea", "#1c3a44", rough=0.2))
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        cam.data.lens = 28
        sc.collection.objects.link(cam)
        sc.camera = cam
        for tag, pos, look in (("cam", G(0, 28, 17), G(0, 6, 0)), ("top", G(0.01, 7, 62), G(0, 7, 0)), ("side", G(34, 26, 12), G(0, 7, 2))):
            cam.location = pos
            cam.rotation_euler = (look - pos).to_track_quat("-Z", "Y").to_euler()
            sc.render.resolution_x, sc.render.resolution_y = size
            sc.render.filepath = f"{path}_{tag}.jpg"
            bpy.ops.render.render(write_still=True)
