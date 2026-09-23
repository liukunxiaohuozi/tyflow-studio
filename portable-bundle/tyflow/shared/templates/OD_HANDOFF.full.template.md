# OD Handoff — 完整模板（P0 + P1）

> 复制本结构到 Open Design 项目根目录，命名为 `OD_HANDOFF.md`。
> P0 七块为开工下限；P1 六块专治「规范给了但实现跑偏」。
> 极简版见同目录 `OD_HANDOFF.template.md`。
>
> **参考实例**（AI 可观测 6 屏）：  
> `C:\Users\tingyun\AppData\Roaming\Open Design\namespaces\release-stable-win\data\projects\3ff8ef5f-ebe9-4d73-a2b7-3e4205925344\OD_HANDOFF.md`

---

## 必含区块（P0）

1. **meta** — handoffId, odProjectPath, targetProject, flowLevel, trustLevel, designStatus, handoffVersion
2. **scope** — goal, inScope, outOfScope
3. **screens** — odFile, label, route, pagePath, fidelity
4. **acceptance** — id, criterion, odRef, verify（每条必须 odRef）
5. **tokenMap** — od token → 观云/Ant Design，对齐等级三档
6. **componentMap** — odSelector, decision, target
7. **interactions** — trigger, behavior, states（含 loading/empty/error）

## 强烈建议（P1）

8. **userFlows** — 主路径步骤
9. **dataContracts** — mockShape, apiPlaceholder, contractStatus
10. **chartPolicy** — ECharts vs IndicatorModel 等硬规则
11. **layoutRules** — 间距、圆角、分栏、断点
12. **referencePages** — 项目内参照文件
13. **openQuestions** — 待确认 + 默认值

## 可选（P2）

- odVersion / screenshots / critiqueScore / i18nKeys / sensitive

## designStatus 规则

| 状态 | 含义 |
|------|------|
| `draft` | 探索中；Tyflow 可规划，不可写业务代码 |
| `approved` | screens 与 acceptance odRef 已对齐；可 PLAN 确认后开发 |

## Tyflow 产物映射

```text
meta + scope        → REQUIREMENT.md
screens + flows     → SPEC.md
componentMap        → COMPONENT_SEARCH.md（预填）
acceptance          → TEST_CASES.md + VERIFY.md
dataContracts       → CONTRACT / mock / api-contract 三件套
```
