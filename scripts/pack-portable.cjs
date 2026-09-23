const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const home = os.homedir();
const bundleRoot = path.join(root, "bundle");
const seedRoot = path.join(root, "portable-bundle");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const version = packageJson.version;
const args = new Set(process.argv.slice(2));
const prepareOnly = args.has("--prepare-only");
const requested = args.has("--mac")
  ? "mac"
  : args.has("--win")
    ? "win"
    : process.platform === "darwin"
      ? "mac"
      : process.platform === "win32"
        ? "win"
        : null;

function run(command, argsList, options = {}) {
  const result = spawnSync(command, argsList, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
    },
    ...options,
  });
  if (result.status) process.exit(result.status ?? 1);
}

function copyDir(source, target, { exclude = [] } = {}) {
  if (!fs.existsSync(source))
    throw new Error(`Missing source directory: ${source}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, {
    recursive: true,
    filter: (src) => !exclude.includes(path.basename(src)),
  });
}

function resolveSources() {
  const tyflowSource =
    process.env.TYFLOW_DIR ||
    (fs.existsSync(path.join(seedRoot, "tyflow", "shared", "WORKFLOW.md"))
      ? path.join(seedRoot, "tyflow")
      : path.join(home, ".tyflow"));
  const skillSource =
    process.env.TEST_SKILL_DIR ||
    (fs.existsSync(path.join(seedRoot, "skills", "frontend-test", "SKILL.md"))
      ? path.join(seedRoot, "skills", "frontend-test")
      : path.join(home, ".codex", "skills", "frontend-test"));
  return { tyflowSource, skillSource };
}

function prepareBundle({ persistSeed = false } = {}) {
  if (fs.existsSync(bundleRoot)) fs.rmSync(bundleRoot, { recursive: true });
  const { tyflowSource, skillSource } = resolveSources();
  copyDir(tyflowSource, path.join(bundleRoot, "tyflow"), {
    exclude: ["workfile", "local", "mcp-server", "requirements", ".git"],
  });
  copyDir(skillSource, path.join(bundleRoot, "skills", "frontend-test"));
  if (
    !fs.existsSync(path.join(bundleRoot, "tyflow", "shared", "WORKFLOW.md"))
  )
    throw new Error("Bundled tyflow is missing shared/WORKFLOW.md");
  if (
    !fs.existsSync(
      path.join(bundleRoot, "skills", "frontend-test", "SKILL.md"),
    )
  )
    throw new Error("Bundled frontend-test skill is missing SKILL.md");
  if (persistSeed) {
    if (fs.existsSync(seedRoot)) fs.rmSync(seedRoot, { recursive: true });
    fs.cpSync(bundleRoot, seedRoot, { recursive: true });
    console.log(`Synced seed bundle to ${seedRoot}`);
  }
  console.log("Prepared bundle from:");
  console.log(`  tyflow: ${tyflowSource}`);
  console.log(`  skill:  ${skillSource}`);
}

function writeReadme(targetDir, platform) {
  const isMac = platform === "mac";
  const text = `TingYun Studio 便携版（${isMac ? "macOS" : "Windows x64"}）
版本：${version}

使用方法
1. 解压到任意目录。
2. ${
    isMac
      ? "双击「TingYun Studio.app」启动（若系统拦截，右键 → 打开）。"
      : "双击「TingYun Studio.exe」启动。"
  }
3. 无需安装，无需启动本地 Web 服务。
4. 包内已自带 Tyflow 工作流与 frontend-test Skill；首次启动会自动使用包内路径。

本机仍需具备（跑完整 AI 流程时）
- Git
- Node.js（用于项目脚本）
- 已登录的 Codex CLI（终端可执行 codex）

首次建议
1. 打开「开发配置」，确认项目本地目录与 Git 仓库。
2. 在「本地运行」页确认 Codex / Tyflow / 测试 Skill 状态为可用。
3. 再回到工作台新建任务。

注意
- 这是免安装便携包，请保留整个解压目录再拷贝给同事。
- Windows 包不能在 macOS 运行，反之亦然。
${
  isMac
    ? "- 未签名时 macOS 可能提示「无法打开」，需在「隐私与安全性」允许，或右键打开。"
    : "- 未签名时 Windows 可能出现 SmartScreen 提示，选择仍要运行即可。"
}
`;
  fs.writeFileSync(path.join(targetDir, "使用说明.txt"), text, "utf8");
}

function zipPortable(sourcePath, zipPath, { asDirectoryContents = true } = {}) {
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (process.platform === "win32") {
    const script = path.join(root, "release", "_zip-portable.ps1");
    const source = asDirectoryContents
      ? `(Join-Path -Path '${sourcePath.replace(/'/g, "''")}' -ChildPath '*')`
      : `'${sourcePath.replace(/'/g, "''")}'`;
    fs.writeFileSync(
      script,
      [
        "$ErrorActionPreference = 'Stop'",
        `Compress-Archive -Path ${source} -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
      ].join("\r\n"),
      "utf8",
    );
    try {
      run("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
      ]);
    } finally {
      if (fs.existsSync(script)) fs.rmSync(script);
    }
    return;
  }
  if (asDirectoryContents) {
    run("zip", ["-r", zipPath, "."], { cwd: sourcePath });
  } else {
    run("zip", ["-r", zipPath, path.basename(sourcePath)], {
      cwd: path.dirname(sourcePath),
    });
  }
}

function injectBundle(resourcesDir) {
  const resourcesBundle = path.join(resourcesDir, "bundle");
  if (fs.existsSync(resourcesBundle))
    fs.rmSync(resourcesBundle, { recursive: true });
  fs.cpSync(bundleRoot, resourcesBundle, { recursive: true });
}

function packWindows() {
  if (process.platform !== "win32") {
    console.error(
      "Windows 便携包必须在 Windows 上构建。当前系统: " + process.platform,
    );
    process.exit(1);
  }
  run("npm", ["run", "build"]);
  const localElectron = path.join(root, "node_modules", "electron", "dist");
  const builderArgs = ["electron-builder", "--win", "dir", "--x64"];
  if (fs.existsSync(path.join(localElectron, "electron.exe"))) {
    builderArgs.push(`--config.electronDist=${localElectron}`);
    console.log(`Using local Electron runtime: ${localElectron}`);
  }
  run("npx", builderArgs);
  const unpacked = path.join(root, "release", "win-unpacked");
  if (!fs.existsSync(path.join(unpacked, "TingYun Studio.exe")))
    throw new Error(`Expected executable missing in ${unpacked}`);
  injectBundle(path.join(unpacked, "resources"));
  writeReadme(unpacked, "win");
  const zipPath = path.join(
    root,
    "release",
    `TingYun-Studio-${version}-Windows-x64-portable.zip`,
  );
  zipPortable(unpacked, zipPath, { asDirectoryContents: true });
  return [zipPath];
}

function findMacApp(arch) {
  const candidates =
    arch === "arm64"
      ? [
          path.join(root, "release", "mac-arm64", "TingYun Studio.app"),
          path.join(root, "release", "mac", "TingYun Studio.app"),
        ]
      : [
          path.join(root, "release", "mac", "TingYun Studio.app"),
          path.join(root, "release", "mac-x64", "TingYun Studio.app"),
        ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function packMac() {
  if (process.platform !== "darwin") {
    console.error("");
    console.error("Mac 便携包不能在 Windows 上构建。");
    console.error("可选方式：");
    console.error("  1. 在 Mac 上执行: npm run pack:portable:mac");
    console.error("  2. 推送代码后用 GitHub Actions（macos-latest）自动打 Mac 包");
    console.error("");
    console.error(
      "先在本机执行 npm run pack:portable:seed，把 Tyflow/Skill 同步进仓库 portable-bundle/ 再提交，CI 才能打出带 Skill 的 Mac 包。",
    );
    process.exit(1);
  }
  run("npm", ["run", "build"]);
  const zips = [];
  for (const arch of ["arm64", "x64"]) {
    run("npx", ["electron-builder", "--mac", "dir", `--${arch}`]);
    const appPath = findMacApp(arch);
    if (!appPath) throw new Error(`Missing macOS app for ${arch}`);
    injectBundle(path.join(appPath, "Contents", "Resources"));
    const stage = path.join(root, "release", `portable-mac-${arch}`);
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true });
    fs.mkdirSync(stage, { recursive: true });
    fs.cpSync(appPath, path.join(stage, "TingYun Studio.app"), {
      recursive: true,
    });
    writeReadme(stage, "mac");
    const zipPath = path.join(
      root,
      "release",
      `TingYun-Studio-${version}-macOS-${arch}-portable.zip`,
    );
    zipPortable(stage, zipPath, { asDirectoryContents: true });
    zips.push(zipPath);
  }
  return zips;
}

if (!requested && !prepareOnly) {
  console.error("Unsupported platform for portable pack: " + process.platform);
  process.exit(1);
}

prepareBundle({ persistSeed: args.has("--seed") || prepareOnly });
if (prepareOnly) {
  console.log("Seed bundle ready. Commit portable-bundle/ if CI should use it.");
  process.exit(0);
}

const outputs = requested === "mac" ? packMac() : packWindows();
console.log("");
console.log("Portable package ready:");
for (const file of outputs) console.log(`  ${file}`);
console.log("Send the zip to colleagues, unzip, then open the app.");
