import type { Task } from "../shared/contracts";
import { isArtifactState } from "./test-artifacts";
import { ProviderFailure } from "./workflow/failures";

export function assertTestScope(
  task: Task,
  before: Record<string, string>,
  after: Record<string, string>,
  boundary: string,
) {
  const changed = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].filter((file) => before[file] !== after[file]);
  const business = changed.filter((file) => {
    if (file.replace(/\\/g, "/").startsWith("test-results/"))
      return !isArtifactState(
        task.snapshot!.project.directory,
        file,
        after[file],
      );
    return !/(^|\/|\\)(test|tests|__tests__|specs?)(\/|\\)|\.(test|spec)\./i.test(
      file,
    );
  });
  if (business.length)
    throw new ProviderFailure(
      "policy",
      "TEST_CHANGED_BUSINESS",
      `测试期间检测到业务或配置文件变化，必须回到开发与差异审查：${business.join(", ")}。检查位置：${boundary}；可能包含外部并发修改，已有代码保留，不会自动回滚。`,
    );
}
