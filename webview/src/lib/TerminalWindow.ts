import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

interface VsCodeApi {
  postMessage(msg: unknown): void;
}

export interface TerminalConfig {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontFamily: string;
  cursorBlink: boolean;
  cursorStyle: "block" | "underline" | "bar";
  scrollback: number;
}

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  fontSize: 12,
  lineHeight: 1.1,
  letterSpacing: 0,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  cursorBlink: true,
  cursorStyle: "block",
  scrollback: 5000,
};

export class TerminalWindow {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private resizeObserver: ResizeObserver;
  private windowId: string;
  private vscode: VsCodeApi;
  private resizeTimeout: number | null = null;

  constructor(
    contentElement: HTMLDivElement,
    windowId: string,
    vscode: VsCodeApi,
    config?: Partial<TerminalConfig>
  ) {
    this.windowId = windowId;
    this.vscode = vscode;

    const cfg = { ...DEFAULT_TERMINAL_CONFIG, ...config };

    // Create terminal container
    const container = document.createElement("div");
    container.className = "terminal-container";
    contentElement.appendChild(container);

    // Create xterm instance
    this.terminal = new Terminal({
      fontSize: cfg.fontSize,
      lineHeight: cfg.lineHeight,
      letterSpacing: cfg.letterSpacing,
      fontFamily: cfg.fontFamily,
      cursorBlink: cfg.cursorBlink,
      cursorStyle: cfg.cursorStyle,
      scrollback: cfg.scrollback,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#ffffff",
        selectionBackground: "#264f78",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
    });

    // Load addons
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(new WebLinksAddon());

    // Open terminal in container
    this.terminal.open(container);

    // Fit after layout
    requestAnimationFrame(() => {
      this.fitAddon.fit();
      this.notifyResize();
    });

    // Request PTY creation from extension
    this.vscode.postMessage({
      type: "createTerminal",
      windowId: this.windowId,
    });

    // Forward user input to extension
    this.terminal.onData((data) => {
      this.vscode.postMessage({
        type: "ptyInput",
        windowId: this.windowId,
        data,
      });
    });

    // Observe container resize for auto-fit
    this.resizeObserver = new ResizeObserver(() => {
      this.fit();
    });
    this.resizeObserver.observe(container);
  }

  public fit() {
    // Debounce resize notifications
    if (this.resizeTimeout !== null) {
      clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = window.setTimeout(() => {
      try {
        this.fitAddon.fit();
        this.notifyResize();
      } catch {
        // Terminal may be disposed
      }
    }, 50);
  }

  private notifyResize() {
    const cols = this.terminal.cols;
    const rows = this.terminal.rows;
    if (cols > 0 && rows > 0) {
      this.vscode.postMessage({
        type: "resizeTerminal",
        windowId: this.windowId,
        cols,
        rows,
      });
    }
  }

  public handleMessage(msg: { type: string; [key: string]: unknown }) {
    switch (msg.type) {
      case "ptyOutput":
        this.terminal.write(msg.data as string);
        break;
      case "ptyExit":
        this.terminal.writeln(
          `\r\n\x1b[90m[Process exited with code ${msg.exitCode}]\x1b[0m`
        );
        break;
    }
  }

  public destroy() {
    this.vscode.postMessage({
      type: "destroyTerminal",
      windowId: this.windowId,
    });
    this.resizeObserver.disconnect();
    if (this.resizeTimeout !== null) {
      clearTimeout(this.resizeTimeout);
    }
    this.terminal.dispose();
  }
}
