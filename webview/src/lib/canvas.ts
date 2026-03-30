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
  private dprMediaQuery: MediaQueryList | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private onKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private destroyed = false;

  /**
   * When true the zoom is animating and we use cheap CSS transform scale.
   * When false (settled) we apply real CSS dimensions so content re-rasterizes
   * crisply at the current zoom level.
   */
  private isAnimating = false;
  private settleTimer: number | null = null;
  private static readonly SETTLE_DELAY_MS = 100;

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
    this.resizeObserver = new ResizeObserver(() => {
      this.syncGridCanvasSize();
      this.drawGrid();
    });
    this.resizeObserver.observe(this.viewport);

    // Listen for DPR changes (e.g. moving window between monitors)
    this.watchDpr();
  }

  /** Sync the grid canvas backing store to current viewport size × DPR */
  private syncGridCanvasSize() {
    const dpr = devicePixelRatio;
    this.gridCanvas.width = this.viewport.clientWidth * dpr;
    this.gridCanvas.height = this.viewport.clientHeight * dpr;
    this.gridCanvas.style.width = `${this.viewport.clientWidth}px`;
    this.gridCanvas.style.height = `${this.viewport.clientHeight}px`;
  }

  /** Watch for devicePixelRatio changes (multi-monitor, zoom) */
  private watchDpr() {
    const updateDpr = () => {
      if (this.destroyed) return;
      this.syncGridCanvasSize();
      this.drawGrid();
      this.settleWindows();
      // Re-register since matchMedia is one-shot per DPR value
      this.watchDpr();
    };
    this.dprMediaQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    this.dprMediaQuery.addEventListener("change", updateDpr, { once: true });
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
    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        this.spaceHeld = true;
        this.viewport.classList.add("pan-mode");
      }
    };
    this.onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        this.spaceHeld = false;
        if (!this.isSpacePanning) {
          this.viewport.classList.remove("pan-mode");
        }
      }
    };
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
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
    // No updateAllWindows() needed — windows are children of the layer,
    // so the layer's translate moves them automatically.
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
      // No updateAllWindows() — layer translate handles panning.
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

      const scaleChanging = ds >= 0.0001;
      if (scaleChanging) this.isAnimating = true;

      this.scale += (this.targetScale - this.scale) * Canvas.LERP_FACTOR;
      this.translateX += (this.targetTranslateX - this.translateX) * Canvas.LERP_FACTOR;
      this.translateY += (this.targetTranslateY - this.translateY) * Canvas.LERP_FACTOR;

      // Snap when close enough
      if (ds < 0.0001) this.scale = this.targetScale;
      if (dx < 0.01) this.translateX = this.targetTranslateX;
      if (dy < 0.01) this.translateY = this.targetTranslateY;

      this.applyTransform();
      // Only update per-window transforms when scale is changing.
      // For translate-only animation the layer's transform handles it.
      if (scaleChanging) {
        this.updateAllWindows();
      }
      this.drawGrid();
      this.notify();

      // Check if we've settled
      const settled =
        this.scale === this.targetScale &&
        this.translateX === this.targetTranslateX &&
        this.translateY === this.targetTranslateY;

      if (settled && this.isAnimating) {
        this.isAnimating = false;
        // Schedule re-rasterization for crisp rendering
        this.scheduleSettle();
      }
    };
    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Schedule a "settle" pass that re-rasterizes window content at current
   * zoom level for maximum crispness.  Debounced so rapid zooms don't thrash.
   */
  private scheduleSettle() {
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => {
      this.settleTimer = null;
      this.settleWindows();
    }, Canvas.SETTLE_DELAY_MS);
  }

  /**
   * "Settle" all windows: remove the CSS transform-based scale and instead
   * apply real CSS dimensions so the browser re-rasterizes content at the
   * current zoom level.  Terminal text, iframe content, etc. become pixel-
   * perfect at the settled scale.
   *
   * Settled state uses translate-only (no scale) on the transform, with the
   * element's width/height set to canvasW*scale × canvasH*scale. The browser
   * then renders children (xterm canvas, iframe, etc.) at those real pixel
   * dimensions, producing crisp output.
   */
  private settleWindows() {
    const s = this.scale;
    const children = this.layer.querySelectorAll(".workspace-window") as NodeListOf<HTMLDivElement>;
    for (const el of children) {
      const cx = el.dataset.canvasX;
      const cy = el.dataset.canvasY;
      const cw = el.dataset.canvasW;
      const ch = el.dataset.canvasH;
      if (!cx || !cy || !cw || !ch) continue;

      const x = parseFloat(cx);
      const y = parseFloat(cy);
      const w = parseFloat(cw);
      const h = parseFloat(ch);

      // Position with translate only (no scale) — real dimensions absorb the zoom
      el.style.transform = `translate(${x * s}px, ${y * s}px)`;
      el.style.width = `${w * s}px`;
      el.style.height = `${h * s}px`;
    }

    // Fire callbacks so terminals re-fit for the new pixel dimensions
    this._fireResizeCallbacks();
  }

  private _resizeCallbacks: (() => void)[] = [];

  /** Register a callback to be invoked when windows settle after zoom */
  public onSettle(cb: () => void): () => void {
    this._resizeCallbacks.push(cb);
    return () => {
      this._resizeCallbacks = this._resizeCallbacks.filter((c) => c !== cb);
    };
  }

  private _fireResizeCallbacks() {
    for (const cb of this._resizeCallbacks) cb();
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
    // The layer only translates — no scale.
    // Scaling is handled per-window for crisp content rendering.
    this.layer.style.transform = `translate(${this.translateX}px, ${this.translateY}px)`;
  }

  /**
   * Fast path: position/scale all windows using CSS transform.
   * During animation this gives smooth 60fps zoom.
   * After settling, settleWindows() replaces this with real CSS dimensions.
   */
  public updateAllWindows() {
    const s = this.scale;
    const children = this.layer.querySelectorAll(".workspace-window") as NodeListOf<HTMLDivElement>;
    for (const el of children) {
      const cx = el.dataset.canvasX;
      const cy = el.dataset.canvasY;
      if (cx === undefined || cy === undefined) continue;
      const x = parseFloat(cx);
      const y = parseFloat(cy);
      // Use transform scale during animation — fast but blurry
      el.style.transform = `translate(${x * s}px, ${y * s}px) scale(${s})`;
      // Reset to logical dimensions (transform scale handles visual size)
      const cw = el.dataset.canvasW;
      const ch = el.dataset.canvasH;
      if (cw && ch) {
        el.style.width = `${parseFloat(cw)}px`;
        el.style.height = `${parseFloat(ch)}px`;
      }
    }
  }

  /**
   * Update a single window's transform (called during drag for performance).
   */
  public updateWindowTransform(el: HTMLDivElement) {
    const cx = el.dataset.canvasX;
    const cy = el.dataset.canvasY;
    if (cx === undefined || cy === undefined) return;
    const x = parseFloat(cx);
    const y = parseFloat(cy);
    const s = this.scale;
    el.style.transform = `translate(${x * s}px, ${y * s}px) scale(${s})`;
    const cw = el.dataset.canvasW;
    const ch = el.dataset.canvasH;
    if (cw && ch) {
      el.style.width = `${parseFloat(cw)}px`;
      el.style.height = `${parseFloat(ch)}px`;
    }
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
    this.destroyed = true;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    if (this.onKeyDown) window.removeEventListener("keydown", this.onKeyDown);
    if (this.onKeyUp) window.removeEventListener("keyup", this.onKeyUp);
    this.resizeObserver?.disconnect();
  }
}
