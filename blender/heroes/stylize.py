"""
Proportion styles for the built hero figures (hero_figures.build, look key "style"). A style scales the rig's bones
in pose mode, bakes that pose into every skinned mesh and applies it as the new rest pose, so the exported figure
keeps the same bones, names and rest orientations (src/effects/weapons/hero.ts poses on top of the rest pose) with
new proportions. Props skinned to a bone scale with it.

Run inside Blender through hero_figures (build / export / preview); see docs/architecture/models.md.
"""
import bpy

# Bone scale per style, in bone space: x across, y along the bone (length), z depth. Bones not listed keep 1.
# `own` bones ignore their parent's scale (a broad chest must not stretch the head or the arms sideways); the
# parent still carries them to their new place.
STYLES = {
    # Chunky hero: a big head and hands, a broad chest and shoulders, thick limbs, short sturdy legs, big feet.
    "chunky": {
        "pelvis": (1.15, 1.0, 1.1),
        "chest": (1.24, 0.94, 1.14),
        "neck": (1.15, 0.6, 1.15),
        "head": (1.42, 1.42, 1.42),
        "upper_arm": (1.3, 0.94, 1.3),
        "forearm": (1.28, 0.94, 1.28),
        "hand": (1.6, 1.6, 1.6),
        "thigh": (1.26, 0.82, 1.26),
        "shin": (1.24, 0.82, 1.24),
        "foot": (1.35, 1.35, 1.35),
    },
}
OWN = ("neck", "head", "upper_arm", "forearm", "hand", "thigh", "shin", "foot")
# Vertex group hero_figures puts on every prop (a staff, a crown): props on a uniformly scaled bone (hand, head, foot)
# are shrunk back to PROP_SIZE times their old size, so a big hand doesn't make a staff poke through the floor.
PROP_GROUP = "_prop"
PROP_SIZE = {"chunky": 1.15}


def _key(bone_name):
    return bone_name.split(".")[0]


def apply(coll, style):
    """Gives the figure in `coll` the proportions of `style` (a key of STYLES). Returns the new height in metres."""
    scales = STYLES[style]
    arm = next(o for o in coll.objects if o.type == "ARMATURE")
    meshes = [o for o in coll.objects if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)]
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    saved = {b.name: b.inherit_scale for b in arm.data.bones}
    for b in arm.data.bones:
        if _key(b.name) in OWN:
            b.inherit_scale = "NONE"
    for pb in arm.pose.bones:
        s = scales.get(_key(pb.name))
        if s:
            pb.scale = s
    bpy.context.view_layer.update()

    # Bake the posed shape into each mesh (vertex groups kept), then make the pose the rest pose.
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in meshes:
        new = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        old = ob.data
        new.materials.clear()
        for m in old.materials:
            new.materials.append(m)
        ob.data = new
        if old.users == 0:
            bpy.data.meshes.remove(old)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    for b in arm.data.bones:
        b.inherit_scale = saved[b.name]
    _resize_props(arm, meshes, scales, PROP_SIZE.get(style, 1.0))
    bpy.context.view_layer.update()
    return max(v.co.z for ob in meshes for v in ob.data.vertices)


def _resize_props(arm, meshes, scales, size):
    """Scales prop vertices on a uniformly scaled bone about that bone's head, to `size` times their old size."""
    for ob in meshes:
        tag = ob.vertex_groups.get(PROP_GROUP)
        if not tag:
            continue
        names = {g.index: g.name for g in ob.vertex_groups}
        for v in ob.data.vertices:
            gs = [(g.weight, names[g.group]) for g in v.groups]
            if not any(n == PROP_GROUP and w > 0.5 for w, n in gs):
                continue
            bones = [(w, n) for w, n in gs if n in arm.data.bones]
            if not bones:
                continue
            bone = max(bones)[1]
            s = scales.get(_key(bone))
            if not s or abs(s[0] - s[1]) > 1e-6 or abs(s[0] - s[2]) > 1e-6:
                continue
            pivot = arm.data.bones[bone].head_local
            v.co = pivot + (v.co - pivot) * (size / s[0])


def drop_prop_group(coll):
    """Removes the prop tag before export (it is no bone)."""
    for ob in coll.objects:
        g = ob.vertex_groups.get(PROP_GROUP) if ob.type == "MESH" else None
        if g:
            ob.vertex_groups.remove(g)
