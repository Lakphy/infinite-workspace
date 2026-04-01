import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  TerminalSquare,
  Globe,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  ChevronDown,
  Plus,
  X,
  Settings,
} from "lucide-react";

export interface FavoriteItem {
  value: string;
  width?: number;
  height?: number;
}

export interface Favorites {
  terminalCommands: FavoriteItem[];
  browserUrls: FavoriteItem[];
  fileExplorerPaths: FavoriteItem[];
}

interface ToolbarProps {
  onNewTerminal: (command?: string, width?: number, height?: number) => void;
  onNewBrowser: (url?: string, width?: number, height?: number) => void;
  onNewFileExplorer: (path?: string, width?: number, height?: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
  onResetView: () => void;
  zoomPercent: number;
  favorites: Favorites;
  onUpdateFavorites: (favorites: Favorites) => void;
  onOpenSettings: () => void;
}

/* ── Split button: main action + dropdown ── */

function SplitButton({
  icon: Icon,
  label,
  tooltip,
  onDefault,
  onSelectItem,
  emptyLabel,
  items,
  onRemoveItem,
  addLabel,
  onAdd,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tooltip: string;
  onDefault: () => void;
  onSelectItem: (item: FavoriteItem) => void;
  emptyLabel: string;
  items: FavoriteItem[];
  onRemoveItem: (index: number) => void;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDefault}
            className="gap-1.5 h-7 px-2 text-xs rounded-md rounded-r-none"
          >
            <Icon className="size-3.5" />
            {label}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-5 px-0 rounded-md rounded-l-none border-l border-border/30"
          >
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8}>
          <DropdownMenuItem onSelect={onDefault}>
            <Icon className="size-4" />
            {emptyLabel}
          </DropdownMenuItem>
          {items.length > 0 && <DropdownMenuSeparator />}
          {items.map((item, index) => (
            <DropdownMenuItem
              key={index}
              className="justify-between gap-4"
              onSelect={() => onSelectItem(item)}
            >
              <span className="truncate font-mono text-xs">{item.value}</span>
              <span
                role="button"
                className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemoveItem(index);
                }}
              >
                <X className="size-3.5" />
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onAdd}>
            <Plus className="size-4" />
            {addLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ── Icon button with tooltip ── */

function IconBtn({
  icon: Icon,
  tooltip,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClick}
          className="rounded-md"
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Toolbar ── */

export function Toolbar({
  onNewTerminal,
  onNewBrowser,
  onNewFileExplorer,
  onZoomIn,
  onZoomOut,
  onFitAll,
  onResetView,
  zoomPercent,
  favorites,
  onUpdateFavorites,
  onOpenSettings,
}: ToolbarProps) {
  const [addDialog, setAddDialog] = useState<
    "terminal" | "browser" | "fileExplorer" | null
  >(null);
  const [addValue, setAddValue] = useState("");

  const handleAdd = () => {
    const val = addValue.trim();
    if (!val || !addDialog) return;
    const item: FavoriteItem = { value: val };
    if (addDialog === "terminal") {
      onUpdateFavorites({
        ...favorites,
        terminalCommands: [...favorites.terminalCommands, item],
      });
    } else if (addDialog === "browser") {
      onUpdateFavorites({
        ...favorites,
        browserUrls: [...favorites.browserUrls, item],
      });
    } else {
      onUpdateFavorites({
        ...favorites,
        fileExplorerPaths: [...favorites.fileExplorerPaths, item],
      });
    }
    setAddValue("");
    setAddDialog(null);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="toolbar-container">
        {/* ── Create window buttons ── */}
        <div className="toolbar-group">
          <SplitButton
            icon={TerminalSquare}
            label="Terminal"
            tooltip="New Terminal"
            onDefault={() => onNewTerminal()}
            onSelectItem={(item) =>
              onNewTerminal(item.value, item.width, item.height)
            }
            emptyLabel="Empty Terminal"
            items={favorites.terminalCommands}
            onRemoveItem={(i) =>
              onUpdateFavorites({
                ...favorites,
                terminalCommands: favorites.terminalCommands.filter(
                  (_, idx) => idx !== i
                ),
              })
            }
            addLabel="Add Command..."
            onAdd={() => {
              setAddValue("");
              setAddDialog("terminal");
            }}
          />

          <SplitButton
            icon={Globe}
            label="Browser"
            tooltip="New Browser"
            onDefault={() => onNewBrowser()}
            onSelectItem={(item) =>
              onNewBrowser(item.value, item.width, item.height)
            }
            emptyLabel="Empty Browser"
            items={favorites.browserUrls}
            onRemoveItem={(i) =>
              onUpdateFavorites({
                ...favorites,
                browserUrls: favorites.browserUrls.filter(
                  (_, idx) => idx !== i
                ),
              })
            }
            addLabel="Add URL..."
            onAdd={() => {
              setAddValue("");
              setAddDialog("browser");
            }}
          />

          <SplitButton
            icon={FolderOpen}
            label="Files"
            tooltip="New File Explorer"
            onDefault={() => onNewFileExplorer()}
            onSelectItem={(item) =>
              onNewFileExplorer(item.value, item.width, item.height)
            }
            emptyLabel="Workspace Root"
            items={favorites.fileExplorerPaths}
            onRemoveItem={(i) =>
              onUpdateFavorites({
                ...favorites,
                fileExplorerPaths: favorites.fileExplorerPaths.filter(
                  (_, idx) => idx !== i
                ),
              })
            }
            addLabel="Add Path..."
            onAdd={() => {
              setAddValue("");
              setAddDialog("fileExplorer");
            }}
          />
        </div>

        <div className="toolbar-divider" />

        {/* ── Zoom controls ── */}
        <div className="toolbar-group">
          <IconBtn icon={ZoomOut} tooltip="Zoom Out" onClick={onZoomOut} />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onResetView}
                className="h-6 min-w-[3rem] px-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground tabular-nums transition-colors rounded-md hover:bg-accent cursor-pointer"
              >
                {zoomPercent}%
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p>Reset to 100%</p>
            </TooltipContent>
          </Tooltip>

          <IconBtn icon={ZoomIn} tooltip="Zoom In" onClick={onZoomIn} />
        </div>

        <div className="toolbar-divider" />

        {/* ── View controls ── */}
        <div className="toolbar-group">
          <IconBtn
            icon={Maximize}
            tooltip="Fit All Windows"
            onClick={onFitAll}
          />
          <IconBtn
            icon={RotateCcw}
            tooltip="Reset View"
            onClick={onResetView}
          />
        </div>

        <div className="toolbar-divider" />

        {/* ── Settings ── */}
        <IconBtn
          icon={Settings}
          tooltip="Settings"
          onClick={onOpenSettings}
        />
      </div>

      {/* ── Add favorite dialog ── */}
      <Dialog
        open={addDialog !== null}
        onOpenChange={(open: boolean) => !open && setAddDialog(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {addDialog === "terminal"
                ? "Add Startup Command"
                : addDialog === "browser"
                  ? "Add Favorite URL"
                  : "Add Favorite Path"}
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder={
              addDialog === "terminal"
                ? "e.g. npm run dev"
                : addDialog === "browser"
                  ? "e.g. http://localhost:3000"
                  : "e.g. /Users/me/projects"
            }
            value={addValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddValue(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (
                e.key === "Enter" &&
                !e.nativeEvent.isComposing &&
                addValue.trim()
              )
                handleAdd();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!addValue.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
