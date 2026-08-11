# 首批车辆专属残骸资产

本批为玩家与敌军的主战坦克、采矿车补充原车型专属残骸。四件资产继续由项目内 Blender 程序化生成器离线生成，没有下载模型、扫描件、商业游戏网格、参考游戏贴图、新纹理或新材质槽；残骸完全复用各载具已有 PBR 材质。

## 运行时节点合同

每个 GLB 在原资产根下新增无网格 Empty `wreck_visual_root`：

- `presentation_role = wreck_visual`
- `default_visible = false`
- `runtime_visibility_owner = scene`
- 本地 translation / rotation / scale 均为单位变换
- GLB 只声明默认状态和归属，最终显隐由场景表现层接管

坦克残骸包含 `wreck_chassis / wreck_turret / wreck_track_debris`；采矿车残骸包含 `wreck_chassis / wreck_collector / wreck_cargo_debris`。三组子网格不会进入正常车体的静态合并域。正常预览继续只显示完好载具，独立残骸预览用于资产验收。

## 造型与预算

| 资产 | 专属轮廓 | 残骸 primitives | 残骸 triangles | 材质 / 纹理变化 |
| --- | --- | ---: | ---: | --- |
| `ff_mbt_01` | 压低焦黑车体、偏转炮塔、断炮管、断裂履带块 | 3 | 600 | 0 / 0 |
| `ff_en_mbt_01` | 敌军楔形低车体、偏转炮塔、断炮管、断裂履带块 | 3 | 588 | 0 / 0 |
| `ff_hrv_01` | 焦黑履带底盘、塌陷货斗、偏移损坏采矿滚筒 | 3 | 620 | 0 / 0 |
| `ff_en_hrv_01` | 黑铁底盘、残留红色货斗、偏移损坏采矿滚筒 | 3 | 620 | 0 / 0 |

单件均远低于新增 2,500 triangles、3 primitives 的上限。预览位于：

- `assets/3d/ff_mbt_01/ff_mbt_01_v1_wreck_preview.png`
- `assets/3d/ff_en_mbt_01/ff_en_mbt_01_v1_wreck_preview.png`
- `assets/3d/ff_hrv_01/ff_hrv_01_v1_wreck_preview.png`
- `assets/3d/ff_en_hrv_01/ff_en_hrv_01_v1_wreck_preview.png`

## 发布指标

| 资产 | raw GLB | KTX2 public GLB | 总 primitives | 总 triangles | materials | textures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `ff_mbt_01` | 3,004,292 B | 2,463,864 B | 21 | 15,852 | 8 | 18 |
| `ff_hrv_01` | 2,524,720 B | 1,984,836 B | 18 | 8,760 | 9 | 18 |
| `ff_en_mbt_01` | 2,339,560 B | 1,821,628 B | 16 | 9,512 | 7 | 16 |
| `ff_en_hrv_01` | 622,588 B | 620,912 B | 17 | 8,164 | 8 | 0 |

四件原始 GLB 合计 8,491,160 B，发布副本合计 6,891,240 B，KTX2 流水线缩小 18.8%。

## 回归保护

`tools/validate_glb_contracts.py` 锁定 root role、默认显隐、scene 归属、父级、单位 TRS、三子网格名称、可见 primitive、三角形预算以及原有材质/纹理数量。mutation 测试会拒绝错误 role、默认可见、父级漂移、非单位变换和 primitive 超限。

发布前已对替换前后的原 gameplay socket、父子关系、local TRS、extras 和动画 clip 名单逐项比较，四件均完全一致；完整模型库通过 42/42 KTX2/语义合同。替换前的生成器、validator、母版、raw GLB、正常预览和 public GLB 保存在 `.tmp/vehicle-wreck-assets-before/`。
