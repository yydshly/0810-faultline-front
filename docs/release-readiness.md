# 发布与部署就绪说明

更新时间：2026-08-11  
当前包版本：`0.6.0`

公开桌面版本：<https://yydshly.github.io/0810-faultline-front/>
当前 Pages 提交：`5a5d2661a882d7f3e9c6df831b0a48d4681cf95e`

最终整合候选：

- `release/faultline-front-prototype-v0.6.0-20260811T064551Z.zip`
- ZIP：17,434,799 bytes；游戏文件 50 个，未压缩内容 28,370,389 bytes；ZIP 条目 52 个。
- SHA256：`9bd38f523ddaf2d5e2ea3569a2856b1c9e4679c9415427d3b0eea6770d5bb1b5`
- 同名 `.zip.sha256` 已生成；包内 `RELEASE-MANIFEST.json` 与 `SHA256SUMS.txt` 已由打包脚本逐项验证。
- 包内源码身份：提交 `33a9122b72a13d1a3f4b1a571509f261f2ae656d`、分支 `main`、标签 `v0.6.0`、`dirty: false`、`identity: git-tagged-verified-dist`。

## 发布边界

本项目当前同时交付桌面 Web 本地发布包和 GitHub Pages 公网演示，不承诺手机端体验。版本 ZIP 仍只读取已经完成验证的 `dist/`，打包过程不会重新构建、下载依赖或修改游戏源码、UI 与资产；Pages 则只部署通过远端 Quality Gate 的精确 `main` 提交。

项目源码现已纳入 [GitHub 仓库](https://github.com/yydshly/0810-faultline-front)并以版本标签管理。2026-08-09 生成的既有候选包早于仓库初始化，因此其包内清单仍如实记录 `commit: null` 和 `identity: unversioned-verified-dist`；它是经过验证的历史基线，但不应被误述为提交绑定制品。仓库建立后重新运行打包脚本时，清单会自动记录当前提交、分支、精确标签与工作树状态。

远端使用 [Quality Gate](https://github.com/yydshly/0810-faultline-front/actions/workflows/quality.yml) 在 `main` 推送和 Pull Request 上执行锁定依赖安装、TypeScript、331 项确定性测试、生产构建、42 项运行时 GLB/KTX2 合同与校验器 mutation 测试。Quality Gate 成功后，[Deploy Pages](https://github.com/yydshly/0810-faultline-front/actions/workflows/pages.yml) 检出同一 SHA，以仓库子路径构建并通过 GitHub Pages OIDC 部署；版本制品仍发布到 [GitHub Releases](https://github.com/yydshly/0810-faultline-front/releases)，ZIP 与同名 `.sha256` 必须成对上传。

## 制作发布包

先完成并确认项目规定的测试、类型检查、生产构建及资产合同检查，然后在项目根目录运行：

```powershell
npm run release:local
```

脚本从 `dist/` 读取文件，在 E 盘项目内的 `release/` 生成：

- `faultline-front-prototype-v0.6.0-<UTC时间>.zip`
- 同名的 `.zip.sha256` 整包校验文件

压缩包根目录就是可托管站点，另包含：

- `RELEASE-MANIFEST.json`：版本、UTC 制作时间、入口、文件数、总字节数和逐文件 SHA256。
- `SHA256SUMS.txt`：游戏文件及发布清单的逐文件 SHA256。

脚本拒绝空或不完整的 `dist/`、重解析链接，以及 `.tmp`、`tmp`、`temp`、`node_modules`、`.git`、`release`、`__pycache__` 等污染路径；任一步失败都会以非零状态退出。产物和校验均在 E 盘内完成，不使用 C 盘临时目录。

如需复现同名候选包，可直接指定 UTC 时间戳：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/package_release.ps1 -TimestampUtc 20260810T000000Z
```

## 启动与验收

解压 ZIP 后，不能直接双击 `index.html`；应进入解压目录启动静态 Web 服务。例如本机已经安装 Python 时：

```powershell
python -m http.server 4180 --bind 127.0.0.1
```

也可以在项目根目录直接预览已验证的 `dist/`：

```powershell
npm run preview -- --port 4180
```

浏览器打开 `http://127.0.0.1:4180/`。发布前应重新确认：首屏资源加载完成、选择与移动、建塔与生产、战斗、暂停/恢复、胜败与重开；保存突破战后返回根地址继续上次战况，确认恢复成功且一次性续战参数被清除，并检查失效续战会安全回退；控制台无错误。

## 当前验证基线

- 默认入口先在 00:00 显示三档任务简报；存在有效突破战存档时额外显示保存难度与作战时间并优先聚焦“继续上次战况”。续战锁定存档场景、种子与模拟刻，成功后清除一次性地址参数，失效时安全回到新战局简报。
- 最近一次完整门禁为 33 个测试文件、331 项测试通过；42/42 GLB 资产合同通过，其中 17 件有纹理资产满足 KTX2 合同、25 件为无贴图 PBR；TypeScript 与 Vite 36 modules 生产构建通过。
- 公网冷启动加载 40/40 个当前突破战请求资产，失败 0、重试 0、材质冲突 0；Basis JS/WASM 与模型均来自 `/0810-faultline-front/assets/`，控制台 warning/error 为 0。标准战局启动、保存、返回根简报和继续战况均通过。
- 当前 Vite 构建仍会提示 Three.js 分包压缩前 549.65 kB，属于已知非阻塞提示。公网首件模型冷启动记录为 5.762 秒，完整 40 件资产约 30 秒完成；后续应继续测量慢网、缓存命中、帧时间和内存，而不是把绘制调用数等同于线上 FPS。
- 完整公网部署证据见 [GitHub Pages 部署与线上验收](github-pages-deployment.md)。

## 回滚

发布包是不可变的时间戳文件。回滚时停止当前静态服务或撤下当前站点目录，解压并重新托管上一份已验证 ZIP；使用其同名 `.zip.sha256` 先校验整包，再按包内 `SHA256SUMS.txt` 校验文件。

源码层现在可以按提交和版本标签回滚；发布制品层仍应保留每个通过验收的 ZIP 与 `.sha256` 配对文件。既有 `unversioned-verified-dist` 包只能按其 SHA256 回滚，新制品则应同时核对包内提交身份、版本标签和逐文件校验。

GitHub Pages 在 30 天保留期内可重跑目标成功的 Deploy Pages workflow，以原 SHA 重新部署；更长期或需要留下清晰审计链时，应在 `main` revert 到目标提交、等待 Quality Gate 通过，再由 Pages 工作流自动发布。回滚后必须重新执行公开地址的资源、简报、首个命令、保存/续战与控制台烟测。
