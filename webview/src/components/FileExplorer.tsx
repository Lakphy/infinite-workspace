import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RefreshCw,
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileJson,
  Search,
  ArrowUp as SortAsc,
  ArrowDown as SortDesc,
  Home,
  Link2,
  ChevronRight,
} from "lucide-react";

interface FileEntry {
  name: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  mtime: number;
  path: string;
}

type SortKey = "name" | "size" | "mtime";
type SortDir = "asc" | "desc";

interface VsCodeApi {
  postMessage(msg: unknown): void;
}

interface FileExplorerProps {
  windowId: string;
  vscode: VsCodeApi;
  initialPath?: string;
}

const EXT_ICON_MAP: Record<string, typeof File> = {
  ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode,
  py: FileCode, go: FileCode, rs: FileCode, java: FileCode,
  c: FileCode, cpp: FileCode, h: FileCode, hpp: FileCode,
  rb: FileCode, php: FileCode, swift: FileCode, kt: FileCode,
  vue: FileCode, svelte: FileCode, css: FileCode, scss: FileCode,
  less: FileCode, html: FileCode, xml: FileCode, sql: FileCode,
  sh: FileCode, bash: FileCode, zsh: FileCode, fish: FileCode,
  yml: FileCode, yaml: FileCode, toml: FileCode,
  md: FileText, txt: FileText, log: FileText, csv: FileText,
  json: FileJson, jsonc: FileJson, json5: FileJson,
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage,
  svg: FileImage, webp: FileImage, ico: FileImage, bmp: FileImage,
  mp4: FileVideo, mkv: FileVideo, avi: FileVideo, mov: FileVideo, webm: FileVideo,
  mp3: FileAudio, wav: FileAudio, flac: FileAudio, ogg: FileAudio, aac: FileAudio,
  zip: FileArchive, tar: FileArchive, gz: FileArchive, rar: FileArchive, "7z": FileArchive,
};

function getFileIcon(entry: FileEntry) {
  if (entry.isDirectory) return Folder;
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  return EXT_ICON_MAP[ext] || File;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "--";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function formatDate(ms: number): string {
  if (ms === 0) return "--";
  const d = new Date(ms);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${Y}/${M}/${D} ${h}:${m}`;
}

export function FileExplorer({ windowId, vscode, initialPath }: FileExplorerProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || "");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [historyBack, setHistoryBack] = useState<string[]>([]);
  const [historyForward, setHistoryForward] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [showHidden, setShowHidden] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.windowId !== windowId) return;

      if (msg.type === "directoryContents") {
        setEntries(msg.data.items);
        setCurrentPath(msg.data.path);
        setLoading(false);
        setError(null);
        setSelectedIndex(-1);
      } else if (msg.type === "directoryError") {
        setError(msg.data.error);
        setLoading(false);
      } else if (msg.type === "workspacePath") {
        if (!initialPath) {
          navigateTo(msg.data as string, true);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [windowId]);

  useEffect(() => {
    if (initialPath) {
      navigateTo(initialPath, true);
    } else {
      vscode.postMessage({ type: "getWorkspacePath", windowId });
    }
  }, []);

  const navigateTo = useCallback((dirPath: string, isInitial = false) => {
    if (!isInitial && currentPath) {
      setHistoryBack(prev => [...prev, currentPath]);
      setHistoryForward([]);
    }
    setLoading(true);
    setError(null);
    setFilter("");
    vscode.postMessage({ type: "readDirectory", windowId, dirPath });
  }, [vscode, windowId, currentPath]);

  const goBack = useCallback(() => {
    if (historyBack.length === 0) return;
    const prev = historyBack[historyBack.length - 1];
    setHistoryBack(h => h.slice(0, -1));
    setHistoryForward(h => [...h, currentPath]);
    setLoading(true);
    setFilter("");
    vscode.postMessage({ type: "readDirectory", windowId, dirPath: prev });
  }, [historyBack, currentPath, vscode, windowId]);

  const goForward = useCallback(() => {
    if (historyForward.length === 0) return;
    const next = historyForward[historyForward.length - 1];
    setHistoryForward(h => h.slice(0, -1));
    setHistoryBack(h => [...h, currentPath]);
    setLoading(true);
    setFilter("");
    vscode.postMessage({ type: "readDirectory", windowId, dirPath: next });
  }, [historyForward, currentPath, vscode, windowId]);

  const goUp = useCallback(() => {
    const parent = currentPath.replace(/\/[^/]+\/?$/, "") || "/";
    if (parent !== currentPath) navigateTo(parent);
  }, [currentPath, navigateTo]);

  const refresh = useCallback(() => {
    if (currentPath) {
      setLoading(true);
      vscode.postMessage({ type: "readDirectory", windowId, dirPath: currentPath });
    }
  }, [currentPath, vscode, windowId]);

  const openEntry = useCallback((entry: FileEntry) => {
    if (entry.isDirectory) {
      navigateTo(entry.path);
    } else {
      vscode.postMessage({ type: "openFileInEditor", filePath: entry.path });
    }
  }, [navigateTo, vscode]);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }, [sortKey]);

  const sortedEntries = useMemo(() => {
    let filtered = entries;

    // Hide dotfiles unless toggled
    if (!showHidden) {
      filtered = filtered.filter(e => !e.name.startsWith("."));
    }

    if (filter) {
      const lf = filter.toLowerCase();
      filtered = filtered.filter(e => e.name.toLowerCase().includes(lf));
    }

    return [...filtered].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          break;
        case "size":
          cmp = a.size - b.size;
          break;
        case "mtime":
          cmp = a.mtime - b.mtime;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [entries, filter, sortKey, sortDir, showHidden]);

  // Path segments for breadcrumb
  const pathSegments = useMemo(() => {
    if (!currentPath) return [];
    const parts = currentPath.split("/").filter(Boolean);
    return parts.map((part, i) => ({
      name: part,
      path: "/" + parts.slice(0, i + 1).join("/"),
    }));
  }, [currentPath]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, sortedEntries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < sortedEntries.length) {
        openEntry(sortedEntries[selectedIndex]);
      }
    } else if (e.key === "Backspace") {
      e.preventDefault();
      goUp();
    }
  }, [sortedEntries, selectedIndex, openEntry, goUp]);

  // Scroll selected row into view
  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    const row = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const SortIcon = sortDir === "asc" ? SortAsc : SortDesc;

  const dirCount = sortedEntries.filter(e => e.isDirectory).length;
  const fileCount = sortedEntries.length - dirCount;

  return (
    <div
      className="fe-root"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Navigation toolbar */}
      <div className="fe-toolbar">
        <button
          className="fe-nav-btn"
          onClick={goBack}
          disabled={historyBack.length === 0}
          title="Back"
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <button
          className="fe-nav-btn"
          onClick={goForward}
          disabled={historyForward.length === 0}
          title="Forward"
        >
          <ArrowRight className="size-3.5" />
        </button>
        <button className="fe-nav-btn" onClick={goUp} title="Enclosing Folder">
          <ArrowUp className="size-3.5" />
        </button>

        {/* Breadcrumb path */}
        <div className="fe-pathbar">
          <button
            className="fe-path-seg fe-path-home"
            onClick={() => navigateTo("/")}
          >
            <Home className="size-3" />
          </button>
          {pathSegments.map((seg, i) => (
            <span key={seg.path} className="fe-path-part">
              <ChevronRight className="fe-path-sep" />
              {i === pathSegments.length - 1 ? (
                <span className="fe-path-current">{seg.name}</span>
              ) : (
                <button
                  className="fe-path-seg"
                  onClick={() => navigateTo(seg.path)}
                >
                  {seg.name}
                </button>
              )}
            </span>
          ))}
        </div>

        <button className="fe-nav-btn" onClick={refresh} title="Refresh">
          <RefreshCw className="size-3" />
        </button>
      </div>

      {/* Search / filter bar */}
      <div className="fe-filterbar">
        <div className="fe-search-wrap">
          <Search className="fe-search-icon" />
          <input
            ref={filterInputRef}
            className="fe-search-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                setFilter("");
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </div>
        <button
          className={`fe-toggle-btn ${showHidden ? "active" : ""}`}
          onClick={() => setShowHidden(v => !v)}
          title="Show hidden files"
        >
          .*
        </button>
      </div>

      {/* Column headers */}
      <div className="fe-colheader">
        <button
          className="fe-col fe-col-name"
          onClick={() => toggleSort("name")}
        >
          Name
          {sortKey === "name" && <SortIcon className="fe-sort-icon" />}
        </button>
        <button
          className="fe-col fe-col-size"
          onClick={() => toggleSort("size")}
        >
          Size
          {sortKey === "size" && <SortIcon className="fe-sort-icon" />}
        </button>
        <button
          className="fe-col fe-col-date"
          onClick={() => toggleSort("mtime")}
        >
          Date Modified
          {sortKey === "mtime" && <SortIcon className="fe-sort-icon" />}
        </button>
      </div>

      {/* File list — native scrolling div */}
      <div className="fe-list" ref={listRef}>
        {loading ? (
          <div className="fe-empty">Loading...</div>
        ) : error ? (
          <div className="fe-empty fe-error">{error}</div>
        ) : sortedEntries.length === 0 ? (
          <div className="fe-empty">
            {filter ? "No matches" : "Empty folder"}
          </div>
        ) : (
          sortedEntries.map((entry, idx) => {
            const Icon = getFileIcon(entry);
            const isDir = entry.isDirectory;
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={entry.name}
                className={`fe-row ${isSelected ? "selected" : ""} ${idx % 2 === 0 ? "even" : ""}`}
                onClick={() => setSelectedIndex(idx)}
                onDoubleClick={() => openEntry(entry)}
              >
                <div className="fe-cell fe-cell-name">
                  <Icon className={`fe-file-icon ${isDir ? "dir" : "file"}`} />
                  <span className={`fe-filename ${isDir ? "dir" : ""}`}>
                    {entry.name}
                  </span>
                  {entry.isSymlink && (
                    <Link2 className="fe-symlink-badge" />
                  )}
                </div>
                <div className="fe-cell fe-cell-size">
                  {isDir ? "--" : formatSize(entry.size)}
                </div>
                <div className="fe-cell fe-cell-date">
                  {formatDate(entry.mtime)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Status bar */}
      <div className="fe-statusbar">
        <span>
          {dirCount > 0 && `${dirCount} folder${dirCount > 1 ? "s" : ""}`}
          {dirCount > 0 && fileCount > 0 && ", "}
          {fileCount > 0 && `${fileCount} file${fileCount > 1 ? "s" : ""}`}
          {dirCount === 0 && fileCount === 0 && (loading ? "Loading..." : "Empty")}
        </span>
        <span className="fe-statusbar-path">{currentPath}</span>
      </div>
    </div>
  );
}
