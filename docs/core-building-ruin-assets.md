# 核心建筑专属废墟资产验收

## 结果

玩家与敌军的总部、载具工厂现已在各自正式 GLB 内携带一套默认隐藏、由场景独占显隐权的自包含废墟。废墟不是在完整建筑上叠加碎片，而是独立的低矮残骸轮廓：主体严重压低、屋顶或装甲断裂，同时保留入口方向、总部雷达残片、工厂吊机残臂和阵营识别色。

本批没有新增下载模型、材质槽或纹理。四件废墟均由同一份可编辑 Blender 母版内的原创参数化几何生成，并复用对应建筑已有材质；建筑占地、碰撞、寻路、生产、入口、socket、可动域、受损层与动画合同保持不变。

## GLB 接口

`ruin_visual_root` 是 `building_root` 的 meshless 直接子节点，局部 TRS 为 identity，extras 固定为：

- `presentation_role=building_ruin`
- `default_visible=false`
- `runtime_visibility_owner=scene`
- `readability_feature_scale_m=0.45-3.50`
- `primitive_budget=4`
- `triangle_budget=1500`

root 下固定四个单材质可见子网格：

- `ruin_foundation`：断裂基础、入口坡面和地基裂缝；
- `ruin_collapsed_structure`：被压低的主体、倾倒屋面和保留轮廓的侧墙；
- `ruin_broken_machinery`：总部雷达残片或工厂吊机、排气机构残臂；
- `ruin_faction_debris`：复用既有橙色或暗红材质的阵营残片。

`ruin_marker_anchor` 是 `ruin_visual_root` 下唯一的 meshless 叶节点，extras 为 `socket_role=faction_marker_low`。其 GLTF 局部坐标为 `[0, 1, 0]`，rotation/scale 为 identity；它不增加几何、材质或纹理成本，可供运行时在低矮废墟上方放置阵营标记。

## 战略镜头可读性

- 四件废墟的最小目标特征为 0.45 米，不依赖远景不可见的微型贴花。
- 两座总部保留折断雷达环和桅杆；两座工厂使用 0.44×0.46 米截面的倾倒吊臂，避免与总部轮廓混淆。
- 敌军总部与工厂原本连续的暗红底板分别拆为三个断裂岛。设计平面覆盖由 124.95 降至 85.76 平方米、由 100.77 降至 67.60 平方米，分别减少约 31.4% 与 32.9%，仍保留敌军识别色但不再像完好阵营底座。
- 中央入口或生产坡道继续保持可辨方向；废墟几何不承担碰撞、寻路或生产出口判定。

## 预览

标准、damaged 与 critical 预览继续保持原状态；新增预览只显示废墟子网格：

- `assets/3d/ff_hq_01/ff_hq_01_v1_ruin_preview.png`
- `assets/3d/ff_fac_01/ff_fac_01_v1_ruin_preview.png`
- `assets/3d/ff_en_hq_01/ff_en_hq_01_v1_ruin_preview.png`
- `assets/3d/ff_en_fac_01/ff_en_fac_01_v1_ruin_preview.png`

相对替换前备份，四件标准、damaged 与 critical 预览的平均绝对像素差均不超过 0.000005 个 8-bit 灰阶，说明新增废墟默认隐藏且没有污染既有三态预览。

## 发布指标

| 资产 | 原始 / 发布大小 | 总 tris / primitives | 废墟 tris / primitives | 材质 / 纹理 | 发布 SHA-256 |
| --- | ---: | ---: | ---: | ---: | --- |
| `ff_hq_01` | 2,061,680 / 1,539,992 B | 5,466 / 21 | 968 / 4 | 8 / 15 | `5B295A39B9C11666C6B5A97CA191DE06CCA8822BE36CC237E785320BB70DA680` |
| `ff_fac_01` | 2,031,260 / 1,509,664 B | 5,010 / 21 | 964 / 4 | 7 / 15 | `E38AA022D28D4E1B9B16AEE45E2AAD65E0E3AD98544F9195B76EB2FD6BAF7656` |
| `ff_en_hq_01` | 346,152 / 344,264 B | 4,410 / 19 | 1,248 / 4 | 6 / 0 | `329CB549C822CCA87FC2A0F3C654018EDB999508EFE86C8DD38403C75037358B` |
| `ff_en_fac_01` | 286,324 / 284,404 B | 3,578 / 19 | 1,052 / 4 | 6 / 0 | `8827CFCCF087B3F5B56C01DD12392C5527AC39629B976FA6323560D991A06690` |

四件原始 GLB 合计 4,725,416 bytes，正式 KTX2/重打包副本合计 3,678,324 bytes，减少 1,047,092 bytes（22.2%）。玩家资产仍为原 15 张 KTX2 图片，敌军仍为零贴图；四件材质数量和材质名序列均未改变。

原始 GLB SHA-256：

- `ff_hq_01`：`DDEE3D11453D5C8BFE9E48937EF95241886F749B9A34639DA73C35FF35FAFFBB`
- `ff_fac_01`：`278F39DC728E162B03343942BF8B78498D2B455D17451449E756740E07765178`
- `ff_en_hq_01`：`0627A928FCAE9F51409E9E305007C0869E8038CE59B16BD2941F4BE7296A8D13`
- `ff_en_fac_01`：`C294C7C78B22B29C3E8F73B8A2C4525CF86C5C4E281DC9D5347E9B1C2C0F7814`

## 回归与回退

- 与本波备份逐项比较，四件分别保留 26 / 27 / 24 / 25 个旧节点；旧节点零删除，所有共有节点的 parent、translation、rotation、scale 均无漂移。除资产根新增废墟预算元数据外，旧 extras 无漂移；原材质名序列和 authored animation 列表相同。
- `tools/validate_glb_contracts.py` 锁定唯一 root、唯一 marker、父子关系、role、默认可见性、scene owner、root identity TRS、marker 有限坐标与 identity rotation/scale、精确四子网格、单材质 primitive、废墟和总预算、原材质/纹理数量及零动画。
- mutation 回归会拒绝错误 role、默认显示、错误 parent、非 identity TRS、越界 marker、重复 marker、超出 primitive/triangle 预算和新增材质。
- 隔离四件 KTX2 候选为 4/4 通过；完整候选和正式目录均为 42/42 GLB/KTX2 合同通过；validator 测试为 10/10。
- 替换前 `.blend`、原始 GLB、标准/受损/濒危预览与正式 GLB 位于 `.tmp/building-ruin-backup-20260809/`。原始四件候选、KTX2 四件候选和完整 42 件候选分别位于 `.tmp/building-ruin-raw-four-20260809/`、`.tmp/building-ruin-ktx2-four-20260809/` 与 `.tmp/building-ruin-ktx2-full-20260809/`。

## 来源边界

本批由 `tools/blender/build_ff_asset_family.py` 在本机 Blender 4.5.12 LTS 中离线生成。所有压低主体、断裂板件、雷达/吊机残臂和阵营碎片均为项目内原创参数化几何，只复用对应建筑已有材质与纹理；没有下载模型、扫描数据、商业游戏网格、参考游戏贴图、新纹理或新材质槽。
