import { useEffect, useRef } from "react";
import type { Message } from "../../api/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  sessionId: string;
  messages: Message[];
}

export function MessageList({ sessionId, messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
        Start a conversation...
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
