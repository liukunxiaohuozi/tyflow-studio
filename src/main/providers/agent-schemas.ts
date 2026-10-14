import { z } from "zod";
const string = { type: "string" };
const strings = { type: "array", items: string };
const caseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: string,
    title: string,
    covers: strings,
    verifies: strings,
    priority: { type: "string", enum: ["P0", "P1", "P2"] },
    steps: strings,
    expected: string,
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
    id: string,
    text: string,
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
    id: string,
    title: string,
    covers: strings,
    expectedFiles: strings,
  },
  required: ["id", "title", "covers", "expectedFiles"],
};
export const planJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: string,
    requirements: { type: "array", items: requirementSchema },
    planSteps: { type: "array", items: planStepSchema },
    steps: strings,
    risks: strings,
    testCases: { type: "array", items: caseSchema },
    blockers: strings,
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
