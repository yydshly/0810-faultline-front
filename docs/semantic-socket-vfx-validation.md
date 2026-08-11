# 语义插槽战斗反馈验收

本轮只读取已经披露的场景实体与既有 `shot / repair` 事件，不修改射击、维修、视野、模拟状态或回放数据。

- `shot` 优先使用模型的 `muzzle_socket`；双联武器从 `muzzle_socket_left / muzzle_socket_right` 按事件稳定选择。枪口焰和弹丸都从插槽的真实世界坐标与高度出发；缺少插槽时继续使用原有通用偏移。
- `repair` 仅在来源实体已经披露时读取 `repair_tool_socket`，从工具头到事件位置显示短维修束和接触环；隐藏来源或缺少插槽时保留原有维修脉冲。
- `launcher_pitch` 只保存为表现绑定，不驱动玩法或瞄准状态。
- 维修束复用场景缓存的几何体与既有材质。低画质和降动态模式保留短暂静态束与接触点，不播放连续脉动。

开发画布提供累计指标 `socketShots / socketRepairs / socketFallbacks`，用于确认正式模型插槽命中与回退路径。
