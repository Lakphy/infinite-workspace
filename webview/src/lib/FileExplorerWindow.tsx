import { createRoot, Root } from "react-dom/client";
import { FileExplorer } from "@/components/FileExplorer";

interface VsCodeApi {
  postMessage(msg: unknown): void;
}

export class FileExplorerWindow {
  private root: Root;

  constructor(
    contentElement: HTMLDivElement,
    windowId: string,
    vscode: VsCodeApi,
    initialPath?: string
  ) {
    this.root = createRoot(contentElement);
    this.root.render(
      <FileExplorer
        windowId={windowId}
        vscode={vscode}
        initialPath={initialPath}
      />
    );
  }

  public destroy() {
    this.root.unmount();
  }
}
