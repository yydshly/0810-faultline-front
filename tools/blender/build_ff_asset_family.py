from __future__ import annotations

import math
import sys
from array import array
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEXTURE_DIR = PROJECT_ROOT / "assets" / "3d" / "ff_mbt_01" / "textures"
SKIP_PREVIEW = "--skip-preview" in sys.argv
SKIP_SPRITES = "--skip-sprites" in sys.argv


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def point_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def textured_material(name: str, key: str, metallic: float, roughness: float) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    principled = nodes.get("Principled BSDF")
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    base_image = bpy.data.images.load(str(TEXTURE_DIR / f"{key}_basecolor.png"), check_existing=True)
    normal_image = bpy.data.images.load(str(TEXTURE_DIR / f"{key}_normal.png"), check_existing=True)
    orm_image = bpy.data.images.load(str(TEXTURE_DIR / f"{key}_orm.png"), check_existing=True)
    normal_image.colorspace_settings.name = "Non-Color"
    orm_image.colorspace_settings.name = "Non-Color"
    base = nodes.new("ShaderNodeTexImage")
    base.image = base_image
    normal = nodes.new("ShaderNodeTexImage")
    normal.image = normal_image
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.22
    orm = nodes.new("ShaderNodeTexImage")
    orm.image = orm_image
    separate = nodes.new("ShaderNodeSeparateColor")
    links.new(base.outputs["Color"], principled.inputs["Base Color"])
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    links.new(orm.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], principled.inputs["Roughness"])
    links.new(separate.outputs["Blue"], principled.inputs["Metallic"])
    return mat


def tinted_textured_material(
    name: str,
    key: str,
    tint: tuple[float, float, float],
    metallic: float,
    roughness: float,
) -> bpy.types.Material:
    """Reuse the hero PBR breakup while authoring a distinct enemy palette."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    principled = nodes.get("Principled BSDF")
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness

    source_base = bpy.data.images.load(str(TEXTURE_DIR / f"{key}_basecolor.png"), check_existing=True)
    base_image = source_base.copy()
    base_image.name = f"{name}_BaseColor"
    pixels = array("f", [0.0]) * len(base_image.pixels)
    base_image.pixels.foreach_get(pixels)
    for index in range(0, len(pixels), 4):
        pixels[index] = min(1.0, pixels[index] * tint[0])
        pixels[index + 1] = min(1.0, pixels[index + 1] * tint[1])
        pixels[index + 2] = min(1.0, pixels[index + 2] * tint[2])
    base_image.pixels.foreach_set(pixels)
    base_image.pack()

    normal_image = bpy.data.images.load(str(TEXTURE_DIR / f"{key}_normal.png"), check_existing=True)
    orm_image = bpy.data.images.load(str(TEXTURE_DIR / f"{key}_orm.png"), check_existing=True)
    normal_image.colorspace_settings.name = "Non-Color"
    orm_image.colorspace_settings.name = "Non-Color"
    base = nodes.new("ShaderNodeTexImage")
    base.image = base_image
    normal = nodes.new("ShaderNodeTexImage")
    normal.image = normal_image
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.22
    orm = nodes.new("ShaderNodeTexImage")
    orm.image = orm_image
    separate = nodes.new("ShaderNodeSeparateColor")
    links.new(base.outputs["Color"], principled.inputs["Base Color"])
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])
    links.new(orm.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], principled.inputs["Roughness"])
    links.new(separate.outputs["Blue"], principled.inputs["Metallic"])
    return mat


def simple_material(
    name: str,
    color: tuple[float, float, float, float],
    metallic: float,
    roughness: float,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if emission:
        principled.inputs["Emission Color"].default_value = emission
        principled.inputs["Emission Strength"].default_value = emission_strength
    return mat


def tune_simple_material(
    mat: bpy.types.Material,
    color: tuple[float, float, float, float],
    *,
    roughness: float | None = None,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float | None = None,
) -> None:
    """Retune an existing material slot without changing the runtime material budget."""
    mat.diffuse_color = color
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    if roughness is not None:
        principled.inputs["Roughness"].default_value = roughness
    if emission is not None:
        principled.inputs["Emission Color"].default_value = emission
    if emission_strength is not None:
        principled.inputs["Emission Strength"].default_value = emission_strength


def make_materials() -> dict[str, bpy.types.Material]:
    return {
        "panel": textured_material("M_ArmorPanel", "armor_panel", 0.05, 0.55),
        "gunmetal": textured_material("M_Gunmetal", "gunmetal", 0.12, 0.48),
        "dark": textured_material("M_Recess", "recess", 0.08, 0.68),
        "rubber": textured_material("M_TrackRubber", "track_rubber", 0.0, 0.88),
        "steel": textured_material("M_Steel", "steel", 0.65, 0.3),
        "amber": textured_material("M_AmberArmor", "amber_armor", 0.05, 0.5),
        "cyan": simple_material("M_CyanSignal", (0.02, 0.48, 0.58, 1), 0.05, 0.3, (0, 0.75, 1, 1), 4.2),
        "glass": simple_material("M_CyanGlass", (0.025, 0.18, 0.2, 1), 0.15, 0.18, (0, 0.18, 0.22, 1), 0.7),
        "worklight": simple_material("M_WarmWorklight", (0.5, 0.2, 0.025, 1), 0.03, 0.3, (1.0, 0.22, 0.015, 1), 3.6),
        "crystal": simple_material("M_Huijing", (0.03, 0.52, 0.7, 1), 0.05, 0.22, (0, 0.62, 0.95, 1), 3.8),
        "rock": simple_material("M_FaultRock", (0.18, 0.2, 0.19, 1), 0.02, 0.94),
        "rock_light": simple_material("M_FaultRockLight", (0.29, 0.3, 0.27, 1), 0.01, 0.9),
        "rust": simple_material("M_Rust", (0.3, 0.105, 0.045, 1), 0.18, 0.86),
        "burnt": simple_material("M_BurntMetal", (0.035, 0.04, 0.038, 1), 0.22, 0.92),
        "earth": simple_material("M_FieldEarth", (0.17, 0.145, 0.09, 1), 0.0, 0.98),
        "earth_dark": simple_material("M_ScorchedEarth", (0.055, 0.052, 0.04, 1), 0.0, 1.0),
        "concrete": simple_material("M_FieldConcrete", (0.31, 0.32, 0.29, 1), 0.02, 0.92),
        "warning": simple_material("M_FieldWarning", (0.78, 0.49, 0.08, 1), 0.02, 0.72),
        "sand": simple_material("M_FieldSandbag", (0.39, 0.34, 0.23, 1), 0.0, 0.96),
        "canvas": simple_material("M_FieldCanvas", (0.22, 0.24, 0.2, 1), 0.0, 0.91),
        "sage": simple_material("M_DrySage", (0.19, 0.23, 0.13, 1), 0.0, 0.96),
        "sage_light": simple_material("M_DrySageLight", (0.32, 0.34, 0.17, 1), 0.0, 0.94),
        "wood": simple_material("M_DeadWood", (0.16, 0.105, 0.055, 1), 0.0, 0.98),
        "ground": simple_material("M_PreviewGround", (0.18, 0.18, 0.15, 1), 0, 0.98),
    }


def make_player_field_vehicle_materials() -> dict[str, bpy.types.Material]:
    """Seven exported slots plus a preview-only ground material."""
    return {
        "panel": simple_material("M_ArmorPanel", (0.17, 0.215, 0.16, 1), 0.08, 0.62),
        "gunmetal": simple_material("M_Gunmetal", (0.055, 0.07, 0.065, 1), 0.42, 0.54),
        "dark": simple_material("M_Recess", (0.02, 0.027, 0.025, 1), 0.08, 0.82),
        "rubber": simple_material("M_TrackRubber", (0.012, 0.016, 0.014, 1), 0.0, 0.94),
        "steel": simple_material("M_Steel", (0.27, 0.3, 0.285, 1), 0.68, 0.34),
        "amber": simple_material("M_AmberArmor", (0.42, 0.19, 0.025, 1), 0.04, 0.58),
        "cyan": simple_material(
            "M_CyanSignal",
            (0.01, 0.22, 0.26, 1),
            0.02,
            0.42,
            (0.0, 0.38, 0.46, 1),
            1.8,
        ),
        "ground": simple_material("M_PreviewGround", (0.18, 0.18, 0.15, 1), 0.0, 0.98),
    }


def make_enemy_materials(textured: bool = False) -> dict[str, bpy.types.Material]:
    shared = {
        "signal": simple_material("M_EnemySignal", (0.72, 0.035, 0.018, 1), 0.06, 0.24, (1.0, 0.035, 0.01, 1), 5.2),
        "crystal": simple_material("M_EnemyHuijing", (0.025, 0.48, 0.66, 1), 0.04, 0.22, (0.0, 0.68, 0.95, 1), 3.9),
        "ground": simple_material("M_PreviewGround", (0.18, 0.18, 0.15, 1), 0, 0.98),
    }
    if textured:
        return {
            "armor": tinted_textured_material("M_EnemyCrimsonArmor", "armor_panel", (2.45, 0.34, 0.28), 0.16, 0.5),
            "armor_dark": tinted_textured_material("M_EnemyObsidianArmor", "gunmetal", (0.46, 0.48, 0.5), 0.28, 0.58),
            "steel": textured_material("M_EnemyGunmetal", "steel", 0.7, 0.31),
            "recess": textured_material("M_EnemyRecess", "recess", 0.08, 0.78),
            "rubber": textured_material("M_EnemyTrack", "track_rubber", 0.0, 0.93),
            "bone": tinted_textured_material("M_EnemyMarking", "armor_panel", (3.6, 2.9, 2.0), 0.05, 0.64),
            **shared,
        }
    return {
        "armor": simple_material("M_EnemyCrimsonArmor", (0.28, 0.045, 0.035, 1), 0.16, 0.5),
        "armor_dark": simple_material("M_EnemyObsidianArmor", (0.045, 0.052, 0.055, 1), 0.28, 0.58),
        "steel": simple_material("M_EnemyGunmetal", (0.18, 0.2, 0.21, 1), 0.7, 0.31),
        "recess": simple_material("M_EnemyRecess", (0.018, 0.021, 0.022, 1), 0.08, 0.78),
        "rubber": simple_material("M_EnemyTrack", (0.018, 0.02, 0.018, 1), 0.0, 0.93),
        "bone": simple_material("M_EnemyMarking", (0.48, 0.42, 0.31, 1), 0.05, 0.64),
        **shared,
    }


def empty(collection: bpy.types.Collection, name: str, location=(0, 0, 0), parent=None) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.location = location
    obj.parent = parent
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.35
    return obj


def move_to(collection: bpy.types.Collection, obj: bpy.types.Object) -> bpy.types.Object:
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def box(collection, name, size, location, mat, parent=None, bevel=0.07, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = move_to(collection, bpy.context.object)
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("EdgeBevel", "BEVEL")
        mod.width = bevel
        mod.segments = 1
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def tapered_box(
    collection,
    name,
    bottom_size,
    top_size,
    height,
    location,
    mat,
    parent=None,
    bevel=0.06,
):
    """Create a low-cost battered-wall volume for readable 3/4 building silhouettes."""
    bottom_x, bottom_y = bottom_size[0] / 2, bottom_size[1] / 2
    top_x, top_y = top_size[0] / 2, top_size[1] / 2
    half_height = height / 2
    vertices = [
        (-bottom_x, -bottom_y, -half_height),
        (bottom_x, -bottom_y, -half_height),
        (bottom_x, bottom_y, -half_height),
        (-bottom_x, bottom_y, -half_height),
        (-top_x, -top_y, half_height),
        (top_x, -top_y, half_height),
        (top_x, top_y, half_height),
        (-top_x, top_y, half_height),
    ]
    faces = [
        (0, 3, 2, 1),
        (4, 5, 6, 7),
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7),
    ]
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = location
    if bevel:
        mod = obj.modifiers.new("EdgeBevel", "BEVEL")
        mod.width = bevel
        mod.segments = 1
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def radial_patch(
    collection,
    name,
    outline,
    center_z,
    mat,
    parent=None,
    inner_scale=0.56,
):
    """Create a deterministic low-poly ground patch with a broken, non-circular edge."""
    center = (0.0, 0.0, center_z)
    inner = [
        (
            x * inner_scale,
            y * inner_scale,
            center_z + ((index % 3) - 1) * 0.018,
        )
        for index, (x, y, _z) in enumerate(outline)
    ]
    vertices = [center, *inner, *outline]
    count = len(outline)
    faces = []
    for index in range(count):
        next_index = (index + 1) % count
        inner_index = 1 + index
        inner_next = 1 + next_index
        outer_index = 1 + count + index
        outer_next = 1 + count + next_index
        faces.append((0, inner_index, inner_next))
        faces.append((inner_index, outer_index, outer_next, inner_next))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def fan_patch(collection, name, center, outline, mat, parent=None):
    """Create a small irregular contact patch without a circular decal silhouette."""
    vertices = [center, *outline]
    faces = [
        (0, 1 + index, 1 + ((index + 1) % len(outline)))
        for index in range(len(outline))
    ]
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def broken_ellipse_rim_segment(
    collection,
    name,
    center,
    outer_axes,
    inner_axes,
    start_degrees,
    end_degrees,
    steps,
    crest_height,
    mat,
    parent=None,
    rotation_degrees=0.0,
):
    """Create one low, open crater-rim arc with deterministic large-scale breakup."""
    if steps < 2:
        raise ValueError("Crater rim segments require at least two steps")
    rotation = math.radians(rotation_degrees)
    cos_rotation = math.cos(rotation)
    sin_rotation = math.sin(rotation)
    vertices = []
    faces = []
    irregularity = (1.0, 0.93, 1.05, 0.96, 1.08, 0.91, 1.03, 0.97)

    for index in range(steps):
        factor = index / (steps - 1)
        angle = math.radians(start_degrees + (end_degrees - start_degrees) * factor)
        radial = irregularity[index % len(irregularity)]
        crest_radial = radial * (0.98 + 0.035 * math.sin(angle * 3.0 + index * 0.7))
        height = crest_height * (0.82 + 0.18 * irregularity[(index + 3) % len(irregularity)])
        profiles = (
            (outer_axes[0] * radial, outer_axes[1] * radial, 0.025),
            (
                (outer_axes[0] * 0.58 + inner_axes[0] * 0.42) * crest_radial,
                (outer_axes[1] * 0.58 + inner_axes[1] * 0.42) * crest_radial,
                height,
            ),
            (inner_axes[0] * radial, inner_axes[1] * radial, 0.04),
        )
        for axis_x, axis_y, z in profiles:
            local_x = math.cos(angle) * axis_x
            local_y = math.sin(angle) * axis_y
            vertices.append((
                center[0] + local_x * cos_rotation - local_y * sin_rotation,
                center[1] + local_x * sin_rotation + local_y * cos_rotation,
                z,
            ))

    for index in range(steps - 1):
        base = index * 3
        next_base = (index + 1) * 3
        faces.extend((
            (base, next_base, next_base + 1, base + 1),
            (base + 1, next_base + 1, next_base + 2, base + 2),
        ))
    faces.extend(((0, 1, 2), ((steps - 1) * 3, (steps - 1) * 3 + 2, (steps - 1) * 3 + 1)))

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def open_constraint_ring(
    collection,
    name,
    center,
    radius,
    radial_width,
    height,
    start_degrees,
    end_degrees,
    steps,
    mat,
    parent=None,
):
    """Create one continuous, low-cost containment arc with a deliberate gap."""
    if steps < 3:
        raise ValueError("Constraint ring requires at least three arc samples")
    inner_radius = radius - radial_width / 2
    outer_radius = radius + radial_width / 2
    half_height = height / 2
    vertices = []
    faces = []
    for index in range(steps):
        factor = index / (steps - 1)
        angle = math.radians(start_degrees + (end_degrees - start_degrees) * factor)
        cos_angle = math.cos(angle)
        sin_angle = math.sin(angle)
        vertices.extend((
            (center[0] + inner_radius * cos_angle, center[1] + inner_radius * sin_angle, center[2] - half_height),
            (center[0] + outer_radius * cos_angle, center[1] + outer_radius * sin_angle, center[2] - half_height),
            (center[0] + outer_radius * cos_angle, center[1] + outer_radius * sin_angle, center[2] + half_height),
            (center[0] + inner_radius * cos_angle, center[1] + inner_radius * sin_angle, center[2] + half_height),
        ))
    for index in range(steps - 1):
        base = index * 4
        next_base = (index + 1) * 4
        faces.extend((
            (base, next_base, next_base + 1, base + 1),
            (base + 1, next_base + 1, next_base + 2, base + 2),
            (base + 2, next_base + 2, next_base + 3, base + 3),
            (base + 3, next_base + 3, next_base, base),
        ))
    end_base = (steps - 1) * 4
    faces.extend(((0, 1, 2, 3), (end_base, end_base + 3, end_base + 2, end_base + 1)))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def cylinder(collection, name, radius, depth, location, mat, parent=None, vertices=16, rotation=(0, 0, 0), bevel=0.025):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = move_to(collection, bpy.context.object)
    obj.name = name
    if bevel:
        mod = obj.modifiers.new("EdgeBevel", "BEVEL")
        mod.width = bevel
        mod.segments = 1
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def crystal(collection, name, location, scale, mat, parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=location)
    obj = move_to(collection, bpy.context.object)
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def sphere(collection, name, radius, location, mat, parent=None, segments=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=location)
    obj = move_to(collection, bpy.context.object)
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def torus(
    collection,
    name,
    major_radius,
    minor_radius,
    location,
    mat,
    parent=None,
    rotation=(0, 0, 0),
    scale=(1, 1, 1),
    major_segments=24,
    minor_segments=8,
):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=location,
        rotation=rotation,
    )
    obj = move_to(collection, bpy.context.object)
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def smart_uv(collection: bpy.types.Collection) -> None:
    for obj in [candidate for candidate in collection.all_objects if candidate.type == "MESH"]:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(island_margin=0.025)
        bpy.ops.object.mode_set(mode="OBJECT")


def add_preview(collection: bpy.types.Collection, materials, camera_location, target, ortho_scale):
    bpy.ops.mesh.primitive_plane_add(size=36, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "PREVIEW_GROUND"
    ground.data.materials.append(materials["ground"])
    bpy.ops.object.camera_add(location=camera_location)
    camera = bpy.context.object
    camera.name = "PREVIEW_CAMERA"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    point_at(camera, target)
    bpy.context.scene.camera = camera
    for name, kind, location, energy, size in (
        ("PREVIEW_KEY", "AREA", (-7, -8, 12), 1600, 7),
        ("PREVIEW_FILL", "AREA", (8, -2, 7), 850, 5),
        ("PREVIEW_RIM", "AREA", (0, 9, 10), 1100, 4),
    ):
        bpy.ops.object.light_add(type=kind, location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        point_at(light, target)
    return ground, camera


RUNTIME_ANIMATION_DOMAINS = {
    "radar_yaw", "crane_yaw", "reactor_core", "reactor_ring", "turret_yaw", "barrel_pitch",
    "collector_head", "factory_door", "barracks_door",
    "intake_gate", "intake_conveyor", "intake_collector",
    "powered_barracks_signal", "powered_reactor_core", "powered_reactor_ring_signal",
    "powered_artillery_rangefinder", "powered_suppressor_targeting", "powered_scout_radar",
}
RUNTIME_ANIMATION_PREFIXES = ("cargo_slot_",)


def join_wreck_part(name: str, objects: list[bpy.types.Object], parent: bpy.types.Object) -> bpy.types.Object:
    """Collapse authored wreck pieces into one stable, single-material runtime mesh."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    active = objects[0]
    bpy.context.view_layer.objects.active = active
    if len(objects) > 1:
        bpy.ops.object.join()
    active.name = name
    active.parent = parent
    active["wreck_part"] = name
    return active


def build_vehicle_wreck(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    mats: dict[str, bpy.types.Material],
    vehicle_kind: str,
) -> bpy.types.Object:
    """Author a low, vehicle-specific wreck without introducing materials or textures."""
    wreck = empty(collection, "wreck_visual_root", parent=root)
    wreck["presentation_role"] = "wreck_visual"
    wreck["default_visible"] = False
    wreck["runtime_visibility_owner"] = "scene"
    wreck["wreck_profile"] = "battle_tank" if vehicle_kind == "mbt" else "resource_harvester"
    recess_mat = mats.get("recess", mats.get("dark"))
    armor_mat = mats.get("armor", mats.get("panel"))
    gunmetal_mat = mats.get("gunmetal", mats.get("steel"))

    if vehicle_kind == "mbt":
        chassis_parts = [
            box(collection, "wreck_hull_low", (2.65, 4.1, 0.42), (0, 0.08, 0.38), recess_mat, wreck, 0.08, (0.04, -0.08, 0.03)),
            box(collection, "wreck_glacis_crushed", (2.35, 1.5, 0.32), (-0.08, -1.38, 0.62), recess_mat, wreck, 0.06, (0.14, -0.06, -0.05)),
            box(collection, "wreck_engine_burn", (2.18, 1.08, 0.2), (0.12, 1.38, 0.7), recess_mat, wreck, 0.04, (-0.09, 0.12, 0.05)),
        ]
        turret_parts = [
            box(collection, "wreck_turret_shell", (1.85, 1.72, 0.54), (0.38, -0.12, 0.92), gunmetal_mat, wreck, 0.09, (0.08, 0.17, math.radians(24))),
            cylinder(collection, "wreck_barrel_broken", 0.13, 2.1, (0.95, -1.15, 0.97), gunmetal_mat, wreck, 12, (math.pi / 2 + 0.12, 0.08, math.radians(-24)), 0.015),
            box(collection, "wreck_mantlet", (0.7, 0.5, 0.42), (0.55, -0.68, 0.95), gunmetal_mat, wreck, 0.05, (0.08, 0.17, math.radians(24))),
        ]
        track_parts: list[bpy.types.Object] = []
        for side, x in enumerate((-1.43, 1.43)):
            track_parts.append(box(collection, f"wreck_track_bed_{side}", (0.58, 4.25, 0.34), (x, 0.02, 0.25), mats["rubber"], wreck, 0.06, (0.02, 0.08 if side else -0.05, -0.05 if side else 0.03)))
        for index, (x, y, rz) in enumerate(((-1.55, -1.72, -0.16), (-1.62, -0.76, 0.10), (1.62, 0.62, -0.12), (1.5, 1.58, 0.18))):
            track_parts.append(box(collection, f"wreck_track_link_{index}", (0.7, 0.72, 0.13), (x, y, 0.16), mats["rubber"], wreck, 0.012, (0.05, 0.12, rz)))
        join_wreck_part("wreck_chassis", chassis_parts, wreck)
        join_wreck_part("wreck_turret", turret_parts, wreck)
        join_wreck_part("wreck_track_debris", track_parts, wreck)
    else:
        chassis_parts = [
            box(collection, "wreck_harvester_hull", (2.78, 4.45, 0.44), (0, 0.08, 0.38), recess_mat, wreck, 0.09, (0.03, -0.07, -0.025)),
            box(collection, "wreck_cabin_crushed", (2.15, 1.55, 0.78), (-0.12, -0.72, 0.86), recess_mat, wreck, 0.09, (0.13, -0.1, -0.05)),
            box(collection, "wreck_track_mass_left", (0.62, 4.55, 0.32), (-1.44, 0.08, 0.24), recess_mat, wreck, 0.07, (0.03, -0.06, 0.04)),
            box(collection, "wreck_track_mass_right", (0.62, 4.55, 0.32), (1.44, 0.08, 0.24), recess_mat, wreck, 0.07, (-0.02, 0.08, -0.04)),
        ]
        collector_parts = [
            cylinder(collection, "wreck_collector_drum", 0.51, 2.25, (0.24, -2.64, 0.48), mats["steel"], wreck, 12, (0.12, math.pi / 2, math.radians(11)), 0.025),
            box(collection, "wreck_collector_arm_left", (0.24, 1.5, 0.25), (-1.1, -1.82, 0.35), mats["steel"], wreck, 0.035, (0.05, -0.18, -0.25)),
            box(collection, "wreck_collector_arm_right", (0.24, 1.18, 0.25), (1.02, -1.72, 0.22), mats["steel"], wreck, 0.035, (-0.08, 0.22, 0.34)),
        ]
        for tooth_index, (x, angle) in enumerate(((-0.88, -0.38), (0.0, 0.22), (0.86, -0.16))):
            collector_parts.append(
                box(collection, f"wreck_collector_tooth_{tooth_index}", (0.18, 0.62, 0.18), (x, -2.83, 0.54), mats["steel"], wreck, 0.018, (angle, 0.1, angle * 0.45))
            )
        cargo_parts = [
            box(collection, "wreck_cargo_bin", (2.22, 1.72, 0.55), (0.18, 1.28, 0.72), armor_mat, wreck, 0.07, (0.14, -0.1, 0.12)),
            box(collection, "wreck_cargo_wall_left", (0.18, 1.84, 0.72), (-0.84, 1.16, 0.96), armor_mat, wreck, 0.035, (0.06, -0.26, -0.04)),
            box(collection, "wreck_cargo_wall_right", (0.18, 1.55, 0.62), (1.02, 1.52, 0.55), armor_mat, wreck, 0.035, (0.18, 0.34, 0.18)),
        ]
        join_wreck_part("wreck_chassis", chassis_parts, wreck)
        join_wreck_part("wreck_collector", collector_parts, wreck)
        join_wreck_part("wreck_cargo_debris", cargo_parts, wreck)

    wreck.hide_render = True
    return wreck


def join_damage_part(
    name: str,
    objects: list[bpy.types.Object],
    parent: bpy.types.Object,
) -> bpy.types.Object:
    """Collapse one damage meaning into one single-material runtime primitive."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    active = objects[0]
    bpy.context.view_layer.objects.active = active
    if len(objects) > 1:
        bpy.ops.object.join()
    active.name = name
    active.parent = parent
    active["damage_part"] = name
    active["readability_feature_min_m"] = 0.35
    return active


def build_building_damage_visuals(
    collection: bpy.types.Collection,
    building: bpy.types.Object,
    mats: dict[str, bpy.types.Material],
    profile: str,
    *,
    enemy: bool = False,
) -> tuple[bpy.types.Object, bpy.types.Object]:
    """Author two scene-owned, mutually exclusive building damage overlays."""
    asset_root = building.parent
    asset_root["building_damage_revision"] = "authored-building-damage-v1"
    asset_root["building_damage_stages"] = "damaged,critical"
    asset_root["damage_runtime_visibility_owner"] = "scene"
    asset_root["damage_stage_primitive_budget"] = 3
    asset_root["damage_stage_triangle_budget"] = 1800
    runtime_budgets = {
        "player_hq": (17, 7600, 8),
        "player_factory": (17, 7200, 7),
        "player_barracks": (15, 4800, 7),
        "player_reactor": (14, 5200, 7),
        "enemy_hq": (15, 6200, 6),
        "enemy_factory": (15, 5600, 6),
        "enemy_barracks": (14, 4300, 6),
        "enemy_reactor": (14, 4700, 6),
    }
    (
        asset_root["runtime_primitive_budget"],
        asset_root["runtime_triangle_budget"],
        asset_root["runtime_material_budget"],
    ) = runtime_budgets[profile]
    damaged = empty(collection, "damage_visual_damaged", parent=building)
    critical = empty(collection, "damage_visual_critical", parent=building)
    for root, role, stage in (
        (damaged, "building_damage_damaged", "damaged"),
        (critical, "building_damage_critical", "critical"),
    ):
        root["presentation_role"] = role
        root["default_visible"] = False
        root["runtime_visibility_owner"] = "scene"
        root["damage_stage"] = stage
        root["damage_profile"] = profile
        root["readability_feature_scale_m"] = "0.35-2.80"
        root["stage_primitive_budget"] = 3
        root["stage_triangle_budget"] = 1800
        root.hide_render = True

    recess = mats["recess"] if enemy else mats["dark"]
    # Player live shells are already very dark; use the existing steel slot so
    # bent edges survive the high strategic camera without adding a material.
    plate = mats["armor_dark"] if enemy else mats["steel"]
    rubble = mats["armor"] if enemy else mats["panel"]

    if profile == "player_hq":
        damaged_breach = [
            fan_patch(
                collection,
                "hq_damaged_roof_breach",
                (2.72, 1.15, 7.675),
                ((1.55, 0.35, 7.67), (3.2, 0.18, 7.67), (3.82, 1.02, 7.67), (3.28, 2.12, 7.67), (1.82, 1.88, 7.67)),
                recess,
                damaged,
            ),
            fan_patch(
                collection,
                "hq_damaged_side_breach",
                (6.145, 0.55, 2.72),
                ((6.14, -0.58, 1.95), (6.14, 0.18, 3.78), (6.14, 1.42, 3.42), (6.14, 1.65, 2.2)),
                recess,
                damaged,
            ),
            box(collection, "hq_damaged_front_notch", (1.82, 0.11, 1.04), (2.55, -2.91, 4.12), recess, damaged, 0.018, (0.08, -0.12, -0.16)),
        ]
        damaged_plate = [
            box(collection, "hq_damaged_bent_roof", (2.25, 1.15, 0.18), (2.85, 1.15, 7.82), plate, damaged, 0.035, (0.22, -0.24, 0.18)),
            box(collection, "hq_damaged_bent_front", (1.72, 0.18, 1.12), (3.35, -3.02, 4.2), plate, damaged, 0.035, (0.08, 0.25, -0.16)),
            box(collection, "hq_damaged_bent_side", (0.18, 1.65, 1.0), (6.22, 0.85, 2.72), plate, damaged, 0.035, (0.12, -0.18, 0.2)),
        ]
        damaged_debris = [
            box(collection, "hq_damaged_debris_ground_a", (1.0, 0.62, 0.38), (4.72, -3.48, 0.42), rubble, damaged, 0.035, (0.18, 0.22, -0.32)),
            box(collection, "hq_damaged_debris_ground_b", (0.72, 0.48, 0.42), (5.48, -2.78, 0.48), rubble, damaged, 0.03, (-0.22, 0.35, 0.18)),
            box(collection, "hq_damaged_debris_roof", (0.92, 0.58, 0.34), (1.92, 1.82, 7.9), rubble, damaged, 0.03, (0.24, -0.2, 0.38)),
        ]
        critical_collapse = [
            fan_patch(
                collection,
                "hq_critical_roof_collapse",
                (2.9, 1.05, 7.69),
                ((0.95, -0.08, 7.685), (3.4, -0.15, 7.685), (4.18, 0.92, 7.685), (3.48, 2.48, 7.685), (1.18, 2.1, 7.685)),
                recess,
                critical,
            ),
            fan_patch(
                collection,
                "hq_critical_shell_collapse",
                (4.2, -2.82, 4.02),
                ((2.75, -2.935, 3.12), (5.02, -2.935, 3.0), (5.18, -2.935, 4.65), (3.5, -2.935, 5.02)),
                recess,
                critical,
            ),
            tapered_box(collection, "hq_critical_slumped_mass", (3.4, 2.8), (2.35, 1.85), 0.82, (3.12, 1.22, 7.36), recess, critical, 0.05),
        ]
        critical_plate = [
            box(collection, "hq_critical_roof_slab", (3.1, 1.5, 0.24), (3.1, 1.3, 7.63), plate, critical, 0.045, (0.42, -0.34, 0.24)),
            box(collection, "hq_critical_front_slab", (2.42, 0.22, 1.5), (4.0, -3.22, 3.78), plate, critical, 0.045, (0.16, 0.42, -0.24)),
            box(collection, "hq_critical_side_slab", (0.24, 2.35, 1.35), (6.35, 0.7, 2.62), plate, critical, 0.045, (0.24, -0.28, 0.35)),
        ]
        critical_debris = [
            box(collection, "hq_critical_debris_a", (1.35, 0.82, 0.52), (4.48, -3.72, 0.5), rubble, critical, 0.04, (0.24, 0.3, -0.42)),
            box(collection, "hq_critical_debris_b", (1.0, 0.72, 0.48), (5.62, -2.72, 0.54), rubble, critical, 0.04, (-0.28, 0.38, 0.22)),
            box(collection, "hq_critical_debris_c", (0.8, 0.64, 0.56), (3.82, -2.72, 0.52), rubble, critical, 0.035, (0.38, -0.22, 0.5)),
            box(collection, "hq_critical_debris_roof_a", (1.08, 0.72, 0.42), (1.45, 1.92, 7.86), rubble, critical, 0.035, (0.3, -0.32, 0.2)),
            box(collection, "hq_critical_debris_roof_b", (0.72, 0.54, 0.4), (3.86, 2.18, 7.72), rubble, critical, 0.03, (-0.18, 0.36, -0.28)),
        ]
    elif profile == "player_factory":
        damaged_breach = [
            fan_patch(collection, "fac_damaged_roof_breach", (-2.55, 1.38, 5.835), ((-4.15, 0.42, 5.83), (-2.55, 0.12, 5.83), (-1.18, 0.78, 5.83), (-1.4, 2.42, 5.83), (-3.72, 2.55, 5.83)), recess, damaged),
            fan_patch(collection, "fac_damaged_side_breach", (-5.82, 0.35, 2.8), ((-5.81, -0.72, 1.72), (-5.81, -0.08, 3.92), (-5.81, 1.28, 4.1), (-5.81, 1.58, 2.05)), recess, damaged),
            box(collection, "fac_damaged_bay_notch", (1.72, 0.12, 1.02), (-2.25, -3.65, 3.65), recess, damaged, 0.018, (0.05, 0.18, 0.15)),
        ]
        damaged_plate = [
            box(collection, "fac_damaged_bent_roof", (2.7, 1.3, 0.2), (-2.62, 1.35, 5.98), plate, damaged, 0.04, (0.24, 0.28, -0.15)),
            box(collection, "fac_damaged_bent_bay", (1.65, 0.2, 1.22), (-2.32, -3.74, 3.55), plate, damaged, 0.035, (0.1, -0.3, 0.18)),
            box(collection, "fac_damaged_bent_side", (0.2, 1.82, 1.16), (-5.94, 0.45, 2.78), plate, damaged, 0.035, (0.16, 0.22, -0.18)),
        ]
        damaged_debris = [
            box(collection, "fac_damaged_debris_a", (1.08, 0.68, 0.4), (-4.82, -3.38, 0.46), rubble, damaged, 0.035, (0.2, -0.34, 0.35)),
            box(collection, "fac_damaged_debris_b", (0.78, 0.52, 0.44), (-5.42, -2.62, 0.48), rubble, damaged, 0.03, (-0.32, 0.2, -0.18)),
            box(collection, "fac_damaged_debris_roof", (0.92, 0.62, 0.36), (-1.48, 2.22, 5.98), rubble, damaged, 0.03, (0.28, 0.18, -0.42)),
        ]
        critical_collapse = [
            fan_patch(collection, "fac_critical_roof_collapse", (-2.72, 1.32, 5.85), ((-4.72, -0.02, 5.845), (-2.3, -0.18, 5.845), (-0.82, 0.7, 5.845), (-1.2, 2.82, 5.845), (-4.22, 2.66, 5.845)), recess, critical),
            fan_patch(collection, "fac_critical_wall_collapse", (-4.3, -2.85, 3.05), ((-5.38, -3.64, 1.35), (-2.78, -3.64, 1.7), (-2.68, -3.64, 4.58), (-5.28, -3.64, 4.18)), recess, critical),
            tapered_box(collection, "fac_critical_slumped_roof", (4.15, 2.75), (2.9, 1.78), 0.86, (-2.72, 1.32, 5.48), recess, critical, 0.055),
        ]
        critical_plate = [
            box(collection, "fac_critical_roof_slab", (3.55, 1.72, 0.25), (-2.62, 1.25, 5.76), plate, critical, 0.045, (0.48, 0.3, -0.22)),
            box(collection, "fac_critical_bay_slab", (2.35, 0.24, 1.62), (-3.72, -3.92, 3.15), plate, critical, 0.045, (0.18, -0.42, 0.25)),
            box(collection, "fac_critical_side_slab", (0.24, 2.5, 1.45), (-6.02, 0.38, 2.65), plate, critical, 0.045, (0.28, 0.2, -0.3)),
        ]
        critical_debris = [
            box(collection, "fac_critical_debris_a", (1.42, 0.88, 0.54), (-4.62, -3.52, 0.52), rubble, critical, 0.04, (0.28, -0.32, 0.42)),
            box(collection, "fac_critical_debris_b", (1.02, 0.7, 0.5), (-5.62, -2.45, 0.52), rubble, critical, 0.04, (-0.24, 0.4, -0.22)),
            box(collection, "fac_critical_debris_c", (0.86, 0.6, 0.48), (-3.45, -2.82, 0.5), rubble, critical, 0.035, (0.4, -0.2, 0.52)),
            box(collection, "fac_critical_debris_roof_a", (1.12, 0.72, 0.42), (-1.25, 2.2, 5.86), rubble, critical, 0.035, (0.32, 0.24, -0.36)),
            box(collection, "fac_critical_debris_roof_b", (0.82, 0.58, 0.4), (-4.0, 2.25, 5.62), rubble, critical, 0.03, (-0.22, 0.38, 0.26)),
        ]
    elif profile == "player_barracks":
        damaged_breach = [
            fan_patch(collection, "bar_damaged_hall_breach", (-1.45, 0.82, 3.02), ((-2.7, 0.05, 3.015), (-1.35, -0.18, 3.015), (-0.35, 0.62, 3.015), (-0.72, 1.7, 3.015), (-2.42, 1.62, 3.015)), recess, damaged),
            fan_patch(collection, "bar_damaged_armory_breach", (-3.66, 0.25, 2.0), ((-3.655, -0.72, 1.12), (-3.655, -0.35, 2.62), (-3.655, 0.72, 2.85), (-3.655, 1.28, 1.45)), recess, damaged),
            box(collection, "bar_damaged_entry_notch", (1.28, 0.13, 0.82), (0.72, -2.8, 1.78), recess, damaged, 0.018, (0.08, -0.2, 0.14)),
        ]
        damaged_plate = [
            box(collection, "bar_damaged_hall_slab", (2.3, 1.3, 0.2), (-1.48, 0.85, 3.16), plate, damaged, 0.04, (0.24, -0.2, 0.16)),
            box(collection, "bar_damaged_entry_slab", (1.52, 0.2, 1.1), (0.75, -2.94, 1.72), plate, damaged, 0.035, (0.12, 0.3, -0.18)),
            box(collection, "bar_damaged_service_slab", (0.22, 1.42, 0.92), (3.78, 0.5, 1.42), plate, damaged, 0.035, (0.18, -0.22, 0.2)),
        ]
        damaged_debris = [
            box(collection, "bar_damaged_debris_a", (1.0, 0.66, 0.42), (3.12, -2.85, 0.47), rubble, damaged, 0.035, (0.22, 0.32, -0.36)),
            box(collection, "bar_damaged_debris_b", (0.76, 0.54, 0.4), (2.3, -3.35, 0.45), rubble, damaged, 0.03, (-0.26, 0.38, 0.2)),
            box(collection, "bar_damaged_debris_roof", (0.9, 0.6, 0.34), (-0.48, 1.55, 3.18), rubble, damaged, 0.03, (0.28, -0.18, 0.38)),
        ]
        critical_collapse = [
            fan_patch(collection, "bar_critical_hall_collapse", (-1.3, 0.7, 3.04), ((-3.05, -0.35, 3.035), (-1.02, -0.5, 3.035), (0.72, 0.4, 3.035), (0.05, 1.95, 3.035), (-2.62, 1.9, 3.035)), recess, critical),
            fan_patch(collection, "bar_critical_entry_collapse", (0.55, -2.72, 1.65), ((-0.82, -2.915, 0.72), (1.78, -2.915, 0.8), (1.98, -2.915, 2.62), (-0.3, -2.915, 2.92)), recess, critical),
            tapered_box(collection, "bar_critical_slumped_armory", (2.15, 3.75), (1.35, 2.55), 0.92, (-3.0, 0.45, 2.62), recess, critical, 0.055),
        ]
        critical_plate = [
            box(collection, "bar_critical_roof_slab", (3.35, 1.72, 0.25), (-1.38, 0.78, 2.92), plate, critical, 0.045, (0.44, -0.3, 0.22)),
            box(collection, "bar_critical_entry_slab", (2.18, 0.24, 1.42), (0.58, -3.08, 1.55), plate, critical, 0.045, (0.18, 0.42, -0.22)),
            box(collection, "bar_critical_service_slab", (0.25, 2.05, 1.22), (3.92, 0.48, 1.35), plate, critical, 0.045, (0.28, -0.26, 0.3)),
        ]
        critical_debris = [
            box(collection, "bar_critical_debris_a", (1.25, 0.82, 0.52), (3.15, -3.05, 0.52), rubble, critical, 0.04, (0.3, 0.32, -0.42)),
            box(collection, "bar_critical_debris_b", (0.92, 0.68, 0.48), (2.02, -3.52, 0.5), rubble, critical, 0.04, (-0.24, 0.4, 0.2)),
            box(collection, "bar_critical_debris_c", (0.78, 0.58, 0.46), (3.72, -2.35, 0.48), rubble, critical, 0.035, (0.4, -0.2, 0.48)),
            box(collection, "bar_critical_debris_roof", (1.02, 0.68, 0.4), (-0.2, 1.72, 3.08), rubble, critical, 0.035, (0.32, -0.28, 0.22)),
        ]
    elif profile == "player_reactor":
        damaged_breach = [
            fan_patch(collection, "rct_damaged_core_breach", (1.0, -0.05, 3.35), ((0.35, -0.82, 2.62), (1.45, -0.72, 2.5), (1.82, -0.08, 3.48), (1.28, 0.68, 4.1), (0.32, 0.62, 3.78)), recess, damaged),
            box(collection, "rct_damaged_base_notch", (1.42, 0.14, 0.7), (1.7, -2.82, 1.15), recess, damaged, 0.018, (0.08, -0.18, -0.2)),
            box(collection, "rct_damaged_ring_gap", (1.05, 0.58, 0.2), (-1.2, -1.98, 3.72), recess, damaged, 0.018, (0.18, 0.1, -0.24)),
        ]
        damaged_plate = [
            box(collection, "rct_damaged_core_plate", (1.4, 0.22, 1.42), (1.3, -0.15, 3.32), plate, damaged, 0.04, (0.15, 0.38, -0.16)),
            box(collection, "rct_damaged_ring_clamp", (1.45, 0.36, 0.3), (-1.22, -2.02, 3.82), plate, damaged, 0.035, (0.26, -0.22, 0.32)),
            box(collection, "rct_damaged_cooling_plate", (0.3, 1.5, 1.28), (2.8, 0.82, 1.65), plate, damaged, 0.035, (0.2, -0.28, 0.18)),
        ]
        damaged_debris = [
            box(collection, "rct_damaged_debris_a", (0.95, 0.65, 0.44), (2.72, -2.68, 0.48), rubble, damaged, 0.035, (0.24, 0.32, -0.38)),
            box(collection, "rct_damaged_debris_b", (0.72, 0.52, 0.42), (1.88, -3.18, 0.46), rubble, damaged, 0.03, (-0.28, 0.36, 0.18)),
            box(collection, "rct_damaged_debris_core", (0.82, 0.58, 0.34), (0.92, 0.62, 4.18), rubble, damaged, 0.03, (0.3, -0.2, 0.4)),
        ]
        critical_collapse = [
            fan_patch(collection, "rct_critical_core_collapse", (0.92, 0.0, 3.2), ((-0.18, -1.08, 2.02), (1.55, -1.0, 1.95), (2.18, -0.1, 3.35), (1.48, 1.05, 4.2), (-0.15, 0.92, 3.82)), recess, critical),
            fan_patch(collection, "rct_critical_base_collapse", (1.92, -2.48, 1.32), ((0.45, -2.95, 0.7), (3.12, -2.95, 0.82), (3.3, -2.65, 2.08), (1.05, -2.65, 2.48)), recess, critical),
            tapered_box(collection, "rct_critical_slumped_core", (2.45, 2.3), (1.58, 1.42), 1.08, (0.9, 0.15, 3.62), recess, critical, 0.055),
        ]
        critical_plate = [
            box(collection, "rct_critical_core_slab", (2.08, 0.26, 1.65), (1.3, -0.2, 3.12), plate, critical, 0.045, (0.22, 0.46, -0.22)),
            box(collection, "rct_critical_ring_slab", (2.72, 0.4, 0.34), (-0.78, -2.18, 3.72), plate, critical, 0.045, (0.42, -0.32, 0.28)),
            box(collection, "rct_critical_cooling_slab", (0.3, 2.05, 1.42), (2.98, 0.62, 1.52), plate, critical, 0.045, (0.32, -0.3, 0.34)),
        ]
        critical_debris = [
            box(collection, "rct_critical_debris_a", (1.25, 0.84, 0.54), (2.72, -2.82, 0.52), rubble, critical, 0.04, (0.3, 0.32, -0.44)),
            box(collection, "rct_critical_debris_b", (0.96, 0.72, 0.5), (1.62, -3.35, 0.52), rubble, critical, 0.04, (-0.26, 0.4, 0.2)),
            box(collection, "rct_critical_debris_c", (0.82, 0.62, 0.48), (3.42, -2.05, 0.5), rubble, critical, 0.035, (0.42, -0.22, 0.5)),
            box(collection, "rct_critical_debris_core", (1.05, 0.72, 0.42), (0.18, 1.0, 4.12), rubble, critical, 0.035, (0.34, -0.3, 0.22)),
        ]
    elif profile == "enemy_hq":
        damaged_breach = [
            fan_patch(collection, "en_hq_damaged_roof_breach", (3.82, 2.82, 4.86), ((2.7, 1.72, 4.855), (4.75, 1.9, 4.855), (5.5, 3.15, 4.855), (4.62, 4.18, 4.855), (2.85, 3.88, 4.855)), recess, damaged),
            fan_patch(collection, "en_hq_damaged_pylon_breach", (5.99, -3.28, 2.82), ((5.98, -4.18, 1.72), (5.98, -3.98, 3.98), (5.98, -2.58, 3.65), (5.98, -2.38, 2.05)), recess, damaged),
            box(collection, "en_hq_damaged_brow_notch", (1.82, 0.13, 0.92), (2.8, -4.08, 3.28), recess, damaged, 0.018, (0.08, -0.18, -0.2)),
        ]
        damaged_plate = [
            box(collection, "en_hq_damaged_roof_plate", (2.4, 1.28, 0.2), (3.92, 2.88, 5.02), plate, damaged, 0.04, (0.28, -0.26, 0.18)),
            box(collection, "en_hq_damaged_brow_plate", (1.72, 0.2, 1.08), (2.82, -4.16, 3.22), plate, damaged, 0.035, (0.12, 0.3, -0.2)),
            box(collection, "en_hq_damaged_pylon_plate", (0.2, 1.72, 1.08), (6.08, -3.22, 2.78), plate, damaged, 0.035, (0.18, -0.22, 0.24)),
        ]
        damaged_debris = [
            box(collection, "en_hq_damaged_debris_a", (1.02, 0.68, 0.42), (5.28, -4.35, 0.46), rubble, damaged, 0.035, (0.24, 0.32, -0.38)),
            box(collection, "en_hq_damaged_debris_b", (0.75, 0.52, 0.44), (4.55, -3.62, 0.48), rubble, damaged, 0.03, (-0.28, 0.38, 0.18)),
            box(collection, "en_hq_damaged_debris_roof", (0.9, 0.6, 0.36), (2.92, 3.78, 5.08), rubble, damaged, 0.03, (0.3, -0.18, 0.4)),
        ]
        critical_collapse = [
            fan_patch(collection, "en_hq_critical_roof_collapse", (3.9, 2.8, 4.88), ((2.12, 1.38, 4.875), (4.72, 1.55, 4.875), (5.82, 2.85, 4.875), (4.82, 4.48, 4.875), (2.38, 4.15, 4.875)), recess, critical),
            fan_patch(collection, "en_hq_critical_pylon_collapse", (5.98, -3.2, 2.72), ((5.97, -4.38, 1.2), (5.97, -4.1, 4.38), (5.97, -2.42, 4.02), (5.97, -2.18, 1.65)), recess, critical),
            tapered_box(collection, "en_hq_critical_slumped_pylon", (2.65, 2.5), (1.72, 1.55), 0.9, (4.78, -3.6, 4.48), recess, critical, 0.055),
        ]
        critical_plate = [
            box(collection, "en_hq_critical_roof_slab", (3.2, 1.6, 0.25), (3.82, 2.82, 4.72), plate, critical, 0.045, (0.48, -0.36, 0.24)),
            box(collection, "en_hq_critical_brow_slab", (2.5, 0.24, 1.5), (3.12, -4.32, 3.05), plate, critical, 0.045, (0.18, 0.44, -0.26)),
            box(collection, "en_hq_critical_pylon_slab", (0.24, 2.42, 1.42), (6.18, -3.18, 2.62), plate, critical, 0.045, (0.3, -0.3, 0.34)),
        ]
        critical_debris = [
            box(collection, "en_hq_critical_debris_a", (1.38, 0.86, 0.54), (5.25, -4.42, 0.53), rubble, critical, 0.04, (0.3, 0.32, -0.44)),
            box(collection, "en_hq_critical_debris_b", (1.0, 0.72, 0.5), (4.2, -3.62, 0.52), rubble, critical, 0.04, (-0.26, 0.4, 0.2)),
            box(collection, "en_hq_critical_debris_c", (0.82, 0.62, 0.5), (5.82, -2.65, 0.5), rubble, critical, 0.035, (0.42, -0.22, 0.5)),
            box(collection, "en_hq_critical_debris_roof_a", (1.12, 0.72, 0.42), (2.58, 3.92, 4.98), rubble, critical, 0.035, (0.34, -0.3, 0.22)),
            box(collection, "en_hq_critical_debris_roof_b", (0.8, 0.56, 0.4), (4.68, 3.92, 4.7), rubble, critical, 0.03, (-0.2, 0.38, -0.3)),
        ]
    elif profile == "enemy_factory":
        damaged_breach = [
            fan_patch(collection, "en_fac_damaged_roof_breach", (-2.62, 1.0, 4.9), ((-4.2, 0.0, 4.895), (-2.42, -0.18, 4.895), (-1.02, 0.62, 4.895), (-1.42, 2.25, 4.895), (-3.82, 2.42, 4.895)), recess, damaged),
            fan_patch(collection, "en_fac_damaged_side_breach", (-5.02, 0.28, 2.65), ((-5.01, -0.82, 1.55), (-5.01, -0.15, 3.85), (-5.01, 1.28, 3.92), (-5.01, 1.48, 1.88)), recess, damaged),
            box(collection, "en_fac_damaged_maw_notch", (1.75, 0.13, 1.05), (-2.22, -3.15, 3.18), recess, damaged, 0.018, (0.06, 0.2, 0.16)),
        ]
        damaged_plate = [
            box(collection, "en_fac_damaged_roof_plate", (2.62, 1.3, 0.2), (-2.68, 1.02, 5.02), plate, damaged, 0.04, (0.26, 0.3, -0.18)),
            box(collection, "en_fac_damaged_maw_plate", (1.72, 0.2, 1.2), (-2.28, -3.24, 3.08), plate, damaged, 0.035, (0.1, -0.32, 0.18)),
            box(collection, "en_fac_damaged_side_plate", (0.2, 1.8, 1.12), (-5.13, 0.35, 2.62), plate, damaged, 0.035, (0.18, 0.2, -0.2)),
        ]
        damaged_debris = [
            box(collection, "en_fac_damaged_debris_a", (1.05, 0.68, 0.42), (-4.52, -3.48, 0.46), rubble, damaged, 0.035, (0.22, -0.34, 0.36)),
            box(collection, "en_fac_damaged_debris_b", (0.76, 0.54, 0.44), (-5.12, -2.62, 0.48), rubble, damaged, 0.03, (-0.3, 0.22, -0.2)),
            box(collection, "en_fac_damaged_debris_roof", (0.92, 0.6, 0.36), (-1.45, 2.1, 5.02), rubble, damaged, 0.03, (0.3, 0.2, -0.4)),
        ]
        critical_collapse = [
            fan_patch(collection, "en_fac_critical_roof_collapse", (-2.75, 1.0, 4.91), ((-4.72, -0.2, 4.905), (-2.35, -0.35, 4.905), (-0.72, 0.55, 4.905), (-1.12, 2.72, 4.905), (-4.3, 2.62, 4.905)), recess, critical),
            fan_patch(collection, "en_fac_critical_wall_collapse", (-4.05, -2.9, 2.92), ((-5.18, -3.16, 1.22), (-2.62, -3.16, 1.58), (-2.52, -3.16, 4.48), (-5.05, -3.16, 4.05)), recess, critical),
            tapered_box(collection, "en_fac_critical_slumped_roof", (4.1, 2.72), (2.82, 1.76), 0.86, (-2.72, 1.02, 4.56), recess, critical, 0.055),
        ]
        critical_plate = [
            box(collection, "en_fac_critical_roof_slab", (3.48, 1.7, 0.25), (-2.65, 1.0, 4.8), plate, critical, 0.045, (0.5, 0.32, -0.24)),
            box(collection, "en_fac_critical_maw_slab", (2.32, 0.24, 1.58), (-3.45, -3.4, 2.98), plate, critical, 0.045, (0.2, -0.44, 0.24)),
            box(collection, "en_fac_critical_side_slab", (0.24, 2.42, 1.4), (-5.22, 0.28, 2.52), plate, critical, 0.045, (0.3, 0.22, -0.32)),
        ]
        critical_debris = [
            box(collection, "en_fac_critical_debris_a", (1.4, 0.86, 0.54), (-4.45, -3.62, 0.52), rubble, critical, 0.04, (0.3, -0.34, 0.44)),
            box(collection, "en_fac_critical_debris_b", (1.0, 0.7, 0.5), (-5.42, -2.48, 0.52), rubble, critical, 0.04, (-0.24, 0.42, -0.2)),
            box(collection, "en_fac_critical_debris_c", (0.84, 0.62, 0.48), (-3.32, -2.82, 0.5), rubble, critical, 0.035, (0.42, -0.2, 0.5)),
            box(collection, "en_fac_critical_debris_roof_a", (1.1, 0.72, 0.42), (-1.22, 2.18, 4.9), rubble, critical, 0.035, (0.34, 0.24, -0.34)),
            box(collection, "en_fac_critical_debris_roof_b", (0.8, 0.56, 0.4), (-4.02, 2.18, 4.64), rubble, critical, 0.03, (-0.2, 0.38, 0.28)),
        ]
    elif profile == "enemy_barracks":
        damaged_breach = [
            fan_patch(collection, "en_bar_damaged_roof_breach", (2.35, 1.18, 3.58), ((1.18, 0.48, 3.575), (2.78, 0.38, 3.575), (3.55, 1.18, 3.575), (2.82, 2.12, 3.575), (1.42, 1.92, 3.575)), recess, damaged),
            fan_patch(collection, "en_bar_damaged_side_breach", (3.78, 0.38, 2.05), ((3.775, -0.72, 1.18), (3.775, -0.28, 2.82), (3.775, 1.18, 2.72), (3.775, 1.45, 1.32)), recess, damaged),
            box(collection, "en_bar_damaged_gate_notch", (1.05, 0.14, 0.78), (0.95, -3.5, 2.05), recess, damaged, 0.018, (0.05, -0.22, 0.18)),
        ]
        damaged_plate = [
            box(collection, "en_bar_damaged_roof_plate", (2.35, 1.25, 0.2), (2.42, 1.25, 3.7), plate, damaged, 0.04, (0.26, -0.22, 0.2)),
            box(collection, "en_bar_damaged_gate_plate", (1.18, 0.2, 1.02), (1.02, -3.58, 1.95), plate, damaged, 0.035, (0.12, 0.34, -0.18)),
            box(collection, "en_bar_damaged_side_plate", (0.2, 1.52, 0.92), (3.9, 0.42, 1.98), plate, damaged, 0.035, (0.18, -0.2, 0.22)),
        ]
        damaged_debris = [
            box(collection, "en_bar_damaged_debris_a", (0.92, 0.62, 0.42), (3.35, -3.35, 0.46), rubble, damaged, 0.035, (0.22, 0.34, -0.36)),
            box(collection, "en_bar_damaged_debris_b", (0.7, 0.52, 0.4), (2.58, -2.72, 0.45), rubble, damaged, 0.03, (-0.26, 0.38, 0.2)),
            box(collection, "en_bar_damaged_debris_roof", (0.82, 0.58, 0.34), (1.48, 1.82, 3.72), rubble, damaged, 0.03, (0.28, -0.18, 0.38)),
        ]
        critical_collapse = [
            fan_patch(collection, "en_bar_critical_roof_collapse", (2.2, 1.08, 3.6), ((0.42, -0.12, 3.595), (2.82, -0.2, 3.595), (3.82, 1.05, 3.595), (2.92, 2.62, 3.595), (0.72, 2.35, 3.595)), recess, critical),
            fan_patch(collection, "en_bar_critical_entry_collapse", (1.0, -3.42, 1.9), ((-0.18, -3.515, 0.88), (2.12, -3.515, 0.92), (2.28, -3.515, 2.78), (0.35, -3.515, 3.02)), recess, critical),
            tapered_box(collection, "en_bar_critical_slumped_wing", (2.55, 2.8), (1.62, 1.7), 0.82, (2.55, 1.15, 3.25), recess, critical, 0.05),
        ]
        critical_plate = [
            box(collection, "en_bar_critical_roof_slab", (3.25, 1.62, 0.24), (2.18, 1.08, 3.5), plate, critical, 0.045, (0.48, -0.32, 0.24)),
            box(collection, "en_bar_critical_entry_slab", (2.08, 0.24, 1.48), (1.08, -3.72, 1.82), plate, critical, 0.045, (0.18, 0.44, -0.24)),
            box(collection, "en_bar_critical_side_slab", (0.24, 2.12, 1.25), (4.02, 0.38, 1.82), plate, critical, 0.045, (0.3, -0.28, 0.32)),
        ]
        critical_debris = [
            box(collection, "en_bar_critical_debris_a", (1.22, 0.82, 0.52), (3.4, -3.42, 0.51), rubble, critical, 0.04, (0.3, 0.34, -0.42)),
            box(collection, "en_bar_critical_debris_b", (0.92, 0.68, 0.48), (2.25, -2.62, 0.5), rubble, critical, 0.04, (-0.24, 0.4, 0.2)),
            box(collection, "en_bar_critical_debris_c", (0.76, 0.58, 0.46), (3.92, -2.25, 0.48), rubble, critical, 0.035, (0.4, -0.2, 0.48)),
            box(collection, "en_bar_critical_debris_roof_a", (1.0, 0.68, 0.4), (0.72, 2.05, 3.65), rubble, critical, 0.035, (0.32, -0.28, 0.22)),
        ]
    elif profile == "enemy_reactor":
        damaged_breach = [
            fan_patch(collection, "en_rct_damaged_core_breach", (1.52, -0.08, 3.25), ((0.72, -0.92, 2.62), (1.82, -0.82, 2.48), (2.18, -0.18, 3.48), (1.62, 0.78, 4.02), (0.72, 0.65, 3.62)), recess, damaged),
            box(collection, "en_rct_damaged_base_notch", (1.45, 0.14, 0.72), (1.85, -3.05, 1.25), recess, damaged, 0.018, (0.08, -0.18, -0.2)),
            box(collection, "en_rct_damaged_collar_gap", (1.02, 0.62, 0.2), (-1.2, -1.95, 4.2), recess, damaged, 0.018, (0.18, 0.1, -0.24)),
        ]
        damaged_plate = [
            box(collection, "en_rct_damaged_core_plate", (1.52, 0.22, 1.35), (1.82, -0.28, 3.22), plate, damaged, 0.04, (0.15, 0.38, -0.16)),
            box(collection, "en_rct_damaged_ring_clamp", (1.45, 0.36, 0.3), (-1.25, -2.02, 4.28), plate, damaged, 0.035, (0.26, -0.22, 0.32)),
            box(collection, "en_rct_damaged_cooling_fin", (0.28, 1.55, 1.4), (3.0, 0.82, 2.12), plate, damaged, 0.035, (0.2, -0.28, 0.18)),
        ]
        damaged_debris = [
            box(collection, "en_rct_damaged_debris_a", (0.95, 0.65, 0.44), (2.92, -2.82, 0.48), rubble, damaged, 0.035, (0.24, 0.32, -0.38)),
            box(collection, "en_rct_damaged_debris_b", (0.72, 0.52, 0.42), (2.08, -3.38, 0.46), rubble, damaged, 0.03, (-0.28, 0.36, 0.18)),
            box(collection, "en_rct_damaged_debris_core", (0.82, 0.58, 0.34), (1.28, 0.62, 4.15), rubble, damaged, 0.03, (0.3, -0.2, 0.4)),
        ]
        critical_collapse = [
            fan_patch(collection, "en_rct_critical_core_collapse", (1.35, 0.0, 3.18), ((0.15, -1.22, 2.12), (1.92, -1.08, 2.0), (2.52, -0.12, 3.42), (1.82, 1.18, 4.25), (0.18, 1.02, 3.82)), recess, critical),
            fan_patch(collection, "en_rct_critical_base_collapse", (2.15, -2.7, 1.42), ((0.62, -3.2, 0.72), (3.42, -3.2, 0.88), (3.58, -2.85, 2.2), (1.25, -2.85, 2.65)), recess, critical),
            tapered_box(collection, "en_rct_critical_slumped_core", (2.62, 2.45), (1.72, 1.55), 1.12, (1.28, 0.18, 3.72), recess, critical, 0.055),
        ]
        critical_plate = [
            box(collection, "en_rct_critical_core_slab", (2.2, 0.26, 1.72), (1.75, -0.22, 3.12), plate, critical, 0.045, (0.22, 0.48, -0.22)),
            box(collection, "en_rct_critical_ring_slab", (2.82, 0.4, 0.34), (-0.85, -2.28, 4.15), plate, critical, 0.045, (0.42, -0.32, 0.28)),
            box(collection, "en_rct_critical_fin_slab", (0.3, 2.2, 1.55), (3.18, 0.62, 1.9), plate, critical, 0.045, (0.32, -0.3, 0.34)),
        ]
        critical_debris = [
            box(collection, "en_rct_critical_debris_a", (1.28, 0.84, 0.54), (2.92, -3.0, 0.52), rubble, critical, 0.04, (0.3, 0.32, -0.44)),
            box(collection, "en_rct_critical_debris_b", (0.98, 0.72, 0.5), (1.82, -3.62, 0.52), rubble, critical, 0.04, (-0.26, 0.4, 0.2)),
            box(collection, "en_rct_critical_debris_c", (0.82, 0.62, 0.48), (3.62, -2.2, 0.5), rubble, critical, 0.035, (0.42, -0.22, 0.5)),
            box(collection, "en_rct_critical_debris_core", (1.08, 0.72, 0.42), (0.45, 1.18, 4.18), rubble, critical, 0.035, (0.34, -0.3, 0.22)),
        ]
    else:
        raise ValueError(f"Unknown building damage profile: {profile}")

    damage_parts = (
        join_damage_part("damage_damaged_breach", damaged_breach, damaged),
        join_damage_part("damage_damaged_bent_armor", damaged_plate, damaged),
        join_damage_part("damage_damaged_debris", damaged_debris, damaged),
        join_damage_part("damage_critical_collapse", critical_collapse, critical),
        join_damage_part("damage_critical_bent_armor", critical_plate, critical),
        join_damage_part("damage_critical_debris", critical_debris, critical),
    )
    # Empty.hide_render does not consistently cascade to descendants in Eevee;
    # hide the presentation meshes themselves for the canonical closed preview.
    for part in damage_parts:
        part.hide_render = True
    return damaged, critical


def join_ruin_part(
    name: str,
    objects: list[bpy.types.Object],
    parent: bpy.types.Object,
) -> bpy.types.Object:
    """Collapse one ruin meaning into one stable, single-material primitive."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    active = objects[0]
    bpy.context.view_layer.objects.active = active
    if len(objects) > 1:
        bpy.ops.object.join()
    active.name = name
    active.parent = parent
    active["ruin_part"] = name
    active["readability_feature_min_m"] = 0.45
    active.hide_render = True
    return active


def build_building_ruin_visual(
    collection: bpy.types.Collection,
    building: bpy.types.Object,
    mats: dict[str, bpy.types.Material],
    profile: str,
    *,
    enemy: bool = False,
) -> bpy.types.Object:
    """Author a low, standalone ruin silhouette without changing gameplay nodes."""
    asset_root = building.parent
    asset_root["building_ruin_revision"] = "authored-building-ruin-v1"
    asset_root["ruin_runtime_visibility_owner"] = "scene"
    asset_root["ruin_primitive_budget"] = 4
    asset_root["ruin_triangle_budget"] = 1500
    runtime_budgets = {
        "player_hq": (21, 9100, 8),
        "player_factory": (21, 8700, 7),
        "player_barracks": (19, 6300, 7),
        "player_reactor": (18, 6700, 7),
        "enemy_hq": (19, 7700, 6),
        "enemy_factory": (19, 7100, 6),
        "enemy_barracks": (18, 5800, 6),
        "enemy_reactor": (18, 6200, 6),
    }
    (
        asset_root["runtime_primitive_budget"],
        asset_root["runtime_triangle_budget"],
        asset_root["runtime_material_budget"],
    ) = runtime_budgets[profile]

    ruin = empty(collection, "ruin_visual_root", parent=building)
    ruin["presentation_role"] = "building_ruin"
    ruin["default_visible"] = False
    ruin["runtime_visibility_owner"] = "scene"
    ruin["ruin_profile"] = profile
    ruin["readability_feature_scale_m"] = "0.45-3.50"
    ruin["primitive_budget"] = 4
    ruin["triangle_budget"] = 1500
    ruin.hide_render = True
    marker = empty(collection, "ruin_marker_anchor", (0, 0, 1.0), ruin)
    marker["socket_role"] = "faction_marker_low"

    foundation_mat = mats["recess"] if enemy else mats["dark"]
    structure_mat = mats["armor_dark"] if enemy else mats["panel"]
    machinery_mat = mats["steel"]
    faction_mat = mats["armor"] if enemy else mats["amber"]

    if profile == "player_hq":
        foundation = [
            box(collection, "hq_ruin_base", (12.8, 10.8, 0.42), (0, 0, 0.27), foundation_mat, ruin, 0.12),
            box(collection, "hq_ruin_entry_trench", (3.6, 2.45, 0.2), (0, -5.12, 0.53), foundation_mat, ruin, 0.035, (math.radians(-4), 0, 0)),
            box(collection, "hq_ruin_foundation_split", (0.36, 8.4, 0.18), (2.15, 0.55, 0.57), foundation_mat, ruin, 0.025, (0.02, 0.06, -0.08)),
        ]
        structure = [
            box(collection, "hq_ruin_rear_mass", (8.1, 4.2, 1.45), (0, 1.35, 1.26), structure_mat, ruin, 0.12, (0.03, -0.08, 0.035)),
            tapered_box(collection, "hq_ruin_front_left", (3.4, 3.5), (2.7, 2.8), 1.95, (-3.0, -1.75, 1.38), structure_mat, ruin, 0.1),
            tapered_box(collection, "hq_ruin_front_right", (3.35, 3.35), (2.55, 2.7), 1.72, (3.08, -1.62, 1.28), structure_mat, ruin, 0.1),
            box(collection, "hq_ruin_side_left", (1.9, 3.7, 1.65), (-5.18, 0.45, 1.28), structure_mat, ruin, 0.09, (0.05, 0.12, -0.08)),
            box(collection, "hq_ruin_side_right", (1.75, 3.45, 1.45), (5.22, 0.62, 1.2), structure_mat, ruin, 0.09, (-0.04, -0.14, 0.1)),
            box(collection, "hq_ruin_roof_slab", (5.1, 3.0, 0.42), (0.95, 0.72, 2.48), structure_mat, ruin, 0.06, (0.22, -0.16, 0.11)),
        ]
        machinery = [
            cylinder(collection, "hq_ruin_radar_mast", 0.16, 3.2, (0.75, 0.85, 2.72), machinery_mat, ruin, 10, (0.08, math.pi / 2 - 0.16, 0.2), 0.02),
            torus(
                collection,
                "hq_ruin_radar_ring",
                1.0,
                0.1,
                (2.3, 0.95, 2.48),
                machinery_mat,
                ruin,
                (0.6, 0.48, 0.24),
                (1, 0.78, 1),
                12,
                4,
            ),
            box(collection, "hq_ruin_beam_a", (3.8, 0.28, 0.3), (-1.65, 0.25, 2.54), machinery_mat, ruin, 0.035, (0.16, 0.12, -0.22)),
            box(collection, "hq_ruin_beam_b", (2.65, 0.26, 0.28), (3.25, -0.25, 1.85), machinery_mat, ruin, 0.03, (-0.12, 0.2, 0.42)),
        ]
        faction = [
            box(collection, "hq_ruin_marker_a", (1.3, 0.52, 0.14), (-3.4, -2.92, 1.72), faction_mat, ruin, 0.02, (0.08, 0.18, -0.1)),
            box(collection, "hq_ruin_marker_b", (1.12, 0.48, 0.14), (3.28, -2.75, 1.42), faction_mat, ruin, 0.02, (-0.1, -0.22, 0.18)),
            box(collection, "hq_ruin_marker_ground_a", (0.92, 0.58, 0.12), (-5.05, -3.95, 0.64), faction_mat, ruin, 0.018, (0.08, 0.2, 0.32)),
            box(collection, "hq_ruin_marker_ground_b", (0.78, 0.52, 0.12), (4.72, -4.1, 0.64), faction_mat, ruin, 0.018, (-0.12, 0.24, -0.28)),
        ]
    elif profile == "player_factory":
        foundation = [
            box(collection, "fac_ruin_base", (12.15, 9.15, 0.42), (0, 0, 0.27), foundation_mat, ruin, 0.12),
            box(collection, "fac_ruin_ramp", (5.9, 3.05, 0.22), (0, -5.02, 0.5), foundation_mat, ruin, 0.04, (math.radians(-5), 0, 0)),
            box(collection, "fac_ruin_floor_split", (0.38, 7.4, 0.18), (-2.35, 0.35, 0.57), foundation_mat, ruin, 0.025, (-0.02, -0.05, 0.1)),
        ]
        structure = [
            box(collection, "fac_ruin_rear_hall", (8.55, 3.95, 1.55), (0, 1.28, 1.3), structure_mat, ruin, 0.12, (0.04, 0.08, -0.04)),
            tapered_box(collection, "fac_ruin_front_left", (2.55, 3.45), (1.9, 2.75), 1.8, (-3.78, -1.45, 1.28), structure_mat, ruin, 0.1),
            tapered_box(collection, "fac_ruin_front_right", (2.5, 3.25), (1.8, 2.6), 1.62, (3.82, -1.32, 1.2), structure_mat, ruin, 0.1),
            box(collection, "fac_ruin_side_left", (1.5, 3.8, 1.48), (-5.18, 0.35, 1.2), structure_mat, ruin, 0.085, (0.06, 0.12, -0.1)),
            box(collection, "fac_ruin_side_right", (1.45, 3.55, 1.38), (5.2, 0.48, 1.15), structure_mat, ruin, 0.085, (-0.05, -0.12, 0.08)),
            box(collection, "fac_ruin_roof_slab", (5.55, 2.7, 0.4), (-0.8, 0.78, 2.48), structure_mat, ruin, 0.06, (0.24, 0.14, -0.12)),
        ]
        machinery = [
            cylinder(collection, "fac_ruin_crane_post", 0.28, 2.5, (3.55, 1.8, 1.9), machinery_mat, ruin, 10, (0.18, 0.52, -0.12), 0.025),
            box(collection, "fac_ruin_crane_boom", (5.6, 0.44, 0.46), (1.05, 1.08, 2.52), machinery_mat, ruin, 0.04, (0.27, -0.22, 0.36)),
            cylinder(collection, "fac_ruin_exhaust_a", 0.2, 1.85, (-3.05, 1.75, 2.25), machinery_mat, ruin, 10, (0.16, math.pi / 2 - 0.2, -0.1), 0.02),
            cylinder(collection, "fac_ruin_exhaust_b", 0.19, 1.55, (-1.9, 1.45, 2.05), machinery_mat, ruin, 10, (-0.12, math.pi / 2 + 0.28, 0.18), 0.02),
        ]
        faction = [
            box(collection, "fac_ruin_marker_a", (2.1, 0.42, 0.14), (-2.5, -2.95, 1.58), faction_mat, ruin, 0.02, (0.08, 0.16, -0.12)),
            box(collection, "fac_ruin_marker_b", (1.85, 0.4, 0.14), (2.72, -2.82, 1.4), faction_mat, ruin, 0.02, (-0.08, -0.18, 0.16)),
            box(collection, "fac_ruin_marker_ground_a", (0.94, 0.56, 0.12), (-4.95, -3.62, 0.63), faction_mat, ruin, 0.018, (0.1, 0.2, 0.34)),
            box(collection, "fac_ruin_marker_ground_b", (0.82, 0.52, 0.12), (4.82, -3.72, 0.63), faction_mat, ruin, 0.018, (-0.12, 0.22, -0.3)),
        ]
    elif profile == "player_barracks":
        foundation = [
            box(collection, "bar_ruin_base", (8.7, 7.7, 0.4), (0, 0, 0.25), foundation_mat, ruin, 0.1),
            box(collection, "bar_ruin_entry_trench", (3.35, 2.25, 0.2), (0, -3.28, 0.5), foundation_mat, ruin, 0.035, (math.radians(-4), 0, 0)),
            box(collection, "bar_ruin_foundation_split", (0.32, 5.85, 0.16), (-1.62, 0.15, 0.57), foundation_mat, ruin, 0.022, (0.02, -0.05, 0.09)),
        ]
        structure = [
            tapered_box(collection, "bar_ruin_training_mass", (5.75, 4.25), (4.6, 3.2), 1.28, (-0.55, 0.62, 1.02), structure_mat, ruin, 0.085),
            tapered_box(collection, "bar_ruin_armory_wing", (1.95, 4.65), (1.32, 3.42), 1.5, (-3.15, 0.35, 1.12), structure_mat, ruin, 0.08),
            tapered_box(collection, "bar_ruin_service_wing", (1.58, 3.2), (1.05, 2.2), 1.05, (3.18, 0.55, 0.88), structure_mat, ruin, 0.07),
            box(collection, "bar_ruin_roof_slab", (3.75, 2.45, 0.36), (-0.1, 0.62, 1.92), structure_mat, ruin, 0.055, (0.27, -0.16, 0.13)),
        ]
        machinery = [
            box(collection, "bar_ruin_door_rail", (3.1, 0.28, 0.3), (0.42, -2.72, 1.05), machinery_mat, ruin, 0.035, (0.18, 0.12, -0.25)),
            cylinder(collection, "bar_ruin_service_tank", 0.44, 1.62, (2.82, 1.48, 1.12), machinery_mat, ruin, 10, (0.12, math.pi / 2 - 0.2, -0.1), 0.02),
            box(collection, "bar_ruin_armory_rack", (2.65, 0.32, 0.36), (-2.18, 0.35, 1.92), machinery_mat, ruin, 0.035, (0.2, -0.14, 0.28)),
        ]
        faction = [
            box(collection, "bar_ruin_marker_a", (1.5, 0.44, 0.16), (-2.55, -2.35, 1.22), faction_mat, ruin, 0.02, (0.08, 0.18, -0.12)),
            box(collection, "bar_ruin_marker_b", (1.3, 0.4, 0.16), (2.62, -2.22, 1.05), faction_mat, ruin, 0.02, (-0.1, -0.2, 0.16)),
            box(collection, "bar_ruin_marker_ground", (0.92, 0.58, 0.14), (3.45, -2.92, 0.62), faction_mat, ruin, 0.018, (0.12, 0.22, -0.3)),
        ]
    elif profile == "player_reactor":
        foundation = [
            cylinder(collection, "rct_ruin_base", 3.72, 0.4, (0, 0, 0.26), foundation_mat, ruin, 10, bevel=0.08),
            cylinder(collection, "rct_ruin_inner_step", 2.9, 0.24, (0, 0, 0.55), foundation_mat, ruin, 10, bevel=0.04),
            box(collection, "rct_ruin_base_split", (0.35, 5.25, 0.16), (1.4, 0.22, 0.7), foundation_mat, ruin, 0.022, (0.02, 0.06, -0.1)),
        ]
        structure = [
            cylinder(collection, "rct_ruin_core_mass", 1.48, 1.35, (0.12, 0.2, 1.2), structure_mat, ruin, 10, (0.08, 0.15, -0.06), 0.07),
            tapered_box(collection, "rct_ruin_cooling_left", (1.2, 2.5), (0.78, 1.75), 1.42, (-2.3, 0.55, 1.1), structure_mat, ruin, 0.08),
            tapered_box(collection, "rct_ruin_cooling_right", (1.08, 2.32), (0.72, 1.62), 1.22, (2.4, 0.42, 0.98), structure_mat, ruin, 0.075),
            box(collection, "rct_ruin_core_slab", (2.95, 2.3, 0.4), (0.68, 0.4, 1.92), structure_mat, ruin, 0.055, (0.34, -0.22, 0.16)),
        ]
        machinery = [
            open_constraint_ring(collection, "rct_ruin_broken_ring", (0.48, 0.22, 1.95), 2.0, 0.3, 0.28, 28, 238, 10, machinery_mat, ruin),
            cylinder(collection, "rct_ruin_core_column", 0.4, 2.92, (-0.52, 0.08, 1.98), machinery_mat, ruin, 10, (0.12, math.pi / 2 - 0.18, 0.22), 0.025),
            box(collection, "rct_ruin_constraint_beam", (3.25, 0.32, 0.34), (-0.7, -0.6, 2.08), machinery_mat, ruin, 0.035, (0.18, 0.14, -0.26)),
        ]
        faction = [
            box(collection, "rct_ruin_marker_a", (1.25, 0.48, 0.16), (-2.32, -1.85, 1.1), faction_mat, ruin, 0.02, (0.1, 0.18, -0.12)),
            box(collection, "rct_ruin_marker_b", (1.08, 0.44, 0.16), (2.48, -1.68, 1.0), faction_mat, ruin, 0.02, (-0.1, -0.22, 0.18)),
            box(collection, "rct_ruin_marker_core", (0.88, 0.62, 0.16), (0.85, 0.62, 2.28), faction_mat, ruin, 0.018, (0.22, -0.2, 0.32)),
        ]
    elif profile == "enemy_hq":
        foundation = [
            box(collection, "en_hq_ruin_base", (12.85, 10.85, 0.42), (0, 0, 0.27), foundation_mat, ruin, 0.12),
            box(collection, "en_hq_ruin_entry_trench", (4.1, 2.55, 0.2), (0, -5.05, 0.52), foundation_mat, ruin, 0.035, (math.radians(-4), 0, 0)),
            box(collection, "en_hq_ruin_foundation_split", (0.4, 8.6, 0.18), (2.45, 0.42, 0.57), foundation_mat, ruin, 0.025, (0.02, 0.06, -0.08)),
        ]
        structure = [
            box(collection, "en_hq_ruin_command_mass", (8.4, 6.5, 1.48), (0, 0.32, 1.25), structure_mat, ruin, 0.12, (0.035, -0.07, 0.03)),
            cylinder(collection, "en_hq_ruin_pylon_fl", 1.08, 1.65, (-4.82, -3.72, 1.08), structure_mat, ruin, 8, bevel=0),
            cylinder(collection, "en_hq_ruin_pylon_fr", 1.08, 1.45, (4.82, -3.68, 0.98), structure_mat, ruin, 8, bevel=0),
            cylinder(collection, "en_hq_ruin_pylon_rl", 1.05, 1.38, (-4.78, 3.68, 0.95), structure_mat, ruin, 8, bevel=0),
            cylinder(collection, "en_hq_ruin_pylon_rr", 1.05, 1.55, (4.8, 3.65, 1.04), structure_mat, ruin, 8, bevel=0),
            box(collection, "en_hq_ruin_tower_slab", (4.2, 3.0, 0.48), (0.75, 0.85, 2.35), structure_mat, ruin, 0.07, (0.28, -0.18, 0.14)),
        ]
        machinery = [
            cylinder(collection, "en_hq_ruin_radar_mast", 0.17, 3.1, (0.65, 0.88, 2.68), machinery_mat, ruin, 10, (0.1, math.pi / 2 - 0.14, 0.22), 0.02),
            torus(
                collection,
                "en_hq_ruin_radar_ring",
                1.02,
                0.11,
                (2.2, 0.92, 2.42),
                machinery_mat,
                ruin,
                (0.62, 0.45, 0.26),
                (1, 0.82, 1),
                12,
                4,
            ),
            box(collection, "en_hq_ruin_beam_a", (3.7, 0.3, 0.32), (-1.7, 0.12, 2.48), machinery_mat, ruin, 0.035, (0.18, 0.1, -0.24)),
            box(collection, "en_hq_ruin_beam_b", (2.6, 0.28, 0.3), (3.22, -0.32, 1.8), machinery_mat, ruin, 0.03, (-0.14, 0.22, 0.4)),
        ]
        faction = [
            box(collection, "en_hq_ruin_trim_rear", (10.8, 3.3, 0.15), (0, 3.2, 0.57), faction_mat, ruin, 0.025, (0, 0, -0.03)),
            box(collection, "en_hq_ruin_trim_left", (5.7, 5.0, 0.15), (-3.4, -1.75, 0.57), faction_mat, ruin, 0.025, (0, 0, 0.035)),
            box(collection, "en_hq_ruin_trim_right", (4.6, 4.7, 0.15), (3.55, -1.85, 0.57), faction_mat, ruin, 0.025, (0, 0, -0.045)),
            box(collection, "en_hq_ruin_plate_a", (1.8, 0.52, 0.18), (-3.25, -3.62, 1.55), faction_mat, ruin, 0.025, (0.1, 0.18, -0.12)),
            box(collection, "en_hq_ruin_plate_b", (1.62, 0.5, 0.18), (3.35, -3.5, 1.38), faction_mat, ruin, 0.025, (-0.1, -0.2, 0.16)),
            box(collection, "en_hq_ruin_plate_roof", (1.45, 0.78, 0.18), (0.88, 1.42, 2.64), faction_mat, ruin, 0.022, (0.2, -0.24, 0.34)),
        ]
    elif profile == "enemy_factory":
        foundation = [
            box(collection, "en_fac_ruin_base", (12.15, 9.15, 0.42), (0, 0, 0.27), foundation_mat, ruin, 0.12),
            box(collection, "en_fac_ruin_ramp", (6.0, 3.0, 0.22), (0, -4.95, 0.5), foundation_mat, ruin, 0.04, (math.radians(-5), 0, 0)),
            box(collection, "en_fac_ruin_floor_split", (0.4, 7.45, 0.18), (-2.3, 0.35, 0.57), foundation_mat, ruin, 0.025, (-0.02, -0.05, 0.1)),
        ]
        structure = [
            box(collection, "en_fac_ruin_hall", (8.7, 4.5, 1.52), (0, 0.78, 1.28), structure_mat, ruin, 0.12, (0.04, 0.08, -0.04)),
            tapered_box(collection, "en_fac_ruin_front_left", (2.5, 3.4), (1.85, 2.7), 1.76, (-3.82, -1.42, 1.26), structure_mat, ruin, 0.1),
            tapered_box(collection, "en_fac_ruin_front_right", (2.45, 3.2), (1.78, 2.55), 1.58, (3.85, -1.3, 1.18), structure_mat, ruin, 0.1),
            box(collection, "en_fac_ruin_side_left", (1.45, 3.75, 1.46), (-5.15, 0.38, 1.18), structure_mat, ruin, 0.085, (0.06, 0.12, -0.1)),
            box(collection, "en_fac_ruin_side_right", (1.42, 3.5, 1.36), (5.18, 0.5, 1.14), structure_mat, ruin, 0.085, (-0.05, -0.12, 0.08)),
            box(collection, "en_fac_ruin_roof_slab", (5.6, 2.75, 0.4), (-0.72, 0.75, 2.46), structure_mat, ruin, 0.06, (0.24, 0.14, -0.12)),
        ]
        machinery = [
            cylinder(collection, "en_fac_ruin_crane_post", 0.28, 2.45, (3.5, 1.75, 1.86), machinery_mat, ruin, 10, (0.2, 0.5, -0.14), 0.025),
            box(collection, "en_fac_ruin_crane_boom", (5.5, 0.44, 0.46), (1.0, 1.05, 2.49), machinery_mat, ruin, 0.04, (0.28, -0.23, 0.37)),
            cylinder(collection, "en_fac_ruin_exhaust_a", 0.2, 1.8, (-3.0, 1.7, 2.2), machinery_mat, ruin, 10, (0.16, math.pi / 2 - 0.2, -0.1), 0.02),
            cylinder(collection, "en_fac_ruin_exhaust_b", 0.19, 1.5, (-1.85, 1.4, 2.0), machinery_mat, ruin, 10, (-0.12, math.pi / 2 + 0.28, 0.18), 0.02),
        ]
        faction = [
            box(collection, "en_fac_ruin_trim_rear", (10.3, 2.8, 0.15), (0, 2.65, 0.57), faction_mat, ruin, 0.025, (0, 0, -0.035)),
            box(collection, "en_fac_ruin_trim_left", (5.2, 4.3, 0.15), (-3.3, -1.65, 0.57), faction_mat, ruin, 0.025, (0, 0, 0.04)),
            box(collection, "en_fac_ruin_trim_right", (4.1, 4.0, 0.15), (3.6, -1.75, 0.57), faction_mat, ruin, 0.025, (0, 0, -0.05)),
            box(collection, "en_fac_ruin_rib_a", (4.8, 0.34, 0.18), (-1.15, 0.05, 2.1), faction_mat, ruin, 0.025, (0.12, 0.15, -0.18)),
            box(collection, "en_fac_ruin_rib_b", (4.2, 0.34, 0.18), (1.45, 1.32, 2.35), faction_mat, ruin, 0.025, (-0.1, -0.16, 0.22)),
            box(collection, "en_fac_ruin_plate_ground", (1.15, 0.7, 0.18), (-4.65, -3.55, 0.66), faction_mat, ruin, 0.022, (0.14, 0.2, 0.38)),
        ]
    elif profile == "enemy_barracks":
        foundation = [
            box(collection, "en_bar_ruin_base", (8.45, 7.35, 0.4), (0, 0, 0.26), foundation_mat, ruin, 0.1),
            box(collection, "en_bar_ruin_entry_trench", (2.65, 2.45, 0.2), (0, -3.75, 0.5), foundation_mat, ruin, 0.035, (math.radians(-4), 0, 0)),
            box(collection, "en_bar_ruin_floor_split", (0.34, 5.6, 0.16), (1.55, 0.25, 0.55), foundation_mat, ruin, 0.022, (0.02, 0.05, -0.08)),
        ]
        structure = [
            tapered_box(collection, "en_bar_ruin_left_wing", (3.1, 4.9), (2.4, 3.9), 1.45, (-2.22, 0.35, 1.05), structure_mat, ruin, 0.09),
            tapered_box(collection, "en_bar_ruin_right_wing", (2.95, 4.65), (2.25, 3.65), 1.28, (2.3, 0.48, 0.98), structure_mat, ruin, 0.09),
            box(collection, "en_bar_ruin_rear_mass", (5.8, 2.25, 1.25), (0, 2.1, 1.0), structure_mat, ruin, 0.08, (0.04, -0.08, 0.03)),
            box(collection, "en_bar_ruin_roof_slab", (3.8, 2.35, 0.36), (0.65, 0.68, 1.95), structure_mat, ruin, 0.055, (0.26, -0.16, 0.12)),
        ]
        machinery = [
            cylinder(collection, "en_bar_ruin_comm_mast", 0.14, 2.85, (-2.55, 1.2, 2.0), machinery_mat, ruin, 10, (0.08, math.pi / 2 - 0.18, 0.24), 0.018),
            box(collection, "en_bar_ruin_comm_crossbar", (2.15, 0.24, 0.24), (-1.2, 1.0, 1.92), machinery_mat, ruin, 0.03, (0.18, 0.12, -0.28)),
            cylinder(collection, "en_bar_ruin_service_tank", 0.48, 1.5, (2.85, 1.65, 1.05), machinery_mat, ruin, 10, (0.12, math.pi / 2 - 0.2, -0.08), 0.02),
        ]
        faction = [
            box(collection, "en_bar_ruin_marker_a", (1.45, 0.42, 0.16), (-2.42, -2.35, 1.25), faction_mat, ruin, 0.02, (0.08, 0.18, -0.12)),
            box(collection, "en_bar_ruin_marker_b", (1.28, 0.4, 0.16), (2.55, -2.25, 1.12), faction_mat, ruin, 0.02, (-0.1, -0.2, 0.16)),
            box(collection, "en_bar_ruin_marker_ground", (0.92, 0.58, 0.14), (3.35, -2.95, 0.62), faction_mat, ruin, 0.018, (0.12, 0.22, -0.3)),
        ]
    elif profile == "enemy_reactor":
        foundation = [
            cylinder(collection, "en_rct_ruin_base", 3.72, 0.4, (0, 0, 0.26), foundation_mat, ruin, 10, bevel=0.08),
            cylinder(collection, "en_rct_ruin_inner_step", 2.92, 0.24, (0, 0, 0.55), foundation_mat, ruin, 10, bevel=0.04),
            box(collection, "en_rct_ruin_base_split", (0.35, 5.3, 0.16), (1.45, 0.25, 0.7), foundation_mat, ruin, 0.022, (0.02, 0.06, -0.1)),
        ]
        structure = [
            cylinder(collection, "en_rct_ruin_core_mass", 1.62, 1.42, (0.15, 0.22, 1.25), structure_mat, ruin, 10, (0.08, 0.15, -0.06), 0.07),
            tapered_box(collection, "en_rct_ruin_cooling_left", (1.25, 2.6), (0.82, 1.85), 1.5, (-2.35, 0.62, 1.15), structure_mat, ruin, 0.08),
            tapered_box(collection, "en_rct_ruin_cooling_right", (1.15, 2.45), (0.76, 1.72), 1.3, (2.42, 0.45, 1.02), structure_mat, ruin, 0.08),
            box(collection, "en_rct_ruin_core_slab", (3.1, 2.45, 0.4), (0.75, 0.42, 2.02), structure_mat, ruin, 0.055, (0.34, -0.22, 0.16)),
        ]
        machinery = [
            torus(collection, "en_rct_ruin_broken_ring", 2.1, 0.18, (0.55, 0.28, 1.98), machinery_mat, ruin, (0.62, 0.38, 0.24), (1, 0.82, 1), 12, 4),
            cylinder(collection, "en_rct_ruin_core_column", 0.42, 3.05, (-0.55, 0.12, 2.05), machinery_mat, ruin, 10, (0.12, math.pi / 2 - 0.18, 0.22), 0.025),
            box(collection, "en_rct_ruin_constraint_beam", (3.45, 0.32, 0.34), (-0.75, -0.65, 2.18), machinery_mat, ruin, 0.035, (0.18, 0.14, -0.26)),
        ]
        faction = [
            box(collection, "en_rct_ruin_marker_a", (1.25, 0.48, 0.16), (-2.38, -1.92, 1.15), faction_mat, ruin, 0.02, (0.1, 0.18, -0.12)),
            box(collection, "en_rct_ruin_marker_b", (1.08, 0.44, 0.16), (2.55, -1.72, 1.02), faction_mat, ruin, 0.02, (-0.1, -0.22, 0.18)),
            box(collection, "en_rct_ruin_marker_core", (0.88, 0.62, 0.16), (0.92, 0.65, 2.38), faction_mat, ruin, 0.018, (0.22, -0.2, 0.32)),
        ]
    else:
        raise ValueError(f"Unknown building ruin profile: {profile}")

    join_ruin_part("ruin_foundation", foundation, ruin)
    join_ruin_part("ruin_collapsed_structure", structure, ruin)
    join_ruin_part("ruin_broken_machinery", machinery, ruin)
    join_ruin_part("ruin_faction_debris", faction, ruin)
    return ruin


def tag_infantry_silhouette(root: bpy.types.Object, profile: str, markers: str) -> None:
    """Persist the strategic-camera readability contract through the rigging pass."""
    root["silhouette_revision"] = "strategic-infantry-v2"
    root["silhouette_profile"] = profile
    root["silhouette_markers"] = markers
    root["readability_feature_scale_m"] = "0.35-0.60"
    root["material_budget"] = 6


def tag_gold_building(
    root: bpy.types.Object,
    silhouette_profile: str,
    footprint: str,
    entrance_depth: str,
    primitive_budget: int,
) -> None:
    """Persist the desktop strategic-camera art contract in the exported GLB."""
    root["visual_gold_revision"] = "desktop-building-gold-v2"
    root["silhouette_profile"] = silhouette_profile
    root["footprint_m"] = footprint
    root["entrance_depth_m"] = entrance_depth
    root["surface_feature_scale_m"] = "0.35-1.20"
    root["surface_treatment"] = "panel-breakup,bevel-highlight,service-access,controlled-wear"
    root["wear_source"] = "shared-authored-pbr"
    root["wear_localization"] = "base,entry,vent,service"
    root["material_budget"] = 8
    root["runtime_primitive_budget"] = primitive_budget


def tune_gold_building_materials(mats: dict[str, bpy.types.Material]) -> None:
    """Lift existing PBR breakup at the strategic camera without adding textures."""
    normal_strengths = {
        "panel": 0.32,
        "gunmetal": 0.30,
        "dark": 0.27,
        "steel": 0.20,
        "amber": 0.28,
    }
    for key, strength in normal_strengths.items():
        material = mats[key]
        normal_map = next(
            (node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeNormalMap"),
            None,
        )
        if normal_map is not None:
            normal_map.inputs["Strength"].default_value = strength


def is_under(obj: bpy.types.Object, ancestor: bpy.types.Object) -> bool:
    current = obj.parent
    while current is not None:
        if current == ancestor:
            return True
        current = current.parent
    return False


def nearest_runtime_domain(
    obj: bpy.types.Object,
    domains: set[bpy.types.Object],
    fallback: bpy.types.Object,
) -> bpy.types.Object:
    """Keep nested yaw/pitch meshes with their nearest code-driven parent."""
    current = obj.parent
    while current is not None:
        if current in domains:
            return current
        current = current.parent
    return fallback


def consolidate_runtime_asset(collection: bpy.types.Collection, root: bpy.types.Object) -> None:
    """Merge static meshes by material while preserving gameplay/animation empties."""
    meshes = [obj for obj in collection.all_objects if obj.type == "MESH"]
    for obj in meshes:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)

    domains = {
        obj
        for obj in collection.all_objects
        if obj.name in RUNTIME_ANIMATION_DOMAINS
        or obj.name.startswith(RUNTIME_ANIMATION_PREFIXES)
    }
    presentation_roots = {
        obj
        for obj in collection.all_objects
        if obj.name in {
            "wreck_visual_root",
            "damage_visual_damaged",
            "damage_visual_critical",
            "ruin_visual_root",
        }
    }
    presentation_meshes = {
        obj
        for obj in meshes
        if any(is_under(obj, presentation_root) for presentation_root in presentation_roots)
    }
    groups: dict[tuple[str, str], list[bpy.types.Object]] = {}
    domain_lookup = {root.name: root, **{obj.name: obj for obj in domains}}
    for obj in meshes:
        if obj in presentation_meshes:
            continue
        domain = nearest_runtime_domain(obj, domains, root)
        material_name = obj.data.materials[0].name if obj.data.materials else "Unassigned"
        groups.setdefault((domain.name, material_name), []).append(obj)

    for (domain_name, material_name), objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        if len(objects) > 1:
            bpy.ops.object.join()
        world_matrix = active.matrix_world.copy()
        active.parent = domain_lookup[domain_name]
        active.matrix_world = world_matrix
        active.name = f"{domain_name}_{material_name}_runtime"


def export_asset(asset_id: str, collection: bpy.types.Collection, root: bpy.types.Object, preview_target, camera_location, ortho_scale):
    output_dir = PROJECT_ROOT / "assets" / "3d" / asset_id
    output_dir.mkdir(parents=True, exist_ok=True)
    materials = {mat.name: mat for mat in bpy.data.materials}
    preview_materials = {"ground": materials["M_PreviewGround"]}
    ground, camera = add_preview(collection, preview_materials, camera_location, preview_target, ortho_scale)
    smart_uv(collection)
    blend_path = output_dir / f"{asset_id}_v1.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    consolidate_runtime_asset(collection, root)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.all_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    glb_path = output_dir / f"{asset_id}_v1.glb"
    bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_extras=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.055, 0.06, 0.055, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.34
    scene.render.filepath = str(output_dir / f"{asset_id}_v1_preview.png")
    if not SKIP_PREVIEW:
        bpy.ops.render.render(write_still=True)
        wreck_root = bpy.data.objects.get("wreck_visual_root")
        if wreck_root is not None:
            wreck_meshes = {obj for obj in collection.all_objects if obj.type == "MESH" and is_under(obj, wreck_root)}
            normal_meshes = {obj for obj in collection.all_objects if obj.type == "MESH"} - wreck_meshes
            for obj in normal_meshes:
                obj.hide_render = True
            wreck_root.hide_render = False
            scene.render.filepath = str(output_dir / f"{asset_id}_v1_wreck_preview.png")
            bpy.ops.render.render(write_still=True)
            wreck_root.hide_render = True
            for obj in normal_meshes:
                obj.hide_render = False
        if asset_id in {"ff_ref_01", "ff_en_ref_01"}:
            # Keep the canonical preview as the closed gameplay baseline and
            # render a second authored proof with the code-driven gate at its
            # documented travel limit. The GLB was exported before this move.
            gate = bpy.data.objects.get("intake_gate")
            if gate is not None:
                baseline_z = gate.location.z
                gate.location.z = baseline_z + float(gate.get("travel_m", 1.45))
                bpy.context.view_layer.update()
                scene.render.filepath = str(output_dir / f"{asset_id}_v1_unload_preview.png")
                bpy.ops.render.render(write_still=True)
                gate.location.z = baseline_z
                bpy.context.view_layer.update()
        damaged_root = bpy.data.objects.get("damage_visual_damaged")
        critical_root = bpy.data.objects.get("damage_visual_critical")
        if damaged_root is not None and critical_root is not None:
            damaged_meshes = [
                obj
                for obj in collection.all_objects
                if obj.type == "MESH" and is_under(obj, damaged_root)
            ]
            critical_meshes = [
                obj
                for obj in collection.all_objects
                if obj.type == "MESH" and is_under(obj, critical_root)
            ]
            for obj in damaged_meshes:
                obj.hide_render = False
            bpy.context.view_layer.update()
            scene.render.filepath = str(output_dir / f"{asset_id}_v1_damaged_preview.png")
            bpy.ops.render.render(write_still=True)
            for obj in damaged_meshes:
                obj.hide_render = True
            for obj in critical_meshes:
                obj.hide_render = False
            bpy.context.view_layer.update()
            scene.render.filepath = str(output_dir / f"{asset_id}_v1_critical_preview.png")
            bpy.ops.render.render(write_still=True)
            for obj in critical_meshes:
                obj.hide_render = True
            bpy.context.view_layer.update()
        ruin_root = bpy.data.objects.get("ruin_visual_root")
        if ruin_root is not None:
            ruin_meshes = {
                obj
                for obj in collection.all_objects
                if obj.type == "MESH" and is_under(obj, ruin_root)
            }
            all_asset_meshes = {
                obj
                for obj in collection.all_objects
                if obj.type == "MESH"
            }
            original_hide_render = {
                obj: obj.hide_render
                for obj in all_asset_meshes
            }
            for obj in all_asset_meshes:
                obj.hide_render = obj not in ruin_meshes
            ruin_root.hide_render = False
            bpy.context.view_layer.update()
            scene.render.filepath = str(output_dir / f"{asset_id}_v1_ruin_preview.png")
            bpy.ops.render.render(write_still=True)
            ruin_root.hide_render = True
            for obj, hidden in original_hide_render.items():
                obj.hide_render = hidden
            bpy.context.view_layer.update()
    return glb_path, ground, camera


def build_harvester() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_HRV_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_HRV_01")
    root["asset_id"] = "ff_hrv_01"
    root["asset_role"] = "resource_harvester"
    chassis = empty(collection, "chassis_root", parent=root)
    for side, x in (("L", -1.5), ("R", 1.5)):
        track = empty(collection, f"track_{side.lower()}", parent=chassis)
        box(collection, f"track_bed_{side}", (0.62, 4.9, 0.72), (x, 0, 0.6), mats["rubber"], track, 0.12)
        box(collection, f"track_guard_{side}", (0.72, 4.6, 0.25), (x, 0, 1.05), mats["gunmetal"], track)
        for index, y in enumerate((-1.75, -0.88, 0, 0.88, 1.75)):
            cylinder(collection, f"wheel_{side}_{index}", 0.42, 0.24, (x + (-0.32 if x < 0 else 0.32), y, 0.58), mats["rubber"], track, 18, (0, math.pi / 2, 0))
            cylinder(collection, f"hub_{side}_{index}", 0.2, 0.26, (x + (-0.46 if x < 0 else 0.46), y, 0.58), mats["gunmetal"] if index in (0, 4) else mats["steel"], track, 14, (0, math.pi / 2, 0))
        for index, y in enumerate([-2.0 + i * 0.36 for i in range(12)]):
            box(collection, f"tread_top_{side}_{index}", (0.72, 0.28, 0.12), (x, y, 1.16), mats["rubber"], track, 0.014)
            box(collection, f"tread_bottom_{side}_{index}", (0.72, 0.28, 0.12), (x, y, 0.12), mats["rubber"], track, 0.014)
        for end_sign in (-1, 1):
            for arc_index, degrees in enumerate((-66, -33, 0, 33, 66)):
                angle = math.radians(degrees)
                box(
                    collection,
                    f"tread_arc_{side}_{end_sign:+d}_{arc_index}",
                    (0.72, 0.28, 0.12),
                    (x, end_sign * (2.02 + math.cos(angle) * 0.36), 0.64 + math.sin(angle) * 0.52),
                    mats["rubber"],
                    track,
                    0.012,
                    (end_sign * angle, 0, 0),
                )
    box(collection, "lower_hull", (2.85, 4.7, 0.62), (0, 0.05, 0.86), mats["gunmetal"], chassis, 0.12)
    box(collection, "upper_hull", (2.55, 3.9, 0.55), (0, 0.18, 1.35), mats["panel"], chassis, 0.1)
    cabin = empty(collection, "cabin_root", (0, 0, 0), chassis)
    box(collection, "armored_cabin", (2.25, 1.75, 1.35), (0, 0.25, 2.1), mats["panel"], cabin, 0.14)
    box(collection, "cabin_roof_armor", (2.0, 1.48, 0.18), (0, 0.32, 2.84), mats["gunmetal"], cabin, 0.035)
    box(collection, "front_windshield", (1.72, 0.08, 0.5), (0, -0.65, 2.25), mats["glass"], cabin, 0.025, (math.radians(10), 0, 0))
    for x in (-0.72, 0.72):
        box(collection, f"cabin_marker_{x}", (0.34, 0.12, 0.16), (x, -0.72, 1.86), mats["cyan"], cabin, 0.025)
    cargo = empty(collection, "cargo_bed", (0, 0, 0), chassis)
    box(collection, "cargo_bin", (2.35, 1.7, 0.9), (0, 1.45, 1.75), mats["dark"], cargo, 0.12)
    for x in (-0.92, 0.92):
        box(collection, f"cargo_sidewall_{x:+.2f}", (0.18, 1.82, 1.05), (x, 1.45, 2.05), mats["gunmetal"], cargo, 0.035)
        box(collection, f"cargo_marker_{x:+.2f}", (0.055, 0.62, 0.16), (x + (-0.11 if x < 0 else 0.11), 1.12, 2.08), mats["amber"], cargo, 0.012)
    for index, x in enumerate((-0.7, 0, 0.7)):
        slot = empty(collection, f"cargo_slot_{index}", (x, 1.42, 2.55 + abs(x) * 0.15), cargo)
        slot["socket_role"] = "cargo_stage"
        crystal(collection, f"cargo_crystal_{index}", (0, 0, 0), (0.28, 0.28, 0.72), mats["crystal"], slot)
    resource_socket = empty(collection, "resource_socket", (0, 1.45, 2.35), cargo)
    resource_socket["socket_role"] = "cargo_visual_origin"
    collector = empty(collection, "collector_head", (0, -2.45, 0.62), chassis)
    cylinder(collection, "collector_drum", 0.62, 2.7, (0, 0, 0), mats["steel"], collector, 18, (0, math.pi / 2, 0), 0.04)
    for index in range(10):
        angle = index * math.tau / 10
        for x in (-1.18, 0, 1.18):
            tooth = box(collection, f"collector_tooth_{index}_{x}", (0.16, 0.48, 0.16), (x, -math.sin(angle) * 0.68, math.cos(angle) * 0.68), mats["amber"], collector, 0.025, (angle, 0, 0))
            tooth.rotation_euler.x = angle
    for x in (-1.38, 1.38):
        box(collection, f"collector_arm_{x}", (0.24, 1.65, 0.28), (x, 0.7, 0.38), mats["gunmetal"], collector, 0.04, (math.radians(-14), 0, 0))
        box(collection, f"collector_arm_mark_{x}", (0.27, 0.34, 0.13), (x, 0.0, 0.58), mats["amber"], collector, 0.018, (math.radians(-14), 0, 0))
    box(collection, "collector_guard", (2.95, 0.28, 0.22), (0, -0.55, 0.86), mats["gunmetal"], collector, 0.035)
    for x in (-0.78, 0, 0.78):
        box(collection, f"collector_signal_{x:+.2f}", (0.34, 0.07, 0.08), (x, -0.72, 0.88), mats["cyan"], collector, 0.01)
    exhaust = cylinder(collection, "exhaust_stack", 0.12, 1.15, (0.96, 1.62, 2.62), mats["steel"], chassis, 12)
    exhaust.rotation_euler.x = 0.08
    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    build_vehicle_wreck(collection, root, mats, "hrv")
    glb_path, ground, camera = export_asset("ff_hrv_01", collection, root, (0, 0, 1.35), (7.8, -9.4, 7.4), 7.5)
    sprite_dir = PROJECT_ROOT / "assets" / "sprites" / "ff_hrv_01"
    sprite_dir.mkdir(parents=True, exist_ok=True)
    ground.hide_render = True
    scene = bpy.context.scene
    scene.render.resolution_x = 192
    scene.render.resolution_y = 192
    scene.render.film_transparent = True
    camera.data.ortho_scale = 7.1
    for index in range(8):
        root.rotation_euler.z = math.radians(index * 45)
        if not SKIP_SPRITES:
            scene.render.filepath = str(sprite_dir / f"body_{index:02d}.png")
            bpy.ops.render.render(write_still=True)
    root.rotation_euler.z = 0
    print(f"FF_HRV_01_GLB={glb_path}")


def build_hq() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_HQ_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_HQ_01")
    root["asset_id"] = "ff_hq_01"
    root["asset_role"] = "command_headquarters"
    building = empty(collection, "building_root", parent=root)
    box(collection, "foundation", (13.2, 11.2, 0.5), (0, 0, 0.3), mats["dark"], building, 0.16)
    box(collection, "foundation_trim", (12.6, 10.6, 0.25), (0, 0, 0.62), mats["gunmetal"], building, 0.06)
    box(collection, "main_bunker", (8.5, 7.4, 3.1), (0, 0.15, 2.15), mats["panel"], building, 0.2)
    box(collection, "main_bunker_band", (8.8, 7.7, 0.32), (0, 0.15, 3.55), mats["gunmetal"], building, 0.08)
    for x in (-3.25, 0, 3.25):
        box(collection, f"bunker_roof_plate_{x:+.2f}", (2.65, 5.9, 0.14), (x, 0.18, 3.83), mats["gunmetal"], building, 0.035)
    for x, y in ((-5.35, -4.45), (5.35, -4.45), (-5.35, 4.45), (5.35, 4.45)):
        box(collection, f"foundation_marker_{x:+.2f}_{y:+.2f}", (0.62, 0.62, 0.16), (x, y, 0.82), mats["amber"], building, 0.025)
    for x in (-5.1, 5.1):
        for y in (-4.05, 4.05):
            pylon = empty(collection, f"corner_pylon_{x}_{y}", parent=building)
            box(collection, "pylon_body", (2.15, 2.15, 3.4), (x, y, 2.15), mats["gunmetal"], pylon, 0.16)
            cylinder(collection, "pylon_cap", 0.88, 0.35, (x, y, 4.02), mats["gunmetal"], pylon, 12)
            cylinder(collection, "pylon_light", 0.28, 0.32, (x, y, 4.42), mats["cyan"], pylon, 12)
    box(collection, "front_gate", (3.3, 0.32, 2.35), (0, -3.72, 1.55), mats["dark"], building, 0.06)
    box(collection, "front_gate_panel", (2.45, 0.12, 1.55), (0, -3.91, 1.45), mats["glass"], building, 0.03)
    for x in (-3.15, 3.15):
        box(collection, f"front_brace_{x}", (0.46, 0.7, 3.4), (x, -3.6, 2.2), mats["gunmetal"], building, 0.06, (0, math.radians(-8 if x < 0 else 8), 0))
        box(collection, f"front_brace_mark_{x}", (0.12, 0.76, 1.55), (x + (-0.25 if x < 0 else 0.25), -3.62, 2.3), mats["amber"], building, 0.018, (0, math.radians(-8 if x < 0 else 8), 0))
    tower = empty(collection, "command_tower", (0, 0, 0), building)
    box(collection, "tower_lower", (4.8, 4.5, 1.4), (0, 0.4, 4.35), mats["gunmetal"], tower, 0.16)
    box(collection, "tower_upper", (3.7, 3.4, 1.45), (0, 0.3, 5.7), mats["panel"], tower, 0.15)
    box(collection, "tower_cap", (3.15, 2.85, 0.22), (0, 0.3, 6.52), mats["gunmetal"], tower, 0.045)
    for x in (-1.15, 0, 1.15):
        box(collection, f"tower_signal_{x}", (0.72, 0.12, 0.24), (x, -1.43, 5.7), mats["cyan"], tower, 0.025)
    radar = empty(collection, "radar_yaw", (0, 0.3, 6.5), tower)
    radar["spin_speed"] = 0.22
    cylinder(collection, "radar_mast", 0.18, 1.5, (0, 0, 0.75), mats["steel"], radar, 12)
    dish = cylinder(collection, "radar_dish", 1.7, 0.18, (0, 0, 1.5), mats["gunmetal"], radar, 24, (math.radians(68), 0, 0), 0.04)
    dish.scale.y = 0.72
    torus(collection, "radar_dish_rim", 1.55, 0.09, (0, 0, 1.5), mats["steel"], radar, (math.radians(68), 0, 0), (1, 0.72, 1))
    cylinder(collection, "radar_emitter", 0.22, 0.65, (0, -0.48, 2.05), mats["cyan"], radar, 12, (math.radians(68), 0, 0))
    for y in (-2.65, 0, 2.65):
        box(collection, f"side_module_left_{y}", (1.2, 1.55, 1.3), (-4.8, y, 1.35), mats["gunmetal"], building, 0.1)
        box(collection, f"side_module_right_{y}", (1.2, 1.55, 1.3), (4.8, y, 1.35), mats["gunmetal"], building, 0.1)
    spawn = empty(collection, "spawn_socket", (0, -7.2, 0), root)
    spawn["socket_role"] = "unit_spawn"
    rally = empty(collection, "rally_socket", (0, -9.0, 0), root)
    rally["socket_role"] = "default_rally"
    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_hq_01", collection, root, (0, 0, 3.2), (15, -17, 14), 18.0)
    print(f"FF_HQ_01_GLB={glb_path}")


def build_refinery() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_REF_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_REF_01")
    root["asset_id"] = "ff_ref_01"
    root["asset_role"] = "resource_refinery"
    root["provenance"] = "project_procedural_blender"
    root["asset_revision"] = "refinery-unload-mechanism-v2"
    root["render_profile"] = "strategic-camera-standard"
    root["footprint_m"] = "11.4x9.4"
    root["unload_mechanism"] = "intake_gate,intake_conveyor,intake_collector"
    root["intake_gate_travel_m"] = 1.45
    root["conveyor_travel_m"] = 0.45
    root["collector_spin_axis"] = "X"
    root["runtime_primitive_budget"] = 12
    root["runtime_triangle_budget"] = 5000
    root["runtime_material_budget"] = 6
    building = empty(collection, "building_root", parent=root)
    box(collection, "foundation", (11.4, 9.4, 0.46), (0, 0, 0.28), mats["dark"], building, 0.14)
    box(collection, "foundation_trim", (10.9, 8.9, 0.24), (0, 0, 0.58), mats["gunmetal"], building, 0.06)
    box(collection, "processing_hall", (6.4, 5.6, 3.15), (-1.7, 0.45, 2.1), mats["panel"], building, 0.18)
    box(collection, "processing_band", (6.7, 5.9, 0.28), (-1.7, 0.45, 3.55), mats["gunmetal"], building, 0.07)
    for y in (-1.55, 0.45, 2.45):
        box(collection, f"hall_side_rib_{y:+.2f}", (6.7, 0.18, 2.7), (-1.7, y, 2.08), mats["gunmetal"], building, 0.035)
    for x in (-3.6, -1.7, 0.2):
        box(collection, f"roof_vent_{x}", (1.05, 1.7, 0.42), (x, 0.4, 3.93), mats["dark"], building, 0.08)
    silo = empty(collection, "storage_silo", parent=building)
    cylinder(collection, "silo_body", 1.75, 4.9, (3.55, 0.3, 2.7), mats["gunmetal"], silo, 20, (0, 0, 0), 0.06)
    for z in (1.05, 2.2, 3.35, 4.65):
        cylinder(collection, f"silo_band_{z}", 1.86, 0.18, (3.55, 0.3, z), mats["amber"] if z == 3.35 else mats["steel"], silo, 20)
    cylinder(collection, "silo_cap", 1.78, 0.3, (3.55, 0.3, 5.22), mats["panel"], silo, 20)
    intake = empty(collection, "intake_bay", parent=building)
    ramp = box(collection, "intake_ramp", (5.2, 2.7, 0.28), (-1.45, -4.5, 0.55), mats["steel"], intake, 0.05, (math.radians(-6), 0, 0))
    ramp.rotation_euler.x = math.radians(-6)
    # The fixed ramp and side rails remain under intake_bay. Only the three
    # mechanism empties below are animated by the runtime deposit presentation.
    for x in (-3.83, 0.93):
        box(collection, f"intake_side_rail_{x:+.2f}", (0.24, 2.72, 0.55), (x, -4.48, 0.84), mats["gunmetal"], intake, 0.035, (math.radians(-6), 0, 0))
    box(collection, "intake_lintel", (5.05, 0.36, 0.42), (-1.45, -2.92, 2.32), mats["gunmetal"], intake, 0.045)

    gate = empty(collection, "intake_gate", (-1.45, -2.92, 0), intake)
    gate["presentation_role"] = "deposit_gate"
    gate["motion_axis"] = "+Y"
    gate["travel_m"] = 1.45
    for x in (-1.64, -0.82, 0, 0.82, 1.64):
        box(collection, f"intake_gate_panel_{x:+.2f}", (0.68, 0.2, 1.62), (x, 0, 1.35), mats["gunmetal"], gate, 0.035)
    box(collection, "powered_intake_gate_band", (3.75, 0.12, 0.18), (0, -0.14, 1.35), mats["cyan"], gate, 0.02)

    conveyor = empty(collection, "intake_conveyor", (-1.45, -4.48, 0), intake)
    conveyor["presentation_role"] = "deposit_conveyor"
    conveyor["motion_axis"] = "-Z"
    conveyor["travel_m"] = 0.45
    for index, y in enumerate((-1.35, -0.9, -0.45, 0, 0.45, 0.9, 1.35)):
        z = 0.72 + (y + 1.35) * 0.105
        box(collection, f"conveyor_slat_{index}", (4.2, 0.18, 0.12), (0, y, z), mats["amber"] if index % 3 == 0 else mats["gunmetal"], conveyor, 0.018, (math.radians(-6), 0, 0))

    collector = empty(collection, "intake_collector", (-1.45, -3.18, 1.02), intake)
    collector["presentation_role"] = "deposit_collector"
    collector["spin_axis"] = "X"
    collector["spin_speed"] = 5.2
    cylinder(collection, "intake_collector_drum", 0.43, 4.0, (0, 0, 0), mats["steel"], collector, 14, (0, math.pi / 2, 0), 0.035)
    for index in range(8):
        angle = index * math.tau / 8
        for x in (-1.62, -0.82, 0, 0.82, 1.62):
            box(
                collection,
                f"intake_collector_tooth_{index}_{x:+.2f}",
                (0.16, 0.38, 0.16),
                (x, -math.sin(angle) * 0.46, math.cos(angle) * 0.46),
                mats["amber"],
                collector,
                0.015,
                (angle, 0, 0),
            )
    for x in (-3.15, -2.3, -1.45, -0.6, 0.25):
        if x in (-3.15, -1.45, 0.25):
            box(collection, f"ramp_marker_{x}", (0.22, 2.3, 0.1), (x, -4.48, 0.74), mats["amber"], intake, 0.02, (math.radians(-6), 0, 0))
    for x in (-2.75, -0.15):
        box(collection, f"powered_signal_{x}", (0.9, 0.12, 0.24), (x, -3.0, 2.2), mats["cyan"], building, 0.025)
    pipe = cylinder(collection, "transfer_pipe", 0.22, 5.2, (1.0, 0.3, 3.9), mats["steel"], building, 12, (0, math.pi / 2, 0))
    pipe.rotation_euler.y = math.pi / 2
    for y in (-1.45, 2.2):
        cylinder(collection, f"service_pipe_{y:+.2f}", 0.16, 4.2, (1.0, y, 2.45), mats["gunmetal"], building, 12, (0, math.pi / 2, 0))
        cylinder(collection, f"service_valve_{y:+.2f}", 0.34, 0.12, (-0.4, y, 2.45), mats["amber"], building, 12, (0, math.pi / 2, 0))
    cylinder(collection, "exhaust_stack", 0.24, 2.35, (-4.35, 1.7, 4.3), mats["steel"], building, 12)
    deposit = empty(collection, "deposit_socket", (-1.45, -6.1, 0), root)
    deposit["socket_role"] = "harvester_deposit"
    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_ref_01", collection, root, (0, 0, 2.4), (14, -15, 12), 15.0)
    print(f"FF_REF_01_GLB={glb_path}")


def build_factory() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_FAC_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_FAC_01")
    root["asset_id"] = "ff_fac_01"
    root["asset_role"] = "vehicle_factory"
    building = empty(collection, "building_root", parent=root)
    box(collection, "foundation", (12.5, 9.5, 0.48), (0, 0, 0.3), mats["dark"], building, 0.15)
    box(collection, "foundation_trim", (12.0, 9.0, 0.24), (0, 0, 0.62), mats["gunmetal"], building, 0.06)
    box(collection, "assembly_hall", (9.7, 6.8, 4.0), (0, 0.55, 2.5), mats["panel"], building, 0.2)
    box(collection, "assembly_roof", (10.1, 7.2, 0.38), (0, 0.55, 4.48), mats["gunmetal"], building, 0.09)
    for x in (-4.15, -2.05, 0, 2.05, 4.15):
        box(collection, f"roof_truss_{x:+.2f}", (0.18, 7.45, 0.28), (x, 0.55, 4.72), mats["steel"], building, 0.025)
    for x in (-4.55, 4.55):
        for y in (-1.65, 0.55, 2.75):
            box(collection, f"hall_buttress_{x:+.2f}_{y:+.2f}", (0.55, 0.72, 3.25), (x, y, 2.35), mats["gunmetal"], building, 0.05)
    box(collection, "door_recess", (5.8, 0.28, 2.85), (0, -2.92, 1.78), mats["dark"], building, 0.04)
    door = empty(collection, "factory_door", parent=building)
    for x in (-2.2, -1.1, 0, 1.1, 2.2):
        box(collection, f"door_panel_{x}", (0.86, 0.12, 2.35), (x, -3.1, 1.72), mats["gunmetal"], door, 0.03)
    box(collection, "powered_door_signal", (4.25, 0.1, 0.24), (0, -3.18, 3.45), mats["cyan"], door, 0.02)
    ramp = box(collection, "production_ramp", (6.6, 3.25, 0.3), (0, -4.68, 0.5), mats["steel"], building, 0.05, (math.radians(-5), 0, 0))
    ramp.rotation_euler.x = math.radians(-5)
    for x in (-2.4, -1.2, 0, 1.2, 2.4):
        if x in (-2.4, 0, 2.4):
            box(collection, f"ramp_stripe_{x}", (0.22, 2.75, 0.1), (x, -4.67, 0.71), mats["amber"], building, 0.02, (math.radians(-5), 0, 0))
    crane = empty(collection, "crane_yaw", (0, 0.65, 4.65), building)
    crane["spin_speed"] = 0.08
    cylinder(collection, "crane_pivot", 0.55, 0.42, (0, 0, 0.2), mats["steel"], crane, 16)
    box(collection, "crane_boom", (7.1, 0.42, 0.48), (0.8, 0, 0.55), mats["gunmetal"], crane, 0.05)
    box(collection, "crane_boom_mark", (2.1, 0.46, 0.12), (1.45, -0.02, 0.86), mats["amber"], crane, 0.018)
    box(collection, "crane_counterweight", (1.15, 1.05, 0.82), (-2.7, 0, 0.55), mats["gunmetal"], crane, 0.08)
    for x in (-4.25, 4.25):
        cylinder(collection, f"exhaust_{x}", 0.28, 2.4, (x, 2.25, 5.3), mats["steel"], building, 12)
        cylinder(collection, f"exhaust_cap_{x}", 0.38, 0.28, (x, 2.25, 6.55), mats["amber"], building, 12)
    production = empty(collection, "production_socket", (0, -6.4, 0), root)
    production["socket_role"] = "vehicle_spawn"
    rally = empty(collection, "rally_socket", (0, -8.2, 0), root)
    rally["socket_role"] = "default_rally"
    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_fac_01", collection, root, (0, 0, 2.5), (15, -17, 13), 16.5)
    print(f"FF_FAC_01_GLB={glb_path}")


def build_reactor() -> None:
    reset_scene()
    mats = make_materials()
    tune_gold_building_materials(mats)
    collection = bpy.data.collections.new("FF_RCT_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_RCT_01")
    root["asset_id"] = "ff_rct_01"
    root["asset_role"] = "power_reactor"
    root["provenance"] = "project_procedural_blender"
    root["asset_revision"] = "player-reactor-gold-v1"
    root["render_profile"] = "strategic-camera-gold"
    root["visual_gold_revision"] = "desktop-player-reactor-gold-v1"
    root["silhouette_profile"] = "dark-stepped-base-vertical-energy-core-gapped-ring"
    root["readability_feature_scale_m"] = "0.40-1.40"
    root["footprint_m"] = "7.5x7.5"
    root["energy_core_profile"] = "vertical-m_huijing-column"
    root["constraint_ring_profile"] = "single-open-arc"
    root["healthy_runtime_primitive_budget"] = 8
    root["healthy_runtime_triangle_budget"] = 2600
    root["runtime_primitive_budget"] = 18
    root["runtime_triangle_budget"] = 6700
    root["runtime_material_budget"] = 7
    building = empty(collection, "building_root", parent=root)

    # Broad stepped values keep the footprint legible before the energy core
    # resolves; all pieces below consolidate into four static material domains.
    tapered_box(collection, "foundation_lower", (7.5, 7.5), (7.1, 7.1), 0.46, (0, 0, 0.29), mats["dark"], building, 0.12)
    tapered_box(collection, "foundation_upper", (6.5, 6.5), (5.95, 5.95), 0.38, (0, 0, 0.69), mats["dark"], building, 0.09)
    box(collection, "front_service_trench", (3.4, 1.62, 0.18), (0, -3.25, 0.57), mats["dark"], building, 0.035, (math.radians(-3), 0, 0))
    for x, y, rz in ((-2.5, -2.62, -0.08), (2.48, -2.58, 0.08), (0.0, 2.92, 0.0)):
        box(collection, f"amber_foundation_key_{x:+.2f}_{y:+.2f}", (1.35, 0.32, 0.18), (x, y, 0.86), mats["amber"], building, 0.025, (0, 0, rz))
    cylinder(collection, "pressure_bunker", 2.48, 1.08, (0, 0, 1.22), mats["gunmetal"], building, 12, (0, 0, 0), 0.08)
    cylinder(collection, "pressure_collar_lower", 1.78, 0.34, (0, 0, 1.78), mats["gunmetal"], building, 12, bevel=0.05)
    for x, y, sx, sy, height, rz in (
        (-2.65, 0.75, 1.18, 2.65, 1.65, -0.05),
        (2.5, 1.15, 1.0, 2.2, 1.35, 0.08),
        (0.85, 2.65, 1.55, 1.0, 1.12, -0.12),
    ):
        tapered_box(collection, f"cooling_mass_{x:+.2f}_{y:+.2f}", (sx, sy), (sx * 0.68, sy * 0.72), height, (x, y, 1.05 + height * 0.18), mats["steel"], building, 0.065)
        box(collection, f"cooling_cap_{x:+.2f}_{y:+.2f}", (sx * 0.82, sy * 0.78, 0.18), (x, y, 1.55 + height * 0.18), mats["steel"], building, 0.025, (0, 0, rz))
    for x in (-2.0, 2.0):
        cylinder(collection, f"pressure_line_{x:+.2f}", 0.13, 2.45, (x, 0.15, 1.5), mats["gunmetal"], building, 10, (0, math.pi / 2, 0), 0.018)

    # Preserve the exact code-driven semantic transform while keeping the shell
    # and emissive column in independent runtime domains.
    core = empty(collection, "reactor_core", (0, 0, 1.65), building)
    cylinder(collection, "core_lower_collar", 1.22, 0.36, (0, 0, -0.28), mats["panel"], core, 12, bevel=0.045)
    cylinder(collection, "core_upper_collar", 1.08, 0.3, (0, 0, 2.35), mats["panel"], core, 12, bevel=0.04)
    for angle_index, angle in enumerate((math.radians(20), math.radians(140), math.radians(260))):
        x, y = math.cos(angle) * 0.98, math.sin(angle) * 0.98
        box(collection, f"core_shield_rib_{angle_index}", (0.34, 0.5, 2.8), (x, y, 1.0), mats["panel"], core, 0.045, (0, 0, angle))
    powered_core = empty(collection, "powered_reactor_core", parent=core)
    cylinder(collection, "energy_column_m_huijing", 0.62, 3.55, (0, 0, 1.02), mats["crystal"], powered_core, 10, bevel=0.035)
    crystal(collection, "energy_crown_m_huijing", (0, 0, 2.76), (0.58, 0.58, 0.74), mats["crystal"], powered_core)

    ring = empty(collection, "reactor_ring", parent=building)
    ring["spin_speed"] = 0.32
    open_constraint_ring(collection, "gapped_constraint_ring", (0, 0, 3.72), 2.18, 0.36, 0.34, 32, 328, 16, mats["steel"], ring)
    powered_ring_signal = empty(collection, "powered_reactor_ring_signal", parent=ring)
    for index, angle in enumerate((math.radians(32), math.radians(328))):
        x, y = math.cos(angle) * 2.18, math.sin(angle) * 2.18
        box(collection, f"ring_endpoint_signal_{index}", (0.52, 0.38, 0.44), (x, y, 3.72), mats["cyan"], powered_ring_signal, 0.04, (0, 0, angle))

    power_socket = empty(collection, "power_socket", (0, 4.2, 0), root)
    power_socket["socket_role"] = "grid_connection"
    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    build_building_damage_visuals(collection, building, mats, "player_reactor")
    build_building_ruin_visual(collection, building, mats, "player_reactor")
    glb_path, _ground, _camera = export_asset("ff_rct_01", collection, root, (0, 0, 2.2), (10.5, -12, 10), 11.5)
    print(f"FF_RCT_01_GLB={glb_path}")


def build_barracks() -> None:
    reset_scene()
    mats = make_materials()
    tune_gold_building_materials(mats)
    collection = bpy.data.collections.new("FF_BAR_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_BAR_01")
    root["asset_id"] = "ff_bar_01"
    root["asset_role"] = "infantry_barracks"
    root["provenance"] = "project_procedural_blender"
    root["asset_revision"] = "player-barracks-gold-v1"
    root["render_profile"] = "strategic-camera-gold"
    root["visual_gold_revision"] = "desktop-player-barracks-gold-v1"
    root["silhouette_profile"] = "low-layered-training-hall-deep-entry-asymmetric-wings"
    root["readability_feature_scale_m"] = "0.40-1.40"
    root["footprint_m"] = "8.7x7.7"
    root["entrance_depth_m"] = "2.20"
    root["spawn_forward_axis"] = "+Z"
    root["door_motion_axis"] = "+Y"
    root["door_travel_m"] = 1.75
    root["healthy_runtime_primitive_budget"] = 9
    root["healthy_runtime_triangle_budget"] = 2200
    root["runtime_primitive_budget"] = 19
    root["runtime_triangle_budget"] = 6300
    root["runtime_material_budget"] = 7
    building = empty(collection, "building_root", parent=root)

    # The main hall sits low and rearward; its two unequal wings remain readable
    # as armory and service functions instead of mirrored decorative lockers.
    tapered_box(collection, "foundation_lower", (8.7, 7.7), (8.35, 7.35), 0.46, (0, 0, 0.29), mats["dark"], building, 0.12)
    box(collection, "entry_trench", (3.45, 2.55, 0.18), (0, -3.22, 0.56), mats["dark"], building, 0.035, (math.radians(-4), 0, 0))
    box(collection, "door_recess", (3.65, 0.3, 2.52), (0, -2.48, 1.72), mats["dark"], building, 0.035)
    tapered_box(collection, "training_hall_lower", (6.35, 4.55), (5.9, 4.15), 1.45, (-0.35, 0.62, 1.36), mats["panel"], building, 0.11)
    tapered_box(collection, "training_hall_upper", (5.85, 3.95), (5.15, 3.45), 1.12, (-0.35, 0.82, 2.62), mats["panel"], building, 0.095)
    tapered_box(collection, "armory_wing", (1.95, 4.75), (1.52, 4.15), 2.55, (-3.25, 0.28, 1.78), mats["panel"], building, 0.09)
    tapered_box(collection, "service_wing", (1.5, 3.45), (1.18, 2.85), 1.72, (3.35, 0.72, 1.34), mats["panel"], building, 0.075)

    box(collection, "training_roof_slab", (6.2, 4.22, 0.28), (-0.35, 0.78, 3.26), mats["steel"], building, 0.055)
    box(collection, "armory_roof_slab", (2.05, 4.72, 0.26), (-3.25, 0.28, 3.12), mats["steel"], building, 0.05)
    box(collection, "service_roof_slab", (1.62, 3.38, 0.24), (3.35, 0.72, 2.26), mats["steel"], building, 0.045)
    box(collection, "entry_lintel", (4.25, 0.55, 0.48), (0, -2.42, 3.0), mats["steel"], building, 0.055)
    for x in (-1.75, 1.75):
        box(collection, f"entry_side_frame_{x:+.2f}", (0.42, 0.72, 2.62), (x, -2.28, 1.73), mats["steel"], building, 0.045)

    box(collection, "training_view_strip", (3.25, 0.12, 0.48), (-0.35, -1.32, 2.25), mats["glass"], building, 0.025, (math.radians(4), 0, 0))
    box(collection, "service_view_strip", (0.12, 1.55, 0.42), (4.0, 0.38, 1.55), mats["glass"], building, 0.022, (0, math.radians(-3), 0))
    for x in (-2.2, 0.0, 2.2):
        box(collection, f"hall_cyan_identifier_{x:+.2f}", (0.82, 0.12, 0.2), (x - 0.35, -1.39, 2.86), mats["cyan"], building, 0.018)
    box(collection, "service_cyan_identifier", (0.18, 1.12, 0.28), (4.02, 0.55, 1.72), mats["cyan"], building, 0.018)
    for x in (-3.55, 3.55):
        box(collection, f"amber_corner_key_{x:+.2f}", (0.42, 1.3, 0.28), (x, -1.15, 0.82), mats["amber"], building, 0.03)
    box(collection, "amber_entry_threshold", (3.2, 0.42, 0.16), (0, -3.72, 0.66), mats["amber"], building, 0.02, (math.radians(-4), 0, 0))

    door = empty(collection, "barracks_door", parent=building)
    for x in (-1.18, -0.38, 0.38, 1.18):
        box(collection, f"door_panel_{x:+.2f}", (0.68, 0.18, 2.18), (x, -2.66, 1.64), mats["gunmetal"], door, 0.028)
    box(collection, "door_lower_rail", (3.25, 0.2, 0.22), (0, -2.67, 0.65), mats["gunmetal"], door, 0.025)
    powered_signal = empty(collection, "powered_barracks_signal", parent=door)
    box(collection, "powered_door_signal", (3.0, 0.12, 0.22), (0, -2.78, 2.86), mats["cyan"], powered_signal, 0.02)

    spawn = empty(collection, "infantry_spawn", (0, -4.45, 0), root)
    spawn["socket_role"] = "infantry_spawn"
    rally = empty(collection, "rally_socket", (0, -6.0, 0), root)
    rally["socket_role"] = "default_rally"
    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    build_building_damage_visuals(collection, building, mats, "player_barracks")
    build_building_ruin_visual(collection, building, mats, "player_barracks")
    glb_path, _ground, _camera = export_asset("ff_bar_01", collection, root, (0, 0, 1.75), (11.5, -13.5, 10), 12.5)
    print(f"FF_BAR_01_GLB={glb_path}")


def build_relay() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_REL_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_REL_01")
    root["asset_id"] = "ff_rel_01"
    root["asset_role"] = "network_relay"
    building = empty(collection, "building_root", parent=root)
    box(collection, "foundation", (6.7, 6.7, 0.44), (0, 0, 0.27), mats["dark"], building, 0.13)
    box(collection, "foundation_trim", (6.25, 6.25, 0.22), (0, 0, 0.56), mats["amber"], building, 0.06)
    cylinder(collection, "relay_bunker", 2.3, 1.65, (0, 0, 1.42), mats["panel"], building, 12, bevel=0.07)
    cylinder(collection, "relay_roof", 2.52, 0.3, (0, 0, 2.35), mats["gunmetal"], building, 12)
    for angle_index in range(4):
        angle = angle_index * math.pi / 2 + math.pi / 4
        x, y = math.cos(angle) * 2.48, math.sin(angle) * 2.48
        box(collection, f"mast_brace_{angle_index}", (0.46, 0.72, 2.0), (x, y, 1.55), mats["gunmetal"], building, 0.06, (0, 0, angle))
        box(collection, f"powered_status_{angle_index}", (0.25, 0.16, 0.55), (x, y, 2.02), mats["cyan"], building, 0.02, (0, 0, angle))
    radar = empty(collection, "radar_yaw", (0, 0, 2.46), building)
    radar["spin_speed"] = 0.22
    cylinder(collection, "antenna_column", 0.24, 4.2, (0, 0, 2.1), mats["steel"], radar, 12)
    cylinder(collection, "antenna_collar", 0.62, 0.4, (0, 0, 3.6), mats["amber"], radar, 16)
    dish_mount = empty(collection, "dish_pitch", (0, 0, 4.0), radar)
    dish_mount.rotation_euler.x = math.radians(24)
    cylinder(collection, "dish_back", 1.5, 0.24, (0, 0, 0), mats["gunmetal"], dish_mount, 24)
    cylinder(collection, "dish_face", 1.28, 0.12, (0, 0, -0.16), mats["steel"], dish_mount, 24)
    cylinder(collection, "dish_feed_arm", 0.1, 1.35, (0, 0, -0.76), mats["steel"], dish_mount, 10)
    cylinder(collection, "powered_dish_receiver", 0.23, 0.35, (0, 0, -1.5), mats["cyan"], dish_mount, 12)
    network = empty(collection, "network_socket", (0, 3.65, 0), root)
    network["socket_role"] = "bandwidth_connection"
    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_rel_01", collection, root, (0, 0, 3.2), (10.5, -12.5, 10.5), 12.0)
    print(f"FF_REL_01_GLB={glb_path}")


def build_sentry() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_SEN_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_SEN_01")
    root["asset_id"] = "ff_sen_01"
    root["asset_role"] = "anti_infantry_sentry"
    building = empty(collection, "building_root", parent=root)
    cylinder(collection, "foundation", 2.75, 0.44, (0, 0, 0.27), mats["dark"], building, 12, bevel=0.09)
    cylinder(collection, "foundation_trim", 2.42, 0.2, (0, 0, 0.57), mats["amber"], building, 12)
    cylinder(collection, "armored_pedestal", 1.7, 1.55, (0, 0, 1.42), mats["panel"], building, 12, bevel=0.06)
    for angle_index in range(4):
        angle = angle_index * math.pi / 2 + math.pi / 4
        x, y = math.cos(angle) * 1.93, math.sin(angle) * 1.93
        box(collection, f"pedestal_brace_{angle_index}", (0.48, 0.85, 1.4), (x, y, 1.26), mats["gunmetal"], building, 0.05, (0, 0, angle))
    turret = empty(collection, "turret_yaw", (0, 0, 2.2), building)
    turret["socket_role"] = "weapon_yaw"
    cylinder(collection, "turret_ring", 1.28, 0.34, (0, 0, 0.12), mats["steel"], turret, 16)
    box(collection, "turret_body", (2.35, 2.2, 1.05), (0, -0.08, 0.68), mats["gunmetal"], turret, 0.16)
    box(collection, "turret_amber_cap", (1.7, 1.65, 0.3), (0, 0.02, 1.34), mats["amber"], turret, 0.08)
    for index, x in enumerate((-0.55, 0.55)):
        cylinder(collection, f"barrel_{index}", 0.16, 3.1, (x, -2.1, 0.74), mats["steel"], turret, 12, (math.pi / 2, 0, 0))
        cylinder(collection, f"barrel_shroud_{index}", 0.28, 1.15, (x, -1.05, 0.74), mats["gunmetal"], turret, 12, (math.pi / 2, 0, 0))
        muzzle = empty(collection, f"muzzle_socket_{'left' if index == 0 else 'right'}", (x, -3.67, 0.74), turret)
        muzzle["socket_role"] = "projectile_origin"
    box(collection, "powered_targeting_strip", (1.4, 0.14, 0.18), (0, -1.22, 1.17), mats["cyan"], turret, 0.02)
    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_sen_01", collection, root, (0, 0, 1.9), (8.5, -10, 7.5), 9.5)
    print(f"FF_SEN_01_GLB={glb_path}")


def build_cannon() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_CAN_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_CAN_01")
    root["asset_id"] = "ff_can_01"
    root["asset_role"] = "heavy_artillery_cannon"
    building = empty(collection, "building_root", parent=root)
    cylinder(collection, "foundation", 3.75, 0.5, (0, 0, 0.3), mats["dark"], building, 12, bevel=0.11)
    cylinder(collection, "foundation_trim", 3.4, 0.22, (0, 0, 0.63), mats["amber"], building, 12)
    cylinder(collection, "armored_bunker", 2.6, 1.75, (0, 0, 1.62), mats["panel"], building, 12, bevel=0.08)
    for angle_index in range(4):
        angle = angle_index * math.pi / 2 + math.pi / 4
        x, y = math.cos(angle) * 2.92, math.sin(angle) * 2.92
        box(collection, f"bunker_brace_{angle_index}", (0.65, 1.2, 1.5), (x, y, 1.45), mats["gunmetal"], building, 0.07, (0, 0, angle))
    turret = empty(collection, "turret_yaw", (0, 0, 2.58), building)
    turret["socket_role"] = "weapon_yaw"
    cylinder(collection, "turret_ring", 2.0, 0.42, (0, 0, 0.1), mats["steel"], turret, 16)
    box(collection, "turret_body", (3.65, 3.25, 1.45), (0, 0.05, 0.93), mats["gunmetal"], turret, 0.22)
    box(collection, "turret_armor", (3.05, 2.75, 0.45), (0, -0.02, 1.78), mats["amber"], turret, 0.1)
    barrel_pitch = empty(collection, "barrel_pitch", (0, -0.95, 1.08), turret)
    barrel_pitch.rotation_euler.x = math.radians(7)
    cylinder(collection, "main_barrel", 0.31, 6.9, (0, -3.1, 0), mats["steel"], barrel_pitch, 16, (math.pi / 2, 0, 0))
    cylinder(collection, "barrel_sleeve", 0.58, 2.15, (0, -0.95, 0), mats["gunmetal"], barrel_pitch, 16, (math.pi / 2, 0, 0))
    cylinder(collection, "muzzle_brake", 0.48, 0.85, (0, -6.55, 0), mats["dark"], barrel_pitch, 16, (math.pi / 2, 0, 0))
    muzzle = empty(collection, "muzzle_socket", (0, -7.05, 0), barrel_pitch)
    muzzle["socket_role"] = "projectile_origin"
    box(collection, "rear_counterweight", (2.8, 1.85, 1.15), (0, 1.9, 0.9), mats["panel"], turret, 0.16)
    box(collection, "powered_rangefinder", (1.25, 0.18, 0.26), (0, -1.62, 1.58), mats["cyan"], turret, 0.03)
    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_can_01", collection, root, (0, -0.8, 2.2), (11.5, -15, 10), 13.5)
    print(f"FF_CAN_01_GLB={glb_path}")


def build_trooper(collection, mats, name, location, role, squad):
    soldier = empty(collection, name, location, squad)
    soldier["unit_role"] = role
    for index, x in enumerate((-0.13, 0.13)):
        box(collection, f"{name}_boot_{index}", (0.22, 0.38, 0.2), (x, -0.03, 0.11), mats["dark"], soldier, 0.04)
        box(collection, f"{name}_leg_{index}", (0.2, 0.22, 0.58), (x, 0, 0.47), mats["gunmetal"], soldier, 0.04)
    box(collection, f"{name}_pelvis", (0.52, 0.34, 0.26), (0, 0, 0.75), mats["dark"], soldier, 0.06)
    box(collection, f"{name}_torso", (0.62, 0.42, 0.66), (0, 0, 1.08), mats["panel"], soldier, 0.09)
    box(collection, f"{name}_chest_plate", (0.5, 0.12, 0.28), (0, -0.26, 1.15), mats["amber"], soldier, 0.04)
    box(collection, f"{name}_pack", (0.48, 0.24, 0.5), (0, 0.3, 1.08), mats["gunmetal"], soldier, 0.06)
    for index, x in enumerate((-0.4, 0.4)):
        arm = box(collection, f"{name}_arm_{index}", (0.2, 0.24, 0.62), (x, -0.02, 1.06), mats["gunmetal"], soldier, 0.05)
        arm.rotation_euler.y = math.radians(-10 if x < 0 else 10)
    sphere(collection, f"{name}_head", 0.22, (0, -0.01, 1.55), mats["steel"], soldier, 14, 7)
    cylinder(collection, f"{name}_helmet", 0.28, 0.16, (0, 0, 1.7), mats["dark"], soldier, 14)
    box(collection, f"powered_{name}_visor", (0.34, 0.1, 0.11), (0, -0.23, 1.58), mats["cyan"], soldier, 0.025)
    if role == "rifle":
        # The long receiver, shoulder stock and muzzle block remain readable at the
        # default RTS camera, unlike a single thin barrel.
        box(collection, f"{name}_rifle_stock", (0.34, 0.48, 0.28), (0.18, 0.06, 1.13), mats["dark"], soldier, 0.05)
        box(collection, f"{name}_rifle_body", (0.3, 0.68, 0.26), (0.18, -0.36, 1.13), mats["gunmetal"], soldier, 0.045)
        cylinder(collection, f"{name}_rifle_barrel", 0.065, 0.82, (0.18, -1.05, 1.13), mats["steel"], soldier, 8, (math.pi / 2, 0, 0))
        box(collection, f"{name}_rifle_muzzle", (0.26, 0.26, 0.26), (0.18, -1.49, 1.13), mats["amber"], soldier, 0.035)
        box(collection, f"{name}_rifle_sight", (0.22, 0.4, 0.16), (0.18, -0.45, 1.36), mats["cyan"], soldier, 0.025)
        for index, x in enumerate((-0.39, 0.39)):
            box(collection, f"{name}_rifle_pauldron_{index}", (0.34, 0.42, 0.24), (x, 0, 1.36), mats["amber"], soldier, 0.055)
    elif role == "launcher":
        cylinder(collection, f"{name}_launcher", 0.17, 1.78, (0.22, -0.3, 1.4), mats["gunmetal"], soldier, 12, (math.pi / 2, 0, 0))
        cylinder(collection, f"{name}_launcher_ring", 0.24, 0.24, (0.22, -1.05, 1.4), mats["amber"], soldier, 12, (math.pi / 2, 0, 0))
        box(collection, f"{name}_launcher_cradle", (0.46, 0.82, 0.36), (0.22, 0.18, 1.36), mats["dark"], soldier, 0.055)
        box(collection, f"{name}_launcher_rangebox", (0.38, 0.44, 0.24), (0.46, -0.48, 1.67), mats["cyan"], soldier, 0.035)
    elif role == "engineer":
        # Twin service cells and the high crossbar form a broad, unmistakable
        # maintenance frame without introducing a new material.
        for index, x in enumerate((-0.27, 0.27)):
            box(collection, f"powered_{name}_repair_cell_{index}", (0.24, 0.32, 0.78), (x, 0.36, 1.12), mats["cyan"], soldier, 0.05)
            box(collection, f"{name}_repair_cell_guard_{index}", (0.31, 0.37, 0.22), (x, 0.35, 1.46), mats["amber"], soldier, 0.04)
        box(collection, f"{name}_repair_crossbar", (0.58, 0.26, 0.2), (0, 0.36, 1.62), mats["gunmetal"], soldier, 0.04)
        cylinder(collection, f"{name}_repair_tool", 0.085, 1.02, (0.25, -0.46, 1.04), mats["steel"], soldier, 10, (math.pi / 2, 0, 0))
        box(collection, f"powered_{name}_tool_head", (0.36, 0.3, 0.34), (0.25, -1.0, 1.04), mats["cyan"], soldier, 0.055)
        for index, x in enumerate((-0.39, 0.39)):
            box(collection, f"{name}_engineer_pauldron_{index}", (0.34, 0.4, 0.24), (x, 0, 1.36), mats["panel"], soldier, 0.055)
    return soldier


def build_rifle_squad() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_RIF_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_RIF_01")
    root["asset_id"] = "ff_rif_01"
    root["asset_role"] = "rifle_squad"
    tag_infantry_silhouette(root, "player_rifle_shieldline_v2", "long_rifle,forearm_shield,amber_shoulders")
    squad = empty(collection, "squad_root", parent=root)
    soldiers = [
        build_trooper(collection, mats, "soldier_lead", (0, -0.5, 0), "rifle", squad),
        build_trooper(collection, mats, "soldier_left", (-0.48, 0.3, 0), "rifle", squad),
        build_trooper(collection, mats, "soldier_right", (0.48, 0.3, 0), "rifle", squad),
    ]
    cylinder(collection, "leader_antenna", 0.035, 0.72, (-0.18, 0.28, 1.42), mats["steel"], soldiers[0], 8)
    muzzle = empty(collection, "muzzle_socket", (0.18, -1.66, 1.13), soldiers[0])
    muzzle["socket_role"] = "projectile_origin"
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_rif_01", collection, root, (0, 0, 0.92), (3.7, -5.2, 3.7), 3.8)
    print(f"FF_RIF_01_GLB={glb_path}")


def build_engineer_squad() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_ENG_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_ENG_01")
    root["asset_id"] = "ff_eng_01"
    root["asset_role"] = "engineer_squad"
    tag_infantry_silhouette(root, "player_engineer_serviceframe_v2", "twin_service_cells,repair_crossbar,oversize_tool")
    squad = empty(collection, "squad_root", parent=root)
    engineers = [
        build_trooper(collection, mats, "engineer_lead", (0, -0.5, 0), "engineer", squad),
        build_trooper(collection, mats, "engineer_left", (-0.48, 0.3, 0), "engineer", squad),
        build_trooper(collection, mats, "engineer_right", (0.48, 0.3, 0), "engineer", squad),
    ]
    repair = empty(collection, "repair_tool_socket", (0.25, -1.16, 1.04), engineers[0])
    repair["socket_role"] = "repair_origin"
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_eng_01", collection, root, (0, 0, 0.92), (3.7, -5.2, 3.7), 3.8)
    print(f"FF_ENG_01_GLB={glb_path}")


def build_antitank_squad() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_AT_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_AT_01")
    root["asset_id"] = "ff_at_01"
    root["asset_role"] = "antitank_squad"
    tag_infantry_silhouette(root, "player_antitank_shouldertube_v2", "heavy_launcher,blast_collar,loader_warheads")
    squad = empty(collection, "squad_root", parent=root)
    lead = build_trooper(collection, mats, "launcher_lead", (0, -0.5, 0), "launcher", squad)
    loader_left = build_trooper(collection, mats, "loader_left", (-0.48, 0.3, 0), "rifle", squad)
    loader_right = build_trooper(collection, mats, "loader_right", (0.48, 0.3, 0), "rifle", squad)
    launcher_pitch = empty(collection, "launcher_pitch", (0.22, 0, 1.35), lead)
    launcher_pitch["socket_role"] = "weapon_pitch"
    muzzle = empty(collection, "muzzle_socket", (0, -1.45, 0.05), launcher_pitch)
    muzzle["socket_role"] = "projectile_origin"
    for index, (loader, side) in enumerate(((loader_left, -1), (loader_right, 1))):
        box(collection, f"loader_{index}_warhead_case", (0.38, 0.42, 0.68), (side * 0.22, 0.36, 1.08), mats["amber"], loader, 0.055)
        cylinder(collection, f"loader_{index}_spare_warhead", 0.13, 0.72, (side * 0.28, 0.48, 1.12), mats["steel"], loader, 10)
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_at_01", collection, root, (0, 0, 0.95), (3.8, -5.4, 3.8), 4.0)
    print(f"FF_AT_01_GLB={glb_path}")


def build_scout_vehicle() -> None:
    reset_scene()
    mats = make_player_field_vehicle_materials()
    collection = bpy.data.collections.new("FF_SCT_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_SCT_01")
    root["asset_id"] = "ff_sct_01"
    root["asset_role"] = "scout_vehicle"
    root["provenance"] = "project_procedural_blender"
    root["asset_revision"] = "player-scout-gold-v1"
    root["render_profile"] = "strategic-camera-gold"
    root["visual_gold_revision"] = "desktop-player-scout-gold-v1"
    root["silhouette_profile"] = "low-four-wheel-fork-radar"
    root["weapon_forward_axis"] = "+Z"
    root["runtime_primitive_budget"] = 12
    root["runtime_triangle_budget"] = 1800
    root["runtime_material_budget"] = 7
    root["runtime_texture_budget"] = 0
    chassis = empty(collection, "chassis_root", parent=root)

    # The scout is deliberately the lightest member of the family: four exposed
    # wheels, a low wedge body and a 0.9 m forked radar crown do the recognition.
    tapered_box(collection, "lower_hull", (2.02, 3.42), (1.78, 3.12), 0.5, (0, 0, 0.7), mats["gunmetal"], chassis, 0.08)
    tapered_box(collection, "sloped_nose", (1.82, 1.36), (1.48, 1.02), 0.5, (0, -1.15, 1.02), mats["panel"], chassis, 0.075)
    tapered_box(collection, "crew_cell", (1.56, 1.5), (1.3, 1.22), 0.58, (0, 0.12, 1.14), mats["panel"], chassis, 0.085)
    box(collection, "dark_windscreen", (1.02, 0.13, 0.28), (0, -0.58, 1.32), mats["dark"], chassis, 0.025, (math.radians(-10), 0, 0))
    box(collection, "rear_sensor_deck", (1.62, 0.92, 0.2), (0, 1.12, 1.02), mats["dark"], chassis, 0.045)
    box(collection, "front_bumper", (1.76, 0.18, 0.22), (0, -1.75, 0.58), mats["steel"], chassis, 0.035)
    for side_index, x in enumerate((-1.12, 1.12)):
        for axle_index, y in enumerate((-1.12, 1.08)):
            cylinder(collection, f"wheel_{side_index}_{axle_index}", 0.44, 0.4, (x, y, 0.53), mats["rubber"], chassis, 10, (0, math.pi / 2, 0), 0.0)
            cylinder(collection, f"hub_{side_index}_{axle_index}", 0.18, 0.43, (x, y, 0.53), mats["steel"], chassis, 10, (0, math.pi / 2, 0), 0.02)
        box(collection, f"amber_id_strip_{side_index}", (0.16, 1.72, 0.22), (x, 0.06, 0.91), mats["amber"], chassis, 0.025)

    turret = empty(collection, "turret_yaw", (0, -0.15, 1.56), chassis)
    turret["socket_role"] = "weapon_yaw"
    cylinder(collection, "turret_base", 0.44, 0.22, (0, 0, 0.1), mats["steel"], turret, 10, bevel=0.025)
    tapered_box(collection, "turret_head", (0.72, 0.68), (0.54, 0.52), 0.34, (0, -0.02, 0.36), mats["gunmetal"], turret, 0.055)
    cylinder(collection, "scout_gun", 0.09, 1.22, (0, -0.94, 0.42), mats["steel"], turret, 8, (math.pi / 2, 0, 0), 0.012)
    cylinder(collection, "scout_muzzle_ring", 0.14, 0.15, (0, -1.49, 0.42), mats["dark"], turret, 8, (math.pi / 2, 0, 0), 0.012)
    muzzle = empty(collection, "muzzle_socket", (0, -1.58, 0.42), turret)
    muzzle["socket_role"] = "projectile_origin"

    radar = empty(collection, "radar_yaw", (0, 0.92, 1.45), chassis)
    radar["spin_speed"] = 1.1
    cylinder(collection, "radar_mast", 0.065, 0.72, (0, 0, 0.36), mats["steel"], radar, 8, bevel=0.012)
    box(collection, "radar_crown_spine", (0.18, 0.28, 0.32), (0, 0, 0.69), mats["steel"], radar, 0.025)
    for side_index, x in enumerate((-0.29, 0.29)):
        box(collection, f"radar_fork_{side_index}", (0.48, 0.17, 0.2), (x, 0, 0.86), mats["panel"], radar, 0.025, (0, math.radians(8 if x > 0 else -8), 0))
    powered_radar = empty(collection, "powered_scout_radar", (0, 0, 0.86), radar)
    powered_radar["presentation_role"] = "powered_signal"
    for side_index, x in enumerate((-0.52, 0.52)):
        sphere(collection, f"radar_function_point_{side_index}", 0.075, (x, -0.1, 0), mats["cyan"], powered_radar, 8, 4)

    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_sct_01", collection, root, (0, 0, 0.95), (6.5, -8, 5.5), 7.0)
    print(f"FF_SCT_01_GLB={glb_path}")


def build_suppressor_vehicle() -> None:
    reset_scene()
    mats = make_player_field_vehicle_materials()
    collection = bpy.data.collections.new("FF_SUP_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_SUP_01")
    root["asset_id"] = "ff_sup_01"
    root["asset_role"] = "chaincannon_suppressor"
    root["provenance"] = "project_procedural_blender"
    root["asset_revision"] = "player-suppressor-gold-v1"
    root["render_profile"] = "strategic-camera-gold"
    root["visual_gold_revision"] = "desktop-player-suppressor-gold-v1"
    root["silhouette_profile"] = "wide-six-wheel-parallel-chaincannon"
    root["weapon_forward_axis"] = "+Z"
    root["runtime_primitive_budget"] = 12
    root["runtime_triangle_budget"] = 2600
    root["runtime_material_budget"] = 7
    root["runtime_texture_budget"] = 0
    chassis = empty(collection, "chassis_root", parent=root)

    tapered_box(collection, "lower_hull", (2.58, 4.22), (2.26, 3.88), 0.64, (0, 0, 0.82), mats["gunmetal"], chassis, 0.1)
    tapered_box(collection, "sloped_glacis", (2.32, 1.48), (1.92, 1.08), 0.54, (0, -1.46, 1.18), mats["panel"], chassis, 0.08)
    tapered_box(collection, "crew_hull", (2.16, 2.1), (1.88, 1.8), 0.62, (0, 0.06, 1.28), mats["panel"], chassis, 0.09)
    box(collection, "rear_engine", (2.14, 1.02, 0.3), (0, 1.48, 1.22), mats["dark"], chassis, 0.055)
    box(collection, "front_bumper", (2.22, 0.2, 0.25), (0, -2.12, 0.65), mats["steel"], chassis, 0.035)
    for side_index, x in enumerate((-1.43, 1.43)):
        for axle_index, y in enumerate((-1.4, 0, 1.35)):
            cylinder(collection, f"wheel_{side_index}_{axle_index}", 0.49, 0.4, (x, y, 0.6), mats["rubber"], chassis, 10, (0, math.pi / 2, 0), 0.0)
            cylinder(collection, f"hub_{side_index}_{axle_index}", 0.2, 0.43, (x, y, 0.6), mats["steel"], chassis, 10, (0, math.pi / 2, 0), 0.02)
        box(collection, f"amber_id_rail_{side_index}", (0.17, 2.55, 0.28), (x, 0.05, 1.02), mats["amber"], chassis, 0.025)

    turret = empty(collection, "turret_yaw", (0, -0.18, 1.66), chassis)
    turret["socket_role"] = "weapon_yaw"
    cylinder(collection, "turret_ring", 0.78, 0.28, (0, 0, 0.13), mats["steel"], turret, 12, bevel=0.035)
    tapered_box(collection, "turret_body", (1.82, 1.56), (1.54, 1.3), 0.64, (0, 0.05, 0.58), mats["gunmetal"], turret, 0.09)
    for side_index, x in enumerate((-0.68, 0.68)):
        tapered_box(collection, f"turret_cheek_{side_index}", (0.42, 1.3), (0.34, 1.08), 0.54, (x, -0.05, 0.66), mats["panel"], turret, 0.055)
        cylinder(collection, f"feed_drum_{side_index}", 0.29, 0.3, (x, 0.62, 0.7), mats["dark"], turret, 10, (0, math.pi / 2, 0), 0.025)
    for side_index, x in enumerate((-0.38, 0.38)):
        cylinder(collection, f"chain_barrel_{side_index}", 0.13, 2.25, (x, -1.825, 0.65), mats["steel"], turret, 10, (math.pi / 2, 0, 0), 0.014)
        cylinder(collection, f"chain_shroud_{side_index}", 0.25, 0.86, (x, -0.88, 0.65), mats["dark"], turret, 10, (math.pi / 2, 0, 0), 0.025)
        cylinder(collection, f"muzzle_ring_{side_index}", 0.2, 0.16, (x, -2.87, 0.65), mats["dark"], turret, 10, (math.pi / 2, 0, 0), 0.015)
        muzzle = empty(collection, f"muzzle_socket_{'left' if side_index == 0 else 'right'}", (x, -2.98, 0.65), turret)
        muzzle["socket_role"] = "projectile_origin"
    powered_targeting = empty(collection, "powered_suppressor_targeting", (0, -0.78, 1.0), turret)
    powered_targeting["presentation_role"] = "powered_signal"
    for side_index, x in enumerate((-0.48, 0.48)):
        box(collection, f"targeting_point_{side_index}", (0.18, 0.12, 0.14), (x, 0, 0), mats["cyan"], powered_targeting, 0.015)

    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_sup_01", collection, root, (0, -0.1, 1.2), (7.5, -9.5, 6.5), 8.5)
    print(f"FF_SUP_01_GLB={glb_path}")


def build_artillery_vehicle() -> None:
    reset_scene()
    mats = make_player_field_vehicle_materials()
    collection = bpy.data.collections.new("FF_ART_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_ART_01")
    root["asset_id"] = "ff_art_01"
    root["asset_role"] = "long_arc_artillery"
    root["provenance"] = "project_procedural_blender"
    root["asset_revision"] = "player-artillery-gold-v1"
    root["render_profile"] = "strategic-camera-gold"
    root["visual_gold_revision"] = "desktop-player-artillery-gold-v1"
    root["silhouette_profile"] = "tracked-rear-magazine-long-braked-gun"
    root["weapon_forward_axis"] = "+Z"
    root["runtime_primitive_budget"] = 12
    root["runtime_triangle_budget"] = 2600
    root["runtime_material_budget"] = 7
    root["runtime_texture_budget"] = 0
    chassis = empty(collection, "chassis_root", parent=root)

    # Two continuous track masses and four large road wheels per side read as
    # artillery mobility at strategic distance without individual tread greeble.
    for side_index, x in enumerate((-1.32, 1.32)):
        box(collection, f"track_bed_{side_index}", (0.62, 4.65, 0.7), (x, 0.05, 0.55), mats["rubber"], chassis, 0.13)
        box(collection, f"track_shadow_{side_index}", (0.48, 3.92, 0.18), (x, 0.02, 0.25), mats["dark"], chassis, 0.035)
        box(collection, f"track_guard_{side_index}", (0.72, 4.12, 0.24), (x, 0.02, 0.96), mats["gunmetal"], chassis, 0.045)
        for wheel_index, y in enumerate((-1.45, -0.48, 0.48, 1.45)):
            cylinder(collection, f"roadwheel_{side_index}_{wheel_index}", 0.33, 0.64, (x, y, 0.55), mats["steel"], chassis, 10, (0, math.pi / 2, 0), 0.035)
    tapered_box(collection, "lower_hull", (2.48, 4.12), (2.18, 3.78), 0.7, (0, 0, 0.88), mats["gunmetal"], chassis, 0.11)
    tapered_box(collection, "front_glacis", (2.22, 1.45), (1.88, 1.02), 0.62, (0, -1.4, 1.2), mats["panel"], chassis, 0.09)
    tapered_box(collection, "rear_ammo_magazine", (2.5, 1.92), (2.18, 1.65), 1.08, (0, 1.12, 1.43), mats["panel"], chassis, 0.11)
    box(collection, "rear_ammo_hatch", (1.42, 0.82, 0.18), (0, 1.25, 2.01), mats["dark"], chassis, 0.035)
    box(collection, "amber_magazine_band", (2.22, 0.18, 0.34), (0, 0.18, 1.58), mats["amber"], chassis, 0.025)
    for x in (-0.68, 0.68):
        box(collection, f"rear_spade_arm_{x:+.2f}", (0.25, 1.72, 0.22), (x, 2.28, 0.27), mats["steel"], chassis, 0.035, (0, 0, math.radians(5 if x > 0 else -5)))
        box(collection, f"rear_spade_foot_{x:+.2f}", (0.78, 0.46, 0.2), (x, 3.08, 0.18), mats["steel"], chassis, 0.04, (0, 0, math.radians(5 if x > 0 else -5)))

    turret = empty(collection, "turret_yaw", (0, -0.25, 1.58), chassis)
    turret["socket_role"] = "weapon_yaw"
    cylinder(collection, "turret_ring", 0.88, 0.3, (0, 0, 0.14), mats["steel"], turret, 12, bevel=0.04)
    tapered_box(collection, "gun_cradle", (1.86, 1.78), (1.55, 1.42), 0.78, (0, 0.15, 0.68), mats["gunmetal"], turret, 0.11)
    for x in (-0.62, 0.62):
        tapered_box(collection, f"gun_shield_{x:+.2f}", (0.48, 1.48), (0.38, 1.18), 0.92, (x, -0.15, 0.78), mats["panel"], turret, 0.065)
    box(collection, "rangefinder_mount", (0.28, 0.32, 0.28), (0.68, 0.12, 1.18), mats["steel"], turret, 0.035)
    powered_rangefinder = empty(collection, "powered_artillery_rangefinder", (0.68, -0.08, 1.22), turret)
    powered_rangefinder["presentation_role"] = "powered_signal"
    box(collection, "rangefinder_function_point", (0.18, 0.12, 0.16), (0, 0, 0), mats["cyan"], powered_rangefinder, 0.018)

    barrel = empty(collection, "barrel_pitch", (0, -0.72, 0.92), turret)
    barrel["socket_role"] = "weapon_pitch"
    barrel.rotation_euler.x = math.radians(12)
    cylinder(collection, "long_arc_barrel", 0.17, 4.65, (0, -2.5, 0), mats["steel"], barrel, 12, (math.pi / 2, 0, 0), 0.022)
    cylinder(collection, "barrel_sleeve", 0.32, 1.62, (0, -0.8, 0), mats["dark"], barrel, 12, (math.pi / 2, 0, 0), 0.035)
    box(collection, "muzzle_brake_body", (0.58, 0.48, 0.46), (0, -5.03, 0), mats["dark"], barrel, 0.045)
    box(collection, "muzzle_brake_cross", (0.94, 0.25, 0.2), (0, -5.06, 0), mats["dark"], barrel, 0.035)
    muzzle = empty(collection, "muzzle_socket", (0, -5.3, 0), barrel)
    muzzle["socket_role"] = "projectile_origin"
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_art_01", collection, root, (0, -0.5, 1.3), (8.5, -11, 7), 9.5)
    print(f"FF_ART_01_GLB={glb_path}")


def build_rock_cluster() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_ROK_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_ROK_01")
    root["asset_id"] = "ff_rok_01"
    root["asset_role"] = "terrain_blocker"
    cluster = empty(collection, "rock_cluster_root", parent=root)
    placements = [
        ("rock_main", (0, 0.1, 1.45), (1.75, 1.45, 2.35), mats["rock"]),
        ("rock_left", (-1.7, 0.5, 0.86), (1.25, 1.1, 1.45), mats["rock_light"]),
        ("rock_right", (1.72, -0.35, 0.94), (1.35, 1.15, 1.6), mats["rock"]),
        ("rock_front", (-0.55, -1.55, 0.62), (1.0, 0.82, 1.15), mats["rock_light"]),
        ("rock_rear", (0.9, 1.55, 0.5), (0.85, 0.72, 1.0), mats["rock"]),
    ]
    for index, (name, location, scale, material) in enumerate(placements):
        obj = crystal(collection, name, location, scale, material, cluster)
        obj.rotation_euler = (math.radians(index * 7), math.radians(index * 29), math.radians(index * 5))
    collider = empty(collection, "collision_proxy", (0, 0, 0), root)
    collider["shape"] = "circle"
    collider["radius"] = 5.0
    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "ground_contact"
    glb_path, _ground, _camera = export_asset("ff_rok_01", collection, root, (0, 0, 1.2), (7, -8.5, 6), 8.0)
    print(f"FF_ROK_01_GLB={glb_path}")


def build_armored_wreck() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_WRK_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_WRK_01")
    root["asset_id"] = "ff_wrk_01"
    root["asset_role"] = "decorative_armored_wreck"
    wreck = empty(collection, "wreck_root", parent=root)
    wreck.rotation_euler.z = math.radians(-5)
    box(collection, "burnt_hull", (2.8, 4.25, 0.68), (0, 0, 0.72), mats["burnt"], wreck, 0.18)
    box(collection, "torn_front", (2.4, 1.25, 0.46), (0, -1.62, 1.02), mats["rust"], wreck, 0.1, (math.radians(-12), 0, 0))
    for side_index, x in enumerate((-1.45, 1.45)):
        box(collection, f"broken_track_{side_index}", (0.55, 3.75, 0.58), (x, 0, 0.48), mats["burnt"], wreck, 0.12, (0, 0, math.radians(8 if x > 0 else -4)))
        for wheel_index, y in enumerate((-1.25, -0.35, 0.55, 1.38)):
            cylinder(collection, f"wreck_wheel_{side_index}_{wheel_index}", 0.35, 0.6, (x, y, 0.5), mats["rust"], wreck, 12, (0, math.pi / 2, 0), 0.03)
    turret = empty(collection, "broken_turret", (0.35, 0.1, 1.12), wreck)
    turret.rotation_euler = (math.radians(8), math.radians(-28), math.radians(12))
    cylinder(collection, "turret_shell", 0.82, 0.62, (0, 0, 0.32), mats["burnt"], turret, 14)
    box(collection, "turret_rust_plate", (1.25, 1.1, 0.34), (0, -0.05, 0.7), mats["rust"], turret, 0.1)
    cylinder(collection, "broken_barrel", 0.12, 2.45, (0, -1.42, 0.54), mats["burnt"], turret, 10, (math.pi / 2, 0, 0))
    box(collection, "scorch_plate", (1.1, 0.18, 0.12), (-0.45, -2.1, 0.48), mats["rust"], wreck, 0.02)
    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "ground_contact"
    glb_path, _ground, _camera = export_asset("ff_wrk_01", collection, root, (0, 0, 0.95), (7.5, -9.5, 5.7), 8.5)
    print(f"FF_WRK_01_GLB={glb_path}")


def build_resource_field() -> None:
    reset_scene()
    mats = make_materials()
    tune_simple_material(mats["earth"], (0.135, 0.14, 0.108, 1), roughness=0.98)
    tune_simple_material(mats["earth_dark"], (0.085, 0.072, 0.052, 1), roughness=1.0)
    tune_simple_material(
        mats["crystal"],
        (0.025, 0.28, 0.36, 1),
        roughness=0.31,
        emission=(0.0, 0.42, 0.62, 1),
        emission_strength=1.65,
    )
    collection = bpy.data.collections.new("FF_ORE_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_ORE_01")
    root["asset_id"] = "ff_ore_01"
    root["asset_role"] = "harvestable_resource_field"
    root["visual_gold_revision"] = "desktop-resource-gold-v2"
    root["silhouette_profile"] = "broken-seam-half-buried-clusters"
    root["emissive_projected_area_max_pct"] = 20
    root["runtime_primitive_budget"] = 16
    root["runtime_triangle_budget"] = 3200
    root["runtime_material_budget"] = 3
    field = empty(collection, "resource_field_root", parent=root)
    radial_patch(
        collection,
        "broken_soil_transition",
        [
            (4.55, 0.0, 0.038), (4.05, 1.75, 0.052), (2.95, 3.38, 0.044),
            (1.25, 4.08, 0.056), (-0.45, 3.72, 0.042), (-2.1, 4.18, 0.05),
            (-3.55, 2.95, 0.038), (-4.62, 1.12, 0.048), (-4.18, -0.82, 0.04),
            (-4.48, -2.55, 0.052), (-2.85, -3.62, 0.04), (-1.0, -4.05, 0.05),
            (0.62, -3.72, 0.042), (2.48, -4.12, 0.052), (3.62, -2.72, 0.04),
            (4.25, -1.25, 0.048),
        ],
        0.17,
        mats["earth"],
        field,
    )

    for patch_index, (center, outline) in enumerate([
        (
            (-0.2, -0.05, 0.186),
            [(-1.18, -0.72, 0.174), (0.08, -1.02, 0.178), (1.18, -0.58, 0.174),
             (1.04, 0.52, 0.176), (0.15, 0.94, 0.18), (-1.0, 0.58, 0.174)],
        ),
        (
            (-2.2, -1.35, 0.142),
            [(-2.95, -1.78, 0.132), (-2.25, -2.05, 0.136), (-1.46, -1.7, 0.134),
             (-1.55, -0.92, 0.138), (-2.42, -0.72, 0.134), (-3.0, -1.14, 0.132)],
        ),
        (
            (2.05, 1.18, 0.146),
            [(1.25, 0.72, 0.136), (1.82, 0.38, 0.138), (2.72, 0.72, 0.136),
             (2.88, 1.5, 0.134), (2.12, 1.92, 0.138), (1.3, 1.56, 0.134)],
        ),
    ]):
        fan_patch(collection, f"ore_contact_shadow_{patch_index}", center, outline, mats["earth_dark"], field)

    for index, (x, y, height, width, lean) in enumerate([
        (-0.25, 0.0, 3.25, 0.62, -7), (-1.5, 0.62, 2.35, 0.5, -15),
        (1.35, -0.55, 2.5, 0.53, 13), (-2.45, -1.35, 1.65, 0.41, -22),
        (2.55, 1.2, 1.78, 0.43, 18), (-0.92, -2.35, 1.55, 0.39, -10),
        (0.9, 2.35, 1.42, 0.36, 12),
    ]):
        ore = crystal(
            collection,
            f"half_buried_ore_{index}",
            (x, y, height * 0.31),
            (width * 0.82, width, height * 0.5),
            mats["crystal"],
            field,
        )
        ore.rotation_euler = (
            math.radians(lean),
            math.radians(index * 37),
            math.radians(lean * 0.5),
        )

    for index, (x, y, sx, sy, sz, rotation) in enumerate([
        (-3.7, -0.45, 0.58, 0.42, 0.28, 12), (-3.15, 2.25, 0.72, 0.48, 0.34, -18),
        (-1.9, 3.25, 0.5, 0.36, 0.25, 8), (0.15, 3.45, 0.62, 0.4, 0.29, -9),
        (2.05, 3.0, 0.74, 0.48, 0.32, 16), (3.55, 2.05, 0.55, 0.38, 0.26, -12),
        (3.72, -0.25, 0.7, 0.44, 0.3, 18), (3.1, -2.45, 0.62, 0.43, 0.28, -16),
        (1.2, -3.35, 0.76, 0.48, 0.32, 7), (-0.75, -3.45, 0.54, 0.38, 0.26, -13),
        (-2.55, -2.85, 0.68, 0.45, 0.3, 15), (-3.82, 1.0, 0.5, 0.35, 0.24, -8),
    ]):
        rubble = crystal(
            collection,
            f"soil_rubble_{index}",
            (x, y, sz * 0.48 + 0.04),
            (sx, sy, sz),
            mats["earth_dark"] if index in {0, 4, 7, 10} else mats["earth"],
            field,
        )
        rubble.rotation_euler = (
            math.radians(8 + index % 3 * 5),
            math.radians(index * 29),
            math.radians(rotation),
        )
    harvest = empty(collection, "harvest_socket", (0, 0, 0.08), root)
    harvest["socket_role"] = "resource_interaction"
    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "ground_contact"
    glb_path, _ground, _camera = export_asset("ff_ore_01", collection, root, (0, 0, 1.8), (9, -11, 8), 10.5)
    print(f"FF_ORE_01_GLB={glb_path}")


def build_crater_cluster() -> None:
    reset_scene()
    mats = make_materials()
    tune_simple_material(mats["earth"], (0.115, 0.118, 0.092, 1), roughness=0.99)
    tune_simple_material(mats["earth_dark"], (0.043, 0.041, 0.034, 1), roughness=1.0)
    tune_simple_material(mats["rock"], (0.135, 0.143, 0.128, 1), roughness=0.96)
    collection = bpy.data.collections.new("FF_CRT_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_CRT_01")
    root["asset_id"] = "ff_crt_01"
    root["asset_role"] = "decorative_shell_crater"
    root["provenance"] = "project_procedural_blender"
    root["asset_revision"] = "strategic-crater-gold-v2"
    root["visual_gold_revision"] = "desktop-crater-gold-v1"
    root["silhouette_profile"] = "broken-elliptical-impact-scar"
    root["footprint_m"] = "8.6x5.4"
    root["surface_profile"] = "open-rim,low-core,directional-ejecta,embedded-lip"
    root["readability_feature_scale_m"] = "0.45-4.60"
    root["runtime_primitive_budget"] = 4
    root["runtime_triangle_budget"] = 1000
    root["runtime_material_budget"] = 3
    root["runtime_texture_budget"] = 0
    cluster = empty(collection, "crater_cluster_root", parent=root)

    center = (-0.18, -0.08, 0.024)
    dark_outline = []
    dark_radial = (1.0, 0.94, 1.07, 0.97, 1.03, 0.91, 1.08, 0.96, 1.02, 0.95, 1.05, 0.92)
    rotation = math.radians(-14)
    for index, radial in enumerate(dark_radial):
        angle = math.tau * index / len(dark_radial)
        local_x = math.cos(angle) * 2.72 * radial
        local_y = math.sin(angle) * 1.48 * radial
        dark_outline.append((
            center[0] + local_x * math.cos(rotation) - local_y * math.sin(rotation),
            center[1] + local_x * math.sin(rotation) + local_y * math.cos(rotation),
            0.021 + 0.004 * (index % 3),
        ))
    fan_patch(collection, "crater_low_dark_core", center, dark_outline, mats["earth_dark"], cluster)

    for name, start, end, steps, height in (
        ("crater_rim_northwest", 48, 162, 11, 0.29),
        ("crater_rim_southwest", 192, 296, 10, 0.25),
        ("crater_rim_lower_east", 320, 350, 5, 0.19),
    ):
        broken_ellipse_rim_segment(
            collection,
            name,
            (-0.12, -0.05),
            (3.72, 2.28),
            (2.62, 1.42),
            start,
            end,
            steps,
            height,
            mats["earth"],
            cluster,
            -14,
        )

    # One broad exposed bedrock lip replaces the former ring of independent micro-shards.
    broken_ellipse_rim_segment(
        collection,
        "crater_embedded_rock_lip",
        (-0.12, -0.05),
        (3.58, 2.18),
        (2.7, 1.48),
        164,
        188,
        5,
        0.2,
        mats["rock"],
        cluster,
        -14,
    )

    # Wide, low throw lobes provide impact direction without reading as loose prop debris.
    fan_patch(
        collection,
        "crater_ejecta_primary",
        (3.0, 0.55, 0.065),
        [
            (1.85, -0.1, 0.025), (3.15, -0.22, 0.018), (4.48, 0.22, 0.016),
            (4.2, 0.92, 0.018), (2.95, 1.18, 0.025), (1.82, 0.66, 0.03),
        ],
        mats["earth"],
        cluster,
    )
    fan_patch(
        collection,
        "crater_ejecta_secondary",
        (2.55, 1.42, 0.052),
        [
            (1.56, 0.9, 0.026), (2.5, 0.98, 0.024), (3.72, 1.68, 0.017),
            (3.12, 2.28, 0.018), (2.12, 1.92, 0.024),
        ],
        mats["earth"],
        cluster,
    )
    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "ground_contact"
    glb_path, _ground, _camera = export_asset("ff_crt_01", collection, root, (0.15, 0.1, 0.18), (8.5, -10.5, 12.0), 10.0)
    print(f"FF_CRT_01_GLB={glb_path}")


def build_road_marker() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_RDM_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_RDM_01")
    root["asset_id"] = "ff_rdm_01"
    root["asset_role"] = "decorative_roadside_marker"
    marker = empty(collection, "road_marker_root", parent=root)
    box(collection, "concrete_foot", (2.8, 0.72, 0.72), (0, 0, 0.38), mats["concrete"], marker, 0.1)
    box(collection, "warning_face", (2.4, 0.16, 0.12), (0, -0.42, 0.45), mats["warning"], marker, 0.02)
    for index, x in enumerate((-0.82, 0.82)):
        cylinder(collection, f"marker_post_{index}", 0.11, 1.8, (x, 0, 1.45), mats["steel"], marker, 10, bevel=0.02)
        box(collection, f"marker_signal_{index}", (0.38, 0.24, 0.22), (x, 0, 2.35), mats["cyan"], marker, 0.04)
    box(collection, "marker_crossbar", (2.15, 0.18, 0.2), (0, 0, 1.82), mats["gunmetal"], marker, 0.04)
    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "ground_contact"
    glb_path, _ground, _camera = export_asset("ff_rdm_01", collection, root, (0, 0, 1.1), (6.3, -8, 5.8), 7.0)
    print(f"FF_RDM_01_GLB={glb_path}")


def build_sandbag_emplacement() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_SBG_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_SBG_01")
    root["asset_id"] = "ff_sbg_01"
    root["asset_role"] = "decorative_sandbag_emplacement"
    bags = empty(collection, "sandbag_root", parent=root)
    placements = []
    for row, z in enumerate((0.22, 0.57)):
        for index, x in enumerate((-2.25, -1.35, -0.45, 0.45, 1.35, 2.25)):
            placements.append((f"front_bag_{row}_{index}", x + (0.12 if row else 0), 0, z, 0))
    for side, x in (("left", -2.7), ("right", 2.7)):
        for index, y in enumerate((0.65, 1.48, 2.31)):
            placements.append((f"{side}_bag_{index}", x, y, 0.24 + (index % 2) * 0.08, math.pi / 2))
    for name, x, y, z, rotation in placements:
        bag = box(collection, name, (0.82, 0.56, 0.38), (x, y, z), mats["sand"], bags, 0.16, (0, 0, rotation))
        bag.rotation_euler.z += math.radians((len(name) % 5) - 2)
    box(collection, "firing_step", (3.7, 1.35, 0.18), (0, 1.1, 0.1), mats["earth"], bags, 0.04)
    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "ground_contact"
    glb_path, _ground, _camera = export_asset("ff_sbg_01", collection, root, (0, 0.7, 0.45), (7.5, -9.5, 6.2), 8.5)
    print(f"FF_SBG_01_GLB={glb_path}")


def build_supply_cache() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_CCH_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_CCH_01")
    root["asset_id"] = "ff_cch_01"
    root["asset_role"] = "decorative_supply_cache"
    cache = empty(collection, "cache_root", parent=root)
    for index, (x, y) in enumerate(((-1.0, 0.55), (-0.25, 0.55), (0.55, 0.5))):
        cylinder(collection, f"fuel_drum_{index}", 0.34, 1.05, (x, y, 0.54), mats["canvas"] if index == 1 else mats["warning"], cache, 16, bevel=0.04)
        torus(collection, f"drum_band_top_{index}", 0.34, 0.035, (x, y, 0.83), mats["steel"], cache, scale=(1, 1, 1))
        torus(collection, f"drum_band_low_{index}", 0.34, 0.035, (x, y, 0.26), mats["steel"], cache, scale=(1, 1, 1))
    for index, (x, y, z, scale) in enumerate(((1.2, 0.45, 0.5, 1.0), (1.65, 0.95, 0.34, 0.68), (0.95, 1.25, 0.34, 0.68))):
        box(collection, f"supply_crate_{index}", (1.1 * scale, 1.0 * scale, 0.95 * scale), (x, y, z), mats["earth"], cache, 0.08)
        box(collection, f"crate_strap_{index}", (0.16, 1.03 * scale, 0.98 * scale), (x, y, z), mats["steel"], cache, 0.02)
    box(collection, "cache_tarp", (2.5, 1.55, 0.12), (0.25, 1.5, 0.12), mats["canvas"], cache, 0.04, (math.radians(4), 0, math.radians(-8)))
    service = empty(collection, "supply_socket", (0.4, 0.9, 0.08), root)
    service["socket_role"] = "decorative_service_point"
    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "ground_contact"
    glb_path, _ground, _camera = export_asset("ff_cch_01", collection, root, (0.2, 0.7, 0.6), (6.8, -8.5, 5.6), 7.3)
    print(f"FF_CCH_01_GLB={glb_path}")


def build_auxiliary_generator() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_AUX_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_AUX_01")
    root["asset_id"] = "ff_aux_01"
    root["asset_role"] = "decorative_auxiliary_generator"
    generator = empty(collection, "generator_root", parent=root)
    box(collection, "generator_skid", (3.6, 2.25, 0.28), (0, 0, 0.16), mats["steel"], generator, 0.06)
    box(collection, "generator_body", (2.75, 1.65, 1.55), (0, 0, 1.02), mats["gunmetal"], generator, 0.16)
    box(collection, "service_panel", (1.72, 0.12, 0.88), (0, -0.89, 1.08), mats["panel"], generator, 0.05)
    for index, x in enumerate((-0.58, 0, 0.58)):
        box(collection, f"panel_meter_{index}", (0.34, 0.08, 0.18), (x, -0.97, 1.2), mats["cyan"] if index == 1 else mats["warning"], generator, 0.025)
    for x in (-1.15, 1.15):
        cylinder(collection, f"generator_coil_{x}", 0.32, 1.45, (x, 0.1, 1.28), mats["amber"], generator, 14, (math.pi / 2, 0, 0), 0.04)
    cylinder(collection, "exhaust_stack", 0.14, 2.15, (0.95, 0.55, 2.62), mats["steel"], generator, 10, bevel=0.03)
    cylinder(collection, "exhaust_cap", 0.25, 0.16, (0.95, 0.55, 3.72), mats["burnt"], generator, 10, bevel=0.02)
    box(collection, "powered_status_bar", (1.65, 0.14, 0.18), (0, -0.94, 1.72), mats["cyan"], generator, 0.025)
    service = empty(collection, "service_socket", (0, -1.15, 0.08), root)
    service["socket_role"] = "decorative_service_point"
    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "ground_contact"
    glb_path, _ground, _camera = export_asset("ff_aux_01", collection, root, (0, 0, 1.4), (7.2, -9.2, 6.2), 8.0)
    print(f"FF_AUX_01_GLB={glb_path}")


def build_dry_scrub_cluster() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_SCR_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_SCR_01")
    root["asset_id"] = "ff_scr_01"
    root["asset_role"] = "decorative_dry_scrub"
    root["asset_revision"] = "static-material-merge-v2"
    root["runtime_primitive_budget"] = 4
    root["runtime_material_budget"] = 3
    scrub = empty(collection, "scrub_root", parent=root)
    clumps = [(-0.75, 0.1, 1.0), (0.35, -0.25, 1.25), (1.0, 0.4, 0.82), (-0.15, 0.85, 0.68)]
    for clump_index, (cx, cy, scale) in enumerate(clumps):
        for blade_index in range(7):
            angle = (blade_index / 7) * math.pi * 2 + clump_index * 0.37
            length = (0.75 + (blade_index % 3) * 0.18) * scale
            x = cx + math.cos(angle) * 0.18 * scale
            y = cy + math.sin(angle) * 0.18 * scale
            blade = box(
                collection,
                f"scrub_blade_{clump_index}_{blade_index}",
                (0.11, 0.14, length),
                (x, y, length * 0.46),
                mats["sage_light"] if blade_index % 3 == 0 else mats["sage"],
                scrub,
                0.025,
            )
            blade.rotation_euler = (math.radians(12 + blade_index * 3), math.radians(-18 + blade_index * 5), angle)
        cylinder(collection, f"scrub_base_{clump_index}", 0.28 * scale, 0.12, (cx, cy, 0.06), mats["earth"], scrub, 8, bevel=0.02)
    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "ground_contact"
    glb_path, _ground, _camera = export_asset("ff_scr_01", collection, root, (0, 0.25, 0.55), (5.8, -7.2, 4.8), 6.2)
    print(f"FF_SCR_01_GLB={glb_path}")


def build_dead_stump() -> None:
    reset_scene()
    mats = make_materials()
    collection = bpy.data.collections.new("FF_STM_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_STM_01")
    root["asset_id"] = "ff_stm_01"
    root["asset_role"] = "decorative_dead_stump"
    stump = empty(collection, "stump_root", parent=root)
    trunk = cylinder(collection, "split_trunk", 0.42, 2.35, (0, 0, 1.12), mats["wood"], stump, 9, bevel=0.05)
    trunk.rotation_euler = (math.radians(6), math.radians(-4), math.radians(5))
    for index, (angle, height, length) in enumerate(((28, 1.45, 1.25), (152, 1.8, 1.05), (245, 1.15, 0.9))):
        radians = math.radians(angle)
        branch = cylinder(
            collection,
            f"dead_branch_{index}",
            0.14,
            length,
            (math.cos(radians) * 0.34, math.sin(radians) * 0.34, height),
            mats["wood"],
            stump,
            8,
            (math.radians(58), 0, radians),
            0.025,
        )
        branch.rotation_euler.z = radians
    for index, (x, y, scale) in enumerate(((-0.7, 0.35, 0.42), (0.65, -0.25, 0.34), (0.3, 0.72, 0.28))):
        root_piece = box(collection, f"exposed_root_{index}", (1.15 * scale, 0.28, 0.18), (x, y, 0.12), mats["wood"], stump, 0.05)
        root_piece.rotation_euler.z = math.atan2(y, x)
    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "ground_contact"
    glb_path, _ground, _camera = export_asset("ff_stm_01", collection, root, (0, 0, 1.1), (5.5, -7, 4.8), 6.0)
    print(f"FF_STM_01_GLB={glb_path}")


def build_enemy_tank() -> None:
    reset_scene()
    mats = make_enemy_materials(textured=True)
    collection = bpy.data.collections.new("FF_EN_MBT_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_EN_MBT_01")
    root["asset_id"] = "ff_en_mbt_01"
    root["asset_role"] = "enemy_assault_tank"
    root["provenance"] = "project_procedural_blender"
    root["asset_revision"] = "enemy-hero-baseline-v2"
    root["render_profile"] = "strategic-camera-hero"
    chassis = empty(collection, "chassis_root", parent=root)

    for side_index, x in enumerate((-1.43, 1.43)):
        track = empty(collection, f"track_{'left' if x < 0 else 'right'}", parent=chassis)
        box(collection, f"track_bed_{side_index}", (0.62, 4.85, 0.72), (x, 0.05, 0.58), mats["rubber"], track, 0.12)
        box(collection, f"track_armor_{side_index}", (0.72, 4.25, 0.36), (x, -0.02, 0.98), mats["armor_dark"], track, 0.06)
        box(collection, f"track_marking_{side_index}", (0.77, 1.2, 0.11), (x, -1.3, 1.17), mats["armor"], track, 0.018)
        for wheel_index, y in enumerate((-1.62, -0.82, 0, 0.82, 1.62)):
            cylinder(collection, f"roadwheel_{side_index}_{wheel_index}", 0.36, 0.28, (x + (-0.32 if x < 0 else 0.32), y, 0.56), mats["steel"], track, 14, (0, math.pi / 2, 0), 0.035)
            cylinder(collection, f"roadwheel_hub_{side_index}_{wheel_index}", 0.16, 0.32, (x + (-0.46 if x < 0 else 0.46), y, 0.56), mats["armor_dark"], track, 12, (0, math.pi / 2, 0), 0.018)
        for tread_index, y in enumerate([-2.0 + index * 0.31 for index in range(14)]):
            box(collection, f"tread_top_{side_index}_{tread_index}", (0.7, 0.24, 0.12), (x, y, 1.17), mats["rubber"], track, 0.012)
            box(collection, f"tread_bottom_{side_index}_{tread_index}", (0.7, 0.24, 0.12), (x, y, 0.1), mats["rubber"], track, 0.012)
        for end_sign in (-1, 1):
            for arc_index, degrees in enumerate((-66, -33, 0, 33, 66)):
                angle = math.radians(degrees)
                box(collection, f"tread_arc_{side_index}_{end_sign:+d}_{arc_index}", (0.7, 0.24, 0.12), (x, end_sign * (2.02 + math.cos(angle) * 0.34), 0.62 + math.sin(angle) * 0.52), mats["rubber"], track, 0.012, (end_sign * angle, 0, 0))

    box(collection, "lower_hull", (2.72, 4.5, 0.62), (0, 0.12, 0.86), mats["armor_dark"], chassis, 0.12)
    box(collection, "wedge_nose", (2.5, 1.5, 0.48), (0, -1.75, 1.18), mats["armor"], chassis, 0.1, (math.radians(-12), 0, 0))
    box(collection, "center_hull", (2.34, 2.5, 0.62), (0, -0.02, 1.32), mats["armor_dark"], chassis, 0.12)
    box(collection, "rear_engine_deck", (2.42, 1.15, 0.38), (0, 1.48, 1.3), mats["recess"], chassis, 0.07)
    for index, x in enumerate((-0.78, -0.26, 0.26, 0.78)):
        box(collection, f"engine_louver_{index}", (0.3, 0.72, 0.08), (x, 1.45, 1.54), mats["steel"], chassis, 0.018)
    for side, x in enumerate((-0.94, 0.94)):
        box(collection, f"nose_fang_{side}", (0.38, 1.15, 0.34), (x, -2.04, 1.18), mats["bone"], chassis, 0.04, (math.radians(-12), 0, math.radians(-8 if x < 0 else 8)))
        box(collection, f"segmented_side_skirt_{side}", (0.18, 3.25, 0.52), (x + (-0.18 if x < 0 else 0.18), 0.0, 1.2), mats["armor_dark"], chassis, 0.035)
        for panel_index, y in enumerate((-1.18, -0.38, 0.42, 1.22)):
            box(collection, f"side_skirt_plate_{side}_{panel_index}", (0.08, 0.68, 0.4), (x + (-0.29 if x < 0 else 0.29), y, 1.22), mats["armor"] if panel_index in (0, 3) else mats["armor_dark"], chassis, 0.018)
    for x in (-0.7, 0.7):
        box(collection, f"front_signal_guard_{x:+.2f}", (0.4, 0.18, 0.24), (x, -2.28, 1.05), mats["armor_dark"], chassis, 0.035)
        box(collection, f"powered_front_signal_{x:+.2f}", (0.22, 0.06, 0.09), (x, -2.39, 1.05), mats["signal"], chassis, 0.012)
        cylinder(collection, f"rear_exhaust_{x:+.2f}", 0.13, 0.82, (x, 1.8, 1.78), mats["steel"], chassis, 12, bevel=0.018)

    turret = empty(collection, "turret_yaw", (0, -0.18, 1.62), chassis)
    turret["socket_role"] = "weapon_yaw"
    cylinder(collection, "turret_ring", 0.82, 0.28, (0, 0, 0.13), mats["steel"], turret, 18)
    box(collection, "turret_core", (1.9, 1.75, 0.76), (0, 0.05, 0.68), mats["armor_dark"], turret, 0.13)
    for side, x in enumerate((-0.76, 0.76)):
        box(collection, f"turret_cheek_{side}", (0.56, 1.52, 0.64), (x, -0.1, 0.66), mats["armor"], turret, 0.08, (0, 0, math.radians(-9 if x < 0 else 9)))
    box(collection, "turret_crown", (1.26, 1.16, 0.24), (0, 0.14, 1.19), mats["bone"], turret, 0.055)
    box(collection, "powered_targeting_slit", (0.92, 0.11, 0.14), (0, -0.86, 0.92), mats["signal"], turret, 0.018)
    for x in (-0.58, 0.58):
        box(collection, f"turret_bustle_{x:+.2f}", (0.42, 0.58, 0.34), (x, 0.9, 0.72), mats["armor_dark"], turret, 0.04)
        for launcher_index in range(3):
            cylinder(collection, f"smoke_launcher_{x:+.2f}_{launcher_index}", 0.06, 0.3, (x, -0.65 + launcher_index * 0.13, 1.05 + launcher_index * 0.04), mats["steel"], turret, 10, (math.radians(58), 0, math.radians(-18 if x < 0 else 18)), 0.008)
    cylinder(collection, "commander_hatch", 0.34, 0.14, (-0.34, 0.15, 1.38), mats["armor_dark"], turret, 18, bevel=0.02)
    box(collection, "commander_optic", (0.3, 0.3, 0.28), (0.4, -0.02, 1.45), mats["armor_dark"], turret, 0.035)
    box(collection, "powered_commander_lens", (0.17, 0.055, 0.1), (0.4, -0.19, 1.47), mats["signal"], turret, 0.012)
    for x in (-0.54, 0.54):
        cylinder(collection, f"sensor_horn_{x:+.2f}", 0.055, 0.62, (x, 0.26, 1.55), mats["steel"], turret, 8, (0, math.radians(18 if x > 0 else -18), 0))

    barrel = empty(collection, "barrel_pitch", (0, -0.68, 0.8), turret)
    barrel["socket_role"] = "weapon_pitch"
    cylinder(collection, "main_cannon", 0.17, 3.9, (0, -1.78, 0), mats["steel"], barrel, 14, (math.pi / 2, 0, 0))
    cylinder(collection, "thermal_sleeve", 0.25, 1.28, (0, -0.72, 0), mats["recess"], barrel, 14, (math.pi / 2, 0, 0))
    for band_index, y in enumerate((-1.45, -2.5)):
        cylinder(collection, f"barrel_band_{band_index}", 0.21, 0.16, (0, y, 0), mats["armor"] if band_index == 0 else mats["armor_dark"], barrel, 14, (math.pi / 2, 0, 0), 0.014)
    box(collection, "split_muzzle_brake", (0.62, 0.52, 0.42), (0, -3.78, 0), mats["armor_dark"], barrel, 0.05)
    box(collection, "muzzle_cut", (0.18, 0.62, 0.5), (0, -3.78, 0), mats["recess"], barrel, 0.02)
    muzzle = empty(collection, "muzzle_socket", (0, -4.08, 0), barrel)
    muzzle["socket_role"] = "projectile_origin"
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    damage_engine = empty(collection, "damage_socket_engine", (0, 1.42, 1.72), chassis)
    damage_engine["socket_role"] = "damage_emitter"
    damage_turret = empty(collection, "damage_socket_turret", (0, 0.1, 1.42), turret)
    damage_turret["socket_role"] = "damage_emitter"
    wreck_anchor = empty(collection, "wreck_anchor", (0, 0, 0.08), root)
    wreck_anchor["socket_role"] = "wreck_replacement"
    build_vehicle_wreck(collection, root, mats, "mbt")
    glb_path, _ground, _camera = export_asset("ff_en_mbt_01", collection, root, (0, -0.4, 1.25), (8.5, -10.8, 7.2), 8.5)
    print(f"FF_EN_MBT_01_GLB={glb_path}")


def build_enemy_trooper(collection, mats, name, location, role, squad):
    soldier = empty(collection, name, location, squad)
    soldier["unit_role"] = role
    for index, x in enumerate((-0.14, 0.14)):
        box(collection, f"{name}_boot_{index}", (0.24, 0.4, 0.22), (x, -0.03, 0.12), mats["recess"], soldier, 0.04)
        box(collection, f"{name}_shin_{index}", (0.22, 0.24, 0.58), (x, 0, 0.5), mats["armor_dark"], soldier, 0.045)
    box(collection, f"{name}_pelvis", (0.58, 0.38, 0.28), (0, 0, 0.8), mats["recess"], soldier, 0.055)
    box(collection, f"{name}_torso", (0.7, 0.44, 0.7), (0, 0, 1.15), mats["armor_dark"], soldier, 0.08)
    box(collection, f"{name}_chest_vane", (0.4, 0.13, 0.36), (0, -0.27, 1.2), mats["armor"], soldier, 0.035, (0, 0, math.radians(45)))
    box(collection, f"{name}_back_unit", (0.5, 0.3, 0.56), (0, 0.31, 1.17), mats["recess"], soldier, 0.055)
    for index, x in enumerate((-0.45, 0.45)):
        box(collection, f"{name}_pauldron_{index}", (0.34, 0.5, 0.3), (x, 0, 1.36), mats["armor"], soldier, 0.065, (0, 0, math.radians(-14 if x < 0 else 14)))
        arm = box(collection, f"{name}_arm_{index}", (0.2, 0.23, 0.6), (x, -0.04, 1.06), mats["steel"], soldier, 0.045)
        arm.rotation_euler.y = math.radians(-9 if x < 0 else 9)
    box(collection, f"{name}_helmet", (0.48, 0.42, 0.38), (0, 0, 1.68), mats["armor_dark"], soldier, 0.1)
    box(collection, f"powered_{name}_visor", (0.34, 0.1, 0.1), (0, -0.24, 1.7), mats["signal"], soldier, 0.02)
    if role == "rifle":
        # A low transverse crest and heavy carbine create a compact assault
        # silhouette, distinct from the tall service tower and siege launcher.
        box(collection, f"{name}_helmet_crest", (0.5, 0.18, 0.14), (0, 0.08, 1.94), mats["bone"], soldier, 0.03)
        box(collection, f"{name}_rifle_stock", (0.38, 0.46, 0.3), (0.18, 0.04, 1.16), mats["armor_dark"], soldier, 0.055)
        box(collection, f"{name}_rifle_body", (0.34, 0.72, 0.28), (0.18, -0.38, 1.16), mats["recess"], soldier, 0.045)
        cylinder(collection, f"{name}_rifle_barrel", 0.07, 0.9, (0.18, -1.12, 1.16), mats["steel"], soldier, 8, (math.pi / 2, 0, 0))
        box(collection, f"{name}_rifle_bayonet", (0.16, 0.5, 0.12), (0.18, -1.55, 1.08), mats["bone"], soldier, 0.02, (math.radians(-8), 0, 0))
        box(collection, f"powered_{name}_rifle_cell", (0.16, 0.3, 0.16), (0.33, -0.24, 1.12), mats["signal"], soldier, 0.022)
    elif role == "launcher":
        box(collection, f"{name}_launcher_helmet_plate", (0.5, 0.38, 0.14), (0, 0.02, 1.91), mats["bone"], soldier, 0.035)
    elif role == "engineer":
        box(collection, f"{name}_engineer_helmet_block", (0.4, 0.36, 0.22), (0, 0.08, 1.91), mats["bone"], soldier, 0.04)
    return soldier


def build_enemy_rifle_squad() -> None:
    reset_scene()
    mats = make_enemy_materials()
    collection = bpy.data.collections.new("FF_EN_RIF_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_EN_RIF_01")
    root["asset_id"] = "ff_en_rif_01"
    root["asset_role"] = "enemy_rifle_squad"
    root["provenance"] = "project_procedural_blender"
    tag_infantry_silhouette(root, "enemy_rifle_broadguard_v2", "broad_pauldrons,transverse_crest,heavy_carbine")
    squad = empty(collection, "squad_root", parent=root)
    lead = build_enemy_trooper(collection, mats, "soldier_lead", (0, -0.58, 0), "rifle", squad)
    build_enemy_trooper(collection, mats, "soldier_left", (-0.52, 0.34, 0), "rifle", squad)
    build_enemy_trooper(collection, mats, "soldier_right", (0.52, 0.34, 0), "rifle", squad)
    box(collection, "leader_banner", (0.12, 0.32, 0.44), (-0.22, 0.22, 1.86), mats["armor"], lead, 0.025, (0, math.radians(8), math.radians(-16)))
    muzzle = empty(collection, "muzzle_socket", (0.18, -1.8, 1.16), lead)
    muzzle["socket_role"] = "projectile_origin"
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_en_rif_01", collection, root, (0, 0, 1.02), (4.1, -5.8, 4.1), 4.2)
    print(f"FF_EN_RIF_01_GLB={glb_path}")


def build_enemy_antitank_squad() -> None:
    reset_scene()
    mats = make_enemy_materials()
    collection = bpy.data.collections.new("FF_EN_AT_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_EN_AT_01")
    root["asset_id"] = "ff_en_at_01"
    root["asset_role"] = "enemy_antitank_squad"
    root["provenance"] = "project_procedural_blender"
    tag_infantry_silhouette(root, "enemy_antitank_siegetube_v2", "siege_tube,wide_blast_fins,warhead_cases")
    squad = empty(collection, "squad_root", parent=root)
    lead = build_enemy_trooper(collection, mats, "launcher_lead", (0, -0.58, 0), "launcher", squad)
    build_enemy_trooper(collection, mats, "loader_left", (-0.52, 0.34, 0), "rifle", squad)
    build_enemy_trooper(collection, mats, "loader_right", (0.52, 0.34, 0), "rifle", squad)
    launcher = empty(collection, "launcher_pitch", (0.18, -0.04, 1.42), lead)
    launcher["socket_role"] = "weapon_pitch"
    box(collection, "launcher_spine", (0.46, 1.72, 0.4), (0, -0.5, 0), mats["armor_dark"], launcher, 0.065)
    cylinder(collection, "launcher_tube", 0.21, 2.18, (0, -0.76, 0), mats["steel"], launcher, 12, (math.pi / 2, 0, 0))
    cylinder(collection, "launcher_blast_collar", 0.31, 0.34, (0, 0.18, 0), mats["bone"], launcher, 12, (math.pi / 2, 0, 0))
    box(collection, "launcher_fins", (0.92, 0.58, 0.18), (0, -0.24, 0), mats["armor"], launcher, 0.045)
    box(collection, "launcher_face_shield", (0.58, 0.2, 0.56), (0, -0.48, 0.28), mats["armor"], launcher, 0.055, (math.radians(-6), 0, 0))
    box(collection, "powered_launcher_sight", (0.24, 0.42, 0.22), (0.34, -0.62, 0.34), mats["signal"], launcher, 0.03)
    muzzle = empty(collection, "muzzle_socket", (0, -1.92, 0), launcher)
    muzzle["socket_role"] = "projectile_origin"
    for side, x in enumerate((-0.64, 0.64)):
        box(collection, f"warhead_case_{side}", (0.42, 0.72, 0.42), (x, 0.42, 0.4), mats["bone"], squad, 0.06)
        box(collection, f"warhead_mark_{side}", (0.44, 0.2, 0.2), (x, 0.17, 0.5), mats["armor"], squad, 0.03)
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_en_at_01", collection, root, (0, 0, 1.05), (4.3, -6, 4.2), 4.4)
    print(f"FF_EN_AT_01_GLB={glb_path}")


def build_enemy_scout_vehicle() -> None:
    reset_scene()
    mats = make_enemy_materials()
    collection = bpy.data.collections.new("FF_EN_SCT_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_EN_SCT_01")
    root["asset_id"] = "ff_en_sct_01"
    root["asset_role"] = "enemy_scout_vehicle"
    root["provenance"] = "project_procedural_blender"
    chassis = empty(collection, "chassis_root", parent=root)
    box(collection, "keel", (1.72, 3.45, 0.46), (0, 0, 0.67), mats["armor_dark"], chassis, 0.12)
    box(collection, "spear_nose", (1.55, 1.42, 0.42), (0, -1.43, 0.98), mats["armor"], chassis, 0.09, (math.radians(-12), 0, 0))
    box(collection, "crew_pod", (1.5, 1.42, 0.62), (0, -0.05, 1.16), mats["armor_dark"], chassis, 0.12)
    box(collection, "powered_forward_slit", (0.94, 0.1, 0.14), (0, -0.78, 1.3), mats["signal"], chassis, 0.018)
    box(collection, "rear_drive", (1.65, 0.88, 0.32), (0, 1.28, 0.98), mats["recess"], chassis, 0.06)
    for side_index, x in enumerate((-1.03, 1.03)):
        for axle_index, y in enumerate((-1.18, 1.08)):
            cylinder(collection, f"wheel_{side_index}_{axle_index}", 0.45, 0.36, (x, y, 0.51), mats["rubber"], chassis, 14, (0, math.pi / 2, 0), 0.045)
            cylinder(collection, f"hub_{side_index}_{axle_index}", 0.2, 0.4, (x, y, 0.51), mats["armor"], chassis, 12, (0, math.pi / 2, 0), 0.03)
        box(collection, f"blade_fender_{side_index}", (0.18, 2.7, 0.24), (x, -0.02, 0.88), mats["bone"], chassis, 0.04)
    turret = empty(collection, "turret_yaw", (0, -0.1, 1.48), chassis)
    turret["socket_role"] = "weapon_yaw"
    cylinder(collection, "turret_ring", 0.42, 0.2, (0, 0, 0.1), mats["steel"], turret, 12)
    box(collection, "turret_wedge", (0.72, 0.82, 0.34), (0, -0.05, 0.34), mats["armor"], turret, 0.07)
    cylinder(collection, "needle_gun", 0.065, 1.24, (0, -0.88, 0.34), mats["steel"], turret, 8, (math.pi / 2, 0, 0))
    muzzle = empty(collection, "muzzle_socket", (0, -1.52, 0.34), turret)
    muzzle["socket_role"] = "projectile_origin"
    radar = empty(collection, "radar_yaw", (0, 0.78, 1.42), chassis)
    radar["spin_speed"] = 1.2
    cylinder(collection, "radar_mast", 0.055, 0.74, (0, 0, 0.36), mats["steel"], radar, 8)
    box(collection, "powered_radar_fork", (1.08, 0.14, 0.13), (0, 0, 0.75), mats["signal"], radar, 0.03)
    for x in (-0.42, 0.42):
        box(collection, f"radar_tip_{x:+.2f}", (0.12, 0.16, 0.42), (x, 0, 0.94), mats["bone"], radar, 0.025)
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_en_sct_01", collection, root, (0, 0, 0.9), (6.2, -7.8, 5.4), 6.6)
    print(f"FF_EN_SCT_01_GLB={glb_path}")


def build_enemy_suppressor_vehicle() -> None:
    reset_scene()
    mats = make_enemy_materials()
    collection = bpy.data.collections.new("FF_EN_SUP_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_EN_SUP_01")
    root["asset_id"] = "ff_en_sup_01"
    root["asset_role"] = "enemy_chaincannon_vehicle"
    root["provenance"] = "project_procedural_blender"
    chassis = empty(collection, "chassis_root", parent=root)
    box(collection, "lower_hull", (2.52, 4.2, 0.62), (0, 0.05, 0.73), mats["armor_dark"], chassis, 0.15)
    box(collection, "ram_nose", (2.25, 1.28, 0.48), (0, -1.63, 1.04), mats["armor"], chassis, 0.11, (math.radians(-11), 0, 0))
    box(collection, "crew_block", (2.05, 1.94, 0.65), (0, -0.1, 1.19), mats["armor_dark"], chassis, 0.12)
    box(collection, "rear_vents", (2.16, 0.96, 0.35), (0, 1.48, 1.08), mats["recess"], chassis, 0.06)
    for side_index, x in enumerate((-1.38, 1.38)):
        for axle_index, y in enumerate((-1.36, 0, 1.32)):
            cylinder(collection, f"wheel_{side_index}_{axle_index}", 0.48, 0.38, (x, y, 0.58), mats["rubber"], chassis, 14, (0, math.pi / 2, 0), 0.045)
            cylinder(collection, f"hub_{side_index}_{axle_index}", 0.2, 0.42, (x, y, 0.58), mats["steel"], chassis, 12, (0, math.pi / 2, 0), 0.03)
        box(collection, f"side_armor_{side_index}", (0.24, 3.65, 0.36), (x, 0, 0.98), mats["armor"], chassis, 0.055)
        box(collection, f"side_mark_{side_index}", (0.27, 0.88, 0.12), (x, -1.05, 1.18), mats["bone"], chassis, 0.018)
    turret = empty(collection, "turret_yaw", (0, -0.2, 1.54), chassis)
    turret["socket_role"] = "weapon_yaw"
    cylinder(collection, "turret_ring", 0.78, 0.28, (0, 0, 0.13), mats["steel"], turret, 16)
    box(collection, "turret_block", (1.7, 1.42, 0.7), (0, 0.03, 0.63), mats["armor_dark"], turret, 0.13)
    box(collection, "turret_brow", (1.42, 0.38, 0.28), (0, -0.68, 0.83), mats["armor"], turret, 0.055)
    for side_index, x in enumerate((-0.42, 0.42)):
        cylinder(collection, f"rotary_barrel_{side_index}", 0.12, 2.18, (x, -1.63, 0.57), mats["steel"], turret, 10, (math.pi / 2, 0, 0))
        cylinder(collection, f"barrel_jacket_{side_index}", 0.25, 0.92, (x, -0.82, 0.57), mats["recess"], turret, 12, (math.pi / 2, 0, 0))
        muzzle = empty(collection, f"muzzle_socket_{'left' if side_index == 0 else 'right'}", (x, -2.78, 0.57), turret)
        muzzle["socket_role"] = "projectile_origin"
    box(collection, "powered_targeting_mask", (0.82, 0.1, 0.14), (0, -0.73, 1.04), mats["signal"], turret, 0.018)
    box(collection, "ammo_backpack", (1.38, 0.72, 0.74), (0, 0.92, 0.72), mats["armor"], turret, 0.09)
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_en_sup_01", collection, root, (0, 0, 1.18), (7.4, -9.2, 6.2), 8.2)
    print(f"FF_EN_SUP_01_GLB={glb_path}")


def build_enemy_artillery_vehicle() -> None:
    reset_scene()
    mats = make_enemy_materials()
    collection = bpy.data.collections.new("FF_EN_ART_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_EN_ART_01")
    root["asset_id"] = "ff_en_art_01"
    root["asset_role"] = "enemy_long_range_artillery"
    root["provenance"] = "project_procedural_blender"
    chassis = empty(collection, "chassis_root", parent=root)
    for side_index, x in enumerate((-1.3, 1.3)):
        box(collection, f"track_bed_{side_index}", (0.6, 4.55, 0.72), (x, 0, 0.55), mats["rubber"], chassis, 0.15)
        box(collection, f"track_skirt_{side_index}", (0.67, 3.9, 0.26), (x, -0.05, 0.96), mats["armor"], chassis, 0.05)
        for wheel_index, y in enumerate((-1.48, -0.5, 0.5, 1.48)):
            cylinder(collection, f"wheel_{side_index}_{wheel_index}", 0.33, 0.3, (x + (-0.31 if x < 0 else 0.31), y, 0.54), mats["steel"], chassis, 12, (0, math.pi / 2, 0), 0.035)
    box(collection, "lower_hull", (2.3, 4.05, 0.58), (0, 0, 0.78), mats["armor_dark"], chassis, 0.14)
    box(collection, "front_wedge", (2.05, 1.2, 0.42), (0, -1.52, 1.08), mats["armor"], chassis, 0.09, (math.radians(-9), 0, 0))
    box(collection, "rear_magazine", (2.16, 1.62, 0.74), (0, 0.98, 1.23), mats["recess"], chassis, 0.11)
    for x in (-0.7, 0.7):
        box(collection, f"rear_spade_{x:+.2f}", (0.28, 1.62, 0.2), (x, 2.42, 0.2), mats["bone"], chassis, 0.035)
    turret = empty(collection, "turret_yaw", (0, -0.34, 1.5), chassis)
    turret["socket_role"] = "weapon_yaw"
    cylinder(collection, "turret_ring", 0.86, 0.3, (0, 0, 0.14), mats["steel"], turret, 16)
    box(collection, "gun_house", (1.82, 2.05, 1.0), (0, 0.2, 0.72), mats["armor_dark"], turret, 0.15)
    for x in (-0.68, 0.68):
        box(collection, f"gun_shield_{x:+.2f}", (0.48, 1.7, 0.82), (x, -0.15, 0.78), mats["armor"], turret, 0.075, (0, 0, math.radians(-8 if x < 0 else 8)))
    barrel = empty(collection, "barrel_pitch", (0, -0.75, 0.92), turret)
    barrel["socket_role"] = "weapon_pitch"
    barrel.rotation_euler.x = math.radians(13)
    cylinder(collection, "siege_barrel", 0.19, 5.25, (0, -2.4, 0), mats["steel"], barrel, 14, (math.pi / 2, 0, 0))
    cylinder(collection, "barrel_jacket", 0.35, 1.72, (0, -0.78, 0), mats["recess"], barrel, 14, (math.pi / 2, 0, 0))
    box(collection, "muzzle_brake", (0.72, 0.62, 0.46), (0, -5.02, 0), mats["armor_dark"], barrel, 0.055)
    box(collection, "muzzle_slot", (0.2, 0.72, 0.56), (0, -5.02, 0), mats["recess"], barrel, 0.02)
    muzzle = empty(collection, "muzzle_socket", (0, -5.38, 0), barrel)
    muzzle["socket_role"] = "projectile_origin"
    box(collection, "powered_rangefinder", (0.72, 0.13, 0.18), (0.58, -0.78, 1.34), mats["signal"], turret, 0.025)
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_en_art_01", collection, root, (0, -0.5, 1.3), (8.5, -11, 7), 9.4)
    print(f"FF_EN_ART_01_GLB={glb_path}")


def build_enemy_harvester() -> None:
    reset_scene()
    mats = make_enemy_materials()
    collection = bpy.data.collections.new("FF_EN_HRV_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_EN_HRV_01")
    root["asset_id"] = "ff_en_hrv_01"
    root["asset_role"] = "enemy_resource_harvester"
    root["provenance"] = "project_procedural_blender"
    root["asset_revision"] = "enemy-logistics-hero-v2"
    root["render_profile"] = "strategic-camera-hero"
    chassis = empty(collection, "chassis_root", parent=root)
    for side_index, x in enumerate((-1.46, 1.46)):
        track = empty(collection, f"track_{'left' if x < 0 else 'right'}", parent=chassis)
        box(collection, f"track_bed_{side_index}", (0.64, 4.85, 0.74), (x, 0.08, 0.58), mats["rubber"], track, 0.14)
        box(collection, f"track_guard_{side_index}", (0.72, 4.25, 0.3), (x, 0.04, 1.0), mats["armor"], track, 0.055)
        for wheel_index, y in enumerate((-1.62, -0.8, 0, 0.8, 1.62)):
            cylinder(collection, f"wheel_{side_index}_{wheel_index}", 0.34, 0.28, (x + (-0.32 if x < 0 else 0.32), y, 0.57), mats["steel"], track, 12, (0, math.pi / 2, 0), 0.035)
            cylinder(collection, f"hub_{side_index}_{wheel_index}", 0.15, 0.32, (x + (-0.46 if x < 0 else 0.46), y, 0.57), mats["armor_dark"], track, 10, (0, math.pi / 2, 0), 0.016)
        for tread_index, y in enumerate([-2.0 + index * 0.32 for index in range(13)]):
            box(collection, f"tread_top_{side_index}_{tread_index}", (0.7, 0.25, 0.12), (x, y, 1.15), mats["rubber"], track, 0.012)
            box(collection, f"tread_bottom_{side_index}_{tread_index}", (0.7, 0.25, 0.12), (x, y, 0.1), mats["rubber"], track, 0.012)
        for end_sign in (-1, 1):
            for arc_index, degrees in enumerate((-62, -31, 0, 31, 62)):
                angle = math.radians(degrees)
                box(collection, f"tread_arc_{side_index}_{end_sign:+d}_{arc_index}", (0.7, 0.25, 0.12), (x, end_sign * (2.02 + math.cos(angle) * 0.34), 0.62 + math.sin(angle) * 0.52), mats["rubber"], track, 0.012, (end_sign * angle, 0, 0))
    box(collection, "lower_hull", (2.78, 4.55, 0.62), (0, 0.1, 0.84), mats["armor_dark"], chassis, 0.14)
    box(collection, "armored_cabin", (2.25, 1.6, 1.18), (0, -0.72, 1.75), mats["armor_dark"], chassis, 0.12, (math.radians(-4), 0, 0))
    box(collection, "cabin_brow", (2.05, 0.42, 0.28), (0, -1.52, 2.13), mats["armor"], chassis, 0.055)
    box(collection, "powered_windscreen", (1.25, 0.1, 0.28), (0, -1.55, 1.78), mats["signal"], chassis, 0.025)
    box(collection, "cabin_roof_plate", (1.82, 1.12, 0.16), (0, -0.62, 2.42), mats["armor"], chassis, 0.04)
    for x in (-0.76, 0.76):
        box(collection, f"powered_harvest_lamp_{x:+.2f}", (0.22, 0.08, 0.13), (x, -1.6, 1.42), mats["signal"], chassis, 0.014)
    cargo = empty(collection, "cargo_bed", (0, 0, 0), chassis)
    box(collection, "cargo_hopper", (2.28, 1.82, 0.92), (0, 1.25, 1.62), mats["recess"], cargo, 0.1)
    for x in (-0.92, 0.92):
        box(collection, f"hopper_wall_{x:+.2f}", (0.2, 1.95, 1.18), (x, 1.25, 1.92), mats["armor"], cargo, 0.045, (0, math.radians(-5 if x < 0 else 5), 0))
        for brace_index, y in enumerate((0.72, 1.25, 1.78)):
            box(collection, f"hopper_brace_{x:+.2f}_{brace_index}", (0.08, 0.14, 0.92), (x + (-0.12 if x < 0 else 0.12), y, 1.94), mats["bone"], cargo, 0.014)
    for index, x in enumerate((-0.68, 0, 0.68)):
        slot = empty(collection, f"cargo_slot_{index}", (x, 1.2, 2.42 + abs(x) * 0.14), cargo)
        slot["socket_role"] = "cargo_stage"
        crystal(collection, f"cargo_crystal_{index}", (0, 0, 0), (0.27, 0.27, 0.68), mats["crystal"], slot)
    resource_socket = empty(collection, "resource_socket", (0, 1.18, 2.3), cargo)
    resource_socket["socket_role"] = "cargo_visual_origin"
    collector = empty(collection, "collector_head", (0, -2.48, 0.62), chassis)
    collector["socket_role"] = "harvest_intake"
    cylinder(collection, "collector_drum", 0.58, 2.55, (0, 0, 0), mats["steel"], collector, 16, (0, math.pi / 2, 0), 0.04)
    for index in range(8):
        angle = index * math.tau / 8
        for x in (-1.05, 0, 1.05):
            box(collection, f"collector_tooth_{index}_{x}", (0.16, 0.48, 0.16), (x, -math.sin(angle) * 0.62, math.cos(angle) * 0.62), mats["bone"], collector, 0.02, (angle, 0, 0))
    for x in (-1.22, 1.22):
        box(collection, f"collector_fang_{x:+.2f}", (0.24, 1.08, 0.22), (x, -0.28, 0.08), mats["armor"], collector, 0.04, (math.radians(-14), 0, math.radians(-8 if x < 0 else 8)))
        box(collection, f"collector_guard_{x:+.2f}", (0.18, 0.24, 1.25), (x, 0.05, 0.45), mats["armor_dark"], collector, 0.035, (0, math.radians(-10 if x < 0 else 10), 0))
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    damage_engine = empty(collection, "damage_socket_engine", (0, -0.3, 2.38), chassis)
    damage_engine["socket_role"] = "damage_emitter"
    wreck_anchor = empty(collection, "wreck_anchor", (0, 0, 0.08), root)
    wreck_anchor["socket_role"] = "wreck_replacement"
    build_vehicle_wreck(collection, root, mats, "hrv")
    glb_path, _ground, _camera = export_asset("ff_en_hrv_01", collection, root, (0, -0.2, 1.3), (8.2, -10.5, 7), 8.8)
    print(f"FF_EN_HRV_01_GLB={glb_path}")


def build_enemy_engineer_squad() -> None:
    reset_scene()
    mats = make_enemy_materials()
    collection = bpy.data.collections.new("FF_EN_ENG_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_EN_ENG_01")
    root["asset_id"] = "ff_en_eng_01"
    root["asset_role"] = "enemy_engineer_squad"
    root["provenance"] = "project_procedural_blender"
    tag_infantry_silhouette(root, "enemy_engineer_repairtower_v2", "split_service_towers,twin_coils,pronged_tool")
    squad = empty(collection, "squad_root", parent=root)
    engineers = [
        build_enemy_trooper(collection, mats, "engineer_lead", (0, -0.58, 0), "engineer", squad),
        build_enemy_trooper(collection, mats, "engineer_left", (-0.52, 0.34, 0), "engineer", squad),
        build_enemy_trooper(collection, mats, "engineer_right", (0.52, 0.34, 0), "engineer", squad),
    ]
    for index, engineer in enumerate(engineers):
        for side_index, x in enumerate((-0.28, 0.28)):
            box(collection, f"engineer_pack_{index}_{side_index}", (0.3, 0.34, 0.82), (x, 0.36, 1.18), mats["bone"], engineer, 0.055)
            cylinder(collection, f"engineer_coil_{index}_{side_index}", 0.18, 0.44, (x, 0.42, 1.22), mats["steel"], engineer, 10, (math.pi / 2, 0, 0))
        box(collection, f"engineer_bridge_{index}", (0.62, 0.28, 0.2), (0, 0.38, 1.65), mats["armor"], engineer, 0.04)
    tool = empty(collection, "repair_tool_socket", (0.28, -1.18, 1.08), engineers[0])
    tool["socket_role"] = "repair_origin"
    box(collection, "repair_tool_body", (0.36, 1.12, 0.3), (0, -0.32, 0), mats["steel"], tool, 0.05)
    box(collection, "powered_repair_probe", (0.2, 0.48, 0.2), (0, -1.0, 0), mats["signal"], tool, 0.03)
    for side, x in enumerate((-0.25, 0.25)):
        box(collection, f"powered_repair_prong_{side}", (0.16, 0.46, 0.16), (x, -0.96, 0), mats["signal"], tool, 0.025)
    selection = empty(collection, "selection_anchor", (0, 0, 0.04), root)
    selection["socket_role"] = "selection_ground"
    glb_path, _ground, _camera = export_asset("ff_en_eng_01", collection, root, (0, 0, 0.95), (3.8, -5.4, 3.8), 4.0)
    print(f"FF_EN_ENG_01_GLB={glb_path}")


def build_enemy_building(kind: str) -> None:
    definitions = {
        "hq": ("ff_en_hq_01", "FF_EN_HQ_01", "enemy_command_headquarters", (0, 0, 3.2), (15, -17, 14), 18.0),
        "refinery": ("ff_en_ref_01", "FF_EN_REF_01", "enemy_resource_refinery", (0, 0, 2.4), (14, -15, 12), 15.0),
        "factory": ("ff_en_fac_01", "FF_EN_FAC_01", "enemy_vehicle_factory", (0, 0, 2.5), (14, -16, 12), 16.0),
        "reactor": ("ff_en_rct_01", "FF_EN_RCT_01", "enemy_reactor", (0, 0, 2.6), (10, -12, 9), 11.5),
        "barracks": ("ff_en_bar_01", "FF_EN_BAR_01", "enemy_barracks", (0, 0, 2.0), (11.5, -13.5, 10), 12.5),
        "relay": ("ff_en_rel_01", "FF_EN_REL_01", "enemy_network_relay", (0, 0, 3.1), (10.5, -12.5, 10.5), 12.0),
        "sentry": ("ff_en_sen_01", "FF_EN_SEN_01", "enemy_sentry", (0, 0, 1.9), (8.5, -10, 7.5), 9.5),
        "cannon": ("ff_en_can_01", "FF_EN_CAN_01", "enemy_heavy_cannon", (0, -0.8, 2.2), (11.5, -15, 10), 13.5),
    }
    asset_id, root_name, role, preview_target, camera_location, ortho_scale = definitions[kind]
    reset_scene()
    mats = make_enemy_materials()
    if kind in {"sentry", "relay", "cannon"}:
        tune_simple_material(mats["armor"], (0.18, 0.062, 0.052, 1), roughness=0.62)
        tune_simple_material(mats["armor_dark"], (0.072, 0.078, 0.08, 1), roughness=0.67)
        tune_simple_material(mats["steel"], (0.22, 0.235, 0.24, 1), roughness=0.39)
        tune_simple_material(mats["recess"], (0.024, 0.027, 0.028, 1), roughness=0.88)
        tune_simple_material(mats["bone"], (0.42, 0.37, 0.28, 1), roughness=0.72)
        tune_simple_material(
            mats["signal"],
            (0.48, 0.025, 0.014, 1),
            roughness=0.32,
            emission=(0.82, 0.028, 0.01, 1),
            emission_strength=3.0,
        )
    collection = bpy.data.collections.new(f"{root_name}_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, root_name)
    root["asset_id"] = asset_id
    root["asset_role"] = role
    root["provenance"] = "project_procedural_blender"
    root["asset_revision"] = "enemy-base-hero-v2" if kind in {"hq", "factory"} else "enemy-base-v1"
    root["render_profile"] = "strategic-camera-hero" if kind in {"hq", "factory"} else "strategic-camera-standard"
    if kind == "sentry":
        root["asset_revision"] = "enemy-sentry-gold-v2"
        root["render_profile"] = "strategic-camera-gold"
        root["visual_gold_revision"] = "desktop-enemy-sentry-gold-v2"
        root["silhouette_profile"] = "braced-twin-cannon-forward"
        root["weapon_forward_axis"] = "-Y"
        root["signal_projected_area_max_pct"] = 4
        root["runtime_primitive_budget"] = 10
        root["runtime_triangle_budget"] = 2200
        root["runtime_material_budget"] = 6
    elif kind == "cannon":
        root["asset_revision"] = "enemy-heavy-cannon-gold-v2"
        root["render_profile"] = "strategic-camera-gold"
        root["visual_gold_revision"] = "desktop-enemy-heavy-cannon-gold-v2"
        root["silhouette_profile"] = "low-braced-heavy-gunshield"
        root["readability_feature_scale_m"] = "0.40-1.40"
        root["weapon_forward_axis"] = "-Y"
        root["motion_domains"] = "turret_yaw,barrel_pitch"
        root["runtime_primitive_budget"] = 8
        root["runtime_triangle_budget"] = 1800
        root["runtime_material_budget"] = 6
    elif kind == "relay":
        root["asset_revision"] = "enemy-network-relay-gold-v2"
        root["render_profile"] = "strategic-camera-gold"
        root["visual_gold_revision"] = "desktop-enemy-relay-gold-v2"
        root["silhouette_profile"] = "tiered-dish-fork-array"
        root["readability_feature_scale_m"] = "0.40-1.40"
        root["communication_array"] = "dish,fork,mast"
        root["motion_domains"] = "radar_yaw"
        root["runtime_primitive_budget"] = 7
        root["runtime_triangle_budget"] = 1300
        root["runtime_material_budget"] = 6
    elif kind == "barracks":
        root["asset_revision"] = "enemy-barracks-gold-v2"
        root["render_profile"] = "strategic-camera-gold"
        root["visual_gold_revision"] = "desktop-enemy-barracks-gold-v2"
        root["silhouette_profile"] = "low-armored-barracks-deep-gate"
        root["readability_feature_scale_m"] = "0.40-1.40"
        root["entrance_depth_m"] = "2.20"
        root["communication_profile"] = "side-mast-service-array"
        root["healthy_runtime_primitive_budget"] = 8
        root["healthy_runtime_triangle_budget"] = 1800
        root["runtime_material_budget"] = 6
    elif kind == "reactor":
        root["asset_revision"] = "enemy-reactor-gold-v2"
        root["render_profile"] = "strategic-camera-gold"
        root["visual_gold_revision"] = "desktop-enemy-reactor-gold-v2"
        root["silhouette_profile"] = "tiered-core-constraint-ring"
        root["readability_feature_scale_m"] = "0.40-1.40"
        root["energy_core_profile"] = "shielded-column-signal-band"
        root["healthy_runtime_primitive_budget"] = 8
        root["healthy_runtime_triangle_budget"] = 2200
        root["runtime_material_budget"] = 6
    building = empty(collection, "building_root", parent=root)

    footprint = {
        "hq": (13.2, 11.2), "refinery": (11.4, 9.4), "factory": (12.5, 9.5),
        "reactor": (8.0, 8.0), "barracks": (8.8, 7.8), "relay": (6.7, 6.7),
        "sentry": (5.8, 5.8), "cannon": (7.8, 7.8),
    }[kind]
    if kind == "sentry":
        cylinder(collection, "foundation_shadow", 2.78, 0.34, (0, 0, 0.22), mats["recess"], building, 8, bevel=0.08)
        cylinder(collection, "foundation_service_step", 2.38, 0.26, (0, 0, 0.49), mats["armor_dark"], building, 8, bevel=0.055)
        for index, (x, y, angle) in enumerate(((-1.72, -1.6, -12), (1.72, -1.6, 12), (-1.55, 1.62, 8), (1.55, 1.62, -8))):
            box(
                collection,
                f"armored_foot_{index}",
                (0.9, 0.78, 0.22),
                (x, y, 0.69),
                mats["armor"] if index < 2 else mats["armor_dark"],
                building,
                0.045,
                (0, 0, math.radians(angle)),
            )
        for x in (-1.72, 1.72):
            box(collection, f"forward_iff_plate_{x:+.2f}", (0.62, 0.18, 0.1), (x, -1.99, 0.83), mats["bone"], building, 0.018)
    elif kind == "cannon":
        cylinder(collection, "cannon_foundation_shadow", 3.65, 0.34, (0, 0, 0.22), mats["recess"], building, 10, bevel=0.075)
        cylinder(collection, "cannon_foundation_step", 3.18, 0.3, (0, 0, 0.49), mats["armor_dark"], building, 10, bevel=0.055)
        cylinder(collection, "cannon_low_pedestal", 2.55, 1.32, (0, 0.18, 1.22), mats["armor_dark"], building, 10, bevel=0.09)
        cylinder(collection, "cannon_traverse_ring", 2.72, 0.24, (0, 0.05, 1.91), mats["armor_dark"], building, 12, bevel=0.035)
        for index, (x, y, angle) in enumerate(
            ((-2.55, -2.1, -8), (2.55, -2.1, 8), (-2.35, 2.05, 10), (2.35, 2.05, -10))
        ):
            box(
                collection,
                f"cannon_stabilizer_{index}",
                (1.5, 2.2, 0.3),
                (x, y, 0.69),
                mats["armor"],
                building,
                0,
                (0, 0, math.radians(angle)),
            )
        for x in (-2.55, 2.55):
            box(collection, f"cannon_forward_iff_{x:+.2f}", (0.76, 0.24, 0.12), (x, -3.08, 0.88), mats["bone"], building, 0.018)
    elif kind == "relay":
        cylinder(collection, "relay_foundation_shadow", 3.1, 0.32, (0, 0, 0.21), mats["recess"], building, 10, bevel=0.07)
        cylinder(collection, "relay_foundation_step", 2.72, 0.3, (0, 0, 0.47), mats["armor_dark"], building, 10, bevel=0.05)
        cylinder(collection, "relay_layered_bunker", 2.22, 1.4, (0, 0.12, 1.25), mats["armor_dark"], building, 10, bevel=0.085)
        cylinder(collection, "relay_service_collar", 2.38, 0.24, (0, 0.05, 2.02), mats["armor_dark"], building, 12, bevel=0.035)
        for index, (x, y, angle) in enumerate(((0, -2.45, 0), (0, 2.45, 0), (-2.45, 0, 90), (2.45, 0, 90))):
            box(
                collection,
                f"relay_anchor_pad_{index}",
                (1.35, 1.85, 0.32),
                (x, y, 0.68),
                mats["armor"],
                building,
                0,
                (0, 0, math.radians(angle)),
            )
        for x in (-1.45, 1.45):
            box(collection, f"relay_forward_iff_{x:+.2f}", (0.72, 0.24, 0.12), (x, -2.78, 0.88), mats["bone"], building, 0.018)
    elif kind == "barracks":
        box(collection, "barracks_foundation_shadow", (8.65, 7.55, 0.34), (0, 0, 0.22), mats["recess"], building, 0.1)
        tapered_box(collection, "barracks_foundation_step", (8.15, 7.05), (7.75, 6.65), 0.42, (0, 0.08, 0.55), mats["armor_dark"], building, 0.07)
        for x in (-3.15, 3.15):
            box(collection, f"barracks_forward_iff_{x:+.2f}", (1.05, 0.3, 0.12), (x, -3.23, 0.82), mats["armor"], building, 0.018)
    elif kind == "reactor":
        cylinder(collection, "reactor_foundation_shadow", 3.82, 0.34, (0, 0, 0.22), mats["recess"], building, 12, bevel=0.08)
        cylinder(collection, "reactor_foundation_step", 3.38, 0.32, (0, 0, 0.48), mats["armor_dark"], building, 12, bevel=0.055)
        cylinder(collection, "reactor_lower_plinth", 2.9, 0.58, (0, 0.05, 0.82), mats["armor_dark"], building, 12, bevel=0.07)
        for index, angle in enumerate((math.radians(-42), math.radians(42))):
            x, y = math.sin(angle) * 3.08, -math.cos(angle) * 3.08
            box(collection, f"reactor_forward_iff_{index}", (1.0, 0.28, 0.12), (x, y, 0.92), mats["armor"], building, 0.018, (0, 0, -angle))
    else:
        box(collection, "foundation", (footprint[0], footprint[1], 0.48), (0, 0, 0.3), mats["recess"], building, 0.14)
        box(collection, "foundation_crimson_trim", (footprint[0] - 0.5, footprint[1] - 0.5, 0.22), (0, 0, 0.62), mats["armor"], building, 0.05)
        for x, y in ((-footprint[0] * 0.39, -footprint[1] * 0.39), (footprint[0] * 0.39, -footprint[1] * 0.39), (-footprint[0] * 0.39, footprint[1] * 0.39), (footprint[0] * 0.39, footprint[1] * 0.39)):
            box(collection, f"bone_marker_{x:+.2f}_{y:+.2f}", (0.52, 0.52, 0.14), (x, y, 0.79), mats["bone"], building, 0.02)

    if kind == "hq":
        box(collection, "command_bunker", (8.8, 7.2, 3.15), (0, 0.3, 2.2), mats["armor_dark"], building, 0.22)
        box(collection, "command_brow", (9.3, 2.0, 0.62), (0, -3.05, 3.35), mats["armor"], building, 0.08, (math.radians(-7), 0, 0))
        box(collection, "command_gate", (3.8, 0.34, 2.5), (0, -3.48, 1.82), mats["recess"], building, 0.07)
        box(collection, "command_gate_lintel", (4.5, 0.42, 0.42), (0, -3.62, 3.2), mats["bone"], building, 0.045)
        box(collection, "command_access_ramp", (4.4, 2.7, 0.24), (0, -4.62, 0.64), mats["steel"], building, 0.045, (math.radians(-5), 0, 0))
        for x in (-1.55, 1.55):
            box(collection, f"powered_command_gate_{x:+.2f}", (0.28, 0.12, 0.5), (x, -3.67, 2.02), mats["signal"], building, 0.025)
        for x in (-4.85, 4.85):
            for y in (-3.85, 3.85):
                cylinder(collection, f"fortress_pylon_{x}_{y}", 1.12, 4.3, (x, y, 2.5), mats["armor_dark"], building, 10, bevel=0.08)
                box(collection, f"pylon_face_{x}_{y}", (1.0, 0.18, 1.7), (x, y - (1.12 if y < 0 else -1.12), 2.65), mats["armor"], building, 0.04)
                cylinder(collection, f"pylon_cap_{x}_{y}", 1.22, 0.24, (x, y, 4.7), mats["bone"], building, 10, bevel=0.035)
        box(collection, "command_tower", (4.2, 3.6, 2.2), (0, 0.5, 5.0), mats["armor"], building, 0.16)
        box(collection, "command_roof_plate", (3.7, 3.1, 0.18), (0, 0.5, 6.18), mats["armor_dark"], building, 0.045)
        for x in (-1.35, 0, 1.35):
            box(collection, f"tower_vent_{x:+.2f}", (0.72, 0.14, 0.38), (x, -1.34, 5.18), mats["recess"], building, 0.025)
        radar = empty(collection, "radar_yaw", (0, 0.5, 6.2), building)
        radar["spin_speed"] = 0.18
        cylinder(collection, "radar_mast", 0.18, 1.7, (0, 0, 0.85), mats["steel"], radar, 12)
        box(collection, "radar_cross", (3.4, 0.22, 0.26), (0, 0, 1.72), mats["bone"], radar, 0.04)
        torus(collection, "radar_target_ring", 1.05, 0.11, (0, 0, 1.72), mats["steel"], radar, (math.pi / 2, 0, 0))
        for x in (-1.45, 1.45):
            box(collection, f"powered_radar_eye_{x}", (0.28, 0.38, 0.3), (x, -0.16, 1.72), mats["signal"], radar, 0.03)
        spawn = empty(collection, "spawn_socket", (0, -7.2, 0), root)
        spawn["socket_role"] = "unit_spawn"
        rally = empty(collection, "rally_socket", (0, -9.0, 0), root)
        rally["socket_role"] = "default_rally"
    elif kind == "refinery":
        root["asset_revision"] = "refinery-unload-mechanism-v2"
        root["render_profile"] = "strategic-camera-standard"
        root["footprint_m"] = "11.4x9.4"
        root["unload_mechanism"] = "intake_gate,intake_conveyor,intake_collector"
        root["intake_gate_travel_m"] = 1.45
        root["conveyor_travel_m"] = 0.45
        root["collector_spin_axis"] = "X"
        root["runtime_primitive_budget"] = 13
        root["runtime_triangle_budget"] = 4000
        root["runtime_material_budget"] = 6
        box(collection, "processing_hall", (6.2, 5.5, 3.35), (-1.65, 0.55, 2.25), mats["armor_dark"], building, 0.18)
        for y in (-1.4, 0.55, 2.45):
            box(collection, f"hall_rib_{y}", (6.55, 0.2, 2.9), (-1.65, y, 2.25), mats["armor"], building, 0.04)
        silo = empty(collection, "storage_silo", parent=building)
        for x in (2.7, 4.25):
            cylinder(collection, f"silo_{x}", 1.05, 5.2, (x, 0.55, 2.9), mats["steel"], silo, 12, bevel=0.05)
            for z in (1.1, 2.7, 4.4):
                cylinder(collection, f"silo_band_{x}_{z}", 1.12, 0.16, (x, 0.55, z), mats["armor"], silo, 12)
        intake = empty(collection, "intake_bay", parent=building)
        box(collection, "intake_ramp", (5.0, 2.8, 0.28), (-1.45, -4.45, 0.58), mats["steel"], intake, 0.05, (math.radians(-6), 0, 0))
        for x in (-3.75, 0.85):
            box(collection, f"intake_side_rail_{x:+.2f}", (0.26, 2.82, 0.62), (x, -4.43, 0.88), mats["armor"], intake, 0.04, (math.radians(-6), 0, 0))
        box(collection, "intake_lintel", (5.15, 0.42, 0.5), (-1.45, -2.95, 2.35), mats["bone"], intake, 0.045)

        gate = empty(collection, "intake_gate", (-1.45, -2.95, 0), intake)
        gate["presentation_role"] = "deposit_gate"
        gate["motion_axis"] = "+Y"
        gate["travel_m"] = 1.45
        for x in (-1.78, -0.89, 0, 0.89, 1.78):
            box(collection, f"intake_gate_fang_{x:+.2f}", (0.34, 0.22, 1.62), (x, 0, 1.35), mats["bone"], gate, 0.028)
        box(collection, "intake_gate_backplate", (4.35, 0.14, 1.45), (0, 0.12, 1.35), mats["recess"], gate, 0.025)
        box(collection, "powered_intake_gate_band", (3.75, 0.11, 0.18), (0, -0.15, 1.34), mats["signal"], gate, 0.018)

        conveyor = empty(collection, "intake_conveyor", (-1.45, -4.45, 0), intake)
        conveyor["presentation_role"] = "deposit_conveyor"
        conveyor["motion_axis"] = "-Z"
        conveyor["travel_m"] = 0.45
        for index, y in enumerate((-1.35, -0.9, -0.45, 0, 0.45, 0.9, 1.35)):
            z = 0.75 + (y + 1.35) * 0.105
            box(collection, f"conveyor_slat_{index}", (4.15, 0.2, 0.13), (0, y, z), mats["armor"] if index % 3 == 0 else mats["steel"], conveyor, 0.02, (math.radians(-6), 0, 0))

        collector = empty(collection, "intake_collector", (-1.45, -3.2, 1.08), intake)
        collector["presentation_role"] = "deposit_collector"
        collector["spin_axis"] = "X"
        collector["spin_speed"] = 5.2
        cylinder(collection, "intake_collector_drum", 0.46, 4.0, (0, 0, 0), mats["steel"], collector, 14, (0, math.pi / 2, 0), 0.035)
        for index in range(8):
            angle = index * math.tau / 8
            for x in (-1.62, -0.82, 0, 0.82, 1.62):
                box(
                    collection,
                    f"intake_collector_tooth_{index}_{x:+.2f}",
                    (0.17, 0.42, 0.17),
                    (x, -math.sin(angle) * 0.5, math.cos(angle) * 0.5),
                    mats["bone"],
                    collector,
                    0.016,
                    (angle, 0, 0),
                )
        box(collection, "powered_refinery_eye", (2.0, 0.12, 0.25), (-1.45, -3.15, 2.25), mats["signal"], building, 0.03)
        deposit = empty(collection, "deposit_socket", (-1.45, -6.1, 0), root)
        deposit["socket_role"] = "harvester_deposit"
    elif kind == "factory":
        box(collection, "assembly_hall", (9.6, 6.8, 4.0), (0, 0.55, 2.5), mats["armor_dark"], building, 0.22)
        for x in (-4.2, -2.1, 0, 2.1, 4.2):
            box(collection, f"roof_spine_{x}", (0.22, 7.2, 0.32), (x, 0.55, 4.58), mats["armor"], building, 0.04)
        for panel_index, y in enumerate((-1.75, 0.35, 2.45)):
            box(collection, f"roof_service_plate_{panel_index}", (7.7, 1.5, 0.16), (0, y, 4.76), mats["armor"] if panel_index == 0 else mats["armor_dark"], building, 0.045)
        for x in (-4.65, 4.65):
            for y in (-1.75, 0.55, 2.85):
                box(collection, f"factory_buttress_{x:+.2f}_{y:+.2f}", (0.68, 0.72, 3.4), (x, y, 2.1), mats["armor"], building, 0.08, (0, 0, math.radians(-5 if x < 0 else 5)))
        box(collection, "factory_maw", (6.5, 0.38, 3.05), (0, -2.9, 2.1), mats["recess"], building, 0.07)
        door = empty(collection, "factory_door", (0, -2.9, 0), building)
        for x in (-2.65, -1.32, 0, 1.32, 2.65):
            box(collection, f"door_fang_{x}", (0.28, 0.18, 2.65), (x, -0.23, 2.1), mats["bone"], door, 0.03)
        box(collection, "factory_loading_ramp", (6.8, 3.1, 0.28), (0, -4.68, 0.62), mats["steel"], building, 0.055, (math.radians(-5), 0, 0))
        for x in (-2.65, 2.65):
            box(collection, f"powered_factory_gate_{x:+.2f}", (0.3, 0.12, 0.52), (x, -3.16, 2.2), mats["signal"], building, 0.025)
        for x in (-3.05, 3.05):
            cylinder(collection, f"factory_exhaust_{x:+.2f}", 0.38, 2.2, (x, 2.5, 5.72), mats["steel"], building, 12, bevel=0.04)
            cylinder(collection, f"factory_exhaust_cap_{x:+.2f}", 0.48, 0.18, (x, 2.5, 6.86), mats["recess"], building, 12, bevel=0.025)
        crane = empty(collection, "crane_yaw", (3.8, 2.45, 4.75), building)
        crane["spin_speed"] = 0.08
        cylinder(collection, "crane_post", 0.2, 2.4, (0, 0, 1.2), mats["steel"], crane, 12)
        box(collection, "crane_arm", (4.4, 0.28, 0.3), (-1.6, 0, 2.3), mats["armor"], crane, 0.05)
        box(collection, "powered_factory_eye", (2.2, 0.14, 0.28), (0, -3.18, 4.0), mats["signal"], building, 0.03)
        production = empty(collection, "production_socket", (0, -6.15, 0), root)
        production["socket_role"] = "vehicle_spawn"
        rally = empty(collection, "rally_socket", (0, -8.0, 0), root)
        rally["socket_role"] = "default_rally"
    elif kind == "reactor":
        reactor = empty(collection, "reactor_core", parent=building)
        cylinder(collection, "reactor_core_lower_collar", 2.48, 0.48, (0, 0.05, 1.18), mats["steel"], reactor, 12, bevel=0.06)
        cylinder(collection, "reactor_core_dark_shell", 1.92, 3.15, (0, 0.05, 2.75), mats["armor_dark"], reactor, 12, bevel=0.09)
        cylinder(collection, "reactor_core_recess", 1.46, 2.55, (0, -0.08, 2.82), mats["recess"], reactor, 12, bevel=0.045)
        cylinder(collection, "powered_core_signal_band", 1.62, 0.42, (0, -0.08, 2.92), mats["signal"], reactor, 12, bevel=0.035)
        cylinder(collection, "reactor_core_upper_collar", 2.18, 0.42, (0, 0.05, 4.3), mats["steel"], reactor, 12, bevel=0.055)
        cylinder(collection, "reactor_core_cap", 1.45, 0.44, (0, 0.05, 4.68), mats["bone"], reactor, 10, bevel=0.05)
        cylinder(collection, "powered_core_crown", 0.62, 0.16, (0, 0.05, 4.98), mats["signal"], reactor, 10, bevel=0.02)
        for index, angle in enumerate((0, math.tau / 3, math.tau * 2 / 3)):
            x, y = math.cos(angle) * 2.72, math.sin(angle) * 2.72
            tapered_box(collection, f"reactor_cooling_pier_{index}", (0.82, 1.55), (0.58, 1.12), 2.55, (x, y, 2.2), mats["armor_dark"], reactor, 0.07)
            box(collection, f"reactor_cooling_louver_{index}", (0.5, 0.16, 1.28), (x, y - 0.58, 2.18), mats["steel"], reactor, 0.025, (0, 0, angle))
        ring = empty(collection, "reactor_ring", (0, 0, 4.0), reactor)
        ring["spin_speed"] = 0.32
        torus(collection, "reactor_constraint_ring", 2.62, 0.2, (0, 0, 0), mats["steel"], ring, major_segments=16, minor_segments=5)
        for index, angle in enumerate((0, math.pi / 2, math.pi, math.pi * 1.5)):
            x, y = math.cos(angle) * 2.62, math.sin(angle) * 2.62
            box(collection, f"reactor_constraint_clamp_{index}", (0.82, 0.52, 0.5), (x, y, 0), mats["bone"], ring, 0.045, (0, 0, angle))
        for index, angle in enumerate((math.radians(-35), math.radians(35))):
            x, y = math.sin(angle) * 2.7, -math.cos(angle) * 2.7
            box(collection, f"reactor_faction_plate_{index}", (0.82, 0.18, 0.3), (x, y, 1.35), mats["armor"], reactor, 0.025, (0, 0, -angle))
        power = empty(collection, "power_socket", (0, 4.2, 0), root)
        power["socket_role"] = "power_connection"
    elif kind == "barracks":
        tapered_box(collection, "barracks_rear_hall", (6.9, 4.1), (6.2, 3.55), 2.35, (0, 0.9, 1.9), mats["armor_dark"], building, 0.14)
        for x in (-2.75, 2.75):
            tapered_box(collection, f"barracks_armored_wing_{x:+.2f}", (2.1, 4.85), (1.62, 4.15), 2.45, (x, -0.2, 1.92), mats["armor_dark"], building, 0.11)
            box(collection, f"barracks_wing_cap_{x:+.2f}", (1.68, 3.72, 0.22), (x, -0.08, 3.2), mats["steel"], building, 0.045)
            box(collection, f"barracks_faction_plate_{x:+.2f}", (1.15, 0.15, 0.3), (x, -2.65, 2.28), mats["armor"], building, 0.022)
        box(collection, "barracks_roof_spine", (5.45, 2.8, 0.34), (0, 1.18, 3.28), mats["steel"], building, 0.055)
        box(collection, "barracks_entry_floor", (2.65, 2.55, 0.18), (0, -2.3, 0.76), mats["recess"], building, 0.025, (math.radians(-4), 0, 0))
        for x in (-1.5, 1.5):
            box(collection, f"barracks_entry_jamb_{x:+.2f}", (0.42, 1.1, 2.4), (x, -2.88, 1.82), mats["steel"], building, 0.05)
        box(collection, "barracks_entry_lintel", (3.42, 1.05, 0.5), (0, -2.86, 3.0), mats["steel"], building, 0.055)
        box(collection, "barracks_entry_back", (2.62, 0.14, 2.0), (0, -1.35, 1.72), mats["recess"], building, 0.022)
        door = empty(collection, "barracks_door", (0, -2.42, 0), building)
        for x in (-0.66, 0.66):
            box(collection, f"barracks_slide_door_{x:+.2f}", (1.18, 0.16, 1.9), (x, 1.02, 1.7), mats["armor_dark"], door, 0.035)
        for x in (-1.22, 1.22):
            box(collection, f"barracks_door_rail_{x:+.2f}", (0.16, 0.2, 2.15), (x, 0.96, 1.72), mats["steel"], door, 0.022)
        for y in (0.35, 1.15, 1.95):
            box(collection, f"barracks_door_crossrail_{y:+.2f}", (2.35, 0.18, 0.12), (0, 0.94, y), mats["steel"], door, 0.015)
        box(collection, "barracks_entry_mark", (1.5, 0.12, 0.22), (0, -3.44, 3.05), mats["bone"], building, 0.018)
        for x in (-1.28, 1.28):
            box(collection, f"powered_barracks_light_{x:+.2f}", (0.18, 0.13, 0.42), (x, -3.45, 1.62), mats["signal"], building, 0.018)
        cylinder(collection, "barracks_service_tank", 0.48, 1.7, (3.42, 1.55, 1.55), mats["steel"], building, 10, bevel=0.035)
        cylinder(collection, "barracks_comm_mast", 0.13, 2.15, (-3.2, 1.52, 4.25), mats["steel"], building, 10, bevel=0.018)
        box(collection, "barracks_comm_crossbar", (1.75, 0.22, 0.22), (-3.2, 1.52, 5.0), mats["bone"], building, 0.025)
        for x in (-3.9, -2.5):
            box(collection, f"barracks_comm_tip_{x:+.2f}", (0.24, 0.3, 0.32), (x, 1.52, 5.0), mats["signal"], building, 0.025)
        spawn = empty(collection, "infantry_spawn", (0, -4.45, 0), root)
        spawn["socket_role"] = "infantry_spawn"
        rally = empty(collection, "rally_socket", (0, -6.0, 0), root)
        rally["socket_role"] = "default_rally"
    elif kind == "relay":
        radar = empty(collection, "radar_yaw", (0, 0, 2.35), building)
        radar["spin_speed"] = 0.22
        cylinder(collection, "relay_mast_collar", 0.68, 0.38, (0, 0, 0.24), mats["steel"], radar, 12, bevel=0.045)
        cylinder(collection, "relay_heavy_mast", 0.38, 3.55, (0, 0, 1.9), mats["steel"], radar, 12, bevel=0.035)
        for side, (x, lean) in enumerate(((-0.86, -24), (0.86, 24))):
            box(
                collection,
                f"relay_fork_arm_{side}",
                (0.36, 0.42, 2.65),
                (x, 0.02, 2.82),
                mats["steel"],
                radar,
                0.045,
                (0, math.radians(lean), 0),
            )
        dish = cylinder(
            collection,
            "relay_dish",
            1.28,
            0.18,
            (0, -0.12, 3.18),
            mats["bone"],
            radar,
            14,
            (math.radians(68), 0, 0),
            0.028,
        )
        dish.scale.y = 0.72
        torus(
            collection,
            "relay_dish_rim",
            1.18,
            0.09,
            (0, -0.12, 3.18),
            mats["steel"],
            radar,
            (math.radians(68), 0, 0),
            (1, 0.72, 1),
            12,
            4,
        )
        box(collection, "relay_array_crossbar", (2.85, 0.34, 0.3), (0, 0.02, 2.18), mats["bone"], radar, 0.045)
        box(collection, "relay_array_backplane", (2.2, 0.28, 0.62), (0, 0.12, 1.58), mats["bone"], radar, 0.05)
        cylinder(
            collection,
            "powered_relay_emitter",
            0.27,
            0.5,
            (0, -0.6, 3.55),
            mats["signal"],
            radar,
            10,
            (math.radians(68), 0, 0),
            0,
        )
        for x in (-1.36, 1.36):
            box(collection, f"powered_relay_tip_{x:+.2f}", (0.32, 0.34, 0.32), (x, 0, 3.86), mats["signal"], radar, 0.035)
        network = empty(collection, "network_socket", (0, 3.65, 0), root)
        network["socket_role"] = "bandwidth_connection"
    elif kind == "sentry":
        cylinder(collection, "armored_pedestal", 1.45, 1.48, (0, 0.12, 1.34), mats["armor_dark"], building, 10, bevel=0.08)
        cylinder(collection, "traverse_collar", 1.62, 0.28, (0, 0.05, 2.06), mats["steel"], building, 12, bevel=0.035)
        for x, lean in ((-1.45, -13), (1.45, 13)):
            box(
                collection,
                f"pedestal_brace_{x:+.2f}",
                (0.54, 1.05, 1.4),
                (x, 0.22, 1.18),
                mats["armor_dark"],
                building,
                0.065,
                (0, math.radians(lean), 0),
            )
        turret = empty(collection, "turret_yaw", (0, 0, 2.35), building)
        turret["socket_role"] = "weapon_yaw"
        tapered_box(
            collection,
            "turret_body",
            (2.65, 2.18),
            (2.18, 1.72),
            1.22,
            (0, 0.04, 0.74),
            mats["armor"],
            turret,
            0.13,
        )
        box(collection, "rear_counterweight", (1.72, 1.0, 0.7), (0, 0.7, 0.69), mats["armor_dark"], turret, 0.1)
        box(collection, "forward_mantlet", (1.78, 0.38, 0.72), (0, -1.08, 0.78), mats["steel"], turret, 0.065)
        box(collection, "dorsal_iff_plate", (1.18, 0.72, 0.12), (0, 0.1, 1.39), mats["bone"], turret, 0.025)
        for index, x in enumerate((-0.55, 0.55)):
            cylinder(collection, f"sentry_barrel_{index}", 0.15, 3.35, (x, -2.15, 0.78), mats["steel"], turret, 12, (math.pi / 2, 0, 0))
            cylinder(collection, f"barrel_jacket_{index}", 0.225, 0.72, (x, -1.42, 0.78), mats["armor_dark"], turret, 10, (math.pi / 2, 0, 0), 0.025)
            cylinder(collection, f"muzzle_iff_band_{index}", 0.205, 0.22, (x, -3.56, 0.78), mats["bone"], turret, 10, (math.pi / 2, 0, 0), 0.018)
            muzzle = empty(collection, f"muzzle_socket_{'left' if index == 0 else 'right'}", (x, -3.86, 0.78), turret)
            muzzle["socket_role"] = "projectile_origin"
        box(collection, "powered_targeting_eye", (0.76, 0.12, 0.16), (0, -1.28, 1.18), mats["signal"], turret, 0.025)
    elif kind == "cannon":
        turret = empty(collection, "turret_yaw", (0, 0, 2.65), building)
        turret["socket_role"] = "weapon_yaw"
        tapered_box(
            collection,
            "cannon_house",
            (4.3, 3.7),
            (3.45, 2.9),
            1.25,
            (0, 0.25, 0.15),
            mats["armor"],
            turret,
            0.14,
        )
        box(collection, "cannon_rear_counterweight", (3.0, 1.45, 0.82), (0, 1.44, 0.08), mats["armor"], turret, 0.11)
        box(collection, "cannon_gunshield", (3.65, 0.48, 1.45), (0, -1.58, 0.22), mats["armor"], turret, 0.095)
        for x, angle in ((-1.78, -9), (1.78, 9)):
            box(
                collection,
                f"cannon_shield_cheek_{x:+.2f}",
                (1.0, 0.72, 1.22),
                (x, -1.34, 0.18),
                mats["armor"],
                turret,
                0.085,
                (0, 0, math.radians(angle)),
            )
            cylinder(
                collection,
                f"cannon_recoil_housing_{x:+.2f}",
                0.31,
                1.12,
                (x * 0.7, 1.35, 0.04),
                mats["armor"],
                turret,
                10,
                (math.pi / 2, 0, 0),
                0.035,
            )
        box(collection, "cannon_shield_brow", (3.8, 0.6, 0.3), (0, -1.65, 0.92), mats["armor"], turret, 0.055)
        barrel = empty(collection, "barrel_pitch", (0, -0.95, 1.15), turret)
        barrel["socket_role"] = "weapon_pitch"
        barrel.rotation_euler.x = math.radians(7)
        box(collection, "cannon_breech_block", (1.36, 1.7, 1.04), (0, -0.35, 0), mats["steel"], barrel, 0.12)
        cylinder(collection, "cannon_barrel_jacket", 0.58, 2.0, (0, -1.55, 0), mats["steel"], barrel, 12, (math.pi / 2, 0, 0), 0.055)
        cylinder(collection, "cannon_heavy_barrel", 0.38, 5.5, (0, -4.25, 0), mats["steel"], barrel, 12, (math.pi / 2, 0, 0), 0.035)
        for x in (-0.72, 0.72):
            box(collection, f"cannon_recoil_rail_{x:+.2f}", (0.22, 2.35, 0.22), (x, -0.82, -0.38), mats["steel"], barrel, 0.035)
        cylinder(collection, "cannon_muzzle_brake", 0.6, 0.72, (0, -7.02, 0), mats["recess"], barrel, 10, (math.pi / 2, 0, 0), 0.04)
        for x in (-0.55, 0.55):
            box(collection, f"cannon_brake_lobe_{x:+.2f}", (0.5, 0.72, 0.76), (x, -7.02, 0), mats["recess"], barrel, 0.055)
        cylinder(collection, "cannon_muzzle_cap", 0.48, 0.18, (0, -7.34, 0), mats["steel"], barrel, 10, (math.pi / 2, 0, 0), 0.02)
        muzzle = empty(collection, "muzzle_socket", (0, -7.42, 0), barrel)
        muzzle["socket_role"] = "projectile_origin"
        box(collection, "powered_range_eye", (1.25, 0.14, 0.22), (0, -1.9, 0.88), mats["signal"], turret, 0.03)

    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    if kind != "sentry":
        damage_roof = empty(collection, "damage_socket_roof", (0, 0.5, 5.0 if kind in {"hq", "factory"} else 3.0), building)
        damage_roof["socket_role"] = "damage_emitter"
    if kind in {"hq", "factory", "barracks", "reactor"}:
        profile = f"enemy_{kind}"
        total_budgets = {
            "hq": (19, 7700),
            "factory": (19, 7100),
            "barracks": (18, 5800),
            "reactor": (18, 6200),
        }
        root["runtime_primitive_budget"], root["runtime_triangle_budget"] = total_budgets[kind]
        root["runtime_material_budget"] = 6
        build_building_damage_visuals(
            collection,
            building,
            mats,
            profile,
            enemy=True,
        )
        build_building_ruin_visual(
            collection,
            building,
            mats,
            profile,
            enemy=True,
        )
    glb_path, _ground, _camera = export_asset(asset_id, collection, root, preview_target, camera_location, ortho_scale)
    print(f"{root_name}_GLB={glb_path}")


def build_hq_gold() -> None:
    """Desktop visual-gold headquarters with a terraced command silhouette."""
    reset_scene()
    mats = make_materials()
    tune_gold_building_materials(mats)
    collection = bpy.data.collections.new("FF_HQ_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_HQ_01")
    root["asset_id"] = "ff_hq_01"
    root["asset_role"] = "command_headquarters"
    # Eight shared materials collapse to eight static primitives. The animated
    # radar domain legitimately reuses three of them as separate primitives,
    # so the runtime contract is eleven rather than an artificial ten.
    tag_gold_building(root, "terraced-command-citadel", "13.2x11.2", "3.10", 17)
    building = empty(collection, "building_root", parent=root)

    # Wide, low contact layer. Nothing here changes the authoritative footprint.
    box(collection, "foundation", (13.2, 11.2, 0.46), (0, 0, 0.28), mats["dark"], building, 0.15)
    box(collection, "foundation_trim", (12.72, 10.72, 0.22), (0, 0, 0.61), mats["gunmetal"], building, 0.055)
    for x, y in ((-5.55, -4.55), (5.55, -4.55), (-5.55, 4.55), (5.55, 4.55)):
        box(collection, f"foundation_marker_{x:+.2f}_{y:+.2f}", (0.82, 0.42, 0.12), (x, y, 0.78), mats["amber"], building, 0.018)

    # The lower mass is intentionally split around a true 3.1 m-deep entrance.
    box(collection, "rear_command_keep", (8.7, 4.25, 2.62), (0, 1.28, 1.96), mats["panel"], building, 0.18)
    for x in (-2.82, 2.82):
        tapered_box(collection, f"front_bunker_{x:+.2f}", (3.18, 3.86), (2.78, 3.46), 2.78, (x, -2.0, 2.02), mats["panel"], building, 0.13)
        box(collection, f"front_bunker_cap_{x:+.2f}", (2.86, 3.45, 0.22), (x, -1.88, 3.47), mats["gunmetal"], building, 0.05)
        box(collection, f"faction_plate_{x:+.2f}", (1.34, 0.14, 0.34), (x, -3.78, 2.48), mats["amber"], building, 0.025)
        # One-metre maintenance covers and seams survive the 44 m strategic camera.
        box(collection, f"front_service_panel_{x:+.2f}", (0.96, 0.1, 0.72), (x, -3.86, 1.53), mats["gunmetal"], building, 0.025)
        seam_x = x + (-0.82 if x < 0 else 0.82)
        box(collection, f"front_panel_seam_{x:+.2f}", (0.08, 0.09, 1.18), (seam_x, -3.84, 1.78), mats["gunmetal"], building, 0.01)
        scuff_x = x + (0.84 if x < 0 else -0.84)
        box(collection, f"entry_lower_scuff_{x:+.2f}", (0.62, 0.055, 0.38), (scuff_x, -3.91, 1.0), mats["dark"], building, 0, (0, math.radians(3 if x < 0 else -3), 0))
    for x in (-5.02, 5.02):
        tapered_box(collection, f"side_bastion_{x:+.2f}", (2.32, 5.72), (1.86, 5.08), 2.9, (x, 0.38, 2.03), mats["gunmetal"], building, 0.13)
        cylinder(collection, f"bastion_cap_{x:+.2f}", 0.72, 0.28, (x, 1.85, 3.57), mats["steel"], building, 14)
        cylinder(collection, f"bastion_signal_{x:+.2f}", 0.22, 0.24, (x, 1.85, 3.84), mats["cyan"], building, 12)
    box(collection, "right_bastion_service_hatch", (0.1, 1.08, 0.78), (6.1, 0.42, 2.08), mats["panel"], building, 0.025)
    box(collection, "right_bastion_hatch_latch", (0.08, 0.38, 0.14), (6.17, 0.12, 2.08), mats["amber"], building, 0.012)
    box(collection, "right_bastion_lower_scuff", (0.055, 0.72, 0.38), (6.13, -0.54, 1.0), mats["dark"], building, 0)

    # A battered upper shell and stepped communications tower break the old box silhouette.
    tapered_box(collection, "command_shell", (9.05, 6.72), (7.72, 5.52), 2.12, (0, 0.18, 3.87), mats["panel"], building, 0.16)
    box(collection, "command_shell_band", (8.08, 5.78, 0.28), (0, 0.18, 4.92), mats["gunmetal"], building, 0.06)
    for x in (-2.58, 0, 2.58):
        box(collection, f"command_service_reveal_{x:+.2f}", (1.08, 0.1, 0.34), (x, -2.88, 4.0), mats["dark"], building, 0.018)
    for x in (-2.5, 0, 2.5):
        box(collection, f"roof_spine_{x:+.2f}", (1.9, 4.65, 0.16), (x, 0.3, 5.14), mats["gunmetal"], building, 0.035)
    for index, x in enumerate((-1.28, 1.35)):
        box(collection, f"roof_inspection_plate_{index}", (1.12, 0.82, 0.08), (x, 0.38, 5.25), mats["dark"], building, 0.018)
    box(collection, "command_tower_lower", (5.45, 4.18, 1.18), (0.35, 0.7, 5.69), mats["gunmetal"], building, 0.12)
    tapered_box(collection, "command_tower_upper", (4.65, 3.58), (3.72, 2.78), 1.32, (0.35, 0.7, 6.86), mats["panel"], building, 0.12)
    box(collection, "command_tower_cap", (3.84, 2.9, 0.2), (0.35, 0.7, 7.56), mats["gunmetal"], building, 0.045)
    for x in (-0.92, 0.35, 1.62):
        box(collection, f"command_window_{x:+.2f}", (0.78, 0.12, 0.24), (x, -1.11, 6.92), mats["glass"], building, 0.02)

    # Recessed gate: side jambs and lintel sit at the facade, the door sits at the back wall.
    box(collection, "entry_tunnel_floor", (2.72, 3.22, 0.16), (0, -2.24, 0.78), mats["dark"], building, 0.025)
    for x in (-1.5, 1.5):
        box(collection, f"entry_jamb_{x:+.2f}", (0.42, 0.72, 2.56), (x, -3.64, 1.9), mats["gunmetal"], building, 0.055)
        box(collection, f"entry_worklight_{x:+.2f}", (0.16, 0.12, 0.42), (x + (-0.23 if x < 0 else 0.23), -4.02, 1.6), mats["worklight"], building, 0.015)
    box(collection, "entry_lintel", (3.52, 0.86, 0.54), (0, -3.56, 3.18), mats["gunmetal"], building, 0.065)
    box(collection, "entry_lintel_mark", (1.72, 0.1, 0.2), (0, -4.01, 3.23), mats["amber"], building, 0.018)
    box(collection, "entry_inner_door", (2.44, 0.12, 1.72), (0, -0.69, 1.57), mats["dark"], building, 0.025)
    box(collection, "entry_inner_glass", (1.82, 0.08, 0.58), (0, -0.76, 1.72), mats["glass"], building, 0.015)
    entry_ramp = box(collection, "entry_ramp", (3.36, 2.2, 0.24), (0, -4.92, 0.55), mats["steel"], building, 0.035, (math.radians(-5), 0, 0))
    entry_ramp.rotation_euler.x = math.radians(-5)
    for x in (-1.32, 1.32):
        box(collection, f"entry_ramp_edge_{x:+.2f}", (0.16, 2.16, 0.12), (x, -4.91, 0.72), mats["amber"], building, 0.018, (math.radians(-5), 0, 0))

    radar = empty(collection, "radar_yaw", (0.35, 0.7, 7.55), building)
    radar["spin_speed"] = 0.22
    cylinder(collection, "radar_pedestal", 0.62, 0.3, (0, 0, 0.16), mats["gunmetal"], radar, 16)
    cylinder(collection, "radar_mast", 0.16, 1.35, (0, 0, 0.92), mats["steel"], radar, 12)
    dish = cylinder(collection, "radar_dish", 1.48, 0.16, (0, 0, 1.72), mats["gunmetal"], radar, 24, (math.radians(66), 0, 0), 0.035)
    dish.scale.y = 0.7
    torus(collection, "radar_dish_rim", 1.35, 0.075, (0, 0, 1.72), mats["steel"], radar, (math.radians(66), 0, 0), (1, 0.7, 1))
    cylinder(collection, "radar_emitter", 0.18, 0.55, (0, -0.42, 2.18), mats["cyan"], radar, 12, (math.radians(66), 0, 0))
    for x in (-1.4, 2.05):
        cylinder(collection, f"fixed_antenna_{x:+.2f}", 0.055, 2.15, (x, 1.1, 8.18), mats["steel"], building, 8, bevel=0.012)
        cylinder(collection, f"antenna_tip_{x:+.2f}", 0.09, 0.18, (x, 1.1, 9.29), mats["worklight"], building, 8, bevel=0.01)

    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "building_ground"
    spawn = empty(collection, "spawn_socket", (0, -7.2, 0), root)
    spawn["socket_role"] = "unit_spawn"
    rally = empty(collection, "rally_socket", (0, -9.0, 0), root)
    rally["socket_role"] = "default_rally"
    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    build_building_damage_visuals(collection, building, mats, "player_hq")
    build_building_ruin_visual(collection, building, mats, "player_hq")
    glb_path, _ground, _camera = export_asset("ff_hq_01", collection, root, (0, 0, 3.75), (15, -17, 14), 18.0)
    print(f"FF_HQ_01_GLB={glb_path}")


def build_factory_gold() -> None:
    """Desktop visual-gold factory with a deep bay and continuous vehicle ramp."""
    reset_scene()
    mats = make_materials()
    tune_gold_building_materials(mats)
    collection = bpy.data.collections.new("FF_FAC_01_ASSET")
    bpy.context.scene.collection.children.link(collection)
    root = empty(collection, "FF_FAC_01")
    root["asset_id"] = "ff_fac_01"
    root["asset_role"] = "vehicle_factory"
    tag_gold_building(root, "deep-bay-offset-gantry", "12.5x9.5", "3.00", 17)
    building = empty(collection, "building_root", parent=root)

    box(collection, "foundation", (12.5, 9.5, 0.46), (0, 0, 0.28), mats["dark"], building, 0.15)
    box(collection, "foundation_trim", (12.02, 9.02, 0.22), (0, 0, 0.61), mats["gunmetal"], building, 0.055)
    for x in (-5.25, 5.25):
        box(collection, f"foundation_faction_mark_{x:+.2f}", (0.64, 0.38, 0.12), (x, -3.92, 0.78), mats["amber"], building, 0.018)

    # Rear assembly volume and battered roof establish an industrial sawtooth profile.
    box(collection, "assembly_core", (9.45, 4.34, 3.7), (0, 1.43, 2.48), mats["panel"], building, 0.18)
    box(collection, "assembly_right_service_hatch", (0.1, 1.08, 0.76), (4.79, 0.46, 2.72), mats["gunmetal"], building, 0.025)
    box(collection, "assembly_right_hatch_latch", (0.08, 0.38, 0.14), (4.86, 0.15, 2.72), mats["amber"], building, 0.012)
    tapered_box(collection, "assembly_roof_shell", (9.72, 4.56), (8.7, 3.62), 1.35, (0, 1.43, 4.86), mats["gunmetal"], building, 0.12)
    for x in (-2.55, 0, 2.55):
        box(collection, f"roof_shell_service_reveal_{x:+.2f}", (1.08, 0.1, 0.34), (x, -0.61, 5.0), mats["dark"], building, 0.018)
    box(collection, "assembly_roof_deck", (8.58, 3.5, 0.18), (0, 1.43, 5.57), mats["steel"], building, 0.035)
    for x in (-3.45, -1.15, 1.15, 3.45):
        box(collection, f"roof_truss_{x:+.2f}", (0.18, 3.76, 0.24), (x, 1.43, 5.72), mats["gunmetal"], building, 0.022)
    for index, x in enumerate((-2.3, 2.3)):
        box(collection, f"roof_inspection_plate_{index}", (1.04, 0.76, 0.08), (x, 1.43, 5.69), mats["dark"], building, 0.018)

    # Separate front piers leave actual empty space between the facade and workshop wall.
    for x in (-3.75, 3.75):
        tapered_box(collection, f"bay_pier_{x:+.2f}", (2.24, 4.56), (1.82, 3.94), 3.82, (x, -1.42, 2.56), mats["panel"], building, 0.13)
        box(collection, f"bay_pier_cap_{x:+.2f}", (1.9, 3.95, 0.22), (x, -1.32, 4.5), mats["gunmetal"], building, 0.05)
        box(collection, f"bay_pier_mark_{x:+.2f}", (0.28, 1.22, 0.5), (x + (-1.05 if x < 0 else 1.05), -2.7, 2.35), mats["amber"], building, 0.025)
        box(collection, f"bay_pier_service_panel_{x:+.2f}", (1.0, 0.1, 0.74), (x, -3.61, 1.62), mats["gunmetal"], building, 0.025)
        seam_x = x + (-0.7 if x < 0 else 0.7)
        box(collection, f"bay_pier_panel_seam_{x:+.2f}", (0.08, 0.09, 1.16), (seam_x, -3.59, 1.84), mats["gunmetal"], building, 0.01)
        inner_scuff_x = x + (0.76 if x < 0 else -0.76)
        box(collection, f"bay_entry_lower_scuff_{x:+.2f}", (0.62, 0.055, 0.38), (inner_scuff_x, -3.64, 1.02), mats["dark"], building, 0, (0, math.radians(4 if x < 0 else -4), 0))
    for x in (-5.16, 5.16):
        tapered_box(collection, f"service_buttress_{x:+.2f}", (1.45, 5.55), (1.12, 4.92), 2.7, (x, 0.28, 1.92), mats["gunmetal"], building, 0.1)

    # The internal deck, back wall and lights remain visible when the authoritative door opens.
    box(collection, "production_bay_floor", (5.42, 4.24, 0.18), (0, -1.27, 0.78), mats["steel"], building, 0.025)
    for x in (-2.22, 0, 2.22):
        box(collection, f"bay_floor_rail_{x:+.2f}", (0.11, 4.05, 0.08), (x, -1.2, 0.9), mats["amber" if x == 0 else "gunmetal"], building, 0.012)
    box(collection, "production_bay_back", (5.25, 0.14, 2.92), (0, -0.69, 2.22), mats["dark"], building, 0.025)
    for x in (-1.72, 1.72):
        box(collection, f"bay_back_worklight_{x:+.2f}", (0.3, 0.1, 0.44), (x, -0.79, 2.92), mats["worklight"], building, 0.015)
    box(collection, "bay_overhead_beam", (5.92, 0.72, 0.64), (0, -3.37, 4.34), mats["gunmetal"], building, 0.07)
    box(collection, "bay_overhead_faction", (4.1, 0.1, 0.22), (0, -3.75, 4.4), mats["amber"], building, 0.018)

    door = empty(collection, "factory_door", (0, 0, 0), building)
    door["presentation_role"] = "production_gate"
    for index, x in enumerate((-2.12, -1.06, 0, 1.06, 2.12)):
        box(collection, f"door_panel_{index}", (0.86, 0.14, 2.9), (x, -3.75, 2.2), mats["gunmetal"], door, 0.025)
    box(collection, "powered_door_signal", (4.32, 0.1, 0.18), (0, -3.84, 3.78), mats["cyan"], door, 0.015)

    production_ramp = box(collection, "production_ramp", (6.08, 3.18, 0.26), (0, -5.18, 0.52), mats["steel"], building, 0.04, (math.radians(-5), 0, 0))
    production_ramp.rotation_euler.x = math.radians(-5)
    for x in (-2.78, 2.78):
        box(collection, f"ramp_guard_{x:+.2f}", (0.2, 3.12, 0.16), (x, -5.17, 0.7), mats["gunmetal"], building, 0.02, (math.radians(-5), 0, 0))
        for y in (-5.95, -5.15, -4.35):
            box(collection, f"ramp_warning_{x:+.2f}_{y:+.2f}", (0.28, 0.38, 0.1), (x, y, 0.83), mats["amber"], building, 0.012, (math.radians(-5), 0, 0))

    # Fixed outer gantry plus an independently rotating boom preserves the crane socket contract.
    tapered_box(collection, "crane_column", (1.05, 1.05), (0.76, 0.76), 4.76, (5.05, 2.38, 3.18), mats["gunmetal"], building, 0.07)
    box(collection, "crane_column_base", (1.5, 1.5, 0.32), (5.05, 2.38, 0.84), mats["steel"], building, 0.05)
    crane = empty(collection, "crane_yaw", (5.05, 2.38, 5.56), building)
    crane["spin_speed"] = 0.08
    cylinder(collection, "crane_pivot", 0.5, 0.38, (0, 0, 0.18), mats["steel"], crane, 16)
    box(collection, "crane_boom", (6.5, 0.4, 0.48), (-2.3, 0, 0.62), mats["gunmetal"], crane, 0.045)
    box(collection, "crane_boom_mark", (1.72, 0.44, 0.12), (-1.68, -0.02, 0.93), mats["amber"], crane, 0.015)
    box(collection, "crane_counterweight", (1.02, 0.92, 0.76), (1.14, 0, 0.58), mats["gunmetal"], crane, 0.065)

    for x in (-3.6, -2.65):
        cylinder(collection, f"exhaust_stack_{x:+.2f}", 0.22, 1.75, (x, 2.35, 6.3), mats["steel"], building, 12)
        cylinder(collection, f"exhaust_cap_{x:+.2f}", 0.3, 0.2, (x, 2.35, 7.22), mats["amber"], building, 12)
    for x in (-1.05, 0.35, 1.75):
        cylinder(collection, f"roof_vent_{x:+.2f}", 0.34, 0.2, (x, 1.55, 5.82), mats["gunmetal"], building, 12)

    ground = empty(collection, "ground_anchor", (0, 0, 0.02), root)
    ground["socket_role"] = "building_ground"
    production = empty(collection, "production_socket", (0, -6.7, 0), root)
    production["socket_role"] = "vehicle_spawn"
    rally = empty(collection, "rally_socket", (0, -8.4, 0), root)
    rally["socket_role"] = "default_rally"
    selection = empty(collection, "selection_anchor", (0, 0, 0.05), root)
    selection["socket_role"] = "selection_ground"
    build_building_damage_visuals(collection, building, mats, "player_factory")
    build_building_ruin_visual(collection, building, mats, "player_factory")
    glb_path, _ground, _camera = export_asset("ff_fac_01", collection, root, (0, -0.2, 3.0), (15, -17, 13), 17.0)
    print(f"FF_FAC_01_GLB={glb_path}")


def build_enemy_hq() -> None: build_enemy_building("hq")
def build_enemy_refinery() -> None: build_enemy_building("refinery")
def build_enemy_factory() -> None: build_enemy_building("factory")
def build_enemy_reactor() -> None: build_enemy_building("reactor")
def build_enemy_barracks() -> None: build_enemy_building("barracks")
def build_enemy_relay() -> None: build_enemy_building("relay")
def build_enemy_sentry() -> None: build_enemy_building("sentry")
def build_enemy_cannon() -> None: build_enemy_building("cannon")


BUILDERS = {
    "ff_hrv_01": build_harvester,
    "ff_hq_01": build_hq_gold,
    "ff_ref_01": build_refinery,
    "ff_fac_01": build_factory_gold,
    "ff_rct_01": build_reactor,
    "ff_bar_01": build_barracks,
    "ff_rel_01": build_relay,
    "ff_sen_01": build_sentry,
    "ff_can_01": build_cannon,
    "ff_rif_01": build_rifle_squad,
    "ff_eng_01": build_engineer_squad,
    "ff_at_01": build_antitank_squad,
    "ff_sct_01": build_scout_vehicle,
    "ff_sup_01": build_suppressor_vehicle,
    "ff_art_01": build_artillery_vehicle,
    "ff_rok_01": build_rock_cluster,
    "ff_wrk_01": build_armored_wreck,
    "ff_ore_01": build_resource_field,
    "ff_crt_01": build_crater_cluster,
    "ff_rdm_01": build_road_marker,
    "ff_sbg_01": build_sandbag_emplacement,
    "ff_cch_01": build_supply_cache,
    "ff_aux_01": build_auxiliary_generator,
    "ff_scr_01": build_dry_scrub_cluster,
    "ff_stm_01": build_dead_stump,
    "ff_en_mbt_01": build_enemy_tank,
    "ff_en_rif_01": build_enemy_rifle_squad,
    "ff_en_at_01": build_enemy_antitank_squad,
    "ff_en_sct_01": build_enemy_scout_vehicle,
    "ff_en_sup_01": build_enemy_suppressor_vehicle,
    "ff_en_art_01": build_enemy_artillery_vehicle,
    "ff_en_hrv_01": build_enemy_harvester,
    "ff_en_eng_01": build_enemy_engineer_squad,
    "ff_en_hq_01": build_enemy_hq,
    "ff_en_ref_01": build_enemy_refinery,
    "ff_en_fac_01": build_enemy_factory,
    "ff_en_rct_01": build_enemy_reactor,
    "ff_en_bar_01": build_enemy_barracks,
    "ff_en_rel_01": build_enemy_relay,
    "ff_en_sen_01": build_enemy_sentry,
    "ff_en_can_01": build_enemy_cannon,
}

separator = sys.argv.index("--") if "--" in sys.argv else -1
requested = [argument for argument in sys.argv[separator + 1:] if not argument.startswith("--")] if separator >= 0 else []
targets = requested or list(BUILDERS)
unknown = [asset_id for asset_id in targets if asset_id not in BUILDERS]
if unknown:
    raise ValueError(f"Unknown asset ids: {', '.join(unknown)}")
for asset_id in targets:
    BUILDERS[asset_id]()
