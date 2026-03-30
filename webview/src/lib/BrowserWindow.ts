export class BrowserWindow {
  private iframe: HTMLIFrameElement;
  private urlInput: HTMLInputElement;

  constructor(
    contentElement: HTMLDivElement,
    _windowId: string,
    initialUrl?: string
  ) {
    // Create browser toolbar
    const toolbar = document.createElement("div");
    toolbar.className =
      "flex items-center gap-1 px-2 py-1.5 bg-[oklch(0.18_0_0)] border-b border-[oklch(1_0_0/8%)] shrink-0";

    const btnClass =
      "inline-flex items-center justify-center size-6 rounded-md text-[oklch(0.65_0_0)] hover:text-[oklch(0.85_0_0)] hover:bg-[oklch(1_0_0/8%)] transition-colors text-xs cursor-pointer border-none bg-transparent";

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
      "flex-1 h-6 px-2.5 rounded-md text-xs bg-[oklch(0.14_0_0)] text-[oklch(0.8_0_0)] border border-[oklch(1_0_0/10%)] outline-none placeholder:text-[oklch(0.45_0_0)] focus:border-[oklch(0.5_0.15_250)] transition-colors";
    this.urlInput.placeholder = "Enter URL...";

    const goBtn = document.createElement("button");
    goBtn.className = btnClass;
    goBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    goBtn.title = "Go";
    goBtn.addEventListener("click", () => this.navigate());

    this.urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.navigate();
      e.stopPropagation();
    });

    toolbar.addEventListener("pointerdown", (e) => e.stopPropagation());

    toolbar.appendChild(backBtn);
    toolbar.appendChild(forwardBtn);
    toolbar.appendChild(reloadBtn);
    toolbar.appendChild(this.urlInput);
    toolbar.appendChild(goBtn);

    // Create iframe
    this.iframe = document.createElement("iframe");
    this.iframe.className = "browser-frame";
    this.iframe.sandbox.add(
      "allow-scripts",
      "allow-same-origin",
      "allow-forms",
      "allow-popups"
    );

    contentElement.appendChild(toolbar);
    contentElement.appendChild(this.iframe);

    if (initialUrl) {
      this.urlInput.value = initialUrl;
      this.iframe.src = initialUrl;
    }
  }

  private navigate() {
    let url = this.urlInput.value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    this.urlInput.value = url;
    this.iframe.src = url;
  }

  public getUrl(): string {
    return this.urlInput.value;
  }

  public destroy() {
    this.iframe.src = "about:blank";
  }
}
