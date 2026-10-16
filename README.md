# TingYun Studio

OpenDesign → Tyflow → 开发与自动化测试的独立桌面工作台。基于已确认的 OpenDesign v1.7 交互设计，支持 Windows 和 macOS。

## 使用

1. 启动客户端，在「开发配置」设置开发者、项目本地目录和 Git 地址。初始项目是 `explore`、`o11y-apm-ui`，目录按当前用户的 Desktop/project 初始化，可修改。
2. 确认本机已安装并登录 Codex CLI、Git、项目所需 Node.js；配置 Tyflow 目录及自动化测试 Skill 的 `SKILL.md`。
3. 文案、样式、小 Bug 默认选择「L1 轻量修改」，输入需求即可点击「开始修改」。直接使用当前项目目录和当前分支，不单独评估、不拉取或切分支、不新建工作区、不自动安装依赖；保留必要的局部检查和国际化要求。
4. 已启动项目时，代码保存后直接在原浏览器查看热更新，不必再次启动、登录或打开专用浏览器。自动化测试默认关闭；需要时明确勾选或事后点击可选入口。人工查看不产生自动化测试通过结论。确认效果后，可明确点击「我已验证，提交并推送代码」。
5. 页面需求、OpenDesign 交付或需要新分支/并行工作区时，切到「标准开发」，选择项目与分支、评估并确认计划后执行。独立工作区仍保留隔离和专业测试能力。旧任务的冻结目录不会自动搬迁或合并到原项目；未执行草稿可切换模式。

需求文档＋Figma 设计图片不需要先转 HTML：在「文字需求 → 选择需求资料」上传 ZIP，或多选 Markdown、TXT 和图片。ZIP 中的文档、图片保留相对目录并展示清单，可本地预览和移除。误从 OpenDesign 入口上传纯资料包时自动转为标准文字需求，保留测试开关；有文档时不必再次粘贴全文。评估会得到实际资料目录与文件清单，读取文档并查看设计图；图片不能代替业务交互定义。当前不包含 PDF、Office 文档解析或 Figma 链接抓取。

只有人工验收按钮会提交并推送，不会自动合并或发布。仓库有未提交改动时，初次执行会停止并提示处理。推送失败时保留本地提交，可在处理认证或远端冲突后重试；分支或提交变化会阻止继续操作。不要并行在同一工作目录切换分支。

设计包运行于独立沙箱窗口，没有 Node/IPC 能力。只允许读取该包内部文件，外链资源和网络请求被阻止；含 CDN 的设计建议先打包本地资源。导入最多 20 个文件，单个输入 100 MB、解压单文件 50 MB、总量 200 MB、2000 个条目。

凭据由 Electron safeStorage 通过当前 OS 用户加密存储，不回传到页面。Git 的系统 SSH/凭据助手及 HTTPS Token/密码连接测试可用。禅道支持账号登录、产品/项目/待办加载、本地项目映射和任务关联；状态回写仍未启用。

## 0.3.4：阶段恢复与企业微信通知

企业微信通知已接入「开发配置 → 完成通知」：Webhook 由本机加密保存，先保存再主动发送测试消息；关键节点自动发摘要，失败不阻断任务，同一事件不自动重发。GitLab MR、CI、禅道回写尚未接入本轮。配置、隐私和验证边界见 [WECOM_NOTIFICATIONS.md](docs/WECOM_NOTIFICATIONS.md)。0.3.4 内部试用说明见 [发布说明](docs/releases/0.3.4.md)；下载包以 GitHub Release 实际发布结果为准。

评估、开发、测试、启动和交付记录独立检查点。失败页面显示环境/Agent/代码/测试/Git/硬闸/中断分类、影响范围和建议动作；重试从失败阶段继续，复用基线一致且证据有效的已通过命令和用例。推送重试沿用已有本地提交，不重开发、不重测试。

非 Bug 任务也可以“暂停并补充”；待确认、待测试和待验收支持追加信息。取消弹窗会保持暂停；未执行计划收到补充后需要重新评估，冻结需求范围不自动扩大。本地执行配置可调整 Agent 无输出和总时长上限。

内部拆分、恢复边界和检查点清单见 [RECOVERY_ARCHITECTURE.md](docs/RECOVERY_ARCHITECTURE.md)。源码提交不会自动替换正在运行的客户端，需要发布并启用新版本。

## 0.3.0：内部更新和单人多任务

- 左侧“接入项目”进入该项目工作台并高亮项目，只显示该项目的任务与统计；“在此项目新建任务”默认选中该项目。项目工作台提供本地目录、仓库配置状态和启动脚本概况；修改配置使用独立的“管理项目配置”/“开发配置”入口。项目绿色圆点仅表示本地目录已配置，不代表服务运行或体检通过。
- 新任务默认选择独立工作区：从所选已提交版本创建 Git worktree，不带入原目录未提交源代码。每个任务拥有独立目录、分支、依赖、日志与停止控制。选择“已有分支”时它作为基线，创建 `studio/task-<任务 ID>` 分支，验收后推送任务分支，不自动覆盖基线。
- 本地执行配置中的并发数为 1–4，默认 2；超出上限自动排队。当前目录模式对同一目录串行执行。重启把运行和排队任务标记为中断，用户明确重试后继续，不自动重放提交。
- 独立工作区按锁文件安装依赖；仅复制原目录中已忽略的 `.env`、`.env.local`、`.env.development`、`.env.development.local` 和 `.npmrc`（不覆盖任务中已有文件，不复制符号链接）。其他私有环境配置需在“打开工作区”中自行补充。失败重试保留已有代码。
- 默认按需切换一个验证项目：切换时停止 Studio 启动的上一任务服务，并将它恢复为待人工验证；复用验证窗口。需要复用已有登录或 SSO 时，可点击“在浏览器验证”，使用系统浏览器；自行启动时先确认任务工作区和分支。可选多项目同时验证，Studio 分配端口并传递 `PORT`，Vite 另外传递 `--port/--strictPort`。自定义脚本必须支持端口参数或 `PORT`；固定写死的端口需先调整。
- 首次使用可在本地执行页运行完整体检：Git、Node/npm、Codex 兼容性与登录、Tyflow、测试 Skill、项目启动脚本。每次 Agent 执行前也检查登录状态。
- “客户端更新”支持 HTTPS 内部清单或 GitHub Releases。私有仓库使用单独的更新 Token，经系统凭据存储加密；不把 Token 写入更新清单或发布包。
- 下载核对平台、架构、大小和 SHA-256，拒绝危险 ZIP 路径。允许边开发边下载；激活时要求没有运行/排队/提交任务，关闭自有验证服务并重启。新版本装在用户数据目录 `updates/versions/`，保留原客户端；“回退上一版本”返回此前的应用。配置、凭据和任务历史继续使用原 userData，包内技能路径随客户端更新。
- 再次从原快捷方式启动时会转向已选择的新版本。请保留原客户端目录和 `updates/versions/`；回退切换应用版本，不回滚任务数据或 Git 代码。

0.2.x 客户端没有更新入口，第一次需手动升级到 0.3.0；之后可从入口更新。新版本 Release 必须包含三个 portable ZIP 和 `update-manifest.json`。工作流会生成清单、上传并核对后再公开 Release；私有仓库 Token 需要相应仓库读取权限。也可将三个包和清单放在内部 HTTPS 服务上，修改清单中各包的 URL。

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

便携包会在注入 Tyflow/Skill 后重新进行 ad-hoc 签名并严格校验应用包完整性。由于没有 Apple Developer 公证，首次下载仍可能被 Gatekeeper 拦截：先将应用拖入「应用程序」，右键选择“打开”；若仍提示“已损坏”，在终端执行：

```sh
xattr -dr com.apple.quarantine "/Applications/TingYun Studio.app"
```

2. 用 GitHub Actions：先在本机执行并提交 `portable-bundle/`，再推送 tag 或手动跑 `Desktop builds` workflow。Tag 构建会创建或复用对应 GitHub Release，分别重试上传 Windows x64、macOS arm64、macOS x64 三个 portable zip，并在结束前核对产物；手动构建可从 Artifacts 下载。

执行失败后无需重建任务：详情页可选择“补充信息后重试”，追加复现条件、期望结果、截图、日志或文本附件。Studio 会保留原需求快照、失败日志和已有代码，把补充内容作为独立证据记录，并从当前失败阶段继续。

```sh
npm run pack:portable:seed
git add portable-bundle
git commit -m "Add portable skill bundle for CI"
```

可选环境变量（打包前覆盖来源目录）：

- `TYFLOW_DIR`：默认优先 `portable-bundle/tyflow`，否则 `%USERPROFILE%\.tyflow`
- `TEST_SKILL_DIR`：默认优先 `portable-bundle/skills/frontend-test`，否则 Codex skills

跑完整 AI 流程时，同事本机仍需 Git、Node.js、已登录的 Codex CLI。

产物在 `release/`。`.github/workflows/desktop.yml` 提供 Windows/macOS 各自在原生 runner 的回归、构建和打包冒烟流程；本地 Windows 验证不代表远程 Mac 流程已经执行。内部发行不要求购买证书或 Apple 公证；macOS 包保留 ad-hoc 签名与完整性校验，系统仍可能要求在隐私与安全性中确认打开。

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
