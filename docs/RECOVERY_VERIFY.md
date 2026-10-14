# 阶段恢复验证记录

日期：2026-10-14。环境：Windows，本仓库本地源码。范围：恢复机制、模块边界、IPC/界面和既有回归。未发布、未替换正在使用的客户端。

## 独立依据

Oracle 为本次用户明确提出的六项恢复要求和八个模块边界，以及仓库既有的冻结分支、批准计划、禁止自动提交/推送规则。测试通过受控 CLI、临时 Git 仓库和本地 HTTP 服务观察实际命令次数、提交身份、持久化状态和页面操作，不以 AI 的“成功”总结作为断言依据。

## 已执行

| 检查 | 结果/证据 |
| --- | --- |
| TypeScript、ESLint、生产构建 | 通过；npm run typecheck / lint / build |
| i18n | npm run scan 通过，649 个调用，582 个键，英文无中文残留 |
| 全量回归 | npm test：20 suites passed；163 tests passed，2 个按平台条件跳过 |
| 全量之后新增专项 | 5 项新增故障/隔离测试通过：Agent 无输出、网络 turn.failed 但退出 0、代码失败分类、Policy 失败复用开发 Agent、通知渠道失败隔离 |
| 最后增量回归 | 用例级复用、Git 推送、Policy 复用、失败历史、启动重试 5 项再次通过 |
| 真实客户端 | scripts/verify-team-ui.cjs：Electron、preload、IPC 和页面实际交互通过，pageerror 为 0 |

命令位置以 package.json 和 tests/ 现有配置为准。曾有一次额外测试命令误列不存在的文件而未运行对应套件；随后实际全量发现与执行 20 套通过，不将该次 ENOENT 当作代码失败或成功证据。

## 关键事实

- CASE-1 通过、CASE-2 失败：重试请求仅含 CASE-2；npm 测试命令和 CASE-1 的 attempts 保持 1、reused 增为 1，评估和开发 Agent 不再调用。
- 差异硬闸失败：代码未变时开发 Agent 只调用一次，重试仅重新验证硬闸。
- Git 第一次推送失败：local commit 已保存；重试接受沿用同一 HEAD，Agent 调用数不变。
- 非 Bug 评估暂停：取消弹窗保持 stopped；追加文本后恢复，原始需求保留，阶段历史同时存在 stopped 与 passed。
- 检查点重启、结果文件篡改、基线变化、停止后返回结果均有拒绝误用/误通过的断言。
- 超时记录为 Agent/IDLE_TIMEOUT 并保留快照；重试使用同一冻结工作区。
- 有效 JSON 与进程退出 0 不能掩盖网络 turn.failed。
- 测试代码/业务文件边界仍受硬闸保护；忽略的 .env/.npmrc 内容以哈希参与基线与测试变更保护。
- 完成通知通道异常不会反向使任务失败。

## 页面证据

test-results/team-readiness-ui/result.json

- assessment-paused.png
- assessment-resumed.png
- failure-recovery.png
- project-workspace.png、setup.png、updates.png、workspace-choice.png

测试只使用临时数据目录，不加载用户真实任务、凭据或业务项目。临时项目/进程退出时清理，页面结果和截图留在上述证据目录。测试生成截图对应受控界面，不是视觉批准基线。

重复烟测暴露了测试脚本固定端口冲突和退出后再次访问 Playwright process/close 的清理问题；测试端口改为动态临时端口，提前保留 ChildProcess 引用并在已退出时跳过重复 close。该修改只影响测试 harness，不改变用户的按需验证端口策略。

## 尚未证明

- 真实 Codex 模型诊断质量、真实账户额度、实际断网后 CLI 内部重连行为。
- macOS GUI 环境、进程组强制退出、真实 Git 认证/hook 和 Mac 更新器：本次只有 Windows 实机；平台条件测试不冒充 Mac 验证。
- 外部后端、权限、测试数据在两次执行之间完全一致。
- 新安装包可下载/可安装、团队端更新成功：本次未打包发布。

结论：本地源码与 Windows 受控恢复链路已验证，可进行内部人工审查；不能据此宣称所有团队机器和真实 AI/网络条件都已验证。
