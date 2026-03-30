import * as vscode from "vscode";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { PtyManager } from "./PtyManager";

export class CanvasPanel {
  public static currentPanel: CanvasPanel | undefined;
  public static readonly viewType = "infiniteWorkspace";

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly ptyManager: PtyManager;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(context: vscode.ExtensionContext) {
    if (CanvasPanel.currentPanel) {
      CanvasPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      CanvasPanel.viewType,
      "Infinite Workspace",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "out", "webview"),
        ],
      }
    );

    CanvasPanel.currentPanel = new CanvasPanel(panel, context.extensionUri);
  }

  public static restore(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext
  ) {
    CanvasPanel.currentPanel = new CanvasPanel(panel, context.extensionUri);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.ptyManager = new PtyManager(
      (windowId, data) => {
        this.panel.webview.postMessage({
          type: "ptyOutput",
          windowId,
          data,
        });
      },
      (windowId, exitCode) => {
        this.panel.webview.postMessage({
          type: "ptyExit",
          windowId,
          exitCode,
        });
      },
      (windowId, message) => {
        this.panel.webview.postMessage({
          type: "ptyOutput",
          windowId,
          data: `\r\n\x1b[31m[Error] Failed to create terminal: ${message}\x1b[0m\r\n`,
        });
      }
    );

    this.panel.webview.html = this.getHtmlContent();

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private handleMessage(msg: {
    type: string;
    windowId?: string;
    data?: string;
    cols?: number;
    rows?: number;
  }) {
    switch (msg.type) {
      case "createTerminal":
        if (msg.windowId) {
          this.ptyManager.create(msg.windowId);
        }
        break;
      case "ptyInput":
        if (msg.windowId && msg.data !== undefined) {
          this.ptyManager.write(msg.windowId, msg.data);
        }
        break;
      case "resizeTerminal":
        if (msg.windowId && msg.cols && msg.rows) {
          this.ptyManager.resize(msg.windowId, msg.cols, msg.rows);
        }
        break;
      case "destroyTerminal":
        if (msg.windowId) {
          this.ptyManager.destroy(msg.windowId);
        }
        break;
    }
  }

  private getHtmlContent(): string {
    const webview = this.panel.webview;
    const nonce = crypto.randomBytes(16).toString("hex");

    // Read the Vite-built index.html and rewrite asset paths to webview URIs
    const webviewDistPath = path.join(
      this.extensionUri.fsPath,
      "out",
      "webview"
    );
    const indexHtmlPath = path.join(webviewDistPath, "index.html");

    let html = fs.readFileSync(indexHtmlPath, "utf-8");

    // Replace relative asset paths with webview URIs
    html = html.replace(
      /(href|src)="(\/assets\/[^"]+)"/g,
      (_match, attr, assetPath) => {
        const uri = webview.asWebviewUri(
          vscode.Uri.joinPath(
            this.extensionUri,
            "out",
            "webview",
            assetPath
          )
        );
        return `${attr}="${uri}"`;
      }
    );

    // Strip type="module" and crossorigin from script tags, add nonce
    html = html.replace(
      /<script\s+type="module"\s+crossorigin\s+/g,
      `<script nonce="${nonce}" `
    );
    // Fallback: add nonce to any remaining script tags
    html = html.replace(
      /<script(?!\s+nonce)([\s>])/g,
      `<script nonce="${nonce}"$1`
    );

    // Inject CSP meta tag
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
      `frame-src https: http:`,
    ].join("; ");

    html = html.replace(
      "<head>",
      `<head>\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`
    );

    return html;
  }

  public dispose() {
    CanvasPanel.currentPanel = undefined;
    this.ptyManager.disposeAll();
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }
}
