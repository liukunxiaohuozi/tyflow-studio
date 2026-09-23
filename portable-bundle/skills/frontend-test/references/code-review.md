# B 端代码审查

对所有 R1–R3 变更执行轻量自动审查。R3、CRITICAL/HIGH 发现、公共协议或大范围重构再要求人工审查。团队已有合并请求审查时复用，不创建重复审批。

## 检查维度

1. 需求与业务：实现是否对应 confirmed requirement/scenario/oracle；核心不一致映射到 B-03/B-04。
2. 接口：关键参数、业务状态、空值和响应映射；错误映射到 B-05/B-06。
3. 数据：时间、时区、单位、精度、排序、去重、聚合和跨视图一致性。
4. 状态：loading、empty、error、permission、timeout、retry、cancel、unknown enum。
5. 异步：过期请求、重复提交、取消、卸载后回调和幂等；错误结果映射到 B-09/B-10。
6. 权限：角色、租户、ID、敏感字段、UI 与直接 API；映射到 B-08。
7. 生命周期：timer、listener、observer、subscription、worker、Wujie/iframe 和缓存释放。
8. 性能：重复请求、N+1、全量扫描、重复渲染、大对象复制和主线程长任务。
9. 架构：页面不直接网络调用；DTO 不泄漏；service、mapper、hooks、store 和组件职责清楚。
10. 类型和规范：新增 any/as any/@ts-ignore、空值/unknown 收窄、i18n、组件复用和 token。
11. 可观测性：关键错误可见、HTTP 与业务错误可区分、日志不含敏感数据。
12. 测试：无 only/必测 skip、弱化断言、错误快照更新、复制实现作为 Oracle 或漏测变更行为。

## 结果规则

- CRITICAL/HIGH 且证据确认的本次问题为阻断。
- MEDIUM 只有在核心模块、权限、数据计算、公共组件、跨应用协议或造成错误结果时阻断；其他为告警。
- LOW 为建议。
- 启发式静态命中只是候选，未结合上下文和规则证据时不能直接判定产品失败。
- 每项 finding 记录 file、line、ruleId、severity、introduced、expected、actual、evidenceRefs 和 confidence。

## 人工审查触发

- 权限、租户、登录、敏感数据。
- 新增或修改写接口。
- 公共组件/SDK 或多个消费者。
- 主应用/微应用通信和 Wujie 生命周期。
- 核心指标计算、计费、告警和数据口径。
- 项目配置的大变更阈值被触发。
- 自动审查发现 CRITICAL/HIGH 或多个相关 MEDIUM。

人工结果记录 reviewer、decision、findings、acceptedRisks 和 evidenceRefs。缺少被要求的人工审查时，相关运行是 `INCOMPLETE`，不是通过。
