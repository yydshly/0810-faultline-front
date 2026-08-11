# 精炼站机械卸矿资产验收

## 交付范围

玩家 `FF-REF-01` 与敌军 `FF-EN-REF-01` 已由同一 Blender 程序生成器重建为可驱动机械母版。两座建筑保留原 11.4×9.4 米占地、主体轮廓、`building_root / intake_bay / storage_silo / deposit_socket / selection_anchor` 接口与地面基线；新增内容只属于表现层，不改变碰撞、寻路、资源结算或权威模拟。

本批使用本机 Blender 4.5.12 LTS、项目内原创参数化几何和既有材质。玩家继续复用项目内 512² PBR 贴图；敌军继续使用既有无贴图 PBR 材质。没有下载模型、扫描件、商业游戏网格、参考游戏贴图、新纹理或新材质槽。

## 运行时机构合同

| 节点 | 父节点 | `presentation_role` | 关闭基线与运动 |
| --- | --- | --- | --- |
| `intake_gate` | `intake_bay` | `deposit_gate` | 门板关闭时覆盖入口上半部；Three 本地 `+Y` 抬升 1.45 米 |
| `intake_conveyor` | `intake_bay` | `deposit_conveyor` | 只包含可动输送条；条带间距 0.45 米，Three 本地 `-Z` 循环 0.45 米 |
| `intake_collector` | `intake_bay` | `deposit_collector` | 横向滚筒与齿；Three 本地 `X` 轴以 5.2 rad/s 转动 |

三个节点都是 meshless、identity rotation/scale 的局部 TRS Empty，玩家与敌军同名、同层级、同轴。导出阶段把每个机构下的可见网格保留为独立动画域，不会被静态材质合并吞掉。`deposit_socket` 仍位于资产根节点外侧，真实 deposit 事件只驱动上述视觉机构，不写回玩法状态。

## 人工预览

每座母版输出两张 768² 预览：

- `assets/3d/ff_ref_01/ff_ref_01_v1_preview.png` 与 `assets/3d/ff_en_ref_01/ff_en_ref_01_v1_preview.png`：门关闭基线。
- `assets/3d/ff_ref_01/ff_ref_01_v1_unload_preview.png` 与 `assets/3d/ff_en_ref_01/ff_en_ref_01_v1_unload_preview.png`：门抬升 1.45 米的开门证明。

玩家关闭态门板覆盖高度约 0.54–2.16 米，开门态约 1.99–3.61 米；敌军使用同一运动范围。两组图均确认门板让位明显，滚筒与输送条在战略 3/4 镜头下保持中尺度可读，同时未越过原基座占地。

## 发布预算

| 资产 | 原始 GLB | KTX2 发布 GLB | 三角形 | primitives | 材质 | KTX2 图片 | 节点 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `ff_ref_01` | 1,995,460 bytes | 1,474,816 bytes | 4,796 | 12 | 6 | 15 | 21 |
| `ff_en_ref_01` | 296,360 bytes | 295,240 bytes | 3,880 | 13 | 6 | 0 | 23 |

两件原始 GLB 合计 2,291,820 bytes，正式发布合计 1,770,056 bytes，KTX2/重打包减少 521,764 bytes（22.8%）。玩家发布 SHA-256 为 `C481D8A68C5ADEB30B9C6134F8A5AB65849F1B8B7363A8A7B520F45E9A0419D1`；敌军发布 SHA-256 为 `CF2A36012B8C4D13AC8AE537B0030CB6AEC044695B940BC19244AB2A653B1F4E`。

## 验证与回退

`tools/validate_glb_contracts.py` 锁定三机构节点的父子关系、`presentation_role`、局部 TRS、位置范围、运动元数据、可见子节点、材质集合、primitive/三角形预算和代码驱动约束。`tools/test_validate_glb_contracts.py` 通过 mutation 回归证明错误 role、错误 parent 与非单位 rotation 会被拒绝。

```text
python tools/validate_glb_contracts.py public/assets/models --require-ktx2
python tools/test_validate_glb_contracts.py
```

正式目录结果为 42/42 GLB/KTX2 合同通过，4 项 validator 测试通过。替换前的 `.blend`、原始 GLB、标准预览与发布 GLB 保存在 `.tmp/refinery-mechanism-backup-20260809/`；压缩前候选与完整 42 件 KTX2 候选分别保存在 `.tmp/refinery-compress-output-20260809/` 和 `.tmp/refinery-ktx2-full-20260809/`。
