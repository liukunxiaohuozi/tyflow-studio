# OD 设计来源

> 放在 `.tyflow/requirements/<requirement-id>/OD_SOURCE.md`
> 只存路径索引，不复制 OD 项目中的 HTML。

| 字段 | 值 |
|------|-----|
| `handoffPath` | `C:\...\Open Design\projects\<uuid>\OD_HANDOFF.md` |
| `odProjectPath` | `C:\...\Open Design\projects\<uuid>` |
| `handoffVersion` | `1.0.0` |
| `tyflowRequirementId` | `<requirement-id>` |
| `designStatus` | `draft` / `approved` |
| `linkedAt` | `YYYY-MM-DD` |

## 说明

- 主输入：`OD_HANDOFF.md`（approved 后作为设计验收基准）
- 辅助：PRD / Figma / PNG（只读；有 HANDOFF 时验收不以 PNG 为准）
- HTML 原型路径：`{odProjectPath}/screens/*.html`
