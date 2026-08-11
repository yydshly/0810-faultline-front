from __future__ import annotations

import math
from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = PROJECT_ROOT / "assets" / "3d" / "ff_rif_01"
SOURCE_BLEND = ASSET_DIR / "ff_rif_01_v1_source.blend"
OUTPUT_BLEND = ASSET_DIR / "ff_rif_01_v1.blend"
OUTPUT_GLB = ASSET_DIR / "ff_rif_01_v1.glb"
OUTPUT_PREVIEW = ASSET_DIR / "ff_rif_01_v1_preview.png"

MEMBERS = {
    "lead": (0.0, -0.5),
    "left": (-0.48, 0.3),
    "right": (0.48, 0.3),
}
CLIP_NAMES = ("rifle_idle", "rifle_run", "rifle_aim", "rifle_fire", "rifle_hit", "rifle_death")


def member_bone(member: str, part: str) -> str:
    return f"rig_{member}_{part}"


def create_armature(collection: bpy.types.Collection, squad: bpy.types.Object) -> bpy.types.Object:
    armature_data = bpy.data.armatures.new("FF_RIF_01_Rig")
    armature = bpy.data.objects.new("rifle_squad_armature", armature_data)
    collection.objects.link(armature)
    armature.parent = squad
    armature.show_in_front = True
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for member, (offset_x, offset_y) in MEMBERS.items():
        root = armature_data.edit_bones.new(member_bone(member, "root"))
        root.head = (offset_x, offset_y, 0.02)
        root.tail = (offset_x, offset_y, 0.72)

        pelvis = armature_data.edit_bones.new(member_bone(member, "pelvis"))
        pelvis.head = (offset_x, offset_y, 0.68)
        pelvis.tail = (offset_x, offset_y, 0.98)
        pelvis.parent = root

        torso = armature_data.edit_bones.new(member_bone(member, "torso"))
        torso.head = (offset_x, offset_y, 0.94)
        torso.tail = (offset_x, offset_y, 1.44)
        torso.parent = pelvis

        head = armature_data.edit_bones.new(member_bone(member, "head"))
        head.head = (offset_x, offset_y, 1.4)
        head.tail = (offset_x, offset_y, 1.78)
        head.parent = torso

        for side, sign in (("leg_l", -1), ("leg_r", 1)):
            leg = armature_data.edit_bones.new(member_bone(member, side))
            leg.head = (offset_x + sign * 0.13, offset_y, 0.72)
            leg.tail = (offset_x + sign * 0.13, offset_y, 0.1)
            leg.parent = pelvis

        for side, sign in (("arm_l", -1), ("arm_r", 1)):
            arm = armature_data.edit_bones.new(member_bone(member, side))
            arm.head = (offset_x + sign * 0.28, offset_y - 0.01, 1.34)
            arm.tail = (offset_x + sign * 0.4, offset_y - 0.06, 0.98)
            arm.parent = torso

        weapon = armature_data.edit_bones.new(member_bone(member, "weapon"))
        weapon.head = (offset_x + 0.18, offset_y - 0.12, 1.14)
        weapon.tail = (offset_x + 0.18, offset_y - 0.92, 1.14)
        weapon.parent = torso
    bpy.ops.object.mode_set(mode="OBJECT")
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    return armature


def detect_member(name: str) -> str | None:
    for member in MEMBERS:
        if f"soldier_{member}" in name:
            return member
    if name == "leader_antenna":
        return "lead"
    return None


def detect_part(name: str) -> str:
    if "boot_0" in name or "leg_0" in name:
        return "leg_l"
    if "boot_1" in name or "leg_1" in name:
        return "leg_r"
    if "arm_0" in name:
        return "arm_l"
    if "arm_1" in name:
        return "arm_r"
    if "rifle" in name:
        return "weapon"
    if "head" in name or "helmet" in name or "visor" in name or name == "leader_antenna":
        return "head"
    if "pelvis" in name:
        return "pelvis"
    return "torso"


def skin_and_consolidate(
    collection: bpy.types.Collection,
    armature: bpy.types.Object,
) -> None:
    grouped: dict[str, list[bpy.types.Object]] = {}
    meshes = [obj for obj in collection.all_objects if obj.type == "MESH"]
    for obj in meshes:
        member = detect_member(obj.name)
        if member is None:
            continue
        bone_name = member_bone(member, detect_part(obj.name))
        world_matrix = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world_matrix
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.parent = armature
        obj.matrix_parent_inverse = armature.matrix_world.inverted()
        group = obj.vertex_groups.new(name=bone_name)
        group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
        material_name = obj.data.materials[0].name if obj.data.materials else "Unassigned"
        grouped.setdefault(material_name, []).append(obj)

    for material_name, objects in grouped.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        if len(objects) > 1:
            bpy.ops.object.join()
        active.name = f"rifle_squad_{material_name}_skinned"
        for modifier in list(active.modifiers):
            active.modifiers.remove(modifier)
        armature_modifier = active.modifiers.new("RifleSquadArmature", "ARMATURE")
        armature_modifier.object = armature


def parent_semantic_nodes(collection: bpy.types.Collection, armature: bpy.types.Object) -> None:
    for member in MEMBERS:
        semantic = bpy.data.objects.get(f"soldier_{member}")
        if semantic is None:
            continue
        world_matrix = semantic.matrix_world.copy()
        semantic.parent = armature
        semantic.parent_type = "BONE"
        semantic.parent_bone = member_bone(member, "root")
        semantic.matrix_world = world_matrix

    muzzle = bpy.data.objects.get("muzzle_socket")
    if muzzle is not None:
        world_matrix = muzzle.matrix_world.copy()
        muzzle.parent = armature
        muzzle.parent_type = "BONE"
        muzzle.parent_bone = member_bone("lead", "weapon")
        muzzle.matrix_world = world_matrix


def reset_pose(armature: bpy.types.Object) -> None:
    for bone in armature.pose.bones:
        bone.location = (0.0, 0.0, 0.0)
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)


def key_pose(armature: bpy.types.Object, frame: int, values: dict[str, tuple[tuple[float, float, float], tuple[float, float, float]]]) -> None:
    reset_pose(armature)
    for bone_name, (rotation, location) in values.items():
        bone = armature.pose.bones.get(bone_name)
        if bone is None:
            continue
        bone.rotation_euler = rotation
        bone.location = location
    for bone in armature.pose.bones:
        bone.keyframe_insert("rotation_euler", frame=frame, group=bone.name)
        bone.keyframe_insert("location", frame=frame, group=bone.name)


def member_values(member: str, *, stride=0.0, lean=0.0, root_x=0.0, root_z=0.0, torso_roll=0.0, weapon_y=0.0):
    return {
        member_bone(member, "root"): ((0.0, 0.0, 0.0), (root_x, 0.0, root_z)),
        member_bone(member, "torso"): ((lean, torso_roll, 0.0), (0.0, 0.0, 0.0)),
        member_bone(member, "leg_l"): ((stride, 0.0, 0.0), (0.0, 0.0, 0.0)),
        member_bone(member, "leg_r"): ((-stride, 0.0, 0.0), (0.0, 0.0, 0.0)),
        member_bone(member, "arm_l"): ((-stride * 0.55 - lean * 0.8, 0.0, 0.0), (0.0, 0.0, 0.0)),
        member_bone(member, "arm_r"): ((stride * 0.55 - lean * 0.8, 0.0, 0.0), (0.0, 0.0, 0.0)),
        member_bone(member, "weapon"): ((-lean * 0.35, 0.0, 0.0), (0.0, weapon_y, 0.0)),
    }


def merge_values(*blocks):
    result = {}
    for block in blocks:
        result.update(block)
    return result


def make_action(armature: bpy.types.Object, name: str, frames: list[tuple[int, dict]]) -> bpy.types.Action:
    action = bpy.data.actions.new(name)
    action["clip_role"] = name.removeprefix("rifle_")
    armature.animation_data.action = action
    for frame, values in frames:
        key_pose(armature, frame, values)
    for fcurve in action.fcurves:
        for point in fcurve.keyframe_points:
            point.interpolation = "BEZIER"
    armature.animation_data.action = None
    return action


def create_actions(armature: bpy.types.Object) -> dict[str, bpy.types.Action]:
    if armature.animation_data is None:
        armature.animation_data_create()
    for action in list(bpy.data.actions):
        if action.name in CLIP_NAMES:
            bpy.data.actions.remove(action)

    idle_a = merge_values(*(member_values(member, lean=0.025, root_z=0.0) for member in MEMBERS))
    idle_b = merge_values(*(member_values(member, lean=0.04, root_z=0.018 if member == "lead" else 0.01) for member in MEMBERS))
    run_a = merge_values(*(member_values(member, stride=0.62 if index % 2 == 0 else -0.62, lean=0.08, root_z=0.025) for index, member in enumerate(MEMBERS)))
    run_b = merge_values(*(member_values(member, stride=-0.62 if index % 2 == 0 else 0.62, lean=0.08, root_z=0.065) for index, member in enumerate(MEMBERS)))
    aim = merge_values(*(member_values(member, lean=0.18, root_z=0.0) for member in MEMBERS))
    fire = merge_values(*(member_values(member, lean=0.13, root_z=0.0, weapon_y=0.16 if member == "lead" else 0.08) for member in MEMBERS))
    hit = merge_values(*(member_values(member, lean=-0.12, root_x=(-0.11 if index % 2 == 0 else 0.11), torso_roll=(-0.22 if index % 2 == 0 else 0.22)) for index, member in enumerate(MEMBERS)))
    death = {}
    for index, member in enumerate(MEMBERS):
        direction = -1.0 if index != 1 else 1.0
        death.update(member_values(member, lean=0.0, root_x=direction * 0.12, root_z=-0.34))
        death[member_bone(member, "root")] = ((0.12, direction * 1.32, direction * 0.18), (direction * 0.12, 0.03 * index, -0.34))

    actions = {
        "rifle_idle": make_action(armature, "rifle_idle", [(1, idle_a), (16, idle_b), (31, idle_a)]),
        "rifle_run": make_action(armature, "rifle_run", [(1, run_a), (7, run_b), (13, run_a)]),
        "rifle_aim": make_action(armature, "rifle_aim", [(1, aim), (15, aim)]),
        "rifle_fire": make_action(armature, "rifle_fire", [(1, aim), (3, fire), (8, aim)]),
        "rifle_hit": make_action(armature, "rifle_hit", [(1, aim), (4, hit), (11, aim)]),
        "rifle_death": make_action(armature, "rifle_death", [(1, aim), (9, hit), (24, death)]),
    }
    return actions


def export_asset(collection: bpy.types.Collection, root: bpy.types.Object, armature: bpy.types.Object, actions: dict[str, bpy.types.Action]) -> None:
    root["asset_revision"] = "hero-rig-v2"
    root["animation_clips"] = list(CLIP_NAMES)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))

    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.all_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    armature.animation_data.action = actions["rifle_idle"]
    bpy.context.scene.frame_set(1)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_extras=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
    )

    scene = bpy.context.scene
    scene.render.filepath = str(OUTPUT_PREVIEW)
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.frame_set(1)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    if not SOURCE_BLEND.exists():
        raise FileNotFoundError(f"Missing static source master: {SOURCE_BLEND}")
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE_BLEND))
    collection = bpy.data.collections.get("FF_RIF_01_ASSET")
    root = bpy.data.objects.get("FF_RIF_01")
    squad = bpy.data.objects.get("squad_root")
    if collection is None or root is None or squad is None:
        raise RuntimeError("FF-RIF-01 source master is missing its asset collection or semantic roots")
    armature = create_armature(collection, squad)
    skin_and_consolidate(collection, armature)
    parent_semantic_nodes(collection, armature)
    actions = create_actions(armature)
    export_asset(collection, root, armature, actions)
    print(f"FF_RIF_01_BLEND={OUTPUT_BLEND}")
    print(f"FF_RIF_01_GLB={OUTPUT_GLB}")
    print(f"FF_RIF_01_PREVIEW={OUTPUT_PREVIEW}")
    print(f"FF_RIF_01_CLIPS={','.join(CLIP_NAMES)}")


if __name__ == "__main__":
    main()
