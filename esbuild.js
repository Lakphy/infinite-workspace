const esbuild = require("esbuild");

const isWatch = process.argv.includes("--watch");

const extensionConfig = {
  entryPoints: ["./src/extension.ts"],
  outfile: "./out/extension.js",
  bundle: true,
  platform: "node",
  format: "cjs",
  sourcemap: true,
  external: ["vscode", "node-pty"],
  tsconfig: "./tsconfig.json",
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(extensionConfig);
    await ctx.watch();
    console.log("Watching extension for changes...");
  } else {
    await esbuild.build(extensionConfig);
    console.log("Extension build complete.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
