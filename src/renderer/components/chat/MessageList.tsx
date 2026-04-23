import { useEffect, useRef } from "react";
import type { Message } from "../../api/types";
import { MessageBubble } from "./MessageBubble";
import { useSessionStore } from "../../stores/session-store";

interface Props {
  sessionId: string;
  messages: Message[];
}

export function MessageList({ sessionId, messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const status = useSessionStore((s) => s.sessionStatus[sessionId]);
  const isBusy = status?.type === "busy";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    if (isBusy) {
      return (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-text-tertiary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-tertiary/30 border-t-text-tertiary" />
          Sending…
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
        Start a conversation…
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-4 px-4 py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
