# 突破战役 P0：战场可读性整理

本轮只修改 Three.js 表现层，不修改关卡锚点、单一平面导航、碰撞、选择与命令输入、AI、任务阶段、可见性权威数据、敌军披露或事件过滤。所有新增标记均为现有场景对象或确定性运行时几何；纹理数量不增加。

## 显示契约

| 项目 | 新契约 | 不变项 |
| --- | --- | --- |
| 战争迷雾 | `soft-edge-v2`；原 64×64 DataTexture 上对显示采样形成两级边缘；可见 alpha 0，未知首圈 80、次圈 148、内层 218；已探索首圈 52、次圈 92、内层 120 | `VisibilitySnapshot`、`visibilityMask`、`exploredMask`、`visibleEnemyIds`、实体/事件披露与查询规则不变；0 新纹理 |
| 未解锁信标 | `breakthrough-demo*` 未解锁时仅隐藏 5.8–7.0 的大控制圈；塔体保留，顶部信号保留并改用已有暗青材质 | 解锁后控制圈恢复；争夺、控制阵营材质和进度仍由原 `BeaconState` 驱动 |
| 静态防御标记 | 两个原锚点继续位于 `(9,-22,r3.9)` 与 `(23,-23,r4.7)`；环宽由 14% 降为 5%，opacity 由 0.30 降为 0.16 | 锚点、半径、战役数据与任何碰撞/导航定义不变 |
| 群选圈 | 选择数达到 6 时使用共享 `inner=0.92 / outer=1.0` 几何和独立 opacity 0.54 材质 | 1–5 个选择继续使用原 `inner=0.79 / opacity=0.90`；选择集合、框选、编队与命令逻辑不变 |
| 接地阴影 | 复用原圆形几何与单一材质；opacity 0.22、主缩放 0.84，继续保留车辆/建筑纵深比例 | 0 新纹理，不引入实例化重构，不改变实体几何、拾取或占地 |

## 浏览器可观测指标

开发构建的战场 canvas 暴露以下稳定 dataset，便于桌面浏览器夹具断言：

- `fogEdgePolicyVersion=soft-edge-v2`
- `fogTextureSize=64`
- `fogEdgeAlphas=0,80,148,218`
- `groupSelectionCount`
- `groupSelectionPolicyVersion=compact-group-v1`
- `compactSelectionRings`
- `beaconRingVisible`
- `defenseMarkerCount`
- `defenseMarkerOpacity=0.16`
- `presentationContactShadowOpacity=0.22`
- `presentationContactShadowScale=0.84`

建议在 `/?fixture=breakthrough-demo&quality=high` 复验未解锁阶段：`beaconRingVisible=false`、`defenseMarkerCount=2`。通过开发入口一次选择至少 6 个当前可见实体后，应看到 `groupSelectionCount>=6` 且 `compactSelectionRings` 等于其中实际显示的已选实体数。

## 确定性与预算

- 雾边缘查找只读取两张 64×64 `Uint8Array` 显示采样掩码；权威可见/探索掩码仍供实体披露与事件过滤使用。
- 每像素最多搜索 Chebyshev 半径 2；无逐帧对象分配，无新 DataTexture、图片、材质贴图或外部资源。
- 防御标记仍为 2 个现有环网格；信标不增加网格；群选只在两个缓存几何和共享材质之间切换；接地阴影网格数不变。
- `simulation.ts`、`types.ts`、AI、`level.ts`、GLB、Blender、UI 与 CSS 均未修改，因此权威状态序列化和状态 hash 输入未改变。

## 自动验证

`scene-battlefield-readability.test.ts` 固定以下内容：

- visible / explored / unknown 的颜色与基础 alpha；
- 首圈、次圈、内层未知 alpha 以及纯函数不修改输入掩码；
- 6 个选择的窄环阈值与 1–5 个选择的旧契约；
- 突破战役锁定/解锁信标圈与信号策略；
- 两个防御锚点、窄环 opacity 和接地阴影预算。
