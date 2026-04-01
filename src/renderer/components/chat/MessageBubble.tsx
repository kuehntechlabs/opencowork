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
                <TextContent key={part.id} text={part.text} isUser={isUser} />
              );
            case "tool":
              return <ToolCallBlock key={part.id} part={part} />;
            default:
              return null;
          }
        })}

        {/* Assistant metadata */}
        {message.role === "assistant" &&
          (() => {
            const msg = message as AssistantMessage;
            return msg.tokens ? (
              <div className="mt-2 flex items-center gap-3 border-t border-border/30 pt-2 text-[10px] text-text-tertiary">
                <span>{msg.tokens.input + msg.tokens.output} tokens</span>
                {msg.cost > 0 && <span>${msg.cost.toFixed(4)}</span>}
                {msg.providerID && (
                  <span>
                    {msg.providerID}/{msg.modelID}
                  </span>
                )}
              </div>
            ) : null;
          })()}
      </div>
    </div>
  );
}
