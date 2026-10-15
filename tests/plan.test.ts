import { requestPlan } from "../src/main/providers/plan";
import { ProviderFailure, failureDetail } from "../src/main/workflow/failures";

function fixture() {
  return {
    summary: "APP 保存提示文案变更",
    requirements: [
      {
        id: "REQ-001",
        text: "保存后显示应用重启提示",
        priority: "P1",
        source: "description",
      },
    ],
    planSteps: [
      {
        id: "PLAN-001",
        title: "调整已定位的成功提示",
        covers: ["REQ-001"],
        expectedFiles: ["src/settings/save.ts"],
      },
    ],
    steps: ["只修改成功提示"],
    risks: [],
    blockers: [],
    testCases: [
      {
        id: "CASE-001",
        title: "保存设置",
        covers: ["REQ-001"],
        verifies: ["PLAN-001"],
        priority: "P1",
        steps: ["保存设置"],
        expected: "显示新提示，保存行为不变",
      },
    ],
  };
}
const signal = () => new AbortController().signal;
test("valid assessment needs only one Agent invocation", async () => {
  const plan = fixture(),
    invoke = jest.fn(async () => plan),
    report = jest.fn();
  expect(await requestPlan(invoke, signal(), report)).toEqual(plan);
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(report).not.toHaveBeenCalled();
});
test("only invalid output is sent for one bounded correction without fabricated file scopes", async () => {
  const invalid = fixture();
  invalid.planSteps[0].expectedFiles = [];
  const invoke = jest
    .fn()
    .mockResolvedValueOnce(invalid)
    .mockResolvedValueOnce(fixture());
  const result = await requestPlan(invoke, signal(), jest.fn());
  expect(result.planSteps?.[0].expectedFiles).toEqual(["src/settings/save.ts"]);
  expect(invoke).toHaveBeenCalledTimes(2);
  expect(invoke.mock.calls[1][0]).toContain("planSteps.0.expectedFiles");
  expect(invoke.mock.calls[1][0]).toContain("read-only");
  expect(invoke.mock.calls[1][0]).toContain("Do not invent file paths");
});
test("a still-invalid correction preserves the gate and supplies non-network guidance", async () => {
  const invalid = fixture();
  invalid.planSteps[0].expectedFiles = [];
  const invoke = jest.fn(async () => invalid);
  let failure: unknown;
  try {
    await requestPlan(invoke, signal(), jest.fn());
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(ProviderFailure);
  const detail = failureDetail(
    failure,
    "analysis",
    "analysis:agent",
    "agent",
    (v) => v,
  );
  expect(detail.code).toBe("AGENT_PLAN_INVALID");
  expect(detail.message).toContain("第 1 个计划步骤");
  expect(detail.recommendedActions.join(";")).not.toContain("网络和额度");
  expect(invoke).toHaveBeenCalledTimes(2);
});
test("transport and cancellation failures are not automatically replayed", async () => {
  const failure = new ProviderFailure(
    "agent",
    "NETWORK_LOST",
    "controlled disconnected transport",
  );
  const invoke = jest.fn().mockRejectedValue(failure);
  await expect(requestPlan(invoke, signal(), jest.fn())).rejects.toBe(failure);
  expect(invoke).toHaveBeenCalledTimes(1);
  const controller = new AbortController();
  const aborted = jest.fn(async () => {
    controller.abort();
    return fixture();
  });
  await expect(
    requestPlan(aborted, controller.signal, jest.fn()),
  ).rejects.toMatchObject({ code: "CANCELLED" });
  expect(aborted).toHaveBeenCalledTimes(1);
});
test("an already-cancelled task never invokes the Agent", async () => {
  const controller = new AbortController();
  controller.abort();
  const invoke = jest.fn();
  await expect(
    requestPlan(invoke, controller.signal, jest.fn()),
  ).rejects.toMatchObject({ code: "CANCELLED" });
  expect(invoke).not.toHaveBeenCalled();
});
test("oversized invalid output cannot cause an unbounded repair prompt", async () => {
  const invalid = fixture();
  invalid.summary = "x".repeat(64001);
  const invoke = jest.fn(async () => invalid);
  await expect(requestPlan(invoke, signal(), jest.fn())).rejects.toMatchObject({
    code: "AGENT_PLAN_INVALID",
  });
  expect(invoke).toHaveBeenCalledTimes(1);
});
test("missing output is invalid, never a raw TypeError or a false pass", async () => {
  const invoke = jest
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(fixture());
  expect((await requestPlan(invoke, signal(), jest.fn())).summary).toBe(
    fixture().summary,
  );
  expect(invoke).toHaveBeenCalledTimes(2);
});
