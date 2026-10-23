import type { Task } from "./contracts";
export const developmentValidationPending = (code?: string) =>
  code === "DEVELOPMENT_VALIDATION_INCOMPLETE";
export const canRecheckDevelopment = (task: Task) =>
  task.status === "failed" &&
  task.stage === "development" &&
  Boolean(task.snapshot) &&
  [
    "DEVELOPMENT_CHECK_FAILED",
    "DEVELOPMENT_VALIDATION_INCOMPLETE",
    "DEVELOPMENT_EVIDENCE_INVALID",
  ].includes(task.failure?.code ?? "");
