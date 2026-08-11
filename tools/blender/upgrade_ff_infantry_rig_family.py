from __future__ import annotations

import math
import sys
from dataclasses import dataclass
from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SKIP_PREVIEW = "--skip-preview" in sys.argv


@dataclass(frozen=True)
class InfantrySpec:
    asset_id: str
    root_name: str
    collection_name: str
    armature_name: str
    clip_prefix: str
    member_nodes: dict[str, str]
    weapon_nodes: tuple[str, ...]


SPECS = {
    "ff_rif_01": InfantrySpec(
        "ff_rif_01", "FF_RIF_01", "FF_RIF_01_ASSET", "rifle_squad_armature", "rifle",
        {"lead": "soldier_lead", "left": "soldier_left", "right": "soldier_right"},
        ("muzzle_socket",),
    ),
    "ff_eng_01": InfantrySpec(
        "ff_eng_01", "FF_ENG_01", "FF_ENG_01_ASSET", "engineer_squad_armature", "engineer",
        {"lead": "engineer_lead", "left": "engineer_left", "right": "engineer_right"},
        ("repair_tool_socket",),
    ),
    "ff_at_01": InfantrySpec(
        "ff_at_01", "FF_AT_01", "FF_AT_01_ASSET", "antitank_squad_armature", "antitank",
        {"lead": "launcher_lead", "left": "loader_left", "right": "loader_right"},
        ("launcher_pitch", "muzzle_socket"),
    ),
    "ff_en_rif_01": InfantrySpec(
        "ff_en_rif_01", "FF_EN_RIF_01", "FF_EN_RIF_01_ASSET", "enemy_rifle_squad_armature", "enemy_rifle",
        {"lead": "soldier_lead", "left": "soldier_left", "right": "soldier_right"},
        ("muzzle_socket",),
    ),
    "ff_en_at_01": InfantrySpec(
        "ff_en_at_01", "FF_EN_AT_01", "FF_EN_AT_01_ASSET", "enemy_antitank_squad_armature", "enemy_antitank",
        {"lead": "launcher_lead", "left": "loader_left", "right": "loader_right"},
        ("launcher_pitch", "muzzle_socket"),
    ),
    "ff_en_eng_01": InfantrySpec(
        "ff_en_eng_01", "FF_EN_ENG_01", "FF_EN_ENG_01_ASSET", "enemy_engineer_squad_armature", "enemy_engineer",
        {"lead": "engineer_lead", "left": "engineer_left", "right": "engineer_right"},
        ("repair_tool_socket",),
    ),
}


def move_to_collection(collection: bpy.types.Collection, obj: bpy.types.Object) -> bpy.types.Object:
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def detail_box(
    collection: bpy.types.Collection,
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    material: bpy.types.Material,
    parent: bpy.types.Object,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.035,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add()
    obj = move_to_collection(collection, bpy.context.object)
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.rotation_euler = rotation
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("RoleSilhouetteBevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
    obj.data.materials.append(material)
    return obj


def existing_material(*names: str) -> bpy.types.Material:
    for name in names:
        material = bpy.data.materials.get(name)
        if material is not None:
            return material
    raise RuntimeError(f"Missing role-readability material: {', '.join(names)}")


def add_role_readability(spec: InfantrySpec, collection: bpy.types.Collection) -> None:
    enemy = spec.asset_id.startswith("ff_en_")
    armor = existing_material("M_EnemyCrimsonArmor", "M_AmberArmor") if enemy else existing_material("M_ArmorPanel")
    dark = existing_material("M_EnemyObsidianArmor", "M_Gunmetal") if enemy else existing_material("M_Gunmetal")
    marking = existing_material("M_EnemyMarking", "M_UnitMarking", "M_AmberArmor") if enemy else existing_material("M_AmberArmor")
    signal = existing_material("M_EnemySignal", "M_CyanSignal") if enemy else existing_material("M_CyanSignal")
    role = "engineer" if "eng" in spec.asset_id else "antitank" if "_at_" in spec.asset_id else "rifle"

    for member, object_name in spec.member_nodes.items():
        parent = bpy.data.objects.get(object_name)
        if parent is None:
            raise RuntimeError(f"{spec.asset_id}: missing role parent {object_name}")
        if role == "rifle" and not enemy:
            detail_box(collection, f"{object_name}_arm_0_shield", (0.46, 0.14, 0.68), (-0.38, -0.22, 1.18), armor, parent, (0, 0, math.radians(-8)), 0.045)
            detail_box(collection, f"{object_name}_chest_identifier", (0.5, 0.12, 0.34), (0, -0.29, 1.25), marking, parent, bevel=0.025)
        elif role == "rifle":
            detail_box(collection, f"{object_name}_chest_wedge", (0.58, 0.14, 0.5), (0, -0.3, 1.25), armor, parent, (math.radians(-5), 0, 0), 0.05)
            detail_box(collection, f"{object_name}_helmet_brow", (0.62, 0.18, 0.18), (0, -0.25, 1.72), marking, parent, bevel=0.035)
            if member == "lead":
                detail_box(collection, f"{object_name}_antenna_standard", (0.12, 0.12, 0.72), (0, 0.3, 1.9), marking, parent, bevel=0.02)
        elif role == "engineer":
            pack_x = 0.1 if enemy else 0.0
            detail_box(collection, f"{object_name}_repair_frame", (0.68 if enemy else 0.62, 0.38, 0.92 if enemy else 0.78), (pack_x, 0.36, 1.22), dark, parent, bevel=0.065)
            detail_box(collection, f"{object_name}_repair_frame_mark", (0.42, 0.06, 0.14), (pack_x, 0.57, 1.28), signal, parent, bevel=0.018)
            detail_box(collection, f"{object_name}_arm_1_tool_brace", (0.36, 0.22, 0.5), (0.38, -0.12, 1.16), armor, parent, (0, math.radians(-6), math.radians(7)), 0.045)
            if enemy:
                detail_box(collection, f"{object_name}_repair_frame_tower", (0.24, 0.22, 0.62), (-0.2, 0.38, 1.82), marking, parent, (0, 0, math.radians(-6)), 0.035)
        else:
            detail_box(collection, f"{object_name}_ammo_backpack", (0.6, 0.4, 0.9), (0, 0.37, 1.2), dark, parent, bevel=0.065)
            detail_box(collection, f"{object_name}_ammo_mark", (0.38, 0.06, 0.18), (0, 0.59, 1.28), marking, parent, bevel=0.02)
            detail_box(collection, f"{object_name}_pauldron_0_heavy", (0.48, 0.56, 0.34), (-0.43, 0, 1.4), armor, parent, (0, 0, math.radians(-9)), 0.055)
            detail_box(collection, f"{object_name}_pauldron_1_heavy", (0.48, 0.56, 0.34), (0.43, 0, 1.4), armor, parent, (0, 0, math.radians(9)), 0.055)
            if member == "lead":
                detail_box(collection, f"{object_name}_launcher_blast_shield", (0.54, 0.16, 0.5), (0.18, -0.47, 1.42), armor, parent, (math.radians(-6), 0, 0), 0.045)


def bone_name(member: str, part: str) -> str:
    return f"rig_{member}_{part}"


def source_path(spec: InfantrySpec) -> Path:
    return PROJECT_ROOT / "assets" / "3d" / spec.asset_id / f"{spec.asset_id}_v1_source.blend"


def output_path(spec: InfantrySpec, suffix: str) -> Path:
    return PROJECT_ROOT / "assets" / "3d" / spec.asset_id / f"{spec.asset_id}_v1{suffix}"


def member_offsets(spec: InfantrySpec) -> dict[str, tuple[float, float]]:
    result: dict[str, tuple[float, float]] = {}
    for member, object_name in spec.member_nodes.items():
        obj = bpy.data.objects.get(object_name)
        if obj is None:
            raise RuntimeError(f"{spec.asset_id}: missing member node {object_name}")
        result[member] = (float(obj.location.x), float(obj.location.y))
    return result


def create_armature(spec: InfantrySpec, collection: bpy.types.Collection, squad: bpy.types.Object) -> bpy.types.Object:
    data = bpy.data.armatures.new(f"{spec.root_name}_Rig")
    armature = bpy.data.objects.new(spec.armature_name, data)
    collection.objects.link(armature)
    armature.parent = squad
    armature.show_in_front = True
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for member, (offset_x, offset_y) in member_offsets(spec).items():
        root = data.edit_bones.new(bone_name(member, "root"))
        root.head = (offset_x, offset_y, 0.02)
        root.tail = (offset_x, offset_y, 0.74)

        pelvis = data.edit_bones.new(bone_name(member, "pelvis"))
        pelvis.head = (offset_x, offset_y, 0.7)
        pelvis.tail = (offset_x, offset_y, 1.0)
        pelvis.parent = root

        torso = data.edit_bones.new(bone_name(member, "torso"))
        torso.head = (offset_x, offset_y, 0.96)
        torso.tail = (offset_x, offset_y, 1.48)
        torso.parent = pelvis

        head = data.edit_bones.new(bone_name(member, "head"))
        head.head = (offset_x, offset_y, 1.44)
        head.tail = (offset_x, offset_y, 1.88)
        head.parent = torso

        for side, sign in (("leg_l", -1), ("leg_r", 1)):
            leg = data.edit_bones.new(bone_name(member, side))
            leg.head = (offset_x + sign * 0.14, offset_y, 0.74)
            leg.tail = (offset_x + sign * 0.14, offset_y, 0.1)
            leg.parent = pelvis

        for side, sign in (("arm_l", -1), ("arm_r", 1)):
            arm = data.edit_bones.new(bone_name(member, side))
            arm.head = (offset_x + sign * 0.3, offset_y - 0.01, 1.38)
            arm.tail = (offset_x + sign * 0.43, offset_y - 0.07, 1.0)
            arm.parent = torso

        weapon = data.edit_bones.new(bone_name(member, "weapon"))
        weapon.head = (offset_x + 0.2, offset_y - 0.12, 1.18)
        weapon.tail = (offset_x + 0.2, offset_y - 1.02, 1.18)
        weapon.parent = torso
    bpy.ops.object.mode_set(mode="OBJECT")
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
    return armature


def ancestor_member(spec: InfantrySpec, obj: bpy.types.Object) -> str | None:
    current: bpy.types.Object | None = obj
    while current is not None:
        for member, object_name in spec.member_nodes.items():
            if current.name == object_name:
                return member
        current = current.parent
    return None


def part_for_object(name: str) -> str:
    lowered = name.lower()
    if any(token in lowered for token in ("boot_0", "leg_0", "shin_0")):
        return "leg_l"
    if any(token in lowered for token in ("boot_1", "leg_1", "shin_1")):
        return "leg_r"
    if "arm_0" in lowered or "pauldron_0" in lowered:
        return "arm_l"
    if "arm_1" in lowered or "pauldron_1" in lowered:
        return "arm_r"
    if any(token in lowered for token in ("rifle", "launcher", "repair_tool", "tool_head", "repair_probe")):
        return "weapon"
    if any(token in lowered for token in ("head", "helmet", "visor", "crest", "banner", "antenna")):
        return "head"
    if "pelvis" in lowered:
        return "pelvis"
    return "torso"


def skin_and_consolidate(spec: InfantrySpec, collection: bpy.types.Collection, armature: bpy.types.Object) -> None:
    grouped: dict[str, list[bpy.types.Object]] = {}
    for obj in [candidate for candidate in collection.all_objects if candidate.type == "MESH"]:
        member = ancestor_member(spec, obj)
        if member is None:
            continue
        target_bone = bone_name(member, part_for_object(obj.name))
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
        group = obj.vertex_groups.new(name=target_bone)
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
        active.name = f"{spec.asset_id}_{material_name}_skinned"
        for modifier in list(active.modifiers):
            active.modifiers.remove(modifier)
        modifier = active.modifiers.new("SquadArmature", "ARMATURE")
        modifier.object = armature


def reparent_to_bone(obj: bpy.types.Object, armature: bpy.types.Object, target_bone: str) -> None:
    world_matrix = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = target_bone
    obj.matrix_world = world_matrix


def parent_semantics(spec: InfantrySpec, armature: bpy.types.Object) -> None:
    for member, object_name in spec.member_nodes.items():
        semantic = bpy.data.objects.get(object_name)
        if semantic is not None:
            reparent_to_bone(semantic, armature, bone_name(member, "root"))
    for object_name in spec.weapon_nodes:
        obj = bpy.data.objects.get(object_name)
        if obj is not None:
            reparent_to_bone(obj, armature, bone_name("lead", "weapon"))


def reset_pose(armature: bpy.types.Object) -> None:
    for bone in armature.pose.bones:
        bone.location = (0.0, 0.0, 0.0)
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)


def member_pose(member: str, *, stride=0.0, lean=0.0, root_x=0.0, root_z=0.0, roll=0.0, weapon_y=0.0):
    return {
        bone_name(member, "root"): ((0.0, 0.0, 0.0), (root_x, 0.0, root_z)),
        bone_name(member, "torso"): ((lean, roll, 0.0), (0.0, 0.0, 0.0)),
        bone_name(member, "leg_l"): ((stride, 0.0, 0.0), (0.0, 0.0, 0.0)),
        bone_name(member, "leg_r"): ((-stride, 0.0, 0.0), (0.0, 0.0, 0.0)),
        bone_name(member, "arm_l"): ((-stride * 0.55 - lean * 0.8, 0.0, 0.0), (0.0, 0.0, 0.0)),
        bone_name(member, "arm_r"): ((stride * 0.55 - lean * 0.8, 0.0, 0.0), (0.0, 0.0, 0.0)),
        bone_name(member, "weapon"): ((-lean * 0.35, 0.0, 0.0), (0.0, weapon_y, 0.0)),
    }


def merge(*blocks):
    result = {}
    for block in blocks:
        result.update(block)
    return result


def key_pose(armature: bpy.types.Object, frame: int, values: dict) -> None:
    reset_pose(armature)
    for target, (rotation, location) in values.items():
        bone = armature.pose.bones.get(target)
        if bone is not None:
            bone.rotation_euler = rotation
            bone.location = location
    for bone in armature.pose.bones:
        bone.keyframe_insert("rotation_euler", frame=frame, group=bone.name)
        bone.keyframe_insert("location", frame=frame, group=bone.name)


def make_action(armature: bpy.types.Object, name: str, role: str, frames: list[tuple[int, dict]]) -> bpy.types.Action:
    action = bpy.data.actions.new(name)
    action["clip_role"] = role
    armature.animation_data.action = action
    for frame, values in frames:
        key_pose(armature, frame, values)
    for fcurve in action.fcurves:
        for point in fcurve.keyframe_points:
            point.interpolation = "BEZIER"
    armature.animation_data.action = None
    return action


def create_actions(spec: InfantrySpec, armature: bpy.types.Object) -> dict[str, bpy.types.Action]:
    if armature.animation_data is None:
        armature.animation_data_create()
    members = tuple(spec.member_nodes)
    idle_a = merge(*(member_pose(member, lean=0.025) for member in members))
    idle_b = merge(*(member_pose(member, lean=0.045, root_z=0.018 if member == "lead" else 0.01) for member in members))
    run_a = merge(*(member_pose(member, stride=0.62 if index % 2 == 0 else -0.62, lean=0.08, root_z=0.025) for index, member in enumerate(members)))
    run_b = merge(*(member_pose(member, stride=-0.62 if index % 2 == 0 else 0.62, lean=0.08, root_z=0.065) for index, member in enumerate(members)))
    aim = merge(*(member_pose(member, lean=0.18) for member in members))
    fire = merge(*(member_pose(member, lean=0.13, weapon_y=0.19 if member == "lead" else 0.08) for member in members))
    hit = merge(*(member_pose(member, lean=-0.12, root_x=-0.11 if index % 2 == 0 else 0.11, roll=-0.22 if index % 2 == 0 else 0.22) for index, member in enumerate(members)))
    death = {}
    for index, member in enumerate(members):
        direction = -1.0 if index != 1 else 1.0
        death.update(member_pose(member, root_x=direction * 0.12, root_z=-0.34))
        death[bone_name(member, "root")] = ((0.12, direction * 1.32, direction * 0.18), (direction * 0.12, 0.03 * index, -0.34))

    definitions = {
        "idle": [(1, idle_a), (16, idle_b), (31, idle_a)],
        "run": [(1, run_a), (7, run_b), (13, run_a)],
        "aim": [(1, aim), (15, aim)],
        "fire": [(1, aim), (3, fire), (8, aim)],
        "hit": [(1, aim), (4, hit), (11, aim)],
        "death": [(1, aim), (9, hit), (24, death)],
    }
    return {
        role: make_action(armature, f"{spec.clip_prefix}_{role}", role, frames)
        for role, frames in definitions.items()
    }


def export_asset(spec: InfantrySpec, collection: bpy.types.Collection, root: bpy.types.Object, armature: bpy.types.Object, actions: dict[str, bpy.types.Action]) -> None:
    root["asset_revision"] = "family-rig-v3-role-silhouette"
    root["render_profile"] = "strategic-camera-hero"
    root["animation_clips"] = [action.name for action in actions.values()]
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path(spec, ".blend")))
    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.all_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    armature.animation_data.action = actions["idle"]
    bpy.context.scene.frame_set(1)
    bpy.ops.export_scene.gltf(
        filepath=str(output_path(spec, ".glb")), export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True, export_extras=True, export_animations=True,
        export_animation_mode="ACTIONS", export_force_sampling=True,
    )
    scene = bpy.context.scene
    scene.render.filepath = str(output_path(spec, "_preview.png"))
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.frame_set(1)
    if not SKIP_PREVIEW:
        bpy.ops.render.render(write_still=True)


def upgrade(spec: InfantrySpec) -> None:
    source = source_path(spec)
    if not source.exists():
        raise FileNotFoundError(f"{spec.asset_id}: missing source {source}")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    collection = bpy.data.collections.get(spec.collection_name)
    root = bpy.data.objects.get(spec.root_name)
    squad = bpy.data.objects.get("squad_root")
    if collection is None or root is None or squad is None:
        raise RuntimeError(f"{spec.asset_id}: missing collection or semantic roots")
    add_role_readability(spec, collection)
    armature = create_armature(spec, collection, squad)
    skin_and_consolidate(spec, collection, armature)
    parent_semantics(spec, armature)
    actions = create_actions(spec, armature)
    export_asset(spec, collection, root, armature, actions)
    print(f"RIGGED_ASSET={spec.asset_id};CLIPS={','.join(action.name for action in actions.values())}")


def requested_assets() -> list[str]:
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return [argument for argument in args if not argument.startswith("--")] or list(SPECS)


def main() -> None:
    for asset_id in requested_assets():
        spec = SPECS.get(asset_id)
        if spec is None:
            raise ValueError(f"Unknown infantry asset: {asset_id}")
        upgrade(spec)


if __name__ == "__main__":
    main()
