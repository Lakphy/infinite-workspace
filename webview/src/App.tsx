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
import { TerminalSquare, Globe, FolderOpen } from "lucide-react";
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

  const updateFavorites = useCallback(
    (newFavorites: Favorites) => {
      setFavorites(newFavorites);
      const prev = vscode.getState() as Record<string, unknown> | null;
      vscode.setState({ ...prev, favorites: newFavorites });
    },
    [vscode]
  );

  const updateSettings = useCallback(
    (newSettings: AppSettings) => {
      setSettings(newSettings);
      const prev = vscode.getState() as Record<string, unknown> | null;
      vscode.setState({ ...prev, settings: newSettings });

      // Apply to canvas and snap engine
      if (canvasRef.current) {
        canvasRef.current.showGrid = newSettings.showGrid;
      }
      if (managerRef.current) {
        const snap = managerRef.current.getSnapEngine();
        snap.enabled = newSettings.enableSnap;
        snap.threshold = newSettings.snapThreshold;
        managerRef.current.setWindowDefaults(newSettings.defaultSizes);
      }
    },
    [vscode]
  );

  const updateOpenOnStartup = useCallback(
    (value: boolean) => {
      setOpenOnStartup(value);
      vscode.postMessage({
        type: "updateExtensionSetting",
        key: "openOnStartup",
        value,
      });
    },
    [vscode]
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
      if (data.type === "extensionSetting" && data.key === "openOnStartup") {
        setOpenOnStartup(!!data.value);
      } else {
        manager.handleMessage(data);
      }
    };
    window.addEventListener("message", handler);

    // Request current openOnStartup setting from extension
    vscode.postMessage({ type: "getExtensionSetting", key: "openOnStartup" });

    // Restore state
    const savedState = vscode.getState() as {
      windows?: WindowState[];
      favorites?: Favorites;
      settings?: AppSettings;
    } | null;
    if (savedState?.favorites) {
      const f = savedState.favorites;
      // Backward compat: old format was string[], new format is FavoriteItem[]
      const migrate = (arr: unknown[] | undefined): FavoriteItem[] =>
        (arr ?? []).map((v) =>
          typeof v === "string" ? { value: v } : (v as FavoriteItem)
        );
      setFavorites({
        terminalCommands: migrate(f.terminalCommands),
        browserUrls: migrate(f.browserUrls),
        fileExplorerPaths: migrate(f.fileExplorerPaths),
      });
    }
    if (savedState?.settings) {
      const s = { ...DEFAULT_SETTINGS, ...savedState.settings };
      setSettings(s);
      canvas.showGrid = s.showGrid;
      const snap = manager.getSnapEngine();
      snap.enabled = s.enableSnap;
      snap.threshold = s.snapThreshold;
      if (s.defaultSizes) {
        manager.setWindowDefaults(s.defaultSizes);
      }
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
