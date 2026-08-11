from __future__ import annotations

import copy
import sys
import unittest


# Keep validate_glb_contracts from interpreting the unittest path as MODEL_DIR.
sys.argv = [sys.argv[0]]

import validate_glb_contracts as contracts


class SemanticSocketContractTests(unittest.TestCase):
    def load_contract_nodes(self, asset_id: str) -> tuple[dict[str, dict], dict[str, str]]:
        document = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / f"{asset_id}_v1.glb"
        )
        nodes_by_name = {
            node["name"]: node
            for node in document.get("nodes", [])
            if node.get("name")
        }
        return nodes_by_name, contracts.parent_names_by_child(document)

    def test_all_economy_and_production_socket_contracts_match_published_assets(self) -> None:
        for asset_id in contracts.SEMANTIC_SOCKET_CONTRACTS:
            with self.subTest(asset_id=asset_id):
                nodes, parents = self.load_contract_nodes(asset_id)
                self.assertEqual([], contracts.validate_semantic_sockets(asset_id, nodes, parents))

    def test_axis_flip_and_role_drift_are_rejected(self) -> None:
        nodes, parents = self.load_contract_nodes("ff_fac_01")
        mutated_nodes = copy.deepcopy(nodes)
        mutated_nodes["production_socket"]["translation"][2] *= -1
        mutated_nodes["production_socket"]["extras"]["socket_role"] = "decorative_marker"

        errors = contracts.validate_semantic_sockets("ff_fac_01", mutated_nodes, parents)

        self.assertTrue(any("socket_role changed" in error for error in errors))
        self.assertTrue(any("local translation" in error for error in errors))

    def test_parent_drift_and_non_identity_rotation_are_rejected(self) -> None:
        nodes, parents = self.load_contract_nodes("ff_en_hrv_01")
        mutated_nodes = copy.deepcopy(nodes)
        mutated_parents = dict(parents)
        mutated_parents["resource_socket"] = "chassis_root"
        mutated_nodes["resource_socket"]["rotation"] = [0.0, 0.7071068, 0.0, 0.7071068]

        errors = contracts.validate_semantic_sockets("ff_en_hrv_01", mutated_nodes, mutated_parents)

        self.assertTrue(any("parent changed" in error for error in errors))
        self.assertTrue(any("rotation/scale" in error for error in errors))

    def test_refinery_presentation_role_parent_and_axis_drift_are_rejected(self) -> None:
        player_nodes, player_parents = self.load_contract_nodes("ff_ref_01")
        mutated_player_nodes = copy.deepcopy(player_nodes)
        mutated_player_nodes["intake_gate"]["extras"]["presentation_role"] = "decorative_gate"
        mutated_player_nodes["intake_conveyor"]["rotation"] = [0.0, 0.7071068, 0.0, 0.7071068]

        player_errors = contracts.validate_semantic_sockets(
            "ff_ref_01",
            mutated_player_nodes,
            player_parents,
        )

        self.assertTrue(any("presentation_role changed" in error for error in player_errors))
        self.assertTrue(any("rotation/scale" in error for error in player_errors))

        enemy_nodes, enemy_parents = self.load_contract_nodes("ff_en_ref_01")
        mutated_enemy_parents = dict(enemy_parents)
        mutated_enemy_parents["intake_collector"] = "building_root"

        enemy_errors = contracts.validate_semantic_sockets(
            "ff_en_ref_01",
            enemy_nodes,
            mutated_enemy_parents,
        )

        self.assertTrue(any("intake_collector parent changed" in error for error in enemy_errors))

    def test_all_vehicle_wreck_contracts_match_published_assets(self) -> None:
        for asset_id in contracts.VEHICLE_WRECK_CONTRACTS:
            with self.subTest(asset_id=asset_id):
                document = contracts.read_glb_json(
                    contracts.PROJECT_ROOT / "public" / "assets" / "models" / f"{asset_id}_v1.glb"
                )
                nodes = {
                    node["name"]: node
                    for node in document.get("nodes", [])
                    if node.get("name")
                }
                parents = contracts.parent_names_by_child(document)
                self.assertEqual([], contracts.validate_vehicle_wreck(asset_id, document, nodes, parents))

    def test_wreck_role_visibility_parent_and_budget_mutations_are_rejected(self) -> None:
        document = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_mbt_01_v1.glb"
        )
        nodes = {
            node["name"]: node
            for node in document.get("nodes", [])
            if node.get("name")
        }
        parents = contracts.parent_names_by_child(document)
        mutated = copy.deepcopy(document)
        mutated_nodes = {
            node["name"]: node
            for node in mutated.get("nodes", [])
            if node.get("name")
        }
        mutated_nodes["wreck_visual_root"]["extras"]["presentation_role"] = "generic_debris"
        mutated_nodes["wreck_visual_root"]["extras"]["default_visible"] = True
        mutated_nodes["wreck_visual_root"]["translation"] = [1.0, 0.0, 0.0]
        mutated_parents = dict(parents)
        mutated_parents["wreck_visual_root"] = "chassis_root"
        part = mutated_nodes["wreck_chassis"]
        mesh = mutated["meshes"][part["mesh"]]
        mesh["primitives"] = mesh["primitives"] * 4

        errors = contracts.validate_vehicle_wreck(
            "ff_mbt_01", mutated, mutated_nodes, mutated_parents
        )

        self.assertTrue(any("presentation_role changed" in error for error in errors))
        self.assertTrue(any("default_visible changed" in error for error in errors))
        self.assertTrue(any("local TRS" in error for error in errors))
        self.assertTrue(any("parent changed" in error for error in errors))
        self.assertTrue(any("primitives" in error for error in errors))

    def test_all_building_damage_contracts_match_published_assets(self) -> None:
        for asset_id in contracts.BUILDING_DAMAGE_CONTRACTS:
            with self.subTest(asset_id=asset_id):
                document = contracts.read_glb_json(
                    contracts.PROJECT_ROOT / "public" / "assets" / "models" / f"{asset_id}_v1.glb"
                )
                nodes = {
                    node["name"]: node
                    for node in document.get("nodes", [])
                    if node.get("name")
                }
                parents = contracts.parent_names_by_child(document)
                self.assertEqual(
                    [],
                    contracts.validate_building_damage(asset_id, document, nodes, parents),
                )

    def test_building_damage_role_visibility_parent_budget_and_socket_mutations_are_rejected(self) -> None:
        document = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_fac_01_v1.glb"
        )
        mutated = copy.deepcopy(document)
        nodes = {
            node["name"]: node
            for node in mutated.get("nodes", [])
            if node.get("name")
        }
        parents = contracts.parent_names_by_child(mutated)
        nodes["damage_visual_damaged"]["extras"]["presentation_role"] = "generic_damage"
        nodes["damage_visual_damaged"]["extras"]["default_visible"] = True
        nodes["damage_visual_damaged"]["translation"] = [0.5, 0.0, 0.0]
        mutated_parents = dict(parents)
        mutated_parents["damage_visual_damaged"] = "FF_FAC_01"
        nodes["production_socket"]["translation"][2] *= -1
        part = nodes["damage_damaged_breach"]
        mesh = mutated["meshes"][part["mesh"]]
        mesh["primitives"] = mesh["primitives"] * 4
        mutated["materials"].append(copy.deepcopy(mutated["materials"][0]))

        errors = contracts.validate_building_damage(
            "ff_fac_01",
            mutated,
            nodes,
            mutated_parents,
        )

        self.assertTrue(any("presentation_role changed" in error for error in errors))
        self.assertTrue(any("default_visible changed" in error for error in errors))
        self.assertTrue(any("local TRS" in error for error in errors))
        self.assertTrue(any("parent changed" in error for error in errors))
        self.assertTrue(any("production_socket translation changed" in error for error in errors))
        self.assertTrue(any("primitives" in error for error in errors))
        self.assertTrue(any("material count" in error for error in errors))

    def test_all_building_ruin_contracts_match_published_assets(self) -> None:
        for asset_id in contracts.BUILDING_RUIN_CONTRACTS:
            with self.subTest(asset_id=asset_id):
                document = contracts.read_glb_json(
                    contracts.PROJECT_ROOT / "public" / "assets" / "models" / f"{asset_id}_v1.glb"
                )
                nodes = {
                    node["name"]: node
                    for node in document.get("nodes", [])
                    if node.get("name")
                }
                parents = contracts.parent_names_by_child(document)
                self.assertEqual(
                    [],
                    contracts.validate_building_ruin(asset_id, document, nodes, parents),
                )

    def test_building_ruin_role_marker_parent_transform_and_budget_mutations_are_rejected(self) -> None:
        document = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_fac_01_v1.glb"
        )
        mutated = copy.deepcopy(document)
        nodes = {
            node["name"]: node
            for node in mutated.get("nodes", [])
            if node.get("name")
        }
        mutated_parents = contracts.parent_names_by_child(mutated)

        nodes["FF_FAC_01"]["extras"]["ruin_triangle_budget"] = 900
        nodes["ruin_visual_root"]["extras"]["presentation_role"] = "generic_debris"
        nodes["ruin_visual_root"]["extras"]["default_visible"] = True
        nodes["ruin_visual_root"]["translation"] = [0.5, 0.0, 0.0]
        mutated_parents["ruin_visual_root"] = "FF_FAC_01"
        nodes["ruin_marker_anchor"]["extras"]["socket_role"] = "selection_ground"
        nodes["ruin_marker_anchor"]["translation"] = [0.0, 0.2, 0.0]
        nodes["ruin_marker_anchor"]["rotation"] = [0.0, 0.7071068, 0.0, 0.7071068]
        mutated_parents["ruin_marker_anchor"] = "building_root"
        mutated["nodes"].append(copy.deepcopy(nodes["ruin_marker_anchor"]))

        part = nodes["ruin_foundation"]
        mesh = mutated["meshes"][part["mesh"]]
        mesh["primitives"] = mesh["primitives"] * 2
        index_accessor = mesh["primitives"][0]["indices"]
        mutated["accessors"][index_accessor]["count"] = 6000
        mutated["materials"].append(copy.deepcopy(mutated["materials"][0]))

        errors = contracts.validate_building_ruin(
            "ff_fac_01",
            mutated,
            nodes,
            mutated_parents,
        )

        self.assertTrue(any("ruin_triangle_budget changed" in error for error in errors))
        self.assertTrue(any("ruin_marker_anchor must be unique" in error for error in errors))
        self.assertTrue(any("presentation_role changed" in error for error in errors))
        self.assertTrue(any("default_visible changed" in error for error in errors))
        self.assertTrue(any("ruin_visual_root local TRS" in error for error in errors))
        self.assertTrue(any("ruin_visual_root parent changed" in error for error in errors))
        self.assertTrue(any("socket_role changed" in error for error in errors))
        self.assertTrue(any("low-faction-marker bounds" in error for error in errors))
        self.assertTrue(any("rotation/scale" in error for error in errors))
        self.assertTrue(any("ruin_marker_anchor parent changed" in error for error in errors))
        self.assertTrue(any("independent primitive" in error for error in errors))
        self.assertTrue(any("budget is 1500" in error for error in errors))
        self.assertTrue(any("material count" in error for error in errors))

    def test_all_enemy_strategic_building_contracts_match_published_assets(self) -> None:
        for asset_id in contracts.ENEMY_STRATEGIC_BUILDING_CONTRACTS:
            with self.subTest(asset_id=asset_id):
                document = contracts.read_glb_json(
                    contracts.PROJECT_ROOT / "public" / "assets" / "models" / f"{asset_id}_v1.glb"
                )
                nodes = {
                    node["name"]: node
                    for node in document.get("nodes", [])
                    if node.get("name")
                }
                parents = contracts.parent_names_by_child(document)
                self.assertEqual(
                    [],
                    contracts.validate_enemy_strategic_building(
                        asset_id,
                        document,
                        nodes,
                        parents,
                    ),
                )

    def test_enemy_cannon_socket_motion_domain_material_and_budget_mutations_are_rejected(self) -> None:
        document = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_en_can_01_v1.glb"
        )
        mutated = copy.deepcopy(document)
        nodes = {
            node["name"]: node
            for node in mutated.get("nodes", [])
            if node.get("name")
        }
        mutated_parents = contracts.parent_names_by_child(mutated)

        nodes["FF_EN_CAN_01"]["extras"]["runtime_primitive_budget"] = 9
        nodes["turret_yaw"]["translation"] = [0.5, 2.65, 0.0]
        nodes["barrel_pitch"]["rotation"] = [0.0, 0.0, 0.0, 1.0]
        nodes["muzzle_socket"]["extras"]["socket_role"] = "decorative_tip"
        mutated_parents["damage_socket_roof"] = "FF_EN_CAN_01"

        barrel_mesh_name = "barrel_pitch_M_EnemyGunmetal_runtime"
        barrel_mesh_index = next(
            index
            for index, node in enumerate(mutated["nodes"])
            if node.get("name") == barrel_mesh_name
        )
        nodes["barrel_pitch"]["children"].remove(barrel_mesh_index)
        nodes["turret_yaw"]["children"].append(barrel_mesh_index)
        mesh = mutated["meshes"][nodes[barrel_mesh_name]["mesh"]]
        mesh["primitives"] = mesh["primitives"] * 2
        index_accessor = mesh["primitives"][0]["indices"]
        mutated["accessors"][index_accessor]["count"] = 6000
        mutated["materials"].append(copy.deepcopy(mutated["materials"][0]))
        mutated["textures"] = [{}]
        mutated["images"] = [{}]

        errors = contracts.validate_enemy_strategic_building(
            "ff_en_can_01",
            mutated,
            nodes,
            mutated_parents,
        )

        self.assertTrue(any("runtime_primitive_budget changed" in error for error in errors))
        self.assertTrue(any("turret_yaw translation changed" in error for error in errors))
        self.assertTrue(any("barrel_pitch rotation changed" in error for error in errors))
        self.assertTrue(any("muzzle_socket extras changed" in error for error in errors))
        self.assertTrue(any("damage_socket_roof parent changed" in error for error in errors))
        self.assertTrue(any("barrel_pitch visible material domains changed" in error for error in errors))
        self.assertTrue(any("turret_yaw visible material domains changed" in error for error in errors))
        self.assertTrue(any("six-material" in error for error in errors))
        self.assertTrue(any("unexpectedly added textures" in error for error in errors))
        self.assertTrue(any("primitives exceed" in error for error in errors))
        self.assertTrue(any("triangles exceed" in error for error in errors))

    def test_enemy_infrastructure_semantics_hidden_stages_and_healthy_budget_mutations_are_rejected(self) -> None:
        barracks = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_en_bar_01_v1.glb"
        )
        mutated_bar = copy.deepcopy(barracks)
        bar_nodes = {
            node["name"]: node
            for node in mutated_bar.get("nodes", [])
            if node.get("name")
        }
        bar_parents = contracts.parent_names_by_child(mutated_bar)
        bar_nodes["FF_EN_BAR_01"]["extras"]["healthy_runtime_primitive_budget"] = 9
        bar_nodes["barracks_door"]["translation"] = [0.0, 0.0, 1.0]
        bar_nodes["infantry_spawn"]["extras"]["socket_role"] = "decorative_spawn"
        bar_parents["rally_socket"] = "building_root"
        bar_nodes["damage_visual_critical"]["extras"]["default_visible"] = True
        healthy_mesh_node = next(
            node
            for name, node in bar_nodes.items()
            if name.startswith("FF_EN_BAR_01_") and isinstance(node.get("mesh"), int)
        )
        healthy_mesh = mutated_bar["meshes"][healthy_mesh_node["mesh"]]
        healthy_mesh["primitives"] = healthy_mesh["primitives"] * 2
        healthy_index_accessor = healthy_mesh["primitives"][0]["indices"]
        mutated_bar["accessors"][healthy_index_accessor]["count"] = 9000

        bar_errors = contracts.validate_enemy_strategic_building(
            "ff_en_bar_01",
            mutated_bar,
            bar_nodes,
            bar_parents,
        )
        bar_errors.extend(
            contracts.validate_building_damage(
                "ff_en_bar_01",
                mutated_bar,
                bar_nodes,
                bar_parents,
            )
        )

        self.assertTrue(any("healthy_runtime_primitive_budget changed" in error for error in bar_errors))
        self.assertTrue(any("barracks_door translation changed" in error for error in bar_errors))
        self.assertTrue(any("infantry_spawn extras changed" in error for error in bar_errors))
        self.assertTrue(any("rally_socket parent changed" in error for error in bar_errors))
        self.assertTrue(any("default_visible changed" in error for error in bar_errors))
        self.assertTrue(any("healthy presentation uses" in error for error in bar_errors))

        reactor = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_en_rct_01_v1.glb"
        )
        mutated_reactor = copy.deepcopy(reactor)
        reactor_nodes = {
            node["name"]: node
            for node in mutated_reactor.get("nodes", [])
            if node.get("name")
        }
        reactor_parents = contracts.parent_names_by_child(mutated_reactor)
        reactor_nodes["reactor_ring"]["extras"]["spin_speed"] = 0.5
        reactor_parents["reactor_core"] = "FF_EN_RCT_01"
        reactor_nodes["power_socket"]["translation"][2] *= -1
        mutated_reactor["materials"].append(copy.deepcopy(mutated_reactor["materials"][0]))
        mutated_reactor["textures"] = [{}]
        mutated_reactor["images"] = [{}]

        reactor_errors = contracts.validate_enemy_strategic_building(
            "ff_en_rct_01",
            mutated_reactor,
            reactor_nodes,
            reactor_parents,
        )

        self.assertTrue(any("reactor_ring extras changed" in error for error in reactor_errors))
        self.assertTrue(any("reactor_core parent changed" in error for error in reactor_errors))
        self.assertTrue(any("power_socket translation changed" in error for error in reactor_errors))
        self.assertTrue(any("six-material" in error for error in reactor_errors))
        self.assertTrue(any("unexpectedly added textures" in error for error in reactor_errors))

    def test_all_player_infrastructure_contracts_match_published_assets(self) -> None:
        for asset_id in contracts.PLAYER_INFRASTRUCTURE_CONTRACTS:
            with self.subTest(asset_id=asset_id):
                document = contracts.read_glb_json(
                    contracts.PROJECT_ROOT / "public" / "assets" / "models" / f"{asset_id}_v1.glb"
                )
                nodes = {
                    node["name"]: node
                    for node in document.get("nodes", [])
                    if node.get("name")
                }
                parents = contracts.parent_names_by_child(document)
                self.assertEqual(
                    [],
                    contracts.validate_player_infrastructure(
                        asset_id,
                        document,
                        nodes,
                        parents,
                    ),
                )

    def test_player_infrastructure_semantic_domain_material_texture_and_budget_mutations_are_rejected(self) -> None:
        barracks = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_bar_01_v1.glb"
        )
        mutated_bar = copy.deepcopy(barracks)
        bar_nodes = {
            node["name"]: node
            for node in mutated_bar.get("nodes", [])
            if node.get("name")
        }
        bar_parents = contracts.parent_names_by_child(mutated_bar)
        bar_nodes["FF_BAR_01"]["extras"]["door_travel_m"] = 1.0
        bar_nodes["barracks_door"]["translation"] = [0.0, 0.25, 0.0]
        bar_nodes["infantry_spawn"]["translation"][2] *= -1
        bar_nodes["rally_socket"]["extras"]["socket_role"] = "decorative_rally"

        signal_mesh_name = "powered_barracks_signal_M_CyanSignal_runtime"
        signal_mesh_index = next(
            index
            for index, node in enumerate(mutated_bar["nodes"])
            if node.get("name") == signal_mesh_name
        )
        bar_nodes["powered_barracks_signal"]["children"].remove(signal_mesh_index)
        bar_nodes["barracks_door"]["children"].append(signal_mesh_index)
        bar_nodes["FF_BAR_01"]["extras"]["healthy_runtime_primitive_budget"] = 10
        healthy_mesh_node = next(
            node
            for name, node in bar_nodes.items()
            if name.startswith("FF_BAR_01_") and isinstance(node.get("mesh"), int)
        )
        healthy_mesh = mutated_bar["meshes"][healthy_mesh_node["mesh"]]
        healthy_mesh["primitives"] = healthy_mesh["primitives"] * 4
        healthy_index_accessor = healthy_mesh["primitives"][0]["indices"]
        mutated_bar["accessors"][healthy_index_accessor]["count"] = 24_000
        mutated_bar["materials"][0]["name"] = "M_UnapprovedPlayerMaterial"
        mutated_bar["textures"].pop()
        mutated_bar["images"].pop()

        bar_errors = contracts.validate_player_infrastructure(
            "ff_bar_01",
            mutated_bar,
            bar_nodes,
            bar_parents,
        )
        self.assertTrue(any("door_travel_m changed" in error for error in bar_errors))
        self.assertTrue(any("barracks_door translation changed" in error for error in bar_errors))
        self.assertTrue(any("infantry_spawn translation changed" in error for error in bar_errors))
        self.assertTrue(any("rally_socket extras changed" in error for error in bar_errors))
        self.assertTrue(any("powered_barracks_signal visible material domains changed" in error for error in bar_errors))
        self.assertTrue(any("barracks_door visible material domains changed" in error for error in bar_errors))
        self.assertTrue(any("healthy_runtime_primitive_budget changed" in error for error in bar_errors))
        self.assertTrue(any("seven-material" in error for error in bar_errors))
        self.assertTrue(any("texture count changed" in error for error in bar_errors))
        self.assertTrue(any("image count changed" in error for error in bar_errors))
        self.assertTrue(any("healthy presentation uses" in error for error in bar_errors))
        self.assertTrue(any("triangles exceed" in error for error in bar_errors))

        reactor = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_rct_01_v1.glb"
        )
        mutated_reactor = copy.deepcopy(reactor)
        reactor_nodes = {
            node["name"]: node
            for node in mutated_reactor.get("nodes", [])
            if node.get("name")
        }
        reactor_parents = contracts.parent_names_by_child(mutated_reactor)
        reactor_nodes["reactor_ring"]["extras"]["spin_speed"] = 0.5
        reactor_nodes["reactor_core"]["translation"] = [0.0, 1.9, 0.0]
        reactor_nodes["power_socket"]["translation"][2] *= -1
        reactor_parents["powered_reactor_core"] = "building_root"

        reactor_errors = contracts.validate_player_infrastructure(
            "ff_rct_01",
            mutated_reactor,
            reactor_nodes,
            reactor_parents,
        )
        self.assertTrue(any("reactor_ring extras changed" in error for error in reactor_errors))
        self.assertTrue(any("reactor_core translation changed" in error for error in reactor_errors))
        self.assertTrue(any("power_socket translation changed" in error for error in reactor_errors))
        self.assertTrue(any("powered_reactor_core parent changed" in error for error in reactor_errors))

    def test_all_enemy_support_weapon_contracts_match_published_assets(self) -> None:
        for asset_id in contracts.ENEMY_SUPPORT_WEAPON_CONTRACTS:
            with self.subTest(asset_id=asset_id):
                document = contracts.read_glb_json(
                    contracts.PROJECT_ROOT / "public" / "assets" / "models" / f"{asset_id}_v1.glb"
                )
                nodes = {
                    node["name"]: node
                    for node in document.get("nodes", [])
                    if node.get("name")
                }
                parents = contracts.parent_names_by_child(document)
                self.assertEqual(
                    [],
                    contracts.validate_enemy_support_weapon_contract(
                        asset_id,
                        document,
                        nodes,
                        parents,
                    ),
                )

    def test_enemy_support_weapon_parent_role_trs_and_resource_mutations_are_rejected(self) -> None:
        suppressor = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_en_sup_01_v1.glb"
        )
        mutated_sup = copy.deepcopy(suppressor)
        sup_nodes = {
            node["name"]: node
            for node in mutated_sup.get("nodes", [])
            if node.get("name")
        }
        sup_parents = contracts.parent_names_by_child(mutated_sup)
        sup_parents["muzzle_socket_left"] = "chassis_root"
        sup_nodes["muzzle_socket_left"]["translation"] = [-0.42, 0.57, -2.78]
        sup_nodes["muzzle_socket_right"]["extras"]["socket_role"] = "decorative_tip"
        sup_nodes["turret_yaw"]["rotation"] = [0.0, 0.7071068, 0.0, 0.7071068]
        sup_nodes["FF_EN_SUP_01"]["extras"]["asset_role"] = "generic_vehicle"
        mutated_sup["nodes"].append(copy.deepcopy(sup_nodes["selection_anchor"]))
        sup_mesh = mutated_sup["meshes"][0]
        sup_mesh["primitives"] = sup_mesh["primitives"] * 2
        sup_index_accessor = sup_mesh["primitives"][0]["indices"]
        mutated_sup["accessors"][sup_index_accessor]["count"] = 12_000
        mutated_sup["materials"][0]["name"] = "M_UnapprovedSupportMaterial"
        mutated_sup["textures"] = [{}]
        mutated_sup["images"] = [{}]
        mutated_sup["animations"] = [{"name": "unapproved_clip"}]

        sup_errors = contracts.validate_enemy_support_weapon_contract(
            "ff_en_sup_01",
            mutated_sup,
            sup_nodes,
            sup_parents,
        )
        self.assertTrue(any("muzzle_socket_left parent changed" in error for error in sup_errors))
        self.assertTrue(any("muzzle_socket_left translation changed" in error for error in sup_errors))
        self.assertTrue(any("muzzle_socket_right extras changed" in error for error in sup_errors))
        self.assertTrue(any("turret_yaw rotation changed" in error for error in sup_errors))
        self.assertTrue(any("asset root extras changed" in error for error in sup_errors))
        self.assertTrue(any("selection_anchor must be unique" in error for error in sup_errors))
        self.assertTrue(any("node count changed" in error for error in sup_errors))
        self.assertTrue(any("primitive count changed" in error for error in sup_errors))
        self.assertTrue(any("triangle count changed" in error for error in sup_errors))
        self.assertTrue(any("material semantics changed" in error for error in sup_errors))
        self.assertTrue(any("texture count changed" in error for error in sup_errors))
        self.assertTrue(any("image count changed" in error for error in sup_errors))
        self.assertTrue(any("authored animation" in error for error in sup_errors))

        artillery = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_en_art_01_v1.glb"
        )
        mutated_art = copy.deepcopy(artillery)
        art_nodes = {
            node["name"]: node
            for node in mutated_art.get("nodes", [])
            if node.get("name")
        }
        art_parents = contracts.parent_names_by_child(mutated_art)
        art_parents["muzzle_socket"] = "turret_yaw"
        art_nodes["barrel_pitch"]["rotation"] = [0.0, 0.0, 0.0, 1.0]
        art_nodes["muzzle_socket"]["translation"] = [0.0, 0.0, 4.8]
        art_nodes["muzzle_socket"]["extras"]["socket_role"] = "barrel_end"

        art_errors = contracts.validate_enemy_support_weapon_contract(
            "ff_en_art_01",
            mutated_art,
            art_nodes,
            art_parents,
        )
        self.assertTrue(any("muzzle_socket parent changed" in error for error in art_errors))
        self.assertTrue(any("barrel_pitch rotation changed" in error for error in art_errors))
        self.assertTrue(any("muzzle_socket translation changed" in error for error in art_errors))
        self.assertTrue(any("muzzle_socket extras changed" in error for error in art_errors))

    def test_all_player_support_vehicle_contracts_match_published_assets(self) -> None:
        for asset_id in contracts.PLAYER_SUPPORT_VEHICLE_CONTRACTS:
            with self.subTest(asset_id=asset_id):
                path = (
                    contracts.PROJECT_ROOT
                    / "public"
                    / "assets"
                    / "models"
                    / f"{asset_id}_v1.glb"
                )
                document = contracts.read_glb_json(path)
                nodes = {
                    node["name"]: node
                    for node in document.get("nodes", [])
                    if node.get("name")
                }
                parents = contracts.parent_names_by_child(document)
                self.assertEqual(
                    [],
                    contracts.validate_player_support_vehicle(
                        asset_id,
                        document,
                        nodes,
                        parents,
                        byte_size=path.stat().st_size,
                    ),
                )

    def test_player_support_vehicle_semantic_domain_and_budget_mutations_are_rejected(self) -> None:
        suppressor = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_sup_01_v1.glb"
        )
        mutated_sup = copy.deepcopy(suppressor)
        sup_nodes = {
            node["name"]: node
            for node in mutated_sup.get("nodes", [])
            if node.get("name")
        }
        sup_parents = contracts.parent_names_by_child(mutated_sup)
        sup_parents["muzzle_socket_left"] = "chassis_root"
        sup_nodes["muzzle_socket_left"]["translation"] = [-0.38, 0.65, -2.98]
        sup_nodes["muzzle_socket_right"]["extras"]["socket_role"] = "decorative_tip"
        sup_nodes["turret_yaw"]["rotation"] = [0.0, 0.7071068, 0.0, 0.7071068]
        sup_nodes["FF_SUP_01"]["extras"]["asset_role"] = "generic_vehicle"
        sup_parents["powered_suppressor_targeting"] = "FF_SUP_01"
        mutated_sup["nodes"].append(copy.deepcopy(sup_nodes["selection_anchor"]))
        powered = sup_nodes["powered_suppressor_targeting"]
        powered_mesh_node = mutated_sup["nodes"][powered["children"][0]]
        powered_primitive = mutated_sup["meshes"][powered_mesh_node["mesh"]]["primitives"][0]
        powered_primitive["material"] = 1
        for mesh in mutated_sup["meshes"]:
            mesh["primitives"] = mesh["primitives"] * 2
        first_primitive = mutated_sup["meshes"][0]["primitives"][0]
        mutated_sup["accessors"][first_primitive["indices"]]["count"] = 12_000
        mutated_sup["materials"][0]["name"] = "M_UnapprovedPlayerMaterial"
        mutated_sup["textures"] = [{}]
        mutated_sup["images"] = [{}]
        mutated_sup["animations"] = [{"name": "unapproved_clip"}]

        sup_errors = contracts.validate_player_support_vehicle(
            "ff_sup_01",
            mutated_sup,
            sup_nodes,
            sup_parents,
            byte_size=500_000,
        )
        self.assertTrue(any("muzzle_socket_left parent changed" in error for error in sup_errors))
        self.assertTrue(any("muzzle_socket_left translation changed" in error for error in sup_errors))
        self.assertTrue(any("muzzle_socket_right extras changed" in error for error in sup_errors))
        self.assertTrue(any("turret_yaw rotation changed" in error for error in sup_errors))
        self.assertTrue(any("asset root extras changed" in error for error in sup_errors))
        self.assertTrue(any("powered_suppressor_targeting parent changed" in error for error in sup_errors))
        self.assertTrue(any("selection_anchor must be unique" in error for error in sup_errors))
        self.assertTrue(any("visible material domains changed" in error for error in sup_errors))
        self.assertTrue(any("seven-material" in error for error in sup_errors))
        self.assertTrue(any("unexpectedly added textures" in error for error in sup_errors))
        self.assertTrue(any("authored animation" in error for error in sup_errors))
        self.assertTrue(any("primitive count changed" in error for error in sup_errors))
        self.assertTrue(any("primitives exceed" in error for error in sup_errors))
        self.assertTrue(any("triangle count changed" in error for error in sup_errors))
        self.assertTrue(any("triangles exceed" in error for error in sup_errors))
        self.assertTrue(any("bytes exceed" in error for error in sup_errors))

        artillery = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_art_01_v1.glb"
        )
        mutated_art = copy.deepcopy(artillery)
        art_nodes = {
            node["name"]: node
            for node in mutated_art.get("nodes", [])
            if node.get("name")
        }
        art_parents = contracts.parent_names_by_child(mutated_art)
        art_parents["muzzle_socket"] = "turret_yaw"
        art_nodes["barrel_pitch"]["rotation"] = [0.0, 0.0, 0.0, 1.0]
        art_nodes["muzzle_socket"]["translation"] = [0.0, 0.0, 4.8]
        art_errors = contracts.validate_player_support_vehicle(
            "ff_art_01", mutated_art, art_nodes, art_parents
        )
        self.assertTrue(any("muzzle_socket parent changed" in error for error in art_errors))
        self.assertTrue(any("barrel_pitch rotation changed" in error for error in art_errors))
        self.assertTrue(any("muzzle_socket translation changed" in error for error in art_errors))

        scout = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_sct_01_v1.glb"
        )
        mutated_scout = copy.deepcopy(scout)
        scout_nodes = {
            node["name"]: node
            for node in mutated_scout.get("nodes", [])
            if node.get("name")
        }
        scout_parents = contracts.parent_names_by_child(mutated_scout)
        scout_nodes["radar_yaw"]["extras"]["spin_speed"] = 0.25
        scout_parents["powered_scout_radar"] = "chassis_root"
        scout_errors = contracts.validate_player_support_vehicle(
            "ff_sct_01", mutated_scout, scout_nodes, scout_parents
        )
        self.assertTrue(any("radar_yaw extras changed" in error for error in scout_errors))
        self.assertTrue(any("powered_scout_radar parent changed" in error for error in scout_errors))

    def test_all_visual_gold_prop_contracts_match_published_assets(self) -> None:
        for asset_id in contracts.VISUAL_GOLD_PROP_CONTRACTS:
            with self.subTest(asset_id=asset_id):
                path = contracts.PROJECT_ROOT / "public" / "assets" / "models" / f"{asset_id}_v1.glb"
                document = contracts.read_glb_json(path)
                nodes = {
                    node["name"]: node
                    for node in document.get("nodes", [])
                    if node.get("name")
                }
                parents = contracts.parent_names_by_child(document)
                self.assertEqual(
                    [],
                    contracts.validate_visual_gold_prop(
                        asset_id,
                        document,
                        nodes,
                        parents,
                        byte_size=path.stat().st_size,
                    ),
                )

    def test_crater_semantic_material_merge_texture_and_budget_mutations_are_rejected(self) -> None:
        document = contracts.read_glb_json(
            contracts.PROJECT_ROOT / "public" / "assets" / "models" / "ff_crt_01_v1.glb"
        )
        mutated = copy.deepcopy(document)
        nodes = {
            node["name"]: node
            for node in mutated.get("nodes", [])
            if node.get("name")
        }
        parents = contracts.parent_names_by_child(mutated)

        nodes["FF_CRT_01"]["extras"]["runtime_primitive_budget"] = 5
        nodes["FF_CRT_01"]["extras"]["uncontracted_marker"] = True
        nodes["crater_cluster_root"]["extras"] = {"presentation_role": "loose_debris"}
        nodes["crater_cluster_root"]["translation"] = [0.25, 0.0, 0.0]
        nodes["ground_anchor"]["extras"]["socket_role"] = "selection_ground"
        nodes["ground_anchor"]["rotation"] = [0.0, 0.7071068, 0.0, 0.7071068]
        parents["ground_anchor"] = "crater_cluster_root"
        mutated["materials"][0]["name"] = "M_UnapprovedCrater"
        mutated["textures"] = [{}]
        mutated["images"] = [{}]
        mutated["animations"] = [{"name": "crater_loop"}]

        mesh = mutated["meshes"][0]
        mesh["primitives"] = mesh["primitives"] * 3
        index_accessor = mesh["primitives"][0]["indices"]
        mutated["accessors"][index_accessor]["count"] = 6000

        errors = contracts.validate_visual_gold_prop(
            "ff_crt_01",
            mutated,
            nodes,
            parents,
            byte_size=110_001,
        )

        self.assertTrue(any("root extra runtime_primitive_budget changed" in error for error in errors))
        self.assertTrue(any("root extras no longer match" in error for error in errors))
        self.assertTrue(any("crater_cluster_root extras changed" in error for error in errors))
        self.assertTrue(any("ground_anchor extra socket_role changed" in error for error in errors))
        self.assertTrue(any("crater_cluster_root translation changed" in error for error in errors))
        self.assertTrue(any("ground_anchor rotation/scale changed" in error for error in errors))
        self.assertTrue(any("ground_anchor parent changed" in error for error in errors))
        self.assertTrue(any("material semantics changed" in error for error in errors))
        self.assertTrue(any("unexpectedly added runtime textures" in error for error in errors))
        self.assertTrue(any("unexpectedly added authored animation clips" in error for error in errors))
        self.assertTrue(any("primitives exceed" in error for error in errors))
        self.assertTrue(any("not statically merged by material" in error for error in errors))
        self.assertTrue(any("triangles exceed" in error for error in errors))
        self.assertTrue(any("bytes exceed" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
