# FF-CRT-01 炮击弹坑桌面金标验收

## 目标与范围

本波次只重制 `FF-CRT-01` 的可见母资产，不修改地图布置、碰撞、寻路、模拟、关卡、镜头、灯光、VFX、UI 或其他 GLB。目标是在真实桌面战略距离下消除三个规则完整圆环的“甜甜圈”观感，同时保持原运行时身份和地面锚点。

正式预算为：不高于 1,000 triangles、4 primitives、3 个既有材质、0 纹理与 110,000 bytes。生产源仍为可编辑 Blender 母版、原始 GLB 和 768×768 标准战略预览。

## 视觉方案

- 主体改为单一不规则椭圆撞击痕，使用三段高低、宽度和长度不同的开放坑缘，圆周保留三个明确断口，不存在完整等宽环。
- `M_ScorchedEarth` 形成贴近地表的低位暗芯；暗芯边界使用十二段不等径轮廓，避免圆形贴花观感。
- 两块右向、宽而低的 `M_FieldEarth` 翻土面建立冲击方向；它们是连续大形，不是独立小石块。
- 一段 `M_FaultRock` 嵌入式岩唇提供材质断点，替代旧版八块独立微碎石。没有高饱和描边、发光、透明贴花或新增纹理。
- 三种既有材质均降低黄色饱和倾向并靠近灰橄榄地表；差异主要依靠坑缘受光、暗芯和高度变化，而不是颜色勾边。

标准预览位于 `assets/3d/ff_crt_01/ff_crt_01_v1_preview.png`。人工复核确认开放椭圆轮廓、暗芯和右向翻土在正交战略视角下成立，且没有独立微碎石噪声。

正式 `breakthrough-demo` 也在 1440×900 / high 桌面战略镜头下复验。新弹坑与部队、道路和地表同屏时不再呈现规则“甜甜圈”，控制台 warning/error 均为 0。实机证据见 [战略镜头截图](qa/crater-strategic-1440x900-high.png)。

## 前后运行时指标

| 阶段 | bytes | triangles | primitives | materials | images | nodes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 旧 raw | 156,764 | 2,164 | 14 | 3 | 0 | 17 |
| 旧 public | 155,848 | 2,164 | 14 | 3 | 0 | 17 |
| 新 raw | 14,756 | 139 | 3 | 3 | 0 | 6 |
| 新 public | 14,504 | 139 | 3 | 3 | 0 | 6 |

正式副本减少 141,344 bytes（90.7%）、2,025 triangles（93.6%）和 11 primitives（78.6%）。节点减少只来自按材质合并旧独立地表网格；三个稳定语义节点全部保留。

运行时三种材质各对应唯一 primitive，因此重复布置不会再为每块坑底、坑缘或碎石提交独立材质绘制。资产不包含 images、textures、skins 或 authored animation。

## 语义与变换合同

| 节点 | parent | GLB translation | rotation / scale | extras |
| --- | --- | --- | --- | --- |
| `FF_CRT_01` | scene root | `[0, 0, 0]` | identity | 旧 `asset_id / asset_role` 保留；新增预算与来源元数据 |
| `crater_cluster_root` | `FF_CRT_01` | `[0, 0, 0]` | identity | 继续为空 |
| `ground_anchor` | `FF_CRT_01` | `[0, 0.02, 0]` | identity | `socket_role=ground_contact` |

旧正式副本与新正式副本逐节点比较了 parent、translation、rotation、scale 和全部旧 extras，三节点均为精确保留。运行时仍由场景使用原布置、旋转、缩放和 `0.006` 资产比例，不改变玩法或回放状态。

## 发布、哈希与回退

| 文件 | SHA-256 |
| --- | --- |
| 旧 raw | `B880F6F860670E5E4D15A897CAEE3DEF19018729CBF0B93F69B7CBDA8DF932A4` |
| 旧 public | `6146CCDD04F2F0E112CE33530FCC489C0DBBE54B372273CA03B9866091ECDFB5` |
| 新 raw | `9F1CB73CA7931E266C5831E886366C9E21E3A93805C02C7BD7BDF90C1CBB60B7` |
| 新 public | `F029038E6F12205B765A268F2D47EC673038B2A2501A98EC9F3CE4F2168AF173` |

替换前母版、`.blend1`、预览、raw/public GLB、生成器、validator、测试和来源文档位于 `.tmp/visual-gold-crater-before-20260809/`。其中 raw/public GLB 使用独立文件名保存，哈希与上表一致，可精确恢复。

发布流程没有直接覆盖正式目录：

1. `.tmp/crater-gold-raw-full-20260809/` 以新 raw 叠加完整 42 件模型库，先通过 42/42 合同。
2. `.tmp/crater-gold-ktx2-input-20260809/` 仅包含目标 raw，输出到隔离的 `.tmp/crater-gold-ktx2-output-20260809/`。
3. 隔离输出叠加到 `.tmp/crater-gold-ktx2-full-20260809/` 后，以 `--require-ktx2` 通过完整 42/42，再发布到 `public/assets/models/ff_crt_01_v1.glb`。
4. 正式目录再次通过 42/42；validator 共 15 项测试通过，其中新增 mutation 覆盖 root/extras、parent/TRS、材质、静态合并、纹理、动画、triangle、primitive 与 byte 预算漂移。

本资产为零纹理材质，因此隔离 KTX2 工具链不会新增 KTX2 图片；它仍执行正式候选重打包和完整目录验证，没有绕过发布链。

## 原创与参考边界

几何和材质参数全部来自项目内确定性 Blender 脚本。经典 RTS 只提供“战略距离下应以单一大形快速识别战损地表”的抽象原则；没有复制《红色警戒 2 / 尤里的复仇》的具体弹坑图形、贴图、网格、标志或界面资产，也没有从截图提取任何运行时内容。
