import * as vscode from "vscode";
import * as crypto from "crypto";
import * as path from "path";

// node-pty is optional — it's a native module unavailable in VS Code Web
let PtyManagerClass: typeof import("./PtyManager").PtyManager | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PtyManagerClass = require("./PtyManager").PtyManager;
} catch {
  // Running in VS Code Web or node-pty is not available
}

export class CanvasPanel {
  public static currentPanel: CanvasPanel | undefined;
  public static readonly viewType = "infiniteWorkspace";

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private ptyManager: InstanceType<typeof import("./PtyManager").PtyManager> | undefined;
  private disposables: vscode.Disposable[] = [];

  /** True when running in a context without native node modules (VS Code Web) */
  private readonly isWebEnvironment: boolean;

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

    // Detect Web environment: no native modules available
    this.isWebEnvironment = typeof PtyManagerClass === "undefined";

    // Use workspace folder as default CWD for terminals
    const workspaceCwd =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // Initialize PtyManager only when native modules are available
    if (PtyManagerClass) {
      this.ptyManager = new PtyManagerClass(
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
        },
        workspaceCwd
      );
    }

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
    dirPath?: string;
    filePath?: string;
    line?: number;
    column?: number;
    key?: string;
    value?: unknown;
  }) {
    switch (msg.type) {
      case "createTerminal":
        if (msg.windowId) {
          if (this.ptyManager) {
            this.ptyManager.create(msg.windowId);
          } else {
            // Web environment fallback: notify user to use VS Code integrated terminal
            this.panel.webview.postMessage({
              type: "ptyOutput",
              windowId: msg.windowId,
              data:
                "\r\n\x1b[33m⚠ Terminal is not available in VS Code Web.\x1b[0m\r\n" +
                "\x1b[90mPlease use the VS Code integrated terminal instead (Ctrl+`).\x1b[0m\r\n" +
                "\x1b[90mOther features (Browser, File Explorer) work normally.\x1b[0m\r\n",
            });
          }
        }
        break;
      case "ptyInput":
        if (msg.windowId && msg.data !== undefined) {
          this.ptyManager?.write(msg.windowId, msg.data);
        }
        break;
      case "resizeTerminal":
        if (msg.windowId && msg.cols && msg.rows) {
          this.ptyManager?.resize(msg.windowId, msg.cols, msg.rows);
        }
        break;
      case "destroyTerminal":
        if (msg.windowId) {
          this.ptyManager?.destroy(msg.windowId);
        }
        break;
      case "readDirectory":
        if (msg.windowId && msg.dirPath) {
          this.handleReadDirectory(msg.windowId, msg.dirPath);
        }
        break;
      case "openFileInEditor":
        if (msg.filePath) {
          const uri = vscode.Uri.file(msg.filePath);
          const options: vscode.TextDocumentShowOptions = {};
          if (msg.line !== undefined) {
            const line = Math.max(0, msg.line - 1);
            const column = Math.max(0, (msg.column || 1) - 1);
            options.selection = new vscode.Range(line, column, line, column);
          }
          vscode.commands.executeCommand("vscode.open", uri, options);
        }
        break;
      case "getWorkspacePath":
        if (msg.windowId) {
          const folders = vscode.workspace.workspaceFolders;
          let workspacePath: string;
          if (folders && folders.length > 0) {
            workspacePath = folders[0].uri.fsPath;
          } else if (!this.isWebEnvironment) {
            workspacePath = process.env.HOME || "/";
          } else {
            workspacePath = "/";
          }
          this.panel.webview.postMessage({
            type: "workspacePath",
            windowId: msg.windowId,
            data: workspacePath,
          });
        }
        break;
      case "updateExtensionSetting":
        if (msg.key !== undefined) {
          const config = vscode.workspace.getConfiguration("infinite-workspace");
          config.update(msg.key, msg.value, vscode.ConfigurationTarget.Global);
        }
        break;
      case "getExtensionSetting":
        if (msg.key !== undefined) {
          const cfg = vscode.workspace.getConfiguration("infinite-workspace");
          this.panel.webview.postMessage({
            type: "extensionSetting",
            key: msg.key,
            value: cfg.get(msg.key),
          });
        }
        break;
    }
  }

  private async handleReadDirectory(windowId: string, dirPath: string) {
    try {
      // Use vscode.workspace.fs for cross-environment compatibility
      const dirUri = vscode.Uri.file(dirPath);
      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      const items = await Promise.all(
        entries.map(async ([name, fileType]) => {
          const fullUri = vscode.Uri.joinPath(dirUri, name);
          let size = 0;
          let mtime = 0;
          try {
            const stat = await vscode.workspace.fs.stat(fullUri);
            size = stat.size;
            mtime = stat.mtime;
          } catch {
            // Permission denied or broken symlink
          }
          const isDirectory = (fileType & vscode.FileType.Directory) !== 0;
          const isSymlink = (fileType & vscode.FileType.SymbolicLink) !== 0;
          return {
            name,
            isDirectory,
            isSymlink,
            size,
            mtime,
            path: fullUri.fsPath,
          };
        })
      );
      this.panel.webview.postMessage({
        type: "directoryContents",
        windowId,
        data: { path: dirUri.fsPath, items },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.panel.webview.postMessage({
        type: "directoryError",
        windowId,
        data: { path: dirPath, error: message },
      });
    }
  }

  private getHtmlContent(): string {
    const webview = this.panel.webview;
    const nonce = crypto.randomBytes(16).toString("hex");

    // Read the Vite-built index.html and rewrite asset paths to webview URIs
    const webviewDistUri = vscode.Uri.joinPath(
      this.extensionUri,
      "out",
      "webview"
    );
    const indexHtmlUri = vscode.Uri.joinPath(webviewDistUri, "index.html");

    // Use synchronous fs read for local extension host;
    // For web, the extension files are still accessible via extensionUri
    const fs = require("fs") as typeof import("fs");
    const indexHtmlPath = indexHtmlUri.fsPath;

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
      `connect-src https: http: ws: wss:`,
    ].join("; ");

    html = html.replace(
      "<head>",
      `<head>\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`
    );

    return html;
  }

  public dispose() {
    CanvasPanel.currentPanel = undefined;
    this.ptyManager?.disposeAll();
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }
}
