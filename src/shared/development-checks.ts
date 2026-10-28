import type { Task } from "./contracts";
const recoverableDevelopmentChecks = [
  "DEVELOPMENT_CHECK_FAILED",
  "DEVELOPMENT_VALIDATION_INCOMPLETE",
  "DEVELOPMENT_EVIDENCE_INVALID",
];
export const developmentValidationPending = (code?: string) =>
  recoverableDevelopmentChecks.includes(code ?? "");
export const developmentProducedNoChanges = (task: Task) =>
  task.failure?.code === "DEVELOPMENT_NO_CHANGES" ||
  task.checks.some((check) =>
    /(?:没有|未)(?:成功)?产生(?:任何)?代码变更|未成功写入任何项目文件|no code changes (?:were )?produced/i.test(
      check.detail,
    ),
  );
export const canRecheckDevelopment = (task: Task) =>
  task.status === "failed" &&
  task.stage === "development" &&
  Boolean(task.snapshot) &&
  !developmentProducedNoChanges(task) &&
  recoverableDevelopmentChecks.includes(task.failure?.code ?? "");
export const canVerifyHistoricalQuality = (task: Task) =>
  canRecheckDevelopment(task) &&
  task.checks.some(
    (check) => check.state === "failed" && check.purpose === "quality",
  ) &&
  task.checks.every(
    (check) => check.state !== "failed" || check.purpose === "quality",
  );
