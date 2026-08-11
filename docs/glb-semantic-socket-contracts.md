# GLB 经济与生产语义节点合同

`tools/validate_glb_contracts.py` 对玩家与敌军的经济、生产资产执行对称合同。合同只锁定运行时接口，不锁定可继续精修的外观网格、轮廓尺寸或装饰几何。

## 已锁定接口

| 资产族 | 节点 | 父节点 | `socket_role` | 局部坐标语义 |
| --- | --- | --- | --- | --- |
| 双方采矿车 | `resource_socket` | `cargo_bed` | `cargo_visual_origin` | 位于货斗上方、局部后方（`-Z`）；这是货物表现起点，不是车辆出口 |
| 双方精炼站 | `intake_bay` | `building_root` | 必须无该字段 | 零点附近的语义舱位；它不是 socket，不能伪装成运行时挂点 |
| 双方精炼站 | `deposit_socket` | 各自资产根节点 | `harvester_deposit` | 地面附近、建筑外侧局部 `+Z` |
| 双方工厂 | `production_socket` | 各自资产根节点 | `vehicle_spawn` | 中线附近、地面附近、建筑外侧局部 `+Z` |
| 双方兵营 | `infantry_spawn` | 各自资产根节点 | `infantry_spawn` | 中线附近、地面附近、建筑外侧局部 `+Z` |

所有上述节点必须保持为无网格、无矩阵覆盖的局部 TRS 节点，旋转与缩放保持单位值。这样运行时可直接将节点局部轴解释为资产轴，而不会受到隐藏矩阵、镜像缩放或轴翻转影响。

## 精炼站可动表现接口

精炼站另锁定三件无网格 Empty。它们使用 `presentation_role`，不是玩法 socket：`intake_gate / deposit_gate` 以本地 `+Y` 抬升 1.45 米，`intake_conveyor / deposit_conveyor` 以本地 `-Z` 按 0.45 米条带节距循环，`intake_collector / deposit_collector` 绕本地 `X` 轴转动。三者都直接挂在 `intake_bay` 下，并必须保留至少一个可见子节点。完整资产、预算与闭/开预览证据见 [精炼站机械卸矿资产验收](refinery-unload-mechanism-assets.md)。

## 精修容差

合同使用范围而非精确浮点坐标。后续可在 Blender 中调整门廊深度、出口距离、采矿车货斗高度和横向偏移；只要节点仍处于其功能区域、保持正确父节点和朝向，验证不会阻止精修。若需要改变轴语义或父节点，应作为运行时接口迁移处理，而不是普通美术调整。

正式发布检查：

```text
python tools/validate_glb_contracts.py public/assets/models --require-ktx2
```

最小合同回归：

```text
python tools/test_validate_glb_contracts.py
```
