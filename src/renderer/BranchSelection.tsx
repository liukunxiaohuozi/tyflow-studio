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
      <Field label={I18nT("任务工作区", "Task workspace")}>
        <select
          disabled={disabled}
          value={input.workspaceMode ?? "current"}
          onChange={(event) =>
            patch({
              workspaceMode: event.target.value as TaskInput["workspaceMode"],
            })
          }
        >
          <option value="isolated">
            {I18nT(
              "独立工作区（支持并行）",
              "Isolated workspace (parallel tasks)",
            )}
          </option>
          <option value="current">
            {I18nT("当前项目目录", "Current project directory")}
          </option>
        </select>
      </Field>
      {input.workspaceMode === "isolated" && (
        <Notice>
          {I18nT(
            "从已提交版本创建独立目录和任务分支；原目录未提交代码不会带入。选择已有分支时，将以它为基线创建任务分支，验收后推送任务分支。验证项目按需启动，不会自动打开多个窗口。",
            "Create an isolated directory and task branch from committed code. Uncommitted source changes are excluded. An existing branch becomes the baseline; acceptance pushes the separate task branch. Previews start on demand.",
          )}
        </Notice>
      )}
      {repo?.dirty && input.workspaceMode !== "isolated" && (
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
                    : input.workspaceMode === "isolated"
                      ? I18nT(
                          "已有分支作为基线",
                          "Use an existing branch as baseline",
                        )
                      : I18nT("使用已有分支", "Use existing branch")}
                </strong>
                <small>
                  {mode === "new"
                    ? I18nT("从所选基线创建", "Create from selected base")
                    : input.workspaceMode === "isolated"
                      ? I18nT(
                          "从所选版本创建独立任务分支",
                          "Create a task branch from the selected version",
                        )
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
            input.branch.mode === "new" || input.workspaceMode === "isolated"
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
      {selectedRemote &&
        input.branch.mode === "existing" &&
        input.workspaceMode !== "isolated" && (
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
      {input.kind !== "bug" && (
        <div className="test-setting">
          <label className="checkbox">
            <input
              type="checkbox"
              disabled={disabled}
              checked={input.autoTest}
              onChange={(event) => patch({ autoTest: event.target.checked })}
            />
            <span>
              <strong>
                {I18nT("自动化测试介入", "Include automated testing")}
              </strong>
              <small>
                {I18nT(
                  "开发后执行测试 Skill，结果与日志进入本次记录。",
                  "Run the testing skill after development and retain its results and logs.",
                )}
              </small>
            </span>
          </label>
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
