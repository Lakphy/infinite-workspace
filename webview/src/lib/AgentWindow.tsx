import { createRoot, Root } from "react-dom/client";
import { AgentChat } from "@/components/AgentChat";

interface VsCodeApi {
  postMessage(msg: unknown): void;
}

export class AgentWindow {
  private root: Root;

  constructor(
    contentElement: HTMLDivElement,
    windowId: string,
    vscode: VsCodeApi,
    initialPath?: string
  ) {
    this.root = createRoot(contentElement);
    this.root.render(
      <AgentChat
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
