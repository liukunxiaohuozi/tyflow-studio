# 观云 React 设计规范 Figma 摘录（来源文档）

## 文档元信息

- 文档定位：Figma 设计规范的来源摘录与追溯材料。
- 适用范围：需要核对设计来源、确认原始规则、补充落地规范未覆盖细节时。
- 推荐优先级：默认后读；只有在需要交叉确认或追溯时再读。
- 冲突处理：若与落地规范或主题源冲突，优先回到主题源与目标仓库真实实现确认。
- 最后更新时间：2026-05-25

来源：Figma 文件 `规范演示文档`，文件 key `HPUgNY9bFEAr5jL9K85kwg`，最后修改时间 `2025-12-15 02:36:20 UTC`。

## 0. 文档定位

- 本文档是 Figma 设计规范的摘录与归档，用于追溯设计来源。
- 本文档偏“来源材料”，不直接替代前端落地规范。
- 页面实现与样式决策优先参考 `design-overview.md` 或 `design-full-reference.md`；当两者不一致时，优先回到主题源和目标项目真实实现确认。
- 建议只按需查阅具体章节，不建议把整份文档一次性读入上下文。

## 1. 规范覆盖范围

本文件包含以下规范模块：

- 基础样式：颜色、字体、圆角、阴影、页面底色。
- 基础组件：按钮、输入框、选择器、单选框、多选框、开关、时间/日期控件。
- 业务组件：面包屑、数据卡片、表格、表头设置、批量操作、筛选区。
- 页面布局：落地页布局、应用布局、快捷筛选展开/收起、顶部吸顶。
- 图标体系：应用图标、系统图标、数据接入图标、按钮图标、标签图标、状态图标。

## 2. 色彩规范

### 2.1 品牌色与交互色

- 主色 / 听云蓝：`#1677FF`
- 主按钮 Hover：`#4096FF`
- 主按钮 Active：`#0958D9`
- 链接文字：默认 `#1677FF`，Hover `#4096FF`，Active `#0958D9`
- 禁用文字：`#C8C9CC`
- 禁用背景：`#EAEAEA`
- 禁用边框：`#DCDEE0`

### 2.2 语义色

- 成功 / 语义绿：`#00B578`
- 警告 / 语义黄：`#FF9000`
- 错误 / 语义红：`#FF3F25`
- 状态码规则：
  - 绿色：`200 <= 状态码 < 300`
  - 灰色：`状态码 < 200` 或 `300 <= 状态码 < 400`
  - 红色：`状态码 >= 400`

### 2.3 页面与中性色

- 页面通用底色：`#F0F1F5`
- 区域/卡片底色：`#FFFFFF`
- 浅背景：`#FAFAFA`、`#F9FAFB`、`#F7F8FA`
- 主要文字：接近 `#000000` / `rgba(0,0,0,0.85)`
- 次级文字：`rgba(0,0,0,0.65)`
- 辅助文字：`rgba(0,0,0,0.45)`
- 分割/描边：`#C8C9CC`、`#D9D9D9`、`#EBEDF0`

### 2.4 图表分类色板

图表分类色只用于图表分类取色，不建议用于普通状态按钮。

基础 10 色：

- Geek Blue 极客蓝：`#5B8FF9`
- Cyan 翡翠绿：`#5AD8A6`
- Grey 商务灰：`#5D7092`
- Daybreak Blue 破晓蓝：`#6DC8EC`
- Golden Purple 罗兰紫：`#945FB9`
- Dark Green 天水青：`#1E9493`
- Magenta 桃花粉：`#FF99C3`
- `#CEEF7D`
- `#FFA382`
- `#F6BD16`

扩展色：

- `#A197D6`、`#B7CFFF`、`#86ACF9`、`#DECFEA`
- `#4BC1C0`、`#90EF7D`、`#85D5D5`、`#8EA2C2`
- `#93C75C`、`#ABD87B`、`#FFEAA4`、`#5A79AF`
- `#B8D1D1`、`#E86452`、`#EB639B`、`#B3E6F5`
- `#FFD96B`、`#FFE0ED`、`#F97B4D`、`#FFBBA2`、`#8BDAFA`

### 2.5 数据类型配色

- Database：`#5AD8A6`
- Code：`#1677FF`
- NoSQL：`#5D7092`
- External：`#9B7E7D`
- MQ：`#CF8D5C`
- Pool：`#6DC8EC`
- Network：`#A033EB`
- Gen AI：建议沿用 `#A033EB`

## 3. 字体规范

### 3.1 字体族

- 中文主字体：`PingFang SC`
- 英文/数字辅助字体：`Helvetica Neue`、`Inter`
- 个别组件引用：`SF Pro Text`、`Source Han Sans CN`、`Source Sans 3`

### 3.2 字重

- 常规：`400`
- 中强调：`500`
- 强强调 / 标题：`600`

### 3.3 字号与行高

- `12px / 16px`：辅助信息、小尺寸表格内容。
- `14px / 22px`：默认正文、表单、按钮、表格单元格。
- `16px / 24px`：小标题、分组标题。
- `18px / 23px`：强调型标题。
- `20px / 28px`：页面内模块标题。
- `24px / 32px`：大标题。
- `30px / 38px`：页面级标题或数据展示。
- `38px / 46px`：超大数字或主视觉标题。

字体 token 示例：

- `fontWeightNormal = 400`
- `fontWeightStrong = 600`
- `fontSize = 14`
- `fontSizeSM = 12`
- `fontSizeLG = 16`
- `fontSizeXL = 18`
- `fontSizeHeading1 = 20`

## 4. 圆角、阴影与间距

### 4.1 圆角

- 常用控件圆角：`6px`
- 小元素/细分组件：`4px`
- 小标签或极小元素：`2px`
- 卡片/容器：以 `6px` 为主，少量使用 `8px`
- 胶囊、开关、头像类：`16px`、`20px`、`100px`

### 4.2 阴影

常见阴影层级：

- 低层级：`0 2px 4px`
- 中层级：`0 3px 6px`
- 高层级：`0 6px 16px`
- 浮层/弹层：`0 9px 28px`

### 4.3 间距

- 基础间距单位：`8px`
- 页面/模块间距：`16px`
- 表格列内名称与筛选操作间距：`8px`
- 卡片平铺间距：`16px`
- 侧边栏、菜单、内容模块使用 8px/16px 组合。

## 5. 按钮规范

按钮类型：

- 主按钮
- 次按钮
- 文字 Link
- 小按钮
- 批量操作按钮
- 下拉操作按钮

状态：

- Normal
- Hover
- Active
- Disable
- Loading

主按钮：

- Normal：背景 `#1677FF`，文字白色。
- Hover：背景 `#4096FF`。
- Active：背景 `#0958D9`。
- Disable：文字 `#C8C9CC`，背景 `#EAEAEA`，边框 `#DCDEE0`。

次按钮：

- 默认：白底，主色描边或浅灰描边。
- Hover / Active：交互规则与主按钮同色系，文字使用主色。
- Disable：使用禁用文字、禁用背景、禁用边框。

文字 Link：

- Normal：`#1677FF`
- Hover：`#4096FF`
- Active：`#0958D9`
- Disable：`#C8C9CC`

## 6. 数据录入组件

数据录入画板尺寸为 `2560 x 2906`，覆盖表单输入、选择、勾选、开关、时间日期等完整状态。此类组件的默认文字为 `PingFang SC 14px / 22px`，控件主高度以 `32px` 为主，标题/分组标题分别使用 `20px / 28px`、`16px / 24px`。

### 6.1 输入框 Input

覆盖类型：

- 输入框
- 搜索输入框
- 文本域
- 密码框
- 自动完成

通用结构：

- 可包含 `Prefix`、`Input`、`Suffix`。
- 默认宽度示例为 `400px`，内容区示例为 `296px x 32px`。
- 基础输入框高度为 `32px`。
- 文本域为多行输入区域，状态与输入框一致。

状态：

- `Default`：默认输入态。
- `Hover`：鼠标悬停态。
- `Focused`：聚焦态，边框/强调色使用主色 `#1677FF`。
- `Typing`：输入中。
- `Filled`：已有内容。
- `Disabled`：禁用，文字使用 `#C8C9CC`，背景/边框弱化。

密码框：

- 内容以 `•••••••••` 掩码展示。
- 状态同输入框：Default、Hover、Focused、Typing、Filled、Disabled。

搜索输入框：

- 与普通输入框规则一致。
- 额外包含搜索图标或搜索前缀区域。

文本域：

- 使用多行 `Textarea` 内容区。
- 状态同输入框。
- 用于较长文本录入。

自动完成 AutoComplete：

- 基于输入框扩展。
- 弹层中包含 `Select menu item` 与 `Select Group`。
- 状态包含 Default、Hover、Filled、Disabled、Active。

### 6.2 选择器 Select

覆盖类型：

- 单选选择器
- 多选选择器

单选 Select：

- 展示占位文本 `Select`。
- 下拉菜单包含 `Select menu item` 和 `Select Group`。
- 状态包含 Default、Hover、Filled、Disabled、Active。

多选 Select：

- 选中项以 `Item` 标签形式展示。
- 多选内容区包含 `Multiple Selection Items`。
- 状态包含 Default、Hover、Filled、Disabled、Focused。
- 适合筛选条件、标签选择、批量分类选择。

### 6.3 单选框 Radio

覆盖内容：

- 单选框

结构：

- 单选按钮尺寸为 `16px x 16px`。
- 文案使用 `14px / 22px`。

状态：

- Default：未选中。
- Hover：悬停。
- Focused：聚焦。
- Checked / Selected：选中，使用主色 `#1677FF`。
- Disabled：禁用，整体弱化。

使用规则：

- 用于互斥选择。
- 同组内只允许选择一个。
- 推荐横向或纵向等距排列，文本与圆点保持紧凑对齐。

### 6.4 多选框 Checkbox

覆盖内容：

- 多选框

结构：

- 多选框尺寸为 `16px x 16px`。
- 文案使用 `14px / 22px`。

状态：

- Default：未选中。
- Hover：悬停。
- Focused：聚焦。
- Checked / Selected：选中，使用主色 `#1677FF`。
- Indeterminate：半选，适用于父子层级批量选择。
- Disabled：禁用。

使用规则：

- 用于非互斥的多项选择。
- 表格批量选择、筛选项、配置项均可使用。

### 6.5 开关 Switch

覆盖内容：

- 开关

规格：

- 默认大尺寸用于表单。
- 小尺寸用于表格。
- 大尺寸内容区示例为 `44px x 22px`。
- 小尺寸内容区示例为 `32px x 16px` 或 `28px x 16px`。

状态：

- Default：默认关闭。
- Hover：悬停。
- Pressed：按下。
- Checked：开启，使用主色 `#1677FF`。
- Disabled：禁用。
- Loading：加载中。

使用规则：

- 用于立即生效的二元开关。
- 表单内优先使用默认尺寸。
- 表格内优先使用小尺寸，避免挤占行高。

### 6.6 时间选择 TimePicker

覆盖内容：

- 时间选择框

规格：

- 输入框高度 `32px`。
- 时间面板包含小时、分钟、秒三列。
- 单列宽度示例为 `56px`，面板示例宽度 `170px`。
- 底部包含 `此刻` 和 `确定` 操作。

状态：

- Default
- Hover
- Focused
- Filled
- Disabled
- Selected

示例值：

- `14:09`
- `00` 至 `07`

### 6.7 日期选择 DatePicker

覆盖内容：

- 日期选择框
- 日期范围选择框

单日期：

- 输入占位：`Select date`
- 示例值：`2020-11-02`
- 日期面板标题示例：`2023年 12月`
- 周标题：`Su Mo Tu We Th Fr Sa`
- 底部操作：`今天`

日期范围：

- 起始占位：`Start date`
- 结束占位：`End date`
- 可与时间选择联动，示例时间 `09:23:35`。

状态：

- Default
- Hover
- Focused
- Filled
- Disabled
- Selected

### 6.8 时间范围检索

设计稿中包含业务型时间段检索组件：

- 支持快速查询时间范围：过去 5 分钟、15 分钟、30 分钟、1 小时、3 小时、6 小时、12 小时、24 小时、2 天、7 天、30 天、90 天。
- 支持历史时间查询、自定义时间范围、时间粒度选择。
- 时间粒度选项包含 10 秒、30 秒、1 分钟、3 分钟、5 分钟、10 分钟、15 分钟、30 分钟、1 小时、2 小时、4 小时、8 小时、12 小时、天。
- 支持刷新时间、时间粒度、悬浮提示、关闭等附加操作。
- 自定义时间范围示例：`2023-08-24 11:00:00 至 2023-08-24 12:00:00`。
- 支持“上一个时间段”和历史时间查询。

## 7. 面包屑规范

- 层级示例：一级页面 / 二级页面 / 三级页面 / 四级页面。
- 当前页面文字：`rgba(0,0,0,0.65)`。
- 上层页面文字：`rgba(0,0,0,0.45)`。
- 上层点击与悬浮：使用主色 `#1677FF`。
- 分隔符：`/`。

## 8. 数据卡片规范

数据卡片用于关键指标展示，示例指标：

- CPU 使用率
- CPU 使用速率
- 异常次数
- 异常率
- 平均值
- 样本量

布局规则：

- 单一区域底色上平铺小卡片。
- 卡片间距 `16px`。
- 可展示 3 个或 5 个指标模块。
- 数值应突出，单位和辅助说明弱化。

## 9. 表格规范

表格覆盖：

- 基础表格
- 工具栏
- 搜索/筛选
- 多选
- 批量操作
- 下拉操作
- 表头设置
- 展开行
- 状态列

表格布局：

- 左对齐列：以列左侧竖线为基准，元素间距保持 `8px`。
- 右对齐列：以右侧竖线为基准。
- 名称与筛选操作间距：`8px`。
- 表格内容字体：默认 `14px / 22px`。

表格操作：

- 常见操作：修改、启用、禁用、删除、导出、添加、确认、分配、静默、关闭、合并。
- 批量状态示例：打开、已分配、处理中、解除、关闭、静默、全部。

状态/优先级：

- P0：需要立即解决，会导致完全中断或关键功能不可用。
- P1：高优先级问题。
- P2：合理时间内解决，影响部分用户体验。
- P3：有能力时解决，不妨碍系统运行。
- P4：最终应解决，不属于核心问题。

## 10. 布局规范

### 10.1 页面底色

- 所有页面通用底色：`#F0F1F5`。
- 顶部/侧边/内容容器常用底色：`#FFFFFF`、`#FAFAFA`、`#F9FAFB`。

### 10.2 落地页布局

包含：

- 侧边栏
- 顶部区域
- 全部应用
- 固定
- 最近
- 文档
- 应用入口卡片

规则：

- 侧边栏支持收起。
- 入口区域使用白色底或浅灰底。
- 模块间距以 `8px`、`16px` 为主。

### 10.3 应用布局

包含：

- 顶部菜单
- 全局搜索
- 内容模块
- 快速创建轻应用
- 模型 / 数据集筛选
- 时间范围与时间粒度
- 快捷筛选展开/收起
- 顶部吸顶

规则：

- 重点信息展示区域与落地页接口展示模块一致。
- 单一底色区域上平铺小卡片。
- 卡片间距 `16px`。
- 顶部筛选与关键操作区需要保持吸顶能力。

## 11. 图标规范

图标分类：

- 应用图标
- 系统图标
- 数据接入图标
- 按钮图标
- 按钮内图标
- 标签图标
- 状态图标
- Dock 图标
- 指针状态图标

应用图标示例：

- 多维分析、Dashboard、全局拓扑、Kubernetes、下载中心、安全感知、攻击拦截、应用资产、NoSQL、MQ、小程序、应用、智能报告、集成、配置、线程剖析、内存诊断、事件、指标体系、响应、业务、连接池、故障管理、探针、用户旅程、网络-EBPF、终端配置、持续监测、Web、拨测警报、组件、任务管理、APM 配置、分布式链路追踪、网络、Docker、报告、App、用户分析、请求、硬件、大屏、轻应用市场、主机、部署状态、错误分析、日志、疑似问题、Database。

状态图标示例：

- 严重
- 警告
- 解除
- 正常
- 延迟
- 卡顿
- Beta
- 旧版
- New

## 12. 前端 Token 建议

```css
:root {
  --ty-color-primary: #1677ff;
  --ty-color-primary-hover: #4096ff;
  --ty-color-primary-active: #0958d9;
  --ty-color-success: #00b578;
  --ty-color-warning: #ff9000;
  --ty-color-error: #ff3f25;
  --ty-color-page-bg: #f0f1f5;
  --ty-color-bg: #ffffff;
  --ty-color-bg-light: #fafafa;
  --ty-color-text: rgba(0, 0, 0, 0.85);
  --ty-color-text-secondary: rgba(0, 0, 0, 0.65);
  --ty-color-text-tertiary: rgba(0, 0, 0, 0.45);
  --ty-color-disabled: #c8c9cc;
  --ty-color-border: #d9d9d9;
  --ty-color-border-light: #ebedf0;

  --ty-font-family: "PingFang SC", "Helvetica Neue", Arial, sans-serif;
  --ty-font-size-sm: 12px;
  --ty-font-size: 14px;
  --ty-font-size-lg: 16px;
  --ty-font-size-xl: 18px;
  --ty-font-size-heading: 20px;

  --ty-radius-sm: 2px;
  --ty-radius: 6px;
  --ty-radius-lg: 8px;
  --ty-radius-pill: 100px;

  --ty-space-xs: 4px;
  --ty-space-sm: 8px;
  --ty-space: 16px;
  --ty-space-lg: 24px;

  --ty-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.08);
  --ty-shadow: 0 3px 6px rgba(0, 0, 0, 0.12);
  --ty-shadow-lg: 0 6px 16px rgba(0, 0, 0, 0.12);
  --ty-shadow-popover: 0 9px 28px rgba(0, 0, 0, 0.12);
}
```

## 13. 前端实现原则

### 13.1 优先使用 React + Ant Design

前端开发应优先基于 React 与 Ant Design 组件体系实现页面，尽量减少自行封装基础组件或手写重复样式。

执行原则：

- 优先使用 Ant Design 已有组件，例如 Button、Input、Select、Radio、Checkbox、Switch、DatePicker、TimePicker、Table、Breadcrumb、Card、Modal、Drawer、Tooltip、Dropdown、Tabs、Form 等。
- 优先通过 Ant Design token、主应用 CSS 变量和 Less 变量进行主题适配，不直接在业务代码中散落硬编码颜色、字号、圆角、阴影。
- 只有在 Ant Design 组件无法满足业务交互、布局或视觉表达时，才允许扩展自定义组件。
- 自定义组件应尽量包裹 Ant Design 基础组件，而不是从零实现控件行为。
- 表单、表格、弹窗、下拉、日期时间、开关、单选、多选等基础交互不重复造轮子。
- 页面样式优先解决布局、间距和业务视觉差异，避免重写 Ant Design 的基础状态样式。
- 如需覆盖样式，应基于统一 class、token 或 CSS 变量处理，避免深层选择器和一次性局部 hack。
- 组件状态应复用 Ant Design 的状态能力，包括 disabled、loading、danger、active、hover、focus、checked、selected 等。
- 图标优先使用项目既有图标库或 Ant Design Icons，保持尺寸、颜色、交互状态统一。

落地建议：

```tsx
import { Button, Checkbox, DatePicker, Form, Input, Radio, Select, Switch, Table } from 'antd';

// 推荐：优先组合 Ant Design 组件，通过 token / className 做少量适配。
```

## 14. 观云主应用 Less / CSS 变量集

> 本章节补充自 `C:\Users\tingyun\Downloads\观云主应用 CSS 变量集.md`。变量集会挂载在主应用 `body` 元素上，子应用如需统一主题、颜色、字体、间距和控件尺寸，应优先使用这些变量。

### 14.1 使用与维护规则

- 主应用 CSS 变量集挂载在主应用 `body` 元素上，子应用如需可以使用。
- 重命名规范：例如 `colorTextHeading` 重命名为 `--ty-color-text-heading`。
- 表格中已有的值不允许删除；如需更新，旧值保留删除线，新值放在后面，用于记录变量变更历史。

### 14.2 命名转换规则

- Ant Design token 使用驼峰命名，例如 `colorTextHeading`。
- 主应用 CSS 变量使用 `--ty-` 前缀和 kebab-case，例如 `--ty-color-text-heading`。
- 建议 Less 中统一通过 CSS 变量消费，例如：

```less
@ty-color-primary: var(--ty-color-primary);
@ty-color-text-heading: var(--ty-color-text-heading);
@ty-color-bg-layout: var(--ty-color-bg-layout);
@ty-border-radius: var(--ty-border-radius);
@ty-control-height: var(--ty-control-height);
```

### 14.3 主题切换变量

| Token                      | 建议 CSS 变量                      | 描述                                       | 类型   | 白色主题默认值                                               | 黑色主题默认值              |
| -------------------------- | ---------------------------------- | ------------------------------------------ | ------ | ------------------------------------------------------------ | --------------------------- |
| `colorTextHeading`         | `--ty-color-text-heading`          | 标题字体颜色                               | string | `rgba(0, 0, 0, 0.85)`                                        | `rgba(255, 255, 255, 0.85)` |
| `colorTextLabel`           | `--ty-color-text-label`            | 文本标签字体颜色                           | string | `rgba(0, 0, 0, 0.65)`                                        | `rgba(255, 255, 255, 0.65)` |
| `colorTextDescription`     | `--ty-color-text-description`      | 文本描述字体颜色                           | string | `rgba(0, 0, 0, 0.45)`                                        | `rgba(255, 255, 255, 0.45)` |
| `colorTextDisabled`        | `--ty-color-text-disabled`         | 禁用状态字体颜色                           | string | ~~`rgba(0, 0, 0, 0.25)`~~<br/>`#C8C9CC`                      | `rgba(200, 201, 204, 0.30)` |
| `colorTextPlaceholder`     | `--ty-color-text-placeholder`      | 占位文本颜色                               | string | `rgba(0, 0, 0, 0.25)`                                        | `rgba(255, 255, 255, 0.25)` |
| `colorBgLayout`            | `--ty-color-bg-layout`             | 页面整体布局背景色，仅用于页面 B1 视觉层级 | string | ~~`#f5f5f5`~~<br/>`#f0f1f5`                                  | `#000000`                   |
| `colorBgContainer`         | `--ty-color-bg-container`          | 组件容器背景色，例如默认按钮、输入框等     | string | `#ffffff`                                                    | `#1F1F1F`                   |
| `colorBgMask`              | `--ty-color-bg-mask`               | 浮层蒙层颜色，用于 Modal、Drawer 等        | string | `rgba(0, 0, 0, 0.45)`                                        | `rgba(0, 0, 0, 0.45)`       |
| `colorBorder`              | `--ty-color-border`                | 默认边框颜色，用于表单分割线、卡片分割线等 | string | ~~`#d9d9d9`~~<br/>`rgba(174, 174, 174, 0.45)`                | `rgba(174, 174, 174, 0.45)` |
| `colorBorderSecondary`     | `--ty-color-border-secondary`      | 更浅一级边框色，与 `colorSplit` 一致       | string | ~~`#f0f0f0`~~<br/>`rgba(174, 174, 174, 0.25)`                | `rgba(174, 174, 174, 0.25)` |
| `boxShadow`                | `--ty-box-shadow`                  | 一级阴影                                   | string | `0 6px 16px 0 rgba(0,0,0,0.08), 0 9px 28px 8px rgba(0,0,0,0.05)` | 同白色主题                  |
| `boxShadowSecondary`       | `--ty-box-shadow-secondary`        | 二级阴影                                   | string | `0px 9px 10px 8px rgba(0,0,0,0.05), 0px 6px 4px 0px rgba(0,0,0,0.08)` | 同白色主题                  |
| `boxShadowTertiary`        | `--ty-box-shadow-tertiary`         | 三级阴影                                   | string | `0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)` | 同白色主题                  |
| `colorBgContainerDisabled` | `--ty-color-bg-container-disabled` | 禁用状态容器背景色                         | string | `rgba(0, 0, 0, 0.04)`                                        | `rgba(255, 255, 255, 0.08)` |
| `colorBgTextActive`        | `--ty-color-bg-text-active`        | 文本激活背景色                             | string | `rgba(174, 174, 174, 0.25)`                                  | `rgba(174, 174, 174, 0.25)` |
| `colorBgTextHover`         | `--ty-color-bg-text-hover`         | 文本悬停背景色                             | string | `rgba(174, 174, 174, 0.15)`                                  | `rgba(174, 174, 174, 0.25)` |
| `colorBorderBg`            | `--ty-color-border-bg`             | 元素背景边框色                             | string | `#ffffff`                                                    | -                           |

### 14.4 颜色变量

| Token          | 建议 CSS 变量            | 描述                              | 类型     | 默认值                         |
| -------------- | -------------------- | ------------------------------- | ------ | --------------------------- |
| `colorError`   | `--ty-color-error`   | 操作失败、错误状态、Result 等              | string | ~~`#ff4d4f`~~<br/>`#FF3F25` |
| `colorInfo`    | `--ty-color-info`    | 信息状态，用于 Alert、Tag、Progress 等    | string | `#1677ff`                   |
| `colorPrimary` | `--ty-color-primary` | 品牌主色                            | string | `#1677ff`                   |
| `colorSuccess` | `--ty-color-success` | 操作成功、Result、Progress 等          | string | ~~`#52c41a`~~<br/>`#00B578` |
| `colorWarning` | `--ty-color-warning` | 警告状态、Notification、Alert、Input 等 | string | ~~`#faad14`~~<br/>`#FF9000` |
| `colorLink`    | `--ty-color-link`    | 超链接颜色                           | string | `#1677ff`                   |

### 14.5 字体变量

| Token                | 建议 CSS 变量                    | 描述                   | 类型     | 默认值                                                                                                                                                                                     |
| -------------------- | ---------------------------- | -------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fontFamily`         | `--ty-font-family`           | 系统界面字体栈              | string | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'` |
| `fontFamilyCode`     | `--ty-font-family-code`      | 代码字体，用于 code、pre、kbd | string | `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace`                                                                                                              |
| `fontSize`           | `--ty-font-size`             | 默认字号                 | number | `14`                                                                                                                                                                                    |
| `fontSizeSM`         | `--ty-font-size-sm`          | 小号字号                 | number | `12`                                                                                                                                                                                    |
| `fontSizeLG`         | `--ty-font-size-lg`          | 大号字号                 | number | `16`                                                                                                                                                                                    |
| `fontSizeXL`         | `--ty-font-size-xl`          | 超大字号                 | number | `20`                                                                                                                                                                                    |
| `fontSizeHeading1`   | `--ty-font-size-heading-1`   | H1 字号                | number | `38`                                                                                                                                                                                    |
| `fontSizeHeading2`   | `--ty-font-size-heading-2`   | H2 字号                | number | `30`                                                                                                                                                                                    |
| `fontSizeHeading3`   | `--ty-font-size-heading-3`   | H3 字号                | number | `24`                                                                                                                                                                                    |
| `fontSizeHeading4`   | `--ty-font-size-heading-4`   | H4 字号                | number | `20`                                                                                                                                                                                    |
| `fontSizeHeading5`   | `--ty-font-size-heading-5`   | H5 字号                | number | `16`                                                                                                                                                                                    |
| `lineHeight`         | `--ty-line-height`           | 默认行高                 | number | `1.5714285714285714`                                                                                                                                                                    |
| `lineHeightHeading1` | `--ty-line-height-heading-1` | H1 行高                | number | `1.2105263157894737`                                                                                                                                                                    |
| `lineHeightHeading2` | `--ty-line-height-heading-2` | H2 行高                | number | `1.2666666666666666`                                                                                                                                                                    |
| `lineHeightHeading3` | `--ty-line-height-heading-3` | H3 行高                | number | `1.3333333333333333`                                                                                                                                                                    |
| `lineHeightHeading4` | `--ty-line-height-heading-4` | H4 行高                | number | `1.4`                                                                                                                                                                                   |
| `lineHeightHeading5` | `--ty-line-height-heading-5` | H5 行高                | number | `1.5`                                                                                                                                                                                   |
| `lineHeightLG`       | `--ty-line-height-lg`        | 大型文本行高               | number | `1.5`                                                                                                                                                                                   |
| `lineHeightSM`       | `--ty-line-height-sm`        | 小型文本行高               | number | `1.6666666666666667`                                                                                                                                                                    |

### 14.6 间距变量

| Token     | 建议 CSS 变量       | 描述                     | 类型     | 默认值  |
| --------- | --------------- | ---------------------- | ------ | ---- |
| `size`    | `--ty-size`     | 默认尺寸，用于 padding、margin | number | `16` |
| `sizeXXS` | `--ty-size-xxs` | 超小间距                   | number | `4`  |
| `sizeXS`  | `--ty-size-xs`  | 小间距                    | number | `8`  |
| `sizeSM`  | `--ty-size-sm`  | 较小间距                   | number | `12` |
| `sizeMS`  | `--ty-size-ms`  | 中小间距                   | number | `16` |
| `sizeMD`  | `--ty-size-md`  | 中等间距                   | number | `20` |
| `sizeLG`  | `--ty-size-lg`  | 大间距                    | number | `24` |
| `sizeXL`  | `--ty-size-xl`  | 较大间距                   | number | `32` |
| `sizeXXL` | `--ty-size-xxl` | 超大间距                   | number | `48` |

### 14.7 其他基础变量

| Token               | 建议 CSS 变量                  | 描述                          | 类型     | 默认值    |
| ------------------- | -------------------------- | --------------------------- | ------ | ------ |
| `zIndexBase`        | `--ty-z-index-base`        | 基础 z-index                  | number | `0`    |
| `zIndexPopupBase`   | `--ty-z-index-popup-base`  | 浮层类组件基础 z-index             | number | `1000` |
| `borderRadius`      | `--ty-border-radius`       | 基础组件圆角，例如 Button、Input、Card | number | `6`    |
| `borderRadiusLG`    | `--ty-border-radius-lg`    | 大圆角，用于 Card、Modal 等         | number | `8`    |
| `borderRadiusOuter` | `--ty-border-radius-outer` | 外部圆角                        | number | `4`    |
| `borderRadiusSM`    | `--ty-border-radius-sm`    | 小尺寸组件圆角，例如小按钮、小输入框          | number | `4`    |
| `borderRadiusXS`    | `--ty-border-radius-xs`    | 内部小圆角，例如 Segmented、Arrow    | number | `2`    |
| `controlHeight`     | `--ty-control-height`      | Button、Input 等基础控件高度        | number | `32`   |
| `controlHeightLG`   | `--ty-control-height-lg`   | 较高控件高度                      | number | `40`   |
| `controlHeightSM`   | `--ty-control-height-sm`   | 较小控件高度                      | number | `24`   |
| `controlHeightXS`   | `--ty-control-height-xs`   | 更小控件高度                      | number | `16`   |

### 14.8 废弃变量记录

| 名称     | 变量名                          | 亮色                                      | 黑色                 |
| ------ | ---------------------------- | --------------------------------------- | ------------------ |
| 一级文本色  | `--ty-color-text-one`        | ~~`#fff`~~<br/>`rgba(255,255,255,0.85)` | `rgba(0,0,0,0.1)`  |
| 二级文本色  | `--ty-color-text-two`        | ~~`#fff`~~<br/>`rgba(255,255,255,0.65)` | `rgba(0,0,0,0.65)` |
| 三级文本颜色 | -                            | `rgba(255,255,255,0.45)`                | `rgba(0,0,0,0.45)` |
| 一级容器颜色 | `--ty-color-container-one`   | `#fff`                                  | `#141414`          |
| 二级容器颜色 | `--ty-color-container-two`   | `#fafafa`                               | `#141414`          |
| 三级容器颜色 | `--ty-color-container-three` | `#fff`                                  | `#1f1f1f`          |

## 15. Ant Design 5.0 基础样式变量补充（去重）

本章节来自 `C:\Users\tingyun\Downloads\Antd 5.0 基础样式变量参考.md`，已与前文 Figma 总结和第 14 节观云主应用变量进行 token 名称去重；已出现的变量不再重复列出。

落地原则：优先使用 Ant Design 5.0 的 Design Token 与组件能力承接基础视觉规范；只有当业务语义、观云品牌变量或 Figma 特定状态无法覆盖时，再补充 `--ty-*` 业务变量。

### 15.1 SeedToken 补充项

| Token                 | 建议 CSS 变量                      | 描述                                                                             | 类型        | 默认值                                      |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------------ | --------- | ---------------------------------------- |
| `colorBgBase`         | `--ty-color-bg-base`           | 用于派生背景色梯度的基础变量，v5 中我们添加了一层背景色的派生算法可以产出梯度明确的背景色的梯度变量。但请不要在代码中直接使用该 Seed Token ！ | `string`  | `#fff`                                   |
| `colorTextBase`       | `--ty-color-text-base`         | 用于派生文本色梯度的基础变量，v5 中我们添加了一层文本色的派生算法可以产出梯度明确的文本色的梯度变量。但请不要在代码中直接使用该 Seed Token ！ | `string`  | `#000`                                   |
| `lineType`            | `--ty-line-type`               | 用于控制组件边框、分割线等的样式，默认是实线                                                         | `string`  | `solid`                                  |
| `lineWidth`           | `--ty-line-width`              | 用于控制组件边框、分割线等的宽度                                                               | `number`  | `1`                                      |
| `motion`              | `--ty-motion`                  | 用于配置动画效果，为 `false` 时则关闭动画                                                      | `boolean` | `true`                                   |
| `motionBase`          | `--ty-motion-base`             |                                                                                | `number`  | `0`                                      |
| `motionEaseInBack`    | `--ty-motion-ease-in-back`     | 预设动效曲率                                                                         | `string`  | `cubic-bezier(0.71, -0.46, 0.88, 0.6)`   |
| `motionEaseInOut`     | `--ty-motion-ease-in-out`      | 预设动效曲率                                                                         | `string`  | `cubic-bezier(0.645, 0.045, 0.355, 1)`   |
| `motionEaseInOutCirc` | `--ty-motion-ease-in-out-circ` | 预设动效曲率                                                                         | `string`  | `cubic-bezier(0.78, 0.14, 0.15, 0.86)`   |
| `motionEaseInQuint`   | `--ty-motion-ease-in-quint`    | 预设动效曲率                                                                         | `string`  | `cubic-bezier(0.755, 0.05, 0.855, 0.06)` |
| `motionEaseOut`       | `--ty-motion-ease-out`         | 预设动效曲率                                                                         | `string`  | `cubic-bezier(0.215, 0.61, 0.355, 1)`    |
| `motionEaseOutBack`   | `--ty-motion-ease-out-back`    | 预设动效曲率                                                                         | `string`  | `cubic-bezier(0.12, 0.4, 0.29, 1.46)`    |
| `motionEaseOutCirc`   | `--ty-motion-ease-out-circ`    | 预设动效曲率                                                                         | `string`  | `cubic-bezier(0.08, 0.82, 0.17, 1)`      |
| `motionEaseOutQuint`  | `--ty-motion-ease-out-quint`   | 预设动效曲率                                                                         | `string`  | `cubic-bezier(0.23, 1, 0.32, 1)`         |
| `motionUnit`          | `--ty-motion-unit`             | 用于控制动画时长的变化单位                                                                  | `number`  | `0.1`                                    |
| `opacityImage`        | `--ty-opacity-image`           |                                                                                | `number`  | `1`                                      |
| `sizePopupArrow`      | `--ty-size-popup-arrow`        | 组件箭头的尺寸                                                                        | `number`  | `16`                                     |
| `sizeStep`            | `--ty-size-step`               | 用于控制组件尺寸的基础步长，尺寸步长结合尺寸变化单位，就可以派生各种尺寸梯度。通过调整步长即可得到不同的布局模式，例如 V5 紧凑模式下的尺寸步长为 2   | `number`  | `4`                                      |
| `sizeUnit`            | `--ty-size-unit`               | 用于控制组件尺寸的变化单位，在 Ant Design 中我们的基础单位为 4 ，便于更加细致地控制尺寸梯度                          | `number`  | `4`                                      |
| `wireframe`           | `--ty-wireframe`               | 用于将组件的视觉效果变为线框化，如果需要使用 V4 的效果，需要开启配置项                                          | `boolean` | `false`                                  |

### 15.2 MapToken 补充项

| Token                     | 建议 CSS 变量                         | 描述                                                                    | 类型       | 默认值                   |
| ------------------------- | --------------------------------- | --------------------------------------------------------------------- | -------- | --------------------- |
| `colorBgBlur`             | `--ty-color-bg-blur`              | 控制毛玻璃容器的背景色，通常为透明色。                                                   | `string` | `transparent`         |
| `colorBgElevated`         | `--ty-color-bg-elevated`          | 浮层容器背景色，在暗色模式下该 token 的色值会比 `colorBgContainer` 要亮一些。例如：模态框、弹出框、菜单等。   | `string` | `#ffffff`             |
| `colorBgSpotlight`        | `--ty-color-bg-spotlight`         | 该色用于引起用户强烈关注注意的背景色，目前只用在 Tooltip 的背景色上。                               | `string` | `rgba(0, 0, 0, 0.85)` |
| `colorErrorActive`        | `--ty-color-error-active`         | 错误色的深色激活态                                                             | `string` | `#d9363e`             |
| `colorErrorBg`            | `--ty-color-error-bg`             | 错误色的浅色背景颜色                                                            | `string` | `#fff2f0`             |
| `colorErrorBgHover`       | `--ty-color-error-bg-hover`       | 错误色的浅色背景色悬浮态                                                          | `string` | `#fff1f0`             |
| `colorErrorBorder`        | `--ty-color-error-border`         | 错误色的描边色                                                               | `string` | `#ffccc7`             |
| `colorErrorBorderHover`   | `--ty-color-error-border-hover`   | 错误色的描边色悬浮态                                                            | `string` | `#ffa39e`             |
| `colorErrorHover`         | `--ty-color-error-hover`          | 错误色的深色悬浮态                                                             | `string` | `#ff7875`             |
| `colorErrorText`          | `--ty-color-error-text`           | 错误色的文本默认态                                                             | `string` | `#ff4d4f`             |
| `colorErrorTextActive`    | `--ty-color-error-text-active`    | 错误色的文本激活态                                                             | `string` | `#d9363e`             |
| `colorErrorTextHover`     | `--ty-color-error-text-hover`     | 错误色的文本悬浮态                                                             | `string` | `#ff7875`             |
| `colorFill`               | `--ty-color-fill`                 | 最深的填充色，用于拉开与二、三级填充色的区分度，目前只用在 Slider 的 hover 效果。                      | `string` | `rgba(0, 0, 0, 0.15)` |
| `colorFillQuaternary`     | `--ty-color-fill-quaternary`      | 最弱一级的填充色，适用于不易引起注意的色块，例如斑马纹、区分边界的色块等。                                 | `string` | `rgba(0, 0, 0, 0.02)` |
| `colorFillSecondary`      | `--ty-color-fill-secondary`       | 二级填充色可以较为明显地勾勒出元素形体，如 Rate、Skeleton 等。也可以作为三级填充色的 Hover 状态，如 Table 等。 | `string` | `rgba(0, 0, 0, 0.06)` |
| `colorFillTertiary`       | `--ty-color-fill-tertiary`        | 三级填充色用于勾勒出元素形体的场景，如 Slider、Segmented 等。如无强调需求的情况下，建议使用三级填色作为默认填色。     | `string` | `rgba(0, 0, 0, 0.04)` |
| `colorInfoActive`         | `--ty-color-info-active`          | 信息色的深色激活态。                                                            | `string` | `#0958d9`             |
| `colorInfoBg`             | `--ty-color-info-bg`              | 信息色的浅色背景颜色。                                                           | `string` | `#e6f4ff`             |
| `colorInfoBgHover`        | `--ty-color-info-bg-hover`        | 信息色的浅色背景色悬浮态。                                                         | `string` | `#bae0ff`             |
| `colorInfoBorder`         | `--ty-color-info-border`          | 信息色的描边色。                                                              | `string` | `#91caff`             |
| `colorInfoBorderHover`    | `--ty-color-info-border-hover`    | 信息色的描边色悬浮态。                                                           | `string` | `#69b1ff`             |
| `colorInfoHover`          | `--ty-color-info-hover`           | 信息色的深色悬浮态。                                                            | `string` | `#69b1ff`             |
| `colorInfoText`           | `--ty-color-info-text`            | 信息色的文本默认态。                                                            | `string` | `#1677ff`             |
| `colorInfoTextActive`     | `--ty-color-info-text-active`     | 信息色的文本激活态。                                                            | `string` | `#0958d9`             |
| `colorInfoTextHover`      | `--ty-color-info-text-hover`      | 信息色的文本悬浮态。                                                            | `string` | `#4096ff`             |
| `colorLinkActive`         | `--ty-color-link-active`          | 控制超链接被点击时的颜色。                                                         | `string` | `#0958d9`             |
| `colorLinkHover`          | `--ty-color-link-hover`           | 控制超链接悬浮时的颜色。                                                          | `string` | `#69b1ff`             |
| `colorPrimaryActive`      | `--ty-color-primary-active`       | 主色梯度下的深色激活态。                                                          | `string` | `#0958d9`             |
| `colorPrimaryBg`          | `--ty-color-primary-bg`           | 主色浅色背景颜色，一般用于视觉层级较弱的选中状态。                                             | `string` | `#e6f4ff`             |
| `colorPrimaryBgHover`     | `--ty-color-primary-bg-hover`     | 与主色浅色背景颜色相对应的悬浮态颜色。                                                   | `string` | `#bae0ff`             |
| `colorPrimaryBorder`      | `--ty-color-primary-border`       | 主色梯度下的描边用色，用在 Slider 等组件的描边上。                                         | `string` | `#91caff`             |
| `colorPrimaryBorderHover` | `--ty-color-primary-border-hover` | 主色梯度下的描边用色的悬浮态，Slider 、Button 等组件的描边 Hover 时会使用。                      | `string` | `#69b1ff`             |
| `colorPrimaryHover`       | `--ty-color-primary-hover`        | 主色梯度下的悬浮态。                                                            | `string` | `#4096ff`             |
| `colorPrimaryText`        | `--ty-color-primary-text`         | 主色梯度下的文本颜色。                                                           | `string` | `#1677ff`             |
| `colorPrimaryTextActive`  | `--ty-color-primary-text-active`  | 主色梯度下的文本激活态。                                                          | `string` | `#0958d9`             |
| `colorPrimaryTextHover`   | `--ty-color-primary-text-hover`   | 主色梯度下的文本悬浮态。                                                          | `string` | `#4096ff`             |
| `colorSuccessActive`      | `--ty-color-success-active`       | 成功色的深色激活态                                                             | `string` | `#389e0d`             |
| `colorSuccessBg`          | `--ty-color-success-bg`           | 成功色的浅色背景颜色，用于 Tag 和 Alert 的成功态背景色                                     | `string` | `#f6ffed`             |
| `colorSuccessBgHover`     | `--ty-color-success-bg-hover`     | 成功色浅色背景颜色，一般用于视觉层级较弱的选中状态，不过 antd 目前没有使用到该 token                      | `string` | `#d9f7be`             |
| `colorSuccessBorder`      | `--ty-color-success-border`       | 成功色的描边色，用于 Tag 和 Alert 的成功态描边色                                        | `string` | `#b7eb8f`             |
| `colorSuccessBorderHover` | `--ty-color-success-border-hover` | 成功色的描边色悬浮态                                                            | `string` | `#95de64`             |
| `colorSuccessHover`       | `--ty-color-success-hover`        | 成功色的深色悬浮态                                                             | `string` | `#95de64`             |
| `colorSuccessText`        | `--ty-color-success-text`         | 成功色的文本默认态                                                             | `string` | `#52c41a`             |
| `colorSuccessTextActive`  | `--ty-color-success-text-active`  | 成功色的文本激活态                                                             | `string` | `#389e0d`             |
| `colorSuccessTextHover`   | `--ty-color-success-text-hover`   | 成功色的文本悬浮态                                                             | `string` | `#73d13d`             |
| `colorText`               | `--ty-color-text`                 | 最深的文本色。为了符合W3C标准，默认的文本颜色使用了该色，同时这个颜色也是最深的中性色。                         | `string` | `rgba(0, 0, 0, 0.88)` |
| `colorTextQuaternary`     | `--ty-color-text-quaternary`      | 第四级文本色是最浅的文本色，例如表单的输入提示文本、禁用色文本等。                                     | `string` | `rgba(0, 0, 0, 0.25)` |
| `colorTextSecondary`      | `--ty-color-text-secondary`       | 作为第二梯度的文本色，一般用在不那么需要强化文本颜色的场景，例如 Label 文本、Menu 的文本选中态等场景。             | `string` | `rgba(0, 0, 0, 0.65)` |
| `colorTextTertiary`       | `--ty-color-text-tertiary`        | 第三级文本色一般用于描述性文本，例如表单的中的补充说明文本、列表的描述性文本等场景。                            | `string` | `rgba(0, 0, 0, 0.45)` |
| `colorWarningActive`      | `--ty-color-warning-active`       | 警戒色的深色激活态                                                             | `string` | `#d48806`             |
| `colorWarningBg`          | `--ty-color-warning-bg`           | 警戒色的浅色背景颜色                                                            | `string` | `#fffbe6`             |
| `colorWarningBgHover`     | `--ty-color-warning-bg-hover`     | 警戒色的浅色背景色悬浮态                                                          | `string` | `#fff1b8`             |
| `colorWarningBorder`      | `--ty-color-warning-border`       | 警戒色的描边色                                                               | `string` | `#ffe58f`             |
| `colorWarningBorderHover` | `--ty-color-warning-border-hover` | 警戒色的描边色悬浮态                                                            | `string` | `#ffd666`             |
| `colorWarningHover`       | `--ty-color-warning-hover`        | 警戒色的深色悬浮态                                                             | `string` | `#ffd666`             |
| `colorWarningText`        | `--ty-color-warning-text`         | 警戒色的文本默认态                                                             | `string` | `#faad14`             |
| `colorWarningTextActive`  | `--ty-color-warning-text-active`  | 警戒色的文本激活态                                                             | `string` | `#d48806`             |
| `colorWarningTextHover`   | `--ty-color-warning-text-hover`   | 警戒色的文本悬浮态                                                             | `string` | `#ffc53d`             |
| `colorWhite`              | `--ty-color-white`                | 不随主题变化的纯白色                                                            | `string` | `#fff`                |
| `lineWidthBold`           | `--ty-line-width-bold`            | 描边类组件的默认线宽，如 Button、Input、Select 等输入类控件。                              | `number` | `2`                   |
| `motionDurationFast`      | `--ty-motion-duration-fast`       | 动效播放速度，快速。用于小型元素动画交互                                                  | `string` | `0.1s`                |
| `motionDurationMid`       | `--ty-motion-duration-mid`        | 动效播放速度，中速。用于中型元素动画交互                                                  | `string` | `0.2s`                |
| `motionDurationSlow`      | `--ty-motion-duration-slow`       | 动效播放速度，慢速。用于大型元素如面板动画交互                                               | `string` | `0.3s`                |

### 15.3 AliasToken 补充项

| Token                         | 建议 CSS 变量                              | 描述                                           | 类型          | 默认值                      |
| ----------------------------- | -------------------------------------- | -------------------------------------------- | ----------- | ------------------------ |
| `colorErrorOutline`           | `--ty-color-error-outline`             | 控制输入组件错误状态下的外轮廓线颜色。                          | `string`    | `rgba(255, 38, 5, 0.06)` |
| `colorFillAlter`              | `--ty-color-fill-alter`                | 控制元素替代背景色。                                   | `string`    | `rgba(0, 0, 0, 0.02)`    |
| `colorFillContent`            | `--ty-color-fill-content`              | 控制内容区域的背景色。                                  | `string`    | `rgba(0, 0, 0, 0.06)`    |
| `colorFillContentHover`       | `--ty-color-fill-content-hover`        | 控制内容区域背景色在鼠标悬停时的样式。                          | `string`    | `rgba(0, 0, 0, 0.15)`    |
| `colorHighlight`              | `--ty-color-highlight`                 | 控制页面元素高亮时的颜色。                                | `string`    | `#ff4d4f`                |
| `colorIcon`                   | `--ty-color-icon`                      | 控制弱操作图标的颜色，例如 allowClear 或 Alert 关闭按钮。 *     | `string`    | `rgba(0, 0, 0, 0.45)`    |
| `colorIconHover`              | `--ty-color-icon-hover`                | 控制弱操作图标在悬浮状态下的颜色，例如 allowClear 或 Alert 关闭按钮。 | `string`    | `rgba(0, 0, 0, 0.88)`    |
| `colorTextLightSolid`         | `--ty-color-text-light-solid`          | 控制带背景色的文本，例如 Primary Button 组件中的文本高亮颜色。      | `string`    | `#fff`                   |
| `colorWarningOutline`         | `--ty-color-warning-outline`           | 控制输入组件警告状态下的外轮廓线颜色。                          | `string`    | `rgba(255, 215, 5, 0.1)` |
| `controlInteractiveSize`      | `--ty-control-interactive-size`        | 控制组件的交互大小。                                   | `number`    | `16`                     |
| `controlItemBgActive`         | `--ty-control-item-bg-active`          | 控制组件项在激活状态下的背景颜色。                            | `string`    | `#e6f4ff`                |
| `controlItemBgActiveDisabled` | `--ty-control-item-bg-active-disabled` | 控制组件项在禁用状态下的激活背景颜色。                          | `string`    | `rgba(0, 0, 0, 0.15)`    |
| `controlItemBgActiveHover`    | `--ty-control-item-bg-active-hover`    | 控制组件项在鼠标悬浮且激活状态下的背景颜色。                       | `string`    | `#bae0ff`                |
| `controlItemBgHover`          | `--ty-control-item-bg-hover`           | 控制组件项在鼠标悬浮时的背景颜色。                            | `string`    | `rgba(0, 0, 0, 0.04)`    |
| `controlOutline`              | `--ty-control-outline`                 | 控制输入组件的外轮廓线颜色。                               | `string`    | `rgba(5, 145, 255, 0.1)` |
| `controlOutlineWidth`         | `--ty-control-outline-width`           | 控制输入组件的外轮廓线宽度。                               | `number`    | `2`                      |
| `controlPaddingHorizontal`    | `--ty-control-padding-horizontal`      | 控制元素水平内间距。                                   | `number`    | `12`                     |
| `controlPaddingHorizontalSM`  | `--ty-control-padding-horizontal-sm`   | 控制元素中小尺寸水平内间距。                               | `number`    | `8`                      |
| `fontSizeIcon`                | `--ty-font-size-icon`                  | 控制选择器、级联选择器等中的操作图标字体大小。正常情况下与 fontSizeSM 相同。 | `number`    | `12`                     |
| `fontWeightStrong`            | `--ty-font-weight-strong`              | 控制标题类组件（如 h1、h2、h3）或选中项的字体粗细。                | `number`    | `600`                    |
| `lineWidthFocus`              | `--ty-line-width-focus`                | 控制线条的宽度，当组件处于聚焦态时。                           | `number`    | `4`                      |
| `linkDecoration`              | `--ty-link-decoration`                 | 控制链接文本的装饰样式。                                 | `undefined` | `TextDecoration<string`  |
| `linkFocusDecoration`         | `--ty-link-focus-decoration`           | 控制链接聚焦时文本的装饰样式。                              | `undefined` | `TextDecoration<string`  |
| `linkHoverDecoration`         | `--ty-link-hover-decoration`           | 控制链接鼠标悬浮时文本的装饰样式。                            | `undefined` | `TextDecoration<string`  |
| `margin`                      | `--ty-margin`                          | 控制元素外边距，中等尺寸。                                | `number`    | `16`                     |
| `marginLG`                    | `--ty-margin-lg`                       | 控制元素外边距，大尺寸。                                 | `number`    | `24`                     |
| `marginMD`                    | `--ty-margin-md`                       | 控制元素外边距，中大尺寸。                                | `number`    | `20`                     |
| `marginSM`                    | `--ty-margin-sm`                       | 控制元素外边距，中小尺寸。                                | `number`    | `12`                     |
| `marginXL`                    | `--ty-margin-xl`                       | 控制元素外边距，超大尺寸。                                | `number`    | `32`                     |
| `marginXS`                    | `--ty-margin-xs`                       | 控制元素外边距，小尺寸。                                 | `number`    | `8`                      |
| `marginXXL`                   | `--ty-margin-xxl`                      | 控制元素外边距，最大尺寸。                                | `number`    | `48`                     |
| `marginXXS`                   | `--ty-margin-xxs`                      | 控制元素外边距，最小尺寸。                                | `number`    | `4`                      |
| `opacityLoading`              | `--ty-opacity-loading`                 | 控制加载状态的透明度。                                  | `number`    | `0.65`                   |
| `padding`                     | `--ty-padding`                         | 控制元素的内间距。                                    | `number`    | `16`                     |
| `paddingContentHorizontal`    | `--ty-padding-content-horizontal`      | 控制内容元素水平内间距。                                 | `number`    | `16`                     |
| `paddingContentHorizontalLG`  | `--ty-padding-content-horizontal-lg`   | 控制内容元素水平内间距，适用于大屏幕设备。                        | `number`    | `24`                     |
| `paddingContentHorizontalSM`  | `--ty-padding-content-horizontal-sm`   | 控制内容元素水平内间距，适用于小屏幕设备。                        | `number`    | `16`                     |
| `paddingContentVertical`      | `--ty-padding-content-vertical`        | 控制内容元素垂直内间距。                                 | `number`    | `12`                     |
| `paddingContentVerticalLG`    | `--ty-padding-content-vertical-lg`     | 控制内容元素垂直内间距，适用于大屏幕设备。                        | `number`    | `16`                     |
| `paddingContentVerticalSM`    | `--ty-padding-content-vertical-sm`     | 控制内容元素垂直内间距，适用于小屏幕设备。                        | `number`    | `8`                      |
| `paddingLG`                   | `--ty-padding-lg`                      | 控制元素的大内间距。                                   | `number`    | `24`                     |
| `paddingMD`                   | `--ty-padding-md`                      | 控制元素的中等内间距。                                  | `number`    | `20`                     |
| `paddingSM`                   | `--ty-padding-sm`                      | 控制元素的小内间距。                                   | `number`    | `12`                     |
| `paddingXL`                   | `--ty-padding-xl`                      | 控制元素的特大内间距。                                  | `number`    | `32`                     |
| `paddingXS`                   | `--ty-padding-xs`                      | 控制元素的特小内间距。                                  | `number`    | `8`                      |
| `paddingXXS`                  | `--ty-padding-xxs`                     | 控制元素的极小内间距。                                  | `number`    | `4`                      |
| `screenLG`                    | `--ty-screen-lg`                       | 控制大屏幕的屏幕宽度。                                  | `number`    | `992`                    |
| `screenLGMax`                 | `--ty-screen-lgmax`                    | 控制大屏幕的最大宽度。                                  | `number`    | `1199`                   |
| `screenLGMin`                 | `--ty-screen-lgmin`                    | 控制大屏幕的最小宽度。                                  | `number`    | `992`                    |
| `screenMD`                    | `--ty-screen-md`                       | 控制中等屏幕的屏幕宽度。                                 | `number`    | `768`                    |
| `screenMDMax`                 | `--ty-screen-mdmax`                    | 控制中等屏幕的最大宽度。                                 | `number`    | `991`                    |
| `screenMDMin`                 | `--ty-screen-mdmin`                    | 控制中等屏幕的最小宽度。                                 | `number`    | `768`                    |
| `screenSM`                    | `--ty-screen-sm`                       | 控制小屏幕的屏幕宽度。                                  | `number`    | `576`                    |
| `screenSMMax`                 | `--ty-screen-smmax`                    | 控制小屏幕的最大宽度。                                  | `number`    | `767`                    |
| `screenSMMin`                 | `--ty-screen-smmin`                    | 控制小屏幕的最小宽度。                                  | `number`    | `576`                    |
| `screenXL`                    | `--ty-screen-xl`                       | 控制超大屏幕的屏幕宽度。                                 | `number`    | `1200`                   |
| `screenXLMax`                 | `--ty-screen-xlmax`                    | 控制超大屏幕的最大宽度。                                 | `number`    | `1599`                   |
| `screenXLMin`                 | `--ty-screen-xlmin`                    | 控制超大屏幕的最小宽度。                                 | `number`    | `1200`                   |
| `screenXS`                    | `--ty-screen-xs`                       | 控制超小屏幕的屏幕宽度。                                 | `number`    | `480`                    |
| `screenXSMax`                 | `--ty-screen-xsmax`                    | 控制超小屏幕的最大宽度。                                 | `number`    | `575`                    |
| `screenXSMin`                 | `--ty-screen-xsmin`                    | 控制超小屏幕的最小宽度。                                 | `number`    | `480`                    |
| `screenXXL`                   | `--ty-screen-xxl`                      | 控制超超大屏幕的屏幕宽度。                                | `number`    | `1600`                   |
| `screenXXLMin`                | `--ty-screen-xxlmin`                   | 控制超超大屏幕的最小宽度。                                | `number`    | `1600`                   |

### 15.4 使用建议

- `SeedToken`：作为主题入口变量，适合在 Antd `ConfigProvider` 的 `theme.token` 中统一配置，例如主色、圆角、基础字号。
- `MapToken`：作为派生变量，优先由 Antd 算法自动生成；只有需要与观云现有 Less/CSS 变量强绑定时再显式覆盖。
- `AliasToken`：面向组件和页面语义，开发时优先使用 Antd 已定义的别名 token，减少页面内临时颜色、间距和阴影值。
- 对照 Figma 时，如果视觉值与 Antd 默认值一致，直接使用 Antd token；如果值不同但语义一致，在主题层覆盖 token，不在业务组件内散落硬编码样式。
