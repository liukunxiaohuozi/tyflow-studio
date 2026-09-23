import { planJsonSchema, resultJsonSchema } from "../src/main/service";

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
])("%s output schema requires every declared object property", (_name, schema) => {
  expectStrictObjects(schema);
});
