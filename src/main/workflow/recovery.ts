import type { Task } from "../../shared/contracts";
import { failureDetail, ProviderFailure } from "./failures";

export function recoverInterruptedTask(task: Task): boolean {
  let changed = false;
  for (const checkpoint of task.checkpoints ?? [])
    if (checkpoint.status === "running") {
      checkpoint.status = "interrupted";
      checkpoint.finishedAt = new Date().toISOString();
      checkpoint.failure = failureDetail(
        new ProviderFailure(
          "interrupted",
          "CLIENT_RESTARTED",
          "客户端关闭导致检查点中断；不会自动重放代码修改或推送",
        ),
        checkpoint.stage,
        checkpoint.id,
        "interrupted",
        (s) => s,
      );
      task.failure = checkpoint.failure;
      changed = true;
    }
  return changed;
}
