export type TaskKind = "design" | "text" | "bug";
export type TaskIntentMode =
  "diagnose" | "implement" | "plan" | "verify" | "explain";
export type TaskStatus =
  | "queued"
  | "draft"
  | "analyzing"
  | "ready"
  | "developing"
  | "waiting-test"
  | "waiting-review"
  | "testing"
  | "starting"
  | "review"
  | "accepted"
  | "failed"
  | "stopped";
export type Stage = "analysis" | "development" | "test" | "startup";
export interface Project {
  id: string;
  name: string;
  directory: string;
  repository: string;
  auth: "system" | "token" | "password";
  username: string;
  hasSecret?: boolean;
  startScript: string;
  targetUrl: string;
  defaultBranchMode: "new" | "existing";
}
export interface Settings {
  execution?: {
    concurrency: number;
    previewMode: "single" | "multiple";
    /** Retained for old settings files only. Agent idle-stop is disabled. */
    agentIdleTimeoutMs?: number;
    /** Retained for old settings files only. Agent total deadline is disabled. */
    agentTimeoutMs?: number;
  };
  updates?: {
    manifestUrl: string;
    githubRepository: string;
    checkOnLaunch: boolean;
    hasSecret?: boolean;
  };
  developer: { name: string; email: string; defaultProject: string };
  projects: Project[];
  agent: { command: string; tyflowDirectory: string; testSkill: string };
  /** Legacy persisted metadata only; the integration is retired from the client. */
  zentao: {
    enabled: boolean;
    url: string;
    username: string;
    hasSecret?: boolean;
    mappings: Record<string, { productId: string; projectId: string }>;
  };
  notifications: {
    enabled: boolean;
    desktop: boolean;
    wecom?: { enabled: boolean; hasSecret?: boolean };
    milestones: {
      planReady: boolean;
      developmentComplete: boolean;
      acceptanceReady: boolean;
      failed: boolean;
      deliveryComplete?: boolean;
    };
  };
  theme: string;
  language: "zh-CN" | "en-US";
}
export interface SettingsInput extends Settings {
  secrets?: Record<string, string>;
}
export interface ZenTaoOption {
  id: string;
  name: string;
}
export interface ZenTaoItem extends ZenTaoOption {
  type: "task" | "bug";
}
export interface ZenTaoCatalog {
  products: ZenTaoOption[];
  projects: ZenTaoOption[];
  items: ZenTaoItem[];
}
export interface FileAsset {
  id: string;
  name: string;
  size: number;
  kind: "design" | "attachment";
  sourceType?: "prototype" | "requirements";
  entries?: string[];
  pages?: string[];
  documents?: string[];
  images?: string[];
  summary?: string;
  sha256: string;
}
export interface TestCase {
  id: string;
  title: string;
  covers?: string[];
  verifies?: string[];
  priority?: "P0" | "P1" | "P2";
  steps: string[];
  expected: string;
  /** Explicit browser matrix; [] means source/command-only. Absent on legacy plans. */
  browsers?: ("chrome" | "firefox")[];
}
export interface RequirementItem {
  id: string;
  text: string;
  priority: "P0" | "P1" | "P2";
  source: "description" | "design" | "attachment" | "manual" | "bug";
}
export interface PlanStep {
  id: string;
  title: string;
  covers: string[];
  expectedFiles: string[];
}
export interface Plan {
  summary: string;
  deliveryLevel?: "L1" | "L2" | "L3";
  orchestration?: {
    useTyflow: boolean;
    useAutomatedTests: boolean;
    verificationScope: string;
    reason: string;
  };
  requirements?: RequirementItem[];
  planSteps?: PlanStep[];
  steps: string[];
  risks: string[];
  testCases: TestCase[];
  blockers: string[];
  traceabilityMode?: "strict" | "legacy";
}
export interface BranchConfig {
  mode: "new" | "existing";
  base: string;
  name: string;
  version: string;
}
export interface TaskInput {
  workflowMode?: "quick" | "standard";
  workspaceMode?: "isolated" | "current";
  title: string;
  kind: TaskKind;
  size: "small" | "medium" | "large";
  description: string;
  projectId: string;
  assetIds: string[];
  branch: BranchConfig;
  autoTest: boolean;
  zentao?: { type: "story" | "task" | "bug"; id: string };
}
export interface LogEntry {
  time: string;
  stage: Stage;
  level: "info" | "error" | "success";
  message: string;
}
export interface CheckResult {
  name: string;
  state: "passed" | "failed" | "blocked" | "unexecuted";
  detail: string;
  purpose?: "implementation" | "regression" | "quality" | "manual";
  /** Only Studio may attach this after an independent baseline comparison. */
  historical?: { evidencePath: string; sha256: string; count: number };
  qualityProof?: ResultReference;
  evidence?: Evidence[];
  covers?: string[];
  verifies?: string[];
}
export interface Evidence {
  kind:
    "command" | "log" | "screenshot" | "trace" | "dom" | "coverage" | "manual";
  path?: string;
  command?: string;
  exitCode?: number;
  summary: string;
  sha256?: string;
}
export interface ChangeReviewFile {
  path: string;
  changeType:
    "added" | "modified" | "deleted" | "renamed" | "untracked" | "unknown";
  relatedPlanSteps: string[];
  relatedRequirements: string[];
  relatedTests: string[];
  risk: "low" | "medium" | "high";
  reason: string;
}
export interface ChangeReview {
  checkedAt: string;
  baseCommit: string;
  headCommit: string;
  files: ChangeReviewFile[];
  unplannedFiles: string[];
  uncoveredFiles: string[];
  riskyChanges: string[];
}
export interface CodeDiffFile {
  path: string;
  changeType: ChangeReviewFile["changeType"];
  before: string;
  after: string;
  binary?: boolean;
  truncated?: boolean;
}
export interface CodeDiff {
  baseCommit: string;
  generatedAt: string;
  files: CodeDiffFile[];
}
export interface TestExecution {
  contractVersion: 1;
  provider: "frontend-test" | "test-engineer" | "tyflow-native";
  runId: string;
  sourceSnapshot: string;
  planHash: string;
  skillHash?: string;
  contextHash?: string;
  completedAt: string;
  reused: boolean;
  checks: CheckResult[];
  evidenceChecks: CheckResult[];
  conclusion: "VERIFIED" | "FAILED" | "INCOMPLETE" | "NEEDS_DECISION";
}
export interface TestRequest {
  contractVersion: 1;
  verificationMode: "orchestrated";
  projectId: string;
  sourceSnapshot: string;
  planHash: string;
  requirements: RequirementItem[];
  planSteps: PlanStep[];
  testCases: TestCase[];
  changedFiles: string[];
  profile: "change" | "integration" | "release";
}
export interface RunRecord {
  id: string;
  stage: Stage;
  startedAt: string;
  finishedAt: string;
  status: "passed" | "failed" | "stopped";
  checks: CheckResult[];
  error?: string;
}
export interface AssetDiff {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: number;
}
export interface Task extends TaskInput {
  intent?: {
    mode: TaskIntentMode;
    source: "explicit" | "inferred";
    reason: string;
  };
  diagnosis?: {
    summary: string;
    rootCause: string;
    evidence: string[];
    affectedFiles: string[];
    recommendation: string;
    confidence: "high" | "medium" | "low";
    introducedAt?: string | null;
    introducingCommit?: {
      hash: string;
      author: string;
      committedAt: string;
      message: string;
    } | null;
    versionInfo?: string | null;
    traceabilityNotes?: string | null;
  };
  agentSession?: { threadId: string; updatedAt: string };
  quickBaseline?: Record<string, string>;
  /** Hashes of files already dirty when current-checkout development began. */
  workspaceBaseline?: Record<string, string>;
  /** Pre-existing dirty files that were also changed by this task. */
  workspaceOverlap?: string[];
  browserTest?: import("./browser-test").BrowserTestConfig;
  checkpoints?: WorkflowCheckpoint[];
  failure?: TaskFailure;
  activity?: {
    checkpointId?: string;
    lastOutputAt: string;
    idleTimeoutMs?: number;
  };
  executionIntent?: { directFix: boolean; forceTests: boolean };
  workspace?: {
    directory: string;
    sourceDirectory: string;
    branch: string;
    baseCommit: string;
    application?: {
      at: string;
      branch: string;
      sourceHead: string;
      files: string[];
      backup: string;
    };
  };
  queued?: { action: TaskAction; at: string };
  runtime?: {
    startScript: string;
    targetUrl: string;
    reusedExisting?: boolean;
  };
  runs?: RunRecord[];
  id: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  plan?: Plan;
  planRevision: number;
  planFeedback?: string;
  approvedRevision?: number;
  baseCommit?: string;
  targetCommit?: string;
  error?: string;
  stage?: Stage;
  checks: CheckResult[];
  gateReviews?: {
    traceability?: CheckResult[];
    evidence?: CheckResult[];
    diff?: ChangeReview;
  };
  testExecution?: TestExecution;
  testRequest?: TestRequest;
  logs: LogEntry[];
  assets: FileAsset[];
  supplements?: {
    id: string;
    stage: Stage;
    text?: string;
    assetIds: string[];
    createdAt: string;
  }[];
  snapshot?: {
    project: Project;
    branch: BranchConfig;
    plan: Plan;
    description: string;
    assetHashes: string[];
    at: string;
    baseCommit: string;
    directFix?: boolean;
  };
  delivery?: {
    commit: string;
    branch: string;
    remote: string;
    pushedAt?: string;
  };
}

export type FailureCategory =
  "environment" | "agent" | "code" | "test" | "git" | "policy" | "interrupted";
export interface TaskFailure {
  category: FailureCategory;
  code: string;
  stage: Stage;
  checkpointId: string;
  message: string;
  impact: string[];
  recommendedActions: string[];
  retryable: boolean;
  at: string;
}
export interface ResultReference {
  path: string;
  sha256: string;
}
export interface WorkflowCheckpoint {
  id: string;
  label: string;
  stage: Stage;
  category: FailureCategory;
  status: "running" | "passed" | "failed" | "interrupted" | "invalidated";
  fingerprint: string;
  attempts: number;
  reused: number;
  startedAt: string;
  finishedAt?: string;
  result?: ResultReference;
  failure?: TaskFailure;
}
export interface RepositoryInfo {
  remoteBranches?: {
    name: string;
    ref: string;
    remote: string;
    branch: string;
    commit: string;
  }[];
  branchStates?: {
    name: string;
    commit: string;
    upstream?: string;
    ahead: number;
    behind: number;
    upstreamMissing: boolean;
  }[];
  remotes?: string[];
  syncedAt?: string;
  syncRemote?: string;
  syncError?: string;
  branch: string;
  branches: string[];
  tags: string[];
  commit: string;
  dirty: boolean;
  changes: string[];
  scripts: string[];
}
export interface EnvironmentInfo {
  platform: string;
  version: string;
  dataDirectory: string;
  agentAvailable: boolean;
  gitAvailable: boolean;
  tyflowAvailable: boolean;
  testSkillAvailable: boolean;
  credentialStorage: boolean;
}
export interface SetupCheck {
  id: string;
  name: string;
  state: "passed" | "failed" | "warning";
  detail: string;
  remedy?: string;
}
export interface UpdateInfo {
  status:
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "current"
    | "failed";
  currentVersion: string;
  version?: string;
  progress?: number;
  notes?: string;
  error?: string;
  previousAvailable?: boolean;
}
export interface Bootstrap {
  settings: Settings;
  tasks: Task[];
  environment: EnvironmentInfo;
}
export type TaskAction =
  | "repair"
  | "fix"
  | "analyze"
  | "develop"
  | "test"
  | "start"
  | "pause"
  | "supplement"
  | "stop"
  | "terminate"
  | "accept"
  | "retry";
export interface StudioAPI {
  browserTest?(
    id: string,
    action: import("./browser-test").BrowserTestAction,
    input?: import("./browser-test").BrowserTestInput,
  ): Promise<import("./browser-test").BrowserTestState>;
  openWorkspace?(id: string): Promise<void>;
  applyWorkspace?(id: string): Promise<Task>;
  setupChecks?(projectId?: string): Promise<SetupCheck[]>;
  updateStatus?(): Promise<UpdateInfo>;
  checkUpdate?(): Promise<UpdateInfo>;
  downloadUpdate?(): Promise<UpdateInfo>;
  activateUpdate?(rollback?: boolean): Promise<void>;
  compareDesigns(beforeId: string, afterId: string): Promise<AssetDiff>;
  bootstrap(): Promise<Bootstrap>;
  saveSettings(settings: SettingsInput): Promise<Settings>;
  chooseDirectory(): Promise<string | null>;
  importFiles(
    kind: "design" | "attachment",
    paths?: string[],
  ): Promise<FileAsset[]>;
  pathForFile(file: File): string;
  importImage(bytes: Uint8Array): Promise<FileAsset>;
  imageThumbnail(id: string): Promise<string>;
  previewAsset(id: string, page?: string): Promise<void>;
  repository(projectId: string, sync?: boolean): Promise<RepositoryInfo>;
  testConnection(
    target: "git" | "agent" | "wecom",
    projectId?: string,
  ): Promise<{ ok: boolean; message: string }>;
  saveTask(input: TaskInput, id?: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  taskAction(
    id: string,
    action: TaskAction,
    options?: {
      planFeedback?: string;
      allowDirty?: boolean;
      developmentChecksOnly?: boolean;
      supplement?: { text?: string; assetIds?: string[] };
    },
  ): Promise<Task>;
  codeDiff(id: string): Promise<CodeDiff>;
  openTarget(id: string, external?: boolean): Promise<void>;
  exportTask(id: string): Promise<string | null>;
  onTask(callback: (task: Task) => void): () => void;
  onNotification?(callback: (message: string) => void): () => void;
}
declare global {
  interface Window {
    studio?: StudioAPI;
  }
}
