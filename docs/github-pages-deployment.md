# GitHub Pages 部署与线上验收

更新时间：2026-08-11
状态：已上线并完成桌面冷启动、首局启动与保存续战烟测

## 公开入口与源码身份

- 游戏地址：<https://yydshly.github.io/0810-faultline-front/>
- 源码仓库：<https://github.com/yydshly/0810-faultline-front>
- 当前运行时代码提交：`d2119344123b07d44d1ad7f4319fd3dd9dc7cb22`
- 冷启动优化 PR：[PR #4](https://github.com/yydshly/0810-faultline-front/pull/4)
- `main` 质量门：[Quality Gate #31475947368](https://github.com/yydshly/0810-faultline-front/actions/runs/31475947368)
- Pages 构建与部署：[Deploy Pages #31476060541](https://github.com/yydshly/0810-faultline-front/actions/runs/31476060541)

`v0.6.0` 标签仍固定在版本 ZIP 对应的提交 `33a9122b72a13d1a3f4b1a571509f261f2ae656d`，没有为了部署移动标签。Pages 跟随通过质量门的 `main`，当前线上运行时已包含子路径部署和突破战冷启动流送优化；本页后续纯文档提交会重跑同一构建链，但不改变运行时代码。可下载的 v0.6.0 版本制品仍以 GitHub Release 中的 ZIP、manifest 和 SHA256 为准。

## 部署链

```text
Pull Request
  → Quality Gate（TypeScript / 331 tests / build / 42 GLB contracts）
  → 合并 main
  → main Quality Gate 成功
  → Deploy Pages workflow_run
  → 检出同一成功 head SHA
  → 使用 configure-pages 给出的 base_path 构建
  → 上传 dist Pages artifact
  → github-pages 环境通过 OIDC 发布
```

`.github/workflows/pages.yml` 不直接响应未验证分支。它只在名为 `Quality Gate` 的 `main` 工作流成功后运行，并使用 `github.event.workflow_run.head_sha` 检出被验证的精确提交。部署任务只获得 `pages: write` 与 `id-token: write`，构建任务只有只读权限。

## 仓库子路径处理

项目站点不是域名根目录，而是 `/0810-faultline-front/`。仅让 Vite 重写入口脚本还不够，因为 GLB 和 KTX2 transcoder 原本由 Three.js 运行时直接请求 `/assets/...`，这会错误访问 `yydshly.github.io/assets/...`，并可能静默降级为程序模型。

当前处理方式：

1. Pages 构建把 `configure-pages` 返回的 `base_path` 传给 Vite `--base`。
2. `src/game/public-asset-url.ts` 统一把运行时公共资产解析到 `import.meta.env.BASE_URL`。
3. `BattlefieldScene` 的 KTX2 transcoder 和全部 GLB 请求都经过同一个解析入口。
4. 单测同时锁定本地根路径与 GitHub 项目子路径，避免以后重新出现裸 `/assets/` 请求。

本地复现 Pages 路径：

```powershell
npm run build -- --base="/0810-faultline-front/"
npm run preview -- --port 4181 --base "/0810-faultline-front/"
```

访问 `http://127.0.0.1:4181/0810-faultline-front/`。

## 2026-08-11 公网实机证据

最新验收环境为 1280×720 桌面视口、DPR 1.5、`quality=high`、公开 GitHub Pages 地址。以下时间均为单次实测，不是 p50/p90，也不是 FPS。

| 检查 | 结果 |
|---|---|
| 根简报 | 00:00 显示三档突破战简报，标准难度默认选中，模拟保持战术暂停 |
| 00:00 资产 | requested/loaded/completed = 18/18/18；critical 16、level 2；failed = 0；retries = 0；queued/inflight = 0 |
| 单次公网导航 | 首件正式模型 2.306 秒；critical 16 件在 6.356 秒全部 ready |
| 同会话热载 | 18/18；首件 0.490 秒；critical ready 1.877 秒 |
| 开始后流送 | 41/41 loaded；阶段 `critical,level,frontline,rear,dressing`；首屏 Scene 与计时指标未重置 |
| 材质 | conflict = 0；cross-owner reuse = 0；最终 41 个正式资产 owner |
| 路径 | 入口 JS/CSS/Three chunks 均来自 `/0810-faultline-front/assets/`；18 件正式资产加载成功，控制台无根路径 404 |
| 首次交互 | “开始新战局 · 标准”可用；计时开始，URL 保留仓库路径并写入标准 fixture/seed/quality |
| 保存续战 | 保存后根简报出现“继续上次战况 · 标准”；恢复为 41/41，阶段含优先 `ensure`，`resume` 参数已清除 |
| 控制台 | 根简报、启动、保存、根页返回与续战全程 warning/error = 0 |

本次线上烟测证明站点可打开、正式模型能加载、核心入口和确定性续战可用。生产构建不会暴露开发态 `renderCalls` 等指标，因此本文不把缺失的开发 dataset 当作 FPS 证据；后续性能验收仍需记录帧时间、1% low、内存、慢网与缓存命中。

## 发布边界与回滚

- 当前是公开的桌面 Web 静态演示，不是带 SLA 的商业托管，也没有后端、账号或多人服务。
- GitHub Pages 与 GitHub Release 是两条交付链：Pages 跟随通过质量门的 `main`，Release ZIP 绑定版本标签与独立 SHA256。
- 30 天保留期内可重跑目标成功的 Deploy Pages workflow，以原 SHA 重新发布。
- 更长期回滚应在 `main` revert 到已知良好提交；Quality Gate 成功后会自动触发新的 Pages 部署。
- 每次回滚或新部署后，必须重新检查公开根简报的 18/18、开始后的 41/41、Basis/GLB 子路径、首个命令、保存续战和控制台。
