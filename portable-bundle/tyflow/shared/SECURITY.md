# Tyflow 安全与脱敏策略

目标：把"靠人/AI 自觉检查 6 个关键词"升级为**机器强制**，因为工作流从个人用扩大到全研发团队后，凭证泄露风险显著放大。

## 两道防线

### 防线 1：写入 `.tyflow` 前——AI 敏感信息自查

`.tyflow` 本身不是 git 仓库，敏感信息主要风险是被沉淀进 `shared/` 或 `requirements/`（随工作流分享出去）。因此这是 **AI 在流程内必须执行的自查动作**（不依赖任何外部脚本）：

- 每次向 `shared`、`requirements/<id>/`、`INTEGRATION.md` 写入内容前，AI 先**逐条通读待写入文本**。
- 命中以下任一即**先脱敏再写入**，绝不直接落盘：
  - `token` / `cookie` / `Authorization` / `Bearer` / `session` / `Set-Cookie`
  - JWT（`eyJ...` 三段式）、私钥块（`-----BEGIN ... PRIVATE KEY-----`）
  - 自定义认证头（`X-*-Token` / `X-*-Key` 等）带值
  - URL 查询串里的 `token` / `access_token` / `sign` / `ak` / `sk`
  - 原始 cURL、未脱敏响应、客户敏感数据、仅本机有效的临时路径
- 长 hex / base64 串若疑似编码后的凭证，存疑即按敏感处理。

### 防线 2：目标项目提交前——gitleaks pre-commit

真正的代码仓库（`explore`、`o11y-apm-ui`、`rum-web` 等）应在仓库侧拦截，不依赖 Tyflow：

- 在每个目标项目接入 [gitleaks](https://github.com/gitleaks/gitleaks) 的 `pre-commit` 钩子。
- 推荐用 `pre-commit` 框架或 husky 挂载。示例（`.pre-commit-config.yaml`）：

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

- CI 流水线再加一道 `gitleaks detect` 作为兜底，防止本地钩子被绕过。

## 禁止落入 `shared` 的内容（与 RULES.md 一致）

原始 cURL、token、cookie、Authorization、Bearer、session、Set-Cookie、私密请求头、未脱敏响应、客户敏感数据、仅本机有效的临时路径、JWT、API Key / Access Key / Secret Key、URL 查询串中的凭证。

## 允许沉淀的内容

脱敏后的接口用途、请求方法、必要参数含义、响应字段含义、字段转换规则、错误处理经验、验证方式。

## 联调期的临时凭证

- 原始 cURL / token 只用于当前联调内存中使用，**不写入任何文件**。
- 联调结论只把「脱敏后的映射 + 验证结果」写入对应需求的 `INTEGRATION.md`。
- 见 `DECISIONS.md`（2026-04-28 cURL 处理）。
