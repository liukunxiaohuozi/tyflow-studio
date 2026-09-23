# 前端设计规范总览

## 文档元信息

- 文档定位：设计规范层的总入口，负责把视觉实现任务路由到颜色字体、主题变量、间距布局和自检清单。
- 适用范围：视觉还原、样式修正、设计走查、workflow skill 接入。
- 推荐优先级：涉及样式实现时先读本文件。
- 冲突处理：若与主题源或目标仓库真实样式实现冲突，以真实实现为准。
- 最后更新时间：2026-05-25

## 阅读顺序

1. 先读本文件，判断当前问题属于颜色字体、token、布局间距还是提交前自检。
2. 主题变量、真源和全局样式，读 [design-tokens-and-theme.md](./design-tokens-and-theme.md)。
3. 颜色、字号、字重、图表色板，读 [typography-and-color.md](./typography-and-color.md)。
4. 圆角、阴影、间距与页面布局，读 [layout-and-spacing.md](./layout-and-spacing.md)。
5. 提交前自检和维护要求，读 [implementation-checklist.md](./implementation-checklist.md)。
6. 需要完整规则原文时，读 [design-full-reference.md](./design-full-reference.md)。
7. 需要追溯设计来源时，读 [figma-design-reference.md](./figma-design-reference.md)。

## 任务路由

| 任务类型 | 优先读取 | 需要时再补 |
| --- | --- | --- |
| 改 token、主题色、主题变量 | `design-tokens-and-theme.md` | `design-full-reference.md` |
| 调颜色、字号、图表配色 | `typography-and-color.md` | `figma-design-reference.md` |
| 调卡片、边框、阴影、间距 | `layout-and-spacing.md` | `design-full-reference.md` |
| 提交前视觉自检 | `implementation-checklist.md` | `design-full-reference.md` |

## 分层说明

- `design-full-reference.md`：完整落地规范原文，适合精读或查细节。
- `figma-design-reference.md`：来源摘录，不替代落地规范。
- 其他专题文档：为 AI 与人快速定位规则做的拆分层。
