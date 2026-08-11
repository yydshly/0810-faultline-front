# 《断层战线》v0.6 资产来源与原创边界

## 运行时资产

当前版本不加载《红色警戒 2》《尤里的复仇》或其他商业游戏的贴图、界面图、模型、字体、图标、音乐、语音或音效。

- 地表：`scene.ts` 在运行时以固定算法生成 512×512 土壤 DataTexture，并以固定采样和重复规则铺设。
- 道路与铺装：由 Three.js 基础几何体、项目色板和关卡稳定锚点生成。
- 当前四十二件正式资产均由项目内 Blender 程序生成可编辑 `.blend` 并导出 GLB，覆盖玩家/敌方单位、建筑、资源和环境道具；运行时程序模型只保留为加载失败回退，不再代表尚未资产化的内容类别。
- 战争迷雾：由模拟情报快照生成 64×64 DataTexture，不来自图片素材。
- 界面：由 `ui.ts` 与 `styles.css` 生成，字形标记为文本/几何符号，不使用原作图标。
- 音频：由浏览器 Web Audio 节点实时合成，不使用外部采样。

## 参考用途

《红色警戒 2 / 尤里的复仇》只作为以下设计原则的历史参考：

- 左侧战场、右侧固定指挥栏的桌面空间关系。
- 雷达、资源、生产分类和纵向队列的连续操作路径。
- 建筑与单位在等距战略缩放下依靠夸张轮廓、阵营色和功能部件快速辨识。

视觉细节没有逐像素或逐模型复制；项目继续使用“断层工业带、辉晶能源、青/橙阵营信号”的原创世界观和资产家族。

## 内部概念图

`assets/concepts/faultline-front-visual-benchmark-v1.png` 仅用于项目内部的色彩、密度与构图校准。运行时没有直接加载该图片，也没有从图片中裁切或提取商业资产。

`assets/concepts/ff-mbt-01-turnaround-v1.png` 为内置图像生成能力制作的原创坦克多视图概念，输入角色是建模参考，运行时未加载。最终提示词和参考角色记录在同名 `.prompt.txt`；它不构成 3D 模型，也不作为已经完成方向一致性验证的证据。

## FF-MBT-01 母资产

- 生产脚本：`tools/blender/build_ff_mbt_01.py`，项目原创程序化 Blender 建模脚本。
- 可编辑源：`assets/3d/ff_mbt_01/ff_mbt_01_v1.blend`，由 Blender 4.5.12 LTS 在本机后台生成。
- 运行时模型：`assets/3d/ff_mbt_01/ff_mbt_01_v1.glb`；发布副本位于 `public/assets/models/ff_mbt_01_v1.glb`。
- 校准输出：`assets/3d/ff_mbt_01/ff_mbt_01_v1_preview.png`、`assets/sprites/ff_mbt_01/body_00.png` 至 `body_07.png`、`turret_00.png` 至 `turret_15.png`、`shadow.png` 与方向合成预览。
- 纹理输出：`assets/3d/ff_mbt_01/textures/` 下 18 张 BaseColor/Normal/ORM PNG；全部由同一生产脚本使用固定算法生成并嵌入 GLB，不包含下载纹理。
- 资产性质：原创程序化 3D，不是从概念图提取的网格，不包含第三方模型或贴图；概念图只影响轮廓、材质分区和颜色方向。

## FF-HRV-01 与 FF-HQ-01 资产族

- 生产脚本：`tools/blender/build_ff_asset_family.py`，复用坦克的原创验证级 PBR 纹理与材质分区。
- 采矿车源文件：`assets/3d/ff_hrv_01/ff_hrv_01_v1.blend`；运行时副本为 `public/assets/models/ff_hrv_01_v1.glb`，并自动导出 8 个方向帧。
- 指挥中心源文件：`assets/3d/ff_hq_01/ff_hq_01_v1.blend`；运行时副本为 `public/assets/models/ff_hq_01_v1.glb`。
- 稳定节点：采矿车包含 `chassis_root / collector_head / cargo_bed / resource_socket / selection_anchor`；指挥中心包含 `building_root / radar_yaw / spawn_socket / rally_socket / selection_anchor`。
- 两件资产均为项目内程序化 Blender 3D，不包含下载模型或第三方纹理；与 FF-MBT-01 共用灰绿装甲、橙色识别件与青色能源信号。

## FF-REF-01、FF-FAC-01 与 FF-RCT-01 工业建筑

- 三座建筑继续由 `tools/blender/build_ff_asset_family.py` 生成，并复用项目原创 PBR 纹理。
- 精炼站：`assets/3d/ff_ref_01/`，稳定节点包含 `intake_bay / storage_silo / deposit_socket`。
- 载具工厂：`assets/3d/ff_fac_01/`，稳定节点包含 `factory_door / crane_yaw / production_socket / rally_socket`。
- 反应堆：`assets/3d/ff_rct_01/`，稳定节点包含 `reactor_core / reactor_ring / power_socket`。
- 发布副本分别位于 `public/assets/models/ff_ref_01_v1.glb`、`ff_fac_01_v1.glb` 和 `ff_rct_01_v1.glb`；均不包含外部下载资产。

## FF-BAR-01、FF-REL-01、FF-SEN-01 与 FF-CAN-01 战术建筑

- 四座建筑由 `tools/blender/build_ff_asset_family.py` 批量生成；每座均包含可编辑 `.blend`、运行时 `.glb` 与 768² 校准预览。
- 兵营：`assets/3d/ff_bar_01/`，稳定节点为 `barracks_door / infantry_spawn / rally_socket / selection_anchor`。
- 后勤节点：`assets/3d/ff_rel_01/`，稳定节点为 `radar_yaw / network_socket / selection_anchor`；旋转天线接入场景动画。
- 哨戒塔：`assets/3d/ff_sen_01/`，稳定节点为 `turret_yaw / muzzle_socket_left / muzzle_socket_right / selection_anchor`。
- 重炮塔：`assets/3d/ff_can_01/`，稳定节点为 `turret_yaw / barrel_pitch / muzzle_socket / selection_anchor`。
- 发布副本位于 `public/assets/models/ff_bar_01_v1.glb`、`ff_rel_01_v1.glb`、`ff_sen_01_v1.glb` 与 `ff_can_01_v1.glb`；`tools/validate_glb_contracts.py` 检查运行时文件没有丢失玩法节点。
- 这些资产继续复用项目原创验证级 PBR 纹理，不含下载模型、商业游戏贴图或从参考截图提取的网格。

## FF-RIF-01、FF-ENG-01、FF-AT-01 与 FF-SCT-01 基础作战单位

- 三类步兵按权威玩法单位制作成三人小队母资产，而不是三个独立单位；共同使用 `squad_root / selection_anchor`，成员保留稳定名称。
- 盾线小队：`assets/3d/ff_rif_01/`，以三支长枪、前臂盾面和琥珀肩甲识别，稳定节点包含 `soldier_lead / soldier_left / soldier_right / muzzle_socket`。
- 工兵组：`assets/3d/ff_eng_01/`，以青色双维修单元、顶部横梁和大工具头识别，稳定节点包含 `engineer_lead / engineer_left / engineer_right / repair_tool_socket`。
- 穿矛小队：`assets/3d/ff_at_01/`，以重型肩扛发射管、爆风环和装载手弹头箱识别，稳定节点包含 `launcher_lead / launcher_pitch / muzzle_socket`。
- 獒犬侦察车：`assets/3d/ff_sct_01/`，以低车身、四个外露轮和车顶雷达识别，稳定节点包含 `chassis_root / turret_yaw / radar_yaw / muzzle_socket`。
- 四份发布 GLB 位于 `public/assets/models/`；模型、材质和结构均由项目内 Blender 脚本生成，不含第三方或原作资产。

## FF-SUP-01、FF-ART-01 与环境母资产

- 链炮压制车：`assets/3d/ff_sup_01/`，使用六轮底盘与双联短炮形成近程压制轮廓；稳定节点为 `chassis_root / turret_yaw / muzzle_socket_left / muzzle_socket_right`。
- 长弧自行炮：`assets/3d/ff_art_01/`，使用履带底盘、后置弹药舱和超长炮管形成远程火力轮廓；稳定节点为 `chassis_root / turret_yaw / barrel_pitch / muzzle_socket`。
- 岩石障碍簇：`assets/3d/ff_rok_01/`，稳定节点为 `rock_cluster_root / collision_proxy / ground_anchor`。运行时只替换可见网格，权威碰撞半径继续来自关卡 blocker 数据。
- 装甲残骸：`assets/3d/ff_wrk_01/`，稳定节点为 `wreck_root / broken_turret / broken_barrel / ground_anchor`。它作为固定视觉地标加载，不加入碰撞、寻路或回放状态。
- 四件资产由同一 Blender 资产族脚本生成；石材、锈蚀和烧灼材质为项目内确定性材质，不使用外部扫描、下载模型或商业游戏资产。

## FF-ORE-01、FF-CRT-01 与 FF-RDM-01 地表资产

- 辉晶矿簇：`assets/3d/ff_ore_01/`，稳定节点为 `resource_field_root / harvest_socket / ground_anchor`；运行时替换资源节点可见模型，资源数量、半径与采集逻辑仍来自权威状态。
- 炮击弹坑组：`assets/3d/ff_crt_01/`，稳定节点为 `crater_cluster_root / ground_anchor`；作为低矮非碰撞地表装饰布置，不进入寻路和回放。
- 路侧信标：`assets/3d/ff_rdm_01/`，稳定节点为 `road_marker_root / ground_anchor`；作为道路边缘视觉引导，不构成阻挡。
- 三件资产均由 `tools/blender/build_ff_asset_family.py` 使用项目内确定性几何和材质生成；大面积泥土、道路颗粒与磨损斑块则由 `scene.ts` 运行时生成，避免把整张地图固化为不可维护的大网格。

## FF-SBG-01、FF-CCH-01 与 FF-AUX-01 基地环境资产

- 沙袋掩体：`assets/3d/ff_sbg_01/`，稳定节点为 `sandbag_root / ground_anchor`；承担防线轮廓，但不提供权威掩体或碰撞。
- 补给堆：`assets/3d/ff_cch_01/`，稳定节点为 `cache_root / supply_socket / ground_anchor`；油桶、箱体与篷布均为原创程序化几何，不包含外部道具模型。
- 辅助发电机：`assets/3d/ff_aux_01/`，稳定节点为 `generator_root / service_socket / ground_anchor`；青色状态条只用于基地氛围，不提供电力、联网或交互功能。
- 三件资产以镜像布局填充双方基地外围空白，同时避开主道路和生产出口；它们只存在于场景视觉层，不进入关卡碰撞、寻路、模拟与回放。

## FF-SCR-01 与 FF-STM-01 稀疏植被

- 耐旱灌木簇：`assets/3d/ff_scr_01/`，稳定节点为 `scrub_root / ground_anchor`；由低面数叶片束构成，使用项目内灰绿色确定性材质。运行时导出按 `M_DrySage / M_DrySageLight / M_FieldEarth` 三种材质离线合并，将 32 个 primitive / 3,904 三角形降为 3 个 primitive / 1,600 三角形；新旧 768² 校准图平均像素差约 0.23/255，轮廓与材质语义保持。突破场景的 12 个克隆由理论 384 次材质绘制降为 36 次。
- 枯木：`assets/3d/ff_stm_01/`，稳定节点为 `stump_root / ground_anchor`；由九边形树干、断枝和外露根部构成，不使用扫描或下载植被。
- 两类植被只布置在地图外围和非关键空白区，不投射动态阴影、不参与碰撞；最远缩放档整体隐藏，优先保障战斗、资源和道路可读性。

## KTX2 运行时发布链

- Blender `.blend`、原始导出 GLB 和 PNG 纹理继续作为可编辑生产源；`public/assets/models/` 只保存面向浏览器的 KTX2 发布副本。
- `tools/compress_glb_ktx2.ps1` 使用项目 E 盘内的 Khronos KTX-Software 4.4.2 与 glTF Transform 4.4.2；法线槽采用 UASTC，颜色与 ORM 采用 ETC1S。
- 浏览器转码文件来自当前 Three.js 依赖自带的 Basis transcoder，发布于 `public/assets/basis/`，其来源说明随 `README.md` 一并保留。
- KTX2 只改变纹理传输和 GPU 存储形式，不改变模型网格、稳定节点、玩法碰撞、权威状态或资产原创归属。

## FF-EN-MBT-01、FF-EN-RIF-01 与 FF-EN-AT-01 敌军首批母资产

- 三件资产均由 `tools/blender/build_ff_asset_family.py` 在本机 Blender 4.5.12 LTS 后台生成，使用原创程序化几何和无贴图 PBR 材质，不包含下载模型、扫描件、商业游戏网格或参考游戏贴图。
- 敌方主战坦克使用黑铁履带、暗红楔形首上甲、分离炮塔颊板和红色观瞄缝；稳定节点为 `chassis_root / turret_yaw / barrel_pitch / muzzle_socket / selection_anchor`。
- 敌方步枪小队使用三人箭头编组、宽护肩、横向盔脊、重型步枪和红色面罩；稳定节点为 `squad_root / soldier_lead / soldier_left / soldier_right / muzzle_socket / selection_anchor`。
- 敌方反坦克小队使用超长攻城发射管、宽弹翼、面部挡板和弹药箱；稳定节点为 `squad_root / launcher_lead / launcher_pitch / muzzle_socket / selection_anchor`。
- 可编辑源与校准预览位于 `assets/3d/ff_en_*`；本节三份发布 GLB 位于 `public/assets/models/`，当前合计 2,754,748 bytes。敌军步兵继续使用无贴图 PBR 材质，仍通过同一 GLB 节点、骨架、动画、材质预算与轮廓元数据契约检查。

## FF-EN-SCT-01、FF-EN-SUP-01、FF-EN-ART-01 与 FF-EN-HRV-01 敌军载具第二批

- 四件资产继续由 `tools/blender/build_ff_asset_family.py` 在本机 Blender 4.5.12 LTS 后台生成，使用原创程序化几何和同一套黑铁、暗红、骨白、红色光学件材质，不包含第三方网格或参考游戏贴图。
- 侦察车以低矮四轮底盘、尖楔车首和雷达叉建立高速轮廓；稳定节点为 `chassis_root / turret_yaw / radar_yaw / muzzle_socket / selection_anchor`。
- 压制车以六轮底盘、双旋转炮管和后置弹药舱建立近战火力轮廓；稳定节点为 `chassis_root / turret_yaw / muzzle_socket_left / muzzle_socket_right / selection_anchor`。
- 火炮以履带底盘、超长攻城炮管和后部驻锄建立远距离轮廓；稳定节点为 `chassis_root / turret_yaw / barrel_pitch / muzzle_socket / selection_anchor`。
- 敌方采集车以履带、前置采集滚筒、开放式货斗和青色辉晶建立经济单位轮廓；稳定节点为 `chassis_root / collector_head / cargo_bed / resource_socket / selection_anchor`。
- 四份新增发布 GLB 合计 618,836 bytes；七份敌军发布 GLB 合计 1,243,540 bytes。无贴图 PBR 材质不需要 KTX2，但全部继续通过同一节点契约检查并保留程序模型回退。

## FF-EN-ENG-01 与 FF-EN-* 敌军基地完整批次

- 敌军工程兵、指挥核心、精炼站、载具工厂、反应堆、兵营、后勤节点、哨戒塔和重炮塔继续由同一 Blender 生成器在本机离线生成；输入是项目内参数与原创几何规则，不包含下载模型、扫描件、商业游戏网格或参考游戏贴图。
- 工程兵沿用敌军封闭面罩和宽肩轮廓，以骨白分体维修塔、双线圈、顶部桥架与红色三叉维修探头区别战斗步兵；稳定节点为 `squad_root / engineer_lead / engineer_left / engineer_right / repair_tool_socket / selection_anchor`。
- 八座建筑分别保留 `radar_yaw / spawn_socket / deposit_socket / factory_door / production_socket / reactor_core / reactor_ring / infantry_spawn / network_socket / turret_yaw / barrel_pitch / muzzle_socket*` 等玩法节点；运行时只替换视觉模板，不改变占地、碰撞、生产、供电、雷达或武器规则。
- 本批九件发布 GLB 合计 1,272,028 bytes；完整十六件敌军 GLB 合计 5,011,044 bytes。全部为无贴图 PBR 材质，保留可编辑 `.blend`、原始 GLB、768²预览和程序模型回退。

## FF-MBT-01 英雄基准升级

- 升级仍由项目内 `tools/blender/build_ff_mbt_01.py` 确定性生成，概念图只提供轮廓、色彩和材质分区参考，没有从图片提取或下载网格。
- 新增的履带闭环、装甲板、侧裙、炮塔光学件和识别灯均为 Blender 程序化原创几何；512² BaseColor/Normal/ORM 仍由脚本固定算法生成，不含第三方纹理。
- 可编辑母版保留零件粒度；发布 GLB 仅在导出阶段按材质和动画域合并，不改变 `turret_yaw / barrel_pitch / muzzle_socket / selection_anchor` 游戏契约。
- 当前版本是战略镜头的正式基准，并未声称达到人工英雄贴图终稿；未来的手绘磨损、编号与原创阵营徽记应继续记录在本节。

## 开局核心资产第二批升级

- `FF-HRV-01 / FF-HQ-01 / FF-REF-01 / FF-FAC-01` 继续由项目内 `tools/blender/build_ff_asset_family.py` 生成，没有引入下载模型、扫描件或商业游戏资产。
- 新增的采集滚筒护栏、履带块、装甲侧壁、建筑屋顶板、雷达盘外缘、筒仓管线、阀门、工厂桁架和扶壁均为项目内程序化原创几何。
- 四件资产复用 `FF-MBT-01` 的项目内512²确定性 PBR 纹理；橙色只承担阵营/危险识别，青色只承担功能状态，不复制参考游戏的标志、贴花或具体结构。
- 可编辑母版保留独立零件，运行时合并仅用于性能；`collector_head / cargo_bed / resource_socket / radar_yaw / intake_bay / storage_silo / deposit_socket / factory_door / crane_yaw / production_socket / rally_socket` 等契约保持不变。

## 灰烬工业带地表与光照

- 土壤、道路、磨损标线与工业混凝土全部由 `scene.ts` 使用固定哈希和数学函数生成 DataTexture，不含下载照片、扫描材质或商业游戏地表切片。
- 地表变化只影响颜色、粗糙度与非碰撞装饰网格；道路路线、基地铺装范围、资源锚点、碰撞、寻路和单位移动仍来自原有权威数据。
- 环境光照清单：一盏全局 HemisphereLight 用于冷灰天空/暖灰地面可见度，一盏带阴影的 DirectionalLight 作为太阳。两者均为全局环境光，不宣称来自局部灯具；本阶段没有新增局部点光源或聚光灯。
- 基地边界、维护沟槽、检修盖板与战争迷雾全部由 `scene.ts` 的确定性几何或像素数据生成；它们只属于表现层，不加入碰撞、导航、建造占地或权威状态。
- 材质功能色校准只按稳定材质名调整 Three.js 的颜色与自发光强度，没有改写 GLB 母版、纹理、模型节点或阵营规则；青色表示辉晶/己方工作状态，红色表示敌军信号。

## 断层突破战视觉纵切片

- 敌方指挥区铺装、突击路线履带痕、翻搅土层、弹着焦痕、弹坑边缘和防御塔地面识别圈全部由 `scene.ts` 的确定性基础几何生成，不加载外部地表图片，也不改变道路、碰撞、寻路或建筑占地。
- 实体接地阴影是运行时共享透明材质与缓存圆形几何，不属于烘焙贴图；它只强化战略镜头下的落地关系，不参与光照遮挡、拾取或玩法判定。
- 玩家灰绿装甲、橙色功能件、青色信号与敌军暗红装甲、黑铁结构、红色信号继续按 GLB 稳定材质名在运行时统一校准。校准只修改颜色、粗糙度、金属度和自发光强度，不修改网格、骨骼、动画或语义节点。
- 受损车辆烟尘、爆炸碎屑和摧毁后的低矮残骸为事件驱动的程序化表现层；残骸使用缓存几何和既有项目材质，最长保留 34 秒并受装饰效果预算淘汰，不写入确定性模拟或存档。
- 本阶段仍只使用一盏全局 HemisphereLight 与一盏全局 DirectionalLight；突破战仅提高全局曝光与可见度，没有新增缺少可见发光体的局部灯光。

## FF-MBT-01 英雄母版 v2 来源

- 几何、UV、材质节点、512² BaseColor/Normal/ORM、方向帧和校准图继续由项目内 `tools/blender/build_ff_mbt_01.py` 在本机 Blender 4.5.12 LTS 中离线生成。
- v2 新增的轮组端盖、前装甲筋、恢复销、排气帽、炮塔尾舱、烟幕发射器、遥控武器站、编号和识别标记均为参数化原创几何，不含下载模型、扫描数据、第三方字体文件或商业游戏贴花。
- `tools/compose_ff_mbt_direction_preview.py` 只将同一母版输出的车体、炮塔和接触阴影合成为内部审阅图，不生成或推断新的 3D 几何。
- 发布副本使用项目内 KTX2 工具链压缩；压缩只改变纹理传输格式，不改变网格、语义节点、碰撞、玩法数值或权威状态。
## 桌面视觉金标建筑 v1

- `FF-HQ-01` 与 `FF-FAC-01` 于 2026-08-09 由项目内 `tools/blender/build_ff_asset_family.py` 重新生成，输入仅为原创参数化几何规则和项目内确定性 PBR 材质；没有下载、扫描、提取或复制商业游戏的模型、贴图、标志和界面资产。
- 内部参考图 `assets/reference/visual-gold-web-v1.png` 与 `assets/reference/visual-gold-buildings-v1.png` 只提供大形层级、入口纵深、接地和配色方向，不作为运行时纹理，也不从中提取网格。完整边界见 `docs/visual-gold-art-direction.md`。
- 总部使用 `terraced-command-citadel` 轮廓：13.2×11.2 米基座、3.10 米入口视觉纵深、阶梯式指挥体量和独立 `radar_yaw`；发布模型为 1,368,244 bytes、3,320 三角形、11 primitives、8 材质、15 张 KTX2 图片和 18 个节点。
- 载具工厂使用 `deep-bay-offset-gantry` 轮廓：12.5×9.5 米基座、3.00 米入口视觉纵深、连续坡道、可见生产舱和偏置 `crane_yaw`；发布模型为 1,338,016 bytes、2,880 三角形、11 primitives、7 材质（合同上限 8）、15 张 KTX2 图片和 19 个节点。
- 两件原始 GLB 合计 3,747,292 bytes，KTX2 发布副本合计 2,706,260 bytes，缩小约 27.8%；网格、稳定节点和玩法合同不因纹理压缩改变。
- 两件母版保留 `ground_anchor / selection_anchor / spawn|production / rally` 及生产机构契约；浏览器发布副本继续使用 KTX2。旧母版、预览、原始 GLB 和发布 GLB 保存在 `.tmp/visual-gold-buildings-before-20260809/`，可恢复。

## 桌面视觉金标建筑 v2 表面层次

- `FF-HQ-01` 与 `FF-FAC-01` 继续由项目内 `tools/blender/build_ff_asset_family.py` 在 Blender 4.5.12 LTS 中离线生成；本批没有下载模型、扫描数据、商业游戏网格、第三方贴花或新增纹理。可编辑母版和 768² 预览位于各自 `assets/3d/` 目录。
- 表面合同提升为 `desktop-building-gold-v2`。0.35–1.20 米检修板、结构接缝和浅浮雕分区复用既有橄榄装甲、石墨结构、裸钢边缘与功能色材质；受控磨损继续来自同一套项目内 512² BaseColor/Normal/ORM，仅提高现有法线层的战略镜头可见度，并把深色磨损集中在基座、入口、通风和检修区域，不新增图片或材质槽。
- 总部由 3,320 增至 3,840 三角形，仍为 11 primitives、8 材质、15 张 KTX2 图片、18 节点；KTX2 发布副本为 1,407,668 bytes，SHA-256 `02E6BE3CF135252CE79FFB45B41FECC35A4ED2244D8F15B2157353CDB1086A32`。
- 工厂由 2,880 增至 3,388 三角形，仍为 11 primitives、7 材质、15 张 KTX2 图片、19 节点；KTX2 发布副本为 1,377,212 bytes，SHA-256 `E3FFA8B1498CA56E2BF493130FAA2B7E24021F50DB340CCC9EBFCA3504F1FFF1`。
- 两件原始 GLB 为 3,825,960 bytes，KTX2 发布副本为 2,784,880 bytes，压缩 27.2%。`radar_yaw / factory_door / crane_yaw / ground_anchor / selection_anchor / spawn|production / rally`、占地、入口纵深与玩法合同保持不变；42/42 KTX2/语义节点合同通过。
- 本批替换前的 authored 和 published 副本保存在 `.tmp/visual-gold-surface-before-20260809/`，原始 GLB 的 SHA-256 分别为总部 `69454DD193365F09F949196CBB6017C5EE46764D897C5CA8C7C392DE1E565E71`、工厂 `4E96490F459EB39110359EC2C2EC2EB3A831C203FD07A2993B51C4753EABCAAA`，可精确回退。

## 桌面视觉金标资源与哨戒塔 v2

- `FF-ORE-01` 与 `FF-EN-SEN-01` 于 2026-08-09 继续由项目内 `tools/blender/build_ff_asset_family.py` 在 Blender 4.5.12 LTS 中离线生成。输入只有原创参数化几何规则和既有项目材质；没有下载模型、扫描数据、商业游戏网格、参考游戏贴图、新增纹理或新增材质槽。可编辑母版与 768² 校准预览分别位于 `assets/3d/ff_ore_01/` 和 `assets/3d/ff_en_sen_01/`。
- 矿床使用 `broken-seam-half-buried-clusters` 轮廓：不规则低面数土壤过渡取代规则黑色圆盘，三块局部接触暗部与十二块半埋碎石建立接地层次，七组半埋晶簇保留战略镜头识别。晶体投影面积合同上限为约 20%；以每簇最大水平椭圆包围估算，3.993 m² 晶体上界相对 60.568 m² 土壤轮廓为 6.59%。发光强度由 3.8 降至 1.65；实机 1440p 校准后，既有 `M_FieldEarth` Base Color 从 `(0.20, 0.17, 0.105)` 收敛至低明度、低饱和灰橄榄 `(0.135, 0.14, 0.108)`，接触暗部材质保持不变。没有以更多微型 greeble 或新贴图制造细节。
- 矿床原始 GLB 为 48,704 bytes、446 三角形、3 primitives、3 材质、0 图片、7 节点；KTX2 发布链输出为 48,440 bytes，SHA-256 `00CAB050E90CE68340AA59265A798FD687AE0ACCEAD5785EEECFF98C7360CB81`。原始 GLB 的 SHA-256 为 `88AC4F334598F7BBDC48BB3DEB0B6F8794D4F7B1F0E0B31B7A8C620DF2822EA1`。相较替换前的 3,028 三角形 / 23 primitives，新版降至 446 / 3，稳定节点 `resource_field_root / harvest_socket / ground_anchor` 的父子关系、extras 与 transform 保持不变。
- 敌方哨戒塔使用 `braced-twin-cannon-forward` 轮廓：规则高饱和红方垫改为八边形黑铁基座和四个低占比装甲脚，双支架、回转环、低饱和炮体、炮盾、炮管与炮口识别环构成暗底座 / 中间炮体 / 亮钢炮管三档明度；红色信号投影面积合同上限为约 4%，武器前向轴继续为 `-Y`。
- 哨戒塔原始 GLB 为 127,804 bytes、1,628 三角形、10 primitives、6 材质、0 图片、16 节点；KTX2 发布链输出为 126,836 bytes，SHA-256 `27E0F7C46E97A4B4969AE3715ED8C7251490A52CD1BD2D559BD04CE7E2A4E16B`。原始 GLB 的 SHA-256 为 `21A12AFE8837AA04AC66821CA611BBDA4DF6973DEF4B698E545842F19A9E5C1F`。`building_root / turret_yaw / muzzle_socket_left / muzzle_socket_right / selection_anchor` 的父子关系、socket extras 与 transform 均与旧版精确一致；新旧都没有 authored animation clip，运行时仍只驱动 `turret_yaw`。
- 两件资产均为零贴图材质，因此 KTX2 工具链不会生成图片扩展；它仍通过隔离候选目录重打包和发布，未绕过正式候选流程。发布前先以完整 42 件模型库验证材质、预算、节点、父子关系、socket extras 与 transform，再以 `--require-ktx2` 对正式目录完成 42/42 校验。
- 替换前的 `.blend`、原始 GLB、预览、发布 GLB、生成器、validator 与本说明备份在 `.tmp/visual-gold-ore-sentry-before-20260809/`。旧矿床原始 / 发布 GLB 的 SHA-256 为 `1FD508832BE577D481CDD43CE45D5FB607420E5822B5F2A91888401BBBD7AD49` / `C93FAE252C98A6FAC04A5E2E08957D3EEDE19440F961A9C65662A1B93DC748AB`；旧哨戒塔原始与发布 GLB 的 SHA-256 均为 `C8CA87B2B8473AFA553671B78C6C5F91AEC3D50C035F03D964D495B2851FB316`，可精确回退。
- 1440p 实机土壤色校准前的结构通过版另存于 `.tmp/visual-gold-ore-v2-before-soil-tune-20260809/`；本次最终校准只改变现有土壤材质参数，不改变 60.568 m² 轮廓、3 primitives、446 三角形、3 材质、0 图片或任何语义节点。

## 双方精炼站机械卸矿母版 v2

- `FF-REF-01` 与 `FF-EN-REF-01` 于 2026-08-09 由 `tools/blender/build_ff_asset_family.py` 在本机 Blender 4.5.12 LTS 中重新生成；几何来自项目内原创参数化规则，复用既有玩家 PBR 与敌军无贴图材质，没有下载模型、扫描件、商业游戏网格、参考游戏贴图、新纹理或新材质槽。
- 两座建筑保持 11.4×9.4 米基座、主体轮廓、接地基线、`intake_bay / storage_silo / deposit_socket / selection_anchor` 与玩法占地。新增 `intake_gate / intake_conveyor / intake_collector` 三个独立可动域，分别用 `deposit_gate / deposit_conveyor / deposit_collector` presentation role 锁定门、条带和滚筒接口。
- 原始 GLB 合计 2,291,820 bytes，发布 GLB 合计 1,770,056 bytes；玩家为 4,796 三角形 / 12 primitives / 6 材质 / 15 张既有 KTX2 图片，敌军为 3,880 / 13 / 6 / 0。完整预算、哈希、闭/开预览与验证证据见 [精炼站机械卸矿资产验收](refinery-unload-mechanism-assets.md)。
- 替换前 authored 与 published 副本在 `.tmp/refinery-mechanism-backup-20260809/`；正式发布经过隔离候选压缩，并以完整 42 件模型库执行 `--require-ktx2` 验证。
## 首批车辆专属残骸

- `FF-MBT-01 / FF-EN-MBT-01 / FF-HRV-01 / FF-EN-HRV-01` 于 2026-08-09 继续由项目内 `tools/blender/build_ff_mbt_01.py` 与 `tools/blender/build_ff_asset_family.py` 在 Blender 4.5.12 LTS 中离线生成。
- 残骸几何为项目内原创参数化模型，复用原载具已有材质和纹理；没有下载模型、扫描数据、商业游戏网格、参考游戏资产、新纹理或新材质槽。
- 四件 GLB 均新增 `wreck_visual_root` 语义 Empty 和三个车型专属残骸网格，正常载具网格、socket、rig/动画域与变换合同保持不变。资产预算、预览、发布指标与回归证据见 [首批车辆专属残骸资产](vehicle-specific-wreck-assets.md)。
- 替换前可恢复副本位于 `.tmp/vehicle-wreck-assets-before/`；正式发布副本经过隔离 KTX2 候选目录验证后替换，并通过完整 42/42 合同。

## 核心建筑专属受损母版

- `FF-HQ-01 / FF-FAC-01 / FF-EN-HQ-01 / FF-EN-FAC-01` 于 2026-08-09 继续由项目内 `tools/blender/build_ff_asset_family.py` 在 Blender 4.5.12 LTS 中离线生成。两套受损层是项目内原创参数化几何，只复用对应建筑已有材质和纹理；没有下载模型、扫描数据、商业游戏网格、参考游戏贴图、新纹理或新材质槽。
- 四件 GLB 均在 `building_root` 下新增默认隐藏的 `damage_visual_damaged / damage_visual_critical` meshless 语义 root。两者由场景互斥显隐，每态固定三个可见子网格；critical 自包含严重塌陷语义，不要求叠加 damaged。
- 四件正式副本合计 3,348,472 bytes。每件 damaged 为 285 triangles / 3 primitives，critical 为 373 / 3；玩家仍为原 15 张 KTX2 图片，敌军仍为零贴图。全部共有节点的 parent、TRS、原 extras、材质名集合与 authored animation 列表均与替换前一致。
- 完整接口、预览、预算、SHA-256、42/42 KTX2 与 8 项 validator 回归见 [核心建筑专属受损资产验收](core-building-damage-assets.md)。替换前可恢复副本位于 `.tmp/building-damage-backup-20260809/`；正式发布副本先在隔离的四件与完整 42 件 KTX2 候选目录通过验证后替换。

## 核心建筑专属废墟母版

- `FF-HQ-01 / FF-FAC-01 / FF-EN-HQ-01 / FF-EN-FAC-01` 于 2026-08-09 继续由项目内 `tools/blender/build_ff_asset_family.py` 在 Blender 4.5.12 LTS 中离线生成。废墟由项目内原创参数化几何构成，只复用对应建筑已有材质和纹理；没有下载模型、扫描数据、商业游戏网格、参考游戏贴图、新纹理或新材质槽。
- 四件 GLB 均在 `building_root` 下新增默认隐藏的 meshless `ruin_visual_root`，并固定四个可见废墟子网格。唯一 meshless `ruin_marker_anchor` 使用 `socket_role=faction_marker_low`，为低矮废墟提供零几何成本的阵营标记挂点；完整建筑、damaged、critical 与 ruin 四种表现由场景互斥显隐。
- 总部保留折断雷达识别，工厂保留加粗倾倒的吊机残臂；敌军连续红色底板拆为三块断裂岛并减少约三分之一可见面积。每件废墟为 4 primitives、964–1,248 triangles，0 新材质、0 新纹理。
- 四件正式副本合计 3,678,324 bytes；玩家仍为原 15 张 KTX2 图片，敌军仍为零贴图。所有旧节点的 parent、TRS、原 extras、材质名序列与 authored animation 列表均与替换前一致。
- 完整接口、预览、预算、SHA-256、42/42 KTX2 与 10 项 validator 回归见 [核心建筑专属废墟资产验收](core-building-ruin-assets.md)。替换前可恢复副本位于 `.tmp/building-ruin-backup-20260809/`；原始四件候选、隔离 KTX2 四件候选和完整 42 件候选分别位于 `.tmp/building-ruin-raw-four-20260809/`、`.tmp/building-ruin-ktx2-four-20260809/` 与 `.tmp/building-ruin-ktx2-full-20260809/`。

## 敌军重炮与中继站战略视距母版

- `FF-EN-CAN-01 / FF-EN-REL-01` 于 2026-08-09 继续由项目内 `tools/blender/build_ff_asset_family.py` 在 Blender 4.5.12 LTS 中离线生成。全部底座、支撑脚、炮盾、重炮机构、桅杆、碟面与叉形通信阵列均为项目内原创参数化几何；没有下载模型、扫描数据、商业游戏网格、参考游戏贴图、新纹理或新材质槽。
- 两件资产去除连续红色方垫，以低位分段红色支撑承担阵营识别。重炮形成低矮稳定炮座、楔形炮房、宽炮盾、后部配重和粗后膛/炮管；中继形成分层基座、粗桅杆、碟面与叉形阵列。两件继续复用敌军原有 6 材质、0 贴图、0 authored animation。
- 重炮由 612 triangles / 8 primitives 升级为 1,768 / 8；中继由 840 / 7 升级为 1,280 / 7，没有增加突破场景常驻 primitive 数。生成器合并器改为选择最近运动祖先，使重炮的钢制炮管和黑色制退器正式归属 `barrel_pitch`，并与原 `muzzle_socket` 一起俯仰；旧语义节点的 parent/TRS/extras 均保持不变。
- 正式发布大小分别为 137,236 与 98,520 bytes，SHA-256 分别为 `C2E10617A8E14EE21DA19DF18F479C7F7138A2479DB2DCC95B0ECECFF2B8D6C0` 与 `FEEE33CDF1294F70514B3B46B1C91DCCE3ADF4C5481C85ADAE5A7D8BB3CCCFA0`。完整接口、前后指标、预览、42/42 KTX2 与 12 项 validator 回归见 [敌军重炮与中继站战略视距资产验收](enemy-cannon-relay-visual-gold.md)。
- 替换前可恢复副本位于 `.tmp/en-can-relay-gold-backup-20260809/`；raw 候选、隔离发布候选与完整 42 件候选分别位于 `.tmp/en-can-relay-gold-raw-20260809/`、`.tmp/en-can-relay-gold-ktx2-20260809/` 与 `.tmp/en-can-relay-gold-ktx2-full-20260809/`。

## 敌军兵营与反应堆战略视距及破坏母版

- `FF-EN-BAR-01 / FF-EN-RCT-01` 于 2026-08-09 继续由项目内 `tools/blender/build_ff_asset_family.py` 在 Blender 4.5.12 LTS 中离线生成。营房、纵深入口、滑门、通信设备、分层反应堆基座、能源柱、约束环、受损层和废墟均为原创参数化几何；没有下载模型、扫描数据、商业游戏网格、参考游戏贴图、新纹理或新材质槽。
- 兵营由红色方垫盒体升级为低矮双翼装甲营房、2.20 米纵深入口和侧翼通信阵列；反应堆升级为暗色分层基座、屏蔽能源柱、窄信号环、散热支柱与独立旋转约束环。红色只保留为低面积阵营与能源识别，两件均复用既有敌军 6 材质、0 贴图、0 authored animation。
- 两件健康态均为 8 primitives：兵营 1,552 triangles，反应堆 1,744。每件另含默认隐藏、场景托管的 damaged 3 primitives、critical 3 primitives 和独立 ruin 4 primitives；健康、两级受损与废墟四阶段互斥。
- `barracks_door / infantry_spawn / rally_socket / selection_anchor` 与 `reactor_core / reactor_ring / power_socket / selection_anchor` 的旧 parent/TRS/extras 均保持不变；两件 `damage_socket_roof` 和三类隐藏 root 的语义合同由 validator 锁定。
- 正式发布大小分别为 235,016 与 247,232 bytes，SHA-256 分别为 `4BFE221C56D5CCA76CAC05F7553C69FA4565424ABF6361914EDB3A6DFCFAB9FC` 与 `B1327EC917B5DC97032C6CBEDC6DB8DB30F8973C27D193927A74667B7210DD8D`。完整预览、阶段预算、接口和 42/42 KTX2 与 13 项 validator 回归见 [敌军兵营与反应堆战略视觉母版验收](enemy-barracks-reactor-visual-gold.md)。
- 替换前可恢复副本位于 `.tmp/enemy-infra-gold-before-20260809/`；raw 全库候选、隔离压缩输出和最终 42 件叠加验证根分别位于 `.tmp/enemy-infra-gold-raw-full-20260809-v1/`、`.tmp/enemy-infra-gold-ktx2-full-20260809-v1/` 与 `.tmp/enemy-infra-gold-ktx2-review-full-20260809-v1/`。

## FF-CRT-01 炮击弹坑桌面金标母版

- `FF-CRT-01` 于 2026-08-09 继续由项目内 `tools/blender/build_ff_asset_family.py` 在 Blender 4.5.12 LTS 中离线生成。断裂椭圆坑缘、低位暗芯、右向宽幅翻土和嵌入式岩唇均为项目内原创参数化几何；没有下载模型、扫描数据、商业游戏网格、参考游戏贴图、新纹理或新材质槽。
- 新版以三段高低不一的开放坑缘取代三个完整等宽圆环；两块宽、低的翻土面表达冲击方向，一段连续岩唇取代原独立微碎石。运行时仍只使用既有 `M_FieldEarth / M_ScorchedEarth / M_FaultRock`，并按材质静态合并为 3 primitives。
- 原始 / 正式 GLB 分别为 14,756 / 14,504 bytes，均为 139 triangles、3 primitives、3 材质、0 图片、6 节点；相对旧正式副本的 155,848 bytes、2,164 triangles、14 primitives、3 材质、0 图片、17 节点，正式传输体积下降 90.7%，三角形下降 93.6%，primitive 下降 78.6%。
- `FF_CRT_01 / crater_cluster_root / ground_anchor` 的 parent、translation、rotation、scale 与全部旧 extras 均逐项保持；`ground_anchor` 继续位于 GLB 本地 `[0, 0.02, 0]` 并保留 `socket_role=ground_contact`。新增 root 元数据只锁定来源、轮廓、8.6×5.4 米视觉占地和 `1000 tris / 4 primitives / 3 materials / 0 textures / 110,000 bytes` 上限，不改变运行时身份。
- 新 raw / public SHA-256 分别为 `9F1CB73CA7931E266C5831E886366C9E21E3A93805C02C7BD7BDF90C1CBB60B7` 与 `F029038E6F12205B765A268F2D47EC673038B2A2501A98EC9F3CE4F2168AF173`。完整视觉取舍、前后指标、预览、接口、隔离发布与验证结果见 [FF-CRT-01 炮击弹坑桌面金标验收](crater-visual-gold.md)。
- 替换前可恢复副本位于 `.tmp/visual-gold-crater-before-20260809/`；raw 全库候选、隔离发布输入/输出和最终 42 件候选分别位于 `.tmp/crater-gold-raw-full-20260809/`、`.tmp/crater-gold-ktx2-input-20260809/`、`.tmp/crater-gold-ktx2-output-20260809/` 与 `.tmp/crater-gold-ktx2-full-20260809/`。

## 玩家兵营与反应堆四态桌面金标母版

- `FF-BAR-01 / FF-RCT-01` 于 2026-08-09 继续由项目内 `tools/blender/build_ff_asset_family.py` 在 Blender 4.5.12 LTS 中离线生成。低矮训练大厅、纵深入口、不对称军械/服务翼、暗色阶梯基座、竖向辉晶能量芯、开口约束环、冷却体块、受损层与废墟均为项目内原创参数化几何；没有下载模型、扫描数据、商业游戏网格、参考游戏网格或贴图、新纹理、新材质槽。
- 兵营以青色功能灯和低位琥晶条承担玩家识别，保留 GLB `+Z` 出兵方向、identity `barracks_door`、`+Y / 1.75m` 门行程与原 `infantry_spawn / rally_socket / selection_anchor`。反应堆以 `M_Huijing` 竖向核心建立主识别，`reactor_core` 和 `reactor_ring` 保持独立动态域，环速仍为 `0.32`，`power_socket` 继续位于 GLB `-Z` 并保留 `socket_role=grid_connection`。
- 两件健康态均为 8 primitives：兵营 1,232 triangles，反应堆 1,608。每件另含默认隐藏、场景托管的 damaged 3 primitives、critical 3 primitives 和独立 ruin 4 primitives；四态总量均为 18 primitives，分别为 2,490 与 3,010 triangles。两件继续使用既有 7 材质、15 张 KTX2 图片、0 authored animation。
- 两件 raw / KTX2 发布副本合计由 3,725,828 压缩至 2,683,116 bytes，减少 28.0%。兵营 public 为 1,327,104 bytes，SHA-256 `5E37C5739A3A6B64B5A6CEB44C237EAC6994BFD9C87A3DA1F3A8F8D0C4F18D5B`；反应堆 public 为 1,356,012 bytes，SHA-256 `0EE1297842C7B560E5429FACA61CD22BE7BEB4C2BEDDDC6982F572D99544938B`。
- 所有旧语义节点的 parent、局部 TRS 与旧 extras 键值逐项保持；根节点只增加来源、视觉版本和预算元数据。完整预览、阶段预算、动态域、前后指标、raw/public SHA-256、42/42 KTX2 与 17 项 validator 回归见 [玩家兵营与反应堆四态视觉金标验收](player-barracks-reactor-visual-gold.md)。
- 替换前可恢复副本位于 `.tmp/player-infrastructure-gold-before-20260809/`；隔离 raw 与 KTX2 候选分别位于 `.tmp/player-infrastructure-raw-two-20260809/` 和 `.tmp/player-infrastructure-ktx2-two-20260809/`。

## 敌方压制车与火炮炮口继承合同勘误

- 2026-08-09 对 `FF-EN-SUP-01 / FF-EN-ART-01` 的可编辑 Blend、raw GLB 与正式 public GLB 进行三方复核。三种生产形态原本已经一致：压制车的 `muzzle_socket_left / muzzle_socket_right` 都直接继承 `turret_yaw`；火炮的 `muzzle_socket` 直接继承 `barrel_pitch`。因此本次没有重建或覆盖资产，原 SHA-256、时间戳、预览和运行时字节保持不变。
- 压制车炮口在正式 GLB 中分别位于 `[-0.42, 0.57, 2.78] / [0.42, 0.57, 2.78]`，均保留 `socket_role=projectile_origin`；`turret_yaw` 继续继承 `chassis_root` 并保留 `socket_role=weapon_yaw`。火炮 `barrel_pitch` 继续继承 `turret_yaw`，局部 translation 为 `[0, 0.92, 0.75]`、俯仰四元数为 `[0.11320322, 0, 0, 0.99357194]`；其炮口局部 translation 为 `[0, 0, 5.38]`，并保留 `socket_role=projectile_origin`。
- 新增 validator 精确锁定两件资产根、`chassis_root / turret_yaw / barrel_pitch / muzzle* / selection_anchor` 的 parent、局部 translation、rotation、identity scale 与完整 extras；mutation 回归会拒绝炮口挂回车体/炮塔、角色漂移、轴向翻转、节点重复、几何预算或材质/图片/动画新增。
- 压制车保持 164,316 bytes、2,268 triangles、11 primitives、7 材质、0 图片、17 节点、0 authored animation，raw/public SHA-256 均为 `C733972515BA3C1EDE316BA28962EAFDB0EC2B442B0D4F3039633C194EEA520B`。火炮保持 130,492 bytes、1,736 triangles、11 primitives、7 材质、0 图片、17 节点、0 authored animation，raw/public SHA-256 均为 `DF0C22065D250020DEC61460C7A627277B988F149148975F3B8FBA50261010EC`。
- 两件预览 SHA-256 分别为 `0472BC5F3D421F810FD603E23FB1EFA6C223AD421E0643F75587270773D53883` 与 `D0643E21B538BA7C67DD34BCDE80D52F79261F515F3B93CD792BF0086C1E646C`，证明本次合同补强没有引入视觉漂移。正式模型库通过 42/42 KTX2/语义合同，validator 与 mutation 回归为 19/19。复核前完整副本位于 `.tmp/enemy-support-muzzle-contract-before-20260809/`。

## 玩家火炮、压制车与侦察车桌面视觉金标母版

- `FF-ART-01 / FF-SUP-01 / FF-SCT-01` 于 2026-08-09 继续由项目内 `tools/blender/build_ff_asset_family.py` 在本机 Blender 4.5.12 LTS 中离线生成。履带、车轮、车体、炮塔、炮管、制退器、驻锄和雷达均为项目内原创参数化几何；没有下载模型、扫描数据、商业游戏网格、参考游戏贴图或从截图提取的几何。
- 三件资产改用同一组 7 个无纹理参数材质，以灰绿与深灰为主面、琥珀识别条和小型青色功能点为辅。每件旧有 18 张 KTX2 图片全部移除，正式发布均为 0 纹理、0 图片、0 authored animation；没有新增材质槽或表面族。
- 火炮以连续履带、后置弹药舱、驻锄和带制退器的长炮建立轮廓；压制车以宽体六轮和两根 2.25 米平行炮建立轮廓；侦察车以低矮四轮车体和约 0.86 米叉形雷达冠建立轮廓。琥珀不再覆盖大块车体，青色不再形成大面积高亮面。
- 正式 ART 为 170,464 bytes、2,172 triangles、12 primitives、7 材质、0 图片、19 节点；SUP 为 190,056 / 2,492 / 11 / 7 / 0 / 18；SCT 为 130,844 / 1,624 / 12 / 7 / 0 / 19。相对旧正式版体积分别下降 75.6%、74.5% 与 80.8%。
- 原 `chassis_root / turret_yaw / radar_yaw / barrel_pitch / muzzle* / selection_anchor` 的名称、parent、局部 TRS 与完整 extras 保持不变。新增三个 meshless `powered_*` 动态域保护小型功能点，避免按材质合并后断电语义名称丢失。完整前后指标、SHA-256、预览、动态域与验收结果见 [玩家支援车辆桌面视觉金标验收](player-support-vehicle-visual-gold.md)。
- 替换前可恢复副本位于 `.tmp/player-support-gold-before-20260809/`；隔离候选通过完整 42/42 `--require-ktx2` 后才覆盖正式 GLB，正式模型库再次通过 42/42，validator 与 mutation 回归为 21/21。
