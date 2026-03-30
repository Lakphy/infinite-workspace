export type CanvasChangeListener = (state: { scale: number; x: number; y: number }) => void;

export class Canvas {
  private scale = 1;
  private targetScale = 1;
  private translateX = 0;
  private translateY = 0;
  private targetTranslateX = 0;
  private targetTranslateY = 0;
  private isPanning = false;
  private isSpacePanning = false;
  private spaceHeld = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private animationId: number | null = null;
  private listeners: CanvasChangeListener[] = [];

  public readonly viewport: HTMLDivElement;
  public readonly layer: HTMLDivElement;
  private readonly gridCanvas: HTMLCanvasElement;

  private static readonly MIN_SCALE = 0.05;
  private static readonly MAX_SCALE = 8;
  private static readonly ZOOM_SPEED = 0.08;
  private static readonly LERP_FACTOR = 0.18;

  constructor(root: HTMLElement) {
    this.viewport = document.createElement("div");
    this.viewport.className = "canvas-viewport";

    // Background grid drawn on canvas for dynamic scaling
    this.gridCanvas = document.createElement("canvas");
    this.gridCanvas.className = "canvas-grid";
    this.viewport.appendChild(this.gridCanvas);

    this.layer = document.createElement("div");
    this.layer.className = "canvas-layer";

    this.viewport.appendChild(this.layer);
    root.appendChild(this.viewport);

    this.bindEvents();
    this.startAnimation();

    // Initial grid draw
    requestAnimationFrame(() => this.drawGrid());

    // Resize observer for grid canvas
    const ro = new ResizeObserver(() => {
      this.gridCanvas.width = this.viewport.clientWidth * devicePixelRatio;
      this.gridCanvas.height = this.viewport.clientHeight * devicePixelRatio;
      this.gridCanvas.style.width = `${this.viewport.clientWidth}px`;
      this.gridCanvas.style.height = `${this.viewport.clientHeight}px`;
      this.drawGrid();
    });
    ro.observe(this.viewport);
  }

  onChange(listener: CanvasChangeListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const state = { scale: this.scale, x: this.translateX, y: this.translateY };
    for (const l of this.listeners) l(state);
  }

  private bindEvents() {
    this.viewport.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.viewport.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.viewport.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.viewport.addEventListener("pointerleave", () => this.stopPanning());
    this.viewport.addEventListener("wheel", (e) => this.onWheel(e), {
      passive: false,
    });

    // Space key for pan mode
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        this.spaceHeld = true;
        this.viewport.classList.add("pan-mode");
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        this.spaceHeld = false;
        if (!this.isSpacePanning) {
          this.viewport.classList.remove("pan-mode");
        }
      }
    });
  }

  private onPointerDown(e: PointerEvent) {
    // Space+Left, Middle button, or Ctrl/Meta+Left to pan
    const shouldPan =
      e.button === 1 ||
      (e.button === 0 && this.spaceHeld) ||
      (e.button === 0 && (e.ctrlKey || e.metaKey));

    if (shouldPan) {
      e.preventDefault();
      this.isPanning = true;
      this.isSpacePanning = this.spaceHeld;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.viewport.classList.add("panning");
      this.viewport.setPointerCapture(e.pointerId);
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.isPanning) return;

    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    this.translateX += dx;
    this.translateY += dy;
    this.targetTranslateX = this.translateX;
    this.targetTranslateY = this.translateY;
    this.applyTransform();
    this.drawGrid();
    this.notify();
  }

  private onPointerUp(e: PointerEvent) {
    if (this.isPanning) {
      this.viewport.releasePointerCapture(e.pointerId);
      this.stopPanning();
    }
  }

  private stopPanning() {
    this.isPanning = false;
    this.isSpacePanning = false;
    this.viewport.classList.remove("panning");
    if (!this.spaceHeld) {
      this.viewport.classList.remove("pan-mode");
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();

    // Trackpad pinch-to-zoom sends ctrlKey; two-finger drag does not
    const isPinch = e.ctrlKey;

    if (!isPinch) {
      // Two-finger drag on trackpad → pan
      this.translateX -= e.deltaX;
      this.translateY -= e.deltaY;
      this.targetTranslateX = this.translateX;
      this.targetTranslateY = this.translateY;
      this.applyTransform();
      this.drawGrid();
      this.notify();
      return;
    }

    // Pinch-to-zoom (ctrlKey)
    const delta = -e.deltaY * 0.01;
    const factor = Math.exp(delta);

    const newScale = Math.min(
      Canvas.MAX_SCALE,
      Math.max(Canvas.MIN_SCALE, this.targetScale * factor)
    );

    const rect = this.viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom around cursor position
    this.targetTranslateX =
      mouseX - (mouseX - this.targetTranslateX) * (newScale / this.targetScale);
    this.targetTranslateY =
      mouseY - (mouseY - this.targetTranslateY) * (newScale / this.targetScale);
    this.targetScale = newScale;
  }

  private startAnimation() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      const ds = Math.abs(this.scale - this.targetScale);
      const dx = Math.abs(this.translateX - this.targetTranslateX);
      const dy = Math.abs(this.translateY - this.targetTranslateY);

      // Only update if there's meaningful difference
      if (ds < 0.0001 && dx < 0.01 && dy < 0.01) return;

      this.scale += (this.targetScale - this.scale) * Canvas.LERP_FACTOR;
      this.translateX += (this.targetTranslateX - this.translateX) * Canvas.LERP_FACTOR;
      this.translateY += (this.targetTranslateY - this.translateY) * Canvas.LERP_FACTOR;

      // Snap when close enough
      if (ds < 0.0001) this.scale = this.targetScale;
      if (dx < 0.01) this.translateX = this.targetTranslateX;
      if (dy < 0.01) this.translateY = this.targetTranslateY;

      this.applyTransform();
      this.drawGrid();
      this.notify();
    };
    this.animationId = requestAnimationFrame(animate);
  }

  private drawGrid() {
    const ctx = this.gridCanvas.getContext("2d");
    if (!ctx) return;

    const w = this.gridCanvas.width;
    const h = this.gridCanvas.height;
    const dpr = devicePixelRatio;

    ctx.clearRect(0, 0, w, h);

    // Determine grid spacing that looks good at current zoom
    const baseSpacing = 40;
    let spacing = baseSpacing * this.scale;

    // Subdivide or multiply to keep spacing in a visual sweet spot (20-80px)
    let level = 0;
    while (spacing < 20) {
      spacing *= 5;
      level++;
    }
    while (spacing > 100) {
      spacing /= 5;
      level--;
    }

    const offsetX = ((this.translateX * dpr) % spacing + spacing) % spacing;
    const offsetY = ((this.translateY * dpr) % spacing + spacing) % spacing;

    // Dot grid
    const dotAlpha = Math.min(0.2, 0.06 + (spacing - 20) * 0.002);
    ctx.fillStyle = `rgba(255, 255, 255, ${dotAlpha})`;

    const dotSize = Math.max(1, 1.2 * dpr);
    for (let x = offsetX; x < w; x += spacing) {
      for (let y = offsetY; y < h; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Major grid lines (every 5 subdivisions) as subtle lines
    if (level <= 0) {
      const majorSpacing = spacing * 5;
      const majorOffsetX = ((this.translateX * dpr) % majorSpacing + majorSpacing) % majorSpacing;
      const majorOffsetY = ((this.translateY * dpr) % majorSpacing + majorSpacing) % majorSpacing;

      ctx.strokeStyle = `rgba(255, 255, 255, 0.04)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = majorOffsetX; x < w; x += majorSpacing) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, h);
      }
      for (let y = majorOffsetY; y < h; y += majorSpacing) {
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
      }
      ctx.stroke();
    }

    // Origin crosshair
    const ox = this.translateX * dpr;
    const oy = this.translateY * dpr;
    if (ox > -2 && ox < w + 2 && oy > -2 && oy < h + 2) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(ox) + 0.5, 0);
      ctx.lineTo(Math.round(ox) + 0.5, h);
      ctx.moveTo(0, Math.round(oy) + 0.5);
      ctx.lineTo(w, Math.round(oy) + 0.5);
      ctx.stroke();
    }
  }

  private applyTransform() {
    this.layer.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
  }

  public getScale(): number {
    return this.scale;
  }

  public getTranslate(): { x: number; y: number } {
    return { x: this.translateX, y: this.translateY };
  }

  public screenToCanvas(
    screenX: number,
    screenY: number
  ): { x: number; y: number } {
    const rect = this.viewport.getBoundingClientRect();
    const x = (screenX - rect.left - this.translateX) / this.scale;
    const y = (screenY - rect.top - this.translateY) / this.scale;
    return { x, y };
  }

  public getViewportCenter(): { x: number; y: number } {
    const rect = this.viewport.getBoundingClientRect();
    return this.screenToCanvas(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
  }

  public zoomTo(newScale: number) {
    const clamped = Math.min(Canvas.MAX_SCALE, Math.max(Canvas.MIN_SCALE, newScale));
    const rect = this.viewport.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    this.targetTranslateX =
      cx - (cx - this.targetTranslateX) * (clamped / this.targetScale);
    this.targetTranslateY =
      cy - (cy - this.targetTranslateY) * (clamped / this.targetScale);
    this.targetScale = clamped;
  }

  public resetView() {
    this.targetScale = 1;
    this.targetTranslateX = 0;
    this.targetTranslateY = 0;
  }

  public fitAll(windows: { x: number; y: number; width: number; height: number }[]) {
    if (windows.length === 0) {
      this.resetView();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const w of windows) {
      minX = Math.min(minX, w.x);
      minY = Math.min(minY, w.y);
      maxX = Math.max(maxX, w.x + w.width);
      maxY = Math.max(maxY, w.y + w.height);
    }

    const padding = 60;
    const rect = this.viewport.getBoundingClientRect();
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;

    const scaleX = rect.width / contentW;
    const scaleY = rect.height / contentH;
    const newScale = Math.min(scaleX, scaleY, 1.5);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.targetScale = newScale;
    this.targetTranslateX = rect.width / 2 - centerX * newScale;
    this.targetTranslateY = rect.height / 2 - centerY * newScale;
  }

  public destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }
}
