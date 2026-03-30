import { useEffect, useRef, useCallback, useState } from "react";
import { Canvas } from "@/lib/canvas";
import { getVsCodeApi } from "@/lib/vscode";
import { TerminalWindow } from "@/lib/TerminalWindow";
import { BrowserWindow } from "@/lib/BrowserWindow";
import { Toolbar, type Favorites } from "@/components/Toolbar";
import { TerminalSquare, Globe } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface WindowInstance {
  id: string;
  type: "terminal" | "browser";
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

interface WindowState {
  id: string;
  type: "terminal" | "browser";
  x: number;
  y: number;
  width: number;
  height: number;
  extra?: { url?: string };
}

let idCounter = 0;
function generateId(): string {
  return `win-${Date.now()}-${idCounter++}`;
}

export function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const windowsRef = useRef<Map<string, WindowInstance>>(new Map());
  const topZIndexRef = useRef(1);
  const focusedWindowIdRef = useRef<string | null>(null);
  const vscode = getVsCodeApi();
  const [zoomPercent, setZoomPercent] = useState(100);
  const contextMenuPosRef = useRef<{ canvasX: number; canvasY: number }>({ canvasX: 0, canvasY: 0 });
  const [favorites, setFavorites] = useState<Favorites>({ terminalCommands: [], browserUrls: [] });

  const saveState = useCallback(() => {
    const states: WindowState[] = [];
    for (const [, win] of windowsRef.current) {
      states.push({
        id: win.id,
        type: win.type,
        x: win.x,
        y: win.y,
        width: win.width,
        height: win.height,
      });
    }
    const prev = vscode.getState() as Record<string, unknown> | null;
    vscode.setState({ ...prev, windows: states });
  }, [vscode]);

  const updateFavorites = useCallback((newFavorites: Favorites) => {
    setFavorites(newFavorites);
    const prev = vscode.getState() as Record<string, unknown> | null;
    vscode.setState({ ...prev, favorites: newFavorites });
  }, [vscode]);

  const focusWindow = useCallback((windowId: string) => {
    // Unfocus previous
    if (focusedWindowIdRef.current && focusedWindowIdRef.current !== windowId) {
      const prev = windowsRef.current.get(focusedWindowIdRef.current);
      if (prev) prev.element.classList.remove("window-focused");
    }
    const win = windowsRef.current.get(windowId);
    if (win) {
      win.element.classList.add("window-focused");
      win.zIndex = ++topZIndexRef.current;
      win.element.style.zIndex = `${win.zIndex}`;
    }
    focusedWindowIdRef.current = windowId;
  }, []);

  const unfocusAll = useCallback(() => {
    if (focusedWindowIdRef.current) {
      const win = windowsRef.current.get(focusedWindowIdRef.current);
      if (win) win.element.classList.remove("window-focused");
      focusedWindowIdRef.current = null;
    }
  }, []);

  const createWindowElement = useCallback(
    (
      type: "terminal" | "browser",
      id?: string,
      x?: number,
      y?: number,
      width = type === "terminal" ? 650 : 750,
      height = type === "terminal" ? 380 : 520
    ): WindowInstance => {
      const canvas = canvasRef.current!;
      const windowId = id || generateId();

      if (x === undefined || y === undefined) {
        const center = canvas.getViewportCenter();
        // Slight random offset so stacked windows don't overlap exactly
        const jitter = windowsRef.current.size * 24;
        x = center.x - width / 2 + jitter;
        y = center.y - height / 2 + jitter;
      }

      const zIndex = ++topZIndexRef.current;

      const el = document.createElement("div");
      el.className =
        "workspace-window window-enter rounded-lg border border-[oklch(1_0_0/8%)] bg-[oklch(0.16_0_0)] shadow-[0_8px_32px_oklch(0_0_0/45%),0_2px_8px_oklch(0_0_0/25%)]";
      // Store logical canvas-space coordinates in data attributes
      el.dataset.canvasX = `${x}`;
      el.dataset.canvasY = `${y}`;
      el.dataset.canvasW = `${width}`;
      el.dataset.canvasH = `${height}`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.style.zIndex = `${zIndex}`;
      el.style.transformOrigin = "0 0";
      // Apply initial position and scale
      canvas.updateWindowTransform(el);

      const label = type === "terminal" ? "Terminal" : "Browser";
      const iconSvg =
        type === "terminal"
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

      el.innerHTML = `
        <div class="window-titlebar flex items-center justify-between px-2 py-[3px] bg-[oklch(0.20_0_0)] cursor-grab select-none shrink-0 border-b border-[oklch(1_0_0/5%)]" style="user-select:none;-webkit-user-select:none">
          <div class="flex items-center gap-1.5">
            <span class="text-[oklch(0.55_0_0)]">${iconSvg}</span>
            <span class="text-[10px] font-medium text-[oklch(0.6_0_0)]">${label}</span>
          </div>
          <button class="window-close inline-flex items-center justify-center size-[16px] rounded-full text-[oklch(0.5_0_0)] hover:bg-[oklch(0.65_0.25_25)] hover:text-white transition-all duration-150 cursor-pointer border-none bg-transparent">
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div class="window-content flex-1 overflow-hidden relative flex flex-col"></div>
        <div class="window-resize-handle"></div>
        <div class="window-focus-overlay"></div>
      `;

      canvas.layer.appendChild(el);

      // Remove entrance animation class after it plays
      el.addEventListener("animationend", () => {
        el.classList.remove("window-enter");
      }, { once: true });

      const win: WindowInstance = {
        id: windowId,
        type,
        element: el,
        x,
        y,
        width,
        height,
        zIndex,
      };

      windowsRef.current.set(windowId, win);

      // Click on window border to focus (and prevent canvas pan)
      el.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        focusWindow(windowId);
      });

      // Stop propagation on content area (only reachable when focused)
      const content = el.querySelector(".window-content") as HTMLDivElement;
      content.addEventListener("pointerdown", (e) => e.stopPropagation());
      content.addEventListener("wheel", (e) => e.stopPropagation(), {
        passive: false,
      });

      // Focus overlay: captures pointer events on unfocused windows,
      // but lets wheel events bubble through for canvas panning
      const overlay = el.querySelector(".window-focus-overlay") as HTMLDivElement;
      overlay.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        focusWindow(windowId);
      });

      setupDrag(win, canvas, saveState);
      setupResize(win, canvas, saveState);

      const closeBtn = el.querySelector(".window-close") as HTMLButtonElement;
      closeBtn.addEventListener("click", () => destroyWindow(windowId));

      return win;
    },
    [saveState, focusWindow]
  );

  const destroyWindow = useCallback(
    (windowId: string) => {
      const win = windowsRef.current.get(windowId);
      if (!win) return;
      if (focusedWindowIdRef.current === windowId) {
        focusedWindowIdRef.current = null;
      }
      win.onDestroy?.();

      // Exit animation — only fade opacity since transform is used for positioning
      win.element.style.transition = "opacity 0.15s ease";
      win.element.style.opacity = "0";
      setTimeout(() => {
        win.element.remove();
      }, 150);

      windowsRef.current.delete(windowId);
      saveState();
    },
    [saveState]
  );

  const createTerminalWindow = useCallback(
    (id?: string, x?: number, y?: number, initialCommand?: string) => {
      const win = createWindowElement("terminal", id, x, y);
      const contentEl = win.element.querySelector(
        ".window-content"
      ) as HTMLDivElement;

      const termWindow = new TerminalWindow(contentEl, win.id, vscode);
      win.onDestroy = () => termWindow.destroy();
      win.onResize = () => termWindow.fit();

      // If an initial command is provided, send it once the shell is ready
      if (initialCommand) {
        let sent = false;
        win.onMessage = (msg) => {
          termWindow.handleMessage(msg);
          if (!sent && msg.type === "ptyOutput") {
            sent = true;
            vscode.postMessage({
              type: "ptyInput",
              windowId: win.id,
              data: initialCommand + "\r",
            });
          }
        };
      } else {
        win.onMessage = (msg) => termWindow.handleMessage(msg);
      }

      saveState();
      return win.id;
    },
    [createWindowElement, vscode, saveState]
  );

  const createBrowserWindow = useCallback(
    (id?: string, x?: number, y?: number, url?: string) => {
      const win = createWindowElement("browser", id, x, y);
      const contentEl = win.element.querySelector(
        ".window-content"
      ) as HTMLDivElement;

      const browserWindow = new BrowserWindow(contentEl, win.id, url);
      win.onDestroy = () => browserWindow.destroy();

      saveState();
      return win.id;
    },
    [createWindowElement, saveState]
  );

  const getWindowRects = useCallback(() => {
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    for (const [, win] of windowsRef.current) {
      rects.push({ x: win.x, y: win.y, width: win.width, height: win.height });
    }
    return rects;
  }, []);

  // Initialize canvas
  useEffect(() => {
    if (!rootRef.current || canvasRef.current) return;

    const canvas = new Canvas(rootRef.current);
    canvasRef.current = canvas;

    // Track zoom changes
    canvas.onChange(({ scale }: { scale: number }) => {
      setZoomPercent(Math.round(scale * 100));
    });

    // When zoom settles, re-fit terminals for crisp rendering
    const unsettle = canvas.onSettle(() => {
      for (const [, win] of windowsRef.current) {
        win.onResize?.();
      }
    });

    // Click on canvas background unfocuses all windows
    canvas.viewport.addEventListener("pointerdown", () => {
      unfocusAll();
    });

    // Listen for extension messages
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.windowId) {
        const win = windowsRef.current.get(msg.windowId);
        win?.onMessage?.(msg);
      }
    };
    window.addEventListener("message", handler);

    return () => {
      window.removeEventListener("message", handler);
      unsettle();
      canvas.destroy();
    };
  }, []);

  // Restore state
  useEffect(() => {
    if (!canvasRef.current) return;

    const savedState = vscode.getState() as {
      windows?: WindowState[];
      favorites?: Favorites;
    } | null;
    if (savedState?.favorites) {
      setFavorites(savedState.favorites);
    }
    if (savedState?.windows) {
      for (const s of savedState.windows) {
        if (s.type === "terminal") {
          createTerminalWindow(s.id, s.x, s.y);
        } else {
          createBrowserWindow(s.id, s.x, s.y, s.extra?.url);
        }
        const win = windowsRef.current.get(s.id);
        if (win) {
          win.width = s.width;
          win.height = s.height;
          win.element.dataset.canvasW = `${s.width}`;
          win.element.dataset.canvasH = `${s.height}`;
          win.element.style.width = `${s.width}px`;
          win.element.style.height = `${s.height}px`;
          canvasRef.current?.updateWindowTransform(win.element);
          win.onResize?.();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // Don't override right-click inside focused windows
      if ((e.target as HTMLElement).closest(".window-focused")) {
        e.preventDefault(); // prevent radix menu from opening
        return;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const pos = canvas.screenToCanvas(e.clientX, e.clientY);
        contextMenuPosRef.current = { canvasX: pos.x, canvasY: pos.y };
      }
    },
    []
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        <div ref={rootRef} className="w-full h-full overflow-hidden relative">
          <Toolbar
            onNewTerminal={(cmd) => createTerminalWindow(undefined, undefined, undefined, cmd)}
            onNewBrowser={(url) => createBrowserWindow(undefined, undefined, undefined, url)}
            onZoomIn={() => canvasRef.current?.zoomTo(canvasRef.current.getScale() * 1.3)}
            onZoomOut={() => canvasRef.current?.zoomTo(canvasRef.current.getScale() / 1.3)}
            onFitAll={() => canvasRef.current?.fitAll(getWindowRects())}
            onResetView={() => canvasRef.current?.resetView()}
            zoomPercent={zoomPercent}
            favorites={favorites}
            onUpdateFavorites={updateFavorites}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[180px]">
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <TerminalSquare className="size-4" />
            New Terminal
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              onClick={() => {
                const { canvasX, canvasY } = contextMenuPosRef.current;
                createTerminalWindow(undefined, canvasX, canvasY);
              }}
            >
              Empty Terminal
            </ContextMenuItem>
            {favorites.terminalCommands.length > 0 && <ContextMenuSeparator />}
            {favorites.terminalCommands.map((cmd, i) => (
              <ContextMenuItem
                key={i}
                onClick={() => {
                  const { canvasX, canvasY } = contextMenuPosRef.current;
                  createTerminalWindow(undefined, canvasX, canvasY, cmd);
                }}
              >
                <span className="truncate font-mono text-xs">{cmd}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Globe className="size-4" />
            New Browser
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              onClick={() => {
                const { canvasX, canvasY } = contextMenuPosRef.current;
                createBrowserWindow(undefined, canvasX, canvasY);
              }}
            >
              Empty Browser
            </ContextMenuItem>
            {favorites.browserUrls.length > 0 && <ContextMenuSeparator />}
            {favorites.browserUrls.map((url, i) => (
              <ContextMenuItem
                key={i}
                onClick={() => {
                  const { canvasX, canvasY } = contextMenuPosRef.current;
                  createBrowserWindow(undefined, canvasX, canvasY, url);
                }}
              >
                <span className="truncate text-xs">{url}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// --- Imperative helpers ---

function setupDrag(win: WindowInstance, canvas: Canvas, saveState: () => void) {
  const titlebar = win.element.querySelector(
    ".window-titlebar"
  ) as HTMLDivElement;
  let startX = 0;
  let startY = 0;
  let startWinX = 0;
  let startWinY = 0;

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest(".window-close")) return;
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    startWinX = win.x;
    startWinY = win.y;
    win.element.classList.add("dragging");
    titlebar.setPointerCapture(e.pointerId);
    titlebar.addEventListener("pointermove", onPointerMove);
    titlebar.addEventListener("pointerup", onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    const scale = canvas.getScale();
    const dx = (e.clientX - startX) / scale;
    const dy = (e.clientY - startY) / scale;
    win.x = startWinX + dx;
    win.y = startWinY + dy;
    win.element.dataset.canvasX = `${win.x}`;
    win.element.dataset.canvasY = `${win.y}`;
    canvas.updateWindowTransform(win.element);
  };

  const onPointerUp = (e: PointerEvent) => {
    titlebar.releasePointerCapture(e.pointerId);
    titlebar.removeEventListener("pointermove", onPointerMove);
    titlebar.removeEventListener("pointerup", onPointerUp);
    win.element.classList.remove("dragging");
    saveState();
  };

  titlebar.addEventListener("pointerdown", onPointerDown);
}

function setupResize(
  win: WindowInstance,
  canvas: Canvas,
  saveState: () => void
) {
  const handle = win.element.querySelector(
    ".window-resize-handle"
  ) as HTMLDivElement;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    startW = win.width;
    startH = win.height;
    handle.setPointerCapture(e.pointerId);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    const scale = canvas.getScale();
    const dx = (e.clientX - startX) / scale;
    const dy = (e.clientY - startY) / scale;
    win.width = Math.max(200, startW + dx);
    win.height = Math.max(150, startH + dy);
    win.element.dataset.canvasW = `${win.width}`;
    win.element.dataset.canvasH = `${win.height}`;
    win.element.style.width = `${win.width}px`;
    win.element.style.height = `${win.height}px`;
    canvas.updateWindowTransform(win.element);
    win.onResize?.();
  };

  const onPointerUp = (e: PointerEvent) => {
    handle.releasePointerCapture(e.pointerId);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", onPointerUp);
    saveState();
  };

  handle.addEventListener("pointerdown", onPointerDown);
}
