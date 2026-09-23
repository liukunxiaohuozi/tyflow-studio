# B 端实用型分级门禁

用于听云、观云及其他存量 B 端项目。目标是阻断本次新增的核心风险，同时保留历史债务和尚未成熟的质量指标，不因一次普通开发要求整个旧项目立即达到最终目标。

## 三类门禁和发布建议

- **阻断**：核心功能、业务数据、关键接口参数、权限、写入、竞态、稳定性或发布可用性问题。必测失败时运行结论为 `FAILED`，发布建议为 `NO_GO`。
- **告警**：非核心风险、未新增的历史债务、一般代码质量和已复测的性能候选退化。没有阻断或不完整时运行可为 `VERIFIED`，发布建议为 `GO_WITH_RISK`。
- **观察**：尚未有稳定预算的性能、包体、请求数、内存和兼容趋势。只留证，不自动改变结论。
- 关键依据、环境或必测执行不足时，使用 `INCOMPLETE` 或 `NEEDS_DECISION`，发布建议为 `REVIEW_REQUIRED`。

## 变更风险

| 等级 | 典型变更 | 必测范围 |
|---|---|---|
| R1 | 文案、局部样式、简单展示 | 变更静态检查、目标渲染和必要截图/结构断言 |
| R2 | 列表、筛选、分页、详情、图表、表单、接口映射 | R1 + 逻辑/组件、关键浏览器路径、相关接口、加载/空/错/恢复和竞态 |
| R3 | 权限、租户、写操作、公共组件、宿主/微应用协议、核心计算、大重构 | R2 + UI/API 权限、写入回读、幂等、真实集成、故障注入、生命周期和人工复核 |
| R4 | 发布候选、框架/公共依赖升级、大版本 | 冻结发布矩阵、批准的性能预算、兼容、大数据、长稳和完整 P0/P1 回归 |

根据 confirmed spec、Git/依赖差异和影响图确定等级。权限、租户、写操作、共享包和跨应用协议至少为 R3。无法可靠判断时标记 `NEEDS_DECISION`，继续不依赖该判断的检查。

## change profile 阻断规则

以下规则只约束本次新增或被本次变更触达并恶化的问题。每项必须保留 expected、actual 和 evidenceRefs。

| 规则 | 阻断事实 |
|---|---|
| B-01 | 本次变更导致生产构建失败 |
| B-02 | 本次变更新增 lint、type 或必测测试失败 |
| B-03 | 新功能核心路径无法完成、页面白屏或稳定崩溃 |
| B-04 | 核心业务数据、单位、时间、排序、聚合或映射错误 |
| B-05 | 变更涉及的接口关键入参错误或缺失 |
| B-06 | HTTP 成功但业务失败被当成成功 |
| B-07 | 请求失败被伪装成空数据，或核心失败没有反馈和恢复 |
| B-08 | 权限绕过、跨租户、敏感数据泄漏，或无权限导致核心页面崩溃 |
| B-09 | 写操作重复提交、错误写入、成功未落库或失败仍落库 |
| B-10 | 稳定请求竞态导致旧数据覆盖最新结果 |
| B-11 | 新增未处理 pageerror/unhandledrejection 并影响关键路径 |
| B-12 | 测试修改业务源码、源快照变化、证据缺失或测试数据未清理 |

权限绕过、跨租户、敏感信息泄漏、不可恢复数据破坏、明确错误的核心计算及发布完全不可用不能使用历史基线或自动豁免。

## 存量债务

先在相同工具、配置、依赖和环境中冻结诊断指纹。未新增的 lint/type/test 问题为告警；新增问题阻断；消除问题后下调基线，不能恢复到更高债务。比较规则、文件、标准化消息和代码上下文，不只比较数量或行号。

未经登记、工具版本失配或环境不可比的基线不能证明“无新增”，相关门禁为 `INCOMPLETE`。

## 接口和数据范围

change 只完整检查新增、修改和直接影响的接口：method/path、关键 query/body、必要 header、参数来源、类型、单位、分页、排序、筛选、身份上下文、HTTP/业务状态以及关键响应到 UI 的映射。公共请求层、身份、租户、网关或共享类型变化时扩大影响范围。全接口 schema 漂移和边界生成放入 nightly/release。

HTTP 200 不能独立判定通过。没有权威 schema 时可以验证关键参数和真实映射，同时明确“全字段语义未确认”。列表、统计和详情是否同口径由 confirmed spec 决定。

## 运行档位

- change：影响分析、增量静态检查、轻量代码审查、相关单测、关键页面、关键接口、主要异常和性能观察。10–40 分钟仅为可配置效率目标，不能为缩短时间跳过必测项。
- integration：change + 真实后端、回读、权限或宿主链路。
- nightly：已接入 P0/P1、完整契约、负路径、性能趋势、兼容候选和故障注入。
- release：冻结版本、发布必测、权限/写操作和项目已批准的性能预算。
- periodic：大数据、长稳、依赖升级、主动安全、完整设备矩阵和挑战集。

## 输出

除原有结果外，在适用时生成：

- `b2b-gates.json`：阻断、告警、观察、风险等级和发布建议。
- `code-review.json`：行级审查发现、严重度、证据和人工复核状态。
- `network-summary.json`：关键请求参数、状态、重复/失败和页面映射。
- `performance-observation.json`：样本、基线状态、候选退化和预算结果。
- `debt-baseline.json`：存量诊断指纹、增减和环境身份。

用 `scripts/b2b-gates.mjs <gate-input.json> <run-dir>` 生成确定性分级结果。冻结计划包含 `b2b-gates` 必检时，缺少该文件必须使证据校验失败。

评估器输入使用以下结构；没有采集到的可选分组省略，不能编造通过结果：

```json
{
  "schemaVersion": 1,
  "runId": "20260909-example-change-01",
  "projectId": "explore",
  "profile": "change",
  "riskLevel": "R2",
  "humanReviewRequired": false,
  "humanReview": { "status": "NOT_REQUIRED" },
  "findings": [
    {
      "ruleId": "B-07",
      "status": "FAIL",
      "introduced": true,
      "touchedAndWorsened": false,
      "summary": "请求失败后页面没有反馈和恢复入口",
      "evidenceRefs": ["artifacts/trace.zip", "screenshots/request-error.png"]
    }
  ],
  "codeReview": { "findings": [] },
  "network": { "requests": [] },
  "performance": {
    "independentRuns": 1,
    "totalSamples": 3,
    "coveredPeriods": 1,
    "coveredWorkdays": 1,
    "observations": []
  },
  "debtBaseline": { "environmentComparable": true, "fingerprints": [] }
}
```

`findings[].status` 使用 `PASS`、`FAIL`、`INCOMPLETE` 或 `NEEDS_DECISION`。`introduced: false` 表示已登记且本次未恶化的存量问题；B-03、B-04、B-08、B-09 所代表的严重权限、数据和可用性风险不允许借此降级。R3/R4 或 `humanReviewRequired: true` 时，`humanReview.status` 必须为 `APPROVED`，否则结果为 `INCOMPLETE`。
