import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  TerminalSquare,
  Globe,
  FolderOpen,
  Sparkles,
  Plus,
  X,
  Settings2,
  Grid3X3,
  Magnet,
  Keyboard,
  Maximize2,
  ChevronDown,
  ChevronRight,
  Home,
  Moon,
  Sun,
} from "lucide-react";
import type { Favorites, FavoriteItem } from "./Toolbar";

export interface WindowSize {
  width: number;
  height: number;
}

export interface TerminalSettings {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontFamily: string;
  cursorBlink: boolean;
  cursorStyle: "block" | "underline" | "bar";
  scrollback: number;
}

export interface CanvasSettings {
  minScale: number;
  maxScale: number;
  zoomSpeed: number;
  lerpFactor: number;
  gridSpacing: number;
}

export interface AppSettings {
  showGrid: boolean;
  enableSnap: boolean;
  snapThreshold: number;
  colorMode: "dark" | "light";
  defaultSizes: {
    terminal: WindowSize;
    browser: WindowSize;
    fileExplorer: WindowSize;
    agent: WindowSize;
  };
  canvas: CanvasSettings;
  window: {
    minWidth: number;
    minHeight: number;
  };
  terminal: TerminalSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  showGrid: true,
  enableSnap: true,
  snapThreshold: 8,
  colorMode: "dark",
  defaultSizes: {
    terminal: { width: 650, height: 380 },
    browser: { width: 750, height: 520 },
    fileExplorer: { width: 700, height: 480 },
    agent: { width: 700, height: 500 },
  },
  canvas: {
    minScale: 0.05,
    maxScale: 8,
    zoomSpeed: 0.08,
    lerpFactor: 0.18,
    gridSpacing: 40,
  },
  window: {
    minWidth: 200,
    minHeight: 150,
  },
  terminal: {
    fontSize: 12,
    lineHeight: 1.1,
    letterSpacing: 0,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    cursorBlink: true,
    cursorStyle: "block",
    scrollback: 5000,
  },
};

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  favorites: Favorites;
  onUpdateFavorites: (favorites: Favorites) => void;
  openOnStartup: boolean;
  onUpdateOpenOnStartup: (value: boolean) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
  favorites,
  onUpdateFavorites,
  openOnStartup,
  onUpdateOpenOnStartup,
}: SettingsDialogProps) {
  const [addType, setAddType] = useState<
    "terminal" | "browser" | "fileExplorer" | "agent" | null
  >(null);
  const [addValue, setAddValue] = useState("");
  const [addWidth, setAddWidth] = useState("");
  const [addHeight, setAddHeight] = useState("");

  const resetAddForm = () => {
    setAddValue("");
    setAddWidth("");
    setAddHeight("");
  };

  const handleAdd = () => {
    const val = addValue.trim();
    if (!val || !addType) return;
    const item: FavoriteItem = { value: val };
    const w = parseInt(addWidth);
    const h = parseInt(addHeight);
    if (w > 0) item.width = w;
    if (h > 0) item.height = h;

    if (addType === "terminal") {
      onUpdateFavorites({
        ...favorites,
        terminalCommands: [...favorites.terminalCommands, item],
      });
    } else if (addType === "browser") {
      onUpdateFavorites({
        ...favorites,
        browserUrls: [...favorites.browserUrls, item],
      });
    } else if (addType === "agent") {
      onUpdateFavorites({
        ...favorites,
        agentPaths: [...(favorites.agentPaths || []), item],
      });
    } else {
      onUpdateFavorites({
        ...favorites,
        fileExplorerPaths: [...favorites.fileExplorerPaths, item],
      });
    }
    resetAddForm();
    setAddType(null);
  };

  const updateDefaultSize = (
    type: "terminal" | "browser" | "fileExplorer" | "agent",
    dim: "width" | "height",
    value: string
  ) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 100) return;
    onUpdateSettings({
      ...settings,
      defaultSizes: {
        ...settings.defaultSizes,
        [type]: {
          ...settings.defaultSizes[type],
          [dim]: Math.max(100, Math.min(3000, num)),
        },
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings2 className="size-4" />
            Settings
          </DialogTitle>
          <DialogDescription className="text-xs">
            Manage workspace preferences and quick-launch shortcuts.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="gap-0">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 h-9">
            <TabsTrigger
              value="general"
              className="rounded-md text-xs data-[state=active]:bg-accent"
            >
              <Grid3X3 className="size-3.5 mr-1.5" />
              General
            </TabsTrigger>
            <TabsTrigger
              value="shortcuts"
              className="rounded-md text-xs data-[state=active]:bg-accent"
            >
              <Keyboard className="size-3.5 mr-1.5" />
              Quick Launch
            </TabsTrigger>
          </TabsList>

          {/* ── General ── */}
          <TabsContent value="general" className="px-6 py-4 space-y-5 m-0">
            {/* Appearance */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Appearance
              </h4>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="color-mode"
                  className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                >
                  {settings.colorMode === "dark" ? (
                    <Moon className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Sun className="size-3.5 text-muted-foreground" />
                  )}
                  Dark mode
                </Label>
                <Switch
                  id="color-mode"
                  size="sm"
                  checked={settings.colorMode === "dark"}
                  onCheckedChange={(v) =>
                    onUpdateSettings({
                      ...settings,
                      colorMode: v ? "dark" : "light",
                    })
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Canvas
              </h4>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="show-grid"
                  className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                >
                  <Grid3X3 className="size-3.5 text-muted-foreground" />
                  Show grid
                </Label>
                <Switch
                  id="show-grid"
                  size="sm"
                  checked={settings.showGrid}
                  onCheckedChange={(v) =>
                    onUpdateSettings({ ...settings, showGrid: v === true })
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Snap */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Window Snapping
              </h4>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="enable-snap"
                  className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                >
                  <Magnet className="size-3.5 text-muted-foreground" />
                  Enable snap guides
                </Label>
                <Switch
                  id="enable-snap"
                  size="sm"
                  checked={settings.enableSnap}
                  onCheckedChange={(v) =>
                    onUpdateSettings({ ...settings, enableSnap: v === true })
                  }
                />
              </div>
              {settings.enableSnap && (
                <div className="flex items-center justify-between pl-6">
                  <Label
                    htmlFor="snap-threshold"
                    className="text-sm font-normal text-muted-foreground"
                  >
                    Snap distance (px)
                  </Label>
                  <Input
                    id="snap-threshold"
                    type="number"
                    min={2}
                    max={30}
                    className="w-16 h-7 text-xs text-center"
                    value={settings.snapThreshold}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        snapThreshold: Math.max(
                          2,
                          Math.min(30, Number(e.target.value) || 8)
                        ),
                      })
                    }
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Default Window Sizes */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Default Window Sizes
              </h4>
              <DefaultSizeRow
                icon={<TerminalSquare className="size-3.5 text-muted-foreground" />}
                label="Terminal"
                size={settings.defaultSizes.terminal}
                onChange={(dim, val) => updateDefaultSize("terminal", dim, val)}
              />
              <DefaultSizeRow
                icon={<Globe className="size-3.5 text-muted-foreground" />}
                label="Browser"
                size={settings.defaultSizes.browser}
                onChange={(dim, val) => updateDefaultSize("browser", dim, val)}
              />
              <DefaultSizeRow
                icon={<FolderOpen className="size-3.5 text-muted-foreground" />}
                label="File Explorer"
                size={settings.defaultSizes.fileExplorer}
                onChange={(dim, val) =>
                  updateDefaultSize("fileExplorer", dim, val)
                }
              />
              <DefaultSizeRow
                icon={<Sparkles className="size-3.5 text-muted-foreground" />}
                label="Agent"
                size={settings.defaultSizes.agent}
                onChange={(dim, val) =>
                  updateDefaultSize("agent", dim, val)
                }
              />
            </div>

            <Separator />

            {/* Startup */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Startup
              </h4>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="open-on-startup"
                  className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                >
                  <Home className="size-3.5 text-muted-foreground" />
                  Set as VS Code homepage
                </Label>
                <Switch
                  id="open-on-startup"
                  size="sm"
                  checked={openOnStartup}
                  onCheckedChange={(v) =>
                    onUpdateOpenOnStartup(v === true)
                  }
                />
              </div>
              <p className="text-[10px] text-muted-foreground/60 pl-6">
                Automatically open Infinite Workspace when VS Code starts.
              </p>
            </div>
          </TabsContent>

          {/* ── Quick Launch Shortcuts ── */}
          <TabsContent value="shortcuts" className="px-6 py-4 space-y-5 m-0 max-h-[60vh] overflow-y-auto">
            {/* Terminal Commands */}
            <FavoriteSection
              icon={<TerminalSquare className="size-3.5" />}
              title="Terminal Commands"
              items={favorites.terminalCommands}
              placeholder="e.g. npm run dev"
              defaultSize={settings.defaultSizes.terminal}
              addType="terminal"
              currentAddType={addType}
              addValue={addValue}
              addWidth={addWidth}
              addHeight={addHeight}
              onSetAddType={(t) => {
                resetAddForm();
                setAddType(t);
              }}
              onSetAddValue={setAddValue}
              onSetAddWidth={setAddWidth}
              onSetAddHeight={setAddHeight}
              onAdd={handleAdd}
              onRemove={(index) =>
                onUpdateFavorites({
                  ...favorites,
                  terminalCommands: favorites.terminalCommands.filter(
                    (_, i) => i !== index
                  ),
                })
              }
              onUpdateItem={(index, item) =>
                onUpdateFavorites({
                  ...favorites,
                  terminalCommands: favorites.terminalCommands.map((v, i) =>
                    i === index ? item : v
                  ),
                })
              }
            />

            <Separator />

            {/* Browser URLs */}
            <FavoriteSection
              icon={<Globe className="size-3.5" />}
              title="Browser URLs"
              items={favorites.browserUrls}
              placeholder="e.g. http://localhost:3000"
              defaultSize={settings.defaultSizes.browser}
              addType="browser"
              currentAddType={addType}
              addValue={addValue}
              addWidth={addWidth}
              addHeight={addHeight}
              onSetAddType={(t) => {
                resetAddForm();
                setAddType(t);
              }}
              onSetAddValue={setAddValue}
              onSetAddWidth={setAddWidth}
              onSetAddHeight={setAddHeight}
              onAdd={handleAdd}
              onRemove={(index) =>
                onUpdateFavorites({
                  ...favorites,
                  browserUrls: favorites.browserUrls.filter(
                    (_, i) => i !== index
                  ),
                })
              }
              onUpdateItem={(index, item) =>
                onUpdateFavorites({
                  ...favorites,
                  browserUrls: favorites.browserUrls.map((v, i) =>
                    i === index ? item : v
                  ),
                })
              }
            />

            <Separator />

            {/* File Explorer Paths */}
            <FavoriteSection
              icon={<FolderOpen className="size-3.5" />}
              title="File Explorer Paths"
              items={favorites.fileExplorerPaths}
              placeholder="e.g. /Users/me/projects"
              defaultSize={settings.defaultSizes.fileExplorer}
              addType="fileExplorer"
              currentAddType={addType}
              addValue={addValue}
              addWidth={addWidth}
              addHeight={addHeight}
              onSetAddType={(t) => {
                resetAddForm();
                setAddType(t);
              }}
              onSetAddValue={setAddValue}
              onSetAddWidth={setAddWidth}
              onSetAddHeight={setAddHeight}
              onAdd={handleAdd}
              onRemove={(index) =>
                onUpdateFavorites({
                  ...favorites,
                  fileExplorerPaths: favorites.fileExplorerPaths.filter(
                    (_, i) => i !== index
                  ),
                })
              }
              onUpdateItem={(index, item) =>
                onUpdateFavorites({
                  ...favorites,
                  fileExplorerPaths: favorites.fileExplorerPaths.map((v, i) =>
                    i === index ? item : v
                  ),
                })
              }
            />

            <Separator />

            {/* Agent Paths */}
            <FavoriteSection
              icon={<Sparkles className="size-3.5" />}
              title="Agent Paths"
              items={favorites.agentPaths || []}
              placeholder="e.g. /Users/me/projects"
              defaultSize={settings.defaultSizes.agent}
              addType="agent"
              currentAddType={addType}
              addValue={addValue}
              addWidth={addWidth}
              addHeight={addHeight}
              onSetAddType={(t) => {
                resetAddForm();
                setAddType(t);
              }}
              onSetAddValue={setAddValue}
              onSetAddWidth={setAddWidth}
              onSetAddHeight={setAddHeight}
              onAdd={handleAdd}
              onRemove={(index) =>
                onUpdateFavorites({
                  ...favorites,
                  agentPaths: (favorites.agentPaths || []).filter(
                    (_, i) => i !== index
                  ),
                })
              }
              onUpdateItem={(index, item) =>
                onUpdateFavorites({
                  ...favorites,
                  agentPaths: (favorites.agentPaths || []).map((v, i) =>
                    i === index ? item : v
                  ),
                })
              }
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ── Default size row ── */

function DefaultSizeRow({
  icon,
  label,
  size,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  size: WindowSize;
  onChange: (dim: "width" | "height", value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="flex items-center gap-2 text-sm font-normal flex-1 min-w-0">
        {icon}
        {label}
      </Label>
      <div className="flex items-center gap-1.5 shrink-0">
        <Input
          type="number"
          min={100}
          max={3000}
          className="w-16 h-7 text-xs text-center"
          value={size.width}
          onChange={(e) => onChange("width", e.target.value)}
        />
        <span className="text-xs text-muted-foreground">x</span>
        <Input
          type="number"
          min={100}
          max={3000}
          className="w-16 h-7 text-xs text-center"
          value={size.height}
          onChange={(e) => onChange("height", e.target.value)}
        />
      </div>
    </div>
  );
}

/* ── Reusable favorite list section ── */

interface FavoriteSectionProps {
  icon: React.ReactNode;
  title: string;
  items: FavoriteItem[];
  placeholder: string;
  defaultSize: WindowSize;
  addType: "terminal" | "browser" | "fileExplorer" | "agent";
  currentAddType: "terminal" | "browser" | "fileExplorer" | "agent" | null;
  addValue: string;
  addWidth: string;
  addHeight: string;
  onSetAddType: (type: "terminal" | "browser" | "fileExplorer" | "agent" | null) => void;
  onSetAddValue: (value: string) => void;
  onSetAddWidth: (value: string) => void;
  onSetAddHeight: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdateItem: (index: number, item: FavoriteItem) => void;
}

function FavoriteSection({
  icon,
  title,
  items,
  placeholder,
  defaultSize,
  addType,
  currentAddType,
  addValue,
  addWidth,
  addHeight,
  onSetAddType,
  onSetAddValue,
  onSetAddWidth,
  onSetAddHeight,
  onAdd,
  onRemove,
  onUpdateItem,
}: FavoriteSectionProps) {
  const isAdding = currentAddType === addType;
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {icon}
          {title}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground"
          onClick={() => {
            onSetAddType(isAdding ? null : addType);
          }}
        >
          <Plus className="size-3 mr-1" />
          Add
        </Button>
      </div>

      {items.length === 0 && !isAdding && (
        <p className="text-xs text-muted-foreground/60 pl-0.5">
          No shortcuts configured.
        </p>
      )}

      {items.map((item, index) => {
        const isExpanded = expandedIndex === index;
        const hasCustomSize = item.width != null || item.height != null;
        return (
          <div key={index} className="group">
            <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors">
              <button
                className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
                onClick={() =>
                  setExpandedIndex(isExpanded ? null : index)
                }
              >
                {isExpanded ? (
                  <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                )}
                <span className="truncate font-mono text-xs">
                  {item.value}
                </span>
                {hasCustomSize && (
                  <span className="shrink-0 text-[10px] text-muted-foreground/60 tabular-nums">
                    {item.width ?? defaultSize.width}x
                    {item.height ?? defaultSize.height}
                  </span>
                )}
              </button>
              <button
                className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive transition-all cursor-pointer"
                onClick={() => onRemove(index)}
              >
                <X className="size-3.5" />
              </button>
            </div>
            {isExpanded && (
              <div className="flex items-center gap-2 pl-7 pr-2 pb-1.5">
                <Maximize2 className="size-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-muted-foreground shrink-0">
                  Size
                </span>
                <Input
                  type="number"
                  min={100}
                  max={3000}
                  placeholder={`${defaultSize.width}`}
                  className="w-16 h-6 text-xs text-center"
                  value={item.width ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const num = parseInt(v);
                    onUpdateItem(index, {
                      ...item,
                      width: v === "" ? undefined : Math.max(100, Math.min(3000, num || defaultSize.width)),
                    });
                  }}
                />
                <span className="text-xs text-muted-foreground">x</span>
                <Input
                  type="number"
                  min={100}
                  max={3000}
                  placeholder={`${defaultSize.height}`}
                  className="w-16 h-6 text-xs text-center"
                  value={item.height ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const num = parseInt(v);
                    onUpdateItem(index, {
                      ...item,
                      height: v === "" ? undefined : Math.max(100, Math.min(3000, num || defaultSize.height)),
                    });
                  }}
                />
                {hasCustomSize && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px] text-muted-foreground"
                    onClick={() =>
                      onUpdateItem(index, {
                        value: item.value,
                      })
                    }
                  >
                    Reset
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {isAdding && (
        <div className="space-y-2 rounded-md border border-border/50 p-2">
          <Input
            autoFocus
            className="h-7 text-xs"
            placeholder={placeholder}
            value={addValue}
            onChange={(e) => onSetAddValue(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.nativeEvent.isComposing &&
                addValue.trim()
              )
                onAdd();
              if (e.key === "Escape") onSetAddType(null);
            }}
          />
          <div className="flex items-center gap-2">
            <Maximize2 className="size-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground shrink-0">
              Size
            </span>
            <Input
              type="number"
              min={100}
              max={3000}
              placeholder={`${defaultSize.width}`}
              className="w-16 h-6 text-xs text-center"
              value={addWidth}
              onChange={(e) => onSetAddWidth(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">x</span>
            <Input
              type="number"
              min={100}
              max={3000}
              placeholder={`${defaultSize.height}`}
              className="w-16 h-6 text-xs text-center"
              value={addHeight}
              onChange={(e) => onSetAddHeight(e.target.value)}
            />
            <span className="text-[10px] text-muted-foreground/50">(optional)</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onSetAddType(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs px-3"
              disabled={!addValue.trim()}
              onClick={onAdd}
            >
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
