# 玩家支援车辆桌面视觉金标验收

日期：2026-08-09  
范围：`FF-ART-01`、`FF-SUP-01`、`FF-SCT-01`

## 结论

三件资产已由项目内 Blender 程序化母版重制并正式发布。战略镜头下的职业轮廓分别锁定为“履带长炮与驻锄”“宽体六轮与双平行炮”“低矮四轮与叉形雷达”。主色改为低饱和灰绿与深灰，琥珀仅用于长距离阵营识别条，青色仅用于小型功能点。没有使用下载模型、扫描网格、商业游戏模型或贴图，也没有从参考游戏截图提取几何或纹理。

## 视觉取舍

- `FF-ART-01`：以连续履带质量、后置弹药舱、两组驻锄和长炮建立远程火炮身份；炮口使用横向制退器，不用微型机械碎件堆砌细节。
- `FF-SUP-01`：以六个外露大轮、宽低炮塔、两根 2.25 米平行炮管、暗色冷却护套和明确膛口建立压制车身份。
- `FF-SCT-01`：以四轮低楔车体和约 0.86 米高的开口叉形雷达冠建立侦察车身份；小炮加粗并保留清晰炮口，雷达不再由高亮大横条抢占主体。
- 三件资产共用 7 个参数材质槽，运行时为 0 纹理、0 图片、0 authored animation。旧版每件 18 张 KTX2 图片全部移除，没有引入专属表面族。

## 前后指标

| 资产 | 阶段 | GLB bytes | triangles | primitives | materials | images | nodes | animations |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| FF-ART-01 | 旧 raw | 1,400,964 | 3,104 | 23 | 7 | 18 | 29 | 0 |
| FF-ART-01 | 新 raw | 171,644 | 2,172 | 12 | 7 | 0 | 19 | 0 |
| FF-ART-01 | 旧 public | 699,868 | 3,104 | 23 | 7 | 18 | 29 | 0 |
| FF-ART-01 | 新 public | 170,464 | 2,172 | 12 | 7 | 0 | 19 | 0 |
| FF-SUP-01 | 旧 raw | 1,446,376 | 3,816 | 26 | 7 | 18 | 32 | 0 |
| FF-SUP-01 | 新 raw | 191,140 | 2,492 | 11 | 7 | 0 | 18 | 0 |
| FF-SUP-01 | 旧 public | 745,080 | 3,816 | 26 | 7 | 18 | 32 | 0 |
| FF-SUP-01 | 新 public | 190,056 | 2,492 | 11 | 7 | 0 | 18 | 0 |
| FF-SCT-01 | 旧 raw | 1,383,672 | 2,848 | 20 | 8 | 18 | 26 | 0 |
| FF-SCT-01 | 新 raw | 132,072 | 1,624 | 12 | 7 | 0 | 19 | 0 |
| FF-SCT-01 | 旧 public | 682,764 | 2,848 | 20 | 8 | 18 | 26 | 0 |
| FF-SCT-01 | 新 public | 130,844 | 1,624 | 12 | 7 | 0 | 19 | 0 |

正式发布体积相对旧版分别下降 75.6%、74.5% 和 80.8%。三件均满足硬门：ART/SUP 不超过 `2600 tris / 12 primitives / 7 materials / 6 images / 320,000 bytes`，SCT 不超过 `1800 / 12 / 7 / 6 / 250,000 bytes`。

## 运行时语义合同

- ART 原 `chassis_root / turret_yaw / barrel_pitch / muzzle_socket / selection_anchor` 的名称、直接父节点、局部 translation、rotation、identity scale 与完整 extras 保持不变；`muzzle_socket` 继续直接继承 `barrel_pitch`，局部位置为 `[0, 0, 5.3]`。
- SUP 原 `chassis_root / turret_yaw / muzzle_socket_left / muzzle_socket_right / selection_anchor` 合同保持不变；双炮口继续直接继承 `turret_yaw`，局部位置为 `[-0.38, 0.65, 2.98] / [0.38, 0.65, 2.98]`。
- SCT 原 `chassis_root / turret_yaw / radar_yaw / muzzle_socket / selection_anchor` 合同保持不变；`radar_yaw` 继续保留 `spin_speed=1.1`，炮口继续直接继承 `turret_yaw`。
- 新增 `powered_artillery_rangefinder / powered_suppressor_targeting / powered_scout_radar` 三个 meshless 动态域。青色功能点作为其可见子网格，导出合并不会再丢失 `powered_` 名称，因此断电显示逻辑仍能识别。
- validator 同时锁定根元数据、动态域可见材质集合、精确 gold primitive/triangle 值、材质集合、零纹理、零动画、字节上限与节点唯一性；mutation 测试覆盖父节点、TRS、role、动态域、重复节点、预算、材质、纹理与动画漂移。

## 文件与预览

- ART：[母版](../assets/3d/ff_art_01/ff_art_01_v1.blend)、[raw GLB](../assets/3d/ff_art_01/ff_art_01_v1.glb)、[战略预览](../assets/3d/ff_art_01/ff_art_01_v1_preview.png)、[正式 GLB](../public/assets/models/ff_art_01_v1.glb)
- SUP：[母版](../assets/3d/ff_sup_01/ff_sup_01_v1.blend)、[raw GLB](../assets/3d/ff_sup_01/ff_sup_01_v1.glb)、[战略预览](../assets/3d/ff_sup_01/ff_sup_01_v1_preview.png)、[正式 GLB](../public/assets/models/ff_sup_01_v1.glb)
- SCT：[母版](../assets/3d/ff_sct_01/ff_sct_01_v1.blend)、[raw GLB](../assets/3d/ff_sct_01/ff_sct_01_v1.glb)、[战略预览](../assets/3d/ff_sct_01/ff_sct_01_v1_preview.png)、[正式 GLB](../public/assets/models/ff_sct_01_v1.glb)
- 可恢复旧版：`.tmp/player-support-gold-before-20260809/`
- 隔离 raw / KTX2 / 完整 42 件候选：`.tmp/player-support-gold-candidate-20260809-2219-raw/`、`.tmp/player-support-gold-candidate-20260809-2219-ktx2/`、`.tmp/player-support-gold-full42-20260809-2219/`
- 同镜头旧版基线：`docs/qa/combat-vehicle-family-before-1440x900-high.png`

## SHA-256

| 资产 | 旧 raw | 新 raw | 旧 public | 新 public |
| --- | --- | --- | --- | --- |
| FF-ART-01 | `1E596AF9A192B0A691316CBCAC41B1E28667DC016885E20DC4203B769625B15C` | `2937B5E7851F8C65BE9B968B5200C310AC8021179C872F2FDB234C149333BCDC` | `EFD713CB536E08861A58EAFBAB5AAB77C88871323F3D4C452A7A6C117C76457F` | `A52EDE4A3FA180E04F7E98D02EE97186CF0617806CE575683710EE1890914E50` |
| FF-SUP-01 | `A7C6DCBCD71B8BC441CE4BDFEB5D3A49F4DFDDBE01E7E7F1F017670B5BC105DF` | `F14988DB72D987F42F210A887939F77B709DD1B9BD91891845AB5179BD052AD9` | `565FBBE7D7796860C827AB33F1B45B20CDCB535C676ED71B8C59A4F174AB6886` | `3A2EADA2A577968001E35557B383C1E9F0C80AE0FF1FA39AF0DCA3FD1A66B3FE` |
| FF-SCT-01 | `B94A1A2095A59C8EF082B1634F58F969A2D1E7AD2CD2B93205F0F9586C1EFD05` | `F70B0587BABE65019C6F405BF1956D183D0314F159FDC3D316B3E1C5101EB6E8` | `916A19B8E5E6968E35C1AD02CDA73C64B6A040D71EBADB0285DA8AC7E3FB6477` | `98B3EE8564883EA996C134452F2D9EC939A547958436CA7E07EA468ADC513E2F` |

当前母版 SHA-256：ART `5E8D9F710FCA5526AAE9534F11FC7637CA5BBF7978E774E0A4B84EC762A62B25`，SUP `D33931ECF79BEE9B82B2BC04145B06A79EEC4A22BADF28AF097329725C9DBD7E`，SCT `ADB14F78D7ED80CE138AA642334819E4CCF32C6B2DF4172C81F00A83481433D8`。预览 SHA-256 分别为 `A1E320AF8762DC0DDA8E5591920B1FA2E596A97743429E537B9E08D8650BFC6E`、`E9645CDB319519D3D319D1BDAB573B11B5492C59E45FE9D497E5A9A62E3EF41A`、`2D387090F7D74C8ABC1493D7F384975089E835C6632D86588F5F1323B74FA9C7`。

## 验证结果

- 人工战略预览：3/3 通过，未追加微型 greeble 或新纹理。
- 隔离完整模型库：42/42 `--require-ktx2` 合同通过。
- 正式模型库：42/42 `--require-ktx2` 合同通过。
- validator 与 mutation：21/21 通过。

