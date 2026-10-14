import { useState } from "react";
import type { StudioAPI, Task } from "../shared/contracts";
import { Modal, Notice } from "./components";
import { I18nT } from "./i18n";
export default function SupplementDialog({
  api,
  task,
  onTask,
  report,
  close,
}: {
  api: StudioAPI;
  task: Task;
  onTask: (task: Task) => void;
  report: (message: string, error?: boolean) => void;
  close: () => void;
}) {
  const [text, setText] = useState("");
  const [assets, setAssets] = useState<Task["assets"]>([]);
  const [busy, setBusy] = useState(false);
  const resume =
    ["failed", "stopped"].includes(task.status) &&
    task.failure?.checkpointId !== "delivery:push";
  async function upload() {
    setBusy(true);
    try {
      const incoming = await api.importFiles("attachment");
      setAssets((old) => [
        ...old,
        ...incoming.filter((a) => !old.some((b) => a.id === b.id)),
      ]);
    } catch (error) {
      report((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!text.trim() && !assets.length) {
      report(
        I18nT("请填写补充说明或添加附件。", "Add details or attachments."),
        true,
      );
      return;
    }
    setBusy(true);
    try {
      onTask(
        await api.taskAction(task.id, resume ? "retry" : "supplement", {
          supplement: { text, assetIds: assets.map((a) => a.id) },
        }),
      );
      close();
    } catch (error) {
      report((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={I18nT("追加阶段信息", "Add stage context")}
      close={() => !busy && close()}
    >
      <div className="supplement-modal">
        <Notice>
          {I18nT(
            "已有代码、日志和检查点保留。补充信息用于当前阶段，不会扩大已批准需求范围；新增功能请新建任务。未执行的计划补充后需要重新评估和确认。",
            "Code, logs and checkpoints are retained. Context does not expand approved scope; create a new task for new features. A plan not yet executed requires reassessment and approval after supplementation.",
          )}
        </Notice>
        <label className="field">
          <span>{I18nT("补充说明", "Additional details")}</span>
          <textarea
            autoFocus
            rows={7}
            maxLength={8000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button disabled={busy} onClick={() => void upload()}>
          {I18nT("添加截图、日志或文本", "Attach screenshots, logs, or text")}
        </button>
        <ul className="supplement-assets">
          {assets.map((a) => (
            <li key={a.id}>
              {a.name}
              <button
                disabled={busy}
                onClick={() =>
                  setAssets((old) => old.filter((b) => b.id !== a.id))
                }
              >
                {I18nT("移除", "Remove")}
              </button>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button disabled={busy} onClick={close}>
            {I18nT("取消", "Cancel")}
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {resume
              ? I18nT("保存补充并继续当前阶段", "Save and resume current stage")
              : I18nT("保存补充信息", "Save additional context")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
