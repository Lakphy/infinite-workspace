import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TerminalSquare,
  Globe,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
} from "lucide-react";

interface ToolbarProps {
  onNewTerminal: () => void;
  onNewBrowser: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
  onResetView: () => void;
  zoomPercent: number;
}

export function Toolbar({
  onNewTerminal,
  onNewBrowser,
  onZoomIn,
  onZoomOut,
  onFitAll,
  onResetView,
  zoomPercent,
}: ToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-0.5 px-1.5 py-1 bg-popover/70 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl">
        {/* Window creation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewTerminal}
              className="gap-1.5 h-7 px-2.5 text-xs rounded-lg"
            >
              <TerminalSquare className="size-3.5" />
              Terminal
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <p>New Terminal</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewBrowser}
              className="gap-1.5 h-7 px-2.5 text-xs rounded-lg"
            >
              <Globe className="size-3.5" />
              Browser
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <p>New Browser</p>
          </TooltipContent>
        </Tooltip>

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
    </TooltipProvider>
  );
}
