# 颜色、字体与图表配色

## 文档元信息

- 文档定位：聚焦颜色体系、字体规则、图表色板与数据类型配色。
- 适用范围：调色、改文案层级、图表分类取色、状态色校对。
- 推荐优先级：涉及视觉表达时优先读取。
- 冲突处理：若设计稿、主题源和真实页面存在冲突，以真实主题实现为准。
- 最后更新时间：2026-05-25

## 品牌色与交互色

- 主色：`#1677FF`
- Hover：`#4096FF`
- Active：`#0958D9`
- 禁用文字：`#C8C9CC`
- 禁用背景：`#EAEAEA`
- 禁用边框：`#DCDEE0`

## 语义色

- 成功：`#00B578`
- 警告：`#FF9000`
- 错误：`#FF3F25`
- 状态码规则：
  - 2xx：绿色
  - 小于 200 或 3xx：灰色
  - 4xx 及以上：红色

## 页面与中性色

- 页面通用底色：`#F0F1F5`
- 区域/卡片底色：`#FFFFFF`
- 浅背景：`#FAFAFA`、`#F9FAFB`、`#F7F8FA`
- 主要文字：`rgba(0,0,0,0.85)`
- 次级文字：`rgba(0,0,0,0.65)`
- 辅助文字：`rgba(0,0,0,0.45)`

## 图表色板

基础 10 色：

- `#5B8FF9`
- `#5AD8A6`
- `#5D7092`
- `#6DC8EC`
- `#945FB9`
- `#1E9493`
- `#FF99C3`
- `#CEEF7D`
- `#FFA382`
- `#F6BD16`

规则：

- 图表分类色只用于图表分类，不用于普通状态按钮。
- 需要完整扩展色板时，查 `design-full-reference.md` 或 `figma-design-reference.md`。

## 数据类型配色

- Database：`#5AD8A6`
- Code：`#1677FF`
- NoSQL：`#5D7092`
- External：`#9B7E7D`
- MQ：`#CF8D5C`
- Pool：`#6DC8EC`
- Network：`#A033EB`
- Gen AI：建议沿用 `#A033EB`

## 字体规则

- 默认不手动设置 `font-family`。
- 非默认字号必须使用变量，不直接写死字号。
- 字重优先使用变量，例如 `--ty-ant-font-weight-strong`。
- 字号与行高必须成对使用。

常用变量：

- `--ty-ant-font-size`、`--ty-ant-font-size-sm`、`--ty-ant-font-size-lg`、`--ty-ant-font-size-xl`
- `--ty-ant-line-height`、`--ty-ant-line-height-sm`、`--ty-ant-line-height-lg`
- `--ty-ant-font-size-heading-1` ~ `--ty-ant-font-size-heading-5`
