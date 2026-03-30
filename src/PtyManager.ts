import * as pty from "node-pty";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

export class PtyManager {
  private ptys = new Map<string, pty.IPty>();
  private onData: (windowId: string, data: string) => void;
  private onExit: (windowId: string, exitCode: number) => void;
  private onError: (windowId: string, message: string) => void;

  constructor(
    onData: (windowId: string, data: string) => void,
    onExit: (windowId: string, exitCode: number) => void,
    onError?: (windowId: string, message: string) => void
  ) {
    this.onData = onData;
    this.onExit = onExit;
    this.onError = onError || (() => {});
    this.ensureSpawnHelperPermissions();
  }

  /**
   * On macOS/Linux, node-pty requires its `spawn-helper` binary to have
   * execute permissions. Some package managers strip these during install.
   */
  private ensureSpawnHelperPermissions(): void {
    if (os.platform() === "win32") return;

    try {
      const nodePtyDir = path.dirname(require.resolve("node-pty"));
      const platform = os.platform();
      const arch = os.arch();
      const helperPath = path.resolve(
        nodePtyDir,
        "..",
        "prebuilds",
        `${platform}-${arch}`,
        "spawn-helper"
      );

      if (fs.existsSync(helperPath)) {
        try {
          fs.accessSync(helperPath, fs.constants.X_OK);
        } catch {
          // spawn-helper exists but is not executable — fix it
          fs.chmodSync(helperPath, 0o755);
          console.log(
            `[PtyManager] Fixed spawn-helper permissions: ${helperPath}`
          );
        }
      }
    } catch {
      // Best-effort; if this fails, the spawn() call will surface the error
    }
  }

  create(windowId: string): void {
    const shell =
      os.platform() === "win32"
        ? "powershell.exe"
        : process.env.SHELL || "/bin/zsh";

    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: os.homedir(),
        env: process.env as { [key: string]: string },
      });

      this.ptys.set(windowId, ptyProcess);

      ptyProcess.onData((data) => {
        this.onData(windowId, data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        this.ptys.delete(windowId);
        this.onExit(windowId, exitCode);
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error spawning terminal";
      console.error(`[PtyManager] Failed to create PTY for ${windowId}:`, err);
      this.onError(windowId, message);
    }
  }

  write(windowId: string, data: string): void {
    this.ptys.get(windowId)?.write(data);
  }

  resize(windowId: string, cols: number, rows: number): void {
    if (cols >= 1 && rows >= 1) {
      this.ptys.get(windowId)?.resize(cols, rows);
    }
  }

  destroy(windowId: string): void {
    const p = this.ptys.get(windowId);
    if (p) {
      p.kill();
      this.ptys.delete(windowId);
    }
  }

  disposeAll(): void {
    for (const [, p] of this.ptys) {
      p.kill();
    }
    this.ptys.clear();
  }
}
