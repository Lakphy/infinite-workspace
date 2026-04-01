/**
 * WindowManager — manages the lifecycle of all workspace windows
 * (creation, destruction, focus, state persistence).
 * Extracted from App.tsx for modularity.
 */

import { Canvas } from "./canvas";
import { TerminalWindow, type TerminalConfig } from "./TerminalWindow";
import { BrowserWindow } from "./BrowserWindow";
import { FileExplorerWindow } from "./FileExplorerWindow";
import { SnapEngine } from "./snapGuides";
import { setupDrag, ResizeHandleManager } from "./dragResize";

interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

export type WindowType = "terminal" | "browser" | "fileExplorer";

export interface WindowInstance {
  id: string;
  type: WindowType;
  element: HTMLDivElement;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  onMessage?: (msg: { type: string; [key: string]: unknown }) => void;
  onDestroy?: () => void;
  onResize?: () => void;
}

export interface WindowState {
  id: string;
  type: WindowType;
  x: number;
  y: number;
  width: number;
  height: number;
  extra?: { url?: string; path?: string; zoom?: number };
}

let idCounter = 0;
function generateId(): string {
  return `win-${Date.now()}-${idCounter++}`;
}

const WINDOW_ICONS: Record<WindowType, string> = {
  terminal:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>',
  browser:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  fileExplorer:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>',
};

const WINDOW_LABELS: Record<WindowType, string> = {
  terminal: "Terminal",
  browser: "Browser",
  fileExplorer: "Files",
};

const WINDOW_DEFAULTS: Record<WindowType, { width: number; height: number }> = {
  terminal: { width: 650, height: 380 },
  browser: { width: 750, height: 520 },
  fileExplorer: { width: 700, height: 480 },
};

export type WindowDefaults = Record<WindowType, { width: number; height: number }>;

export class WindowManager {
  private windows = new Map<string, WindowInstance>();
  private browserWindows = new Map<string, BrowserWindow>();
  private topZIndex = 1;
  private focusedWindowId: string | null = null;
  private canvas: Canvas;
  private vscode: VsCodeApi;
  private snapEngine: SnapEngine;
  private resizeHandleManager: ResizeHandleManager;
  private windowDefaults: WindowDefaults = { ...WINDOW_DEFAULTS };
  private terminalConfig: Partial<TerminalConfig> = {};

  constructor(canvas: Canvas, vscode: VsCodeApi) {
    this.canvas = canvas;
    this.vscode = vscode;
    this.snapEngine = new SnapEngine(canvas.viewport);
    this.resizeHandleManager = new ResizeHandleManager(
      canvas,
      () => this.getDraggableWindows(),
      () => this.saveState(),
      (winId) => this.focusWindow(winId)
    );
  }

  getSnapEngine(): SnapEngine {
    return this.snapEngine;
  }

  setWindowDefaults(defaults: Partial<WindowDefaults>) {
    for (const key of Object.keys(defaults) as WindowType[]) {
      if (defaults[key]) {
        this.windowDefaults[key] = { ...this.windowDefaults[key], ...defaults[key] };
      }
    }
  }

  setTerminalConfig(config: Partial<TerminalConfig>) {
    this.terminalConfig = config;
  }

  // --- Focus management ---

  focusWindow(windowId: string) {
    if (this.focusedWindowId && this.focusedWindowId !== windowId) {
      const prev = this.windows.get(this.focusedWindowId);
      if (prev) prev.element.classList.remove("window-focused");
    }
    const win = this.windows.get(windowId);
    if (win) {
      win.element.classList.add("window-focused");
      win.zIndex = ++this.topZIndex;
      win.element.style.zIndex = `${win.zIndex}`;
    }
    this.focusedWindowId = windowId;
  }

  unfocusAll() {
    if (this.focusedWindowId) {
      const win = this.windows.get(this.focusedWindowId);
      if (win) win.element.classList.remove("window-focused");
      this.focusedWindowId = null;
    }
  }

  // --- State persistence ---

  saveState() {
    const states: WindowState[] = [];
    for (const [, win] of this.windows) {
      const state: WindowState = {
        id: win.id,
        type: win.type,
        x: win.x,
        y: win.y,
        width: win.width,
        height: win.height,
      };
      if (win.type === "browser") {
        const bw = this.browserWindows.get(win.id);
        if (bw) {
          state.extra = { url: bw.getUrl(), zoom: bw.getZoom() };
        }
      }
      states.push(state);
    }
    const prev = this.vscode.getState() as Record<string, unknown> | null;
    this.vscode.setState({ ...prev, windows: states });
  }

  restoreState(states: WindowState[]) {
    for (const s of states) {
      switch (s.type) {
        case "terminal":
          this.createTerminalWindow(s.id, s.x, s.y);
          break;
        case "browser":
          this.createBrowserWindow(s.id, s.x, s.y, s.extra?.url, undefined, undefined, s.extra?.zoom);
          break;
        case "fileExplorer":
          this.createFileExplorerWindow(s.id, s.x, s.y, s.extra?.path);
          break;
      }
      const win = this.windows.get(s.id);
      if (win) {
        win.width = s.width;
        win.height = s.height;
        win.element.dataset.canvasW = `${s.width}`;
        win.element.dataset.canvasH = `${s.height}`;
        win.element.style.width = `${s.width}px`;
        win.element.style.height = `${s.height}px`;
        this.canvas.updateWindowTransform(win.element);
        win.onResize?.();
      }
    }
  }

  // --- Queries ---

  getWindowRects(): { x: number; y: number; width: number; height: number }[] {
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    for (const [, win] of this.windows) {
      rects.push({ x: win.x, y: win.y, width: win.width, height: win.height });
    }
    return rects;
  }

  private getOtherRects(
    excludeId: string
  ): { x: number; y: number; width: number; height: number }[] {
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    for (const [id, win] of this.windows) {
      if (id !== excludeId) {
        rects.push({ x: win.x, y: win.y, width: win.width, height: win.height });
      }
    }
    return rects;
  }

  /** Get all windows as DraggableWindow (for ResizeHandleManager) */
  private getDraggableWindows() {
    return Array.from(this.windows.values());
  }

  // --- Window creation (generic) ---

  private createWindowElement(
    type: WindowType,
    id?: string,
    x?: number,
    y?: number,
    width?: number,
    height?: number
  ): WindowInstance {
    const defaults = this.windowDefaults[type];
    const w = width ?? defaults.width;
    const h = height ?? defaults.height;
    const windowId = id || generateId();

    if (x === undefined || y === undefined) {
      const center = this.canvas.getViewportCenter();
      const jitter = this.windows.size * 24;
      x = center.x - w / 2 + jitter;
      y = center.y - h / 2 + jitter;
    }

    const zIndex = ++this.topZIndex;

    const el = document.createElement("div");
    el.className =
      "workspace-window window-enter rounded-lg border border-[oklch(1_0_0/8%)] bg-[oklch(0.16_0_0)] shadow-[0_8px_32px_oklch(0_0_0/45%),0_2px_8px_oklch(0_0_0/25%)]";
    el.dataset.canvasX = `${x}`;
    el.dataset.canvasY = `${y}`;
    el.dataset.canvasW = `${w}`;
    el.dataset.canvasH = `${h}`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.zIndex = `${zIndex}`;
    el.style.transformOrigin = "0 0";
    this.canvas.updateWindowTransform(el);

    el.innerHTML = `
      <div class="window-titlebar flex items-center justify-between px-2 py-[3px] bg-[oklch(0.20_0_0)] cursor-grab select-none shrink-0 border-b border-[oklch(1_0_0/5%)]" style="user-select:none;-webkit-user-select:none">
        <div class="flex items-center gap-1.5">
          <span class="text-[oklch(0.55_0_0)]">${WINDOW_ICONS[type]}</span>
          <span class="text-[10px] font-medium text-[oklch(0.6_0_0)]">${WINDOW_LABELS[type]}</span>
        </div>
        <button class="window-close inline-flex items-center justify-center size-[16px] rounded-full text-[oklch(0.5_0_0)] hover:bg-[oklch(0.65_0.25_25)] hover:text-white transition-all duration-150 cursor-pointer border-none bg-transparent">
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="window-content flex-1 overflow-hidden relative flex flex-col">
        <div class="window-focus-overlay"></div>
      </div>
    `;

    this.canvas.layer.appendChild(el);

    el.addEventListener(
      "animationend",
      () => el.classList.remove("window-enter"),
      { once: true }
    );

    const win: WindowInstance = {
      id: windowId,
      type,
      element: el,
      x,
      y,
      width: w,
      height: h,
      zIndex,
    };

    this.windows.set(windowId, win);

    // Focus on click
    el.addEventListener("pointerdown", (e) => {
      // Prevent browser auto-scroll on middle click
      if (e.button === 1) {
        const target = e.target as HTMLElement;
        const titlebar = el.querySelector(".window-titlebar") as HTMLElement;
        const overlay = el.querySelector(".window-focus-overlay") as HTMLElement;
        if (titlebar?.contains(target) || target === overlay || target === el) {
          e.preventDefault();
        }
      }
      e.stopPropagation();
      this.focusWindow(windowId);
    });

    // Middle click to close window
    el.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        const target = e.target as HTMLElement;
        const titlebar = el.querySelector(".window-titlebar") as HTMLElement;
        const overlay = el.querySelector(".window-focus-overlay") as HTMLElement;
        if (titlebar?.contains(target) || target === overlay || target === el) {
          e.preventDefault();
          e.stopPropagation();
          this.destroyWindow(windowId);
        }
      }
    });

    // Stop propagation inside content area
    const content = el.querySelector(".window-content") as HTMLDivElement;
    content.addEventListener("pointerdown", (e) => e.stopPropagation());
    content.addEventListener("wheel", (e) => e.stopPropagation(), {
      passive: false,
    });

    // Wire up drag (with snap) and resize
    // Drag is set up on both titlebar and focus overlay, so unfocused
    // windows can be dragged from anywhere.
    setupDrag(
      win,
      this.canvas,
      () => this.saveState(),
      this.snapEngine,
      (excludeId) => this.getOtherRects(excludeId),
      () => this.focusWindow(windowId)
    );

    // Close button
    const closeBtn = el.querySelector(".window-close") as HTMLButtonElement;
    closeBtn.addEventListener("click", () => this.destroyWindow(windowId));

    return win;
  }

  destroyWindow(windowId: string) {
    const win = this.windows.get(windowId);
    if (!win) return;
    if (this.focusedWindowId === windowId) {
      this.focusedWindowId = null;
    }
    win.onDestroy?.();

    win.element.style.transition = "opacity 0.15s ease";
    win.element.style.opacity = "0";
    setTimeout(() => {
      win.element.remove();
    }, 150);

    this.windows.delete(windowId);
    this.saveState();
  }

  // --- Typed window factories ---

  createTerminalWindow(
    id?: string,
    x?: number,
    y?: number,
    initialCommand?: string,
    width?: number,
    height?: number
  ): string {
    const win = this.createWindowElement("terminal", id, x, y, width, height);
    const contentEl = win.element.querySelector(
      ".window-content"
    ) as HTMLDivElement;

    const termWindow = new TerminalWindow(contentEl, win.id, this.vscode, this.terminalConfig);
    win.onDestroy = () => termWindow.destroy();
    win.onResize = () => termWindow.fit();

    if (initialCommand) {
      let sent = false;
      win.onMessage = (msg) => {
        termWindow.handleMessage(msg);
        if (!sent && msg.type === "ptyOutput") {
          sent = true;
          this.vscode.postMessage({
            type: "ptyInput",
            windowId: win.id,
            data: initialCommand + "\r",
          });
        }
      };
    } else {
      win.onMessage = (msg) => termWindow.handleMessage(msg);
    }

    this.saveState();
    return win.id;
  }

  createBrowserWindow(
    id?: string,
    x?: number,
    y?: number,
    url?: string,
    width?: number,
    height?: number,
    zoom?: number
  ): string {
    const win = this.createWindowElement("browser", id, x, y, width, height);
    const contentEl = win.element.querySelector(
      ".window-content"
    ) as HTMLDivElement;

    const browserWindow = new BrowserWindow(contentEl, win.id, url, zoom);
    this.browserWindows.set(win.id, browserWindow);
    win.onDestroy = () => {
      browserWindow.destroy();
      this.browserWindows.delete(win.id);
    };

    this.saveState();
    return win.id;
  }

  createFileExplorerWindow(
    id?: string,
    x?: number,
    y?: number,
    initialPath?: string,
    width?: number,
    height?: number
  ): string {
    const win = this.createWindowElement("fileExplorer", id, x, y, width, height);
    const contentEl = win.element.querySelector(
      ".window-content"
    ) as HTMLDivElement;

    const fileExplorerWindow = new FileExplorerWindow(
      contentEl,
      win.id,
      this.vscode,
      initialPath
    );
    win.onDestroy = () => fileExplorerWindow.destroy();

    this.saveState();
    return win.id;
  }

  // --- Message routing ---

  handleMessage(msg: {
    type: string;
    windowId?: string;
    [key: string]: unknown;
  }) {
    if (msg.windowId) {
      const win = this.windows.get(msg.windowId);
      win?.onMessage?.(msg);
    }
  }

  /** Re-fit all windows (called after zoom settles) */
  resizeAllWindows() {
    for (const [, win] of this.windows) {
      win.onResize?.();
    }
  }
}
