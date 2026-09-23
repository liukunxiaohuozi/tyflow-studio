# 主题变量与设计 Token

## 文档元信息

- 文档定位：沉淀主题源、变量命名分层、全局样式约束和当前 token 基线。
- 适用范围：样式重构、token 收敛、主题变量扩展、暗黑模式兼容。
- 推荐优先级：涉及变量、主题、全局样式时优先读取。
- 冲突处理：若与目标仓库实际主题文件冲突，以主题文件为准。
- 最后更新时间：2026-05-25

## 真源定义

- 主题变量真源通常是 `theme.ts` 与 `css-var.css`，或目标仓库中等价的主题文件。
- 变量命名分层：
  - `--ty-*`：业务与主题语义变量。
  - `--ty-ant-*`：组件库对 antd 的兼容映射变量。
- 规则：优先使用语义变量；当前变量体系未覆盖时，才允许评估硬编码。

## 全局样式约束

- 默认不手动设置 `font-family`。
- 默认字号、默认字色不显式设置，非默认值再声明。
- `padding / margin / color / radius / shadow` 优先使用 token 或语义变量。
- 禁止在页面内散落多套同语义视觉值。

## 当前 token 基线

这份文档只保留高频、最值得记忆的 token 速查表。

如果需要完整长表，请读 [design-full-reference.md](./design-full-reference.md)。

### 字体与间距

| 语义 | CSS 变量 | 默认值 |
| --- | --- | --- |
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

使用建议：

- 页面模块间距优先使用 `--ty-spacing` 或 `--ty-spacing-xs`。
- 表格、筛选、标签等紧凑场景优先使用 `--ty-spacing-xs` 或 `--ty-spacing-sm`。

### 核心颜色

| 语义 | CSS 变量 | 亮色主题 | 暗色主题 |
| --- | --- | --- | --- |
| 主色 | `--ty-color-primary` | `#1677ff` | `#1677ff` |
| 正文文字 | `--ty-color-text` | `#172634` | `#172634` |
| 标题文字 | `--ty-color-text-heading` | `#000000` | `rgba(255, 255, 255, 0.85)` |
| 标签文字 | `--ty-color-text-label` | `#172634` | `rgba(255, 255, 255, 0.65)` |
| 说明文字 | `--ty-color-text-description` | `#6f7782` | `rgba(255, 255, 255, 0.45)` |
| 占位文字 | `--ty-color-text-placeholder` | `#a7b1be` | `rgba(255, 255, 255, 0.25)` |
| 禁用文字 | `--ty-color-text-disabled` | `#a7b1be` | `rgba(200, 201, 204, 0.30)` |
| 页面底色 | `--ty-color-bg-layout` | `#f0f1f5` | `#000000` |
| 容器底色 | `--ty-color-bg-container` | `#ffffff` | `#1F1F1F` |
| 容器禁用底色 | `--ty-color-bg-container-disabled` | `rgba(0, 0, 0, 0.04)` | `rgba(255, 255, 255, 0.08)` |
| 蒙层 | `--ty-color-bg-mask` | `rgba(0, 0, 0, 0.45)` | `rgba(0, 0, 0, 0.45)` |
| 描边 | `--ty-color-border` | `rgba(174, 174, 174, 0.45)` | `rgba(174, 174, 174, 0.45)` |
| 次级描边 | `--ty-color-border-secondary` | `rgba(174, 174, 174, 0.25)` | `rgba(174, 174, 174, 0.25)` |

使用建议：

- 页面背景优先用 `--ty-color-bg-layout`，卡片和白底容器优先用 `--ty-color-bg-container`。
- 标题、正文、说明文案分别优先用 `--ty-color-text-heading`、`--ty-color-text`、`--ty-color-text-description`。
- 不要把图表分类色替代为正文或状态色。

### 其他基础变量

| 语义 | CSS 变量 | 默认值 |
| --- | --- | --- |
| 主应用层级 | `--ty-main-zindex` | `201` |
| 默认图标色 | `--ty-icon-color` | `#808182` |
| 主阴影 | `--ty-box-shadow` | `0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)` |
| 次阴影 | `--ty-box-shadow-secondary` | `0px 9px 10px 8px rgba(0,0,0,0.05), 0px 6px 4px 0px rgba(0,0,0,0.08)` |
| 三级阴影 | `--ty-box-shadow-tertiary` | `0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)` |

### 如何选值

优先顺序：

1. 先用语义变量，不直接写色值。
2. 现有语义变量能表达，就不要再造新变量。
3. 只有主题体系未覆盖时，才临时硬编码，并记录是否值得后续沉淀。

## 维护要求

- 主题改动流程：先改主题源，再同步知识库。
- 新增变量前先确认是否已有可复用语义变量。
- 若确需硬编码，需确认有明确语义且当前 token 未覆盖。
