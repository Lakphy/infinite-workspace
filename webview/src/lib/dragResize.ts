/**
 * Pure-DOM drag and resize helpers for workspace windows.
 * Extracted from App.tsx for modularity.
 *
 * Resize handles are managed externally — they are NOT children of the
 * window element.  A single ResizeHandleManager creates four floating
 * handle dots in the canvas layer and shows them when the pointer is
 * near any window corner.
 */

import type { Canvas } from "./canvas";
import type { SnapEngine } from "./snapGuides";

/** Minimal interface a window must satisfy for drag/resize */
export interface DraggableWindow {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  element: HTMLDivElement;
  onResize?: () => void;
}

/**
 * Set up drag-to-move on a window's titlebar and focus overlay.
 * The overlay covers unfocused windows, allowing drag from anywhere.
 * Integrates with SnapEngine for alignment guides during drag.
 */
export function setupDrag(
  win: DraggableWindow,
  canvas: Canvas,
  saveState: () => void,
  snapEngine: SnapEngine,
  getOtherRects: (excludeId: string) => { x: number; y: number; width: number; height: number }[],
  onDragStart?: () => void
) {
  const titlebar = win.element.querySelector(
    ".window-titlebar"
  ) as HTMLDivElement;
  const overlay = win.element.querySelector(
    ".window-focus-overlay"
  ) as HTMLDivElement | null;

  let startX = 0;
  let startY = 0;
  let startWinX = 0;
  let startWinY = 0;
  let activeHandle: HTMLElement | null = null;

  const onPointerMove = (e: PointerEvent) => {
    const scale = canvas.getScale();
    const dx = (e.clientX - startX) / scale;
    const dy = (e.clientY - startY) / scale;
    const rawX = startWinX + dx;
    const rawY = startWinY + dy;

    // Snap to other windows
    const others = getOtherRects(win.id);
    const translate = canvas.getTranslate();
    const snapped = snapEngine.snap(
      rawX, rawY, win.width, win.height,
      others, scale, translate
    );

    win.x = snapped.x;
    win.y = snapped.y;
    win.element.dataset.canvasX = `${win.x}`;
    win.element.dataset.canvasY = `${win.y}`;
    canvas.updateWindowTransform(win.element);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (activeHandle) {
      activeHandle.releasePointerCapture(e.pointerId);
      activeHandle.removeEventListener("pointermove", onPointerMove);
      activeHandle.removeEventListener("pointerup", onPointerUp);
      activeHandle = null;
    }
    win.element.classList.remove("dragging");
    snapEngine.clearGuides();
    saveState();
  };

  const makePointerDown = (handle: HTMLElement) => (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest(".window-close")) return;
    e.preventDefault();
    e.stopPropagation();
    onDragStart?.();
    startX = e.clientX;
    startY = e.clientY;
    startWinX = win.x;
    startWinY = win.y;
    win.element.classList.add("dragging");
    activeHandle = handle;
    handle.setPointerCapture(e.pointerId);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
  };

  titlebar.addEventListener("pointerdown", makePointerDown(titlebar));
  if (overlay) {
    overlay.addEventListener("pointerdown", makePointerDown(overlay));
  }
}

// ────────────────────────────────────────────────────────────────────
// ResizeHandleManager — external resize handles living in the viewport
// ────────────────────────────────────────────────────────────────────

type Corner = "tl" | "tr" | "bl" | "br";
const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];

/** Base proximity distance (in screen px at 1× zoom) from a window corner to show the handle */
const BASE_PROXIMITY_PX = 24;
const MIN_W = 200;
const MIN_H = 150;

interface ActiveTarget {
  win: DraggableWindow;
  corner: Corner;
}

/**
 * Manages four floating resize-handle dots that are children of the
 * **viewport** (not the window).  They appear when the pointer is near
 * a window corner and allow drag-to-resize.
 */
export class ResizeHandleManager {
  private handles: Record<Corner, HTMLDivElement>;
  private viewport: HTMLDivElement;
  private canvas: Canvas;
  private getWindows: () => DraggableWindow[];
  private saveState: () => void;
  private activeTarget: ActiveTarget | null = null;
  private resizing = false;
  private unsubscribeCanvas: () => void;

  constructor(
    canvas: Canvas,
    getWindows: () => DraggableWindow[],
    saveState: () => void,
    onFocus?: (winId: string) => void
  ) {
    this.canvas = canvas;
    this.viewport = canvas.viewport;
    this.getWindows = getWindows;
    this.saveState = saveState;

    // Create four handle elements in the viewport (above the canvas layer)
    this.handles = {} as Record<Corner, HTMLDivElement>;
    for (const corner of CORNERS) {
      const h = document.createElement("div");
      h.className = "window-resize-handle";
      h.dataset.corner = corner;
      this.viewport.appendChild(h);
      this.handles[corner] = h;

      // --- resize drag on each handle ---
      let startX = 0;
      let startY = 0;
      let startW = 0;
      let startH = 0;
      let startWinX = 0;
      let startWinY = 0;
      let targetWin: DraggableWindow | null = null;

      const onPointerMove = (e: PointerEvent) => {
        if (!targetWin) return;
        const scale = this.canvas.getScale();
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;

        let newW = startW;
        let newH = startH;
        let newX = startWinX;
        let newY = startWinY;

        if (corner === "br") {
          newW = Math.max(MIN_W, startW + dx);
          newH = Math.max(MIN_H, startH + dy);
        } else if (corner === "bl") {
          newW = Math.max(MIN_W, startW - dx);
          newH = Math.max(MIN_H, startH + dy);
          newX = startWinX + (startW - newW);
        } else if (corner === "tr") {
          newW = Math.max(MIN_W, startW + dx);
          newH = Math.max(MIN_H, startH - dy);
          newY = startWinY + (startH - newH);
        } else if (corner === "tl") {
          newW = Math.max(MIN_W, startW - dx);
          newH = Math.max(MIN_H, startH - dy);
          newX = startWinX + (startW - newW);
          newY = startWinY + (startH - newH);
        }

        targetWin.width = newW;
        targetWin.height = newH;
        targetWin.x = newX;
        targetWin.y = newY;
        targetWin.element.dataset.canvasX = `${newX}`;
        targetWin.element.dataset.canvasY = `${newY}`;
        targetWin.element.dataset.canvasW = `${newW}`;
        targetWin.element.dataset.canvasH = `${newH}`;
        targetWin.element.style.width = `${newW}px`;
        targetWin.element.style.height = `${newH}px`;
        this.canvas.updateWindowTransform(targetWin.element);
        targetWin.onResize?.();

        // Reposition handles while resizing
        this.positionAllHandles(targetWin);
      };

      const onPointerUp = (e: PointerEvent) => {
        h.releasePointerCapture(e.pointerId);
        h.removeEventListener("pointermove", onPointerMove);
        h.removeEventListener("pointerup", onPointerUp);
        this.resizing = false;
        targetWin = null;
        this.hideAllHandles();
        this.saveState();
      };

      h.addEventListener("pointerdown", (e: PointerEvent) => {
        if (!this.activeTarget) return;
        e.preventDefault();
        e.stopPropagation();
        targetWin = this.activeTarget.win;
        onFocus?.(targetWin.id);
        startX = e.clientX;
        startY = e.clientY;
        startW = targetWin.width;
        startH = targetWin.height;
        startWinX = targetWin.x;
        startWinY = targetWin.y;
        this.resizing = true;
        this.showAllHandles();
        h.setPointerCapture(e.pointerId);
        h.addEventListener("pointermove", onPointerMove);
        h.addEventListener("pointerup", onPointerUp);
      });
    }

    // Listen for pointer move on viewport to detect corner proximity
    this.viewport.addEventListener("pointermove", this.onViewportPointerMove);

    // Reposition handles in real-time during zoom/pan animation
    this.unsubscribeCanvas = canvas.onChange(() => {
      if (this.activeTarget) {
        this.positionAllHandles(this.activeTarget.win);
      }
    });
  }

  /** Convert a window corner to viewport-relative screen coordinates */
  private cornerToScreen(win: DraggableWindow, corner: Corner): { x: number; y: number } {
    const s = this.canvas.getScale();
    const t = this.canvas.getTranslate();

    let cx = win.x;
    let cy = win.y;
    if (corner === "tr" || corner === "br") cx += win.width;
    if (corner === "bl" || corner === "br") cy += win.height;

    return {
      x: cx * s + t.x,
      y: cy * s + t.y,
    };
  }

  private onViewportPointerMove = (e: PointerEvent) => {
    if (this.resizing) return;

    const rect = this.viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let closest: ActiveTarget | null = null;
    // Scale proximity threshold with zoom so handles remain easy to reach at any scale
    const proximityThreshold = BASE_PROXIMITY_PX * Math.max(1, this.canvas.getScale());
    let closestDist = proximityThreshold;

    for (const win of this.getWindows()) {
      for (const corner of CORNERS) {
        const pos = this.cornerToScreen(win, corner);
        const dist = Math.hypot(pos.x - mx, pos.y - my);
        if (dist < closestDist) {
          closestDist = dist;
          closest = { win, corner };
        }
      }
    }

    if (closest) {
      this.activeTarget = closest;
      this.positionAllHandles(closest.win);
      this.showSingleHandle(closest.corner);
    } else {
      this.activeTarget = null;
      this.hideAllHandles();
    }
  };

  /** Handle element size in CSS px — must match the CSS width/height */
  private static readonly HANDLE_SIZE = 20;
  /** Gap between bracket inner corner and window corner, in canvas px (scales with zoom) */
  private static readonly GAP_CANVAS_PX = 0;

  /** Position all four handles at the screen corners of a window, scaled with zoom */
  private positionAllHandles(win: DraggableWindow) {
    const sz = ResizeHandleManager.HANDLE_SIZE;
    const s = this.canvas.getScale();
    // Gap in screen pixels — scales proportionally with zoom
    const gap = ResizeHandleManager.GAP_CANVAS_PX * s;
    for (const corner of CORNERS) {
      const pos = this.cornerToScreen(win, corner);
      const h = this.handles[corner];
      // Place the handle so its transform-origin (bracket inner corner)
      // sits `gap` screen-px outside the window corner.
      let lx = pos.x;
      let ly = pos.y;
      if (corner === "tl") { lx -= sz + gap; ly -= sz + gap; }
      else if (corner === "tr") { lx += gap; ly -= sz + gap; }
      else if (corner === "bl") { lx -= sz + gap; ly += gap; }
      else { lx += gap; ly += gap; } // br
      h.style.left = `${lx}px`;
      h.style.top = `${ly}px`;
      h.style.transform = `scale(${s})`;
    }
  }

  /** Show only the specified corner handle, hide the rest */
  private showSingleHandle(corner: Corner) {
    for (const c of CORNERS) {
      this.handles[c].classList.toggle("visible", c === corner);
    }
  }

  /** Show all four handles (used during resize) */
  private showAllHandles() {
    for (const corner of CORNERS) {
      this.handles[corner].classList.add("visible");
    }
  }

  private hideAllHandles() {
    if (this.resizing) return;
    for (const corner of CORNERS) {
      this.handles[corner].classList.remove("visible");
    }
  }

  destroy() {
    this.viewport.removeEventListener("pointermove", this.onViewportPointerMove);
    this.unsubscribeCanvas();
    for (const corner of CORNERS) {
      this.handles[corner].remove();
    }
  }
}
