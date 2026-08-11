# 模型语义 Socket 接入波次

本批把已有 Blender / GLB 语义节点接入真实模拟事件。模拟状态、碰撞、寻路和单位生成位置保持权威；场景只负责表现。

Blender 后续精修必须继续满足 [GLB 语义 Socket 合同](glb-semantic-socket-contracts.md)，流水线会检查节点父级、角色、方向、局部变换与无网格属性。

## 经济卸货

- 触发：`deposit` 事件。
- 起点：采矿车 `resource_socket`。
- 终点：精炼站 `deposit_socket`。
- 规则：source 与 target 必须都在玩家当前披露集合中；任一节点缺失或未披露时只在 `event.at` 使用旧脉冲回退。
- 表现：短晶体流与接收环；高画质 3 个晶体、画质中等 2 个、低画质或减少动态 1 个静态等价。
- 生命周期：正常 0.68 秒，静态等价 0.20 秒；使用独立 `economy-transfer` 特效预算，低/中/高画质同屏上限分别为 2/4/6，减少动态上限为 2。

`intake_bay` 当前是零子节点语义空物体，没有可动闸门或传送带网格，因此本批不伪造机械动画。

## 单位出厂

- 触发：`produced` 事件。
- 工厂：`production_socket`。
- 兵营：`infantry_spawn`。
- 规则：生产建筑与新单位必须都已披露；否则使用原 `event.at` 脉冲。
- 表现：新单位视觉根节点先落在 authored socket，再插值至模拟层已经计算好的安全生成点；这不会改变权威位置或碰撞。同步显示短引导线与出口环。
- 门控：`produced` 后工厂或兵营门保持全开 0.90 秒；减少动态为 0.28 秒。门保持与吊机/生产机构活动分离，空队列不会让吊机空转。
- 生命周期：正常 0.62 秒，低画质或减少动态 0.20 秒；使用已有几何和材质。

## 损伤与摧毁锚点

- 有 `damage_socket_engine / damage_socket_turret / damage_socket_roof` 的资产，会确定性选择一个节点承载持续烟、火星与损伤反馈。
- 没有损伤节点的资产保留原有稳定随机位置，不会失去反馈。
- 有 `wreck_anchor` 的载具在摧毁时从该节点放置残迹；本批仍复用现有程序残迹，不冒充已经存在的专属残骸资产。

## 隐私和性能

- 所有双端 socket 效果先经过现有 `disclosedIds` 门控；隐藏敌军不会因为卸货或出厂特效泄漏位置或类型。
- 新效果复用几何缓存和已有材质，并通过各自效果族上限与全局效果预算自动清理。
- 出厂窗口内的新单位临时强制使用 LOD0，窗口结束后恢复常规距离分级。
- 开发指标：`socketDeposits`、`socketProductionExits`、`presentationActiveProductionExits`、`socketDamageAnchors`、`socketWreckAnchors`、`socketFallbacks`。

## 桌面动态场景证据

`dynamic-review&quality=high`，1280×720：

- 资产加载状态 `ready`，失败 0。
- 真实触发：socket 卸货 1 次、socket 出厂 3 次、损伤锚点 1 个；出厂窗口捕获到 `presentationActiveProductionExits=1`。
- socket 回退 0。
- 同帧活动效果 5，绘制调用约 421（稳定帧约 389）。
- 工厂和兵营均在真实生产/出厂窗口报告开门状态。
- 浏览器控制台错误 0，资产加载失败 0。

## 后续资产工作

下一步若要继续提高第一眼质量，需要重建或扩充以下资产合同：精炼站可动闸门/传送带、各单位专属残骸、多建筑损伤节点，以及施工阶段的基础/骨架/外壳分层。它们属于新的 Blender 资产内容，不应由运行时通用盒体伪造。
