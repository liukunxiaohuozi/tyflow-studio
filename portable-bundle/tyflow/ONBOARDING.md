# Tyflow 上手指南（研发 30 分钟入门）

目标：让你第一次用 Tyflow 就能跑通一个需求，而不是先读完十几个文档。

## 1. 一句话理解 Tyflow

Tyflow = 让 AI 按「**先理解 → 先找复用 → 先验证 → 再沉淀**」的固定流程帮你做听云前端需求，而不是张口就写代码。你只需要用一个入口触发它。

## 2. 第一次使用（按顺序做）

1. 确认入口技能 `tyflow-do` 已安装；外部依赖技能 `api-contract-generator`、`api-intelligent-integration` 已从本机技能目录可用。
2. 打开 `shared/PROJECTS.md`，把你要开发的项目路径改成**你本机的实际路径**（尤其 `rum-web` 是占位符）。
3. 发起第一个需求（**必须先规划、不许直接写码**——这是强制门禁）：

```text
Tyflow，帮我做一个需求，目标项目是 explore。先不要写代码，先梳理需求、找复用组件、生成 SPEC、PLAN 和 TEST_CASES。
```

4. 审查它产出的 `PLAN.md` 和 `TEST_CASES.md`，确认无误后再说：

```text
Tyflow，按 PLAN.md 开始开发。
```

5. 开发完说 `Tyflow，验证一下本次需求。`，结束后说 `Tyflow，复盘。`

> 提示：Tyflow 全程是"你说话、AI 干活"，**不需要你运行任何命令或脚本**。所有检查（自洽性、脱敏、验证）都是 AI 在流程里替你做。

## 3. 必读 / 选读

**第一天必读（约 15 分钟）：**

- 本文件
- `GLOSSARY.md`（术语：L1–L3、T0–T3、各产物文件）
- `requirements/_example-l2-demo/`（一个走完整流程的样例，照着抄最快）

**用到再读：**

- `shared/WORKFLOW.md`：流程全貌（最权威，但第一天不必通读）
- `shared/RULES.md`：硬规则清单
- `shared/PERFORMANCE.md`：性能门禁怎么算
- `shared/VERIFICATION.md`：验证与提测准入门（什么算"可以提测"）
- `shared/SECURITY.md`：联调脱敏怎么做
- `shared/registry/ty-sdk-components.md`：`@ty-sdk/components` 组件怎么用
- `baseline/component-selection.md`：组件选型决策表

## 4. 最容易踩的 5 个点

1. **L2/L3 必须先有经确认的 PLAN（含逐模块"复用还是新封装"决策）才能开发**——这是强制门禁、Tyflow 价值核心，跳过等于退回"AI 乱写"。
2. **联调时别把原始 cURL/token 留在文件里**——只留脱敏映射；AI 会在写入前自查敏感信息，你也留个心眼。
3. **tsc 报既有错误别慌**——门禁看的是"本次有没有新增错误"（增量基线），不是全量零错误。
4. **性能门禁分级**——L1 不用跑 Lighthouse；只有动了首屏/重依赖才量化，且只在生产构建上测。
5. **多个需求并行时先说清楚是哪一个**——状态在 `local/active/<需求ID>.md`，`CURRENT.md` 只是索引。

## 5. 日常触发语速查

| 你想做的事 | 对 Tyflow 说 |
|-----------|-------------|
| 起新需求（先规划） | `Tyflow，新需求，目标项目 xxx，先规划不写码` |
| 开始开发 | `Tyflow，按 PLAN.md 开始开发` |
| 继续上次的活 | `Tyflow，继续`（多需求时指明 ID） |
| 联调 | `Tyflow，继续联调，接口信息：…` |
| 验证 | `Tyflow，验证一下本次改动` |
| 复盘 | `Tyflow，复盘，并判断能否沉淀规则` |
| 小修小补 | `Tyflow，这个按 L1 修一下：…` |
| 设计已在 OD 定稿 | `Tyflow，目标项目 xxx，来源 OD_HANDOFF: <路径>，先规划不写码` |
| 只有 PRD 没有 OD | `Tyflow，新需求…`（或建议先去 Open Design 出原型） |
