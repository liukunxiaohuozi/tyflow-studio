# config 项目错题本

最后核验：2026-07-15

## 当前工程基线

- `npm run lint` 会继续执行 `lint:prettier`，而该脚本带 `--write`。只做验证时使用目标文件 `npx eslint --no-cache <files>`，并单独执行不写文件的 Prettier check，避免制造无关格式改动。
- `npm run tsc` 当前有 9 个既有语法错误，均来自 `node_modules/.pnpm/@types+d3-dispatch@3.0.7/.../index.d.ts` 与 TypeScript 4.9 的兼容问题。需求验证采用改动前后增量基线，不把该历史错误误判为本次引入。
- `EntityTag` 页面沿用 `config-page-container`、`header-box`、`detail-box` 等全局布局类；新增局部布局样式应放在页面目录并限制作用域。
- config 的 Jest/TSX 转换可能移除“只为 JSX 存在”的 React 默认导入，导致运行时 `React is not defined`。这类组件测试优先使用显式 `React.createElement`，并只 mock 第三方边界。

## 本次需求约束

- 权限标签属于权限与数据范围逻辑，字段和接口语义不明确时暂停，不在页面中编造兼容字段。
- 用户已明确实体选择使用 Ant Design `Transfer`；跨项目树形穿梭组件只作参考，不复制。
