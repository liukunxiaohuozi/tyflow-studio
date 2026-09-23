import type { Task, TaskStatus } from "../shared/contracts";

export interface TaskNotification {
  title: string;
  body: string;
}

export function notificationForTransition(
  previous: TaskStatus | undefined,
  task: Task,
  language: "zh-CN" | "en-US" = "zh-CN",
): TaskNotification | undefined {
  if (!previous || previous === task.status) return undefined;
  if (task.status === "ready")
    return language === "en-US"
      ? {
          title: "Development plan ready",
          body: `“${task.title}” is waiting for plan and test-case approval.`,
        }
      : {
          title: "开发计划已生成",
          body: `“${task.title}”等待确认计划与测试用例。`,
        };
  if (task.status === "waiting-test")
    return language === "en-US"
      ? {
          title: "Development complete",
          body: `“${task.title}” is ready for automated testing.`,
        }
      : {
          title: "开发完成",
          body: `“${task.title}”已完成开发，等待启动自动化测试。`,
        };
  if (task.status === "review")
    return language === "en-US"
      ? {
          title: "Development and testing complete",
          body: `“${task.title}” passed required checks and is ready for review.`,
        }
      : {
          title: "开发与测试完成",
          body: `“${task.title}”已通过必要检查，等待人工验收。`,
        };
  if (task.status === "failed")
    return language === "en-US"
      ? {
          title: "Task failed",
          body: `“${task.title}” failed. Open TingYun Studio for details.`,
        }
      : {
          title: "任务执行失败",
          body: `“${task.title}”执行失败，请打开 TingYun Studio 查看原因。`,
        };
  return undefined;
}
