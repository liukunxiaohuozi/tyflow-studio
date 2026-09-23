# 观云 React 前端知识库入口

## 文档元信息

- 文档定位：给 AI 和 workflow skill 使用的总入口。
- 适用范围：接手观云 React 前端任务时的首次读取。
- 推荐优先级：优先先读本文件，再按任务类型跳转。
- 冲突处理：目标仓库真实代码 > 项目输入 > 本知识库。
- 最后更新时间：2026-05-26

## 使用规则

1. 先判断任务类型。
2. 拿到需求先确认开发环境、交付形态和分支来源；这一步优先查看 `engineering/project-standards-template.md`。
3. 如果任务还没开始开发，优先先判断是 `SaaS` 还是私有化，并找到基础分支或基础 Tag。
4. 只读取 1 到 2 份最相关文档，不要整库加载。
5. 术语不明确时先读 [glossary.md](./glossary.md)。

## 任务路由

| 任务类型 | 先读 | 再补 |
| --- | --- | --- |
| 拿到需求、确认开发环境、找基础分支或基础 Tag | `engineering/environment-and-branching.md` | `engineering/project-standards-template.md` |
| 发版、打 Tag、确认版本命名 | `engineering/tag-and-release.md` | `engineering/engineering-full-reference.md` |
| 新项目接入、工程治理、代码评审 | `engineering/engineering-overview.md` | `engineering/engineering-full-reference.md` |
| 页面目录、状态组织、样式落位、项目约定 | `engineering/project-standards-template.md` | `engineering/structure-and-routing.md` |
| 接口接入、服务层、请求状态 | `engineering/request-and-service.md` | `engineering/engineering-full-reference.md` |
| 视觉还原、样式补全、设计走查 | `design/design-overview.md` | `design/figma-design-reference.md` |
| token、主题变量、颜色值 | `design/design-tokens-and-theme.md` | `design/design-full-reference.md` |
| 布局、间距、圆角、阴影 | `design/layout-and-spacing.md` | `design/design-full-reference.md` |
| 组件选型、二次封装、复用判断 | `components/component-reuse-overview.md` | `components/component-selection-flow.md` |
| 查具体组件能力和导出项 | `components/component-library-index.md` | `components/component-reuse-overview.md` |

## 目录

```text
engineering/  工程规范、项目模板、请求与质量规则
design/       设计落地规则、token、Figma 来源摘录
components/   组件复用流程、组件能力索引
```

## 文档索引

- `engineering/engineering-overview.md`：工程规范入口，负责把任务继续路由到工程专题文档。
- `engineering/environment-and-branching.md`：拿到需求后的环境确认、基础分支/Tag 确认、需求分支创建 SOP。
- `engineering/tag-and-release.md`：功能开发完成后的打 Tag、发版与版本命名规则。
- `engineering/project-standards-template.md`：项目级约定模板，覆盖开工前确认、样式落位、项目命令口径等。
- `engineering/structure-and-routing.md`：目录结构、页面落位、路由规范、状态边界。
- `engineering/request-and-service.md`：请求层、服务层、协议适配、页面状态机。
- `engineering/quality-and-delivery.md`：编码质量、样式规则摘要、测试门禁、提交流程。
- `engineering/engineering-full-reference.md`：公司级工程规范完整参考。

- `design/design-overview.md`：设计规范入口，负责把样式问题继续路由到具体专题。
- `design/design-tokens-and-theme.md`：主题变量、token、颜色值、亮暗主题差异。
- `design/typography-and-color.md`：字体、字号、文本颜色、图表配色。
- `design/layout-and-spacing.md`：间距、圆角、阴影、布局规则。
- `design/implementation-checklist.md`：设计落地自检清单。
- `design/design-full-reference.md`：设计落地规范完整参考。
- `design/figma-design-reference.md`：Figma 设计来源摘录，用于交叉确认。

- `components/component-reuse-overview.md`：组件复用入口，先判断该复用什么。
- `components/component-selection-flow.md`：组件选型流程和常见场景决策。
- `components/component-library-index.md`：组件库能力索引、导出项和已确认能力摘录。

- `glossary.md`：术语表，统一“观云 / 听云 / Tingyun / 项目级约定 / 主题源”等叫法。

## 读取顺序

- 页面开发：`engineering/environment-and-branching.md` -> `engineering/project-standards-template.md` -> `engineering/request-and-service.md` -> 按需补 `design/` 或 `components/`
- 发版打 Tag：`engineering/tag-and-release.md` -> 按需补 `engineering/environment-and-branching.md`
- 样式修改：`engineering/project-standards-template.md` -> `design/design-overview.md` -> 按需补具体专题
- 组件接入：`components/component-reuse-overview.md` -> `components/component-selection-flow.md` -> `components/component-library-index.md`

## 冲突优先级

1. 用户当前明确指令
2. 目标仓库真实代码、主题变量、组件封装、现有页面行为
3. PRD、Figma、联调约束
4. 项目级文档
5. 公司级文档
