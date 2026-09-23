import type {
  FileAsset,
  Plan,
  Settings,
  Stage,
  StudioAPI,
  Task,
  TaskAction,
  TaskInput,
} from "../shared/contracts";
import { I18nT } from "./i18n";

function demoPlan(): Plan {
  return {
    summary: I18nT(
      "【演示计划】为告警规则列表增加关键词和状态筛选，支持重置条件及无结果提示。",
      "[Demo plan] Add keyword and status filters, reset and empty states to alert rules.",
    ),
    steps: [
      I18nT(
        "梳理规则列表与筛选状态，保留现有列表行为。",
        "Review the rule list and filter state while preserving existing behavior.",
      ),
      I18nT(
        "实现关键词与状态组合筛选，并增加重置入口。",
        "Implement combined keyword/status filtering and reset.",
      ),
      I18nT(
        "补充无匹配结果提示，检查布局和按钮主题色。",
        "Add an empty state and check layout and themed buttons.",
      ),
      I18nT(
        "运行筛选、重置及空状态用例，启动页面供人工验收。",
        "Verify filters, reset and empty states, then launch for acceptance.",
      ),
    ],
    risks: [
      I18nT(
        "演示使用内置规则数据；正式开发需核对真实接口字段。",
        "The demo uses built-in rules; real development requires checking the API fields.",
      ),
    ],
    blockers: [],
    testCases: [
      {
        id: "CASE-1",
        title: I18nT("关键词与状态组合筛选", "Combined filters"),
        steps: [
          I18nT("输入 CPU，并选择已启用。", "Enter CPU and select Enabled."),
        ],
        expected: I18nT(
          "仅显示已启用的 CPU 规则。",
          "Only enabled CPU rules appear.",
        ),
      },
      {
        id: "CASE-2",
        title: I18nT("重置筛选条件", "Reset filters"),
        steps: [
          I18nT("设置筛选后点击重置。", "Apply filters, then select Reset."),
        ],
        expected: I18nT(
          "关键词清空、状态恢复全部，显示全部 3 条规则。",
          "The keyword clears, all statuses are selected and all 3 rules appear.",
        ),
      },
      {
        id: "CASE-3",
        title: I18nT("无匹配结果", "No matching results"),
        steps: [
          I18nT(
            "输入一个不存在的规则名称。",
            "Enter a rule name that does not exist.",
          ),
        ],
        expected: I18nT(
          "显示无匹配规则提示，并可重置恢复。",
          "An empty state appears and Reset restores the list.",
        ),
      },
    ],
  };
}

/** Entirely in-memory demo transport. It never accesses window.studio or native IO. */
export class DemoSession {
  readonly settings: Settings;
  readonly api: StudioAPI;
  private task: Task;
  private listeners = new Set<(task: Task) => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private disposed = false;
  private assets: FileAsset[];

  constructor(
    settings: Settings,
    private preview: () => void,
  ) {
    this.settings = structuredClone(settings);
    this.settings.projects = ["explore", "o11y-apm-ui"].map((id) => ({
      id,
      name: id,
      directory: `demo://${id}`,
      repository: "",
      auth: "system",
      username: "",
      startScript: "start:dev",
      targetUrl: "demo://alert-rules",
      defaultBranchMode: "new",
    }));
    this.settings.developer.defaultProject = "explore";
    this.assets = [
      {
        id: "demo-design",
        kind: "design",
        name: "alert-rules-demo.zip",
        size: 24576,
        pages: ["alert-rules.html"],
        entries: ["alert-rules.html"],
        sha256: "demo-asset-no-real-file",
        summary: I18nT(
          "内置演示设计：告警规则的关键词、状态筛选与重置。可点击预览设计体验页面。",
          "Built-in demo: keyword/status filters and reset. Preview the design to try the page.",
        ),
      },
    ];
    const now = new Date().toISOString();
    this.task = {
      id: "demo-task",
      title: I18nT("【演示】告警规则筛选优化", "[Demo] Alert rule filtering"),
      description: I18nT(
        "为告警规则列表增加关键词和启用状态筛选，支持组合查询、一键重置和无结果提示。验收时检查筛选、重置及空状态。",
        "Add keyword and enabled-status filters to alert rules, with combined filtering, reset and an empty state. Verify each during acceptance.",
      ),
      kind: "design",
      size: "small",
      projectId: "explore",
      assetIds: ["demo-design"],
      branch: {
        mode: "new",
        base: "main",
        name: "feat/demo-alert-filters",
        version: "",
      },
      autoTest: true,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      planRevision: 0,
      checks: [],
      logs: [],
      assets: structuredClone(this.assets),
      runs: [],
    };
    this.api = {
      bootstrap: async () => {
        throw new Error("Demo bootstrap is not available");
      },
      saveSettings: async () => {
        throw new Error(
          I18nT(
            "请退出演示后修改正式配置。",
            "Exit the demo to change real settings.",
          ),
        );
      },
      chooseDirectory: async () => null,
      repository: async () => ({
        remotes: ["origin"],
        syncRemote: "origin",
        syncedAt: new Date().toISOString(),
        remoteBranches: ["main", "develop", "feature/demo-remote"].map(
          (branch) => ({
            name: `origin/${branch}`,
            ref: `refs/remotes/origin/${branch}`,
            remote: "origin",
            branch,
            commit: "demo-commit",
          }),
        ),
        branchStates: ["main", "develop"].map((name) => ({
          name,
          commit: "demo-commit",
          upstream: `refs/remotes/origin/${name}`,
          ahead: 0,
          behind: 0,
          upstreamMissing: false,
        })),
        branch: "main",
        branches: ["main", "develop"],
        tags: ["v1.0.0", "v1.1.0"],
        commit: "demo-commit",
        dirty: false,
        changes: [],
        scripts: ["start:dev", "test"],
      }),
      importFiles: async (kind, paths) => {
        if (paths?.length)
          throw new Error(
            I18nT(
              "演示模式使用内置素材，请点击选择文件按钮加载示例。",
              "The demo uses built-in assets. Use the file button to load a sample.",
            ),
          );
        if (kind === "design")
          return structuredClone(
            this.assets.filter((a) => a.kind === "design"),
          );
        const attachment: FileAsset = {
          id: "demo-log",
          kind: "attachment",
          name: "demo-browser.log",
          size: 256,
          sha256: "demo-log-no-real-file",
        };
        if (!this.assets.some((a) => a.id === attachment.id))
          this.assets.push(attachment);
        return [attachment];
      },
      pathForFile: (file) => file.name,
      importImage: async () => {
        throw new Error(
          I18nT(
            "演示模式不导入真实截图，请退出演示后粘贴。",
            "Exit demo mode to paste real screenshots.",
          ),
        );
      },
      imageThumbnail: async () => "",
      previewAsset: async () => this.preview(),
      compareDesigns: async () => ({
        added: [],
        removed: [],
        changed: [],
        unchanged: 1,
      }),
      testConnection: async () => ({
        ok: true,
        message: I18nT(
          "演示环境，无真实连接。",
          "Demo environment; no real connection.",
        ),
      }),
      openZentao: async () => {},
      zentaoCatalog: async () => ({ products: [], projects: [], items: [] }),
      saveTask: async (input) => this.save(input),
      taskAction: async (_id, action, options) => this.action(action, options),
      openTarget: async () => this.preview(),
      exportTask: async () => {
        throw new Error(
          I18nT(
            "演示记录仅在本次体验中保留，不导出为真实执行证据。",
            "Demo records are temporary and cannot be exported as real execution evidence.",
          ),
        );
      },
      onTask: (listener) => this.subscribe(listener),
    };
  }
  getTask() {
    return structuredClone(this.task);
  }
  subscribe(listener: (task: Task) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  dispose() {
    this.cancel();
    this.disposed = true;
    this.listeners.clear();
  }
  private cancel() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
  private emit() {
    if (this.disposed) return;
    this.task.updatedAt = new Date().toISOString();
    for (const listener of this.listeners) listener(this.getTask());
  }
  private later(delay: number, fn: () => void) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.disposed) fn();
    }, delay);
    this.timers.add(timer);
  }
  private log(stage: Stage, message: string) {
    this.task.logs.push({
      time: new Date().toISOString(),
      stage,
      level: "info",
      message: I18nT("【模拟日志】", "[Simulated log] ") + message,
    });
    this.emit();
  }
  private record(stage: Stage) {
    const now = new Date().toISOString();
    this.task.runs!.push({
      id: `demo-run-${this.task.runs!.length}`,
      stage,
      startedAt: now,
      finishedAt: now,
      status: "passed",
      checks: stage === "test" ? structuredClone(this.task.checks) : [],
    });
  }
  private save(input: TaskInput) {
    if (!input.title.trim())
      throw new Error(I18nT("请填写任务名称。", "Enter a task name."));
    if (
      ["analyzing", "developing", "testing", "starting"].includes(
        this.task.status,
      ) ||
      this.task.snapshot
    )
      throw new Error(
        I18nT(
          "请重新演示以修改已执行的需求。",
          "Restart the demo to edit an executed request.",
        ),
      );
    const changed =
      ["title", "description", "kind", "projectId", "assetIds"].some(
        (key) =>
          JSON.stringify(input[key as keyof TaskInput]) !==
          JSON.stringify(this.task[key as keyof TaskInput]),
      ) ||
      ["base", "version", "mode"].some(
        (key) =>
          input.branch[key as keyof TaskInput["branch"]] !==
          this.task.branch[key as keyof TaskInput["branch"]],
      );
    this.task = {
      ...this.task,
      ...structuredClone(input),
      assets: structuredClone(
        this.assets.filter((a) => input.assetIds.includes(a.id)),
      ),
    };
    if (changed) {
      this.task.plan = undefined;
      this.task.status = "draft";
    }
    this.emit();
    return this.getTask();
  }
  private action(
    action: TaskAction,
    options?: { planFeedback?: string },
  ) {
    if (this.disposed) throw new Error("Demo session closed");
    if (action === "stop") {
      this.cancel();
      this.task.status = "stopped";
      this.log(
        this.task.stage || "analysis",
        I18nT(
          "演示已停止，可点击重试继续。",
          "Demo stopped. Retry to continue.",
        ),
      );
      return this.getTask();
    }
    if (action === "terminate") {
      this.cancel();
      this.task.status = "stopped";
      this.task.error = I18nT("任务已终止。", "Task terminated.");
      this.log(
        this.task.stage || "analysis",
        I18nT("演示任务已终止。", "Demo task terminated."),
      );
      return this.getTask();
    }
    if (this.timers.size)
      throw new Error(
        I18nT(
          "演示正在进行，请等待当前阶段结束。",
          "Wait for the current demo stage to finish.",
        ),
      );
    if (action === "retry") {
      action =
        this.task.stage === "test"
          ? "test"
          : this.task.stage === "startup"
            ? "start"
            : this.task.snapshot
              ? "develop"
              : "analyze";
    }
    const directFix = action === "fix";
    if (directFix) {
      this.task.plan = demoPlan();
      this.task.planRevision += 1;
      this.task.baseCommit = "demo-commit";
      this.task.targetCommit = "demo-commit";
      action = "develop";
    }
    if (action === "analyze") {
      if (options?.planFeedback?.trim() && !this.task.plan)
        throw new Error(
          I18nT(
            "请先完成评估，再对开发计划或测试用例提出修改意见",
            "Complete assessment before revising the plan or test cases.",
          ),
        );
      this.task.status = "analyzing";
      this.task.stage = "analysis";
      this.task.planFeedback = options?.planFeedback?.trim() || undefined;
      this.log(
        "analysis",
        this.task.planFeedback
          ? I18nT(
              "根据计划修改意见重新生成开发计划与测试用例。",
              "Regenerating the plan and test cases from revision notes.",
            )
          : I18nT(
              "读取内置需求与设计，模拟 Tyflow 只读评估。",
              "Reading the sample requirement and simulating Tyflow assessment.",
            ),
      );
      this.later(1400, () => {
        const base = demoPlan();
        const notes = this.task.planFeedback?.trim();
        this.task.plan = notes
          ? {
              summary: `${base.summary}\n\n[${I18nT("已按意见修订", "Revised from notes")}] ${notes}`,
              steps: [
                I18nT(
                  "按修改意见收窄实现范围，避免改动无关公共模块。",
                  "Narrow the implementation scope from the revision notes and avoid unrelated shared modules.",
                ),
                ...base.steps.slice(1),
                I18nT(
                  "按用户对计划/用例的修改意见补充验收点。",
                  "Add acceptance checks from the user's plan/test feedback.",
                ),
              ],
              risks: [
                ...base.risks,
                I18nT(
                  "演示修订仅反映意见文本，不代表真实仓库分析。",
                  "Demo revisions reflect the notes text only, not a real repository analysis.",
                ),
              ],
              blockers: [],
              testCases: [
                ...base.testCases,
                {
                  id: "CASE-REV",
                  title: I18nT("按意见新增的验收", "Acceptance from revision notes"),
                  steps: [
                    I18nT(
                      "核对修改意见是否已体现在实现与用例中。",
                      "Confirm the revision notes are covered by the implementation and cases.",
                    ),
                    notes,
                  ],
                  expected: I18nT(
                    "计划与用例已按意见更新。",
                    "The plan and cases reflect the revision notes.",
                  ),
                },
              ],
            }
          : base;
        this.task.planRevision += 1;
        this.task.planFeedback = undefined;
        this.task.status = "ready";
        this.task.baseCommit = "demo-commit";
        this.task.targetCommit = "demo-commit";
        this.record("analysis");
        this.log(
          "analysis",
          notes
            ? I18nT(
                "已按意见重生成演示计划与测试用例，请再次预览确认。",
                "Demo plan and test cases regenerated from the notes; preview again before confirming.",
              )
            : I18nT(
                "演示计划与 3 条测试用例已生成，等待确认。",
                "Demo plan and 3 test cases generated; awaiting confirmation.",
              ),
        );
      });
    } else if (action === "develop" || action === "repair") {
      if (
        !this.task.plan ||
        !this.task.branch.base ||
        !this.task.branch.name.trim()
      )
        throw new Error(
          I18nT(
            "请先完成评估并选择开发分支。",
            "Complete assessment and select a branch first.",
          ),
        );
      this.task.snapshot ??= {
        project: structuredClone(
          this.settings.projects.find((p) => p.id === this.task.projectId)!,
        ),
        branch: structuredClone(this.task.branch),
        plan: structuredClone(this.task.plan),
        description: this.task.description,
        assetHashes: this.task.assets.map((a) => a.sha256),
        at: new Date().toISOString(),
        baseCommit: "demo-commit",
      };
      this.task.status = "developing";
      this.task.stage = "development";
      this.log(
        "development",
        (directFix
          ? I18nT("直接调用 Codex 模拟修复：", "Direct Codex repair on: ")
          : I18nT("模拟开发分支：", "Simulated development branch: ")) +
          this.task.branch.name,
      );
      this.later(1000, () =>
        this.log(
          "development",
          I18nT(
            "模拟实现关键词、状态筛选和重置交互。",
            "Simulating keyword/status filtering and reset implementation.",
          ),
        ),
      );
      this.later(2200, () => {
        this.record("development");
        this.task.status = "waiting-test";
        this.log(
          "development",
          I18nT(
            "模拟开发完成，等待自动化测试介入。",
            "Simulated development complete; awaiting testing.",
          ),
        );
        if (this.task.autoTest) this.beginTests();
      });
    } else if (action === "test") {
      if (!this.task.snapshot)
        throw new Error(
          I18nT("请先完成演示开发。", "Complete demo development first."),
        );
      this.beginTests();
    } else if (action === "start") {
      if (
        !this.task.checks.length ||
        this.task.checks.some((c) => c.state !== "passed")
      )
        throw new Error(
          I18nT("请先完成演示测试。", "Complete demo testing first."),
        );
      this.beginPreview();
    } else if (action === "accept") {
      if (this.task.status !== "review")
        throw new Error(
          I18nT("请先完成预览。", "Complete the preview stage first."),
        );
      this.task.status = "accepted";
      this.task.delivery = {
        commit: "demo-commit",
        branch:
          this.task.branch.mode === "new"
            ? this.task.branch.name
            : this.task.branch.base,
        remote: "origin",
        pushedAt: new Date().toISOString(),
      };
      this.log(
        "startup",
        I18nT(
          "演示已验收。你已走完需求、评估、开发、测试和交付流程。",
          "Demo accepted. Requirement, assessment, development, testing and delivery are complete.",
        ),
      );
    }
    this.emit();
    return this.getTask();
  }
  private beginTests() {
    this.task.status = "testing";
    this.task.stage = "test";
    this.task.checks = [];
    this.log(
      "test",
      I18nT(
        "自动化测试介入（模拟）。正式任务将在此调用测试 Skill。",
        "Automated testing intervention (simulated). Real tasks invoke the testing skill here.",
      ),
    );
    this.task.plan!.testCases.forEach((test, index) =>
      this.later((index + 1) * 900, () => {
        this.task.checks.push({
          name: `${test.id} · ${test.title}`,
          state: "passed",
          detail:
            I18nT(
              "内置模拟结果，未执行真实自动化测试。预期：",
              "Built-in simulated result, not a real automated test. Expected: ",
            ) + test.expected,
        });
        this.log("test", `${test.id} · ${I18nT("模拟通过", "Simulated pass")}`);
        if (index === this.task.plan!.testCases.length - 1) {
          this.record("test");
          this.beginPreview();
        }
      }),
    );
  }
  private beginPreview() {
    this.task.status = "starting";
    this.task.stage = "startup";
    this.log(
      "startup",
      I18nT(
        "模拟执行启动脚本，即将打开内置交付页面。",
        "Simulating startup; opening the built-in delivery page next.",
      ),
    );
    this.later(1100, () => {
      this.task.status = "review";
      this.record("startup");
      this.log(
        "startup",
        I18nT(
          "内置交付页面已就绪，请体验筛选后返回并确认验收。",
          "Built-in delivery page ready. Try the filters, then return and accept.",
        ),
      );
      this.preview();
    });
  }
}
