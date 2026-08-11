# Web 平台边界与完整 RTS 引擎选择

更新时间：2026-08-11

## 结论

《断层战线》当前应继续作为 **桌面 Web RTS 技术垂直切片** 保存，不立即迁移引擎。

这一版本已经回答了关键技术问题：TypeScript、Three.js、原生 DOM HUD、确定性模拟、Blender/GLB 资产和浏览器发布链能够承载一张地图、几十个单位、完整经济与战斗闭环。现阶段缺少的主要不是另一套渲染技术，而是完整世界观、阵营差异、战役结构、任务内容和长期成长设计。

如果产品目标以后扩展为多地图完整战役、更多单位、Steam 桌面发行和长期内容生产，应以 **桌面原生游戏** 为主要目标重新评估 Godot 4 或 Unity；当前 Web 版继续保留为在线试玩、规则参考、资产评审和玩家验证入口。

## 当前 Web 实现适合什么

- 无需安装即可分享，适合概念验证、公开试玩、作品展示和封闭测试。
- TypeScript 开发反馈快，浏览器调试、自动化测试和 GitHub Pages 发布成本低。
- 适合单地图、小到中等规模单位、风格化 3D、单机确定性任务。
- 当前模拟与表现严格分层，权威状态不依赖 Three.js 资产是否加载成功，便于验证规则。
- Blender 母版、GLB、语义 socket、KTX2、关卡数据和确定性测试已经形成可复用生产基线。

因此，Web 不是错误方向；它是当前技术探索最有效的交付形态。

## Web 平台的实际限制

### 1. 主线程竞争

当前 20Hz 模拟、Three.js 渲染、原生 DOM HUD、寻路、战争迷雾和部分 AI 主要共享浏览器主线程。地图、单位、弹道和决策数量继续增长时，计算峰值会直接影响鼠标、镜头与界面响应。

Web Worker 可以把模拟放到后台线程，但 Worker 不能直接操作 DOM，状态需要消息复制或转移；若使用 `SharedArrayBuffer`，页面还必须处于安全上下文并启用跨源隔离。迁移模拟到 Worker 是 Web 版扩大规模前的架构门槛，而不是零成本开关。

### 2. 图形与资源预算

当前 WebGL2 足以呈现本项目的风格化战略镜头，但相较桌面 DirectX、Vulkan 或 Metal，GPU 功能、调试、驱动控制和资源管理更受浏览器约束。WebGPU 提供更现代的 GPU 接口，但正式产品仍需能力检测、兼容路径和真实设备覆盖，不能仅凭开发机支持就移除回退。

42 件 GLB 已证明浏览器可以加载当前内容；继续增加地图和资产后，首屏下载、解码、纹理重复、标签页内存压力和可见模型热替换会成为比三角形数量更明显的问题。

### 3. 输入、音频和浏览器生命周期

边缘滚屏、浏览器缩放、页面焦点、系统快捷键、全屏、鼠标捕获和音频解锁都受网页容器影响。全屏、指针捕获和音频通常必须由玩家手势触发；标签页进入后台后还可能被暂停或节流。

这类问题可以缓解，但无法像原生桌面窗口一样完全由游戏掌控。

### 4. 存档、发行与系统能力

当前是浏览器 `localStorage` 单槽命令日志存档。浏览器数据可能被用户清理，长局还需要从 tick 0 重建。IndexedDB、自动存档和快照可以改善体验，但文件目录、云存档、Steam 成就、崩溃报告、安装更新与模组支持仍更适合桌面运行时。

### 5. 网络能力

浏览器主要使用 HTTP、WebSocket 和 WebRTC，不能像原生程序一样自由访问底层套接字。当前单机确定性模拟不受影响；如果以后制作锁步联机、专用服务器、反作弊或断线重连，需要独立设计网络权威和服务端，而不是直接把现有单机循环联网。

### 6. 内容生产效率

这是完整游戏最重要的限制。Three.js 是渲染库，不是集成游戏编辑器。当前地图、任务、镜头、UI、语义绑定和评审场景大量依赖 TypeScript 与脚本生成。技术验证很高效，但制作数十关剧情时会缺少成熟的可视化关卡编辑、时间轴、动画状态机、AI 调试、资源引用和策划数据工具。

如果完整故事确定后发现主要成本来自“反复制作和调整关卡”，而不是浏览器性能，就说明应该评估原生引擎。

## Godot 4 是什么

Godot 4 是一套开源、跨平台的完整游戏引擎。它提供场景树、节点/组件组织、2D 与 3D 渲染、物理、导航、动画、UI、音频、资源导入、调试器和编辑器扩展。项目可以使用 GDScript，也可以在桌面目标中使用 C# 或通过 GDExtension 接入原生代码。

对本项目最有价值的不是“画面更强”，而是把关卡、任务触发、单位预制体、动画、碰撞、导航和 UI 放进统一编辑器，让内容生产从修改大型 TypeScript 文件转为可视化场景与数据资源。

Godot 4 的 Web 导出目前以 WebGL2 Compatibility 渲染器为主，Web 平台存在音频、后台处理、存储和网络限制。因此，如果选择 Godot，建议把 Windows 桌面原生版本作为主要产品，Web 版继续使用现有 Three.js 项目，而不是指望 Godot 自动消除浏览器限制。

## Godot 4 与 Unity 的主要区别

| 维度 | Godot 4 | Unity 6 |
| --- | --- | --- |
| 定位 | 开源、轻量、编辑器与运行时一体 | 商业化成熟、生态庞大的通用引擎 |
| 主要语言 | GDScript；桌面可用 C#；可接 GDExtension | C#；底层由 Unity 原生运行时承载 |
| 学习和迭代 | 场景树和节点直观，小团队上手较快 | 系统与包更多，前期规范成本更高 |
| 内容编辑 | 关卡、动画、UI、资源和脚本统一 | 同样完整，且大型团队生产工具更成熟 |
| 资产生态 | 官方与社区资产较少，但无厂商锁定压力 | Asset Store、插件、中间件和招聘市场更大 |
| 大规模单位 | 可通过数据化设计和自定义服务器优化，需要团队自己建立规范 | 可使用 Jobs/Burst/DOTS 等数据导向工具，但复杂度较高 |
| 3D 与性能工具 | 足够完成风格化中小型 RTS，源码可控 | Profiler、平台支持和商业项目经验更丰富 |
| Web 导出 | WebGL2 Compatibility；仍受浏览器限制 | Web 构建同样受线程、文件系统、网络、图形和音频限制 |
| 授权与控制 | MIT 开源，可修改引擎源码 | 商业产品，需遵守 Unity 当期授权与服务条款 |
| 最适合 | 个人或小团队、开源优先、桌面单机、强调自主可控 | 商业团队、Steam 多平台、依赖成熟插件和招聘市场 |

Godot 的优势是简单、开放、内容生产成本可控；Unity 的优势是生态、团队协作、分析工具、平台覆盖和商业项目经验。两者都不能直接复用当前 TypeScript 游戏逻辑，迁移都意味着重写运行时，但 Blender 资产、GLB 语义、关卡坐标、玩法规则和测试案例仍可作为迁移合同。

## 其他可选路线

### Electron 或 Tauri

如果只是希望把当前项目发布为可安装桌面程序，而不是重做完整游戏，可以封装现有 Web 版：

- Electron 自带 Chromium，一致性较强、迁移最少，但包体和内存较大，性能边界仍接近浏览器。
- Tauri 使用操作系统 WebView，包体更轻，但不同系统 WebView 的一致性和 Rust 桥接需要额外治理。

两者可以改善窗口、文件和桌面发行体验，但不会自动解决 Three.js 内容工具不足或大规模模拟问题。

### Unreal Engine

除非美术目标转向高保真写实、复杂电影化演出或大团队制作，否则 Unreal 对当前风格化经典 RTS 明显过重。若用 Unreal 向浏览器交付，通常需要 Pixel Streaming，让服务器运行游戏并向浏览器推流，会增加 GPU 服务器、网络延迟和运营成本。

## 对《断层战线》的推荐路线

### 当前阶段

1. 冻结 v0.6 Web 版，保留线上试玩、CI、Pages、42 件资产和确定性质量门。
2. 先完成世界观、阵营、人物、战役章节、任务清单和每关新机制。
3. 暂停无目标的模型精修和零散系统扩展。

### 故事方案完成后

1. 选取第一关的一小段，用候选引擎重做技术样片，不直接迁移完整项目。
2. 样片至少覆盖：20–50 个单位、一次采集建造、一次任务波次、存档、完整 HUD 和 Blender 资产导入。
3. 比较内容制作时间、帧时间、调试效率、包体、团队熟悉度和发布流程，再决定生产引擎。

### 选择规则

- 仍是单地图或少量关卡、在线分享优先：继续 Three.js。
- 希望最快形成可安装桌面版本且最大化复用：Electron。
- 个人或小团队制作完整桌面单机 RTS：优先试验 Godot 4。
- 准备组建商业团队、依赖大量第三方插件并发布多平台：优先试验 Unity。
- 只有高端写实和大型团队目标明确时才评估 Unreal。

## 可复用与需重写的边界

可以直接或经过转换复用：

- Blender `.blend` 母版、原始纹理与 GLB；
- 语义节点、socket 名称、父子关系和轴向合同；
- 地图坐标、单位参数、难度表和任务阶段规则；
- 视觉方向、资产预算、验收截图与故事设计；
- 确定性测试中的输入、阶段、胜负和时间窗口，作为新引擎验收案例。

需要重写：

- TypeScript `GameSimulation` 的运行时实现；
- Three.js 场景同步、材质、LOD、VFX 与拾取；
- 原生 DOM HUD、输入绑定和浏览器存档外壳；
- 引擎对应的导航、动画、资源加载和发布集成。

因此，未来迁移应被视为“依据现有规格重建生产版本”，而不是逐行翻译代码。

## 官方参考

- [MDN：Using Web Workers](https://developer.mozilla.org/docs/Web/API/Web_Workers_API/Using_web_workers)
- [MDN：SharedArrayBuffer 安全要求](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- [MDN：WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Godot：Exporting for the Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
- [Unity：Web 技术限制](https://docs.unity3d.com/cn/current/Manual/webgl-technical-overview.html)
- [Electron：Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Tauri：Process Model](https://v2.tauri.app/concept/process-model/)
- [Unreal Engine：Pixel Streaming Overview](https://dev.epicgames.com/documentation/unreal-engine/overview-of-pixel-streaming-in-unreal-engine)

