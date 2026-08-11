# 玩家兵营与反应堆四态视觉金标验收

## 结果

`FF-BAR-01` 玩家兵营与 `FF-RCT-01` 玩家反应堆已完成桌面战略镜头金标重制，并以 KTX2 正式发布。两件资产同时具备健康、受损、危急和废墟四种互斥表现。

- 兵营改为低矮分层训练大厅，入口沿 GLB `+Z` 方向形成 2.20 米纵深；左右分别布置较重的军械翼和较低的服务翼，青色功能灯与低位琥晶色识别条控制在少量大形状上。
- 反应堆改为暗色阶梯基座、清晰的竖向 `M_Huijing` 能量芯、单组有间隙约束环和三种不重复冷却体块；约束环仍由代码独立旋转。
- 没有用微型 greeble、新贴图或新材质弥补轮廓。两件继续复用原有 7 个材质槽和 15 张项目内 PBR 图片，新增材质 0、图片 0、authored animation 0。
- 几何、命名、受损层和废墟均为项目内 Blender 参数化原创内容，没有下载模型、扫描数据、商业游戏网格、参考游戏贴图、标志或具体建筑复刻。

## 前后指标

| 资产 | 旧 raw / public | 旧 tris / prim | 新 raw / public | 新 tris / prim | 材质 / KTX2 图片 / 节点 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `ff_bar_01` | 1,713,724 / 1,193,516 B | 916 / 9 | 1,848,456 / 1,327,104 B | 2,490 / 18 | 7 / 15 / 29 |
| `ff_rct_01` | 1,323,644 / 687,556 B | 4,188 / 25 | 1,877,372 / 1,356,012 B | 3,010 / 18 | 7 / 15 / 30 |

| 资产 | healthy | damaged | critical | ruin |
| --- | ---: | ---: | ---: | ---: |
| `ff_bar_01` | 1,232 tris / 8 prim | 285 / 3 | 329 / 3 | 644 / 4 |
| `ff_rct_01` | 1,608 tris / 8 prim | 293 / 3 | 329 / 3 | 780 / 4 |

兵营健康态低于 `2,200 tris / 9 primitives`，四态总量低于 `6,300 / 19`；反应堆健康态低于 `2,600 / 8`，四态总量低于 `6,700 / 18`。每个 damaged 与 critical 状态精确为 3 primitives，每个 ruin 精确为 4 primitives 且低于 1,500 tris。阶段由场景互斥显示，所以单个实例不会同时绘制全部 18 primitives。

两件 raw 合计 3,725,828 B，隔离 KTX2 输出合计 2,683,116 B，减少 1,042,712 B（28.0%）。可编辑母版分别为 950,694 B 与 959,551 B。

## 稳定玩法接口

下表使用正式 GLB 的 Y-up 坐标。旧节点的 parent、局部 translation、rotation、scale 与所有旧 extras 键值均逐项比较通过；资产根仅增加来源、视觉版本和预算元数据，没有改变原有 `asset_id` 或 `asset_role`。

### 兵营

| 节点 | parent | translation | extras |
| --- | --- | --- | --- |
| `building_root` | `FF_BAR_01` | `[0,0,0]` | `{}` |
| `barracks_door` | `building_root` | `[0,0,0]` | `{}` |
| `infantry_spawn` | `FF_BAR_01` | `[0,0,4.45]` | `socket_role=infantry_spawn` |
| `rally_socket` | `FF_BAR_01` | `[0,0,6]` | `socket_role=default_rally` |
| `selection_anchor` | `FF_BAR_01` | `[0,0.05,0]` | `socket_role=selection_ground` |

`barracks_door` 保持 meshless identity 动态域。门板只在该域内合并为 `M_Gunmetal`；新增的 `powered_barracks_signal` 是门下的独立 meshless 子域，保留 `M_CyanSignal`。根元数据锁定门的 GLB `+Y` 运动与 1.75 米最大行程，出兵方向锁定为 GLB `+Z`。

### 反应堆

| 节点 | parent | translation | extras |
| --- | --- | --- | --- |
| `building_root` | `FF_RCT_01` | `[0,0,0]` | `{}` |
| `reactor_core` | `building_root` | `[0,1.65,0]` | `{}` |
| `reactor_ring` | `building_root` | `[0,0,0]` | `spin_speed=0.32` |
| `power_socket` | `FF_RCT_01` | `[0,0,-4.2]` | `socket_role=grid_connection` |
| `selection_anchor` | `FF_RCT_01` | `[0,0.05,0]` | `socket_role=selection_ground` |

`reactor_core`、`reactor_ring`、`powered_reactor_core` 与 `powered_reactor_ring_signal` 都是独立 meshless 域。运行时合并后，核心护罩、`M_Huijing` 能量芯、开口钢环和青色端点信号仍分别挂在正确域下；静态基座不会吞并这些可驱动结构。

## 四态与预览

两件资产都在 `building_root` 下提供默认隐藏、场景托管的 `damage_visual_damaged`、`damage_visual_critical` 与 `ruin_visual_root`。damaged 和 critical 各由 breach/collapse、bent armor、debris 三个单材质部件组成；ruin 由 foundation、collapsed structure、broken machinery、faction debris 四个单材质部件组成，并保留唯一的 `ruin_marker_anchor`。

人工检查使用以下 768×768 标准战略预览：

- `assets/3d/ff_bar_01/ff_bar_01_v1_preview.png`
- `assets/3d/ff_bar_01/ff_bar_01_v1_damaged_preview.png`
- `assets/3d/ff_bar_01/ff_bar_01_v1_critical_preview.png`
- `assets/3d/ff_bar_01/ff_bar_01_v1_ruin_preview.png`
- `assets/3d/ff_rct_01/ff_rct_01_v1_preview.png`
- `assets/3d/ff_rct_01/ff_rct_01_v1_damaged_preview.png`
- `assets/3d/ff_rct_01/ff_rct_01_v1_critical_preview.png`
- `assets/3d/ff_rct_01/ff_rct_01_v1_ruin_preview.png`

检查结论：兵营深入口、训练大厅和不对称服务翼在战略距离成立；反应堆竖向能量芯与单开口环不会误读成普通圆柱；damaged 到 critical 的破坏体量递增清楚；两件 ruin 都是低轮廓且不会误认成健康建筑。

## 发布与验证

| 资产 | raw SHA-256 | public SHA-256 |
| --- | --- | --- |
| `ff_bar_01` | `75747F824316ECBCBB12E025077436BB6EE780BAED322239F613BAC15BAC04C9` | `5E37C5739A3A6B64B5A6CEB44C237EAC6994BFD9C87A3DA1F3A8F8D0C4F18D5B` |
| `ff_rct_01` | `39D99D42201AB401176297A341C9DADC1314247E0B091611C080323DCDC85C49` | `0EE1297842C7B560E5429FACA61CD22BE7BEB4C2BEDDDC6982F572D99544938B` |

- 隔离两件 KTX2 候选通过完整玩家建筑、四态、动态域、材质、纹理与语义节点合同。
- 正式 `public/assets/models` 通过 42/42 `--require-ktx2` GLB 合同。
- validator 回归为 17/17；新增 mutation 覆盖门行程、出兵轴、socket extras、反应堆环速、供电 socket、动态材质域、材质/图片数量以及健康态和总预算。
- 可恢复备份位于 `.tmp/player-infrastructure-gold-before-20260809/`；隔离 raw 与 KTX2 候选分别位于 `.tmp/player-infrastructure-raw-two-20260809/` 和 `.tmp/player-infrastructure-ktx2-two-20260809/`。
