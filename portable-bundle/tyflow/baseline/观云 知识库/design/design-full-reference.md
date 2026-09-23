# 前端设计落地规范（完整参考）

## 文档元信息

- 文档定位：指导前端把设计稿稳定落到代码中的可执行样式规范。
- 适用范围：页面还原、视觉修正、样式补全、设计走查。
- 推荐优先级：涉及样式实现时优先于来源摘录阅读本文件。
- 冲突处理：若与目标仓库主题源或真实样式实现冲突，以主题源和真实实现为准。
- 最后更新时间：2026-05-25

## 0. 文档定位

- 本文档用于约束前端样式实现，目标是让 AI 与开发者产出一致。
- 本文档只保留可执行规则，不维护组件演示说明。
- 本文档是“前端落地规范”，用于指导代码实现与设计走查。
- 若本文档与主题源冲突，以主题源为准。

## 0.1 真源定义

- 主题变量真源：`theme.ts` 与 `css-var.css`。
- 变量命名分层：
- `--ty-*`：业务与主题语义变量。
- `--ty-ant-*`：组件库对 antd 的兼容映射变量。
- 规则：优先使用语义变量；若属于通用样式或当前变量体系未覆盖，可硬编码。
- 硬编码需满足：有明确业务语义、当前无可复用变量。

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

### 3.1 字体实现规则

- 默认不手动设置 `font-family`。
- 仅在特殊场景（品牌字、图表专用字、代码字体等）才允许显式设置字体，并需备注原因。

### 3.2 字号与字重规则

- 默认字号不显式设置；仅当与默认字号不一致时才设置。
- 非默认字号必须使用变量，不直接写死字号值。
- 字重优先使用变量：`--ty-ant-font-weight-strong`。
- 字号与行高必须成对使用，避免出现只改字号不改行高的情况。

推荐变量：

- `--ty-ant-font-size`、`--ty-ant-font-size-sm`、`--ty-ant-font-size-lg`、`--ty-ant-font-size-xl`
- `--ty-ant-font-size-heading-1` ~ `--ty-ant-font-size-heading-5`
- `--ty-ant-line-height`、`--ty-ant-line-height-sm`、`--ty-ant-line-height-lg`
- `--ty-ant-line-height-heading-1` ~ `--ty-ant-line-height-heading-5`
- `--ty-ant-font-height`、`--ty-ant-font-height-sm`、`--ty-ant-font-height-lg`

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

## 5. 全局样式约束

### 5.1 字体

- 默认不手动设置 `font-family`。
- 仅品牌字体、代码字体、图表专用字体等特殊场景可显式设置。

### 5.2 字号与行高

- 默认字号不显式设置。
- 非默认字号优先使用变量；变量未覆盖时允许硬编码。
- 字号与行高成对设置。

### 5.3 颜色

- 默认文本色不显式设置。
- 非默认颜色优先使用语义变量；变量未覆盖时允许硬编码。

### 5.4 间距

- `padding` / `margin` 使用间距变量。
- 不新增无语义的临时间距值。

### 5.5 圆角与阴影

- 圆角、阴影优先使用变量。
- 禁止在页面内散落同语义多套视觉值。

## 6. 主题变量基线（当前实现）

### 6.1 字体与间距

| Token | CSS 变量 | 默认值 |
| --- | --- | --- |
| `fontFamily` | `--ty-font-family` | `Helvetica Neue, Arial, Microsoft Yahei, PingFang, sans-serif` |
| `fontSize` | `--ty-font-size` | `12px` |
| `spacingXXS` | `--ty-spacing-xxs` | `4px` |
| `spacingXS` | `--ty-spacing-xs` | `8px` |
| `spacingSM` | `--ty-spacing-sm` | `12px` |
| `spacing` | `--ty-spacing` | `16px` |
| `spacingMD` | `--ty-spacing-md` | `20px` |
| `spacingLG` | `--ty-spacing-lg` | `24px` |
| `spacingXL` | `--ty-spacing-xl` | `32px` |
| `spacingXXL` | `--ty-spacing-xxl` | `48px` |

### 6.2 颜色（亮色 / 暗色）

| Token | CSS 变量 | 亮色主题 | 暗色主题 |
| --- | --- | --- | --- |
| `colorPrimary` | `--ty-color-primary` | `#1677ff` | `#1677ff` |
| `colorText` | `--ty-color-text` | `#172634` | `#172634` |
| `colorTextHeading` | `--ty-color-text-heading` | `#000000` | `rgba(255, 255, 255, 0.85)` |
| `colorTextLabel` | `--ty-color-text-label` | `#172634` | `rgba(255, 255, 255, 0.65)` |
| `colorTextDescription` | `--ty-color-text-description` | `#6f7782` | `rgba(255, 255, 255, 0.45)` |
| `colorTextPlaceholder` | `--ty-color-text-placeholder` | `#a7b1be` | `rgba(255, 255, 255, 0.25)` |
| `colorTextDisabled` | `--ty-color-text-disabled` | `#a7b1be` | `rgba(200, 201, 204, 0.30)` |
| `colorBgLayout` | `--ty-color-bg-layout` | `#f0f1f5` | `#000000` |
| `colorBgContainer` | `--ty-color-bg-container` | `#ffffff` | `#1F1F1F` |
| `colorBgContainerDisabled` | `--ty-color-bg-container-disabled` | `rgba(0, 0, 0, 0.04)` | `rgba(255, 255, 255, 0.08)` |
| `colorBgMask` | `--ty-color-bg-mask` | `rgba(0, 0, 0, 0.45)` | `rgba(0, 0, 0, 0.45)` |
| `colorBgTextActive` | `--ty-color-bg-text-active` | `rgba(174, 174, 174, 0.25)` | `rgba(174, 174, 174, 0.25)` |
| `colorBgTextHover` | `--ty-color-bg-text-hover` | `rgba(174, 174, 174, 0.25)` | `rgba(174, 174, 174, 0.15)` |
| `colorBorder` | `--ty-color-border` | `rgba(174, 174, 174, 0.45)` | `rgba(174, 174, 174, 0.45)` |
| `colorBorderSecondary` | `--ty-color-border-secondary` | `rgba(174, 174, 174, 0.25)` | `rgba(174, 174, 174, 0.25)` |
| `colorBorderBg` | `--ty-color-border-bg` | `#ffffff` | `#ffffff` |

### 6.3 其他基础变量

| Token | CSS 变量 | 默认值 |
| --- | --- | --- |
| `mainZIndex` | `--ty-main-zindex` | `201` |
| `iconColor` | `--ty-icon-color` | `#808182` |
| `boxShadow` | `--ty-box-shadow` | `0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)` |
| `boxShadowSecondary` | `--ty-box-shadow-secondary` | `0px 9px 10px 8px rgba(0,0,0,0.05), 0px 6px 4px 0px rgba(0,0,0,0.08)` |
| `boxShadowTertiary` | `--ty-box-shadow-tertiary` | `0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)` |

## 7. 开发落地清单（提交前自检）

- 是否删除了非必要 `font-family`。
- 是否移除了可继承的默认字号与默认字色。
- 非默认字号、颜色、间距、圆角、阴影是否优先使用语义变量。
- 若存在硬编码色值（如 `#xxx`、`rgba(...)`），是否属于变量未覆盖场景，且已评估可后续沉淀。
- 新增变量是否已在主题源登记。

## 8. 维护规则

- 主题改动流程：先改主题源，再同步本文档。
- 本文档不维护历史废弃值，不维护未落地的预研 token。
- 本文档用于知识库与 AI 输入，要求短、准、可执行。
