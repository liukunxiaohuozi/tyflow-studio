# Tyflow 决策记录

## 2026-04-28 - 工作流形态

- 背景：该工作流需要支持跨项目的听云前端开发。
- 决策：使用与模型无关的 `.tyflow` 数据层，加上 Codex 的 `tyflow-do` 入口技能。保持 `shared` 可复用，`local` 私有。
- 适用范围：所有 Tyflow 使用场景。

## 2026-04-28 - 自然语言别名

- 背景：`$tyflow-do` 很明确，但日常使用比较繁琐。
- 决策：将 `Tyflow` 和 `听云前端工作流` 作为 `tyflow-do` 工作流的自然语言别名。
- 适用范围：Codex 对话和未来 AI 入口适配器。

## 2026-04-28 - 图表实现

- 背景：Figma 可能把图表表现为静态图形，但生产页面需要绑定后端数据。
- 决策：标准图表必须使用 ECharts 或项目已有 ECharts 封装。不要把 Figma 图表视觉效果复制成静态 SVG。
- 适用范围：仪表盘、趋势图、分布图、排行图和对比图。

## 2026-04-28 - cURL 处理

- 背景：cURL 对真实联调有用，但经常包含凭证。
- 决策：cURL 只用于当前联调。不要保存原始 cURL。只持久化脱敏后的接口用途、参数、响应结构、字段映射和验证结果。
- 适用范围：API 联调和 `INTEGRATION.md`。

## 2026-05-08 - 可点击文本颜色

- 背景：听云前端页面需要对可点击文本、链接和 tabs 保持一致的视觉处理。
- 决策：所有可点击超链接、`a` 标签和 tab 标签都使用 `#1677ff`，除非已有组件 token 已经解析为同一个听云蓝。
- 适用范围：跨项目的听云前端 UI 开发。

## 2026-05-08 - 列表组件选择

- 背景：听云前端项目可能已有自己的列表/表格组件，但有些项目只暴露底层 TableApi 用法。
- 决策：对列表/表格 UI，先搜索并复用目标项目已有的列表/表格组件。如果不存在可复用列表组件，则在项目 `components` 目录中使用既有 TableApi 包装模式创建 `CustomApiTable`，再用于后端驱动列表。
- 适用范围：跨项目的听云前端列表、追踪列表、日志列表和表格类数据视图。

## 2026-05-25 - 页面状态机

- 背景：前端页面在接数据和渲染时需要统一的状态处理模式，避免不同页面状态判定标准不一致。
- 决策：页面请求状态统一为 `loading` → `success` / `empty` / `error` 三态模型。`success` 为 HTTP 成功且业务成功；`empty` 为业务成功但无数据；`error` 为业务失败、HTTP 异常、超时或解析异常。`loading` 统一在 `finally` 收口。
- 适用范围：所有需要接口请求的页面和组件。

## 2026-05-25 - 设计 Token 体系

- 背景：前端样式需要统一的变量体系，避免硬编码色值和间距值散落在各项目中。
- 决策：使用 `--ty-*` 作为业务与主题语义变量，`--ty-ant-*` 作为组件库对 antd 的兼容映射变量。优先使用语义变量，现有变量能表达就不造新变量。主题变量真源为 `theme.ts` 和 `css-var.css`。
- 适用范围：所有观云前端项目的样式实现。

## 2026-05-25 - 组件库确认

- 背景：观云前端项目使用统一的组件库。
- 决策：使用 `@ty-sdk/components` 作为统一组件库。已确认的导出包括 TyTable、TyPageContainer、TyDrawer、TyDrawerPro、TyDrawerUltra、TySearch、TyFilterSelect、TimeRangePicker、TyEmpty、TyExportData、TyTooltip、TyTopInfo、TyTopSubmenu、TyCustomTableHeader、TyMetricChartList、TyEntityInfo、TyEntityInfoCard、TyConfigProvider、TyIcon、TyFlow、TyApmTopo、TyAlarmTopo、BarChart、PieChart、TimeSeriesChart、HeatmapChart 等。
- 详细真源：组件清单、Props、用法以 `shared/registry/ty-sdk-components.md`（按扫描日期更新）为准；本条只记录"统一用 `@ty-sdk/components`"这一决策，组件增减不必每次改本文件。
- 适用范围：所有观云前端项目的组件接入。

## 2026-05-25 - 样式 Token 真源

- 背景：前端样式变量需要明确的真源，避免知识库与代码脱节。
- 决策：主题变量真源为 `theme.ts` 和 `css-var.css`（或目标仓库中等价的主题文件）。知识库和规则中的 token 基线以真源为准。主题改动流程：先改真源，再同步知识库和规则。
- 适用范围：所有观云前端项目的主题变量维护。

## 2026-06-11 - 跨浏览器兼容

- 背景：出现过「Chrome 正常、切到 Firefox 样式错乱」的问题，只在单一浏览器验证会漏掉布局/样式差异。
- 决策：后续所有开发的页面、样式、交互必须在 **Chrome 和 Firefox 最新稳定版**都正常；提测前关键页面/交互在两个浏览器各实测一遍并附证据，作为提测准入门的一项。规避高发差异（`-webkit-` 私有前缀补标准属性、滚动条用 `scrollbar-width/color`、原生表单控件、flex/grid 细节、`backdrop-filter` 等）。命中差异写入项目 `LESSONS.md`。
- 适用范围：所有听云/观云前端 UI 开发。

## 2026-06-12 - 测试报告留档方式

- 背景：结构化测试报告原本只留在个人 `.tyflow/requirements/<需求>/VERIFY.md`，团队和评审看不到，项目维度不可追溯。
- 决策：全量报告仍留 `VERIFY.md`（含原始证据）；**经 PR 提交时把报告摘要写进 PR 描述**（用例场景计数、覆盖标准声明、跳过项、关键证据可复现命令、难自证项确认状态），写入前脱敏。**业务仓库不另存过程文档**，避免污染仓库、降低维护成本。
- 适用范围：所有走 PR 提交的听云/观云前端需求。
