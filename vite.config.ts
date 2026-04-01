import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { codeInspectorPlugin } from "code-inspector-plugin";

const isWatch = process.argv.includes("--watch");

export default defineConfig({
  plugins: [react(), tailwindcss(), codeInspectorPlugin({ bundler: "vite", dev: isWatch, behavior: { locate: false } })],
  root: path.resolve(__dirname, "webview"),
  build: {
    outDir: path.resolve(__dirname, "out/webview"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "webview/index.html"),
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
        // Produce IIFE, not ES module — VS Code webview CSP nonce requires it
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "webview/src"),
    },
  },
});
