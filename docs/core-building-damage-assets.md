# 核心建筑专属受损资产验收

## 结果

玩家与敌军的总部、载具工厂现已在各自正式 GLB 内携带两套默认隐藏、由场景独占显隐权的受损表现层。资产仍是同一份可编辑 Blender 母版；没有新增独立下载模型、材质槽或纹理，也没有改变建筑占地、碰撞、寻路、生产、入口、socket、可动域或动画合同。

两套表现层互斥使用：

- `damage_visual_damaged`：局部缺口、弯折装甲和少量碎块；
- `damage_visual_critical`：自包含的更大屋顶/侧墙塌陷、外翻板件和更多碎块，不要求同时显示 damaged 层。

## GLB 接口

两个 root 均为 `building_root` 的 meshless 直接子节点，局部 TRS 为 identity，GLB extras 如下：

| 节点 | `presentation_role` | 默认状态 | 显隐所有者 |
| --- | --- | --- | --- |
| `damage_visual_damaged` | `building_damage_damaged` | `default_visible=false` | `runtime_visibility_owner=scene` |
| `damage_visual_critical` | `building_damage_critical` | `default_visible=false` | `runtime_visibility_owner=scene` |

每个阶段固定三个可见子网格：

- damaged：`damage_damaged_breach / damage_damaged_bent_armor / damage_damaged_debris`；
- critical：`damage_critical_collapse / damage_critical_bent_armor / damage_critical_debris`。

资产元数据同时锁定 `readability_feature_scale_m=0.35-2.80`、每阶段 3 primitives 和 1,800 triangles 上限。玩家弯折板复用现有 `M_Steel`，用受光边把受损层从深色墙体中分离；敌军继续复用既有暗红、黑铁与骨白明度结构。

## 三态预览

标准预览只显示闭合母版；另外两张图分别只打开一个阶段：

- `assets/3d/ff_hq_01/ff_hq_01_v1_preview.png`
- `assets/3d/ff_hq_01/ff_hq_01_v1_damaged_preview.png`
- `assets/3d/ff_hq_01/ff_hq_01_v1_critical_preview.png`
- `assets/3d/ff_fac_01/ff_fac_01_v1_preview.png`
- `assets/3d/ff_fac_01/ff_fac_01_v1_damaged_preview.png`
- `assets/3d/ff_fac_01/ff_fac_01_v1_critical_preview.png`
- `assets/3d/ff_en_hq_01/ff_en_hq_01_v1_preview.png`
- `assets/3d/ff_en_hq_01/ff_en_hq_01_v1_damaged_preview.png`
- `assets/3d/ff_en_hq_01/ff_en_hq_01_v1_critical_preview.png`
- `assets/3d/ff_en_fac_01/ff_en_fac_01_v1_preview.png`
- `assets/3d/ff_en_fac_01/ff_en_fac_01_v1_damaged_preview.png`
- `assets/3d/ff_en_fac_01/ff_en_fac_01_v1_critical_preview.png`

相对闭合基线，damaged / critical 的变化像素占比分别约为：玩家总部 10.5% / 22.0%、玩家工厂 5.5% / 9.3%、敌军总部 22.9% / 36.8%、敌军工厂 5.9% / 9.7%。差异来自 0.35 米以上的真实几何轮廓，不依赖微型贴花。

## 发布指标

| 资产 | 发布大小 | 总 tris / primitives | damaged | critical | 材质 / 纹理 | SHA-256 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `ff_hq_01` | 1,464,252 B | 4,498 / 17 | 285 / 3 | 373 / 3 | 8 / 15 | `9AD38E7B9EF0383818FDFEE6794ABE891ACAA26D91885C9C8EFBB5464EE5A91E` |
| `ff_fac_01` | 1,433,836 B | 4,046 / 17 | 285 / 3 | 373 / 3 | 7 / 15 | `7D07BA8BDC0F8E1D87EF07BDD1F11E7C39E09D9DDBBBC030898AC0296894C124` |
| `ff_en_hq_01` | 248,540 B | 3,162 / 15 | 285 / 3 | 373 / 3 | 6 / 0 | `7DBCC27B85ADF40A51121CE58173435164A2F323ACE06C1E5321845386BDA060` |
| `ff_en_fac_01` | 201,844 B | 2,526 / 15 | 285 / 3 | 373 / 3 | 6 / 0 | `1AE7C4F759887BE79CEA0A440329F9230BC303153050C7A975E538939113900A` |

四件原始 GLB 合计 4,393,832 bytes，正式候选经 KTX2 链处理后为 3,348,472 bytes，减少 23.8%。相对替换前正式副本只增加 225,648 bytes。玩家资产仍为原 15 张 KTX2 图片；敌军资产仍为零贴图。四件材质名集合和 authored animation 列表均与替换前完全一致。

## 回归与回退

- 新旧正式 GLB 的全部共有节点逐项比较：总部/工厂/敌总部/敌工厂分别为 18 / 19 / 16 / 17 个节点，parent、translation、rotation、scale 全部无漂移；除资产根新增预算元数据外，原 extras 也无漂移。
- `tools/validate_glb_contracts.py` 锁定两个 meshless root、role、默认可见性、scene owner、精确三子件、阶段预算、总预算、材质/纹理数量、零动画及原 socket/可动域变换。
- mutation 测试会拒绝错误 role、默认显示、错误 parent、非 identity TRS、生产 socket 漂移、超出 primitive 预算和新增材质。
- 完整正式目录通过 42/42 GLB/KTX2 合同；validator 测试为 8/8。
- 替换前 `.blend`、原始 GLB、标准预览与正式 GLB 位于 `.tmp/building-damage-backup-20260809/`。原始四件候选、KTX2 四件候选和完整 42 件候选分别保存在 `.tmp/building-damage-raw-four-20260809/`、`.tmp/building-damage-ktx2-four-20260809/` 与 `.tmp/building-damage-ktx2-full-20260809/`。

## 来源边界

本批由 `tools/blender/build_ff_asset_family.py` 在本机 Blender 4.5.12 LTS 中离线生成。所有缺口、板件与碎块均为项目内原创参数化几何，且只复用对应建筑既有材质/纹理；没有下载模型、扫描数据、商业游戏网格、参考游戏贴图、新纹理或新材质槽。
