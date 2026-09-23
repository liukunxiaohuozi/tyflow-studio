import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";
import type { Settings, Task } from "../shared/contracts";
import { Empty, Status, statusLabel } from "./components";
import { I18nT } from "./i18n";
export default function Records({
  tasks,
  settings,
  open,
  create,
}: {
  tasks: Task[];
  settings: Settings;
  open: (task: Task) => void;
  create: () => void;
}) {
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(
    () =>
      [...tasks]
        .filter(
          (t) =>
            (!query ||
              `${t.title} ${t.description}`
                .toLowerCase()
                .includes(query.toLowerCase())) &&
            (!project || t.projectId === project) &&
            (!kind || t.kind === kind) &&
            (!status || t.status === status),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [tasks, query, project, kind, status],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pageCount);
  const metrics = [
    { value: tasks.length, label: I18nT("全部任务", "All tasks") },
    {
      value: tasks.filter((t) =>
        ["analyzing", "developing", "testing", "starting"].includes(t.status),
      ).length,
      label: I18nT("正在执行", "Running"),
    },
    {
      value: tasks.filter((t) =>
        ["ready", "review", "waiting-test"].includes(t.status),
      ).length,
      label: I18nT("待处理", "Needs attention"),
    },
    {
      value: tasks.filter((t) => t.status === "accepted").length,
      label: I18nT("已验收", "Accepted"),
    },
  ];
  return (
    <>
      <header className="page-heading">
        <div>
          <div className="eyebrow">
            {I18nT("工作台 / 需求记录", "Workspace / Requirement records")}
          </div>
          <h1>{I18nT("需求记录", "Requirement records")}</h1>
          <p>
            {I18nT(
              "每一次需求、设计交付和 Bug 修复，都有完整记录。",
              "A complete record of every requirement, design delivery and bug fix.",
            )}
          </p>
        </div>
        <div className="page-heading-actions">
          <button className="primary" onClick={create}>
            <Plus size={16} />
            {I18nT("新建任务", "New task")}
          </button>
        </div>
      </header>
      <div className="metrics" aria-label={I18nT("任务概况", "Task overview")}>
        {metrics.map((m) => (
          <div key={m.label}>
            <strong>{m.value}</strong>
            <span>{m.label}</span>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="filters record-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label={I18nT("搜索需求", "Search requirements")}
              placeholder={I18nT(
                "搜索任务名称或需求内容",
                "Search task name or description",
              )}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label={I18nT("筛选项目", "Filter project")}
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{I18nT("全部项目", "All projects")}</option>
            {settings.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label={I18nT("筛选类型", "Filter type")}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{I18nT("全部类型", "All types")}</option>
            <option value="design">OpenDesign</option>
            <option value="text">{I18nT("文字需求", "Text request")}</option>
            <option value="bug">Bug</option>
          </select>
          <select
            aria-label={I18nT("筛选状态", "Filter status")}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{I18nT("全部状态", "All statuses")}</option>
            {Array.from(new Set(tasks.map((t) => t.status))).map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        {filtered.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{I18nT("任务", "Task")}</th>
                    <th>{I18nT("项目", "Project")}</th>
                    <th>{I18nT("状态", "Status")}</th>
                    <th>{I18nT("更新时间", "Updated")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .slice((current - 1) * 10, current * 10)
                    .map((task) => (
                      <tr key={task.id} onClick={() => open(task)}>
                        <td>
                          <button
                            className="record-title text-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              open(task);
                            }}
                          >
                            {task.title}
                          </button>
                          <small>
                            {task.kind === "design"
                              ? "OpenDesign"
                              : task.kind === "bug"
                                ? "Bug"
                                : I18nT("文字需求", "Text request")}
                          </small>
                        </td>
                        <td>
                          {settings.projects.find(
                            (p) => p.id === task.projectId,
                          )?.name || task.projectId}
                        </td>
                        <td>
                          <Status status={task.status} />
                        </td>
                        <td className="date-cell">
                          {new Date(task.updatedAt).toLocaleString()}
                        </td>
                        <td>
                          <ArrowRight size={16} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {filtered.length} {I18nT("条记录", "records")}
              </span>
              <div className="actions">
                <button
                  disabled={current === 1}
                  aria-label={I18nT("上一页", "Previous page")}
                  onClick={() => setPage(current - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {current} / {pageCount}
                </span>
                <button
                  disabled={current === pageCount}
                  aria-label={I18nT("下一页", "Next page")}
                  onClick={() => setPage(current + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title={
              tasks.length
                ? I18nT("没有匹配的记录", "No matching records")
                : I18nT("还没有需求记录", "No requirement records yet")
            }
          >
            <p>
              {tasks.length
                ? I18nT(
                    "试试其他关键词或筛选条件。",
                    "Try another keyword or filter.",
                  )
                : I18nT(
                    "创建第一个任务，开发与测试记录会自动保存在这里。",
                    "Create a task. Development and testing records will be saved here.",
                  )}
            </p>
          </Empty>
        )}
      </section>
    </>
  );
}
