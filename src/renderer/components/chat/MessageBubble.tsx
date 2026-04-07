import type { Message, AssistantMessage } from "../../api/types";
import { useSessionStore } from "../../stores/session-store";
import { TextContent } from "./TextContent";
import { ReasoningBlock } from "./ReasoningBlock";
import { ToolCallBlock } from "./ToolCallBlock";

interface Props {
  message: Message;
}

const emptyParts: never[] = [];

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const parts = useSessionStore((s) => s.parts[message.id]) ?? emptyParts;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-accent text-accent-text"
            : "bg-surface-secondary text-text"
        }`}
      >
        {/* User messages - show text from first text part or indicate it's a prompt */}
        {isUser && parts.length === 0 && (
          <span className="text-sm opacity-70">Sent a message</span>
        )}

        {/* Render parts */}
        {parts.map((part) => {
          switch (part.type) {
            case "reasoning":
              return <ReasoningBlock key={part.id} part={part} />;
            case "text":
              return (
                <TextContent
                  key={part.id}
                  text={part.text}
                  isUser={isUser}
                  sessionId={message.sessionID}
                />
              );
            case "tool":
              return <ToolCallBlock key={part.id} part={part} />;
            case "step-start":
              return null;
            case "step-finish":
              return (
                <div
                  key={part.id}
                  className="my-1 flex items-center gap-2 text-[10px] text-text-tertiary"
                >
                  <span>{part.tokens.input + part.tokens.output} tokens</span>
                  {part.cost > 0 && <span>${part.cost.toFixed(4)}</span>}
                </div>
              );
            case "file":
              return (
                <div
                  key={part.id}
                  className="my-1 flex items-center gap-1.5 rounded border border-border/40 bg-surface-tertiary/20 px-2 py-1 text-xs text-text-secondary"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {part.filename || "file"}
                </div>
              );
            default:
              return null;
          }
        })}

        {/* Assistant: show fallback when only tool/reasoning parts exist (no text output) */}
        {message.role === "assistant" &&
          parts.length > 0 &&
          !parts.some((p) => p.type === "text") &&
          parts.some(
            (p) => p.type === "tool" && p.state.status === "completed",
          ) &&
          (message as AssistantMessage).finish && (
            <p className="mt-1 text-xs italic text-text-tertiary">
              Completed actions above.
            </p>
          )}

        {/* Assistant: show spinner while waiting for first content */}
        {message.role === "assistant" &&
          parts.length === 0 &&
          !(message as AssistantMessage).finish && (
            <div className="flex items-center gap-2 py-1">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-tertiary/30 border-t-text-tertiary" />
              <span className="text-xs text-text-tertiary">Thinking...</span>
            </div>
          )}

        {/* Assistant metadata (only if no step-finish parts already show this) */}
        {message.role === "assistant" &&
          !parts.some((p) => p.type === "step-finish") &&
          (() => {
            const msg = message as AssistantMessage;
            // Don't show metadata while still waiting for content
            if (parts.length === 0 && !msg.finish) return null;
            const totalTokens = msg.tokens
              ? msg.tokens.input + msg.tokens.output
              : 0;
            if (!totalTokens && !msg.cost && !msg.providerID) return null;
            return (
              <div className="mt-2 flex items-center gap-3 border-t border-border/30 pt-2 text-[10px] text-text-tertiary">
                {totalTokens > 0 && <span>{totalTokens} tokens</span>}
                {msg.cost > 0 && <span>${msg.cost.toFixed(4)}</span>}
                {msg.providerID && (
                  <span>
                    {msg.providerID}/{msg.modelID}
                  </span>
                )}
              </div>
            );
          })()}
      </div>
    </div>
  );
}
