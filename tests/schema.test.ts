import { planJsonSchema, resultJsonSchema } from "../src/main/service";
import { resultSchema } from "../src/main/providers/agent-schemas";

test("Agent results cannot mint trusted historical or independent quality proof", () => {
  const report = resultSchema.parse({
    summary: "untrusted model report",
    checks: [
      {
        name: "ESLint",
        state: "failed",
        detail: "claimed history",
        historical: { evidencePath: "forged", sha256: "fake", count: 17 },
        qualityProof: { path: "forged", sha256: "fake" },
      },
    ],
  });
  expect(report.checks[0]).not.toHaveProperty("historical");
  expect(report.checks[0]).not.toHaveProperty("qualityProof");
});

function expectStrictObjects(schema: unknown, location = "root") {
  if (!schema || typeof schema !== "object") return;
  const node = schema as {
    type?: string | string[];
    properties?: Record<string, unknown>;
    required?: string[];
    items?: unknown;
  };
  if (node.type === "object") {
    const properties = Object.keys(node.properties ?? {}).sort();
    expect(node.required?.slice().sort()).toEqual(properties);
    for (const [key, child] of Object.entries(node.properties ?? {}))
      expectStrictObjects(child, `${location}.properties.${key}`);
  }
  if (node.items) expectStrictObjects(node.items, `${location}.items`);
}

test.each([
  ["plan", planJsonSchema],
  ["result", resultJsonSchema],
])(
  "%s output schema requires every declared object property",
  (_name, schema) => {
    expectStrictObjects(schema);
  },
);

test("plan output schema forbids empty file scopes and empty required steps", () => {
  const step = planJsonSchema.properties.planSteps.items.properties;
  expect(step.expectedFiles).toMatchObject({
    type: "array",
    minItems: 1,
    maxItems: 100,
    items: { type: "string", minLength: 1, maxLength: 500 },
  });
  expect(step.covers).toMatchObject({ minItems: 1, maxItems: 100 });
  expect(planJsonSchema.properties.steps).toMatchObject({
    minItems: 1,
    maxItems: 50,
  });
  expect(planJsonSchema.properties.testCases).toMatchObject({
    minItems: 1,
    maxItems: 100,
  });
  expect(
    planJsonSchema.properties.testCases.items.properties.steps,
  ).toMatchObject({ minItems: 1, maxItems: 30 });
});

test("new plans carry an explicit per-case browser matrix", () => {
  expect(
    planJsonSchema.properties.testCases.items.properties.browsers,
  ).toMatchObject({
    type: "array",
    maxItems: 2,
    items: { type: "string", enum: ["chrome", "firefox"] },
  });
});
