import { z } from "zod";
const string = { type: "string" };
const strings = { type: "array", items: string };
const text = (minLength: number, maxLength: number) => ({
  type: "string",
  minLength,
  maxLength,
});
const list = (items: object, minItems: number, maxItems: number) => ({
  type: "array",
  items,
  minItems,
  maxItems,
});
const identifiers = list(text(1, 60), 0, 100);
const caseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: text(1, 60),
    title: text(1, 500),
    covers: identifiers,
    verifies: identifiers,
    priority: { type: "string", enum: ["P0", "P1", "P2"] },
    steps: list(text(0, 4000), 1, 30),
    expected: text(1, 4000),
  },
  required: [
    "id",
    "title",
    "covers",
    "verifies",
    "priority",
    "steps",
    "expected",
  ],
};
const requirementSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: text(1, 60),
    text: text(1, 4000),
    priority: { type: "string", enum: ["P0", "P1", "P2"] },
    source: {
      type: "string",
      enum: ["description", "design", "attachment", "manual", "bug"],
    },
  },
  required: ["id", "text", "priority", "source"],
};
const planStepSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: text(1, 60),
    title: text(1, 8000),
    covers: list(text(1, 60), 1, 100),
    expectedFiles: {
      ...list(text(1, 500), 1, 100),
      description:
        "Real implementation file paths or narrowly scoped globs. Never empty; put pure verification actions in testCases, not in implementation planSteps. Do not invent paths or use a repository-wide wildcard to bypass scope control.",
    },
  },
  required: ["id", "title", "covers", "expectedFiles"],
};
export const planJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: text(1, 16000),
    requirements: list(requirementSchema, 0, 100),
    planSteps: { type: "array", items: planStepSchema, maxItems: 100 },
    steps: list(text(1, 8000), 1, 50),
    risks: list(text(0, 4000), 0, 50),
    testCases: { type: "array", items: caseSchema, minItems: 1, maxItems: 100 },
    blockers: list(text(0, 4000), 0, 30),
  },
  required: [
    "summary",
    "requirements",
    "planSteps",
    "steps",
    "risks",
    "testCases",
    "blockers",
  ],
};
export const resultJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: string,
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: string,
          state: {
            type: "string",
            enum: ["passed", "failed", "blocked", "unexecuted"],
          },
          detail: string,
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: {
                  type: "string",
                  enum: [
                    "command",
                    "log",
                    "screenshot",
                    "trace",
                    "dom",
                    "coverage",
                    "manual",
                  ],
                },
                path: { type: ["string", "null"] },
                command: { type: ["string", "null"] },
                exitCode: { type: ["number", "null"] },
                summary: string,
                sha256: { type: ["string", "null"] },
              },
              required: [
                "kind",
                "path",
                "command",
                "exitCode",
                "summary",
                "sha256",
              ],
            },
          },
          covers: strings,
          verifies: strings,
        },
        required: ["name", "state", "detail", "evidence", "covers", "verifies"],
      },
    },
  },
  required: ["summary", "checks"],
};
export const resultSchema = z.object({
  summary: z.string(),
  checks: z
    .array(
      z.object({
        name: z.string(),
        state: z.enum(["passed", "failed", "blocked", "unexecuted"]),
        detail: z.string(),
        evidence: z
          .array(
            z.object({
              kind: z.enum([
                "command",
                "log",
                "screenshot",
                "trace",
                "dom",
                "coverage",
                "manual",
              ]),
              path: z
                .string()
                .nullable()
                .optional()
                .transform((v) => v ?? undefined),
              command: z
                .string()
                .nullable()
                .optional()
                .transform((v) => v ?? undefined),
              exitCode: z
                .number()
                .nullable()
                .optional()
                .transform((v) => v ?? undefined),
              summary: z.string(),
              sha256: z
                .string()
                .nullable()
                .optional()
                .transform((v) => v ?? undefined),
            }),
          )
          .optional(),
        covers: z.array(z.string()).optional(),
        verifies: z.array(z.string()).optional(),
      }),
    )
    .min(1),
});
