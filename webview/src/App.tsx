import { useEffect, useRef, useCallback, useState } from "react";
import { Canvas } from "@/lib/canvas";
import { getVsCodeApi } from "@/lib/vscode";
import { WindowManager, type WindowState } from "@/lib/WindowManager";
import { Toolbar, type Favorites, type FavoriteItem } from "@/components/Toolbar";
import {
  SettingsDialog,
  type AppSettings,
  DEFAULT_SETTINGS,
} from "@/components/SettingsDialog";
import { setWindowMinSize } from "@/lib/dragResize";
import { TerminalSquare, Globe, FolderOpen, Sparkles } from "lucide-react";
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

/**
 * Parse the flat settings object from the extension host into the structured
 * AppSettings + Favorites format used by the webview.
 */
function parseVsCodeSettings(raw: Record<string, unknown>): {
  settings: AppSettings;
  favorites: Favorites;
  openOnStartup: boolean;
} {
  const get = <T,>(key: string, fallback: T): T => {
    const val = raw[key];
    return val !== undefined ? (val as T) : fallback;
  };

  const colorMode = get<"dark" | "light">("colorMode", DEFAULT_SETTINGS.colorMode);

  const settings: AppSettings = {
    showGrid: get("canvas.showGrid", DEFAULT_SETTINGS.showGrid),
    enableSnap: get("snap.enabled", DEFAULT_SETTINGS.enableSnap),
    snapThreshold: get("snap.threshold", DEFAULT_SETTINGS.snapThreshold),
    colorMode,
    defaultSizes: {
      terminal: {
        width: get("defaultSize.terminal.width", DEFAULT_SETTINGS.defaultSizes.terminal.width),
        height: get("defaultSize.terminal.height", DEFAULT_SETTINGS.defaultSizes.terminal.height),
      },
      browser: {
        width: get("defaultSize.browser.width", DEFAULT_SETTINGS.defaultSizes.browser.width),
        height: get("defaultSize.browser.height", DEFAULT_SETTINGS.defaultSizes.browser.height),
      },
      fileExplorer: {
        width: get("defaultSize.fileExplorer.width", DEFAULT_SETTINGS.defaultSizes.fileExplorer.width),
        height: get("defaultSize.fileExplorer.height", DEFAULT_SETTINGS.defaultSizes.fileExplorer.height),
      },
      agent: {
        width: get("defaultSize.agent.width", DEFAULT_SETTINGS.defaultSizes.agent.width),
        height: get("defaultSize.agent.height", DEFAULT_SETTINGS.defaultSizes.agent.height),
      },
    },
    canvas: {
      minScale: get("canvas.minScale", DEFAULT_SETTINGS.canvas.minScale),
      maxScale: get("canvas.maxScale", DEFAULT_SETTINGS.canvas.maxScale),
      zoomSpeed: get("canvas.zoomSpeed", DEFAULT_SETTINGS.canvas.zoomSpeed),
      lerpFactor: get("canvas.lerpFactor", DEFAULT_SETTINGS.canvas.lerpFactor),
      gridSpacing: get("canvas.gridSpacing", DEFAULT_SETTINGS.canvas.gridSpacing),
    },
    window: {
      minWidth: get("window.minWidth", DEFAULT_SETTINGS.window.minWidth),
      minHeight: get("window.minHeight", DEFAULT_SETTINGS.window.minHeight),
    },
    terminal: {
      fontSize: get("terminal.fontSize", DEFAULT_SETTINGS.terminal.fontSize),
      lineHeight: get("terminal.lineHeight", DEFAULT_SETTINGS.terminal.lineHeight),
      letterSpacing: get("terminal.letterSpacing", DEFAULT_SETTINGS.terminal.letterSpacing),
      fontFamily: get("terminal.fontFamily", DEFAULT_SETTINGS.terminal.fontFamily),
      cursorBlink: get("terminal.cursorBlink", DEFAULT_SETTINGS.terminal.cursorBlink),
      cursorStyle: get("terminal.cursorStyle", DEFAULT_SETTINGS.terminal.cursorStyle),
      scrollback: get("terminal.scrollback", DEFAULT_SETTINGS.terminal.scrollback),
    },
  };

  const migrate = (arr: unknown[] | undefined): FavoriteItem[] =>
    (arr ?? []).map((v) =>
      typeof v === "string" ? { value: v } : (v as FavoriteItem)
    );

  const favorites: Favorites = {
    terminalCommands: migrate(get<unknown[]>("favorites.terminalCommands", [])),
    browserUrls: migrate(get<unknown[]>("favorites.browserUrls", [])),
    fileExplorerPaths: migrate(get<unknown[]>("favorites.fileExplorerPaths", [])),
    agentPaths: migrate(get<unknown[]>("favorites.agentPaths", [])),
  };

  const openOnStartup = get<boolean>("openOnStartup", false);

  return { settings, favorites, openOnStartup };
}

/**
 * Apply the dark/light color mode to the document and browser iframes.
 */
function applyColorMode(mode: "dark" | "light") {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  // Update color-scheme so browser UI elements (scrollbars etc.) match
  root.style.colorScheme = mode;

  // Update all existing browser iframes
  const iframes = document.querySelectorAll<HTMLIFrameElement>(".browser-frame");
  for (const iframe of iframes) {
    iframe.style.colorScheme = mode;
  }
}

/**
 * Apply the structured AppSettings to all runtime systems.
 */
function applySettingsToRuntime(
  settings: AppSettings,
  canvas: Canvas | null,
  manager: WindowManager | null
) {
  // Apply color mode
  applyColorMode(settings.colorMode);

  if (canvas) {
    canvas.showGrid = settings.showGrid;
    canvas.applyConfig(settings.canvas);
    // Re-draw grid since colors changed
    canvas.setColorMode(settings.colorMode);
  }
  if (manager) {
    const snap = manager.getSnapEngine();
    snap.enabled = settings.enableSnap;
    snap.threshold = settings.snapThreshold;
    manager.setWindowDefaults(settings.defaultSizes);
    manager.setTerminalConfig(settings.terminal);
    manager.setColorMode(settings.colorMode);
  }
  setWindowMinSize(settings.window.minWidth, settings.window.minHeight);
}

export function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const managerRef = useRef<WindowManager | null>(null);
  const vscode = getVsCodeApi();
  const [zoomPercent, setZoomPercent] = useState(100);
  const contextMenuPosRef = useRef<{ canvasX: number; canvasY: number }>({
    canvasX: 0,
    canvasY: 0,
  });
  const [favorites, setFavorites] = useState<Favorites>({
    terminalCommands: [],
    browserUrls: [],
    fileExplorerPaths: [],
  });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openOnStartup, setOpenOnStartup] = useState(false);

  /**
   * Write a single setting back to VS Code settings.json via the extension host.
   */
  const writeSetting = useCallback(
    (key: string, value: unknown) => {
      vscode.postMessage({
        type: "updateExtensionSetting",
        key,
        value,
      });
    },
    [vscode]
  );

  /**
   * Write all settings back to VS Code settings.json (batch).
   */
  const writeAllSettings = useCallback(
    (s: AppSettings, f: Favorites) => {
      // Canvas
      writeSetting("canvas.showGrid", s.showGrid);
      writeSetting("canvas.minScale", s.canvas.minScale);
      writeSetting("canvas.maxScale", s.canvas.maxScale);
      writeSetting("canvas.zoomSpeed", s.canvas.zoomSpeed);
      writeSetting("canvas.lerpFactor", s.canvas.lerpFactor);
      writeSetting("canvas.gridSpacing", s.canvas.gridSpacing);
      // Snap
      writeSetting("snap.enabled", s.enableSnap);
      writeSetting("snap.threshold", s.snapThreshold);
      // Color mode
      writeSetting("colorMode", s.colorMode);
      // Default sizes
      writeSetting("defaultSize.terminal.width", s.defaultSizes.terminal.width);
      writeSetting("defaultSize.terminal.height", s.defaultSizes.terminal.height);
      writeSetting("defaultSize.browser.width", s.defaultSizes.browser.width);
      writeSetting("defaultSize.browser.height", s.defaultSizes.browser.height);
      writeSetting("defaultSize.fileExplorer.width", s.defaultSizes.fileExplorer.width);
      writeSetting("defaultSize.fileExplorer.height", s.defaultSizes.fileExplorer.height);
      writeSetting("defaultSize.agent.width", s.defaultSizes.agent.width);
      writeSetting("defaultSize.agent.height", s.defaultSizes.agent.height);
      // Window constraints
      writeSetting("window.minWidth", s.window.minWidth);
      writeSetting("window.minHeight", s.window.minHeight);
      // Terminal
      writeSetting("terminal.fontSize", s.terminal.fontSize);
      writeSetting("terminal.lineHeight", s.terminal.lineHeight);
      writeSetting("terminal.letterSpacing", s.terminal.letterSpacing);
      writeSetting("terminal.fontFamily", s.terminal.fontFamily);
      writeSetting("terminal.cursorBlink", s.terminal.cursorBlink);
      writeSetting("terminal.cursorStyle", s.terminal.cursorStyle);
      writeSetting("terminal.scrollback", s.terminal.scrollback);
      // Favorites
      writeSetting("favorites.terminalCommands", f.terminalCommands);
      writeSetting("favorites.browserUrls", f.browserUrls);
      writeSetting("favorites.fileExplorerPaths", f.fileExplorerPaths);
      writeSetting("favorites.agentPaths", f.agentPaths || []);
    },
    [writeSetting]
  );

  const updateFavorites = useCallback(
    (newFavorites: Favorites) => {
      setFavorites(newFavorites);
      // Write to VS Code settings
      writeSetting("favorites.terminalCommands", newFavorites.terminalCommands);
      writeSetting("favorites.browserUrls", newFavorites.browserUrls);
      writeSetting("favorites.fileExplorerPaths", newFavorites.fileExplorerPaths);
      writeSetting("favorites.agentPaths", newFavorites.agentPaths || []);
      // Also save to webview state for quick restore
      const prev = vscode.getState() as Record<string, unknown> | null;
      vscode.setState({ ...prev, favorites: newFavorites });
    },
    [vscode, writeSetting]
  );

  const updateSettings = useCallback(
    (newSettings: AppSettings) => {
      setSettings(newSettings);
      // Apply to runtime
      applySettingsToRuntime(newSettings, canvasRef.current, managerRef.current);
      // Write ALL settings back to VS Code settings.json
      // We read current favorites from state to include in the batch
      setFavorites((currentFavorites) => {
        writeAllSettings(newSettings, currentFavorites);
        return currentFavorites;
      });
      // Also save to webview state for quick restore
      const prev = vscode.getState() as Record<string, unknown> | null;
      vscode.setState({ ...prev, settings: newSettings });
    },
    [vscode, writeAllSettings]
  );

  const updateOpenOnStartup = useCallback(
    (value: boolean) => {
      setOpenOnStartup(value);
      writeSetting("openOnStartup", value);
    },
    [writeSetting]
  );

  // Initialize canvas + window manager + restore state
  useEffect(() => {
    if (!rootRef.current || canvasRef.current) return;

    const canvas = new Canvas(rootRef.current);
    canvasRef.current = canvas;

    const manager = new WindowManager(canvas, vscode);
    managerRef.current = manager;

    // Track zoom changes
    canvas.onChange(({ scale }: { scale: number }) => {
      setZoomPercent(Math.round(scale * 100));
    });

    // When zoom settles, re-fit terminals for crisp rendering
    const unsettle = canvas.onSettle(() => {
      manager.resizeAllWindows();
    });

    // Click on canvas background unfocuses all windows
    canvas.viewport.addEventListener("pointerdown", () => {
      manager.unfocusAll();
    });

    // Listen for extension messages
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data.type === "allSettings") {
        // Settings pushed from VS Code extension host
        const parsed = parseVsCodeSettings(data.settings);
        setSettings(parsed.settings);
        setFavorites(parsed.favorites);
        setOpenOnStartup(parsed.openOnStartup);
        applySettingsToRuntime(parsed.settings, canvas, manager);
      } else if (data.type === "extensionSetting" && data.key === "openOnStartup") {
        setOpenOnStartup(!!data.value);
      } else {
        manager.handleMessage(data);
      }
    };
    window.addEventListener("message", handler);

    // Request all settings from the extension host
    vscode.postMessage({ type: "getAllSettings" });

    // Restore state (window positions etc.)
    const savedState = vscode.getState() as {
      windows?: WindowState[];
      favorites?: Favorites;
      settings?: AppSettings;
    } | null;

    // Restore settings from webview state as a fallback (before extension pushes them)
    if (savedState?.settings) {
      const s = { ...DEFAULT_SETTINGS, ...savedState.settings };
      setSettings(s);
      applySettingsToRuntime(s, canvas, manager);
    }
    if (savedState?.favorites) {
      const f = savedState.favorites;
      const migrate = (arr: unknown[] | undefined): FavoriteItem[] =>
        (arr ?? []).map((v) =>
          typeof v === "string" ? { value: v } : (v as FavoriteItem)
        );
      setFavorites({
        terminalCommands: migrate(f.terminalCommands),
        browserUrls: migrate(f.browserUrls),
        fileExplorerPaths: migrate(f.fileExplorerPaths),
        agentPaths: migrate(f.agentPaths),
      });
    }
    if (savedState?.windows) {
      manager.restoreState(savedState.windows);
    }

    return () => {
      window.removeEventListener("message", handler);
      unsettle();
      canvas.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // Don't override right-click inside focused windows
      if ((e.target as HTMLElement).closest(".window-focused")) {
        e.preventDefault();
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

  // Shorthand to get context menu position
  const ctxPos = () => contextMenuPosRef.current;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        <div ref={rootRef} className="w-full h-full overflow-hidden relative">
          <Toolbar
            onNewTerminal={(cmd, w, h) =>
              managerRef.current?.createTerminalWindow(undefined, undefined, undefined, cmd, w, h)
            }
            onNewBrowser={(url, w, h) =>
              managerRef.current?.createBrowserWindow(undefined, undefined, undefined, url, w, h)
            }
            onNewFileExplorer={(path, w, h) =>
              managerRef.current?.createFileExplorerWindow(undefined, undefined, undefined, path, w, h)
            }
            onNewAgent={(path, w, h) =>
              managerRef.current?.createAgentWindow(undefined, undefined, undefined, path, w, h)
            }
            onZoomIn={() =>
              canvasRef.current?.zoomTo(canvasRef.current.getScale() * 1.3)
            }
            onZoomOut={() =>
              canvasRef.current?.zoomTo(canvasRef.current.getScale() / 1.3)
            }
            onFitAll={() =>
              canvasRef.current?.fitAll(managerRef.current?.getWindowRects() || [])
            }
            onResetView={() => canvasRef.current?.resetView()}
            zoomPercent={zoomPercent}
            favorites={favorites}
            onUpdateFavorites={updateFavorites}
            onOpenSettings={() => setSettingsOpen(true)}
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
                const { canvasX, canvasY } = ctxPos();
                managerRef.current?.createTerminalWindow(undefined, canvasX, canvasY);
              }}
            >
              Empty Terminal
            </ContextMenuItem>
            {favorites.terminalCommands.length > 0 && <ContextMenuSeparator />}
            {favorites.terminalCommands.map((item, i) => (
              <ContextMenuItem
                key={i}
                onClick={() => {
                  const { canvasX, canvasY } = ctxPos();
                  managerRef.current?.createTerminalWindow(undefined, canvasX, canvasY, item.value, item.width, item.height);
                }}
              >
                <span className="truncate font-mono text-xs">{item.value}</span>
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
                const { canvasX, canvasY } = ctxPos();
                managerRef.current?.createBrowserWindow(undefined, canvasX, canvasY);
              }}
            >
              Empty Browser
            </ContextMenuItem>
            {favorites.browserUrls.length > 0 && <ContextMenuSeparator />}
            {favorites.browserUrls.map((item, i) => (
              <ContextMenuItem
                key={i}
                onClick={() => {
                  const { canvasX, canvasY } = ctxPos();
                  managerRef.current?.createBrowserWindow(undefined, canvasX, canvasY, item.value, item.width, item.height);
                }}
              >
                <span className="truncate text-xs">{item.value}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderOpen className="size-4" />
            New File Explorer
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              onClick={() => {
                const { canvasX, canvasY } = ctxPos();
                managerRef.current?.createFileExplorerWindow(undefined, canvasX, canvasY);
              }}
            >
              Workspace Root
            </ContextMenuItem>
            {favorites.fileExplorerPaths.length > 0 && <ContextMenuSeparator />}
            {favorites.fileExplorerPaths.map((item, i) => (
              <ContextMenuItem
                key={i}
                onClick={() => {
                  const { canvasX, canvasY } = ctxPos();
                  managerRef.current?.createFileExplorerWindow(undefined, canvasX, canvasY, item.value, item.width, item.height);
                }}
              >
                <span className="truncate text-xs">{item.value}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Sparkles className="size-4" />
            New Agent
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              onClick={() => {
                const { canvasX, canvasY } = ctxPos();
                managerRef.current?.createAgentWindow(undefined, canvasX, canvasY);
              }}
            >
              Workspace Root
            </ContextMenuItem>
            {(favorites.agentPaths || []).length > 0 && <ContextMenuSeparator />}
            {(favorites.agentPaths || []).map((item, i) => (
              <ContextMenuItem
                key={i}
                onClick={() => {
                  const { canvasX, canvasY } = ctxPos();
                  managerRef.current?.createAgentWindow(undefined, canvasX, canvasY, item.value, item.width, item.height);
                }}
              >
                <span className="truncate text-xs">{item.value}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onUpdateSettings={updateSettings}
        favorites={favorites}
        onUpdateFavorites={updateFavorites}
        openOnStartup={openOnStartup}
        onUpdateOpenOnStartup={updateOpenOnStartup}
      />
    </ContextMenu>
  );
}
