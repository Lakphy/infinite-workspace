import * as vscode from "vscode";
import { CanvasPanel } from "./CanvasPanel";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "infinite-workspace.open",
    () => {
      CanvasPanel.createOrShow(context);
    }
  );

  context.subscriptions.push(disposable);

  // Register serializer for panel restoration after VS Code restart
  vscode.window.registerWebviewPanelSerializer(CanvasPanel.viewType, {
    async deserializeWebviewPanel(
      panel: vscode.WebviewPanel,
      _state: unknown
    ) {
      CanvasPanel.restore(panel, context);
    },
  });

  // Auto-open if configured as startup editor
  const config = vscode.workspace.getConfiguration("infinite-workspace");
  if (config.get<boolean>("openOnStartup")) {
    CanvasPanel.createOrShow(context);
  }
}

export function deactivate() {
  CanvasPanel.currentPanel?.dispose();
}
