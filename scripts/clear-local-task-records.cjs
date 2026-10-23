const fs = require("node:fs");
const path = require("node:path");

const dataRoot = path.resolve(process.argv[2] || "");
if (path.basename(dataRoot) !== "TingYun Studio") {
  throw new Error(`Refusing to clear unexpected data directory: ${dataRoot}`);
}

const statePath = path.join(dataRoot, "state.json");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const removedTasks = Array.isArray(state.tasks) ? state.tasks.length : 0;
state.tasks = [];

const temporaryStatePath = `${statePath}.clearing`;
fs.writeFileSync(temporaryStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
fs.renameSync(temporaryStatePath, statePath);

for (const directoryName of ["runs", "evidence", "assets"]) {
  const directory = path.join(dataRoot, directoryName);
  if (!fs.existsSync(directory)) continue;
  for (const entry of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, entry), { recursive: true, force: true });
  }
}

const assetsDirectory = path.join(dataRoot, "assets");
fs.mkdirSync(assetsDirectory, { recursive: true });
fs.writeFileSync(path.join(assetsDirectory, "assets.json"), "[]\n", "utf8");

const receiptsPath = path.join(dataRoot, "notification-receipts.json");
if (fs.existsSync(receiptsPath)) {
  fs.writeFileSync(receiptsPath, "[]\n", "utf8");
}

console.log(JSON.stringify({ removedTasks, preservedSettings: true, preservedWorkspaces: true }));
