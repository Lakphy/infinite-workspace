import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send,
  Square,
  Loader2,
  ChevronRight,
  ChevronDown,
  Terminal,
  FileText,
  Search,
  FolderOpen,
  Pencil,
  Eye,
  Wrench,
  AlertCircle,
  Sparkles,
  Code,
  Copy,
  Check,
  Settings2,
  FolderSearch,
  Lock,
  Shield,
  Wrench as WrenchIcon,
  MessageSquareText,
} from "lucide-react";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";

interface VsCodeApi {
  postMessage(msg: unknown): void;
}

/* ------------------------------------------------------------------ */
/*  Types for parsed SDK messages                                     */
/* ------------------------------------------------------------------ */

interface TextBlock {
  type: "text";
  text: string;
}

interface ThinkingBlock {
  type: "thinking";
  thinking: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: ContentBlock[];
  timestamp: number;
  isStreaming?: boolean;
  // Result metadata
  costUsd?: number;
  durationMs?: number;
  numTurns?: number;
  // Raw SDK message JSON
  rawMessages?: Record<string, unknown>[];
}

/* ------------------------------------------------------------------ */
/*  Tool icon helper                                                  */
/* ------------------------------------------------------------------ */

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Bash: Terminal,
  Read: FileText,
  Write: FileText,
  Edit: Pencil,
  Grep: Search,
  Glob: FolderOpen,
  WebSearch: Search,
  WebFetch: Eye,
  Agent: Sparkles,
  AskUserQuestion: AlertCircle,
};

function getToolIcon(toolName: string) {
  return TOOL_ICONS[toolName] || Wrench;
}

/* ------------------------------------------------------------------ */
/*  ToolUseDisplay                                                    */
/* ------------------------------------------------------------------ */

function ToolUseDisplay({
  block,
  result,
}: {
  block: ToolUseBlock;
  result?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const ToolIcon = getToolIcon(block.name);

  // Format tool input for display
  const inputSummary = (() => {
    if (block.name === "Bash" && block.input.command) {
      return String(block.input.command);
    }
    if ((block.name === "Read" || block.name === "Write" || block.name === "Edit") && block.input.file_path) {
      return String(block.input.file_path);
    }
    if (block.name === "Grep" && block.input.pattern) {
      return String(block.input.pattern);
    }
    if (block.name === "Glob" && block.input.pattern) {
      return String(block.input.pattern);
    }
    if (block.name === "WebSearch" && block.input.query) {
      return String(block.input.query);
    }
    return "";
  })();

  return (
    <div className="agent-tool-block">
      <button
        className="agent-tool-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="agent-tool-chevron">
          {expanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </span>
        <ToolIcon className="size-3 shrink-0" />
        <span className="agent-tool-name">{block.name}</span>
        {inputSummary && (
          <span className="agent-tool-summary">{inputSummary}</span>
        )}
        {!result && (
          <Loader2 className="size-3 shrink-0 animate-spin opacity-50" />
        )}
      </button>
      {expanded && (
        <div className="agent-tool-body">
          <div className="agent-tool-section">
            <div className="agent-tool-section-label">Input</div>
            <pre className="agent-tool-pre">
              {JSON.stringify(block.input, null, 2)}
            </pre>
          </div>
          {result && (
            <div className="agent-tool-section">
              <div className="agent-tool-section-label">Output</div>
              <pre className="agent-tool-pre">{result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ThinkingDisplay                                                   */
/* ------------------------------------------------------------------ */

function ThinkingDisplay({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="agent-thinking-block">
      <button
        className="agent-thinking-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="agent-tool-chevron">
          {expanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </span>
        <Sparkles className="size-3 shrink-0 opacity-50" />
        <span className="agent-thinking-label">Thinking</span>
      </button>
      {expanded && (
        <div className="agent-thinking-body">
          <pre className="agent-tool-pre">{text}</pre>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MetadataJsonDisplay                                               */
/* ------------------------------------------------------------------ */

function MetadataJsonDisplay({ data, visible }: { data: Record<string, unknown>[]; visible: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  const jsonStr = JSON.stringify(data.length === 1 ? data[0] : data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="agent-meta-json">
      <div className="agent-meta-json-actions">
        <Button
          variant="outline"
          size="sm"
          className="h-5 px-1.5 text-[10px] gap-1"
          onClick={() => setExpanded(!expanded)}
        >
          <Code className="size-3" />
          {expanded ? "Hide" : "JSON"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
      </div>
      {expanded && (
        <pre className="agent-meta-json-body">
          {jsonStr}
        </pre>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MessageDisplay                                                    */
/* ------------------------------------------------------------------ */

function MessageDisplay({
  message,
  toolResults,
  showJson,
}: {
  message: ChatMessage;
  toolResults: Map<string, string>;
  showJson: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="agent-msg agent-msg-user">
        <div className="agent-msg-content">
          {message.content.map((block, i) => {
            if (block.type === "text") {
              return (
                <div key={i} className="agent-text">
                  {block.text}
                </div>
              );
            }
            return null;
          })}
        </div>
        {message.rawMessages && message.rawMessages.length > 0 && (
          <MetadataJsonDisplay data={message.rawMessages} visible={showJson} />
        )}
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className="agent-msg agent-msg-system">
        <div className="agent-msg-content">
          {message.content.map((block, i) => {
            if (block.type === "text") {
              return (
                <div key={i} className="agent-system-text">
                  {block.text}
                </div>
              );
            }
            return null;
          })}
        </div>
        {message.rawMessages && message.rawMessages.length > 0 && (
          <MetadataJsonDisplay data={message.rawMessages} visible={showJson} />
        )}
      </div>
    );
  }

  // Assistant message
  return (
    <div className="agent-msg agent-msg-assistant">
      <div className="agent-msg-content">
        {message.content.map((block, i) => {
          if (block.type === "text" && block.text) {
            return (
              <div key={i} className="agent-text">
                {block.text}
              </div>
            );
          }
          if (block.type === "thinking" && block.thinking) {
            return <ThinkingDisplay key={i} text={block.thinking} />;
          }
          if (block.type === "tool_use") {
            return (
              <ToolUseDisplay
                key={i}
                block={block}
                result={toolResults.get(block.id)}
              />
            );
          }
          return null;
        })}
      </div>
      {message.costUsd !== undefined && (
        <div className="agent-msg-meta">
          {message.costUsd > 0 && (
            <span>${message.costUsd.toFixed(4)}</span>
          )}
          {message.durationMs !== undefined && (
            <span>{(message.durationMs / 1000).toFixed(1)}s</span>
          )}
          {message.numTurns !== undefined && (
            <span>{message.numTurns} turns</span>
          )}
        </div>
      )}
      {message.rawMessages && message.rawMessages.length > 0 && (
        <MetadataJsonDisplay data={message.rawMessages} visible={showJson} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AgentChat                                                         */
/* ------------------------------------------------------------------ */

export interface AgentConfig {
  model: string;
  permissionMode: string;
  maxTurns: number;
  maxBudgetUsd: number;
  effort: string;
  customSystemPrompt: string;
  allowedTools: string;
  disallowedTools: string;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: "",
  permissionMode: "bypassPermissions",
  maxTurns: 0,
  maxBudgetUsd: 0,
  effort: "high",
  customSystemPrompt: "",
  allowedTools: "",
  disallowedTools: "",
};

const MODEL_PRESETS = [
  { value: "__default__", label: "Default", description: "Use Claude Code default" },
  { value: "opus", label: "Opus", description: "Best for heavier reasoning" },
  { value: "sonnet", label: "Sonnet", description: "Balanced daily coding model" },
  { value: "haiku", label: "Haiku", description: "Fast and lightweight" },
  { value: "__custom__", label: "Custom", description: "Enter your own model alias or ID" },
] as const;

const TOOL_OPTIONS = [
  "Agent",
  "AskUserQuestion",
  "Bash",
  "CronCreate",
  "CronDelete",
  "CronList",
  "Edit",
  "EnterPlanMode",
  "EnterWorktree",
  "ExitPlanMode",
  "ExitWorktree",
  "Glob",
  "Grep",
  "ListMcpResourcesTool",
  "LSP",
  "NotebookEdit",
  "PowerShell",
  "Read",
  "ReadMcpResourceTool",
  "SendMessage",
  "Skill",
  "TaskCreate",
  "TaskGet",
  "TaskList",
  "TaskOutput",
  "TaskStop",
  "TaskUpdate",
  "TeamCreate",
  "TeamDelete",
  "TodoWrite",
  "ToolSearch",
  "WebFetch",
  "WebSearch",
  "Write",
] as const;

function parseToolList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinToolList(values: string[]): string {
  return values.join(", ");
}

function toggleToolValue(value: string, toolName: string): string {
  const current = parseToolList(value);
  const next = current.includes(toolName)
    ? current.filter((tool) => tool !== toolName)
    : [...current, toolName];
  return joinToolList(next);
}

function getModelSelectValue(model: string): string {
  if (model === "") return "__default__";
  return MODEL_PRESETS.some((preset) => preset.value === model)
    ? model
    : "__custom__";
}

interface AgentChatProps {
  windowId: string;
  vscode: VsCodeApi;
  initialPath?: string;
  initialConfig?: Partial<AgentConfig>;
}

function ConfigSection({
  className,
  title,
  description,
  icon: Icon,
  children,
}: {
  className?: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className={`agent-config-card ${className || ""}`}>
      <div className="agent-config-card-header">
        <div className="agent-config-card-icon">
          <Icon className="size-3.5" />
        </div>
        <div className="agent-config-card-copy">
          <h3 className="agent-config-card-title">{title}</h3>
          <p className="agent-config-card-description">{description}</p>
        </div>
      </div>
      <div className="agent-config-card-body">
        {children}
      </div>
    </section>
  );
}

function ToolPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const selectedTools = parseToolList(value);

  return (
    <div className="agent-config-field">
      <Label className="agent-config-field-label">{label}</Label>
      <div className="agent-tool-picker">
        {TOOL_OPTIONS.map((tool) => {
          const selected = selectedTools.includes(tool);
          return (
            <button
              key={tool}
              type="button"
              className={cn("agent-tool-chip", selected && "agent-tool-chip-selected")}
              onClick={() => onChange(toggleToolValue(value, tool))}
              disabled={disabled}
            >
              {tool}
            </button>
          );
        })}
      </div>
      <TagInput
        placeholder="Add custom tools if needed..."
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        className="agent-config-tag-input"
      />
    </div>
  );
}

export function AgentChat({ windowId, vscode, initialPath, initialConfig }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolResults] = useState<Map<string, string>>(() => new Map());
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cwd, setCwd] = useState(initialPath || "");
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState<boolean>(true);
  const [showJson, setShowJson] = useState(false);
  const [config, setConfig] = useState<AgentConfig>(() => ({
    ...DEFAULT_AGENT_CONFIG,
    ...initialConfig,
  }));
  const [sessionStarted, setSessionStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentAssistantMsgRef = useRef<string | null>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Request workspace path if no initialPath
  useEffect(() => {
    if (!initialPath) {
      vscode.postMessage({ type: "getWorkspacePath", windowId });
    }
  }, [windowId, vscode, initialPath]);

  // Request session creation with config
  useEffect(() => {
    const agentConfig: Record<string, unknown> = { ...config };
    // Convert comma-separated tool strings to arrays
    if (config.allowedTools) agentConfig.allowedTools = config.allowedTools.split(",").map(s => s.trim()).filter(Boolean);
    else agentConfig.allowedTools = [];
    if (config.disallowedTools) agentConfig.disallowedTools = config.disallowedTools.split(",").map(s => s.trim()).filter(Boolean);
    else agentConfig.disallowedTools = [];
    vscode.postMessage({
      type: "agentCreate",
      windowId,
      data: initialPath,
      agentConfig,
    });
  }, [windowId, vscode, initialPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle messages from extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data.windowId !== windowId) return;

      // Handle directory picker result
      if (data.type === "pickedDirectory" && data.data) {
        setCwd(data.data as string);
        return;
      }

      // Handle workspace path response — always set CWD when no explicit initialPath
      if (data.type === "workspacePath" && data.data && !initialPath) {
        setCwd(data.data as string);
        return;
      }

      if (data.type !== "agentMessage") return;

      const msg = data.message;
      if (!msg) return;

      switch (msg.type) {
        case "agentReady":
          if (initialPath) {
            setCwd(msg.cwd || initialPath);
          }
          break;

        case "agentError":
          setError(msg.error);
          setIsProcessing(false);
          break;

        case "system":
          if (msg.subtype === "init") {
            if (initialPath) {
              setCwd(msg.cwd || cwd);
            }
            setMessages((prev) => [
              ...prev,
              {
                id: msg.uuid || `sys-${Date.now()}`,
                role: "system",
                content: [
                  {
                    type: "text",
                    text: `Session initialized · ${msg.model || "Claude"} · ${msg.tools?.length || 0} tools available`,
                  },
                ],
                timestamp: Date.now(),
                rawMessages: [msg],
              },
            ]);
          }
          break;

        case "assistant": {
          const assistantContent: ContentBlock[] = [];
          const msgContent = msg.message?.content;
          if (Array.isArray(msgContent)) {
            for (const block of msgContent) {
              if (block.type === "text") {
                assistantContent.push({ type: "text", text: block.text || "" });
              } else if (block.type === "thinking") {
                assistantContent.push({
                  type: "thinking",
                  thinking: block.thinking || "",
                });
              } else if (block.type === "tool_use") {
                assistantContent.push({
                  type: "tool_use",
                  id: block.id,
                  name: block.name,
                  input: block.input || {},
                });
              }
            }
          }

          const msgId = msg.uuid || `asst-${Date.now()}`;
          currentAssistantMsgRef.current = msgId;
          setMessages((prev) => {
            // First try to find by exact ID match
            const existingById = prev.findIndex((m) => m.id === msgId);
            if (existingById >= 0) {
              const updated = [...prev];
              updated[existingById] = {
                ...updated[existingById],
                content: assistantContent,
                isStreaming: false,
                rawMessages: [...(updated[existingById].rawMessages || []), msg],
              };
              return updated;
            }
            // Then try to replace the most recent streaming assistant message
            let streamingIdx = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].role === "assistant" && prev[i].isStreaming) {
                streamingIdx = i;
                break;
              }
            }
            if (streamingIdx >= 0) {
              const updated = [...prev];
              updated[streamingIdx] = {
                ...updated[streamingIdx],
                id: msgId,
                content: assistantContent,
                isStreaming: false,
                rawMessages: [...(updated[streamingIdx].rawMessages || []), msg],
              };
              return updated;
            }
            return [
              ...prev,
              {
                id: msgId,
                role: "assistant",
                content: assistantContent,
                timestamp: Date.now(),
                rawMessages: [msg],
              },
            ];
          });
          break;
        }

        case "user": {
          // Echoed user messages from the SDK (e.g., tool results)
          if (msg.isSynthetic || msg.tool_use_result !== undefined) {
            // This is a tool result being fed back
            if (msg.tool_use_result && msg.message?.content) {
              const content = msg.message.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === "tool_result" && block.tool_use_id) {
                    const text =
                      typeof block.content === "string"
                        ? block.content
                        : Array.isArray(block.content)
                          ? block.content
                            .filter(
                              (c: { type: string }) => c.type === "text"
                            )
                            .map(
                              (c: { text: string }) => c.text
                            )
                            .join("\n")
                          : JSON.stringify(block.content);
                    toolResults.set(block.tool_use_id, text);
                    // Force re-render
                    setMessages((prev) => [...prev]);
                  }
                }
              }
            }
          }
          break;
        }

        case "result": {
          setIsProcessing(false);
          currentAssistantMsgRef.current = null;

          if (msg.subtype === "success") {
            // Update last assistant message with cost info
            setMessages((prev) => {
              const updated = [...prev];
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].role === "assistant") {
                  updated[i] = {
                    ...updated[i],
                    costUsd: msg.total_cost_usd,
                    durationMs: msg.duration_ms,
                    numTurns: msg.num_turns,
                    isStreaming: false,
                  };
                  break;
                }
              }
              return updated;
            });
          } else {
            // Error result
            const errors = msg.errors?.join(", ") || "Unknown error";
            setMessages((prev) => [
              ...prev,
              {
                id: `err-${Date.now()}`,
                role: "system",
                content: [{ type: "text", text: `Error: ${errors}` }],
                timestamp: Date.now(),
                rawMessages: [msg],
              },
            ]);
          }
          break;
        }

        case "stream_event": {
          // Partial streaming message
          const event = msg.event;
          if (!event) break;

          if (event.type === "content_block_delta") {
            const delta = event.delta;
            if (!delta) break;

            setMessages((prev) => {
              const updated = [...prev];
              // Find or create the streaming assistant message
              let lastAssistant = -1;
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].role === "assistant" && updated[i].isStreaming) {
                  lastAssistant = i;
                  break;
                }
              }

              if (lastAssistant < 0) {
                // Create new streaming message
                const newMsg: ChatMessage = {
                  id: msg.uuid || `stream-${Date.now()}`,
                  role: "assistant",
                  content: [],
                  timestamp: Date.now(),
                  isStreaming: true,
                };

                if (delta.type === "text_delta") {
                  newMsg.content.push({ type: "text", text: delta.text || "" });
                } else if (delta.type === "thinking_delta") {
                  newMsg.content.push({
                    type: "thinking",
                    thinking: delta.thinking || "",
                  });
                }
                return [...updated, newMsg];
              }

              // Append to existing streaming message
              const msg2 = { ...updated[lastAssistant] };
              const content = [...msg2.content];

              if (delta.type === "text_delta") {
                const lastBlock = content[content.length - 1];
                if (lastBlock?.type === "text") {
                  content[content.length - 1] = {
                    ...lastBlock,
                    text: lastBlock.text + (delta.text || ""),
                  };
                } else {
                  content.push({ type: "text", text: delta.text || "" });
                }
              } else if (delta.type === "thinking_delta") {
                const lastBlock = content[content.length - 1];
                if (lastBlock?.type === "thinking") {
                  content[content.length - 1] = {
                    ...lastBlock,
                    thinking: lastBlock.thinking + (delta.thinking || ""),
                  };
                } else {
                  content.push({
                    type: "thinking",
                    thinking: delta.thinking || "",
                  });
                }
              } else if (delta.type === "input_json_delta") {
                // Tool input streaming — update last tool_use block
                const lastToolUse = content
                  .slice()
                  .reverse()
                  .find((b) => b.type === "tool_use") as ToolUseBlock | undefined;
                if (lastToolUse) {
                  // Input will be complete in the full assistant message
                }
              }

              msg2.content = content;
              updated[lastAssistant] = msg2;
              return updated;
            });
          } else if (event.type === "content_block_start") {
            const block = event.content_block;
            if (!block) break;

            setMessages((prev) => {
              const updated = [...prev];
              let lastAssistant = -1;
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].role === "assistant" && updated[i].isStreaming) {
                  lastAssistant = i;
                  break;
                }
              }

              if (lastAssistant < 0) {
                const newMsg: ChatMessage = {
                  id: msg.uuid || `stream-${Date.now()}`,
                  role: "assistant",
                  content: [],
                  timestamp: Date.now(),
                  isStreaming: true,
                };

                if (block.type === "tool_use") {
                  newMsg.content.push({
                    type: "tool_use",
                    id: block.id,
                    name: block.name,
                    input: {},
                  });
                } else if (block.type === "thinking") {
                  newMsg.content.push({
                    type: "thinking",
                    thinking: block.thinking || "",
                  });
                }
                return [...updated, newMsg];
              }

              const msg2 = { ...updated[lastAssistant] };
              const content = [...msg2.content];

              if (block.type === "tool_use") {
                content.push({
                  type: "tool_use",
                  id: block.id,
                  name: block.name,
                  input: {},
                });
              } else if (block.type === "thinking") {
                content.push({
                  type: "thinking",
                  thinking: block.thinking || "",
                });
              }

              msg2.content = content;
              updated[lastAssistant] = msg2;
              return updated;
            });
          }
          break;
        }

        case "tool_progress":
          // Update tool progress display (optional enhancement)
          break;

        default:
          // Ignore other message types
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [windowId, initialPath, cwd, toolResults]);

  // Send prompt
  const handleSend = useCallback(() => {
    const prompt = inputValue.trim();
    if (!prompt || isProcessing) return;

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: [{ type: "text", text: prompt }],
        timestamp: Date.now(),
      },
    ]);

    setInputValue("");
    setIsProcessing(true);
    setError(null);
    setSessionStarted(true);
    setShowConfig(false);

    // Send to extension host
    vscode.postMessage({
      type: "agentPrompt",
      windowId,
      data: prompt,
      dirPath: cwd,
    });

    // Focus back to input
    inputRef.current?.focus();
  }, [inputValue, isProcessing, windowId, vscode, cwd]);

  // Abort
  const handleAbort = useCallback(() => {
    vscode.postMessage({
      type: "agentAbort",
      windowId,
    });
    setIsProcessing(false);
  }, [windowId, vscode]);

  // Handle textarea keydown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.nativeEvent.isComposing
      ) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Auto-resize textarea
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    },
    []
  );

  // Browse for directory
  const handleBrowseDir = useCallback(() => {
    vscode.postMessage({
      type: "pickDirectory",
      windowId,
      data: cwd || undefined,
    });
  }, [windowId, vscode, cwd]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="agent-root">
        {/* Header */}
        <div className="agent-header">
          <div className="agent-header-info">
            <FolderOpen className="size-3 shrink-0 opacity-60" />
            <span className="agent-header-cwd" title={cwd}>
              {cwd || "No directory"}
            </span>
          </div>
          <div className="agent-header-actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-5 w-5 ${showJson ? "bg-accent" : ""}`}
                  onClick={() => setShowJson(!showJson)}
                >
                  <Code className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Show JSON</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-5 w-5 ${showConfig ? "bg-accent" : ""}`}
                  onClick={() => setShowConfig(!showConfig)}
                >
                  <Settings2 className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Configuration</p></TooltipContent>
            </Tooltip>
            <div className="agent-header-status">
              {isProcessing ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  <span>Processing</span>
                </>
              ) : (
                <span className="opacity-50">Ready</span>
              )}
            </div>
          </div>
        </div>

        {/* Config Panel */}
        {showConfig && (
          <div className="agent-config-panel">
            <div className="agent-config-panel-head">
              <div className="agent-config-panel-title-wrap">
                <div className="agent-config-panel-title-row">
                  <Settings2 className="size-3.5" />
                  <span className="agent-config-panel-title">Session configuration</span>
                </div>
                <p className="agent-config-panel-description">
                  Tune the workspace, runtime behavior, tool access, and prompt before starting the session.
                </p>
              </div>
              {sessionStarted && (
                <div className="agent-config-lock-badge">
                  <Lock className="size-3" />
                  <span>Locked after first message</span>
                </div>
              )}
            </div>

            <div className="agent-config-scroll">
              <div className="agent-config-layout">
                <div className="agent-config-column">
                  <ConfigSection
                    title="Workspace"
                    description="Working directory"
                    icon={FolderOpen}
                  >
                    <div className="agent-config-field">
                      <Label className="agent-config-field-label">Current directory</Label>
                      <div className="agent-config-field-inline">
                        <Input
                          className="h-8 text-xs font-mono flex-1"
                          value={cwd}
                          onChange={(e) => setCwd(e.target.value)}
                          placeholder="/path/to/project"
                          disabled={sessionStarted}
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={handleBrowseDir}
                              disabled={sessionStarted}
                            >
                              <FolderSearch className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Browse…</p></TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </ConfigSection>

                  <ConfigSection
                    title="Tool access"
                    description="Allow or block tools"
                    icon={WrenchIcon}
                  >
                    <div className="agent-config-stack">
                      <ToolPicker
                        label="Allowed tools"
                        value={config.allowedTools}
                        onChange={(val) => setConfig({ ...config, allowedTools: val })}
                        disabled={sessionStarted}
                      />
                      <ToolPicker
                        label="Blocked tools"
                        value={config.disallowedTools}
                        onChange={(val) => setConfig({ ...config, disallowedTools: val })}
                        disabled={sessionStarted}
                      />
                    </div>
                  </ConfigSection>
                </div>

                <div className="agent-config-column">
                  <ConfigSection
                    title="Runtime"
                    description="Model, permissions, and limits"
                    icon={Shield}
                  >
                    <div className="agent-config-grid">
                      <div className="agent-config-field agent-config-field-span-2">
                        <Label className="agent-config-field-label">Model</Label>
                        <div className="agent-config-model-stack">
                          <Select
                            value={getModelSelectValue(config.model)}
                            onValueChange={(value) => {
                              if (value === "__custom__") {
                                setConfig({ ...config, model: config.model && !MODEL_PRESETS.some((preset) => preset.value === config.model) ? config.model : "" });
                                return;
                              }
                              setConfig({ ...config, model: value === "__default__" ? "" : value });
                            }}
                            disabled={sessionStarted}
                          >
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MODEL_PRESETS.map((preset) => (
                                <SelectItem key={preset.value} value={preset.value}>
                                  {preset.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {getModelSelectValue(config.model) === "__custom__" && (
                            <Input
                              className="h-8 text-xs font-mono"
                              value={config.model}
                              onChange={(e) => setConfig({ ...config, model: e.target.value })}
                              placeholder="claude-opus-4-6 or gateway model id"
                              disabled={sessionStarted}
                            />
                          )}
                        </div>
                      </div>

                      <div className="agent-config-field">
                        <Label className="agent-config-field-label">Permission mode</Label>
                        <Select
                          value={config.permissionMode}
                          onValueChange={(v) => setConfig({ ...config, permissionMode: v })}
                          disabled={sessionStarted}
                        >
                          <SelectTrigger className="h-8 text-xs w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">default</SelectItem>
                            <SelectItem value="acceptEdits">acceptEdits</SelectItem>
                            <SelectItem value="bypassPermissions">bypassPermissions</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="agent-config-field">
                        <Label className="agent-config-field-label">Effort</Label>
                        <Select
                          value={config.effort}
                          onValueChange={(v) => setConfig({ ...config, effort: v })}
                          disabled={sessionStarted}
                        >
                          <SelectTrigger className="h-8 text-xs w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">low</SelectItem>
                            <SelectItem value="medium">medium</SelectItem>
                            <SelectItem value="high">high</SelectItem>
                            <SelectItem value="max">max</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="agent-config-field">
                        <Label className="agent-config-field-label">Max turns</Label>
                        <Input
                          className="h-8 text-xs font-mono"
                          type="number"
                          min={0}
                          max={100}
                          value={config.maxTurns}
                          onChange={(e) => setConfig({ ...config, maxTurns: Number(e.target.value) || 0 })}
                          placeholder="0 = unlimited"
                          title="0 = unlimited"
                          disabled={sessionStarted}
                        />
                      </div>

                      <div className="agent-config-field">
                        <Label className="agent-config-field-label">Budget (USD)</Label>
                        <Input
                          className="h-8 text-xs font-mono"
                          type="number"
                          min={0}
                          step={0.01}
                          value={config.maxBudgetUsd}
                          onChange={(e) => setConfig({ ...config, maxBudgetUsd: Number(e.target.value) || 0 })}
                          placeholder="0 = unlimited"
                          title="0 = unlimited"
                          disabled={sessionStarted}
                        />
                      </div>
                    </div>
                  </ConfigSection>

                  <ConfigSection
                    title="System prompt"
                    description="Extra session instructions"
                    icon={MessageSquareText}
                  >
                    <div className="agent-config-field">
                      <Label className="agent-config-field-label">Prompt instructions</Label>
                      <Textarea
                        className="agent-config-prompt text-xs font-mono resize-y"
                        value={config.customSystemPrompt}
                        onChange={(e) => setConfig({ ...config, customSystemPrompt: e.target.value })}
                        placeholder="Additional system prompt instructions..."
                        rows={4}
                        disabled={sessionStarted}
                      />
                    </div>
                  </ConfigSection>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Message list */}
        <div className="agent-messages">
          {messages.length === 0 && !error && (
            <div className="agent-empty">
              <Sparkles className="size-5 opacity-20" />
              <span>Send a message to start</span>
            </div>
          )}
          {error && (
            <div className="agent-error-banner">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {messages.map((msg) => (
            <MessageDisplay
              key={msg.id}
              message={msg}
              toolResults={toolResults}
              showJson={showJson}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="agent-input-area">
          <div className="agent-composer">
            <div className="agent-composer-shell">
              <Textarea
                ref={inputRef}
                className="agent-input min-h-[36px] text-sm resize-none"
                placeholder="Message Claude Code..."
                value={inputValue}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={!!error && !isProcessing}
              />
              <div className="agent-input-actions">
                {isProcessing ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="agent-abort-btn"
                        onClick={handleAbort}
                      >
                        <Square className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Stop</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="agent-send-btn"
                        onClick={handleSend}
                        disabled={!inputValue.trim() || !!error}
                      >
                        <Send className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Send (Enter)</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
