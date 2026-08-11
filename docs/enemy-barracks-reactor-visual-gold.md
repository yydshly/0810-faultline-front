# 敌军兵营与反应堆战略视觉母版验收

## 结果

`FF-EN-BAR-01` 敌军兵营和 `FF-EN-RCT-01` 敌军反应堆已经完成桌面战略镜头母版升级，并替换正式发布 GLB。

- 兵营不再是红色方垫上的单一盒体。健康态由低矮双翼装甲营房、2.20 米纵深入口、位于入口深处的双滑门、侧翼维护罐和通信桅杆组成。
- 反应堆不再是红色圆柱。健康态由三层暗色基座、装甲冷却支柱、屏蔽能源柱、窄发光能量环、陶瓷顶盖和独立旋转约束环组成。
- 红色只用于低位阵营板、入口灯和小面积能源指示，不再承担大面积主体填色。
- 两件资产均复用敌军既有 6 种材质，新增材质 0、纹理 0、authored animation 0。
- 每件都包含由场景拥有、默认隐藏的 `damaged / critical / ruin` 三类表现；四种阶段互斥，critical 不依赖 damaged，ruin 不依赖完整建筑几何。

## 前后指标

| 资产 | 旧 public | 旧 tris / primitives | 新 raw | 新 public | 完整 tris / primitives | 材质 / 纹理 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `ff_en_bar_01` | 46,072 B | 528 / 6 | 236,792 B | 235,016 B | 2,882 / 18 | 6 / 0 |
| `ff_en_rct_01` | 75,464 B | 964 / 6 | 249,100 B | 247,232 B | 3,166 / 18 | 6 / 0 |

完整 GLB 的 18 个 primitives 包含健康态 8 个、damaged 3 个、critical 3 个和 ruin 4 个。运行时阶段互斥，因此不会在同一实例上同时绘制 18 个 primitives。

| 资产 | healthy | damaged | critical | ruin |
| --- | ---: | ---: | ---: | ---: |
| `ff_en_bar_01` | 1,552 tris / 8 prim | 285 / 3 | 329 / 3 | 716 / 4 |
| `ff_en_rct_01` | 1,744 tris / 8 prim | 293 / 3 | 329 / 3 | 800 / 4 |

兵营健康态低于 `1,800 tris / 8 primitives`，反应堆健康态低于 `2,200 / 8`；所有战略识别部件的设计尺寸不小于 0.40 米。

## 稳定玩法接口

旧节点的 parent、GLTF 局部 translation、rotation、scale 和完整 extras 均由 validator 精确锁定。Blender Z-up 导出到 GLTF Y-up，因此下表使用正式 GLTF 坐标。

### 兵营

| 节点 | parent | translation | extras |
| --- | --- | --- | --- |
| `building_root` | `FF_EN_BAR_01` | `[0,0,0]` | `{}` |
| `barracks_door` | `building_root` | `[0,0,2.42]` | `{}` |
| `infantry_spawn` | `FF_EN_BAR_01` | `[0,0,4.45]` | `socket_role=infantry_spawn` |
| `rally_socket` | `FF_EN_BAR_01` | `[0,0,6]` | `socket_role=default_rally` |
| `selection_anchor` | `FF_EN_BAR_01` | `[0,0.05,0]` | `socket_role=selection_ground` |
| `damage_socket_roof` | `building_root` | `[0,3,-0.5]` | `socket_role=damage_emitter` |

`barracks_door` 仍是独立代码驱动域，内部固定为 `M_EnemyObsidianArmor + M_EnemyGunmetal` 两个可见材质批次。其余健康几何在资产根下按 6 种敌军材质合并。

### 反应堆

| 节点 | parent | translation | extras |
| --- | --- | --- | --- |
| `building_root` | `FF_EN_RCT_01` | `[0,0,0]` | `{}` |
| `reactor_core` | `building_root` | `[0,0,0]` | `{}` |
| `reactor_ring` | `reactor_core` | `[0,4,0]` | `spin_speed=0.32` |
| `power_socket` | `FF_EN_RCT_01` | `[0,0,-4.2]` | `socket_role=power_connection` |
| `selection_anchor` | `FF_EN_RCT_01` | `[0,0.05,0]` | `socket_role=selection_ground` |
| `damage_socket_roof` | `building_root` | `[0,3,-0.5]` | `socket_role=damage_emitter` |

`reactor_ring` 仍是独立旋转域，内部固定为 `M_EnemyGunmetal + M_EnemyMarking` 两个批次；约束环旋转时，能源柱、供电 socket 与选择锚点均不会漂移。

## 受损与废墟合同

- `damage_visual_damaged`：`presentation_role=building_damage_damaged`、`default_visible=false`、`runtime_visibility_owner=scene`。
- `damage_visual_critical`：`presentation_role=building_damage_critical`、`default_visible=false`、`runtime_visibility_owner=scene`。
- 两个 damage root 均为 `building_root` 下的 identity、meshless 节点，每态恰好 3 个单材质子网格，单态上限 1,800 triangles。
- `ruin_visual_root` 同样为 identity、meshless、默认隐藏、scene-owned 节点，恰好包含 4 个单材质废墟网格和唯一的 `ruin_marker_anchor`。
- `ruin_marker_anchor` 是 `[0,1,0]` 的 meshless 叶节点，使用 `socket_role=faction_marker_low`。

## 预览与人工检查

每件资产均输出标准、damaged、critical 和 ruin 四张 768×768 预览：

- `assets/3d/ff_en_bar_01/ff_en_bar_01_v1_preview.png`
- `assets/3d/ff_en_bar_01/ff_en_bar_01_v1_damaged_preview.png`
- `assets/3d/ff_en_bar_01/ff_en_bar_01_v1_critical_preview.png`
- `assets/3d/ff_en_bar_01/ff_en_bar_01_v1_ruin_preview.png`
- `assets/3d/ff_en_rct_01/ff_en_rct_01_v1_preview.png`
- `assets/3d/ff_en_rct_01/ff_en_rct_01_v1_damaged_preview.png`
- `assets/3d/ff_en_rct_01/ff_en_rct_01_v1_critical_preview.png`
- `assets/3d/ff_en_rct_01/ff_en_rct_01_v1_ruin_preview.png`

人工检查确认：标准预览没有泄漏任何隐藏层；damaged 与 critical 的屋顶/入口或能源柱破坏程度清晰不同；废墟保持低矮且仍能分别读出通信桅杆和反应堆约束环。反应堆在首轮检查后仅扩大既有窄信号环并增加小型顶端能源指示，未增加材质、纹理或 primitive。

## 正式发布

| 资产 | public SHA-256 |
| --- | --- |
| `ff_en_bar_01` | `4BFE221C56D5CCA76CAC05F7553C69FA4565424ABF6361914EDB3A6DFCFAB9FC` |
| `ff_en_rct_01` | `B1327EC917B5DC97032C6CBEDC6DB8DB30F8973C27D193927A74667B7210DD8D` |

Raw GLB SHA-256：

- `ff_en_bar_01`：`65005393BF3534D5ED4BCD24CB57C021F1A9BA42B9338FE295707FC661E67F1B`
- `ff_en_rct_01`：`AD00387EA542C6D51AB5F28FF02493738E4B1119C5B1DF2A05BFD236C210D365`

两件均为零纹理资产，因此隔离 KTX2 链只执行标准 GLB 重打包，没有生成图片或 KTX2 texture。叠加候选与正式 `public/assets/models` 均通过 42/42 `--require-ktx2` 合同，validator mutation tests 为 13/13。

## 来源与回退

本批次由项目内 `tools/blender/build_ff_asset_family.py` 使用 Blender 4.5.12 LTS 离线确定性生成。几何、命名、材质分配、受损层和废墟均为项目原创参数化内容；没有下载模型、扫描件、商业游戏网格、参考游戏贴图、新纹理或新材质槽。

替换前可恢复副本位于 `.tmp/enemy-infra-gold-before-20260809/`。Raw 全库候选位于 `.tmp/enemy-infra-gold-raw-full-20260809-v1/`，隔离压缩输出位于 `.tmp/enemy-infra-gold-ktx2-full-20260809-v1/`，最终 42 件叠加验证根位于 `.tmp/enemy-infra-gold-ktx2-review-full-20260809-v1/`。
