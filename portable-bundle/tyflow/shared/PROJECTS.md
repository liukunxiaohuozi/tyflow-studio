# Tyflow 项目

## o11y-apm-ui

- 本地路径：`C:\Users\tingyun\Desktop\project\o11y-apm-ui`
- 包名：`guanyun-apm-web`
- 描述：APM
- 技术栈：React 18, Umi Max, Ant Design 5, TypeScript, ECharts, G6
- 启动命令：`npm run start:dev`
- 构建命令：`npm run build`
- 测试命令：`npm run test`
- Lint 命令：`npm run lint`
- 类型检查：`npm run tsc`
- 组件搜索根目录：
  - `src`
  - `src/components`
  - `src/pages`
  - `docs`
- 备注：
  - 使用 `@ty-sdk/components`。
  - 使用 `echarts` 和 `echarts-for-react`。
  - 图表应作为 ECharts 数据驱动组件处理，不做成静态 SVG。

## explore

- 本地路径：`C:\Users\tingyun\Desktop\project\explore`
- 包名：`guanyun-explore-web`
- 描述：观云数据探索前端
- 技术栈：React 18, Umi Max, Ant Design 5, TypeScript, ECharts, G6, D3
- 启动命令：`npm run start:dev`
- 构建命令：`npm run build`
- 测试命令：`npm run test`
- Lint 命令：`npm run lint`
- 类型检查：`npm run tsc`
- 组件搜索根目录：
  - `src`
  - `src/components`
  - `src/pages`
  - `docs`
  - `mock`
- 备注：
  - 使用 `@ty-sdk/components`。
  - 使用 `echarts` 和 `echarts-for-react`。
  - 包含较重的数据探索交互，优先复用已有本地模式。

## config

- 本地路径：`C:\Users\tingyun\Desktop\project\config`
- 包名：`guanyun-config-web`
- 描述：观云配置前端
- 技术栈：React 18, Umi Max 4, Ant Design 5, TypeScript, @ty-sdk/components
- 包管理器：npm（仓库同时存在 npm/pnpm 锁文件，以当前已安装依赖和 npm scripts 为准）
- 启动命令：`npm run start:dev`
- 构建命令：`npm run build`
- 测试命令：`npm run test`
- 测试覆盖率命令：`npm run test:coverage`
- Lint 命令：`npm run lint`（会执行带 `--write` 的 prettier，验证时优先使用目标文件 ESLint + Prettier check）
- 类型检查：`npm run tsc`
- E2E 状态：未配置
- 组件搜索根目录：
  - `src`
  - `src/components`
  - `src/pages`
  - `src/services`
- 备注：
  - 使用 `@ty-sdk/components` 和 Ant Design 5。
  - 当前 TypeScript 基线存在 `@types/d3-dispatch@3.0.7` 与 TypeScript 4.9 的既有语法兼容错误，按增量基线判定。

## rum-web

- 本地路径：`<本机 rum-web 仓库路径>`（占位符：每位研发改成自己机器上的实际路径，例如 `C:\Users\<用户名>\Desktop\project\rum-web`；原先误填了其他同事的 macOS 路径，已移除）
- 包名：`rum-web`
- 描述：RUM（Real User Monitoring）前端
- 技术栈：React 18, Umi Max 4, Ant Design 5, TypeScript, ECharts
- 包管理器：pnpm
- 启动命令：`npm run dev`
- 构建命令：`npm run build`
- 测试命令：`npm test`
- 测试覆盖率命令：`npm run test:coverage`
- 测试 watch 命令：`npm run test:watch`
- 类型检查：`npx tsc --noEmit`
- E2E 状态：**未配置**（待选型 Playwright vs Cypress；Tyflow 在该项目执行 E2E 类规则时直接跳过并在 VERIFY.md 中如实记录“E2E 未配置”，不得伪装通过）
- 组件搜索根目录：
  - `src`
  - `src/components`
  - `src/pages`
  - `src/utils`
- 备注：
  - 测试栈：Jest 29 + ts-jest + @testing-library/react，配置在 `jest.config.js`。
  - `jest.config.js` 已处理 lodash-es ESM 与 pnpm 嵌套路径，新加依赖若是 ESM 包需要再补 `transformIgnorePatterns`。
  - 全局 mock 在 `src/setupTests.js`（localStorage/matchMedia/ResizeObserver/IntersectionObserver）。
  - 覆盖率阈值已设 50%（Branches/Functions/Lines/Statements），新项目状态下未达标属预期；阈值升级走渐进策略，不一刀切。

## tyChatAi

- 本地路径：`C:\Users\tingyun\Desktop\project\tyChatAi`
- 包名：`@ty-sdk/chat_ai`
- 描述：观云 AI 聊天组件库
- 技术栈：React 18, TypeScript 4.7, Ant Design 5, SSE, Father, Dumi
- 包管理器：npm
- 启动命令：`npm run dev`
- 构建命令：`npm run build`
- 测试命令：未配置
- Lint 命令：`npm run lint`
- 类型检查：`npx tsc --noEmit`
- E2E 状态：未配置
- 组件搜索根目录：
  - `src`
  - `src/TyAiChat/components`
  - `src/TyAiChat/utils`
- 备注：
  - 当前 TypeScript 基线存在 `@types/d3-dispatch@3.0.7` 与 TypeScript 4.7 的 9 个既有语法兼容错误，按增量基线判定。
  - 当前未配置 Jest / Testing Library；不能伪装自动化测试通过。
