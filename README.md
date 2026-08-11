# 《断层战线》可玩原型 v0.6

[![Quality Gate](https://github.com/yydshly/0810-faultline-front/actions/workflows/quality.yml/badge.svg)](https://github.com/yydshly/0810-faultline-front/actions/workflows/quality.yml)
[![Deploy Pages](https://github.com/yydshly/0810-faultline-front/actions/workflows/pages.yml/badge.svg)](https://github.com/yydshly/0810-faultline-front/actions/workflows/pages.yml)

《断层战线》是一款原创浏览器桌面即时战略原型。当前版本围绕“灰烬环线”单张 160×160 平面战场，验证经典基地建设 RTS 的选择、编队、采集、建设、生产、防御、战斗、情报、科技与胜负闭环。

源码仓库：<https://github.com/yydshly/0810-faultline-front>

在线体验：<https://yydshly.github.io/0810-faultline-front/>

版本制品：[GitHub Releases](https://github.com/yydshly/0810-faultline-front/releases)

v0.6 以《红色警戒 2 / 尤里的复仇》的经典操作语法为参考，形成“左侧战场、右侧固定指挥栏”的桌面构图：雷达、资源、工具和四类生产队列沿右栏连续阅读；地图地表、道路、基地铺装、矿区、地标、建筑和载具则全部使用原创程序化资产重新塑形。

## 运行

```powershell
npm.cmd install
npm.cmd run dev
```

规范本地地址：<http://127.0.0.1:4180/>

根地址现在先显示“突破战”任务简报，并在模拟时间 00:00 暂停等待选择新兵、标准或老兵难度；若当前浏览器保存了有效的突破战，还可直接从同一简报继续对应难度和时间点。旧的自由经营沙盒仍可通过 `/?fixture=default` 打开。

工程检查：

```powershell
npm.cmd test
npm.cmd run build
```

## 文档导航

- [项目复盘与技术总览](docs/project-retrospective-and-architecture.md)：从立项到当前目标的动作、问题、解决方案、实际技术架构与后续优化。
- [技术实现、任务编排与 Blender 流水线](docs/implementation-workflow-and-blender-pipeline.md)：剧情如何变成确定性任务，大模型如何调度 Blender 生产、验证和发布游戏资产。
- [完整文档索引](docs/index.md)：按当前真值、设计规范、历史里程碑和资产记录整理全部文档。
- [原创游戏设计方案](docs/faultline-front-game-design.zh-CN.md)：产品方向和长期愿景；其中部分架构建议尚未落地。
- [黄金对局可玩性收口](docs/golden-match-playability.md)：当前默认对局和真实验收证据。
- [GitHub Pages 部署与线上验收](docs/github-pages-deployment.md)：公开地址、部署链、子路径处理、实机证据与回滚。
- [发布与部署就绪说明](docs/release-readiness.md)：最终 ZIP、SHA256、线上部署、启动、验收和回滚。

## 默认黄金对局

- 新兵、标准、老兵使用各自的确定性场景地址、耐久、阶段时窗与任务波次；标准为推荐档，旧 `breakthrough-demo` 存档继续按标准难度读取，不同难度不会混用存档。
- 开局先完成一次辉晶卸矿、建成一座哨戒塔，并从载具工厂生产一辆战斗车辆；左上任务入口常驻显示三项整备进度。
- 整备完成后依次进入前沿突破、装甲反扑、友军增援与最终指挥核心决战；可摧毁敌方总部，或在后期占领中央信标获胜。
- 任务与操作指南作为战术遮罩打开时会暂停模拟，关闭后继续，不会让玩家阅读说明时在后台损失部队。
- 本地保存的突破战会在根任务简报显示难度与作战时间；继续时先进入存档对应的确定性场景再恢复，失效存档会安全停在 00:00 简报，不会静默开始错误的新局。
- 代表性确定性流程在 08:56 自然胜利；终局弃守会触发敌军攻入总部并自然失败，目标桌面游玩时长为 8–12 分钟。完整证据见 [黄金对局可玩性收口](docs/golden-match-playability.md) 与 [三档难度、部署与续战入口](docs/breakthrough-difficulty-deployment.md)。

## 主要操作

- 左键：选择；拖动框选；Shift 追加或移除。
- 右键：编队移动、攻击、采集、工兵维修，或为建筑设置集结点。
- A：移动攻击；S/H：停止。
- Ctrl + 1–9：记录编队；1–9：选择；快速再次按数字聚焦。
- B：快速进入反应堆放置；R：旋转；Escape：取消或关闭。
- 鼠标中键、屏幕边缘或方向键：移动镜头；滚轮：缩放；Space：聚焦选择。
- 右侧指挥栏：在“建筑 / 防御 / 步兵 / 载具”四类生产页间切换；研究与可取消项目保留 75% 退款操作。
- 左侧“保存战况 / 载入战况”：用确定性命令记录保存到当前浏览器；返回根地址后可从任务简报继续有效的突破战存档。
- 左侧声音按钮：首次手势后启用声音；可随时静音或恢复，偏好保存在当前浏览器。
- 雷达小地图：左键点击或按住拖动可直接定位镜头；键盘聚焦后按 Enter / Space 返回最近的小地图焦点。
- 难度：根地址任务简报中选择；对局内可从系统工具安全重新部署并更改，结算页可按当前难度再次部署或返回难度简报。

## v0.6 视觉与界面

- 1181px 以上采用经典 C&C 桌面构图：战场占左，316px 连续金属指挥栏固定在右，资源、雷达、任务入口、生产页签和纵向队列形成一条操作路径。
- `visual-gold-review`、建筑四态、敌我设施、载具炮口与六车同屏评审是桌面资产验收例外：它们临时折叠 316px 指挥栏，以完整战场宽度检查模型、入口、接地、实体破损/废墟、武器挂点与固定构图；普通对局布局不受影响。
- 第二批桌面金标已补齐总部/工厂的中尺度表面与非碰撞入口铺装；契约见 [地表铺装](docs/visual-gold-ground-dressing.md)，实机证据见 [1440×900](docs/qa/visual-gold-v2-1440x900-high.png) 与 [1280×720](docs/qa/visual-gold-v2-1280x720-high.png)。
- 第三批桌面金标已替换玩具感较强的规则黑盘矿床与红方垫哨塔，保留原资产身份和语义契约；实机证据见 [1440×900](docs/qa/visual-gold-v3-1440x900-high.png) 与 [1280×720](docs/qa/visual-gold-v3-1280x720-high.png)，完整指标见 [桌面视觉金标](docs/desktop-visual-gold-validation.md)。
- 普通桌面对局现采用原创的经典 C&C/RA2 信息架构：316px 右侧指挥栏连续承载资源状态、雷达、四类生产、队列与系统工具，底部命令坞不再侵入侧栏。实机证据见 [1440×900](docs/qa/desktop-command-sidebar-v1-1440x900-high.png)、[1280×720](docs/qa/desktop-command-sidebar-v1-1280x720-high.png) 与 [验收契约](docs/desktop-command-sidebar-contract.md)。
- 战场阵营识别统一为蓝方/红方：三维标记、选择圈、生命条阵营框、雷达和 HUD 使用同一套可扩展颜色令牌；生命条黑底遮盖填充的问题已经修复。完整规则与桌面实测见 [阵营识别与生命条呈现合同](docs/faction-health-presentation.md)。
- 采矿卸货、工厂/兵营出厂、已有损伤位置与载具残迹现在消费正式 GLB socket；缺节点与未披露敌军继续安全回退。状态映射、特效预算和桌面证据见 [模型语义 Socket 接入波次](docs/model-semantic-socket-wave.md)。
- 双方精炼站的卸矿入口使用真实门、输送条与收料滚筒节点；高/中画质运行完整机械动作，低画质与减少动态保留等价反馈。合同与时序见 [精炼站机械卸载波次](docs/refinery-mechanical-unload-wave.md)。
- 建筑施工不再纵向拉伸完整模型；地基、钢架、外壳三阶段使用权威进度和共享实例批次，正式外壳始终保持自然比例。预算与生命周期见 [三阶段施工表现](docs/construction-presentation-wave.md)。
- 双方主战坦克与采矿车现内置车型专属残骸；真实摧毁事件结束后切换轮廓，低位阵营色标记保留敌我识别，且与通用残骸共享质量上限。资产与桌面实测见 [车辆专属残骸验收](docs/authored-vehicle-wreck-wave.md)。
- 双方总部、载具工厂、兵营与反应堆现均内置互斥的受损/濒危实体层；66% / 30% 权威生命阈值会切换缺口、弯板、塌陷与瓦砾，同时保持烟火、生命条和迷雾隐私。完整结果见 [核心建筑实体受损波次](docs/authored-building-damage-wave.md)、[敌军兵营/反应堆金标](docs/enemy-barracks-reactor-visual-gold.md) 与 [玩家兵营/反应堆金标](docs/player-barracks-reactor-visual-gold.md)。
- 双方总部、载具工厂、兵营与反应堆现均内置建筑专属废墟；真实销毁后会从濒危层倒塌为低矮残墙、设备残片和断裂阵营构件，并与车辆残骸、通用残迹共享上限。完整结果见 [核心建筑专属废墟波次](docs/authored-building-ruin-wave.md)、[敌军兵营/反应堆金标](docs/enemy-barracks-reactor-visual-gold.md) 与 [玩家设施运行时四态验收](docs/player-infrastructure-runtime-review.md)。
- 没有专属残骸的单位不再共用“坦克废铁”：侦察车、压制车与自行火炮分别生成轻型、宽低装甲与长底盘残迹，三类步兵在死亡表现结束后只留下焦痕；未知类型只生成中性碎片。规则、预算与实机证据见 [语义化销毁残迹](docs/semantic-destruction-residues.md)。
- 敌军重炮与中继站已升级为独立战略轮廓：重炮拥有宽炮盾、粗后膛、长炮管和真实俯仰域，中继站拥有粗桅杆、碟面与叉形阵列；两件均未增加原有 primitive 数。完整结果见 [敌军重炮与中继站资产验收](docs/enemy-cannon-relay-visual-gold.md)。
- 玩家侦察车、压制车与自行火炮已重制为灰绿/深灰支援车辆家族：四轮叉形雷达、宽体六轮双炮和履带长炮三种轮廓在战略镜头中直接区分；三件合计由 69 降至 35 个 primitive、9,768 降至 6,288 三角形，并移除原先重复嵌入的 54 张 KTX2。完整结果见 [玩家支援车辆金标](docs/player-support-vehicle-visual-gold.md) 与 [六车同屏运行时评审](docs/combat-vehicle-family-runtime-review.md)。
- 敌军压制车双炮口与自行火炮炮口的父子层级现由精确资产合同锁定；真实开火评审中左/右/单炮口均被消费且回退为零，证据见 [炮口运行时评审](docs/enemy-vehicle-socket-runtime-review.md)。
- 敌军兵营与反应堆已替换为原创黑铁/暗红中尺度轮廓，并具备健康、受损、濒危和废墟四态；专用评审场景以真实炮击验证状态切换，1440×900 证据见 [截图](docs/qa/enemy-infrastructure-review-1440x900-high.png)。
- 玩家兵营与反应堆已重制为低矮训练大厅和开放式能源站，健康态都压到 8 个 primitive，并补齐受损、濒危和专属废墟；真实炮击四态证据见 [初始矩阵](docs/qa/player-infrastructure-review-initial-1440x900-high.png)、[双废墟终态](docs/qa/player-infrastructure-review-ruins-1440x900-high.png) 与 [运行时验收](docs/player-infrastructure-runtime-review.md)。
- 高频炮击弹坑已由 14 primitives / 2,164 triangles 的规则圆环组重制为 3 / 139 的断裂椭圆坑缘、暗芯和方向性翻土；战略镜头证据见 [1440×900](docs/qa/crater-strategic-1440x900-high.png) 与 [资产验收](docs/crater-visual-gold.md)。
- 突破战可见生命条由 39 次独立绘制合并为 3 个动态批次，同窗峰值由 653 降至 605；编队共享路径点软锁、舞台被裁切时的边缘滚屏和侧栏附近建筑拾取均已修复。当前黄金路线以真实经济整备起步，三项整备拥有可点击引导，并在代表性流程中于 08:56 自然胜利；弃守也会自然失败。见 [黄金对局可玩性收口](docs/golden-match-playability.md) 与 [编队导航收口](docs/breakthrough-formation-navigation-closeout.md)。
- 四类生产页签使用语义 `tab/tabpanel`，支持点击、方向键和 Home/End；卡片显示费用、锁定、生产/建造进度与可取消状态。
- 1180px 以下右栏成为带遮罩叠层；760px 以下成为命令坞上方工作表，保留 Escape、焦点返回、44px 触控目标与降动效规则。
- 地面使用 512² 确定性土壤细节纹理与磨损斑块，替代工程网格；道路加入颗粒磨损、路肩、中心标线和基地警戒铺装，矿区增加污染地表与识别环。
- 开局基地铺装增加阵营色边界、维护沟槽和批量实例化检修盖板；战争迷雾采用青黑分级与邻格羽化，隐藏单位规则不变但亮区不再像硬切黑岛。
- 南北工业地标、中央信标广场、边缘碎石和基地平台强化首屏构图，同时保持所有玩法坐标在同一平面。
- 建筑共享厚重基座、角部装甲、铜色结构件和阵营识别条；车辆补齐轮组/履带、斜面首上甲、舱体、炮塔、车灯与功能部件，步兵增加头盔、护肩、背包和武器轮廓。
- 运行时资产已形成四十二件 Blender 资产族：玩家车辆、步兵、建筑、环境资产之外，敌方八类单位与八座建筑已完整采用独立黑铁/暗红模型语言；它们在真实对局中加载 GLB，并保留稳定功能节点与程序模型回退。
- 重型命中与摧毁会留下最多 28 秒的共享材质焦痕；焦痕受统一特效数量上限约束、不进入权威状态，降动效模式保持静态反馈。
- 车辆按实际移动距离生成低矮尘土，爆炸烟雾使用独立短生命周期；最远缩放档裁减植被和小物细节，宽镜头绘制调用与三角形均降低约 14%。
- 外围灌木资产已按三种材质离线合并：单件由 32 个 primitive / 3,904 三角形降为 3 个 primitive / 1,600 三角形；十二个场景克隆的理论材质绘制由 384 次降为 36 次，校准预览轮廓保持一致。
- 导入材质默认由各自 GLB 独立拥有；即使材质名称相同，也不会跨资产覆盖贴图或 PBR 参数。只有离线验证过、显式声明同一共享组且描述签名完全一致的材质才允许复用，加载先后不再改变模型外观。
- 渲染提供高/中/低三档并可在任务抽屉中即时循环切换：依次调整像素比例上限、阴影图、各向异性过滤、植被/小物裁减和装饰特效预算；低档优先削减装饰，不改变单位、命令、战争迷雾或战斗反馈。
- 当前四十二件运行时 GLB 均通过 KTX2/资产契约检查：十七件含纹理资产合计 21,249,264 bytes（约 21.25 MB），二十五件无贴图 PBR 资产 5,405,704 bytes（约 5.41 MB），总计 26,654,968 bytes（约 26.65 MB）；有纹理资产的法线图采用 UASTC，BaseColor/ORM 采用 ETC1S。
- 导入材质在运行时统一功能色强度：辉晶与状态灯保持青色、敌军信号保持红色，避免高画质太阳光下过曝成白色。
- 参考只用于经典 RTS 的信息层级和辨识原则；运行时图形、文字、材质、模型与音频均为项目原创或程序生成，详见 [资产来源](docs/asset-provenance.md)。

## 战斗视觉反馈

- 炮口闪光从单位或防御塔轮廓外缘发出，配合白热弹芯、阵营色尾迹、地面冲击环、火花、烟柱与焦痕，形成完整的开火—飞行—命中—摧毁链路。
- 高画质增加火花和烟团层次；低画质优先削减装饰粒子并关闭履带尘土，但保留炮口、弹道和命中核心信号；降动效模式使用更短、更静态的反馈。
- 载具在生命低于 55% / 28% 时切换烟火强度；建筑按 66% / 30% 切换实体破损、烟雾与火芯。瞬时特效统一受 128 个上限约束，履带尘土使用最多 24 个对象的复用池。
- 实机预算、手机视口和效果生命周期详见 [战斗视觉反馈验收](docs/combat-vfx-validation.md)。

## v0.4 规则

- 友军视野实时揭示战场；离开后保留已探索地形，但不保留敌军实时位置。
- 联网、完工且供电正常的指挥核心与后勤节点提供雷达；低电会让扩展雷达离线。
- “高效精炼”提高 20% 回炼收入；“复合装甲”提高 15% 生命上限；“信号增幅”提高 35% 雷达范围。
- 施工、当前生产与当前研究均可取消，且每个项目只返还一次基础成本的 75%。
- 隐藏敌军不能被拾取或指定攻击，也不会出现在小地图；敌方 AI 同样只能感知当前可见目标。
- 哨戒塔擅长压制步兵与轻甲；重炮塔射速较慢，但对重甲和建筑更有效并带小范围伤害。
- 防御塔只攻击当前可见目标；施工中、断网、未供电或电力低于 70% 时停火，条件恢复后自动继续警戒。
- 敌方 AI 会在基地受压时优先部署哨戒塔，并在经济、电力与科技储备允许时补充重炮塔。
- 程序化音效覆盖命令、轻/重射击、命中、摧毁、采集入账和完成提示；高频事件会节流，声部总数受限。
- 回放格式为 v3，防御塔权威状态进入哈希；旧 v2 存档有意不兼容，声音偏好不进入回放。
- 本地存档绑定创建它的场景；在另一评审或关卡路由载入会先给出提示并拒绝重建，避免沿用错误的迷雾、资产白名单或 HUD 状态。

## 可复现夹具

- `/?fixture=combat`：中央快速交战。
- `/?fixture=combat-reduced`：同一中央交战的降动态版本，用于验证静态命中替代与特效裁剪。
- `/?fixture=hero-tank-review`：玩家与敌军主战坦克同场对照，聚焦移动、瞄准、后坐、受击和摧毁闭环。
- `/?fixture=wreck-review&quality=high`：四类车辆专属残骸桌面评审；延迟 4.5 秒后由真实战斗同时摧毁双方坦克与采矿车。
- `/?fixture=wreck-review-reduced&quality=low`：同一残骸评审的低画质、减少动态等价版本。
- `/?fixture=destruction-residue-review&quality=high`：六个真实低生命目标同窗被摧毁，用于检查三类车辆残迹与三类步兵仅留焦痕的桌面评审。
- `/?fixture=destruction-residue-review-reduced&quality=low`：同一语义残迹评审的低画质、减少动态等价版本。
- `/?fixture=building-damage-review&quality=high`：双方总部/工厂两排实体破损评审；上排 52% 受损，下排 22% 濒危，只加载四件建筑资产。
- `/?fixture=building-damage-review-reduced&quality=low`：同一实体破损评审的低画质、减少动态等价版本。
- `/?fixture=building-ruin-review&quality=high`：双方总部/工厂真实摧毁与四件专属废墟桌面评审，只加载四件建筑资产。
- `/?fixture=building-ruin-review-reduced&quality=low`：同一废墟评审的低画质、减少动态等价版本。
- `/?fixture=enemy-infrastructure-review&quality=high`：敌军兵营/反应堆健康、52% 受损、22% 濒危与真实摧毁四态桌面评审，只加载两件目标建筑资产。
- `/?fixture=player-infrastructure-review&quality=high`：玩家兵营/反应堆健康、52% 受损、22% 濒危与真实摧毁四态桌面评审，只加载两件目标建筑资产。
- `/?fixture=enemy-vehicle-socket-review&quality=high`：敌军压制车与自行火炮持续真实开火评审；验证左右双炮口、单炮口、炮塔偏转、炮管俯仰与零回退。
- `/?fixture=combat-vehicle-family-review&quality=high`：玩家/敌军侦察车、压制车、自行火炮三行两列同屏评审；固定战略镜头、无战斗干扰、严格只加载六件车辆资产。
- `/?fixture=infantry-rig-review`：聚焦盾线步兵三人共享骨架的移动、瞄准、开火、受击和死亡闭环。
- `/?fixture=infantry-rig-review-reduced`：同一骨骼步兵审阅场景的降动态静态替代。
- `/?fixture=infantry-family-review`：同屏审阅双方步枪、反甲、工程兵六套正式骨架与动作状态。
- `/?fixture=infantry-family-review-reduced`：六套步兵骨架的低动效静态替代版本。
- `/?fixture=skirmish`：中央完整混编部队即时交战，可继续采集、建造、生产、研究并打到胜负。
- `/?fixture=skirmish-reduced`：同一可玩遭遇战的低动效版本。
- `/?fixture=campaign-demo`：正式可玩演示关卡；基地、生产、防御、混编部队、敌军进攻和即将解锁的中央信标同场运行。
- `/?fixture=campaign-demo-reduced`：同一演示关卡的手机/低动效版本。
- `/?fixture=breakthrough-demo`：默认桌面黄金对局；从真实经济整备开始，经历前沿、反扑、增援和指挥核心决战。
- `/?fixture=breakthrough-demo-cadet`：新兵难度；我方初始部队更耐久、增援更多，最终攻势更迟。
- `/?fixture=breakthrough-demo-veteran`：老兵难度；敌军更坚韧，反扑和最终攻势更早、更重。
- `/?fixture=breakthrough-demo-reduced`：同一突破战的手机/低动效版本。
- `/?fixture=breakthrough-demo-victory-review&quality=high`：确定性触发胜利结果、原因文案与“再次部署”回到普通突破战。
- `/?fixture=breakthrough-demo-defeat-review&quality=high`：确定性触发失败结果、原因文案与“再次部署”回到普通突破战。

突破战现包含五阶段确定性任务导演：部署、前沿突破、装甲反扑、友军增援和指挥核心决战。阶段状态与波次单位进入回放哈希，完整契约见 `docs/breakthrough-mission-director.md`。
- `/?fixture=beacon`：信标即将解锁。
- `/?fixture=asset-review`：直接审阅完整载具与地表资产。
- `/?fixture=enemy-review`：固定陈列敌方八类单位母资产，不参与战斗或寻路。
- `/?fixture=enemy-base-review`：固定陈列敌方八座建筑母资产，关闭战争迷雾用于纯视觉审阅。
- `/?fixture=dynamic-review`：审阅由真实模拟状态驱动的载具、步兵、生产、施工与受损动态表现。
- `/?fixture=dynamic-review-reduced`：审阅同一场景的降动态静态替代，保留状态可读性但关闭摇摆、粒子和脉冲。
- `/?fixture=construction-review&quality=high`：桌面施工阶段矩阵；双方七类可建建筑按地基、钢架、外壳三个进度陈列。
- `/?fixture=construction-review-reduced&quality=high`：同一桌面矩阵的减少动态等价，用于验证静态扫描和阶段可读性。
- `/?fixture=visual-gold-review&quality=high`：桌面 Web 第一眼视觉金标；固定总部、载具工厂、坦克、采矿车、三类步兵、矿区和少量敌方对照，使用 12 件正式资产白名单与紧凑评审 HUD。验收结果见 [桌面视觉金标](docs/desktop-visual-gold-validation.md)。
- `/?seed=1949`：指定确定性种子。
- `/?quality=high|medium|low`：强制渲染画质；未指定时按视口、像素密度与设备内存自动选择，并可在游戏内切换。
- `/?fallback=webgl`：验证无 WebGL 时的能力边界界面。

## 代码分层

- `src/game/simulation.ts`：不依赖 DOM/Three.js 的固定步进规则。
- `src/game/visibility.ts`：双阵营确定性可见/已探索网格。
- `src/game/technology.ts`：科技定义、进度、效果与取消退款纯函数。
- `src/game/pathfinding.ts`：确定性网格 A*、净空与障碍栅格化。
- `src/game/ai-planner.ts`：五状态 AI、可见目标输入与研究意图。
- `src/game/difficulty.ts`：三档突破战难度、中文文案与确定性场景地址映射。
- `src/game/saved-deployment.ts`：严格解析本地突破战存档摘要，只向部署简报暴露已验证的难度、种子和作战时间。
- `src/game/replay.ts`：版本化命令日志、严格校验与确定性重放。
- `src/game/review-presentation.ts`：评审专用隐藏层与场景绑定存档的共享纯规则。
- `src/game/audio.ts`：用户手势解锁的程序化 Web Audio 反馈、节流与声部管理。
- `src/game/level.ts`：稳定关卡锚点、资源、阻挡和初始夹具。
- `src/game/scene.ts`：Three.js 战场、程序化模型、迷雾、镜头与反馈。
- `src/ui.ts`：语义 HUD、桌面经典指挥侧栏、四类生产页签、部署/续战入口与焦点管理、防御状态、研究、取消、音频、小地图和响应式控制。
- `src/main.ts`：输入映射、固定步长循环、情报过滤、音频、一次性续战导航、存档身份锁定、失败回退与模块组装。

当前自动化结果为 33 个测试文件、319 项测试全部通过；TypeScript、42/42 GLB 资产契约（其中 17 件有纹理资产满足 KTX2 合同）、21 项验证器变异测试与 Vite 生产构建（36 modules）均已验证。完整范围见 [交付契约](docs/prototype-delivery-contract.md)、[覆盖清单](docs/prototype-coverage.md)、[三档难度、部署与续战入口](docs/breakthrough-difficulty-deployment.md)、[车辆专属残骸验收](docs/authored-vehicle-wreck-wave.md)、[核心建筑实体受损波次](docs/authored-building-damage-wave.md)、[核心建筑专属废墟波次](docs/authored-building-ruin-wave.md)、[敌军设施运行时四态验收](docs/enemy-infrastructure-runtime-review.md)、[玩家设施运行时四态验收](docs/player-infrastructure-runtime-review.md)、[玩家支援车辆金标](docs/player-support-vehicle-visual-gold.md)、[六车同屏运行时评审](docs/combat-vehicle-family-runtime-review.md)、[炮口运行时评审](docs/enemy-vehicle-socket-runtime-review.md)、[语义化销毁残迹](docs/semantic-destruction-residues.md)、[敌军重炮与中继站资产验收](docs/enemy-cannon-relay-visual-gold.md)、[桌面终局可玩性收口](docs/desktop-terminal-playability-closeout.md) 与 [桌面视觉金标契约](docs/visual-gold-contract.md)。

## 英雄资产基准

- `FF-MBT-01 堡垒坦克` 已从验证级程序模型升级为首件正式视觉基准：低矮重装轮廓、闭合履带、装甲分片、炮塔光学件和受控阵营色。
- 18 张 PBR 纹理由 256² 提升为 512²；运行时仍使用 KTX2，发布 GLB 为 2.44 MB。
- Blender 编辑母版保留全部命名零件，导出阶段按材质和动画域合并为 17 个运行时网格；`turret_yaw / barrel_pitch / muzzle_socket / selection_anchor` 契约保持不变。
- 这是一套战略镜头下的美术基准，不是假装完成了最终人工磨损、编号和徽记精修；后续载具与建筑应继承它的材质比例和识别色规则。

英雄坦克母版 v3 已统一玩家与敌军主战坦克的战略镜头质量标尺。玩家坦克保留轮组端盖、前装甲筋、炮塔尾舱、烟幕发射器、遥控武器站与车顶识别信息；敌军坦克升级为完整履带块/轮毂、分段侧裙、灯组、排气、炮塔尾舱、烟幕发射器、舱盖与光学设备，并接入同密度的 512² PBR 材质。双方新增发动机、炮塔受损发射点和残骸替换锚点，KTX2 运行时 GLB 均由 E 盘 Blender 母版重建；`hero-tank-review` 与 `breakthrough-demo` 用于复验瞄准、后坐、受击、摧毁和真实战场可读性。

`FF-RIF-01 盾线步兵` 现已升级为首件正式骨骼步兵资产：三名成员共享 27 关节骨架，按材质合并为 6 个蒙皮网格，并在同一 GLB 内发布 `idle / run / aim / fire / hit / death` 六段动作。Three.js 运行时使用骨架安全克隆和 AnimationMixer 按权威战场状态切换动作；`infantry-rig-review` 与降动态夹具用于桌面和手机复验。完整生产与验证记录见 [FF-RIF-01 骨骼资产记录](docs/ff-rif-01-rig-validation.md)。

正式骨骼资产现已覆盖双方步枪、反甲和工程兵六类小队。职业轮廓 v3 在不新增材质和贴图的前提下补齐盾线步兵前臂盾、工程兵维修设备框/工具臂、反甲兵背负弹药/重肩甲/发射器护盾，以及敌军对应的胸甲、非对称背架和高位识别件；六队仍保持 6 材质、6 段动作并全部低于 8,000 三角形。`infantry-family-review` 用于同屏动作验收，`skirmish` 提供可立即开战且保留完整经济、建造、科技、存档与胜负闭环的可玩场景。批量 Blender 生成、KTX2 发布与实机证据见 [六类骨骼步兵与遭遇战验收](docs/infantry-family-rig-validation.md)。

第二批开局核心资产也已接入同一基准：`FF-HRV-01 辉晶采集车`、`FF-HQ-01 指挥中心`、`FF-REF-01 精炼站` 与 `FF-FAC-01 载具工厂`。采矿车强化前置采集滚筒、闭合履带和可见货舱；三座建筑缩减整块橙色结构，改用深色装甲、金属屋顶结构、少量危险标记与青色工作信号。四件 KTX2 发布模型合计 6,380,112 bytes（约 6.38 MB），功能节点和玩法状态保持不变。

敌军核心资产 v2 现已同步：采矿车具备完整履带块/轮毂、分层驾驶舱、货舱支架、采集护栏与受损锚点；总部补齐纵深入口、坡道、门灯、塔顶分层和雷达环；工厂补齐装卸坡道、厚重扶壁、屋顶服务板和排气组。三件几何 GLB 使用无贴图 PBR 材质，不重复嵌入纹理。加载器按真实关卡内容请求资产：普通开局为 28/42 件，突破战按关键实体、地表和装饰三阶段加载；失败自动重试一次，聚焦评审仍只加载必要模型。

战场地表也已进入同一视觉基准：确定性灰烬土层包含压实车辙、碎石与锈尘，基地铺装使用带分缝、裂纹和油污的工业混凝土，道路增加碎石肩和单网格磨损中线。全局天光与太阳光重新平衡以托起深色模型；所有变化仅存在于视觉层，关卡仍保持单一玩法平面，碰撞、寻路与稳定锚点不变。

动态表现同样复用正式母资产的语义节点：载具按真实位移产生车体重量变化与轮组转动，三人步兵使用错相步态，工厂和兵营按生产队列开合功能件，施工建筑显示脚手架与扫描进度，低生命建筑持续冒烟。所有动画只读取权威状态，不写回模拟或回放；系统降动态偏好和专用夹具提供静态替代。详见 [动态表现验收](docs/presentation-motion-validation.md)。

双方精炼站现已具备真实卸矿机构：`deposit` 事件从采矿车 `resource_socket` 指向精炼站 `deposit_socket`，并只在表现层驱动 Blender 母版中的入口门、0.45 米节距输送条与横向采集滚筒。节点合同、闭/开预览、KTX2 预算与回退记录见 [精炼站机械卸矿资产验收](docs/refinery-unload-mechanism-assets.md)。

战斗反馈已区分弹丸命中与重炮爆炸：重炮包含受限数量的冲击波、火球、烟雾、焦痕和碎屑；建筑按 66% / 30% 生命阈值进入受损与濒危状态。各效果族都有画质预算、生命周期、降动态替代和雾战信息过滤，详见 [战斗视觉表现](docs/combat-vfx-presentation-wave.md)。

物流与基地状态已完成第二次资产化：双方采矿车拥有三个独立辉晶货舱槽和可旋转采集滚筒，空载到满载直接读取权威 cargo；双方工厂/兵营门和工厂吊机已从 Blender 静态合并域拆出，只在真实生产进度推进时工作。道路、基地平台、矿区和信标可通行面统一压到视觉平面 1.5cm 以内，接地阴影不再被厚路面遮住；新增基地服务地坪、运输轮迹和油污全部采用实例化且不参与碰撞。
