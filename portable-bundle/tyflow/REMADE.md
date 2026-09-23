# Tyflow 工作流说明

## 1. 工作流定位

Tyflow 是一套面向听云前端需求交付的 AI 工作流。它不是单纯让 AI 直接写代码，而是把一次前端需求从接收、澄清、规格设计、组件复用搜索、计划拆分、开发、接口联调、验证到复盘沉淀串成一个可重复执行的流程。

核心目标：

- 先理解需求，再开始开发。
- 先搜索项目已有组件和模式，再决定是否新写代码。
- 先生成计划和验收用例，再进入实现。
- 开发后必须验证，不能只凭“看起来没问题”宣布完成。
- 每次需求结束后复盘，把可复用经验沉淀成长期规则。

## 2. 目录结构

Tyflow 默认放在用户根目录下：

```text
Windows: C:\Users\<你的用户名>\.tyflow
macOS:   /Users/<你的用户名>/.tyflow
```

当前目录结构：

```text
.tyflow/
  ONBOARDING.md       # 研发 30 分钟上手指南
  GLOSSARY.md         # 术语速查（L轴/T轴/产物/门禁）
  shared/
    WORKFLOW.md       # 工作流主说明（事实来源）
    PROJECTS.md       # 项目路径和命令配置
    RULES.md          # 长期硬规则
    DECISIONS.md      # 已确认决策
    PERFORMANCE.md    # 性能门禁唯一数值源（内网B端基线）
    VERIFICATION.md   # 验证与提测准入门
    TRUST.md          # 信任等级真实存储
    METRICS.md        # 跨需求效果度量聚合
    SECURITY.md       # 脱敏与安全策略
    FEEDBACK.md       # 工作流本身的反馈簿（迭代 Tyflow 用）
    registry/         # 组件、命令索引
    projects/         # 项目级知识：<项目>/LESSONS.md 错题本（防跨需求重复犯错）
  local/
    CURRENT.md        # 活跃需求索引 + 当前默认指针
    active/           # 每个需求的真实状态（支持并行）
    user-preferences.md
    session-notes.md
    cache/
  requirements/
    _example-l2-demo/ # 可照抄的 L2 完整样例
    <requirement-id>/ # 每个需求的过程产物
  skills/             # 已 vendored 的依赖技能
    context7/
    frontend-developer-skill/
    skill-creator/
    document/         # 工作流蓝图/说明文档（非可执行技能）
  REMADE.md           # 当前说明文档
```

其中 `shared` 适合团队共享，`local` 放个人状态和本机临时信息，`requirements` 放每次需求的过程产物，`skills` 放 Tyflow 依赖的通用技能。

## 3. 入口和使用方式

Tyflow 的入口技能是 `tyflow-do`。日常可以这样触发：

```text
$tyflow-do ...
Tyflow，...
听云前端工作流，...
```

示例：

```text
Tyflow，帮我处理一个新需求，目标项目是 o11y-apm-ui。先不要写代码，先梳理需求、找复用组件、生成 SPEC、PLAN 和 TEST_CASES。
```

```text
Tyflow，继续当前需求。
```

```text
Tyflow，继续联调，这是接口信息：...
```

```text
Tyflow，验证一下本次改动。
```

```text
Tyflow，复盘这次需求，看看有没有可以沉淀成规则的内容。
```

## 4. 流程等级

Tyflow 会先判断任务属于 L1、L2 还是 L3。

| 等级 | 适用场景 | 流程要求 |
|---|---|---|
| L1 | 小 bug、样式微调、小字段调整、小交互修改 | 快速修改，最小验证，轻量复盘 |
| L2 | 普通页面需求、新接口接入、常规功能开发 | 需求澄清、SPEC、组件搜索、PLAN、TEST_CASES、开发、验证、复盘 |
| L3 | 跨项目复用、公共组件、高风险业务逻辑、复杂图表、权限、数据范围语义 | L2 全流程，加上 TDD、review、更严格验证 |

如果 AI 判断不准，可以直接纠正：

```text
这个按 L1 处理就行。
```

```text
这个风险比较高，按 L3 走。
```

## 5. 常见产物

每个需求通常会在 `.tyflow/requirements/<requirement-id>/` 下生成这些文件：

```text
REQUIREMENT.md        # 需求来源、目标、范围、验收标准
SPEC.md               # L2/L3 开发真源：Spec ID、版本、规格、变更记录、Traceability
COMPONENT_SEARCH.md   # 可复用组件和页面搜索结果
PLAN.md               # 开发计划
TEST_CASES.md         # 验收测试用例
CONTRACT.md           # 接口契约
INTEGRATION.md        # 联调记录，必须脱敏
VERIFY.md             # 验证结果
REVIEW.md             # 代码审查结果
REVIEW-FIX.md         # review 修复记录
RETRO.md              # 复盘和沉淀建议
```

L2/L3 进入开发前，原则上必须先有 `PLAN.md` 和 `TEST_CASES.md`，并经过人工确认。

L2/L3 现在按 SDD-compatible 方式执行：`SPEC.md` 是开发真源，PRD / 设计稿 / OD / 口头补充都是输入源；每条 P0/P1 规格需要稳定 Spec ID，并在验证阶段闭环到「实现位置 → 测试用例 → 验证证据」。规格发生影响范围、字段语义、交互或验收标准的变化时，先改 `SPEC.md`，再同步 `PLAN.md` / `TEST_CASES.md` 并按需重新确认。

## 6. 接口联调规则

接口联调时可以把 cURL、接口文档或响应样例发给 Tyflow，但必须遵守：

- 原始 cURL 只用于当前联调，不写入共享文档。
- 不保存 token、cookie、Authorization、session、私密请求头。
- 不保存未脱敏响应。
- 只沉淀脱敏后的接口用途、参数、字段含义、映射规则和验证结果。
- 联调阶段优先改 service、mapper、contract，不随意改页面 DOM、样式和交互。

相关依赖 skill：

- `api-contract-generator`
- `api-intelligent-integration`

## 7. Tyflow 的优势

- 降低需求误解风险：先澄清需求和验收标准，再写代码。
- 提升复用率：开发前强制搜索已有组件、页面、路由和项目模式。
- 降低接口联调风险：通过 contract/service 映射约束字段含义，不靠猜。
- 过程可追踪：每次需求都有 REQUIREMENT、SPEC、PLAN、VERIFY、RETRO 等产物。
- 更适合团队协作：规则、决策和组件索引可以沉淀到 `shared`。
- 更容易恢复上下文：通过 `local/CURRENT.md` 记录当前需求、阶段、阻塞点和最近验证。
- 更重视验证：完成前必须记录验证命令、结果、失败原因和剩余风险。

## 8. Tyflow 的劣势

- 小需求会显得流程偏重：L2/L3 需要先写计划和测试用例，速度不如直接改代码。
- 需要维护文档：`shared`、`registry`、`requirements` 需要持续更新，否则会过期。
- 对输入质量有要求：PRD、Figma、接口文档不清楚时，流程会暂停澄清。
- 首次接入成本较高：团队成员需要理解目录结构、流程等级和验证要求。
- AI 仍可能判断错误：任务等级、字段映射、组件复用建议需要人工审核。
- 不适合无约束快速试错：如果只是临时实验或 throwaway prototype，完整流程可能太重。

## 9. 上传 Git 后如何分享

建议把 Tyflow 作为一个独立仓库或项目目录上传 Git，但仓库里的目录名建议使用 `tyflow/`，不要使用 `.tyflow/`。

原因：

- `.tyflow` 是本机运行时目录名，适合放在用户根目录下。
- 带 `.` 的目录在 macOS/Linux 默认隐藏，同事不熟悉时容易找不到。
- Git 仓库里使用 `tyflow/` 更像一个可分享的工作流包。
- 同事下载后再复制到自己的用户根目录，并命名为 `.tyflow`。

推荐对应关系：

```text
Git 仓库中：tyflow/
Windows 本机使用时：C:\Users\<用户名>\.tyflow
macOS 本机使用时：/Users/<用户名>/.tyflow
```

推荐仓库结构：

```text
tyflow/
  shared/
  skills/
  REMADE.md
```

不建议上传个人敏感或临时内容：

```text
local/
requirements/ 中包含敏感客户信息的需求目录
cache/
原始 cURL
token / cookie / Authorization
未脱敏响应
```

提交 `tyflow/` 前，请先检查敏感词：

```text
token
cookie
Authorization
Bearer
session
Set-Cookie
```

## 10. 如何下载和放置

### Windows

假把仓库 clone 到桌面：

```powershell
cd $env:USERPROFILE\Desktop
git clone <你的 tyflow 仓库地址> tyflow
```

复制到用户根目录的 `.tyflow`：

```powershell
Copy-Item -Path $env:USERPROFILE\Desktop\tyflow -Destination $env:USERPROFILE\.tyflow -Recurse -Force
```

最终路径应为：

```text
C:\Users\<用户名>\.tyflow
```

检查是否放置成功：

```powershell
Test-Path $env:USERPROFILE\.tyflow\shared\WORKFLOW.md
Test-Path $env:USERPROFILE\.tyflow\skills
```

### macOS

假设把仓库 clone 到桌面：

```bash
cd ~/Desktop
git clone <你的 tyflow 仓库地址> tyflow
```

复制到用户根目录的 `.tyflow`：

```bash
cp -R ~/Desktop/tyflow ~/.tyflow
```

最终路径应为：

```text
/Users/<用户名>/.tyflow
```

检查是否放置成功：

```bash
test -f ~/.tyflow/shared/WORKFLOW.md && echo "WORKFLOW OK"
test -d ~/.tyflow/skills && echo "SKILLS OK"
```

## 11. Skill 安装说明

`.tyflow/skills` 里放的是 Tyflow 已 vendored 的通用 skill：

```text
context7
frontend-developer-skill
skill-creator
```

另有两个**外部依赖技能**被工作流引用，但不 vendored 在此目录，需从本机 `.codex/skills`、`.claude/skills` 或 `.agents/skills` 安装：

```text
api-contract-generator
api-intelligent-integration
```

这些都不是入口。入口是 `tyflow-do`。三处技能清单（本文件、`skills/README.md`、`shared/WORKFLOW.md`）必须一致；AI 每次改动技能清单后自行核对三处是否一致。

需要把这些 skill 安装到自己的 Codex/agent skill 目录，或者让本地 agent 按 `.tyflow/skills` 作为参考读取。

Windows 常见复制方式：

```powershell
New-Item -ItemType Directory -Force -Path $env:USERPROFILE\.codex\skills | Out-Null
Copy-Item -Path $env:USERPROFILE\.tyflow\skills\* -Destination $env:USERPROFILE\.codex\skills -Recurse -Force
```

macOS 常见复制方式：

```bash
mkdir -p ~/.codex/skills
cp -R ~/.tyflow/skills/* ~/.codex/skills/
```

如果团队使用的是 `.agents/skills`，也可以复制到对应目录：

Windows:

```powershell
New-Item -ItemType Directory -Force -Path $env:USERPROFILE\.agents\skills | Out-Null
Copy-Item -Path $env:USERPROFILE\.tyflow\skills\* -Destination $env:USERPROFILE\.agents\skills -Recurse -Force
```

macOS:

```bash
mkdir -p ~/.agents/skills
cp -R ~/.tyflow/skills/* ~/.agents/skills/
```

`tyflow-do` 需要作为入口技能单独安装。安装后，日常只需要通过 `Tyflow` 或 `$tyflow-do` 触发工作流。

## 12. 首次使用建议

第一次使用时，不建议直接让 Tyflow 改代码。推荐这样开始：

```text
Tyflow，帮我处理一个新需求。目标项目是 xxx。先不要写代码，先梳理需求、搜索复用组件、生成 SPEC、PLAN 和 TEST_CASES。
```

确认 `PLAN.md` 和 `TEST_CASES.md` 后，再说：

```text
Tyflow，按 PLAN.md 开始开发。
```

开发完成后：

```text
Tyflow，验证一下本次需求。
```

需求结束后：

```text
Tyflow，复盘这次需求，并判断哪些经验可以沉淀到 shared。
```

## 13. 最重要的使用原则

- 不清楚需求时先澄清，不要边写边猜。
- L2/L3 没有计划和测试用例，不要直接开发。
- 字段含义不明确时暂停确认，不要强行映射。
- 不保存敏感接口材料。
- 完成前必须验证。
- 复盘只沉淀已经验证、可复用、无敏感信息的经验。
