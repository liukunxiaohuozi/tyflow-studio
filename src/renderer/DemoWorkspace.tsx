import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { Settings, Task } from "../shared/contracts";
import { DemoSession } from "./demo";
import { Field, Modal, Notice } from "./components";
import { I18nT } from "./i18n";
import TaskEditor from "./TaskEditor";
import RunView from "./RunView";

function DemoPreview({ close }: { close: () => void }) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("all");
  const rules = [
    {
      name: I18nT("CPU 使用率过高", "High CPU usage"),
      enabled: true,
      threshold: "> 90%",
    },
    {
      name: I18nT("内存使用率过高", "High memory usage"),
      enabled: true,
      threshold: "> 85%",
    },
    {
      name: I18nT("CPU 持续负载", "Sustained CPU load"),
      enabled: false,
      threshold: "> 80%",
    },
  ];
  const filtered = rules.filter(
    (rule) =>
      rule.name.toLowerCase().includes(keyword.trim().toLowerCase()) &&
      (status === "all" || rule.enabled === (status === "enabled")),
  );
  return (
    <Modal
      title={I18nT("演示页面 · 告警规则", "Demo page · Alert rules")}
      close={close}
    >
      <Notice>
        {I18nT(
          "内置交互页面。试试输入 CPU、选择已启用，再重置；此页面使用演示数据。",
          "Built-in interactive page using sample data. Enter CPU, select Enabled, then reset.",
        )}
      </Notice>
      <div className="demo-filters">
        <Field label={I18nT("规则关键词", "Rule keyword")}>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="CPU"
          />
        </Field>
        <Field label={I18nT("启用状态", "Enabled status")}>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{I18nT("全部状态", "All statuses")}</option>
            <option value="enabled">{I18nT("已启用", "Enabled")}</option>
            <option value="disabled">{I18nT("已停用", "Disabled")}</option>
          </select>
        </Field>
        <button
          onClick={() => {
            setKeyword("");
            setStatus("all");
          }}
        >
          {I18nT("重置", "Reset")}
        </button>
      </div>
      <p role="status">
        {I18nT("匹配规则：", "Matching rules: ")}
        {filtered.length} / 3
      </p>
      <table className="demo-rule-table">
        <thead>
          <tr>
            <th>{I18nT("规则名称", "Rule name")}</th>
            <th>{I18nT("阈值", "Threshold")}</th>
            <th>{I18nT("状态", "Status")}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((rule) => (
            <tr key={rule.name}>
              <td>{rule.name}</td>
              <td>{rule.threshold}</td>
              <td>
                {rule.enabled
                  ? I18nT("已启用", "Enabled")
                  : I18nT("已停用", "Disabled")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!filtered.length && (
        <p className="empty">
          {I18nT(
            "没有匹配的规则，请调整条件或点击重置。",
            "No matching rules. Adjust the filters or reset.",
          )}
        </p>
      )}
      <div className="demo-preview-actions">
        <button className="primary" onClick={close}>
          {I18nT("返回演示流程", "Back to the demo")}
        </button>
      </div>
    </Modal>
  );
}

export default function DemoWorkspace({
  settings,
  report,
}: {
  settings: Settings;
  report: (message: string, error?: boolean) => void;
}) {
  const initialSettings = useRef(settings);
  const [session, setSession] = useState<DemoSession>();
  const [task, setTask] = useState<Task>();
  const [restart, setRestart] = useState(0);
  const [preview, setPreview] = useState(false);
  const [snapshot, setSnapshot] = useState(false);
  useEffect(() => {
    const next = new DemoSession(initialSettings.current, () =>
      setPreview(true),
    );
    setSession(next);
    setTask(next.getTask());
    setPreview(false);
    setSnapshot(false);
    const unsubscribe = next.subscribe(setTask);
    return () => {
      unsubscribe();
      next.dispose();
    };
  }, [restart]);
  if (!session || !task) return null;
  return (
    <div className="demo-workspace">
      <div className="demo-banner">
        <div>
          <strong>
            {I18nT("演示模式 · 全流程体验", "Demo mode · Full walkthrough")}
          </strong>
          <p>
            {I18nT(
              "计划、进度、测试与日志均为模拟；不调用 AI、不修改真实项目、不写入需求记录。",
              "Plans, progress, tests and logs are simulated. No AI calls, real project changes or saved task records.",
            )}
          </p>
        </div>
        <button onClick={() => setRestart((value) => value + 1)}>
          <RotateCcw size={14} />
          {I18nT("重新演示", "Restart demo")}
        </button>
      </div>
      {task.snapshot ? (
        <RunView
          key={restart}
          task={task}
          api={session.api}
          simulated
          onTask={setTask}
          report={report}
          edit={() => setSnapshot(true)}
        />
      ) : (
        <TaskEditor
          key={restart}
          task={task}
          api={session.api}
          simulated
          settings={session.settings}
          onTask={setTask}
          report={report}
          openSettings={() =>
            report(
              I18nT(
                "演示环境已准备好，无需配置仓库或账号。",
                "The demo is ready; no repository or account setup is needed.",
              ),
            )
          }
        />
      )}
      {preview && <DemoPreview close={() => setPreview(false)} />}
      {snapshot && (
        <Modal
          title={I18nT("演示需求快照", "Demo requirement snapshot")}
          close={() => setSnapshot(false)}
        >
          <h3>{task.title}</h3>
          <p className="prewrap">{task.snapshot?.description}</p>
        </Modal>
      )}
    </div>
  );
}
