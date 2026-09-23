import fs from "node:fs";
import path from "node:path";

describe("desktop release workflow", () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), ".github", "workflows", "desktop.yml"),
    "utf8",
  );

  test("publishes packages through an idempotent, retryable release flow", () => {
    expect(workflow).toContain("Create draft GitHub Release");
    expect(workflow).toContain("-F draft=true");
    expect(workflow).toContain('echo "release_id=$release_id"');
    expect(workflow).not.toContain("--generate-notes");
    expect(workflow).toContain("Upload packages with retries");
    expect(workflow).toContain("https://uploads.github.com/repos/");
    expect(workflow).toContain('--data-binary "@$package"');
    expect(workflow).toContain("releases/assets/$asset_id");
    expect(workflow).toContain("Verify published packages");
    expect(workflow).toContain("gh api");
    expect(workflow).toContain("Publish verified GitHub Release");
    expect(workflow).toContain("-F draft=false");
  });
});
