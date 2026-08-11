# 核心建筑专属废墟波次

## 结果

玩家与敌军的总部、载具工厂现在拥有完整的四段视觉生命周期：

1. 完整建筑；
2. 生命低于 66% 的实体受损层；
3. 生命低于 30% 的濒危塌陷层；
4. 真实 `destroyed` 事件后的建筑专属废墟。

倒塌完成后，场景会关闭完整模型、施工表现、受损/濒危层、生命条、选择环和原建筑接触影，只显示资产内嵌的 `ruin_visual_root`。废墟不参与碰撞、导航、生产、目标选择或回放状态，只是权威销毁结果的表现层。

## 资产合同

四件 GLB 均在 `building_root` 下包含：

- `ruin_visual_root`：默认隐藏、由 Scene 独占显隐；
- `ruin_foundation`；
- `ruin_collapsed_structure`；
- `ruin_broken_machinery`；
- `ruin_faction_debris`；
- `ruin_marker_anchor`：距地面 1 米的低位阵营标记锚点。

每件废墟固定 4 primitives、964–1,248 triangles，复用原建筑材质和纹理。敌方底板被拆成三块断裂岛，玩家/敌军工厂保留加粗并倾倒的吊机残臂；总部以雷达与核心顶板残片保持轮廓差异。

| 资产 | 正式大小 | 总 tris / primitives | 废墟 tris / primitives | 材质 / KTX2 |
| --- | ---: | ---: | ---: | ---: |
| `ff_hq_01` | 1,539,992 B | 5,466 / 21 | 968 / 4 | 8 / 15 |
| `ff_fac_01` | 1,509,664 B | 5,010 / 21 | 964 / 4 | 7 / 15 |
| `ff_en_hq_01` | 344,264 B | 4,410 / 19 | 1,248 / 4 | 6 / 0 |
| `ff_en_fac_01` | 284,404 B | 3,578 / 19 | 1,052 / 4 | 6 / 0 |

四件 raw 共 4,725,416 B，KTX2 发布物共 3,678,324 B，减少 22.2%。旧 damage roots、门、雷达、吊机、socket、动画、父子关系与局部 TRS 均保持不变。资产生成和哈希记录见 [核心建筑废墟资产](core-building-ruin-assets.md)。

## 生命周期与隐私

- HQ/Factory 有完整废墟合同时不再叠加通用残迹。
- 车辆专属残骸、建筑专属废墟与通用残迹共享同一上限：high 12、medium 8、low/reduced 4。
- high/medium 保留 34 秒，low/reduced 保留 14 秒；超限时稳定保留最新项。
- 玩家废墟保留蓝色低位菱形；敌方废墟仅在当前位置可见时显示红色菱形，避免战争迷雾泄漏。
- `building-ruin-review` 是显式桌面评审例外，会显示四件阵营标记；普通对局仍严格遵守视野。
- 专属根缺失时回退到通用残迹，并记录 fallback；正常发布资源的 fallback 为 0。

## 真实模拟评审场景

- `/?fixture=building-ruin-review&quality=high`
- `/?fixture=building-ruin-review-reduced&quality=low`

场景只加载四件建筑资产。四门位于构图外的逻辑火炮通过真实攻击、弹道、命中和 `destroyed` 事件，在约 4.5 秒后摧毁双方 HQ/Factory；场外胜负锚点保证对局继续。普通与 reduced 版本同种子、同布局、同事件顺序。

浏览器实测：

| 画幅 | 画质 | 废墟 / 模块 | generic / fallback | markers / privacy | calls | triangles | geometries | textures |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1280×720 | high | 4 / 16 | 0 / 0 | 4 / 0 | 62 | 5,410 | 154 | 35 |
| 1440×900 | high | 4 / 16 | 0 / 0 | 4 / 0 | 58 | 5,074 | 169 | 35 |
| 1280×720 | low + reduced | 4 / 16 | 0 / 0 | 4 / 0 | 62 | 5,426 | 135 | 34 |

三种验收均为 4/4 资产完成、0 失败、0 重试、0 可见 live mesh、0 可见 damage root、0 原建筑 contact shadow。reduced 模式动态碎片为 0，控制台 warning/error 为 0。

## 质量门

- TypeScript：通过；
- Vitest：23 个文件、221 项测试全部通过；
- 正式 GLB/KTX2：42/42 通过；
- 资产 validator/mutation：10/10 通过；
- Vite 生产构建：通过，仅保留既有 Three 主包超过 500 kB 的非阻塞提示。

本波次没有修改建筑生命、攻击、碰撞、寻路、生产、胜负或存档规则。
