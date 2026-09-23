# 设计基线

开发过程中必须遵守的视觉与样式约束条件。本文件不是流程规则，而是设计层面的事实标准。

## 主题变量真源

- 真源文件：`theme.ts` 和 `css-var.css`（或目标仓库中等价的主题文件）。
- 命名分层：`--ty-*` 为业务与主题语义变量；`--ty-ant-*` 为组件库对 antd 的兼容映射变量。
- 主题改动流程：先改真源，再同步知识库和规则。

## 字体与间距 Token

| 语义 | CSS 变量 | 默认值 |
|------|---------|--------|
| 字体族 | `--ty-font-family` | `Helvetica Neue, Arial, Microsoft Yahei, PingFang, sans-serif` |
| 默认字号 | `--ty-font-size` | `12px` |
| 超小间距 | `--ty-spacing-xxs` | `4px` |
| 小间距 | `--ty-spacing-xs` | `8px` |
| 中小间距 | `--ty-spacing-sm` | `12px` |
| 默认间距 | `--ty-spacing` | `16px` |
| 中间距 | `--ty-spacing-md` | `20px` |
| 大间距 | `--ty-spacing-lg` | `24px` |
| 超大间距 | `--ty-spacing-xl` | `32px` |
| 最大间距 | `--ty-spacing-xxl` | `48px` |

使用建议：页面模块间距用 `--ty-spacing` 或 `--ty-spacing-xs`；表格、筛选等紧凑场景用 `--ty-spacing-xs` 或 `--ty-spacing-sm`。

## 核心颜色 Token

| 语义 | CSS 变量 | 亮色主题 | 暗色主题 |
|------|---------|---------|---------|
| 主色 | `--ty-color-primary` | `#1677ff` | `#1677ff` |
| 正文文字 | `--ty-color-text` | `#172634` | `#172634` |
| 标题文字 | `--ty-color-text-heading` | `#000000` | `rgba(255,255,255,0.85)` |
| 标签文字 | `--ty-color-text-label` | `#172634` | `rgba(255,255,255,0.65)` |
| 说明文字 | `--ty-color-text-description` | `#6f7782` | `rgba(255,255,255,0.45)` |
| 占位文字 | `--ty-color-text-placeholder` | `#a7b1be` | `rgba(255,255,255,0.25)` |
| 禁用文字 | `--ty-color-text-disabled` | `#a7b1be` | `rgba(200,201,204,0.30)` |
| 页面底色 | `--ty-color-bg-layout` | `#f0f1f5` | `#000000` |
| 容器底色 | `--ty-color-bg-container` | `#ffffff` | `#1F1F1F` |
| 蒙层 | `--ty-color-bg-mask` | `rgba(0,0,0,0.45)` | `rgba(0,0,0,0.45)` |
| 描边 | `--ty-color-border` | `rgba(174,174,174,0.45)` | `rgba(174,174,174,0.45)` |

使用建议：页面背景用 `--ty-color-bg-layout`，卡片白底用 `--ty-color-bg-container`；标题、正文、说明分别用对应 text token。

## 其他基础 Token

| 语义 | CSS 变量 | 默认值 |
|------|---------|--------|
| 主应用层级 | `--ty-main-zindex` | `201` |
| 默认图标色 | `--ty-icon-color` | `#808182` |
| 主阴影 | `--ty-box-shadow` | `0 6px 16px 0 rgba(0,0,0,0.08), 0 9px 28px 8px rgba(0,0,0,0.05)` |
| 次阴影 | `--ty-box-shadow-secondary` | `0px 9px 10px 8px rgba(0,0,0,0.05), 0px 6px 4px 0px rgba(0,0,0,0.08)` |

## 颜色体系

### 品牌色与交互色

- 主色：`#1677FF`
- Hover：`#4096FF`
- Active：`#0958D9`
- 禁用文字：`#C8C9CC`，背景：`#EAEAEA`，边框：`#DCDEE0`

### 语义色

- 成功：`#00B578`
- 警告：`#FF9000`
- 错误：`#FF3F25`
- 状态码：2xx 绿、<200 或 3xx 灰、4xx+ 红

### 页面与中性色

- 页面底色：`#F0F1F5`
- 卡片底色：`#FFFFFF`
- 浅背景：`#FAFAFA`、`#F9FAFB`、`#F7F8FA`
- 主要文字：`rgba(0,0,0,0.85)`
- 次级文字：`rgba(0,0,0,0.65)`
- 辅助文字：`rgba(0,0,0,0.45)`

### 图表色板

基础 10 色：`#5B8FF9`、`#5AD8A6`、`#5D7092`、`#6DC8EC`、`#945FB9`、`#1E9493`、`#FF99C3`、`#CEEF7D`、`#FFA382`、`#F6BD16`

图表分类色只用于图表分类，不用于普通状态按钮。

### 数据类型配色

- Database：`#5AD8A6`
- Code：`#1677FF`
- NoSQL：`#5D7092`
- External：`#9B7E7D`
- MQ：`#CF8D5C`
- Pool：`#6DC8EC`
- Network：`#A033EB`
- Gen AI：沿用 `#A033EB`

## 字体规则

- 默认不手动设置 `font-family`。
- 非默认字号必须使用变量，不直接写死字号。
- 字重优先使用变量（如 `--ty-ant-font-weight-strong`）。
- 字号与行高必须成对使用。

常用变量：`--ty-ant-font-size`、`--ty-ant-font-size-sm`、`--ty-ant-font-size-lg`、`--ty-ant-font-size-xl`、`--ty-ant-line-height`、`--ty-ant-font-size-heading-1` ~ `heading-5`

## 圆角

- 常用控件：`6px`
- 小元素：`4px`
- 极小元素：`2px`
- 卡片/容器：`6px` 为主，少量 `8px`
- 胶囊/开关/头像：`16px`、`20px`、`100px`

## 阴影

- 低层级：`0 2px 4px`
- 中层级：`0 3px 6px`
- 高层级：`0 6px 16px`
- 浮层/弹层：`0 9px 28px`

## 间距

- 基础间距单位：`8px`
- 页面与模块间距：`16px`
- 表格列名称与筛选操作间距：`8px`
- 卡片平铺间距：`16px`

## 选值优先级

1. 先用语义变量，不直接写色值。
2. 现有语义变量能表达，就不要再造新变量。
3. 只有主题体系未覆盖时，才临时硬编码，并记录是否值得后续沉淀。

## 维护要求

- 主题改动流程：先改主题源（`theme.ts` / `css-var.css`），再同步知识库。
- 新增变量前先确认是否已有可复用语义变量。
- 若确需硬编码，需确认有明确语义且当前 token 未覆盖。

## 设计自检清单

- 是否删除了非必要 `font-family`。
- 是否移除了可继承的默认字号与默认字色。
- 非默认字号、颜色、间距、圆角、阴影是否优先使用语义变量。
- 若存在硬编码色值（如 `#xxx`、`rgba(...)`），是否属于变量未覆盖场景，且已评估可后续沉淀。
- 新增变量是否已在主题源登记。
- `hover` / `active` / `disabled` / `loading` / `empty` 状态是否有一致视觉反馈。
