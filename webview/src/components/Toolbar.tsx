import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  ChevronDown,
  Plus,
  X,
} from "lucide-react";

export interface Favorites {
  terminalCommands: string[];
  browserUrls: string[];
}

interface ToolbarProps {
  onNewTerminal: (command?: string) => void;
  onNewBrowser: (url?: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
  onResetView: () => void;
  zoomPercent: number;
  favorites: Favorites;
  onUpdateFavorites: (favorites: Favorites) => void;
}

export function Toolbar({
  onNewTerminal,
  onNewBrowser,
  onZoomIn,
  onZoomOut,
  onFitAll,
  onResetView,
  zoomPercent,
  favorites,
  onUpdateFavorites,
}: ToolbarProps) {
  const [addDialog, setAddDialog] = useState<"terminal" | "browser" | null>(
    null
  );
  const [addValue, setAddValue] = useState("");

  const handleAdd = () => {
    const val = addValue.trim();
    if (!val || !addDialog) return;
    if (addDialog === "terminal") {
      onUpdateFavorites({
        ...favorites,
        terminalCommands: [...favorites.terminalCommands, val],
      });
    } else {
      onUpdateFavorites({
        ...favorites,
        browserUrls: [...favorites.browserUrls, val],
      });
    }
    setAddValue("");
    setAddDialog(null);
  };

  const removeTerminalCommand = (index: number) => {
    onUpdateFavorites({
      ...favorites,
      terminalCommands: favorites.terminalCommands.filter(
        (_, i) => i !== index
      ),
    });
  };

  const removeBrowserUrl = (index: number) => {
    onUpdateFavorites({
      ...favorites,
      browserUrls: favorites.browserUrls.filter((_, i) => i !== index),
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-0.5 px-1.5 py-1 bg-popover/70 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl">
        {/* Terminal split button */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNewTerminal()}
                className="gap-1.5 h-7 px-2.5 text-xs rounded-lg rounded-r-none"
              >
                <TerminalSquare className="size-3.5" />
                Terminal
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p>New Terminal</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1 rounded-lg rounded-l-none border-l border-border/30"
              >
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8}>
              <DropdownMenuItem onSelect={() => onNewTerminal()}>
                <TerminalSquare className="size-4" />
                Empty Terminal
              </DropdownMenuItem>
              {favorites.terminalCommands.length > 0 && (
                <DropdownMenuSeparator />
              )}
              {favorites.terminalCommands.map((cmd, index) => (
                <DropdownMenuItem
                  key={index}
                  className="justify-between gap-4"
                  onSelect={() => onNewTerminal(cmd)}
                >
                  <span className="truncate font-mono text-xs">{cmd}</span>
                  <span
                    role="button"
                    className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
                    onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      removeTerminalCommand(index);
                    }}
                  >
                    <X className="size-3.5" />
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setAddValue("");
                  setAddDialog("terminal");
                }}
              >
                <Plus className="size-4" />
                Add Command...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Browser split button */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNewBrowser()}
                className="gap-1.5 h-7 px-2.5 text-xs rounded-lg rounded-r-none"
              >
                <Globe className="size-3.5" />
                Browser
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p>New Browser</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1 rounded-lg rounded-l-none border-l border-border/30"
              >
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8}>
              <DropdownMenuItem onSelect={() => onNewBrowser()}>
                <Globe className="size-4" />
                Empty Browser
              </DropdownMenuItem>
              {favorites.browserUrls.length > 0 && <DropdownMenuSeparator />}
              {favorites.browserUrls.map((url, index) => (
                <DropdownMenuItem
                  key={index}
                  className="justify-between gap-4"
                  onSelect={() => onNewBrowser(url)}
                >
                  <span className="truncate text-xs">{url}</span>
                  <span
                    role="button"
                    className="shrink-0 text-muted-foreground/50 hover:text-destructive transition-colors"
                    onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      removeBrowserUrl(index);
                    }}
                  >
                    <X className="size-3.5" />
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setAddValue("");
                  setAddDialog("browser");
                }}
              >
                <Plus className="size-4" />
                Add URL...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Zoom controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onZoomOut}
              className="rounded-lg"
            >
              <ZoomOut className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <p>Zoom Out</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onResetView}
              className="h-6 min-w-[3.2rem] px-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground tabular-nums transition-colors rounded-md hover:bg-accent cursor-pointer"
            >
              {zoomPercent}%
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <p>Reset to 100%</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onZoomIn}
              className="rounded-lg"
            >
              <ZoomIn className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <p>Zoom In</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onFitAll}
              className="rounded-lg"
            >
              <Maximize className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <p>Fit All Windows</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onResetView}
              className="rounded-lg"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <p>Reset View</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Add favorite dialog */}
      <Dialog
        open={addDialog !== null}
        onOpenChange={(open) => !open && setAddDialog(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {addDialog === "terminal"
                ? "Add Startup Command"
                : "Add Favorite URL"}
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder={
              addDialog === "terminal"
                ? "e.g. npm run dev"
                : "e.g. http://localhost:3000"
            }
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && addValue.trim()) handleAdd();
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
