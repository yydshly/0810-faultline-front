# 六类骨骼步兵资产与可玩遭遇战验收

## 交付范围

本批次把步兵从“只有一类正式骨骼模型”扩展为双方完整的三职业资产族：

- 玩家：`FF-RIF-01` 盾线步兵、`FF-ENG-01` 工程兵、`FF-AT-01` 反甲步兵。
- 敌军：`FF-EN-RIF-01` 步枪兵、`FF-EN-ENG-01` 工程兵、`FF-EN-AT-01` 反甲步兵。

每个职业都保留稳定的语义节点和三人小队轮廓，使用真实 Blender Armature、刚性权重分组与 27 关节骨架。每个运行时 GLB 内含 `idle / run / aim / fire / hit / death` 六段命名动作。运行时以 `SkeletonUtils` 安全克隆骨架实例，以 `AnimationMixer` 根据权威移动、攻击、受击和摧毁状态切换动作；动画只负责表现，不写回模拟或回放状态。

## 生产与发布

- 战略轮廓母版：`tools/blender/build_ff_asset_family.py`
- 统一生成脚本：`tools/blender/upgrade_ff_infantry_rig_family.py`
- 可编辑母版：`assets/3d/<asset-id>/<asset-id>_v1.blend`
- 静态来源备份：`assets/3d/<asset-id>/<asset-id>_v1_source.blend`
- 原始导出：`assets/3d/<asset-id>/<asset-id>_v1.glb`
- KTX2 运行时发布：`public/assets/models/<asset-id>_v1.glb`

第二轮战略镜头轮廓升级统一使用 0.35–0.60m 级职业识别几何：玩家步枪组使用长枪、盾面与琥珀肩甲，工程组使用双维修能量单元、顶部横梁与大工具头，反甲组使用重型肩射管、爆风环和装载手弹头箱；敌军分别使用横向盔脊重步枪、分体维修塔与双线圈、攻城发射管与宽弹翼。双方仍复用既有 6 种材质，没有新增贴图或按角色复制材质。

| 资产 | 三角形 | 材质 | KTX2 发布体积 |
| --- | ---: | ---: | ---: |
| `FF-RIF-01` | 3,704 | 6 | 1,645,564 bytes |
| `FF-ENG-01` | 4,080 | 6 | 1,690,660 bytes |
| `FF-AT-01` | 4,156 | 6 | 1,696,136 bytes |
| `FF-EN-RIF-01` | 3,136 | 6 | 462,704 bytes |
| `FF-EN-ENG-01` | 3,776 | 6 | 540,528 bytes |
| `FF-EN-AT-01` | 3,624 | 6 | 516,972 bytes |

六件原始 GLB 合计 8,153,252 bytes，运行时发布合计 6,552,564 bytes，KTX2 流水线减少 19.6%。每件资产保持一个共享小队 Skin、27 个关节和六段动作。`tools/validate_glb_contracts.py --require-ktx2` 现在同时检查语义节点、六段动画名、唯一共享 Skin、六材质预算、职业轮廓元数据与 KTX2 纹理契约；当前 42 件正式 GLB 全部通过。

## 可重复验收入口

- `/?fixture=infantry-family-review&quality=high`：六类骨骼步兵和两辆反甲目标同屏，稳定复现移动、瞄准、开火与受击状态。
- `/?fixture=infantry-family-review-reduced&quality=high`：同场景的低动效替代。
- `/?fixture=skirmish&quality=high`：双方七职业混编部队在中央信标即时接敌，并保留采集、建造、生产、科技、存档、胜负和重开完整闭环。
- `/?fixture=skirmish-reduced&quality=low`：手机和性能降级复验入口。

桌面 1440×900 实机采样中，页面同时存在 9 个骨骼实例，每个实例识别到 6 段动作，连续采样实际覆盖 `idle / run / aim / fire / hit`；遭遇战雷达识别到 7 个可见敌方目标。390×844 低画质/低动效复验无横向溢出，主要触控目标均为 44px，浏览器警告和错误日志为 0。保存战况、加入生产队列、载入战况及确定性校验均通过真实点击复验。

最终工程回归：9 个测试文件共 97 项测试通过，TypeScript 严格检查通过，42 件 GLB 资产契约通过，Vite 生产构建通过。构建只保留 Three.js 主包超过 500 kB 的性能建议警告，不影响运行；后续发布优化可将渲染引擎改为按场景动态加载。

## 来源边界

本批网格、骨架、权重、关键帧、材质和预览均由项目脚本在本机 Blender 4.5.12 LTS 离线生成。没有下载或提取《红色警戒 2 / 尤里的复仇》的模型、贴图、动画、标志或音频；参考范围仅限经典 RTS 镜头下的职责辨识、阵型密度和反馈节奏。
