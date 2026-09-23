# 观云 React 组件库索引与能力摘录

## 文档元信息

- 文档定位：记录组件库导出能力、组件分组和已确认的接入信息，作为详细索引使用。
- 适用范围：已经确定要复用组件后，进一步查组件能力和导出项。
- 推荐优先级：在 `component-reuse-overview.md` 或 `component-selection-flow.md` 之后按需读取。
- 冲突处理：若与目标仓库已有组件封装或真实页面用法冲突，以目标仓库为准。
- 最后更新时间：2026-05-25

## 文档定位

- 本文档是听云组件库与项目复用经验的工作摘录。
- 作用是帮助前端在“项目已有实现 / 项目封装 / 组件库原始组件 / 新写局部组件”之间做选择。
- 本文档是复用参考，不替代目标仓库里的真实组件封装、类型定义和已有页面用法。

## 基本原则

- 新页面开发前先查目标项目里有没有真实使用或二次封装，再查组件库文档决定是否引入组件库原始组件。
- 组件库文档只记录源码、类型、Dumi 示例中能确认的信息；没有确认到的用法不写成结论。
- 表格、筛选、时间、页面容器、抽屉、空状态、提示、拓扑类能力优先复用组件库。
- 图表优先使用组件库图表或项目现有 ECharts 封装，不把 Figma 图表画成静态 SVG。
- 编写新 UI 前，先搜索项目已有组件和模式。
- 跨项目组件默认只是参考资产，只有完成风险评估后才复制。

## 接入顺序

1. 先在目标项目中查有没有同类页面、同类组件、同名组件引入、局部二次封装或业务封装。
2. 如果目标项目已经使用过组件库组件，优先仿照项目里的真实用法，包括 import 路径、外层容器、样式类、字段转换、ref 使用、缓存命名、空态/加载态处理。
3. 如果目标项目有二次封装，优先使用二次封装；不要绕过封装直接引入组件库原始组件，除非能说明封装不适用。
4. 如果目标项目没有用过，再查组件库文档和组件库源码，按组件库原始方式接入。
5. 只有组件不适用、二次封装不适用，或复用成本明显高于收益时，才新增页面局部组件。

落地要求：

- 引入组件前写清楚“为什么用这个组件”。
- 复用判断必须记录：项目内是否已有用法、是否存在二次封装、最终采用“仿照项目用法 / 使用项目封装 / 使用组件库原始方式 / 新写局部组件”中的哪一种。
- 如果不用组件库中明显相关的组件，需要记录原因。
- 接口字段映射不明确时，不允许为了套组件猜字段。
- 图表和拓扑必须先确认数据结构是否能适配已有组件。

## 导出组件总览

从 `@ty-sdk/components` 记录到的导出包括：

```ts
import {
  BarChart,
  PieChart,
  TyConfigProvider,
  TimeRangePicker,
  TyCustomTableHeader,
  TyDrawer,
  TyEmpty,
  TyEntityInfo,
  TyExportData,
  TyFilterSelect,
  TyMetricChartList,
  TyPageContainer,
  TySearch,
  TyTable,
  TyTooltip,
  TyTopInfo,
  TyTopSubmenu,
  TimeSeriesChart,
  HeatmapChart,
  TyDrawerUltra,
  TyIcon,
  TyFlow,
} from '@ty-sdk/components';
```

额外记录到的能力：

- `filterMetricTreeByCatIds`、`filterMetricTreeByEntityCode` from `TyMetricChartList`
- `TimeHistoryProvider`、`useTimeHistory` from `HeatmapChart`
- `TyDrawerUltra` 相关 context/util
- `TyFlow` 相关类型和工具
- `generateConfigProviderCfg` from `TyConfigProvider`
- `TyEntityInfoCard` from `TyEntityInfo`
- `services` — API 服务层（entity、metric、explore）
- `utils` — 工具函数（jump、I18nT、theme、metadata 等）

## 基础组件

### TyConfigProvider

- 页面示例中常作为外层包裹，如 `TyTable` 示例使用 `TyConfigProvider isMain={true}`。
- 继承 antd `ConfigProviderProps`。
- `isMain` 表示是否主应用场景。
- `generateConfigProviderCfg(props)` 工具函数，生成带听云默认主题 token 的 `ConfigProviderProps` 配置对象。

```tsx
import { TyConfigProvider } from '@ty-sdk/components';

<TyConfigProvider isMain>
  <TyTable columns={columns} dataSource={data} />
</TyConfigProvider>
```

## 页面与查询组件

### TyPageContainer

- 文档说明“目前运维管理平台深度使用”。
- `topHeaderRender` 吸顶区，可以传 ReactNode，也可以传 `TyTopSubmenuProps`。
- `leftSideRender` 左侧区域。
- `searchFields` 配置搜索项。
- `tableProps` 直接渲染 `TyTable`，优先级高于 `children`。
- `searchValues` 支持搜索值受控。
- 新增业务列表页优先考虑 `TyPageContainer + TyTable`。
- 如果页面已有复杂局部布局，可以只复用 `TyTable`、`TySearch`、`TyFilterSelect`，不用强行套容器。
- `topHeaderRender` 已经支持 `TyTopSubmenu`，轻应用顶部导航不要重复手写。

```tsx
import { TyPageContainer } from '@ty-sdk/components';
```

### TySearch

- 基于 antd `InputProps`，额外提供 `onSearch`。
- 默认 `placeholder` 为 `I18nT('请输入')`。
- 简单关键词搜索优先用 `TySearch`。
- 多条件结构化筛选优先用 `TyFilterSelect`。
- 配置型页面搜索优先用 `TyPageContainer.searchFields`。

```tsx
import { TySearch } from '@ty-sdk/components';
```

### TyFilterSelect

- 用于多维筛选/字段值筛选。
- 支持 `bindKey`、`bindLabel`、`formatQueryString`、`onChange`、`getOptions` 等配置。
- 不建议为简单输入框上 `TyFilterSelect`。

```tsx
import { TyFilterSelect } from '@ty-sdk/components';
```

## 表格组件

### TyTable

- 基于 antd `Table` 二次封装。
- 支持列拖拽。
- 支持列配置缓存记忆。
- `storageName` 会把列宽、列配置存入 localStorage。命名建议：`微应用名-表格名`，例如 `explore-query-result`。
- `placeholder` 是拖拽模式内部占位列，业务代码一般不要主动使用。
- `emptyCfg` 传给 `TyEmpty`，用于统一空态。
- 新业务表格优先用 `TyTable`，不要直接用 antd `Table`，除非当前页面已经明确使用 antd 原生表格且不需要列宽记忆。
- 需要自定义列显示时，配合 `TyCustomTableHeader`。

```tsx
import { TyTable } from '@ty-sdk/components';

<TyTable
  rowKey="id"
  columns={columns}
  dataSource={data}
/>
```

### TyCustomTableHeader

- 与 `TyTable` 的列配置、storage 结构配套。
- 支持缓存和手动更新列配置。
- 如果使用缓存，`storageName` 要和表格侧命名保持一致。
- 适合“用户可配置显示列”的业务表格。

```tsx
import { TyCustomTableHeader } from '@ty-sdk/components';
```

## 图表组件

### BarChart

- 基于 ECharts。
- 分类柱状图优先用 `BarChart`，不建议直接手写基础 ECharts option。
- 可传 `onEvents`，继承 `echarts-for-react` 能力。

```tsx
import { BarChart } from '@ty-sdk/components';
```

### PieChart

- 占比图优先用 `PieChart`，不建议直接手写基础 ECharts option。

```tsx
import { PieChart } from '@ty-sdk/components';
```

### TimeSeriesChart

- 指标趋势、请求量、错误率等时间序列优先用它。
- 需要 BubbleUp/刷选/放大时间时，不要自己封装 ECharts。
- `config.select` 是必须项，接入前要确认 API 查询参数结构。

```tsx
import { TimeSeriesChart } from '@ty-sdk/components';
```

### HeatmapChart

- 分布热力、延迟分布、状态码分布这类二维时间分布图优先用。
- 记录到 `TimeHistoryProvider`、`useTimeHistory` 能力。

```tsx
import { HeatmapChart, TimeHistoryProvider, useTimeHistory } from '@ty-sdk/components';
```

## 拓扑与图形组件

### TyFlow

- 树状依赖、调用链路、左右拓扑类页面优先评估 `TyFlow`。

```tsx
import { TyFlow } from '@ty-sdk/components';
```

### TyApmTopo

- APM 服务拓扑优先用它。
- 如果接口不是组件期望结构，先确认是否能使用 `transformApmTopoData`，不要在页面里重新画拓扑。

```tsx
import { TyApmTopo } from '@ty-sdk/components';
```

### TyAlarmTopo

- 告警相关横向拓扑优先用它。
- 只有节点点击，没有边点击和画布点击 props；需要这些能力时先看源码是否应扩展组件，而不是页面绕开。

```tsx
import { TyAlarmTopo } from '@ty-sdk/components';
```

## 图标

### TyIcon

- 听云业务图标优先查 `@ty-sdk/icons`，不要临时复制 SVG。
- 对具体图标名不确定时，先在组件库或图标包里搜索。

```tsx
import { TyIcon } from '@ty-sdk/components';
```

## 时间选择组件

### TimeRangePicker

- 带左右导航手柄、时间范围下拉、自动刷新定时器、时间粒度、"上一周期"对比的时间范围选择器。
- 支持 localStorage 缓存，支持受控和非受控两种模式。
- `timeRef` 暴露 `refresh()`、`refreshCache()`、`setValue()`、`resetTimeInfo()` 方法。
- `onChange` 回调返回 `TimeRangePickerChange`，包含 `startTime`、`endTime`、`timePeriod`、`granularity`、`raw`、`rawTime`、`previous` 等字段以及 `isFirst`、`isRelative`、`isInterval`、`isControl` 标志位。
- 主要 props：`defaultValue`、`value`、`disabled`、`showTimeSpan`、`showTimeInterval`、`showTimeGranularity`、`showTimePrevious`、`showHandShank`、`showRefresh`、`isReadCache`、`isWriteCache`、`isRawValue`。

```tsx
import { TimeRangePicker } from '@ty-sdk/components';

<TimeRangePicker
  ref={timeRef}
  onChange={({ startTime, endTime, granularity }) => {
    // 处理时间变化
  }}
/>
```

## 抽屉组件

### TyDrawer

- 基于 antd `Drawer` 二次封装，支持拖拽调整宽度。
- `storageKey` 可将宽度持久化到 localStorage。
- 主要 props：继承 antd `DrawerProps`，额外支持 `onWidthChange`、`storageKey`、`minWidth`、`dragContainerHandle`。

```tsx
import { TyDrawer } from '@ty-sdk/components';

<TyDrawer
  storageKey="my-drawer-width"
  minWidth={400}
  visible={visible}
  onClose={onClose}
>
  {children}
</TyDrawer>
```

### TyDrawerUltra

- 高级多 tab 抽屉，支持路由内容、组件内容、Wujie 微前端、元素缓存渲染。
- 使用 `react-activation` KeepAlive、事件发射器、拖拽容器。
- 支持 Wujie URL 同步（`wujieUrlSync`）。
- `NestedDrawerUltraContext` 用于嵌套场景。
- 主要 props：`defaultTabItems`、`drawerUltraRef`、`outletContext`、`wujieUrlSync`、`dependentAppName`、`elCacheDs`、`onChangeTab`、`getContainer`。

```tsx
import { TyDrawerUltra } from '@ty-sdk/components';

<TyDrawerUltra
  defaultTabItems={[...]}
  drawerUltraRef={drawerRef}
  visible={visible}
  onClose={onClose}
/>
```

## 展示组件

### TyEmpty

- 基于 antd `Empty` 的增强空状态组件。
- 预置三种空态类型：`emptyError`（错误）、`emptyFieldData`（无字段数据）、`emptyNotOpend`（未开通），通过 `type` 字段选择。
- 支持自定义 `image`，无 type/image 时回退到 antd 简洁展示。
- `TyTable` 的 `emptyCfg` 直接传给 `TyEmpty`。

```tsx
import { TyEmpty } from '@ty-sdk/components';

<TyEmpty type="emptyError" />
<TyEmpty type="emptyFieldData" />
<TyEmpty type="emptyNotOpend" />
```

### TyTooltip

- 基于 antd `Tooltip` 的增强提示组件。
- `hintText` 支持字符串或 ReactNode，显示帮助文本。
- `docPath` 支持文档链接（通过 Wujie 微前端集成）。
- 无 children 时默认渲染 hint 图标。

```tsx
import { TyTooltip } from '@ty-sdk/components';

<TyTooltip hintText="这是帮助文本" docPath="/docs/guide" />
<TyTooltip hintText="自定义内容"><span>hover me</span></TyTooltip>
```

## 导航组件

### TyTopInfo

- 顶部信息栏组件，显示当前应用图标、名称、角标（BETA/NEW）。
- 支持 Wujie 微前端上下文或独立模式。
- 主要 props：`appInfo`、`onTitleClick`、`rightContent`、`leftContent`。

```tsx
import { TyTopInfo } from '@ty-sdk/components';

<TyTopInfo appInfo={appInfo} />
```

### TyTopSubmenu

- 顶部子菜单/导航栏组件，包含应用图标名称、一级/二级菜单、面包屑导航、AI 入口。
- 支持 Wujie 微前端上下文的跨应用导航。
- 可配置文档入口（`showDoc`/`docPath`）、AI 会话（`showAiChat`）、设置按钮（`showConfig`）。
- `TyPageContainer` 的 `topHeaderRender` 已支持 `TyTopSubmenu`，轻应用顶部导航不要重复手写。
- 主要 props：`appInfo`、`menus`、`tooltipProps`、`leftContent`、`rightContent`、`showConfig`、`showDoc`、`docPath`、`showAiChat`、`activeMenu`、`onTitleClick`、`onMenuSelect`、`onConfigClick`、`onOpenDoc`、`onOpenChat`。
- 子组件：`AiIcon`。

```tsx
import { TyTopSubmenu } from '@ty-sdk/components';

<TyTopSubmenu
  appInfo={appInfo}
  menus={menus}
  showDoc
  docPath="/docs/guide"
  onMenuSelect={(menu) => { /* 菜单切换 */ }}
/>
```

## 实体组件

### TyEntityInfo / TyEntityInfoCard

- 实体详情卡组件，展示实体信息、属性、标签。
- 支持搜索、编辑标签（增删），导航到关联实体。
- 通过 services 层获取实体信息。
- `TyEntityInfo`：主组件，接收 `entityCode`、`entityId` 查询实体详情。
- `TyEntityInfoCard`：卡片布局子组件，用于在卡片中渲染实体信息。
- 主要 props：`entityCode`、`entityId`、`showLink`、`readonly`、`className`、`style`、`onSaveEntityTag`。

```tsx
import { TyEntityInfo, TyEntityInfoCard } from '@ty-sdk/components';

<TyEntityInfo entityCode="Application" entityId="app_123" />
<TyEntityInfoCard entityCode="Application" entityId="app_123" />
```

## 指标组件

### TyMetricChartList

- 指标图表列表组件，按分类树组织展示指标，用户选择指标后生成图表卡。
- 集成听云元数据 API 获取指标数据。
- 额外导出 `filterMetricTreeByCatIds(metricTree, metricCatIds)` 按分类 ID 过滤指标树。
- 额外导出 `filterMetricTreeByEntityCode(metricTree, entityCode)` 按实体类型过滤指标树。

```tsx
import { TyMetricChartList, filterMetricTreeByCatIds, filterMetricTreeByEntityCode } from '@ty-sdk/components';

<TyMetricChartList {...props} />
```

## 操作组件

### TyExportData

- 导出按钮组件，支持导出 Excel（xlsx）或 CSV 格式，内部使用 `xlsx` 库。
- 自带节流（1 秒）防止双击重复导出。
- 外层包裹 `TyTooltip` 显示帮助文本。
- 主要 props：`name`（文件名）、`type`（`'xlsx' | 'csv'`）、`getData`（异步函数，返回 `any[][]` 二维数组）。

```tsx
import { TyExportData } from '@ty-sdk/components';

<TyExportData
  name="导出数据"
  type="xlsx"
  getData={async () => {
    const rows = await fetchExportData();
    return [['列1', '列2'], ...rows];
  }}
/>
```

## 工具函数

### services — API 服务层

从 `@ty-sdk/components` 导出，包含以下模块：

- `entity` — 实体相关 API（`getEntityInfo`、`saveEntity`、`saveEntityTag`、`deleteEntityTag` 等）
- `metric` — 指标相关 API
- `explore` — 探索相关 API
- `core` — 基础请求工具

```ts
import { getEntityInfo, saveEntityTag } from '@ty-sdk/components';
```

### utils — 工具函数

从 `@ty-sdk/components` 导出，包含以下模块：

- `jump` — 路由跳转：`jump(appName, query?, newWindow?, hiddenMenu?, notEncoded?)`、`wujieJump()`、`jumpTraceDetail(traceId, timestamp)`、`jumpEntityDetail(entityCode, entityId, ...)`、`getEntityUrlInfo(entityCode, entityId, ...)`、`openDoc(url)`、`getDocCtx()`、`browserUrlParse()`
- `i18n` / `intl` — 国际化：`I18nT(key)` 翻译函数、`getI18nValue()` 获取国际化值
- `theme` — 主题管理：CSS 变量、字号、颜色 token
- `metadata` — 元数据 hooks：`useMetadata()`
- `metric` — 指标工具函数
- `micro` — 微前端工具：`microProps` 获取 Wujie 上下文属性
- `config` — 配置工具
- `core` — ECharts 数据转换工具
- `data-process` — 数据处理
- `is` — 类型判断
- `menu` — 菜单工具
- `entity-model` — 实体模型定义
- `topo-icons` — 拓扑图标注册
- `useRefState` — React Hook，维护 ref 与 state 同步

```ts
import { jump, I18nT, useMetadata, useRefState } from '@ty-sdk/components';

// 跳转到 APM 追踪详情
jump('apmTrace', `/apm/distributedTracking/detail?traceId=${id}`, true);

// 国际化
const text = I18nT('请输入');

// 元数据 hook
const { metadata } = useMetadata();
```

## 开发决策表

| 需求场景           | 优先组件                                | 不建议                      |
| -------------- | ----------------------------------- | ------------------------ |
| 普通业务列表页        | `TyPageContainer` + `TyTable`       | 直接从零搭布局和表格               |
| 表格列宽拖拽/记忆      | `TyTable`                           | 原生 antd Table 手写拖拽       |
| 用户配置显示列        | `TyCustomTableHeader` + `TyTable`   | 页面内自己维护 localStorage     |
| 简单关键词搜索        | `TySearch`                          | 为一个输入框上 `TyFilterSelect` |
| 多维筛选/字段值筛选     | `TyFilterSelect`                    | 手写复杂 tag 输入框             |
| 查询时间范围         | `TimeRangePicker`                   | 自己拼 DatePicker + 粒度 + 缓存 |
| 简单详情抽屉         | `TyDrawer`                          | 直接 antd Drawer 且重复写宽度拖拽  |
| 多 tab/跨应用/缓存抽屉 | `TyDrawerUltra`                    | 页面内手写复杂 tab 抽屉           |
| 空态/错误态/未开通     | `TyEmpty`                           | 每个页面单独画空态                |
| 标题说明/文档入口      | `TyTooltip`                         | 手写 Tooltip + 文档跳转        |
| 实体标签/属性        | `TyEntityInfo` / `TyEntityInfoCard` | 页面内重新拼实体属性卡              |
| 实体指标图表列表       | `TyMetricChartList`                 | 重新写指标树和图表列表              |
| 分类柱状图          | `BarChart`                          | 直接手写基础 ECharts option    |
| 占比图            | `PieChart`                          | 直接手写基础 ECharts option    |
| 时序指标图          | `TimeSeriesChart`                   | 手写带 BubbleUp/刷选的时序图      |
| 热力图            | `HeatmapChart`                      | 手写二维热力和刷选逻辑              |
| D3 树状拓扑        | `TyFlow`                            | 从零写 D3 树                 |
| APM G6 拓扑      | `TyApmTopo`                         | 从零写 G6 服务拓扑              |
| 数据导出 Excel/CSV | `TyExportData`                      | 手写 xlsx 导出逻辑和防抖          |
| 顶部子菜单导航        | `TyTopSubmenu`                      | 页面内重复写应用图标+菜单+文档入口       |
| 实体详情/属性/标签     | `TyEntityInfo`                      | 页面内重新拼实体属性卡              |
| 指标图表列表         | `TyMetricChartList`                 | 重新写指标树和图表列表              |

# 
