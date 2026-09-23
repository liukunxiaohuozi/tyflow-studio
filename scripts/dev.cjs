const { spawn } = require("node:child_process");
const esbuild = require("esbuild");
(async () => {
  const build = spawn(process.execPath, ["scripts/build.cjs"], {
    stdio: "inherit",
  });
  await new Promise((r, j) =>
    build.on("exit", (c) => (c ? j(new Error("Main build failed")) : r())),
  );
  const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
    stdio: "inherit",
  });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch("http://127.0.0.1:5178");
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  const electron = spawn(require("electron"), ["."], {
    stdio: "inherit",
    env: { ...process.env, STUDIO_DEV_URL: "http://127.0.0.1:5178" },
  });
  electron.on("exit", () => {
    vite.kill();
    process.exit(0);
  });
  process.on("SIGINT", () => {
    electron.kill();
    vite.kill();
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
