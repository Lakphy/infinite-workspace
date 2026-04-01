/**
 * AgentManager — manages Claude Agent SDK sessions per window.
 * Runs in the VS Code extension host (Node.js).
 *
 * Each agent window gets its own streaming session using the SDK's
 * AsyncIterable prompt mode for multi-turn conversations.
 */

import type * as vscode from "vscode";

// We dynamically import the SDK so the extension still loads
// if `@anthropic-ai/claude-agent-sdk` is not installed.
let queryFn: typeof import("@anthropic-ai/claude-agent-sdk").query | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  queryFn = require("@anthropic-ai/claude-agent-sdk").query;
} catch {
  // SDK not available
}

/* ------------------------------------------------------------------ */
/*  AsyncIterable helper for streaming user prompts into the SDK      */
/* ------------------------------------------------------------------ */

interface SDKUserMessage {
  type: "user";
  session_id: string;
  message: { role: "user"; content: string };
  parent_tool_use_id: null;
}

/** Creates a push-based async iterable that can be fed user messages. */
function createPromptStream() {
  type Resolve = (value: IteratorResult<SDKUserMessage>) => void;
  const pending: SDKUserMessage[] = [];
  let waiting: Resolve | null = null;
  let done = false;

  return {
    push(msg: SDKUserMessage) {
      if (done) return;
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve({ value: msg, done: false });
      } else {
        pending.push(msg);
      }
    },
    end() {
      done = true;
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve({ value: undefined as unknown as SDKUserMessage, done: true });
      }
    },
    [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
      return {
        next(): Promise<IteratorResult<SDKUserMessage>> {
          if (pending.length > 0) {
            return Promise.resolve({ value: pending.shift()!, done: false });
          }
          if (done) {
            return Promise.resolve({
              value: undefined as unknown as SDKUserMessage,
              done: true,
            });
          }
          return new Promise<IteratorResult<SDKUserMessage>>((resolve) => {
            waiting = resolve;
          });
        },
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Message serialization helpers                                     */
/* ------------------------------------------------------------------ */

/**
 * Serialize an SDK message to a plain JSON-safe object.
 * We strip circular references and keep only the data the webview needs.
 */
function serializeMessage(msg: Record<string, unknown>): Record<string, unknown> {
  try {
    // Quick clone via JSON to strip non-serializable fields
    return JSON.parse(JSON.stringify(msg));
  } catch {
    return { type: msg.type, error: "serialization_failed" };
  }
}

/* ------------------------------------------------------------------ */
/*  AgentSession                                                      */
/* ------------------------------------------------------------------ */

export interface AgentConfig {
  model?: string;
  permissionMode?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  effort?: string;
  customSystemPrompt?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
}

interface AgentSession {
  abortController: AbortController;
  promptStream: ReturnType<typeof createPromptStream>;
  queryInstance: AsyncGenerator<unknown, void> | null;
  sessionId: string | null;
  isProcessing: boolean;
  config: AgentConfig;
}

/* ------------------------------------------------------------------ */
/*  AgentManager                                                      */
/* ------------------------------------------------------------------ */

export class AgentManager {
  private sessions = new Map<string, AgentSession>();
  private postMessage: (windowId: string, data: Record<string, unknown>) => void;
  private workspaceCwd: string;

  constructor(
    postMessage: (windowId: string, data: Record<string, unknown>) => void,
    workspaceCwd?: string
  ) {
    this.postMessage = postMessage;
    this.workspaceCwd = workspaceCwd || process.cwd();
  }

  /** Check if the SDK is available */
  get isAvailable(): boolean {
    return typeof queryFn === "function";
  }

  /**
   * Create a new agent session for a window.
   * Starts the SDK query in streaming-input mode.
   */
  async create(windowId: string, cwd?: string, config?: AgentConfig): Promise<void> {
    if (!queryFn) {
      this.postMessage(windowId, {
        type: "agentMessage",
        message: {
          type: "agentError",
          error:
            "Claude Agent SDK is not available. Please install @anthropic-ai/claude-agent-sdk and ensure Claude Code CLI is installed.",
        },
      });
      return;
    }

    // Clean up existing session if any
    this.destroy(windowId);

    const abortController = new AbortController();
    const promptStream = createPromptStream();
    const sessionCwd = cwd || this.workspaceCwd;
    const sessionConfig = config || {};

    const session: AgentSession = {
      abortController,
      promptStream,
      queryInstance: null,
      sessionId: null,
      isProcessing: false,
      config: sessionConfig,
    };
    this.sessions.set(windowId, session);

    // Notify webview that session is ready
    this.postMessage(windowId, {
      type: "agentMessage",
      message: {
        type: "agentReady",
        cwd: sessionCwd,
        config: sessionConfig,
      },
    });
  }

  /**
   * Send a user prompt to an existing session.
   * On the first prompt, starts the SDK query. Subsequent prompts
   * feed into the streaming input.
   */
  async sendPrompt(windowId: string, prompt: string, cwd?: string): Promise<void> {
    if (!queryFn) return;

    let session = this.sessions.get(windowId);
    if (!session) {
      // Auto-create if needed
      await this.create(windowId, cwd);
      session = this.sessions.get(windowId);
      if (!session) return;
    }

    session.isProcessing = true;

    if (!session.queryInstance) {
      // First prompt — start the query with streaming input mode
      const sessionCwd = cwd || this.workspaceCwd;
      const abortController = session.abortController;
      const promptStream = session.promptStream;
      const cfg = session.config;

      // Push the first message
      promptStream.push({
        type: "user",
        session_id: "",
        message: { role: "user", content: prompt },
        parent_tool_use_id: null,
      });

      // Build SDK options from config
      const permMode = cfg.permissionMode || "bypassPermissions";
      const systemPrompt: unknown = cfg.customSystemPrompt
        ? { type: "preset", preset: "claude_code", append: cfg.customSystemPrompt }
        : { type: "preset", preset: "claude_code" };

      const sdkOptions: Record<string, unknown> = {
        abortController,
        cwd: sessionCwd,
        tools: { type: "preset", preset: "claude_code" },
        systemPrompt,
        permissionMode: permMode,
        allowDangerouslySkipPermissions: permMode === "bypassPermissions",
        includePartialMessages: true,
      };

      // Conditionally add optional options
      if (cfg.model) sdkOptions.model = cfg.model;
      if (cfg.maxTurns && cfg.maxTurns > 0) sdkOptions.maxTurns = cfg.maxTurns;
      if (cfg.maxBudgetUsd && cfg.maxBudgetUsd > 0) sdkOptions.maxBudgetUsd = cfg.maxBudgetUsd;
      if (cfg.effort) sdkOptions.effort = cfg.effort;
      if (cfg.allowedTools && cfg.allowedTools.length > 0) sdkOptions.allowedTools = cfg.allowedTools;
      if (cfg.disallowedTools && cfg.disallowedTools.length > 0) sdkOptions.disallowedTools = cfg.disallowedTools;

      // Start the query
      const q = queryFn({
        prompt: promptStream as unknown as AsyncIterable<never>,
        options: sdkOptions as never,
      });

      session.queryInstance = q as unknown as AsyncGenerator<unknown, void>;

      // Start consuming messages in the background
      this.consumeMessages(windowId, q as unknown as AsyncGenerator<Record<string, unknown>, void>);
    } else {
      // Subsequent prompt — push into the stream
      session.promptStream.push({
        type: "user",
        session_id: session.sessionId || "",
        message: { role: "user", content: prompt },
        parent_tool_use_id: null,
      });
    }
  }

  /**
   * Consume SDK messages and forward to the webview.
   */
  private async consumeMessages(
    windowId: string,
    query: AsyncGenerator<Record<string, unknown>, void>
  ): Promise<void> {
    try {
      for await (const msg of query) {
        const session = this.sessions.get(windowId);
        if (!session) break;

        // Capture session ID
        if (msg.session_id && !session.sessionId) {
          session.sessionId = msg.session_id as string;
        }

        // Forward to webview
        const serialized = serializeMessage(msg);
        this.postMessage(windowId, {
          type: "agentMessage",
          message: serialized,
        });

        // Mark as idle on result messages
        if (msg.type === "result") {
          session.isProcessing = false;
        }
      }
    } catch (err: unknown) {
      const session = this.sessions.get(windowId);
      if (session) {
        session.isProcessing = false;
      }
      const message = err instanceof Error ? err.message : String(err);
      // Don't report abort errors
      if (!message.includes("abort") && !message.includes("AbortError")) {
        this.postMessage(windowId, {
          type: "agentMessage",
          message: {
            type: "agentError",
            error: message,
          },
        });
      }
    }
  }

  /** Abort the current processing */
  abort(windowId: string): void {
    const session = this.sessions.get(windowId);
    if (session) {
      session.abortController.abort();
      session.isProcessing = false;
      // Create a new abort controller for future requests
      session.abortController = new AbortController();
    }
  }

  /** Destroy a session and clean up resources */
  destroy(windowId: string): void {
    const session = this.sessions.get(windowId);
    if (session) {
      session.abortController.abort();
      session.promptStream.end();
      this.sessions.delete(windowId);
    }
  }

  /** Dispose all sessions */
  disposeAll(): void {
    for (const [windowId] of this.sessions) {
      this.destroy(windowId);
    }
  }
}
