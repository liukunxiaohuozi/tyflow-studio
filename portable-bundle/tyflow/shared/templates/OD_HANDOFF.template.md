# OD Handoff

> P0 极简模板（约 30 行）。完整版见 `OD_HANDOFF.full.template.md`。
> 定稿后 `designStatus: approved`；screens 未齐前保持 `draft`。

## meta

| 字段 | 值 |
|------|-----|
| `handoffId` | `od-<feature>-YYYYMMDD` |
| `odProjectPath` | `C:\...\Open Design\projects\<uuid>` |
| `targetProject` | `PROJECTS.md` 中的项目 id |
| `flowLevel` | `L2` |
| `trustLevel` | `T1` |
| `designStatus` | `draft` / `approved` |
| `handoffVersion` | `1.0.0` |

## scope

- **goal**：（一句话）
- **inScope**：（页面/模块列表）
- **outScope**：（明确不做）

## screens

| odFile | label | route | pagePath | fidelity |
|--------|-------|-------|----------|----------|
| `screens/01-xxx.html` | | | `src/pages/...` | draft |

## acceptance

| id | criterion | odRef | verify |
|----|-----------|-------|--------|
| A1 | | `screens/01-xxx.html#...` | manual |

## tokenMap

| od | target | level |
|----|--------|-------|
| `--accent` | `#1677FF` | must-match |
| `--bg` | `#F0F1F5` | must-match |

## componentMap

| odSelector | odScreen | decision | target |
|------------|----------|----------|--------|
| `.filter-bar` | 01-xxx | reuse | Form + Select |

## interactions

| screen | trigger | behavior | states |
|--------|---------|----------|--------|
| 01-xxx | 改筛选 | 刷新列表 | loading/success/empty/error |

---

Tyflow 启动示例：

```text
$tyflow-do 目标项目 <project-id>
来源 OD_HANDOFF: <odProjectPath>\OD_HANDOFF.md
流程 L2，信任等级 T1，先规划不写码
```
