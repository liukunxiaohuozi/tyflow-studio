# 请求层与服务层规范

## 文档元信息

- 文档定位：约束接口请求应该如何放置、服务层如何适配协议、页面如何处理请求状态。
- 适用范围：接口联调、页面接入、错误处理、通用请求封装。
- 推荐优先级：涉及数据获取和状态渲染时优先阅读。
- 冲突处理：若目标仓库已有稳定服务层封装，以目标仓库为准。
- 最后更新时间：2026-06-11

## 请求放置规范

- 所有接口请求定义在 `src/services/**`。
- 禁止在页面和通用组件中直接调用 `fetch / axios / request`。
- 接口函数命名必须表达业务语义，避免 `getData1` 这类模糊命名。

## 协议与类型规范

- 请求入参与响应数据必须定义 TypeScript 类型。
- 协议变更时，优先更新类型与服务层，再修改页面调用。
- 服务层负责协议适配，页面层只消费可直接渲染的数据结构。

## 异常处理规范

- 错误必须有统一处理策略，例如消息提示、重试、降级展示。
- 禁止吞错；至少保留日志或可观测信息。

## 页面状态机

推荐页面状态机：

```text
loading -> success
loading -> empty
loading -> error
```

统一判定建议：

- `success`：HTTP 成功且业务状态成功。
- `empty`：业务成功但无数据。
- `error`：业务失败、HTTP 异常、超时或解析异常。

页面展示规范：

- `loading`：展示 `Spin` 或骨架屏。
- `empty`：展示空态组件。
- `error`：展示错误态组件。
- `success`：展示业务内容。

## 服务层与页面层职责

- 服务层返回值必须可被页面稳定判定。
- 页面层至少维护 `loading`、`apiStatus` 和渲染数据。
- `loading` 应在 `finally` 或等价统一收口逻辑中关闭，避免分散遗漏。

## 推荐沉淀

- `normalizeApiResult`：将不同后端协议统一映射为 `success / empty / error`。
- `useRequestState`：统一管理 `loading / data / empty / error / retry`。
- 错误码与错误提示映射：减少页面层重复判断。

## 契约层可定位性规范（数据可追溯、bug 可定位）

> 目标：让任何一个字段问题都有**唯一确定的排查路径**，杜绝"映射散落各处、出 bug 无从下手"。后端越不稳定，越要靠这层把它挡在页面之外。

### 单一映射点 + 单向数据流（铁律）

数据只能单向流动，映射只允许发生在 service 的一个函数里：

```text
后端 response → service 的 mapToXxx（唯一映射点）→ UI 契约 model → 页面消费
```

- **页面与组件中禁止任何字段重命名、兜底、类型转换、枚举翻译**，它们只消费 UI 契约结构。
- 后端原始字段类型（`XxxResp`）**不得流到页面**，只能出现在 service 内部。
- 排查"某字段显示不对"时排查点唯一：该模块 service 的 `mapToXxx`。

### 标准模块骨架（固定结构，可预测定位）

```text
src/pages/<domain>/
  index.tsx        # 页面：只消费 UI 契约，绝不写映射
  service.ts       # 请求 + mapToXxx（唯一映射点）
  types.ts         # 契约：后端响应类型 + UI 契约类型（分开）
  mock.ts          # 按 UI 契约造的 mock，覆盖三态/边界
  INTEGRATION.md   # 字段映射表（人读的索引）
```

每个数据模块结构一致；看到模块就知道数据层在哪、各文件分别负责什么。

### 类型分两层，命名即身份

```ts
/** UI 契约：页面真正消费的结构（稳定，不随后端字段变） */
export interface SavedQueryVO {
  id: string;
  /** 查询名称 · 列表首列 */
  name: string;
  /** 状态 · 控制标签颜色 */
  status: 'enabled' | 'disabled';
}
/** 后端原始响应（易变，仅 service 内部使用，禁止流到页面） */
export interface SavedQueryResp { queryId: string; queryName: string; state: number; }
```

- 后端原始：`XxxResp` / `XxxDTO`；UI 契约：`XxxVO` / `XxxModel`。
- 看类型名即知它在哪一层、是否稳定可信。

### 映射函数命名 + 逐字段注释锚定（双向可追）

```ts
function mapToSavedQuery(raw: SavedQueryResp): SavedQueryVO {
  return {
    id: raw.queryId,                                    // ← INTEGRATION.md #id
    name: raw.queryName,                                // ← #name
    status: raw.state === 1 ? 'enabled' : 'disabled',   // ← #status 枚举 1=启用,0=停用
  };
}
```

- 映射函数固定命名：`mapToXxx` / `normalizeXxx`。
- 每个字段旁标注来源，对应 `INTEGRATION.md` 的条目，正反向都能追。

### INTEGRATION.md 字段映射表（人读总索引）

| UI 字段 | 后端来源 | 含义 | 转换规则 | 证据来源 | 已确认 |
|--------|---------|------|---------|---------|-------|
| id | `queryId` | 主键 | 直取 | 接口文档 | ✅ |
| status | `state` | 启用/停用 | `1→enabled, 0→disabled` | 联调确认 | ✅ |

排查 bug、交接、字段变更时先看这张表。

### 契约即文档

UI 契约类型每个字段写中文注释（含义/单位/枚举/用途）。读契约 = 读这个页面要消费什么数据，无需外问。

### mock 与契约同构

- mock 必须符合同一 UI 契约类型（TS 编译保证），覆盖三态/边界（空、null、超长、特殊字符、分页边界）。
- 带来**二分定位**：切 mock 正常、切真实异常 → 问题在后端或映射；切 mock 就异常 → 问题在前端渲染。

### 漂移检测（后端偷偷改了能立刻定位）

```ts
function mapToSavedQueryList(raw: any): SavedQueryListVO {
  assertShape(raw, ['total', 'list']);   // 关键字段缺失/类型不符 → 在映射层报错并指明缺哪个
  return { total: Number(raw.total ?? 0), list: (raw.list ?? []).map(mapToSavedQuery) };
}
```

关键字段做运行时校验，结构变化在 service 层暴露（带模块名 + 缺失字段），而非页面静默崩。

### 排查速查表

| 现象 | 唯一排查点 |
|------|-----------|
| 某字段显示错 / 空 | service `mapToXxx` 里该字段映射 |
| 请求参数不对 | service 请求封装 |
| 数据对但渲染乱 | 页面组件（确定与数据层无关） |
| 三态不对（空/错/loading） | 页面状态机 |
| 报 shape 校验错 | 后端结构变了，看漂移检测提示的缺失字段 |

### 后端未给定义时：前端自定 UI 契约 + mock 先行

- UI 契约由"页面要展示什么"决定，**不依赖后端**；后端没给文档/mock 也能先立契约。
- 按契约自造 mock 把页面跑通；接口到位后只补 service 映射这一步，页面不返工。
- 联调输入优先级：接口文档（带中文含义）+ 样例　＞　真实响应样例 / 浏览器抓包　＞　无（用自定契约 + mock）。

### 字段变更分级处理（应对后端结构漂移）

后端字段变化时先分类，再决定改动范围：

- **非契约级变更**（改名 / 挪层级 / 换枚举值 / 加包装壳）：**只改 service 的 `mapToXxx` 一处**，页面/组件/契约不动。绝大多数后端漂移属此类。
- **契约级变更**（页面要展示的内容真的增减/改变）：属真需求变更，才动 UI 契约和页面，并回到计划确认。

处理后跑 mapper 单测 + 页面在浏览器验证，并更新 `INTEGRATION.md` 映射表。
