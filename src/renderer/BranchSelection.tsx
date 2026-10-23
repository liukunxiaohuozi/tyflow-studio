import { GitBranch } from "lucide-react";
import type { RepositoryInfo, Settings, TaskInput } from "../shared/contracts";
import { Field, Notice } from "./components";
import { I18nT } from "./i18n";

function suggestedBranch() {
  return `feat/studio-${new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14)}-${crypto.randomUUID().slice(0, 6)}`;
}

export default function BranchSelection({
  input,
  repo,
  disabled,
  settings,
  patch,
}: {
  input: TaskInput;
  repo?: RepositoryInfo;
  disabled: boolean;
  settings: Settings;
  patch: (value: Partial<TaskInput>) => void;
}) {
  const selectedRemote = repo?.remoteBranches?.find(
    (branch) => branch.ref === input.branch.base,
  );
  const selectedLocal =
    !selectedRemote || input.branch.mode === "existing"
      ? repo?.branchStates?.find(
          (branch) =>
            branch.name === (selectedRemote?.branch || input.branch.base),
        )
      : undefined;
  const setBranch = (branch: TaskInput["branch"]) => patch({ branch });
  return (
    <div className="branch-selection">
      <div className="inline-section-heading">
        <GitBranch size={17} />
        <div>
          <strong>{I18nT("开发分支", "Development branch")}</strong>
          <small>
            {I18nT(
              "评估和开发都基于这里选定的分支。",
              "Assessment and development both use this selected branch.",
            )}
          </small>
        </div>
      </div>
      <Notice>
        {I18nT(
          "代码直接修改到当前项目目录，开发完成后会显示在编辑器更改区；确认前不会提交或推送。同一项目的多个任务会依次排队执行。",
          "Code is edited directly in the current project, remains visible in the editor diff, and is not committed or pushed before confirmation. Multiple tasks for the same project run sequentially.",
        )}
      </Notice>
      {repo?.dirty && (
        <Notice tone="error">
          {I18nT(
            "工作区存在未提交修改，请先处理后再开始。客户端不会覆盖已有修改。",
            "The working tree has uncommitted changes. Resolve them before starting; existing work will not be overwritten.",
          )}
        </Notice>
      )}
      <fieldset className="branch-choice" disabled={disabled}>
        <div className="branch-modes">
          {(["new", "existing"] as const).map((mode) => (
            <label
              key={mode}
              className={input.branch.mode === mode ? "selected" : ""}
            >
              <input
                type="radio"
                name="branch-mode"
                checked={input.branch.mode === mode}
                onChange={() =>
                  setBranch({
                    ...input.branch,
                    mode,
                    base:
                      mode === "existing"
                        ? repo?.branch || input.branch.base
                        : input.branch.base,
                    name:
                      mode === "existing"
                        ? repo?.branch || input.branch.base
                        : suggestedBranch(),
                  })
                }
              />
              <span>
                <strong>
                  {mode === "new"
                    ? I18nT("新建分支", "Create branch")
                    : I18nT("使用已有分支", "Use existing branch")}
                </strong>
                <small>
                  {mode === "new"
                    ? I18nT("从所选基线创建", "Create from selected base")
                    : I18nT(
                        "直接在所选分支开发",
                        "Develop on selected branch",
                      )}
                </small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-row branch-fields">
        <Field
          label={
            input.branch.mode === "new"
              ? I18nT("基线分支", "Base branch")
              : I18nT("开发分支", "Development branch")
          }
        >
          <select
            disabled={!repo || disabled}
            value={input.branch.base}
            onChange={(event) =>
              setBranch({
                ...input.branch,
                base: event.target.value,
                ...(input.branch.mode === "existing"
                  ? {
                      name:
                        repo?.remoteBranches?.find(
                          (branch) => branch.ref === event.target.value,
                        )?.branch || event.target.value,
                    }
                  : {}),
              })
            }
          >
            <option value="">{I18nT("请选择分支", "Select a branch")}</option>
            <optgroup label={I18nT("本地分支", "Local branches")}>
              {repo?.branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                  {branch === repo.branch
                    ? ` (${I18nT("当前", "current")})`
                    : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label={I18nT("远程分支", "Remote branches")}>
              {repo?.remoteBranches
                ?.filter(
                  (branch) =>
                    !repo.syncRemote || branch.remote === repo.syncRemote,
                )
                .map((branch) => (
                  <option key={branch.ref} value={branch.ref}>
                    {branch.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </Field>
        {input.branch.mode === "new" && (
          <Field label={I18nT("新分支名称", "New branch name")}>
            <input
              disabled={disabled}
              placeholder="feature/my-change"
              value={input.branch.name}
              onChange={(event) =>
                setBranch({ ...input.branch, name: event.target.value })
              }
            />
          </Field>
        )}
      </div>
      {selectedRemote && input.branch.mode === "existing" && (
          <Notice>
            {I18nT(
              "将使用对应的本地跟踪分支：",
              "The matching local tracking branch will be used: ",
            )}
            {selectedRemote.branch}
          </Notice>
        )}
      {selectedLocal?.upstreamMissing && (
        <Notice tone="error">
          {I18nT(
            "上游分支已删除，请重新选择分支。",
            "The upstream branch was deleted. Choose another branch.",
          )}
        </Notice>
      )}
      {Boolean(selectedLocal?.ahead && selectedLocal?.behind) && (
        <Notice tone="error">
          {I18nT(
            "本地和远程已经分叉，请先自行处理。",
            "Local and remote histories diverged. Resolve them before starting.",
          )}
        </Notice>
      )}
      {(input.kind !== "bug" || input.workflowMode) && (
        <div className="test-setting">
          <span>
            <strong>{I18nT("验证策略由 Studio 自动决定", "Studio chooses the verification policy")}</strong>
            <small>
              {I18nT(
                "Codex 会结合意图、改动范围和风险选择 Skill 与测试深度。",
                "Codex selects skills and test depth from intent, scope, and risk.",
              )}
            </small>
          </span>
          <span className="subtle-code">
            {settings.agent.testSkill
              .replace(/\\/g, "/")
              .split("/")
              .slice(-2, -1)[0] || I18nT("测试 Skill", "Test skill")}
          </span>
        </div>
      )}
    </div>
  );
}
