import { useEffect, useRef, useCallback, useState } from "react";
import { Canvas } from "@/lib/canvas";
import { getVsCodeApi } from "@/lib/vscode";
import { WindowManager, type WindowState } from "@/lib/WindowManager";
import { Toolbar, type Favorites } from "@/components/Toolbar";
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

  const updateFavorites = useCallback(
    (newFavorites: Favorites) => {
      setFavorites(newFavorites);
      const prev = vscode.getState() as Record<string, unknown> | null;
      vscode.setState({ ...prev, favorites: newFavorites });
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
      manager.handleMessage(event.data);
    };
    window.addEventListener("message", handler);

    // Restore state
    const savedState = vscode.getState() as {
      windows?: WindowState[];
      favorites?: Favorites;
    } | null;
    if (savedState?.favorites) {
      setFavorites({ fileExplorerPaths: [], ...savedState.favorites });
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
            onNewTerminal={(cmd) =>
              managerRef.current?.createTerminalWindow(undefined, undefined, undefined, cmd)
            }
            onNewBrowser={(url) =>
              managerRef.current?.createBrowserWindow(undefined, undefined, undefined, url)
            }
            onNewFileExplorer={(path) =>
              managerRef.current?.createFileExplorerWindow(undefined, undefined, undefined, path)
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
            {favorites.terminalCommands.map((cmd, i) => (
              <ContextMenuItem
                key={i}
                onClick={() => {
                  const { canvasX, canvasY } = ctxPos();
                  managerRef.current?.createTerminalWindow(undefined, canvasX, canvasY, cmd);
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
                const { canvasX, canvasY } = ctxPos();
                managerRef.current?.createBrowserWindow(undefined, canvasX, canvasY);
              }}
            >
              Empty Browser
            </ContextMenuItem>
            {favorites.browserUrls.length > 0 && <ContextMenuSeparator />}
            {favorites.browserUrls.map((url, i) => (
              <ContextMenuItem
                key={i}
                onClick={() => {
                  const { canvasX, canvasY } = ctxPos();
                  managerRef.current?.createBrowserWindow(undefined, canvasX, canvasY, url);
                }}
              >
                <span className="truncate text-xs">{url}</span>
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
            {favorites.fileExplorerPaths.map((p, i) => (
              <ContextMenuItem
                key={i}
                onClick={() => {
                  const { canvasX, canvasY } = ctxPos();
                  managerRef.current?.createFileExplorerWindow(undefined, canvasX, canvasY, p);
                }}
              >
                <span className="truncate text-xs">{p}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}
