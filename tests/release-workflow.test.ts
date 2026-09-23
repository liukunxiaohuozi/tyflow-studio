import fs from "node:fs";
import path from "node:path";

describe("desktop release workflow", () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), ".github", "workflows", "desktop.yml"),
    "utf8",
  );

  test("publishes packages through an idempotent, retryable release flow", () => {
    expect(workflow).toContain("Ensure GitHub Release exists");
    expect(workflow).toContain("Upload packages with retries");
    expect(workflow).toContain("gh release upload");
    expect(workflow).toContain("--clobber");
    expect(workflow).toContain("Verify published packages");
  });
});
