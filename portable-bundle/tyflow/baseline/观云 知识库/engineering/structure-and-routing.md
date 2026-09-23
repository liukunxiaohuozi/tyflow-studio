# 工程结构、路由与状态

## 文档元信息

- 文档定位：沉淀观云 React 前端项目在目录结构、页面落位、路由组织和状态边界上的通用规则。
- 适用范围：新页面开发、目录规划、路由设计、状态拆分。
- 推荐优先级：做页面级改动时优先阅读。
- 冲突处理：若目标仓库已有成熟结构，以目标仓库为准。
- 最后更新时间：2026-05-25

## 推荐目录分层

- `src/pages`：页面路由组件与页面编排逻辑。
- `src/components`：跨页面可复用组件。
- `src/services`：接口请求封装与协议适配。
- `src/models` 或 `src/store`：全局共享状态。
- `src/utils`：纯函数工具与通用方法。
- `src/hooks`：可复用 hooks。
- `src/locales`：国际化词条。
- `src/constants`：常量、枚举、映射关系。

## 页面目录模板

```text
src/pages/<domain>/
  index.tsx
  config.ts
  components/
    XxxPanel/
      component.tsx
      index.ts
  hooks/
  utils/
  styles.less
```

## 路由与页面规范

- 路由统一集中管理，例如 `config/routes.ts`。
- 页面入口统一使用 `index.tsx`。
- 同类详情页尽量统一交互模式，避免一个页面用抽屉、另一个页面用独立详情页。
- 页面必须考虑 `loading / empty / error / no-permission` 四类基础状态。

## 状态管理边界

- 本地状态优先：能在组件内解决，不上提全局。
- 全局状态最小化：只保存跨页面共享且高复用数据。
- 命名要有业务语义，避免 `data/list/info/temp` 这类弱命名。

## 何时读项目模板

- 需要给具体仓库补“页面目录怎么放、样式落哪、组件怎么命名”的项目级规则时，再读 [project-standards-template.md](./project-standards-template.md)。
