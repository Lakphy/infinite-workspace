/**
 * Pure-DOM drag and resize helpers for workspace windows.
 * Extracted from App.tsx for modularity.
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

/**
 * Set up drag-to-resize on a window's resize handle (bottom-right corner).
 */
export function setupResize(
  win: DraggableWindow,
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
