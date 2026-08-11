from __future__ import annotations

import json
import math
import struct
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR_ARGUMENT = next((argument for argument in sys.argv[1:] if not argument.startswith("--")), None)
MODEL_DIR = Path(MODEL_DIR_ARGUMENT).resolve() if MODEL_DIR_ARGUMENT else PROJECT_ROOT / "public" / "assets" / "models"
REQUIRE_KTX2 = "--require-ktx2" in sys.argv[1:]
CONTRACTS = {
    "ff_mbt_01": {"FF_MBT_01", "chassis_root", "turret_yaw", "barrel_pitch", "muzzle_socket", "selection_anchor", "damage_socket_engine", "damage_socket_turret", "wreck_anchor", "wreck_visual_root", "wreck_chassis", "wreck_turret", "wreck_track_debris"},
    "ff_hrv_01": {"FF_HRV_01", "chassis_root", "collector_head", "cargo_bed", "cargo_slot_0", "cargo_slot_1", "cargo_slot_2", "resource_socket", "selection_anchor", "wreck_visual_root", "wreck_chassis", "wreck_collector", "wreck_cargo_debris"},
    "ff_hq_01": {"FF_HQ_01", "building_root", "ground_anchor", "radar_yaw", "spawn_socket", "rally_socket", "selection_anchor", "damage_visual_damaged", "damage_damaged_breach", "damage_damaged_bent_armor", "damage_damaged_debris", "damage_visual_critical", "damage_critical_collapse", "damage_critical_bent_armor", "damage_critical_debris", "ruin_visual_root", "ruin_foundation", "ruin_collapsed_structure", "ruin_broken_machinery", "ruin_faction_debris", "ruin_marker_anchor"},
    "ff_ref_01": {"FF_REF_01", "building_root", "intake_bay", "intake_gate", "intake_conveyor", "intake_collector", "storage_silo", "deposit_socket", "selection_anchor"},
    "ff_fac_01": {"FF_FAC_01", "building_root", "ground_anchor", "factory_door", "crane_yaw", "production_socket", "rally_socket", "selection_anchor", "damage_visual_damaged", "damage_damaged_breach", "damage_damaged_bent_armor", "damage_damaged_debris", "damage_visual_critical", "damage_critical_collapse", "damage_critical_bent_armor", "damage_critical_debris", "ruin_visual_root", "ruin_foundation", "ruin_collapsed_structure", "ruin_broken_machinery", "ruin_faction_debris", "ruin_marker_anchor"},
    "ff_rct_01": {"FF_RCT_01", "building_root", "reactor_core", "powered_reactor_core", "reactor_ring", "powered_reactor_ring_signal", "power_socket", "selection_anchor", "damage_visual_damaged", "damage_damaged_breach", "damage_damaged_bent_armor", "damage_damaged_debris", "damage_visual_critical", "damage_critical_collapse", "damage_critical_bent_armor", "damage_critical_debris", "ruin_visual_root", "ruin_foundation", "ruin_collapsed_structure", "ruin_broken_machinery", "ruin_faction_debris", "ruin_marker_anchor"},
    "ff_bar_01": {"FF_BAR_01", "building_root", "barracks_door", "powered_barracks_signal", "infantry_spawn", "rally_socket", "selection_anchor", "damage_visual_damaged", "damage_damaged_breach", "damage_damaged_bent_armor", "damage_damaged_debris", "damage_visual_critical", "damage_critical_collapse", "damage_critical_bent_armor", "damage_critical_debris", "ruin_visual_root", "ruin_foundation", "ruin_collapsed_structure", "ruin_broken_machinery", "ruin_faction_debris", "ruin_marker_anchor"},
    "ff_rel_01": {"FF_REL_01", "building_root", "radar_yaw", "network_socket", "selection_anchor"},
    "ff_sen_01": {"FF_SEN_01", "building_root", "turret_yaw", "muzzle_socket_left", "muzzle_socket_right", "selection_anchor"},
    "ff_can_01": {"FF_CAN_01", "building_root", "turret_yaw", "barrel_pitch", "muzzle_socket", "selection_anchor"},
    "ff_rif_01": {"FF_RIF_01", "squad_root", "soldier_lead", "soldier_left", "soldier_right", "muzzle_socket", "selection_anchor"},
    "ff_eng_01": {"FF_ENG_01", "squad_root", "engineer_lead", "engineer_left", "engineer_right", "repair_tool_socket", "selection_anchor"},
    "ff_at_01": {"FF_AT_01", "squad_root", "launcher_lead", "launcher_pitch", "muzzle_socket", "selection_anchor"},
    "ff_sct_01": {"FF_SCT_01", "chassis_root", "turret_yaw", "radar_yaw", "muzzle_socket", "selection_anchor", "powered_scout_radar"},
    "ff_sup_01": {"FF_SUP_01", "chassis_root", "turret_yaw", "muzzle_socket_left", "muzzle_socket_right", "selection_anchor", "powered_suppressor_targeting"},
    "ff_art_01": {"FF_ART_01", "chassis_root", "turret_yaw", "barrel_pitch", "muzzle_socket", "selection_anchor", "powered_artillery_rangefinder"},
    "ff_rok_01": {"FF_ROK_01", "rock_cluster_root", "collision_proxy", "ground_anchor"},
    "ff_wrk_01": {"FF_WRK_01", "wreck_root", "broken_turret", "broken_barrel", "ground_anchor"},
    "ff_ore_01": {"FF_ORE_01", "resource_field_root", "harvest_socket", "ground_anchor"},
    "ff_crt_01": {"FF_CRT_01", "crater_cluster_root", "ground_anchor"},
    "ff_rdm_01": {"FF_RDM_01", "road_marker_root", "ground_anchor"},
    "ff_sbg_01": {"FF_SBG_01", "sandbag_root", "ground_anchor"},
    "ff_cch_01": {"FF_CCH_01", "cache_root", "supply_socket", "ground_anchor"},
    "ff_aux_01": {"FF_AUX_01", "generator_root", "service_socket", "ground_anchor"},
    "ff_scr_01": {"FF_SCR_01", "scrub_root", "ground_anchor"},
    "ff_stm_01": {"FF_STM_01", "stump_root", "ground_anchor"},
    "ff_en_mbt_01": {"FF_EN_MBT_01", "chassis_root", "turret_yaw", "barrel_pitch", "muzzle_socket", "selection_anchor", "damage_socket_engine", "damage_socket_turret", "wreck_anchor", "wreck_visual_root", "wreck_chassis", "wreck_turret", "wreck_track_debris"},
    "ff_en_rif_01": {"FF_EN_RIF_01", "squad_root", "soldier_lead", "soldier_left", "soldier_right", "muzzle_socket", "selection_anchor"},
    "ff_en_at_01": {"FF_EN_AT_01", "squad_root", "launcher_lead", "launcher_pitch", "muzzle_socket", "selection_anchor"},
    "ff_en_sct_01": {"FF_EN_SCT_01", "chassis_root", "turret_yaw", "radar_yaw", "muzzle_socket", "selection_anchor"},
    "ff_en_sup_01": {"FF_EN_SUP_01", "chassis_root", "turret_yaw", "muzzle_socket_left", "muzzle_socket_right", "selection_anchor"},
    "ff_en_art_01": {"FF_EN_ART_01", "chassis_root", "turret_yaw", "barrel_pitch", "muzzle_socket", "selection_anchor"},
    "ff_en_hrv_01": {"FF_EN_HRV_01", "chassis_root", "collector_head", "cargo_bed", "cargo_slot_0", "cargo_slot_1", "cargo_slot_2", "resource_socket", "selection_anchor", "damage_socket_engine", "wreck_anchor", "wreck_visual_root", "wreck_chassis", "wreck_collector", "wreck_cargo_debris"},
    "ff_en_eng_01": {"FF_EN_ENG_01", "squad_root", "engineer_lead", "engineer_left", "engineer_right", "repair_tool_socket", "selection_anchor"},
    "ff_en_hq_01": {"FF_EN_HQ_01", "building_root", "radar_yaw", "spawn_socket", "rally_socket", "selection_anchor", "damage_socket_roof", "damage_visual_damaged", "damage_damaged_breach", "damage_damaged_bent_armor", "damage_damaged_debris", "damage_visual_critical", "damage_critical_collapse", "damage_critical_bent_armor", "damage_critical_debris", "ruin_visual_root", "ruin_foundation", "ruin_collapsed_structure", "ruin_broken_machinery", "ruin_faction_debris", "ruin_marker_anchor"},
    "ff_en_ref_01": {"FF_EN_REF_01", "building_root", "intake_bay", "intake_gate", "intake_conveyor", "intake_collector", "storage_silo", "deposit_socket", "selection_anchor"},
    "ff_en_fac_01": {"FF_EN_FAC_01", "building_root", "factory_door", "crane_yaw", "production_socket", "rally_socket", "selection_anchor", "damage_socket_roof", "damage_visual_damaged", "damage_damaged_breach", "damage_damaged_bent_armor", "damage_damaged_debris", "damage_visual_critical", "damage_critical_collapse", "damage_critical_bent_armor", "damage_critical_debris", "ruin_visual_root", "ruin_foundation", "ruin_collapsed_structure", "ruin_broken_machinery", "ruin_faction_debris", "ruin_marker_anchor"},
    "ff_en_rct_01": {"FF_EN_RCT_01", "building_root", "reactor_core", "reactor_ring", "power_socket", "selection_anchor", "damage_socket_roof", "damage_visual_damaged", "damage_damaged_breach", "damage_damaged_bent_armor", "damage_damaged_debris", "damage_visual_critical", "damage_critical_collapse", "damage_critical_bent_armor", "damage_critical_debris", "ruin_visual_root", "ruin_foundation", "ruin_collapsed_structure", "ruin_broken_machinery", "ruin_faction_debris", "ruin_marker_anchor"},
    "ff_en_bar_01": {"FF_EN_BAR_01", "building_root", "barracks_door", "infantry_spawn", "rally_socket", "selection_anchor", "damage_socket_roof", "damage_visual_damaged", "damage_damaged_breach", "damage_damaged_bent_armor", "damage_damaged_debris", "damage_visual_critical", "damage_critical_collapse", "damage_critical_bent_armor", "damage_critical_debris", "ruin_visual_root", "ruin_foundation", "ruin_collapsed_structure", "ruin_broken_machinery", "ruin_faction_debris", "ruin_marker_anchor"},
    "ff_en_rel_01": {"FF_EN_REL_01", "building_root", "radar_yaw", "network_socket", "selection_anchor", "damage_socket_roof"},
    "ff_en_sen_01": {"FF_EN_SEN_01", "building_root", "turret_yaw", "muzzle_socket_left", "muzzle_socket_right", "selection_anchor"},
    "ff_en_can_01": {"FF_EN_CAN_01", "building_root", "turret_yaw", "barrel_pitch", "muzzle_socket", "selection_anchor", "damage_socket_roof"},
}
VEHICLE_WRECK_CONTRACTS = {
    "ff_mbt_01": {
        "root": "FF_MBT_01",
        "profile": "battle_tank",
        "parts": {"wreck_chassis", "wreck_turret", "wreck_track_debris"},
        "material_count": 8,
        "texture_count": 18,
    },
    "ff_hrv_01": {
        "root": "FF_HRV_01",
        "profile": "resource_harvester",
        "parts": {"wreck_chassis", "wreck_collector", "wreck_cargo_debris"},
        "material_count": 9,
        "texture_count": 18,
    },
    "ff_en_mbt_01": {
        "root": "FF_EN_MBT_01",
        "profile": "battle_tank",
        "parts": {"wreck_chassis", "wreck_turret", "wreck_track_debris"},
        "material_count": 7,
        "texture_count": 16,
    },
    "ff_en_hrv_01": {
        "root": "FF_EN_HRV_01",
        "profile": "resource_harvester",
        "parts": {"wreck_chassis", "wreck_collector", "wreck_cargo_debris"},
        "material_count": 8,
        "texture_count": 0,
    },
}
BUILDING_DAMAGE_CONTRACTS = {
    "ff_hq_01": {
        "root": "FF_HQ_01",
        "profile": "player_hq",
        "material_count": 8,
        "texture_count": 15,
        "total_primitive_budget": 21,
        "total_triangle_budget": 9100,
        "preserved_nodes": {
            "building_root": ("FF_HQ_01", (0.0, 0.0, 0.0), {}),
            "ground_anchor": ("FF_HQ_01", (0.0, 0.02, 0.0), {"socket_role": "building_ground"}),
            "radar_yaw": ("building_root", (0.35, 7.55, -0.7), {"spin_speed": 0.22}),
            "spawn_socket": ("FF_HQ_01", (0.0, 0.0, 7.2), {"socket_role": "unit_spawn"}),
            "rally_socket": ("FF_HQ_01", (0.0, 0.0, 9.0), {"socket_role": "default_rally"}),
            "selection_anchor": ("FF_HQ_01", (0.0, 0.05, 0.0), {"socket_role": "selection_ground"}),
        },
    },
    "ff_fac_01": {
        "root": "FF_FAC_01",
        "profile": "player_factory",
        "material_count": 7,
        "texture_count": 15,
        "total_primitive_budget": 21,
        "total_triangle_budget": 8700,
        "preserved_nodes": {
            "building_root": ("FF_FAC_01", (0.0, 0.0, 0.0), {}),
            "ground_anchor": ("FF_FAC_01", (0.0, 0.02, 0.0), {"socket_role": "building_ground"}),
            "factory_door": ("building_root", (0.0, 0.0, 0.0), {"presentation_role": "production_gate"}),
            "crane_yaw": ("building_root", (5.05, 5.56, -2.38), {"spin_speed": 0.08}),
            "production_socket": ("FF_FAC_01", (0.0, 0.0, 6.7), {"socket_role": "vehicle_spawn"}),
            "rally_socket": ("FF_FAC_01", (0.0, 0.0, 8.4), {"socket_role": "default_rally"}),
            "selection_anchor": ("FF_FAC_01", (0.0, 0.05, 0.0), {"socket_role": "selection_ground"}),
        },
    },
    "ff_bar_01": {
        "root": "FF_BAR_01",
        "profile": "player_barracks",
        "material_count": 7,
        "texture_count": 15,
        "total_primitive_budget": 19,
        "total_triangle_budget": 6300,
        "preserved_nodes": {
            "building_root": ("FF_BAR_01", (0.0, 0.0, 0.0), {}),
            "barracks_door": ("building_root", (0.0, 0.0, 0.0), {}),
            "infantry_spawn": ("FF_BAR_01", (0.0, 0.0, 4.45), {"socket_role": "infantry_spawn"}),
            "rally_socket": ("FF_BAR_01", (0.0, 0.0, 6.0), {"socket_role": "default_rally"}),
            "selection_anchor": ("FF_BAR_01", (0.0, 0.05, 0.0), {"socket_role": "selection_ground"}),
        },
    },
    "ff_rct_01": {
        "root": "FF_RCT_01",
        "profile": "player_reactor",
        "material_count": 7,
        "texture_count": 15,
        "total_primitive_budget": 18,
        "total_triangle_budget": 6700,
        "preserved_nodes": {
            "building_root": ("FF_RCT_01", (0.0, 0.0, 0.0), {}),
            "reactor_core": ("building_root", (0.0, 1.65, 0.0), {}),
            "reactor_ring": ("building_root", (0.0, 0.0, 0.0), {"spin_speed": 0.32}),
            "power_socket": ("FF_RCT_01", (0.0, 0.0, -4.2), {"socket_role": "grid_connection"}),
            "selection_anchor": ("FF_RCT_01", (0.0, 0.05, 0.0), {"socket_role": "selection_ground"}),
        },
    },
    "ff_en_hq_01": {
        "root": "FF_EN_HQ_01",
        "profile": "enemy_hq",
        "material_count": 6,
        "texture_count": 0,
        "total_primitive_budget": 19,
        "total_triangle_budget": 7700,
        "preserved_nodes": {
            "building_root": ("FF_EN_HQ_01", (0.0, 0.0, 0.0), {}),
            "radar_yaw": ("building_root", (0.0, 6.2, -0.5), {"spin_speed": 0.18}),
            "spawn_socket": ("FF_EN_HQ_01", (0.0, 0.0, 7.2), {"socket_role": "unit_spawn"}),
            "rally_socket": ("FF_EN_HQ_01", (0.0, 0.0, 9.0), {"socket_role": "default_rally"}),
            "selection_anchor": ("FF_EN_HQ_01", (0.0, 0.05, 0.0), {"socket_role": "selection_ground"}),
            "damage_socket_roof": ("building_root", (0.0, 5.0, -0.5), {"socket_role": "damage_emitter"}),
        },
    },
    "ff_en_fac_01": {
        "root": "FF_EN_FAC_01",
        "profile": "enemy_factory",
        "material_count": 6,
        "texture_count": 0,
        "total_primitive_budget": 19,
        "total_triangle_budget": 7100,
        "preserved_nodes": {
            "building_root": ("FF_EN_FAC_01", (0.0, 0.0, 0.0), {}),
            "factory_door": ("building_root", (0.0, 0.0, 2.9), {}),
            "crane_yaw": ("building_root", (3.8, 4.75, -2.45), {"spin_speed": 0.08}),
            "production_socket": ("FF_EN_FAC_01", (0.0, 0.0, 6.15), {"socket_role": "vehicle_spawn"}),
            "rally_socket": ("FF_EN_FAC_01", (0.0, 0.0, 8.0), {"socket_role": "default_rally"}),
            "selection_anchor": ("FF_EN_FAC_01", (0.0, 0.05, 0.0), {"socket_role": "selection_ground"}),
            "damage_socket_roof": ("building_root", (0.0, 5.0, -0.5), {"socket_role": "damage_emitter"}),
        },
    },
    "ff_en_bar_01": {
        "root": "FF_EN_BAR_01",
        "profile": "enemy_barracks",
        "material_count": 6,
        "texture_count": 0,
        "total_primitive_budget": 18,
        "total_triangle_budget": 5800,
        "preserved_nodes": {
            "building_root": ("FF_EN_BAR_01", (0.0, 0.0, 0.0), {}),
            "barracks_door": ("building_root", (0.0, 0.0, 2.42), {}),
            "infantry_spawn": ("FF_EN_BAR_01", (0.0, 0.0, 4.45), {"socket_role": "infantry_spawn"}),
            "rally_socket": ("FF_EN_BAR_01", (0.0, 0.0, 6.0), {"socket_role": "default_rally"}),
            "selection_anchor": ("FF_EN_BAR_01", (0.0, 0.05, 0.0), {"socket_role": "selection_ground"}),
            "damage_socket_roof": ("building_root", (0.0, 3.0, -0.5), {"socket_role": "damage_emitter"}),
        },
    },
    "ff_en_rct_01": {
        "root": "FF_EN_RCT_01",
        "profile": "enemy_reactor",
        "material_count": 6,
        "texture_count": 0,
        "total_primitive_budget": 18,
        "total_triangle_budget": 6200,
        "preserved_nodes": {
            "building_root": ("FF_EN_RCT_01", (0.0, 0.0, 0.0), {}),
            "reactor_core": ("building_root", (0.0, 0.0, 0.0), {}),
            "reactor_ring": ("reactor_core", (0.0, 4.0, 0.0), {"spin_speed": 0.32}),
            "power_socket": ("FF_EN_RCT_01", (0.0, 0.0, -4.2), {"socket_role": "power_connection"}),
            "selection_anchor": ("FF_EN_RCT_01", (0.0, 0.05, 0.0), {"socket_role": "selection_ground"}),
            "damage_socket_roof": ("building_root", (0.0, 3.0, -0.5), {"socket_role": "damage_emitter"}),
        },
    },
}
BUILDING_RUIN_CONTRACTS = {
    "ff_hq_01": {
        "root": "FF_HQ_01",
        "profile": "player_hq",
        "material_count": 8,
        "texture_count": 15,
        "total_primitive_budget": 21,
        "total_triangle_budget": 9100,
    },
    "ff_fac_01": {
        "root": "FF_FAC_01",
        "profile": "player_factory",
        "material_count": 7,
        "texture_count": 15,
        "total_primitive_budget": 21,
        "total_triangle_budget": 8700,
    },
    "ff_bar_01": {
        "root": "FF_BAR_01",
        "profile": "player_barracks",
        "material_count": 7,
        "texture_count": 15,
        "total_primitive_budget": 19,
        "total_triangle_budget": 6300,
    },
    "ff_rct_01": {
        "root": "FF_RCT_01",
        "profile": "player_reactor",
        "material_count": 7,
        "texture_count": 15,
        "total_primitive_budget": 18,
        "total_triangle_budget": 6700,
    },
    "ff_en_hq_01": {
        "root": "FF_EN_HQ_01",
        "profile": "enemy_hq",
        "material_count": 6,
        "texture_count": 0,
        "total_primitive_budget": 19,
        "total_triangle_budget": 7700,
    },
    "ff_en_fac_01": {
        "root": "FF_EN_FAC_01",
        "profile": "enemy_factory",
        "material_count": 6,
        "texture_count": 0,
        "total_primitive_budget": 19,
        "total_triangle_budget": 7100,
    },
    "ff_en_bar_01": {
        "root": "FF_EN_BAR_01",
        "profile": "enemy_barracks",
        "material_count": 6,
        "texture_count": 0,
        "total_primitive_budget": 18,
        "total_triangle_budget": 5800,
    },
    "ff_en_rct_01": {
        "root": "FF_EN_RCT_01",
        "profile": "enemy_reactor",
        "material_count": 6,
        "texture_count": 0,
        "total_primitive_budget": 18,
        "total_triangle_budget": 6200,
    },
}
ENEMY_STRATEGIC_BUILDING_MATERIALS = {
    "M_EnemyCrimsonArmor",
    "M_EnemyObsidianArmor",
    "M_EnemyGunmetal",
    "M_EnemyRecess",
    "M_EnemyMarking",
    "M_EnemySignal",
}
ENEMY_STRATEGIC_BUILDING_CONTRACTS = {
    "ff_en_can_01": {
        "root": "FF_EN_CAN_01",
        "primitive_budget": 8,
        "triangle_budget": 1800,
        "root_extras": {
            "asset_id": "ff_en_can_01",
            "asset_role": "enemy_heavy_cannon",
            "provenance": "project_procedural_blender",
            "asset_revision": "enemy-heavy-cannon-gold-v2",
            "render_profile": "strategic-camera-gold",
            "visual_gold_revision": "desktop-enemy-heavy-cannon-gold-v2",
            "silhouette_profile": "low-braced-heavy-gunshield",
            "readability_feature_scale_m": "0.40-1.40",
            "weapon_forward_axis": "-Y",
            "motion_domains": "turret_yaw,barrel_pitch",
            "runtime_primitive_budget": 8,
            "runtime_triangle_budget": 1800,
            "runtime_material_budget": 6,
        },
        "nodes": {
            "building_root": {
                "parent": "FF_EN_CAN_01",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "turret_yaw": {
                "parent": "building_root",
                "translation": (0.0, 2.65, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "weapon_yaw"},
            },
            "barrel_pitch": {
                "parent": "turret_yaw",
                "translation": (0.0, 1.15, 0.95),
                "rotation": (0.06104855, 0.0, 0.0, 0.99813491),
                "extras": {"socket_role": "weapon_pitch"},
            },
            "muzzle_socket": {
                "parent": "barrel_pitch",
                "translation": (0.0, 0.0, 7.42),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "projectile_origin"},
            },
            "selection_anchor": {
                "parent": "FF_EN_CAN_01",
                "translation": (0.0, 0.05, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "selection_ground"},
            },
            "damage_socket_roof": {
                "parent": "building_root",
                "translation": (0.0, 3.0, -0.5),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "damage_emitter"},
            },
        },
        "motion_domains": {
            "FF_EN_CAN_01": {
                "M_EnemyCrimsonArmor",
                "M_EnemyMarking",
                "M_EnemyObsidianArmor",
                "M_EnemyRecess",
            },
            "turret_yaw": {"M_EnemyCrimsonArmor", "M_EnemySignal"},
            "barrel_pitch": {"M_EnemyGunmetal", "M_EnemyRecess"},
        },
    },
    "ff_en_bar_01": {
        "root": "FF_EN_BAR_01",
        "primitive_budget": 18,
        "triangle_budget": 5800,
        "healthy_primitive_budget": 8,
        "healthy_triangle_budget": 1800,
        "root_extras": {
            "asset_id": "ff_en_bar_01",
            "asset_role": "enemy_barracks",
            "provenance": "project_procedural_blender",
            "asset_revision": "enemy-barracks-gold-v2",
            "render_profile": "strategic-camera-gold",
            "visual_gold_revision": "desktop-enemy-barracks-gold-v2",
            "silhouette_profile": "low-armored-barracks-deep-gate",
            "readability_feature_scale_m": "0.40-1.40",
            "entrance_depth_m": "2.20",
            "communication_profile": "side-mast-service-array",
            "healthy_runtime_primitive_budget": 8,
            "healthy_runtime_triangle_budget": 1800,
            "runtime_primitive_budget": 18,
            "runtime_triangle_budget": 5800,
            "runtime_material_budget": 6,
        },
        "nodes": {
            "building_root": {
                "parent": "FF_EN_BAR_01",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "barracks_door": {
                "parent": "building_root",
                "translation": (0.0, 0.0, 2.42),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "infantry_spawn": {
                "parent": "FF_EN_BAR_01",
                "translation": (0.0, 0.0, 4.45),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "infantry_spawn"},
            },
            "rally_socket": {
                "parent": "FF_EN_BAR_01",
                "translation": (0.0, 0.0, 6.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "default_rally"},
            },
            "selection_anchor": {
                "parent": "FF_EN_BAR_01",
                "translation": (0.0, 0.05, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "selection_ground"},
            },
            "damage_socket_roof": {
                "parent": "building_root",
                "translation": (0.0, 3.0, -0.5),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "damage_emitter"},
            },
        },
        "motion_domains": {
            "FF_EN_BAR_01": ENEMY_STRATEGIC_BUILDING_MATERIALS,
            "barracks_door": {"M_EnemyObsidianArmor", "M_EnemyGunmetal"},
        },
    },
    "ff_en_rct_01": {
        "root": "FF_EN_RCT_01",
        "primitive_budget": 18,
        "triangle_budget": 6200,
        "healthy_primitive_budget": 8,
        "healthy_triangle_budget": 2200,
        "root_extras": {
            "asset_id": "ff_en_rct_01",
            "asset_role": "enemy_reactor",
            "provenance": "project_procedural_blender",
            "asset_revision": "enemy-reactor-gold-v2",
            "render_profile": "strategic-camera-gold",
            "visual_gold_revision": "desktop-enemy-reactor-gold-v2",
            "silhouette_profile": "tiered-core-constraint-ring",
            "readability_feature_scale_m": "0.40-1.40",
            "energy_core_profile": "shielded-column-signal-band",
            "healthy_runtime_primitive_budget": 8,
            "healthy_runtime_triangle_budget": 2200,
            "runtime_primitive_budget": 18,
            "runtime_triangle_budget": 6200,
            "runtime_material_budget": 6,
        },
        "nodes": {
            "building_root": {
                "parent": "FF_EN_RCT_01",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "reactor_core": {
                "parent": "building_root",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "reactor_ring": {
                "parent": "reactor_core",
                "translation": (0.0, 4.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"spin_speed": 0.32},
            },
            "power_socket": {
                "parent": "FF_EN_RCT_01",
                "translation": (0.0, 0.0, -4.2),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "power_connection"},
            },
            "selection_anchor": {
                "parent": "FF_EN_RCT_01",
                "translation": (0.0, 0.05, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "selection_ground"},
            },
            "damage_socket_roof": {
                "parent": "building_root",
                "translation": (0.0, 3.0, -0.5),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "damage_emitter"},
            },
        },
        "motion_domains": {
            "FF_EN_RCT_01": ENEMY_STRATEGIC_BUILDING_MATERIALS,
            "reactor_ring": {"M_EnemyGunmetal", "M_EnemyMarking"},
        },
    },
    "ff_en_rel_01": {
        "root": "FF_EN_REL_01",
        "primitive_budget": 7,
        "triangle_budget": 1300,
        "root_extras": {
            "asset_id": "ff_en_rel_01",
            "asset_role": "enemy_network_relay",
            "provenance": "project_procedural_blender",
            "asset_revision": "enemy-network-relay-gold-v2",
            "render_profile": "strategic-camera-gold",
            "visual_gold_revision": "desktop-enemy-relay-gold-v2",
            "silhouette_profile": "tiered-dish-fork-array",
            "readability_feature_scale_m": "0.40-1.40",
            "communication_array": "dish,fork,mast",
            "motion_domains": "radar_yaw",
            "runtime_primitive_budget": 7,
            "runtime_triangle_budget": 1300,
            "runtime_material_budget": 6,
        },
        "nodes": {
            "building_root": {
                "parent": "FF_EN_REL_01",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "radar_yaw": {
                "parent": "building_root",
                "translation": (0.0, 2.35, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"spin_speed": 0.22},
            },
            "network_socket": {
                "parent": "FF_EN_REL_01",
                "translation": (0.0, 0.0, -3.65),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "bandwidth_connection"},
            },
            "selection_anchor": {
                "parent": "FF_EN_REL_01",
                "translation": (0.0, 0.05, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "selection_ground"},
            },
            "damage_socket_roof": {
                "parent": "building_root",
                "translation": (0.0, 3.0, -0.5),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "damage_emitter"},
            },
        },
        "motion_domains": {
            "FF_EN_REL_01": {
                "M_EnemyCrimsonArmor",
                "M_EnemyMarking",
                "M_EnemyObsidianArmor",
                "M_EnemyRecess",
            },
            "radar_yaw": {
                "M_EnemyGunmetal",
                "M_EnemyMarking",
                "M_EnemySignal",
            },
        },
    },
}
PLAYER_INFRASTRUCTURE_CONTRACTS = {
    "ff_bar_01": {
        "root": "FF_BAR_01",
        "primitive_budget": 19,
        "triangle_budget": 6300,
        "healthy_primitive_budget": 9,
        "healthy_triangle_budget": 2200,
        "texture_count": 15,
        "materials": {
            "M_AmberArmor",
            "M_ArmorPanel",
            "M_CyanGlass",
            "M_CyanSignal",
            "M_Gunmetal",
            "M_Recess",
            "M_Steel",
        },
        "root_extras": {
            "asset_id": "ff_bar_01",
            "asset_role": "infantry_barracks",
            "provenance": "project_procedural_blender",
            "asset_revision": "player-barracks-gold-v1",
            "render_profile": "strategic-camera-gold",
            "visual_gold_revision": "desktop-player-barracks-gold-v1",
            "silhouette_profile": "low-layered-training-hall-deep-entry-asymmetric-wings",
            "readability_feature_scale_m": "0.40-1.40",
            "footprint_m": "8.7x7.7",
            "entrance_depth_m": "2.20",
            "spawn_forward_axis": "+Z",
            "door_motion_axis": "+Y",
            "door_travel_m": 1.75,
            "healthy_runtime_primitive_budget": 9,
            "healthy_runtime_triangle_budget": 2200,
            "runtime_primitive_budget": 19,
            "runtime_triangle_budget": 6300,
            "runtime_material_budget": 7,
        },
        "nodes": {
            "building_root": {
                "parent": "FF_BAR_01",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "barracks_door": {
                "parent": "building_root",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "powered_barracks_signal": {
                "parent": "barracks_door",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "infantry_spawn": {
                "parent": "FF_BAR_01",
                "translation": (0.0, 0.0, 4.45),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "infantry_spawn"},
            },
            "rally_socket": {
                "parent": "FF_BAR_01",
                "translation": (0.0, 0.0, 6.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "default_rally"},
            },
            "selection_anchor": {
                "parent": "FF_BAR_01",
                "translation": (0.0, 0.05, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "selection_ground"},
            },
        },
        "motion_domains": {
            "FF_BAR_01": {
                "M_AmberArmor",
                "M_ArmorPanel",
                "M_CyanGlass",
                "M_CyanSignal",
                "M_Recess",
                "M_Steel",
            },
            "barracks_door": {"M_Gunmetal"},
            "powered_barracks_signal": {"M_CyanSignal"},
        },
    },
    "ff_rct_01": {
        "root": "FF_RCT_01",
        "primitive_budget": 18,
        "triangle_budget": 6700,
        "healthy_primitive_budget": 8,
        "healthy_triangle_budget": 2600,
        "texture_count": 15,
        "materials": {
            "M_AmberArmor",
            "M_ArmorPanel",
            "M_CyanSignal",
            "M_Gunmetal",
            "M_Huijing",
            "M_Recess",
            "M_Steel",
        },
        "root_extras": {
            "asset_id": "ff_rct_01",
            "asset_role": "power_reactor",
            "provenance": "project_procedural_blender",
            "asset_revision": "player-reactor-gold-v1",
            "render_profile": "strategic-camera-gold",
            "visual_gold_revision": "desktop-player-reactor-gold-v1",
            "silhouette_profile": "dark-stepped-base-vertical-energy-core-gapped-ring",
            "readability_feature_scale_m": "0.40-1.40",
            "footprint_m": "7.5x7.5",
            "energy_core_profile": "vertical-m_huijing-column",
            "constraint_ring_profile": "single-open-arc",
            "healthy_runtime_primitive_budget": 8,
            "healthy_runtime_triangle_budget": 2600,
            "runtime_primitive_budget": 18,
            "runtime_triangle_budget": 6700,
            "runtime_material_budget": 7,
        },
        "nodes": {
            "building_root": {
                "parent": "FF_RCT_01",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "reactor_core": {
                "parent": "building_root",
                "translation": (0.0, 1.65, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "powered_reactor_core": {
                "parent": "reactor_core",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "reactor_ring": {
                "parent": "building_root",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"spin_speed": 0.32},
            },
            "powered_reactor_ring_signal": {
                "parent": "reactor_ring",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "power_socket": {
                "parent": "FF_RCT_01",
                "translation": (0.0, 0.0, -4.2),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "grid_connection"},
            },
            "selection_anchor": {
                "parent": "FF_RCT_01",
                "translation": (0.0, 0.05, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "selection_ground"},
            },
        },
        "motion_domains": {
            "FF_RCT_01": {"M_AmberArmor", "M_Gunmetal", "M_Recess", "M_Steel"},
            "reactor_core": {"M_ArmorPanel"},
            "powered_reactor_core": {"M_Huijing"},
            "reactor_ring": {"M_Steel"},
            "powered_reactor_ring_signal": {"M_CyanSignal"},
        },
    },
}
ENEMY_SUPPORT_WEAPON_MATERIALS = {
    "M_EnemyCrimsonArmor",
    "M_EnemyGunmetal",
    "M_EnemyObsidianArmor",
    "M_EnemyRecess",
    "M_EnemySignal",
    "M_EnemyMarking",
    "M_EnemyTrack",
}
ENEMY_SUPPORT_WEAPON_CONTRACTS = {
    "ff_en_sup_01": {
        "root": "FF_EN_SUP_01",
        "root_extras": {
            "asset_id": "ff_en_sup_01",
            "asset_role": "enemy_chaincannon_vehicle",
            "provenance": "project_procedural_blender",
        },
        "nodes": {
            "chassis_root": {
                "parent": "FF_EN_SUP_01",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "turret_yaw": {
                "parent": "chassis_root",
                "translation": (0.0, 1.54, 0.2),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "weapon_yaw"},
            },
            "muzzle_socket_left": {
                "parent": "turret_yaw",
                "translation": (-0.42, 0.57, 2.78),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "projectile_origin"},
            },
            "muzzle_socket_right": {
                "parent": "turret_yaw",
                "translation": (0.42, 0.57, 2.78),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "projectile_origin"},
            },
            "selection_anchor": {
                "parent": "FF_EN_SUP_01",
                "translation": (0.0, 0.04, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "selection_ground"},
            },
        },
        "node_count": 17,
        "primitive_count": 11,
        "triangle_count": 2268,
        "material_count": 7,
        "texture_count": 0,
    },
    "ff_en_art_01": {
        "root": "FF_EN_ART_01",
        "root_extras": {
            "asset_id": "ff_en_art_01",
            "asset_role": "enemy_long_range_artillery",
            "provenance": "project_procedural_blender",
        },
        "nodes": {
            "chassis_root": {
                "parent": "FF_EN_ART_01",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "turret_yaw": {
                "parent": "chassis_root",
                "translation": (0.0, 1.5, 0.34),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "weapon_yaw"},
            },
            "barrel_pitch": {
                "parent": "turret_yaw",
                "translation": (0.0, 0.92, 0.75),
                "rotation": (0.11320322, 0.0, 0.0, 0.99357194),
                "extras": {"socket_role": "weapon_pitch"},
            },
            "muzzle_socket": {
                "parent": "barrel_pitch",
                "translation": (0.0, 0.0, 5.38),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "projectile_origin"},
            },
            "selection_anchor": {
                "parent": "FF_EN_ART_01",
                "translation": (0.0, 0.04, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "selection_ground"},
            },
        },
        "node_count": 17,
        "primitive_count": 11,
        "triangle_count": 1736,
        "material_count": 7,
        "texture_count": 0,
    },
}
PLAYER_SUPPORT_VEHICLE_MATERIALS = {
    "M_ArmorPanel",
    "M_Gunmetal",
    "M_Recess",
    "M_TrackRubber",
    "M_Steel",
    "M_AmberArmor",
    "M_CyanSignal",
}
PLAYER_SUPPORT_VEHICLE_CONTRACTS = {
    "ff_art_01": {
        "root": "FF_ART_01",
        "root_extras": {
            "asset_id": "ff_art_01",
            "asset_role": "long_arc_artillery",
            "provenance": "project_procedural_blender",
            "asset_revision": "player-artillery-gold-v1",
            "render_profile": "strategic-camera-gold",
            "visual_gold_revision": "desktop-player-artillery-gold-v1",
            "silhouette_profile": "tracked-rear-magazine-long-braked-gun",
            "weapon_forward_axis": "+Z",
            "runtime_primitive_budget": 12,
            "runtime_triangle_budget": 2600,
            "runtime_material_budget": 7,
            "runtime_texture_budget": 0,
        },
        "nodes": {
            "chassis_root": {
                "parent": "FF_ART_01",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "turret_yaw": {
                "parent": "chassis_root",
                "translation": (0.0, 1.58, 0.25),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "weapon_yaw"},
            },
            "barrel_pitch": {
                "parent": "turret_yaw",
                "translation": (0.0, 0.92, 0.72),
                "rotation": (0.10452849, 0.0, 0.0, 0.99452198),
                "extras": {"socket_role": "weapon_pitch"},
            },
            "muzzle_socket": {
                "parent": "barrel_pitch",
                "translation": (0.0, 0.0, 5.3),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "projectile_origin"},
            },
            "selection_anchor": {
                "parent": "FF_ART_01",
                "translation": (0.0, 0.04, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "selection_ground"},
            },
            "powered_artillery_rangefinder": {
                "parent": "turret_yaw",
                "translation": (0.68, 1.22, 0.08),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"presentation_role": "powered_signal"},
            },
        },
        "motion_domains": {
            "FF_ART_01": {"M_AmberArmor", "M_ArmorPanel", "M_Gunmetal", "M_Recess", "M_Steel", "M_TrackRubber"},
            "turret_yaw": {"M_ArmorPanel", "M_Gunmetal", "M_Steel"},
            "barrel_pitch": {"M_Recess", "M_Steel"},
            "powered_artillery_rangefinder": {"M_CyanSignal"},
        },
        "node_count": 19,
        "primitive_count": 12,
        "triangle_count": 2172,
        "primitive_budget": 12,
        "triangle_budget": 2600,
        "byte_budget": 320_000,
    },
    "ff_sup_01": {
        "root": "FF_SUP_01",
        "root_extras": {
            "asset_id": "ff_sup_01",
            "asset_role": "chaincannon_suppressor",
            "provenance": "project_procedural_blender",
            "asset_revision": "player-suppressor-gold-v1",
            "render_profile": "strategic-camera-gold",
            "visual_gold_revision": "desktop-player-suppressor-gold-v1",
            "silhouette_profile": "wide-six-wheel-parallel-chaincannon",
            "weapon_forward_axis": "+Z",
            "runtime_primitive_budget": 12,
            "runtime_triangle_budget": 2600,
            "runtime_material_budget": 7,
            "runtime_texture_budget": 0,
        },
        "nodes": {
            "chassis_root": {
                "parent": "FF_SUP_01",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "turret_yaw": {
                "parent": "chassis_root",
                "translation": (0.0, 1.66, 0.18),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "weapon_yaw"},
            },
            "muzzle_socket_left": {
                "parent": "turret_yaw",
                "translation": (-0.38, 0.65, 2.98),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "projectile_origin"},
            },
            "muzzle_socket_right": {
                "parent": "turret_yaw",
                "translation": (0.38, 0.65, 2.98),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "projectile_origin"},
            },
            "selection_anchor": {
                "parent": "FF_SUP_01",
                "translation": (0.0, 0.04, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "selection_ground"},
            },
            "powered_suppressor_targeting": {
                "parent": "turret_yaw",
                "translation": (0.0, 1.0, 0.78),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"presentation_role": "powered_signal"},
            },
        },
        "motion_domains": {
            "FF_SUP_01": {"M_AmberArmor", "M_ArmorPanel", "M_Gunmetal", "M_Recess", "M_Steel", "M_TrackRubber"},
            "turret_yaw": {"M_ArmorPanel", "M_Gunmetal", "M_Recess", "M_Steel"},
            "powered_suppressor_targeting": {"M_CyanSignal"},
        },
        "node_count": 18,
        "primitive_count": 11,
        "triangle_count": 2492,
        "primitive_budget": 12,
        "triangle_budget": 2600,
        "byte_budget": 320_000,
    },
    "ff_sct_01": {
        "root": "FF_SCT_01",
        "root_extras": {
            "asset_id": "ff_sct_01",
            "asset_role": "scout_vehicle",
            "provenance": "project_procedural_blender",
            "asset_revision": "player-scout-gold-v1",
            "render_profile": "strategic-camera-gold",
            "visual_gold_revision": "desktop-player-scout-gold-v1",
            "silhouette_profile": "low-four-wheel-fork-radar",
            "weapon_forward_axis": "+Z",
            "runtime_primitive_budget": 12,
            "runtime_triangle_budget": 1800,
            "runtime_material_budget": 7,
            "runtime_texture_budget": 0,
        },
        "nodes": {
            "chassis_root": {
                "parent": "FF_SCT_01",
                "translation": (0.0, 0.0, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {},
            },
            "turret_yaw": {
                "parent": "chassis_root",
                "translation": (0.0, 1.56, 0.15),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "weapon_yaw"},
            },
            "radar_yaw": {
                "parent": "chassis_root",
                "translation": (0.0, 1.45, -0.92),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"spin_speed": 1.1},
            },
            "muzzle_socket": {
                "parent": "turret_yaw",
                "translation": (0.0, 0.42, 1.58),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "projectile_origin"},
            },
            "selection_anchor": {
                "parent": "FF_SCT_01",
                "translation": (0.0, 0.04, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"socket_role": "selection_ground"},
            },
            "powered_scout_radar": {
                "parent": "radar_yaw",
                "translation": (0.0, 0.86, 0.0),
                "rotation": (0.0, 0.0, 0.0, 1.0),
                "extras": {"presentation_role": "powered_signal"},
            },
        },
        "motion_domains": {
            "FF_SCT_01": {"M_AmberArmor", "M_ArmorPanel", "M_Gunmetal", "M_Recess", "M_Steel", "M_TrackRubber"},
            "turret_yaw": {"M_Gunmetal", "M_Recess", "M_Steel"},
            "radar_yaw": {"M_ArmorPanel", "M_Steel"},
            "powered_scout_radar": {"M_CyanSignal"},
        },
        "node_count": 19,
        "primitive_count": 12,
        "triangle_count": 1624,
        "primitive_budget": 12,
        "triangle_budget": 1800,
        "byte_budget": 250_000,
    },
}
ANIMATION_CONTRACTS = {
    "ff_rif_01": {
        "rifle_idle",
        "rifle_run",
        "rifle_aim",
        "rifle_fire",
        "rifle_hit",
        "rifle_death",
    },
    "ff_eng_01": {f"engineer_{role}" for role in ("idle", "run", "aim", "fire", "hit", "death")},
    "ff_at_01": {f"antitank_{role}" for role in ("idle", "run", "aim", "fire", "hit", "death")},
    "ff_en_rif_01": {f"enemy_rifle_{role}" for role in ("idle", "run", "aim", "fire", "hit", "death")},
    "ff_en_at_01": {f"enemy_antitank_{role}" for role in ("idle", "run", "aim", "fire", "hit", "death")},
    "ff_en_eng_01": {f"enemy_engineer_{role}" for role in ("idle", "run", "aim", "fire", "hit", "death")},
}
INFANTRY_SILHOUETTE_CONTRACTS = {
    "ff_rif_01": ("FF_RIF_01", "player_rifle_shieldline_v2"),
    "ff_eng_01": ("FF_ENG_01", "player_engineer_serviceframe_v2"),
    "ff_at_01": ("FF_AT_01", "player_antitank_shouldertube_v2"),
    "ff_en_rif_01": ("FF_EN_RIF_01", "enemy_rifle_broadguard_v2"),
    "ff_en_eng_01": ("FF_EN_ENG_01", "enemy_engineer_repairtower_v2"),
    "ff_en_at_01": ("FF_EN_AT_01", "enemy_antitank_siegetube_v2"),
}
STATIC_PRIMITIVE_CONTRACTS = {
    "ff_scr_01": ("FF_SCR_01", 4, {"M_DrySage", "M_DrySageLight", "M_FieldEarth"}),
}
GOLD_BUILDING_CONTRACTS = {
    "ff_hq_01": ("FF_HQ_01", "terraced-command-citadel", "13.2x11.2", "3.10", 21, 9100, 8),
    "ff_fac_01": ("FF_FAC_01", "deep-bay-offset-gantry", "12.5x9.5", "3.00", 21, 8700, 7),
}
REFINERY_MECHANISM_CONTRACTS = {
    "ff_ref_01": {
        "root": "FF_REF_01",
        "primitive_budget": 12,
        "triangle_budget": 5000,
        "materials": {
            "M_ArmorPanel",
            "M_Gunmetal",
            "M_Recess",
            "M_Steel",
            "M_AmberArmor",
            "M_CyanSignal",
        },
    },
    "ff_en_ref_01": {
        "root": "FF_EN_REF_01",
        "primitive_budget": 13,
        "triangle_budget": 4000,
        "materials": {
            "M_EnemyCrimsonArmor",
            "M_EnemyObsidianArmor",
            "M_EnemyGunmetal",
            "M_EnemyRecess",
            "M_EnemyMarking",
            "M_EnemySignal",
        },
    },
}
VISUAL_GOLD_PROP_CONTRACTS = {
    "ff_ore_01": {
        "root": "FF_ORE_01",
        "revision": "desktop-resource-gold-v2",
        "profile": "broken-seam-half-buried-clusters",
        "primitive_budget": 16,
        "triangle_budget": 3200,
        "materials": {"M_ScorchedEarth", "M_Huijing", "M_FieldEarth"},
        "root_extras": {
            "asset_id": "ff_ore_01",
            "asset_role": "harvestable_resource_field",
            "emissive_projected_area_max_pct": 20,
            "runtime_primitive_budget": 16,
            "runtime_triangle_budget": 3200,
            "runtime_material_budget": 3,
        },
        "node_extras": {
            "harvest_socket": {"socket_role": "resource_interaction"},
            "ground_anchor": {"socket_role": "ground_contact"},
        },
        "transforms": {
            "resource_field_root": (0.0, 0.0, 0.0),
            "harvest_socket": (0.0, 0.08, 0.0),
            "ground_anchor": (0.0, 0.02, 0.0),
        },
        "parents": {
            "resource_field_root": "FF_ORE_01",
            "harvest_socket": "FF_ORE_01",
            "ground_anchor": "FF_ORE_01",
        },
    },
    "ff_crt_01": {
        "root": "FF_CRT_01",
        "revision": "desktop-crater-gold-v1",
        "profile": "broken-elliptical-impact-scar",
        "primitive_budget": 4,
        "triangle_budget": 1000,
        "byte_budget": 110_000,
        "materials": {"M_ScorchedEarth", "M_FieldEarth", "M_FaultRock"},
        "root_extras": {
            "asset_id": "ff_crt_01",
            "asset_role": "decorative_shell_crater",
            "provenance": "project_procedural_blender",
            "asset_revision": "strategic-crater-gold-v2",
            "visual_gold_revision": "desktop-crater-gold-v1",
            "silhouette_profile": "broken-elliptical-impact-scar",
            "footprint_m": "8.6x5.4",
            "surface_profile": "open-rim,low-core,directional-ejecta,embedded-lip",
            "readability_feature_scale_m": "0.45-4.60",
            "runtime_primitive_budget": 4,
            "runtime_triangle_budget": 1000,
            "runtime_material_budget": 3,
            "runtime_texture_budget": 0,
        },
        "exact_root_extras": True,
        "node_extras": {
            "ground_anchor": {"socket_role": "ground_contact"},
        },
        "exact_node_extras": {
            "crater_cluster_root": {},
            "ground_anchor": {"socket_role": "ground_contact"},
        },
        "transforms": {
            "FF_CRT_01": (0.0, 0.0, 0.0),
            "crater_cluster_root": (0.0, 0.0, 0.0),
            "ground_anchor": (0.0, 0.02, 0.0),
        },
        "identity_nodes": {"FF_CRT_01", "crater_cluster_root", "ground_anchor"},
        "parents": {
            "FF_CRT_01": None,
            "crater_cluster_root": "FF_CRT_01",
            "ground_anchor": "FF_CRT_01",
        },
        "require_material_merge": True,
    },
    "ff_en_sen_01": {
        "root": "FF_EN_SEN_01",
        "revision": "desktop-enemy-sentry-gold-v2",
        "profile": "braced-twin-cannon-forward",
        "primitive_budget": 10,
        "triangle_budget": 2200,
        "materials": {
            "M_EnemyCrimsonArmor",
            "M_EnemyGunmetal",
            "M_EnemySignal",
            "M_EnemyMarking",
            "M_EnemyObsidianArmor",
            "M_EnemyRecess",
        },
        "root_extras": {
            "asset_id": "ff_en_sen_01",
            "asset_role": "enemy_sentry",
            "provenance": "project_procedural_blender",
            "weapon_forward_axis": "-Y",
            "signal_projected_area_max_pct": 4,
            "runtime_primitive_budget": 10,
            "runtime_triangle_budget": 2200,
            "runtime_material_budget": 6,
        },
        "node_extras": {
            "turret_yaw": {"socket_role": "weapon_yaw"},
            "muzzle_socket_left": {"socket_role": "projectile_origin"},
            "muzzle_socket_right": {"socket_role": "projectile_origin"},
            "selection_anchor": {"socket_role": "selection_ground"},
        },
        "transforms": {
            "building_root": (0.0, 0.0, 0.0),
            "turret_yaw": (0.0, 2.35, 0.0),
            "muzzle_socket_left": (-0.55, 0.78, 3.86),
            "muzzle_socket_right": (0.55, 0.78, 3.86),
            "selection_anchor": (0.0, 0.05, 0.0),
        },
        "parents": {
            "building_root": "FF_EN_SEN_01",
            "selection_anchor": "FF_EN_SEN_01",
            "turret_yaw": "building_root",
            "muzzle_socket_left": "turret_yaw",
            "muzzle_socket_right": "turret_yaw",
        },
    },
}
PRESENTATION_CHILD_CONTRACTS = {
    "ff_hrv_01": {"collector_head", "cargo_slot_0", "cargo_slot_1", "cargo_slot_2"},
    "ff_fac_01": {"factory_door", "crane_yaw"},
    "ff_ref_01": {"intake_gate", "intake_conveyor", "intake_collector"},
    "ff_bar_01": {"barracks_door"},
    "ff_en_hrv_01": {"collector_head", "cargo_slot_0", "cargo_slot_1", "cargo_slot_2"},
    "ff_en_fac_01": {"factory_door", "crane_yaw"},
    "ff_en_ref_01": {"intake_gate", "intake_conveyor", "intake_collector"},
    "ff_en_bar_01": {"barracks_door"},
}

# These contracts protect runtime-facing attachment semantics without freezing
# authored geometry. Bounds are deliberately broad enough for later Blender
# polish while still catching an axis flip, an accidental reparent, or a socket
# that has drifted into the building footprint.
SEMANTIC_SOCKET_CONTRACTS = {
    "ff_hrv_01": {
        "resource_socket": {
            "parent": "cargo_bed",
            "socket_role": "cargo_visual_origin",
            "translation_bounds": ((-0.35, 0.35), (1.5, 3.2), (-2.4, -0.5)),
            "direction": "cargo-rear-local-negative-z",
        },
    },
    "ff_en_hrv_01": {
        "resource_socket": {
            "parent": "cargo_bed",
            "socket_role": "cargo_visual_origin",
            "translation_bounds": ((-0.35, 0.35), (1.5, 3.2), (-2.4, -0.5)),
            "direction": "cargo-rear-local-negative-z",
        },
    },
    "ff_ref_01": {
        "intake_bay": {
            "parent": "building_root",
            "socket_role": None,
            "translation_bounds": ((-0.25, 0.25), (-0.25, 0.25), (-0.25, 0.25)),
            "direction": "semantic-bay-origin",
        },
        "deposit_socket": {
            "parent": "FF_REF_01",
            "socket_role": "harvester_deposit",
            "translation_bounds": ((-3.0, 1.0), (-0.25, 0.5), (4.5, 8.0)),
            "direction": "exterior-local-positive-z",
        },
        "intake_gate": {
            "parent": "intake_bay",
            "role_key": "presentation_role",
            "presentation_role": "deposit_gate",
            "translation_bounds": ((-2.0, -1.0), (-0.25, 0.5), (2.5, 3.5)),
            "direction": "gate-at-intake-mouth-local-positive-z",
        },
        "intake_conveyor": {
            "parent": "intake_bay",
            "role_key": "presentation_role",
            "presentation_role": "deposit_conveyor",
            "translation_bounds": ((-2.0, -1.0), (-0.25, 0.5), (3.7, 5.2)),
            "direction": "conveyor-on-exterior-ramp-local-positive-z",
        },
        "intake_collector": {
            "parent": "intake_bay",
            "role_key": "presentation_role",
            "presentation_role": "deposit_collector",
            "translation_bounds": ((-2.0, -1.0), (0.6, 1.5), (2.6, 3.8)),
            "direction": "collector-across-intake-mouth-local-x",
        },
    },
    "ff_en_ref_01": {
        "intake_bay": {
            "parent": "building_root",
            "socket_role": None,
            "translation_bounds": ((-0.25, 0.25), (-0.25, 0.25), (-0.25, 0.25)),
            "direction": "semantic-bay-origin",
        },
        "deposit_socket": {
            "parent": "FF_EN_REF_01",
            "socket_role": "harvester_deposit",
            "translation_bounds": ((-3.0, 1.0), (-0.25, 0.5), (4.5, 8.0)),
            "direction": "exterior-local-positive-z",
        },
        "intake_gate": {
            "parent": "intake_bay",
            "role_key": "presentation_role",
            "presentation_role": "deposit_gate",
            "translation_bounds": ((-2.0, -1.0), (-0.25, 0.5), (2.5, 3.5)),
            "direction": "gate-at-intake-mouth-local-positive-z",
        },
        "intake_conveyor": {
            "parent": "intake_bay",
            "role_key": "presentation_role",
            "presentation_role": "deposit_conveyor",
            "translation_bounds": ((-2.0, -1.0), (-0.25, 0.5), (3.7, 5.2)),
            "direction": "conveyor-on-exterior-ramp-local-positive-z",
        },
        "intake_collector": {
            "parent": "intake_bay",
            "role_key": "presentation_role",
            "presentation_role": "deposit_collector",
            "translation_bounds": ((-2.0, -1.0), (0.6, 1.5), (2.6, 3.8)),
            "direction": "collector-across-intake-mouth-local-x",
        },
    },
    "ff_fac_01": {
        "production_socket": {
            "parent": "FF_FAC_01",
            "socket_role": "vehicle_spawn",
            "translation_bounds": ((-1.0, 1.0), (-0.25, 0.5), (4.5, 8.5)),
            "direction": "exterior-local-positive-z",
        },
    },
    "ff_en_fac_01": {
        "production_socket": {
            "parent": "FF_EN_FAC_01",
            "socket_role": "vehicle_spawn",
            "translation_bounds": ((-1.0, 1.0), (-0.25, 0.5), (4.5, 8.5)),
            "direction": "exterior-local-positive-z",
        },
    },
    "ff_bar_01": {
        "infantry_spawn": {
            "parent": "FF_BAR_01",
            "socket_role": "infantry_spawn",
            "translation_bounds": ((-1.0, 1.0), (-0.25, 0.5), (3.0, 6.0)),
            "direction": "exterior-local-positive-z",
        },
    },
    "ff_en_bar_01": {
        "infantry_spawn": {
            "parent": "FF_EN_BAR_01",
            "socket_role": "infantry_spawn",
            "translation_bounds": ((-1.0, 1.0), (-0.25, 0.5), (3.0, 6.0)),
            "direction": "exterior-local-positive-z",
        },
    },
}


def read_glb_json(path: Path) -> dict:
    with path.open("rb") as stream:
        magic, version, total_length = struct.unpack("<4sII", stream.read(12))
        if magic != b"glTF" or version != 2 or total_length != path.stat().st_size:
            raise ValueError("invalid GLB header")
        chunk_length, chunk_type = struct.unpack("<II", stream.read(8))
        if chunk_type != 0x4E4F534A:
            raise ValueError("first GLB chunk is not JSON")
        return json.loads(stream.read(chunk_length).decode("utf-8"))


def translation_matches(node: dict, expected: tuple[float, float, float], tolerance: float = 1e-4) -> bool:
    actual = node.get("translation", (0.0, 0.0, 0.0))
    return (
        isinstance(actual, (list, tuple))
        and len(actual) == 3
        and all(abs(float(value) - target) <= tolerance for value, target in zip(actual, expected))
    )


def rotation_matches(
    node: dict,
    expected: tuple[float, float, float, float],
    tolerance: float = 1e-4,
) -> bool:
    actual = node.get("rotation", (0.0, 0.0, 0.0, 1.0))
    if not isinstance(actual, (list, tuple)) or len(actual) != 4:
        return False
    try:
        values = tuple(float(value) for value in actual)
    except (TypeError, ValueError):
        return False
    if not all(math.isfinite(value) for value in values):
        return False
    direct_error = max(abs(value - target) for value, target in zip(values, expected))
    negated_error = max(abs(value + target) for value, target in zip(values, expected))
    return min(direct_error, negated_error) <= tolerance


def node_translation(node: dict) -> tuple[float, float, float] | None:
    actual = node.get("translation", (0.0, 0.0, 0.0))
    if not isinstance(actual, (list, tuple)) or len(actual) != 3:
        return None
    try:
        translation = tuple(float(value) for value in actual)
    except (TypeError, ValueError):
        return None
    return translation if all(math.isfinite(value) for value in translation) else None


def is_identity_trs(node: dict, tolerance: float = 1e-4) -> bool:
    rotation = node.get("rotation", (0.0, 0.0, 0.0, 1.0))
    scale = node.get("scale", (1.0, 1.0, 1.0))
    if not isinstance(rotation, (list, tuple)) or len(rotation) != 4:
        return False
    if not isinstance(scale, (list, tuple)) or len(scale) != 3:
        return False
    try:
        rotation_values = tuple(float(value) for value in rotation)
        scale_values = tuple(float(value) for value in scale)
    except (TypeError, ValueError):
        return False
    if not all(math.isfinite(value) for value in (*rotation_values, *scale_values)):
        return False
    return (
        all(abs(value) <= tolerance for value in rotation_values[:3])
        and abs(abs(rotation_values[3]) - 1.0) <= tolerance
        and all(abs(value - 1.0) <= tolerance for value in scale_values)
    )


def parent_names_by_child(document: dict) -> dict[str, str]:
    nodes = document.get("nodes", [])
    parents: dict[str, str] = {}
    for parent in nodes:
        parent_name = parent.get("name")
        for child_index in parent.get("children", []):
            if isinstance(child_index, int) and 0 <= child_index < len(nodes):
                child_name = nodes[child_index].get("name")
                if parent_name and child_name:
                    parents[child_name] = parent_name
    return parents


def validate_semantic_sockets(
    asset_id: str,
    nodes_by_name: dict[str, dict],
    parents_by_child: dict[str, str],
) -> list[str]:
    errors: list[str] = []
    for node_name, contract in SEMANTIC_SOCKET_CONTRACTS.get(asset_id, {}).items():
        node = nodes_by_name.get(node_name)
        if node is None:
            # The general node contract reports the missing node.
            continue
        expected_parent = contract["parent"]
        if parents_by_child.get(node_name) != expected_parent:
            errors.append(f"{asset_id}: {node_name} parent changed from {expected_parent}")

        role_key = contract.get("role_key", "socket_role")
        expected_role = contract.get(role_key)
        extras = node.get("extras")
        if extras is not None and not isinstance(extras, dict):
            errors.append(f"{asset_id}: {node_name} extras must remain an object when present")
        actual_role = extras.get(role_key) if isinstance(extras, dict) else None
        if actual_role != expected_role:
            role_label = expected_role if expected_role is not None else "absent (semantic bay, not socket)"
            errors.append(f"{asset_id}: {node_name} {role_key} changed from {role_label}")

        if node.get("mesh") is not None or node.get("matrix") is not None:
            errors.append(f"{asset_id}: {node_name} must remain a meshless local-TRS semantic node")
        if not is_identity_trs(node):
            errors.append(f"{asset_id}: {node_name} rotation/scale no longer preserves local-axis semantics")

        translation = node_translation(node)
        if translation is None:
            errors.append(f"{asset_id}: {node_name} has an invalid local translation")
            continue
        bounds = contract["translation_bounds"]
        if not all(low <= value <= high for value, (low, high) in zip(translation, bounds)):
            errors.append(
                f"{asset_id}: {node_name} local translation {translation} violates "
                f"{contract['direction']} bounds {bounds}"
            )
    return errors


def validate_vehicle_wreck(
    asset_id: str,
    document: dict,
    nodes_by_name: dict[str, dict],
    parents_by_child: dict[str, str],
) -> list[str]:
    contract = VEHICLE_WRECK_CONTRACTS.get(asset_id)
    if contract is None:
        return []
    errors: list[str] = []
    root = nodes_by_name.get("wreck_visual_root")
    if root is None:
        return errors
    extras = root.get("extras", {})
    expected_extras = {
        "presentation_role": "wreck_visual",
        "default_visible": False,
        "runtime_visibility_owner": "scene",
        "wreck_profile": contract["profile"],
    }
    for key, expected in expected_extras.items():
        if extras.get(key) != expected:
            errors.append(f"{asset_id}: wreck_visual_root extra {key} changed from {expected}")
    if root.get("mesh") is not None or root.get("matrix") is not None:
        errors.append(f"{asset_id}: wreck_visual_root must remain a meshless local-TRS node")
    if not translation_matches(root, (0.0, 0.0, 0.0)) or not is_identity_trs(root):
        errors.append(f"{asset_id}: wreck_visual_root local TRS must remain identity")
    if parents_by_child.get("wreck_visual_root") != contract["root"]:
        errors.append(f"{asset_id}: wreck_visual_root parent changed from {contract['root']}")

    nodes = document.get("nodes", [])
    meshes = document.get("meshes", [])
    accessors = document.get("accessors", [])
    child_names = {
        nodes[index].get("name")
        for index in root.get("children", [])
        if isinstance(index, int) and 0 <= index < len(nodes)
    }
    if child_names != contract["parts"]:
        errors.append(f"{asset_id}: wreck parts changed from {sorted(contract['parts'])}")

    primitive_count = 0
    triangle_count = 0
    for part_name in contract["parts"]:
        part = nodes_by_name.get(part_name)
        if part is None:
            continue
        if parents_by_child.get(part_name) != "wreck_visual_root":
            errors.append(f"{asset_id}: {part_name} parent changed from wreck_visual_root")
        mesh_index = part.get("mesh")
        if not isinstance(mesh_index, int) or not 0 <= mesh_index < len(meshes):
            errors.append(f"{asset_id}: {part_name} must remain a visible mesh")
            continue
        primitives = meshes[mesh_index].get("primitives", [])
        if not primitives:
            errors.append(f"{asset_id}: {part_name} has no visible primitive")
        primitive_count += len(primitives)
        triangle_count += sum(
            accessors[primitive["indices"]].get("count", 0) // 3
            for primitive in primitives
            if primitive.get("mode", 4) == 4
            and isinstance(primitive.get("indices"), int)
            and 0 <= primitive["indices"] < len(accessors)
        )
    if primitive_count > 3:
        errors.append(f"{asset_id}: wreck uses {primitive_count} primitives, budget is 3")
    if triangle_count > 2500:
        errors.append(f"{asset_id}: wreck uses {triangle_count} triangles, budget is 2500")
    if len(document.get("materials", [])) != contract["material_count"]:
        errors.append(f"{asset_id}: wreck wave changed the existing material count")
    if len(document.get("textures", [])) != contract["texture_count"]:
        errors.append(f"{asset_id}: wreck wave changed the existing texture count")
    return errors


def validate_building_damage(
    asset_id: str,
    document: dict,
    nodes_by_name: dict[str, dict],
    parents_by_child: dict[str, str],
) -> list[str]:
    contract = BUILDING_DAMAGE_CONTRACTS.get(asset_id)
    if contract is None:
        return []
    errors: list[str] = []
    root_node = nodes_by_name.get(contract["root"], {})
    root_extras = root_node.get("extras", {}) or {}
    expected_root_extras = {
        "building_damage_revision": "authored-building-damage-v1",
        "building_damage_stages": "damaged,critical",
        "damage_runtime_visibility_owner": "scene",
        "damage_stage_primitive_budget": 3,
        "damage_stage_triangle_budget": 1800,
        "runtime_primitive_budget": contract["total_primitive_budget"],
        "runtime_triangle_budget": contract["total_triangle_budget"],
        "runtime_material_budget": contract["material_count"],
    }
    for key, expected in expected_root_extras.items():
        if root_extras.get(key) != expected:
            errors.append(f"{asset_id}: root extra {key} changed from {expected}")

    for node_name, (expected_parent, expected_translation, expected_extras) in contract["preserved_nodes"].items():
        node = nodes_by_name.get(node_name)
        if node is None:
            continue
        if parents_by_child.get(node_name) != expected_parent:
            errors.append(f"{asset_id}: preserved node {node_name} parent changed from {expected_parent}")
        if not translation_matches(node, expected_translation):
            errors.append(f"{asset_id}: preserved node {node_name} translation changed from {expected_translation}")
        if not is_identity_trs(node):
            errors.append(f"{asset_id}: preserved node {node_name} rotation/scale changed")
        actual_extras = node.get("extras", {}) or {}
        if actual_extras != expected_extras:
            errors.append(f"{asset_id}: preserved node {node_name} extras changed from {expected_extras}")

    nodes = document.get("nodes", [])
    meshes = document.get("meshes", [])
    accessors = document.get("accessors", [])
    stage_contracts = {
        "damaged": {
            "root": "damage_visual_damaged",
            "role": "building_damage_damaged",
            "parts": {
                "damage_damaged_breach",
                "damage_damaged_bent_armor",
                "damage_damaged_debris",
            },
        },
        "critical": {
            "root": "damage_visual_critical",
            "role": "building_damage_critical",
            "parts": {
                "damage_critical_collapse",
                "damage_critical_bent_armor",
                "damage_critical_debris",
            },
        },
    }
    for stage_name, stage_contract in stage_contracts.items():
        stage_root_name = stage_contract["root"]
        stage_root = nodes_by_name.get(stage_root_name)
        if stage_root is None:
            continue
        expected_extras = {
            "presentation_role": stage_contract["role"],
            "default_visible": False,
            "runtime_visibility_owner": "scene",
            "damage_stage": stage_name,
            "damage_profile": contract["profile"],
            "readability_feature_scale_m": "0.35-2.80",
            "stage_primitive_budget": 3,
            "stage_triangle_budget": 1800,
        }
        extras = stage_root.get("extras", {}) or {}
        for key, expected in expected_extras.items():
            if extras.get(key) != expected:
                errors.append(f"{asset_id}: {stage_root_name} extra {key} changed from {expected}")
        if stage_root.get("mesh") is not None or stage_root.get("matrix") is not None:
            errors.append(f"{asset_id}: {stage_root_name} must remain a meshless local-TRS node")
        if not translation_matches(stage_root, (0.0, 0.0, 0.0)) or not is_identity_trs(stage_root):
            errors.append(f"{asset_id}: {stage_root_name} local TRS must remain identity")
        if parents_by_child.get(stage_root_name) != "building_root":
            errors.append(f"{asset_id}: {stage_root_name} parent changed from building_root")

        child_names = {
            nodes[index].get("name")
            for index in stage_root.get("children", [])
            if isinstance(index, int) and 0 <= index < len(nodes)
        }
        if child_names != stage_contract["parts"]:
            errors.append(
                f"{asset_id}: {stage_root_name} parts changed from {sorted(stage_contract['parts'])}"
            )
        primitive_count = 0
        triangle_count = 0
        for part_name in stage_contract["parts"]:
            part = nodes_by_name.get(part_name)
            if part is None:
                continue
            if parents_by_child.get(part_name) != stage_root_name:
                errors.append(f"{asset_id}: {part_name} parent changed from {stage_root_name}")
            mesh_index = part.get("mesh")
            if not isinstance(mesh_index, int) or not 0 <= mesh_index < len(meshes):
                errors.append(f"{asset_id}: {part_name} must remain a visible mesh")
                continue
            primitives = meshes[mesh_index].get("primitives", [])
            if not primitives:
                errors.append(f"{asset_id}: {part_name} has no visible primitive")
            primitive_count += len(primitives)
            triangle_count += sum(
                accessors[primitive["indices"]].get("count", 0) // 3
                for primitive in primitives
                if primitive.get("mode", 4) == 4
                and isinstance(primitive.get("indices"), int)
                and 0 <= primitive["indices"] < len(accessors)
            )
        if primitive_count != 3:
            errors.append(f"{asset_id}: {stage_root_name} uses {primitive_count} primitives, contract is 3")
        if triangle_count > 1800:
            errors.append(f"{asset_id}: {stage_root_name} uses {triangle_count} triangles, budget is 1800")

    if len(document.get("materials", [])) != contract["material_count"]:
        errors.append(f"{asset_id}: building damage wave changed the existing material count")
    if len(document.get("textures", [])) != contract["texture_count"]:
        errors.append(f"{asset_id}: building damage wave changed the existing texture count")
    if document.get("animations"):
        errors.append(f"{asset_id}: building damage visuals must remain scene-driven, not clip-driven")
    primitive_count = sum(len(mesh.get("primitives", [])) for mesh in meshes)
    if primitive_count > contract["total_primitive_budget"]:
        errors.append(
            f"{asset_id}: {primitive_count} primitives exceed total budget "
            f"{contract['total_primitive_budget']}"
        )
    triangle_count = sum(
        accessors[primitive["indices"]].get("count", 0) // 3
        for mesh in meshes
        for primitive in mesh.get("primitives", [])
        if primitive.get("mode", 4) == 4
        and isinstance(primitive.get("indices"), int)
        and 0 <= primitive["indices"] < len(accessors)
    )
    if triangle_count > contract["total_triangle_budget"]:
        errors.append(
            f"{asset_id}: {triangle_count} triangles exceed total budget "
            f"{contract['total_triangle_budget']}"
        )
    return errors


def validate_building_ruin(
    asset_id: str,
    document: dict,
    nodes_by_name: dict[str, dict],
    parents_by_child: dict[str, str],
) -> list[str]:
    contract = BUILDING_RUIN_CONTRACTS.get(asset_id)
    if contract is None:
        return []

    errors: list[str] = []
    nodes = document.get("nodes", [])
    meshes = document.get("meshes", [])
    accessors = document.get("accessors", [])
    materials = document.get("materials", [])
    part_names = {
        "ruin_foundation",
        "ruin_collapsed_structure",
        "ruin_broken_machinery",
        "ruin_faction_debris",
    }
    unique_names = {"ruin_visual_root", "ruin_marker_anchor", *part_names}
    for name in sorted(unique_names):
        count = sum(node.get("name") == name for node in nodes)
        if count != 1:
            errors.append(f"{asset_id}: {name} must be unique, found {count}")

    asset_root = nodes_by_name.get(contract["root"], {})
    asset_extras = asset_root.get("extras", {}) or {}
    expected_asset_extras = {
        "building_ruin_revision": "authored-building-ruin-v1",
        "ruin_runtime_visibility_owner": "scene",
        "ruin_primitive_budget": 4,
        "ruin_triangle_budget": 1500,
        "runtime_primitive_budget": contract["total_primitive_budget"],
        "runtime_triangle_budget": contract["total_triangle_budget"],
        "runtime_material_budget": contract["material_count"],
    }
    for key, expected in expected_asset_extras.items():
        if asset_extras.get(key) != expected:
            errors.append(f"{asset_id}: root extra {key} changed from {expected}")

    ruin_root = nodes_by_name.get("ruin_visual_root")
    if ruin_root is None:
        return errors
    expected_ruin_extras = {
        "presentation_role": "building_ruin",
        "default_visible": False,
        "runtime_visibility_owner": "scene",
        "ruin_profile": contract["profile"],
        "readability_feature_scale_m": "0.45-3.50",
        "primitive_budget": 4,
        "triangle_budget": 1500,
    }
    ruin_extras = ruin_root.get("extras", {}) or {}
    for key, expected in expected_ruin_extras.items():
        if ruin_extras.get(key) != expected:
            errors.append(f"{asset_id}: ruin_visual_root extra {key} changed from {expected}")
    if ruin_root.get("mesh") is not None or ruin_root.get("matrix") is not None:
        errors.append(f"{asset_id}: ruin_visual_root must remain a meshless local-TRS node")
    if not translation_matches(ruin_root, (0.0, 0.0, 0.0)) or not is_identity_trs(ruin_root):
        errors.append(f"{asset_id}: ruin_visual_root local TRS must remain identity")
    if parents_by_child.get("ruin_visual_root") != "building_root":
        errors.append(f"{asset_id}: ruin_visual_root parent changed from building_root")

    child_names = [
        nodes[index].get("name")
        for index in ruin_root.get("children", [])
        if isinstance(index, int) and 0 <= index < len(nodes)
    ]
    expected_children = {*part_names, "ruin_marker_anchor"}
    if len(child_names) != len(expected_children) or set(child_names) != expected_children:
        errors.append(
            f"{asset_id}: ruin_visual_root children changed from {sorted(expected_children)}"
        )

    primitive_count = 0
    triangle_count = 0
    for part_name in sorted(part_names):
        part = nodes_by_name.get(part_name)
        if part is None:
            continue
        if parents_by_child.get(part_name) != "ruin_visual_root":
            errors.append(f"{asset_id}: {part_name} parent changed from ruin_visual_root")
        part_extras = part.get("extras", {}) or {}
        if part_extras.get("ruin_part") != part_name:
            errors.append(f"{asset_id}: {part_name} ruin_part semantic changed")
        if part_extras.get("readability_feature_min_m") != 0.45:
            errors.append(f"{asset_id}: {part_name} readability floor changed from 0.45m")
        mesh_index = part.get("mesh")
        if not isinstance(mesh_index, int) or not 0 <= mesh_index < len(meshes):
            errors.append(f"{asset_id}: {part_name} must remain a visible mesh")
            continue
        primitives = meshes[mesh_index].get("primitives", [])
        if len(primitives) != 1:
            errors.append(f"{asset_id}: {part_name} must remain one independent primitive")
        primitive_count += len(primitives)
        for primitive in primitives:
            material_index = primitive.get("material")
            if not isinstance(material_index, int) or not 0 <= material_index < len(materials):
                errors.append(f"{asset_id}: {part_name} must reuse one existing material")
            index_accessor = primitive.get("indices")
            if (
                primitive.get("mode", 4) == 4
                and isinstance(index_accessor, int)
                and 0 <= index_accessor < len(accessors)
            ):
                triangle_count += accessors[index_accessor].get("count", 0) // 3
    if primitive_count != 4:
        errors.append(f"{asset_id}: ruin uses {primitive_count} primitives, contract is 4")
    if triangle_count > 1500:
        errors.append(f"{asset_id}: ruin uses {triangle_count} triangles, budget is 1500")

    marker = nodes_by_name.get("ruin_marker_anchor")
    if marker is not None:
        if parents_by_child.get("ruin_marker_anchor") != "ruin_visual_root":
            errors.append(f"{asset_id}: ruin_marker_anchor parent changed from ruin_visual_root")
        marker_extras = marker.get("extras", {}) or {}
        if marker_extras.get("socket_role") != "faction_marker_low":
            errors.append(f"{asset_id}: ruin_marker_anchor socket_role changed from faction_marker_low")
        if marker.get("mesh") is not None or marker.get("matrix") is not None:
            errors.append(f"{asset_id}: ruin_marker_anchor must remain a meshless local-TRS node")
        if not is_identity_trs(marker):
            errors.append(f"{asset_id}: ruin_marker_anchor rotation/scale must remain identity")
        translation = node_translation(marker)
        marker_bounds = ((-0.1, 0.1), (0.85, 1.1), (-0.1, 0.1))
        if translation is None:
            errors.append(f"{asset_id}: ruin_marker_anchor has an invalid local translation")
        elif not all(low <= value <= high for value, (low, high) in zip(translation, marker_bounds)):
            errors.append(
                f"{asset_id}: ruin_marker_anchor local translation {translation} violates "
                f"low-faction-marker bounds {marker_bounds}"
            )
        if marker.get("children"):
            errors.append(f"{asset_id}: ruin_marker_anchor must remain a leaf socket")

    if len(materials) != contract["material_count"]:
        errors.append(f"{asset_id}: building ruin wave changed the existing material count")
    if len(document.get("textures", [])) != contract["texture_count"]:
        errors.append(f"{asset_id}: building ruin wave changed the existing texture count")
    if document.get("animations"):
        errors.append(f"{asset_id}: building ruin visuals must remain scene-driven, not clip-driven")

    total_primitive_count = sum(len(mesh.get("primitives", [])) for mesh in meshes)
    if total_primitive_count > contract["total_primitive_budget"]:
        errors.append(
            f"{asset_id}: {total_primitive_count} primitives exceed total budget "
            f"{contract['total_primitive_budget']}"
        )
    total_triangle_count = sum(
        accessors[primitive["indices"]].get("count", 0) // 3
        for mesh in meshes
        for primitive in mesh.get("primitives", [])
        if primitive.get("mode", 4) == 4
        and isinstance(primitive.get("indices"), int)
        and 0 <= primitive["indices"] < len(accessors)
    )
    if total_triangle_count > contract["total_triangle_budget"]:
        errors.append(
            f"{asset_id}: {total_triangle_count} triangles exceed total budget "
            f"{contract['total_triangle_budget']}"
        )
    return errors


def validate_enemy_strategic_building(
    asset_id: str,
    document: dict,
    nodes_by_name: dict[str, dict],
    parents_by_child: dict[str, str],
) -> list[str]:
    contract = ENEMY_STRATEGIC_BUILDING_CONTRACTS.get(asset_id)
    if contract is None:
        return []

    errors: list[str] = []
    nodes = document.get("nodes", [])
    meshes = document.get("meshes", [])
    materials = document.get("materials", [])
    accessors = document.get("accessors", [])
    unique_names = {contract["root"], *contract["nodes"]}
    for name in sorted(unique_names):
        count = sum(node.get("name") == name for node in nodes)
        if count != 1:
            errors.append(f"{asset_id}: {name} must be unique, found {count}")

    root = nodes_by_name.get(contract["root"])
    if root is None:
        return errors
    for key, expected in contract["root_extras"].items():
        if (root.get("extras", {}) or {}).get(key) != expected:
            errors.append(f"{asset_id}: root extra {key} changed from {expected}")
    if root.get("mesh") is not None or root.get("matrix") is not None:
        errors.append(f"{asset_id}: asset root must remain a meshless local-TRS node")
    if parents_by_child.get(contract["root"]) is not None:
        errors.append(f"{asset_id}: asset root unexpectedly gained a parent")
    if not translation_matches(root, (0.0, 0.0, 0.0)) or not is_identity_trs(root):
        errors.append(f"{asset_id}: asset root local TRS must remain identity")

    for node_name, node_contract in contract["nodes"].items():
        node = nodes_by_name.get(node_name)
        if node is None:
            continue
        if parents_by_child.get(node_name) != node_contract["parent"]:
            errors.append(
                f"{asset_id}: {node_name} parent changed from {node_contract['parent']}"
            )
        if not translation_matches(node, node_contract["translation"]):
            errors.append(
                f"{asset_id}: {node_name} translation changed from "
                f"{node_contract['translation']}"
            )
        if not rotation_matches(node, node_contract["rotation"]):
            errors.append(f"{asset_id}: {node_name} rotation changed")
        scale = node.get("scale", (1.0, 1.0, 1.0))
        try:
            scale_values = tuple(float(value) for value in scale)
        except (TypeError, ValueError):
            scale_values = ()
        if (
            not isinstance(scale, (list, tuple))
            or len(scale_values) != 3
            or any(not math.isfinite(value) for value in scale_values)
            or any(abs(value - 1.0) > 1e-4 for value in scale_values)
        ):
            errors.append(f"{asset_id}: {node_name} scale changed from identity")
        if node.get("mesh") is not None or node.get("matrix") is not None:
            errors.append(f"{asset_id}: {node_name} must remain a meshless local-TRS node")
        if (node.get("extras", {}) or {}) != node_contract["extras"]:
            errors.append(
                f"{asset_id}: {node_name} extras changed from {node_contract['extras']}"
            )

    for domain_name, expected_materials in contract["motion_domains"].items():
        domain = nodes_by_name.get(domain_name)
        if domain is None:
            continue
        actual_materials: list[str] = []
        for child_index in domain.get("children", []):
            if not isinstance(child_index, int) or not 0 <= child_index < len(nodes):
                continue
            mesh_index = nodes[child_index].get("mesh")
            if not isinstance(mesh_index, int) or not 0 <= mesh_index < len(meshes):
                continue
            for primitive in meshes[mesh_index].get("primitives", []):
                material_index = primitive.get("material")
                if not isinstance(material_index, int) or not 0 <= material_index < len(materials):
                    errors.append(
                        f"{asset_id}: {domain_name} has a primitive without an existing material"
                    )
                    continue
                actual_materials.append(materials[material_index].get("name"))
        if set(actual_materials) != expected_materials or len(actual_materials) != len(expected_materials):
            errors.append(
                f"{asset_id}: {domain_name} visible material domains changed from "
                f"{sorted(expected_materials)}"
            )

    material_names = {
        material.get("name")
        for material in materials
        if material.get("name")
    }
    if material_names != ENEMY_STRATEGIC_BUILDING_MATERIALS or len(materials) != 6:
        errors.append(f"{asset_id}: six-material enemy building semantics changed")
    if document.get("textures") or document.get("images"):
        errors.append(f"{asset_id}: enemy strategic building unexpectedly added textures")
    if document.get("animations"):
        errors.append(f"{asset_id}: enemy strategic building must remain code-driven, not clip-driven")

    primitive_count = sum(len(mesh.get("primitives", [])) for mesh in meshes)
    if primitive_count > contract["primitive_budget"]:
        errors.append(
            f"{asset_id}: {primitive_count} primitives exceed strategic-building budget "
            f"{contract['primitive_budget']}"
        )
    triangle_count = sum(
        accessors[primitive["indices"]].get("count", 0) // 3
        for mesh in meshes
        for primitive in mesh.get("primitives", [])
        if primitive.get("mode", 4) == 4
        and isinstance(primitive.get("indices"), int)
        and 0 <= primitive["indices"] < len(accessors)
    )
    if triangle_count > contract["triangle_budget"]:
        errors.append(
            f"{asset_id}: {triangle_count} triangles exceed strategic-building budget "
            f"{contract['triangle_budget']}"
        )

    healthy_primitive_budget = contract.get("healthy_primitive_budget")
    healthy_triangle_budget = contract.get("healthy_triangle_budget")
    if healthy_primitive_budget is not None or healthy_triangle_budget is not None:
        presentation_roots = {
            "damage_visual_damaged",
            "damage_visual_critical",
            "ruin_visual_root",
        }

        def is_presentation_node(node_name: str) -> bool:
            current = node_name
            while current is not None:
                if current in presentation_roots:
                    return True
                current = parents_by_child.get(current)
            return False

        healthy_primitive_count = 0
        healthy_triangle_count = 0
        for node in nodes:
            node_name = node.get("name")
            mesh_index = node.get("mesh")
            if (
                not node_name
                or is_presentation_node(node_name)
                or not isinstance(mesh_index, int)
                or not 0 <= mesh_index < len(meshes)
            ):
                continue
            primitives = meshes[mesh_index].get("primitives", [])
            healthy_primitive_count += len(primitives)
            healthy_triangle_count += sum(
                accessors[primitive["indices"]].get("count", 0) // 3
                for primitive in primitives
                if primitive.get("mode", 4) == 4
                and isinstance(primitive.get("indices"), int)
                and 0 <= primitive["indices"] < len(accessors)
            )
        if (
            healthy_primitive_budget is not None
            and healthy_primitive_count > healthy_primitive_budget
        ):
            errors.append(
                f"{asset_id}: healthy presentation uses {healthy_primitive_count} primitives, "
                f"budget is {healthy_primitive_budget}"
            )
        if (
            healthy_triangle_budget is not None
            and healthy_triangle_count > healthy_triangle_budget
        ):
            errors.append(
                f"{asset_id}: healthy presentation uses {healthy_triangle_count} triangles, "
                f"budget is {healthy_triangle_budget}"
            )
    return errors


def validate_player_infrastructure(
    asset_id: str,
    document: dict,
    nodes_by_name: dict[str, dict],
    parents_by_child: dict[str, str],
) -> list[str]:
    """Lock player barracks/reactor identity, dynamic domains, and four-state budgets."""
    contract = PLAYER_INFRASTRUCTURE_CONTRACTS.get(asset_id)
    if contract is None:
        return []

    errors: list[str] = []
    nodes = document.get("nodes", [])
    meshes = document.get("meshes", [])
    materials = document.get("materials", [])
    accessors = document.get("accessors", [])
    unique_names = {contract["root"], *contract["nodes"], *contract["motion_domains"]}
    for name in sorted(unique_names):
        count = sum(node.get("name") == name for node in nodes)
        if count != 1:
            errors.append(f"{asset_id}: {name} must be unique, found {count}")

    root = nodes_by_name.get(contract["root"])
    if root is None:
        return errors
    for key, expected in contract["root_extras"].items():
        if (root.get("extras", {}) or {}).get(key) != expected:
            errors.append(f"{asset_id}: root extra {key} changed from {expected}")
    if root.get("mesh") is not None or root.get("matrix") is not None:
        errors.append(f"{asset_id}: asset root must remain a meshless local-TRS node")
    if parents_by_child.get(contract["root"]) is not None:
        errors.append(f"{asset_id}: asset root unexpectedly gained a parent")
    if not translation_matches(root, (0.0, 0.0, 0.0)) or not is_identity_trs(root):
        errors.append(f"{asset_id}: asset root local TRS must remain identity")

    for node_name, node_contract in contract["nodes"].items():
        node = nodes_by_name.get(node_name)
        if node is None:
            continue
        if parents_by_child.get(node_name) != node_contract["parent"]:
            errors.append(
                f"{asset_id}: {node_name} parent changed from {node_contract['parent']}"
            )
        if not translation_matches(node, node_contract["translation"]):
            errors.append(
                f"{asset_id}: {node_name} translation changed from "
                f"{node_contract['translation']}"
            )
        if not rotation_matches(node, node_contract["rotation"]):
            errors.append(f"{asset_id}: {node_name} rotation changed")
        scale = node.get("scale", (1.0, 1.0, 1.0))
        try:
            scale_values = tuple(float(value) for value in scale)
        except (TypeError, ValueError):
            scale_values = ()
        if (
            not isinstance(scale, (list, tuple))
            or len(scale_values) != 3
            or any(not math.isfinite(value) for value in scale_values)
            or any(abs(value - 1.0) > 1e-4 for value in scale_values)
        ):
            errors.append(f"{asset_id}: {node_name} scale changed from identity")
        if node.get("mesh") is not None or node.get("matrix") is not None:
            errors.append(f"{asset_id}: {node_name} must remain a meshless local-TRS node")
        if (node.get("extras", {}) or {}) != node_contract["extras"]:
            errors.append(
                f"{asset_id}: {node_name} extras changed from {node_contract['extras']}"
            )

    for domain_name, expected_materials in contract["motion_domains"].items():
        domain = nodes_by_name.get(domain_name)
        if domain is None:
            continue
        actual_materials: list[str] = []
        for child_index in domain.get("children", []):
            if not isinstance(child_index, int) or not 0 <= child_index < len(nodes):
                continue
            mesh_index = nodes[child_index].get("mesh")
            if not isinstance(mesh_index, int) or not 0 <= mesh_index < len(meshes):
                continue
            for primitive in meshes[mesh_index].get("primitives", []):
                material_index = primitive.get("material")
                if not isinstance(material_index, int) or not 0 <= material_index < len(materials):
                    errors.append(
                        f"{asset_id}: {domain_name} has a primitive without an existing material"
                    )
                    continue
                actual_materials.append(materials[material_index].get("name"))
        if set(actual_materials) != expected_materials or len(actual_materials) != len(expected_materials):
            errors.append(
                f"{asset_id}: {domain_name} visible material domains changed from "
                f"{sorted(expected_materials)}"
            )

    material_names = {
        material.get("name")
        for material in materials
        if material.get("name")
    }
    if material_names != contract["materials"] or len(materials) != 7:
        errors.append(f"{asset_id}: seven-material player infrastructure semantics changed")
    if len(document.get("textures", [])) != contract["texture_count"]:
        errors.append(f"{asset_id}: player infrastructure texture count changed")
    if len(document.get("images", [])) != contract["texture_count"]:
        errors.append(f"{asset_id}: player infrastructure image count changed")
    if document.get("animations"):
        errors.append(f"{asset_id}: player infrastructure must remain code-driven, not clip-driven")

    primitive_count = sum(len(mesh.get("primitives", [])) for mesh in meshes)
    if primitive_count > contract["primitive_budget"]:
        errors.append(
            f"{asset_id}: {primitive_count} primitives exceed player-infrastructure budget "
            f"{contract['primitive_budget']}"
        )
    triangle_count = sum(
        accessors[primitive["indices"]].get("count", 0) // 3
        for mesh in meshes
        for primitive in mesh.get("primitives", [])
        if primitive.get("mode", 4) == 4
        and isinstance(primitive.get("indices"), int)
        and 0 <= primitive["indices"] < len(accessors)
    )
    if triangle_count > contract["triangle_budget"]:
        errors.append(
            f"{asset_id}: {triangle_count} triangles exceed player-infrastructure budget "
            f"{contract['triangle_budget']}"
        )

    presentation_roots = {
        "damage_visual_damaged",
        "damage_visual_critical",
        "ruin_visual_root",
    }

    def is_presentation_node(node_name: str) -> bool:
        current = node_name
        while current is not None:
            if current in presentation_roots:
                return True
            current = parents_by_child.get(current)
        return False

    healthy_primitives = []
    for node in nodes:
        node_name = node.get("name")
        mesh_index = node.get("mesh")
        if (
            not node_name
            or is_presentation_node(node_name)
            or not isinstance(mesh_index, int)
            or not 0 <= mesh_index < len(meshes)
        ):
            continue
        healthy_primitives.extend(meshes[mesh_index].get("primitives", []))
    healthy_primitive_count = len(healthy_primitives)
    healthy_triangle_count = sum(
        accessors[primitive["indices"]].get("count", 0) // 3
        for primitive in healthy_primitives
        if primitive.get("mode", 4) == 4
        and isinstance(primitive.get("indices"), int)
        and 0 <= primitive["indices"] < len(accessors)
    )
    if healthy_primitive_count > contract["healthy_primitive_budget"]:
        errors.append(
            f"{asset_id}: healthy presentation uses {healthy_primitive_count} primitives, "
            f"budget is {contract['healthy_primitive_budget']}"
        )
    if healthy_triangle_count > contract["healthy_triangle_budget"]:
        errors.append(
            f"{asset_id}: healthy presentation uses {healthy_triangle_count} triangles, "
            f"budget is {contract['healthy_triangle_budget']}"
        )
    return errors


def validate_enemy_support_weapon_contract(
    asset_id: str,
    document: dict,
    nodes_by_name: dict[str, dict],
    parents_by_child: dict[str, str],
) -> list[str]:
    """Freeze enemy suppressor/artillery weapon sockets without changing their art."""
    contract = ENEMY_SUPPORT_WEAPON_CONTRACTS.get(asset_id)
    if contract is None:
        return []

    errors: list[str] = []
    nodes = document.get("nodes", [])
    meshes = document.get("meshes", [])
    materials = document.get("materials", [])
    accessors = document.get("accessors", [])
    for name in sorted({contract["root"], *contract["nodes"]}):
        count = sum(node.get("name") == name for node in nodes)
        if count != 1:
            errors.append(f"{asset_id}: {name} must be unique, found {count}")

    root = nodes_by_name.get(contract["root"])
    if root is None:
        return errors
    if parents_by_child.get(contract["root"]) is not None:
        errors.append(f"{asset_id}: asset root unexpectedly gained a parent")
    if root.get("mesh") is not None or root.get("matrix") is not None:
        errors.append(f"{asset_id}: asset root must remain a meshless local-TRS node")
    if not translation_matches(root, (0.0, 0.0, 0.0)) or not is_identity_trs(root):
        errors.append(f"{asset_id}: asset root local TRS must remain identity")
    if (root.get("extras", {}) or {}) != contract["root_extras"]:
        errors.append(f"{asset_id}: asset root extras changed from {contract['root_extras']}")

    for node_name, node_contract in contract["nodes"].items():
        node = nodes_by_name.get(node_name)
        if node is None:
            continue
        if parents_by_child.get(node_name) != node_contract["parent"]:
            errors.append(
                f"{asset_id}: {node_name} parent changed from {node_contract['parent']}"
            )
        if not translation_matches(node, node_contract["translation"]):
            errors.append(
                f"{asset_id}: {node_name} translation changed from "
                f"{node_contract['translation']}"
            )
        if not rotation_matches(node, node_contract["rotation"]):
            errors.append(f"{asset_id}: {node_name} rotation changed")
        scale = node.get("scale", (1.0, 1.0, 1.0))
        try:
            scale_values = tuple(float(value) for value in scale)
        except (TypeError, ValueError):
            scale_values = ()
        if (
            not isinstance(scale, (list, tuple))
            or len(scale_values) != 3
            or any(not math.isfinite(value) for value in scale_values)
            or any(abs(value - 1.0) > 1e-4 for value in scale_values)
        ):
            errors.append(f"{asset_id}: {node_name} scale changed from identity")
        if node.get("mesh") is not None or node.get("matrix") is not None:
            errors.append(f"{asset_id}: {node_name} must remain a meshless local-TRS node")
        if (node.get("extras", {}) or {}) != node_contract["extras"]:
            errors.append(
                f"{asset_id}: {node_name} extras changed from {node_contract['extras']}"
            )

    if len(nodes) != contract["node_count"]:
        errors.append(
            f"{asset_id}: node count changed from {contract['node_count']} to {len(nodes)}"
        )
    primitives = [
        primitive
        for mesh in meshes
        for primitive in mesh.get("primitives", [])
    ]
    if len(primitives) != contract["primitive_count"]:
        errors.append(
            f"{asset_id}: primitive count changed from {contract['primitive_count']} "
            f"to {len(primitives)}"
        )
    triangle_count = sum(
        accessors[primitive["indices"]].get("count", 0) // 3
        for primitive in primitives
        if primitive.get("mode", 4) == 4
        and isinstance(primitive.get("indices"), int)
        and 0 <= primitive["indices"] < len(accessors)
    )
    if triangle_count != contract["triangle_count"]:
        errors.append(
            f"{asset_id}: triangle count changed from {contract['triangle_count']} "
            f"to {triangle_count}"
        )
    material_names = {
        material.get("name")
        for material in materials
        if material.get("name")
    }
    if (
        material_names != ENEMY_SUPPORT_WEAPON_MATERIALS
        or len(materials) != contract["material_count"]
    ):
        errors.append(f"{asset_id}: enemy support-weapon material semantics changed")
    if len(document.get("textures", [])) != contract["texture_count"]:
        errors.append(f"{asset_id}: enemy support-weapon texture count changed")
    if len(document.get("images", [])) != contract["texture_count"]:
        errors.append(f"{asset_id}: enemy support-weapon image count changed")
    if document.get("animations"):
        errors.append(f"{asset_id}: enemy support weapon unexpectedly gained authored animation")
    return errors


def validate_player_support_vehicle(
    asset_id: str,
    document: dict,
    nodes_by_name: dict[str, dict],
    parents_by_child: dict[str, str],
    *,
    byte_size: int | None = None,
) -> list[str]:
    """Lock player support-vehicle sockets, motion domains and desktop budgets."""
    contract = PLAYER_SUPPORT_VEHICLE_CONTRACTS.get(asset_id)
    if contract is None:
        return []

    errors: list[str] = []
    nodes = document.get("nodes", [])
    meshes = document.get("meshes", [])
    materials = document.get("materials", [])
    accessors = document.get("accessors", [])
    for name in sorted({contract["root"], *contract["nodes"]}):
        count = sum(node.get("name") == name for node in nodes)
        if count != 1:
            errors.append(f"{asset_id}: {name} must be unique, found {count}")

    root = nodes_by_name.get(contract["root"])
    if root is None:
        return errors
    if parents_by_child.get(contract["root"]) is not None:
        errors.append(f"{asset_id}: asset root unexpectedly gained a parent")
    if root.get("mesh") is not None or root.get("matrix") is not None:
        errors.append(f"{asset_id}: asset root must remain a meshless local-TRS node")
    if not translation_matches(root, (0.0, 0.0, 0.0)) or not is_identity_trs(root):
        errors.append(f"{asset_id}: asset root local TRS must remain identity")
    if (root.get("extras", {}) or {}) != contract["root_extras"]:
        errors.append(f"{asset_id}: asset root extras changed from gold contract")

    for node_name, node_contract in contract["nodes"].items():
        node = nodes_by_name.get(node_name)
        if node is None:
            continue
        if parents_by_child.get(node_name) != node_contract["parent"]:
            errors.append(
                f"{asset_id}: {node_name} parent changed from {node_contract['parent']}"
            )
        if not translation_matches(node, node_contract["translation"]):
            errors.append(
                f"{asset_id}: {node_name} translation changed from "
                f"{node_contract['translation']}"
            )
        if not rotation_matches(node, node_contract["rotation"]):
            errors.append(f"{asset_id}: {node_name} rotation changed")
        scale = node.get("scale", (1.0, 1.0, 1.0))
        try:
            scale_values = tuple(float(value) for value in scale)
        except (TypeError, ValueError):
            scale_values = ()
        if (
            not isinstance(scale, (list, tuple))
            or len(scale_values) != 3
            or any(not math.isfinite(value) for value in scale_values)
            or any(abs(value - 1.0) > 1e-4 for value in scale_values)
        ):
            errors.append(f"{asset_id}: {node_name} scale changed from identity")
        if node.get("mesh") is not None or node.get("matrix") is not None:
            errors.append(f"{asset_id}: {node_name} must remain a meshless local-TRS node")
        if (node.get("extras", {}) or {}) != node_contract["extras"]:
            errors.append(
                f"{asset_id}: {node_name} extras changed from {node_contract['extras']}"
            )

    for domain_name, expected_materials in contract["motion_domains"].items():
        domain = nodes_by_name.get(domain_name)
        if domain is None:
            continue
        actual_materials: list[str] = []
        for child_index in domain.get("children", []):
            if not isinstance(child_index, int) or not 0 <= child_index < len(nodes):
                continue
            mesh_index = nodes[child_index].get("mesh")
            if not isinstance(mesh_index, int) or not 0 <= mesh_index < len(meshes):
                continue
            for primitive in meshes[mesh_index].get("primitives", []):
                material_index = primitive.get("material")
                if not isinstance(material_index, int) or not 0 <= material_index < len(materials):
                    errors.append(
                        f"{asset_id}: {domain_name} has a primitive without an existing material"
                    )
                    continue
                actual_materials.append(materials[material_index].get("name"))
        if set(actual_materials) != expected_materials or len(actual_materials) != len(expected_materials):
            errors.append(
                f"{asset_id}: {domain_name} visible material domains changed from "
                f"{sorted(expected_materials)}"
            )

    material_names = {
        material.get("name")
        for material in materials
        if material.get("name")
    }
    if material_names != PLAYER_SUPPORT_VEHICLE_MATERIALS or len(materials) != 7:
        errors.append(f"{asset_id}: seven-material player support-vehicle semantics changed")
    if document.get("textures") or document.get("images"):
        errors.append(f"{asset_id}: player support vehicle unexpectedly added textures")
    if document.get("animations"):
        errors.append(f"{asset_id}: player support vehicle unexpectedly gained authored animation")

    if len(nodes) != contract["node_count"]:
        errors.append(
            f"{asset_id}: node count changed from {contract['node_count']} to {len(nodes)}"
        )
    primitives = [
        primitive
        for mesh in meshes
        for primitive in mesh.get("primitives", [])
    ]
    primitive_count = len(primitives)
    if primitive_count != contract["primitive_count"]:
        errors.append(
            f"{asset_id}: primitive count changed from {contract['primitive_count']} "
            f"to {primitive_count}"
        )
    if primitive_count > contract["primitive_budget"]:
        errors.append(
            f"{asset_id}: {primitive_count} primitives exceed player support-vehicle budget "
            f"{contract['primitive_budget']}"
        )
    triangle_count = sum(
        accessors[primitive["indices"]].get("count", 0) // 3
        for primitive in primitives
        if primitive.get("mode", 4) == 4
        and isinstance(primitive.get("indices"), int)
        and 0 <= primitive["indices"] < len(accessors)
    )
    if triangle_count != contract["triangle_count"]:
        errors.append(
            f"{asset_id}: triangle count changed from {contract['triangle_count']} "
            f"to {triangle_count}"
        )
    if triangle_count > contract["triangle_budget"]:
        errors.append(
            f"{asset_id}: {triangle_count} triangles exceed player support-vehicle budget "
            f"{contract['triangle_budget']}"
        )
    if byte_size is not None and byte_size > contract["byte_budget"]:
        errors.append(
            f"{asset_id}: {byte_size} bytes exceed player support-vehicle budget "
            f"{contract['byte_budget']}"
        )
    return errors


def validate_visual_gold_prop(
    asset_id: str,
    document: dict,
    nodes_by_name: dict[str, dict],
    parents_by_child: dict[str, str],
    *,
    byte_size: int | None = None,
) -> list[str]:
    prop_contract = VISUAL_GOLD_PROP_CONTRACTS.get(asset_id)
    if prop_contract is None:
        return []

    errors: list[str] = []
    root = nodes_by_name.get(prop_contract["root"], {})
    root_extras = root.get("extras", {})
    if root_extras.get("visual_gold_revision") != prop_contract["revision"]:
        errors.append(f"{asset_id}: missing visual-gold prop revision {prop_contract['revision']}")
    if root_extras.get("silhouette_profile") != prop_contract["profile"]:
        errors.append(f"{asset_id}: silhouette profile changed from {prop_contract['profile']}")
    for key, expected in prop_contract["root_extras"].items():
        if root_extras.get(key) != expected:
            errors.append(f"{asset_id}: root extra {key} changed from {expected}")
    if prop_contract.get("exact_root_extras") and root_extras != prop_contract["root_extras"]:
        errors.append(f"{asset_id}: root extras no longer match the preserved visual-gold contract")

    for node_name, expected_extras in prop_contract["node_extras"].items():
        actual_extras = nodes_by_name.get(node_name, {}).get("extras", {})
        for key, expected in expected_extras.items():
            if actual_extras.get(key) != expected:
                errors.append(f"{asset_id}: {node_name} extra {key} changed from {expected}")
    for node_name, expected_extras in prop_contract.get("exact_node_extras", {}).items():
        if nodes_by_name.get(node_name, {}).get("extras", {}) != expected_extras:
            errors.append(f"{asset_id}: {node_name} extras changed from the preserved contract")

    for node_name, expected in prop_contract["transforms"].items():
        if not translation_matches(nodes_by_name.get(node_name, {}), expected):
            errors.append(f"{asset_id}: {node_name} translation changed from {expected}")
    for node_name in prop_contract.get("identity_nodes", set()):
        if not is_identity_trs(nodes_by_name.get(node_name, {})):
            errors.append(f"{asset_id}: {node_name} rotation/scale changed from identity")
    for child_name, expected_parent in prop_contract["parents"].items():
        if parents_by_child.get(child_name) != expected_parent:
            errors.append(f"{asset_id}: {child_name} parent changed from {expected_parent}")

    material_names = {
        material.get("name")
        for material in document.get("materials", [])
        if material.get("name")
    }
    if material_names != prop_contract["materials"]:
        errors.append(f"{asset_id}: visual-gold material semantics changed")
    if document.get("images") or document.get("textures"):
        errors.append(f"{asset_id}: unexpectedly added runtime textures")
    if document.get("animations"):
        errors.append(f"{asset_id}: unexpectedly added authored animation clips")

    primitives = [
        primitive
        for mesh in document.get("meshes", [])
        for primitive in mesh.get("primitives", [])
    ]
    primitive_count = len(primitives)
    if primitive_count > prop_contract["primitive_budget"]:
        errors.append(
            f"{asset_id}: {primitive_count} primitives exceed visual-gold budget "
            f"{prop_contract['primitive_budget']}"
        )
    if prop_contract.get("require_material_merge"):
        material_domains = [primitive.get("material") for primitive in primitives]
        if len(material_domains) != len(set(material_domains)):
            errors.append(f"{asset_id}: runtime meshes are not statically merged by material")

    accessors = document.get("accessors", [])
    triangle_count = sum(
        accessors[primitive["indices"]].get("count", 0) // 3
        for primitive in primitives
        if primitive.get("mode", 4) == 4
        and isinstance(primitive.get("indices"), int)
        and 0 <= primitive["indices"] < len(accessors)
    )
    if triangle_count > prop_contract["triangle_budget"]:
        errors.append(
            f"{asset_id}: {triangle_count} triangles exceed visual-gold budget "
            f"{prop_contract['triangle_budget']}"
        )
    byte_budget = prop_contract.get("byte_budget")
    if byte_budget is not None and byte_size is not None and byte_size > byte_budget:
        errors.append(f"{asset_id}: {byte_size} bytes exceed visual-gold budget {byte_budget}")
    return errors


def validate(asset_id: str, required_nodes: set[str]) -> list[str]:
    path = MODEL_DIR / f"{asset_id}_v1.glb"
    document = read_glb_json(path)
    names = {node.get("name") for node in document.get("nodes", []) if node.get("name")}
    missing = sorted(required_nodes - names)
    errors = [f"{asset_id}: missing node {name}" for name in missing]
    nodes_by_name = {
        node.get("name"): node
        for node in document.get("nodes", [])
        if node.get("name")
    }
    parents_by_child = parent_names_by_child(document)
    errors.extend(validate_semantic_sockets(asset_id, nodes_by_name, parents_by_child))
    errors.extend(validate_vehicle_wreck(asset_id, document, nodes_by_name, parents_by_child))
    errors.extend(validate_building_damage(asset_id, document, nodes_by_name, parents_by_child))
    errors.extend(validate_building_ruin(asset_id, document, nodes_by_name, parents_by_child))
    errors.extend(validate_enemy_strategic_building(asset_id, document, nodes_by_name, parents_by_child))
    errors.extend(validate_player_infrastructure(asset_id, document, nodes_by_name, parents_by_child))
    errors.extend(validate_enemy_support_weapon_contract(asset_id, document, nodes_by_name, parents_by_child))
    errors.extend(validate_player_support_vehicle(
        asset_id,
        document,
        nodes_by_name,
        parents_by_child,
        byte_size=path.stat().st_size,
    ))
    errors.extend(validate_visual_gold_prop(
        asset_id,
        document,
        nodes_by_name,
        parents_by_child,
        byte_size=path.stat().st_size,
    ))
    for name in sorted(PRESENTATION_CHILD_CONTRACTS.get(asset_id, set())):
        node = nodes_by_name.get(name)
        if node is not None and not node.get("children"):
            errors.append(f"{asset_id}: presentation node {name} has no visible child")
    animation_names = {
        animation.get("name")
        for animation in document.get("animations", [])
        if animation.get("name")
    }
    missing_animations = sorted(ANIMATION_CONTRACTS.get(asset_id, set()) - animation_names)
    errors.extend(f"{asset_id}: missing animation {name}" for name in missing_animations)
    silhouette_contract = INFANTRY_SILHOUETTE_CONTRACTS.get(asset_id)
    if silhouette_contract is not None:
        root_name, expected_profile = silhouette_contract
        root = nodes_by_name.get(root_name, {})
        extras = root.get("extras", {})
        if extras.get("silhouette_revision") != "strategic-infantry-v2":
            errors.append(f"{asset_id}: missing strategic infantry silhouette revision")
        if extras.get("silhouette_profile") != expected_profile:
            errors.append(f"{asset_id}: silhouette profile is not {expected_profile}")
        if extras.get("readability_feature_scale_m") != "0.35-0.60":
            errors.append(f"{asset_id}: readability feature scale is not 0.35-0.60m")
        markers = [marker for marker in str(extras.get("silhouette_markers", "")).split(",") if marker]
        if len(markers) < 3:
            errors.append(f"{asset_id}: fewer than three silhouette markers")
        material_budget = int(extras.get("material_budget", 0))
        if material_budget != 6 or len(document.get("materials", [])) > material_budget:
            errors.append(f"{asset_id}: exceeds or omits the six-material infantry budget")
        if len(document.get("skins", [])) != 1:
            errors.append(f"{asset_id}: expected exactly one shared squad skin")
    static_contract = STATIC_PRIMITIVE_CONTRACTS.get(asset_id)
    if static_contract is not None:
        root_name, primitive_budget, expected_materials = static_contract
        root = nodes_by_name.get(root_name, {})
        extras = root.get("extras", {})
        primitive_count = sum(
            len(mesh.get("primitives", []))
            for mesh in document.get("meshes", [])
        )
        if primitive_count > primitive_budget:
            errors.append(f"{asset_id}: {primitive_count} primitives exceed budget {primitive_budget}")
        if int(extras.get("runtime_primitive_budget", 0)) != primitive_budget:
            errors.append(f"{asset_id}: missing runtime primitive budget metadata")
        material_names = {
            material.get("name")
            for material in document.get("materials", [])
            if material.get("name")
        }
        if material_names != expected_materials:
            errors.append(f"{asset_id}: static material semantics changed")
        if int(extras.get("runtime_material_budget", 0)) != len(expected_materials):
            errors.append(f"{asset_id}: missing runtime material budget metadata")
    gold_building_contract = GOLD_BUILDING_CONTRACTS.get(asset_id)
    if gold_building_contract is not None:
        (
            root_name,
            profile,
            footprint,
            entrance_depth,
            primitive_budget,
            triangle_budget,
            expected_materials,
        ) = gold_building_contract
        root = nodes_by_name.get(root_name, {})
        extras = root.get("extras", {})
        if extras.get("visual_gold_revision") != "desktop-building-gold-v2":
            errors.append(f"{asset_id}: missing desktop building visual-gold revision")
        if extras.get("silhouette_profile") != profile:
            errors.append(f"{asset_id}: silhouette profile is not {profile}")
        if extras.get("footprint_m") != footprint:
            errors.append(f"{asset_id}: footprint metadata is not {footprint}")
        if extras.get("entrance_depth_m") != entrance_depth:
            errors.append(f"{asset_id}: entrance depth metadata is not {entrance_depth}m")
        if extras.get("surface_feature_scale_m") != "0.35-1.20":
            errors.append(f"{asset_id}: surface feature scale is not 0.35-1.20m")
        if extras.get("surface_treatment") != "panel-breakup,bevel-highlight,service-access,controlled-wear":
            errors.append(f"{asset_id}: surface treatment metadata changed")
        if extras.get("wear_source") != "shared-authored-pbr":
            errors.append(f"{asset_id}: controlled wear is not sourced from shared authored PBR")
        if extras.get("wear_localization") != "base,entry,vent,service":
            errors.append(f"{asset_id}: controlled wear is not localized to functional zones")
        material_budget = int(extras.get("material_budget", 0))
        if material_budget != 8 or len(document.get("materials", [])) > material_budget:
            errors.append(f"{asset_id}: exceeds or omits the eight-material building budget")
        if len(document.get("materials", [])) != expected_materials:
            errors.append(f"{asset_id}: material-slot count changed from {expected_materials}")
        primitive_count = sum(len(mesh.get("primitives", [])) for mesh in document.get("meshes", []))
        if int(extras.get("runtime_primitive_budget", 0)) != primitive_budget:
            errors.append(f"{asset_id}: missing runtime primitive budget {primitive_budget}")
        if primitive_count > primitive_budget:
            errors.append(f"{asset_id}: {primitive_count} primitives exceed gold-building budget {primitive_budget}")
        accessors = document.get("accessors", [])
        triangle_count = sum(
            accessors[primitive["indices"]].get("count", 0) // 3
            for mesh in document.get("meshes", [])
            for primitive in mesh.get("primitives", [])
            if primitive.get("mode", 4) == 4
            and isinstance(primitive.get("indices"), int)
            and 0 <= primitive["indices"] < len(accessors)
        )
        if triangle_count > triangle_budget:
            errors.append(f"{asset_id}: {triangle_count} triangles exceed gold-building budget {triangle_budget}")
    refinery_contract = REFINERY_MECHANISM_CONTRACTS.get(asset_id)
    if refinery_contract is not None:
        root = nodes_by_name.get(refinery_contract["root"], {})
        extras = root.get("extras", {})
        expected_root_extras = {
            "asset_id": asset_id,
            "provenance": "project_procedural_blender",
            "asset_revision": "refinery-unload-mechanism-v2",
            "render_profile": "strategic-camera-standard",
            "footprint_m": "11.4x9.4",
            "unload_mechanism": "intake_gate,intake_conveyor,intake_collector",
            "intake_gate_travel_m": 1.45,
            "conveyor_travel_m": 0.45,
            "collector_spin_axis": "X",
            "runtime_primitive_budget": refinery_contract["primitive_budget"],
            "runtime_triangle_budget": refinery_contract["triangle_budget"],
            "runtime_material_budget": 6,
        }
        for key, expected in expected_root_extras.items():
            if extras.get(key) != expected:
                errors.append(f"{asset_id}: refinery mechanism root extra {key} changed from {expected}")

        expected_node_extras = {
            "intake_gate": {
                "presentation_role": "deposit_gate",
                "motion_axis": "+Y",
                "travel_m": 1.45,
            },
            "intake_conveyor": {
                "presentation_role": "deposit_conveyor",
                "motion_axis": "-Z",
                "travel_m": 0.45,
            },
            "intake_collector": {
                "presentation_role": "deposit_collector",
                "spin_axis": "X",
                "spin_speed": 5.2,
            },
        }
        for node_name, expected_extras in expected_node_extras.items():
            actual_extras = nodes_by_name.get(node_name, {}).get("extras", {})
            for key, expected in expected_extras.items():
                if actual_extras.get(key) != expected:
                    errors.append(f"{asset_id}: {node_name} extra {key} changed from {expected}")

        material_names = {
            material.get("name")
            for material in document.get("materials", [])
            if material.get("name")
        }
        if material_names != refinery_contract["materials"]:
            errors.append(f"{asset_id}: refinery mechanism material semantics changed")
        if document.get("animations"):
            errors.append(f"{asset_id}: refinery mechanisms must remain code-driven, not clip-driven")
        primitive_count = sum(len(mesh.get("primitives", [])) for mesh in document.get("meshes", []))
        if primitive_count > refinery_contract["primitive_budget"]:
            errors.append(
                f"{asset_id}: {primitive_count} primitives exceed refinery mechanism budget "
                f"{refinery_contract['primitive_budget']}"
            )
        accessors = document.get("accessors", [])
        triangle_count = sum(
            accessors[primitive["indices"]].get("count", 0) // 3
            for mesh in document.get("meshes", [])
            for primitive in mesh.get("primitives", [])
            if primitive.get("mode", 4) == 4
            and isinstance(primitive.get("indices"), int)
            and 0 <= primitive["indices"] < len(accessors)
        )
        if triangle_count > refinery_contract["triangle_budget"]:
            errors.append(
                f"{asset_id}: {triangle_count} triangles exceed refinery mechanism budget "
                f"{refinery_contract['triangle_budget']}"
            )
    if REQUIRE_KTX2 and document.get("images"):
        extensions = set(document.get("extensionsRequired", []))
        if "KHR_texture_basisu" not in extensions:
            errors.append(f"{asset_id}: textured asset does not require KHR_texture_basisu")
        for index, image in enumerate(document.get("images", [])):
            if image.get("mimeType") != "image/ktx2":
                errors.append(f"{asset_id}: image {index} is not image/ktx2")
    return errors


def main() -> int:
    errors: list[str] = []
    for asset_id, required_nodes in CONTRACTS.items():
        try:
            errors.extend(validate(asset_id, required_nodes))
        except (OSError, ValueError, json.JSONDecodeError) as error:
            errors.append(f"{asset_id}: {error}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Validated {len(CONTRACTS)} GLB asset contracts.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
