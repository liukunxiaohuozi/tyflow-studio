# TingYun Studio

OpenDesign → Tyflow → 开发与自动化测试的独立桌面工作台。基于已确认的 OpenDesign v1.7 交互设计，支持 Windows 和 macOS。

## 使用

1. 启动客户端，在「开发配置」设置开发者、项目本地目录和 Git 地址。初始项目是 `explore`、`o11y-apm-ui`，目录按当前用户的 Desktop/project 初始化，可修改。
2. 确认本机已安装并登录 Codex CLI、Git、项目所需 Node.js；配置 Tyflow 目录及自动化测试 Skill 的 `SKILL.md`。
3. 导入 OpenDesign HTML/ZIP，或输入文字需求/Bug 并拖入截图、日志。导入保留文件事实与 SHA-256；Agent 生成需求摘要、开发计划和测试用例。
4. 在录入页先选择项目以及新建/已有分支，再基于该分支执行。新需求与设计交付可预览计划和用例后确认执行；Bug 点击“开始修复”后直接调用 Codex 定位和修改，不设置单独的 Tyflow 计划确认环节。
5. 测试可以自动介入，或等待手动点击。真实命令日志、Skill 检查与阻塞项可查看。所有必要检查通过后启动配置脚本，探测本机目标 URL，自动打开系统浏览器；开发者验收后点击“验收并提交代码”，客户端提交本次修改并推送到开发分支。

只有人工验收按钮会提交并推送，不会自动合并或发布。仓库有未提交改动时，初次执行会停止并提示处理。推送失败时保留本地提交，可在处理认证或远端冲突后重试；分支或提交变化会阻止继续操作。不要并行在同一工作目录切换分支。

设计包运行于独立沙箱窗口，没有 Node/IPC 能力。只允许读取该包内部文件，外链资源和网络请求被阻止；含 CDN 的设计建议先打包本地资源。导入最多 20 个文件，单个输入 100 MB、解压单文件 50 MB、总量 200 MB、2000 个条目。

凭据由 Electron safeStorage 通过当前 OS 用户加密存储，不回传到页面。Git 的系统 SSH/凭据助手及 HTTPS Token/密码连接测试可用。禅道目前支持配置与地址连通性检测；版本专用登录、Bug 导入/回填属于后续接入，界面不会把站点可达标记成认证成功。

## 开发与打包

构建环境：Node.js >=22.12（建议 24）、npm、Git。客户端使用内置 Electron；执行业务工程需要本机的 Node/Git/Codex。

```sh
npm ci
node node_modules/electron/install.js
npm run dev
npm run typecheck
npm run lint
npm test
npm run scan
npm run build
npm run pack:portable   # Windows 便携包：程序 + Tyflow + Skill → release/*.zip
npm run dist:win        # Windows 主机，NSIS x64 安装包
npm run dist:mac        # macOS 主机，DMG/ZIP arm64 + x64
```

### 发给同事（推荐：便携压缩包）

**Windows（可在当前 Windows 电脑直接打）：**

```sh
npm run pack:portable:win
```

生成：`release/TingYun-Studio-<version>-Windows-x64-portable.zip`  
同事解压后双击 `TingYun Studio.exe`。

**macOS（必须在 Mac 电脑，或用 GitHub Actions）：**

不能在 Windows 上交叉编译可用的 Mac 客户端。任选其一：

1. 在 Mac 上：

```sh
npm ci
npm run pack:portable:seed   # 可选：把本机 Tyflow/Skill 同步进 portable-bundle/
npm run pack:portable:mac
```

生成：

- `TingYun-Studio-<version>-macOS-arm64-portable.zip`（Apple Silicon）
- `TingYun-Studio-<version>-macOS-x64-portable.zip`（Intel）

同事解压后双击 `TingYun Studio.app`。

2. 用 GitHub Actions：先在本机执行并提交 `portable-bundle/`，再推送 tag 或手动跑 `Desktop builds` workflow。Tag 构建会创建或复用对应 GitHub Release，分别重试上传 Windows x64、macOS arm64、macOS x64 三个 portable zip，并在结束前核对产物；手动构建可从 Artifacts 下载。

```sh
npm run pack:portable:seed
git add portable-bundle
git commit -m "Add portable skill bundle for CI"
```

可选环境变量（打包前覆盖来源目录）：

- `TYFLOW_DIR`：默认优先 `portable-bundle/tyflow`，否则 `%USERPROFILE%\.tyflow`
- `TEST_SKILL_DIR`：默认优先 `portable-bundle/skills/frontend-test`，否则 Codex skills

跑完整 AI 流程时，同事本机仍需 Git、Node.js、已登录的 Codex CLI。

产物在 `release/`。`.github/workflows/desktop.yml` 提供 Windows/macOS 各自在原生 runner 构建的流程；本地验证不代表该远程流程已经执行。未配置开发者证书的包未签名；macOS 正式分发需 Apple Developer 签名与公证，Windows 正式推广建议配置代码签名。不会将任意证书/密码写进源代码。

`npm run dev:web` 可浏览界面，浏览器明确显示「预览模式」且不会执行本机任务。真实持久化、文件和命令能力在桌面客户端内使用。

## 数据与架构

- React renderer：`src/renderer`；类型契约：`src/shared/contracts.ts`。
- Electron main/preload：`src/main`。设置、文件、Git 和进程权限仅在 main。
- `state.json` 为原子写入的任务与设置；`credentials.json` 仅含系统加密数据；`assets/` 为导入文件；`runs/` 为每次 Agent 输出。数据位置在客户端环境信息中显示（Electron 当前用户 userData）。
- 重启会把未完成的运行标记为中断，保留日志/快照。每个任务保留最近 2000 条日志，避免无限内存增长；导出的任务 JSON 包含这些日志和执行快照，不含凭据。
- 只使用本地 Codex CLI 的 `exec --json --output-schema` 协议：评估为 read-only，开发与测试为 workspace-write。CLI 登录和可用额度由当前用户管理。
- 自动化检查执行实际发现的 `typecheck`/`tsc`、`lint:js`、`test`、`build`，避免默认运行会批量改文件的组合 lint 脚本。测试脚本环境为 `CI=true`，每项超时 10 分钟。
- 开发服务不覆盖已经响应的目标端口，避免打开另一个项目；关闭客户端会停止其启动的子进程。

本产品不包含原型里用来展示交付流程的「告警规则筛选优化」业务功能。

设计新版采用前可查看文件差异；失败后可点击修复并重测。历次执行与测试保留最近 50 次结果，首次失败不会被重试结果覆盖。启动失败时可以在配置页修改启动脚本或本机页面地址，再从启动阶段重试，代码目录与分支快照保持冻结。
