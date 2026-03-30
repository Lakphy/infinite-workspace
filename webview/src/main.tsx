import React from "react";
import ReactDOM from "react-dom/client";
import "@/globals.css";
import "@xterm/xterm/css/xterm.css";
import { App } from "@/App";

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
