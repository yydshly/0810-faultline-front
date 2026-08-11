# 《断层战线》文档索引

更新时间：2026-08-11

本目录同时保存当前产品真值、设计愿景和阶段性验收记录。阅读时应先确认文档类别，避免把旧里程碑中的数字或路线当成当前状态。

## 文档状态说明

- **当前**：描述当前可运行版本，发生冲突时优先采用。
- **规范**：产品或实现约束；部分内容可能是尚未落地的长期愿景。
- **里程碑**：某一阶段的实现与验收证据，后续版本可能已经替代当时的数字和结论。
- **资产记录**：资产来源、预算、语义合同和发布证据。

## 从这里开始

1. **当前**：[项目复盘与技术总览](project-retrospective-and-architecture.md) —— 从立项到当前目标的动作、问题、解决方案、架构和后续优化。
2. **当前**：[技术实现、任务编排与 Blender 流水线](implementation-workflow-and-blender-pipeline.md) —— 剧情如何落到任务状态、核心工具分工，以及大模型怎样调度 Blender 制作正式资产。
3. **当前**：[黄金对局可玩性收口](golden-match-playability.md) —— 当前 8–12 分钟桌面黄金路线与验收证据。
4. **当前**：[三档难度、部署与续战入口](breakthrough-difficulty-deployment.md) —— 新兵/标准/老兵、根任务简报和继续上次战况。
5. **当前**：[GitHub Pages 部署与线上验收](github-pages-deployment.md) —— 公开地址、部署提交、子路径契约、实机证据和回滚。
6. **当前**：[发布与部署就绪说明](release-readiness.md) —— 最新 ZIP、SHA256、线上部署、启动、验收和回滚。
7. **当前**：[资产来源与生成记录](asset-provenance.md) —— 42 件原创资产的来源与流水线真值。
8. **规范**：[原创即时战略游戏设计方案](faultline-front-game-design.zh-CN.md) —— 产品方向和长期愿景；React、Worker、IndexedDB 等内容不等同当前实现。
9. **规范/历史**：[原型交付契约](prototype-delivery-contract.md) —— v0.1–v0.6 的范围修订与完成标准。
10. **里程碑**：[原型覆盖清单](prototype-coverage.md) —— 早期逐阶段覆盖记录，测试数和资产数已被当前文档替代。
11. **当前**：[原型交接](prototype-handoff.md) —— 当前交付边界、关键入口和接续建议。

## 关卡、任务与可玩性

- **当前/方法**：[技术实现、任务编排与 Blender 流水线](implementation-workflow-and-blender-pipeline.md) —— 从世界规则到确定性任务状态、HUD、难度、存档与测试。
- **里程碑**：[灰烬环线可玩演示关卡](playable-campaign-demo.md)
- **里程碑**：[断层突破战可玩演示](playable-breakthrough-demo.md)
- **里程碑/规范**：[突破战五阶段任务导演](breakthrough-mission-director.md)
- **当前**：[编队导航与自然终局收口](breakthrough-formation-navigation-closeout.md)
- **里程碑**：[桌面终局可玩性收口](desktop-terminal-playability-closeout.md) —— 记录旧版快速突击路线，当前节奏以黄金对局文档为准。
- **当前**：[小地图镜头导航](minimap-camera-navigation.md)

## UI、信息架构与视觉方向

- **当前**：[桌面右侧指挥栏契约](desktop-command-sidebar-contract.md)
- **当前**：[阵营识别与生命条呈现](faction-health-presentation.md)
- **当前**：[突破战战场可读性](breakthrough-battlefield-readability.md)
- **规范**：[桌面视觉金标美术方向](visual-gold-art-direction.md)
- **规范/当前**：[桌面视觉金标契约](visual-gold-contract.md)
- **里程碑**：[桌面视觉金标验收](desktop-visual-gold-validation.md)
- **里程碑**：[视觉金标地表铺装](visual-gold-ground-dressing.md)

## 运行时、加载与性能

- **当前**：[冷启动资产优先级与分阶段流送](cold-start-asset-streaming.md)
- **当前**：[运行时材质与 LOD 验证](runtime-material-lod-validation.md)
- **里程碑**：[突破战实例化验证](breakthrough-instancing-validation.md)
- **当前**：[突破战桌面性能收口](breakthrough-desktop-performance-closeout.md)
- **当前**：[动态表现验收](presentation-motion-validation.md)
- **当前**：[三阶段施工表现](construction-presentation-wave.md)
- **当前**：[精炼站机械卸载表现](refinery-mechanical-unload-wave.md)
- **当前**：[模型语义 Socket 接入](model-semantic-socket-wave.md)
- **当前**：[语义 Socket VFX 验证](semantic-socket-vfx-validation.md)
- **规范/资产记录**：[GLB 语义 Socket 合同](glb-semantic-socket-contracts.md)

## 战斗表现、受损与销毁

- **里程碑**：[战斗视觉第二轮](combat-visual-pass-v2.md)
- **里程碑**：[战斗 VFX 验收](combat-vfx-validation.md)
- **当前**：[战斗 VFX 状态表现](combat-vfx-presentation-wave.md)
- **当前**：[战斗 VFX 可读性第二轮](combat-vfx-readability-v2.md)
- **当前**：[语义化销毁残迹](semantic-destruction-residues.md)
- **当前**：[车辆专属残骸运行时波次](authored-vehicle-wreck-wave.md)
- **当前**：[建筑实体受损运行时波次](authored-building-damage-wave.md)
- **当前**：[建筑专属废墟运行时波次](authored-building-ruin-wave.md)
- **资产记录**：[车辆专属残骸资产](vehicle-specific-wreck-assets.md)

## 资产制作与专项验收

- **当前/方法**：[技术实现、任务编排与 Blender 流水线](implementation-workflow-and-blender-pipeline.md) —— Blender 后台生成、母版/GLB/预览、语义节点、KTX2、合同和发布流程。
- **资产记录**：[首个混合资产验证切片](asset-validation-slice.md)
- **资产记录**：[FF-RIF-01 骨骼步兵](ff-rif-01-rig-validation.md)
- **资产记录**：[六类骨骼步兵家族](infantry-family-rig-validation.md)
- **资产记录**：[玩家支援车辆金标](player-support-vehicle-visual-gold.md)
- **资产记录**：[六车同屏运行时评审](combat-vehicle-family-runtime-review.md)
- **资产记录**：[敌军车辆炮口运行时评审](enemy-vehicle-socket-runtime-review.md)
- **资产记录**：[炮击弹坑视觉金标](crater-visual-gold.md)
- **资产记录**：[核心建筑受损资产](core-building-damage-assets.md)
- **资产记录**：[核心建筑废墟资产](core-building-ruin-assets.md)
- **资产记录**：[敌军兵营/反应堆金标](enemy-barracks-reactor-visual-gold.md)
- **资产记录**：[敌军设施运行时四态](enemy-infrastructure-runtime-review.md)
- **资产记录**：[玩家兵营/反应堆金标](player-barracks-reactor-visual-gold.md)
- **资产记录**：[玩家设施运行时四态](player-infrastructure-runtime-review.md)
- **资产记录**：[敌军重炮与中继站金标](enemy-cannon-relay-visual-gold.md)
- **资产记录**：[精炼站卸矿机构资产](refinery-unload-mechanism-assets.md)

## 当前真值优先级

当多份文档出现不同测试数、资产数、对局时长或包信息时，依次采用：

1. [发布与部署就绪说明](release-readiness.md)
2. [项目复盘与技术总览](project-retrospective-and-architecture.md)
3. [黄金对局可玩性收口](golden-match-playability.md)
4. [三档难度、部署与续战入口](breakthrough-difficulty-deployment.md)
5. 具体专项的最新资产/运行时验收文档

`prototype-coverage.md`、早期 `playable-*` 和旧终局文档保留为历史证据，不再承担当前版本总览职责。
