import fs from "node:fs";
import path from "node:path";
import type { Settings, SetupCheck } from "../shared/contracts";
import { resolveCodex } from "./codex";
import { executablePath, resolveCommand, runCommand } from "./process";
import { inspectRepository } from "./git";
import { safeTargetUrl } from "./validation";

export async function setupChecks(
  settings: Settings,
  dataDirectory: string,
  projectId?: string,
): Promise<SetupCheck[]> {
  const checks: SetupCheck[] = [];
  const check = async (
    id: string,
    name: string,
    remedy: string,
    work: () => Promise<string>,
  ) => {
    try {
      checks.push({ id, name, state: "passed", detail: await work() });
    } catch (error) {
      checks.push({
        id,
        name,
        state: "failed",
        detail: (error as Error).message,
        remedy,
      });
    }
  };
  const env = { PATH: executablePath(settings.agent.command) };
  await check("git", "Git", "安装 Git 并重新启动 Studio。", () =>
    runCommand(resolveCommand("git"), ["--version"], {
      cwd: dataDirectory,
      env,
      timeout: 10_000,
    }),
  );
  await check(
    "node",
    "Node.js / npm",
    "安装项目要求的 Node.js；使用 NVM 时，Agent 路径应指向同一 Node 版本目录。",
    async () => {
      const version = await runCommand(
        resolveCommand("node", settings.agent.command),
        ["--version"],
        { cwd: dataDirectory, env, timeout: 10_000 },
      );
      const npm = await runCommand(
        resolveCommand("npm", settings.agent.command),
        ["--version"],
        { cwd: dataDirectory, env, timeout: 10_000 },
      );
      return `${version.trim()} · npm ${npm.trim()}`;
    },
  );
  await check(
    "agent",
    "Codex 执行与登录",
    "在终端执行 codex login，再返回 Studio 检查；找不到命令时填写完整 Agent 路径。",
    async () => {
      const resolved = await resolveCodex(settings.agent.command, {
        cwd: dataDirectory,
      });
      const login = await runCommand(resolved.command, ["login", "status"], {
        cwd: dataDirectory,
        env,
        timeout: 15_000,
      });
      return `${resolved.version} · ${login.trim() || "登录状态检查通过"}`;
    },
  );
  await check(
    "tyflow",
    "Tyflow",
    "使用带技能的内部便携包，或在本地执行配置中选择有效 Tyflow 目录。",
    async () => {
      if (
        !fs.existsSync(
          path.join(settings.agent.tyflowDirectory, "shared", "WORKFLOW.md"),
        )
      )
        throw new Error("缺少 shared/WORKFLOW.md");
      return settings.agent.tyflowDirectory;
    },
  );
  await check(
    "skill",
    "测试 Skill",
    "在本地执行配置中选择 frontend-test 或 test-engineer 的 SKILL.md。",
    async () => {
      if (!fs.existsSync(settings.agent.testSkill))
        throw new Error("测试 Skill 不存在");
      return settings.agent.testSkill;
    },
  );
  if (projectId) {
    const project = settings.projects.find((p) => p.id === projectId);
    await check(
      "project",
      "项目目录与启动配置",
      "选择 Git 工程根目录，并核对启动脚本和本机预览地址。",
      async () => {
        if (!project) throw new Error("请选择项目");
        const info = await inspectRepository(project.directory);
        safeTargetUrl(project.targetUrl);
        if (!info.scripts.includes(project.startScript))
          throw new Error(`缺少启动脚本 ${project.startScript}`);
        return `${project.name} · ${info.branch} · ${project.startScript}`;
      },
    );
    if (project && !fs.existsSync(path.join(project.directory, "node_modules")))
      checks.push({
        id: "dependencies",
        name: "项目依赖",
        state: "warning",
        detail: "原目录尚未安装依赖；独立工作区会安装自己的依赖。",
        remedy: "原目录开发时，请先在该目录安装依赖。",
      });
    if (project && fs.existsSync(path.join(project.directory, ".husky")))
      checks.push({
        id: "hooks",
        name: "Git Hooks",
        state: "warning",
        detail: "检测到 Husky；提交时会执行项目 Hook，并使用配置的 Node PATH。",
        remedy: "若 Hook 依赖其他工具，请先在该 Node 环境安装。",
      });
  }
  return checks;
}
