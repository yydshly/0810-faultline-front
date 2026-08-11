# 精炼站机械卸载波次

本批把已有 `deposit` 经济事件进一步映射到双方精炼站的真实可动部件。采集收益、单位位置、碰撞、导航与战争迷雾仍由模拟层权威决定；场景只做短时表现。

模型生成、闭/开双态预览、发布哈希与备份记录见 [精炼站机械卸矿资产验收](refinery-unload-mechanism-assets.md)。

## 资产合同

玩家与敌军精炼站使用相同语义层级：

- `intake_gate`：父节点 `intake_bay`，`presentation_role=deposit_gate`，Three.js 本地 `+Y` 开门行程 1.45 米。
- `intake_conveyor`：父节点 `intake_bay`，`presentation_role=deposit_conveyor`，只包含可动输送条；沿本地 `-Z` 以 0.45 米节距循环。
- `intake_collector`：父节点 `intake_bay`，`presentation_role=deposit_collector`，沿本地 `X` 轴以约 5.2 rad/s 转动。
- 固定入口坡道、侧轨与框架不进入可动组。

运行时只有在三项合同全部存在时才激活机械动画。局部节点缺失不会破坏卸矿收益或原有晶体转移反馈，并会记录独立降级指标。

## 状态映射

- 触发必须先通过现有 `disclosedIds`、`resource_socket` 与 `deposit_socket` 双端检查。
- 正常窗口 1.05 秒：约 0.16 秒开门，中段保持并输送，最后约 0.29 秒关门。
- 重复卸矿只延长活动窗口，不重置已经开启的门。
- 减少动态窗口 0.28 秒：门提供静态全开等价，输送条与滚筒不连续运动。
- 低画质保留门动作，冻结内部连续机构；中/高画质启用完整动作。
- 活动窗口临时强制 LOD0，结束后恢复常规视距分级。

## 性能与隐私

- 不新增运行时几何、材质、纹理或 `ActiveEffect`；只修改已加载节点变换。
- 晶体转移仍使用独立 `economy-transfer` 上限：低/中/高为 2/4/6，减少动态为 2，全局效果上限保持 128。
- 隐藏任一端时不会查询或驱动真实精炼站节点，只保留安全的 `event.at` 回退。

## 开发指标

- `refineryMechanismContracts`：当前完整三节点精炼站实例数。
- `socketRefineryMechanisms`：累计真实机械卸载触发数。
- `presentationActiveRefineryMechanisms`：当前活动实例数。
- `presentationOpenRefineryGates`：当前可见开门数。
- `presentationActiveRefineryConveyors`：当前活动输送机构数。
- `presentationActiveRefineryCollectors`：当前活动收料滚筒数。
- `refineryMechanismFallbacks`：socket 卸矿成功但机械合同不完整的次数。

## 验收

- 纯函数测试锁定节点名/角色兼容、完整合同以及开门—保持—关门时序。
- GLB 验证锁定父级、`presentation_role`、局部轴、单位旋转缩放与无网格 Empty。
- `dynamic-review&quality=high` 应捕获真实卸矿、门和输送动作，资产失败 0、socket 回退 0、机械合同回退 0、浏览器错误 0。

正式资产结果：玩家精炼站 4,796 三角形 / 12 primitives / 6 材质 / 15 张既有 KTX2 图片 / 1,474,816 bytes；敌军精炼站 3,880 / 13 / 6 / 0 / 295,240 bytes。两件未新增材质或纹理，42/42 GLB/KTX2 合同与 4 项 validator mutation 回归通过。

桌面实机结果：

- `1280×720 / high`：完整机制合同 1；真实卸矿与机械触发均由 1 增至 2；门、输送条、收料滚筒同时活动 1；两类 fallback 均为 0；动作帧 426 calls / 94,044 triangles / 231 textures / 5 effects。
- `1280×720 / low`：门仍触发，输送条与滚筒指标均为 0；367 calls / 80,628 triangles / 221 textures / 1 effect。
- 两档资产失败、重试和浏览器控制台错误均为 0。
