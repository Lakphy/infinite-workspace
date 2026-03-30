export class BrowserWindow {
  private iframe: HTMLIFrameElement;
  private urlInput: HTMLInputElement;
  private zoomLevel = 1;
  private zoomLabel: HTMLSpanElement;
  private iframeContainer: HTMLDivElement;

  private static ZOOM_STEPS = [
    0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5,
    3,
  ];

  constructor(
    contentElement: HTMLDivElement,
    _windowId: string,
    initialUrl?: string,
    initialZoom?: number
  ) {
    // Create browser toolbar
    const toolbar = document.createElement("div");
    toolbar.className =
      "flex items-center gap-1 px-1.5 py-1 bg-[oklch(0.18_0_0)] border-b border-[oklch(1_0_0/8%)] shrink-0";

    const btnClass =
      "inline-flex items-center justify-center size-5 rounded text-[oklch(0.65_0_0)] hover:text-[oklch(0.85_0_0)] hover:bg-[oklch(1_0_0/8%)] transition-colors text-xs cursor-pointer border-none bg-transparent";

    const backBtn = document.createElement("button");
    backBtn.className = btnClass;
    backBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>';
    backBtn.title = "Back";
    backBtn.addEventListener("click", () => {
      try {
        this.iframe.contentWindow?.history.back();
      } catch {
        // cross-origin
      }
    });

    const forwardBtn = document.createElement("button");
    forwardBtn.className = btnClass;
    forwardBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    forwardBtn.title = "Forward";
    forwardBtn.addEventListener("click", () => {
      try {
        this.iframe.contentWindow?.history.forward();
      } catch {
        // cross-origin
      }
    });

    const reloadBtn = document.createElement("button");
    reloadBtn.className = btnClass;
    reloadBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>';
    reloadBtn.title = "Reload";
    reloadBtn.addEventListener("click", () => {
      if (this.iframe.src) {
        this.iframe.src = this.iframe.src;
      }
    });

    this.urlInput = document.createElement("input");
    this.urlInput.type = "text";
    this.urlInput.className =
      "flex-1 h-5 px-2 rounded text-[11px] bg-[oklch(0.14_0_0)] text-[oklch(0.8_0_0)] border border-[oklch(1_0_0/10%)] outline-none placeholder:text-[oklch(0.45_0_0)] focus:border-[oklch(0.5_0.15_250)] transition-colors";
    this.urlInput.placeholder = "Enter URL...";

    const goBtn = document.createElement("button");
    goBtn.className = btnClass;
    goBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    goBtn.title = "Go";
    goBtn.addEventListener("click", () => this.navigate());

    this.urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.navigate();
      // In VSCode webview, Cmd/Ctrl+V is intercepted by the host.
      // Manually handle paste via the Clipboard API.
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          const input = this.urlInput;
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? input.value.length;
          input.value =
            input.value.slice(0, start) + text + input.value.slice(end);
          const pos = start + text.length;
          input.setSelectionRange(pos, pos);
        });
      }
      e.stopPropagation();
    });

    // --- Zoom controls ---
    const zoomSep = document.createElement("div");
    zoomSep.className =
      "w-px h-3.5 mx-0.5 bg-[oklch(1_0_0/10%)] shrink-0";

    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.className = btnClass;
    zoomOutBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>';
    zoomOutBtn.title = "Zoom Out";
    zoomOutBtn.addEventListener("click", () => this.zoomOut());

    this.zoomLabel = document.createElement("span");
    this.zoomLabel.className =
      "text-[10px] text-[oklch(0.6_0_0)] min-w-[32px] text-center select-none cursor-pointer hover:text-[oklch(0.85_0_0)] transition-colors";
    this.zoomLabel.title = "Reset Zoom";
    this.zoomLabel.addEventListener("click", () => this.setZoom(1));

    const zoomInBtn = document.createElement("button");
    zoomInBtn.className = btnClass;
    zoomInBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>';
    zoomInBtn.title = "Zoom In";
    zoomInBtn.addEventListener("click", () => this.zoomIn());

    toolbar.addEventListener("pointerdown", (e) => e.stopPropagation());

    toolbar.appendChild(backBtn);
    toolbar.appendChild(forwardBtn);
    toolbar.appendChild(reloadBtn);
    toolbar.appendChild(this.urlInput);
    toolbar.appendChild(goBtn);
    toolbar.appendChild(zoomSep);
    toolbar.appendChild(zoomOutBtn);
    toolbar.appendChild(this.zoomLabel);
    toolbar.appendChild(zoomInBtn);

    // Create iframe container (for zoom transform)
    this.iframeContainer = document.createElement("div");
    this.iframeContainer.className = "browser-zoom-container";

    // Create iframe
    this.iframe = document.createElement("iframe");
    this.iframe.className = "browser-frame";
    // Force dark mode: tell the browser to signal prefers-color-scheme: dark
    // to content inside the iframe, so sites with dark mode support will use it
    this.iframe.style.colorScheme = "dark";
    this.iframe.sandbox.add(
      "allow-scripts",
      "allow-same-origin",
      "allow-forms",
      "allow-popups"
    );

    this.iframeContainer.appendChild(this.iframe);

    contentElement.appendChild(toolbar);
    contentElement.appendChild(this.iframeContainer);

    if (initialUrl) {
      this.urlInput.value = initialUrl;
      this.iframe.src = initialUrl;
    }

    // Apply initial zoom
    if (initialZoom && initialZoom !== 1) {
      this.zoomLevel = initialZoom;
    }
    this.applyZoom();
  }

  private navigate() {
    let url = this.urlInput.value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    this.urlInput.value = url;
    this.iframe.src = url;
  }

  private zoomIn() {
    const steps = BrowserWindow.ZOOM_STEPS;
    const next = steps.find((s) => s > this.zoomLevel + 0.001);
    this.setZoom(next ?? steps[steps.length - 1]);
  }

  private zoomOut() {
    const steps = BrowserWindow.ZOOM_STEPS;
    const prev = [...steps].reverse().find((s) => s < this.zoomLevel - 0.001);
    this.setZoom(prev ?? steps[0]);
  }

  private setZoom(level: number) {
    this.zoomLevel = level;
    this.applyZoom();
  }

  private applyZoom() {
    const z = this.zoomLevel;
    this.iframe.style.transform = `scale(${z})`;
    this.iframe.style.transformOrigin = "0 0";
    this.iframe.style.width = `${100 / z}%`;
    this.iframe.style.height = `${100 / z}%`;
    this.zoomLabel.textContent = `${Math.round(z * 100)}%`;
  }

  public getUrl(): string {
    return this.urlInput.value;
  }

  public getZoom(): number {
    return this.zoomLevel;
  }

  public destroy() {
    this.iframe.src = "about:blank";
  }
}
