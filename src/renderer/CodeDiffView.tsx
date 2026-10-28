import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, FileDiff, Loader2 } from "lucide-react";
import type { CodeDiff, StudioAPI, Task } from "../shared/contracts";
import { splitCodeDiff } from "./code-diff";
import { I18nT } from "./i18n";

const changeLabels: Record<CodeDiff["files"][number]["changeType"], string> = {
  added: "新增",
  deleted: "删除",
  modified: "修改",
  renamed: "重命名",
  untracked: "新增",
  unknown: "变更",
};

export default function CodeDiffView({
  api,
  task,
  back,
  report,
}: {
  api: StudioAPI;
  task: Task;
  back: () => void;
  report: (message: string, error?: boolean) => void;
}) {
  const [diff, setDiff] = useState<CodeDiff>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    void api
      .codeDiff(task.id)
      .then((value) => {
        if (active) setDiff(value);
      })
      .catch((reason: Error) => {
        if (!active) return;
        setError(reason.message);
        report(reason.message, true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, report, task.id]);

  return (
    <div className="code-diff-page">
      <header className="code-diff-header">
        <button className="code-diff-back" onClick={back}>
          <ArrowLeft size={18} />
          {I18nT("返回任务", "Back to task")}
        </button>
        <div>
          <div className="eyebrow">{I18nT("代码审查", "Code review")}</div>
          <h1>{I18nT("代码对比", "Code comparison")}</h1>
          <p>{task.title}</p>
        </div>
        {diff && (
          <span className="code-diff-count">
            {diff.files.length} {I18nT("个文件", "files")}
          </span>
        )}
      </header>
      {loading ? (
        <div className="code-diff-state">
          <Loader2 className="spin" size={22} />
          {I18nT("正在读取任务改动…", "Loading task changes…")}
        </div>
      ) : error ? (
        <div className="code-diff-state danger">{error}</div>
      ) : !diff?.files.length ? (
        <div className="code-diff-state">
          {I18nT(
            "当前任务没有可展示的代码改动。",
            "No code changes to show for this task.",
          )}
        </div>
      ) : (
        <div className="code-diff-files">
          {diff.files.map((file, index) => (
            <DiffFile
              key={`${file.path}-${index}`}
              file={file}
              open={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DiffFile({
  file,
  open,
}: {
  file: CodeDiff["files"][number];
  open: boolean;
}) {
  const rows = useMemo(
    () => splitCodeDiff(file.before, file.after),
    [file.after, file.before],
  );
  return (
    <details className="code-diff-file" open={open}>
      <summary>
        <ChevronDown className="code-diff-chevron" size={17} />
        <FileDiff size={17} />
        <code>{file.path}</code>
        <span className={`code-diff-kind kind-${file.changeType}`}>
          {changeLabels[file.changeType]}
        </span>
      </summary>
      {file.binary ? (
        <div className="code-diff-note">
          {I18nT(
            "二进制文件不支持文本对比。",
            "Binary files cannot be compared as text.",
          )}
        </div>
      ) : (
        <div className="code-diff-table-wrap">
          {file.truncated && (
            <div className="code-diff-note">
              {I18nT(
                "文件较大，仅展示可安全加载的部分。",
                "Large file; showing the safely loadable portion only.",
              )}
            </div>
          )}
          <div className="code-diff-table">
            <div className="code-diff-column-title">
              {I18nT("修改前", "Before")}
            </div>
            <div className="code-diff-column-title">
              {I18nT("修改后", "After")}
            </div>
            {rows.map((row, index) => (
              <div className={`code-diff-row row-${row.kind}`} key={index}>
                <div className="code-diff-cell old">
                  <span>{row.beforeLine ?? ""}</span>
                  <code>{row.before ?? ""}</code>
                </div>
                <div className="code-diff-cell new">
                  <span>{row.afterLine ?? ""}</span>
                  <code>{row.after ?? ""}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </details>
  );
}
