# FF-RIF-01 骨骼资产生产与验证记录

## 生产契约

- 可编辑母版：`assets/3d/ff_rif_01/ff_rif_01_v1.blend`
- 静态来源备份：`assets/3d/ff_rif_01/ff_rif_01_v1_source.blend`
- 生成脚本：`tools/blender/upgrade_ff_rif_01_rig.py`
- 原始导出：`assets/3d/ff_rif_01/ff_rif_01_v1.glb`
- 浏览器发布副本：`public/assets/models/ff_rif_01_v1.glb`
- 校准预览：`assets/3d/ff_rif_01/ff_rif_01_v1_preview.png`

模型保持三人小队作为一个权威玩法单位。三名成员共享一个 Armature，共 27 个关节；可见几何按 6 种材质合并为 6 个蒙皮网格，稳定语义节点 `squad_root / soldier_lead / soldier_left / soldier_right / muzzle_socket / selection_anchor` 保持不变。

同一 GLB 内含六段命名动作：`rifle_idle`、`rifle_run`、`rifle_aim`、`rifle_fire`、`rifle_hit`、`rifle_death`。运行时使用 SkeletonUtils 安全克隆骨架，并由 AnimationMixer 根据权威移动、攻击、后坐、受击和摧毁状态切换动作；动画不写回模拟或回放状态。

## 发布与性能

- KTX2 发布 GLB：1,845,264 bytes
- GLB 节点：41
- 运行时网格：6
- 材质：6
- Skin：1
- 关节：27
- 动画：6，每段 81 条通道
- 压缩前后：2,371,812 → 1,845,264 bytes，减少 22.2%

`tools/validate_glb_contracts.py --require-ktx2` 同时检查稳定节点、六段动画名和 KTX2 纹理契约。当前 42 件 GLB 全部通过。

## 实机验证

- 夹具：`/?fixture=infantry-rig-review&quality=high`
- 降动态：`/?fixture=infantry-rig-review-reduced&quality=high`
- 桌面 1280×720：4 个场景内骨骼实例、每实例 6 段动作；采样实际覆盖 run、aim、fire、hit、death、idle。
- 手机 390×844：4 个骨骼实例、6 段动作；记录为 103 calls / 19,582 triangles / 45 textures，模型和底部指令区均保持可见。
- 降动态 390×844：`presentationReducedMotion=true`，骨骼姿态冻结为静态替代；85 calls / 18,874 triangles / 45 textures。
- 浏览器警告和错误日志：0。
- 自动化：TypeScript 通过，9 个测试文件共 95 项测试通过，Vite 生产构建通过。

## 来源与许可边界

本资产的网格、骨架、权重、动作关键帧、材质和预览均由项目内脚本在本机 Blender 4.5.12 LTS 离线生成。没有下载模型、扫描数据、动作捕捉、第三方贴图、商业游戏网格或从《红色警戒 2 / 尤里的复仇》提取的资源。参考游戏只用于战略镜头下的可读性、编队密度和操作节奏方向，不复制其受保护的具体造型、贴图、标志或动画。
