# 本地发布就绪说明

更新时间：2026-08-10  
当前包版本：`0.6.0`

最终整合候选：

- `release/faultline-front-prototype-v0.6.0-20260809T171502Z.zip`
- ZIP：17,434,740 bytes；游戏文件 50 个，未压缩内容 28,370,389 bytes；ZIP 条目 52 个。
- SHA256：`4ae4317daccd2ebbc0fb6d9f727a6c55f378c432c6c76a42786b23c7f645910d`
- 同名 `.zip.sha256` 已生成；包内 `RELEASE-MANIFEST.json` 与 `SHA256SUMS.txt` 已由打包脚本逐项验证。

## 发布边界

本项目当前只交付桌面 Web 本地发布包，不执行公网部署，也不承诺手机端体验。发布输入只有已经完成验证的 `dist/`；打包过程不会重新构建、下载依赖或修改游戏源码、UI 与资产。

项目源码现已纳入 [GitHub 仓库](https://github.com/yydshly/0810-faultline-front)并以版本标签管理。2026-08-09 生成的既有候选包早于仓库初始化，因此其包内清单仍如实记录 `commit: null` 和 `identity: unversioned-verified-dist`；它是经过验证的历史基线，但不应被误述为提交绑定制品。仓库建立后重新运行打包脚本时，清单会自动记录当前提交、分支、精确标签与工作树状态。

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
- 最近一次完整本地门禁为 32 个测试文件、315 项测试通过；42/42 GLB 资产合同通过，其中 17 件有纹理资产满足 KTX2 合同、25 件为无贴图 PBR；TypeScript 与 Vite 35 modules 生产构建通过。
- 当前 Vite 构建仍会提示 Three.js 分包压缩前 549.65 kB，属于已知非阻塞提示。它不影响本地候选包制作，但正式公网发布前仍应结合首次加载时间、缓存策略和慢网测试决定是否继续拆分。
- 本文只证明本地发布准备与压缩包完整性，不构成公网部署证明。

## 回滚

发布包是不可变的时间戳文件。回滚时停止当前静态服务或撤下当前站点目录，解压并重新托管上一份已验证 ZIP；使用其同名 `.zip.sha256` 先校验整包，再按包内 `SHA256SUMS.txt` 校验文件。

源码层现在可以按提交和版本标签回滚；发布制品层仍应保留每个通过验收的 ZIP 与 `.sha256` 配对文件。既有 `unversioned-verified-dist` 包只能按其 SHA256 回滚，新制品则应同时核对包内提交身份、版本标签和逐文件校验。
