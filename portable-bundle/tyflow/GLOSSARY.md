# Tyflow 术语速查

两套等级是独立的两个轴，最容易混，先记住这张图：

- **L 轴 = 任务有多复杂**（决定走多重的流程）。
- **T 轴 = AI 有多自主**（决定哪些步骤要人工确认）。

## 流程等级 L（复杂度轴）

| 等级 | 适用 | 流程强度 |
|------|------|---------|
| **L1** | 小 bug、样式、文案、小字段/交互 | 改 + 增量验证 + 轻量复盘 |
| **L2** | 普通页面、新接口接入、常规功能 | 全流程：SPEC→组件搜索→PLAN→TEST_CASES→实现→联调→验证→复盘 |
| **L3** | 公共组件、跨项目复用、高风险逻辑、复杂图表、并行/worktree | L2 + TDD + 代码审查 + 更严验证 |

## 信任等级 T（自主度轴，存储在 `shared/TRUST.md`）

| 等级 | 含义 |
|------|------|
| **T0** | 仅信息，AI 只建议，人工决策 |
| **T1** | AI 给方案，人工确认后执行 |
| **T2** | AI 自主执行，人工事后审核 |
| **T3** | AI 全自主，仅完成前验证人工把关 |

> 例：组件检索默认 T2，公共组件修改默认 T0。当前生效值看 `shared/TRUST.md`。

## 产物文件（每个需求目录 `requirements/<id>/`）

| 文件 | 是什么 |
|------|--------|
| `REQUIREMENT.md` | 需求来源、范围、目标、验收标准、待确认 |
| `SPEC.md` | L2/L3 开发真源；可执行规格（Spec ID / 版本 / 页面结构 / 交互 / 数据 / 状态 / 验收 / Traceability） |
| `COMPONENT_SEARCH.md` | 可复用组件/页面搜索结果与复用决策 |
| `PLAN.md` | 计划 + **理解确认表** + AI 决策追溯 |
| `TEST_CASES.md` | 验收测试用例（开发前生成，前置验收标准） |
| `CONTRACT.md` | 接口契约（请求/响应 TS 类型先行） |
| `INTEGRATION.md` | 联调记录（**必须脱敏**） |
| `VERIFY.md` | 验证结果（含硬检查原始输出 + 增量基线栏） |
| `REVIEW.md` / `REVIEW-FIX.md` | 代码审查与修复（L3 / 涉接口复杂 UI） |
| `RETRO.md` | 复盘 + 效果度量 + 沉淀建议 |
| `OD_SOURCE.md` | 可选：指向 Open Design 项目与 `OD_HANDOFF.md` 路径 |

## Open Design 交接

| 术语 | 含义 |
|------|------|
| **OD / Open Design** | 设计探索环境，产出可交互 HTML 原型 |
| **OD_HANDOFF.md** | 设计→工程交接契约，位于 OD 项目目录内 |
| **odRef** | HANDOFF `acceptance` 中对 OD 原型 DOM 的锚点 |
| **designStatus** | `draft` = 仅讨论；`approved` = 可进 Tyflow 开发（PLAN 确认后写码） |
| **handoffVersion** | HANDOFF 版本号；同需求迭代时递增 |

## 状态与共享文件

| 文件 | 作用 |
|------|------|
| `local/CURRENT.md` | 活跃需求**索引** + 当前默认需求指针 |
| `local/active/<id>.md` | 单个需求的**真实状态**（支持并行） |
| `shared/WORKFLOW.md` | 流程事实来源 |
| `shared/RULES.md` | 硬规则 |
| `shared/DECISIONS.md` | 已确认的长期决策 |
| `shared/TRUST.md` | 信任等级真实存储 |
| `shared/PERFORMANCE.md` | 性能门禁唯一数值源 |
| `shared/VERIFICATION.md` | 验证与提测准入门（唯一尺子） |
| `shared/SECURITY.md` | 脱敏与安全策略 |
| `shared/METRICS.md` | 跨需求效果度量聚合 |
| `shared/PROJECTS.md` | 项目路径与命令 |
| `shared/registry/` | 组件/命令索引 |
| `baseline/` | 工程、设计、组件选型基线 |

## 门禁（开发中就要满足，不是收尾）

| 门禁 | 要点 |
|------|------|
| 需求澄清门禁 | 没理解清楚禁止开发 |
| SDD 规格门禁 | L2/L3 以 SPEC 为真源；Spec ID 必须追溯到实现、用例、证据 |
| 计划审查门禁 | L2/L3 未确认 PLAN + TEST_CASES 禁止改代码 |
| 国际化门禁 | 中文先用 `I18nT(...)`，集中后跑一次 `npm run scan` |
| 类型门禁 | 请求/响应先定义 TS 类型再写业务 |
| 性能门禁 | 按 L 分级，只在生产构建上量化（见 PERFORMANCE.md） |
| 验证门禁 | 走 VERIFICATION.md 提测准入门：硬检查贴原始输出、增量基线判定、失败不准说"完成" |
| 安全门禁 | 沉淀/分享前 AI 自查敏感信息，命中先脱敏 |

## 关键缩写

- **增量基线**：tsc/eslint 只看"本次有没有新增错误"，不要求全量零错误。
- **Spec ID**：`SPEC.md` 中每条可实现/可验证规格的稳定编号，例如 `S-FUNC-001`、`S-DATA-001`。
- **Traceability Matrix**：规格闭环表，追踪 `Spec ID → 实现位置 → 测试用例 → 验证证据 → 状态`，用于判断是否真正按规格实现和验证。
- **理解确认**：PLAN.md 里 AI 把对需求关键概念的理解写出来供你纠偏，防止"理解错了再完整验证也白费"。
- **三态模型**：页面请求统一 `loading → success / empty / error`（见 DECISIONS.md）。
