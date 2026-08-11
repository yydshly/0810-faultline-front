# 敌军重炮与中继站战略视距资产验收

## 结果

`FF-EN-CAN-01` 敌军重炮与 `FF-EN-REL-01` 敌军中继站已完成战略视距母版升级并替换正式 GLB。两件资产不再使用连续红色方垫作为主要识别形状；红色只保留在低位支撑脚、炮盾或阵列信号端，主体继续使用黑铁、深灰、骨白三档明度。

- 重炮现在是低矮十边形稳定炮座、分段支撑脚、楔形炮房、宽炮盾、后部配重与粗后膛/炮管/制退器组成的完整武器轮廓。
- 中继站现在是分层十边形基座、低位锚脚、粗通信桅杆、碟形天线与叉形阵列组成的专属通信轮廓，不再是细杆加横线。
- 两件资产继续使用原有 6 个材质、0 纹理、0 authored animation；没有增加突破场景常驻 primitive 数。

## 前后指标

| 资产 | 旧版大小 | 旧版 tris / primitives | 新 raw 大小 | 新 raw tris / primitives | 材质 / 纹理 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `ff_en_can_01` | 51,884 B | 612 / 8 | 138,048 B | 1,768 / 8 | 6 / 0 |
| `ff_en_rel_01` | 70,368 B | 840 / 7 | 99,212 B | 1,280 / 7 | 6 / 0 |

重炮保持原 8 primitives，中继保持原 7 primitives；新增三角形只用于 0.40 米以上的战略轮廓、倒角与机构层级。重炮低于 1,800 triangles / 8 primitives 上限，中继低于 1,300 / 7 上限。

## 轮廓与材质域

### FF-EN-CAN-01

静态域固定为四个合批：

- `M_EnemyRecess`：十边形接地暗裙；
- `M_EnemyObsidianArmor`：分层底座、低炮台和回转环；
- `M_EnemyCrimsonArmor`：四块低位稳定脚；
- `M_EnemyMarking`：前部敌军识别板。

`turret_yaw` 固定为红色炮房/炮盾与信号眼两个材质域；`barrel_pitch` 固定为钢制后膛/套筒/重炮管和黑色制退器两个材质域。因此总量仍为 4 + 2 + 2 = 8 primitives。

本批同时修复了生成器的嵌套运动域选择：合并器现在选择距离网格最近的代码驱动祖先。炮管和制退器正式成为 `barrel_pitch` 的可见直接子网格；运行时俯仰时，炮管与 `muzzle_socket` 会一起运动，不再出现只移动炮口 socket、炮管留在 `turret_yaw` 的问题。

### FF-EN-REL-01

静态域继续固定为暗裙、深色分层主体、四块低红锚脚和前部骨白标记四个合批；`radar_yaw` 内固定为：

- `M_EnemyGunmetal`：粗桅杆、叉臂与碟面边环；
- `M_EnemyMarking`：碟面、横向阵列与背板；
- `M_EnemySignal`：中心发射器与两侧信号端。

总量保持 4 + 3 = 7 primitives。通信阵列仍由现有 `radar_yaw` 驱动，`network_socket` 的位置和语义不变。

## 稳定接口

旧语义节点的 parent、translation、rotation、scale 与 extras 逐项比较均无差异。

### 重炮

| 节点 | parent | GLTF 局部 translation | 语义 |
| --- | --- | --- | --- |
| `building_root` | `FF_EN_CAN_01` | `[0,0,0]` | 建筑视觉根 |
| `turret_yaw` | `building_root` | `[0,2.65,0]` | `socket_role=weapon_yaw` |
| `barrel_pitch` | `turret_yaw` | `[0,1.15,0.95]` | `socket_role=weapon_pitch`，保留原约 7° rotation |
| `muzzle_socket` | `barrel_pitch` | `[0,0,7.42]` | `socket_role=projectile_origin` |
| `selection_anchor` | `FF_EN_CAN_01` | `[0,0.05,0]` | `socket_role=selection_ground` |

### 中继站

| 节点 | parent | GLTF 局部 translation | 语义 |
| --- | --- | --- | --- |
| `building_root` | `FF_EN_REL_01` | `[0,0,0]` | 建筑视觉根 |
| `radar_yaw` | `building_root` | `[0,2.35,0]` | `spin_speed=0.22` |
| `network_socket` | `FF_EN_REL_01` | `[0,0,-3.65]` | `socket_role=bandwidth_connection` |
| `selection_anchor` | `FF_EN_REL_01` | `[0,0.05,0]` | `socket_role=selection_ground` |

两件资产均正式导出生成器已有的 `damage_socket_roof`：parent 为 `building_root`、GLTF 局部 translation 为 `[0,3,-0.5]`、extras 为 `socket_role=damage_emitter`。它是 meshless 语义挂点，不增加渲染成本。

## 预览

- `assets/3d/ff_en_can_01/ff_en_can_01_v1_preview.png`
- `assets/3d/ff_en_rel_01/ff_en_rel_01_v1_preview.png`

预览来自各自最终 `.blend` 母版，并使用与其他资产一致的 768×768 三分之四战略审阅相机。重炮的粗后膛、长炮管、炮盾和低基座，中继的粗桅杆、碟面和叉冠在该距离下均形成独立轮廓。

## 正式发布

| 资产 | public 大小 | tris / primitives | 材质 / 纹理 | 节点 / 动画 | public SHA-256 |
| --- | ---: | ---: | ---: | ---: | --- |
| `ff_en_can_01` | 137,236 B | 1,768 / 8 | 6 / 0 | 15 / 0 | `C2E10617A8E14EE21DA19DF18F479C7F7138A2479DB2DCC95B0ECECFF2B8D6C0` |
| `ff_en_rel_01` | 98,520 B | 1,280 / 7 | 6 / 0 | 13 / 0 | `FEEE33CDF1294F70514B3B46B1C91DCCE3ADF4C5481C85ADAE5A7D8BB3CCCFA0` |

原始 GLB SHA-256：

- `ff_en_can_01`：`869E5D73F2E14C380090EDDA085474B866FE6263D47AB2C619B50B79BECC9958`
- `ff_en_rel_01`：`EDC9ED3653A598E801711CAD76FF0DD48212EAD063793065D9D1FB56C4ACCBCF`

两件 raw 合计 237,260 bytes，隔离 KTX2/重打包副本合计 235,756 bytes。两件均为零贴图资产，因此本次处理只执行标准 GLB 重打包，没有生成 KTX2 图片。

## 桌面运行时证据

两件正式 public GLB 已在真实 Three.js 战略镜头中复验，不只依赖 Blender 预览。

| 1440×900 / high | 资产 | 加载失败 / 重试 | calls | triangles | geometries | textures | 控制台错误/警告 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `enemy-base-review` | 9 / 9 | 0 / 0 | 152 | 19,774 | 120 | 5 | 0 |
| `breakthrough-demo` | 40 / 40 | 0 / 0 | 656 | 115,762 | 410 | 142 | 0 |

敌军基地评审中，重炮的长炮管/宽炮盾与中继站的碟面/叉形阵列能在同一战略距离形成不同轮廓；突破战中两件新模型进入正式对局资产计划。重炮仍为 8 primitives，中继仍为 7 primitives，因此本批没有增加它们的单实例绘制批次数。

## 合同、验证与回退

- `tools/validate_glb_contracts.py` 锁定两件资产的根元数据、6 材质/0 贴图、primitive/triangle 预算、零动画、全部语义节点的唯一性/parent/TRS/extras，以及各静态、yaw、pitch 材质域的精确可见子网格集合。
- mutation 回归会拒绝错误预算元数据、socket role、parent/translation/rotation 漂移、炮管脱离 `barrel_pitch`、新增材质/贴图及 primitive/triangle 超限。
- 两件隔离候选为 2/2 通过；完整候选和正式模型目录均为 42/42 GLB/KTX2 合同通过；validator 测试为 12/12。
- 替换前母版、raw/正式 GLB、预览、生成器、validator 与 provenance 位于 `.tmp/en-can-relay-gold-backup-20260809/`。raw 候选、隔离发布候选、完整 42 件候选与候选测试根分别位于 `.tmp/en-can-relay-gold-raw-20260809/`、`.tmp/en-can-relay-gold-ktx2-20260809/`、`.tmp/en-can-relay-gold-ktx2-full-20260809/` 与 `.tmp/en-can-relay-gold-test-root-20260809/`。

## 来源边界

本批由 `tools/blender/build_ff_asset_family.py` 在本机 Blender 4.5.12 LTS 中离线生成。底座、稳定脚、炮房、炮盾、后膛、炮管、制退器、桅杆、碟面和叉形阵列均为项目内原创参数化几何，只复用敌军既有六材质；没有下载模型、扫描数据、商业游戏网格、参考游戏贴图、新纹理或新材质槽。
