# 观云 React 前端研发规范总览

## 文档元信息

- 文档定位：工程规范层的总入口，帮助快速定位结构、请求、质量和项目模板文档。
- 适用范围：新项目接入、工程治理、代码评审、workflow skill 读取。
- 推荐优先级：涉及工程规则时先读本文件，再按任务进入对应专题。
- 冲突处理：若与目标仓库真实实现冲突，以目标仓库为准。
- 最后更新时间：2026-05-25

## 阅读顺序

1. 先读本文件，判断任务属于哪一类。
2. 涉及开发环境、基础分支、基础 Tag 与需求分支创建时，读 [environment-and-branching.md](./environment-and-branching.md)。
3. 涉及发版、打 Tag、版本命名时，读 [tag-and-release.md](./tag-and-release.md)。
4. 涉及目录结构、路由、页面分层时，读 [structure-and-routing.md](./structure-and-routing.md)。
5. 涉及请求层、协议适配、页面状态时，读 [request-and-service.md](./request-and-service.md)。
6. 涉及编码质量、样式约束、提交流程时，读 [quality-and-delivery.md](./quality-and-delivery.md)。
7. 需要为具体项目补充仓库规则时，读 [project-standards-template.md](./project-standards-template.md)。
8. 需要完整公司级原文时，读 [engineering-full-reference.md](./engineering-full-reference.md)。

## 任务路由

| 任务类型 | 优先读取 | 需要时再补 |
| --- | --- | --- |
| 拿到需求、确认环境、找基础分支或基础 Tag | `environment-and-branching.md` | `project-standards-template.md` |
| 发版、打 Tag、版本命名 | `tag-and-release.md` | `engineering-full-reference.md` |
| 新项目搭建、目录规划 | `structure-and-routing.md` | `project-standards-template.md` |
| 页面开发、接口接入 | `request-and-service.md` | `structure-and-routing.md` |
| 重构、规范治理、代码评审 | `quality-and-delivery.md` | `engineering-full-reference.md` |
| 给具体仓库补项目规则 | `project-standards-template.md` | `engineering-full-reference.md` |

## 文件说明

- `environment-and-branching.md`：拿到需求后的环境判断、基础分支/Tag 确认、开发分支创建流程。
- `tag-and-release.md`：功能开发完成后的打 Tag、发版与版本命名规则。
- `structure-and-routing.md`：目录结构、页面分层、路由规范、状态管理边界。
- `request-and-service.md`：服务层收敛、协议类型、异常处理、页面状态机。
- `quality-and-delivery.md`：组件规范、性能、样式、i18n、测试门禁、提交流程。
- `project-standards-template.md`：项目级约定模板，不默认代表任何真实项目。
- `engineering-full-reference.md`：完整公司级规范原文。
