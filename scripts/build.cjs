const esbuild = require("esbuild");
Promise.all([
  esbuild.build({
    entryPoints: ["src/main/index.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    outfile: "dist/main/index.cjs",
    external: ["electron", "yauzl", "playwright-core"],
    sourcemap: true,
  }),
  esbuild.build({
    entryPoints: ["src/main/preload.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    outfile: "dist/main/preload.cjs",
    external: ["electron"],
  }),
]).catch((e) => {
  console.error(e);
  process.exit(1);
});
