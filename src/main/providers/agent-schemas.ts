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
    browsers: {
      type: "array",
      items: { type: "string", enum: ["chrome", "firefox"] },
      maxItems: 2,
      description:
        "Explicit browser matrix for this case. Use [] for source, static, command or unit checks. Require browsers only for actual runtime UI interaction; mentioning a page/file/save string is not a browser requirement.",
    },
  },
  required: [
    "id",
    "title",
    "covers",
    "verifies",
    "priority",
    "steps",
    "expected",
    "browsers",
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
          purpose: {
            type: "string",
            enum: ["implementation", "regression", "quality", "manual"],
            description:
              "regression proves the requested behavior with a focused assertion; quality is lint/syntax/formatting; manual is explicitly deferred human acceptance, never a required development check.",
          },
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
        required: [
          "name",
          "purpose",
          "state",
          "detail",
          "evidence",
          "covers",
          "verifies",
        ],
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
        purpose: z
          .enum(["implementation", "regression", "quality", "manual"])
          .optional(),
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

export const diagnosisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: text(1, 8000),
    rootCause: text(1, 16000),
    evidence: list(text(1, 4000), 1, 40),
    affectedFiles: list(text(1, 1000), 0, 100),
    recommendation: text(1, 12000),
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    introducedAt: { type: ["string", "null"], minLength: 1, maxLength: 1000 },
    introducingCommit: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        hash: text(1, 100),
        author: text(1, 1000),
        committedAt: text(1, 1000),
        message: text(1, 4000),
      },
      required: ["hash", "author", "committedAt", "message"],
    },
    versionInfo: { type: ["string", "null"], minLength: 1, maxLength: 4000 },
    traceabilityNotes: { type: ["string", "null"], minLength: 1, maxLength: 8000 },
  },
  required: [
    "summary",
    "rootCause",
    "evidence",
    "affectedFiles",
    "recommendation",
    "confidence",
    "introducedAt",
    "introducingCommit",
    "versionInfo",
    "traceabilityNotes",
  ],
};

export const diagnosisSchema = z.object({
  summary: z.string().min(1),
  rootCause: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
  affectedFiles: z.array(z.string().min(1)),
  recommendation: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  introducedAt: z.string().min(1).nullable(),
  introducingCommit: z
    .object({
      hash: z.string().min(1),
      author: z.string().min(1),
      committedAt: z.string().min(1),
      message: z.string().min(1),
    })
    .nullable(),
  versionInfo: z.string().min(1).nullable(),
  traceabilityNotes: z.string().min(1).nullable(),
});
