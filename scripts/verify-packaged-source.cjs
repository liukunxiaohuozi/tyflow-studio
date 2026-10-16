const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const asar = require("@electron/asar");
const root = path.resolve(__dirname, "..");
const directory = path.resolve(process.argv[2]);
const archive = path.join(directory, "resources/app.asar");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = [];
function visit(relative) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const name = `${relative}/${entry.name}`;
    if (entry.isDirectory()) visit(name); else files.push(name);
  }
}
visit("dist");
const mismatches = files.filter(file => hash(fs.readFileSync(path.join(root, file))) !== hash(asar.extractFile(archive, path.normalize(file))));
// electron-builder removes development-only manifest fields; compare the exact
// runtime identity and production dependency contract, not that expected rewrite.
const sourceManifest = require(path.join(root, "package.json"));
const packagedManifest = JSON.parse(asar.extractFile(archive, "package.json"));
for (const key of ["name", "productName", "version", "main", "dependencies"])
  if (!require("node:util").isDeepStrictEqual(sourceManifest[key], packagedManifest[key])) mismatches.push(`package.json:${key}`);
const result = { passed: mismatches.length === 0, checkedFiles: files.length, runtimeManifestFieldsChecked: 5, mismatches, archiveSha256: hash(fs.readFileSync(archive)), version: sourceManifest.version };
fs.writeFileSync(path.resolve(root, process.argv[3] || "test-results/quick-flow-package-source.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (!result.passed) process.exitCode = 1;
