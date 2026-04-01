import React from "react";
import ReactDOM from "react-dom/client";
import "@/globals.css";
import "@xterm/xterm/css/xterm.css";
import { App } from "@/App";
import { getVsCodeApi } from "@/lib/vscode";

window.addEventListener("code-inspector:trackCode", (e: any) => {
  const file = e.detail?.path || e.detail?.file;
  if (file) {
    getVsCodeApi().postMessage({
      type: "openFileInEditor",
      filePath: file,
      line: e.detail.line,
      column: e.detail.column,
    });
  }
});
function mount() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
